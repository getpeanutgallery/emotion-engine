#!/usr/bin/env node
/**
 * Summary Report Script
 * 
 * Aggregates all report data into a single summary.json for programmatic access.
 * This script runs in Phase 3 (Report) of the pipeline.
 * 
 * @module scripts/report/summary
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
 * @param {object} input.artifacts - Artifacts from previous report scripts
 *   @param {object} input.artifacts.metricsData - Metrics data from metrics.cjs
 *   @param {object} input.artifacts.recommendationData - Recommendation data from recommendation.cjs
 *   @param {object} input.artifacts.emotionalAnalysis - Emotional analysis data from emotional-analysis.cjs
 * @param {object} input.config - Pipeline config
 * @returns {Promise<object>} - Script output: { artifacts: { summaryData: object } }
 */
async function run(input) {
  const { outputDir, artifacts = {}, config } = input;

  console.log('📋 Aggregating report data into summary...');

  // Ensure output directory exists
  fs.mkdirSync(outputDir, { recursive: true });

  // Extract artifacts from previous report scripts
  const {
    metricsData = {},
    recommendationData = {},
    emotionalAnalysis = {},
    chunkAnalysis = { chunks: [], totalTokens: 0, videoDuration: 0 },
    perSecondData = { per_second_data: [], totalSeconds: 0 }
  } = artifacts;

  // Build metadata
  console.log('   📊 Building metadata...');
  const metadata = {
    generatedAt: new Date().toISOString(),
    pipelineVersion: config?.version || '8.0.0',
    videoDuration: chunkAnalysis.videoDuration || perSecondData.totalSeconds || 0,
    chunksAnalyzed: chunkAnalysis.chunks?.length || 0,
    totalSeconds: perSecondData.per_second_data?.length || 0,
    totalTokens: chunkAnalysis.totalTokens || 0
  };

  // Build key metrics summary
  console.log('   📈 Extracting key metrics...');
  const keyMetrics = buildKeyMetricsSummary(metricsData, emotionalAnalysis);

  // Build recommendation summary
  console.log('   💡 Extracting recommendation...');
  const recommendation = buildRecommendationSummary(recommendationData);

  // Build report paths
  console.log('   🔗 Building report paths...');
  const reportPaths = buildReportPaths(outputDir, artifacts);

  // Build final summary object
  const summary = {
    metadata,
    keyMetrics,
    recommendation,
    reportPaths
  };

  // Create summary subdirectory using output manager
  const summaryDir = outputManager.createReportDirectory(outputDir, 'summary');

  // Save summary JSON
  const summaryPath = path.join(summaryDir, 'summary.json');
  fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2), 'utf8');
  console.log(`   ✅ Summary saved to: ${summaryPath}`);

  return {
    artifacts: {
      summary: {
        ...summary,
        path: summaryPath,
        generatedAt: summary.metadata.generatedAt
      },
      summaryData: {
        path: summaryPath,
        generatedAt: summary.metadata.generatedAt,
        metadata: summary.metadata,
        keyMetricsCount: Object.keys(keyMetrics).length,
        hasRecommendation: !!recommendation.text
      }
    }
  };
}

/**
 * Build key metrics summary from metrics data
 * 
 * @function buildKeyMetricsSummary
 * @param {object} metricsData - Metrics data from metrics.cjs
 * @param {object} emotionalAnalysis - Emotional analysis data
 * @returns {object} - Key metrics summary with averages and peaks
 */
function buildKeyMetricsSummary(metricsData, emotionalAnalysis) {
  const keyMetrics = {};

  // Extract averages from metrics data
  if (metricsData.averages) {
    keyMetrics.averages = metricsData.averages;
  }

  // Extract peak moments from metrics data
  if (metricsData.peakMoments) {
    keyMetrics.peakMoments = metricsData.peakMoments;
  }

  // Extract trends from metrics data
  if (metricsData.trends) {
    keyMetrics.trends = metricsData.trends;
  }

  // Extract friction index from metrics data
  if (metricsData.frictionIndex !== undefined) {
    keyMetrics.frictionIndex = metricsData.frictionIndex;
  }

  // Add emotional analysis insights if available
  if (emotionalAnalysis.insights) {
    keyMetrics.insights = emotionalAnalysis.insights;
  }

  if (emotionalAnalysis.dominantEmotions) {
    keyMetrics.dominantEmotions = emotionalAnalysis.dominantEmotions;
  }

  return keyMetrics;
}

/**
 * Build recommendation summary from recommendation data
 * 
 * @function buildRecommendationSummary
 * @param {object} recommendationData - Recommendation data from recommendation.cjs
 * @returns {object} - Recommendation with text and reasoning
 */
