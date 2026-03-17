---
plan_id: plan-2026-03-13-universal-success-failure-contracts
bead_ids:
  - ee-0f7
---
# emotion-engine: define universal success/failure JSON contracts

**Date:** 2026-03-13  
**Status:** Complete  
**Agent:** Cookie 🍪

---

## Goal

Define the schema-bound success and failure JSON contracts used by every meaningful script in emotion-engine, including recovery-policy fields and downstream consumption expectations.

---

## Overview

The architecture has now expanded beyond AI-lane validation alone. The next foundational step is to define the universal envelopes that every meaningful script in the system should produce:

- a validated success JSON shape when it succeeds
- a validated failure JSON shape when it fails

Without that contract, deterministic recovery, AI recovery, and final sanity auditing all stay fuzzy. This bead therefore focuses on the system envelope layer first, not per-script implementation. It should decide how much universal wrapper/meta information we require, how lane-specific payloads fit inside that wrapper, and how recovery policy is represented in failure JSON so later beads can implement behavior consistently.

---

## Tasks

### Task 1: Audit current output shapes and identify common envelope needs

**Bead ID:** `ee-0f7`  
**SubAgent:** `main`  
**Prompt:** `You are executing bead ee-0f7 in /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine. Claim it immediately with \`bd update ee-0f7 --status in_progress --json\`. Audit representative current success/failure output shapes across meaningful script families in emotion-engine (AI lanes, computed report lanes, tool-wrapper/artifact lanes). Identify what universal envelope/meta fields are actually needed and what should remain lane-specific payload. Record the audit in this active plan before defining the contract.`

**Files Created/Deleted/Modified:**
- `.plans/2026-03-13-universal-success-failure-contracts.md`
- docs files if updated

**Status:** ✅ Complete

**Results:** Audited representative current output families. Current success shapes already mostly converge on `return { artifacts: ... }` across AI lanes (`get-dialogue`, `get-music`, `video-chunks`, `recommendation`), computed/report lanes (`video-per-second`, `summary`, `final-report`), and tool-wrapper/artifact lanes (`get-metadata`). Current failure behavior does **not** converge: hard failures are still primarily thrown errors, with richer raw sidecars only in some AI lanes (`raw/_meta/errors.jsonl`, `errors.summary.json`, provider/validator attempt captures). `video-chunks` also demonstrates the important degraded-success case where per-chunk failures can live inside a still-usable success artifact via `statusSummary`.

---

### Task 2: Define the universal success envelope contract

**Bead ID:** `ee-0f7`  
**SubAgent:** `main`  
**Prompt:** `For bead ee-0f7, define the universal success JSON contract for meaningful emotion-engine scripts. Specify required wrapper/meta fields, how lane-specific payloads nest inside the envelope, versioning rules, and how downstream scripts should consume it. Write the contract into durable repo docs and summarize it in this active plan.`

**Files Created/Deleted/Modified:**
- docs files
- `.plans/2026-03-13-universal-success-failure-contracts.md`

**Status:** ✅ Complete

**Results:** Defined the universal success envelope in `docs/UNIVERSAL-SCRIPT-RESULT-CONTRACT.md`. The durable contract uses a small universal wrapper — `contractVersion`, `status`, `phase`, `script`, `run`, `payload`, `artifacts`, `metrics`, `diagnostics` — while keeping lane-specific meaning inside `payload.data`. This preserves one machine-readable routing contract without flattening dialogue/music/chunk-analysis/recommendation/summary into a fake shared schema. The success contract explicitly supports degraded-but-usable outputs via `diagnostics.degraded` and `diagnostics.warnings` instead of inventing ad hoc success variants.

---

### Task 3: Define the universal failure envelope contract

**Bead ID:** `ee-0f7`  
**SubAgent:** `main`  
**Prompt:** `For bead ee-0f7, define the universal failure JSON contract for meaningful emotion-engine scripts. It must include explicit recovery-policy fields covering deterministic recovery, AI recovery eligibility/budget, next-action policy, and structured diagnostics. Make the contract concrete enough that later deterministic-recovery and AI-recovery beads can implement against it without inventing new fields.`

