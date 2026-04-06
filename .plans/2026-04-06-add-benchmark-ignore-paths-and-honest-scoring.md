# emotion-engine: add benchmark ignore-path support and make scoring more honest without hiding real errors

**Date:** 2026-04-06  
**Status:** Draft  
**Agent:** Cookie 🍪

---

## Goal

Add a first-class benchmark truth mechanism for marking selected paths as ignored for core scoring, update the comparator/reporting flow to honor it, and validate that the resulting scores become more honest without masking real dialogue or `music-vocals` mistakes.

---

## Overview

The latest review showed that the current benchmark scoring overstates the real quality gap in two important ways: it penalizes output-only operational metadata, and it compares segment arrays too rigidly once early merge/split drift occurs. Derrick agrees with the first fix direction immediately: benchmark truth should be able to mark certain fields or subtrees as not used for scoring.

The clean design is to make this an explicit benchmark-truth contract feature rather than a comparator special case. The current leading idea is a top-level block such as `_benchmark.ignorePaths`, allowing each truth file to declare paths or subtrees that should be excluded from core scoring. The comparator should then skip those paths for pass/fail while still surfacing them separately in reports if helpful.

This lane should start narrow and safe. First, inspect the current benchmark/comparator implementation and identify the minimal architecture for `ignorePaths`. Second, design the exact truth-file shape and comparator behavior, including whether ignored differences still appear in reports. Third, implement the support in the benchmark tooling. Fourth, apply it to the most obvious output-only operational metadata paths in the relevant truth files. Fifth, run focused validation and compare before/after scoring so we can confirm the score becomes more honest without accidentally hiding substantive errors.

---

## Tasks

### Task 1: Design the benchmark truth annotation and comparator behavior for ignored paths

**Bead ID:** `ee-89mu`  
**SubAgent:** `research`  
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, inspect the current benchmark truth/comparator implementation and design the exact plan for adding truth-declared ignored scoring paths. Focus on a top-level mechanism like _benchmark.ignorePaths. Document where the comparator should read it, whether it should support subtree/wildcard paths, how ignored differences should appear in reports, and how to keep strict regression visibility without counting ignored paths in the core score. Update this plan truthfully with the exact files involved, proposed schema shape, and design decisions. Do not change code yet.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `benchmarks/fixtures/`
- `server/`
- `test/`

**Files Created/Deleted/Modified:**
- `.plans/2026-04-06-add-benchmark-ignore-paths-and-honest-scoring.md`
- `server/lib/benchmark-runner.cjs` (planned comparator/reporting changes)
- `test/lib/benchmark-runner.test.js` (planned focused comparator coverage)
- `benchmarks/fixtures/cod-test/benchmark.json` (planned cleanup/migration of comparator-owned ignore paths)
- `benchmarks/fixtures/cod-test/fixture.json` (planned note refresh if manifest-owned ignore-path wording changes)
- `benchmarks/fixtures/cod-test/truth/dialogue-data.json`
- `benchmarks/fixtures/cod-test/truth/music-vocals-data.json`
- `benchmarks/fixtures/cod-test/truth/recommendation.json`
- `benchmarks/fixtures/cod-test/truth/chunk-analysis.json`
- `benchmarks/fixtures/cod-test/truth/metrics.json`
- `benchmarks/fixtures/cod-test/truth/emotional-analysis.json`

**Status:** ✅ Complete

**Results:** Inspected `server/lib/benchmark-runner.cjs`, the existing cod-test manifest/truth files, and the focused benchmark tests. Current behavior already supports comparator-owned `ignorePaths` declared in `benchmarks/fixtures/cod-test/benchmark.json`, matched by exact JSON-path strings plus `[*]` array-index wildcard normalization in `isIgnoredPath()`. The runner ignores an exact path match at any container boundary, so a path like `$.ai` already behaves as a subtree ignore because the walker stops at `ai` and skips every descendant leaf. There is no broader prefix-glob or `**` support today, and the design should keep it that way for now.

