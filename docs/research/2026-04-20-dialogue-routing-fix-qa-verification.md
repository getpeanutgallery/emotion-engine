# dialogue routing fix QA verification

Date: 2026-04-20  
Role: QA verification for bead `ee-eq3c`

## Scope

Verify the post-fix benchmark-routing change for the `cod-test` dialogue comparison surface without doing another implementation pass.

Questions answered:

1. Do both benchmark manifests now route `dialogueData` through `runtimeArtifactKey: "dialogueV3SourceTruth"`?
2. Does `dialogueData` now resolve to `output/cod-test/phase1-gather-context/dialogue-v3-source-truth.reconciled.json`?
3. Is the old legacy-vs-v3 structural mismatch lane gone from the dialogue surface?
4. Are the remaining reds now honest v3-vs-truth content drift rather than contract-family drift?

## Files inspected / refreshed

- `benchmarks/fixtures/cod-test/benchmark.json`
- `benchmarks/fixtures/cod-test/dialogue-only/benchmark.json`
- `output/cod-test/phase1-gather-context/dialogue-v3-source-truth.reconciled.json`
- `benchmarks/fixtures/cod-test/dialogue-only/_reports/artifact-results/dialogueData.json`
- `benchmarks/fixtures/cod-test/dialogue-only/_reports/benchmark-summary.json`
- `benchmarks/fixtures/cod-test/_reports/artifact-results/dialogueData.json`
- `benchmarks/fixtures/cod-test/_reports/benchmark-summary.json`
- `docs/research/2026-04-20-dialogue-data-residual-audit.md`

## Reruns performed

### 1) Targeted dialogue-only benchmark refresh

```bash
node - <<'NODE'
const path=require('path');
const { loadConfig } = require('./server/lib/config-loader.cjs');
const { runBenchmarkStage } = require('./server/lib/benchmark-runner.cjs');
const { resolvePhase1ArtifactPath } = require('./server/lib/phase1-baseline-resolution.cjs');
(async()=>{
  const configPath = path.resolve('configs/cod-test.yaml');
  const config = await loadConfig(configPath);
  const outputDir = path.resolve(config.asset.outputDir);
  const probe = resolvePhase1ArtifactPath(outputDir, 'dialogueData', { config, strict: true, aliasArtifactKey: 'dialogueV3SourceTruth' });
  const dialogueOnlyConfig = {
    ...config,
    benchmark: {
      enabled: true,
      path: '../benchmarks/fixtures/cod-test/dialogue-only/benchmark.json'
    }
  };
  const result = runBenchmarkStage({ config: dialogueOnlyConfig, configPath, outputDir });
  console.log(JSON.stringify({ probe, status: result.status, summary: result.summary }, null, 2));
})().catch(err=>{console.error(err); process.exit(1);});
NODE
```

Observed result:

- `probe.resolvedPath` = `output/cod-test/phase1-gather-context/dialogue-v3-source-truth.reconciled.json`
- report status = `fail`
- summary = `0/1 artifacts passed. 104/288 scoreable fields passed. Truth coverage was 288/298 fields. reconciled contract mismatch=184.`
- refreshed report output = `benchmarks/fixtures/cod-test/dialogue-only/_reports/artifact-results/dialogueData.json`

### 2) Full cod-test benchmark refresh against existing runtime output

```bash
node - <<'NODE'
const path=require('path');
const { loadConfig } = require('./server/lib/config-loader.cjs');
const { runBenchmarkStage } = require('./server/lib/benchmark-runner.cjs');
(async()=>{
  const configPath = path.resolve('configs/cod-test.yaml');
  const config = await loadConfig(configPath);
  const outputDir = path.resolve(config.asset.outputDir);
  const result = runBenchmarkStage({ config, configPath, outputDir });
  console.log(JSON.stringify({ status: result.status, summary: result.summary }, null, 2));
})().catch(err=>{console.error(err); process.exit(1);});
NODE
```

Observed result:

- overall benchmark status = `error` because non-dialogue artifacts are still red/errored
- dialogue artifact inside the full run matches the targeted rerun:
  - output surface = `reconciled`
  - output path = `output/cod-test/phase1-gather-context/dialogue-v3-source-truth.reconciled.json`
  - `104/288` scoreable dialogue fields passed
  - `184` remaining dialogue fails
  - `0` dialogue errors

