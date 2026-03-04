# MIGRATION GUIDE: v1.0 → v2.0 → v3.0 → v4.0 → v5.0 → v6.0 → v7.0 → v8.0

**Date:** 2026-03-04  
**Breaking Change:** Yes (v1.0→v2.0, v2.0→v3.0, v3.0→v4.0, v4.0→v5.0, v5.0→v6.0, v6.0→v7.0, v7.0→v8.0)  
**Estimated Migration Time:** 30-60 minutes per version

---

## Quick Reference: All Versions

| Version | Key Change | Env Vars | Migration Time |
|---------|------------|----------|----------------|
| v1.0 | Original (hardcoded) | `TOOL_ID` (optional) | N/A |
| v2.0 | Pluggable tools | `TOOL_ID` (required) | 30-60 min |
| v3.0 | Path-based | `SOUL_PATH`, `GOAL_PATH`, `TOOL_PATH` | 30-60 min |
| v4.0 | YAML-only + Parallel | `--config` only | 15-30 min |
| v5.0 | All phases optional | `--config` only | 5-10 min |
| v6.0 | Self-contained YAML + script naming | `asset.inputPath`, `asset.outputDir` in YAML | 15-30 min |
| v7.0 | AI Provider Abstraction | `AI_PROVIDER`, `AI_API_KEY`, `AI_MODEL` | 15-30 min |
| v8.0 | Multi-Modal + Storage Abstraction | `ATTACHMENTS`, `STORAGE_PROVIDER` | 30-60 min |

---

## v7.0 → v8.0 Migration (Multi-Modal AI + Storage Abstraction)

**Date:** 2026-03-04  
**Breaking Change:** No (backward compatible, new features added)  
**Estimated Migration Time:** 30-60 minutes

### What Changed

#### v7.0 (Old Architecture)

- AI providers only supported text prompts
- No multi-modal input support (video, audio, images)
- Scripts wrote directly to filesystem (tight coupling)
- No storage abstraction layer
- Hard to switch between local and cloud storage

#### v8.0 (New Architecture)

- **Multi-modal AI support**: All providers support images, video, audio, files
- **Storage abstraction**: Pluggable storage interface (local-fs, aws-s3, gcs, azure-blob)
- **Provider-agnostic scripts**: Scripts don't know which storage backend they're using
- **Enhanced AI interface**: `attachments` array for multi-modal inputs
- **Git-safe configs**: Storage credentials in environment, not YAML

### Step-by-Step Migration

#### Step 1: Update AI Provider Calls (Optional - Backward Compatible)

**OLD (v7.0 - Text Only):**
```javascript
const aiProvider = require('../server/lib/ai-providers/ai-provider-interface.js');

const response = await aiProvider.complete({
  prompt: 'Analyze this video chunk',
  model: 'qwen/qwen-3.5-397b-a17b',
  apiKey: process.env.AI_API_KEY,
});
```

**NEW (v8.0 - Multi-Modal):**
```javascript
const aiProvider = require('../server/lib/ai-providers/ai-provider-interface.js');

const response = await aiProvider.complete({
  prompt: 'Analyze this video for emotional content',
  model: 'openai/gpt-4o',
  apiKey: process.env.OPENROUTER_API_KEY,
  attachments: [
    {
      type: 'video',
      path: 'https://example.com/video.mp4',
      mimeType: 'video/mp4'
    }
  ]
});
```

**Note:** Existing text-only calls continue to work without changes.

#### Step 2: Add Storage Interface to Scripts

**OLD (v7.0 - Direct Filesystem):**
```javascript
// scripts/process/video-chunks.cjs
const fs = require('fs');
const path = require('path');

async function run(input) {
  const { outputDir } = input;
  
  // Write directly to filesystem
  const filePath = path.join(outputDir, 'chunk-1.json');
  fs.writeFileSync(filePath, JSON.stringify(data));
  
  return { artifacts: { chunkAnalysis: [...] } };
}
```

**NEW (v8.0 - Storage Abstraction):**
```javascript
// scripts/process/video-chunks.cjs
const storage = require('../../server/lib/storage/storage-interface.js');

async function run(input) {
  const { outputDir } = input;
  
  // Write to storage (doesn't know if local or S3)
  const artifactPath = await storage.write(
    `output/${outputDir}/chunk-1.json`,
    JSON.stringify(data)
  );
  
  return { artifacts: { chunkAnalysis: [...] } };
}
```

#### Step 3: Update Configuration Files

**OLD (v7.0 - No Storage Config):**
```yaml
# configs/video-analysis.yaml
asset:
  inputPath: ".cache/videos/cod.mp4"
  outputDir: "output/cod-test"

ai:
  provider: openrouter
  model: qwen/qwen-3.5-397b-a17b
```

**NEW (v8.0 - With Storage Config):**
```yaml
# configs/video-analysis.yaml
asset:
  inputPath: ".cache/videos/cod.mp4"
  outputDir: "output/cod-test"

# Storage configuration (git-safe, no secrets)
storage:
  provider: aws-s3  # or local-fs, gcs, azure-blob
  bucket: my-emotion-engine-bucket
  region: us-east-1

ai:
  provider: openrouter
  model: qwen/qwen-3.5-397b-a17b
```

#### Step 4: Set Environment Variables

**Local Development:**
```bash
# .env file

# Storage (default: local-fs)
STORAGE_PROVIDER=local-fs

# AI Provider
AI_PROVIDER=openrouter
AI_API_KEY=$OPENROUTER_API_KEY
AI_MODEL=qwen/qwen-3.5-397b-a17b
```

