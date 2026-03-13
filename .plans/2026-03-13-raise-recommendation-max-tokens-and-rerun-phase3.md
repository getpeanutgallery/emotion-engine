# emotion-engine: raise recommendation max_tokens and rerun Phase 3

**Date:** 2026-03-13  
**Status:** Complete  
**Agent:** Cookie 🍪

---

## Goal

Update the Phase 3 recommendation lane to use `max_tokens: 25000` and `thinking.level: low`, then rerun the real Phase 3-only path to see whether the recommendation step now completes or gets materially closer.

---

## Overview

The production-path capture lane proved the previous recommendation failure was not a local extraction bug. The live provider request was reaching OpenRouter correctly, but the response kept terminating with `finish_reason: "length"` while reasoning consumed most of the completion budget. We then added normalized YAML controls so token budgets and thinking intensity can be configured in YAML and verified that those values now appear in captured provider requests.

Derrick’s current hypothesis is that the remaining failure is primarily a budget issue rather than a protocol issue. This lane tests that hypothesis directly by increasing the recommendation target’s `max_tokens` to `25000` while keeping `thinking.level: low`, then rerunning the same real Phase 3-only lane with full request/response capture preserved.

---

## Tasks

### Task 1: Update the Phase 3 recommendation config

**Bead ID:** `ee-i7b`  
**SubAgent:** `main`  
**Prompt:** `You are executing bead ee-i7b in /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine. Claim it immediately with \`bd update ee-i7b --status in_progress --json\`. Update the Phase 3 recommendation config so the real recommendation target uses normalized YAML params with \`max_tokens: 25000\` and \`thinking.level: low\`. Record the exact changed config in this active plan file before rerunning anything.`

**Files Created/Deleted/Modified:**
- `configs/cod-test-phase3.yaml`
- `.plans/2026-03-13-raise-recommendation-max-tokens-and-rerun-phase3.md`

**Status:** ✅ Complete

**Results:** Updated `configs/cod-test-phase3.yaml` so `ai.recommendation.targets[0].adapter.params` is now:

```yaml
params:
  max_tokens: 25000
  thinking:
    level: low
```

This preserves the normalized YAML shape already validated by the production-path capture lane and raises the recommendation budget from `900` to `25000` before rerunning.

---

### Task 2: Rerun the real Phase 3-only lane

**Bead ID:** `ee-i7b`  
**SubAgent:** `main`  
**Prompt:** `For bead ee-i7b, rerun the real production Phase 3-only lane using the updated config. Do not run full cod-test. Preserve the resulting logs and raw recommendation capture artifacts so we can inspect the exact provider request and response. Record the command and artifact paths in the active plan.`

**Files Created/Deleted/Modified:**
- `output/_logs/*`
- `output/cod-test/phase3-report/raw/ai/recommendation/*`
- `.plans/2026-03-13-raise-recommendation-max-tokens-and-rerun-phase3.md`

**Status:** ✅ Complete

**Results:** Ran the real production Phase 3-only lane (not full cod-test) with:

```bash
AI_API_KEY="$OPENROUTER_API_KEY" node server/run-pipeline.cjs --config configs/cod-test-phase3.yaml --verbose
```

Dedicated rerun log:
- `output/_logs/phase3-max-tokens-25000-rerun-20260313-104711.log`

Primary captured recommendation artifacts:
- `output/cod-test/phase3-report/raw/ai/recommendation/attempt-01/capture.json`
- `output/cod-test/phase3-report/raw/ai/recommendation/recommendation.json`
- `output/cod-test/phase3-report/recommendation/recommendation.json`
- `output/cod-test/phase3-report/summary/summary.json`
- `output/cod-test/phase3-report/summary/FINAL-REPORT.md`

This rerun completed successfully end-to-end. Recommendation succeeded on attempt 1 and Phase 3 finished cleanly.

---

### Task 3: Evaluate the outcome against ee-5dv

**Bead ID:** `ee-i7b`  
**SubAgent:** `main`  
**Prompt:** `For bead ee-i7b, inspect the rerun artifacts and determine whether raising max_tokens to 25000 with thinking.level=low allowed recommendation to complete, materially improved it, or failed in a new way. Compare finish reasons, response completeness, and any remaining blockers. Update this plan with concrete evidence and close the bead with \`bd close ee-i7b --reason "Raised recommendation max_tokens and evaluated real Phase 3 rerun" --json\`.`

**Files Created/Deleted/Modified:**
- `.plans/2026-03-13-raise-recommendation-max-tokens-and-rerun-phase3.md`
- rerun artifacts under `output/`

**Status:** ✅ Complete

**Results:** The rerun did more than materially improve; it cleared the recommendation failure entirely.

Concrete evidence from `output/cod-test/phase3-report/raw/ai/recommendation/attempt-01/capture.json`:
- `adapter.params.max_tokens` = `25000`
- `adapter.params.thinking.level` = `low`
- `providerRequest.body.max_tokens` = `25000`
- `providerRequest.body.reasoning.effort` = `low`
- `providerResponse.body.choices[0].finish_reason` = `"stop"`
- `providerResponse.body.usage.completion_tokens` = `511`
- `providerResponse.body.usage.completion_tokens_details.reasoning_tokens` = `43`

Outcome comparison versus the prior failure lane (`ee-5dv` context / earlier production-path capture):
- Before: recommendation failed after 3 attempts with `invalid_output: response was not valid JSON`, and the captured provider response terminated with `finish_reason: "length"` while hidden/auxiliary reasoning consumed most of the budget.
- Now: recommendation succeeded on the first attempt, returned valid JSON, passed the local validator, wrote `phase3-report/recommendation/recommendation.json`, and allowed the entire Phase 3 report chain to complete.
- The new request was definitely sent with the intended normalized YAML values, and the resulting response no longer showed truncation.

Remaining blocker assessment:
- For this exact real Phase 3 production lane, there is no remaining recommendation-generation blocker after raising `max_tokens` to `25000` with `thinking.level: low`.
- Any future failures should be treated as separate regressions, not as unresolved continuation of the earlier truncation state.

---

## Success Criteria

- The config is updated to `max_tokens: 25000` and `thinking.level: low`.
- The real Phase 3-only lane is rerun with captured request/response artifacts.
- We can see in the captured provider request that the new values were actually sent.
- We determine whether the recommendation lane now succeeds or how far it gets.

---

## Constraints

- Stay on the real production recommendation path.
- Do not run full `cod-test`.
- Preserve artifacts for inspection.

---

## Final Results

**Status:** ✅ Complete

**What We Built:** Raised the recommendation target budget in `configs/cod-test-phase3.yaml` to use normalized YAML params `max_tokens: 25000` plus `thinking.level: low`, then reran the real Phase 3-only production lane and verified from the captured provider request that those values were actually sent. The rerun produced a valid recommendation on attempt 1 and completed the full Phase 3 report chain successfully.

**Commits:**
- Pending.

**Lessons Learned:** The earlier recommendation failure was materially a token-budget/truncation issue on this lane, not a local extraction bug. Once the request carried `max_tokens: 25000` with low thinking effort, Gemini returned valid JSON with `finish_reason: "stop"` and only `43` reasoning tokens instead of exhausting the completion budget.

---

*Completed on 2026-03-13.*
