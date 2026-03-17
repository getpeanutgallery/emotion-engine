---
plan_id: plan-2026-03-15-activate-recovery-config-and-truth-fix-docs
bead_ids:
  - ee-cfx
  - ee-nau
  - ee-9be
---
# emotion-engine: activate recovery config and truth-fix docs

**Date:** 2026-03-15  
**Status:** In Progress  
**Agent:** Cookie 🍪

---

## Goal

Turn the newly implemented recovery system into truthful, runnable reality by activating it in the intended validation configs and bringing docs/history notes back into sync before the next paid live run.

---

## Overview

The verification pass established that the recovery/runtime rollout is materially implemented in code and aligned across the relevant sibling repos, but the runnable configs do not currently activate the AI recovery lane. That means another paid Phase3-only run right now would not answer the important question: whether the new bounded AI recovery path actually works end-to-end under real configuration.

This plan is intentionally bounded. It does not broaden scope into unrelated cleanups like FFmpeg YAML exposure, raw-folder restructuring, or recommendation grounding audits. Instead it focuses on the exact blocker between the current state and a meaningful next live validation: explicit `recovery:` activation in the intended runnable configs, plus truth-fixes to docs and historical plan/audit notes that still describe the rollout as partially future work.

The owning repo remains `emotion-engine`, because that is where the runnable configs, contract docs, and canonical execution plans live. The sibling `tools` repo is in scope only for a small historical audit addendum because one of its March 14 docs still implies the ownership cutover is unfinished.

---

## Tasks

### Task 1: Activate bounded recovery config in runnable validation YAMLs

**Bead ID:** `ee-cfx`  
**SubAgent:** `coder`  
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, claim the assigned bead immediately. Add explicit top-level recovery configuration to the intended runnable validation configs, especially configs/cod-test.yaml and configs/cod-test-phase3.yaml, so the implemented AI recovery lane is actually active for the next live validation. Keep the config bounded and consistent with the current runtime defaults/guardrails unless there is a strong repo-local reason to differ. Update any config validation/tests that must change, verify the relevant tests or validators, then update this plan with exactly what changed and close the bead.`

**Folders Created/Deleted/Modified:**
- `configs/`
- `.plans/`

**Files Created/Deleted/Modified:**
- `configs/cod-test.yaml`
- `configs/cod-test-phase3.yaml`
- `.plans/2026-03-15-activate-recovery-config-and-truth-fix-docs.md`

**Status:** ✅ Complete

**Results:** Added an explicit top-level bounded `recovery:` block to the two intended runnable validation configs: `configs/cod-test.yaml` and `configs/cod-test-phase3.yaml`. The activation stays aligned with the live runtime defaults and guardrails from `server/lib/script-contract.cjs`, with the only intentional behavioral change being that AI recovery is now turned on and pointed at a real runnable provider/model pair required by `server/lib/script-runner.cjs` (`recovery.ai.enabled: true`, `adapter: openrouter`, `model: google/gemini-3.1-pro-preview`).

Active recovery settings now checked into both configs:
- deterministic: `maxAttemptsPerFailure: 2`, `maxRepeatedStrategyUsesPerFailure: 1`
- ai lane: `enabled: true`, `lane: structured-output-repair`, `adapter: openrouter`, `model: google/gemini-3.1-pro-preview`, `temperature: 0`, `timeoutMs: 45000`
- ai attempt ceilings: `maxPerFailure: 1`, `maxPerScriptRun: 1`, `maxPerPipelineRun: 3`
- ai budgets: `maxInputTokens: 12000`, `maxOutputTokens: 2000`, `maxTotalTokens: 14000`, `maxCostUsd: 0.25`

No config-schema or test code changes were required because the recovery schema/runtime validation was already implemented. Validation evidence for this task:
- `npm run validate-configs` ✅
- `node server/run-pipeline.cjs --config configs/cod-test.yaml --dry-run` ✅
- `node server/run-pipeline.cjs --config configs/cod-test-phase3.yaml --dry-run` ✅
- `node --test test/lib/script-contract.test.js test/pipeline/config-loader.test.js` ✅ (56 passing)

---

### Task 2: Truth-fix the recovery docs and rollout history

**Bead ID:** `ee-nau`  
**SubAgent:** `primary`  
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, claim the assigned bead immediately. Update the recovery/config docs and bounded historical records so they match the current live implementation. At minimum, truth-fix docs/AI-RECOVERY-LANE-CONTRACT.md, docs/CONFIG-GUIDE.md, docs/ROLLOUT-FAMILIES-AND-SIBLING-IMPACT.md, and append closure/current-state notes where needed to historical plan/audit files, including the relevant tools-repo audit note if it still implies future cutover work. Keep the changes precise and documentary rather than rewriting history. Update this plan with exact files changed and close the bead.`

