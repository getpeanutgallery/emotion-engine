#!/usr/bin/env node
/**
 * Get Music Vocals Script
 * 
 * Extracts and analyzes music/audio from video to identify mood, intensity, and segments.
 * This script runs in Phase 1 (Gather Context) of the pipeline.
 *
 * Raw capture schema v2 parity (Phase2-style):
 * - attempt-scoped capture payloads (even if attempt is always 1 for now)
 * - legacy flat files preserved as pointer JSON
 * - phase error artifacts written to raw/_meta/errors.jsonl + errors.summary.json
 *
 * @module scripts/get-context/get-music-vocals
 */

const fs = require('fs');
const path = require('path');
const { spawn, execSync } = require('child_process');
const {
  executeWithTargets,
  getProviderForTarget,
  buildProviderOptions,
  createRetryableError,
  getPersistedErrorInfo
} = require('../../lib/ai-targets.cjs');
const outputManager = require('../../lib/output-manager.cjs');
const { shouldKeepProcessedIntermediates } = require('../../lib/processed-assets-policy.cjs');
const { shouldCaptureRaw, getRawPhaseDir, sanitizeRawCaptureValue, writeRawJson } = require('../../lib/raw-capture.cjs');
const { ensureToolVersionsCaptured } = require('../../lib/tool-versions.cjs');
const { ffmpegPath, ffprobePath } = require('../../lib/ffmpeg-path.cjs');
const { getEventsLogger } = require('../../lib/events-timeline.cjs');
const { storePromptPayload } = require('../../lib/prompt-store.cjs');
const { preflightAudio, planTimeChunks } = require('../../lib/audio-preflight.cjs');
const { getRecoveryRuntime, buildRecoveryPromptAddendum } = require('../../lib/ai-recovery-runtime.cjs');
const { buildEnglishOnlyOutputRuleBlock, pushEnglishOnlyError } = require('../../lib/english-only-contract.cjs');
const { extractAudioChunk } = require('../../lib/audio-chunk-extractor.cjs');
const {
  buildAudioExtractArgs,
  formatCommand,
  getAudioMimeType,
  getAudioOutputExtension,
  getRequiredAudioConfig
} = require('../../lib/ffmpeg-config.cjs');
const {
  parseAndValidateJsonObject,
  validateMusicVocalsAnalysisObject,
  validateRecognizedSong,
  validateOptionalRecognitionNotes
} = require('../../lib/structured-output.cjs');
const {
  buildMusicVocalsValidatorToolContract,
  executeMusicVocalsValidatorTool
} = require('../../lib/phase1-validator-tools.cjs');
const { executeLocalValidatorToolLoop } = require('../../lib/local-validator-tool-loop.cjs');
const {
  resolveProviderRuntimeConfigForTarget,
  ensureRuntimeAuthForDomain,
  buildProviderOptionDefaults
} = require('../../lib/provider-runtime-config.cjs');
const { applyFailureMetadata } = require('../../lib/tool-wrapper-contract.cjs');
const {
  compactString,
  normalizeMusicVocalSegments,
  normalizeRecognizedSong,
  normalizeRecognitionNotes,
  buildMusicVocalsData
} = require('../../lib/music-vocals-artifact.cjs');

const PHASE_KEY = 'phase1-gather-context';
const SCRIPT_ID = 'get-music-vocals';
const DEFAULT_MUSIC_ANALYSIS_WINDOW_SECONDS = 30;
const DEFAULT_PHASE1_MUSIC_MAX_WHOLE_ASSET_DURATION_SECONDS = 240;
const VALID_PHASE1_MUSIC_MODES = new Set(['auto', 'chunked', 'whole_asset', 'hybrid']);

function normalizePhase1MusicMode(value) {
  const normalized = compactString(value).toLowerCase();
  return VALID_PHASE1_MUSIC_MODES.has(normalized) ? normalized : null;
}

function resolveRequestedPhase1MusicMode(config = {}) {
  return normalizePhase1MusicMode(config?.settings?.phase1?.music?.mode) || 'auto';
}

function shouldFallbackWholeAssetMusicToChunked(config = {}) {
  return config?.settings?.phase1?.music?.fallback_to_chunked !== false;
}

function resolveMaxWholeAssetMusicDurationSeconds(config = {}) {
  const configured = Number(config?.settings?.phase1?.music?.max_whole_asset_duration_seconds);
  if (Number.isFinite(configured) && configured > 0) {
    return configured;
  }

  return DEFAULT_PHASE1_MUSIC_MAX_WHOLE_ASSET_DURATION_SECONDS;
}

function shouldEmitMusicGlobalArc(config = {}) {
  return config?.settings?.phase1?.music?.emit_global_arc !== false;
}

function pad(value, width) {
  return String(value).padStart(width, '0');
}

function runCommand(command, args) {
  return new Promise((resolve, reject) => {
    const proc = spawn(command, args);
    let stdout = '';
    let stderr = '';

    proc.stdout?.on('data', (data) => {
      stdout += data.toString();
    });

    proc.stderr?.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
        return;
      }

      const error = new Error(`${command} exited with code ${code}`);
      error.code = code;
      error.stdout = stdout;
      error.stderr = stderr;
      reject(error);
    });

    proc.on('error', (error) => {
      error.stdout = stdout;
      error.stderr = stderr;
      reject(error);
    });
  });
}

function getRetryConfig(config = {}, domain = 'music_vocals') {
  const retry = config?.ai?.[domain]?.retry || {};

  return {
    maxAttempts: Number.isInteger(retry.maxAttempts) && retry.maxAttempts > 0 ? retry.maxAttempts : 1,
    backoffMs: Number.isInteger(retry.backoffMs) && retry.backoffMs >= 0 ? retry.backoffMs : 0
  };
}

function getToolLoopConfig(config = {}, domain = 'music_vocals') {
  const toolLoop = config?.ai?.[domain]?.toolLoop || {};

  return {
    maxTurns: Number.isInteger(toolLoop.maxTurns) && toolLoop.maxTurns > 1 ? toolLoop.maxTurns : 4,
    maxValidatorCalls: Number.isInteger(toolLoop.maxValidatorCalls) && toolLoop.maxValidatorCalls > 0 ? toolLoop.maxValidatorCalls : 3
  };
}

function resolveMusicAnalysisWindowSeconds(config = {}) {
  const configuredPhase1 = Number(config?.settings?.phase1?.music?.analysis_window_seconds);
  if (Number.isFinite(configuredPhase1) && configuredPhase1 > 0) {
    return configuredPhase1;
  }

  const configuredLegacy = Number(config?.ai?.music_vocals?.analysisWindowSeconds ?? config?.ai?.music?.analysisWindowSeconds);
  if (Number.isFinite(configuredLegacy) && configuredLegacy > 0) {
    return configuredLegacy;
  }

  return DEFAULT_MUSIC_ANALYSIS_WINDOW_SECONDS;
}

function shouldPreferHybridMusicVocalsAnalysis(musicData = null) {
  if (!musicData || typeof musicData !== 'object' || Array.isArray(musicData)) {
    return false;
  }

  if (musicData.recognizedSong && typeof musicData.recognizedSong === 'object') {
    const status = compactString(musicData.recognizedSong.status).toLowerCase();
    if (status && status !== 'unknown') {
      return true;
    }
  }

  const lyricCuePattern = /\b(vocal|vocals|lyric|lyrics|chant|chanted|sung|song entry|song return|refrain|hook|rap)\b/i;
  const summary = compactString(musicData.summary);
  if (summary && lyricCuePattern.test(summary)) {
    return true;
  }

  const transitions = Array.isArray(musicData?.globalArc?.notableTransitions)
    ? musicData.globalArc.notableTransitions
    : [];
  return transitions.some((transition) => lyricCuePattern.test(compactString(transition?.label)));
}

function resolveMusicAnalysisStrategy(preflight, config = {}, musicData = null) {
  const requestedMode = resolveRequestedPhase1MusicMode(config);
  const maxWholeAssetDurationSeconds = resolveMaxWholeAssetMusicDurationSeconds(config);
  const durationSeconds = Number(preflight?.durationSeconds) || 0;
  const inlineWholeAssetSafe = preflight?.needsChunking !== true;
  const durationEligible = durationSeconds <= maxWholeAssetDurationSeconds;
  const wholeAssetEligible = inlineWholeAssetSafe && durationEligible;
  const preferHybrid = shouldPreferHybridMusicVocalsAnalysis(musicData);

  let actualMode = requestedMode;
  if (requestedMode === 'auto') {
    if (wholeAssetEligible) {
      actualMode = preferHybrid ? 'hybrid' : 'whole_asset';
    } else {
      actualMode = 'chunked';
    }
  }

  let wholeAssetUnavailableReason = null;
  if (!inlineWholeAssetSafe) {
    wholeAssetUnavailableReason = 'Whole-asset inline audio exceeds the configured base64 budget for this lane.';
  } else if (!durationEligible) {
    wholeAssetUnavailableReason = `Asset duration ${durationSeconds.toFixed(1)}s exceeds configured whole-asset limit ${maxWholeAssetDurationSeconds.toFixed(1)}s.`;
  }

  return {
    requestedMode,
    actualMode,
    wholeAssetEligible,
    wholeAssetUnavailableReason,
    durationSeconds,
    maxWholeAssetDurationSeconds,
    fallbackToChunked: shouldFallbackWholeAssetMusicToChunked(config),
    preferHybrid
  };
}

function buildFallbackNote(reason) {
  const normalized = compactString(reason);
  return normalized ? `Whole-asset music-vocals analysis fell back to chunked mode: ${normalized}` : null;
}

const RECOGNIZED_SONG_STATUS_PRIORITY = Object.freeze(new Map([
  ['recognized', 4],
  ['possible', 3],
  ['multiple_possible', 2],
  ['unknown', 1],
  ['none_present', 0]
]));

function getRecognizedSongStatusPriority(recognizedSong) {
  const status = compactString(recognizedSong?.status).toLowerCase();
  return RECOGNIZED_SONG_STATUS_PRIORITY.get(status) ?? -1;
}

function getRecognizedSongConfidenceScore(recognizedSong) {
  const topLevelConfidence = Number(recognizedSong?.confidence);
  if (Number.isFinite(topLevelConfidence)) {
    return topLevelConfidence;
  }

  const candidateConfidences = Array.isArray(recognizedSong?.candidates)
    ? recognizedSong.candidates
        .map((candidate) => Number(candidate?.confidence))
        .filter((value) => Number.isFinite(value))
    : [];

  if (candidateConfidences.length > 0) {
    return Math.max(...candidateConfidences);
  }

  return 0;
}