**Production (AWS S3):**
```bash
# Environment variables (injected via secrets manager)

# Storage
STORAGE_PROVIDER=aws-s3
AWS_ACCESS_KEY_ID=$AWS_ACCESS_KEY_ID
AWS_SECRET_ACCESS_KEY=$AWS_SECRET_ACCESS_KEY
AWS_REGION=us-east-1
S3_BUCKET=my-emotion-engine-bucket

# AI Provider
AI_PROVIDER=openrouter
AI_API_KEY=$OPENROUTER_API_KEY
AI_MODEL=qwen/qwen-3.5-397b-a17b
```

### New Files Created

```
server/lib/storage/
├── storage-interface.js        # Contract definition
├── providers/
│   ├── local-fs.cjs            # Local filesystem (default)
│   ├── aws-s3.cjs              # AWS S3
│   ├── gcs.cjs                 # Google Cloud Storage (template)
│   └── azure-blob.cjs          # Azure Blob Storage (template)
```

### Updated Files

```
server/lib/ai-providers/
├── ai-provider-interface.js    # Added attachments support
├── providers/
│   ├── openrouter.cjs          # Multi-modal support
│   ├── anthropic.cjs           # Multi-modal support
│   ├── gemini.cjs              # Multi-modal support
│   └── openai.cjs              # Multi-modal support
```

### Provider Capabilities Matrix

| Provider | Images | Video | Audio | Files | Notes |
|----------|--------|-------|-------|-------|-------|
| **OpenRouter** | ✅ | ✅ (URL) | ✅ (URL) | ✅ (URL) | Video/audio via URL only |
| **Anthropic** | ✅ | ❌ | ❌ | ✅ (PDF, TXT) | Claude 3+ only |
| **Gemini** | ✅ | ✅ | ✅ | ✅ | Best multi-modal support |
| **OpenAI** | ✅ | ❌ | ❌ | ❌ | GPT-4 Vision only |

### Storage Provider Comparison

| Provider | Best For | Cost | Setup |
|----------|----------|------|-------|
| **local-fs** | Development | Free | ⭐ Easy |
| **aws-s3** | Production | Pay-per-use | ⭐⭐ Medium |
| **gcs** | GCP ecosystems | Pay-per-use | ⭐⭐ Medium |
| **azure-blob** | Azure ecosystems | Pay-per-use | ⭐⭐ Medium |

### Backward Compatibility

✅ **Fully backward compatible** - All v7.0 code continues to work:

- Text-only AI calls work without changes
- Direct filesystem writes still work (but consider migrating to storage interface)
- Existing configs work without storage section (defaults to local-fs)

### Migration Checklist

- [ ] Review AI provider calls - consider adding attachments for multi-modal
- [ ] Update scripts to use storage interface (recommended for new code)
- [ ] Add storage configuration to YAML files (optional, defaults to local-fs)
- [ ] Set STORAGE_PROVIDER environment variable (optional, defaults to local-fs)
- [ ] For cloud storage: set provider-specific env vars (AWS, GCP, Azure)
- [ ] Test with local-fs first, then migrate to cloud storage
- [ ] Update CI/CD pipelines to inject storage credentials

---

## v6.0 → v7.0 Migration (AI Provider Abstraction)

**Date:** 2026-03-04  
**Breaking Change:** Yes (CLI arguments removed, YAML structure changed)  
**Estimated Migration Time:** 15-30 minutes

### What Changed

#### v5.0 (Old Architecture)

- CLI accepted asset path and output dir as arguments: `node server/run-pipeline.cjs --config config.yaml video.mp4 output/`
- `tool_variables` used ID-based references: `soulId`, `goalId`, `toolId`, `selectedLenses`
- Script names were ambiguous: `per-second.cjs` (what asset type?)
- YAML configs were not fully self-contained

#### v6.0 (New Architecture)

- **YAML is completely self-contained**: Asset paths are in the YAML file, not CLI arguments
- **CLI is simplified**: `node server/run-pipeline.cjs --config config.yaml` (no additional args)
- **`tool_variables` uses paths, not IDs**: `soulPath`, `goalPath`, `variables.lenses`
- **Script names are explicit**: `video-per-second.cjs`, `audio-segments.cjs`, `image-frames.cjs`
- **Process phase uses `sequential:` or `parallel:` keys** for clarity

### Step-by-Step Migration

#### Step 1: Update Config Files - Add Asset Section

**OLD (v5.0):**
```yaml
# configs/video-analysis.yaml
name: "Full Video Analysis Pipeline"
gather_context:
  - scripts/get-context/get-dialogue.cjs
process:
  - scripts/process/video-chunks.cjs
  - scripts/process/per-second.cjs
report:
  - scripts/report/evaluation.cjs
settings:
  chunk_duration: 8
tool_variables:
  soulId: "impatient-teenager"
  goalId: "video-ad-evaluation"
  toolId: "emotion-tracking"
  selectedLenses:
    - patience
    - boredom
    - excitement
```

