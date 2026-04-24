# Emotion Engine

**Date:** 2026-04-24  
**Status:** In Progress  
**Agent:** Cookie 🍪

---

## Goal

Add a dedicated lyric-leakage regression test and extend the new `% out of 100` benchmark reporting style across all remaining benchmark surfaces in peanut-gallery emotion engine.

---

## Overview

The dialogue scoring redesign is now landed and audited: transcript text, windowed text, and boundary fidelity are reported as separate percentages, with no composite or weighted master score. The next step is to harden that lane with a focused lyric-leakage regression and then generalize the percentage-reporting contract across the other benchmark surfaces so each golden-truth comparison answers its own question directly.

This execution lane should inventory all current benchmark artifact surfaces, define the clean percentage shape for each one, implement the report/code changes, and verify them against the cod-test fixture. The lyric-leakage regression should isolate the known contamination pattern so dialogue/text honesty cannot silently regress later.

---

## REFERENCES

| ID | Description | Path |
| --- | --- | --- |
| `REF-01` | Landed dialogue percentage-scoring plan and audit | `.plans/2026-04-24-dialogue-score-reconciliation-for-splits-and-merges.md` |
| `REF-02` | Dialogue split/merge scoring design doc | `docs/2026-04-24-dialogue-split-merge-scoring-options.md` |
| `REF-03` | Current benchmark manifest artifact inventory | `benchmarks/fixtures/cod-test/benchmark.json` |
| `REF-04` | Benchmark runner implementation | `server/lib/benchmark-runner.cjs` |
| `REF-05` | Benchmark tests | `test/lib/benchmark-runner.test.js` |

---

## Tasks

### Task 1: Design artifact-by-artifact percentage reporting and lyric-leakage regression shape

**Bead ID:** `ee-u2sw`  
**SubAgent:** `primary`  
**Role:** `research`  
**References:** `REF-01`, `REF-02`, `REF-03`, `REF-04`, `REF-05`  
**Prompt:** Audit the remaining benchmark artifact surfaces in peanut-gallery emotion engine and design how each should report its own `% out of 100` against golden truth without introducing a composite/master score. Include a focused design for a dedicated lyric-leakage regression fixture/test for dialogue contamination by music-vocals text. Write a concise implementation memo with artifact-by-artifact recommendations and exact proposed report fields/tests.

**Folders Created/Deleted/Modified:**
- `docs/`
- `.plans/`

**Files Created/Deleted/Modified:**
- `docs/2026-04-24-benchmark-percentage-extension-plan.md`
- `.plans/2026-04-24-extend-benchmark-percentages-and-add-lyric-leakage-regression.md`

**Status:** ✅ Complete

**Results:** Completed the research/design memo in `docs/2026-04-24-benchmark-percentage-extension-plan.md` after auditing the required context in `REF-01` through `REF-05`, the current cod manifest/report surfaces, and the current benchmark-runner comparator/test coverage. Recommended keeping generic `accuracyRate` / `coverageRate` only as low-level debug math while adding artifact-specific percentage blocks with no composite/master score: dialogue keeps the landed transcript/windowed/boundary trio; music should split into timeline/content/summary/recognized-song identity/support percentages; music-vocals should mirror dialogue for lyric text plus attribution and recognized-song identity/support percentages; recommendation should report separate text/reasoning/key-findings/suggestions/confidence percentages; metrics should report summary/implementation-status/averages/peak-moments/trends/friction-index percentages; emotional analysis should report summary/chunk-emotions/emotional-arc/scroll-risk-timeline/critical-moments/implementation-status percentages; and `chunkAnalysis` should use the same pattern whenever it is benchmarked again. Also designed a dedicated lyric-leakage regression fixture/test that benchmarks `dialogueData` and `musicVocalsData` together, keeps the vocals lane correct, injects lyric text into the dialogue lane as contamination, and asserts that dialogue percentages drop plus extra-output/structural leakage evidence surfaces while `musicVocalsData` still passes. References validated: `REF-01`, `REF-02`, `REF-03`, `REF-04`, `REF-05`. No code changes were made in this task; this is the implementation memo for the coder lane.

---

### Task 2: Implement lyric-leakage regression and extend percentage reporting across benchmark surfaces

