# Emotion Engine

**Date:** 2026-04-27  
**Status:** In Progress  
**Agent:** Cookie 🍪

---

## Goal

Investigate why `Your life burns faster` survives in reconciled dialogue after recognized-song activation is restored, then present the exact proposed change before any implementation or rerun.

---

## Overview

The recognized-song instability slice is now in a good place: aggregation collapse was fixed, canonical rerun recognition held, reconciliation activated, and reconciled dialogue score improved to the low 90s. The remaining anomaly is narrower: `Your life burns faster` still survives in reconciled dialogue even though the same run clearly recognizes `Master of Puppets` and removes several nearby lyric-contamination lines.

This slice should determine whether that survivor is caused by sparse `matchedLyrics`, literal/transcript variance (`life burns faster` vs canonical lyrics), normalization/matching thresholds, current removal policy boundaries, or truth-artifact expectations. The work should stop at an approval-ready diagnosis and exact proposed fix direction before any code changes or reruns.

---

## REFERENCES

| ID | Description | Path |
| --- | --- | --- |
| `REF-01` | Recognized-song instability plan/outcome | `.plans/2026-04-27-investigate-recognized-song-instability.md` |
| `REF-02` | Recognized-song instability outcome audit | `docs/2026-04-27-recognized-song-instability-outcome-audit.md` |
| `REF-03` | Live reconciliation script | `server/scripts/get-context/reconcile-famous-song-phase1.cjs` |
| `REF-04` | Live music-vocals script | `server/scripts/get-context/get-music-vocals.cjs` |
| `REF-05` | Reconciliation tests | `test/scripts/reconcile-famous-song-phase1.test.js` |
| `REF-06` | Latest reconciled dialogue artifact | `output/cod-test/phase1-gather-context/dialogue-data.reconciled.json` |
| `REF-07` | Latest music-vocals artifact | `output/cod-test/phase1-gather-context/music-vocals-data.json` |
| `REF-08` | Latest reconciliation ledger | `output/cod-test/phase1-gather-context/famous-song-reconciliation.json` |
| `REF-09` | Current dialogue benchmark artifact result | `benchmarks/fixtures/cod-test/_reports/artifact-results/dialogueData.json` |
| `REF-10` | cod-test truth surfaces relevant to lyric wording | `benchmarks/fixtures/cod-test/truth/` |

---

## Tasks

### Task 1: Audit why `Your life burns faster` survives reconciliation

**Bead ID:** `ee-hpbp`  
**SubAgent:** `primary`  
**Role:** `research`  
**References:** `REF-02`, `REF-03`, `REF-04`, `REF-05`, `REF-06`, `REF-07`, `REF-08`, `REF-09`, `REF-10`  
**Prompt:** Audit why `Your life burns faster` remains in reconciled dialogue after recognized-song activation is restored. Claim the bead on start. Determine whether the cause is sparse matched-lyric coverage, lyric wording/transcript variance, normalization or similarity thresholds, current removal-policy boundaries, or benchmark/truth expectations. Produce a concise repo note with exact proposed change options and a recommended narrow fix Derrick can approve or reject directly. Update this plan with findings and leave later tasks pending.

**Folders Created/Deleted/Modified:**
- `docs/`
- `.plans/`

**Files Created/Deleted/Modified:**
- `docs/2026-04-27-your-life-burns-faster-anomaly-audit.md`
- `.plans/2026-04-27-investigate-your-life-burns-faster-anomaly.md`

**Status:** ✅ Complete

**Results:** Manual artifact audit completed after repeated research handoff glitches. `dialogue-data.json` shows a low-confidence sung cluster at indexes `13-17`, with index `16` = `Your life burns faster`. `dialogue-data.reconciled.json` removes surrounding lyric lines but leaves index `16`. The current `music-vocals-data.json` `recognizedSong.matchedLyrics` list and `vocal_segments` do not contain `Your life burns faster`, so reconciliation has no direct evidence for that exact line under current policy. Recommended next-step option set: (1) narrow local bridge-rule in `server/scripts/get-context/reconcile-famous-song-phase1.cjs` allowing a low-confidence sung line between already-confirmed lyric contaminations from the same local run to be removed even without exact lyric text support; or (2) broaden upstream lyric support capture in `get-music-vocals.cjs` so the exact fragment appears in `vocal_segments` / matched support. Recommended fix: option (1), because it is narrower, generic, and localized to reconciliation. Supporting doc stub written to `docs/2026-04-27-your-life-burns-faster-anomaly-audit.md`. Tasks 2-4 intentionally remain pending.

---

### Task 2: Implement the approved narrow fix

**Bead ID:** `Pending`  
**SubAgent:** `primary`  
**Role:** `coder`  
**References:** `REF-03`, `REF-04`, `REF-05`, `REF-06`, `REF-07`, `REF-08`, `REF-10`  
**Prompt:** After Derrick approves the exact change, implement the narrow fix, add/update tests, run validation, update this plan, commit/push by default, and close the bead.

**Folders Created/Deleted/Modified:**
- `server/`
- `test/`
- `.plans/`

**Files Created/Deleted/Modified:**
- to be determined by Task 1
- `.plans/2026-04-27-investigate-your-life-burns-faster-anomaly.md`

**Status:** ⏳ Pending

**Results:** Pending.

---

### Task 3: Rerun cod-test after the approved fix

**Bead ID:** `Pending`  
**SubAgent:** `primary`  
**Role:** `qa`  
**References:** `REF-03`, `REF-06`, `REF-07`, `REF-08`, `REF-09`, `REF-10`  
**Prompt:** After the approved fix lands, run the canonical cod-test pipeline, compare results, update this plan, write a concise QA note if useful, and close the bead.

**Folders Created/Deleted/Modified:**
- `output/`
- `benchmarks/`
- `docs/`
- `.plans/`

**Files Created/Deleted/Modified:**
- fresh rerun artifacts/reports
- optional QA note
- `.plans/2026-04-27-investigate-your-life-burns-faster-anomaly.md`

**Status:** ⏳ Pending

**Results:** Pending.

---

### Task 4: Independent audit of the anomaly outcome

**Bead ID:** `Pending`  
**SubAgent:** `primary`  
**Role:** `auditor`  
**References:** `REF-03`, `REF-06`, `REF-07`, `REF-08`, `REF-09`, `REF-10`  
**Prompt:** Independently audit the post-fix outcome, verify whether the anomaly was addressed for the right reason, update this plan, and close the bead.

**Folders Created/Deleted/Modified:**
- `docs/`
- `.plans/`

**Files Created/Deleted/Modified:**
- audit note if needed
- `.plans/2026-04-27-investigate-your-life-burns-faster-anomaly.md`

**Status:** ⏳ Pending

**Results:** Pending.

---

## Final Results

**Status:** ⚠️ Partial

**What We Built:** Investigated the `Your life burns faster` survivor far enough to identify the likely cause and define an approval-ready next change, but intentionally stopped before implementation or rerun.

**Reference Check:** Directly rechecked the current dialogue artifact, reconciled artifact, music-vocals artifact, reconciliation ledger, and benchmark truth surfaces during manual audit.

**Commits:**
- Pending.

**Lessons Learned:** When upstream support surfaces omit an exact lyric fragment, current reconciliation can leave a low-confidence sung bridge line behind even when adjacent lyric contamination is removed. A small local bridge rule is likely the narrowest next fix.

---

*Planned on 2026-04-27*