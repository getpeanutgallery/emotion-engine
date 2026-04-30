# Whisper Timestamp Feasibility for Phase 1 Derivation

**Date:** 2026-04-30  
**Status:** Research complete  
**Scope:** Bounded feasibility spike for `get-dialogue-timestamps` and `get-music-vocals-timestamps`

---

## Executive summary

### Bottom line

- **Dialogue:** feasible, but **not with anything already wired into this repo as a true Whisper/Whisper-compatible aligner**. The repo already has **ephemeral model-produced segment timestamps** during Phase 1 extraction, but those are intentionally stripped before persistence and are **not a safe substitute** for the new derivation contract because the new contract must preserve the selected source artifact text verbatim and may target the **reconciled** surface.
- **Music-vocals:** only **partially feasible**. Exact per-segment timing on sung / chant / rap material is much weaker and should not be promised as dialogue-grade. The honest contract is to allow **`aligned` / `partial` / `unresolved`** outcomes, with music-vocals expected to produce substantially more `partial` and `unresolved` segments.
- **Current repo/toolchain evidence:** there is **no local Whisper CLI, no `whisperx`, no `faster_whisper`, no Python `whisper`, and no Torch** available in the repo environment I checked. `ai-providers` also does **not** expose a transcription/timestamp API; it wraps chat-style multimodal completion providers.

### Recommended implementation posture

1. **Implement dialogue timestamps first.**
2. Treat dialogue timestamp derivation as a **new alignment pass** over source audio plus the selected Phase 1 transcript artifact.
3. **Do not** implement music-vocals as “same thing but lyrics.” Instead, ship it behind an explicitly weaker truth posture:
   - `aligned` only when evidence is strong
   - `partial` when placement window is plausible but exact boundaries are weak
   - `unresolved` when repeated hook / masking / delivery style makes exact placement guessy
4. If Derrick wants actual Whisper-backed derivation, the project will need a **new dependency or external alignment entrypoint**.

---

## Local repo/tooling evidence

## 1) Existing Phase 1 lanes already produce timing internally, then strip it

### Dialogue

`server/scripts/get-context/get-dialogue.cjs` still works with timed segments internally:

- it supports `timingMode: 'full_timeline'` for whole-asset output
- it supports `timingMode: 'chunk_local'` for chunked/hybrid output
- it validates and processes segment timing during extraction
- then it calls `stripDialogueSegmentTiming()` before persisting the canonical artifact

Evidence:

- `buildDialogueAnalysisMetadata()` sets timing metadata
- `stripDialogueSegmentTiming()` removes `start` / `end` from persisted `dialogue_segments`
- final write path is `phase1-gather-context/dialogue-data.json`

That means the repo already acknowledges timing as useful, but the **current persisted contract is intentionally untimed**.

### Music-vocals

`server/scripts/get-context/get-music-vocals.cjs` does the same pattern:

- provider/tool-loop outputs include `start` / `end`
- normalization validates timing against asset duration
- whole-asset scaffolding uses timed lyric-bearing windows
- final artifact is passed through `stripMusicVocalSegmentTiming()` before persistence

Evidence:

- `normalizeMusicVocalSegments(...)` validates `start` / `end`
- whole-asset checklist formatting references timed lyric-bearing moments
- final write path strips timing before saving `music-vocals-data.json`

### Tests confirm the strip is intentional

- `test/scripts/get-music-vocals.test.js` explicitly asserts that persisted `vocal_segments[0]` **does not** have `start` or `end`
- the active plan/contract doc also states that dialogue/music-vocals artifacts are intentionally text/index-first

## 2) Reconciled-vs-raw source selection already exists and matters

The timestamp derivation lane cannot just reuse whatever timing a producer happened to emit during extraction, because the new contract resolves source text from the selected Phase 1 artifact surface:

- raw when only raw exists
- reconciled when famous-song reconciliation is configured and the lane supports reconciled input

Evidence:

- `server/lib/phase1-baseline-resolution.cjs`
- `server/lib/persisted-artifacts.cjs`
- `server/scripts/get-context/reconcile-famous-song-phase1.cjs`

