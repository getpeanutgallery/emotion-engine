# emotion-engine: Xiaomi runtime-anchored dialogue prompt experiment

**Date:** 2026-04-04
**Status:** Complete
**Agent:** Cookie 🍪

---

## Goal

Test whether a generic runtime-anchored whole-asset dialogue prompt makes Xiaomi MiMo preserve full file duration correctly and capture any late sparse dialogue/vocal tail without introducing asset-specific content bias.

---

## Overview

The prior audit concluded the current whole-asset Xiaomi/OpenRouter dialogue lane is most likely failing because the upstream model is weakly grounded on long-form audio timing, with two local contract gaps that make that weakness easier to surface: the prompt does not anchor the model to the measured runtime, and the validator does not reject partial duration claims. The smallest next experiment is therefore prompt-only, not a validator rewrite.

This tranche added a **generic runtime anchor** to the whole-asset dialogue prompt contract, then reran the same clean-live Xiaomi/OpenRouter config and compared the new artifact against the prior honest baseline. The result is directional but not terminal: runtime anchoring materially improved whole-file reach and late-tail recovery, but it still did not fully solve end-of-file placement accuracy. The terminal promo line continued to appear beyond the real measured runtime and was therefore dropped during normalization.

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

**Results:** Landed in commit `d606dae` (`Add runtime anchor to whole-asset dialogue prompt`). The prompt now explicitly injects the locally measured runtime (`transportPreflight.durationSeconds`) into the whole-asset dialogue instructions and tells the model to keep `totalDuration` anchored to the full attached runtime rather than estimating from recovered speech span or the last spoken line. The prompt also explicitly states that silence, ambience, music-only tails, sparse non-speech endings, or intermittent end-of-file vocals do not imply the file ended early, while spoken-dialogue coverage must still remain honest. Updated prompt-contract assertions in `test/scripts/get-dialogue.test.js` and verified with `node --test test/scripts/get-dialogue.test.js` (35/35 passing).

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
- `.logs/2026-04-04-111843-cod-test-xiaomi-runtime-anchored-ee-g2rp.log`
- `.logs/2026-04-04-111843-cod-test-xiaomi-runtime-anchored-ee-g2rp.time`
- `output/cod-test-xiaomi-mimo-v2-omni-openrouter-high-thinking-rerun/phase1-gather-context/dialogue-data.json`
- `output/cod-test-xiaomi-mimo-v2-omni-openrouter-high-thinking-rerun/phase1-gather-context/raw/ai/dialogue-transcription/attempt-01/capture.json`

**Status:** ✅ Complete

**Results:** Ran the canonical clean-live rerun exactly as planned: `node server/run-pipeline.cjs --config configs/cod-test-xiaomi-mimo-v2-omni-openrouter-high-thinking-rerun.yaml --clean-live-digital-twin --verbose`.

Exact rerun evidence:
- Clean-live log: `.logs/2026-04-04-111843-cod-test-xiaomi-runtime-anchored-ee-g2rp.log`
- Wall-clock file: `.logs/2026-04-04-111843-cod-test-xiaomi-runtime-anchored-ee-g2rp.time` (`real 200.42`)
- Final dialogue artifact: `output/cod-test-xiaomi-mimo-v2-omni-openrouter-high-thinking-rerun/phase1-gather-context/dialogue-data.json`
- Raw provider/tool-loop capture: `output/cod-test-xiaomi-mimo-v2-omni-openrouter-high-thinking-rerun/phase1-gather-context/raw/ai/dialogue-transcription/attempt-01/capture.json`

Observed outcome versus the prior honest baseline:
- **Prior honest baseline** (documented in `docs/handoffs/2026-04-03-dialogue-runtime-coverage-handoff.md`) persisted only `coverage: 0 -> 80s`, `coverage.complete: false`, and left the whole-asset Xiaomi lane as a partial transcript. The known previous last captured line was around `116.0–121.0s`: `"Get the Reznov challenge pack when you pre-order now."`
- **New runtime-anchored rerun persisted materially farther into the file.** The saved artifact now reports `totalDuration: 140.04`, `coverage: { start: 0, end: 136, duration: 136, complete: false }`, and 17 recovered dialogue segments. So the saved artifact no longer truncates near the old `0 -> 80s` partial-span baseline and gets within about `4.04s` of the measured full runtime while still honestly marking the file incomplete.
- **The saved artifact does not stop around `121s` anymore.** Its last persisted segment is now `132.5–136.0s: "No more games. This ends now."` The final persisted late block also includes `119.5–127.0s: "So eager to leave, David. Killing the man is a hell of a lot easier than killing the idea."` and `128.0–131.5s: "You were never cut out to be a Mason."`
- **The raw provider output still carries the old promo-tail pattern, but now later and explicitly out of range.** In `capture.json`, the model emitted one more segment at `141.0–146.0s`: `"Get the Reznov Challenge Pack when you pre-order now."` That means the model did not fully preserve runtime exactly; it overshot the real `140.04s` asset by about `5.96s`. The normalized saved artifact dropped that overrun segment and kept the latest in-range line at `136.0s`.
- **Late sparse dialogue/vocal tail recovery improved, but not fully.** Compared with the earlier honest artifact that only truthfully persisted to `80s`, this rerun now recovers a real late-file block through `136s`, including multiple sparse end-of-file lines that were previously absent from the saved artifact. But it still does not achieve fully correct end-of-file preservation because the final promotional tail remains mis-timed beyond the asset duration and is therefore not preserved in the saved output.

