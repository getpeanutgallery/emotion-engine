# Dialogue transcription prompt v2.2 draft (for approval only)

Date: 2026-04-07
Status: Draft for approval only
Related plan: `.plans/2026-04-07-redraft-dialogue-prompt-to-restore-speaker-detail-and-allow-vocals-for-reconciliation.md`
Supersedes as preferred review direction: `docs/dialogue-transcription-prompt-v2-1-draft-2026-04-07.md`

## Why this draft exists

The current dialogue direction overcorrected in two ways:

1. it became too reluctant to emit useful grounded speaker detail, so `acoustic_descriptors` and `inferred_traits` often collapsed to empty placeholders
2. it became too eager to exclude ambiguous sung / chant-like / music-led vocal material during dialogue capture, which likely drops spoken or speech-adjacent content before reconciliation can examine it

Derrick’s requested direction is to keep the dialogue pass generous enough to capture borderline spoken-vocal material for testing, then let reconciliation act as the cleanup stage that strips clearly music-led vocals later. This draft also restores practical speaker-grounding guidance without bringing back prompt pollution or validator/runtime clutter.

---

## Proposed prompt text

```text
Transcribe the audible dialogue and dialogue-like vocal material in this audio.

Return JSON only with this shape:
{
  "dialogue_segments": [
    {
      "start": 0.0,
      "end": 1.2,
      "speaker": "Speaker 1",
      "speaker_id": "spk_001",
      "text": "example line",
      "confidence": 0.72
    }
  ],
  "speaker_profiles": [
    {
      "speaker_id": "spk_001",
      "label": "Speaker 1",
      "grounded": {
        "confidence": 0.68,
        "linked_segment_indexes": [0],
        "acoustic_descriptors": ["low raspy voice", "close-mic delivery"]
      },
      "inferred_traits": {
        "traits": [
          {
            "trait": "presentation",
            "value": "adult masculine-coded voice",
            "confidence": 0.45,
            "note": "speculative impression from timbre only"
          }
        ]
      }
    }
  ],
  "summary": "brief summary of the dialogue content",
  "totalDuration": 0.0
}

Rules:
- Return JSON only. No markdown. No explanation.
- Use seconds for all timestamps.
- Set totalDuration to the full attached media runtime, not just the span covered by captured dialogue.
- If no intelligible dialogue or dialogue-like vocal material is present, return an empty dialogue_segments array.

Segmentation rules:
- Preserve real utterance boundaries.
- Do not merge adjacent beats just because they are semantically related, grammatically compatible, or close together in time.
- Treat pauses, interruptions, overlap changes, delivery pivots, and speaker changes as evidence of separate segments.
- If two phrases are separated by a noticeable pause, interruption, overlap change, or speaker change, keep them as separate dialogue_segments even if combining them would read more smoothly.
- If words are part of one uninterrupted utterance from the same voice, keep them in one segment; do not split artificially.
- Do not bridge across silence, music-only gaps, or non-vocal stretches to create a cleaner sentence.
- Place each captured line where it actually occurs in the timeline; do not pull later lines earlier or compress dialogue into another part of the file.

Damaged-speech rules:
- When speech is partially masked, clipped, distant, distorted, or overlapped, prefer a short literal fragment of what is actually audible.
- Preserve damaged speech as heard.
- Do not smooth a damaged line into a cleaner full sentence.
- Do not borrow missing words from neighboring beats, scene context, likely script memory, or semantic expectation.
- If only part of a line is supported by the audio, return only that supported fragment.
- Prefer a short literal fragment over a polished but weakly supported reconstruction.

Speaker rules:
- Speaker continuity is acoustic, not semantic.
- Reuse a speaker_id only when the audible voice clearly matches.
- A named character, repeated topic, scene continuity, or conversational adjacency is not proof that two lines came from the same speaker.
- Before reusing a speaker_id, compare voice quality, timbre, delivery mode, recording texture, apparent age range, gender presentation, and accent/dialect impression.
- If those cues do not clearly line up, create a new speaker_id.
- Keep materially different delivery modes separated unless the voice itself clearly matches.
- Do not collapse narration, public-address speech, expository/briefing delivery, radio/comms chatter, villain speech, promo voiceover, or overlap-heavy blends into one speaker bucket unless the acoustic match is genuinely strong.
- If identity is uncertain, keep the bucket anonymous and preserve the uncertainty in grounded descriptors and speculative traits rather than promoting a guess to fact.

Confidence rules:
- Use conservative confidence values.
- Confidence must reflect both transcription certainty and speaker-assignment certainty.
- Lower confidence materially when speech is short, masked, clipped, overlapped, stylized, distant, noisy, or speaker attribution is ambiguous.
- Do not use near-certain scores unless the words and the speaker match are both strongly supported by the audio.
- Similar-sounding voices, damaged fragments, and overlap-heavy moments should often stay moderate-confidence rather than near-certain.
- Do not signal certainty you did not earn from the audio.

Speaker profile rules:
- Use generic display labels such as "Speaker 1", "Speaker 2", etc., but preserve continuity with anonymous speaker_id values such as "spk_001".
- Every speaker_profiles[*].grounded object must include a numeric confidence from 0.0 to 1.0.
- grounded should contain cautious same-speaker evidence: anonymous continuity, linked_segment_indexes, and acoustically supported descriptors.
- When supportable, include practical acoustic_descriptors that would help a later reviewer distinguish or reunify speakers, such as pitch range, raspiness/smoothness, breathiness, intensity, cadence, pacing, mic distance, recording texture, accent impression, age impression, or delivery mode.
- Do not leave acoustic_descriptors empty just because the description is imperfect; include concise grounded descriptors when the audio gives real support.
- inferred_traits must always be present as an object with a traits array.
- Use inferred_traits for clearly speculative impressions that may still help review, such as age range, gender presentation, role impression, or demeanor.
- Keep inferred_traits clearly speculative and separate from grounded same-speaker evidence.
- If a trait is only weakly supported, include it with a low confidence and a short note that makes the uncertainty explicit.

Scope rules:
- Include intelligible spoken dialogue.
- Exclude purely instrumental or non-vocal sections.
- Exclude clearly lyric-led, melody-led, or predominantly musical vocal passages when they do not plausibly function as dialogue.
- If a segment mixes spoken content with music-led vocalization, keep the intelligible dialogue-like portion that is supportable from the audio.
- Do not use the summary to justify dropping ambiguous dialogue-like vocals early.
- The summary is secondary; do not alter segmentation, wording, or speaker assignment to make the summary cleaner.
```

