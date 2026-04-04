# emotion-engine: mid/late dialogue recovery and tail-bound normalization

**Date:** 2026-04-04  
**Status:** In Progress  
**Agent:** Cookie 🍪

---

## Goal

Improve Xiaomi whole-asset dialogue quality by preserving recoverable mid/late lines and safely normalizing late tail content to true runtime bounds without introducing asset-specific prompt bias.

---

## Overview

The runtime-anchored prompt experiment materially improved whole-file duration honesty and late-tail reach, but the benchmark comparison shows the dominant remaining problem is content grounding / content retention. The current saved artifact now reaches much farther into the file, yet it still loses or merges important mid/late lines, especially in the sparse and music-heavy back half. Those content losses then cascade into speaker mismatch and timestamp drift.

This tranche focuses on the smallest next repair lane: improve recovery/finalization behavior so short, sparse, late-file lines are less likely to be lost or merged away, and clamp plausible tail content to the true file bounds when safe instead of dropping it outright for slight end overshoot. The prompt guidance should remain universal and structure-oriented, not asset-specific. The goal is better line retention first; speaker/timestamp perfection remains downstream.

---

## Tasks

### Task 1: Implement mid/late dialogue recovery and safe tail-bound normalization

**Bead ID:** `ee-vl3u`  
**SubAgent:** `coder`  
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, implement the smallest repair lane for Xiaomi whole-asset dialogue quality based on the benchmark comparison. Focus on preserving recoverable mid/late lines and safely normalizing late tail content to true runtime bounds instead of losing or dropping it outright for slight overshoot. The change should be narrow and truthful: do not invent content, do not add asset-specific prompt hints, and do not broaden this into a speaker-system rewrite. If prompt tweaks are needed, keep them generic and structure-oriented only. Update/add tests where possible. Claim bead ee-vl3u on start with bd update ee-vl3u --status in_progress --json and close it on completion with bd close ee-vl3u --reason "Implemented mid-late dialogue recovery and tail-bound normalization" --json. Commit your changes after tests pass, but do not push. Update the active plan with what actually happened.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `server/scripts/get-context/`
- `test/scripts/`

**Files Created/Deleted/Modified:**
- `.plans/2026-04-04-mid-late-dialogue-recovery-and-tail-bound-normalization.md`
- `server/scripts/get-context/get-dialogue.cjs`
- `test/scripts/get-dialogue.test.js`

**Status:** ✅ Complete

**Results:** Implemented a narrow whole-asset late-suffix timestamp repair seam in `server/scripts/get-context/get-dialogue.cjs` immediately before the existing clamp/drop normalization. The new path only activates for timeline-ordered late suffix overruns that are still plausibly repairable: it shifts the suffix back by the measured overrun so slight end-of-file drift lands inside the real runtime instead of collapsing to zero-length and being dropped. Chunk-local / handoff mode remains unchanged, and unrecoverable far-overrun tails still fall back to the existing truthful clamp/drop behavior. Added focused regressions in `test/scripts/get-dialogue.test.js` covering both cases: recovery of a slight late suffix overrun and continued dropping of a far-overrun tail. Verified with `node --test test/scripts/get-dialogue.test.js`.

---

### Task 2: Verify rerun quality against the prior runtime-anchored result and benchmark evidence

**Bead ID:** `ee-a0x0`  
**SubAgent:** `primary`  
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, verify the mid/late dialogue recovery and tail-bound normalization lane after Task 1 lands. Run the canonical clean-live Xiaomi/OpenRouter whole-asset rerun using configs/cod-test-xiaomi-mimo-v2-omni-openrouter-high-thinking-rerun.yaml with --clean-live-digital-twin --verbose. Compare the result against the prior runtime-anchored artifact and, where useful, the golden-truth benchmark evidence. Focus on whether missing/merged mid-late lines are better preserved, whether late tail content is safely retained within runtime bounds, and whether content recall improves without creating new honesty regressions. Update the active plan with exact evidence and close bead ee-a0x0 on completion with bd close ee-a0x0 --reason "Verified mid-late dialogue recovery lane on clean-live Xiaomi rerun" --json. Claim bead ee-a0x0 on start with bd update ee-a0x0 --status in_progress --json. Do not push.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `.logs/`
- `output/`
- optional benchmark report paths

**Files Created/Deleted/Modified:**
- `.plans/2026-04-04-mid-late-dialogue-recovery-and-tail-bound-normalization.md`
- verification log/output artifacts under `.logs/` and `output/`

**Status:** ⏳ Pending

**Results:** Pending

---

### Task 3: Final review, archive, and push if complete

**Bead ID:** `ee-ezs3`  
**SubAgent:** `primary`  
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, review the mid/late dialogue recovery and tail-bound normalization lane, summarize whether content retention improved, update the plan with actual outcomes, archive it if complete, and push committed changes on main while excluding unrelated workspace noise. If the result is partial or inconclusive, document that precisely instead of overstating it. Claim bead ee-ezs3 on start with bd update ee-ezs3 --status in_progress --json and close it on completion with bd close ee-ezs3 --reason "Reviewed mid-late dialogue recovery lane and pushed results" --json.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `.plans/archive/`
- optional `docs/handoffs/`

**Files Created/Deleted/Modified:**
- `.plans/2026-04-04-mid-late-dialogue-recovery-and-tail-bound-normalization.md`
- optional archival/handoff files

**Status:** ⏳ Pending

**Results:** Pending

---

## Final Results

**Status:** ⏳ In Progress

**What We Built:** Task 1 landed a bounded whole-asset late-suffix repair pass that preserves slight late overruns by shifting the suffix back into the measured runtime before clamp/drop normalization, while keeping chunked/handoff behavior unchanged and preserving the old drop behavior for unrecoverable far-overrun tails.

**Commits:**
- Pending

**Lessons Learned:** The best first recovery lane was the deterministic loss seam, not another broad prompt or speaker-system rewrite. A conservative suffix-only repair can recover real late lines without pretending to solve upstream speaker collapse.

---

*Completed on Pending*
