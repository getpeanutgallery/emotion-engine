# emotion-engine: set cod-test dialogue to whole-asset and rerun validation

**Date:** 2026-04-07  
**Status:** In Progress  
**Agent:** Cookie 🍪

---

## Goal

Update `configs/cod-test.yaml` so Phase 1 dialogue uses explicit whole-asset behavior for validation, rerun cod-test dialogue on that corrected path, and measure the result against the gold benchmark.

---

## Overview

The chunking investigation showed that the recent dialogue failure was not caused by broken chunk-boundary math. It came from `configs/cod-test.yaml` still inheriting the older default auto-chunked dialogue path, even though the cod-test dialogue audio is transport-safe as a single whole-asset input and earlier rerun-oriented configs already demonstrated the intended whole-asset settings.

So the immediate fix is config-level: make `cod-test.yaml` explicitly use whole-asset dialogue mode, raise the whole-asset duration ceiling to cover this asset class, and disable fallback-to-chunked behavior for this validation lane. That lets us test the lean runtime against the provider in the mode we actually want instead of accidentally validating the legacy chunked path.

Derrick also called out the longer-term architecture direction: a base asset (for example the source video) should be able to produce Phase 1 derived artifacts (for example raw audio), upload them to S3, and then reuse those staged artifacts as first-class inputs for dialogue, music, music-vocals, and reconciliation work. That broader asset-system design should be preserved as the next architecture lane, but it should not block the immediate whole-asset cod-test fix.

---

## Tasks

### Task 1: Update `cod-test.yaml` to explicit whole-asset dialogue settings

**Bead ID:** `ee-4lzx`  
**SubAgent:** `coder`  
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, update configs/cod-test.yaml so Phase 1 dialogue uses explicit whole-asset behavior for this validation lane. Use the intended whole-asset settings already seen in related rerun configs as a guide. The goal is to avoid silent fallback into the legacy auto-chunked dialogue path. Keep the change narrow and truthful, update this plan with exact config changes, and claim/close the assigned bead with bd update <ID> --status in_progress --json and bd close <ID> --reason "cod-test whole-asset dialogue config updated" --json.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `configs/`

**Files Created/Deleted/Modified:**
- `.plans/2026-04-07-set-cod-test-dialogue-to-whole-asset-and-rerun.md`
- `configs/cod-test.yaml`

**Status:** ✅ Complete

**Results:** Added `settings.phase1.dialogue` to `configs/cod-test.yaml` with the explicit whole-asset settings already used in related rerun configs: `mode: whole_asset`, `timing_refinement: disabled`, `max_whole_asset_duration_seconds: 180`, `fallback_to_chunked: false`, and `preserve_chunk_plan_metadata: true`. This is the smallest truthful config change that raises the whole-asset ceiling for cod-test dialogue and prevents silent fallback into the legacy auto-chunked path.

---

### Task 2: Rerun cod-test dialogue validation on the corrected whole-asset path

**Bead ID:** `ee-idm3`  
**SubAgent:** `research`  
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, rerun the real cod-test validation after the config change so dialogue uses the explicit whole-asset path. Confirm runtime behavior, note whether the dialogue lane completes cleanly, and compare the resulting dialogue artifact/report against the gold benchmark. Update this plan truthfully with exact commands, artifacts, and results. Claim/close the assigned bead with bd update <ID> --status in_progress --json and bd close <ID> --reason "whole-asset dialogue rerun validated" --json.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `.logs/`
- `output/`
- `benchmarks/fixtures/cod-test/_reports/`

**Files Created/Deleted/Modified:**
- `.plans/2026-04-07-set-cod-test-dialogue-to-whole-asset-and-rerun.md`
- `.logs/cod-test-20260407-162017-ee-idm3-whole-asset-rerun.log`
- `.logs/cod-test-20260407-162017-ee-idm3-whole-asset-rerun.time`
- `.tmp-ee-idm3-cmd`
- `.tmp/ee-idm3/archive-dialogue-benchmark.json`
- `.tmp/ee-idm3/current-dialogue-benchmark-restored.json`
- `output/_archives/cod-test-pre-ee-idm3-20260407-162017/`
- `output/cod-test/phase1-gather-context/dialogue-data.json`
- `output/cod-test/phase1-gather-context/dialogue-data.reconciled.json`
- `output/cod-test/phase1-gather-context/raw/ffmpeg/dialogue/chunk-plan.json`
- `output/cod-test/phase1-gather-context/script-results/get-dialogue.success.json`
- `output/cod-test/artifacts-complete.json`
- `benchmarks/fixtures/cod-test/_reports/benchmark-summary.json`
- `benchmarks/fixtures/cod-test/_reports/benchmark-summary.md`
- `benchmarks/fixtures/cod-test/_reports/artifact-results/dialogueData.json`

