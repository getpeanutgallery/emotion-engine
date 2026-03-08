#!/usr/bin/env node
/**
 * Phase 1: Gather Context Runner
 * 
 * Executes gather context scripts to extract initial data from assets.
 * Supports sequential and parallel execution.
 * 
 * @module phases/gather-context-runner
 */

const fs = require('fs');
const path = require('path');

/**
 * Run Phase 1: Gather Context
 * 
 * Executes 0-N scripts to gather context from the asset.
 * Scripts can run sequentially (default) or in parallel.
 * 
 * @async
 * @function runGatherContext
 * @param {object} input - Phase input
 * @param {string} input.assetPath - Path to source asset
 * @param {string} input.outputDir - Output directory
 * @param {object} input.config - Pipeline configuration
 * @param {string[]|object} input.scripts - Scripts to run (array or { parallel: [...] })
 * @param {object} [input.artifacts] - Existing artifacts (for merging)
 * @returns {Promise<object>} - Phase output: { artifacts: object }
 * @throws {Error} - If script execution fails
 * 
 * @example
 * const result = await runGatherContext({
 *   assetPath: 'video.mp4',
 *   outputDir: 'output',
 *   config: { settings: {} },
 *   scripts: ['scripts/get-context/get-dialogue.cjs']
 * });
 */
async function runGatherContext(input) {
  const {
    assetPath,
    outputDir,
    config,
    scripts,
    artifacts = {}
  } = input;
  
  if (!scripts || (Array.isArray(scripts) && scripts.length === 0)) {
    // No scripts to run - return existing artifacts
    return { artifacts };
  }
  
  const isParallel = typeof scripts === 'object' && scripts !== null && scripts.parallel && Array.isArray(scripts.parallel);
  const scriptList = isParallel 
    ? scripts.parallel 
    : (Array.isArray(scripts) ? scripts : []);
  
  if (scriptList.length === 0) {
    return { artifacts };
  }
  
  console.log(`📥 Phase 1: Gather Context (${isParallel ? 'parallel' : 'sequential'}, ${scriptList.length} script(s))`);
  
  let phaseArtifacts = { ...artifacts };
  
  if (isParallel) {
    // Parallel execution: all scripts run simultaneously
    phaseArtifacts = await runParallelScripts(scriptList, { assetPath, outputDir, artifacts, config });
  } else {
    // Sequential execution: scripts run in order, artifacts accumulate
    for (const scriptItem of scriptList) {
      const scriptPath = typeof scriptItem === 'string' ? scriptItem : scriptItem.script;
      const scriptConfig = typeof scriptItem === 'object' ? scriptItem : {};
      
      const result = await runSingleScript(scriptPath, {
        assetPath,
        outputDir,
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
 * Run a single gather context script
 * 
 * @async
 * @function runSingleScript
 * @param {string} scriptPath - Path to script file
 * @param {object} input - Script input
 * @returns {Promise<object>} - Script output: { artifacts: object }
 */
async function runSingleScript(scriptPath, input) {
  const { assetPath, outputDir, config, scriptConfig } = input;
  
  // Resolve script path relative to project root
  const absoluteScriptPath = path.resolve(process.cwd(), scriptPath);
  
  if (!fs.existsSync(absoluteScriptPath)) {
    throw new Error(`Script not found: ${absoluteScriptPath}`);
  }
  
  console.log(`   Running: ${scriptPath}`);
  
  try {
    // Load and execute script
    const script = require(absoluteScriptPath);
    
    if (typeof script.run !== 'function') {
      throw new Error(`Script must export a run() function: ${scriptPath}`);
    }
    
    // Build input for script
    const scriptInput = {
      assetPath,
      outputDir,
      config,
      ...scriptConfig
    };
    
    // Execute script
    const result = await script.run(scriptInput);
    
    // Validate output
    if (!result || typeof result.artifacts !== 'object') {
      throw new Error(`Script must return { artifacts: object }: ${scriptPath}`);
    }
    
    return result;
  } catch (error) {
    console.error(`   ❌ Script failed: ${scriptPath}`);
    console.error(`      Error: ${error.message}`);
    throw error;
  }
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
  const { assetPath, outputDir, artifacts = {}, config } = baseInput;
  
  // Start all scripts simultaneously
  const promises = scriptItems.map(async (scriptItem) => {
    const scriptPath = typeof scriptItem === 'string' ? scriptItem : scriptItem.script;
    const scriptConfig = typeof scriptItem === 'object' ? scriptItem : {};
    
    try {
      const result = await runSingleScript(scriptPath, {
        assetPath,
        outputDir,
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
  runGatherContext,
  runSingleScript,
  runParallelScripts,
};
