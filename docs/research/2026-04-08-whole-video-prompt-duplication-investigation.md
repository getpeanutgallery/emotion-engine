# Whole-video prompt duplication investigation

**Date:** 2026-04-08  
**Scope:** Real provider-backed `configs/cod-test.yaml` whole-video rerun (`ee-uofg`) after the canonical one-copy-per-lane fix landed.  
**Question:** Why does the captured whole-video prompt still contain duplicated support content even though `whole-video-mimo` now selects one canonical artifact per lane?

## Short answer

The live whole-video prompt is duplicating support content because the duplication is already present in the in-memory Phase 1 artifacts **before** `whole-video-mimo` builds the prompt.

The first duplication point is the sequential Phase 1 artifact merge in `server/lib/phases/gather-context-runner.cjs`. Its recursive `mergeArtifacts()` helper concatenates arrays when a later script returns the same top-level artifact key. The reconciliation script (`server/scripts/get-context/reconcile-famous-song-phase1.cjs`) re-emits `musicData` and `musicVocalsData` under the same keys, so their nested arrays (`segments`, `vocal_segments`) get appended onto themselves during the merge.

`whole-video-mimo` is then innocent-but-literal: it selects a single canonical artifact object per lane, but that chosen object already contains duplicated arrays, so the prompt faithfully renders the duplicates.

## Evidence

### 1) The real captured whole-video prompt is duplicated

Provider-backed whole-video capture:
- `output/cod-test/phase2-process/raw/ai/whole-video/attempt-01/capture.json`
- prompt ref inside that capture: `output/cod-test/_meta/ai/_prompts/b8b7a72a10c7201370f2226399c3440ff6a187abed14738d65ee6575279b827c.json`

Observed in the prompt snapshot:
- `# MUSIC CONTEXT` repeats the same 5 cue rows twice
- `# MUSIC VOCALS CONTEXT` repeats the same 5 lyric rows twice

The duplicate rows are visible directly in the prompt payload embedded under:
- `output/cod-test/phase2-process/raw/ai/whole-video/attempt-01/capture.json`
  - `providerCompletion.providerRequest.body.messages[0].content[0].text`
- and in the referenced prompt snapshot file itself.

### 2) The persisted Phase 1 lane files on disk are *not* duplicated

Single-copy source artifacts from the same run:
- `output/cod-test/phase1-gather-context/music-data.json` → 5 `segments`
- `output/cod-test/phase1-gather-context/music-vocals-data.json` → 5 `vocal_segments`
- `output/cod-test/phase1-gather-context/music-vocals-data.reconciled.json` → 5 `vocal_segments`

So the prompt duplication is **not** coming from the phase artifact files that the reconciliation step wrote to disk.

### 3) The final merged artifact bag *is* duplicated

From the same run:
- `output/cod-test/artifacts-complete.json`

Observed counts:
- `musicData.segments.length === 10`
- `musicVocalsData.vocal_segments.length === 10`

The first 5 entries are followed by the same 5 entries again. That matches the exact duplication shown in the whole-video prompt.

This pins the bug to the in-memory artifact merge path, not prompt formatting and not the on-disk lane files.

### 4) The first duplication point is the Phase 1 sequential merge helper

Merge helper:
- `server/lib/phases/gather-context-runner.cjs:171-205`

Critical behavior:
- arrays are concatenated (`result[key] = [...result[key], ...newValue]`)
- nested objects recurse back into `mergeArtifacts()`

That means if a later Phase 1 script returns an artifact object under a key that already exists, then nested arrays inside that artifact object are appended instead of replaced.

### 5) The reconciliation script re-returns the same lane keys

Reconciliation script:
- `server/scripts/get-context/reconcile-famous-song-phase1.cjs:686-693`

It returns:
- `dialogueData: strippedDialogueData`
- `musicData: musicData`
- `musicVocalsData: strippedMusicVocalsData`
- `famousSongReconciliation: ledger`

Because `musicData` and `musicVocalsData` were already present from earlier Phase 1 scripts, the Phase 1 merge helper combines old + new under the same keys.

For this run, that means:
- `musicData.segments` (5) + `musicData.segments` (same 5) → 10
- `musicVocalsData.vocal_segments` (5) + `strippedMusicVocalsData.vocal_segments` (same 5) → 10

### 6) `whole-video-mimo` itself only selects one artifact object and renders what it receives

Whole-video selection + rendering path:
- `server/scripts/process/whole-video-mimo.cjs:143-151` — `selectCanonicalLaneArtifact()`
- `server/scripts/process/whole-video-mimo.cjs:196-214` — `formatMusicContext()`
- `server/scripts/process/whole-video-mimo.cjs:223-241` — `formatMusicVocalsContext()`
- `server/scripts/process/whole-video-mimo.cjs:674-677` — selects `musicData` / `musicVocalsData`
- `server/scripts/process/whole-video-mimo.cjs:711-720` — builds the base prompt

