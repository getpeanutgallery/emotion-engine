# emotion-engine: lyric block segmentation and timing fidelity

**Date:** 2026-04-04  
**Status:** Complete  
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

**Status:** ✅ Complete

**Results:** Derrick reviewed the exact wording in chat and approved proceeding with the rerun, so this gating step was satisfied before Task 3 execution.

---

### Task 3: Rerun and compare lyric segmentation against benchmark truth

**Bead ID:** `ee-dsqz`  
**SubAgent:** `primary`  
**Prompt:** `After Derrick approves the new prompt wording, rerun the canonical Xiaomi whole-asset config and compare the lyric block against benchmark truth. Focus on whether merged sung-vocal blocks split into more benchmark-faithful segments, whether timestamps improve, and whether any new regressions appear. Update the plan truthfully and commit the verification writeup without pushing unless justified.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `output/`

**Files Created/Deleted/Modified:**
- `.plans/2026-04-04-lyric-block-segmentation-and-timing-fidelity.md`
- `output/cod-test-xiaomi-mimo-v2-omni-openrouter-high-thinking-rerun/phase1-gather-context/dialogue-data.json`
- related rerun artifacts under `output/cod-test-xiaomi-mimo-v2-omni-openrouter-high-thinking-rerun/`

**Status:** ✅ Complete

**Results:** Reran the canonical pipeline exactly with `node server/run-pipeline.cjs --config configs/cod-test-xiaomi-mimo-v2-omni-openrouter-high-thinking-rerun.yaml --clean-live-digital-twin --verbose` and the pipeline completed successfully (exit 0). Fresh Phase 1 dialogue artifact: `output/cod-test-xiaomi-mimo-v2-omni-openrouter-high-thinking-rerun/phase1-gather-context/dialogue-data.json`. Pre-refinement comparison artifact used as baseline: `output/_archives/cod-test-xiaomi-mimo-v2-omni-openrouter-high-thinking-rerun-pre-ee-x0g9-2026-04-04-103401/phase1-gather-context/dialogue-data.json`. Benchmark truth used for evaluation: `benchmarks/fixtures/cod-test/truth/dialogue-data.json`.

Lyric-segmentation result versus the prior lyric-inclusion rerun is clearly improved structurally: the old oversized merged sung-vocal block at pre-rerun segment 14 (`42-50s`: `Obey your master, master. Come crawling faster, faster. Master, master.`) is no longer one blob. The fresh rerun splits that region into multiple smaller segments:
- `34-36s` `Obey your master, master.`
- `36.5-38s` `Come crawling faster.`
- `38.5-42s` `Master of puppets, I'm pulling your strings.`
- `42.5-45s` `Twisting your mind and smashing your dreams.`
- `45.5-48s` `Blinded by me, you can't see a thing.`
- `48.5-51s` `Just call my name, 'cause I'll hear you scream.`
- `51.5-52.5s` `Master, master.`
- `53-55s` `Just call my name, 'cause I'll hear you scream.`
- `55.5-56.5s` `Master, master.`

Against benchmark truth, this is a real segmentation win: several benchmark lyric lines that were previously swallowed into one merged block are now represented as distinct segments, and the model now surfaces recognizable versions of benchmark lines 14-19 instead of collapsing them into a single chant summary. However, the timestamps are not improved. The lyric cluster is pulled far too early relative to benchmark (fresh lyric region begins around `34s`, while benchmark lyric material does not begin until `64s` and major sung lines run through `98s`). This is materially worse than the pre-refinement rerun, whose merged lyric block at least sat closer to the right neighborhood (`42-50s`).

New regressions / remaining failures:
- **Severe early compression:** dialogue after the opening is now consistently placed much too early, with the benchmark lyric block shifted earlier by roughly `30s`.
- **Coverage remains incomplete/inaccurate:** benchmark lines 20-21 (`Master, master, where’s the dreams...` / `you promised only lies!`) are still not recovered. Instead the rerun repeats `Just call my name...` and `Master, master.`
- **Text fidelity drift remains:** `Master of puppets are pulling the strings!` becomes `Master of puppets, I'm pulling your strings.`; `So eager to leave daddy.` becomes `So eager to leave, David.`; `Killing the man ... killing the idea.` becomes `Killing a man ... killing an idea.`
- **Tail remains early:** the preorder line lands at `71.5-74s` instead of the benchmark `122-124s`.

Bottom line: the prompt refinement succeeded at the narrow segmentation goal but exposed / worsened timeline placement. The fresh result is more benchmark-faithful in line splitting inside the lyric block, but substantially less benchmark-faithful in timestamp alignment, and it still introduces lyrical substitution/repetition errors.

---

## Final Results

**Status:** ⚠️ Partial

**What We Built:** A prompt-only lyric-segmentation refinement plus a verified canonical rerun record. The rerun proves the refined prompt can break the previously oversized merged sung-vocal block into multiple line-level dialogue segments that more closely mirror benchmark lyric boundaries. But the same rerun also shows that timestamp fidelity regressed sharply: the lyric region is now dragged much earlier than the benchmark timeline, several lyric lines are still substituted or repeated, and late-scene dialogue remains badly compressed forward.

**Commits:**
- `docs: record lyric segmentation rerun findings` (verification writeup commit; see current git history for final hash)

**Lessons Learned:** Prompting can improve structural segmentation without improving timeline anchoring. For this lane, lyric inclusion and lyric splitting are no longer the dominant blockers; timestamp placement / runtime anchoring is. Future work should preserve the new anti-merge behavior while specifically constraining sung-vocal timestamps to the actual later-occurring region instead of letting the model front-load the recovered lyrics.

---

*Completed on 2026-04-04*
