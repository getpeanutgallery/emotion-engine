# Emotion Engine

**Date:** 2026-04-24  
**Status:** Draft  
**Agent:** Cookie 🍪

---

## Goal

Identify and prioritize non-AI-prompt changes that can improve the lowest benchmark percentage surfaces in peanut-gallery emotion engine.

---

## Overview

This planning lane is explicitly limited to non-prompt changes. We are not trying to improve scores by rewriting model prompts; we are looking for higher-leverage improvements in pipeline structure, reconciliation, scoring/reporting, artifact contracts, truth alignment, contamination handling, segmentation policy, and deterministic post-processing.

The new benchmark reporting surfaces now expose exactly where the system is weak: dialogue boundary fidelity remains poor, music/music-vocals still have low content/support percentages, and several phase 3 surfaces are near-zero on their new independent percentages. The purpose of this plan is to convert those exposed weak spots into concrete implementation lanes that do not depend on prompt changes.

The likely winning strategy is to focus first on pipeline and reconciliation improvements where the benchmark shows structurally honest failure: remove contamination between artifact families, improve deterministic text/segment normalization, harden reconciliation and ownership boundaries between dialogue and music-vocals, and tighten downstream artifact shaping so later phases are scored against cleaner, more stable inputs.

---

## REFERENCES

| ID | Description | Path |
| --- | --- | --- |
| `REF-01` | Dialogue split/merge scoring plan and current outcomes | `.plans/2026-04-24-dialogue-score-reconciliation-for-splits-and-merges.md` |
| `REF-02` | Benchmark percentage extension plan | `.plans/2026-04-24-extend-benchmark-percentages-and-add-lyric-leakage-regression.md` |
| `REF-03` | Current benchmark manifest and artifact inventory | `benchmarks/fixtures/cod-test/benchmark.json` |
| `REF-04` | Current generated benchmark summary | `benchmarks/fixtures/cod-test/_reports/benchmark-summary.md` |
| `REF-05` | Benchmark runner implementation | `server/lib/benchmark-runner.cjs` |
| `REF-06` | Audit of current dialogue vs benchmark drift | `docs/2026-04-24-current-dialogue-vs-benchmark-audit.md` |

---

## Candidate Non-Prompt Improvement Lanes

### Lane A: Deterministic dialogue/music-vocals ownership cleanup

**Why it matters:** The lyric-leakage regression proves contamination between dialogue and music-vocals is a real score-killer. Hardening deterministic routing should improve dialogue and music-vocals simultaneously without touching prompts.

**Potential changes:**
- stricter deterministic filtering/reassignment of sung lyric text out of dialogue artifacts
- stronger ownership rules for chant/lyric/repeated-hook patterns
- artifact-family contamination checks before benchmark packaging
- reconciliation ledger rules that can re-home leaked segments instead of merely flagging them

**Expected impact:** High on dialogue text honesty, music-vocals text honesty, and benchmark stability.

---

### Lane B: Deterministic segment normalization and reconciliation for split/merge drift

**Why it matters:** Dialogue text score is much more honest now, but boundary fidelity is still terrible. Non-prompt deterministic post-processing may improve both boundary and downstream grouping/trait stability.

**Potential changes:**
- local split/merge repair pass after capture
- normalize adjacent fragments when they clearly belong to one utterance
- split obvious fused multi-speaker or multi-beat lines when deterministic evidence is sufficient
- stabilize transcript cleanup before traits/grouping consume dialogue

**Expected impact:** High on dialogue boundary %, moderate on grouping/traits, moderate on downstream phase consistency.

---

### Lane C: Dialogue-to-traits/grouping seam hardening

**Why it matters:** Even after text scoring was fixed, grouping and traits are still operating on weak evidence. Improving the seam and deterministic preprocessing could raise grouping-related surfaces without touching the upstream prompt.

**Potential changes:**
- reject or repair low-information trait defaults before grouping
- derive additional deterministic continuity hints from neighboring segments
- preserve stronger provenance from reconciled dialogue into grouping inputs
- add deterministic fallback grouping heuristics when traits are sparse/unknown

**Expected impact:** Moderate-to-high on grouping-related outcomes; lower leverage than fixing contaminated or mis-segmented source dialogue first.

---

### Lane D: Music and music-vocals reconciliation/identity hardening

**Why it matters:** Current music and music-vocals percentage surfaces remain very low. This suggests unresolved ownership, support evidence, or reconciliation issues beyond pure prompt quality.

