# emotion-engine: review dialogue prompt for separation and beat-boundary issues

**Date:** 2026-04-07  
**Status:** In Progress  
**Agent:** Cookie 🍪

---

## Goal

Inspect the exact prompt and prompt-construction path used by the dialogue script AI to identify wording that may be contributing to dialogue fusion, weak speaker separation, or false certainty in overlap-heavy lines.

---

## Overview

Derrick has a strong hypothesis: now that the benchmark/comparator honesty work is largely sorted and the current cod-test config has been normalized onto the same MIMO model, the next best lever may be prompt wording rather than more grading work. In particular, the current dialogue artifact still shows adjacent-beat fusion, lost lines, collapsed speaker buckets, and overconfident attribution on overlap-heavy material.

This lane should start with prompt inspection, not model swapping or reruns. We want to locate the exact prompt being sent by the dialogue script AI, trace how it is assembled, and review the wording from a human perspective: which instructions may unintentionally encourage merging adjacent lines, over-smoothing damaged speech, inventing certainty, or compressing distinct speakers into broad buckets.

The output should leave behind a durable review of the prompt, likely problem instructions, and candidate wording adjustments. Only after that review should we decide whether to implement prompt changes or test alternative models.

---

## Tasks

### Task 1: Gather the exact dialogue AI prompt source and prompt-construction path

**Bead ID:** `ee-ougz`  
**SubAgent:** `research`  
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, find the exact prompt and prompt-construction path used by the dialogue script AI for cod-test. Identify the script(s), prompt template(s), config entry points, and any runtime assembly code that materially affects the final prompt sent for dialogue extraction/separation. Update this plan truthfully with the exact files and prompt path. Do not change code yet. Claim the assigned bead at start with bd update <ID> --status in_progress --json and close it on completion with bd close <ID> --reason "Dialogue prompt source gathered" --json.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `configs/`
- `scripts/`
- `server/`
- `prompts/`
- `output/`

**Files Created/Deleted/Modified:**
- `.plans/2026-04-07-review-dialogue-prompt-for-separation-issues.md`
- `configs/cod-test.yaml`
- `output/cod-test-pre-ee-acq-20260320-155949/assets/input/config.yaml`
- `server/scripts/get-context/get-dialogue.cjs`
- `server/lib/phase1-validator-tools.cjs`
- `server/lib/prompt-store.cjs`
- `output/cod-test-pre-ee-acq-20260320-155949/phase1-gather-context/raw/ai/dialogue-transcription/attempt-01/capture.json`
- `output/cod-test-pre-ee-acq-20260320-155949/_meta/ai/_prompts/2786202b50f5a7459c99ad174f1da18c7cf9bd79498cb5b06ec84abb36b7e3d0.json`

**Status:** ✅ Complete

**Results:**
- Exact config entry point for cod-test is `configs/cod-test.yaml`, materialized in the captured run as `output/cod-test-pre-ee-acq-20260320-155949/assets/input/config.yaml`.
- The dialogue lane entry point is `server/scripts/get-context/get-dialogue.cjs` via `gather_context` in that config.
- For the captured cod-test run, the exact whole-asset prompt text comes from `buildTranscriptionPrompt()` in `server/scripts/get-context/get-dialogue.cjs`, then gets augmented by `executeDialogueTranscriptionToolLoop()` in the same file by injecting the local validator-tool-loop instructions built from `buildDialogueTranscriptionValidatorToolContract()` in `server/lib/phase1-validator-tools.cjs`.
- The prompt is persisted through `storePromptPayload()` in `server/lib/prompt-store.cjs` and the exact runtime artifact for this run is `output/cod-test-pre-ee-acq-20260320-155949/_meta/ai/_prompts/2786202b50f5a7459c99ad174f1da18c7cf9bd79498cb5b06ec84abb36b7e3d0.json`.
- The corresponding request/capture that references that prompt is `output/cod-test-pre-ee-acq-20260320-155949/phase1-gather-context/raw/ai/dialogue-transcription/attempt-01/capture.json` (`promptRef` points at the file above, and the request body shows the exact final prompt text sent to the provider).
- This captured cod-test run used the whole-asset dialogue path (`dialogue-data.json` ends with `handoffContext: null`), so the chunked prompt path was present in code but not exercised here.
- If chunking is triggered on a future cod-test run, the alternate prompt path is still in `server/scripts/get-context/get-dialogue.cjs`: `buildChunkTranscriptionPrompt()` for per-chunk extraction plus `buildDialogueStitcherPrompt()` for `config.ai.dialogue_stitch.targets` cleanup/stitching. That stitcher path is configured in `configs/cod-test.yaml`, but it was not the prompt path used by this captured run.

