const fs = require('fs');
const path = require('path');
const test = require('node:test');
const { ok, is } = require('../helpers/assertions');

process.env.AI_API_KEY = 'test-api-key';

function mockModule(modulePath, mockExports) {
  const absolutePath = require.resolve(modulePath, { paths: [__dirname] });
  if (require.cache[absolutePath]) delete require.cache[absolutePath];
  require.cache[absolutePath] = {
    exports: mockExports,
    loaded: true,
    id: absolutePath,
    filename: absolutePath
  };
}

const mockCompletion = async (options) => {
  if (String(options?.model || '').includes('dialogue')) {
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
        summary: 'Test dialogue summary'
        // Intentionally omit totalDuration so ffprobe is exercised
      }),
      usage: { input: 100, output: 150 }
    };
  }

  return {
    content: JSON.stringify({
      type: 'music',
      description: 'Test music description',
      mood: 'upbeat',
      intensity: 7
    }),
    usage: { input: 80, output: 60 }
  };
};

const mockAIProvider = {
  getProviderFromConfig: () => ({ complete: mockCompletion }),
  loadProvider: () => ({ complete: mockCompletion }),
  getProviderFromEnv: () => {
    throw new Error('getProviderFromEnv should not be used in phase1 scripts');
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

    if (callback) callback(null, { stdout: 'mock stdout', stderr: '' });
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
const getMusicScript = require('../../server/scripts/get-context/get-music.cjs');

test('Phase1 raw ffmpeg/ffprobe logs are namespaced by script', async (t) => {
  const testOutputDir = '/tmp/test-phase1-ffmpeg-namespacing-output';

  t.beforeEach(() => {
    if (!fs.existsSync(testOutputDir)) fs.mkdirSync(testOutputDir, { recursive: true });
  });

  t.afterEach(() => {
    if (fs.existsSync(testOutputDir)) fs.rmSync(testOutputDir, { recursive: true, force: true });
  });

  await getDialogueScript.run({
    assetPath: '/path/to/test-video.mp4',
    outputDir: testOutputDir,
    config: {
      ai: {
        dialogue: {
          targets: [
            { adapter: { name: 'openai', model: 'test-dialogue-model' } }
          ]
        }
      },
      debug: { captureRaw: true, keepProcessedIntermediates: false }
    }
  });

  await getMusicScript.run({
    assetPath: '/path/to/test-video.mp4',
    outputDir: testOutputDir,
    config: {
      ai: {
        music: {
          targets: [
            { adapter: { name: 'openai', model: 'test-music-model' } }
          ]
        }
      },
      debug: { captureRaw: true, keepProcessedIntermediates: false }
    }
  });

  const baseRawDir = path.join(testOutputDir, 'phase1-gather-context', 'raw');

  const dialogueExtractPath = path.join(baseRawDir, 'ffmpeg', 'dialogue', 'extract-audio.json');
  const dialogueProbePath = path.join(baseRawDir, 'ffmpeg', 'dialogue', 'ffprobe-audio-duration.json');

  const musicExtractPath = path.join(baseRawDir, 'ffmpeg', 'music', 'extract-audio.json');
  const musicProbePath = path.join(baseRawDir, 'ffmpeg', 'music', 'ffprobe-audio-duration.json');
  const musicSegmentPath = path.join(baseRawDir, 'ffmpeg', 'music', 'extract-segment-0.json');

  ok(fs.existsSync(dialogueExtractPath));
  ok(fs.existsSync(dialogueProbePath));
  ok(fs.existsSync(musicExtractPath));
  ok(fs.existsSync(musicProbePath));
  ok(fs.existsSync(musicSegmentPath));

  const legacyExtractPath = path.join(baseRawDir, 'ffmpeg', 'extract-audio.json');
  const legacyProbePath = path.join(baseRawDir, 'ffmpeg', 'ffprobe-audio-duration.json');
  const legacySegmentPath = path.join(baseRawDir, 'ffmpeg', 'extract-segment-0.json');

  is(fs.existsSync(legacyExtractPath), false);
  is(fs.existsSync(legacyProbePath), false);
  is(fs.existsSync(legacySegmentPath), false);

  const toolVersionsDir = path.join(baseRawDir, 'tools', '_versions');
  ok(fs.existsSync(path.join(toolVersionsDir, 'ffmpeg.json')));
  ok(fs.existsSync(path.join(toolVersionsDir, 'ffprobe.json')));
});
