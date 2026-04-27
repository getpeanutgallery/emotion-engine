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

**Bead ID:** `ee-rjdx`  
**SubAgent:** `primary`  
**Role:** `coder`  
**References:** `REF-03`, `REF-04`, `REF-05`, `REF-06`, `REF-07`, `REF-08`, `REF-10`  
**Prompt:** Implement the approved narrow bridge-rule in `server/scripts/get-context/reconcile-famous-song-phase1.cjs`. Claim bead `ee-rjdx` on start with `bd update ee-rjdx --status in_progress --json`. Add/update focused tests in `test/scripts/reconcile-famous-song-phase1.test.js`, run relevant validation, update this plan with exact results/files/commits, commit and push by default, and close the bead with `bd close ee-rjdx --reason "Implemented approved narrow bridge-rule and validated it" --json`.

**Folders Created/Deleted/Modified:**
- `server/`
- `test/`
- `.plans/`

**Files Created/Deleted/Modified:**
- `server/scripts/get-context/reconcile-famous-song-phase1.cjs`
- `test/scripts/reconcile-famous-song-phase1.test.js`
- `.plans/2026-04-27-investigate-your-life-burns-faster-anomaly.md`

**Status:** ✅ Complete

**Results:** Implemented a narrow local bridge-rule in `server/scripts/get-context/reconcile-famous-song-phase1.cjs` for a low-confidence same-speaker dialogue line that is directly sandwiched between already lyric-like contamination candidates. The rule stays bounded: it only applies when the middle line has no existing lyric evidence, is low-confidence, lacks a strong spoken-signal neighbor pattern, and both immediate same-speaker neighbors are already lyric-like via direct evidence or the existing direct-vocal promotion path. Added focused regression coverage in `test/scripts/reconcile-famous-song-phase1.test.js` for the exact `Your life burns faster` survivor pattern plus a guardrail case that proves a high-confidence same-speaker spoken line does not get bridged away. Validation run: `node --test test/scripts/reconcile-famous-song-phase1.test.js` ✅. Committed and pushed to `main` as `f9f700b` (`Add bounded lyric bridge for reconciliation`), then updated this plan in follow-up commit `494fc15` (`Update anomaly plan with coder handoff`).

---

### Task 3: Rerun cod-test after the approved fix

**Bead ID:** `ee-7j6r`  
**SubAgent:** `primary`  
**Role:** `qa`  
**References:** `REF-03`, `REF-06`, `REF-07`, `REF-08`, `REF-09`, `REF-10`  
**Prompt:** After bead `ee-rjdx` is closed, claim bead `ee-7j6r` with `bd update ee-7j6r --status in_progress --json`, run the canonical cod-test pipeline, compare anomaly outcomes and benchmark deltas, update this plan with exact findings/artifacts, write a concise QA note if useful, and close the bead with `bd close ee-7j6r --reason "Ran cod-test and recorded anomaly outcome" --json`.

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

**Bead ID:** `ee-hbk5`  
**SubAgent:** `primary`  
**Role:** `auditor`  
**References:** `REF-03`, `REF-06`, `REF-07`, `REF-08`, `REF-09`, `REF-10`  
**Prompt:** After bead `ee-7j6r` is closed, claim bead `ee-hbk5` with `bd update ee-hbk5 --status in_progress --json`, independently audit the post-fix outcome, verify whether the anomaly was addressed for the right reason, update this plan with exact audit findings, and close the bead with `bd close ee-hbk5 --reason "Independent audit complete" --json`.

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

**What We Built:** Completed the coder slice for the approved follow-up: a narrow bounded bridge-rule in reconciliation that can remove a low-confidence sung line like `Your life burns faster` when it is directly sandwiched inside already-confirmed same-speaker lyric contamination, without broadening upstream lyric extraction.

**Reference Check:** `REF-03` and `REF-05` were updated directly. The implementation follows the Task 1 diagnosis against `REF-06`, `REF-07`, `REF-08`, and `REF-10`: it bridges only the local survivor gap and leaves upstream lyric support behavior unchanged.

**Commits:**
- `f9f700b` - Add bounded lyric bridge for reconciliation
- `494fc15` - Update anomaly plan with coder handoff

**Lessons Learned:** The safest fix here was not a looser fuzzy matcher; it was a bounded structural rule keyed to local contamination shape. That preserves the earlier direct-vocal promotion behavior while cleaning up the exact survivor pattern the audit isolated.

---

*Planned on 2026-04-27*