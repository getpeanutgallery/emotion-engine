/**
 * Model Configuration Manager for Emotion Engine
 * Handles default models, fallbacks, and environment overrides
 */

require('dotenv').config();

const fs = require('fs');
const path = require('path');

/**
 * Path to the models configuration file
 * Can be overridden via MODELS_CONFIG_PATH environment variable
 */
const CONFIG_PATH = process.env.MODELS_CONFIG_PATH || 
  path.resolve(__dirname, '../config/models.json');

/**
 * Cache for loaded configuration
 */
let _configCache = null;

/**
 * Load configuration from file or cache
 * @returns {object} - The models configuration
 * @private
 */
function loadConfig() {
  if (_configCache) {
    return _configCache;
  }

  try {
    const configData = fs.readFileSync(CONFIG_PATH, 'utf8');
    _configCache = JSON.parse(configData);
    return _configCache;
  } catch (error) {
    console.error(`Failed to load models config from ${CONFIG_PATH}:`, error.message);
    // Return defaults if config file is missing
    return getDefaults();
  }
}

/**
 * Get default models for all categories
 * @returns {object} - Default models for dialogue, music, and video
 * 
 * @example
 * const defaults = getDefaults();
 * console.log(defaults.dialogue); // "openai/gpt-audio"
 */
function getDefaults() {
  const config = loadConfig();
  return {
    dialogue: config.dialogue?.default || 'openai/gpt-audio',
    music: config.music?.default || 'openai/gpt-audio',
    video: config.video?.default || 'qwen/qwen3.5-122b-a10b'
  };
}

/**
 * Get fallback chain for a specific category
 * @param {string} category - The model category (dialogue, music, video)
 * @returns {string[]} - Array of fallback model identifiers
 * 
 * @example
 * const fallbacks = getFallbacks('video');
 * // ["kimi/kimi-k2-0905", "alternative/vision-model"]
 */
function getFallbacks(category) {
  const config = loadConfig();
  const categoryConfig = config[category];
  
  if (!categoryConfig) {
    console.warn(`Unknown category: ${category}`);
    return [];
  }

  return categoryConfig.fallbacks || [];
}

/**
 * Get model at a specific position in the fallback chain
 * @param {string} category - The model category (dialogue, music, video)
 * @param {number} [index=0] - Position in chain (0 = default, 1+ = fallbacks)
 * @returns {string|null} - Model identifier or null if index out of range
 * 
 * @example
 * getModel('dialogue', 0); // "openai/gpt-audio" (default)
 * getModel('dialogue', 1); // "openai/whisper-large" (first fallback)
 * getModel('dialogue', 2); // "alternative/audio-model" (second fallback)
 */
function getModel(category, index = 0) {
  const config = loadConfig();
  const categoryConfig = config[category];

  if (!categoryConfig) {
    console.warn(`Unknown category: ${category}`);
    return null;
  }

  // Index 0 = default model
  if (index === 0) {
    return categoryConfig.default;
  }

  // Index 1+ = fallback models
  const fallbackIndex = index - 1;
  const fallbacks = categoryConfig.fallbacks || [];

  if (fallbackIndex >= fallbacks.length) {
    return null;
  }

  return fallbacks[fallbackIndex];
}

/**
 * Get the complete model chain for a category
 * @param {string} category - The model category
 * @returns {string[]} - Array of all models (default + fallbacks)
 * 
 * @example
 * getChain('music');
 * // ["openai/gpt-audio", "alternative/audio-model"]
 */
function getChain(category) {
  const config = loadConfig();
  const categoryConfig = config[category];

  if (!categoryConfig) {
    return [];
  }

  return [categoryConfig.default, ...(categoryConfig.fallbacks || [])];
}

/**
 * Clear the configuration cache (useful for testing or hot reload)
 */
function clearCache() {
  _configCache = null;
}

module.exports = {
  getDefaults,
  getFallbacks,
  getModel,
  getChain,
  clearCache,
  CONFIG_PATH
};
