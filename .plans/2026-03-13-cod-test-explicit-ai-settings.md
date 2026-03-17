---
plan_id: plan-2026-03-13-cod-test-explicit-ai-settings
bead_ids:
  - ee-cri
---
# emotion-engine: set explicit AI settings for every cod-test lane

**Date:** 2026-03-13  
**Status:** Complete  
**Agent:** Cookie 🍪

---

## Goal

Update `configs/cod-test.yaml` so every AI call explicitly sets `max_tokens: 25000` and `thinking.level: low`, making the golden-run config fully explicit and eliminating hidden low-budget defaults as a development-time failure source.

---

## Overview

The recent recommendation failure proved that silent output-budget constraints can masquerade as model/provider unreliability. Derrick’s direction is to intentionally use a high development ceiling so truncation bugs do not hide behind default settings. That means `25000` tokens — not `2500` — and `thinking.level: low` should be written directly into the golden-run config for every AI lane it defines.

This lane stayed deliberately narrow. It did not generalize defaults across the repo or run the full golden cod-test. Instead it made `configs/cod-test.yaml` explicit, then validated the resulting config with the repo’s existing YAML parse and pipeline dry-run tooling.

---

## Tasks

### Task 1: Inventory all AI lanes configured in `configs/cod-test.yaml`

**Bead ID:** `ee-cri`  
**SubAgent:** `main`  
**Prompt:** `You are executing bead ee-cri in /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine. Claim it immediately with \`bd update ee-cri --status in_progress --json\`. Inspect configs/cod-test.yaml and inventory every AI lane/target configured there that should carry explicit adapter params. Record the lanes and their current settings in this active plan file before editing.`

**Files Created/Deleted/Modified:**
- `configs/cod-test.yaml`
- `.plans/2026-03-13-cod-test-explicit-ai-settings.md`

**Status:** ✅ Complete

**Results:** Inventoried every configured AI lane and target in `configs/cod-test.yaml`. The file defines 5 AI lanes and 23 total targets that should all carry explicit normalized adapter params:
- `ai.dialogue` — 4 targets
  - `google/gemini-3.1-flash-lite-preview`
  - `openai/gpt-audio`
  - `openai/gpt-audio-mini`
  - `mistralai/voxtral-small-24b-2507`
- `ai.music` — 4 targets
  - `google/gemini-3.1-flash-lite-preview`
  - `openai/gpt-audio`
  - `openai/gpt-audio-mini`
  - `mistralai/voxtral-small-24b-2507`
- `ai.dialogue_stitch` — 5 targets
  - `openai/gpt-5.4`
  - `qwen/qwen3.5-397b-a17b`
  - `moonshotai/kimi-k2.5`
  - `z-ai/glm-5`
  - `minimax/minimax-m2.5`
- `ai.video` — 4 targets
  - `qwen/qwen3.5-397b-a17b`
  - `google/gemini-3.1-pro-preview`
  - `z-ai/glm-4.6v`
  - `bytedance-seed/seed-2.0-mini`
- `ai.recommendation` — 6 targets
  - `openai/gpt-5.4`
  - `z-ai/glm-5`
  - `qwen/qwen3.5-397b-a17b`
  - `moonshotai/kimi-k2.5`
  - `minimax/minimax-m2.5`
  - `google/gemini-3.1-pro-preview`

Before editing, only the final recommendation target (`google/gemini-3.1-pro-preview`) already carried explicit params. The other 22 targets did not.

---

### Task 2: Set explicit `max_tokens: 25000` and `thinking.level: low` for every AI call in `cod-test.yaml`

**Bead ID:** `ee-cri`  
**SubAgent:** `main`  
**Prompt:** `For bead ee-cri, update configs/cod-test.yaml so every configured AI call explicitly sets normalized adapter params with max_tokens: 25000 and thinking.level: low. Use 25000 exactly as the high development ceiling. Keep the config coherent and avoid changing unrelated semantics. Record the exact changed sections in the plan.`

**Files Created/Deleted/Modified:**
- `configs/cod-test.yaml`
- `.plans/2026-03-13-cod-test-explicit-ai-settings.md`

**Status:** ✅ Complete

**Results:** Added explicit normalized adapter params under every `adapter` entry in the AI config. Exact changed sections:
- `ai.dialogue.targets[*].adapter.params` added for all 4 dialogue targets
- `ai.music.targets[*].adapter.params` added for all 4 music targets
- `ai.dialogue_stitch.targets[*].adapter.params` added for all 5 dialogue stitch targets
- `ai.video.targets[*].adapter.params` added for all 4 video targets
- `ai.recommendation.targets[*].adapter.params` added for the first 5 recommendation targets; the 6th recommendation target already had the same explicit values and was kept coherent

Normalized params now present on all 23 targets:

```yaml
params:
  max_tokens: 25000
  thinking:
    level: low
```

No unrelated config semantics were changed.

---

### Task 3: Validate the config shape and summarize what this unlocks

**Bead ID:** `ee-cri`  
**SubAgent:** `main`  
**Prompt:** `For bead ee-cri, validate that the updated cod-test config is structurally correct using the repo's existing config/test tooling where appropriate. Summarize which AI lanes now explicitly carry max_tokens=25000 and thinking.level=low, update this plan with the exact validation performed, and close the bead with \`bd close ee-cri --reason "Explicit cod-test AI settings applied with 25000 token ceiling" --json\`.`

**Files Created/Deleted/Modified:**
- `configs/cod-test.yaml`
- `.plans/2026-03-13-cod-test-explicit-ai-settings.md`

**Status:** ✅ Complete

**Results:** Validated the updated config with the repo’s existing tooling without running the full cod-test:
- `npm run validate-configs`
  - Confirmed `configs/cod-test.yaml` still parses as valid single-document YAML
  - Also confirmed all repo YAML configs still parse cleanly
- `node server/run-pipeline.cjs --config configs/cod-test.yaml --dry-run`
  - Confirmed the pipeline loader accepts the updated config
  - Confirmed semantic validation passes (`Valid (8 script(s) across all phases)`)
  - Did not execute any pipeline scripts because `--dry-run` stops after config validation

This unlocks a trustworthy explicit dev-time reference config: every lane in the cod test now advertises the same intentionally high token ceiling and low thinking level directly in source, so silent per-target default budgets are no longer a hidden variable when debugging recommendation/report behavior.

---

## Success Criteria

- Every AI lane configured in `configs/cod-test.yaml` explicitly carries `max_tokens: 25000` and `thinking.level: low`.
- The config remains valid.
- The plan records exactly what changed.

---

## Constraints

- Used `25000`, not `2500`.
- Kept this lane focused on the config file and validation only.
- Did not run the full golden `cod-test`.

---

## Final Results

**Status:** ✅ Complete

**What We Built:** `configs/cod-test.yaml` now explicitly sets normalized adapter params on every configured AI target across dialogue, music, dialogue stitch, video, and recommendation lanes. All 23 targets now carry `max_tokens: 25000` and `thinking.level: low`.

**Commits:**
- None created in this subagent task.

**Lessons Learned:** The repo already has the right lightweight guardrails for this kind of change: `validate-configs` catches YAML shape issues quickly, and pipeline `--dry-run` confirms semantic acceptance without paying the cost or risk of a full run.

---

*Completed on 2026-03-13*
