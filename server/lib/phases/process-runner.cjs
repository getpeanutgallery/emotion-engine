#!/usr/bin/env node
/**
 * Phase 2: Process Runner
 * 
 * Executes processing scripts to analyze and transform artifacts.
 * Supports sequential and parallel execution.
 * 
 * @module phases/process-runner
 */

const { executeScript } = require('../script-runner.cjs');

/**
 * Run Phase 2: Process
 * 
 * Executes 0-N scripts to process artifacts from Phase 1.
 * Scripts can run sequentially (default) or in parallel.
 * 
 * In sequential mode: each script receives accumulated artifacts from previous scripts
 * In parallel mode: all scripts receive base artifacts, outputs merged after
 * 
 * @async
 * @function runProcess
 * @param {object} input - Phase input
 * @param {string} input.assetPath - Path to source asset
 * @param {string} input.outputDir - Output directory
 * @param {object} input.artifacts - Artifacts from Phase 1
 * @param {object} input.config - Pipeline configuration
 * @param {string[]|object} input.scripts - Scripts to run
 * @returns {Promise<object>} - Phase output: { artifacts: object }
 * @throws {Error} - If script execution fails
 * 
 * @example
 * const result = await runProcess({
 *   assetPath: 'video.mp4',
 *   outputDir: 'output',
 *   artifacts: { dialogueData: {...} },
 *   config: { settings: {}, tool_variables: {} },
 *   scripts: ['scripts/process/video-chunks.cjs']
 * });
 */
async function runProcess(input) {
  const {
    assetPath,
    outputDir,
    artifacts = {},
    config,
    scripts
  } = input;
  
  if (!scripts || (Array.isArray(scripts) && scripts.length === 0)) {
    // No scripts to run - return existing artifacts
    return { artifacts };
  }
  
  // Determine execution mode
  let isParallel = false;
  let scriptList = [];
  
  if (Array.isArray(scripts)) {
    // Simple array format (sequential execution)
    scriptList = scripts;
  } else if (typeof scripts === 'object' && scripts !== null) {
    if (scripts.parallel && Array.isArray(scripts.parallel)) {
      isParallel = true;
      scriptList = scripts.parallel;
    } else if (scripts.sequential && Array.isArray(scripts.sequential)) {
      scriptList = scripts.sequential;
    }
  }
  
  if (scriptList.length === 0) {
    return { artifacts };
  }
  
  console.log(`⚙️  Phase 2: Process (${isParallel ? 'parallel' : 'sequential'}, ${scriptList.length} script(s))`);
  
  let phaseArtifacts = { ...artifacts };
  
  if (isParallel) {
    // Parallel execution: all scripts receive base artifacts
    phaseArtifacts = await runParallelScripts(scriptList, {
      assetPath,
      outputDir,
      artifacts,
      config
    });
  } else {
    // Sequential execution: each script receives accumulated artifacts
    for (const scriptItem of scriptList) {
      const scriptPath = typeof scriptItem === 'string' ? scriptItem : scriptItem.script;
      const scriptConfig = typeof scriptItem === 'object' ? scriptItem : {};
      
      const result = await runSingleScript(scriptPath, {
        assetPath,
        outputDir,
        artifacts: phaseArtifacts, // Pass accumulated artifacts
        config,
        scriptConfig
      });
      
      // Merge artifacts from this script
      phaseArtifacts = mergeArtifacts(phaseArtifacts, result.artifacts);
    }
  }
  
  return { artifacts: phaseArtifacts };
}

/**
 * Run a single process script
 * 
 * @async
 * @function runSingleScript
 * @param {string} scriptPath - Path to script file
 * @param {object} input - Script input
 * @returns {Promise<object>} - Script output: { artifacts: object }
 */
