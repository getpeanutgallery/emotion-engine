#!/usr/bin/env node
/**
 * Get Music Script
 * 
 * Extracts and analyzes music/audio from video to identify mood, intensity, and segments.
 * This script runs in Phase 1 (Gather Context) of the pipeline.
 *
 * Raw capture schema v2 parity (Phase2-style):
 * - attempt-scoped capture payloads (even if attempt is always 1 for now)
 * - legacy flat files preserved as pointer JSON
 * - phase error artifacts written to raw/_meta/errors.jsonl + errors.summary.json
 *
 * @module scripts/get-context/get-music
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
  validateMusicAnalysisObject
} = require('../../lib/structured-output.cjs');
const {
  buildMusicAnalysisValidatorToolContract,
  executeMusicAnalysisValidatorTool
} = require('../../lib/phase1-validator-tools.cjs');
const { executeLocalValidatorToolLoop } = require('../../lib/local-validator-tool-loop.cjs');
const {
  resolveProviderRuntimeConfigForTarget,
  ensureRuntimeAuthForDomain,
  buildProviderOptionDefaults
} = require('../../lib/provider-runtime-config.cjs');
const { applyFailureMetadata } = require('../../lib/tool-wrapper-contract.cjs');

const PHASE_KEY = 'phase1-gather-context';
const SCRIPT_ID = 'get-music';
const DEFAULT_MUSIC_ANALYSIS_WINDOW_SECONDS = 30;
const DEFAULT_PHASE1_MUSIC_MAX_WHOLE_ASSET_DURATION_SECONDS = 240;
const VALID_PHASE1_MUSIC_MODES = new Set(['auto', 'chunked', 'whole_asset', 'hybrid']);

function compactString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

const MUSIC_VOCAL_DELIVERIES = new Set(['sung', 'chant', 'rap', 'melodic_refrain', 'hybrid']);

function clampMusicVocalTime(value, maxDuration) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  const upperBound = Number.isFinite(maxDuration) && maxDuration >= 0 ? maxDuration : Number.POSITIVE_INFINITY;
  return Math.max(0, Math.min(upperBound, Number(numeric.toFixed(3))));
}

function normalizeMusicVocalSegments(segments, { maxDuration = Number.POSITIVE_INFINITY } = {}) {
  if (!Array.isArray(segments)) return [];

  return segments.map((segment) => {
    if (!segment || typeof segment !== 'object' || Array.isArray(segment)) return null;

    const start = clampMusicVocalTime(segment.start, maxDuration);
    const end = clampMusicVocalTime(segment.end, maxDuration);
    const text = compactString(segment.text);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start || !text) return null;

    const performer = compactString(segment.performer || segment.singer || segment.voice) || null;
    const performerIdSource = compactString(segment.performer_id || segment.performerId || segment.singer_id || segment.singerId);
    const performer_id = performerIdSource
      ? performerIdSource.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || null
      : null;
    const confidence = Number(segment.confidence);
    const delivery = compactString(segment.delivery).toLowerCase();

    return {
      start,
      end,
      text,
      confidence: Number.isFinite(confidence) ? Math.max(0, Math.min(1, Number(confidence.toFixed(4)))) : null,
      performer,
      performer_id,
      delivery: MUSIC_VOCAL_DELIVERIES.has(delivery) ? delivery : null
    };
  }).filter(Boolean).sort((left, right) => left.start - right.start || left.end - right.end);
}

function generateMusicVocalsSummary(segments = []) {
  if (!Array.isArray(segments) || segments.length === 0) {
    return 'No text-bearing music-led vocals detected.';
  }

  const deliveries = Array.from(new Set(segments.map((segment) => compactString(segment.delivery)).filter(Boolean)));
  const deliveryLabel = deliveries.length > 0 ? deliveries.join(', ') : 'music-led';
  return `${segments.length} text-bearing ${deliveryLabel} vocal segment(s) detected in the music lane.`;
}

function buildMusicVocalsData({
  vocalSegments,
  summary,
  duration,
  analysisMode,
  timingMode,
  sourceStrategy,
  provenance,
  qualityNotes
}) {
  const normalizedSegments = normalizeMusicVocalSegments(vocalSegments, { maxDuration: duration });
  const normalizedSummary = compactString(summary) || generateMusicVocalsSummary(normalizedSegments);
  const normalizedQualityNotes = Array.from(new Set((Array.isArray(qualityNotes) ? qualityNotes : []).map((value) => compactString(value)).filter(Boolean)));

  return {
    vocal_segments: normalizedSegments,
    summary: normalizedSummary,
    hasVocals: normalizedSegments.length > 0,
    totalDuration: duration,
    analysisMode,
    timingMode,
    sourceStrategy,
    coverage: {
      start: 0,
      end: duration,
      duration,
      complete: true
    },
    provenance: { ...(provenance || {}) },
    ...(normalizedQualityNotes.length > 0 ? { qualityNotes: normalizedQualityNotes } : {})
  };
}

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

function getRetryConfig(config = {}, domain = 'music') {
  const retry = config?.ai?.[domain]?.retry || {};

  return {
    maxAttempts: Number.isInteger(retry.maxAttempts) && retry.maxAttempts > 0 ? retry.maxAttempts : 1,
    backoffMs: Number.isInteger(retry.backoffMs) && retry.backoffMs >= 0 ? retry.backoffMs : 0
  };
}

function getToolLoopConfig(config = {}, domain = 'music') {
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

  const configuredLegacy = Number(config?.ai?.music?.analysisWindowSeconds);
  if (Number.isFinite(configuredLegacy) && configuredLegacy > 0) {
    return configuredLegacy;
  }

  return DEFAULT_MUSIC_ANALYSIS_WINDOW_SECONDS;
}

function resolveMusicAnalysisStrategy(preflight, config = {}) {
  const requestedMode = resolveRequestedPhase1MusicMode(config);
  const maxWholeAssetDurationSeconds = resolveMaxWholeAssetMusicDurationSeconds(config);
  const durationSeconds = Number(preflight?.durationSeconds) || 0;
  const inlineWholeAssetSafe = preflight?.needsChunking !== true;
  const durationEligible = durationSeconds <= maxWholeAssetDurationSeconds;
  const wholeAssetEligible = inlineWholeAssetSafe && durationEligible;

  let actualMode = requestedMode;
  if (requestedMode === 'auto') {
    actualMode = wholeAssetEligible ? 'whole_asset' : 'chunked';
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
    fallbackToChunked: shouldFallbackWholeAssetMusicToChunked(config)
  };
}

function buildFallbackNote(reason) {
  const normalized = compactString(reason);
  return normalized ? `Whole-asset music analysis fell back to chunked mode: ${normalized}` : null;
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
  const recoveryRuntime = getRecoveryRuntime(input);

  console.log('   🎵 Extracting and analyzing music/audio from:', assetPath);

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

  const writeMusicSegmentRaw = (segmentIndex, attempt, payload) => {
    if (!captureRaw) return;

    const legacyFileName = `music-segment-${segmentIndex}.json`;

    const attemptRelDir = path.join(`music-segment-${pad(segmentIndex, 4)}`, `attempt-${pad(attempt, 2)}`);
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

  const writeWholeAssetMusicRaw = (attempt, payload) => {
    if (!captureRaw) return;

    const legacyFileName = 'music-whole-asset.json';
    const attemptRelDir = path.join('music-whole-asset', `attempt-${pad(attempt, 2)}`);
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
      domain: 'music',
      trace: preflight.trace
    });

    const analysisChunkPlan = buildMusicAnalysisChunkPlan(preflight, config);

    if (captureRaw) {
      const analysisWindowSeconds = resolveMusicAnalysisWindowSeconds(config);
      const planPath = writeRawJson(ffmpegRawDir, 'chunk-plan.json', {
        schemaVersion: 2,
        kind: 'audio.chunk.plan',
        domain: 'music',
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
    const strategy = resolveMusicAnalysisStrategy(preflight, config);

    console.log(`   📊 Audio duration: ${duration.toFixed(1)}s (${analysisChunkPlan.length} analysis chunk(s) from ${preflight.chunkPlan.length} transport chunk(s))`);
    console.log(`   🎼 Music analysis mode: requested=${strategy.requestedMode}, selected=${strategy.actualMode}`);

    const segments = [];
    let hasMusic = false;
    let finalAnalysisMode = strategy.actualMode;
    let wholeAssetAnalysis = null;
    let fallbackApplied = false;
    let fallbackReason = null;
    const qualityNotes = [];

    // config.ai.music.targets[*].adapter.model is required (validated by config-loader)

    ensureRuntimeAuthForDomain({
      config,
      domain: 'music',
      replayMode: false,
      prefix: 'GetMusic'
    });

    const retryConfig = getRetryConfig(config, 'music');
    const toolLoopConfig = getToolLoopConfig(config, 'music');
    console.log(`   🔁 Music retry config: attempts=${retryConfig.maxAttempts}, backoffMs=${retryConfig.backoffMs}`);

    const chunksDir = captureRaw
      ? path.join(ffmpegRawDir, 'chunks')
      : path.join(tempDir, 'chunks');
    fs.mkdirSync(chunksDir, { recursive: true });

    let rollingSummary = '';
    const musicVocalSegments = [];
    let rollingVocalSummary = '';

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
        const wholeAssetPrompt = buildWholeAssetMusicPrompt(duration, recoveryRuntime, {
          intent: strategy.actualMode === 'hybrid' ? 'hybrid' : 'whole_asset'
        });
        const wholeAssetPromptRef = captureRaw
          ? storePromptPayload({ outputDir, payload: wholeAssetPrompt })
          : null;

        if (wholeAssetPromptRef?.absolutePath) {
          events.artifactWrite({ absolutePath: wholeAssetPromptRef.absolutePath, role: 'raw.prompt', phase: PHASE_KEY, script: SCRIPT_ID });
        }

        try {
          const wholeAssetResult = await executeWholeAssetMusicAnalysis({
            config,
            retryConfig,
            audioBase64: wholeAssetAudioBase64,
            audioMimeType: getAudioMimeType(config),
            durationSeconds: duration,
            recoveryRuntime,
            events,
            captureRaw,
            writeWholeAssetMusicRaw,
            promptRef: wholeAssetPromptRef,
            intent: strategy.actualMode === 'hybrid' ? 'hybrid' : 'whole_asset'
          });

          wholeAssetAnalysis = wholeAssetResult.parsed;
          hasMusic = wholeAssetAnalysis.hasMusic;

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

      const prompt = buildRollingAnalysisPrompt(startTime, endTime, rollingSummary, recoveryRuntime, wholeAssetAnalysis);
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
          domain: 'music',
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
                domain: 'music',
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
              domain: 'music',
              segmentIndex: chunkIndex,
              attempt: ctx.attempt,
              attemptInTarget: ctx.attemptInTarget,
              targetIndex: ctx.targetIndex,
              targetCount: ctx.targetCount,
              provider: adapter?.name || null,
              model: adapter?.model || null,
            });

            try {
              const toolLoopResult = await executeMusicAnalysisToolLoop({
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
                domain: 'music',
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
                segment: {
                  start: startTime,
                  end: endTime,
                  type: toolLoopResult.parsed.analysis.type,
                  description: toolLoopResult.parsed.analysis.description,
                  mood: toolLoopResult.parsed.analysis.mood,
                  intensity: toolLoopResult.parsed.analysis.intensity
                },
                rollingSummary: toolLoopResult.parsed.rollingSummary,
                vocalSummary: toolLoopResult.parsed.vocalSummary,
                vocal_segments: normalizeMusicVocalSegments(toolLoopResult.parsed.vocal_segments, { maxDuration: duration })
              };
              return { completion: toolLoopResult.completion, parsed, toolLoop: toolLoopResult.toolLoop };
            } catch (error) {
              events.emit({
                kind: 'provider.call.end',
                phase: PHASE_KEY,
                script: SCRIPT_ID,
                domain: 'music',
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
              domain: 'music',
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

            writeMusicSegmentRaw(chunkIndex, attempt, {
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
        segments.push(parsed.segment);
        if (parsed.segment.type === 'music' || parsed.segment.mood) {
          hasMusic = true;
        }

        rollingSummary = typeof parsed.rollingSummary === 'string' && parsed.rollingSummary.trim().length > 0
          ? parsed.rollingSummary.trim()
          : rollingSummary;
        if (Array.isArray(parsed.vocal_segments) && parsed.vocal_segments.length > 0) {
          musicVocalSegments.push(...parsed.vocal_segments);
        }
        rollingVocalSummary = typeof parsed.vocalSummary === 'string' && parsed.vocalSummary.trim().length > 0
          ? parsed.vocalSummary.trim()
          : rollingVocalSummary;
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

    const finalSegments = finalAnalysisMode === 'whole_asset'
      ? (Array.isArray(wholeAssetAnalysis?.segments) ? wholeAssetAnalysis.segments : [])
      : segments;
    const finalSummary = finalAnalysisMode === 'whole_asset'
      ? (compactString(wholeAssetAnalysis?.summary) || generateSummary(finalSegments))
      : (compactString(wholeAssetAnalysis?.summary) || rollingSummary || generateSummary(finalSegments));
    const finalHasMusic = Boolean((finalAnalysisMode === 'whole_asset' ? wholeAssetAnalysis?.hasMusic : hasMusic) || wholeAssetAnalysis?.hasMusic);
    const timingMode = finalAnalysisMode === 'chunked' ? 'chunk_local' : 'full_timeline';
    const usedChunking = finalAnalysisMode !== 'whole_asset';
    const finalQualityNotes = Array.from(new Set([
      ...qualityNotes,
      ...(Array.isArray(wholeAssetAnalysis?.qualityNotes) ? wholeAssetAnalysis.qualityNotes : [])
    ].filter((value) => compactString(value))));
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
      base64BudgetBytes: Number(preflight?.budgetBytes) || null
    };

    // Build music data
    const musicData = {
      segments: finalSegments,
      summary: finalSummary,
      hasMusic: finalHasMusic,
      analysisMode: finalAnalysisMode,
      timingMode,
      sourceStrategy: 'base64',
      coverage: {
        start: 0,
        end: duration,
        duration,
        complete: true
      },
      ...(shouldEmitMusicGlobalArc(config) && wholeAssetAnalysis?.globalArc ? { globalArc: wholeAssetAnalysis.globalArc } : {}),
      provenance: sharedProvenance,
      ...(finalQualityNotes.length > 0 ? { qualityNotes: finalQualityNotes } : {})
    };
    const finalMusicVocalSegments = finalAnalysisMode === 'whole_asset'
      ? normalizeMusicVocalSegments(wholeAssetAnalysis?.vocal_segments, { maxDuration: duration })
      : normalizeMusicVocalSegments(musicVocalSegments, { maxDuration: duration });
    const musicVocalsData = buildMusicVocalsData({
      vocalSegments: finalMusicVocalSegments,
      summary: finalAnalysisMode === 'whole_asset'
        ? wholeAssetAnalysis?.vocalSummary
        : (rollingVocalSummary || wholeAssetAnalysis?.vocalSummary),
      duration,
      analysisMode: finalAnalysisMode,
      timingMode,
      sourceStrategy: 'base64',
      provenance: sharedProvenance,
      qualityNotes: finalQualityNotes
    });

    // Write intermediate artifacts to phase directory
    const artifactPath = path.join(phaseDir, 'music-data.json');
    fs.writeFileSync(artifactPath, JSON.stringify(musicData, null, 2));
    events.artifactWrite({ absolutePath: artifactPath, role: 'artifact', phase: PHASE_KEY, script: SCRIPT_ID });
    const musicVocalsArtifactPath = path.join(phaseDir, 'music-vocals-data.json');
    fs.writeFileSync(musicVocalsArtifactPath, JSON.stringify(musicVocalsData, null, 2));
    events.artifactWrite({ absolutePath: musicVocalsArtifactPath, role: 'artifact', phase: PHASE_KEY, script: SCRIPT_ID });

    console.log('   ✅ Music/audio analysis complete');
    console.log(`      Output: ${artifactPath}`);
    console.log(`      Music-vocal output: ${musicVocalsArtifactPath}`);
    console.log(`      Found ${finalSegments.length} segment(s)`);
    console.log(`      Music detected: ${finalHasMusic ? 'Yes' : 'No'}`);
    console.log(`      Text-bearing music vocals: ${musicVocalsData.hasVocals ? `${musicVocalsData.vocal_segments.length} segment(s)` : 'None'}`);

    return {
      artifacts: {
        musicData,
        musicVocalsData
      }
    };
  } catch (error) {
    console.error('   ❌ Error analyzing music:', error.message);
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
5. Optional transcript-like music vocals for sung lyrics, chant-like hooks, rap, melodic refrains, or inseparable music-led hybrid delivery

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

  const vocal_segments = normalizeMusicVocalSegments(input.vocal_segments, { maxDuration });
  if (input.vocal_segments !== undefined && !Array.isArray(input.vocal_segments)) {
    errors.push({ path: '$.vocal_segments', code: 'required_array', message: 'vocal_segments must be an array when provided.' });
  }

  const vocalSummarySource = input.vocalSummary ?? input.vocal_summary ?? input.musicVocalsSummary;
  const vocalSummary = vocalSummarySource === undefined || vocalSummarySource === null
    ? null
    : compactString(vocalSummarySource);
  if (vocalSummarySource !== undefined && vocalSummarySource !== null && !vocalSummary) {
    errors.push({ path: '$.vocalSummary', code: 'required_string', message: 'vocalSummary must be a non-empty string when provided.' });
  }

  return {
    ok: errors.length === 0,
    value: errors.length === 0 ? {
      summary,
      hasMusic,
      segments: normalizedSegments,
      globalArc,
      qualityNotes,
      vocalSummary,
      vocal_segments
    } : null,
    errors,
    summary: errors.length === 0 ? null : `Whole-asset music JSON validation failed. ${errors.slice(0, 6).map((error) => `${error.path}: ${error.message}`).join(' | ')} Return corrected JSON only.`,
    meta: { stage: 'validation' }
  };
}

function buildWholeAssetMusicPrompt(durationSeconds, recoveryRuntime = null, { intent = 'whole_asset' } = {}) {
  const modeNote = intent === 'hybrid'
    ? 'This full-asset pass provides global music arc context for a later chunk-refinement pass.'
    : 'This is the primary whole-asset music analysis pass.';

  const prompt = `Analyze the complete extracted audio track for the original asset timeline (0.0s to ${durationSeconds.toFixed(1)}s).

${modeNote}

Identify the overall music arc across the full asset, then emit coarse timeline-aware segments for major audio changes and a transcript-like pass for any text-bearing music-led vocals.

Return JSON only in this format:
{
  "summary": "Concise full-asset summary",
  "hasMusic": true,
  "globalArc": {
    "dominantMood": "energetic",
    "energyCurve": "rising_then_plateau_then_drop",
    "notableTransitions": [
      { "start": 58.0, "end": 65.0, "label": "rock vocal entry" }
    ]
  },
  "segments": [
    {
      "start": 0.0,
      "end": 35.0,
      "type": "music",
      "description": "Opening pulse with restrained percussion",
      "mood": "tense",
      "intensity": 6
    }
  ],
  "qualityNotes": [
    "Optional note about confidence, timing precision, or continuity."
  ],
  "vocalSummary": "Short summary of any text-bearing music-led vocals, or omit when none are present.",
  "vocal_segments": [
    {
      "start": 58.0,
      "end": 61.2,
      "text": "We rise tonight",
      "confidence": 0.91,
      "performer": "Vocalist 1",
      "performer_id": "voc_001",
      "delivery": "sung"
    }
  ]
}

Rules:
- Use the original full timeline in seconds for every segment and transition.
- Provide 1-12 segments covering the major audio changes across the full asset.
- Keep start/end in ascending order and within 0.0s to ${durationSeconds.toFixed(1)}s.
- If music is absent, set hasMusic to false and still return best-effort segments using types like speech, silence, ambient, or sfx.
- Keep spoken narration or dialogue over score out of vocal_segments; that belongs in the dialogue lane.
- Use vocal_segments only for sung lyrics, chant-like vocals, rap synchronized to music, melodic refrains, or truly inseparable hybrid music-led delivery.
- For music-lane vocals, include only audible sung/chanted/rapped words with discernible lexical content.
- Prefer literal heard words or short partial fragments over paraphrase, cleanup, or invented completions when the lyric is unclear.
- Break vocal_segments when lyric wording changes, when a refrain repeats after a gap, or when a new vocal phrase is audibly distinct.
- Do not merge multiple lyric lines into one summary segment.
- Do not leak music summary/description language into vocal_segments text.
- If spoken dialogue and music-led vocals alternate, split them into adjacent segments instead of merging them.
- summary must describe the whole asset, not just one moment.
- globalArc.notableTransitions may be empty.
- delivery must be one of: sung, chant, rap, melodic_refrain, hybrid.
- JSON only. No markdown, no explanation.`;

  return `${prompt}${buildRecoveryPromptAddendum(recoveryRuntime)}`;
}

function formatWholeAssetMusicContext(wholeAssetAnalysis = null) {
  if (!wholeAssetAnalysis || typeof wholeAssetAnalysis !== 'object') {
    return '';
  }

  const lines = [];
  if (compactString(wholeAssetAnalysis.summary)) {
    lines.push(`Whole-asset summary: ${compactString(wholeAssetAnalysis.summary)}`);
  }

  const dominantMood = compactString(wholeAssetAnalysis?.globalArc?.dominantMood);
  if (dominantMood) {
    lines.push(`Dominant mood: ${dominantMood}`);
  }

  const energyCurve = compactString(wholeAssetAnalysis?.globalArc?.energyCurve);
  if (energyCurve) {
    lines.push(`Energy curve: ${energyCurve}`);
  }

  const transitions = Array.isArray(wholeAssetAnalysis?.globalArc?.notableTransitions)
    ? wholeAssetAnalysis.globalArc.notableTransitions.slice(0, 4)
    : [];
  if (transitions.length > 0) {
    lines.push(`Notable transitions: ${transitions.map((transition) => `${Number(transition.start).toFixed(1)}-${Number(transition.end).toFixed(1)}s ${transition.label}`).join('; ')}`);
  }

  return lines.length > 0 ? `Whole-asset continuity context:\n- ${lines.join('\n- ')}\n\n` : '';
}

function buildRollingAnalysisPrompt(startTime, endTime, rollingSummary, recoveryRuntime = null, wholeAssetAnalysis = null) {
  const roll = typeof rollingSummary === 'string' && rollingSummary.trim().length > 0
    ? rollingSummary.trim()
    : null;
  const chunkDurationSeconds = Math.max(0, endTime - startTime);
  const wholeAssetContext = formatWholeAssetMusicContext(wholeAssetAnalysis);

  const prompt = `Analyze the audio in this chunk (${startTime.toFixed(1)}s to ${endTime.toFixed(1)}s).

Important grounding:
- The attached audio file is already the extracted audio for this exact global window.
- The attached chunk duration is approximately ${chunkDurationSeconds.toFixed(1)} seconds.
- Treat ${startTime.toFixed(1)}s to ${endTime.toFixed(1)}s as the chunk's location in the original timeline, not as a claim about the attached file's full duration.
- Do NOT claim the requested range exceeds the file duration just because the attached chunk is shorter than the full trailer.
- Analyze only the audio that is actually present in the attached chunk.

${wholeAssetContext}${roll ? `Rolling summary so far (from previous chunks):\n${roll}\n\n` : ''}Identify:
1. Type of audio: music, speech, silence, ambient noise, sound effects
2. If music: describe the mood (upbeat, calm, tense, sad, energetic, etc.)
3. Intensity level from 1-10
4. Brief description

Return JSON only in this format:
{
  "analysis": {
    "type": "music",
    "description": "Brief description of the audio",
    "mood": "energetic",
    "intensity": 5
  },
  "chunkSummary": "1-2 sentences",
  "rollingSummary": "Updated rolling summary for the entire audio so far (keep concise)",
  "vocalSummary": "Optional concise update about text-bearing music-led vocals so far",
  "vocal_segments": [
    {
      "start": ${startTime.toFixed(1)},
      "end": ${endTime.toFixed(1)},
      "text": "We rise tonight",
      "confidence": 0.91,
      "performer": "Vocalist 1",
      "performer_id": "voc_001",
      "delivery": "sung"
    }
  ]
}

Allowed values for analysis.type: music | speech | silence | ambient | sfx.
Allowed values for analysis.mood: upbeat | calm | tense | sad | energetic | neutral.
Keep spoken narration or dialogue over score out of vocal_segments; that belongs in dialogueData.
Use vocal_segments only for text-bearing music-led vocals.
Include only audible sung/chanted/rapped words with discernible lexical content.
Prefer literal heard words or short partial fragments over paraphrase or invented completions when uncertain.
Break vocal_segments when lyric wording changes, when a refrain repeats after a gap, or when a new vocal phrase is audibly distinct.
Do not merge multiple lyric lines into one summary segment.
Do not leak music summary/description language into vocal_segments text.
If spoken delivery changes into music-led delivery inside the chunk, split them into adjacent segments instead of merging them.
Allowed values for vocal_segments[*].delivery: sung | chant | rap | melodic_refrain | hybrid.`;

  return `${prompt}${buildRecoveryPromptAddendum(recoveryRuntime)}`;
}

function parseRollingMusicResponse(responseContent, startTime, endTime) {
  const parsed = parseAndValidateJsonObject(responseContent, validateMusicAnalysisObject);
  if (!parsed.ok) {
    throw createRetryableError(`invalid_output: ${parsed.summary || 'music analysis output was invalid'}`, {
      group: parsed.meta?.stage || 'parse',
      raw: parsed.meta?.raw || responseContent || null,
      extracted: parsed.meta?.extracted || null,
      parseError: parsed.meta?.parseError || null,
      validationErrors: parsed.errors,
      validationSummary: parsed.summary
    });
  }

  return {
    segment: {
      start: startTime,
      end: endTime,
      type: parsed.value.analysis.type,
      description: parsed.value.analysis.description,
      mood: parsed.value.analysis.mood,
      intensity: parsed.value.analysis.intensity
    },
    rollingSummary: parsed.value.rollingSummary
  };
}

function parseWholeAssetMusicResponse(responseContent, durationSeconds) {
  const parsed = parseAndValidateJsonObject(
    responseContent,
    (value) => validateWholeAssetMusicAnalysisObject(value, durationSeconds)
  );

  if (!parsed.ok) {
    throw createRetryableError(`invalid_output: ${parsed.summary || 'whole-asset music analysis output was invalid'}`, {
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

async function executeMusicAnalysisToolLoop({
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
  const toolContract = buildMusicAnalysisValidatorToolContract();

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
    domain: 'music',
    artifactLabel: 'music analysis',
    finalArtifactDescription: 'The final artifact must be the music analysis JSON object for this chunk.',
    finalArtifactRules: [
      'Report analysis.type, analysis.description, optional analysis.mood, and analysis.intensity.',
      'Include rollingSummary when you have continuity context from prior chunks.',
      'Include vocal_segments and optional vocalSummary only for text-bearing music-led vocals (sung lyrics, chant-like hooks, rap, melodic refrains, or inseparable hybrid delivery).',
      'Do not put spoken narration or dialogue-over-score into vocal_segments; those belong in the dialogue lane.',
      'For music-lane vocals, include only audible sung/chanted/rapped words with discernible lexical content and prefer literal heard words or short partial fragments over paraphrase or invented completions.',
      'Break vocal_segments when lyric wording changes, when a refrain repeats after a gap, or when a new vocal phrase is audibly distinct. Do not merge multiple lyric lines into one summary segment or leak music summary language into vocal_segments text.'
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
          temperature: 0.5
        })
      })
    }),
    executeValidatorTool: executeMusicAnalysisValidatorTool,
    normalizeValidatedValue: (value) => JSON.stringify(value)
  });
}

async function executeWholeAssetMusicAnalysis({
  config,
  retryConfig,
  audioBase64,
  audioMimeType,
  durationSeconds,
  recoveryRuntime,
  events,
  captureRaw,
  writeWholeAssetMusicRaw,
  promptRef,
  intent = 'whole_asset'
}) {
  const prompt = buildWholeAssetMusicPrompt(durationSeconds, recoveryRuntime, { intent });
  const attemptStartMs = new Map();

  const { result } = await executeWithTargets({
    config,
    domain: 'music',
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
          domain: 'music',
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
        domain: 'music',
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

        const parsed = parseWholeAssetMusicResponse(completion?.content, durationSeconds);

        events.emit({
          kind: 'provider.call.end',
          phase: PHASE_KEY,
          script: SCRIPT_ID,
          domain: 'music',
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
          domain: 'music',
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
        domain: 'music',
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

      writeWholeAssetMusicRaw(attempt, {
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

  console.log('Get Music Script - Test Mode');
  console.log('Asset:', assetPath);
  console.log('Output:', outputDir);
  console.log('');
  console.log('⚠️  This script requires:');
  console.log('   - AI_API_KEY environment variable');
  console.log('   - config.ai.music.targets[*].adapter.{name,model} (set in pipeline YAML)');
  console.log('   - ffmpeg installed for audio extraction');
  console.log('   - A model that supports audio analysis');
  console.log('');
  console.log('Note: This script is designed to be run within the pipeline.');
  console.log('      The model must be explicitly configured in the YAML.');
}
