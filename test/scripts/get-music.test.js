const fs = require('fs');
const path = require('path');
const assert = require('node:assert/strict');
const test = require('node:test');
const { property, ok, is } = require('../helpers/assertions');

process.env.AI_API_KEY = 'test-api-key';

// Mock helper
function mockModule(modulePath, mockExports) {
  const absolutePath = require.resolve(modulePath, { paths: [__dirname] });
  if (require.cache[absolutePath]) {
    delete require.cache[absolutePath];
  }
  require.cache[absolutePath] = {
    exports: mockExports,
    loaded: true,
    id: absolutePath,
    filename: absolutePath
  };
}

// Mock AI provider
const providerConfigCalls = [];
const mockAIProvider = {
  getProviderFromConfig: (config) => {
    providerConfigCalls.push(config?.ai?.provider);
    return {
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
    };
  },
  getProviderFromEnv: () => {
    throw new Error('getProviderFromEnv should not be used in get-music');
  }
};

// Mock child_process
const mockChildProcess = {
  exec: (cmd, callback) => {
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

// Apply mocks
mockModule('ai-providers/ai-provider-interface.js', mockAIProvider);
mockModule('child_process', mockChildProcess);

// Require module under test
const getMusicScript = require('../../server/scripts/get-context/get-music.cjs');

// Tests
test('Get Music Script', async (t) => {
  const testOutputDir = '/tmp/test-music-output';

  t.beforeEach(() => {
    providerConfigCalls.length = 0;
    if (!fs.existsSync(testOutputDir)) {
      fs.mkdirSync(testOutputDir, { recursive: true });
    }
  });

  t.afterEach(() => {
    if (fs.existsSync(testOutputDir)) {
      fs.rmSync(testOutputDir, { recursive: true, force: true });
    }
  });

  t.test('run function', (tNested) => {
    tNested.test('exports run function', () => {
      is(typeof getMusicScript.run, 'function');
    });

    tNested.test('returns correct output structure', async () => {
      const input = {
        assetPath: '/path/to/test-video.mp4',
        outputDir: testOutputDir,
        config: { ai: { music: { model: 'test-music-model' } } }
      };
      const result = await getMusicScript.run(input);
      property(result, 'artifacts');
      property(result.artifacts, 'musicData');
      property(result.artifacts.musicData, 'segments');
      property(result.artifacts.musicData, 'summary');
      property(result.artifacts.musicData, 'hasMusic');
    });

    tNested.test('segments is an array', async () => {
      const input = {
        assetPath: '/path/to/test-video.mp4',
        outputDir: testOutputDir,
        config: { ai: { music: { model: 'test-music-model' } } }
      };
      const result = await getMusicScript.run(input);
      ok(Array.isArray(result.artifacts.musicData.segments));
    });

    tNested.test('writes music-data.json to output directory', async () => {
      const input = {
        assetPath: '/path/to/test-video.mp4',
        outputDir: testOutputDir,
        config: { ai: { provider: 'openai', music: { model: 'test-music-model' } } }
      };
      await getMusicScript.run(input);
      const artifactPath = path.join(testOutputDir, 'phase1-gather-context', 'music-data.json');
      ok(fs.existsSync(artifactPath));
      const data = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
      property(data, 'segments');
      property(data, 'summary');
    });

    tNested.test('selects provider from YAML config.ai.provider', async () => {
      const input = {
        assetPath: '/path/to/test-video.mp4',
        outputDir: testOutputDir,
        config: { ai: { provider: 'gemini', music: { model: 'test-music-model' } } }
      };
      await getMusicScript.run(input);
      assert.deepEqual(providerConfigCalls, ['gemini']);
    });

    tNested.test('keeps processed music temp files by default', async () => {
      const input = {
        assetPath: '/path/to/test-video.mp4',
        outputDir: testOutputDir,
        config: {
          ai: { music: { model: 'test-music-model' } }
        }
      };

      await getMusicScript.run(input);

      const processedMusicDir = path.join(testOutputDir, 'assets', 'processed', 'music');
      ok(fs.existsSync(processedMusicDir));
      ok(fs.existsSync(path.join(processedMusicDir, 'audio.wav')));
      ok(fs.existsSync(path.join(processedMusicDir, 'segment-0.wav')));
    });

    tNested.test('cleans processed music temp files when debug.keepProcessedIntermediates=false', async () => {
      const input = {
        assetPath: '/path/to/test-video.mp4',
        outputDir: testOutputDir,
        config: {
          ai: { music: { model: 'test-music-model' } },
          debug: { keepProcessedIntermediates: false }
        }
      };

      await getMusicScript.run(input);

      const processedMusicDir = path.join(testOutputDir, 'assets', 'processed', 'music');
      ok(!fs.existsSync(processedMusicDir));
    });

    tNested.test('captures AI + ffmpeg raw artifacts when debug.captureRaw=true', async () => {
      const input = {
        assetPath: '/path/to/test-video.mp4',
        outputDir: testOutputDir,
        config: {
          ai: { provider: 'gemini', music: { model: 'test-music-model' } },
          debug: { captureRaw: true, keepProcessedIntermediates: false }
        }
      };

      await getMusicScript.run(input);

      const aiRawPath = path.join(testOutputDir, 'phase1-gather-context', 'raw', 'ai', 'music-segment-0.json');
      const ffmpegRawPath = path.join(testOutputDir, 'phase1-gather-context', 'raw', 'ffmpeg', 'extract-audio.json');

      ok(fs.existsSync(aiRawPath));
      ok(fs.existsSync(ffmpegRawPath));

      const aiRaw = JSON.parse(fs.readFileSync(aiRawPath, 'utf8'));
      property(aiRaw, 'prompt');
      property(aiRaw, 'rawResponse');
      property(aiRaw, 'parsed');
      is(aiRaw.model, 'test-music-model');
    });
  });

  t.test('segment structure', (tNested) => {
    tNested.test('segment has required fields', async () => {
      const input = {
        assetPath: '/path/to/test-video.mp4',
        outputDir: testOutputDir,
        config: { ai: { music: { model: 'test-music-model' } } }
      };
      const result = await getMusicScript.run(input);
      const segment = result.artifacts.musicData.segments[0];
      property(segment, 'start');
      property(segment, 'end');
      property(segment, 'type');
      property(segment, 'description');
    });

    tNested.test('segment timestamps are numbers', async () => {
      const input = {
        assetPath: '/path/to/test-video.mp4',
        outputDir: testOutputDir,
        config: { ai: { music: { model: 'test-music-model' } } }
      };
      const result = await getMusicScript.run(input);
      const segment = result.artifacts.musicData.segments[0];
      is(typeof segment.start, 'number');
      is(typeof segment.end, 'number');
    });

    tNested.test('intensity is a number', async () => {
      const input = {
        assetPath: '/path/to/test-video.mp4',
        outputDir: testOutputDir,
        config: { ai: { music: { model: 'test-music-model' } } }
      };
      const result = await getMusicScript.run(input);
      const segment = result.artifacts.musicData.segments[0];
      is(typeof segment.intensity, 'number');
    });
  });

  t.test('hasMusic detection', (tNested) => {
    tNested.test('sets hasMusic to true when music is detected', async () => {
      const input = {
        assetPath: '/path/to/test-video.mp4',
        outputDir: testOutputDir,
        config: { ai: { music: { model: 'test-music-model' } } }
      };
      const result = await getMusicScript.run(input);
      is(result.artifacts.musicData.hasMusic, true);
    });
  });
});
