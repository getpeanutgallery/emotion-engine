# AI Provider Abstraction Layer

**Version:** 2.0  
**Date:** 2026-03-04  
**Status:** Implementation Specification  
**Changes in v2.0:** Added multi-modal support (video, audio, images, files)

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
/**
 * Attachment for multi-modal inputs
 * 
 * Supports three input patterns:
 * 
 * Pattern 1: URL (Publicly Accessible)
 * {
 *   type: 'video',
 *   url: 'https://s3.amazonaws.com/bucket/video.mp4'
 * }
 * 
 * Pattern 2: Local Path (Auto-convert to Base64)
 * {
 *   type: 'video',
 *   path: '/local/path/to/video.mp4'
 *   // mimeType auto-detected from extension
 * }
 * 
 * Pattern 3: Direct Base64 Data (Already Converted)
 * {
 *   type: 'video',
 *   data: 'base64-encoded-string-here',
 *   mimeType: 'video/mp4'  // Required for data pattern
 * }
 */
interface Attachment {
  /** Attachment type */
  type: 'video' | 'audio' | 'image' | 'file';
  
  /** Pattern 1: Publicly accessible URL (passed directly to API) */
  url?: string;
  
  /** Pattern 2: Local file path (auto-converted to base64 by provider) */
  path?: string;
  
  /** Pattern 3: Direct base64-encoded data (already converted) */
  data?: string;
  
  /** 
   * MIME type 
   * - Auto-detected from file extension for `path` pattern
   * - Required for `data` pattern
   * - Auto-detected from URL for `url` pattern
   */
  mimeType?: string;
}

interface CompletionOptions {
  /** System/user prompt (can be text string or messages array) */
  prompt: string | Array;
  
  /** Model identifier (e.g., 'qwen/qwen-3.5-397b-a17b', 'claude-3-5-sonnet-20241022') */
  model: string;
  
  /** API key (injected at runtime, NEVER in YAML) */
  apiKey: string;
  
  /** API base URL (optional, provider-specific) */
  baseUrl?: string;
  
