#!/usr/bin/env node
/**
 * Exponential-Backoff Retry Strategy
 * Retries the function with exponential backoff and jitter
 * Prevents thundering herd by adding random jitter (±25%)
 * 
 * Usage:
 *   const strategy = require('./retry-strategies/exponential-backoff.cjs');
 *   const result = await strategy.execute(
 *     async () => { /* operation *\/ },
 *     { operation: 'api-call' },
 *     { maxRetries: 3, initialDelayMs: 1000, maxDelayMs: 30000, exponentialBase: 2, jitter: true }
 *   );
 */

/**
 * @typedef {Object} RetryContext
 * @property {string} operation - Name of the operation being retried
 * @property {number} [chunkIndex] - Optional chunk index for context
 * @property {Record<string, any>} [metadata] - Additional metadata for logging
 */

/**
 * @typedef {Object} ExponentialBackoffConfig
 * @property {number} maxRetries - Maximum number of retry attempts
 * @property {number} initialDelayMs - Initial delay in milliseconds
 * @property {number} maxDelayMs - Maximum delay cap in milliseconds
 * @property {number} exponentialBase - Base for exponential calculation (e.g., 2 for doubling)
 * @property {boolean} jitter - Whether to add random jitter (±25%)
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
 * Calculate delay with optional jitter
 * @param {number} baseDelay - Base delay in milliseconds
 * @param {number} maxDelay - Maximum delay cap
 * @param {boolean} jitter - Whether to add jitter
 * @returns {number} Delay in milliseconds
 */
function calculateDelay(baseDelay, maxDelay, jitter) {
  let delay = Math.min(baseDelay, maxDelay);
  
  if (jitter) {
    // Add ±25% jitter to prevent thundering herd
    const jitterFactor = 0.25;
    const jitterRange = delay * jitterFactor;
    const jitterValue = (Math.random() * 2 - 1) * jitterRange;
    delay = Math.max(0, delay + jitterValue);
  }
  
  return delay;
}

/**
 * Execute function with exponential-backoff retry logic
 * @param {Function} fn - Async function to execute
 * @param {RetryContext} context - Context metadata for logging
 * @param {ExponentialBackoffConfig} config - Retry configuration
 * @returns {Promise<any>} Result of the function
 * @throws {Error} Throws error after max retries exceeded
 */
async function execute(fn, context = {}, config = {}) {
  const { operation = 'unknown', chunkIndex, metadata = {} } = context;
  const { 
    maxRetries = 3, 
    initialDelayMs = 1000, 
    maxDelayMs = 30000, 
    exponentialBase = 2, 
    jitter = true 
  } = config;
  
  const contextStr = chunkIndex !== undefined 
    ? `${operation} (chunk ${chunkIndex})`
    : operation;
  
  let lastError;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      if (attempt > 0) {
        // Calculate exponential backoff: initialDelayMs * exponentialBase^attempt
        const baseDelay = initialDelayMs * Math.pow(exponentialBase, attempt);
        const delay = calculateDelay(baseDelay, maxDelayMs, jitter);
        
        console.debug(`🔄 [exponential-backoff] Retry ${attempt}/${maxRetries} for ${contextStr} after ${Math.round(delay)}ms delay (base: ${Math.round(baseDelay)}ms)`);
        await sleep(delay);
      } else {
        console.debug(`🔄 [exponential-backoff] Executing ${contextStr} (attempt 1/${maxRetries + 1})`);
      }
      
      const result = await fn();
      console.debug(`✅ [exponential-backoff] ${contextStr} completed successfully on attempt ${attempt + 1}`);
      return result;
    } catch (error) {
      lastError = error;
      console.error(`❌ [exponential-backoff] ${contextStr} attempt ${attempt + 1} failed: ${error.message}`);
      
      if (attempt === maxRetries) {
        console.error(`❌ [exponential-backoff] ${contextStr} failed after ${maxRetries + 1} attempts`);
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
