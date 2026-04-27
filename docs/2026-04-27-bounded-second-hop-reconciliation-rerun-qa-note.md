# QA note: bounded second-hop cod-test rerun

## Commands run

```bash
bd update ee-k8qa --status in_progress --json
set -a && . ./.env && set +a && node validate-configs.cjs
set -a && . ./.env && set +a && node server/run-pipeline.cjs --config configs/cod-test.yaml --verbose
# first pipeline attempt hit OpenRouter: read ECONNRESET in get-dialogue.cjs
set -a && . ./.env && set +a && node server/run-pipeline.cjs --config configs/cod-test.yaml --verbose
```

## Main result

The fresh canonical rerun did **not** reproduce the earlier post-fix `81.3 / 81.7 / extra_output_window_count 1` outcome. The bounded second-hop reconciliation path was not exercised because the fresh music-vocals song-recognition result regressed and the reconciliation ledger skipped entirely.

## Fresh reconciliation state

Artifact: `output/cod-test/phase1-gather-context/famous-song-reconciliation.json`

- `status`: `skipped`
- failed trigger reasons:
  - `statusRecognized`
  - `confidenceStrong`
  - `singlePrimaryCandidate`
  - `sufficientMatchedLyrics`
  - `hasSupportingMusicConsensus`
- fresh vocals recognition:
  - `recognizedSong.status`: `unknown`
  - `confidence`: `0`
  - `candidates`: `[]`
- `removedDialogueSegments`: `[]`

## Dialogue benchmark comparison

| Run | `dialogue_text_full_transcript_pct` | `dialogue_text_windowed_pct` | `extra_output_window_count` |
| --- | ---: | ---: | ---: |
| Earlier high-score baseline | 90.7 | 90.7 | 0 |
| Prior post-fix run | 81.3 | 81.7 | 1 |
| Fresh bounded-second-hop rerun | 65.8 | 66.5 | 7 |

Additional fresh fields from `benchmarks/fixtures/cod-test/_reports/artifact-results/dialogueData.json`:

- `dialogue_boundary_pct`: `14.3`
- `output_segment_count`: `29`
- `split_event_count`: `4`
- `merge_event_count`: `2`

## Reconciled dialogue correctness read

Artifact: `output/cod-test/phase1-gather-context/dialogue-data.reconciled.json`

The remaining lyric lines were **not** removed. The reconciled dialogue contains the full lyric burst again:

- `13`: `Obey your master`
- `14`: `Come crawling faster`
- `15`: `Master of puppets, I'm pulling your strings`
- `16`: `Twisting your mind and smashing your dreams`
- `17`: `Blinded by me, you can't see a thing`
- `18`: `Just call my name, 'cause I'll hear you scream`
- `19`: `Master, master`
- `20`: `Just call my name, 'cause I'll hear you scream`
- `21`: `Master, master`
- `27`: `Obey your master`

## Spoken-line safety check

Because reconciliation removed nothing in this run, I did not find legitimate spoken lines being wrongly deleted by reconciliation. Nearby spoken lines still present include:

- `11`: `This isn't real.`
- `12`: `The hell it ain't!`
- `22`: `Pull it together, man`
- `23`: `So eager to leave, David`
- `24`: `Killing the man is a hell of a lot easier than killing the idea`
- `25`: `You were never cut out to be a Mason`
- `26`: `No more games, this ends now`
- `28`: `Get the Reznov Challenge Pack when you pre-order now`

## Weak-line status

`You shall know fear.` remains missing. The fresh benchmark still drifts from truth index `9` into output index `9` (`Spectre 1 report`) instead of recovering that line.
