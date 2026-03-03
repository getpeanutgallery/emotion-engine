# Emotion Engine Hardening Plan

**Generated:** 2026-03-03  
**Based On:** PIPELINE_REVIEW.md + Derrick's input  
**Goal:** Production-ready pipeline with proper error handling, retry logic, and persona integration

---

## Overview

This plan addresses all 15 identified risks plus the API key management issue. Organized into **4 phases** with verification checkpoints between each.

**Total Estimated Time:** 4-5 hours  
**Risk Level After Completion:** 🟢 LOW (demo-ready)

---

## Phase 1: Critical Fixes (Persona Integration + API Key)

**Priority:** 🔴 CRITICAL  
**Time:** 1.5-2 hours  
**Goal:** Make the persona system actually work and secure API key handling

### Task 1.1: Fix Persona System Integration in 03-analyze-chunks.cjs
**Issue:** Persona prompt is built but never sent to API  
**Files:** `server/03-analyze-chunks.cjs`

**Changes:**
- Add system message to API call with persona prompt
- Ensure persona voice/behavior is actually used in analysis
- Test with small video chunk

**Verification:**
```bash
node -e "const loader = require('./lib/persona-loader.cjs'); const config = loader.loadPersonaConfig('impatient-teenager', 'video-ad-evaluation', 'emotion-tracking'); console.log(config ? '✅ Persona loads' : '❌ Failed')"
```

### Task 1.2: Fix 04-per-second-emotions.cjs to Use Persona Loader
**Issue:** Hardcoded persona instead of loading from files  
**Files:** `server/04-per-second-emotions.cjs`

**Changes:**
- Import persona-loader at top of script
- Load SOUL_ID, GOAL_ID, TOOL_ID from env vars
- Use personaConfig in prompt building
- Add error handling if persona fails to load

**Verification:**
- Run step 4 with custom SOUL_ID env var
- Confirm persona voice appears in output

### Task 1.3: Fix generate-report.cjs Output Format
**Issue:** Expects `persona.name/description` but gets different structure  
**Files:** `server/generate-report.cjs`

**Changes:**
- Read from `persona.config.soul.Name` or fallback to `persona.id`
- Update all persona references to match new structure
- Add null safety checks

**Verification:**
- Generate report from existing test output
- Confirm no `Cannot read property of undefined` errors

### Task 1.4: Implement API Key Management
**Issue:** No secure API key handling, hardcoded keys  
**Files:** All server scripts, `.env.example`

**Changes:**
- Create `.env.example` file (NOT committed to git, template only)
- Update all scripts to read `OPENROUTER_API_KEY` from env
- Add validation at script start: fail fast if key missing
- Update README with setup instructions

**Files to Create:**
```
/.env.example
# Required: OpenRouter API key
OPENROUTER_API_KEY=sk-or-...

# Persona configuration (all support SemVer or 'latest')
SOUL_ID=impatient-teenager
SOUL_VERSION=latest          # Options: 'latest', '1', '1.0', '1.0.0'
GOAL_ID=video-ad-evaluation
GOAL_VERSION=1.0             # Use latest 1.0.x
TOOL_ID=emotion-tracking
TOOL_VERSION=latest

# Optional: Model overrides
DIALOGUE_MODEL=openai/gpt-audio
MUSIC_MODEL=openai/gpt-audio
VIDEO_MODEL=qwen/qwen3.5-122b-a10b

# Optional: Quality preset (low, medium, high)
CHUNK_QUALITY=medium
```

**Files to Update:**
- `server/01-extract-dialogue.cjs` - Add API key validation
- `server/02-extract-music.cjs` - Add API key validation
- `server/03-analyze-chunks.cjs` - Add API key validation
- `server/04-per-second-emotions.cjs` - Add API key validation
- `README.md` - Add environment setup section

