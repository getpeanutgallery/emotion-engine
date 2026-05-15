# Phase 3 rerun summary

**Date:** 2026-05-14
**Bead:** `ee-gec0`
**Role:** `coder`

## Validation lane chosen

Used the smallest honest rerun lane for the repaired Phase 3 consumers:

1. **Phase 3-only pipeline rerun** against the already-repaired fresh `cod-test` packet in `output/cod-test`
2. **Benchmark refresh against the existing runtime outputs** using the canonical `configs/cod-test.yaml` benchmark manifest

This was sufficient because the code changes under validation were Phase 3/report consumer changes only. Re-running Phase 1/2 would not have produced more truthful evidence for this bead.

## Exact commands run

```bash
node server/run-pipeline.cjs --config configs/archive/cod-test-phase3.yaml --verbose
```

```bash
node - <<'EOF'
const path = require('path');
const yaml = require('js-yaml');
const fs = require('fs');
const { runBenchmarkStage } = require('./server/lib/benchmark-runner.cjs');
const configPath = path.resolve('configs/cod-test.yaml');
const config = yaml.load(fs.readFileSync(configPath, 'utf8'));
(async () => {
  const result = await runBenchmarkStage({ config, configPath, outputDir: path.resolve('output/cod-test') });
  console.log(JSON.stringify({
    status: result.status,
    summary: result.summary,
    reportDir: result.reportDir,
    summaryPath: result.summaryPath
  }, null, 2));
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
EOF
```

## Output paths refreshed

Phase 3 rerun outputs:
- `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/output/cod-test/phase3-report/metrics/metrics.json`
- `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/output/cod-test/phase3-report/recommendation/recommendation.json`
- `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/output/cod-test/phase3-report/emotional-analysis/emotional-data.json`
- `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/output/cod-test/phase3-report/summary/summary.json`
- `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/output/cod-test/phase3-report/summary/FINAL-REPORT.md`

Benchmark refresh outputs:
- `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/benchmarks/fixtures/cod-test/_reports/benchmark-summary.json`
- `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/benchmarks/fixtures/cod-test/_reports/benchmark-summary.md`
- `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/benchmarks/fixtures/cod-test/_reports/artifact-results/recommendationData.json`
- `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/benchmarks/fixtures/cod-test/_reports/artifact-results/metricsData.json`
- `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/benchmarks/fixtures/cod-test/_reports/artifact-results/emotionalAnalysisData.json`

## Rerun results

### Phase 3-only pipeline result

- Command status: **success**
- Scripts executed: **5/5**
- Phase 3 artifacts regenerated successfully
- Pipeline benchmark stage: **skipped intentionally** in the phase3-only config because that config has no benchmark block

### Refreshed report/consumer evidence

`metrics.json` now reflects the repaired exact-score normalization semantics:
- boredom average: **0.26428571428571423**
- boredom highest timestamp: **125** with score **0.8**
- boredom lowest timestamp: **95** with score **0.1**
- boredom trend: **stable**
- boredom first-half average: **0.2642857142857141**
- boredom second-half average: **0.2642857142857141**

`emotional-data.json` now reflects the repaired downstream semantics:
- critical moments count: **9**
- average scroll risk: **0.4064285714285719**
- highest boredom/scroll-risk lane is the late promo stretch at **120-130s**, not the false action-window spikes
- the previous false boredom-threshold-high moments around **95s** and **115s** are gone
- `95-100s` now reads as low boredom (**0.1**) / high excitement (**1.0**) instead of fabricated boredom dominance

`FINAL-REPORT.md` presentation drift improved:
- aggregate metrics are now labeled **`Average Score (0-1 normalized)`** instead of falsely labeled `1-10`
- recommendation prose now uses one-based chunk references in the report body (for example, title-card issue at **Chunk 4** and pre-order drag at **Chunks 26 and 27**)

### Refreshed benchmark result

Overall benchmark after rerun:
- status: **error**
- totals: **0/8 artifacts passed**
- accuracy: **2163/3242 scoreable fields passed (66.7%)**
- coverage: **3242/3454 truth fields scoreable (93.9%)**

Phase 3 artifact classes after refresh:

| Artifact | Before | After | Notes |
| --- | --- | --- | --- |
| `recommendationData` | `error`, accuracy **15.0%**, coverage **55.6%** | `error`, accuracy **18.8%**, coverage **44.4%** | Slight accuracy improvement, still heavily benchmark-red and model-output-sensitive. |
| `metricsData` | `fail`, accuracy **74.3%**, peak moments **58.3%**, trends **75.0%** | `fail`, accuracy **65.7%**, peak moments **41.7%**, trends **66.7%** | Benchmark score worsened because stale truth still expects the pre-fix wrong semantics. Runtime semantics improved. |
| `emotionalAnalysisData` | `error`, accuracy **74.0%**, chunk emotions **81.9%**, arc **67.4%**, critical moments **0.0%** | `error`, accuracy **69.8%**, chunk emotions **79.7%**, arc **64.8%**, critical moments **0.0%** | Benchmark score worsened for the same reason: truthful repaired outputs moved farther from stale benchmark truth. Ignored diffs dropped from **6** to **3**. |

## Did the previously failing Phase 3 artifact classes improve?

**Yes in product/runtime truth, not in benchmark parity.**

Improved real Phase 3 consumer behavior:
- `metricsData` no longer treats upstream exact score `1` as normalized `1.0`
- `emotionalAnalysisData` no longer fabricates boredom spikes in the action-heavy `95-100s` and `115-120s` windows
- the late promo drag at `120-130s` is now the real dominant boredom/friction lane
- `FINAL-REPORT.md` no longer mislabels normalized averages as `1-10`
- `FINAL-REPORT.md` now presents human-facing chunk references consistently

What did **not** improve materially:
- benchmark pass/fail state remained red
- `metricsData` and `emotionalAnalysisData` benchmark percentages worsened because the truth fixtures still encode the older, pre-repair semantic expectations
- `recommendationData` remains benchmark-red; it improved slightly in raw benchmark accuracy, but still reads as benchmark-truth drift plus live-model variance rather than a clean pass

## Benchmark debt vs current Phase 3 consumer drift

What this rerun revalidated:
- the repaired Phase 3 consumers run successfully on the fresh `cod-test` packet
- the repaired consumers now emit semantically consistent metrics/emotional-analysis/final-report outputs against the current Phase 2 artifact shape

What remains benchmark debt rather than fresh proof of Phase 3 consumer drift:
- `metricsData` benchmark expectations tied to the stale exact-`1` interpretation
- `emotionalAnalysisData` truth expectations for old critical-moment / scroll-risk sets
- much of `recommendationData` truth wording/list parity

## Bottom line

The narrow rerun succeeded and proves the **Phase 3 consumer repairs are live on the fresh packet**. The repaired artifacts are more truthful to current upstream data, but the canonical benchmark remains red because the benchmark truth for the Phase 3 classes still lags the repaired semantics.
