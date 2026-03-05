#!/usr/bin/env node
/**
 * Retry Strategy Factory
 * Returns appropriate retry strategy implementation based on type
 * 
 * Usage:
 *   const strategy = require('./lib/retry-strategy.cjs');
 *   const retryStrategy = strategy.getRetryStrategy('exponential-backoff', { maxRetries: 3, initialDelayMs: 1000 });
 *   const result = await retryStrategy.execute(async () => { /* operation *\/ }, { operation: 'api-call' });
 */

const noRetry = require('./retry-strategies/no-retry.cjs');
const fixedDelay = require('./retry-strategies/fixed-delay.cjs');
const exponentialBackoff = require('./retry-strategies/exponential-backoff.cjs');
const adaptive = require('./retry-strategies/adaptive.cjs');

/**
 * @typedef {Object} RetryContext
 * @property {string} operation - Name of the operation being retried
 * @property {number} [chunkIndex] - Optional chunk index for context
 * @property {Record<string, any>} [metadata] - Additional metadata for logging
 */

/**
 * @typedef {Object} RetryStrategy
 * @property {Function} execute - Function to execute with retry logic
 */

/**
 * Get retry strategy implementation by type
 * @param {string} type - Strategy type: 'none', 'fixed-delay', 'exponential-backoff', or 'adaptive'
 * @param {Object} config - Strategy configuration
 * @returns {RetryStrategy|null} Strategy implementation or null if type not recognized
 */
function getRetryStrategy(type, config = {}) {
  switch (type) {
    case 'none':
      return noRetry;
    case 'fixed-delay':
      return fixedDelay;
    case 'exponential-backoff':
      return exponentialBackoff;
    case 'adaptive':
      return adaptive;
    default:
      console.error(`❌ Unknown retry strategy type: ${type}`);
      return null;
  }
}

module.exports = {
  getRetryStrategy
};
