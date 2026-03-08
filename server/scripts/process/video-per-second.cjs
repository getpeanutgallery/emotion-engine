#!/usr/bin/env node
/**
 * Video Per-Second Script
 * 
 * Generates emotion scores for every second of video by interpolating from chunk analysis.
 * This script runs in Phase 2 (Process) of the pipeline, after video-chunks.cjs.
 * 
 * @module scripts/process/video-per-second
 */

const fs = require('fs');
const path = require('path');
const outputManager = require('../../lib/output-manager.cjs');
const { splitChunksByStatus } = require('../../lib/chunk-analysis-status.cjs');

/**
 * Script Input Contract
 * @typedef {Object} VideoPerSecondInput
 * @property {string} assetPath - Path to video file
 * @property {string} outputDir - Output directory
 * @property {Object} [artifacts] - Artifacts from previous phases
 * @property {Object} artifacts.chunkAnalysis - Chunk analysis from video-chunks.cjs
 * @property {Object} [config] - Pipeline config
 */

/**
 * Script Output Contract
 * @typedef {Object} VideoPerSecondOutput
 * @property {Object} artifacts - Script artifacts
 * @property {Object} artifacts.perSecondData - Per-second emotion data
 * @property {Array} artifacts.perSecondData.per_second_data - Second-by-second data
 * @property {number} artifacts.perSecondData.totalTokens - Total tokens (from chunk analysis)
 * @property {string} artifacts.perSecondData.summary - Summary text
 */

/**
 * Main entry point
 * 
 * @async
 * @function run
 * @param {VideoPerSecondInput} input - Script input
 * @returns {Promise<VideoPerSecondOutput>} - Script output
 */
async function run(input) {
  const {
    assetPath,
    outputDir,
    artifacts = {},
    config
  } = input;

  console.log('   ⏱️  Generating per-second emotion analysis...');

  // Ensure output directory exists
  fs.mkdirSync(outputDir, { recursive: true });

  // Create phase directory for artifacts
  const phaseDir = outputManager.createPhaseDirectory(outputDir, 'phase2-process');
  console.log(`   📁 Phase directory: ${phaseDir}`);

  // Get chunk analysis from previous phase
  const chunkAnalysis = artifacts.chunkAnalysis;

  if (!chunkAnalysis || !chunkAnalysis.chunks || chunkAnalysis.chunks.length === 0) {
    throw new Error('VideoPerSecond: chunkAnalysis artifact is required from video-chunks.cjs');
  }

  const { chunks, videoDuration = 0 } = chunkAnalysis;
  const { successfulChunks, failedChunks } = splitChunksByStatus(chunks || []);
  const totalSeconds = Math.floor(videoDuration);

  console.log(`   📊 Video duration: ${videoDuration.toFixed(1)}s (${totalSeconds} seconds)`);
  console.log(`   📈 Interpolating from ${successfulChunks.length} successful chunks...`);
  if (failedChunks.length > 0) {
    console.log(`   ⚠️  Excluding ${failedChunks.length} failed chunks from per-second interpolation`);
  }

  // Generate per-second data by interpolating from chunks
  const perSecondData = [];

  for (let second = 0; second < totalSeconds; second++) {
    // Find the chunk that contains this second
    const chunk = successfulChunks.find(c => c.startTime <= second && c.endTime > second);

    if (chunk) {
      // Use chunk's emotion scores (could interpolate between chunks for smoother transitions)
      const emotions = {};
      
      for (const [lens, data] of Object.entries(chunk.emotions || {})) {
        emotions[lens] = {
          score: data.score || 5,
          reasoning: data.reasoning || ''
        };
      }

      // Determine dominant emotion
      const dominant_emotion = chunk.dominant_emotion || findDominantEmotion(emotions);

      perSecondData.push({
        second,
        timestamp: second,
        emotions,
        dominant_emotion,
        chunkIndex: chunk.chunkIndex,
        confidence: chunk.confidence || 0.8
      });
    } else {
      // No chunk covers this second (shouldn't happen, but handle gracefully)
      perSecondData.push({
        second,
        timestamp: second,
        emotions: {},
        dominant_emotion: 'unknown',
        chunkIndex: -1,
        confidence: 0
      });
    }
  }

  // Generate summary statistics
  const summary = generateSummary(perSecondData, successfulChunks);

  // Build per-second artifact
  const perSecondArtifact = {
    per_second_data: perSecondData,
    totalSeconds,
    totalTokens: chunkAnalysis.totalTokens || 0,
    summary,
    metadata: {
      numChunks: successfulChunks.length,
      failedChunks: failedChunks.length,
      videoDuration: videoDuration,
      generatedAt: new Date().toISOString()
    }
  };

  // Write artifact to phase directory
  const artifactPath = path.join(phaseDir, 'per-second-data.json');
  fs.writeFileSync(artifactPath, JSON.stringify(perSecondArtifact, null, 2));

  console.log('   ✅ Per-second analysis complete');
  console.log(`      Artifact path: ${artifactPath}`);
  console.log(`      Generated ${perSecondData.length} data points`);
  console.log(`      Summary: ${summary}`);

  return {
    artifacts: {
      perSecondData: perSecondArtifact
    }
  };
}

