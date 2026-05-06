# Peanut Gallery Emotion Engine

**Date:** 2026-05-06  
**Status:** Complete  
**Agent:** Cookie 🍪

---

## Goal

Audit why the current `music-vocals` timestamp lane still produces recognized lyric segments without usable numeric timings, then implement and verify the narrowest fix that makes Phase 2 prompts emit real chunk-local `music-vocals` support in the 76s–98s music-heavy window.

---

## Overview

The dialogue grounding slice is now human-verified enough to leave behind. The remaining blocker in the grounding system is the `music-vocals` lane: the patched bounded rerun successfully emitted `music-vocals-timestamps-data.reconciled.json`, and song recognition is strong (`Master of Puppets`, confidence `0.93`), but all `11/11` vocal segments still remain unresolved for prompt-usable timing. That is why Phase 2 prompts still show `0/28` `Global Music Vocals Context` sections even though the artifact exists.

This next lane should start with audit, not immediate broad implementation. We need to trace where the failure really lives: lyric timestamp derivation, reconciliation behavior, upstream segmentation quality, or downstream prompt-consumption rules. Once we know the actual failure seam, the coder lane should implement the narrowest durable fix that yields numeric timing on a meaningful subset of the vocal segments without regressing the already-validated dialogue behavior.

Success should be measured in product terms, not only artifact existence. The key test is whether a rerun produces real prompt-level vocals context in the music-heavy `76s–98s` region while preserving clean dialogue/no-dialogue behavior elsewhere. After implementation, the normal QA → audit loop should confirm prompt-level effect, not just internal artifact changes.

---

## REFERENCES

| ID | Description | Path |
| --- | --- | --- |
| `REF-01` | Latest validated dialogue-fix plan and audit outcome | `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/.plans/2026-05-06-fix-dialogue-placeholder-leak-and-prompt-heading.md` |
| `REF-02` | Patched bounded rerun plan showing dialogue success and music-vocals gap | `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/.plans/2026-05-06-patch-bounded-phase2-rerun-to-include-timestamps.md` |
| `REF-03` | Current music-vocals timestamp artifact with unresolved rows | `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/output/cod-test-phase2-only-retest-2026-05-06-with-timestamps/phase1-gather-context/music-vocals-timestamps-data.reconciled.json` |
| `REF-04` | QA packet showing `0/28` prompt-level music-vocals sections | `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/output/cod-test-phase2-only-retest-qa-2026-05-06-0944-with-timestamps/qa-summary.md` |
| `REF-05` | Detailed QA evidence JSON for the patched rerun | `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/output/cod-test-phase2-only-retest-qa-2026-05-06-0944-with-timestamps/chunk-grounding-rerun-evidence.json` |
| `REF-06` | Current music-vocals timestamp script | `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/server/scripts/get-context/get-music-vocals-timestamps.cjs` |
| `REF-07` | Current music-vocals source script | `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/server/scripts/get-context/get-music-vocals.cjs` |
| `REF-08` | Phase 2 chunk grounding implementation | `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/server/scripts/process/video-chunks.cjs` |

---

## Tasks

### Task 1: Audit the current music-vocals timing failure seam

