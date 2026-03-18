---
plan_id: plan-2026-03-13-unified-output-failure-and-ai-recovery-architecture
bead_ids:
  - Pending
---
# emotion-engine: unified output contracts, failure contracts, and AI recovery architecture

**Date:** 2026-03-13  
**Status:** In Progress  
**Agent:** Cookie 🍪

> **Historical status note (2026-03-18):** This plan captures the architecture-definition moment before the rollout was split into concrete execution beads. It is no longer the active execution truth: the design was carried forward into the 2026-03-14 continuation plan, implemented across the `ee-d4x.*` / `ee-cwi.*` chain, and later verified/closed via `ee-vaa`. Keep this file as the historical design snapshot; use later plans and Beads for current status.

---

## Goal

Define and implement a unified system-wide contract for emotion-engine where every script emits schema-validated JSON, every failure emits schema-validated failure JSON with explicit recovery policy, deterministic recovery paths are attempted first, and unrecovered failures may escalate exactly once-or-N-times to a YAML-configured AI recovery lane before hard failure.

---

## Overview

Derrick has tightened the architecture again, but this time in a way that cleanly unifies the whole system rather than only AI lanes. The new target state is not just “AI outputs should be structured.” It is that **every script in the system** participates in a common contract:

1. successful outputs are schema-bound JSON
2. failures are also schema-bound JSON
3. failures declare recovery policy and remaining recovery options
4. deterministic recovery is attempted first when available
5. if deterministic recovery is exhausted or unavailable, control can escalate to a dedicated AI recovery lane that decides whether one more recovery attempt should be made
6. AI recovery is budgeted and capped by YAML

This creates a consistent “continue / deterministically recover / AI recover / hard fail” model across the emotion-engine. That is broader than the current validator-tool rollout and will likely subsume or reshape parts of the existing queue. So this needs to be planned carefully before implementation, with explicit architecture, config shape, per-phase adoption order, and fail-safe limits.

---

## Derrick’s desired guarantees

### Guarantee 1: Every script emits schema-validated JSON on success

Applies to:
- AI-calling scripts
- computed/aggregation scripts
- tool-wrapper scripts
- artifact-producing scripts where outputs are machine-consumed

### Guarantee 2: Every failure emits schema-validated failure JSON with explicit recovery policy

Failure JSON should at minimum encode:
- what failed
- why it failed
- whether deterministic recovery is known
- what deterministic recoveries remain
- whether AI recovery is allowed
- how many AI recovery attempts remain
- whether the next state is retry / deterministic_repair / ai_recover / fail

### Guarantee 3: Deterministic recovery first, then capped AI recovery, then hard fail

Required behavior:
- attempt known deterministic recovery paths first
- if none remain, hand the failure package to a dedicated AI recovery script that uses YAML-configured adapters like other AI lanes
- AI recovery gets a capped number of attempts per script/lane (for example 1)
- if AI recovery says the problem is unrecoverable, or recovery budget is exhausted, hard fail
- if AI recovery proposes updated inputs, rerun the failing script in the current phase with those revised inputs

---

## Proposed architecture breakdown

### Task 1: Define the universal success/failure contract

**Bead ID:** `Pending`  
**SubAgent:** `main`  
**Prompt:** `Define the system-wide contract for success JSON and failure JSON across emotion-engine. Specify required fields, schema/versioning strategy, recovery-policy fields, and how downstream phases should consume these envelopes. Record the concrete contract in docs and in this plan.`

**Status:** ⏳ Pending

**Results:** Pending.

---

### Task 2: Define the deterministic recovery framework

**Bead ID:** `Pending`  
**SubAgent:** `main`  
**Prompt:** `Design the deterministic recovery framework for emotion-engine scripts. Specify how scripts declare known recoveries, how retry/repair steps are recorded, how remaining recovery paths are tracked, and how recovery decisions are made consistently across phases. Record the framework in docs and this plan.`

**Status:** ⏳ Pending

**Results:** Pending.

---

### Task 3: Define the AI recovery lane contract and YAML config