**Bead ID:** `ee-0oi3`  
**SubAgent:** `primary`  
**Role:** `coder`  
**References:** `REF-01`, `REF-03`, `REF-04`, `REF-05`  
**Prompt:** Implement the approved benchmark-report changes so each benchmark artifact surface reports its own percentage out of 100 with no composite/master score. Add the dedicated lyric-leakage regression coverage for dialogue contamination by music-vocals text. Update report rendering/tests as needed, commit, and push.

**Folders Created/Deleted/Modified:**
- `server/`
- `test/`
- `docs/`
- `.plans/`

**Files Created/Deleted/Modified:**
- `server/lib/benchmark-runner.cjs`
- `test/lib/benchmark-runner.test.js`
- `benchmarks/fixtures/cod-test/_reports/`
- `docs/2026-04-24-benchmark-percentage-extension-plan.md`
- `.plans/2026-04-24-extend-benchmark-percentages-and-add-lyric-leakage-regression.md`

**Status:** ✅ Complete

**Results:** Implemented the approved artifact-specific percentage surfaces in `server/lib/benchmark-runner.cjs` with no composite/master score added. Dialogue kept the existing transcript/windowed/boundary trio intact. Added new scoring blocks for `musicData`, `musicVocalsData`, `recommendationData`, `metricsData`, `emotionalAnalysisData`, and `chunkAnalysisData`, surfaced them in per-artifact JSON summaries plus `benchmark-summary.md`, and regenerated the cod-test benchmark reports under `benchmarks/fixtures/cod-test/_reports/`. Added focused regression coverage in `test/lib/benchmark-runner.test.js` for each new scoring family plus a dedicated lyric-leakage fixture that injects music-vocals lyrics into the dialogue output, verifies the dialogue artifact fails with reduced dialogue percentages / contamination evidence, and verifies the music-vocals artifact still passes with preserved vocal scoring surfaces. Validation run: `node --test test/lib/benchmark-runner.test.js` (33/33 passing) and a direct cod benchmark rerun via `runBenchmarkStage(...)` against `output/cod-test`, which refreshed the cod report surfaces to show the new percentages (for example: dialogue `90.7/90.7/0.0`, music timeline/content/summary/song `35.3/13.3/0.0/66.7/9.1`, music-vocals text/boundary/attribution/song `45.0/44.9/57.1/55.6/100.0/0.0`, recommendation all `0.0`, metrics `50.0/0.0/0.0/0.0/0.0/0.0`, emotional `16.7/0.0/0.0/0.0/0.0/0.0`). References validated: `REF-01`, `REF-03`, `REF-04`, `REF-05`.

---

### Task 3: QA the new percentage surfaces on cod-test

**Bead ID:** `ee-6ejz`  
**SubAgent:** `primary`  
**Role:** `qa`  
**References:** `REF-03`, `REF-04`, `REF-05`  
**Prompt:** Verify on the cod-test fixture/report surfaces that every benchmark artifact now reports its own clear percentage out of 100, that no composite/master score was introduced, and that the new lyric-leakage regression coverage behaves as intended.

**Folders Created/Deleted/Modified:**
- `benchmarks/`
- `output/`
- `.plans/`

**Files Created/Deleted/Modified:**
- generated report surfaces as needed
- `.plans/2026-04-24-extend-benchmark-percentages-and-add-lyric-leakage-regression.md`

**Status:** ⏳ Pending

**Results:** Pending.

---

### Task 4: Independent audit of final benchmark percentage/reporting model

**Bead ID:** `ee-malo`  
**SubAgent:** `primary`  
**Role:** `auditor`  
**References:** `REF-01`, `REF-02`, `REF-03`, `REF-04`, `REF-05`  
**Prompt:** Independently audit the final benchmark reporting model. Confirm that each surface reports its own percentage out of 100, no composite/master score exists, lyric-leakage regression coverage is present, and the resulting report surfaces remain honest and debuggable.

**Folders Created/Deleted/Modified:**
- `docs/`
- `.plans/`

**Files Created/Deleted/Modified:**
- audit note if needed
- `.plans/2026-04-24-extend-benchmark-percentages-and-add-lyric-leakage-regression.md`

**Status:** ⏳ Pending

**Results:** Pending.

---

## Final Results

**Status:** ⏳ In Progress

**What We Built:** Pending.

**Reference Check:** Pending.

**Commits:**
- Pending

**Lessons Learned:** Pending.

---

*Completed on 2026-04-24*