Agreed narrow truth-side schema: each truth JSON may optionally declare a top-level `_benchmark` object with `_benchmark.ignorePaths: string[]`. Example:

```json
{
  "_benchmark": {
    "ignorePaths": [
      "$.analysisMode",
      "$.timingMode",
      "$.sourceStrategy",
      "$.coverage",
      "$.provenance"
    ]
  },
  "dialogue_segments": [ ... ]
}
```

Design decisions:
- `_benchmark` is truth-only metadata and must be stripped from the truth payload before structural comparison so the output is not forced to echo benchmark directives.
- The runner should read `_benchmark.ignorePaths` in `server/lib/benchmark-runner.cjs` immediately after loading the truth JSON for each artifact, validate it as a string array, and merge it with any existing comparator-owned `artifact.comparator.options.ignorePaths` for backward compatibility.
- Supported path syntax stays intentionally narrow: exact root-relative paths plus `[*]` array wildcard segments, with subtree ignore achieved by naming the container path itself (for example `$.coverage` or `$.criticalMoments[*].context`). No recursive wildcards, prefix globs, or partial-property matching.
- Ignored paths must not contribute to `scoreableFields`, failures, or hard errors, but ignored *differences* should still be visible in reports. The narrow reporting plan is to keep ignored truth leaves classified as skipped while also surfacing a dedicated `ignoredDifferences` section/count in artifact results and aggregate summary for cases where ignored subtrees actually differ, including missing/extra fields under those ignored containers.
- This preserves strict regression visibility: semantic regressions outside the declared ignored paths still fail exactly as before, while operational metadata churn is excluded from core scoring but remains auditable in reports.

Concretely, Task 2 should implement truth-directive extraction/validation + merged effective ignore paths in `server/lib/benchmark-runner.cjs`, add focused tests in `test/lib/benchmark-runner.test.js`, and keep comparator-option support as compatibility glue. Task 3 should migrate the existing cod-test ignore-path declarations into truth files and add new conservative metadata ignores for `dialogue-data.json` and `music-vocals-data.json` only where the fields are clearly operational (`analysisMode`, `timingMode`, `sourceStrategy`, `coverage`, `provenance`).

---

### Task 2: Implement ignore-path support in benchmark tooling

**Bead ID:** `ee-rej4`  
**SubAgent:** `coder`  
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, after the ignore-path design is complete, implement the agreed benchmark truth mechanism for ignored scoring paths. Update the relevant comparator/reporting code so ignored paths do not count against the core score, while preserving useful visibility in reports. Keep the implementation narrow, update this plan truthfully with the exact files and behavior changes, and add bead IDs before closing the bead.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `server/`
- `test/`
- `benchmarks/`

**Files Created/Deleted/Modified:**
- `.plans/2026-04-06-add-benchmark-ignore-paths-and-honest-scoring.md`
- `server/lib/benchmark-runner.cjs`
- `test/lib/benchmark-runner.test.js`

**Status:** ✅ Complete

**Results:** Implemented truth-declared ignore-path support in `server/lib/benchmark-runner.cjs` without widening the benchmark contract beyond the planned narrow seam. The runner now:
- reads an optional top-level `_benchmark` block from each truth JSON,
- accepts only `_benchmark.ignorePaths` for now,
- strips `_benchmark` out of the truth payload before structural comparison,
- validates truth-declared ignore paths as a string array,
- merges truth-declared ignore paths with legacy `artifact.comparator.options.ignorePaths` for backward compatibility, and
- records the merged result in `artifactResult.comparator.directives` (`comparatorIgnorePaths`, `truthIgnorePaths`, `effectiveIgnorePaths`).

