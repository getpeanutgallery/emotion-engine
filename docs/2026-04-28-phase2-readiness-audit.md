# 2026-04-28 Phase 2 readiness audit

## Short answer

For `cod-test`, the **configured Phase 2 producer path today** is the whole-video MiMo lane:

- config: `configs/cod-test.yaml`
- process script: `server/scripts/process/whole-video-mimo.cjs`
- live artifact: `output/cod-test/phase2-process/whole-video-analysis.json`

But the **benchmark-honest end-to-end contract is still chunk-based** everywhere downstream that matters:

- benchmark manifest still expects `phase2-process/chunk-analysis.json` from `video-chunks`: `benchmarks/fixtures/cod-test/benchmark.json`
- archived benchmark-equivalent Phase 2 artifact still exists only on the chunk lane: `output/_archives/cod-test-pre-ee-2czf-20260408-123814/cod-test/phase2-process/chunk-analysis.json`
- Phase 3 report/truth surfaces still derive from `chunkAnalysis`, not `wholeVideoAnalysis`

So the repo is currently **split-brain** for `cod-test`: whole-video is the active producer, but chunk-analysis is still the benchmark/report contract.

## 1) What Phase 2 path is canonical today?

### Operationally canonical in `cod-test`

`configs/cod-test.yaml` now runs:

- `server/scripts/process/whole-video-mimo.cjs`

That script produces:

- `output/cod-test/phase2-process/whole-video-analysis.json`
- `output/cod-test/phase2-process/script-results/whole-video-mimo.success.json`
- `output/cod-test/phase2-process/raw/ai/whole-video.json`
- `output/cod-test/phase2-process/raw/ai/whole-video/attempt-01/capture.json`
- `output/cod-test/phase2-process/recovery/whole-video-mimo/lineage.json`

The current live success packet shows the run is stable enough to complete as a producer:

- `output/cod-test/phase2-process/script-results/whole-video-mimo.success.json`
  - `status: success`
  - duration about `39.8s`
  - provider `openrouter`
  - model `xiaomi/mimo-v2-omni`
  - transport `public_url`

### Benchmark-honest canonical contract

The benchmark/report stack is still built around the old chunk lane:

- benchmark manifest: `benchmarks/fixtures/cod-test/benchmark.json`
- historical benchmark-equivalent artifact: `output/_archives/cod-test-pre-ee-2czf-20260408-123814/cod-test/phase2-process/chunk-analysis.json`
- truth surface: `benchmarks/fixtures/cod-test/truth/chunk-analysis.json`

Because of that, the honest answer is:

- **configured canonical producer:** `whole-video-mimo`
- **benchmark/report canonical contract:** `chunk-analysis`

Until one of those is changed, `cod-test` cannot be called a coherent single canonical Phase 2 path.

## 2) What benchmark-honest side paths already exist?

### A. Whole-video MiMo side-path (already real, not benchmark-equivalent)

Design/docs:

- `docs/design/mimo-whole-video-phase2-prototype-2026-03-31.md`
- `docs/research/mimo-openrouter-comparison-path-2026-03-31.md`
- `docs/research/2026-04-08-whole-video-benchmark-report-chunk-analysis-mismatch.md`

Concrete artifacts:

- live: `output/cod-test/phase2-process/whole-video-analysis.json`
- archived comparison runs:
  - `output/_archives/cod-test-mimo-openrouter-compare/phase2-process/whole-video-analysis.json`
  - `output/_archives/cod-test-mimo-xiaomi-direct-smoke/phase2-process/whole-video-analysis.json`
  - `output/_archives/cod-test-xiaomi-mimo-v2-omni-openrouter-high-thinking-rerun/phase2-process/whole-video-analysis.json`

This lane is benchmark-honest **only as a side-path** because the artifact itself marks:

- `comparisonHints.safeForChunkEquivalence = false`
- `comparisonHints.safeForPhase3Metrics = false`

### B. Archived chunk-analysis baseline lane (still the only benchmark-equivalent Phase 2 surface)

Useful archived packets:

- `output/_archives/cod-test-pre-ee-2czf-20260408-123814/cod-test/phase2-process/chunk-analysis.json`
- `output/_archives/cod-test-pre-ee-s2nv-20260408-151429/cod-test/phase2-process/chunk-analysis.json`
- older comparison packets under:
  - `output/_archives/cod-test-phase2-3chunk-comparison/phase2-process/chunk-analysis.json`
  - `output/_archives/cod-test-phase2-3chunk-comparison-pre-ee-4cj8/phase2-process/chunk-analysis.json`

These are the safest starting points if the next narrow slice needs to stay benchmark-honest without first changing truth/manifests/reporting.

## 3) What artifacts/configs/logs are the best current baseline?

### Best current config baseline

- active config: `configs/cod-test.yaml`
- benchmark manifest: `benchmarks/fixtures/cod-test/benchmark.json`

These two files define the current mismatch and therefore the real readiness state.

### Best current live packet for the whole-video lane

Use this packet when discussing the current producer behavior:

- `output/cod-test/phase2-process/whole-video-analysis.json`
- `output/cod-test/phase2-process/script-results/whole-video-mimo.success.json`
- `output/cod-test/phase2-process/raw/ai/whole-video/attempt-01/capture.json`
- `output/cod-test/phase2-process/raw/ai/whole-video.json`
- `output/cod-test/artifacts-complete.json`

