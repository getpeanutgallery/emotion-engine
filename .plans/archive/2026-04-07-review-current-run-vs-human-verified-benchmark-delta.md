# emotion-engine: review current reconciled run vs human-verified benchmark delta across dialogue, speakers, music, and vocals

**Date:** 2026-04-07  
**Status:** In Progress  
**Agent:** Cookie 🍪

---

## Goal

Produce a human-perspective delta review between the current reconciled cod-test run and the human-verified benchmark truth so we can see how different the system still is on dialogue, speakers, music, and vocals after the comparator-honesty lanes are finished.

---

## Overview

The current comparator work is about grading honesty: making sure the benchmark penalizes the right things and stops overstating wrongness because of synthetic IDs, raw array position, or operational metadata. Once the remaining comparison lanes are done, the next important question is no longer just “what does the benchmark score say?” but “how different is the actual output from what a human would say is right?”

This review lane should stay artifact-centered and human-readable. The goal is to compare the latest reconciled outputs against benchmark truth and explain the differences in terms a human reviewer would care about: missing lines, merged speakers, collapsed speaker clusters, wrong lyric anchors, missing chant windows, music-summary drift, and any remaining semantic mismatches that still matter even after comparator cleanup.

The output should not just be a pile of field diffs. It should separate comparator-shape noise from real human-meaningful deltas, summarize the current quality ceiling we appear to have reached, and identify which remaining gaps are likely model/output limitations versus benchmark/comparator framing issues.

---

## Tasks

### Task 1: Gather the latest benchmark reports and reconciled artifacts for dialogue, speakers, music, and vocals

**Bead ID:** `ee-qblm`  
**SubAgent:** `research`  
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, gather the latest reconciled cod-test artifacts and the latest benchmark reports relevant to dialogue, speaker_profiles, music, and music-vocals. Confirm the exact files that represent the current run and the current human-verified truth. Update this plan truthfully with the exact artifact set to review. Claim the assigned bead at start with bd update <ID> --status in_progress --json and close it on completion with bd close <ID> --reason "Artifact set gathered for human delta review" --json.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `benchmarks/fixtures/cod-test/`
- `output/cod-test/`

**Files Created/Deleted/Modified:**
- `.plans/2026-04-07-review-current-run-vs-human-verified-benchmark-delta.md`
- `benchmarks/fixtures/cod-test/_reports/benchmark-summary.json` (inspection only)
- `benchmarks/fixtures/cod-test/_reports/artifact-results/dialogueData.json` (inspection only; includes `speaker_profiles` review surface)
- `benchmarks/fixtures/cod-test/_reports/artifact-results/musicData.json` (inspection only)
- `benchmarks/fixtures/cod-test/_reports/artifact-results/musicVocalsData.json` (inspection only)
- `output/cod-test/phase1-gather-context/dialogue-data.reconciled.json` (inspection only; current reconciled run for dialogue + speaker profiles)
- `output/cod-test/phase1-gather-context/music-data.json` (inspection only; current run for music, no reconciled variant present)
- `output/cod-test/phase1-gather-context/music-vocals-data.reconciled.json` (inspection only; current reconciled run for music vocals)
- `benchmarks/fixtures/cod-test/truth/dialogue-data.json` (inspection only; current human-verified truth for dialogue + speaker profiles)
- `benchmarks/fixtures/cod-test/truth/music-data.json` (inspection only; current human-verified truth for music)
- `benchmarks/fixtures/cod-test/truth/music-vocals-data.json` (inspection only; current human-verified truth for music vocals)

**Status:** ✅ Complete

**Results:** Confirmed the current review set for the human delta pass. Latest benchmark report surfaces are `benchmarks/fixtures/cod-test/_reports/benchmark-summary.json` plus per-artifact reports at `benchmarks/fixtures/cod-test/_reports/artifact-results/dialogueData.json`, `benchmarks/fixtures/cod-test/_reports/artifact-results/musicData.json`, and `benchmarks/fixtures/cod-test/_reports/artifact-results/musicVocalsData.json` (all stamped 2026-04-07 08:53 local). Exact current run files to compare are `output/cod-test/phase1-gather-context/dialogue-data.reconciled.json`, `output/cod-test/phase1-gather-context/music-data.json`, and `output/cod-test/phase1-gather-context/music-vocals-data.reconciled.json`. Exact current human-verified truth files are `benchmarks/fixtures/cod-test/truth/dialogue-data.json`, `benchmarks/fixtures/cod-test/truth/music-data.json`, and `benchmarks/fixtures/cod-test/truth/music-vocals-data.json` (all stamped 2026-04-06 17:24 local). Important nuance: `speaker_profiles` does not have its own standalone artifact file in this fixture; it is part of the dialogue artifact/run/truth/report surfaces, so the dialogue files above are the correct review inputs for both dialogue and speaker-profile delta review.

---

### Task 2: Write a human-perspective delta review across dialogue, speakers, music, and vocals

