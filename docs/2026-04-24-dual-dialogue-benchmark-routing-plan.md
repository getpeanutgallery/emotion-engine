# Dual dialogue benchmark routing plan

**Date:** 2026-04-24  
**Status:** Proposed implementation memo

## Recommendation

Adopt a **dual-surface dialogue benchmark model** with one primary spoken-dialogue benchmark and one diagnostic raw-capture benchmark:

1. **Primary:** benchmark the reconciled spoken-dialogue output against the reconciled spoken-dialogue truth.
2. **Diagnostic:** benchmark the raw/original dialogue capture against a raw/mixed dialogue truth that may still contain sung-vocal contamination.

This matches the product architecture Derrick clarified: lyric contamination is tolerated in the first/raw capture because suppressing it too early can drop real dialogue; lyric stripping belongs to the later reconciliation step.

## Current state observed

- `benchmarks/fixtures/cod-test/benchmark.json` currently defines only **one** dialogue benchmark artifact:
  - benchmark artifact key: `dialogueData`
  - runtime artifact key: `dialogueV3SourceTruth`
  - truth path: `truth/dialogue-data.json`
- `server/lib/phase1-baseline-resolution.cjs` currently auto-selects the **reconciled** phase-1 artifact whenever famous-song reconciliation is configured.
- `server/lib/benchmark-runner.cjs` therefore treats dialogue as a single benchmark lane and reports it as a single artifact surface in:
  - `benchmarks/fixtures/cod-test/_reports/artifact-results/dialogueData.json`
  - `benchmarks/fixtures/cod-test/_reports/benchmark-summary.md`
- `benchmarks/fixtures/cod-test/truth/dialogue-data.json` is already the active **spoken-dialogue** gold surface and should remain the primary benchmark truth for backward compatibility.

## Proposed truth file layout

Keep the current reconciled/spoken truth filename as the stable primary surface, and add one new raw diagnostic truth file.

### Primary spoken-dialogue truth (keep existing path)
- `benchmarks/fixtures/cod-test/truth/dialogue-data.json`
- Meaning: **reconciled spoken-dialogue truth**
- Ownership: spoken dialogue only; sung-vocal text stripped
- Report role: **primary**

### New raw/mixed dialogue truth
- `benchmarks/fixtures/cod-test/truth/dialogue-data.raw.json`
- Meaning: **raw/original dialogue capture truth**
- Ownership: what the initial capture is allowed to contain before reconciliation, including lyric/sung-vocal contamination when it is genuinely present in the raw lane
- Report role: **diagnostic**

### Truth-authoring rule
- `dialogue-data.raw.json` should start from the actual intended pre-reconciliation capture surface, not from a hand-cleaned spoken-only rewrite.
- `dialogue-data.json` remains the human-reviewed spoken-dialogue gold surface.
- The two files should intentionally diverge only where reconciliation is expected to strip or normalize raw capture material (for example sung lyrics/chants, raw split/merge quirks if intentionally preserved, and any raw-only contamination retained for diagnostics).

## Proposed benchmark manifest shape

### Keep the primary artifact key stable
Preserve `dialogueData` as the primary reconciled spoken-dialogue benchmark artifact so downstream report consumers do not lose the existing key.

### Add a second diagnostic artifact entry
Add a second manifest entry dedicated to the raw surface.

#### Proposed manifest entries

```json
{
  "artifactKey": "dialogueData",
  "runtimeArtifactKey": "dialogueV3SourceTruth",
  "label": "Phase 1 dialogue (primary spoken, reconciled)",
  "phase": "phase1-gather-context",
  "script": "get-dialogue",
  "truth": { "path": "truth/dialogue-data.json" },
  "benchmarkRouting": {
    "runtimeArtifactSurface": "reconciled",
    "truthSurface": "spoken_reconciled",
    "reportSurface": "primary"
  },
  "comparator": {
    "kind": "json-structured",
    "profile": "dialogue-default",
    "options": {
      "timingToleranceSeconds": 2,
      "unknownSentinels": ["unknown", "ambiguous"]
    }
  },
  "required": true
}
```