**Verification:**
```bash
# Should fail with clear error
unset OPENROUTER_API_KEY && node server/01-extract-dialogue.cjs

# Should work
export OPENROUTER_API_KEY=sk-or-... && node server/01-extract-dialogue.cjs test.mp4 output/test
```

---

## Phase 2: Error Handling + Retry Logic

**Priority:** 🔴 CRITICAL  
**Time:** 1-1.5 hours  
**Goal:** Robust error handling with automatic retries and fallbacks

### Task 2.1: Create API Utils Library
**Files:** `server/lib/api-utils.cjs` (NEW)

**Features:**
- `fetchWithRetry(url, options, config)` - Exponential backoff
- `validateJSON(response)` - Safe JSON parsing with error details
- `getModelFallback(category)` - Provider/model fallback chain
- Rate limit detection and handling

**Config Structure:**
```javascript
{
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 10000,
  fallbacks: {
    dialogue: ['openai/gpt-audio', 'alternative/audio-model'],
    music: ['openai/gpt-audio', 'alternative/audio-model'],
    video: ['qwen/qwen3.5-122b-a10b', 'kimi/kimi-vision', 'alternative/vision-model']
  }
}
```

### Task 2.2: Add JSON Validation to All Scripts
**Files:** `server/01-`, `02-`, `03-`, `04-extract-*.cjs`

**Changes:**
- Wrap all `JSON.parse()` calls in try/catch
- Log raw response on parse failure
- Retry with "please return valid JSON" prompt
- Fail gracefully after max retries

**Verification:**
- Test with malformed API response (mock)
- Confirm retry logic activates

### Task 2.3: Update Scripts to Use Retry Logic
**Files:** All server scripts

**Changes:**
- Replace `fetch()` with `fetchWithRetry()`
- Add per-request delay (configurable, default 1s)
- Handle 429 rate limits with Retry-After header
- Log retry attempts

**Verification:**
- Run pipeline with intentional network blip
- Confirm automatic recovery

### Task 2.4: Implement Model Fallback System
**Files:** `server/lib/models.cjs` (NEW), all server scripts

**Changes:**
- Create `models.cjs` with default + fallback chains
- Read from config file or env vars
- Auto-fallback on model unavailability
- Log which model was used

**Config File:** `server/config/models.json`
```json
{
  "dialogue": {
    "default": "openai/gpt-audio",
    "fallbacks": ["openai/whisper-large", "alternative/audio-model"]
  },
  "music": {
    "default": "openai/gpt-audio",
    "fallbacks": ["alternative/audio-model"]
  },
  "video": {
    "default": "qwen/qwen3.5-122b-a10b",
    "fallbacks": ["kimi/kimi-k2-0905", "alternative/vision-model"]
  }
}
```

**Verification:**
- Set invalid default model
- Confirm fallback activates automatically

---

## Phase 3: Chunk Management + Validation

**Priority:** 🟡 HIGH  
**Time:** 1 hour  
**Goal:** Never skip chunks, always stay under 10MB limit

### Task 3.1: Implement Smart Chunk Sizing
**Files:** `server/03-analyze-chunks.cjs`

**Changes:**
- Add quality presets (low/medium/high) via env vars
- Calculate optimal chunk duration based on video bitrate
- Auto-compress chunks that exceed 10MB
- Never skip chunks - always process

**Quality Presets:**
```javascript
const QUALITY_PRESETS = {
  low: { maxDuration: 4, targetSize: 4 * 1024 * 1024 },      // 4s chunks, 4MB target
  medium: { maxDuration: 8, targetSize: 8 * 1024 * 1024 },   // 8s chunks, 8MB target (default)
  high: { maxDuration: 12, targetSize: 9 * 1024 * 1024 }     // 12s chunks, 9MB target
};
```

**Env Vars:**
```bash
CHUNK_QUALITY=medium      # low, medium, high
CHUNK_MAX_DURATION=8      # Override preset duration
CHUNK_MAX_SIZE=8388608    # Override preset size (bytes)
```

