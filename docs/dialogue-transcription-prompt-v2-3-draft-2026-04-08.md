# Dialogue transcription prompt v2.3 draft (for Derrick review only)

Date: 2026-04-08
Status: Draft for review only
Related plan: `.plans/2026-04-08-research-timestamp-tooling-and-audit-dialogue-capture-prompt.md`
Supersedes as preferred review direction: `docs/dialogue-transcription-prompt-v2-2-draft-2026-04-07.md`

## Why this draft exists

The current live dialogue prompt is already leaner than the earlier spoken-only drafts, but it still carries exclusion-first wording that can cause the first-pass capture step to throw away or trim speech-like material too early.

This revision keeps the runtime practical and close to the live prompt, but shifts the scope rules to **preservation-first capture**:
- keep intelligible dialogue-like vocals when they plausibly function as speech
- avoid trimming a mixed utterance down to only the safest fragment just because score or melodic delivery is present
- let downstream reconciliation decide whether a retained phrase is actually lyric-only material that should be removed or reclassified later

This is still a review draft only. It does **not** change live behavior in `server/scripts/get-context/get-dialogue.cjs`.

---

## Proposed prompt text

```text
Transcribe the audible dialogue and dialogue-like vocal material in this audio.

Return JSON only with this shape:
{
  "dialogue_segments": [
    {
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
  "summary": "brief summary of the dialogue content"
}

Rules:
- Return JSON only. No markdown. No explanation.
- Place dialogue segments in the order in which they are heard.
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
- If only part of a line is supportable from the audio, return only that supported fragment.
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
- Include practical acoustic_descriptors that would help a later reviewer distinguish or reunify speakers, such as pitch range, raspiness/smoothness, breathiness, intensity, cadence, pacing, mic distance, recording texture, accent impression, age impression, gender impression, or delivery mode.
- Do not leave acoustic_descriptors empty just because the description is imperfect; include concise grounded descriptors when the audio gives real support.
- inferred_traits must always be present as an object with a traits array.
- Use inferred_traits for clearly speculative impressions that may still help review, such as age range, gender presentation, role impression, or demeanor.
- Keep inferred_traits clearly speculative and separate from grounded same-speaker evidence.
- If a trait is only weakly supported, include it with a low confidence and a short note that makes the uncertainty explicit.

Scope rules:
- Include intelligible spoken dialogue.
- Do not drop or trim intelligible words merely because musical score is present underneath, the delivery has melodic contour, or the phrase might also resemble lyrics.
- If classification is ambiguous, preserve the line and express uncertainty through conservative confidence rather than suppressing it.
- Reconciliation happens later; do not act as the final filter for whether a retained speech-like phrase should be stripped as lyric-only material.
- Do not use the summary to justify dropping ambiguous dialogue-like vocals early.
- The summary is secondary; do not alter segmentation, wording, or speaker assignment to make the summary cleaner.
```

---

## Explicit wording removed or inverted from the live direction

### Removed exclusion-first wording

Removed live wording:
- `Exclude clearly lyric-led, melody-led, or predominantly musical vocal passages when they do not plausibly function as dialogue.`

Why:
- It teaches the first-pass dialogue capture step to reject borderline material before reconciliation can inspect it.
- In practice, that can hit rhythmic promo lines, chant-like threats, shouted callouts over score, and speech-song hybrids.

### Inverted trimming wording

Removed/inverted live wording:
- `If a segment mixes spoken content with music-led vocalization, keep the intelligible dialogue-like portion that is supportable from the audio.`

Replacement direction:
- preserve the **full intelligible utterance** when it still plausibly functions as dialogue-like speech
- use confidence to mark ambiguity instead of trimming the line down to a smaller safe fragment

Why:
- `keep the ... portion` is a trim instruction
- it encourages early under-capture and fragmentation before reconciliation

### Explicitly preserved the lean runtime shape

Kept intentionally:
- JSON-only response contract
- same overall object shape
- same anti-merging / anti-bridging segmentation rules
- same damaged-speech conservatism
- same acoustic-first speaker continuity rules
- same conservative confidence posture
- same rule excluding purely instrumental / non-vocal sections

This should be implementable as a targeted prompt replacement rather than a redesign.

## Practical review notes for Derrick

If you approve this direction, the likely implementation delta is narrow:
- replace the current exclusion/partial-trim scope lines in `server/scripts/get-context/get-dialogue.cjs`
- mirror the same preservation-first wording in both whole-asset and chunked prompt variants
- update `test/scripts/get-dialogue.test.js` assertions that currently lock in the old exclusionary wording

I would **not** broaden the prompt much beyond this draft until we see how reconciliation handles the extra retained material.
