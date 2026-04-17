# Dialogue V3 Task 8 — First Real COD Vertical Slice

Date: 2026-04-17
Bead: `ee-x7l5`
Status: Complete

## What was run

1. Claimed the bead and marked it in progress.
2. Re-ran the deterministic proof gates before the real slice:
   - `node --test test/lib/dialogue-v3-source-truth-validator.test.js test/lib/dialogue-v3-heuristics-ruleset.test.js test/lib/dialogue-v3-speaker-grouping.test.js test/lib/dialogue-v3-proof-gates.test.js`
3. Ran the full real COD pipeline with the approved posture:
   - `node server/run-pipeline.cjs --config configs/cod-test.yaml --verbose | tee .logs/cod-test-task8-20260417.log`
4. Ran the QA artifact/comparator harness:
   - `node scripts/qa/run-cod-task8-speaker-grouping.cjs`

## Exact identifiers

- Build commit: `72f614ad1c7dd11b744b921930e0c22662af0873` (`72f614a`)
- Config: `configs/cod-test.yaml`
  - sha256: `3919b9c4dca5580f0dc3a414a21519cfa8c158cae370c05346abeb817eba221a`
- Ruleset: `docs/2026-04-16-dialogue-traits-v3-speaker-grouping-heuristics-ruleset.yaml`
  - ruleset id: `default`
  - version: `3.0.0`
  - sha256: `297dd42eb86e9bd3894044484dd3f54eb854f5014a45914f6fedfff04ca4259e`
- Runtime models used by the real slice:
  - Phase 1 dialogue: `openrouter/xiaomi/mimo-v2-omni`
  - Phase 1 music: `openrouter/xiaomi/mimo-v2-omni`
  - Phase 1 music vocals: `openrouter/xiaomi/mimo-v2-omni`
  - Phase 2 whole-video: `openrouter/xiaomi/mimo-v2-omni`
- Recovery lane configured: `openrouter/google/gemini-3.1-pro-preview`
- Recovery lane used in this run: `false`

## Raw vs reconciled posture used

The grouping slice was intentionally driven from the reconciled Phase 1 dialogue surface:

- raw dialogue path: `output/cod-test/phase1-gather-context/dialogue-data.json`
- reconciled dialogue path: `output/cod-test/phase1-gather-context/dialogue-data.reconciled.json`
- reconciliation ledger: `output/cod-test/phase1-gather-context/famous-song-reconciliation.json`

For this specific run the reconciliation ledger status was `skipped` with trigger reason `hasSupportingMusicConsensus`, so raw and reconciled dialogue contents were effectively identical. Even so, the evidence and comparator posture stay pinned to the reconciled surface because that is the approved downstream ownership seam.

## Artifacts produced

### Runtime artifacts

- Validated v3 source-truth artifact:
  - `output/cod-test/phase1-gather-context/dialogue-v3-source-truth.json`
- Runtime speaker-grouping artifact:
  - `output/cod-test/phase1-gather-context/speaker-grouping.json`
- Decision ledger:
  - `output/cod-test/phase1-gather-context/speaker-grouping.decision-ledger.json`

### Comparator artifacts

- Comparator output:
  - `benchmarks/fixtures/cod-test/_reports/artifact-results/speakerGrouping.json`
- Comparator miss clusters:
  - `benchmarks/fixtures/cod-test/_reports/artifact-results/speakerGrouping.miss-clusters.json`
- Golden truth used:
  - `benchmarks/fixtures/cod-test/truth/speaker-grouping.json`

## Result summary

- Real pipeline completed end-to-end successfully.
- Proof gates were green before the real run.
- The minimal persisted v3 source-truth envelope validated successfully.
- Runtime grouping completed successfully.
- Comparator result was intentionally **not** green.

### Counts

- Runtime source-truth segment count: `18`
- Runtime grouping group count: `18`
- Runtime grouping assignment count: `18`
- Golden truth group count: `13`
- Golden truth assignment count: `20`
- Comparator mismatch count: `8`

## Honest miss-cluster read

### Cluster 1 — grouping reuse misses after source-truth conversion (`6`)

Mismatched indexes: `1, 4, 5, 8, 11, 15`

Golden truth expects these lines to reuse earlier speaker groups, but the runtime grouping artifact left every runtime segment as a singleton. The decision ledger shows why: the converted persisted v3 source-truth artifact had `unknown` for all substantive traits, so the reducer abstained on every reuse candidate and created a fresh group each time.

This is not evidence that the comparator is wrong. It is also not clean evidence that the scoring ruleset is wrong. It is primarily evidence that the current real runtime slice still lacks a truthful persisted v3 per-line trait surface for grouping to work from.

### Cluster 2 — runtime missing segment for truth index (`2`)

Missing truth indexes: `18, 19`

These are not grouping-score misses. They point to upstream extraction/segmentation drift versus the current golden truth projection: the real run produced only 18 dialogue segments while the golden truth has 20 assignments. That means part of the mismatch budget is still coming from source-truth / segmentation shape before grouping even starts.

## Key interpretation

This slice did what Task 8 needed it to do: it proved the full seam can run for real, emit the right artifacts, preserve the raw-vs-reconciled posture, and classify misses by source instead of flattening them.

What it did **not** prove is that the current runtime lane is semantically ready for grouping-quality conclusions. The dominant blocker is still upstream truth/input quality:

1. the persisted v3 runtime source-truth surface had to be synthesized by QA from reconciled dialogue output because the real pipeline still does not emit native persisted v3 traits;
2. the synthesized artifact necessarily used `unknown` defaults for all traits, which forces singleton-heavy behavior;
3. the runtime segmentation count still differs from golden truth.

So the clean read is: the execution seam is real and the evidence posture is now honest, but speaker-grouping quality is still bottlenecked by missing runtime v3 trait emission and by residual source-truth/segmentation drift.
