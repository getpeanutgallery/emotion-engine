const test = require('node:test');
const assert = require('node:assert/strict');

const {
  normalizeThinkingLevel,
  normalizeAdapterParamsForProvider,
  buildProviderOptions,
  DEFAULT_DEVELOPMENT_MAX_TOKENS,
  DEFAULT_DEVELOPMENT_THINKING_LEVEL,
  getErrorStatus,
  getErrorRequestId,
  preserveWrappedTransportMetadata,
  getErrorResponseBody,
  getErrorClassification,
  getPersistedErrorInfo,
  isRetryableRuntimeError,
  executeWithTargets
} = require('../../server/lib/ai-targets.cjs');

test('normalizeThinkingLevel accepts normalized levels case-insensitively', () => {
  assert.equal(normalizeThinkingLevel('LOW'), 'low');
  assert.equal(normalizeThinkingLevel(' medium '), 'medium');
  assert.equal(normalizeThinkingLevel('off'), 'off');
  assert.equal(normalizeThinkingLevel('invalid'), null);
  assert.equal(normalizeThinkingLevel(42), null);
});

test('normalizeAdapterParamsForProvider maps normalized YAML params for openrouter', () => {
  const params = normalizeAdapterParamsForProvider({
    name: 'openrouter',
    params: {
      temperature: 0.2,
      max_tokens: 900,
      thinking: { level: 'high' }
    }
  });

  assert.deepEqual(params, {
    temperature: 0.2,
    maxTokens: 900,
    reasoning: {
      effort: 'high',
      enabled: true
    }
  });
});

test('normalizeAdapterParamsForProvider injects development defaults when adapter params are absent', () => {
  const params = normalizeAdapterParamsForProvider({ name: 'openrouter' });

  assert.deepEqual(params, {
    maxTokens: DEFAULT_DEVELOPMENT_MAX_TOKENS,
    reasoning: {
      effort: DEFAULT_DEVELOPMENT_THINKING_LEVEL,
      enabled: true
    }
  });
});

test('normalizeAdapterParamsForProvider preserves explicit maxTokens and disables reasoning for thinking.off', () => {
  const params = normalizeAdapterParamsForProvider({
    name: 'openrouter',
    params: {
      max_tokens: 900,
      maxTokens: 111,
      thinking: { level: 'off' },
      reasoning: { foo: 'bar' }
    }
  });

  assert.deepEqual(params, {
    maxTokens: 111,
    reasoning: {
      foo: 'bar',
      effort: 'none',
      enabled: false
    }
  });
});

test('buildProviderOptions merges defaults with normalized adapter params', () => {
  const options = buildProviderOptions({
    adapter: {
      name: 'openrouter',
      params: {
        temperature: 0.9,
        max_tokens: 333,
        thinking: { level: 'low' }
      }
    },
    defaults: {
      temperature: 0.2
    }
  });

  assert.deepEqual(options, {
    temperature: 0.9,
    maxTokens: 333,
    reasoning: {
      effort: 'low',
      enabled: true
    }
  });
});

test('normalizeAdapterParamsForProvider leaves unsupported adapters as passthrough except normalized aliases', () => {
  const params = normalizeAdapterParamsForProvider({
    name: 'anthropic',
    params: {
      max_tokens: 512,
      thinking: { level: 'medium' },
      temperature: 0.1
    }
  });

  assert.deepEqual(params, {
    maxTokens: 512,
    temperature: 0.1
  });
});

test('buildProviderOptions applies development max token defaults to unsupported adapters too', () => {
  const options = buildProviderOptions({
    adapter: {
      name: 'openai'
    },
    defaults: {
      temperature: 0.4
    }
  });

  assert.deepEqual(options, {
    temperature: 0.4,
    maxTokens: DEFAULT_DEVELOPMENT_MAX_TOKENS
  });
});