---

### Task 2: Review the dialogue prompt for wording that may cause fusion or speaker collapse

**Bead ID:** `ee-sut6`  
**SubAgent:** `research`  
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, review the exact dialogue AI prompt and identify wording that may contribute to fused adjacent beats, damaged line recovery that over-smooths or drags words across boundaries, overconfident speaker attribution, or collapsed speaker buckets. Propose candidate prompt changes, but do not implement them yet. Update this plan truthfully with the likely problem instructions and candidate wording adjustments. Claim the assigned bead at start with bd update <ID> --status in_progress --json and close it on completion with bd close <ID> --reason "Dialogue prompt review completed" --json.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `docs/`

**Files Created/Deleted/Modified:**
- `.plans/2026-04-07-review-dialogue-prompt-for-separation-issues.md`
- `docs/dialogue-prompt-review-2026-04-07.md`
- `output/cod-test-pre-ee-acq-20260320-155949/_meta/ai/_prompts/2786202b50f5a7459c99ad174f1da18c7cf9bd79498cb5b06ec84abb36b7e3d0.json`
- `output/cod-test-pre-ee-acq-20260320-155949/phase1-gather-context/raw/ai/dialogue-transcription/attempt-01/capture.json`
- `server/scripts/get-context/get-dialogue.cjs`
- `server/lib/local-validator-tool-loop.cjs`
- `server/lib/phase1-validator-tools.cjs`

**Status:** ✅ Complete

**Results:**
- Reviewed the exact captured runtime prompt artifact at `output/cod-test-pre-ee-acq-20260320-155949/_meta/ai/_prompts/2786202b50f5a7459c99ad174f1da18c7cf9bd79498cb5b06ec84abb36b7e3d0.json` and confirmed it is much thinner than the current richer source prompt: it only asks to transcribe audio, identify speakers as `Speaker 1`, `Speaker 2`, etc., provide timestamps, include confidence scores, and return empty output if no speech is detected.
- Reviewed the exact final provider request in `output/cod-test-pre-ee-acq-20260320-155949/phase1-gather-context/raw/ai/dialogue-transcription/attempt-01/capture.json`, including the validator-loop augmentation appended to that base prompt.
- Likely prompt-driven causes of fused adjacent beats: the captured prompt never tells the model to preserve utterance boundaries, keep pauses/gaps as evidence, or avoid bridging adjacent semantically related phrases into one smoother line.
- Likely prompt-driven causes of damaged-line over-smoothing: the captured prompt gives no instruction to preserve clipped/masked fragments literally or to avoid reconstructing missing words from context, so a model is free to polish broken speech into fuller sentences.
- Likely prompt-driven causes of overconfident speaker attribution: the prompt requires confidence scores but gives no calibration rules for overlap, masking, short clips, or attribution ambiguity, which likely encourages schema-completing 0.9x certainty instead of cautious confidence.
- Likely prompt-driven causes of collapsed speaker buckets: `Speaker 1` / `Speaker 2` style labels are requested without any acoustic continuity rules, anonymous `speaker_id` fields, or reminders that scene/topic continuity is not evidence of same-speaker identity.
- The validator loop likely contributes indirectly because it strongly rewards schema-valid JSON (`valid=true`) without checking for boundary smoothing, speaker-bucket collapse, or false certainty; the replayed conversation state can also anchor the model to its own first polished draft once that draft validates.
- Candidate wording adjustments were documented without implementation: add explicit anti-fusion boundary rules, literal-fragment guidance for damaged speech, conservative confidence calibration, acoustic-not-semantic speaker continuity instructions, and validator-loop reminders that schema validity is not enough if boundaries or speaker identity are smoothed.
- Wrote a durable review note at `docs/dialogue-prompt-review-2026-04-07.md` summarizing the exact problematic runtime wording, why it likely causes the observed failure modes, and candidate prompt/validator-loop adjustments.

