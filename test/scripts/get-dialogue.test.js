const fs = require('fs');
const path = require('path');
const assert = require('node:assert/strict');
const test = require('node:test');
const { property, ok, is, rejects } = require('../helpers/assertions');

process.env.AI_API_KEY = 'test-api-key';

// Mock helper
function mockModule(modulePath, mockExports) {
  const absolutePath = require.resolve(modulePath, { paths: [__dirname] });
  if (require.cache[absolutePath]) delete require.cache[absolutePath];
  require.cache[absolutePath] = { exports: mockExports, loaded: true, id: absolutePath, filename: absolutePath };
}

// Mock AI provider
const providerConfigCalls = [];
const mockAIProvider = {
  getProviderFromConfig: (config) => {
    providerConfigCalls.push(config?.ai?.provider);
    return {
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
        usage: { input: 100, output: 150 }
      })
    };
  },
  getProviderFromEnv: () => {
    throw new Error('getProviderFromEnv should not be used in get-dialogue');
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
    if (cmd.includes('ffprobe')) return Buffer.from('10.0');
    return Buffer.from('');
  }
};

mockModule('ai-providers/ai-provider-interface.js', mockAIProvider);
mockModule('child_process', mockChildProcess);

const getDialogueScript = require('../../server/scripts/get-context/get-dialogue.cjs');

