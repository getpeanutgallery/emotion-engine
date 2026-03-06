#!/usr/bin/env node
/**
 * Artifact Manager - Data Passing Between Phases
 * 
 * Manages artifact creation, merging, retrieval, and serialization.
 * Supports dot-path notation for nested access.
 * 
 * @module artifact-manager
 */

const fs = require('fs');
const path = require('path');

/**
 * Create empty artifact context
 * 
 * @function createArtifactContext
 * @returns {object} - Empty artifact container
 * 
 * @example
 * const artifacts = createArtifactContext();
 */
function createArtifactContext() {
  return {};
}

/**
 * Deep merge two artifact objects
 * New values override existing values at the same path
 * 
 * @function mergeArtifacts
 * @param {object} base - Base artifacts
 * @param {object} newArtifacts - New artifacts to merge
 * @returns {object} - Merged artifacts
 * 
 * @example
 * const merged = mergeArtifacts(base, newArtifacts);
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
      // Arrays: if base has same key as array, concatenate; otherwise replace
      if (Array.isArray(result[key])) {
        result[key] = [...result[key], ...newValue];
      } else {
        result[key] = newValue;
      }
    } else if (typeof newValue === 'object') {
      // Objects: recursive merge
      if (typeof result[key] === 'object' && !Array.isArray(result[key])) {
        result[key] = mergeArtifacts(result[key], newValue);
      } else {
        result[key] = { ...newValue };
      }
    } else {
      // Primitives: override
      result[key] = newValue;
    }
  }
  
  return result;
}

/**
 * Parse dot-path notation (e.g., 'dialogueData.summary', 'chunks[0].emotions')
 * 
 * @function parsePath
 * @param {string} pathStr - Dot-path string
 * @returns {string[]} - Array of path segments
 * 
 * @example
 * parsePath('dialogueData.summary'); // ['dialogueData', 'summary']
 * parsePath('chunks[0].emotions');   // ['chunks', '0', 'emotions']
 */
function parsePath(pathStr) {
  if (!pathStr) {
    return [];
  }
  
  // Split by dots, but handle array notation
  const segments = [];
  const parts = pathStr.split(/\.|\[/);
  
  for (const part of parts) {
    if (part === '') continue;
    // Remove trailing ] from array indices
    const cleanPart = part.replace(/\]$/, '');
    if (cleanPart !== '') {
      segments.push(cleanPart);
    }
  }
  
  return segments;
}

/**
 * Get nested artifact by dot-path
 * 
 * @function getArtifact
 * @param {object} artifacts - Artifacts object
 * @param {string} pathStr - Dot-path string (e.g., 'dialogueData.summary')
 * @param {*} [defaultValue] - Default value if path doesn't exist
 * @returns {*} - Value at path or default
 * 
 * @example
 * const summary = getArtifact(artifacts, 'dialogueData.summary');
 * const firstEmotion = getArtifact(artifacts, 'chunks[0].emotions[0]');
 */
function getArtifact(artifacts, pathStr, defaultValue = undefined) {
  if (!artifacts || typeof artifacts !== 'object') {
    return defaultValue;
  }
  
  const segments = parsePath(pathStr);
  
  if (segments.length === 0) {
    return artifacts;
  }
  
  let current = artifacts;
  
  for (const segment of segments) {
    if (current === null || current === undefined) {
      return defaultValue;
    }
    
    // Handle array index
    const index = parseInt(segment, 10);
    if (!isNaN(index) && Array.isArray(current)) {
      current = current[index];
    } else if (typeof current === 'object' && segment in current) {
      current = current[segment];
    } else {
      return defaultValue;
    }
  }
  
  return current;
}

/**
 * Set nested artifact by dot-path
 * Creates intermediate objects/arrays as needed
 * 
 * @function setArtifact
 * @param {object} artifacts - Artifacts object (modified in place)
 * @param {string} pathStr - Dot-path string
 * @param {*} value - Value to set
 * @returns {object} - Modified artifacts object
 * 
 * @example
 * setArtifact(artifacts, 'dialogueData.summary', 'Hello world');
 * setArtifact(artifacts, 'chunks[0].emotions', ['happy', 'sad']);
 */
function setArtifact(artifacts, pathStr, value) {
  if (!artifacts || typeof artifacts !== 'object') {
    throw new Error('artifacts must be an object');
  }
  
  const segments = parsePath(pathStr);
  
  if (segments.length === 0) {
    return artifacts;
  }
  
  let current = artifacts;
  
  for (let i = 0; i < segments.length - 1; i++) {
    const segment = segments[i];
    const nextSegment = segments[i + 1];
    const nextIsIndex = !isNaN(parseInt(nextSegment, 10));
    
    if (current[segment] === null || current[segment] === undefined) {
      // Create next level: object or array based on next segment
      current[segment] = nextIsIndex ? [] : {};
    }
    
    current = current[segment];
    
    // Ensure we can traverse further
    if (typeof current !== 'object') {
      throw new Error(`Cannot set property '${pathStr}': '${segment}' is not an object`);
    }
  }
  
  // Set the final value
  const lastSegment = segments[segments.length - 1];
  const index = parseInt(lastSegment, 10);
  
  if (!isNaN(index) && Array.isArray(current)) {
    current[index] = value;
  } else {
    current[lastSegment] = value;
  }
  
  return artifacts;
}