**NEW (v6.0):**
```yaml
# configs/video-analysis.yaml
name: "Full Video Analysis Pipeline"

# Asset configuration (self-contained - no CLI args needed)
asset:
  inputPath: ".cache/videos/cod.mp4"
  outputDir: "output/cod-test"

gather_context:
  - scripts/get-context/get-dialogue.cjs

process:
  sequential:
    - script: scripts/process/video-chunks.cjs
      toolPath: tools/emotion-lenses-tool.cjs
      tool_variables:
        soulPath: "/absolute/path/to/personas/souls/impatient-teenager/1.0.0/SOUL.md"
        goalPath: "/absolute/path/to/personas/goals/video-ad-evaluation/1.0.0/GOAL.md"
        variables:
          lenses:
            - patience
            - boredom
            - excitement
    - script: scripts/process/video-per-second.cjs
      toolPath: tools/emotion-lenses-tool.cjs
      tool_variables:
        soulPath: "/absolute/path/to/personas/souls/impatient-teenager/1.0.0/SOUL.md"
        goalPath: "/absolute/path/to/personas/goals/video-ad-evaluation/1.0.0/GOAL.md"
        variables:
          lenses:
            - patience
            - boredom
            - excitement

report:
  - scripts/report/evaluation.cjs

settings:
  chunk_duration: 8
```

#### Step 2: Update CLI Usage

**OLD (v5.0):**
```bash
node server/run-pipeline.cjs --config configs/video-analysis.yaml video.mp4 output/
```

**NEW (v6.0):**
```bash
node server/run-pipeline.cjs --config configs/video-analysis.yaml
```

**Note:** The asset path and output directory are now specified in the YAML file under the `asset:` key.

#### Step 3: Rename Scripts

Rename the following scripts for clarity:

```bash
# Video processing scripts
mv server/scripts/process/per-second.cjs server/scripts/process/video-per-second.cjs

# (Future: audio and image scripts follow same pattern)
# mv server/scripts/process/per-second.cjs server/scripts/process/audio-per-second.cjs
# mv server/scripts/process/frames.cjs server/scripts/process/image-frames.cjs
```

Update all references in config files and documentation.

#### Step 4: Update tool_variables Structure

**OLD (v5.0):**
```yaml
tool_variables:
  soulId: "impatient-teenager"
  goalId: "video-ad-evaluation"
  toolId: "emotion-tracking"
  selectedLenses:
    - patience
    - boredom
    - excitement
```

**NEW (v6.0):**
```yaml
tool_variables:
  soulPath: "/absolute/path/to/personas/souls/impatient-teenager/1.0.0/SOUL.md"
  goalPath: "/absolute/path/to/personas/goals/video-ad-evaluation/1.0.0/GOAL.md"
  variables:
    lenses:
      - patience
      - boredom
      - excitement
```

**Key changes:**
- `soulId` → `soulPath` (absolute path to SOUL.md file)
- `goalId` → `goalPath` (absolute path to GOAL.md file)
- `toolId` → **removed** (tool is specified via `toolPath` in each process script)
- `selectedLenses` → `variables.lenses` (nested under `variables` key)

#### Step 5: Update Process Phase Syntax

**OLD (v5.0):**
```yaml
process:
  - scripts/process/video-chunks.cjs
  - scripts/process/per-second.cjs
```

**NEW (v6.0):**
```yaml
process:
  sequential:
    - script: scripts/process/video-chunks.cjs
      toolPath: tools/emotion-lenses-tool.cjs
      tool_variables:
        soulPath: /path/to/SOUL.md
        goalPath: /path/to/GOAL.md
        variables:
          lenses: [patience, boredom, excitement]
    - script: scripts/process/video-per-second.cjs
      toolPath: tools/emotion-lenses-tool.cjs
      tool_variables:
        soulPath: /path/to/SOUL.md
        goalPath: /path/to/GOAL.md
        variables:
          lenses: [patience, boredom, excitement]
```

**For parallel execution:**
```yaml
process:
  parallel:
    - script: scripts/process/video-chunks.cjs
      toolPath: tools/emotion-lenses-tool.cjs
      tool_variables:
        soulPath: /path/to/SOUL.md
        goalPath: /path/to/GOAL.md
        variables:
          lenses: [patience, boredom]
    - script: scripts/process/video-chunks.cjs
      toolPath: tools/emotion-lenses-tool.cjs
      tool_variables:
        soulPath: /path/to/other/SOUL.md
        goalPath: /path/to/other/GOAL.md
        variables:
          lenses: [excitement, joy]
```

### Migration Checklist

- [ ] Add `asset.inputPath` and `asset.outputDir` to all config files
- [ ] Remove asset path and output dir from CLI commands
- [ ] Rename `per-second.cjs` → `video-per-second.cjs`
- [ ] Update all `tool_variables` to use `soulPath`, `goalPath`, `variables`
- [ ] Remove `toolId` from configs (use `toolPath` in each process script instead)
- [ ] Add `sequential:` or `parallel:` key to process phase
- [ ] Add `script:` and `toolPath:` keys to each process script entry
- [ ] Update documentation and examples

### Benefits of v6.0

- ✅ **Fully reproducible runs** — Commit the config, re-run anytime with identical results
- ✅ **No CLI args to forget** — Everything is in the YAML file
- ✅ **Clear script naming** — `video-per-second.cjs` vs `audio-per-second.cjs`
- ✅ **Path-based configuration** — No ID resolution, explicit file paths
- ✅ **CI/CD friendly** — Configs are source-controllable and environment-agnostic
- ✅ **Easy to share** — Send a config file, not a config + CLI command

### Breaking Changes Summary