**Bead ID:** `ee-ksmq`  
**SubAgent:** `primary` (for `research` workflow role)  
**Role:** `research`  
**References:** `REF-02`, `REF-03`, `REF-04`, `REF-05`, `REF-06`, `REF-07`, `REF-08`  
**Prompt:** `Claim bead ee-ksmq on start with bd update ee-ksmq --status in_progress --json. Trace why the current music-vocals lane emits recognized lyric segments but no usable numeric timings. Identify whether the failure is in source segmentation, timestamp derivation, reconciliation, or prompt-consumption rules, and leave the coder lane with an unambiguous root-cause statement plus the narrowest safe fix direction.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- read-only inspection of `server/` and `output/`

**Files Created/Deleted/Modified:**
- `.plans/2026-05-06-audit-and-fix-music-vocals-timestamp-lane.md`

**Status:** ✅ Complete

**Results:** Root cause is now pinned to the timestamp-alignment handoff, not to song recognition and not primarily to Phase 2 prompt selection.

**Simple explanation:**
- The music-vocals lane correctly recognizes the song and extracts lyric text.
- But the timestamp rerun never generates numeric `start`/`end` times for those lyric segments.
- The downstream timestamp-derivation code expects timed alignment segments; because it gets none, it marks all 11/11 lyric segments unresolved.
- Phase 2 then has no overlapping timed music-vocals segments to inject, which explains the observed 0/28 prompt emissions.

**Technical findings:**
- `get-music-vocals-timestamps.cjs` calls `get-music-vocals.cjs` with `preserveSegmentTiming: true`, intending to create a timed alignment artifact.
- But the chunk prompt/schema in `get-music-vocals.cjs` only asks for `index/text/confidence/performer/delivery`; it does **not** ask for per-segment timing fields.
- The collected alignment artifact therefore contains 11 lyric segments and **0 timed segments** (`music-vocals-data.json` has `hasVocals: true` but no segment-level `start`/`end`).
- `buildMusicVocalsTimestampArtifact()` then calls `deriveMusicVocalsSegmentTimings()`, which filters alignment segments to only those with finite `start` and `end`. That leaves an empty alignment pool, so every segment stays `timing.status: unresolved`.
- The reconciled timestamp artifact confirms this exact failure mode: all 11 segments unresolved with zero timing confidence.
- `video-chunks.cjs` then attempts timed overlap selection for `musicVocalsTimestampsData`; because no segments overlap numerically, chunk grounding falls through with `timestamp_artifact_present_but_no_overlapping_timed_music_vocals`, producing no prompt-level music-vocals context.
- Secondary symptom worth noting: the final `music-vocals-data.json` summary is stale/inconsistent (`summary: "No text-bearing music-led vocals detected in this chunk."` while `hasVocals: true` and 11 segments exist). That is confusing, but it is not the main blocker.

**Recommended options (decision-ready):**

1. **Recommended / narrowest:** make the timestamp rerun emit coarse per-segment timing ranges directly during chunk analysis.
   - **What changes:** Extend the music-vocals chunk schema/prompt so each emitted `vocal_segment` can carry bounded `start`/`end` values within its chunk window (or an equivalent local timing form that is converted to global times). Preserve the current lyric-text behavior; only add timing capture.
   - **Why it should work:** The derivation stage is already wired to consume timed alignment segments. If the rerun finally provides numeric segment windows, `deriveMusicVocalsSegmentTimings()` will have real candidates instead of an empty pool, and Phase 2 overlap selection can start working immediately.
   - **Tradeoffs / risks:** Sung timing is fuzzy, especially on repeated hooks and dialogue overlap, so some segments will likely remain partial/unresolved. Prompt/validator changes are needed, but scope stays local to the music-vocals timing path.
   - **Scope:** Narrow.

2. **Fallback / even narrower but lower quality:** infer coarse timings from chunk membership without asking the model for exact per-line timing.
   - **What changes:** When a chunk-level music-vocals result is accepted, attach each returned lyric segment to that chunk’s global window (for example full-chunk bounds, or a simple deterministic subdivision within the chunk) so `musicVocalsData` gains usable numeric ranges.
   - **Why it should work:** This bypasses the current empty-alignment failure entirely and will let `video-chunks.cjs` surface music-vocals context for the right windows, even if the timings are only approximate.
   - **Tradeoffs / risks:** Lower fidelity. Repeated hooks inside the same chunk may be poorly localized, and broad windows could over-inject vocals context into neighboring subchunks.
   - **Scope:** Very narrow, but intentionally approximate.

3. **Broader / more durable:** replace the current lyric-to-lyric derivation with chunk-anchored reconciliation as the primary timing source.
   - **What changes:** Treat the timed unit as the analyzed chunk first, then reconcile source lyric segments onto chunk windows using recognized song hints and text matching, instead of pretending the current rerun is a segment-timed alignment pass.
   - **Why it should work:** It matches what the system actually knows today: chunk membership is real, exact sung line boundaries are not. This would make the lane structurally honest and robust against repeated hooks.
   - **Tradeoffs / risks:** Larger refactor across derivation and consumption assumptions. More testing needed. Not the fastest path if the immediate goal is just to restore prompt grounding in the bounded rerun.
   - **Scope:** Broader.

**Recommendation:** choose Option 1 if the goal is the best narrow fix with believable timings. Choose Option 2 only if the immediate priority is fast recovery of prompt-level music-vocals grounding and coarse timing is acceptable. I do **not** recommend starting with Option 3 unless we already expect to redesign this lane beyond the current bounded fix.

**Evidence checked:**
- `server/scripts/get-context/get-music-vocals-timestamps.cjs`
- `server/scripts/get-context/get-music-vocals.cjs`
- `server/lib/phase1-timestamp-derivation.cjs`
- `server/scripts/process/video-chunks.cjs`
- `output/cod-test-phase2-only-retest-2026-05-06-with-timestamps/phase1-gather-context/music-vocals-data.json`
- `output/cod-test-phase2-only-retest-2026-05-06-with-timestamps/phase1-gather-context/music-vocals-data.reconciled.json`
- `output/cod-test-phase2-only-retest-2026-05-06-with-timestamps/phase1-gather-context/music-vocals-timestamps-data.reconciled.json`
- raw chunk captures under `output/.../phase1-gather-context/raw/ai/music-vocals-*`.

---

### Task 2: Implement the narrowest music-vocals timing fix

**Bead ID:** `Pending`  
**SubAgent:** `primary` (for `coder` workflow role)  
**Role:** `coder`  
**References:** `REF-03`, `REF-06`, `REF-07`, `REF-08`  
**Prompt:** `Claim the assigned bead on start. Implement the narrowest durable fix that makes a meaningful subset of music-vocals segments acquire usable numeric timings and flow into the bounded Phase 2 prompt path, while preserving the already-validated dialogue behavior. Add or update targeted tests, document exact changes, and commit/push by default before QA.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `server/`
- `test/`

