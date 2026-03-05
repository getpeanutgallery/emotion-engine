#!/usr/bin/env node
/**
 * Duration-Based Chunk Strategy
 * Divides video into fixed-duration chunks
 * 
 * Usage:
 *   const strategy = require('./chunk-strategies/duration-based.cjs');
 *   const boundaries = strategy.calculateChunkBoundaries(180, { chunkDuration: 30 });
 *   // Returns: [{startTime: 0, endTime: 30}, {startTime: 30, endTime: 60}, ...]
 */

/**
 * @typedef {Object} ChunkBoundary
 * @property {number} startTime - Start time in seconds
 * @property {number} endTime - End time in seconds
 */

/**
 * Calculate chunk boundaries based on fixed duration
 * @param {number} videoDuration - Total video duration in seconds
 * @param {Object} config - Strategy configuration
 * @param {number} config.chunkDuration - Duration of each chunk in seconds
 * @returns {ChunkBoundary[]} Array of chunk boundaries
 */
function calculateChunkBoundaries(videoDuration, config = {}) {
  const { chunkDuration = 30 } = config;
  
  if (chunkDuration <= 0) {
    throw new Error('chunkDuration must be positive');
  }
  
  if (videoDuration <= 0) {
    throw new Error('videoDuration must be positive');
  }
  
  const boundaries = [];
  let currentTime = 0;
  
  while (currentTime < videoDuration) {
    const endTime = Math.min(currentTime + chunkDuration, videoDuration);
    boundaries.push({
      startTime: currentTime,
      endTime: endTime
    });
    currentTime = endTime;
  }
  
  return boundaries;
}

module.exports = {
  calculateChunkBoundaries
};
