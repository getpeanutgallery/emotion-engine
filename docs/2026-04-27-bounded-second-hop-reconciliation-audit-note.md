# Audit note: bounded second-hop rerun was blocked upstream

## Verdict

The bad rerun is mainly explained by upstream recognized-song failure in `music-vocals-data.json`, not by evidence of a bug in the bounded second-hop reconciliation implementation.

## Evidence

- `output/cod-test/phase1-gather-context/famous-song-reconciliation.json` shows `status: "skipped"`.
- The gate failed on `statusRecognized`, `confidenceStrong`, `singlePrimaryCandidate`, `sufficientMatchedLyrics`, and `hasSupportingMusicConsensus`.
- `trigger.recognizedSong` is:
  - `status: "unknown"`
  - `confidence: 0`
  - `candidates: []`
- `decisions.removedDialogueSegments` is `[]`.
- `output/cod-test/phase1-gather-context/dialogue-data.reconciled.json` matches the unreconciled dialogue for the lyric burst; the contamination block remains intact.
- `output/cod-test/phase1-gather-context/music-vocals-data.json` still contains eleven sung vocal segments such as `"Obey your master"`, `"Master of puppets, I'm pulling your strings"`, and `"Master, master"`, which makes the `recognizedSong.status: "unknown"` result look like an upstream detection miss rather than absence of lyric material.
- `output/cod-test/phase1-gather-context/music-data.json` independently reports `recognizedSong.status: "possible"` with candidate `Master of Puppets` at `confidence: 0.7`, which is supportive but insufficient to open the stricter reconciliation gate.

## Audit conclusion

The bounded second-hop code added in commit `5ba0151` is landed and unit-tested, but this live rerun does not exercise it. There is no run-level evidence here that the new hop logic caused the regression. The regression is better explained by the recognizer failing to promote an obviously lyric-bearing vocals lane into a recognized-song result, which forces reconciliation to skip.

## Recommended next step

Prioritize recognized-song stability over repeated reconciliation reruns. Another blind rerun could recover by chance, but the higher-value next move is to improve or at least diagnose why the vocals recognizer returned `unknown` despite strong sung segments already being present in the vocals transcript. Until that detection path is reliable, further live evaluation of the bounded second-hop change should be treated as blocked.

## Implementation status

Treat bounded second-hop reconciliation as landed-but-unproven under live rerun conditions.
