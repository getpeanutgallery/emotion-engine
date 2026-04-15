# Emotion Engine

**Date:** 2026-04-15  
**Status:** Draft  
**Agent:** Cookie 🍪

---

## Goal

Lock the deterministic YAML grouping contract for dialogue traits mode so the next implementation lane has an exact, reviewable ruleset surface instead of ambiguous heuristic prose.

---

## Overview

Yesterday’s design lane finished the stored v2 dialogue traits contract and left the implementation seam intentionally unimplemented. The strongest next step is to turn the current artifact-shape guidance into an explicit YAML heuristics/rules contract that says exactly what the grouping engine may read, how those fields are bucketed, what counts as a hard blocker, which weights and thresholds exist, and which behaviors are explicitly forbidden.

This should stay design-first unless Derrick wants implementation immediately. The output should be durable docs that remove ambiguity around deterministic grouping behavior, preserve the closed source-truth contract, and make later coder/auditor work straightforward. If review uncovers a better lane, this plan can pivot before execution.

---

## REFERENCES

| ID | Description | Path |
| --- | --- | --- |
| `REF-01` | Reviewed stored-v2 dialogue traits decisions | `docs/2026-04-14-dialogue-traits-contract-v2-reviewed-decisions.md` |
| `REF-02` | Stored v2 artifact-shape and YAML boundary doc | `docs/2026-04-14-traits-mode-json-yaml-artifact-shapes.md` |
| `REF-03` | Migration seam for traits-first deterministic grouping | `docs/2026-04-14-dialogue-traits-mode-migration-seam.md` |
| `REF-04` | Prior review-alignment plan | `.plans/2026-04-14-revise-dialogue-traits-contract-v2-after-review.md` |
| `REF-05` | Session handoff note identifying YAML heuristics/rules as the next likely review lane | `memory/2026-04-14.md` |

---

## Tasks

### Task 1: Draft the exact YAML heuristics/rules contract for deterministic grouping

**Bead ID:** `Pending`  
**SubAgent:** `primary`  
**References:** `REF-01`, `REF-02`, `REF-03`, `REF-05`  
**Prompt:** Draft a durable design doc that defines the exact YAML contract for deterministic speaker grouping in traits mode. It should specify the schema envelope, compatibility/versioning fields, canonical bucket mapping, hard blockers, weights, thresholds, tie-breakers, cleanup policy, and forbidden patterns. Keep the source-truth contract closed and do not introduce role/lore labels or non-contract fields.

**Folders Created/Deleted/Modified:**
- `docs/`
- `.plans/`

**Files Created/Deleted/Modified:**
- `docs/2026-04-15-traits-grouping-yaml-contract.md` (planned)
- `.plans/2026-04-15-define-traits-grouping-yaml-contract.md`

**Status:** ⏳ Pending

**Results:** Pending.

---

### Task 2: Independently audit the YAML contract against the reviewed stored-v2 decisions

**Bead ID:** `Pending`  
**SubAgent:** `auditor`  
**References:** `REF-01`, `REF-02`, `REF-03`  
**Prompt:** Audit the drafted YAML contract doc for coherence with the reviewed stored-v2 traits decisions and the artifact boundary docs. Verify that the rules contract only uses closed source-truth fields, does not reintroduce forbidden metadata, keeps grouping ownership separate from source truth, and is specific enough to guide implementation without semantic drift.

**Folders Created/Deleted/Modified:**
- `docs/`
- `.plans/`

**Files Created/Deleted/Modified:**
- `docs/2026-04-15-traits-grouping-yaml-contract-audit.md` (planned)
- `.plans/2026-04-15-define-traits-grouping-yaml-contract.md`

**Status:** ⏳ Pending

**Results:** Pending.

---

### Task 3: Update the living plan with actual decisions and next implementation seam

**Bead ID:** `Pending`  
**SubAgent:** `primary`  
**References:** `REF-02`, `REF-03`, `REF-05`  
**Prompt:** Update this plan after drafting and audit. Record what was decided, any changes from the initial draft, what remains intentionally unimplemented, and the exact next implementation seam for coder work.

**Folders Created/Deleted/Modified:**
- `.plans/`

**Files Created/Deleted/Modified:**
- `.plans/2026-04-15-define-traits-grouping-yaml-contract.md`

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
