# OpenRouter MiMo dialogue benchmark comparison (cod-test)

Generated from the repo's existing JSON structured dialogue comparator (`server/lib/benchmark-runner.cjs`) using a temporary manifest that reuses the cod-test dialogue benchmark truth/comparator profile against the fresh output at `output/cod-test-mimo-openrouter-compare/phase1-gather-context/dialogue-data.json`.

## Artifacts

- Fresh benchmark summary: `tmp/openrouter-mimo-dialogue-benchmark/reports/benchmark-summary.json`
- Fresh artifact result: `tmp/openrouter-mimo-dialogue-benchmark/reports/artifact-results/dialogueData.json`
- Fresh vs prior baseline comparison: `tmp/openrouter-mimo-dialogue-benchmark/comparison-vs-dialogue-baseline.json`
- Common-path delta analysis: `tmp/openrouter-mimo-dialogue-benchmark/common-path-delta.json`
- Prior baseline summary: `benchmarks/fixtures/cod-test/dialogue-only/_reports/benchmark-summary.json`
- Prior baseline artifact result: `benchmarks/fixtures/cod-test/dialogue-only/_reports/artifact-results/dialogueData.json`

## Headline

The fresh OpenRouter MiMo dialogue output is **slightly better than the prior dialogue benchmark baseline on truth-overlap accuracy**, but it still fails the benchmark and still misses the late trailer section badly.

## Exact scores

### Raw benchmark outputs

- Fresh MiMo OpenRouter: `92/247` scoreable fields passed, accuracy `37.25%`, coverage `84.59%`, status `error`
- Prior baseline: `82/230` scoreable fields passed, accuracy `35.65%`, coverage `85.50%`, status `error`
- Raw delta: `+10` passed fields, `+1.59` accuracy points, `-0.91` coverage points

### Truth-overlap-only comparison

Because the fresh output includes extra top-level metadata fields that are not present in the current truth (`analysisMode`, `timingMode`, `sourceStrategy`, `coverage`, `provenance`), the cleanest apples-to-apples view is the intersection of paths shared by both reports.

On the `236` common benchmarked paths:

- Fresh MiMo OpenRouter passed `85/236` = `36.02%`
- Prior baseline passed `77/236` = `32.63%`
- Common-path delta: `+8` passes, `+3.39` accuracy points

## Where the fresh output is better

The fresh run improved `15` benchmarked paths versus the prior baseline, mostly in early dialogue alignment:

- Early segment timing improved:
  - `dialogue_segments[0].end`
  - `dialogue_segments[1].start`
  - `dialogue_segments[1].end`
  - `dialogue_segments[2].start`
  - `dialogue_segments[2].end`
  - `dialogue_segments[3].start`
- Early segment text improved:
  - `dialogue_segments[0].text`
  - `dialogue_segments[1].text`
- Two late lyric speaker IDs now align better:
  - `dialogue_segments[18].speaker`
  - `dialogue_segments[18].speaker_id`
  - `dialogue_segments[19].speaker`
  - `dialogue_segments[19].speaker_id`
- Speaker 2 trait structure is less wrong than before:
  - `speaker_profiles[1].inferred_traits.traits[0].trait`
  - `speaker_profiles[1].inferred_traits.traits[0].value`
  - `speaker_profiles[1].inferred_traits.traits[0].confidence`

## Where the fresh output is worse

The fresh run regressed on `8` common benchmarked paths:

- Dialogue regressions:
  - `dialogue_segments[3].confidence`
  - `dialogue_segments[8].end`
  - `dialogue_segments[12].end`
  - `dialogue_segments[13].start`
- Speaker-profile regressions:
  - `speaker_profiles[2].inferred_traits.traits[0].trait`
  - `speaker_profiles[4].grounded.acoustic_descriptors[0].confidence`
  - `speaker_profiles[5].grounded.linked_segment_indexes[1]` (fail -> error)
  - `speaker_profiles[6].grounded.acoustic_descriptors[0].confidence`

## Biggest remaining mismatch buckets in the fresh output

Using the fresh comparator result buckets:

1. **Speaker profile linkage (`35`)**
   - The biggest remaining bucket.
   - The model still links speaker profiles to the wrong segment indexes or misses expected linked segments.

2. **Segment timing (`33`)**
   - Still very large, although improved versus baseline (`38 -> 33`).
   - Timing drift remains concentrated in later segments.

3. **Segment speaker identity (`30`)**
   - Improved versus baseline (`36 -> 30`).
   - Speaker/speaker_id assignment still diverges often once the trailer gets deeper into overlapping voices / lyrics / montage.

4. **Speaker profile traits (`22`)** and **descriptors (`20`)**
   - Trait/descriptive grounding remains noisy and often structurally mismatched.

5. **Segment text (`18`)**
   - Better than baseline (`21 -> 18`), but still a major bucket.

6. **Missing late segments (`10`)**
   - The fresh run still drops the final truth segment block starting at `dialogue_segments[20]` through `dialogue_segments[29]`.
   - This is still the clearest single failure shape in the transcript-level output.

## Main interpretation

The fresh OpenRouter MiMo output is not a full benchmark recovery, but it is a modest real improvement over the old baseline when measured on comparable benchmark paths. The gains are mostly in **early transcript/timing alignment and a small amount of speaker-identity cleanup**. The biggest unresolved problems remain:

- **late-trailer recall / completeness** (still missing the final 10 dialogue segments),
- **speaker-to-segment linkage**,
- **timing drift**, especially later in the file,
- **speaker identity / trait grounding under montage + lyric + promo transitions**.

## Important caveat

The fresh output now contains extra top-level metadata fields not represented in the current cod-test truth (`analysisMode`, `timingMode`, `sourceStrategy`, `coverage`, `provenance`). The comparator currently scores those as structural errors. That makes the raw fresh report look slightly noisier than the true transcript-only comparison. The common-path comparison is the cleaner measure for deciding whether the dialogue content itself improved.
