/**
 * Unit Tests for Video Chunks Script
 * 
 * Tests the video-chunks.cjs script.
 * Uses mock AI provider and emotion-lenses-tool (no real API calls).
 */

const fs = require('fs');
const path = require('path');

// Mock emotion-lenses-tool
const mockEmotionLensesTool = {
  analyze: async (input) => ({
    prompt: 'Test prompt',
    state: {
      summary: 'Test chunk summary',
      emotions: {
        patience: { score: 7, reasoning: 'Test reasoning' },
        boredom: { score: 3, reasoning: 'Test reasoning' },
        excitement: { score: 6, reasoning: 'Test reasoning' }
      },
      dominant_emotion: 'patience',
      confidence: 0.85,
      previousSummary: ''
    },
    usage: {
      input: 150,
      output: 100
    }
  })
};

// Mock modules
jest.mock('tools/emotion-lenses-tool.cjs', () => mockEmotionLensesTool);

// Mock child_process exec
jest.mock('../../lib/video-utils.cjs', () => ({
  getVideoDuration: async () => 16.0
}));

jest.mock('child_process', () => ({
  exec: (cmd, callback) => {
    if (callback) callback(null, { stdout: '', stderr: '' });
    return { on: () => {} };
  },
  execSync: (cmd) => {
    if (cmd.includes('ffprobe')) {
      return Buffer.from('16.0');
    }
    return Buffer.from('');
  }
}));

const videoChunksScript = require('../../server/scripts/process/video-chunks.cjs');

describe('Video Chunks Script', () => {
  const testOutputDir = '/tmp/test-chunks-output';

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
      expect(typeof videoChunksScript.run).toBe('function');
    });

    test('throws error when toolVariables is missing', async () => {
      const input = {
        assetPath: '/path/to/test-video.mp4',
        outputDir: testOutputDir,
        artifacts: {},
        toolVariables: null
      };

      await expect(videoChunksScript.run(input)).rejects.toThrow('toolVariables.soulPath and toolVariables.goalPath are required');
    });

    test('throws error when soulPath is missing', async () => {
      const input = {
        assetPath: '/path/to/test-video.mp4',
        outputDir: testOutputDir,
        artifacts: {},
        toolVariables: {
          goalPath: '/path/to/GOAL.md',
          variables: { lenses: ['patience'] }
        }
      };

      await expect(videoChunksScript.run(input)).rejects.toThrow('toolVariables.soulPath and toolVariables.goalPath are required');
    });

    test('returns correct output structure', async () => {
      const input = {
        assetPath: '/path/to/test-video.mp4',
        outputDir: testOutputDir,
        artifacts: {
          dialogueData: { dialogue_segments: [] },
          musicData: { segments: [] }
        },
        toolVariables: {
          soulPath: '/path/to/SOUL.md',
          goalPath: '/path/to/GOAL.md',
          variables: {
            lenses: ['patience', 'boredom', 'excitement']
          }
        },
        config: {
          settings: {
            chunk_duration: 8,
            max_chunks: 2
          }
        }
      };

      const result = await videoChunksScript.run(input);

      expect(result).toHaveProperty('artifacts');
      expect(result.artifacts).toHaveProperty('chunkAnalysis');
      expect(result.artifacts.chunkAnalysis).toHaveProperty('chunks');
      expect(result.artifacts.chunkAnalysis).toHaveProperty('totalTokens');
      expect(result.artifacts.chunkAnalysis).toHaveProperty('persona');
    });

    test('writes chunk-analysis.json to output directory', async () => {
      const input = {
        assetPath: '/path/to/test-video.mp4',
        outputDir: testOutputDir,
        artifacts: {},
        toolVariables: {
          soulPath: '/path/to/SOUL.md',
          goalPath: '/path/to/GOAL.md',
          variables: { lenses: ['patience'] }
        }
      };

      await videoChunksScript.run(input);

      const artifactPath = path.join(testOutputDir, 'chunk-analysis.json');
      expect(fs.existsSync(artifactPath)).toBe(true);

      const data = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
      expect(data).toHaveProperty('chunks');
      expect(data).toHaveProperty('totalTokens');
    });
  });

  describe('chunk structure', () => {
    test('chunk has required fields', async () => {
      const input = {
        assetPath: '/path/to/test-video.mp4',
        outputDir: testOutputDir,
        artifacts: {},
        toolVariables: {
          soulPath: '/path/to/SOUL.md',
          goalPath: '/path/to/GOAL.md',
          variables: { lenses: ['patience'] }
        }
      };

      const result = await videoChunksScript.run(input);
      const chunk = result.artifacts.chunkAnalysis.chunks[0];

      expect(chunk).toHaveProperty('chunkIndex');
      expect(chunk).toHaveProperty('startTime');
      expect(chunk).toHaveProperty('endTime');
      expect(chunk).toHaveProperty('summary');
      expect(chunk).toHaveProperty('emotions');
      expect(chunk).toHaveProperty('tokens');
    });

    test('chunk emotions match configured lenses', async () => {
      const input = {
        assetPath: '/path/to/test-video.mp4',
        outputDir: testOutputDir,
        artifacts: {},
        toolVariables: {
          soulPath: '/path/to/SOUL.md',
          goalPath: '/path/to/GOAL.md',
          variables: { lenses: ['patience', 'boredom'] }
        }
      };

      const result = await videoChunksScript.run(input);
      const chunk = result.artifacts.chunkAnalysis.chunks[0];

      expect(chunk.emotions).toHaveProperty('patience');
      expect(chunk.emotions).toHaveProperty('boredom');
    });

    test('emotion has score and reasoning', async () => {
      const input = {
        assetPath: '/path/to/test-video.mp4',
        outputDir: testOutputDir,
        artifacts: {},
        toolVariables: {
          soulPath: '/path/to/SOUL.md',
          goalPath: '/path/to/GOAL.md',
          variables: { lenses: ['patience'] }
        }
      };

      const result = await videoChunksScript.run(input);
      const chunk = result.artifacts.chunkAnalysis.chunks[0];

      expect(chunk.emotions.patience).toHaveProperty('score');
      expect(chunk.emotions.patience).toHaveProperty('reasoning');
    });
  });

  describe('token counting', () => {
    test('tracks total tokens correctly', async () => {
      const input = {
        assetPath: '/path/to/test-video.mp4',
        outputDir: testOutputDir,
        artifacts: {},
        toolVariables: {
          soulPath: '/path/to/SOUL.md',
          goalPath: '/path/to/GOAL.md',
          variables: { lenses: ['patience'] }
        },
        config: {
          settings: {
            max_chunks: 2
          }
        }
      };

      const result = await videoChunksScript.run(input);

      // Mock returns 250 tokens per chunk (150 input + 100 output)
      // 2 chunks = 500 total tokens
      expect(result.artifacts.chunkAnalysis.totalTokens).toBe(500);
    });
  });
});
