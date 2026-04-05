# emotion-engine: Phase 1 music-vocals script and dialogue scope split

**Date:** 2026-04-04  
**Status:** In Progress  
**Agent:** Cookie 🍪

---

## Goal

Add a transcript-like music-vocals lane inside the existing Phase 1 music script, and narrow the existing dialogue script back to spoken dialogue so each lane has a cleaner contract and less conflicting prompt pressure.

---

## Overview

The recent experiments taught us something useful: lyric omission, lyric segmentation, and lyric timing all respond to prompt wording, but combining spoken dialogue and music-backed vocals inside one Phase 1 script creates a contract conflict. When the prompt is strict about dialogue, lyrics disappear. When the prompt is broadened to include lyrics, the model starts finding them but temporal placement degrades and the spoken-dialogue lane picks up music-driven distortion.

Derrick’s proposed split is the cleaner architecture. Instead of overloading `get-dialogue.cjs`, we should keep spoken language in `get-dialogue.cjs` and extend the existing Phase 1 music lane to emit transcript-like music-vocal data for sung/chant-like/vocalized music content. Then `get-dialogue.cjs` can return to a tighter spoken-dialogue contract while the music lane owns lyric-like material. Downstream comparison or review layers can combine the two artifacts when needed, but Phase 1 collection stays specialized.

This lane should stay bounded. First define the contract split clearly; then implement the new script and config wiring; then run the canonical cod-test with both lanes enabled and compare whether spoken dialogue gets cleaner while lyric coverage survives in the new music-vocals artifact.

Recommended architecture after Task 1: keep Phase 1 as three distinct context lanes with intentionally different responsibilities: `dialogueData` for spoken-word transcript events, `musicVocalsData` for text-bearing music-backed vocal events, and existing `musicData` for non-lexical music analysis (mood, intensity, arc, instrumentation, transitions). This preserves a clean spoken-dialogue contract while giving sung / chant-like / rap-like material its own timing/text lane instead of forcing it through either dialogue or generic music mood analysis.

---

## Tasks

### Task 1: Define the split contract between spoken dialogue and music vocals

