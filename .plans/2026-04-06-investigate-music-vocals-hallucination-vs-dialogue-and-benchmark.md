# emotion-engine: checkpoint current music-vocals tuning, then investigate the lyric hallucination against dialogue and benchmark truth

**Date:** 2026-04-06  
**Status:** In Progress  
**Agent:** Cookie 🍪

---

## Goal

Checkpoint the current music-vocals prompt-tuning lane in git so it is not lost, then compare the hallucinated sung-vocal segment against the same timeframe dialogue output and the human-verified benchmark truth to identify the most obvious cause of the hallucination.

---

## Overview

The current prompt-tuning lane recovered most of the expected `Master of Puppets` sequence while keeping dialogue free of obvious lyric contamination, but the rerun still produced at least one bogus lyric rewrite: `Come crawling faster`. Derrick wants that work safely committed first, then a direct comparison of the hallucinated sung-vocal line against the same timeframe in the dialogue lane and against the gold benchmark so we can see whether the failure came from cross-lane contamination, weak audio support, canonical overfill, or some other obvious cause.

This plan keeps the checkpoint and the investigation separate. First we will commit/push the current lane so the prompt/test/plan state is preserved. Then we will inspect the exact time range around the hallucinated segment in the fresh `music-vocals` artifact, compare it with `dialogue-data.reconciled.json` over the same interval, compare both to benchmark truth, and document whether there is an obvious reason the line drifted into a wrong canonical fill.

---

## Tasks

### Task 1: Checkpoint current music-vocals tuning with commit and push

**Bead ID:** `ee-psnx`  
**SubAgent:** `primary`  
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, claim bead ee-psnx immediately with \`bd update ee-psnx --status in_progress --json\`, then checkpoint the current music-vocals prompt-tuning lane in git so it is not lost. Commit the files that belong to this lane, push them to main via the SSH origin, and update this plan truthfully with the exact committed files, commit hash, and push result. Do not mix in unrelated repo noise. Close bead ee-psnx with a clear reason when finished.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `server/lib/`
- `server/scripts/get-context/`
- `test/`
- `benchmarks/fixtures/cod-test/_reports/`

**Files Created/Deleted/Modified:**
- `.plans/2026-04-06-tune-music-vocals-prompt-for-coverage-without-bogus-lyrics.md`
- `.plans/2026-04-06-investigate-music-vocals-hallucination-vs-dialogue-and-benchmark.md`
- `server/lib/phase1-validator-tools.cjs`
- `server/scripts/get-context/get-music-vocals.cjs`
- `test/lib/phase1-validator-tools.test.js`
- `test/scripts/get-music-vocals.test.js`
- `benchmarks/fixtures/cod-test/_reports/benchmark-summary.json`
- `benchmarks/fixtures/cod-test/_reports/artifact-results/musicVocalsData.json`

**Status:** ⏳ Pending

**Results:** Pending.

---

### Task 2: Compare the hallucinated sung-vocal segment against dialogue and benchmark truth

**Bead ID:** `ee-y5v0`  
**SubAgent:** `research`  
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, after ee-psnx is complete, claim bead ee-y5v0 immediately with \`bd update ee-y5v0 --status in_progress --json\`, then inspect the hallucinated music-vocals segment around the bogus line \`Come crawling faster\` in the fresh rerun. Compare that exact timeframe against the same timeframe in dialogue-data.reconciled.json and against the human benchmark truth in benchmarks/fixtures/cod-test/truth/music-vocals-data.json and dialogue-data.json. Document whether there is an obvious reason for the hallucination: cross-lane leakage, weak/partial audio support, canonical overfill after recognized-song grounding, timing drift, or something else. Update this plan truthfully with the exact files reviewed, timeframe comparisons, and your best evidence-backed conclusion. Do not change code or push in this task. Close bead ee-y5v0 with a clear reason when finished.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `output/`
- `benchmarks/fixtures/cod-test/truth/`
- `benchmarks/fixtures/cod-test/_reports/`

**Files Created/Deleted/Modified:**
- `.plans/2026-04-06-investigate-music-vocals-hallucination-vs-dialogue-and-benchmark.md`

**Status:** ⏳ Pending

**Results:** Pending.

---

## Final Results

**Status:** ⏳ In Progress

**What We Built:** In progress.

**Commits:**
- Pending

**Lessons Learned:** Pending.

---

*Completed on 2026-04-06*
