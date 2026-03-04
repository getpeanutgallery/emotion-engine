#!/usr/bin/env node
/**
 * OpenAI AI Provider Implementation
 * 
 * Implements the AI Provider Interface for OpenAI API.
 * Supports GPT-4, GPT-4 Turbo, GPT-3.5 Turbo, and other OpenAI models.
 * 
 * @module ai-providers/providers/openai
 */

const axios = require('axios');
const { processAttachment } = require('../utils/file-utils.cjs');

/**
 * Provider name identifier
 * @type {string}
 */
const name = 'openai';

/**
 * Default base URL for OpenAI API
 * @type {string}
 */
const DEFAULT_BASE_URL = 'https://api.openai.com/v1';

/**
 * Execute AI completion request via OpenAI
 * 
 * @async
 * @function complete
 * @param {Object} options - Completion options
 * @param {string | Array} options.prompt - User prompt (can be text or messages array)
 * @param {string} options.model - Model identifier (e.g., 'gpt-4-turbo', 'gpt-3.5-turbo')
 * @param {string} options.apiKey - OpenAI API key
 * @param {string} [options.baseUrl] - API base URL (defaults to OpenAI)
 * @param {Array} [options.attachments] - Multi-modal attachments (images for GPT-4 Vision)
 * @param {Object} [options.options] - Additional OpenAI-specific options
 * @param {number} [options.options.temperature] - Sampling temperature (0-2)
 * @param {number} [options.options.maxTokens] - Max output tokens
 * @returns {Promise<Object>} - Completion result
 * @returns {string} return.content - Generated content
 * @returns {Object} return.usage - Token usage
 * @returns {number} return.usage.input - Input tokens
 * @returns {number} return.usage.output - Output tokens
 * 
 * @example
 * // Text-only request
 * const response = await openai.complete({
 *   prompt: 'Analyze this video chunk for emotional content...',
 *   model: 'gpt-4-turbo',
 *   apiKey: process.env.OPENAI_API_KEY,
 *   options: {
 *     temperature: 0.7,
 *     maxTokens: 2048
 *   }
 * });
 * 
 * // Multi-modal request with images (GPT-4 Vision)
 * const response = await openai.complete({
 *   prompt: 'Describe this image',
 *   model: 'gpt-4-turbo',
 *   apiKey: process.env.OPENAI_API_KEY,
 *   attachments: [
 *     {
 *       type: 'image',
 *       path: '/path/to/image.jpg',
 *       mimeType: 'image/jpeg'
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
    throw new Error('OpenAI: prompt is required');
  }
  
  if (!model) {
    throw new Error('OpenAI: model is required');
  }
  
  if (!apiKey) {
    throw new Error('OpenAI: apiKey is required');
  }

  // Build content array - support text + attachments
  const contentParts = [];
  
  // Add text prompt
  if (prompt && typeof prompt === 'string') {
    contentParts.push({ type: 'text', text: prompt });
  }
  
  // Add attachments (multi-modal support - three patterns: URL, path, data)
  if (attachments && attachments.length > 0) {
    for (const attachment of attachments) {
      // Process attachment (handles URL, path, or data patterns)
      const processed = await processAttachment(attachment);
      const { type, mimeType, isUrl, base64Data, url } = processed;
      
      // Handle different attachment types
      if (type === 'image') {
        // OpenAI supports images via URL or base64 data URI
        if (isUrl) {
          contentParts.push({
            type: 'image_url',
            image_url: { url }
          });
        } else {
          // Base64 data (from path or direct data)
          contentParts.push({
            type: 'image_url',
            image_url: { url: `data:${mimeType};base64,${base64Data}` }
          });
        }
      } else if (type === 'video' || type === 'audio') {
        // OpenAI doesn't directly support video/audio in chat completions
        // (GPT-4o can process video frames extracted as images)
        throw new Error(
          `OpenAI: ${type} attachments not directly supported in chat completions. ` +
          'Extract frames as images first, or use a provider like Gemini that supports video/audio natively.'
        );
      } else if (type === 'file') {
        // File attachments via Assistants API (not chat completions)
        throw new Error(
          'OpenAI: File attachments require Assistants API, not chat completions. ' +
          'Use the Assistants API for file uploads, or extract text content and send as text.'
        );
      }
    }
  }

  // Build request body (OpenAI chat completions format)
  const requestBody = {
    model,
    messages: [
      {
        role: 'user',
        content: contentParts.length > 1 ? contentParts : prompt
      }
    ],
  };

  // Add optional parameters
  if (providerOptions.temperature !== undefined) {
    requestBody.temperature = providerOptions.temperature;
  }
  
  if (providerOptions.maxTokens) {
    requestBody.max_tokens = providerOptions.maxTokens;
  }

  // Build headers
  const headers = {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  };

  try {
    const response = await axios.post(
      `${baseUrl}/chat/completions`,
      requestBody,
      { headers }
    );

    // Extract content and usage from response
    const content = response.data.choices?.[0]?.message?.content;
    const usage = response.data.usage || {
      prompt_tokens: 0,
      completion_tokens: 0,
      total_tokens: 0
    };

    if (!content) {
      throw new Error('OpenAI: No content in response');
    }

    return {
      content,
      usage: {
        input: usage.prompt_tokens || 0,
        output: usage.completion_tokens || 0,
        total: usage.total_tokens || 0
      }
    };
  } catch (error) {
    // Enhance error message with context
    if (error.response) {
      const status = error.response.status;
      const data = error.response.data;
      
      if (status === 401) {
        throw new Error('OpenAI: Invalid API key (401 Unauthorized)');
      }
      
      if (status === 429) {
        throw new Error('OpenAI: Rate limit exceeded (429 Too Many Requests)');
      }
      
      if (status === 400) {
        throw new Error(`OpenAI: Bad request - ${data?.error?.message || 'Invalid parameters'}`);
      }
      
      if (status >= 500) {
        throw new Error(`OpenAI: Server error (${status})`);
      }
      
      throw new Error(`OpenAI API error (${status}): ${JSON.stringify(data)}`);
    }
    
    throw new Error(`OpenAI request failed: ${error.message}`);
  }
}

/**
 * Validate OpenAI provider configuration
 * 
 * @function validate
 * @param {Object} config - Provider configuration
 * @param {string} [config.apiKey] - OpenAI API key
 * @param {string} [config.baseUrl] - API base URL (optional)
 * @returns {boolean} - True if valid
 * @throws {Error} - If configuration is invalid
 * 
 * @example
 * openai.validate({
 *   apiKey: process.env.OPENAI_API_KEY
 * });
 * // Returns: true (or throws error)
 */
function validate(config) {
  if (!config) {
    throw new Error('OpenAI: Configuration object is required');
  }
  
  if (!config.apiKey) {
    throw new Error('OpenAI: API key is required. Set OPENAI_API_KEY environment variable.');
  }
  
  // Validate API key format (OpenAI keys start with 'sk-')
  if (typeof config.apiKey !== 'string' || !config.apiKey.startsWith('sk-')) {
    console.warn('OpenAI: API key format looks incorrect (should start with sk-)');
  }
  
  // Validate base URL if provided
  if (config.baseUrl && typeof config.baseUrl !== 'string') {
    throw new Error('OpenAI: baseUrl must be a string');
  }
  
  return true;
}

module.exports = {
  name,
  complete,
  validate,
};
