# emotion-engine: Xiaomi/OpenRouter dialogue grounding audit

**Date:** 2026-04-03  
**Status:** Draft  
**Agent:** Cookie 🍪

---

## Goal

Determine why the Xiaomi MiMo high-thinking whole-asset dialogue output claims broad/full coverage while the recovered dialogue segments appear grounded only through roughly the first third of the file, and identify the smallest truthful next fix lane.

---

## Overview

The validator-loop terminal-success fix worked and unlocked a full Xiaomi/OpenRouter/high-thinking end-to-end rerun. That removed the previous control-flow blocker and exposed a more troubling artifact-quality issue: the dialogue artifact now completes schema validation and claims full-duration coverage, but its own quality note says the transcription was estimated from provided text without actual audio and the recovered segment evidence only appears to extend to around 46 seconds of the asset.

That combination strongly suggests a grounding problem rather than a formatting problem. We need to inspect the whole-asset dialogue path end to end: what exact prompt and inputs were sent, whether audio was actually attached and in what form, what metadata or contextual text may have primed the model, how the returned artifact was normalized, and where the coverage/timeline metadata is being stamped. The key question is whether the model is operating on real audio evidence, on prompt/context scaffolding, or on some mixed path that produces misleadingly complete metadata.

This tranche should stay review-only. We should not change prompts or code yet. The output should be a source-backed diagnosis of why the current artifact looks falsely grounded and a recommendation for the next narrow implementation lane.

---

## Tasks

### Task 1: Audit the whole-asset dialogue request/response path to confirm what evidence Xiaomi actually received

**Bead ID:** `ee-kr5f`  
**SubAgent:** `research`  
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, inspect the latest Xiaomi/OpenRouter high-thinking whole-asset get-dialogue run artifacts and source path to determine exactly what evidence the model received. Verify whether real audio was attached, in what transport format, what prompt/context text accompanied it, and whether any provided text could explain the model's apparent non-audio grounding. Update the active plan with exact evidence from captures, prompts, and source code. This is review-only: do not modify prompts or code. Claim bead ee-kr5f on start with bd update ee-kr5f --status in_progress --json and close it on completion with bd close ee-kr5f --reason "Audited Xiaomi whole-asset dialogue request evidence and grounding inputs" --json.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `output/`
- `server/scripts/get-context/`
- `server/lib/`
- optional `docs/research/`

**Files Created/Deleted/Modified:**
- `.plans/2026-04-03-xiaomi-dialogue-grounding-audit.md`

**Status:** ✅ Complete

**Results:** Audited the successful rerun at `output/cod-test-xiaomi-mimo-v2-omni-openrouter-high-thinking-rerun/`.

Evidence trail:
- Success artifact: `phase1-gather-context/script-results/get-dialogue.success.json`
- Raw capture: `phase1-gather-context/raw/ai/dialogue-transcription/attempt-01/capture.json`
- Stored base prompt: `_meta/ai/_prompts/d5e8ebc829bffa0a9b0b5d68decc5aedaf436fb78689372784cba8eb21a8bae4.json`
- Extraction log: `phase1-gather-context/raw/ffmpeg/dialogue/extract-audio.json`
- Run events: `_meta/events.jsonl`
- Config: `configs/cod-test-xiaomi-mimo-v2-omni-openrouter-high-thinking-rerun.yaml`
- Source path: `server/scripts/get-context/get-dialogue.cjs`, `server/lib/ffmpeg-config.cjs`, `server/providers/xiaomi.cjs`

What the model actually received:
- Real audio **was attached** on the successful get-dialogue call. The run extracted `examples/videos/emotion-tests/cod.mp4` to `assets/processed/dialogue/audio.mp3` via ffmpeg (`libmp3lame`, `192k`, `44100 Hz`, stereo), producing a 3,361,792-byte MP3. See `extract-audio.json` and config `settings.ffmpeg.audio.container: mp3`.
- The get-dialogue source reads that file into memory as Base64 (`fs.readFileSync(audioPath).toString('base64')`) and passes it to the provider as an attachment with `type: 'audio'` plus MIME from `getAudioMimeType(config)`. In this lane that resolves to `audio/mp3`. See `get-dialogue.cjs` whole-asset path and `ffmpeg-config.cjs` MIME mapping.
- The successful provider capture shows the outbound OpenRouter POST to `https://openrouter.ai/api/v1/chat/completions` for model `xiaomi/mimo-v2-omni`, with `messages[0].content` containing exactly two items: `(1)` a long text prompt and `(2)` an `input_audio` part. The capture redacts/truncates the payload itself, but it definitively records the audio part as present.
- The Xiaomi multimodal adapter builds audio attachments as OpenAI-compatible `input_audio` content with inline data. In source it converts inline Base64 to a data URL (`data:${mimeType};base64,...`) before request assembly; the recorded provider request shows the final message part as `type: "input_audio"` with inline audio fields. So the transport was inline audio, not a remote URL.