This matters because the new contract requires the timed output to preserve the **selected source text verbatim**. If reconciliation removed or retained segments differently than the original extraction timing surface, any old producer timing becomes advisory at best.

## 3) No Whisper/WhisperX/faster-whisper entrypoint is currently present

I checked the repo environment and local Python/module surface.

Observed:

- `command -v whisper` → not found
- `command -v whisperx` → not found
- Python import availability:
  - `whisper` → false
  - `faster_whisper` → false
  - `whisperx` → false
  - `torch` → false

I also searched repo code and `node_modules/ai-providers`.

Observed:

- no repo-local Whisper wrapper
- no `whisperx` references
- no `faster_whisper` references
- no `word_timestamps` or transcription endpoint wrappers in `ai-providers`

## 4) `ai-providers` is chat/multimodal-completion oriented, not transcription-timestamp oriented

`node_modules/ai-providers` exposes providers such as OpenAI, OpenRouter, Gemini, Anthropic.

Important repo-local evidence:

- `providers/openai.cjs` explicitly throws for audio attachments in chat completions
- `providers/openrouter.cjs` can pass `input_audio` into a chat-style request, but there is no transcription-specific contract, no word timestamp surface, and no alignment API wrapper

So while the repo can send audio to some multimodal models, that is **not the same thing** as already having a Whisper-grade word/segment alignment engine.

---

## What this means for dialogue feasibility

## Can existing repo surfaces truthfully support dialogue timestamp derivation?

### Yes, with a new alignment engine

The dialogue lane is feasible because the current dialogue artifact is already:

- ordered by `index`
- literal enough to align back to spoken audio
- bounded to spoken language rather than lyrics
- enriched with speaker metadata that can be carried through unchanged

A transcript-preserving alignment pass can reasonably take:

- source audio
- selected dialogue artifact (`dialogueData` or `dialogueDataReconciled`)
- ASR/alignment output with word/segment timing

and emit timed dialogue segments that preserve the chosen text verbatim.

### No, not from today’s already-installed toolchain alone

The repo currently does **not** already expose:

- Whisper CLI
- WhisperX forced alignment
- faster-whisper word timestamps
- any equivalent local word-timestamp aligner

The current producer-side model timestamps are not enough for the new contract because:

1. they are **not persisted** in the canonical artifact
2. chunked dialogue uses `chunk_local` timing and later stitching logic
3. famous-song reconciliation can change the selected input surface
4. the new contract forbids rewriting source text to make timing easier

So the honest statement is:

> The repo proves that timestamp-shaped data is useful and already flows through extraction-time internals, but it does **not** currently contain a truthful, reusable Whisper-class derivation engine for the new contract.

## Recommended dialogue posture

### Recommended shipping posture

Implement `get-dialogue-timestamps.cjs` **only after adding or selecting an explicit aligner**.

Preferred behavior:

1. Resolve canonical source artifact surface first.
2. Run full-timeline ASR/alignment on the source audio.
3. Align selected dialogue segment text to that ASR/word lattice.
4. Preserve source text verbatim in output.
5. Emit:
   - `aligned` when boundaries are strongly anchored
   - `partial` when placement is plausible but exact boundaries are soft
   - `unresolved` when the source segment cannot be placed honestly

### Best engine posture

For dialogue, the project should prefer a **Whisper-compatible aligner with word or sub-segment timing**, not another prompt-only multimodal completion pass.

Why:

- spoken dialogue is where Whisper-style ASR is strongest
- word/segment timing is what the contract actually needs
- prompt-only models can transcribe and approximate timestamps, but they do not provide a stable alignment surface equivalent to a dedicated ASR aligner

### Boundaries to keep

Do **not**:

- mutate dialogue text to fit ASR output
- silently fall back from reconciled text to raw text in canonical mode
- pretend chunk-local producer timestamps are authoritative full-timeline derivation output

---

## What this means for music-vocals feasibility

## Music-vocals is materially weaker than dialogue

Local repo evidence already points in this direction.

The music-vocals lane is built around several cautions:

