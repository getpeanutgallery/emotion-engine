const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildAudioExtractArgs,
  buildVideoCompressArgs,
  getAudioMimeType,
  getAudioOutputExtension,
  validateFfmpegSettings
} = require('../../server/lib/ffmpeg-config.cjs');

function makeConfig() {
  return {
    settings: {
      ffmpeg: {
        audio: {
          loglevel: 'error',
          codec: 'pcm_s16le',
          sample_rate_hz: 16000,
          channels: 1,
          container: 'wav'
        },
        video: {
          compress: {
            vcodec: 'libx264',
            preset: 'fast',
            max_width: 1280,
            fps: 24,
            audio_codec: 'aac',
            audio_bitrate: '128k',
            size_headroom_ratio: 0.9
          },
          compress_aggressive: {
            vcodec: 'libx264',
            preset: 'slow',
            fps: 24,
            audio_codec: 'aac',
            audio_bitrate: '96k',
            vf: "scale='min(1280,iw)':-1:force_original_aspect_ratio=decrease",
            maxrate_multiplier: 1.2,
            bufsize_multiplier: 2,
            size_headroom_ratio: 0.95
          }
        }
      }
    }
  };
}

test('ffmpeg-config validates required settings', () => {
  assert.deepEqual(validateFfmpegSettings(makeConfig()), []);

  const invalid = makeConfig();
  delete invalid.settings.ffmpeg.audio;
  const errors = validateFfmpegSettings(invalid);
  assert.ok(errors.some((error) => error.includes('settings.ffmpeg.audio')));
});

test('ffmpeg-config builds audio extraction args from YAML settings', () => {
  const config = makeConfig();
  const args = buildAudioExtractArgs({
    inputPath: '/tmp/input.mp4',
    outputPath: '/tmp/audio.wav',
    config,
    startTime: 5,
    durationSeconds: 7,
    disableVideo: true
  });

  assert.deepEqual(args, [
    '-v', 'error',
    '-i', '/tmp/input.mp4',
    '-vn',
    '-ss', '5',
    '-t', '7',
    '-acodec', 'pcm_s16le',
    '-ar', '16000',
    '-ac', '1',
    '-y',
    '/tmp/audio.wav'
  ]);
  assert.equal(getAudioOutputExtension(config), 'wav');
  assert.equal(getAudioMimeType(config), 'audio/wav');
});

test('ffmpeg-config supports explicit MP3 bitrate controls', () => {
  const config = makeConfig();
  config.settings.ffmpeg.audio = {
    loglevel: 'error',
    codec: 'libmp3lame',
    bitrate: '192k',
    sample_rate_hz: 44100,
    channels: 2,
    container: 'mp3'
  };

  assert.deepEqual(validateFfmpegSettings(config), []);

  const args = buildAudioExtractArgs({
    inputPath: '/tmp/input.mp4',
    outputPath: '/tmp/audio.mp3',
    config,
    disableVideo: true
  });

  assert.deepEqual(args, [
    '-v', 'error',
    '-i', '/tmp/input.mp4',
    '-vn',
    '-acodec', 'libmp3lame',
    '-b:a', '192k',
    '-ar', '44100',
    '-ac', '2',
    '-y',
    '/tmp/audio.mp3'
  ]);
  assert.equal(getAudioOutputExtension(config), 'mp3');
  assert.equal(getAudioMimeType(config), 'audio/mpeg');
});

test('ffmpeg-config requires explicit bitrate for MP3 extraction', () => {
  const config = makeConfig();
  config.settings.ffmpeg.audio = {
    loglevel: 'error',
    codec: 'libmp3lame',
    sample_rate_hz: 44100,
    channels: 2,
    container: 'mp3'
  };

  const errors = validateFfmpegSettings(config);
  assert.ok(errors.some((error) => error.includes('settings.ffmpeg.audio.bitrate')));
});

test('ffmpeg-config builds video compression args from YAML settings', () => {
  const config = makeConfig();
  const standardArgs = buildVideoCompressArgs({
    inputPath: '/tmp/input.mp4',
    outputPath: '/tmp/output.mp4',
    maxSizeBytes: 1000,
    durationSeconds: 2,
    config,
    aggressive: false
  });
  const aggressiveArgs = buildVideoCompressArgs({
    inputPath: '/tmp/input.mp4',
    outputPath: '/tmp/output.mp4',
    maxSizeBytes: 1000,
    durationSeconds: 2,
    config,
    aggressive: true
  });

  assert.ok(standardArgs.includes('-vf'));
  assert.ok(standardArgs.includes('scale=\'min(1280,iw)\':-1:force_original_aspect_ratio=decrease'));
  assert.ok(standardArgs.includes('128k'));
  assert.ok(aggressiveArgs.includes('-maxrate'));
  assert.ok(aggressiveArgs.includes('-bufsize'));
  assert.ok(aggressiveArgs.includes('96k'));
});