function getRecognizedSongMatchedLyricCount(recognizedSong) {
  return Array.isArray(recognizedSong?.candidates)
    ? recognizedSong.candidates.reduce((count, candidate) => {
        const matchedLyrics = Array.isArray(candidate?.matchedLyrics) ? candidate.matchedLyrics : [];
        return count + matchedLyrics.filter((value) => compactString(value)).length;
      }, 0)
    : 0;
}

function choosePreferredRecognizedSong(currentRecognizedSong, nextRecognizedSong) {
  if (!nextRecognizedSong || typeof nextRecognizedSong !== 'object' || Array.isArray(nextRecognizedSong)) {
    return currentRecognizedSong || null;
  }

  if (!currentRecognizedSong || typeof currentRecognizedSong !== 'object' || Array.isArray(currentRecognizedSong)) {
    return nextRecognizedSong;
  }

  const currentStatusPriority = getRecognizedSongStatusPriority(currentRecognizedSong);
  const nextStatusPriority = getRecognizedSongStatusPriority(nextRecognizedSong);
  if (nextStatusPriority !== currentStatusPriority) {
    return nextStatusPriority > currentStatusPriority ? nextRecognizedSong : currentRecognizedSong;
  }

  const currentConfidence = getRecognizedSongConfidenceScore(currentRecognizedSong);
  const nextConfidence = getRecognizedSongConfidenceScore(nextRecognizedSong);
  if (nextConfidence !== currentConfidence) {
    return nextConfidence > currentConfidence ? nextRecognizedSong : currentRecognizedSong;
  }

  const currentMatchedLyricCount = getRecognizedSongMatchedLyricCount(currentRecognizedSong);
  const nextMatchedLyricCount = getRecognizedSongMatchedLyricCount(nextRecognizedSong);
  if (nextMatchedLyricCount !== currentMatchedLyricCount) {
    return nextMatchedLyricCount > currentMatchedLyricCount ? nextRecognizedSong : currentRecognizedSong;
  }

  return currentRecognizedSong;
}

function stripMusicVocalSegmentTiming(musicVocalsData) {
  if (!musicVocalsData || typeof musicVocalsData !== 'object' || Array.isArray(musicVocalsData)) {
    return musicVocalsData;
  }

  const vocalSegments = Array.isArray(musicVocalsData.vocal_segments)
    ? musicVocalsData.vocal_segments.map((segment) => {
        if (!segment || typeof segment !== 'object' || Array.isArray(segment)) return segment;
        const { start, end, ...rest } = segment;
        return rest;
      })
    : [];

  return {
    ...musicVocalsData,
    vocal_segments: vocalSegments
  };
}

function buildMusicAnalysisChunkPlan(preflight, config = {}) {
  const transportChunks = Array.isArray(preflight?.chunkPlan) ? preflight.chunkPlan : [];
  if (transportChunks.length === 0) {
    return [];
  }

  const maxWindowSeconds = resolveMusicAnalysisWindowSeconds(config);
  const analysisChunks = [];
  let nextIndex = 0;

  for (const transportChunk of transportChunks) {
    const transportDuration = Math.max(0, (transportChunk?.endTime ?? 0) - (transportChunk?.startTime ?? 0));
    const effectiveWindowSeconds = Math.min(maxWindowSeconds, transportDuration || maxWindowSeconds);

    const localPlan = planTimeChunks({
      durationSeconds: transportDuration,
      chunkDurationSeconds: effectiveWindowSeconds
    });

    for (const localChunk of localPlan) {
      analysisChunks.push({
        index: nextIndex,
        startTime: (transportChunk.startTime || 0) + localChunk.startTime,
        endTime: (transportChunk.startTime || 0) + localChunk.endTime,
        duration: localChunk.duration,
        transportChunkIndex: transportChunk.index
      });
      nextIndex += 1;
    }
  }

  return analysisChunks;
}

function ensurePhaseErrorArtifacts({ captureRaw, rawMetaDir, events, phaseOutcome, fatalPhaseError, phaseErrors }) {
  if (!captureRaw) return;

  fs.mkdirSync(rawMetaDir, { recursive: true });
  const errorsPath = path.join(rawMetaDir, 'errors.jsonl');

  const lines = phaseErrors.length > 0
    ? phaseErrors.map((e) => JSON.stringify(e)).join('\n') + '\n'
    : '';
  fs.writeFileSync(errorsPath, lines, 'utf8');

  if (events) {
    events.artifactWrite({ absolutePath: errorsPath, role: 'raw.meta', phase: PHASE_KEY, script: SCRIPT_ID });
  }

  const totalErrors = fs.existsSync(errorsPath)
    ? fs.readFileSync(errorsPath, 'utf8').split('\n').filter(Boolean).length
    : 0;

  const summary = {
    schemaVersion: 1,
    phase: PHASE_KEY,
    outcome: phaseOutcome,
    generatedAt: new Date().toISOString(),
    totalErrors,
    fatalError: fatalPhaseError
      ? {
          name: fatalPhaseError?.name || null,
          message: fatalPhaseError?.message || String(fatalPhaseError),
          stack: typeof fatalPhaseError?.stack === 'string' ? fatalPhaseError.stack : null
        }
      : null
  };

  const summaryPath = writeRawJson(rawMetaDir, 'errors.summary.json', summary);
  if (events) {
    events.artifactWrite({ absolutePath: summaryPath, role: 'raw.meta', phase: PHASE_KEY, script: SCRIPT_ID });
  }
}

/**
 * Script Input Contract
 * @typedef {Object} GetMusicInput
 * @property {string} assetPath - Path to video/audio file
 * @property {string} outputDir - Output directory
 * @property {Object} [config] - Pipeline config
 */

/**
 * Script Output Contract
 * @typedef {Object} GetMusicOutput
 * @property {Object} artifacts - Script artifacts
 * @property {Object} artifacts.musicData - Music analysis results
 * @property {Array} artifacts.musicData.segments - Music segments
 * @property {string} artifacts.musicData.summary - Brief summary
 * @property {boolean} artifacts.musicData.hasMusic - True if music detected
 */

/**
 * Main entry point
 * 
 * @async
 * @function run
 * @param {GetMusicInput} input - Script input
 * @returns {Promise<GetMusicOutput>} - Script output
 */
