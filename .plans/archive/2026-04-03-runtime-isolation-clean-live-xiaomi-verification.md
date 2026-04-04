# emotion-engine: runtime isolation for clean-live Xiaomi verification rerun

**Date:** 2026-04-03  
**Status:** Complete  
**Agent:** Cookie 🍪

---

## Goal

Prevent the bounded Xiaomi/OpenRouter verification lane from inheriting `DIGITAL_TWIN_*` record-mode state from repo `.env` / dotenv, then rerun the same config under truly clean-live conditions and verify whether the dialogue coverage honesty fix persists truthful partial coverage metadata.

---

## Overview

The previous handoff already narrowed the correct next step: do not start with prompt/model tuning. The main thing we need now is a trustworthy execution surface. The last rerun was invalid as a clean verification attempt because the runtime still entered digital-twin record mode, and the provider also failed upstream before `dialogue-data.json` was produced. That means the honesty fix is implemented and locally validated, but not yet proven on a clean successful live run.

This plan keeps the lane deliberately narrow. First we will isolate the live runtime so the Node process cannot pick up `DIGITAL_TWIN_MODE`, `DIGITAL_TWIN_PACK`, or `DIGITAL_TWIN_CASSETTE` from repo `.env` or startup dotenv behavior for this specific rerun path. Then we will rerun the exact same config, preserving the rest of the request shape so we answer the intended question instead of introducing more moving parts. Finally, we will inspect the fresh artifacts and determine whether the coverage metadata now matches recovered dialogue reach with `coverage.complete: false` when the reach is partial.

If the provider fails again before `phase1-gather-context/dialogue-data.json` exists, we will record that honestly as another provider instability event and mark the live verification as **not yet verified**, not as a failure of the honesty fix itself.

---

## Tasks

### Task 1: Implement a clean-live runtime isolation path for the bounded Xiaomi rerun

**Bead ID:** `ee-zeeu`  
**SubAgent:** `coder`  
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, implement the smallest truthful runtime-isolation fix for the bounded Xiaomi/OpenRouter verification lane. The goal is to ensure this rerun path cannot inherit DIGITAL_TWIN_MODE, DIGITAL_TWIN_PACK, or DIGITAL_TWIN_CASSETTE from repo .env or startup dotenv loading. Keep the change as narrow as possible for this verification lane. Preserve normal behavior elsewhere unless truly necessary. Include exact bead lifecycle commands in your work: claim the assigned bead with bd update <ID> --status in_progress --json at start and close it with bd close <ID> --reason "Implemented clean-live runtime isolation for Xiaomi verification lane" --json at completion. Update the active plan with exact file changes and rationale.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `server/`

**Files Created/Deleted/Modified:**
- `.plans/2026-04-03-runtime-isolation-clean-live-xiaomi-verification.md`
- `server/lib/cli-parser.cjs`
- `server/run-pipeline.cjs`

**Status:** ✅ Complete

**Results:** Added a narrow opt-in CLI flag, `--clean-live-digital-twin`, instead of changing default dotenv behavior. `server/lib/cli-parser.cjs` now accepts and documents the flag. `server/run-pipeline.cjs` now supports `cleanLiveDigitalTwin: true`, and when enabled it deletes only `DIGITAL_TWIN_MODE`, `DIGITAL_TWIN_PACK`, and `DIGITAL_TWIN_CASSETTE` from `process.env` after normal dotenv loading but before config execution. This keeps repo `.env` secrets like `AI_API_KEY` / `XIAOMI_API_KEY` available while preventing this verification lane from re-entering digital-twin record/replay mode through inherited repo env state. Validation used a dry-run with the Xiaomi rerun config after sourcing the current `.env`; before/after output confirmed the three `DIGITAL_TWIN_*` vars were removed while `AI_API_KEY` and `XIAOMI_API_KEY` stayed present. Exact clean-live rerun entrypoint for Task 2 is now: `node server/run-pipeline.cjs --config configs/cod-test-xiaomi-mimo-v2-omni-openrouter-high-thinking-rerun.yaml --clean-live-digital-twin --verbose`.

