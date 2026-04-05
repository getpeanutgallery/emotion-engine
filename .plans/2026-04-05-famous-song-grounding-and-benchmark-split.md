# emotion-engine: split dialogue truth from sung vocals and add famous-song grounding

**Date:** 2026-04-05  
**Status:** In Progress  
**Agent:** Cookie 🍪

---

## Goal

Separate spoken-dialogue truth from sung-vocal truth in the cod-test benchmark, then improve the Phase 1 music/music-vocals prompts so the model can explicitly reason about whether it is hearing a recognizable famous song and use that as a grounding aid without overcommitting when uncertain.

---

## Overview

The latest review exposed an evaluation mismatch as well as a prompt/grounding weakness. The current benchmark truth file blends spoken dialogue and sung vocals, which makes the `dialogue-data.json` artifact appear less accurate than it really is because it is being compared against lines that properly belong to the dedicated `music-vocals` lane. That means we need a cleaner benchmark split before we can fairly judge spoken-dialogue recall.

Separately, the `music-vocals` artifact is not simply fabricating random text; it appears to be struggling to distinguish music-led vocals from spoken dialogue and to decide when a sung phrase should be interpreted as belonging to a known song. In cases like `Master of Puppets`, model pretraining may actually help if we explicitly let the model reason about whether it recognizes the song and why. But that same mechanism can also create drift when the audio is ambiguous or when multiple songs appear in one file, so any such grounding must be confidence-scored, evidence-bearing, and explicitly optional rather than assumed.

The next implementation lane should therefore tighten both truth evaluation and prompt structure. Benchmark truth should be split into spoken dialogue vs sung-vocal gold data, and the Phase 1 `music` / `music-vocals` outputs should gain explicit fields for possible famous-song recognition, confidence, and evidence. The prompts should instruct the model to use song recognition as a grounding hint when strongly supported by the audio, while still preferring `unknown`, `unclear`, or `multiple possible songs` over overconfident false certainty.

---

## Tasks

### Task 1: Split cod-test benchmark truth into spoken dialogue vs sung-vocal evaluation lanes

**Bead ID:** `ee-bo5x`  
**SubAgent:** `research`  
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, audit the current cod-test benchmark truth and design a clean split between spoken dialogue truth and sung-vocal truth. Specify which existing lines belong in each lane, what files/schema should hold the split truth, and how evaluation/reporting should consume them so dialogue is no longer graded against sung lyrics. Update this plan with the exact recommendation, but do not change code in this task.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `benchmarks/fixtures/cod-test/truth/`
- `docs/` (if recommendation memo is warranted)

**Files Created/Deleted/Modified:**
- `.plans/2026-04-05-famous-song-grounding-and-benchmark-split.md`
- benchmark truth files to be determined by implementation

**Status:** ✅ Complete

**Results:** Audited the current mixed truth (`benchmarks/fixtures/cod-test/truth/dialogue-data.json`) against the latest three-lane Phase 1 rerun artifacts (`output/cod-test-xiaomi-mimo-v2-omni-openrouter-high-thinking-rerun/phase1-gather-context/{dialogue-data.json,music-data.json,music-vocals-data.json}`) and designed the split precisely.

- **Current truth problem**
  - The existing `truth/dialogue-data.json` is not actually spoken-dialogue-only. It mixes 20 spoken lines with 10 sung lyric lines from `spk_011` (`Speaker 11`, explicitly described there as `sung heavy-metal lyric vocal`).
  - That means the dialogue benchmark truth currently encodes both the spoken lane and the sung-vocal lane inside one file, even though the runtime now emits those as separate artifacts.
  - The latest rerun confirms the lane architecture is correct: `dialogue-data.json` stayed spoken-only, `music-data.json` stayed non-lexical, and `music-vocals-data.json` is where lyric text now belongs.

