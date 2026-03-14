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
- `docs/ROLLOUT-FAMILIES-AND-SIBLING-IMPACT.md`
- `docs/PIPELINE-SCRIPTS.md`
- `README.md`
- `.plans/2026-03-14-ai-recovery-contract-and-sibling-rollout.md`

**Status:** ✅ Complete

**Results:** Added `docs/ROLLOUT-FAMILIES-AND-SIBLING-IMPACT.md` as the durable architecture map for the next rollout pass, then linked it from `README.md` and `docs/PIPELINE-SCRIPTS.md` so the mapping is discoverable beside the existing contract docs. The new rollout map groups `emotion-engine` into four concrete rollout families: (A) current meaningful AI lanes that already satisfy the validator-tool contract but still need the broader universal success/failure/recovery envelope, (B) computed/aggregation/report-formatting scripts that must adopt the universal script-result contract next, (C) deterministic tool-wrapper/artifact lanes that need explicit failure classifications and recovery declarations, and (D) shared orchestrator plumbing that should land first so the contract is not re-implemented differently per lane. The sibling impact map now explicitly bounds scope to `../ai-providers`, `../digital-twin-router`, `../digital-twin-core`, and conditionally `../tools`, while explicitly excluding `../retry-strategy` and `../goals` from this contract pass. This pass also records which existing beads are reused versus reframed: `ee-cib` is fully satisfied by the mapping/spec work, `ee-cwi` stays open as the sibling rollout epic, and `ee-vaa` remains the post-rollout sanity sweep rather than an early audit substitute. Recommended order is now explicit: shared plumbing in `emotion-engine`, then existing compliant AI lanes, then computed lanes, then tool-wrapper lanes, then sibling repos, then the final sanity sweep.

---

### Task 3: Define guardrails, cost controls, and kill conditions

**Bead ID:** `ee-ok2`  
**SubAgent:** `primary`  
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, claim bead ee-ok2 at start and close it when done. Define strict guardrails for deterministic + AI recovery: retry ceilings, cost/token ceilings, loop prevention, escalation stop conditions, mandatory raw/debug capture, and when the system must hard-fail instead of trying again. Update the relevant docs and plan with concrete policy decisions. Commit your work to main.`

**Folders Created/Deleted/Modified:**
- `docs/`
- `.plans/`

**Files Created/Deleted/Modified:**
- `docs/RECOVERY-GUARDRAILS-AND-BUDGET-POLICY.md`
- `docs/UNIVERSAL-SCRIPT-RESULT-CONTRACT.md`
- `docs/DETERMINISTIC-RECOVERY-FRAMEWORK.md`
- `docs/AI-RECOVERY-LANE-CONTRACT.md`
- `docs/ROLLOUT-FAMILIES-AND-SIBLING-IMPACT.md`
- `docs/PIPELINE-SCRIPTS.md`
- `README.md`
- `.plans/2026-03-14-ai-recovery-contract-and-sibling-rollout.md`

**Status:** ✅ Complete

**Results:** Added `docs/RECOVERY-GUARDRAILS-AND-BUDGET-POLICY.md` as the strict cross-cutting recovery policy for the whole architecture, then cross-linked it from the universal result, deterministic recovery, AI recovery, rollout-family, pipeline-script, and README docs so the guardrails are part of the durable contract stack rather than a loose note. The policy now makes the previously implicit safety boundaries explicit and auditable: deterministic recovery remains first and capped at 2 declared strategies per failure lineage by default; AI recovery is a one-shot fallback by default (`maxPerFailure: 1`, `maxPerScriptRun: 1`, `maxPerPipelineRun: 3`) with default ceilings of `12000` input tokens, `2000` output tokens, `14000` total tokens, `45000ms`, and `$0.25` cost per attempt. It also settles the counter semantics and loop-prevention model: script-run attempts, deterministic strategy consumption, AI recovery attempts, and provider/validator telemetry are separate counters; lineage may not be reset mid-failure; and the system must be able to prove from artifacts that it did not bounce indefinitely across retries, failover, AI recovery, and same-script re-entry. The doc further defines mandatory raw/debug capture requirements, explicit human-review vs hard-fail boundaries, immediate stop conditions for repeated `config`/`dependency` failures and repeated `internal` failures, and the rule that degraded success is allowed only when the lane-specific schema still holds and downstream continuation is explicitly safe.

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
- `docs/IMPLEMENTATION-EXECUTION-GRAPH.md`
- `docs/ROLLOUT-FAMILIES-AND-SIBLING-IMPACT.md`
- `README.md`

**Status:** ✅ Complete

**Results:** Created the concrete implementation graph in Beads and durable docs instead of leaving the rollout as prose-only architecture. New child implementation beads now encode the bounded dependency order inside `emotion-engine`: `ee-d4x.1` shared plumbing -> `ee-d4x.2` AI lanes -> `ee-d4x.3` computed/report lanes -> `ee-d4x.4` deterministic tool-wrapper lanes. The existing sibling-rollout epic `ee-cwi` is now the bounded cross-repo chain `ee-cwi.1` (`../ai-providers`) -> `ee-cwi.2` (`../digital-twin-router`) -> `ee-cwi.3` (`../digital-twin-core`) -> `ee-cwi.4` (conditional `../tools` alignment/deprecation decision). `ee-vaa` was explicitly reframed as the final post-rollout sanity sweep and wired to depend on `ee-d4x.4` plus `ee-cwi.3`, while keeping `ee-cwi.4` conditional if `../tools` remains relevant. Added `docs/IMPLEMENTATION-EXECUTION-GRAPH.md` as the durable execution map with repo ownership, recommended subagent type, dependency order, and a clear statement that adjacent investigations like `ee-58s`, `ee-5dv`, `ee-2fs`, `ee-0gv`, and `ee-03m` remain separate unless later evidence proves they are prerequisites.

---

### Task 5: Implement `ee-d4x.1` shared script-result + recovery plumbing in emotion-engine

**Bead ID:** `ee-d4x.1`  
**SubAgent:** `coder`
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, claim bead ee-d4x.1 immediately, then implement the shared repo-local plumbing that makes the universal contract executable across script families. Keep lane migrations out of scope except for minimal proving hooks; update durable docs and this active plan with what actually changed; run relevant validation/tests; commit to main; close the bead when finished.`

