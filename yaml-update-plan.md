# YAML Configuration Update Plan

**Date:** 2026-03-07  
**Status:** Ready for Execution  
**Agent:** Chip 🐱‍💻

---

## Audit Complete (2026-03-07)

Two SubAgents completed comprehensive audits:
- **yaml-config-audit**: Scanned all YAML configs across emotion-engine + polyrepo dependencies
- **yaml-code-usage-audit**: Scanned server code to find which YAML fields are actually used

**Key Findings:**
- Only ~60% of YAML fields defined in configs are actually functional
- Code uses env vars for AI config (`AI_API_KEY`, `AI_MODEL`, etc.), not YAML `ai.*` fields
- Several fields are duplicates (e.g., `chunk_strategy.split` vs `split_strategy`)
- `retry_strategy`, `storage`, `api_request_delay`, `chunk_quality` are NOT implemented

---

## Goal

Migrate ALL configuration to YAML files, keeping `.env` for **only** `AI_API_KEY` (security-sensitive, not committed to git):

1. Update code to read AI config from YAML `ai.*` fields instead of `process.env.AI_*`
2. Remove ALL other env vars from `.env` (AI_PROVIDER, AI_MODEL, DIALOGUE_MODEL, MUSIC_MODEL, VIDEO_MODEL, etc.)
3. Ensure `.env` contains only:
   ```env
   AI_API_KEY=sk-or-v1-...
   ```
4. Update `.env.example` with only `AI_API_KEY` placeholder
5. All other config lives in YAML files (committed to git)

---

## Overview

The emotion-engine is a **polyrepo project** with multiple subrepos. Many changes require:
1. Navigating to the proper subrepo (`retry-strategy/`, `ai-providers/`, etc.)
2. Making changes there
3. Commit and push to subrepo
4. Update `node_modules` in main emotion-engine repo to pull updated subrepo

This plan will:
1. Audit all current `.env` variables
2. Compare against what the YAML configs actually support
3. Identify which variables are actually used in code
4. Clean up `.env` to only keep `AI_API_KEY` (required for authentication)
5. Update documentation to reflect the new configuration approach

---

## Polyrepo Workflow

**Emotion-Engine Subrepos:**
- `retry-strategy/` - Retry strategy implementations
- `ai-providers/` - AI provider interface
- `cast/` - Persona definitions
- `goals/` - Goal definitions

**When implementing features:**
1. Identify which subrepo owns the feature (e.g., `retry-strategy/` for retry logic)
2. Make changes in that subrepo
3. Commit and push: `git add .; git commit -m "..."; git push`
4. In emotion-engine: Update `node_modules` to pull latest subrepo
5. Test with updated subrepo

**Example:**
```bash
# In retry-strategy subrepo:
cd /home/derrick/.openclaw/workspace/projects/peanut-gallery/retry-strategy/
# Make changes...
git add .
git commit -m "Implement exponential-backoff retry strategy"
git push

# In emotion-engine main repo:
cd /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/
# Update node_modules to pull latest subrepo
npm install <subrepo-name>  # or use polyrepo update script
```

---

## Current State Analysis

### `.env` Variables (Current)

```env
AI_API_KEY=sk-or-v1-...
AI_PROVIDER=openrouter
AI_MODEL=google/gemini-2.5-flash
DIALOGUE_MODEL=google/gemini-2.5-flash
MUSIC_MODEL=google/gemini-2.5-flash
VIDEO_MODEL=qwen/qwen3.5-122b-a10b
SOUL_PATH=cast/impatient-teenager/SOUL.md
GOAL_PATH=goals/video-ad-evaluation.md
TOOL_PATH=tools/emotion-lenses-tool.cjs
CHUNK_QUALITY=medium
CHUNK_MAX_DURATION=8
CHUNK_MAX_SIZE=8388608
API_REQUEST_DELAY=1000
API_MAX_RETRIES=3
LOG_LEVEL=info
MAX_CHUNKS=10
```

### `.env.example` Variables

(Same structure as `.env` but with placeholder values)

### YAML Config Support (Complete Schema from Polyrepo Audit)

**Repo Location:** `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/`

**Polyrepo Dependencies:**
- `cast/` - Persona definitions (SOUL.md, config.yaml)
- `goals/` - Goal definitions (GOAL.md)
- `ai-providers/` - AI provider interface
- `retry-strategy/` - Retry strategy implementations

