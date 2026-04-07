# Dialogue prompt review for separation / beat-boundary issues

Date: 2026-04-07
Plan: `.plans/2026-04-07-review-dialogue-prompt-for-separation-issues.md`
Reviewed runtime artifact: `output/cod-test-pre-ee-acq-20260320-155949/_meta/ai/_prompts/2786202b50f5a7459c99ad174f1da18c7cf9bd79498cb5b06ec84abb36b7e3d0.json`
Reviewed request capture: `output/cod-test-pre-ee-acq-20260320-155949/phase1-gather-context/raw/ai/dialogue-transcription/attempt-01/capture.json`
Relevant source path: `server/scripts/get-context/get-dialogue.cjs` + validator-loop augmentation from `server/lib/local-validator-tool-loop.cjs` and `server/lib/phase1-validator-tools.cjs`

## What the captured runtime prompt actually says

Base prompt in the captured run:

- `Transcribe the audio in this file. Identify different speakers and provide timestamps.`
- `Identify speakers as "Speaker 1", "Speaker 2", etc.`
- `Provide accurate timestamps in seconds.`
- `Include confidence scores from 0.0 to 1.0.`
- `If no speech is detected, return an empty dialogue_segments array.`

Validator-loop augmentation then adds schema/tooling instructions, but no semantic rules about beat boundaries, uncertainty, damaged speech, or speaker-bucket discipline.

## Likely prompt problems

### 1) Fused adjacent beats: no boundary-preservation instruction

The captured prompt never tells the model to preserve real pauses, avoid bridging across gaps, or keep adjacent utterances separate when they are separate beats.

Problematic wording / omission:

- `Transcribe the audio in this file. Identify different speakers and provide timestamps.`
- `Provide accurate timestamps in seconds.`

Why this likely hurts:

- This asks for a clean diarized transcript, but does not define what counts as one segment.
- Without explicit anti-fusion guidance, the model is free to package nearby phrases into one polished line if they feel semantically related.
- `accurate timestamps` is too weak on its own; a model can still give plausible timestamps while smoothing boundaries.

Candidate wording adjustment:

- `Preserve real utterance boundaries. Do not merge adjacent spoken beats just because they are semantically related or occur in the same scene.`
- `Keep silence, non-vocal gaps, and speaker handoffs as timeline evidence. Do not bridge across pauses to make a smoother sentence.`
- `If two phrases are separated by a noticeable pause, interruption, overlap change, or speaker change, keep them as separate dialogue_segments even if the text would read smoothly as one line.`

### 2) Damaged-line recovery is unconstrained, so smoothing is rewarded

The captured prompt gives no instruction to prefer literal partial fragments when speech is masked, clipped, or overlapped.

Problematic omission:

- There is no line telling the model to keep broken/masked words literally.
- There is no line telling the model not to reconstruct a fuller sentence from context.

Why this likely hurts:

- In overlap-heavy trailer audio, models tend to infer the intended sentence instead of reporting the damaged fragment actually heard.
- That inference can drag words across nearby boundaries and produce a cleaner-but-false combined line.

Candidate wording adjustment:

- `When speech is partially masked, clipped, or overlapped, prefer a short literal fragment of what is actually audible over a smoothed full-sentence reconstruction.`
- `Do not borrow missing words from neighboring beats, scene context, or likely script memory.`
- `If only part of a line is clearly audible, return only that supported fragment and keep the uncertainty local to that segment.`

### 3) Overconfident speaker attribution is invited by the confidence field with no calibration rules

Problematic wording:

- `Identify different speakers...`
- `Include confidence scores from 0.0 to 1.0.`

Why this likely hurts:

- The prompt asks for confident-looking numeric certainty but gives no calibration guidance.
- Nothing tells the model to lower confidence for overlap, masking, short clips, similar-sounding voices, or uncertain attribution.
- In the captured output, almost every segment lands in the 0.91-0.99 band, which is a classic sign that the schema is being satisfied rather than uncertainty being measured.

Candidate wording adjustment:

- `Use conservative confidence values. Lower confidence materially when speech is masked, clipped, overlapped, distant, stylized, or speaker attribution is uncertain.`
- `Do not signal certainty you did not earn from the audio. Similar-sounding voices and short trailer bites should often remain moderate-confidence rather than near-certain.`
- `Confidence should reflect both transcription certainty and speaker-assignment certainty, not just whether the line sounds plausible.`