async function run(input) {
  const { assetPath, outputDir, config } = input;
  const preserveSegmentTiming = input?.preserveSegmentTiming === true;
  const recoveryRuntime = getRecoveryRuntime(input);

  console.log('   🎤 Extracting and analyzing music-led vocals from:', assetPath);

  // Create phase-aware output directory
  const phaseDir = outputManager.createPhaseDirectory(outputDir, PHASE_KEY);

  // Create assets directory for processed files (canonical run-level assets)
  const assetsDirs = outputManager.createAssetsDirectory(outputDir);

  // Create temp directory for audio extraction in assets/processed/music/
  const tempDir = path.join(assetsDirs.processedDir, 'music');
  fs.mkdirSync(tempDir, { recursive: true });

  // Default to keeping processed/intermediate files unless explicitly disabled
  const keepProcessedIntermediates = shouldKeepProcessedIntermediates(config);
  const captureRaw = shouldCaptureRaw(config);

  const events = getEventsLogger({ outputDir, config });
  events.emit({ kind: 'script.start', phase: PHASE_KEY, script: SCRIPT_ID });

  const rawDir = getRawPhaseDir(outputDir, PHASE_KEY);
  const rawMetaDir = path.join(rawDir, '_meta');
  const ffmpegRawDir = path.join(rawDir, 'ffmpeg', 'music');
  const aiRawDir = path.join(rawDir, 'ai');
  const toolVersionsDir = path.join(rawDir, 'tools', '_versions');

  await ensureToolVersionsCaptured({
    captureRaw,
    toolVersionsDir,
    tools: [
      { name: 'ffmpeg', path: ffmpegPath },
      { name: 'ffprobe', path: ffprobePath }
    ]
  });

  const phaseErrors = [];
  let phaseOutcome = 'success';
  let fatalPhaseError = null;

  const recordPhaseError = (entry) => {
    phaseErrors.push({
      ts: new Date().toISOString(),
      phase: PHASE_KEY,
      script: SCRIPT_ID,
      ...entry
    });

    events.error({
      message: entry?.message || null,
      phase: PHASE_KEY,
      script: SCRIPT_ID,
      where: entry?.kind || entry?.level || null,
      extra: {
        kind: entry?.kind || null,
        level: entry?.level || null,
        errorName: entry?.errorName || null,
        errorCode: entry?.errorCode || null,
        errorStatus: entry?.errorStatus || null,
        errorRequestId: entry?.errorRequestId || null,
        errorClassification: entry?.errorClassification || null,
      }
    });
  };

  const writeMusicVocalsSegmentRaw = (segmentIndex, attempt, payload) => {
    if (!captureRaw) return;

    const legacyFileName = `music-vocals-segment-${segmentIndex}.json`;

    const attemptRelDir = path.join(`music-vocals-segment-${pad(segmentIndex, 4)}`, `attempt-${pad(attempt, 2)}`);
    const attemptRelPath = path.join(attemptRelDir, 'capture.json');

    const capturePath = writeRawJson(aiRawDir, attemptRelPath, payload);
    events.artifactWrite({ absolutePath: capturePath, role: 'raw.ai.attempt', phase: PHASE_KEY, script: SCRIPT_ID });

    const pointerPath = writeRawJson(aiRawDir, legacyFileName, {
      schemaVersion: 2,
      kind: 'pointer',
      updatedAt: new Date().toISOString(),
      segmentIndex,
      latestAttempt: attempt,
      target: {
        dir: attemptRelDir,
        file: attemptRelPath
      }
    });
    events.artifactWrite({ absolutePath: pointerPath, role: 'raw.ai.pointer', phase: PHASE_KEY, script: SCRIPT_ID });
  };

  const writeWholeAssetMusicVocalsRaw = (attempt, payload) => {
    if (!captureRaw) return;

    const legacyFileName = 'music-vocals-whole-asset.json';
    const attemptRelDir = path.join('music-vocals-whole-asset', `attempt-${pad(attempt, 2)}`);
    const attemptRelPath = path.join(attemptRelDir, 'capture.json');

    const capturePath = writeRawJson(aiRawDir, attemptRelPath, payload);
    events.artifactWrite({ absolutePath: capturePath, role: 'raw.ai.attempt', phase: PHASE_KEY, script: SCRIPT_ID });

    const pointerPath = writeRawJson(aiRawDir, legacyFileName, {
      schemaVersion: 2,
      kind: 'pointer',
      updatedAt: new Date().toISOString(),
      latestAttempt: attempt,
      target: {
        dir: attemptRelDir,
        file: attemptRelPath
      }
    });
    events.artifactWrite({ absolutePath: pointerPath, role: 'raw.ai.pointer', phase: PHASE_KEY, script: SCRIPT_ID });
  };

  try {
    // Extract audio from video (if needed)
    const audioPath = await extractAudio(assetPath, tempDir, {
      captureRaw,
      ffmpegRawDir,
      logName: 'extract-audio.json',
      config
    });

    const preflight = preflightAudio({
      audioPath,
      config,
      rawCapture: {
        captureRaw,
        rawLogger: (payload) => writeRawJson(ffmpegRawDir, 'ffprobe-audio-duration.json', payload)
      }
    });

    events.emit({
      kind: 'audio.preflight',
      phase: PHASE_KEY,
      script: SCRIPT_ID,
      domain: 'music_vocals',
      trace: preflight.trace
    });

    const analysisChunkPlan = buildMusicAnalysisChunkPlan(preflight, config);

    if (captureRaw) {
      const analysisWindowSeconds = resolveMusicAnalysisWindowSeconds(config);
      const planPath = writeRawJson(ffmpegRawDir, 'chunk-plan.json', {
        schemaVersion: 2,
        kind: 'audio.chunk.plan',
        domain: 'music_vocals',
        createdAt: new Date().toISOString(),
        transportTrace: preflight.trace,
        analysisPolicy: {
          kind: 'fixed-window-within-transport-budget',
          maxWindowSeconds: analysisWindowSeconds
        },
        transportChunks: preflight.chunkPlan,
        chunks: analysisChunkPlan,
        analysisTrace: {
          chunks: analysisChunkPlan.length,
          maxWindowSeconds: analysisWindowSeconds
        }
      });
      events.artifactWrite({ absolutePath: planPath, role: 'raw.ffmpeg.plan', phase: PHASE_KEY, script: SCRIPT_ID });
    }

    const duration = preflight.durationSeconds;
    const strategy = resolveMusicAnalysisStrategy(preflight, config, input?.artifacts?.musicData || null);

    console.log(`   📊 Audio duration: ${duration.toFixed(1)}s (${analysisChunkPlan.length} analysis chunk(s) from ${preflight.chunkPlan.length} transport chunk(s))`);
    console.log(`   🎼 Music-vocals analysis mode: requested=${strategy.requestedMode}, selected=${strategy.actualMode}`);

    const segments = [];
    let hasMusic = false;
    const collectedVocalSegments = [];
    const collectedQualityNotes = [];
    let rollingVocalSummary = '';
    let finalAnalysisMode = strategy.actualMode;
    let wholeAssetAnalysis = null;
    let fallbackApplied = false;
    let fallbackReason = null;
    const qualityNotes = [];

    // config.ai.music.targets[*].adapter.model is required (validated by config-loader)

    ensureRuntimeAuthForDomain({
      config,
      domain: 'music_vocals',
      replayMode: false,
      prefix: 'GetMusic'
    });

    const retryConfig = getRetryConfig(config, 'music_vocals');
    const toolLoopConfig = getToolLoopConfig(config, 'music_vocals');
    console.log(`   🔁 Music-vocals retry config: attempts=${retryConfig.maxAttempts}, backoffMs=${retryConfig.backoffMs}`);

    const chunksDir = captureRaw
      ? path.join(ffmpegRawDir, 'chunks')
      : path.join(tempDir, 'chunks');
    fs.mkdirSync(chunksDir, { recursive: true });

    let rollingSummary = '';
    let bestChunkRecognizedSong = null;
    const collectedRecognitionNotes = [];

    if (strategy.actualMode === 'whole_asset' || strategy.actualMode === 'hybrid') {
      if (!strategy.wholeAssetEligible) {
        fallbackReason = strategy.wholeAssetUnavailableReason || 'Whole-asset music analysis was not eligible for this asset.';
        if (!strategy.fallbackToChunked) {
          throw new Error(fallbackReason);
        }

        fallbackApplied = true;
        finalAnalysisMode = 'chunked';
        const fallbackNote = buildFallbackNote(fallbackReason);
        if (fallbackNote) qualityNotes.push(fallbackNote);
      } else {
        const wholeAssetAudioBase64 = fs.readFileSync(audioPath).toString('base64');
        const wholeAssetPrompt = buildWholeAssetMusicVocalsPrompt(duration, recoveryRuntime, {
          intent: strategy.actualMode === 'hybrid' ? 'hybrid' : 'whole_asset'
        });
        const wholeAssetPromptRef = captureRaw
          ? storePromptPayload({ outputDir, payload: wholeAssetPrompt })
          : null;

        if (wholeAssetPromptRef?.absolutePath) {
          events.artifactWrite({ absolutePath: wholeAssetPromptRef.absolutePath, role: 'raw.prompt', phase: PHASE_KEY, script: SCRIPT_ID });
        }

        try {
          const wholeAssetResult = await executeWholeAssetMusicVocalsAnalysis({
            config,
            retryConfig,
            audioBase64: wholeAssetAudioBase64,
            audioMimeType: getAudioMimeType(config),
            durationSeconds: duration,
            recoveryRuntime,
            events,
            captureRaw,
            writeWholeAssetMusicVocalsRaw,
            promptRef: wholeAssetPromptRef,
            intent: strategy.actualMode === 'hybrid' ? 'hybrid' : 'whole_asset',
            musicContext: input?.artifacts?.musicData || null
          });

          wholeAssetAnalysis = wholeAssetResult.parsed;

          if (strategy.actualMode === 'whole_asset') {
            qualityNotes.push('Whole-asset music analysis preserved cross-asset continuity without chunk seams.');
          } else {
            qualityNotes.push('Whole-asset music analysis supplied global arc context before chunk-level timing refinement.');
          }
        } catch (error) {
          if (!strategy.fallbackToChunked) {
            throw error;
          }

          fallbackApplied = true;
          fallbackReason = error?.message || 'Whole-asset music analysis failed.';
          finalAnalysisMode = 'chunked';
          const fallbackNote = buildFallbackNote(fallbackReason);
          if (fallbackNote) qualityNotes.push(fallbackNote);
        }
      }
    }

    // Analyze each chunk sequentially (rolling-summary carry)
    if (finalAnalysisMode !== 'whole_asset') for (const chunk of analysisChunkPlan) {
      const chunkIndex = chunk.index;
      const startTime = chunk.startTime;
      const endTime = chunk.endTime;

      console.log(`   Analyzing chunk ${chunkIndex + 1}/${analysisChunkPlan.length} (${startTime.toFixed(1)}s - ${endTime.toFixed(1)}s)...`);

      const extraction = await extractAudioChunk(
        audioPath,
        startTime,
        endTime,
        chunksDir,
        chunkIndex,
        {
          config,
          rawLogger: captureRaw
            ? (payload) => writeRawJson(ffmpegRawDir, `extract-chunk-${chunkIndex}.json`, payload)
            : null
        }
      );

      if (!extraction.success) {
        const extractionError = new Error(`Failed to extract audio chunk ${chunkIndex}: ${extraction.error}`);
        applyFailureMetadata(extractionError, extraction.failure, {
          diagnostics: {
            ...(extraction.failure?.diagnostics || {}),
            chunkIndex,
            startTime,
            endTime
          }
        });
        throw extractionError;
      }

      if (captureRaw) {
        events.artifactWrite({ absolutePath: extraction.chunkPath, role: 'raw.ffmpeg.chunk', phase: PHASE_KEY, script: SCRIPT_ID });
      }

      const audioBase64 = fs.readFileSync(extraction.chunkPath).toString('base64');

      const prompt = buildRollingVocalsAnalysisPrompt(startTime, endTime, rollingSummary, recoveryRuntime, wholeAssetAnalysis, input?.artifacts?.musicData || null);
      const promptRef = captureRaw
        ? storePromptPayload({ outputDir, payload: prompt })
        : null;

      if (promptRef?.absolutePath) {
        events.artifactWrite({ absolutePath: promptRef.absolutePath, role: 'raw.prompt', phase: PHASE_KEY, script: SCRIPT_ID });
      }

      const attemptStartMs = new Map();

      try {
        const { result: segmentResult } = await executeWithTargets({
          config,
          domain: 'music_vocals',
          retry: retryConfig,
          operation: async (ctx) => {
            const adapter = ctx?.target?.adapter;
            const attemptKey = String(ctx?.attempt || '');

            if (attemptKey && !attemptStartMs.has(attemptKey)) {
              attemptStartMs.set(attemptKey, Date.now());
              events.emit({
                kind: 'attempt.start',
                phase: PHASE_KEY,
                script: SCRIPT_ID,
                domain: 'music_vocals',
                segmentIndex: chunkIndex,
                attempt: ctx.attempt,
                attemptInTarget: ctx.attemptInTarget,
                targetIndex: ctx.targetIndex,
                targetCount: ctx.targetCount,
                adapter: adapter || null,
              });
            }

            const provider = getProviderForTarget({
              configForTarget: ctx.configForTarget,
              target: ctx.target
            });
            const runtimeConfig = resolveProviderRuntimeConfigForTarget({
              configForTarget: ctx.configForTarget,
              target: ctx.target
            });

            const providerCallStart = Date.now();
            events.emit({
              kind: 'provider.call.start',
              phase: PHASE_KEY,
              script: SCRIPT_ID,
              domain: 'music_vocals',
              segmentIndex: chunkIndex,
              attempt: ctx.attempt,
              attemptInTarget: ctx.attemptInTarget,
              targetIndex: ctx.targetIndex,
              targetCount: ctx.targetCount,
              provider: adapter?.name || null,
              model: adapter?.model || null,
            });

            try {
              const toolLoopResult = await executeMusicVocalsAnalysisToolLoop({
                provider,
                adapter,
                basePrompt: prompt,
                toolLoopConfig,
                promptRef,
                events,
                ctx,
                runtimeConfig,
                audioBase64,
                audioMimeType: getAudioMimeType(config)
              });

              events.emit({
                kind: 'provider.call.end',
                phase: PHASE_KEY,
                script: SCRIPT_ID,
                domain: 'music_vocals',
                segmentIndex: chunkIndex,
                attempt: ctx.attempt,
                attemptInTarget: ctx.attemptInTarget,
                targetIndex: ctx.targetIndex,
                ok: true,
                durationMs: Date.now() - providerCallStart,
                provider: adapter?.name || null,
                model: adapter?.model || null,
              });

              const parsed = {
                rollingSummary: toolLoopResult.parsed.rollingSummary,
                vocalSummary: toolLoopResult.parsed.vocalSummary,
                vocal_segments: normalizeMusicVocalSegments(toolLoopResult.parsed.vocal_segments, { maxDuration: duration }),
                recognizedSong: toolLoopResult.parsed.recognizedSong || null,
                recognitionNotes: Array.isArray(toolLoopResult.parsed.recognitionNotes) ? toolLoopResult.parsed.recognitionNotes : [],
                qualityNotes: Array.isArray(toolLoopResult.parsed.qualityNotes) ? toolLoopResult.parsed.qualityNotes : []
              };
              return { completion: toolLoopResult.completion, parsed, toolLoop: toolLoopResult.toolLoop };
            } catch (error) {
              events.emit({
                kind: 'provider.call.end',
                phase: PHASE_KEY,
                script: SCRIPT_ID,
                domain: 'music_vocals',
                segmentIndex: chunkIndex,
                attempt: ctx.attempt,
                attemptInTarget: ctx.attemptInTarget,
                targetIndex: ctx.targetIndex,
                ok: false,
                durationMs: Date.now() - providerCallStart,
                provider: adapter?.name || null,
                model: adapter?.model || null,
                error: error?.message || String(error),
              });
              throw error;
            }
          },
          onAttempt: ({
            ok,
            attempt,
            attemptInTarget,
            target,
            targetIndex,
            targetCount,
            failover,
            result,
            error
          }) => {
            const attemptKey = String(attempt || '');
            const startedAt = attemptKey && attemptStartMs.has(attemptKey) ? attemptStartMs.get(attemptKey) : null;

            const persistedError = ok ? null : getPersistedErrorInfo(error);

            events.emit({
              kind: 'attempt.end',
              phase: PHASE_KEY,
              script: SCRIPT_ID,
              domain: 'music_vocals',
              segmentIndex: chunkIndex,
              attempt,
              attemptInTarget,
              targetIndex,
              targetCount,
              ok,
              durationMs: startedAt ? (Date.now() - startedAt) : null,
              provider: target?.adapter?.name || null,
              model: target?.adapter?.model || null,
              error: ok ? null : (error?.message || String(error)),
              errorStatus: persistedError?.status || null,
              errorRequestId: persistedError?.requestId || null,
              errorClassification: persistedError?.classification || null,
            });

            if (!captureRaw) return;

            const adapter = target?.adapter || null;

            writeMusicVocalsSegmentRaw(chunkIndex, attempt, {
              segmentIndex: chunkIndex,
              startTime,
              endTime,
              rollingSummaryIn: rollingSummary || null,
              attempt,
              attemptInTarget,
              targetIndex,
              targetCount,
              adapter,
              failover: failover || null,
              promptRef: promptRef ? { sha256: promptRef.sha256, file: promptRef.file } : null,
              rawResponse: ok ? sanitizeRawCaptureValue(result?.completion) : null,
              parsed: ok ? result?.parsed : null,
              toolLoop: ok ? sanitizeRawCaptureValue(result?.toolLoop) : (sanitizeRawCaptureValue(error?.debug?.toolLoop) || null),
              error: ok ? null : (error?.message || String(error)),
              errorName: ok ? null : (error?.name || null),
              errorCode: ok ? null : (error?.code || null),
              errorStatus: ok ? null : (persistedError?.status || null),
              errorRequestId: ok ? null : (persistedError?.requestId || null),
              errorClassification: ok ? null : (persistedError?.classification || null),
              errorStack: ok ? null : (typeof error?.stack === 'string' ? error.stack : null),
              errorDebug: ok ? null : (sanitizeRawCaptureValue(error?.debug) || null),
              errorResponse: ok ? null : (sanitizeRawCaptureValue(persistedError?.response) || null),
              provider: adapter?.name || null,
              model: adapter?.model || null,
              requestMeta: {
                adapter,
                provider: adapter?.name || null,
                model: adapter?.model || null,
                segmentIndex: chunkIndex,
                attempt,
                attemptInTarget,
                targetIndex,
                targetCount
              }
            });
          }
        });

        const parsed = segmentResult.parsed;

        rollingSummary = typeof parsed.rollingSummary === 'string' && parsed.rollingSummary.trim().length > 0
          ? parsed.rollingSummary.trim()
          : rollingSummary;
        if (Array.isArray(parsed.vocal_segments) && parsed.vocal_segments.length > 0) {
          collectedVocalSegments.push(...parsed.vocal_segments);
        }
        rollingVocalSummary = typeof parsed.vocalSummary === 'string' && parsed.vocalSummary.trim().length > 0
          ? parsed.vocalSummary.trim()
          : rollingVocalSummary;
        if (parsed.recognizedSong) {
          bestChunkRecognizedSong = choosePreferredRecognizedSong(bestChunkRecognizedSong, parsed.recognizedSong);
        }
        if (Array.isArray(parsed.recognitionNotes) && parsed.recognitionNotes.length > 0) {
          collectedRecognitionNotes.push(...parsed.recognitionNotes);
        }
        if (Array.isArray(parsed.qualityNotes) && parsed.qualityNotes.length > 0) {
          collectedQualityNotes.push(...parsed.qualityNotes);
        }
      } catch (error) {
        phaseOutcome = 'failed';
        fatalPhaseError = error;

        const persistedError = getPersistedErrorInfo(error);

        recordPhaseError({
          level: 'error',
          kind: 'fatal',
          message: error?.message || String(error),
          errorName: error?.name || null,
          errorCode: error?.code || null,
          errorStatus: persistedError.status,
          errorRequestId: persistedError.requestId,
          errorClassification: persistedError.classification,
          segmentIndex: chunkIndex,
          startTime,
          endTime
        });

        throw error;
      }
    }

    const timingMode = finalAnalysisMode === 'chunked' ? 'chunk_local' : 'full_timeline';
    const usedChunking = finalAnalysisMode !== 'whole_asset';
    const finalQualityNotes = Array.from(new Set([
      ...qualityNotes,
      ...collectedQualityNotes,
      ...(Array.isArray(wholeAssetAnalysis?.qualityNotes) ? wholeAssetAnalysis.qualityNotes : [])
    ].filter((value) => compactString(value))));
    const finalRecognizedSong = normalizeRecognizedSong(
      wholeAssetAnalysis?.recognizedSong || bestChunkRecognizedSong,
      { maxDuration: duration }
    );
    const finalRecognitionNotes = normalizeRecognitionNotes([
      ...collectedRecognitionNotes,
      ...(Array.isArray(wholeAssetAnalysis?.recognitionNotes) ? wholeAssetAnalysis.recognitionNotes : [])
    ]);
    const sharedProvenance = {
      requestedMode: strategy.requestedMode,
      transportMode: 'inline',
      usedChunking,
      chunkCount: usedChunking ? analysisChunkPlan.length : 0,
      analysisWindowSeconds: usedChunking ? resolveMusicAnalysisWindowSeconds(config) : null,
      fallbackApplied,
      fallbackReason: fallbackReason || null,
      wholeAssetAttempted: strategy.actualMode === 'whole_asset' || strategy.actualMode === 'hybrid',
      wholeAssetSucceeded: !!wholeAssetAnalysis,
      preflightReason: preflight?.trace?.reason || null,
      estimatedBase64Bytes: Number(preflight?.estimatedBase64Bytes) || null,
      base64BudgetBytes: Number(preflight?.budgetBytes) || null,
      musicContextAvailable: !!input?.artifacts?.musicData,
      autoSelectedHybridForLyricCueCoverage: strategy.requestedMode === 'auto' && strategy.actualMode === 'hybrid' && strategy.preferHybrid === true
    };

    // Write intermediate artifacts to phase directory
    const musicVocalsData = buildMusicVocalsData({
      vocalSegments: finalAnalysisMode === 'whole_asset'
        ? normalizeMusicVocalSegments(wholeAssetAnalysis?.vocal_segments, { maxDuration: duration })
        : normalizeMusicVocalSegments(collectedVocalSegments, { maxDuration: duration }),
      summary: finalAnalysisMode === 'whole_asset'
        ? wholeAssetAnalysis?.vocalSummary
        : (rollingVocalSummary || wholeAssetAnalysis?.vocalSummary),
      duration,
      analysisMode: finalAnalysisMode,
      timingMode,
      sourceStrategy: 'base64',
      provenance: sharedProvenance,
      qualityNotes: finalQualityNotes,
      recognizedSong: finalRecognizedSong,
      recognitionNotes: finalRecognitionNotes
    });

    const finalMusicVocalsData = preserveSegmentTiming
      ? musicVocalsData
      : stripMusicVocalSegmentTiming(musicVocalsData);

    const artifactPath = path.join(phaseDir, 'music-vocals-data.json');
    fs.writeFileSync(artifactPath, JSON.stringify(finalMusicVocalsData, null, 2));
    events.artifactWrite({ absolutePath: artifactPath, role: 'artifact', phase: PHASE_KEY, script: SCRIPT_ID });

    console.log('   ✅ Music-vocals analysis complete');
    console.log(`      Output: ${artifactPath}`);
    console.log(`      Vocals detected: ${finalMusicVocalsData.hasVocals ? 'Yes' : 'No'}`);
    console.log(`      Found ${finalMusicVocalsData.vocal_segments.length} vocal segment(s)`);

    return {
      primaryArtifactKey: 'musicVocalsData',
      artifacts: {
        musicVocalsData: finalMusicVocalsData
      }
    };
  } catch (error) {
    console.error('   ❌ Error analyzing music vocals:', error.message);
    throw error;
  } finally {
    ensurePhaseErrorArtifacts({
      captureRaw,
      rawMetaDir,
      events,
      phaseOutcome,
      fatalPhaseError,
      phaseErrors
    });

    events.emit({ kind: 'script.end', phase: PHASE_KEY, script: SCRIPT_ID, outcome: phaseOutcome });

    // Handle temp file cleanup based on config
    if (keepProcessedIntermediates) {
      console.log(`   💾 Keeping music temp files in ${tempDir}`);
    } else {
      // Clean up temp files
      try {
        if (fs.existsSync(tempDir)) {
          fs.rmSync(tempDir, { recursive: true, force: true });
        }
      } catch (e) {
        console.warn('   ⚠️  Warning: Failed to cleanup music temp files:', e.message);
      }
    }
  }
}