- **Exact split of existing truth lines**
  - **Keep in spoken-dialogue truth**: indexes `0-13`, `22-26`, and `28` from the current `truth/dialogue-data.json` `dialogue_segments` array.
    - Spoken lines retained:
      - `0` `0-5` `They want you afraid. Fear makes you easier to control.`
      - `1` `8-10` `It's time to wake up.`
      - `2` `12-17` `Your streets, shall once again run red with your blood.`
      - `3` `17-21` `Raul Menendez ignited global unrest on an unprecedented scale.`
      - `4` `22-24` `Menendez is a terrorist.`
      - `5` `24-26` `We're bringing peace and security to the world.`
      - `6` `28-29` `He refuses to let me go.`
      - `7` `30-33` `Stop looking backwards, David. What matters is what we do next.`
      - `8` `35-36` `A lot of people counting on us for answers.`
      - `9` `45-47` `You shall know fear.`
      - `10` `51-52` `Specter one, report.`
      - `11` `54-55` `Need a sitrep.`
      - `12` `61-62` `This isn't real.`
      - `13` `63-64` `The hell it ain't!`
      - `22` `98-99` `Pull it together, man!`
      - `23` `100-102` `So eager to leave daddy.`
      - `24` `103-105` `Killing the man is a hell of a lot easier than killing the idea.`
      - `25` `108-110` `You were never cut out to be a Mason.`
      - `26` `112-114` `No more games! This ends now.`
      - `28` `122-124` `Get the Reznov challenge pack when you preorder now!`
  - **Move into sung-vocal truth**: indexes `14-21`, `27`, and `29` from the same file.
    - Sung-vocal lines moved:
      - `14` `64-65` `Obey your master.`
      - `15` `68-70` `Control faster.`
      - `16` `76-78` `Master of puppets are pulling the strings!`
      - `17` `80-83` `Twisting your mind, smashing your dreams!`
      - `18` `84-86` `Blinded by me, you can’t see a thing`
      - `19` `87-88` `Just call my name ’cause I’ll hear you scream`
      - `20` `89-94` `Master, master, where’s the dreams that I’ve been after?`
      - `21` `94-98` `Master, master, you promised only lies!`
      - `27` `116-118` `Obey your master!`
      - `29` `127-130` `Master, master`

- **Recommended truth files / schema placement under `benchmarks/fixtures/cod-test/truth/`**
  - Keep `truth/dialogue-data.json`, but rewrite it to be **spoken-only truth** for the `dialogueData` artifact. Reuse the existing dialogue schema (`dialogue_segments`, `speaker_profiles`, `summary`, `handoffContext`, `cleanedTranscript`, etc.), but remove the sung `spk_011` segments from `dialogue_segments` and remove `spk_011` from `speaker_profiles`.
  - Add `truth/music-vocals-data.json` as the new truth file for the `musicVocalsData` artifact. Reuse the runtime `music-vocals-data.json` contract (`vocal_segments`, `summary`, `hasVocals`, `totalDuration`, `coverage`, `provenance`, optional `qualityNotes`).
  - Keep `truth/music-data.json` focused on non-lexical music context only; do **not** duplicate lyric text there.
  - Recommended lane ownership after split:
    - `dialogueData` ↔ `truth/dialogue-data.json` = spoken dialogue, comms, taunts, promo VO, overlap-heavy spoken lines.
    - `musicVocalsData` ↔ `truth/music-vocals-data.json` = sung / chant / music-led lexical vocal content only.
    - `musicData` ↔ `truth/music-data.json` = non-lexical music arc, mood, intensity, transitions.