| Aspect | v5.0 | v6.0 | Migration Action |
|--------|------|------|------------------|
| CLI args | `--config file.yaml video.mp4 output/` | `--config file.yaml` | Move paths to YAML |
| Asset paths | CLI arguments | `asset.inputPath`, `asset.outputDir` in YAML | Update configs |
| `soulId` | Used | **Removed** | Replace with `soulPath` |
| `goalId` | Used | **Removed** | Replace with `goalPath` |
| `toolId` | Used | **Removed** | Use `toolPath` in each script |
| `selectedLenses` | Top-level | `variables.lenses` | Nest under `variables` |
| Script names | `per-second.cjs` | `video-per-second.cjs` | Rename files and update references |
| Process syntax | Array of strings | `sequential:` or `parallel:` with objects | Update structure |

---

## v4.0 → v5.0 Migration (All Phases Optional)

**Date:** 2026-03-04  
**Breaking Change:** No (backward compatible)  
**Estimated Migration Time:** 5-10 minutes

### What Changed

#### v4.0 (Old Architecture)

- Process phase was REQUIRED (1-N scripts)
- Report phase was REQUIRED (1-N scripts)
- Gather Context phase was optional (0-N scripts)
- Validation: Each required phase must have at least 1 script

#### v5.0 (New Architecture)

- **All phases are optional** (0-N scripts each)
- **Only validation:** At least 1 script somewhere in the pipeline
- Enables flexible pipeline configurations

### Step-by-Step Migration

#### Step 1: Update Existing Configs (Optional)

Existing configs continue to work without changes. You can now skip phases:

```yaml
# OLD (v4.0): Required to have process and report
gather_context:
  - scripts/get-context/get-dialogue.cjs
process:
  - scripts/process/video-chunks.cjs
report:
  - scripts/report/evaluation.cjs

# NEW (v5.0): Can skip phases
gather_context:
  - scripts/get-context/get-dialogue.cjs
process: []  # Skip
report:
  - scripts/report/dialogue-summary.cjs
```

#### Step 2: New Config Files Available

Use the new example configs as starting points:

1. **`configs/dialogue-transcription.yaml`** — Gather + Report (skip Process)
2. **`configs/raw-analysis.yaml`** — Process only (skip Gather + Report)
3. **`configs/metadata-extract.yaml`** — Gather only (skip Process + Report)

#### Step 3: Update Validation Logic (If Customizing Pipeline)

If you've customized `run-pipeline.cjs`, update the validation:

```javascript
// OLD (v4.0):
if (!config.process || config.process.length === 0) {
  throw new Error('At least one process script is required');
}
if (!config.report || config.report.length === 0) {
  throw new Error('At least one report script is required');
}

// NEW (v5.0):
const totalScripts = 
  (config.gather_context?.length || 0) +
  (config.process?.length || 0) +
  (config.report?.length || 0);

if (totalScripts < 1) {
  throw new Error('Pipeline must have at least 1 script in any phase');
}
```

### Valid Use Cases

**1. Gather + Report (skip Process):**
```yaml
gather_context:
  - scripts/get-context/get-dialogue.cjs
process: []
report:
  - scripts/report/dialogue-summary.cjs
```
→ Transcribe audio, generate dialogue summary (no persona evaluation)

**2. Process Only (skip Gather + Report):**
```yaml
gather_context: []
process:
  - scripts/process/video-chunks.cjs
report: []
```
→ Just run analysis, output raw JSON

**3. Gather Only (skip Process + Report):**
```yaml
gather_context:
  - scripts/get-context/get-metadata.cjs
process: []
report: []
```
→ Just extract metadata, done

### Benefits

- ✅ **Flexible pipelines** — Skip phases you don't need
- ✅ **Simpler configs** — Only include what you use
- ✅ **Specialized workflows** — Transcription-only, analysis-only, metadata-only
- ✅ **Backward compatible** — Existing configs work unchanged

---

## v3.0 → v4.0 Migration (YAML-Only + Parallel Execution)

**Date:** 2026-03-04  
**Breaking Change:** Yes (CLI flags removed)  
**Estimated Migration Time:** 15-30 minutes

### What Changed

#### v3.0 (Old Architecture)

- Pipeline accepted both config files AND inline CLI flags
- `--gather`, `--process`, `--report` flags could be used instead of config
- Sequential execution only in Process phase
- Complex nested structures awkward in CLI

#### v4.0 (New Architecture)

- **YAML-only configuration**: Pipeline accepts ONLY `--config` flag
- **Parallel execution support**: Process phase supports `parallel:` key
- **CLI wrappers are separate**: `bin/run-analysis.js` for flag-based usage
- **Cleaner interface**: Single source of truth (config file)

### Step-by-Step Migration

#### Step 1: Update Your Workflow

**Replace inline CLI flags with config files:**

```bash
# OLD (v3.0):
node server/run-pipeline.cjs \
  --gather scripts/get-context/get-dialogue.cjs \
  --process scripts/process/video-chunks.cjs \
  --process scripts/process/per-second.cjs \
  --report scripts/report/evaluation.cjs \
  video.mp4 output/

# NEW (v4.0):
# Create configs/my-pipeline.yaml, then:
node server/run-pipeline.cjs --config configs/my-pipeline.yaml video.mp4 output/
```

#### Step 2: New Config Files Created

Use the new example configs as starting points:

1. **`configs/video-analysis.yaml`** — Sequential full video pipeline
2. **`configs/multi-persona-swarm.yaml`** — Parallel multi-persona analysis
3. **`configs/multi-analysis.yaml`** — Parallel independent analyses (emotion + brand + OCR)
4. **`configs/quick-test.yaml`** — Minimal pipeline for testing

