# emotion-engine: run artifact hygiene before full cod-test

**Date:** 2026-03-15  
**Status:** In Progress  
**Agent:** Cookie 🍪

---

## Goal

Clean up stale run/debug artifacts so the next full `cod-test` produces a trustworthy output tree for human inspection, bug finding, and acceptance review.

---

## Overview

The live Phase3-only run succeeded, but the artifact inspection showed a real hygiene problem: stale prior-run failures and raw captures are still present beside fresh successful artifacts. That makes the forensic surface misleading for Derrick, because a successful run can still appear “dirty” when old `errors.jsonl`, stale recommendation attempts, or reused raw folders remain mixed into the current output.

Before we pay for the full `cod-test`, we should make the output state trustworthy. This is a bounded cleanup/debug lane, not a broad architecture reopening. The work should determine whether the right fix is: cleaning output roots before runs, making run-root isolation stricter, resetting raw/error summaries per run, or some combination of those. Then it should verify the hygiene behavior with a focused rerun so the next full `cod-test` lands in a clean output tree.

The owning repo remains `emotion-engine`, because the output lifecycle, raw artifact layout, and existing hygiene-related open bead (`ee-0gv`) all live here.

---

## Tasks

### Task 1: Audit current run artifact hygiene and define the bounded fix

**Bead ID:** `ee-0kg`  
**SubAgent:** `primary`  
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, inspect the current output/raw artifact lifecycle and the stale-artifact evidence from the successful Phase3 run. Determine exactly why prior-run errors/captures remain mixed into fresh outputs, identify the smallest truthful fix, and update this plan with exact files/paths involved. Link the findings to existing open beads like ee-0gv if relevant. Do not implement yet; close the bead after the diagnosis is documented.`

**Folders Created/Deleted/Modified:**
- `output/`
- `server/`
- `.plans/`

**Files Created/Deleted/Modified:**
- `.plans/2026-03-15-run-artifact-hygiene-before-full-cod-test.md`

**Status:** ✅ Complete

**Results:** Diagnosed the stale-artifact mix without implementing yet. The root cause is not artifact merging in memory; it is on-disk path reuse. Both `configs/cod-test.yaml` and `configs/cod-test-phase3.yaml` target the same static run root, `output/cod-test`. On startup, `server/run-pipeline.cjs` only calls `createAssetsDirectory(outputDir)` and `createRawDirectories(outputDir)`, which create directories if missing but never clear phase-local execution surfaces. During the successful 2026-03-15 Phase 3-only rerun, fresh files were written to `output/cod-test/phase3-report/script-results/*.success.json`, `output/cod-test/phase3-report/recommendation/recommendation.json`, and `output/cod-test/phase3-report/raw/ai/recommendation/attempt-01/capture.json`, but stale prior-run Phase 3 debug files were left in place beside them.

Exact stale evidence in the same fresh Phase 3 output tree:
- `output/cod-test/phase3-report/raw/ai/recommendation/attempt-01/capture.json` → fresh timestamp `2026-03-15 14:55:33`
- `output/cod-test/phase3-report/raw/ai/recommendation/attempt-02/capture.json` → stale timestamp `2026-03-13 10:39:00`
- `output/cod-test/phase3-report/raw/ai/recommendation/attempt-03/capture.json` → stale timestamp `2026-03-13 10:39:11`
- `output/cod-test/phase3-report/raw/ai/recommendation/attempt-04/capture.json` → stale timestamp `2026-03-10 09:57:59`
- `output/cod-test/phase3-report/raw/_meta/errors.jsonl` still contains old `recommendation_failed` lines from `2026-03-10` through `2026-03-13`
- `output/cod-test/phase3-report/raw/_meta/errors.summary.json` was freshly rewritten on `2026-03-15` with `outcome: "success"` but reports `totalErrors: 7` because the script counts the old appended file instead of same-run errors only

Why it happens in code:
- `server/scripts/report/recommendation.cjs` writes attempt captures under stable paths inside `output/<run>/phase3-report/raw/ai/recommendation/attempt-XX/`, and its pointer file `recommendation.json` only updates `latestAttempt`; it does not clear older attempt folders.
- `server/scripts/report/recommendation.cjs` function `ensurePhaseErrorArtifacts(...)` appends to `output/<run>/phase3-report/raw/_meta/errors.jsonl` with `fs.appendFileSync(...)` and then derives `totalErrors` by reading the whole accumulated file. So a clean rerun can still look dirty forever.
- The same append-without-reset pattern exists in `server/scripts/get-context/get-dialogue.cjs` and `server/scripts/get-context/get-music.cjs`. `server/scripts/process/video-chunks.cjs` is healthier here because it rewrites `errors.jsonl`, not appends.
- Phase runners (`server/lib/phases/gather-context-runner.cjs`, `server/lib/phases/process-runner.cjs`, `server/lib/phases/report-runner.cjs`) currently do no pre-phase cleanup, so reusing `output/cod-test` preserves stale raw captures across reruns.

Smallest truthful fix recommendation for Task 2:
1. Add a bounded pre-phase cleanup helper in `server/lib/output-manager.cjs` (or similarly central runtime code) that removes only the execution surfaces for the phase being rerun: `output/<run>/<phase>/raw/`, `output/<run>/<phase>/script-results/`, and `output/<run>/<phase>/recovery/`.
2. Call that helper from the phase runners before executing a phase that is actually running. This keeps Phase 3-only reruns clean while preserving hydrated upstream Phase 1/2 artifacts such as `phase1-gather-context/*.json`, `phase2-process/chunk-analysis.json`, assets, and the shared run root.
3. As a defensive follow-up inside the affected scripts, switch phase meta error writes to rewrite-or-reset semantics rather than append semantics on each script invocation (`get-dialogue`, `get-music`, `recommendation`).

This is the smallest bounded fix because it directly removes the stale directories/files that make the current run misleading, without changing artifact contracts, hydration behavior, or the separate run-root `raw/` namespace tracked in bead `ee-0gv`. `ee-0gv` is related only insofar as `output/<run>/raw/_meta/events.jsonl` and `raw/ai/_prompts/` also accumulate across reused run roots, but that is a layout/lifecycle follow-up, not the cause of the mixed Phase 3 error/capture evidence above.

---

### Task 2: Implement bounded artifact hygiene cleanup/fix

**Bead ID:** `ee-4yk`  
**SubAgent:** `coder`  
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, implement the smallest truthful fix for stale run artifact mixing discovered in Task 1. Keep the change bounded to output/run hygiene. Update tests or add focused coverage if needed, update this plan with exact files changed and validation evidence, commit to main, and close the bead.`

**Folders Created/Deleted/Modified:**
- `server/`
- `test/`
- `.plans/`
- possibly cleaned test/output fixtures if needed

**Files Created/Deleted/Modified:**
- `server/lib/output-manager.cjs`
- `server/lib/phases/gather-context-runner.cjs`
- `server/lib/phases/process-runner.cjs`
- `server/lib/phases/report-runner.cjs`
- `server/scripts/get-context/get-dialogue.cjs`
- `server/scripts/get-context/get-music.cjs`
- `server/scripts/report/recommendation.cjs`
- `test/output-manager.test.js`
- `test/pipeline/orchestrator.test.js`
- `test/pipeline/fixtures/test-phase3-only.yaml`
- `test/scripts/recommendation.test.js`
- `.plans/2026-03-15-run-artifact-hygiene-before-full-cod-test.md`

**Status:** ✅ Complete

**Results:** Implemented the smallest bounded fix for stale rerun artifact mixing.

Implementation details:
- Added `clearPhaseExecutionSurfaces(outputDir, phaseKey)` in `server/lib/output-manager.cjs` to remove only the currently running phase's execution surfaces: `<phase>/raw`, `<phase>/script-results`, and `<phase>/recovery`, then recreate an empty `<phase>/raw` directory for the next execution.
- Wired that helper into all three phase runners so cleanup happens only when that phase is actually about to run:
  - `server/lib/phases/gather-context-runner.cjs`
  - `server/lib/phases/process-runner.cjs`
  - `server/lib/phases/report-runner.cjs`
- Switched the append-style per-phase error meta writers to rewrite current-invocation state instead of inheriting stale lines from older reruns:
  - `server/scripts/get-context/get-dialogue.cjs`
  - `server/scripts/get-context/get-music.cjs`
  - `server/scripts/report/recommendation.cjs`
- Added focused regression coverage proving the bounded behavior:
  - `test/output-manager.test.js`
  - `test/pipeline/orchestrator.test.js`
  - `test/pipeline/fixtures/test-phase3-only.yaml`
  - `test/scripts/recommendation.test.js`

Validation evidence:
- `node test/output-manager.test.js` ✅ — 19/19 passed
- `node --test test/scripts/recommendation.test.js` ✅ — 15/15 passed
- `node --test test/pipeline/orchestrator.test.js` ✅ — 13/13 passed

Scope outcome:
- Only the current phase's execution surfaces are reset before that phase runs.
- Prior-phase artifacts remain available for Phase3-only hydration / reuse.
- Stale per-phase `errors.jsonl` / `errors.summary.json` no longer leak old failures into clean reruns.

---

### Task 3: Verify clean output behavior with a focused rerun

**Bead ID:** `ee-clj`  
**SubAgent:** `primary`  
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, verify the artifact hygiene fix with the smallest meaningful rerun/check, likely Phase3-only or a narrower reproduction if sufficient. Confirm that stale errors/captures are no longer mixed into the fresh run output, update this plan with exact evidence and artifact paths, and close the bead.`

**Folders Created/Deleted/Modified:**
- `output/`
- `.plans/`

**Files Created/Deleted/Modified:**
- `.plans/2026-03-15-run-artifact-hygiene-before-full-cod-test.md`
- verification artifacts from the focused rerun/check

**Status:** ⏳ Pending

**Results:** Pending.

---

### Task 4: Decide readiness for full cod-test after hygiene verification

**Bead ID:** `ee-odo`  
**SubAgent:** `primary`  
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, synthesize the hygiene diagnosis, fix, and rerun evidence. Decide whether the repo is now truthfully ready for the full cod-test, update this plan with exact reasoning and the next command to run, and close the bead.`

**Folders Created/Deleted/Modified:**
- `.plans/`

**Files Created/Deleted/Modified:**
- `.plans/2026-03-15-run-artifact-hygiene-before-full-cod-test.md`

**Status:** ⏳ Pending

**Results:** Pending.

---

## Intended execution order

1. Task 1 — diagnose the stale-artifact mixing precisely
2. Task 2 — implement the bounded hygiene fix
3. Task 3 — verify with a focused rerun/check
4. Task 4 — restate readiness for full `cod-test`

Task 2 depends on Task 1. Task 3 depends on Task 2. Task 4 depends on Tasks 1-3.

---

## Constraints

- Keep scope bounded to artifact/run hygiene.
- Do not fold unrelated recommendation, grounding, or provider investigations into this lane.
- Preserve forensic usefulness; fix mixing without destroying legitimate same-run evidence.
- The output of this plan should make the next full `cod-test` easier to inspect manually.

---

## Final Results

**Status:** ⏳ Pending

**What We Built:** Pending.

**Commits:**
- Pending.

**Lessons Learned:** Pending.

---

*Drafted on 2026-03-15*