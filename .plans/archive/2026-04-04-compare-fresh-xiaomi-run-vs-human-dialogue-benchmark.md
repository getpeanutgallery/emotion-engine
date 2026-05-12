---
plan_id: plan-2026-04-04-compare-fresh-xiaomi-run-vs-human-dialogue-benchmark
bead_ids:
  - ee-rc6p
---
# emotion-engine: compare fresh Xiaomi run vs human dialogue benchmark

**Date:** 2026-04-04  
**Status:** Complete  
**Agent:** Cookie 🍪

---

## Goal

Compare the latest successful Xiaomi whole-asset dialogue artifact against the human-verified benchmark and produce a truthful gap report covering missed lines, combined/split lines, timing drift, and speaker assignment drift.

---

## Overview

The timestamp-hardening lane restored parser survival and produced a usable fresh dialogue artifact, but the honest next question is not just whether the run completed — it is how that artifact differs from the human-verified truth. We need a direct comparison between the latest run at `output/cod-test-xiaomi-mimo-v2-omni-openrouter-high-thinking-rerun/phase1-gather-context/dialogue-data.json` and the benchmark at `benchmarks/fixtures/cod-test/truth/dialogue-data.json`.

This lane should stay analytical and evidence-first. The deliverable is a concrete comparison report that identifies which benchmark lines are missing, which lines were merged or split, where timestamps drift materially, and where speaker IDs/labels are assigned differently from the benchmark’s effective speaker partitioning. The result should clearly separate: exact matches, approximate/near matches, missed benchmark lines, extra hallucinated/non-benchmark lines, and speaker drift on otherwise recognizable text.

---

## Tasks

### Task 1: Produce a benchmark-vs-run dialogue gap report

**Bead ID:** `ee-rc6p`  
**SubAgent:** `research`  
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, compare the latest successful Xiaomi whole-asset dialogue artifact at output/cod-test-xiaomi-mimo-v2-omni-openrouter-high-thinking-rerun/phase1-gather-context/dialogue-data.json against the human-verified benchmark at benchmarks/fixtures/cod-test/truth/dialogue-data.json. Produce a truthful gap report covering: exact/near text matches, benchmark lines that were missed entirely, lines that were combined or split, extra non-benchmark lines, timing drift for recognizable lines, and speaker assignment drift. Write the findings into the active plan with enough detail for Derrick to review, including concrete examples. Claim the assigned bead on start and close it on completion with an explicit reason. Do not change code.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- optional analysis note paths if needed

**Files Created/Deleted/Modified:**
- `.plans/2026-04-04-compare-fresh-xiaomi-run-vs-human-dialogue-benchmark.md`

**Status:** ✅ Complete

**Results:** Compared the 20 Xiaomi run segments against the 30 benchmark segments and wrote the gap analysis below. High-level result: the run preserves 19/30 benchmark lines as recognizable text, but only 11 of those are literal text matches; 8 are near matches, punctuation variants, or a split line. 11/30 benchmark lines are missed entirely. There is one clear split (benchmark line 0 became run lines 0-1), no strong evidence of benchmark lines being combined into a single run segment, and no clearly hallucinated extra non-benchmark lines.

#### Gap report

**Corpus shape**
- Benchmark: 30 dialogue segments, 14 speaker profiles.
- Xiaomi run: 20 dialogue segments, 18 speaker profiles.
- The run under-covers the benchmark text and over-splits speaker identity.

**Exact text matches (literal text identical)**
- Benchmark 1 → Run 2: `It's time to wake up.`
- Benchmark 3 → Run 4: `Raul Menendez ignited global unrest on an unprecedented scale.`
- Benchmark 4 → Run 5: `Menendez is a terrorist.`
- Benchmark 5 → Run 6: `We're bringing peace and security to the world.`
- Benchmark 6 → Run 7: `He refuses to let me go.`
- Benchmark 8 → Run 9: `A lot of people counting on us for answers.`
- Benchmark 12 → Run 12: `This isn't real.`
- Benchmark 13 → Run 13: `The hell it ain't!`
- Benchmark 22 → Run 14: `Pull it together, man!`
- Benchmark 24 → Run 16: `Killing the man is a hell of a lot easier than killing the idea.`
- Benchmark 25 → Run 17: `You were never cut out to be a Mason.`

**Near matches / altered text**
- Benchmark 0 was **split** across Run 0 + Run 1:
  - Benchmark 0: `They want you afraid. Fear makes you easier to control.`
  - Run 0: `They want you afraid.`
  - Run 1: `Fear makes you easier to control.`
- Benchmark 2 → Run 3: comma dropped in `Your streets, shall once again run red with your blood.`
- Benchmark 7 → Run 8: wording drift from `what we do next` to `what you do next`.
- Benchmark 10 → Run 10: `Specter one, report.` became `Spectre One, report.`
- Benchmark 11 → Run 11: `sitrep` became `sit-rep`.
- Benchmark 23 → Run 15: recognizable but materially rewritten:
  - Benchmark: `So eager to leave daddy.`
  - Run: `So eager to leave, are we?`
- Benchmark 26 → Run 18: punctuation-only drift (`No more games!` vs `No more games.`).
- Benchmark 28 → Run 19: casing / hyphenation drift (`challenge pack` / `preorder` vs `Challenge Pack` / `pre-order`).

