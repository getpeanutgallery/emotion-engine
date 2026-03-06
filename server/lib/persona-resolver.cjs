#!/usr/bin/env node
/**
 * Persona Resolver Utility - DEPRECATED
 * 
 * This file is deprecated as of 2026-03-06.
 * The persona system now uses flat paths without ID lookup or version resolution.
 * 
 * OLD USAGE (no longer supported):
 *   const resolver = require('./lib/persona-resolver.cjs');
 *   const soulPath = resolver.resolveSoulPath('impatient-teenager', '1.0.0');
 * 
 * NEW USAGE:
 *   Use paths directly in configs and code:
 *   - soulPath: "personas/impatient-teenager.md"
 *   - goalPath: "goals/video-ad-evaluation.md"
 * 
 * All functions below are kept for reference only and will return null.
 */

const fs = require('fs');
const path = require('path');

// Base directories (configurable)
const PERSONAS_ROOT = process.env.PERSONAS_ROOT || path.join(__dirname, '../../personas');
const TOOLS_ROOT = process.env.TOOLS_ROOT || path.join(__dirname, '../../tools');

/**
 * @deprecated Version resolution is no longer used.
 */
function resolveVersion(baseDir, version = 'latest') {
  console.warn('resolveVersion() is deprecated. Use flat paths instead.');
  return null;
}

/**
 * @deprecated Soul ID resolution is no longer used.
 * Use paths directly: "personas/impatient-teenager.md"
 */
function resolveSoulPath(soulId, version = 'latest') {
  console.warn('resolveSoulPath() is deprecated. Use flat paths directly.');
  return null;
}

/**
 * @deprecated Goal ID resolution is no longer used.
 * Use paths directly: "goals/video-ad-evaluation.md"
 */
function resolveGoalPath(goalId, version = 'latest') {
  console.warn('resolveGoalPath() is deprecated. Use flat paths directly.');
  return null;
}

/**
 * @deprecated Tool ID resolution is no longer used.
 * Tools are loaded directly from /tools/ directory.
 */
function resolveToolPath(toolId) {
  console.warn('resolveToolPath() is deprecated. Load tools directly from /tools/.');
  return null;
}

/**
 * @deprecated ID-based resolution is no longer used.
 */
function resolveAll({ soulId, soulVersion = 'latest', goalId, goalVersion = 'latest', toolId }) {
  console.warn('resolveAll() is deprecated. Use flat paths directly.');
  return {
    soulPath: null,
    goalPath: null,
    toolPath: null
  };
}

module.exports = {
  resolveSoulPath,
  resolveGoalPath,
  resolveToolPath,
  resolveAll,
  resolveVersion
};
