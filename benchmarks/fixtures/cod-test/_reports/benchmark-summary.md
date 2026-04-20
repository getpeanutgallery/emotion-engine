# Benchmark Summary: cod-test

- Status: **error**
- Benchmark: `benchmarks/fixtures/cod-test/benchmark.json`
- Fixture: `benchmarks/fixtures/cod-test/fixture.json`
- Config: `COD Test Pipeline`
- Output Dir: `output/cod-test`

## Totals

- Artifacts: 0/6 passed, 1 failed, 5 errored
- Accuracy: 171/466 scoreable fields passed (36.7%)
- Coverage: 466/860 truth fields scoreable (54.2%)
- Skipped truth fields: 25
- Ignored differences surfaced outside score: 40
- Reconciled/post-processing contract mismatch fields: 184

## Artifacts

- **dialogueData** — fail; accuracy=36.1%, coverage=96.6%, ignoredDiffs=0, posture=reconciled/post-processing contract, reconciledContractMismatch=184
- **musicData** — error; accuracy=32.0%, coverage=89.3%, ignoredDiffs=5
- **musicVocalsData** — error; accuracy=49.4%, coverage=80.9%, ignoredDiffs=29
- **recommendationData** — error; accuracy=10.5%, coverage=52.8%, ignoredDiffs=4
- **metricsData** — error; accuracy=37.5%, coverage=42.1%, ignoredDiffs=1
- **emotionalAnalysisData** — error; accuracy=16.7%, coverage=3.5%, ignoredDiffs=1

0/6 artifacts passed. 171/466 scoreable fields passed. Truth coverage was 466/860 fields. reconciled contract mismatch=184.