  /** Multi-modal attachments (video, audio, images, files) */
  attachments?: Attachment[];
  
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

## 🎥 Multi-Modal Support

### Overview

As of v2.0, the AI Provider Interface supports multi-modal inputs including:

- **Images**: JPEG, PNG, GIF, WebP, BMP
- **Video**: MP4, WebM, MOV, AVI (provider-dependent)
- **Audio**: MP3, WAV, OGG, M4A (provider-dependent)
- **Files**: PDF, TXT, JSON (provider-dependent)

### Provider Capabilities

| Provider | Images | Video | Audio | Files | Notes |
|----------|--------|-------|-------|-------|-------|
| **OpenRouter** | ✅ | ✅ (URL) | ✅ (URL) | ✅ (URL) | Video/audio via URL only for compatible models |
| **Anthropic** | ✅ | ❌ | ❌ | ✅ (PDF, TXT) | Claude 3+ supports images and documents |
| **Gemini** | ✅ | ✅ | ✅ | ✅ | Gemini 1.5 has best multi-modal support |
| **OpenAI** | ✅ | ❌ | ❌ | ❌ | GPT-4 Vision supports images only |

### Usage Examples

#### Text-Only Request (Backward Compatible)

```javascript
const aiProvider = require('../server/lib/ai-providers/ai-provider-interface.js');

const response = await aiProvider.complete({
  prompt: 'Analyze this video chunk for emotional content...',
  model: 'qwen/qwen-3.5-397b-a17b',
  apiKey: process.env.AI_API_KEY,
});

console.log(response.content);
```

#### Multi-Modal Request with Images

```javascript
const response = await aiProvider.complete({
  prompt: 'Describe this image and identify emotions',
  model: 'openai/gpt-4o',
  apiKey: process.env.OPENROUTER_API_KEY,
  attachments: [
    {
      type: 'image',
      path: '/path/to/frame.jpg',
      mimeType: 'image/jpeg'
    }
  ]
});

console.log(response.content);
```

#### Multi-Modal Request with Video (Gemini 1.5)

```javascript
const response = await aiProvider.complete({
  prompt: 'Analyze this video for emotional content throughout',
  model: 'gemini-1.5-pro',
  apiKey: process.env.GEMINI_API_KEY,
  attachments: [
    {
      type: 'video',
      path: 'https://example.com/video.mp4',
      mimeType: 'video/mp4'
    }
  ]
});

console.log(response.content);
```

#### Multi-Modal Request with Multiple Attachments

```javascript
const response = await aiProvider.complete({
  prompt: 'Analyze this scene using the video frames and audio',
  model: 'openai/gpt-4o',
  apiKey: process.env.OPENROUTER_API_KEY,
  attachments: [
    {
      type: 'image',
      path: '/path/to/frame1.jpg',
      mimeType: 'image/jpeg'
    },
    {
      type: 'image',
      path: '/path/to/frame2.jpg',
      mimeType: 'image/jpeg'
    },
    {
      type: 'audio',
      url: 'https://example.com/audio.mp3',  // URL for audio
      mimeType: 'audio/mpeg'
    }
  ]
});

console.log(response.content);
```

---

### Complete Examples: All Three Patterns

#### Example 1: Pattern 1 - URL (Publicly Accessible)

```javascript
const aiProvider = require('../server/lib/ai-providers/ai-provider-interface.js');

// Video hosted on S3 (public URL)
const response = await aiProvider.complete({
  prompt: 'Analyze this product demo video for key features',
  model: 'gemini-1.5-pro',
  apiKey: process.env.GEMINI_API_KEY,
  attachments: [
    {
      type: 'video',
      url: 'https://my-bucket.s3.amazonaws.com/product-demo.mp4'
      // mimeType auto-detected from URL extension
    }
  ]
});

console.log(response.content);
```

#### Example 2: Pattern 2 - Local Path (Auto-convert to Base64)

```javascript
const aiProvider = require('../server/lib/ai-providers/ai-provider-interface.js');

// Local video file (auto-converted to base64 by provider)
const response = await aiProvider.complete({
  prompt: 'Analyze emotions in this video clip',
  model: 'gemini-1.5-pro',
  apiKey: process.env.GEMINI_API_KEY,
  attachments: [
    {
      type: 'video',
      path: '/home/user/videos/clip.mp4'
      // mimeType auto-detected as 'video/mp4'
    }
  ]
});

console.log(response.content);

// Works with images too (all providers)
const imageResponse = await aiProvider.complete({
  prompt: 'Describe this image',
  model: 'claude-3-5-sonnet-20241022',
  apiKey: process.env.ANTHROPIC_API_KEY,
  attachments: [
    {
      type: 'image',
      path: '/home/user/screenshots/frame.jpg'
      // mimeType auto-detected as 'image/jpeg'
    }
  ]
});
```

#### Example 3: Pattern 3 - Direct Base64 Data (Already Converted)

```javascript
const aiProvider = require('../server/lib/ai-providers/ai-provider-interface.js');
const fs = require('fs');

// Pre-convert file to base64 (e.g., from stream, database, or cache)
const imageData = fs.readFileSync('/path/to/image.jpg').toString('base64');

const response = await aiProvider.complete({
  prompt: 'What emotions are expressed in this face?',
  model: 'gpt-4o',
  apiKey: process.env.OPENAI_API_KEY,
  attachments: [
    {
      type: 'image',
      data: imageData,  // Already base64-encoded
      mimeType: 'image/jpeg'  // Required!
    }
  ]
});

console.log(response.content);

// Or from a buffer/stream
const buffer = await getBufferFromSomewhere();
const base64Data = buffer.toString('base64');

const response2 = await aiProvider.complete({
  prompt: 'Analyze this audio clip',
  model: 'gemini-1.5-pro',
  apiKey: process.env.GEMINI_API_KEY,
  attachments: [
    {
      type: 'audio',
      data: base64Data,
      mimeType: 'audio/mp3'  // Required!
    }
  ]
});
```

#### Example 4: Mixed Patterns (URL + Path + Data)

You can mix different patterns in a single request:

```javascript
const aiProvider = require('../server/lib/ai-providers/ai-provider-interface.js');
const fs = require('fs');

// Pre-convert one file to base64
const logoData = fs.readFileSync('/path/to/logo.png').toString('base64');

const response = await aiProvider.complete({
  prompt: 'Compare these three images and describe the differences',
  model: 'gpt-4o',
  apiKey: process.env.OPENAI_API_KEY,
  attachments: [
    // Pattern 1: URL
    {
      type: 'image',
      url: 'https://example.com/reference.jpg'
    },
    // Pattern 2: Local path
    {
      type: 'image',
      path: '/home/user/screenshots/comparison.png'
    },
    // Pattern 3: Direct base64 data
    {
      type: 'image',
      data: logoData,
      mimeType: 'image/png'
    }
  ]
});

console.log(response.content);
```

#### Using Messages Array (Advanced)

```javascript
const response = await aiProvider.complete({
  prompt: [
    {
      role: 'user',
      content: [
        { type: 'text', text: 'What do you see in these images?' },
        {
          type: 'image_url',
          image_url: { url: 'https://example.com/image1.jpg' }
        },
        {
          type: 'image_url',
          image_url: { url: 'https://example.com/image2.jpg' }
        }
      ]
    }
  ],
  model: 'openai/gpt-4o',
  apiKey: process.env.OPENROUTER_API_KEY,
});

console.log(response.content);
```

### Three Attachment Patterns

The AI Provider Interface supports **three** input patterns for attachments:

#### Pattern 1: URL (Publicly Accessible)

Use when files are already hosted on a publicly accessible URL (S3, CDN, etc.).

```javascript
// Image URL
attachments: [{
  type: 'image',
  url: 'https://example.com/image.jpg'
}]

// Video URL (OpenRouter, Gemini)
attachments: [{
  type: 'video',
  url: 'https://s3.amazonaws.com/bucket/video.mp4'
}]

// Audio URL (Gemini)
attachments: [{
  type: 'audio',
  url: 'https://cdn.example.com/audio.mp3'
}]
```

**Benefits:**
- ✅ No base64 conversion overhead
- ✅ Smaller request payload
- ✅ Works well for large files

**Limitations:**
- ❌ File must be publicly accessible
- ❌ Some providers may need to fetch the URL (adds latency)

---

#### Pattern 2: Local Path (Auto-convert to Base64)

Use for local files on your filesystem. The provider automatically reads and converts to base64.

```javascript
// Local image file (auto-converted to base64)
attachments: [{
  type: 'image',
  path: '/path/to/local/image.jpg'
  // mimeType auto-detected as 'image/jpeg'
}]

// Local video file (Gemini only - converts to base64)
attachments: [{
  type: 'video',
  path: '/path/to/local/video.mp4'
  // mimeType auto-detected as 'video/mp4'
}]

// Local PDF file (Anthropic, Gemini)
attachments: [{
  type: 'file',
  path: '/path/to/document.pdf'
  // mimeType auto-detected as 'application/pdf'
}]
```

**Benefits:**
- ✅ Simple - just provide the file path
- ✅ MIME type auto-detected from extension
- ✅ Works with any local file

**Limitations:**
- ❌ File is read and converted to base64 (memory usage)
- ❌ Larger request payload
- ❌ Some providers don't support base64 for certain types (e.g., OpenRouter video/audio)

---

#### Pattern 3: Direct Base64 Data (Already Converted)

Use when you've already converted the file to base64 (e.g., from a previous operation, or streaming data).

```javascript
// Pre-converted image data
attachments: [{
  type: 'image',
  data: 'iVBORw0KGgoAAAANSUhEUgAA...',  // Base64 string
  mimeType: 'image/jpeg'  // Required!
}]

// Pre-converted video data (Gemini)
attachments: [{
  type: 'video',
  data: 'AAAAIGZ0eXBpc29tAAACAGlzb21pc28y...',  // Base64 string
  mimeType: 'video/mp4'  // Required!
}]
```

**Benefits:**
- ✅ Full control over data
- ✅ Useful for streaming or pre-processed data
- ✅ No file I/O needed

**Limitations:**
- ❌ MIME type is **required** (not auto-detected)
- ❌ You're responsible for base64 encoding

---

### Provider Support Matrix

| Provider | Pattern 1 (URL) | Pattern 2 (Path) | Pattern 3 (Data) | Notes |
|----------|-----------------|------------------|------------------|-------|
| **OpenRouter** | ✅ All types | ✅ Images only | ✅ Images only | Video/audio must be URLs |
| **Anthropic** | ✅ Images, Files | ✅ Images, Files | ✅ Images, Files | No video/audio support |
| **Gemini** | ✅ All types | ✅ All types | ✅ All types | **Best multi-modal support** |
| **OpenAI** | ✅ Images | ✅ Images | ✅ Images | No video/audio/file support |

---

### When to Use Each Pattern

**Use Pattern 1 (URL) when:**
- Files are already hosted on S3, CDN, or public URL
- Working with large video/audio files
- Want to minimize request payload size
- Using OpenRouter for video/audio (requires URLs)

**Use Pattern 2 (Path) when:**
- Files are on your local filesystem
- Want simple, straightforward code
- Don't want to manually handle base64 conversion
- Using Gemini for video/audio (supports base64)

**Use Pattern 3 (Data) when:**
- You've already converted files to base64
- Working with streaming data or buffers
- Files are in memory (not on disk)
- Need fine-grained control over encoding

### Provider-Specific Notes

#### OpenRouter

- Supports multi-modal via OpenAI, Anthropic, Google models
- Video/audio must be URLs (not local files)
- Images can be local (base64) or URLs

#### Anthropic (Claude)

- Claude 3+ supports images and documents (PDF, TXT)
- No direct video/audio support (extract frames first)
- Local files converted to base64

#### Google Gemini

- **Best multi-modal support**
- Gemini 1.5 Pro supports video, audio, images, files natively
- Local files automatically uploaded as base64
- Long context (up to 1M tokens for Gemini 1.5)

#### OpenAI

- GPT-4 Vision supports images only
- No video/audio support (extract frames first)
- Local images converted to base64

### MIME Type Detection

MIME types are auto-detected from file extensions:

```javascript
// Auto-detected MIME types
{
  'jpg': 'image/jpeg',
  'jpeg': 'image/jpeg',
  'png': 'image/png',
  'mp4': 'video/mp4',
  'mp3': 'audio/mpeg',
  'pdf': 'application/pdf',
  // ... and more
}
```

Override if needed:

```javascript
attachments: [{
  type: 'image',
  path: '/path/to/file',
  mimeType: 'image/jpeg'  // Explicit override
}]
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
