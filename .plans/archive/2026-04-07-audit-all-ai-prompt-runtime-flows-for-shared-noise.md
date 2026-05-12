# emotion-engine: audit all AI prompt/runtime flows for shared prompt-noise and validator-loop issues

**Date:** 2026-04-07  
**Status:** Draft  
**Agent:** Cookie 🍪

---

## Goal

Audit the AI model call flows across all three phases of the emotion engine to determine whether they share the same core problems seen in dialogue: prompt noise, overexposed validator/tool-loop mechanics, unnecessary replayed conversation state, and redundant success-turn behavior.

---

## Overview

The dialogue prompt audit surfaced a likely structural issue: the model-facing prompt is under-specified on task behavior and over-specified on local validator/runtime mechanics. Derrick suspects this is not isolated to dialogue and may be a shared pattern across other AI-backed calls in phase 1, phase 2, and phase 3.

This lane should inspect the other AI modal call paths systematically before we implement the dialogue runtime cleanup. The goal is to map where prompts are built, how local validator loops are exposed to the model, whether replayed conversation state and turn budgets are injected, and whether the runtime redundantly asks the model to resend already-valid JSON. We want to know if the same cleanup pattern should be applied broadly.

The output should leave behind a durable audit of the AI call surfaces, a classification of which flows share the same design smell, and a recommendation for whether we should build a common runtime cleanup pattern across the engine.

---

## Tasks

### Task 1: Inventory AI-backed call surfaces across phase 1, phase 2, and phase 3

**Bead ID:** `Pending`  
**SubAgent:** `research`  
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, inventory the AI-backed call surfaces across phase 1, phase 2, and phase 3. Identify which scripts build prompts, which ones use local validator loops, and which ones persist runtime prompt artifacts. Update this plan truthfully with the exact surfaces to audit. Claim the assigned bead at start with bd update <ID> --status in_progress --json and close it on completion with bd close <ID> --reason "AI call surfaces inventoried" --json.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `server/`
- `configs/`
- `output/`

**Files Created/Deleted/Modified:**
- `.plans/2026-04-07-audit-all-ai-prompt-runtime-flows-for-shared-noise.md`
- exact audited files TBD

**Status:** ⏳ Pending

**Results:** Pending.

---

### Task 2: Audit each AI flow for shared prompt-noise / validator-loop problems

**Bead ID:** `Pending`  
**SubAgent:** `research`  
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, audit the inventoried AI-backed flows for the same core issues found in dialogue: prompt noise, exposed tool-contract mechanics, current-turn-budget clutter, replayed conversation state, weak invalid-JSON retry messaging, and redundant success-turn behavior after valid JSON. Write a durable audit doc under docs/ and update this plan truthfully with findings and doc path. Claim the assigned bead at start with bd update <ID> --status in_progress --json and close it on completion with bd close <ID> --reason "Cross-phase AI flow audit completed" --json.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `docs/`
- audited source folders TBD

**Files Created/Deleted/Modified:**
- `.plans/2026-04-07-audit-all-ai-prompt-runtime-flows-for-shared-noise.md`
- `docs/` (audit doc path TBD)

**Status:** ⏳ Pending

**Results:** Pending.

---

### Task 3: Recommend a common cleanup strategy before implementation

**Bead ID:** `Pending`  
**SubAgent:** `research`  
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, synthesize the cross-phase AI flow audit into a short recommendation: which flows clearly need the same cleanup pattern, which ones differ materially, and whether we should implement a common runtime/prompt simplification strategy before editing any one lane. Update this plan truthfully with that recommendation. Claim the assigned bead at start with bd update <ID> --status in_progress --json and close it on completion with bd close <ID> --reason "Common cleanup strategy summarized" --json.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `docs/`

**Files Created/Deleted/Modified:**
- `.plans/2026-04-07-audit-all-ai-prompt-runtime-flows-for-shared-noise.md`
- `docs/` (audit / recommendation doc if needed)

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

*Drafted on 2026-04-07*