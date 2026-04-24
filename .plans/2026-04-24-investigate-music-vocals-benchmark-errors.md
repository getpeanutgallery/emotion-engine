# Emotion Engine

**Date:** 2026-04-24  
**Status:** In Progress  
**Agent:** Cookie 🍪

---

## Goal

Investigate why `musicVocalsData` is still erroring in the benchmark and identify the highest-leverage non-prompt fixes to eliminate those errors and improve the music-vocals percentage surfaces.

---

## Overview

The benchmark architecture is now substantially cleaner: dialogue has separate raw and reconciled truth surfaces, score percentages are artifact-specific, and lyric leakage has dedicated regression coverage. With that plumbing in place, the remaining `musicVocalsData` errors are no longer acceptable as ambiguous benchmark noise — they are a focused investigation target.

Current cod-test reporting shows a mixed picture for music-vocals: song identity is correct, but transcript/support/structure remain weak. Specifically, `musicVocalsData` is still erroring with low transcript percentages, incomplete support, and structural misses. That strongly suggests a failure mode in reconciliation, segment ownership, chorus/repeat handling, support evidence shaping, or artifact-contract consistency rather than simple prompt wording.

This lane is explicitly an investigation-first pass. Before implementation, we should inspect the benchmark artifact output, truth surface, reconciliation logic, and error/failure details to isolate whether the main defect is in: (1) transcript capture coverage, (2) deterministic post-processing/reconciliation, (3) recognized-song support shaping, (4) vocal attribution/boundary logic, or (5) benchmark/truth contract mismatch.

---

## REFERENCES

| ID | Description | Path |
| --- | --- | --- |
| `REF-01` | Current cod benchmark summary with music-vocals error surfaces | `benchmarks/fixtures/cod-test/_reports/benchmark-summary.md` |
| `REF-02` | Current music-vocals artifact result surface | `benchmarks/fixtures/cod-test/_reports/artifact-results/musicVocalsData.json` |
| `REF-03` | Music-vocals truth fixture | `benchmarks/fixtures/cod-test/truth/music-vocals-data.json` |
| `REF-04` | Current runtime music-vocals output | `output/cod-test/phase1-gather-context/music-vocals-data.json` |
| `REF-05` | Current benchmark/scoring implementation | `server/lib/benchmark-runner.cjs` |
| `REF-06` | Current benchmark percentage-extension plan/results | `.plans/2026-04-24-extend-benchmark-percentages-and-add-lyric-leakage-regression.md` |
| `REF-07` | Memory note about music-vocals tradeoff surface and reconciliation investigation | `memory/2026-04-06.md` |

---

## Tasks

### Task 1: Audit why `musicVocalsData` is erroring and rank root-cause hypotheses

**Bead ID:** `ee-dn8s`  
**SubAgent:** `primary`  
**Role:** `research`  
**References:** `REF-01`, `REF-02`, `REF-03`, `REF-04`, `REF-05`, `REF-06`, `REF-07`  
**Prompt:** Audit the current cod-test `musicVocalsData` benchmark failure in depth. Inspect the truth fixture, current runtime output, artifact result JSON, benchmark summary, and relevant benchmark/reconciliation code. Determine exactly why the surface is still erroring. Separate likely causes into transcript coverage, boundary/segmentation, attribution, recognized-song support shaping, reconciliation/chorus-repeat handling, and benchmark-contract mismatch. Produce a concise investigation memo with concrete file-backed examples and a ranked list of the most likely non-prompt fixes.

**Folders Created/Deleted/Modified:**
- `docs/`
- `.plans/`

**Files Created/Deleted/Modified:**
- `docs/2026-04-24-music-vocals-benchmark-error-investigation.md`
- `.plans/2026-04-24-investigate-music-vocals-benchmark-errors.md`

**Status:** ✅ Complete

**Results:** Completed the investigation memo in `docs/2026-04-24-music-vocals-benchmark-error-investigation.md` after auditing the live cod benchmark summary/result surfaces, the truth fixture, the raw and reconciled music-vocals artifacts, the famous-song reconciliation ledger, the benchmark runner, the music-vocals artifact normalization code, the gather/reconciliation pipeline code, and `memory/2026-04-06.md`. Reran the benchmark locally against `configs/cod-test.yaml` and confirmed the current surface still resolves to `output/cod-test/phase1-gather-context/music-vocals-data.reconciled.json` and still errors with `vocal_text_full_transcript_pct=45.0`, `vocal_text_windowed_pct=44.9`, `vocal_boundary_pct=57.1`, `vocal_attribution_pct=55.6`, `recognized_song_identity_pct=100.0`, and `recognized_song_support_pct=0.0`. Main findings: the strongest semantic root cause is deterministic reconciliation using a bad `recognizedSong.matchedLyrics` scaffold, with the clearest smoking gun in `output/cod-test/phase1-gather-context/famous-song-reconciliation.json`, which records a correction from `Obey your master!` to `I'll be your master`; the output also over-segments/duplicates the chorus sequence (14 output segments vs 12 truth segments, 2 split events, 2 extra output windows, 3 missing truth windows); attribution remains generic (`Vocalist 1` / `sung`) where truth expects `Metallica lead vocal` / `chant` for some refrain windows; recognized-song identity is correct but support shaping is benchmark-empty because `matchedLyrics` is incomplete/wrong and `timeRanges` are absent; and the artifact is additionally inflated to `error` by contract drift such as output-only `vocal_segments[*].index` fields plus extra `recognitionNotes` / `qualityNotes` array items being treated as hard structural errors. Ranked best non-prompt fix lane: repair reconciliation and recognized-song support shaping first, then clean up the benchmark contract noise so remaining failures reflect real lyric/sequence truth misses instead of schema drift. References validated: `REF-01`, `REF-02`, `REF-03`, `REF-04`, `REF-05`, `REF-06`, `REF-07`.

---

### Task 2: Create execution plan for the chosen music-vocals fix lane

**Bead ID:** `ee-5i3w`  
**SubAgent:** `primary`  
**Role:** `research`  
**References:** `REF-01`, `REF-02`, `REF-03`, `REF-04`, `REF-05`, `REF-06`, `REF-07`  
**Prompt:** After Derrick reviews the investigation findings, convert the selected music-vocals fix direction into a concrete implementation plan with bead-ready tasks, validation steps, and expected files to change.

**Folders Created/Deleted/Modified:**
- `.plans/`

**Files Created/Deleted/Modified:**
- `.plans/2026-04-24-investigate-music-vocals-benchmark-errors.md`

**Status:** ⏳ Pending

**Results:** Pending.

---

## Final Results

**Status:** ⚠️ Partial

**What We Built:** Completed the investigation memo for the current `musicVocalsData` benchmark failure and updated this plan with the actual root-cause findings. The follow-on execution plan for the chosen fix lane is still pending Derrick review.

**Reference Check:** `REF-01` through `REF-07` were audited for Task 1. Task 2 is still pending.

**Commits:**
- None in this research lane.

**Lessons Learned:** `musicVocalsData` is failing for both honest semantic reasons and avoidable benchmark-contract noise. The benchmark now clearly shows that recognized-song identity is solved while lyric sequencing/support and reconciliation behavior are still the active defects.

---

*Completed on 2026-04-24*
