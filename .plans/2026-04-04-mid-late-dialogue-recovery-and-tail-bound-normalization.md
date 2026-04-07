---
plan_id: plan-2026-04-04-mid-late-dialogue-recovery-and-tail-bound-normalization
bead_ids:
  - ee-vl3u
  - ee-a0x0
  - ee-ezs3
---
# emotion-engine: mid/late dialogue recovery and tail-bound normalization

**Date:** 2026-04-04  
**Status:** Partial / Regressive Review Complete  
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

**Status:** ✅ Complete

**Results:** Ran the canonical clean-live Xiaomi/OpenRouter rerun exactly as planned:
- `node server/run-pipeline.cjs --config configs/cod-test-xiaomi-mimo-v2-omni-openrouter-high-thinking-rerun.yaml --clean-live-digital-twin --verbose`
- Fresh verification log: `.logs/2026-04-04-123328-cod-test-xiaomi-mimo-v2-omni-openrouter-high-thinking-rerun-ee-a0x0.log`
- Fresh artifact root: `output/cod-test-xiaomi-mimo-v2-omni-openrouter-high-thinking-rerun/`
- Fresh Phase 1 dialogue artifact: `output/cod-test-xiaomi-mimo-v2-omni-openrouter-high-thinking-rerun/phase1-gather-context/dialogue-data.json`
- Fresh raw provider capture: `output/cod-test-xiaomi-mimo-v2-omni-openrouter-high-thinking-rerun/phase1-gather-context/raw/ai/dialogue-transcription/attempt-01/capture.json`
- Prior runtime-anchored comparison artifact: `output/_archives/cod-test-xiaomi-mimo-v2-omni-openrouter-high-thinking-rerun-pre-ee-x0g9-2026-04-04-103401/phase1-gather-context/dialogue-data.json`
- Golden truth benchmark: `benchmarks/fixtures/cod-test/truth/dialogue-data.json`

Verification outcome: the new recovery lane did **not** improve the clean-live Xiaomi whole-asset result overall.

Exact evidence:
- **Run health:** the rerun completed successfully end-to-end (`exit 0`). Phase 1 reported `Found 21 dialogue segments` and wrote the fresh artifact without runtime-isolation or transport failures.
- **Late tail is still not preserved in truthful late-file position.** The fresh normalized artifact persists `coverage: { start: 0, end: 140.04, duration: 140.04, complete: false }`, but the actual saved dialogue segment timeline only reaches `85s` (`max(dialogue_segments[].end) = 85`). The prior runtime-anchored artifact reached `80s`, so saved segment reach improved by only `+5s` while metadata now claims full-runtime reach. That is a new honesty-risk signal because persisted coverage no longer matches persisted saved segment reach.
- **Fresh mid/late timing collapsed earlier instead of staying near the real tail.** Representative truth-vs-artifact timing samples:
  - Gold `Pull it together, man!` at `98-99s` → fresh `50-52s` (prior also `50-52s`)
  - Gold `Killing the man is a hell of a lot easier than killing the idea.` at `103-105s` → fresh `56-62s` (prior `56-60s`)
  - Gold `You were never cut out to be a Mason.` at `108-110s` → fresh `62-66s` (prior `60-64s`)
  - Gold `No more games! This ends now.` at `112-114s` → fresh `66-70s` (prior `64-68s`)
  - Gold promo `Get the Reznov challenge pack when you preorder now!` at `122-124s` → fresh `80-85s` (prior `75-80s`)
  These lines remain far earlier than truth, so the lane did **not** preserve late-tail content in runtime-faithful position.
- **Content recall vs the immediate prior runtime-anchored artifact was flat-to-worse, not better.** The fresh artifact contains `21` saved dialogue segments versus `22` in the prior runtime-anchored artifact. On a direct line-level compare against gold truth, both the fresh and prior artifacts cover about `18/30` truth lines once split/merged equivalences are allowed, so there is no meaningful recall gain.
- **Small local content changes cut both ways rather than showing a clear preservation win.** The fresh rerun newly preserved the exact `Stop looking backwards, David. What matters is what we do next.` line at `23-28s` (missing as an exact line in the prior artifact), but it also lost the exact `The hell it ain't!` line that the prior artifact had at `40-42s`. The fresh run still misses `You shall know fear.`, the lyric run (`Control faster`, `Master of puppets...`, `Twisting your mind...`, `Blinded by me...`, `Just call my name...`, `Master, master... where's the dreams...`, `Master, master... you promised only lies!`), and still mis-hears `So eager to leave daddy.` as `So eager to leave, David.`
- **No new >runtime overshoot appeared, but the main late-tail goal still failed.** The fresh artifact kept the promo line inside runtime bounds at `80-85s` instead of pushing it beyond file end, so there is no new obvious out-of-bounds tail artifact. However, that line was already present in the prior artifact at `75-80s`, and it is still placed far too early versus the `122-124s` truth position. So the lane avoided a visible overshoot regression but did not achieve useful late-tail preservation.
- **Speaker truth remains unresolved.** The fresh artifact still re-buckets the late spoken block heavily, so there is no evidence that the recovery lane improved downstream speaker honesty.

