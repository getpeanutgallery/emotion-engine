#!/usr/bin/env node
/**
 * Video Chunk Extractor
 * Extracts video segments using ffmpeg without re-encoding for speed
 * 
 * Usage:
 *   const extractor = require('./video-chunk-extractor.cjs');
 *   const chunkPath = await extractor.extractVideoChunk('/path/to/video.mp4', 10, 30, '/output/dir', 0);
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { ffmpegPath } = require('./ffmpeg-path.cjs');
const {
    createCommandFailure,
    createPathFailure,
    createIoFailure
} = require('./tool-wrapper-contract.cjs');

/**
 * Extract a video chunk from a source video file
 * 
 * @param {string} videoPath - Path to the source video file
 * @param {number} startTime - Start time in seconds
 * @param {number} endTime - End time in seconds
 * @param {string} outputDir - Directory to save the extracted chunk
 * @param {number} chunkIndex - Index of the chunk (used in output filename)
 * @returns {Promise<{success: boolean, chunkPath?: string, error?: string}>}
 * 
 * @example
 * const result = await extractVideoChunk('/videos/input.mp4', 10, 30, '/output', 0);
 * if (result.success) {
 *   console.log(`Chunk saved to: ${result.chunkPath}`);
 * } else {
 *   console.error(`Extraction failed: ${result.error}`);
 * }
 */
async function extractVideoChunk(videoPath, startTime, endTime, outputDir, chunkIndex, options = {}) {
    // Validate inputs
    if (!videoPath || typeof videoPath !== 'string') {
        return createPathFailure({
            stage: 'tool.wrapper.video-chunk.input',
            code: 'VIDEO_CHUNK_PATH_INVALID',
            message: 'Invalid videoPath: must be a non-empty string',
            path: videoPath || null
        });
    }

    if (typeof startTime !== 'number' || startTime < 0) {
        return {
            success: false,
            error: `Invalid startTime: must be a non-negative number, got ${startTime}`,
            failure: {
                failureCategory: 'config',
                failureCode: 'VIDEO_CHUNK_START_INVALID',
                stage: 'tool.wrapper.video-chunk.input',
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
                failureCode: 'VIDEO_CHUNK_END_INVALID',
                stage: 'tool.wrapper.video-chunk.input',
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
            stage: 'tool.wrapper.video-chunk.output',
            code: 'VIDEO_CHUNK_OUTPUT_DIR_INVALID',
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
                failureCode: 'VIDEO_CHUNK_INDEX_INVALID',
                stage: 'tool.wrapper.video-chunk.input',
                diagnostics: { chunkIndex },
                retryable: false,
                pathNormalizationEligible: false,
                systemCode: null,
                payload: null
            }
        };
    }

    // Check if source video exists
    if (!fs.existsSync(videoPath)) {
        return createPathFailure({
            stage: 'tool.wrapper.video-chunk.source',
            code: 'VIDEO_CHUNK_SOURCE_MISSING',
            message: `Source video not found: ${videoPath}`,
            path: videoPath
        });
    }

    // Ensure output directory exists
    try {
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }
    } catch (err) {
        return createIoFailure({
            stage: 'tool.wrapper.video-chunk.output',
            code: 'VIDEO_CHUNK_OUTPUT_DIR_CREATE_FAILED',
            message: `Failed to create output directory: ${err.message}`,
            path: outputDir,
            systemCode: err.code,
            diagnostics: { originalMessage: err.message }
        });
    }

    // Generate output filename
    const ext = path.extname(videoPath) || '.mp4';
    const outputFilename = `chunk_${chunkIndex.toString().padStart(3, '0')}${ext}`;
    const outputPath = path.join(outputDir, outputFilename);

    const durationSeconds = endTime - startTime;

    // Build FFmpeg command
    // -ss: seek to start time (before -i for fast seek)
    // -t: extract a bounded duration window relative to the seek point
    // -c copy: copy streams without re-encoding (fast)
    // -y: overwrite output file if exists
    const args = [
        '-ss', startTime.toString(),
        '-i', videoPath,
        '-t', durationSeconds.toString(),
        '-c', 'copy',
        '-y',
        outputPath
    ];

    const rawLogger = typeof options.rawLogger === 'function' ? options.rawLogger : null;

    console.log(`   🎬 Extracting chunk ${chunkIndex}: ${startTime}s → ${endTime}s`);

    return new Promise((resolve) => {
        const ffmpeg = spawn(ffmpegPath, args);
        let stderr = '';

        ffmpeg.stderr.on('data', (data) => {
            stderr += data.toString();
        });

        ffmpeg.on('close', (code) => {
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
                console.error(`   ⚠️  FFmpeg extraction failed with code ${code}`);
                return resolve(createCommandFailure({
                    stage: 'tool.wrapper.video-chunk.extract',
                    code: 'VIDEO_CHUNK_FFMPEG_FAILED',
                    command: ffmpegPath,
                    args,
                    stderr,
                    exitCode: code,
                    message: `FFmpeg exited with code ${code}. stderr: ${stderr.trim()}`,
                    tool: 'ffmpeg',
                    outputPath
                }));
            }

            // Verify output file was created
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
                    stage: 'tool.wrapper.video-chunk.extract',
                    code: 'VIDEO_CHUNK_OUTPUT_NOT_CREATED',
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
            const duration = endTime - startTime;
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
            console.log(`   ✅ Chunk extracted: ${(fileSize / 1024 / 1024).toFixed(2)}MB (${duration}s)`);

            resolve({
                success: true,
                chunkPath: outputPath
            });
        });

        ffmpeg.on('error', (err) => {
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
            console.error(`   ⚠️  FFmpeg spawn error: ${err.message}`);
            resolve(createCommandFailure({
                stage: 'tool.wrapper.video-chunk.spawn',
                code: 'VIDEO_CHUNK_FFMPEG_SPAWN_FAILED',
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
    extractVideoChunk
};