## Verification results

### 1) Manifest routing fix is present in both benchmark manifests

Confirmed in both:

- `benchmarks/fixtures/cod-test/benchmark.json`
- `benchmarks/fixtures/cod-test/dialogue-only/benchmark.json`

Each dialogue artifact entry now keeps:

- `artifactKey: "dialogueData"`
- `runtimeArtifactKey: "dialogueV3SourceTruth"`

That is the intended contract: keep the scored artifact identity as `dialogueData`, but resolve runtime output through the v3 source-truth family.

### 2) dialogueData now resolves to the reconciled v3 source-truth artifact

Confirmed two ways:

1. Direct resolver probe via `resolvePhase1ArtifactPath(... aliasArtifactKey: 'dialogueV3SourceTruth')`
2. Refreshed artifact report output path in `benchmarks/fixtures/cod-test/dialogue-only/_reports/artifact-results/dialogueData.json`

Both point at:

- `output/cod-test/phase1-gather-context/dialogue-v3-source-truth.reconciled.json`

So the routing fix is active in real benchmark execution, not just in the manifest text.

### 3) The old legacy-vs-v3 mismatch lane is gone on the dialogue surface

The earlier residual audit recorded `77` dialogue-side errors, including `75` non-deferred legacy-vs-v3 shape mismatches plus `2` deferred paths.

After the routing fix and this QA rerun, the targeted dialogue-only report now shows:

- `failedFields = 184`
- `erroredFields = 0`
- `errors = []`
- mismatch classifications only under `reconciled_post_processing_contract_mismatch`

That means the old structural contract-family lane is no longer what the dialogue benchmark is complaining about. The benchmark is now comparing the v3-shaped runtime family instead of exploding on legacy-vs-v3 shape drift.

### 4) Remaining red is honest, but it is not green

This is **not** a green result. The dialogue surface still fails decisively.

What stayed red:

- summary wording still claims dialogue is "interspersed with song lyrics"
- dialogue segment count still differs (`truth=20`, `output=17`)
- transcript text still drifts (for example the opener is truncated to `They want you afraid.` instead of `They want you afraid. Fear makes you easier to control.`)
- v3 trait fields still disagree heavily (`audibility`, `gender_presentation`, `age_impression`, `pitch_band`, `phonation`, `pace`, `energy`, etc.)

Why this red is more honest now:

- the failures are no longer dominated by "wrong artifact family" structural errors
- the report is explicitly scoring the reconciled v3 dialogue surface
- the failure classification is now a single family: `reconciled_post_processing_contract_mismatch`
- that means the red is about actual v3 runtime content vs truth disagreement, not about accidentally routing `dialogueData` through the old legacy family

## QA verdict

**Pass for the routing fix. Fail for overall dialogue parity.**

That is the honest split:

- **Pass:** the benchmark-routing fix works and materially improves the dialogue comparison surface by removing the old contract-family mismatch lane.
- **Still fail:** dialogue content/summary/trait parity remains red, and the benchmark should stay red until that drift is actually corrected.

## What improved

- `dialogueData` now routes through `runtimeArtifactKey: "dialogueV3SourceTruth"` in both benchmark manifests.
- The runtime resolver now lands on `dialogue-v3-source-truth.reconciled.json`.
- The old legacy-vs-v3 structural error lane disappeared from the refreshed dialogue report.
- The dialogue benchmark is now scoring the intended v3/reconciled family instead of getting trapped in contract-family drift.

## What did not improve

- Summary content remains outdated and still references song lyrics in the dialogue lane.
- Dialogue segment alignment/count still does not match truth.
- Many transcript and trait fields still drift against truth.
- The dialogue-only benchmark remains red at `104/288` scoreable fields passed.

## Handoff for primary bead `ee-ucs4`

Recommended consolidation message:

- Treat Task 3 as **QA-passed for routing verification** and **still red for content parity**.
- The material improvement is real: the benchmark is now comparing the correct v3/reconciled dialogue artifact family.
- The remaining residual lane is now honest downstream content drift: summary wording, transcript segmentation/text alignment, and v3 trait parity.
- Do **not** claim the dialogue benchmark is fixed overall; claim only that the routing/contract-family fix landed and exposed the real remaining v3-vs-truth work.
