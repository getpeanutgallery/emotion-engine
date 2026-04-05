# emotion-engine: create get-music-vocals Phase 1 script

**Date:** 2026-04-04  
**Status:** In Progress  
**Agent:** Cookie 🍪

---

## Goal

Create a dedicated `get-music-vocals.cjs` Phase 1 script with its own config lane so sung/chant-like lexical vocals stop sharing behavior and target settings with the general music analysis lane.

---

## Overview

The recent split proved that lyric-bearing music vocals and non-lexical music analysis should not live under one behavioral contract. We improved architecture by separating spoken dialogue from music-led vocals, but `musicVocalsData` still rides inside `get-music.cjs`, which means it inherits the same target block and execution flow as the broader music analysis lane. Derrick correctly identified the next structural seam: this should be a first-class Phase 1 script, not just a secondary output of `get-music.cjs`.

Creating `get-music-vocals.cjs` gives us a clean unit of ownership for transcript-like sung/chant/rap extraction. It also lets config grow a dedicated `ai.music_vocals` target branch so dialogue, music, and music-vocals can each be explicit and independently tunable, even if this test config keeps them aligned to the same high-capacity settings. The implementation should stay narrow and reusable: lift shared helpers where practical, avoid duplicating unrelated music-analysis logic, and keep downstream artifact wiring truthful.

---

## Implementation Recommendation

### Recommended Phase 1 split

Make `server/scripts/get-context/get-music-vocals.cjs` a first-class Phase 1 script that owns only the lexical music-vocals artifact. Recommended `gather_context` order for configs that want all three lanes:

1. `server/scripts/get-context/get-dialogue.cjs`
2. `server/scripts/get-context/get-music.cjs`
3. `server/scripts/get-context/get-music-vocals.cjs`

That keeps spoken-word extraction in the dialogue lane, non-lexical music structure in the music lane, and sung/chant/rap transcript-like extraction in a dedicated music-vocals lane.

### Config recommendation

Add a new AI target branch:

- `ai.music_vocals.targets[*].adapter.{name,model,params}`
- optional parity knobs: `ai.music_vocals.retry` and `ai.music_vocals.toolLoop`

Recommended validator/config-loader behavior:

- require `ai.music_vocals.targets` when `server/scripts/get-context/get-music-vocals.cjs` is present in `gather_context`
- if `ai.music_vocals` is configured even when unused, still validate its shape like other optional branches
- keep the canonical rerun config aligned for now by giving `ai.dialogue`, `ai.music`, and `ai.music_vocals` the same `timeoutMs=180000`, `max_tokens=43219`, and `thinking.level=high`

For Task 2 scope control, do **not** introduce a new `settings.phase1.music_vocals` branch unless implementation proves it is necessary. Reuse the current Phase 1 music timing/chunking policy first, and split only the provider target lane now.

### Artifact ownership

`get-music-vocals.cjs` should be the sole owner of:

- artifact key: `musicVocalsData`
- path: `output/<run>/phase1-gather-context/music-vocals-data.json`

Recommended artifact shape:

- keep the existing downstream contract unchanged so Phase 2/3 consumers do not need a schema migration
- preserve:
  - `vocal_segments`
  - `summary`
  - `hasVocals`
  - `totalDuration`
  - `analysisMode`
  - `timingMode`
  - `sourceStrategy`
  - `coverage`
  - `provenance`
  - optional `qualityNotes`

The new script should return only:

- `artifacts: { musicVocalsData }`
- `primaryArtifactKey: 'musicVocalsData'`

### What should remain in `get-music.cjs`

`get-music.cjs` should keep ownership of `music-data.json` and stay focused on:

- audio extraction/preflight
- chunk planning / whole-asset-vs-chunked strategy
- music segment detection
- music mood / intensity / description
- `globalArc`, `qualityNotes`, and music-lane provenance
- deciding whether music exists and how it evolves over time

It should **stop** generating or writing:

- `musicVocalsData`
- `music-vocals-data.json`
- prompt contract text that asks the model to transcribe sung/chanted/rapped words into `vocal_segments`

After the split, `get-music.cjs` may still mention that vocals are present in descriptive prose when relevant, but it should not own transcript-like lexical capture.

