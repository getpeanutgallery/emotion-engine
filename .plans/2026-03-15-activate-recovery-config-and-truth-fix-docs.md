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

**Status:** ⏳ Pending

**Results:** Pending.

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

**Status:** ⏳ Pending

**Results:** Pending.

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

**Status:** ⏳ Pending

**What We Built:** Pending.

**Commits:**
- Pending.

**Lessons Learned:** Pending.

---

*Drafted on 2026-03-15*