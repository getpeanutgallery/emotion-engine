# cod-test first-slice anchor note for v3 `speaker-grouping`

**Date:** 2026-04-16  
**Status:** Locked for first-slice implementation

## Execution anchor

Use the current canonical cod-test pipeline config at:
- `configs/cod-test.yaml`

Treat these linked files as the exact durable execution chain for the first slice:
- `configs/cod-test.yaml` — current run config
- `benchmarks/fixtures/cod-test/fixture.json` — fixture-level pointer back to `configs/cod-test.yaml`
- `benchmarks/fixtures/cod-test/benchmark.json` — current benchmark manifest referenced by `configs/cod-test.yaml`

Do **not** pivot to any `configs/archive/*cod-test*.yaml` variant for this slice.

## Golden benchmark truth anchor for `speaker-grouping`

There is **not yet** a checked-in dedicated golden file at `benchmarks/fixtures/cod-test/truth/speaker-grouping.json`.

For the first slice, the golden truth anchor is the existing human-reviewed dialogue truth file:
- `benchmarks/fixtures/cod-test/truth/dialogue-data.json`

The comparator-ready `speaker-grouping` truth projection should be derived from these exact paths inside that file:
- `dialogue_segments[*].index`
- `dialogue_segments[*].speaker_id`
- `speaker_profiles[*].speaker_id`
- `speaker_profiles[*].grounded.linked_segment_indexes`
- `speaker_profiles[*].label` as optional human-readable carry-through only

Operationally: runtime `speaker-grouping` should be judged against a golden grouping truth surface projected from `benchmarks/fixtures/cod-test/truth/dialogue-data.json` until a dedicated `truth/speaker-grouping.json` is checked in.

## Compatibility bridge posture

A **minimal disposable bridge is needed on the benchmark/comparator side only**:
- acceptable: a small truth-projection step or sidecar artifact that converts `truth/dialogue-data.json` speaker continuity into comparator-ready golden `speaker-grouping` truth
- not acceptable: preserving legacy cassette shapes or treating legacy blended dialogue artifacts as the approval surface

No durable runtime compatibility bridge should be designed around old speaker-profile persistence. If any adapter exists, keep it narrow, explicit, and disposable.

## Primary approval surface

Primary approval is the artifact-level comparison lane:
- runtime `output/.../phase1-gather-context/speaker-grouping.json`
- versus golden `speaker-grouping` truth projected from `benchmarks/fixtures/cod-test/truth/dialogue-data.json`

Primary reporting surface:
- artifact-level comparator result for `speaker-grouping` (expected home: `benchmarks/fixtures/cod-test/_reports/artifact-results/speakerGrouping.json` once wired)

Secondary only:
- roll-up benchmark summaries such as `benchmarks/fixtures/cod-test/_reports/benchmark-summary.json`
- any legacy dialogue-only or blended artifact review surfaces

## First-slice decision lock

The first-slice dev/test target is:
- validated v3 runtime `speaker-grouping`
- versus golden benchmark `speaker-grouping` truth

Legacy cassette preservation is not a goal. The current cod-test YAML and the existing human-reviewed dialogue truth are the durable anchors.