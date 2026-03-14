const fs = require('fs');
const path = require('path');
const test = require('node:test');
const { ok, is, property, rejects, match } = require('../helpers/assertions');
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

  await t.test('video-per-second records degraded-success envelope when interpolation excludes failures or fills gaps', async () => {
    const result = await executeScript({
      phase: 'phase2-process',
      scriptPath: 'server/scripts/process/video-per-second.cjs',
      input: {
        assetPath: '/tmp/fake-video.mp4',
        outputDir: testOutputDir,
        artifacts: {
          chunkAnalysis: buildChunkAnalysisFixture()
        },
        config: { name: 'test', version: 'test' }
      }
    });

    property(result, 'scriptResult');
    is(result.scriptResult.status, 'success');
    is(result.scriptResult.payload.artifactKey, 'perSecondData');
    is(result.scriptResult.diagnostics.degraded, true);
    ok(result.scriptResult.diagnostics.warnings.some((warning) => warning.includes('Excluded 1 failed chunk')));
    ok(result.scriptResult.diagnostics.warnings.some((warning) => warning.includes('Filled 6 uncovered second')));
    is(result.artifacts.__scriptExecution['video-per-second'].status, 'success');
    ok(fs.existsSync(path.join(testOutputDir, 'phase2-process', 'script-results', 'video-per-second.success.json')));
  });

  await t.test('video-per-second fails with deterministic-recovery guidance when no successful chunks remain', async () => {
    await rejects(executeScript({
      phase: 'phase2-process',
      scriptPath: 'server/scripts/process/video-per-second.cjs',
      input: {
        assetPath: '/tmp/fake-video.mp4',
        outputDir: testOutputDir,
        artifacts: {
          chunkAnalysis: {
            chunks: [
              {
                chunkIndex: 0,
                startTime: 0,
                endTime: 8,
                status: 'failed',
                errorReason: 'upstream parse failure'
              }
            ],
            videoDuration: 8,
            totalTokens: 0
          }
        },
        config: { name: 'test', version: 'test' }
      }
    }), /requires at least one successful chunk/);

    const failureEnvelope = JSON.parse(fs.readFileSync(path.join(testOutputDir, 'phase2-process', 'script-results', 'video-per-second.failure.json'), 'utf8'));
    is(failureEnvelope.status, 'failure');
    is(failureEnvelope.failure.category, 'invalid_output');
    is(failureEnvelope.recoveryPolicy.nextAction.policy, 'deterministic_recovery');
    is(failureEnvelope.recoveryPolicy.nextAction.target, 'reload-persisted-artifacts');
  });

  await t.test('metrics marks chunk-derived fallback as degraded success', async () => {
    const result = await executeScript({
      phase: 'phase3-report',
      scriptPath: 'server/scripts/report/metrics.cjs',
      input: {
        outputDir: testOutputDir,
        artifacts: {
          chunkAnalysis: buildChunkAnalysisFixture(),
          perSecondData: { per_second_data: [], totalSeconds: 0 }
        },
        config: { name: 'test', version: 'test' }
      }
    });

    is(result.scriptResult.status, 'success');
    is(result.scriptResult.payload.artifactKey, 'metricsData');
    is(result.scriptResult.diagnostics.degraded, true);
    ok(result.scriptResult.diagnostics.warnings.some((warning) => warning.includes('Derived per-second metrics from chunkAnalysis')));
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
          metricsData: { averages: { excitement: 0.8 }, peakMoments: {}, trends: {}, frictionIndex: 22 },
          emotionalAnalysis: {},
          chunkAnalysis: buildChunkAnalysisFixture(),
          perSecondData: { per_second_data: [], totalSeconds: 0 }
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
          chunkAnalysis: { chunks: [], totalTokens: 0, videoDuration: 16 },
          perSecondData: { per_second_data: [], totalSeconds: 16 }
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
