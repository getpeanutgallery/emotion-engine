# emotion-engine: Xiaomi runtime-anchored dialogue prompt experiment

**Date:** 2026-04-04
**Status:** In Progress
**Agent:** Cookie 🍪

---

## Goal

Test whether a generic runtime-anchored whole-asset dialogue prompt makes Xiaomi MiMo preserve full file duration correctly and capture any late sparse dialogue/vocal tail without introducing asset-specific content bias.

---

## Overview

The prior audit concluded the current whole-asset Xiaomi/OpenRouter dialogue lane is most likely failing because the upstream model is weakly grounded on long-form audio timing, with two local contract gaps that make that weakness easier to surface: the prompt does not anchor the model to the measured runtime, and the validator does not reject partial duration claims. The smallest next experiment is therefore prompt-only, not a validator rewrite.

This tranche will add a **generic runtime anchor** to the whole-asset dialogue prompt contract. The language must stay asset-agnostic: no trailer-, gameplay-, military-, COD-, montage-, DLC-, or lyric-specific hints. The change should only clarify that `totalDuration` must reflect the attached file runtime, that sparse/non-speech tails do not mean the file ended early, and that spoken-content coverage should remain honest. Then we will rerun the same clean-live Xiaomi/OpenRouter config and compare whether the model still stops around the DLC-adjacent line / `121s`, or whether it now carries timing and late-tail behavior more truthfully.

---

## Tasks

### Task 1: Implement generic runtime anchoring in the whole-asset dialogue prompt contract

**Bead ID:** `ee-ifcy`
**SubAgent:** `coder`
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, implement the smallest prompt-only experiment for the Xiaomi whole-asset dialogue lane. Add a generic runtime anchor to the whole-asset dialogue prompt contract so the model is told the exact measured attached-audio runtime and instructed that totalDuration must reflect the full attached runtime rather than an estimate. Keep the language universal and asset-agnostic: do not mention trailers, gameplay, military themes, COD, montage, DLC, specific lines, or expected content. Also clarify that sparse/non-speech tails or intermittent end-of-file vocals do not imply the file ended early, while spoken-dialogue coverage should still remain honest. Update/add tests if prompt-contract coverage exists. Claim bead ee-ifcy on start with bd update ee-ifcy --status in_progress --json and close it on completion with bd close ee-ifcy --reason "Implemented generic runtime anchoring for Xiaomi whole-asset dialogue prompt" --json. Commit your changes after tests pass, but do not push.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `server/scripts/get-context/`
- `test/scripts/`

**Files Created/Deleted/Modified:**
- `.plans/2026-04-04-xiaomi-runtime-anchored-dialogue-prompt-experiment.md`
- `server/scripts/get-context/get-dialogue.cjs`
- `test/scripts/get-dialogue.test.js`

**Status:** ✅ Complete

**Results:** Added a prompt-only runtime anchor to the whole-asset dialogue transcription prompt so the model is explicitly told the exact measured attached-audio runtime (`transportPreflight.durationSeconds`) and instructed to set `totalDuration` to the full attached runtime instead of estimating from speech coverage or the last spoken line. The new language stays universal/asset-agnostic and also clarifies that silence, ambience, music-only tails, sparse non-speech endings, or intermittent end-of-file vocals do not mean the asset ended early, while spoken-dialogue coverage must still remain honest. No validator strictness changes were made. Updated prompt-contract coverage in `test/scripts/get-dialogue.test.js` to assert the runtime anchor and tail-honesty instructions. Verified with `node --test test/scripts/get-dialogue.test.js` (35/35 passing).

---

### Task 2: Run clean-live Xiaomi rerun and compare tail/duration behavior

**Bead ID:** `ee-g2rp`
**SubAgent:** `primary`
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, verify the runtime-anchored prompt experiment by running the canonical clean-live Xiaomi/OpenRouter whole-asset rerun using configs/cod-test-xiaomi-mimo-v2-omni-openrouter-high-thinking-rerun.yaml with --clean-live-digital-twin --verbose. Compare the new artifact against the prior honest baseline. Determine whether the model still stops around 121s / the DLC-adjacent line, whether it now preserves full runtime more accurately, and whether any late sparse dialogue/vocal tail is recovered. Keep the analysis asset-observational, not prompt-prescriptive. Update the plan with exact evidence and close bead ee-g2rp on completion with bd close ee-g2rp --reason "Ran clean-live Xiaomi rerun for runtime-anchored prompt experiment" --json. Claim bead ee-g2rp on start with bd update ee-g2rp --status in_progress --json. Do not push.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `.logs/`
- `output/`

**Files Created/Deleted/Modified:**
- `.plans/2026-04-04-xiaomi-runtime-anchored-dialogue-prompt-experiment.md`
- verification log/output artifacts under `.logs/` and `output/`

**Status:** ⏳ Pending

**Results:** Pending

---

### Task 3: Synthesize the experiment outcome and push if complete

**Bead ID:** `ee-fy2j`
**SubAgent:** `primary`
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, review the runtime-anchored Xiaomi dialogue prompt experiment, summarize whether the generic runtime anchor improved totalDuration honesty and late-tail capture, and decide the next narrow lane. Update the plan with actual results, archive it if complete, and push committed changes on main while excluding unrelated workspace noise. If the experiment is inconclusive or blocked, document that precisely instead of overstating the result. Claim bead ee-fy2j on start with bd update ee-fy2j --status in_progress --json and close it on completion with bd close ee-fy2j --reason "Reviewed runtime-anchored Xiaomi prompt experiment and pushed results" --json.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `.plans/archive/`
- optional `docs/handoffs/`

**Files Created/Deleted/Modified:**
- `.plans/2026-04-04-xiaomi-runtime-anchored-dialogue-prompt-experiment.md`
- optional archival/handoff files

**Status:** ⏳ Pending

**Results:** Pending

---

## Final Results

**Status:** ⏳ In Progress

**What We Built:** Pending

**Commits:**
- Pending

**Lessons Learned:** Pending

---

*Completed on Pending*