- **Recommended evaluation / reporting changes**
  - Add a benchmark manifest entry for `artifactKey: musicVocalsData` pointing at `phase1-gather-context/music-vocals-data.json` with truth at `truth/music-vocals-data.json` and a structured comparator profile appropriate for the music-vocals schema.
  - Keep the existing `dialogueData` benchmark entry, but ensure its truth path remains the now-spoken-only `truth/dialogue-data.json`.
  - Report `dialogueData` and `musicVocalsData` as separate Phase 1 artifact rows in `_reports/benchmark-summary.{json,md}` and `artifact-results/` so dialogue misses are no longer inflated by lyric misses.
  - If a rolled-up Phase 1 score is desired, compute it as an aggregate of the separate `dialogueData`, `musicData`, and `musicVocalsData` artifact results rather than by leaving cross-lane text in one truth file.
  - Preserve the current architectural rule in evaluation notes: spoken promo VO (`Get the Reznov challenge pack...`) still belongs to dialogue, not music-vocals, even when score/music is underneath.

- **Why this split is the right one given the latest artifacts**
  - The rerun dialogue artifact already behaves like a spoken-only lane: it excludes the lyric block entirely.
  - The rerun music-vocals artifact is weak, but it is still the correct lane for the lyric truth. Fixing that artifact should happen by improving `music-vocals`, not by keeping lyrics inside dialogue truth.
  - The current benchmark mismatch is therefore mostly a truth-layout problem, not a reason to collapse the three-lane Phase 1 design.

---

### Task 2: Design famous-song grounding fields and prompt rules for music/music-vocals

**Bead ID:** `ee-xrvw`  
**SubAgent:** `research`  
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, design a prompt and output-contract update for the Phase 1 music and music-vocals lanes so the model can explicitly state whether it believes it heard a recognizable famous song, what song it might be, how confident it is, and what evidence supports that belief. Include safeguards for unknown songs, ambiguous audio, multiple songs in one file, and cases where spoken dialogue overlaps music. Update the active plan with a concrete recommendation, but do not change code in this task.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `server/scripts/get-context/`
- `server/lib/`
- `docs/` (if recommendation memo is warranted)

**Files Created/Deleted/Modified:**
- `.plans/2026-04-05-famous-song-grounding-and-benchmark-split.md`
- prompt/schema files to be determined by implementation

**Status:** ✅ Complete

**Results:** Recommended an additive famous-song grounding contract for both Phase 1 lanes without collapsing the current dialogue-vs-music boundary.

**Recommended output-contract changes**
- Keep the existing top-level lane shapes intact so current consumers keep working:
  - `music` stays centered on `summary`, `hasMusic`, `segments`, `globalArc`, and `qualityNotes`.
  - `music-vocals` stays centered on `rollingSummary`, `vocalSummary`, `vocal_segments`, and `qualityNotes`.
- Add a new optional top-level object to both lanes named `recognizedSong`, plus a shared optional `recognitionNotes` array for ambiguity/safeguard reporting.
- Proposed `recognizedSong` shape for both `music` and `music-vocals`:
  - `status`: enum `recognized | possible | multiple_possible | unknown | none_present`
  - `confidence`: number `0.0-1.0`
  - `candidates`: array of 0-3 objects, each with:
    - `title`: string | null
    - `artist`: string | null
    - `confidence`: number `0.0-1.0`
    - `evidence`: short array of strings grounded in the audio, e.g. exact lyric fragment, distinctive hook/instrumentation, repeated phrase, vocal cadence, arrangement cue
    - `matchedLyrics`: optional array of short literal lyric fragments actually heard in the file
    - `timeRanges`: optional array of `{ start, end }` windows where the evidence appears
    - `ambiguity`: optional short string describing why this is not certain
  - `primaryEvidence`: short string summarizing why the top candidate is plausible
  - `ambiguity`: optional top-level string for the lane-level uncertainty summary
  - `multipleSongsDetected`: boolean
- `recognitionNotes` should capture lane-level cautions such as `lyrics partially masked`, `spoken dialogue overlaps chorus`, `multiple songs or cues detected`, `recognition based on a short refrain only`, or `instrumental resemblance without enough proof for identification`.