**Bead ID:** `ee-38xk`  
**SubAgent:** `research`  
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, define a clean contract split between Phase 1 spoken dialogue extraction and a new dedicated Phase 1 music-vocals extraction lane. Specify what belongs in dialogue, what belongs in music vocals, what overlap (if any) is allowed, and what downstream artifact names/shapes should be used. Keep the design generic across assets. Update the plan with a concrete recommendation, but do not change code in this task.`

**Folders Created/Deleted/Modified:**
- `.plans/`

**Files Created/Deleted/Modified:**
- `.plans/2026-04-04-phase1-music-vocals-script-and-dialogue-scope-split.md`

**Status:** ✅ Complete

**Results:** Defined a recommended Phase 1 contract split that removes sung / chant-like / rap-like music-backed words from the spoken-dialogue lane and gives them a dedicated text-bearing `musicVocalsData` artifact.

Concrete recommendation:

- **`dialogueData` stays spoken-only.** It should contain audible spoken words and spoken-word style delivery: dialogue, narration, VO, radio chatter, PA/system speech, whispered/spoken interjections, and speech over background score when the delivery is still fundamentally spoken rather than sung.
- **`musicVocalsData` becomes the text lane for music-backed vocals.** It should contain audible sung lyrics, chant-like hooks, melodic refrains, rap / rhythm-led verses, choir lines with discernible words, and other clearly lexical vocal phrases whose delivery is governed primarily by the music rather than conversational speech.
- **`musicData` remains non-lexical music analysis.** It should continue to describe score/song mood, energy, structure, transitions, instrumentation, and emotional arc, but it should not become the carrier for transcript-like lyric text.

Recommended downstream artifact names / shapes:

1. **Primary artifact key / file**
   - Artifact key: `musicVocalsData`
   - Persisted file: `phase1-gather-context/music-vocals-data.json`
   - Script intent/name for Task 2: dedicated Phase 1 script parallel to `get-dialogue.cjs` (for example `get-music-vocals.cjs`)

2. **Suggested JSON shape**

```json
{
  "vocal_segments": [
    {
      "start": 64.0,
      "end": 66.2,
      "text": "Obey your master.",
      "confidence": 0.82,
      "delivery": "sung",
      "performer": "Vocalist 1",
      "performer_id": "voc_001"
    }
  ],
  "summary": "Brief summary of the lyrical / music-backed vocal content.",
  "totalDuration": 130.0,
  "coverage": {
    "hasVocals": true,
    "lexicalVocalsPresent": true
  },
  "qualityNotes": []
}
```

Shape notes:
- Keep the lane structurally close to `dialogueData` so downstream tooling can union transcript-like segments easily.
- Use `vocal_segments` rather than `dialogue_segments` to keep the contract semantically clean.
- `delivery` should be an enum-like field such as `sung | chant | rap | hybrid` so downstream consumers can reason about style without reclassifying from scratch.
- `performer` / `performer_id` should be lane-local acoustic labels, analogous to dialogue speakers, but should not imply character identity.
- `summary`, `totalDuration`, `coverage`, and optional `qualityNotes` should mirror current Phase 1 conventions where useful.

Overlap / boundary rules:
- **Default rule: no duplicate lexical events across `dialogueData` and `musicVocalsData`.** A given spoken-or-sung line should live in exactly one lane.
- **Classification rule:** assign by dominant delivery mode, not by whether music is present in the background. Spoken words over score stay in `dialogueData`; lyrics/chant/rap synchronized to the music go to `musicVocalsData`.
- **Hybrid moments:** if a moment clearly changes mode (for example spoken intro into sung hook), split it into adjacent segments and route each piece to the correct lane.
- **Ambiguous unsplittable moments:** prefer the lane matching the dominant perceived delivery and allow `delivery: "hybrid"` inside `musicVocalsData` only when the line is genuinely inseparable and music-led. Do not mirror the same text into both artifacts.
- **Non-lexical vocals:** humming, wordless choir pads, breaths, screams, crowd shouts without discernible words, and purely expressive vocal texture should stay out of both transcript lanes unless downstream later needs a separate non-lexical vocal feature; for now they belong only indirectly in `musicData` if musically relevant.

Implementation notes for Task 2:
- Narrow the current dialogue prompt/validator/examples back to **spoken dialogue only** so the lane stops fighting between speech fidelity and lyric recovery.
- Derrick refinement applied: extend the existing `get-music.cjs` lane instead of creating a brand-new Phase 1 script. Reuse the music lane’s whole-asset/chunked/hybrid transport and validation path, and emit a second artifact (`musicVocalsData`) for lyric/chant/rap-style text-bearing music-led vocals.
- Keep the design generic across assets: avoid cod-test-specific references, Metallica-specific wording, or assumptions about trailers. The contract should work for songs, musical trailers, anime openings, montage edits, gameplay trailers, ads, and dialogue-over-score scenes.
- Downstream union logic should be conceptualized as `phase1 vocal transcript = dialogueData.dialogue_segments + musicVocalsData.vocal_segments` when a later consumer wants one combined text timeline, but Phase 1 collection should stay separated.
- Task 2 should update artifact registries / persisted-artifact mappings / tests only as needed to treat `musicVocalsData` as a first-class Phase 1 artifact alongside `dialogueData` and `musicData`.

---

### Task 2: Implement music-vocals extraction inside the Phase 1 music lane and narrow dialogue back to spoken dialogue

**Bead ID:** `ee-7fh7`  
**SubAgent:** `coder`  
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, implement the contract split from Task 1. Extend the existing Phase 1 music lane to emit transcript-like music-vocal data for sung lyrics / chant-like vocals / melodic refrains, and narrow the existing dialogue script back to spoken dialogue only. Wire the new music-vocal artifact into the relevant config(s) and outputs, add or update focused tests for both lanes, update the active plan with exact files/artifacts changed, commit after tests pass, but do not push.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `server/lib/`
- `server/scripts/get-context/`
- `server/scripts/process/`
- `server/scripts/report/`
- `test/lib/`
- `test/scripts/`

**Files Created/Deleted/Modified:**
- `.plans/2026-04-04-phase1-music-vocals-script-and-dialogue-scope-split.md`
- `server/lib/artifact-manager.cjs`
- `server/lib/phase1-validator-tools.cjs`
- `server/lib/persisted-artifacts.cjs`
- `server/lib/script-contract.cjs`
- `server/lib/structured-output.cjs`
- `server/run-pipeline.cjs`
- `server/scripts/get-context/get-dialogue.cjs`
- `server/scripts/get-context/get-music.cjs`
- `server/scripts/process/whole-video-mimo.cjs`
- `server/scripts/report/evaluation.cjs`
- `test/lib/phase1-validator-tools.test.js`
- `test/scripts/get-dialogue.test.js`
- `test/scripts/get-music.test.js`

**Status:** ✅ Complete

**Results:** Implemented Derrick's refinement by extending the existing `get-music.cjs` lane instead of creating a new Phase 1 script. The music lane now emits a second first-class artifact, `musicVocalsData`, via `phase1-gather-context/music-vocals-data.json`, populated from optional `vocal_segments` / `vocalSummary` returned by chunked, whole-asset, and hybrid music analysis. The dialogue lane was narrowed back to spoken dialogue only, explicitly excluding sung lyrics, chant-like vocals, rap synchronized to music, melodic refrains, and other music-led lexical events while keeping spoken-over-score in `dialogueData`. Artifact/config/output wiring was added in `server/run-pipeline.cjs`, `server/lib/artifact-manager.cjs`, `server/lib/persisted-artifacts.cjs`, `server/lib/script-contract.cjs`, `server/scripts/report/evaluation.cjs`, and `server/scripts/process/whole-video-mimo.cjs`. Validation/tooling was updated in `server/lib/structured-output.cjs` and `server/lib/phase1-validator-tools.cjs`. Focused tests were updated in `test/lib/phase1-validator-tools.test.js`, `test/scripts/get-dialogue.test.js`, and `test/scripts/get-music.test.js`, and the targeted regression run passed: `node --test test/lib/phase1-validator-tools.test.js test/scripts/get-dialogue.test.js test/scripts/get-music.test.js test/scripts/evaluation.test.js test/scripts/whole-video-mimo.test.js` → 91 passing, 0 failing.

---

### Task 3: Rerun the canonical cod-test and compare split-lane results against benchmark truth

**Bead ID:** `ee-rtkl`  
**SubAgent:** `primary`  
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, rerun the canonical cod-test after the music-lane vocal transcript support lands. Compare the spoken-dialogue artifact against spoken benchmark lines and the music-lane vocal artifact against lyric/chant benchmark lines. Evaluate whether the split reduced dialogue distortion while preserving or improving lyric coverage. Update the plan truthfully and commit the verification writeup without pushing unless justified.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `.logs/`
- `output/`

**Files Created/Deleted/Modified:**
- `.plans/2026-04-04-phase1-music-vocals-script-and-dialogue-scope-split.md`
- fresh output/log artifacts

**Status:** ✅ Complete

**Results:** Reran the canonical lane successfully with:

`node server/run-pipeline.cjs --config configs/cod-test-xiaomi-mimo-v2-omni-openrouter-high-thinking-rerun.yaml --clean-live-digital-twin --verbose`

The rerun completed end-to-end with exit code `0`: Phase 1 dialogue succeeded, Phase 1 music succeeded, `musicVocalsData` was emitted as a first-class artifact, and Phase 2 `whole-video-mimo` also completed. Fresh key artifact paths:

- `output/cod-test-xiaomi-mimo-v2-omni-openrouter-high-thinking-rerun/phase1-gather-context/dialogue-data.json`
- `output/cod-test-xiaomi-mimo-v2-omni-openrouter-high-thinking-rerun/phase1-gather-context/music-data.json`
- `output/cod-test-xiaomi-mimo-v2-omni-openrouter-high-thinking-rerun/phase1-gather-context/music-vocals-data.json`
- `output/cod-test-xiaomi-mimo-v2-omni-openrouter-high-thinking-rerun/phase2-process/whole-video-analysis.json`
- supporting success envelopes: `output/cod-test-xiaomi-mimo-v2-omni-openrouter-high-thinking-rerun/phase1-gather-context/script-results/get-dialogue.success.json`, `output/cod-test-xiaomi-mimo-v2-omni-openrouter-high-thinking-rerun/phase1-gather-context/script-results/get-music.success.json`, and `output/cod-test-xiaomi-mimo-v2-omni-openrouter-high-thinking-rerun/phase2-process/script-results/whole-video-mimo.success.json`

Truth comparison against `benchmarks/fixtures/cod-test/truth/dialogue-data.json` after applying the split contract:

### Spoken benchmark vs `dialogueData`

Treating the spoken benchmark as the 20 non-`spk_011` truth lines, the new spoken-only dialogue artifact is materially cleaner than the pre-split lyric-in-dialogue attempts.

Strong spoken recoveries in `dialogueData`:
- Opening propaganda line is preserved, but split across two adjacent segments: `They want you afraid.` + `Fear makes you easier to control.`
- Exact or near-exact spoken recovery is present for most of the core non-lyric lines, including:
  - `It's time to wake up.`
  - `Your streets ... run red with your blood.`
  - `Raul Menendez ignited global unrest...`
  - `Menendez is a terrorist.`
  - `We're bringing peace and security to the world.`
  - `He refuses to let me go.`
  - `Stop looking backwards, David...`
  - `A lot of people counting on us for answers.`
  - `Need a sitrep.`
  - `This isn't real.`
  - `The hell it ain't!`
  - `Pull it together, man.`
  - `Killing the man is a hell of a lot easier than killing the idea.`
  - `You were never cut out to be a Mason.`
  - `No more games. This ends now.`
  - `Get the Reznov challenge pack when you pre-order now.`

