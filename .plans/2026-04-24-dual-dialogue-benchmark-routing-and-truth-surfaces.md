# Emotion Engine

**Date:** 2026-04-24  
**Status:** In Progress  
**Agent:** Cookie 🍪

---

## Goal

Implement dual dialogue benchmark truth/routing so raw dialogue capture is compared against a raw/mixed gold surface, while reconciled spoken dialogue is compared against a vocals-stripped spoken-dialogue gold surface, with the reconciled surface treated as the primary product-facing dialogue benchmark.

---

## Overview

The current benchmark/reporting work exposed an architectural mismatch rather than a prompt problem. Derrick clarified that the dialogue AI is intentionally allowed to capture sung lyrics during the initial/raw dialogue pass because earlier attempts to suppress sung material too early caused real spoken dialogue to be lost. The intended cleanup point is the later reconciliation pass, where dialogue is compared against sung vocals and stripped of lyric lines there.

That means the benchmark needs to represent two valid dialogue states: (1) raw/original dialogue capture, which may legitimately include sung-vocal text, and (2) reconciled spoken dialogue, which should have sung-vocal text removed and is the artifact we care about most downstream. If only one truth surface exists, one of those states will always look artificially wrong. The fix is to add/route the right output to the right truth surface and make the reconciled spoken-dialogue score the primary dialogue benchmark Derrick uses.

This lane is benchmark/truth routing cleanup, not prompt work. It should define the dual truth artifacts, implement benchmark manifest/report routing for both surfaces, preserve debuggability, and verify that raw dialogue remains a useful diagnostic while reconciled dialogue becomes the primary truthful spoken-dialogue benchmark.

---

## REFERENCES

| ID | Description | Path |
| --- | --- | --- |
| `REF-01` | Current benchmark percentage extension plan/results | `.plans/2026-04-24-extend-benchmark-percentages-and-add-lyric-leakage-regression.md` |
| `REF-02` | Dialogue split/merge scoring plan/results | `.plans/2026-04-24-dialogue-score-reconciliation-for-splits-and-merges.md` |
| `REF-03` | Benchmark manifest/artifact inventory | `benchmarks/fixtures/cod-test/benchmark.json` |
| `REF-04` | Current benchmark summary/report surfaces | `benchmarks/fixtures/cod-test/_reports/benchmark-summary.md` |
| `REF-05` | Benchmark runner implementation | `server/lib/benchmark-runner.cjs` |
| `REF-06` | Dialogue-vs-benchmark audit showing current drift and routing assumptions | `docs/2026-04-24-current-dialogue-vs-benchmark-audit.md` |
| `REF-07` | Memory note confirming reconciled dialogue routing and removal of leaked song mashup before scoring | `memory/2026-04-20.md` |

---

## Tasks

### Task 1: Design dual dialogue truth surfaces and benchmark routing

**Bead ID:** `ee-ekpr`  
**SubAgent:** `primary`  
**Role:** `research`  
**References:** `REF-01`, `REF-02`, `REF-03`, `REF-04`, `REF-05`, `REF-06`, `REF-07`  
**Prompt:** Design the dual-surface dialogue benchmark model for emotion-engine. Define: (1) raw/original dialogue capture truth that may include sung-vocal contamination, (2) reconciled spoken-dialogue truth with sung-vocal text stripped, (3) benchmark manifest/report routing so raw output compares to raw truth and reconciled output compares to reconciled truth, and (4) which surface should be primary vs diagnostic in reports. Inspect the current benchmark manifest, runner, report surfaces, and relevant docs/memory. Write a concise implementation memo with exact proposed truth files, manifest entries, report naming, backward-compatibility notes, and validation strategy.

**Folders Created/Deleted/Modified:**
- `docs/`
- `.plans/`

**Files Created/Deleted/Modified:**
- `docs/2026-04-24-dual-dialogue-benchmark-routing-plan.md`
- `.plans/2026-04-24-dual-dialogue-benchmark-routing-and-truth-surfaces.md`

**Status:** ✅ Complete

**Results:** Completed the research/design memo in `docs/2026-04-24-dual-dialogue-benchmark-routing-plan.md` after auditing the live cod-test benchmark manifest, benchmark summary surfaces, phase-1 artifact resolver, benchmark runner, current dialogue audit, earlier scoring/percentage plans, and the memory note in `memory/2026-04-20.md`. Recommendation: keep `benchmarks/fixtures/cod-test/truth/dialogue-data.json` as the **primary reconciled spoken-dialogue truth**, add `benchmarks/fixtures/cod-test/truth/dialogue-data.raw.json` as the **diagnostic raw/mixed dialogue truth**, preserve `artifactKey: dialogueData` as the primary benchmark/report lane, and add a second diagnostic artifact such as `artifactKey: dialogueDataRaw` that points at the same runtime family (`dialogueV3SourceTruth`) but forces the **raw** runtime surface instead of the reconciled one. Also identified the key implementation blocker in current code: `server/lib/phase1-baseline-resolution.cjs` only supports canonical auto-selection of reconciled outputs when famous-song reconciliation is configured, so the manifest/runner must gain explicit per-artifact routing (for example `benchmarkRouting.runtimeArtifactSurface = raw|reconciled|canonical`) to let raw and reconciled dialogue benchmark independently against their corresponding truth surfaces. Recommended report model: reconciled spoken-dialogue benchmark is the **primary** top-line dialogue report, raw capture is **diagnostic** and rendered second with explicit labeling; keep the existing dialogue scoring fields (`dialogue_text_full_transcript_pct`, `dialogue_text_windowed_pct`, `dialogue_boundary_pct`) on both surfaces. Backward-compatibility recommendation: do not rename `dialogueData` or `truth/dialogue-data.json`; add the raw diagnostic lane instead of replacing the current primary one. References validated: `REF-01`, `REF-02`, `REF-03`, `REF-04`, `REF-05`, `REF-06`, `REF-07`. No code changes were made in this research task; this is the implementation handoff for the coder lane.

