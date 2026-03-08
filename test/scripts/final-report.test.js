const fs = require('fs');
const path = require('path');
const test = require('node:test');
const { ok, property } = require('../helpers/assertions');

const finalReportScript = require('../../server/scripts/report/final-report.cjs');

const testOutputDir = '/tmp/test-final-report-output';

function createPersonaAssets(baseDir) {
  const personaDir = path.join(baseDir, 'assets', 'input', 'personas');
  fs.mkdirSync(personaDir, { recursive: true });
  fs.writeFileSync(path.join(personaDir, 'SOUL.md'), '# Test SOUL\n', 'utf8');
  fs.writeFileSync(path.join(personaDir, 'GOAL.md'), '# Test GOAL\n', 'utf8');
}

test('Final Report Script', async (t) => {
  t.beforeEach(() => {
    fs.rmSync(testOutputDir, { recursive: true, force: true });
    fs.mkdirSync(testOutputDir, { recursive: true });
  });

  t.afterEach(() => {
    fs.rmSync(testOutputDir, { recursive: true, force: true });
  });

  await t.test('writes FINAL-REPORT.md and analysis-data.json to summary directory with valid links', async () => {
    createPersonaAssets(testOutputDir);

    const result = await finalReportScript.run({
      outputDir: testOutputDir,
      artifacts: {
        summary: {
          duration: 12,
          totalTokens: 321,
          keyMetrics: { averages: { boredom: 4.2, excitement: 6.8 } },
          recommendation: { text: 'Keep pacing tight.', reasoning: 'Excitement outweighs boredom.' }
        },
        chunkAnalysis: {
          chunks: [
            {
              chunkIndex: 0,
              startTime: 0,
              endTime: 6,
              summary: 'Strong opening',
              emotions: { excitement: { score: 7 }, boredom: { score: 3 } },
              dominant_emotion: 'excitement'
            }
          ],
          totalTokens: 321,
          videoDuration: 12,
          persona: {
            soulPath: 'cast/impatient-teenager/SOUL.md',
            goalPath: 'goals/video-ad-evaluation.md'
          }
        }
      },
      config: { version: '1.0', name: 'COD Test Pipeline' }
    });

    property(result.artifacts, 'finalReport');
    property(result.artifacts.finalReport, 'analysisDataPath');

    const summaryDir = path.join(testOutputDir, 'phase3-report', 'summary');
    const reportPath = path.join(summaryDir, 'FINAL-REPORT.md');
    const jsonPath = path.join(summaryDir, 'analysis-data.json');

    ok(fs.existsSync(reportPath));
    ok(fs.existsSync(jsonPath));

    const report = fs.readFileSync(reportPath, 'utf8');
    ok(report.includes('Raw Data: `analysis-data.json`'));
    ok(report.includes('Metrics: `../metrics/metrics.json`'));
    ok(report.includes('ID: impatient-teenager'));
    ok(report.includes('SOUL Asset: ../../assets/input/personas/SOUL.md'));

    const analysisData = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    property(analysisData, 'metadata');
    property(analysisData, 'summary');
    property(analysisData, 'data');
  });

  await t.test('renders explicit missing persona file messaging when assets are absent', async () => {
    await finalReportScript.run({
      outputDir: testOutputDir,
      artifacts: {
        summary: {
          duration: 5,
          totalTokens: 100,
          keyMetrics: {},
          recommendation: { text: 'N/A', reasoning: 'N/A' }
        },
        chunkAnalysis: {
          chunks: [],
          totalTokens: 100,
          videoDuration: 5,
          persona: {}
        }
      },
      config: { version: '1.0', name: 'Missing Persona Test' }
    });

    const report = fs.readFileSync(path.join(testOutputDir, 'phase3-report', 'summary', 'FINAL-REPORT.md'), 'utf8');
    ok(report.includes('ID: unknown (no soulPath configured)'));
    ok(report.includes('SOUL Asset: missing (expected ../../assets/input/personas/SOUL.md)'));
    ok(report.includes('GOAL Asset: missing (expected ../../assets/input/personas/GOAL.md)'));
  });
});
