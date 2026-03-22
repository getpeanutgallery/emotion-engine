const fs = require('fs');
const path = require('path');
const assert = require('node:assert/strict');
const test = require('node:test');
const { EventEmitter } = require('node:events');
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
const completionPrompts = [];
const completionOptions = [];
let mockDurationSeconds = 30;
let completeImplementation = async (options) => {
  completionPrompts.push(String(options?.prompt || ''));
  completionOptions.push(options || {});
  return {
    content: JSON.stringify({
      analysis: {
        type: 'music',
        description: 'Test music description',
        mood: 'upbeat',
        intensity: 7
      },
      rollingSummary: 'Test rolling summary'
    }),
    usage: {
      input: 80,
      output: 60
    }
  };
};

const mockAIProvider = {
  getProviderFromConfig: (config) => {
    providerConfigCalls.push(config?.ai?.provider);
    return { complete: completeImplementation };
  },
  loadProvider: (providerName) => {
    providerConfigCalls.push(providerName);
    return { complete: completeImplementation };
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
  spawn: (cmd, args) => {
    const proc = new EventEmitter();
    proc.stderr = new EventEmitter();

    const outputPath = args[args.length - 1];
    try {
      fs.mkdirSync(path.dirname(outputPath), { recursive: true });
      fs.writeFileSync(outputPath, Buffer.from('mock audio chunk'));
    } catch {
      // ignore
    }

    setImmediate(() => proc.emit('close', 0));
    return proc;
  },
  execSync: (cmd) => {
    if (cmd.includes('ffprobe')) {
      return Buffer.from(String(mockDurationSeconds));
    }
    return Buffer.from('');
  }
};

// Apply mocks
mockModule('ai-providers/ai-provider-interface.js', mockAIProvider);
mockModule('child_process', mockChildProcess);

// Require module under test
const getMusicScript = require('../../server/scripts/get-context/get-music.cjs');

function makeMusicConfig({ adapterName = 'openrouter', model = 'test-music-model', params, retry, ffmpegAudio } = {}) {
  return {
    ai: {
      music: {
        ...(retry !== undefined ? { retry } : {}),
        targets: [
          {
            adapter: {
              name: adapterName,
              model,
              ...(params !== undefined ? { params } : {})
            }
          }
        ]
      }
    },
    settings: {
      ffmpeg: {
        audio: ffmpegAudio || {
          loglevel: 'error',
          codec: 'pcm_s16le',
          sample_rate_hz: 16000,
          channels: 1,
          container: 'wav'
        }
      }
    }
  };
}

// Tests
test('Get Music Script', async (t) => {
  const testOutputDir = '/tmp/test-music-output';

  t.beforeEach(() => {
    providerConfigCalls.length = 0;
    completionPrompts.length = 0;
    completionOptions.length = 0;
    mockDurationSeconds = 30;
    completeImplementation = async (options) => {
      completionPrompts.push(String(options?.prompt || ''));
      completionOptions.push(options || {});
      return {
        content: JSON.stringify({
          analysis: {
            type: 'music',
            description: 'Test music description',
            mood: 'upbeat',
            intensity: 7
          },
          rollingSummary: 'Test rolling summary'
        }),
        usage: {
          input: 80,
          output: 60
        }
      };
    };
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
    tNested.test('includes bounded recovery addendum when re-entered by the AI recovery lane', async () => {
      await getMusicScript.run({
        assetPath: '/path/to/test-video.mp4',
        outputDir: testOutputDir,
        recoveryRuntime: {
          repairInstructions: ['Return only the final music analysis JSON.'],
          boundedContextSummary: 'Previous output used the wrong wrapper object.'
        },
        config: makeMusicConfig()
      });
      assert.match(completionPrompts[0], /AI RECOVERY RE-ENTRY:/);
      assert.match(completionPrompts[0], /Return only the final music analysis JSON\./);
    });
    tNested.test('exports run function', () => {
      is(typeof getMusicScript.run, 'function');
    });

    tNested.test('returns correct output structure', async () => {
      const input = {
        assetPath: '/path/to/test-video.mp4',
        outputDir: testOutputDir,
        config: makeMusicConfig()
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
        config: makeMusicConfig()
      };
      const result = await getMusicScript.run(input);
      ok(Array.isArray(result.artifacts.musicData.segments));
    });

    tNested.test('writes music-data.json to output directory', async () => {
      const input = {
        assetPath: '/path/to/test-video.mp4',
        outputDir: testOutputDir,
        config: makeMusicConfig({ adapterName: 'openai' })
      };
      await getMusicScript.run(input);
      const artifactPath = path.join(testOutputDir, 'phase1-gather-context', 'music-data.json');
      ok(fs.existsSync(artifactPath));
      const data = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
      property(data, 'segments');
      property(data, 'summary');
    });

    tNested.test('splits long music analysis into bounded time windows even when transport preflight stays within budget', async () => {
      mockDurationSeconds = 140.042449;

      const result = await getMusicScript.run({
        assetPath: '/path/to/test-video.mp4',
        outputDir: testOutputDir,
        config: makeMusicConfig()
      });

      is(result.artifacts.musicData.segments.length, 5);
      is(result.artifacts.musicData.segments[0].start, 0);
      is(result.artifacts.musicData.segments[0].end, 30);
      is(result.artifacts.musicData.segments[1].start, 30);
      is(result.artifacts.musicData.segments[1].end, 60);
      is(result.artifacts.musicData.segments[4].start, 120);
      is(result.artifacts.musicData.segments[4].end, 140.042449);
      is(completionPrompts.length, 5);
      ok(completionPrompts[0].includes('0.0s to 30.0s'));
      ok(completionPrompts[4].includes('120.0s to 140.0s'));
    });

    tNested.test('selects provider from YAML config.ai.provider', async () => {
      const input = {
        assetPath: '/path/to/test-video.mp4',
        outputDir: testOutputDir,
        config: makeMusicConfig({ adapterName: 'gemini' })
      };
      await getMusicScript.run(input);
      assert.deepEqual(providerConfigCalls, ['gemini']);
    });

    tNested.test('retries invalid music JSON before succeeding', async () => {
      let callCount = 0;
      completeImplementation = async (options) => {
        callCount += 1;
        completionPrompts.push(String(options?.prompt || ''));
        if (callCount === 1) {
          return {
            content: JSON.stringify({ type: 'music' }),
            usage: { input: 5, output: 5 }
          };
        }

        return {
          content: JSON.stringify({
            analysis: {
              type: 'music',
              description: 'Recovered music description',
              mood: 'energetic',
              intensity: 8
            },
            rollingSummary: 'Recovered summary'
          }),
          usage: { input: 6, output: 6 }
        };
      };

      const result = await getMusicScript.run({
        assetPath: '/path/to/test-video.mp4',
        outputDir: testOutputDir,
        config: makeMusicConfig({
          retry: { maxAttempts: 2, backoffMs: 0 }
        })
      });

      is(callCount, 2);
      is(result.artifacts.musicData.segments[0].description, 'Recovered music description');
    });

    tNested.test('keeps processed music temp files by default', async () => {
      const input = {
        assetPath: '/path/to/test-video.mp4',
        outputDir: testOutputDir,
        config: makeMusicConfig()
      };

      await getMusicScript.run(input);

      const processedMusicDir = path.join(testOutputDir, 'assets', 'processed', 'music');
      ok(fs.existsSync(processedMusicDir));
      ok(fs.existsSync(path.join(processedMusicDir, 'audio.wav')));
      ok(fs.existsSync(path.join(processedMusicDir, 'chunks', 'chunk_000.wav')));
    });

    tNested.test('uses configured MP3 extraction bitrate and attachment mime type', async () => {
      await getMusicScript.run({
        assetPath: '/path/to/test-video.mp4',
        outputDir: testOutputDir,
        config: makeMusicConfig({
          ffmpegAudio: {
            loglevel: 'error',
            codec: 'libmp3lame',
            bitrate: '192k',
            sample_rate_hz: 44100,
            channels: 2,
            container: 'mp3'
          }
        })
      });

      const processedMusicDir = path.join(testOutputDir, 'assets', 'processed', 'music');
      ok(fs.existsSync(path.join(processedMusicDir, 'audio.mp3')));
      ok(fs.existsSync(path.join(processedMusicDir, 'chunks', 'chunk_000.mp3')));
      assert.equal(completionOptions[0]?.attachments?.[0]?.mimeType, 'audio/mpeg');
    });

    tNested.test('cleans processed music temp files when debug.keepProcessedIntermediates=false', async () => {
      const input = {
        assetPath: '/path/to/test-video.mp4',
        outputDir: testOutputDir,
        config: {
          ...makeMusicConfig(),
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
          ...makeMusicConfig({ adapterName: 'gemini' }),
          debug: { captureRaw: true, keepProcessedIntermediates: false }
        }
      };

      await getMusicScript.run(input);

      const aiPointerPath = path.join(testOutputDir, 'phase1-gather-context', 'raw', 'ai', 'music-segment-0.json');
      const ffmpegRawPath = path.join(testOutputDir, 'phase1-gather-context', 'raw', 'ffmpeg', 'music', 'extract-audio.json');
      const ffprobeRawPath = path.join(testOutputDir, 'phase1-gather-context', 'raw', 'ffmpeg', 'music', 'ffprobe-audio-duration.json');
      const segmentRawPath = path.join(testOutputDir, 'phase1-gather-context', 'raw', 'ffmpeg', 'music', 'extract-chunk-0.json');
      const metaSummaryPath = path.join(testOutputDir, 'phase1-gather-context', 'raw', '_meta', 'errors.summary.json');
      const toolVersionsDir = path.join(testOutputDir, 'phase1-gather-context', 'raw', 'tools', '_versions');
      const ffmpegVersionPath = path.join(toolVersionsDir, 'ffmpeg.json');
      const ffprobeVersionPath = path.join(toolVersionsDir, 'ffprobe.json');

      ok(fs.existsSync(aiPointerPath));
      ok(fs.existsSync(ffmpegRawPath));
      ok(fs.existsSync(ffprobeRawPath));
      ok(fs.existsSync(segmentRawPath));
      ok(fs.existsSync(metaSummaryPath));
      ok(fs.existsSync(ffmpegVersionPath));
      ok(fs.existsSync(ffprobeVersionPath));

      const pointer = JSON.parse(fs.readFileSync(aiPointerPath, 'utf8'));
      is(pointer.schemaVersion, 2);
      is(pointer.kind, 'pointer');
      is(pointer.latestAttempt, 1);
      property(pointer, 'target');
      property(pointer.target, 'file');

      const attemptCapturePath = path.join(testOutputDir, 'phase1-gather-context', 'raw', 'ai', pointer.target.file);
      ok(fs.existsSync(attemptCapturePath));

      const attemptCapture = JSON.parse(fs.readFileSync(attemptCapturePath, 'utf8'));
      property(attemptCapture, 'promptRef');

      const promptPath = path.join(testOutputDir, attemptCapture.promptRef.file);
      ok(fs.existsSync(promptPath));
      const storedPrompt = JSON.parse(fs.readFileSync(promptPath, 'utf8'));
      is(typeof storedPrompt, 'string');
      ok(storedPrompt.includes('Analyze'));

      ok(completionPrompts.some((prompt) => prompt.includes('LOCAL TOOL LOOP:')));
      ok(completionPrompts.some((prompt) => prompt.includes('validate_music_analysis_json')));

      property(attemptCapture, 'rawResponse');
      property(attemptCapture, 'parsed');
      property(attemptCapture, 'toolLoop');
      is(attemptCapture.toolLoop.toolName, 'validate_music_analysis_json');
      is(attemptCapture.model, 'test-music-model');

      const metaSummary = JSON.parse(fs.readFileSync(metaSummaryPath, 'utf8'));
      is(metaSummary.phase, 'phase1-gather-context');
    });
  });

  t.test('segment structure', (tNested) => {
    tNested.test('segment has required fields', async () => {
      const input = {
        assetPath: '/path/to/test-video.mp4',
        outputDir: testOutputDir,
        config: makeMusicConfig()
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
        config: makeMusicConfig()
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
        config: makeMusicConfig()
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
        config: makeMusicConfig()
      };
      const result = await getMusicScript.run(input);
      is(result.artifacts.musicData.hasMusic, true);
    });
  });
});
