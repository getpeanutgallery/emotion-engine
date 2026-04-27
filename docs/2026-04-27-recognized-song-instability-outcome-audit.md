# Audit note: recognized-song aggregation rerun outcome

## Verdict

The recognized-song instability slice is **functionally fixed and complete enough to move on**.

The rerun evidence shows the specific collapse bug was addressed:

- `output/cod-test/phase1-gather-context/music-vocals-data.json` now keeps `recognizedSong.status: "recognized"` with a single `Master of Puppets` candidate at `confidence: 0.95`.
- `output/cod-test/phase1-gather-context/famous-song-reconciliation.json` shows `status: "applied"` and `trigger.passed: true`.
- `output/cod-test/phase1-gather-context/dialogue-data.reconciled.json` no longer contains the six obvious lyric-contamination dialogue segments that the reconciliation ledger removed (`13, 14, 15, 17, 23, 24`).
- `benchmarks/fixtures/cod-test/_reports/artifact-results/dialogueData.json` improved to `dialogue_text_full_transcript_pct=92.9` and `dialogue_text_windowed_pct=93.1`, with `extra_output_window_count=0`.

That is the expected downstream outcome of preserving the strongest chunk-level recognized-song result instead of letting a later `unknown` chunk erase it.

## Answered questions

### 1) Did the aggregation fix solve the recognized-song collapse in the live rerun?

Yes.

The post-fix live rerun no longer collapsed to `unknown`. The final music-vocals artifact preserves a strong recognized-song result, which is exactly the failure mode identified in the earlier audit note.

The current artifact shows:

- `analysisMode: "hybrid"`
- `recognizedSong.status: "recognized"`
- `recognizedSong.confidence: 0.95`
- one `Master of Puppets` candidate
- seven matched lyric fragments

That is concrete evidence that the last-chunk overwrite bug is no longer deciding the final artifact outcome.

### 2) Did it give reconciliation a fair chance, and did the dialogue score improve for the expected reason?

Yes.

The rerun gave reconciliation a fair chance because the gate now had the metadata it previously lacked:

- recognized status passed
- confidence passed
- single-candidate check passed
- matched-lyrics support passed
- supporting music consensus passed

Reconciliation then removed the exact lyric-contamination lines it is supposed to remove:

- `Obey your master, master`
- `Come crawling faster`
- repeated `Obey your master, master`
- `Master, master...`

The dialogue score improved for the expected reason: fewer lyrics were being miscounted as dialogue. The reconciled transcript is much cleaner, and the benchmark moved from the recent failed rerun range (`66.5 / 67.2`) to `92.9 / 93.1` text similarity.

### 3) What should we make of the remaining anomaly `"Your life burns faster"`?

Treat it as a **content-quality / benchmark-truth alignment issue, not remaining recognized-song instability**.

Evidence:

- The line survives in `dialogue-data.reconciled.json`.
- The truth fixture for `music-vocals` also contains `"Your life burns faster"` as a lyric segment.
- The reconciliation ledger removed only lines with direct matched-lyric support from the current recognized-song artifact. This line was not removed because the current recognized-song matched-lyrics list does not include it.

So the remaining anomaly is not the old failure mode of “song recognition collapsed, therefore reconciliation never ran.” Reconciliation did run. It just did not have enough direct lyric-support metadata to classify this surviving line as removable lyric contamination under the current policy.

That makes `"Your life burns faster"` a separate follow-up slice if Derrick wants it addressed: likely either richer matched-lyric capture or a broader reconciliation policy. It should not block closing the instability slice.

### 4) Is the recognized-song instability slice complete enough to move on?

Yes.

What is solved:

- chunk-level recognized-song evidence now survives to the final artifact
- famous-song reconciliation is no longer blocked by the collapse bug
- the rerun produced the expected downstream cleanup and material dialogue-score recovery

What is not solved here:

- full benchmark green status
- the surviving `"Your life burns faster"` dialogue contamination edge case
- broader content-quality and transcript-boundary mismatches unrelated to the collapse bug

Those are real, but they are different problems.

## Recommendation

Close this slice as complete and move on to the next highest-value transcript/reconciliation quality issue. If needed, open a new bead specifically for the surviving `"Your life burns faster"` case rather than treating it as evidence that the recognized-song stability fix failed.
