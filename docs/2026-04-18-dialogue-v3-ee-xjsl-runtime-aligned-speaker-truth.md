# Dialogue V3 — `ee-xjsl` runtime-aligned speaker/grouping truth surface

Date: 2026-04-18  
Bead: `ee-xjsl`  
Status: Complete

## What landed

A dedicated comparator-ready speaker/grouping truth surface was derived from the durable golden dialogue truth anchor at:

- `benchmarks/fixtures/cod-test/truth/dialogue-data.json`

The new derived artifact is:

- `benchmarks/fixtures/cod-test/truth/speaker-grouping.reconciled-runtime-aligned.json`

It is deterministic and reproducible from:

- golden dialogue truth: `benchmarks/fixtures/cod-test/truth/dialogue-data.json`
- current reconciled runtime dialogue surface: `output/cod-test/phase1-gather-context/dialogue-v3-source-truth.reconciled.json`
- generator: `scripts/qa/derive-cod-runtime-aligned-speaker-grouping-truth.cjs`

## Why this exists

The older checked-in truth artifact:

- `benchmarks/fixtures/cod-test/truth/speaker-grouping.json`

is still useful as the direct first-slice projection from golden dialogue truth, but it remains source-index positional. That made the comparator conflate real grouping misses with split/merge/omission drift between the durable truth rows and the current reconciled runtime segment surface.

The new runtime-aligned artifact keeps `dialogue-data.json` as the source anchor, but projects it onto the current reconciled runtime segment interpretation so grouping comparison is asked on the runtime's actual segment surface.

## Alignment behavior

The derivation uses ordered text alignment with explicit provenance per runtime row:

- split truth row -> multiple runtime rows
- merged consecutive truth rows -> one runtime row
- fuzzy single-row alignment for small wording drift / transcription variance
- unmatched truth rows recorded separately
- unmatched runtime rows recorded separately

Current checked-in alignment summary:

- matched runtime segments: `17`
- unmatched runtime segments: `[11]`
- unmatched truth segments: `[9, 10, 11]`

That means the lyric spillover row is now treated as runtime-extra segmentation/content drift instead of being mislabeled as a speaker reuse failure, while shifted later dialogue rows are compared against their intended golden speakers.

## Comparator effect

After switching the QA harness to the runtime-aligned truth artifact:

- mismatch count moved from `11` to `9`
- old false-positive `runtime_missing_segment_for_truth_index` rows disappeared from the grouping comparator
- the miss surface now reads as:
  - `5` grouping reuse misses
  - `3` assignment mismatches
  - `1` runtime-extra segment not in truth

This is a better comparator/runtime mapping because it keeps segmentation drift separate from honest grouping disagreements.

## Audit note

No provisional per-line traits scaffold was emitted in this bead. The immediate bounded need was the speaker/grouping truth surface, not a new non-gold trait review lane.

The legacy source-index truth artifact was preserved unchanged for calibration/audit history.
