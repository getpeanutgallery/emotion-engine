---
plan_id: plan-2026-03-15-validator-tool-loop-for-ai-recovery
bead_ids:
  - ee-qq5
  - ee-m4p
  - ee-eij
---
# emotion-engine: put AI recovery behind the validator-tool loop

**Date:** 2026-03-15  
**Status:** In Progress  
**Agent:** Cookie 🍪

---

## Goal

Bring the AI recovery lane up to the same structured-output standard as the rest of the meaningful AI lanes by making validator-mediated JSON acceptance mandatory instead of relying on direct JSON parsing alone.

---

## Overview

We inspected the live AI recovery lane and confirmed Derrick’s concern: while it is bounded and locally parsed, it still asks the recovery model to “return JSON only” and then accepts that output through direct JSON-object parsing. That is weaker than the validator-tool-loop contract now used in dialogue, stitch, music, emotion analysis, and recommendation.

This plan is narrowly scoped to fix that inconsistency before the next paid validation run. The recovery lane should define its own validator-tool contract, require the model to use it in the prompt, pass the recovery decision through the same validator-mediated acceptance path used elsewhere in emotion-engine, and reject malformed or out-of-contract recovery decisions deterministically before any same-script re-entry is allowed.

The owning repo is `emotion-engine`, because the recovery lane, validator loop, contract docs, tests, and next validation path all live here. This is not a sibling rollout task.

---

## Tasks

### Task 1: Define the AI recovery validator-tool contract

**Bead ID:** `ee-qq5`  
**SubAgent:** `primary`  
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, claim the assigned bead immediately. Define the validator-tool contract for the AI recovery lane: tool name, canonical tool-call envelope, accepted decision values, revised-input shape, and the exact bounded constraints the validator must enforce. Update the relevant docs and this plan with the concrete contract, keeping it aligned with the existing same-script-revised-input restrictions. Commit your work to main and close the bead.`

**Folders Created/Deleted/Modified:**
- `docs/`
- `.plans/`
- possibly `server/lib/` if the contract lives beside code helpers

**Files Created/Deleted/Modified:**
- `docs/AI-RECOVERY-LANE-CONTRACT.md`
- `.plans/2026-03-15-validator-tool-loop-for-ai-recovery.md`
- any small contract helper/doc file needed

**Status:** ✅ Complete

**Results:** Defined the dedicated AI recovery validator-tool contract in `docs/AI-RECOVERY-LANE-CONTRACT.md`. The concrete contract is: tool name `validate_ai_recovery_decision_json`; canonical tool-call envelope `{"tool":"validate_ai_recovery_decision_json","recoveryDecision":{...}}`; accepted `decision.outcome` values `reenter_script | hard_fail | human_review | no_change_fail`; canonical `revisedInput.kind` `same-script-revised-input`; and validator-enforced bounds that keep the mutable surface restricted to at most one `repairInstructions` change and one `boundedContextSummary` change, both using `op: "set"`, with no extra paths, no budget/schema/artifact mutation, and no revised input allowed for terminal decisions. The same doc was also tightened so the generic same-script re-entry section now matches the checked-in implementation instead of the older broader wording.

---

### Task 2: Implement validator-tool-loop enforcement for the AI recovery lane

**Bead ID:** `ee-m4p`  
**SubAgent:** `coder`  
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, claim the assigned bead immediately. Implement the AI recovery lane so it no longer relies on direct JSON parsing alone. Add a dedicated recovery validator tool contract, update the recovery prompt so tool usage is mandatory, route the recovery completion through the local validator-tool loop (or equivalent shared validator path used by the repo), preserve the existing bounded mutable-input restrictions, and ensure malformed/out-of-contract recovery decisions fail deterministically. Add or update tests, update this plan with exact files changed and validation evidence, commit to main, and close the bead.`

**Folders Created/Deleted/Modified:**
- `server/lib/`
- `test/lib/`
- `docs/`
- `.plans/`

**Files Created/Deleted/Modified:**
- `server/lib/ai-recovery-lane.cjs`
- `server/lib/ai-recovery-validator-tool.cjs`
- `server/lib/local-validator-tool-loop.cjs`
- `server/lib/script-contract.cjs`
- `test/lib/ai-recovery-validator-tool.test.js`
- `test/lib/script-contract.test.js`
- `docs/AI-RECOVERY-LANE-CONTRACT.md`
- `.plans/2026-03-15-validator-tool-loop-for-ai-recovery.md`

**Status:** ✅ Complete

