# emotion-engine: add time-aware segment alignment to benchmark scoring for dialogue and music-vocals

**Date:** 2026-04-06  
**Status:** Draft  
**Agent:** Cookie 🍪

---

## Goal

Reduce benchmark score distortion from index-based segment comparison by adding time-aware segment alignment for dialogue and `music-vocals`, while preserving strict visibility into real semantic and timing mistakes.

---

## Overview

The ignore-path lane removed output-only operational metadata from core scoring, which made the benchmark more honest without hiding real content problems. The next major distortion is index-by-index segment comparison: once one early merge, split, or timing drift happens, later segments can be judged against the wrong truth entries and the score cascades downward harder than a human would judge.

This lane should address that specific failure mode. The target is not to make scoring lax; it is to align output segments to the most plausible truth segments using time-aware matching before semantic comparison. We should keep real misses visible: wrong text, missing segments, extra segments, and serious timing drift should still count. But small merge/split effects and mild timing shifts should stop poisoning the rest of the lane.

The safest path is to begin with design: inspect the current comparator/profile architecture, decide where segment alignment belongs, define matching rules and tie-break behavior, and decide how to report matched, unmatched, merged, split, and ambiguous cases. Then implement the alignment for dialogue and music-vocals only, add focused tests, and compare before/after benchmark behavior against the latest reconciled run.

---

## Tasks

### Task 1: Design time-aware alignment rules for dialogue and music-vocals scoring

**Bead ID:** `Pending`  
**SubAgent:** `research`  
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, inspect the current benchmark comparator/profile architecture and design a time-aware segment alignment strategy for dialogue and music-vocals scoring. Define candidate matching rules, tie-break behavior, handling for split/merged segments, handling for unmatched truth/output segments, and how these cases should appear in reports. Update this plan truthfully with exact files involved, proposed algorithm, and design decisions. Do not change code yet.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `server/`
- `test/`
- `benchmarks/`

**Files Created/Deleted/Modified:**
- `.plans/2026-04-06-add-time-aware-segment-alignment-to-benchmark-scoring.md`

**Status:** ⏳ Pending

**Results:** Pending.

---

### Task 2: Implement time-aware alignment in the benchmark comparator for dialogue and music-vocals

**Bead ID:** `Pending`  
**SubAgent:** `coder`  
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, after the design is complete, implement time-aware segment alignment in the benchmark comparator/reporting flow for dialogue and music-vocals. Keep the implementation narrow to those lanes unless the architecture strongly prefers a reusable abstraction. Preserve visibility into real semantic/timing failures, update this plan truthfully with the exact files and behavior changes, add focused tests, and close the bead when done.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `server/`
- `test/`
- `benchmarks/`

**Files Created/Deleted/Modified:**
- `.plans/2026-04-06-add-time-aware-segment-alignment-to-benchmark-scoring.md`
- comparator/report/test files to be identified during design

**Status:** ⏳ Pending

**Results:** Pending.

---

### Task 3: Validate before-vs-after scoring with the latest reconciled run

**Bead ID:** `Pending`  
**SubAgent:** `research`  
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, after time-aware alignment is implemented, run the narrowest truthful benchmark comparison against the latest reconciled output and compare before/after results for dialogue and music-vocals. Show which penalties disappeared because of better alignment, which real failures remain, and whether the score now better matches human judgment. Update this plan truthfully with commands, artifacts, before/after numbers, and your recommendation on whether the alignment lane is sufficient or if further comparator changes are still needed.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `benchmarks/fixtures/cod-test/_reports/`
- `output/`
- `test/`

**Files Created/Deleted/Modified:**
- `.plans/2026-04-06-add-time-aware-segment-alignment-to-benchmark-scoring.md`
- refreshed reports/artifacts as needed

**Status:** ⏳ Pending

**Results:** Pending.

---

## Final Results

**Status:** ⏳ Draft

**What We Built:** Pending.

**Commits:**
- Pending.

**Lessons Learned:** Pending.

---

*Completed on 2026-04-06*
