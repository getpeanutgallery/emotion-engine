#!/usr/bin/env node
/**
 * Regression test: package.json bin entry points to an existing file.
 */

const test = require('node:test');
const assert = require('assert');
const fs = require('fs');
const path = require('path');

test('CLI - package.json bin entry', () => {
  const repoRoot = path.resolve(__dirname, '..', '..');
  const pkgPath = path.join(repoRoot, 'package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));

  assert(pkg.bin, 'package.json must define a bin field');
  assert.strictEqual(typeof pkg.bin, 'object');

  const binPath = pkg.bin['emotion-engine'];
  assert(binPath, "package.json bin must define 'emotion-engine'");
  assert.strictEqual(typeof binPath, 'string');

  const resolved = path.resolve(repoRoot, binPath);
  assert(
    fs.existsSync(resolved),
    `package.json.bin['emotion-engine'] points to missing file: ${binPath} (resolved: ${resolved})`
  );
});

console.log('✅ CLI bin entry test complete');