Bottom line for Task 2: the clean-live Xiaomi rerun stayed stable and in-bounds, but the expected mid/late dialogue recovery did not materialize. The saved artifact still compresses the back half into `0-85s`, recall is not better than the prior runtime-anchored artifact, and the fresh `coverage.end=140.04` versus saved `max segment end=85` mismatch looks like a new honesty regression that should be treated as the next verification/fix seam before claiming this lane improved quality.

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

**Status:** ✅ Complete

**Results:** Final review completed against implementation commit `ee4da54` (`Repair late dialogue tail normalization`) and the fresh verification evidence already captured in Task 2. Conclusion: this lane is **partial/regressive**, not a clean success, and it should **not** be archived or represented as complete.

Precise review outcome:
- **Implementation scope in `ee4da54` was narrow and technically coherent.** The commit added a suffix-only repair seam in `server/scripts/get-context/get-dialogue.cjs` plus focused tests in `test/scripts/get-dialogue.test.js` for slight late-suffix recovery and continued dropping of unrecoverable far-overrun tails. That implementation matches the intended bounded change; the problem is verification outcome, not scope creep.
- **Fresh saved segments still end around `85s`, not near the true back half.** The fresh artifact at `output/cod-test-xiaomi-mimo-v2-omni-openrouter-high-thinking-rerun/phase1-gather-context/dialogue-data.json` contains `21` saved segments with `max(dialogue_segments[].end) = 85`, versus `80` in the prior runtime-anchored archive. So the net saved-segment reach gain is only about `+5s`, far short of recovering the `98-124s` truth-region spoken material in truthful position.
- **Coverage metadata now over-claims reach.** The same fresh artifact reports `coverage.end = 140.04` and `coverage.duration = 140.04` even though persisted saved dialogue segments only reach `85s`. That mismatch is a documentation/honesty problem and is the clearest regression introduced or surfaced by this lane's rerun.
- **No meaningful recall gain versus the prior runtime-anchored result.** The fresh artifact has `21` saved segments versus `22` prior, and the direct truth comparison from Task 2 remained roughly `18/30` recoverable truth lines in both cases once split/merged equivalences are allowed. A few local line-level swaps occurred, but there is no convincing content-retention improvement.
- **Late-tail placement is still badly compressed.** Representative lines that should live in the `98-124s` tail still appear far early in the fresh artifact (`Pull it together, man!` at `50-52s`, `Killing the man...` at `56-62s`, `You were never cut out...` at `62-66s`). The promo line truth at `122-124s` is not meaningfully recovered into truthful late position either.
- **This lane did avoid a visible out-of-bounds overshoot artifact, but that is not enough.** Keeping tail content in-bounds without materially improving late-file recall or timing honesty does not justify marking the lane successful.

Disposition:
- **Do not archive this plan as complete.**
- **Do not push a "success" closeout for the lane.**
- A narrow documentation-only commit updating this plan is worth keeping because it records the truthful outcome and prevents later overstatement. Any follow-up fix work should start from the metadata/coverage honesty seam and the upstream whole-asset grounding problem, not from an assumption that this lane solved mid/late recovery.

---

## Final Results

**Status:** ⚠️ Partial / Regressive

**What We Built:** Task 1 landed a bounded whole-asset late-suffix repair pass in commit `ee4da54`, and Task 2 verified it on a fresh clean-live Xiaomi rerun. The code change is real and narrowly scoped, but the lane outcome is not a success: the fresh artifact still compresses late spoken material into roughly the first `85s`, shows no meaningful recall improvement versus the prior runtime-anchored artifact, and now reports `coverage.end = 140.04` despite persisted saved segments ending at `85s`.

**Commits:**
- `ee4da54` - Repair late dialogue tail normalization
- `(documentation update pending/new in working tree)` - plan updated with final truthful review; do not treat as a success archive

**Lessons Learned:** A small deterministic tail-normalization seam is not enough when the dominant failure mode is upstream whole-asset grounding/timeline collapse. Verification also needs to treat metadata honesty as a first-class deliverable: claiming full runtime coverage while saved segments stop around `85s` is itself a regression. The right follow-up is not to archive this lane, but to treat it as a partial experiment with a new coverage-honesty seam and unresolved late-dialogue grounding.

---

*Completed on 2026-04-04*
