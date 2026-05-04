# Timestamp Benchmark Surface QA Summary

Date: 2026-05-04
Repo: `peanut-gallery/emotion-engine`
Scope: QA verification of benchmark truth surfaces vs emitted timestamp artifact surfaces.

## Commands run

- `node scripts/qa/derive-cod-timestamp-benchmark-truth.cjs check`
- `node --test test/scripts/derive-cod-timestamp-benchmark-truth.test.js`
- ad-hoc Python inspection to compare row counts, field shapes, text alignment, and sequence drift between:
  - `benchmarks/fixtures/cod-test/truth/dialogue-timestamps-data.reconciled.json`
  - `benchmarks/fixtures/cod-test/truth/music-vocals-timestamps-data.json`
  - `output/cod-test-phase1-timestamp-validation/phase1-gather-context/dialogue-timestamps-data.reconciled.json`
  - `output/cod-test-phase1-timestamp-validation/phase1-gather-context/music-vocals-timestamps-data.reconciled.json`
  - `output/cod-test-phase1-timestamp-validation/phase1-gather-context/dialogue-data.reconciled.json`

## Findings

### Dialogue benchmark surface

- Benchmark row count: `20`
- Current emitted timestamp artifact row count: `19`
- Current emitted reconciled dialogue text row count: `19`
- Current dialogue truth row count: `20`
- Benchmark segment keys: `index`, `text`, `speaker`, `speaker_id`, `start`, `end`
- Emitted artifact segment keys: `speaker`, `speaker_id`, `text`, `confidence`, `index`, `timing`, `start`, `end`

The benchmark is the correct truth surface for direct comparison because it preserves the 20-row spoken-dialogue gold surface and excludes runtime-only metadata. It must not be collapsed to the current 19-row emitted artifact because the emitted artifact still contains runtime drift.

Observed runtime drift posture that comparator logic must tolerate/document:

- split: benchmark row 0 (`They want you afraid. Fear makes you easier to control.`) appears as two emitted rows:
  - `They want you afraid.`
  - `Fear makes you easier to control.`
- punctuation/wording drift examples:
  - `Your streets, shall once again run red with your blood.` vs `Your streets shall once again run red with your blood.`
  - `Stop looking backwards, David. What matters is what we do next.` vs `... what you do next.`
  - `No more games! This ends now.` vs `No more games. This ends now.`
  - `preorder` vs `pre-order`
- merge/compression examples:
  - benchmark rows 4-5 are one emitted row: `Menendez is a terrorist. We're bringing peace and security to the world.`
  - benchmark rows 9-10 are compressed to one emitted row: `Spectre One report.`
- row substitution drift examples:
  - `So eager to leave David.` vs `So eager to leave, are we?`
  - `Killing a man is a hell of a lot easier than killing the idea.` vs `... killing an idea.`

Practical comparison consequence: direct `index -> index` timing comparison is only valid where text alignment still holds. Human review and future comparator wiring must use split/merge-tolerant matching windows for drifted regions instead of treating the 19-row emitted artifact as benchmark authority.

### Music-vocals benchmark surface

- Benchmark row count: `12`
- Current emitted timestamp artifact row count: `11`
- Current music-vocals truth row count: `12`
- Benchmark segment keys: `index`, `text`, `performer`, `performer_id`, `delivery`, `start`, `end`
- Emitted artifact segment keys: `index`, `text`, `confidence`, `performer`, `performer_id`, `delivery`, `timing`

The benchmark is faithful to current truth:

- benchmark `summary` exactly matches `benchmarks/fixtures/cod-test/truth/music-vocals-data.json`
- benchmark `hasVocals` exactly matches current truth and emitted artifact (`true`)
- benchmark `totalDuration` exactly matches current truth (`140.042449`)
- benchmark text is preserved verbatim from the current truth rows, with synthesized stable `index`
- runtime-only metadata remains excluded from truth, including `confidence`, `timing`, and recognition/provenance-style fields

Observed runtime drift posture:

- emitted artifact reorders/compresses the lyric sequence relative to truth
- emitted artifact begins at benchmark rows 10-11 (`Master, master` / `How I’m fucking your mind`) rather than preserving the 12-row truth order
- emitted artifact then inserts/repeats other lyric rows in a different order

Practical comparison consequence: the dedicated music-vocals benchmark is the right truth surface, but today’s emitted artifact is not yet a 1:1 row-aligned consumer of it. Review/comparator work must compare against truth without assuming current emitted order is authoritative.

## Verdict

The new dedicated benchmark files are QA-valid truth surfaces for benchmark-anchored human review. They are intentionally cleaner and more authoritative than the current emitted timestamp artifacts because they preserve truth ordering/text/timing ownership while leaving runtime drift, confidence, and timing-derivation metadata outside the benchmark contract.
