---
plan_id: plan-2026-03-13-deterministic-recovery-framework
bead_ids:
  - ee-cjg
---
# emotion-engine: define deterministic recovery framework

**Date:** 2026-03-13  
**Status:** Complete  
**Agent:** Cookie 🍪

---

## Goal

Define the shared deterministic recovery framework for emotion-engine scripts: how scripts declare known recoveries, how retries/repairs are tracked, how recovery decisions are made consistently across phases, and how the framework composes with the universal success/failure envelopes.

---

## Overview

With the universal success/failure envelopes defined, the next architectural layer was deterministic recovery. The key requirement was to keep deterministic recovery ahead of AI recovery without reintroducing hidden per-script behavior. That meant this bead had to do two things: audit representative current behavior across script families, then turn that into one durable declaration-and-policy model that later rollout beads can implement consistently.

The repo already had meaningful retry and repair mechanics in AI lanes, especially around `executeWithTargets(...)` and validator-tool loops, but that behavior lived mostly in helpers, raw captures, and implicit control flow. Non-AI lanes mostly still throw plain errors or quietly degrade inside success payloads. The work here was therefore architectural, not implementation-heavy: define where recovery declarations live, what the failure envelope must say about attempted and remaining deterministic strategies, how `nextAction` is chosen, and what remains script-local versus helper-owned.

---

## Tasks

### Task 1: Audit current retry/repair behavior across representative scripts

**Bead ID:** `ee-cjg`  
**SubAgent:** `main`

**Files Modified:**
- `.plans/2026-03-13-deterministic-recovery-framework.md`
- `docs/DETERMINISTIC-RECOVERY-FRAMEWORK.md`

**Status:** ✅ Complete

**Results:**

Representative audit findings:

1. **AI structured-output lanes already have real deterministic recovery mechanics, but they are implicit.**
   - `server/lib/ai-targets.cjs` provides bounded same-target retry plus failover to later configured targets.
   - `server/lib/local-validator-tool-loop.cjs` provides bounded local repair loops with `maxTurns` and `maxValidatorCalls`.
   - `get-dialogue.cjs`, `get-music.cjs`, and `emotion-lenses-tool.cjs` all use the shared validator-tool loop; `recommendation.cjs` still carries a lane-local copy of the same pattern.
   - `video-chunks.cjs` adds script-local `shouldRetry(...)` decisions so parse/validation problems and provider errors can be handled differently.

2. **Attempt/failover evidence is strong operationally, but weak durably.**
   - Current AI lanes persist detailed events, raw provider captures, tool-loop history, validation summaries, and failover metadata.
   - However, the durable script result still does not emit one universal failure envelope with explicit deterministic strategy IDs, attempted strategies, remaining strategies, or next-action policy.

3. **Tool-wrapper / artifact lanes are mostly plain-error today.**
   - `get-metadata.cjs` and related ffmpeg/ffprobe paths capture useful raw artifacts when debug capture is on, but hard failures mostly still throw `Error(...)`.
   - Known deterministic recoveries are not explicitly declared, and many scripts cannot currently tell the orchestrator whether failure is terminal or merely lacks a formalized recovery contract.

4. **Computed / aggregation / rendering lanes already mix graceful degradation with hard failure.**
   - `video-per-second.cjs` excludes failed chunks and fills uncovered seconds with placeholders while still returning a usable artifact.
   - `summary.cjs` / `final-report.cjs` use defaults like “No recommendation available” when inputs are incomplete.
   - Those behaviors are useful, but they are not yet formalized as success-envelope degradation semantics, and hard failures still mostly surface as thrown errors.

5. **Main inconsistency:** the repo already has three families of deterministic behavior, but no shared declaration model.
   - AI retry/failover
   - bounded local repair loops
   - deterministic recompute/re-extract behavior in non-AI lanes

---

### Task 2: Define the deterministic recovery model and data shape

**Bead ID:** `ee-cjg`  
**SubAgent:** `main`

**Files Modified:**
- `docs/DETERMINISTIC-RECOVERY-FRAMEWORK.md`
- `docs/UNIVERSAL-SCRIPT-RESULT-CONTRACT.md`
- `.plans/2026-03-13-deterministic-recovery-framework.md`

**Status:** ✅ Complete

**Results:**

Defined the shared framework in `docs/DETERMINISTIC-RECOVERY-FRAMEWORK.md`.

Final model:

- **Deterministic recovery is a declared script capability, not an accidental side effect of helper code.**
- Each script or script family declares:
  - a recovery `family`
  - ordered `knownStrategies`
  - each strategy’s stable `id`
  - applicability rules (`when`)
  - helper/local executor ownership (`usesHelper`)
  - whether it consumes bounded deterministic budget
- The universal failure envelope remains the runtime source of truth.
- `recoveryPolicy.deterministic` now has concrete shared semantics for:
  - `family`
  - `strategyOrder`
  - `attempted`
  - `remaining`
  - `maxAttempts`
  - `attemptsUsed`

Tracking rules defined:

- `attempted` is the ordered list of declared deterministic strategies actually consumed in the current failure lineage.
- `remaining` is derived from the script’s declaration after filtering by failure applicability, already-consumed strategies, runtime/config eligibility, and budget.
- Budget counts declared recovery strategy consumption, not every low-level helper substep.