### Shared helper reuse guidance

To avoid bad duplication, Task 2 should extract reusable music-vocals helpers out of `get-music.cjs` into a shared lib module rather than copy/paste them. Best candidates:

- `compactString`
- `MUSIC_VOCAL_DELIVERIES`
- `clampMusicVocalTime`
- `normalizeMusicVocalSegments`
- `generateMusicVocalsSummary`
- `buildMusicVocalsData`

A small shared helper module under `server/lib/` is the cleanest seam, e.g. a focused `music-vocals-artifact` helper rather than a giant mixed Phase 1 utility dump.

Task 2 can also reuse existing repo helpers directly without moving them if no duplication is created, especially:

- `audio-preflight.cjs`
- `audio-chunk-extractor.cjs`
- `provider-runtime-config.cjs`
- `phase1-validator-tools.cjs` / `structured-output.cjs` patterns
- raw-capture / prompt-store / events helpers

### Implementation cautions for Task 2

- Add `get-music-vocals` to the script-family hint table so it inherits the same structured-output recovery contract as the other Phase 1 AI scripts.
- Update config validation tests and representative YAML configs that currently only list `get-music.cjs` for music-related Phase 1 work.
- Move the existing `musicVocalsData` expectations out of `test/scripts/get-music.test.js` into a dedicated `test/scripts/get-music-vocals.test.js`, then rewrite `get-music.test.js` to assert that the music lane no longer emits the vocals artifact.
- Preserve the existing artifact filename and schema so `whole-video-mimo.cjs`, persisted-artifact hydration, artifact manager logic, and report/evaluation consumers keep working unchanged.
- Prefer running `get-music-vocals.cjs` after `get-music.cjs` so the new script can optionally consume `artifacts.musicData` as continuity context and keep its timing/provenance story aligned with the music lane.
- Be careful not to leave contradictory prompt rules behind: dialogue must exclude music-led vocals, music must stop transcribing them, and music-vocals must become the only lane that captures lexical sung/chanted/rapped content.

---

## Tasks

### Task 1: Design the new Phase 1 script/config split for music vocals

