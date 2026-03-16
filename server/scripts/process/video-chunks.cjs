#!/usr/bin/env node
/**
 * Video Chunks Script
 * 
 * Analyzes video in chunks (e.g., 8-second segments) with persona-based emotion evaluation.
 * This script runs in Phase 2 (Process) of the pipeline.
 * 
 * @module scripts/process/video-chunks
 */

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');
const emotionLensesTool = require('../../../../tools/emotion-lenses-tool.cjs');
const storage = require('../../lib/storage/storage-interface.js');
const chunkStrategy = require('../../lib/chunk-strategy.cjs');
const splitStrategy = require('../../lib/split-strategy.cjs');
const videoChunkExtractor = require('../../lib/video-chunk-extractor.cjs');
const outputManager = require('../../lib/output-manager.cjs');
const { getChunkFailureReason } = require('../../lib/chunk-analysis-status.cjs');
const { shouldKeepProcessedIntermediates } = require('../../lib/processed-assets-policy.cjs');
const { shouldCaptureRaw, getRawPhaseDir, writeRawJson } = require('../../lib/raw-capture.cjs');
const { ensureToolVersionsCaptured } = require('../../lib/tool-versions.cjs');
const { ffmpegPath, ffprobePath } = require('../../lib/ffmpeg-path.cjs');
const {
  executeWithTargets,
  createRetryableError,
  getTargetsFromConfig,
  getPersistedErrorInfo,
  getProviderForTarget
} = require('../../lib/ai-targets.cjs');
const { getEventsLogger } = require('../../lib/events-timeline.cjs');
const { storePromptPayload } = require('../../lib/prompt-store.cjs');
const { getRecoveryRuntime, buildRecoveryPromptAddendum } = require('../../lib/ai-recovery-runtime.cjs');
const { applyFailureMetadata } = require('../../lib/tool-wrapper-contract.cjs');

const execAsync = promisify(exec);
const ENGINE_REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
const TOOLS_REPO_ROOT = path.resolve(ENGINE_REPO_ROOT, '..', 'tools');

function normalizeToolRepoPath(inputPath) {
  if (!inputPath || path.isAbsolute(inputPath)) return inputPath;

  const directToolsPath = path.resolve(TOOLS_REPO_ROOT, inputPath);
  if (fs.existsSync(directToolsPath)) {
    return inputPath;
  }

  if (inputPath.startsWith('cast/')) {
    return `../${inputPath}`;
  }

  if (inputPath.startsWith('goals/')) {
    return `../${inputPath}`;
  }

  const legacyEnginePath = path.resolve(ENGINE_REPO_ROOT, inputPath);
  if (fs.existsSync(legacyEnginePath)) {
    return path.relative(TOOLS_REPO_ROOT, legacyEnginePath);
  }

  return inputPath;
}

function isReplayMode() {
  return (process.env.DIGITAL_TWIN_MODE || '').trim().toLowerCase() === 'replay';
}

function getRetryConfig(config = {}) {
  const retry = config?.ai?.video?.retry || {};

  return {
    maxAttempts: Number.isInteger(retry.maxAttempts) && retry.maxAttempts > 0 ? retry.maxAttempts : 2,
    backoffMs: Number.isInteger(retry.backoffMs) && retry.backoffMs >= 0 ? retry.backoffMs : 500,
    // Policy (not configurable via YAML): retry invalid output + provider errors.
    retryOnParseError: true,
    retryOnProviderError: true
  };
}

function getPrimaryVideoAdapter(config = {}) {
  const targets = config?.ai?.video?.targets;
  if (Array.isArray(targets) && targets.length > 0) {
    const adapter = targets[0]?.adapter;
    if (adapter && typeof adapter === 'object' && !Array.isArray(adapter)) {
      return adapter;
    }
  }

  // Legacy compatibility (non-schema): allow scripts/tests to pass old shape.
  const legacyModel = config?.ai?.video?.model;
  if (typeof legacyModel === 'string' && legacyModel.trim().length > 0) {
    return {
      name: config?.ai?.provider || 'openrouter',
      model: legacyModel
    };
  }

  return null;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getToolLoopConfig(config = {}) {
  const toolLoop = config?.ai?.video?.toolLoop || {};

  return {
    maxTurns: Number.isInteger(toolLoop.maxTurns) && toolLoop.maxTurns > 1 ? toolLoop.maxTurns : 4,
    maxValidatorCalls: Number.isInteger(toolLoop.maxValidatorCalls) && toolLoop.maxValidatorCalls > 0 ? toolLoop.maxValidatorCalls : 3
  };
}

function resolveChunkMaxFileSize(config = {}) {
  const flat = config?.tool_variables?.maxFileSize;
  if (Number.isInteger(flat) && flat > 0) return flat;

  const nested = config?.tool_variables?.file_transfer?.maxFileSize;
  if (Number.isInteger(nested) && nested > 0) return nested;

  return null;
}

function normalizeSplitFactor(value) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return null;
  if (value > 1) return 1 / value;
  if (value < 1) return value;
  return null;
}

