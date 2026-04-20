# Current cod-test famous-song reconciliation skip audit

**Date:** 2026-04-20  
**Bead:** `ee-lggd`  
**Scope:** Audit / reproduction only. No runtime implementation change.

## Executive summary

The current `cod-test` run is **configured** to use famous-song reconciliation, and the benchmark system therefore resolves the canonical Phase 1 comparison surfaces to:

- `output/cod-test/phase1-gather-context/dialogue-data.reconciled.json`
- `output/cod-test/phase1-gather-context/music-vocals-data.reconciled.json`

But the reconciliation step itself **did not authorize any rewrite** on this run. The ledger at `output/cod-test/phase1-gather-context/famous-song-reconciliation.json` shows `status: "skipped"`, and the raw vs reconciled artifacts are byte-identical.

The exact current skip cause is **not** the older lyric-order failure documented on 2026-04-08. On the current code + current run shape, `hasIndexOrderEvidence` is already passing. The actual blocker is that the dialogue-side lyric-evidence detector finds **zero qualifying dialogue hits**, so `hasStrongDialogueVocalsEvidence` stays false, which re-enables the fallback requirement for `musicData` supporting-song consensus. That supporting consensus is absent (`possible`, `0.64`), so the top-level gate still fails with `reasons: ["hasSupportingMusicConsensus"]`.

## Configuration intent vs actual runtime behavior

### Configuration intent

`configs/cod-test.yaml` includes the reconciliation script in `gather_context`:

```yaml
gather_context:
- server/scripts/get-context/get-dialogue.cjs
- server/scripts/get-context/get-music.cjs
- server/scripts/get-context/get-music-vocals.cjs
- server/scripts/get-context/reconcile-famous-song-phase1.cjs
```

That matters because `server/lib/phase1-baseline-resolution.cjs` treats reconciliation as configured whenever `reconcile-famous-song-phase1.cjs` is present in `gather_context`. Once that is true, `resolvePhase1ArtifactPath()` and the benchmark runner prefer the reconciled Phase 1 files as the canonical comparison surface.

So the **configuration-level intent** is clear:

- run the reconciliation pass
- then benchmark the reconciled dialogue/music-vocals outputs, not the raw ones

### Actual runtime behavior

`server/scripts/get-context/reconcile-famous-song-phase1.cjs` has a second, stronger gate: `buildRecognitionGate()`.

If that gate passes, it:
- removes lyric contamination from dialogue via `reconcileDialogue()`
- optionally normalizes lyric text in music-vocals via `reconcileMusicVocals()`
- writes meaningfully rewritten `*.reconciled.json` artifacts

If that gate fails, it still writes the reconciled files and ledger, but the reconciled files are just clones of raw data.

That is exactly what happened here.

## Real current run shape

### Dialogue artifact

`output/cod-test/phase1-gather-context/dialogue-data.json`

- 18 dialogue segments total
- the likely lyric contamination is concentrated in **dialogue segment index 11**
- that segment is one long mixed / paraphrased lyric block, not a clean sequence of short lyric fragments

Contaminated segment text:

> `Obey your master... Master... Just call me faster... Master... Master... The master's puppet's a puppet's brain... Twisting your mind, smashing your day... Blinding from me, you can't see... Just go ahead, it's all in your head... Master, master... Plans and dreams are now in the after... Master, master... You'll be in my grasp...`

### Music-vocals artifact

`output/cod-test/phase1-gather-context/music-vocals-data.json`

- 14 vocal segments total
- `recognizedSong.status = "recognized"`
- `recognizedSong.confidence = 0.95`
- exactly one candidate song: `Master of Puppets`
- but the candidate only carries **three** `matchedLyrics` entries:
  1. `Master, master`
  2. `I'll be your master`
  3. `Master of puppets, I'm pulling your strings`

### Supporting music artifact

`output/cod-test/phase1-gather-context/music-data.json`

- supporting `recognizedSong.status = "possible"`
- supporting `recognizedSong.confidence = 0.64`

That is below the threshold required when supporting-music consensus is needed.

## Exact gate replay on the current run

Replaying `buildRecognitionGate()` from `server/scripts/get-context/reconcile-famous-song-phase1.cjs` against the current runtime artifacts yields:

- `recognizedSong.statusRecognized = true`
- `recognizedSong.confidenceStrong = true`
- `singlePrimaryCandidate = true`
- `multipleSongsAbsent = true`
- `sufficientMatchedLyrics = true`
- `vocalLyricEvidence.hasLyricTextEvidence = true`
- `vocalLyricEvidence.hasIndexOrderEvidence = true`
- `dialogueLyricEvidence.hasLyricTextEvidence = false`
- `dialogueLyricEvidence.hasIndexOrderEvidence = true`
- `hasStrongDialogueVocalsEvidence = false`
- `requiresSupportingMusicConsensus = true`
- `hasSupportingMusicConsensus = false`
- final gate result: `passed = false`, `reasons = ["hasSupportingMusicConsensus"]`

## Why dialogue lyric evidence is failing now

This is the actual current mismatch.

The dialogue-side evidence path is built by:
- `buildRecognitionGate()`
- `buildLyricEvidence(dialogueSegments, matchedLyrics, MIN_DIALOGUE_LYRIC_SIMILARITY)`

For dialogue, the gate only compares dialogue text against the **short `matchedLyrics` list** from the recognized music-vocals song candidate, using `MIN_DIALOGUE_LYRIC_SIMILARITY = 0.72`.

On this run, that is a poor fit for the actual contamination shape:

- the dialogue lane does **not** contain several short clean lyric fragments
- instead it contains **one long contaminated mashup/paraphrase block**
- the block includes many wrong or drifted forms:
  - `Just call me faster` vs expected lyric family like `Come crawling faster` / `Just call my name`
  - `The master's puppet's a puppet's brain`
  - `smashing your day`
  - `Blinding from me`
  - `Plans and dreams are now in the after`
  - `You'll be in my grasp`
- because the detector scores each dialogue segment against only the 3 short candidate `matchedLyrics`, none of those comparisons clear the dialogue threshold

So the current run is **obviously contaminated to a human**, but **not similar enough in the detector's narrow expected shape** to count as `dialogueLyricEvidence`.

## Why the current run produces no effective rewrite

Once `gate.passed === false`, the script intentionally takes the no-op branch:

- `dialogueResult.reconciledData = cloneJson(dialogueData)`
- `musicVocalsResult.reconciledData = cloneJson(musicVocalsData)`
- no dialogue segments removed
- no lyric corrections applied

That matches the current ledger exactly:

- `status: "skipped"`
- `decisions.removedDialogueSegments: []`
- `decisions.lyricCorrections: []`
- `decisions.skippedCorrections: [{ "reason": "hasSupportingMusicConsensus" }]`

And it matches the raw-vs-reconciled comparison exactly:

- `dialogue-data.json === dialogue-data.reconciled.json`
- `music-vocals-data.json === music-vocals-data.reconciled.json`

## Precise gate / condition mismatch

There are **two different gates** in play, and they do not mean the same thing:

### Gate A: benchmark/configuration gate

Location:
- `configs/cod-test.yaml`
- `server/lib/phase1-baseline-resolution.cjs`
- `server/lib/benchmark-runner.cjs`

Meaning:
- if reconciliation is configured, benchmark the reconciled artifact paths

### Gate B: runtime rewrite authorization gate

Location:
- `server/scripts/get-context/reconcile-famous-song-phase1.cjs`
- specifically `buildRecognitionGate()`

Meaning:
- only actually rewrite dialogue/music-vocals if the recognized-song evidence is strong enough under the runtime heuristics

### Mismatch

The benchmark/config layer treats reconciliation as active based on **script presence**.

The runtime rewrite layer requires something much stricter:
- either strong cross-lane lyric evidence in both `music-vocals` and `dialogue`
- or, if that strong cross-lane evidence is missing, a qualifying supporting-song consensus from `musicData`

On this run:
- **Gate A passes** because the script is configured
- **Gate B fails** because the dialogue contamination shape does not satisfy the dialogue lyric-evidence heuristic, which then forces the supporting-music-consensus check, which also fails

So the benchmark honestly reads the reconciled paths, but those paths contain no real rewrite.

That is the exact current no-op/skip condition mismatch.

## Important correction to the older 2026-04-08 investigation

`docs/research/2026-04-08-real-run-famous-song-reconciliation-skip-investigation.md` correctly documented the earlier failure mode at that time: repeated lyric order / chorus re-entry broke `hasIndexOrderEvidence`.

That is **not the live blocker for the current run/code**.