**Bead ID:** `ee-ujhe`  
**SubAgent:** `research`  
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, design the clean split needed to create a dedicated Phase 1 get-music-vocals.cjs script. Specify how config should change (including a new ai.music_vocals target branch), what artifact shape/path the new script should own, what behavior should remain in get-music.cjs, and what shared helpers can be reused to avoid bad duplication. Update the active plan with a concrete implementation recommendation, but do not change code in this task.`

**Folders Created/Deleted/Modified:**
- `.plans/`

**Files Created/Deleted/Modified:**
- `.plans/2026-04-04-create-get-music-vocals-phase1-script.md`

**Status:** ✅ Complete

**Results:** Audited the current Phase 1 split and documented a concrete implementation recommendation. Recommendation: add `server/scripts/get-context/get-music-vocals.cjs` as a dedicated third gather-context lane after `get-music.cjs`; give it sole ownership of `musicVocalsData` / `phase1-gather-context/music-vocals-data.json`; add a new `ai.music_vocals.targets[*]` branch (plus optional retry/toolLoop parity); keep `get-music.cjs` focused on non-lexical music analysis only; and extract the existing music-vocals normalization/build helpers from `get-music.cjs` into a shared `server/lib/` helper instead of duplicating them. Also flagged Task 2 cautions around config validation, script-family hints, test split, and preserving downstream artifact compatibility.

---

### Task 2: Implement get-music-vocals.cjs and dedicated ai.music_vocals config wiring

**Bead ID:** `ee-w82k`  
**SubAgent:** `coder`  
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, implement a dedicated Phase 1 get-music-vocals.cjs script and wire it to a new ai.music_vocals target branch. Move transcript-like lyric/chant/rap extraction ownership out of get-music.cjs into the new script while keeping get-music.cjs focused on non-lexical music analysis. Update the canonical rerun config so dialogue, music, and music_vocals all use the same timeoutMs=180000, max_tokens=43219, and thinking.level=high. Add or update focused tests, update this plan with exact implementation results, commit after tests pass, and do not push.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `server/scripts/get-context/`
- `server/lib/`
- `configs/`
- `test/`

**Files Created/Deleted/Modified:**
- `.plans/2026-04-04-create-get-music-vocals-phase1-script.md`
- `configs/cod-test.yaml`
- `configs/cod-test-phase1-review.yaml`
- `configs/cod-test-xiaomi-mimo-v2-omni-openrouter-high-thinking-rerun.yaml`
- `server/lib/config-loader.cjs`
- `server/lib/music-vocals-artifact.cjs`
- `server/lib/phase1-validator-tools.cjs`
- `server/lib/script-contract.cjs`
- `server/lib/structured-output.cjs`
- `server/scripts/get-context/get-music.cjs`
- `server/scripts/get-context/get-music-vocals.cjs`
- `test/pipeline/config-loader.test.js`
- `test/scripts/get-music.test.js`
- `test/scripts/get-music-vocals.test.js`

**Status:** ✅ Complete

**Results:** Implemented `server/scripts/get-context/get-music-vocals.cjs` as a dedicated third Phase 1 lane after `get-music.cjs`, with target-selection / retry / tool-loop / raw-capture / persisted-artifact / recovery-contract parity preserved through the same `executeWithTargets` + local-validator-tool-loop pattern used by the other Phase 1 AI scripts. Extracted the shared vocals normalization + artifact builder into `server/lib/music-vocals-artifact.cjs`, removed `musicVocalsData` ownership from `get-music.cjs`, and kept the downstream artifact path/schema stable at `phase1-gather-context/music-vocals-data.json` / `artifacts.musicVocalsData`.

Added `ai.music_vocals` config validation/wiring, including requiring `ai.music_vocals.targets` when `server/scripts/get-context/get-music-vocals.cjs` is present and validating the branch shape when configured. Updated `server/lib/script-contract.cjs` so `get-music-vocals` inherits the same structured-output recovery family and resolves to the `music_vocals` AI domain. Updated `configs/cod-test.yaml` and `configs/cod-test-phase1-review.yaml` to run the third lane, and updated `configs/cod-test-xiaomi-mimo-v2-omni-openrouter-high-thinking-rerun.yaml` so `ai.dialogue`, `ai.music`, and `ai.music_vocals` all use `timeoutMs: 180000`, `max_tokens: 43219`, and `thinking.level: high`.

Focused validation/tests run and passed:
- `node --check server/scripts/get-context/get-music.cjs`
- `node --check server/scripts/get-context/get-music-vocals.cjs`
- `node --check server/lib/structured-output.cjs && node --check server/lib/phase1-validator-tools.cjs && node --check server/lib/config-loader.cjs && node --check server/lib/script-contract.cjs`
- `node --test test/pipeline/config-loader.test.js test/scripts/get-music.test.js test/scripts/get-music-vocals.test.js`
- `node server/run-pipeline.cjs --config configs/cod-test.yaml --dry-run`
- `node server/run-pipeline.cjs --config configs/cod-test-phase1-review.yaml --dry-run`
- `node server/run-pipeline.cjs --config configs/cod-test-xiaomi-mimo-v2-omni-openrouter-high-thinking-rerun.yaml --dry-run`

Parity exceptions: none documented; the new lane reuses the existing Phase 1 music timing/chunking policy (`settings.phase1.music` / `ai.music*.analysisWindowSeconds`) instead of introducing a new `settings.phase1.music_vocals` branch.

---

### Task 3: Rerun the canonical cod-test and verify all three Phase 1 lanes separately

**Bead ID:** `ee-srf0`  
**SubAgent:** `primary`  
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, rerun the canonical cod-test after get-music-vocals.cjs lands. Verify that dialogue-data.json, music-data.json, and music-vocals-data.json are all produced through separate Phase 1 lanes with the intended config settings. Compare spoken dialogue against spoken benchmark lines and music-vocals against lyric benchmark lines. Update the plan truthfully and commit the verification writeup without pushing unless justified.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `.logs/`
- `output/`

**Files Created/Deleted/Modified:**
- `.plans/2026-04-04-create-get-music-vocals-phase1-script.md`
- fresh log/output artifacts

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
