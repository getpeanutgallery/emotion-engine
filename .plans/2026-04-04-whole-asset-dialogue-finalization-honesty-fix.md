# emotion-engine: whole-asset dialogue finalization honesty fix

**Date:** 2026-04-04  
**Status:** In Progress  
**Agent:** Cookie 🍪

---

## Goal

Make whole-asset dialogue artifacts preserve only earned coverage/finalization semantics, then verify the clean-live Xiaomi/OpenRouter rerun stays truthful.

---

## Overview

The previous April 3 lanes already solved clean-live digital-twin isolation and the dialogue coverage honesty regression on the clean rerun. The remaining repo-owned issue is narrower: in the whole-asset dialogue path, finalization still appears willing to auto-promote a partial or approximate transcript into overly optimistic artifact metadata such as full-duration `totalDuration`, forced `timingMode: "full_timeline"`, and `coverage.complete: true`.

This tranche focuses on the smallest truthful implementation lane identified by the prior audit. We will update the source-owned finalization seam so persisted whole-asset dialogue artifacts reflect model-returned or segment-supported reach instead of transport-duration optimism, then run focused tests and a clean-live rerun to confirm the saved artifact stays honest. We are not trying to solve Xiaomi grounding quality itself in this tranche; we are making the artifact truthful so downstream evaluation can trust what it says.

---

## Tasks

### Task 1: Implement truthful whole-asset dialogue finalization behavior

**Bead ID:** `ee-ygm1`  
**SubAgent:** `coder`  
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, implement the smallest truthful fix for the whole-asset dialogue finalization seam identified in the April 3 Xiaomi grounding audit. The target is server/scripts/get-context/get-dialogue.cjs and any directly related tests/helpers. Preserve only earned whole-asset metadata: do not auto-promote partial/approximate dialogue output into optimistic full-duration coverage semantics just because the asset duration is known. Update or add tests to lock the intended behavior. Claim bead ee-ygm1 on start with bd update ee-ygm1 --status in_progress --json and close it on completion with bd close ee-ygm1 --reason "Implemented truthful whole-asset dialogue finalization behavior" --json. Commit your changes to the current branch with a clear message after tests pass, but do not push.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `server/scripts/get-context/`
- `test/scripts/`
- optional related `server/lib/`

**Files Created/Deleted/Modified:**
- `.plans/2026-04-04-whole-asset-dialogue-finalization-honesty-fix.md`
- `server/scripts/get-context/get-dialogue.cjs`
- `test/scripts/get-dialogue.test.js`
- optional directly related files

**Status:** ✅ Complete

**Results:** Implemented the narrow source-owned honesty fix in `server/scripts/get-context/get-dialogue.cjs` without expanding the contract surface. Whole-asset normalization now preserves a shorter model-reported `totalDuration` when it is finite and within the real asset/runtime bounds, while still clamping impossible overruns down to the actual source duration and never allowing `totalDuration` to fall below the last surviving segment end. The whole-asset provider path now opts into that preservation behavior, so partial/approximate whole-asset transcripts no longer get silently inflated to the asset runtime during finalization. Added a focused regression test in `test/scripts/get-dialogue.test.js` that locks this behavior for a shorter approximate whole-asset result, and re-ran `node --test test/scripts/get-dialogue.test.js` successfully (35/35 passing).

---

### Task 2: Verify tests and clean-live rerun artifact honesty

**Bead ID:** `ee-x0g9`  
**SubAgent:** `primary`  
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, verify the whole-asset dialogue finalization honesty fix after Task 1 lands. Pull evidence from the updated code/tests and run the canonical clean-live rerun command for configs/cod-test-xiaomi-mimo-v2-omni-openrouter-high-thinking-rerun.yaml using --clean-live-digital-twin --verbose. Confirm whether the saved output artifact now preserves truthful coverage/timing semantics instead of optimistic whole-file promotion. Record exact evidence paths and note whether the remaining issue is upstream Xiaomi grounding quality versus local metadata inflation. Claim bead ee-x0g9 on start with bd update ee-x0g9 --status in_progress --json and close it on completion with bd close ee-x0g9 --reason "Verified truthful whole-asset dialogue artifact behavior on clean-live rerun" --json. Commit any verification-only plan updates if needed, but do not push.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `.logs/`
- `output/`

**Files Created/Deleted/Modified:**
- `.plans/2026-04-04-whole-asset-dialogue-finalization-honesty-fix.md`
- verification log/output artifacts under `.logs/` and `output/`

**Status:** ⏳ Pending

**Results:** Pending

---

### Task 3: Final review, plan update, and push to main

**Bead ID:** `ee-703j`  
**SubAgent:** `primary`  
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, review the landed whole-asset dialogue finalization honesty fix and verification evidence, then prepare the repo for handoff. Update the active plan with what actually happened, summarize the final truthful state, archive the plan if complete, and push the committed changes on main. Claim bead ee-703j on start with bd update ee-703j --status in_progress --json and close it on completion with bd close ee-703j --reason "Reviewed, documented, archived, and pushed whole-asset dialogue finalization honesty fix lane" --json. If verification shows the lane is blocked, document the blocker precisely instead of archiving as complete.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `.plans/archive/`
- optional `docs/handoffs/`

**Files Created/Deleted/Modified:**
- `.plans/2026-04-04-whole-asset-dialogue-finalization-honesty-fix.md`
- optional archival/handoff files

**Status:** ⏳ Pending

**Results:** Pending

---

## Final Results

**Status:** ⏳ In Progress

**What We Built:** Pending

**Commits:**
- Pending

**Lessons Learned:** Pending

---

*Completed on Pending*
