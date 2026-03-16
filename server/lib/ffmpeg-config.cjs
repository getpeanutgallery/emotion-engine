#!/usr/bin/env node

'use strict';

const AUDIO_REQUIRED_STRING_FIELDS = ['loglevel', 'codec', 'container'];
const AUDIO_REQUIRED_INTEGER_FIELDS = ['sample_rate_hz', 'channels'];
const VIDEO_COMPRESS_REQUIRED_STRING_FIELDS = ['vcodec', 'preset', 'audio_codec', 'audio_bitrate'];
const VIDEO_COMPRESS_REQUIRED_INTEGER_FIELDS = ['max_width', 'fps'];
const VIDEO_COMPRESS_REQUIRED_NUMBER_FIELDS = ['size_headroom_ratio'];
const VIDEO_AGGRESSIVE_REQUIRED_STRING_FIELDS = ['vcodec', 'preset', 'audio_codec', 'audio_bitrate', 'vf'];
const VIDEO_AGGRESSIVE_REQUIRED_INTEGER_FIELDS = ['fps'];
const VIDEO_AGGRESSIVE_REQUIRED_NUMBER_FIELDS = ['maxrate_multiplier', 'bufsize_multiplier', 'size_headroom_ratio'];
const BITRATE_PATTERN = /^\d+k$/;
const AUDIO_MIME_TYPES = {
  wav: 'audio/wav',
  mp3: 'audio/mpeg',
  m4a: 'audio/mp4',
  mp4: 'audio/mp4',
  ogg: 'audio/ogg',
  flac: 'audio/flac'
};

function getFfmpegSettings(config) {
  return config?.settings?.ffmpeg;
}

function getRequiredFfmpegSettings(config) {
  const ffmpeg = getFfmpegSettings(config);
  if (!ffmpeg || typeof ffmpeg !== 'object' || Array.isArray(ffmpeg)) {
    throw new Error('Missing required "settings.ffmpeg" configuration');
  }
  return ffmpeg;
}

function getRequiredAudioConfig(config) {
  const audio = getRequiredFfmpegSettings(config)?.audio;
  if (!audio || typeof audio !== 'object' || Array.isArray(audio)) {
    throw new Error('Missing required "settings.ffmpeg.audio" configuration');
  }
  return audio;
}

function getRequiredVideoConfig(config) {
  const video = getRequiredFfmpegSettings(config)?.video;
  if (!video || typeof video !== 'object' || Array.isArray(video)) {
    throw new Error('Missing required "settings.ffmpeg.video" configuration');
  }
  return video;
}

function getAudioOutputExtension(configOrAudioConfig) {
  const container = configOrAudioConfig?.container || getRequiredAudioConfig(configOrAudioConfig).container;
  return String(container).replace(/^\./, '').toLowerCase();
}

function getAudioMimeType(configOrAudioConfig) {
  const extension = getAudioOutputExtension(configOrAudioConfig);
  return AUDIO_MIME_TYPES[extension] || `audio/${extension}`;
}

function requiresExplicitAudioBitrate(audio) {
  const codec = String(audio?.codec || '').toLowerCase();
  const container = String(audio?.container || '').replace(/^\./, '').toLowerCase();
  return codec === 'libmp3lame' || container === 'mp3';
}