---

## Main changes from the current prompt direction

### 1) Restores useful grounded speaker detail

This draft no longer teaches the model that empty `acoustic_descriptors` and empty `inferred_traits` are the safest preferred outcome. Instead it tells the model to emit concise, practical speaker-grounding detail when the audio supports it, while still keeping speculation clearly labeled.

### 2) Relaxes the exclusion of ambiguous vocal material

The current runtime direction repeatedly says spoken-only, split immediately at music-led pivots, and do not pull ambiguous vocal phrases into dialogue. This draft changes that bias. Borderline speech-song, chant-like callouts, rhythmic promo delivery, and other spoken/sung hybrids should be kept when they still plausibly function as dialogue and carry intelligible words.

### 3) Pushes cleanup into reconciliation

This draft explicitly states that reconciliation is the later cleanup stage for stripping or reclassifying music-led vocals. That keeps the dialogue pass from throwing away borderline material too early during testing.

### 4) Stays lean

This remains a concrete task prompt only. It does not reintroduce tool-contract prose, validator-visible instructions, turn-budget chatter, or other runtime clutter.

## Approval / implementation note

This document is approval-only drafting. It does not modify `server/scripts/get-context/get-dialogue.cjs` or any validator/runtime code. If approved, the implementation lane should replace the current over-strict dialogue scope wording with this reviewed direction and then test how reconciliation handles the extra retained vocal material.
