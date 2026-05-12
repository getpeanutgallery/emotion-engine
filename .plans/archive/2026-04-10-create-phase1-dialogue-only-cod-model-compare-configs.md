# Emotion Engine

**Date:** 2026-04-10  
**Status:** In Progress  
**Agent:** Cookie 🍪

---

## Goal

Create the COD model-comparison config lane for Phase 1 dialogue-only evaluation so we can compare baseline MiMo vs `openai/gpt-audio` vs `google/gemini-3.1-pro-preview` against the human-verified dialogue benchmark.

---

## Overview

Derrick wants three apples-to-apples comparison lanes that differ only by the Phase 1 model used for dialogue extraction. The existing `configs/cod-test.yaml` remains the current MiMo baseline reference, while two new configs will be introduced for `openai/gpt-audio` and `google/gemini-3.1-pro-preview`.

The comparison scope is intentionally narrow: dialogue-data only, no reconciliation, no music, no music-vocals, and no downstream Phase 2 / Phase 3 scripts. The purpose is to isolate which audio-capable model most accurately hears dialogue line-for-line relative to the human-verified benchmark, without letting reconciliation or non-dialogue phases mask raw dialogue quality.

Derrick confirmed execution should leave `configs/cod-test.yaml` untouched and introduce three new dialogue-only compare configs built from it as a template. Those three files should remain structurally identical except for the Phase 1 model so the benchmark is strictly apples-to-apples.

---

## Tasks

### Task 1: Audit current cod-test config and determine the minimal dialogue-only comparison shape

**Bead ID:** `ee-bdf9`  
**SubAgent:** `coder`  
**Prompt:** Audit `configs/cod-test.yaml` and the relevant pipeline/runtime expectations for a dialogue-only benchmark lane. Determine the minimal config changes needed so the comparison run only gathers dialogue-data and skips reconciliation, music, music-vocals, and all Phase 2 / Phase 3 scripts. Confirm which AI targets must be changed so the only model-sensitive difference across the compare configs is the Phase 1 dialogue model. Claim bead `ee-bdf9` at start with `bd update ee-bdf9 --status in_progress --json` and close it on completion with `bd close ee-bdf9 --reason "Audit complete" --json`.

**Folders Created/Deleted/Modified:**
- `configs/`
- `server/scripts/` (audit only unless implementation proves necessary)

**Files Created/Deleted/Modified:**
- `configs/cod-test.yaml`
- potential new `configs/cod-test-*.yaml` files

**Status:** ✅ Complete

**Results:** Confirmed the minimal valid dialogue-only compare shape is a single `gather_context` script (`server/scripts/get-context/get-dialogue.cjs`) with all non-dialogue gather steps and all later `process`/`report` phases removed. The current semantic validator still requires `ai.music.targets` and `ai.video.targets` to exist, so those were preserved as unchanged unused stubs while the runnable lane remains dialogue-only.

---

### Task 2: Implement the new comparison configs

**Bead ID:** `ee-oa34`  
**SubAgent:** `coder`  
**Prompt:** Using the approved comparison shape, implement the COD dialogue-only model-comparison configs in `projects/peanut-gallery/emotion-engine/configs/`. Leave `configs/cod-test.yaml` untouched. Create three new configs built from it as a template: one MiMo baseline, one `openai/gpt-audio`, and one `google/gemini-3.1-pro-preview`. Ensure the new comparison configs differ only in the intended Phase 1 model setting(s), with no reconciliation, no music, no music-vocals, and no Phase 2 / Phase 3 execution. Claim bead `ee-oa34` at start with `bd update ee-oa34 --status in_progress --json` and close it on completion with `bd close ee-oa34 --reason "Comparison configs implemented" --json`.

**Folders Created/Deleted/Modified:**
- `configs/`

**Files Created/Deleted/Modified:**
- `configs/cod-test.yaml`
- `configs/cod-test-*.yaml`

**Status:** ✅ Complete

**Results:** Added three new config files in `configs/`: `cod-dialogue-compare-mimo.yaml`, `cod-dialogue-compare-gpt-audio.yaml`, and `cod-dialogue-compare-gemini-3.1-pro-preview.yaml`. Each keeps the same COD asset, S3 source, benchmark path, retry/ffmpeg/debug/recovery settings, and high-token/high-thinking dialogue settings from `cod-test.yaml`, while stripping non-dialogue gather steps plus all process/report phases. No code changes outside `configs/` were required.

---

### Task 3: Validate the configs and summarize the compare lane

**Bead ID:** `ee-09r1`  
**SubAgent:** `coder`  
**Prompt:** Validate the new COD dialogue-only compare configs using the repo’s config validation and any focused dry-run checks that confirm only the intended dialogue lane will execute. Summarize the final config set, exact file names, and the model mapping for the three-way benchmark. Claim bead `ee-09r1` at start with `bd update ee-09r1 --status in_progress --json` and close it on completion with `bd close ee-09r1 --reason "Validation complete" --json`.

**Folders Created/Deleted/Modified:**
- `configs/`
- `output/` (runtime artifacts only if validation needs them)

**Files Created/Deleted/Modified:**
- `configs/cod-test.yaml`
- `configs/cod-test-*.yaml`

**Status:** ✅ Complete

**Results:** I verified the three new config files exist and re-ran validation locally. `npm run validate-configs` passed for all four current YAML files (`cod-test.yaml` plus the three new compare configs). Each compare config also passed `npm run pipeline -- --config <file> --dry-run`, and each validated as a single-script runnable pipeline, confirming only the dialogue lane is active.

---

## Final Results

**Status:** ✅ Complete

**What We Built:** Three new dialogue-only COD compare configs cloned from `cod-test.yaml` while leaving `cod-test.yaml` untouched. The new configs are structurally identical except for the Phase 1 dialogue model, and they target the same `cod.mp4` S3 asset plus the same dialogue benchmark path for strict apples-to-apples comparison.

**Commits:**
- Pending

**Lessons Learned:**
- Preserve apples-to-apples comparison shape across all three model lanes before executing the benchmark.
- Current semantic validation still expects `ai.music.targets` and `ai.video.targets` even when the runnable pipeline is dialogue-only, so those stubs must remain until the validator is relaxed.

---

*Completed on 2026-04-10*
