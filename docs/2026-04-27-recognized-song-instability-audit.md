# Audit note: recognized-song instability in `music-vocals`

## Verdict

The current `recognizedSong.status: "unknown"` collapse is **most likely a chunk-merge bug in `get-music-vocals.cjs`, not a validator rejection and not primarily a model/provider miss**.

The strongest evidence is that the same canonical rerun produced:

- chunk-local raw captures with `recognizedSong.status: "recognized"` for chunk `0002` and chunk `0003`
- final `music-vocals-data.json` with eleven lyric-bearing `vocal_segments`
- but final top-level `recognizedSong` equal to the **last** chunk's `unknown/0/[]` result from chunk `0004`

So the lane did identify the song mid-run, then later **forgot it during final aggregation** after the last chunk contained promo VO and no lyrics.

A whole-asset runtime failure (`OpenRouter: read ECONNRESET`) made the run more fragile by removing the whole-asset backstop, but that failure alone does **not** explain why the final artifact discarded already-recognized chunk evidence.

---

## Evidence reviewed

Artifacts and notes:

- `.plans/2026-04-27-investigate-recognized-song-instability.md`
- `.plans/2026-04-27-bounded-second-hop-reconciliation-followup.md`
- `docs/2026-04-27-bounded-second-hop-reconciliation-rerun-qa-note.md`
- `docs/2026-04-27-bounded-second-hop-reconciliation-audit-note.md`
- `output/cod-test/phase1-gather-context/music-vocals-data.json`
- `output/cod-test/phase1-gather-context/music-data.json`
- `output/cod-test/phase1-gather-context/famous-song-reconciliation.json`
- raw captures under `output/cod-test/phase1-gather-context/raw/ai/`

Code paths inspected:

- `server/scripts/get-context/get-music-vocals.cjs`
- `server/scripts/get-context/get-music.cjs`
- `server/scripts/get-context/reconcile-famous-song-phase1.cjs`
- `server/lib/music-vocals-artifact.cjs`
- `server/lib/structured-output.cjs`
- `test/scripts/get-music-vocals.test.js`
- `test/scripts/reconcile-famous-song-phase1.test.js`

---

## What the raw evidence shows

### 1) The chunk model outputs did recognize the song before the final chunk

Raw captures show these chunk-local outcomes for the same rerun:

- `raw/ai/music-vocals-segment-0000/attempt-01/capture.json`
  - `recognizedSong.status: "unknown"`
  - `vocal_segments: []`
- `raw/ai/music-vocals-segment-0001/attempt-01/capture.json`
  - `recognizedSong.status: "unknown"`
  - `vocal_segments: []`
- `raw/ai/music-vocals-segment-0002/attempt-01/capture.json`
  - `recognizedSong.status: "recognized"`
  - candidate `Master of Puppets` / `Metallica`
  - `matchedLyrics`: `Obey your master`, `Master of puppets`, `Come crawling faster`, `Master, master`
  - `vocal_segments.length = 8`
- `raw/ai/music-vocals-segment-0003/attempt-01/capture.json`
  - `recognizedSong.status: "recognized"`
  - candidate `Master of Puppets` / `Metallica`
  - `matchedLyrics`: `Master, master`, `Obey your master`
  - `vocal_segments.length = 3`
- `raw/ai/music-vocals-segment-0004/attempt-01/capture.json`
  - `recognizedSong.status: "unknown"`
  - `vocal_segments: []`
  - promo-VO explanation

That means the provider did **not** simply fail to ever recognize the song. It recognized it twice, then the last no-lyrics chunk supplied a fresh `unknown` object.

### 2) The final artifact kept the lyric segments but replaced the song identity

`output/cod-test/phase1-gather-context/music-vocals-data.json` contains:

- 11 lyric-bearing `vocal_segments`
- summary/provenance consistent with chunked fallback
- final `recognizedSong` of:
  - `status: "unknown"`
  - `confidence: 0`
  - `candidates: []`

This combination is the giveaway: the final artifact still knows the cue contained explicit lyrics, but its top-level song identity metadata was overwritten by a later chunk-local miss.

### 3) The code path matches that overwrite pattern exactly

In `server/scripts/get-context/get-music-vocals.cjs`:

- line `557` initializes `lastChunkRecognizedSong = null`
- lines `870-871` do:
  - `if (parsed.recognizedSong) { lastChunkRecognizedSong = parsed.recognizedSong; }`
- lines `910-912` build the final result from:
  - `wholeAssetAnalysis?.recognizedSong || lastChunkRecognizedSong`

Because every chunk that returns a `recognizedSong` object counts as truthy — including `{ status: "unknown", confidence: 0, candidates: [] }` — the **last chunk wins**, even if an earlier chunk had a stronger recognized result.

That is exactly what the raw captures show happened here:

1. chunk 2 sets `lastChunkRecognizedSong` to a recognized `Master of Puppets`
2. chunk 3 sets it again to a recognized `Master of Puppets`
3. chunk 4 sets it to `unknown`
4. final artifact serializes the chunk-4 value

### 4) Whole-asset failure mattered, but as a missing backstop, not as the core bug

`music-vocals-data.json` provenance shows:

- `wholeAssetAttempted: true`
- `wholeAssetSucceeded: false`
- `fallbackApplied: true`
- `fallbackReason: "OpenRouter: read ECONNRESET"`

If the whole-asset pass had succeeded, `wholeAssetAnalysis?.recognizedSong` would likely have masked the overwrite problem. But the bug is still real, because the chunked path should not discard a previously recognized song just because a later chunk has no lyrics.

