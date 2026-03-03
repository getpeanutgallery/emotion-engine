/**
 * OpenRouter API Client
 * OpenTruth Emotion Engine — Lambda Layer
 * 
 * @module lib/openrouter
 * @author Cookie (OpenClaw)
 * @version 0.1.0
 */

const https = require('https');

/**
 * OpenRouter API Client
 */
class OpenRouterClient {
    /**
     * Create client instance
     * @param {Object} config - Client configuration
     * @param {string} config.apiKey - OpenRouter API key
     * @param {string} [config.baseUrl='https://openrouter.ai/api/v1'] - API base URL
     * @param {string} [config.defaultModel='kimi-2.5-vision'] - Default model
     */
    constructor(config) {
        this.apiKey = config.apiKey;
        this.baseUrl = config.baseUrl || 'https://openrouter.ai/api/v1';
        this.defaultModel = config.defaultModel || 'kimi-2.5-vision';
    }
    
    /**
     * Complete a chat request
     * @param {Object} params - Request parameters
     * @param {string} [params.model] - Model identifier
     * @param {Array} params.messages - Chat messages
     * @param {Object} [params.response_format] - Response format
     * @returns {Promise<Object>} API response
     */
    async complete(params) {
        const model = params.model || this.defaultModel;
        
        const requestBody = {
            model: model,
            messages: params.messages,
            response_format: params.response_format
        };
        
        return this.makeRequest('/chat/completions', requestBody);
    }
    
    /**
     * Make HTTPS request to OpenRouter
     * @param {string} endpoint - API endpoint
     * @param {Object} body - Request body
     * @returns {Promise<Object>} Response data
     * @private
     */
    makeRequest(endpoint, body) {
        return new Promise((resolve, reject) => {
            const url = new URL(this.baseUrl + endpoint);
            
            const options = {
                hostname: url.hostname,
                path: url.pathname + url.search,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.apiKey}`,
                    'HTTP-Referer': 'https://opentruth.local',
                    'X-Title': 'OpenTruth Emotion Engine'
                }
            };
            
            const req = https.request(options, (res) => {
                let data = '';
                
                res.on('data', (chunk) => {
                    data += chunk;
                });
                
                res.on('end', () => {
                    try {
                        const parsed = JSON.parse(data);
                        if (res.statusCode >= 200 && res.statusCode < 300) {
                            resolve(parsed);
                        } else {
                            reject(new Error(parsed.error?.message || `HTTP ${res.statusCode}`));
                        }
                    } catch (e) {
                        reject(new Error('Invalid JSON response'));
                    }
                });
            });
            
            req.on('error', (error) => {
                reject(error);
            });
            
            req.write(JSON.stringify(body));
            req.end();
        });
    }
}

module.exports = { OpenRouterClient };
