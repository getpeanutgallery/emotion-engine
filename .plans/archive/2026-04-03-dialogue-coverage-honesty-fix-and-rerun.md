# emotion-engine: dialogue coverage honesty fix and bounded Xiaomi rerun

**Date:** 2026-04-03  
**Status:** Complete  
**Agent:** Cookie 🍪

---

## Goal

Implement the smallest truthful fix so whole-asset dialogue artifacts stop falsely claiming complete coverage, then rerun the bounded Xiaomi/OpenRouter high-thinking lane to verify the artifact now reports partial coverage honestly.

---

## Overview

The recent investigation separated two different problems. First, Xiaomi/OpenRouter whole-asset dialogue grounding is still suspect: the model received real audio, but its self-report and timing behavior suggest weak or inconsistent grounding. Second, and independently, our local finalize path rewrites partial dialogue artifacts into falsely complete full-timeline metadata. This plan only addresses the second problem.

The fix should be intentionally narrow. We should leave `totalDuration`, `timingMode`, and the overall artifact shape alone for now, and only make `coverage` honest. When model-supplied coverage exists, preserve it. Otherwise derive coverage from the recovered dialogue segment bounds rather than auto-stamping the entire asset duration. For partial whole-asset recovery, `coverage.complete` should remain false. This preserves compatibility while removing the proven lie.

After the change, we should run focused tests, then rerun the existing bounded Xiaomi/OpenRouter high-thinking repro config to confirm that the dialogue artifact still completes but no longer pretends to cover the full file when it does not.

---

## Tasks

### Task 1: Implement the whole-asset dialogue coverage honesty fix in finalize/metadata code

**Bead ID:** `ee-3nrr`  
**SubAgent:** `coder`  
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, implement the smallest truthful whole-asset dialogue honesty fix: stop auto-stamping dialogue coverage as full-file complete from asset duration alone. Preserve model-supplied coverage when present; otherwise derive coverage.start/end/duration/complete from actual recovered dialogue_segments. Keep totalDuration, timingMode, field names, and overall artifact shape unchanged unless strictly required. Update stale examples/tests affected by this narrower semantics change and document exactly what changed in the active plan. Claim bead ee-3nrr on start with bd update ee-3nrr --status in_progress --json and close it on completion with bd close ee-3nrr --reason "Implemented whole-asset dialogue coverage honesty fix" --json.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `server/scripts/get-context/`
- `server/lib/`
- `test/`

**Files Created/Deleted/Modified:**
- `.plans/2026-04-03-dialogue-coverage-honesty-fix-and-rerun.md`
- `server/scripts/get-context/get-dialogue.cjs`
- `test/scripts/get-dialogue.test.js`

**Status:** ✅ Complete

**Results:** Implemented the bounded finalize-path fix in `server/scripts/get-context/get-dialogue.cjs`. The script no longer rewrites dialogue coverage to full-asset complete from duration alone. Finalization now preserves model-supplied `coverage` when present; otherwise it derives `coverage.start`, `coverage.end`, `coverage.duration`, and `coverage.complete` from the recovered `dialogue_segments` bounds against `totalDuration`. Updated `test/scripts/get-dialogue.test.js` so the default whole-asset metadata expectation now matches the recovered segment reach (`0.5 → 3.2`, `duration: 2.7`, `complete: false`) and added a regression proving model-supplied coverage survives finalize unchanged.

---

### Task 2: Validate the fix with focused tests and bounded config sanity checks

**Bead ID:** `ee-oe39`  
**SubAgent:** `primary`  
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, validate the dialogue coverage honesty fix with the smallest truthful test path. Run focused tests covering the changed metadata semantics, then run the narrow config validation/dry-run checks needed to confirm the bounded Xiaomi rerun lane is still ready. Update the active plan with exact commands/results and claim bead ee-oe39 on start with bd update ee-oe39 --status in_progress --json and close it on completion with bd close ee-oe39 --reason "Validated dialogue coverage honesty fix and rerun readiness" --json.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `test/`
- optional `.logs/`

**Files Created/Deleted/Modified:**
- `.plans/2026-04-03-dialogue-coverage-honesty-fix-and-rerun.md`
- optional validation logs/artifacts to be determined

**Status:** ✅ Complete

**Results:** Claimed bead `ee-oe39`, then validated the narrowed metadata semantics and Xiaomi rerun readiness with the smallest truthful path.

Commands run:
- `bd update ee-oe39 --status in_progress --json`
- `node --test test/scripts/get-dialogue.test.js --test-name-pattern "adds additive whole-asset analysis metadata without breaking the dialogue contract|preserves model-supplied coverage when present on whole-asset output"`
- `node -e "const fs=require('fs'); const yaml=require('js-yaml'); const file='configs/cod-test-xiaomi-mimo-v2-omni-openrouter-high-thinking-rerun.yaml'; yaml.load(fs.readFileSync(file,'utf8')); console.log('parsed OK:', file);"`
- `npm run pipeline -- --config configs/cod-test-xiaomi-mimo-v2-omni-openrouter-high-thinking-rerun.yaml --dry-run`

