# emotion-engine: implement boundary-handling tranche and rerun cod-test

**Date:** 2026-04-05  
**Status:** In Progress  
**Agent:** Cookie 🍪

---

## Goal

Implement the approved boundary-handling prompt/rule changes across dialogue, music, and music-vocals, then run a fresh cod-test to see whether spoken-vs-sung separation and full-timeline lyric coverage materially improve.

---

## Overview

The previous tranche improved benchmark fairness and song recognition grounding, but the rerun showed that the main blocker has shifted to lane separation and coverage. Dialogue still absorbs sung material, spoken-under-score lines still fall out, and music-vocals still under-covers repeated hooks and later re-entries. The design map for the next tranche is now explicit enough to implement without a schema rewrite.

This plan keeps the scope narrow. We are not introducing new artifact families or large reconciliation systems. Instead, we are tightening prompt/tool-loop rules, overlap arbitration, and coverage expectations in `get-dialogue.cjs`, `get-music.cjs`, and `get-music-vocals.cjs`, then validating those changes with a fresh cod-test rerun and human review.

---

## Tasks

### Task 1: Implement boundary-handling prompt/rule changes in dialogue, music, and music-vocals

**Bead ID:** `ee-b9lk`  
**SubAgent:** `coder`  
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, implement the approved boundary-handling tranche described in .plans/2026-04-05-map-boundary-handling-deltas.md. Focus on narrow, implementation-ready changes only: tighten get-dialogue.cjs so spoken-under-score stays in dialogue and sung/chant/rap does not leak in; tighten get-music.cjs so it better describes score in mixed chunks without becoming a transcript lane; tighten get-music-vocals.cjs so it aims for full-timeline lyric coverage, handles repeated hooks/reprises, and uses hybrid more narrowly. Update prompt/tool-loop wording, any minimal validator/test expectations needed, and keep schema/artifact paths stable. Run focused tests, update this plan truthfully with exact files and tests, commit after tests pass, and do not push. Close bead ee-b9lk when done.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `server/scripts/get-context/`
- `server/lib/`
- `test/`

**Files Created/Deleted/Modified:**
- `.plans/2026-04-05-implement-boundary-handling-and-rerun.md`
- `server/lib/phase1-validator-tools.cjs`
- `server/scripts/get-context/get-dialogue.cjs`
- `server/scripts/get-context/get-music.cjs`
- `server/scripts/get-context/get-music-vocals.cjs`
- `test/lib/phase1-validator-tools.test.js`
- `test/scripts/get-dialogue.test.js`
- `test/scripts/get-music.test.js`
- `test/scripts/get-music-vocals.test.js`

**Status:** ✅ Complete

**Results:** Implemented the narrow boundary-handling tranche as prompt/tool-contract tightening without changing schema or artifact paths. Dialogue prompts now explicitly classify by delivery mode over loudness, preserve masked spoken-under-score fragments, and keep sung/chant/rap tails out of `dialogue_segments`. Music prompts/contracts now stay more deliberately coarse/non-lexical in mixed chunks and explicitly preserve score-bed description even when speech overlays are present. Music-vocals prompts/contracts now push for fuller lyric-timeline coverage, repeated hook/reprise capture, overlap trimming to the clearly music-led lexical content, and narrower `hybrid` use.

Focused tests run and passed:
- `node --test test/scripts/get-dialogue.test.js test/scripts/get-music.test.js test/scripts/get-music-vocals.test.js test/lib/phase1-validator-tools.test.js`

Outcome: 83 tests passed, 0 failed.

Commit:
- Created a local git commit with message `Tighten boundary handling across dialogue and music lanes` (no push).

Caveats:
- This tranche is prompt/validator-contract tightening only; it does not add a new reconciliation layer or machine-readable overlap metadata.
- Full cod-test rerun/review remains Task 2.

---

### Task 2: Run a fresh cod-test after the boundary-handling tranche and review outcome

**Bead ID:** `ee-lghs`  
**SubAgent:** `primary`  
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, after Task 1 lands, run a fresh cod-test using the canonical config. Capture the exact command, logs, cassette, and artifact paths. Then review whether dialogue-vs-sung separation, spoken-under-score recovery, and music-vocals full-timeline coverage improved meaningfully versus the prior rerun. Update this plan truthfully with benchmark/result deltas, commit only if a durable review artifact warrants it, and do not push. Close bead ee-lghs when done.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `.logs/`
- `output/`
- `benchmarks/fixtures/cod-test/_reports/`

**Files Created/Deleted/Modified:**
- `.plans/2026-04-05-implement-boundary-handling-and-rerun.md`
- fresh rerun artifacts/logs/reports

**Status:** ⏳ Pending

**Results:** Pending.

---

## Final Results

**Status:** ⏳ Pending

**What We Built:** Pending.

**Commits:**
- Pending

**Lessons Learned:** Pending.

---

*Started on 2026-04-05*
