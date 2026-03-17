---
plan_id: plan-2026-03-13-generalize-ai-defaults-overrides-and-json-validation
bead_ids:
  - ee-of5
---
# emotion-engine: generalize AI defaults, override support, and JSON validation

**Date:** 2026-03-13  
**Status:** Complete  
**Agent:** Cookie 🍪

---

## Goal

Generalize the proven AI hardening posture across emotion-engine: default development-time AI calls to `max_tokens: 25000` and `thinking.level: low`, normalize overrideable provider params through shared helpers, and enforce schema-bound JSON validation on the next highest-value lanes beyond recommendation.

---

## Overview

This bead started as an infrastructure sweep and the code audit showed that a meaningful portion of the work had already landed before closure/bookkeeping stalled. The shared adapter normalization path is now centralized in `server/lib/ai-targets.cjs`, structured JSON validation lives in `server/lib/structured-output.cjs`, dialogue now uses retryable schema validation instead of permissive fallback parsing, and the new `server/lib/emotion-lenses-tool.cjs` gives the video chunk lane a shared structured-output tool.

The audit also showed that the landing was broader than the original spot-check list. In addition to the verified files called out in the handoff, related adoption already exists in `server/scripts/get-context/get-music.cjs`, `server/scripts/report/recommendation.cjs`, and `server/scripts/process/video-chunks.cjs`. That means the repo-local infrastructure sweep is materially complete enough to close this bead, with sibling-repo rollout explicitly left as follow-up instead of pretending it shipped here.

No new production/golden run was started in this closure pass. Verification was limited to targeted unit/integration tests proving the default/override path and structured JSON retry/validation behavior.

---

## Repo-local audit summary

### Shared helpers / infrastructure now present

**Files audited:**
- `server/lib/ai-targets.cjs`
- `server/lib/structured-output.cjs`
- `server/lib/emotion-lenses-tool.cjs`

**What landed and is retained:**
- `server/lib/ai-targets.cjs`
  - adds normalized development defaults:
    - `DEFAULT_DEVELOPMENT_MAX_TOKENS = 25000`
    - `DEFAULT_DEVELOPMENT_THINKING_LEVEL = 'low'`
  - adds normalized adapter param handling:
    - `normalizeThinkingLevel()`
    - `normalizeAdapterParamsForProvider()`
    - `buildProviderOptions()`
  - maps `thinking.level` into provider-facing options for OpenRouter reasoning while preserving explicit overrides
  - centralizes persisted error extraction helpers:
    - `getErrorRequestId()`
    - `getErrorResponseBody()`
    - `getErrorClassification()`
    - `getPersistedErrorInfo()`
- `server/lib/structured-output.cjs`
  - adds parse + validate helpers for JSON object extraction and validation
  - adds validators for:
    - dialogue transcription output
    - dialogue stitch output
    - music analysis output
    - emotion state output
- `server/lib/emotion-lenses-tool.cjs`
  - new shared tool for video chunk emotional analysis
  - uses `buildProviderOptions()` for normalized model options
  - uses `parseAndValidateJsonObject()` + `validateEmotionStateObject()` for structured output enforcement

### Repo-local AI lanes already adopting the helpers

**Files audited:**
- `server/scripts/get-context/get-dialogue.cjs`
- `server/scripts/get-context/get-music.cjs`
- `server/scripts/report/recommendation.cjs`
- `server/scripts/process/video-chunks.cjs`

**What landed and is retained:**
- `get-dialogue.cjs`
  - moved AI calls onto `buildProviderOptions()`
  - upgraded transcription + stitch parsing to retryable schema validation
  - persists richer AI failure metadata via `getPersistedErrorInfo()`
  - requires handoff context for chunked transcription flow
- `get-music.cjs`
  - already adopted `buildProviderOptions()`
  - already adopted structured JSON validation / retry behavior
  - already persists normalized AI error metadata
- `recommendation.cjs`
  - already adopted shared provider option building and normalized persisted-error capture
- `video-chunks.cjs`
  - already integrates the new `emotion-lenses-tool.cjs`
  - already uses normalized persisted-error capture around AI attempts

### Tests already present or updated in-repo

**Files audited:**
- `test/lib/ai-targets.test.js`
- `test/scripts/get-dialogue.test.js`
- `test/scripts/get-music.test.js`
- `test/scripts/emotion-lenses-tool.test.js`

**What they prove:**
- `test/lib/ai-targets.test.js`
  - development defaults inject `maxTokens: 25000`
  - `thinking.level` normalization works
  - explicit overrides win over defaults
  - OpenRouter reasoning mapping is correct
  - persisted error metadata helpers extract status / request id / response payload / classification
- `test/scripts/get-dialogue.test.js`
  - invalid dialogue JSON retries and then succeeds
  - dialogue lane still writes expected artifacts
  - chunked stitch flow still works with stricter structured validation
- `test/scripts/get-music.test.js`
  - invalid music JSON retries and then succeeds
  - structured-output path still produces expected artifacts
- `test/scripts/emotion-lenses-tool.test.js`
  - the new tool exists and its structured analysis path is exercised successfully

---

## Tasks

### Task 1: Audit all AI call sites and classify current support gaps

**Bead ID:** `ee-of5`  
**SubAgent:** `main`

**Files Created/Deleted/Modified:**
- `.plans/2026-03-13-generalize-ai-defaults-overrides-and-json-validation.md`

**Status:** ✅ Complete

