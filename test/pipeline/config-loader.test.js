#!/usr/bin/env node
/**
 * Config Loader Unit Tests
 * 
 * Tests for server/lib/config-loader.cjs
 * Uses Node.js native test runner
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');
const test = require('node:test');
const {
  loadConfig,
  parseConfig,
  validateConfig,
  getScriptsFromPhase,
  isParallelPhase
} = require('../../server/lib/config-loader.cjs');

test('Config Loader - loadConfig', async (t) => {
  await t.test('should load YAML config file', async () => {
    const configPath = path.join(__dirname, 'fixtures', 'valid-config.yaml');
    const config = await loadConfig(configPath);
    
    assert.strictEqual(config.name, 'Test Pipeline');
    assert.strictEqual(config.asset.inputPath, 'test.mp4');
    assert.strictEqual(config.asset.outputDir, 'output/test');
  });
  
  await t.test('should load JSON config file', async () => {
    const configPath = path.join(__dirname, 'fixtures', 'valid-config.json');
    const config = await loadConfig(configPath);
    
    assert.strictEqual(config.name, 'Test Pipeline JSON');
    assert.strictEqual(config.asset.inputPath, 'test.json');
  });
  
  await t.test('should throw error for missing file', async () => {
    await assert.rejects(
      async () => loadConfig('nonexistent.yaml'),
      /not found/
    );
  });
  
  await t.test('should throw error for unsupported format', async () => {
    const tempPath = path.join(__dirname, 'fixtures', 'test.txt');
    fs.writeFileSync(tempPath, 'test content');
    
    try {
      await assert.rejects(
        async () => loadConfig(tempPath),
        /Unsupported config file format/
      );
    } finally {
      fs.unlinkSync(tempPath);
    }
  });
});

test('Config Loader - parseConfig', async (t) => {
  await t.test('should parse YAML string', () => {
    const yamlString = 'name: Test\nasset:\n  inputPath: test.mp4';
    const config = parseConfig(yamlString, 'yaml');
    
    assert.strictEqual(config.name, 'Test');
    assert.strictEqual(config.asset.inputPath, 'test.mp4');
  });
  
  await t.test('should parse JSON string', () => {
    const jsonString = '{"name": "Test", "asset": {"inputPath": "test.mp4"}}';
    const config = parseConfig(jsonString, 'json');
    
    assert.strictEqual(config.name, 'Test');
    assert.strictEqual(config.asset.inputPath, 'test.mp4');
  });
  
  await t.test('should throw error for invalid YAML', () => {
    assert.throws(
      () => parseConfig('invalid: yaml: content:', 'yaml'),
      /Failed to parse/
    );
  });
  
  await t.test('should throw error for invalid JSON', () => {
    assert.throws(
      () => parseConfig('{invalid json}', 'json'),
      /Failed to parse/
    );
  });
});

test('Config Loader - validateConfig', async (t) => {
  await t.test('should validate config with gather_context scripts', () => {
    const config = {
      asset: { inputPath: 'test.mp4', outputDir: 'output' },
      ai: {
        provider: 'openrouter',
        dialogue: { model: 'qwen/qwen-3.5-397b-a17b' },
        music: { model: 'qwen/qwen-3.5-397b-a17b' },
        video: { model: 'qwen/qwen-3.5-397b-a17b' }
      },
      gather_context: ['script1.cjs', 'script2.cjs']
    };
    
    const result = validateConfig(config);
    assert.strictEqual(result.valid, true);
    assert.strictEqual(result.totalScripts, 2);
  });
  
  await t.test('should validate config with process scripts', () => {
    const config = {
      asset: { inputPath: 'test.mp4', outputDir: 'output' },
      ai: {
        provider: 'openrouter',
        dialogue: { model: 'qwen/qwen-3.5-397b-a17b' },
        music: { model: 'qwen/qwen-3.5-397b-a17b' },
        video: { model: 'qwen/qwen-3.5-397b-a17b' }
      },
      process: ['script1.cjs']
    };
    
    const result = validateConfig(config);
    assert.strictEqual(result.valid, true);
    assert.strictEqual(result.totalScripts, 1);
  });
  
  await t.test('should validate config with report scripts', () => {
    const config = {
      asset: { inputPath: 'test.mp4', outputDir: 'output' },
      ai: {
        provider: 'openrouter',
        dialogue: { model: 'qwen/qwen-3.5-397b-a17b' },
        music: { model: 'qwen/qwen-3.5-397b-a17b' },
        video: { model: 'qwen/qwen-3.5-397b-a17b' }
      },
      report: ['script1.cjs']
    };
    
    const result = validateConfig(config);
    assert.strictEqual(result.valid, true);
    assert.strictEqual(result.totalScripts, 1);
  });
  
  await t.test('should fail validation with no scripts', () => {
    const config = {
      asset: { inputPath: 'test.mp4', outputDir: 'output' }
    };
    
    const result = validateConfig(config);
    assert.strictEqual(result.valid, false);
    assert(result.errors.some(e => e.includes('at least 1 script')));
  });
  
  await t.test('should fail validation with missing asset.inputPath', () => {
    const config = {
      asset: { outputDir: 'output' },
      gather_context: ['script1.cjs']
    };
    
    const result = validateConfig(config);
    assert.strictEqual(result.valid, false);
    assert(result.errors.some(e => e.includes('inputPath')));
  });
  
  await t.test('should fail validation with missing asset.outputDir', () => {
    const config = {
      asset: { inputPath: 'test.mp4' },
      gather_context: ['script1.cjs']
    };
    
    const result = validateConfig(config);
    assert.strictEqual(result.valid, false);
    assert(result.errors.some(e => e.includes('outputDir')));
  });
  
  await t.test('should validate parallel execution format', () => {
    const config = {
      asset: { inputPath: 'test.mp4', outputDir: 'output' },
      ai: {
        provider: 'openrouter',
        dialogue: { model: 'qwen/qwen-3.5-397b-a17b' },
        music: { model: 'qwen/qwen-3.5-397b-a17b' },
        video: { model: 'qwen/qwen-3.5-397b-a17b' }
      },
      gather_context: {
        parallel: [
          { script: 'script1.cjs' },
          { script: 'script2.cjs' }
        ]
      }
    };
    
    const result = validateConfig(config);
    assert.strictEqual(result.valid, true);
    assert.strictEqual(result.totalScripts, 2);
  });
  
  await t.test('should validate sequential process format', () => {
    const config = {
      asset: { inputPath: 'test.mp4', outputDir: 'output' },
      ai: {
        provider: 'openrouter',
        dialogue: { model: 'qwen/qwen-3.5-397b-a17b' },
        music: { model: 'qwen/qwen-3.5-397b-a17b' },
        video: { model: 'qwen/qwen-3.5-397b-a17b' }
      },
      process: {
        sequential: [
          { script: 'script1.cjs' },
          { script: 'script2.cjs' }
        ]
      }
    };
    
    const result = validateConfig(config);
    assert.strictEqual(result.valid, true);
    assert.strictEqual(result.totalScripts, 2);
  });
});

test('Config Loader - validateConfig AI requirements', async (t) => {
  await t.test('should validate config with complete AI configuration', () => {
    const config = {
      asset: { inputPath: 'test.mp4', outputDir: 'output' },
      ai: {
        provider: 'openrouter',
        dialogue: { model: 'qwen/qwen-3.5-397b-a17b' },
        music: { model: 'qwen/qwen-3.5-397b-a17b' },
        video: { model: 'qwen/qwen-3.5-397b-a17b' }
      },
      gather_context: ['script1.cjs']
    };
    
    const result = validateConfig(config);
    assert.strictEqual(result.valid, true);
    assert.strictEqual(result.errors.length, 0);
  });
  
  await t.test('should fail validation with missing ai configuration', () => {
    const config = {
      asset: { inputPath: 'test.mp4', outputDir: 'output' },
      gather_context: ['script1.cjs']
    };
    
    const result = validateConfig(config);
    assert.strictEqual(result.valid, false);
    assert(result.errors.some(e => e.includes('Missing required "ai" configuration')));
  });
  
  await t.test('should fail validation with missing ai.provider', () => {
    const config = {
      asset: { inputPath: 'test.mp4', outputDir: 'output' },
      ai: {
        dialogue: { model: 'qwen/qwen-3.5-397b-a17b' },
        music: { model: 'qwen/qwen-3.5-397b-a17b' },
        video: { model: 'qwen/qwen-3.5-397b-a17b' }
      },
      gather_context: ['script1.cjs']
    };
    
    const result = validateConfig(config);
    assert.strictEqual(result.valid, false);
    assert(result.errors.some(e => e.includes('Missing required "ai.provider"')));
  });
  
  await t.test('should fail validation with missing ai.dialogue.model', () => {
    const config = {
      asset: { inputPath: 'test.mp4', outputDir: 'output' },
      ai: {
        provider: 'openrouter',
        music: { model: 'qwen/qwen-3.5-397b-a17b' },
        video: { model: 'qwen/qwen-3.5-397b-a17b' }
      },
      gather_context: ['script1.cjs']
    };
    
    const result = validateConfig(config);
    assert.strictEqual(result.valid, false);
    assert(result.errors.some(e => e.includes('Missing required "ai.dialogue.model"')));
  });
  
  await t.test('should fail validation with missing ai.music.model', () => {
    const config = {
      asset: { inputPath: 'test.mp4', outputDir: 'output' },
      ai: {
        provider: 'openrouter',
        dialogue: { model: 'qwen/qwen-3.5-397b-a17b' },
        video: { model: 'qwen/qwen-3.5-397b-a17b' }
      },
      gather_context: ['script1.cjs']
    };
    
    const result = validateConfig(config);
    assert.strictEqual(result.valid, false);
    assert(result.errors.some(e => e.includes('Missing required "ai.music.model"')));
  });
  
  await t.test('should fail validation with missing ai.video.model', () => {
    const config = {
      asset: { inputPath: 'test.mp4', outputDir: 'output' },
      ai: {
        provider: 'openrouter',
        dialogue: { model: 'qwen/qwen-3.5-397b-a17b' },
        music: { model: 'qwen/qwen-3.5-397b-a17b' }
      },
      gather_context: ['script1.cjs']
    };
    
    const result = validateConfig(config);
    assert.strictEqual(result.valid, false);
    assert(result.errors.some(e => e.includes('Missing required "ai.video.model"')));
  });
  
  await t.test('should fail validation when ai.model is present (forbidden)', () => {
    const config = {
      asset: { inputPath: 'test.mp4', outputDir: 'output' },
      ai: {
        provider: 'openrouter',
        model: 'some-model', // Forbidden top-level model
        dialogue: { model: 'qwen/qwen-3.5-397b-a17b' },
        music: { model: 'qwen/qwen-3.5-397b-a17b' },
        video: { model: 'qwen/qwen-3.5-397b-a17b' }
      },
      gather_context: ['script1.cjs']
    };
    
    const result = validateConfig(config);
    assert.strictEqual(result.valid, false);
    assert(result.errors.some(e => e.includes('Forbidden "ai.model"') && e.includes('explicit domain models')));
  });
  
  await t.test('should allow ai.model to be undefined (not an error)', () => {
    const config = {
      asset: { inputPath: 'test.mp4', outputDir: 'output' },
      ai: {
        provider: 'openrouter',
        dialogue: { model: 'qwen/qwen-3.5-397b-a17b' },
        music: { model: 'qwen/qwen-3.5-397b-a17b' },
        video: { model: 'qwen/qwen-3.5-397b-a17b' }
      },
      gather_context: ['script1.cjs']
    };
    
    // Ensure ai.model is explicitly undefined (not present)
    assert.strictEqual(config.ai.model, undefined);
    
    const result = validateConfig(config);
    assert.strictEqual(result.valid, true);
  });
});

test('Config Loader - getScriptsFromPhase', async (t) => {
  await t.test('should extract scripts from array', () => {
    const phaseConfig = ['script1.cjs', 'script2.cjs'];
    const scripts = getScriptsFromPhase(phaseConfig);
    
    assert.strictEqual(scripts.length, 2);
    assert.strictEqual(scripts[0].script, 'script1.cjs');
  });
  
  await t.test('should extract scripts from parallel object', () => {
    const phaseConfig = {
      parallel: [
        { script: 'script1.cjs', toolVariables: {} },
        { script: 'script2.cjs' }
      ]
    };
    const scripts = getScriptsFromPhase(phaseConfig);
    
    assert.strictEqual(scripts.length, 2);
    assert.strictEqual(scripts[0].script, 'script1.cjs');
    assert(scripts[0].toolVariables);
  });
  
  await t.test('should return empty array for undefined', () => {
    const scripts = getScriptsFromPhase(undefined);
    assert.strictEqual(scripts.length, 0);
  });
});

test('Config Loader - isParallelPhase', async (t) => {
  await t.test('should return true for parallel format', () => {
    const phaseConfig = {
      parallel: [{ script: 'script1.cjs' }]
    };
    assert.strictEqual(isParallelPhase(phaseConfig), true);
  });
  
  await t.test('should return false for array format', () => {
    const phaseConfig = ['script1.cjs'];
    assert.strictEqual(isParallelPhase(phaseConfig), false);
  });
  
  await t.test('should return false for undefined', () => {
    assert.strictEqual(isParallelPhase(undefined), false);
  });
});

console.log('✅ Config loader tests complete');