/**
 * Extract audio from video using ffmpeg
 * 
 * @async
 * @function extractAudio
 * @param {string} videoPath - Path to video file
 * @param {string} outputDir - Output directory for audio file
 * @returns {Promise<string>} - Path to extracted audio file
 */
async function extractAudio(videoPath, outputDir, rawCapture = {}) {
  const ffmpegAudioConfig = getRequiredAudioConfig(rawCapture.config);
  const audioPath = path.join(outputDir, `audio.${getAudioOutputExtension(ffmpegAudioConfig)}`);

  // Check if input is already audio
  const ext = path.extname(videoPath).toLowerCase();
  const isAudio = ['.mp3', '.wav', '.ogg', '.m4a', '.flac'].includes(ext);

  if (isAudio) {
    // Copy audio file directly
    fs.copyFileSync(videoPath, audioPath);
    if (rawCapture.captureRaw) {
      writeRawJson(rawCapture.ffmpegRawDir, rawCapture.logName || 'extract-audio.json', {
        tool: 'copy',
        command: 'fs.copyFileSync',
        input: videoPath,
        output: audioPath,
        status: 'success'
      });
    }
    return audioPath;
  }

  const args = buildAudioExtractArgs({
    inputPath: videoPath,
    outputPath: audioPath,
    ffmpegAudioConfig,
    disableVideo: true
  });
  const command = formatCommand(ffmpegPath, args);

  try {
    const { stdout, stderr } = await runCommand(ffmpegPath, args);
    if (rawCapture.captureRaw) {
      writeRawJson(rawCapture.ffmpegRawDir, rawCapture.logName || 'extract-audio.json', {
        tool: 'ffmpeg',
        command,
        args,
        stdout,
        stderr,
        status: 'success'
      });
    }
    return audioPath;
  } catch (error) {
    if (rawCapture.captureRaw) {
      writeRawJson(rawCapture.ffmpegRawDir, rawCapture.logName || 'extract-audio.json', {
        tool: 'ffmpeg',
        command,
        args,
        stdout: error.stdout || '',
        stderr: error.stderr || '',
        status: 'failed',
        error: error.message
      });
    }
    throw new Error(`Failed to extract audio: ${error.message}`);
  }
}

