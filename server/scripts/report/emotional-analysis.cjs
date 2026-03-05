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

// Emotion thresholds for critical moment detection
const THRESHOLDS = {
  boredom: { high: 0.7, low: 0.3 },
  excitement: { high: 0.7, low: 0.3 },
  curiosity: { high: 0.7, low: 0.3 },
  tension: { high: 0.7, low: 0.3 },
  satisfaction: { high: 0.7, low: 0.3 }
};

// Scroll risk weights
const SCROLL_RISK_WEIGHTS = {
  boredom: 0.4,      // High boredom = high scroll risk
  excitement: -0.3,  // High excitement = low scroll risk
  curiosity: -0.2,   // High curiosity = low scroll risk
  tension: -0.05,    // Slight negative weight
  satisfaction: -0.05 // Slight negative weight
};

/**
 * Main entry point
 * 
 * @async
 * @function run
 * @param {object} input - Script input
 * @param {string} input.outputDir - Base output directory
 * @param {object} input.artifacts - Artifacts from previous phases
 *   @param {array} input.artifacts.chunkAnalysis.chunks - Array of chunk results with emotions
 *   @param {array} input.artifacts.perSecondData.per_second_data - Per-second emotion scores
 * @param {object} input.config - Pipeline config
 * @returns {Promise<object>} - Script output: { artifacts: object }
 */
async function run(input) {
  const { outputDir, artifacts = {}, config } = input;

  console.log('💓 Performing deep emotional analysis...');

  // Ensure output directory exists
  fs.mkdirSync(outputDir, { recursive: true });

  // Extract artifacts from previous phases
  const {
    chunkAnalysis = { chunks: [], totalTokens: 0, videoDuration: 0 },
    perSecondData = { per_second_data: [], totalSeconds: 0 }
  } = artifacts;

  const chunks = chunkAnalysis.chunks || [];
  const perSecondDataArray = perSecondData.per_second_data || [];

  // Process each chunk with detailed emotional breakdown
  console.log('📊 Analyzing emotional breakdown per chunk...');
  const chunkAnalysisResults = chunks.map((chunk, index) => 
    processChunk(chunk, index, perSecondDataArray)
  );

  // Build emotional arc visualization data
  console.log('📈 Building emotional arc data...');
  const emotionalArc = buildEmotionalArc(perSecondDataArray);

  // Calculate scroll risk timeline
  console.log('⚠️  Calculating scroll risk timeline...');
  const scrollRiskTimeline = calculateScrollRiskTimeline(perSecondDataArray);

  // Identify critical moments (threshold crossings)
  console.log('🎯 Identifying critical emotional moments...');
  const criticalMoments = identifyCriticalMoments(perSecondDataArray, chunks);

  // Build complete emotional analysis data
  const emotionalData = {
    generatedAt: new Date().toISOString(),
    pipelineVersion: config?.version || '8.0.0',
    summary: {
      totalChunks: chunks.length,
      totalSeconds: perSecondDataArray.length,
      videoDuration: chunkAnalysis.videoDuration || perSecondData.totalSeconds || 0,
      criticalMomentsCount: criticalMoments.length,
      averageScrollRisk: calculateAverageScrollRisk(scrollRiskTimeline)
    },
    chunkAnalysis: chunkAnalysisResults,
    emotionalArc,
    scrollRiskTimeline,
    criticalMoments
  };

  // Create emotional-analysis subdirectory using output-manager
  const analysisDir = outputManager.createReportDirectory(outputDir, 'emotional-analysis');

  // Save emotional data JSON
  const emotionalDataPath = path.join(analysisDir, 'emotional-data.json');
  fs.writeFileSync(emotionalDataPath, JSON.stringify(emotionalData, null, 2), 'utf8');
  console.log(`✅ Emotional analysis saved to: ${emotionalDataPath}`);

  return {
    artifacts: {
      emotionalAnalysis: {
        path: emotionalDataPath,
        generatedAt: emotionalData.generatedAt,
        summary: emotionalData.summary,
        chunkAnalysis: emotionalData.chunkAnalysis,
        emotionalArc: emotionalData.emotionalArc,
        insights: emotionalData.insights,
        dominantEmotions: emotionalData.dominantEmotions
      }
    }
  };
}

/**
 * Process a single chunk with detailed emotional breakdown
 * 
 * @function processChunk
 * @param {object} chunk - Chunk result with emotions
 * @param {number} chunkIndex - Index of the chunk
 * @param {array} perSecondData - Full per-second data for context
 * @returns {object} - Processed chunk analysis
 */
