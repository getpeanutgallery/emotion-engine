# emotion-engine: repair lean dialogue validator budget and schema, then rerun cod-test

**Date:** 2026-04-07  
**Status:** In Progress  
**Agent:** Cookie 🍪

---

## Goal

Fix the lean dialogue runtime failure by repairing both the shared validator-budget behavior and the dialogue-side schema guidance, then rerun cod-test to verify the lane completes and judge dialogue output against the gold benchmark.

---

## Overview

The failure analysis showed two actionable issues. First, the shared lean runtime currently burns through validator passes on each auto-validated retry candidate and can abort before checking the final repaired output. Second, the dialogue prompt/schema guidance does not anchor the nested `inferred_traits.traits[*]` structure strongly enough, causing the model to spend retry turns discovering the shape instead of converging quickly.

Derrick agreed both should be fixed together. This lane should implement the shared runtime budget repair first-class, tighten the dialogue schema anchor enough to prevent needless retry churn, and then rerun the real cod-test validation. The objective is not just unit-test success; it is a completed live dialogue lane with clearer runtime behavior and a fresh benchmark comparison against the gold truth.

The implementation should remain shared/helper-oriented where possible. The rerun should produce concrete evidence about whether the repaired lean runtime now completes and whether dialogue quality improves, regresses, or remains roughly unchanged.

---

## Tasks

### Task 1: Implement the shared validator-budget repair and dialogue schema-anchor fix

**Bead ID:** `ee-nop4`  
**SubAgent:** `coder`  
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, implement the focused repair for the lean dialogue failure. Fix the shared lean validator-budget behavior so a final repaired candidate is not rejected purely because earlier retry attempts consumed the validator-call budget. Also tighten the dialogue-side schema anchor so nested inferred_traits guidance converges faster (for example by making the trait/value object shape explicit and/or encouraging traits: [] when uncertain). Keep the change shared/helper-oriented where practical, add/update focused tests, and update this plan truthfully with exact files changed, behavior changes, and tests run. Claim the assigned bead at start with bd update <ID> --status in_progress --json and close it on completion with bd close <ID> --reason "Lean dialogue repair implemented" --json.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `server/lib/`
- `server/scripts/get-context/`
- `test/`

**Files Created/Deleted/Modified:**
- `.plans/2026-04-07-repair-lean-dialogue-validator-budget-and-schema-then-rerun.md`
- `server/lib/local-validator-tool-loop.cjs`
- `server/scripts/get-context/get-dialogue.cjs`
- `test/lib/local-validator-tool-loop.test.js`
- `test/scripts/get-dialogue.test.js`

**Status:** ✅ Complete

**Results:** Implemented the shared lean validator-loop repair in `server/lib/local-validator-tool-loop.cjs` by adding a lean-only final-turn validator grace path so the last repaired candidate can still be validated even when earlier repair attempts already consumed the configured validator-call budget. The loop still records the actual validator-call count, but it no longer hard-fails before checking the final lean candidate purely because the nominal budget hit zero.

Tightened the dialogue prompt/schema anchor in `server/scripts/get-context/get-dialogue.cjs` by extracting shared inferred-traits rules used by both whole-asset and chunk prompts. The prompt now explicitly tells the model to use `inferred_traits: { "traits": [] }` when uncertain, requires each `traits[*]` entry to be an object with `trait` + `value` strings, provides a concrete example object shape, and forbids bare strings / grounded evidence leakage into `inferred_traits`.

Added focused coverage in `test/lib/local-validator-tool-loop.test.js` for the lean final-turn validator-budget case, and updated `test/scripts/get-dialogue.test.js` assertions to verify the stronger inferred-traits anchor and lean repair-prompt behavior.

Tests run:
- `node --test test/lib/local-validator-tool-loop.test.js test/scripts/get-dialogue.test.js`

---

### Task 2: Rerun cod-test and validate the repaired dialogue lane against the benchmark

**Bead ID:** `ee-esm8`  
**SubAgent:** `research`  
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, rerun the real cod-test validation after the lean dialogue repair lands. Confirm the dialogue lane now completes operationally, verify the repaired runtime behavior, and compare the new dialogue output against the gold benchmark truth and refreshed dialogue benchmark report. Update this plan truthfully with exact commands, artifact paths, runtime-behavior outcome, and benchmark/delta result. Claim the assigned bead at start with bd update <ID> --status in_progress --json and close it on completion with bd close <ID> --reason "Lean dialogue repair rerun validated" --json.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `.logs/`
- `output/`
- `benchmarks/fixtures/cod-test/_reports/`

