const fs = require('fs');
const path = require('path');
const { normalizeProviderName } = require('./provider-runtime-config.cjs');

const LOCAL_PROVIDERS_DIR = path.resolve(__dirname, '..', 'providers');

function compactString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function getSharedProviderInterface() {
  return require('ai-providers/ai-provider-interface.js');
}

function getLocalProviderPath(providerName) {
  const normalized = normalizeProviderName(compactString(providerName));
  if (!normalized) return null;
  return path.join(LOCAL_PROVIDERS_DIR, `${normalized}.cjs`);
}

function hasLocalProvider(providerName) {
  const providerPath = getLocalProviderPath(providerName);
  return !!providerPath && fs.existsSync(providerPath);
}

function loadLocalProvider(providerName) {
  const providerPath = getLocalProviderPath(providerName);
  if (!providerPath || !fs.existsSync(providerPath)) {
    throw new Error(`Local provider "${providerName}" not found.`);
  }
  return require(providerPath);
}

function getAvailableProviders() {
  const sharedProviderInterface = getSharedProviderInterface();
  const sharedProviders = typeof sharedProviderInterface.getAvailableProviders === 'function'
    ? sharedProviderInterface.getAvailableProviders()
    : [];
  const localProviders = fs.existsSync(LOCAL_PROVIDERS_DIR)
    ? fs.readdirSync(LOCAL_PROVIDERS_DIR)
      .filter((file) => file.endsWith('.cjs'))
      .map((file) => file.replace(/\.cjs$/, ''))
    : [];

  return Array.from(new Set([...sharedProviders, ...localProviders])).sort();
}

function loadProvider(providerName) {
  const normalized = normalizeProviderName(compactString(providerName));
  if (!normalized) {
    throw new Error('Provider name is required');
  }

  if (hasLocalProvider(normalized)) {
    return loadLocalProvider(normalized);
  }

  return getSharedProviderInterface().loadProvider(normalized);
}

function getProviderFromConfig(config = {}) {
  const providerName = normalizeProviderName(config?.ai?.provider);
  const sharedProviderInterface = getSharedProviderInterface();

  if (providerName && hasLocalProvider(providerName)) {
    return loadLocalProvider(providerName);
  }

  if (typeof sharedProviderInterface.getProviderFromConfig === 'function') {
    if (providerName) {
      return sharedProviderInterface.getProviderFromConfig({
        ...config,
        ai: {
          ...(config?.ai || {}),
          provider: providerName
        }
      });
    }
    return sharedProviderInterface.getProviderFromConfig(config);
  }

  if (providerName) {
    return loadProvider(providerName);
  }

  throw new Error('Provider config is missing ai.provider');
}

module.exports = {
  LOCAL_PROVIDERS_DIR,
  getLocalProviderPath,
  hasLocalProvider,
  loadLocalProvider,
  loadProvider,
  getProviderFromConfig,
  getAvailableProviders
};
