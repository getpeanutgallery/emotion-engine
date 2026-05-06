# Peanut Gallery Emotion Engine

**Date:** 2026-05-06  
**Status:** In Progress  
**Agent:** Cookie 🍪

---

## Goal

Migrate the `music-vocals` timestamp lane onto a faster-whisper-style local timing path analogous to dialogue, rerun the bounded Phase 1→Phase 2 packet, and verify whether prompt-level music-vocals grounding finally appears in the 76s–98s music-heavy window.

---

## Overview

We now know the current `music-vocals` failure seam is the old rerun-alignment handoff: `get-music-vocals-timestamps.cjs` still reruns `get-music-vocals.cjs` with `preserveSegmentTiming: true`, but that contract does not actually yield usable per-segment numeric `start/end`, so the timestamp artifact exists while all `11/11` lyric rows remain unresolved. Dialogue escaped this exact trap by switching to the repo-local faster-whisper timing bridge, and that migration materially improved the dialogue timestamp lane.

Derrick chose the analogous next move for music-vocals: first try the faster-whisper route, then only escalate to a broader fallback/redesign if that does not work. This lane should therefore stay narrow and honest. First, confirm the precise migration contract: whether we can reuse the existing faster-whisper bridge directly, need a sibling helper specialized for lyric/vocal timing, or need a bounded variant of the bridge output contract. Second, implement the narrowest durable faster-whisper-backed derivation path for music-vocals timestamps. Third, rerun the bounded Phase 1→Phase 2 packet and verify prompt-level effect in the music-heavy `76s–98s` window.

The success bar is product-facing: not just “timestamp artifact exists,” but “some meaningful subset of music-vocals rows now carry numeric timing, and Phase 2 prompts begin emitting real chunk-local music-vocals support where that overlap exists.” If the faster-whisper attempt still cannot produce useful prompt-level vocals grounding, that outcome should be documented cleanly so the next escalation choice is evidence-based rather than speculative.

---

## REFERENCES

| ID | Description | Path |
| --- | --- | --- |
| `REF-01` | Music-vocals audit plan with root-cause/options decision memo | `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/.plans/2026-05-06-audit-and-fix-music-vocals-timestamp-lane.md` |
| `REF-02` | Dialogue slice completion plan (done enough to leave behind) | `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/.plans/2026-05-06-fix-dialogue-placeholder-leak-and-prompt-heading.md` |
| `REF-03` | Current music-vocals timestamp script still on the old rerun path | `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/server/scripts/get-context/get-music-vocals-timestamps.cjs` |
| `REF-04` | Dialogue timestamp script already migrated to faster-whisper | `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/server/scripts/get-context/get-dialogue-timestamps.cjs` |
| `REF-05` | Current faster-whisper dialogue bridge/helper | `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/server/lib/faster-whisper-dialogue-timing.cjs` |
| `REF-06` | Current music-vocals source script | `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/server/scripts/get-context/get-music-vocals.cjs` |
| `REF-07` | Current unresolved music-vocals timestamp artifact | `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/output/cod-test-phase2-only-retest-2026-05-06-with-timestamps/phase1-gather-context/music-vocals-timestamps-data.reconciled.json` |
| `REF-08` | Phase 2 chunk grounding implementation | `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/server/scripts/process/video-chunks.cjs` |

---

## Tasks

### Task 1: Plan the faster-whisper migration contract for music-vocals timestamps