Report behavior was tightened to preserve visibility without scoring ignored operational metadata:
- ignored paths still become skipped truth leaves, so they stay out of `scoreableFields`,
- ignored subtrees are recursively scanned for actual differences,
- those non-scoring differences are emitted into a new `ignoredDifferences` array plus `counts.ignoredDifferenceFields`, and
- aggregate benchmark summary/markdown now surface ignored-difference counts per artifact and in totals.

Focused tests added in `test/lib/benchmark-runner.test.js` cover:
- truth-declared `_benchmark.ignorePaths` working without comparator-owned `ignorePaths`,
- `_benchmark` being stripped instead of causing output-structure failures,
- ignored subtree differences still appearing in reports (including extra output fields under an ignored container),
- extra output-only fields being suppressed when truth omits them but `_benchmark.ignorePaths` explicitly names them, and
- fast failure on invalid truth `_benchmark.ignorePaths`.

During Task 4 validation I found one missing edge case: truth-declared ignore paths were not yet suppressing **extra output fields** when the truth intentionally omitted those fields entirely (for example `analysisMode` existing only in output). I fixed that in `server/lib/benchmark-runner.cjs` by honoring ignored paths during the object/array extra-item checks, then extended the focused tests accordingly.

Validation run for this implementation step:
- `node --test test/lib/benchmark-runner.test.js`
- Result: 16/16 passing.

---

### Task 3: Apply ignore paths to the obvious output-only operational metadata in truth files

**Bead ID:** `ee-4irh`  
**SubAgent:** `coder`  
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, after ignore-path support is implemented, add the agreed _benchmark.ignorePaths annotations to the relevant benchmark truth files for output-only operational metadata (for example analysisMode, timingMode, sourceStrategy, coverage, provenance where appropriate). Keep the set conservative and explicit, and update this plan truthfully with the exact paths added to each truth file. Do not overreach into semantic content.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `benchmarks/fixtures/`

**Files Created/Deleted/Modified:**
- `.plans/2026-04-06-add-benchmark-ignore-paths-and-honest-scoring.md`
- `benchmarks/fixtures/cod-test/benchmark.json`
- `benchmarks/fixtures/cod-test/fixture.json`
- `benchmarks/fixtures/cod-test/truth/dialogue-data.json`
- `benchmarks/fixtures/cod-test/truth/music-data.json`
- `benchmarks/fixtures/cod-test/truth/music-vocals-data.json`
- `benchmarks/fixtures/cod-test/truth/recommendation.json`
- `benchmarks/fixtures/cod-test/truth/chunk-analysis.json`
- `benchmarks/fixtures/cod-test/truth/metrics.json`
- `benchmarks/fixtures/cod-test/truth/emotional-analysis.json`

**Status:** ✅ Complete

**Results:** Added conservative truth-side `_benchmark.ignorePaths` annotations to the cod-test fixture and migrated the existing manifest-owned ignore-path declarations into the truth files.

Exact truth annotations added:
- `benchmarks/fixtures/cod-test/truth/dialogue-data.json`
  - `$.analysisMode`
  - `$.timingMode`
  - `$.sourceStrategy`
  - `$.coverage`
  - `$.provenance`
- `benchmarks/fixtures/cod-test/truth/music-data.json`
  - `$.analysisMode`
  - `$.timingMode`
  - `$.sourceStrategy`
  - `$.coverage`
  - `$.provenance`
- `benchmarks/fixtures/cod-test/truth/music-vocals-data.json`
  - `$.analysisMode`
  - `$.timingMode`
  - `$.sourceStrategy`
  - `$.coverage`
  - `$.provenance`
- `benchmarks/fixtures/cod-test/truth/recommendation.json`
  - `$.generatedAt`
  - `$.ai`
- `benchmarks/fixtures/cod-test/truth/chunk-analysis.json`
  - `$.chunks[*].tokens`
  - `$.totalTokens`
- `benchmarks/fixtures/cod-test/truth/metrics.json`
  - `$.generatedAt`
