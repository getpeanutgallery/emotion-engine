#!/usr/bin/env node
/**
 * Final Report Script
 *
 * Generates the human-readable markdown report (FINAL-REPORT.md).
 * This script runs in Phase 3 (Report) of the pipeline.
 *
 * Reuses aggregated data from summary.cjs to create a polished markdown document.
 *
 * @module scripts/report/final-report
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
 *   @param {object} input.artifacts.summary - Aggregated data from summary.cjs
 *   @param {object} input.artifacts.chunkAnalysis - Chunk analysis data
 *     @param {array} input.artifacts.chunkAnalysis.chunks - Array of chunk results
 * @param {object} input.config - Pipeline config
 * @returns {Promise<object>} - Script output: { artifacts: object }
 */
async function run(input) {
  const { outputDir, artifacts = {}, config } = input;

  console.log('   📄 Generating final markdown report...');

  // Ensure output directory exists
  fs.mkdirSync(outputDir, { recursive: true });

  // Extract artifacts from previous phases
  const {
    summary = {},
    chunkAnalysis = { chunks: [], totalTokens: 0, videoDuration: 0, persona: {} }
  } = artifacts;

  // Extract summary data
  const {
    duration = summary?.metadata?.videoDuration || chunkAnalysis.videoDuration || 0,
    totalTokens = summary?.metadata?.totalTokens || chunkAnalysis.totalTokens || 0,
    keyMetrics = {},
    recommendation = { text: 'No recommendation available', reasoning: 'No reasoning provided' }
  } = summary;

  const chunks = chunkAnalysis.chunks || [];

  // Create summary subdirectory using output manager
  const summaryDir = outputManager.createReportDirectory(outputDir, 'summary');

  // Build raw analysis payload referenced by FINAL-REPORT.md
  const analysisData = buildAnalysisData({
    duration,
    totalTokens,
    keyMetrics,
    recommendation,
    chunkAnalysis,
    summary,
    config
  });

  const analysisDataPath = path.join(summaryDir, 'analysis-data.json');
  fs.writeFileSync(analysisDataPath, JSON.stringify(analysisData, null, 2), 'utf8');
  console.log(`   ✅ Analysis data saved to: ${analysisDataPath}`);

  // Build markdown report
  console.log('   📝 Building report structure...');
  const reportContent = buildReport({
    duration,
    totalTokens,
    chunks,
    keyMetrics,
    recommendation,
    config,
    chunkAnalysis,
    outputDir
  });

  // Save report to summary/FINAL-REPORT.md
  const reportPath = path.join(summaryDir, 'FINAL-REPORT.md');
  fs.writeFileSync(reportPath, reportContent, 'utf8');
  console.log(`   ✅ Final report saved to: ${reportPath}`);

  const warnings = [];
  if (!summary || Object.keys(summary).length === 0) {
    warnings.push('Summary artifact was missing; final report rendered from direct chunkAnalysis fallbacks.');
  }
  if (!recommendation?.text || recommendation.text === 'No recommendation available') {
    warnings.push('Recommendation text was unavailable; final report rendered placeholder recommendation copy.');
  }
  if (!keyMetrics || Object.keys(keyMetrics).length === 0) {
    warnings.push('Key metrics were unavailable; final report rendered with reduced metric detail.');
  }
  if (!chunks.length) {
    warnings.push('Chunk analysis was unavailable; final report rendered without chunk-by-chunk sections.');
  }

  return {
    primaryArtifactKey: 'finalReport',
    metrics: {
      duration,
      totalTokens,
      chunksAnalyzed: chunks.length,
      reportSize: Buffer.byteLength(reportContent, 'utf8')
    },
    diagnostics: {
      degraded: warnings.length > 0,
      warnings
    },
    artifacts: {
      finalReport: {
        path: reportPath,
        analysisDataPath,
        generatedAt: new Date().toISOString(),
        summary: {
          duration,
          totalTokens,
          chunksAnalyzed: chunks.length,
          reportSize: Buffer.byteLength(reportContent, 'utf8')
        }
      }
    }
  };
}