**Folders Created/Deleted/Modified:**
- `server/lib/`
- `server/lib/phases/`
- `test/lib/`
- `test/pipeline/`
- `test/scripts/`
- `docs/`
- `.plans/`

**Files Created/Deleted/Modified:**
- `server/lib/script-contract.cjs`
- `server/lib/script-runner.cjs`
- `server/lib/config-loader.cjs`
- `server/run-pipeline.cjs`
- `server/lib/phases/gather-context-runner.cjs`
- `server/lib/phases/process-runner.cjs`
- `server/lib/phases/report-runner.cjs`
- `test/lib/script-contract.test.js`
- `test/pipeline/config-loader.test.js`
- `test/scripts/phase1-raw-ffmpeg-namespacing.test.js`
- `docs/IMPLEMENTATION-EXECUTION-GRAPH.md`
- `.plans/2026-03-14-ai-recovery-contract-and-sibling-rollout.md`

**Status:** ✅ Complete

**Results:** Landed the first bounded implementation pass for `ee-d4x.1` on top of the previously written contract docs. The repo now has a shared runtime contract layer in `server/lib/script-contract.cjs` that builds canonical success/failure envelopes, centralizes deterministic recovery declaration lookup, classifies failures, computes next-action policy, tracks lineage, and persists per-script `script-results/` plus `recovery/` refs. `server/lib/script-runner.cjs` now wraps existing script modules so the phase runners can route all script families through the same contract seam without silently migrating the lane code itself. `config-loader.cjs` and `run-pipeline.cjs` now validate, normalize, and retain YAML-driven `recovery` policy/budget settings at runtime, while the phase runners persist shared execution metadata into `artifacts.__scriptExecution` for downstream migrations. Validation now includes new unit coverage for the contract layer plus recovery-config validation, and the repo-level test suite was brought back to green with a full `npm test` pass; the only extra test change outside the new plumbing coverage was updating the raw ffmpeg namespacing mock payloads so they match the current validator-tool contracts already enforced elsewhere in the suite.

### Task 6: Implement `ee-d4x.2` AI-lane unified envelope + bounded recovery rollout in emotion-engine

