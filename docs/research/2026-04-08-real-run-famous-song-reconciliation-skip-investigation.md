# Real-run famous-song reconciliation skip investigation

**Date:** 2026-04-08
**Bead:** `ee-kyvo`
**Scope:** Investigation only; no code changes.

## Summary

The real whole-video run is still skipping famous-song reconciliation because the relaxed gate only bypasses music-lane consensus when **both** the dialogue lane and the music-vocals lane show lyric text evidence **and** monotonic lyric-order evidence. In the captured run, the song is clearly recognized in `music-vocals`, but both lanes fail the current `hasIndexOrderEvidence` check due to legitimate repeated/re-entering chorus lines (`... -> lyricIndex 3 -> lyricIndex 1` in vocals, `0 -> 2 -> 1 -> 0` in dialogue). That forces `requiresSupportingMusicConsensus = true`; the supporting `musicData.recognizedSong` is only `possible`, so the composite `hasSupportingMusicConsensus` gate still fails and the ledger ends `skipped`.

The first failing condition in practice is **not** the top-level recognized-song strength. It is the stricter-than-real-world ordered-hit requirement inside `buildLyricEvidence()` / `buildRecognitionGate()`.

## Exact evidence paths

Stable captured-run artifacts:
- `output/_archives/cod-test-pre-ee-uofg-20260408-155355/cod-test/phase1-gather-context/famous-song-reconciliation.json`
- `output/_archives/cod-test-pre-ee-uofg-20260408-155355/cod-test/phase1-gather-context/music-vocals-data.json`
- `output/_archives/cod-test-pre-ee-uofg-20260408-155355/cod-test/phase1-gather-context/dialogue-data.json`
- `output/_archives/cod-test-pre-ee-uofg-20260408-155355/cod-test/phase1-gather-context/music-data.json`

Relevant code/tests:
- `server/scripts/get-context/reconcile-famous-song-phase1.cjs:373-418`
- `server/scripts/get-context/reconcile-famous-song-phase1.cjs:421-457`
- `test/scripts/reconcile-famous-song-phase1.test.js:18-55`
- `test/scripts/reconcile-famous-song-phase1.test.js:159-188`
- `test/scripts/reconcile-famous-song-phase1.test.js:190-225`

## Captured-run facts

### 1) The ledger only reports the final composite failure

From `.../famous-song-reconciliation.json`:
- `status: "skipped"`
- `trigger.reasons: ["hasSupportingMusicConsensus"]`
- `music-vocals recognizedSong.status: "recognized"`, `confidence: 0.93`
- `musicData recognizedSong.status: "possible"`, `confidence: 0.7`

So the top-level skip reason is still the supporting-music-consensus check, even after the relaxation work.

### 2) The real run has strong lyric text evidence, but repeated chorus structure breaks the current order test

From `.../music-vocals-data.json`:
- recognized-song `matchedLyrics` are only:
  1. `Obey your master`
  2. `Master, master`
  3. `Come crawling faster`
  4. `Master of puppets, I'm pulling your strings`
- vocal segments continue beyond that short matched-lyric list and later re-enter repeated chorus lines:
  - index `0`: `Obey your master`
  - index `1`: `Master, master`
  - index `2`: `Come crawling faster`
  - index `3`: `Master of puppets, I'm pulling your strings`
  - index `7`: `Master, master`
  - index `9`: `Master, master`

From `.../dialogue-data.json`:
- lyric-like dialogue contamination appears at indexes `11`, `12`, `13`, and `18`:
  - `Obey your master, master...`
  - `Come crawling faster...`
  - `Master, master...`
  - `Obey your master...`

Replaying the current gate against those captured artifacts yields:
- vocal lyric hits with lyric indexes: `[0, 1, 2, 3, 1, 1]`
- dialogue lyric hits with lyric indexes: `[0, 2, 1, 0]`
- therefore:
  - `vocalLyricEvidence.hasLyricTextEvidence = true`
  - `dialogueLyricEvidence.hasLyricTextEvidence = true`
  - `vocalLyricEvidence.hasIndexOrderEvidence = false`
  - `dialogueLyricEvidence.hasIndexOrderEvidence = false`
  - `hasStrongDialogueVocalsEvidence = false`
  - `requiresSupportingMusicConsensus = true`
  - `hasSupportingMusicConsensus = false`

## First failing condition

The first failing condition is:

- `vocalLyricEvidence.hasIndexOrderEvidence === false`