/**
 * Build markdown report from analysis data
 *
 * @function buildReport
 * @param {object} data - Report data
 * @param {number} data.duration - Video duration in seconds
 * @param {number} data.totalTokens - Total tokens used in analysis
 * @param {array} data.chunks - Array of chunk analysis results
 * @param {object} data.keyMetrics - Average emotion metrics
 * @param {object} data.recommendation - AI recommendation with text and reasoning
 * @param {object} data.config - Pipeline config
 * @param {object} data.chunkAnalysis - Full chunk analysis data
 * @param {string} data.outputDir - Base output directory
 * @returns {string} - Markdown report content
 */
function buildReport(data) {
  const {
    duration,
    totalTokens,
    chunks,
    keyMetrics,
    recommendation,
    config,
    chunkAnalysis,
    outputDir
  } = data;

  let report = `# Emotion Analysis - Final Report\n\n`;

  // Header
  report += `**Generated:** ${new Date().toISOString()}\n`;
  report += `**Pipeline Version:** ${config?.version || '8.0.0'}\n`;
  report += `**Pipeline Name:** ${config?.name || 'Unknown'}\n\n`;

  report += `---\n\n`;

  // Executive Summary
  report += `## Executive Summary\n\n`;
  report += `**Video Duration:** ${formatDuration(duration)}\n`;
  report += `**Total Tokens Used:** ${totalTokens.toLocaleString()}\n`;
  report += `**Chunks Analyzed:** ${chunks.length}\n`;
  report += `**Analysis Method:** AI-powered emotion lens evaluation\n\n`;

  // AI Recommendation
  report += `## AI Recommendation\n\n`;
  report += `> ${recommendation.text}\n\n`;
  report += `*${recommendation.reasoning}*\n\n`;

  report += `---\n\n`;

  // Key Metrics with visual bars
  report += `## Key Metrics\n\n`;
  report += `| Emotion | Average Score (1-10) | Visual |\n`;
  report += `|---------|---------------------|--------|\n`;

  const emotionOrder = ['boredom', 'excitement', 'curiosity', 'tension', 'satisfaction', 'patience'];

  // Extract averages from keyMetrics (handles both flat object and nested structure)
  const metricsToUse = keyMetrics.averages || keyMetrics;
  const metricsEntries = Object.entries(metricsToUse);

  // Sort metrics by emotion order if possible
  const sortedMetrics = metricsEntries.sort((a, b) => {
    const aIndex = emotionOrder.indexOf(a[0].replace('avg', '').toLowerCase());
    const bIndex = emotionOrder.indexOf(b[0].replace('avg', '').toLowerCase());
    if (aIndex === -1 && bIndex === -1) return 0;
    if (aIndex === -1) return 1;
    if (bIndex === -1) return -1;
    return aIndex - bIndex;
  });

  for (const [metric, value] of sortedMetrics) {
    const emotion = metric.replace('avg', '').toLowerCase();
    const score = Math.round(value);
    const bar = buildEmojiBar(score);
    report += `| ${capitalize(emotion)} | ${value.toFixed(1)} | ${bar} |\n`;
  }
  report += '\n';

  report += `---\n\n`;

  // Chunk-by-Chunk Analysis
  report += `## Chunk-by-Chunk Analysis\n\n`;

  if (chunks && chunks.length > 0) {
    for (const chunk of chunks) {
      report += `### Chunk ${chunk.chunkIndex + 1}\n\n`;
      report += `**Time:** ${formatTime(chunk.startTime)} - ${formatTime(chunk.endTime)}\n\n`;
      report += `**Summary:** ${chunk.summary}\n\n`;

      // Emotions for this chunk
      if (chunk.emotions) {
        report += `**Emotions:**\n\n`;
        report += `| Emotion | Score (1-10) | Intensity |\n`;
        report += `|---------|-------------|-----------|\n`;

        for (const [lens, emotionData] of Object.entries(chunk.emotions)) {
          const score = emotionData.score || 0;
          const bar = buildEmojiBar(Math.round(score));
          report += `| ${capitalize(lens)} | ${score.toFixed(1)} | ${bar} |\n`;
        }
        report += '\n';
      }

      // Dominant emotion
      if (chunk.dominant_emotion) {
        report += `**Dominant Emotion:** ${chunk.dominant_emotion}\n\n`;
      }

      // Reasoning (if available)
      if (chunk.reasoning) {
        report += `**Analysis:** ${chunk.reasoning}\n\n`;
      }

      report += `---\n\n`;
    }
  } else {
    report += `*No chunk analysis data available*\n\n`;
    report += `---\n\n`;
  }

  // Emotional Arc
  report += `## Emotional Arc\n\n`;
  report += `The emotional arc shows how emotions evolved throughout the video.\n\n`;

  if (chunks && chunks.length > 0) {
    // Extract dominant emotions timeline
    report += `**Dominant Emotion Timeline:**\n\n`;
    report += `| Time Range | Dominant Emotion | Key Emotions |\n`;
    report += `|------------|-----------------|--------------|\n`;

    for (const chunk of chunks) {
      const timeRange = `${formatTime(chunk.startTime)}-${formatTime(chunk.endTime)}`;
      const dominant = chunk.dominant_emotion || 'N/A';

      // Get top 2 emotions for this chunk
      const topEmotions = getTopEmotions(chunk.emotions, 2);
      const keyEmotions = topEmotions.map(e => `${capitalize(e.name)} (${e.score.toFixed(1)})`).join(', ');

      report += `| ${timeRange} | ${capitalize(dominant)} | ${keyEmotions} |\n`;
    }
    report += '\n';
  }

  report += `---\n\n`;

  // Technical Details
  report += `## Technical Details\n\n`;
  report += `**Configuration:**\n`;
  report += `- Pipeline: ${config?.name || 'Unknown'}\n`;
  report += `- Version: ${config?.version || '8.0.0'}\n`;
  report += `- Chunks: ${chunks.length}\n`;
  report += `- Total Duration: ${formatDuration(duration)}\n`;
  report += `- Tokens Used: ${totalTokens.toLocaleString()}\n\n`;

  const personaLines = buildPersonaSectionLines(chunkAnalysis, config, outputDir);
  report += `**Persona:**\n`;
  for (const line of personaLines) {
    report += `- ${line}\n`;
  }
  report += '\n';

  report += `**Output Files:**\n`;
  report += `- Final Report: \`FINAL-REPORT.md\`\n`;
  report += `- Summary Data: \`summary.json\`\n`;
  report += `- Metrics: \`../metrics/metrics.json\`\n`;
  report += `- Raw Data: \`analysis-data.json\`\n\n`;

  report += `---\n\n`;
  report += `*Generated by OpenTruth Emotion Engine v${config?.version || '8.0.0'}*\n`;

  return report;
}

