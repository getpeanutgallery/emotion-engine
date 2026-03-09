#!/usr/bin/env node
/**
 * AI Targets Helper
 *
 * Executes an AI operation against an ordered list of adapter targets with a single,
 * consolidated retry loop.
 *
 * Targets are YAML-driven via config.ai.<domain>.targets.
 * Each target is expected to contain adapter identification:
 *   - { adapter: { name: string, model: string, params?: any } }
 *
 * This helper enforces:
 *  - Retryable runtime errors (timeouts/5xx/429/no-content/parse-invalid, etc.) retry
 *    up to retry.maxAttempts per target, then fail over to the next target.
 *  - Auth/OAuth errors fail fast (no retry, no failover).
 *  - Capability mismatch errors fail fast (no retry, no failover).
 */

const aiProviderInterface = require('ai-providers/ai-provider-interface.js');

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getErrorStatus(error) {
  const status = error?.response?.status
    ?? error?.debug?.response?.status
    ?? error?.status;
  return Number.isInteger(status) ? status : null;
}

function isAuthError(error) {
  if (error?.aiTargets?.classification === 'auth') return true;

  const status = getErrorStatus(error);
  if (status === 401 || status === 403 || status === 402) return true;

  const msg = String(error?.message || '').toLowerCase();
  return msg.includes('unauthorized')
    || msg.includes('invalid api key')
    || msg.includes('api key')
    || msg.includes('oauth')
    || msg.includes('authentication')
    || msg.includes('forbidden');
}

function isCapabilityMismatchError(error) {
  if (error?.aiTargets?.classification === 'capability') return true;
  if (error?.code === 'CAPABILITY_MISMATCH') return true;

  const status = getErrorStatus(error);
  const msg = String(error?.message || '').toLowerCase();

  // Usually a 400/422 with an "unsupported" style message.
  if (status === 400 || status === 422) {
    if (msg.includes('does not support')
      || msg.includes('unsupported')
      || msg.includes('not supported')
      || msg.includes('capability mismatch')
      || msg.includes('invalid multimodal')
      || msg.includes('unsupported input')) {
      return true;
    }
  }

  return msg.includes('does not support video')
    || msg.includes('does not support audio')
    || msg.includes('does not support image');
}

function isRetryableRuntimeError(error) {
  if (error?.aiTargets?.classification === 'retryable') return true;

  const status = getErrorStatus(error);
  if (status === 408 || status === 429) return true;
  if (typeof status === 'number' && status >= 500 && status <= 599) return true;

  const code = String(error?.code || '');
  if (['ETIMEDOUT', 'ECONNRESET', 'ECONNABORTED', 'EAI_AGAIN', 'ENOTFOUND'].includes(code)) return true;

  const msg = String(error?.message || '').toLowerCase();
  return msg.includes('timeout')
    || msg.includes('timed out')
    || msg.includes('rate limit')
    || msg.includes('too many requests')
    || msg.includes('no content')
    || msg.includes('empty response');
}

function normalizeAdapterTarget(target) {
  if (!target || typeof target !== 'object') {
    throw new Error('AI targets: each target must be an object');
  }

  // Accept either { adapter: { name, model } } or legacy-ish { name, model }.
  const adapter = target.adapter && typeof target.adapter === 'object'
    ? target.adapter
    : target;

  const name = adapter?.name;
  const model = adapter?.model;

  if (typeof name !== 'string' || name.trim().length === 0) {
    throw new Error('AI targets: target.adapter.name must be a non-empty string');
  }

  if (typeof model !== 'string' || model.trim().length === 0) {
    throw new Error('AI targets: target.adapter.model must be a non-empty string');
  }

  const params = adapter?.params;

  return {
    ...target,
    adapter: {
      name: name.trim(),
      model: model.trim(),
      ...(params !== undefined ? { params } : {})
    }
  };
}

function getTargetsFromConfig(config, domain) {
  const domainConfig = config?.ai?.[domain] || {};
  const configuredTargets = domainConfig?.targets;

  if (Array.isArray(configuredTargets) && configuredTargets.length > 0) {
    return configuredTargets.map(normalizeAdapterTarget);
  }

  const providerName = config?.ai?.provider || 'openrouter';
  const model = domainConfig?.model;

  if (!model) {
    throw new Error(`AI targets: config.ai.${domain}.model is required when config.ai.${domain}.targets is not provided`);
  }

  return [normalizeAdapterTarget({ adapter: { name: providerName, model } })];
}

function applyTargetToConfig(config, domain, target) {
  const adapter = normalizeAdapterTarget(target).adapter;
  return {
    ...config,
    ai: {
      ...(config?.ai || {}),
      provider: adapter.name,
      [domain]: {
        ...((config?.ai && config.ai[domain]) || {}),
        model: adapter.model
      }
    }
  };
}

function getProviderForTarget({ configForTarget, target }) {
  const adapterName = target?.adapter?.name;

  // Preferred: provider determined from config (applyTargetToConfig sets ai.provider).
  if (typeof aiProviderInterface.getProviderFromConfig === 'function') {
    return aiProviderInterface.getProviderFromConfig(configForTarget);
  }

  if (typeof aiProviderInterface.loadProvider === 'function') {
    return aiProviderInterface.loadProvider(adapterName);
  }

  throw new Error('AI targets: ai-provider-interface missing loadProvider/getProviderFromConfig');
}