The prompt builder is not appending two different lane artifacts anymore. It loops once over whatever array is inside the selected artifact. In the real run, that selected artifact already has doubled arrays.

## End-to-end trace

1. `configs/cod-test.yaml` runs Phase 1 sequentially, including:
   - `get-dialogue.cjs`
   - `get-music.cjs`
   - `get-music-vocals.cjs`
   - `reconcile-famous-song-phase1.cjs`
2. `get-music.cjs` populates `artifacts.musicData` with 5 music segments.
3. `get-music-vocals.cjs` populates `artifacts.musicVocalsData` with 5 vocal segments.
4. `reconcile-famous-song-phase1.cjs` writes clean `.reconciled.json` files to disk, **but also returns** `musicData` and `musicVocalsData` again under the same top-level keys.
5. `gather-context-runner` merges that return payload into existing `phaseArtifacts` using recursive array concatenation.
6. The merged in-memory artifact bag now contains doubled arrays.
7. `artifacts-complete.json` serializes that already-doubled artifact bag.
8. `whole-video-mimo` selects one canonical lane artifact per lane from that merged bag.
9. `formatMusicContext()` and `formatMusicVocalsContext()` render those doubled arrays exactly once each, which produces the visible repeated rows in the provider-backed prompt capture.

## Why the unit test did not catch it

Relevant test:
- `test/scripts/whole-video-mimo.test.js:270-356`

What it proves:
- `whole-video-mimo.run()` prefers `*Reconciled` over raw over `*Final`
- only one canonical artifact object is selected per lane within the whole-video script

What it does **not** simulate:
- the real sequential Phase 1 runner
- the reconciliation script returning same-key artifacts
- the recursive merge behavior in `gather-context-runner`
- a merged artifact object whose internal arrays are already duplicated

So the test correctly verified the local fix in `whole-video-mimo`, but it did not cover the upstream runtime shape that the provider-backed rerun actually produced.

## Ranked root-cause candidates

### 1) **Definite:** Phase 1 merge semantics duplicate nested arrays when reconciliation re-emits existing artifact keys

Confidence: **very high**

Evidence chain:
- clean Phase 1 files on disk (5 items)
- duplicated `artifacts-complete.json` (10 items)
- `gather-context-runner.cjs` concatenates arrays recursively
- reconciliation script returns same keys again
- prompt duplication matches the doubled array contents exactly

This is the first duplication point.

### 2) **High-confidence contributing design mismatch:** runtime does not preserve distinct `*Reconciled` keys in-memory even though process tests assume canonical-key selection

Confidence: **high**

The live Phase 1 path writes reconciled files to disk but returns reconciled lane data back under the raw keys (`dialogueData`, `musicVocalsData`) instead of `dialogueDataReconciled` / `musicVocalsDataReconciled`. That makes the runtime behavior materially different from the unit-test setup and increases the chance of same-key merge collisions.

This is not the first duplication point, but it explains why the live path can still drift away from the test model.

### 3) **Secondary resilience gap:** no defensive dedupe at prompt-render time

Confidence: **medium**

`whole-video-mimo` currently trusts the selected artifact object. That is reasonable, but it means any upstream merge regression passes straight into the provider prompt.

This is not the source of the bug, only a missing backstop.

## Smallest plausible fix

### Recommended smallest fix for the observed live bug

Fix the Phase 1 merge semantics in `server/lib/phases/gather-context-runner.cjs` so that when a later script returns an already-existing artifact object, nested arrays are **replaced**, not concatenated.

Why this is the smallest plausible fix:
- it addresses the **first actual duplication point**
- it preserves the intended flow where reconciliation can overwrite prior lane artifacts
- it fixes both duplicated `musicData.segments` and duplicated `musicVocalsData.vocal_segments` in one place
- it aligns the merged in-memory artifact bag with the clean on-disk phase files

### Narrow alternative

A more targeted but less systemic fix would be to change `reconcile-famous-song-phase1.cjs` so it does **not** re-return pass-through lane artifacts under existing raw keys (for example, omit `musicData`, and/or return distinct `dialogueDataReconciled` / `musicVocalsDataReconciled` keys instead).

That would likely also stop this specific duplication, but it leaves the recursive array-concat merge hazard in place for future same-key artifacts.

## Practical recommendation

1. Treat `gather-context-runner.cjs` merge behavior as the root bug to fix first.
2. After that, consider aligning the live Phase 1 artifact contract with the canonical-key expectation used in the video prompt tests (`*Reconciled` keys in-memory, not just on disk).
3. Add one integration-style regression test that runs the sequential Phase 1 merge with reconciliation and asserts that the final `musicData.segments` / `musicVocalsData.vocal_segments` counts stay single-copy before `whole-video-mimo` sees them.

## Bottom line

The canonical one-copy-per-lane fix in `whole-video-mimo` worked at the local script level, but the real provider-backed whole-video run still duplicated support content because the lane artifacts were already doubled upstream during Phase 1 artifact merging. The prompt builder is rendering a bad merged artifact, not reintroducing the duplication itself.
