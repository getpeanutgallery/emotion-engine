#!/usr/bin/env node
/**
 * Config Loader - YAML/JSON Configuration Parser
 * 
 * Loads and validates pipeline configuration files.
 * Supports both YAML and JSON formats.
 * 
 * @module config-loader
 */

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

/**
 * Load configuration from file (YAML or JSON)
 * 
 * @async
 * @function loadConfig
 * @param {string} configPath - Path to config file
 * @returns {Promise<object>} - Parsed configuration object
 * @throws {Error} - If file doesn't exist or invalid format
 * 
 * @example
 * const config = await loadConfig('configs/video-analysis.yaml');
 */
async function loadConfig(configPath) {
  const absolutePath = path.resolve(configPath);
  
  if (!fs.existsSync(absolutePath)) {
    throw new Error(`Config file not found: ${absolutePath}`);
  }
  
  const content = fs.readFileSync(absolutePath, 'utf8');
  const ext = path.extname(absolutePath).toLowerCase();
  
  try {
    if (ext === '.yaml' || ext === '.yml') {
      return yaml.load(content);
    } else if (ext === '.json') {
      return JSON.parse(content);
    } else {
      throw new Error(`Unsupported config file format: ${ext}. Use .yaml, .yml, or .json`);
    }
  } catch (parseError) {
    throw new Error(`Failed to parse config file: ${parseError.message}`);
  }
}

/**
 * Parse configuration string (YAML or JSON)
 * 
 * @function parseConfig
 * @param {string} configString - Configuration content as string
 * @param {string} format - Format type: 'yaml' or 'json'
 * @returns {object} - Parsed configuration object
 * @throws {Error} - If parsing fails
 * 
 * @example
 * const config = parseConfig('name: test\ngather_context: []', 'yaml');
 */
function parseConfig(configString, format = 'yaml') {
  try {
    if (format === 'yaml' || format === 'yml') {
      return yaml.load(configString);
    } else if (format === 'json') {
      return JSON.parse(configString);
    } else {
      throw new Error(`Unsupported format: ${format}. Use 'yaml', 'yml', or 'json'`);
    }
  } catch (parseError) {
    throw new Error(`Failed to parse config: ${parseError.message}`);
  }
}

/**
 * Validate configuration structure
 * 
 * Validation rules:
 * - At least 1 script across all phases (gather_context, process, or report)
 * - If parallel execution, scripts must be in { parallel: [...] } format
 * - asset.inputPath and asset.outputDir are required
 * - ai must be present with provider and explicit domain models
 *   - Requires: config.ai, config.ai.provider
 *   - Forbids: config.ai.model (top-level model)
 *   - Requires: config.ai.dialogue.model, config.ai.music.model, config.ai.video.model
 * - debug keep flags must be booleans when provided
 *   - debug.keepProcessedIntermediates (new, default keep)
 *   - debug.keepProcessedFiles (alias)
 *   - debug.keepTempFiles / debug.keepProcessedAssets (legacy)
 * 
 * @function validateConfig
 * @param {object} config - Configuration object to validate
 * @returns {object} - Validation result: { valid: boolean, errors: string[] }
 * 
 * @example
 * const result = validateConfig(config);
 * if (!result.valid) {
 *   console.error('Validation errors:', result.errors);
 * }
 */