/**
 * Extract audio segment using ffmpeg
 * 
 * @async
 * @function extractAudioSegment
 * @param {string} audioPath - Path to audio file
 * @param {number} startTime - Start time in seconds
 * @param {number} duration - Duration in seconds
 * @param {string} outputPath - Output path for segment
 * @returns {Promise<void>}
 */
async function extractAudioSegment(audioPath, startTime, duration, outputPath, rawCapture = {}) {
  const ffmpegAudioConfig = getRequiredAudioConfig(rawCapture.config);
  const args = buildAudioExtractArgs({
    inputPath: audioPath,
    outputPath,
    ffmpegAudioConfig,
    startTime,
    durationSeconds: duration
  });
  const command = formatCommand(ffmpegPath, args);

  try {
    const { stdout, stderr } = await runCommand(ffmpegPath, args);
    if (rawCapture.captureRaw) {
      writeRawJson(rawCapture.ffmpegRawDir, rawCapture.logName || 'extract-segment.json', {
        tool: 'ffmpeg',
        command,
        args,
        stdout,
        stderr,
        status: 'success'
      });
    }
  } catch (error) {
    if (rawCapture.captureRaw) {
      writeRawJson(rawCapture.ffmpegRawDir, rawCapture.logName || 'extract-segment.json', {
        tool: 'ffmpeg',
        command,
        args,
        stdout: error.stdout || '',
        stderr: error.stderr || '',
        status: 'failed',
        error: error.message
      });
    }
    throw new Error(`Failed to extract audio segment: ${error.message}`);
  }
}

/**
 * Get audio duration using ffprobe
 * 
 * @function getAudioDuration
 * @param {string} audioPath - Path to audio file
 * @returns {number} - Duration in seconds
 */
function getAudioDuration(audioPath, rawCapture = {}) {
  const command = `"${ffprobePath}" -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${audioPath}"`;
  try {
    const stdout = execSync(command, { encoding: 'utf8' });
    const stdoutText = typeof stdout === 'string' ? stdout : stdout.toString();
    if (rawCapture.captureRaw) {
      writeRawJson(rawCapture.ffmpegRawDir, rawCapture.logName || 'ffprobe-audio-duration.json', {
        tool: 'ffprobe',
        command,
        stdout: stdoutText,
        status: 'success'
      });
    }
    return parseFloat(stdoutText.trim()) || 0;
  } catch (e) {
    if (rawCapture.captureRaw) {
      writeRawJson(rawCapture.ffmpegRawDir, rawCapture.logName || 'ffprobe-audio-duration.json', {
        tool: 'ffprobe',
        command,
        stdout: e.stdout ? e.stdout.toString() : '',
        stderr: e.stderr ? e.stderr.toString() : '',
        status: 'failed',
        error: e.message
      });
    }
    return 0;
  }
}

/**
 * Build analysis prompt for AI
 * 
 * @function buildAnalysisPrompt
 * @param {number} startTime - Segment start time
 * @param {number} endTime - Segment end time
 * @returns {string} - Analysis prompt
 */
function buildAnalysisPrompt(startTime, endTime, recoveryRuntime = null) {
  const prompt = `Analyze the audio in this segment (${startTime.toFixed(1)}s to ${endTime.toFixed(1)}s).

Identify:
1. Type of audio: music, speech, silence, ambient noise, sound effects
2. If music: describe the mood (upbeat, calm, tense, sad, energetic, etc.)
3. Intensity level from 1-10
4. Brief description

Respond with a JSON object in the following format:

\`\`\`json
{
  "type": "music",
  "description": "Brief description of the audio",
  "mood": "energetic",
  "intensity": 5
}
\`\`\`

Allowed values for type: music | speech | silence | ambient | sfx.
Allowed values for mood: upbeat | calm | tense | sad | energetic | neutral.

IMPORTANT:
- Return JSON only. No markdown, no explanation.
- Be specific about the mood and characteristics.
- If it's speech, set type to "speech" and mood to "neutral".`;

  return `${prompt}${buildRecoveryPromptAddendum(recoveryRuntime)}`;
}

function parseJsonResponse(responseContent) {
  const parsed = parseAndValidateJsonObject(responseContent, (value) => ({
    ok: true,
    value,
    errors: [],
    summary: null,
    meta: { stage: 'validation' }
  }));

  return parsed.ok ? parsed.value : null;
}