```json
{
  "artifactKey": "dialogueDataRaw",
  "runtimeArtifactKey": "dialogueV3SourceTruth",
  "label": "Phase 1 dialogue (diagnostic raw capture)",
  "phase": "phase1-gather-context",
  "script": "get-dialogue",
  "truth": { "path": "truth/dialogue-data.raw.json" },
  "benchmarkRouting": {
    "runtimeArtifactSurface": "raw",
    "truthSurface": "raw_capture",
    "reportSurface": "diagnostic"
  },
  "comparator": {
    "kind": "json-structured",
    "profile": "dialogue-default",
    "options": {
      "timingToleranceSeconds": 2,
      "unknownSentinels": ["unknown", "ambiguous"]
    }
  },
  "required": true
}
```

## Required runner/resolver changes

The current manifest model is missing one important degree of freedom: it conflates **benchmark artifact identity** with **runtime output selection**.

### 1) Add explicit runtime surface routing
Add a manifest field such as:
- `benchmarkRouting.runtimeArtifactSurface: "raw" | "reconciled" | "canonical"`

Recommended semantics:
- `raw` = always use the raw phase-1 artifact path
- `reconciled` = always use the reconciled phase-1 artifact path
- `canonical` = preserve today’s behavior (use reconciled when reconciliation is configured, else raw)

### 2) Keep `artifactKey` as the report/result key
`artifactKey` should remain the unique benchmark report key and output filename stem.

### 3) Treat `runtimeArtifactKey` as the source family selector
That allows two benchmark entries to point at the same produced artifact family (`dialogueV3SourceTruth`) while choosing different surfaces (`raw` vs `reconciled`).

### 4) Surface routing metadata in results
Each artifact result should include explicit boundary metadata like:

```json
"comparisonBoundary": {
  "comparisonMode": "dual-dialogue-surface",
  "outputSurface": "raw",
  "truthSurface": "raw_capture",
  "reportSurface": "diagnostic",
  "runtimeArtifactKey": "dialogueV3SourceTruth"
}
```

and for the primary lane:

```json
"comparisonBoundary": {
  "comparisonMode": "dual-dialogue-surface",
  "outputSurface": "reconciled",
  "truthSurface": "spoken_reconciled",
  "reportSurface": "primary",
  "runtimeArtifactKey": "dialogueV3SourceTruth"
}
```

### 5) Do not reuse the current provisional posture label for this
The existing `phase1-dialogue-provisional` posture and `reconciled_post_processing_contract_mismatch` labeling describe a different concern. For the dual-surface model, use explicit raw/reconciled routing metadata rather than overloading the provisional classification.

## Report naming and presentation

### Artifact result files
Recommend:
- primary spoken/reconciled result: `benchmarks/fixtures/cod-test/_reports/artifact-results/dialogueData.json`
- raw diagnostic result: `benchmarks/fixtures/cod-test/_reports/artifact-results/dialogueDataRaw.json`

### Benchmark summary markdown/json
Render dialogue as a grouped section with clear priority:

- **Dialogue (primary spoken benchmark)**
  - artifact: `dialogueData`
  - compares: reconciled runtime output -> `truth/dialogue-data.json`
  - headline dialogue percentages shown first
- **Dialogue (diagnostic raw capture benchmark)**
  - artifact: `dialogueDataRaw`
  - compares: raw runtime output -> `truth/dialogue-data.raw.json`
  - shown after the primary lane and labeled diagnostic

### Reporting rule
- The **reconciled spoken-dialogue surface is the primary report surface**.
- The **raw capture surface is diagnostic only**.
- The raw surface should never replace the reconciled surface as the top-line product-facing dialogue benchmark.

## Backward-compatibility notes

