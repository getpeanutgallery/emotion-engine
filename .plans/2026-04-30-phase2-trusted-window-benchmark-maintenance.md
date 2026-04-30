# Peanut Gallery Emotion Engine

**Date:** 2026-04-30  
**Status:** Draft  
**Agent:** Cookie 🍪

---

## Goal

Refresh the Phase 2 benchmark/truth surfaces only for the chunk windows that now look visually trustworthy, while explicitly excluding chunks that still appear contaminated by untimestamped dialogue/music/music-vocals support.

---

## Overview

The repaired Phase 2 lane now completes cleanly and produces chunk-local outputs that look materially correct across much of the trailer, especially the later promo/endcard region. The latest forensic pass showed that the biggest remaining problem is not transport or chunk corruption; it is that benchmark truth has drifted behind the repaired live lane. However, the same forensic pass also showed a small set of chunks where the live output still appears contaminated by untimestamped support context or generic reasoning.

That means the safest next slice is not a blanket benchmark refresh. Instead, we should split the Phase 2 artifact into two groups. The **trusted window set** becomes eligible for benchmark maintenance because the visuals and summaries now align well enough to treat the fresh live output as a useful truth-maintenance input. The **skepticism shortlist** stays frozen and out of scope until a later prompt-discipline / grounding cleanup pass reduces support-context contamination.

This plan therefore focuses on updating benchmark/truth for the trusted windows only, then validating that the refreshed benchmark better reflects the repaired Phase 2 lane without laundering known-problem chunks into truth. The plan also requires explicit documentation of which chunks were intentionally excluded and why.

---

## REFERENCES

| ID | Description | Path |
| --- | --- | --- |
| `REF-01` | Forensic benchmark-vs-live-output plan and findings | `.plans/2026-04-30-phase2-forensic-benchmark-vs-live-output.md` |
| `REF-02` | Fresh live Phase 2 chunk analysis artifact | `output/cod-test/phase2-process/chunk-analysis.json` |
| `REF-03` | Current benchmark summary after repaired live rerun | `benchmarks/fixtures/cod-test/_reports/benchmark-summary.json` |
| `REF-04` | Phase 2 benchmark truth/result detail for chunk analysis | `benchmarks/fixtures/cod-test/_reports/artifact-results/chunkAnalysis.json` |
| `REF-05` | Fresh chunk-local extracted assets for trust checks | `output/cod-test/assets/processed/chunks/` |

---

## Tasks

### Task 1: Define the trusted-window benchmark maintenance set and exclusions

**Bead ID:** `ee-ym4w`  
**SubAgent:** `primary` (for `research` workflow role)  
**Role:** `research`  
**References:** `REF-01`, `REF-02`, `REF-03`, `REF-04`, `REF-05`  
**Prompt:** Define the exact Phase 2 trusted-window set that is safe for benchmark maintenance. Claim the assigned bead on start with `bd update <BEAD_ID> --status in_progress --json`. Produce a chunk/range map that separates: (a) chunks safe to use for benchmark refresh, and (b) chunks explicitly excluded because of support-context contamination or generic reasoning. Include concise justifications and artifact anchors. Do not modify benchmark files yet.  

**Folders Created/Deleted/Modified:**
- `.plans/`
- `benchmarks/fixtures/cod-test/_reports/`
- `output/cod-test/phase2-process/`

**Files Created/Deleted/Modified:**
- `.plans/2026-04-30-phase2-trusted-window-benchmark-maintenance.md`
- trust-mapping notes/artifact references used during execution

**Status:** ✅ Complete

**Results:** Trusted-window map defined. Safe for benchmark refresh: `3-4, 8-15, 17, 22-27`. Explicitly excluded from this maintenance slice: `0-2, 5-7, 16, 18-21`. Borderline notes: chunk `2` remains excluded because the opening window is still too contaminated/generic; chunk `16` remains excluded because the live artifact itself admits weak chunk-local grounding; chunks `19-20` remain excluded because summaries are too generic; chunk `26` is the most borderline member of the trusted set but remains usable because its visuals and summary are still directionally aligned, while chunk `27` is strongly anchored by the Xbox-logo ending.

---

### Task 2: Refresh Phase 2 benchmark truth for trusted windows only

**Bead ID:** `ee-q0be`  
**SubAgent:** `primary` (for `coder` workflow role)  
**Role:** `coder`  
**References:** `REF-02`, `REF-04`, `REF-05`  
**Prompt:** Refresh the Phase 2 benchmark/truth surfaces only for the trusted chunk windows approved in Task 1. Claim the assigned bead on start with `bd update <BEAD_ID> --status in_progress --json`. Update the relevant benchmark/truth artifact(s) so they reflect the repaired live Phase 2 lane for trusted windows, while explicitly preserving or flagging excluded chunks instead of laundering them into truth. Document each changed chunk/range and why it was changed. Run relevant validation and benchmark/report regeneration needed to prove the truth surfaces remain coherent. Commit/push by default before QA handoff.  

**Folders Created/Deleted/Modified:**
- `benchmarks/fixtures/cod-test/`
- `.plans/`

**Files Created/Deleted/Modified:**
- benchmark truth files backing Phase 2 chunk-analysis expectations
- any benchmark report fixtures or metadata necessarily regenerated by the bounded truth refresh
- `.plans/2026-04-30-phase2-trusted-window-benchmark-maintenance.md`

