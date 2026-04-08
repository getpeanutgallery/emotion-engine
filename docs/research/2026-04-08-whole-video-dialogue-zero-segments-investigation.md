# Whole-video COD rerun dialogue collapse investigation

**Date:** 2026-04-08  
**Bead:** `ee-qgbp`

## Bottom line

The provider payload for the bad rerun was **not empty**. It returned a non-empty dialogue transcript with **24 dialogue segments**. The collapse to **0 final dialogue segments** happened locally in Phase 1 normalization, before reconciliation and before Phase 2 whole-video prompt assembly.

This is therefore **definitely a code / contract integration bug for the zero-segment collapse itself**, with possible provider variability only as a contributing trigger.

## Compared runs

### Bad run (latest whole-video rerun)
- Final dialogue artifact: `output/cod-test/phase1-gather-context/dialogue-data.json`
- Reconciled dialogue artifact: `output/cod-test/phase1-gather-context/dialogue-data.reconciled.json`
- Raw provider capture: `output/cod-test/phase1-gather-context/raw/ai/dialogue-transcription/attempt-01/capture.json`
- Whole-video prompt snapshot: `output/cod-test/_meta/ai/_prompts/b8b7a72a10c7201370f2226399c3440ff6a187abed14738d65ee6575279b827c.json`

Observed:
- `dialogue-data.json` = **0** `dialogue_segments`
- `dialogue-data.reconciled.json` = **0** `dialogue_segments`
- coverage = `{"start":0,"end":0,"duration":0,"complete":false}`
- whole-video prompt contains only the dialogue summary, with **no “Notable dialogue moments” section**, because the lane was already empty by Phase 2 prompt assembly

### Previous non-empty run
- Final dialogue artifact: `output/_archives/cod-test-pre-ee-uofg-20260408-155355/cod-test/phase1-gather-context/dialogue-data.json`
- Reconciled dialogue artifact: `output/_archives/cod-test-pre-ee-uofg-20260408-155355/cod-test/phase1-gather-context/dialogue-data.reconciled.json`
- Raw provider capture: `output/_archives/cod-test-pre-ee-uofg-20260408-155355/cod-test/phase1-gather-context/raw/ai/dialogue-transcription/attempt-01/capture.json`

Observed:
- `dialogue-data.json` = **20** `dialogue_segments`
- `dialogue-data.reconciled.json` = **20** `dialogue_segments`
- coverage = `{"start":0,"end":135,"duration":135,"complete":false}`

## Trace: where dialogue disappears

### 1) Prompt / provider request
The bad run and previous non-empty run both used the same dialogue prompt snapshot:
- `output/cod-test/_meta/ai/_prompts/73ebdfb2dc8cdafee4aff26a215009db44de4f057474f354b842e58d2b7f67b5.json`
- archived copy: `output/_archives/cod-test-pre-ee-uofg-20260408-155355/cod-test/_meta/ai/_prompts/73ebdfb2dc8cdafee4aff26a215009db44de4f057474f354b842e58d2b7f67b5.json`

That prompt explicitly says:
- `start/end timestamps are optional and should be included only when directly supportable from the audio.`

So the contract presented to the model allows untimed dialogue segments.

### 2) Provider capture
Bad run provider/model:
- provider: `openrouter`
- model: `xiaomi/mimo-v2-omni`

In the bad run capture at:
- `output/cod-test/phase1-gather-context/raw/ai/dialogue-transcription/attempt-01/capture.json`

The raw provider response under:
- `rawResponse.providerResponse.body.choices[0].message.content`

contains a non-empty JSON transcript with spoken lines such as:
- `They want you afraid.`
- `Fear makes you easier to control.`
- `It's time to wake up.`
- etc.

The validator tool-loop history in that same capture shows:
- `toolLoop.history[1].result.valid === true`
- `toolLoop.history[1].result.normalizedValue.dialogue_segments.length === 24`
- all 24 accepted segments have **no `start` and no `end` fields**

So the provider payload already contained useful dialogue, and the local validator accepted it.

### 3) Parser / validator output
The relevant validator path is:
- `server/lib/structured-output.cjs`

`validateDialogueSegments()` accepts missing timestamps because `start` and `end` are optional:
- lines 270-274 only reject ranges when **both** are present and `end <= start`

That means the bad run’s untimed 24-segment payload is considered valid.