- keep only clearly music-led lexical content
- preserve short literal fragments over polished lyric rewrites
- do not promote a likely song ID into canonical lyric text
- repeated hook/refrain material is common
- recognized-song metadata is support metadata only

Those cautions exist because the lane already knows that lyric material is easier to over-claim than ordinary dialogue.

## Likely failure modes for sung / chant / rap timing

### 1) Repeated hooks and refrains

Example in repo data:

- `output/cod-test/phase1-gather-context/music-vocals-data.json`
- repeated lines such as `Master! Master! Master! Master!` and `Master, master`

Failure mode:

- the same or nearly identical text may occur multiple times
- short repeated phrases are poor anchors
- an aligner may place the segment on the wrong repetition window while still looking superficially plausible

### 2) Text compression versus actual sung duration

Current music-vocals artifacts often preserve concise canonical fragments.

Failure mode:

- a short persisted text like `Master, master` may correspond to a longer melismatic or repeated sung phrase
- segment text is truthful as text, but not rich enough to disambiguate exact boundaries

### 3) Melodic stretching / chant timing drift

Sung syllables are not paced like speech.

Failure mode:

- onset may be clear but release/end may be fuzzy
- word timing can drift because vowels are extended, consonants are swallowed, or words smear across beats

### 4) Aggressive delivery styles

Repo evidence includes metal/industrial-style material in the COD sample.

Failure mode:

- screamed, distorted, growled, or crowd-led delivery reduces phonetic clarity
- ASR may recover phrase identity but still miss exact boundaries

### 5) Music/sfx/dialogue overlap

The lane explicitly distinguishes lyrics from spoken overlay and narration.

Failure mode:

- the audio may support text identity only weakly because score, crowd, FX, or spoken VO competes with vocals
- exact segment start/end becomes guessy even if a human can tell “the hook happens around here”

### 6) Recognized-song prior can over-bias placement

`recognizedSong` is useful as identity scaffolding.

Failure mode:

- once the system “knows” the song, it may over-fit canonical lyrics onto ambiguous audio windows
- exact timing then becomes falsely confident

### 7) Reconciled/raw artifact mismatch versus original extraction-time timing

If the selected source artifact differs from the initial extracted phrasing or grouping, old timing is no longer trustworthy without re-alignment.

---

## Recommended music-vocals posture

### Recommended shipping posture

Implement `get-music-vocals-timestamps.cjs` only with an explicitly weaker contract than dialogue.

Good posture:

- allow full artifact success even when many segments are `partial` or `unresolved`
- require strong evidence before labeling a vocal segment `aligned`
- preserve `recognizedSong` and `recognitionNotes`, but never let them rewrite or “snap” timing onto guessed lyrics

### Honest segment-status policy

Use this practical interpretation of the contract:

#### `aligned`
Use only when:

- the segment text has a strong anchor in alignment output
- the phrase is not ambiguous across repeated windows
- boundaries are reasonably isolated from overlap/masking

#### `partial`
Use when:

- the lyric-bearing moment is real
- approximate placement window is known
- exact onset/end or repetition identity is uncertain

This is the **expected common case** for chant/hook-heavy material.

#### `unresolved`
Use when:

- the source text is too short or too repeated to place safely
- overlap or delivery style makes exact timing mostly guesswork
- the system would need to rewrite / expand / infer missing words to align it

### Recommended fallback semantics for music-vocals

If exact word/segment timing is weak, the lane should still be allowed to persist the source segment with:

- no `start` / `end` when truly unresolved
- or approximate `start` / `end` plus `timing.status: 'partial'`
- plus explicit quality notes about repeated-hook ambiguity, masking, or sung-timing instability

That is much more truthful than inventing dialogue-grade precision.

---

## Best fixture/sample assets for validation

## 1) Primary mixed-lane validation asset: COD sample

Best immediately-available repo asset:

- `examples/videos/emotion-tests/cod.mp4`

Why it is the best primary fixture:

- rich spoken dialogue coverage
- multiple speakers / narration / radio-style delivery
- famous-song contamination case already present
- clear music-vocals lane with repeated `Master of Puppets` phrases
- existing archived outputs already exist for comparison

