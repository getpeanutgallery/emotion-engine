#!/usr/bin/env node

'use strict';

/**
 * Audio preflight + Base64 budget helpers.
 *
 * Provider payload limits typically apply to the *encoded* Base64 attachment size.
 * Base64 expands payload size by ~4/3.
 */

const fs = require('fs');
const { execSync } = require('child_process');
const { ffprobePath } = require('./ffmpeg-path.cjs');
const {
  createCommandFailure,
  createPathFailure,
  createIoFailure,
  applyFailureMetadata
} = require('./tool-wrapper-contract.cjs');

const DEFAULT_BASE64_LIMIT_BYTES = 10 * 1024 * 1024; // ~10MB
const DEFAULT_HEADROOM_RATIO = 0.9; // keep 10% headroom under provider limit

function clampNumber(value, { min = -Infinity, max = Infinity } = {}) {
  if (typeof value !== 'number' || Number.isNaN(value)) return null;
  return Math.min(max, Math.max(min, value));
}

function estimateBase64SizeBytes(rawBytes) {
  const n = typeof rawBytes === 'number' ? rawBytes : Number(rawBytes);
  if (!Number.isFinite(n) || n < 0) return 0;

  // Base64 string length ≈ 4 * ceil(n/3). That is ~4/3 expansion.
  return 4 * Math.ceil(n / 3);
}

function getAudioDurationSeconds(audioPath, rawCapture = {}) {
  const command = `"${ffprobePath}" -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${audioPath}"`;
  try {
    const stdout = execSync(command, { encoding: 'utf8' });
    const stdoutText = typeof stdout === 'string' ? stdout : stdout.toString();

    if (rawCapture?.captureRaw && typeof rawCapture?.rawLogger === 'function') {
      rawCapture.rawLogger({
        tool: 'ffprobe',
        command,
        stdout: stdoutText,
        status: 'success'
      });
    }

    return parseFloat(stdoutText.trim()) || 0;
  } catch (error) {
    const stdout = error?.stdout ? error.stdout.toString() : '';
    const stderr = error?.stderr ? error.stderr.toString() : '';

    if (rawCapture?.captureRaw && typeof rawCapture?.rawLogger === 'function') {
      rawCapture.rawLogger({
        tool: 'ffprobe',
        command,
        stdout,
        stderr,
        status: 'failed',
        error: error?.message || String(error)
      });
    }

    const failure = createCommandFailure({
      stage: 'tool.wrapper.audio-preflight.duration',
      code: 'AUDIO_PREFLIGHT_DURATION_FAILED',
      command: ffprobePath,
      args: ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', audioPath],
      stdout,
      stderr,
      exitCode: error?.status ?? error?.code ?? null,
      message: `audio-preflight could not read duration for ${audioPath}: ${error?.message || String(error)}`,
      tool: 'ffprobe'
    });
    throw applyFailureMetadata(new Error(failure.error), failure.failure);
  }
}

function resolveBase64LimitBytes(config) {
  const fromSettings = config?.settings?.audio_base64_max_bytes;
  if (Number.isInteger(fromSettings) && fromSettings > 0) return fromSettings;

  const directToolVars = config?.tool_variables?.maxFileSize;
  if (Number.isInteger(directToolVars) && directToolVars > 0) return directToolVars;

  const nestedToolVars = config?.tool_variables?.file_transfer?.maxFileSize;
  if (Number.isInteger(nestedToolVars) && nestedToolVars > 0) return nestedToolVars;

  return DEFAULT_BASE64_LIMIT_BYTES;
}

function resolveHeadroomRatio(config) {
  const fromSettings = config?.settings?.audio_base64_headroom_ratio;
  const ratio = clampNumber(fromSettings, { min: 0.1, max: 0.99 });
  return ratio ?? DEFAULT_HEADROOM_RATIO;
}

function planTimeChunks({ durationSeconds, chunkDurationSeconds }) {
  const duration = clampNumber(durationSeconds, { min: 0, max: Number.MAX_SAFE_INTEGER }) || 0;
  const chunk = clampNumber(chunkDurationSeconds, { min: 0.1, max: duration || 0.1 }) || 0.1;

  if (duration <= 0) {
    return [];
  }

  const chunks = [];
  let idx = 0;
  for (let start = 0; start < duration; start += chunk) {
    const end = Math.min(start + chunk, duration);
    chunks.push({
      index: idx,
      startTime: start,
      endTime: end,
      duration: end - start
    });
    idx += 1;
    // Defensive: avoid infinite loop due to float issues.
    if (idx > 100000) break;
  }

  return chunks;
}

