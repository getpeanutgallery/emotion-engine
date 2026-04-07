# emotion-engine: rerun cod-test with extreme timeout and max-token settings

**Date:** 2026-04-06  
**Status:** Complete  
**Agent:** Cookie 🍪

---

## Goal

Run a fresh `cod-test` using the newly edited active `configs/cod-test.yaml` after Derrick raised the relevant timeout and max-token settings to extreme values, then capture whether the earlier `finish_reason: "length"` failure disappears and how far the pipeline gets.

---

## Overview

The immediately prior MiMo-first high-thinking rerun (`ee-vri1`) failed in Phase 1 dialogue after several successful dialogue chunks. Its raw capture showed an OpenRouter `200` response with `finish_reason: "length"`, `message.content: null`, and the surfaced pipeline failure `OpenRouter: No content in response`.

This fresh rerun used the active `configs/cod-test.yaml` exactly as it existed at execution time, with the extreme timeout/max-token edits already present (`max_tokens: 987654`, `timeoutMs: 987654`, recovery budgets up to `987654`). The rerun preserved the exact command, cassette name, log path, timing file, and fresh failure artifacts so the failure mode could be compared directly against `ee-vri1`.

---

## Tasks

### Task 1: Run fresh cod-test with the newly edited extreme-budget config and capture artifacts

**Bead ID:** `ee-h7fh`  
**SubAgent:** `primary`  
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, claim bead ee-h7fh immediately with \`bd update ee-h7fh --status in_progress --json\`, then run a fresh cod-test using the active configs/cod-test.yaml exactly as it exists now after Derrick's latest timeout/max-token edits. Preserve the exact command, logs, timings, cassette path if produced, and output/archive artifacts. Compare the result against the immediately prior MiMo-first high-thinking rerun, focusing on whether the earlier Phase 1 OpenRouter finish_reason=length failure disappears, whether the run reaches Phase 2, and whether any new failure mode appears. Update this plan truthfully with exact paths and findings, do not push, and close bead ee-h7fh with a clear reason when finished.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `.logs/`
- `output/`

**Files Created/Deleted/Modified:**
- `.plans/2026-04-06-rerun-cod-test-with-extreme-timeout-and-max-tokens.md`
- `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/.tmp-ee-h7fh-cmd`
- `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/.tmp-ee-h7fh-cass`
- `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/.tmp-ee-h7fh-log`
- `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/.tmp-ee-h7fh-timelog`
- `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/.tmp-ee-h7fh-ts`
- `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/.logs/cod-test-20260406-102409-ee-h7fh-extreme-budget-rerun.log`
- `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/.logs/cod-test-20260406-102409-ee-h7fh-extreme-budget-rerun.time`
- `/home/derrick/.openclaw/workspace/projects/peanut-gallery/digital-twin-openrouter-emotion-engine/cassettes/cod-test-record-20260406-102409-ee-h7fh-extreme-budget-rerun.json`
- `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/output/cod-test/phase1-gather-context/script-results/get-dialogue.failure.json`
- `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/output/cod-test/phase1-gather-context/raw/ai/dialogue-chunks/chunk-0000/attempt-01/capture.json`
- `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/output/cod-test/phase1-gather-context/recovery/get-dialogue/next-action.json`
- `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/output/cod-test/_meta/events.jsonl`

**Status:** ✅ Complete

**Results:** Claimed `ee-h7fh`, then ran a fresh rerun from repo root with the active `configs/cod-test.yaml` exactly as present at run time. Exact command preserved in `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/.tmp-ee-h7fh-cmd`:

```bash
set -o pipefail; set -a && . ./.env && set +a && export DIGITAL_TWIN_MODE="record" && export DIGITAL_TWIN_CASSETTE="cod-test-record-20260406-102409-ee-h7fh-extreme-budget-rerun" && /usr/bin/time -p -o ".logs/cod-test-20260406-102409-ee-h7fh-extreme-budget-rerun.time" node server/run-pipeline.cjs --config configs/cod-test.yaml --verbose 2>&1 | tee ".logs/cod-test-20260406-102409-ee-h7fh-extreme-budget-rerun.log"
```

Exact evidence paths from this rerun:
- command: `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/.tmp-ee-h7fh-cmd`
- cassette name marker: `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/.tmp-ee-h7fh-cass`
- recorded cassette: `/home/derrick/.openclaw/workspace/projects/peanut-gallery/digital-twin-openrouter-emotion-engine/cassettes/cod-test-record-20260406-102409-ee-h7fh-extreme-budget-rerun.json`
- log: `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/.logs/cod-test-20260406-102409-ee-h7fh-extreme-budget-rerun.log`
- timing: `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/.logs/cod-test-20260406-102409-ee-h7fh-extreme-budget-rerun.time`
- failure envelope: `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/output/cod-test/phase1-gather-context/script-results/get-dialogue.failure.json`
- raw failure capture: `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/output/cod-test/phase1-gather-context/raw/ai/dialogue-chunks/chunk-0000/attempt-01/capture.json`
- recovery next action: `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/output/cod-test/phase1-gather-context/recovery/get-dialogue/next-action.json`
- event log: `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/output/cod-test/_meta/events.jsonl`

Outcome summary:
- The rerun **did not complete**. It failed in **Phase 1** while running `server/scripts/get-context/get-dialogue.cjs`.
- Runtime for this failed rerun was only `real 2.05` / `user 1.77` / `sys 0.14`.
- The failure happened on the **first dialogue chunk** (`chunk-0000`, 0s-8s), so it regressed even earlier than `ee-vri1`.
- The surfaced pipeline error in the main log is `OpenRouter: Request failed with status code 400`.
- The raw failure capture shows the new root cause clearly: OpenRouter rejected the request before generation with `This endpoint's maximum context length is 262144 tokens. However, you requested about 991222 tokens (3568 of text input, 987654 in the output).`
- Recovery did not engage: `get-dialogue.failure.json` classifies the failure as `invalid_request` / `http_400`, marks it non-retryable, and the recorded next action is `fail`.

