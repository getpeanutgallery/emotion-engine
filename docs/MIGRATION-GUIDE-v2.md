# MIGRATION GUIDE: v1.0 → v2.0 → v3.0 → v4.0

**Date:** 2026-03-04  
**Breaking Change:** Yes (v1.0→v2.0, v2.0→v3.0, and v3.0→v4.0)  
**Estimated Migration Time:** 30-60 minutes per version

---

## Quick Reference: All Versions

| Version | Key Change | Env Vars | Migration Time |
|---------|------------|----------|----------------|
| v1.0 | Original (hardcoded) | `TOOL_ID` (optional) | N/A |
| v2.0 | Pluggable tools | `TOOL_ID` (required) | 30-60 min |
| v3.0 | Path-based | `SOUL_PATH`, `GOAL_PATH`, `TOOL_PATH` | 30-60 min |
| v4.0 | YAML-only + Parallel | `--config` only | 15-30 min |

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

*Migration guide last updated: 2026-03-04*