Useful paired outputs:

- `output/cod-test/phase1-gather-context/dialogue-data.json`
- `output/cod-test/phase1-gather-context/dialogue-data.reconciled.json`
- `output/cod-test/phase1-gather-context/music-vocals-data.json`
- `output/cod-test/phase1-gather-context/music-vocals-data.reconciled.json`
- `output/cod-test/phase1-gather-context/famous-song-reconciliation.json`

This single asset is strong because it exercises **both**:

- dialogue timing on real spoken material
- music-vocals timing on repeated, chant-like, famous-song material

## 2) Optimized / archived COD variants

Also useful:

- `examples/videos/emotion-tests/cod-720p-h264-mp3-optimized.mp4`
- archived output families under `output/_archives/cod-test-*`

Especially helpful archived runs:

- `output/_archives/cod-test-high-fidelity-flac/...`
- `output/_archives/cod-test-optimized-mp4-source/...`

Why:

- lets QA compare timing behavior across source encodes
- useful if alignment quality changes materially with cleaner audio extraction

## 3) Dialogue-focused validation slice

Useful current short asset/run surface:

- `output/cod-test-english-slice/assets/input/cod.mp4`

This looks like the best existing repo-local hint of a shorter bounded slice for dialogue-only evaluation, though I did **not** find a dedicated audio-only timestamp fixture family yet.

## 4) What is missing today

I did **not** find a purpose-built timing-validation fixture set containing:

- short dialogue-only WAV/FLAC with hand-checked timestamps
- short sung/chant/rap lyric clips with hand-checked timestamps
- gold word-level alignment truth

So the repo has good **real-world regression assets**, but not yet a clean **timestamp gold fixture pack**.

If implementation starts, I recommend creating later:

- one short spoken-dialogue gold clip
- one repeated-chant gold clip
- one overlap-heavy mixed clip

But that creation should be a follow-on task, not part of this bounded spike.

---

## Repo/tooling evidence about currently available entrypoints/dependencies

## Present today

- Phase 1 producer internals can handle timed segments before strip
- multimodal provider wrappers can send audio to some chat-style providers
- existing output and archive surfaces provide realistic validation assets

## Not present today

- Whisper CLI
- Whisper Python package
- faster-whisper
- WhisperX
- Torch
- any repo-local transcription API wrapper that exposes word timestamps / alignment lattices

## Important implication

If the team says “use Whisper,” that means **new implementation work is required**:

- add a dependency
- or add an external service/CLI integration
- or explicitly choose a non-Whisper aligner and document the deviation

There is no current in-repo switch to flip.

---

## Recommended implementation sequence

1. **Ship dialogue timestamps first.**
   - stronger feasibility
   - lower truth risk
   - better fit for Whisper-style alignment

2. **Require an explicit aligner decision before coding.**
   - local dependency/service choice is still open
   - current repo does not already provide one

3. **For music-vocals, implement only the partial-truth contract.**
   - `aligned` / `partial` / `unresolved`
   - expect more degraded outcomes than dialogue

4. **Use COD as first QA asset.**
   - especially because it already demonstrates the exact failure class: spoken dialogue plus famous-song vocals plus repetition

---

## Decision points for the orchestrator

1. **Dependency decision:** choose whether the implementation may add a Whisper-compatible aligner dependency/service. Without that, dialogue timestamps will likely regress to another prompt-only approximation path.
2. **Music-vocals policy decision:** confirm that `partial` / `unresolved` outcomes are acceptable and preferred over fake exactness.
3. **Validation decision:** approve COD as the first regression asset, with later follow-up work for dedicated gold timestamp fixtures if needed.

---

## Final recommendation

- **Dialogue:** proceed, but only as a genuine alignment lane with a newly introduced Whisper-compatible or equivalent engine.
- **Music-vocals:** proceed only with an explicitly conservative contract. Do not promise exact lyric timing parity with dialogue.
- **Current repo/toolchain:** good architectural fit, good validation assets, **no existing Whisper entrypoint**.
