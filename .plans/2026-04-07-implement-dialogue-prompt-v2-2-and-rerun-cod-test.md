# emotion-engine: implement dialogue prompt v2.2 and rerun cod-test

**Date:** 2026-04-07  
**Status:** In Progress  
**Agent:** Cookie 🍪

---

## Goal

Implement the approved dialogue prompt v2.2 wording in the live dialogue path, rerun cod-test on the corrected whole-asset dialogue configuration, and compare the resulting dialogue output against the gold benchmark.

---

## Overview

Derrick reviewed the v2.2 draft and requested specific wording changes before implementation. The draft now aims to restore useful speaker-detail output, keep speculative traits present with explicit low confidence when weakly supported, and preserve a cleaner spoken-vs-music boundary without reintroducing the older prompt/runtime clutter. The immediate next step is to wire that prompt into the live dialogue flow and rerun the real cod-test lane.

This lane should stay narrow: implement the prompt wording change, keep the existing lean runtime behavior unless a small supporting prompt edit is needed, rerun the real provider-backed cod-test pipeline, and compare the resulting dialogue output and benchmark result against the current gold truth. The goal is to learn whether this prompt version restores useful speaker details and improves dialogue capture without introducing worse regressions.

---

## Tasks

### Task 1: Implement the approved dialogue prompt v2.2 wording

**Bead ID:** `ee-z3qh`  
**SubAgent:** `coder`  
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, implement the approved dialogue prompt v2.2 wording from docs/dialogue-transcription-prompt-v2-2-draft-2026-04-07.md into the live dialogue path. Keep the change narrow and truthful, preserve the lean runtime cleanup, update any focused tests that assert prompt content, and update this plan with exact files changed and tests run. Claim the assigned bead at start with bd update <ID> --status in_progress --json and close it on completion with bd close <ID> --reason "Dialogue prompt v2.2 implemented" --json.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `docs/`
- `server/scripts/get-context/`
- `test/`

**Files Created/Deleted/Modified:**
- `.plans/2026-04-07-implement-dialogue-prompt-v2-2-and-rerun-cod-test.md`
- `docs/dialogue-transcription-prompt-v2-2-draft-2026-04-07.md` (reference only)
- `server/scripts/get-context/get-dialogue.cjs`
- `test/scripts/get-dialogue.test.js`

**Status:** ✅ Complete

**Results:** Implemented the approved v2.2 dialogue prompt wording in both the whole-asset and chunked dialogue prompt builders, plus the matching final artifact guidance used by the dialogue validator tool loop. The live prompt now asks for intelligible dialogue plus dialogue-like vocal material, restores practical grounded acoustic_descriptors guidance, keeps inferred_traits explicitly speculative with low-confidence notes when weakly supported, and relaxes the earlier hard split-away bias for ambiguous music-led vocal material so supportable dialogue-like portions can survive into reconciliation. Lean runtime cleanup behavior was preserved unchanged. Updated focused prompt-content assertions in `test/scripts/get-dialogue.test.js` and verified with `node --test test/scripts/get-dialogue.test.js`.

---

### Task 2: Rerun cod-test and compare the resulting dialogue output against gold

**Bead ID:** `ee-2slo`  
**SubAgent:** `research`  
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, rerun the real cod-test validation after the dialogue prompt v2.2 implementation. Confirm the dialogue lane path used, inspect the resulting dialogue output, and compare the refreshed benchmark result against gold truth. Be explicit about whether speaker details improve, whether key missed/hallucinated lines change, and whether the benchmark improved, regressed, or stayed roughly the same. Update this plan truthfully with exact commands, artifact paths, and findings. Claim the assigned bead at start with bd update <ID> --status in_progress --json and close it on completion with bd close <ID> --reason "Dialogue prompt v2.2 rerun validated" --json.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `.logs/`
- `.tmp/`
- `output/`
- `benchmarks/fixtures/cod-test/_reports/`

