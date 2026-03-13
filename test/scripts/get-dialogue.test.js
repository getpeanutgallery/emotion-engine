const fs = require('fs');
const path = require('path');
const assert = require('node:assert/strict');
const test = require('node:test');
const { EventEmitter } = require('node:events');
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
const completionPrompts = [];
let completeImplementation = async (options) => {
  completionPrompts.push(String(options?.prompt || ''));

  // Stitcher call is text-only.
  if (String(options?.prompt || '').includes('dialogue transcript stitcher')) {
    return {
      content: JSON.stringify({
        cleanedTranscript: 'CLEANED TRANSCRIPT',
        auditTrail: [{ op: 'merge_boundary', chunkIndex: 0, detail: 'test' }],
        debug: { refs: [] }
      }),
      usage: { input: 100, output: 150 }
    };
  }

  // Chunk or whole-file transcription.
  return {
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
      handoffContext: 'Speaker 1 continues...',
      totalDuration: 10.0
    }),
    usage: { input: 100, output: 150 }
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
    if (cmd.includes('ffprobe')) return Buffer.from('10.0');
    return Buffer.from('');
  }
};

mockModule('ai-providers/ai-provider-interface.js', mockAIProvider);
mockModule('child_process', mockChildProcess);

const getDialogueScript = require('../../server/scripts/get-context/get-dialogue.cjs');