This keeps the recovery contract machine-routable while still allowing script families to map one declared strategy onto several lower-level operations.

---

### Task 3: Define boundaries between script-local logic and shared helpers

**Bead ID:** `ee-cjg`  
**SubAgent:** `main`

**Files Modified:**
- `docs/DETERMINISTIC-RECOVERY-FRAMEWORK.md`
- `.plans/2026-03-13-deterministic-recovery-framework.md`

**Status:** ✅ Complete

**Results:**

Shared/helper-owned responsibilities were defined as:

- envelope assembly primitives
- generic deterministic bookkeeping
- budget enforcement
- `remaining` derivation
- `nextAction` selection from already-populated policy blocks
- family-level execution mechanics like:
  - `executeWithTargets(...)`
  - `executeLocalValidatorToolLoop(...)`
- generic diagnostics shaping and event/raw-capture plumbing

Script-local responsibilities were defined as:

- failure classification
- script-local `failure.code` ownership
- deciding degraded success vs hard failure
- declaring which deterministic strategies are known and safe
- choosing which failure codes/diagnostics permit which strategies
- payload schema ownership and any script-specific recovery context

Key boundary rule recorded:

- if logic depends on understanding what a script-local failure code actually means, it stays local
- if logic only needs declared strategies, attempted state, and budget bookkeeping, it belongs in shared helpers

---

### Task 4: Verify clarity and close the bead

**Bead ID:** `ee-cjg`  
**SubAgent:** `main`

**Files Modified:**
- `docs/DETERMINISTIC-RECOVERY-FRAMEWORK.md`
- `docs/UNIVERSAL-SCRIPT-RESULT-CONTRACT.md`
- `docs/PIPELINE-SCRIPTS.md`
- `.plans/2026-03-13-deterministic-recovery-framework.md`

**Status:** ✅ Complete

**Results:**

Verified the framework is compatible with the agreed architecture decisions:

- **No `partial_success`:** deterministic recovery only applies to hard failures; degraded-but-usable outputs stay success envelopes.
- **Script-local failure codes:** the framework explicitly avoids creating a global failure-code registry.
- **Script-owned result envelopes:** the script remains the durable source of truth for failure and recovery policy.
- **Pipeline-level aggregation using the same family:** the framework explicitly requires the pipeline wrapper to reuse the same deterministic/AI/next-action vocabulary rather than inventing a second recovery language.

No golden run was started.

Bead closure reason prepared and executed after docs/plan updates.

---

## Success Criteria

- A durable deterministic recovery framework exists. ✅
- It is compatible with the universal success/failure contracts. ✅
- It clearly describes known recoveries, attempted recoveries, remaining recoveries, and next-action policy. ✅
- It distinguishes shared framework logic from script-local recovery logic. ✅

---

## Constraints

- This bead defined the framework first; it did not implement recovery everywhere. ✅
- Deterministic recovery remains auditable and bounded. ✅
- No golden run was started. ✅

---

## Docs Changed

- `docs/DETERMINISTIC-RECOVERY-FRAMEWORK.md`
  - new durable architecture doc
  - includes repo audit, declaration model, envelope mapping, next-action algorithm, helper boundaries, and rollout guidance
- `docs/UNIVERSAL-SCRIPT-RESULT-CONTRACT.md`
  - added cross-reference to the deterministic recovery framework doc for `recoveryPolicy.deterministic`
- `docs/PIPELINE-SCRIPTS.md`
  - added the new doc to the script/docs map so future maintainers can find it from the execution docs

---

## Remaining Open Questions

These were captured in the new framework doc for later beads:

1. exact declaration storage format
   - exported JS constants vs family helper builders vs adjacent JSON
2. attempt-lineage granularity
   - whether later rollout beads need optional per-strategy attempt detail beyond ordered `attempted`
3. pipeline aggregation detail
   - whether parent pipeline envelopes should expose only the next actionable child recovery or a fuller blocked-recovery summary

---

## Final Framework Summary

The deterministic recovery framework for emotion-engine is now:

- scripts declare their own bounded known deterministic recoveries
- those declarations remain script-local even when helpers execute the mechanics
- the universal failure envelope records ordered `attempted` and `remaining` deterministic strategies
- `nextAction` is chosen from explicit policy state, not from thrown-error guesswork or prose logs
- shared helpers own bookkeeping and execution mechanics
- scripts own failure codes, applicability rules, and payload semantics

That gives later rollout beads a concrete migration target without violating the repo decisions already made for universal envelopes.

---

## Final Results

**Status:** ✅ Complete

**What We Built:**

A durable deterministic recovery framework for emotion-engine, documented in repo docs and aligned with the universal script-result contract. The new framework explains how scripts declare recoveries, how failure envelopes track attempted and remaining deterministic strategies, how the next recovery action is chosen, and where helper responsibility stops and script ownership begins.

**Commits:**
- Not created in this bead.

**Lessons Learned:**

The repo already had strong deterministic recovery mechanics in AI lanes; the missing piece was not capability but contract. Making declaration and envelope state explicit is the main architectural unlock for later rollout beads.

---

*Completed on 2026-03-13*