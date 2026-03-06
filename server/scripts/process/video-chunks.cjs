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
const ffmpegPath = require('ffmpeg-static');
const ffprobePath = require('ffprobe-static').path;

const execAsync = promisify(exec);

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

  // Verify AI_API_KEY is available
  if (!process.env.AI_API_KEY) {
    console.error('   ❌ ERROR: AI_API_KEY environment variable is not set');
    throw new Error('AI_API_KEY is required for chunk analysis');
  }

  // Ensure output directory exists
  fs.mkdirSync(outputDir, { recursive: true });

  // Get video duration
  const duration = await getVideoDuration(assetPath);
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

  // Check debug config for keeping temp files
  const keepTempFiles = config?.debug?.keepTempFiles === true;
  const keepProcessedAssets = config?.debug?.keepProcessedAssets !== false;
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);

  // Track extracted chunk files for cleanup
  const extractedChunks = [];

  try {
    // Process each chunk
    for (let chunkIndex = 0; chunkIndex < numChunks; chunkIndex++) {
      const boundary = limitedBoundaries[chunkIndex];
      const startTime = boundary.startTime;
      const endTime = boundary.endTime;
      const chunkDurationActual = endTime - startTime;

      console.log(`   Processing chunk ${chunkIndex + 1}/${numChunks} (${startTime.toFixed(1)}s - ${endTime.toFixed(1)}s)...`);

      // Extract video chunk from source
      const extractionResult = await videoChunkExtractor.extractVideoChunk(
        assetPath,
        startTime,
        endTime,
        chunksDir,
        chunkIndex
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
            splitConfig.splitFactor || 0.5
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

        // Prepare tool variables for error logging
        const toolVariablesForLogging = {
          soulPath: toolVariables.soulPath,
          goalPath: toolVariables.goalPath,
          variables: toolVariables.variables
        };

        // Prepare video context for error logging
        const videoContextForLogging = {
          chunkPath: currentChunkPath,
          chunkIndex: chunkIndex,
          splitIndex: splitIndex || 0,
          startTime: startTime,
          endTime: endTime,
          duration: endTime - startTime
        };

        // Call emotion-lenses-tool for analysis with error handling
        try {
          const toolResult = await emotionLensesTool.analyze({
            toolVariables,
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
            }
          });

          // Collect result
          const chunkResult = {
            chunkIndex: chunkIndex,
            splitIndex: splitIndex || 0,
            startTime,
            endTime,
            summary: toolResult.state.summary,
            emotions: toolResult.state.emotions,
            dominant_emotion: toolResult.state.dominant_emotion,
            confidence: toolResult.state.confidence,
            tokens: toolResult.usage.input + toolResult.usage.output,
            persona: {
              soulPath: toolVariables.soulPath,
              goalPath: toolVariables.goalPath,
              lenses: toolVariables.variables?.lenses || []
            }
          };

          results.push(chunkResult);
          totalTokens += chunkResult.tokens;
          previousSummary = chunkResult.summary;

          console.log(`      ✅ Chunk ${chunkIndex + 1}${splitIndex > 0 ? `.${splitIndex + 1}` : ''} analyzed (${chunkResult.tokens} tokens)`);
        } catch (error) {
          console.error(`      ❌ Chunk ${chunkIndex + 1} analysis failed:`, error.message);
          console.error(`      Stack:`, error.stack);
          console.error(`      Tool variables:`, JSON.stringify(toolVariablesForLogging, null, 2));
          console.error(`      Video context:`, JSON.stringify(videoContextForLogging, null, 2));
          throw error;
        }
      }
    }

    // Build chunk analysis artifact
    const chunkAnalysis = {
      chunks: results,
      totalTokens,
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
    console.log(`      Average per chunk: ${(totalTokens / numChunks).toFixed(0)} tokens`);

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
    if (keepTempFiles && keepProcessedAssets) {
      // Move chunk files to assets/processed/chunks/ with timestamp to avoid overwrites
      const destDir = path.join(phaseDir, 'assets', 'processed', 'chunks', timestamp);
      fs.mkdirSync(destDir, { recursive: true });
      
      try {
        for (const chunkPath of extractedChunks) {
          if (fs.existsSync(chunkPath)) {
            const chunkName = path.basename(chunkPath);
            const destPath = path.join(destDir, chunkName);
            fs.copyFileSync(chunkPath, destPath);
            console.log(`   💾 Kept chunk file for debugging: ${chunkName} → ${destPath}`);
          }
        }
        console.log(`   💾 Debug mode: Chunk files preserved in ${destDir}`);
      } catch (e) {
        console.warn('   ⚠️  Warning: Failed to copy some chunk files:', e.message);
      }
    } else if (keepTempFiles) {
      console.log(`   💾 Debug mode: Chunk files kept in ${chunksDir}`);
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
async function getVideoDuration(videoPath) {
  try {
    const cmd = `"${ffprobePath}" -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${videoPath}"`;
    const { stdout } = await execAsync(cmd);
    return parseFloat(stdout.trim()) || 0;
  } catch (error) {
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
