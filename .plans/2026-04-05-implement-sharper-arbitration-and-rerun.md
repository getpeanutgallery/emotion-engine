# emotion-engine: implement sharper arbitration/coverage-recall tranche and rerun cod-test

**Date:** 2026-04-05  
**Status:** In Progress  
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

**Status:** ⏳ Pending

**Results:** Pending.

---

## Final Results

**Status:** ⏳ Pending

**What We Built:** Pending.

**Commits:**
- Pending.

**Lessons Learned:** Pending.

---

*Started on 2026-04-05*
