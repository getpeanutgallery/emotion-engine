#!/usr/bin/env node
/**
 * Adaptive Retry Strategy (Stub)
 * Placeholder for future adaptive retry logic
 * Currently delegates to exponential-backoff strategy
 * 
 * TODO: Implement adaptive logic that adjusts retry parameters based on:
 * - Error type (transient vs permanent)
 * - System load
 * - Historical success rates
 * - Time of day
 * 
 * Usage:
 *   const strategy = require('./retry-strategies/adaptive.cjs');
 *   const result = await strategy.execute(
 *     async () => { /* operation *\/ },
 *     { operation: 'api-call' },
 *     { maxRetries: 3, initialDelayMs: 1000 }
 *   );
 */

const exponentialBackoff = require('./exponential-backoff.cjs');

/**
 * @typedef {Object} RetryContext
 * @property {string} operation - Name of the operation being retried
 * @property {number} [chunkIndex] - Optional chunk index for context
 * @property {Record<string, any>} [metadata] - Additional metadata for logging
 */

/**
 * @typedef {Object} AdaptiveConfig
 * @property {number} maxRetries - Maximum number of retry attempts
 * @property {number} initialDelayMs - Initial delay in milliseconds
 * @property {number} maxDelayMs - Maximum delay cap in milliseconds
 * @property {number} exponentialBase - Base for exponential calculation
 * @property {boolean} jitter - Whether to add random jitter
 */

/**
 * Execute function with adaptive retry logic (currently delegates to exponential-backoff)
 * @param {Function} fn - Async function to execute
 * @param {RetryContext} context - Context metadata for logging
 * @param {AdaptiveConfig} config - Retry configuration
 * @returns {Promise<any>} Result of the function
 * @throws {Error} Throws error after max retries exceeded
 */
async function execute(fn, context = {}, config = {}) {
  const { operation = 'unknown', chunkIndex, metadata = {} } = context;
  
  const contextStr = chunkIndex !== undefined 
    ? `${operation} (chunk ${chunkIndex})`
    : operation;
  
  console.debug(`⚠️  [adaptive] Adaptive strategy not yet implemented, delegating to exponential-backoff for ${contextStr}`);
  
  // TODO: Implement adaptive logic here
  // For now, delegate to exponential-backoff
  return exponentialBackoff.execute(fn, context, config);
}

module.exports = {
  execute
};
