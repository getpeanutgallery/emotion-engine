# emotion-engine: review dialogue + speakers current run vs human-verified benchmark

**Date:** 2026-04-07  
**Status:** In Progress  
**Agent:** Cookie 🍪

---

## Goal

Compare the current stripped-dialogue reconciled run against the human-verified dialogue benchmark truth, with special focus on spoken-line fidelity and speaker clustering quality.

---

## Overview

Derrick wants to go section by section through the current run versus the human benchmark, starting with dialogue + speakers specifically — the dialogue artifact after music-vocals have been stripped out. This lane is not about benchmark comparator design. It is a direct human-facing comparison of the current run against truth for the dialogue artifact.

The review should separate two related but distinct surfaces inside the same artifact: spoken dialogue content and speaker-profile grouping. For dialogue content, the goal is to identify missing lines, damaged lines, merged beats, and any places where the current run is close enough versus materially wrong. For speakers, the goal is to identify where the current run collapses or distorts the benchmark’s speaker structure, especially around scene voices, comms, promo VO, and overlap-heavy lines.

The output should be human-readable and concrete. It should reference exact files, summarize the main deltas, and leave behind a durable review note so the next sections (music, then music-vocals) can follow the same pattern.

---

## Tasks

### Task 1: Gather the exact dialogue + speakers run/truth/report surfaces and map the review scope

**Bead ID:** `ee-3i54`  
**SubAgent:** `research`  
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, gather the exact files to review for dialogue + speakers comparison between the current run and human benchmark truth. Confirm the current run artifact, truth artifact, and benchmark report surface, and map what substructures matter inside the dialogue artifact (dialogue_segments, speaker_profiles, any other relevant fields). Update this plan truthfully with the exact review scope. Claim the assigned bead at start with bd update <ID> --status in_progress --json and close it on completion with bd close <ID> --reason "Dialogue/speakers review scope gathered" --json.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `benchmarks/fixtures/cod-test/`
- `output/cod-test/`

**Files Created/Deleted/Modified:**
- `.plans/2026-04-07-review-dialogue-and-speakers-current-run-vs-benchmark.md`
- `output/cod-test/phase1-gather-context/dialogue-data.reconciled.json` (inspection only)
- `benchmarks/fixtures/cod-test/truth/dialogue-data.json` (inspection only)
- `benchmarks/fixtures/cod-test/_reports/artifact-results/dialogueData.json` (inspection only)

**Status:** ✅ Complete

**Results:** Exact review surface confirmed:
- Current run artifact: `output/cod-test/phase1-gather-context/dialogue-data.reconciled.json`
- Human benchmark truth: `benchmarks/fixtures/cod-test/truth/dialogue-data.json`
- Benchmark report surface: `benchmarks/fixtures/cod-test/_reports/artifact-results/dialogueData.json`

Dialogue/speakers review scope for the human pass:
- Primary compare surface: `dialogue_segments[]` in current run vs truth.
  - Segment fields to inspect directly: `start`, `end`, `speaker`, `speaker_id`, `text`, `confidence`, `index`
  - Current run has 18 segments; truth has 20.
  - Report alignment surface to use while reviewing: `.alignments[]` for `dialogue_segments`, especially `matches`, `unmatchedTruth`, and `unmatchedOutput`.
- Secondary compare surface: `speaker_profiles[]` in current run vs truth.
  - Profile fields to inspect directly: `speaker_id`, `label`, `grounded.confidence`, `grounded.linked_segment_indexes`, `grounded.acoustic_descriptors`, and `inferred_traits.traits[]`
  - Current run has 5 speaker profiles; truth has 13.
  - Report alignment surface to use while reviewing: `.alignments[]` for `speaker_profiles`, especially matched coverage plus `unmatchedTruth` profiles.
- Supporting context to keep visible but not treat as the main scoring surface: top-level `cleanedTranscript`, `summary`, and `handoffContext` in both artifacts.
- Non-review metadata to ignore for this human dialogue/speakers pass: current-run-only `analysisMode`, `timingMode`, `sourceStrategy`, `coverage`, and `provenance`, matching the comparator ignore paths already recorded in the report.

Report notes relevant to scope selection:
- The report already points at the exact output/truth paths above.
- Comparator profile is `dialogue-default`.
- High-level benchmark report summary is `67/198` passed fields, with `131` failures, but this task only selected the dialogue/speaker review surface rather than analyzing all failures.

---

### Task 2: Write a human-perspective dialogue + speakers delta review

**Bead ID:** `ee-owwn`  
**SubAgent:** `research`  
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, compare the current stripped-dialogue reconciled run against the human-verified dialogue benchmark truth. Focus on two surfaces inside the dialogue artifact: dialogue content and speaker grouping. Write a human-perspective delta review that explains what is close, what is materially wrong, and why, in plain engineering language. Be concrete about missing lines, damaged lines, fused beats, collapsed speaker buckets, and overlap-heavy attribution problems. Leave a durable doc in docs/ and update this plan truthfully with the findings and output path. Claim the assigned bead at start with bd update <ID> --status in_progress --json and close it on completion with bd close <ID> --reason "Dialogue/speakers delta review written" --json.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `docs/`

