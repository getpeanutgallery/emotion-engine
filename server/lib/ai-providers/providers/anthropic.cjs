#!/usr/bin/env node
/**
 * Anthropic AI Provider Implementation
 * 
 * Implements the AI Provider Interface for Anthropic API (Claude models).
 * Supports all Claude models including Claude 3.5 Sonnet, Claude 3 Opus, etc.
 * 
 * @module ai-providers/providers/anthropic
 */

const axios = require('axios');

/**
 * Provider name identifier
 * @type {string}
 */
const name = 'anthropic';

/**
 * Default base URL for Anthropic API
 * @type {string}
 */
const DEFAULT_BASE_URL = 'https://api.anthropic.com/v1';

/**
 * Execute AI completion request via Anthropic
 * 
 * @async
 * @function complete
 * @param {Object} options - Completion options
 * @param {string | Array} options.prompt - User prompt (can be text or messages array)
 * @param {string} options.model - Model identifier (e.g., 'claude-3-5-sonnet-20241022')
 * @param {string} options.apiKey - Anthropic API key
 * @param {string} [options.baseUrl] - API base URL (defaults to Anthropic)
 * @param {Array} [options.attachments] - Multi-modal attachments (images, documents)
 * @param {Object} [options.options] - Additional Anthropic-specific options
 * @param {number} [options.options.maxTokens] - Max output tokens (default: 4096)
 * @param {number} [options.options.temperature] - Sampling temperature (0-2)
 * @returns {Promise<Object>} - Completion result
 * @returns {string} return.content - Generated content
 * @returns {Object} return.usage - Token usage
 * @returns {number} return.usage.input - Input tokens
 * @returns {number} return.usage.output - Output tokens
 * 
 * @example
 * // Text-only request
 * const response = await anthropic.complete({
 *   prompt: 'Analyze this video chunk for emotional content...',
 *   model: 'claude-3-5-sonnet-20241022',
 *   apiKey: process.env.ANTHROPIC_API_KEY,
 *   options: {
 *     maxTokens: 2048,
 *     temperature: 0.7
 *   }
 * });
 * 
 * // Multi-modal request with images
 * const response = await anthropic.complete({
 *   prompt: 'Describe this image',
 *   model: 'claude-3-5-sonnet-20241022',
 *   apiKey: process.env.ANTHROPIC_API_KEY,
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
    throw new Error('Anthropic: prompt is required');
  }
  
  if (!model) {
    throw new Error('Anthropic: model is required');
  }
  
  if (!apiKey) {
    throw new Error('Anthropic: apiKey is required');
  }

  // Build content array - support text + attachments
  const contentParts = [];
  
  // Add text prompt
  if (prompt && typeof prompt === 'string') {
    contentParts.push({ type: 'text', text: prompt });
  }
  
  // Add attachments (multi-modal support)
  if (attachments && attachments.length > 0) {
    const fs = require('fs');
    
    for (const attachment of attachments) {
      const { type, path, mimeType } = attachment;
      
      if (!type || !path) {
        throw new Error('Anthropic: Each attachment must have type and path');
      }
      
      // Handle different attachment types
      if (type === 'image') {
        // Claude supports images via base64
        const base64Data = fs.readFileSync(path).toString('base64');
        const imageMimeType = mimeType || detectMimeType(path, 'image');
        contentParts.push({
          type: 'image',
          source: {
            type: 'base64',
            media_type: imageMimeType,
            data: base64Data
          }
        });
      } else if (type === 'file') {
        // Claude supports PDF and TXT documents
        const ext = path.split('.').pop().toLowerCase();
        const fileMimeType = mimeType || detectMimeType(path);
        
        if (ext === 'pdf' || ext === 'txt') {
          const fileContent = fs.readFileSync(path);
          const base64Data = fileContent.toString('base64');
          
          contentParts.push({
            type: 'document',
            source: {
              type: 'base64',
              media_type: fileMimeType,
              data: base64Data
            }
          });
        } else {
          throw new Error(`Anthropic: Unsupported file type ${ext}. Supported: pdf, txt`);
        }
      } else if (type === 'video' || type === 'audio') {
        // Claude doesn't directly support video/audio, but can process frames
        console.warn(`Anthropic: ${type} attachments not directly supported. Extract frames first.`);
        throw new Error(`Anthropic: ${type} attachments not directly supported. Extract frames as images first.`);
      }
    }
  }

  // Build request body (Anthropic uses messages format)
  const requestBody = {
    model,
    max_tokens: providerOptions.maxTokens || 4096,
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
  
  if (providerOptions.system) {
    requestBody.system = providerOptions.system;
  }

  // Build headers
  const headers = {
    'x-api-key': apiKey,
    'Content-Type': 'application/json',
    'anthropic-version': '2023-06-01',
  };

  try {
    const response = await axios.post(
      `${baseUrl}/messages`,
      requestBody,
      { headers }
    );

    // Extract content and usage from response
    const content = response.data.content?.[0]?.text;
    const usage = response.data.usage || {
      input_tokens: 0,
      output_tokens: 0
    };

    if (!content) {
      throw new Error('Anthropic: No content in response');
    }

    return {
      content,
      usage: {
        input: usage.input_tokens || 0,
        output: usage.output_tokens || 0,
        total: (usage.input_tokens || 0) + (usage.output_tokens || 0)
      }
    };
  } catch (error) {
    // Enhance error message with context
    if (error.response) {
      const status = error.response.status;
      const data = error.response.data;
      
      if (status === 401) {
        throw new Error('Anthropic: Invalid API key (401 Unauthorized)');
      }
      
      if (status === 429) {
        throw new Error('Anthropic: Rate limit exceeded (429 Too Many Requests)');
      }
      
      if (status === 400) {
        throw new Error(`Anthropic: Bad request - ${data?.error?.message || 'Invalid parameters'}`);
      }
      
      if (status >= 500) {
        throw new Error(`Anthropic: Server error (${status})`);
      }
      
      throw new Error(`Anthropic API error (${status}): ${JSON.stringify(data)}`);
    }
    
    throw new Error(`Anthropic request failed: ${error.message}`);
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
 * Validate Anthropic provider configuration
 * 
 * @function validate
 * @param {Object} config - Provider configuration
 * @param {string} [config.apiKey] - Anthropic API key
 * @param {string} [config.baseUrl] - API base URL (optional)
 * @returns {boolean} - True if valid
 * @throws {Error} - If configuration is invalid
 * 
 * @example
 * anthropic.validate({
 *   apiKey: process.env.ANTHROPIC_API_KEY
 * });
 * // Returns: true (or throws error)
 */
function validate(config) {
  if (!config) {
    throw new Error('Anthropic: Configuration object is required');
  }
  
  if (!config.apiKey) {
    throw new Error('Anthropic: API key is required. Set ANTHROPIC_API_KEY environment variable.');
  }
  
  // Validate API key format (Anthropic keys start with 'sk-ant-')
  if (typeof config.apiKey !== 'string' || !config.apiKey.startsWith('sk-ant-')) {
    console.warn('Anthropic: API key format looks incorrect (should start with sk-ant-)');
  }
  
  // Validate base URL if provided
  if (config.baseUrl && typeof config.baseUrl !== 'string') {
    throw new Error('Anthropic: baseUrl must be a string');
  }
  
  return true;
}

module.exports = {
  name,
  complete,
  validate,
};
