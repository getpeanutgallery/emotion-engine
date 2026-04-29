# 2026-04-28 next Phase 2 slice decision

## Decision

Pick the **chunk-contract restoration benchmark slice** for `cod-test`.

### Exact target slice

Define and execute **one dedicated `cod-test` Phase 2 benchmark lane that truthfully produces `chunk-analysis.json` again** for the existing benchmark/report contract, using the current refreshed Phase 1 context as input and keeping the current whole-video MiMo lane explicitly out of benchmark-equivalence claims.

In practical terms, the slice is:

- use the current `cod-test` Phase 1 gather-context outputs as the upstream packet
- run a **chunk-based Phase 2 path** for benchmark purposes
- emit `phase2-process/chunk-analysis.json` again
- drive the existing Phase 3 report + benchmark stack from that truthful chunk artifact
- **do not** alias `whole-video-analysis.json` into the chunk contract
- **do not** try to make whole-video benchmark-equivalent in the same slice

This is a **contract-restoration slice**, not a whole-video rollout slice.

## Why this is the right next step now

Three facts make this the right immediate slice:

1. **The downstream benchmark/report contract is still chunk-based.**
   - `benchmarks/fixtures/cod-test/benchmark.json` still expects `phase2-process/chunk-analysis.json`
   - `benchmarks/fixtures/cod-test/truth/chunk-analysis.json` is still the Phase 2 truth surface
   - current Phase 3 reporting still derives from `chunkAnalysis`

2. **The current live whole-video lane is not benchmark-ready.**
   - `configs/cod-test.yaml` currently runs `server/scripts/process/whole-video-mimo.cjs`
   - that produces `output/cod-test/phase2-process/whole-video-analysis.json`
   - but the current live artifact still contains impossible timing evidence (`198-206s` on a `140.017s` video), so it is not yet an audit-grade timed comparison surface

3. **Trying to solve chunk-contract restoration and whole-video formalization together would blur the audit trail.**
   - whole-video still lacks benchmark truth/comparator/report parity
   - chunk already has existing truth, comparator expectations, report consumers, and archived baselines
   - the next slice should restore one coherent contract first, then evaluate whole-video on its own honest contract later

So the next slice should be the smallest one that gets `cod-test` back onto a truthful benchmarkable Phase 2 surface.

## Config and artifact paths this slice will use

### Existing inputs / baselines

- Active upstream config/context anchor:
  - `configs/cod-test.yaml`
- Current fresh Phase 1 context packet:
  - `output/cod-test/phase1-gather-context/dialogue-data.json`
  - `output/cod-test/phase1-gather-context/dialogue-data.reconciled.json`
  - `output/cod-test/phase1-gather-context/music-data.json`
  - `output/cod-test/phase1-gather-context/music-vocals-data.json`
  - `output/cod-test/phase1-gather-context/famous-song-reconciliation.json`
- Existing benchmark contract:
  - `benchmarks/fixtures/cod-test/benchmark.json`
  - `benchmarks/fixtures/cod-test/truth/chunk-analysis.json`
- Best archived benchmark-equivalent Phase 2 baseline:
  - `output/_archives/cod-test-pre-ee-2czf-20260408-123814/cod-test/phase2-process/chunk-analysis.json`
- Optional second archived comparison point:
  - `output/_archives/cod-test-pre-ee-s2nv-20260408-151429/cod-test/phase2-process/chunk-analysis.json`

### Expected slice-owned execution path

This slice should use a **dedicated chunk-benchmark config** rather than mutating the current whole-video config in place.

Recommended slice-owned config path:

- `configs/cod-test-phase2-chunk-benchmark.yaml` *(new, slice-owned)*

Recommended Phase 2 producer path:

- `server/scripts/process/video-chunks.cjs`

Expected runtime artifact path:

- `output/cod-test/phase2-process/chunk-analysis.json`

Expected existing downstream consumers for this slice:

- `output/cod-test/phase3-report/metrics/metrics.json`
- `output/cod-test/phase3-report/emotional-analysis/emotional-data.json`
- `output/cod-test/phase3-report/summary/summary.json`
- `benchmarks/fixtures/cod-test/_reports/benchmark-summary.json`

### Explicit non-target for this slice

These paths remain reference-only / side-path only during this slice:

