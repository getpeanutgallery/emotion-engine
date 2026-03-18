---
plan_id: plan-2026-03-13-phase2-validator-tool-rollout
bead_ids:
  - ee-izr
---
# emotion-engine: Phase 2 validator-tool rollout for chunk and emotion analysis lanes

**Date:** 2026-03-13  
**Status:** Complete  
**Agent:** Cookie 🍪

---

## Goal

Upgrade the meaningful Phase 2 AI lanes so they require tool-mediated JSON validation before final acceptance, using lane-specific validator tools and enforced JSON shapes for chunk/emotion analysis outputs.

---

## Overview

Under the updated contract, direct schema validation is no longer sufficient as the final acceptance mode for meaningful AI lanes. Phase 2 was the remaining main gap inside `emotion-engine`: the lane already had schema validation, but its final acceptance path still depended on a direct parse/schema pass plus extra chunk-level guards.

This rollout moved the main Phase 2 chunk/emotion-analysis lane onto the shared local validator-tool loop architecture already used by the stronger Phase 1 and Phase 3 lanes. The deterministic schema validator (`validateEmotionStateObject(...)`) still does the actual local checking, but it now sits behind a lane-specific validator-tool contract so final acceptance is mediated through the tool loop instead of plain direct-schema-only acceptance.

---

## Tasks

### Task 1: Audit Phase 2 AI outputs and design validator-tool contracts

**Bead ID:** `ee-izr`  
**SubAgent:** `main`

**Prompt:** You are executing bead `ee-izr` in `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine`. Claim it immediately with `bd update ee-izr --status in_progress --json`. Using the universal contract in `docs/AI-LANE-CONTRACT.md`, audit the meaningful Phase 2 AI outputs and design the lane-specific validator-tool contracts required for their JSON shapes. Record the audit/design in this active plan before broad implementation changes.

**Files Created/Deleted/Modified:**
- `docs/AI-LANE-CONTRACT.md`
- `.plans/2026-03-13-phase2-validator-tool-rollout.md`

**Status:** ✅ Complete

**Results:**
- Audited the meaningful Phase 2 output surface and confirmed the only main structured AI acceptance path in this family is the Phase 2 chunk/emotion-analysis lane in `server/scripts/process/video-chunks.cjs`.
- Confirmed the lane already had the right deterministic schema core via `validateEmotionStateObject(...)`, but it was still effectively a **Level 2** acceptance path because the model was not required to use a validator-tool contract before final acceptance.
- Designed a lane-specific validator-tool contract named `validate_emotion_analysis_json` with canonical envelope:
  - `{"tool":"validate_emotion_analysis_json","emotionAnalysis":{...}}`
- Defined the candidate artifact shape as:
  - `summary`
  - `emotions` keyed by configured lenses
  - `dominant_emotion`
  - `confidence`
- Decided to reuse the shared `local-validator-tool-loop.cjs` machinery instead of duplicating lane-local loop logic.

---

### Task 2: Implement mandatory validator-tool mediation for Phase 2 acceptance

**Bead ID:** `ee-izr`  
**SubAgent:** `main`

**Prompt:** For bead `ee-izr`, implement the Phase 2 validator-tool rollout so the meaningful chunk/emotion-analysis AI outputs explicitly instruct the model to use the provided validator tool before final acceptance. Reuse shared validation/tool-loop infrastructure where appropriate, but do not leave any direct-schema-only final acceptance path in the main Phase 2 AI lane. Update docs/comments/plan with exact changed files.

**Files Created/Deleted/Modified:**
- `server/lib/emotion-lenses-tool.cjs`
- `server/scripts/process/video-chunks.cjs`
- `node_modules/tools/emotion-lenses-tool.cjs`
- `docs/AI-LANE-CONTRACT.md`
- `.plans/2026-03-13-phase2-validator-tool-rollout.md`

**Status:** ✅ Complete

**Results:**
- Extended `server/lib/emotion-lenses-tool.cjs` to add:
  - `EMOTION_ANALYSIS_TOOL_NAME`
  - `buildBasePromptFromInput(...)`
  - `buildEmotionAnalysisValidatorToolContract(...)`
  - `executeEmotionAnalysisValidatorTool(...)`
  - `executeEmotionAnalysisToolLoop(...)`