/**
 * Validate that required artifact paths exist
 * 
 * @function validateArtifacts
 * @param {object} artifacts - Artifacts object
 * @param {string[]} requiredPaths - Array of required dot-paths
 * @returns {object} - Validation result: { valid: boolean, missing: string[] }
 * 
 * @example
 * const result = validateArtifacts(artifacts, [
 *   'dialogueData.summary',
 *   'chunkAnalysis.chunks'
 * ]);
 * if (!result.valid) {
 *   console.error('Missing artifacts:', result.missing);
 * }
 */
function validateArtifacts(artifacts, requiredPaths) {
  const missing = [];
  
  for (const pathStr of requiredPaths) {
    const value = getArtifact(artifacts, pathStr);
    if (value === undefined) {
      missing.push(pathStr);
    }
  }
  
  return {
    valid: missing.length === 0,
    missing
  };
}

/**
 * Get phase for a given artifact key
 * 
 * @function getPhaseForArtifact
 * @param {string} key - Artifact key (e.g., 'dialogueData', 'chunkAnalysis')
 * @returns {string} - Phase folder name or 'root' for artifacts-complete.json
 * 
 * @example
 * getPhaseForArtifact('dialogueData');    // 'phase1-gather-context'
 * getPhaseForArtifact('chunkAnalysis');   // 'phase2-process'
 * getPhaseForArtifact('metricsData');     // 'phase3-report'
 */
function getPhaseForArtifact(key) {
  // Phase 1: Gather Context
  const phase1Artifacts = ['dialogueData', 'musicData'];
  
  // Phase 2: Process
  const phase2Artifacts = ['chunkAnalysis', 'perSecondData'];
  
  // Phase 3: Report
  const phase3Artifacts = ['metricsData', 'recommendationData', 'emotionalAnalysis', 'summaryData'];
  
  if (phase1Artifacts.includes(key)) {
    return 'phase1-gather-context';
  }
  
  if (phase2Artifacts.includes(key)) {
    return 'phase2-process';
  }
  
  if (phase3Artifacts.includes(key)) {
    return 'phase3-report';
  }
  
  // Default to root for unknown artifacts
  return 'root';
}

/**
 * Serialize artifacts to JSON files
 * Writes ONLY artifacts-complete.json to the root directory
 * Individual artifact files are written by phase scripts to their phase folders
 * 
 * @async
 * @function serializeArtifacts
 * @param {object} artifacts - Artifacts object
 * @param {string} outputDir - Output directory path
 * @returns {Promise<string[]>} - Array containing only artifacts-complete.json path
 * 
 * @example
 * const files = await serializeArtifacts(artifacts, 'output/results');
 */
async function serializeArtifacts(artifacts, outputDir) {
  const absoluteDir = path.resolve(outputDir);
  
  // Ensure output directory exists
  fs.mkdirSync(absoluteDir, { recursive: true });
  
  // Write ONLY the complete artifacts dump to root
  const completePath = path.join(absoluteDir, 'artifacts-complete.json');
  fs.writeFileSync(completePath, JSON.stringify(artifacts, null, 2), 'utf8');
  
  return [completePath];
}

/**
 * Load artifacts from JSON files in directory
 * Prefers artifacts-complete.json if it exists (contains all artifacts in one file)
 * Otherwise loads individual artifact files (legacy behavior)
 * 
 * @async
 * @function loadArtifacts
 * @param {string} inputDir - Input directory path
 * @returns {Promise<object>} - Loaded artifacts object
 * 
 * @example
 * const artifacts = await loadArtifacts('output/results');
 */
async function loadArtifacts(inputDir) {
  const absoluteDir = path.resolve(inputDir);
  
  if (!fs.existsSync(absoluteDir)) {
    throw new Error(`Artifacts directory not found: ${absoluteDir}`);
  }
  
  // Prefer artifacts-complete.json if it exists
  const completePath = path.join(absoluteDir, 'artifacts-complete.json');
  if (fs.existsSync(completePath)) {
    const content = fs.readFileSync(completePath, 'utf8');
    return JSON.parse(content);
  }
  
  // Legacy behavior: load individual artifact files
  const artifacts = {};
  const files = fs.readdirSync(absoluteDir);
  
  for (const file of files) {
    if (!file.endsWith('.json')) continue;
    
    const filePath = path.join(absoluteDir, file);
    const key = file.replace(/\.json$/, '');
    
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      artifacts[key] = JSON.parse(content);
    } catch (error) {
      console.error(`Failed to load artifact from ${file}:`, error.message);
      // Continue loading other files
    }
  }
  
  return artifacts;
}

/**
 * Clear artifacts (reset to empty context)
 * 
 * @function clearArtifacts
 * @param {object} artifacts - Artifacts object to clear
 * @returns {object} - Empty artifacts object
 */
function clearArtifacts(artifacts) {
  // Remove all properties
  for (const key of Object.keys(artifacts)) {
    delete artifacts[key];
  }
  return artifacts;
}

module.exports = {
  createArtifactContext,
  mergeArtifacts,
  getArtifact,
  setArtifact,
  validateArtifacts,
  serializeArtifacts,
  loadArtifacts,
  clearArtifacts,
  getPhaseForArtifact, // Export phase mapping function
  parsePath, // Exported for testing
};