---

#### ✅ FUNCTIONAL FIELDS (Actually Used in Code)

```yaml
# Root Metadata
name: string              # Logging/display
description: string       # Logging/display
version: string           # Report scripts (default: '8.0.0')

# Asset Configuration (REQUIRED)
asset:
  inputPath: string       # REQUIRED - Input video/audio/image path
  outputDir: string       # REQUIRED - Output directory for artifacts

# Phase Definitions (REQUIRED - at least one phase)
gather_context:           # Array or { parallel: [{ script }] }
  - scripts/get-context/get-dialogue.cjs
process:                  # Array or { sequential: [...] } or { parallel: [...] }
  - script: scripts/process/video-chunks.cjs
    toolPath: tools/emotion-lenses-tool.cjs
    tool_variables: { ... }
report:                   # Array or { parallel: [{ script }] }
  - scripts/report/evaluation.cjs

# Settings (Functional)
settings:
  chunk_duration: number          # Default: 8 (video chunking)
  max_chunks: number              # Default: unlimited
  music_segment_duration: number  # Default: 30
  segment_duration: number        # Default: 30

# Tool Variables (Functional)
tool_variables:
  soulPath: string                # REQUIRED for video analysis
  goalPath: string                # REQUIRED for video analysis
  toolPath: string                # Per-script tool override
  variables:
    lenses: array                 # ["patience", "boredom", "excitement"]
  chunk_strategy:
    type: string                  # "duration-based", "size-based", "count-based"
    config:
      chunkDuration: number
  split_strategy:                 # Note: NOT under chunk_strategy.split
    maxSplits: number             # Default: 5
    splitFactor: number           # Default: 0.5
  file_transfer:
    maxFileSize: number           # Bytes (e.g., 10485760 for 10MB)

# Debug Settings
debug:
  keepTempFiles: boolean          # Default: false
  keepProcessedAssets: boolean    # Default: true
```

---

#### ⚠️ DEFINED IN YAML BUT NOT ACTIVELY USED (Code Uses Env Vars or Ignores)

```yaml
# AI Config - Code uses process.env instead
ai:
  provider: string        # ❌ Not used - uses AI_PROVIDER env
  model: string           # ❌ Not used - uses AI_MODEL env
  apiKey: string          # ❌ Not used - uses AI_API_KEY env
  baseUrl: string         # ❌ Not implemented

# Settings - Defined but not implemented in code
settings:
  api_request_delay: number      # ❌ Not throttled in code
  chunk_quality: string          # ❌ No references in code
  retry_strategy:                # ❌ Not implemented
    type: string
    config:
      maxRetries: number
      initialDelayMs: number
      maxDelayMs: number
      exponentialBase: number
      jitter: boolean

# File Transfer - Only maxFileSize used
tool_variables:
  file_transfer:
    strategy: string      # ❌ "base64" defined but not used
    mimeType: string      # ❌ Not used

# Chunk Strategy Split (duplicate of split_strategy)
tool_variables:
  chunk_strategy:
    split:                # ❌ Duplicate - use split_strategy instead
      enabled: boolean
      max_splits: number
      split_factor: number

# Storage - Not implemented
storage:
  provider: string        # ❌ "local-fs", "aws-s3" defined but not used
  config: { ... }         # ❌ Not implemented
```

---

#### 📋 CAST PERSONA CONFIG (`cast/<persona>/config.yaml`)

```yaml
cast_member: string
name: string
version: string
tags:
  demographics: array
  platforms: array
  traits: array
  content: array
settings:
  patience_seconds: number
  boredom_threshold: number
  excitement_threshold: number
  scoring_style: string     # "harsh", "balanced", "lenient"
assets:
  portraits: string
  reactions: string
  environments: string
  videos: string
prompts:
  base_character: string
  environment: string
  style: string
```

---

#### 🔑 KEY FINDINGS

1. **Env Vars Override YAML**: Code uses `AI_API_KEY`, `AI_MODEL`, `AI_PROVIDER`, `DIALOGUE_MODEL`, `MUSIC_MODEL` from `.env` instead of YAML `ai.*` fields

2. **Duplicate Fields**: `tool_variables.chunk_strategy.split.*` is a duplicate of `tool_variables.split_strategy.*` - code uses the latter

