#!/usr/bin/env node
/**
 * Get Dialogue Script
 * 
 * Extracts audio from video, transcribes speech, and identifies speakers.
 * This script runs in Phase 1 (Gather Context) of the pipeline.
 * 
 * Raw capture schema v2 parity (Phase2-style):
 * - attempt-scoped capture payloads (even if attempt is always 1 for now)
 * - legacy flat files preserved as pointer JSON
 * - phase error artifacts written to raw/_meta/errors.jsonl + errors.summary.json
 * 
 * @module scripts/get-context/get-dialogue
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
const storage = require('../../lib/storage/storage-interface.js');
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
  validateDialogueTranscriptionObject,
  validateDialogueStitchObject
} = require('../../lib/structured-output.cjs');
const {
  buildDialogueTranscriptionValidatorToolContract,
  executeDialogueTranscriptionValidatorTool,
  buildDialogueStitchValidatorToolContract,
  executeDialogueStitchValidatorTool
} = require('../../lib/phase1-validator-tools.cjs');
const { executeLocalValidatorToolLoop } = require('../../lib/local-validator-tool-loop.cjs');
const { applyFailureMetadata } = require('../../lib/tool-wrapper-contract.cjs');

const PHASE_KEY = 'phase1-gather-context';
const SCRIPT_ID = 'get-dialogue';

function pad(value, width) {
  return String(value).padStart(width, '0');
}

function clampNumber(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function countTranscriptWords(text) {
  return String(text || '').trim().split(/\s+/).filter(Boolean).length;
}

function estimateMinimumPlausibleSpeechDurationSeconds(text) {
  const wordCount = countTranscriptWords(text);
  if (wordCount <= 0) return 0;
  const FAST_SPEECH_WORDS_PER_SECOND = 6;
  return Math.max(0.35, wordCount / FAST_SPEECH_WORDS_PER_SECOND);
}

function shouldDropImplausiblyClippedDialogueSegment(segment, start, end, boundedDuration) {
  const originalStart = Number.isFinite(segment?.start) ? segment.start : null;
  const originalEnd = Number.isFinite(segment?.end) ? segment.end : null;

  if (!Number.isFinite(originalStart) || !Number.isFinite(originalEnd)) return false;
  if (originalEnd <= originalStart) return true;
  if (originalEnd <= boundedDuration) return false;

  const originalDuration = originalEnd - originalStart;
  const retainedDuration = end - start;
  const retainedRatio = originalDuration > 0 ? retainedDuration / originalDuration : 0;
  const minimumPlausibleDuration = estimateMinimumPlausibleSpeechDurationSeconds(segment?.text);

  return retainedRatio < 0.2 && retainedDuration < minimumPlausibleDuration;
}

function normalizeDialogueDataToDuration(dialogueData, actualDuration, { requireHandoff = false } = {}) {
  const boundedDuration = Number.isFinite(actualDuration) && actualDuration >= 0 ? actualDuration : 0;
  const inputSegments = Array.isArray(dialogueData?.dialogue_segments) ? dialogueData.dialogue_segments : [];

  const clampedSegments = inputSegments.map((segment) => {
    const start = Number.isFinite(segment?.start) ? clampNumber(segment.start, 0, boundedDuration) : 0;
    const end = Number.isFinite(segment?.end) ? clampNumber(segment.end, 0, boundedDuration) : start;

    if (end <= start) return null;
    if (shouldDropImplausiblyClippedDialogueSegment(segment, start, end, boundedDuration)) return null;

    return {
      ...segment,
      start,
      end
    };
  }).filter(Boolean);

  const normalized = validateDialogueTranscriptionObject({
    ...dialogueData,
    dialogue_segments: clampedSegments,
    totalDuration: boundedDuration
  }, { requireHandoff });

  if (!normalized.ok) {
    throw new Error(normalized.summary || 'Failed to normalize dialogue timing to source duration.');
  }

  return {
    ...normalized.value,
    ...(dialogueData?.cleanedTranscript ? { cleanedTranscript: dialogueData.cleanedTranscript } : {})
  };
}

function resolveDialogueChunkingPreflight(preflight, config = {}) {
  const durationSeconds = Number.isFinite(preflight?.durationSeconds) ? preflight.durationSeconds : 0;
  const maxWholeFileDurationSeconds = Number.isFinite(config?.settings?.dialogue_max_whole_file_duration_seconds)
    ? Math.max(5, config.settings.dialogue_max_whole_file_duration_seconds)
    : 60;

  if (preflight?.needsChunking || durationSeconds <= maxWholeFileDurationSeconds) {
    return preflight;
  }

  const forcedChunkDurationSeconds = Number.isFinite(config?.settings?.dialogue_forced_chunk_duration_seconds)
    ? Math.max(5, Math.min(config.settings.dialogue_forced_chunk_duration_seconds, durationSeconds))
    : Math.min(20, durationSeconds);

  const chunkPlan = planTimeChunks({
    durationSeconds,
    chunkDurationSeconds: forcedChunkDurationSeconds
  });

  return {
    ...preflight,
    needsChunking: true,
    recommendedChunkDurationSeconds: forcedChunkDurationSeconds,
    chunkPlan,
    trace: {
      ...preflight.trace,
      reason: 'dialogue_timing_force_chunking',
      originalReason: preflight.trace?.reason || null,
      maxWholeFileDurationSeconds,
      recommendedChunkDurationSeconds: forcedChunkDurationSeconds,
      chunks: chunkPlan.length
    }
  };
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

function getRetryConfig(config = {}, domain = 'dialogue') {
  const retry = config?.ai?.[domain]?.retry || {};

  return {
    maxAttempts: Number.isInteger(retry.maxAttempts) && retry.maxAttempts > 0 ? retry.maxAttempts : 1,
    backoffMs: Number.isInteger(retry.backoffMs) && retry.backoffMs >= 0 ? retry.backoffMs : 0
  };
}

function getToolLoopConfig(config = {}, domain = 'dialogue') {
  const toolLoop = config?.ai?.[domain]?.toolLoop || {};

  return {
    maxTurns: Number.isInteger(toolLoop.maxTurns) && toolLoop.maxTurns > 1 ? toolLoop.maxTurns : 4,
    maxValidatorCalls: Number.isInteger(toolLoop.maxValidatorCalls) && toolLoop.maxValidatorCalls > 0 ? toolLoop.maxValidatorCalls : 3
  };
}

function ensurePhaseErrorArtifacts({ captureRaw, rawMetaDir, events, phaseOutcome, fatalPhaseError, phaseErrors }) {
  if (!captureRaw) return;

  fs.mkdirSync(rawMetaDir, { recursive: true });
  const errorsPath = path.join(rawMetaDir, 'errors.jsonl');

  const lines = phaseErrors.length > 0
    ? phaseErrors.map((e) => JSON.stringify(e)).join('\n') + '\n'
    : '';
  // Rewrite the current script invocation snapshot so reruns do not inherit stale
  // phase error lines from previous executions using the same outputDir.
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
 * @typedef {Object} GetDialogueInput
 * @property {string} assetPath - Path to video/audio file
 * @property {string} outputDir - Output directory
 * @property {Object} [config] - Pipeline config
 */