function quoteShellArg(value) {
  const text = String(value);
  if (/^[A-Za-z0-9_./:=+-]+$/.test(text)) {
    return text;
  }
  return `'${text.replace(/'/g, `'\\''`)}'`;
}

function formatCommand(binary, args = []) {
  return [binary, ...args].map(quoteShellArg).join(' ');
}

function buildAudioExtractArgs({ inputPath, outputPath, config, ffmpegAudioConfig, startTime, durationSeconds, disableVideo = false }) {
  const audio = ffmpegAudioConfig || getRequiredAudioConfig(config);
  const args = [
    '-v', String(audio.loglevel),
    '-i', inputPath
  ];

  if (disableVideo) {
    args.push('-vn');
  }

  if (startTime !== undefined) {
    args.push('-ss', String(startTime));
  }

  if (durationSeconds !== undefined) {
    args.push('-t', String(durationSeconds));
  }

  args.push(
    '-acodec', String(audio.codec)
  );

  if (typeof audio.bitrate === 'string' && audio.bitrate.trim().length > 0) {
    args.push('-b:a', String(audio.bitrate));
  }

  args.push(
    '-ar', String(audio.sample_rate_hz),
    '-ac', String(audio.channels),
    '-y',
    outputPath
  );

  return args;
}

function buildVideoCompressArgs({ inputPath, outputPath, maxSizeBytes, durationSeconds, config, ffmpegVideoConfig, aggressive = false }) {
  const video = ffmpegVideoConfig || getRequiredVideoConfig(config);
  const profile = aggressive ? video.compress_aggressive : video.compress;
  const targetSizeBytes = maxSizeBytes * Number(profile.size_headroom_ratio);
  const targetBitrateKbps = Math.max(1, Math.floor((targetSizeBytes * 8) / durationSeconds));

  const args = [
    '-i', inputPath,
    '-c:v', String(profile.vcodec),
    '-preset', String(profile.preset)
  ];

  if (aggressive) {
    args.push(
      '-vf', String(profile.vf),
      '-r', String(profile.fps),
      '-b:v', `${targetBitrateKbps}k`,
      '-maxrate', `${Math.max(1, Math.floor(targetBitrateKbps * Number(profile.maxrate_multiplier)))}k`,
      '-bufsize', `${Math.max(1, Math.floor(targetBitrateKbps * Number(profile.bufsize_multiplier)))}k`
    );
  } else {
    args.push(
      '-vf', `scale='min(${profile.max_width},iw)':-1:force_original_aspect_ratio=decrease`,
      '-r', String(profile.fps),
      '-b:v', `${targetBitrateKbps}k`
    );
  }

  args.push(
    '-c:a', String(profile.audio_codec),
    '-b:a', String(profile.audio_bitrate),
    '-y',
    outputPath
  );

  return args;
}

function validateFfmpegSettings(config) {
  const errors = [];
  const ffmpeg = getFfmpegSettings(config);

  if (!ffmpeg || typeof ffmpeg !== 'object' || Array.isArray(ffmpeg)) {
    errors.push('Missing required "settings.ffmpeg" configuration');
    return errors;
  }

  validateAudioConfig(ffmpeg.audio, errors);
  validateVideoConfig(ffmpeg.video, errors);
  return errors;
}

function validateAudioConfig(audio, errors) {
  if (!audio || typeof audio !== 'object' || Array.isArray(audio)) {
    errors.push('Missing required "settings.ffmpeg.audio" configuration');
    return;
  }

  for (const field of AUDIO_REQUIRED_STRING_FIELDS) {
    if (typeof audio[field] !== 'string' || audio[field].trim().length === 0) {
      errors.push(`Missing required "settings.ffmpeg.audio.${field}" (must be a non-empty string)`);
    }
  }

  if (!Number.isInteger(audio.sample_rate_hz) || audio.sample_rate_hz <= 0) {
    errors.push('"settings.ffmpeg.audio.sample_rate_hz" must be an integer > 0');
  }

  if (!Number.isInteger(audio.channels) || audio.channels < 1) {
    errors.push('"settings.ffmpeg.audio.channels" must be an integer >= 1');
  }

  if (audio.bitrate !== undefined && !BITRATE_PATTERN.test(String(audio.bitrate || ''))) {
    errors.push('"settings.ffmpeg.audio.bitrate" must match /^\\d+k$/');
  }

  if (requiresExplicitAudioBitrate(audio) && !BITRATE_PATTERN.test(String(audio.bitrate || ''))) {
    errors.push('"settings.ffmpeg.audio.bitrate" is required for MP3 extraction and must match /^\\d+k$/');
  }
}

function validateVideoConfig(video, errors) {
  if (!video || typeof video !== 'object' || Array.isArray(video)) {
    errors.push('Missing required "settings.ffmpeg.video" configuration');
    return;
  }

  validateVideoCompressProfile(video.compress, errors, 'settings.ffmpeg.video.compress');
  validateVideoAggressiveProfile(video.compress_aggressive, errors, 'settings.ffmpeg.video.compress_aggressive');
}

function validateVideoCompressProfile(profile, errors, prefix) {
  if (!profile || typeof profile !== 'object' || Array.isArray(profile)) {
    errors.push(`Missing required "${prefix}" configuration`);
    return;
  }

  for (const field of VIDEO_COMPRESS_REQUIRED_STRING_FIELDS) {
    if (typeof profile[field] !== 'string' || profile[field].trim().length === 0) {
      errors.push(`Missing required "${prefix}.${field}" (must be a non-empty string)`);
    }
  }

  if (!BITRATE_PATTERN.test(String(profile.audio_bitrate || ''))) {
    errors.push(`"${prefix}.audio_bitrate" must match /^\\d+k$/`);
  }

  if (!Number.isInteger(profile.max_width) || profile.max_width <= 0) {
    errors.push(`"${prefix}.max_width" must be an integer > 0`);
  }

  if (!Number.isInteger(profile.fps) || profile.fps <= 0) {
    errors.push(`"${prefix}.fps" must be an integer > 0`);
  }

  if (typeof profile.size_headroom_ratio !== 'number' || !Number.isFinite(profile.size_headroom_ratio) || profile.size_headroom_ratio <= 0) {
    errors.push(`"${prefix}.size_headroom_ratio" must be a number > 0`);
  }
}

function validateVideoAggressiveProfile(profile, errors, prefix) {
  if (!profile || typeof profile !== 'object' || Array.isArray(profile)) {
    errors.push(`Missing required "${prefix}" configuration`);
    return;
  }

  for (const field of VIDEO_AGGRESSIVE_REQUIRED_STRING_FIELDS) {
    if (typeof profile[field] !== 'string' || profile[field].trim().length === 0) {
      errors.push(`Missing required "${prefix}.${field}" (must be a non-empty string)`);
    }
  }

  if (!BITRATE_PATTERN.test(String(profile.audio_bitrate || ''))) {
    errors.push(`"${prefix}.audio_bitrate" must match /^\\d+k$/`);
  }

  if (!Number.isInteger(profile.fps) || profile.fps <= 0) {
    errors.push(`"${prefix}.fps" must be an integer > 0`);
  }

  for (const field of VIDEO_AGGRESSIVE_REQUIRED_NUMBER_FIELDS) {
    if (typeof profile[field] !== 'number' || !Number.isFinite(profile[field]) || profile[field] <= 0) {
      errors.push(`"${prefix}.${field}" must be a number > 0`);
    }
  }
}

module.exports = {
  BITRATE_PATTERN,
  buildAudioExtractArgs,
  buildVideoCompressArgs,
  formatCommand,
  getAudioMimeType,
  getAudioOutputExtension,
  getFfmpegSettings,
  getRequiredAudioConfig,
  getRequiredFfmpegSettings,
  getRequiredVideoConfig,
  validateFfmpegSettings
};
