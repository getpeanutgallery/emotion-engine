const test = require('node:test');
const assert = require('node:assert/strict');

function loadModuleWithMocks({
  fasterImpl = async () => ({ source: 'faster' }),
  whisperxImpl = async () => ({ source: 'whisperx' })
} = {}) {
  const fasterPath = require.resolve('../../server/lib/faster-whisper-music-vocals-timing.cjs', { paths: [__dirname] });
  const whisperxPath = require.resolve('../../server/lib/whisperx-music-vocals-timing.cjs', { paths: [__dirname] });
  const targetPath = require.resolve('../../server/lib/music-vocals-timestamp-backend.cjs', { paths: [__dirname] });

  delete require.cache[fasterPath];
  delete require.cache[whisperxPath];
  delete require.cache[targetPath];

  require.cache[fasterPath] = {
    id: fasterPath,
    filename: fasterPath,
    loaded: true,
    exports: {
      deriveFasterWhisperMusicVocalsTiming: fasterImpl
    }
  };
  require.cache[whisperxPath] = {
    id: whisperxPath,
    filename: whisperxPath,
    loaded: true,
    exports: {
      deriveWhisperXMusicVocalsTiming: whisperxImpl
    }
  };

  return require('../../server/lib/music-vocals-timestamp-backend.cjs');
}

test('getConfiguredMusicVocalsTimestampBackend defaults to faster_whisper', () => {
  const module = loadModuleWithMocks();
  assert.equal(module.getConfiguredMusicVocalsTimestampBackend({}), 'faster_whisper');
  assert.equal(module.getConfiguredMusicVocalsTimestampBackend({ settings: { phase1: { music_vocals: {} } } }), 'faster_whisper');
});

test('deriveMusicVocalsTiming dispatches to faster-whisper by default', async () => {
  const calls = [];
  const module = loadModuleWithMocks({
    fasterImpl: async (input) => {
      calls.push(input);
      return { source: 'faster' };
    }
  });

  const result = await module.deriveMusicVocalsTiming({ assetPath: '/tmp/a.mp4', config: {} });
  assert.deepEqual(result, { source: 'faster' });
  assert.deepEqual(calls, [{ assetPath: '/tmp/a.mp4', onDebugEvidence: null }]);
});

test('deriveMusicVocalsTiming dispatches to WhisperX when configured', async () => {
  const calls = [];
  const onDebugEvidence = () => {};
  const module = loadModuleWithMocks({
    whisperxImpl: async (input) => {
      calls.push(input);
      return { source: 'whisperx' };
    }
  });

  const result = await module.deriveMusicVocalsTiming({
    assetPath: '/tmp/a.mp4',
    config: { settings: { phase1: { music_vocals: { timestamp_backend: 'whisperx' } } } },
    onDebugEvidence
  });

  assert.deepEqual(result, { source: 'whisperx' });
  assert.deepEqual(calls, [{ assetPath: '/tmp/a.mp4', onDebugEvidence }]);
});

test('deriveMusicVocalsTiming rejects unsupported backends', async () => {
  const module = loadModuleWithMocks();
  await assert.rejects(() => module.deriveMusicVocalsTiming({
    assetPath: '/tmp/a.mp4',
    config: { settings: { phase1: { music_vocals: { timestamp_backend: 'karaoke_magic' } } } }
  }), /Unsupported music-vocals timestamp backend/);
});