**Verification:**
- Process video with varying bitrates
- Confirm all chunks are <10MB
- Confirm no chunks are skipped

### Task 3.2: Add Chunk Compression
**Files:** `server/lib/video-utils.cjs` (NEW)

**Features:**
- `compressChunk(inputPath, outputPath, maxSize)` - FFmpeg-based compression
- Reduce resolution if needed (1280px max width)
- Reduce FPS if needed (24fps target)
- Maintain aspect ratio

**Verification:**
- Create 15MB test chunk
- Compress to <8MB
- Verify visual quality is acceptable

### Task 3.3: Harden Timestamp Parsing
**Files:** `server/03-analyze-chunks.cjs`, `server/04-per-second-emotions.cjs`

**Changes:**
- Support `MM:SS`, `H:MM:SS`, `SS.mmm` formats
- Handle edge cases (missing colons, invalid numbers)
- Add unit tests for parser

**Verification:**
- Test with various timestamp formats
- Confirm all parse correctly

### Task 3.4: Add Context Validation
**Files:** `server/03-analyze-chunks.cjs`

**Changes:**
- Check if dialogue/music files exist and are non-empty
- Warn if context is missing (but continue - audio-less videos are valid)
- Add `--require-context` flag for strict mode
- Log context quality score

**Verification:**
- Run without step 1-2 output
- Confirm warning appears but processing continues
- Run with `--require-context`
- Confirm failure when context missing

---

## Phase 4: Production Features

**Priority:** 🟡 HIGH  
**Time:** 1 hour  
**Goal:** Progress tracking, validation, and polish

### Task 4.1: Add Progress Indicators
**Files:** All server scripts

**Changes:**
- Show percentage completion for each step
- Display ETA for long operations
- Log current chunk/total chunks
- Add progress callback for UI integration

**Output Example:**
```
Step 3/4: Chunked Video Analysis
  Processing chunk 5/18 (28%) - ETA: 3m 20s
  Current: 32s-40s | Size: 6.2MB | Model: qwen/qwen3.5-122b-a10b
```

**Verification:**
- Run full pipeline
- Confirm progress updates appear

### Task 4.2: Add Output File Validation
**Files:** `server/run-pipeline.cjs`, `server/generate-report.cjs`

**Changes:**
- Validate file size > 0
- Validate JSON syntax for .json files
- Check expected field presence
- Generate validation report

**Verification:**
- Create empty output file
- Confirm validation fails
- Create valid output file
- Confirm validation passes

### Task 4.3: Convert Relative Paths to Absolute
**Files:** All server scripts

**Changes:**
- Use `path.resolve(__dirname, ...)` for all paths
- Ensure scripts work from any working directory
- Add working directory to debug logs

**Verification:**
- Run scripts from different directories
- Confirm paths resolve correctly

### Task 4.4: Add Comprehensive Logging
**Files:** All server scripts, `server/lib/logger.cjs` (NEW)

**Features:**
- Structured JSON logging
- Log levels (debug, info, warn, error)
- Include timestamps, script names, session IDs
- Optional file output for debugging

**Verification:**
- Run pipeline with `LOG_LEVEL=debug`
- Confirm detailed logs appear
- Run with `LOG_LEVEL=info`
- Confirm only essential logs appear

---

## Verification Checkpoints

### After Phase 1 ✅
- [ ] Persona system actually used in API calls
- [ ] All scripts load personas from files
- [ ] Report generator handles new structure
- [ ] API key required and validated
- [ ] `.env.example` created

**Test:**
```bash
cd server
node -e "const loader = require('./lib/persona-loader.cjs'); console.log(loader.loadPersonaConfig('impatient-teenager', 'video-ad-evaluation') ? '✅ PASS' : '❌ FAIL')"
```

