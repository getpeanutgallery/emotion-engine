# emotion-engine: set cod-test max tokens to 232144 and rerun

**Date:** 2026-04-06  
**Status:** In Progress  
**Agent:** Cookie 🍪

---

## Goal

Update every `max_tokens` setting in the active `configs/cod-test.yaml` to `232144` to leave roughly 30k tokens of headroom below a `262144` context cap, then rerun the pipeline and capture whether the earlier context-overflow failure is resolved.

---

## Overview

The latest reruns showed that setting output caps right at or above the provider context limit causes immediate request rejection. Derrick wants to standardize every `max_tokens` field in the active cod-test config to `232144` so the request retains meaningful headroom for prompt/input tokens.

This lane should be surgical and truthful: edit only the active config, preserve the exact command and evidence from the new rerun, and compare the result against the immediately prior overflow failures. The main question is whether the Phase 1 dialogue call now clears request validation and whether the run reaches Phase 2 or beyond.

---

## Tasks

### Task 1: Set all cod-test max_tokens values to 232144 and rerun

**Bead ID:** `ee-t1h0`  
**SubAgent:** `primary`  
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, claim bead ee-t1h0 immediately with \`bd update ee-t1h0 --status in_progress --json\`, then update configs/cod-test.yaml so every max_tokens setting in the active config is 232144. After editing, validate or dry-run if appropriate, then run a fresh cod-test using that updated active config. Preserve the exact command, logs, timings, cassette path if produced, and output/archive artifacts. Compare the result against the immediately prior overflow reruns, focusing on whether the earlier Phase 1 context-overflow failure disappears, whether the run reaches Phase 2, and what new failure or success shape appears. Update this plan truthfully with exact paths and findings, do not push, and close bead ee-t1h0 with a clear reason when finished.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `configs/`
- `.logs/`
- `output/`

**Files Created/Deleted/Modified:**
- `.plans/2026-04-06-set-cod-test-max-tokens-to-232144-and-rerun.md`
- `configs/cod-test.yaml`
- fresh rerun artifacts/logs/output archives

**Status:** ✅ Complete

**Results:** Claimed `ee-t1h0`, updated every active `max_tokens` entry in `configs/cod-test.yaml` from `262144` to `232144` (6 total: `dialogue`, `music`, `music_vocals`, `dialogue_stitch`, `video`, `recommendation`), then validated the config with both `node validate-configs.cjs configs/cod-test.yaml` and `node server/run-pipeline.cjs --config configs/cod-test.yaml --dry-run`.

Fresh rerun evidence:
- exact command marker: `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/.tmp-ee-t1h0-cmd`
- exact command:
  `set -o pipefail; set -a && . ./.env && set +a && export DIGITAL_TWIN_MODE="record" && export DIGITAL_TWIN_CASSETTE="cod-test-record-20260406-103734-ee-t1h0-max232144-rerun" && /usr/bin/time -p -o ".logs/cod-test-20260406-103734-ee-t1h0-max232144-rerun.time" node server/run-pipeline.cjs --config configs/cod-test.yaml --verbose 2>&1 | tee ".logs/cod-test-20260406-103734-ee-t1h0-max232144-rerun.log"`
- timestamp marker: `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/.tmp-ee-t1h0-ts`
- cassette marker: `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/.tmp-ee-t1h0-cass`
- recorded cassette: `/home/derrick/.openclaw/workspace/projects/peanut-gallery/digital-twin-openrouter-emotion-engine/cassettes/cod-test-record-20260406-103734-ee-t1h0-max232144-rerun.json`
- log: `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/.logs/cod-test-20260406-103734-ee-t1h0-max232144-rerun.log`
- timing: `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/.logs/cod-test-20260406-103734-ee-t1h0-max232144-rerun.time` → `real 1394.33`, `user 10.88`, `sys 1.61`
- preserved pre-run archive: `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/output/_archives/cod-test-pre-ee-t1h0-20260406-103734`
- fresh output root: `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/output/cod-test`
- fresh completion marker: `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/output/cod-test/artifacts-complete.json`
- fresh Phase 1 dialogue artifact: `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/output/cod-test/phase1-gather-context/dialogue-data.json`
- fresh Phase 2 artifact: `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/output/cod-test/phase2-process/chunk-analysis.json`
- fresh Phase 3 report: `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/output/cod-test/phase3-report/summary/FINAL-REPORT.md`
- event ledger: `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/output/cod-test/_meta/events.jsonl`
- benchmark summary: `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/benchmarks/fixtures/cod-test/_reports/benchmark-summary.json`

What changed versus the immediate prior overflow reruns:
- vs. `ee-h7fh` (`.logs/cod-test-20260406-102409-ee-h7fh-extreme-budget-rerun.log`) and `ee-bmuy` (`.logs/cod-test-20260406-103012-ee-bmuy-all-ai-maxed-rerun.log`): the earlier Phase 1 context-overflow failure **disappeared**. Those runs died immediately in `get-dialogue` with OpenRouter HTTP 400 max-context rejection and never reached Phase 2. This `ee-t1h0` rerun completed Phase 1, completed Phase 2, completed Phase 3, wrote `artifacts-complete.json`, and only failed afterward in the benchmark stage.
- vs. `ee-vri1` (`.logs/cod-test-20260406-100543-ee-vri1-mimo-high-thinking-rerun.log`): the newer 232144 budget also clears that separate early Phase 1 `OpenRouter: No content in response` failure family. `ee-vri1` never left `get-dialogue`; `ee-t1h0` finished the full pipeline before failing at benchmark.
- vs. `ee-r4u4` (`.logs/cod-test-20260406-081320-ee-r4u4-reconciliation-rerun.log`): the failure shape returns to the same late-stage family as the last known non-overflow full rerun. Both runs cleared Phase 1 and Phase 2, then failed at the benchmark stage rather than on provider/request validity.

New outcome shape with `max_tokens: 232144`:
- Phase 1: success; `dialogue-data.json`, `music-data.json`, and `music-vocals-data.json` were written.
- Phase 2: success; `chunk-analysis.json` reports `28/28` successful provider-facing chunks, `0` failed, `totalTokens: 1266079`, and `Average per successful chunk: 45217 tokens`.
- Phase 3: success; recommendation, emotional analysis, summary, and final markdown report were all written.
- Terminal failure: benchmark only. The run ended with `Benchmark error: 0/7 artifacts passed. 1866/2916 scoreable fields passed. Truth coverage was 2916/3040 fields.` as recorded in the log, event ledger (`run.end` seq `362`), and benchmark summary.

Bottom line: lowering every active `max_tokens` to `232144` successfully restored end-to-end pipeline execution and removed the immediate Phase 1 context-overflow regression. The remaining blocker is back to benchmark/result quality, not provider request sizing.

---

## Final Results

**Status:** ✅ Complete

**What We Built:** A corrected active `configs/cod-test.yaml` with every live `max_tokens` cap set to `232144`, plus a full evidence-backed rerun packet showing that the request-size/context-overflow regression is gone. The fresh run produced a clean pre-run archive, new record-mode cassette, full Phase 1/2/3 outputs, and a benchmark summary that puts the remaining failure back in the quality/benchmark lane instead of the provider/request-validity lane.

**Commits:**
- None. Per instruction, I did not push.

**Lessons Learned:** A modest headroom change below the `262144` provider cap was enough to convert an immediate invalid-request failure into a full pipeline run. The active bottleneck is now benchmark accuracy again, so future work should target report/chunk output quality rather than token-budget inflation.

---

*Completed on 2026-04-06*