#### Step 3: Using Parallel Execution

**Sequential (default):**
```yaml
process:
  - scripts/process/video-chunks.cjs
  - scripts/process/per-second.cjs  # Receives output from video-chunks
```

**Parallel:**
```yaml
process:
  parallel:
    - script: scripts/process/video-chunks.cjs
      soulPath: /path/to/persona1/SOUL.md
      toolVariables: { lenses: ["patience","boredom"] }
    - script: scripts/process/video-chunks.cjs
      soulPath: /path/to/persona2/SOUL.md
      toolVariables: { lenses: ["excitement","joy"] }
    - script: scripts/process/brand-detection.cjs
```

#### Step 4: Optional CLI Wrapper

If you prefer flag-based invocation, use the optional CLI wrapper:

```bash
# Wrapper generates YAML from flags and calls pipeline
node bin/run-analysis.js \
  --soul impatient-teenager \
  --goal video-ad-evaluation \
  --tool emotion-lenses \
  --lens patience \
  --lens boredom \
  video.mp4 output/
```

### Breaking Changes Summary

| Aspect | v3.0 | v4.0 | Migration Action |
|--------|------|------|------------------|
| `--gather` flag | Supported | **Removed** | Use config file |
| `--process` flag | Supported | **Removed** | Use config file |
| `--report` flag | Supported | **Removed** | Use config file |
| `--parallel` flag | Supported | **Removed** | Use `parallel:` in YAML |
| Inline config | Supported | **Removed** | Use config file |
| Config file | Supported | **Required** | Create/update YAML |
| Parallel syntax | N/A | `parallel:` key | Use new syntax |

### Migration Example

**Before (v3.0 with inline flags):**
```bash
node server/run-pipeline.cjs \
  --gather scripts/get-context/get-dialogue.cjs \
  --process scripts/process/video-chunks.cjs \
  --process scripts/process/per-second.cjs \
  --report scripts/report/evaluation.cjs \
  --parallel \
  video.mp4 output/
```

**After (v4.0 with config file):**

1. Create `configs/my-analysis.yaml`:
```yaml
name: "My Analysis Pipeline"
gather_context:
  - scripts/get-context/get-dialogue.cjs
process:
  - scripts/process/video-chunks.cjs
  - scripts/process/per-second.cjs
report:
  - scripts/report/evaluation.cjs
```

2. Run pipeline:
```bash
node server/run-pipeline.cjs --config configs/my-analysis.yaml video.mp4 output/
```

### Benefits of YAML-Only

- ✅ **Single configuration interface** — no sync hell between CLI and config
- ✅ **Reproducible** — commit YAML configs to git
- ✅ **Complex structures** — YAML handles nested data better than flags
- ✅ **No duplication** — no need to parse both flags and config
- ✅ **Parallel execution** — cleaner syntax with `parallel:` key

---

## v2.0 → v3.0 Migration (Path-Based Architecture)

**Date:** 2026-03-04  
**Breaking Change:** Yes  
**Estimated Migration Time:** 30-60 minutes

### What Changed

#### v2.0 (Old Architecture)

- Pipeline resolved IDs: `SOUL_ID=impatient-teenager` → `personas/souls/impatient-teenager/1.0.0/SOUL.md`
- `persona-loader.cjs` contained SemVer resolution logic
- Pipeline knew about persona directory structure
- Pipeline did file system lookups

#### v3.0 (New Architecture)

- **Pipeline accepts paths, not IDs**: `SOUL_PATH=/absolute/path/to/SOUL.md`
- **Resolution is external**: `lib/persona-resolver.cjs` (optional utility)
- **Pipeline knows nothing about personas**: Just reads files from paths
- **No file system lookups in pipeline**: Paths are validated, not resolved

### Step-by-Step Migration

#### Step 1: Update Your .env File

**Replace ID-based variables with path-based:**

```bash
# OLD (v2.0):
SOUL_ID=impatient-teenager
SOUL_VERSION=latest
GOAL_ID=video-ad-evaluation
GOAL_VERSION=1.0
TOOL_ID=emotion-lenses

# NEW (v3.0):
SOUL_PATH=/home/derrick/.openclaw/workspace/projects/opentruth/emotion-engine/personas/souls/impatient-teenager/1.0.0/SOUL.md
GOAL_PATH=/home/derrick/.openclaw/workspace/projects/opentruth/emotion-engine/personas/goals/video-ad-evaluation/1.0.0/GOAL.md
TOOL_PATH=/home/derrick/.openclaw/workspace/projects/opentruth/emotion-engine/tools/emotion-lenses-tool.cjs
```

**Tip:** Use the new CLI wrapper if you prefer ID-based usage:
```bash
node bin/run-analysis.js --soul impatient-teenager --goal video-ad-evaluation --tool emotion-lenses video.mp4 output/
```

#### Step 2: New Files Created

These files are new in v3.0:

1. **`lib/persona-resolver.cjs`**
   - Converts IDs to paths (used by CLI wrapper)
   - Handles SemVer resolution
   - NOT used by pipeline (only by CLI wrapper)

2. **`bin/run-analysis.js`**
   - User-facing CLI that accepts IDs
   - Resolves IDs → paths using persona-resolver
   - Calls pipeline with resolved paths

#### Step 3: Update Pipeline Scripts

The following files have been updated:

