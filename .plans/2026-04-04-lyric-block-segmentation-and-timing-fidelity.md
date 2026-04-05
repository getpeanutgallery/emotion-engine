# emotion-engine: lyric block segmentation and timing fidelity

**Date:** 2026-04-04  
**Status:** Draft  
**Agent:** Cookie 🍪

---

## Goal

Improve the Phase 1 vocal-script prompt so sung lyric regions are not merely included, but segmented into separate line-level vocal events with more faithful timing and less collapse into oversized merged blocks.

---

## Overview

The last prompt change proved that lyric omission was largely a prompt-contract problem: once the model was told to include sung vocals, the previously missing lyric/chant region reappeared. But the recovered region arrived as one oversized merged block with wording drift, which means the current prompt still under-specifies how lyrical vocals should be segmented and timestamped.

The next lane should stay prompt-led and narrow. We do not need another parser or infrastructure rewrite first. The likely improvement is to teach the model that vocal-script extraction should preserve line boundaries and refrain/chant repetition boundaries when they are audibly distinct, instead of compressing a sung run into a summary blob. We should also tighten timestamp guidance for sung vocals so lyric lines are placed where they actually occur, even when the delivery is rhythmic or music-backed.

---

## Tasks

### Task 1: Refine the vocal-script prompt for lyric segmentation and timing fidelity

**Bead ID:** `ee-woum`  
**SubAgent:** `coder`  
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, refine the Phase 1 dialogue/vocal-script prompt so sung lyric regions are segmented more faithfully instead of being collapsed into oversized merged blocks. Keep the wording generic across assets. Emphasize that sung lines, chant-like hooks, and repeated refrains should be broken into separate dialogue_segments when they are audibly distinct in wording, timing, or delivery, and that timestamps should follow when each vocal line actually occurs in the media. Avoid overfitting to cod-test wording. Update focused tests if needed, update this plan with the exact prompt changes, and commit after tests pass, but do not push.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `server/scripts/get-context/`
- `test/`

**Files Created/Deleted/Modified:**
- `.plans/2026-04-04-lyric-block-segmentation-and-timing-fidelity.md`
- `server/scripts/get-context/get-dialogue.cjs`
- `test/scripts/get-dialogue.test.js`

**Status:** ✅ Complete

**Results:** Narrow prompt-only update landed in `server/scripts/get-context/get-dialogue.cjs` for both whole-file and chunk transcription prompts, plus aligned validator-tool final artifact rules in that same file. The prompt now explicitly tells Phase 1 not to collapse audibly distinct sung lyric lines / chant-like hooks / repeated refrains into one oversized block, to split them into separate `dialogue_segments` when wording, timing, pauses, repetition, or delivery are audibly distinct, and to avoid pulling later lyric lines earlier to cover a larger musical region. Focused assertions were added in `test/scripts/get-dialogue.test.js` for both whole-file and chunk prompt variants. Focused test run: `node --test test/scripts/get-dialogue.test.js` → 36 tests passed, 0 failed. Commit: `Pending` until this task is finalized.

Exact prompt additions for whole-file mode:
- `For sung material, do not collapse multiple audibly distinct lyric lines, chant-like hooks, or repeated refrains into one oversized segment.`
- `Break sung or chant-like vocals into separate dialogue_segments whenever wording, timing, pauses, repetition, or delivery are audibly distinct.`
- `Do not compress the whole file's dialogue into the opening seconds or pull later lyric lines earlier to cover a larger musical region; place each line where it actually occurs in the full timeline.`

Exact prompt additions for chunk mode:
- `For sung material, do not collapse multiple audibly distinct lyric lines, chant-like hooks, or repeated refrains into one oversized segment.`
- `Break sung or chant-like vocals into separate dialogue_segments whenever wording, timing, pauses, repetition, or delivery are audibly distinct.`
- `Do not compress the whole chunk's dialogue into the opening seconds or pull later lyric lines earlier to cover a larger musical region; spread timestamps across the actual chunk timeline where lines occur.`

---

### Task 2: Review exact prompt wording in chat before rerun

**Bead ID:** `Pending`  
**SubAgent:** `primary`  
**Prompt:** `Post the exact new prompt addition or changed wording into chat for Derrick to review before any rerun. Do not rerun until Derrick approves the wording.`

**Folders Created/Deleted/Modified:**
- `.plans/`

**Files Created/Deleted/Modified:**
- `.plans/2026-04-04-lyric-block-segmentation-and-timing-fidelity.md`

**Status:** ⏳ Pending

**Results:** Pending.

---

### Task 3: Rerun and compare lyric segmentation against benchmark truth

**Bead ID:** `ee-dsqz`  
**SubAgent:** `primary`  
**Prompt:** `After Derrick approves the new prompt wording, rerun the canonical Xiaomi whole-asset config and compare the lyric block against benchmark truth. Focus on whether merged sung-vocal blocks split into more benchmark-faithful segments, whether timestamps improve, and whether any new regressions appear. Update the plan truthfully and commit the verification writeup without pushing unless justified.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `.logs/`
- `output/`

**Files Created/Deleted/Modified:**
- `.plans/2026-04-04-lyric-block-segmentation-and-timing-fidelity.md`
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
