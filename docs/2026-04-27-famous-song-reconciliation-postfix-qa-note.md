# QA note: post-fix cod-test rerun for generic recognized-song dialogue reconciliation

## Command run

```bash
set -a && . ./.env && set +a
node validate-configs.cjs
node server/run-pipeline.cjs --config configs/cod-test.yaml --verbose
```

Run log: `.logs/cod-test-20260427-ee-5n2f-postfix-rerun.log`

## Main result

The generic recognized-song reconciliation fix materially improved the reconciled dialogue artifact versus the immediately previous failed rerun, but it did not fully restore the earlier high-score baseline.

## Dialogue metric comparison

| Comparison point | `dialogue_text_full_transcript_pct` | `dialogue_text_windowed_pct` | `extra_output_window_count` |
| --- | ---: | ---: | ---: |
| Earlier high-score baseline (documented in `.plans/2026-04-27-audit-dialogue-prompt-for-missed-lines-and-rerun-cod-test.md`) | 90.7 | 90.7 | 0 |
| Failed rerun immediately before this fix (same plan/report surface) | 66.5 | 67.2 | 6 |
| Post-fix rerun (`benchmarks/fixtures/cod-test/_reports/artifact-results/dialogueData.json`) | 81.3 | 81.7 | 1 |

## Reconciled dialogue correctness read

- Improvement is real and comes from actual removal of lyric contamination, not from report noise.
- Fresh reconciliation ledger: `output/cod-test/phase1-gather-context/famous-song-reconciliation.json`
  - `removedDialogueSegments` indexes: `13`, `14`, `18`, `19`, `20`
  - removed texts: `Obey your master`, `Come crawling faster`, `Just call my name, 'cause I'll hear you scream`, `Master, master`, `Just call my name, 'cause I'll hear you scream`
- Fresh reconciled dialogue still contains three lyric lines:
  - index `15`: `Master of puppets, I'm pulling your strings`
  - index `16`: `Twisting your mind and smashing your dreams`
  - index `17`: `Blinded by me, you can't see a thing`
- Compared with the pre-fix failed rerun shape, the contamination block is much smaller. It is no longer a long `13-20` lyric burst in reconciled dialogue, but it is not fully gone.

## Safety / collateral removal check

- In the contaminated region, legitimate spoken lines still remain present:
  - `11`: `This isn't real.`
  - `12`: `The hell it ain't!`
  - `21`: `Pull it together, man.`
  - `22`: `So eager to leave, David.`
  - `23`: `Killing the man is a hell of a lot easier than killing the idea.`
- I did not find evidence in this cluster that the fix wrongly removed legitimate spoken lines.

## Weak-line status

- `You shall know fear.` remains missing.
- The fresh benchmark alignment still merges truth indexes `[8, 9]` into output `[8]` and then aligns truth index `[10]` to output `[9]`, so the weak-line issue appears unchanged by this reconciliation fix.

## Artifacts reviewed

- `benchmarks/fixtures/cod-test/_reports/artifact-results/dialogueData.json`
- `benchmarks/fixtures/cod-test/_reports/benchmark-summary.json`
- `output/cod-test/phase1-gather-context/dialogue-data.json`
- `output/cod-test/phase1-gather-context/dialogue-data.reconciled.json`
- `output/cod-test/phase1-gather-context/famous-song-reconciliation.json`
- `.plans/2026-04-27-audit-dialogue-prompt-for-missed-lines-and-rerun-cod-test.md`
