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
const { splitChunksByStatus } = require('../../lib/chunk-analysis-status.cjs');

/**
 * Main entry point
 *
 * @async
 * @function run
 * @param {object} input - Script input
 * @param {string} input.outputDir - Base output directory
 * @param {object} input.artifacts - Artifacts from previous phases
 * @param {object} input.config - Pipeline config
 * @returns {Promise<object>} - Script output: { artifacts: object }
 */
async function run(input) {
  const { outputDir, artifacts = {}, config } = input;

  console.log('   📊 Calculating emotion metrics...');

  // Ensure output directory exists
  fs.mkdirSync(outputDir, { recursive: true });

  const {
    chunkAnalysis = { chunks: [], totalTokens: 0, videoDuration: 0 },
    perSecondData = { per_second_data: [], totalSeconds: 0 }
  } = artifacts;

  const chunks = chunkAnalysis.chunks || [];
  const { successfulChunks, failedChunks } = splitChunksByStatus(chunks);
  const perSecondDataArray = perSecondData.per_second_data || [];

  const normalizedPerSecond = normalizePerSecondRows(perSecondDataArray);
  const hasNativePerSecondData = normalizedPerSecond.length > 0;
  const computedPerSecond = hasNativePerSecondData
    ? normalizedPerSecond
    : buildPerSecondFromChunks(successfulChunks, chunkAnalysis.videoDuration || perSecondData.totalSeconds || 0);

  console.log('   📈 Computing averages per emotion lens...');
  const averages = calculateAverageScores(computedPerSecond);

  console.log('   🎯 Finding peak moments...');
  const peakMoments = findPeakMoments(computedPerSecond);

  console.log('   📊 Analyzing emotional trends...');
  const trends = analyzeTrends(computedPerSecond);

  console.log('   ⚡ Calculating friction index...');
  const frictionIndex = calculateFrictionIndex(computedPerSecond);

  const status = computedPerSecond.length > 0
    ? {
        state: 'computed',
        dataSource: hasNativePerSecondData ? 'phase2.perSecondData' : 'derived-from-phase2.chunkAnalysis',
      }
    : {
        state: 'not_implemented',
        reason: 'No usable phase2 emotion timeseries (perSecondData or chunkAnalysis) found.'
      };

  const metrics = {
    generatedAt: new Date().toISOString(),
    pipelineVersion: config?.version || '8.0.0',
    summary: {
      totalChunks: successfulChunks.length,
      failedChunks: failedChunks.length,
      totalSeconds: computedPerSecond.length,
      videoDuration: chunkAnalysis.videoDuration || perSecondData.totalSeconds || 0
    },
    implementationStatus: status,
    averages,
    peakMoments,
    trends,
    frictionIndex
  };

  const metricsDir = outputManager.createReportDirectory(outputDir, 'metrics');
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
        implementationStatus: status,
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

function getEmotionKeysFromRows(rows) {
  const keys = new Set();
  for (const row of rows) {
    for (const key of Object.keys(row || {})) {
      if (key === 'timestamp' || key === 'second' || key === 'chunkIndex' || key === 'confidence' || key === 'dominant_emotion' || key === 'dominantEmotion') {
        continue;
      }
      const value = row[key];
      if (typeof value === 'number') {
        keys.add(key);
      }
    }
  }
  return Array.from(keys);
}

function normalizeScore(rawScore) {
  if (typeof rawScore !== 'number' || Number.isNaN(rawScore)) return 0;
  if (rawScore <= 1) return Math.max(0, rawScore);
  return Math.max(0, Math.min(1, rawScore / 10));
}

function normalizeEmotionMap(source = {}) {
  const normalized = {};
  const metaFields = new Set(['timestamp', 'second', 'chunkIndex', 'confidence', 'dominant_emotion', 'dominantEmotion']);
  for (const [emotion, value] of Object.entries(source)) {
    if (metaFields.has(emotion)) continue;
    if (value && typeof value === 'object' && typeof value.score === 'number') {
      normalized[emotion] = normalizeScore(value.score);
    } else if (typeof value === 'number') {
      normalized[emotion] = normalizeScore(value);
    }
  }
  return normalized;
}

function normalizePerSecondRows(perSecondData = []) {
  return perSecondData.map((row, index) => {
    const fromNested = row && typeof row === 'object' && row.emotions
      ? normalizeEmotionMap(row.emotions)
      : normalizeEmotionMap(row);

    return {
      timestamp: typeof row?.timestamp === 'number' ? row.timestamp : (typeof row?.second === 'number' ? row.second : index),
      ...fromNested,
    };
  }).filter((row) => Object.keys(row).some((key) => key !== 'timestamp'));
}

function buildPerSecondFromChunks(chunks = [], videoDuration = 0) {
  if (!Array.isArray(chunks) || chunks.length === 0) return [];

  const rows = [];
  for (const chunk of chunks) {
    const start = typeof chunk.startTime === 'number' ? chunk.startTime : 0;
    const end = typeof chunk.endTime === 'number' ? chunk.endTime : start;
    const startSecond = Math.floor(start);
    const endSecond = Math.max(startSecond + 1, Math.ceil(end));
    const normalized = normalizeEmotionMap(chunk.emotions || {});

    for (let second = startSecond; second < endSecond; second++) {
      if (videoDuration > 0 && second >= Math.ceil(videoDuration)) break;
      rows.push({
        timestamp: second,
        ...normalized
      });
    }
  }

  const deduped = new Map();
  for (const row of rows) {
    deduped.set(row.timestamp, row);
  }

  return Array.from(deduped.values()).sort((a, b) => a.timestamp - b.timestamp);
}

function calculateAverageScores(perSecondData) {
  if (!perSecondData || perSecondData.length === 0) return {};

  const emotionKeys = getEmotionKeysFromRows(perSecondData);
  if (emotionKeys.length === 0) return {};

  const averages = {};
  for (const emotion of emotionKeys) {
    const scores = perSecondData.map((d) => d[emotion]).filter((score) => typeof score === 'number');
    if (scores.length === 0) continue;
    const sum = scores.reduce((a, b) => a + b, 0);
    averages[emotion] = sum / scores.length;
  }

  return averages;
}

function findPeakMoments(perSecondData) {
  if (!perSecondData || perSecondData.length === 0) return {};

  const emotionKeys = getEmotionKeysFromRows(perSecondData);
  if (emotionKeys.length === 0) return {};

  const peakMoments = {};

  for (const emotion of emotionKeys) {
    let maxScore = -Infinity;
    let minScore = Infinity;
    let maxTimestamp = 0;
    let minTimestamp = 0;

    for (let i = 0; i < perSecondData.length; i++) {
      const score = typeof perSecondData[i][emotion] === 'number' ? perSecondData[i][emotion] : 0;
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
      highest: { timestamp: maxTimestamp, score: maxScore },
      lowest: { timestamp: minTimestamp, score: minScore }
    };
  }

  return peakMoments;
}

function analyzeTrends(perSecondData) {
  if (!perSecondData || perSecondData.length < 2) return {};

  const emotionKeys = getEmotionKeysFromRows(perSecondData);
  if (emotionKeys.length === 0) return {};

  const trends = {};

  for (const emotion of emotionKeys) {
    const scores = perSecondData.map((d) => d[emotion]).filter((score) => typeof score === 'number');
    if (scores.length < 2) continue;

    const midpoint = Math.floor(scores.length / 2);
    const firstHalf = scores.slice(0, midpoint);
    const secondHalf = scores.slice(midpoint);

    const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;

    const change = secondAvg - firstAvg;
    const direction = change > 0.05 ? 'increasing' : change < -0.05 ? 'decreasing' : 'stable';

    trends[emotion] = {
      direction,
      change,
      firstHalfAverage: firstAvg,
      secondHalfAverage: secondAvg
    };
  }

  return trends;
}

function calculateFrictionIndex(perSecondData) {
  if (!perSecondData || perSecondData.length === 0) return 0;

  const emotionKeys = getEmotionKeysFromRows(perSecondData);
  if (emotionKeys.length === 0) return 0;

  let totalVariance = 0;

  for (const emotion of emotionKeys) {
    const scores = perSecondData.map((d) => d[emotion]).filter((score) => typeof score === 'number');
    if (scores.length === 0) continue;

    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
    const variance = scores.reduce((sum, score) => sum + Math.pow(score - avg, 2), 0) / scores.length;
    totalVariance += variance;
  }

  let transitions = 0;
  for (let i = 1; i < perSecondData.length; i++) {
    const prev = perSecondData[i - 1];
    const curr = perSecondData[i];

    for (const emotion of emotionKeys) {
      const diff = Math.abs((curr[emotion] || 0) - (prev[emotion] || 0));
      if (diff > 0.3) transitions++;
    }
  }

  const avgVariance = totalVariance / emotionKeys.length;
  const transitionRate = transitions / (perSecondData.length * emotionKeys.length);
  const frictionIndex = (avgVariance * 60 + transitionRate * 100 * 40);

  return Math.min(100, Math.max(0, frictionIndex));
}

module.exports = { run };

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