Prompt/context text that accompanied the audio:
- The stored base prompt is generic transcription/schema instruction text only: `Transcribe the audio in this file. Identify different speakers and provide timestamps...` plus output-shape rules.
- The actual provider prompt was larger than the stored base prompt because the local validator tool loop appends tool-contract text (`validate_dialogue_transcription_json`), canonical examples, and acceptance rules. The recorded request text length is ~10,044 chars and includes strings like `LOCAL TOOL LOOP` and `Hello there` from the validator example.
- Critically, the recorded provider prompt does **not** include any asset-specific transcript text or COD-specific dialogue context. Direct checks against the request text show no `Menendez`, `David`, `Reznov`, `Mason`, `They want you afraid`, etc. There is no handoff text in this whole-asset path (`requireHandoff: false`).

Implication for the grounding question:
- The pipeline did send real audio, inline, as an `input_audio` attachment.
- The pipeline-provided text visible in the prompt/capture does **not** explain why the model produced COD-specific dialogue. The only visible text besides instructions is generic schema/tooling example content unrelated to the trailer.
- The returned artifact itself admits likely non-audio grounding: `qualityNotes` says `"Transcription estimated from provided text without actual audio; timestamps are approximate."` That note came back from the model in the validated payload, not from a local post-processing hint.
- So the current evidence points away from prompt-supplied transcript leakage and toward either provider/model-side failure to ground on the attached audio (despite the attachment being present) or model prior knowledge/hallucinated reconstruction of the known trailer content.

---

### Task 2: Audit how dialogue coverage, quality notes, and timeline metadata are derived in the Xiaomi whole-asset path

**Bead ID:** `ee-7yjn`  
**SubAgent:** `research`  
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, inspect the source code and latest Xiaomi/OpenRouter high-thinking dialogue artifact to determine how coverage metadata, quality notes, and timing/full-timeline claims are derived. Explain why the artifact can claim full duration coverage when the recovered segments appear to stop around 46 seconds, and identify the exact source-owned seam responsible for that mismatch. Update the active plan with the evidence. This is review-only: do not modify prompts or code. Claim bead ee-7yjn on start with bd update ee-7yjn --status in_progress --json and close it on completion with bd close ee-7yjn --reason "Audited Xiaomi dialogue coverage and metadata derivation" --json.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `server/scripts/get-context/`
- `server/lib/`
- `output/`
- optional `docs/research/`

**Files Created/Deleted/Modified:**
- `.plans/2026-04-03-xiaomi-dialogue-grounding-audit.md`

**Status:** ✅ Complete

**Results:** Source-backed mismatch confirmed. In `output/cod-test-xiaomi-mimo-v2-omni-openrouter-high-thinking-rerun/phase1-gather-context/dialogue-data.json`, the saved dialogue stops at `44.5–46.0s` (19 segments, last `end=46.0`, about `37.0s` of spoken span total) while the same artifact reports `totalDuration: 140.042449`, `timingMode: "full_timeline"`, and `coverage: { start: 0, end: 140.042, duration: 140.042, complete: true }`.

The raw whole-asset provider capture at `output/cod-test-xiaomi-mimo-v2-omni-openrouter-high-thinking-rerun/phase1-gather-context/raw/ai/dialogue-transcription/attempt-01/capture.json` shows the model itself only claimed `totalDuration: 46.0`, `coverage.end: 46.0`, and emitted the carried-through quality note `"Transcription estimated from provided text without actual audio; timestamps are approximate."` That means the final artifact’s full-duration claim is not coming from the model alone.

The exact source-owned seam is in `server/scripts/get-context/get-dialogue.cjs`:
- `normalizeDialogueDataToDuration()` (`208-239`) rewrites `totalDuration` to the real asset duration via `totalDuration: boundedDuration` while only clamping existing segment bounds.
- `buildDialogueAnalysisMetadata()` (`403-466`) then stamps `coverage.start=0`, `coverage.end=durationSeconds`, `coverage.duration=durationSeconds`, and `complete=true` from runtime transport duration, not from recovered segment reach.
- The whole-asset finalize path (`1862-1874`) always calls that builder with `timingMode: "full_timeline"` and `durationSeconds: transportPreflight.durationSeconds`.

The validator path does not enforce semantic consistency here. `validateDialogueCoverage()` / `validateDialogueTranscriptionObject()` in `server/lib/structured-output.cjs` (`491-508`, `611-655`) only type-check and preserve coverage metadata; they do not verify that `coverage.end` or `totalDuration` agrees with the last recovered segment. The validator tool contract in `server/lib/phase1-validator-tools.cjs` (`127-145`) also encodes the optimistic whole-asset shape (`timingMode: "full_timeline"`, `coverage.complete: true`).

Bottom line: the artifact can claim full-duration coverage because the source treats whole-asset execution as equivalent to full-timeline coverage. The mismatch is created in source-owned normalization/finalization after the model returns a much shorter, approximate transcript.

---

### Task 3: Synthesize the audits into a precise diagnosis and recommend the smallest next implementation lane

