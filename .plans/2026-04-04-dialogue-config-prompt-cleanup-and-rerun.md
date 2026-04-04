# emotion-engine: dialogue config, prompt cleanup, and Xiaomi rerun

**Date:** 2026-04-04  
**Status:** Complete  
**Agent:** Cookie 🍪

---

## Goal

Clean up the Phase 1 dialogue config/prompt so it stays generic across assets, remove leftover abstained-schema language from dialogue code and prompts, raise the dialogue token budget for the next Xiaomi whole-asset run, and rerun the canonical cod-test configuration to inspect the result.

---

## Overview

During config review, Derrick called out three concrete issues in the active dialogue lane. First, the next run should use a much larger dialogue token budget: `43219` for the Xiaomi whole-asset dialogue target. Second, the runtime-anchor prompt wording should stay generic across videos rather than reading like a cod-test-specific hand-tuned instruction. Third, the dialogue contract/prompt should no longer mention any `abstained` concept if the runtime schema has already moved away from it.

A quick code audit confirms the `abstained` concept is not just a prompt artifact right now — there are still explicit dialogue prompt lines in `server/scripts/get-context/get-dialogue.cjs`, normalization references in `server/lib/structured-output.cjs`, and tests that still expect/remediate those legacy fields. So this lane needs a truthful cleanup, not just a prompt wording tweak. After cleanup, we should rerun the canonical Xiaomi whole-asset cod-test and review the resulting dialogue artifact and raw prompt capture.

One correction before execution: the current config on disk already says `max_tokens: 25000`, not `2500`. But Derrick’s requested change is still valid: raise that to `43219` for the next run.

---

## Tasks

### Task 1: Audit and remove abstained remnants from the dialogue contract and prompt

**Bead ID:** `ee-yowl`  
**SubAgent:** `coder`  
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, clean up the Phase 1 dialogue contract so the old abstained concept is gone from the dialogue codepath. Audit and remove/replace dialogue-specific references to grounded.confidence_abstained and acoustic_descriptors_abstained in the dialogue prompt builder, structured-output normalization/validation, and dialogue-focused tests. Keep the resulting schema/prompt truthful: grounded confidence should just be numeric, acoustic_descriptors should either contain supported descriptors or be empty, and no abstained fields should remain in the dialogue contract. Also make the runtime-anchor wording generic across assets/videos rather than sounding specialized to cod-test. Claim bead ee-yowl on start with bd update ee-yowl --status in_progress --json and close it on completion with bd close ee-yowl --reason "Removed dialogue abstained remnants and generalized prompt wording" --json. Commit after tests pass, but do not push.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `server/scripts/get-context/`
- `server/lib/`
- `test/`

**Files Created/Deleted/Modified:**
- `.plans/2026-04-04-dialogue-config-prompt-cleanup-and-rerun.md`
- `server/scripts/get-context/get-dialogue.cjs`
- `server/lib/structured-output.cjs`
- dialogue-related tests under `test/`

**Status:** ✅ Complete

**Results:** Audited the active dialogue codepath and removed dialogue-specific abstained remnants from the prompt, validator, and focused tests. In `server/scripts/get-context/get-dialogue.cjs`, the grounded contract language now only describes numeric `grounded.confidence` plus `acoustic_descriptors` arrays with empty-array fallback, instead of warning about legacy abstained fields. The runtime-anchor text was also rewritten to stay asset-agnostic: it now refers to the locally measured full attached media runtime and says sparse tails do not mean the asset ended early. In `server/lib/structured-output.cjs`, dialogue grounded-profile validation no longer accepts or inspects `acoustic_descriptors_abstained`. Dialogue-focused tests were updated to stop fabricating those legacy fields and instead assert the active grounded object shape directly.

---

### Task 2: Raise dialogue max_tokens to 43219 for the Xiaomi whole-asset rerun config

**Bead ID:** `ee-cp7k`  
**SubAgent:** `coder`  
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, update the canonical Xiaomi whole-asset rerun config at configs/cod-test-xiaomi-mimo-v2-omni-openrouter-high-thinking-rerun.yaml so the dialogue target uses max_tokens: 43219. Keep the rest of the lane unchanged unless Task 1 makes a related contract/config change necessary. Update the plan with the exact config delta and commit it with the code/test changes, but do not push.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `configs/`

**Files Created/Deleted/Modified:**
- `.plans/2026-04-04-dialogue-config-prompt-cleanup-and-rerun.md`
- `configs/cod-test-xiaomi-mimo-v2-omni-openrouter-high-thinking-rerun.yaml`

**Status:** ✅ Complete

**Results:** Updated `configs/cod-test-xiaomi-mimo-v2-omni-openrouter-high-thinking-rerun.yaml` so the dialogue target now uses exactly `max_tokens: 43219`. The rest of the config stayed unchanged. Focused regression coverage for the changed dialogue path passed after the config and contract cleanup landed.

---

### Task 3: Rerun the canonical Xiaomi whole-asset dialogue test and capture the real result

