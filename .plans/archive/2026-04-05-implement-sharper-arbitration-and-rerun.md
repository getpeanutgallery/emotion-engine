# emotion-engine: implement sharper arbitration/coverage-recall tranche and rerun cod-test

**Date:** 2026-04-05  
**Status:** Complete  
**Agent:** Cookie 🍪

---

## Goal

Implement one more sharp, narrow tranche focused on stricter dialogue-vs-lyric arbitration and more deliberate music-vocals coverage recall, then rerun cod-test to see whether this improves over the prior boundary-handling pass.

---

## Overview

The previous boundary-handling tranche improved some structural coverage and recovered a few spoken-under-score lines, but it still did not materially solve the core truth problem. Dialogue still absorbed sung material, and music-vocals still broadened coverage without becoming truthfully timeline-faithful enough. That suggests another generic prompt-tightening pass is not enough by itself.

This tranche stays narrow but sharper. The next pass should make dialogue exclude lyric-like delivery more aggressively, split speech-to-song pivots more explicitly, and preserve masked spoken fragments without reconstructing them. It should make music-vocals pursue full-timeline lyric coverage more deliberately by using whole-asset context as a recall scaffold during chunk refinement, preserving repeated hooks/reprises as separate returns, and preferring short literal fragments over polished wrong lyric variants. Music should remain non-lexical, but it should more explicitly describe mixed audio as spoken-overlay versus lyric-bearing music so the other lanes have better arbitration context.

We are still avoiding a new artifact family, big reconciliation stage, or schema expansion in this pass. The goal is to test whether stronger arbitration rules plus more deliberate coverage recall can move quality meaningfully before escalating to a heavier architectural solution.

---

## Tasks

### Task 1: Implement sharper arbitration and coverage-recall changes in dialogue, music, and music-vocals

**Bead ID:** `ee-emyx`  
**SubAgent:** `coder`  
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, implement a sharper next-pass tranche for dialogue/music/music-vocals. Tighten get-dialogue.cjs with harder anti-lyric exclusion, stronger split-at-pivot rules, and masked-spoken fragment preservation. Tighten get-music-vocals.cjs so it aims for full-timeline lyric coverage, uses whole-asset context as a recall scaffold during chunk refinement, preserves repeated hooks/reprises as distinct returns, narrows hybrid further, and prefers short literal fragments over polished wrong lyric variants. Tighten get-music.cjs so it better distinguishes spoken-overlay vs lyric-bearing music while remaining non-lexical. Update any minimal validator/test expectations needed, keep schema/artifact paths stable, run focused tests, update this plan truthfully, commit after tests pass, and do not push. Close bead ee-emyx when done.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `server/scripts/get-context/`
- `server/lib/`
- `test/`

**Files Created/Deleted/Modified:**
- `.plans/2026-04-05-implement-sharper-arbitration-and-rerun.md`
- `server/lib/phase1-validator-tools.cjs`
- `server/scripts/get-context/get-dialogue.cjs`
- `server/scripts/get-context/get-music.cjs`
- `server/scripts/get-context/get-music-vocals.cjs`
- `test/lib/phase1-validator-tools.test.js`
- `test/scripts/get-dialogue.test.js`
- `test/scripts/get-music.test.js`
- `test/scripts/get-music-vocals.test.js`

**Status:** ✅ Complete

**Results:** Implemented the sharper prompt/validator tranche without changing schema or artifact paths. Dialogue rules now preserve masked spoken fragments as-heard, split more aggressively at spoken→sung pivots even for very short spoken prefixes, and explicitly prefer short literal spoken fragments over polished reconstructions. Music rules now more explicitly distinguish spoken-overlay from lyric-bearing music while staying coarse/non-lexical. Music-vocals rules now push harder for short literal lyric fragments, use whole-asset context as recall scaffolding during chunk refinement, and add a chunk-local whole-asset checklist so expected lyric-bearing moments can be confirmed/refined/rejected rather than blindly copied.