**Files Created/Deleted/Modified:**
- `.plans/2026-04-07-implement-dialogue-prompt-v2-2-and-rerun-cod-test.md`
- `.logs/cod-test-20260407-175454-ee-2slo-dialogue-prompt-v2-2-rerun.log`
- `.logs/cod-test-20260407-175454-ee-2slo-dialogue-prompt-v2-2-rerun.time`
- `.tmp-ee-2slo-dialogue-prompt-v2-2-rerun-cmd`
- `.tmp/ee-2slo-dialogue-prompt-v2-2-rerun-pre-benchmark-summary.json`
- `.tmp/ee-2slo-dialogue-prompt-v2-2-rerun-pre-dialogue-benchmark.json`
- `output/_archives/cod-test-pre-ee-2slo-dialogue-prompt-v2-2-rerun-20260407-175454/`
- `output/cod-test/phase1-gather-context/dialogue-data.json`
- `output/cod-test/phase1-gather-context/dialogue-data.reconciled.json`
- `output/cod-test/phase1-gather-context/raw/ffmpeg/dialogue/chunk-plan.json`
- `output/cod-test/phase1-gather-context/script-results/get-dialogue.success.json`
- `output/cod-test/artifacts-complete.json`
- `benchmarks/fixtures/cod-test/_reports/benchmark-summary.json`
- `benchmarks/fixtures/cod-test/_reports/benchmark-summary.md`
- `benchmarks/fixtures/cod-test/_reports/artifact-results/dialogueData.json`

**Status:** ✅ Complete

**Results:** Real provider-backed rerun executed after the prompt v2.2 implementation with:

`set -o pipefail; set -a && . ./.env && set +a && export DIGITAL_TWIN_MODE=record && export DIGITAL_TWIN_CASSETTE=cod-test-record-20260407-175454-ee-2slo-dialogue-prompt-v2-2-rerun && /usr/bin/time -p -o .logs/cod-test-20260407-175454-ee-2slo-dialogue-prompt-v2-2-rerun.time node server/run-pipeline.cjs --config configs/cod-test.yaml --verbose 2>&1 | tee .logs/cod-test-20260407-175454-ee-2slo-dialogue-prompt-v2-2-rerun.log`

Before rerunning, the previous cod-test output tree was archived to `output/_archives/cod-test-pre-ee-2slo-dialogue-prompt-v2-2-rerun-20260407-175454/`, and the prior benchmark reports were copied to `.tmp/ee-2slo-dialogue-prompt-v2-2-rerun-pre-benchmark-summary.json` and `.tmp/ee-2slo-dialogue-prompt-v2-2-rerun-pre-dialogue-benchmark.json` for honest before/after comparison.

The dialogue lane **did use the intended whole-asset path**. Evidence:
- `.logs/cod-test-20260407-175454-ee-2slo-dialogue-prompt-v2-2-rerun.log` shows `✅ Dialogue extraction complete (whole_asset)`
- `output/cod-test/phase1-gather-context/raw/ffmpeg/dialogue/chunk-plan.json` records `requestedMode: "whole_asset"`, `transportTrace.reason: "within_budget"`, and a single chunk spanning `0 -> 140.042449`
- `output/cod-test/phase1-gather-context/script-results/get-dialogue.success.json` shows the real dialogue rerun finished successfully in `117080ms` and wrote a 19-segment artifact

Runtime result:
- dialogue extraction itself completed successfully on the live provider-backed path
- full pipeline wall-clock runtime was `real 994.98` seconds (~16m 35s) per `.logs/cod-test-20260407-175454-ee-2slo-dialogue-prompt-v2-2-rerun.time`
- pipeline exit status was still failure because benchmarking ended with `0/7 artifacts passed. 1672/2916 scoreable fields passed. Truth coverage was 2916/3000 fields.`

