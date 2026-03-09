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
const emotionLensesTool = require('tools/emotion-lenses-tool.cjs');
const storage = require('../../lib/storage/storage-interface.js');
const chunkStrategy = require('../../lib/chunk-strategy.cjs');
const splitStrategy = require('../../lib/split-strategy.cjs');
const videoChunkExtractor = require('../../lib/video-chunk-extractor.cjs');
const outputManager = require('../../lib/output-manager.cjs');
const { getChunkFailureReason } = require('../../lib/chunk-analysis-status.cjs');
const { shouldKeepProcessedIntermediates } = require('../../lib/processed-assets-policy.cjs');
const { shouldCaptureRaw, getRawPhaseDir, writeRawJson } = require('../../lib/raw-capture.cjs');
const { ffprobePath } = require('../../lib/ffmpeg-path.cjs');

const execAsync = promisify(exec);

function isReplayMode() {
  return (process.env.DIGITAL_TWIN_MODE || '').trim().toLowerCase() === 'replay';
}

function getRetryConfig(config = {}) {
  const retry = config?.ai?.video?.retry || {};

  return {
    maxAttempts: Number.isInteger(retry.maxAttempts) && retry.maxAttempts > 0 ? retry.maxAttempts : 2,
    backoffMs: Number.isInteger(retry.backoffMs) && retry.backoffMs >= 0 ? retry.backoffMs : 500,
    retryOnParseError: retry.retryOnParseError !== undefined ? !!retry.retryOnParseError : true,
    retryOnProviderError: retry.retryOnProviderError !== undefined ? !!retry.retryOnProviderError : true
  };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getSchemaFailureReason(state, lenses = []) {
  if (!state || typeof state !== 'object') {
    return 'schema_error: state must be an object';
  }

  if (typeof state.summary !== 'string' || state.summary.trim().length === 0) {
    return 'schema_error: summary must be a non-empty string';
  }

  if (typeof state.dominant_emotion !== 'string' || state.dominant_emotion.trim().length === 0) {
    return 'schema_error: dominant_emotion must be a non-empty string';
  }

  if (typeof state.confidence !== 'number' || Number.isNaN(state.confidence)) {
    return 'schema_error: confidence must be a number';
  }

  if (!state.emotions || typeof state.emotions !== 'object' || Array.isArray(state.emotions)) {
    return 'schema_error: emotions must be an object';
  }

  for (const lens of lenses) {
    const emotion = state.emotions[lens];
    if (!emotion || typeof emotion !== 'object') {
      return `schema_error: missing emotion entry for lens "${lens}"`;
    }

    if (typeof emotion.score !== 'number' || Number.isNaN(emotion.score)) {
      return `schema_error: emotion score for lens "${lens}" must be a number`;
    }

    if (typeof emotion.reasoning !== 'string') {
      return `schema_error: emotion reasoning for lens "${lens}" must be a string`;
    }
  }

  return null;
}

async function analyzeChunkWithRetry({
  analyzeInput,
  retryConfig,
  replayMode,
  chunkLabel,
  chunkIndex,
  splitIndex,
  startTime,
  endTime,
  toolVariables,
  config,
  writeChunkRaw
}) {
  let lastError = null;

  for (let attempt = 1; attempt <= retryConfig.maxAttempts; attempt++) {
    try {
      const toolResult = await emotionLensesTool.analyze(analyzeInput);
      const lenses = analyzeInput?.toolVariables?.variables?.lenses || [];
      const schemaFailure = getSchemaFailureReason(toolResult?.state, lenses);

      const candidateChunkResult = {
        chunkIndex,
        splitIndex,
        startTime,
        endTime,
        status: 'success',
        summary: toolResult?.state?.summary,
        emotions: toolResult?.state?.emotions,
        dominant_emotion: toolResult?.state?.dominant_emotion,
        confidence: toolResult?.state?.confidence,
        tokens: (toolResult?.usage?.input || 0) + (toolResult?.usage?.output || 0),
        persona: {
          soulPath: toolVariables.soulPath,
          goalPath: toolVariables.goalPath,
          lenses: toolVariables.variables?.lenses || []
        }
      };

      const parseFailure = getChunkFailureReason(candidateChunkResult);
      const invalidReason = schemaFailure || parseFailure;

      if (!invalidReason) {
        writeChunkRaw(chunkIndex, splitIndex || 0, {
          chunkIndex,
          splitIndex,
          attempt,
          prompt: toolResult?.prompt || null,
          rawResponse: toolResult?.rawResponse || toolResult?.response || null,
          parsed: toolResult?.state || null,
          error: null,
          provider: config?.ai?.provider || 'openrouter',
          model: config?.ai?.video?.model || null
        });

        return { toolResult, chunkResult: candidateChunkResult, attempt };
      }

      writeChunkRaw(chunkIndex, splitIndex || 0, {
        chunkIndex,
        splitIndex,
        attempt,
        prompt: toolResult?.prompt || null,
        rawResponse: toolResult?.rawResponse || toolResult?.response || null,
        parsed: toolResult?.state || null,
        error: invalidReason,
        provider: config?.ai?.provider || 'openrouter',
        model: config?.ai?.video?.model || null
      });

      lastError = new Error(`invalid_output: ${invalidReason}`);
      lastError.__rawCaptured = true;
      const shouldRetry = retryConfig.retryOnParseError && attempt < retryConfig.maxAttempts;

      if (!shouldRetry) {
        throw lastError;
      }

      console.warn(`      ⚠️  ${chunkLabel} invalid output on attempt ${attempt}/${retryConfig.maxAttempts}: ${invalidReason}`);
      if (!replayMode && retryConfig.backoffMs > 0) {
        await sleep(retryConfig.backoffMs);
      }
    } catch (error) {
      lastError = error;
      const isInvalidOutputError = typeof error?.message === 'string' && error.message.startsWith('invalid_output:');
      const shouldRetry = isInvalidOutputError
        ? retryConfig.retryOnParseError && attempt < retryConfig.maxAttempts
        : retryConfig.retryOnProviderError && attempt < retryConfig.maxAttempts;

      if (!error.__rawCaptured) {
        writeChunkRaw(chunkIndex, splitIndex || 0, {
          chunkIndex,
          splitIndex,
          attempt,
          prompt: null,
          rawResponse: null,
          parsed: null,
          error: error.message,
          provider: config?.ai?.provider || 'openrouter',
          model: config?.ai?.video?.model || null
        });
      }

      if (!shouldRetry) {
        throw error;
      }

      console.warn(`      ⚠️  ${chunkLabel} ${isInvalidOutputError ? 'invalid output' : 'provider error'} on attempt ${attempt}/${retryConfig.maxAttempts}: ${error.message}`);
      if (!replayMode && retryConfig.backoffMs > 0) {
        await sleep(retryConfig.backoffMs);
      }
    }
  }

  throw lastError || new Error(`${chunkLabel} failed with unknown retry error`);
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
  const rawDir = getRawPhaseDir(outputDir, 'phase2-process');
  const ffmpegRawDir = path.join(rawDir, 'ffmpeg');
  const aiRawDir = path.join(rawDir, 'ai');

  const writeFfmpegRawLog = (name, payload) => {
    if (!captureRaw) return;
    writeRawJson(ffmpegRawDir, name, payload);
  };

  const writeChunkRaw = (chunkIndex, splitIndex, payload) => {
    if (!captureRaw) return;
    const fileName = splitIndex > 0
      ? `chunk-${chunkIndex}-split-${splitIndex}.json`
      : `chunk-${chunkIndex}.json`;
    writeRawJson(aiRawDir, fileName, payload);
  };

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

  const videoModel = config?.ai?.video?.model;
  if (!videoModel) {
    throw new Error('VideoChunks: config.ai.video.model is required');
  }

  const legacyToolModel = toolVariables?.variables?.model;
  if (legacyToolModel && legacyToolModel !== videoModel) {
    throw new Error(
      `VideoChunks: legacy tool_variables.variables.model (${legacyToolModel}) must match config.ai.video.model (${videoModel})`
    );
  }

  const normalizedToolVariables = {
    ...toolVariables,
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
  
  // Create directory for processed chunks (replaces .temp-chunks)
  const chunksDir = path.join(outputDir, 'assets', 'processed', 'chunks');
  fs.mkdirSync(chunksDir, { recursive: true });

  console.log(`   📁 Phase directory: ${phaseDir}`);
  console.log(`   📁 Chunks directory: ${chunksDir}`);

  // Default to keeping processed/intermediate files unless explicitly disabled
  const keepProcessedIntermediates = shouldKeepProcessedIntermediates(config);
  const retryConfig = getRetryConfig(config);

  console.log(`   🔁 Retry config: attempts=${retryConfig.maxAttempts}, backoffMs=${retryConfig.backoffMs}, retryOnParseError=${retryConfig.retryOnParseError}, retryOnProviderError=${retryConfig.retryOnProviderError}`);

  // Track extracted chunk files for cleanup
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
        throw new Error(`Failed to extract chunk ${chunkIndex}: ${extractionResult.error}`);
      }

      const chunkPath = extractionResult.chunkPath;
      extractedChunks.push(chunkPath);

      // Check file size against maxFileSize config
      const maxFileSize = config?.tool_variables?.file_transfer?.maxFileSize;
      let chunksToProcess = [chunkPath];

      if (maxFileSize) {
        const stats = fs.statSync(chunkPath);
        if (stats.size > maxFileSize) {
          console.log(`   ⚠️  Chunk ${chunkIndex + 1} exceeds max file size (${(stats.size / 1024 / 1024).toFixed(2)}MB > ${(maxFileSize / 1024 / 1024).toFixed(2)}MB), splitting...`);
          
          const splitConfig = config?.tool_variables?.split_strategy || {};
          const splitResults = splitStrategy.splitChunk(
            chunkPath,
            maxFileSize,
            splitConfig.maxSplits || 5,
            splitConfig.splitFactor || 0.5,
            0,
            {
              rawLogger: (logName, payload) => writeFfmpegRawLog(logName, payload)
            }
          );
          
          // Remove original chunk from extractedChunks since it's been split
          extractedChunks.splice(extractedChunks.indexOf(chunkPath), 1);
          
          // Add split chunks to extractedChunks for cleanup
          splitResults.forEach(splitPath => extractedChunks.push(splitPath));
          chunksToProcess = splitResults;
        }
      }

      // Process each chunk (original or split chunks)
      for (let splitIndex = 0; splitIndex < chunksToProcess.length; splitIndex++) {
        const currentChunkPath = chunksToProcess[splitIndex];

        // Get relevant dialogue for this chunk
        const dialogueContext = getRelevantDialogue(dialogueData, startTime, endTime);

        // Get relevant music for this chunk
        const musicContext = getRelevantMusic(musicData, startTime, endTime);

        const chunkLabel = `Chunk ${chunkIndex + 1}${splitIndex > 0 ? `.${splitIndex + 1}` : ''}`;

        const analyzeInput = {
          toolVariables: normalizedToolVariables,
          videoContext: {
            chunkPath: currentChunkPath,
            chunkIndex: chunkIndex,
            splitIndex: splitIndex || 0,
            startTime: startTime,
            endTime: endTime,
            duration: endTime - startTime
          },
          dialogueContext: {
            segments: dialogueContext
          },
          musicContext: {
            segments: musicContext
          },
          previousState: {
            summary: previousSummary,
            emotions: results.length > 0 ? results[results.length - 1].emotions : {}
          },
          config
        };

        try {
          const { chunkResult, attempt } = await analyzeChunkWithRetry({
            analyzeInput,
            retryConfig,
            replayMode,
            chunkLabel,
            chunkIndex,
            splitIndex: splitIndex || 0,
            startTime,
            endTime,
            toolVariables,
            config,
            writeChunkRaw
          });

          results.push(chunkResult);
          totalTokens += chunkResult.tokens;
          previousSummary = chunkResult.summary;

          console.log(`      ✅ ${chunkLabel} analyzed (${chunkResult.tokens} tokens)${attempt > 1 ? ` after ${attempt} attempts` : ''}`);
        } catch (error) {
          throw new Error(`${chunkLabel} failed after ${retryConfig.maxAttempts} attempts: ${error.message}`);
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
    console.error('   ❌ Error processing video chunks:', error.message);
    throw error;
  } finally {
    // Handle chunk file cleanup based on config
    if (keepProcessedIntermediates) {
      console.log(`   💾 Keeping extracted chunk files in ${chunksDir}`);
    } else {
      // Clean up extracted chunk files
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

    // Cleanup temp chunks directory if empty
    try {
      if (fs.existsSync(chunksDir)) {
        const files = fs.readdirSync(chunksDir);
        if (files.length === 0) {
          fs.rmSync(chunksDir, { recursive: true, force: true });
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

module.exports = { run };

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
  console.log('   - ffmpeg installed for frame extraction');
  console.log('   - toolVariables with soulPath and goalPath');
  console.log('');
  console.log('Example usage:');
  console.log('  AI_API_KEY=your-key node video-chunks.cjs video.mp4 output/');
}