function resolveSplitConfig(config = {}) {
  const canonical = config?.tool_variables?.chunk_strategy?.split || {};
  const legacy = config?.tool_variables?.split_strategy || {};

  const enabled = canonical.enabled !== undefined
    ? canonical.enabled !== false
    : (legacy.enabled !== undefined ? legacy.enabled !== false : true);

  return {
    enabled,
    maxSplits: Number.isInteger(canonical.max_splits) && canonical.max_splits > 0
      ? canonical.max_splits
      : (Number.isInteger(legacy.maxSplits) && legacy.maxSplits > 0 ? legacy.maxSplits : 5),
    splitFactor: normalizeSplitFactor(canonical.split_factor)
      ?? normalizeSplitFactor(legacy.splitFactor)
      ?? 0.5
  };
}

function resolveVideoTransferConfig(config = {}, toolVariables = {}) {
  const canonical = config?.tool_variables?.file_transfer || {};
  const legacyValue = config?.tool_variables?.file_transfer;
  const toolScoped = toolVariables?.file_transfer || {};

  const strategy = typeof canonical?.strategy === 'string' && canonical.strategy.trim().length > 0
    ? canonical.strategy.trim()
    : (typeof legacyValue === 'string' && legacyValue.trim().length > 0
      ? legacyValue.trim()
      : (typeof toolScoped?.strategy === 'string' && toolScoped.strategy.trim().length > 0
        ? toolScoped.strategy.trim()
        : 'base64'));

  const mimeType = typeof canonical?.mimeType === 'string' && canonical.mimeType.trim().length > 0
    ? canonical.mimeType.trim()
    : (typeof toolScoped?.mimeType === 'string' && toolScoped.mimeType.trim().length > 0
      ? toolScoped.mimeType.trim()
      : 'video/mp4');

  return { strategy, mimeType };
}

const TERMINAL_MICRO_CHUNK_SKIP_SECONDS = 1;

function trimPreviousSummary(summary, maxChars = 400) {
  if (typeof summary !== 'string') return '';
  const trimmed = summary.trim();
  if (trimmed.length <= maxChars) return trimmed;
  return `${trimmed.slice(0, Math.max(0, maxChars - 1)).trimEnd()}…`;
}

function shouldSkipTerminalProviderChunk({
  chunkIndex,
  numChunks,
  splitIndex,
  splitCount,
  durationSeconds,
  thresholdSeconds = TERMINAL_MICRO_CHUNK_SKIP_SECONDS
} = {}) {
  const isTerminalChunk = Number.isInteger(chunkIndex) && Number.isInteger(numChunks) && chunkIndex === (numChunks - 1);
  const isTerminalSplit = Number.isInteger(splitIndex) && Number.isInteger(splitCount) && splitIndex === (splitCount - 1);
  const duration = Number(durationSeconds);

  if (!isTerminalChunk || !isTerminalSplit) return false;
  if (!Number.isFinite(duration) || duration < 0) return false;

  return duration < thresholdSeconds;
}

function stringifyRawValue(value) {
  if (typeof value === 'string') {
    return value;
  }

  if (value && typeof value === 'object') {
    return JSON.stringify(value);
  }

  return null;
}

