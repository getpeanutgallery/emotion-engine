# Gemini speaker-continuity guidance audit (dialogue prompt)

Date: 2026-04-10  
Plan: `.plans/2026-04-10-gemini-speaker-continuity-hardening.md` Task 1 (`ee-nx7w`)

## Scope reviewed

- Runtime prompt source: `server/scripts/get-context/get-dialogue.cjs`
  - Whole-asset prompt (`buildTranscriptionPrompt`)
  - Chunk prompt (`buildChunkTranscriptionPrompt`)
  - Structured handoff guidance (`buildStructuredSpeakerHandoff`)
  - Chunk final-artifact rules passed into `executeDialogueTranscriptionToolLoop`
- Adjacent guidance doc: `docs/dialogue-transcription-prompt-v2-3-draft-2026-04-08.md`
- Recent Gemini output shape for sanity: `output/cod-dialogue-compare-gemini-3.1-pro-preview/phase1-gather-context/dialogue-data.json`
  - 32 segments / 18 unique speaker IDs

## Findings: wording that biases toward unnecessary new speaker creation

1. **"Create new speaker" is the default tie-breaker in uncertainty.**
   - `get-dialogue.cjs` whole-asset prompt: “If those cues do not clearly line up, create a new speaker_id.”
   - `get-dialogue.cjs` chunk prompt: “If the voice sounds different ... create a new speaker_id instead of forcing continuity.”
   - Problem: this creates an asymmetric policy (high bar to reuse, low bar to split), so ambiguous moments drift toward new IDs.

2. **Handoff guidance contains multiple split-leaning category rules that can override acoustic continuity.**
   - `get-dialogue.cjs` handoff adds role/style-driven lines like:
     - “Default ... narration to a distinct speaker_id ...”
     - “... prefer a new speaker_id unless the exact same voice clearly continues.”
   - Problem: these statements encourage role-based splitting even when nearby lines may be same-voice with delivery/style shift.

3. **Continuity instruction is weak compared to split instruction strength.**
   - Chunk final artifact rule currently says: “Keep speaker labels and anonymous speaker_id values consistent with the prior handoff when possible.”
   - Problem: “when possible” is soft, while multiple other rules explicitly say to create/split. Net pressure favors fragmentation.

4. **Adjacent prompt draft repeats the same split bias, reinforcing it.**
   - `docs/dialogue-transcription-prompt-v2-3-draft-2026-04-08.md` repeats:
     - “If those cues do not clearly line up, create a new speaker_id.”
     - “Do not collapse ... unless the acoustic match is genuinely strong.”
   - Problem: nearby design guidance mirrors runtime asymmetry rather than continuity-first arbitration.

## Why this likely matches observed behavior

Recent Gemini dialogue output has high speaker cardinality relative to line count (18 IDs across 32 segments), consistent with an over-splitting bias in ambiguous boundaries.

## Recommended wording changes (targeted)

1. **Flip tie-breaker to continuity-first under uncertainty.**
   - Replace “If cues do not clearly line up, create a new speaker_id.” with:
   - **“For adjacent or near-adjacent lines, default to reusing the existing speaker_id unless there is strong positive acoustic evidence of a different voice.”**

2. **Add explicit uncertainty handling that does not mint new IDs by default.**
   - Add:
   - **“When evidence is mixed, keep the current speaker_id and lower confidence / add uncertainty descriptors; create a new speaker_id only when multiple acoustic cues conflict with the prior voice.”**

3. **Soften role/category split directives.**
   - Replace “default distinct speaker” / “prefer a new speaker_id” phrasing with:
   - **“Do not split solely due to narrative role/style labels (narration, comms, villain, promo, briefing). Split only when acoustic evidence supports a different voice.”**

4. **Strengthen chunk final-artifact continuity rule.**
   - Replace “consistent ... when possible” with:
   - **“Preserve prior speaker_id continuity by default; avoid introducing a new speaker_id unless the chunk provides clear acoustic contradiction.”**

5. **Add anti-proliferation reminder.**
   - Add one explicit guardrail:
   - **“Minimize speaker-id proliferation: do not create a new speaker_id for minor intensity/style variation of the same apparent voice.”**

## Bottom line

Current Gemini-facing dialogue guidance is internally imbalanced: continuity language exists, but several stronger instructions explicitly push new-speaker creation in uncertain conditions. Reversing that tie-breaker and softening role-based split cues should reduce unnecessary speaker fragmentation without removing acoustic-discipline safeguards.