function validateWholeAssetMusicAnalysisObject(input, durationSeconds = 0) {
  const errors = [];
  const maxDuration = Number.isFinite(durationSeconds) && durationSeconds >= 0 ? durationSeconds : Number.POSITIVE_INFINITY;

  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return {
      ok: false,
      value: null,
      errors: [{ path: '$', code: 'invalid_type', message: 'Whole-asset music output must be a JSON object.' }],
      summary: 'Whole-asset music output must be a JSON object. Return corrected JSON only.',
      meta: { stage: 'validation' }
    };
  }

  const summary = compactString(input.summary);
  if (!summary) {
    errors.push({ path: '$.summary', code: 'required_string', message: 'summary must be a non-empty string.' });
  }

  const hasMusic = typeof input.hasMusic === 'boolean' ? input.hasMusic : null;
  if (hasMusic === null) {
    errors.push({ path: '$.hasMusic', code: 'required_boolean', message: 'hasMusic must be a boolean.' });
  }

  const segmentsInput = Array.isArray(input.segments) ? input.segments : null;
  if (!segmentsInput) {
    errors.push({ path: '$.segments', code: 'required_array', message: 'segments must be an array.' });
  }

  const normalizedSegments = (segmentsInput || []).map((segment, index) => {
    const itemPath = `$.segments[${index}]`;
    if (!segment || typeof segment !== 'object' || Array.isArray(segment)) {
      errors.push({ path: itemPath, code: 'invalid_type', message: 'Each segment must be an object.' });
      return null;
    }

    const start = Number(segment.start);
    const end = Number(segment.end);
    const type = compactString(segment.type);
    const description = compactString(segment.description);
    const mood = segment.mood === undefined || segment.mood === null ? null : compactString(segment.mood);
    const intensity = Number(segment.intensity);

    if (!Number.isFinite(start) || start < 0 || start > maxDuration) {
      errors.push({ path: `${itemPath}.start`, code: 'invalid_number', message: 'segment start must be a finite number within the asset timeline.' });
    }
    if (!Number.isFinite(end) || end < 0 || end > maxDuration) {
      errors.push({ path: `${itemPath}.end`, code: 'invalid_number', message: 'segment end must be a finite number within the asset timeline.' });
    }
    if (Number.isFinite(start) && Number.isFinite(end) && end <= start) {
      errors.push({ path: itemPath, code: 'invalid_range', message: 'segment end must be greater than start.' });
    }
    if (!type) {
      errors.push({ path: `${itemPath}.type`, code: 'required_string', message: 'segment type must be a non-empty string.' });
    }
    if (!description) {
      errors.push({ path: `${itemPath}.description`, code: 'required_string', message: 'segment description must be a non-empty string.' });
    }
    if (segment.mood !== undefined && segment.mood !== null && !mood) {
      errors.push({ path: `${itemPath}.mood`, code: 'required_string', message: 'segment mood must be a non-empty string when provided.' });
    }
    if (!Number.isFinite(intensity) || intensity < 0 || intensity > 10) {
      errors.push({ path: `${itemPath}.intensity`, code: 'invalid_number', message: 'segment intensity must be a finite number between 0 and 10.' });
    }

    return {
      start,
      end,
      type: type || 'unknown',
      description: description || 'Unknown audio content',
      mood: mood || null,
      intensity: Number.isFinite(intensity) ? intensity : 0
    };
  }).filter(Boolean).sort((left, right) => left.start - right.start);

  if (normalizedSegments.length === 0) {
    errors.push({ path: '$.segments', code: 'required_non_empty_array', message: 'segments must contain at least one timeline segment.' });
  }

  const globalArcInput = input.globalArc;
  let globalArc = null;
  if (globalArcInput !== undefined && globalArcInput !== null) {
    if (!globalArcInput || typeof globalArcInput !== 'object' || Array.isArray(globalArcInput)) {
      errors.push({ path: '$.globalArc', code: 'invalid_type', message: 'globalArc must be an object when provided.' });
    } else {
      const dominantMood = globalArcInput.dominantMood === undefined || globalArcInput.dominantMood === null
        ? null
        : compactString(globalArcInput.dominantMood);
      const energyCurve = globalArcInput.energyCurve === undefined || globalArcInput.energyCurve === null
        ? null
        : compactString(globalArcInput.energyCurve);
      const notableTransitions = Array.isArray(globalArcInput.notableTransitions)
        ? globalArcInput.notableTransitions.map((transition, index) => {
            const itemPath = `$.globalArc.notableTransitions[${index}]`;
            if (!transition || typeof transition !== 'object' || Array.isArray(transition)) {
              errors.push({ path: itemPath, code: 'invalid_type', message: 'Each notable transition must be an object.' });
              return null;
            }

            const start = Number(transition.start);
            const end = Number(transition.end);
            const label = compactString(transition.label);

            if (!Number.isFinite(start) || start < 0 || start > maxDuration) {
              errors.push({ path: `${itemPath}.start`, code: 'invalid_number', message: 'transition start must be within the asset timeline.' });
            }
            if (!Number.isFinite(end) || end < 0 || end > maxDuration) {
              errors.push({ path: `${itemPath}.end`, code: 'invalid_number', message: 'transition end must be within the asset timeline.' });
            }
            if (Number.isFinite(start) && Number.isFinite(end) && end <= start) {
              errors.push({ path: itemPath, code: 'invalid_range', message: 'transition end must be greater than start.' });
            }
            if (!label) {
              errors.push({ path: `${itemPath}.label`, code: 'required_string', message: 'transition label must be a non-empty string.' });
            }

            return {
              start,
              end,
              label: label || 'transition'
            };
          }).filter(Boolean)
        : [];

      if (globalArcInput.notableTransitions !== undefined && !Array.isArray(globalArcInput.notableTransitions)) {
        errors.push({ path: '$.globalArc.notableTransitions', code: 'required_array', message: 'globalArc.notableTransitions must be an array when provided.' });
      }

      globalArc = {
        dominantMood: dominantMood || null,
        energyCurve: energyCurve || null,
        notableTransitions
      };
    }
  }

  const recognizedSong = validateRecognizedSong(input.recognizedSong, errors, '$.recognizedSong', { minTime: 0, maxTime: maxDuration });
  const recognitionNotes = validateOptionalRecognitionNotes(input.recognitionNotes, errors);

  const qualityNotes = Array.isArray(input.qualityNotes)
    ? input.qualityNotes.map((note, index) => {
        const normalized = compactString(note);
        if (!normalized) {
          errors.push({ path: `$.qualityNotes[${index}]`, code: 'required_string', message: 'qualityNotes entries must be non-empty strings.' });
          return null;
        }
        return normalized;
      }).filter(Boolean)
    : [];

  if (input.qualityNotes !== undefined && !Array.isArray(input.qualityNotes)) {
    errors.push({ path: '$.qualityNotes', code: 'required_array', message: 'qualityNotes must be an array when provided.' });
  }

  pushEnglishOnlyError(errors, '$.summary', 'summary', summary);
  if (recognizedSong) {
    pushEnglishOnlyError(errors, '$.recognizedSong.primaryEvidence', 'recognizedSong primaryEvidence', recognizedSong.primaryEvidence);
    pushEnglishOnlyError(errors, '$.recognizedSong.ambiguity', 'recognizedSong ambiguity', recognizedSong.ambiguity);
    for (const candidate of Array.isArray(recognizedSong.candidates) ? recognizedSong.candidates : []) {
      pushEnglishOnlyError(errors, '$.recognizedSong.candidates[].ambiguity', 'recognized song candidate ambiguity', candidate?.ambiguity);
      for (const evidenceEntry of Array.isArray(candidate?.evidence) ? candidate.evidence : []) {
        pushEnglishOnlyError(errors, '$.recognizedSong.candidates[].evidence[]', 'recognized song candidate evidence', evidenceEntry);
      }
    }
  }
  for (const note of recognitionNotes) {
    pushEnglishOnlyError(errors, '$.recognitionNotes[]', 'recognitionNotes entry', note);
  }
  for (const note of qualityNotes) {
    pushEnglishOnlyError(errors, '$.qualityNotes[]', 'qualityNotes entry', note);
  }

  return {
    ok: errors.length === 0,
    value: errors.length === 0 ? {
      summary,
      hasMusic,
      segments: normalizedSegments,
      globalArc,
      ...(recognizedSong ? { recognizedSong } : {}),
      ...(recognitionNotes.length > 0 ? { recognitionNotes } : {}),
      qualityNotes
    } : null,
    errors,
    summary: errors.length === 0 ? null : `Whole-asset music JSON validation failed. ${errors.slice(0, 6).map((error) => `${error.path}: ${error.message}`).join(' | ')} Return corrected JSON only.`,
    meta: { stage: 'validation' }
  };
}

function formatMusicLaneContext(musicData = null) {
  if (!musicData || typeof musicData !== 'object') return '';

  const lines = [];
  if (compactString(musicData.summary)) {
    lines.push(`Music-lane summary: ${compactString(musicData.summary)}`);
  }

  if (compactString(musicData?.globalArc?.dominantMood)) {
    lines.push(`Dominant mood: ${compactString(musicData.globalArc.dominantMood)}`);
  }

  const transitions = Array.isArray(musicData?.globalArc?.notableTransitions)
    ? musicData.globalArc.notableTransitions.slice(0, 4)
    : [];
  if (transitions.length > 0) {
    lines.push(`Notable transitions: ${transitions.map((transition) => `${Number(transition.start).toFixed(1)}-${Number(transition.end).toFixed(1)}s ${transition.label}`).join('; ')}`);
  }

  return lines.length > 0 ? `Upstream music-lane context:\n- ${lines.join('\n- ')}\n\n` : '';
}

function formatWholeAssetVocalsContext(wholeAssetAnalysis = null) {
  if (!wholeAssetAnalysis || typeof wholeAssetAnalysis !== 'object') {
    return '';
  }

  const lines = [];
  if (compactString(wholeAssetAnalysis.vocalSummary)) {
    lines.push(`Whole-asset vocals summary: ${compactString(wholeAssetAnalysis.vocalSummary)}`);
  }

  const segments = Array.isArray(wholeAssetAnalysis.vocal_segments) ? wholeAssetAnalysis.vocal_segments.slice(0, 12) : [];
  if (segments.length > 0) {
    lines.push(`Whole-asset lyric-bearing moments: ${segments.map((segment) => `${Number(segment.start).toFixed(1)}-${Number(segment.end).toFixed(1)}s "${segment.text}"`).join('; ')}`);
  }

  return lines.length > 0 ? `Whole-asset vocals continuity context:\n- ${lines.join('\n- ')}\n\n` : '';
}

function formatWholeAssetVocalsChunkChecklist(wholeAssetAnalysis = null, startTime = 0, endTime = 0) {
  const segments = Array.isArray(wholeAssetAnalysis?.vocal_segments)
    ? wholeAssetAnalysis.vocal_segments.filter((segment) => segment && typeof segment === 'object')
    : [];
  if (segments.length === 0) return '';

  const overlapping = [];
  const nearby = [];
  for (const segment of segments) {
    const start = Number(segment.start);
    const end = Number(segment.end);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) continue;

    const text = compactString(segment.text);
    const label = `${start.toFixed(1)}-${end.toFixed(1)}s${text ? ` "${text}"` : ''}`;
    if (end >= startTime - 0.25 && start <= endTime + 0.25) {
      overlapping.push(label);
    } else if (end >= startTime - 4 && start <= endTime + 4) {
      nearby.push(label);
    }
  }

  if (overlapping.length === 0 && nearby.length === 0) return '';

  const lines = [];
  if (overlapping.length > 0) {
    lines.push(`Expected lyric-bearing moments in or touching this chunk: ${overlapping.join('; ')}`);
  }
  if (nearby.length > 0) {
    lines.push(`Nearby lyric-bearing context to confirm, refine, or reject carefully: ${nearby.join('; ')}`);
  }

  return `Whole-asset recall checklist for this chunk:\n- ${lines.join('\n- ')}\n\n`;
}

function buildWholeAssetMusicVocalsPrompt(durationSeconds, recoveryRuntime = null, { intent = 'whole_asset', musicContext = null } = {}) {
  const modeNote = intent === 'hybrid'
    ? 'This full-asset pass provides music-vocals continuity context for a later chunk-refinement pass.'
    : 'This is the primary whole-asset music-vocals analysis pass.';

  const prompt = `Analyze the complete extracted audio track for the original asset timeline (0.0s to ${durationSeconds.toFixed(1)}s).

${modeNote}

${formatMusicLaneContext(musicContext)}Extract only text-bearing music-led vocals across the full asset.

Return JSON only in this format:
{
  "vocalSummary": "Concise summary of any sung/chanted/rapped lexical vocals across the asset, or say no text-bearing music-led vocals were detected.",
  "vocal_segments": [
    {
      "index": 0,
      "text": "We rise tonight",
      "confidence": 0.91,
      "performer": "Vocalist 1",
      "performer_id": "voc_001",
      "delivery": "sung"
    }
  ],
  "recognizedSong": {
    "status": "recognized",
    "confidence": 0.93,
    "candidates": [
      {
        "title": "Master of Puppets",
        "artist": "Metallica",
        "confidence": 0.93,
        "evidence": ["Literal lyric fragments match the heard refrain."],
        "matchedLyrics": ["Master, master", "Obey your master"]
      }
    ],
    "primaryEvidence": "Distinct lyric fragments and delivery strongly support one specific song.",
    "multipleSongsDetected": false
  },
  "recognitionNotes": [
    "Optional lane-level caution about overlap, masking, short duration, or multiple songs."
  ],
  "qualityNotes": [
    "Optional note about confidence, timing support, or ambiguity."
  ]
}

Rules:
${buildEnglishOnlyOutputRuleBlock()}
- Preserve vocal segment chronology via array order and index values. Array order/index is the truthful chronology signal for this lane.
- If timing is uncertain but the lyric-bearing event is clearly present, still emit the segment in the correct order/index position.
- Aim for full-trailer lyric coverage, not just representative examples.
- Capture each distinct lyric-bearing entry, reprise, or short return at the point it occurs in sequence.
- Do not skip a lyric segment merely because the phrase already appeared earlier; repeated hooks need their own vocal_segments.
- Keep spoken narration, spoken dialogue over score, and non-lexical vocalizations out of vocal_segments.
- Use vocal_segments only for audible sung lyrics, chant-like hooks, rap, melodic refrains, or truly inseparable hybrid music-led delivery.
- If speech and song overlap, keep only the clearly music-led lexical content in vocal_segments; spoken overlay remains outside this lane.
- Include only literal heard words or short partial fragments with discernible lexical content; do not paraphrase or invent missing words.
- Prefer short literal fragments over polished wrong lyric variants when the audio is masked or ambiguous.
- When masking reduces certainty, prefer a shorter lower-confidence literal fragment plus a qualityNotes caution over omitting the segment.
- Break vocal_segments when lyric wording changes, when a refrain repeats after a gap, or when a new vocal phrase is audibly distinct.
- Do not merge multiple lyric lines into one segment.
- Delivery must be one of: sung, chant, rap, melodic_refrain, hybrid.
- Use hybrid only when the same continuous utterance is truly inseparable as both speech-led and music-led; otherwise split adjacent spoken and sung spans and keep only the sung side here.
- After at least one literal lyric fragment grounds a likely song, you may use a high-confidence recognizedSong hypothesis as bounded recall scaffolding for nearby lines in the same cue.
- Treat whole-asset lyric phrases and recognizedSong matches as recall scaffolding only: confirm, shorten, correct, or reject them based on the chunk audio rather than copying them blindly.
- If an expected canonical line is only partly supported by the audio, emit only the shortest audibly supported fragment instead of a polished full-line rewrite.
- Do not promote a vague melody/hook match into a full canonical lyric line without audible lexical support in this asset.
- recognizedSong is optional. Use it only when the heard sung/chant/rap evidence supports a plausible famous-song hypothesis.
- Prefer recognizedSong.status = unknown, possible, or multiple_possible over inventing certainty.
- Every recognizedSong candidate must cite audio-grounded evidence; literal matchedLyrics are stronger than vibe-only guesses.
- Spoken dialogue, narration, radio chatter, or promo VO over music are never lyric evidence. If overlap weakens confidence, mention that in recognitionNotes.
- If multiple songs or cues are plausibly present, set multipleSongsDetected to true and prefer multiple_possible unless one clearly dominates.
- If no text-bearing music-led vocals are present, return vocal_segments as [] and say so in vocalSummary.
- JSON only. No markdown, no explanation.`;

  return `${prompt}${buildRecoveryPromptAddendum(recoveryRuntime)}`;
}

