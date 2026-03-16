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

function makeFfmpegSettings() {
  return {
    ffmpeg: {
      audio: {
        loglevel: 'error',
        codec: 'pcm_s16le',
        sample_rate_hz: 16000,
        channels: 1,
        container: 'wav'
      },
      video: {
        compress: {
          vcodec: 'libx264',
          preset: 'fast',
          max_width: 1280,
          fps: 24,
          audio_codec: 'aac',
          audio_bitrate: '128k',
          size_headroom_ratio: 0.9
        },
        compress_aggressive: {
          vcodec: 'libx264',
          preset: 'slow',
          fps: 24,
          audio_codec: 'aac',
          audio_bitrate: '96k',
          vf: "scale='min(1280,iw)':-1:force_original_aspect_ratio=decrease",
          maxrate_multiplier: 1.2,
          bufsize_multiplier: 2,
          size_headroom_ratio: 0.95
        }
      }
    }
  };
}

function makeAiConfig({
  adapterName = 'openrouter',
  dialogueModel = 'qwen/qwen-3.5-397b-a17b',
  musicModel = 'qwen/qwen-3.5-397b-a17b',
  videoModel = 'qwen/qwen-3.5-397b-a17b',
  dialogueParams,
  musicParams,
  videoParams,
  dialogueRetry,
  musicRetry,
  videoRetry
} = {}) {
  const target = (model, params) => ({
    adapter: {
      name: adapterName,
      model,
      ...(params !== undefined ? { params } : {})
    }
  });

  return {
    dialogue: {
      ...(dialogueRetry !== undefined ? { retry: dialogueRetry } : {}),
      targets: [target(dialogueModel, dialogueParams)]
    },
    music: {
      ...(musicRetry !== undefined ? { retry: musicRetry } : {}),
      targets: [target(musicModel, musicParams)]
    },
    video: {
      ...(videoRetry !== undefined ? { retry: videoRetry } : {}),
      targets: [target(videoModel, videoParams)]
    }
  };
}

