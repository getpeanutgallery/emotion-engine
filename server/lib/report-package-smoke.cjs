const fs = require('fs');
const path = require('path');
const outputManager = require('./output-manager.cjs');

const CANONICAL_REPORT_HEADINGS = [
  '# Emotion Analysis - Final Report',
  '## Executive Summary',
  '## AI Recommendation',
  '## Key Metrics',
  '## Chunk-by-Chunk Analysis',
  '## Emotional Arc',
  '## Technical Details'
];

const CANONICAL_REPORT_REFERENCES = [
  'FINAL-REPORT.md',
  'summary.json',
  'analysis-data.json'
];

function readJson(filePath, label) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    throw new Error(`Failed to parse ${label}: ${filePath} (${error.message})`);
  }
}

function finalizeSmokeCheck(name, artifactPath, checks) {
  const failedChecks = checks.filter((check) => check.status === 'fail');
  return {
    name,
    artifactPath,
    status: failedChecks.length > 0 ? 'fail' : 'pass',
    checks,
    failedChecks,
    summary: failedChecks.length > 0
      ? `${name} smoke failed: ${failedChecks[0].message}`
      : `${name} smoke passed (${checks.length} checks).`
  };
}

function existsCheck(key, targetPath, messageIfMissing) {
  return {
    key,
    status: fs.existsSync(targetPath) ? 'pass' : 'fail',
    message: fs.existsSync(targetPath) ? `${key} exists` : messageIfMissing,
    details: { targetPath }
  };
}

function pushBooleanCheck(checks, key, pass, message, details = {}) {
  checks.push({
    key,
    status: pass ? 'pass' : 'fail',
    message,
    details
  });
}

function validateSummaryJsonSmoke(outputDir) {
  const summaryPath = outputManager.getReportPath(outputDir, 'summary', 'summary.json');
  const checks = [
    existsCheck('summary.exists', summaryPath, 'summary.json missing at canonical summary path')
  ];

  if (!fs.existsSync(summaryPath)) {
    return finalizeSmokeCheck('summary.json', summaryPath, checks);
  }

  const summary = readJson(summaryPath, 'summary.json');
  const expectedTopLevelKeys = ['metadata', 'keyMetrics', 'recommendation', 'reportPaths'];
  for (const key of expectedTopLevelKeys) {
    pushBooleanCheck(
      checks,
      `summary.topLevel.${key}`,
      Object.prototype.hasOwnProperty.call(summary, key),
      Object.prototype.hasOwnProperty.call(summary, key)
        ? `summary.json includes top-level key ${key}`
        : `summary.json missing top-level key ${key}`
    );
  }

  const metadata = summary.metadata || {};
  for (const key of ['generatedAt', 'videoDuration', 'chunksAnalyzed', 'totalTokens']) {
    pushBooleanCheck(
      checks,
      `summary.metadata.${key}`,
      metadata[key] !== undefined,
      metadata[key] !== undefined
        ? `summary.json metadata includes ${key}`
        : `summary.json metadata missing ${key}`
    );
  }

  const expectedSummaryPath = outputManager.getReportPath(outputDir, 'summary', 'summary.json');
  pushBooleanCheck(
    checks,
    'summary.reportPaths.summary',
    summary.reportPaths?.summary === expectedSummaryPath,
    summary.reportPaths?.summary === expectedSummaryPath
      ? 'summary.reportPaths.summary points at canonical summary.json path'
      : 'summary.reportPaths.summary does not match canonical summary.json path',
    {
      expected: expectedSummaryPath,
      actual: summary.reportPaths?.summary || null
    }
  );

  const declaredSiblingPaths = ['metrics', 'recommendation', 'emotionalAnalysis', 'analysisData', 'finalReport'];
  for (const key of declaredSiblingPaths) {
    const declaredPath = summary.reportPaths?.[key];
    if (!declaredPath) {
      continue;
    }
    pushBooleanCheck(
      checks,
      `summary.reportPaths.${key}.exists`,
      fs.existsSync(declaredPath),
      fs.existsSync(declaredPath)
        ? `summary.reportPaths.${key} exists on disk`
        : `summary.reportPaths.${key} points to a missing file`,
      { declaredPath }
    );
  }

  return finalizeSmokeCheck('summary.json', summaryPath, checks);
}