**Benchmark lines missed entirely**
- Benchmark 9: `You shall know fear.`
- Benchmark 14: `Obey your master.`
- Benchmark 15: `Control faster.`
- Benchmark 16: `Master of puppets are pulling the strings!`
- Benchmark 17: `Twisting your mind, smashing your dreams!`
- Benchmark 18: `Blinded by me, you can’t see a thing`
- Benchmark 19: `Just call my name ’cause I’ll hear you scream`
- Benchmark 20: `Master, master, where’s the dreams that I’ve been after?`
- Benchmark 21: `Master, master, you promised only lies!`
- Benchmark 27: `Obey your master!`
- Benchmark 29: `Master, master`

**Combined / split behavior**
- **Clear split:** only the opening benchmark line is split into two run lines.
- **No clear combines:** despite the run having fewer total segments, the reduction comes from omissions rather than multiple benchmark lines being cleanly merged into one run line.

**Extra non-benchmark lines**
- No run segment appears to be a clear hallucinated extra line. Every run segment is traceable to a benchmark line or part of one, though some are paraphrased or speaker-shifted.

**Timing drift for recognizable lines**
- Early section (before the big omission block) already drifts late by ~0.5s to 4.0s:
  - Benchmark 3 (17-21) → Run 4 (18-22.5): +1.0s start, +1.5s end.
  - Benchmark 8 (35-36) → Run 9 (37-40): +2.0s start, +4.0s end.
- Mid section drifts heavily once missing lines accumulate:
  - Benchmark 10 `Specter one, report.` (51-52) → Run 10 (64-66.5): +13.0s start, +14.5s end.
  - Benchmark 11 `Need a sitrep.` (54-55) → Run 11 (67-69.5): +13.0s start, +14.5s end.
  - Benchmark 12 `This isn't real.` (61-62) → Run 12 (76-78): +15.0s start, +16.0s end.
  - Benchmark 13 `The hell it ain't!` (63-64) → Run 13 (78.5-80.5): +15.5s start, +16.5s end.
- Late section remains materially late, though the offset narrows somewhat:
  - Benchmark 22 `Pull it together, man!` (98-99) → Run 14 (104.5-107): +6.5s start, +8.0s end.
  - Benchmark 24 `Killing the man...` (103-105) → Run 16 (112.5-116.5): +9.5s start, +11.5s end.
  - Benchmark 28 `Get the Reznov challenge pack...` (122-124) → Run 19 (133.5-139.5): +11.5s start, +15.5s end.
- Net: timing drift is not a constant offset; it grows after omissions and remains unstable afterward.

**Speaker assignment drift**
- The run uses **18 speaker profiles for 20 segments** versus **14 profiles for 30 benchmark segments**, which is strong evidence of over-segmentation / poor speaker continuity.
- A single benchmark speaker is often fragmented into multiple run speakers:
  - Benchmark `spk_001` covers the opening plus both propaganda lines (`They want you afraid...`, `It's time to wake up.`, `Menendez is a terrorist.`, `We're bringing peace...`). In the run, those are spread across `spk_001`, `spk_004`, and `spk_005`.
- Recognizable text is often attached to the wrong benchmark-equivalent speaker ID:
  - Benchmark 4 `Menendez is a terrorist.` is `spk_001`; Run 5 assigns it to `spk_004`.
  - Benchmark 5 `We're bringing peace and security to the world.` is `spk_001`; Run 6 assigns it to `spk_005`.
  - Benchmark 8 `A lot of people counting on us for answers.` is `spk_006`; Run 9 assigns it to `spk_008`.
  - Benchmark 10 and 11 are both `spk_008`; Run 10 and 11 split them into `spk_009` and `spk_010`.
  - Benchmark 12 `This isn't real.` is `spk_009`; Run 12 assigns it to `spk_011`.
  - Benchmark 13 `The hell it ain't!` is `spk_010`; Run 13 assigns it to `spk_012`.
  - Benchmark 22 `Pull it together, man!` is `spk_012`; Run 14 assigns it to `spk_013`.
  - Benchmark 24 `Killing the man...` is `spk_013`; Run 16 assigns it to `spk_015`.
  - Benchmark 25 `You were never cut out to be a Mason.` is `spk_015`; Run 17 assigns it to `spk_016`.
  - Benchmark 26 `No more games! This ends now.` is `spk_006`; Run 18 assigns it to `spk_017`.
  - Benchmark 28 `Get the Reznov challenge pack...` is `spk_016`; Run 19 assigns it to `spk_018`.
- The music/chant voice cluster is also unstable: benchmark keeps the chant lines on `spk_011`, but the run captures only two recognizable lines from that region and spreads them across `spk_011` and `spk_012` instead of preserving one recurring speaker.

**Bottom line**
- The fresh Xiaomi whole-asset run is usable as a partial transcript, but it is not benchmark-faithful.
- Main failure mode is **omission**, especially the `You shall know fear` + `Master of Puppets` stretch.
- Secondary failure modes are **speaker fragmentation** and **late / unstable timing drift** on otherwise recognizable lines.
- There is only one clear structural segmentation error (the split opening line); the bigger problem is missing content, not merges.

---

## Final Results

**Status:** ✅ Complete

**What We Built:** A concrete benchmark-vs-run dialogue gap report written directly into this plan. The report identifies 19 recognizable benchmark lines in the Xiaomi artifact, 11 benchmark lines missed entirely, one clear split at the opening, no clearly hallucinated extra lines, large timing drift after omission-heavy regions, and substantial speaker fragmentation / speaker-ID drift.

**Commits:**
- None. Analysis-only documentation update; no code changes were made.

**Lessons Learned:** The successful whole-asset run is not enough by itself; omission-heavy regions can make downstream timing and speaker evaluation look superficially plausible while still diverging sharply from benchmark truth. Future evaluation should treat text coverage, timing alignment, and speaker continuity as separate pass/fail axes.

---

*Created on 2026-04-04*
