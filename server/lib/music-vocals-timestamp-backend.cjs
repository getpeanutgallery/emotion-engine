'use strict';

const {
  deriveFasterWhisperMusicVocalsTiming
} = require('./faster-whisper-music-vocals-timing.cjs');
const {
  deriveWhisperXMusicVocalsTiming
} = require('./whisperx-music-vocals-timing.cjs');

const DEFAULT_TIMESTAMP_BACKEND = 'faster_whisper';
const SUPPORTED_TIMESTAMP_BACKENDS = new Set(['faster_whisper', 'whisperx']);

function getConfiguredMusicVocalsTimestampBackend(config = {}) {
  const configured = config?.settings?.phase1?.music_vocals?.timestamp_backend;
  if (configured === undefined || configured === null || configured === '') {
    return DEFAULT_TIMESTAMP_BACKEND;
  }
  return String(configured).trim().toLowerCase();
}

async function deriveMusicVocalsTiming({ assetPath, config = {}, onDebugEvidence = null }) {
  const backend = getConfiguredMusicVocalsTimestampBackend(config);

  if (!SUPPORTED_TIMESTAMP_BACKENDS.has(backend)) {
    throw new Error(
      `Unsupported music-vocals timestamp backend: ${backend}. `
      + `Expected one of: ${Array.from(SUPPORTED_TIMESTAMP_BACKENDS).join(', ')}`
    );
  }

  if (backend === 'whisperx') {
    return deriveWhisperXMusicVocalsTiming({ assetPath, onDebugEvidence });
  }

  return deriveFasterWhisperMusicVocalsTiming({ assetPath, onDebugEvidence });
}

module.exports = {
  DEFAULT_TIMESTAMP_BACKEND,
  SUPPORTED_TIMESTAMP_BACKENDS,
  getConfiguredMusicVocalsTimestampBackend,
  deriveMusicVocalsTiming
};
