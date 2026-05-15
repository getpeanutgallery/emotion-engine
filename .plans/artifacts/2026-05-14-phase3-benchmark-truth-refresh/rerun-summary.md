# Phase 3 benchmark rerun summary

**Date:** 2026-05-14  
**Bead:** `ee-mezm`  
**Role:** `coder`

## Exact rerun command

```bash
node -e "(async()=>{ const path=require('path'); const { loadConfig, validateConfig } = require('./server/lib/config-loader.cjs'); const { runBenchmarkStage } = require('./server/lib/benchmark-runner.cjs'); const configPath = path.resolve('configs/cod-test.yaml'); const config = await loadConfig(configPath); const validation = validateConfig(config, { configPath }); if (!validation.valid) { console.error(JSON.stringify(validation, null, 2)); process.exit(1); } config.recovery = validation.normalizedRecovery; const result = runBenchmarkStage({ config, configPath, outputDir: path.resolve(config.asset.outputDir) }); console.log(JSON.stringify(result, null, 2)); })().catch((error)=>{ console.error(error); process.exit(1); });"
```

This reruns the benchmark stage directly against the current repaired `output/cod-test` packet and refreshed Phase 3 truth fixtures without broadening scope into another runtime report pass.

## Refreshed report paths

- Summary markdown: `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/benchmarks/fixtures/cod-test/_reports/benchmark-summary.md`
- Summary JSON: `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/benchmarks/fixtures/cod-test/_reports/benchmark-summary.json`
- Metrics artifact result: `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/benchmarks/fixtures/cod-test/_reports/artifact-results/metricsData.json`
- Emotional-analysis artifact result: `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/benchmarks/fixtures/cod-test/_reports/artifact-results/emotionalAnalysisData.json`
- Recommendation artifact result: `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/benchmarks/fixtures/cod-test/_reports/artifact-results/recommendationData.json`

## Phase 3 artifact results

### `metricsData`
- **Status:** `pass`
- **Accuracy:** `100.0%`
- **Coverage:** `97.2%`
- **Judgment:** now scores in line with current product truth.
- **What improved:** the refreshed truth now matches the repaired metrics packet, including the lower boredom average, the 55s patience/excitement peak, the 125s boredom peak, and the repaired boredom/excitement trend directions.

### `emotionalAnalysisData`
- **Status:** `pass`
- **Accuracy:** `100.0%`
- **Coverage:** `99.5%`
- **Judgment:** now scores in line with current product truth.
- **What improved:** the refreshed truth now matches the repaired emotional packet instead of the stale false-boredom story. The chunk analysis, emotional arc, and repaired critical-moment set all align with the current canonical outputs.
- **Important nuance:** the report still prints `scroll_risk_timeline_pct=0.0%` and `critical_moments_pct=0.0%`, but the artifact itself is a `pass` because all scoreable fields passed and those families are currently handled as non-scoreable structural surfaces in this comparator configuration.

### `recommendationData`
- **Status:** `pass`
- **Accuracy:** `100.0%`
- **Coverage:** `53.8%`
- **Judgment:** now scores in line with current product truth.
- **What improved:** the refreshed truth now matches the repaired recommendation story: 4 key findings, 5 suggestions, shorter concrete reasoning, and the promo-screen retention warning instead of the older stale prose surface.

## Overall rerun outcome

- Overall benchmark status remains **`error`**.
- That remaining red is **outside this Phase 3 truth-refresh lane**.
- Remaining non-Phase-3 red after the rerun:
  - `dialogueData` — `fail`
  - `dialogueDataRaw` — `fail`
  - `musicData` — `error`
  - `musicVocalsData` — `fail`
  - `chunkAnalysis` — `fail`

## Bottom line

The refreshed Phase 3 truth lane succeeded: `metricsData`, `emotionalAnalysisData`, and `recommendationData` all rerun as **passing artifacts that match the current repaired product truth**. The benchmark is still globally red, but that red is coming from older Phase 1 / music / Phase 2 benchmark debt rather than a remaining live Phase 3 truth mismatch.