**Bead ID:** `ee-1vky`  
**SubAgent:** `primary` (for `research` workflow role)  
**Role:** `research`  
**References:** `REF-01`, `REF-03`, `REF-04`, `REF-05`, `REF-06`, `REF-07`  
**Prompt:** `Claim bead ee-1vky on start with bd update ee-1vky --status in_progress --json. Define the narrowest practical migration contract for switching music-vocals timestamps onto a faster-whisper-style local timing path analogous to dialogue. Be explicit about whether the existing bridge can be reused, whether a sibling helper is needed, what output contract must be produced for the timestamp artifact builder, and what success/failure evidence the coder lane should gather. Update the active plan with concrete findings and close the bead only when the coder lane can proceed without ambiguity.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- read-only inspection of `server/` and current artifacts

**Files Created/Deleted/Modified:**
- `.plans/2026-05-06-migrate-music-vocals-timestamps-to-faster-whisper.md`

**Status:** ✅ Complete

**Results:** The migration contract is now narrow and implementation-ready.

**Decision:** switch only the **timestamp alignment pass** for `music-vocals` to a repo-local faster-whisper path analogous to dialogue. Do **not** redesign the source `music-vocals` extraction lane and do **not** add timestamp capture to `get-music-vocals.cjs` for this slice.

**Why this is the narrowest practical move:**
- The source artifact already has the lyric text we want to preserve verbatim (`music-vocals-data[.reconciled].json`).
- The current failure is specifically that `get-music-vocals-timestamps.cjs` reruns `get-music-vocals.cjs`, but that rerun does not reliably produce timed alignment segments.
- Dialogue already proves the intended pattern: keep the source text artifact, run a separate local faster-whisper timing pass, then align the preserved source text against timed ASR output.
- This keeps scope isolated to the timestamp lane and avoids reopening the chunk prompts / validator contracts inside `get-music-vocals.cjs`.

**Bridge/helper reuse decision:**
- **Do not reuse `deriveFasterWhisperDialogueTiming()` directly as the final music-vocals integration point.**
  - It is lane-shaped around `dialogueData.dialogue_segments` and dialogue-specific error/provenance naming.
  - `buildMusicVocalsTimestampArtifact()` currently expects `alignmentMusicVocalsData.vocal_segments`.
- **Do reuse the same repo-local faster-whisper bridge infrastructure underneath.**
  - Same Python environment: `server/scripts/get-context/faster-whisper-transcribe.py`
  - Same model/runtime fallback pattern as dialogue unless implementation evidence forces a change.
- **Recommended implementation shape:** add a sibling helper, e.g. `server/lib/faster-whisper-music-vocals-timing.cjs`, that wraps the same Python bridge and returns a music-vocals-shaped alignment payload.
- Acceptable alternative if the coder prefers less code duplication: factor the shared spawn/parse logic into a generic helper and keep thin dialogue/music-vocals wrappers on top. But the external contract for the music-vocals timestamp script should still be a sibling lane-specific helper.

**Required alignment payload contract for `buildMusicVocalsTimestampArtifact()`:**
- The timestamp builder can stay functionally the same **if** the faster-whisper helper returns:
  - `alignmentMusicVocalsData.vocal_segments`: array of objects with at least
    - `text: string`
    - `start: number`
    - `end: number`
  - optional passthrough fields are fine (`confidence`, `id`, `words`, etc.), but not required by the matcher
  - `alignmentMusicVocalsData.summary`: string
  - `alignmentMusicVocalsData.totalDuration`: number|null
- Important: these alignment segments are **timed ASR anchors**, not rewritten canonical lyrics. The builder must continue to preserve source lyric text verbatim from `sourceMusicVocalsData` and only borrow timing windows from the alignment payload.
- The current matching logic in `deriveMusicVocalsSegmentTimings()` is already compatible with faster-whisper-style segment text so long as the alignment pool has finite `start/end` values.

**Builder/provenance contract:**
- Functional behavior can remain the same: source text comes from `musicVocalsData[Reconciled]`, alignment text comes from the faster-whisper pass, and output remains `musicVocalsTimestampsData[Reconciled]`.
- Make one bounded provenance cleanup so the artifact tells the truth:
  - replace hardcoded `alignmentEngine: 'phase1_music_vocals_rerun'`
  - prefer an optional `alignmentMetadata` input, parallel to dialogue, so provenance can record `faster_whisper` engine/runtime/version.
- This provenance cleanup is part of the migration contract because otherwise the artifact would claim the old engine even after the lane changes.

**Output artifact contract that downstream Phase 2 needs:**
- The produced timestamp artifact must continue to be shaped as:
  - top-level `vocal_segments: []`
  - each selected/timed segment preserves source fields like `index`, `text`, `performer`, `performer_id`, `delivery`
  - timed segments carry numeric `start` and `end`
  - every segment carries `timing.status`, `timing.confidence`, `timing.method`, `timing.provenance`
- Downstream `video-chunks.cjs` only needs a meaningful subset of `vocal_segments` with numeric `start/end` for overlap selection to work. No downstream schema redesign is needed.
- Preserve current reconciled/raw selection behavior: if the canonical source lane resolves to reconciled, the timestamp artifact must also be emitted on the reconciled surface with reconciled source text.

**Out of scope for this migration:**
- No changes to `get-music-vocals.cjs` prompt/schema/tool-loop unless the coder discovers the faster-whisper path is structurally unusable.
- No chunk-window timing synthesis fallback.
- No broader redesign of `deriveMusicVocalsSegmentTimings()` beyond minimal provenance plumbing unless testing proves the current matcher cannot use faster-whisper output at all.

**Concrete success evidence the coder lane should gather:**
1. **Targeted automated tests**
   - update/add unit tests for the new faster-whisper music-vocals helper
   - update/add `get-music-vocals-timestamps` tests to prove the script now consumes faster-whisper-style timed alignment instead of the old rerun contract
   - preserve existing expectations that source text remains verbatim and reconciled-source selection still wins when present
2. **Artifact-level proof on the known failing sample**
   - rerun the music-vocals timestamp step on the same bounded sample/output path or equivalent fixture
   - show that the resulting `music-vocals-timestamps-data.reconciled.json` no longer has `11/11` unresolved rows
   - minimum success bar: at least one lyric segment in the 76s–98s cue has numeric `start/end`; stronger success is a meaningful subset of the 11 lyric rows timed
3. **Truthful provenance proof**
   - artifact provenance should identify the faster-whisper alignment engine rather than `phase1_music_vocals_rerun`
4. **No-regression proof**
   - existing dialogue timestamp tests stay green
   - existing music-vocals timestamp tests that assert verbatim source text / reconciled-source behavior stay green after adaptation

**Concrete failure evidence that should trigger escalation instead of more guessing:**
- faster-whisper helper runs successfully but returns zero timed segments with usable lyric text overlap on the known sample
- or the helper returns timed ASR segments, but `deriveMusicVocalsSegmentTimings()` still leaves essentially all rows unresolved because sung/repeated-hook matching is too weak
- or the only way to get prompt-level grounding is to broaden source extraction / prompt schema instead of keeping the change isolated to the timestamp lane

**Coder-lane next step:**
- Implement `get-music-vocals-timestamps.cjs` on top of a sibling faster-whisper helper using the existing dialogue bridge pattern.
- Keep the builder/output contract stable, with only the minimal provenance update needed to reflect the new engine.
- Then gather the four evidence buckets above before handing off to QA.

---

### Task 2: Implement faster-whisper-backed music-vocals timestamp derivation

**Bead ID:** `ee-d8si`  
**SubAgent:** `primary` (for `coder` workflow role)  
**Role:** `coder`  
**References:** `REF-03`, `REF-04`, `REF-05`, `REF-06`, `REF-07`, `REF-08`  
**Prompt:** `Claim bead ee-d8si on start with bd update ee-d8si --status in_progress --json. Implement the narrowest durable faster-whisper-backed timestamp derivation path for music-vocals, analogous to the dialogue timestamp lane, while preserving the already-validated dialogue behavior and avoiding broad redesign. Add/update targeted tests, document exact changes and validation, commit/push by default before QA, and close the bead only after the plan is updated.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `server/`
- `test/`

