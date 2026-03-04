#!/usr/bin/env node
/**
 * Persona Resolver Utility
 * 
 * Converts persona IDs to absolute file paths.
 * Used by CLI wrapper, NOT by pipeline.
 * 
 * Usage:
 *   const resolver = require('./lib/persona-resolver.cjs');
 *   const soulPath = resolver.resolveSoulPath('impatient-teenager', '1.0.0');
 *   const goalPath = resolver.resolveGoalPath('video-ad-evaluation', 'latest');
 *   const toolPath = resolver.resolveToolPath('emotion-lenses');
 */

const fs = require('fs');
const path = require('path');

// Base directories (configurable)
const PERSONAS_ROOT = process.env.PERSONAS_ROOT || path.join(__dirname, '../../personas');
const TOOLS_ROOT = process.env.TOOLS_ROOT || path.join(__dirname, '../../tools');

/**
 * Resolve SemVer version to actual folder
 * Supports: 'latest', '1', '1.0', '1.0.0', '^1.0.0', '~1.0.0'
 * @param {string} baseDir - Base directory to search
 * @param {string} version - Version string
 * @returns {string|null} Resolved version folder name or null
 */
function resolveVersion(baseDir, version = 'latest') {
  if (!fs.existsSync(baseDir)) return null;
  
  // Get all version folders
  const folders = fs.readdirSync(baseDir)
    .filter(f => fs.statSync(path.join(baseDir, f)).isDirectory())
    .filter(f => /^\d+\.\d+\.\d+$/.test(f)); // Only SemVer folders
  
  if (folders.length === 0) return null;
  
  // Sort by SemVer (descending)
  folders.sort((a, b) => {
    const [aMajor, aMinor, aPatch] = a.split('.').map(Number);
    const [bMajor, bMinor, bPatch] = b.split('.').map(Number);
    if (aMajor !== bMajor) return bMajor - aMajor;
    if (aMinor !== bMinor) return bMinor - aMinor;
    return bPatch - aPatch;
  });
  
  if (version === 'latest') {
    return folders[0];
  }
  
  // Exact match
  if (folders.includes(version)) {
    return version;
  }
  
  // Major only (e.g., '1' → latest 1.x.x)
  const majorMatch = version.match(/^(\d+)$/);
  if (majorMatch) {
    const major = parseInt(majorMatch[1]);
    return folders.find(f => f.startsWith(`${major}.`)) || null;
  }
  
  // Major.Minor (e.g., '1.0' → latest 1.0.x)
  const minorMatch = version.match(/^(\d+)\.(\d+)$/);
  if (minorMatch) {
    const prefix = `${minorMatch[1]}.${minorMatch[2]}.`;
    return folders.find(f => f.startsWith(prefix)) || null;
  }
  
  return null;
}

/**
 * Resolve soul ID to absolute path
 * @param {string} soulId - Soul ID (e.g., 'impatient-teenager')
 * @param {string} version - SemVer version (e.g., '1.0.0', 'latest')
 * @returns {string|null} Absolute path to SOUL.md or null
 */
function resolveSoulPath(soulId, version = 'latest') {
  const baseDir = path.join(PERSONAS_ROOT, 'souls', soulId);
  const resolvedVersion = resolveVersion(baseDir, version);
  
  if (!resolvedVersion) {
    return null;
  }
  
  return path.join(baseDir, resolvedVersion, 'SOUL.md');
}

/**
 * Resolve goal ID to absolute path
 * @param {string} goalId - Goal ID (e.g., 'video-ad-evaluation')
 * @param {string} version - SemVer version
 * @returns {string|null} Absolute path to GOAL.md or null
 */
function resolveGoalPath(goalId, version = 'latest') {
  const baseDir = path.join(PERSONAS_ROOT, 'goals', goalId);
  const resolvedVersion = resolveVersion(baseDir, version);
  
  if (!resolvedVersion) {
    return null;
  }
  
  return path.join(baseDir, resolvedVersion, 'GOAL.md');
}

/**
 * Resolve tool ID to absolute path
 * @param {string} toolId - Tool ID (e.g., 'emotion-lenses')
 * @returns {string|null} Absolute path to tool script or null
 */
function resolveToolPath(toolId) {
  const toolPath = path.join(TOOLS_ROOT, `${toolId}-tool.cjs`);
  
  if (!fs.existsSync(toolPath)) {
    return null;
  }
  
  return toolPath;
}

/**
 * Resolve all IDs to paths
 * @param {Object} options - Resolution options
 * @param {string} options.soulId - Soul ID
 * @param {string} options.soulVersion - Soul version
 * @param {string} options.goalId - Goal ID
 * @param {string} options.goalVersion - Goal version
 * @param {string} options.toolId - Tool ID
 * @returns {{soulPath: string|null, goalPath: string|null, toolPath: string|null}}
 */
function resolveAll({ soulId, soulVersion = 'latest', goalId, goalVersion = 'latest', toolId }) {
  return {
    soulPath: resolveSoulPath(soulId, soulVersion),
    goalPath: resolveGoalPath(goalId, goalVersion),
    toolPath: resolveToolPath(toolId)
  };
}

module.exports = {
  resolveSoulPath,
  resolveGoalPath,
  resolveToolPath,
  resolveAll,
  resolveVersion
};