Observed results:
- The focused `get-dialogue` metadata semantics checks passed. The run confirmed whole-asset finalize now derives honest fallback coverage from recovered segment bounds (`start: 0.5`, `end: 3.2`, `duration: 2.7`, `complete: false`) and still preserves model-supplied `coverage` unchanged when present.
- `node --test` exited cleanly with `34` passing tests / `0` failures in `176.242717ms`. The name-pattern argument did not narrow execution inside the nested `node:test` structure, so the entire `test/scripts/get-dialogue.test.js` file ran; that is broader than planned but still a truthful, fast validation path.
- The bounded rerun config parsed successfully: `parsed OK: configs/cod-test-xiaomi-mimo-v2-omni-openrouter-high-thinking-rerun.yaml`.
- The orchestrator dry-run validated the exact Xiaomi/OpenRouter rerun lane successfully: `✅ Valid (3 script(s) across all phases)` followed by `🔍 Dry run mode - configuration is valid, not executing scripts`.

Conclusion: the dialogue coverage honesty fix is regression-tested and the bounded Xiaomi rerun lane remains ready for Task 3 execution.

---

### Task 3: Rerun the bounded Xiaomi/OpenRouter high-thinking config and verify coverage is now honest

**Bead ID:** `ee-scid`  
**SubAgent:** `coder`  
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, rerun configs/cod-test-xiaomi-mimo-v2-omni-openrouter-high-thinking-rerun.yaml after the dialogue coverage honesty fix. Capture exact commands, logs, timings, and artifact paths. Verify whether the rerun still completes and whether phase1-gather-context/dialogue-data.json now reports coverage that matches the recovered dialogue reach instead of falsely claiming full-file completeness. Update the active plan with what actually happened and claim bead ee-scid on start with bd update ee-scid --status in_progress --json and close it on completion with bd close ee-scid --reason "Reran bounded Xiaomi lane after dialogue coverage honesty fix" --json.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `output/`
- `.logs/`

**Files Created/Deleted/Modified:**
- `.plans/2026-04-03-dialogue-coverage-honesty-fix-and-rerun.md`
- `.logs/2026-04-03-151155-cod-test-xiaomi-mimo-v2-omni-openrouter-high-thinking-rerun-ee-scid.log`
- `.logs/2026-04-03-151155-cod-test-xiaomi-mimo-v2-omni-openrouter-high-thinking-rerun-ee-scid.time`
- `output/_archives/cod-test-xiaomi-mimo-v2-omni-openrouter-high-thinking-rerun-pre-ee-scid-2026-04-03-151155/**`
- `output/cod-test-xiaomi-mimo-v2-omni-openrouter-high-thinking-rerun/**`

**Status:** ❌ Failed

**Results:** Claimed bead `ee-scid` and reran the bounded Xiaomi/OpenRouter high-thinking lane after the dialogue coverage honesty fix, but this fresh live attempt did **not** complete.

Exact command wrapper used:
- `set -euo pipefail && TS=$(date +%Y-%m-%d-%H%M%S) && OUTDIR='output/cod-test-xiaomi-mimo-v2-omni-openrouter-high-thinking-rerun' && ARCHIVE_DIR='output/_archives' && mkdir -p "$ARCHIVE_DIR" .logs && if [ -d "$OUTDIR" ]; then ARCHIVE_PATH="$ARCHIVE_DIR/cod-test-xiaomi-mimo-v2-omni-openrouter-high-thinking-rerun-pre-ee-scid-$TS"; rm -rf "$ARCHIVE_PATH"; mv "$OUTDIR" "$ARCHIVE_PATH"; echo "ARCHIVED_OUTPUT=$ARCHIVE_PATH"; fi && LOG_FILE=".logs/${TS}-cod-test-xiaomi-mimo-v2-omni-openrouter-high-thinking-rerun-ee-scid.log" && TIME_FILE=".logs/${TS}-cod-test-xiaomi-mimo-v2-omni-openrouter-high-thinking-rerun-ee-scid.time" && echo "LOG_FILE=$LOG_FILE" && echo "TIME_FILE=$TIME_FILE" && /usr/bin/time -p -o "$TIME_FILE" bash -lc 'unset DIGITAL_TWIN_MODE DIGITAL_TWIN_PACK DIGITAL_TWIN_CASSETTE OPENROUTER_TIMEOUT_MS || true; set -a; [ -f .env ] && . ./.env; set +a; npm run pipeline -- --config configs/cod-test-xiaomi-mimo-v2-omni-openrouter-high-thinking-rerun.yaml' 2>&1 | tee "$LOG_FILE"`

