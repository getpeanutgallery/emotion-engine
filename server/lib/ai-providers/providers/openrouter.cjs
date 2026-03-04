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
    
    // Add attachments (multi-modal support)
    if (attachments && attachments.length > 0) {
      for (const attachment of attachments) {
        const { type, path, mimeType } = attachment;
        
        if (!type || !path) {
          throw new Error('OpenRouter: Each attachment must have type and path');
        }
        
        // Handle different attachment types
        if (type === 'image') {
          // Image can be URL or base64
          if (path.startsWith('http://') || path.startsWith('https://')) {
            contentParts.push({
              type: 'image_url',
              image_url: { url: path }
            });
          } else {
            // Local file - read and convert to base64
            const fs = require('fs');
            const base64Data = fs.readFileSync(path).toString('base64');
            const imageMimeType = mimeType || detectMimeType(path, 'image');
            contentParts.push({
              type: 'image_url',
              image_url: { url: `data:${imageMimeType};base64,${base64Data}` }
            });
          }
        } else if (type === 'video' || type === 'audio') {
          // Video/audio via URL (OpenRouter supports video URLs for compatible models)
          if (path.startsWith('http://') || path.startsWith('https://')) {
            contentParts.push({
              type: type === 'video' ? 'video_url' : 'audio_url',
              [`${type}_url`]: { url: path }
            });
          } else {
            // Local file - for now, warn that it needs to be uploaded first
            console.warn(`OpenRouter: Local ${type} file must be uploaded to a URL first. Path: ${path}`);
            // Alternative: could upload to temp storage and use URL
            throw new Error(`OpenRouter: Local ${type} files must be provided as URLs. Upload ${path} first.`);
          }
        } else if (type === 'file') {
          // File attachments (for models that support it)
          if (path.startsWith('http://') || path.startsWith('https://')) {
            contentParts.push({
              type: 'file_url',
              file_url: { url: path }
            });
          } else {
            throw new Error(`OpenRouter: Local file attachments must be provided as URLs. Upload ${path} first.`);
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
 * Detect MIME type from file path
 * @param {string} filePath - File path
 * @param {string} defaultType - Default type if not detected
 * @returns {string} - MIME type
 */
function detectMimeType(filePath, defaultType = 'application/octet-stream') {
  const ext = filePath.split('.').pop().toLowerCase();
  const mimeTypes = {
    // Images
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'gif': 'image/gif',
    'webp': 'image/webp',
    'bmp': 'image/bmp',
    // Video
    'mp4': 'video/mp4',
    'webm': 'video/webm',
    'mov': 'video/quicktime',
    'avi': 'video/x-msvideo',
    // Audio
    'mp3': 'audio/mpeg',
    'wav': 'audio/wav',
    'ogg': 'audio/ogg',
    'm4a': 'audio/mp4',
    // Files
    'pdf': 'application/pdf',
    'txt': 'text/plain',
    'json': 'application/json',
  };
  return mimeTypes[ext] || defaultType;
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