---

### Task 2: Execute the same Xiaomi/OpenRouter rerun under verified clean-live conditions

**Bead ID:** `ee-gba4`  
**SubAgent:** `coder`  
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, run configs/cod-test-xiaomi-mimo-v2-omni-openrouter-high-thinking-rerun.yaml using the new clean-live isolation path. Capture exact commands, logs, timings, and output paths. Only treat the run as clean-live if: no [digital-twin-router] record lines appear, _meta/events.jsonl does not show mode: "record", the stale cassette id does not appear anywhere, and a fresh phase1-gather-context/dialogue-data.json is produced. Claim the assigned bead with bd update <ID> --status in_progress --json at start and close it with bd close <ID> --reason "Executed clean-live Xiaomi verification rerun" --json at completion. Update the active plan with exact evidence either way.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `.logs/`
- `output/`

**Files Created/Deleted/Modified:**
- `.plans/2026-04-03-runtime-isolation-clean-live-xiaomi-verification.md`
- `.logs/2026-04-03-212342-cod-test-xiaomi-mimo-v2-omni-openrouter-high-thinking-rerun-ee-gba4.log`
- `.logs/2026-04-03-212342-cod-test-xiaomi-mimo-v2-omni-openrouter-high-thinking-rerun-ee-gba4.time`
- `output/_archives/cod-test-xiaomi-mimo-v2-omni-openrouter-high-thinking-rerun-pre-ee-gba4-2026-04-03-212342/`
- fresh rerun artifacts under `output/cod-test-xiaomi-mimo-v2-omni-openrouter-high-thinking-rerun/`

**Status:** ✅ Complete

**Results:** Claimed bead `ee-gba4`, archived the previous output tree to `output/_archives/cod-test-xiaomi-mimo-v2-omni-openrouter-high-thinking-rerun-pre-ee-gba4-2026-04-03-212342`, and reran the bounded verification lane with the exact command captured via `/usr/bin/time` and `tee`:

- `set -euo pipefail; TS=$(date +%Y-%m-%d-%H%M%S); OUTDIR='output/cod-test-xiaomi-mimo-v2-omni-openrouter-high-thinking-rerun'; ARCHIVE_DIR='output/_archives'; mkdir -p "$ARCHIVE_DIR" .logs; if [ -d "$OUTDIR" ]; then ARCHIVE_PATH="$ARCHIVE_DIR/cod-test-xiaomi-mimo-v2-omni-openrouter-high-thinking-rerun-pre-ee-gba4-$TS"; rm -rf "$ARCHIVE_PATH"; mv "$OUTDIR" "$ARCHIVE_PATH"; echo "ARCHIVED_OUTPUT=$ARCHIVE_PATH"; fi; LOG_FILE=".logs/${TS}-cod-test-xiaomi-mimo-v2-omni-openrouter-high-thinking-rerun-ee-gba4.log"; TIME_FILE=".logs/${TS}-cod-test-xiaomi-mimo-v2-omni-openrouter-high-thinking-rerun-ee-gba4.time"; echo "LOG_FILE=$LOG_FILE"; echo "TIME_FILE=$TIME_FILE"; /usr/bin/time -p -o "$TIME_FILE" node server/run-pipeline.cjs --config configs/cod-test-xiaomi-mimo-v2-omni-openrouter-high-thinking-rerun.yaml --clean-live-digital-twin --verbose 2>&1 | tee "$LOG_FILE"`

Concrete run artifacts:
- Log: `.logs/2026-04-03-212342-cod-test-xiaomi-mimo-v2-omni-openrouter-high-thinking-rerun-ee-gba4.log`
- Timing: `.logs/2026-04-03-212342-cod-test-xiaomi-mimo-v2-omni-openrouter-high-thinking-rerun-ee-gba4.time`
- Fresh output: `output/cod-test-xiaomi-mimo-v2-omni-openrouter-high-thinking-rerun/`
- Archived prior output: `output/_archives/cod-test-xiaomi-mimo-v2-omni-openrouter-high-thinking-rerun-pre-ee-gba4-2026-04-03-212342`