The current code now computes `hasIndexOrderEvidence` from first-occurrence hits, and on the current artifacts both:
- `vocalLyricEvidence.hasIndexOrderEvidence`
- `dialogueLyricEvidence.hasIndexOrderEvidence`

are already `true`.

So implementation bead `ee-hc0p` should **not** primarily chase lyric-order monotonicity anymore. The current failure is upstream of that: the dialogue detector never finds enough qualifying lyric text evidence in the first place.

## Benchmark consequence

Because reconciliation is configured, `server/lib/benchmark-runner.cjs` compares against:
- `output/cod-test/phase1-gather-context/dialogue-data.reconciled.json`
- `output/cod-test/phase1-gather-context/music-vocals-data.reconciled.json`

Current benchmark evidence confirms that posture:

### Dialogue benchmark report

`benchmarks/fixtures/cod-test/_reports/artifact-results/dialogueData.json`

- `output.path = output/cod-test/phase1-gather-context/dialogue-data.reconciled.json`
- `comparisonBoundary.outputSurface = "reconciled"`
- summary begins with `posture=reconciled/post-processing contract`

### Music-vocals benchmark report

`benchmarks/fixtures/cod-test/_reports/artifact-results/musicVocalsData.json`

- `output.path = output/cod-test/phase1-gather-context/music-vocals-data.reconciled.json`

So the benchmark is doing what configuration says. The problem is that the runtime reconciler never moved the contaminated content before those files were written.

## Handoff guidance for implementation bead `ee-hc0p`

Target the **runtime gate**, not the benchmark runner.

Most concrete current fix direction:

1. **Keep benchmark runner behavior as-is for now.**
   - It is honestly reading the canonical reconciled surface when reconciliation is configured.
   - The current failure is upstream.

2. **Adjust `buildRecognitionGate()` / dialogue evidence detection for the actual benchmark shape.**
   - The current dialogue contamination is a long paraphrased lyric mashup, not a sequence of short exact lyric fragments.
   - Requiring `dialogueLyricEvidence` to clear `MIN_DIALOGUE_LYRIC_SIMILARITY` against only the 3 short `matchedLyrics` entries is too narrow for this run.

3. **Do not spend the next bead primarily on lyric-order fixes.**
   - The current run already has `hasIndexOrderEvidence = true`.
   - The older order-based skip note is now stale for this specific reproduction.

4. **Likely smallest durable implementation lane:**
   - keep the strong recognized-song requirements in `music-vocals`
   - broaden what counts as qualifying dialogue contamination evidence when the dialogue lane contains one large low-confidence lyric-like block that is strongly supported by the recognized song and nearby vocal evidence
   - or relax the requirement that strong cross-lane evidence must come from `buildLyricEvidence(dialogue, matchedLyrics, 0.72)` alone before waiving supporting-music consensus

5. **Success criterion for `ee-hc0p`:**
   - current run should flip from `status: "skipped"` to a real `applied` reconciliation on this artifact shape
   - `dialogue-data.reconciled.json` should differ materially from `dialogue-data.json`
   - `famous-song-reconciliation.json` should record actual `removedDialogueSegments` and/or `lyricCorrections`
   - benchmark reports should still read reconciled paths, but now those paths should contain actual post-processing changes

## Files / artifacts inspected

Code:
- `configs/cod-test.yaml`
- `server/lib/phase1-baseline-resolution.cjs`
- `server/lib/benchmark-runner.cjs`
- `server/scripts/get-context/reconcile-famous-song-phase1.cjs`

Runtime artifacts:
- `output/cod-test/phase1-gather-context/dialogue-data.json`
- `output/cod-test/phase1-gather-context/dialogue-data.reconciled.json`
- `output/cod-test/phase1-gather-context/music-data.json`
- `output/cod-test/phase1-gather-context/music-vocals-data.json`
- `output/cod-test/phase1-gather-context/music-vocals-data.reconciled.json`
- `output/cod-test/phase1-gather-context/famous-song-reconciliation.json`

Benchmark evidence:
- `benchmarks/fixtures/cod-test/benchmark.json`
- `benchmarks/fixtures/cod-test/_reports/artifact-results/dialogueData.json`
- `benchmarks/fixtures/cod-test/_reports/artifact-results/musicVocalsData.json`
- `benchmarks/fixtures/cod-test/_reports/benchmark-summary.json`

Prior investigation reviewed and superseded for this run-specific cause:
- `docs/research/2026-04-08-real-run-famous-song-reconciliation-skip-investigation.md`
