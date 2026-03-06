/**
 * Unit Tests for Evaluation Report Script
 * 
 * Tests the evaluation.cjs script.
 */

const fs = require('fs');
const path = require('path');

// Mock AI provider
const mockAIProvider = {
  getProviderFromEnv: () => ({
    complete: async (options) => ({
      content: JSON.stringify({
        text: 'Test recommendation',
        reasoning: 'Test reasoning'
      }),
      usage: {
        input: 100,
        output: 50
      }
    })
  })
};

jest.mock('ai-providers/ai-provider-interface.js', () => mockAIProvider);

const evaluationScript = require('../../server/scripts/report/evaluation.cjs');

describe('Evaluation Report Script', () => {
  const testOutputDir = '/tmp/test-evaluation-output';

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
      expect(typeof evaluationScript.run).toBe('function');
    });

    test('returns correct output structure', async () => {
      const input = {
        outputDir: testOutputDir,
        artifacts: {
          dialogueData: { dialogue_segments: [], summary: '' },
          musicData: { segments: [], summary: '', hasMusic: false },
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
          },
          perSecondData: {
            per_second_data: [
              {
                second: 0,
                emotions: {
                  patience: { score: 7 },
                  boredom: { score: 3 }
                },
                dominant_emotion: 'patience'
              }
            ],
            totalSeconds: 16,
            summary: 'Test summary'
          }
        },
        config: {}
      };

      const result = await evaluationScript.run(input);

      expect(result).toHaveProperty('artifacts');
      expect(result.artifacts).toHaveProperty('reportFiles');
      expect(result.artifacts.reportFiles).toHaveProperty('main');
      expect(result.artifacts.reportFiles).toHaveProperty('json');
      expect(result.artifacts).toHaveProperty('summary');
    });

    test('writes FINAL-REPORT.md to output directory', async () => {
      const input = {
        outputDir: testOutputDir,
        artifacts: {
          dialogueData: { dialogue_segments: [], summary: '' },
          musicData: { segments: [], summary: '', hasMusic: false },
          chunkAnalysis: {
            chunks: [],
            totalTokens: 0,
            videoDuration: 16
          },
          perSecondData: {
            per_second_data: [],
            totalSeconds: 16,
            summary: ''
          }
        }
      };

      await evaluationScript.run(input);

      const reportPath = path.join(testOutputDir, 'FINAL-REPORT.md');
      expect(fs.existsSync(reportPath)).toBe(true);

      const content = fs.readFileSync(reportPath, 'utf8');
      expect(content).toContain('# Emotion Analysis Report');
      expect(content).toContain('Executive Summary');
      expect(content).toContain('Key Metrics');
    });

    test('writes analysis-data.json to output directory', async () => {
      const input = {
        outputDir: testOutputDir,
        artifacts: {
          dialogueData: { dialogue_segments: [], summary: '' },
          musicData: { segments: [], summary: '', hasMusic: false },
          chunkAnalysis: {
            chunks: [],
            totalTokens: 0,
            videoDuration: 16
          },
          perSecondData: {
            per_second_data: [],
            totalSeconds: 16,
            summary: ''
          }
        }
      };

      await evaluationScript.run(input);

      const jsonPath = path.join(testOutputDir, 'analysis-data.json');
      expect(fs.existsSync(jsonPath)).toBe(true);

      const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
      expect(data).toHaveProperty('metadata');
      expect(data).toHaveProperty('summary');
      expect(data).toHaveProperty('data');
    });
  });

  describe('report content', () => {
    test('includes executive summary section', async () => {
      const input = {
        outputDir: testOutputDir,
        artifacts: {
          dialogueData: { dialogue_segments: [], summary: '' },
          musicData: { segments: [], summary: '', hasMusic: false },
          chunkAnalysis: {
            chunks: [],
            totalTokens: 500,
            videoDuration: 30
          },
          perSecondData: {
            per_second_data: [],
            totalSeconds: 30,
            summary: ''
          }
        }
      };

      await evaluationScript.run(input);

      const reportPath = path.join(testOutputDir, 'FINAL-REPORT.md');
      const content = fs.readFileSync(reportPath, 'utf8');

      expect(content).toContain('Executive Summary');
      expect(content).toContain('30.0 seconds');
      expect(content).toContain('500');
    });

    test('includes key metrics table', async () => {
      const input = {
        outputDir: testOutputDir,
        artifacts: {
          dialogueData: { dialogue_segments: [], summary: '' },
          musicData: { segments: [], summary: '', hasMusic: false },
          chunkAnalysis: {
            chunks: [],
            totalTokens: 0,
            videoDuration: 16
          },
          perSecondData: {
            per_second_data: [
              {
                second: 0,
                emotions: {
                  patience: { score: 7 },
                  boredom: { score: 3 },
                  excitement: { score: 6 }
                }
              }
            ],
            totalSeconds: 1,
            summary: ''
          }
        }
      };

      await evaluationScript.run(input);

      const reportPath = path.join(testOutputDir, 'FINAL-REPORT.md');
      const content = fs.readFileSync(reportPath, 'utf8');

      expect(content).toContain('Key Metrics');
      expect(content).toContain('Patience');
      expect(content).toContain('Boredom');
      expect(content).toContain('Excitement');
    });

    test('includes recommendation section', async () => {
      const input = {
        outputDir: testOutputDir,
        artifacts: {
          dialogueData: { dialogue_segments: [], summary: '' },
          musicData: { segments: [], summary: '', hasMusic: false },
          chunkAnalysis: {
            chunks: [],
            totalTokens: 0,
            videoDuration: 16
          },
          perSecondData: {
            per_second_data: [],
            totalSeconds: 16,
            summary: ''
          }
        }
      };

      await evaluationScript.run(input);

      const reportPath = path.join(testOutputDir, 'FINAL-REPORT.md');
      const content = fs.readFileSync(reportPath, 'utf8');

      expect(content).toContain('Recommendation');
    });

    test('includes chunk-by-chunk analysis', async () => {
      const input = {
        outputDir: testOutputDir,
        artifacts: {
          dialogueData: { dialogue_segments: [], summary: '' },
          musicData: { segments: [], summary: '', hasMusic: false },
          chunkAnalysis: {
            chunks: [
              {
                chunkIndex: 0,
                startTime: 0,
                endTime: 8,
                summary: 'First chunk summary',
                emotions: {
                  patience: { score: 7, reasoning: 'Test' }
                },
                dominant_emotion: 'patience',
                tokens: 250
              }
            ],
            totalTokens: 250,
            videoDuration: 8
          },
          perSecondData: {
            per_second_data: [],
            totalSeconds: 8,
            summary: ''
          }
        }
      };

      await evaluationScript.run(input);

      const reportPath = path.join(testOutputDir, 'FINAL-REPORT.md');
      const content = fs.readFileSync(reportPath, 'utf8');

      expect(content).toContain('Chunk-by-Chunk Analysis');
      expect(content).toContain('First chunk summary');
    });
  });

  describe('summary calculation', () => {
    test('calculates total tokens correctly', async () => {
      const input = {
        outputDir: testOutputDir,
        artifacts: {
          dialogueData: { dialogue_segments: [], summary: '' },
          musicData: { segments: [], summary: '', hasMusic: false },
          chunkAnalysis: {
            chunks: [],
            totalTokens: 750,
            videoDuration: 16
          },
          perSecondData: {
            per_second_data: [],
            totalSeconds: 16,
            summary: ''
          }
        }
      };

      const result = await evaluationScript.run(input);

      expect(result.artifacts.summary.totalTokens).toBe(750);
    });

    test('includes duration in summary', async () => {
      const input = {
        outputDir: testOutputDir,
        artifacts: {
          dialogueData: { dialogue_segments: [], summary: '' },
          musicData: { segments: [], summary: '', hasMusic: false },
          chunkAnalysis: {
            chunks: [],
            totalTokens: 0,
            videoDuration: 45.5
          },
          perSecondData: {
            per_second_data: [],
            totalSeconds: 45,
            summary: ''
          }
        }
      };

      const result = await evaluationScript.run(input);

      expect(result.artifacts.summary.duration).toBe(45.5);
    });
  });
});