Remaining spoken misses / distortions:
- `You shall know fear.` is still absent.
- `Specter one, report.` drifted to `Inspector One report.`
- `So eager to leave daddy.` drifted to `So eager to leave, are we?`
- Timing is still compressed and late in the mid/late trailer region: for example `Pull it together, man!` truth `98-99s` landed at `60-61s`, and the promo line truth `122-124s` landed at `130-135s`.

Bottom line on spoken dialogue: **yes, the split reduced dialogue distortion.** The dialogue lane no longer contains the earlier giant lyric/chant contamination blob or music-led paraphrase soup. Instead it behaves like a mostly spoken-only transcript with a few remaining wording/timing errors.

### Lyric / chant benchmark vs `musicVocalsData`

Treating the lyric benchmark as the 10 `spk_011` truth lines, the new `musicVocalsData` artifact is a partial recovery, not a benchmark-faithful lyric transcript.

What `musicVocalsData` recovered usefully:
- It captured an explicit late hook segment `Obey your master!` at `115-120s`, which is close to the benchmark `116-118s` line and is now cleanly separated out of `dialogueData`.
- It captured a recognizable `Master! Master! ... I'll be after! Master! Master!` chorus-like segment at `90-95s`, which is adjacent to the benchmark `Master, master, where's the dreams that I've been after?` / closing `Master, master` region, but the wording is still paraphrased / drifted.
- It captured a dedicated lyric-bearing region at `65-90s` instead of forcing all music-led text through the spoken dialogue lane.

