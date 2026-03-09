const test = require('node:test');
const assert = require('node:assert/strict');

const {
  resolveBinaryPath,
  resolveFfmpegPath,
  resolveFfprobePath
} = require('../../server/lib/ffmpeg-path.cjs');

test('ffmpeg-path resolver', async (t) => {
  await t.test('uses static ffmpeg path when binary exists', () => {
    const resolved = resolveFfmpegPath({
      ffmpegStaticPath: '/mock/bin/ffmpeg',
      existsSync: (candidate) => candidate === '/mock/bin/ffmpeg'
    });

    assert.equal(resolved, '/mock/bin/ffmpeg');
  });

  await t.test('falls back to PATH ffmpeg when static binary is missing', () => {
    const resolved = resolveFfmpegPath({
      ffmpegStaticPath: '/missing/static/ffmpeg',
      existsSync: () => false
    });

    assert.equal(resolved, 'ffmpeg');
  });

  await t.test('uses static ffprobe path when binary exists', () => {
    const resolved = resolveFfprobePath({
      ffprobeStaticPath: '/mock/bin/ffprobe',
      existsSync: (candidate) => candidate === '/mock/bin/ffprobe'
    });

    assert.equal(resolved, '/mock/bin/ffprobe');
  });

  await t.test('falls back to PATH ffprobe when static binary is missing', () => {
    const resolved = resolveFfprobePath({
      ffprobeStaticPath: '/missing/static/ffprobe',
      existsSync: () => false
    });

    assert.equal(resolved, 'ffprobe');
  });

  await t.test('resolveBinaryPath handles null/empty static values and falls back', () => {
    assert.equal(resolveBinaryPath(null, 'ffmpeg', () => true), 'ffmpeg');
    assert.equal(resolveBinaryPath('', 'ffprobe', () => true), 'ffprobe');
  });
});
