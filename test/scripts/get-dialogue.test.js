/**
 * Unit Tests for Get Dialogue Script
 * 
 * Tests the get-dialogue.cjs script.
 * Uses mock AI provider (no real API calls).
 */

const fs = require('fs');
const path = require('path');
process.env.AI_API_KEY = 'test-api-key';

// Mock AI provider
const mockAIProvider = {
  getProviderFromEnv: () => ({
    complete: async (options) => ({
      content: JSON.stringify({
        dialogue_segments: [
          {
            start: 0.5,
            end: 3.2,
            speaker: 'Speaker 1',
            text: 'Test transcription',
            confidence: 0.95
          }
        ],
        summary: 'Test dialogue summary',
        totalDuration: 10.0
      }),
      usage: {
        input: 100,
        output: 150
      }
    })
  })
};

// Mock modules
jest.mock('ai-providers/ai-provider-interface.js', () => mockAIProvider);

// Mock child_process exec with file creation to simulate ffmpeg output
jest.mock('child_process', () => {
  const fs = require('fs');
  const path = require('path');
  return {
    exec: (cmd, callback) => {
      // If it's an ffmpeg command that writes to a file (-y "output"), create that file
      const match = cmd.match(/-y\s+"([^"]+)"/);
      if (match) {
        const outputPath = match[1];
        try {
          fs.mkdirSync(path.dirname(outputPath), { recursive: true });
          fs.writeFileSync(outputPath, Buffer.from('mock audio data'));
        } catch (e) {
          console.warn('Mock failed to create file:', e.message);
        }
      }
      if (callback) callback(null, { stdout: '', stderr: '' });
      return { on: () => {} };
    },
    execSync: (cmd) => {
      if (cmd.includes('ffprobe')) {
        return Buffer.from('10.0'); // Mock duration
      }
      return Buffer.from('');
    }
  };
});

const getDialogueScript = require('../../server/scripts/get-context/get-dialogue.cjs');

describe('Get Dialogue Script', () => {
  const testOutputDir = '/tmp/test-dialogue-output';

  beforeEach(() => {
    // Create test output directory
    if (!fs.existsSync(testOutputDir)) {
      fs.mkdirSync(testOutputDir, { recursive: true });
    }
  });

  afterEach(() => {
    // Cleanup test output
    if (fs.existsSync(testOutputDir)) {
      fs.rmSync(testOutputDir, { recursive: true, force: true });
    }
  });

  describe('run function', () => {
    test('exports run function', () => {
      expect(typeof getDialogueScript.run).toBe('function');
    });

    test('returns correct output structure', async () => {
      const input = {
        assetPath: '/path/to/test-video.mp4',
        outputDir: testOutputDir,
        config: { ai: { dialogue: { model: 'test-dialogue-model' } } }
      };

      const result = await getDialogueScript.run(input);

      expect(result).toHaveProperty('artifacts');
      expect(result.artifacts).toHaveProperty('dialogueData');
      expect(result.artifacts.dialogueData).toHaveProperty('dialogue_segments');
      expect(result.artifacts.dialogueData).toHaveProperty('summary');
      expect(result.artifacts.dialogueData).toHaveProperty('totalDuration');
    });

    test('dialogue_segments is an array', async () => {
      const input = {
        assetPath: '/path/to/test-video.mp4',
        outputDir: testOutputDir,
        config: { ai: { dialogue: { model: 'test-dialogue-model' } } }
      };

      const result = await getDialogueScript.run(input);

      expect(Array.isArray(result.artifacts.dialogueData.dialogue_segments)).toBe(true);
    });

    test('writes dialogue-data.json to output directory', async () => {
      const input = {
        assetPath: '/path/to/test-video.mp4',
        outputDir: testOutputDir,
        config: { ai: { dialogue: { model: 'test-dialogue-model' } } }
      };

      await getDialogueScript.run(input);

      // The script writes to phase1-gather-context subdirectory
      const artifactPath = path.join(testOutputDir, 'phase1-gather-context', 'dialogue-data.json');
      expect(fs.existsSync(artifactPath)).toBe(true);

      const data = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
      expect(data).toHaveProperty('dialogue_segments');
      expect(data).toHaveProperty('summary');
    });
  });

  describe('input validation', () => {
    test('handles missing assetPath gracefully', async () => {
      const input = {
        assetPath: null,
        outputDir: testOutputDir,
        config: { ai: { dialogue: { model: 'test-dialogue-model' } } }
      };

      // Should throw an error (ffmpeg will fail)
      await expect(getDialogueScript.run(input)).rejects.toThrow();
    });

    test('handles missing outputDir gracefully', async () => {
      const input = {
        assetPath: '/path/to/video.mp4',
        outputDir: null,
        config: { ai: { dialogue: { model: 'test-dialogue-model' } } }
      };

      // Should throw an error
      await expect(getDialogueScript.run(input)).rejects.toThrow();
    });
  });

  describe('output structure', () => {
    test('dialogue segment has required fields', async () => {
      const input = {
        assetPath: '/path/to/test-video.mp4',
        outputDir: testOutputDir,
        config: { ai: { dialogue: { model: 'test-dialogue-model' } } }
      };

      const result = await getDialogueScript.run(input);
      const segment = result.artifacts.dialogueData.dialogue_segments[0];

      expect(segment).toHaveProperty('start');
      expect(segment).toHaveProperty('end');
      expect(segment).toHaveProperty('speaker');
      expect(segment).toHaveProperty('text');
      expect(segment).toHaveProperty('confidence');
    });

    test('segment timestamps are numbers', async () => {
      const input = {
        assetPath: '/path/to/test-video.mp4',
        outputDir: testOutputDir,
        config: { ai: { dialogue: { model: 'test-dialogue-model' } } }
      };

      const result = await getDialogueScript.run(input);
      const segment = result.artifacts.dialogueData.dialogue_segments[0];

      expect(typeof segment.start).toBe('number');
      expect(typeof segment.end).toBe('number');
    });

    test('confidence is between 0 and 1', async () => {
      const input = {
        assetPath: '/path/to/test-video.mp4',
        outputDir: testOutputDir,
        config: { ai: { dialogue: { model: 'test-dialogue-model' } } }
      };

      const result = await getDialogueScript.run(input);
      const segment = result.artifacts.dialogueData.dialogue_segments[0];

      expect(segment.confidence).toBeGreaterThanOrEqual(0);
      expect(segment.confidence).toBeLessThanOrEqual(1);
    });
  });
});
