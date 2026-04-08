# Whole-video cod-test benchmark/report mismatch vs `chunkAnalysis`

**Date:** 2026-04-08  
**Scope:** investigation only; no code changes

## Question

Why does cod-test still expect `phase2-process/chunk-analysis.json` after `configs/cod-test.yaml` was switched to the whole-video Phase 2 strategy?

## Short answer

Because the cod-test config was switched only at the Phase 2 execution layer, but the downstream Phase 3 report stack and benchmark manifest still encode the old chunk-analysis contract.

- **Phase 2 now produces** `wholeVideoAnalysis` at `output/cod-test/phase2-process/whole-video-analysis.json`.
- **Phase 3 report scripts still read only** `artifacts.chunkAnalysis` and silently degrade to empty placeholder outputs when it is missing.
- **The benchmark manifest still requires** `artifactKey: "chunkAnalysis"` from `script: "video-chunks"` at `phase2-process/chunk-analysis.json`, and `benchmark-runner` throws as soon as that required file is absent.

## Trace: config -> produced artifact -> report expectations -> benchmark expectations

### 1) Config now selects the whole-video Phase 2 lane

**File:** `configs/cod-test.yaml`

`configs/cod-test.yaml` now points the process phase at:

- `server/scripts/process/whole-video-mimo.cjs`

So cod-test is no longer configured to run `video-chunks.cjs`.

### 2) The whole-video Phase 2 script writes a different artifact key and path

**File:** `server/scripts/process/whole-video-mimo.cjs`

The whole-video script writes:

- output file: `phase2-process/whole-video-analysis.json`
- artifact key: `wholeVideoAnalysis`

It returns:

```js
return {
  primaryArtifactKey: 'wholeVideoAnalysis',
  artifacts: {
    wholeVideoAnalysis: {
      ...analysisResult.wholeVideoAnalysis,
      path: 'phase2-process/whole-video-analysis.json'
    }
  }
};
```

**Concrete run evidence:**

- `output/cod-test/phase2-process/whole-video-analysis.json` exists and contains a rich whole-video result.
- `output/cod-test/artifacts-complete.json` contains `wholeVideoAnalysis` and does **not** contain `chunkAnalysis`.

So the config change is real and the new Phase 2 output shape is real.

### 3) Report runner passes artifacts through as-is; it does not alias `wholeVideoAnalysis` to `chunkAnalysis`

**File:** `server/lib/phases/report-runner.cjs`

`runReport()` just forwards/merges the accumulated `artifacts` object. There is no adapter layer that converts whole-video output into the chunk-analysis contract before report scripts run.

### 4) First failing assumption: report scripts still assume `artifacts.chunkAnalysis`

This is the **earliest stale assumption in execution order**.

#### 4a) Metrics report

**File:** `server/scripts/report/metrics.cjs`

This script immediately destructures:

```js
const {
  chunkAnalysis = { chunks: [], totalTokens: 0, videoDuration: 0 }
} = artifacts;
```

and then computes everything from `chunkAnalysis.chunks`.

If `chunkAnalysis` is absent, it falls back to an empty structure and emits:

- `dataSource: 'derived-from-phase2.chunkAnalysis'`
- `reason: 'No usable phase2 chunkAnalysis emotion timeseries was found.'`

**Concrete run evidence:**

- `output/cod-test/phase3-report/metrics/metrics.json`
  - `summary.totalChunks = 0`
  - `summary.videoDuration = 0`
  - `implementationStatus.reason = "No usable phase2 chunkAnalysis emotion timeseries was found."`

#### 4b) Emotional analysis report

**File:** `server/scripts/report/emotional-analysis.cjs`

Same pattern: it destructures `chunkAnalysis`, builds timeline data from `chunkAnalysis.chunks`, and degrades when the artifact is absent.

#### 4c) Recommendation report

**File:** `server/scripts/report/recommendation.cjs`

Its prompt builder still says:

- `Using the provided chunk-level emotion analysis and computed metrics...`

and it builds `chunkSummaries` from `chunks`, which are sourced from `artifacts.chunkAnalysis`.

So recommendation generation is still semantically chunk-centric even when the Phase 2 artifact is whole-video.

#### 4d) Summary report

**File:** `server/scripts/report/summary.cjs`

It destructures:

```js
chunkAnalysis = { chunks: [], totalTokens: 0, videoDuration: 0 }
```

and uses that to populate:

- `metadata.videoDuration`
- `metadata.chunksAnalyzed`
- `metadata.totalTokens`

**Concrete run evidence:**

- `output/cod-test/phase3-report/summary/summary.json`
  - `videoDuration = 0`
  - `chunksAnalyzed = 0`
  - `totalTokens = 0`

even though `output/cod-test/phase2-process/whole-video-analysis.json` clearly contains meaningful Phase 2 data.

#### 4e) Final report and smoke checks

**Files:**
- `server/scripts/report/final-report.cjs`
- `server/lib/report-package-smoke.cjs`

`final-report.cjs` still writes `analysis-data.json` with `data.chunkAnalysis`, and the smoke checker explicitly validates:

- `analysisData.data.chunkAnalysis` exists
- `analysisData.data.chunkAnalysis.chunks` is an array

**Concrete run evidence:**

- `output/cod-test/phase3-report/summary/analysis-data.json` contains a synthetic empty `chunkAnalysis` object:
  - `chunks: []`
  - `totalTokens: 0`
  - `videoDuration: 0`

So the report packet is structurally preserving the old chunk-analysis worldview, even though the run used whole-video Phase 2.