### 5) Validator acceptance is not the likely culprit

The chunk captures already include validated parsed results with recognized candidates, matched lyrics, and accepted schemas. `server/lib/structured-output.cjs` and `server/lib/music-vocals-artifact.cjs` do not show evidence of a validator stripping a valid recognized result into `unknown` after the fact.

The validator is permissive here:

- `recognizedSong.status: "recognized"` is accepted when candidates exist
- `matchedLyrics` are optional but preserved when present
- `normalizeRecognizedSong()` keeps valid recognized candidates intact

So the regression pattern fits **state replacement after validation**, not **validator rejection before artifact build**.

### 6) Reconciliation is behaving consistently with the bad final artifact

`output/cod-test/phase1-gather-context/famous-song-reconciliation.json` skipped because the final `music-vocals` artifact advertised:

- `statusRecognized` = failed
- `confidenceStrong` = failed
- `singlePrimaryCandidate` = failed
- `sufficientMatchedLyrics` = failed
- `hasSupportingMusicConsensus` = failed

This is expected once the final `recognizedSong` becomes `unknown/0/[]`. The reconciliation gate is downstream of the real issue.

### 7) Music vs music-vocals mismatch increased the odds of seeing this

`music-data.json` came from a successful whole-asset path and still reports:

- `recognizedSong.status: "possible"`
- candidate `Master of Puppets`
- `confidence: 0.7`

So the two lanes are not operating under the same failure conditions:

- `music` kept a whole-asset candidate
- `music-vocals` lost whole-asset context to `ECONNRESET` and then used a last-chunk-wins chunk merge

That mismatch explains why the music lane can still hint the song while the vocals lane collapses.

---

## Answers to the audit questions

### 1) Why does `recognizedSong` collapse to `unknown/0/[]` in music-vocals even when lyric segments are still present?

Because the final artifact uses a **single mutable `lastChunkRecognizedSong` slot**. Later chunks with no lyrics still emit a truthy `recognizedSong` object whose status is `unknown`, and that object overwrites earlier chunk-local recognized results. The final artifact then serializes the last overwrite.

### 2) What is the most likely instability source?

Ranked hypotheses:

1. **Merge/recovery behavior (highest confidence).**
   - Direct evidence in raw chunk captures plus the `lastChunkRecognizedSong` code path.
2. **Whole-asset vs chunk path behavior.**
   - Whole-asset `ECONNRESET` removed the global recognized-song backstop, exposing the merge bug.
3. **Prompt/runtime/provider variance.**
   - Present, but secondary. The provider did recognize the song in chunks 2 and 3, so provider variance is not needed to explain this specific collapse.
4. **Mismatch between music and music-vocals recognized-song handling.**
   - Contributing factor because music retained a whole-asset possible match while music-vocals fell back to chunk aggregation.
5. **Validator acceptance.**
   - Low likelihood for this incident. The recognized chunk outputs were accepted and persisted in raw captures.

### 3) What is the narrowest approval-ready next step?

**Narrowest next step: fix chunk-level recognized-song aggregation in `get-music-vocals.cjs` and add one targeted regression test.**

Recommended rule:

- do **not** let a later `status: "unknown"` chunk overwrite an earlier stronger recognized/possible candidate
- when whole-asset recognition is absent, choose the **best recognized-song candidate across chunks**, not simply the last chunk's object

A minimal approval-ready policy is:

- prefer `recognized` over `possible` over `multiple_possible` over `unknown`/`none_present`
- within equal status, prefer higher confidence
- preserve matched lyrics / evidence from the best chunk-level candidate
- optionally record a small provenance/debug note explaining which chunk won

This is narrower than a gate redesign and narrower than provider/prompt tuning. It addresses the concrete failure shown in this rerun.

### 4) What exact files and tests would need to change for that next step?

Primary implementation file:

- `server/scripts/get-context/get-music-vocals.cjs`
  - replace `lastChunkRecognizedSong` last-write-wins behavior with a best-of-chunks selector
  - likely add a small helper such as `choosePreferredRecognizedSong(previous, next)` or equivalent
  - optionally add a small provenance/debug field or quality/recognition note if Derrick wants better observability

Primary regression test file:

- `test/scripts/get-music-vocals.test.js`
  - add a test where:
    - chunk 2 returns `recognized`
    - chunk 3 returns `recognized`
    - final chunk returns `unknown`
    - expected final artifact still keeps the stronger earlier recognized candidate
  - ideally also assert the final artifact still keeps all collected `vocal_segments`

Optional additional test file if Derrick wants selector logic unit-tested separately:

- either extend `test/scripts/get-music-vocals.test.js`
- or add a focused helper-level test only if the selection logic is extracted into a reusable function

No immediate change is required in:

- `server/scripts/get-context/reconcile-famous-song-phase1.cjs`
- `server/lib/structured-output.cjs`
- `server/lib/music-vocals-artifact.cjs`

unless follow-up work later shows a need for extra instrumentation.

---

## Recommendation

Approve a **single narrow code change** in `get-music-vocals.cjs` plus a **single regression test** in `test/scripts/get-music-vocals.test.js`.

I do **not** recommend starting with:

- prompt rewrites
- provider swaps
- reconciliation gate changes
- blind reruns

Those may still matter later, but they are not the narrowest fix for the concrete failure evidenced in this run.

After the merge fix lands, the right next validation is a fresh canonical rerun to see whether the music-vocals lane now preserves the earlier recognized result when the final promo chunk contains no lyrics.