### After Phase 2 ✅
- [ ] Retry logic working (test with network blip)
- [ ] JSON validation catches malformed responses
- [ ] Model fallbacks configured
- [ ] Rate limits handled gracefully

**Test:**
```bash
# Mock API failure, confirm retry activates
# Run with invalid model, confirm fallback used
```

### After Phase 3 ✅
- [ ] All chunks processed (none skipped)
- [ ] All chunks <10MB after compression
- [ ] Timestamps parse in all formats
- [ ] Context warnings appear when appropriate

**Test:**
```bash
# Process high-bitrate video
# Confirm chunk compression activates
# Verify no chunks skipped
```

### After Phase 4 ✅
- [ ] Progress indicators show percentage + ETA
- [ ] Output files validated
- [ ] Scripts work from any directory
- [ ] Logging configurable

**Test:**
```bash
# Run full pipeline with cod.mp4
# Confirm all output files valid
# Confirm progress updates throughout
```

---

## Future: Test Infrastructure (Not In Scope)

After hardening is complete, consider adding:

- **Jest or Mocha** for unit tests
- **Test fixtures** (sample API responses, mock videos)
- **CI/CD integration** (GitHub Actions)
- **Integration tests** (full pipeline with known video)

This hardening plan uses **manual verification commands** instead. Once the pipeline is stable, automated tests can be added as a separate effort.

---

## Subagent Orchestration Plan

### Dependency Graph

```
Phase 1 (Sequential - edits core files)
├─ Task 1.1: Fix 03-analyze-chunks.cjs persona integration
│  └─ Depends on: persona-loader.cjs (already exists)
├─ Task 1.2: Fix 04-per-second-emotions.cjs persona integration
│  └─ Depends on: persona-loader.cjs (already exists)
├─ Task 1.3: Fix generate-report.cjs output format
│  └─ Depends on: Task 1.1 (new output structure)
└─ Task 1.4: Create .env.example + API key validation
   └─ Independent, but all scripts need updates

Phase 2 (Parallel-safe with file locking)
├─ Task 2.1: Create api-utils.cjs (NEW FILE - no conflicts)
├─ Task 2.2: Add JSON validation to all scripts (READ-ONLY until 2.1 done)
├─ Task 2.3: Update scripts to use retry logic (depends on 2.1)
└─ Task 2.4: Create models.cjs + models.json (NEW FILES - no conflicts)

Phase 3 (Parallel-safe)
├─ Task 3.1: Update 03-analyze-chunks.cjs chunk sizing
├─ Task 3.2: Create video-utils.cjs (NEW FILE - no conflicts)
├─ Task 3.3: Harden timestamp parsing (03, 04 scripts)
└─ Task 3.4: Add context validation (03 script only)

Phase 4 (Parallel-safe)
├─ Task 4.1: Add progress indicators (all scripts)
├─ Task 4.2: Add output validation (run-pipeline, generate-report)
├─ Task 4.3: Convert paths to absolute (all scripts)
└─ Task 4.4: Create logger.cjs (NEW FILE - no conflicts)
```

### Subagent Assignment Strategy

**Rule:** Never have multiple subagents editing the same file simultaneously. Use sequential execution for dependent tasks, parallel for independent new files.

#### Phase 1: Critical Fixes (SEQUENTIAL)
**Subagent:** `main` (single agent, sequential tasks)
- Task 1.1: Edit `03-analyze-chunks.cjs`
- Task 1.2: Edit `04-per-second-emotions.cjs`
- Task 1.3: Edit `generate-report.cjs`
- Task 1.4: Create `.env.example`, then edit all 4 scripts for API key validation

**Why Sequential:** All tasks modify core pipeline scripts. Risk of merge conflicts if parallel.

#### Phase 2: Error Handling (PARALLEL for new files, SEQUENTIAL for edits)
**Subagent `phase2-utils`:**
- Task 2.1: Create `lib/api-utils.cjs` (NEW FILE)
- Task 2.4: Create `lib/models.cjs` + `config/models.json` (NEW FILES)