**Bead ID:** `ee-d4x.2`  
**SubAgent:** `coder`
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, claim bead ee-d4x.2 immediately, then migrate get-dialogue/get-music/video-chunks/recommendation onto the shared envelope + recovery runtime from ee-d4x.1. Preserve current semantics, reuse the existing validator-tool work, make deterministic recovery declarations explicit, add bounded AI recovery/re-entry where appropriate, update durable docs and this plan with what actually changed, run relevant validation, commit to main, and close the bead when finished.`

**Folders Created/Deleted/Modified:**
- `server/lib/`
- `server/scripts/get-context/`
- `server/scripts/process/`
- `server/scripts/report/`
- `test/lib/`
- `test/scripts/`
- `docs/`
- `.plans/`

**Files Created/Deleted/Modified:**
- `server/lib/script-contract.cjs`
- `server/lib/script-runner.cjs`
- `server/lib/ai-recovery-lane.cjs`
- `server/lib/ai-recovery-runtime.cjs`
- `server/scripts/get-context/get-dialogue.cjs`
- `server/scripts/get-context/get-music.cjs`
- `server/scripts/process/video-chunks.cjs`
- `server/scripts/report/recommendation.cjs`
- `test/lib/script-contract.test.js`
- `test/scripts/get-dialogue.test.js`
- `test/scripts/get-music.test.js`
- `test/scripts/video-chunks.test.js`
- `test/scripts/recommendation.test.js`
- `docs/IMPLEMENTATION-EXECUTION-GRAPH.md`
- `.plans/2026-03-14-ai-recovery-contract-and-sibling-rollout.md`

**Status:** ✅ Complete

**Results:** Landed the `ee-d4x.2` AI-lane rollout on top of the shared `ee-d4x.1` substrate instead of re-inventing per-lane wrappers. `server/lib/script-contract.cjs` now derives deterministic strategy applicability from the lane's configured retries/targets and classifies `invalid_output` failures explicitly enough to advance exhausted validator/tool-loop failures into the bounded AI recovery policy. `server/lib/script-runner.cjs` now invokes a new `server/lib/ai-recovery-lane.cjs` helper when the contract selects `ai_recovery`, persists recovery artifacts/prompts/results under the phase recovery tree, and re-enters the same script once with a bounded `recoveryRuntime`. The four targeted AI lanes (`get-dialogue`, `get-music`, `video-chunks`, `recommendation`) now export explicit AI-recovery metadata and append bounded repair/context instructions to their existing prompts via `server/lib/ai-recovery-runtime.cjs`, preserving their existing validator/tool-loop semantics while formalizing the outer success/failure + re-entry envelope. Validation covered the contract/runtime seam plus all four AI lanes with focused tests for bounded recovery prompt integration and same-script re-entry behavior.

### Task 7: Implement `ee-d4x.3` computed/report universal envelope rollout in emotion-engine

**Bead ID:** `ee-d4x.3`  
**SubAgent:** `coder`
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, claim bead ee-d4x.3 immediately, then roll the universal script-result contract into the computed/report lanes. Migrate video-per-second/metrics/emotional-analysis/summary/final-report onto the shared contract/runtime plumbing from ee-d4x.1, explicitly evaluate evaluation.cjs and decide whether it remains canonical, legacy-only, or retired, update durable docs and this plan with what actually changed, run relevant validation/tests, commit to main, and close the bead when finished.`

**Folders Created/Deleted/Modified:**
- `server/scripts/process/`
- `server/scripts/report/`
- `test/scripts/`
- `docs/`
- `.plans/`

**Files Created/Deleted/Modified:**
- `server/scripts/process/video-per-second.cjs`
- `server/scripts/report/metrics.cjs`
- `server/scripts/report/emotional-analysis.cjs`
- `server/scripts/report/summary.cjs`
- `server/scripts/report/final-report.cjs`
- `server/scripts/report/evaluation.cjs`
- `test/scripts/computed-report-contract.test.js`
- `docs/IMPLEMENTATION-EXECUTION-GRAPH.md`
- `docs/PIPELINE-SCRIPTS.md`
- `docs/UNIVERSAL-SCRIPT-RESULT-CONTRACT.md`
- `.plans/2026-03-14-ai-recovery-contract-and-sibling-rollout.md`

**Status:** ✅ Complete

**Results:** Landed the `ee-d4x.3` computed/report rollout on the shared `ee-d4x.1` contract seam instead of treating Phase 2/3 non-AI scripts as second-class citizens. `video-per-second.cjs`, `metrics.cjs`, `emotional-analysis.cjs`, `summary.cjs`, and `final-report.cjs` now all return lane-specific diagnostics/metrics/primary-artifact hints that the shared runtime persists into canonical success envelopes with `script-results/` and `recovery/` refs. The family now makes its degraded-success boundaries explicit: chunk-derived fallback and partial report rendering stay successful but flagged, while `video-per-second.cjs` now throws a structured `invalid_output` failure when no successful chunks remain to interpolate. `summary.cjs` now prefers canonical `phase3-report/summary/*` report links over the old evaluation root-path assumptions. `evaluation.cjs` was explicitly evaluated and retained as **legacy-only compatibility**, not the canonical Phase 3 path; it now self-reports that status through its diagnostics/metadata instead of silently looking equivalent to the canonical chain. Validation added focused coverage for the computed/report contract rollout, degraded-success envelopes, deterministic next-action behavior for unrecoverable interpolation input, canonical summary-link selection, and the legacy-only evaluation status.

## Current context from the handoff

