#!/usr/bin/env node
/**
 * Unit Tests for OpenRouter AI Provider
 * 
 * Run with: node test/ai-providers/openrouter.test.js
 */

const path = require('path');
const openrouter = require('ai-providers/providers/openrouter.cjs');

// Enable digital twin transport for offline tests
process.env.NODE_ENV = 'test';
process.env.DIGITAL_TWIN_PACK = process.env.DIGITAL_TWIN_PACK || path.resolve(__dirname, '..', 'fixtures', 'digital-twin-emotion-engine-providers');
process.env.DIGITAL_TWIN_CASSETTE = process.env.DIGITAL_TWIN_CASSETTE || 'providers';

const { preflightDigitalTwin } = require('../helpers/digital-twin-preflight.cjs');
preflightDigitalTwin();

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

console.log('OpenRouter Provider Unit Tests\n');
console.log('==============================\n');

// Test validate
console.log('Testing validate():\n');

test('validates with valid API key', () => {
  openrouter.validate({ apiKey: 'sk-or-valid-key-12345678' });
});

test('throws without API key', () => {
  try {
    openrouter.validate({});
    throw new Error('Should have thrown error');
  } catch (error) {
    if (!error.message.includes('API key is required')) {
      throw new Error(`Wrong error message: ${error.message}`);
    }
  }
});

test('throws with invalid API key format', () => {
  try {
    openrouter.validate({ apiKey: 'too-short' });
    throw new Error('Should have thrown error');
  } catch (error) {
    if (!error.message.includes('Invalid API key format')) {
      throw new Error(`Wrong error message: ${error.message}`);
    }
  }
});

test('accepts baseUrl option', () => {
  openrouter.validate({ apiKey: 'sk-or-valid-key-123456789012345678', baseUrl: 'https://api.example.com' });
});

test('rejects invalid baseUrl', () => {
  try {
    openrouter.validate({ apiKey: 'sk-or-valid-key-123456789012345678', baseUrl: 123 });
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
  const apiKey = process.env.OPENROUTER_API_KEY || 'dummy-key';

  await asyncTest('returns content and usage', async () => {
    const response = await openrouter.complete({
      prompt: 'Say hello',
      model: 'qwen/qwen-3.5-397b-a17b',
      apiKey: apiKey,
    });
    
    if (!response.content) throw new Error('Should have content');
    if (typeof response.content !== 'string') throw new Error('Content should be string');
    if (!response.usage) throw new Error('Should have usage');
    if (typeof response.usage.input !== 'number') throw new Error('Usage input should be number');
    if (typeof response.usage.output !== 'number') throw new Error('Usage output should be number');
  });

  await asyncTest('handles messages array', async () => {
    const response = await openrouter.complete({
      prompt: [
        { role: 'user', content: [{ type: 'text', text: 'Say hello' }] }
      ],
      model: 'qwen/qwen-3.5-397b-a17b',
      apiKey: apiKey,
    });
    
    if (!response.content) throw new Error('Should have content');
  });

  await asyncTest('throws without prompt', async () => {
    try {
      await openrouter.complete({
        model: 'qwen/qwen-3.5-397b-a17b',
        apiKey: apiKey,
      });
      throw new Error('Should have thrown error');
    } catch (error) {
      if (!error.message.includes('prompt is required')) {
        throw new Error(`Wrong error message: ${error.message}`);
      }
    }
  });

  // Summary
  console.log('\n==============================');
  console.log(`Tests: ${passed + failed} total`);
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  console.log('==============================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runCompletionTests().catch(console.error);
