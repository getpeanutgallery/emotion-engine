# emotion-engine: coverage.complete truth-check fix after clean-live verification

**Date:** 2026-04-03  
**Status:** Complete  
**Agent:** Cookie 🍪

---

## Goal

Fix the remaining dialogue coverage honesty bug so whole-asset dialogue artifacts cannot report `coverage.complete: true` when the recovered/persisted coverage span only reaches part of the requested asset timeline.

---

## Overview

The clean-live rerun gave us the answer we needed. The old, larger bug is fixed: coverage span is no longer falsely inflated across the entire asset. In the fresh live artifact, `coverage.start`, `coverage.end`, and `coverage.duration` now match the actual recovered dialogue reach (`0 → 30.5s`) rather than the full `140.042449s` asset duration.

What remains is narrower and more precise. The pipeline still preserved a model-supplied `coverage.complete: true` even though the run was a whole-asset request and the persisted recovered reach clearly covered only the first ~30.5 seconds of the asset. So the next fix should not reopen the broader coverage-span work. It should add a truth check for `coverage.complete` during finalization/normalization so the final saved artifact cannot claim completeness unless the recovered or trusted coverage actually reaches the requested timeline.

This lane should stay intentionally small. We should preserve model-supplied coverage span fields when they are useful, but reconcile the `complete` bit against objective local facts for whole-asset output. After the fix, we should add or update focused tests, rerun the same clean-live Xiaomi/OpenRouter verification config, and confirm that the resulting artifact still reports the honest `0 → 30.5s` span while changing `coverage.complete` to `false` for partial reach.

---

## Tasks

### Task 1: Implement the `coverage.complete` truth check in whole-asset dialogue finalization

**Bead ID:** `ee-080x`  
**SubAgent:** `coder`  
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, implement the smallest truthful fix for the remaining whole-asset dialogue honesty bug. Preserve honest coverage span fields, but ensure the final saved artifact cannot keep coverage.complete=true when the recovered/persisted dialogue reach only covers part of the requested asset timeline. Keep the change narrow: do not reopen the broader coverage-span fix unless strictly necessary. Update focused tests/examples as needed, and update the active plan with exact file changes and rationale. Claim the assigned bead with bd update <ID> --status in_progress --json at start and close it with bd close <ID> --reason "Implemented coverage.complete truth-check fix" --json at completion.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `server/scripts/get-context/`
- `server/lib/`
- `test/`

**Files Created/Deleted/Modified:**
- `.plans/2026-04-03-coverage-complete-truth-check-fix.md`
- `server/scripts/get-context/get-dialogue.cjs`
- `test/scripts/get-dialogue.test.js`

**Status:** ✅ Complete

**Results:** Added a narrow truth-check inside `deriveDialogueCoverage()` so final whole-asset metadata now preserves the recovered/model-supplied `coverage.start`, `coverage.end`, and `coverage.duration`, but only leaves `coverage.complete` as `true` when the preserved span actually reaches the requested whole-asset timeline within the existing 1ms tolerance (`start <= 0.001` and `end >= durationSeconds - 0.001`). If the saved/recovered reach is partial, `coverage.complete` is forced to `false` instead of surviving from the model payload. Updated the focused dialogue test to prove that a model-supplied partial span with `complete: true` is normalized to `complete: false` without rewriting the span fields.

---

### Task 2: Validate the fix with focused tests and rerun the same clean-live Xiaomi verification lane

**Bead ID:** `ee-tu1c`  
**SubAgent:** `coder`  
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, validate the coverage.complete truth-check fix with focused tests, then rerun configs/cod-test-xiaomi-mimo-v2-omni-openrouter-high-thinking-rerun.yaml using the existing --clean-live-digital-twin path. Capture exact commands, logs, timings, and output paths. Only count the rerun as valid if it stays clean-live and emits a fresh phase1-gather-context/dialogue-data.json. Update the active plan with exact evidence either way. Claim the assigned bead with bd update <ID> --status in_progress --json at start and close it with bd close <ID> --reason "Validated coverage.complete fix and reran clean-live Xiaomi verification lane" --json at completion.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `test/`
- `.logs/`
- `output/`

**Files Created/Deleted/Modified:**
- `.plans/2026-04-03-coverage-complete-truth-check-fix.md`
- `.logs/2026-04-03-214505-get-dialogue-coverage-complete-focused-ee-tu1c.log`
- `.logs/2026-04-03-214505-get-dialogue-coverage-complete-focused-ee-tu1c.time`
- `.logs/2026-04-03-214517-cod-test-xiaomi-mimo-v2-omni-openrouter-high-thinking-rerun-ee-tu1c.log`
- `.logs/2026-04-03-214517-cod-test-xiaomi-mimo-v2-omni-openrouter-high-thinking-rerun-ee-tu1c.time`
- `output/_archives/cod-test-xiaomi-mimo-v2-omni-openrouter-high-thinking-rerun-pre-ee-tu1c-2026-04-03-214517/`
- fresh rerun artifacts under `output/cod-test-xiaomi-mimo-v2-omni-openrouter-high-thinking-rerun/`

