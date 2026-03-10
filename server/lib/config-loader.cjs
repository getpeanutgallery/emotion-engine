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
 * - ai must be present with explicit per-operation target chains
 *   - Forbids: config.ai.provider (provider selected via adapter.name per target)
 *   - Forbids: config.ai.model (top-level model)
 *   - Forbids: config.ai.<op>.model (use adapter.model)
 *   - Requires: ai.dialogue.targets[*].adapter.{name,model,params?}
 *   - Requires: ai.music.targets[*].adapter.{name,model,params?}
 *   - Requires: ai.video.targets[*].adapter.{name,model,params?}
 *   - Conditional: ai.recommendation.targets[*].adapter.{name,model,params?} is required when using server/scripts/report/recommendation.cjs
 *   - Optional per operation: ai.<op>.retry.{maxAttempts,backoffMs}
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
    // Check for forbidden top-level model/provider
    if (config.ai.model !== undefined) {
      errors.push('Forbidden "ai.model" - use per-operation targets (ai.dialogue.targets, ai.music.targets, ai.video.targets)');
    }
    if (config.ai.provider !== undefined) {
      errors.push('Forbidden "ai.provider" - use per-target adapter.name (ai.<op>.targets[*].adapter.name)');
    }

    function validateRetry(retry, prefix) {
      if (retry === undefined) return;
      if (typeof retry !== 'object' || retry === null || Array.isArray(retry)) {
        errors.push(`"${prefix}" must be an object when provided`);
        return;
      }

      const allowed = new Set(['maxAttempts', 'backoffMs']);
      for (const k of Object.keys(retry)) {
        if (!allowed.has(k)) {
          errors.push(`Unsupported "${prefix}.${k}" - supported fields: maxAttempts, backoffMs`);
        }
      }

      if (retry.maxAttempts !== undefined && (!Number.isInteger(retry.maxAttempts) || retry.maxAttempts < 1)) {
        errors.push(`"${prefix}.maxAttempts" must be an integer >= 1 when provided`);
      }
      if (retry.backoffMs !== undefined && (!Number.isInteger(retry.backoffMs) || retry.backoffMs < 0)) {
        errors.push(`"${prefix}.backoffMs" must be an integer >= 0 when provided`);
      }
    }

    function validateTargets(opName) {
      const op = config.ai?.[opName];

      // Forbid legacy per-op model key
      if (op?.model !== undefined) {
        errors.push(`Forbidden "ai.${opName}.model" - use ai.${opName}.targets[*].adapter.model`);
      }

      const targets = op?.targets;
      if (!Array.isArray(targets) || targets.length < 1) {
        errors.push(`Missing required "ai.${opName}.targets" (must be a non-empty array)`);
        return;
      }

      for (let i = 0; i < targets.length; i++) {
        const target = targets[i];
        const targetPrefix = `ai.${opName}.targets[${i}]`;

        if (typeof target !== 'object' || target === null || Array.isArray(target)) {
          errors.push(`"${targetPrefix}" must be an object`);
          continue;
        }

        const adapter = target.adapter;
        const adapterPrefix = `${targetPrefix}.adapter`;

        if (typeof adapter !== 'object' || adapter === null || Array.isArray(adapter)) {
          errors.push(`Missing required "${adapterPrefix}" (must be an object)`);
          continue;
        }

        if (typeof adapter.name !== 'string' || adapter.name.trim().length === 0) {
          errors.push(`Missing required "${adapterPrefix}.name" (must be a non-empty string)`);
        }

        if (typeof adapter.model !== 'string' || adapter.model.trim().length === 0) {
          errors.push(`Missing required "${adapterPrefix}.model" (must be a non-empty string)`);
        }

        if (adapter.params !== undefined) {
          // emotion-engine does NOT validate adapter.params contents, but it must be an object if present
          if (typeof adapter.params !== 'object' || adapter.params === null || Array.isArray(adapter.params)) {
            errors.push(`"${adapterPrefix}.params" must be an object when provided`);
          }
        }
      }

      validateRetry(op?.retry, `ai.${opName}.retry`);
    }

    validateTargets('dialogue');
    validateTargets('music');
    validateTargets('video');

    // Optional: dialogue stitcher is phase1-only and used when dialogue chunking is triggered.
    // Validate only when configured explicitly.
    if (config.ai?.dialogue_stitch !== undefined) {
      validateTargets('dialogue_stitch');
    }

    // Recommendation is phase3-only. If the recommendation report script is present, require explicit ai.recommendation.targets.
    const reportScripts = getScriptsFromPhase(config.report);
    const usesRecommendationScript = reportScripts.some((s) => {
      const p = (s && typeof s.script === 'string') ? s.script : '';
      return p.endsWith('/recommendation.cjs') || p === 'server/scripts/report/recommendation.cjs' || p.includes('scripts/report/recommendation.cjs');
    });

    if (usesRecommendationScript) {
      validateTargets('recommendation');
    } else if (config.ai?.recommendation !== undefined) {
      // If configured but unused, still validate its shape.
      validateTargets('recommendation');
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
