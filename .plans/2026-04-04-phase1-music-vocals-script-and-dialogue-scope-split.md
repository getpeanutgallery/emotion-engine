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

**Status:** ⏳ Pending

**Results:** Pending.

---

## Final Results

**Status:** ⏳ Pending

**What We Built:** Pending.

**Commits:**
- Pending.

**Lessons Learned:** Pending.

---

*Created on 2026-04-04*