**Subagent `phase2-scripts` (after utils complete):**
- Task 2.2: Add JSON validation to 01-, 02-, 03-, 04- scripts
- Task 2.3: Update all scripts to use retry logic

**Dependency:** `phase2-scripts` waits for `phase2-utils` to complete (scripts import api-utils)

#### Phase 3: Chunk Management (PARALLEL-safe)
**Subagent `phase3-video`:**
- Task 3.1: Update `03-analyze-chunks.cjs` chunk sizing
- Task 3.2: Create `lib/video-utils.cjs` (NEW FILE)
- Task 3.4: Add context validation to `03-analyze-chunks.cjs`

**Subagent `phase3-parsing`:**
- Task 3.3: Harden timestamp parsing in `03-` and `04-per-second-emotions.cjs`

**Note:** `phase3-parsing` must wait for `phase3-video` if both edit `03-analyze-chunks.cjs`. Better to combine into single agent.

**Revised:** Single subagent `phase3` handles all Phase 3 tasks sequentially.

#### Phase 4: Production Features (PARALLEL-safe)
**Subagent `phase4-logging`:**
- Task 4.4: Create `lib/logger.cjs` (NEW FILE)
- Task 4.1: Add progress indicators to all scripts (uses logger)

**Subagent `phase4-validation`:**
- Task 4.2: Add output validation to `run-pipeline.cjs` and `generate-report.cjs`
- Task 4.3: Convert relative paths to absolute in all scripts

**Dependency:** `phase4-logging` must complete before `phase4-validation` starts (progress indicators use logger).

### Subagent Prompt Template

```markdown
You are hardening the Emotion Engine pipeline for production.

**Context:**
- Repo: `/home/derrick/Documents/workspace/projects/opentruth/emotion-engine/`
- Plan: `/home/derrick/Documents/workspace/projects/opentruth/emotion-engine/HARDENING_PLAN.md`
- Your Phase: [PHASE NUMBER]
- Your Tasks: [TASK LIST]

**Constraints:**
1. Do NOT edit files that other subagents are working on
2. Create new files first, then modify existing files
3. Test each change before moving to the next task
4. If you encounter a dependency on another phase's work, STOP and report

**Deliverables:**
1. All files created/modified as specified
2. Verification commands run successfully (see plan)
3. Brief summary of what was done + any issues encountered

**Testing Approach:**
- No formal unit test framework (not yet set up)
- Use manual verification commands specified in plan
- Test with small video sample before full pipeline
- Confirm expected output appears (logs, files, etc.)

**Verification Command:**
[Specific verification command for this phase]
```

### Execution Order

```
Phase 1 (main agent - sequential)
  └─ Complete → Verify → Pause for Derrick review

Phase 2 (parallel then sequential)
  ├─ Spawn `phase2-utils` → Create api-utils.cjs, models.cjs
  ├─ Wait for completion
  └─ Spawn `phase2-scripts` → Update all scripts to use utils

Phase 3 (single agent - sequential)
  └─ Spawn `phase3` → All chunk management tasks

Phase 4 (sequential with dependency)
  ├─ Spawn `phase4-logging` → Create logger, add progress indicators
  ├─ Wait for completion
  └─ Spawn `phase4-validation` → Add validation, fix paths

Final: Full pipeline test (main agent)
```

### Conflict Prevention

| Scenario | Prevention |
|----------|------------|
| Two agents edit same file | Sequential execution, clear ownership |
| Agent edits file before dependency ready | Explicit wait/dependency checks in prompt |
| Agent creates file that already exists | Check file existence first, append vs overwrite |
| Circular dependencies | Dependency graph reviewed before spawning |

---

## File Creation/Modification Summary

