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
const completionOptions = [];
let mockExtractedAudioData = Buffer.from('mock audio data');
let mockExtractedChunkData = Buffer.from('mock audio chunk');
let completeImplementation = async (options) => {
  completionPrompts.push(String(options?.prompt || ''));
  completionOptions.push(options || {});

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
        fs.writeFileSync(outputPath, mockExtractedAudioData);
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
      fs.writeFileSync(outputPath, mockExtractedChunkData);
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

function makeDialogueConfig({ adapterName = 'openrouter', model = 'test-dialogue-model', params, retry, ffmpegAudio } = {}) {
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

test('Get Dialogue Script', async (t) => {
  const testOutputDir = '/tmp/test-dialogue-output';

  t.beforeEach(() => {
    providerConfigCalls.length = 0;
    completionPrompts.length = 0;
    completionOptions.length = 0;
    mockExtractedAudioData = Buffer.from('mock audio data');
    mockExtractedChunkData = Buffer.from('mock audio chunk');
    completeImplementation = async (options) => {
      completionPrompts.push(String(options?.prompt || ''));
      completionOptions.push(options || {});

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
      property(result.artifacts.dialogueData, 'speaker_profiles');
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

    tNested.test('includes bounded recovery addendum when re-entered by the AI recovery lane', async () => {
      const input = {
        assetPath: '/path/to/test-video.mp4',
        outputDir: testOutputDir,
        recoveryRuntime: {
          repairInstructions: ['Return only the final dialogue JSON object.'],
          boundedContextSummary: 'Previous response used markdown fences.'
        },
        config: makeDialogueConfig()
      };
      await getDialogueScript.run(input);
      assert.match(completionPrompts[0], /AI RECOVERY RE-ENTRY:/);
      assert.match(completionPrompts[0], /Return only the final dialogue JSON object\./);
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

    tNested.test('uses configured MP3 extraction bitrate and attachment mime type', async () => {
      await getDialogueScript.run({
        assetPath: '/path/to/test-video.mp4',
        outputDir: testOutputDir,
        config: makeDialogueConfig({
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

      const processedDialogueDir = path.join(testOutputDir, 'assets', 'processed', 'dialogue');
      ok(fs.existsSync(path.join(processedDialogueDir, 'audio.mp3')));
      assert.equal(completionOptions[0]?.attachments?.[0]?.mimeType, 'audio/mpeg');
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
            ...makeDialogueConfig({ adapterName: 'openrouter' }).settings,
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

    tNested.test('clamps whole-file totalDuration and segments to the real source runtime', async () => {
      completeImplementation = async (options) => {
        completionPrompts.push(String(options?.prompt || ''));
        completionOptions.push(options || {});

        return {
          content: JSON.stringify({
            dialogue_segments: [
              {
                start: 8.5,
                end: 12.5,
                speaker: 'Speaker 1',
                speaker_id: 'spk_001',
                text: 'Late line',
                confidence: 0.95
              },
              {
                start: 13,
                end: 14,
                speaker: 'Speaker 1',
                speaker_id: 'spk_001',
                text: 'Impossible overrun',
                confidence: 0.8
              }
            ],
            speaker_profiles: [
              {
                speaker_id: 'spk_001',
                label: 'Speaker 1',
                grounded: {
                  confidence: 0.83,
                  linked_segment_indexes: [0, 1],
                  acoustic_descriptors: [
                    { label: 'calm, measured delivery', confidence: 0.62 }
                  ],
                  acoustic_descriptors_abstained: false
                },
                inferred_traits: {
                  disclaimer: 'Speculative, non-authoritative guesses inferred from audio. Do not treat these traits as factual identity.',
                  traits: [],
                  abstained: true
                }
              }
            ],
            summary: 'Overrun test',
            totalDuration: 220
          }),
          usage: { input: 100, output: 150 }
        };
      };

      const input = {
        assetPath: '/path/to/test-video.mp4',
        outputDir: testOutputDir,
        config: makeDialogueConfig()
      };

      const result = await getDialogueScript.run(input);
      is(result.artifacts.dialogueData.totalDuration, 10);
      assert.deepEqual(result.artifacts.dialogueData.dialogue_segments.map(({ start, end, text }) => ({ start, end, text })), [
        { start: 8.5, end: 10, text: 'Late line' }
      ]);
      assert.deepEqual(result.artifacts.dialogueData.speaker_profiles[0].grounded.linked_segment_indexes, [0]);
      ok(result.artifacts.dialogueData.dialogue_segments.every((segment) => segment.start >= 0 && segment.end <= 10 && segment.end > segment.start));
    });

    tNested.test('drops a tail segment when clamping would leave an implausibly tiny spoken window', async () => {
      completeImplementation = async (options) => {
        completionPrompts.push(String(options?.prompt || ''));
        completionOptions.push(options || {});

        return {
          content: JSON.stringify({
            dialogue_segments: [
              {
                start: 8,
                end: 9.5,
                speaker: 'Speaker 1',
                speaker_id: 'spk_001',
                text: 'Pull it together, man!',
                confidence: 0.95
              },
              {
                start: 10,
                end: 16,
                speaker: 'Speaker 2',
                speaker_id: 'spk_002',
                text: 'So eager to leave, David. Killing a man is a hell of a lot easier than killing the idea.',
                confidence: 0.94
              }
            ],
            speaker_profiles: [
              {
                speaker_id: 'spk_001',
                label: 'Speaker 1',
                grounded: {
                  confidence: 0.83,
                  linked_segment_indexes: [0],
                  acoustic_descriptors: [],
                  acoustic_descriptors_abstained: true
                },
                inferred_traits: {
                  disclaimer: 'Speculative, non-authoritative guesses inferred from audio. Do not treat these traits as factual identity.',
                  traits: [],
                  abstained: true
                }
              },
              {
                speaker_id: 'spk_002',
                label: 'Speaker 2',
                grounded: {
                  confidence: 0.79,
                  linked_segment_indexes: [1],
                  acoustic_descriptors: [],
                  acoustic_descriptors_abstained: true
                },
                inferred_traits: {
                  disclaimer: 'Speculative, non-authoritative guesses inferred from audio. Do not treat these traits as factual identity.',
                  traits: [],
                  abstained: true
                }
              }
            ],
            summary: 'Tail clip test',
            totalDuration: 220
          }),
          usage: { input: 100, output: 150 }
        };
      };

      const result = await getDialogueScript.run({
        assetPath: '/path/to/test-video.mp4',
        outputDir: testOutputDir,
        config: makeDialogueConfig()
      });

      is(result.artifacts.dialogueData.totalDuration, 10);
      assert.deepEqual(result.artifacts.dialogueData.dialogue_segments.map(({ speaker_id, start, end, text }) => ({ speaker_id, start, end, text })), [
        {
          speaker_id: 'spk_001',
          start: 8,
          end: 9.5,
          text: 'Pull it together, man!'
        }
      ]);
      assert.deepEqual(result.artifacts.dialogueData.speaker_profiles.map((profile) => ({
        speaker_id: profile.speaker_id,
        linked_segment_indexes: profile.grounded.linked_segment_indexes
      })), [
        {
          speaker_id: 'spk_001',
          linked_segment_indexes: [0]
        },
        {
          speaker_id: 'spk_002',
          linked_segment_indexes: []
        }
      ]);
    });

    tNested.test('clamps chunk-local overruns before stitching back to source time', async () => {
      completeImplementation = async (options) => {
        completionPrompts.push(String(options?.prompt || ''));
        completionOptions.push(options || {});

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
                start: 3.5,
                end: 7.5,
                speaker: 'Speaker 1',
                text: 'Chunk tail',
                confidence: 0.95
              },
              {
                start: 8,
                end: 9,
                speaker: 'Speaker 2',
                text: 'Chunk impossible overrun',
                confidence: 0.8
              }
            ],
            summary: 'Chunk overrun test',
            handoffContext: 'Continue carefully',
            totalDuration: 220
          }),
          usage: { input: 100, output: 150 }
        };
      };

      mockExtractedAudioData = Buffer.alloc(2000, 1);
      mockExtractedChunkData = Buffer.alloc(1000, 1);

      const input = {
        assetPath: '/path/to/test-video.mp4',
        outputDir: testOutputDir,
        config: {
          ...makeDialogueConfig({ adapterName: 'openrouter' }),
          settings: {
            ...makeDialogueConfig({ adapterName: 'openrouter' }).settings,
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
          }
        }
      };

      const result = await getDialogueScript.run(input);
      is(result.artifacts.dialogueData.totalDuration, 10);
      ok(result.artifacts.dialogueData.dialogue_segments.length >= 1);
      ok(result.artifacts.dialogueData.dialogue_segments.every((segment) => segment.start >= 0 && segment.end <= 10 && segment.end > segment.start));
      ok(result.artifacts.dialogueData.dialogue_segments.every((segment) => segment.text !== 'Chunk impossible overrun'));
      ok(result.artifacts.dialogueData.dialogue_segments.some((segment) => segment.text === 'Chunk tail'));
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
      property(segment, 'speaker_id');
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

    tNested.test('speaker profiles separate grounded linkage from inferred traits', async () => {
      const input = {
        assetPath: '/path/to/test-video.mp4',
        outputDir: testOutputDir,
        config: makeDialogueConfig()
      };
      const result = await getDialogueScript.run(input);
      const profile = result.artifacts.dialogueData.speaker_profiles[0];
      property(profile, 'speaker_id');
      property(profile, 'grounded');
      property(profile.grounded, 'linked_segment_indexes');
      property(profile.grounded, 'acoustic_descriptors');
      property(profile.grounded, 'acoustic_descriptors_abstained');
      property(profile, 'inferred_traits');
      property(profile.inferred_traits, 'traits');
      property(profile.inferred_traits, 'abstained');
      is(profile.grounded.linked_segment_indexes[0], 0);
    });

    tNested.test('transcription prompt instructs grounded vs inferred speaker separation', async () => {
      const input = {
        assetPath: '/path/to/test-video.mp4',
        outputDir: testOutputDir,
        config: makeDialogueConfig()
      };
      await getDialogueScript.run(input);
      ok(completionPrompts[0].includes('speaker_profiles'));
      ok(completionPrompts[0].includes('grounded speaker identity separate from inferred_traits'));
    });
  });
});
