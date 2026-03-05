#!/usr/bin/env node
/**
 * Chunk Strategy Factory
 * Returns appropriate chunk strategy implementation based on type
 * 
 * Usage:
 *   const strategy = require('./lib/chunk-strategy.cjs');
 *   const durationStrategy = strategy.getChunkStrategy('duration-based', { chunkDuration: 30 });
 *   const boundaries = durationStrategy.calculateChunkBoundaries(180, { chunkDuration: 30 });
 */

const durationBased = require('./chunk-strategies/duration-based.cjs');
const sizeBased = require('./chunk-strategies/size-based.cjs');
const countBased = require('./chunk-strategies/count-based.cjs');

/**
 * @typedef {Object} ChunkBoundary
 * @property {number} startTime - Start time in seconds
 * @property {number} endTime - End time in seconds
 */

/**
 * @typedef {Object} ChunkStrategy
 * @property {Function} calculateChunkBoundaries - Function to calculate chunk boundaries
 */

/**
 * Get chunk strategy implementation by type
 * @param {string} type - Strategy type: 'duration-based', 'size-based', or 'count-based'
 * @param {Object} config - Strategy configuration
 * @returns {ChunkStrategy|null} Strategy implementation or null if type not recognized
 */
function getChunkStrategy(type, config = {}) {
  switch (type) {
    case 'duration-based':
      return durationBased;
    case 'size-based':
      return sizeBased;
    case 'count-based':
      return countBased;
    default:
      console.error(`❌ Unknown chunk strategy type: ${type}`);
      return null;
  }
}

module.exports = {
  getChunkStrategy
};