**Files Created/Deleted/Modified:**
- `.plans/2026-05-06-audit-and-fix-music-vocals-timestamp-lane.md`
- relevant implementation/test files under `server/` and `test/`

**Status:** ⏳ Pending

**Results:** Pending.

---

### Task 3: QA the patched music-vocals lane in a bounded Phase 2 rerun

**Bead ID:** `Pending`  
**SubAgent:** `primary` (for `qa` workflow role)  
**Role:** `qa`  
**References:** `REF-03`, `REF-04`, `REF-05`, `REF-08`  
**Prompt:** `Claim the assigned bead on start. Verify whether the patched lane now produces real prompt-level music-vocals context in the 76s–98s music-heavy window, while preserving healthy dialogue grounding and clean no-dialogue windows. Produce a fresh QA packet with representative prompt evidence, update the active plan, and close the bead only when the evidence packet is complete.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `output/`

**Files Created/Deleted/Modified:**
- `.plans/2026-05-06-audit-and-fix-music-vocals-timestamp-lane.md`
- fresh QA notes/artifacts under `output/`

**Status:** ⏳ Pending

**Results:** Pending.

---

### Task 4: Audit the music-vocals fix and decide the next cleanup lane

**Bead ID:** `Pending`  
**SubAgent:** `primary` (for `auditor` workflow role)  
**Role:** `auditor`  
**References:** `REF-01` through `REF-08`  
**Prompt:** `Claim the assigned bead on start. Independently audit the patched music-vocals timing lane and decide whether prompt-level vocals grounding is now validated enough to move on. Distinguish clearly between music-vocals success/failure, preserved dialogue behavior, and any remaining cleanup work. Update the active plan with the verdict and close only when the recommendation is evidence-backed.`

**Folders Created/Deleted/Modified:**
- `.plans/`

**Files Created/Deleted/Modified:**
- `.plans/2026-05-06-audit-and-fix-music-vocals-timestamp-lane.md`

**Status:** ⏳ Pending

**Results:** Pending.

---

## Final Results

**Status:** ⚠️ Superseded

**What We Built:** Completed a decision memo that traced the old rerun-alignment failure seam and narrowed the viable next moves. The plan itself was intentionally superseded once Derrick chose the faster-whisper migration lane instead of implementing one of the abstract fallback options directly.

**Reference Check:** Root-cause audit complete; implementation work moved to `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/.plans/2026-05-06-migrate-music-vocals-timestamps-to-faster-whisper.md`.

**Commits:**
- None. This plan was a decision/audit handoff only.

**Lessons Learned:** The original music-vocals failure was the old rerun-alignment handoff, not prompt consumption. Once that was clear, faster-whisper became the right next experiment before broader fallbacks.

---

*Completed on 2026-05-06*
