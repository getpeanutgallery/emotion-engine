/**
 * API Client
 * OpenTruth Emotion Engine — Prototype
 * 
 * @module js/api
 * @author Cookie (OpenClaw)
 * @version 0.1.0
 */

// API Configuration
const API_CONFIG = {
    baseUrl: 'https://api.opentruth.local', // Update with actual Lambda URL
    version: 'v1',
    timeout: 30000
};

/**
 * Build full API URL
 * @param {string} endpoint - API endpoint
 * @returns {string} Full URL
 */
function buildUrl(endpoint) {
    return `${API_CONFIG.baseUrl}/${API_CONFIG.version}${endpoint}`;
}

/**
 * Make API request with timeout
 * @param {string} url - Request URL
 * @param {Object} options - Fetch options
 * @returns {Promise<Response>} Fetch response
 */
async function fetchWithTimeout(url, options = {}) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), API_CONFIG.timeout);
    
    try {
        const response = await fetch(url, {
            ...options,
            signal: controller.signal
        });
        clearTimeout(timeoutId);
        return response;
    } catch (error) {
        clearTimeout(timeoutId);
        if (error.name === 'AbortError') {
            throw new Error('Request timed out');
        }
        throw error;
    }
}

/**
 * Process video frames through Emotion Engine
 * @param {Object} params - Processing parameters
 * @param {string} params.sessionId - Session identifier
 * @param {string} params.personaId - Persona cohort ID
 * @param {Array} params.frames - Array of frame objects {base64, timestamp}
 * @returns {Promise<Object>} Analysis results
 */
export async function processVideo(params) {
    const { sessionId, personaId, frames } = params;
    
    const response = await fetchWithTimeout(buildUrl('/process'), {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-Session-ID': sessionId
        },
        body: JSON.stringify({
            sessionId,
            personaId,
            frames,
            config: {
                lenses: ['patience', 'boredom', 'excitement'],
                model: 'kimi-2.5-vision'
            }
        })
    });
    
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || `HTTP ${response.status}`);
    }
    
    return response.json();
}

/**
 * Get persona definition
 * @param {string} personaId - Persona identifier
 * @returns {Promise<Object>} Persona configuration
 */
export async function getPersona(personaId) {
    const response = await fetchWithTimeout(buildUrl(`/personas/${personaId}`));
    
    if (!response.ok) {
        throw new Error(`Failed to load persona: ${personaId}`);
    }
    
    return response.json();
}

/**
 * Get session results
 * @param {string} sessionId - Session identifier
 * @returns {Promise<Object>} Session results
 */
export async function getSession(sessionId) {
    const response = await fetchWithTimeout(buildUrl(`/sessions/${sessionId}`));
    
    if (!response.ok) {
        throw new Error(`Failed to load session: ${sessionId}`);
    }
    
    return response.json();
}

/**
 * Get wallet balance
 * @param {string} userId - User identifier
 * @returns {Promise<Object>} Wallet information
 */
export async function getWallet(userId) {
    const response = await fetchWithTimeout(buildUrl(`/wallets/${userId}`));
    
    if (!response.ok) {
        throw new Error('Failed to load wallet');
    }
    
    return response.json();
}

/**
 * Create top-up session
 * @param {string} userId - User identifier
 * @param {number} amount - Amount in USD
 * @returns {Promise<Object>} Stripe session
 */
export async function createTopUp(userId, amount) {
    const response = await fetchWithTimeout(buildUrl('/wallet/top-up'), {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            userId,
            amount,
            currency: 'usd'
        })
    });
    
    if (!response.ok) {
        throw new Error('Failed to create top-up session');
    }
    
    return response.json();
}

/**
 * Check API health
 * @returns {Promise<Object>} Health status
 */
export async function healthCheck() {
    const response = await fetchWithTimeout(buildUrl('/health'));
    return response.json();
}

/**
 * Batch process multiple frames
 * @param {Object} params - Batch parameters
 * @param {Array} params.frames - Frame objects
 * @param {string} params.sessionId - Session ID
 * @param {string} params.personaId - Persona ID
 * @returns {Promise<Object>} Batch results
 */
export async function batchProcess(params) {
    const { frames, sessionId, personaId } = params;
    
    // Process in chunks to avoid payload limits
    const chunkSize = 5;
    const results = [];
    
    for (let i = 0; i < frames.length; i += chunkSize) {
        const chunk = frames.slice(i, i + chunkSize);
        const chunkResults = await processVideo({
            sessionId: `${sessionId}-chunk-${i}`,
            personaId,
            frames: chunk
        });
        results.push(...chunkResults.emissions);
    }
    
    return {
        sessionId,
        personaId,
        emissions: results
    };
}

// Export config for debugging
export { API_CONFIG };
