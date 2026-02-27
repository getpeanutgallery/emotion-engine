/**
 * Enhanced OpenRouter API Client
 * With retry logic, better error handling, and vision model support
 * 
 * @module lib/openrouter-enhanced
 * @author Cookie (OpenClaw)
 * @version 0.2.0
 */

const https = require('https');

/**
 * Model definitions with pricing and capabilities
 */
const MODELS = {
    'kimi-2.5-vision': {
        id: 'moonshotai/kimi-k2.5',
        name: 'Kimi K2.5',
        vision: true,
        contextWindow: 256000,
        pricing: { prompt: 0.5, completion: 2.0 }, // per 1M tokens
        bestFor: 'Vision tasks, long context'
    },
    'claude-3.5-sonnet': {
        id: 'anthropic/claude-3.5-sonnet',
        name: 'Claude 3.5 Sonnet',
        vision: true,
        contextWindow: 200000,
        pricing: { prompt: 3.0, completion: 15.0 },
        bestFor: 'Complex reasoning, analysis'
    },
    'gpt-4o': {
        id: 'openai/gpt-4o',
        name: 'GPT-4o',
        vision: true,
        contextWindow: 128000,
        pricing: { prompt: 2.5, completion: 10.0 },
        bestFor: 'General purpose, fast'
    },
    'llama-3.2-vision': {
        id: 'meta-llama/llama-3.2-90b-vision-instruct',
        name: 'Llama 3.2 Vision',
        vision: true,
        contextWindow: 128000,
        pricing: { prompt: 0.9, completion: 0.9 },
        bestFor: 'Open source vision, balanced cost'
    }
};

/**
 * OpenRouter API Client (Enhanced)
 */
class OpenRouterClient {
    /**
     * Create client instance
     * @param {Object} config - Client configuration
     * @param {string} config.apiKey - OpenRouter API key
     * @param {string} [config.baseUrl='https://openrouter.ai/api/v1'] - API base URL
     * @param {string} [config.defaultModel='kimi-2.5-vision'] - Default model
     * @param {number} [config.maxRetries=3] - Max retry attempts
     * @param {number} [config.timeout=60000] - Request timeout (ms)
     */
    constructor(config) {
        this.apiKey = config.apiKey;
        this.baseUrl = config.baseUrl || 'https://openrouter.ai/api/v1';
        this.defaultModel = config.defaultModel || 'kimi-2.5-vision';
        this.maxRetries = config.maxRetries || 3;
        this.timeout = config.timeout || 60000;
    }
    
    /**
     * Get model information
     * @param {string} modelKey - Model key (e.g., 'kimi-2.5-vision')
     * @returns {Object} Model info
     */
    getModelInfo(modelKey) {
        return MODELS[modelKey] || MODELS[this.defaultModel];
    }
    
    /**
     * Calculate estimated cost for request
     * @param {string} modelKey - Model key
     * @param {number} inputTokens - Estimated input tokens
     * @param {number} outputTokens - Estimated output tokens
     * @returns {number} Estimated cost in USD
     */
    estimateCost(modelKey, inputTokens, outputTokens) {
        const model = this.getModelInfo(modelKey);
        const inputCost = (inputTokens / 1000000) * model.pricing.prompt;
        const outputCost = (outputTokens / 1000000) * model.pricing.completion;
        return inputCost + outputCost;
    }
    
    /**
     * Complete a chat request with retry logic
     * @param {Object} params - Request parameters
     * @param {string} [params.model] - Model identifier
     * @param {Array} params.messages - Chat messages
     * @param {Object} [params.response_format] - Response format
     * @param {number} [params.temperature=0.7] - Temperature (0-2)
     * @param {number} [params.max_tokens=4096] - Max tokens
     * @returns {Promise<Object>} API response
     */
    async complete(params) {
        const model = params.model || this.defaultModel;
        const modelInfo = this.getModelInfo(model);
        
        const requestBody = {
            model: modelInfo.id,
            messages: params.messages,
            temperature: params.temperature ?? 0.7,
            max_tokens: params.max_tokens || 4096,
            ...(params.response_format && { response_format: params.response_format })
        };
        
        let lastError;
        
        for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
            try {
                const result = await this.makeRequest('/chat/completions', requestBody);
                
                // Add cost estimation to result
                if (result.usage) {
                    result.estimatedCost = this.estimateCost(
                        model,
                        result.usage.prompt_tokens,
                        result.usage.completion_tokens
                    );
                }
                
                return result;
            } catch (error) {
                lastError = error;
                
                // Don't retry on certain errors
                if (error.message.includes('401')) {
                    throw new Error('Invalid API key');
                }
                if (error.message.includes('429')) {
                    console.log(`⏳ Rate limited, waiting before retry ${attempt}...`);
                    await sleep(2000 * attempt);
                } else {
                    console.log(`⚠️  Request failed (attempt ${attempt}/${this.maxRetries}): ${error.message}`);
                    if (attempt < this.maxRetries) {
                        await sleep(1000 * attempt);
                    }
                }
            }
        }
        
