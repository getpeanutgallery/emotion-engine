---
plan_id: plan-2026-03-13-generalize-ai-config-validation-and-grounding-followups
---
# emotion-engine: generalize AI config, validation, debug capture, and grounding follow-ups

**Date:** 2026-03-13  
**Status:** Draft  
**Agent:** Cookie 🍪

---

## Goal

Turn the recent error-taxonomy findings into concrete implementation beads that harden emotion-engine and its polyrepo siblings before the next golden run.

---

## Overview

The recent recommendation fix and error-taxonomy pass point to a broader conclusion: the current success path should not stay isolated to `recommendation.cjs`. Token budgets, thinking controls, provider-option overrides, structured JSON enforcement, and normalized debug/failure capture all need to become default infrastructure across the repo and likely across the sibling polyrepo code as well.

Derrick’s direction is to spend tokens freely during development to prove correctness and eliminate hidden instability. So the new default stance should be high output budget (`25000`) and low thinking, with YAML/config-level control everywhere, rather than small hardcoded caps or inconsistent provider defaults scattered across scripts.

There is also a distinct open question around the “stock assets / corporate footage” language. That may be a grounding bug, or it may be a legitimate output from an impatient-teen persona reacting harshly. That deserves its own explicit investigation bead rather than being buried inside broader taxonomy work.

---

## Proposed bead breakdown

### Bead A: Generalize default AI budgets + thinking controls across emotion-engine

**Proposed title:** `Generalize default AI max_tokens=25000 and thinking.level=low across emotion-engine`

**Why it exists:**
- Hardcoded or inconsistent defaults are now a known source of failure.
- We want a repo-wide default posture for development that is generous on output budget and conservative on thinking spend.

**Scope:**
- Find all AI call sites in emotion-engine.
- Replace ad hoc default budgets/thinking settings with normalized shared defaults.
- Ensure defaults are applied consistently unless explicitly overridden.
- Update tests/docs/configs.

**Expected outcome:**
- Emotion-engine defaults to `max_tokens: 25000` and `thinking.level: low` for AI calls unless a lane intentionally overrides them.

---

### Bead B: Ensure every AI call supports overrideable provider params like recommendation

**Proposed title:** `Add normalized provider-option override support to every AI call in emotion-engine + sibling repos`

**Why it exists:**
- The recommendation lane proved the value of per-call/provider overrides.
- Every AI lane should support the same override pathway, not just recommendation.

**Scope:**
- Audit emotion-engine AI call sites and polyrepo siblings.
- Standardize usage of the same normalized provider-option builder / param transport seam.
- Verify YAML/config overrides are honored in all relevant scripts.

**Expected outcome:**
- Consistent parameter override support across emotion-engine and sibling repos.

---

### Bead C: Enforce strict JSON validation and schema-bound outputs across all AI lanes

**Proposed title:** `Enforce schema-bound JSON outputs and validation tools across emotion-engine + sibling repos`

**Why it exists:**
- Structured-output failures are not limited to recommendation.
- Placeholder fallbacks and malformed outputs prove we need stricter contracts across all AI calls.

**Scope:**
- Inventory AI prompts and outputs across emotion-engine and siblings.
- Convert lanes toward required JSON outputs with explicit schemas.
- Add validator-tool / repair-loop patterns where appropriate.
- Remove or flag freeform-output lanes that should be structured.

**Expected outcome:**
- JSON becomes the default expected output format for AI calls across the stack.
- Validation/repair becomes standard instead of ad hoc.

---

### Bead D: Explicitly set all AI call settings in `configs/cod-test.yaml`

**Proposed title:** `Set explicit max_tokens=25000 and thinking.level=low for every AI call in cod-test.yaml`

**Why it exists:**
- The golden-run config should be explicit, not dependent on inference or hidden defaults.
- We want the test fixture to fully express the intended AI posture.

**Scope:**
- Update `configs/cod-test.yaml` so every configured AI lane explicitly sets:
  - `max_tokens: 25000`
  - `thinking.level: low`
- Validate that the config is complete and coherent.

**Expected outcome:**
- `cod-test.yaml` becomes an explicit reference config for the current development posture.

---

### Bead E: Extend normalized debug + failure capture across emotion-engine and sibling repos

**Proposed title:** `Audit and extend normalized provider debug/failure capture across emotion-engine + sibling repos`

**Why it exists:**
- We fixed an important part of this in `ee-1er`, but there are likely more AI scripts and sibling repos still missing the upgrade.
- Better debug capture should be shared infrastructure.

**Scope:**
- Scan emotion-engine and sibling repos for AI error persistence and raw-capture writers.
- Find locations still relying on narrow `error.response.*` assumptions or weak persistence.
- Upgrade them to use normalized persisted debug/failure capture.

**Expected outcome:**
- Consistent provider-debug and failure metadata across repos/phases.

---

### Bead F: Investigate whether “stock assets / corporate footage” language is hallucination vs persona judgment

**Proposed title:** `Investigate stock-assets language: grounding bug vs persona-consistent judgment`

**Why it exists:**
- This is a distinct analytical question, not just a generic grounding concern.
- We need to know whether the language is factually ungrounded or just harsh but valid persona framing.

**Scope:**
- Review the flagged chunk outputs and recommendation artifacts.
- Compare the outputs to actual video content and prompt/persona instructions.
- Determine whether the issue is hallucinated factual content, overly aggressive summarization, or expected persona behavior.

**Expected outcome:**
- Clear verdict on whether these outputs represent a true bug.
- If buggy, identify the upstream lane responsible.

---

### Bead G: Investigate provider "no content" failures as a separate root-cause lane

**Proposed title:** `Investigate Phase 2 provider_no_content failures and whether they are budget-related`

**Why it exists:**
- You called out a valid uncertainty: OpenRouter empty/no-content failures may not actually be a provider flake.
- They could be a secondary symptom of token-budget / output-shape issues.

**Scope:**
- Revisit the 11 `provider_no_content` failures from Phase 2.
- Compare request budgets, provider usage fields, and raw error/debug capture.
- Determine whether these are true transport/provider-empty failures or hidden truncation/budget pathology.

**Expected outcome:**
- Better classification of the biggest failure bucket from the report.
- Decide whether to treat this as provider reliability, config policy, or structured-output design.

---

## Suggested execution order after current sequence

1. Bead D — make `cod-test.yaml` explicit everywhere
2. Bead A — repo-wide defaults for budgets/thinking
3. Bead B — override support everywhere
4. Bead C — strict JSON validation/tooling everywhere
5. Bead E — scan/upgrade normalized debug capture across siblings
6. Bead G — revisit provider_no_content with improved visibility
7. Bead F — stock-assets language investigation

Reasoning:
- First make the main config explicit.
- Then make defaults and override support systemic.
- Then enforce structured outputs.
- Then broaden debug observability.
- Then revisit ambiguous failure buckets and semantic anomalies with better infrastructure in place.

---

## Notes

- This plan does **not** replace the currently active sequence (`ee-03m`, `ee-0gv`, `ee-2fs`) unless Derrick chooses to reprioritize.
- It turns the new recommendations into concrete future beads so we can decide whether to inject them into the pre-golden-run sequence now or queue them immediately after the current ordered work.

---

## Final Results

**Status:** ⏳ Pending

**What We Built:** Pending.

**Commits:**
- Pending.

**Lessons Learned:** Pending.

---

**Question for Derrick:** Is this bead breakdown ready for me to create in Beads, and do you want these inserted ahead of `ee-03m` or queued right after the current sequence?
