# emotion-engine: AI recovery contract and sibling repo rollout continuation

**Date:** 2026-03-14  
**Status:** In Progress  
**Agent:** Cookie 🍪

---

## Goal

Pick up from the 2026-03-13 architecture session and turn the unified success/failure/recovery design into the next concrete spec + rollout sequence across emotion-engine and its sibling repos.

---

## Overview

I checked the session handoff before drafting this. The last session ended after the architecture was tightened beyond AI lanes: every meaningful script should emit schema-validated success JSON, every failure should emit schema-validated failure JSON, deterministic recovery should run before AI recovery, and AI recovery should be YAML-configured and capped. The immediate next bead called out in the handoff was `ee-32e`, followed by rollout mapping, guardrails, and execution breakdown.

This continuation plan keeps `emotion-engine` as the parent coordination repo because it owns the primary architecture and already contains the active architecture plans/beads. Sibling repos stay in scope where the contract must propagate, especially `digital-twin-router`, `digital-twin-core`, and any other current AI/output-handling siblings touched by the contract.

Task 1 is now complete. The architecture docs now explicitly separate the three layers instead of leaving AI recovery implicit: universal script success/failure envelope, deterministic recovery, then bounded AI recovery with YAML-driven policy and same-script safe re-entry rules.

---

## Tasks

### Task 1: Define the AI recovery lane contract and YAML configuration

**Bead ID:** `ee-32e`  
**SubAgent:** `primary`  
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, claim bead ee-32e at start with 'bd update ee-32e --status in_progress --json' and close it when done. Define the AI recovery lane contract on top of the universal success/failure and deterministic recovery architecture. Specify the failure package schema, AI recovery decision/result schema, YAML config shape, retry/attempt budgeting, safe re-entry rules, and observability requirements. Update the relevant docs and the active plan files with what actually changed. Commit your work to main.`

**Folders Created/Deleted/Modified:**
- `docs/`
- `.plans/`

**Files Created/Deleted/Modified:**
- `docs/AI-RECOVERY-LANE-CONTRACT.md`
- `docs/UNIVERSAL-SCRIPT-RESULT-CONTRACT.md`
- `docs/DETERMINISTIC-RECOVERY-FRAMEWORK.md`
- `.plans/2026-03-14-ai-recovery-contract-and-sibling-rollout.md`

**Status:** ✅ Complete

**Results:** Added `docs/AI-RECOVERY-LANE-CONTRACT.md` as the durable spec for the AI recovery layer. The doc defines the failure-package schema into recovery, the AI recovery decision/result schema, the YAML config shape for adapter/model/attempt/budget selection, capped retry/attempt rules, safe same-script re-entry rules, observability/raw-capture requirements, and explicit hard-fail boundaries. Updated the universal and deterministic docs to cross-link the new contract so the three-layer architecture now reads cleanly and consistently.

---

### Task 2: Map rollout families and sibling repo impact

**Bead ID:** `ee-cib` / `ee-cwi`  
**SubAgent:** `primary`  
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, claim bead ee-cib at start and use ee-cwi as the sibling-rollout companion. Inventory emotion-engine and sibling repos impacted by the unified output/failure/recovery contract. Group scripts into rollout families, note which repos/scripts already comply, identify gaps, and record a recommended implementation order. Update docs/plans with exact repo + lane mapping, then close or update the beads appropriately. Commit your work to main.`

**Folders Created/Deleted/Modified:**
- `docs/`
- `.plans/`

**Files Created/Deleted/Modified:**
- `docs/`
- `.plans/2026-03-14-ai-recovery-contract-and-sibling-rollout.md`

**Status:** ⏳ Pending

**Results:** Pending.

---

### Task 3: Define guardrails, cost controls, and kill conditions

**Bead ID:** `ee-ok2`  
**SubAgent:** `primary`  
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, claim bead ee-ok2 at start and close it when done. Define strict guardrails for deterministic + AI recovery: retry ceilings, cost/token ceilings, loop prevention, escalation stop conditions, mandatory raw/debug capture, and when the system must hard-fail instead of trying again. Update the relevant docs and plan with concrete policy decisions. Commit your work to main.`

**Folders Created/Deleted/Modified:**
- `docs/`
- `.plans/`

**Files Created/Deleted/Modified:**
- `docs/`
- `.plans/2026-03-14-ai-recovery-contract-and-sibling-rollout.md`

**Status:** ⏳ Pending

**Results:** Pending.

---

### Task 4: Break the architecture into executable implementation beads

**Bead ID:** `ee-d4x`  
**SubAgent:** `primary`  
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, claim bead ee-d4x at start and close it when done. Convert the now-settled contract architecture into concrete execution beads across emotion-engine and sibling repos. Include dependency order, likely owners/agent types, and which beads supersede or depend on current open work. Update the plan with the final execution graph and commit your work to main.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `.beads/`
- `docs/`

**Files Created/Deleted/Modified:**
- `.plans/2026-03-14-ai-recovery-contract-and-sibling-rollout.md`
- `docs/`

**Status:** ⏳ Pending

**Results:** Pending.

---

## Current context from the handoff

- `ee-32e` was the explicit next pickup point from the prior session and is now complete.
- `ee-cib`, `ee-ok2`, and `ee-d4x` remain the next sequence after that.
- `ee-cwi` remains open for sibling repo rollout.
- We should not jump to another golden run yet; the architecture/recovery rollout is still in flight.

---

## Final Results

**Status:** ⚠️ Partial

**What We Built:** Completed the missing AI recovery architecture layer in docs. The repo now has an explicit contract for bounded AI recovery between the universal failure envelope and same-script re-entry, but the sibling rollout map, broader guardrail pass, and execution breakdown beads are still pending.

**Commits:**
- Pending.

**Lessons Learned:** Keeping AI recovery as its own durable contract made it easier to keep the architecture auditable: deterministic recovery stays first, YAML owns policy/budgets, and re-entry remains same-script plus schema-preserving instead of turning into a general autonomous fixer.

---

*Updated on 2026-03-14 after completing bead `ee-32e`.*