function buildRollingVocalsAnalysisPrompt(startTime, endTime, rollingSummary, recoveryRuntime = null, wholeAssetAnalysis = null, musicContext = null) {
  const roll = typeof rollingSummary === 'string' && rollingSummary.trim().length > 0
    ? rollingSummary.trim()
    : null;
  const chunkDurationSeconds = Math.max(0, endTime - startTime);
  const wholeAssetContext = formatWholeAssetVocalsContext(wholeAssetAnalysis);
  const wholeAssetChecklist = formatWholeAssetVocalsChunkChecklist(wholeAssetAnalysis, startTime, endTime);
  const musicLaneContext = formatMusicLaneContext(musicContext);

  const prompt = `Analyze the audio in this chunk (${startTime.toFixed(1)}s to ${endTime.toFixed(1)}s).

Important grounding:
- The attached audio file is already the extracted audio for this exact global window.
- The attached chunk duration is approximately ${chunkDurationSeconds.toFixed(1)} seconds.
- Treat ${startTime.toFixed(1)}s to ${endTime.toFixed(1)}s as the chunk's location in the original timeline, not as a claim about the attached file's full duration.
- Do NOT claim the requested range exceeds the file duration just because the attached chunk is shorter than the full trailer.
- Analyze only the audio that is actually present in the attached chunk.

${musicLaneContext}${wholeAssetContext}${wholeAssetChecklist}${roll ? `Rolling vocals summary so far (from previous chunks):
${roll}

` : ''}Extract only text-bearing music-led vocals for this chunk and maintain a concise rolling summary. Use the whole-asset context as a recall scaffold: confirm, refine, or reject expected lyric-bearing moments for this window based on the actual chunk audio.

Return JSON only in this format:
{
  "rollingSummary": "Updated rolling summary of text-bearing music-led vocals so far.",
  "vocalSummary": "Concise chunk-local vocals summary, or say none were detected in this chunk.",
  "vocal_segments": [
    {
      "index": 0,
      "text": "We rise tonight",
      "confidence": 0.91,
      "performer": "Vocalist 1",
      "performer_id": "voc_001",
      "delivery": "sung"
    }
  ],
  "recognizedSong": {
    "status": "possible",
    "confidence": 0.78,
    "candidates": [
      {
        "title": "Master of Puppets",
        "artist": "Metallica",
        "confidence": 0.78,
        "evidence": ["Literal lyric fragment and delivery align with one specific song."],
        "matchedLyrics": ["Master, master"],
        "ambiguity": "Only a short refrain is audible in this chunk."
      }
    ],
    "primaryEvidence": "A short lyric fragment suggests a specific song, but certainty remains evidence-gated.",
    "ambiguity": "Short chunk duration limits certainty.",
    "multipleSongsDetected": false
  },
  "recognitionNotes": [
    "Optional lane-level caution about overlap, masking, short duration, or multiple songs."
  ],
  "qualityNotes": [
    "Optional note about ambiguity, masking, or timing support in this chunk."
  ]
}

Rules:
${buildEnglishOnlyOutputRuleBlock()}
- Preserve vocal segment chronology via array order and index values. Array order/index is the truthful chronology signal for this chunk output.
- If timing is uncertain but a lyric-bearing moment is clearly present, still emit the segment in the correct order/index position.
- Keep spoken narration, spoken dialogue over score, and non-lexical vocalizations out of vocal_segments.
- Use vocal_segments only for audible sung lyrics, chant-like hooks, rap, melodic refrains, or truly inseparable hybrid music-led delivery.
- If speech and song overlap, keep only the clearly music-led lexical content in vocal_segments; spoken overlay remains outside this lane.
- Include only literal heard words or short partial fragments with discernible lexical content; do not paraphrase or invent missing words.
- Prefer short literal fragments over polished wrong lyric variants when the chunk is masked or ambiguous.
- When masking reduces certainty, prefer a shorter lower-confidence literal fragment plus a qualityNotes caution over omitting the segment.
- Break vocal_segments when lyric wording changes, when a refrain repeats after a gap, or when a new vocal phrase is audibly distinct.
- Do not skip a lyric segment merely because the phrase already appeared earlier; repeated hooks later in the trailer still need their own vocal_segments.
- Do not merge multiple lyric lines into one segment.
- Delivery must be one of: sung, chant, rap, melodic_refrain, hybrid.
- Use hybrid only when the same continuous utterance is truly inseparable as both speech-led and music-led; otherwise split adjacent spoken and sung spans and keep only the sung side here.
- Use rollingSummary, whole-asset context, and any high-confidence recognizedSong match as a checklist so late and brief lyric windows are revisited instead of forgotten.
- Treat whole-asset lyric phrases and recognizedSong matches as bounded recall scaffolding only: confirm, shorten, correct, or reject them based on this chunk rather than copying them blindly.
- If an expected canonical line is only partly supported in this chunk, emit only the shortest audibly supported fragment instead of a polished full-line rewrite.
- Do not promote a weak hook/vibe match into a canonical lyric line just because the likely song identity is known.
- recognizedSong is optional. Use it only when the heard sung/chant/rap evidence supports a plausible famous-song hypothesis.
- Prefer recognizedSong.status = unknown, possible, or multiple_possible over inventing certainty.
- Every recognizedSong candidate must cite audio-grounded evidence; literal matchedLyrics are stronger than vibe-only guesses.
- Spoken dialogue, narration, radio chatter, or promo VO over music are never lyric evidence. If overlap weakens confidence, mention that in recognitionNotes.
- If no text-bearing music-led vocals are present in this chunk, return vocal_segments as [] and say so in vocalSummary.
- JSON only. No markdown, no explanation.`;

  return `${prompt}${buildRecoveryPromptAddendum(recoveryRuntime)}`;
}

function parseRollingMusicVocalsResponse(responseContent) {
  const parsed = parseAndValidateJsonObject(responseContent, validateMusicVocalsAnalysisObject);
  if (!parsed.ok) {
    throw createRetryableError(`invalid_output: ${parsed.summary || 'music vocals output was invalid'}`, {
      group: parsed.meta?.stage || 'parse',
      raw: parsed.meta?.raw || responseContent || null,
      extracted: parsed.meta?.extracted || null,
      parseError: parsed.meta?.parseError || null,
      validationErrors: parsed.errors,
      validationSummary: parsed.summary
    });
  }

  return parsed.value;
}

function parseWholeAssetMusicVocalsResponse(responseContent) {
  const parsed = parseAndValidateJsonObject(responseContent, validateMusicVocalsAnalysisObject);

  if (!parsed.ok) {
    throw createRetryableError(`invalid_output: ${parsed.summary || 'whole-asset music vocals output was invalid'}`, {
      group: parsed.meta?.stage || 'parse',
      raw: parsed.meta?.raw || responseContent || null,
      extracted: parsed.meta?.extracted || null,
      parseError: parsed.meta?.parseError || null,
      validationErrors: parsed.errors,
      validationSummary: parsed.summary
    });
  }

  return parsed.value;
}

async function executeMusicVocalsAnalysisToolLoop({
  provider,
  adapter,
  basePrompt,
  toolLoopConfig,
  promptRef,
  events,
  ctx,
  runtimeConfig,
  audioBase64,
  audioMimeType
}) {
  const toolContract = buildMusicVocalsValidatorToolContract();

  return executeLocalValidatorToolLoop({
    provider,
    adapter,
    basePrompt,
    toolContract,
    toolLoopConfig,
    promptRef,
    events,
    ctx,
    phaseKey: PHASE_KEY,
    scriptId: SCRIPT_ID,
    domain: 'music_vocals',
    artifactLabel: 'music vocals analysis',
    finalArtifactDescription: 'The final artifact must be the music-vocals JSON object for this chunk.',
    finalArtifactRules: [
      'Include rollingSummary, vocalSummary, and vocal_segments.',
      'Keep spoken narration, spoken dialogue over score, and non-lexical vocalizations out of vocal_segments.',
      'Use vocal_segments only for audible sung lyrics, chant-like hooks, rap, melodic refrains, or truly inseparable hybrid music-led delivery.',
      'If speech and song overlap, keep only the clearly music-led lexical content in vocal_segments; spoken overlay remains outside this lane.',
      'Include only literal heard words or short partial fragments with discernible lexical content; do not paraphrase or invent missing words.',
      'When masking reduces certainty, prefer a shorter lower-confidence literal fragment plus a qualityNotes caution over omitting the segment.',
      'Prefer short literal fragments over polished wrong lyric variants when the audio is masked or ambiguous.',
      'Break vocal_segments when lyric wording changes, when a refrain repeats after a gap, or when a new vocal phrase is audibly distinct.',
      'Do not skip repeated hooks, reprises, or short late re-entries just because similar lyrics appeared earlier.',
      'Use whole-asset context as recall scaffolding during chunk refinement: confirm, shorten, correct, or reject expected lyric moments based on the actual chunk audio.',
      'recognizedSong and recognitionNotes are optional, but when present they must be grounded in heard sung/chant/rap evidence and must not use spoken dialogue over music as lyric evidence.',
      'delivery must be one of: sung, chant, rap, melodic_refrain, hybrid, with hybrid reserved for truly inseparable mixed delivery.'
    ],
    callProvider: ({ prompt }) => provider.complete({
      prompt,
      model: adapter?.model,
      apiKey: runtimeConfig?.apiKey,
      baseUrl: runtimeConfig?.baseUrl,
      attachments: [
        {
          type: 'audio',
          data: audioBase64,
          mimeType: audioMimeType
        }
      ],
      options: buildProviderOptions({
        adapter,
        defaults: buildProviderOptionDefaults(runtimeConfig, {
          temperature: 0.3
        })
      })
    }),
    executeValidatorTool: executeMusicVocalsValidatorTool,
    normalizeValidatedValue: (value) => JSON.stringify(value)
  });
}