function computeChunkDurationSeconds({
  durationSeconds,
  sizeBytes,
  base64LimitBytes,
  headroomRatio
}) {
  const duration = clampNumber(durationSeconds, { min: 0.01, max: Number.MAX_SAFE_INTEGER });
  const size = clampNumber(sizeBytes, { min: 0, max: Number.MAX_SAFE_INTEGER });
  const limit = clampNumber(base64LimitBytes, { min: 1024, max: Number.MAX_SAFE_INTEGER }) || DEFAULT_BASE64_LIMIT_BYTES;
  const headroom = clampNumber(headroomRatio, { min: 0.1, max: 0.99 }) || DEFAULT_HEADROOM_RATIO;

  if (!duration || !size) {
    // If we can't compute bytes/sec, fall back to a conservative 30s chunk.
    return 30;
  }

  const bytesPerSecond = size / duration;

  // How many raw bytes can we send while staying under Base64 budget?
  // estimatedBase64SizeBytes(raw) <= limit * headroom
  const rawBudgetBytes = Math.floor((limit * headroom) * 3 / 4);

  const chunkDuration = rawBudgetBytes / bytesPerSecond;

  // Clamp chunk sizes to be reasonable (avoid pathological microchunks).
  const clamped = clampNumber(chunkDuration, {
    min: 5,
    max: Math.max(5, duration)
  });

  return clamped ?? 30;
}

/**
 * Preflight an audio file and decide whether to chunk based on estimated Base64 payload size.
 *
 * @returns {{
 *  sizeBytes: number,
 *  durationSeconds: number,
 *  bytesPerSecond: number|null,
 *  estimatedBase64Bytes: number,
 *  base64LimitBytes: number,
 *  headroomRatio: number,
 *  budgetBytes: number,
 *  needsChunking: boolean,
 *  recommendedChunkDurationSeconds: number,
 *  chunkPlan: Array<{index:number,startTime:number,endTime:number,duration:number}>,
 *  trace: object
 * }}
 */
function preflightAudio({ audioPath, config, rawCapture } = {}) {
  if (!audioPath || typeof audioPath !== 'string') {
    const failure = createPathFailure({
      stage: 'tool.wrapper.audio-preflight.input',
      code: 'AUDIO_PREFLIGHT_PATH_REQUIRED',
      message: 'audio-preflight: audioPath is required',
      path: audioPath || null
    });
    throw applyFailureMetadata(new Error(failure.error), failure.failure);
  }

  let stats;
  try {
    stats = fs.statSync(audioPath);
  } catch (error) {
    const failure = error?.code === 'ENOENT'
      ? createPathFailure({
          stage: 'tool.wrapper.audio-preflight.stat',
          code: 'AUDIO_PREFLIGHT_SOURCE_MISSING',
          message: `audio-preflight source not found: ${audioPath}`,
          path: audioPath,
          systemCode: error.code
        })
      : createIoFailure({
          stage: 'tool.wrapper.audio-preflight.stat',
          code: 'AUDIO_PREFLIGHT_STAT_FAILED',
          message: `audio-preflight could not stat source: ${audioPath}`,
          path: audioPath,
          systemCode: error.code,
          diagnostics: { originalMessage: error?.message || String(error) }
        });
    throw applyFailureMetadata(new Error(failure.error), failure.failure);
  }

  const sizeBytes = stats.size;
  const durationSeconds = getAudioDurationSeconds(audioPath, rawCapture);

  const bytesPerSecond = durationSeconds > 0 ? (sizeBytes / durationSeconds) : null;

  const base64LimitBytes = resolveBase64LimitBytes(config);
  const headroomRatio = resolveHeadroomRatio(config);
  const budgetBytes = Math.floor(base64LimitBytes * headroomRatio);

  const estimatedBase64Bytes = estimateBase64SizeBytes(sizeBytes);
  const needsChunking = estimatedBase64Bytes > budgetBytes;

  const recommendedChunkDurationSeconds = needsChunking
    ? computeChunkDurationSeconds({ durationSeconds, sizeBytes, base64LimitBytes, headroomRatio })
    : durationSeconds;

  const chunkPlan = needsChunking
    ? planTimeChunks({ durationSeconds, chunkDurationSeconds: recommendedChunkDurationSeconds })
    : [{ index: 0, startTime: 0, endTime: durationSeconds, duration: durationSeconds }];

  return {
    sizeBytes,
    durationSeconds,
    bytesPerSecond,
    estimatedBase64Bytes,
    base64LimitBytes,
    headroomRatio,
    budgetBytes,
    needsChunking,
    recommendedChunkDurationSeconds,
    chunkPlan,
    trace: {
      reason: needsChunking ? 'estimated_base64_exceeds_budget' : 'within_budget',
      base64Expansion: '4*ceil(bytes/3)',
      sizeBytes,
      estimatedBase64Bytes,
      base64LimitBytes,
      budgetBytes,
      headroomRatio,
      durationSeconds,
      bytesPerSecond,
      recommendedChunkDurationSeconds,
      chunks: chunkPlan.length
    }
  };
}

module.exports = {
  DEFAULT_BASE64_LIMIT_BYTES,
  DEFAULT_HEADROOM_RATIO,
  estimateBase64SizeBytes,
  resolveBase64LimitBytes,
  resolveHeadroomRatio,
  planTimeChunks,
  computeChunkDurationSeconds,
  getAudioDurationSeconds,
  preflightAudio
};
