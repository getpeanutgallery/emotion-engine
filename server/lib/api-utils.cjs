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
 * @returns {Promise<{success: boolean, data?: object, error?: string}>} - Result object with success flag
 * 
 * @example
 * const response = await fetch('https://api.example.com/data');
 * const result = await validateJSON(response);
 * if (!result.success) { console.error(result.error); }
 */
async function validateJSON(response) {
  // Handle null/undefined response
  if (!response) {
    return {
      success: false,
      error: 'Invalid response: response is null or undefined'
    };
  }

  // Log response status and headers for debugging
  console.log(`🔍 API Response Status: ${response.status} ${response.statusText}`);
  console.log(`🔍 API Response Headers:`, Object.fromEntries(response.headers.entries()));

  const contentType = response.headers.get('content-type') || '';
  console.log(`🔍 Content-Type: ${contentType || '(none)'}`);

  // Get response text first to handle all cases
  let text;
  try {
    text = await response.text();
  } catch (err) {
    return {
      success: false,
      error: `Failed to read response body: ${err.message}`
    };
  }

  // Log raw response for debugging (truncated if too long)
  const truncatedText = text.length > 500 ? text.substring(0, 500) + '... [truncated]' : text;
  console.log(`🔍 Raw API Response (${text.length} bytes):`, truncatedText);

  // Check for empty response
  if (!text || text.trim() === '') {
    return {
      success: false,
      error: 'Empty response body'
    };
  }

  // Check content-type (warning only, don't fail)
  if (!contentType.includes('application/json')) {
    console.warn(`⚠️  Warning: Response is not JSON (content-type: ${contentType || '(none)'})`);
  }

  // Try to parse JSON
  try {
    const data = JSON.parse(text);
    return {
      success: true,
      data: data
    };
  } catch (error) {
    return {
      success: false,
      error: `JSON parse error: ${error.message}\nResponse body: ${truncatedText}`
    };
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
