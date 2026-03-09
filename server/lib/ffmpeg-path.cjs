#!/usr/bin/env node
/**
 * FFmpeg/FFprobe path resolver.
 *
 * Prefers bundled static binaries when present on disk. Falls back to PATH
 * executables when static binaries are unavailable or missing.
 */

const fs = require('fs');

function normalizeStaticPath(candidate) {
  return typeof candidate === 'string' && candidate.trim().length > 0
    ? candidate
    : null;
}

function resolveBinaryPath(staticCandidate, fallbackName, existsSync = fs.existsSync) {
  const staticPath = normalizeStaticPath(staticCandidate);
  if (staticPath && existsSync(staticPath)) {
    return staticPath;
  }
  return fallbackName;
}

function safeRequireFfmpegStatic() {
  try {
    return require('ffmpeg-static');
  } catch (_) {
    return null;
  }
}

function safeRequireFfprobeStaticPath() {
  try {
    const ffprobeStatic = require('ffprobe-static');
    return ffprobeStatic && typeof ffprobeStatic === 'object'
      ? ffprobeStatic.path
      : null;
  } catch (_) {
    return null;
  }
}

function resolveFfmpegPath(options = {}) {
  const staticCandidate = options.ffmpegStaticPath !== undefined
    ? options.ffmpegStaticPath
    : safeRequireFfmpegStatic();
  const existsSync = options.existsSync || fs.existsSync;
  return resolveBinaryPath(staticCandidate, 'ffmpeg', existsSync);
}

function resolveFfprobePath(options = {}) {
  const staticCandidate = options.ffprobeStaticPath !== undefined
    ? options.ffprobeStaticPath
    : safeRequireFfprobeStaticPath();
  const existsSync = options.existsSync || fs.existsSync;
  return resolveBinaryPath(staticCandidate, 'ffprobe', existsSync);
}

const ffmpegPath = resolveFfmpegPath();
const ffprobePath = resolveFfprobePath();

module.exports = {
  ffmpegPath,
  ffprobePath,
  resolveFfmpegPath,
  resolveFfprobePath,
  resolveBinaryPath
};