### 4) First loss point: normalization
The first point where dialogue becomes empty is:
- `server/scripts/get-context/get-dialogue.cjs:274-286`
- called from `server/scripts/get-context/get-dialogue.cjs:1186-1189`

Current normalization logic:
- defaults missing `start` to `0`
- defaults missing `end` to `start`
- then drops the segment if `end <= start`

So for a segment with no timestamps:
- `start = 0`
- `end = 0`
- segment is discarded

This converts the bad run’s **24 validated untimed segments** into **0 normalized segments**.

### 5) Write path and post-processing
After normalization has already emptied the lane:
- `output/cod-test/phase1-gather-context/dialogue-data.json` is written with zero segments
- reconciliation sees the already-empty lane and cannot restore it:
  - `output/cod-test/phase1-gather-context/famous-song-reconciliation.json`
  - status = `skipped`
  - no dialogue removals / no lyric corrections
- Phase 2 whole-video prompt assembly consumes the already-empty lane via:
  - `server/scripts/process/whole-video-mimo.cjs`
  - `selectCanonicalLaneArtifact(...)`
  - `formatDialogueContext(...)`
- resulting whole-video prompt only includes the dialogue summary and no dialogue moment list:
  - `output/cod-test/_meta/ai/_prompts/b8b7a72a10c7201370f2226399c3440ff6a187abed14738d65ee6575279b827c.json`

No later write or reconciliation step erased a previously non-empty segment array. The damage had already happened in Phase 1 normalization.

## Ranked root-cause candidates

### 1) Definite: normalization/contract mismatch drops all untimed whole-asset dialogue
**Confidence:** very high

Evidence:
- Prompt contract allows optional timestamps
- Validator accepts untimed segments
- Normalizer treats missing timestamps as `0..0` and drops them all
- Bad run provider payload had 24 segments before normalization and 0 after normalization

Code evidence:
- Prompt contract: `server/scripts/get-context/get-dialogue.cjs:2243-2247`
- Validator allows missing times: `server/lib/structured-output.cjs:270-274`, `633-675`
- Normalizer drops missing-time segments: `server/scripts/get-context/get-dialogue.cjs:274-286`

### 2) Strong contributor: whole-asset prompt leaves timestamps optional, so provider variability can legally trigger the collapse
**Confidence:** high

Evidence:
- Same model + same prompt family produced timestamps in the previous run, but omitted them in the bad run
- Because the prompt says timestamps are optional, this model behavior is allowed by contract
- The system had no guardrail to preserve untimed segments or force a repair turn when timing was absent

This makes the provider’s omission a trigger, but not the core bug behind the zeroing.

### 3) Possible fallback gap: no escalation when whole-asset transcript is non-empty but untimed
**Confidence:** medium

Evidence:
- The tool-loop accepted a valid transcript with 24 segments
- The system then silently normalized it to zero instead of retrying, repairing, or falling back to chunked/timing-refinement

This is not the first bug, but it is a secondary resilience gap.

## Smallest plausible fix

**Best smallest fix:** preserve untimed dialogue segments during `normalizeDialogueDataToDuration()` instead of converting missing timestamps to `0..0` and dropping them.

Practical shape:
- If both `start` and `end` are absent, keep the segment as untimed
- Only clamp / range-check when timestamps are actually present
- Let coverage remain `0..0` when no timed segments exist
- Keep `stripDialogueSegmentTiming()` behavior unchanged if the final artifact should stay index/text-only

Why this is the smallest plausible fix:
- It aligns normalization with the existing prompt + validator contract
- It prevents valid non-empty transcripts from collapsing to zero
- It does not require prompt redesign or provider-specific behavior assumptions

## Secondary fix options

If stricter behavior is preferred instead of preserving untimed segments:
1. require timestamps for whole-asset dialogue in the validator/prompt, or
2. detect “non-empty but untimed” whole-asset output and automatically re-prompt / repair / fallback to chunked timing refinement.

Those are larger policy changes than the normalization fix.

## Code vs provider judgment

- **Zero-segment collapse:** **definitely code/integration**
- **Why this specific run lacked timestamps:** **maybe provider/model variability**, but the system explicitly allowed that output shape

So the provider may have changed its behavior run-to-run, but the catastrophic regression came from local handling of an allowed output form.
