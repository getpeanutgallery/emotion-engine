# Dialogue vs music-vocals benchmark scoring audit

**Date:** 2026-04-20  
**Bead:** `ee-jmwk`  
**Scope:** Audit/explanation only; no code changes.

## Question

Does the current benchmark scoring flow intentionally account for sung-vocals content that the dialogue model leaves inside `dialogue-data`, when the benchmark design expects that content to reconcile into the separate `music-vocals` lane?

## Short answer

**Not in the currently completed run.**

Today, the benchmark system only accounts for dialogue-vs-sung-vocals leakage **indirectly through the phase-1 famous-song reconciliation step**. If that reconciliation gate passes, benchmark scoring switches to the reconciled dialogue/music-vocals artifacts and the design intent is broadly honored.

But in the current completed `cod-test` run, reconciliation was **configured but skipped**, so the benchmark still scored the run against the `.reconciled.json` paths even though those reconciled files were effectively identical to the raw outputs. There is **no comparator-side fallback** that remaps, tolerates, or forgives sung-vocals leakage still present in the dialogue lane. The leakage is therefore scored as ordinary mismatch / extra-or-missing-segment drift and heavily penalized.

## What the system does today

### 1) Benchmark scoring prefers reconciled phase-1 artifacts when reconciliation is configured

`server/lib/phase1-baseline-resolution.cjs` resolves canonical phase-1 benchmark inputs to reconciled artifacts whenever the famous-song reconciliation script is configured for `gather_context`.

Relevant code paths inspected:
- `server/lib/phase1-baseline-resolution.cjs`
- `server/lib/benchmark-runner.cjs`

Behavior:
- `resolvePhase1ArtifactPath()` returns `dialogue-data.reconciled.json` / `music-vocals-data.reconciled.json` when reconciliation is configured.
- `runBenchmark()` uses that resolved path for the benchmark output artifact.
- For dialogue, `comparisonBoundary.outputSurface` is recorded as `reconciled` when that path is used.

This means the system's intended posture is: **score the reconciled lane outputs, not the raw lane outputs, once reconciliation exists.**

### 2) The comparator itself does not perform dialogue↔vocals remapping

`server/lib/benchmark-runner.cjs` contains:
- time-aware/chronology-aware alignment for `dialogue_segments` and `vocal_segments`
- mismatch classification for dialogue posture (`provisional_raw_dialogue_drift`, `reconciled_post_processing_contract_mismatch`, `deferred_contract_drift`)

What it does **not** do:
- it does not move lyric-like dialogue segments into the music-vocals lane during scoring
- it does not forgive dialogue-vs-vocals contamination if reconciliation failed to remove it
- it does not merge cross-lane evidence before comparison

So the comparator is a scorer/alignment engine, not a reconciliation engine.

### 3) The only intentional cleanup/remap logic lives in `reconcile-famous-song-phase1.cjs`

Inspected code:
- `server/scripts/get-context/reconcile-famous-song-phase1.cjs`

Current behavior:
- `buildRecognitionGate()` decides whether reconciliation is allowed.
- If the gate passes:
  - `reconcileDialogue()` removes likely lyric contamination from the dialogue lane.
  - `reconcileMusicVocals()` can normalize lyric text in the music-vocals lane.
  - reconciled artifacts and a reconciliation ledger are written.
- If the gate fails:
  - the script still writes `.reconciled.json` files,
  - but they are just clones of the raw artifacts,
  - and the ledger status is `skipped`.

That means the benchmark runner can still read a `*.reconciled.json` file that contains **no actual reconciliation**.

## What happened in the current completed run

Inspected runtime artifacts:
- `output/cod-test/phase1-gather-context/dialogue-data.json`
- `output/cod-test/phase1-gather-context/dialogue-data.reconciled.json`
- `output/cod-test/phase1-gather-context/music-vocals-data.json`
- `output/cod-test/phase1-gather-context/music-vocals-data.reconciled.json`
- `output/cod-test/phase1-gather-context/famous-song-reconciliation.json`

Observed facts:
- `famous-song-reconciliation.json` has `status: "skipped"`.
- `trigger.passed` is `false`.
- `trigger.reasons` is `['hasSupportingMusicConsensus']`.
- `decisions.removedDialogueSegments` is empty.
- `decisions.lyricCorrections` is empty.
- The raw and reconciled dialogue segment arrays are effectively identical.
- The raw and reconciled music-vocals segment arrays are effectively identical.

Plain-English meaning:
- The system **wanted** to score reconciled artifacts.
- The reconciliation gate did **not** authorize any cleanup.
- So benchmark scoring consumed the reconciled file paths, but those files still contained the same leaked dialogue-vs-vocals posture as the raw run.

## How that shows up in scoring

