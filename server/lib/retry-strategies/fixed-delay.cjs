#!/usr/bin/env node
/**
 * Fixed-Delay Retry Strategy
 * Retries the function with a fixed delay between attempts
 * 
 * Usage:
 *   const strategy = require('./retry-strategies/fixed-delay.cjs');
 *   const result = await strategy.execute(
 *     async () => { /* operation *\/ },
 *     { operation: 'api-call' },
 *     { maxRetries: 3, delayMs: 1000 }
 *   );
 */

/**
 * @typedef {Object} RetryContext
 * @property {string} operation - Name of the operation being retried
 * @property {number} [chunkIndex] - Optional chunk index for context
 * @property {Record<string, any>} [metadata] - Additional metadata for logging
 */

/**
 * @typedef {Object} FixedDelayConfig
 * @property {number} maxRetries - Maximum number of retry attempts
 * @property {number} delayMs - Fixed delay in milliseconds between retries
 */

/**
 * Sleep for specified duration
 * @param {number} ms - Duration in milliseconds
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Execute function with fixed-delay retry logic
 * @param {Function} fn - Async function to execute
 * @param {RetryContext} context - Context metadata for logging
 * @param {FixedDelayConfig} config - Retry configuration
 * @returns {Promise<any>} Result of the function
 * @throws {Error} Throws error after max retries exceeded
 */
async function execute(fn, context = {}, config = {}) {
  const { operation = 'unknown', chunkIndex, metadata = {} } = context;
  const { maxRetries = 3, delayMs = 1000 } = config;
  
  const contextStr = chunkIndex !== undefined 
    ? `${operation} (chunk ${chunkIndex})`
    : operation;
  
  let lastError;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      if (attempt > 0) {
        console.debug(`🔄 [fixed-delay] Retry ${attempt}/${maxRetries} for ${contextStr} after ${delayMs}ms delay`);
        await sleep(delayMs);
      } else {
        console.debug(`🔄 [fixed-delay] Executing ${contextStr} (attempt 1/${maxRetries + 1})`);
      }
      
      const result = await fn();
      console.debug(`✅ [fixed-delay] ${contextStr} completed successfully on attempt ${attempt + 1}`);
      return result;
    } catch (error) {
      lastError = error;
      console.error(`❌ [fixed-delay] ${contextStr} attempt ${attempt + 1} failed: ${error.message}`);
      
      if (attempt === maxRetries) {
        console.error(`❌ [fixed-delay] ${contextStr} failed after ${maxRetries + 1} attempts`);
        throw error;
      }
    }
  }
  
  // Should never reach here, but TypeScript might complain
  throw lastError;
}

module.exports = {
  execute
};
