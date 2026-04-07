# Dialogue transcription prompt v2.1 draft (for approval only)

Date: 2026-04-07
Status: Draft for approval only
Related plan: `.plans/2026-04-07-draft-dialogue-prompt-v2-1-and-audit-cross-phase-ai-flows.md`
Supersedes as preferred draft direction: `docs/dialogue-transcription-prompt-v2-draft-2026-04-07.md`

## Why this draft exists

This v2.1 draft keeps the important behavior changes from v2, but assumes a lean runtime:

- validation stays local on our side
- the model only needs to produce the required JSON shape
- the first valid JSON is accepted immediately
- invalid JSON is corrected with a retry message only
- no model-visible tool contract, turn budget, or conversation-state framing

The goal is to spend prompt budget on transcription behavior instead of runtime mechanics.

---

## Proposed prompt text

```text
Transcribe the audible spoken dialogue in this audio.

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
        "acoustic_descriptors": []
      },
      "inferred_traits": {
        "traits": []
      }
    }
  ],
  "summary": "brief summary of the spoken dialogue",
  "totalDuration": 0.0
}

Rules:
- Return JSON only. No markdown. No explanation.
- Use seconds for all timestamps.
- Set totalDuration to the full attached media runtime, not just the span covered by dialogue.
- If no audible spoken dialogue is present, return an empty dialogue_segments array.

Segmentation rules:
- Preserve real utterance boundaries.
- Do not merge adjacent spoken beats just because they are semantically related, grammatically compatible, or close together in time.
- Treat pauses, interruptions, overlap changes, delivery pivots, and speaker changes as evidence of separate segments.
- If two phrases are separated by a noticeable pause, interruption, overlap change, or speaker change, keep them as separate dialogue_segments even if combining them would read more smoothly.
- If words are part of one uninterrupted utterance from the same voice, keep them in one segment; do not split artificially.
- Do not bridge across silence, music-only gaps, or non-vocal stretches to create a cleaner sentence.
- Place each spoken line where it actually occurs in the timeline; do not pull later lines earlier or compress dialogue into the opening portion of the file.

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
- Before reusing a speaker_id, compare voice quality, timbre, delivery mode, recording texture, age impression, gender presentation, and accent/dialect impression.
- If those cues do not clearly line up, create a new speaker_id.
- Keep materially different delivery modes separated unless the voice itself clearly matches.
- Do not collapse narration, public-address speech, expository or briefing delivery, radio or comms chatter, villain speech, promo voiceover, or overlap-heavy blends into one speaker bucket unless the acoustic match is genuinely strong.
- If identity is uncertain, keep the bucket anonymous and preserve the uncertainty in descriptors rather than promoting a guess to fact.

Confidence rules:
- Use conservative confidence values.
- Confidence must reflect both transcription certainty and speaker-assignment certainty.
- Lower confidence materially when speech is short, masked, clipped, overlapped, stylized, distant, noisy, or speaker attribution is ambiguous.
- Do not use near-certain scores unless the words and the speaker match are both strongly supported by the audio.
- Similar-sounding voices, damaged fragments, and overlap-heavy trailer moments should often stay moderate-confidence rather than near-certain.
- Do not signal certainty you did not earn from the audio.

Speaker profile rules:
- Use generic display labels such as "Speaker 1", "Speaker 2", etc., but preserve continuity with anonymous speaker_id values such as "spk_001".
- Every speaker_profiles[*].grounded object must include a numeric confidence from 0.0 to 1.0.
- grounded should contain only cautious same-speaker evidence: anonymous continuity, linked_segment_indexes, and acoustically supported descriptors.
- If no acoustic descriptor is supportable, return an empty acoustic_descriptors array.
- inferred_traits must always be present as an object with a traits array.
- Keep inferred_traits clearly speculative and separate from grounded same-speaker evidence.

Scope rules:
- Include audible spoken dialogue.
- Exclude purely instrumental or non-vocal sections.
- If delivery pivots from spoken dialogue into clearly sung, chant-like, rap-like, or otherwise music-led vocal delivery, split immediately at that pivot and keep only the spoken portion in dialogue_segments.
- Do not use adjacent spoken context to pull a music-led vocal phrase into dialogue.
- The summary is secondary; do not alter segmentation, wording, or speaker assignment to make the summary cleaner.
```

---

## Main differences from v2

### What got leaner

- Removed v2’s implementation-facing framing about a later validator-driven runtime.
- Recast the draft so it directly assumes hidden local validation and retry-only correction.
- Tightened the purpose statement around task behavior plus required JSON shape.
- Kept the prompt body focused on behavior rules instead of runtime mechanics.

### What stayed intentionally the same

- Anti-fusion segmentation guidance.
- Literal-fragment / anti-reconstruction guidance for damaged speech.
- Acoustic-first speaker continuity and anonymous `speaker_id` handling.
- Conservative confidence calibration.
- Cautious separation between grounded evidence and inferred traits.
- Spoken-only scope with explicit split at music-led vocal pivots.

## Approval / implementation note

This is still approval-only drafting. It does not change runtime code. If approved, the implementation lane should inject only this task-facing prompt plus the minimum hidden retry/validation behavior needed on our side.