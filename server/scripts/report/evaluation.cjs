#!/usr/bin/env node
/**
 * Evaluation Report Script (legacy compatibility wrapper)
 */

const fs = require('fs');
const path = require('path');

async function run(input) {
  const { outputDir, artifacts = {}, config } = input;

  console.log('   📄 Generating evaluation report (legacy mode)...');
  console.log('   ⚠️  evaluation.cjs is a legacy compatibility path; prefer metrics/emotional-analysis/summary/final-report for canonical reports.');
  fs.mkdirSync(outputDir, { recursive: true });

  const computedTimeline = buildPerSecondFromChunks(
    artifacts.chunkAnalysis?.chunks || [],
    artifacts.chunkAnalysis?.videoDuration || 0
  );

  const analysisData = {
    metadata: {
      generatedAt: new Date().toISOString(),
      pipelineVersion: config?.version || '8.0.0',
      videoDuration: artifacts.chunkAnalysis?.videoDuration || 0,
      chunksAnalyzed: artifacts.chunkAnalysis?.chunks?.length || 0,
      totalTokens: artifacts.chunkAnalysis?.totalTokens || 0
    },
    summary: {
      totalTokens: artifacts.chunkAnalysis?.totalTokens || 0,
      duration: artifacts.chunkAnalysis?.videoDuration || 0,
      chunks: artifacts.chunkAnalysis?.chunks?.length || 0,
      seconds: computedTimeline.length
    },
    data: {
      chunkAnalysis: artifacts.chunkAnalysis || null,
      computedTimeline,
      dialogueData: artifacts.dialogueData || null,
      musicData: artifacts.musicData || null,
      visualIdentityData: artifacts.visualIdentityData || null
    }
  };

  const analysisDataPath = path.join(outputDir, 'analysis-data.json');
  fs.writeFileSync(analysisDataPath, JSON.stringify(analysisData, null, 2), 'utf8');
  console.log(`   ✅ Analysis data saved to: ${analysisDataPath}`);

  const reportPath = path.join(outputDir, 'FINAL-REPORT.md');
  fs.writeFileSync(reportPath, buildSimpleReport(analysisData, config), 'utf8');
  console.log(`   ✅ Final report saved to: ${reportPath}`);

  return {
    primaryArtifactKey: 'reportFiles',
    metrics: {
      chunksAnalyzed: analysisData.metadata.chunksAnalyzed,
      totalTokens: analysisData.metadata.totalTokens,
      duration: analysisData.metadata.videoDuration
    },
    diagnostics: {
      degraded: true,
      warnings: [
        'Legacy compatibility wrapper; prefer metrics/emotional-analysis/summary/final-report for canonical report generation.',
        'Computed legacy timeline from chunkAnalysis; no dedicated per-second phase artifact is produced anymore.'
      ]
    },
    artifacts: {
      reportFiles: {
        main: reportPath,
        json: analysisDataPath
      },
      summary: analysisData.summary
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
  for (const [emotion, value] of Object.entries(source)) {
    if (value && typeof value === 'object' && typeof value.score === 'number') {
      normalized[emotion] = normalizeScore(value.score);
    } else if (typeof value === 'number') {
      normalized[emotion] = normalizeScore(value);
    }
  }
  return normalized;
}

function buildPerSecondFromChunks(chunks = [], videoDuration = 0) {
  if (!Array.isArray(chunks) || chunks.length === 0) return [];

  const rows = [];
  for (const chunk of chunks) {
    if (chunk?.status === 'failed') continue;
    const start = typeof chunk.startTime === 'number' ? chunk.startTime : 0;
    const end = typeof chunk.endTime === 'number' ? chunk.endTime : start;
    const startSecond = Math.floor(start);
    const endSecond = Math.max(startSecond + 1, Math.ceil(end));
    const normalized = normalizeEmotionMap(chunk.emotions || {});

    for (let second = startSecond; second < endSecond; second++) {
      if (videoDuration > 0 && second >= Math.ceil(videoDuration)) break;
      rows.push({ timestamp: second, emotions: normalized, dominant_emotion: chunk.dominant_emotion || null });
    }
  }

  const deduped = new Map();
  for (const row of rows) deduped.set(row.timestamp, row);
  return Array.from(deduped.values()).sort((a, b) => a.timestamp - b.timestamp);
}

function buildSimpleReport(payload, config) {
  const { metadata, data } = payload;
  const chunkAnalysis = data.chunkAnalysis || {};
  const computedTimeline = data.computedTimeline || [];
  const chunks = chunkAnalysis.chunks || [];

  const averages = calculateEmotionAverages(computedTimeline);

  let report = `# Emotion Analysis Report

`;
  report += `**Generated:** ${metadata.generatedAt}\n`;
  report += `**Pipeline Version:** ${metadata.pipelineVersion}\n`;
  report += `**Pipeline Name:** ${config?.name || 'Unknown'}\n\n`;
  report += `---\n\n`;

  report += `## Executive Summary\n\n`;
  report += `**Video Duration:** ${formatDuration(metadata.videoDuration)}\n`;
  report += `**Total Tokens Used:** ${metadata.totalTokens.toLocaleString()}\n`;
  report += `**Chunks Analyzed:** ${chunks.length}\n\n`;

  report += `---\n\n`;
  report += `## Key Metrics\n\n`;
  report += `| Emotion | Average Score (1-10) | Visual |\n`;
  report += `|---------|---------------------|--------|\n`;

  for (const [emotion, score] of Object.entries(averages)) {
    report += `| ${capitalize(emotion)} | ${score.toFixed(1)} | ${buildEmojiBar(Math.round(score))} |\n`;
  }
  if (Object.keys(averages).length === 0) {
    report += `| N/A | 0.0 | ⚪⚪⚪⚪⚪⚪⚪⚪⚪⚪ |\n`;
  }

  report += `\n---\n\n`;
  report += `## Chunk-by-Chunk Analysis\n\n`;

  if (chunks.length === 0) {
    report += `*No chunk analysis data available*\n\n`;
  } else {
    for (const chunk of chunks) {
      report += `### Chunk ${chunk.chunkIndex + 1}\n\n`;
      report += `**Time:** ${formatTime(chunk.startTime)} - ${formatTime(chunk.endTime)}\n\n`;
      report += `**Summary:** ${chunk.summary || ''}\n\n`;
      if (chunk.dominant_emotion) {
        report += `**Dominant Emotion:** ${chunk.dominant_emotion}\n\n`;
      }
      report += `---\n\n`;
    }
  }

  report += `## Recommendation\n\n`;
  const best = Object.entries(averages).sort((a, b) => b[1] - a[1])[0];
  if (best) {
    report += `Primary observed emotion is **${capitalize(best[0])}** (${best[1].toFixed(1)}/10).\n\n`;
  } else {
    report += `Insufficient data for recommendation.\n\n`;
  }

  report += `---\n\n`;
  report += `*Generated by OpenTruth Emotion Engine v${metadata.pipelineVersion}*\n`;
  return report;
}

function calculateEmotionAverages(points) {
  const sums = {};
  const counts = {};

  for (const point of points) {
    for (const [name, score] of Object.entries(point.emotions || {})) {
      const scaled = score <= 1 ? score * 10 : score;
      sums[name] = (sums[name] || 0) + scaled;
      counts[name] = (counts[name] || 0) + 1;
    }
  }

  const averages = {};
  for (const name of Object.keys(sums)) {
    averages[name] = sums[name] / counts[name];
  }
  return averages;
}

function buildEmojiBar(score) {
  const filledCount = Math.min(10, Math.max(0, score));
  return '🟢'.repeat(filledCount) + '⚪'.repeat(10 - filledCount);
}

function formatDuration(seconds) {
  if (seconds < 60) return `${seconds.toFixed(1)} seconds`;
  const mins = Math.floor(seconds / 60);
  const secs = (seconds % 60).toFixed(1);
  return `${mins}m ${secs}s`;
}

function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

function capitalize(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

const deterministicRecovery = {
  script: 'evaluation',
  family: 'computed.report.v1',
  canonical: false,
  lifecycle: 'legacy-only',
  knownStrategies: [
    { id: 'reload-persisted-artifacts', kind: 'rebuild', consumesAttempt: true, terminalIfUnavailable: false },
    { id: 'recompute-from-upstream-artifacts', kind: 'rebuild', consumesAttempt: true, terminalIfUnavailable: false }
  ]
};

module.exports = { run, deterministicRecovery };
