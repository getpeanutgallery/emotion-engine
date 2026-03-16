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
const {
  buildAudioExtractArgs,
  getAudioOutputExtension,
  getRequiredAudioConfig
} = require('./ffmpeg-config.cjs');
const {
  createCommandFailure,
  createPathFailure,
  createIoFailure
} = require('./tool-wrapper-contract.cjs');

function pad(value, width) {
  return String(value).padStart(width, '0');
}

async function extractAudioChunk(audioPath, startTime, endTime, outputDir, chunkIndex, options = {}) {
  if (!audioPath || typeof audioPath !== 'string') {
    return createPathFailure({
      stage: 'tool.wrapper.audio-chunk.input',
      code: 'AUDIO_CHUNK_PATH_INVALID',
      message: 'Invalid audioPath: must be a non-empty string',
      path: audioPath || null
    });
  }

  if (typeof startTime !== 'number' || startTime < 0) {
    return {
      success: false,
      error: `Invalid startTime: must be a non-negative number, got ${startTime}`,
      failure: {
        failureCategory: 'config',
        failureCode: 'AUDIO_CHUNK_START_INVALID',
        stage: 'tool.wrapper.audio-chunk.input',
        diagnostics: { startTime },
        retryable: false,
        pathNormalizationEligible: false,
        systemCode: null,
        payload: null
      }
    };
  }

  if (typeof endTime !== 'number' || endTime <= startTime) {
    return {
      success: false,
      error: `Invalid endTime: must be greater than startTime (${startTime}), got ${endTime}`,
      failure: {
        failureCategory: 'config',
        failureCode: 'AUDIO_CHUNK_END_INVALID',
        stage: 'tool.wrapper.audio-chunk.input',
        diagnostics: { startTime, endTime },
        retryable: false,
        pathNormalizationEligible: false,
        systemCode: null,
        payload: null
      }
    };
  }

  if (!outputDir || typeof outputDir !== 'string') {
    return createIoFailure({
      stage: 'tool.wrapper.audio-chunk.output',
      code: 'AUDIO_CHUNK_OUTPUT_DIR_INVALID',
      message: 'Invalid outputDir: must be a non-empty string',
      path: outputDir || null,
      retryable: false
    });
  }

  if (typeof chunkIndex !== 'number' || chunkIndex < 0) {
    return {
      success: false,
      error: `Invalid chunkIndex: must be a non-negative number, got ${chunkIndex}`,
      failure: {
        failureCategory: 'config',
        failureCode: 'AUDIO_CHUNK_INDEX_INVALID',
        stage: 'tool.wrapper.audio-chunk.input',
        diagnostics: { chunkIndex },
        retryable: false,
        pathNormalizationEligible: false,
        systemCode: null,
        payload: null
      }
    };
  }

  if (!fs.existsSync(audioPath)) {
    return createPathFailure({
      stage: 'tool.wrapper.audio-chunk.source',
      code: 'AUDIO_CHUNK_SOURCE_MISSING',
      message: `Source audio not found: ${audioPath}`,
      path: audioPath
    });
  }

  try {
    fs.mkdirSync(outputDir, { recursive: true });
  } catch (error) {
    return createIoFailure({
      stage: 'tool.wrapper.audio-chunk.output',
      code: 'AUDIO_CHUNK_OUTPUT_DIR_CREATE_FAILED',
      message: `Failed to create output directory: ${error.message}`,
      path: outputDir,
      systemCode: error.code,
      diagnostics: { originalMessage: error.message }
    });
  }

  let ffmpegAudioConfig;
  try {
    ffmpegAudioConfig = options.ffmpegAudioConfig || getRequiredAudioConfig(options.config);
  } catch (error) {
    return {
      success: false,
      error: error.message,
      failure: {
        failureCategory: 'config',
        failureCode: 'AUDIO_CHUNK_FFMPEG_CONFIG_INVALID',
        stage: 'tool.wrapper.audio-chunk.config',
        diagnostics: { message: error.message },
        retryable: false,
        pathNormalizationEligible: false,
        systemCode: null,
        payload: null
      }
    };
  }

  const outputFilename = `chunk_${pad(chunkIndex, 3)}.${getAudioOutputExtension(ffmpegAudioConfig)}`;
  const outputPath = path.join(outputDir, outputFilename);
  const args = buildAudioExtractArgs({
    inputPath: audioPath,
    outputPath,
    ffmpegAudioConfig,
    startTime,
    durationSeconds: endTime - startTime
  });

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

        const failure = createCommandFailure({
          stage: 'tool.wrapper.audio-chunk.extract',
          code: 'AUDIO_CHUNK_FFMPEG_FAILED',
          command: ffmpegPath,
          args,
          stderr,
          exitCode: code,
          message: `FFmpeg exited with code ${code}. stderr: ${stderr.trim()}`,
          tool: 'ffmpeg',
          outputPath
        });
        return resolve(failure);
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
        return resolve(createCommandFailure({
          stage: 'tool.wrapper.audio-chunk.extract',
          code: 'AUDIO_CHUNK_OUTPUT_NOT_CREATED',
          command: ffmpegPath,
          args,
          stderr,
          exitCode: code,
          message: 'FFmpeg completed but output file was not created',
          tool: 'ffmpeg',
          outputPath
        }));
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

      resolve(createCommandFailure({
        stage: 'tool.wrapper.audio-chunk.spawn',
        code: 'AUDIO_CHUNK_FFMPEG_SPAWN_FAILED',
        command: ffmpegPath,
        args,
        message: `Failed to spawn FFmpeg: ${err.message}`,
        tool: 'ffmpeg',
        outputPath
      }));
    });
  });
}

module.exports = {
  extractAudioChunk
};