**Files Created/Deleted/Modified:**
- `.plans/2026-04-07-repair-lean-dialogue-validator-budget-and-schema-then-rerun.md`
- `.logs/cod-test-20260407-1454-ee-esm8-lean-dialogue-rerun.log`
- `.logs/cod-test-20260407-1454-ee-esm8-lean-dialogue-rerun.time`
- `output/cod-test/phase1-gather-context/script-results/get-dialogue.failure.json`
- `output/cod-test/phase1-gather-context/raw/_meta/errors.summary.json`
- `output/cod-test/phase1-gather-context/raw/ai/dialogue-chunks/chunk-0000/attempt-01/capture.json`
- `output/cod-test/phase1-gather-context/raw/ai/dialogue-chunks/chunk-0005/attempt-01/capture.json`
- `output/cod-test/phase1-gather-context/raw/ai/dialogue-chunks/chunk-0006/attempt-01/capture.json`

**Status:** ❌ Failed

**Results:** Reran the real pipeline with recording enabled using:
- `set -a && . ./.env && set +a && export DIGITAL_TWIN_MODE=record && export DIGITAL_TWIN_CASSETTE="cod-test-record-20260407-1454-ee-esm8-lean-dialogue-rerun" && /usr/bin/time -p -o ".logs/cod-test-20260407-1454-ee-esm8-lean-dialogue-rerun.time" node server/run-pipeline.cjs --config configs/cod-test.yaml --verbose 2>&1 | tee ".logs/cod-test-20260407-1454-ee-esm8-lean-dialogue-rerun.log"`

Runtime outcome: the dialogue lane still did **not** complete operationally. `get-dialogue` failed in Phase 1 after ~198s with a fatal OpenRouter/Xiaomi HTTP 400 on chunk 6 (`84s-104s`): `Multimodal data is corrupted or cannot be processed.` Evidence is captured in `output/cod-test/phase1-gather-context/script-results/get-dialogue.failure.json`, `output/cod-test/phase1-gather-context/raw/_meta/errors.summary.json`, and `output/cod-test/phase1-gather-context/raw/ai/dialogue-chunks/chunk-0006/attempt-01/capture.json`.

What improved: the repair appears to have removed the original lean validator/schema blocker. Earlier chunks now validate cleanly instead of dying in the local validator loop. For example, `chunk-0000/attempt-01/capture.json` and `chunk-0005/attempt-01/capture.json` both show `toolLoop.validatorCalls: 1`, successful validation, and schema-conformant `inferred_traits` output (`{ "traits": [] }` where appropriate). So the repaired runtime behavior matches intent for validator-budget preservation and stronger schema anchoring.

What is now blocking: a new upstream provider failure, not the repaired lean logic. The live run gets through six completed chunk requests, then chunk 6 hard-fails before any tool-loop validation result is produced.

Benchmark / delta result: no fresh dialogue benchmark report was produced because the pipeline stopped in Phase 1 before emitting a new reconciled dialogue artifact. The existing report at `benchmarks/fixtures/cod-test/_reports/artifact-results/dialogueData.json` remained stale (mtime `2026-04-07 08:53:23 -0400`) and still reports `67/198` passed fields, `131/198` failed fields, accuracy `0.3383838383838384`, against gold truth `benchmarks/fixtures/cod-test/truth/dialogue-data.json`. Since the rerun did not generate a refreshed `output/cod-test/phase1-gather-context/dialogue-data.reconciled.json`, dialogue benchmark quality is **unchanged / not re-measured** by this rerun rather than better or worse.

---

## Final Results

**Status:** ⚠️ Partial

**What We Built:** Task 1 is complete: the shared lean validator budget handling now preserves a final validation attempt for the last repaired candidate, and dialogue prompts now anchor `inferred_traits` more explicitly. Task 2 completed the real rerun and verified that the original lean validator/schema failure is gone, but the live dialogue lane is still blocked by a new upstream OpenRouter/Xiaomi multimodal HTTP 400 on chunk 6 before a fresh dialogue artifact/report can be emitted.

**Commits:**
- Pending.

**Lessons Learned:** Fixing the local lean validator/runtime path surfaced the next real blocker. The lane now gets materially farther, validates early chunks cleanly, and fails on provider-side multimodal corruption instead of local schema/budget exhaustion. Until that upstream request failure is mitigated, dialogue benchmark deltas remain stale because the rerun cannot finish Phase 1.

---

*Drafted on 2026-04-07*