test('getPersistedErrorInfo falls back to debug response metadata when response is absent', () => {
  const error = new Error('OpenRouter: upstream failure');
  error.debug = {
    provider: 'openrouter',
    response: {
      status: 503,
      headers: {
        'x-request-id': 'req_debug_123'
      },
      body: JSON.stringify({
        error: {
          code: 503,
          message: 'service unavailable',
          metadata: { provider_name: 'openrouter' }
        }
      })
    }
  };
  error.aiTargets = { classification: 'retryable' };

  assert.equal(getErrorStatus(error), 503);
  assert.equal(getErrorRequestId(error), 'req_debug_123');
  assert.deepEqual(getErrorResponseBody(error), {
    error: {
      code: 503,
      message: 'service unavailable',
      metadata: { provider_name: 'openrouter' }
    }
  });
  assert.equal(getErrorClassification(error), 'retryable');
  assert.deepEqual(getPersistedErrorInfo(error), {
    status: 503,
    requestId: 'req_debug_123',
    classification: 'retryable',
    response: {
      error: {
        code: 503,
        message: 'service unavailable',
        metadata: { provider_name: 'openrouter' }
      }
    }
  });
});

test('getErrorResponseBody synthesizes OpenRouter-style error payload from debug.providerError', () => {
  const error = new Error('OpenRouter: moderation flagged');
  error.debug = {
    provider: 'openrouter',
    providerError: {
      httpStatus: 403,
      code: 403,
      message: 'moderation flagged',
      metadata: {
        reasons: ['self-harm'],
        provider_name: 'openrouter'
      }
    }
  };

  assert.deepEqual(getErrorResponseBody(error), {
    error: {
      code: 403,
      message: 'moderation flagged',
      metadata: {
        reasons: ['self-harm'],
        provider_name: 'openrouter'
      }
    }
  });
});

test('preserveWrappedTransportMetadata lifts code, status, and requestId from wrapped debug payloads', () => {
  const error = new Error('OpenRouter: aborted');
  error.name = 'OpenRouterError';
  error.debug = {
    provider: 'openrouter',
    error: {
      code: 'ECONNRESET',
      message: 'aborted'
    },
    response: {
      status: 502,
      headers: {
        'x-request-id': 'req_wrapped_123'
      }
    }
  };

  const preserved = preserveWrappedTransportMetadata(error);

  assert.equal(preserved, error);
  assert.equal(error.code, 'ECONNRESET');
  assert.equal(error.status, 502);
  assert.equal(error.requestId, 'req_wrapped_123');
  assert.equal(getErrorRequestId(error), 'req_wrapped_123');
});

test('preserveWrappedTransportMetadata enables retryable classification for wrapped transport aborts', () => {
  const error = new Error('OpenRouter: aborted');
  error.name = 'OpenRouterError';
  error.debug = {
    provider: 'openrouter',
    error: {
      code: 'ECONNRESET',
      message: 'aborted'
    }
  };

  assert.equal(isRetryableRuntimeError(error), false);
  preserveWrappedTransportMetadata(error);
  assert.equal(error.code, 'ECONNRESET');
  assert.equal(isRetryableRuntimeError(error), true);
});

test('executeWithTargets retries wrapped transport aborts after metadata preservation', async () => {
  let attempts = 0;
  const wrappedAbort = new Error('OpenRouter: aborted');
  wrappedAbort.name = 'OpenRouterError';
  wrappedAbort.debug = {
    provider: 'openrouter',
    error: {
      code: 'ECONNRESET',
      message: 'aborted'
    },
    response: {
      headers: {
        'x-request-id': 'req_retry_123'
      }
    }
  };

  const result = await executeWithTargets({
    config: {
      ai: {
        provider: 'openrouter',
        video: {
          targets: [
            { adapter: { name: 'openrouter', model: 'primary-model' } }
          ]
        }
      }
    },
    domain: 'video',
    retry: { maxAttempts: 2, backoffMs: 0 },
    replayMode: true,
    operation: async () => {
      attempts += 1;
      if (attempts === 1) throw wrappedAbort;
      return { ok: true };
    }
  });

  assert.equal(attempts, 2);
  assert.deepEqual(result.result, { ok: true });
  assert.equal(wrappedAbort.code, 'ECONNRESET');
  assert.equal(wrappedAbort.requestId, 'req_retry_123');
  assert.equal(wrappedAbort.aiTargets.classification, 'retryable');
});