**Files Created/Deleted/Modified:**
- docs files
- `.plans/2026-03-13-universal-success-failure-contracts.md`

**Status:** ✅ Complete

**Results:** Defined the universal failure envelope in `docs/UNIVERSAL-SCRIPT-RESULT-CONTRACT.md`. Required wrapper fields are `contractVersion`, `status`, `phase`, `script`, `run`, `failure`, `recoveryPolicy`, and `diagnostics`. The failure contract now explicitly requires: (1) deterministic recovery policy (`eligible`, ordered strategies, attempted/remaining sets, attempts budget), (2) AI recovery eligibility and budget (`eligible`, reason, max attempts, attempts remaining, token/cost budget), (3) next-action policy (`fail | deterministic_recovery | ai_recovery | human_review`, target, humanRequired, stopPipelineOnFailure), and (4) structured diagnostics (stage, provider metadata, parse/validation details, raw capture refs, stack). That makes later deterministic-recovery and AI-recovery beads concrete instead of prose-driven.

---

### Task 4: Verify clarity and close the bead

**Bead ID:** `ee-0f7`  
**SubAgent:** `main`  
**Prompt:** `For bead ee-0f7, verify that the success/failure contracts are concrete enough to drive the later deterministic-recovery, AI-recovery, and rollout-family beads. Update the active plan with the final contract summary, docs changed, and any open design questions that still need separate beads, then close ee-0f7 with \`bd close ee-0f7 --reason "Universal success/failure JSON contracts defined" --json\`.`

**Files Created/Deleted/Modified:**
- docs files
- `.plans/2026-03-13-universal-success-failure-contracts.md`

**Status:** ✅ Complete

**Results:** Verified the contract is concrete enough for later recovery beads and documented it durably. Docs changed: `docs/UNIVERSAL-SCRIPT-RESULT-CONTRACT.md` (new), `docs/AI-LANE-CONTRACT.md` (cross-link), and `docs/PIPELINE-SCRIPTS.md` (cross-link). Open design questions left for later beads: whether degraded success remains `status: success` vs a separate `partial_success`; whether each script should persist a canonical `result.json` vs letting the orchestrator synthesize one; whether stable `failure.code` values live in a shared registry; whether recovery needs explicit `executionId` lineage beyond `run.attempt`; and whether the top-level pipeline API should adopt the same envelope family.

---

## Success Criteria

- A durable universal success JSON contract exists.
- A durable universal failure JSON contract exists.
- The failure contract includes explicit recovery-policy fields for deterministic and AI recovery.
- The contracts are concrete enough to drive later architecture/implementation beads.

---

## Constraints

- This bead defines the envelopes first; it does not implement the entire recovery system.
- The contract must stay auditable and practical for downstream scripts.
- Do not start a golden run in this lane.

---

## Final Results

**Status:** ✅ Complete

**What We Built:** A durable universal success/failure contract for meaningful emotion-engine scripts, grounded in an audit of the repo’s actual current script families. The success contract standardizes a small envelope around lane-specific payloads. The failure contract standardizes machine-routable failure metadata, recovery policy, AI recovery budget, next-action policy, and structured diagnostics.

**Docs Changed:**
- `docs/UNIVERSAL-SCRIPT-RESULT-CONTRACT.md`
- `docs/AI-LANE-CONTRACT.md`
- `docs/PIPELINE-SCRIPTS.md`

**Commits:**
- Not created in this bead.

**Lessons Learned:** The repo already had enough real patterns to design the envelope without guessing: success is already converging naturally, but failure/recovery policy is still split across thrown errors, sidecars, and lane-local behavior. The hardest unresolved edge is degraded-but-usable output, with `video-chunks` as the main example.

---

*Completed on 2026-03-13.*
