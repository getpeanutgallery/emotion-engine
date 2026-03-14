#!/usr/bin/env node
/**
 * Emotional Analysis Report Script
 *
 * Performs deep emotional analysis per chunk with detailed breakdowns.
 * Calculates emotional velocity, identifies critical moments, and builds
 * emotional arc visualization data.
 *
 * This script runs in Phase 3 (Report) of the pipeline.
 *
 * @module scripts/report/emotional-analysis
 */

const fs = require('fs');
const path = require('path');
const outputManager = require('../../lib/output-manager.cjs');
const { splitChunksByStatus } = require('../../lib/chunk-analysis-status.cjs');

const THRESHOLDS = {
  boredom: { high: 0.7, low: 0.3 },
  excitement: { high: 0.7, low: 0.3 },
  curiosity: { high: 0.7, low: 0.3 },
  tension: { high: 0.7, low: 0.3 },
  satisfaction: { high: 0.7, low: 0.3 }
};

const SCROLL_RISK_WEIGHTS = {
  boredom: 0.4,
  excitement: -0.3,
  curiosity: -0.2,
  tension: -0.05,
  satisfaction: -0.05
};

async function run(input) {
  const { outputDir, artifacts = {}, config } = input;

  console.log('💓 Performing deep emotional analysis...');

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

  console.log('📊 Analyzing emotional breakdown per chunk...');
  const chunkAnalysisResults = successfulChunks.map((chunk, index) =>
    processChunk(chunk, index, computedPerSecond)
  );

  console.log('📈 Building emotional arc data...');
  const emotionalArc = buildEmotionalArc(computedPerSecond);

  console.log('⚠️  Calculating scroll risk timeline...');
  const scrollRiskTimeline = calculateScrollRiskTimeline(computedPerSecond);

  console.log('🎯 Identifying critical emotional moments...');
  const criticalMoments = identifyCriticalMoments(computedPerSecond, successfulChunks);

  const status = computedPerSecond.length > 0
    ? {
        state: 'computed',
        dataSource: hasNativePerSecondData ? 'phase2.perSecondData' : 'derived-from-phase2.chunkAnalysis',
      }
    : {
        state: 'not_implemented',
        reason: 'No usable phase2 emotion timeseries (perSecondData or chunkAnalysis) found.'
      };

  const emotionalData = {
    generatedAt: new Date().toISOString(),
    pipelineVersion: config?.version || '8.0.0',
    implementationStatus: status,
    summary: {
      totalChunks: successfulChunks.length,
      failedChunks: failedChunks.length,
      totalSeconds: computedPerSecond.length,
      videoDuration: chunkAnalysis.videoDuration || perSecondData.totalSeconds || 0,
      criticalMomentsCount: criticalMoments.length,
      averageScrollRisk: calculateAverageScrollRisk(scrollRiskTimeline)
    },
    chunkAnalysis: chunkAnalysisResults,
    failedChunkDetails: failedChunks.map((chunk) => ({
      chunkIndex: chunk.chunkIndex,
      startTime: chunk.startTime,
      endTime: chunk.endTime,
      status: 'failed',
      errorReason: chunk.errorReason || 'chunk_marked_failed'
    })),
    emotionalArc,
    scrollRiskTimeline,
    criticalMoments
  };

  const analysisDir = outputManager.createReportDirectory(outputDir, 'emotional-analysis');
  const emotionalDataPath = path.join(analysisDir, 'emotional-data.json');
  fs.writeFileSync(emotionalDataPath, JSON.stringify(emotionalData, null, 2), 'utf8');
  console.log(`✅ Emotional analysis saved to: ${emotionalDataPath}`);

  const warnings = [];
  if (!hasNativePerSecondData && computedPerSecond.length > 0) {
    warnings.push('Derived emotional analysis timeline from chunkAnalysis because native perSecondData was unavailable.');
  }
  if (failedChunks.length > 0) {
    warnings.push(`Excluded ${failedChunks.length} failed chunk(s) from emotional arc aggregation.`);
  }
  if (computedPerSecond.length === 0) {
    warnings.push('No usable phase2 emotion timeseries was available; emitted schema-valid placeholder emotional analysis for downstream continuity.');
  }

  return {
    primaryArtifactKey: 'emotionalAnalysis',
    metrics: {
      totalSeconds: computedPerSecond.length,
      successfulChunks: successfulChunks.length,
      failedChunks: failedChunks.length,
      criticalMoments: criticalMoments.length
    },
    diagnostics: {
      degraded: warnings.length > 0,
      warnings
    },
    artifacts: {
      emotionalAnalysis: {
        path: emotionalDataPath,
        generatedAt: emotionalData.generatedAt,
        summary: emotionalData.summary,
        implementationStatus: status,
        chunkAnalysis: emotionalData.chunkAnalysis,
        emotionalArc: emotionalData.emotionalArc,
        insights: emotionalData.insights,
        dominantEmotions: emotionalData.dominantEmotions
      }
    }
  };
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
      rows.push({ timestamp: second, ...normalized });
    }
  }

  const deduped = new Map();
  for (const row of rows) deduped.set(row.timestamp, row);
  return Array.from(deduped.values()).sort((a, b) => a.timestamp - b.timestamp);
}

