const fs = require('fs');
const path = require('path');
const test = require('node:test');
const { ok, is } = require('../helpers/assertions');
const outputManager = require('../../server/lib/output-manager.cjs');
const {
  validateSummaryJsonSmoke,
  validateAnalysisDataSmoke,
  validateFinalReportSmoke,
  validateSummaryPresentationSmoke
} = require('../../server/lib/report-package-smoke.cjs');

const tempOutputDir = '/tmp/test-report-package-smoke';
const canonicalOutputDir = path.resolve(__dirname, '../../output/cod-test');

function cleanTemp() {
  fs.rmSync(tempOutputDir, { recursive: true, force: true });
  fs.mkdirSync(tempOutputDir, { recursive: true });
}

function writeJson(filePath, payload) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), 'utf8');
}

function seedCanonicalLikePackage(baseDir) {
  const metricsPath = outputManager.getReportPath(baseDir, 'metrics', 'metrics.json');
  const recommendationPath = outputManager.getReportPath(baseDir, 'recommendation', 'recommendation.json');
  const emotionalAnalysisPath = outputManager.getReportPath(baseDir, 'emotional-analysis', 'emotional-data.json');
  const summaryPath = outputManager.getReportPath(baseDir, 'summary', 'summary.json');
  const analysisDataPath = outputManager.getReportPath(baseDir, 'summary', 'analysis-data.json');
  const finalReportPath = outputManager.getReportPath(baseDir, 'summary', 'FINAL-REPORT.md');

  writeJson(metricsPath, { averages: { excitement: 7.5 } });
  writeJson(recommendationPath, { text: 'Keep the opening hook.', reasoning: 'Excitement stays high.' });
  writeJson(emotionalAnalysisPath, { summary: { averageScrollRisk: 0.2 } });

  writeJson(summaryPath, {
    metadata: {
      generatedAt: '2026-03-26T19:00:00.000Z',
      videoDuration: 12.5,
      chunksAnalyzed: 2,
      totalTokens: 321
    },
    keyMetrics: {
      averages: { excitement: 7.5 }
    },
    recommendation: {
      text: 'Keep the opening hook.',
      reasoning: 'Excitement stays high.'
    },
    reportPaths: {
      metrics: metricsPath,
      recommendation: recommendationPath,
      emotionalAnalysis: emotionalAnalysisPath,
      summary: summaryPath,
      analysisData: analysisDataPath,
      finalReport: finalReportPath
    }
  });

  writeJson(analysisDataPath, {
    metadata: {
      generatedAt: '2026-03-26T19:00:01.000Z',
      pipelineVersion: '1.0',
      pipelineName: 'Smoke Test Pipeline',
      videoDuration: 12.5,
      chunksAnalyzed: 2,
      totalTokens: 321
    },
    summary: {
      keyMetrics: { averages: { excitement: 7.5 } },
      recommendation: { text: 'Keep the opening hook.', reasoning: 'Excitement stays high.' }
    },
    data: {
      chunkAnalysis: {
        chunks: [
          { chunkIndex: 0, startTime: 0, endTime: 5 },
          { chunkIndex: 1, startTime: 5, endTime: 10 }
        ]
      },
      summary: {
        metadata: {
          totalTokens: 321
        }
      }
    }
  });

  fs.mkdirSync(path.dirname(finalReportPath), { recursive: true });
  fs.writeFileSync(finalReportPath, [
    '# Emotion Analysis - Final Report',
    '',
    '## Executive Summary',
    '',
    '## AI Recommendation',
    '',
    '## Key Metrics',
    '',
    '## Chunk-by-Chunk Analysis',
    '',
    '## Emotional Arc',
    '',
    '## Technical Details',
    '',
    '- Final Report: `FINAL-REPORT.md`',
    '- Summary Data: `summary.json`',
    '- Raw Data: `analysis-data.json`'
  ].join('\n'), 'utf8');
}

test('report-package smoke - canonical cod-test output passes current smoke suite', () => {
  const result = validateSummaryPresentationSmoke(canonicalOutputDir);
  is(result.status, 'pass');
  is(result.results.length, 3);
  ok(result.results.every((entry) => entry.status === 'pass'));
});

test('report-package smoke - handcrafted canonical package passes each artifact smoke check', (t) => {
  cleanTemp();
  t.after(() => fs.rmSync(tempOutputDir, { recursive: true, force: true }));
  seedCanonicalLikePackage(tempOutputDir);

  is(validateSummaryJsonSmoke(tempOutputDir).status, 'pass');
  is(validateAnalysisDataSmoke(tempOutputDir).status, 'pass');
  is(validateFinalReportSmoke(tempOutputDir).status, 'pass');
});

test('report-package smoke - summary smoke fails when a declared sibling path is missing', (t) => {
  cleanTemp();
  t.after(() => fs.rmSync(tempOutputDir, { recursive: true, force: true }));
  seedCanonicalLikePackage(tempOutputDir);

  const recommendationPath = outputManager.getReportPath(tempOutputDir, 'recommendation', 'recommendation.json');
  fs.rmSync(recommendationPath, { force: true });

  const result = validateSummaryJsonSmoke(tempOutputDir);
  is(result.status, 'fail');
  ok(result.failedChecks.some((check) => check.key === 'summary.reportPaths.recommendation.exists'));
});

test('report-package smoke - final report smoke fails when a canonical heading is missing', (t) => {
  cleanTemp();
  t.after(() => fs.rmSync(tempOutputDir, { recursive: true, force: true }));
  seedCanonicalLikePackage(tempOutputDir);

  const finalReportPath = outputManager.getReportPath(tempOutputDir, 'summary', 'FINAL-REPORT.md');
  const original = fs.readFileSync(finalReportPath, 'utf8');
  fs.writeFileSync(finalReportPath, original.replace('## Emotional Arc\n\n', ''), 'utf8');

  const result = validateFinalReportSmoke(tempOutputDir);
  is(result.status, 'fail');
  ok(result.failedChecks.some((check) => check.key === 'finalReport.heading.## Emotional Arc'));
});
