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
const { execSync } = require('child_process');
const ffmpegPath = require('ffmpeg-static');
const ffprobePath = require('ffprobe-static');

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
function splitChunk(chunkPath, maxFileSize, maxSplits = 5, splitFactor = 0.5, currentSplit = 0) {
  if (!fs.existsSync(chunkPath)) {
    throw new Error(`Chunk file not found: ${chunkPath}`);
  }
  
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
  const duration = getVideoDuration(chunkPath);
  
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
    // Split first half (0 to splitTime)
    execSync(`"${ffmpegPath}" -y -i "${chunkPath}" -t ${splitTime} -c copy "${firstHalfPath}" 2>/dev/null`);
    
    // Split second half (splitTime to end)
    execSync(`"${ffmpegPath}" -y -i "${chunkPath}" -ss ${splitTime} -c copy "${secondHalfPath}" 2>/dev/null`);
    
    // Remove original chunk
    fs.unlinkSync(chunkPath);
    
    // Recursively check each half
    const firstHalfResults = splitChunk(firstHalfPath, maxFileSize, maxSplits, splitFactor, currentSplit + 1);
    const secondHalfResults = splitChunk(secondHalfPath, maxFileSize, maxSplits, splitFactor, currentSplit + 1);
    
    return [...firstHalfResults, ...secondHalfResults];
    
  } catch (error) {
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
function getVideoDuration(videoPath) {
  try {
    const result = execSync(
      `"${ffprobePath}" -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${videoPath}"`,
      { encoding: 'utf8' }
    );
    return parseFloat(result.trim());
  } catch (error) {
    throw new Error(`Failed to get duration for ${videoPath}: ${error.message}`);
  }
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
