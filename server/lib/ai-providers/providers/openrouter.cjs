#!/usr/bin/env node
/**
 * OpenRouter AI Provider Implementation
 * 
 * Implements the AI Provider Interface for OpenRouter API.
 * Supports all models available on OpenRouter platform.
 * 
 * @module ai-providers/providers/openrouter
 */

const axios = require('axios');
const { processAttachment, detectMimeType } = require('../utils/file-utils.cjs');

/**
 * Provider name identifier
 * @type {string}
 */
const name = 'openrouter';

/**
 * Default base URL for OpenRouter API
 * @type {string}
 */
const DEFAULT_BASE_URL = 'https://openrouter.ai/api/v1';

/**
 * Execute AI completion request via OpenRouter
 * 
 * @async
 * @function complete
 * @param {Object} options - Completion options
 * @param {string | Array} options.prompt - System/user prompt (can be text or messages array)
 * @param {string} options.model - Model identifier (e.g., 'qwen/qwen-3.5-397b-a17b')
 * @param {string} options.apiKey - OpenRouter API key
 * @param {string} [options.baseUrl] - API base URL (defaults to OpenRouter)
 * @param {Array} [options.attachments] - Multi-modal attachments (video, audio, images, files)
 * @param {Object} [options.options] - Additional OpenRouter-specific options
 * @param {string} [options.options.siteUrl] - Site URL for OpenRouter rankings
 * @param {string} [options.options.siteName] - Site name for OpenRouter rankings
 * @returns {Promise<Object>} - Completion result
 * @returns {string} return.content - Generated content
 * @returns {Object} return.usage - Token usage
 * @returns {number} return.usage.input - Input tokens
 * @returns {number} return.usage.output - Output tokens
 * 
 * @example
 * // Text-only request
 * const response = await openrouter.complete({
 *   prompt: 'Analyze this video chunk...',
 *   model: 'qwen/qwen-3.5-397b-a17b',
 *   apiKey: process.env.OPENROUTER_API_KEY,
 * });
 * 
 * // Multi-modal request with attachments
 * const response = await openrouter.complete({
 *   prompt: 'Analyze this video for emotional content',
 *   model: 'openai/gpt-4o',
 *   apiKey: process.env.OPENROUTER_API_KEY,
 *   attachments: [
 *     {
 *       type: 'video',
 *       path: '/path/to/video.mp4',
 *       mimeType: 'video/mp4'
 *     },
 *     {
 *       type: 'image',
 *       path: 'https://example.com/frame.jpg',
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
    throw new Error('OpenRouter: prompt is required');
  }
  
  if (!model) {
    throw new Error('OpenRouter: model is required');
  }
  
  if (!apiKey) {
    throw new Error('OpenRouter: apiKey is required');
  }

  // Build messages array - support both string prompt and messages array
  let messages;
  if (Array.isArray(prompt)) {
    messages = prompt;
  } else {
    // Build content array - text + attachments
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
          // Image: URL or base64 data URI
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
        } else if (type === 'video') {
          // Video: URL only (OpenRouter doesn't support base64 video)
          if (isUrl) {
            contentParts.push({
              type: 'video_url',
              video_url: { url }
            });
          } else {
            // Local file converted to base64 - not supported by OpenRouter
            throw new Error(
              'OpenRouter: Video attachments must be URLs. ' +
              'Local video files must be uploaded to a publicly accessible URL first. ' +
              'Alternatively, extract frames as images and send those.'
            );
          }
        } else if (type === 'audio') {
          // Audio: URL only (OpenRouter doesn't support base64 audio)
          if (isUrl) {
            contentParts.push({
              type: 'audio_url',
              audio_url: { url }
            });
          } else {
            // Local file converted to base64 - not supported by OpenRouter
            throw new Error(
              'OpenRouter: Audio attachments must be URLs. ' +
              'Local audio files must be uploaded to a publicly accessible URL first. ' +
              'Alternatively, use a provider like Gemini that supports base64 audio.'
            );
          }
        } else if (type === 'file') {
          // File attachments: URL only
          if (isUrl) {
            contentParts.push({
              type: 'file_url',
              file_url: { url }
            });
          } else {
            throw new Error(
              'OpenRouter: File attachments must be URLs. ' +
              'Local files must be uploaded to a publicly accessible URL first.'
            );
          }
        }
      }
    }
    
    messages = [
      {
        role: 'user',
        content: contentParts.length > 1 ? contentParts : prompt
      }
    ];
  }

  // Build request body
  const requestBody = {
    model,
    messages,
  };

  // Add optional OpenRouter-specific parameters
  if (providerOptions.siteUrl) {
    requestBody.site_url = providerOptions.siteUrl;
  }
  
  if (providerOptions.siteName) {
    requestBody.site_name = providerOptions.siteName;
  }

  // Build headers
  const headers = {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  };

  // Add HTTP Referer for OpenRouter rankings (optional)
  if (providerOptions.siteUrl) {
    headers['HTTP-Referer'] = providerOptions.siteUrl;
  }

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
      throw new Error('OpenRouter: No content in response');
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
        throw new Error('OpenRouter: Invalid API key (401 Unauthorized)');
      }
      
      if (status === 429) {
        throw new Error('OpenRouter: Rate limit exceeded (429 Too Many Requests)');
      }
      
      if (status >= 500) {
        throw new Error(`OpenRouter: Server error (${status})`);
      }
      
      throw new Error(`OpenRouter API error (${status}): ${JSON.stringify(data)}`);
    }
    
    throw new Error(`OpenRouter request failed: ${error.message}`);
  }
}

/**
 * Validate OpenRouter provider configuration
 * 
 * @function validate
 * @param {Object} config - Provider configuration
 * @param {string} [config.apiKey] - OpenRouter API key
 * @param {string} [config.baseUrl] - API base URL (optional)
 * @returns {boolean} - True if valid
 * @throws {Error} - If configuration is invalid
 * 
 * @example
 * openrouter.validate({
 *   apiKey: process.env.OPENROUTER_API_KEY
 * });
 * // Returns: true (or throws error)
 */
function validate(config) {
  if (!config) {
    throw new Error('OpenRouter: Configuration object is required');
  }
  
  if (!config.apiKey) {
    throw new Error('OpenRouter: API key is required. Set OPENROUTER_API_KEY environment variable.');
  }
  
  // Validate API key format (OpenRouter keys are typically 32+ chars)
  if (typeof config.apiKey !== 'string' || config.apiKey.length < 16) {
    throw new Error('OpenRouter: Invalid API key format');
  }
  
  // Validate base URL if provided
  if (config.baseUrl && typeof config.baseUrl !== 'string') {
    throw new Error('OpenRouter: baseUrl must be a string');
  }
  
  return true;
}

module.exports = {
  name,
  complete,
  validate,
};
