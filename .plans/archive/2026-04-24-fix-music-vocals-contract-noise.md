# Emotion Engine

**Date:** 2026-04-24  
**Status:** In Progress  
**Agent:** Cookie 🍪

---

## Goal

Remove structural contract noise from the `musicVocalsData` benchmark surface so output-only scaffold fields stop causing `error` status, while real semantic music-vocals failures remain visible.

---

## Overview

The no-lyric-repair architecture is now landed and the benchmark has been refreshed, which makes the remaining `musicVocalsData` status easier to interpret. Right now the surface is still `error` not only because of real lyric/segmentation problems, but also because of structural contract noise: output-only `vocal_segments[*].index` fields and extra `recognitionNotes` / `qualityNotes` array items are being treated as structural errors.

That means the benchmark is mixing two different concerns. We do want semantic truth misses to remain visible: wrong lyric text, wrong sequence, extra windows, missing windows, weak support shaping, and attribution mistakes should still fail the artifact honestly. But we do not want scaffold-only fields or extra descriptive note strings to turn the whole surface into `error` when they are not the core product truth.

This lane should clean up that contract noise in the benchmark/comparator path or output shaping path — whichever is more honest and maintainable — while preserving a truthful semantic signal. The likely desired outcome is that `musicVocalsData` becomes a clean `fail` until actual lyric/support/segmentation quality improves, rather than an `error` caused by structural extras.

---

## REFERENCES

| ID | Description | Path |
| --- | --- | --- |
| `REF-01` | Current refreshed music-vocals artifact result surface | `benchmarks/fixtures/cod-test/_reports/artifact-results/musicVocalsData.json` |
| `REF-02` | Current benchmark summary | `benchmarks/fixtures/cod-test/_reports/benchmark-summary.md` |
| `REF-03` | Music-vocals truth fixture | `benchmarks/fixtures/cod-test/truth/music-vocals-data.json` |
| `REF-04` | Benchmark runner/comparator implementation | `server/lib/benchmark-runner.cjs` |
| `REF-05` | Recent no-lyric-repair plan/results | `.plans/2026-04-24-remove-canonical-lyric-repair-from-music-vocals.md` |

---

## Tasks

### Task 1: Design contract-noise cleanup for music-vocals benchmarking

**Bead ID:** `ee-7es7`  
**SubAgent:** `primary`  
**Role:** `research`  
**References:** `REF-01`, `REF-02`, `REF-03`, `REF-04`, `REF-05`  
**Prompt:** Audit the current `musicVocalsData` structural errors and design the cleanest fix for contract noise. Determine whether output-only `vocal_segments[*].index`, extra `recognitionNotes`, and extra `qualityNotes` should be ignored benchmark-side, stripped output-side, normalized before comparison, or folded into a looser note-handling contract. Recommend the most honest approach that removes structural noise without hiding real semantic misses. Write a concise memo with exact proposed changes and validation strategy.

**Folders Created/Deleted/Modified:**
- `docs/`
- `.plans/`

**Files Created/Deleted/Modified:**
- `docs/2026-04-24-music-vocals-contract-noise-plan.md`
- `.plans/2026-04-24-fix-music-vocals-contract-noise.md`

**Status:** ✅ Complete

**Results:** Research/design completed. Inspected REF-01 through REF-05 plus the current runtime artifact shape in `output/cod-test/phase1-gather-context/music-vocals-data.reconciled.json` and the normalization path in `server/lib/structured-output.cjs`. Wrote `docs/2026-04-24-music-vocals-contract-noise-plan.md` with the implementation-ready recommendation: treat `vocal_segments[*].index` as benchmark-ignored scaffold metadata, and handle `recognitionNotes` / `qualityNotes` with benchmark-side truth-subset fuzzy matching so missing benchmark-expected notes still fail but extra diagnostic notes no longer create structural `error`. Strongest evidence: the current artifact report shows 20 `error` fields, of which 12 are output-only `index` fields and 8 are extra note-array entries, while real semantic misses already remain visible independently in lyric/support/time-range failures.

---

### Task 2: Implement music-vocals contract-noise cleanup

**Bead ID:** `ee-rb8c`  
**SubAgent:** `primary`  
**Role:** `coder`  
**References:** `REF-01`, `REF-03`, `REF-04`, `REF-05`  
**Prompt:** Implement the approved contract-noise cleanup so `musicVocalsData` is no longer marked `error` because of output-only scaffold fields or extra note-array items, while preserving real semantic music-vocals failures. Update tests, regenerate the benchmark surface, commit, and push unless blocked.

