---
plan_id: plan-2026-04-04-coverage-honesty-from-clean-live-rerun-artifacts
bead_ids:
  - ee-5ktn
  - Pending
---
# emotion-engine: coverage honesty from clean-live rerun artifacts

**Date:** 2026-04-04  
**Status:** Draft  
**Agent:** Cookie 🍪

---

## Goal

Make Phase 1 dialogue coverage metadata tell the truth for clean-live whole-asset rerun artifacts, starting from the current mismatch where `coverage.end = 140.04` while persisted dialogue segments only reach about `85s`.

---

## Overview

The prior April 4 closeout established that the runtime-anchor lane is worth keeping, but the latest mid/late recovery rerun surfaced a cleaner repo-owned honesty seam: persisted dialogue metadata now claims full-runtime reach while the saved normalized dialogue segments stop much earlier. That means we currently overstate what the artifact actually preserves, even before solving the deeper whole-asset grounding/timeline-collapse problem.

This tranche should stay narrow and truthful. First, we should trace exactly how `coverage` is derived, reproduce the mismatch from the current artifact path and codepath, and decide what `coverage` should mean for persisted outputs. Then we should implement the smallest safe fix so persisted artifact metadata reflects what is actually retained, not what an upstream raw/transient timeline may have reached. Only after that should we rerun verification to confirm we removed the honesty mismatch without masking the still-open mid/late grounding problem.

---

## Tasks

### Task 1: Audit and define truthful persisted-dialogue coverage semantics

**Bead ID:** `ee-5ktn`  
**SubAgent:** `research`  
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, audit the current coverage mismatch documented in the April 4 handoff: the clean-live rerun artifact reports coverage.end = 140.04 while persisted dialogue segments only reach about 85s. Trace where coverage metadata is computed in the Phase 1 dialogue pipeline, inspect the fresh artifact and any upstream/raw representations that may be inflating coverage, and define the truthful semantics we should use for persisted dialogue coverage. Do not implement code changes in this task. Update the plan with exact findings, file/code references, and a concrete recommendation for what persisted coverage should represent. Claim bead ee-5ktn on start with bd update ee-5ktn --status in_progress --json and close it on completion with bd close ee-5ktn --reason "Audited coverage mismatch and defined truthful persisted coverage semantics" --json.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- optional notes/log paths if useful

**Files Created/Deleted/Modified:**
- `.plans/2026-04-04-coverage-honesty-from-clean-live-rerun-artifacts.md`

**Status:** ⏳ Pending

**Results:** Pending.

---

### Task 2: Implement the smallest safe coverage-honesty fix with tests

**Bead ID:** `Pending`  
**SubAgent:** `coder`  
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, implement the smallest safe fix for the persisted-dialogue coverage honesty bug identified in Task 1. Keep the change narrow: adjust coverage derivation so persisted artifact metadata reflects what the saved normalized dialogue segments actually retain, unless Task 1 proves a different explicit contract is already intended and documented. Add or update focused tests around coverage computation and any edge cases the audit exposes. Do not broaden this into a full whole-asset grounding rewrite. Claim the assigned bead on start, close it on completion, and commit after tests pass but do not push.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `server/scripts/get-context/`
- `test/scripts/`

**Files Created/Deleted/Modified:**
- `.plans/2026-04-04-coverage-honesty-from-clean-live-rerun-artifacts.md`
- coverage-related implementation files under `server/scripts/get-context/`
- coverage-related tests under `test/scripts/`

**Status:** ⏳ Pending

**Results:** Pending.

---

### Task 3: Verify the fix on artifact evidence and a fresh rerun, then close out truthfully

**Bead ID:** `Pending`  
**SubAgent:** `primary`  
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, verify the coverage-honesty fix against both the current artifact evidence and a fresh canonical rerun if needed. Confirm whether coverage metadata now matches persisted saved-dialogue reach, and explicitly document any still-open upstream grounding/timeline-collapse issues that remain after the honesty fix. Update the active plan and related April 4 plan with exact results. If the lane is complete, archive the plan and push only lane-owned repo changes on main while excluding unrelated runtime noise. Claim the assigned bead on start and close it on completion with an explicit reason.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `.plans/archive/`
- `.logs/`
- `output/`

**Files Created/Deleted/Modified:**
- `.plans/2026-04-04-coverage-honesty-from-clean-live-rerun-artifacts.md`
- optional verification logs/output references
- optional updated related April 4 plan files

**Status:** ⏳ Pending

**Results:** Pending.

---

## Final Results

**Status:** ⏳ Pending

**What We Built:** Pending.

**Commits:**
- Pending.

**Lessons Learned:** Pending.

---

*Created on 2026-04-04*