/**
 * Script Output Contract
 * @typedef {Object} GetDialogueOutput
 * @property {Object} artifacts - Script artifacts
 * @property {Object} artifacts.dialogueData - Dialogue analysis results
 * @property {Array} artifacts.dialogueData.dialogue_segments - Dialogue segments
 * @property {string} artifacts.dialogueData.summary - Brief summary
 * @property {number} artifacts.dialogueData.totalDuration - Total duration in seconds
 */

/**
 * Main entry point
 * 
 * @async
 * @function run
 * @param {GetDialogueInput} input - Script input
 * @returns {Promise<GetDialogueOutput>} - Script output
 */
async function run(input) {
  const { assetPath, outputDir, config } = input;
  const recoveryRuntime = getRecoveryRuntime(input);

  console.log('   🎤 Extracting and transcribing dialogue from:', assetPath);

  // Create phase-aware output directory
  const phaseDir = outputManager.createPhaseDirectory(outputDir, PHASE_KEY);

  // Create assets directory for processed files (canonical run-level assets)
  const assetsDirs = outputManager.createAssetsDirectory(outputDir);

  // Create temp directory for audio extraction in assets/processed/dialogue/
  const tempDir = path.join(assetsDirs.processedDir, 'dialogue');
  fs.mkdirSync(tempDir, { recursive: true });

  // Default to keeping processed/intermediate files unless explicitly disabled
  const keepProcessedIntermediates = shouldKeepProcessedIntermediates(config);
  const captureRaw = shouldCaptureRaw(config);

  const events = getEventsLogger({ outputDir, config });
  events.emit({ kind: 'script.start', phase: PHASE_KEY, script: SCRIPT_ID });

  const rawDir = getRawPhaseDir(outputDir, PHASE_KEY);
  const rawMetaDir = path.join(rawDir, '_meta');
  const ffmpegRawDir = path.join(rawDir, 'ffmpeg', 'dialogue');
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

  const writeDialogueRaw = (attempt, payload) => {
    if (!captureRaw) return;

    const attemptRelDir = path.join('dialogue-transcription', `attempt-${pad(attempt, 2)}`);
    const attemptRelPath = path.join(attemptRelDir, 'capture.json');

    // Schema v2: attempt-scoped capture payloads (do not overwrite retries)
    const capturePath = writeRawJson(aiRawDir, attemptRelPath, payload);
    events.artifactWrite({ absolutePath: capturePath, role: 'raw.ai.attempt', phase: PHASE_KEY, script: SCRIPT_ID });

    // Legacy pointer: keep dialogue-transcription.json as a pointer to latest attempt
    const pointerPath = writeRawJson(aiRawDir, 'dialogue-transcription.json', {
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

  let prompt = null;
  let promptRef = null;
  let response = null;
  let model = null;

  try {
    // Extract audio from video (if needed)
    const audioPath = await extractAudio(assetPath, tempDir, {
      captureRaw,
      ffmpegRawDir,
      logName: 'extract-audio.json',
      config
    });

    const preflight = resolveDialogueChunkingPreflight(preflightAudio({
      audioPath,
      config,
      rawCapture: {
        captureRaw,
        rawLogger: (payload) => writeRawJson(ffmpegRawDir, 'ffprobe-audio-duration.json', payload)
      }
    }), config);

    events.emit({
      kind: 'audio.preflight',
      phase: PHASE_KEY,
      script: SCRIPT_ID,
      domain: 'dialogue',
      trace: preflight.trace
    });

    if (captureRaw) {
      const planPath = writeRawJson(ffmpegRawDir, 'chunk-plan.json', {
        schemaVersion: 1,
        kind: 'audio.chunk.plan',
        domain: 'dialogue',
        createdAt: new Date().toISOString(),
        trace: preflight.trace,
        chunks: preflight.chunkPlan
      });
      events.artifactWrite({ absolutePath: planPath, role: 'raw.ffmpeg.plan', phase: PHASE_KEY, script: SCRIPT_ID });
    }

    // config.ai.dialogue.targets[*].adapter.model is required (validated by config-loader)

    const apiKey = process.env.AI_API_KEY;
    if (!apiKey) {
      throw new Error('GetDialogue: AI_API_KEY environment variable is required');
    }

    const retryConfig = getRetryConfig(config, 'dialogue');
    const toolLoopConfig = getToolLoopConfig(config, 'dialogue');

    const writeDialogueChunkRaw = (chunkIndex, attempt, payload) => {
      if (!captureRaw) return;

      const chunkLabel = `chunk-${pad(chunkIndex, 4)}`;
      const attemptRelDir = path.join('dialogue-chunks', chunkLabel, `attempt-${pad(attempt, 2)}`);
      const attemptRelPath = path.join(attemptRelDir, 'capture.json');

      const capturePath = writeRawJson(aiRawDir, attemptRelPath, payload);
      events.artifactWrite({ absolutePath: capturePath, role: 'raw.ai.attempt', phase: PHASE_KEY, script: SCRIPT_ID });

      const pointerPath = writeRawJson(aiRawDir, `dialogue-${chunkLabel}.json`, {
        schemaVersion: 2,
        kind: 'pointer',
        updatedAt: new Date().toISOString(),
        chunkIndex,
        latestAttempt: attempt,
        target: {
          dir: attemptRelDir,
          file: attemptRelPath
        }
      });
      events.artifactWrite({ absolutePath: pointerPath, role: 'raw.ai.pointer', phase: PHASE_KEY, script: SCRIPT_ID });
    };

    const makeChunkHandoffFallback = (segments) => {
      if (!Array.isArray(segments) || segments.length === 0) return '';
      const tail = segments.slice(Math.max(0, segments.length - 4));
      return tail.map((s) => {
        const speaker = s?.speaker ? String(s.speaker) : 'Speaker';
        const text = s?.text ? String(s.text) : '';
        return `${speaker}: ${text}`.trim();
      }).join('\n');
    };

    const buildStructuredSpeakerHandoff = ({ speakerProfiles = [], segments = [] } = {}) => {
      const lines = [];
      const normalizedProfiles = Array.isArray(speakerProfiles) ? speakerProfiles : [];
      const normalizedSegments = Array.isArray(segments) ? segments : [];

      if (normalizedProfiles.length > 0) {
        lines.push('Speaker registry (reuse speaker_id only for the same acoustic voice):');
        for (const profile of normalizedProfiles) {
          const speakerId = typeof profile?.speaker_id === 'string' && profile.speaker_id.trim().length > 0
            ? profile.speaker_id.trim()
            : null;
          if (!speakerId) continue;

          const label = typeof profile?.label === 'string' && profile.label.trim().length > 0
            ? profile.label.trim()
            : 'Speaker';
          const descriptors = Array.isArray(profile?.grounded?.acoustic_descriptors)
            ? profile.grounded.acoustic_descriptors
                .map((entry) => typeof entry?.label === 'string' ? entry.label.trim() : '')
                .filter(Boolean)
                .slice(0, 3)
            : [];
          const traits = Array.isArray(profile?.inferred_traits?.traits)
            ? profile.inferred_traits.traits
                .map((entry) => {
                  const trait = typeof entry?.trait === 'string' ? entry.trait.trim() : '';
                  const value = typeof entry?.value === 'string' ? entry.value.trim() : '';
                  return trait && value ? `${trait}: ${value}` : '';
                })
                .filter(Boolean)
                .slice(0, 2)
            : [];
          const recentSample = normalizedSegments
            .filter((segment) => segment?.speaker_id === speakerId)
            .slice(-2)
            .map((segment) => typeof segment?.text === 'string' ? segment.text.trim() : '')
            .filter(Boolean)
            .join(' / ');

          const parts = [`- ${speakerId} => ${label}`];
          if (descriptors.length > 0) parts.push(`acoustic cues: ${descriptors.join('; ')}`);
          if (traits.length > 0) parts.push(`inferred traits: ${traits.join('; ')}`);
          if (recentSample) parts.push(`recent lines: ${recentSample}`);
          lines.push(parts.join(' | '));
        }
      }

      const tail = normalizedSegments.slice(Math.max(0, normalizedSegments.length - 4));
      if (tail.length > 0) {
        if (lines.length > 0) lines.push('');
        lines.push('Recent dialogue tail:');
        for (const segment of tail) {
          const speakerId = typeof segment?.speaker_id === 'string' && segment.speaker_id.trim().length > 0
            ? ` (${segment.speaker_id.trim()})`
            : '';
          const speaker = segment?.speaker ? String(segment.speaker).trim() : 'Speaker';
          const text = segment?.text ? String(segment.text).trim() : '';
          lines.push(`- ${speaker}${speakerId}: ${text}`.trim());
        }
      }

      return lines.join('\n').trim();
    };

    if (!preflight.needsChunking) {
      // --------------------
      // Within-budget path
      // --------------------
      // Convert audio to base64 for AI provider
      const audioBase64 = fs.readFileSync(audioPath).toString('base64');
      const audioMimeType = getAudioMimeType(config);

      // Build transcription prompt
      prompt = buildTranscriptionPrompt(recoveryRuntime);

      promptRef = captureRaw
        ? storePromptPayload({ outputDir, payload: prompt })
        : null;

      if (promptRef?.absolutePath) {
        events.artifactWrite({ absolutePath: promptRef.absolutePath, role: 'raw.prompt', phase: PHASE_KEY, script: SCRIPT_ID });
      }

      console.log(`   🔁 Dialogue retry config: attempts=${retryConfig.maxAttempts}, backoffMs=${retryConfig.backoffMs}`);

      // Call AI provider for transcription (targets + consolidated retries)
      console.log('   🤖 Calling AI provider for transcription...');

      const attemptStartMs = new Map();

      const { result: dialogueResult, meta } = await executeWithTargets({
        config,
        domain: 'dialogue',
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
              domain: 'dialogue',
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
            domain: 'dialogue',
            attempt: ctx.attempt,
            attemptInTarget: ctx.attemptInTarget,
            targetIndex: ctx.targetIndex,
            targetCount: ctx.targetCount,
            provider: adapter?.name || null,
            model: adapter?.model || null,
          });

          try {
            const toolLoopResult = await executeDialogueTranscriptionToolLoop({
              provider,
              adapter,
              basePrompt: prompt,
              toolLoopConfig,
              promptRef,
              events,
              ctx,
              apiKey,
              audioBase64,
              audioMimeType,
              requireHandoff: false,
              finalArtifactRules: [
                'Identify speakers as Speaker 1, Speaker 2, etc. for human-readable labels, while reusing anonymous speaker_id values for same-speaker linkage.',
                'Provide accurate timestamps in seconds.',
                'Keep grounded speaker identity separate from any inferred_traits guesswork.',
                'If no speech is detected, return an empty dialogue_segments array.'
              ]
            });

            events.emit({
              kind: 'provider.call.end',
              phase: PHASE_KEY,
              script: SCRIPT_ID,
              domain: 'dialogue',
              attempt: ctx.attempt,
              attemptInTarget: ctx.attemptInTarget,
              targetIndex: ctx.targetIndex,
              ok: true,
              durationMs: Date.now() - providerCallStart,
              provider: adapter?.name || null,
              model: adapter?.model || null,
            });

            const actualDuration = preflight.durationSeconds;
            const dialogueData = normalizeDialogueDataToDuration(toolLoopResult.parsed, actualDuration);

            return { completion: toolLoopResult.completion, dialogueData, toolLoop: toolLoopResult.toolLoop };
          } catch (error) {
            events.emit({
              kind: 'provider.call.end',
              phase: PHASE_KEY,
              script: SCRIPT_ID,
              domain: 'dialogue',
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
            domain: 'dialogue',
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

          writeDialogueRaw(attempt, {
            attempt,
            attemptInTarget,
            targetIndex,
            targetCount,
            adapter,
            failover: failover || null,
            promptRef: promptRef ? { sha256: promptRef.sha256, file: promptRef.file } : null,
            rawResponse: ok ? sanitizeRawCaptureValue(result?.completion) : null,
            parsed: ok ? result?.dialogueData : null,
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
              attempt,
              attemptInTarget,
              targetIndex,
              targetCount
            }
          });
        }
      });

      response = dialogueResult?.completion || null;
      const dialogueData = dialogueResult.dialogueData;
      model = meta?.target?.adapter?.model || null;

      // Write intermediate artifact to phase directory
      const artifactPath = path.join(phaseDir, 'dialogue-data.json');
      fs.writeFileSync(artifactPath, JSON.stringify(dialogueData, null, 2));
      events.artifactWrite({ absolutePath: artifactPath, role: 'artifact', phase: PHASE_KEY, script: SCRIPT_ID });

      console.log('   ✅ Dialogue extraction complete');
      console.log(`      Output: ${artifactPath}`);
      console.log(`      Found ${dialogueData.dialogue_segments.length} dialogue segments`);
      console.log(`      Total duration: ${dialogueData.totalDuration.toFixed(1)}s`);

      return {
        artifacts: {
          dialogueData
        }
      };
    }

    // --------------------
    // Over-budget path: chunk + rolling handoff + REQUIRED stitcher
    // --------------------
    if (!config?.ai?.dialogue_stitch?.targets || !Array.isArray(config.ai.dialogue_stitch.targets) || config.ai.dialogue_stitch.targets.length === 0) {
      throw new Error('GetDialogue: chunking requires config.ai.dialogue_stitch.targets (OpenRouter-only stitcher chain)');
    }

    const chunksDir = captureRaw
      ? path.join(ffmpegRawDir, 'chunks')
      : path.join(tempDir, 'chunks');
    fs.mkdirSync(chunksDir, { recursive: true });

    const chunkSegments = [];
    const chunkSpeakerProfiles = [];
    const chunkSummaries = [];
    const debugChunkRefs = [];

    let rollingHandoff = '';

    const chunkingReason = preflight.trace?.reason === 'dialogue_timing_force_chunking'
      ? `timing-stability guard over ${preflight.trace?.maxWholeFileDurationSeconds ?? 'unknown'}s`
      : 'Base64 budget';
    console.log(`   🧩 Dialogue chunking enabled via ${chunkingReason}, chunking into ${preflight.chunkPlan.length} chunks (~${preflight.recommendedChunkDurationSeconds.toFixed(1)}s each)`);

    for (const chunk of preflight.chunkPlan) {
      const { index: chunkIndex, startTime, endTime } = chunk;

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
      const audioMimeType = getAudioMimeType(config);

      const chunkPrompt = buildChunkTranscriptionPrompt({
        chunkIndex,
        startTime,
        endTime,
        priorHandoff: rollingHandoff,
        recoveryRuntime
      });

      const chunkPromptRef = captureRaw
        ? storePromptPayload({ outputDir, payload: chunkPrompt })
        : null;

      if (chunkPromptRef?.absolutePath) {
        events.artifactWrite({ absolutePath: chunkPromptRef.absolutePath, role: 'raw.prompt', phase: PHASE_KEY, script: SCRIPT_ID });
      }

      const attemptStartMs = new Map();

      const { result: chunkResult } = await executeWithTargets({
        config,
        domain: 'dialogue',
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
              domain: 'dialogue',
              chunkIndex,
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
            domain: 'dialogue',
            chunkIndex,
            attempt: ctx.attempt,
            attemptInTarget: ctx.attemptInTarget,
            targetIndex: ctx.targetIndex,
            targetCount: ctx.targetCount,
            provider: adapter?.name || null,
            model: adapter?.model || null,
          });

          try {
            const toolLoopResult = await executeDialogueTranscriptionToolLoop({
              provider,
              adapter,
              basePrompt: chunkPrompt,
              toolLoopConfig,
              promptRef: chunkPromptRef,
              events,
              ctx,
              apiKey,
              audioBase64,
              audioMimeType,
              requireHandoff: true,
              finalArtifactRules: [
                'Timestamps must be relative to this chunk and start at 0.',
                'Keep speaker labels and anonymous speaker_id values consistent with the prior handoff when possible.',
                'Keep grounded speaker identity separate from any inferred_traits guesswork.',
                'handoffContext must stay brief and continuity-focused.'
              ]
            });

            events.emit({
              kind: 'provider.call.end',
              phase: PHASE_KEY,
              script: SCRIPT_ID,
              domain: 'dialogue',
              chunkIndex,
              attempt: ctx.attempt,
              attemptInTarget: ctx.attemptInTarget,
              targetIndex: ctx.targetIndex,
              ok: true,
              durationMs: Date.now() - providerCallStart,
              provider: adapter?.name || null,
              model: adapter?.model || null,
            });

            const actualDuration = endTime - startTime;
            const dialogueData = normalizeDialogueDataToDuration(toolLoopResult.parsed, actualDuration, { requireHandoff: true });

            return { completion: toolLoopResult.completion, dialogueData, toolLoop: toolLoopResult.toolLoop };
          } catch (error) {
            events.emit({
              kind: 'provider.call.end',
              phase: PHASE_KEY,
              script: SCRIPT_ID,
              domain: 'dialogue',
              chunkIndex,
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
            domain: 'dialogue',
            chunkIndex,
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

          writeDialogueChunkRaw(chunkIndex, attempt, {
            chunkIndex,
            startTime,
            endTime,
            rollingHandoffIn: rollingHandoff || null,
            attempt,
            attemptInTarget,
            targetIndex,
            targetCount,
            adapter,
            failover: failover || null,
            promptRef: chunkPromptRef ? { sha256: chunkPromptRef.sha256, file: chunkPromptRef.file } : null,
            rawResponse: ok ? sanitizeRawCaptureValue(result?.completion) : null,
            parsed: ok ? result?.dialogueData : null,
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
              chunkIndex,
              attempt,
              attemptInTarget,
              targetIndex,
              targetCount
            }
          });
        }
      });

      const parsed = chunkResult.dialogueData;
      const segments = Array.isArray(parsed.dialogue_segments) ? parsed.dialogue_segments : [];
      const segmentIndexOffset = chunkSegments.length;

      const offsetSegments = segments.map((seg) => ({
        ...seg,
        start: typeof seg.start === 'number' ? seg.start + startTime : startTime,
        end: typeof seg.end === 'number' ? seg.end + startTime : endTime
      }));

      chunkSegments.push(...offsetSegments);

      const profiles = Array.isArray(parsed.speaker_profiles) ? parsed.speaker_profiles : [];
      const offsetProfiles = profiles.map((profile) => ({
        ...profile,
        grounded: {
          ...(profile?.grounded || {}),
          linked_segment_indexes: Array.isArray(profile?.grounded?.linked_segment_indexes)
            ? profile.grounded.linked_segment_indexes
                .map((value) => Number.isFinite(value) ? Math.trunc(value) + segmentIndexOffset : null)
                .filter((value) => value !== null)
            : []
        }
      }));
      chunkSpeakerProfiles.push(...offsetProfiles);

      chunkSummaries.push({
        chunkIndex,
        startTime,
        endTime,
        summary: parsed.summary || null
      });

      const handoff = buildStructuredSpeakerHandoff({
        speakerProfiles: chunkSpeakerProfiles,
        segments: chunkSegments
      }) || parsed.handoffContext || makeChunkHandoffFallback(segments);
      rollingHandoff = String(handoff || '').trim();

      debugChunkRefs.push({
        chunkIndex,
        startTime,
        endTime,
        audioPath: extraction.chunkPath,
        promptRef: chunkPromptRef ? chunkPromptRef.file : null
      });
    }

    // Mechanical stitched transcript (best-effort)
    const mechanicalLines = [];
    for (const chunk of preflight.chunkPlan) {
      mechanicalLines.push(`--- CHUNK ${chunk.index} [${chunk.startTime.toFixed(2)}s - ${chunk.endTime.toFixed(2)}s] ---`);
      const segs = chunkSegments.filter((s) => s.start < chunk.endTime && s.end > chunk.startTime);
      for (const seg of segs) {
        mechanicalLines.push(`[${seg.start.toFixed(2)}-${seg.end.toFixed(2)}] ${seg.speaker || 'Speaker'}: ${seg.text || ''}`.trim());
      }
      mechanicalLines.push('');
    }

    const stitchRawDir = path.join(aiRawDir, 'dialogue-stitch');
    const mechanicalTranscript = mechanicalLines.join('\n').trim() + '\n';

    if (captureRaw) {
      fs.mkdirSync(stitchRawDir, { recursive: true });
      const mechanicalPath = path.join(stitchRawDir, 'mechanical-transcript.txt');
      fs.writeFileSync(mechanicalPath, mechanicalTranscript, 'utf8');
      events.artifactWrite({ absolutePath: mechanicalPath, role: 'raw.ai.stitch.input', phase: PHASE_KEY, script: SCRIPT_ID });
    }

    const stitchInput = {
      schemaVersion: 1,
      kind: 'dialogue.stitch.input',
      createdAt: new Date().toISOString(),
      preflight: preflight.trace,
      chunks: chunkSummaries,
      debugRefs: debugChunkRefs.map((ref) => ({
        chunkIndex: ref.chunkIndex,
        startTime: ref.startTime,
        endTime: ref.endTime,
        audioPath: ref.audioPath ? path.relative(events.runOutputDir || outputDir, ref.audioPath).split(path.sep).join('/') : null,
        promptRef: ref.promptRef
      })),
      mechanicalTranscript
    };

    const stitchInputPath = captureRaw
      ? writeRawJson(stitchRawDir, 'input.json', stitchInput)
      : null;

    if (stitchInputPath) {
      events.artifactWrite({ absolutePath: stitchInputPath, role: 'raw.ai.stitch.input', phase: PHASE_KEY, script: SCRIPT_ID });
    }

    const stitcherRetry = getRetryConfig(config, 'dialogue_stitch');
    const stitcherToolLoopConfig = getToolLoopConfig(config, 'dialogue_stitch');

    const stitcherPrompt = buildDialogueStitcherPrompt(stitchInput, recoveryRuntime);
    const stitcherPromptRef = captureRaw
      ? storePromptPayload({ outputDir, payload: stitcherPrompt })
      : null;

    if (stitcherPromptRef?.absolutePath) {
      events.artifactWrite({ absolutePath: stitcherPromptRef.absolutePath, role: 'raw.prompt', phase: PHASE_KEY, script: SCRIPT_ID });
    }

    const stitchAttemptStartMs = new Map();

    const writeStitchRaw = (attempt, payload) => {
      if (!captureRaw) return;

      const attemptRelDir = path.join('dialogue-stitch', `attempt-${pad(attempt, 2)}`);
      const attemptRelPath = path.join(attemptRelDir, 'capture.json');

      const capturePath = writeRawJson(aiRawDir, attemptRelPath, payload);
      events.artifactWrite({ absolutePath: capturePath, role: 'raw.ai.attempt', phase: PHASE_KEY, script: SCRIPT_ID });

      const pointerPath = writeRawJson(aiRawDir, 'dialogue-stitch.json', {
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

    const { result: stitchResult, meta: stitchMeta } = await executeWithTargets({
      config,
      domain: 'dialogue_stitch',
      retry: stitcherRetry,
      operation: async (ctx) => {
        const adapter = ctx?.target?.adapter;
        const attemptKey = String(ctx?.attempt || '');

        if (attemptKey && !stitchAttemptStartMs.has(attemptKey)) {
          stitchAttemptStartMs.set(attemptKey, Date.now());
          events.emit({
            kind: 'attempt.start',
            phase: PHASE_KEY,
            script: SCRIPT_ID,
            domain: 'dialogue_stitch',
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
          domain: 'dialogue_stitch',
          attempt: ctx.attempt,
          attemptInTarget: ctx.attemptInTarget,
          targetIndex: ctx.targetIndex,
          targetCount: ctx.targetCount,
          provider: adapter?.name || null,
          model: adapter?.model || null,
        });

        try {
          const toolLoopResult = await executeDialogueStitchToolLoop({
            provider,
            adapter,
            basePrompt: stitcherPrompt,
            toolLoopConfig: stitcherToolLoopConfig,
            promptRef: stitcherPromptRef,
            events,
            ctx,
            apiKey
          });

          events.emit({
            kind: 'provider.call.end',
            phase: PHASE_KEY,
            script: SCRIPT_ID,
            domain: 'dialogue_stitch',
            attempt: ctx.attempt,
            attemptInTarget: ctx.attemptInTarget,
            targetIndex: ctx.targetIndex,
            ok: true,
            durationMs: Date.now() - providerCallStart,
            provider: adapter?.name || null,
            model: adapter?.model || null,
          });

          return { completion: toolLoopResult.completion, parsed: toolLoopResult.parsed, toolLoop: toolLoopResult.toolLoop };
        } catch (error) {
          events.emit({
            kind: 'provider.call.end',
            phase: PHASE_KEY,
            script: SCRIPT_ID,
            domain: 'dialogue_stitch',
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
        const startedAt = attemptKey && stitchAttemptStartMs.has(attemptKey) ? stitchAttemptStartMs.get(attemptKey) : null;

        const persistedError = ok ? null : getPersistedErrorInfo(error);

        events.emit({
          kind: 'attempt.end',
          phase: PHASE_KEY,
          script: SCRIPT_ID,
          domain: 'dialogue_stitch',
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

        writeStitchRaw(attempt, {
          attempt,
          attemptInTarget,
          targetIndex,
          targetCount,
          adapter,
          failover: failover || null,
          promptRef: stitcherPromptRef ? { sha256: stitcherPromptRef.sha256, file: stitcherPromptRef.file } : null,
          stitchInputRef: stitchInputPath ? path.relative(events.runOutputDir || outputDir, stitchInputPath).split(path.sep).join('/') : null,
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
            attempt,
            attemptInTarget,
            targetIndex,
            targetCount
          }
        });
      }
    });

    const stitchParsed = stitchResult.parsed || {};

    const stitchOutputPath = captureRaw
      ? writeRawJson(stitchRawDir, 'output.json', stitchParsed)
      : null;

    if (stitchOutputPath) {
      events.artifactWrite({ absolutePath: stitchOutputPath, role: 'raw.ai.stitch.output', phase: PHASE_KEY, script: SCRIPT_ID });
    }

    const cleanedTranscript = typeof stitchParsed.cleanedTranscript === 'string'
      ? stitchParsed.cleanedTranscript
      : (typeof stitchParsed.cleaned_transcript === 'string' ? stitchParsed.cleaned_transcript : null);

    const normalizedDialogueValidation = validateDialogueTranscriptionObject({
      dialogue_segments: chunkSegments,
      speaker_profiles: chunkSpeakerProfiles,
      summary: cleanedTranscript || 'Chunked transcription completed',
      totalDuration: preflight.durationSeconds,
      ...(rollingHandoff ? { handoffContext: rollingHandoff } : {})
    });

    if (!normalizedDialogueValidation.ok) {
      throw new Error(normalizedDialogueValidation.summary || 'Failed to normalize chunked dialogue contract.');
    }

    const dialogueData = {
      ...normalizedDialogueValidation.value,
      ...(cleanedTranscript ? { cleanedTranscript } : {})
    };

    model = stitchMeta?.target?.adapter?.model || null;

    // Write intermediate artifact to phase directory
    const artifactPath = path.join(phaseDir, 'dialogue-data.json');
    fs.writeFileSync(artifactPath, JSON.stringify(dialogueData, null, 2));
    events.artifactWrite({ absolutePath: artifactPath, role: 'artifact', phase: PHASE_KEY, script: SCRIPT_ID });

    console.log('   ✅ Dialogue extraction complete (chunked)');
    console.log(`      Output: ${artifactPath}`);
    console.log(`      Found ${dialogueData.dialogue_segments.length} dialogue segments`);
    console.log(`      Total duration: ${dialogueData.totalDuration.toFixed(1)}s`);

    return {
      artifacts: {
        dialogueData
      }
    };
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
      errorClassification: persistedError.classification
    });

    // AI attempts (including errors) are captured via executeWithTargets(onAttempt).

    console.error('   ❌ Error extracting dialogue:', error.message);
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
      console.log(`   💾 Keeping dialogue temp files in ${tempDir}`);
    } else {
      // Clean up temp files
      try {
        if (fs.existsSync(tempDir)) {
          fs.rmSync(tempDir, { recursive: true, force: true });
        }
      } catch (e) {
        console.warn('   ⚠️  Warning: Failed to cleanup dialogue temp files:', e.message);
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
 * Build transcription prompt for AI
 * 
 * @function buildTranscriptionPrompt
 * @returns {string} - Transcription prompt
 */
function buildTranscriptionPrompt(recoveryRuntime = null) {
  const prompt = `Transcribe the audio in this file. Identify different speakers and provide timestamps.

Respond with a JSON object in the following format:

\`\`\`json
{
  "dialogue_segments": [
    {
      "start": 0.0,
      "end": 5.2,
      "speaker": "Speaker 1",
      "speaker_id": "spk_001",
      "text": "Transcribed text here",
      "confidence": 0.95
    }
  ],
  "speaker_profiles": [
    {
      "speaker_id": "spk_001",
      "label": "Speaker 1",
      "grounded": {
        "confidence": 0.82,
        "linked_segment_indexes": [0],
        "acoustic_descriptors": [
          { "label": "steady, conversational delivery", "confidence": 0.61 }
        ]
      },
      "inferred_traits": {
        "traits": [
          {
            "trait": "accent",
            "value": "possibly mid-Atlantic American English",
            "confidence": 0.31,
            "note": "speculative inference from delivery only"
          }
        ]
      }
    }
  ],
  "summary": "Brief summary of the dialogue content",
  "totalDuration": 30.5
}
\`\`\`

IMPORTANT:
- Return JSON only. No markdown or explanation.
- Identify speakers as "Speaker 1", "Speaker 2", etc. for display labels, but also reuse anonymous speaker_id values like "spk_001" when segments belong to the same acoustic voice.
- Provide accurate timestamps in seconds.
- Include confidence scores from 0.0 to 1.0.
- Keep grounded speaker identity separate from inferred_traits.
- Grounded data should only include anonymous speaker IDs, same-speaker linkage, and cautious acoustic descriptors that are actually supported by the audio.
- Do not persist acoustic_descriptors_abstained. If you cannot support any acoustic descriptor, return an empty acoustic_descriptors array.
- inferred_traits must always be present as an object with a traits array. Keep it clearly speculative / non-authoritative and attempt reviewable traits for each speaker when the audio supports them; otherwise return an empty traits array.
- If a later line sounds like a different voice, do not reuse the old speaker_id just because the scene context mentions the same character.
- Do not compress the whole file's dialogue into the opening seconds; place each line where it actually occurs in the full timeline.
- If no speech is detected, return an empty dialogue_segments array.`;

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

function parseDialogueStitchResponse(responseContent) {
  const parsed = parseAndValidateJsonObject(responseContent, validateDialogueStitchObject);
  if (!parsed.ok) {
    throw createRetryableError(`invalid_output: ${parsed.summary || 'dialogue stitch output was invalid'}`, {
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

async function executeDialogueTranscriptionToolLoop({
  provider,
  adapter,
  basePrompt,
  toolLoopConfig,
  promptRef,
  events,
  ctx,
  apiKey,
  audioBase64,
  audioMimeType,
  requireHandoff = false,
  finalArtifactRules = []
}) {
  const toolContract = buildDialogueTranscriptionValidatorToolContract({ requireHandoff });

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
    domain: 'dialogue',
    artifactLabel: requireHandoff ? 'dialogue transcription chunk' : 'dialogue transcription',
    finalArtifactDescription: requireHandoff
      ? 'The final artifact must include handoffContext so the next chunk can preserve continuity.'
      : 'The final artifact must be the full dialogue transcription JSON object.',
    finalArtifactRules,
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
          temperature: 0.3
        }
      })
    }),
    executeValidatorTool: (args) => executeDialogueTranscriptionValidatorTool(args, { requireHandoff }),
    normalizeValidatedValue: (value) => JSON.stringify(value)
  });
}

async function executeDialogueStitchToolLoop({
  provider,
  adapter,
  basePrompt,
  toolLoopConfig,
  promptRef,
  events,
  ctx,
  apiKey
}) {
  const toolContract = buildDialogueStitchValidatorToolContract();

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
    domain: 'dialogue_stitch',
    artifactLabel: 'dialogue stitch',
    finalArtifactDescription: 'The final artifact must be the cleaned stitched transcript JSON object.',
    finalArtifactRules: [
      'Keep meaning intact and do not invent dialogue.',
      'auditTrail must describe the major stitch operations that were actually applied.'
    ],
    callProvider: ({ prompt }) => provider.complete({
      prompt,
      model: adapter?.model,
      apiKey,
      options: buildProviderOptions({
        adapter,
        defaults: {
          temperature: 0.2
        }
      })
    }),
    executeValidatorTool: executeDialogueStitchValidatorTool,
    normalizeValidatedValue: (value) => JSON.stringify(value)
  });
}

function buildChunkTranscriptionPrompt({ chunkIndex, startTime, endTime, priorHandoff, recoveryRuntime = null } = {}) {
  const handoff = typeof priorHandoff === 'string' && priorHandoff.trim().length > 0
    ? priorHandoff.trim()
    : null;

  const prompt = `You are transcribing CHUNK ${chunkIndex} of a longer audio file.

Chunk time window: ${Number(startTime).toFixed(2)}s to ${Number(endTime).toFixed(2)}s (global timeline).

${handoff ? `Context from previous chunk (handoff):\n${handoff}\n\n` : ''}Transcribe the audio in this chunk. Identify different speakers and provide timestamps.

Return JSON only with this structure:

{
  "dialogue_segments": [
    {
      "start": 0.0,
      "end": 5.2,
      "speaker": "Speaker 1",
      "speaker_id": "spk_001",
      "text": "Transcribed text here",
      "confidence": 0.95
    }
  ],
  "speaker_profiles": [
    {
      "speaker_id": "spk_001",
      "label": "Speaker 1",
      "grounded": {
        "confidence": 0.82,
        "linked_segment_indexes": [0],
        "acoustic_descriptors": [
          { "label": "steady, conversational delivery", "confidence": 0.61 }
        ]
      },
      "inferred_traits": {
        "traits": [
          {
            "trait": "age_range",
            "value": "likely adult",
            "confidence": 0.28,
            "note": "speculative inference from voice only"
          }
        ]
      }
    }
  ],
  "summary": "Brief summary for THIS chunk",
  "handoffContext": "Short handoff to help the next chunk keep continuity (entities, speaker mapping, last lines)",
  "totalDuration": 30.5
}

Rules:
- Return JSON only. No markdown.
- Timestamps (start/end) MUST be relative to this CHUNK, starting at 0.
- Treat the handoff speaker registry as the continuity memory. Reuse a prior speaker_id only when the current voice still matches that prior acoustic profile.
- If the voice sounds different from the prior registry entry, create a new speaker_id instead of forcing continuity.
- Keep grounded speaker identity separate from inferred_traits.
- Do not persist acoustic_descriptors_abstained. If you cannot support any acoustic descriptor, return an empty acoustic_descriptors array.
- inferred_traits must always be present as an object with a traits array. Keep it speculative, and attempt reviewable traits for each speaker when the chunk supports them; otherwise leave traits as an empty array.
- Do not compress the whole chunk's dialogue into the opening seconds; spread timestamps across the actual chunk timeline where lines occur.
- If no speech is detected, return an empty dialogue_segments array.
- Keep handoffContext brief (<= ~10 lines).`;

  return `${prompt}${buildRecoveryPromptAddendum(recoveryRuntime)}`;
}

function buildDialogueStitcherPrompt(stitchInput, recoveryRuntime = null) {
  // The stitcher is text-only and must return structured JSON.
  const prompt = `You are a dialogue transcript stitcher.

You are given a mechanically-stitched transcript with chunk boundaries. Your job is to:
- produce a cleaned, readable transcript (fix punctuation, remove duplicated boundary fragments, normalize speaker labels)
- keep meaning intact; do NOT invent content
- provide an audit trail of the main merge operations and assumptions
- include debugging references/payloads so downstream tooling can trace back

Return JSON only with this structure:

{
  "cleanedTranscript": "...",
  "auditTrail": [
    { "op": "merge_boundary", "chunkIndex": 3, "detail": "Removed duplicated phrase at boundary" }
  ],
  "debug": {
    "inputKind": "dialogue.stitch.input",
    "inputChunks": 0,
    "notes": "any notes",
    "refs": []
  }
}

Allowed values for debug.inputKind: dialogue.stitch.input.

Here is the stitch input (including mechanical transcript):
${JSON.stringify(stitchInput, null, 2)}
`;

  return `${prompt}${buildRecoveryPromptAddendum(recoveryRuntime)}`;
}

/**
 * Parse AI transcription response
 * 
 * @function parseTranscriptionResponse
 * @param {string} responseContent - AI response content
 * @param {string} audioPath - Path to audio file (for duration calculation)
 * @returns {Object} - Parsed dialogue data
 */
function parseTranscriptionResponse(responseContent, audioPath, rawCapture = {}, { requireHandoff = false } = {}) {
  const parsed = parseAndValidateJsonObject(
    responseContent,
    (value) => validateDialogueTranscriptionObject(value, { requireHandoff })
  );

  if (!parsed.ok) {
    throw createRetryableError(`invalid_output: ${parsed.summary || 'dialogue transcription output was invalid'}`, {
      group: parsed.meta?.stage || 'parse',
      raw: parsed.meta?.raw || responseContent || null,
      extracted: parsed.meta?.extracted || null,
      parseError: parsed.meta?.parseError || null,
      validationErrors: parsed.errors,
      validationSummary: parsed.summary
    });
  }

  return {
    ...parsed.value,
    totalDuration: typeof parsed.value.totalDuration === 'number'
      ? parsed.value.totalDuration
      : getAudioDuration(audioPath, rawCapture)
  };
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
      writeRawJson(rawCapture.ffmpegRawDir, rawCapture.ffprobeLogName || 'ffprobe-audio-duration.json', {
        tool: 'ffprobe',
        command,
        stdout: stdoutText,
        status: 'success'
      });
    }
    return parseFloat(stdoutText.trim()) || 0;
  } catch (e) {
    if (rawCapture.captureRaw) {
      writeRawJson(rawCapture.ffmpegRawDir, rawCapture.ffprobeLogName || 'ffprobe-audio-duration.json', {
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

module.exports = {
  run,
  aiRecovery: {
    guidance: 'Repair malformed or validator-rejected dialogue JSON while preserving the same transcript/stitch task and schema.',
    reentry: {
      allowedMutableInputs: ['repairInstructions', 'boundedContextSummary'],
      forbiddenMutableInputs: ['upstreamArtifacts', 'artifactPaths', 'schemaDefinition', 'runtimeBudgets']
    }
  }
};

// Allow standalone execution for testing
if (require.main === module) {
  const assetPath = process.argv[2] || 'test-audio.wav';
  const outputDir = process.argv[3] || 'output/test-dialogue';

  console.log('Get Dialogue Script - Test Mode');
  console.log('Asset:', assetPath);
  console.log('Output:', outputDir);
  console.log('');
  console.log('⚠️  This script requires:');
  console.log('   - AI_API_KEY environment variable');
  console.log('   - config.ai.dialogue.targets[*].adapter.{name,model} (set in pipeline YAML)');
  console.log('   - ffmpeg installed for audio extraction');
  console.log('   - A model that supports audio transcription (e.g., Whisper)');
  console.log('');
  console.log('Note: This script is designed to be run within the pipeline.');
  console.log('      The model must be explicitly configured in the YAML.');
}
