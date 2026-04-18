# Dialogue V3 Task 8 — Native Persisted V3 Speaker-Grouping Rerun

Date: 2026-04-17
Bead: `ee-fpe1`
Status: Complete

## What was rerun

The COD Task 8 speaker-grouping QA harness was rerun directly against the native persisted reconciled v3 runtime artifact emitted by `ee-ud61`:

- input artifact: `output/cod-test/phase1-gather-context/dialogue-v3-source-truth.reconciled.json`
- harness: `node scripts/qa/run-cod-task8-speaker-grouping.cjs`
- refreshed outputs:
  - `output/cod-test/phase1-gather-context/speaker-grouping.json`
  - `output/cod-test/phase1-gather-context/speaker-grouping.decision-ledger.json`
  - `benchmarks/fixtures/cod-test/_reports/artifact-results/speakerGrouping.json`
  - `benchmarks/fixtures/cod-test/_reports/artifact-results/speakerGrouping.miss-clusters.json`

No QA-side synthesis bridge was used in this rerun. The harness consumed the persisted runtime v3 artifact directly.

## Before vs after relative to the prior Task 8 run

### Prior Task 8 run (QA-synthesized v3 envelope)

- runtime segments: `18`
- runtime groups: `18`
- runtime assignments: `18`
- comparator mismatches: `8`
- miss clusters:
  - `grouping_reuse_miss_after_source_truth_conversion`: `6`
  - `runtime_missing_segment_for_truth_index`: `2`

Interpretation from that run: all substantive traits were effectively `unknown`, so the reducer abstained on reuse and emitted singleton groups everywhere.

### This rerun (native persisted reconciled v3 artifact)

- runtime segments: `18`
- runtime groups: `2`
- runtime assignments: `18`
- comparator mismatches: `15`
- miss clusters:
  - `grouping_assignment_mismatch`: `13`
  - `runtime_missing_segment_for_truth_index`: `2`

## What changed

### Reuse clearly improved

Reuse is no longer absent.

- before: `18` groups for `18` assignments, effectively no successful reuse
- after: `2` groups for `18` assignments, with `16` lines merged into `grp_001` and `2` lines merged into `grp_002`
- singleton groups: `18 -> 0`

So the native persisted v3 artifact did unblock reuse behavior. The system is now making reuse decisions instead of collapsing into all-singleton output.

### But overall comparator quality got worse

Mismatch count increased from `8` to `15`.

Why:

- the old run mostly failed by **under-reusing** because the QA-synthesized envelope had almost no usable identity evidence;
- the new run fails by **over-merging** because the native persisted v3 artifact still leaves most discriminative identity traits as `unknown`, while shared defaults (`accent_family`, `accent_strength`, `transmission_medium`, `spatial_texture`, `interpersonal_stance`, recent-reuse bonuses) are now enough to pull many distinct truth speakers into the same runtime group.

The segmentation drift portion did **not** improve:

- `runtime_missing_segment_for_truth_index`: stayed at `2` (`18`, `19`)

So the changed result is specifically a grouping-behavior shift, not a segmentation fix.

## Honest read of the current bottleneck

The next bottleneck is no longer the QA synthesis bridge. That bottleneck is gone.

The next honest bottleneck is **runtime v3 trait discriminativeness / grouping calibration on real emitted traits**:

1. the native persisted v3 artifact is now present and validator-compatible, but many stable-identity fields remain `unknown` across most lines (`gender_presentation`, `age_impression`, `pitch_band`, `phonation`); 
2. because those fields remain sparse, the scorer is leaning too hard on low-discrimination shared defaults and recent-reuse momentum;
3. that causes aggressive collapse into a small number of groups rather than truth-shaped reuse;
4. upstream segmentation drift still exists, but it is no longer the primary explanation for the mismatch increase.

In short: **the lane graduated from “can’t reuse” to “reuses too eagerly with weak evidence.”**

## Recommended next move

Focus next on the real emitted v3 trait surface and/or clean-reuse gating, not on comparator plumbing.

Most honest follow-up targets:

1. improve native per-line stable identity emission so reuse decisions have more speaker-discriminative evidence;
2. tighten scorer/gating behavior so shared defaults plus recency cannot dominate when stable-identity evidence is mostly unknown;
3. keep the segmentation drift note open for truth indexes `18` and `19`, but treat it as secondary to the over-merge problem exposed by this rerun.
