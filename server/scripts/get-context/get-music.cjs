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
const { shouldCaptureRaw, getRawPhaseDir, writeRawJson } = require('../../lib/raw-capture.cjs');
const { ensureToolVersionsCaptured } = require('../../lib/tool-versions.cjs');
const { ffmpegPath, ffprobePath } = require('../../lib/ffmpeg-path.cjs');
const { getEventsLogger } = require('../../lib/events-timeline.cjs');
const { storePromptPayload } = require('../../lib/prompt-store.cjs');
const { preflightAudio } = require('../../lib/audio-preflight.cjs');
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
const { applyFailureMetadata } = require('../../lib/tool-wrapper-contract.cjs');

const PHASE_KEY = 'phase1-gather-context';
const SCRIPT_ID = 'get-music';

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

function sanitizeRawCaptureValue(value, depth = 0, seen = new WeakSet()) {
  if (value === null || value === undefined) return value;
  if (depth > 8) return '[Truncated]';

  if (typeof value === 'string') {
    if (value.startsWith('Bearer ')) return 'Bearer [REDACTED]';
    return value;
  }

  if (typeof value !== 'object') return value;

  if (seen.has(value)) return '[Circular]';
  seen.add(value);

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeRawCaptureValue(item, depth + 1, seen));
  }

  const out = {};
  for (const [key, item] of Object.entries(value)) {
    if (/authorization/i.test(key) || /api[_-]?key/i.test(key)) {
      out[key] = '[REDACTED]';
      continue;
    }
    out[key] = sanitizeRawCaptureValue(item, depth + 1, seen);
  }

  return out;
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

    if (captureRaw) {
      const planPath = writeRawJson(ffmpegRawDir, 'chunk-plan.json', {
        schemaVersion: 1,
        kind: 'audio.chunk.plan',
        domain: 'music',
        createdAt: new Date().toISOString(),
        trace: preflight.trace,
        chunks: preflight.chunkPlan
      });
      events.artifactWrite({ absolutePath: planPath, role: 'raw.ffmpeg.plan', phase: PHASE_KEY, script: SCRIPT_ID });
    }

    const duration = preflight.durationSeconds;

    console.log(`   📊 Audio duration: ${duration.toFixed(1)}s (${preflight.chunkPlan.length} chunk(s))`);

    const segments = [];
    let hasMusic = false;

    // config.ai.music.targets[*].adapter.model is required (validated by config-loader)

    const apiKey = process.env.AI_API_KEY;
    if (!apiKey) {
      throw new Error('GetMusic: AI_API_KEY environment variable is required');
    }

    const retryConfig = getRetryConfig(config, 'music');
    const toolLoopConfig = getToolLoopConfig(config, 'music');
    console.log(`   🔁 Music retry config: attempts=${retryConfig.maxAttempts}, backoffMs=${retryConfig.backoffMs}`);

    const chunksDir = captureRaw
      ? path.join(ffmpegRawDir, 'chunks')
      : path.join(tempDir, 'chunks');
    fs.mkdirSync(chunksDir, { recursive: true });

    let rollingSummary = '';

    // Analyze each chunk sequentially (rolling-summary carry)
    for (const chunk of preflight.chunkPlan) {
      const chunkIndex = chunk.index;
      const startTime = chunk.startTime;
      const endTime = chunk.endTime;

      console.log(`   Analyzing chunk ${chunkIndex + 1}/${preflight.chunkPlan.length} (${startTime.toFixed(1)}s - ${endTime.toFixed(1)}s)...`);

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

      const prompt = buildRollingAnalysisPrompt(startTime, endTime, rollingSummary, recoveryRuntime);
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
                apiKey,
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
                rollingSummary: toolLoopResult.parsed.rollingSummary
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

    // Build music data
    const musicData = {
      segments,
      summary: rollingSummary || generateSummary(segments),
      hasMusic
    };

    // Write intermediate artifact to phase directory
    const artifactPath = path.join(phaseDir, 'music-data.json');
    fs.writeFileSync(artifactPath, JSON.stringify(musicData, null, 2));
    events.artifactWrite({ absolutePath: artifactPath, role: 'artifact', phase: PHASE_KEY, script: SCRIPT_ID });

    console.log('   ✅ Music/audio analysis complete');
    console.log(`      Output: ${artifactPath}`);
    console.log(`      Found ${segments.length} segment(s)`);
    console.log(`      Music detected: ${hasMusic ? 'Yes' : 'No'}`);

    return {
      artifacts: {
        musicData
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

function buildRollingAnalysisPrompt(startTime, endTime, rollingSummary, recoveryRuntime = null) {
  const roll = typeof rollingSummary === 'string' && rollingSummary.trim().length > 0
    ? rollingSummary.trim()
    : null;

  const prompt = `Analyze the audio in this chunk (${startTime.toFixed(1)}s to ${endTime.toFixed(1)}s).

${roll ? `Rolling summary so far (from previous chunks):\n${roll}\n\n` : ''}Identify:
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
  "rollingSummary": "Updated rolling summary for the entire audio so far (keep concise)"
}

Allowed values for analysis.type: music | speech | silence | ambient | sfx.
Allowed values for analysis.mood: upbeat | calm | tense | sad | energetic | neutral.`;

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

async function executeMusicAnalysisToolLoop({
  provider,
  adapter,
  basePrompt,
  toolLoopConfig,
  promptRef,
  events,
  ctx,
  apiKey,
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
      'Include rollingSummary when you have continuity context from prior chunks.'
    ],
    callProvider: ({ prompt }) => provider.complete({
      prompt,
      model: adapter?.model,
      apiKey,
      attachments: [
        {
          type: 'audio',
          data: audioBase64,
          mimeType: audioMimeType
        }
      ],
      options: buildProviderOptions({
        adapter,
        defaults: {
          temperature: 0.5
        }
      })
    }),
    executeValidatorTool: executeMusicAnalysisValidatorTool,
    normalizeValidatedValue: (value) => JSON.stringify(value)
  });
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
