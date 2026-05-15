# Peanut Gallery Emotion Engine

**Date:** 2026-05-14  
**Status:** Draft  
**Agent:** Cookie 🍪

---

## Goal

Refresh the `cod-test` Phase 3 benchmark truth fixtures so they evaluate the currently repaired, truthful Phase 3 outputs against the current canonical Phase 2 packet instead of forcing runtime outputs back toward stale expectations.

---

## Overview

The Phase 3 repair lane is now complete enough to separate two different truths. First truth: the live Phase 3 consumers were genuinely stale in one narrow but important way — exact upstream score `1` was being treated like normalized `1.0`, which fabricated boredom peaks and corrupted emotional-analysis output. That bug has now been repaired, the final report is materially more honest, and QA/audit both concluded that the repaired Phase 3 packet is useful and truthful for the current pipeline state.

Second truth: the benchmark is still loudly red, but the latest validation and audit make clear that most of that remaining red is no longer evidence of broken live report logic. Instead, the benchmark truth fixtures for `metrics`, `emotional-analysis`, and much of `recommendation` still encode older packet semantics. In other words, the benchmark is currently rewarding the old wrong story more than the current honest one.

So the next lane should not be another broad report-logic rewrite. It should be a benchmark-truth refresh lane that updates the Phase 3 truth fixtures against the current repaired `phase2-process/chunk-analysis.json` packet and the current repaired Phase 3 outputs. After that refresh, we should rerun the benchmark and QA/audit whether the benchmark is finally aligned with current product truth. A small chunk-numbering consistency cleanup may be worth folding in if it materially helps the truth-fixture rewrite, but it is secondary to restoring honest benchmark expectations.

---

## REFERENCES

| ID | Description | Path |
| --- | --- | --- |
| `REF-01` | Completed Phase 3 repair plan and its final results | `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/.plans/2026-05-14-phase3-repair-after-phase1-phase2-drift.md` |
| `REF-02` | Final Phase 3 audit confirming live outputs are truthfully repaired | `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/.plans/artifacts/2026-05-14-phase3-repair-after-phase1-phase2-drift/audit-summary.md` |
| `REF-03` | Current benchmark summary still showing Phase 3 classes red | `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/benchmarks/fixtures/cod-test/_reports/benchmark-summary.md` |
| `REF-04` | Current benchmark JSON details for failing Phase 3 classes | `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/benchmarks/fixtures/cod-test/_reports/benchmark-summary.json` |
| `REF-05` | Current repaired Phase 2 packet that should anchor refreshed truth | `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/output/cod-test/phase2-process/chunk-analysis.json` |
| `REF-06` | Current repaired metrics output | `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/output/cod-test/phase3-report/metrics/metrics.json` |
| `REF-07` | Current repaired emotional-analysis output | `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/output/cod-test/phase3-report/emotional-analysis/emotional-data.json` |
| `REF-08` | Current repaired recommendation output | `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/output/cod-test/phase3-report/recommendation/recommendation.json` |
| `REF-09` | Current repaired final markdown report | `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/output/cod-test/phase3-report/summary/FINAL-REPORT.md` |
| `REF-10` | Historical memory note for earlier benchmark-truth generation discipline | `/home/derrick/.openclaw/workspace/memory/2026-05-04.md` |

---

## Tasks

### Task 1: Forensic design of the Phase 3 benchmark-truth refresh surface