Bottom line for this experiment: the runtime-anchored prompt improved whole-asset runtime reach and late-tail recovery on this Xiaomi/OpenRouter lane, but it did **not** fully solve end-of-file accuracy. The lane is now much closer to the true runtime and no longer effectively collapses around the previous `~121s` / promo-line stopping point, yet the terminal promotional tail is still placed beyond the real asset duration and filtered out of the persisted artifact.

---

### Task 3: Synthesize the experiment outcome and push if complete

**Bead ID:** `ee-fy2j`
**SubAgent:** `primary`
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, review the runtime-anchored Xiaomi dialogue prompt experiment, summarize whether the generic runtime anchor improved totalDuration honesty and late-tail capture, and decide the next narrow lane. Update the plan with actual results, archive it if complete, and push committed changes on main while excluding unrelated workspace noise. If the experiment is inconclusive or blocked, document that precisely instead of overstating the result. Claim bead ee-fy2j on start with bd update ee-fy2j --status in_progress --json and close it on completion with bd close ee-fy2j --reason "Reviewed runtime-anchored Xiaomi prompt experiment and pushed results" --json.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `.plans/archive/`

**Files Created/Deleted/Modified:**
- `.plans/2026-04-04-xiaomi-runtime-anchored-dialogue-prompt-experiment.md`
- `.plans/archive/2026-04-04-xiaomi-runtime-anchored-dialogue-prompt-experiment.md`

**Status:** ✅ Complete

**Results:** Final review confirms the experiment is **complete but only partially successful**. Commit `d606dae` correctly implemented the intended generic runtime anchor without introducing asset-specific hints, and the rerun evidence shows a substantial improvement in runtime reach and late-tail recovery. However, the lane still fails the stricter success condition of accurate end-of-file preservation: the final promo-tail line remains generated at `141.0–146.0s`, outside the real `140.04s` runtime, so normalization drops it. That means the runtime anchor improved `totalDuration` honesty and practical reach, but did not fully cure terminal timestamp placement.

Recommended next narrow lane: a Xiaomi/OpenRouter whole-asset **late-suffix timestamp repair / bounded tail-normalization** investigation, not another generic prompt expansion. The remaining miss is concentrated at the terminal overrun behavior, not at opening-span grounding or `coverage.complete` honesty anymore.

For push hygiene, only the completed plan archival/change was staged and committed; unrelated active plans, docs handoffs, `.beads/interactions.jsonl`, and temp/workspace noise were left untouched.

---

## Final Results

**Status:** ⚠️ Partial

**What We Built:** A prompt-only runtime-anchoring experiment for the Xiaomi whole-asset dialogue lane, plus a clean-live rerun and evidence review. The prompt change successfully anchored `totalDuration` to the measured runtime and materially extended saved dialogue reach from the prior honest `0 -> 80s` baseline to `0 -> 136s`, recovering multiple late-file segments that were previously missing. The experiment did **not** fully solve the remaining terminal tail issue, because the final promo line was still emitted beyond the true `140.04s` runtime and therefore dropped from the normalized artifact.

**Commits:**
- `d606dae` - Add runtime anchor to whole-asset dialogue prompt
- `6be39cb` - Archive runtime-anchored Xiaomi experiment plan with final review and conclusions

**Lessons Learned:**
- Generic runtime anchoring helps this Xiaomi/OpenRouter lane materially; the model is more willing to carry timing close to the true asset end instead of collapsing around the earlier ~80–121s behavior.
- The remaining defect is narrower than the prior audit suggested: it is now concentrated in terminal overrun placement rather than broad early truncation.
- Another broad prompt rewrite is unlikely to be the highest-leverage next move; the next deterministic lane should focus on repairing or constraining late out-of-range suffix timestamps before normalization discards them.

---

*Completed on 2026-04-04*
