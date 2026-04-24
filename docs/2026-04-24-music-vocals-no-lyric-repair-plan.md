# Music-vocals no-lyric-repair implementation plan

**Date:** 2026-04-24  
**Bead:** `ee-p2o5`

## Bottom line

Remove lyric-text correction from famous-song reconciliation for `musicVocalsData`.

New contract boundary:
- `musicVocalsData.vocal_segments[*].text` stays audio-faithful and may remain partial, rough, or imperfect.
- `recognizedSong` remains metadata/support only.
- reconciliation may still help with ownership, support annotation, and other non-canonicalizing cleanup, but it must not replace transcript text with canonical song lyrics.

The smoking-gun evidence is current cod-test reconciliation changing `"Obey your master!"` into `"I'll be your master"` (`output/cod-test/phase1-gather-context/famous-song-reconciliation.json`). That is a backwards edit relative to the benchmark truth and proves the current architecture lets song metadata overwrite transcript truth.

## Current behavior causing the bug

### Raw capture side
`server/scripts/get-context/get-music-vocals.cjs` already tells the model to:
- use recognized-song matches only as bounded recall scaffolding
- emit the shortest audibly supported fragment when support is partial
- avoid promoting weak hook/vibe matches into canonical lyric lines

That is the right capture-side posture.

### Reconciliation side
`server/scripts/get-context/reconcile-famous-song-phase1.cjs` breaks that posture afterward:
- `buildRecognitionGate()` pulls `primaryCandidate.matchedLyrics` from `recognizedSong`
- `reconcileMusicVocals()` finds the nearest matched lyric for each vocal segment
- `classifyLyricCorrection()` authorizes text replacement
- the script mutates `segment.text = bestMatch.lyric`

So the reconciler currently treats `recognizedSong.matchedLyrics` as a canonical text repair source. In the current cod-test run that produced:
- `from: "Obey your master!"`
- `to: "I'll be your master"`
- `reason: "recognized_song_near_miss"`

That is exactly the contract violation we need to remove.

## Required behavior change

### 1) Transcript text becomes write-protected from song metadata
For `musicVocalsData`, reconciliation must not change:
- `vocal_segments[*].text`
- `vocal_segments[*].confidence` when the only reason is song canonicalization
- `vocal_segments[*].delivery` when the only reason is song canonicalization
- segment ordering/index solely to force a canonical lyric sequence

Implementation direction:
- delete or disable the `reconcileMusicVocals()` lyric-rewrite path
- keep writing `music-vocals-data.reconciled.json`, but by default it should carry forward the raw transcript text unchanged
- preserve a ledger record stating that lyric repair is intentionally disabled

### 2) `recognizedSong` is support, not transcript truth
`recognizedSong` may still include:
- identity/status/confidence
- candidates
- evidence bullets
- `matchedLyrics`
- `timeRanges`
- ambiguity notes

But those fields are support metadata only. They may explain why the system believes the song is `Master of Puppets`; they may not be used as canonical replacement text for the transcript lane.

### 3) Reconciliation stays allowed only for non-canonicalizing actions
Allowed reconciliation actions:
- dialogue cleanup / lyric contamination removal in `dialogueData`
- attaching or enriching famous-song support metadata
- deduping or normalizing support arrays if needed
- annotating ambiguity / provenance / reconciliation decisions
- optional future ownership actions that move evidence between lanes without inventing new lyric text

Disallowed reconciliation actions:
- replacing a vocal transcript line with any `recognizedSong.matchedLyrics` value
- expanding a short heard fragment into a polished canonical line
- changing a transcript line because it is “close to” a known lyric
- reordering segments to better fit a known song progression
- using recognized-song identity as authority to change lyric wording

## Exact implementation guidance

### Primary code change
File:
- `server/scripts/get-context/reconcile-famous-song-phase1.cjs`

Recommended change:
1. Remove the call path that performs music-vocals lyric correction.
2. Keep `buildRecognitionGate()` only for reconciliation behaviors that are still allowed.
3. Replace `reconcileMusicVocals()` with a no-text-mutation pass, for example:
   - clone and return `musicVocalsData` unchanged, or
   - optionally add non-semantic metadata only.
