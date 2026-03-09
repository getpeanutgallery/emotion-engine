#!/usr/bin/env node
/**
 * Split Strategy Utility
 * Recursively splits oversized chunks using ffmpeg
 * 
 * Usage:
 *   const splitStrategy = require('./lib/split-strategy.cjs');
 *   const chunks = await splitStrategy.splitChunk('/path/to/chunk.mp4', 104857600, 5);
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { ffmpegPath, ffprobePath } = require('./ffmpeg-path.cjs');

/**
 * Split a chunk file recursively if it exceeds max file size
 * @param {string} chunkPath - Path to the chunk file
 * @param {number} maxFileSize - Maximum allowed file size in bytes
 * @param {number} maxSplits - Maximum number of recursive splits allowed
 * @param {number} splitFactor - Factor to split by (0.5 = split in half)
 * @param {number} currentSplit - Current split depth (for recursion)
 * @returns {string[]} Array of valid chunk paths that are under the size limit
 * @throws {Error} If maxSplits exceeded while file still too large
 */
function splitChunk(chunkPath, maxFileSize, maxSplits = 5, splitFactor = 0.5, currentSplit = 0, options = {}) {
  if (!fs.existsSync(chunkPath)) {
    throw new Error(`Chunk file not found: ${chunkPath}`);
  }
  
  const rawLogger = typeof options.rawLogger === 'function' ? options.rawLogger : null;

  // Check file size
  const stats = fs.statSync(chunkPath);
  const fileSize = stats.size;
  
  // If file is under limit, return it
  if (fileSize <= maxFileSize) {
    return [chunkPath];
  }
  
  // If over limit but max splits reached, throw error
  if (currentSplit >= maxSplits) {
    const error = new Error(
      `Max split depth exceeded for chunk: ${chunkPath}\n` +
      `  File size: ${formatBytes(fileSize)}\n` +
      `  Max allowed: ${formatBytes(maxFileSize)}\n` +
      `  Split depth: ${currentSplit}/${maxSplits}`
    );
    error.chunkPath = chunkPath;
    error.fileSize = fileSize;
    error.maxFileSize = maxFileSize;
    error.splitDepth = currentSplit;
    throw error;
  }
  
  // Get duration of the chunk
  const duration = getVideoDuration(chunkPath, options);
  
  // Calculate split point
  const splitTime = duration * splitFactor;
  
  // Create output paths for the two halves
  const dir = path.dirname(chunkPath);
  const baseName = path.basename(chunkPath, path.extname(chunkPath));
  const ext = path.extname(chunkPath);
  
  const firstHalfPath = path.join(dir, `${baseName}_split${currentSplit}_a${ext}`);
  const secondHalfPath = path.join(dir, `${baseName}_split${currentSplit}_b${ext}`);
  
  // Split using ffmpeg
  try {
    const quoteArg = (value) => {
      if (typeof value !== 'string') return String(value);
      return /\s|"/.test(value) ? `"${value.replace(/"/g, '\\"')}"` : value;
    };

    // Split first half (0 to splitTime)
    const firstArgs = ['-y', '-i', chunkPath, '-t', String(splitTime), '-c', 'copy', firstHalfPath];
    const firstResult = spawnSync(ffmpegPath, firstArgs, { encoding: 'utf8' });
    const firstCommand = `"${ffmpegPath}" ${firstArgs.map(quoteArg).join(' ')}`;
    if (rawLogger) {
      rawLogger(`split-depth-${currentSplit}-a.json`, {
        tool: 'ffmpeg',
        command: firstCommand,
        args: firstArgs,
        exitCode: firstResult.status,
        stdout: firstResult.stdout || '',
        stderr: firstResult.stderr || '',
        status: firstResult.status === 0 ? 'success' : 'failed',
        chunkPath,
        outputPath: firstHalfPath,
        splitDepth: currentSplit
      });
    }
    if (firstResult.status !== 0) {
      const error = new Error(`ffmpeg split failed (a) with exit code ${firstResult.status}`);
      error.exitCode = firstResult.status;
      error.stdout = firstResult.stdout;
      error.stderr = firstResult.stderr;
      throw error;
    }

    // Split second half (splitTime to end)
    const secondArgs = ['-y', '-i', chunkPath, '-ss', String(splitTime), '-c', 'copy', secondHalfPath];
    const secondResult = spawnSync(ffmpegPath, secondArgs, { encoding: 'utf8' });
    const secondCommand = `"${ffmpegPath}" ${secondArgs.map(quoteArg).join(' ')}`;
    if (rawLogger) {
      rawLogger(`split-depth-${currentSplit}-b.json`, {
        tool: 'ffmpeg',
        command: secondCommand,
        args: secondArgs,
        exitCode: secondResult.status,
        stdout: secondResult.stdout || '',
        stderr: secondResult.stderr || '',
        status: secondResult.status === 0 ? 'success' : 'failed',
        chunkPath,
        outputPath: secondHalfPath,
        splitDepth: currentSplit
      });
    }
    if (secondResult.status !== 0) {
      const error = new Error(`ffmpeg split failed (b) with exit code ${secondResult.status}`);
      error.exitCode = secondResult.status;
      error.stdout = secondResult.stdout;
      error.stderr = secondResult.stderr;
      throw error;
    }
    
    // Remove original chunk
    fs.unlinkSync(chunkPath);
    
    // Recursively check each half
    const firstHalfResults = splitChunk(firstHalfPath, maxFileSize, maxSplits, splitFactor, currentSplit + 1, options);
    const secondHalfResults = splitChunk(secondHalfPath, maxFileSize, maxSplits, splitFactor, currentSplit + 1, options);
    
    return [...firstHalfResults, ...secondHalfResults];
    
  } catch (error) {
    if (rawLogger) {
      rawLogger(`split-depth-${currentSplit}.error.json`, {
        tool: 'ffmpeg',
        chunkPath,
        splitDepth: currentSplit,
        status: 'failed',
        error: error.message,
        stdout: error.stdout ? error.stdout.toString() : '',
        stderr: error.stderr ? error.stderr.toString() : ''
      });
    }
    // Clean up partial splits if ffmpeg failed
    if (fs.existsSync(firstHalfPath)) fs.unlinkSync(firstHalfPath);
    if (fs.existsSync(secondHalfPath)) fs.unlinkSync(secondHalfPath);
    
    throw new Error(`Failed to split chunk ${chunkPath}: ${error.message}`);
  }
}

/**
 * Get video duration using ffprobe
 * @param {string} videoPath - Path to video file
 * @returns {number} Duration in seconds
 */
function getVideoDuration(videoPath, options = {}) {
  const rawLogger = typeof options.rawLogger === 'function' ? options.rawLogger : null;

  const quoteArg = (value) => {
    if (typeof value !== 'string') return String(value);
    return /\s|"/.test(value) ? `"${value.replace(/"/g, '\\"')}"` : value;
  };

  const args = ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', videoPath];
  const command = `"${ffprobePath}" ${args.map(quoteArg).join(' ')}`;

  const result = spawnSync(ffprobePath, args, { encoding: 'utf8' });

  if (rawLogger) {
    rawLogger('split-ffprobe-duration.json', {
      tool: 'ffprobe',
      command,
      args,
      videoPath,
      exitCode: result.status,
      stdout: result.stdout || '',
      stderr: result.stderr || '',
      status: result.status === 0 ? 'success' : 'failed'
    });
  }

  if (result.status !== 0) {
    const error = new Error(`ffprobe duration failed with exit code ${result.status}`);
    error.exitCode = result.status;
    error.stdout = result.stdout;
    error.stderr = result.stderr;
    throw error;
  }

  return parseFloat((result.stdout || '').trim());
}

/**
 * Format bytes as human-readable string
 * @param {number} bytes - Size in bytes
 * @returns {string} Formatted string
 */
function formatBytes(bytes) {
  const units = ['B', 'KB', 'MB', 'GB'];
  let unitIndex = 0;
  let size = bytes;
  
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  
  return `${size.toFixed(2)} ${units[unitIndex]}`;
}

module.exports = {
  splitChunk,
  getVideoDuration,
  formatBytes
};