        throw lastError;
    }
    
    /**
     * Evaluate a video frame for emotional content
     * @param {Object} params - Evaluation parameters
     * @param {string} params.base64Image - Base64 encoded JPEG
     * @param {string} params.timestamp - Video timestamp (ms)
     * @param {string} [params.model] - Model to use
     * @param {Object} params.persona - Persona configuration
     * @param {string[]} [params.lenses] - Emotion lenses to evaluate
     * @returns {Promise<Object>} Evaluation result
     */
    async evaluateFrame(params) {
        const { base64Image, timestamp, persona, lenses = ['patience', 'boredom', 'excitement'] } = params;
        
        const prompt = this.buildEvaluationPrompt(persona, lenses, timestamp);
        
        const messages = [
            {
                role: 'system',
                content: persona.systemPrompt || this.getDefaultSystemPrompt(persona)
            },
            {
                role: 'user',
                content: [
                    { type: 'text', text: prompt },
                    {
                        type: 'image_url',
                        image_url: {
                            url: `data:image/jpeg;base64,${base64Image}`,
                            detail: 'high'
                        }
                    }
                ]
            }
        ];
        
        const result = await this.complete({
            model: params.model,
            messages,
            response_format: { type: 'json_object' },
            temperature: 0.3 // Lower temperature for consistent scoring
        });
        
        // Parse the JSON response
        try {
            let content = result.choices[0].message.content;
            
            // Clean up markdown code blocks if present
            content = content.replace(/```json\s*/g, '');
            content = content.replace(/```\s*/g, '');
            content = content.trim();
            
            const scores = JSON.parse(content);
            return {
                timestamp,
                scores,
                model: result.model,
                usage: result.usage,
                cost: result.estimatedCost,
                raw: result
            };
        } catch (e) {
            throw new Error(`Failed to parse LLM response: ${e.message}. Raw: ${result.choices[0].message.content.substring(0, 200)}`);
        }
    }
    
    /**
     * Build evaluation prompt
     * @private
     */
    buildEvaluationPrompt(persona, lenses, timestamp) {
        const lensDescriptions = {
            patience: 'How patient is the viewer at this moment? (1-10, 10 = very patient)',
            boredom: 'How bored is the viewer? (1-10, 10 = extremely bored)',
            excitement: 'How excited/engaged is the viewer? (1-10, 10 = extremely excited)',
            frustration: 'How frustrated is the viewer? (1-10, 10 = extremely frustrated)',
            clarity: 'How clear/understandable is the content? (1-10, 10 = very clear)',
            trust: 'How much trust does the viewer feel? (1-10, 10 = complete trust)',
            skepticism: 'How skeptical/doubtful is the viewer? (1-10, 10 = extremely skeptical)',
            anxiety: 'How anxious/worried is the viewer? (1-10, 10 = extreme anxiety)',
            empowerment: 'How empowered/in-control does the viewer feel? (1-10, 10 = fully empowered)',
            confidence: 'How confident is the viewer in what they are seeing? (1-10, 10 = very confident)'
        };
        
        const activeLenses = lenses.map(l => `- ${l}: ${lensDescriptions[l] || l}`).join('\n');
        
        return `Evaluate this video frame from the perspective of: ${persona.name}

Persona: ${persona.description}
Core Conflict: ${persona.conflict}

Rate these emotional dimensions (1-10 scale):
${activeLenses}

Timestamp: ${(timestamp / 1000).toFixed(1)}s

Respond with ONLY a JSON object containing the scores. Example:
{
  "patience": 3,
  "boredom": 8,
  "excitement": 4,
  "rationale": "Brief explanation of why these scores"
}`;
    }
    
    /**
     * Get default system prompt for persona
     * @private
     */
    getDefaultSystemPrompt(persona) {
        return `You are ${persona.name}. ${persona.description}

You must be brutally honest and critical in your evaluations. Your persona represents a real user who would quickly abandon content that doesn't meet their expectations.

Rules:
- Rate 1-10 scale where 5 is neutral
- Be specific about what would make you scroll away
- Consider visual pacing, content clarity, and emotional impact
- Never be artificially positive`;
    }
    
    /**
     * Make HTTPS request to OpenRouter with timeout
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
                        reject(new Error(`Invalid JSON response: ${data.substring(0, 200)}`));
                    }
                });
            });
            
            req.on('error', (error) => {
                reject(error);
            });
            
            // Set timeout
            req.setTimeout(this.timeout, () => {
                req.destroy();
                reject(new Error('Request timeout'));
            });
            
            req.write(JSON.stringify(body));
            req.end();
        });
    }
}

/**
 * Sleep utility
 */
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = { OpenRouterClient, MODELS };
