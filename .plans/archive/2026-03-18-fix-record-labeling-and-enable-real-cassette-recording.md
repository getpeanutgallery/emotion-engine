# emotion-engine: fix record labeling and enable real cassette recording

**Date:** 2026-03-18  
**Status:** Complete  
**Agent:** Cookie 🍪

---

## Goal

Fix the misleading live-vs-record labeling in `emotion-engine`, harden the sibling cassette-pack path behavior so an empty pack can still record cleanly, then deliberately enable digital-twin recording via environment and rerun `configs/cod-test.yaml` to confirm cassette capture is truly on.

---

## Overview

The investigation established that the recent clean `cod-test` rerun was a normal live OpenRouter run, not a cassette-record run. The main immediate problem is operator truthfulness: `emotion-engine` currently labels non-replay runs as `record` in its event timeline, which makes a live run look like it should have produced a cassette even when no twin transport was enabled.

There is also a likely sibling edge-case in the digital-twin stack: when the intended pack exists but its `cassettes/` directory is empty, first-write routing may fall back to the pack root instead of the canonical `cassettes/` directory. Even though that did not cause the recent rerun outcome, it is the right time to harden it before doing a real recording pass.

The execution order matters. First fix the misleading labeling in `emotion-engine`. Second fix the cassette-path edge case in the owning sibling repo. Third set the correct `.env` runtime variable(s) intentionally for record mode and run a fresh `cod-test` with recording truly enabled so we can verify both the transport mode and the on-disk cassette result.

---

## Tasks

### Task 1: Fix live-vs-record labeling in emotion-engine events/docs

**Bead ID:** `ee-1dq`  
**SubAgent:** `main`  
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, inspect the current event-timeline/runtime labeling for live vs replay vs record, implement a truthful distinction so live runs no longer present themselves as cassette recording, update any directly affected docs/tests, and record the exact behavior change in this plan. Claim the assigned bead on start and close it on completion.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `server/`
- `test/`
- `docs/`

**Files Created/Deleted/Modified:**
- `server/lib/events-timeline.cjs`
- `test/lib/events-timeline.test.js`
- `docs/DEBUG-CONFIG.md`
- `.plans/2026-03-18-fix-record-labeling-and-enable-real-cassette-recording.md`

**Status:** ✅ Complete

**Results:** Fixed the operator-truthfulness bug in `server/lib/events-timeline.cjs`. Before this change, `_meta/events.jsonl` labeled every non-`replay` run as `mode: "record"`, so an ordinary live run falsely presented itself like cassette recording was active. After this change, the mode is explicit and truthful: `replay` only when `DIGITAL_TWIN_MODE=replay`, `record` only when `DIGITAL_TWIN_MODE=record`, and `live` for all other cases (including unset/off values). Added `test/lib/events-timeline.test.js` to lock the three-way behavior and verify that emitted events for a non-record run now carry `mode: "live"`. Updated `docs/DEBUG-CONFIG.md` so the run timeline docs match the new semantics. Validation: `node --test test/lib/events-timeline.test.js` ✅ (4/4 passing).

---

### Task 2: Fix empty-pack cassette write routing in the owning sibling repo

**Bead ID:** `dtr-4jq`  
**SubAgent:** `main`  
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/digital-twin-router, inspect the current cassette pack path selection logic and fix the edge-case where an intentionally empty pack may route first-write cassette output to the pack root instead of the canonical cassettes/ directory. Keep the change bounded, update tests/docs if present, and record exact evidence/results back into the plan. Claim the assigned bead on start and close it on completion.`

**Folders Created/Deleted/Modified:**
- sibling repo `../digital-twin-router/`
- `.plans/`

**Files Created/Deleted/Modified:**
- `../digital-twin-router/index.js`
- `../digital-twin-router/test/index.test.js`
- `../digital-twin-router/README.md`
- `.plans/2026-03-18-fix-record-labeling-and-enable-real-cassette-recording.md`

**Status:** ✅ Complete

**Results:** Confirmed the sibling-router edge-case in the owning repo `digital-twin-router`: `createTwinTransport()` only switched `storeDir` to `pack/cassettes` if that directory already contained at least one `.json`/`.cassette` file. That meant an intentionally empty pack with a real `cassettes/` directory could send the first recorded cassette write to the pack root instead of the canonical `cassettes/` directory. Fixed this narrowly in `../digital-twin-router/index.js` by preferring `pack/cassettes` whenever that directory exists, even if empty. Added a regression test in `../digital-twin-router/test/index.test.js` that records into an empty pack and verifies `cassettes/first-write.json` exists while `pack/first-write.json` does not. Updated `../digital-twin-router/README.md` to document the canonical-empty-pack behavior. Validation (run in the owning sibling repo): `node --test test/index.test.js` ✅ (29/29 passing).

---

### Task 3: Intentionally enable digital-twin recording and rerun cod-test

**Bead ID:** `ee-c81`  
**SubAgent:** `main`  
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, after the labeling and sibling cassette-path fixes are in place, set the necessary DIGITAL_TWIN_* env/config intentionally for a true record-mode run, verify recording is actually enabled before launch, rerun node server/run-pipeline.cjs --config configs/cod-test.yaml --verbose, and then inspect both the event trail and the cassette output path to confirm a real recording was produced. Update this plan with the exact env/runtime shape, artifact paths, and outcome. Claim the assigned bead on start and close it on completion.`