Comparison against the immediately prior MiMo-first high-thinking rerun (`ee-vri1`):
- Prior rerun evidence:
  - plan: `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/.plans/2026-04-06-rerun-cod-test-with-mimo-first-high-thinking.md`
  - log: `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/.logs/cod-test-20260406-100543-ee-vri1-mimo-high-thinking-rerun.log`
  - timing: `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/.logs/cod-test-20260406-100543-ee-vri1-mimo-high-thinking-rerun.time`
  - cassette: `/home/derrick/.openclaw/workspace/projects/peanut-gallery/digital-twin-openrouter-emotion-engine/cassettes/cod-test-record-20260406-100543-ee-vri1-mimo-high-thinking-rerun.json`
  - prior raw failure capture: `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/output/cod-test/phase1-gather-context/raw/ai/dialogue-chunks/chunk-0005/attempt-01/capture.json`
- **Did the earlier `finish_reason=length` failure disappear?** Yes, but not because the run improved. The old provider behavior (`200` response, `finish_reason: "length"`, null assistant content, surfaced as `OpenRouter: No content in response`) is gone. It is replaced by an even earlier **hard request rejection**: HTTP `400` for exceeding the endpoint’s max context window.
- **Did the run reach Phase 2?** No. It failed in Phase 1 on the very first dialogue chunk, so it never entered Phase 2.
- **Any new failure mode?** Yes. The new dominant failure mode is **invalid request / max-context overflow caused by the extreme token budget itself**, not output truncation during generation. This is materially different from `ee-vri1`.
- **Practical implication:** Derrick’s timeout increase did not help because timeout was not the blocking constraint on this rerun. The extreme `max_tokens` change pushed the request above OpenRouter/Xiaomi’s endpoint context cap and caused a faster fatal failure.

Output/archive artifact notes:
- A fresh digital-twin cassette **was** produced for this rerun: `/home/derrick/.openclaw/workspace/projects/peanut-gallery/digital-twin-openrouter-emotion-engine/cassettes/cod-test-record-20260406-102409-ee-h7fh-extreme-budget-rerun.json`.
- There was **no fresh success archive** under `output/_archives/` for this rerun.
- The live `output/cod-test/` tree was partially rewritten in place for Phase 1 startup, but because the run died immediately, it still contains stale Phase 2/Phase 3 files from earlier runs. That means the trustworthy fresh evidence for `ee-h7fh` is the command/log/time/cassette plus the fresh Phase 1 failure artifacts above, not a clean end-to-end archived output packet.

---

## Final Results

**Status:** ⚠️ Partial

**What We Built:** A fresh evidence-backed rerun of the active extreme-budget `cod-test` config, including the exact command, timing, log, cassette, and Phase 1 failure artifacts. The run proved that the earlier `finish_reason: "length"` / null-content failure is gone, but only because the newly extreme token budget now causes an immediate OpenRouter HTTP 400 max-context rejection before Phase 1 dialogue can proceed.

**Commits:**
- None. This task updated the plan and generated runtime artifacts only, and it was explicitly left unpushed.

**Lessons Learned:**
- Raising `timeoutMs` and `max_tokens` to extreme values did **not** unblock the pipeline; the token ceiling itself now exceeds the endpoint’s allowed context window.
- The failure mode changed from **generation-time truncation / null content** to **request-time invalid context length**.
- This rerun regressed earlier than `ee-vri1`: instead of failing at dialogue chunk 5 after ~7 minutes, it failed at dialogue chunk 0 in ~2 seconds.
- Any next config iteration should bring `max_tokens` back under the provider’s effective context ceiling while preserving enough budget to avoid the earlier chunk-5 truncation.

---

*Completed on 2026-04-06*