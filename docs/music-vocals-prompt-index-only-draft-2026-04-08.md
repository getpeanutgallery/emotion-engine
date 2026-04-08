# Music-vocals prompt draft for index-only chronology review

**Date:** 2026-04-08  
**Status:** Review only — do not apply to runtime yet  
**Review target:** `server/scripts/get-context/get-music-vocals.cjs`

## Why this draft exists

Derrick approved the index-only chronology direction for dialogue and music-vocals. The live music-vocals prompt is already partially aligned, but it still shows `start` / `end` fields directly in the example JSON and still frames some chronology through time windows in ways that can encourage the model to invent authoritative timing.

This draft keeps the live prompt very close to its current shape so it can be landed narrowly later, but changes the truth contract:

- `index` / array order is the primary chronology signal.
- The prompt should not request timing of when lyrics are sung or the total time, only that the lyrics are placed in the right order.
- Repeats and late returns should still be preserved as separate ordered entries.

## Concise summary of proposed changes

1. Remove `start` / `end` and other timing variables from the example `vocal_segments` objects in both whole-asset and chunked prompt examples so the default visible contract is index-only.
2. Add explicit wording that array order and `index` are the truthful chronology signal.
3. Keep the existing recall-scaffolding, lyric-honesty, overlap, and recognized-song guidance intact.
4. Keep `recognizedSong` available.
5. Preserve the current narrow lane boundary: spoken dialogue stays out of `vocal_segments`; only music-led lexical vocals belong here.

---

## Proposed whole-asset prompt revision

```text
Analyze the complete extracted audio track.

${modeNote}

${formatMusicLaneContext(musicContext)}Extract only text-bearing music-led vocals across the full asset.

Return JSON only in this format:
{
  "vocalSummary": "Concise summary of any sung/chanted/rapped lexical vocals across the asset, or say no text-bearing music-led vocals were detected.",
  "vocal_segments": [
    {
      "index": 0,
      "text": "We rise tonight",
      "confidence": 0.91,
      "performer": "Vocalist 1",
      "performer_id": "voc_001",
      "delivery": "sung"
    }
  ],
  "recognizedSong": {
    "status": "recognized",
    "confidence": 0.93,
    "candidates": [
      {
        "title": "Master of Puppets",
        "artist": "Metallica",
        "confidence": 0.93,
        "evidence": ["Literal lyric fragments match the heard refrain."],
        "matchedLyrics": ["Master, master", "Obey your master"]
      }
    ],
    "primaryEvidence": "Distinct lyric fragments and delivery strongly support one specific song.",
    "multipleSongsDetected": false
  },
  "recognitionNotes": [
    "Optional lane-level caution about overlap, masking, short duration, or multiple songs."
  ],
  "qualityNotes": [
    "Optional note about confidence, timing support, or ambiguity."
  ]
}

Rules:
- Preserve vocal segment chronology via array order and index values. Array order/index is the truthful chronology signal for this lane.
- If timing is uncertain but the lyric-bearing event is clearly present, still emit the segment in the correct order/index position.
- Aim for full-trailer lyric coverage, not just representative examples.
- Capture each distinct lyric-bearing entry, reprise, or short return at the point it occurs in sequence.
- Do not skip a lyric segment merely because the phrase already appeared earlier; repeated hooks need their own vocal_segments.
- Keep spoken narration, spoken dialogue over score, and non-lexical vocalizations out of vocal_segments.
- Use vocal_segments only for audible sung lyrics, chant-like hooks, rap, melodic refrains, or truly inseparable hybrid music-led delivery.
- If speech and song overlap, keep only the clearly music-led lexical content in vocal_segments; spoken overlay remains outside this lane.
- Include only literal heard words or short partial fragments with discernible lexical content; do not paraphrase or invent missing words.
- Prefer short literal fragments over polished wrong lyric variants when the audio is masked or ambiguous.
- When masking reduces certainty, prefer a shorter lower-confidence literal fragment plus a qualityNotes caution over omitting the segment.
- Break vocal_segments when lyric wording changes, when a refrain repeats after a gap, or when a new vocal phrase is audibly distinct.
- Do not merge multiple lyric lines into one segment.
- Delivery must be one of: sung, chant, rap, melodic_refrain, hybrid.
- Use hybrid only when the same continuous utterance is truly inseparable as both speech-led and music-led; otherwise split adjacent spoken and sung spans and keep only the sung side here.
- After at least one literal lyric fragment grounds a likely song, you may use a high-confidence recognizedSong hypothesis as bounded recall scaffolding for nearby lines in the same cue.
- Treat whole-asset lyric phrases and recognizedSong matches as recall scaffolding only: confirm, shorten, correct, or reject them based on the chunk audio rather than copying them blindly.
- If an expected canonical line is only partly supported by the audio, emit only the shortest audibly supported fragment instead of a polished full-line rewrite.
- Do not promote a vague melody/hook match into a full canonical lyric line without audible lexical support in this asset.
- recognizedSong is optional. Use it only when the heard sung/chant/rap evidence supports a plausible famous-song hypothesis.
- Prefer recognizedSong.status = unknown, possible, or multiple_possible over inventing certainty.
- Every recognizedSong candidate must cite audio-grounded evidence; literal matchedLyrics are stronger than vibe-only guesses.
- Spoken dialogue, narration, radio chatter, or promo VO over music are never lyric evidence. If overlap weakens confidence, mention that in recognitionNotes.
- If multiple songs or cues are plausibly present, set multipleSongsDetected to true and prefer multiple_possible unless one clearly dominates.
- If no text-bearing music-led vocals are present, return vocal_segments as [] and say so in vocalSummary.
- JSON only. No markdown, no explanation.
```