function getEmotionKeysFromRows(rows = []) {
  const keys = new Set();
  for (const row of rows) {
    for (const [key, value] of Object.entries(row || {})) {
      if (key === 'timestamp' || key === 'second' || key === 'chunkIndex' || key === 'confidence' || key === 'dominant_emotion' || key === 'dominantEmotion') continue;
      if (typeof value === 'number') keys.add(key);
    }
  }
  return Array.from(keys);
}

function processChunk(chunk, chunkIndex, perSecondData) {
  const emotions = normalizeEmotionMap(chunk.emotions || {});
  const startTime = chunk.startTime || chunkIndex * 10;
  const endTime = chunk.endTime || startTime + 10;

  const chunkPerSecondData = perSecondData.filter(
    d => d.timestamp >= startTime && d.timestamp < endTime
  );

  const emotionalVelocity = calculateEmotionalVelocity(emotions, startTime, chunkPerSecondData, perSecondData);
  const scrollRisk = calculateChunkScrollRisk(emotions);
  const dominantEmotion = findDominantEmotion(emotions);

  return {
    chunkIndex,
    startTime,
    endTime,
    duration: endTime - startTime,
    emotions,
    emotionalVelocity,
    scrollRisk,
    scrollRiskLevel: getScrollRiskLevel(scrollRisk),
    dominantEmotion,
    emotionalSignature: buildEmotionalSignature(emotions),
    dataPoints: chunkPerSecondData.length
  };
}

function calculateEmotionalVelocity(currentEmotions, currentTime, chunkPerSecondData, fullPerSecondData) {
  const velocity = {};
  const emotionKeys = new Set([
    ...Object.keys(currentEmotions || {}),
    ...getEmotionKeysFromRows(chunkPerSecondData),
    ...getEmotionKeysFromRows(fullPerSecondData),
  ]);

  const previousTime = Math.max(0, currentTime - 10);
  const previousEmotions = getAverageEmotionsForTimeRange(fullPerSecondData, previousTime - 10, previousTime);

  for (const emotion of emotionKeys) {
    const currentScore = currentEmotions[emotion] || 0;
    const previousScore = previousEmotions[emotion] || 0;
    const timeDelta = currentTime - previousTime || 1;
    velocity[emotion] = (currentScore - previousScore) / timeDelta;
  }

  return velocity;
}

function getAverageEmotionsForTimeRange(perSecondData, startTime, endTime) {
  const filtered = perSecondData.filter(
    d => d.timestamp >= startTime && d.timestamp < endTime
  );

  if (filtered.length === 0) {
    return {};
  }

  const emotionKeys = getEmotionKeysFromRows(filtered);
  const averages = {};

  for (const emotion of emotionKeys) {
    const sum = filtered.reduce((acc, d) => acc + (d[emotion] || 0), 0);
    averages[emotion] = sum / filtered.length;
  }

  return averages;
}

function calculateChunkScrollRisk(emotions) {
  let risk = 0;

  for (const [emotion, weight] of Object.entries(SCROLL_RISK_WEIGHTS)) {
    risk += (emotions[emotion] || 0) * weight;
  }

  return Math.min(1, Math.max(0, risk + 0.5));
}

