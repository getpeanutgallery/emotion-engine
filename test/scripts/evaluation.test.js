const fs = require('fs');
const path = require('path');
const test = require('node:test');
const { property, ok, is } = require('../helpers/assertions');

function mockModule(modulePath, mockExports) {
  const absolutePath = require.resolve(modulePath, { paths: [__dirname] });
  if (require.cache[absolutePath]) delete require.cache[absolutePath];
  require.cache[absolutePath] = { exports: mockExports, loaded: true, id: absolutePath, filename: absolutePath };
}

const mockAIProvider = {
  getProviderFromEnv: () => ({
    complete: async () => ({
      content: JSON.stringify({ text: 'Test recommendation', reasoning: 'Test reasoning' }),
      usage: { input: 100, output: 50 }
    })
  })
};

mockModule('ai-providers/ai-provider-interface.js', mockAIProvider);

const evaluationScript = require('../../server/scripts/report/evaluation.cjs');

test('Evaluation Report Script', async (t) => {
  const testOutputDir = '/tmp/test-evaluation-output';

  t.beforeEach(() => {
    if (!fs.existsSync(testOutputDir)) fs.mkdirSync(testOutputDir, { recursive: true });
  });

  t.afterEach(() => {
    if (fs.existsSync(testOutputDir)) fs.rmSync(testOutputDir, { recursive: true, force: true });
  });

  t.test('run function', async (tNested) => {
    await tNested.test('exports run function', () => {
      is(typeof evaluationScript.run, 'function');
    });

    await tNested.test('returns correct output structure', async () => {
      const result = await evaluationScript.run({
        outputDir: testOutputDir,
        artifacts: {
          dialogueData: { dialogue_segments: [], summary: '' },
          musicData: { segments: [], summary: '', hasMusic: false },
          chunkAnalysis: {
            chunks: [{
              chunkIndex: 0,
              startTime: 0,
              endTime: 8,
              summary: 'Test chunk',
              emotions: { patience: { score: 7, reasoning: 'Test' } },
              dominant_emotion: 'patience',
              tokens: 250
            }],
            totalTokens: 250,
            videoDuration: 16
          },
          perSecondData: {
            per_second_data: [{ second: 0, emotions: { patience: { score: 7 } }, dominant_emotion: 'patience' }],
            totalSeconds: 16,
            summary: 'Test summary'
          }
        },
        config: {}
      });

      property(result, 'artifacts');
      property(result.artifacts, 'reportFiles');
      property(result.artifacts.reportFiles, 'main');
      property(result.artifacts.reportFiles, 'json');
      property(result.artifacts, 'summary');
    });

    await tNested.test('writes FINAL-REPORT.md to output directory', async () => {
      await evaluationScript.run({
        outputDir: testOutputDir,
        artifacts: {
          dialogueData: { dialogue_segments: [], summary: '' },
          musicData: { segments: [], summary: '', hasMusic: false },
          chunkAnalysis: { chunks: [], totalTokens: 0, videoDuration: 16 },
          perSecondData: { per_second_data: [], totalSeconds: 16, summary: '' }
        },
        config: {}
      });

      const reportPath = path.join(testOutputDir, 'FINAL-REPORT.md');
      ok(fs.existsSync(reportPath));
      const content = fs.readFileSync(reportPath, 'utf8');
      ok(content.includes('# Emotion Analysis Report'));
      ok(content.includes('Executive Summary'));
      ok(content.includes('Chunk-by-Chunk Analysis'));
    });

    await tNested.test('writes analysis-data.json to output directory', async () => {
      await evaluationScript.run({
        outputDir: testOutputDir,
        artifacts: {
          dialogueData: { dialogue_segments: [], summary: '' },
          musicData: { segments: [], summary: '', hasMusic: false },
          chunkAnalysis: { chunks: [], totalTokens: 0, videoDuration: 16 },
          perSecondData: { per_second_data: [], totalSeconds: 16, summary: '' }
        },
        config: {}
      });

      const jsonPath = path.join(testOutputDir, 'analysis-data.json');
      ok(fs.existsSync(jsonPath));
      const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
      property(data, 'metadata');
      property(data, 'summary');
      property(data, 'data');
    });
  });

  t.test('report content', async (tNested) => {
    await tNested.test('includes video duration in executive summary', async () => {
      await evaluationScript.run({
        outputDir: testOutputDir,
        artifacts: {
          dialogueData: { dialogue_segments: [], summary: '' },
          musicData: { segments: [], summary: '', hasMusic: false },
          chunkAnalysis: { chunks: [], totalTokens: 500, videoDuration: 30 },
          perSecondData: { per_second_data: [], totalSeconds: 30, summary: '' }
        },
        config: {}
      });

      const content = fs.readFileSync(path.join(testOutputDir, 'FINAL-REPORT.md'), 'utf8');
      ok(content.includes('Video Duration:'));
      ok(content.includes('30.0 seconds'));
    });

    await tNested.test('includes chunk-by-chunk analysis section', async () => {
      await evaluationScript.run({
        outputDir: testOutputDir,
        artifacts: {
          dialogueData: { dialogue_segments: [], summary: '' },
          musicData: { segments: [], summary: '', hasMusic: false },
          chunkAnalysis: {
            chunks: [{
              chunkIndex: 0,
              startTime: 0,
              endTime: 8,
              summary: 'First chunk summary',
              emotions: { patience: { score: 7, reasoning: 'Test' } },
              dominant_emotion: 'patience',
              tokens: 250
            }],
            totalTokens: 250,
            videoDuration: 8
          },
          perSecondData: { per_second_data: [], totalSeconds: 8, summary: '' }
        },
        config: {}
      });

      const content = fs.readFileSync(path.join(testOutputDir, 'FINAL-REPORT.md'), 'utf8');
      ok(content.includes('Chunk-by-Chunk Analysis'));
      ok(content.includes('First chunk summary'));
    });
  });

  t.test('summary calculation', async (tNested) => {
    await tNested.test('calculates total tokens correctly', async () => {
      const result = await evaluationScript.run({
        outputDir: testOutputDir,
        artifacts: {
          dialogueData: { dialogue_segments: [], summary: '' },
          musicData: { segments: [], summary: '', hasMusic: false },
          chunkAnalysis: { chunks: [], totalTokens: 750, videoDuration: 16 },
          perSecondData: { per_second_data: [], totalSeconds: 16, summary: '' }
        },
        config: {}
      });

      is(result.artifacts.summary.totalTokens, 750);
    });

    await tNested.test('includes duration in summary', async () => {
      const result = await evaluationScript.run({
        outputDir: testOutputDir,
        artifacts: {
          dialogueData: { dialogue_segments: [], summary: '' },
          musicData: { segments: [], summary: '', hasMusic: false },
          chunkAnalysis: { chunks: [], totalTokens: 0, videoDuration: 45.5 },
          perSecondData: { per_second_data: [], totalSeconds: 45, summary: '' }
        },
        config: {}
      });

      is(result.artifacts.summary.duration, 45.5);
    });
  });
});