**Bead ID:** `Pending`  
**SubAgent:** `main`  
**Prompt:** `Design the AI recovery lane contract. Specify the YAML shape for choosing its adapter/model, the schema for the failure package it receives, the schema for its decision output, the cap on allowed AI recovery attempts per script/lane, and the rules for when its proposed updated inputs can be fed back into the failing script. Record the concrete config shape and constraints in docs and this plan.`

**Status:** ⏳ Pending

**Results:** Pending.

---

### Task 4: Map the current emotion-engine scripts into rollout families

**Bead ID:** `Pending`  
**SubAgent:** `main`  
**Prompt:** `Inventory the current emotion-engine scripts and group them into rollout families for the new architecture: AI lanes, computed/report lanes, tool-wrapper/artifact lanes, and any out-of-scope utilities. Identify which current beads are superseded, which can be reused, and what the safest implementation order is. Record the mapping in this plan.`

**Status:** ⏳ Pending

**Results:** Pending.

---

### Task 5: Define guardrails, cost controls, and kill conditions

**Bead ID:** `Pending`  
**SubAgent:** `main`  
**Prompt:** `Define the global guardrails for the unified recovery system: max deterministic retries, max AI recovery attempts, loop-prevention rules, logging/raw-capture requirements, cost controls, and hard-fail conditions. Make the policy strict enough to prevent silent runaway recovery loops. Record the policy in docs and this plan.`

**Status:** ⏳ Pending

**Results:** Pending.

---

### Task 6: Break implementation into concrete execution beads

**Bead ID:** `Pending`  
**SubAgent:** `main`  
**Prompt:** `Translate the architecture into concrete implementation beads, likely including shared framework work, AI-lane adaptation, computed-script schema rollout, deterministic recovery integration, AI recovery integration, sibling-repo rollout, and final sanity sweep. Record the bead set and recommended order in this plan.`

**Status:** ⏳ Pending

**Results:** Pending.

---

## Key design decisions now settled

- Success/failure use universal envelope families with script-owned validated JSON results as the source of truth.
- There is no `partial_success`; degraded-but-usable outcomes remain `status: "success"` with explicit diagnostics.
- `failure.code` values are script-local because they depend on localized knowledge.
- Recovery should receive as much context as practical; large tool outputs may be wrapped/summarized before AI recovery consumes them.
- The top-level pipeline API should adopt the same envelope family as a higher-level aggregation wrapper while preserving per-script envelopes underneath.

## Remaining design questions

- Should deterministic recovery be declared by each script, by shared helpers, or both?
- Should AI recovery be one shared script with per-lane strategies, or one AI recovery script per family?
- How should updated inputs be represented so they can safely re-enter the failing script?
- How do we prevent AI recovery from papering over genuine bugs or entering retry loops?
- Which existing beads should be superseded by this broader system design versus executed unchanged?

---

## Initial bias / recommendation

My bias is:
- one shared universal **failure envelope**
- one shared **deterministic recovery framework**
- one shared **AI recovery contract** with lane/family-specific schemas
- rollout in this order:
  1. architecture/spec
  2. shared framework
  3. computed/tool-wrapper schema outputs
  4. deterministic recovery integration
  5. AI recovery integration
  6. sibling rollout
  7. final sanity sweep

That gives us a single system model instead of parallel half-systems.

---

## Success Criteria

- We define the architecture clearly enough to implement without inventing per-script policy ad hoc.
- The three guarantees are captured explicitly and consistently.
- YAML/config implications are specified.
- Recovery limits and kill conditions are explicit.
- We leave with a concrete bead set for execution, not just a concept doc.

---

## Constraints

- This plan defines the architecture first; it does not try to implement the whole system in one pass.
- The design must be resilient but bounded; no open-ended autonomous recovery loops.
- The final system should remain auditable and debuggable.

---

## Final Results

**Status:** ⏳ Pending

**What We Built:** Pending.

**Commits:**
- Pending.

**Lessons Learned:** Pending.

---

**Question for Derrick:** Is this architecture plan ready for me to convert into Beads and execute from the spec first?
