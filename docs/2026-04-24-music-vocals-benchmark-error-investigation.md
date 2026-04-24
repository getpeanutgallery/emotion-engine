# Music-vocals benchmark error investigation

Date: 2026-04-24  
Repo: `projects/peanut-gallery/emotion-engine`  
Fixture: `cod-test`  
Artifact: `musicVocalsData`

## Bottom line

`musicVocalsData` is still erroring for two different reasons at once:

1. **The lane content is still materially wrong**: the reconciled output keeps several wrong lyric lines, misses parts of the expected chorus sequence, duplicates later phrases, and collapses/reshuffles the expected progression.
2. **The benchmark contract is still harsher than the artifact shape**: the comparator currently treats output-only `index` fields and extra `recognitionNotes` / `qualityNotes` entries as hard structural errors, which inflates the artifact from a normal fail into an `error`.

The strongest single non-prompt root cause is the **reconciliation lane mutating the music-vocals artifact toward a bad `recognizedSong.matchedLyrics` set** instead of toward an audibly supported full-sequence truth. The clearest smoking gun is that reconciliation changed `"Obey your master!"` into `"I'll be your master"`, which is further away from the benchmark truth, not closer.

## Files audited

- `benchmarks/fixtures/cod-test/_reports/benchmark-summary.md`
- `benchmarks/fixtures/cod-test/_reports/artifact-results/musicVocalsData.json`
- `benchmarks/fixtures/cod-test/truth/music-vocals-data.json`
- `output/cod-test/phase1-gather-context/music-vocals-data.json`
- `output/cod-test/phase1-gather-context/music-vocals-data.reconciled.json`
- `output/cod-test/phase1-gather-context/famous-song-reconciliation.json`
- `server/lib/benchmark-runner.cjs`
- `server/lib/music-vocals-artifact.cjs`
- `server/lib/phase1-baseline-resolution.cjs`
- `server/scripts/get-context/get-music-vocals.cjs`
- `server/scripts/get-context/reconcile-famous-song-phase1.cjs`
- `memory/2026-04-06.md`

## Current measured failure surface

After rerunning the benchmark against the current config/output, the artifact still resolves to the reconciled file and still errors:

- `benchmark-summary.md`: `musicVocalsData` is `error`
- `musicVocalsData.json` report: 44/89 scoreable fields passed
- Scoring block:
  - `vocal_text_full_transcript_pct = 45.0%`
  - `vocal_text_windowed_pct = 44.9%`
  - `vocal_boundary_pct = 57.1%`
  - `vocal_attribution_pct = 55.6%`
  - `recognized_song_identity_pct = 100.0%`
  - `recognized_song_support_pct = 0.0%`
- Structural alignment surface:
  - `truth_segment_count = 12`
  - `output_segment_count = 14`
  - `split_event_count = 2`
  - `missing_truth_window_count = 3`
  - `extra_output_window_count = 2`

So the song is identified correctly, but the lane still fails on transcript content, support evidence, segmentation, and contract shape.

## Why it is still erroring

### 1) Transcript coverage

This is the main semantic failure.

The truth fixture expects a specific 12-segment progression beginning with short chant fragments and then the known verse/chorus sequence:

- truth segment 0: `"Obey your master"`
- truth segment 1: `"Your life burns faster"`
- truth segment 2: `"Master of puppets I’m pulling your strings"`
- truth segment 3: `"Twisting your mind and smashing your dreams"`
- truth segment 4: `"Blinded by me, you can’t see a thing"`
- truth segment 5: `"Just call my name, ‘cause I’ll hear you scream"`
- truth segments 6-9: `"Master, master"` / `"Where’s the dreams that I’ve been after?"` / `"Master, master"` / `"You promised only lies"`
- truth segments 10-11: late reprise `"Obey your master"` and `"Master, master"`

The current reconciled output instead contains several clearly different lines:

- output 0: `"I'll be your master"`
- output 1: `"Master! Master!"`
- output 3: `"Come crawling faster"`
- output 4: `"I'll be your master"`
- output 7: duplicate `"Master of puppets, I'm pulling your strings"`
- output 12: duplicate `"Just call my name, 'cause I'll hear you scream"`
- output 13: extra `"Master, master"`

Concrete benchmark evidence from the artifact result:

- `vocal_segments[truth=0,output=0].text`: truth `"Obey your master"` vs output `"I'll be your master"`
- `vocal_segments[truth=1,output=1].text`: truth `"Your life burns faster"` vs output `"Master! Master!"`
- `vocal_segments[truth=3,output=3].text`: truth `"Twisting your mind and smashing your dreams"` vs output `"Come crawling faster"`
- `vocal_segments[truth=4,output=4].text`: truth `"Blinded by me..."` vs output `"I'll be your master"`
- `vocal_segments[truth=10,output=10].text`: truth late `"Obey your master"` vs output `"Just call my name..."`

This is not just cosmetic wording drift. The output lane is walking the wrong lyric sequence.

### 2) Boundary / segmentation

The content is also segmented differently from truth.

The rerun report shows:

- `output_segment_count = 14` vs truth `12`
- `split_event_count = 2`
- `extra_output_window_count = 2`
- `missing_truth_window_count = 3`

The `window_alignments` show the benchmark having to map one truth window onto multiple output windows and also leaving later truth windows unmatched. The strongest examples:

- truth index 3 aligns to output indexes `[4,5,6]` with `boundary_status = split`
- truth index 4 aligns to output indexes `[8,9]` with `boundary_status = split`
- truth indexes 8, 9, and 10 are completely `missing_truth`
- output indexes 12 and 13 are `extra_output`

This means the lane is not only saying the wrong words; it is also breaking and repeating phrases in a way that stops the expected chorus sequence from lining up.

### 3) Attribution

Attribution is partially right (`performer_id = voc_001` survives) but still weak enough to drag the score down:

- truth performer is `"Metallica lead vocal"`
- output performer is always generic `"Vocalist 1"`
- chant segments in truth are emitted as `delivery = "chant"`, while output often uses `"sung"`

Concrete examples from the artifact result:

- `vocal_segments[truth=0,output=0].performer`: `Metallica lead vocal` vs `Vocalist 1`
- `vocal_segments[truth=0,output=0].delivery`: `chant` vs `sung`
- `vocal_segments[truth=10,output=10].delivery`: `chant` vs `sung`
- `vocal_segments[truth=11,output=11].delivery`: `chant` vs `sung`

So attribution is not the primary reason the lane errors, but it is a real secondary miss.

### 4) Recognized-song support shaping

This is the cleanest score split in the report:

- `recognized_song_identity_pct = 100.0%`
- `recognized_song_support_pct = 0.0%`

That means identity is fine but the support package is not benchmark-compatible.

Truth expects the recognized-song support to carry richer grounding:

- two evidence bullets
- three `matchedLyrics` items, including the chorus continuation and `"you promised only lies"`
- three `timeRanges`

Current output only carries:

- one evidence bullet
- `matchedLyrics = ["Master, master", "I'll be your master", "Master of puppets, I'm pulling your strings"]`
- no `timeRanges`

Concrete benchmark failures:

- `recognizedSong.candidates[truth=0,output=0].evidence`: truth length 2 vs output length 1
- missing support line: `"The surrounding sung lines align with the same famous metal song chorus/verse sequence."`
- missing matched lyrics for `"Master, master, where’s the dreams that I’ve been after?"`
- missing matched lyrics for `"Master, master, you promised only lies!"`
- extra unsupported matched lyric: `"I'll be your master"`
- `recognizedSong.candidates[truth=0,output=0].timeRanges`: truth length 3 vs output length 0

This is a support-shaping problem, not an identity problem.

### 5) Reconciliation / chorus-repeat handling

This is the strongest deterministic bug lane.

`memory/2026-04-06.md` says the earlier successful lane recovered a 10-segment canonical `Master of Puppets` sequence and that the open question had shifted toward reconciliation/comparator review. The current reconciliation ledger shows the opposite behavior for at least one segment:

- `famous-song-reconciliation.json` records one applied lyric correction:
  - index 4 changed from `"Obey your master!"` to `"I'll be your master"`

That correction is backwards relative to the truth fixture, which expects `"Obey your master"` as both the early chant and the later reprise.

Why this happens in code:

- `reconcile-famous-song-phase1.cjs` builds its correction target from `gate.matchedLyrics`
- `gate.matchedLyrics` comes from the primary candidate's `recognizedSong.matchedLyrics`
- the current recognized-song payload already contains the bad phrase `"I'll be your master"`
- reconciliation can therefore only “correct” toward that bad phrase set

The ledger confirms this exact failure mode:

- `lyricCorrections[0].from = "Obey your master!"`
- `lyricCorrections[0].to = "I'll be your master"`
- `reason = "recognized_song_near_miss"`

The same ledger also shows skipped corrections on other mismatched lines because thresholds blocked them:

- index 5 and 8 (`Twisting...`) skipped with `lyric_similarity_below_threshold`
- indexes 10 and 12 (`Just call my name...`) skipped because the target was too short relative to source