Inspected benchmark evidence:
- `benchmarks/fixtures/cod-test/_reports/artifact-results/dialogueData.json`
- `benchmarks/fixtures/cod-test/_reports/artifact-results/musicVocalsData.json`
- `benchmarks/fixtures/cod-test/_reports/benchmark-summary.json`

### Dialogue artifact result

`dialogueData.json` shows:
- output path: `output/cod-test/phase1-gather-context/dialogue-data.reconciled.json`
- `comparisonBoundary.outputSurface: "reconciled"`
- status: `error`
- many failures classified as `reconciled_post_processing_contract_mismatch`

This is important: the benchmark is explicitly telling us **it believes it is scoring the post-processing/reconciled surface**, and that that reconciled surface still does not match the dialogue-only truth.

### Music-vocals artifact result

`musicVocalsData.json` shows:
- output path: `output/cod-test/phase1-gather-context/music-vocals-data.reconciled.json`
- status: `error`
- ordinary structural/text mismatches, including count mismatch and lyric/text drift

Again, there is no special comparator rule that says "these dialogue leaks should count as okay because they belonged in vocals." They are simply mismatches.

## Does this match design intent?

**Only partially.**

### What matches intent
- The architecture is clearly trying to make reconciliation the canonical scoring surface.
- If reconciliation succeeds, the benchmark would score the cleaned dialogue lane against dialogue truth and the cleaned music-vocals lane against music-vocals truth.
- That is consistent with the benchmark design intent.

### What does not match intent
- A completed run whose dialogue output still contains sung-vocals leakage is **not** currently scored in an intentionally tolerant way unless the reconciliation gate actually fires.
- When the gate skips, the current benchmark does **not** compensate during comparison.
- So the practical behavior today is: **leakage is penalized, not intentionally reconciled, unless the pre-score reconciliation step succeeds first.**

That does **not** match the design expectation Derrick asked about for the current completed run.

## What still needs fixing before reruns

Before rerunning and expecting the benchmark to behave the intended way, at least one of these must be true:

1. **Fix the famous-song reconciliation gate so it applies on the real/captured benchmark shape.**
   - This is the main blocker.
   - Earlier audit evidence already showed the gate can skip on strong-but-repetitive lyric evidence because the current evidence/order heuristic is too strict.
   - If the gate keeps skipping, reruns will keep scoring leaked vocals as dialogue mismatches.

2. **Or add an explicit comparator-side tolerance/remap policy** for dialogue-vs-music-vocals leakage.
   - That does **not** exist today.
   - This would be a different design choice and should be made deliberately.

3. **Keep the current scoring posture, but treat reruns as invalid until reconciliation is fixed.**
   - This is the most honest operational reading of the current system.
   - Right now the scoring stack assumes reconciliation already did its job.

## Audit verdict

**Verdict:** The current benchmark system does **not** intentionally protect the completed run from dialogue-lane sung-vocals leakage unless famous-song reconciliation successfully applies first. In the current `cod-test` output, reconciliation was skipped, so the benchmark penalized the leaked content as ordinary post-processing mismatch rather than handling it the way the benchmark design ultimately intends.

## Concrete code and artifact paths inspected

Code:
- `server/lib/phase1-baseline-resolution.cjs`
- `server/lib/benchmark-runner.cjs`
- `server/scripts/get-context/reconcile-famous-song-phase1.cjs`
- `scripts/qa/run-cod-task8-speaker-grouping.cjs`

Benchmark/truth config:
- `benchmarks/fixtures/cod-test/benchmark.json`
- `benchmarks/fixtures/cod-test/truth/dialogue-data.json`
- `benchmarks/fixtures/cod-test/truth/music-vocals-data.json`

Runtime/artifact evidence:
- `output/cod-test/phase1-gather-context/dialogue-data.json`
- `output/cod-test/phase1-gather-context/dialogue-data.reconciled.json`
- `output/cod-test/phase1-gather-context/music-vocals-data.json`
- `output/cod-test/phase1-gather-context/music-vocals-data.reconciled.json`
- `output/cod-test/phase1-gather-context/famous-song-reconciliation.json`
- `benchmarks/fixtures/cod-test/_reports/artifact-results/dialogueData.json`
- `benchmarks/fixtures/cod-test/_reports/artifact-results/musicVocalsData.json`
- `benchmarks/fixtures/cod-test/_reports/benchmark-summary.json`

Related prior evidence reviewed:
- `docs/research/2026-04-08-real-run-famous-song-reconciliation-skip-investigation.md`

## Plain-English answer for Derrick

**No — not in the way you expect right now.** The system is designed to score the reconciled dialogue/music-vocals surfaces, but the current completed run never actually got reconciled because the famous-song gate skipped. Once that happened, the comparator did not rescue it. It just scored the leaked sung-vocals inside dialogue as normal mismatch, so the run is still being penalized in a way that is not yet aligned with the intended benchmark-lane separation.