**Status:** ✅ Complete

**Results:** Claimed bead `ee-tu1c`, validated the fix with a focused `get-dialogue` test invocation, then reran the Xiaomi/OpenRouter high-thinking verification lane through the existing clean-live path and captured exact commands, logs, timings, and output locations.

Exact commands used:
- Focused validation command wrapper:
  - `set -euo pipefail; TS=$(date +%Y-%m-%d-%H%M%S); mkdir -p .logs; LOG_FILE=".logs/${TS}-get-dialogue-coverage-complete-focused-ee-tu1c.log"; TIME_FILE=".logs/${TS}-get-dialogue-coverage-complete-focused-ee-tu1c.time"; CMD="node --test test/scripts/get-dialogue.test.js --test-name-pattern 'adds additive whole-asset analysis metadata without breaking the dialogue contract|preserves model-supplied coverage span but truth-checks complete on whole-asset output'"; echo "COMMAND: $CMD" | tee "$LOG_FILE"; /usr/bin/time -p -o "$TIME_FILE" bash -lc "$CMD" 2>&1 | tee -a "$LOG_FILE"; echo "LOG_FILE=$LOG_FILE" | tee -a "$LOG_FILE"; echo "TIME_FILE=$TIME_FILE" | tee -a "$LOG_FILE"`
- Clean-live rerun command wrapper:
  - `set -euo pipefail; TS=$(date +%Y-%m-%d-%H%M%S); OUTDIR='output/cod-test-xiaomi-mimo-v2-omni-openrouter-high-thinking-rerun'; ARCHIVE_DIR='output/_archives'; mkdir -p "$ARCHIVE_DIR" .logs; if [ -d "$OUTDIR" ]; then ARCHIVE_PATH="$ARCHIVE_DIR/cod-test-xiaomi-mimo-v2-omni-openrouter-high-thinking-rerun-pre-ee-tu1c-$TS"; rm -rf "$ARCHIVE_PATH"; mv "$OUTDIR" "$ARCHIVE_PATH"; echo "ARCHIVED_OUTPUT=$ARCHIVE_PATH"; fi; LOG_FILE=".logs/${TS}-cod-test-xiaomi-mimo-v2-omni-openrouter-high-thinking-rerun-ee-tu1c.log"; TIME_FILE=".logs/${TS}-cod-test-xiaomi-mimo-v2-omni-openrouter-high-thinking-rerun-ee-tu1c.time"; echo "LOG_FILE=$LOG_FILE"; echo "TIME_FILE=$TIME_FILE"; /usr/bin/time -p -o "$TIME_FILE" node server/run-pipeline.cjs --config configs/cod-test-xiaomi-mimo-v2-omni-openrouter-high-thinking-rerun.yaml --clean-live-digital-twin --verbose 2>&1 | tee "$LOG_FILE"`

Focused validation evidence:
- The exact invocation above exited `0`.
- `/usr/bin/time -p` recorded `real 0.24`, `user 0.15`, `sys 0.03` in `.logs/2026-04-03-214505-get-dialogue-coverage-complete-focused-ee-tu1c.time`.
- The log shows the targeted assertion passing: `✔ preserves model-supplied coverage span but truth-checks complete on whole-asset output`.
- Node’s test runner still executed the full `test/scripts/get-dialogue.test.js` file under this invocation, but all 34 tests passed (`ℹ pass 34`, `ℹ fail 0`), so the truth-check validation passed cleanly.

Clean-live rerun evidence:
- Exit code: `0`
- `/usr/bin/time -p`: `real 231.31`, `user 5.06`, `sys 0.44`
- Log: `.logs/2026-04-03-214517-cod-test-xiaomi-mimo-v2-omni-openrouter-high-thinking-rerun-ee-tu1c.log`
- Timing: `.logs/2026-04-03-214517-cod-test-xiaomi-mimo-v2-omni-openrouter-high-thinking-rerun-ee-tu1c.time`
- Archived prior output: `output/_archives/cod-test-xiaomi-mimo-v2-omni-openrouter-high-thinking-rerun-pre-ee-tu1c-2026-04-03-214517/`
- Fresh output root: `output/cod-test-xiaomi-mimo-v2-omni-openrouter-high-thinking-rerun/`
- Fresh output files include:
  - `phase1-gather-context/dialogue-data.json`
  - `phase1-gather-context/music-data.json`
  - `phase2-process/whole-video-analysis.json`
  - `_meta/events.jsonl`
  - `artifacts-complete.json`
- The log explicitly shows clean-live isolation at startup:
  - `🧼 Clean live digital-twin isolation enabled`
  - `Removed env keys: DIGITAL_TWIN_MODE, DIGITAL_TWIN_PACK, DIGITAL_TWIN_CASSETTE`
