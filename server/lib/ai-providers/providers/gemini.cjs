#!/usr/bin/env node
/**
 * Google Gemini AI Provider Implementation
 * 
 * Implements the AI Provider Interface for Google Gemini API.
 * Supports Gemini 1.5 Pro, Gemini 1.5 Flash, and other Gemini models.
 * 
 * @module ai-providers/providers/gemini
 */

const axios = require('axios');
const { processAttachment } = require('../utils/file-utils.cjs');

/**
 * Provider name identifier
 * @type {string}
 */
const name = 'gemini';

/**
 * Default base URL for Gemini API
 * @type {string}
 */
const DEFAULT_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';

/**
 * Execute AI completion request via Google Gemini
 * 
 * @async
 * @function complete
 * @param {Object} options - Completion options
 * @param {string | Array} options.prompt - User prompt (can be text or messages array)
 * @param {string} options.model - Model identifier (e.g., 'gemini-1.5-pro')
 * @param {string} options.apiKey - Google API key
 * @param {string} [options.baseUrl] - API base URL (defaults to Gemini)
 * @param {Array} [options.attachments] - Multi-modal attachments (images, audio, video)
 * @param {Object} [options.options] - Additional Gemini-specific options
 * @param {number} [options.options.temperature] - Sampling temperature (0-2)
 * @param {number} [options.options.maxOutputTokens] - Max output tokens
 * @returns {Promise<Object>} - Completion result
 * @returns {string} return.content - Generated content
 * @returns {Object} return.usage - Token usage (Gemini doesn't provide usage by default)
 * @returns {number} return.usage.input - Estimated input tokens
 * @returns {number} return.usage.output - Estimated output tokens
 * 
 * @example
 * // Text-only request
 * const response = await gemini.complete({
 *   prompt: 'Analyze this video chunk for emotional content...',
 *   model: 'gemini-1.5-pro',
 *   apiKey: process.env.GEMINI_API_KEY,
 *   options: {
 *     temperature: 0.7,
 *     maxOutputTokens: 2048
 *   }
 * });
 * 
 * // Multi-modal request (Gemini 1.5 supports video, audio, images)
 * const response = await gemini.complete({
 *   prompt: 'Analyze this video',
 *   model: 'gemini-1.5-pro',
 *   apiKey: process.env.GEMINI_API_KEY,
 *   attachments: [
 *     {
 *       type: 'video',
 *       path: 'https://example.com/video.mp4',
 *       mimeType: 'video/mp4'
 *     }
 *   ]
 * });
 */
