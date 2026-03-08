#!/usr/bin/env node
/**
 * Unit Tests for Anthropic AI Provider
 * 
 * Run with: node test/ai-providers/anthropic.test.js
 */

const path = require('path');
const anthropic = require('ai-providers/providers/anthropic.cjs');

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

console.log('Anthropic Provider Unit Tests\n');
console.log('=============================\n');

// Test validate
console.log('Testing validate():\n');

test('validates with valid API key', () => {
  anthropic.validate({ apiKey: 'sk-ant-valid-key' });
});

test('throws without API key', () => {
  try {
    anthropic.validate({});
    throw new Error('Should have thrown error');
  } catch (error) {
    if (!error.message.includes('API key is required')) {
      throw new Error(`Wrong error message: ${error.message}`);
    }
  }
});

test('warns with invalid API key format (but still validates)', () => {
  // Anthropic validates but only warns about format
  const originalWarn = console.warn;
  let warned = false;
  console.warn = () => { warned = true; };
  
  try {
    const result = anthropic.validate({ apiKey: 'invalid-format' });
    if (!result) throw new Error('Should return true');
    if (!warned) throw new Error('Should warn about format');
  } finally {
    console.warn = originalWarn;
  }
});

test('accepts baseUrl option', () => {
  anthropic.validate({ apiKey: 'sk-ant-valid-key', baseUrl: 'https://api.anthropic.com' });
});

test('rejects invalid baseUrl', () => {
  try {
    anthropic.validate({ apiKey: 'sk-ant-valid-key', baseUrl: 123 });
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
  const apiKey = process.env.ANTHROPIC_API_KEY || 'dummy-key';

  await asyncTest('returns content and usage', async () => {
    const response = await anthropic.complete({
      prompt: 'Say hello',
      model: 'claude-3-5-sonnet-20241022',
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
      await anthropic.complete({
        model: 'claude-3-5-sonnet-20241022',
        apiKey: apiKey,
      });
      throw new Error('Should have thrown error');
    } catch (error) {
      if (!error.message.includes('prompt is required')) {
        throw new Error(`Wrong error message: ${error.message}`);
      }
    }
  });

  await asyncTest('throws for unsupported video attachment', async () => {
    try {
      await anthropic.complete({
        prompt: 'Test',
        model: 'claude-3-5-sonnet-20241022',
        apiKey: apiKey,
        attachments: [{ type: 'video', url: 'https://example.com/video.mp4' }]
      });
      throw new Error('Should have thrown error');
    } catch (error) {
      if (!error.message.includes('video attachments not directly supported')) {
        throw new Error(`Wrong error message: ${error.message}`);
      }
    }
  });

  // Summary
  console.log('\n=============================');
  console.log(`Tests: ${passed + failed} total`);
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  console.log('=============================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runCompletionTests().catch(console.error);
