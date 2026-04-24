# Music Vocals Contract-Noise Cleanup Plan

**Date:** 2026-04-24  
**Author:** Cookie 🍪 (research lane)

## Problem

`musicVocalsData` is currently reported as `error` partly because the benchmark treats output-only scaffold fields and note-array verbosity as hard structural mismatches:

- `vocal_segments[*].index`
- extra `recognitionNotes[*]`
- extra `qualityNotes[*]`

That is benchmark noise, not product truth. The current report shows 20 `error` fields; 12 of them are `vocal_segments[*].index`, and 8 more are extra note-array entries. Real semantic failures already remain visible elsewhere: lyric text drift, extra/missing windows, performer/delivery mismatches, weak recognized-song support, and missing `timeRanges`.

## Strongest evidence

1. `server/lib/structured-output.cjs` always injects `index` into normalized `musicVocalsData.vocal_segments` output:
   - `validateMusicVocalsAnalysisObject()` returns `vocal_segments: vocal_segments.map((segment, index) => ({ ...segment, index }))`
   - so benchmarking against truth without `index` will always create output-only fields.
2. `server/lib/benchmark-runner.cjs` currently treats any extra object field as a structural `error` unless the path is ignored.
3. `benchmarks/fixtures/cod-test/_reports/artifact-results/musicVocalsData.json` shows:
   - 12 structural `error`s for `vocal_segments[*].index`
   - 3 structural `error`s for extra `recognitionNotes[*]`
   - 5 structural `error`s for extra `qualityNotes[*]`
4. Those errors are separate from real semantic misses already present in the same report:
   - wrong lyric text
   - extra output segments
   - missing recognized-song `timeRanges`
   - missing/shifted lyric support
   - performer/delivery mismatches

## Recommendation

Use a **benchmark-side comparator cleanup**, not output stripping.

### 1) `vocal_segments[*].index`

**Recommendation:** ignore benchmark-side.

Add `$.vocal_segments[*].index` to the default ignore paths for the `music-vocals-default` comparator profile.

Why:
- `index` is canonical scaffold metadata injected by normalization, not semantic truth.
- The comparator already aligns segments by time or chronology fallback; the field is not needed for truthful scoring.
- Stripping it output-side would create a second benchmark-only output shape and remove useful runtime metadata.

### 2) `recognitionNotes`

**Recommendation:** normalize before comparison with a **truth-subset / extra-output-tolerant** rule.

Desired benchmark semantics:
- truth notes that carry meaningful benchmark expectations should still need support in output
- extra output notes should **not** fail or error
- order should not matter
- exact wording should not be required

Implementation shape:
- compare `recognitionNotes` with the same fuzzy set-style matcher already used for `recognizedSong.candidates[*].evidence` / `matchedLyrics`, but with note-oriented thresholds
- require each truth note to find a sufficiently similar output note
- unmatched truth notes => `fail`
- unmatched output notes => `ignoredDifference`, not `fail`/`error`
- remove array-length structural failure for this path

Why:
- these notes are explanatory/support metadata, not a closed enumerated contract
- completely ignoring the field would hide a real miss if the model stops surfacing an important caution that truth expects
- exact/ordered equality is too brittle and over-penalizes harmless verbosity

### 3) `qualityNotes`

**Recommendation:** same as `recognitionNotes`.

Treat `qualityNotes` as optional explanatory support metadata with truth-subset fuzzy matching:
- missing truth note coverage => `fail`
- extra output note coverage => `ignoredDifference`
- no array-length structural failure
- no exact-by-index comparison

Why:
- quality notes are descriptive diagnostics, not a strict closed list
- extra quality commentary is common and should not drive artifact `error`
- fully ignoring them would throw away signal when truth intentionally encodes an important masking/clarity caveat

## What not to do

- **Do not strip `index` output-side.** That mutates the runtime shape just to satisfy the benchmark.
- **Do not fully ignore `recognitionNotes` / `qualityNotes`.** That would remove potentially honest support/diagnostic misses.
- **Do not loosen the whole music-vocals contract globally.** The problem is localized comparator noise, not the artifact schema.

## Exact proposed code changes

1. In `server/lib/benchmark-runner.cjs`, extend `PROFILE_DEFAULT_IGNORE_PATHS['music-vocals-default']` with:
   - `$.vocal_segments[*].index`

2. In `server/lib/benchmark-runner.cjs`, add a dedicated comparison path for:
   - `recognitionNotes`
   - `qualityNotes`

3. Implement a helper for note arrays, likely adjacent to `compareUnorderedFuzzySupportArray()`, with behavior:
   - fuzzy unordered matching
   - no length mismatch failure
   - matched truth/output pairs => `pass`
   - unmatched truth => `fail` (`Missing benchmark-expected note in output`)
   - unmatched output => `ignoredDifference` (`Extra diagnostic note outside benchmark-required coverage`)

4. Update `buildMusicVocalsScoring()` so support percentages still reflect missing truth-note coverage, but extra output note items do not depress the score or create `error` status.
   - easiest path: keep scoring based on field results for note entries, but make unmatched output note items ignored differences instead of `fail`/`error`

## Expected result after fix

`musicVocalsData` should stop becoming `error` because of scaffold-only `index` fields and note-array verbosity.

It should still honestly remain `fail` unless semantic quality improves, because the report will continue to show real misses such as:
- lyric mismatches
- extra output windows
- missing truth windows
- weak/incorrect recognized-song support
- missing `timeRanges`
- performer / delivery mismatches

## Validation strategy

1. Add/adjust focused benchmark-runner tests covering:
   - extra `vocal_segments[*].index` does not produce `error`
   - extra `recognitionNotes` does not fail/error
   - extra `qualityNotes` does not fail/error
   - missing benchmark-expected recognition/quality notes still fail
   - semantic misses in lyric text / support / timeRanges still fail

2. Re-run the relevant benchmark generation for cod-test.

3. Confirm in the refreshed `musicVocalsData` artifact report:
   - no `errors` for `vocal_segments[*].index`
   - no structural `errors` for extra `recognitionNotes[*]`
   - no structural `errors` for extra `qualityNotes[*]`
   - artifact status moves from `error` to `fail` unless semantic content has also improved

4. Confirm benchmark summary still shows the real signal:
   - lyric/support/boundary metrics remain meaningfully bad where they are genuinely bad
   - only contract-noise-induced structural errors disappear

## Implementation-ready note

The cleanest and most honest fix is:
- **ignore `vocal_segments[*].index` benchmark-side**
- **normalize `recognitionNotes` and `qualityNotes` benchmark-side as truth-subset fuzzy support arrays**

That removes structural noise without hiding real semantic misses or mutating the runtime artifact contract.