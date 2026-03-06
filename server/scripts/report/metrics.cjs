#!/usr/bin/env node
/**
 * Metrics Report Script
 * 
 * Calculates and saves emotion metrics from chunk analysis and per-second data.
 * This script runs in Phase 3 (Report) of the pipeline.
 * 
 * @module scripts/report/metrics
 */

const fs = require('fs');
const path = require('path');
const outputManager = require('../../lib/output-manager.cjs');

/**
 * Main entry point
 * 
 * @async
 * @function run
 * @param {object} input - Script input
 * @param {string} input.outputDir - Base output directory
 * @param {object} input.artifacts - Artifacts from previous phases
 *   @param {array} input.artifacts.chunkAnalysis.chunks - Array of chunk results
 *   @param {array} input.artifacts.perSecondData.per_second_data - Per-second emotion scores
 * @param {object} input.config - Pipeline config
 * @returns {Promise<object>} - Script output: { artifacts: object }
 */
async function run(input) {
  const { outputDir, artifacts = {}, config } = input;

  console.log('   📊 Calculating emotion metrics...');

  // Ensure output directory exists
  fs.mkdirSync(outputDir, { recursive: true });

  // Extract artifacts from previous phases
  const {
    chunkAnalysis = { chunks: [], totalTokens: 0, videoDuration: 0 },
    perSecondData = { per_second_data: [], totalSeconds: 0 }
  } = artifacts;

  const chunks = chunkAnalysis.chunks || [];
  const perSecondDataArray = perSecondData.per_second_data || [];

  // Calculate metrics
  console.log('   📈 Computing averages per emotion lens...');
  const averages = calculateAverageScores(perSecondDataArray);

  console.log('   🎯 Finding peak moments...');
  const peakMoments = findPeakMoments(perSecondDataArray);

  console.log('   📊 Analyzing emotional trends...');
  const trends = analyzeTrends(perSecondDataArray);

  console.log('   ⚡ Calculating friction index...');
  const frictionIndex = calculateFrictionIndex(perSecondDataArray, chunks);

  // Build metrics object
  const metrics = {
    generatedAt: new Date().toISOString(),
    pipelineVersion: config?.version || '8.0.0',
    summary: {
      totalChunks: chunks.length,
      totalSeconds: perSecondDataArray.length,
      videoDuration: chunkAnalysis.videoDuration || perSecondData.totalSeconds || 0
    },
    averages,
    peakMoments,
    trends,
    frictionIndex
  };

  // Create metrics subdirectory under phase3-report
  const metricsDir = outputManager.createReportDirectory(outputDir, 'metrics');

  // Save metrics JSON
  const metricsPath = path.join(metricsDir, 'metrics.json');
  fs.writeFileSync(metricsPath, JSON.stringify(metrics, null, 2), 'utf8');
  console.log(`   ✅ Metrics saved to: ${metricsPath}`);

  return {
    artifacts: {
      metricsData: {
        path: metricsPath,
        generatedAt: metrics.generatedAt,
        averages,
        peakMoments,
        trends,
        frictionIndex,
        summary: {
          averages: Object.keys(averages).length,
          peakMoments: Object.keys(peakMoments).length,
          trends: Object.keys(trends).length,
          frictionIndex: frictionIndex
        }
      }
    }
  };
}

/**
 * Calculate average scores per emotion lens
 * 
 * @function calculateAverageScores
 * @param {array} perSecondData - Array of per-second emotion scores
 * @returns {object} - Average scores per emotion
 */
function calculateAverageScores(perSecondData) {
  if (!perSecondData || perSecondData.length === 0) {
    return {};
  }

  const emotionKeys = ['boredom', 'excitement', 'curiosity', 'tension', 'satisfaction'];
  const averages = {};

  for (const emotion of emotionKeys) {
    const scores = perSecondData.map(d => d[emotion] || 0);
    const sum = scores.reduce((a, b) => a + b, 0);
    averages[emotion] = sum / perSecondData.length;
  }

  return averages;
}

/**
 * Find peak moments (highest and lowest) per emotion
 * 
 * @function findPeakMoments
 * @param {array} perSecondData - Array of per-second emotion scores
 * @returns {object} - Peak moments per emotion
 */
