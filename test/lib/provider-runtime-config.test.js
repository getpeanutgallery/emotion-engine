const test = require('node:test');
const assert = require('node:assert/strict');

const {
  resolveProviderRuntimeConfig,
  resolveProviderRuntimeConfigForTarget,
  ensureRuntimeAuthForDomain,
  buildProviderOptionDefaults
} = require('../../server/lib/provider-runtime-config.cjs');

test('resolveProviderRuntimeConfig uses OpenRouter default base URL when env is unset', () => {
  const runtimeConfig = resolveProviderRuntimeConfig('openrouter', {
    OPENROUTER_API_KEY: 'openrouter-secret'
  });

  assert.equal(runtimeConfig.provider, 'openrouter');
  assert.equal(runtimeConfig.apiKey, 'openrouter-secret');
  assert.equal(runtimeConfig.apiKeySource, 'OPENROUTER_API_KEY');
  assert.equal(runtimeConfig.baseUrl, 'https://openrouter.ai/api/v1');
  assert.equal(runtimeConfig.timeoutMs, null);
  assert.equal(runtimeConfig.authMode, null);
});

test('resolveProviderRuntimeConfig prefers explicit OpenRouter base URL env over default', () => {
  const runtimeConfig = resolveProviderRuntimeConfig('openrouter', {
    OPENROUTER_API_KEY: 'openrouter-secret',
    OPENROUTER_BASE_URL: 'https://openrouter-proxy.example.test/v1'
  });

  assert.equal(runtimeConfig.baseUrl, 'https://openrouter-proxy.example.test/v1');
});

test('resolveProviderRuntimeConfig prefers provider-specific Xiaomi env over AI_API_KEY', () => {
  const runtimeConfig = resolveProviderRuntimeConfig('xiaomi', {
    XIAOMI_API_KEY: 'xiaomi-secret',
    AI_API_KEY: 'generic-secret',
    XIAOMI_BASE_URL: 'https://api.example.test/v1',
    XIAOMI_TIMEOUT_MS: '45000',
    XIAOMI_AUTH_MODE: 'api-key'
  });

  assert.equal(runtimeConfig.provider, 'xiaomi');
  assert.equal(runtimeConfig.apiKey, 'xiaomi-secret');
  assert.equal(runtimeConfig.apiKeySource, 'XIAOMI_API_KEY');
  assert.equal(runtimeConfig.baseUrl, 'https://api.example.test/v1');
  assert.equal(runtimeConfig.timeoutMs, 45000);
  assert.equal(runtimeConfig.authMode, 'api-key');
});

test('resolveProviderRuntimeConfigForTarget falls back to AI_API_KEY when provider-specific key is absent', () => {
  const runtimeConfig = resolveProviderRuntimeConfigForTarget({
    configForTarget: {
      ai: {
        provider: 'xiaomi'
      }
    },
    target: {
      adapter: {
        name: 'xiaomi',
        model: 'mimo-v2-omni'
      }
    },
    env: {
      AI_API_KEY: 'generic-secret'
    }
  });

  assert.equal(runtimeConfig.provider, 'xiaomi');
  assert.equal(runtimeConfig.apiKey, 'generic-secret');
  assert.equal(runtimeConfig.apiKeySource, 'AI_API_KEY');
  assert.equal(runtimeConfig.baseUrl, 'https://api.xiaomimimo.com/v1');
  assert.equal(runtimeConfig.authMode, 'bearer');
});

test('ensureRuntimeAuthForDomain accepts provider-specific env for configured Xiaomi target', () => {
  assert.equal(ensureRuntimeAuthForDomain({
    config: {
      ai: {
        video: {
          targets: [
            { adapter: { name: 'xiaomi', model: 'mimo-v2-omni' } }
          ]
        }
      }
    },
    domain: 'video',
    env: {
      XIAOMI_API_KEY: 'xiaomi-secret'
    },
    prefix: 'WholeVideoMiMo'
  }), true);
});

test('ensureRuntimeAuthForDomain throws a provider-aware error when credentials are missing', () => {
  assert.throws(() => ensureRuntimeAuthForDomain({
    config: {
      ai: {
        video: {
          targets: [
            { adapter: { name: 'xiaomi', model: 'mimo-v2-omni' } }
          ]
        }
      }
    },
    domain: 'video',
    env: {},
    prefix: 'WholeVideoMiMo'
  }), /WholeVideoMiMo: missing provider credentials.*xiaomi: XIAOMI_API_KEY or AI_API_KEY/);
});

test('buildProviderOptionDefaults injects runtime timeout/auth defaults without clobbering explicit defaults', () => {
  const merged = buildProviderOptionDefaults({
    timeoutMs: 33000,
    authMode: 'api-key'
  }, {
    temperature: 0.2,
    timeoutMs: 12000
  });

  assert.deepEqual(merged, {
    temperature: 0.2,
    timeoutMs: 12000,
    authMode: 'api-key'
  });
});