**Files Created/Deleted/Modified:**
- `.plans/2026-05-06-migrate-music-vocals-timestamps-to-faster-whisper.md`
- `server/lib/faster-whisper-music-vocals-timing.cjs`
- `server/lib/phase1-timestamp-derivation.cjs`
- `server/scripts/get-context/get-music-vocals-timestamps.cjs`
- `test/lib/faster-whisper-music-vocals-timing.test.js`
- `test/scripts/get-music-vocals-timestamps.test.js`

**Status:** ✅ Complete

**Results:** Implemented the narrowest lane-specific faster-whisper migration for music-vocals timestamps without broadening the source extraction contract.

**Code changes:**
- Added `server/lib/faster-whisper-music-vocals-timing.cjs` as a sibling helper over the existing repo-local `faster-whisper-transcribe.py` bridge. It preserves the shared Python/cache/runtime behavior but returns a music-vocals-shaped payload: `musicVocalsData.vocal_segments[]` plus `summary`, `totalDuration`, and `metadata`.
- Switched `server/scripts/get-context/get-music-vocals-timestamps.cjs` off the old `get-music-vocals.cjs` rerun path and onto the new helper, keeping the script’s source-artifact selection and output surface behavior intact.
- Updated `server/lib/phase1-timestamp-derivation.cjs` so `buildMusicVocalsTimestampArtifact()` accepts `alignmentMetadata` and records truthful provenance (`alignmentEngine`, `alignmentEngineVersion`, `alignmentRuntime`) instead of hardcoding `phase1_music_vocals_rerun`.
- Preserved the existing builder/matcher contract: source lyric text still comes verbatim from `musicVocalsData[Reconciled]`; faster-whisper is timing-anchor only.