- `server/scripts/process/whole-video-mimo.cjs`
- `output/cod-test/phase2-process/whole-video-analysis.json`
- any hypothetical alias/shim that pretends whole-video output is `chunkAnalysis`

## What success looks like

Success for this slice means **contract coherence**, not necessarily a perfect score.

### Minimum success criteria

1. A fresh run produces:
   - `output/cod-test/phase2-process/chunk-analysis.json`
2. The existing Phase 3 stack consumes that chunk artifact directly without placeholder degradation.
3. The benchmark runner evaluates the produced chunk artifact against the current manifest/truth contract instead of erroring on a missing Phase 2 file.
4. The comparison is traceable against the archived benchmark-equivalent chunk baselines.
5. The slice leaves the whole-video lane clearly labeled as non-equivalent / side-path only.

### Strong success criteria

In addition to the above:

- the new chunk output is reasonably comparable to:
  - `benchmarks/fixtures/cod-test/truth/chunk-analysis.json`
  - `output/_archives/cod-test-pre-ee-2czf-20260408-123814/cod-test/phase2-process/chunk-analysis.json`
- the benchmark packet becomes meaningfully interpretable again, even if still partially red
- Phase 3 metrics/emotional-analysis stop reporting "not applicable" / "not implemented" purely due to missing chunk timeseries

## What failure looks like

This slice should be considered a failure if any of these happen:

1. It tries to make `whole-video-analysis.json` masquerade as `chunk-analysis.json`.
2. It changes multiple contracts at once so that comparison to old benchmark truth becomes ambiguous.
3. It produces a fresh `chunk-analysis.json` but changes the benchmark surface in a way that makes before/after comparison non-like-for-like.
4. It relies on placeholder or synthetic Phase 3 data while claiming benchmark restoration.
5. It quietly turns into a whole-video rollout, comparator rewrite, or truth regeneration project.

## What counts as honest comparison

An honest comparison for this slice means:

- compare **chunk output to chunk truth**
- compare **fresh chunk output to archived chunk baselines**
- keep the benchmark manifest/truth/report worldview stable while evaluating the restored chunk lane
- clearly separate:
  - current whole-video exploratory producer behavior
  - benchmark-equivalent chunk contract behavior
- if a new dedicated config is introduced, document that it exists specifically to isolate the benchmark slice

Honest comparison examples:

- fresh `output/cod-test/phase2-process/chunk-analysis.json` vs `benchmarks/fixtures/cod-test/truth/chunk-analysis.json`
- fresh chunk benchmark report vs archived chunk benchmark-equivalent packet from `2026-04-08`
- fresh Phase 3 metrics/emotional-analysis derived from real `chunkAnalysis` vs prior placeholder outputs caused by missing chunk data

## What counts as misleading comparison

A comparison is misleading if it does any of the following:

- compares `whole-video-analysis.json` directly against `truth/chunk-analysis.json` as if they were equivalent artifacts
- wraps whole-video output in a synthetic one-chunk envelope and then treats that as benchmark-equivalent
- mixes a new whole-video contract change with a restored chunk benchmark run and then claims one combined result proves Phase 2 readiness
- reports improvement or regression without saying whether the artifact came from the chunk lane or the whole-video lane
- uses the current red benchmark packet from `configs/cod-test.yaml` as though it were a valid Phase 2 quality comparison, when it is actually a contract-mismatch failure case

## Non-goals / scope boundaries

This slice explicitly does **not** do the following:

- does **not** replace the current whole-video MiMo lane as the strategic direction
- does **not** formalize a whole-video benchmark truth contract
- does **not** rewrite Phase 3 to become whole-video-native
- does **not** regenerate `truth/chunk-analysis.json`
- does **not** claim parity between sparse whole-video evidence moments and chunk-level timeseries
- does **not** solve both benchmark restoration and whole-video formalization in one pass

## Why this slice wins over the whole-video-formalization slice right now

The whole-video direction still looks strategically interesting, but it loses as the immediate next slice because it currently needs too many contract changes at once:

- new truth/comparator expectations
- new report semantics
- timing-validity guardrails
- a benchmark story that does not pretend chunk equivalence

That is a legitimate later slice, but it is **not** the cleanest next benchmark-honest move.

The chunk-contract restoration slice wins because it is the narrowest path back to an auditable apples-to-apples benchmark surface for `cod-test`.
