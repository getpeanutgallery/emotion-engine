# Emotion Engine

**Date:** 2026-04-27  
**Status:** In Progress  
**Agent:** Cookie 🍪

---

## Goal

Implement one extra bounded generic reconciliation hop for recognized-song lyric contamination, rerun `cod-test`, and verify whether the remaining three lyric lines are removed without harming legitimate spoken dialogue.

---

## Overview

The first generic reconciliation fix materially improved reconciled dialogue by removing most of the lyric contamination block and recovering the benchmark from the failed rerun, but three lyric lines still remain. The current recommendation is to do one more narrow pass rather than broadening the system into open-ended cluster propagation.

This follow-up should add exactly one additional bounded hop inside an already-recognized-song contamination cluster, keeping all behavior generic and local. After that lands, we rerun against the existing chunk-based Phase 2 pipeline surface and audit whether the extra hop is worthwhile. Whole-video Phase 2 architecture questions are intentionally deferred until after this bounded reconciliation slice.

---

## REFERENCES

| ID | Description | Path |
| --- | --- | --- |
| `REF-01` | Prior reconciliation under-removal plan | `.plans/2026-04-27-investigate-famous-song-reconciliation-under-removal.md` |
| `REF-02` | Audit explaining sparse anchors + one-hop limitation | `docs/2026-04-27-famous-song-reconciliation-under-removal-audit.md` |
| `REF-03` | Post-fix QA note showing 81.3 / 81.7 and 3 remaining lyric lines | `docs/2026-04-27-famous-song-reconciliation-postfix-qa-note.md` |
| `REF-04` | Post-fix audit recommending bounded stop or one more narrow pass | `docs/2026-04-27-famous-song-reconciliation-postfix-audit.md` |
| `REF-05` | Live reconciliation script | `server/scripts/get-context/reconcile-famous-song-phase1.cjs` |
| `REF-06` | Live reconciliation tests | `test/scripts/reconcile-famous-song-phase1.test.js` |
| `REF-07` | Current reconciled dialogue artifact with 3 remaining lyric lines | `output/cod-test/phase1-gather-context/dialogue-data.reconciled.json` |
| `REF-08` | Current reconciliation ledger | `output/cod-test/phase1-gather-context/famous-song-reconciliation.json` |

---

## Tasks

### Task 1: Implement one extra bounded reconciliation hop

**Bead ID:** `ee-qaz8`  
**SubAgent:** `primary`  
**Role:** `coder`  
**References:** `REF-02`, `REF-04`, `REF-05`, `REF-06`, `REF-07`, `REF-08`  
**Prompt:** Implement one extra bounded generic hop for recognized-song lyric contamination in `reconcile-famous-song-phase1.cjs`. Claim the bead on start. Keep it generic: no video-specific or song-specific logic. The new behavior should allow one additional local propagation step beyond the current first-hop direct-vocal-support promotion, but not open-ended chain walking. Add/update tests proving the second hop removes the remaining middle lyric lines in the generic sparse-anchor scenario while still preserving legitimate spoken neighbors and preventing unbounded propagation. Update this plan with exact implementation details, run relevant validation, commit/push by default, and close the bead when done.

**Folders Created/Deleted/Modified:**
- `server/`
- `test/`
- `.plans/`

**Files Created/Deleted/Modified:**
- `server/scripts/get-context/reconcile-famous-song-phase1.cjs`
- `test/scripts/reconcile-famous-song-phase1.test.js`
- `.plans/2026-04-27-bounded-second-hop-reconciliation-followup.md`

**Status:** ✅ Complete

**Results:** Added a `MAX_DIRECT_VOCAL_PROMOTION_HOPS = 2` bounded promotion path in `reconcileDialogue()` so low-confidence direct-vocal-supported lyric contamination can travel exactly one extra local hop beyond the existing first-hop behavior without turning into open-ended propagation. The patch keeps the recognized-song gate, low-confidence fence, lyric-like neighbor screening, and `reconcileMusicVocals()` behavior intact. Updated tests now prove: (1) sparse-anchor cleanup reaches a true second-hop middle lyric line, (2) propagation stops before a third hop, and (3) legitimate spoken neighbors still remain preserved. Validation run: `node --test test/scripts/reconcile-famous-song-phase1.test.js`.

---

### Task 2: Rerun cod-test after the bounded second hop

**Bead ID:** `ee-k8qa`  
**SubAgent:** `primary`  
**Role:** `qa`  
**References:** `REF-03`, `REF-05`, `REF-07`, `REF-08`  
**Prompt:** After the bounded second-hop fix lands, claim the bead and rerun the canonical `cod-test` pipeline. Compare the new reconciled dialogue result against both the prior post-fix run (`81.3 / 81.7 / extra_output_window_count 1`) and the earlier high-score baseline. Focus on whether the remaining three lyric lines are removed, whether any legitimate spoken lines are wrongly deleted, and whether the weak-line issue remains unchanged. Update this plan with exact commands, artifacts, and findings; write a concise QA note if useful; close the bead when done.

**Folders Created/Deleted/Modified:**
- `output/`
- `benchmarks/`
- `docs/`
- `.plans/`

**Files Created/Deleted/Modified:**
- fresh cod-test artifacts/reports
- optional QA note
- `.plans/2026-04-27-bounded-second-hop-reconciliation-followup.md`

**Status:** ⏳ Pending

**Results:** Pending.

---

### Task 3: Independent audit of the second-hop outcome

**Bead ID:** `ee-lang`  
**SubAgent:** `primary`  
**Role:** `auditor`  
**References:** `REF-03`, `REF-04`, `REF-05`, `REF-07`, `REF-08`  
**Prompt:** Independently audit the post-rerun outcome after the bounded second-hop reconciliation fix. Claim the bead on start. Verify whether the score change is real, whether the remaining lyric contamination was actually reduced for the right reason, whether legitimate spoken dialogue stayed intact, and whether the bounded-hop design is good enough to stop on before deeper Phase 2 architecture work. Update this plan with the verdict and close the bead when done.

**Folders Created/Deleted/Modified:**
- `docs/`
- `.plans/`

**Files Created/Deleted/Modified:**
- audit note if needed
- `.plans/2026-04-27-bounded-second-hop-reconciliation-followup.md`

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