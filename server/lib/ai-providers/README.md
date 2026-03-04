# AI Providers

This directory contains the AI Provider Abstraction Layer implementations.

## Overview

The AI Provider Abstraction Layer allows tools to be provider-agnostic. API keys are injected at runtime via environment variables (never in YAML configs).

## File Structure

```
ai-providers/
├── ai-provider-interface.js    # Contract definition and utilities
├── providers/
│   ├── openrouter.cjs          # OpenRouter implementation
│   ├── anthropic.cjs           # Anthropic (Claude) implementation
│   ├── gemini.cjs              # Google Gemini implementation
│   ├── openai.cjs              # OpenAI (GPT) implementation
│   └── azure-openai.cjs        # Azure OpenAI implementation (planned)
└── README.md                   # This file
```

## Quick Start

### 1. Set Environment Variables

```bash
export AI_PROVIDER=openrouter
export AI_API_KEY=your-api-key
export AI_MODEL=qwen/qwen-3.5-397b-a17b
```

### 2. Use in Tools

```javascript
const aiProvider = require('../server/lib/ai-providers/ai-provider-interface.js');

const response = await aiProvider.complete({
  prompt: 'Your prompt here...',
  model: process.env.AI_MODEL,
  apiKey: process.env.AI_API_KEY,
  baseUrl: process.env.AI_BASE_URL,  // Optional
});

console.log(response.content);
```

### 3. Configure in YAML (Git-Safe)

```yaml
# configs/video-analysis.yaml
ai:
  provider: openrouter  # Which provider to use
  model: qwen/qwen-3.5-397b-a17b
  # apiKey: NEVER put here - use environment variables!
```

## Available Providers

| Provider | Env Var | Model Format | Example Model |
|----------|---------|--------------|---------------|
| OpenRouter | `AI_PROVIDER=openrouter` | `publisher/model` | `qwen/qwen-3.5-397b-a17b` |
| Anthropic | `AI_PROVIDER=anthropic` | `model-name-date` | `claude-3-5-sonnet-20241022` |
| Gemini | `AI_PROVIDER=gemini` | `model-name` | `gemini-1.5-pro` |
| OpenAI | `AI_PROVIDER=openai` | `model-name` | `gpt-4-turbo` |

## Interface Contract

All providers implement:

```javascript
{
  name: string,
  complete: async (options) => { content, usage },
  validate: (config) => boolean
}
```

See `ai-provider-interface.js` for full specification.

## Security

**NEVER commit API keys:**

- ❌ Don't put API keys in YAML configs
- ❌ Don't commit `.env` files with secrets
- ✅ Use environment variables
- ✅ Use GitHub Secrets in CI/CD
- ✅ Add `.env` to `.gitignore`

## Documentation

- **Full Specification**: [`../../docs/AI-PROVIDER-ARCHITECTURE.md`](../../docs/AI-PROVIDER-ARCHITECTURE.md)
- **Migration Guide**: [`../../docs/MIGRATION-GUIDE-v2.md`](../../docs/MIGRATION-GUIDE-v2.md) (v6.0 → v7.0)

## Creating New Providers

To add a new provider:

1. Create `providers/<provider-name>.cjs`
2. Implement `name`, `complete()`, and `validate()`
3. Test with `ai-provider-interface.js`

See existing providers for examples.