---

### Task 2: Implement dual truth/routing/report surfaces

**Bead ID:** `ee-yl3m`  
**SubAgent:** `primary`  
**Role:** `coder`  
**References:** `REF-01`, `REF-02`, `REF-03`, `REF-04`, `REF-05`  
**Prompt:** Implement the approved dual dialogue benchmark truth/routing model. Add the dual benchmark surfaces so raw/original dialogue compares against raw/mixed truth, reconciled dialogue compares against spoken-dialogue truth, and the reconciled surface is clearly primary in report rendering. Update manifest/truth/report/test code as needed. Preserve the landed percentage scoring blocks. Commit and push unless blocked.

**Folders Created/Deleted/Modified:**
- `benchmarks/`
- `server/`
- `test/`
- `docs/`
- `.plans/`

**Files Created/Deleted/Modified:**
- `benchmarks/...`
- `server/...`
- `test/...`
- `docs/...`
- `.plans/2026-04-24-dual-dialogue-benchmark-routing-and-truth-surfaces.md`

**Status:** ✅ Complete

**Results:** Implemented the approved dual-surface dialogue benchmark model. `benchmarks/fixtures/cod-test/benchmark.json` now keeps `dialogueData` as the primary reconciled spoken-dialogue lane (routed to `dialogue-v3-source-truth.reconciled.json` against `truth/dialogue-data.json`) and adds `dialogueDataRaw` as a diagnostic raw-capture lane (routed to `dialogue-v3-source-truth.json` against new `truth/dialogue-data.raw.json`). `server/lib/phase1-baseline-resolution.cjs` gained explicit per-artifact runtime surface selection (`raw|reconciled|canonical`) so multiple benchmark entries can share one runtime artifact family cleanly, and `server/lib/benchmark-runner.cjs` now validates that routing metadata, passes it into artifact resolution, preserves the landed dialogue percentage scoring blocks on both surfaces, and renders benchmark summary labels so the reconciled lane is explicitly the primary spoken benchmark while raw capture is explicitly diagnostic. Added regression coverage in `test/lib/benchmark-runner.test.js` for shared runtime-family dual-surface routing plus explicit report ordering/labels, and added focused resolver coverage in new `test/lib/phase1-baseline-resolution.test.js`. Regenerated the cod-test benchmark reports: the primary reconciled spoken lane still fails at 36.1% accuracy / 96.6% coverage (expected existing drift), while the diagnostic raw lane now passes 100% against the raw truth surface. Validation run: `node --test test/lib/phase1-baseline-resolution.test.js test/lib/benchmark-runner.test.js`; broader `npm test` still shows pre-existing unrelated repo failures outside this change set (missing configs and legacy failing suites already present in the branch), but the touched benchmark/resolver coverage passes.

---

### Task 3: QA dual dialogue benchmark routing on cod-test

**Bead ID:** `ee-0kjg`  
**SubAgent:** `primary`  
**Role:** `qa`  
**References:** `REF-03`, `REF-04`, `REF-05`, `REF-06`  
**Prompt:** Verify on cod-test that raw/original dialogue is benchmarked against the raw/mixed truth surface, reconciled dialogue is benchmarked against the spoken-dialogue truth surface, and reports clearly distinguish diagnostic raw capture from primary reconciled spoken-dialogue benchmarking. Confirm the percentages and artifact labels make sense.

**Folders Created/Deleted/Modified:**
- `benchmarks/`
- `output/`
- `.plans/`

**Files Created/Deleted/Modified:**
- generated report surfaces as needed
- `.plans/2026-04-24-dual-dialogue-benchmark-routing-and-truth-surfaces.md`

**Status:** ⏳ Pending

**Results:** Pending.

---

### Task 4: Independent audit of final dual-surface benchmark model

**Bead ID:** `ee-adi2`  
**SubAgent:** `primary`  
**Role:** `auditor`  
**References:** `REF-01`, `REF-02`, `REF-03`, `REF-04`, `REF-05`, `REF-06`, `REF-07`  
**Prompt:** Independently audit the dual dialogue benchmark truth/routing model. Confirm raw dialogue capture and reconciled spoken-dialogue are benchmarked against the correct corresponding truth surfaces, reports clearly mark which is primary vs diagnostic, and the implementation reflects Derrick’s architecture choice without reintroducing prompt-side suppression assumptions.

**Folders Created/Deleted/Modified:**
- `docs/`
- `.plans/`

**Files Created/Deleted/Modified:**
- audit note if needed
- `.plans/2026-04-24-dual-dialogue-benchmark-routing-and-truth-surfaces.md`

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
