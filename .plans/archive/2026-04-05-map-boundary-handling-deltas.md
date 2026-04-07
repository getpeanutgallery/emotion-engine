# emotion-engine: map boundary-handling deltas for dialogue and music-vocals lanes

**Date:** 2026-04-05  
**Status:** Complete  
**Agent:** Cookie 🍪

---

## Goal

Produce a precise before/after map for how `get-dialogue.cjs`, `get-music.cjs`, and `get-music-vocals.cjs` should change next so spoken dialogue, sung vocals, and overlap cases are routed more truthfully and with better timeline coverage.

---

## Overview

The last tranche improved benchmark fairness and added famous-song grounding, but the rerun showed that the main blocker is now lane separation and coverage rather than song identification. Dialogue still absorbs sung material, spoken lines under score still get missed, and music-vocals still under-covers the full lyric timeline. Before we implement another tranche, we should pin an explicit behavioral diff for each relevant script and prompt so the next coder lane has a narrow, testable target.

This plan is design-first, not implementation-first. It should document what each lane is doing now, what it should do instead, which prompt rules need to change, and which validation/artifact behaviors should stay the same. The output should be specific enough that the next implementation task can directly follow it without another round of ambiguity.

---

## Tasks

### Task 1: Produce a before/after delta map for dialogue, music, and music-vocals lane behavior

**Bead ID:** `ee-g957`  
**SubAgent:** `research`  
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, design a precise before/after map for the next boundary-handling tranche across get-dialogue.cjs, get-music.cjs, and get-music-vocals.cjs. Focus on: preventing sung lyrics from leaking into dialogue, preserving spoken lines under score/SFX, improving music-vocals coverage across the full trailer timeline, and clarifying overlap handling between spoken dialogue and music-led vocals. Update this plan with exact per-script/prompt deltas, recommended validation changes, and any minimal schema/artifact implications. Do not change code. Close bead ee-g957 when done.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `server/scripts/get-context/`
- `server/lib/`
- `test/`

**Files Created/Deleted/Modified:**
- `.plans/2026-04-05-map-boundary-handling-deltas.md`

**Status:** ✅ Complete

**Results:** Mapped the next narrow boundary-handling tranche from current prompt/validator/test behavior. Recommendation is to tighten lane rules and validator expectations without introducing a large schema change: dialogue should become stricter about spoken-only extraction while explicitly preserving spoken lines under score/SFX; music should stay coarse/non-lexical and provide context for overlap decisions; music-vocals should switch from permissive chunk-by-chunk lyric pickup to explicit full-timeline lyric coverage with spoken-vs-sung arbitration rules. See implementation map below.

---

## Implementation-ready delta map

### 1) `server/scripts/get-context/get-dialogue.cjs`

#### Current behavior
- The whole-asset and chunk prompts already say this is a spoken-dialogue extraction task.
- The prompts already exclude sung lyrics / chant / rap / melodic refrains and say spoken narration or dialogue over score still belongs in `dialogue_segments`.
- The prompts already tell the model to split adjacent spoken-vs-music-led delivery instead of merging them.
- In practice, this still leaves ambiguity at boundaries where delivery is half-spoken / half-sung or when score/SFX are dominant, so lyric material can still leak into dialogue and some quiet spoken lines under music get dropped.
- Current output shape has no explicit overlap classification; the lane relies almost entirely on prompt wording.

#### Next behavior
- Keep `dialogue_segments` strictly for **lexically spoken** words, including VO/narration/comms over score or SFX.
- Add an explicit decision rule: if the same phrase is delivered melodically enough that a listener would treat it as lyric-led rather than speech-led, it belongs in music-vocals, not dialogue.
- Add a counter-rule: if a line is plainly spoken but masked by score/SFX, keep it in dialogue with best-effort literal text or a short audible fragment; do not drop it just because music is louder.
- Treat mixed transitions as **two adjacent spans** whenever there is a discernible change in delivery mode: spoken fragment stays in dialogue; sung/chant/rap fragment moves to music-vocals.
- Treat uncertain overlap conservatively: dialogue may keep only the clearly spoken sub-span, never the whole mixed stretch.

#### Prompt-rule changes
Whole-asset and chunk prompts should add or tighten these rules:
- “When a voice rides over music, classify by delivery mode, not by foreground loudness.”
- “Keep quiet or partially masked spoken words in `dialogue_segments` if they are still intelligible enough to transcribe at least partially.”
- “If a phrase begins spoken and resolves into sung/chant/rap delivery, split at the delivery pivot; do not keep the sung tail in dialogue.”
- “If the audible words are too melodic/rhythm-locked to be confidently treated as speech, exclude them from `dialogue_segments` and let the music-vocals lane claim them.”
- “Use short best-effort literal fragments for masked speech rather than discarding the spoken line entirely.”
- “Do not use continuity from neighboring spoken segments to ‘pull’ a lyric phrase into dialogue.”

#### Recommended implementation shape
- Keep schema unchanged.
- Limit this tranche to prompt/tool-loop rule changes plus targeted post-processing only if needed for obvious lane-boundary cleanup.
- Do **not** broaden dialogue to carry overlap metadata yet; let the artifact remain simple.

