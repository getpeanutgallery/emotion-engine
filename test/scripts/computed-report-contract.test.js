const fs = require('fs');
const path = require('path');
const test = require('node:test');
const { ok, is, match } = require('../helpers/assertions');
const { executeScript } = require('../../server/lib/script-runner.cjs');

const testOutputDir = '/tmp/test-computed-report-contract';

function clean() {
  fs.rmSync(testOutputDir, { recursive: true, force: true });
  fs.mkdirSync(testOutputDir, { recursive: true });
}

function buildChunkAnalysisFixture() {
  return {
    chunks: [
      {
        chunkIndex: 0,
        startTime: 0,
        endTime: 4,
        emotions: {
          excitement: { score: 8, reasoning: 'strong hook' },
          boredom: { score: 2, reasoning: 'engaging start' }
        },
        dominant_emotion: 'excitement',
        confidence: 0.9
      },
      {
        chunkIndex: 1,
        startTime: 6,
        endTime: 10,
        status: 'failed',
        errorReason: 'upstream parse failure',
        emotions: {
          excitement: { score: 5 },
          boredom: { score: 5 }
        },
        dominant_emotion: 'excitement'
      }
    ],
    totalTokens: 123,
    videoDuration: 10
  };
}

test('computed/report scripts emit universal script-result envelopes', async (t) => {
  t.beforeEach(clean);
  t.afterEach(() => fs.rmSync(testOutputDir, { recursive: true, force: true }));

  await t.test('metrics and emotional-analysis treat an exact upstream score of 1 as 0.1, not 1.0', async () => {
    const chunkAnalysis = {
      chunks: [
        {
          chunkIndex: 0,
          startTime: 0,
          endTime: 5,
          emotions: { boredom: { score: 1 }, excitement: { score: 10 } },
          dominant_emotion: 'excitement',
          confidence: 0.9
        },
        {
          chunkIndex: 1,
          startTime: 5,
          endTime: 10,
          emotions: { boredom: { score: 8 }, excitement: { score: 2 } },
          dominant_emotion: 'boredom',
          confidence: 0.9
        }
      ],
      totalTokens: 50,
      videoDuration: 10
    };

    const metricsResult = await executeScript({
      phase: 'phase3-report',
      scriptPath: 'server/scripts/report/metrics.cjs',
      input: { outputDir: testOutputDir, artifacts: { chunkAnalysis }, config: { name: 'test', version: 'test' } }
    });

    const metricsPath = metricsResult.scriptResult.payload.data.path;
    const metrics = JSON.parse(fs.readFileSync(metricsPath, 'utf8'));
    is(metrics.averages.boredom, 0.45);
    is(metrics.peakMoments.boredom.highest.timestamp, 5);
    is(metrics.trends.boredom.direction, 'increasing');

    const emotionalResult = await executeScript({
      phase: 'phase3-report',
      scriptPath: 'server/scripts/report/emotional-analysis.cjs',
      input: { outputDir: testOutputDir, artifacts: { chunkAnalysis }, config: { name: 'test', version: 'test' } }
    });

    const emotionalPath = emotionalResult.scriptResult.payload.data.path;
    const emotional = JSON.parse(fs.readFileSync(emotionalPath, 'utf8'));
    ok(!emotional.criticalMoments.some((moment) => moment.timestamp === 0 && moment.emotion === 'boredom' && moment.type === 'threshold-high'));
    ok(emotional.criticalMoments.some((moment) => moment.timestamp === 5 && moment.emotion === 'boredom' && moment.type === 'threshold-high'));
  });

  await t.test('metrics records chunk-derived computation as degraded success', async () => {
    const result = await executeScript({
      phase: 'phase3-report',
      scriptPath: 'server/scripts/report/metrics.cjs',
      input: {
        outputDir: testOutputDir,
        artifacts: {
          chunkAnalysis: buildChunkAnalysisFixture()
        },
        config: { name: 'test', version: 'test' }
      }
    });

    is(result.scriptResult.status, 'success');
    is(result.scriptResult.payload.artifactKey, 'metricsData');
    is(result.scriptResult.diagnostics.degraded, true);
    ok(result.scriptResult.diagnostics.warnings.some((warning) => warning.includes('Computed report metrics from chunkAnalysis')));
    ok(fs.existsSync(path.join(testOutputDir, 'phase3-report', 'script-results', 'metrics.success.json')));
  });

  await t.test('summary prefers canonical summary/ report paths while tolerating missing recommendation data', async () => {
    const summaryDir = path.join(testOutputDir, 'phase3-report', 'summary');
    fs.mkdirSync(summaryDir, { recursive: true });
    fs.writeFileSync(path.join(summaryDir, 'FINAL-REPORT.md'), '# Report\n', 'utf8');
    fs.writeFileSync(path.join(summaryDir, 'analysis-data.json'), '{}\n', 'utf8');

    const result = await executeScript({
      phase: 'phase3-report',
      scriptPath: 'server/scripts/report/summary.cjs',
      input: {
        outputDir: testOutputDir,
        artifacts: {
          metricsData: { averages: { excitement: 0.8 }, peakMoments: {}, trends: {}, frictionIndex: 22, summary: { totalSeconds: 4, videoDuration: 10 } },
          emotionalAnalysis: {},
          chunkAnalysis: buildChunkAnalysisFixture()
        },
        config: { name: 'test', version: 'test' }
      }
    });

    is(result.scriptResult.status, 'success');
    is(result.scriptResult.diagnostics.degraded, true);
    const summaryPath = path.join(testOutputDir, 'phase3-report', 'summary', 'summary.json');
    const saved = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
    is(saved.reportPaths.finalReport, path.join(testOutputDir, 'phase3-report', 'summary', 'FINAL-REPORT.md'));
    is(saved.reportPaths.analysisData, path.join(testOutputDir, 'phase3-report', 'summary', 'analysis-data.json'));
  });

  await t.test('final-report emits degraded success when summary inputs are incomplete', async () => {
    const result = await executeScript({
      phase: 'phase3-report',
      scriptPath: 'server/scripts/report/final-report.cjs',
      input: {
        outputDir: testOutputDir,
        artifacts: {
          summary: {},
          chunkAnalysis: { chunks: [], totalTokens: 0, videoDuration: 0, persona: {} }
        },
        config: { name: 'test', version: 'test' }
      }
    });

    is(result.scriptResult.status, 'success');
    is(result.scriptResult.payload.artifactKey, 'finalReport');
    is(result.scriptResult.diagnostics.degraded, true);
    ok(result.scriptResult.diagnostics.warnings.some((warning) => warning.includes('Summary artifact was missing')));
    ok(fs.existsSync(path.join(testOutputDir, 'phase3-report', 'summary', 'FINAL-REPORT.md')));
  });

  await t.test('evaluation remains legacy-only and reports that status via diagnostics', async () => {
    const evaluationScript = require('../../server/scripts/report/evaluation.cjs');
    is(evaluationScript.deterministicRecovery.lifecycle, 'legacy-only');

    const result = await executeScript({
      phase: 'phase3-report',
      scriptPath: 'server/scripts/report/evaluation.cjs',
      input: {
        outputDir: testOutputDir,
        artifacts: {
          chunkAnalysis: { chunks: [], totalTokens: 0, videoDuration: 16 }
        },
        config: { name: 'test', version: 'test' }
      }
    });

    is(result.scriptResult.status, 'success');
    is(result.scriptResult.diagnostics.degraded, true);
    match(result.scriptResult.diagnostics.warnings[0], /Legacy compatibility wrapper/);
    ok(fs.existsSync(path.join(testOutputDir, 'phase3-report', 'script-results', 'evaluation.success.json')));
  });
});
