# AI Provider Abstraction Layer

**Version:** 1.0  
**Date:** 2026-03-04  
**Status:** Implementation Specification

---

## 🎯 Problem Statement

### Current Issues

1. **API Keys in YAML**: Storing API keys in configuration files is insecure and prevents git-safe configs
2. **Provider Lock-in**: Tools implement provider-specific logic, making it hard to switch providers
3. **No Standardization**: Each tool handles AI requests differently, leading to code duplication
4. **Environment Complexity**: Different users need different providers (OpenRouter, Anthropic, Gemini, OpenAI, etc.)

### Requirements

- ✅ **Git-safe configs**: YAML files should never contain secrets
- ✅ **Provider-agnostic tools**: Tools shouldn't know which provider they're using
- ✅ **Easy provider switching**: Change providers via environment variables
- ✅ **Standardized interface**: All providers implement the same contract
- ✅ **Runtime secret injection**: API keys injected at runtime, not commit time

---

## 🏗️ Architecture Overview

### High-Level Design

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         TOOL LAYER                                      │
│  (tools/emotion-lenses-tool.cjs, etc.)                                 │
│                                                                          │
│  const aiProvider = require('../server/lib/ai-providers/                │
│                     ai-provider-interface.js');                         │
│                                                                          │
│  const response = await aiProvider.complete({                           │
│    prompt: buildPrompt(input),                                          │
│    model: process.env.AI_MODEL,                                         │
│    apiKey: process.env.AI_API_KEY,  // ← Injected at runtime            │
│  });                                                                    │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    AI PROVIDER INTERFACE                                │
│  (server/lib/ai-providers/ai-provider-interface.js)                    │
│                                                                          │
│  Contract:                                                              │
│  - complete(options) → { content, usage }                              │
│  - validate(config) → boolean                                           │
│  - loadProvider(name) → provider implementation                         │
│  - getProviderFromEnv() → provider implementation                       │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
            ┌───────────────────────┼───────────────────────┐
            │                       │                       │
            ▼                       ▼                       ▼
┌───────────────────┐   ┌───────────────────┐   ┌───────────────────┐
│   OpenRouter      │   │   Anthropic       │   │   Google Gemini   │
│   (openrouter.cjs)│   │   (anthropic.cjs) │   │   (gemini.cjs)    │
│                   │   │                   │   │                   │
│ • complete()      │   │ • complete()      │   │ • complete()      │
│ • validate()      │   │ • validate()      │   │ • validate()      │
└───────────────────┘   └───────────────────┘   └───────────────────┘
            │                       │                       │
            ▼                       ▼                       ▼
┌───────────────────┐   ┌───────────────────┐   ┌───────────────────┐
│   OpenRouter API  │   │   Anthropic API   │   │   Gemini API      │
│   https://...     │   │   api.anthropic.. │   │   generativel...  │
└───────────────────┘   └───────────────────┘   └───────────────────┘
```

### File Structure

```
server/lib/ai-providers/
├── ai-provider-interface.js    # Contract definition (abstract)
├── providers/
│   ├── openrouter.cjs          # OpenRouter implementation
│   ├── anthropic.cjs           # Anthropic implementation
│   ├── gemini.cjs              # Google Gemini implementation
│   ├── openai.cjs              # OpenAI implementation
│   └── azure-openai.cjs        # Azure OpenAI implementation
```

---

## 📋 Interface Contract

### AI Provider Interface

All providers implement this contract:

```javascript
/**
 * AI Provider Interface - All providers implement this contract
 */
module.exports = {
  /**
   * Provider name identifier
   * @type {string}
   */
  name: 'provider-name',
  
  /**
   * Execute AI completion request
   * @param {object} options
   * @param {string} options.prompt - System/user prompt
   * @param {string} options.model - Model identifier
   * @param {string} options.apiKey - API key (injected at runtime)
   * @param {string} options.baseUrl - API base URL (optional, provider-specific)
   * @param {object} options.options - Additional provider-specific options
   * @returns {Promise<object>} - { content: string, usage: { input, output } }
   */
  async complete(options) { ... },
  
  /**
   * Validate provider configuration
   * @param {object} config - Provider config
   * @returns {boolean} - Valid or throw error
   */
  validate(config) { ... }
};
```

### Completion Options

```typescript
interface CompletionOptions {
  /** System/user prompt */
  prompt: string;
  
  /** Model identifier (e.g., 'qwen/qwen-3.5-397b-a17b', 'claude-3-5-sonnet-20241022') */
  model: string;
  
  /** API key (injected at runtime, NEVER in YAML) */
  apiKey: string;
  
  /** API base URL (optional, provider-specific) */
  baseUrl?: string;
  
  /** Additional provider-specific options */
  options?: {
    /** Site URL for OpenRouter rankings */
    siteUrl?: string;
    
    /** Site name for OpenRouter rankings */
    siteName?: string;
    
    /** Temperature (0-2) */
    temperature?: number;
    
    /** Max tokens */
    maxTokens?: number;
    
    /** Provider-specific options */
    [key: string]: any;
  };
}
```

### Completion Result

```typescript
interface CompletionResult {
  /** Generated content */
  content: string;
  
  /** Token usage */
  usage: {
    /** Input tokens */
    input: number;
    
    /** Output tokens */
    output: number;
    
    /** Total tokens */
    total?: number;
  };
}
```

---

## 🔧 Implementation Guide

### Creating a New Provider

**Step 1: Create provider file**

```javascript
// server/lib/ai-providers/providers/anthropic.cjs
const axios = require('axios');

const name = 'anthropic';
const DEFAULT_BASE_URL = 'https://api.anthropic.com/v1';

async function complete(options) {
  const {
    prompt,
    model,
    apiKey,
    baseUrl = DEFAULT_BASE_URL,
    options: providerOptions = {}
  } = options;

  // Validate required parameters
  if (!prompt) throw new Error('Anthropic: prompt is required');
  if (!model) throw new Error('Anthropic: model is required');
  if (!apiKey) throw new Error('Anthropic: apiKey is required');

  // Build request (Anthropic uses different format)
  const response = await axios.post(
    `${baseUrl}/messages`,
    {
      model,
      max_tokens: providerOptions.maxTokens || 4096,
      messages: [{ role: 'user', content: prompt }],
    },
    {
      headers: {
        'x-api-key': apiKey,
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01',
      },
    }
  );

  return {
    content: response.data.content?.[0]?.text,
    usage: {
      input: response.data.usage?.input_tokens || 0,
      output: response.data.usage?.output_tokens || 0,
    },
  };
}

function validate(config) {
  if (!config?.apiKey) {
    throw new Error('Anthropic: API key is required');
  }
  return true;
}

module.exports = { name, complete, validate };
```

**Step 2: Test the provider**

```javascript
// test provider
const anthropic = require('./providers/anthropic.cjs');

anthropic.validate({ apiKey: process.env.ANTHROPIC_API_KEY });

const response = await anthropic.complete({
  prompt: 'Hello, world!',
  model: 'claude-3-5-sonnet-20241022',
  apiKey: process.env.ANTHROPIC_API_KEY,
});

console.log(response.content);
```

### Using Providers in Tools

**Provider-Agnostic Tool Pattern:**

```javascript
// tools/emotion-lenses-tool.cjs
const aiProvider = require('../server/lib/ai-providers/ai-provider-interface.js');

async function analyze(input) {
  const { toolVariables, videoContext, dialogueContext, musicContext, previousState } = input;
  
  // Build prompt
  const prompt = buildPrompt(input);
  
  // Get provider from environment (or use default)
  const provider = aiProvider.getProviderFromEnv();
  
  // Execute completion (provider-agnostic)
  const response = await provider.complete({
    prompt,
    model: process.env.AI_MODEL || 'qwen/qwen-3.5-397b-a17b',
    apiKey: process.env.AI_API_KEY,  // Injected at runtime
    baseUrl: process.env.AI_BASE_URL,  // Optional
    options: {
      temperature: 0.7,
      maxTokens: 2048,
    },
  });
  
  // Parse and return results
  return {
    prompt,
    state: parseResponse(response.content, previousState),
    usage: response.usage,
  };
}

module.exports = { analyze };
```

---

## 🔐 Runtime Secret Injection

### Option A: Environment Variables (Recommended)

**Simplest approach - tools read from environment:**

```bash
# Set environment variables (from .env, GitHub Secrets, etc.)
export AI_PROVIDER=openrouter
export AI_API_KEY=$OPENROUTER_API_KEY
export AI_BASE_URL=https://openrouter.ai/api/v1
export AI_MODEL=qwen/qwen-3.5-397b-a17b

# Run pipeline (tools read from env)
node server/run-pipeline.cjs --config configs/video-analysis.yaml
```

**Benefits:**
- ✅ Simple and straightforward
- ✅ Works with existing .env files
- ✅ GitHub Secrets compatible
- ✅ No additional tooling required

**Config file (git-safe, no secrets):**

```yaml
# configs/video-analysis.yaml
asset:
  inputPath: ".cache/videos/cod.mp4"
  outputDir: "output/cod-test"

# AI provider config (references env vars, no secrets)
ai:
  provider: openrouter  # Which provider script to use
  model: qwen/qwen-3.5-397b-a17b  # Model identifier
  # apiKey: injected via env var (never in YAML)
  # baseUrl: injected via env var or provider default

gather_context:
  - scripts/get-context/get-dialogue.cjs

process:
  sequential:
    - script: scripts/process/video-chunks.cjs
      toolPath: tools/emotion-lenses-tool.cjs
      tool_variables:
        soulPath: /path/to/SOUL.md
        goalPath: /path/to/GOAL.md
        variables:
          lenses: [patience, boredom, excitement]

report:
  - scripts/report/evaluation.cjs
```

### Option B: CLI Wrapper (Advanced)

**For users who want explicit secret injection:**

```bash
# Inject secrets, generate runtime config
node bin/inject-secrets.js \
  --config configs/video-analysis.yaml \
  --provider openrouter \
  --api-key $OPENROUTER_API_KEY \
  --model qwen/qwen-3.5-397b-a17b \
  --output .pipeline-runtime.yaml

# Run pipeline (runtime config has secrets, gitignored)
node server/run-pipeline.cjs --config .pipeline-runtime.yaml
```

**Note:** The runtime config (`.pipeline-runtime.yaml`) should be in `.gitignore`.

---

## 🚀 CI/CD Integration

### GitHub Actions Example

```yaml
name: Run Emotion Engine

on:
  push:
    branches: [main]

jobs:
  analyze:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run Emotion Engine
        env:
          AI_PROVIDER: openrouter
          AI_API_KEY: ${{ secrets.OPENROUTER_API_KEY }}
          AI_BASE_URL: https://openrouter.ai/api/v1
          AI_MODEL: qwen/qwen-3.5-397b-a17b
        run: |
          node server/run-pipeline.cjs --config configs/video-analysis.yaml
      
      - name: Upload results
        uses: actions/upload-artifact@v4
        with:
          name: emotion-analysis
          path: output/
```

### GitLab CI Example

```yaml
stages:
  - analyze

analyze:
  stage: analyze
  image: node:20
  script:
    - npm ci
    - node server/run-pipeline.cjs --config configs/video-analysis.yaml
  variables:
    AI_PROVIDER: openrouter
    AI_MODEL: qwen/qwen-3.5-397b-a17b
    AI_BASE_URL: https://openrouter.ai/api/v1
  # Protected variables (GitLab Settings → CI/CD → Variables):
  # AI_API_KEY (Protected, Masked)
```

---

## 🛡️ Security Best Practices

### NEVER Commit API Keys

```bash
# ❌ WRONG: API key in YAML (will be committed)
ai:
  provider: openrouter
  apiKey: sk-or-1234567890abcdef  # NEVER DO THIS

# ✅ CORRECT: API key in environment (git-safe)
export AI_API_KEY=$OPENROUTER_API_KEY
```

### Add Runtime Configs to .gitignore

```gitignore
# .gitignore

# Runtime configs with secrets
.pipeline-runtime.yaml
*.runtime.yaml
.runtime-config.json

# Environment files with secrets
.env.local
.env.*.local
```

### Use Protected Environment Variables

**Development:**
```bash
# .env (in .gitignore)
AI_PROVIDER=openrouter
AI_API_KEY=sk-or-...
AI_MODEL=qwen/qwen-3.5-397b-a17b
```

**Production (GitHub Secrets):**
```yaml
env:
  AI_API_KEY: ${{ secrets.OPENROUTER_API_KEY }}
```

**Production (Docker):**
```dockerfile
# Dockerfile
ENV AI_PROVIDER=openrouter
ENV AI_MODEL=qwen/qwen-3.5-397b-a17b
# Don't set AI_API_KEY here - inject at runtime

# docker run -e AI_API_KEY=$SECRET ...
```

---

## 📊 Environment Variable Conventions

### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `AI_PROVIDER` | Provider name | `openrouter`, `anthropic`, `gemini` |
| `AI_API_KEY` | API key (injected at runtime) | `sk-or-...`, `sk-ant-...` |
| `AI_MODEL` | Model identifier | `qwen/qwen-3.5-397b-a17b` |

### Optional Variables

| Variable | Description | Default | Example |
|----------|-------------|---------|---------|
| `AI_BASE_URL` | API base URL | Provider default | `https://openrouter.ai/api/v1` |
| `AI_TEMPERATURE` | Sampling temperature | Provider default | `0.7` |
| `AI_MAX_TOKENS` | Max output tokens | Provider default | `2048` |

### Provider-Specific Variables

| Provider | Model Format | Example |
|----------|--------------|---------|
| OpenRouter | `publisher/model` | `qwen/qwen-3.5-397b-a17b` |
| Anthropic | `model-name-date` | `claude-3-5-sonnet-20241022` |
| Gemini | `model-name` | `gemini-1.5-pro` |
| OpenAI | `model-name` | `gpt-4-turbo` |

---

## 🧪 Testing

### Unit Test Example

```javascript
// test/ai-providers/openrouter.test.js
const openrouter = require('../../server/lib/ai-providers/providers/openrouter.cjs');

describe('OpenRouter Provider', () => {
  describe('validate', () => {
    test('validates with valid API key', () => {
      expect(() => {
        openrouter.validate({ apiKey: 'sk-or-valid-key' });
      }).not.toThrow();
    });
    
    test('throws without API key', () => {
      expect(() => {
        openrouter.validate({});
      }).toThrow('OpenRouter: API key is required');
    });
  });
  
  describe('complete', () => {
    test('returns content and usage', async () => {
      const response = await openrouter.complete({
        prompt: 'Say hello',
        model: 'qwen/qwen-3.5-397b-a17b',
        apiKey: process.env.OPENROUTER_API_KEY,
      });
      
      expect(response).toHaveProperty('content');
      expect(response).toHaveProperty('usage.input');
      expect(response).toHaveProperty('usage.output');
    });
  });
});
```

### Integration Test Example

```javascript
// test/ai-providers/integration.test.js
const aiProvider = require('../../server/lib/ai-providers/ai-provider-interface.js');

describe('AI Provider Integration', () => {
  test('loads provider from environment', () => {
    process.env.AI_PROVIDER = 'openrouter';
    const provider = aiProvider.getProviderFromEnv();
    
    expect(provider.name).toBe('openrouter');
    expect(typeof provider.complete).toBe('function');
    expect(typeof provider.validate).toBe('function');
  });
  
  test('lists available providers', () => {
    const providers = aiProvider.getAvailableProviders();
    
    expect(providers).toContain('openrouter');
    expect(providers.length).toBeGreaterThan(0);
  });
});
```

---

## 📚 References

- **Interface Definition**: `server/lib/ai-providers/ai-provider-interface.js`
- **Provider Implementations**: `server/lib/ai-providers/providers/*.cjs`
- **Example Tool Usage**: `tools/emotion-lenses-tool.cjs`
- **Config Examples**: `configs/*.yaml`

---

*Generated by OpenTruth Emotion Engine - AI Provider Architecture Module*