/**
 * Find dominant emotion from emotion scores
 * 
 * @function findDominantEmotion
 * @param {Object} emotions - Emotion scores
 * @returns {string} - Dominant emotion name
 */
function findDominantEmotion(emotions) {
  let maxScore = -1;
  let dominant = 'neutral';

  for (const [lens, data] of Object.entries(emotions)) {
    const score = data?.score || 0;
    if (score > maxScore) {
      maxScore = score;
      dominant = lens;
    }
  }

  return dominant;
}

/**
 * Generate summary from per-second data
 * 
 * @function generateSummary
 * @param {Array} perSecondData - Per-second emotion data
 * @param {Array} chunks - Original chunk data
 * @returns {string} - Summary text
 */
function generateSummary(perSecondData, chunks) {
  if (perSecondData.length === 0) {
    return 'No data available for summary';
  }

  // Calculate average scores per emotion
  const emotionTotals = {};
  const emotionCounts = {};

  for (const data of perSecondData) {
    for (const [lens, emotionData] of Object.entries(data.emotions || {})) {
      if (!emotionTotals[lens]) {
        emotionTotals[lens] = 0;
        emotionCounts[lens] = 0;
      }
      emotionTotals[lens] += emotionData.score || 0;
      emotionCounts[lens]++;
    }
  }

  // Build summary
  const averages = [];
  for (const lens of Object.keys(emotionTotals)) {
    const avg = emotionTotals[lens] / emotionCounts[lens];
    averages.push(`${lens}: ${avg.toFixed(1)}/10`);
  }

  // Find most common dominant emotion
  const dominantCounts = {};
  for (const data of perSecondData) {
    const dominant = data.dominant_emotion || 'unknown';
    dominantCounts[dominant] = (dominantCounts[dominant] || 0) + 1;
  }

  let mostCommonDominant = 'unknown';
  let maxCount = 0;
  for (const [emotion, count] of Object.entries(dominantCounts)) {
    if (count > maxCount) {
      maxCount = count;
      mostCommonDominant = emotion;
    }
  }

  return `Analyzed ${perSecondData.length} seconds across ${chunks.length} chunks. ` +
         `Average scores: ${averages.join(', ')}. ` +
         `Most common dominant emotion: ${mostCommonDominant} (${maxCount} seconds).`;
}

module.exports = { run };

// Allow standalone execution for testing
if (require.main === module) {
  const outputDir = process.argv[2] || 'output/test-per-second';

  console.log('Video Per-Second Script - Test Mode');
  console.log('Output:', outputDir);
  console.log('');
  console.log('⚠️  This script requires:');
  console.log('   - chunkAnalysis artifact from video-chunks.cjs');
  console.log('');
  console.log('Example usage:');
  console.log('  node video-per-second.cjs output/');
}