**Folders Created/Deleted/Modified:**
- `server/`
- `test/`
- `benchmarks/`
- `.plans/`

**Files Created/Deleted/Modified:**
- `server/lib/benchmark-runner.cjs`
- `test/lib/benchmark-runner.test.js`
- `benchmarks/fixtures/cod-test/_reports/artifact-results/musicVocalsData.json`
- `benchmarks/fixtures/cod-test/_reports/benchmark-summary.json`
- `benchmarks/fixtures/cod-test/_reports/benchmark-summary.md`
- `.plans/2026-04-24-fix-music-vocals-contract-noise.md`

**Status:** ✅ Complete

**Results:** Implemented the benchmark-side cleanup in `server/lib/benchmark-runner.cjs` and added focused regressions in `test/lib/benchmark-runner.test.js`. The `music-vocals-default` comparator now ignores `$.vocal_segments[*].index`, and `recognitionNotes` / `qualityNotes` now use truth-subset fuzzy support matching with extra output notes downgraded to `ignoredDifference` while missing benchmark-covered notes still fail. Re-ran `node --test test/lib/benchmark-runner.test.js` (36/36 passing) and regenerated the cod-test benchmark surface with a direct `runBenchmarkStage` pass using `configs/cod-test.yaml`. REF-01 / REF-02 now show `musicVocalsData` as `fail` with `erroredFields: 0` and `ignoredDifferenceFields: 51`; the remaining failures are semantic lyric/support/window issues, not contract-noise scaffold mismatches.

---

### Task 3: QA refreshed music-vocals surface after contract cleanup

**Bead ID:** `ee-oksb`  
**SubAgent:** `primary`  
**Role:** `qa`  
**References:** `REF-01`, `REF-02`, `REF-03`, `REF-04`  
**Prompt:** Verify that the refreshed `musicVocalsData` benchmark surface no longer shows structural `error` due to `index` or extra note fields, and confirm the remaining failures are genuine semantic misses. Regenerate cod-test benchmark/report surfaces as needed and record the before/after outcome.

**Folders Created/Deleted/Modified:**
- `benchmarks/`
- `.plans/`

**Files Created/Deleted/Modified:**
- refreshed report surfaces
- `.plans/2026-04-24-fix-music-vocals-contract-noise.md`

**Status:** ⏸️ Deferred at session stop

**Results:** Not executed before landing the plane. Expected quick verification next session: confirm `musicVocalsData` remains `fail` with `erroredFields: 0` after the contract-noise cleanup commit and benchmark regeneration, and verify the remaining red is semantic only.

---

### Task 4: Independent audit of final music-vocals contract cleanup

**Bead ID:** `ee-qvds`  
**SubAgent:** `primary`  
**Role:** `auditor`  
**References:** `REF-01`, `REF-02`, `REF-03`, `REF-04`, `REF-05`  
**Prompt:** Independently audit the contract-noise cleanup. Confirm structural scaffold fields and extra note items no longer drive `musicVocalsData` into `error`, and verify the resulting surface still exposes real music-vocals semantic failures honestly.

**Folders Created/Deleted/Modified:**
- `docs/`
- `.plans/`

**Files Created/Deleted/Modified:**
- audit note if needed
- `.plans/2026-04-24-fix-music-vocals-contract-noise.md`

**Status:** ⏸️ Deferred at session stop

**Results:** Not executed before landing the plane. Expected after QA confirms the refreshed artifact surface.

---

## Final Results

**Status:** ⚠️ Partial

**What We Built:** Completed the design and implementation for music-vocals contract-noise cleanup so output-only `vocal_segments[*].index` and extra note-array verbosity no longer need to drive `musicVocalsData` into `error`. The implementation landed benchmark-side in `server/lib/benchmark-runner.cjs`, refreshed the cod-test report surface, and moved `musicVocalsData` from noisy `error` toward a cleaner semantic `fail`. QA and audit are deferred to the next session.

**Reference Check:** `REF-01` through `REF-05` were used for design/implementation. Final QA/audit verification remains pending.

**Commits:**
- `730629d` - Clean up music vocals benchmark contract noise

**Lessons Learned:** Treating output-only scaffold fields and extra diagnostic note strings as hard structural errors makes the benchmark less useful. Truth-subset note matching plus ignored scaffold metadata yields a much cleaner signal without hiding real lyric/support/sequence failures.

---

*Completed on 2026-04-24*