Dialogue benchmark outcome versus gold truth:
- gold truth artifact: `benchmarks/fixtures/cod-test/truth/dialogue-data.json`
- current output artifact: `output/cod-test/phase1-gather-context/dialogue-data.reconciled.json`
- current dialogue report: `benchmarks/fixtures/cod-test/_reports/artifact-results/dialogueData.json`
- current result: `status: error`, accuracy `38/177 = 0.2146892655`, coverage `177/183 = 0.9672131148`
- previous archived result before this rerun: `status: error`, accuracy `50/181 = 0.2762430939`, coverage `181/182 = 0.9945054945`
- net dialogue delta: **regression**
  - accuracy down by `0.0615538284` (~6.16 percentage points)
  - passed scoreable fields down by `12`
  - scoreable coverage down by `4` fields
  - new benchmark errors increased from `1` to `6`

Speaker-details verdict:
- **Speaker detail richness improved materially** in the raw artifact. The prior rerun had 15 speaker profiles with empty `acoustic_descriptors` and empty `inferred_traits`; this rerun produced 9 speaker profiles with populated grounded descriptors and speculative inferred traits (for example `female voice`, `menacing tone`, `military-style delivery`, and explicit low-confidence role/demeanor guesses).
- However, benchmark alignment did **not** improve, because the richer output still diverged from gold speaker continuity and also introduced null descriptor confidences. The benchmark now errors on several `speaker_profiles[*].grounded.acoustic_descriptors[*].confidence` fields where truth expects numbers but output supplied `null`.

Missed / hallucinated line changes versus the archived pre-v2.2 rerun:
- **Improved / less bad:**
  - restored split handling for `Menendez is a terrorist.` and `We're bringing peace and security to the world.` instead of merging them into one line
  - restored `Pull it together, man!`
  - removed the prior hallucinated line `You'll never be quiet.`
  - removed the prior promo hallucination formatting variant `Get the Reznov Challenge Pack when you pre-order now.` from the output entirely
- **Still wrong or still missing:**
  - still misses `You shall know fear.`
  - still misses the final promo line `Get the Reznov challenge pack when you preorder now!`
  - still outputs `So eager to leave, David.` instead of truth `So eager to leave daddy.`
  - still outputs `Killing a man...` instead of truth `Killing the man...`
  - still outputs `No more games. This ends now.` instead of truth `No more games! This ends now.`
  - still outputs `Spectre One report.` instead of truth `Specter one, report.`
- **Worse structural behavior:** the new rerun leaves huge silent coverage gaps from `25s -> 90s` and `97s -> 130s`, collapsing the latter-half spoken dialogue coverage even though the whole-asset transport path is correct.

Plain-language conclusion:
- Prompt v2.2 succeeded at restoring richer speaker-profile detail in the raw dialogue artifact.
- It did **not** improve the dialogue benchmark against gold truth; the dialogue lane got worse overall.
- The likely reason the benchmark still lags human review is that the model is now spending budget on richer speaker-description output without reliably preserving full transcript continuity and schema cleanliness. In practice, the run still drops major late dialogue stretches, omits `cleanedTranscript`, and emits `null` confidences where the comparator expects numeric grounded-confidence fields. So the failure has moved from “bare/minimal speaker metadata” to “better-looking metadata plus worse transcript completeness/alignment.”

---

## Final Results

**Status:** ✅ Complete

**What We Built:** Implemented the approved dialogue prompt v2.2 wording in the live dialogue path, then ran a real provider-backed `configs/cod-test.yaml` validation on the explicit whole-asset dialogue lane. The rerun confirmed the whole-asset transport path is working, but the refreshed dialogue artifact still underperformed against the cod-test gold truth and regressed versus the prior rerun on dialogue benchmark accuracy/coverage.

**Commits:**
- Pending.

**Lessons Learned:** Richer speaker-profile prompting is not enough on its own. The v2.2 rerun improved raw speaker-detail richness, but benchmark quality still depends on transcript continuity, clean `cleanedTranscript` production, and schema-compatible numeric confidences for grounded descriptors. The current blocker is no longer the whole-asset path; it is provider output completeness/alignment on the live run.

---

*Completed on 2026-04-07*