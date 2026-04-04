# emotion-engine: dialogue prompt should include sung lyrics in the dialogue script

**Date:** 2026-04-04  
**Status:** Draft  
**Agent:** Cookie 🍪

---

## Goal

Adjust the Phase 1 dialogue prompt and validation expectations so sung lyrical vocals are intentionally included in the dialogue script output when they are part of the trailer’s audible vocal content.

---

## Overview

The fresh Xiaomi whole-asset run is now operationally stable and benchmark comparison shows the main remaining gap is concentrated in sung lyric coverage, not general parser failure. That points to a prompt-contract mismatch more than a transport or normalization problem: the model is likely treating sung vocals as non-dialogue and omitting them, which is defensible in a strict transcription sense but wrong for Peanut Gallery’s functional need.

For this tool, the Phase 1 dialogue artifact should capture audible spoken and sung vocal lines that matter to emotional/story analysis, including recognizable lyric lines and chant-like vocal hooks when they are present in the source media. The repair lane should therefore be narrow and prompt-led: explicitly redefine the Phase 1 “dialogue” task as a vocal-script extraction lane rather than a speech-only lane, update any validator wording/examples that reinforce the wrong exclusion behavior, and rerun the canonical Xiaomi config to verify lyric coverage improves without collapsing speaker/timing honesty.

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

**Results:** Claimed bead `ee-1499`, updated the owning Phase 1 dialogue prompt/contract in `server/scripts/get-context/get-dialogue.cjs`, and tightened the validator contract wording in `server/lib/phase1-validator-tools.cjs` so this lane is explicitly treated as a vocal-script extraction task rather than speech-only dialogue. The prompt is now asset-generic and explicitly tells the model to include audible spoken lines, sung lyrics, chant-like vocals, and other clearly vocalized words when they are present and relevant, while still excluding purely instrumental / non-vocal sections and only returning an empty transcript when no audible spoken or sung words are present.

Audited adjacent tool-loop / validator guidance for lyric-dropping bias and updated the focused tests accordingly. `test/scripts/get-dialogue.test.js` now asserts the new vocal-script instructions are present in the emitted prompt, and `test/lib/phase1-validator-tools.test.js` now asserts the validator contract explicitly covers audible spoken or sung words. Verified with `node --test test/scripts/get-dialogue.test.js test/lib/phase1-validator-tools.test.js` (`48` passing / `0` failing). Lane-owned changes were committed locally after tests passed; no rerun was performed in this task.

---

### Task 2: Rerun the canonical Xiaomi whole-asset config and compare lyric coverage against benchmark truth

**Bead ID:** `ee-2oio`  
**SubAgent:** `primary`  
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, rerun the canonical pipeline after Task 1 lands and after Derrick reviews the exact new prompt addition in chat: node server/run-pipeline.cjs --config configs/cod-test-xiaomi-mimo-v2-omni-openrouter-high-thinking-rerun.yaml --clean-live-digital-twin --verbose. Compare the new dialogue artifact specifically against the benchmark’s missing lyric/chant lines and summarize whether the prompt change materially improved vocal-script coverage. Keep the writeup truthful: separate lyric-coverage gains from any remaining speaker/timing drift. Update the plan with exact evidence, and if the lane is complete, commit the verification/plan update without pushing unless justified.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `.logs/`
- `output/`

**Files Created/Deleted/Modified:**
- `.plans/2026-04-04-dialogue-prompt-include-lyrics-in-script.md`
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