Observed paths and timings:
- archived prior successful output: `output/_archives/cod-test-xiaomi-mimo-v2-omni-openrouter-high-thinking-rerun-pre-ee-scid-2026-04-03-151155`
- fresh console log: `.logs/2026-04-03-151155-cod-test-xiaomi-mimo-v2-omni-openrouter-high-thinking-rerun-ee-scid.log`
- fresh timing file: `.logs/2026-04-03-151155-cod-test-xiaomi-mimo-v2-omni-openrouter-high-thinking-rerun-ee-scid.time`
- wall time from `/usr/bin/time -p`: `real 127.97`, `user 6.44`, `sys 0.81`

What actually happened:
- The rerun failed in **Phase 1 / `get-dialogue`** before emitting a new finalized dialogue artifact.
- Terminal failure signature: `OpenRouter: No content in response`.
- The fresh raw capture at `output/cod-test-xiaomi-mimo-v2-omni-openrouter-high-thinking-rerun/phase1-gather-context/raw/ai/dialogue-transcription/attempt-01/capture.json` shows `rawResponse: null`, `parsed: null`, `toolLoop: null`, `errorStatus: 200`, `errorRequestId: "9e6a61e26a0f42f0-MIA"`, and an OpenRouter error body of `{ "error": { "message": "Internal Server Error", "code": 500 } }`.
- Fresh failure envelope: `output/cod-test-xiaomi-mimo-v2-omni-openrouter-high-thinking-rerun/phase1-gather-context/script-results/get-dialogue.failure.json`
- Fresh phase error summary: `output/cod-test-xiaomi-mimo-v2-omni-openrouter-high-thinking-rerun/phase1-gather-context/raw/_meta/errors.summary.json`
- Fresh recovery lineage: `output/cod-test-xiaomi-mimo-v2-omni-openrouter-high-thinking-rerun/phase1-gather-context/recovery/get-dialogue/lineage.json`
- Fresh event trail: `output/cod-test-xiaomi-mimo-v2-omni-openrouter-high-thinking-rerun/_meta/events.jsonl`

Coverage verification result:
- **Not verifiable on this rerun.** Because `get-dialogue` failed before finalization, the fresh output tree does **not** contain `phase1-gather-context/dialogue-data.json`, so there is no new coverage block to compare against recovered dialogue reach.
- The prior successful output was preserved in the archive path above for comparison/reference, but the fresh rerun itself did not reach the point where the honesty fix could be observed in a saved dialogue artifact.

Additional noteworthy behavior:
- Despite explicitly unsetting `DIGITAL_TWIN_MODE`, `DIGITAL_TWIN_PACK`, and `DIGITAL_TWIN_CASSETTE` in the execution wrapper, the fresh console log still printed `[digital-twin-router] record.realTransport.await.start cassette=cod-test-record-20260318-202023`, and the fresh `_meta/events.jsonl` recorded `mode: "record"` from `run.start` through `run.end`. That unexpected runtime mode leakage is separate from the coverage fix but is part of the exact evidence from this rerun.

---

### Task 4: Review the rerun artifact and confirm whether the metadata now tells the truth

**Bead ID:** `ee-jcps`  
**SubAgent:** `primary`  
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, review the rerun artifact after the dialogue coverage honesty fix and confirm whether the metadata now tells the truth about actual recovered reach. Summarize what improved, what remains unresolved about Xiaomi grounding, and the best next lane. Update the active plan with the final outcome story and claim bead ee-jcps on start with bd update ee-jcps --status in_progress --json and close it on completion with bd close ee-jcps --reason "Reviewed rerun after dialogue coverage honesty fix" --json.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `output/`
- `.logs/`

**Files Created/Deleted/Modified:**
- `.plans/2026-04-03-dialogue-coverage-honesty-fix-and-rerun.md`

**Status:** ⚠️ Blocked

**Results:** Review of a **fresh** finalized dialogue artifact is blocked because Task 3 failed before `phase1-gather-context/dialogue-data.json` was emitted. The only fresh truthful conclusion available from this rerun is that coverage could not be inspected at all because `get-dialogue` died on an OpenRouter no-content / internal-server-error response before finalization. The archived prior successful output remains available for historical comparison, but it does not answer whether the new honesty fix now persists corrected coverage metadata under live successful execution.

---

## Final Results

**Status:** ⚠️ Partial

**What We Built:** Landed and validated the narrow dialogue coverage honesty fix locally, then executed a fresh bounded Xiaomi/OpenRouter high-thinking rerun with exact log/timing capture. The rerun itself failed in Phase 1 (`get-dialogue`) with `OpenRouter: No content in response`, so the pipeline did **not** complete and no new `dialogue-data.json` was produced. As a result, the live question "does the saved artifact now report honest recovered-reach coverage?" remains unanswered by this rerun.

**Commits:**
- Pending

**Lessons Learned:** The coverage honesty fix and rerun readiness were not the blocking factor on this attempt; the live lane regressed earlier due to provider/runtime behavior. Also, the execution unexpectedly ran in `mode: "record"` despite explicit unsets in the wrapper, so runtime mode leakage is now part of the repro surface and should be investigated before trusting further Xiaomi reruns.

---

*Completed on 2026-04-03*