Timing/result summary:
- Exit code: `0`
- `/usr/bin/time -p`: `real 227.68`, `user 5.05`, `sys 0.41`
- Fresh output files now include `phase1-gather-context/dialogue-data.json`, `phase1-gather-context/music-data.json`, `phase2-process/whole-video-analysis.json`, `phase1-gather-context/script-results/get-dialogue.success.json`, `phase1-gather-context/script-results/get-music.success.json`, `phase2-process/script-results/whole-video-mimo.success.json`, `_meta/events.jsonl`, and `artifacts-complete.json`

Clean-live verification evidence against the required gates:
1. **No `[digital-twin-router] record` lines appeared**
   - `grep -n '\[digital-twin-router\]' .logs/2026-04-03-212342-cod-test-xiaomi-mimo-v2-omni-openrouter-high-thinking-rerun-ee-gba4.log` returned no matches.
   - The fresh log also explicitly printed `🧼 Clean live digital-twin isolation enabled` and `Removed env keys: DIGITAL_TWIN_MODE, DIGITAL_TWIN_PACK, DIGITAL_TWIN_CASSETTE` before config execution.
2. **`_meta/events.jsonl` did not show `mode: "record"`**
   - `output/cod-test-xiaomi-mimo-v2-omni-openrouter-high-thinking-rerun/_meta/events.jsonl` begins with `{"schemaVersion":1,"seq":1,...,"mode":"live","kind":"run.start",...}` and ends with `{"schemaVersion":1,"seq":102,...,"mode":"live","kind":"run.end","outcome":"success","durationMs":227604,...}`.
   - `grep -n '"mode":"record"' output/cod-test-xiaomi-mimo-v2-omni-openrouter-high-thinking-rerun/_meta/events.jsonl` returned no matches.
3. **The stale cassette id did not appear anywhere**
   - Stale cassette id from prior leakage evidence: `cod-test-record-20260318-202023`.
   - `grep -n 'cod-test-record-20260318-202023' .logs/2026-04-03-212342-cod-test-xiaomi-mimo-v2-omni-openrouter-high-thinking-rerun-ee-gba4.log` returned no matches.
   - `grep -RIn 'cod-test-record-20260318-202023' output/cod-test-xiaomi-mimo-v2-omni-openrouter-high-thinking-rerun` returned no matches.
4. **A fresh `phase1-gather-context/dialogue-data.json` was produced**
   - Fresh file path: `output/cod-test-xiaomi-mimo-v2-omni-openrouter-high-thinking-rerun/phase1-gather-context/dialogue-data.json`
   - `stat` shows birth/modify time `2026-04-03 21:24:43.252788549 -0400`, which is after the rerun started at `2026-04-03 21:23:42` and after the previous output tree was archived.
   - The fresh log confirms success: `✅ Dialogue extraction complete (whole_asset)` followed by `Output: /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/output/cod-test-xiaomi-mimo-v2-omni-openrouter-high-thinking-rerun/phase1-gather-context/dialogue-data.json` and `Found 16 dialogue segments`.

Conclusion for Task 2: this rerun qualifies as a **true clean-live** execution under the new isolation path. The lane stayed out of digital-twin record mode, the stale cassette reference did not leak back in, and the run completed successfully with fresh Phase 1 dialogue output ready for Task 3 review.

---

### Task 3: Verify coverage honesty from the fresh artifact and document the outcome