**Folders Created/Deleted/Modified:**
- `docs/`
- `.plans/`
- `../tools/docs/`

**Files Created/Deleted/Modified:**
- `docs/AI-RECOVERY-LANE-CONTRACT.md`
- `docs/CONFIG-GUIDE.md`
- `docs/ROLLOUT-FAMILIES-AND-SIBLING-IMPACT.md`
- `.plans/2026-03-14-ai-recovery-contract-and-sibling-rollout.md`
- `../tools/docs/EMOTION-LENSES-ALIGNMENT-AUDIT-2026-03-14.md`
- `.plans/2026-03-15-activate-recovery-config-and-truth-fix-docs.md`
- any small current-state pointer updates that are clearly needed

**Status:** ✅ Complete

**Results:** Truth-fixed the active recovery/config docs and added bounded closure notes to the historical rollout records instead of rewriting them in place. Exact files changed for this task:
- `docs/AI-RECOVERY-LANE-CONTRACT.md`
- `docs/CONFIG-GUIDE.md`
- `docs/ROLLOUT-FAMILIES-AND-SIBLING-IMPACT.md`
- `.plans/2026-03-14-ai-recovery-contract-and-sibling-rollout.md`
- `../tools/docs/EMOTION-LENSES-ALIGNMENT-AUDIT-2026-03-14.md`
- `.plans/2026-03-15-activate-recovery-config-and-truth-fix-docs.md`

Findings recorded in the doc fixes:
- `docs/AI-RECOVERY-LANE-CONTRACT.md` now matches the checked-in implementation more closely: the live re-entry patch surface is `repairInstructions` + `boundedContextSummary`, and the live `revisedInput.kind` is `same-script-revised-input`.
- `docs/CONFIG-GUIDE.md` now documents the live `recovery:` YAML surface validated by `server/lib/script-contract.cjs`, including the fact that omission is valid and defaults AI recovery to disabled unless a config explicitly enables it with `adapter` + `model`.
- `docs/ROLLOUT-FAMILIES-AND-SIBLING-IMPACT.md` now carries a 2026-03-15 closure addendum so its pre-implementation gap language is not mistaken for current state, and its Phase 2 helper reference now points at the live sibling-owned `../tools/emotion-lenses-tool.cjs` path.
- `.plans/2026-03-14-ai-recovery-contract-and-sibling-rollout.md` now has explicit closure addenda marking the old `ee-cwi.4` audit text as historical and clarifying that the later direct `../tools` cutover already landed.
- `../tools/docs/EMOTION-LENSES-ALIGNMENT-AUDIT-2026-03-14.md` now carries a closure addendum instead of an open-ended follow-up note, so it no longer implies the engine-local ownership removal is still undone.

Validation for this task was documentary rather than behavioral: reviewed the docs against the live implementation/config seams in `server/lib/script-contract.cjs`, `server/lib/script-runner.cjs`, `server/lib/ai-recovery-lane.cjs`, `server/scripts/process/video-chunks.cjs`, `configs/cod-test.yaml`, `configs/cod-test-phase3.yaml`, and `../tools/README.md`, then confirmed clean patch formatting with `git diff --check` in both repos.

---

### Task 3: Verify readiness for the next paid Phase3-only run