Focused tests run and passed:
- `node --test test/scripts/get-dialogue.test.js test/scripts/get-music.test.js test/scripts/get-music-vocals.test.js test/lib/phase1-validator-tools.test.js`

Outcome: 83 tests passed, 0 failed.

Caveats:
- This is still a narrow prompt/validator/context-shaping tranche; it does not add a new reconciliation layer or schema-level overlap metadata.
- Whether the stronger recall scaffold materially improves truthfulness still needs Task 2's cod-test rerun.

---

### Task 2: Rerun cod-test after the sharper tranche and compare it to prior reruns

**Bead ID:** `ee-7h2e`  
**SubAgent:** `primary`  
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, after Task 1 lands, run a fresh canonical cod-test rerun. Capture the exact command, logs, timing, cassette, and fresh artifact/report paths. Compare the result against the prior boundary-handling rerun and state clearly whether dialogue-vs-sung separation, spoken-under-score recovery, and music-vocals truthfulness improved meaningfully. Update this plan truthfully with deltas and key observations, do not push, and only commit if a durable review artifact warrants it. Close bead ee-7h2e when done.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `.logs/`
- `output/`
- `benchmarks/fixtures/cod-test/_reports/`

**Files Created/Deleted/Modified:**
- `.plans/2026-04-05-implement-sharper-arbitration-and-rerun.md`
- fresh rerun artifacts/logs/reports

**Status:** ✅ Complete

**Results:** Claimed bead `ee-7h2e` and ran a fresh record-mode cod-test with the canonical config at commit `2ec507f` using:

```bash
set -a
. ./.env
set +a
export DIGITAL_TWIN_MODE=record
export DIGITAL_TWIN_CASSETTE="cod-test-record-20260405-151939-ee-7h2e-sharper-rerun"
node server/run-pipeline.cjs --config configs/cod-test.yaml --verbose
```

The rerun completed Phases 1–3, then failed at the benchmark gate with: `0/7 artifacts passed. 1855/2949 scoreable fields passed. Truth coverage was 2949/3060 fields.` Runtime from `/usr/bin/time` was `real 2308.78` seconds (~38m 29s), faster than the prior boundary rerun's `2428.81` seconds (~40m 29s).

Fresh evidence captured:
- log: `.logs/cod-test-20260405-151939-ee-7h2e-sharper-rerun.log`
- timing: `.logs/cod-test-20260405-151939-ee-7h2e-sharper-rerun.time`
- cassette: `cod-test-record-20260405-151939-ee-7h2e-sharper-rerun`
- archived pre-rerun packet (used for direct artifact comparison to the prior boundary-handling rerun): `output/_archives/cod-test-pre-ee-7h2e-20260405-151939/`
- benchmark summary: `benchmarks/fixtures/cod-test/_reports/benchmark-summary.json`
- benchmark markdown: `benchmarks/fixtures/cod-test/_reports/benchmark-summary.md`
- fresh Phase 1 artifacts reviewed:
  - `output/cod-test/phase1-gather-context/dialogue-data.json`
  - `output/cod-test/phase1-gather-context/music-data.json`
  - `output/cod-test/phase1-gather-context/music-vocals-data.json`
- fresh Phase 2 aggregate: `output/cod-test/phase2-process/chunk-analysis.json`
- fresh Phase 3 review entrypoints:
  - `output/cod-test/phase3-report/summary/FINAL-REPORT.md`
  - `output/cod-test/phase3-report/summary/summary.json`
  - `output/cod-test/phase3-report/summary/analysis-data.json`
  - `output/cod-test/phase3-report/recommendation/recommendation.json`

Benchmark deltas vs the prior boundary-handling rerun (`ee-lghs` from `.plans/2026-04-05-implement-boundary-handling-and-rerun.md`):
- overall scoreable accuracy: `1943/3034` (**64.04%**) → `1855/2949` (**62.90%**) `(-88 passed fields, -1.14 pts)`
- overall truth coverage: `3034/3149` (**96.35%**) → `2949/3060` (**96.37%**) `(-85 scoreable fields, +0.01 pts)`
- `dialogueData`: accuracy `0.3866` → `0.4402` (better), coverage `0.9261` → `0.9087` (worse)
- `musicData`: accuracy `0.3469` → `0.4318` (better), coverage `0.8167` → `0.7857` (worse)
- `musicVocalsData`: accuracy `0.3871` → `0.4130` (better), coverage `0.8942` → `0.9109` (better)