### 5) The benchmark manifest still requires the old chunk-analysis artifact

**File:** `benchmarks/fixtures/cod-test/benchmark.json`

The cod-test benchmark still declares:

```json
{
  "artifactKey": "chunkAnalysis",
  "label": "Phase 2 chunk analysis",
  "phase": "phase2-process",
  "script": "video-chunks",
  "output": {
    "path": "phase2-process/chunk-analysis.json"
  },
  "truth": {
    "path": "truth/chunk-analysis.json"
  },
  "required": true
}
```

That is still the old chunked contract in three places:

- artifact key: `chunkAnalysis`
- producing script name: `video-chunks`
- output path: `phase2-process/chunk-analysis.json`

### 6) First hard failure: benchmark runner enforces the stale manifest entry

**File:** `server/lib/benchmark-runner.cjs`

For each manifest artifact, the runner resolves an output path and then throws if a required artifact is missing:

```js
if (artifact.required && !fs.existsSync(outputAbsolutePath)) {
  throw new Error(`Produced artifact missing for ${artifact.artifactKey}: ${outputAbsolutePath}`);
}
```

For the stale manifest entry above, that becomes:

- `Produced artifact missing for chunkAnalysis: .../output/cod-test/phase2-process/chunk-analysis.json`

This matches the real rerun failure exactly.

## Additional stale assumption in `run-pipeline.cjs`

**File:** `server/run-pipeline.cjs`

There is also a skipped-Phase-2 hydration / guardrail path that still only knows about `chunkAnalysis`:

- if Phase 2 scripts are skipped, it hydrates `chunkAnalysis`
- the Phase 3-only guard is named `requiresChunkAnalysis`
- it checks `artifacts.chunkAnalysis.chunks`

This did not cause the observed live rerun failure, because cod-test actually ran Phase 2. But it is still stale and would break or misreport for Phase-3-only whole-video workflows.

## First failing assumption vs first thrown error

These are not the same point:

- **First failing assumption in pipeline order:** Phase 3 reporting assumes `artifacts.chunkAnalysis` exists and is the sole usable Phase 2 input.
- **First thrown error:** benchmark runner enforces the stale `chunkAnalysis` manifest entry and aborts when `phase2-process/chunk-analysis.json` is absent.

That is why the live whole-video cod-test produced placeholder Phase 3 outputs **before** the benchmark hard-failed.

## Smallest plausible fix

### Recommended narrow fix

Treat cod-test as a whole-video benchmark/report target end-to-end instead of trying to pretend `wholeVideoAnalysis` is `chunkAnalysis`.

That means:

1. **Benchmark side:**
   - update `benchmarks/fixtures/cod-test/benchmark.json`
   - stop requiring the old `chunkAnalysis` / `video-chunks` artifact for this fixture
   - replace it with a `wholeVideoAnalysis` entry **only if** there is matching truth + comparator support for the whole-video schema
   - otherwise temporarily drop/disable the Phase 2 artifact benchmark for cod-test until whole-video truth exists

2. **Reporting side:**
   - make Phase 3 capability-aware
   - if the run produced `wholeVideoAnalysis` but not `chunkAnalysis`, do **not** run chunk-based report scripts as though they have usable chunk data
   - smallest safe behavior is either:
     - skip those report scripts with an explicit "whole-video Phase 2 not yet supported by chunk-based reporting" status, or
     - add a dedicated whole-video reporting path that reads `wholeVideoAnalysis`

### Why I do **not** recommend the "quick alias" as the real fix

A fake alias from `wholeVideoAnalysis` -> `chunkAnalysis` would be misleading because the schemas are materially different:

- `chunkAnalysis` is an array/timeseries of per-chunk emotion results
- `wholeVideoAnalysis` is a whole-asset summary with overall scores, categories, evidence moments, risks, and recommendations

Aliasing one to the other would only move the mismatch around and likely produce nonsense metrics/reports.

## Compatibility implications

### If you fix benchmark manifest only

- **Pros:** removes the immediate hard failure on missing `chunk-analysis.json`
- **Cons:** Phase 3 report outputs will still be placeholder/empty because report scripts still require `chunkAnalysis`

### If you fix reporting only

- **Pros:** avoids misleading empty `metrics/summary/final-report` outputs for whole-video runs
- **Cons:** benchmark will still abort on missing `phase2-process/chunk-analysis.json`

### If you apply the recommended narrow pair of fixes

- **Chunked pipelines remain compatible** because they still produce and benchmark `chunkAnalysis`
- **Whole-video pipelines become honest**: they either benchmark/report against whole-video-aware contracts, or explicitly skip unsupported chunk-based expectations instead of fabricating empty chunk data
- **Phase-3-only whole-video reruns** will still need follow-up in `server/run-pipeline.cjs` hydration/guardrails, because that path currently only hydrates/checks `chunkAnalysis`

## Conclusion

The cod-test switch to whole-video Phase 2 was only a **producer-side** change.

The downstream contract still assumes the old chunked world in three layers:

1. **Report scripts** consume `artifacts.chunkAnalysis` only.
2. **Report smoke/final packet** still require `analysisData.data.chunkAnalysis`.
3. **Benchmark manifest + runner** still require `phase2-process/chunk-analysis.json` from `video-chunks`.

So the pipeline is currently split-brain:

- producer: whole-video
- consumers: chunk-analysis

That split is the reason reporting degraded to empty placeholders and benchmark hard-failed on the missing chunk-analysis artifact.