function getScrollRiskLevel(risk) {
  if (risk >= 0.75) return 'critical';
  if (risk >= 0.5) return 'high';
  if (risk >= 0.25) return 'medium';
  return 'low';
}

function findDominantEmotion(emotions) {
  let dominant = { emotion: 'neutral', score: 0 };

  for (const [emotion, score] of Object.entries(emotions)) {
    if (typeof score === 'number' && score > dominant.score) {
      dominant = { emotion, score };
    }
  }

  return dominant;
}

function buildEmotionalSignature(emotions) {
  const parts = [];

  for (const [emotion, score] of Object.entries(emotions)) {
    const level = score >= 0.7 ? 'high' : score >= 0.4 ? 'moderate' : 'low';
    parts.push(`${level}-${emotion}`);
  }

  return parts.join('-');
}

function buildEmotionalArc(perSecondData) {
  if (!perSecondData || perSecondData.length === 0) {
    return { timestamps: [], emotions: {} };
  }

  const timestamps = perSecondData.map(d => d.timestamp || 0);
  const emotionKeys = getEmotionKeysFromRows(perSecondData);
  const emotions = {};

  for (const emotion of emotionKeys) {
    emotions[emotion] = perSecondData.map(d => d[emotion] || 0);
  }

  const windowSize = 5;
  const smoothedEmotions = {};

  for (const emotion of emotionKeys) {
    smoothedEmotions[emotion] = calculateMovingAverage(emotions[emotion], windowSize);
  }

  return {
    timestamps,
    emotions,
    smoothedEmotions,
    windowSize
  };
}

function calculateMovingAverage(data, windowSize) {
  const smoothed = [];

  for (let i = 0; i < data.length; i++) {
    const start = Math.max(0, i - Math.floor(windowSize / 2));
    const end = Math.min(data.length, i + Math.floor(windowSize / 2) + 1);
    const slice = data.slice(start, end);
    const avg = slice.reduce((a, b) => a + b, 0) / slice.length;
    smoothed.push(avg);
  }

  return smoothed;
}

function calculateScrollRiskTimeline(perSecondData) {
  return perSecondData.map(d => {
    const emotions = normalizeEmotionMap(d);
    const scrollRisk = calculateChunkScrollRisk(emotions);
    return {
      timestamp: d.timestamp || 0,
      scrollRisk,
      scrollRiskLevel: getScrollRiskLevel(scrollRisk),
      dominantEmotion: findDominantEmotion(emotions).emotion
    };
  });
}

function calculateAverageScrollRisk(timeline) {
  if (!timeline || timeline.length === 0) return 0;

  const total = timeline.reduce((sum, point) => sum + point.scrollRisk, 0);
  return total / timeline.length;
}

function identifyCriticalMoments(perSecondData, chunks) {
  const criticalMoments = [];
  const availableEmotionKeys = getEmotionKeysFromRows(perSecondData);
  const thresholdEmotionKeys = availableEmotionKeys.filter((emotion) => THRESHOLDS[emotion]);

  for (let i = 0; i < perSecondData.length; i++) {
    const data = perSecondData[i];
    const timestamp = data.timestamp || i;
    const prevData = i > 0 ? perSecondData[i - 1] : null;

    for (const emotion of thresholdEmotionKeys) {
      const score = data[emotion] || 0;
      const prevScore = prevData ? (prevData[emotion] || 0) : score;
      const thresholds = THRESHOLDS[emotion];

      const crossedHigh = prevScore < thresholds.high && score >= thresholds.high;
      const crossedLow = prevScore > thresholds.low && score <= thresholds.low;

      if (crossedHigh || crossedLow) {
        criticalMoments.push({
          timestamp,
          emotion,
          type: crossedHigh ? 'threshold-high' : 'threshold-low',
          score,
          previousScore: prevScore,
          threshold: crossedHigh ? thresholds.high : thresholds.low,
          chunkIndex: findChunkForTimestamp(timestamp, chunks),
          severity: calculateCrossingSeverity(score, prevScore, thresholds),
          context: buildMomentContext(data, emotion)
        });
      }
    }
  }

  criticalMoments.sort((a, b) => b.severity - a.severity);

  return criticalMoments;
}

