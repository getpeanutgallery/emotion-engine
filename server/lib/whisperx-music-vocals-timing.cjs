'use strict';

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const WHISPERX_PYTHON = path.join(REPO_ROOT, '.venv-whisperx', 'bin', 'python');
const WHISPERX_SCRIPT = path.join(REPO_ROOT, 'server', 'scripts', 'get-context', 'whisperx-transcribe.py');
const WHISPERX_HF_HOME = path.join(REPO_ROOT, '.cache', 'huggingface');
const WHISPERX_DOWNLOAD_ROOT = path.join(REPO_ROOT, '.cache', 'whisperx');
const WHISPERX_MODEL = 'small.en';
const WHISPERX_BATCH_SIZE = 16;

function parseJson(text, label) {
  try {
    return JSON.parse(text);
  } catch (error) {
    const parseError = new Error(`Failed to parse ${label} JSON: ${error.message}`);
    parseError.cause = error;
    parseError.rawText = text;
    throw parseError;
  }
}

function createTimingFailure({ message, stdout, stderr, cause, exitCode = null }) {
  const error = new Error(message);
  error.name = 'WhisperXMusicVocalsTimingError';
  error.stdout = stdout;
  error.stderr = stderr;
  error.exitCode = exitCode;
  if (cause) {
    error.cause = cause;
  }
  return error;
}

async function deriveWhisperXMusicVocalsTiming({
  assetPath,
  spawnImpl = spawn,
  pythonPath = WHISPERX_PYTHON,
  scriptPath = WHISPERX_SCRIPT,
  hfHome = WHISPERX_HF_HOME,
  downloadRoot = WHISPERX_DOWNLOAD_ROOT,
  model = WHISPERX_MODEL,
  batchSize = WHISPERX_BATCH_SIZE,
  onDebugEvidence = null
}) {
  if (!assetPath) {
    throw new Error('deriveWhisperXMusicVocalsTiming requires assetPath.');
  }

  if (!fs.existsSync(pythonPath)) {
    throw new Error(
      `Repo-local WhisperX Python is missing: ${pythonPath}. `
      + 'Create .venv-whisperx and install whisperx before selecting settings.phase1.music_vocals.timestamp_backend=whisperx.'
    );
  }

  if (!fs.existsSync(scriptPath)) {
    throw new Error(`WhisperX bridge script is missing: ${scriptPath}`);
  }

  fs.mkdirSync(hfHome, { recursive: true });
  fs.mkdirSync(downloadRoot, { recursive: true });

  return await new Promise((resolve, reject) => {
    const args = [
      scriptPath,
      '--asset-path', assetPath,
      '--model', model,
      '--download-root', downloadRoot,
      '--batch-size', String(batchSize)
    ];

    const child = spawnImpl(pythonPath, args, {
      env: {
        ...process.env,
        HF_HOME: hfHome
      },
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';

    child.stdout?.on('data', (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr?.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('error', (cause) => {
      reject(createTimingFailure({
        message: `Failed to launch WhisperX bridge: ${cause.message}`,
        stdout,
        stderr,
        cause
      }));
    });

    child.on('close', (code) => {
      if (code !== 0) {
        reject(createTimingFailure({
          message: `WhisperX bridge exited with code ${code}`,
          stdout,
          stderr,
          exitCode: code
        }));
        return;
      }

      let payload;
      try {
        payload = parseJson(stdout, 'WhisperX bridge stdout');
      } catch (cause) {
        reject(createTimingFailure({
          message: cause.message,
          stdout,
          stderr,
          cause
        }));
        return;
      }

      const rawSegments = Array.isArray(payload?.dialogue_segments) ? payload.dialogue_segments : null;
      const timedSegmentCount = rawSegments
        ? rawSegments.filter((segment) => Number.isFinite(segment?.start) && Number.isFinite(segment?.end)).length
        : 0;

      if (!rawSegments || timedSegmentCount === 0) {
        reject(createTimingFailure({
          message: 'WhisperX bridge did not return any timed music-vocals segments.',
          stdout,
          stderr
        }));
        return;
      }

      if (typeof onDebugEvidence === 'function') {
        onDebugEvidence({
          backend: 'whisperx',
          bridgePayload: payload,
          bridgeStderr: stderr || null
        });
      }

      resolve({
        musicVocalsData: {
          vocal_segments: rawSegments.map((segment) => ({ ...segment })),
          summary: String(payload?.summary || ''),
          totalDuration: Number.isFinite(payload?.totalDuration) ? payload.totalDuration : null
        },
        metadata: {
          runtime: payload?.runtime || null,
          engine: payload?.engine || null,
          warnings: Array.isArray(payload?.warnings) ? payload.warnings : []
        }
      });
    });
  });
}

module.exports = {
  deriveWhisperXMusicVocalsTiming,
  WHISPERX_PYTHON,
  WHISPERX_SCRIPT,
  WHISPERX_HF_HOME,
  WHISPERX_DOWNLOAD_ROOT,
  WHISPERX_MODEL,
  WHISPERX_BATCH_SIZE
};