function createRetryableError(message, extra = {}) {
  const err = new Error(message);
  err.aiTargets = {
    classification: 'retryable',
    ...extra
  };
  return err;
}

/**
 * Execute operation with ordered targets and per-target retries.
 *
 * @param {object} params
 * @param {object} params.config - Base YAML config
 * @param {'video'|'dialogue'|'music'|string} params.domain - Config domain key under config.ai
 * @param {object} params.retry - Retry config
 * @param {number} params.retry.maxAttempts
 * @param {number} params.retry.backoffMs
 * @param {boolean} [params.replayMode=false] - If true, disable sleeps
 * @param {(ctx: object) => Promise<any>} params.operation - Operation to run (should use ctx.configForTarget)
 * @param {(ctx: object) => Promise<void>|void} [params.onAttempt] - Observability hook
 * @param {(event: object) => Promise<void>|void} [params.onFailover] - Failover hook
 * @param {(classification: object, ctx: object) => boolean} [params.shouldRetry] - Override retry policy (e.g., parse/provider flags)
 */
async function executeWithTargets({
  config,
  domain,
  retry,
  replayMode = false,
  operation,
  onAttempt,
  onFailover,
  shouldRetry
}) {
  const targets = getTargetsFromConfig(config, domain);

  const maxAttempts = Number.isInteger(retry?.maxAttempts) && retry.maxAttempts > 0 ? retry.maxAttempts : 1;
  const backoffMs = Number.isInteger(retry?.backoffMs) && retry.backoffMs >= 0 ? retry.backoffMs : 0;

  let globalAttempt = 0;
  let pendingFailover = null;
  let lastError = null;

  for (let targetIndex = 0; targetIndex < targets.length; targetIndex++) {
    const target = targets[targetIndex];

    for (let attemptInTarget = 1; attemptInTarget <= maxAttempts; attemptInTarget++) {
      globalAttempt += 1;

      const configForTarget = applyTargetToConfig(config, domain, target);

      const ctx = {
        domain,
        target,
        targetIndex,
        targetCount: targets.length,
        attempt: globalAttempt,
        attemptInTarget,
        configForTarget,
        failover: pendingFailover
      };

      try {
        const result = await operation(ctx);

        if (typeof onAttempt === 'function') {
          await onAttempt({ ...ctx, ok: true, result, error: null, classification: null });
        }

        return {
          result,
          meta: {
            domain,
            attempt: globalAttempt,
            target,
            targetIndex,
            targets,
            failover: pendingFailover
          }
        };
      } catch (error) {
        lastError = error;

        let classification = 'fatal';
        if (isAuthError(error)) classification = 'auth';
        else if (isCapabilityMismatchError(error)) classification = 'capability';
        else if (isRetryableRuntimeError(error)) classification = 'retryable';

        // Attach execution metadata onto the error for callers (raw capture, error messages, etc.).
        if (!error.aiTargets || typeof error.aiTargets !== 'object') {
          error.aiTargets = {};
        }
        error.aiTargets.attempts = globalAttempt;
        error.aiTargets.domain = domain;
        error.aiTargets.targetIndex = targetIndex;
        error.aiTargets.targetCount = targets.length;
        error.aiTargets.adapter = target?.adapter || null;
        // Preserve an explicit classification when already set by the operation.
        if (!error.aiTargets.classification) {
          error.aiTargets.classification = classification;
        }

        if (typeof onAttempt === 'function') {
          await onAttempt({ ...ctx, ok: false, result: null, error, classification });
        }

        if (classification === 'auth' || classification === 'capability') {
          throw error;
        }

        const retryAllowed = classification === 'retryable'
          && (typeof shouldRetry === 'function' ? shouldRetry({ classification, error }, ctx) : true);

        if (!retryAllowed) {
          throw error;
        }

        const hasMoreAttempts = attemptInTarget < maxAttempts;
        if (hasMoreAttempts) {
          if (!replayMode && backoffMs > 0) {
            await sleep(backoffMs);
          }
          pendingFailover = null;
          continue;
        }

        // Exhausted attempts for this target.
        const hasNextTarget = targetIndex < targets.length - 1;
        if (!hasNextTarget) {
          throw error;
        }

        const nextTarget = targets[targetIndex + 1];
        pendingFailover = {
          schemaVersion: 1,
          at: new Date().toISOString(),
          from: { ...target.adapter },
          to: { ...nextTarget.adapter },
          afterAttempt: globalAttempt,
          reason: String(error?.message || error)
        };

        if (typeof onFailover === 'function') {
          await onFailover({ ...pendingFailover, domain, targetIndexFrom: targetIndex, targetIndexTo: targetIndex + 1 });
        }

        // break to advance target
        break;
      }
    }
  }

  throw lastError || new Error('AI targets: operation failed with unknown error');
}

module.exports = {
  executeWithTargets,
  getTargetsFromConfig,
  applyTargetToConfig,
  normalizeAdapterTarget,
  getProviderForTarget,
  createRetryableError,
  isAuthError,
  isCapabilityMismatchError,
  isRetryableRuntimeError,
  getErrorStatus
};
