# Emotion Engine

**Date:** 2026-04-15  
**Status:** Draft  
**Agent:** Cookie 🍪

---

## Goal

Implement the approved dialogue traits v2 contract in the existing Phase 1 architecture, run a first cod-test vertical-slice attempt with the current single-pass dialogue+traits approach, and compare the result against the golden benchmark so we can decide what, if anything, should split next.

---

## Overview

This lane is explicitly scoped to the first vertical slice, not product-scale dataset expansion. The architecture we need already exists: the Phase system, the golden benchmark system, and the replay/cassette system. The purpose of this lane is to prove how far the current architecture can get on `cod-test` using the new v2 traits contract before we fragment the system into narrower passes.

However, this implementation lane is intentionally **sequenced after** the grouping heuristics YAML-contract lane. Derrick wants the grouping contract defined first so implementation lands against a clear continuity/grouping policy instead of an unfinished seam.

Once the heuristics contract exists, this lane should cover contract/prompt/validator/runtime updates for dialogue traits v2, a first cod-test run, benchmark comparison, and a review of where misses cluster. That review should drive the next split decision — for example whether emotion/pragmatics needs bundling, whether accent becomes the first specialist lane, or whether the one-pass system is already honest enough for the vertical slice.

---

## REFERENCES

| ID | Description | Path |
| --- | --- | --- |
| `REF-01` | Revised maximalist dialogue traits contract v2 | `docs/2026-04-15-dialogue-traits-maximalist-contract-vnext-v2.md` |
| `REF-02` | Calibration artifact | `docs/2026-04-15-dialogue-traits-v2-calibration-artifact.md` |
| `REF-03` | Targeted eval slice | `docs/2026-04-15-dialogue-traits-v2-targeted-eval-slice.md` |
| `REF-04` | Emotion/pragmatics split triggers | `docs/2026-04-15-dialogue-traits-v2-emotion-pragmatics-split-triggers.md` |
| `REF-05` | Existing cod-test benchmark truth system | `benchmarks/fixtures/cod-test/` |
| `REF-06` | Current vertical-slice framing from session discussion | current session |
| `REF-07` | High-level bead for this lane | `ee-gqnc` |
| `REF-08` | Prerequisite heuristics-contract plan | `.plans/2026-04-15-define-dialogue-traits-v2-speaker-grouping-heuristics-yaml-contract.md` |

---

## Tasks

### Task 1: Implement the dialogue traits v2 contract in the current Phase 1 dialogue path

**Bead ID:** `ee-gqnc`  
**SubAgent:** `coder`  
**References:** `REF-01`, `REF-02`, `REF-06`, `REF-08`  
**Prompt:** After the heuristics YAML contract is defined and reviewed, implement the dialogue traits v2 contract in the current Phase 1 dialogue path. Update prompts, validators, artifact handling, and any benchmark/comparator expectations needed for the cod-test vertical slice. Keep the architecture otherwise intact and do not prematurely split into extra passes.

**Status:** ⏳ Pending

**Results:** Pending.

---

### Task 2: Run the first cod-test vertical-slice attempt and benchmark it against truth

**Bead ID:** `Pending`  
**SubAgent:** `primary`  
**References:** `REF-03`, `REF-04`, `REF-05`, `REF-06`  
**Prompt:** Run cod-test with the new dialogue traits v2 path, capture the resulting Phase 1 artifact(s), and compare the output against the cod-test benchmark truth and the revised calibration/eval expectations. Preserve replay/cassette artifacts and record the benchmark outcome honestly.

**Status:** ⏳ Pending

**Results:** Pending.

---

### Task 3: Audit the implementation/run and classify the miss clusters

**Bead ID:** `Pending`  
**SubAgent:** `auditor`  
**References:** `REF-01`, `REF-03`, `REF-04`, `REF-05`, `REF-06`  
**Prompt:** Independently audit the first cod-test vertical-slice run. Classify where misses cluster: dialogue capture, affect/stance flattening, overlay handling, accent overreach, medium/spatial confusion, or other issues. Determine whether the results support keeping one-pass for now or justify the first split.

**Status:** ⏳ Pending

**Results:** Pending.

---

### Task 4: Update the living plan with results and recommend the first split/no-split decision

**Bead ID:** `Pending`  
**SubAgent:** `primary`  
**References:** `REF-04`, `REF-05`, `REF-06`, `REF-07`  
**Prompt:** Update this plan after implementation, run, and audit complete. Record benchmark results, miss clusters, and the recommended next split/no-split decision for the vertical slice.

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

*Drafted on 2026-04-15*
