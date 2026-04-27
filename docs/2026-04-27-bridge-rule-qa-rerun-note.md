# 2026-04-27 bridge-rule QA rerun note

## Scope

QA rerun for bead `ee-7j6r` after commit `f9f700b` (`Add bounded lyric bridge for reconciliation`). Goal: rerun the canonical `cod-test` pipeline and verify the `Your life burns faster` anomaly outcome.

## Canonical rerun command

```bash
set -euo pipefail
mkdir -p .logs output/_archives
TS=$(date +%Y%m%d-%H%M%S)
ARCHIVE_DIR="output/_archives/cod-test-pre-ee-7j6r-$TS"
LOG=".logs/cod-test-$TS-ee-7j6r-bridge-rule-qa.log"
TIMELOG=".logs/cod-test-$TS-ee-7j6r-bridge-rule-qa.time"
mkdir -p "$ARCHIVE_DIR"
if [ -d output/cod-test ]; then mv output/cod-test "$ARCHIVE_DIR/"; fi
if [ -d benchmarks/fixtures/cod-test/_reports ]; then cp -a benchmarks/fixtures/cod-test/_reports "$ARCHIVE_DIR/benchmark_reports_before"; fi
set -a; . ./.env; set +a
/usr/bin/time -p -o "$TIMELOG" \
  node server/run-pipeline.cjs --config configs/cod-test.yaml --clean-live-digital-twin --verbose \
  2>&1 | tee "$LOG"
```

Actual archive/log packet for this QA run:

- archive: `output/_archives/cod-test-pre-ee-7j6r-20260427-163732/`
- log: `.logs/cod-test-20260427-163732-ee-7j6r-bridge-rule-qa.log`
- timing: `.logs/cod-test-20260427-163732-ee-7j6r-bridge-rule-qa.time` (`real 295.84`)

## Outcome

- The pipeline completed Phases 1-3 and then exited non-zero at benchmark time with the usual red benchmark packet: `0/7 artifacts passed`, `362/699 scoreable fields passed`.
- The specific anomaly is gone in the fresh run:
  - archived pre-run raw dialogue contained `index 16 = "Your life burns faster"`
  - archived pre-run reconciled dialogue still contained that line
  - fresh raw dialogue contains **no** `Your life burns faster`
  - fresh reconciled dialogue contains **no** `Your life burns faster`
- Fresh reconciliation status remains `applied` in `output/cod-test/phase1-gather-context/famous-song-reconciliation.json`.

## Important interpretation

The anomaly disappeared, but this rerun did **not** prove the new bounded bridge rule fired in live runtime.

Instead, the fresh Phase 1 capture changed upstream enough that the contaminated dialogue cluster now aligns directly with recognized lyrics:

- fresh raw dialogue indexes `13-20` are now canonical lyric lines (`Obey your master.`, `Come crawling faster.`, `Master of puppets, I'm pulling your strings.`, `Twisting your mind and smashing your dreams.`, etc.)
- fresh `music-vocals-data.json` now includes the same lyric coverage in both `recognizedSong.primaryCandidate.matchedLyrics` and `vocal_segments`
- the reconciliation ledger shows direct lyric evidence removals for indexes `13-20`
- no `removedDialogueSegments[*].evidence.boundedLyricBridge` entries appeared in this live rerun

So the fix is still regression-covered by unit tests, but this provider-backed rerun resolved the visible anomaly through stronger direct lyric support rather than demonstrating the bridge path on the exact old survivor shape.

## Before/after deltas worth keeping

### Dialogue / reconciliation

- archived pre-run packet: `output/_archives/cod-test-pre-ee-7j6r-20260427-163732/cod-test/phase1-gather-context/`
  - raw dialogue count: `26`
  - reconciled dialogue count: `20`
  - removed dialogue indexes: `13, 14, 15, 17, 23, 24`
  - `Your life burns faster` survived at raw+reconciled index `16`
- fresh packet: `output/cod-test/phase1-gather-context/`
  - raw dialogue count: `29`
  - reconciled dialogue count: `19`
  - removed dialogue indexes: `13, 14, 15, 16, 17, 18, 19, 20, 21, 27`
  - `Your life burns faster` absent from both raw and reconciled dialogue

### Benchmark packet

Benchmark remained red before and after, but the artifact surfaces shifted:

- `benchmarks/fixtures/cod-test/_reports/benchmark-summary.json`
  - before: `0/7` passed, `3 fail`, `4 error`
  - after: `0/7` passed, `3 fail`, `4 error`
- `dialogueData`
  - before accuracy: `0.5121`
  - after accuracy: `0.4095`
  - before output segments: `20`
  - after output segments: `19`
- `dialogueDataRaw`
  - before accuracy: `0.7761`
  - after accuracy: `0.8284`
  - before output segments: `26`
  - after output segments: `29`
- `musicVocalsData`
  - before accuracy: `0.3881`
  - after accuracy: `0.4468`
  - ignored differences increased `33 -> 53`
- `musicData`
  - before accuracy: `0.3333`
  - after accuracy: `0.2941`
- `recommendationData`
  - before accuracy: `0.1176`
  - after accuracy: `0.1333`
- `metricsData` and `emotionalAnalysisData` were unchanged at the summary level

## Useful artifact pointers

- fresh raw dialogue: `output/cod-test/phase1-gather-context/dialogue-data.json`
- fresh reconciled dialogue: `output/cod-test/phase1-gather-context/dialogue-data.reconciled.json`
- fresh music-vocals: `output/cod-test/phase1-gather-context/music-vocals-data.json`
- fresh reconciliation ledger: `output/cod-test/phase1-gather-context/famous-song-reconciliation.json`
- archived pre-run packet: `output/_archives/cod-test-pre-ee-7j6r-20260427-163732/`
- fresh benchmark summary: `benchmarks/fixtures/cod-test/_reports/benchmark-summary.json`
- fresh dialogue benchmark surface: `benchmarks/fixtures/cod-test/_reports/artifact-results/dialogueData.json`
- fresh music-vocals benchmark surface: `benchmarks/fixtures/cod-test/_reports/artifact-results/musicVocalsData.json`