function buildRecommendationSummary(recommendationData) {
  const recommendation = {
    text: recommendationData.text || 'No recommendation available',
    reasoning: recommendationData.reasoning || 'No reasoning provided'
  };

  // Add confidence score if available
  if (recommendationData.confidence !== undefined) {
    recommendation.confidence = recommendationData.confidence;
  }

  // Add action items if available
  if (recommendationData.actionItems) {
    recommendation.actionItems = recommendationData.actionItems;
  }

  return recommendation;
}

/**
 * Build report paths linking to other report files
 * 
 * @function buildReportPaths
 * @param {string} outputDir - Base output directory
 * @param {object} artifacts - All artifacts with path information
 * @returns {object} - Paths to all report files
 */
function buildReportPaths(outputDir, artifacts) {
  const reportPaths = {};

  // Metrics report path
  if (artifacts.metricsData?.path) {
    reportPaths.metrics = artifacts.metricsData.path;
  } else {
    reportPaths.metrics = outputManager.getReportPath(outputDir, 'metrics', 'metrics.json');
  }

  // Recommendation report path (if exists)
  if (artifacts.recommendationData?.path) {
    reportPaths.recommendation = artifacts.recommendationData.path;
  } else {
    // Check if recommendation.cjs created a file
    const recPath = outputManager.getReportPath(outputDir, 'recommendation', 'recommendation.json');
    if (fs.existsSync(recPath)) {
      reportPaths.recommendation = recPath;
    }
  }

  // Emotional analysis report path (if exists)
  if (artifacts.emotionalAnalysis?.path) {
    reportPaths.emotionalAnalysis = artifacts.emotionalAnalysis.path;
  } else {
    // Check if emotional-analysis.cjs created a file
    const emoPath = outputManager.getReportPath(outputDir, 'emotional-analysis', 'emotional-analysis.json');
    if (fs.existsSync(emoPath)) {
      reportPaths.emotionalAnalysis = emoPath;
    }
  }

  // Final markdown report path (from evaluation.cjs)
  const finalReportPath = path.join(outputDir, 'FINAL-REPORT.md');
  if (fs.existsSync(finalReportPath)) {
    reportPaths.finalReport = finalReportPath;
  }

  // Raw analysis data path (from evaluation.cjs)
  const analysisDataPath = path.join(outputDir, 'analysis-data.json');
  if (fs.existsSync(analysisDataPath)) {
    reportPaths.analysisData = analysisDataPath;
  }

  // Summary path (this file)
  reportPaths.summary = outputManager.getReportPath(outputDir, 'summary', 'summary.json');

  return reportPaths;
}

module.exports = { run };

// Allow standalone execution for testing
if (require.main === module) {
  const outputDir = process.argv[2] || 'output/test-summary';
  
  console.log('Summary Report Script - Test Mode');
  console.log('Output:', outputDir);
  console.log('');

  run({
    outputDir,
    artifacts: {
      metricsData: {
        path: path.join(outputDir, 'metrics', 'metrics.json'),
        averages: {
          boredom: 0.4,
          excitement: 0.6,
          curiosity: 0.5,
          tension: 0.3,
          satisfaction: 0.7
        },
        peakMoments: {
          excitement: {
            highest: { timestamp: 45, score: 0.95 },
            lowest: { timestamp: 120, score: 0.25 }
          }
        },
        trends: {
          excitement: { direction: 'increasing', change: 0.15 }
        },
        frictionIndex: 42.5
      },
      recommendationData: {
        path: path.join(outputDir, 'recommendation', 'recommendation.json'),
        text: 'Consider increasing excitement levels in the middle section.',
        reasoning: 'Excitement scores dropped significantly between 60-120 seconds.',
        confidence: 0.85
      },
      emotionalAnalysis: {
        path: path.join(outputDir, 'emotional-analysis', 'emotional-analysis.json'),
        insights: ['High engagement in first 30 seconds', 'Attention drop at 2-minute mark'],
        dominantEmotions: ['excitement', 'curiosity']
      },
      chunkAnalysis: {
        chunks: [{ emotions: { boredom: 0.5, excitement: 0.3 } }],
        videoDuration: 180,
        totalTokens: 15000
      },
      perSecondData: {
        per_second_data: [
          { timestamp: 0, boredom: 0.4, excitement: 0.6, curiosity: 0.5, tension: 0.3, satisfaction: 0.7 },
          { timestamp: 1, boredom: 0.5, excitement: 0.5, curiosity: 0.4, tension: 0.4, satisfaction: 0.6 }
        ],
        totalSeconds: 180
      }
    },
    config: { version: '8.0.0', name: 'Test Pipeline' }
  })
    .then(result => {
      console.log('');
      console.log('Summary aggregation complete:', JSON.stringify(result.artifacts, null, 2));
    })
    .catch(console.error);
}
