# Video prompt draft for global index-only lane context review

**Date:** 2026-04-08  
**Status:** Review only — do not apply to runtime yet  
**Primary review targets:**
- `server/scripts/process/whole-video-mimo.cjs`
- `../tools/emotion-lenses-tool.cjs`
- `server/scripts/process/video-chunks.cjs` (context handoff / naming only)

## Why this draft exists

Dialogue and music-vocals have already moved to truthful index-first chronology, and the next prompt layer needs to stop pretending those lane entries can be localized to the current chunk by overlap timing. The current phase-2 video prompts still read like the dialogue/music/music-vocals lists are chunk-window-matched evidence. That was acceptable when the system behaved as if those lanes owned trustworthy timing, but it is now misleading.

This draft keeps the prompt structure close to the current whole-video and chunked-video prompts so it can be applied narrowly later. The main change is conceptual, not architectural:

- lane datasets should be described as **full ordered global context**
- the attached video/chunk remains the **only authoritative evidence** for what is visually/audibly present in the current analysis window
- when both raw and reconciled lane artifacts exist, the prompt should say to **prefer reconciled artifacts** as the support layer

## Concise summary of proposed prompt changes

1. Keep the current whole-video and chunked-video prompt shapes.
2. Change the lane-context framing from implied local evidence to **global support context only**.
3. Explicitly say the runtime should **prefer reconciled lane artifacts when available**.
4. Keep the attached video/chunk as the final authority whenever there is tension between prior structured context and observed media.

---

## Proposed whole-video prompt wording

### 1) Replace the current opening guidance paragraph with this narrower revision

Current shape is good; this is the minimal wording shift:

```text
Analyze the attached FULL video as a single multimodal experience for persona-based ad evaluation. Ground your judgment in what the full video actually shows and sounds like.

Use the Phase 1 lane artifacts below as optional supporting context only. Prefer reconciled lane artifacts when they are available. Dialogue, music, and music-vocals entries are provided as full ordered lane datasets for global context.
```

### 2) Add a single preface before the lane sections

This keeps the existing section layout but corrects the contract once, centrally:

```text
# GLOBAL PHASE 1 CONTEXT

The following dialogue, music, music-vocals, and visual-identity sections are support layers from earlier phases.
- Prefer reconciled artifacts when available.
- Treat dialogue, music, and music-vocals as full ordered lane context for the asset.
- Use them to understand narrative, musical, and lyrical continuity across the full video.
- If the attached video conflicts with prior structured context, trust the video.
- Do not claim a specific line, lyric, or music cue occurred at a precise moment unless that moment is supportable from the attached video itself.
```

### 3) Replace the whole-video lane section introductions with these variants

These stay very close to the current section names.

#### Whole-video dialogue section intro

```text
# DIALOGUE CONTEXT

Only use reconciled dialogue artifacts when available. This is a global ordered dialogue support layer for the full asset. Use it to understand spoken narrative continuity, speaker recurrence, and notable lines across the video, but ground any cited evidence moment in the attached video/audio itself.
```

#### Whole-video music section intro

```text
# MUSIC CONTEXT

Prefer reconciled or final music artifacts when available. This is a global support layer describing the score/cue arc across the full asset. Treat any listed timing as non-authoritative support metadata unless the attached video itself clearly confirms the cue timing.
```

#### Whole-video music-vocals section intro

```text
# MUSIC VOCALS CONTEXT

Prefer reconciled music-vocals artifacts when available. This is a global ordered lyrics/vocal support layer for the full asset. Use it to understand lyric-bearing continuity and repeated hooks across the video.
```

---

## Proposed chunked-video prompt wording

This is the more important revision, because the current chunk path still implies chunk-local lane selection.

### 1) Replace the current chunk grounding instruction block with this revision

Applicable to the chunk prompt built through `../tools/emotion-lenses-tool.cjs`.

```text
Ground your judgment in the attached video chunk first.

Use previous summary only for continuity. Use dialogue, music, and music-vocals context as global support layers from earlier phases.

Important: these lane entries are provided as full ordered asset-level context only. They are not authoritative proof that a specific dialogue line, music cue, or lyric belongs inside this chunk just because it appears near this point in the list or carries legacy timing metadata. The attached chunk is the only authoritative evidence for what is present in this chunk.

If the chunk clearly supports a line/cue/lyric, you may use the lane context to sharpen interpretation. If the chunk does not support it, do not cite it as chunk evidence.
```

### 2) Replace the chunk context section labels/intros with these versions

#### Chunk dialogue context intro

```text
## Global Dialogue Context (ordered support only)
This dialogue context comes from the full asset. It is provided to preserve narrative continuity and speaker awareness.
```

#### Chunk music context intro

```text
## Global Music Context (support only)
This music context summarizes the broader score/cue arc for the full asset.
```

#### Chunk music-vocals context intro

This is not currently surfaced in the chunk prompt, but this is the wording needed for the new design once added.

```text
## Global Music-Vocals Context (ordered support only)
This music-vocals context comes from the full asset. It is a global ordered support layer for lyric-bearing vocal continuity and repeated hooks.
```

### 3) Replace the chunk-specific bullet that currently implies active local cues

Where the current prompt says things like `Active chunk cues`, shift to this:

```text
- Relevant global support entries:
```

That change is intentionally small but important. It stops the prompt from asserting that the runtime already knows which entries belong inside the chunk.

### 4) Add one explicit chunk anti-leak rule

```text
- Do not import dialogue, lyric, or music details from global support context into this chunk unless the attached chunk itself provides enough evidence for them.
```

---

## Proposed exact wording snippets for narrow drop-in application

If Derrick wants a very small patch later, these are the most surgical text swaps.

### Whole-video: minimal drop-in replacement for the existing opening support sentence

```text
Use dialogue, music, and music-vocals context as optional support only, treat those lane datasets as full ordered global context. Prefer the attached video whenever there is tension between prior structured context and the observed asset.
```

### Chunked-video: minimal drop-in replacement for the current chunk grounding sentence

```text
Ground your judgment in the attached video chunk first, then use dialogue, music, and music-vocals as global support context from earlier phases. Do not treat those lane entries as proof that they belong to this chunk unless the chunk itself supports them.
```

### Chunked-video: minimal drop-in replacement for `Active chunk cues`

```text
- Global support cues:
```

---

## Narrow follow-up targets after review

If Derrick approves this direction, the likely narrow implementation targets are:

- `server/scripts/process/whole-video-mimo.cjs`
  - update whole-video support-layer wording only
- `../tools/emotion-lenses-tool.cjs`
  - update chunk prompt context wording
  - rename `Active chunk cues` language
  - add explicit global-support/non-local-evidence rule
- `server/scripts/process/video-chunks.cjs`
  - stop naming overlap-filtered lane inputs as if they are authoritative chunk-local matches
  - eventually pass full global lane datasets instead of time-overlap-selected subsets
- focused tests:
  - `test/scripts/emotion-lenses-tool.test.js`
  - `test/scripts/video-chunks.test.js`
  - any whole-video prompt assertions if present

## Reviewer note

This draft intentionally does **not** apply live prompt changes yet. It is a wording pass for Derrick review, designed to stay close to the current prompt structure so the eventual runtime patch can be narrow.
