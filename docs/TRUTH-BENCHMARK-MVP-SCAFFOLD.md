# Truth benchmark MVP scaffold status

**Status:** Implemented scaffold, intentionally partial  
**Date:** 2026-03-25

## What is implemented now

- Top-level YAML `benchmark` block is recognized by `server/lib/config-loader.cjs`
- `benchmark.enabled: true` now requires a readable `benchmark.json` path during config validation
- benchmark execution runs as a real post-run stage in `server/run-pipeline.cjs`, after normal artifact serialization
- repo-local benchmark assets now exist under:
  - `benchmarks/fixtures/cod-test/benchmark.json`
  - `benchmarks/fixtures/cod-test/fixture.json`
  - `benchmarks/fixtures/cod-test/truth/dialogue-data.json`
  - `benchmarks/fixtures/cod-test/truth/music-data.json`
- benchmark reports are written under the fixture-local `_reports/` folder
- MVP comparator coverage is implemented for:
  - `dialogue-default`
  - `music-default`
  - `recommendation-default`
  - `chunk-analysis-default`
  - `metrics-default`
  - `emotional-analysis-default`

## What the MVP currently does

When benchmarking is enabled and the pipeline run itself succeeds, the benchmark stage:

1. resolves `benchmark.json`
2. loads `fixture.json`
3. loads the configured truth/output JSON artifacts
4. compares dialogue/music/recommendation/chunk-analysis/metrics/emotional-analysis JSON with deterministic structured rules
5. applies comparator-owned skips for volatile metadata where needed instead of pretending that those run-specific fields are stable gold truth
   - recommendation: `generatedAt`, `ai`
   - chunk-analysis: `chunks[*].tokens`, `totalTokens`
   - metrics: `generatedAt`
   - emotional-analysis: `generatedAt`, `criticalMoments[*].context`
6. writes per-artifact JSON reports plus aggregate JSON/Markdown summaries
7. fails the run if the benchmark status is `fail` or `error`

## Current scope boundaries

This is a scaffold lane, not a full benchmark engine.

Not implemented yet:

- broader modality coverage beyond dialogue + music + recommendation + chunk-analysis + metrics + emotional-analysis
- richer schema-aware validation beyond the current structured truth/output parity checks
- cross-fixture execution or fixture selection abstractions beyond the single configured `benchmark.json`
- human-reviewed gold truth for recommendation, chunk-analysis, metrics, and emotional-analysis (current fixture files remain bootstrap truth)

## Important honesty note about the initial truth files

The initial `cod-test` truth files are source-controlled bootstrap artifacts copied from the current repo-local `cod-test` output shape so the benchmark runner has durable inputs immediately.

That gives us a real executable scaffold without inventing fake pass behavior, but those truth files still need human editorial review before they should be treated as a strong semantic gold standard.
