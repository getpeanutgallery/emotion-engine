# emotion-engine: Phase 1 validator-tool rollout for dialogue, music, and stitch lanes

**Date:** 2026-03-13  
**Status:** Complete  
**Agent:** Cookie 🍪

---

## Goal

Upgrade all meaningful Phase 1 AI lanes so they require tool-mediated JSON validation before final acceptance, using lane-specific validator tools and enforced JSON shapes for dialogue transcription, dialogue stitch, and music analysis.

---

## Overview

The contract tightened during this rollout: direct schema validation after the model answers is still useful as a deterministic local helper, but it is no longer sufficient as the final acceptance architecture for a meaningful AI lane. Phase 1 therefore needed to move from “parse + validate + retry” into “prompt with a local validator tool contract + accept only after the validator-tool path succeeds.”

I implemented the Phase 1 rollout by introducing shared local validator-tool infrastructure and lane-specific validator tool contracts, then threading that through the three active Phase 1 AI lanes: whole-file dialogue transcription, chunk dialogue transcription, dialogue stitch, and music analysis. The shared schema validators in `server/lib/structured-output.cjs` remain the deterministic truth source underneath, but final acceptance now flows through explicit validator-tool mediation.

---

## Tasks

### Task 1: Design validator-tool contracts for Phase 1 lane shapes

**Bead ID:** `ee-ixy`  
**SubAgent:** `main`

**Files Created/Deleted/Modified:**
- `server/lib/phase1-validator-tools.cjs`
- `server/lib/local-validator-tool-loop.cjs`
- `docs/AI-LANE-CONTRACT.md`
- `.plans/2026-03-13-phase1-validator-tool-rollout.md`

**Status:** ✅ Complete

**Results:**
- Added lane-specific validator tool contracts for:
  - `validate_dialogue_transcription_json`
  - `validate_dialogue_stitch_json`
  - `validate_music_analysis_json`
- Kept shared schema validation centralized in `server/lib/structured-output.cjs` and wrapped it behind lane-specific tool executors.
- Added reusable local validator-tool loop infrastructure so Phase 1 lanes can share the same envelope parsing, validator result handling, retry/error surfacing, and history capture.

---

### Task 2: Implement mandatory validator-tool loops for Phase 1 AI calls

**Bead ID:** `ee-ixy`  
**SubAgent:** `main`

**Files Created/Deleted/Modified:**
- `server/scripts/get-context/get-dialogue.cjs`
- `server/scripts/get-context/get-music.cjs`
- `server/lib/local-validator-tool-loop.cjs`
- `server/lib/phase1-validator-tools.cjs`
- `docs/AI-LANE-CONTRACT.md`
- `.plans/2026-03-13-phase1-validator-tool-rollout.md`

**Status:** ✅ Complete

**Results:**
- `get-dialogue.cjs`
  - whole-file transcription now runs through the local validator-tool loop
  - chunk transcription now runs through the same loop with `handoffContext` required
  - dialogue stitch now runs through a validator-tool loop before acceptance
  - raw attempt captures now include `toolLoop` metadata for audit/debug
- `get-music.cjs`
  - music analysis now runs through the local validator-tool loop before acceptance
  - removed the prompt’s legacy-format escape hatch and now requires the strict `analysis` envelope in the model-facing contract
  - raw attempt captures now include `toolLoop` metadata for audit/debug
- `docs/AI-LANE-CONTRACT.md`
  - updated the contract language so direct schema validation is documented as an internal helper, not the final acceptance mode
  - marked dialogue transcription, dialogue stitch, and music analysis as Level 3 compliant examples

---

### Task 3: Verify that Phase 1 no longer has direct-schema-only acceptance paths

**Bead ID:** `ee-ixy`  
**SubAgent:** `main`

**Files Created/Deleted/Modified:**
- `test/lib/phase1-validator-tools.test.js`
- `test/scripts/get-dialogue.test.js`
- `test/scripts/get-music.test.js`
- `docs/AI-LANE-CONTRACT.md`
- `.plans/2026-03-13-phase1-validator-tool-rollout.md`

**Status:** ✅ Complete

**Results:**
- Added focused validator-tool unit coverage in `test/lib/phase1-validator-tools.test.js`.
- Updated dialogue/music script tests to verify:
  - effective prompts include `LOCAL TOOL LOOP:`
  - effective prompts mention the lane-specific validator tool names
  - raw captured attempt payloads include `toolLoop` metadata with the expected tool name
  - chunked dialogue stitch prompts include `validate_dialogue_stitch_json`
- Verification command run successfully:
  - `node --test test/lib/phase1-validator-tools.test.js test/scripts/get-dialogue.test.js test/scripts/get-music.test.js`

---

## Success Criteria Check

- ✅ Dialogue transcription, dialogue stitch, and music analysis all require a validator-tool loop before final acceptance.
- ✅ Prompts/tool contracts explicitly tell the AI about the provided validator tool.
- ✅ Tests prove the Phase 1 lanes now go through validator-tool mediation and record that path in raw capture.
- ✅ Documentation is aligned to the new contract state.
- ✅ No golden run was started.

---

## Exact Changed Files

- `.plans/2026-03-13-phase1-validator-tool-rollout.md`
- `docs/AI-LANE-CONTRACT.md`
- `server/lib/local-validator-tool-loop.cjs`
- `server/lib/phase1-validator-tools.cjs`
- `server/scripts/get-context/get-dialogue.cjs`
- `server/scripts/get-context/get-music.cjs`
- `test/lib/phase1-validator-tools.test.js`
- `test/scripts/get-dialogue.test.js`
- `test/scripts/get-music.test.js`

---

## Final Results

**Status:** ✅ Complete

**What We Built:**
- A shared Phase 1 local validator-tool loop.
- Lane-specific validator tool contracts/executors for dialogue transcription, dialogue stitch, and music analysis.
- Phase 1 dialogue/music/stitch pipelines that now require validator-tool mediation before final acceptance.
- Updated docs/tests proving the rollout and the new compliance level.

**Verification:**
- `node --test test/lib/phase1-validator-tools.test.js test/scripts/get-dialogue.test.js test/scripts/get-music.test.js`

**Commits:**
- Not created by this subagent.

**Lessons Learned:**
- The cleanest rollout path was to preserve the existing deterministic schema validators and wrap them with lane-specific tool contracts plus one shared loop helper.
- Music needed the prompt contract tightened as well; keeping the legacy flat format in the prompt would have undermined the new validator-tool contract.

---

*Completed on 2026-03-13*