4. Update ledger output so `decisions.lyricCorrections` is always `[]` for music-vocals under the new contract, and add a clearer note such as:
   - `musicVocalsPolicy: { lyricRepairEnabled: false, reason: "transcript_text_must_remain_audio_faithful" }`

### Contract versioning
Current ledger says:
- `contractVersion: "ee.famous-song-reconciliation/v1"`

Recommended bump:
- `ee.famous-song-reconciliation/v2`

Reason:
- the meaning of reconciliation changes materially
- downstream readers should know that music-vocals lyric correction is no longer part of the contract

### Prompt/code alignment
Do **not** loosen the capture prompts to compensate. The capture-side prompt already expresses the desired posture. The architecture fix is to stop the post-pass from undoing it.

## Strongest evidence behind this design

1. **Direct harmful rewrite in the ledger**  
   `output/cod-test/phase1-gather-context/famous-song-reconciliation.json` records:
   - `"Obey your master!" -> "I'll be your master"`
   This is the clearest proof that metadata-driven lyric replacement is unsafe.

2. **Benchmark outcome matches the failure mode**  
   `benchmarks/fixtures/cod-test/_reports/artifact-results/musicVocalsData.json` shows:
   - `recognized_song_identity_pct = 100.0`
   - `recognized_song_support_pct = 0.0`
   - transcript text still badly wrong
   This means the system knows the song, but knowing the song does not justify rewriting the transcript.

3. **Prior prompt posture already states the right boundary**  
   `memory/2026-04-06-music-vocals.md` and current `get-music-vocals.cjs` both say recognized-song matches are scaffolding, not copyable truth. The reconciler is the layer violating that rule.

## Backward-compatibility notes

1. **Reconciled file still exists**  
   Keep emitting `music-vocals-data.reconciled.json` so the pipeline contract and benchmark path resolution do not break.

2. **Reconciled music-vocals may become identical to raw**  
   That is acceptable and expected under the new contract when no non-semantic reconciliation is performed.

3. **Ledger schema may grow, not disappear**  
   Prefer adding policy/decision fields over deleting the ledger. Consumers can still inspect what reconciliation decided, but they must no longer expect lyric rewrite events.

4. **Benchmarks may initially score lower on canonical lyric surfaces but be more truthful**  
   If benchmark truth currently rewards canonicalized text, that should be treated as a benchmark/posture issue, not a reason to restore lyric repair.

## Validation strategy

### Code-level
- add/update unit tests around `reconcile-famous-song-phase1.cjs`
- assert that music-vocals reconciliation never mutates `vocal_segments[*].text` from the raw artifact
- add a regression test for the exact bad case:
  - input segment text `"Obey your master!"`
  - matched lyric `"I'll be your master"`
  - expected reconciled text remains `"Obey your master!"`

### Artifact-level
Run cod-test and verify:
- `output/cod-test/phase1-gather-context/music-vocals-data.json`
- `output/cod-test/phase1-gather-context/music-vocals-data.reconciled.json`
- `output/cod-test/phase1-gather-context/famous-song-reconciliation.json`

Expected outcomes:
- no `lyricCorrections` entries that rewrite transcript text
- no canonical lyric replacement in reconciled music-vocals
- `recognizedSong` still present and useful as metadata/support
- dialogue reconciliation behavior remains intact

### Audit checks
Specifically truth-check:
- harmful rewrite `Obey your master! -> I'll be your master` is gone
- `recognizedSong` still carries identity/evidence/matchedLyrics/timeRanges when available
- transcript lane remains literal/audio-faithful even when incomplete or awkward

## Implementation-ready recommendation

Make the smallest durable change:
- stop `reconcile-famous-song-phase1.cjs` from ever mutating `musicVocalsData.vocal_segments[*].text`
- preserve `recognizedSong` as support metadata only
- keep the ledger and reconciled file surfaces, but repurpose them for transparency rather than lyric repair

That preserves the existing file topology while enforcing the correct contract boundary: the transcript reports what was heard; the song recognizer reports what song it might be.