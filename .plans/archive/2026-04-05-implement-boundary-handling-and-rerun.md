# emotion-engine: implement boundary-handling tranche and rerun cod-test

**Date:** 2026-04-05  
**Status:** Complete  
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

**Status:** ✅ Complete

**Results:** Claimed bead `ee-lghs` and ran a fresh record-mode cod-test with the canonical config after Task 1 using:

```bash
set -a
. ./.env
set +a
export DIGITAL_TWIN_MODE=record
export DIGITAL_TWIN_CASSETTE="cod-test-record-20260405-131554-ee-lghs-boundary-rerun"
node server/run-pipeline.cjs --config configs/cod-test.yaml --verbose
```

The run completed Phases 1–3, then failed at the benchmark gate with: `0/7 artifacts passed. 1943/3034 scoreable fields passed. Truth coverage was 3034/3149 fields.` Runtime from `/usr/bin/time` was `real 2428.81` seconds (~40m 29s), faster than the prior rerun's `2810.61` seconds (~46m 51s).

Fresh evidence:
- log: `.logs/cod-test-20260405-131554-ee-lghs-boundary-rerun.log`
- timing: `.logs/cod-test-20260405-131554-ee-lghs-boundary-rerun.time`
- cassette: `cod-test-record-20260405-131554-ee-lghs-boundary-rerun`
- archived pre-rerun packet for comparison: `output/_archives/cod-test-pre-ee-lghs-20260405-131554/`
- benchmark summary: `benchmarks/fixtures/cod-test/_reports/benchmark-summary.json`
- benchmark markdown: `benchmarks/fixtures/cod-test/_reports/benchmark-summary.md`
- Phase 1 artifacts reviewed:
  - `output/cod-test/phase1-gather-context/dialogue-data.json`
  - `output/cod-test/phase1-gather-context/music-data.json`
  - `output/cod-test/phase1-gather-context/music-vocals-data.json`
- Phase 2 aggregate: `output/cod-test/phase2-process/chunk-analysis.json`
- Phase 3 review entrypoints:
  - `output/cod-test/phase3-report/summary/FINAL-REPORT.md`
  - `output/cod-test/phase3-report/summary/summary.json`
  - `output/cod-test/phase3-report/summary/analysis-data.json`
  - `output/cod-test/phase3-report/recommendation/recommendation.json`

Benchmark deltas vs the immediate prior rerun (`ee-tpgy` from `.plans/2026-04-05-rerun-song-grounding-and-review.md`):
- overall scoreable accuracy: `1783/2907` (**61.33%**) → `1943/3034` (**64.04%**) `(+160 passed fields, +2.71 pts)`
- overall truth coverage: `2907/3034` (**95.81%**) → `3034/3149` (**96.35%**) `(+127 scoreable fields, +0.54 pts)`
- `dialogueData`: accuracy `0.4360` → `0.3866` (worse), coverage `0.8473` → `0.9261` (better)
- `musicVocalsData`: accuracy `0.4359` → `0.3871` (worse), coverage `0.8478` → `0.8942` (better)
- `musicData`: accuracy `0.3061` → `0.3469` (better), coverage `0.8167` → `0.8167` (flat)

Human review of the requested boundary questions:
- **Dialogue-vs-sung separation did not improve meaningfully.** The rerun still lets sung material leak into `dialogueData`, including the early lyric block (`"Your streets shall once again run red. With your blood."`) and a late `"Obey your master!"` segment at `113-116`. That is not cleaner than the prior rerun in the way this tranche intended.
- **Spoken-under-score recovery improved somewhat, but only partially.** Compared with the prior rerun, the new dialogue artifact does recover masked spoken lines like `"Specter One, report."` and `"Need a sitrep."`, and it splits the closing promo VO into `"Get the Reznov challenge pack."` plus `"And you, pre-order now."` instead of one merged blob. But it still misses truth-critical spoken items like `"You shall know fear."`, and some recovered lines drift or split incorrectly (`"So we're going to leave them?"`, `"Kill the man."`, `"The hell it isn't."`).
- **Music-vocals full-timeline coverage improved in breadth, but not truthfully enough.** The prior rerun only covered the `76-98s` later sung block. The fresh rerun expands to `10` vocal segments and reaches later/repeated chant territory, but the timing/content is still materially wrong: it starts too late (`104.5s+`), misses the truth's early `64-98s` lyric timeline, and replaces correct lines with wrong variants like `"Control your master"`, `"Crushing your day"`, and fragmented tail entries. So coverage breadth improved, but full-timeline faithful coverage did not.
- **Music lane improved modestly but became more conservative on song extent.** `musicData` stays whole-asset / full-timeline and benchmark accuracy improved, but `recognizedSong` narrowed from `58-135` to `105-135`, so the lane is not evidence for earlier chant coverage.

Bottom line:
- The rerun is a **mixed result, not a meaningful overall win** for the targeted boundary problem.
- The benchmark moved upward overall, mostly via broader structural coverage and some spoken-under-score recovery.
- But the two asked-for quality bars still fail: **dialogue still absorbs sung material**, and **music-vocals still does not provide truthful full-timeline lyric coverage**.
- I updated the plan only; I did **not** create a new git commit because this validation pass did not produce a stronger durable review artifact beyond the plan update itself, and the result was still benchmark-failing.

---

## Final Results

**Status:** ⚠️ Partial

**What We Built:** Implemented the narrow boundary-handling tranche, ran a fresh canonical cod-test rerun, archived the prior output packet, and documented the exact benchmark/result deltas. The new pass improved overall benchmark accuracy/coverage a bit and recovered some spoken-under-score material, but it did not solve the intended boundary problem: dialogue still leaks sung material and music-vocals still lacks truthful full-timeline lyric coverage.

**Commits:**
- `43f101f` - Tighten boundary handling across dialogue and music lanes
- No additional commit for Task 2 validation; plan updated in working tree only.

**Lessons Learned:** Narrow prompt/validator tightening can improve structural coverage without actually improving lane truthfulness. The next useful lane should focus on stronger overlap arbitration and timing-faithful lyric span recovery, not more generic prompt pressure.

---

*Started on 2026-04-05*