function buildAnalysisData(data) {
  const {
    duration,
    totalTokens,
    keyMetrics,
    recommendation,
    chunkAnalysis,
    summary,
    config
  } = data;

  return {
    metadata: {
      generatedAt: new Date().toISOString(),
      pipelineVersion: config?.version || '8.0.0',
      pipelineName: config?.name || 'Unknown',
      videoDuration: duration,
      chunksAnalyzed: chunkAnalysis?.chunks?.length || 0,
      totalTokens
    },
    summary: {
      keyMetrics,
      recommendation
    },
    data: {
      chunkAnalysis,
      summary
    }
  };
}

function buildPersonaSectionLines(chunkAnalysis, config, outputDir) {
  const persona = chunkAnalysis?.persona || {};
  const toolVars = config?.tool_variables || {};

  const soulPath = persona.soulPath || toolVars.soulPath;
  const goalPath = persona.goalPath || toolVars.goalPath;

  const lines = [];

  const personaId = derivePersonaId(soulPath);
  if (personaId) {
    lines.push(`ID: ${personaId}`);
    lines.push(`Display Name: ${formatPersonaName(personaId)}`);
  } else {
    lines.push('ID: unknown (no soulPath configured)');
  }

  lines.push(`SOUL Source: ${soulPath || 'missing (no soulPath configured)'}`);
  lines.push(`GOAL Source: ${goalPath || 'missing (no goalPath configured)'}`);

  const soulAssetPath = path.join(outputDir, 'assets', 'input', 'personas', 'SOUL.md');
  const goalAssetPath = path.join(outputDir, 'assets', 'input', 'personas', 'GOAL.md');

  lines.push(
    fs.existsSync(soulAssetPath)
      ? 'SOUL Asset: ../../assets/input/personas/SOUL.md'
      : 'SOUL Asset: missing (expected ../../assets/input/personas/SOUL.md)'
  );

  lines.push(
    fs.existsSync(goalAssetPath)
      ? 'GOAL Asset: ../../assets/input/personas/GOAL.md'
      : 'GOAL Asset: missing (expected ../../assets/input/personas/GOAL.md)'
  );

  return lines;
}