**Status:** ✅ Complete

**Results:** Refreshed `benchmarks/fixtures/cod-test/truth/chunk-analysis.json` only for approved chunk indexes `3,4,8,9,10,11,12,13,14,15,17,22,23,24,25,26,27` using the current repaired live artifact at `output/cod-test/phase2-process/chunk-analysis.json`. Excluded chunks `0-2, 5-7, 16, 18-21` were intentionally left untouched to preserve the quarantine boundary. Added `benchmarks/fixtures/cod-test/review/2026-04-30-phase2-trusted-window-benchmark-maintenance-note.md` documenting the exact refreshed windows, excluded windows, and the bounded rationale. Also repaired the stale top-level `persona.config.chunkDuration` value from `8` to `5` so the truth surface matches the actual 5-second chunk contract without normalizing excluded semantic windows. Regenerated benchmark report surfaces via the cod-test benchmark runner; `chunkAnalysis` report accuracy improved from `0.6685` (`361/540` passed, `chunk_summary_pct=0`, `chunk_emotion_scores_pct=31`) to `0.8481` (`458/540` passed, `chunk_summary_pct=60.7`, `chunk_emotion_scores_pct=69`) while the remaining failures stay concentrated in the intentionally excluded skepticism windows and neighboring untouched slices. Validation run: `npm run test:validate-json` ✅.

---

### Task 3: QA refreshed benchmark against the repaired live Phase 2 lane

**Bead ID:** `ee-0ttj`  
**SubAgent:** `primary` (for `qa` workflow role)  
**Role:** `qa`  
**References:** `REF-02`, `REF-03`, `REF-04`, `REF-05`  
**Prompt:** QA the trusted-window benchmark maintenance update. Claim the assigned bead on start with `bd update <BEAD_ID> --status in_progress --json`. Re-run the bounded cod-test benchmark lane and inspect whether the updated benchmark now better reflects the repaired live Phase 2 outputs for the trusted windows, while excluded skepticism chunks remain clearly excluded or still failing for expected reasons. Record exact commands, artifact paths, and any score movement.  

**Folders Created/Deleted/Modified:**
- `.logs/`
- `benchmarks/fixtures/cod-test/_reports/`
- `output/cod-test/`

**Files Created/Deleted/Modified:**
- fresh benchmark summary/report artifacts
- fresh run logs
- `.plans/2026-04-30-phase2-trusted-window-benchmark-maintenance.md`

**Status:** ⏳ Pending

**Results:** Pending.

---

### Task 4: Independent audit of benchmark maintenance boundaries and results

**Bead ID:** `ee-25yz`  
**SubAgent:** `primary` (for `auditor` workflow role)  
**Role:** `auditor`  
**References:** `REF-01`, `REF-02`, `REF-03`, `REF-04`, `REF-05`  
**Prompt:** Independently audit the trusted-window benchmark maintenance slice. Claim the assigned bead on start with `bd update <BEAD_ID> --status in_progress --json`. Verify that only the approved trusted windows were refreshed, that excluded skepticism chunks were not silently normalized into truth, and that the resulting benchmark movement is honest. If the slice passes, close the bead with a precise reason. If not, report the exact boundary violation or quality issue.  

**Folders Created/Deleted/Modified:**
- `.plans/`

**Files Created/Deleted/Modified:**
- `.plans/2026-04-30-phase2-trusted-window-benchmark-maintenance.md`

**Status:** ⏳ Pending

**Results:** Pending.

---

### Task 5: Research timestamp-resolution tooling path for dialogue and music-vocals against video

**Bead ID:** `ee-6j21`  
**SubAgent:** `primary` (for `research` workflow role)  
**Role:** `research`  
**References:** `REF-01`, `REF-02`, `REF-05`  
**Prompt:** Research a likely tooling path to resolve accurate timestamps for already-extracted dialogue and music-vocals against the source video or its audio. Claim bead `ee-6j21` on start with `bd update ee-6j21 --status in_progress --json`. Focus on practical paths such as forced alignment, subtitle alignment, ASR alignment, lyric/vocal alignment, or audio-text synchronization tools that could take known text plus the media and return timestamps. Prioritize approaches that could realistically fit the Emotion Engine Phase 1/Phase 2 pipeline and work on mixed dialogue/music-vocals content. Produce an options review with likely best path, implementation complexity, and risks. Do not implement in this task.  

**Folders Created/Deleted/Modified:**
- `.plans/`

**Files Created/Deleted/Modified:**
- `.plans/2026-04-30-phase2-trusted-window-benchmark-maintenance.md`

**Status:** ⏳ Pending

**Results:** Pending.

---

## Final Results

**Status:** ⚠️ Partial

**What We Built:** Draft plan created; execution not started yet.

**Reference Check:** `REF-01` defines the forensic trust model and skepticism shortlist. `REF-02` through `REF-05` define the live-output, benchmark, and chunk-asset surfaces to use during truth maintenance.

**Commits:**
- Pending

**Lessons Learned:** A repaired live lane is not permission to rewrite all truth. Refresh only the windows that are visually trustworthy, and quarantine contaminated chunks until their own cleanup slice.

---

*Completed on 2026-04-30*
