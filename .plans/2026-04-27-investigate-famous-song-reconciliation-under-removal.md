# Emotion Engine

**Date:** 2026-04-27  
**Status:** In Progress  
**Agent:** Cookie 🍪

---

## Goal

Investigate and narrowly revise famous-song reconciliation so known-song lyric contamination is removed more completely from reconciled dialogue, then rerun `cod-test` after Derrick approves the exact script changes.

---

## Overview

The current state suggests the primary dialogue generation lane is mostly acceptable aside from the separate weak-line omission issue (`You shall know fear.`). The more urgent problem for the benchmark is now in famous-song reconciliation: the rerun correctly recognized `Master of Puppets`, but the reconciler only removed two dialogue segments while several obvious lyric-contamination lines remained in reconciled dialogue. That means the score drop was not really about hearing more lyric material; it was about failing to remove that material after recognition.

The likely causes currently visible are twofold. First, the reconciliation gate appears to rely on a limited `matchedLyrics` anchor set rather than a fuller removal-evidence surface. Second, the spoken-signal preservation heuristic appears to protect lyric-contaminated same-speaker runs too aggressively once the dialogue lane groups them into a coherent speaker block. The next pass should audit those mechanics, produce a proposed narrow script revision for approval, and only then implement and rerun.

---

## REFERENCES

| ID | Description | Path |
| --- | --- | --- |
| `REF-01` | Current anti-omission prompt plan and rerun notes | `.plans/2026-04-27-audit-dialogue-prompt-for-missed-lines-and-rerun-cod-test.md` |
| `REF-02` | Current reconciliation script | `server/scripts/get-context/reconcile-famous-song-phase1.cjs` |
| `REF-03` | Reconciliation tests | `test/scripts/reconcile-famous-song-phase1.test.js` |
| `REF-04` | Fresh reconciliation ledger showing under-removal | `output/cod-test/phase1-gather-context/famous-song-reconciliation.json` |
| `REF-05` | Fresh reconciled dialogue artifact still containing lyric contamination | `output/cod-test/phase1-gather-context/dialogue-data.reconciled.json` |
| `REF-06` | Fresh reconciled music-vocals artifact / recognized song support | `output/cod-test/phase1-gather-context/music-vocals-data.reconciled.json` |
| `REF-07` | Benchmark report for the failed rerun | `benchmarks/fixtures/cod-test/_reports/artifact-results/dialogueData.json` |
| `REF-08` | Memory note confirming prior routing bug was fixed and remaining red should be honest content drift | `memory/2026-04-20.md` |

---

## Tasks

### Task 1: Audit why reconciliation under-removes known-song lyric contamination

**Bead ID:** `ee-20yv`  
**SubAgent:** `primary`  
**Role:** `research`  
**References:** `REF-02`, `REF-03`, `REF-04`, `REF-05`, `REF-06`, `REF-07`, `REF-08`  
**Prompt:** Audit `reconcile-famous-song-phase1.cjs` and the fresh cod-test artifacts to explain exactly why known `Master of Puppets` lines remained in reconciled dialogue. Claim the bead on start. Determine whether the limiting factor is narrow `matchedLyrics` coverage, the spoken-signal heuristic, the vocal-index proximity rule, direct-vocal-text support behavior, or some combination. Produce a concise repo note that proposes narrow script edits Derrick can approve directly before implementation. Update the plan with exact findings and leave later tasks pending.

**Folders Created/Deleted/Modified:**
- `docs/`
- `.plans/`

**Files Created/Deleted/Modified:**
- `docs/2026-04-27-famous-song-reconciliation-under-removal-audit.md`
- `.plans/2026-04-27-investigate-famous-song-reconciliation-under-removal.md`

**Status:** ✅ Complete

**Results:** Completed the audit and wrote `docs/2026-04-27-famous-song-reconciliation-under-removal-audit.md`. Exact finding: the recognized-song gate passed correctly, but `reconcileDialogue()` removed only indexes `11` and `25` because sparse `matchedLyrics` only seeded dialogue evidence for indexes `11`, `12`, `13`, `17`, `19`, and `25`, leaving indexes `14`, `15`, `16`, and `18` uncandidateable despite exact direct vocal transcript support. Then `hasStrongSpokenSignal()` incorrectly preserved indexes `12`, `13`, `17`, and `19` because adjacent same-speaker lyric lines were treated as spoken-context support. Proposed approval-ready edit set: in `server/scripts/get-context/reconcile-famous-song-phase1.cjs`, promote strong direct vocal-text matches into dialogue-removal candidates inside the already-passed recognized-song gate when the segment is low confidence and either near vocal evidence or adjacent to an already lyric-evidenced dialogue segment; then refine `hasStrongSpokenSignal()` so lyric-like neighbors do not count as spoken support. Proposed tests in `test/scripts/reconcile-famous-song-phase1.test.js`: add a cod-test-style full lyric-run regression proving the whole `11-19` contamination block is removed even with sparse `matchedLyrics`, add a focused regression proving lyric neighbors no longer trigger spoken-signal preservation, and add a safety regression proving a real spoken same-speaker line adjacent to lyrics is still kept. Tasks 2-4 remain intentionally pending until Derrick approves implementation and rerun scope.