1. **`server/run-pipeline.cjs`**
   - Now reads `SOUL_PATH`, `GOAL_PATH`, `TOOL_PATH` from env
   - Validates that paths exist (fails if not found)
   - Removed all ID resolution logic

2. **`server/lib/persona-loader.cjs`**
   - Removed `resolveVersion()` function
   - `loadSoul()` now receives a path, not an ID
   - `loadGoal()` now receives a path, not an ID
   - `loadTool()` now receives a path, not an ID

3. **`server/03-analyze-chunks.cjs`**
   - Uses path-based loading
   - No ID resolution

4. **`server/04-per-second-emotions.cjs`**
   - Uses path-based loading
   - No ID resolution

#### Step 4: Test Your Setup

**Test 1: Without SOUL_PATH (should fail)**

```bash
cd /home/derrick/.openclaw/workspace/projects/opentruth/emotion-engine
unset SOUL_PATH
unset GOAL_PATH
unset TOOL_PATH
node server/run-pipeline.cjs ./videos/test.mp4 ./output/test
```

**Expected output:**
```
❌ SOUL_PATH is REQUIRED but not set
Example: SOUL_PATH=/home/user/personas/souls/impatient-teenager/1.0.0/SOUL.md
```

**Test 2: With CLI wrapper (should work)**

```bash
node bin/run-analysis.js \
  --soul impatient-teenager \
  --goal video-ad-evaluation \
  --tool emotion-lenses \
  ./videos/test.mp4 ./output/test
```

**Expected output:**
```
🔍 Resolving persona IDs to paths...
✅ Soul: /path/to/personas/souls/impatient-teenager/1.0.0/SOUL.md
✅ Goal: /path/to/personas/goals/video-ad-evaluation/1.0.0/GOAL.md
✅ Tool: /path/to/tools/emotion-lenses-tool.cjs

🚀 Starting pipeline...
...
```

**Test 3: With direct pipeline call (should work)**

```bash
export SOUL_PATH=/path/to/personas/souls/impatient-teenager/1.0.0/SOUL.md
export GOAL_PATH=/path/to/personas/goals/video-ad-evaluation/1.0.0/GOAL.md
export TOOL_PATH=/path/to/tools/emotion-lenses-tool.cjs
export TOOL_VARIABLES='{"lenses":["patience","boredom","excitement"]}'
node server/run-pipeline.cjs ./videos/test.mp4 ./output/test
```

**Expected output:**
```
✅ Loaded SOUL_PATH=/path/to/SOUL.md
✅ Loaded GOAL_PATH=/path/to/GOAL.md
✅ Loaded TOOL_PATH=/path/to/tool.cjs
Starting Emotion Engine Pipeline
...
```

### Breaking Changes Summary

| Aspect | v2.0 | v3.0 | Migration Action |
|--------|------|------|------------------|
| `SOUL_ID` | Used | **Removed** | Replace with `SOUL_PATH` |
| `SOUL_VERSION` | Used | **Removed** | Include version in path |
| `GOAL_ID` | Used | **Removed** | Replace with `GOAL_PATH` |
| `GOAL_VERSION` | Used | **Removed** | Include version in path |
| `TOOL_ID` | Used | **Removed** | Replace with `TOOL_PATH` |
| Resolution logic | In `persona-loader.cjs` | In `lib/persona-resolver.cjs` (optional) | Use CLI wrapper or update scripts |
| Pipeline knowledge | Knows about persona structure | Zero knowledge | No action needed |

### Optional: Use CLI Wrapper Instead of Migrating Scripts

If you don't want to update all your scripts, use the new CLI wrapper:

```bash
# Instead of:
export SOUL_ID=impatient-teenager
export TOOL_ID=emotion-lenses
node server/run-pipeline.cjs video.mp4 output/

# Use:
node bin/run-analysis.js --soul impatient-teenager --tool emotion-lenses video.mp4 output/
```

The CLI wrapper handles ID → path resolution for you.

---

## v1.0 → v2.0 Migration (Pluggable Tool Architecture)

The following files have been updated:

1. **`server/run-pipeline.cjs`**
   - Now validates `TOOL_ID` is set (fails if missing)
   - Now validates `TOOL_VARIABLES` is set (fails if missing)
   - Removed hardcoded defaults

2. **`server/03-analyze-chunks.cjs`**
   - Removed `selectedLenses = ['patience', 'boredom', 'excitement']`
   - Now loads tool script dynamically: `tools/${TOOL_ID}-tool.cjs`
   - Calls `tool.analyze()` instead of `persona-loader.buildSystemPrompt()`

3. **`server/04-per-second-emotions.cjs`**
   - Same changes as `03-analyze-chunks.cjs`
   - Calls `tool.formatStateAfterResponse()` after API response

4. **`server/lib/persona-loader.cjs`**
   - Removed lens-specific prompt building logic
   - `buildSystemPrompt()` is deprecated (kept for migration)
   - Now only loads soul/goal config for tools to use

### Step 3: New Tool Scripts Created

These files are new:

1. **`tools/emotion-lenses-tool.cjs`**
   - Contains all emotion-tracking logic
   - Implements `analyze()`, `validateVariables()`, `formatStateAfterResponse()`
   - Builds its own prompts

2. **`tools/lib/tool-interface.js`**
   - Defines the standard tool contract
   - JSDoc documentation for tool developers

### Step 4: Test Your Setup

**Test 1: Without TOOL_ID (should fail)**