**Status:** ✅ Complete

**Results:** Real provider-backed rerun executed with `DIGITAL_TWIN_MODE=record` and cassette `cod-test-record-20260407-162017-ee-idm3-whole-asset-rerun` using:

`set -o pipefail; set -a && . ./.env && set +a && export DIGITAL_TWIN_MODE="record" && export DIGITAL_TWIN_CASSETTE="cod-test-record-20260407-162017-ee-idm3-whole-asset-rerun" && /usr/bin/time -p -o ".logs/cod-test-20260407-162017-ee-idm3-whole-asset-rerun.time" node server/run-pipeline.cjs --config configs/cod-test.yaml --verbose 2>&1 | tee ".logs/cod-test-20260407-162017-ee-idm3-whole-asset-rerun.log"`

Before rerunning, the prior `output/cod-test` tree was archived to `output/_archives/cod-test-pre-ee-idm3-20260407-162017/` for comparison.

The dialogue lane **did run on the intended whole-asset path**. Evidence:
- orchestrator log: `✅ Dialogue extraction complete (whole_asset)` in `.logs/cod-test-20260407-162017-ee-idm3-whole-asset-rerun.log`
- `output/cod-test/phase1-gather-context/raw/ffmpeg/dialogue/chunk-plan.json` shows `requestedMode: "whole_asset"`, `reason: "within_budget"`, and a single chunk covering `0 -> 140.042449`
- `output/cod-test/phase1-gather-context/script-results/get-dialogue.success.json` records `analysisMode: "whole_asset"`, `usedChunking: false`, `chunkCount: 0`, and `fallbackApplied: false`

Runtime result:
- Phase 1 dialogue completed cleanly in `80744ms`
- the full pipeline ran for `real 1370.90` seconds (~22m 51s)
- pipeline exit status was still failure because the benchmark stage ended with `0/7 artifacts passed. 1638/2877 scoreable fields passed. Truth coverage was 2877/2957 fields.`

Dialogue benchmark outcome versus the gold benchmark:
- current whole-asset rerun report: `benchmarks/fixtures/cod-test/_reports/artifact-results/dialogueData.json`
- current dialogue result: `status: error`, accuracy `50/181 = 0.2762430939`, coverage `181/182 = 0.9945054945`
- benchmark summary: `benchmarks/fixtures/cod-test/_reports/benchmark-summary.json`
- output artifact compared to gold: `output/cod-test/phase1-gather-context/dialogue-data.reconciled.json` vs `benchmarks/fixtures/cod-test/truth/dialogue-data.json`

Delta versus the archived pre-change cod-test output (benchmarked after the rerun with `runBenchmarkStage` and captured in `.tmp/ee-idm3/archive-dialogue-benchmark.json`):
- archived prior dialogue result: `status: fail`, accuracy `67/198 = 0.3383838384`, coverage `198/198 = 1.0`
- current whole-asset rerun result: `status: error`, accuracy `50/181 = 0.2762430939`, coverage `181/182 = 0.9945054945`
- net effect: **dialogue regressed**, not improved
  - accuracy down by `0.0621407445` (~6.21 percentage points)
  - passed scoreable fields down by `17`
  - coverage down slightly by `1` scoreable field and it introduced a structural error instead of a plain fail

New blocker identified precisely:
- the whole-asset transport/chunking path is now correct, but the provider-backed dialogue result is still incomplete/truncated
- `get-dialogue.success.json` shows only `20` segments with coverage ending at `68.5s` of a `140.04s` asset (`coverage.complete: false`)
- the benchmark error records the missing `cleanedTranscript` field and the transcript/report misses the latter-half dialogue lines, so the failure moved from “wrong execution path” to “whole-asset dialogue content quality/completeness is still insufficient on the real run”.

---

### Task 3: Record the follow-up architecture lane for staged Phase 1 derived assets

**Bead ID:** `ee-z1v2`  
**SubAgent:** `research`  
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, record the follow-up architecture direction for staged Phase 1 derived assets: base asset (video) -> derived artifacts (raw audio, etc.) -> staged/uploaded media refs -> reuse by dialogue/music/music-vocals/reconciliation. Update this plan truthfully with a concise note so the architecture direction is preserved without blocking the immediate cod-test fix. Claim/close the assigned bead with bd update <ID> --status in_progress --json and bd close <ID> --reason "follow-up asset architecture direction recorded" --json.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `docs/`

**Files Created/Deleted/Modified:**
- `.plans/2026-04-07-set-cod-test-dialogue-to-whole-asset-and-rerun.md`
- docs/ (note path TBD if needed)

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