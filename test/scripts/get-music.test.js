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

function makeMusicConfig({ adapterName = 'openrouter', model = 'test-music-model', params, retry, ffmpegAudio, phase1Music } = {}) {
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
      },
      phase1: {
        music: phase1Music && typeof phase1Music === 'object'
          ? phase1Music
          : { mode: 'chunked' }
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
      property(result.artifacts, 'musicVocalsData');
      property(result.artifacts.musicVocalsData, 'vocal_segments');
      property(result.artifacts.musicVocalsData, 'summary');
      property(result.artifacts.musicVocalsData, 'hasVocals');
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
      const vocalsArtifactPath = path.join(testOutputDir, 'phase1-gather-context', 'music-vocals-data.json');
      ok(fs.existsSync(vocalsArtifactPath));
      const vocalsData = JSON.parse(fs.readFileSync(vocalsArtifactPath, 'utf8'));
      property(vocalsData, 'vocal_segments');
      property(vocalsData, 'summary');
    });

    tNested.test('emits musicVocalsData from music-lane chunk analysis without duplicating the spoken dialogue lane artifact', async () => {
      mockDurationSeconds = 30;
      completeImplementation = async (options) => {
        completionPrompts.push(String(options?.prompt || ''));
        completionOptions.push(options || {});
        return {
          content: JSON.stringify({
            analysis: {
              type: 'music',
              description: 'A chant-driven percussion cue dominates the chunk.',
              mood: 'energetic',
              intensity: 8
            },
            rollingSummary: 'The cue stays chant-led and intense.',
            vocalSummary: 'A repeated chant hook drives the music lane.',
            vocal_segments: [
              {
                start: 2,
                end: 5,
                text: 'Run it back',
                confidence: 0.94,
                performer: 'Crowd',
                performer_id: 'crowd_1',
                delivery: 'chant'
              }
            ]
          }),
          usage: { input: 70, output: 50 }
        };
      };

      const result = await getMusicScript.run({
        assetPath: '/path/to/test-video.mp4',
        outputDir: testOutputDir,
        config: makeMusicConfig({ phase1Music: { mode: 'chunked', analysis_window_seconds: 30 } })
      });

      is(result.artifacts.musicVocalsData.hasVocals, true);
      is(result.artifacts.musicVocalsData.vocal_segments.length, 1);
      is(result.artifacts.musicVocalsData.vocal_segments[0].text, 'Run it back');
      is(result.artifacts.musicVocalsData.vocal_segments[0].delivery, 'chant');
      is(result.artifacts.musicVocalsData.summary, 'A repeated chant hook drives the music lane.');
      is(result.artifacts.musicData.segments.length, 1);
      ok(completionPrompts[0].includes('Include only audible sung/chanted/rapped words with discernible lexical content.'));
      ok(completionPrompts[0].includes('Prefer literal heard words or short partial fragments over paraphrase or invented completions when uncertain.'));
      ok(completionPrompts[0].includes('Break vocal_segments when lyric wording changes, when a refrain repeats after a gap, or when a new vocal phrase is audibly distinct.'));
      ok(completionPrompts[0].includes('Do not merge multiple lyric lines into one summary segment.'));
      ok(completionPrompts[0].includes('Do not leak music summary/description language into vocal_segments text.'));
    });

    tNested.test('defaults music mode to auto and prefers whole-asset analysis when eligible', async () => {
      mockDurationSeconds = 30;
      completeImplementation = async (options) => {
        completionPrompts.push(String(options?.prompt || ''));
        completionOptions.push(options || {});
        return {
          content: JSON.stringify({
            summary: 'Default auto whole-asset summary.',
            hasMusic: true,
            globalArc: {
              dominantMood: 'energetic',
              energyCurve: 'steady_rise',
              notableTransitions: []
            },
            segments: [
              { start: 0, end: 30, type: 'music', description: 'Whole asset lane selected by default auto mode.', mood: 'energetic', intensity: 7 }
            ],
            qualityNotes: []
          }),
          usage: { input: 90, output: 70 }
        };
      };

      const result = await getMusicScript.run({
        assetPath: '/path/to/test-video.mp4',
        outputDir: testOutputDir,
        config: {
          ai: makeMusicConfig().ai,
          settings: makeMusicConfig().settings.ffmpeg ? { ffmpeg: makeMusicConfig().settings.ffmpeg } : {}
        }
      });

      is(result.artifacts.musicData.analysisMode, 'whole_asset');
      is(result.artifacts.musicData.provenance.requestedMode, 'auto');
      is(result.artifacts.musicData.provenance.usedChunking, false);
      ok(completionPrompts[0].includes('Analyze the complete extracted audio track'));
      ok(completionPrompts[0].includes('transcript-like pass for any text-bearing music-led vocals'));
      ok(completionPrompts[0].includes('Keep spoken narration or dialogue over score out of vocal_segments'));
      ok(completionPrompts[0].includes('For music-lane vocals, include only audible sung/chanted/rapped words with discernible lexical content.'));
      ok(completionPrompts[0].includes('Prefer literal heard words or short partial fragments over paraphrase, cleanup, or invented completions when the lyric is unclear.'));
      ok(completionPrompts[0].includes('Do not merge multiple lyric lines into one summary segment.'));
      ok(completionPrompts[0].includes('Do not leak music summary/description language into vocal_segments text.'));
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

    tNested.test('grounds later music-window prompts as extracted local chunks instead of out-of-range absolute files', async () => {
      mockDurationSeconds = 140.042449;
      completeImplementation = async (options) => {
        const prompt = String(options?.prompt || '');
        completionPrompts.push(prompt);
        completionOptions.push(options || {});

        const isLateWindow = prompt.includes('60.0s to 90.0s') || prompt.includes('90.0s to 120.0s');
        const hasGroundingNote = prompt.includes('The attached audio file is already the extracted audio for this exact global window.')
          && prompt.includes('Do NOT claim the requested range exceeds the file duration just because the attached chunk is shorter than the full trailer.');

        if (isLateWindow && !hasGroundingNote) {
          return {
            content: JSON.stringify({
              analysis: {
                type: 'silence',
                description: 'The audio file provided is only 30 seconds long, so there is no audio content in the requested time range.',
                mood: 'neutral',
                intensity: 0
              },
              rollingSummary: 'The requested time range exceeds the file duration.'
            }),
            usage: { input: 80, output: 60 }
          };
        }

        return {
          content: JSON.stringify({
            analysis: {
              type: 'music',
              description: 'Grounded trailer audio for the provided extracted chunk.',
              mood: 'energetic',
              intensity: 8
            },
            rollingSummary: 'The trailer remains intense and music-led.'
          }),
          usage: { input: 80, output: 60 }
        };
      };

      const result = await getMusicScript.run({
        assetPath: '/path/to/test-video.mp4',
        outputDir: testOutputDir,
        config: makeMusicConfig()
      });

      is(result.artifacts.musicData.segments.length, 5);
      ok(completionPrompts[2].includes('The attached audio file is already the extracted audio for this exact global window.'));
      ok(completionPrompts[2].includes('Do NOT claim the requested range exceeds the file duration just because the attached chunk is shorter than the full trailer.'));
      assert.deepEqual(
        result.artifacts.musicData.segments.map((segment) => segment.type),
        ['music', 'music', 'music', 'music', 'music']
      );
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

    tNested.test('supports explicit whole-asset music mode with additive metadata', async () => {
      mockDurationSeconds = 90;
      completeImplementation = async (options) => {
        completionPrompts.push(String(options?.prompt || ''));
        completionOptions.push(options || {});
        return {
          content: JSON.stringify({
            summary: 'Whole-asset music arc rises from ominous pulse into aggressive release.',
            hasMusic: true,
            globalArc: {
              dominantMood: 'energetic',
              energyCurve: 'rising_then_plateau_then_drop',
              notableTransitions: [
                { start: 32, end: 40, label: 'Percussion slams into distorted chorus' }
              ]
            },
            segments: [
              { start: 0, end: 32, type: 'music', description: 'Low ominous pulse under trailer setup.', mood: 'tense', intensity: 5 },
              { start: 32, end: 90, type: 'music', description: 'Aggressive chorus with dense percussion.', mood: 'energetic', intensity: 9 }
            ],
            qualityNotes: ['Whole-pass timing is coarse but preserves the trailer-scale arc.']
          }),
          usage: { input: 120, output: 80 }
        };
      };

      const config = makeMusicConfig();
      config.settings.phase1 = {
        music: {
          mode: 'whole_asset',
          max_whole_asset_duration_seconds: 180
        }
      };

      const result = await getMusicScript.run({
        assetPath: '/path/to/test-video.mp4',
        outputDir: testOutputDir,
        config
      });

      is(completionPrompts.length, 1);
      ok(completionPrompts[0].includes('Analyze the complete extracted audio track'));
      is(result.artifacts.musicData.analysisMode, 'whole_asset');
      is(result.artifacts.musicData.timingMode, 'full_timeline');
      is(result.artifacts.musicData.provenance.usedChunking, false);
      is(result.artifacts.musicData.provenance.wholeAssetSucceeded, true);
      is(result.artifacts.musicData.summary, 'Whole-asset music arc rises from ominous pulse into aggressive release.');
      is(result.artifacts.musicData.segments.length, 2);
      is(result.artifacts.musicData.globalArc.dominantMood, 'energetic');
    });

    tNested.test('supports hybrid music mode by carrying whole-asset context into chunk refinement', async () => {
      mockDurationSeconds = 60;
      completeImplementation = async (options) => {
        const prompt = String(options?.prompt || '');
        completionPrompts.push(prompt);
        completionOptions.push(options || {});

        if (prompt.includes('Analyze the complete extracted audio track')) {
          return {
            content: JSON.stringify({
              summary: 'Trailer-wide music arc climbs from menace into a sustained action sprint.',
              hasMusic: true,
              globalArc: {
                dominantMood: 'tense',
                energyCurve: 'steady_rise',
                notableTransitions: [
                  { start: 28, end: 35, label: 'Beat drop into combat sprint' }
                ]
              },
              segments: [
                { start: 0, end: 28, type: 'music', description: 'Menacing pulse with restrained percussion.', mood: 'tense', intensity: 5 },
                { start: 28, end: 60, type: 'music', description: 'Driving action cue with heavier percussion.', mood: 'energetic', intensity: 8 }
              ],
              qualityNotes: ['Whole-pass arc used to guide chunk refinement.']
            }),
            usage: { input: 100, output: 60 }
          };
        }

        if (prompt.includes('0.0s to 30.0s')) {
          return {
            content: JSON.stringify({
              analysis: {
                type: 'music',
                description: 'Local chunk keeps the restrained menace and pulsing bass.',
                mood: 'tense',
                intensity: 5
              },
              rollingSummary: 'The score starts restrained and threatening.'
            }),
            usage: { input: 40, output: 30 }
          };
        }

        return {
          content: JSON.stringify({
            analysis: {
              type: 'music',
              description: 'Local chunk confirms the heavier sprint-phase percussion.',
              mood: 'energetic',
              intensity: 8
            },
            rollingSummary: 'The score escalates into a sustained action sprint.'
          }),
          usage: { input: 42, output: 31 }
        };
      };

      const config = makeMusicConfig();
      config.settings.phase1 = {
        music: {
          mode: 'hybrid',
          max_whole_asset_duration_seconds: 180,
          analysis_window_seconds: 30
        }
      };

      const result = await getMusicScript.run({
        assetPath: '/path/to/test-video.mp4',
        outputDir: testOutputDir,
        config
      });

      is(completionPrompts.length, 3);
      ok(completionPrompts[1].includes('Whole-asset continuity context:'));
      ok(completionPrompts[1].includes('Whole-asset summary: Trailer-wide music arc climbs from menace into a sustained action sprint.'));
      ok(completionPrompts[1].includes('Use vocal_segments only for text-bearing music-led vocals.'));
      is(result.artifacts.musicData.analysisMode, 'hybrid');
      is(result.artifacts.musicData.summary, 'Trailer-wide music arc climbs from menace into a sustained action sprint.');
      is(result.artifacts.musicData.provenance.usedChunking, true);
      is(result.artifacts.musicData.provenance.chunkCount, 2);
      is(result.artifacts.musicData.provenance.wholeAssetSucceeded, true);
      is(result.artifacts.musicData.segments.length, 2);
      is(result.artifacts.musicData.globalArc.energyCurve, 'steady_rise');
    });

    tNested.test('falls back to chunked mode when whole-asset music is over budget and fallback is enabled', async () => {
      completeImplementation = async (options) => {
        completionPrompts.push(String(options?.prompt || ''));
        completionOptions.push(options || {});
        return {
          content: JSON.stringify({
            analysis: {
              type: 'music',
              description: 'Chunked fallback analysis still finds the musical bed.',
              mood: 'upbeat',
              intensity: 7
            },
            rollingSummary: 'Chunked fallback kept the music lane alive.'
          }),
          usage: { input: 30, output: 20 }
        };
      };

      const config = makeMusicConfig();
      config.settings.audio_base64_max_bytes = 4;
      config.settings.phase1 = {
        music: {
          mode: 'whole_asset',
          fallback_to_chunked: true,
          max_whole_asset_duration_seconds: 180
        }
      };

      const result = await getMusicScript.run({
        assetPath: '/path/to/test-video.mp4',
        outputDir: testOutputDir,
        config
      });

      ok(completionPrompts.every((prompt) => !prompt.includes('Analyze the complete extracted audio track')));
      is(result.artifacts.musicData.analysisMode, 'chunked');
      is(result.artifacts.musicData.provenance.fallbackApplied, true);
      ok(String(result.artifacts.musicData.provenance.fallbackReason).includes('base64 budget'));
      ok(result.artifacts.musicData.qualityNotes.some((note) => note.includes('fell back to chunked mode')));
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
      assert.equal(completionOptions[0]?.attachments?.[0]?.mimeType, 'audio/mp3');
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