---

### Task 3: Summarize whether prompt wording or model choice should be the next intervention

**Bead ID:** `ee-yg17`  
**SubAgent:** `research`  
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, synthesize the prompt review into a short recommendation: what issues look plausibly prompt-driven, what may still require a stronger task-specific model, and what the highest-value next intervention should be for dialogue quality. Update this plan truthfully with the conclusion. Claim the assigned bead at start with bd update <ID> --status in_progress --json and close it on completion with bd close <ID> --reason "Dialogue prompt-vs-model recommendation summarized" --json.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `docs/`

**Files Created/Deleted/Modified:**
- `.plans/2026-04-07-review-dialogue-prompt-for-separation-issues.md`
- durable review doc if needed

**Status:** ✅ Complete

**Results:**
- The strongest near-term failures still look prompt-driven, not primarily model-driven: the captured runtime prompt never instructs the model to preserve beat boundaries, avoid bridging across pauses, keep damaged speech as literal fragments, calibrate confidence conservatively, or treat speaker continuity as acoustic rather than semantic. Those omissions line up directly with the observed fusion, over-smoothing, false certainty, and speaker-bucket collapse.
- The validator loop likely amplifies those prompt weaknesses by rewarding schema-valid JSON without checking for boundary smoothing, overconfident attribution, or bucket over-reuse.
- A stronger task-specific model may still be needed for the hardest cases: heavy overlap, severe masking/clipping, extremely short trailer bites, and subtle same-gender/similar-timbre speaker changes where the audio evidence itself is weak. Prompt repairs can reduce self-inflicted errors, but they will not fully solve low-evidence diarization/transcription cases.
- Highest-value next intervention: revise the dialogue prompt and validator-loop instructions first, then rerun the same cod-test asset before considering model swaps. That is the cheapest way to test whether quality improves when the model is explicitly told to preserve boundaries, avoid inferred line repair, lower confidence under ambiguity, and split speakers by audible voice rather than scene logic.
- Recommended decision rule after that rerun: if fused beats and overconfident bucket reuse drop materially, keep iterating prompt/validator wording; if overlap-heavy failures remain concentrated in genuinely ambiguous audio after the prompt fix, escalate to a stronger dialogue/diarization-specialized model.

---

## Final Results

**Status:** ✅ Complete

**What We Built:**
- Traced the exact dialogue prompt path used by the captured cod-test run.
- Produced a durable prompt review in `docs/dialogue-prompt-review-2026-04-07.md` identifying likely wording/validator causes of fusion, damaged-line smoothing, false certainty, and speaker collapse.
- Added a prompt-vs-model recommendation concluding that prompt/validator changes are the next highest-value intervention before testing a stronger model.

**Commits:**
- Pending.

**Lessons Learned:**
- The captured runtime prompt was materially thinner than the richer source prompt in code, so conclusions must stay grounded in the exact persisted run artifact rather than current source intent.
- For this asset class, schema-valid diarization output is not enough; prompt and validator instructions need explicit guidance about boundaries, damaged speech, and uncertainty handling.

---

*Drafted on 2026-04-07*
*Completed on 2026-04-07*