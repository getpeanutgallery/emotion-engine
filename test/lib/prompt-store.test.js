#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const test = require('node:test');

const {
  storePromptPayload,
  loadPromptPayload,
  getPromptStoreDir,
  getPromptRefFile,
  toCanonicalPromptRefFile,
  toLegacyPromptRefFile,
} = require('../../server/lib/prompt-store.cjs');

function makeTempDir(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

test('prompt-store writes canonical run-level prompt refs under _meta/ai/_prompts', () => {
  const outputDir = makeTempDir('ee-prompt-store-');
  const payload = { prompt: 'hello world', nested: { value: 1 } };

  const stored = storePromptPayload({ outputDir, payload });

  assert.strictEqual(stored.file, `_meta/ai/_prompts/${stored.sha256}.json`);
  assert.strictEqual(getPromptRefFile(stored.sha256), stored.file);
  assert.strictEqual(getPromptStoreDir(outputDir), path.join(outputDir, '_meta', 'ai', '_prompts'));
  assert.strictEqual(stored.absolutePath, path.join(outputDir, stored.file));
  assert(fs.existsSync(stored.absolutePath));
  assert.deepStrictEqual(JSON.parse(fs.readFileSync(stored.absolutePath, 'utf8')), payload);
});

test('prompt-store loads canonical prompt refs', () => {
  const outputDir = makeTempDir('ee-prompt-store-canonical-');
  const payload = { prompt: 'canonical payload' };
  const stored = storePromptPayload({ outputDir, payload });

  const loaded = loadPromptPayload({
    outputDir,
    promptRef: { sha256: stored.sha256, file: stored.file },
  });

  assert.deepStrictEqual(loaded, payload);
});

test('prompt-store dual-reads legacy raw/ai/_prompts refs from older runs', () => {
  const outputDir = makeTempDir('ee-prompt-store-legacy-');
  const payload = { prompt: 'legacy payload', turns: [1, 2, 3] };
  const legacyRef = 'raw/ai/_prompts/legacy.json';
  const legacyPath = path.join(outputDir, legacyRef);

  fs.mkdirSync(path.dirname(legacyPath), { recursive: true });
  fs.writeFileSync(legacyPath, JSON.stringify(payload, null, 2), 'utf8');

  const loaded = loadPromptPayload({
    outputDir,
    promptRef: { sha256: 'legacy', file: legacyRef },
  });

  assert.deepStrictEqual(loaded, payload);
});

test('prompt-store falls back across canonical/legacy ref aliases for compatibility', () => {
  const outputDir = makeTempDir('ee-prompt-store-fallback-');
  const payload = { prompt: 'cross-read payload' };
  const legacyRef = 'raw/ai/_prompts/shared.json';
  const canonicalRef = '_meta/ai/_prompts/shared.json';
  const canonicalPath = path.join(outputDir, canonicalRef);

  fs.mkdirSync(path.dirname(canonicalPath), { recursive: true });
  fs.writeFileSync(canonicalPath, JSON.stringify(payload, null, 2), 'utf8');

  const loadedViaLegacyRef = loadPromptPayload({
    outputDir,
    promptRef: { sha256: 'shared', file: legacyRef },
  });

  assert.deepStrictEqual(loadedViaLegacyRef, payload);
  assert.strictEqual(toCanonicalPromptRefFile(legacyRef), canonicalRef);
  assert.strictEqual(toLegacyPromptRefFile(canonicalRef), legacyRef);
});