**Recommended lane responsibilities**
- `music` lane should answer: “Does the overall score/track appear to be a recognizable famous song or cue?” It can use instrumentation, structure, famous hook recognition, and the downstream `music-vocals` evidence when vocals exist, but it should still work for instrumental-only cases.
- `music-vocals` lane should answer: “Did we hear text-bearing sung/chanted/rapped vocals that suggest a recognizable song?” Its evidence should lean heavily on literal heard lyric fragments and delivery-specific cues.
- If both lanes emit `recognizedSong`, later consumers should treat `music-vocals` as stronger evidence when literal lyrics are present, and treat `music` as the fallback/secondary signal when recognition is driven by instrumental or global arc cues.

**Prompt-rule recommendations**
- Add an explicit grounding instruction to both prompts: the model may use probable famous-song recognition as a grounding aid, but it must prefer `unknown`, `possible`, or `multiple_possible` over inventing certainty.
- Require that every non-`unknown` candidate be justified by audio-grounded evidence, not by vibe-only genre guessing.
- Require the model to distinguish these cases:
  - `recognized`: one candidate clearly best, with strong direct evidence
  - `possible`: one plausible candidate, but evidence is partial or masked
  - `multiple_possible`: more than one plausible match, none decisive
  - `unknown`: music is present but no reliable famous-song identification is supported
  - `none_present`: no music-led song evidence exists in the lane
- Tell the model not to infer a famous song from a single generic phrase unless the phrase is unusually distinctive in combination with other cues.
- Tell the model to avoid filling title/artist from world knowledge unless the audio evidence plausibly supports that exact match.

**Safeguards and ambiguity handling**
- Unknown songs: if the clip likely contains a real song but the title/artist are not reliably recoverable, set `status: "unknown"`; keep observed lyrics in `vocal_segments`; describe the music normally; do not hallucinate a title.
- Ambiguous audio: if masking, distortion, crowd noise, heavy SFX, or short duration weakens certainty, lower confidence and explain the ambiguity in `ambiguity` / `recognitionNotes`.
- Multiple songs in one file: set `multipleSongsDetected: true`; list separate candidates with time ranges; prefer `multiple_possible` unless one song clearly dominates the relevant window.
- Spoken dialogue overlapping music: keep spoken words out of `vocal_segments`; if overlap weakens recognition confidence, note that explicitly in `recognitionNotes`; do not upgrade certainty based on dialogue words that are not part of the sung content.
- Instrumental resemblance only: allow the `music` lane to mark a `possible` candidate from distinctive instrumental evidence, but disallow `recognized` unless the cue is unusually specific.

**Spoken-vs-sung/chant/rap distinction guidance**
- Spoken dialogue belongs in the dialogue lane when the delivery is primarily conversational or narration-led, even if there is score underneath.
- `music-vocals` should include only music-led lexical vocals: sung melody, chant-like refrains, rhythmic rap over a beat, or truly inseparable hybrid delivery already covered by the existing `delivery` enum.
- Recommended discriminator wording for prompts:
  - If the voice follows musical meter, pitch contour, chant cadence, or beat-locked rap phrasing, treat it as `music-vocals`.
  - If the voice is primarily conversational exposition, radio chatter, scene dialogue, or promo VO over background score, keep it out of `music-vocals` and out of song-recognition evidence except as an explicit overlap note.
  - When delivery switches between spoken and sung, split into adjacent segments rather than merging.

**How famous-song recognition should help grounding**
- Recognition should improve grounding by giving the model permission to anchor repeated lyric fragments or distinctive hooks to a plausible known song when the audio strongly supports it.
- It should remain optional and defeasible: the model must never treat recognition as mandatory for producing a valid music or music-vocals artifact.
- The contract should reward calibrated uncertainty: a correct `possible` or `unknown` is better than a falsely precise `recognized` label.
- For benchmark/editorial use, these fields should be interpreted as evidence-bearing hypotheses, not as canonical metadata lookup.

**Implementation notes for the eventual coder task**
- Extend the `music` validator/tool contract example to include optional `recognizedSong` and `recognitionNotes`.
- Extend the `music-vocals` validator/tool contract example to include the same additive fields.
- Update both whole-asset and chunked prompt templates so recognition is explicitly allowed but tightly evidence-gated.
- Preserve backward compatibility by making all new recognition fields optional and by leaving existing required fields unchanged.

