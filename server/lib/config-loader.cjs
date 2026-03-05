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