**Targeted tests added/updated:**
- Added `test/lib/faster-whisper-music-vocals-timing.test.js` to cover helper spawn contract, empty timed-segment failure, and surfaced bridge stderr.
- Updated `test/scripts/get-music-vocals-timestamps.test.js` to mock the new helper, assert the asset-path handoff, verify truthful faster-whisper provenance, and keep reconciled-source/verbatim-text behavior intact.
- Re-ran dialogue timestamp coverage alongside the music-vocals tests to guard against regression.

**Validation run:**
- Command: `node --test test/lib/faster-whisper-music-vocals-timing.test.js test/lib/faster-whisper-dialogue-timing.test.js test/scripts/get-music-vocals-timestamps.test.js test/scripts/get-dialogue-timestamps.test.js`
- Result: `17/17` passing.

**Known failing sample evidence (`output/cod-test-phase2-only-retest-2026-05-06-with-timestamps/phase1-gather-context/music-vocals-timestamps-data.reconciled.json`):**
- Before migration: `11/11` unresolved, provenance falsely claimed `phase1_music_vocals_rerun`.
- After rerunning the timestamp step with the new helper: `9/11` unresolved, `2/11` partial, `2/11` with numeric timings.
- Newly timed segments:
  - index `1` — `Master! Master!` → `89.8` to `91.68` (`partial`, confidence `1`)
  - index `5` — `Master! Master!` → `92.22` to `96.36` (`partial`, confidence `0.8`)
- Provenance is now truthful in the artifact: `alignmentEngine: faster_whisper`, `alignmentEngineVersion: 1.2.1`, runtime `cuda/float16`, and `sourceTextIntegrity: verbatim` remains preserved.

**Assessment:** this did materially improve the known failure from an all-unresolved state, but only partially. The migration surfaced usable timing anchors in the `~90s–96s` window without changing the source lyric text contract, while most of the 11 lyric rows still remain unresolved.

**Commit / push:**
- `58cfb52` — `Switch music-vocals timestamps to faster-whisper` (pushed to `origin/main`)

---

### Task 3: QA the faster-whisper music-vocals rerun and prompt grounding

**Bead ID:** `ee-a0er`  
**SubAgent:** `primary` (for `qa` workflow role)  
**Role:** `qa`  
**References:** `REF-06`, `REF-07`, `REF-08`  
**Prompt:** `Claim bead ee-a0er on start with bd update ee-a0er --status in_progress --json. Verify whether the faster-whisper-backed music-vocals lane now produces meaningful numeric timings and real prompt-level music-vocals support in the 76s–98s window, while preserving dialogue grounding and clean no-dialogue windows. Produce a fresh QA packet with representative prompt/artifact evidence, update the active plan, and close the bead only when the evidence packet is complete.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `output/`

**Files Created/Deleted/Modified:**
- `.plans/2026-05-06-migrate-music-vocals-timestamps-to-faster-whisper.md`
- fresh QA notes/artifacts under `output/`

**Status:** ⏳ Pending

**Results:** Pending.

---

### Task 4: Audit the faster-whisper music-vocals lane and recommend escalation if needed

**Bead ID:** `ee-pykc`  
**SubAgent:** `primary` (for `auditor` workflow role)  
**Role:** `auditor`  
**References:** `REF-01` through `REF-08`  
**Prompt:** `Claim bead ee-pykc on start with bd update ee-pykc --status in_progress --json. Independently audit the faster-whisper-backed music-vocals lane and decide whether prompt-level vocals grounding is now validated enough to continue forward, or whether we should escalate to the next fallback/redesign option. Distinguish clearly between music-vocals success/failure, preserved dialogue behavior, and any remaining cleanup work. Update the active plan with the verdict and close only when the recommendation is evidence-backed.`

**Folders Created/Deleted/Modified:**
- `.plans/`

**Files Created/Deleted/Modified:**
- `.plans/2026-05-06-migrate-music-vocals-timestamps-to-faster-whisper.md`

**Status:** ⏳ Pending

**Results:** Pending.

---

## Final Results

**Status:** ⏳ Pending

**What We Built:** Pending.

**Reference Check:** Pending.

**Commits:**
- Pending.

**Lessons Learned:** Pending.

---

*Completed on YYYY-MM-DD*