3. **Config Inheritance**: Script-level `tool_variables` override config-level `tool_variables`

4. **Defaults in Code**:
   - `chunk_duration`: 8
   - `max_chunks`: unlimited
   - `music_segment_duration`: 30
   - `keepTempFiles`: false (explicit true required)
   - `keepProcessedAssets`: true (default unless false)
   - `split_strategy.maxSplits`: 5
   - `split_strategy.splitFactor`: 0.5

---

## Tasks

### Task 1: Update Code to Read AI Config from YAML (CRITICAL)

**SubAgent:** `coder`  
**Prompt:**
The code currently reads AI config from env vars. Update it to read from YAML `ai.*` fields instead:

**CRITICAL REQUIREMENT:** Never use a generic `AI_MODEL`. ALWAYS use explicit model types:
- `ai.dialogue.model` (required)
- `ai.music.model` (required)
- `ai.video.model` (required)

**Files to update:**
- `server/lib/models.cjs` - Reads DIALOGUE_MODEL, MUSIC_MODEL, VIDEO_MODEL from env
- `server/run-pipeline.cjs` - Reads AI_PROVIDER, AI_MODEL from env
- Any other files using `process.env.AI_*` or `process.env.*_MODEL`

**Changes needed:**
1. Remove ALL usage of generic `AI_MODEL` env var — it's ambiguous and wrong
2. Load explicit model paths from YAML:
   - `ai.dialogue.model` → for dialogue generation
   - `ai.music.model` → for music generation
   - `ai.video.model` → for video analysis
3. Load `ai.provider` from YAML (shared across all models)
4. Fall back to `AI_API_KEY` from env var only (for security)
5. Remove hardcoded env var reads for model/provider config

**YAML structure (REQUIRED fields):**
```yaml
ai:
  provider: openrouter  # Shared provider
  # Explicit model for each use case (NO generic ai.model)
  dialogue:
    model: google/gemini-2.5-flash
  music:
    model: google/gemini-2.5-flash
  video:
    model: qwen/qwen3.5-122b-a10b
```

**Code should:**
- ✅ Read `config.ai.dialogue.model` for dialogue tasks
- ✅ Read `config.ai.music.model` for music tasks
- ✅ Read `config.ai.video.model` for video tasks
- ❌ NEVER read `process.env.AI_MODEL` (ambiguous)
- ❌ NEVER read `config.ai.model` (too generic)

Report back with all files that need changes and the exact code modifications.

---

### Task 2: Update YAML Configs with Explicit AI Model Structure

**SubAgent:** `coder`  
**Prompt:**
Update YAML configs to use explicit model definitions (NO generic `ai.model`):

**REQUIRED YAML structure:**
```yaml
ai:
  provider: openrouter  # Shared across all models
  # NO generic ai.model field!
  # Explicit model for each use case:
  dialogue:
    model: google/gemini-2.5-flash
  music:
    model: google/gemini-2.5-flash
  video:
    model: qwen/qwen3.5-122b-a10b
```

**Changes:**
1. Remove any `ai.model: ...` (generic field is wrong)
2. Ensure `ai.dialogue.model`, `ai.music.model`, `ai.video.model` are all defined
3. Remove or comment out non-functional fields (retry_strategy, storage, api_request_delay, chunk_quality)
4. Remove duplicate `chunk_strategy.split` (use `split_strategy` instead)
5. Add clear defaults in YAML comments matching code defaults

Create a clean example-pipeline.yaml with only functional fields and explicit model definitions.

---

### Task 3: Implement Missing YAML Features (Make Unused Fields Functional)

**SubAgent:** `coder`  
**Prompt:**
Implement support for YAML fields that are currently defined but NOT used in code. These should be functional so users can configure them via YAML:

**1. `settings.api_request_delay`** (throttle API calls)
- Location: Add delay in API client before each request
- Read: `config.settings.api_request_delay` (milliseconds)
- Implementation: Use `setTimeout` or `sleep` before API calls
- Default: 1000ms if not specified

**2. `settings.retry_strategy`** (retry failed API calls)
- Location: Implement in API client or retry-strategy polyrepo
- Support types: "exponential-backoff", "fixed-delay", "adaptive", "none"
- Read config:
  ```yaml
  settings:
    retry_strategy:
      type: "exponential-backoff"
      config:
        maxRetries: 3
        initialDelayMs: 1000
        maxDelayMs: 30000
        exponentialBase: 2
        jitter: true
  ```
