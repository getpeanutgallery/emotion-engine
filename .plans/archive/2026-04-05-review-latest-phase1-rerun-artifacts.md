# emotion-engine: review latest Phase 1 rerun artifacts

**Date:** 2026-04-05  
**Status:** Complete  
**Agent:** Cookie 🍪

---

## Goal

Review the latest three-lane cod-test rerun artifacts together, compare them against benchmark truth and human usefulness, and decide the next highest-value iteration lane.

---

## Overview

The April 4 work landed the dedicated Phase 1 `music_vocals` lane and completed a fresh canonical rerun. The architecture split appears correct, but the remaining question is artifact quality: whether the saved `dialogue`, `music`, and `music-vocals` outputs are truthful, useful, and good enough to trust as inputs to later phases.

This plan focuses on human review rather than more implementation first. We want to inspect the latest saved artifacts, call out what is clearly improved, isolate where truthfulness still breaks down, and leave behind a crisp recommendation for the next lane. The likely decision points are whether to improve the `music_vocals` contract, change model/provider strategy, or add stronger grounding aids.

---

## Tasks

### Task 1: Review the latest three-lane Phase 1 artifacts against truth and usefulness

**Bead ID:** `ee-nt7f`  
**SubAgent:** `research`  
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, claim bead ee-nt7f with bd update ee-nt7f --status in_progress --json, then review the latest cod-test Xiaomi MiMo/OpenRouter rerun artifacts with a human-quality lens. Compare output/cod-test-xiaomi-mimo-v2-omni-openrouter-high-thinking-rerun/phase1-gather-context/dialogue-data.json, music-data.json, and music-vocals-data.json against benchmarks/fixtures/cod-test/truth/dialogue-data.json and the April 4 handoff expectations. Capture what looks trustworthy, what still fails, and what next iteration lane is most justified. Update this plan with exact findings and close the bead with bd close ee-nt7f --reason "Reviewed latest three-lane Phase 1 rerun artifacts" --json when done.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `output/cod-test-xiaomi-mimo-v2-omni-openrouter-high-thinking-rerun/`
- `benchmarks/fixtures/cod-test/truth/`

**Files Created/Deleted/Modified:**
- `.plans/2026-04-05-review-latest-phase1-rerun-artifacts.md`
- `output/cod-test-xiaomi-mimo-v2-omni-openrouter-high-thinking-rerun/phase1-gather-context/dialogue-data.json`
- `output/cod-test-xiaomi-mimo-v2-omni-openrouter-high-thinking-rerun/phase1-gather-context/music-data.json`
- `output/cod-test-xiaomi-mimo-v2-omni-openrouter-high-thinking-rerun/phase1-gather-context/music-vocals-data.json`
- `benchmarks/fixtures/cod-test/truth/dialogue-data.json`

**Status:** ✅ Complete

**Results:** Reviewed the saved rerun artifacts against `benchmarks/fixtures/cod-test/truth/dialogue-data.json` and the April 4 handoff. Exact findings:

- **What looks trustworthy now**
  - The **three-lane split itself still looks correct**. `dialogue-data.json` stayed spoken-only, `music-data.json` stayed non-lexical, and lyric content did not leak back into the dialogue artifact.
  - **Dialogue front half is mostly strong.** The saved dialogue artifact cleanly recovered the early trailer setup through `A lot of people counting on us for answers.` with only minor wording drift (`what we do next` → `what you do next`, and `So eager to leave daddy.` → `So eager to leave, are we?`).
  - **Dialogue late spoken lines are partly recovered.** It correctly includes `This isn't real.`, `The hell it ain't!`, `Pull it together, man!`, `Killing the man is a hell of a lot easier than killing the idea.`, `You were never cut out to be a Mason.`, and `No more games. This ends now.`
  - **Music artifact is broadly usable as coarse non-lexical context.** It captures the major arc correctly: tense speech-heavy opening, heavy-metal entry around `75-80s`, sustained energetic middle, then a late drop for promo dialogue around `125-130s`. For downstream emotional/contextual use, that looks directionally trustworthy.

- **What still fails or drifts**
  - **Dialogue artifact is still incomplete and should not be treated as benchmark-truthful.** It only has 17 segments vs 30 in benchmark truth, coverage ends at `129s` with `complete: false`, and it misses several important benchmark lines entirely: `You shall know fear.`, `Specter one, report.`, `Need a sitrep.`, `Obey your master!` at `116-118`, the preorder promo line, and the final `Master, master` tail.
  - **Dialogue still loses the lyric block entirely**, which is acceptable architecturally but means the combined Phase 1 truth picture still depends on the `music-vocals` lane being much better than it currently is.
  - **Music-vocals remains the weakest artifact by a wide margin.** It recovers `Obey your master!` twice, but still misses most benchmark lyric lines called out in the April 4 handoff (`Control faster`, `Master of puppets are pulling the strings`, `Twisting your mind...`, `Blinded by me...`, `Just call my name...`, and both longer `Master, master...` lines).
  - **Music-vocals contains obvious hallucination/drift.** It emits non-benchmark wording like `What's that? I thought you said this would be easy!`, plus repetitive filler-style text such as `Master! Master! Faster! Faster! Master! Master!` that does not map cleanly to truth.
  - **Music-vocals is internally contradictory.** Its artifact contains six `vocal_segments` with lyric text, but the top-level `summary` says `No text-bearing music-led vocals detected in this chunk.` and multiple `qualityNotes` also claim no audible sung lyrics. That contradiction makes the artifact hard to trust even where individual recovered lines are plausible.
  - **Confidence appears inflated / not decision-useful.** Every vocal segment is saved at `0.95` despite clear misses and hallucinations.

- **Most justified next lane**
  - The best next step is **structured grounding aid** for the `music-vocals` lane, not more prompt-only contract tweaking and not a model/provider swap yet.
  - Reason: the architecture is already correct and the current provider can detect at least some true anchor phrases (`Obey your master!`), but it drifts badly once asked to produce a freeform lyric transcript. The biggest failure mode looks like weak grounding and permissive generation, not lane routing.
  - Concretely, the review suggests the next iteration should force a more evidence-bounded output shape for music-vocals: stronger segment-by-segment grounding, explicit unknown/unclear handling, anti-fabrication rules, and/or a structured aid that ties candidate lyric text to audible spans before allowing final transcript text.
  - A **model/provider swap** is still a valid fallback if a grounding pass cannot materially improve lyric recall without hallucination, but this review does not justify reopening dialogue/music split work first.

---

## Final Results

**Status:** ✅ Complete

**What We Built:** A human review of the latest three-lane Phase 1 rerun artifacts. Conclusion: the lane split is still the right architecture; `music-data.json` is broadly usable for coarse non-lexical context; `dialogue-data.json` is cleaner but still incomplete; and `music-vocals-data.json` remains the main blocker because it both misses benchmark lyric lines and contradicts itself at the artifact level.

**Commits:**
- None (analysis/review only; no commit requested)

**Lessons Learned:** The architecture problem and the truthfulness problem are now separable. Dialogue/music scoping improved, but lyric truthfulness still needs stronger grounding before later phases can safely trust the saved artifact.

---

*Started on 2026-04-05*  
*Completed on 2026-04-05*
