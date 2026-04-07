# Dialogue transcription prompt v2 draft (for approval only)

Date: 2026-04-07
Status: Draft for approval only
Related plan: `.plans/2026-04-07-draft-dialogue-prompt-v2-for-approval.md`

## Why this draft exists

The current dialogue runtime prompt asks for JSON, timestamps, speakers, and confidence, but it still leaves the most failure-prone behavior under-specified. Review of the prompt and cod-test behavior points to four recurring issues:

1. adjacent spoken beats get fused into one smoother line
2. damaged / masked speech gets over-repaired into polished text
3. speaker attribution is stated too confidently when the audio is ambiguous
4. distinct acoustic voices get collapsed into overly broad speaker buckets

Derrick also flagged prompt noise in the runtime wrapper — especially `Tool contract`, `Current turn budget`, and `Conversation state` — as likely distracting rather than helpful for this task. This draft therefore aims to keep the output contract minimal and put the prompt budget into the behavior rules that actually matter.

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

Segmentation and beat-boundary rules:
- Preserve real utterance boundaries.
- Do not merge adjacent spoken beats just because they are semantically related, grammatically compatible, or close together in time.
- Treat pauses, interruptions, overlap changes, delivery pivots, and speaker changes as evidence of separate segments.
- If two phrases are separated by a noticeable pause, interruption, overlap change, or speaker change, keep them as separate dialogue_segments even if combining them would read more smoothly.
- If words are part of one uninterrupted utterance from the same voice, keep them in one segment; do not split artificially.
- Do not bridge across silence, music-only gaps, or non-vocal stretches to create a cleaner sentence.
- Place each spoken line where it actually occurs in the timeline; do not pull later lines earlier or compress dialogue into the opening portion of the file.

Damaged / masked speech rules:
- When speech is partially masked, clipped, distant, distorted, or overlapped, prefer a short literal fragment of what is actually audible.
- Preserve damaged speech as heard.
- Do not smooth a damaged line into a cleaner full sentence.
- Do not borrow missing words from neighboring beats, scene context, likely script memory, or semantic expectation.
- If only part of a line is supported by the audio, return only that supported fragment.
- Prefer a short literal fragment over a polished but weakly supported reconstruction.

Speaker attribution rules:
- Speaker continuity is acoustic, not semantic.
- Reuse a speaker_id only when the audible voice clearly matches.
- A named character, repeated topic, scene continuity, or conversational adjacency is not proof that two lines came from the same speaker.
- Before reusing a speaker_id, compare voice quality, timbre, delivery mode, recording texture, age impression, gender presentation, and accent/dialect impression.
- If those cues do not clearly line up, create a new speaker_id.
- Keep materially different delivery modes separated unless the voice itself clearly matches.
- Do not collapse narration, public-address speech, expository/briefing delivery, radio/comms chatter, villain speech, promo voiceover, or overlap-heavy blends into one speaker bucket unless the acoustic match is genuinely strong.
- If identity is uncertain, keep the bucket anonymous and preserve the uncertainty in descriptors or notes rather than promoting a guess to fact.

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
- Exclude purely instrumental / non-vocal sections.
- If delivery pivots from spoken dialogue into clearly sung, chant-like, rap-like, or otherwise music-led vocal delivery, split immediately at that pivot and keep only the spoken portion in dialogue_segments.
- Do not use adjacent spoken context to pull a music-led vocal phrase into dialogue.
- The summary is secondary; do not alter segmentation, wording, or speaker assignment to make the summary cleaner.
```

---

## Short rationale

### What this draft removes

- Most prompt-budget spent on wrapper noise rather than task behavior
- Any dependence on `Tool contract`, `Current turn budget`, or `Conversation state` as task instructions
- Excess contract detail that does not help the model separate beats or represent uncertainty honestly

### What this draft keeps

- only the essential JSON output contract
- `dialogue_segments`, `speaker_profiles`, `summary`, and `totalDuration`
- the minimum schema reminders needed so a later implementation can still satisfy the validator shape

### What this draft adds

- explicit anti-fusion guidance so adjacent beats stay separate when the audio says they are separate
- literal-fragment guidance for damaged speech so the model reports what is actually heard instead of repairing it
- acoustic-first speaker-continuity rules so speaker buckets are not merged on scene logic alone
- honest confidence-calibration rules so ambiguity lowers scores instead of being hidden behind polished JSON
- explicit protection against collapsing narration / public-address / comms / villain / promo / overlap-heavy material into the same bucket without strong acoustic evidence

## Implementation note

This document is a proposal only. It intentionally does not modify the runtime prompt builder or validator loop yet. A follow-up implementation lane should decide how much of this text belongs in the base prompt versus final-artifact reminders, then test the approved version on cod-test.
