'use strict';

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const FASTER_WHISPER_PYTHON = path.join(REPO_ROOT, '.venv-faster-whisper', 'bin', 'python');
const FASTER_WHISPER_SCRIPT = path.join(REPO_ROOT, 'server', 'scripts', 'get-context', 'faster-whisper-transcribe.py');
const FASTER_WHISPER_HF_HOME = path.join(REPO_ROOT, '.cache', 'huggingface');
const FASTER_WHISPER_DOWNLOAD_ROOT = path.join(REPO_ROOT, '.cache', 'faster-whisper');
const FASTER_WHISPER_MODEL = 'small.en';

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
  error.name = 'FasterWhisperMusicVocalsTimingError';
  error.stdout = stdout;
  error.stderr = stderr;
  error.exitCode = exitCode;
  if (cause) {
    error.cause = cause;
  }
  return error;
}

async function deriveFasterWhisperMusicVocalsTiming({
  assetPath,
  spawnImpl = spawn,
  pythonPath = FASTER_WHISPER_PYTHON,
  scriptPath = FASTER_WHISPER_SCRIPT,
  hfHome = FASTER_WHISPER_HF_HOME,
  downloadRoot = FASTER_WHISPER_DOWNLOAD_ROOT,
  model = FASTER_WHISPER_MODEL
}) {
  if (!assetPath) {
    throw new Error('deriveFasterWhisperMusicVocalsTiming requires assetPath.');
  }

  if (!fs.existsSync(pythonPath)) {
    throw new Error(`Repo-local faster-whisper Python is missing: ${pythonPath}`);
  }

  if (!fs.existsSync(scriptPath)) {
    throw new Error(`faster-whisper bridge script is missing: ${scriptPath}`);
  }

  fs.mkdirSync(hfHome, { recursive: true });
  fs.mkdirSync(downloadRoot, { recursive: true });

  return await new Promise((resolve, reject) => {
    const args = [
      scriptPath,
      '--asset-path', assetPath,
      '--model', model,
      '--download-root', downloadRoot
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
        message: `Failed to launch faster-whisper bridge: ${cause.message}`,
        stdout,
        stderr,
        cause
      }));
    });

    child.on('close', (code) => {
      if (code !== 0) {
        reject(createTimingFailure({
          message: `faster-whisper bridge exited with code ${code}`,
          stdout,
          stderr,
          exitCode: code
        }));
        return;
      }

      let payload;
      try {
        payload = parseJson(stdout, 'faster-whisper bridge stdout');
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
          message: 'faster-whisper bridge did not return any timed music-vocals segments.',
          stdout,
          stderr
        }));
        return;
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
  deriveFasterWhisperMusicVocalsTiming,
  FASTER_WHISPER_PYTHON,
  FASTER_WHISPER_SCRIPT,
  FASTER_WHISPER_HF_HOME,
  FASTER_WHISPER_DOWNLOAD_ROOT,
  FASTER_WHISPER_MODEL
};
