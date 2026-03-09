#!/usr/bin/env node

'use strict';

/**
 * Prompt payload dedupe store.
 *
 * Writes prompt payloads once under:
 *   <runOutputDir>/raw/ai/_prompts/<sha256>.json
 *
 * Attempt capture payloads should reference prompts via:
 *   { promptRef: { sha256, file: 'raw/ai/_prompts/<sha256>.json' } }
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const outputManager = require('./output-manager.cjs');

function stableStringify(value) {
  const seen = new WeakSet();

  function walk(v) {
    if (v === null || v === undefined) return v;
    if (typeof v !== 'object') return v;

    if (seen.has(v)) return '[Circular]';
    seen.add(v);

    if (Array.isArray(v)) return v.map(walk);

    const out = {};
    for (const key of Object.keys(v).sort()) {
      out[key] = walk(v[key]);
    }
    return out;
  }

  return JSON.stringify(walk(value));
}

function sha256Hex(text) {
  return crypto.createHash('sha256').update(text).digest('hex');
}

function getPromptStoreDir(outputDir) {
  const runOutputDir = outputManager.resolveRunOutputDir(path.resolve(outputDir));
  return path.join(runOutputDir, 'raw', 'ai', '_prompts');
}

function getPromptRefFile(sha256) {
  return `raw/ai/_prompts/${sha256}.json`;
}

function storePromptPayload({ outputDir, payload }) {
  if (!outputDir) throw new Error('storePromptPayload: outputDir is required');

  const storeDir = getPromptStoreDir(outputDir);
  fs.mkdirSync(storeDir, { recursive: true });

  const canonical = stableStringify(payload);
  const sha = sha256Hex(canonical);

  const absolutePath = path.join(storeDir, `${sha}.json`);
  if (!fs.existsSync(absolutePath)) {
    fs.writeFileSync(absolutePath, JSON.stringify(payload, null, 2), 'utf8');
  }

  return {
    sha256: sha,
    file: getPromptRefFile(sha),
    absolutePath,
  };
}

function loadPromptPayload({ outputDir, promptRef }) {
  if (!outputDir) throw new Error('loadPromptPayload: outputDir is required');
  if (!promptRef || typeof promptRef !== 'object') throw new Error('loadPromptPayload: promptRef is required');

  const runOutputDir = outputManager.resolveRunOutputDir(path.resolve(outputDir));
  const refFile = promptRef.file;

  if (typeof refFile !== 'string' || !refFile.startsWith('raw/ai/_prompts/')) {
    throw new Error('loadPromptPayload: promptRef.file must be a raw/ai/_prompts/<sha>.json path');
  }

  const absolutePath = path.join(runOutputDir, refFile);
  const text = fs.readFileSync(absolutePath, 'utf8');
  return JSON.parse(text);
}

function resolvePromptFromAttemptCapture({ outputDir, attemptCapture }) {
  if (!attemptCapture || typeof attemptCapture !== 'object') return null;

  if (attemptCapture.promptRef && typeof attemptCapture.promptRef === 'object') {
    return loadPromptPayload({ outputDir, promptRef: attemptCapture.promptRef });
  }

  return attemptCapture.prompt;
}

module.exports = {
  stableStringify,
  sha256Hex,
  storePromptPayload,
  loadPromptPayload,
  resolvePromptFromAttemptCapture,
  getPromptRefFile,
  getPromptStoreDir,
};
