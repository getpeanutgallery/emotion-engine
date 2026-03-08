const fs = require('fs');
const path = require('path');
const test = require('node:test');
const { ok, is, property } = require('../helpers/assertions');

const metricsScript = require('../../server/scripts/report/metrics.cjs');
const emotionalAnalysisScript = require('../../server/scripts/report/emotional-analysis.cjs');

const testOutputDir = '/tmp/test-report-phase3-fallback';

function buildChunkFixture() {
  return {
    chunkAnalysis: {
      chunks: [
        {
          chunkIndex: 0,
          startTime: 0,
          endTime: 5,
          emotions: {
            patience: { score: 9 },
            boredom: { score: 2 },
            excitement: { score: 7 }
          },
          dominant_emotion: 'patience'
        },
        {
          chunkIndex: 1,
          startTime: 5,
          endTime: 10,
          emotions: {
            patience: { score: 3 },
            boredom: { score: 8 },
            excitement: { score: 3 }
          },
          dominant_emotion: 'boredom'
        }
      ],
      totalTokens: 100,
      videoDuration: 10
    },
    perSecondData: {
      per_second_data: [],
      totalSeconds: 0
    }
  };
}

test('Phase3 report scripts compute fallback from chunkAnalysis when perSecondData is missing', async (t) => {
  t.beforeEach(() => {
    fs.rmSync(testOutputDir, { recursive: true, force: true });
    fs.mkdirSync(testOutputDir, { recursive: true });
  });

  t.afterEach(() => {
    fs.rmSync(testOutputDir, { recursive: true, force: true });
  });

  await t.test('metrics.cjs does not emit empty placeholder metrics', async () => {
    const result = await metricsScript.run({
      outputDir: testOutputDir,
      artifacts: buildChunkFixture(),
      config: { version: 'test' }
    });

    property(result.artifacts, 'metricsData');
    const metricsData = result.artifacts.metricsData;

    ok(Object.keys(metricsData.averages).length > 0);
    ok(typeof metricsData.frictionIndex === 'number');
    is(metricsData.implementationStatus.state, 'computed');

    const savedPath = path.join(testOutputDir, 'phase3-report', 'metrics', 'metrics.json');
    ok(fs.existsSync(savedPath));
    const saved = JSON.parse(fs.readFileSync(savedPath, 'utf8'));
    ok(saved.summary.totalSeconds > 0);
    ok(Object.keys(saved.averages).length > 0);
  });

  await t.test('emotional-analysis.cjs does not emit zero-second/null placeholder analysis', async () => {
    const result = await emotionalAnalysisScript.run({
      outputDir: testOutputDir,
      artifacts: buildChunkFixture(),
      config: { version: 'test' }
    });

    property(result.artifacts, 'emotionalAnalysis');

    const savedPath = path.join(testOutputDir, 'phase3-report', 'emotional-analysis', 'emotional-data.json');
    ok(fs.existsSync(savedPath));
    const saved = JSON.parse(fs.readFileSync(savedPath, 'utf8'));

    ok(saved.summary.totalSeconds > 0);
    ok(saved.emotionalArc.timestamps.length > 0);
    ok(saved.scrollRiskTimeline.length > 0);
    is(saved.implementationStatus.state, 'computed');

    const firstChunk = saved.chunkAnalysis[0];
    ok(typeof firstChunk.scrollRisk === 'number');
    ok(firstChunk.dominantEmotion && firstChunk.dominantEmotion.emotion !== 'neutral');
  });

  await t.test('failed placeholder chunks are excluded from fallback metrics aggregation', async () => {
    const artifacts = buildChunkFixture();
    artifacts.chunkAnalysis.chunks.push({
      chunkIndex: 2,
      startTime: 10,
      endTime: 15,
      status: 'failed',
      errorReason: 'parse_error: placeholder fallback detected',
      summary: 'Analysis completed',
      emotions: {
        patience: { score: 5, reasoning: 'Default - could not parse response' },
        boredom: { score: 5, reasoning: 'Default - could not parse response' },
        excitement: { score: 5, reasoning: 'Default - could not parse response' }
      },
      dominant_emotion: 'patience',
      confidence: 0.5
    });

    await metricsScript.run({
      outputDir: testOutputDir,
      artifacts,
      config: { version: 'test' }
    });

    const metricsPath = path.join(testOutputDir, 'phase3-report', 'metrics', 'metrics.json');
    const metrics = JSON.parse(fs.readFileSync(metricsPath, 'utf8'));

    is(metrics.summary.totalChunks, 2);
    is(metrics.summary.failedChunks, 1);
  });
});
