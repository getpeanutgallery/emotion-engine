#!/usr/bin/env node
/**
 * No-Retry Strategy
 * Executes the function once without any retry logic
 * Returns result on success or throws error immediately on failure
 * 
 * Usage:
 *   const strategy = require('./retry-strategies/no-retry.cjs');
 *   const result = await strategy.execute(async () => { /* operation *\/ }, { operation: 'api-call' });
 */

/**
 * @typedef {Object} RetryContext
 * @property {string} operation - Name of the operation being executed
 * @property {number} [chunkIndex] - Optional chunk index for context
 * @property {Record<string, any>} [metadata] - Additional metadata for logging
 */

/**
 * Execute function without retry
 * @param {Function} fn - Async function to execute
 * @param {RetryContext} context - Context metadata for logging
 * @returns {Promise<any>} Result of the function
 * @throws {Error} Re-throws any error from the function
 */
async function execute(fn, context = {}) {
  const { operation = 'unknown', chunkIndex, metadata = {} } = context;
  
  const contextStr = chunkIndex !== undefined 
    ? `${operation} (chunk ${chunkIndex})`
    : operation;
  
  console.debug(`🔄 [no-retry] Executing ${contextStr}`);
  
  try {
    const result = await fn();
    console.debug(`✅ [no-retry] ${contextStr} completed successfully`);
    return result;
  } catch (error) {
    console.error(`❌ [no-retry] ${contextStr} failed: ${error.message}`);
    throw error;
  }
}

module.exports = {
  execute
};