**Bead ID:** `ee-uayg`  
**SubAgent:** `research`  
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, compare the current reconciled cod-test outputs against the human-verified benchmark truth for dialogue, speaker_profiles, music, and music-vocals. Write a human-perspective delta review that explains the remaining differences in plain engineering language rather than raw field-diff noise. Separate comparator-shape issues from real semantic/content gaps. Call out what appears close enough from a human perspective and what still materially differs. Update this plan truthfully with the exact findings and output path. Claim the assigned bead at start with bd update <ID> --status in_progress --json and close it on completion with bd close <ID> --reason "Human delta review written" --json.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `docs/`

**Files Created/Deleted/Modified:**
- `.plans/2026-04-07-review-current-run-vs-human-verified-benchmark-delta.md`
- `docs/2026-04-07-human-delta-review-cod-test-vs-truth.md`

**Status:** ✅ Complete

**Results:** Wrote the durable review doc at `docs/2026-04-07-human-delta-review-cod-test-vs-truth.md` after comparing the Task 1 artifact set against the human-verified truth and benchmark report surfaces. Main human-perspective findings: dialogue is directionally understandable but still drops or damages meaningful lines (`Menendez is a terrorist.`, `You shall know fear.`), fuses adjacent beats, and weakens the preorder tag; speaker separation is the biggest remaining dialogue-side gap because the run collapses 13 truth speaker buckets into 5 broad clusters that merge scene dialogue, comms, promo VO, and overlap-heavy lines; music is much closer than the raw benchmark report suggests and is probably acceptable as a coarse human summary, but it under-calls continuous score presence outside the obvious metal peak; music-vocals gets the song right (`Master of Puppets`) but still misses the early chant window, misses the later chant/reprise windows, and mis-anchors several central lyric lines. The review explicitly separates comparator-shape/report-shape issues (ignored operational metadata, output-only structure like `globalArc`, evidence packing differences, generic label naming) from real semantic gaps.

---

### Task 3: Summarize what remaining gaps are model/output limits vs comparator/benchmark limits

**Bead ID:** `ee-trb5`  
**SubAgent:** `research`  
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, synthesize the current human delta review and the finished comparator-honesty work into a short conclusion: which remaining differences now look like real model/output limitations, which still look like benchmark/comparator framing problems, and what the highest-value next investigation should be. Update this plan truthfully with that conclusion. Claim the assigned bead at start with bd update <ID> --status in_progress --json and close it on completion with bd close <ID> --reason "Delta review conclusions summarized" --json.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `docs/`

**Files Created/Deleted/Modified:**
- `.plans/2026-04-07-review-current-run-vs-human-verified-benchmark-delta.md`
- `docs/` (review / conclusion doc if needed)

**Status:** ✅ Complete

**Results:** Synthesized the Task 2 human delta review against the finished comparator-honesty findings from the April 7 comparator lane. Conclusion: the biggest remaining differences now look like real output/model limits rather than comparator noise. The benchmark is now mostly honest about `speaker_profiles` and `recognizedSong`: it no longer over-penalizes synthetic IDs, raw list order, or evidence packing, and the remaining pain lines up with what a human review still finds wrong. Real model/output limits still visible are: (1) speaker separation remains too collapsed, with distinct acoustic identities, radio/comms, promo VO, and overlap-heavy dialogue still merged into a few broad buckets; (2) dialogue still loses or damages specific lines and fuses adjacent beats in ways that matter to transcript trust; (3) music-vocals still misses the early chant entry, later reprise windows, and several lyric anchors/orderings even though the song ID is right; and (4) music still under-calls continuous score presence outside the obvious metal peak, though that now looks like a smaller/coarser summary weakness rather than a critical semantic miss. Remaining comparator/benchmark-limit issues are narrower: adjacent report surfaces still overstate some music-side wrongness because of output-only structures (`globalArc`, `qualityNotes`), evidence-packing differences, and non-core note arrays; those are scoring-shape/framing issues, not the main human delta. Highest-value next investigation: target upstream grounding/segmentation on the overlap-heavy lyric/dialogue windows that currently drive both collapsed speaker clustering and missed lyric anchors, rather than spending another lane laundering comparator behavior for `speaker_profiles` or `recognizedSong`.

---

## Final Results

**Status:** ✅ Complete

**What We Built:** Confirmed, in one place, which remaining cod-test gaps are now genuine model/output limitations versus residual benchmark/comparator framing issues after the comparator-honesty lanes finished. The durable conclusion is that the benchmark is now mostly grading the right things on `speaker_profiles` and `recognizedSong`, while the largest remaining human-meaningful misses are still speaker clustering collapse, missing/fused dialogue beats, and incomplete/misaligned lyric-window recovery.

**Commits:**
- Pending.

**Lessons Learned:** Comparator cleanup materially changed how to read the scores: the benchmark is no longer the main story on the key dialogue/vocal identity surfaces. The next useful work should move back upstream into output quality investigation, especially the hard overlap/chant/dialogue-anchor regions, while keeping a smaller watchlist on residual music-side structural scoring noise.

---

*Drafted on 2026-04-07*