async function executeWholeAssetMusicVocalsAnalysis({
  config,
  retryConfig,
  audioBase64,
  audioMimeType,
  durationSeconds,
  recoveryRuntime,
  events,
  captureRaw,
  writeWholeAssetMusicVocalsRaw,
  promptRef,
  intent = 'whole_asset',
  musicContext = null
}) {
  const prompt = buildWholeAssetMusicVocalsPrompt(durationSeconds, recoveryRuntime, { intent, musicContext });
  const attemptStartMs = new Map();

  const { result } = await executeWithTargets({
    config,
    domain: 'music_vocals',
    retry: retryConfig,
    operation: async (ctx) => {
      const adapter = ctx?.target?.adapter;
      const attemptKey = String(ctx?.attempt || '');

      if (attemptKey && !attemptStartMs.has(attemptKey)) {
        attemptStartMs.set(attemptKey, Date.now());
        events.emit({
          kind: 'attempt.start',
          phase: PHASE_KEY,
          script: SCRIPT_ID,
          domain: 'music_vocals',
          scope: 'whole_asset',
          attempt: ctx.attempt,
          attemptInTarget: ctx.attemptInTarget,
          targetIndex: ctx.targetIndex,
          targetCount: ctx.targetCount,
          adapter: adapter || null,
        });
      }

      const provider = getProviderForTarget({
        configForTarget: ctx.configForTarget,
        target: ctx.target
      });
      const runtimeConfig = resolveProviderRuntimeConfigForTarget({
        configForTarget: ctx.configForTarget,
        target: ctx.target
      });

      const providerCallStart = Date.now();
      events.emit({
        kind: 'provider.call.start',
        phase: PHASE_KEY,
        script: SCRIPT_ID,
        domain: 'music_vocals',
        scope: 'whole_asset',
        attempt: ctx.attempt,
        attemptInTarget: ctx.attemptInTarget,
        targetIndex: ctx.targetIndex,
        targetCount: ctx.targetCount,
        provider: adapter?.name || null,
        model: adapter?.model || null,
      });

      try {
        const completion = await provider.complete({
          prompt,
          model: adapter?.model,
          apiKey: runtimeConfig?.apiKey,
          baseUrl: runtimeConfig?.baseUrl,
          attachments: [
            {
              type: 'audio',
              data: audioBase64,
              mimeType: audioMimeType
            }
          ],
          options: buildProviderOptions({
            adapter,
            defaults: buildProviderOptionDefaults(runtimeConfig, {
              temperature: 0.4
            })
          })
        });

        const parsed = parseWholeAssetMusicVocalsResponse(completion?.content, durationSeconds);

        events.emit({
          kind: 'provider.call.end',
          phase: PHASE_KEY,
          script: SCRIPT_ID,
          domain: 'music_vocals',
          scope: 'whole_asset',
          attempt: ctx.attempt,
          attemptInTarget: ctx.attemptInTarget,
          targetIndex: ctx.targetIndex,
          ok: true,
          durationMs: Date.now() - providerCallStart,
          provider: adapter?.name || null,
          model: adapter?.model || null,
        });

        return { completion, parsed };
      } catch (error) {
        events.emit({
          kind: 'provider.call.end',
          phase: PHASE_KEY,
          script: SCRIPT_ID,
          domain: 'music_vocals',
          scope: 'whole_asset',
          attempt: ctx.attempt,
          attemptInTarget: ctx.attemptInTarget,
          targetIndex: ctx.targetIndex,
          ok: false,
          durationMs: Date.now() - providerCallStart,
          provider: adapter?.name || null,
          model: adapter?.model || null,
          error: error?.message || String(error),
        });
        throw error;
      }
    },
    onAttempt: ({
      ok,
      attempt,
      attemptInTarget,
      target,
      targetIndex,
      targetCount,
      failover,
      result,
      error
    }) => {
      const attemptKey = String(attempt || '');
      const startedAt = attemptKey && attemptStartMs.has(attemptKey) ? attemptStartMs.get(attemptKey) : null;
      const persistedError = ok ? null : getPersistedErrorInfo(error);

      events.emit({
        kind: 'attempt.end',
        phase: PHASE_KEY,
        script: SCRIPT_ID,
        domain: 'music_vocals',
        scope: 'whole_asset',
        attempt,
        attemptInTarget,
        targetIndex,
        targetCount,
        ok,
        durationMs: startedAt ? (Date.now() - startedAt) : null,
        provider: target?.adapter?.name || null,
        model: target?.adapter?.model || null,
        error: ok ? null : (error?.message || String(error)),
        errorStatus: persistedError?.status || null,
        errorRequestId: persistedError?.requestId || null,
        errorClassification: persistedError?.classification || null,
      });

      if (!captureRaw) return;

      writeWholeAssetMusicVocalsRaw(attempt, {
        attempt,
        attemptInTarget,
        targetIndex,
        targetCount,
        adapter: target?.adapter || null,
        failover: failover || null,
        promptRef: promptRef ? { sha256: promptRef.sha256, file: promptRef.file } : null,
        rawResponse: ok ? sanitizeRawCaptureValue(result?.completion) : null,
        parsed: ok ? result?.parsed : null,
        error: ok ? null : (error?.message || String(error)),
        errorName: ok ? null : (error?.name || null),
        errorCode: ok ? null : (error?.code || null),
        errorStatus: ok ? null : (persistedError?.status || null),
        errorRequestId: ok ? null : (persistedError?.requestId || null),
        errorClassification: ok ? null : (persistedError?.classification || null),
        errorStack: ok ? null : (typeof error?.stack === 'string' ? error.stack : null),
        errorDebug: ok ? null : (sanitizeRawCaptureValue(error?.debug) || null),
        errorResponse: ok ? null : (sanitizeRawCaptureValue(persistedError?.response) || null),
        provider: target?.adapter?.name || null,
        model: target?.adapter?.model || null,
        requestMeta: {
          adapter: target?.adapter || null,
          provider: target?.adapter?.name || null,
          model: target?.adapter?.model || null,
          attempt,
          attemptInTarget,
          targetIndex,
          targetCount,
          scope: 'whole_asset',
          intent
        }
      });
    }
  });

  return {
    prompt,
    parsed: result.parsed,
    completion: result.completion
  };
}

/**
 * Parse AI segment analysis response
 * 
 * @function parseSegmentResponse
 * @param {string} responseContent - AI response content
 * @param {number} startTime - Segment start time
 * @param {number} endTime - Segment end time
 * @returns {Object} - Parsed segment analysis
 */
function parseSegmentResponse(responseContent, startTime, endTime) {
  // Try to extract JSON from response
  let jsonData = null;

  try {
    jsonData = JSON.parse(responseContent.trim());
  } catch (e) {
    const jsonMatch = responseContent.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      try {
        jsonData = JSON.parse(jsonMatch[1].trim());
      } catch (e2) {
        // Fallback
      }
    }
  }

  // Fallback if parsing fails
  if (!jsonData) {
    return {
      start: startTime,
      end: endTime,
      type: 'unknown',
      description: 'Analysis failed',
      mood: null,
      intensity: 0
    };
  }

  return {
    start: startTime,
    end: endTime,
    type: jsonData.type || 'unknown',
    description: jsonData.description || 'No description',
    mood: jsonData.mood || null,
    intensity: typeof jsonData.intensity === 'number' ? jsonData.intensity : 0
  };
}

/**
 * Generate summary from all segments
 * 
 * @function generateSummary
 * @param {Array} segments - All segment analyses
 * @returns {string} - Summary text
 */
function generateSummary(segments) {
  const musicSegments = segments.filter(s => s.type === 'music' && s.mood);
  const speechSegments = segments.filter(s => s.type === 'speech');

  if (musicSegments.length === 0 && speechSegments.length === 0) {
    return 'No significant music or speech detected in the audio.';
  }

  let summary = '';

  if (musicSegments.length > 0) {
    const moods = [...new Set(musicSegments.map(s => s.mood).filter(Boolean))];
    summary += `Music detected with moods: ${moods.join(', ')}. `;
  }

  if (speechSegments.length > 0) {
    const speechDuration = speechSegments.reduce((sum, s) => sum + (s.end - s.start), 0);
    summary += `Speech present for approximately ${speechDuration.toFixed(0)} seconds. `;
  }

  return summary.trim();
}

module.exports = {
  run,
  aiRecovery: {
    guidance: 'Repair malformed or validator-rejected music analysis JSON while preserving the same segment analysis task and schema.',
    reentry: {
      allowedMutableInputs: ['repairInstructions', 'boundedContextSummary'],
      forbiddenMutableInputs: ['upstreamArtifacts', 'artifactPaths', 'schemaDefinition', 'runtimeBudgets']
    }
  }
};

// Allow standalone execution for testing
if (require.main === module) {
  const assetPath = process.argv[2] || 'test-audio.wav';
  const outputDir = process.argv[3] || 'output/test-music';

  console.log('Get Music Vocals Script - Test Mode');
  console.log('Asset:', assetPath);
  console.log('Output:', outputDir);
  console.log('');
  console.log('⚠️  This script requires:');
  console.log('   - AI_API_KEY environment variable');
  console.log('   - config.ai.music_vocals.targets[*].adapter.{name,model} (set in pipeline YAML)');
  console.log('   - ffmpeg installed for audio extraction');
  console.log('   - A model that supports audio analysis');
  console.log('');
  console.log('Note: This script is designed to be run within the pipeline.');
  console.log('      The model must be explicitly configured in the YAML.');
}