- `benchmarks/fixtures/cod-test/truth/emotional-analysis.json`
  - `$.generatedAt`
  - `$.criticalMoments[*].context`

Conservative choices / non-choices:
- I did **not** ignore `globalArc`, `qualityNotes`, recognized-song evidence, dialogue summaries, or any transcript/lyric/speaker fields, because those are closer to semantic output and should stay regression-visible.
- The new dialogue/music/music-vocals ignores are limited to operational production metadata describing run mode / coverage / provenance rather than judged content.

Supporting cleanup:
- Removed legacy `ignorePaths` entries from `benchmarks/fixtures/cod-test/benchmark.json` so the cod-test fixture now demonstrates the truth-declared mechanism directly.
- Updated `benchmarks/fixtures/cod-test/fixture.json` notes to explain that comparator profiles still live in the runner/manifest, while truth files can now declare conservative `_benchmark.ignorePaths` for output-only metadata.

---

### Task 4: Validate scoring before vs after and judge whether the score is now more honest

**Bead ID:** `ee-y841`  
**SubAgent:** `research`  
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, after ignore-path support and truth annotations are in place, run focused validation and compare before/after benchmark behavior for dialogue and music-vocals. Show what score movement came specifically from ignored operational metadata, what substantive failures remain, and whether the resulting score now better matches human judgment. Update this plan truthfully with commands, artifacts, before/after numbers, and a recommendation on whether to stop there or continue into time-aware segment alignment next.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `benchmarks/fixtures/`
- `benchmarks/fixtures/cod-test/_reports/`
- `output/`
- `test/`

**Files Created/Deleted/Modified:**
- `.plans/2026-04-06-add-benchmark-ignore-paths-and-honest-scoring.md`
- `.plans/artifacts/2026-04-06-ignore-paths-before/result.json`
- `.plans/artifacts/2026-04-06-ignore-paths-before/reports/**`
- `.plans/artifacts/2026-04-06-ignore-paths-after/result.json`
- `.plans/artifacts/2026-04-06-ignore-paths-after/reports/**`
- `benchmarks/fixtures/cod-test/_reports/**`
- `server/lib/benchmark-runner.cjs`
- `test/lib/benchmark-runner.test.js`

**Status:** ✅ Complete

**Results:** Ran focused before/after validation around the cod-test benchmark and kept the artifacts under `.plans/artifacts/` for auditability.

Commands run:
- baseline before truth annotations:
  - `node - <<'NODE' ... runBenchmarkStage({ config, configPath, outputDir }) ... NODE`
  - `cp -R benchmarks/fixtures/cod-test/_reports .plans/artifacts/2026-04-06-ignore-paths-before/reports`
- focused runner validation:
  - `node --test test/lib/benchmark-runner.test.js`
- after truth annotations + extra-output ignore fix:
  - `node - <<'NODE' ... runBenchmarkStage({ config, configPath, outputDir }) ... NODE`
  - `cp -R benchmarks/fixtures/cod-test/_reports .plans/artifacts/2026-04-06-ignore-paths-after/reports`
  - `node --test test/lib/benchmark-runner.test.js`

Key validation artifact locations:
- before aggregate: `.plans/artifacts/2026-04-06-ignore-paths-before/result.json`
- after aggregate: `.plans/artifacts/2026-04-06-ignore-paths-after/result.json`
- before artifact report: `.plans/artifacts/2026-04-06-ignore-paths-before/reports/artifact-results/<artifact>.json`
- after artifact report: `.plans/artifacts/2026-04-06-ignore-paths-after/reports/artifact-results/<artifact>.json`