### New Files to Create
1. `/.env.example` - Environment variable template
2. `/server/lib/api-utils.cjs` - Retry logic, JSON validation
3. `/server/lib/models.cjs` - Model configuration + fallbacks
4. `/server/lib/video-utils.cjs` - Chunk compression
5. `/server/lib/logger.cjs` - Structured logging
6. `/server/config/models.json` - Default models + fallbacks

### Files to Modify
1. `/server/01-extract-dialogue.cjs` - API key validation, retry logic
2. `/server/02-extract-music.cjs` - API key validation, retry logic
3. `/server/03-analyze-chunks.cjs` - **CRITICAL**: Fix persona integration, chunk compression, progress
4. `/server/04-per-second-emotions.cjs` - Use persona loader, retry logic
5. `/server/generate-report.cjs` - Match new output structure, validation
6. `/server/run-pipeline.cjs` - Progress tracking, output validation
7. `/server/lib/persona-loader.cjs` - Add SemVer range support (optional)
8. `/README.md` - Environment setup, quality presets, troubleshooting

---

## Test Sequence (After All Phases)

### Unit Tests
```bash
# Persona loader
node -e "const loader = require('./server/lib/persona-loader.cjs'); console.log(loader.loadPersonaConfig('impatient-teenager', 'video-ad-evaluation') ? '✅ Persona OK' : '❌ Failed')"

# API utils
node -e "const utils = require('./server/lib/api-utils.cjs'); console.log('✅ API utils loaded')"

# Models config
node -e "const models = require('./server/lib/models.cjs'); console.log('✅ Models loaded:', models.getDefaults())"
```

### Integration Tests (10s video)
```bash
cd server
node 01-extract-dialogue.cjs ../.cache/videos/cod.mp4 ../output/test-10s --duration 10
node 02-extract-music.cjs ../output/test-10s/01-dialogue-analysis.md ../output/test-10s
node 03-analyze-chunks.cjs ../.cache/videos/cod.mp4 ../output/test-10s --duration 10 --max-chunks 2
node 04-per-second-emotions.cjs ../.cache/videos/cod.mp4 ../output/test-10s
node generate-report.cjs ../output/test-10s
```

### Full Pipeline Test (cod.mp4)
```bash
rm -rf ../output/default/*
node server/run-pipeline.cjs ../.cache/videos/cod.mp4 ../output/default

# Expected: 10-20 minutes, ~18 chunks, no failures
```

### Output Validation
```bash
# Check files exist and are valid
for f in 01-dialogue-analysis.md 02-music-analysis.md 03-chunked-analysis.json 04-per-second-emotions.json FINAL-REPORT.md; do
    [ -s ../output/default/$f ] && echo "✅ $f" || echo "❌ $f"
done

# Validate JSON
jq . ../output/default/03-chunked-analysis.json > /dev/null && echo "✅ 03 valid JSON"
jq '.chunks | length' ../output/default/03-chunked-analysis.json  # Should be ~18
jq '.per_second_data | length' ../output/default/04-per-second-emotions.json  # Should be ~140
```

---

## Success Criteria

After completing all phases:

✅ **Persona System Working**
- SOUL.md, GOAL.md, TOOLS.md all loaded and used
- Persona voice appears in analysis output
- Custom personas work via env vars

✅ **Error Handling Robust**
- API failures trigger automatic retry
- Malformed JSON caught and handled
- Model fallbacks activate on unavailability

✅ **Chunk Processing Reliable**
- No chunks skipped (ever)
- All chunks <10MB (auto-compressed)
- Consistent sizing based on quality preset

✅ **Production Ready**
- Progress indicators throughout
- Output validation on completion
- Comprehensive logging
- Works from any directory

✅ **Secure**
- API key from environment only
- No hardcoded credentials
- `.env.example` template provided

---

## Ready to Execute?

Review this plan and confirm before I begin execution. I'll proceed phase-by-phase with verification checkpoints.

**Estimated Total Time:** 4-5 hours  
**Risk After Completion:** 🟢 LOW (demo-ready)