Why this is the best live baseline:

- it is the current configured path
- it completed successfully
- it captures the exact schema now being emitted for `cod-test`
- it shows the explicit non-equivalence flags for chunk-based reporting

### Best current benchmark packet for repo-truth comparison

Use this when discussing the last benchmark-equivalent Phase 2 contract:

- `output/_archives/cod-test-pre-ee-2czf-20260408-123814/cod-test/phase2-process/chunk-analysis.json`
- `output/_archives/cod-test-pre-ee-2czf-20260408-123814/benchmark_reports_before/benchmark-summary.json`
- benchmark truth target: `benchmarks/fixtures/cod-test/truth/chunk-analysis.json`

Why this is the best benchmark-honest baseline:

- it still contains a real `chunk-analysis.json`
- it aligns with the manifest/truth/report worldview that `cod-test` still expects
- it gives a direct reference packet for any narrow comparison slice that wants to remain honest before deeper contract changes

### Best current Phase 1 context baseline

After the bridge-rule/anomaly lane, these are the current Phase 1 surfaces to treat as the latest fresh upstream context packet:

- `output/cod-test/phase1-gather-context/dialogue-data.json`
- `output/cod-test/phase1-gather-context/dialogue-data.reconciled.json`
- `output/cod-test/phase1-gather-context/music-data.json`
- `output/cod-test/phase1-gather-context/music-vocals-data.json`
- `output/cod-test/phase1-gather-context/famous-song-reconciliation.json`

Interpretation note from the durable QA memo:

- `docs/2026-04-27-bridge-rule-qa-rerun-note.md`

That note confirms the anomaly lane is done and says the next session should move to Phase 2 readiness / next benchmark slice.

### Best current failure/readiness evidence

These files most clearly show the present downstream blockage:

- `benchmarks/fixtures/cod-test/_reports/benchmark-summary.json`
- `output/cod-test/phase3-report/metrics/metrics.json`
- `output/cod-test/phase3-report/emotional-analysis/emotional-data.json`
- `output/cod-test/phase3-report/summary/summary.json`

Key current symptoms:

- benchmark summary status: `error`
- benchmark reports `0/7 artifacts passed`
- metrics explicitly say chunk-derived timeline metrics were skipped because only `wholeVideoAnalysis` exists
- emotional analysis is effectively empty because no `chunkAnalysis` timeseries exists
- summary/recommendation degrade to placeholder output

## 4) Concrete risks / blockers before the next narrow benchmark slice

### Blocker 1: producer/consumer contract mismatch is still unresolved

`cod-test` now produces `wholeVideoAnalysis`, but:

- benchmark still requires `chunkAnalysis`
- Phase 3 reporting still wants chunk-derived timelines
- truth files still encode chunk expectations

This is the primary blocker for any honest forward progress.

### Blocker 2: whole-video output is not trustworthy enough yet to become the new benchmark slice without guardrails

The current live whole-video artifact contains an impossible evidence range:

- `output/cod-test/phase2-process/whole-video-analysis.json`
  - evidence moment at `timestamp: 198`
  - range `198-206`
- same file reports video `durationSeconds: 140.017`

That means the current side-path producer can finish successfully while still emitting invalid timing evidence. This should be treated as an audit blocker for any slice that depends on timed comparability.

### Blocker 3: Phase 3 still has no honest whole-video reporting contract

Current report outputs show whole-video-aware placeholder handling, but not a real replacement contract:

- `output/cod-test/phase3-report/metrics/metrics.json`
  - `implementationStatus.state = not_applicable`
- `output/cod-test/phase3-report/emotional-analysis/emotional-data.json`
  - `implementationStatus.state = not_implemented`
- `output/cod-test/phase3-report/summary/summary.json`
  - recommendation text is placeholder / insufficient-data output

So even if Phase 2 whole-video is accepted as a producer, the repo still lacks a benchmark-honest consumer story.

### Blocker 4: benchmark truth/comparator work is still missing for whole-video schema

There is no equivalent current truth/comparator path for:

- `wholeVideoAnalysis`

The design note explicitly said this path must not silently masquerade as `chunk-analysis.json`, and the 2026-04-08 research note confirms that a fake alias would be misleading.

### Blocker 5: current baseline is split across fresh Phase 1 and archived Phase 2 chunk history

The freshest Phase 1 packet is current/live, but the last benchmark-equivalent Phase 2 artifact is archived. That means the next narrow slice needs to decide upfront whether it is:

- a **contract-restoration slice** around chunk-analysis compatibility, or
- a **new whole-video contract slice** with explicit non-equivalence and new truth/report expectations

Trying to do both at once will blur auditability.

## Readiness recommendation

The cleanest next narrow benchmark slice is **not** “make whole-video replace chunked now.”

The repo is ready for one of these narrow slices, but it should pick exactly one:

1. **Chunk-contract preservation slice**
   - keep using archived/live chunk-analysis surfaces as the benchmark-honest baseline
   - restore or isolate a truthful `chunkAnalysis` comparison lane

2. **Whole-video contract formalization slice**
   - keep `whole-video-mimo` explicitly side-path only
   - add whole-video-specific truth/report/validation rules
   - do not claim chunk equivalence

Given the current evidence, the second path looks like the right strategic direction, but the first path is still the safer immediate benchmark-honest baseline.
