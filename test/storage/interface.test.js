#!/usr/bin/env node
/**
 * Unit Tests for Storage Interface
 * 
 * Run with: node test/storage/interface.test.js
 */

const path = require('path');
const storage = require('../../server/lib/storage/storage-interface.js');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`✓ ${name}`);
    passed++;
  } catch (error) {
    console.error(`✗ ${name}`);
    console.error(`  Error: ${error.message}`);
    failed++;
  }
}

async function asyncTest(name, fn) {
  try {
    await fn();
    console.log(`✓ ${name}`);
    passed++;
  } catch (error) {
    console.error(`✗ ${name}`);
    console.error(`  Error: ${error.message}`);
    failed++;
  }
}

console.log('Storage Interface Unit Tests\n');
console.log('============================\n');

// Test getAvailableProviders
console.log('Testing getAvailableProviders():\n');

test('returns array of provider names', () => {
  const providers = storage.getAvailableProviders();
  if (!Array.isArray(providers)) throw new Error('Should return an array');
  if (providers.length === 0) throw new Error('Should have at least one provider');
});

test('includes local-fs provider', () => {
  const providers = storage.getAvailableProviders();
  if (!providers.includes('local-fs')) throw new Error('Should include local-fs');
});

test('includes aws-s3 provider', () => {
  const providers = storage.getAvailableProviders();
  if (!providers.includes('aws-s3')) throw new Error('Should include aws-s3');
});

// Test initialize
console.log('\nTesting initialize():\n');

test('initializes with default provider (local-fs)', () => {
  const originalEnv = process.env.STORAGE_PROVIDER;
  delete process.env.STORAGE_PROVIDER;
  
  try {
    const provider = storage.getProviderFromEnv();
    if (!provider) throw new Error('Should return provider');
  } finally {
    if (originalEnv) process.env.STORAGE_PROVIDER = originalEnv;
  }
});

test('initializes with specified provider', () => {
  storage.initialize({ provider: 'local-fs' });
  const provider = storage.getProviderFromEnv();
  if (!provider) throw new Error('Should return provider');
});

// Test interface functions exist
console.log('\nTesting interface functions:\n');

test('exports write function', () => {
  if (typeof storage.write !== 'function') throw new Error('Should export write');
});

test('exports read function', () => {
  if (typeof storage.read !== 'function') throw new Error('Should export read');
});

test('exports exists function', () => {
  if (typeof storage.exists !== 'function') throw new Error('Should export exists');
});

test('exports list function', () => {
  if (typeof storage.list !== 'function') throw new Error('Should export list');
});

test('exports getUrl function', () => {
  if (typeof storage.getUrl !== 'function') throw new Error('Should export getUrl');
});

test('exports delete function', () => {
  if (typeof storage.delete !== 'function') throw new Error('Should export delete');
});

// Test getProviderFromEnv
console.log('\nTesting getProviderFromEnv():\n');

test('loads provider from environment', () => {
  const originalEnv = process.env.STORAGE_PROVIDER;
  process.env.STORAGE_PROVIDER = 'local-fs';
  
  try {
    const provider = storage.getProviderFromEnv();
    if (!provider) throw new Error('Should return provider');
  } finally {
    if (originalEnv) process.env.STORAGE_PROVIDER = originalEnv;
    else delete process.env.STORAGE_PROVIDER;
  }
});

// Summary
console.log('\n============================');
console.log(`Tests: ${passed + failed} total`);
console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed}`);
console.log('============================\n');

if (failed > 0) {
  process.exit(1);
}