- Updated the Phase 2 prompt contract so the lane now explicitly states JSON-only expectations and leaves final acceptance to the validator-tool loop.
- Reused `executeLocalValidatorToolLoop(...)` from `server/lib/local-validator-tool-loop.cjs` rather than creating a one-off loop.
- Reworked `server/scripts/process/video-chunks.cjs` so the main chunk/emotion-analysis path now:
  - resolves the provider via `getProviderForTarget(...)`
  - builds/stores a prompt per attempt
  - calls `executeEmotionAnalysisToolLoop(...)`
  - accepts the final chunk artifact only after validator-tool mediation succeeds
  - preserves retry/failover behavior through `executeWithTargets(...)`
  - captures prompt refs, completion payloads, parsed chunk results, and tool-loop state in raw AI attempt artifacts
- Removed reliance on the old Phase 2 direct-schema-only final acceptance pattern (`getSchemaFailureReason(...)` no longer gates the lane).
- Added a node-module shim re-export in `node_modules/tools/emotion-lenses-tool.cjs` so the test/import alias resolves to the canonical server implementation.

---

### Task 3: Verify tool-loop enforcement and close the bead

**Bead ID:** `ee-izr`  
**SubAgent:** `main`

**Prompt:** For bead `ee-izr`, run targeted tests that prove Phase 2 now requires validator-tool mediation rather than plain direct-schema-only acceptance. Update docs if the contract examples or lane mapping need refresh, record tests/results in the plan, and close `ee-izr` with `bd close ee-izr --reason "Phase 2 validator-tool rollout completed" --json`.

**Files Created/Deleted/Modified:**
- `test/scripts/emotion-lenses-tool.test.js`
- `test/scripts/video-chunks.test.js`
- `docs/AI-LANE-CONTRACT.md`
- `.plans/2026-03-13-phase2-validator-tool-rollout.md`

**Status:** ✅ Complete

**Results:**
- Rewrote `test/scripts/emotion-lenses-tool.test.js` to cover the current lane contract instead of the legacy helper surface.
- Updated `test/scripts/video-chunks.test.js` so Phase 2 tests now mock the validator-tool loop path directly and assert:
  - adapter/model/params still flow through
  - `ai.video.toolLoop.{maxTurns,maxValidatorCalls}` reaches the Phase 2 lane
  - raw capture records the tool-loop contract state
  - retries/failover continue to work with the mediated acceptance path
- Updated `docs/AI-LANE-CONTRACT.md` audit table so Phase 2 video chunk emotion analysis is now listed as **Level 3 / Compliant**.
- Verification run:
  - `node --test test/scripts/emotion-lenses-tool.test.js test/scripts/video-chunks.test.js`
  - Result: **38 tests passed, 0 failed**
- No golden run was started.

---

## Success Criteria

- The meaningful Phase 2 AI lane(s) require a validator-tool loop before final acceptance. ✅
- Their prompts/tool contracts explicitly tell the AI to validate JSON using the provided tool. ✅
- Tests prove no main Phase 2 AI lane remains direct-schema-only as the final acceptance path. ✅
- Documentation stays aligned. ✅

---

## Constraints

- Reused shared validation/tool-loop infrastructure where possible. ✅
- Delivered mandatory validator-tool mediation, not merely better post-response schema checking. ✅
- Did not start a golden run. ✅

---

## Final Results

**Status:** ✅ Complete

**What We Built:**
- A lane-specific Phase 2 validator-tool contract for chunk emotion analysis (`validate_emotion_analysis_json`)
- Mandatory validator-tool mediation for the main Phase 2 chunk/emotion-analysis acceptance path
- Raw capture/test/doc updates proving Phase 2 is now a Level 3 compliant lane under the repo contract

**Changed Files:**
- `server/lib/emotion-lenses-tool.cjs`
- `server/scripts/process/video-chunks.cjs`
- `node_modules/tools/emotion-lenses-tool.cjs`
- `test/scripts/emotion-lenses-tool.test.js`
- `test/scripts/video-chunks.test.js`
- `docs/AI-LANE-CONTRACT.md`
- `.plans/2026-03-13-phase2-validator-tool-rollout.md`

**Verification:**
- `node --test test/scripts/emotion-lenses-tool.test.js test/scripts/video-chunks.test.js`
- Passed: `38`
- Failed: `0`

**Commits:**
- Pending in this subagent session.

**Lessons Learned:**
- The deterministic schema validator was already correct; the real gap was the acceptance architecture.
- Reusing the shared local validator-tool loop kept the rollout small and made the lane contract much clearer.
- Phase-lane docs need the audit table kept fresh, or implementation state goes stale faster than the code.

---

*Completed on 2026-03-13*