### 4) Collapsed speaker buckets are encouraged by generic labels with no continuity rules

Problematic wording:

- `Identify speakers as "Speaker 1", "Speaker 2", etc.`

Why this likely hurts:

- The runtime prompt only asks for display labels, not persistent acoustic identity rules.
- There is no instruction to compare timbre/delivery/recording texture before reusing a speaker bucket.
- There is no instruction to split narration, comms chatter, villain speech, announcer VO, and public-address style lines unless the actual voice matches.
- Result: the model can over-reuse `Speaker 1` / `Speaker 2` as broad semantic roles rather than real acoustic voices.

Candidate wording adjustment:

- `Treat speaker continuity as acoustic, not semantic. Reuse a speaker only when the audible voice clearly matches.`
- `A character name, topic continuity, or scene continuity is not evidence that two lines came from the same speaker.`
- `If narration/public-address/comms/promo-announcer delivery sounds materially different from nearby character dialogue, create a new speaker bucket.`
- Prefer adding stable anonymous `speaker_id` fields (for example `spk_001`) and keep display labels separate from continuity identity.

### 5) The required summary may gently bias toward compression and coherence

Problematic wording:

- `"summary": "Brief summary of the dialogue content"`

Why this may contribute:

- This is not the main cause, but it nudges the model toward building a coherent interpretation of the clip.
- That coherence pressure can pair badly with sparse segmentation instructions and make the model more willing to smooth damaged or adjacent material into cleaner narrative beats.

Candidate wording adjustment:

- Keep the summary if needed, but explicitly subordinate it: `The summary is secondary. Do not alter segmentation, wording, or speaker assignment to make the summary cleaner.`

## Validator-loop contribution

The validator-loop text looks materially relevant even though it does not directly tell the model to merge lines.

### A) The validator checks structure, not epistemic caution

Relevant runtime loop behavior:

- `The final dialogue transcription JSON is accepted only after validate_dialogue_transcription_json returns {"valid": true}.`
- The validator contract mostly enforces schema shape, not timeline/boundary/speaker-quality discipline.

Why this matters:

- Once the model has a plausible JSON object, the loop mostly rewards formal validity.
- There is no validator rejection for overconfident confidence scores, speaker-bucket collapse, boundary smoothing, or reconstructed damaged phrases.
- That means the loop can reinforce a neat but wrong answer.

### B) The conversation-state replay can anchor the model to its own first polished draft

The captured request includes a prior assistant draft plus a validator acceptance record in `Conversation state`.

Why this matters:

- Once an over-smoothed draft survives validation, the loop hands it back as accepted structure.
- The model is then nudged to preserve that draft rather than re-open uncertain boundaries or speaker assignments.

Candidate wording / loop adjustment ideas:

- Add final-artifact reminders such as:
  - `Schema-valid JSON is not enough; preserve true beat boundaries and avoid inferred line repair.`
  - `If unsure whether adjacent text belongs to one beat or two, prefer separate segments over a fused segment.`
  - `Do not keep a speaker bucket solely because an earlier draft used it.`
- Consider validator-side warnings or hard failures for obviously suspicious patterns later, such as extreme confidence clustering, broad speaker reuse without `speaker_id` support, or long fused segments spanning internal pauses.

## Highest-value prompt adjustments before any code change

1. Add explicit anti-fusion language about preserving pauses, handoffs, and adjacent beats.
2. Add literal-fragment guidance for damaged / overlapped speech and explicitly ban reconstruction from context.
3. Add conservative-confidence calibration rules tied to masking and speaker uncertainty.
4. Add acoustic continuity rules plus anonymous `speaker_id` support so speaker buckets are evidence-based rather than semantic-role-based.
5. Add a reminder in the validator loop that schema-valid output can still be wrong if boundaries are smoothed or speakers are over-collapsed.

## Bottom line

The captured runtime prompt is too generic for trailer-style, overlap-heavy dialogue separation. It mostly asks for a neat diarized transcript with timestamps and confidence, but it does not tell the model how to behave when the real problem is messy: damaged lines, beat boundaries, and speaker uncertainty. The validator loop then rewards well-formed JSON without checking those semantics, which likely amplifies over-smoothing and overconfidence.