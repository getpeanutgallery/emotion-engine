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
    ok(completionPrompts[0].includes('Include only literal heard words or short partial fragments with discernible lexical content; do not paraphrase or invent missing words.'));
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
