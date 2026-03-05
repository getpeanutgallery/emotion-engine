#!/usr/bin/env node
/**
 * Unit Tests for Local Filesystem Storage Provider
 * 
 * Run with: node test/storage/local-fs.test.js
 */

const path = require('path');
const fs = require('fs');
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

console.log('Local Filesystem Storage Provider Unit Tests\n');
console.log('============================================\n');

const testDir = path.join(__dirname, 'tmp-storage-test');

// Setup
if (!fs.existsSync(testDir)) {
  fs.mkdirSync(testDir, { recursive: true });
}

storage.initialize({
  provider: 'local-fs',
  baseDir: testDir,
});

async function runTests() {
  try {
  // Test write and read
  console.log('Testing write() and read():\n');

  await asyncTest('writes string data', async () => {
    const testData = 'Hello, World!';
    const filePath = 'test/hello.txt';
    
    const writtenPath = await storage.write(filePath, testData);
    if (!writtenPath) throw new Error('Should return path');
    if (!writtenPath.includes('hello.txt')) throw new Error('Path should include filename');
  });

  await asyncTest('reads string data', async () => {
    const testData = 'Test content';
    const filePath = 'test/read-test.txt';
    
    await storage.write(filePath, testData);
    const readData = await storage.read(filePath);
    
    if (!Buffer.isBuffer(readData)) throw new Error('Should return Buffer');
    if (readData.toString() !== testData) throw new Error('Content should match');
  });

  await asyncTest('writes and reads binary data', async () => {
    const testData = Buffer.from([0x48, 0x65, 0x6c, 0x6c, 0x6f]); // "Hello" in bytes
    const filePath = 'test/binary.bin';
    
    await storage.write(filePath, testData);
    const readData = await storage.read(filePath);
    
    if (!readData.equals(testData)) throw new Error('Binary data should match');
  });

  // Test exists
  console.log('\nTesting exists():\n');

  await asyncTest('returns true for existing file', async () => {
    await storage.write('exists.txt', 'test');
    const exists = await storage.exists('exists.txt');
    if (!exists) throw new Error('Should return true');
  });

  await asyncTest('returns false for non-existing file', async () => {
    const exists = await storage.exists('not-exists.txt');
    if (exists) throw new Error('Should return false');
  });

  // Test list
  console.log('\nTesting list():\n');

  await asyncTest('lists files with prefix', async () => {
    await storage.write('chunk-1.json', '{}');
    await storage.write('chunk-2.json', '{}');
    await storage.write('other.txt', 'test');
    
    const chunks = await storage.list('chunk-');
    if (!Array.isArray(chunks)) throw new Error('Should return array');
    if (chunks.length !== 2) throw new Error(`Should return 2 files, got ${chunks.length}`);
    if (!chunks.some(f => f.includes('chunk-1.json'))) throw new Error('Should include chunk-1.json');
    if (!chunks.some(f => f.includes('chunk-2.json'))) throw new Error('Should include chunk-2.json');
  });

  await asyncTest('returns empty array for non-existing prefix', async () => {
    const files = await storage.list('nonexistent-');
    if (!Array.isArray(files)) throw new Error('Should return array');
    if (files.length !== 0) throw new Error('Should return empty array');
  });

  // Test getUrl
  console.log('\nTesting getUrl():\n');

  await asyncTest('returns file:// URL', async () => {
    await storage.write('url-test.txt', 'test');
    const url = await storage.getUrl('url-test.txt');
    if (!url.startsWith('file://')) throw new Error(`Should return file:// URL, got ${url}`);
  });

  // Test delete
  console.log('\nTesting delete():\n');

  await asyncTest('deletes existing file', async () => {
    await storage.write('delete-me.txt', 'test');
    const deleted = await storage.delete('delete-me.txt');
    if (!deleted) throw new Error('Should return true');
    
    const exists = await storage.exists('delete-me.txt');
    if (exists) throw new Error('File should be deleted');
  });

  await asyncTest('returns false for non-existing file', async () => {
    const deleted = await storage.delete('nonexistent.txt');
    if (deleted) throw new Error('Should return false');
  });

  // Summary
  console.log('\n============================================');
  console.log(`Tests: ${passed + failed} total`);
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  console.log('============================================\n');

  if (failed > 0) {
    process.exit(1);
  }
  } finally {
    // Cleanup
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  }
}

runTests().catch(console.error);