test('Get Dialogue Script', async (t) => {
  const testOutputDir = '/tmp/test-dialogue-output';

  t.beforeEach(() => {
    providerConfigCalls.length = 0;
    if (!fs.existsSync(testOutputDir)) fs.mkdirSync(testOutputDir, { recursive: true });
  });

  t.afterEach(() => {
    if (fs.existsSync(testOutputDir)) fs.rmSync(testOutputDir, { recursive: true, force: true });
  });

  t.test('run function', (tNested) => {
    tNested.test('exports run function', () => {
      is(typeof getDialogueScript.run, 'function');
    });

    tNested.test('returns correct output structure', async () => {
      const input = {
        assetPath: '/path/to/test-video.mp4',
        outputDir: testOutputDir,
        config: { ai: { dialogue: { model: 'test-dialogue-model' } } }
      };
      const result = await getDialogueScript.run(input);
      property(result, 'artifacts');
      property(result.artifacts, 'dialogueData');
      property(result.artifacts.dialogueData, 'dialogue_segments');
      property(result.artifacts.dialogueData, 'summary');
      property(result.artifacts.dialogueData, 'totalDuration');
    });

    tNested.test('dialogue_segments is an array', async () => {
      const input = {
        assetPath: '/path/to/test-video.mp4',
        outputDir: testOutputDir,
        config: { ai: { dialogue: { model: 'test-dialogue-model' } } }
      };
      const result = await getDialogueScript.run(input);
      ok(Array.isArray(result.artifacts.dialogueData.dialogue_segments));
    });

    tNested.test('writes dialogue-data.json to output directory', async () => {
      const input = {
        assetPath: '/path/to/test-video.mp4',
        outputDir: testOutputDir,
        config: { ai: { provider: 'openai', dialogue: { model: 'test-dialogue-model' } } }
      };
      await getDialogueScript.run(input);
      const artifactPath = path.join(testOutputDir, 'phase1-gather-context', 'dialogue-data.json');
      ok(fs.existsSync(artifactPath));
      const data = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
      property(data, 'dialogue_segments');
      property(data, 'summary');
    });

    tNested.test('selects provider from YAML config.ai.provider', async () => {
      const input = {
        assetPath: '/path/to/test-video.mp4',
        outputDir: testOutputDir,
        config: { ai: { provider: 'anthropic', dialogue: { model: 'test-dialogue-model' } } }
      };
      await getDialogueScript.run(input);
      assert.deepEqual(providerConfigCalls, ['anthropic']);
    });

    tNested.test('keeps processed dialogue temp files by default', async () => {
      const input = {
        assetPath: '/path/to/test-video.mp4',
        outputDir: testOutputDir,
        config: {
          ai: { dialogue: { model: 'test-dialogue-model' } }
        }
      };

      await getDialogueScript.run(input);

      const processedDialogueDir = path.join(testOutputDir, 'assets', 'processed', 'dialogue');
      ok(fs.existsSync(processedDialogueDir));
      ok(fs.existsSync(path.join(processedDialogueDir, 'audio.wav')));
    });

    tNested.test('cleans processed dialogue temp files when debug.keepProcessedIntermediates=false', async () => {
      const input = {
        assetPath: '/path/to/test-video.mp4',
        outputDir: testOutputDir,
        config: {
          ai: { dialogue: { model: 'test-dialogue-model' } },
          debug: { keepProcessedIntermediates: false }
        }
      };

      await getDialogueScript.run(input);

      const processedDialogueDir = path.join(testOutputDir, 'assets', 'processed', 'dialogue');
      ok(!fs.existsSync(processedDialogueDir));
    });

    tNested.test('captures AI + ffmpeg raw artifacts when debug.captureRaw=true', async () => {
      const input = {
        assetPath: '/path/to/test-video.mp4',
        outputDir: testOutputDir,
        config: {
          ai: { provider: 'openai', dialogue: { model: 'test-dialogue-model' } },
          debug: { captureRaw: true, keepProcessedIntermediates: false }
        }
      };

      await getDialogueScript.run(input);

      const aiRawPath = path.join(testOutputDir, 'phase1-extract', 'raw', 'ai', 'dialogue-transcription.json');
      const ffmpegRawPath = path.join(testOutputDir, 'phase1-extract', 'raw', 'ffmpeg', 'extract-audio.json');

      ok(fs.existsSync(aiRawPath));
      ok(fs.existsSync(ffmpegRawPath));

      const aiRaw = JSON.parse(fs.readFileSync(aiRawPath, 'utf8'));
      property(aiRaw, 'prompt');
      property(aiRaw, 'rawResponse');
      property(aiRaw, 'parsed');
      is(aiRaw.model, 'test-dialogue-model');
    });
  });

  t.test('input validation', (tNested) => {
    tNested.test('handles missing assetPath gracefully', async () => {
      const input = {
        assetPath: null,
        outputDir: testOutputDir,
        config: { ai: { dialogue: { model: 'test-dialogue-model' } } }
      };
      await rejects(getDialogueScript.run(input), /path|assetPath|required|type string/i);
    });

    tNested.test('handles missing outputDir gracefully', async () => {
      const input = {
        assetPath: '/path/to/video.mp4',
        outputDir: null,
        config: { ai: { dialogue: { model: 'test-dialogue-model' } } }
      };
      await rejects(getDialogueScript.run(input), /outputDir|path|required|type string/i);
    });
  });

  t.test('output structure', (tNested) => {
    tNested.test('dialogue segment has required fields', async () => {
      const input = {
        assetPath: '/path/to/test-video.mp4',
        outputDir: testOutputDir,
        config: { ai: { dialogue: { model: 'test-dialogue-model' } } }
      };
      const result = await getDialogueScript.run(input);
      const segment = result.artifacts.dialogueData.dialogue_segments[0];
      property(segment, 'start');
      property(segment, 'end');
      property(segment, 'speaker');
      property(segment, 'text');
      property(segment, 'confidence');
    });

    tNested.test('segment timestamps are numbers', async () => {
      const input = {
        assetPath: '/path/to/test-video.mp4',
        outputDir: testOutputDir,
        config: { ai: { dialogue: { model: 'test-dialogue-model' } } }
      };
      const result = await getDialogueScript.run(input);
      const segment = result.artifacts.dialogueData.dialogue_segments[0];
      is(typeof segment.start, 'number');
      is(typeof segment.end, 'number');
    });

    tNested.test('confidence is between 0 and 1', async () => {
      const input = {
        assetPath: '/path/to/test-video.mp4',
        outputDir: testOutputDir,
        config: { ai: { dialogue: { model: 'test-dialogue-model' } } }
      };
      const result = await getDialogueScript.run(input);
      const segment = result.artifacts.dialogueData.dialogue_segments[0];
      ok(segment.confidence >= 0);
      ok(segment.confidence <= 1);
    });
  });
});