function derivePersonaId(soulPath) {
  if (!soulPath || typeof soulPath !== 'string') return '';
  const match = soulPath.match(/cast\/([^/]+)\/SOUL\.md$/i);
  if (match && match[1]) return match[1];

  const normalized = soulPath.replace(/\\/g, '/');
  const parts = normalized.split('/').filter(Boolean);
  const soulIndex = parts.findIndex((part) => /SOUL\.md$/i.test(part));
  if (soulIndex > 0) return parts[soulIndex - 1];

  return '';
}

function formatPersonaName(id) {
  return id
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

/**
 * Build emoji bar for visual representation
 *
 * @function buildEmojiBar
 * @param {number} score - Score from 0-10
 * @returns {string} - Emoji bar string
 */
function buildEmojiBar(score) {
  const filled = '🟢';
  const empty = '⚪';
  const maxBars = 10;
  const filledCount = Math.min(maxBars, Math.max(0, Math.round(score)));
  const emptyCount = maxBars - filledCount;

  return filled.repeat(filledCount) + empty.repeat(emptyCount);
}

/**
 * Get top N emotions by score
 *
 * @function getTopEmotions
 * @param {object} emotions - Emotion scores object
 * @param {number} n - Number of top emotions to return
 * @returns {array} - Array of {name, score} objects
 */
function getTopEmotions(emotions, n = 2) {
  if (!emotions) return [];

  return Object.entries(emotions)
    .map(([name, data]) => ({
      name,
      score: data.score || (typeof data === 'number' ? data : 0)
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, n);
}

/**
 * Format duration in seconds to human-readable string
 *
 * @function formatDuration
 * @param {number} seconds - Duration in seconds
 * @returns {string} - Formatted duration string
 */
function formatDuration(seconds) {
  if (seconds < 60) {
    return `${seconds.toFixed(1)} seconds`;
  }

  const mins = Math.floor(seconds / 60);
  const secs = (seconds % 60).toFixed(1);
  return `${mins}m ${secs}s`;
}

/**
 * Format time as MM:SS
 *
 * @function formatTime
 * @param {number} seconds - Time in seconds
 * @returns {string} - Formatted time string
 */
function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Capitalize first letter
 *
 * @function capitalize
 * @param {string} str - String to capitalize
 * @returns {string} - Capitalized string
 */
function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

const deterministicRecovery = {
  script: 'final-report',
  family: 'computed.report.v1',
  knownStrategies: [
    { id: 'reload-persisted-artifacts', kind: 'rebuild', consumesAttempt: true, terminalIfUnavailable: false },
    { id: 'recompute-from-upstream-artifacts', kind: 'rebuild', consumesAttempt: true, terminalIfUnavailable: false }
  ],
  degradedSuccess: {
    allowed: true,
    conditions: [
      'final report may render with placeholder recommendation/key-metric sections when upstream summary data is incomplete',
      'final report may omit chunk sections when chunkAnalysis is absent while still preserving canonical output paths'
    ]
  }
};

module.exports = { run, deterministicRecovery };

// Allow standalone execution for testing
if (require.main === module) {
  const outputDir = process.argv[2] || 'output/test-final-report';

  console.log('Final Report Script - Test Mode');
  console.log('Output:', outputDir);
  console.log('');
  console.log('⚠️  This script requires:');
  console.log('   - artifacts.summary (from summary.cjs)');
  console.log('   - artifacts.chunkAnalysis.chunks (from video-chunks.cjs)');
  console.log('');
  console.log('Example usage:');
  console.log('  node final-report.cjs output/');
}