**Bead ID:** `ee-qajl`  
**SubAgent:** `primary`  
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, synthesize the Xiaomi whole-asset dialogue evidence-input audit and the coverage/metadata audit into a precise diagnosis of the grounding problem. Recommend the smallest truthful next implementation lane, explain whether the issue is prompt/context leakage, transport/input handling, artifact metadata inflation, or another seam, and identify what should be changed first. Update the active plan with the final recommendation. This is review-only: recommend, do not implement. Claim bead ee-qajl on start with bd update ee-qajl --status in_progress --json and close it on completion with bd close ee-qajl --reason "Diagnosed Xiaomi dialogue grounding issue and recommended next fix lane" --json.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- optional `docs/research/`

**Files Created/Deleted/Modified:**
- `.plans/2026-04-03-xiaomi-dialogue-grounding-audit.md`

**Status:** ✅ Complete

**Results:** Precise diagnosis:
- This is **not primarily prompt/context leakage**. The audited request carried real inline MP3 audio and no asset-specific transcript scaffolding; the visible prompt expansion was generic validator/tool-loop text only.
- This is **not proven to be a transport/input-handling bug** either. The request capture shows the `input_audio` part was present, and the pipeline’s local path from ffmpeg extraction -> Base64 attachment -> OpenRouter/Xiaomi request is source-backed and coherent.
- The observed failure is a **two-seam problem**:
  1. **Upstream grounding failure / provider-model reliability seam:** Xiaomi MiMo whole-asset dialogue appears willing to emit COD-specific transcript content while simultaneously admitting low grounding (`"Transcription estimated from provided text without actual audio"`) and returning only partial/approximate timeline support. That points to model-side non-audio reconstruction / weak audio grounding under this prompt+tool-loop regime, not repo-side transcript leakage.
  2. **Source-owned artifact metadata inflation seam:** after that weakly grounded response returns, `get-dialogue.cjs` rewrites `totalDuration` to the asset duration and stamps optimistic `full_timeline` / `coverage.complete: true` metadata from transport duration instead of recovered segment reach. That converts a suspicious partial transcript into a falsely complete artifact.
- So the grounding problem Derrick is seeing is best described as: **an upstream Xiaomi whole-asset grounding miss that is being locally masked and amplified by source-owned metadata inflation.** The metadata bug is not the root cause of the bad transcript, but it is the root cause of why the artifact looks trustworthy when it is not.

Recommended smallest truthful next implementation lane:
- **First change the metadata/finalization contract, not the prompt.** The narrowest honest lane is to stop `get-dialogue.cjs` from auto-promoting whole-asset attempts to full-duration coverage when the recovered transcript does not support that claim.
- Concretely, the first implementation lane should preserve model-returned/segment-supported coverage semantics in whole-asset mode: do not overwrite `totalDuration`/`coverage.end`/`coverage.complete` purely from asset duration, and do not force `timingMode: "full_timeline"` unless the recovered transcript actually spans the file under a defined contract.
- If desired, this can degrade whole-asset artifacts to an explicit partial/approximate state instead of silently upgrading them. That makes benchmark/comparison work truthful immediately and exposes Xiaomi grounding quality directly instead of hiding it behind inflated metadata.

Why this should change first:
- It is the **smallest repo-owned fix** that is clearly justified by the audits.
- It does not require guessing at Xiaomi/OpenRouter internals or broad prompt surgery.
- It prevents downstream plans from mistaking a partial/hallucinated dialogue artifact for full-file evidence.
- Once artifact honesty is restored, the next lane can be a narrow **Xiaomi dialogue-only grounding stabilization** experiment (for example: compare whole-asset vs chunked/hybrid Xiaomi behavior, or adjust validator/repair handling for Xiaomi’s approximate outputs) using truthful coverage signals.

Priority order after this review-only recommendation:
1. **Fix artifact metadata inflation first** so saved whole-asset dialogue artifacts cannot claim coverage they did not earn.
2. Then run a **dialogue-only Xiaomi grounding lane** to determine whether the remaining problem is irreducible provider grounding weakness in whole-asset mode or a recoverable contract issue in the local validator/repair loop.
3. Only after that should Derrick spend another all-phases Xiaomi rerun.

---

## Final Results

**Status:** ✅ Complete

**What We Built:** A source-backed diagnosis of the Xiaomi dialogue grounding issue. The audits show the pipeline really did send inline audio and did not leak COD transcript text through the prompt. The actual failure is a combination of **upstream Xiaomi whole-asset grounding unreliability** and **local metadata inflation** that rewrites a partial/approximate response into a seemingly full-duration artifact.

**Commits:**
- None (review-only)

**Lessons Learned:** The most dangerous seam here is not just that Xiaomi may be weakly grounded on whole-asset dialogue; it is that the repo currently converts that weak output into falsely authoritative metadata. The first fix should make artifacts honest before trying to make Xiaomi smarter.

---

*Completed on 2026-04-03*