So reconciliation is currently both:

- capable of making a correct phrase worse, and
- too weak to repair the rest of the broken sequence.

### 6) Benchmark-contract mismatch

There are real semantic failures above, but the artifact is specifically `error` rather than just `fail` because of benchmark-contract mismatches too.

The biggest one: every output vocal segment includes an `index` field, while truth does not. The comparator treats output-only object fields as structural errors.

That creates 12 hard errors immediately:

- `vocal_segments[truth=0,output=0].index`
- ... through ...
- `vocal_segments[truth=11,output=11].index`

Those 12 errors are not lyric-semantic misses; they are schema drift between artifact and truth.

The same issue appears in note arrays:

- truth has 2 `recognitionNotes`, output has 5
- truth has 1 `qualityNotes`, output has 6
- extra output notes beyond truth become structural errors

Examples:

- `recognitionNotes[2]`, `[3]`, `[4]` are output-only structural errors
- `qualityNotes[1]` through `[5]` are output-only structural errors

So the benchmark currently mixes two questions:

- “Did we recover the right lyrics and support?”
- “Did the output emit exactly the same auxiliary note array shape as truth?”

That makes the surface noisier than it needs to be.

## Ranked most likely non-prompt fix lanes

### 1) Fix reconciliation to stop mutating toward bad `matchedLyrics` scaffolding

Highest leverage.

Why first:

- It has a direct smoking gun in `famous-song-reconciliation.json`
- It deterministically worsens at least one segment
- It explains why the reconciled artifact still preserves the wrong lyric arc even after song identity is right

Concrete change direction:

- never allow reconciliation to replace an existing literal fragment with a lower-confidence canonical rewrite unless the target phrase is independently anchored by local segment evidence
- require stronger local support before converting `Obey your master`-like phrases
- add guards so chorus/reprise correction uses sequence-aware matching, not just nearest `matchedLyrics` string similarity

### 2) Make recognized-song support shaping carry sequence-aware support, not just identity

Second highest leverage.

Why:

- `recognized_song_identity_pct` is already 100%
- `recognized_song_support_pct` is 0%
- the correction gate depends on `matchedLyrics`, so weak support payloads poison reconciliation too

Concrete change direction:

- capture `timeRanges` in `recognizedSong.candidates`
- preserve richer `matchedLyrics` covering the actual heard sequence, not just a short hook list
- ensure support evidence includes the later chorus continuation and reprise windows when the lane already emits those phrases

### 3) Improve chorus/repeat handling in the music-vocals lane before reconciliation

Why:

- output has 14 segments vs truth 12
- duplicates and late extra outputs show repeat handling is unstable
- the `get-music-vocals` prompts explicitly ask to keep repeated hooks distinct, but the current result both duplicates and mis-orders later lines

Concrete change direction:

- add deterministic post-pass logic that merges obvious accidental duplicate repeats while preserving true reprises
- enforce sequence checks around the `Master, master` / `Where’s the dreams...` / `You promised only lies` run so the lane cannot loop back into the wrong earlier line

### 4) Clean up benchmark-contract mismatches so the artifact reports as fail/error for the right reasons

Why:

- 12 segment `index` errors are pure schema noise
- extra `recognitionNotes` and `qualityNotes` entries also inflate `error`
- removing that noise will make the remaining semantic misses easier to trust and prioritize

Concrete change direction:

- ignore `$.vocal_segments[*].index` for this profile, or add `index` to truth if it is intended contractually
- decide whether note arrays are exact-contract fields or optional support fields; if optional, compare them fuzzily/unordered or ignore extras

### 5) Improve attribution normalization

Why:

- it is a consistent score drag but not the root cause of the error state

Concrete change direction:

- map recognized single-performer song cues to a richer performer label when identity is high-confidence
- distinguish `chant` from `sung` for the short refrain windows

## Best next non-prompt fix lane

**Start with reconciliation + recognized-song support shaping together.**

In plain English: the system now knows the song, but the post-processing layer is using a bad short lyric checklist and then “correcting” the output toward the wrong words. Fix that first.

Specifically:

1. make reconciliation refuse backwards edits like `Obey your master` → `I'll be your master`
2. upgrade `recognizedSong.matchedLyrics` / `timeRanges` to preserve the actual multi-line sequence the lane thinks it heard
3. only after that, trim benchmark contract noise (`index`, note-array exactness)

If those three changes land, the lane should stop erroring for artificial schema reasons and should also have a much better chance of moving the actual lyric text/boundary surfaces toward truth.