---

### Task 3: Implement benchmark split and famous-song grounding fields in Phase 1 outputs

**Bead ID:** `ee-oi5c`  
**SubAgent:** `coder`  
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, implement the approved benchmark split and the approved music/music-vocals contract changes for famous-song grounding. Add explicit structured fields for possible song identification, confidence, and evidence; tighten spoken-vs-sung disambiguation rules; update tests and evaluation/reporting as needed; then run focused validation and update this plan truthfully with exact file/test results. Commit after tests pass, but do not push unless instructed.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `benchmarks/fixtures/cod-test/truth/`
- `server/scripts/get-context/`
- `server/lib/`
- `test/`
- `output/` (for validation artifacts if rerun)

**Files Created/Deleted/Modified:**
- `.plans/2026-04-05-famous-song-grounding-and-benchmark-split.md`
- `benchmarks/fixtures/cod-test/benchmark.json`
- `benchmarks/fixtures/cod-test/truth/dialogue-data.json`
- `benchmarks/fixtures/cod-test/truth/music-data.json`
- `benchmarks/fixtures/cod-test/truth/music-vocals-data.json`
- `server/lib/benchmark-runner.cjs`
- `server/lib/music-vocals-artifact.cjs`
- `server/lib/phase1-validator-tools.cjs`
- `server/lib/structured-output.cjs`
- `server/scripts/get-context/get-music.cjs`
- `server/scripts/get-context/get-music-vocals.cjs`
- `test/lib/benchmark-runner.test.js`
- `test/lib/phase1-validator-tools.test.js`
- `test/scripts/get-music.test.js`
- `test/scripts/get-music-vocals.test.js`

**Status:** ✅ Complete

**Results:** Implemented the approved benchmark split and additive famous-song grounding contract. The cod benchmark now scores spoken dialogue and sung vocals separately via distinct `dialogueData` and `musicVocalsData` artifacts. Both Phase 1 music lanes now accept optional `recognizedSong` and `recognitionNotes` fields with guarded validation/normalization for `status`, `confidence`, bounded candidates, audio-grounded `evidence`, optional `matchedLyrics`, optional `timeRanges`, lane-level ambiguity, and `multipleSongsDetected`. Chunk prompts, whole-asset prompts, tool-contract examples, and final artifact assembly were tightened so spoken dialogue over score is explicitly excluded from lyric evidence. Focused validation passed after fixing a tool-loop passthrough bug so chunk-mode recognized-song data survives into the final persisted artifact.

**Tests Run:**
- `node --test test/lib/phase1-validator-tools.test.js test/scripts/get-music.test.js test/scripts/get-music-vocals.test.js test/lib/benchmark-runner.test.js`

**Outcomes:**
- ✅ Validator/tool-contract tests passed for additive music + music-vocals song-grounding fields.
- ✅ Music and music-vocals script tests passed, including prompt-rule assertions and persistence of optional `recognizedSong` / `recognitionNotes` fields.
- ✅ Benchmark runner tests passed, including a new proof that `musicVocalsData` benchmarks separately from `dialogueData`.

---

## Final Results

**Status:** ✅ Complete

**What We Built:** Split the COD benchmark truth so dialogue truth is spoken-only and music-vocals truth captures the sung Metallica lines; added optional evidence-gated famous-song grounding fields to both Phase 1 music lanes; updated benchmark wiring so dialogue and sung-vocal scoring are separate; and refreshed focused tests to verify both schema changes and benchmark behavior.

**Commits:**
- Pending

**Lessons Learned:** The local validator/tool-loop path needs explicit passthrough for any newly added additive fields; otherwise chunk-mode contracts can validate successfully yet silently disappear before final artifact assembly.

---

*Completed on 2026-04-05*