**Results:**
- Replaced the AI recovery lane's direct `parseJsonObjectInput(...)` acceptance path with a dedicated `validate_ai_recovery_decision_json` validator-tool contract in `server/lib/ai-recovery-validator-tool.cjs`.
- Routed recovery completions through the shared `executeLocalValidatorToolLoop(...)` path, with a new `requireExplicitToolCallBeforeFinalArtifact` enforcement knob so this lane now **requires** an explicit validator-tool call before the final decision artifact is accepted.
- Preserved the bounded mutable-input contract: only `repairInstructions` and `boundedContextSummary` survive normalization into the re-entry package, and terminal outcomes reject non-empty `revisedInput.changes`.
- Added deterministic failure artifacts for malformed/out-of-contract recovery decisions: failed recovery attempts now persist `result.json`, `response.json`, and `tool-loop.json` with `decision.outcome = "no_change_fail"` instead of silently accepting plain JSON.
- Added/updated targeted coverage in `test/lib/ai-recovery-validator-tool.test.js` and `test/lib/script-contract.test.js`.
- Validation evidence: `node --test test/lib/ai-recovery-validator-tool.test.js test/lib/script-contract.test.js` ✅ (14 tests passed).

---

### Task 3: Verify readiness after the recovery validator upgrade

**Bead ID:** `ee-eij`  
**SubAgent:** `primary`  
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, claim the assigned bead immediately. After the AI recovery validator-tool contract and implementation land, verify that the recovery lane now uses mandatory validator mediation, that docs/tests match the implementation, and that the repo is truthfully ready for the next paid Phase3-only run. Run the relevant checks, update this plan with exact evidence and the precise next validation command, commit any final plan/doc touchups if needed, and close the bead.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- optionally `docs/`

**Files Created/Deleted/Modified:**
- `.plans/2026-03-15-validator-tool-loop-for-ai-recovery.md`

**Status:** ✅ Complete

**Results:** Verified the repo is now ready for the next paid Phase3-only run with the stronger AI recovery contract in place. Readiness evidence from this task:
- `server/lib/ai-recovery-validator-tool.cjs` now defines the dedicated lane validator `validate_ai_recovery_decision_json`, and grep verification confirms the recovery lane prompt explicitly requires validator-tool usage before final acceptance.
- `server/lib/ai-recovery-lane.cjs` now tells the recovery model: `You must use the provided local validator tool before any final AI recovery decision can be accepted.` and `Call the validator tool before returning the final decision artifact.`
- Targeted validator/recovery tests pass: `node --test test/lib/ai-recovery-validator-tool.test.js test/lib/script-contract.test.js` ✅ (14/14).
- Config validation still passes with recovery enabled: `npm run validate-configs` ✅.
- Phase3-only config still dry-runs cleanly: `node server/run-pipeline.cjs --config configs/cod-test-phase3.yaml --dry-run` ✅.

This means the next live run will now validate the stronger path Derrick asked for: bounded AI recovery with mandatory lane-specific validator-tool mediation instead of direct final JSON parsing. The truthful next paid lane remains a live Phase3-only run first, followed by inspection of the resulting recovery artifacts if it still fails, and only then a decision on full `cod-test`.

Exact next command to run from repo root:
- `node server/run-pipeline.cjs --config configs/cod-test-phase3.yaml --verbose`

If that succeeds under the upgraded recovery lane, the next full-run lane remains:
- `node server/run-pipeline.cjs --config configs/cod-test.yaml --verbose`

---

## Intended execution order

1. Task 1 — define the recovery validator-tool contract
2. Task 2 — implement validator-mediated enforcement in the recovery lane
3. Task 3 — verify readiness and restate the next live validation lane

Task 3 depends on Tasks 1 and 2.

---

## Constraints

- Keep the recovery lane bounded; do not broaden its mutable-input surface.
- Reuse the repo’s existing validator-tool-loop patterns where practical instead of inventing a one-off acceptance path.
- Do not reopen unrelated quality/grounding/FFmpeg/raw-folder work.
- The result should make the next paid run validate the stronger recovery contract, not the weaker old parse-only path.

---

## Final Results

**Status:** ✅ Complete

**What We Built:** A bounded upgrade of the AI recovery lane from parse-only JSON acceptance to mandatory validator-tool mediation. The repo now has: (1) a dedicated lane-specific validator-tool contract (`validate_ai_recovery_decision_json`), (2) recovery prompts that explicitly require validator-tool use before final decision acceptance, (3) validator-tool-loop enforcement in the live AI recovery lane implementation, (4) deterministic rejection and artifact persistence for malformed/out-of-contract recovery decisions, and (5) final readiness verification showing the next Phase3-only run will exercise the stronger recovery path rather than the old direct-parse fallback.

**Commits:**
- `e75f6ef` — `Define AI recovery validator tool contract`
- `6141468` — `Require validator tool loop for AI recovery lane`

**Lessons Learned:** The gap was not just structural validation but acceptance-path discipline. Even a bounded recovery lane can quietly weaken the architecture if it is allowed to bypass the same validator-tool contract used everywhere else. The fix was to make the acceptance path itself consistent, not just the output schema.

---

*Drafted on 2026-03-15*