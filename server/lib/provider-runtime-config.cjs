const PROVIDER_ENV_MAP = Object.freeze({
  openrouter: {
    apiKeyEnv: ['OPENROUTER_API_KEY', 'AI_API_KEY'],
    baseUrlEnv: 'OPENROUTER_BASE_URL',
    timeoutEnv: 'OPENROUTER_TIMEOUT_MS',
    defaultBaseUrl: 'https://openrouter.ai/api/v1'
  },
  openai: {
    apiKeyEnv: ['OPENAI_API_KEY', 'AI_API_KEY'],
    baseUrlEnv: 'OPENAI_BASE_URL',
    timeoutEnv: 'OPENAI_TIMEOUT_MS'
  },
  anthropic: {
    apiKeyEnv: ['ANTHROPIC_API_KEY', 'AI_API_KEY'],
    baseUrlEnv: 'ANTHROPIC_BASE_URL',
    timeoutEnv: 'ANTHROPIC_TIMEOUT_MS'
  },
  gemini: {
    apiKeyEnv: ['GEMINI_API_KEY', 'AI_API_KEY'],
    baseUrlEnv: 'GEMINI_BASE_URL',
    timeoutEnv: 'GEMINI_TIMEOUT_MS'
  },
  xiaomi: {
    apiKeyEnv: ['XIAOMI_API_KEY', 'AI_API_KEY'],
    baseUrlEnv: 'XIAOMI_BASE_URL',
    timeoutEnv: 'XIAOMI_TIMEOUT_MS',
    authModeEnv: 'XIAOMI_AUTH_MODE',
    defaultBaseUrl: 'https://api.xiaomimimo.com/v1',
    defaultAuthMode: 'bearer'
  }
});

function compactString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

const PROVIDER_ALIASES = Object.freeze({
  google: 'gemini'
});

function normalizeProviderName(value) {
  const normalized = compactString(value).toLowerCase();
  if (!normalized) return 'openrouter';
  return PROVIDER_ALIASES[normalized] || normalized;
}

function getProviderEnvSpec(providerName) {
  return PROVIDER_ENV_MAP[normalizeProviderName(providerName)] || {
    apiKeyEnv: ['AI_API_KEY']
  };
}

function parsePositiveInteger(value) {
  if (value === undefined || value === null || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : null;
}

function normalizeAuthMode(value, fallback = null) {
  const normalized = compactString(value).toLowerCase();
  if (!normalized) return fallback;
  if (normalized === 'bearer' || normalized === 'api-key') return normalized;
  return fallback;
}

function resolveProviderRuntimeConfig(providerName, env = process.env) {
  const provider = normalizeProviderName(providerName);
  const spec = getProviderEnvSpec(provider);
  const apiKeyEnv = Array.isArray(spec.apiKeyEnv) ? spec.apiKeyEnv : ['AI_API_KEY'];
  const apiKeySource = apiKeyEnv.find((key) => compactString(env?.[key]));
  const baseUrl = compactString(spec.baseUrlEnv ? env?.[spec.baseUrlEnv] : '') || spec.defaultBaseUrl || null;
  const timeoutMs = parsePositiveInteger(spec.timeoutEnv ? env?.[spec.timeoutEnv] : null);
  const authMode = normalizeAuthMode(spec.authModeEnv ? env?.[spec.authModeEnv] : null, spec.defaultAuthMode || null);

  return {
    provider,
    apiKey: apiKeySource ? compactString(env?.[apiKeySource]) : null,
    apiKeySource: apiKeySource || null,
    apiKeyEnv,
    baseUrl,
    timeoutMs,
    authMode
  };
}

function getProviderNameForTarget({ configForTarget = {}, target = null } = {}) {
  const adapterName = compactString(target?.adapter?.name);
  if (adapterName) return normalizeProviderName(adapterName);

  const configProvider = compactString(configForTarget?.ai?.provider);
  if (configProvider) return normalizeProviderName(configProvider);

  return normalizeProviderName(process.env.AI_PROVIDER);
}

function resolveProviderRuntimeConfigForTarget({ configForTarget = {}, target = null, env = process.env } = {}) {
  const provider = getProviderNameForTarget({ configForTarget, target });
  return resolveProviderRuntimeConfig(provider, env);
}

function buildMissingProviderAuthError(providerName, prefix = 'AI runtime') {
  const runtimeConfig = resolveProviderRuntimeConfig(providerName);
  const expected = runtimeConfig.apiKeyEnv.join(' or ');
  return new Error(`${prefix}: ${expected} environment variable is required for provider "${runtimeConfig.provider}"`);
}

function getTargetsForDomain(config = {}, domain) {
  const domainConfig = config?.ai?.[domain] || {};
  if (Array.isArray(domainConfig?.targets) && domainConfig.targets.length > 0) {
    return domainConfig.targets;
  }

  const model = compactString(domainConfig?.model);
  if (!model) return [];

  return [{
    adapter: {
      name: compactString(config?.ai?.provider) || 'openrouter',
      model
    }
  }];
}

function ensureRuntimeAuthForDomain({ config = {}, domain, replayMode = false, prefix = 'AI runtime', env = process.env } = {}) {
  if (replayMode) return true;

  const targets = getTargetsForDomain(config, domain);
  const providerNames = Array.from(new Set(targets
    .map((target) => getProviderNameForTarget({ configForTarget: config, target }))
    .filter(Boolean)));

  if (providerNames.length === 0) {
    return true;
  }

  const available = providerNames.find((providerName) => resolveProviderRuntimeConfig(providerName, env).apiKey);
  if (available) {
    return true;
  }

  const expectations = providerNames
    .map((providerName) => {
      const runtimeConfig = resolveProviderRuntimeConfig(providerName, env);
      return `${runtimeConfig.provider}: ${runtimeConfig.apiKeyEnv.join(' or ')}`;
    })
    .join('; ');

  throw new Error(`${prefix}: missing provider credentials for domain "${domain}". Expected one of: ${expectations}`);
}

function buildProviderOptionDefaults(runtimeConfig, defaults = {}) {
  const merged = {
    ...(defaults && typeof defaults === 'object' ? defaults : {})
  };

  if (runtimeConfig?.timeoutMs && merged.timeoutMs === undefined) {
    merged.timeoutMs = runtimeConfig.timeoutMs;
  }

  if (runtimeConfig?.authMode && merged.authMode === undefined) {
    merged.authMode = runtimeConfig.authMode;
  }

  return merged;
}

module.exports = {
  PROVIDER_ENV_MAP,
  PROVIDER_ALIASES,
  normalizeProviderName,
  getProviderEnvSpec,
  resolveProviderRuntimeConfig,
  getProviderNameForTarget,
  resolveProviderRuntimeConfigForTarget,
  buildMissingProviderAuthError,
  getTargetsForDomain,
  ensureRuntimeAuthForDomain,
  buildProviderOptionDefaults
};