---

### Task 2: Implement the approved narrow reconciliation fix

**Bead ID:** `ee-a7q5`  
**SubAgent:** `primary`  
**Role:** `coder`  
**References:** `REF-02`, `REF-03`, `REF-04`, `REF-05`, `REF-06`  
**Prompt:** After Derrick approves the proposed reconciliation edits, implement the narrow script/test changes in the live famous-song reconciliation path. Claim the bead on start. Keep the goal tight: improve removal of known-song lyric contamination from reconciled dialogue without damaging legitimate spoken lines or reopening unrelated prompt work. Update/add regression tests, run relevant validation, update the plan with exact changes, and commit/push by default before handoff.

**Folders Created/Deleted/Modified:**
- `server/`
- `test/`
- `.plans/`

**Files Created/Deleted/Modified:**
- `server/scripts/get-context/reconcile-famous-song-phase1.cjs`
- `test/scripts/reconcile-famous-song-phase1.test.js`
- `.plans/2026-04-27-investigate-famous-song-reconciliation-under-removal.md`

**Status:** ✅ Complete

**Results:** Implemented the approved narrow generic fix in `server/scripts/get-context/reconcile-famous-song-phase1.cjs` without changing `reconcileMusicVocals()` behavior or broadening any gate thresholds. In `reconcileDialogue()`, low-confidence dialogue segments can now become removal candidates from strong direct vocal-text support inside an already-passed recognized-song gate when they are either near vocal-evidence indexes or adjacent to an already lyric-evidenced dialogue segment. Also refined `hasStrongSpokenSignal()` so lyric-like neighbors no longer count as spoken support, while real spoken neighbors still remain protected. Added three regression tests in `test/scripts/reconcile-famous-song-phase1.test.js` covering the sparse-anchor lyric-run failure mode, lyric-neighbor spoken-signal leakage, and the real-spoken-neighbor safety case. Validation run: `node --test test/scripts/reconcile-famous-song-phase1.test.js` ✅. Commit/push completed in the coder lane.

---

### Task 3: Rerun cod-test and compare reconciled dialogue scores

**Bead ID:** `ee-5n2f`  
**SubAgent:** `primary`  
**Role:** `qa`  
**References:** `REF-04`, `REF-05`, `REF-06`, `REF-07`  
**Prompt:** After the reconciliation fix lands, claim the bead and rerun the canonical cod-test pipeline. Compare the new reconciled dialogue results against both the current failed rerun and the earlier high-score baseline. Focus on whether known-song lyric contamination is removed more completely from `dialogue-data.reconciled.json`, whether benchmark `dialogueData` scores recover, and whether any legitimate spoken lines are accidentally removed. Record exact commands, artifacts, and before/after numbers in the plan and a concise QA note if useful.

**Folders Created/Deleted/Modified:**
- `output/`
- `benchmarks/`
- `docs/`
- `.plans/`

**Files Created/Deleted/Modified:**
- fresh cod-test output/report artifacts
- optional QA note
- `.plans/2026-04-27-investigate-famous-song-reconciliation-under-removal.md`

**Status:** ⏳ Pending

**Results:** Pending.

---

### Task 4: Independent audit of the post-fix reconciliation outcome

**Bead ID:** `ee-4xos`  
**SubAgent:** `primary`  
**Role:** `auditor`  
**References:** `REF-02`, `REF-04`, `REF-05`, `REF-06`, `REF-07`  
**Prompt:** Independently audit the post-fix cod-test rerun. Claim the bead on start. Verify that reconciled dialogue improved for the right reason: known-song lyric contamination was actually removed more completely, not merely shifted around. Confirm whether any legitimate spoken lines were wrongly dropped, and whether the score movement is supported by the concrete artifacts. Update the plan with the verdict and recommendation.

**Folders Created/Deleted/Modified:**
- `docs/`
- `.plans/`

**Files Created/Deleted/Modified:**
- audit note if needed
- `.plans/2026-04-27-investigate-famous-song-reconciliation-under-removal.md`

**Status:** ⏳ Pending

**Results:** Pending.

---

## Final Results

**Status:** ⏳ Pending

**What We Built:** Pending.

**Reference Check:** Pending.

**Commits:**
- Pending.

**Lessons Learned:** Pending.

---

*Planned on 2026-04-27*