**Bead ID:** `ee-hoqm`  
**SubAgent:** `primary` (for `research` workflow role)  
**Role:** `research`  
**References:** `REF-01`, `REF-02`, `REF-03`, `REF-04`, `REF-05`, `REF-06`, `REF-07`, `REF-08`, `REF-09`, `REF-10`  
**Prompt:** `Design the benchmark-truth refresh lane for the current repaired Phase 3 packet. Determine exactly which truth fixtures and acceptance surfaces should change for metrics, emotional-analysis, and recommendation; which old expectations should be retired; and whether semantic/structural matcher changes are needed or if fixture refresh alone is sufficient. Produce a durable forensic note that defines the refresh order and the exact files to touch. Claim the bead on start and close it on completion.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `.plans/artifacts/2026-05-14-phase3-benchmark-truth-refresh/`
- `benchmarks/fixtures/cod-test/` (inspection only)
- `output/` (inspection only)

**Files Created/Deleted/Modified:**
- `.plans/2026-05-14-phase3-benchmark-truth-refresh.md`
- `.plans/artifacts/2026-05-14-phase3-benchmark-truth-refresh/forensic-note.md`

**Status:** ✅ Complete

**Results:** Created `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/.plans/artifacts/2026-05-14-phase3-benchmark-truth-refresh/forensic-note.md` after checking the benchmark summary, artifact-result diffs, repaired Phase 2 packet, repaired Phase 3 outputs, final markdown report, and the earlier audit/memory references. The note concludes that the remaining red is dominated by stale truth fixtures, not an active matcher bug. It defines the refresh order as `metrics` → `emotional-analysis` → `recommendation`, names the stale expectations that should be retired, and limits the direct edit surface to the three truth files under `benchmarks/fixtures/cod-test/truth/` plus this plan. It also records that fixture refresh alone is sufficient for the current repaired packet; comparator changes in `server/lib/benchmark-runner.cjs` or `benchmarks/fixtures/cod-test/benchmark.json` are not required for this lane and should only be considered later as optional recommendation-acceptance hardening.

---

### Task 2: Refresh Phase 3 truth fixtures and any narrow matcher assumptions

**Bead ID:** `ee-ss40`  
**SubAgent:** `primary` (for `coder` workflow role)  
**Role:** `coder`  
**References:** `REF-03`, `REF-04`, `REF-05`, `REF-06`, `REF-07`, `REF-08`, `REF-09`, `REF-10`  
**Prompt:** `Using the forensic refresh design, update the Phase 3 benchmark truth fixtures for metrics, emotional-analysis, and recommendation so they reflect the current repaired packet. Keep the lane narrow: prefer fixture refresh over runtime code churn. If a matcher or comparator assumption must change to score the repaired truth honestly, make the smallest necessary change and justify it. Add or update reproducible generation/validation support if appropriate, run repo-local validation, and commit/push by default before handoff.`

**Folders Created/Deleted/Modified:**
- `benchmarks/fixtures/cod-test/`
- `scripts/qa/`
- `.plans/`

**Files Created/Deleted/Modified:**
- `benchmarks/fixtures/cod-test/truth/metrics.json`
- `benchmarks/fixtures/cod-test/truth/emotional-analysis.json`
- `benchmarks/fixtures/cod-test/truth/recommendation.json`
- `scripts/qa/refresh-cod-phase3-truth-fixtures.cjs`
- `.plans/2026-05-14-phase3-benchmark-truth-refresh.md`

**Status:** ✅ Complete

**Results:** Refreshed `benchmarks/fixtures/cod-test/truth/metrics.json`, `benchmarks/fixtures/cod-test/truth/emotional-analysis.json`, and `benchmarks/fixtures/cod-test/truth/recommendation.json` wholesale from the current repaired Phase 3 outputs in `output/cod-test/phase3-report/*`, while preserving each fixture’s `_benchmark.ignorePaths` metadata. Added `scripts/qa/refresh-cod-phase3-truth-fixtures.cjs` so this refresh is reproducible and checkable (`write` mode updates the fixtures; `--check` proves they still match the repaired packet). No comparator or matcher changes were needed in `server/lib/benchmark-runner.cjs` or `benchmarks/fixtures/cod-test/benchmark.json`; the stale truth, not the scorer, was the blocker for this lane. Retired the stale expectations called out in the forensic note, including the old boredom-heavy metrics peaks/trends, the fabricated boredom-peak/critical-moment family in emotional-analysis, and the older long-form recommendation prose plus its 6-finding/11-suggestion surface. Validation run(s): `node scripts/qa/refresh-cod-phase3-truth-fixtures.cjs --check`, a direct `runBenchmarkStage` pass against `configs/cod-test.yaml` showing `metricsData`, `emotionalAnalysisData`, and `recommendationData` now all pass, and `node --test test/lib/benchmark-runner.test.js` (39/39 passing).

---

### Task 3: Re-run the benchmark against the refreshed Phase 3 truth surface

**Bead ID:** `ee-mezm`  
**SubAgent:** `primary` (for `coder` workflow role)  
**Role:** `coder`  
**References:** `REF-03`, `REF-04`, `REF-05`, `REF-06`, `REF-07`, `REF-08`, `REF-09`  
**Prompt:** `Re-run the benchmark against the refreshed Phase 3 truth fixtures using the current repaired cod-test packet. Capture the exact command, refreshed report paths, and whether metrics/emotional-analysis/recommendation now score in a way that matches current product truth. Do not broaden scope into more runtime report changes unless the rerun proves a remaining live bug.`

**Folders Created/Deleted/Modified:**
- `benchmarks/fixtures/cod-test/_reports/`
- `.plans/`
- `.plans/artifacts/2026-05-14-phase3-benchmark-truth-refresh/`

**Files Created/Deleted/Modified:**
- `.plans/2026-05-14-phase3-benchmark-truth-refresh.md`
- `.plans/artifacts/2026-05-14-phase3-benchmark-truth-refresh/rerun-summary.md`
- refreshed benchmark report artifacts

**Status:** ⏳ Pending

**Results:** Pending.

---

### Task 4: QA the refreshed Phase 3 benchmark surface against current product truth

**Bead ID:** `ee-6zm5`  
**SubAgent:** `primary` (for `qa` workflow role)  
**Role:** `qa`  
**References:** `REF-05`, `REF-06`, `REF-07`, `REF-08`, `REF-09`  
**Prompt:** `QA the refreshed Phase 3 benchmark surface. Judge whether the refreshed truth fixtures now evaluate the current repaired outputs honestly rather than rewarding stale semantics. Distinguish between remaining benchmark debt, acceptable model variance, and any newly exposed live-output problems. Produce a durable QA summary with an explicit go/no-go judgment for the refreshed benchmark lane.`

**Folders Created/Deleted/Modified:**
- `benchmarks/` (inspection only)
- `output/` (inspection only)
- `.plans/`
- `.plans/artifacts/2026-05-14-phase3-benchmark-truth-refresh/`

**Files Created/Deleted/Modified:**
- `.plans/2026-05-14-phase3-benchmark-truth-refresh.md`
- `.plans/artifacts/2026-05-14-phase3-benchmark-truth-refresh/qa-summary.md`

**Status:** ⏳ Pending

**Results:** Pending.

---

### Task 5: Audit the refreshed benchmark lane and define any remaining follow-up

**Bead ID:** `ee-89l2`  
**SubAgent:** `primary` (for `auditor` workflow role)  
**Role:** `auditor`  
**References:** `REF-01`, `REF-02`, `REF-03`, `REF-04`, `REF-05`, `REF-06`, `REF-07`, `REF-08`, `REF-09`  
**Prompt:** `Independently audit the benchmark-truth refresh work, rerun evidence, and QA findings. Decide whether the Phase 3 benchmark surface is now aligned with the current repaired packet, or whether additional truth-fixture or matcher follow-up is still needed. If anything remains, define the smallest next lane clearly. Close the bead only if the work is honestly complete.`

**Folders Created/Deleted/Modified:**
- `benchmarks/` (inspection only)
- `output/` (inspection only)
- `.plans/`
- `.plans/artifacts/2026-05-14-phase3-benchmark-truth-refresh/`

**Files Created/Deleted/Modified:**
- `.plans/2026-05-14-phase3-benchmark-truth-refresh.md`
- `.plans/artifacts/2026-05-14-phase3-benchmark-truth-refresh/audit-summary.md`

**Status:** ⏳ Pending

**Results:** Pending.

---

## Final Results

**Status:** ⏳ Pending

**What We Built:** Pending.

**Reference Check:** Pending.

**Commits:**
- Pending

**Lessons Learned:** Pending.

---

*Completed on Pending*