```bash
cd /home/derrick/.openclaw/workspace/projects/opentruth/emotion-engine
unset TOOL_ID
unset TOOL_VARIABLES
node server/run-pipeline.cjs ./videos/test.mp4 ./output/test
```

**Expected output:**
```
❌ TOOL_ID is REQUIRED but not set
Example: TOOL_ID=emotion-lenses
```

**Test 2: Without TOOL_VARIABLES (should fail)**

```bash
export TOOL_ID=emotion-lenses
unset TOOL_VARIABLES
node server/run-pipeline.cjs ./videos/test.mp4 ./output/test
```

**Expected output:**
```
❌ TOOL_VARIABLES is REQUIRED but not set
Example: TOOL_VARIABLES='{"lenses":["patience","boredom","excitement"]}'
```

**Test 3: With valid configuration (should work)**

```bash
export TOOL_ID=emotion-lenses
export TOOL_VARIABLES='{"lenses":["patience","boredom","excitement"]}'
node server/run-pipeline.cjs ./videos/test.mp4 ./output/test
```

**Expected output:**
```
✅ Loaded TOOL_ID=emotion-lenses
✅ Loaded TOOL_VARIABLES: lenses
Starting Emotion Engine Pipeline
...
```

---

## Breaking Changes Summary

| Aspect | v1.0 | v2.0 | Migration Action |
|--------|------|------|------------------|
| `TOOL_ID` | Optional (default: `'emotion-tracking'`) | **REQUIRED** | Add to `.env` |
| `TOOL_VARIABLES` | Optional (used defaults) | **REQUIRED** | Add to `.env` |
| Tool format | `TOOLS.md` (markdown schema) | `<tool-id>-tool.cjs` (executable) | Use new tool scripts |
| Prompt building | `persona-loader.cjs` | Tool scripts | No action (already updated) |
| State management | Hardcoded emotion state | Generic state object | No action (already updated) |

---

## Rollback Plan

If you need to revert to v1.0:

```bash
# 1. Revert git changes
git checkout HEAD~5 -- server/
git checkout HEAD~5 -- .env.example

# 2. Remove new tool files
rm -rf tools/

# 3. Restore old .env
cp .env.example .env

# 4. Test
node server/run-pipeline.cjs ./videos/test.mp4 ./output/test
```

---

## Creating Custom Tools (v2.0)

To create a new tool (e.g., `sentiment-tool.cjs`):

1. **Create tool script:**
   ```bash
   touch tools/sentiment-tool.cjs
   ```

2. **Implement the interface:**
   ```javascript
   const fs = require('fs');
   const path = require('path');
   
   function validateVariables(toolVariables) {
     // Your validation logic
     return { valid: true };
   }
   
   async function analyze(input) {
     const { toolVariables, videoContext, dialogueContext, musicContext, previousState } = input;
     
     // Build your prompt
     const prompt = 'Your system prompt here...';
     
     return {
       prompt,
       state: previousState || {}
     };
   }
   
   function formatStateAfterResponse(apiResponse, previousState) {
     // Format state for next iteration
     return previousState || {};
   }
   
   module.exports = {
     analyze,
     validateVariables,
     formatStateAfterResponse
   };
   ```

3. **Update .env:**
   ```bash
   TOOL_ID=sentiment
   TOOL_VARIABLES='{"granularity":"second"}'
   ```

4. **Test:**
   ```bash
   node server/run-pipeline.cjs ./videos/test.mp4 ./output/test
   ```

---

## Frequently Asked Questions

### Q: Why remove defaults?

**A:** Defaults hid the tool-specific knowledge in the pipeline. By requiring `TOOL_ID` and `TOOL_VARIABLES`, we force explicit configuration and make the pipeline truly tool-agnostic.

### Q: Can I still use the old emotion-tracking tool?

**A:** Yes, but you need to migrate it to the new format. The logic from `TOOLS.md` has been moved to `tools/emotion-lenses-tool.cjs`. Use `TOOL_ID=emotion-lenses` instead of `TOOL_ID=emotion-tracking`.

### Q: What happens to my existing output files?

**A:** Output format is unchanged. The tool architecture change is internal — output JSON structure remains the same.

### Q: Can I mix v1.0 and v2.0 during migration?

**A:** No, this is a breaking change. All pipeline scripts must be updated together.

---

## Support

If you encounter issues:

1. Check that `TOOL_ID` and `TOOL_VARIABLES` are set in `.env`
2. Verify tool script exists: `tools/${TOOL_ID}-tool.cjs`
3. Validate `TOOL_VARIABLES` JSON syntax
4. Check logs for specific error messages

**Documentation:**
- `docs/PLUGGABLE-TOOL-ARCHITECTURE.md` — Full architecture spec
- `tools/lib/tool-interface.js` — Tool contract definitions
- `tools/emotion-lenses-tool.cjs` — Example tool implementation

---

## v6.0 → v7.0 Migration (AI Provider Abstraction)

**Date:** 2026-03-04  
**Breaking Change:** No (backward compatible, but recommended)  
**Estimated Migration Time:** 15-30 minutes

### What Changed

#### v6.0 (Old Architecture)

- Tools implemented provider-specific API logic directly
- API keys sometimes stored in YAML configs (insecure)
- Hard to switch between AI providers (OpenRouter, Anthropic, Gemini, etc.)
- No standardized AI interface

#### v7.0 (New Architecture)

