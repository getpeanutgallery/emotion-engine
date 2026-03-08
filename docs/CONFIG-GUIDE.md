# Configuration Guide

Complete YAML configuration schema for Emotion Engine v8.0.

---

## Table of Contents

1. [Quick Reference](#quick-reference)
2. [Environment Variables](#environment-variables)
3. [YAML Schema](#yaml-schema)
4. [Migration Guide](#migration-guide)
5. [Example Configurations](#example-configurations)

---

## Quick Reference

### Minimal Config File

```yaml
name: "My Analysis"
description: "Quick analysis pipeline"
version: "1.0"

asset:
  inputPath: "path/to/video.mp4"
  outputDir: "output/my-analysis"

ai:
  provider: openrouter
  video:
    model: qwen/qwen-3.5-397b-a17b

gather_context: []

process:
  - scripts/process/video-chunks.cjs

report:
  - scripts/report/evaluation.cjs

settings:
  chunk_duration: 8
  max_chunks: 4
```

### Required Files

- **`.env`** — Only variable needed: `AI_API_KEY`
- **`*.yaml`** — All configuration in YAML (no secrets)

---

## Environment Variables

### Required (1 variable)

| Variable | Description | Example |
|----------|-------------|---------|
| `AI_API_KEY` | API key for your AI provider | `sk-or-v1-abc123...` |

### Optional (AWS S3 only)

| Variable | Description | Example |
|----------|-------------|---------|
| `AWS_ACCESS_KEY_ID` | AWS access key | `AKIA...` |
| `AWS_SECRET_ACCESS_KEY` | AWS secret key | `xyz...` |
| `AWS_REGION` | AWS region | `us-east-1` |

### Removed (Migrate to YAML)

The following environment variables were removed and must be configured in YAML.

Runtime behavior note: `AI_PROVIDER` and `AI_MODEL` are ignored during normal pipeline execution; provider/model selection comes from YAML (`ai.provider`, `ai.<domain>.model`).

| Old Env Var | New YAML Location |
|-------------|-------------------|
| `AI_PROVIDER` | `ai.provider` |
| `AI_MODEL` | `ai.dialogue.model`, `ai.music.model`, or `ai.video.model` |
| `AI_BASE_URL` | `ai.baseUrl` |
| `STORAGE_PROVIDER` | `storage.provider` |
| `STORAGE_BUCKET` | `storage.bucket` |
| `STORAGE_REGION` | `storage.region` |

---

## YAML Schema

### Root Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Pipeline name |
| `description` | string | No | Pipeline description |
| `version` | string | No | Config version |
| `asset` | object | Yes | Input/output configuration |
| `ai` | object | Yes | AI provider configuration |
| `gather_context` | array | Yes | Phase 1 scripts |
| `process` | array/object | Yes | Phase 2 scripts |
| `report` | array | Yes | Phase 3 scripts |
| `settings` | object | No | Global settings |
| `debug` | object | No | Debug configuration |
| `tool_variables` | object | No | Tool-specific variables |
| `storage` | object | No | Storage backend config |

---

### Asset Configuration

```yaml
asset:
  inputPath: "examples/videos/test.mp4"    # Path to input video
  outputDir: "output/my-analysis"          # Output directory path
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `inputPath` | string | Yes | Path to input video file |
| `outputDir` | string | Yes | Directory for output artifacts |

---

### AI Configuration

#### Multi-Model (Per Component)

```yaml
ai:
  provider: openrouter
  dialogue:
    model: google/gemini-2.5-flash         # For transcription/context
  music:
    model: google/gemini-2.5-flash         # For music/mood analysis
  video:
    model: qwen/qwen3.5-122b-a10b          # For video analysis
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `provider` | string | Yes | AI provider: `openrouter`, `anthropic`, `gemini`, `openai` |
| `dialogue` | object | No | Dialogue-specific model config |
| `music` | object | No | Music-specific model config |
| `video` | object | No | Video-specific model config |
| `dialogue.model` | string | Conditional | Model for dialogue analysis |
| `music.model` | string | Conditional | Model for music analysis |
| `video.model` | string | Conditional | Model for video analysis |
| `baseUrl` | string | No | Custom API endpoint |

**Note:** `apiKey` is injected from `AI_API_KEY` environment variable. Never put API keys in YAML files.

---

### Phase 1: Gather Context

```yaml
gather_context:
  - scripts/get-context/get-dialogue.cjs
  - scripts/get-context/get-music.cjs
```

| Field | Type | Description |
|-------|------|-------------|
| `gather_context` | array of strings | Scripts to run in Phase 1 |

Available scripts:
- `scripts/get-context/get-dialogue.cjs` — Audio transcription
- `scripts/get-context/get-music.cjs` — Music mood analysis

---

### Phase 2: Process

#### Sequential Mode

```yaml
process:
  sequential:
    - script: scripts/process/video-chunks.cjs
      toolPath: tools/emotion-lenses-tool.cjs
      tool_variables:
        soulPath: "cast/impatient-teenager/SOUL.md"
        goalPath: "goals/video-ad-evaluation.md"
        variables:
          lenses:
            - patience
            - boredom
            - excitement
    - script: scripts/process/video-per-second.cjs
```

#### Parallel Mode

```yaml
process:
  parallel:
    - script: scripts/process/video-chunks.cjs
      toolPath: tools/emotion-lenses-tool.cjs
      tool_variables:
        soulPath: "cast/impatient-teenager/SOUL.md"
        goalPath: "goals/video-ad-evaluation.md"
    - script: scripts/process/brand-detection.cjs
    - script: scripts/process/ocr-extraction.cjs
```

#### Simple Array (Sequential, Legacy)

```yaml
process:
  - scripts/process/video-chunks.cjs
```

| Field | Type | Description |
|-------|------|-------------|
| `process.sequential` | array | Scripts run one after another |
| `process.parallel` | array | Scripts run simultaneously |
| `process[].script` | string | Script path |
| `process[].toolPath` | string | Optional tool script path |
| `process[].tool_variables` | object | Variables passed to tool |

---

### Phase 3: Report

```yaml
report:
  - scripts/report/metrics.cjs
  - scripts/report/recommendation.cjs
  - scripts/report/emotional-analysis.cjs
  - scripts/report/summary.cjs
  - scripts/report/final-report.cjs
```

| Field | Type | Description |
|-------|------|-------------|
| `report` | array of strings | Scripts to run in Phase 3 |

Available scripts:
- `scripts/report/metrics.cjs` — Calculate metrics
- `scripts/report/recommendation.cjs` — Generate recommendations
- `scripts/report/emotional-analysis.cjs` — Emotional analysis report
- `scripts/report/summary.cjs` — Summary generation
- `scripts/report/final-report.cjs` — Final combined report
- `scripts/report/evaluation.cjs` — Legacy combined report
- `scripts/report/graphs.cjs` — Chart generation

---

### Settings

```yaml
settings:
  chunk_duration: 8                       # Seconds per chunk
  max_chunks: 4                           # Max chunks to process
  api_request_delay: 1000                 # ms between API calls
  chunk_quality: "medium"                 # low|medium|high
  music_segment_duration: 30              # Seconds per music segment
  
  retry_strategy:
    type: "exponential-backoff"          # none|fixed-delay|exponential-backoff|adaptive
    config:
      maxRetries: 3
      initialDelayMs: 1000
      maxDelayMs: 10000
      exponentialBase: 2
      jitter: true
```

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `chunk_duration` | number | `8` | Duration of each video chunk in seconds |
| `max_chunks` | number | `4` | Maximum number of chunks to process |
| `api_request_delay` | number | `1000` | Milliseconds to wait between API calls |
| `chunk_quality` | string | `"medium"` | Quality preset: `low`, `medium`, `high` |
| `music_segment_duration` | number | `30` | Duration of music analysis segments |
| `retry_strategy` | object | — | Retry behavior configuration |

#### Retry Strategy

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `retry_strategy.type` | string | `"exponential-backoff"` | Strategy type |
| `retry_strategy.config` | object | — | Strategy-specific config |

**Strategy Types:**

1. **`none`** — No retries
2. **`fixed-delay`** — Fixed delay between retries
3. **`exponential-backoff`** — Exponentially increasing delay
4. **`adaptive`** — Adaptive delay based on response

**Exponential Backoff Config:**

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `config.maxRetries` | number | `3` | Maximum retry attempts |
| `config.initialDelayMs` | number | `1000` | Starting delay in milliseconds |
| `config.maxDelayMs` | number | `10000` | Maximum delay cap |
| `config.exponentialBase` | number | `2` | Multiplier for each attempt |
| `config.jitter` | boolean | `true` | Add randomness to prevent thundering herd |

---

### Debug Configuration

```yaml
debug:
  keepTempFiles: false                   # Keep temp files for debugging
  keepProcessedAssets: true              # Copy to timestamped directory
```

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `debug.keepTempFiles` | boolean | `false` | Preserve temp files (audio extracts, chunks) |
| `debug.keepProcessedAssets` | boolean | `true` | Copy to `assets/processed/<timestamp>/` |

**File Locations:**
- `phase1-gather-context/assets/processed/dialogue/<timestamp>/`
- `phase1-gather-context/assets/processed/music/<timestamp>/`
- `phase2-process/assets/processed/chunks/<timestamp>/`

See `docs/DEBUG-CONFIG.md` for complete debug documentation.

---

### Tool Variables

```yaml
tool_variables:
  soulPath: "cast/impatient-teenager/SOUL.md"
  goalPath: "goals/video-ad-evaluation.md"
  
  file_transfer:
    strategy: "base64"                 # base64|web_url|youtube_url
    mimeType: "video/mp4"
    maxFileSize: 10485760              # 10MB default
  
  chunk_strategy:
    type: "duration-based"             # duration-based|size-based|count-based
    config:
      duration: 8                      # seconds
    split:
      enabled: true
      max_splits: 3                    # Recursive split limit
      split_factor: 2                  # Divide duration by this factor
  
  variables:
    lenses:
      - patience
      - boredom
      - excitement
```

| Field | Type | Description |
|-------|------|-------------|
| `soulPath` | string | Path to SOUL.md persona file |
| `goalPath` | string | Path to GOAL.md goal file |
| `file_transfer` | object | File transfer configuration |
| `chunk_strategy` | object | Chunking strategy configuration |
| `variables` | object | Custom variables for tools |

#### File Transfer

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `file_transfer.strategy` | string | `"base64"` | Transfer method |
| `file_transfer.mimeType` | string | `"video/mp4"` | MIME type |
| `file_transfer.maxFileSize` | number | `10485760` | Max file size in bytes |

**Strategies:**
- `base64` — Embed file as base64 data
- `web_url` — Provide public URL
- `youtube_url` — YouTube video URL

#### Chunk Strategy

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `chunk_strategy.type` | string | `"duration-based"` | Chunking method |
| `chunk_strategy.config.duration` | number | `8` | Chunk duration (seconds) |
| `chunk_strategy.split.enabled` | boolean | `true` | Enable recursive splitting |
| `chunk_strategy.split.max_splits` | number | `3` | Max recursive splits |
| `chunk_strategy.split.split_factor` | number | `2` | Duration divisor per split |

---

### Storage Configuration

```yaml
storage:
  provider: "local"                    # local|s3
  local:
    basePath: "./output"
  s3:
    bucket: "my-bucket"
    region: "us-east-1"
    prefix: "emotion-engine/"
```

| Field | Type | Description |
|-------|------|-------------|
| `storage.provider` | string | Storage backend: `local`, `s3` |
| `storage.local.basePath` | string | Base directory for local storage |
| `storage.s3.bucket` | string | S3 bucket name |
| `storage.s3.region` | string | AWS region |
| `storage.s3.prefix` | string | Key prefix for S3 objects |

---

## Migration Guide

### From Environment Variables to YAML

#### Step 1: Update `.env`

**Before:**
```bash
# Too many env vars!
AI_PROVIDER=openrouter
AI_MODEL=qwen/qwen-3.5-397b-a17b
AI_BASE_URL=https://custom.api.com
STORAGE_PROVIDER=s3
STORAGE_BUCKET=my-bucket
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
STORAGE_REGION=us-east-1
```

**After:**
```bash
# Only one variable needed
AI_API_KEY=sk-or-v1-your-key-here
```

#### Step 2: Add to YAML

Add these fields to your YAML configuration:

```yaml
# AI Provider (moved from env vars)
ai:
  provider: openrouter
  dialogue:
    model: qwen/qwen-3.5-397b-a17b
  music:
    model: qwen/qwen-3.5-397b-a17b
  video:
    model: qwen/qwen-3.5-397b-a17b
  # baseUrl: https://custom.api.com  # Optional

# Storage (moved from env vars)
storage:
  provider: s3
  s3:
    bucket: my-bucket
    region: us-east-1
    prefix: "emotion-engine/"
```

#### Step 3: Verify

Run your pipeline to ensure configuration is loaded correctly:

```bash
pnpm run pipeline --config configs/my-config.yaml
```

---

## Example Configurations

### Quick Test (Minimal)

```yaml
name: "Quick Test"
description: "Minimal pipeline for testing"
version: "1.0"

asset:
  inputPath: "examples/videos/emotion-tests/cod.mp4"
  outputDir: "output/quick-test"

ai:
  provider: openrouter
  video:
    model: google/gemini-2.5-flash

gather_context: []

process:
  - scripts/process/video-chunks.cjs

report:
  - scripts/report/evaluation.cjs

settings:
  chunk_duration: 8
  max_chunks: 2
  api_request_delay: 500

tool_variables:
  soulPath: "cast/impatient-teenager/SOUL.md"
  goalPath: "goals/video-ad-evaluation.md"
  variables:
    lenses:
      - patience
      - boredom
      - excitement
```

### Full Video Analysis

```yaml
name: "Full Video Analysis"
description: "Complete analysis with all features"
version: "1.0"

asset:
  inputPath: "examples/videos/test-video.mp4"
  outputDir: "output/full-analysis"

ai:
  provider: openrouter
  dialogue:
    model: google/gemini-2.5-flash
  music:
    model: google/gemini-2.5-flash
  video:
    model: qwen/qwen3.5-122b-a10b

gather_context:
  - scripts/get-context/get-dialogue.cjs
  - scripts/get-context/get-music.cjs

process:
  sequential:
    - script: scripts/process/video-chunks.cjs
      toolPath: tools/emotion-lenses-tool.cjs
      tool_variables:
        soulPath: "cast/impatient-teenager/SOUL.md"
        goalPath: "goals/video-ad-evaluation.md"
        variables:
          lenses:
            - patience
            - boredom
            - excitement
    - script: scripts/process/video-per-second.cjs

report:
  - scripts/report/metrics.cjs
  - scripts/report/recommendation.cjs
  - scripts/report/emotional-analysis.cjs
  - scripts/report/summary.cjs
  - scripts/report/final-report.cjs

settings:
  chunk_duration: 8
  max_chunks: 10
  api_request_delay: 1000
  chunk_quality: "medium"
  music_segment_duration: 30
  
  retry_strategy:
    type: "exponential-backoff"
    config:
      maxRetries: 3
      initialDelayMs: 1000
      maxDelayMs: 10000
      exponentialBase: 2
      jitter: true

tool_variables:
  file_transfer:
    strategy: "base64"
    maxFileSize: 10485760
  chunk_strategy:
    type: "duration-based"
    config:
      duration: 8
    split:
      enabled: true
      max_splits: 3
      split_factor: 2
  soulPath: "cast/impatient-teenager/SOUL.md"
  goalPath: "goals/video-ad-evaluation.md"
  variables:
    lenses:
      - patience
      - boredom
      - excitement
```

### Parallel Multi-Persona Swarm

```yaml
name: "Multi-Persona Swarm"
description: "Same video analyzed by different personas"
version: "1.0"

asset:
  inputPath: "examples/videos/test-video.mp4"
  outputDir: "output/swarm"

ai:
  provider: openrouter
  dialogue:
    model: qwen/qwen3.5-122b-a10b
  video:
    model: qwen/qwen3.5-122b-a10b

gather_context:
  - scripts/get-context/get-dialogue.cjs

process:
  parallel:
    - script: scripts/process/video-chunks.cjs
      tool_variables:
        soulPath: "cast/impatient-teenager/SOUL.md"
        goalPath: "goals/video-ad-evaluation.md"
        variables:
          lenses: [patience, boredom, excitement]
    - script: scripts/process/video-chunks.cjs
      tool_variables:
        soulPath: "cast/skeptical-cfo/SOUL.md"
        goalPath: "goals/roi-analysis.md"
        variables:
          lenses: [skepticism, roi]
    - script: scripts/process/video-chunks.cjs
      tool_variables:
        soulPath: "cast/optimistic-gen-z/SOUL.md"
        goalPath: "goals/viral-potential.md"
        variables:
          lenses: [excitement, fomo, joy]

report:
  - scripts/report/evaluation.cjs

settings:
  chunk_duration: 8
  max_chunks: 4
```

---

*Last updated: March 7, 2026*