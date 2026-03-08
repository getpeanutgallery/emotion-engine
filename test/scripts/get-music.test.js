/**
 * Unit Tests for Get Music Script
 * 
 * Tests the get-music.cjs script.
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
        type: 'music',
        description: 'Test music description',
        mood: 'upbeat',
        intensity: 7
      }),
      usage: {
        input: 80,
        output: 60
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
        return Buffer.from('30.0'); // Mock duration
      }
      return Buffer.from('');
    }
  };
});

const getMusicScript = require('../../server/scripts/get-context/get-music.cjs');

describe('Get Music Script', () => {
  const testOutputDir = '/tmp/test-music-output';

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
      expect(typeof getMusicScript.run).toBe('function');
    });

    test('returns correct output structure', async () => {
      const input = {
        assetPath: '/path/to/test-video.mp4',
        outputDir: testOutputDir,
        config: { ai: { music: { model: 'test-music-model' } } }
      };

      const result = await getMusicScript.run(input);

      expect(result).toHaveProperty('artifacts');
      expect(result.artifacts).toHaveProperty('musicData');
      expect(result.artifacts.musicData).toHaveProperty('segments');
      expect(result.artifacts.musicData).toHaveProperty('summary');
      expect(result.artifacts.musicData).toHaveProperty('hasMusic');
    });

    test('segments is an array', async () => {
      const input = {
        assetPath: '/path/to/test-video.mp4',
        outputDir: testOutputDir,
        config: { ai: { music: { model: 'test-music-model' } } }
      };

      const result = await getMusicScript.run(input);

      expect(Array.isArray(result.artifacts.musicData.segments)).toBe(true);
    });

    test('writes music-data.json to output directory', async () => {
      const input = {
        assetPath: '/path/to/test-video.mp4',
        outputDir: testOutputDir,
        config: { ai: { music: { model: 'test-music-model' } } }
      };

      await getMusicScript.run(input);

      // The script writes to phase1-gather-context subdirectory
      const artifactPath = path.join(testOutputDir, 'phase1-gather-context', 'music-data.json');
      expect(fs.existsSync(artifactPath)).toBe(true);

      const data = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
      expect(data).toHaveProperty('segments');
      expect(data).toHaveProperty('summary');
    });
  });

  describe('segment structure', () => {
    test('segment has required fields', async () => {
      const input = {
        assetPath: '/path/to/test-video.mp4',
        outputDir: testOutputDir,
        config: { ai: { music: { model: 'test-music-model' } } }
      };

      const result = await getMusicScript.run(input);
      const segment = result.artifacts.musicData.segments[0];

      expect(segment).toHaveProperty('start');
      expect(segment).toHaveProperty('end');
      expect(segment).toHaveProperty('type');
      expect(segment).toHaveProperty('description');
    });

    test('segment timestamps are numbers', async () => {
      const input = {
        assetPath: '/path/to/test-video.mp4',
        outputDir: testOutputDir,
        config: { ai: { music: { model: 'test-music-model' } } }
      };

      const result = await getMusicScript.run(input);
      const segment = result.artifacts.musicData.segments[0];

      expect(typeof segment.start).toBe('number');
      expect(typeof segment.end).toBe('number');
    });

    test('intensity is a number', async () => {
      const input = {
        assetPath: '/path/to/test-video.mp4',
        outputDir: testOutputDir,
        config: { ai: { music: { model: 'test-music-model' } } }
      };

      const result = await getMusicScript.run(input);
      const segment = result.artifacts.musicData.segments[0];

      expect(typeof segment.intensity).toBe('number');
    });
  });

  describe('hasMusic detection', () => {
    test('sets hasMusic to true when music is detected', async () => {
      const input = {
        assetPath: '/path/to/test-video.mp4',
        outputDir: testOutputDir,
        config: { ai: { music: { model: 'test-music-model' } } }
      };

      const result = await getMusicScript.run(input);

      // Mock returns type: 'music', so hasMusic should be true
      expect(result.artifacts.musicData.hasMusic).toBe(true);
    });
  });
});
