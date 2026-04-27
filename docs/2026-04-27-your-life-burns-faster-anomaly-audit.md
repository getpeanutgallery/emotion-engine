# Audit note: `Your life burns faster` anomaly

## Verdict

`Your life burns faster` survives reconciliation because it has **no direct lyric evidence** in the current support surfaces, even though it sits inside a clearly lyric-contaminated sung run.

This is **not** another recognized-song activation bug. It is a narrower reconciliation-policy gap:

- `dialogue-data.json` includes `Your life burns faster` as a low-confidence sung `Speaker 9` line
- surrounding same-speaker lyric lines are removed
- but the current reconciliation evidence only includes explicit lines present in `recognizedSong.matchedLyrics` and `music-vocals-data.json`
- neither of those currently contain `Your life burns faster`
- so the removal policy leaves it behind

## Artifact evidence

### Dialogue

`output/cod-test/phase1-gather-context/dialogue-data.json` contains this local cluster:

- index `13`: `Obey your master, master`
-