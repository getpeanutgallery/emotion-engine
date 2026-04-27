const fs = require('fs');
const path = require('path');
const assert = require('node:assert/strict');
const test = require('node:test');
const { EventEmitter } = require('node:events');
const { property, ok, is } = require('../helpers/assertions');

process.env.AI_API_KEY = 'test-api-key';

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

const providerConfigCalls = [];
const completionPrompts = [];
const completionOptions = [];
let mockDurationSeconds = 30;
let completeImplementation = async (options) => {
  completionPrompts.push(String(options?.prompt || ''));
  completionOptions.push(options || {});
  return {
    content: JSON.stringify({
      rollingSummary: 'A repeated chant-led hook continues across the cue.',
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
      ],
      qualityNotes: ['Crowd noise lightly masks the final consonant.']
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
    throw new Error('getProviderFromEnv should not be used in get-music-vocals');
  }
};

const mockChildProcess = {
  exec: (cmd, callback) => {
    const match = cmd.match(/-y\s+"([^"]+)"/);
    if (match) {
      const outputPath = match[1];
      fs.mkdirSync(path.dirname(outputPath), { recursive: true });
      fs.writeFileSync(outputPath, Buffer.from('mock audio data'));
    }
    if (callback) callback(null, { stdout: '', stderr: '' });
    return { on: () => {} };
  },
  spawn: (cmd, args) => {
    const proc = new EventEmitter();
    proc.stderr = new EventEmitter();

    const outputPath = args[args.length - 1];
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, Buffer.from('mock audio chunk'));

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

mockModule('ai-providers/ai-provider-interface.js', mockAIProvider);
mockModule('child_process', mockChildProcess);

const getMusicVocalsScript = require('../../server/scripts/get-context/get-music-vocals.cjs');

function makeMusicVocalsConfig({ adapterName = 'openrouter', model = 'test-music-vocals-model', params, retry, ffmpegAudio, phase1Music } = {}) {
  return {
    ai: {
      music_vocals: {
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
          : { mode: 'chunked', analysis_window_seconds: 30 }
      }
    }
  };
}

test('Get Music Vocals Script', async (t) => {
  const testOutputDir = '/tmp/test-music-vocals-output';

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
          rollingSummary: 'A repeated chant-led hook continues across the cue.',
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
          ],
          qualityNotes: ['Crowd noise lightly masks the final consonant.']
        }),
        usage: { input: 80, output: 60 }
      };
    };
    if (fs.existsSync(testOutputDir)) {
      fs.rmSync(testOutputDir, { recursive: true, force: true });
    }
    fs.mkdirSync(testOutputDir, { recursive: true });
  });

  t.afterEach(() => {
    if (fs.existsSync(testOutputDir)) {
      fs.rmSync(testOutputDir, { recursive: true, force: true });
    }
  });

  await t.test('returns the dedicated musicVocalsData artifact and preserves downstream schema', async () => {
    const result = await getMusicVocalsScript.run({
      assetPath: '/path/to/test-video.mp4',
      outputDir: testOutputDir,
      config: makeMusicVocalsConfig()
    });

    is(result.primaryArtifactKey, 'musicVocalsData');
    property(result, 'artifacts');
    property(result.artifacts, 'musicVocalsData');
    property(result.artifacts.musicVocalsData, 'vocal_segments');
    property(result.artifacts.musicVocalsData, 'summary');
    property(result.artifacts.musicVocalsData, 'hasVocals');
    is(result.artifacts.musicVocalsData.hasVocals, true);
    is(result.artifacts.musicVocalsData.vocal_segments[0].text, 'Run it back');
    is(result.artifacts.musicVocalsData.vocal_segments[0].delivery, 'chant');
    ok(!Object.prototype.hasOwnProperty.call(result.artifacts.musicVocalsData.vocal_segments[0], 'start'));
    ok(!Object.prototype.hasOwnProperty.call(result.artifacts.musicVocalsData.vocal_segments[0], 'end'));
  });

  await t.test('writes music-vocals-data.json to the legacy artifact path', async () => {
    await getMusicVocalsScript.run({
      assetPath: '/path/to/test-video.mp4',
      outputDir: testOutputDir,
      config: makeMusicVocalsConfig({ adapterName: 'openai' })
    });

    const artifactPath = path.join(testOutputDir, 'phase1-gather-context', 'music-vocals-data.json');
    ok(fs.existsSync(artifactPath));
    const data = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
    property(data, 'vocal_segments');
    property(data, 'summary');
    is(data.hasVocals, true);
    assert.deepEqual(providerConfigCalls, ['openai']);
  });

  await t.test('includes music-lane context and lexical-vocals rules in chunk prompts', async () => {
    await getMusicVocalsScript.run({
      assetPath: '/path/to/test-video.mp4',
      outputDir: testOutputDir,
      artifacts: {
        musicData: {
          summary: 'The score stays intense and chant-driven.',
          globalArc: {
            dominantMood: 'energetic',
            notableTransitions: [{ start: 12, end: 18, label: 'Crowd chant punches through the drums' }]
          }
        }
      },
      config: makeMusicVocalsConfig()
    });

    ok(completionPrompts[0].includes('Upstream music-lane context:'));
    ok(completionPrompts[0].includes('Music-lane summary: The score stays intense and chant-driven.'));
    ok(completionPrompts[0].includes('Keep spoken narration, spoken dialogue over score, and non-lexical vocalizations out of vocal_segments.'));
    ok(completionPrompts[0].includes('If speech and song overlap, keep only the clearly music-led lexical content in vocal_segments; spoken overlay remains outside this lane.'));
    ok(completionPrompts[0].includes('Include only literal heard words or short partial fragments with discernible lexical content; do not paraphrase or invent missing words.'));
    ok(completionPrompts[0].includes('Prefer short literal fragments over polished wrong lyric variants when the chunk is masked or ambiguous.'));
    ok(completionPrompts[0].includes('Use hybrid only when the same continuous utterance is truly inseparable as both speech-led and music-led; otherwise split adjacent spoken and sung spans and keep only the sung side here.'));
    ok(completionPrompts[0].includes('Preserve vocal segment chronology via array order and index values. Array order/index is the truthful chronology signal for this chunk output.'));
    ok(completionPrompts[0].includes('If timing is uncertain but a lyric-bearing moment is clearly present, still emit the segment in the correct order/index position.'));
    ok(completionPrompts[0].includes('Use rollingSummary, whole-asset context, and any high-confidence recognizedSong match as a checklist so late and brief lyric windows are revisited instead of forgotten.'));
    ok(completionPrompts[0].includes('Treat whole-asset lyric phrases and recognizedSong matches as bounded recall scaffolding only: confirm, shorten, correct, or reject them based on this chunk rather than copying them blindly.'));
    ok(completionPrompts[0].includes('If an expected canonical line is only partly supported in this chunk, emit only the shortest audibly supported fragment instead of a polished full-line rewrite.'));
    ok(completionPrompts[0].includes('Do not promote a weak hook/vibe match into a canonical lyric line just because the likely song identity is known.'));
    ok(completionPrompts[0].includes('Use the whole-asset context as a recall scaffold: confirm, refine, or reject expected lyric-bearing moments for this window based on the actual chunk audio.'));
    ok(completionPrompts[0].includes('Spoken dialogue, narration, radio chatter, or promo VO over music are never lyric evidence.'));
    ok(!completionPrompts[0].includes('"start":'));
    ok(!completionPrompts[0].includes('"end":'));
    ok(!completionPrompts[0].includes('"timeRanges":'));
  });

  await t.test('preserves optional recognizedSong grounding in the music-vocals artifact', async () => {
    completeImplementation = async (options) => {
      completionPrompts.push(String(options?.prompt || ''));
      completionOptions.push(options || {});
      return {
        content: JSON.stringify({
          rollingSummary: 'A repeated lyric refrain dominates the cue.',
          vocalSummary: 'A repeated refrain clearly lands over the heavy guitars.',
          vocal_segments: [
            {
              start: 2,
              end: 5,
              text: 'Master of puppets are pulling the strings!',
              confidence: 0.94,
              performer: 'Metallica lead vocal',
              performer_id: 'voc_001',
              delivery: 'sung'
            }
          ],
          recognizedSong: {
            status: 'recognized',
            confidence: 0.97,
            candidates: [
              {
                title: 'Master of Puppets',
                artist: 'Metallica',
                confidence: 0.97,
                evidence: ['Literal lyric fragments directly match the heard vocal.'],
                matchedLyrics: ['Master of puppets are pulling the strings!'],
                timeRanges: [{ start: 2, end: 5 }]
              }
            ],
            primaryEvidence: 'Literal lyric evidence grounds one specific song.',
            multipleSongsDetected: false
          },
          recognitionNotes: ['Spoken dialogue elsewhere in the trailer was excluded from lyric evidence.'],
          qualityNotes: ['Crowd noise lightly masks the final consonant.']
        }),
        usage: { input: 90, output: 70 }
      };
    };

    const result = await getMusicVocalsScript.run({
      assetPath: '/path/to/test-video.mp4',
      outputDir: testOutputDir,
      config: makeMusicVocalsConfig()
    });

    is(result.artifacts.musicVocalsData.recognizedSong.status, 'recognized');
    is(result.artifacts.musicVocalsData.recognizedSong.candidates[0].title, 'Master of Puppets');
    is(result.artifacts.musicVocalsData.recognitionNotes[0], 'Spoken dialogue elsewhere in the trailer was excluded from lyric evidence.');
    ok(completionPrompts[0].includes('recognizedSong is optional.'));
  });

  await t.test('keeps the strongest earlier chunk-level recognizedSong when a later chunk returns unknown', async () => {
    mockDurationSeconds = 90;
    let chunkCallCount = 0;

    completeImplementation = async (options) => {
      completionPrompts.push(String(options?.prompt || ''));
      completionOptions.push(options || {});
      chunkCallCount += 1;

      if (chunkCallCount === 1) {
        return {
          content: JSON.stringify({
            rollingSummary: 'No lyric-bearing vocals yet.',
            vocalSummary: 'No text-bearing music-led vocals were detected in this chunk.',
            vocal_segments: [],
            recognizedSong: {
              status: 'unknown',
              confidence: 0,
              candidates: [],
              multipleSongsDetected: false
            },
            qualityNotes: ['Intro chunk is instrumental.']
          }),
          usage: { input: 70, output: 40 }
        };
      }

      if (chunkCallCount === 2) {
        return {
          content: JSON.stringify({
            rollingSummary: 'The central hook clearly identifies the song.',
            vocalSummary: 'The hook lands clearly over the guitars in this chunk.',
            vocal_segments: [
              {
                start: 32,
                end: 35,
                text: 'Master, master',
                confidence: 0.93,
                performer: 'Metallica lead vocal',
                performer_id: 'voc_001',
                delivery: 'chant'
              }
            ],
            recognizedSong: {
              status: 'recognized',
              confidence: 0.96,
              candidates: [
                {
                  title: 'Master of Puppets',
                  artist: 'Metallica',
                  confidence: 0.96,
                  evidence: ['Literal hook fragment is clearly audible in this chunk.'],
                  matchedLyrics: ['Master, master'],
                  timeRanges: [{ start: 32, end: 35 }]
                }
              ],
              primaryEvidence: 'A literal hook fragment strongly grounds the song identity.',
              multipleSongsDetected: false
            },
            qualityNotes: ['Hook is prominent and unmasked.']
          }),
          usage: { input: 90, output: 70 }
        };
      }

      return {
        content: JSON.stringify({
          rollingSummary: 'The final chunk is promo VO over the tail of the cue.',
          vocalSummary: 'No text-bearing music-led vocals were detected in this chunk.',
          vocal_segments: [],
          recognizedSong: {
            status: 'unknown',
            confidence: 0,
            candidates: [],
            multipleSongsDetected: false
          },
          qualityNotes: ['The outro is dominated by spoken promo VO.']
        }),
        usage: { input: 70, output: 45 }
      };
    };

    const result = await getMusicVocalsScript.run({
      assetPath: '/path/to/test-video.mp4',
      outputDir: testOutputDir,
      config: makeMusicVocalsConfig({
        phase1Music: {
          mode: 'chunked',
          analysis_window_seconds: 30
        }
      })
    });

    is(chunkCallCount, 3);
    is(result.artifacts.musicVocalsData.analysisMode, 'chunked');
    is(result.artifacts.musicVocalsData.recognizedSong.status, 'recognized');
    is(result.artifacts.musicVocalsData.recognizedSong.candidates[0].title, 'Master of Puppets');
    is(result.artifacts.musicVocalsData.recognizedSong.candidates[0].matchedLyrics[0], 'Master, master');
    is(result.artifacts.musicVocalsData.vocal_segments.length, 1);
    is(result.artifacts.musicVocalsData.vocal_segments[0].text, 'Master, master');
  });

  await t.test('auto mode upgrades lyric-bearing music context to hybrid so chunk refinement backstops whole-asset recall', async () => {
    completeImplementation = async (options) => {
      const prompt = String(options?.prompt || '');
      completionPrompts.push(prompt);
      completionOptions.push(options || {});

      if (prompt.includes('Analyze the complete extracted audio track')) {
        return {
          content: JSON.stringify({
            vocalSummary: 'The hook enters and repeats later in the trailer.',
            vocal_segments: [
              {
                start: 12,
                end: 15,
                text: 'Master, master',
                confidence: 0.9,
                performer: 'Metallica lead vocal',
                performer_id: 'voc_001',
                delivery: 'chant'
              }
            ],
            recognizedSong: {
              status: 'recognized',
              confidence: 0.95,
              candidates: [
                {
                  title: 'Master of Puppets',
                  artist: 'Metallica',
                  confidence: 0.95,
                  evidence: ['Literal hook fragment is clearly audible.'],
                  matchedLyrics: ['Master, master']
                }
              ],
              primaryEvidence: 'A literal hook fragment strongly grounds the song identity.',
              multipleSongsDetected: false
            },
            qualityNotes: ['Whole-asset pass found the early hook but may miss later brief reprises without chunk review.']
          }),
          usage: { input: 120, output: 80 }
        };
      }

      return {
        content: JSON.stringify({
          rollingSummary: 'The chant hook appears and later returns in a brief reprise.',
          vocalSummary: 'The chunk confirms the hook and a later brief return.',
          vocal_segments: [
            {
              start: 2,
              end: 5,
              text: 'Master, master',
              confidence: 0.92,
              performer: 'Metallica lead vocal',
              performer_id: 'voc_001',
              delivery: 'chant'
            },
            {
              start: 18,
              end: 20,
              text: 'Obey your master',
              confidence: 0.88,
              performer: 'Metallica lead vocal',
              performer_id: 'voc_001',
              delivery: 'chant'
            }
          ],
          recognizedSong: {
            status: 'recognized',
            confidence: 0.95,
            candidates: [
              {
                title: 'Master of Puppets',
                artist: 'Metallica',
                confidence: 0.95,
                evidence: ['Chunk-local lyric fragments align with the known refrain.'],
                matchedLyrics: ['Master, master', 'Obey your master']
              }
            ],
            primaryEvidence: 'Chunk-local lyric fragments confirm the refrain.',
            multipleSongsDetected: false
          },
          qualityNotes: ['Chunk refinement preserved a brief later reprise that a single whole-asset pass could under-report.']
        }),
        usage: { input: 120, output: 90 }
      };
    };

    const result = await getMusicVocalsScript.run({
      assetPath: '/path/to/test-video.mp4',
      outputDir: testOutputDir,
      artifacts: {
        musicData: {
          summary: 'Heavy metal song entry with audible lyrics and later chant returns.',
          recognizedSong: {
            status: 'possible',
            confidence: 0.8,
            candidates: [
              {
                title: 'Master of Puppets',
                artist: 'Metallica',
                confidence: 0.8,
                evidence: ['The heard hook suggests one likely song.'],
                matchedLyrics: ['Master, master']
              }
            ],
            primaryEvidence: 'Short lyric fragments suggest one likely song.',
            multipleSongsDetected: false
          },
          globalArc: {
            dominantMood: 'aggressive',
            notableTransitions: [
              { start: 12, end: 20, label: 'song entry with audible lyrics' }
            ]
          }
        }
      },
      config: makeMusicVocalsConfig({
        phase1Music: {
          mode: 'auto',
          analysis_window_seconds: 30,
          max_whole_asset_duration_seconds: 180
        }
      })
    });

    is(result.artifacts.musicVocalsData.analysisMode, 'hybrid');
    is(result.artifacts.musicVocalsData.provenance.autoSelectedHybridForLyricCueCoverage, true);
    is(result.artifacts.musicVocalsData.vocal_segments.length, 2);
    is(completionPrompts.length, 2);
    ok(completionPrompts[0].includes('Analyze the complete extracted audio track'));
    ok(completionPrompts[1].includes('Whole-asset vocals continuity context:'));
    ok(completionPrompts[1].includes('Expected lyric-bearing moments in or touching this chunk:'));
  });

  await t.test('captures raw AI and ffmpeg artifacts with tool-loop parity', async () => {
    await getMusicVocalsScript.run({
      assetPath: '/path/to/test-video.mp4',
      outputDir: testOutputDir,
      config: {
        ...makeMusicVocalsConfig({ adapterName: 'gemini' }),
        debug: { captureRaw: true, keepProcessedIntermediates: false }
      }
    });

    const aiPointerPath = path.join(testOutputDir, 'phase1-gather-context', 'raw', 'ai', 'music-vocals-segment-0.json');
    const ffmpegRawPath = path.join(testOutputDir, 'phase1-gather-context', 'raw', 'ffmpeg', 'music', 'extract-audio.json');
    const ffprobeRawPath = path.join(testOutputDir, 'phase1-gather-context', 'raw', 'ffmpeg', 'music', 'ffprobe-audio-duration.json');
    const segmentRawPath = path.join(testOutputDir, 'phase1-gather-context', 'raw', 'ffmpeg', 'music', 'extract-chunk-0.json');
    const metaSummaryPath = path.join(testOutputDir, 'phase1-gather-context', 'raw', '_meta', 'errors.summary.json');

    ok(fs.existsSync(aiPointerPath));
    ok(fs.existsSync(ffmpegRawPath));
    ok(fs.existsSync(ffprobeRawPath));
    ok(fs.existsSync(segmentRawPath));
    ok(fs.existsSync(metaSummaryPath));

    const pointer = JSON.parse(fs.readFileSync(aiPointerPath, 'utf8'));
    is(pointer.schemaVersion, 2);
    property(pointer, 'target');
    ok(completionPrompts.some((prompt) => prompt.includes('LOCAL TOOL LOOP:')));
    ok(completionPrompts.some((prompt) => prompt.includes('validate_music_vocals_json')));
  });
});
