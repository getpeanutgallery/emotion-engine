const fs = require('fs');
const path = require('path');
const test = require('node:test');
const { property, ok, is, rejects } = require('../helpers/assertions');

const videoPerSecondScript = require('../../server/scripts/process/video-per-second.cjs');

test('Video Per-Second Script', async (t) => {
  const testOutputDir = '/tmp/test-per-second-output';

  t.beforeEach(() => {
    if (!fs.existsSync(testOutputDir)) {
      fs.mkdirSync(testOutputDir, { recursive: true });
    }
  });

  t.afterEach(() => {
    if (fs.existsSync(testOutputDir)) {
      fs.rmSync(testOutputDir, { recursive: true, force: true });
    }
  });

  t.test('run function', async (tNested) => {
    await tNested.test('exports run function', () => {
      is(typeof videoPerSecondScript.run, 'function');
    });

    await tNested.test('throws error when chunkAnalysis is missing', async () => {
      await rejects(videoPerSecondScript.run({
        assetPath: '/path/to/test-video.mp4',
        outputDir: testOutputDir,
        artifacts: {}
      }), /chunkAnalysis artifact is required/);
    });

    await tNested.test('throws error when chunks array is empty', async () => {
      await rejects(videoPerSecondScript.run({
        assetPath: '/path/to/test-video.mp4',
        outputDir: testOutputDir,
        artifacts: {
          chunkAnalysis: { chunks: [] }
        }
      }), /chunkAnalysis artifact is required/);
    });

    await tNested.test('returns correct output structure', async () => {
      const result = await videoPerSecondScript.run({
        assetPath: '/path/to/test-video.mp4',
        outputDir: testOutputDir,
        artifacts: {
          chunkAnalysis: {
            chunks: [{
              chunkIndex: 0,
              startTime: 0,
              endTime: 8,
              summary: 'Test chunk',
              emotions: {
                patience: { score: 7, reasoning: 'Test' },
                boredom: { score: 3, reasoning: 'Test' }
              },
              dominant_emotion: 'patience',
              tokens: 250
            }],
            totalTokens: 250,
            videoDuration: 16
          }
        }
      });

      property(result, 'artifacts');
      property(result.artifacts, 'perSecondData');
      property(result.artifacts.perSecondData, 'per_second_data');
      property(result.artifacts.perSecondData, 'totalSeconds');
      property(result.artifacts.perSecondData, 'summary');
    });

    await tNested.test('writes per-second-data.json to phase output directory', async () => {
      await videoPerSecondScript.run({
        assetPath: '/path/to/test-video.mp4',
        outputDir: testOutputDir,
        artifacts: {
          chunkAnalysis: {
            chunks: [{
              chunkIndex: 0,
              startTime: 0,
              endTime: 8,
              summary: 'Test',
              emotions: { patience: { score: 7 } },
              tokens: 250
            }],
            totalTokens: 250,
            videoDuration: 16
          }
        }
      });

      const artifactPath = path.join(testOutputDir, 'phase2-process', 'per-second-data.json');
      ok(fs.existsSync(artifactPath));
      const data = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
      property(data, 'per_second_data');
      property(data, 'totalSeconds');
    });
  });

  t.test('per-second data structure', async (tNested) => {
    await tNested.test('generates correct number of data points', async () => {
      const result = await videoPerSecondScript.run({
        assetPath: '/path/to/test-video.mp4',
        outputDir: testOutputDir,
        artifacts: {
          chunkAnalysis: {
            chunks: [{
              chunkIndex: 0,
              startTime: 0,
              endTime: 8,
              summary: 'Test',
              emotions: { patience: { score: 7 } },
              tokens: 250
            }],
            totalTokens: 250,
            videoDuration: 16
          }
        }
      });

      is(result.artifacts.perSecondData.per_second_data.length, 16);
    });

    await tNested.test('each data point has required fields', async () => {
      const result = await videoPerSecondScript.run({
        assetPath: '/path/to/test-video.mp4',
        outputDir: testOutputDir,
        artifacts: {
          chunkAnalysis: {
            chunks: [{
              chunkIndex: 0,
              startTime: 0,
              endTime: 8,
              summary: 'Test',
              emotions: { patience: { score: 7 } },
              tokens: 250
            }],
            totalTokens: 250,
            videoDuration: 16
          }
        }
      });

      const dataPoint = result.artifacts.perSecondData.per_second_data[0];
      property(dataPoint, 'second');
      property(dataPoint, 'timestamp');
      property(dataPoint, 'emotions');
      property(dataPoint, 'dominant_emotion');
      property(dataPoint, 'chunkIndex');
    });
  });
});
