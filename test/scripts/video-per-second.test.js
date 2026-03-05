/**
 * Unit Tests for Video Per-Second Script
 * 
 * Tests the video-per-second.cjs script.
 */

const fs = require('fs');
const path = require('path');

const videoPerSecondScript = require('../../server/scripts/process/video-per-second.cjs');

describe('Video Per-Second Script', () => {
  const testOutputDir = '/tmp/test-per-second-output';

  beforeEach(() => {
    if (!fs.existsSync(testOutputDir)) {
      fs.mkdirSync(testOutputDir, { recursive: true });
    }
  });

  afterEach(() => {
    if (fs.existsSync(testOutputDir)) {
      fs.rmSync(testOutputDir, { recursive: true, force: true });
    }
  });

  describe('run function', () => {
    test('exports run function', () => {
      expect(typeof videoPerSecondScript.run).toBe('function');
    });

    test('throws error when chunkAnalysis is missing', async () => {
      const input = {
        assetPath: '/path/to/test-video.mp4',
        outputDir: testOutputDir,
        artifacts: {}
      };

      await expect(videoPerSecondScript.run(input)).rejects.toThrow('chunkAnalysis artifact is required');
    });

    test('throws error when chunks array is empty', async () => {
      const input = {
        assetPath: '/path/to/test-video.mp4',
        outputDir: testOutputDir,
        artifacts: {
          chunkAnalysis: { chunks: [] }
        }
      };

      await expect(videoPerSecondScript.run(input)).rejects.toThrow('chunkAnalysis artifact is required');
    });

    test('returns correct output structure', async () => {
      const input = {
        assetPath: '/path/to/test-video.mp4',
        outputDir: testOutputDir,
        artifacts: {
          chunkAnalysis: {
            chunks: [
              {
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
              }
            ],
            totalTokens: 250,
            videoDuration: 16
          }
        }
      };

      const result = await videoPerSecondScript.run(input);

      expect(result).toHaveProperty('artifacts');
      expect(result.artifacts).toHaveProperty('perSecondData');
      expect(result.artifacts.perSecondData).toHaveProperty('per_second_data');
      expect(result.artifacts.perSecondData).toHaveProperty('totalSeconds');
      expect(result.artifacts.perSecondData).toHaveProperty('summary');
    });

    test('writes per-second-data.json to output directory', async () => {
      const input = {
        assetPath: '/path/to/test-video.mp4',
        outputDir: testOutputDir,
        artifacts: {
          chunkAnalysis: {
            chunks: [
              {
                chunkIndex: 0,
                startTime: 0,
                endTime: 8,
                summary: 'Test',
                emotions: { patience: { score: 7 } },
                tokens: 250
              }
            ],
            totalTokens: 250,
            videoDuration: 16
          }
        }
      };

      await videoPerSecondScript.run(input);

      const artifactPath = path.join(testOutputDir, 'per-second-data.json');
      expect(fs.existsSync(artifactPath)).toBe(true);

      const data = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
      expect(data).toHaveProperty('per_second_data');
      expect(data).toHaveProperty('totalSeconds');
    });
  });

  describe('per-second data structure', () => {
    test('generates correct number of data points', async () => {
      const input = {
        assetPath: '/path/to/test-video.mp4',
        outputDir: testOutputDir,
        artifacts: {
          chunkAnalysis: {
            chunks: [
              {
                chunkIndex: 0,
                startTime: 0,
                endTime: 8,
                summary: 'Test',
                emotions: { patience: { score: 7 } },
                tokens: 250
              }
            ],
            totalTokens: 250,
            videoDuration: 16
          }
        }
      };

      const result = await videoPerSecondScript.run(input);

      // 16 seconds = 16 data points (0-15)
      expect(result.artifacts.perSecondData.per_second_data.length).toBe(16);
    });

    test('each data point has required fields', async () => {
      const input = {
        assetPath: '/path/to/test-video.mp4',
        outputDir: testOutputDir,
        artifacts: {
          chunkAnalysis: {
            chunks: [
              {
                chunkIndex: 0,
                startTime: 0,
                endTime: 8,
                summary: 'Test',
                emotions: { patience: { score: 7 } },
                tokens: 250
              }
            ],
            totalTokens: 250,
            videoDuration: 16
          }
        }
      };

      const result = await videoPerSecondScript.run(input);
      const dataPoint = result.artifacts.perSecondData.per_second_data[0];

      expect(dataPoint).toHaveProperty('second');
      expect(dataPoint).toHaveProperty('timestamp');
      expect(dataPoint).toHaveProperty('emotions');
      expect(dataPoint).toHaveProperty('dominant_emotion');
      expect(dataPoint).toHaveProperty('chunkIndex');
    });

    test('interpolates emotions from chunks', async () => {
      const input = {
        assetPath: '/path/to/test-video.mp4',
        outputDir: testOutputDir,
        artifacts: {
          chunkAnalysis: {
            chunks: [
              {
                chunkIndex: 0,
                startTime: 0,
                endTime: 8,
                summary: 'Test',
                emotions: {
                  patience: { score: 8, reasoning: 'First chunk' },
                  boredom: { score: 2, reasoning: 'First chunk' }
                },
                dominant_emotion: 'patience',
                tokens: 250
              },
              {
                chunkIndex: 1,
                startTime: 8,
                endTime: 16,
                summary: 'Test',
                emotions: {
                  patience: { score: 6, reasoning: 'Second chunk' },
                  boredom: { score: 4, reasoning: 'Second chunk' }
                },
                dominant_emotion: 'patience',
                tokens: 250
              }
            ],
            totalTokens: 500,
            videoDuration: 16
          }
        }
      };

      const result = await videoPerSecondScript.run(input);
      const data = result.artifacts.perSecondData.per_second_data;

      // First 8 seconds should have emotions from first chunk
      expect(data[0].emotions.patience.score).toBe(8);
      expect(data[7].emotions.patience.score).toBe(8);

      // Next 8 seconds should have emotions from second chunk
      expect(data[8].emotions.patience.score).toBe(6);
      expect(data[15].emotions.patience.score).toBe(6);
    });
  });

  describe('summary generation', () => {
    test('generates summary with statistics', async () => {
      const input = {
        assetPath: '/path/to/test-video.mp4',
        outputDir: testOutputDir,
        artifacts: {
          chunkAnalysis: {
            chunks: [
              {
                chunkIndex: 0,
                startTime: 0,
                endTime: 8,
                summary: 'Test',
                emotions: {
                  patience: { score: 7 },
                  boredom: { score: 3 }
                },
                dominant_emotion: 'patience',
                tokens: 250
              }
            ],
            totalTokens: 250,
            videoDuration: 16
          }
        }
      };

      const result = await videoPerSecondScript.run(input);

      expect(result.artifacts.perSecondData.summary).toContain('Analyzed');
      expect(result.artifacts.perSecondData.summary).toContain('seconds');
      expect(result.artifacts.perSecondData.summary).toContain('chunks');
    });
  });
});