async function complete(options) {
  const {
    prompt,
    model,
    apiKey,
    baseUrl = DEFAULT_BASE_URL,
    attachments = [],
    options: providerOptions = {}
  } = options;

  // Validate required parameters
  if (!prompt) {
    throw new Error('Gemini: prompt is required');
  }
  
  if (!model) {
    throw new Error('Gemini: model is required');
  }
  
  if (!apiKey) {
    throw new Error('Gemini: apiKey is required');
  }

  // Build contents array with parts
  const parts = [];
  
  // Add text prompt
  if (prompt && typeof prompt === 'string') {
    parts.push({ text: prompt });
  }
  
  // Add attachments (multi-modal support - three patterns: URL, path, data)
  if (attachments && attachments.length > 0) {
    for (const attachment of attachments) {
      // Process attachment (handles URL, path, or data patterns)
      const processed = await processAttachment(attachment);
      const { type, mimeType, isUrl, base64Data, url } = processed;
      
      // Gemini 1.5 supports all types via base64 inline_data
      // For URLs, we fetch and convert to base64
      if (type === 'image' || type === 'video' || type === 'audio' || type === 'file') {
        let dataToUse = base64Data;
        
        // If it's a URL, fetch and convert to base64
        if (isUrl) {
          try {
            const response = await axios.get(url, { responseType: 'arraybuffer' });
            dataToUse = Buffer.from(response.data).toString('base64');
          } catch (error) {
            throw new Error(
              `Gemini: Failed to fetch URL ${url}: ${error.message}. ` +
              'Ensure the URL is publicly accessible.'
            );
          }
        }
        
        parts.push({
          inline_data: {
            mime_type: mimeType,
            data: dataToUse
          }
        });
      }
    }
  }

  // Build request body (Gemini uses contents format)
  const requestBody = {
    contents: [
      {
        parts
      }
    ],
  };

  // Add generation config
  const generationConfig = {};
  
  if (providerOptions.temperature !== undefined) {
    generationConfig.temperature = providerOptions.temperature;
  }
  
  if (providerOptions.maxOutputTokens) {
    generationConfig.maxOutputTokens = providerOptions.maxOutputTokens;
  }
  
  if (Object.keys(generationConfig).length > 0) {
    requestBody.generationConfig = generationConfig;
  }

  // Build URL with API key
  const url = `${baseUrl}/models/${model}:generateContent?key=${apiKey}`;

  // Build headers
  const headers = {
    'Content-Type': 'application/json',
  };

  try {
    const response = await axios.post(url, requestBody, { headers });

    // Extract content from response
    const candidates = response.data.candidates;
    
    if (!candidates || !candidates[0]?.content?.parts?.[0]?.text) {
      throw new Error('Gemini: No content in response');
    }
    
    const content = candidates[0].content.parts[0].text;
    
    // Gemini doesn't always provide usage info, but we can estimate
    const usageMetadata = response.data.usageMetadata || {};
    
    return {
      content,
      usage: {
        input: usageMetadata.promptTokenCount || estimateTokens(prompt),
        output: usageMetadata.candidatesTokenCount || estimateTokens(content),
        total: (usageMetadata.promptTokenCount || 0) + (usageMetadata.candidatesTokenCount || 0)
      }
    };
  } catch (error) {
    // Enhance error message with context
    if (error.response) {
      const status = error.response.status;
      const data = error.response.data;
      
      if (status === 400) {
        throw new Error(`Gemini: Bad request - ${data?.error?.message || 'Invalid parameters'}`);
      }
      
      if (status === 401) {
        throw new Error('Gemini: Invalid API key (401 Unauthorized)');
      }
      
      if (status === 429) {
        throw new Error('Gemini: Rate limit exceeded (429 Too Many Requests)');
      }
      
      if (status >= 500) {
        throw new Error(`Gemini: Server error (${status})`);
      }
      
      throw new Error(`Gemini API error (${status}): ${data?.error?.message || JSON.stringify(data)}`);
    }
    
    throw new Error(`Gemini request failed: ${error.message}`);
  }
}

/**
 * Validate Gemini provider configuration
 * 
 * @function validate
 * @param {Object} config - Provider configuration
 * @param {string} [config.apiKey] - Google API key
 * @param {string} [config.baseUrl] - API base URL (optional)
 * @returns {boolean} - True if valid
 * @throws {Error} - If configuration is invalid
 * 
 * @example
 * gemini.validate({
 *   apiKey: process.env.GEMINI_API_KEY
 * });
 * // Returns: true (or throws error)
 */
function validate(config) {
  if (!config) {
    throw new Error('Gemini: Configuration object is required');
  }
  
  if (!config.apiKey) {
    throw new Error('Gemini: API key is required. Set GEMINI_API_KEY environment variable.');
  }
  
  // Validate API key format (Google API keys are typically 39 chars)
  if (typeof config.apiKey !== 'string' || config.apiKey.length < 20) {
    throw new Error('Gemini: Invalid API key format');
  }
  
  // Validate base URL if provided
  if (config.baseUrl && typeof config.baseUrl !== 'string') {
    throw new Error('Gemini: baseUrl must be a string');
  }
  
  return true;
}

/**
 * Estimate token count from text length
 * Rough approximation: 1 token ≈ 4 characters
 * 
 * @param {string} text - Input text
 * @returns {number} - Estimated token count
 */
function estimateTokens(text) {
  return Math.ceil(text.length / 4);
}

module.exports = {
  name,
  complete,
  validate,
};