**Bead ID:** `ee-vohe`  
**SubAgent:** `primary`  
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, rerun the canonical cod-test Xiaomi whole-asset configuration after Tasks 1-2 land: node server/run-pipeline.cjs --config configs/cod-test-xiaomi-mimo-v2-omni-openrouter-high-thinking-rerun.yaml --clean-live-digital-twin --verbose. Capture the fresh log/artifact paths, confirm the raw prompt no longer contains abstained language and uses the new generic runtime-anchor wording, confirm the dialogue target was configured with max_tokens 43219, and summarize the resulting dialogue artifact truthfully. Update the plan with exact evidence. If the lane is complete, prepare the push cleanly while excluding unrelated runtime noise. Claim the assigned bead on start and close it on completion with an explicit reason.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `output/`

**Files Created/Deleted/Modified:**
- `.plans/2026-04-04-dialogue-config-prompt-cleanup-and-rerun.md`
- `output/cod-test-xiaomi-mimo-v2-omni-openrouter-high-thinking-rerun/assets/input/config.yaml`
- `output/cod-test-xiaomi-mimo-v2-omni-openrouter-high-thinking-rerun/assets/processed/dialogue/audio.mp3`
- `output/cod-test-xiaomi-mimo-v2-omni-openrouter-high-thinking-rerun/_meta/ai/_prompts/7ae2086b5d9b6f3b92f2492634238f7d7f9ecacb52a8657ab4288e196517d8ec.json`
- `output/cod-test-xiaomi-mimo-v2-omni-openrouter-high-thinking-rerun/phase1-gather-context/raw/ai/dialogue-transcription/attempt-01/capture.json`
- `output/cod-test-xiaomi-mimo-v2-omni-openrouter-high-thinking-rerun/phase1-gather-context/raw/ai/dialogue-transcription.json`
- `output/cod-test-xiaomi-mimo-v2-omni-openrouter-high-thinking-rerun/phase1-gather-context/script-results/get-dialogue.failure.json`
- `output/cod-test-xiaomi-mimo-v2-omni-openrouter-high-thinking-rerun/phase1-gather-context/raw/_meta/errors.summary.json`
- `output/cod-test-xiaomi-mimo-v2-omni-openrouter-high-thinking-rerun/phase1-gather-context/recovery/get-dialogue/next-action.json`

**Status:** ✅ Complete

**Results:** Ran the exact canonical rerun command at 2026-04-04 18:20 EDT: `node server/run-pipeline.cjs --config configs/cod-test-xiaomi-mimo-v2-omni-openrouter-high-thinking-rerun.yaml --clean-live-digital-twin --verbose`. The run failed in Phase 1 after 27.254s, before music or whole-video analysis, with `GET_DIALOGUE_INVALID_OUTPUT` / `invalid_output: dialogue transcription response was not valid JSON` (`phase1-gather-context/script-results/get-dialogue.failure.json`). The fresh raw capture is at `phase1-gather-context/raw/ai/dialogue-transcription/attempt-01/capture.json`, and the fresh prompt capture is `_meta/ai/_prompts/7ae2086b5d9b6f3b92f2492634238f7d7f9ecacb52a8657ab4288e196517d8ec.json`.

Verification from the fresh artifacts is still useful even though the run failed. The config copied into the run and the source config both show the dialogue target at `max_tokens: 43219` (`configs/cod-test-xiaomi-mimo-v2-omni-openrouter-high-thinking-rerun.yaml`, dialogue target block). The raw prompt capture contains no `abstained` string at all. Its runtime-anchor wording is generic across attached media rather than cod-test-specific: it says “The attached media runtime was measured locally at 140.04 seconds” and “Sparse or non-speech tails ... do not mean the asset ended early,” which is asset-agnostic language.

The fresh dialogue artifact outcome itself regressed rather than improved. There is no successful new `phase1-gather-context/dialogue-data.json` from this rerun because the pipeline stopped in `get-dialogue`. The raw provider content in `capture.json` shows why: Xiaomi returned timestamp values like `1:20.0`, `1:23.5`, and `2:17.5` inside an otherwise detailed transcription payload, which broke JSON parsing against the seconds-only contract. So the cleanup goals were verified, but the actual rerun result stayed mixed at best and operationally regressed because it failed earlier than the previous successful whole-asset run.

---

## Final Results

**Status:** ⚠️ Partial

**What We Built:** The dialogue contract/prompt cleanup and config change landed successfully, and the fresh rerun artifacts verify the intended prompt/config state: the Xiaomi dialogue target is configured at `max_tokens: 43219`, the raw prompt no longer contains abstained language, and the runtime-anchor wording is generic across attached media. However, the verification rerun itself failed in Phase 1 with invalid JSON from Xiaomi dialogue transcription, so this lane truthfully ends as verified cleanup plus a regressed rerun outcome rather than a clean improved result.

**Commits:**
- `5f659f5` - Clean up dialogue contract and raise Xiaomi token budget
- Pending lane-owned commit for Task 3 verification / plan update.

**Lessons Learned:** Prompt/config cleanup and rerun quality are separate questions. The cleanup evidence is clear in the raw prompt and config artifacts, but the live Xiaomi whole-asset dialogue lane is still vulnerable to malformed timestamp formatting (`m:ss.s`) that can kill the run before any dialogue artifact is produced.

---

*Completed on 2026-04-04*
