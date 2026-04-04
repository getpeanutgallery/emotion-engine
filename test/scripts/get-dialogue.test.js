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

    tNested.test('adds additive whole-asset analysis metadata without breaking the dialogue contract', async () => {
      const result = await getDialogueScript.run({
        assetPath: '/path/to/test-video.mp4',
        outputDir: testOutputDir,
        config: makeDialogueConfig()
      });

      is(result.artifacts.dialogueData.analysisMode, 'whole_asset');
      is(result.artifacts.dialogueData.timingMode, 'full_timeline');
      is(result.artifacts.dialogueData.sourceStrategy, 'base64');
      assert.deepEqual(result.artifacts.dialogueData.coverage, {
        start: 0.5,
        end: 3.2,
        duration: 2.7,
        complete: false
      });
      assert.deepEqual(result.artifacts.dialogueData.provenance, {
        transportMode: 'inline',
        usedChunking: false,
        chunkCount: 0,
        fallbackApplied: false
      });
      ok(Array.isArray(result.artifacts.dialogueData.dialogue_segments));
      ok(Array.isArray(result.artifacts.dialogueData.speaker_profiles));
    });

    tNested.test('preserves model-supplied coverage span but truth-checks complete on whole-asset output', async () => {
      completeImplementation = async (options) => {
        const prompt = String(options?.prompt || '');
        completionPrompts.push(prompt);
        completionOptions.push(options || {});

        return {
          content: JSON.stringify({
            dialogue_segments: [
              {
                start: 0.5,
                end: 3.2,
                speaker: 'Speaker 1',
                speaker_id: 'spk_001',
                text: 'Test transcription',
                confidence: 0.95
              }
            ],
            summary: 'Test dialogue summary',
            handoffContext: 'Speaker 1 continues...',
            totalDuration: 10.0,
            coverage: {
              start: 0.5,
              end: 7.5,
              duration: 7,
              complete: true
            }
          }),
          usage: { input: 100, output: 150 }
        };
      };

      const result = await getDialogueScript.run({
        assetPath: '/path/to/test-video.mp4',
        outputDir: testOutputDir,
        config: makeDialogueConfig()
      });

      assert.deepEqual(result.artifacts.dialogueData.coverage, {
        start: 0.5,
        end: 7.5,
        duration: 7,
        complete: false
      });
    });

    tNested.test('keeps shorter model-reported whole-asset duration instead of inflating it to the source runtime', async () => {
      completeImplementation = async (options) => {
        const prompt = String(options?.prompt || '');
        completionPrompts.push(prompt);
        completionOptions.push(options || {});

        return {
          content: JSON.stringify({
            dialogue_segments: [
              {
                start: 0.5,
                end: 3.2,
                speaker: 'Speaker 1',
                speaker_id: 'spk_001',
                text: 'Approximate opening-only transcript',
                confidence: 0.78
              }
            ],
            summary: 'Only the opening dialogue could be grounded.',
            totalDuration: 4.0,
            qualityNotes: ['Transcription estimated from partial evidence; timestamps are approximate.']
          }),
          usage: { input: 100, output: 150 }
        };
      };

      const result = await getDialogueScript.run({
        assetPath: '/path/to/test-video.mp4',
        outputDir: testOutputDir,
        config: makeDialogueConfig()
      });

      is(result.artifacts.dialogueData.totalDuration, 4);
      is(result.artifacts.dialogueData.timingMode, 'full_timeline');
      assert.deepEqual(result.artifacts.dialogueData.coverage, {
        start: 0.5,
        end: 3.2,
        duration: 2.7,
        complete: false
      });
      assert.deepEqual(result.artifacts.dialogueData.qualityNotes, [
        'Transcription estimated from partial evidence; timestamps are approximate.'
      ]);
    });

    tNested.test('hybrid mode preserves whole-asset summary while refining timing through chunked stitching', async () => {
      let chunkCallCount = 0;
      completeImplementation = async (options) => {
        const prompt = String(options?.prompt || '');
        completionPrompts.push(prompt);
        completionOptions.push(options || {});

        if (prompt.includes('dialogue transcript stitcher')) {
          return {
            content: JSON.stringify({
              cleanedTranscript: 'HYBRID CLEANED TRANSCRIPT',
              auditTrail: [{ op: 'merge_boundary', chunkIndex: 0, detail: 'hybrid test' }],
              debug: { refs: [] }
            }),
            usage: { input: 50, output: 60 }
          };
        }

        if (prompt.includes('You are transcribing CHUNK')) {
          chunkCallCount += 1;
          return {
            content: JSON.stringify({
              dialogue_segments: [
                {
                  start: 0.5,
                  end: 1.5,
                  speaker: `Speaker ${chunkCallCount}`,
                  speaker_id: `spk_${String(chunkCallCount).padStart(3, '0')}`,
                  text: `Chunk ${chunkCallCount}`,
                  confidence: 0.95
                }
              ],
              speaker_profiles: [
                {
                  speaker_id: `spk_${String(chunkCallCount).padStart(3, '0')}`,
                  label: `Speaker ${chunkCallCount}`,
                  grounded: {
                    confidence: 0.82,
                    linked_segment_indexes: [0],
                    acoustic_descriptors: []
                  },
                  inferred_traits: { traits: [] }
                }
              ],
              summary: `Chunk ${chunkCallCount}`,
              handoffContext: `Continue chunk ${chunkCallCount}`,
              totalDuration: 4
            }),
            usage: { input: 40, output: 45 }
          };
        }

        return {
          content: JSON.stringify({
            dialogue_segments: [
              {
                start: 0.5,
                end: 8.5,
                speaker: 'Speaker 1',
                speaker_id: 'spk_001',
                text: 'Whole asset narration',
                confidence: 0.93
              }
            ],
            speaker_profiles: [
              {
                speaker_id: 'spk_001',
                label: 'Speaker 1',
                grounded: {
                  confidence: 0.84,
                  linked_segment_indexes: [0],
                  acoustic_descriptors: []
                },
                inferred_traits: { traits: [] }
              }
            ],
            summary: 'Whole-asset summary wins',
            totalDuration: 10
          }),
          usage: { input: 100, output: 120 }
        };
      };

      const result = await getDialogueScript.run({
        assetPath: '/path/to/test-video.mp4',
        outputDir: testOutputDir,
        config: {
          ...makeDialogueConfig({ adapterName: 'openrouter' }),
          settings: {
            ...makeDialogueConfig({ adapterName: 'openrouter' }).settings,
            dialogue_forced_chunk_duration_seconds: 4,
            phase1: {
              dialogue: {
                mode: 'hybrid',
                max_whole_asset_duration_seconds: 15
              }
            }
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
      });

      is(result.artifacts.dialogueData.analysisMode, 'hybrid');
      is(result.artifacts.dialogueData.timingMode, 'chunk_local');
      is(result.artifacts.dialogueData.summary, 'Whole-asset summary wins');
      is(result.artifacts.dialogueData.provenance.usedChunking, true);
      ok(result.artifacts.dialogueData.provenance.chunkCount >= 2);
      ok(Array.isArray(result.artifacts.dialogueData.qualityNotes));
      ok(result.artifacts.dialogueData.qualityNotes[0].includes('Whole-asset summary/context was preserved'));
      ok(completionPrompts.some((prompt) => prompt.includes('You are transcribing CHUNK')));
      ok(completionPrompts.some((prompt) => prompt.includes('dialogue transcript stitcher')));
    });

    tNested.test('falls back to chunked dialogue when whole-asset mode exceeds max_whole_asset_duration_seconds', async () => {
      let chunkCallCount = 0;
      completeImplementation = async (options) => {
        const prompt = String(options?.prompt || '');
        completionPrompts.push(prompt);
        completionOptions.push(options || {});

        if (prompt.includes('dialogue transcript stitcher')) {
          return {
            content: JSON.stringify({
              cleanedTranscript: 'THRESHOLD FALLBACK TRANSCRIPT',
              auditTrail: [{ op: 'merge_boundary', chunkIndex: 0, detail: 'duration threshold fallback test' }],
              debug: { refs: [] }
            }),
            usage: { input: 50, output: 60 }
          };
        }

        if (prompt.includes('You are transcribing CHUNK')) {
          chunkCallCount += 1;
          return {
            content: JSON.stringify({
              dialogue_segments: [
                {
                  start: 0.5,
                  end: 1.5,
                  speaker: `Speaker ${chunkCallCount}`,
                  speaker_id: `spk_${String(chunkCallCount).padStart(3, '0')}`,
                  text: `Chunk ${chunkCallCount}`,
                  confidence: 0.95
                }
              ],
              speaker_profiles: [
                {
                  speaker_id: `spk_${String(chunkCallCount).padStart(3, '0')}`,
                  label: `Speaker ${chunkCallCount}`,
                  grounded: {
                    confidence: 0.82,
                    linked_segment_indexes: [0],
                    acoustic_descriptors: []
                  },
                  inferred_traits: { traits: [] }
                }
              ],
              summary: `Chunk ${chunkCallCount}`,
              handoffContext: `Continue chunk ${chunkCallCount}`,
              totalDuration: 4
            }),
            usage: { input: 40, output: 45 }
          };
        }

        throw new Error('Whole-asset prompt should not run when duration exceeds the configured max whole-asset threshold.');
      };

      const result = await getDialogueScript.run({
        assetPath: '/path/to/test-video.mp4',
        outputDir: testOutputDir,
        config: {
          ...makeDialogueConfig({ adapterName: 'openrouter' }),
          settings: {
            ...makeDialogueConfig({ adapterName: 'openrouter' }).settings,
            dialogue_forced_chunk_duration_seconds: 4,
            phase1: {
              dialogue: {
                mode: 'whole_asset',
                max_whole_asset_duration_seconds: 5,
                fallback_to_chunked: true
              }
            }
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
      });

      is(result.artifacts.dialogueData.analysisMode, 'chunked');
      is(result.artifacts.dialogueData.provenance.fallbackApplied, true);
      is(result.artifacts.dialogueData.provenance.fallbackReason, 'max_whole_asset_duration_exceeded');
      ok(chunkCallCount >= 2);
      ok(completionPrompts.every((prompt) => !prompt.includes('Transcribe the audio in this file.')));
      ok(completionPrompts.some((prompt) => prompt.includes('You are transcribing CHUNK')));
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
      assert.equal(completionOptions[0]?.attachments?.[0]?.mimeType, 'audio/mp3');
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

    tNested.test('persists aiTargets diagnostics into raw capture artifacts on parse-stage failure', async () => {
      completeImplementation = async (options) => {
        completionPrompts.push(String(options?.prompt || ''));
        completionOptions.push(options || {});
        return {
          content: 'not valid json',
          usage: { input: 22, output: 5 }
        };
      };

      await assert.rejects(() => getDialogueScript.run({
        assetPath: '/path/to/test-video.mp4',
        outputDir: testOutputDir,
        config: {
          ...makeDialogueConfig({ adapterName: 'openrouter' }),
          debug: { captureRaw: true, keepProcessedIntermediates: false }
        }
      }), /invalid_output/i);

      const aiPointerPath = path.join(testOutputDir, 'phase1-gather-context', 'raw', 'ai', 'dialogue-transcription.json');
      const pointer = JSON.parse(fs.readFileSync(aiPointerPath, 'utf8'));
      const attemptCapturePath = path.join(testOutputDir, 'phase1-gather-context', 'raw', 'ai', pointer.target.file);
      const attemptCapture = JSON.parse(fs.readFileSync(attemptCapturePath, 'utf8'));

      is(attemptCapture.errorClassification, 'retryable');
      property(attemptCapture, 'aiTargets');
      is(attemptCapture.aiTargets.group, 'parse');
      is(attemptCapture.aiTargets.raw, 'not valid json');
      is(attemptCapture.aiTargets.completion.content, 'not valid json');
      ok(typeof attemptCapture.aiTargets.parseError === 'string' && attemptCapture.aiTargets.parseError.length > 0);
      property(attemptCapture, 'rawResponse');
      is(attemptCapture.rawResponse.content, 'not valid json');
      property(attemptCapture, 'toolLoop');
      ok(Array.isArray(attemptCapture.aiTargets.toolLoop.history));
      ok(attemptCapture.aiTargets.toolLoop.history.length > 0);
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
                  traits: []
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
                  traits: []
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
                  traits: []
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
                speaker_id: 'spk_001',
                text: 'Chunk tail',
                confidence: 0.95
              },
              {
                start: 8,
                end: 9,
                speaker: 'Speaker 2',
                speaker_id: 'spk_002',
                text: 'Chunk impossible overrun',
                confidence: 0.8
              }
            ],
            speaker_profiles: [
              {
                speaker_id: 'spk_001',
                label: 'Speaker 1',
                grounded: {
                  confidence: 0.81,
                  linked_segment_indexes: [0],
                  acoustic_descriptors: [
                    { label: 'steady, resolute delivery', confidence: 0.58 }
                  ]
                },
                inferred_traits: {
                  traits: [
                    {
                      trait: 'accent',
                      value: 'possibly American English',
                      confidence: 0.24,
                      note: 'speculative'
                    }
                  ]
                }
              },
              {
                speaker_id: 'spk_002',
                label: 'Speaker 2',
                grounded: {
                  confidence: 0.72,
                  linked_segment_indexes: [1],
                  acoustic_descriptors: []
                },
                inferred_traits: {
                  traits: []
                }
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
      is(result.artifacts.dialogueData.speaker_profiles[0].grounded.acoustic_descriptors[0].label, 'steady, resolute delivery');
      is(result.artifacts.dialogueData.speaker_profiles[0].inferred_traits.traits[0].trait, 'accent');
      is(Object.hasOwn(result.artifacts.dialogueData.speaker_profiles[0].grounded, 'acoustic_descriptors_abstained'), false);
    });

    tNested.test('merges same-speaker continuation fragments across chunk boundaries into one continuous passage', async () => {
      let chunkCallCount = 0;
      completeImplementation = async (options) => {
        const prompt = String(options?.prompt || '');
        completionPrompts.push(prompt);
        completionOptions.push(options || {});

        if (prompt.includes('dialogue transcript stitcher')) {
          return {
            content: JSON.stringify({
              cleanedTranscript: 'CLEANED TRANSCRIPT',
              auditTrail: [{ op: 'merge_boundary', chunkIndex: 0, detail: 'merged continuation fragments' }],
              debug: { refs: [] }
            }),
            usage: { input: 100, output: 150 }
          };
        }

        chunkCallCount += 1;
        if (chunkCallCount === 1) {
          return {
            content: JSON.stringify({
              dialogue_segments: [
                {
                  start: 1.2,
                  end: 4.95,
                  speaker: 'Speaker 3',
                  speaker_id: 'spk_003',
                  text: 'Raul Menendez ignited global unrest...',
                  confidence: 0.94
                }
              ],
              speaker_profiles: [
                {
                  speaker_id: 'spk_003',
                  label: 'Speaker 3',
                  grounded: {
                    confidence: 0.88,
                    linked_segment_indexes: [0],
                    acoustic_descriptors: [
                      { label: 'older, authoritative public-address male voice', confidence: 0.9 }
                    ]
                  },
                  inferred_traits: {
                    traits: [
                      { trait: 'role', value: 'authority figure', confidence: 0.82, note: null }
                    ]
                  }
                }
              ],
              summary: 'Chunk 1',
              handoffContext: 'Continue chunk 1',
              totalDuration: 4
            }),
            usage: { input: 100, output: 150 }
          };
        }

        return {
          content: JSON.stringify({
            dialogue_segments: [
              {
                start: 0,
                end: 1.3,
                speaker: 'Speaker 3',
                speaker_id: 'spk_003',
                text: 'on an unprecedented scale.',
                confidence: 0.96
              }
            ],
            speaker_profiles: [
              {
                speaker_id: 'spk_003',
                label: 'Speaker 3',
                grounded: {
                  confidence: 0.9,
                  linked_segment_indexes: [0],
                  acoustic_descriptors: [
                    { label: 'older, authoritative public-address male voice', confidence: 0.92 }
                  ]
                },
                inferred_traits: {
                  traits: [
                    { trait: 'role', value: 'authority figure', confidence: 0.84, note: null }
                  ]
                }
              }
            ],
            summary: 'Chunk 2',
            handoffContext: 'Continue chunk 2',
            totalDuration: 4
          }),
          usage: { input: 100, output: 150 }
        };
      };

      mockExtractedAudioData = Buffer.alloc(2000, 1);
      mockExtractedChunkData = Buffer.alloc(1000, 1);

      const result = await getDialogueScript.run({
        assetPath: '/path/to/test-video.mp4',
        outputDir: testOutputDir,
        config: {
          ...makeDialogueConfig({ adapterName: 'openrouter' }),
          settings: {
            ...makeDialogueConfig({ adapterName: 'openrouter' }).settings,
            dialogue_max_whole_file_duration_seconds: 3,
            dialogue_forced_chunk_duration_seconds: 4
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
      });

      assert.deepEqual(result.artifacts.dialogueData.dialogue_segments.map(({ speaker_id, start, end, text }) => ({ speaker_id, start, end, text })), [
        {
          speaker_id: 'spk_003',
          start: 1.2,
          end: 6.3,
          text: 'Raul Menendez ignited global unrest on an unprecedented scale.'
        }
      ]);
      assert.deepEqual(result.artifacts.dialogueData.speaker_profiles.map((profile) => ({
        speaker_id: profile.speaker_id,
        linked_segment_indexes: profile.grounded.linked_segment_indexes
      })), [
        {
          speaker_id: 'spk_003',
          linked_segment_indexes: [0]
        }
      ]);
    });

    tNested.test('reassigns an incomplete leading fragment to the continuation speaker before merging', async () => {
      let chunkCallCount = 0;
      completeImplementation = async (options) => {
        const prompt = String(options?.prompt || '');
        completionPrompts.push(prompt);
        completionOptions.push(options || {});

        if (prompt.includes('dialogue transcript stitcher')) {
          return {
            content: JSON.stringify({
              cleanedTranscript: 'CLEANED TRANSCRIPT',
              auditTrail: [{ op: 'merge_boundary', chunkIndex: 0, detail: 'repaired continuation speaker drift' }],
              debug: { refs: [] }
            }),
            usage: { input: 100, output: 150 }
          };
        }

        chunkCallCount += 1;
        if (chunkCallCount === 1) {
          return {
            content: JSON.stringify({
              dialogue_segments: [
                {
                  start: 1.2,
                  end: 4.95,
                  speaker: 'Speaker 2',
                  speaker_id: 'spk_002',
                  text: 'Raul Menendez ignited global unrest and',
                  confidence: 0.9
                }
              ],
              speaker_profiles: [
                {
                  speaker_id: 'spk_002',
                  label: 'Speaker 2',
                  grounded: {
                    confidence: 0.86,
                    linked_segment_indexes: [0],
                    acoustic_descriptors: [
                      { label: 'deep, gravelly male voice', confidence: 0.88 }
                    ]
                  },
                  inferred_traits: {
                    traits: [
                      { trait: 'tone', value: 'menacing', confidence: 0.8, note: null }
                    ]
                  }
                }
              ],
              summary: 'Chunk 1',
              handoffContext: 'Continue chunk 1',
              totalDuration: 4
            }),
            usage: { input: 100, output: 150 }
          };
        }

        return {
          content: JSON.stringify({
            dialogue_segments: [
              {
                start: 0,
                end: 1.3,
                speaker: 'Speaker 3',
                speaker_id: 'spk_003',
                text: 'on an unprecedented scale.',
                confidence: 0.96
              }
            ],
            speaker_profiles: [
              {
                speaker_id: 'spk_003',
                label: 'Speaker 3',
                grounded: {
                  confidence: 0.9,
                  linked_segment_indexes: [0],
                  acoustic_descriptors: [
                    { label: 'news-anchor style narration', confidence: 0.92 }
                  ]
                },
                inferred_traits: {
                  traits: []
                }
              }
            ],
            summary: 'Chunk 2',
            handoffContext: 'Continue chunk 2',
            totalDuration: 4
          }),
          usage: { input: 100, output: 150 }
        };
      };

      mockExtractedAudioData = Buffer.alloc(2000, 1);
      mockExtractedChunkData = Buffer.alloc(1000, 1);

      const result = await getDialogueScript.run({
        assetPath: '/path/to/test-video.mp4',
        outputDir: testOutputDir,
        config: {
          ...makeDialogueConfig({ adapterName: 'openrouter' }),
          settings: {
            ...makeDialogueConfig({ adapterName: 'openrouter' }).settings,
            dialogue_max_whole_file_duration_seconds: 3,
            dialogue_forced_chunk_duration_seconds: 4
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
      });

      assert.deepEqual(result.artifacts.dialogueData.dialogue_segments.map(({ speaker_id, start, end, text }) => ({ speaker_id, start, end, text })), [
        {
          speaker_id: 'spk_003',
          start: 1.2,
          end: 6.3,
          text: 'Raul Menendez ignited global unrest and on an unprecedented scale.'
        }
      ]);
    });

    tNested.test('forces chunking for long within-budget dialogue to stabilize timing', async () => {
      let chunkCallCount = 0;
      completeImplementation = async (options) => {
        const prompt = String(options?.prompt || '');
        completionPrompts.push(prompt);
        completionOptions.push(options || {});

        if (prompt.includes('dialogue transcript stitcher')) {
          return {
            content: JSON.stringify({
              cleanedTranscript: 'CLEANED TRANSCRIPT',
              auditTrail: [{ op: 'merge_boundary', chunkIndex: 0, detail: 'test' }],
              debug: { refs: [] }
            }),
            usage: { input: 100, output: 150 }
          };
        }

        chunkCallCount += 1;
        return {
          content: JSON.stringify({
            dialogue_segments: [
              {
                start: 0.5,
                end: 1.5,
                speaker: `Speaker ${chunkCallCount}`,
                text: `Chunk ${chunkCallCount}`,
                confidence: 0.95
              }
            ],
            speaker_profiles: [
              {
                speaker_id: `spk_${String(chunkCallCount).padStart(3, '0')}`,
                label: `Speaker ${chunkCallCount}`,
                grounded: {
                  confidence: 0.8,
                  linked_segment_indexes: [0],
                  acoustic_descriptors: [],
                  acoustic_descriptors_abstained: true
                },
                inferred_traits: {
                  traits: [
                    {
                      trait: 'accent',
                      value: 'possibly regional US English',
                      confidence: 0.22,
                      note: 'speculative'
                    }
                  ]
                }
              }
            ],
            summary: `Chunk ${chunkCallCount}`,
            handoffContext: `Continue from chunk ${chunkCallCount}`,
            totalDuration: 10
          }),
          usage: { input: 100, output: 150 }
        };
      };

      const result = await getDialogueScript.run({
        assetPath: '/path/to/test-video.mp4',
        outputDir: testOutputDir,
        config: {
          ...makeDialogueConfig({ adapterName: 'openrouter' }),
          settings: {
            ...makeDialogueConfig({ adapterName: 'openrouter' }).settings,
            dialogue_max_whole_file_duration_seconds: 5,
            dialogue_forced_chunk_duration_seconds: 9
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
      });

      ok(chunkCallCount >= 2);
      ok(completionPrompts.some((prompt) => prompt.includes('You are transcribing CHUNK 0')));
      ok(completionPrompts.some((prompt) => prompt.includes('Opening provenance mode: this chunk is inside the first')));
      ok(completionPrompts.some((prompt) => prompt.includes('Do not compress the whole chunk\'s dialogue into the opening seconds')));
      ok(completionPrompts.some((prompt) => prompt.includes('Speaker registry (reuse speaker_id only for the same acoustic voice):')));
      ok(completionPrompts.some((prompt) => prompt.includes('create a new speaker_id instead of forcing continuity')));
      ok(completionPrompts.some((prompt) => prompt.includes('speaker_id continuity is acoustic, not semantic')));
      ok(completionPrompts.some((prompt) => prompt.includes('Before reusing a prior speaker_id, compare the audible match across vocal timbre, age impression, gender presentation, accent/dialect impression, delivery mode, and recording texture')));
      ok(completionPrompts.some((prompt) => prompt.includes('Do not merge clearly different voices just because the chunk continues the same scene')));
      ok(completionPrompts.some((prompt) => prompt.includes('Default official/public-address/newsreel/expository narration to a distinct speaker_id from villain threats unless the acoustic match is very strong')));
      ok(completionPrompts.some((prompt) => prompt.includes('If delivery shifts from direct character/threat speech into official public-address, newsreel, briefing, or expository narration')));
      ok(completionPrompts.some((prompt) => prompt.includes('In the opening montage, prefer local chunk provenance over storyline continuity')));
      ok(completionPrompts.some((prompt) => prompt.includes('If you create a new official/public-address/newsreel/expository speaker_id, keep the immediately adjacent follow-on official line on that same speaker_id unless strong acoustic evidence indicates another change')));
      ok(completionPrompts.some((prompt) => prompt.includes('If adjacent words are one uninterrupted utterance from the same voice')));
      is(result.artifacts.dialogueData.totalDuration, 10);
      ok(result.artifacts.dialogueData.dialogue_segments.some((segment) => segment.start >= 4));
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
      property(segment, 'index');
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
      is(typeof segment.index, 'number');
      is(segment.index, 0);
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
      property(profile.grounded, 'confidence');
      ok(!Object.hasOwn(profile.grounded, 'acoustic_descriptors_abstained'));
      ok(!Object.hasOwn(profile.grounded, 'confidence_abstained'));
      property(profile, 'inferred_traits');
      property(profile.inferred_traits, 'traits');
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
      ok(completionPrompts[0].includes('inferred_traits must always be present as an object with a traits array'));
      ok(completionPrompts[0].includes('Do not persist acoustic_descriptors_abstained'));
      ok(completionPrompts[0].includes('Do not use grounded.confidence_abstained'));
      ok(completionPrompts[0].includes('speaker_id continuity is acoustic, not semantic'));
      ok(completionPrompts[0].includes('Before reusing a speaker_id, compare the audible match across vocal timbre, age impression, gender presentation, accent/dialect impression, delivery mode, and recording texture'));
      ok(completionPrompts[0].includes('Do not merge clearly different voices just because the scene is continuous'));
      ok(completionPrompts[0].includes('Default official/public-address/newsreel/expository narration to a distinct speaker_id from villain threats unless the acoustic match is very strong'));
      ok(completionPrompts[0].includes('If delivery shifts from direct character/threat speech into official public-address, newsreel, briefing, or expository narration'));
      ok(completionPrompts[0].includes('If you create a new official/public-address/newsreel/expository speaker_id, keep the immediately adjacent follow-on official line on that same speaker_id unless strong acoustic evidence indicates another change'));
      ok(completionPrompts[0].includes('If adjacent words are one uninterrupted utterance from the same voice'));
      ok(completionPrompts[0].includes('A speaker naming a person, character, organization, or title is not evidence that the speaker is that entity'));
      ok(completionPrompts[0].includes('The attached audio runtime was measured locally at 10.00 seconds'));
      ok(completionPrompts[0].includes('Set totalDuration to this full attached runtime rather than estimating from dialogue coverage or the last spoken line'));
      ok(completionPrompts[0].includes('Sparse or non-speech tails, silence, ambience, music-only sections, or intermittent end-of-file vocals do not mean the file ended early'));
      ok(completionPrompts[0].includes('Keep spoken-dialogue coverage honest, but keep totalDuration anchored to the full attached runtime'));
      ok(!completionPrompts[0].includes('Raul Menendez or David'));
      ok(!completionPrompts[0].includes('set abstained=true'));
    });
  });
});