**Bead ID:** `ee-ye35`  
**SubAgent:** `primary`  
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, inspect the fresh clean-live rerun artifacts and determine whether the dialogue coverage honesty fix is now verified end to end. Confirm whether coverage matches the recovered dialogue reach and whether coverage.complete remains false when the reach is partial. If the provider failed before dialogue-data.json was emitted, document that the fix is still not yet live-verified rather than failed. Claim the assigned bead with bd update <ID> --status in_progress --json at start and close it with bd close <ID> --reason "Verified clean-live coverage honesty result and documented outcome" --json at completion. Update the active plan with the final result story.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `.logs/`
- `output/`

**Files Created/Deleted/Modified:**
- `.plans/2026-04-03-runtime-isolation-clean-live-xiaomi-verification.md`
- any supporting notes/log references determined during review

**Status:** ✅ Complete

**Results:** Reviewed the fresh clean-live success artifact at `output/cod-test-xiaomi-mimo-v2-omni-openrouter-high-thinking-rerun/phase1-gather-context/dialogue-data.json` plus the corresponding script-result and raw-capture envelopes.

Coverage findings from the fresh saved artifact:
- `totalDuration: 140.042449`
- `coverage: { start: 0, end: 30.5, duration: 30.5, complete: true }`
- `dialogue_segments.length: 16`
- recovered saved dialogue reach: first segment starts at `0`, last/max segment end is `30.5`

What this proves:
- **Recovered reach match:** yes for the span fields. The saved `coverage.start`, `coverage.end`, and `coverage.duration` now match the actual recovered dialogue span in the persisted artifact (`0 → 30.5`, duration `30.5`) instead of being falsely restamped to the full asset duration (`140.042449`).
- **`coverage.complete` honesty:** **not yet correct.** The recovered dialogue only reaches about the first `30.5s` of a `140.042449s` asset, so this is still partial coverage, but the saved artifact says `complete: true`.
- **Why this happened:** the fresh clean-live run did emit `dialogue-data.json`, so this is a real end-to-end live observation, not another provider-failed-before-artifact case. Inspection of `phase1-gather-context/raw/ai/dialogue-transcription/attempt-01/capture.json` and `phase1-gather-context/script-results/get-dialogue.success.json` shows the upstream model/normalized payload itself returned `coverage: { start: 0, end: 30.5, duration: 30.5, complete: true }` with `totalDuration: 30.5`, and finalization preserved that model-supplied coverage while rewriting `totalDuration` to the requested asset duration. So the local fix successfully stopped inflating `coverage.end` to the full file, but it still trusts a model-supplied `complete: true` flag that is semantically wrong once compared against the full requested timeline.

Conclusion for Task 3: the clean-live rerun provides a **partial verification only**. It proves the old full-duration `coverage.end` lie is gone on this lane, but it does **not** prove the full honesty contract end to end because `coverage.complete` still remains `true` under obviously partial reach. The dialogue coverage honesty fix is therefore **not yet fully live-verified**.

---

## Final Results

**Status:** ⚠️ Partial

**What We Built:** Implemented a narrow clean-live runtime isolation path for the bounded Xiaomi/OpenRouter verification lane, executed a fresh clean-live rerun that stayed out of digital-twin record mode and produced a fresh `phase1-gather-context/dialogue-data.json`, then reviewed that artifact end to end. The new saved artifact no longer inflates `coverage.end` / `coverage.duration` to the full asset length; it truthfully reports the recovered reach as `0 → 30.5s`. However, the same artifact still marks `coverage.complete: true` even though the requested asset timeline is `140.042449s`, so the overall dialogue coverage honesty fix is only **partially** verified live.

**Commits:**
- Pending

**Lessons Learned:** The isolation/rerun work succeeded in creating a trustworthy clean-live observation surface, and the recovered-reach span fields are now honest. The remaining source-of-truth gap is narrower: preserving model-supplied `coverage` wholesale is still too trusting when the model reports `complete: true` for a transcript that only covers a small prefix of the requested full timeline. The next fix lane should reconcile model-supplied `coverage.complete` against requested-scope duration or recovered persisted reach before claiming end-to-end honesty is solved.

---

*Completed on 2026-04-03*
