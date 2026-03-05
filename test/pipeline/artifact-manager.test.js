#!/usr/bin/env node
/**
 * Artifact Manager Unit Tests
 * 
 * Tests for server/lib/artifact-manager.cjs
 * Uses Node.js native test runner
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');
const test = require('node:test');
const {
  createArtifactContext,
  mergeArtifacts,
  getArtifact,
  setArtifact,
  validateArtifacts,
  serializeArtifacts,
  loadArtifacts,
  parsePath
} = require('../../server/lib/artifact-manager.cjs');

test('Artifact Manager - createArtifactContext', () => {
  const artifacts = createArtifactContext();
  assert.deepStrictEqual(artifacts, {});
});

test('Artifact Manager - mergeArtifacts', async (t) => {
  await t.test('should merge two flat objects', () => {
    const base = { a: 1, b: 2 };
    const newArtifacts = { b: 3, c: 4 };
    
    const result = mergeArtifacts(base, newArtifacts);
    
    assert.strictEqual(result.a, 1);
    assert.strictEqual(result.b, 3);
    assert.strictEqual(result.c, 4);
  });
  
  await t.test('should merge nested objects', () => {
    const base = { a: { x: 1, y: 2 } };
    const newArtifacts = { a: { y: 3, z: 4 } };
    
    const result = mergeArtifacts(base, newArtifacts);
    
    assert.strictEqual(result.a.x, 1);
    assert.strictEqual(result.a.y, 3);
    assert.strictEqual(result.a.z, 4);
  });
  
  await t.test('should concatenate arrays', () => {
    const base = { items: [1, 2] };
    const newArtifacts = { items: [3, 4] };
    
    const result = mergeArtifacts(base, newArtifacts);
    
    assert.deepStrictEqual(result.items, [1, 2, 3, 4]);
  });
  
  await t.test('should handle null and undefined', () => {
    const base = { a: 1 };
    const newArtifacts = { b: null, c: undefined };
    
    const result = mergeArtifacts(base, newArtifacts);
    
    assert.strictEqual(result.a, 1);
    assert.strictEqual(result.b, null);
    assert.strictEqual(result.c, undefined);
  });
  
  await t.test('should handle empty objects', () => {
    const base = { a: 1 };
    const result = mergeArtifacts(base, {});
    assert.deepStrictEqual(result, { a: 1 });
  });
});

test('Artifact Manager - parsePath', async (t) => {
  await t.test('should parse simple dot notation', () => {
    const segments = parsePath('dialogueData.summary');
    assert.deepStrictEqual(segments, ['dialogueData', 'summary']);
  });
  
  await t.test('should parse array notation', () => {
    const segments = parsePath('chunks[0].emotions');
    assert.deepStrictEqual(segments, ['chunks', '0', 'emotions']);
  });
  
  await t.test('should parse complex paths', () => {
    const segments = parsePath('data.items[2].values[0]');
    assert.deepStrictEqual(segments, ['data', 'items', '2', 'values', '0']);
  });
  
  await t.test('should handle empty path', () => {
    const segments = parsePath('');
    assert.deepStrictEqual(segments, []);
  });
});

test('Artifact Manager - getArtifact', async (t) => {
  await t.test('should get nested value by dot-path', () => {
    const artifacts = {
      dialogueData: {
        summary: 'Test summary',
        segments: ['seg1', 'seg2']
      }
    };
    
    const value = getArtifact(artifacts, 'dialogueData.summary');
    assert.strictEqual(value, 'Test summary');
  });
  
  await t.test('should get array element by index', () => {
    const artifacts = {
      chunks: [
        { emotions: ['happy', 'sad'] },
        { emotions: ['angry'] }
      ]
    };
    
    const value = getArtifact(artifacts, 'chunks[0].emotions[0]');
    assert.strictEqual(value, 'happy');
  });
  
  await t.test('should return default for missing path', () => {
    const artifacts = { a: 1 };
    const value = getArtifact(artifacts, 'b.c', 'default');
    assert.strictEqual(value, 'default');
  });
  
  await t.test('should return undefined for missing path without default', () => {
    const artifacts = { a: 1 };
    const value = getArtifact(artifacts, 'b.c');
    assert.strictEqual(value, undefined);
  });
});

test('Artifact Manager - setArtifact', async (t) => {
  await t.test('should set nested value by dot-path', () => {
    const artifacts = {};
    setArtifact(artifacts, 'dialogueData.summary', 'Test');
    
    assert.strictEqual(artifacts.dialogueData.summary, 'Test');
  });
  
  await t.test('should create intermediate objects', () => {
    const artifacts = {};
    setArtifact(artifacts, 'a.b.c.d', 'value');
    
    assert.strictEqual(artifacts.a.b.c.d, 'value');
  });
  
  await t.test('should set array element', () => {
    const artifacts = { chunks: [] };
    setArtifact(artifacts, 'chunks[0]', 'first');
    setArtifact(artifacts, 'chunks[1]', 'second');
    
    assert.deepStrictEqual(artifacts.chunks, ['first', 'second']);
  });
  
  await t.test('should modify in place', () => {
    const artifacts = { a: 1 };
    const result = setArtifact(artifacts, 'b', 2);
    
    assert.strictEqual(result, artifacts);
    assert.strictEqual(artifacts.b, 2);
  });
});

test('Artifact Manager - validateArtifacts', async (t) => {
  await t.test('should validate existing paths', () => {
    const artifacts = {
      dialogueData: { summary: 'test' },
      chunkAnalysis: { chunks: [] }
    };
    
    const result = validateArtifacts(artifacts, [
      'dialogueData.summary',
      'chunkAnalysis.chunks'
    ]);
    
    assert.strictEqual(result.valid, true);
    assert.strictEqual(result.missing.length, 0);
  });
  
  await t.test('should detect missing paths', () => {
    const artifacts = { a: 1 };
    
    const result = validateArtifacts(artifacts, [
      'a',
      'b.c',
      'd.e.f'
    ]);
    
    assert.strictEqual(result.valid, false);
    assert.deepStrictEqual(result.missing, ['b.c', 'd.e.f']);
  });
});

test('Artifact Manager - serialize and load artifacts', async () => {
  const artifacts = {
    dialogueData: { summary: 'test', segments: [1, 2, 3] },
    chunkAnalysis: { chunks: ['a', 'b'], total: 2 }
  };
  
  const outputDir = path.join(__dirname, 'fixtures', 'test-artifacts');
  
  try {
    // Serialize
    const files = await serializeArtifacts(artifacts, outputDir);
    assert(files.length >= 2);
    
    // Load back
    const loaded = await loadArtifacts(outputDir);
    
    assert.deepStrictEqual(loaded.dialogueData, artifacts.dialogueData);
    assert.deepStrictEqual(loaded.chunkAnalysis, artifacts.chunkAnalysis);
  } finally {
    // Cleanup
    if (fs.existsSync(outputDir)) {
      fs.rmSync(outputDir, { recursive: true, force: true });
    }
  }
});

console.log('✅ Artifact manager tests complete');