function extractRawResponse(toolResult) {
  return stringifyRawValue(toolResult?.rawResponse)
    || stringifyRawValue(toolResult?.response)
    || stringifyRawValue(toolResult?.providerResponse)
    || stringifyRawValue(toolResult?.completion)
    || null;
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

function buildRequestMeta({ chunkIndex, splitIndex, attempt, attemptInTarget, targetIndex, targetCount, adapter }) {
  return {
    adapter: adapter || null,
    provider: adapter?.name || null,
    model: adapter?.model || null,
    chunkIndex,
    splitIndex: splitIndex || 0,
    attempt,
    attemptInTarget: attemptInTarget || null,
    targetIndex: Number.isInteger(targetIndex) ? targetIndex : null,
    targetCount: Number.isInteger(targetCount) ? targetCount : null
  };
}

/**
 * Script Input Contract
 * @typedef {Object} VideoChunksInput
 * @property {string} assetPath - Path to video file
 * @property {string} outputDir - Output directory
 * @property {Object} [artifacts] - Artifacts from previous phases (dialogueData, musicData)
 * @property {string} [toolPath] - Path to emotion-lenses-tool.cjs
 * @property {Object} [toolVariables] - Tool configuration
 * @property {string} toolVariables.soulPath - Path to SOUL.md
 * @property {string} toolVariables.goalPath - Path to GOAL.md
 * @property {Object} toolVariables.variables - Additional variables
 * @property {string[]} toolVariables.variables.lenses - Emotion lenses to evaluate
 * @property {Object} [config] - Pipeline config
 */

/**
 * Script Output Contract
 * @typedef {Object} VideoChunksOutput
 * @property {Object} artifacts - Script artifacts
 * @property {Object} artifacts.chunkAnalysis - Chunk analysis results
 * @property {Array} artifacts.chunkAnalysis.chunks - Array of chunk results
 * @property {number} artifacts.chunkAnalysis.totalTokens - Total tokens used
 * @property {Object} artifacts.chunkAnalysis.persona - Persona info
 */

/**
 * Main entry point
 * 
 * @async
 * @function run
 * @param {VideoChunksInput} input - Script input
 * @returns {Promise<VideoChunksOutput>} - Script output
 */
async function run(input) {
  const {
    assetPath,
    outputDir,
    artifacts = {},
    toolVariables,
    config
  } = input;
  const recoveryRuntime = getRecoveryRuntime(input);

  console.log('   🎬 Processing video in chunks...');

  // Validate required inputs
  if (!toolVariables?.soulPath || !toolVariables?.goalPath) {
    throw new Error('VideoChunks: toolVariables.soulPath and toolVariables.goalPath are required');
  }

  const replayMode = isReplayMode();

  // Verify AI_API_KEY is available for live calls only
  if (!replayMode && !process.env.AI_API_KEY) {
    console.error('   ❌ ERROR: AI_API_KEY environment variable is not set');
    throw new Error('AI_API_KEY is required for chunk analysis unless DIGITAL_TWIN_MODE=replay');
  }

  // Ensure output directory exists
  fs.mkdirSync(outputDir, { recursive: true });

  const captureRaw = shouldCaptureRaw(config);

  const events = getEventsLogger({ outputDir, config });
  events.emit({ kind: 'script.start', phase: 'phase2-process', script: 'video-chunks' });

  const rawDir = getRawPhaseDir(outputDir, 'phase2-process');
  const rawMetaDir = path.join(rawDir, '_meta');
  const ffmpegRawDir = path.join(rawDir, 'ffmpeg');
  const aiRawDir = path.join(rawDir, 'ai');
  const toolVersionsDir = path.join(rawDir, 'tools', '_versions');

  const phaseErrors = [];
  let phaseOutcome = 'success';
  let fatalPhaseError = null;

  const recordPhaseError = (entry) => {
    phaseErrors.push({
      ts: new Date().toISOString(),
      ...entry
    });

    events.error({
      message: entry?.message || null,
      phase: 'phase2-process',
      script: 'video-chunks',
      where: entry?.kind || entry?.name || null,
      extra: {
        kind: entry?.kind || null,
        chunkIndex: Number.isInteger(entry?.chunkIndex) ? entry.chunkIndex : null,
        splitIndex: Number.isInteger(entry?.splitIndex) ? entry.splitIndex : null,
        errorStatus: entry?.errorStatus || null,
        errorRequestId: entry?.errorRequestId || null,
        errorClassification: entry?.errorClassification || null,
      }
    });
  };

  const writePhaseErrorArtifacts = () => {
    if (!captureRaw) return;

    fs.mkdirSync(rawMetaDir, { recursive: true });
    const errorsPath = path.join(rawMetaDir, 'errors.jsonl');
    const summary = {
      schemaVersion: 1,
      phase: 'phase2-process',
      outcome: phaseOutcome,
      generatedAt: new Date().toISOString(),
      totalErrors: phaseErrors.length,
      fatalError: fatalPhaseError
        ? {
            name: fatalPhaseError?.name || null,
            message: fatalPhaseError?.message || String(fatalPhaseError),
            stack: typeof fatalPhaseError?.stack === 'string' ? fatalPhaseError.stack : null
          }
        : null
    };

    const lines = phaseErrors.map((e) => JSON.stringify(e)).join('\n') + (phaseErrors.length ? '\n' : '');
    fs.writeFileSync(errorsPath, lines, 'utf8');
    writeRawJson(rawMetaDir, 'errors.summary.json', summary);
  };

  const writeFfmpegRawLog = (name, payload) => {
    if (!captureRaw) return;
    writeRawJson(ffmpegRawDir, name, payload);
  };

  const pad = (value, width) => String(value).padStart(width, '0');

  const writeChunkRaw = (chunkIndex, splitIndex, payload) => {
    if (!captureRaw) return;

    const attempt = Number.isInteger(payload?.attempt) ? payload.attempt : 1;

    const legacyFileName = splitIndex > 0
      ? `chunk-${chunkIndex}-split-${splitIndex}.json`
      : `chunk-${chunkIndex}.json`;

    const attemptRelDir = path.join(
      `chunk-${pad(chunkIndex, 4)}`,
      `split-${pad(splitIndex || 0, 2)}`,
      `attempt-${pad(attempt, 2)}`
    );

    const attemptRelPath = path.join(attemptRelDir, 'capture.json');

    // Schema v2: attempt-scoped capture payloads (do not overwrite retries)
    writeRawJson(aiRawDir, attemptRelPath, payload);

    // Legacy pointer: keep chunk-<n>.json files as pointers to latest attempt
    writeRawJson(aiRawDir, legacyFileName, {
      schemaVersion: 2,
      kind: 'pointer',
      updatedAt: new Date().toISOString(),
      chunkIndex,
      splitIndex: splitIndex || 0,
      latestAttempt: attempt,
      target: {
        dir: attemptRelDir,
        file: attemptRelPath
      }
    });
  };

  await ensureToolVersionsCaptured({
    captureRaw,
    toolVersionsDir,
    tools: [
      { name: 'ffmpeg', path: ffmpegPath },
      { name: 'ffprobe', path: ffprobePath }
    ]
  });

  // Get video duration
  const duration = await getVideoDuration(assetPath, writeFfmpegRawLog);
  console.log(`   📊 Video duration: ${duration.toFixed(1)}s`);

  // Get chunk strategy from config
  const strategyConfig = config?.tool_variables?.chunk_strategy;
  const strategy = chunkStrategy.getChunkStrategy(
    strategyConfig?.type || 'duration-based',
    strategyConfig?.config || {}
  );
  
  // Validate strategy was loaded
  if (!strategy) {
    throw new Error(`Failed to load chunk strategy. Type: ${strategyConfig?.type || 'duration-based'}`);
  }
  
  const chunkBoundaries = strategy.calculateChunkBoundaries(duration, strategyConfig?.config || {});

  // Apply max_chunks limit from config
  const maxChunks = config?.settings?.max_chunks || chunkBoundaries.length;
  const numChunks = Math.min(chunkBoundaries.length, maxChunks);
  const limitedBoundaries = chunkBoundaries.slice(0, numChunks);
  
  // Validate numChunks
  if (numChunks <= 0) {
    throw new Error(`Invalid numChunks: ${numChunks}. Check video duration (${duration}s) and chunk strategy config`);
  }
  
  console.log(`   📦 Processing ${numChunks} chunks (max_chunks: ${maxChunks})`);

  // Startup logging - show config values
  console.log(`   📋 Config values:`);
  console.log(`      - chunkDuration: ${strategyConfig?.config?.chunkDuration || 'default'}`);
  console.log(`      - max_chunks: ${config?.settings?.max_chunks || 'unlimited'}`);
  console.log(`      - video duration: ${duration}s`);
  console.log(`      - calculated chunks: ${chunkBoundaries.length}`);
  console.log(`      - processing: ${numChunks} chunks`);

  // Get context from previous phases
  const dialogueData = artifacts.dialogueData || { dialogue_segments: [], summary: '' };
  const musicData = artifacts.musicData || { segments: [] };

  const primaryAdapter = getPrimaryVideoAdapter(config);
  const videoModel = primaryAdapter?.model;
  if (!videoModel) {
    throw new Error('VideoChunks: config.ai.video.targets[*].adapter.model is required');
  }

  const legacyToolModel = toolVariables?.variables?.model;
  if (legacyToolModel && legacyToolModel !== videoModel) {
    throw new Error(
      `VideoChunks: legacy tool_variables.variables.model (${legacyToolModel}) must match config.ai.video.targets[*].adapter.model (${videoModel})`
    );
  }

  const normalizedToolVariables = {
    ...toolVariables,
    soulPath: normalizeToolRepoPath(toolVariables?.soulPath),
    goalPath: normalizeToolRepoPath(toolVariables?.goalPath),
    variables: {
      ...(toolVariables?.variables || {}),
      model: videoModel
    }
  };

  const results = [];
  let totalTokens = 0;
  let previousSummary = '';

  // Create phase directory for artifacts
  const phaseDir = outputManager.createPhaseDirectory(outputDir, 'phase2-process');
  
  // Create directories for processed chunk assets
  const chunksDir = path.join(outputDir, 'assets', 'processed', 'chunks');
  fs.mkdirSync(chunksDir, { recursive: true });

  console.log(`   📁 Phase directory: ${phaseDir}`);
  console.log(`   📁 Chunks directory: ${chunksDir}`);

  // Default to keeping processed/intermediate files unless explicitly disabled
  const keepProcessedIntermediates = shouldKeepProcessedIntermediates(config);
  const retryConfig = getRetryConfig(config);
  const toolLoopConfig = getToolLoopConfig(config);
  const maxFileSize = resolveChunkMaxFileSize(config);
  const splitConfig = resolveSplitConfig(config);
  const videoTransferConfig = resolveVideoTransferConfig(config, normalizedToolVariables);

  console.log(`   🔁 Retry config: attempts=${retryConfig.maxAttempts}, backoffMs=${retryConfig.backoffMs}, retryOnParseError=${retryConfig.retryOnParseError}, retryOnProviderError=${retryConfig.retryOnProviderError}`);
  console.log(`   🧰 Tool loop config: turns=${toolLoopConfig.maxTurns}, validatorCalls=${toolLoopConfig.maxValidatorCalls}`);
  console.log(`   🎞️  Video attachment transport: strategy=${videoTransferConfig.strategy}, mimeType=${videoTransferConfig.mimeType}`);

  // Track extracted assets for cleanup
  const extractedChunks = [];

  try {
    // Process each chunk
    for (let chunkIndex = 0; chunkIndex < numChunks; chunkIndex++) {
      const boundary = limitedBoundaries[chunkIndex];
      const startTime = boundary.startTime;
      const endTime = boundary.endTime;

      console.log(`   Processing chunk ${chunkIndex + 1}/${numChunks} (${startTime.toFixed(1)}s - ${endTime.toFixed(1)}s)...`);

      // Extract video chunk from source
      const extractionResult = await videoChunkExtractor.extractVideoChunk(
        assetPath,
        startTime,
        endTime,
        chunksDir,
        chunkIndex,
        {
          rawLogger: (payload) => writeFfmpegRawLog(`extract-chunk-${chunkIndex}.json`, payload)
        }
      );

      if (!extractionResult.success) {
        recordPhaseError({
          kind: 'chunk_extraction_failed',
          chunkIndex,
          message: extractionResult?.error || 'unknown extraction error'
        });
        const extractionError = new Error(`Failed to extract chunk ${chunkIndex}: ${extractionResult.error}`);
        applyFailureMetadata(extractionError, extractionResult.failure, {
          diagnostics: {
            ...(extractionResult.failure?.diagnostics || {}),
            chunkIndex,
            startTime,
            endTime
          }
        });
        throw extractionError;
      }

      const chunkPath = extractionResult.chunkPath;
      extractedChunks.push(chunkPath);

      // Check file size against maxFileSize config
      let chunksToProcess = [chunkPath];

      if (maxFileSize) {
        const stats = fs.statSync(chunkPath);
        if (stats.size > maxFileSize) {
          if (!splitConfig.enabled) {
            throw new Error(
              `Chunk ${chunkIndex + 1} exceeds max file size but chunk splitting is disabled ` +
              `(${(stats.size / 1024 / 1024).toFixed(2)}MB > ${(maxFileSize / 1024 / 1024).toFixed(2)}MB)`
            );
          }

          console.log(`   ⚠️  Chunk ${chunkIndex + 1} exceeds max file size (${(stats.size / 1024 / 1024).toFixed(2)}MB > ${(maxFileSize / 1024 / 1024).toFixed(2)}MB), splitting...`);

          let splitResults;

          try {
            splitResults = splitStrategy.splitChunk(
              chunkPath,
              maxFileSize,
              splitConfig.maxSplits,
              splitConfig.splitFactor,
              0,
              {
                rawLogger: (logName, payload) => writeFfmpegRawLog(logName, payload)
              }
            );
          } catch (error) {
            recordPhaseError({
              kind: 'chunk_split_failed',
              chunkIndex,
              message: error?.message || String(error),
              stack: typeof error?.stack === 'string' ? error.stack : null
            });
            throw error;
          }

          // Remove original chunk from extractedChunks since it's been split
          extractedChunks.splice(extractedChunks.indexOf(chunkPath), 1);

          // Add split chunks to extractedChunks for cleanup
          splitResults.forEach(splitPath => extractedChunks.push(splitPath));
          chunksToProcess = splitResults;
        }
      }

      const splitDurations = await Promise.all(
        chunksToProcess.map((candidatePath, candidateIndex) => getVideoDuration(
          candidatePath,
          captureRaw
            ? ((logName, payload) => writeFfmpegRawLog(`split-duration-${chunkIndex}-${candidateIndex}.json`, payload))
            : null
        ))
      );

      const boundedChunkDuration = Math.max(0, endTime - startTime);
      const normalizedSplitDurations = splitDurations.map((value) => {
        const numeric = Number(value);
        return numeric > 0 ? numeric : 0;
      });
      const totalSplitDuration = normalizedSplitDurations.reduce((sum, value) => sum + value, 0);
      const fallbackSplitDuration = chunksToProcess.length > 0
        ? boundedChunkDuration / chunksToProcess.length
        : boundedChunkDuration;
      let splitCursor = startTime;

      // Process each chunk (original or split chunks)
      for (let splitIndex = 0; splitIndex < chunksToProcess.length; splitIndex++) {
        const currentChunkPath = chunksToProcess[splitIndex];
        const actualSplitDuration = normalizedSplitDurations[splitIndex] > 0
          ? normalizedSplitDurations[splitIndex]
          : fallbackSplitDuration;
        const proportionalSplitDuration = totalSplitDuration > 0 && boundedChunkDuration > 0
          ? (actualSplitDuration / totalSplitDuration) * boundedChunkDuration
          : actualSplitDuration;
        const splitStartTime = Number(splitCursor.toFixed(3));
        const remainingChunkWindow = Math.max(0, endTime - splitStartTime);
        const splitDuration = Number(Math.max(0, Math.min(remainingChunkWindow, proportionalSplitDuration)).toFixed(3));
        const splitEndTime = Number(Math.min(endTime, splitStartTime + splitDuration).toFixed(3));
        splitCursor = splitEndTime;

        if (shouldSkipTerminalProviderChunk({
          chunkIndex,
          numChunks,
          splitIndex,
          splitCount: chunksToProcess.length,
          durationSeconds: splitDuration
        })) {
          console.log(
            `      ⏭️  Skipping terminal provider-facing micro-chunk under ${TERMINAL_MICRO_CHUNK_SKIP_SECONDS}s ` +
            `(${splitDuration.toFixed(3)}s at ${splitStartTime.toFixed(3)}s-${splitEndTime.toFixed(3)}s)`
          );
          continue;
        }

        // Get relevant dialogue for this chunk
        const dialogueContext = getRelevantDialogue(dialogueData, splitStartTime, splitEndTime);

        // Get relevant music for this chunk
        const musicContext = getRelevantMusic(musicData, splitStartTime, splitEndTime);

        const chunkLabel = `Chunk ${chunkIndex + 1}${splitIndex > 0 ? `.${splitIndex + 1}` : ''}`;

        const analyzeInputBase = {
          videoContext: {
            chunkPath: currentChunkPath,
            chunkIndex,
            splitIndex: splitIndex || 0,
            startTime: splitStartTime,
            endTime: splitEndTime,
            duration: splitDuration,
            transferStrategy: videoTransferConfig.strategy,
            mimeType: videoTransferConfig.mimeType
          },
          dialogueContext: {
            segments: dialogueContext
          },
          musicContext: {
            segments: musicContext
          },
          previousState: {
            summary: trimPreviousSummary(previousSummary),
            emotions: results.length > 0 ? results[results.length - 1].emotions : {}
          }
        };

        try {
          const attemptStartMs = new Map();

          const { result: analysisResult, meta } = await executeWithTargets({
            config,
            domain: 'video',
            retry: retryConfig,
            replayMode,
            shouldRetry: ({ error }, ctx) => {
              const group = error?.aiTargets?.group;
              const msg = String(error?.message || '');
              const isParseError = group === 'parse' || msg.startsWith('invalid_output:');
              return isParseError ? !!retryConfig.retryOnParseError : !!retryConfig.retryOnProviderError;
            },
            operation: async (ctx) => {
              const adapter = ctx?.target?.adapter;
              const attemptKey = String(ctx?.attempt || '');

              if (attemptKey && !attemptStartMs.has(attemptKey)) {
                attemptStartMs.set(attemptKey, Date.now());
                events.emit({
                  kind: 'attempt.start',
                  phase: 'phase2-process',
                  script: 'video-chunks',
                  domain: 'video',
                  chunkIndex,
                  splitIndex: splitIndex || 0,
                  attempt: ctx.attempt,
                  attemptInTarget: ctx.attemptInTarget,
                  targetIndex: ctx.targetIndex,
                  targetCount: ctx.targetCount,
                  adapter: adapter || null,
                });
              }

              const toolVariablesForAttempt = {
                ...normalizedToolVariables,
                variables: {
                  ...(normalizedToolVariables?.variables || {}),
                  model: adapter?.model || normalizedToolVariables?.variables?.model
                }
              };

              const analyzeInput = {
                ...analyzeInputBase,
                toolVariables: toolVariablesForAttempt,
                config: ctx.configForTarget
              };

              const provider = getProviderForTarget({
                configForTarget: ctx.configForTarget,
                target: ctx.target
              });

              const providerCallStart = Date.now();
              events.emit({
                kind: 'provider.call.start',
                phase: 'phase2-process',
                script: 'video-chunks',
                domain: 'video',
                chunkIndex,
                splitIndex: splitIndex || 0,
                attempt: ctx.attempt,
                attemptInTarget: ctx.attemptInTarget,
                targetIndex: ctx.targetIndex,
                targetCount: ctx.targetCount,
                provider: adapter?.name || null,
                model: adapter?.model || null,
              });

              try {
                const prompt = `${emotionLensesTool.buildBasePromptFromInput(analyzeInput)}${buildRecoveryPromptAddendum(recoveryRuntime)}`;

                const promptRef = captureRaw
                  ? storePromptPayload({ outputDir, payload: prompt })
                  : null;

                if (promptRef?.absolutePath) {
                  events.artifactWrite({ absolutePath: promptRef.absolutePath, role: 'raw.prompt', phase: 'phase2-process', script: 'video-chunks' });
                }

                const toolLoopResult = await emotionLensesTool.executeEmotionAnalysisToolLoop({
                  provider,
                  adapter,
                  toolVariables: toolVariablesForAttempt,
                  videoContext: analyzeInput.videoContext,
                  basePrompt: prompt,
                  toolLoopConfig,
                  promptRef,
                  events,
                  ctx,
                  apiKey: process.env.AI_API_KEY,
                  config: ctx.configForTarget
                });

                events.emit({
                  kind: 'provider.call.end',
                  phase: 'phase2-process',
                  script: 'video-chunks',
                  domain: 'video',
                  chunkIndex,
                  splitIndex: splitIndex || 0,
                  attempt: ctx.attempt,
                  attemptInTarget: ctx.attemptInTarget,
                  targetIndex: ctx.targetIndex,
                  ok: true,
                  durationMs: Date.now() - providerCallStart,
                  provider: adapter?.name || null,
                  model: adapter?.model || null,
                });

                const candidateChunkResult = {
                  chunkIndex,
                  splitIndex: splitIndex || 0,
                  startTime: splitStartTime,
                  endTime: splitEndTime,
                  status: 'success',
                  summary: toolLoopResult?.parsed?.summary,
                  emotions: toolLoopResult?.parsed?.emotions,
                  dominant_emotion: toolLoopResult?.parsed?.dominant_emotion,
                  confidence: toolLoopResult?.parsed?.confidence,
                  tokens: (toolLoopResult?.completion?.usage?.input || 0) + (toolLoopResult?.completion?.usage?.output || 0),
                  persona: {
                    soulPath: toolVariables.soulPath,
                    goalPath: toolVariables.goalPath,
                    lenses: toolVariables.variables?.lenses || []
                  }
                };

                const parseFailure = getChunkFailureReason(candidateChunkResult);
                if (parseFailure) {
                  throw createRetryableError(`invalid_output: ${parseFailure}`, {
                    group: 'validation',
                    validationSummary: parseFailure,
                    toolLoop: toolLoopResult?.toolLoop || null,
                    completion: toolLoopResult?.completion || null
                  });
                }

                return {
                  completion: toolLoopResult.completion,
                  toolLoop: toolLoopResult.toolLoop,
                  promptRef,
                  chunkResult: candidateChunkResult
                };
              } catch (error) {
                events.emit({
                  kind: 'provider.call.end',
                  phase: 'phase2-process',
                  script: 'video-chunks',
                  domain: 'video',
                  chunkIndex,
                  splitIndex: splitIndex || 0,
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
              configForTarget,
              result,
              error
            }) => {
              const attemptKey = String(attempt || '');
              const startedAt = attemptKey && attemptStartMs.has(attemptKey) ? attemptStartMs.get(attemptKey) : null;

              const persistedError = ok ? null : getPersistedErrorInfo(error);

              events.emit({
                kind: 'attempt.end',
                phase: 'phase2-process',
                script: 'video-chunks',
                domain: 'video',
                chunkIndex,
                splitIndex: splitIndex || 0,
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
              const completion = ok
                ? result?.completion
                : error?.aiTargets?.completion;
              const toolLoop = ok
                ? result?.toolLoop
                : error?.aiTargets?.toolLoop;
              const promptRef = ok
                ? result?.promptRef
                : error?.aiTargets?.promptRef;

              const invalidReason = error?.aiTargets?.invalidReason;
              const errorMessage = ok
                ? null
                : (invalidReason || error?.aiTargets?.validationSummary || error?.message || String(error));

              writeChunkRaw(chunkIndex, splitIndex || 0, {
                chunkIndex,
                splitIndex: splitIndex || 0,
                startTime: splitStartTime,
                endTime: splitEndTime,
                attempt,
                attemptInTarget,
                targetIndex,
                targetCount,
                adapter,
                failover: failover || null,
                promptRef: promptRef ? { sha256: promptRef.sha256, file: promptRef.file } : null,
                rawResponse: typeof completion?.content === 'string'
                  ? completion.content
                  : (completion ? JSON.stringify(sanitizeRawCaptureValue(completion)) : null),
                providerCompletion: completion ? sanitizeRawCaptureValue(completion) : null,
                parsed: ok ? result?.chunkResult : null,
                toolLoop: toolLoop ? sanitizeRawCaptureValue(toolLoop) : null,
                error: errorMessage,
                errorName: !ok ? (error?.name || null) : null,
                errorCode: !ok ? (error?.code || null) : null,
                errorStatus: !ok ? (persistedError?.status || null) : null,
                errorRequestId: !ok ? (persistedError?.requestId || null) : null,
                errorClassification: !ok ? (persistedError?.classification || null) : null,
                errorStack: !ok && typeof error?.stack === 'string' ? error.stack : null,
                errorDebug: !ok ? (sanitizeRawCaptureValue(error?.debug || error?.aiTargets) || null) : null,
                errorResponse: !ok ? (sanitizeRawCaptureValue(persistedError?.response) || null) : null,
                provider: adapter?.name || (configForTarget?.ai?.provider || 'openrouter'),
                model: adapter?.model || (configForTarget?.ai?.video?.model || null),
                requestMeta: buildRequestMeta({
                  chunkIndex,
                  splitIndex,
                  attempt,
                  attemptInTarget,
                  targetIndex,
                  targetCount,
                  adapter
                })
              });
            }
          });

          const chunkResult = analysisResult.chunkResult;

          results.push(chunkResult);
          totalTokens += chunkResult.tokens;
          previousSummary = chunkResult.summary;

          console.log(`      ✅ ${chunkLabel} analyzed (${chunkResult.tokens} tokens)${meta.attempt > 1 ? ` after ${meta.attempt} attempts` : ''}`);
        } catch (error) {
          recordPhaseError({
            kind: 'chunk_analysis_failed',
            chunkIndex,
            splitIndex: splitIndex || 0,
            message: error?.message || String(error),
            stack: typeof error?.stack === 'string' ? error.stack : null
          });

          const attempts = Number.isInteger(error?.aiTargets?.attempts)
            ? error.aiTargets.attempts
            : retryConfig.maxAttempts;

          throw new Error(`${chunkLabel} failed after ${attempts} attempts: ${error.message}`);
        }
      }
    }

    // Build chunk analysis artifact
    const successfulChunks = results.filter((chunk) => chunk.status !== 'failed');
    const failedChunks = results.filter((chunk) => chunk.status === 'failed');

    const chunkAnalysis = {
      chunks: results,
      totalTokens,
      statusSummary: {
        total: results.length,
        successful: successfulChunks.length,
        failed: failedChunks.length,
        failedChunkIndexes: failedChunks.map((chunk) => chunk.chunkIndex)
      },
      persona: {
        soulPath: toolVariables.soulPath,
        goalPath: toolVariables.goalPath,
        config: {
          chunkDuration: config?.settings?.chunk_duration || 8,
          numChunks
        }
      },
      videoDuration: duration
    };

    // Write artifact to phase directory
    const artifactPath = path.join(phaseDir, 'chunk-analysis.json');
    fs.writeFileSync(artifactPath, JSON.stringify(chunkAnalysis, null, 2));
    events.artifactWrite({ absolutePath: artifactPath, role: 'artifact', phase: 'phase2-process', script: 'video-chunks' });

    console.log('   ✅ Video chunk analysis complete');
    console.log(`      Artifact path: ${artifactPath}`);
    console.log(`      Total tokens used: ${totalTokens}`);
    const analyzedChunkCount = chunkAnalysis.statusSummary.successful || 1;
    console.log(`      Average per successful chunk: ${(totalTokens / analyzedChunkCount).toFixed(0)} tokens`);
    if (chunkAnalysis.statusSummary.failed > 0) {
      console.log(`      Failed chunks: ${chunkAnalysis.statusSummary.failed} (${chunkAnalysis.statusSummary.failedChunkIndexes.join(', ')})`);
    }

    return {
      artifacts: {
        chunkAnalysis
      }
    };
  } catch (error) {
    phaseOutcome = 'failed';
    fatalPhaseError = error;
    const persistedError = getPersistedErrorInfo(error);
    recordPhaseError({
      kind: 'phase_failure',
      name: error?.name || null,
      message: error?.message || String(error),
      stack: typeof error?.stack === 'string' ? error.stack : null,
      errorStatus: persistedError.status,
      errorRequestId: persistedError.requestId,
      errorClassification: persistedError.classification
    });

    console.error('   ❌ Error processing video chunks:', error.message);
    throw error;
  } finally {
    try {
      writePhaseErrorArtifacts();
    } catch (e) {
      console.warn('   ⚠️  Warning: Failed to write phase raw error artifacts:', e?.message || String(e));
    }

    events.emit({ kind: 'script.end', phase: 'phase2-process', script: 'video-chunks', outcome: phaseOutcome });

    // Handle chunk file cleanup based on config
    if (keepProcessedIntermediates) {
      console.log(`   💾 Keeping extracted chunk files in ${chunksDir}`);
    } else {
      try {
        for (const chunkPath of extractedChunks) {
          if (fs.existsSync(chunkPath)) {
            fs.unlinkSync(chunkPath);
          }
        }
        console.log('   🧹 Cleaned up extracted chunk files');
      } catch (e) {
        console.warn('   ⚠️  Warning: Failed to cleanup some chunk files:', e.message);
      }
    }

    // Cleanup processed asset directories if empty
    try {
      for (const assetDir of [chunksDir]) {
        if (fs.existsSync(assetDir)) {
          const files = fs.readdirSync(assetDir);
          if (files.length === 0) {
            fs.rmSync(assetDir, { recursive: true, force: true });
          }
        }
      }
    } catch (e) {
      // Ignore cleanup errors
    }
  }
}

/**
 * Get video duration using ffprobe
 * 
 * @async
 * @function getVideoDuration
 * @param {string} videoPath - Path to video file
 * @returns {Promise<number>} - Duration in seconds
 */
async function getVideoDuration(videoPath, rawLogger) {
  const command = `"${ffprobePath}" -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${videoPath}"`;
  try {
    const { stdout, stderr } = await execAsync(command);
    if (typeof rawLogger === 'function') {
      rawLogger('ffprobe-video-duration.json', {
        tool: 'ffprobe',
        command,
        stdout,
        stderr,
        status: 'success'
      });
    }
    return parseFloat(stdout.trim()) || 0;
  } catch (error) {
    if (typeof rawLogger === 'function') {
      rawLogger('ffprobe-video-duration.json', {
        tool: 'ffprobe',
        command,
        stdout: error.stdout || '',
        stderr: error.stderr || '',
        status: 'failed',
        error: error.message
      });
    }
    console.warn('Failed to get video duration, defaulting to 0');
    return 0;
  }
}

/**
 * Get relevant dialogue segments for time range
 * 
 * @function getRelevantDialogue
 * @param {Object} dialogueData - Dialogue data from get-dialogue.cjs
 * @param {number} startTime - Start time in seconds
 * @param {number} endTime - End time in seconds
 * @returns {Array} - Relevant dialogue segments
 */
function getRelevantDialogue(dialogueData, startTime, endTime) {
  if (!dialogueData?.dialogue_segments) {
    return [];
  }

  return dialogueData.dialogue_segments.filter(seg => {
    // Check if segment overlaps with chunk time range
    return seg.start < endTime && seg.end > startTime;
  });
}

/**
 * Get relevant music segments for time range
 * 
 * @function getRelevantMusic
 * @param {Object} musicData - Music data from get-music.cjs
 * @param {number} startTime - Start time in seconds
 * @param {number} endTime - End time in seconds
 * @returns {Array} - Relevant music segments
 */
function getRelevantMusic(musicData, startTime, endTime) {
  if (!musicData?.segments) {
    return [];
  }

  return musicData.segments.filter(seg => {
    // Check if segment overlaps with chunk time range
    return seg.start < endTime && seg.end > startTime;
  });
}

module.exports = {
  run,
  aiRecovery: {
    guidance: 'Repair malformed or validator-rejected emotion-analysis JSON while preserving the same chunk-evaluation task, lenses, and upstream artifacts.',
    reentry: {
      allowedMutableInputs: ['repairInstructions', 'boundedContextSummary'],
      forbiddenMutableInputs: ['upstreamArtifacts', 'artifactPaths', 'schemaDefinition', 'runtimeBudgets']
    }
  }
};

// Allow standalone execution for testing
if (require.main === module) {
  const assetPath = process.argv[2] || 'test-video.mp4';
  const outputDir = process.argv[3] || 'output/test-chunks';

  console.log('Video Chunks Script - Test Mode');
  console.log('Asset:', assetPath);
  console.log('Output:', outputDir);
  console.log('');
  console.log('⚠️  This script requires:');
  console.log('   - AI_API_KEY environment variable');
  console.log('   - ffmpeg/ffprobe installed for chunk extraction');
  console.log('   - toolVariables with soulPath and goalPath');
  console.log('');
  console.log('Example usage:');
  console.log('  AI_API_KEY=your-key node video-chunks.cjs video.mp4 output/');
}