function makeDialogueConfig({ adapterName = 'openrouter', model = 'test-dialogue-model', params, retry } = {}) {
  return {
    ai: {
      dialogue: {
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
    }
  };
}

test('Get Dialogue Script', async (t) => {
  const testOutputDir = '/tmp/test-dialogue-output';

  t.beforeEach(() => {
    providerConfigCalls.length = 0;
    completionPrompts.length = 0;
    completeImplementation = async (options) => {
      completionPrompts.push(String(options?.prompt || ''));

      if (String(options?.prompt || '').includes('dialogue transcript stitcher')) {
        return {
          content: JSON.stringify({
            cleanedTranscript: 'CLEANED TRANSCRIPT',
            auditTrail: [{ op: 'merge_boundary', chunkIndex: 0, detail: 'test' }],
            debug: { refs: [] }
          }),
          usage: { input: 100, output: 150 }
        };
      }

      return {
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
          handoffContext: 'Speaker 1 continues...',
          totalDuration: 10.0
        }),
        usage: { input: 100, output: 150 }
      };
    };
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
        config: makeDialogueConfig()
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
        config: makeDialogueConfig()
      };
      const result = await getDialogueScript.run(input);
      ok(Array.isArray(result.artifacts.dialogueData.dialogue_segments));
    });

    tNested.test('writes dialogue-data.json to output directory', async () => {
      const input = {
        assetPath: '/path/to/test-video.mp4',
        outputDir: testOutputDir,
        config: makeDialogueConfig({ adapterName: 'openai' })
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
        config: makeDialogueConfig({ adapterName: 'anthropic' })
      };
      await getDialogueScript.run(input);
      assert.deepEqual(providerConfigCalls, ['anthropic']);
    });

    tNested.test('retries invalid dialogue JSON before succeeding', async () => {
      let callCount = 0;
      completeImplementation = async (options) => {
        callCount += 1;
        completionPrompts.push(String(options?.prompt || ''));

        if (callCount === 1) {
          return {
            content: JSON.stringify({ summary: 'missing required fields' }),
            usage: { input: 10, output: 10 }
          };
        }

        return {
          content: JSON.stringify({
            dialogue_segments: [
              {
                start: 0,
                end: 1,
                speaker: 'Speaker 1',
                text: 'Recovered',
                confidence: 0.9
              }
            ],
            summary: 'Recovered dialogue summary',
            handoffContext: 'Continue',
            totalDuration: 10
          }),
          usage: { input: 11, output: 12 }
        };
      };

      const result = await getDialogueScript.run({
        assetPath: '/path/to/test-video.mp4',
        outputDir: testOutputDir,
        config: makeDialogueConfig({
          retry: { maxAttempts: 2, backoffMs: 0 }
        })
      });

      is(callCount, 2);
      is(result.artifacts.dialogueData.summary, 'Recovered dialogue summary');
    });

    tNested.test('keeps processed dialogue temp files by default', async () => {
      const input = {
        assetPath: '/path/to/test-video.mp4',
        outputDir: testOutputDir,
        config: makeDialogueConfig()
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
          ...makeDialogueConfig(),
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
          ...makeDialogueConfig({ adapterName: 'openai' }),
          debug: { captureRaw: true, keepProcessedIntermediates: false }
        }
      };

      await getDialogueScript.run(input);

      const aiPointerPath = path.join(testOutputDir, 'phase1-gather-context', 'raw', 'ai', 'dialogue-transcription.json');
      const ffmpegRawPath = path.join(testOutputDir, 'phase1-gather-context', 'raw', 'ffmpeg', 'dialogue', 'extract-audio.json');
      const metaSummaryPath = path.join(testOutputDir, 'phase1-gather-context', 'raw', '_meta', 'errors.summary.json');
      const toolVersionsDir = path.join(testOutputDir, 'phase1-gather-context', 'raw', 'tools', '_versions');
      const ffmpegVersionPath = path.join(toolVersionsDir, 'ffmpeg.json');
      const ffprobeVersionPath = path.join(toolVersionsDir, 'ffprobe.json');

      ok(fs.existsSync(aiPointerPath));
      ok(fs.existsSync(ffmpegRawPath));
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
      ok(storedPrompt.includes('Transcribe'));

      ok(completionPrompts.some((prompt) => prompt.includes('LOCAL TOOL LOOP:')));
      ok(completionPrompts.some((prompt) => prompt.includes('validate_dialogue_transcription_json')));

      property(attemptCapture, 'rawResponse');
      property(attemptCapture, 'parsed');
      property(attemptCapture, 'toolLoop');
      is(attemptCapture.toolLoop.toolName, 'validate_dialogue_transcription_json');
      is(attemptCapture.model, 'test-dialogue-model');

      const metaSummary = JSON.parse(fs.readFileSync(metaSummaryPath, 'utf8'));
      is(metaSummary.phase, 'phase1-gather-context');
    });

    tNested.test('chunks + runs required stitcher when Base64 budget is exceeded', async () => {
      completionPrompts.length = 0;

      const input = {
        assetPath: '/path/to/test-video.mp4',
        outputDir: testOutputDir,
        config: {
          ...makeDialogueConfig({ adapterName: 'openrouter' }),
          settings: {
            // Force chunking with a tiny budget.
            audio_base64_max_bytes: 10,
            audio_base64_headroom_ratio: 0.9
          },
          ai: {
            ...makeDialogueConfig({ adapterName: 'openrouter' }).ai,
            dialogue_stitch: {
              targets: [
                { adapter: { name: 'openrouter', model: 'test-stitch-model' } }
              ]
            }
          },
          debug: { captureRaw: true, keepProcessedIntermediates: false }
        }
      };

      const result = await getDialogueScript.run(input);
      ok(Array.isArray(result.artifacts.dialogueData.dialogue_segments));
      ok(result.artifacts.dialogueData.dialogue_segments.length > 0);
      is(result.artifacts.dialogueData.cleanedTranscript, 'CLEANED TRANSCRIPT');

      ok(completionPrompts.some((p) => p.includes('dialogue transcript stitcher')));
      ok(completionPrompts.some((p) => p.includes('validate_dialogue_stitch_json')));

      const stitchDir = path.join(testOutputDir, 'phase1-gather-context', 'raw', 'ai', 'dialogue-stitch');
      ok(fs.existsSync(path.join(stitchDir, 'input.json')));
      ok(fs.existsSync(path.join(stitchDir, 'output.json')));
      ok(fs.existsSync(path.join(stitchDir, 'mechanical-transcript.txt')));
    });
  });

  t.test('input validation', (tNested) => {
    tNested.test('handles missing assetPath gracefully', async () => {
      const input = {
        assetPath: null,
        outputDir: testOutputDir,
        config: makeDialogueConfig()
      };
      await rejects(getDialogueScript.run(input), /path|assetPath|required|type string/i);
    });

    tNested.test('handles missing outputDir gracefully', async () => {
      const input = {
        assetPath: '/path/to/video.mp4',
        outputDir: null,
        config: makeDialogueConfig()
      };
      await rejects(getDialogueScript.run(input), /outputDir|path|required|type string/i);
    });
  });

  t.test('output structure', (tNested) => {
    tNested.test('dialogue segment has required fields', async () => {
      const input = {
        assetPath: '/path/to/test-video.mp4',
        outputDir: testOutputDir,
        config: makeDialogueConfig()
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
        config: makeDialogueConfig()
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
        config: makeDialogueConfig()
      };
      const result = await getDialogueScript.run(input);
      const segment = result.artifacts.dialogueData.dialogue_segments[0];
      ok(segment.confidence >= 0);
      ok(segment.confidence <= 1);
    });
  });
});
