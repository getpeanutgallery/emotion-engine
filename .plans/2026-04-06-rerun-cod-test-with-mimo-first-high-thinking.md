# emotion-engine: rerun cod-test with MiMo-first high-thinking config

**Date:** 2026-04-06
**Status:** Partial
**Agent:** Cookie 🍪

---

## Goal

Run a fresh `cod-test` using the newly edited active `configs/cod-test.yaml` that now prioritizes MiMo first across non-recovery AI lanes, then review whether the run completes cleanly and what the new output quality / failure shape looks like.

---

## Overview

Derrick manually tuned the active config to use MiMo-first targets with high thinking, larger token budgets, and longer timeouts. The next step is a clean rerun against that active config rather than another sidecar config, so the evidence reflects the exact settings now present in `configs/cod-test.yaml`.

This rerun should preserve full evidence: exact command, log, timing, cassette if applicable, output archive, and a concise comparison against the prior reconciliation-backed runs. We especially care whether the recurring Phase 2 stall is reduced or eliminated under the new MiMo-first whole-video/analysis routing and whether the resulting outputs remain grounded.

---

## Tasks

### Task 1: Run fresh cod-test with active MiMo-first config and capture artifacts

**Bead ID:** `ee-vri1`
**SubAgent:** `primary`
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, claim bead ee-vri1 immediately with \`bd update ee-vri1 --status in_progress --json\`, then run a fresh cod-test using the active configs/cod-test.yaml exactly as it exists now. Preserve the exact command, logs, timings, and output/archive artifacts. Compare the result against the most relevant recent reconciliation-backed runs, focusing on whether the run completes, whether Phase 2 still stalls, and any obvious output-quality or grounding changes attributable to the MiMo-first high-thinking config. Update this plan truthfully with exact paths and findings, do not push, and close bead ee-vri1 with a clear reason when finished.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `.logs/`
- `output/`

**Files Created/Deleted/Modified:**
- `.plans/2026-04-06-rerun-cod-test-with-mimo-first-high-thinking.md`
- fresh rerun artifacts/logs/output archives

**Status:** ✅ Complete

**Results:** Claimed `ee-vri1`, then ran a fresh rerun from repo root with the active `configs/cod-test.yaml` exactly as present at run time. Exact command preserved in `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/.tmp-ee-vri1-cmd`:

```bash
set -o pipefail; set -a && . ./.env && set +a && export DIGITAL_TWIN_MODE="record" && export DIGITAL_TWIN_CASSETTE="cod-test-record-20260406-100543-ee-vri1-mimo-high-thinking-rerun" && /usr/bin/time -p -o ".logs/cod-test-20260406-100543-ee-vri1-mimo-high-thinking-rerun.time" node server/run-pipeline.cjs --config configs/cod-test.yaml --verbose 2>&1 | tee ".logs/cod-test-20260406-100543-ee-vri1-mimo-high-thinking-rerun.log"
```

Exact evidence paths from this rerun:
- command: `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/.tmp-ee-vri1-cmd`
- cassette name marker: `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/.tmp-ee-vri1-cass`
- recorded cassette: `/home/derrick/.openclaw/workspace/projects/peanut-gallery/digital-twin-openrouter-emotion-engine/cassettes/cod-test-record-20260406-100543-ee-vri1-mimo-high-thinking-rerun.json`
- log: `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/.logs/cod-test-20260406-100543-ee-vri1-mimo-high-thinking-rerun.log`
- timing: `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/.logs/cod-test-20260406-100543-ee-vri1-mimo-high-thinking-rerun.time`
- failure envelope: `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/output/cod-test/phase1-gather-context/script-results/get-dialogue.failure.json`
- raw failure capture: `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/output/cod-test/phase1-gather-context/raw/ai/dialogue-chunks/chunk-0005/attempt-01/capture.json`
- recovery next action: `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/output/cod-test/phase1-gather-context/recovery/get-dialogue/next-action.json`
- event log: `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/output/cod-test/_meta/events.jsonl`

Outcome summary:
- The rerun **did not complete**. It failed in **Phase 1** while running `server/scripts/get-context/get-dialogue.cjs`.
- Failure line in the main log: `OpenRouter: No content in response`.
- Runtime for this failed rerun was `real 426.00` / `user 3.23` / `sys 0.32`.
- The failure happened on dialogue chunk `chunk-0005` (global 64s-84s) after earlier chunk captures had already been written.
- The raw failure capture shows a `200` response from OpenRouter/Xiaomi with `finish_reason: "length"`, `message.content: null`, and a huge reasoning blob ending in a repeated `Master! ...` stream, which tripped `OpenRouterNoContentError` instead of yielding a usable dialogue artifact.

Comparison against the most relevant recent reconciliation-backed reruns:
- `ee-k4o2` (`/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/.logs/cod-test-20260405-211939-ee-k4o2-reconciliation-recovery-r2.log`, time `real 1993.19`): **Phase 1 completed** and **Phase 2 completed**. The run later failed in reconciliation/reporting because `dialogue-data.reconciled.json` was missing, but it did **not** stall in Phase 2.
- `ee-r4u4` (`/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/.logs/cod-test-20260406-081320-ee-r4u4-reconciliation-rerun.log`, time `real 3241.58`): **Phase 1 completed** and **Phase 2 completed**. It later failed at benchmark evaluation (`0/7 artifacts passed`), but again there was **no Phase 2 stall**.
- `ee-vri1` (this rerun): regressed earlier than both baselines. It never reached Phase 2, so this run provides **no evidence that MiMo-first high-thinking reduces or eliminates the prior Phase 2 stall shape**. The newest failure shape is an earlier upstream/provider-response failure in Phase 1 dialogue.

Output-quality / grounding readout from the partial artifacts:
- Only partial Phase 1 dialogue chunk captures were produced before the failure; there is no trustworthy fresh end-to-end `dialogue-data.json` from this rerun to benchmark for final grounding quality.
- The partial successful chunk captures do show the active MiMo-first high-thinking route in use (`model: xiaomi/mimo-v2-omni` with `thinking.level: high`) and they appear to preserve the intended speaker-separation / local-validator-tool-loop structure on the chunks that returned content.
- However, because the lane died on chunk 5 with a null-content provider response, the main observable change attributable to this config is **instability / non-completion in Phase 1**, not a measurable downstream grounding improvement.
- There was **no new clean success archive** for this rerun under `output/_archives`; instead the live `output/cod-test/` tree was partially rewritten in place by the failed attempt, so the fresh evidence for this run is primarily the log/cassette/failure-capture set above rather than a finished archived output packet.

---

## Final Results

**Status:** ⚠️ Partial

**What We Built:** A fresh evidence-backed rerun of the active MiMo-first high-thinking `cod-test` lane, including exact command preservation, timing, log, digital-twin cassette, and failure artifacts. The run failed early in Phase 1 dialogue with `OpenRouter: No content in response`, so it did not produce a new clean end-to-end output set.

**Commits:**
- None. This task updated the plan and runtime artifacts only, and was explicitly left unpushed.

**Lessons Learned:**
- The current MiMo-first high-thinking active config is not yet a proof that the recurrent Phase 2 stall is fixed, because this rerun regressed earlier and never entered Phase 2.
- The freshest useful comparison remains the reconciliation-backed reruns `ee-k4o2` and `ee-r4u4`, both of which reached and completed Phase 2 before failing later for different reasons.
- The new dominant blocker on this exact active config is Phase 1 dialogue instability on Xiaomi/OpenRouter (`null` assistant content / `finish_reason: length` / `OpenRouterNoContentError`), not an obvious downstream grounding regression or improvement.

---

*Started on 2026-04-06*