Before/after for the two target artifacts:
- `dialogueData`
  - status: `error` → `error`
  - accuracy: `0.29743589743589743` → `0.29743589743589743` (no change)
  - coverage: `0.8823529411764706` → `0.9027777777777778` (**+2.04 pp**)
  - totalTruthFields: `221` → `216`
  - scoreableFields: `195` → `195`
  - erroredFields: `26` → `21`
  - ignoredDifferenceFields: `0` → `5`
  - score movement specifically attributable to ignored operational metadata: the removed hard errors were exactly `analysisMode`, `timingMode`, `sourceStrategy`, `coverage`, and `provenance`; those now show up under `ignoredDifferences` instead of contaminating the benchmark as structural failures.
- `musicVocalsData`
  - status: `error` → `error`
  - accuracy: `0.4583333333333333` → `0.4583333333333333` (no change)
  - coverage: `0.8888888888888888` → `0.9320388349514563` (**+4.31 pp**)
  - totalTruthFields: `108` → `103`
  - scoreableFields: `96` → `96`
  - erroredFields: `12` → `7`
  - ignoredDifferenceFields: `0` → `5`
  - score movement specifically attributable to ignored operational metadata: the removed hard errors were exactly `analysisMode`, `timingMode`, `sourceStrategy`, `coverage`, and `provenance`; those now show up under `ignoredDifferences` instead of structural benchmark errors.

Aggregate benchmark movement:
- status: still `error`
- totalTruthFields: `3082` → `3067`
- scoreableFields: `2958` → `2958`
- erroredFields: `78` → `63` (**-15**, matching 5 metadata-only errors each for dialogue/music/music-vocals)
- ignoredDifferenceFields: `38` → `53` (**+15**, the same fields now surfaced honestly as ignored operational differences)
- coverage rate: `0.9597663854639844` → `0.964460384740789` (**+0.47 pp**)
- accuracy rate: unchanged at `0.5091277890466531`

Substantive failures that still remain after metadata cleanup:
- `dialogueData`: missing trailing dialogue segments, speaker-profile cardinality drift, and extra/missing linked segment indexes / acoustic descriptors. These are real structural/content mismatches, not operational metadata.
- `musicVocalsData`: missing late vocal segments, recognized-song evidence/time-range drift, extra/missing matched lyrics, and quality-note differences. Again, these are substantive output disagreements, not harmless run metadata.
- `musicData` also improved by removing the same five metadata-only hard errors, but still fails on semantic fields like `globalArc`, `qualityNotes`, and song-recognition structure; I intentionally did not hide those.

Judgment: yes, the resulting score is **more honest**. The benchmark no longer penalizes the system for how an artifact was produced (`analysisMode`, `timingMode`, `sourceStrategy`, `coverage`, `provenance`) while still exposing those differences in `ignoredDifferences` for auditability. Importantly, the benchmark did **not** gain artificial accuracy: scoreable-field accuracy stayed flat for dialogue and music-vocals because the remaining problems are real content/alignment regressions.

Recommendation: **stop the ignore-path work here and continue into time-aware segment alignment next.** The metadata cleanup removed the misleading structural noise we wanted to eliminate. The remaining dialogue/music-vocals failures are dominated by segment/timeline/cardinality mismatches that broadening ignore paths would only hide. The next honest improvement is comparator work around time-aware alignment / keyed segment matching rather than adding more ignores.

---

## Final Results

**Status:** ✅ Complete

**What We Built:** Added truth-declared `_benchmark.ignorePaths` support to the benchmark runner, kept legacy comparator-owned `ignorePaths` as compatibility glue, surfaced non-scoring `ignoredDifferences` in reports, migrated the cod-test fixture to truth-declared ignores, and validated that the change removes metadata-only benchmark noise without hiding substantive dialogue/music-vocals regressions.

**Commits:**
- Not committed in this subagent run (`do not push` instruction honored).

**Lessons Learned:** Truth-declared ignores must be honored both when a truth path exists and when the output contains an extra field that the truth intentionally omits; otherwise operational metadata still leaks back in as false structural errors. Once that edge case was fixed, the remaining failures cleanly pointed at the next real problem: time-aware content alignment.

---

*Completed on 2026-04-06*
