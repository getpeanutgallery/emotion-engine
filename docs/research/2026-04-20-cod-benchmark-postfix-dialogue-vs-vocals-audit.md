# cod-test postfix dialogue-vs-music-vocals benchmark audit

Date: 2026-04-20  
Auditor: Cookie 🍪

## Scope

Audit the live `cod-test` comparison surfaces **after** the famous-song reconciliation fix, using the already-produced runtime artifacts in `output/cod-test/`.

Questions:

1. Does benchmark evidence now reflect the intended dialogue-vs-music-vocals split?
2. Are remaining reds now honest residual model/comparator issues rather than reconciliation contamination?
3. Is a comparator-side fallback/tolerance still needed?

## Reruns performed

### 1) Speaker-grouping comparator refresh

```bash
node scripts/qa/run-cod-task8-speaker-grouping.cjs
```

Observed result:

- `benchmarks/fixtures/cod-test/_reports/artifact-results/speakerGrouping.json` refreshed successfully
- mismatch count: `9`
- mismatch categories:
  - `grouping_reuse_miss_after_source_truth_conversion`: `4`
  - `grouping_assignment_mismatch`: `3`
  - `runtime_extra_segment_not_in_truth`: `1`
  - `runtime_missing_segment_for_truth_index`: `1`

This surface is still red, but its misses are speaker-grouping/runtime-alignment problems, not song-lane contamination.

### 2) Benchmark stage refresh against existing `output/cod-test` artifacts

```bash
node - <<'NODE'
const path=require('path');
const { loadConfig } = require('./server/lib/config-loader.cjs');
const { runBenchmarkStage } = require('./server/lib/benchmark-runner.cjs');
(async()=>{
  const configPath = path.resolve('configs/cod-test.yaml');
  const config = await loadConfig(configPath);
  const result = runBenchmarkStage({ config, configPath, outputDir: path.resolve(config.asset.outputDir) });
  console.log(JSON.stringify({status: result.status, summary: result.summary, summaryPath: result.summaryPath}, null, 2));
})().catch(err=>{console.error(err); process.exit(1);});
NODE
```

Observed result:

- status: `error`
- summary: `0/6 artifacts passed. 86/217 scoreable fields passed. Truth coverage was 217/678 fields. deferred contract drift=2. reconciled contract mismatch=95.`

Refreshed files:

- `benchmarks/fixtures/cod-test/_reports/artifact-results/dialogueData.json`
- `benchmarks/fixtures/cod-test/_reports/artifact-results/musicVocalsData.json`
- `benchmarks/fixtures/cod-test/_reports/benchmark-summary.json`
- `benchmarks/fixtures/cod-test/_reports/benchmark-summary.md`

## Evidence reviewed

### Reconciliation ledger now shows a real applied split

`output/cod-test/phase1-gather-context/famous-song-reconciliation.json` now records:

- `status: "applied"`
- no trigger reasons
- one removed dialogue segment: former dialogue segment `11`
- removal evidence type: `composite_anchor_bundle`

That removed segment is the leaked lyric mashup:

> `Obey your master... Master... Just call me faster... ... Twisting your mind ... you can't see ... Master, master...`

`dialogue-data.reconciled.json` now has `17` dialogue segments instead of the raw lane's `18`, and the former lyric mashup is absent from the reconciled dialogue lane.

### Dialogue benchmark evidence now matches the intended split better

Refreshed `dialogueData.json` shows:

- `comparisonBoundary.outputSurface = "reconciled"`
- `rawSegments = 18`, reconciled runtime segments = `17`
- accuracy improved to `19/39 = 0.4872`
- mismatch classifications now concentrate at:
  - `reconciled_post_processing_contract_mismatch: 95`
  - `deferred_contract_drift: 2`

Important qualitative change:

- the dialogue benchmark no longer contains the obvious `Master of Puppets` contamination blob as a runtime dialogue segment
- the dialogue summary mismatch is still present, but that is because the runtime summary still says the trailer is "interspersed with song lyrics", which is now a summary-contract problem, not evidence that the leaked lyric segment is still physically present in the dialogue lane
- the remaining dialogue reds are mostly transcript/speaker/contract mismatches against the current truth shape

### Music-vocals benchmark now honestly owns the famous-song residue

Refreshed `musicVocalsData.json` still shows:

- status: `error`
- accuracy: `44/89 = 0.4944`
- runtime vocal segment count: `14` vs truth `12`

The failures are still concentrated in the music-vocals lane itself:

- extra/unmatched vocal segments
- lyric ordering/content mismatches
- performer label mismatches (`Metallica lead vocal` vs `Vocalist 1`)
- delivery mismatches (`chant` vs `sung`)
- song-support evidence/time-range omissions

The only fix-driven change here is the already-known narrow lyric normalization:

- segment `4`: `Obey your master!` → `I'll be your master`

That is not enough to make this surface green, but it **does** show that remaining famous-song disagreement is now landing in the correct lane instead of polluting dialogue scoring.

## Verdict

### 1) Does the benchmark evidence now reflect the intended dialogue-vs-music-vocals split?

**Yes, materially better and in the intended direction, but not fully green.**

The important design goal was not "everything passes"; it was "benchmark the right lane with the right evidence surface." After the fix:

- the leaked lyric mashup is removed from reconciled dialogue
- the benchmark still compares dialogue on the reconciled output surface
- remaining famous-song disagreements live in `musicVocalsData`, where they belong

So the split behavior now matches intent well enough to call the reconciliation-path fix successful.

### 2) Are the remaining reds honest residual issues rather than reconciliation contamination?

**Mostly yes.**

The refreshed reds look like honest residual issues in three buckets:

1. **Dialogue contract/truth mismatches**
   - summary wording drift
   - transcript text drift
   - speaker/speaker-id alignment issues
2. **Music-vocals extraction/model mismatch**
   - extra segments
   - wrong lyric ordering/content
   - weak performer/delivery labeling
   - incomplete evidence/time ranges
3. **Speaker-grouping/runtime-alignment misses**
   - reuse misses and assignment mismatches after v3 projection

I did **not** find refreshed benchmark evidence that the old lyric mashup is still contaminating dialogue comparison.

### 3) Is comparator-side fallback/tolerance still needed?

**No for the dialogue-vs-music-vocals split problem.**

The reconciliation-path fix removes the need for a comparator-side fallback whose purpose would have been to rescue leaked lyric content from the dialogue lane at comparison time.

Adding comparator-side fallback now would mainly hide or blur real residual problems:

- music-vocals lane quality issues
- dialogue truth/runtime wording drift
- grouping/runtime-alignment misses

If future work adds comparator tuning, it should be for a **different** narrowly-scoped reason (for example, performer-label aliasing or evidence-list tolerance inside `musicVocalsData`), not to patch dialogue-vs-vocals lane routing.

## Recommendation

- **Do not add comparator-side fallback for lane routing.**
- Treat the reconciliation fix as sufficient for the original contamination problem.
- Keep remaining reds honest and attack them in their owning lanes:
  - dialogue contract/truth cleanup
  - music-vocals extraction/truth alignment
  - speaker-grouping reuse/runtime-alignment work

## Bottom line

The famous-song reconciliation fix achieved the critical goal: benchmark evidence now scores the leaked song material in the **music-vocals lane instead of dialogue**. The benchmark is still red overall, but those reds are now substantially more honest than before.