function findPeakMoments(perSecondData) {
  if (!perSecondData || perSecondData.length === 0) {
    return {};
  }

  const emotionKeys = ['boredom', 'excitement', 'curiosity', 'tension', 'satisfaction'];
  const peakMoments = {};

  for (const emotion of emotionKeys) {
    let maxScore = -Infinity;
    let minScore = Infinity;
    let maxTimestamp = 0;
    let minTimestamp = 0;

    for (let i = 0; i < perSecondData.length; i++) {
      const score = perSecondData[i][emotion] || 0;
      const timestamp = perSecondData[i].timestamp || i;

      if (score > maxScore) {
        maxScore = score;
        maxTimestamp = timestamp;
      }

      if (score < minScore) {
        minScore = score;
        minTimestamp = timestamp;
      }
    }

    peakMoments[emotion] = {
      highest: {
        timestamp: maxTimestamp,
        score: maxScore
      },
      lowest: {
        timestamp: minTimestamp,
        score: minScore
      }
    };
  }

  return peakMoments;
}

/**
 * Analyze emotional trends (increasing/decreasing over time)
 * 
 * @function analyzeTrends
 * @param {array} perSecondData - Array of per-second emotion scores
 * @returns {object} - Trend analysis per emotion
 */
function analyzeTrends(perSecondData) {
  if (!perSecondData || perSecondData.length < 2) {
    return {};
  }

  const emotionKeys = ['boredom', 'excitement', 'curiosity', 'tension', 'satisfaction'];
  const trends = {};

  for (const emotion of emotionKeys) {
    const scores = perSecondData.map(d => d[emotion] || 0);
    
    // Simple linear trend: compare first half average to second half average
    const midpoint = Math.floor(scores.length / 2);
    const firstHalf = scores.slice(0, midpoint);
    const secondHalf = scores.slice(midpoint);

    const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;

    const change = secondAvg - firstAvg;
    const direction = change > 0.05 ? 'increasing' : change < -0.05 ? 'decreasing' : 'stable';

    trends[emotion] = {
      direction,
      change: change,
      firstHalfAverage: firstAvg,
      secondHalfAverage: secondAvg
    };
  }

  return trends;
}

/**
 * Calculate friction index (weighted formula)
 * 
 * Friction index measures emotional conflict/instability.
 * Higher values indicate more emotional friction.
 * 
 * @function calculateFrictionIndex
 * @param {array} perSecondData - Array of per-second emotion scores
 * @param {array} chunks - Array of chunk results
 * @returns {number} - Friction index (0-100 scale)
 */
function calculateFrictionIndex(perSecondData, chunks) {
  if (!perSecondData || perSecondData.length === 0) {
    return 0;
  }

  // Calculate variance for each emotion
  const emotionKeys = ['boredom', 'excitement', 'curiosity', 'tension', 'satisfaction'];
  let totalVariance = 0;

  for (const emotion of emotionKeys) {
    const scores = perSecondData.map(d => d[emotion] || 0);
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
    const variance = scores.reduce((sum, score) => sum + Math.pow(score - avg, 2), 0) / scores.length;
    totalVariance += variance;
  }

  // Calculate transition frequency (how often emotions change significantly)
  let transitions = 0;
  for (let i = 1; i < perSecondData.length; i++) {
    const prev = perSecondData[i - 1];
    const curr = perSecondData[i];
    
    for (const emotion of emotionKeys) {
      const diff = Math.abs((curr[emotion] || 0) - (prev[emotion] || 0));
      if (diff > 0.3) {
        transitions++;
      }
    }
  }

  // Normalize to 0-100 scale
  const avgVariance = totalVariance / emotionKeys.length;
  const transitionRate = transitions / (perSecondData.length * emotionKeys.length);
  
  // Weighted formula: variance (60%) + transition rate (40%)
  const frictionIndex = (avgVariance * 60 + transitionRate * 100 * 40);

  // Clamp to 0-100
  return Math.min(100, Math.max(0, frictionIndex));
}

module.exports = { run };

// Allow standalone execution for testing
if (require.main === module) {
  const outputDir = process.argv[2] || 'output/test';
  
  run({
    outputDir,
    artifacts: {
      chunkAnalysis: {
        chunks: [{ emotions: { boredom: 0.5, excitement: 0.3 } }],
        videoDuration: 120
      },
      perSecondData: {
        per_second_data: [
          { timestamp: 0, boredom: 0.4, excitement: 0.6, curiosity: 0.5, tension: 0.3, satisfaction: 0.7 },
          { timestamp: 1, boredom: 0.5, excitement: 0.5, curiosity: 0.4, tension: 0.4, satisfaction: 0.6 },
          { timestamp: 2, boredom: 0.6, excitement: 0.4, curiosity: 0.3, tension: 0.5, satisfaction: 0.5 }
        ],
        totalSeconds: 3
      }
    },
    config: { version: '8.0.0', name: 'Test Pipeline' }
  })
    .then(result => {
      console.log('Metrics calculation complete:', JSON.stringify(result.artifacts, null, 2));
    })
    .catch(console.error);
}