**Results:**
- Audited the landed repo-local changes instead of assuming the prior pass was incomplete code-wise.
- Confirmed the original handoff list was accurate but incomplete: adoption also already exists in `get-music.cjs`, `recommendation.cjs`, and `video-chunks.cjs`.
- Determined this bead is closable as **repo-local infrastructure complete / sibling rollout not yet started**.

---

### Task 2: Centralize default AI posture for development-time calls

**Bead ID:** `ee-of5`  
**SubAgent:** `main`

**Files Created/Deleted/Modified:**
- `server/lib/ai-targets.cjs`
- `test/lib/ai-targets.test.js`

**Status:** ✅ Complete

**Results:**
- Shared provider-option normalization is in place.
- Development defaults are confirmed as:
  - `maxTokens: 25000`
  - low thinking / reasoning posture unless explicitly overridden
- Explicit adapter-provided values still override defaults as intended.

---

### Task 3: Ensure every emotion-engine AI lane supports normalized overrideable params

**Bead ID:** `ee-of5`  
**SubAgent:** `main`

**Files Created/Deleted/Modified:**
- `server/scripts/get-context/get-dialogue.cjs`
- `server/scripts/get-context/get-music.cjs`
- `server/scripts/report/recommendation.cjs`
- `server/lib/emotion-lenses-tool.cjs`

**Status:** ✅ Complete

**Results:**
- Confirmed the main repo-local AI lanes touched by this sweep now route through shared option building rather than scattered ad hoc merges.
- No additional fixups were required in this closure pass.

---

### Task 4: Push structured JSON validation/tooling beyond recommendation

**Bead ID:** `ee-of5`  
**SubAgent:** `main`

**Files Created/Deleted/Modified:**
- `server/lib/structured-output.cjs`
- `server/scripts/get-context/get-dialogue.cjs`
- `server/scripts/get-context/get-music.cjs`
- `server/lib/emotion-lenses-tool.cjs`
- `server/scripts/process/video-chunks.cjs`
- `test/scripts/get-dialogue.test.js`
- `test/scripts/get-music.test.js`
- `test/scripts/emotion-lenses-tool.test.js`

**Status:** ✅ Complete

**Results:**
- Dialogue is the clearest representative upgrade beyond recommendation:
  - transcription output is schema-validated
  - stitch output is schema-validated
  - invalid outputs become retryable failures instead of silently degrading to fallback objects
- Music already adopted the same structured-output pattern and passes targeted retry validation tests.
- The new emotion-lenses tool provides the same shared pattern for video chunk emotional analysis.

---

### Task 5: Verify and summarize repo vs sibling follow-up boundaries

**Bead ID:** `ee-of5`  
**SubAgent:** `main`

**Files Created/Deleted/Modified:**
- `.plans/2026-03-13-generalize-ai-defaults-overrides-and-json-validation.md`

**Status:** ✅ Complete

**Results:**
- Ran targeted verification only; no golden run started.
- Clear boundary established:
  - **Done in this repo:** shared defaults, normalized override path, structured JSON validation infrastructure, repo-local adoption in dialogue/music/recommendation/video-chunks.
  - **Not done in this bead:** sibling polyrepo adoption outside emotion-engine.

---

## Verification

### Targeted tests run

From `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine`:

1. `node --test test/lib/ai-targets.test.js test/scripts/get-dialogue.test.js test/scripts/emotion-lenses-tool.test.js`
   - **Result:** PASS
   - **Highlights:** 47 tests passed; validates dev defaults, override behavior, persisted error extraction, dialogue structured-output retry behavior, and the new emotion-lenses tool path.

2. `node --test test/scripts/get-music.test.js`
   - **Result:** PASS
   - **Highlights:** 17 tests passed; validates music structured-output retry behavior and artifact writing.

### Verification conclusions

- The default/override path is proven by direct unit coverage in `test/lib/ai-targets.test.js`.
- Structured JSON validation and retry behavior is proven in the upgraded dialogue and music tests.
- The new `emotion-lenses-tool.cjs` exists and is exercised successfully in targeted tests.
- No additional code changes were required during this closure pass beyond plan bookkeeping.

---

## Repo-local vs sibling follow-up boundary

### Completed in emotion-engine
- Shared development defaults for AI options are centralized.
- Shared provider-option normalization / override path is centralized.
- Shared structured-output validation utilities are present.
- Dialogue, music, recommendation, and video chunk/emotion-lens paths have repo-local adoption of the new infrastructure.
- Targeted tests prove the new behavior without requiring a golden run.

### Explicit follow-up outside this bead
- Roll the same defaults / override helpers into sibling repos that still hand-build provider options.
- Roll the same structured-output validators or equivalent shared infrastructure into sibling repos that still accept freeform JSON.
- Any cross-repo shared package extraction should happen in a new sibling-focused bead rather than extending this repo-local closure.

Recommended sibling follow-up framing:
- one bead for **polyrepo AI option normalization adoption**
- one bead for **polyrepo structured-output schema rollout**

---

## Final Results

**Status:** ✅ Complete

**What We Built:**
- Confirmed and documented the repo-local landing of generalized AI defaults, normalized override handling, and structured JSON validation infrastructure in emotion-engine.
- Verified the key behavior with targeted tests.
- Closed the bookkeeping gap so the bead can be cleanly completed without expanding scope into sibling repos.

**Commits:**
- Not created in this closure pass.

**Lessons Learned:**
- The main missing work here was closure hygiene, not missing infrastructure.
- For infrastructure sweeps, the plan must distinguish clearly between **repo-local adoption already landed** and **sibling-repo rollout still pending**.
- Tight targeted tests were enough to close confidence on this bead; a golden run would have been scope creep.

---

*Completed on 2026-03-13*