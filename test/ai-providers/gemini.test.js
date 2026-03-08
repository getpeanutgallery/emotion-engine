#!/usr/bin/env node
/**
 * Unit Tests for Google Gemini AI Provider
 * 
 * Run with: node test/ai-providers/gemini.test.js
 */

const path = require('path');
const gemini = require('ai-providers/providers/gemini.cjs');

// Enable digital twin transport for offline tests
process.env.NODE_ENV = 'test';
process.env.DIGITAL_TWIN_PACK = process.env.DIGITAL_TWIN_PACK || '/home/derrick/.openclaw/workspace/projects/peanut-gallery/digital-twin-emotion-engine-providers';
process.env.DIGITAL_TWIN_CASSETTE = process.env.DIGITAL_TWIN_CASSETTE || 'providers';

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

console.log('Gemini Provider Unit Tests\n');
console.log('==========================\n');

// Test validate
console.log('Testing validate():\n');

test('validates with valid API key', () => {
  gemini.validate({ apiKey: 'AIzaSyA-valid-key-12345678901234567890' });
});

test('throws without API key', () => {
  try {
    gemini.validate({});
    throw new Error('Should have thrown error');
  } catch (error) {
    if (!error.message.includes('API key is required')) {
      throw new Error(`Wrong error message: ${error.message}`);
    }
  }
});

test('throws with invalid API key format (too short)', () => {
  try {
    gemini.validate({ apiKey: 'too-short' });
    throw new Error('Should have thrown error');
  } catch (error) {
    if (!error.message.includes('Invalid API key format')) {
      throw new Error(`Wrong error message: ${error.message}`);
    }
  }
});

test('accepts baseUrl option', () => {
  gemini.validate({ apiKey: 'AIzaSyA-valid-key-1234567890123456789012', baseUrl: 'https://generativelanguage.googleapis.com' });
});

test('rejects invalid baseUrl', () => {
  try {
    gemini.validate({ apiKey: 'AIzaSyA-valid-key-1234567890123456789012', baseUrl: 123 });
    throw new Error('Should have thrown error');
  } catch (error) {
    if (!error.message.includes('baseUrl must be a string')) {
      throw new Error(`Wrong error message: ${error.message}`);
    }
  }
});

// Test complete (skip if API key not available)
console.log('\nTesting complete():\n');

async function runCompletionTests() {
  // Use dummy key for twin mode (real key if provided but not needed)
  const apiKey = process.env.GEMINI_API_KEY || 'AIzaSyDummyKey';

  await asyncTest('returns content and usage', async () => {
    const response = await gemini.complete({
      prompt: 'Say hello',
      model: 'gemini-1.5-pro',
      apiKey: apiKey,
    });
    
    if (!response.content) throw new Error('Should have content');
    if (typeof response.content !== 'string') throw new Error('Content should be string');
    if (!response.usage) throw new Error('Should have usage');
    if (typeof response.usage.input !== 'number') throw new Error('Usage input should be number');
    if (typeof response.usage.output !== 'number') throw new Error('Usage output should be number');
  });

  await asyncTest('throws without prompt', async () => {
    try {
      await gemini.complete({
        model: 'gemini-1.5-pro',
        apiKey: apiKey,
      });
      throw new Error('Should have thrown error');
    } catch (error) {
      if (!error.message.includes('prompt is required')) {
        throw new Error(`Wrong error message: ${error.message}`);
      }
    }
  });

  await asyncTest('throws without model', async () => {
    try {
      await gemini.complete({
        prompt: 'Test',
        apiKey: apiKey,
      });
      throw new Error('Should have thrown error');
    } catch (error) {
      if (!error.message.includes('model is required')) {
        throw new Error(`Wrong error message: ${error.message}`);
      }
    }
  });

  // Summary
  console.log('\n==========================');
  console.log(`Tests: ${passed + failed} total`);
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  console.log('==========================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runCompletionTests().catch(console.error);