- `grep -n '\[digital-twin-router\]' .logs/2026-04-03-214517-cod-test-xiaomi-mimo-v2-omni-openrouter-high-thinking-rerun-ee-tu1c.log` returned no matches.
- `grep -n '"mode":"record"' output/cod-test-xiaomi-mimo-v2-omni-openrouter-high-thinking-rerun/_meta/events.jsonl` returned no matches.
- `grep -n 'cod-test-record-20260318-202023' .logs/2026-04-03-214517-cod-test-xiaomi-mimo-v2-omni-openrouter-high-thinking-rerun-ee-tu1c.log output/cod-test-xiaomi-mimo-v2-omni-openrouter-high-thinking-rerun/_meta/events.jsonl` returned no matches.
- `_meta/events.jsonl` stayed live from start to finish:
  - first event: `seq=1`, `mode=live`, `kind=run.start`, `ts=2026-04-04T01:45:17.844Z`
  - last event: `seq=102`, `mode=live`, `kind=run.end`, `outcome=success`, `durationMs=231228`, `ts=2026-04-04T01:49:09.072Z`
- Fresh dialogue artifact evidence:
  - file: `output/cod-test-xiaomi-mimo-v2-omni-openrouter-high-thinking-rerun/phase1-gather-context/dialogue-data.json`
  - `stat`: `birth=2026-04-03 21:46:23.853105893 -0400`, `modify=2026-04-03 21:46:23.853105893 -0400`
  - parsed summary: `analysisMode=whole_asset`, `totalDuration=140.042449`, `dialogue_segments=22`, `coverage={ start: 0, end: 80, duration: 80, complete: false }`, `min_start=0`, `max_end=80`
- Final-vs-raw truth-check proof:
  - `phase1-gather-context/script-results/get-dialogue.success.json` contains `coverage: { start: 0, end: 80, duration: 80, complete: false }`
  - `phase1-gather-context/raw/ai/dialogue-transcription/attempt-01/capture.json` contains `coverage: { start: 0, end: 80, duration: 80, complete: true }`
  - This proves the new finalization truth check preserved the honest partial span while flipping the persisted artifact to `complete: false`.

Conclusion for Task 2:
- Focused validation passed.
- The rerun stayed genuinely clean-live.
- A fresh `phase1-gather-context/dialogue-data.json` was emitted.
- The live artifact now preserves partial coverage span (`0 → 80s`) and correctly saves `coverage.complete: false`, so Task 3 is ready to run.

---

### Task 3: Confirm end-to-end honesty and document the final outcome

**Bead ID:** `ee-wfgu`  
**SubAgent:** `primary`  
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, inspect the fresh post-fix clean-live rerun artifact and confirm whether end-to-end dialogue coverage honesty is now fully verified. Check that coverage span still matches recovered reach and that coverage.complete is false when the reach is partial. If anything still fails, document the remaining seam precisely rather than broadening the diagnosis. Update the active plan with the final result story. Claim the assigned bead with bd update <ID> --status in_progress --json at start and close it with bd close <ID> --reason "Reviewed post-fix clean-live artifact and documented final honesty outcome" --json at completion.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `output/`

**Files Created/Deleted/Modified:**
- `.plans/2026-04-03-coverage-complete-truth-check-fix.md`

**Status:** ✅ Complete

**Results:** Reviewed the fresh post-fix clean-live rerun artifact at `output/cod-test-xiaomi-mimo-v2-omni-openrouter-high-thinking-rerun/phase1-gather-context/` and confirmed the end-to-end honesty fix now holds at the final saved artifact boundary. The persisted `dialogue-data.json` reports `coverage: { start: 0, end: 80, duration: 80, complete: false }`, and its recovered dialogue span matches the actual segment reach exactly (`min start = 0`, `max end = 80`, `22` segments). The script-result wrapper at `script-results/get-dialogue.success.json` carries the same normalized artifact payload under `payload.data`, so the saved whole-asset output is consistently honest through the final handoff layer.

For comparison, the raw model capture at `raw/ai/dialogue-transcription/attempt-01/capture.json` still shows `parsed.coverage.complete: true` with the same partial `0 → 80s` span. That is now the expected upstream seam rather than a remaining pipeline bug: finalization preserves the useful span, corrects the truth value, and emits `complete: false` because the recovered reach does not cover the full `totalDuration: 140.042449` whole-asset request. No broader mismatch remains in this lane.

---

## Final Results

**Status:** ✅ Complete

**What We Built:** A narrow whole-asset dialogue coverage honesty fix that preserves recovered span fields while preventing partial-reach artifacts from claiming full coverage. The focused test passed, the clean-live Xiaomi/OpenRouter rerun stayed genuinely live, and the final saved dialogue artifact now truthfully reports partial reach as `coverage.complete: false`.

**Commits:**
- Pending

**Lessons Learned:** The remaining bug really was only the `complete` bit. The recovered span was already honest after the earlier fix, so the correct follow-up was to reconcile completeness against objective recovered reach at finalization instead of broadening the coverage normalization logic.

---

*Completed on 2026-04-03*