async function runSingleScript(scriptPath, input) {
  const {
    assetPath,
    outputDir,
    artifacts,
    config,
    scriptConfig
  } = input;

  const scriptInput = {
    assetPath,
    outputDir,
    artifacts,
    config,
    // Merge tool_variables from config and script-level overrides
    toolPath: scriptConfig.toolPath || config?.tool_variables?.toolPath,
    toolVariables: mergeToolVariables(
      config?.tool_variables,
      scriptConfig.toolVariables || scriptConfig.tool_variables
    ),
    ...scriptConfig
  };

  return executeScript({
    phase: 'phase2-process',
    scriptPath,
    input: scriptInput
  });
}

/**
 * Run multiple scripts in parallel
 * 
 * @async
 * @function runParallelScripts
 * @param {array} scriptItems - Array of script configurations
 * @param {object} baseInput - Base input for all scripts
 * @returns {Promise<object>} - Merged artifacts from all scripts
 */
async function runParallelScripts(scriptItems, baseInput) {
  const { assetPath, outputDir, artifacts, config } = baseInput;
  
  // Start all scripts simultaneously
  const promises = scriptItems.map(async (scriptItem) => {
    const scriptPath = typeof scriptItem === 'string' ? scriptItem : scriptItem.script;
    const scriptConfig = typeof scriptItem === 'object' ? scriptItem : {};
    
    try {
      const result = await runSingleScript(scriptPath, {
        assetPath,
        outputDir,
        artifacts, // All scripts receive base artifacts in parallel mode
        config,
        scriptConfig
      });
      return result.artifacts;
    } catch (error) {
      // Re-throw with script identification
      throw new Error(`Parallel script failed [${scriptPath}]: ${error.message}`);
    }
  });
  
  // Wait for all scripts to complete
  const results = await Promise.all(promises);
  
  // Merge all artifacts
  let mergedArtifacts = { ...artifacts };
  for (const artifacts of results) {
    mergedArtifacts = mergeArtifacts(mergedArtifacts, artifacts);
  }
  
  return mergedArtifacts;
}

/**
 * Merge tool variables from config and script-level overrides
 * 
 * @function mergeToolVariables
 * @param {object} configVars - Tool variables from config
 * @param {object} scriptVars - Tool variables from script config
 * @returns {object} - Merged tool variables
 */
function mergeToolVariables(configVars, scriptVars) {
  if (!configVars && !scriptVars) {
    return {};
  }
  
  if (!configVars) {
    return { ...scriptVars };
  }
  
  if (!scriptVars) {
    return { ...configVars };
  }
  
  // Deep merge: script-level overrides config-level
  const merged = { ...configVars };
  
  for (const key of Object.keys(scriptVars)) {
    const scriptValue = scriptVars[key];
    const configValue = merged[key];
    
    if (typeof scriptValue === 'object' && typeof configValue === 'object' && !Array.isArray(scriptValue)) {
      merged[key] = { ...configValue, ...scriptValue };
    } else {
      merged[key] = scriptValue;
    }
  }
  
  return merged;
}

/**
 * Deep merge two artifact objects (helper function)
 * 
 * @function mergeArtifacts
 * @param {object} base - Base artifacts
 * @param {object} newArtifacts - New artifacts to merge
 * @returns {object} - Merged artifacts
 */
function mergeArtifacts(base, newArtifacts) {
  if (!base || typeof base !== 'object') {
    return { ...newArtifacts };
  }
  
  if (!newArtifacts || typeof newArtifacts !== 'object') {
    return { ...base };
  }
  
  const result = { ...base };
  
  for (const key of Object.keys(newArtifacts)) {
    const newValue = newArtifacts[key];
    
    if (newValue === null || newValue === undefined) {
      result[key] = newValue;
      continue;
    }
    
    if (Array.isArray(newValue)) {
      if (Array.isArray(result[key])) {
        result[key] = [...result[key], ...newValue];
      } else {
        result[key] = newValue;
      }
    } else if (typeof newValue === 'object') {
      if (typeof result[key] === 'object' && !Array.isArray(result[key])) {
        result[key] = mergeArtifacts(result[key], newValue);
      } else {
        result[key] = { ...newValue };
      }
    } else {
      result[key] = newValue;
    }
  }
  
  return result;
}

module.exports = {
  runProcess,
  runSingleScript,
  runParallelScripts,
  mergeToolVariables,
};