---

## Proposed chunked prompt revision

```text
Analyze the audio in this chunk (${startTime.toFixed(1)}s to ${endTime.toFixed(1)}s).

Important grounding:
- The attached audio file is already the extracted audio for this exact global window.
- The attached chunk duration is approximately ${chunkDurationSeconds.toFixed(1)} seconds.
- Treat ${startTime.toFixed(1)}s to ${endTime.toFixed(1)}s as the chunk's location in the original timeline, not as a claim about the attached file's full duration.
- Do NOT claim the requested range exceeds the file duration just because the attached chunk is shorter than the full trailer.
- Analyze only the audio that is actually present in the attached chunk.

${musicLaneContext}${wholeAssetContext}${wholeAssetChecklist}${roll ? `Rolling vocals summary so far (from previous chunks):
${roll}

` : ''}Extract only text-bearing music-led vocals for this chunk and maintain a concise rolling summary. Use the whole-asset context as a recall scaffold: confirm, refine, or reject expected lyric-bearing moments for this window based on the actual chunk audio.

Return JSON only in this format:
{
  "rollingSummary": "Updated rolling summary of text-bearing music-led vocals so far.",
  "vocalSummary": "Concise chunk-local vocals summary, or say none were detected in this chunk.",
  "vocal_segments": [
    {
      "index": 0,
      "text": "We rise tonight",
      "confidence": 0.91,
      "performer": "Vocalist 1",
      "performer_id": "voc_001",
      "delivery": "sung"
    }
  ],
  "recognizedSong": {
    "status": "possible",
    "confidence": 0.78,
    "candidates": [
      {
        "title": "Master of Puppets",
        "artist": "Metallica",
        "confidence": 0.78,
        "evidence": ["Literal lyric fragment and delivery align with one specific song."],
        "matchedLyrics": ["Master, master"],
        "ambiguity": "Only a short refrain is audible in this chunk."
      }
    ],
    "primaryEvidence": "A short lyric fragment suggests a specific song, but certainty remains evidence-gated.",
    "ambiguity": "Short chunk duration limits certainty.",
    "multipleSongsDetected": false
  },
  "recognitionNotes": [
    "Optional lane-level caution about overlap, masking, short duration, or multiple songs."
  ],
  "qualityNotes": [
    "Optional note about ambiguity, masking, or timing support in this chunk."
  ]
}

Rules:
- Preserve vocal segment chronology via array order and index values. Array order/index is the truthful chronology signal for this chunk output.
- If timing is uncertain but a lyric-bearing moment is clearly present, still emit the segment in the correct order/index position.
- Keep spoken narration, spoken dialogue over score, and non-lexical vocalizations out of vocal_segments.
- Use vocal_segments only for audible sung lyrics, chant-like hooks, rap, melodic refrains, or truly inseparable hybrid music-led delivery.
- If speech and song overlap, keep only the clearly music-led lexical content in vocal_segments; spoken overlay remains outside this lane.
- Include only literal heard words or short partial fragments with discernible lexical content; do not paraphrase or invent missing words.
- Prefer short literal fragments over polished wrong lyric variants when the chunk is masked or ambiguous.
- When masking reduces certainty, prefer a shorter lower-confidence literal fragment plus a qualityNotes caution over omitting the segment.
- Break vocal_segments when lyric wording changes, when a refrain repeats after a gap, or when a new vocal phrase is audibly distinct.
- Do not skip a lyric segment merely because the phrase already appeared earlier; repeated hooks later in the trailer still need their own vocal_segments.
- Do not merge multiple lyric lines into one segment.
- Delivery must be one of: sung, chant, rap, melodic_refrain, hybrid.
- Use hybrid only when the same continuous utterance is truly inseparable as both speech-led and music-led; otherwise split adjacent spoken and sung spans and keep only the sung side here.
- Use rollingSummary, whole-asset context, and any high-confidence recognizedSong match as a checklist so late and brief lyric windows are revisited instead of forgotten.
- Treat whole-asset lyric phrases and recognizedSong matches as bounded recall scaffolding only: confirm, shorten, correct, or reject them based on this chunk rather than copying them blindly.
- If an expected canonical line is only partly supported in this chunk, emit only the shortest audibly supported fragment instead of a polished full-line rewrite.
- Do not promote a weak hook/vibe match into a canonical lyric line just because the likely song identity is known.
- recognizedSong is optional. Use it only when the heard sung/chant/rap evidence supports a plausible famous-song hypothesis.
- Prefer recognizedSong.status = unknown, possible, or multiple_possible over inventing certainty.
- Every recognizedSong candidate must cite audio-grounded evidence; literal matchedLyrics are stronger than vibe-only guesses.
- Spoken dialogue, narration, radio chatter, or promo VO over music are never lyric evidence. If overlap weakens confidence, mention that in recognitionNotes.
- If no text-bearing music-led vocals are present in this chunk, return vocal_segments as [] and say so in vocalSummary.
- JSON only. No markdown, no explanation.
```

---

## Narrow follow-up targets after review

If Derrick approves this direction, the narrow application targets are:

- `server/scripts/get-context/get-music-vocals.cjs`
- `test/scripts/get-music-vocals.test.js`

No runtime readers or broader downstream consumers are changed by this draft doc.