- Apply retry logic to all API calls

**3. `settings.chunk_quality`** (ffmpeg encoding quality)
- Location: `server/lib/video-chunks.cjs` or ffmpeg wrapper
- Map values to ffmpeg `-crf`:
  - "low" → crf 28
  - "medium" → crf 23 (default)
  - "high" → crf 18
- Apply to ffmpeg extract commands

**4. `tool_variables.file_transfer.strategy`** (file transfer method)
- Location: File upload/transfer code in video-chunks.cjs or api-client
- Support strategies: "base64", "web_url", "youtube_url"
- Currently only `maxFileSize` is checked
- Use strategy to determine how files are sent to AI API:
  - "base64": Encode file as base64 in API request
  - "web_url": Send public URL (file must be hosted)
  - "youtube_url": Send YouTube URL directly

**Files to update:**
- `server/lib/api-client.cjs` (retry, delay)
- `server/lib/video-chunks.cjs` (quality, file transfer strategy)
- Check `retry-strategy/` polyrepo for existing implementations

Report back with implementation plan and code changes for each feature.

---

### Task 4: Clean .env to Only AI_API_KEY

**SubAgent:** `coder`  
**Prompt:**
Nuke ALL variables from `.env` except `AI_API_KEY`:

1. Read current `.env`
2. Keep ONLY:
   ```env
   AI_API_KEY=<current-key>
   ```
3. Remove ALL other vars:
   - AI_PROVIDER ❌
   - AI_MODEL ❌
   - DIALOGUE_MODEL ❌
   - MUSIC_MODEL ❌
   - VIDEO_MODEL ❌
   - SOUL_PATH ❌
   - GOAL_PATH ❌
   - TOOL_PATH ❌
   - CHUNK_QUALITY ❌
   - CHUNK_MAX_DURATION ❌
   - CHUNK_MAX_SIZE ❌
   - API_REQUEST_DELAY ❌
   - API_MAX_RETRIES ❌
   - LOG_LEVEL ❌
   - MAX_CHUNKS ❌

4. Add comment: "All other config is in YAML files (configs/*.yaml)"

---

### Task 4: Clean .env.example

**SubAgent:** `coder`  
**Prompt:**
Update `.env.example` to contain ONLY `AI_API_KEY`:

```env
# Required: OpenRouter API key (injected at runtime)
# All other configuration is in YAML files (configs/*.yaml)
AI_API_KEY=sk-or-v1-your-key-here
```

Remove all other variables. Add a comment linking to YAML config documentation.

---

### Task 5: Update Documentation

**SubAgent:** `coder`  
**Prompt:**
Update emotion-engine documentation:

1. Update `README.md`:
   - Only `AI_API_KEY` is needed in `.env`
   - All other config (including AI models) is in YAML files
   - Show YAML structure for AI config, settings, tool_variables
   - Document NEWLY implemented features: api_request_delay, retry_strategy, chunk_quality, file_transfer.strategy

2. Create/update config guide:
   - Complete YAML schema (ALL functional fields including newly implemented)
   - Migration path from old env vars to YAML

3. Remove references to unused YAML fields (storage, etc.)

---

### Task 6: Verify Pipeline Works with YAML-Only Config

**SubAgent:** `coder`  
**Prompt:**
Test the pipeline after all changes:

1. Run test pipeline with `.env` containing only `AI_API_KEY`
2. Verify AI models are loaded from YAML `ai.*` fields (dialogue, music, video)
3. Verify settings loaded from YAML `settings.*`
4. Verify tool_variables (soulPath, goalPath, lenses) from YAML
5. Verify chunk_strategy and split_strategy from YAML
6. Verify NEWLY implemented features work:
   - api_request_delay throttles API calls
   - retry_strategy retries failed calls
   - chunk_quality affects ffmpeg encoding
   - file_transfer.strategy changes transfer method
7. Report any failures or missing config

If issues found, identify what's still requiring env vars and fix it.

---

## Final Results

**Status:** ⏳ Pending

**What We Built:** Cleaned configuration system with:
- `.env` containing only `AI_API_KEY`
- All other config in YAML files
- Updated documentation

**Commits:**
- Pending...

**Lessons Learned:** Pending...

---

*Plan created on 2026-03-07*