test('Config Loader - loadConfig', async (t) => {
  await t.test('should load YAML config file', async () => {
    const configPath = path.join(__dirname, 'fixtures', 'valid-config.yaml');
    const config = await loadConfig(configPath);
    
    assert.strictEqual(config.name, 'Test Pipeline');
    assert.strictEqual(config.asset.inputPath, 'test.mp4');
    assert.strictEqual(config.asset.outputDir, 'output/test');
  });


  await t.test('should load configs/video-analysis.yaml (single-document YAML)', async () => {
    const repoRoot = path.resolve(__dirname, '..', '..');
    const configPath = path.join(repoRoot, 'configs', 'video-analysis.yaml');
    const config = await loadConfig(configPath);

    assert.strictEqual(typeof config, 'object');
    assert(config.asset?.inputPath, 'config.asset.inputPath should exist');
    assert(config.asset?.outputDir, 'config.asset.outputDir should exist');
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
      ai: makeAiConfig(),
      settings: makeFfmpegSettings(),
      gather_context: ['script1.cjs', 'script2.cjs']
    };
    
    const result = validateConfig(config);
    assert.strictEqual(result.valid, true);
    assert.strictEqual(result.totalScripts, 2);
  });
  
  await t.test('should validate config with process scripts', () => {
    const config = {
      asset: { inputPath: 'test.mp4', outputDir: 'output' },
      ai: makeAiConfig(),
      settings: makeFfmpegSettings(),
      process: ['script1.cjs']
    };
    
    const result = validateConfig(config);
    assert.strictEqual(result.valid, true);
    assert.strictEqual(result.totalScripts, 1);
  });
  
  await t.test('should validate config with report scripts', () => {
    const config = {
      asset: { inputPath: 'test.mp4', outputDir: 'output' },
      ai: makeAiConfig(),
      settings: makeFfmpegSettings(),
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

  await t.test('should allow normalized adapter params objects', () => {
    const config = {
      asset: { inputPath: 'test.mp4', outputDir: 'output' },
      ai: makeAiConfig({
        videoParams: {
          max_tokens: 900,
          thinking: { level: 'low' }
        }
      }),
      settings: makeFfmpegSettings(),
      process: ['script1.cjs']
    };

    const result = validateConfig(config);
    assert.strictEqual(result.valid, true);
  });
  
  await t.test('should validate parallel execution format', () => {
    const config = {
      asset: { inputPath: 'test.mp4', outputDir: 'output' },
      ai: makeAiConfig(),
      settings: makeFfmpegSettings(),
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
      ai: makeAiConfig(),
      settings: makeFfmpegSettings(),
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

  await t.test('should validate debug.keepProcessedIntermediates as boolean', () => {
    const config = {
      asset: { inputPath: 'test.mp4', outputDir: 'output' },
      ai: makeAiConfig(),
      settings: makeFfmpegSettings(),
      gather_context: ['script1.cjs'],
      debug: {
        keepProcessedIntermediates: false
      }
    };

    const result = validateConfig(config);
    assert.strictEqual(result.valid, true);
  });

  await t.test('should fail validation when debug.keepProcessedIntermediates is not boolean', () => {
    const config = {
      asset: { inputPath: 'test.mp4', outputDir: 'output' },
      ai: makeAiConfig(),
      settings: makeFfmpegSettings(),
      gather_context: ['script1.cjs'],
      debug: {
        keepProcessedIntermediates: 'nope'
      }
    };

    const result = validateConfig(config);
    assert.strictEqual(result.valid, false);
    assert(result.errors.some(e => e.includes('"debug.keepProcessedIntermediates" must be a boolean')));
  });

  await t.test('should validate debug.captureRaw as boolean', () => {
    const config = {
      asset: { inputPath: 'test.mp4', outputDir: 'output' },
      ai: makeAiConfig(),
      settings: makeFfmpegSettings(),
      gather_context: ['script1.cjs'],
      debug: {
        captureRaw: true
      }
    };

    const result = validateConfig(config);
    assert.strictEqual(result.valid, true);
  });

  await t.test('should fail validation when debug.captureRaw is not boolean', () => {
    const config = {
      asset: { inputPath: 'test.mp4', outputDir: 'output' },
      ai: makeAiConfig(),
      settings: makeFfmpegSettings(),
      gather_context: ['script1.cjs'],
      debug: {
        captureRaw: 'yes'
      }
    };

    const result = validateConfig(config);
    assert.strictEqual(result.valid, false);
    assert(result.errors.some(e => e.includes('"debug.captureRaw" must be a boolean')));
  });

  await t.test('should validate YAML-driven recovery policy settings when provided', () => {
    const config = {
      asset: { inputPath: 'test.mp4', outputDir: 'output' },
      ai: makeAiConfig(),
      settings: makeFfmpegSettings(),
      gather_context: ['script1.cjs'],
      recovery: {
        ai: {
          enabled: true,
          adapter: 'google',
          model: 'gemini-3.1-pro-preview',
          attempts: { maxPerFailure: 1, maxPerScriptRun: 1, maxPerPipelineRun: 3 },
          budgets: { maxInputTokens: 12000, maxOutputTokens: 2000, maxTotalTokens: 14000, maxCostUsd: 0.25 }
        }
      }
    };

    const result = validateConfig(config);
    assert.strictEqual(result.valid, true);
    assert.strictEqual(result.normalizedRecovery.ai.enabled, true);
    assert.strictEqual(result.normalizedRecovery.ai.budgets.maxTotalTokens, 14000);
  });

  await t.test('should fail validation for malformed recovery policy settings', () => {
    const config = {
      asset: { inputPath: 'test.mp4', outputDir: 'output' },
      ai: makeAiConfig(),
      settings: makeFfmpegSettings(),
      gather_context: ['script1.cjs'],
      recovery: {
        ai: {
          enabled: 'yes',
          attempts: { maxPerFailure: -1 }
        }
      }
    };

    const result = validateConfig(config);
    assert.strictEqual(result.valid, false);
    assert(result.errors.some(e => e.includes('recovery.ai.enabled')));
    assert(result.errors.some(e => e.includes('recovery.ai.attempts.maxPerFailure')));
  });

  await t.test('should fail validation when settings.ffmpeg is missing', () => {
    const config = {
      asset: { inputPath: 'test.mp4', outputDir: 'output' },
      ai: makeAiConfig(),
      gather_context: ['script1.cjs']
    };

    const result = validateConfig(config);
    assert.strictEqual(result.valid, false);
    assert(result.errors.some(e => e.includes('Missing required "settings.ffmpeg"')));
  });

  await t.test('should fail validation when settings.ffmpeg video bitrate is invalid', () => {
    const settings = makeFfmpegSettings();
    settings.ffmpeg.video.compress.audio_bitrate = '128';

    const config = {
      asset: { inputPath: 'test.mp4', outputDir: 'output' },
      ai: makeAiConfig(),
      settings,
      gather_context: ['script1.cjs']
    };

    const result = validateConfig(config);
    assert.strictEqual(result.valid, false);
    assert(result.errors.some(e => e.includes('settings.ffmpeg.video.compress.audio_bitrate')));
  });
});

test('Config Loader - validateConfig AI requirements', async (t) => {
  await t.test('should validate config with complete AI configuration', () => {
    const config = {
      asset: { inputPath: 'test.mp4', outputDir: 'output' },
      ai: makeAiConfig(),
      settings: makeFfmpegSettings(),
      gather_context: ['script1.cjs']
    };

    const result = validateConfig(config);
    assert.strictEqual(result.valid, true);
    assert.strictEqual(result.errors.length, 0);
  });

  await t.test('should validate ai.video.retry when configured', () => {
    const config = {
      asset: { inputPath: 'test.mp4', outputDir: 'output' },
      ai: makeAiConfig({
        videoRetry: {
          maxAttempts: 2,
          backoffMs: 500
        }
      }),
      settings: makeFfmpegSettings(),
      gather_context: ['script1.cjs']
    };

    const result = validateConfig(config);
    assert.strictEqual(result.valid, true);
  });

  await t.test('should fail validation with invalid ai.video.retry fields', () => {
    const config = {
      asset: { inputPath: 'test.mp4', outputDir: 'output' },
      ai: makeAiConfig({
        videoRetry: {
          maxAttempts: 0,
          backoffMs: -1,
          retryOnParseError: true
        }
      }),
      settings: makeFfmpegSettings(),
      gather_context: ['script1.cjs']
    };

    const result = validateConfig(config);
    assert.strictEqual(result.valid, false);
    assert(result.errors.some(e => e.includes('"ai.video.retry.maxAttempts"')));
    assert(result.errors.some(e => e.includes('"ai.video.retry.backoffMs"')));
    assert(result.errors.some(e => e.includes('Unsupported "ai.video.retry.retryOnParseError"')));
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

  await t.test('should fail validation when ai.provider is present (forbidden)', () => {
    const ai = makeAiConfig();
    ai.provider = 'openrouter';

    const config = {
      asset: { inputPath: 'test.mp4', outputDir: 'output' },
      ai,
      gather_context: ['script1.cjs']
    };

    const result = validateConfig(config);
    assert.strictEqual(result.valid, false);
    assert(result.errors.some(e => e.includes('Forbidden "ai.provider"')));
  });

  await t.test('should fail validation with missing ai.dialogue.targets', () => {
    const ai = makeAiConfig();
    delete ai.dialogue;

    const config = {
      asset: { inputPath: 'test.mp4', outputDir: 'output' },
      ai,
      gather_context: ['script1.cjs']
    };

    const result = validateConfig(config);
    assert.strictEqual(result.valid, false);
    assert(result.errors.some(e => e.includes('Missing required "ai.dialogue.targets"')));
  });

  await t.test('should fail validation when ai.dialogue.model is present (forbidden legacy key)', () => {
    const ai = makeAiConfig();
    ai.dialogue.model = 'legacy-model';

    const config = {
      asset: { inputPath: 'test.mp4', outputDir: 'output' },
      ai,
      gather_context: ['script1.cjs']
    };

    const result = validateConfig(config);
    assert.strictEqual(result.valid, false);
    assert(result.errors.some(e => e.includes('Forbidden "ai.dialogue.model"')));
  });

  await t.test('should fail validation with missing ai.music.targets', () => {
    const ai = makeAiConfig();
    delete ai.music;

    const config = {
      asset: { inputPath: 'test.mp4', outputDir: 'output' },
      ai,
      gather_context: ['script1.cjs']
    };

    const result = validateConfig(config);
    assert.strictEqual(result.valid, false);
    assert(result.errors.some(e => e.includes('Missing required "ai.music.targets"')));
  });

  await t.test('should fail validation with missing ai.video.targets', () => {
    const ai = makeAiConfig();
    delete ai.video;

    const config = {
      asset: { inputPath: 'test.mp4', outputDir: 'output' },
      ai,
      gather_context: ['script1.cjs']
    };

    const result = validateConfig(config);
    assert.strictEqual(result.valid, false);
    assert(result.errors.some(e => e.includes('Missing required "ai.video.targets"')));
  });

  await t.test('should fail validation when ai.model is present (forbidden)', () => {
    const ai = makeAiConfig();
    ai.model = 'some-model';

    const config = {
      asset: { inputPath: 'test.mp4', outputDir: 'output' },
      ai,
      gather_context: ['script1.cjs']
    };

    const result = validateConfig(config);
    assert.strictEqual(result.valid, false);
    assert(result.errors.some(e => e.includes('Forbidden "ai.model"')));
  });

  await t.test('should allow ai.model to be undefined (not an error)', () => {
    const config = {
      asset: { inputPath: 'test.mp4', outputDir: 'output' },
      ai: makeAiConfig(),
      settings: makeFfmpegSettings(),
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