function validateAnalysisDataSmoke(outputDir) {
  const analysisDataPath = outputManager.getReportPath(outputDir, 'summary', 'analysis-data.json');
  const checks = [
    existsCheck('analysisData.exists', analysisDataPath, 'analysis-data.json missing at canonical summary path')
  ];

  if (!fs.existsSync(analysisDataPath)) {
    return finalizeSmokeCheck('analysis-data.json', analysisDataPath, checks);
  }

  const analysisData = readJson(analysisDataPath, 'analysis-data.json');
  const summaryPath = outputManager.getReportPath(outputDir, 'summary', 'summary.json');
  const summary = fs.existsSync(summaryPath) ? readJson(summaryPath, 'summary.json') : null;

  for (const key of ['metadata', 'summary', 'data']) {
    pushBooleanCheck(
      checks,
      `analysisData.topLevel.${key}`,
      Object.prototype.hasOwnProperty.call(analysisData, key),
      Object.prototype.hasOwnProperty.call(analysisData, key)
        ? `analysis-data.json includes top-level key ${key}`
        : `analysis-data.json missing top-level key ${key}`
    );
  }

  const chunkAnalysis = analysisData.data?.chunkAnalysis;
  pushBooleanCheck(
    checks,
    'analysisData.chunkAnalysis.exists',
    !!chunkAnalysis,
    chunkAnalysis
      ? 'analysis-data.json includes data.chunkAnalysis'
      : 'analysis-data.json missing data.chunkAnalysis'
  );
  pushBooleanCheck(
    checks,
    'analysisData.chunkAnalysis.chunks',
    Array.isArray(chunkAnalysis?.chunks),
    Array.isArray(chunkAnalysis?.chunks)
      ? 'analysis-data.json data.chunkAnalysis.chunks is an array'
      : 'analysis-data.json data.chunkAnalysis.chunks is missing or not an array'
  );

  pushBooleanCheck(
    checks,
    'analysisData.summary.keyMetrics',
    !!analysisData.summary?.keyMetrics,
    analysisData.summary?.keyMetrics
      ? 'analysis-data.json includes summary.keyMetrics'
      : 'analysis-data.json missing summary.keyMetrics'
  );
  pushBooleanCheck(
    checks,
    'analysisData.summary.recommendation',
    !!analysisData.summary?.recommendation,
    analysisData.summary?.recommendation
      ? 'analysis-data.json includes summary.recommendation'
      : 'analysis-data.json missing summary.recommendation'
  );

  if (summary) {
    const actualDuration = analysisData.metadata?.videoDuration;
    const expectedDuration = summary.metadata?.videoDuration;
    const durationDelta = typeof actualDuration === 'number' && typeof expectedDuration === 'number'
      ? Math.abs(actualDuration - expectedDuration)
      : null;
    pushBooleanCheck(
      checks,
      'analysisData.metadata.videoDuration',
      durationDelta !== null && durationDelta <= 0.001,
      durationDelta !== null && durationDelta <= 0.001
        ? 'analysis-data.json metadata.videoDuration matches summary.json within tolerance'
        : 'analysis-data.json metadata.videoDuration does not match summary.json within tolerance',
      { expected: expectedDuration ?? null, actual: actualDuration ?? null, tolerance: 0.001, delta: durationDelta }
    );

    pushBooleanCheck(
      checks,
      'analysisData.metadata.totalTokens',
      analysisData.metadata?.totalTokens === summary.metadata?.totalTokens,
      analysisData.metadata?.totalTokens === summary.metadata?.totalTokens
        ? 'analysis-data.json metadata.totalTokens matches summary.json'
        : 'analysis-data.json metadata.totalTokens does not match summary.json',
      { expected: summary.metadata?.totalTokens ?? null, actual: analysisData.metadata?.totalTokens ?? null }
    );
  } else {
    pushBooleanCheck(checks, 'analysisData.summaryDependency', false, 'summary.json missing; cannot validate analysis-data.json sibling consistency');
  }

  pushBooleanCheck(
    checks,
    'analysisData.metadata.chunksAnalyzed',
    typeof analysisData.metadata?.chunksAnalyzed === 'number' && analysisData.metadata.chunksAnalyzed === (chunkAnalysis?.chunks?.length || 0),
    typeof analysisData.metadata?.chunksAnalyzed === 'number' && analysisData.metadata.chunksAnalyzed === (chunkAnalysis?.chunks?.length || 0)
      ? 'analysis-data.json metadata.chunksAnalyzed matches chunkAnalysis.chunks.length'
      : 'analysis-data.json metadata.chunksAnalyzed does not match chunkAnalysis.chunks.length',
    { expected: chunkAnalysis?.chunks?.length || 0, actual: analysisData.metadata?.chunksAnalyzed ?? null }
  );

  return finalizeSmokeCheck('analysis-data.json', analysisDataPath, checks);
}

function validateFinalReportSmoke(outputDir) {
  const finalReportPath = outputManager.getReportPath(outputDir, 'summary', 'FINAL-REPORT.md');
  const checks = [
    existsCheck('finalReport.exists', finalReportPath, 'FINAL-REPORT.md missing at canonical summary path')
  ];

  if (!fs.existsSync(finalReportPath)) {
    return finalizeSmokeCheck('FINAL-REPORT.md', finalReportPath, checks);
  }

  const report = fs.readFileSync(finalReportPath, 'utf8');

  for (const heading of CANONICAL_REPORT_HEADINGS) {
    pushBooleanCheck(
      checks,
      `finalReport.heading.${heading}`,
      report.includes(heading),
      report.includes(heading)
        ? `FINAL-REPORT.md includes heading ${heading}`
        : `FINAL-REPORT.md missing heading ${heading}`
    );
  }

  for (const reference of CANONICAL_REPORT_REFERENCES) {
    pushBooleanCheck(
      checks,
      `finalReport.reference.${reference}`,
      report.includes(reference),
      report.includes(reference)
        ? `FINAL-REPORT.md references ${reference}`
        : `FINAL-REPORT.md missing reference to ${reference}`
    );
  }

  return finalizeSmokeCheck('FINAL-REPORT.md', finalReportPath, checks);
}

function validateSummaryPresentationSmoke(outputDir) {
  const results = [
    validateSummaryJsonSmoke(outputDir),
    validateAnalysisDataSmoke(outputDir),
    validateFinalReportSmoke(outputDir)
  ];

  const failed = results.filter((result) => result.status === 'fail');
  return {
    outputDir,
    status: failed.length > 0 ? 'fail' : 'pass',
    results,
    summary: failed.length > 0
      ? `Summary/presentation smoke failed for ${failed.map((result) => result.name).join(', ')}`
      : 'Summary/presentation smoke passed.'
  };
}

module.exports = {
  CANONICAL_REPORT_HEADINGS,
  CANONICAL_REPORT_REFERENCES,
  validateSummaryJsonSmoke,
  validateAnalysisDataSmoke,
  validateFinalReportSmoke,
  validateSummaryPresentationSmoke
};