**Files Created/Deleted/Modified:**
- `.plans/2026-04-07-review-dialogue-and-speakers-current-run-vs-benchmark.md`
- `docs/2026-04-07-dialogue-and-speakers-delta-review-current-run-vs-benchmark.md`

**Status:** ✅ Complete

**Results:** Wrote the durable review doc at `docs/2026-04-07-dialogue-and-speakers-delta-review-current-run-vs-benchmark.md`.

Main human-review findings recorded in the doc:
- Dialogue content is partially recognizable but not benchmark-close; the biggest content failures are fused adjacent beats, three missing truth lines, and damaged lines in the opening propaganda/threat cluster plus the late montage/taunt cluster.
- Missing truth beats called out directly: `Menendez is a terrorist.`, `The hell it ain't!`, and `So eager to leave daddy.`
- Material damaged/fused examples called out directly: `Your streets...with your blood` being truncated and smeared into the next line; `Raul Menendez ignited...` contaminated by adjacent text and gibberish; `So eager to leave daddy.` being merged into `Killing the man is a hell of a lot easier than killing the idea.`
- Speaker grouping is materially wrong from a human perspective: truth preserves 13 distinct speaker profiles while the current run collapses them into 5 broad buckets.
- Specific collapsed-bucket problems were documented for output `spk_001`, `spk_002`, `spk_004`, and `spk_005`, including scene-dialogue/comms/promo/overlap-heavy voices being merged when truth keeps them separate.
- The overlap-heavy `You were never cut out to be a Mason.` line was called out as especially important: text is fine, but the current run assigns false speaker certainty where the truth intentionally preserves ambiguity.
- Overall judgment recorded in the doc: usable for rough spoken recall, but not trustworthy as a human-grade dialogue + speakers benchmark pass because structure errors dominate over simple wording errors.

---

### Task 3: Summarize the dialogue + speakers conclusion and highest-value next follow-up inside this section

**Bead ID:** `ee-4td8`  
**SubAgent:** `research`  
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, synthesize the dialogue + speakers review into a short conclusion: what now looks acceptable from a human perspective, what remains the most material dialogue/speaker gap, and what the highest-value next follow-up would be if we wanted to improve this section specifically. Update this plan truthfully with that conclusion. Claim the assigned bead at start with bd update <ID> --status in_progress --json and close it on completion with bd close <ID> --reason "Dialogue/speakers conclusion summarized" --json.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `docs/`

**Files Created/Deleted/Modified:**
- `.plans/2026-04-07-review-dialogue-and-speakers-current-run-vs-benchmark.md`
- `docs/` (review/conclusion doc if needed)

**Status:** ✅ Complete

**Results:** Added the section conclusion to this plan based on `docs/2026-04-07-dialogue-and-speakers-delta-review-current-run-vs-benchmark.md` and the exact run/truth counts.

Short conclusion recorded for this section:
- **Acceptable now from a human perspective:** the artifact is usable for rough spoken recall because several lines survive in recognizable form and some small clusters still read correctly to a human, especially the opening setup, several mid-scene spoken lines, the core comms wording, and the final confrontation beat. Text capture is therefore not catastrophically broken.
- **Most material remaining gap:** the dominant failure is still structural, not cosmetic — adjacent dialogue beats are fused or dropped, and 13 truth speaker profiles are collapsed into 5 output buckets. The opening propaganda/threat cluster and the late `So eager to leave daddy.` → `Killing the man...` cluster remain the clearest examples, and overlap-heavy attribution such as `You were never cut out to be a Mason.` is still rendered with false certainty.
- **Highest-value next follow-up for this section:** focus specifically on dialogue-beat boundary preservation before any finer speaker labeling work. The best next pass would be a targeted review/fix lane for segment splitting and anti-fusion behavior around adjacent spoken lines, then re-check speaker grouping on the cleaner segmentation. That should recover more benchmark truth than trying to tune speaker labels on top of already fused content.

---

## Final Results

**Status:** ✅ Complete

**What We Built:**
- Confirmed the exact current-run/truth/report surfaces for dialogue + speakers review.
- Wrote a durable human-facing delta review at `docs/2026-04-07-dialogue-and-speakers-delta-review-current-run-vs-benchmark.md`.
- Recorded a grounded section conclusion: acceptable as rough spoken recall, but still not benchmark-close because fused beats, missing lines, and aggressive speaker collapse remain the main defects.
- Identified the highest-value next follow-up inside this section as improving dialogue beat boundary preservation and anti-fusion behavior before revisiting speaker-label granularity.

**Commits:**
- Pending.

**Lessons Learned:** Structural segmentation quality is the main lever for this section. When dialogue beats are merged or dropped, speaker evaluation degrades with them, so segmentation cleanup should come before any more detailed speaker-profile tuning.

---

*Completed on 2026-04-07*