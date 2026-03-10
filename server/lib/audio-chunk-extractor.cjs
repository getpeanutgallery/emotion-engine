#!/usr/bin/env node

'use strict';

/**
 * Audio Chunk Extractor
 *
 * Extracts time-based audio segments using ffmpeg.
 * Deterministic naming: chunk_000.wav, chunk_001.wav, ...
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { ffmpegPath } = require('./ffmpeg-path.cjs');

function pad(value, width) {
  return String(value).padStart(width, '0');
}

async function extractAudioChunk(audioPath, startTime, endTime, outputDir, chunkIndex, options = {}) {
  if (!audioPath || typeof audioPath !== 'string') {
    return { success: false, error: 'Invalid audioPath: must be a non-empty string' };
  }

  if (typeof startTime !== 'number' || startTime < 0) {
    return { success: false, error: `Invalid startTime: must be a non-negative number, got ${startTime}` };
  }

  if (typeof endTime !== 'number' || endTime <= startTime) {
    return { success: false, error: `Invalid endTime: must be greater than startTime (${startTime}), got ${endTime}` };
  }

  if (!outputDir || typeof outputDir !== 'string') {
    return { success: false, error: 'Invalid outputDir: must be a non-empty string' };
  }

  if (typeof chunkIndex !== 'number' || chunkIndex < 0) {
    return { success: false, error: `Invalid chunkIndex: must be a non-negative number, got ${chunkIndex}` };
  }

  if (!fs.existsSync(audioPath)) {
    return { success: false, error: `Source audio not found: ${audioPath}` };
  }

  fs.mkdirSync(outputDir, { recursive: true });

  const outputFilename = `chunk_${pad(chunkIndex, 3)}.wav`;
  const outputPath = path.join(outputDir, outputFilename);

  // Extract and normalize audio to 16kHz mono PCM WAV to match existing get-dialogue/get-music behavior.
  const args = [
    '-v', 'error',
    '-i', audioPath,
    '-ss', startTime.toString(),
    '-t', (endTime - startTime).toString(),
    '-acodec', 'pcm_s16le',
    '-ar', '16000',
    '-ac', '1',
    '-y',
    outputPath
  ];

  const rawLogger = typeof options.rawLogger === 'function' ? options.rawLogger : null;

  return new Promise((resolve) => {
    const proc = spawn(ffmpegPath, args);
    let stderr = '';

    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      if (code !== 0) {
        if (rawLogger) {
          rawLogger({
            tool: 'ffmpeg',
            command: ffmpegPath,
            args,
            chunkIndex,
            startTime,
            endTime,
            status: 'failed',
            exitCode: code,
            stderr
          });
        }

        return resolve({
          success: false,
          error: `FFmpeg exited with code ${code}. stderr: ${stderr.trim()}`
        });
      }

      if (!fs.existsSync(outputPath)) {
        if (rawLogger) {
          rawLogger({
            tool: 'ffmpeg',
            command: ffmpegPath,
            args,
            chunkIndex,
            startTime,
            endTime,
            status: 'failed',
            exitCode: code,
            stderr,
            error: 'output_not_created'
          });
        }
        return resolve({ success: false, error: 'FFmpeg completed but output file was not created' });
      }

      const fileSize = fs.statSync(outputPath).size;
      if (rawLogger) {
        rawLogger({
          tool: 'ffmpeg',
          command: ffmpegPath,
          args,
          chunkIndex,
          startTime,
          endTime,
          status: 'success',
          exitCode: code,
          stderr,
          outputPath,
          fileSize
        });
      }

      resolve({ success: true, chunkPath: outputPath, fileSize });
    });

    proc.on('error', (err) => {
      if (rawLogger) {
        rawLogger({
          tool: 'ffmpeg',
          command: ffmpegPath,
          args,
          chunkIndex,
          startTime,
          endTime,
          status: 'failed',
          error: err.message
        });
      }

      resolve({ success: false, error: `Failed to spawn FFmpeg: ${err.message}` });
    });
  });
}

module.exports = {
  extractAudioChunk
};