- **AI Provider Abstraction Layer**: Standardized interface for all AI providers
- **Git-safe configs**: API keys injected via environment variables (never in YAML)
- **Provider-agnostic tools**: Tools use `ai-provider-interface.js`, not provider-specific code
- **Easy provider switching**: Change `AI_PROVIDER` env var to switch providers

### Step-by-Step Migration

#### Step 1: Add AI Provider Section to Configs

**OLD (v6.0):**
```yaml
# configs/video-analysis.yaml
asset:
  inputPath: ".cache/videos/cod.mp4"
  outputDir: "output/cod-test"

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
```

**NEW (v7.0):**
```yaml
# configs/video-analysis.yaml
asset:
  inputPath: ".cache/videos/cod.mp4"
  outputDir: "output/cod-test"

# AI provider configuration (git-safe - secrets injected via env vars)
ai:
  provider: openrouter  # Provider name
  model: qwen/qwen-3.5-397b-a17b  # Model identifier
  # apiKey: NEVER put in YAML - use environment variables
  # baseUrl: Optional, defaults to provider's standard endpoint

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
```

#### Step 2: Set Environment Variables

**Development (.env file):**
```bash
# .env (add to .gitignore)
AI_PROVIDER=openrouter
AI_API_KEY=sk-or-your-api-key-here
AI_MODEL=qwen/qwen-3.5-397b-a17b
AI_BASE_URL=https://openrouter.ai/api/v1  # Optional
```

**Production (GitHub Actions):**
```yaml
# .github/workflows/analyze.yml
- name: Run Emotion Engine
  env:
    AI_PROVIDER: openrouter
    AI_API_KEY: ${{ secrets.OPENROUTER_API_KEY }}
    AI_MODEL: qwen/qwen-3.5-397b-a17b
    AI_BASE_URL: https://openrouter.ai/api/v1
  run: |
    node server/run-pipeline.cjs --config configs/video-analysis.yaml
```

#### Step 3: Update Tool Scripts (If Customizing)

**OLD (v6.0 - provider-specific logic in tool):**
```javascript
// tools/emotion-lenses-tool.cjs
const axios = require('axios');

async function analyze(input) {
  const response = await axios.post(
    'https://openrouter.ai/api/v1/chat/completions',
    {
      model: 'qwen/qwen-3.5-397b-a17b',
      messages: [{ role: 'user', content: buildPrompt(input) }],
    },
    {
      headers: {
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
      },
    }
  );
  
  return parseResponse(response.data.choices[0].message.content);
}
```

**NEW (v7.0 - provider-agnostic):**
```javascript
// tools/emotion-lenses-tool.cjs
const aiProvider = require('../server/lib/ai-providers/ai-provider-interface.js');

async function analyze(input) {
  const response = await aiProvider.complete({
    prompt: buildPrompt(input),
    model: process.env.AI_MODEL || 'qwen/qwen-3.5-397b-a17b',
    apiKey: process.env.AI_API_KEY,  // Injected at runtime
    baseUrl: process.env.AI_BASE_URL,
  });
  
  return parseResponse(response.content);
}
```

#### Step 4: Update .gitignore

Add runtime config files to `.gitignore`:

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

### Migration Checklist

- [ ] Add `ai:` section to all config files
- [ ] Set `AI_PROVIDER`, `AI_API_KEY`, `AI_MODEL` environment variables
- [ ] Update custom tool scripts to use `ai-provider-interface.js`
- [ ] Remove any hardcoded API keys from YAML configs
- [ ] Update `.gitignore` to exclude secret-containing files
- [ ] Update CI/CD pipelines to inject secrets via environment variables
- [ ] Test with different provider (optional): `AI_PROVIDER=anthropic`

### Benefits of v7.0

- ✅ **Git-safe configs** — No API keys in YAML, safe to commit
- ✅ **Easy provider switching** — Change `AI_PROVIDER` env var
- ✅ **Provider-agnostic tools** — Tools work with any provider
- ✅ **Standardized interface** — All providers implement same contract
- ✅ **Multi-provider support** — OpenRouter, Anthropic, Gemini, OpenAI, Azure (planned)

### Breaking Changes Summary

| Aspect | v6.0 | v7.0 | Migration Action |
|--------|------|------|------------------|
| AI logic location | In tools | In `ai-providers/` | Update tools to use interface |
| API key storage | Sometimes in YAML | Environment variables only | Move to env vars |
| Provider switching | Code changes | Change env var | Update `.env` or CI config |
| Config structure | No `ai:` section | `ai:` section added | Add to configs |

### Available Providers

| Provider | Env Var | Model Format | Example |
|----------|---------|--------------|---------|
| OpenRouter | `AI_PROVIDER=openrouter` | `publisher/model` | `qwen/qwen-3.5-397b-a17b` |
| Anthropic | `AI_PROVIDER=anthropic` | `model-name-date` | `claude-3-5-sonnet-20241022` |
| Gemini | `AI_PROVIDER=gemini` | `model-name` | `gemini-1.5-pro` |
| OpenAI | `AI_PROVIDER=openai` | `model-name` | `gpt-4-turbo` |

### Documentation

- **Full Specification**: [`docs/AI-PROVIDER-ARCHITECTURE.md`](AI-PROVIDER-ARCHITECTURE.md)
- **Interface Definition**: `server/lib/ai-providers/ai-provider-interface.js`
- **Provider Implementations**: `server/lib/ai-providers/providers/*.cjs`

---

*Migration guide last updated: 2026-03-04*
