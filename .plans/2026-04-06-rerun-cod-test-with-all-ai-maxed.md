# emotion-engine: rerun cod-test with all AI lanes maxed

**Date:** 2026-04-06  
**Status:** Complete  
**Agent:** Cookie 🍪

---

## Goal

Run a fresh `cod-test` using the newly edited active `configs/cod-test.yaml` after Derrick updated all AI usage in the config to use the max setting, then capture exactly how far the run gets and what failure or success shape appears.

---

## Overview

The prior extreme-budget rerun showed that pushing one lane to an absurd token ceiling can fail immediately at request validation with a max-context overflow. Derrick has since updated all AI usage in the active config again. This rerun should measure the real result of that latest full-config state rather than infer from the prior attempt.

We need a clean evidence package: exact command, log, timing, cassette if produced, and the freshest trustworthy output or failure artifacts. The main questions are whether the run clears the earlier Phase 1 failure family, whether it reaches Phase 2, and whether the new fully-maxed config introduces another request-shape or provider failure pattern.

---

## Tasks

### Task 1: Run fresh cod-test with the newly maxed active config and capture artifacts

**Bead ID:** `ee-bmuy`  
**SubAgent:** `primary`  
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, claim bead ee-bmuy immediately with \`bd update ee-bmuy --status in_progress --json\`, then run a fresh cod-test using the active configs/cod-test.yaml exactly as it exists now after Derrick's latest edits that maxed AI usage settings. Preserve the exact command, logs, timings, cassette path if produced, and output/archive artifacts. Compare the result against the immediately prior reruns, focusing on whether the earlier Phase 1 failures disappear, whether the run reaches Phase 2, and what the new failure or success shape is. Update this plan truthfully with exact paths and findings, do not push, and close the bead with a clear reason when finished.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `.logs/`
- `output/`

**Files Created/Deleted/Modified:**
- `.plans/2026-04-06-rerun-cod-test-with-all-ai-maxed.md`
- fresh rerun artifacts/logs/output archives

**Status:** ✅ Complete

**Results:** Claimed `ee-bmuy`, preserved the pre-run packet at `output/_archives/cod-test-pre-ee-bmuy-20260406-103012/`, and ran a fresh timed record-mode pipeline against the live `configs/cod-test.yaml`.

- **Exact command:** `set -o pipefail; set -a && . ./.env && set +a && export DIGITAL_TWIN_MODE=record && export DIGITAL_TWIN_CASSETTE="cod-test-record-20260406-103012-ee-bmuy-all-ai-maxed-rerun" && /usr/bin/time -p -o ".logs/cod-test-20260406-103012-ee-bmuy-all-ai-maxed-rerun.time" node server/run-pipeline.cjs --config configs/cod-test.yaml --verbose 2>&1 | tee ".logs/cod-test-20260406-103012-ee-bmuy-all-ai-maxed-rerun.log"`
- **Cassette:** `cod-test-record-20260406-103012-ee-bmuy-all-ai-maxed-rerun`
- **Log:** `.logs/cod-test-20260406-103012-ee-bmuy-all-ai-maxed-rerun.log`
- **Timing:** `.logs/cod-test-20260406-103012-ee-bmuy-all-ai-maxed-rerun.time` → `real 2.08`, `user 1.74`, `sys 0.13`
- **Fresh output root:** `output/cod-test/`
- **Primary failure artifact:** `output/cod-test/phase1-gather-context/script-results/get-dialogue.failure.json`
- **Provider capture with exact 400 payload:** `output/cod-test/phase1-gather-context/raw/ai/dialogue-chunks/chunk-0000/attempt-01/capture.json`
- **Event ledger:** `output/cod-test/_meta/events.jsonl`

Comparison against the immediately prior reruns:

- **Vs. `ee-r4u4`** (`.logs/cod-test-20260406-081320-ee-r4u4-reconciliation-rerun.log`, preserved output `output/_archives/cod-test-pre-ee-r4u4-20260406-081320/`): the earlier Phase 1 failures do **not** stay gone under the all-maxed config. `ee-r4u4` cleared Phase 1, completed Phase 2, and failed only at the benchmark stage after Phase 3. The fresh all-maxed rerun regressed back to an immediate Phase 1 `get-dialogue` failure and never reached Phase 2.
- **Vs. `ee-vri1`** (`.logs/cod-test-20260406-100543-ee-vri1-mimo-high-thinking-rerun.log`): `ee-vri1` also died in Phase 1 `get-dialogue`, but its failure shape was `OpenRouter: No content in response` after several provider round-trips. The fresh all-maxed rerun fails faster and earlier with an immediate fatal HTTP 400 on the first provider call.
- **Vs. `ee-h7fh`** (`.logs/cod-test-20260406-102409-ee-h7fh-extreme-budget-rerun.log`): the fresh run matches that newest failure family almost exactly. Both fail in Phase 1 `get-dialogue` on the first provider call with `OpenRouter: Request failed with status code 400`, never reach Phase 2, and show the same context-window overflow shape.

The new failure shape is now explicit in raw evidence instead of only the top-level stack trace. The capture at `output/cod-test/phase1-gather-context/raw/ai/dialogue-chunks/chunk-0000/attempt-01/capture.json` shows OpenRouter rejecting the request because the endpoint max context is `262144` tokens while the request asked for about `265712` tokens (`3568` input + `262144` output). In other words: after Derrick’s latest edits that maxed AI usage, the run falls back into the same invalid-request/context-overflow bucket as the extreme-budget rerun rather than the transient `No content in response` bucket, and it does **not** advance past Phase 1.

---

## Final Results

**Status:** ⚠️ Partial

**What We Built:** A truthful rerun evidence packet for the all-AI-maxed `configs/cod-test.yaml`, including the exact command, cassette, timing, fresh failure artifacts, and a direct comparison to the immediately prior reruns.

**Commits:**
- None. Per instruction, I did not push.

**Lessons Learned:** Maxing `max_tokens` across the active MiMo/OpenRouter lanes reintroduces an immediate Phase 1 invalid-request failure. The previous successful reconciliation-backed path (`ee-r4u4`) is not preserved under this config state; the run regresses before Phase 2. The fresh raw capture proves the failure is concrete context overflow (`~265712 requested > 262144 allowed`), not a later-stage provider hiccup.

---

*Started on 2026-04-06*
