#!/usr/bin/env node
/**
 * Unit Tests for AI Provider Interface
 * 
 * Run with: node test/ai-providers/interface.test.js
 */

const path = require('path');
const aiProvider = require('../../server/lib/ai-providers/ai-provider-interface.js');

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

console.log('AI Provider Interface Unit Tests\n');
console.log('=================================\n');

// Test getAvailableProviders
console.log('Testing getAvailableProviders():\n');

test('returns array of provider names', () => {
  const providers = aiProvider.getAvailableProviders();
  if (!Array.isArray(providers)) throw new Error('Should return an array');
  if (providers.length === 0) throw new Error('Should have at least one provider');
});

test('includes openrouter provider', () => {
  const providers = aiProvider.getAvailableProviders();
  if (!providers.includes('openrouter')) throw new Error('Should include openrouter');
});

test('includes anthropic provider', () => {
  const providers = aiProvider.getAvailableProviders();
  if (!providers.includes('anthropic')) throw new Error('Should include anthropic');
});

test('includes gemini provider', () => {
  const providers = aiProvider.getAvailableProviders();
  if (!providers.includes('gemini')) throw new Error('Should include gemini');
});

test('includes openai provider', () => {
  const providers = aiProvider.getAvailableProviders();
  if (!providers.includes('openai')) throw new Error('Should include openai');
});

// Test loadProvider
console.log('\nTesting loadProvider():\n');

test('loads openrouter provider', () => {
  const provider = aiProvider.loadProvider('openrouter');
  if (!provider) throw new Error('Should return provider');
  if (provider.name !== 'openrouter') throw new Error(`Expected 'openrouter', got '${provider.name}'`);
  if (typeof provider.complete !== 'function') throw new Error('Should have complete method');
  if (typeof provider.validate !== 'function') throw new Error('Should have validate method');
});

test('loads anthropic provider', () => {
  const provider = aiProvider.loadProvider('anthropic');
  if (!provider) throw new Error('Should return provider');
  if (provider.name !== 'anthropic') throw new Error(`Expected 'anthropic', got '${provider.name}'`);
});

test('loads gemini provider', () => {
  const provider = aiProvider.loadProvider('gemini');
  if (!provider) throw new Error('Should return provider');
  if (provider.name !== 'gemini') throw new Error(`Expected 'gemini', got '${provider.name}'`);
});

test('loads openai provider', () => {
  const provider = aiProvider.loadProvider('openai');
  if (!provider) throw new Error('Should return provider');
  if (provider.name !== 'openai') throw new Error(`Expected 'openai', got '${provider.name}'`);
});

test('throws error for non-existent provider', () => {
  try {
    aiProvider.loadProvider('nonexistent');
    throw new Error('Should have thrown error');
  } catch (error) {
    if (!error.message.includes('not found')) {
      throw new Error(`Wrong error message: ${error.message}`);
    }
  }
});

// Test getProviderFromEnv
console.log('\nTesting getProviderFromEnv():\n');

test('loads default provider (openrouter) when env not set', () => {
  const originalEnv = process.env.AI_PROVIDER;
  delete process.env.AI_PROVIDER;
  
  try {
    const provider = aiProvider.getProviderFromEnv();
    if (!provider) throw new Error('Should return provider');
    if (provider.name !== 'openrouter') throw new Error(`Expected 'openrouter', got '${provider.name}'`);
  } finally {
    if (originalEnv) process.env.AI_PROVIDER = originalEnv;
  }
});

test('loads provider from environment variable', () => {
  const originalEnv = process.env.AI_PROVIDER;
  process.env.AI_PROVIDER = 'anthropic';
  
  try {
    const provider = aiProvider.getProviderFromEnv();
    if (!provider) throw new Error('Should return provider');
    if (provider.name !== 'anthropic') throw new Error(`Expected 'anthropic', got '${provider.name}'`);
  } finally {
    if (originalEnv) process.env.AI_PROVIDER = originalEnv;
    else delete process.env.AI_PROVIDER;
  }
});

// Test interface contract (placeholder functions)
console.log('\nTesting interface contract:\n');

test('exports complete function', () => {
  if (typeof aiProvider.complete !== 'function') throw new Error('Should export complete');
});

test('exports validate function', () => {
  if (typeof aiProvider.validate !== 'function') throw new Error('Should export validate');
});

test('complete() throws not implemented error', async () => {
  try {
    await aiProvider.complete({ prompt: 'test' });
    throw new Error('Should have thrown error');
  } catch (error) {
    if (!error.message.includes('Not implemented')) {
      throw new Error(`Wrong error message: ${error.message}`);
    }
  }
});

test('validate() throws not implemented error', () => {
  try {
    aiProvider.validate({});
    throw new Error('Should have thrown error');
  } catch (error) {
    if (!error.message.includes('Not implemented')) {
      throw new Error(`Wrong error message: ${error.message}`);
    }
  }
});

// Summary
console.log('\n=================================');
console.log(`Tests: ${passed + failed} total`);
console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed}`);
console.log('=================================\n');

if (failed > 0) {
  process.exit(1);
}
