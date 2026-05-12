# Emotion Engine

**Date:** 2026-04-21  
**Status:** Draft  
**Agent:** Cookie 🍪

---

## Goal

Step back from immediate implementation and choose the highest-leverage strategy for reducing honest `dialogueData` benchmark drift on `cod-test` before we touch more code.

---

## Overview

The last session intentionally stopped after removing the routing/contract-family confusion from the dialogue benchmark. That work made the remaining red more trustworthy: the dialogue lane is now failing for real content drift on the v3 surface rather than for legacy-vs-v3 artifact-family mismatch.

Because the remaining failures now appear to be honest, the next move should not be another blind prompt tweak. We should compare the main intervention classes first: prompt/input shaping, upstream data-pipeline changes, representation/contract changes, transcript segmentation/recovery improvements, scorer/comparator changes, and evaluation-design changes. The purpose of this plan is to turn that broader design discussion into a concrete recommendation with explicit tradeoffs.

If the discussion converges on implementation work, the follow-up execution plan should stay narrow and should target the lane with the best expected payoff against the current honest residuals.

---

## REFERENCES

| ID | Description | Path |
| --- | --- | --- |
| `REF-01` | Yesterday's active residual-fix plan and summary | `.plans/2026-04-20-fix-dialogue-summary-and-transcript-contract-drift.md` |
| `REF-02` | Residual dialogue audit after routing fix | `docs/research/2026-04-20-dialogue-data-residual-audit.md` |
| `REF-03` | QA verification for the routing fix | `docs/research/2026-04-20-dialogue-routing-fix-qa-verification.md` |
| `REF-04` | Post-fix dialogue-vs-vocals audit | `docs/research/2026-04-20-cod-benchmark-postfix-dialogue-vs-vocals-audit.md` |
| `REF-05` | Earlier dialogue prompt review | `docs/dialogue-prompt-review-2026-04-07.md` |
| `REF-06` | Current dialogue truth artifact | `benchmarks/fixtures/cod-test/truth/dialogue-data.json` |
| `REF-07` | Current routed runtime artifact family | `output/cod-test/phase1-gather-context/dialogue-v3-source-truth.reconciled.json` |

Use these references to keep the recommendation tied to actual residuals instead of generic benchmark advice.

---

## Tasks

### Task 1: Compare the main strategy classes for reducing benchmark drift

**Bead ID:** `Pending`  
**SubAgent:** `primary` (for `research`)  
**Role:** `research`  
**References:** `REF-01`, `REF-02`, `REF-03`, `REF-04`, `REF-05`, `REF-06`, `REF-07`  
**Prompt:** In `projects/peanut-gallery/emotion-engine`, claim the assigned bead on start. Review the current honest residual dialogue drift after the routing fix, then compare the main intervention classes: prompt/input shaping, transcript segmentation/recovery, upstream pipeline/data-shaping changes, representation/contract changes, scorer/comparator changes, and evaluation-design changes. Produce a durable note ranking the options by expected leverage, risk, truthfulness, and implementation cost for `cod-test`.

**Folders Created/Deleted/Modified:**
- `docs/research/`

**Files Created/Deleted/Modified:**
- `docs/research/2026-04-21-*.md`

**Status:** ⏳ Pending

**Results:** Pending.

---

### Task 2: Turn the comparison into a concrete next-lane recommendation

**Bead ID:** `Pending`  
**SubAgent:** `primary` (for `auditor`)  
**Role:** `auditor`  
**References:** `REF-01`, `REF-02`, `REF-03`, `REF-04`, `REF-05`, `REF-06`, `REF-07`  
**Prompt:** In `projects/peanut-gallery/emotion-engine`, claim the assigned bead on start. Review the strategy-comparison note and independently truth-check the recommendation against the actual current residuals. State which lane should go next, what we should explicitly avoid, and what success/failure would look like for the next implementation plan.

**Folders Created/Deleted/Modified:**
- `docs/research/`

**Files Created/Deleted/Modified:**
- `docs/research/2026-04-21-*.md`
- `.plans/2026-04-21-benchmark-drift-strategy-review-before-next-implementation.md`

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

*Drafted on 2026-04-21*