1. **Keep `truth/dialogue-data.json` as-is conceptually**
   - It remains the primary spoken-dialogue truth.
   - Existing references to `dialogueData` as the main dialogue benchmark continue to make sense.

2. **Keep `artifactKey: dialogueData` as the primary artifact**
   - This preserves current report consumers, filenames, and mental model for the main benchmark lane.

3. **Add, do not rename, the raw diagnostic lane**
   - New benchmark artifact: `dialogueDataRaw`
   - New truth file: `truth/dialogue-data.raw.json`

4. **Preserve existing dialogue scoring fields**
   - Keep `dialogue_text_full_transcript_pct`
   - Keep `dialogue_text_windowed_pct`
   - Keep `dialogue_boundary_pct`
   - Reuse the same scoring family on both surfaces; only the routed truth/output pair changes.

5. **Avoid breaking current report parsing**
   - Existing parsers that look for `dialogueData` continue to see the primary benchmark.
   - New consumers can optionally read `dialogueDataRaw`.

## Validation strategy

### Fixture truth validation
1. Author `truth/dialogue-data.raw.json` for `cod-test`.
2. Verify the raw truth intentionally includes the sung-vocal contamination that the raw lane is allowed to capture.
3. Verify `truth/dialogue-data.json` remains spoken-only and lyric-stripped.

### Resolver/runner validation
1. Add tests for raw/reconciled surface routing in `server/lib/phase1-baseline-resolution.cjs` and `test/lib/benchmark-runner.test.js`.
2. Assert that the primary dialogue artifact selects:
   - runtime surface: reconciled
   - truth surface: spoken/reconciled
3. Assert that the diagnostic dialogue artifact selects:
   - runtime surface: raw
   - truth surface: raw/mixed

### Benchmark behavior validation
Use a targeted fixture where:
- raw output contains lyric leakage
- reconciled output removes the lyric leakage
- raw truth includes it
- reconciled truth excludes it

Expected outcomes:
- `dialogueDataRaw` passes or scores honestly high on the raw lane
- `dialogueData` passes or scores honestly high on the reconciled spoken lane
- cross-routing should fail honestly if wired incorrectly:
  - raw output vs reconciled truth should show contamination drift
  - reconciled output vs raw truth should show expected missing raw-only material

### Report validation
1. Regenerate cod-test benchmark reports.
2. Confirm `benchmark-summary.md` lists reconciled spoken dialogue first and labels it primary.
3. Confirm raw capture appears separately and is labeled diagnostic.
4. Confirm both artifact JSONs include explicit `comparisonBoundary` routing metadata.

## Implementation-ready notes

1. Add `truth/dialogue-data.raw.json`.
2. Extend manifest validation to allow a `benchmarkRouting` block.
3. Extend phase-1 artifact resolution to honor forced raw vs forced reconciled routing instead of only today’s canonical auto-selection.
4. Add a second dialogue artifact entry `dialogueDataRaw` to the benchmark manifest.
5. Keep `dialogueData` as the primary reconciled spoken benchmark key.
6. Update markdown summary rendering to group dialogue surfaces and mark **primary** vs **diagnostic** explicitly.
7. Add routing/unit tests plus one cod-style dual-surface regression that proves raw and reconciled surfaces each benchmark against their correct truth family.

## Bottom line

- **Primary truth/report surface:** `truth/dialogue-data.json` <- reconciled runtime dialogue output (`dialogue-v3-source-truth.reconciled.json`)
- **Diagnostic truth/report surface:** `truth/dialogue-data.raw.json` <- raw runtime dialogue output (`dialogue-v3-source-truth.json`)
- **Primary benchmark artifact key stays:** `dialogueData`
- **New diagnostic artifact key:** `dialogueDataRaw`
- **Required architecture change:** explicit per-artifact runtime surface routing in the manifest/resolver so raw and reconciled dialogue can be benchmarked independently against their corresponding truth surfaces.