**Folders Created/Deleted/Modified:**
- `emotion-engine/.env` or other intended runtime env surface
- `emotion-engine/output/`
- sibling cassette pack path
- `.plans/`

**Files Created/Deleted/Modified:**
- environment file(s) if intentionally updated
- fresh `output/cod-test/**`
- new cassette artifact(s)
- `.plans/2026-03-18-fix-record-labeling-and-enable-real-cassette-recording.md`

**Status:** ✅ Complete

**Results:** Claimed bead `ee-c81`, then intentionally enabled true record-mode runtime in the repo-local `.env` that `server/run-pipeline.cjs` loads via `dotenv`. Exact env shape used for the successful run:
- `AI_API_KEY=<present in .env>`
- `DIGITAL_TWIN_MODE=record`
- `DIGITAL_TWIN_PACK=/home/derrick/.openclaw/workspace/projects/peanut-gallery/digital-twin-openrouter-emotion-engine`
- `DIGITAL_TWIN_CASSETTE=cod-test-record-20260318-162909`

Preflight verification before launch confirmed this was a real record-mode run, not live mode: the resolved pack path existed, the pack had a `cassettes/` directory, the target cassette did **not** already exist, and a dry-run load of `configs/cod-test.yaml` succeeded with `DIGITAL_TWIN_MODE=record` in process env. Then ran exactly:
- `node server/run-pipeline.cjs --config configs/cod-test.yaml --verbose`

Run outcome: ✅ success (exit code 0). Fresh runtime artifacts were written under `output/cod-test/`, including `_meta/events.jsonl`, `phase1-gather-context/dialogue-data.json`, `phase1-gather-context/music-data.json`, `phase2-process/chunk-analysis.json`, `phase3-report/**`, and `artifacts-complete.json`. The event trail truthfully shows record mode from start to finish, e.g. `output/cod-test/_meta/events.jsonl` has `kind:"run.start"` at seq 1 with `mode:"record"`, provider-call events in Phase 1/2/3 also show `mode:"record"`, and `kind:"run.end"` at seq 468 reports `outcome:"success"`.

A real cassette was produced, but the runtime wrote it to the sibling pack root instead of the canonical `cassettes/` subdirectory:
- actual cassette file created: `/home/derrick/.openclaw/workspace/projects/peanut-gallery/digital-twin-openrouter-emotion-engine/cod-test-record-20260318-162909.json`
- expected canonical first-write target for the fixed sibling repo: `/home/derrick/.openclaw/workspace/projects/peanut-gallery/digital-twin-openrouter-emotion-engine/cassettes/cod-test-record-20260318-162909.json`

Cassette evidence: the created file is non-empty (`774916` bytes, modified `2026-03-18 17:09:00 -0400`) and contains `63` recorded interactions, with first/last requests targeting `https://openrouter.ai/api/v1/chat/completions`. Important runtime nuance: `emotion-engine` executed against its installed dependency copy `node_modules/digital-twin-router/index.js`, which still contains the older `hasCassettes` gate for choosing `pack/cassettes`; that explains why recording was genuinely active yet the new cassette still landed at the pack root during this run.

---

## Final Results

**Status:** ✅ Complete

**What We Built:** Completed the three-part fix/verification loop. `emotion-engine` now labels live/replay/record truthfully in `_meta/events.jsonl`, the owning sibling repo `digital-twin-router` was patched to prefer an existing empty `cassettes/` directory for first-write recording, and `cod-test` was rerun in intentionally enabled digital-twin record mode using the intended sibling pack `/home/derrick/.openclaw/workspace/projects/peanut-gallery/digital-twin-openrouter-emotion-engine`. The exact record-mode env/runtime shape for the successful pipeline pass was: `DIGITAL_TWIN_MODE=record`, `DIGITAL_TWIN_PACK=/home/derrick/.openclaw/workspace/projects/peanut-gallery/digital-twin-openrouter-emotion-engine`, `DIGITAL_TWIN_CASSETTE=cod-test-record-20260318-162909`, plus the existing `AI_API_KEY` from `.env`. The run succeeded (`node server/run-pipeline.cjs --config configs/cod-test.yaml --verbose`, exit 0), `output/cod-test/_meta/events.jsonl` shows truthful `mode:"record"` from `run.start` through `run.end`, and a real cassette was captured at `/home/derrick/.openclaw/workspace/projects/peanut-gallery/digital-twin-openrouter-emotion-engine/cod-test-record-20260318-162909.json` with 63 interactions.

**Commits:**
- Not created in this task execution.

**Lessons Learned:** Record mode truth is now verified end-to-end, but the successful recording also exposed one remaining integration gap: the running `emotion-engine` install is still using its older vendored `node_modules/digital-twin-router/index.js`, so first-write output still went to the pack root instead of `.../cassettes/`. In other words, recording was genuinely active and successful, but the runtime dependency copy still needs to be refreshed if we want the on-disk cassette location to match the newly fixed sibling repo behavior during normal app execution.

---

*Completed on 2026-03-18*