function processChunk(chunk, chunkIndex, perSecondData) {
  const emotions = chunk.emotions || {};
  const startTime = chunk.startTime || chunkIndex * 10; // Default 10s chunks
  const endTime = chunk.endTime || startTime + 10;
  
  // Get per-second data for this chunk's time range
  const chunkPerSecondData = perSecondData.filter(
    d => d.timestamp >= startTime && d.timestamp < endTime
  );

  // Calculate emotional velocity (rate of change from previous chunk)
  const emotionalVelocity = calculateEmotionalVelocity(chunk, chunkIndex, perSecondData);

  // Determine scroll risk for this chunk
  const scrollRisk = calculateChunkScrollRisk(emotions);

  // Identify dominant emotion
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

/**
 * Calculate emotional velocity (rate of change between chunks)
 * 
 * @function calculateEmotionalVelocity
 * @param {object} currentChunk - Current chunk with emotions
 * @param {number} chunkIndex - Current chunk index
 * @param {array} perSecondData - Per-second data for smoothing
 * @returns {object} - Velocity per emotion
 */
function calculateEmotionalVelocity(currentChunk, chunkIndex, perSecondData) {
  const emotions = currentChunk.emotions || {};
  const emotionKeys = Object.keys(emotions);
  const velocity = {};

  // Get previous chunk's emotions (approximate from per-second data)
  const currentTime = currentChunk.startTime || chunkIndex * 10;
  const previousTime = Math.max(0, currentTime - 10);
  
  const previousEmotions = getAverageEmotionsForTimeRange(perSecondData, previousTime - 10, previousTime);

  for (const emotion of emotionKeys) {
    const currentScore = emotions[emotion] || 0;
    const previousScore = previousEmotions[emotion] || 0;
    
    // Velocity = change per second
    const timeDelta = currentTime - previousTime || 1;
    velocity[emotion] = (currentScore - previousScore) / timeDelta;
  }

  return velocity;
}

/**
 * Get average emotions for a specific time range
 * 
 * @function getAverageEmotionsForTimeRange
 * @param {array} perSecondData - Per-second emotion data
 * @param {number} startTime - Start timestamp
 * @param {number} endTime - End timestamp
 * @returns {object} - Average emotions in the time range
 */
function getAverageEmotionsForTimeRange(perSecondData, startTime, endTime) {
  const filtered = perSecondData.filter(
    d => d.timestamp >= startTime && d.timestamp < endTime
  );

  if (filtered.length === 0) {
    return { boredom: 0, excitement: 0, curiosity: 0, tension: 0, satisfaction: 0 };
  }

  const emotionKeys = ['boredom', 'excitement', 'curiosity', 'tension', 'satisfaction'];
  const averages = {};

  for (const emotion of emotionKeys) {
    const sum = filtered.reduce((acc, d) => acc + (d[emotion] || 0), 0);
    averages[emotion] = sum / filtered.length;
  }

  return averages;
}

/**
 * Calculate scroll risk for a chunk based on emotions
 * 
 * @function calculateChunkScrollRisk
 * @param {object} emotions - Emotion scores
 * @returns {number} - Scroll risk score (0-1)
 */
function calculateChunkScrollRisk(emotions) {
  let risk = 0;
  
  for (const [emotion, weight] of Object.entries(SCROLL_RISK_WEIGHTS)) {
    risk += (emotions[emotion] || 0) * weight;
  }

  // Normalize to 0-1 range
  return Math.min(1, Math.max(0, risk + 0.5));
}

/**
 * Get scroll risk level category
 * 
 * @function getScrollRiskLevel
 * @param {number} risk - Scroll risk score (0-1)
 * @returns {string} - Risk level: 'low', 'medium', 'high', 'critical'
 */
function getScrollRiskLevel(risk) {
  if (risk >= 0.75) return 'critical';
  if (risk >= 0.5) return 'high';
  if (risk >= 0.25) return 'medium';
  return 'low';
}

/**
 * Find the dominant emotion (highest score)
 * 
 * @function findDominantEmotion
 * @param {object} emotions - Emotion scores
 * @returns {object} - Dominant emotion name and score
 */
function findDominantEmotion(emotions) {
  let dominant = { emotion: 'neutral', score: 0 };
  
  for (const [emotion, score] of Object.entries(emotions)) {
    if (score > dominant.score) {
      dominant = { emotion, score };
    }
  }

  return dominant;
}

/**
 * Build emotional signature (categorical representation)
 * 
 * @function buildEmotionalSignature
 * @param {object} emotions - Emotion scores
 * @returns {string} - Signature like "high-excitement-low-boredom"
 */
function buildEmotionalSignature(emotions) {
  const parts = [];
  
  for (const [emotion, score] of Object.entries(emotions)) {
    const level = score >= 0.7 ? 'high' : score >= 0.4 ? 'moderate' : 'low';
    parts.push(`${level}-${emotion}`);
  }

  return parts.join('-');
}

/**
 * Build emotional arc visualization data
 * 
 * @function buildEmotionalArc
 * @param {array} perSecondData - Per-second emotion data
 * @returns {object} - Emotional arc data for visualization
 */
function buildEmotionalArc(perSecondData) {
  if (!perSecondData || perSecondData.length === 0) {
    return { timestamps: [], emotions: {} };
  }

  const timestamps = perSecondData.map(d => d.timestamp || 0);
  const emotionKeys = ['boredom', 'excitement', 'curiosity', 'tension', 'satisfaction'];
  const emotions = {};

  for (const emotion of emotionKeys) {
    emotions[emotion] = perSecondData.map(d => d[emotion] || 0);
  }

  // Calculate moving average (5-second window) for smoother visualization
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

/**
 * Calculate moving average for smoothing
 * 
 * @function calculateMovingAverage
 * @param {array} data - Array of values
 * @param {number} windowSize - Size of moving window
 * @returns {array} - Smoothed values
 */
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

/**
 * Calculate scroll risk timeline (per-second)
 * 
 * @function calculateScrollRiskTimeline
 * @param {array} perSecondData - Per-second emotion data
 * @returns {array} - Timeline of scroll risk per second
 */
function calculateScrollRiskTimeline(perSecondData) {
  return perSecondData.map(d => ({
    timestamp: d.timestamp || 0,
    scrollRisk: calculateChunkScrollRisk(d),
    scrollRiskLevel: getScrollRiskLevel(calculateChunkScrollRisk(d)),
    dominantEmotion: findDominantEmotion(d).emotion
  }));
}

/**
 * Calculate average scroll risk across timeline
 * 
 * @function calculateAverageScrollRisk
 * @param {array} timeline - Scroll risk timeline
 * @returns {number} - Average scroll risk
 */
function calculateAverageScrollRisk(timeline) {
  if (!timeline || timeline.length === 0) return 0;
  
  const total = timeline.reduce((sum, point) => sum + point.scrollRisk, 0);
  return total / timeline.length;
}

/**
 * Identify critical moments where emotions cross thresholds
 * 
 * @function identifyCriticalMoments
 * @param {array} perSecondData - Per-second emotion data
 * @param {array} chunks - Chunk data for context
 * @returns {array} - Array of critical moments
 */
function identifyCriticalMoments(perSecondData, chunks) {
  const criticalMoments = [];
  const emotionKeys = Object.keys(THRESHOLDS);

  for (let i = 0; i < perSecondData.length; i++) {
    const data = perSecondData[i];
    const timestamp = data.timestamp || i;
    const prevData = i > 0 ? perSecondData[i - 1] : null;

    for (const emotion of emotionKeys) {
      const score = data[emotion] || 0;
      const prevScore = prevData ? (prevData[emotion] || 0) : score;
      const thresholds = THRESHOLDS[emotion];

      // Check for threshold crossings
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

  // Sort by severity (most severe first)
  criticalMoments.sort((a, b) => b.severity - a.severity);

  return criticalMoments;
}

/**
 * Find which chunk contains a given timestamp
 * 
 * @function findChunkForTimestamp
 * @param {number} timestamp - Timestamp to find
 * @param {array} chunks - Array of chunks
 * @returns {number} - Chunk index or -1 if not found
 */
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

/**
 * Calculate severity of threshold crossing
 * 
 * @function calculateCrossingSeverity
 * @param {number} currentScore - Current emotion score
 * @param {number} previousScore - Previous emotion score
 * @param {object} thresholds - Emotion thresholds
 * @returns {number} - Severity score (0-1)
 */
function calculateCrossingSeverity(currentScore, previousScore, thresholds) {
  const change = Math.abs(currentScore - previousScore);
  const distanceFromThreshold = Math.abs(currentScore - thresholds.high);
  
  // Severity based on rate of change and how far past threshold
  return Math.min(1, change * 0.5 + (1 - distanceFromThreshold) * 0.5);
}

/**
 * Build context description for a critical moment
 * 
 * @function buildMomentContext
 * @param {object} data - Per-second data at moment
 * @param {string} triggeredEmotion - Emotion that triggered the moment
 * @returns {string} - Context description
 */
function buildMomentContext(data, triggeredEmotion) {
  const emotions = Object.entries(data)
    .filter(([key]) => ['boredom', 'excitement', 'curiosity', 'tension', 'satisfaction'].includes(key))
    .map(([emotion, score]) => `${emotion}: ${(score * 100).toFixed(0)}%`)
    .join(', ');

  return `${triggeredEmotion} threshold crossed. Emotional state: ${emotions}`;
}

module.exports = { run };

// Allow standalone execution for testing
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