**Bead ID:** `ee-9be`  
**SubAgent:** `primary`  
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, claim the assigned bead immediately. After Tasks 1 and 2 complete, verify that the intended runnable configs now activate the bounded recovery lane, that the docs no longer misstate the implementation, and that the repo is truthfully ready for the next paid Phase3-only validation. Run the relevant config/test checks, update this plan with exact evidence, summarize the precise next command/lane to run, and close the bead.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- optionally `docs/` if a tiny final truth note is needed

**Files Created/Deleted/Modified:**
- `.plans/2026-03-15-activate-recovery-config-and-truth-fix-docs.md`

**Status:** ✅ Complete

**Results:** Verified the repo is now truthfully ready for the next paid Phase3-only validation. Evidence checked after Tasks 1 and 2 landed: (1) both runnable validation configs now contain an explicit top-level `recovery:` block with bounded AI recovery activation (`configs/cod-test.yaml:47-66`, `configs/cod-test-phase3.yaml:45-64`), including the required gate fields `recovery.ai.enabled: true`, `adapter: openrouter`, and `model: google/gemini-3.1-pro-preview`; (2) config parsing and dry-run validation still pass with recovery enabled; and (3) the previously stale recovery/config/history docs were truth-fixed so the docs layer no longer contradicts the checked-in implementation. Fresh readiness evidence gathered in this task:
- `git status --short` shows no new functional config drift after the Task 1 / Task 2 commits; only the expected local plan-tracking update remains uncommitted during this verification step.
- `npm run validate-configs` ✅
- `node server/run-pipeline.cjs --config configs/cod-test-phase3.yaml --dry-run` ✅
- direct grep verification confirms both configs carry the active `recovery` block and required AI activation keys.

Truthful next paid lane:
1. run the Phase3-only live validation first, now that recovery is actually enabled in config;
2. inspect the resulting recovery artifacts / raw captures if recommendation still fails;
3. only then decide whether to continue to full `configs/cod-test.yaml` or branch into a narrower bug lane like `ee-5dv` / `ee-2fs`.

Exact next command to run from repo root:
- `node server/run-pipeline.cjs --config configs/cod-test-phase3.yaml --verbose`

If that Phase3-only run succeeds under the activated recovery config, the next full-run lane should be:
- `node server/run-pipeline.cjs --config configs/cod-test.yaml --verbose`

---

## Intended execution order

1. Task 1 — activate recovery config in runnable YAMLs
2. Task 2 — truth-fix docs/history so they match the live code/config
3. Task 3 — verify readiness and name the exact next live validation lane

Task 3 depends on Tasks 1 and 2.

---

## Constraints

- Do not broaden into unrelated architecture cleanups.
- Keep recovery activation bounded to the current guardrails unless repo evidence justifies a different value.
- Do not rewrite historical docs as if they were always current; append truth notes where possible.
- The output of this plan should make the next Phase3-only run meaningful, not just possible.

---

## Final Results

**Status:** ✅ Complete

**What We Built:** A bounded activation-and-truth-fix pass that turned the recovery architecture from “implemented but not actually exercised by the runnable validation configs” into a truthful, ready-for-validation repo state. The plan now records: (1) explicit bounded `recovery:` activation in `configs/cod-test.yaml` and `configs/cod-test-phase3.yaml`, (2) documentation of the live YAML activation gate and narrower same-script re-entry semantics, (3) closure/current-state addenda on the March 14 rollout/history docs so they are no longer misleading, and (4) final readiness verification showing the next paid lane is now meaningfully the live Phase3-only run.

**Commits:**
- `d02991f` — `Activate bounded recovery in validation configs`
- `85269ae` — `docs: truth-fix recovery rollout records`
- `abc7786` in `../tools` — `docs: close emotion lenses alignment audit note`

**Lessons Learned:** The difference between “architecture landed” and “system is ready to validate” was one layer lower than the code itself: runnable YAML activation and truthful docs. Getting that layer right matters because otherwise a paid validation run can give the illusion of testing a new recovery path while silently exercising the old disabled state instead.

---

*Drafted on 2026-03-15*