function findChunkForTimestamp(timestamp, chunks) {
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const startTime = chunk.startTime || i * 10;
    const endTime = chunk.endTime || startTime + 10;

    if (timestamp >= startTime && timestamp < endTime) {
      return i;
    }
  }
  return -1;
}

function calculateCrossingSeverity(currentScore, previousScore, thresholds) {
  const change = Math.abs(currentScore - previousScore);
  const distanceFromThreshold = Math.abs(currentScore - thresholds.high);
  return Math.min(1, change * 0.5 + (1 - distanceFromThreshold) * 0.5);
}

function buildMomentContext(data, triggeredEmotion) {
  const emotions = Object.entries(data)
    .filter(([key, value]) => key !== 'timestamp' && typeof value === 'number')
    .map(([emotion, score]) => `${emotion}: ${(score * 100).toFixed(0)}%`)
    .join(', ');

  return `${triggeredEmotion} threshold crossed. Emotional state: ${emotions}`;
}

const deterministicRecovery = {
  script: 'emotional-analysis',
  family: 'computed.report.v1',
  knownStrategies: [
    { id: 'reload-persisted-artifacts', kind: 'rebuild', consumesAttempt: true, terminalIfUnavailable: false },
    { id: 'recompute-from-upstream-artifacts', kind: 'rebuild', consumesAttempt: true, terminalIfUnavailable: false }
  ],
  degradedSuccess: {
    allowed: true,
    conditions: [
      'emotional arc data may be derived from successful chunkAnalysis when perSecondData is unavailable',
      'placeholder emotional-analysis outputs are allowed only when downstream summary/final-report continuity is explicitly preserved'
    ]
  }
};

module.exports = { run, deterministicRecovery };

if (require.main === module) {
  const outputDir = process.argv[2] || 'output/test';

  run({
    outputDir,
    artifacts: {
      chunkAnalysis: {
        chunks: [
          {
            startTime: 0,
            endTime: 10,
            emotions: { boredom: 0.5, excitement: 0.3, curiosity: 0.6, tension: 0.2, satisfaction: 0.4 }
          },
          {
            startTime: 10,
            endTime: 20,
            emotions: { boredom: 0.7, excitement: 0.2, curiosity: 0.4, tension: 0.3, satisfaction: 0.3 }
          },
          {
            startTime: 20,
            endTime: 30,
            emotions: { boredom: 0.3, excitement: 0.8, curiosity: 0.7, tension: 0.5, satisfaction: 0.6 }
          }
        ],
        videoDuration: 30
      },
      perSecondData: {
        per_second_data: [
          { timestamp: 0, boredom: 0.4, excitement: 0.3, curiosity: 0.6, tension: 0.2, satisfaction: 0.4 },
          { timestamp: 1, boredom: 0.45, excitement: 0.32, curiosity: 0.58, tension: 0.22, satisfaction: 0.42 },
          { timestamp: 2, boredom: 0.5, excitement: 0.3, curiosity: 0.6, tension: 0.2, satisfaction: 0.4 },
          { timestamp: 10, boredom: 0.65, excitement: 0.25, curiosity: 0.45, tension: 0.28, satisfaction: 0.35 },
          { timestamp: 11, boredom: 0.7, excitement: 0.2, curiosity: 0.4, tension: 0.3, satisfaction: 0.3 },
          { timestamp: 12, boredom: 0.75, excitement: 0.18, curiosity: 0.38, tension: 0.32, satisfaction: 0.28 },
          { timestamp: 20, boredom: 0.35, excitement: 0.75, curiosity: 0.65, tension: 0.48, satisfaction: 0.58 },
          { timestamp: 21, boredom: 0.3, excitement: 0.8, curiosity: 0.7, tension: 0.5, satisfaction: 0.6 },
          { timestamp: 22, boredom: 0.28, excitement: 0.82, curiosity: 0.72, tension: 0.52, satisfaction: 0.62 }
        ],
        totalSeconds: 9
      }
    },
    config: { version: '8.0.0', name: 'Test Pipeline' }
  })
    .then(result => {
      console.log('Emotional analysis complete:', JSON.stringify(result.artifacts, null, 2));
    })
    .catch(console.error);
}