What is still missing or too distorted to count as strong lyric coverage:
- `Control faster.` is not recovered.
- `Master of puppets are pulling the strings!` is not recovered.
- `Twisting your mind, smashing your dreams!` is not recovered.
- `Blinded by me, you can't see a thing` is not recovered.
- `Just call my name 'cause I'll hear you scream` is not recovered.
- `Master, master, you promised only lies!` is not recovered.
- The first lyric onset is still badly misplaced: truth `Obey your master.` occurs at `64-65s`, while the strongest late `Obey your master!` recovery lands at `115-120s`.
- The first long lyric segment contains obvious non-benchmark wording drift: `I'll face any monster Come crawling faster`.
- The final `We rise tonight` tail at `120-140s` does not correspond to the benchmark closing lyric truth and looks more like low-trust paraphrase / invention than useful cod-test lyric coverage.

Bottom line on lyric coverage: **the split preserved some lyric awareness, but `musicVocalsData` is not yet materially useful as a benchmark-faithful lyric transcript.** It is useful architecturally because the lyric-like material now has its own lane and no longer distorts `dialogueData`, but the actual cod-test lyric fidelity remains partial and weak.

Overall evaluation of the split:
- **Dialogue quality improved:** yes, clearly. Spoken dialogue is cleaner and less music-distorted than the pre-split attempts.
- **Lyric coverage preserved/improved enough to justify the lane split:** partially. The new lane proves the architecture is directionally correct and captures some lyric hooks, but current lyric fidelity is still too incomplete / paraphrastic to call a strong benchmark win.
- **Net verdict:** the scope split was the right architectural move for Phase 1, but the dedicated `musicVocalsData` prompt/validation/timing behavior still needs another tightening pass before it can be treated as materially useful cod-test lyric truth.

Committed the verification writeup only (no push) so the plan now records the truthful rerun outcome and verdict. Runtime noise like `.beads/interactions.jsonl` and `tmp/` was intentionally excluded from the commit.

---

## Final Results

**Status:** ⚠️ Partial

**What We Built:** Implemented the Phase 1 spoken-dialogue vs music-vocals split, reran the canonical cod-test successfully, and verified the outcome against the human cod benchmark. The rerun proves the split architecture works operationally: the pipeline now emits `dialogueData`, `musicData`, `musicVocalsData`, and `whole-video-analysis.json` together from the canonical lane. On evaluation, the spoken dialogue lane is noticeably cleaner and less distorted by lyrics than before, but the new `musicVocalsData` lane still only partially captures the benchmark lyric/chant block and is not yet benchmark-strong.

**Commits:**
- Local verification writeup commit created for Task 3 (reported in execution handoff; not pushed).

**Lessons Learned:** Separating contracts helped immediately at the architecture level: once lyrics stopped competing with spoken dialogue inside one prompt, the spoken lane got cleaner. But contract separation alone is not enough for lyric fidelity. The dedicated music-vocals lane still needs better wording grounding and timing anchoring, especially for the `64-98s` Metallica block and the closing lyric tail.

---

*Created on 2026-04-04*
