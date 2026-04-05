# emotion-engine: dialogue prompt should include sung lyrics in the dialogue script

**Date:** 2026-04-04  
**Status:** Complete  
**Agent:** Cookie 🍪

---

## Goal

Adjust the Phase 1 dialogue prompt and validation expectations so sung lyrical vocals are intentionally included in the dialogue script output when they are part of the trailer’s audible vocal content.

---

## Overview

The fresh Xiaomi whole-asset run was operationally stable, and prior benchmark work showed the main remaining gap was concentrated in sung lyric coverage rather than parser survival. That pointed to a prompt-contract mismatch more than a transport problem: the model was likely treating sung vocals as non-dialogue and omitting them.

For this tool, the Phase 1 dialogue artifact should capture audible spoken and sung vocal lines that matter to emotional/story analysis, including recognizable lyric lines and chant-like vocal hooks when they are present. This repair lane therefore stayed narrow and prompt-led: redefine the Phase 1 “dialogue” task as a vocal-script extraction lane rather than a speech-only lane, update validator wording that could bias the model toward dropping lyrics, and rerun the canonical Xiaomi config to verify lyric coverage improves without overstating remaining timing or speaker honesty.

---

## Tasks

### Task 1: Update the dialogue prompt/contract to explicitly include sung lyrical vocals

**Bead ID:** `ee-1499`  
**SubAgent:** `coder`  
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, update the Phase 1 dialogue prompt/contract so sung lyrical vocals are intentionally included in the dialogue script output when they are audible and relevant to the trailer. Keep the wording generic across assets. Make it clear that the output should capture vocalized content, not just spoken dialogue, while still excluding purely instrumental/non-vocal sections. Audit any validator/tool-loop wording or examples that might bias the model toward dropping lyrics, and update focused tests if needed. Claim the assigned bead on start and close it on completion with an explicit reason. Commit after tests pass, but do not push.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `server/scripts/get-context/`
- `server/lib/`
- `test/`

**Files Created/Deleted/Modified:**
- `.plans/2026-04-04-dialogue-prompt-include-lyrics-in-script.md`
- `server/scripts/get-context/get-dialogue.cjs`
- `server/lib/phase1-validator-tools.cjs`
- `test/scripts/get-dialogue.test.js`
- `test/lib/phase1-validator-tools.test.js`

**Status:** ✅ Complete

**Results:** Claimed bead `ee-1499`, updated the Phase 1 dialogue prompt/contract in `server/scripts/get-context/get-dialogue.cjs`, and tightened the validator contract wording in `server/lib/phase1-validator-tools.cjs` so this lane is explicitly treated as a vocal-script extraction task rather than speech-only dialogue. The prompt is now asset-generic and explicitly tells the model to include audible spoken lines, sung lyrics, chant-like vocals, and other clearly vocalized words when they are present and relevant, while still excluding purely instrumental / non-vocal sections and only returning an empty transcript when no audible spoken or sung words are present.

Focused tests were updated and verified with `node --test test/scripts/get-dialogue.test.js test/lib/phase1-validator-tools.test.js` (`48` passing / `0` failing). Lane-owned changes were committed locally after tests passed; no rerun was performed in this task.

---

### Task 2: Rerun the canonical Xiaomi whole-asset config and compare lyric coverage against benchmark truth

**Bead ID:** `ee-2oio`  
**SubAgent:** `primary`  
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, rerun the canonical pipeline after Task 1 lands and after Derrick reviews the exact new prompt addition in chat: node server/run-pipeline.cjs --config configs/cod-test-xiaomi-mimo-v2-omni-openrouter-high-thinking-rerun.yaml --clean-live-digital-twin --verbose. Compare the new dialogue artifact specifically against the benchmark’s missing lyric/chant lines and summarize whether the prompt change materially improved vocal-script coverage. Keep the writeup truthful: separate lyric-coverage gains from any remaining speaker/timing drift. Update the plan with exact evidence, and if the lane is complete, commit the verification/plan update without pushing unless justified.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `output/`

**Files Created/Deleted/Modified:**
- `.plans/2026-04-04-dialogue-prompt-include-lyrics-in-script.md`
- `output/cod-test-xiaomi-mimo-v2-omni-openrouter-high-thinking-rerun/phase1-gather-context/dialogue-data.json`
- `output/cod-test-xiaomi-mimo-v2-omni-openrouter-high-thinking-rerun/phase1-gather-context/music-data.json`
- `output/cod-test-xiaomi-mimo-v2-omni-openrouter-high-thinking-rerun/phase2-process/whole-video-analysis.json`
- `output/cod-test-xiaomi-mimo-v2-omni-openrouter-high-thinking-rerun/_meta/events.jsonl`

**Status:** ✅ Complete