**Potential changes:**
- tighten recognized-song identity/support reconciliation logic
- improve deterministic dedupe / chorus-repeat handling
- better structural normalization of vocal segments before scoring
- enforce clearer boundary between background score vs lyrical vocals

**Expected impact:** High on music/music-vocals surfaces; likely one of the best non-prompt opportunities after dialogue contamination cleanup.

---

### Lane E: Benchmark-side truth alignment and comparator carve-outs where honest

**Why it matters:** Some low percentages may still reflect benchmark surfaces that are too brittle or compare low-value scaffolding too harshly. We already improved dialogue scoring this way; other surfaces may need the same treatment.

**Potential changes:**
- artifact-specific percentage formulas that better reflect human judgment
- honest ignore/defer paths for non-gold or low-value fields
- family-specific normalization for punctuation, ordering, and representation-only drift
- better support-vs-identity separation in recognized-song scoring

**Expected impact:** Moderate, but important for score honesty. Should not be used to hide true semantic errors.

---

### Lane F: Phase 3 contract/downstream shaping cleanup

**Why it matters:** Recommendation, metrics, and emotional-analysis surfaces have many near-zero percentages. That often points to schema/contract mismatch, missing deterministic shaping, or poor mapping between earlier evidence and final artifact format.

**Potential changes:**
- deterministic post-process shaping into benchmark-expected structures
- clearer field derivation rules from upstream artifacts into phase 3 outputs
- contract cleanup for optional vs required surfaces
- stronger implementation-status and summary generation consistency

**Expected impact:** Potentially very high on the lowest phase 3 surfaces, especially if the issue is representation mismatch rather than missing evidence.

---

## Prioritized Recommendation

### 1. Lane A — dialogue/music-vocals ownership cleanup
Best immediate next move if we want the highest-confidence non-prompt score gain without gaming the benchmark.

### 2. Lane F — phase 3 contract/downstream shaping cleanup
Likely the biggest percentage upside because several phase 3 surfaces are near zero, which often signals contract/shaping problems rather than purely impossible semantic inference.

### 3. Lane D — music/music-vocals reconciliation and identity hardening
Strong candidate because current music-family percentages are still weak and likely suffering from deterministic ownership/reconciliation issues.

### 4. Lane B — deterministic split/merge repair
Worth doing, but less urgent now that dialogue text accuracy is scored honestly. More valuable once contamination ownership is cleaner.

### 5. Lane C — traits/grouping seam hardening
Important, but downstream of getting cleaner source dialogue.

### 6. Lane E — further comparator/truth alignment cleanup
Use carefully and only where it improves honesty rather than optics.

---

## Proposed Execution Tasks

### Task 1: Research and rank non-prompt score-improvement opportunities from current report surfaces

**Bead ID:** `Pending`  
**SubAgent:** `primary`  
**Role:** `research`  
**References:** `REF-01`, `REF-02`, `REF-03`, `REF-04`, `REF-05`, `REF-06`  
**Prompt:** Audit the current cod-test benchmark report surfaces and code seams, then rank the highest-leverage non-prompt implementation lanes for improving low scores. Focus on deterministic routing, reconciliation, contract shaping, artifact ownership, phase-3 mapping, and comparator honesty. Produce a short recommendation memo with expected impact, risk, and suggested execution order.

**Folders Created/Deleted/Modified:**
- `docs/`
- `.plans/`

**Files Created/Deleted/Modified:**
- `docs/2026-04-24-non-prompt-score-improvement-recommendation.md`
- `.plans/2026-04-24-non-prompt-score-improvement-options.md`

**Status:** ⏳ Pending

**Results:** Pending.

---

### Task 2: Create execution plan for the chosen next lane

**Bead ID:** `Pending`  
**SubAgent:** `primary`  
**Role:** `research`  
**References:** `REF-01`, `REF-02`, `REF-03`, `REF-04`, `REF-05`, `REF-06`  
**Prompt:** After Derrick selects the preferred non-prompt improvement lane, create a concrete implementation plan with bead-ready tasks, expected validation steps, and exact files likely to change.

**Folders Created/Deleted/Modified:**
- `.plans/`

**Files Created/Deleted/Modified:**
- `.plans/2026-04-24-non-prompt-score-improvement-options.md`

**Status:** ⏳ Pending

**Results:** Pending.

---

## Final Results

**Status:** ⏳ Draft

**What We Built:** Planning only.

**Reference Check:** Pending.

**Commits:**
- Pending

**Lessons Learned:** Pending.

---

*Completed on 2026-04-24*
