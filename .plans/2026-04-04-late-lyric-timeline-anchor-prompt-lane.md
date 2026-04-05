# emotion-engine: late lyric timeline-anchor prompt lane

**Date:** 2026-04-04  
**Status:** Draft  
**Agent:** Cookie 🍪

---

## Goal

Refine the Phase 1 vocal-script prompt so later lyric lines stay anchored later in the media timeline instead of being pulled forward into early merged regions, then rerun the canonical Xiaomi config to test whether lyric timing fidelity improves.

---

## Overview

The last two prompt-led experiments proved two useful things. First, lyric omission was largely a contract problem: once we explicitly told the model to include sung vocals, the lyric block stopped disappearing. Second, segmentation is also prompt-sensitive: once we told it not to collapse audibly distinct lyric lines and refrains, the lyric block split into multiple smaller segments. But that structural win came with a timing regression — the recovered lyric lines were front-loaded much too early, starting around `34s` instead of the benchmark’s `64s+` late-entry region.

That points to the next seam: timeline anchoring for later vocal content. We should treat silence, instrumental-only spans, and music-only stretches as evidence that later lyrics belong later, not as license to shift them earlier into an approximate musically related region. The repair should stay prompt-led and generic across assets. We do not want cod-test-specific rules; we want a general instruction set for long music-backed media where later vocal lines may arrive after substantial non-vocal gaps.

---

## Tasks

### Task 1: Refine the vocal-script prompt to preserve late lyric timing anchors

**Bead ID:** `ee-zirn`  
**SubAgent:** `coder`  
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, refine the Phase 1 dialogue/vocal-script prompt so later sung/chant-like vocal lines stay anchored to when they actually occur instead of being pulled earlier into the first plausible musical region. Keep the wording generic across assets. Explicitly teach the model to respect long non-vocal gaps, instrumental stretches, and silence/music-only spans as evidence that later vocal lines belong later in the timeline. Also make it clear that later lyric lines should not be advanced earlier just because they share the same singer, melody, or section type as an earlier vocal phrase. Update focused tests if needed, update this plan with the exact prompt changes, and commit after tests pass, but do not push.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `server/scripts/get-context/`
- `test/`

**Files Created/Deleted/Modified:**
- `.plans/2026-04-04-late-lyric-timeline-anchor-prompt-lane.md`
- `server/scripts/get-context/get-dialogue.cjs`
- `test/scripts/get-dialogue.test.js`

**Status:** ✅ Complete

**Results:** Updated the Phase 1 whole-asset and chunked dialogue/vocal-script prompts in `server/scripts/get-context/get-dialogue.cjs` with generic timeline-anchoring guidance for later sung/chant-like vocals. Added these exact prompt lines in both prompt variants:
- `Treat long non-vocal gaps, instrumental stretches, and silence/music-only spans as timeline evidence that later vocal lines belong later; keep those gaps instead of bridging across them.`
- `Do not move a later lyric line earlier just because it appears to share the same singer, melody, hook, or section type as an earlier vocal phrase.`

Also updated `test/scripts/get-dialogue.test.js` to assert the new prompt wording for both whole-asset and chunked transcription prompts. Verification: `node --test test/scripts/get-dialogue.test.js` ✅ (36/36 passing). Scoped note: `npm test -- test/scripts/get-dialogue.test.js` expands to the full suite via `package.json` and surfaced an unrelated pre-existing failure in `test/lib/script-contract.test.js` (`executeScript performs one bounded AI recovery re-entry for eligible AI lanes`, expected `2`, got `1`). Committed locally after the focused test passed; no rerun performed and no push made.

---

### Task 2: Post the exact prompt refinement in chat before rerun

**Bead ID:** `Pending`  
**SubAgent:** `primary`  
**Prompt:** `Post the exact new prompt addition or changed wording into chat for Derrick to review before any rerun. Do not rerun until Derrick approves the wording.`

**Folders Created/Deleted/Modified:**
- `.plans/`

**Files Created/Deleted/Modified:**
- `.plans/2026-04-04-late-lyric-timeline-anchor-prompt-lane.md`

**Status:** ⏳ Pending

**Results:** Pending.

---

### Task 3: Rerun and compare late lyric timing against benchmark truth

**Bead ID:** `ee-laue`  
**SubAgent:** `primary`  
**Prompt:** `After Derrick approves the new prompt wording, rerun the canonical Xiaomi whole-asset config and compare the recovered lyric block against benchmark truth with special focus on timeline placement. Measure whether later lyric lines and the preorder tail remain too early or move closer to their true late positions. Distinguish clearly between timing-anchor gains, any segmentation regressions, and any wording/speaker drift that still remains. Update the plan truthfully and commit the verification writeup without pushing unless justified.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `.logs/`
- `output/`

**Files Created/Deleted/Modified:**
- `.plans/2026-04-04-late-lyric-timeline-anchor-prompt-lane.md`
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
