#!/usr/bin/env node
/**
 * Persisted Artifacts Loader
 *
 * Supports fast Phase3-only iteration by hydrating required artifacts from an
 * existing run folder (asset.outputDir).
 *
 * Primary source (preferred):
 * - output/<run>/artifacts-complete.json
 *
 * Fallback source (legacy / older runs):
 * - output/<run>/phase1-gather-context/dialogue-data.json
 * - output/<run>/phase1-gather-context/music-data.json
 * - output/<run>/phase2-process/chunk-analysis.json
 * - output/<run>/phase2-process/per-second-data.json
 */

const fs = require('fs');
const path = require('path');

const DEFAULT_LOCATIONS = {
  dialogueData: ['phase1-gather-context', 'dialogue-data.json'],
  musicData: ['phase1-gather-context', 'music-data.json'],
  chunkAnalysis: ['phase2-process', 'chunk-analysis.json'],
  perSecondData: ['phase2-process', 'per-second-data.json'],
};

function safeReadJson(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(content);
}

function pickKeys(source, keys) {
  if (!Array.isArray(keys) || keys.length === 0) return { ...(source || {}) };
  const out = {};
  for (const key of keys) {
    if (source && Object.prototype.hasOwnProperty.call(source, key)) {
      out[key] = source[key];
    }
  }
  return out;
}

/**
 * Load persisted artifacts from a run folder.
 *
 * @param {string} outputDir - Run output directory.
 * @param {{ keys?: string[], strict?: boolean }} [options]
 * @returns {{ artifacts: object, sources: object }}
 */
function loadPersistedArtifacts(outputDir, options = {}) {
  const absoluteDir = path.resolve(outputDir);
  const { keys, strict = false } = options;

  if (!fs.existsSync(absoluteDir)) {
    if (strict) {
      throw new Error(`Run outputDir does not exist: ${absoluteDir}`);
    }
    return { artifacts: {}, sources: {} };
  }

  const sources = {};

  // Preferred: artifacts-complete.json
  const completePath = path.join(absoluteDir, 'artifacts-complete.json');
  if (fs.existsSync(completePath)) {
    const all = safeReadJson(completePath);
    const artifacts = pickKeys(all, keys);
    for (const key of Object.keys(artifacts)) {
      sources[key] = completePath;
    }
    return { artifacts, sources };
  }

  // Fallback: known phase artifact files.
  const artifacts = {};
  const wantedKeys = Array.isArray(keys) && keys.length > 0 ? keys : Object.keys(DEFAULT_LOCATIONS);

  for (const key of wantedKeys) {
    const rel = DEFAULT_LOCATIONS[key];
    if (!rel) continue;

    const candidate = path.join(absoluteDir, ...rel);
    if (!fs.existsSync(candidate)) continue;

    try {
      artifacts[key] = safeReadJson(candidate);
      sources[key] = candidate;
    } catch (error) {
      if (strict) {
        throw new Error(`Failed to parse persisted artifact ${key} at ${candidate}: ${error.message}`);
      }
    }
  }

  return { artifacts, sources };
}

/**
 * Resolve canonical file paths for required artifact keys.
 *
 * @param {string} outputDir
 * @param {string[]} keys
 * @returns {Record<string, string>} key->absolute file path (fallback location)
 */
function getArtifactFileHints(outputDir, keys) {
  const absoluteDir = path.resolve(outputDir);
  const hints = {};
  for (const key of keys || []) {
    const rel = DEFAULT_LOCATIONS[key];
    if (!rel) continue;
    hints[key] = path.join(absoluteDir, ...rel);
  }
  return hints;
}

module.exports = {
  loadPersistedArtifacts,
  getArtifactFileHints,
};