Why that is first:
1. `buildLyricEvidence()` records each segment's best-matching lyric index.
2. It marks evidence out-of-order as soon as a later hit has a **smaller** `lyricIndex` than the previous hit (`reconcile-famous-song-phase1.cjs:405-410`).
3. In the real run, the vocal sequence hits lyric indexes `0,1,2,3,1,1`, so the transition `3 -> 1` fails immediately.
4. That already prevents `hasStrongDialogueVocalsEvidence` from becoming true (`:442-446`).
5. Once that composite flag is false, `requiresSupportingMusicConsensus` becomes true (`:448`).
6. The supporting `musicData` lane is only `possible`, not `recognized`, so `hasSupportingMusicConsensus` resolves false (`:435-440`) and the ledger skips (`:450-457`).

The dialogue lane also fails the same order test, but vocals fail first and are sufficient to keep the relaxation from taking effect.

## Why the passing tests do not catch this

The passing relaxed-gate test (`test/scripts/reconcile-famous-song-phase1.test.js:159-188`) uses a much cleaner shape:
- dialogue lyric evidence is basically a single contamination line plus one non-lyric line
- vocal evidence is a short ordered pair
- `matchedLyrics` are only `['Obey your master', 'Twisting your mind']`
- there are no repeated chorus returns, no re-entry after a later lyric, and no partial matched-lyric list with later repeated fragments

The fixture seed in `makeArtifacts()` (`:18-55`) also teaches the same simple pattern: short, unique, monotonic lyric evidence.

That means the current tests prove the relaxation works for **strictly monotonic unique-fragment scenarios**, but they do **not** cover the real captured shape where:
- the recognized song is right,
- lyric contamination is clearly present in both lanes,
- and chorus/refrain repetition causes lyric indexes to go backwards relative to the short `matchedLyrics` array.

The weak-evidence test (`:190-225`) is still valid, but the real run lands in a third category that the tests do not model well: **strong textual evidence with non-monotonic repeated lyric structure**.

## Ranked root-cause candidates

1. **Most likely / direct cause:** `buildLyricEvidence()` treats any backward lyric-index transition as disqualifying, even when the transition is caused by legitimate repeated chorus/refrain lines in a correctly recognized song.
   - Evidence: real-run vocal hits `0,1,2,3,1,1`; dialogue hits `0,2,1,0`.
   - This is the exact boundary that blocks the relaxation.

2. **Likely contributing cause:** the `matchedLyrics` list from `music-vocals` is a short subset, not a full canonical ordered lyric timeline with repeats.
   - Evidence: matched lyrics stop after four entries even though later vocal segments continue with repeated chorus material.
   - The gate currently assumes that simple monotonic progression against this short list is a safe proxy for “ordered evidence,” which breaks on real repeated-song structure.

3. **Secondary cause:** the relaxation predicate is too strict because it requires ordered-hit evidence in **both** dialogue and vocal lanes before waiving supporting music consensus.
   - In practice, either lane can be noisy or repetitive while still being obviously consistent with the same recognized song.

4. **Tertiary environmental cause:** `musicData` remains conservative (`possible`, `0.7`) due to masking, so once the stronger cross-lane shortcut fails there is no backup path.
   - This is real, but it is not the first bug. It only matters because the order test already failed.

## Smallest plausible fix

The smallest plausible fix is to make the relaxed-gate evidence tolerant of **repeated/re-entering lyric fragments** instead of requiring globally monotonic lyric indexes.

Narrowest version:
- keep the existing strong-song checks (`statusRecognized`, confidence, single candidate, no multiple songs, minimum lyric count)
- change `hasIndexOrderEvidence` so a later repeated chorus hit does not invalidate an otherwise strong ordered prefix
- examples of acceptable narrow relaxations:
  - ignore backward transitions when the repeated lyric text already appeared earlier in the hit stream
  - or score/order only the first occurrence of each matched lyric
  - or accept a strong ordered subsequence rather than requiring the full hit stream to remain monotonic

Why this is the smallest plausible fix:
- it targets the exact failing condition revealed by the captured artifacts
- it does not broaden lyric cleanup based on weak text similarity alone
- it preserves the supporting-music fallback for genuinely weak or ambiguous cases
- it aligns better with real chorus-heavy song structure than the current all-hits-monotonic rule

## Bottom line

The gate relaxation landed, but the real run never reaches it because the captured song evidence is **strong-but-repetitive**, while the current shortcut only recognizes **strong-and-globally-monotonic** evidence. The skip is therefore still real, reproducible, and explained by the current ordered-hit heuristic rather than by missing song recognition.