---

### 2) `server/scripts/get-context/get-music.cjs`

#### Current behavior
- Music stays coarse and timeline-aware, with chunk or whole-asset analysis.
- It can emit `analysis.type = speech` for a chunk and already warns that spoken dialogue over score is not lyric evidence for `recognizedSong`.
- The lane does not explicitly act as the arbitration layer between spoken-under-score vs music-led vocals; it mostly describes whichever audio type dominates the chunk.
- Because the chunk response is single-analysis-per-window, mixed chunks can underspecify “music with spoken dialogue over it” vs “music with lyric-bearing vocals.”

#### Next behavior
- Keep this lane non-lexical and coarse; it should **not** absorb lyric transcription or spoken transcription work.
- Make it explicitly annotate chunk character in a way that helps the other two lanes: instrumental/underscore, music-with-spoken-overlay, music-with-vocal-hook, or non-music-dominant audio.
- When spoken dialogue sits over score, the music lane should still describe the score and chunk mood/intensity, but must not imply that speech means lyric evidence.
- When music-led vocals are present, the music lane should flag that a lyric-bearing cue exists, while still leaving actual words and boundaries to `get-music-vocals.cjs`.

#### Prompt-rule changes
Whole-asset and chunk prompts should add or tighten these rules:
- “For mixed chunks, describe the score bed even when speech is present; do not let `analysis.type = speech` erase meaningful underlying music.”
- “Differentiate spoken-over-score from music-led vocals in the description/summary, but do not transcribe either.”
- “If lyrics or chant are audible, note that the music lane contains text-bearing vocals and leave exact words to the music-vocals lane.”
- “Do not let spoken overlay suppress a `music` classification when score remains the dominant bed of the chunk.”
- “Reserve `speech` for chunks where spoken audio, not score, is the primary audible driver.”

#### Recommended implementation shape
- Keep the artifact schema unchanged.
- Narrow scope to prompt wording and maybe description conventions, not new fields.
- Use this lane as continuity/context support for music-vocals rather than as an additional transcript lane.

---

### 3) `server/scripts/get-context/get-music-vocals.cjs`

#### Current behavior
- Whole-asset and chunk prompts already restrict `vocal_segments` to text-bearing music-led vocals and exclude spoken narration/dialogue over score.
- Hybrid mode already seeds chunk refinement with whole-asset context.
- Chunk mode accumulates `collectedVocalSegments` across windows and normalizes them, but the prompt is still permissive enough that coverage can be spotty across the full trailer and overlap cases can be inconsistently claimed.
- The current rules say to break on lyric changes/refrain gaps, but not strongly enough to force exhaustive full-timeline pickup of recurring hooks and late re-entries.
- The current `delivery` enum includes `hybrid`, but the prompts do not crisply define when `hybrid` is allowed vs when spoken and sung spans must be split.

#### Next behavior
- Make this lane the sole owner of **text-bearing music-led vocals** across the entire trailer timeline.
- In hybrid/chunked analysis, use the whole-asset pass as a recall scaffold: every chunk should try to confirm, refine, or reject expected lyric-bearing moments from the full-asset continuity view rather than starting from zero.
- Strengthen coverage expectations: repeated hooks, late reprises, and short lyric re-entries should each become distinct `vocal_segments` at their true timeline locations.
- Tighten overlap handling: `delivery = hybrid` should be reserved for genuinely inseparable mixed delivery inside one continuous phrase, not for ordinary spoken-then-sung adjacency.
- If a chunk contains spoken dialogue over score and separately a sung hook, only the sung hook belongs here.
- If overlap or masking weakens confidence, still emit the lyric segment when lexical content is audible, then record caution in `qualityNotes` / `recognitionNotes` instead of dropping the segment.

#### Prompt-rule changes
Whole-asset and chunk prompts should add or tighten these rules:
- “Aim for full-trailer lyric coverage, not just representative examples.”
- “Capture each distinct lyric-bearing entry, reprise, or short return at the point it occurs on the global timeline.”
- “Do not skip a lyric segment merely because the phrase already appeared earlier; repeated hooks later in the trailer still need their own `vocal_segments`.”
- “Use `hybrid` only when the same continuous utterance is truly inseparable as both speech-led and music-led; otherwise split adjacent spoken and sung spans and keep only the sung side here.”
- “If speech and song overlap, keep only the clearly music-led lexical content in `vocal_segments`; spoken overlay remains outside this lane.”
- “When masking reduces certainty, prefer a shorter, lower-confidence literal fragment plus a `qualityNotes` caution over omitting the segment.”
- “Use the whole-asset context as a checklist for chunk refinement so late and brief lyric windows are revisited, not forgotten.”

#### Recommended implementation shape
- Preserve current artifact shape: `vocal_segments`, `summary`, `hasVocals`, `recognizedSong`, `recognitionNotes`, `qualityNotes`, provenance.
- No required new top-level fields for this tranche.
- If a tiny artifact tweak is desired, keep it optional and additive only (for example, a note convention in `qualityNotes` like `overlap: spoken_under_score`), but this is not required to ship the boundary-handling tranche.