Human review against the requested quality bars:
- **Dialogue-vs-sung separation did not improve meaningfully; in practice it still fails and looks worse in the opening.** The prior boundary rerun already leaked lyrics into dialogue (`8.0-16.6` and `113-116`). The sharper rerun still does that and now fragments the opening lyric material even more aggressively into dialogue (`8.08-8.16 "Your streets shall once again run red."`, `16-17 "With your blood."`) while still retaining `116-118.5 "Obey your master!"` as dialogue. That is not a cleaner spoken-vs-sung split.
- **Spoken-under-score recovery regressed, not improved.** The prior boundary rerun recovered masked spoken lines like `50.1-51.3 "Specter One, report."` and `52-53.2 "Need a sitrep."`. The sharper rerun lost both of those entirely. It also kept only a partial later recovery (`62-63 "This isn't real."`) and drifted wording on the response (`63.3-64 "The hell it is."` vs prior `"The hell it isn't."`). So the sharper arbitration pass did not preserve the spoken-under-score gains.
- **Music-vocals truthfulness improved somewhat at the lyric-text level, but not meaningfully overall.** Compared with the prior boundary rerun's mostly wrong later-segment guesses (`"Control your master"`, `"Crushing your day"`, etc.), the fresh rerun recovers substantially truer later lyric content (`115.2-118.5 "Master of puppets I'm pulling your strings"`, `119.5-122.1 "Twisting your mind and smashing your dreams"`, `123.5-126.8 "Blinded by me you can't see a thing"`, `127.5-129.8 "Just call my name 'cause I'll hear you scream"`). But it still starts far too late (`105.1s+`), still misses the earlier truth-critical lyric timeline, and still misplaces the opening chant as dialogue instead of leaving the vocal lane to carry it. So lyric wording improved, but truthful full-timeline coverage still did not improve enough to count as a meaningful win.
- **Music lane recognition shifted earlier but became less coverage-faithful.** The prior recognized-song span was `105-135`; the sharper rerun moved that to `76-105`, which is directionally closer to earlier music presence, but it also truncated the later span and did not translate into faithful lyric-lane timing.

Bottom line:
- This rerun is **not a meaningful improvement over the prior boundary-handling rerun** for the targeted problem.
- Overall benchmark score regressed.
- Dialogue still absorbs sung material.
- Spoken-under-score recovery got worse.
- Music-vocals lyric wording got better in the later section, but full-timeline truthfulness still remains inadequate.
- I updated the plan only; I did **not** create a new git commit because this validation pass did not add a durable review artifact beyond the plan update itself, and the honest verdict is still negative.

---

## Final Results

**Status:** ⚠️ Partial

**What We Built:** Implemented the sharper arbitration/coverage-recall tranche, ran a fresh canonical cod-test rerun, archived the prior output packet for direct comparison, and documented the exact runtime/benchmark/artifact deltas. The sharper pass improved some later lyric wording and nudged artifact-level accuracy upward in dialogue/music/music-vocals, but it did not solve the target problem: dialogue still leaks lyrics, spoken-under-score recovery regressed, and music-vocals still is not truthfully full-timeline enough.

**Commits:**
- `2ec507f` - Tighten dialogue/music arbitration and lyric recall scaffolding
- No additional commit for Task 2 validation; plan updated in working tree only.

**Lessons Learned:** Sharper prompt arbitration alone can make later lyric text more plausible without actually improving lane truthfulness. The next productive tranche likely needs stronger cross-lane reconciliation and timing-faithful overlap ownership, not just stricter per-lane instructions.

---

*Completed on 2026-04-05*
