/**
 * API Utilities for Emotion Engine
 * Provides retry logic, JSON validation, and rate limit handling
 */

/**
 * Fetch with exponential backoff retry logic
 * @param {string} url - The URL to fetch
 * @param {object} [options={}] - Fetch options
 * @param {object} [config={}] - Retry configuration
 * @param {number} [config.maxRetries=3] - Maximum number of retry attempts
 * @param {number} [config.baseDelay=1000] - Base delay in milliseconds
 * @param {number} [config.maxDelay=10000] - Maximum delay in milliseconds
 * @returns {Promise<Response>} - The fetch response
 * @throws {Error} - Throws error if all retries fail
 * 
 * @example
 * const response = await fetchWithRetry('https://api.example.com/data', {
 *   method: 'POST',
 *   headers: { 'Content-Type': 'application/json' }
 * }, { maxRetries: 5, baseDelay: 500 });
 */
async function fetchWithRetry(url, options = {}, config = {}) {
  const {
    maxRetries = 3,
    baseDelay = 1000,
    maxDelay = 10000
  } = config;

  let lastError;
  let delay = baseDelay;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);

      // Handle 429 rate limit
      if (response.status === 429) {
        const retryAfter = response.headers.get('Retry-After');
        if (retryAfter) {
          // Parse Retry-After header (seconds or HTTP date)
          const retryDelay = parseInt(retryAfter, 10) * 1000 || baseDelay;
          console.warn(`Rate limited. Waiting ${retryDelay}ms before retry...`);
          await sleep(retryDelay);
          continue;
        }
      }

      // Return successful responses
      if (response.ok) {
        return response;
      }

      // For non-429 errors, throw immediately
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);

    } catch (error) {
      lastError = error;

      // Don't retry on the last attempt
      if (attempt === maxRetries) {
        break;
      }

      // Apply exponential backoff with jitter
      const jitter = Math.random() * 0.1 * delay;
      const waitTime = Math.min(delay + jitter, maxDelay);

      console.warn(`Attempt ${attempt + 1}/${maxRetries + 1} failed. Retrying in ${Math.round(waitTime)}ms...`);
      await sleep(waitTime);

      // Exponential backoff: double the delay
      delay = Math.min(delay * 2, maxDelay);
    }
  }

  throw new Error(`Failed after ${maxRetries + 1} attempts: ${lastError.message}`);
}

/**
 * Safely validate and parse JSON from a response
 * @param {Response} response - The fetch response to parse
 * @returns {Promise<object>} - The parsed JSON data
 * @throws {Error} - Throws error with details if parsing fails
 * 
 * @example
 * const response = await fetch('https://api.example.com/data');
 * const data = await validateJSON(response);
 */
async function validateJSON(response) {
  if (!response) {
    throw new Error('Invalid response: response is null or undefined');
  }

  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    throw new Error(`Invalid content-type: ${contentType || '(none)'}`);
  }

  const text = await response.text();

  if (!text || text.trim() === '') {
    throw new Error('Empty response body');
  }

  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(`JSON parse error: ${error.message}. Body: ${text.substring(0, 200)}${text.length > 200 ? '...' : ''}`);
  }
}

/**
 * Sleep for a specified duration
 * @param {number} ms - Duration in milliseconds
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = {
  fetchWithRetry,
  validateJSON
};
