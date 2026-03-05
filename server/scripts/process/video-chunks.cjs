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
const emotionLensesTool = require('../../../tools/emotion-lenses-tool.cjs');
const storage = require('../../lib/storage/storage-interface.js');

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

  // Ensure output directory exists
  fs.mkdirSync(outputDir, { recursive: true });

  // Get video duration
  const duration = await getVideoDuration(assetPath);
  console.log(`   📊 Video duration: ${duration.toFixed(1)}s`);

  // Calculate chunk boundaries
  const chunkDuration = config?.settings?.chunk_duration || 8;
  const maxChunks = config?.settings?.max_chunks || Math.ceil(duration / chunkDuration);
  const numChunks = Math.min(Math.ceil(duration / chunkDuration), maxChunks);

  console.log(`   📦 Processing ${numChunks} chunks (${chunkDuration}s each)...`);

  // Get context from previous phases
  const dialogueData = artifacts.dialogueData || { dialogue_segments: [], summary: '' };
  const musicData = artifacts.musicData || { segments: [], summary: '' };

  const results = [];
  let totalTokens = 0;
  let previousSummary = '';

  // Create temp directory for frames
  const tempDir = path.join(outputDir, '.temp-frames');
  fs.mkdirSync(tempDir, { recursive: true });

  try {
    // Process each chunk
    for (let i = 0; i < numChunks; i++) {
      const startTime = i * chunkDuration;
      const endTime = Math.min(startTime + chunkDuration, duration);
      const chunkDurationActual = endTime - startTime;

      console.log(`   Processing chunk ${i + 1}/${numChunks} (${startTime.toFixed(1)}s - ${endTime.toFixed(1)}s)...`);

      // Extract frame(s) from video
      const framePath = await extractFrame(assetPath, startTime + chunkDurationActual / 2, tempDir, i);

      // Get relevant dialogue for this chunk
      const dialogueContext = getRelevantDialogue(dialogueData, startTime, endTime);

      // Get relevant music for this chunk
      const musicContext = getRelevantMusic(musicData, startTime, endTime);

      // Call emotion-lenses-tool for analysis
      const toolResult = await emotionLensesTool.analyze({
        toolVariables,
        videoContext: {
          frames: [{ path: framePath }],
          duration: chunkDurationActual
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
        chunkIndex: i,
        startTime,
        endTime,
        summary: toolResult.state.summary,
        emotions: toolResult.state.emotions,
        dominant_emotion: toolResult.state.dominant_emotion,
        confidence: toolResult.state.confidence,
        tokens: toolResult.usage.input + toolResult.usage.output,
        persona: {
          soulPath: toolVariables.soulPath,
          lenses: toolVariables.variables?.lenses || []
        }
      };

      results.push(chunkResult);
      totalTokens += chunkResult.tokens;
      previousSummary = chunkResult.summary;

      console.log(`      ✅ Chunk ${i + 1} analyzed (${chunkResult.tokens} tokens)`);
    }

    // Build chunk analysis artifact
    const chunkAnalysis = {
      chunks: results,
      totalTokens,
      persona: {
        soulPath: toolVariables.soulPath,
        goalPath: toolVariables.goalPath,
        config: {
          chunkDuration,
          numChunks
        }
      },
      videoDuration: duration
    };

    // Write artifact
    const artifactPath = path.join(outputDir, 'chunk-analysis.json');
    fs.writeFileSync(artifactPath, JSON.stringify(chunkAnalysis, null, 2));

    console.log('   ✅ Video chunk analysis complete');
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
    // Cleanup temp directory
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
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
    const cmd = `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${videoPath}"`;
    const { stdout } = await execAsync(cmd);
    return parseFloat(stdout.trim()) || 0;
  } catch (error) {
    console.warn('Failed to get video duration, defaulting to 0');
    return 0;
  }
}

/**
 * Extract frame from video at specific timestamp
 * 
 * @async
 * @function extractFrame
 * @param {string} videoPath - Path to video file
 * @param {number} timestamp - Timestamp in seconds
 * @param {string} outputDir - Output directory for frame
 * @param {number} index - Frame index (for filename)
 * @returns {Promise<string>} - Path to extracted frame
 */
async function extractFrame(videoPath, timestamp, outputDir, index) {
  const framePath = path.join(outputDir, `frame-${index.toString().padStart(4, '0')}.jpg`);

  try {
    await execAsync(
      `ffmpeg -i "${videoPath}" -ss ${timestamp} -vframes 1 -q:v 2 -y "${framePath}" 2>/dev/null`
    );
    return framePath;
  } catch (error) {
    throw new Error(`Failed to extract frame at ${timestamp}s: ${error.message}`);
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