- `ee-32e` was the explicit next pickup point from the prior session and is now complete.
- `ee-cib` is now complete and the rollout-family + sibling-scope map lives in `docs/ROLLOUT-FAMILIES-AND-SIBLING-IMPACT.md`.
- `ee-ok2` is now complete and the strict global guardrails live in `docs/RECOVERY-GUARDRAILS-AND-BUDGET-POLICY.md`.
- `ee-d4x` is now complete and the concrete implementation graph lives in `docs/IMPLEMENTATION-EXECUTION-GRAPH.md` plus the newly created child beads `ee-d4x.1` through `ee-d4x.4`.
- `ee-d4x.1` is now complete on `main`; the shared runtime contract/recovery plumbing is wired through the phase runners and the later lane migrations can build on that substrate instead of inventing their own wrappers.
- `ee-d4x.2` is now complete on `main`; the four current AI lanes ride the shared envelope/runtime seam, emit explicit bounded recovery metadata, and can perform one bounded same-script AI re-entry after deterministic validator/tool-loop recovery is exhausted.
- `ee-d4x.3` is now complete on `main`; the computed/report family now rides the same persisted success/failure envelope seam, declares bounded degraded-success behavior, and formally demotes `evaluation.cjs` to a legacy-only compatibility path.
- `ee-cwi` remains open for sibling repo implementation rollout, but it is now concretized into child beads `ee-cwi.1` through `ee-cwi.4` with explicit order and bounded repo scope.
- `ee-vaa` remains open as the final post-rollout sanity sweep, not an early audit substitute.
- We should not jump to another golden run yet; the architecture/recovery rollout is still in flight.

---

## Final Results

**Status:** ⚠️ Partial

**What We Built:** This plan now covers the full architecture-to-execution breakdown for the unified recovery rollout, and it now includes the first three live implementation beads instead of docs-only planning. The durable doc stack includes: (1) the bounded AI recovery lane contract in `docs/AI-RECOVERY-LANE-CONTRACT.md`, (2) the rollout-family + sibling-boundary map in `docs/ROLLOUT-FAMILIES-AND-SIBLING-IMPACT.md`, (3) the strict global guardrail policy in `docs/RECOVERY-GUARDRAILS-AND-BUDGET-POLICY.md`, (4) the concrete implementation bead graph in `docs/IMPLEMENTATION-EXECUTION-GRAPH.md`, (5) the shared runtime substrate in `server/lib/script-contract.cjs` + `server/lib/script-runner.cjs` wired through all three phase runners, (6) the live AI-lane rollout for `get-dialogue`, `get-music`, `video-chunks`, and `recommendation` with bounded same-script AI recovery artifacts/runtime plumbing, and now (7) the computed/report rollout for `video-per-second`, `metrics`, `emotional-analysis`, `summary`, and `final-report` with explicit degraded-success semantics and a formal legacy-only decision for `evaluation.cjs`. The bead graph remains explicit and bounded: `ee-d4x.1` shared plumbing -> `ee-d4x.2` AI lanes -> `ee-d4x.3` computed/report lanes -> `ee-d4x.4` deterministic tool-wrapper lanes -> `ee-cwi.1` ai-providers -> `ee-cwi.2` digital-twin-router -> `ee-cwi.3` digital-twin-core -> optional `ee-cwi.4` tools alignment/deprecation -> `ee-vaa` final sanity sweep. Existing open architecture beads are now properly reframed instead of left fuzzy: `ee-cwi` is the sibling-rollout epic with concrete child beads, `ee-vaa` is reserved for post-rollout audit work, and adjacent investigations like `ee-58s`, `ee-5dv`, `ee-2fs`, `ee-0gv`, and `ee-03m` remain intentionally separate unless later evidence proves they are rollout prerequisites.

**Commits:**
- `docs: map rollout families and sibling contract scope` (see recent `main` history)
- `docs: define recovery guardrails and budget policy` (see recent `main` history)
- `docs: add unified recovery execution graph beads`
- `feat: add shared script recovery plumbing` (see current `main` history)
- `feat: roll computed report lanes onto script-result contract` (see current `main` history)

**Lessons Learned:** Breaking the problem into architecture layers was necessary, but not sufficient; the handoff only became actually executable once the order was encoded in Beads and the remaining investigations were deliberately kept out of the rollout graph. The useful pattern here is: contract docs settle semantics, execution-graph docs settle ownership and order, and Beads settle what is truly blocked by what.

---

*Updated on 2026-03-14 after completing beads `ee-32e`, `ee-cib`, `ee-ok2`, `ee-d4x`, `ee-d4x.1`, `ee-d4x.2`, and `ee-d4x.3` contract/rollout implementation work.*