**Results:** Claimed bead `ee-2oio` and reran the canonical lane exactly as requested:

`node server/run-pipeline.cjs --config configs/cod-test-xiaomi-mimo-v2-omni-openrouter-high-thinking-rerun.yaml --clean-live-digital-twin --verbose`

The rerun completed successfully with `exit 0`. Phase 1 wrote a fresh dialogue artifact to `output/cod-test-xiaomi-mimo-v2-omni-openrouter-high-thinking-rerun/phase1-gather-context/dialogue-data.json` and this run persisted `18` dialogue segments, down from the prior `20`-segment Xiaomi artifact documented in `.plans/2026-04-04-compare-fresh-xiaomi-run-vs-human-dialogue-benchmark.md`.

Benchmark-focused lyric/chant comparison:
- The prior 20-segment artifact had the entire benchmark lyric/chant block effectively missing: benchmark lines 14-21, 27, and 29 (`Obey your master.`, `Control faster.`, `Master of puppets...`, `Twisting your mind...`, `Blinded by me...`, `Just call my name...`, `Master, master... where’s the dreams...`, `Master, master... you promised only lies!`, `Obey your master!`, `Master, master`) were all absent from the saved dialogue JSON.
- The fresh rerun now includes a large merged sung-vocal segment at `40-80s` on `spk_007` containing recognizable lyric/chant material that was previously missing from the artifact, including `Obey your master`, repeated `Master, master` refrains, and `Just call my name, 'cause I'll hear you scream`.
- That means the prompt change **did materially improve vocal-script coverage**: the lyric region is no longer wholly dropped from the saved dialogue artifact, and the run now preserves a real sung-vocal block instead of treating that stretch as missing dialogue.

Remaining truthfulness caveats that should not be blurred together with the lyric gain:
- The lyric recovery is **not benchmark-faithful**. The newly recovered material is collapsed into one oversized `40-80s` segment instead of the benchmark’s spread of discrete chant/lyric lines from roughly `64-98s`, plus later refrain returns at `116-118s` and `127-130s`.
- Several benchmark lyric lines remain absent or are replaced with different / invented wording. The fresh artifact does **not** cleanly recover `Master of puppets are pulling the strings!`, `Twisting your mind, smashing your dreams!`, `Blinded by me, you can’t see a thing`, `Master, master, where’s the dreams that I’ve been after?`, or `Master, master, you promised only lies!` as benchmark-equivalent lines.
- The recovered lyric block also introduces obvious wording drift inside the chant lane (`Come crawling faster`, `Here I am, come and take me by the hand`, `The path is set, you're in my hands`, `I live inside you, you live inside me`, `You'll never see me, but I'm always there`), so this is better understood as partial vocal-script recovery rather than accurate lyric transcription.
- Speaker/timing honesty still lags badly. The chant block is all merged onto one speaker bucket and pulled much earlier than benchmark truth, while later spoken lines such as `This isn't real.`, `The hell it isn't!`, `Pull it together, man!`, `No more games. This ends now.`, and the Reznov promo still drift materially in timing versus benchmark placement.
- Spoken-line quality outside the lyric lane also remains mixed: the rerun still mishears `So eager to leave daddy.` as `So eager to leave, David.` and keeps broader speaker continuity rough.

Bottom line for Task 2: the prompt-only change appears to have succeeded at the narrow thing it was trying to do — **get the model to include sung / chanted vocals in the dialogue artifact instead of dropping that region altogether**. But it did **not** solve the harder downstream problems of line splitting, exact lyric accuracy, timestamp placement, or speaker continuity. So the truthful conclusion is: **material lyric-coverage improvement, but still substantial speaker/timing drift and only partial benchmark-equivalent lyric recovery.**

---

## Final Results

**Status:** ✅ Complete

**What We Built:** A narrow prompt/validator contract update that explicitly treats Phase 1 dialogue as vocal-script extraction, plus a clean-live verification rerun showing the saved Xiaomi dialogue artifact now includes a substantial lyric/chant block that the prior 20-segment artifact had omitted. The lane proved a real lyric-coverage gain, while also documenting that exact lyric fidelity, timestamp alignment, and speaker continuity still need follow-up.

**Commits:**
- `a313e94` - Include sung vocals in dialogue prompt contract
- Local verification-plan update committed in this lane (`git log --oneline -n 1` at handoff time shows the current hash).

**Lessons Learned:** Prompt-contract framing matters: explicitly allowing sung vocals changed the model’s inclusion behavior enough to recover a missing chant/lyric region. But recovery at the inclusion layer is not the same as transcription truth. Future work should treat (1) vocal presence/coverage, (2) exact lyric wording, and (3) speaker/timing alignment as separate quality axes rather than assuming one prompt fix solves all three.

---

*Completed on 2026-04-04*