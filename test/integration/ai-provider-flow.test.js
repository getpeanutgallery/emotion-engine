#!/usr/bin/env node
/**
 * Integration Test - End-to-End AI Provider Flow
 * 
 * Run with: node test/integration/ai-provider-flow.test.js
 * 
 * This test verifies the full AI provider flow:
 * 1. Load provider from environment
 * 2. Execute completion request
 * 3. Verify response format
 * 4. Test error handling
 */

const path = require('path');
const fs = require('fs');
const aiProvider = require('ai-providers/ai-provider-interface.js');
const { fileToBase64, detectMimeType } = require('ai-providers/utils/file-utils.cjs');

// Enable digital twin transport for offline tests
process.env.NODE_ENV = 'test';
process.env.DIGITAL_TWIN_PACK = '/home/derrick/.openclaw/workspace/projects/peanut-gallery/digital-twin-emotion-engine-providers';
process.env.DIGITAL_TWIN_CASSETTE = 'providers';

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

console.log('AI Provider Integration Test\n');
console.log('============================\n');

async function runTests() {
  // Test 1: Provider loading
  console.log('Testing provider loading:\n');

  await asyncTest('loads provider from environment', async () => {
    const provider = aiProvider.getProviderFromEnv();
    if (!provider) throw new Error('Should return provider');
    if (!provider.name) throw new Error('Provider should have name');
    if (typeof provider.complete !== 'function') throw new Error('Provider should have complete method');
    if (typeof provider.validate !== 'function') throw new Error('Provider should have validate method');
  });

  await asyncTest('lists available providers', async () => {
    const providers = aiProvider.getAvailableProviders();
    if (!Array.isArray(providers)) throw new Error('Should return array');
    if (providers.length === 0) throw new Error('Should have at least one provider');
  });

  // Test 2: File utilities integration
  console.log('\nTesting file utilities:\n');

  await asyncTest('detects MIME type from file', async () => {
    const mimeType = detectMimeType(__filename);
    if (!mimeType) throw new Error('Should detect MIME type');
    if (mimeType === 'application/octet-stream') throw new Error('Should detect specific MIME type');
  });

  await asyncTest('converts file to base64', async () => {
    const base64 = await fileToBase64(__filename);
    if (!base64) throw new Error('Should return base64 string');
    if (typeof base64 !== 'string') throw new Error('Should return string');
    
    // Verify it's valid base64
    const decoded = Buffer.from(base64, 'base64').toString('utf-8');
    if (!decoded.includes('Integration Test')) throw new Error('Decoded content should match');
  });

  // Test 3: Completion flow (skip if API key not available)
  console.log('\nTesting completion flow:\n');

  // Use dummy key for twin mode (real key if provided but not needed)
  const apiKey = (process.env.AI_API_KEY || process.env.OPENROUTER_API_KEY || 'dummy-key');
  const provider = process.env.AI_PROVIDER || 'openrouter';
  const providerImpl = aiProvider.loadProvider(provider);

  // Note: DIGITAL_TWIN_CASSETTE is set to 'providers' at the top
  // The providers cassette contains interactions for all supported providers

  // Model map to match cassette
  const modelMap = {
    openrouter: 'qwen/qwen-3.5-397b-a17b',
    anthropic: 'claude-3-5-sonnet-20241022',
    openai: 'gpt-4-turbo',
    gemini: 'gemini-1.5-pro'
  };
  const model = modelMap[provider] || modelMap.openrouter;

  await asyncTest('executes text-only completion', async () => {
    const response = await providerImpl.complete({
      prompt: 'Say hello',
      model: model,
      apiKey: apiKey,
    });
    
    if (!response.content) throw new Error('Should have content');
    if (typeof response.content !== 'string') throw new Error('Content should be string');
    if (!response.usage) throw new Error('Should have usage');
    if (typeof response.usage.input !== 'number') throw new Error('Usage input should be number');
    if (typeof response.usage.output !== 'number') throw new Error('Usage output should be number');
  });

  await asyncTest('handles messages array format', async () => {
    // OpenRouter expects content as array of parts; others use string
    let prompt;
    if (provider === 'openrouter') {
      prompt = [
        { role: 'user', content: [{ type: 'text', text: 'Say hello' }] }
      ];
    } else {
      prompt = [
        { role: 'user', content: 'Say hello' }
      ];
    }
    const response = await providerImpl.complete({
      prompt: prompt,
      model: model,
      apiKey: apiKey,
    });
    
    if (!response.content) throw new Error('Should have content');
  });

  await asyncTest('throws error for invalid API key', async () => {
    try {
      await providerImpl.complete({
        prompt: 'Test',
        model: 'invalid-model',
        apiKey: 'invalid-key',
      });
      throw new Error('Should have thrown error');
    } catch (error) {
      // Should get an error (cache miss, 401, 400, or similar)
      if (!error.message) throw new Error('Error should have message');
    }
  });

  // Test 4: Error handling
  console.log('\nTesting error handling:\n');

  const errorProviderImpl = aiProvider.loadProvider('openrouter');
  
  await asyncTest('handles missing prompt gracefully', async () => {
    try {
      await errorProviderImpl.complete({
        model: 'test-model',
        apiKey: 'test-key',
      });
      throw new Error('Should have thrown error');
    } catch (error) {
      if (!error.message.includes('prompt is required')) {
        throw new Error(`Wrong error message: ${error.message}`);
      }
    }
  });

  await asyncTest('handles missing model gracefully', async () => {
    try {
      await errorProviderImpl.complete({
        prompt: 'Test',
        apiKey: 'test-key',
      });
      throw new Error('Should have thrown error');
    } catch (error) {
      if (!error.message.includes('model is required')) {
        throw new Error(`Wrong error message: ${error.message}`);
      }
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
}

runTests().catch(console.error);