function validateConfig(config) {
  const errors = [];
  
  // Check asset configuration
  if (!config.asset) {
    errors.push('Missing required "asset" configuration');
  } else {
    if (!config.asset.inputPath) {
      errors.push('Missing required "asset.inputPath"');
    }
    if (!config.asset.outputDir) {
      errors.push('Missing required "asset.outputDir"');
    }
  }
  
  // Check AI configuration
  if (!config.ai) {
    errors.push('Missing required "ai" configuration');
  } else {
    // Check for forbidden top-level model
    if (config.ai.model !== undefined) {
      errors.push('Forbidden "ai.model" - use explicit domain models (ai.dialogue.model, ai.music.model, ai.video.model)');
    }
    
    // Require provider
    if (config.ai.provider === undefined) {
      errors.push('Missing required "ai.provider"');
    }
    
    // Require explicit domain models
    if (config.ai.dialogue?.model === undefined) {
      errors.push('Missing required "ai.dialogue.model"');
    }
    if (config.ai.music?.model === undefined) {
      errors.push('Missing required "ai.music.model"');
    }
    if (config.ai.video?.model === undefined) {
      errors.push('Missing required "ai.video.model"');
    }

    const retry = config.ai.video?.retry;
    if (retry !== undefined) {
      if (typeof retry !== 'object' || retry === null || Array.isArray(retry)) {
        errors.push('"ai.video.retry" must be an object when provided');
      } else {
        if (retry.maxAttempts !== undefined && (!Number.isInteger(retry.maxAttempts) || retry.maxAttempts < 1)) {
          errors.push('"ai.video.retry.maxAttempts" must be an integer >= 1 when provided');
        }
        if (retry.backoffMs !== undefined && (!Number.isInteger(retry.backoffMs) || retry.backoffMs < 0)) {
          errors.push('"ai.video.retry.backoffMs" must be an integer >= 0 when provided');
        }

        const retryBooleanFields = ['retryOnParseError', 'retryOnProviderError'];
        for (const field of retryBooleanFields) {
          if (retry[field] !== undefined && typeof retry[field] !== 'boolean') {
            errors.push(`"ai.video.retry.${field}" must be a boolean when provided`);
          }
        }
      }
    }
  }
  
  // Validate debug configuration when provided
  if (config.debug !== undefined) {
    if (typeof config.debug !== 'object' || config.debug === null || Array.isArray(config.debug)) {
      errors.push('"debug" must be an object when provided');
    } else {
      const debugBooleanFields = [
        'captureRaw',
        'keepProcessedIntermediates',
        'keepProcessedFiles',
        'keepTempFiles',
        'keepProcessedAssets'
      ];

      for (const field of debugBooleanFields) {
        if (config.debug[field] !== undefined && typeof config.debug[field] !== 'boolean') {
          errors.push(`"debug.${field}" must be a boolean when provided`);
        }
      }
    }
  }

  // Count scripts across all phases
  let totalScripts = 0;
  
  // Check gather_context phase
  if (config.gather_context) {
    if (Array.isArray(config.gather_context)) {
      totalScripts += config.gather_context.length;
    } else if (typeof config.gather_context === 'object' && config.gather_context.parallel) {
      if (!Array.isArray(config.gather_context.parallel)) {
        errors.push('gather_context.parallel must be an array');
      } else {
        totalScripts += config.gather_context.parallel.length;
      }
    } else {
      errors.push('gather_context must be an array or { parallel: [...] } object');
    }
  }
  
  // Check process phase
  if (config.process) {
    if (Array.isArray(config.process)) {
      totalScripts += config.process.length;
    } else if (typeof config.process === 'object') {
      if (config.process.sequential && Array.isArray(config.process.sequential)) {
        totalScripts += config.process.sequential.length;
      } else if (config.process.parallel && Array.isArray(config.process.parallel)) {
        totalScripts += config.process.parallel.length;
      } else {
        errors.push('process must be an array, { sequential: [...] }, or { parallel: [...] }');
      }
    } else {
      errors.push('process must be an array or object with sequential/parallel');
    }
  }
  
  // Check report phase
  if (config.report) {
    if (Array.isArray(config.report)) {
      totalScripts += config.report.length;
    } else if (typeof config.report === 'object' && config.report.parallel) {
      if (!Array.isArray(config.report.parallel)) {
        errors.push('report.parallel must be an array');
      } else {
        totalScripts += config.report.parallel.length;
      }
    } else {
      errors.push('report must be an array or { parallel: [...] } object');
    }
  }
  
  // Validate at least 1 script exists
  if (totalScripts === 0) {
    errors.push('Pipeline must have at least 1 script across all phases (gather_context, process, or report)');
  }
  
  return {
    valid: errors.length === 0,
    errors,
    totalScripts
  };
}

/**
 * Get script list from phase configuration (handles both array and parallel/sequential formats)
 * 
 * @function getScriptsFromPhase
 * @param {string|array|object} phaseConfig - Phase configuration
 * @returns {array} - Array of script configurations
 * 
 * @example
 * // Array format
 * const scripts = getScriptsFromPhase(['script1.cjs', 'script2.cjs']);
 * 
 * // Parallel format
 * const scripts = getScriptsFromPhase({ parallel: [{ script: 'script1.cjs' }] });
 */
function getScriptsFromPhase(phaseConfig) {
  if (!phaseConfig) {
    return [];
  }
  
  if (Array.isArray(phaseConfig)) {
    // Simple array of script paths
    return phaseConfig.map(script => ({
      script: typeof script === 'string' ? script : script.script,
      ... (typeof script === 'object' ? script : {})
    }));
  }
  
  if (typeof phaseConfig === 'object') {
    if (phaseConfig.parallel && Array.isArray(phaseConfig.parallel)) {
      return phaseConfig.parallel;
    }
    if (phaseConfig.sequential && Array.isArray(phaseConfig.sequential)) {
      return phaseConfig.sequential;
    }
  }
  
  return [];
}

/**
 * Check if phase should run in parallel
 * 
 * @function isParallelPhase
 * @param {string|array|object} phaseConfig - Phase configuration
 * @returns {boolean} - True if parallel execution
 */
function isParallelPhase(phaseConfig) {
  if (!phaseConfig || Array.isArray(phaseConfig)) {
    return false;
  }
  
  if (typeof phaseConfig === 'object') {
    return !!phaseConfig.parallel && Array.isArray(phaseConfig.parallel);
  }
  
  return false;
}

module.exports = {
  loadConfig,
  parseConfig,
  validateConfig,
  getScriptsFromPhase,
  isParallelPhase,
};