---

## Cross-lane arbitration rules for the tranche

These should be treated as the shared contract across all three scripts:
- **Spoken words over score/SFX** → dialogue lane.
- **Sung / chanted / rapped / melodic-refrain words** → music-vocals lane.
- **Underlying score description / mood / energy / cue recognition** → music lane.
- **Ordinary adjacency** (spoken line followed by sung line, or sung line followed by spoken line) → split into separate lane-local spans; do not use `hybrid`.
- **True inseparable mixed utterance** where the same phrase cannot be cleanly decomposed into spoken and sung sub-spans → allow `hybrid` in music-vocals, but dialogue should still avoid claiming the same phrase wholesale.
- **Masked but intelligible spoken line** → keep in dialogue.
- **Masked but intelligible sung lyric** → keep in music-vocals.
- **Masked and unintelligible content** → do not invent text in either transcript lane; music may still describe the bed non-lexically.

---

## Recommended validation and test changes

### Prompt expectation tests
Update/add prompt assertions in:
- `test/scripts/get-dialogue.test.js`
- `test/scripts/get-music.test.js`
- `test/scripts/get-music-vocals.test.js`

Add explicit assertions for the new wording around:
- delivery-mode classification over foreground loudness
- preserving masked spoken lines in dialogue
- repeated lyric-hook coverage across the full timeline in music-vocals
- `hybrid` being reserved for inseparable mixed delivery
- music lane describing score even when spoken overlay exists

### Validator/tool-contract tests
Update/add tests in:
- `test/lib/phase1-validator-tools.test.js`
- `test/lib/local-validator-tool-loop.test.js`

Focus on:
- dialogue tool description continuing to say “spoken words only,” but now explicitly preserving spoken-under-score cases
- music tool description explicitly distinguishing spoken-over-score from lyric evidence
- music-vocals tool description explicitly requiring exhaustive lyric-bearing segment coverage and narrow `hybrid` use

### Script-level behavior tests
Add narrow synthetic cases in:
- `test/scripts/get-dialogue.test.js`
- `test/scripts/get-music.test.js`
- `test/scripts/get-music-vocals.test.js`

Recommended new fixtures/assertions:
1. **Spoken-under-score case**
   - Input chunk contains clear spoken line over loud underscore.
   - Expected: dialogue keeps the line; music still reports score; music-vocals stays empty.
2. **Spoken then sung pivot**
   - One phrase starts spoken and pivots into melodic hook.
   - Expected: dialogue keeps only spoken sub-span; music-vocals keeps only sung sub-span; no single dialogue segment spans both.
3. **Repeated hook reprise**
   - Same lyric appears in multiple separated trailer windows.
   - Expected: music-vocals emits multiple timeline-distinct `vocal_segments`, not just the first occurrence.
4. **Speech over score without lyrics**
   - Chunk has score + promo VO only.
   - Expected: music description reflects score bed; recognizedSong stays ungrounded; music-vocals empty.
5. **True inseparable mixed-delivery phrase**
   - Only if we want to keep `hybrid` active.
   - Expected: music-vocals may emit `delivery: hybrid`; dialogue does not duplicate the same full phrase.

### Benchmark/truth coverage
Recommended follow-up test work once implementation lands:
- Extend `test/lib/benchmark-runner.test.js` fixture coverage so dialogue truth and music-vocals truth explicitly diverge on shared-score moments.
- Add benchmark examples where later lyric reprises must remain scoreable instead of being silently lost.
- Keep benchmark profile separation as-is; the change needed here is better truth fixtures for overlap and reprise cases, not a new benchmark profile.

---

## Minimal schema / artifact implications

### Keep unchanged for this tranche
- `dialogue-data.json` shape
- `music-data.json` shape
- `music-vocals-data.json` shape
- validator core schemas in `server/lib/structured-output.cjs`
- persisted artifact paths and script contract wiring

### Optional additive-only ideas (not required)
- Standardize overlap cautions in `qualityNotes` / `recognitionNotes` instead of adding new typed fields.
- If later benchmarking needs more explicit machine-readable overlap state, add it in a separate tranche; do not bundle that into this boundary-fix implementation.

### Scope guard
- No new artifact families.
- No benchmark profile reshuffle.
- No transcript-lane duplication of the same lexical content by default.
- No large post-processing reconciliation layer unless prompt tightening alone proves insufficient.

---

## Final Results

**Status:** ✅ Complete

**What We Built:** A narrow, implementation-ready boundary-handling map for `get-dialogue.cjs`, `get-music.cjs`, and `get-music-vocals.cjs`, including exact current-vs-next behavior, prompt-rule deltas, test recommendations, and a scope guard that keeps schema/artifact changes minimal.

**Commits:**
- None. Per request, no commit/push performed.

**Lessons Learned:** The current stack is already close on schema and broad prompt intent; the next gains should come from sharper lane-arbitration wording, stronger reprise/coverage expectations in music-vocals, and tests that force spoken-under-score and spoken-to-sung pivot cases.

---

*Completed on 2026-04-05*
