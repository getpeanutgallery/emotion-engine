# Index-only time-assumption audit: dialogue, music, and music-vocals

**Date:** 2026-04-08  
**Scope:** Remaining consumers in dialogue / music / music-vocals codepaths that still expect or materially rely on timing after the approved dialogue + music-vocals index-only direction.

## Bottom line

The biggest remaining blockers are **not** the optional `start` / `end` fields themselves. The real blockers are the places that still **use timing as a decision gate or recall scaffold**:

1. **Famous-song reconciliation still hard-depends on `recognizedSong.timeRanges` and timed overlap.**
2. **Chunked music-vocals refinement still builds recall/checklist context from timed whole-asset vocal spans.**
3. **Benchmark/reporting still treats recognized-song `timeRanges` as comparable truth-bearing structure.**

Those three paths can still make the next run misleading even if dialogue/music-vocals segment chronology is otherwise index-first.

---

## Must-fix before next run

### 1) Famous-song reconciliation gate still requires timed evidence

**Paths**
- `server/scripts/get-context/reconcile-famous-song-phase1.cjs:391-425`
- `server/scripts/get-context/reconcile-famous-song-phase1.cjs:427-484`
- `test/scripts/reconcile-famous-song-phase1.test.js` (fixtures/assertions still built around timed ranges)

**What still relies on timing**
- `buildRecognitionGate()` extracts `primaryCandidate.timeRanges` and requires:
  - `hasTimeRanges`
  - `overlapsVocalSegments`
- `reconcileDialogue()` uses `overlapTargets = [...gate.timeRanges, ...vocalSegments]` and only removes lyric contamination when dialogue segments overlap those timed targets.
- `reconcileMusicVocals()` skips correction unless a vocal segment `overlapsStrongly(segment, gate.timeRanges)`.

**Why it still matters**
- In the new world, dialogue/music-vocals chronology is supposed to remain truthful even when precise timing is absent.
- This reconciler still treats timing as the approval gate for whether lyric cleanup/correction is allowed to happen.
- If `timeRanges` are absent, sparse, or hallucinated, reconciliation either fails open or applies unevenly.
- That directly matches the current failure mode: lyric material can remain in dialogue while real spoken lines are still lost.

**Category:** **Must-fix-before-next-run**

---

### 2) Music-vocals chunk recall still depends on timed whole-asset spans

**Paths**
- `server/scripts/get-context/get-music-vocals.cjs:1342-1388`
- `server/scripts/get-context/get-music-vocals.cjs:1479-1566`

**What still relies on timing**
- `formatWholeAssetVocalsContext()` prints whole-asset lyric-bearing moments as `start-end "text"`.
- `formatWholeAssetVocalsChunkChecklist()` only surfaces expected/nearby lyrics by comparing each whole-asset segment's `start` / `end` against the current chunk window.
- The chunk prompt then uses that checklist as recall scaffolding during chunk refinement.

**Why it still matters**
- This is a real runtime consumer, not just metadata.
- Once whole-asset `vocal_segments` become index-only or timing-light, the chunk checklist loses the mechanism it currently uses to tell the model what lyric moments belong near the current window.
- That means chunked refinement can drift, miss late returns/reprises, or over-copy the wrong canonical lyric at the wrong point.

**Category:** **Must-fix-before-next-run**

---

### 3) Benchmark/reporting still treats recognized-song `timeRanges` as truth-bearing comparable structure

**Paths**
- `server/lib/benchmark-runner.cjs:1479-1481`
- `server/lib/benchmark-runner.cjs:1060-1240`
- `test/lib/benchmark-runner.test.js:1900-1997`

**What still relies on timing**
- The comparator still walks and compares `recognizedSong.candidates[*].timeRanges` as structured evidence.
- The generic benchmark engine still contains time-aware comparison rules/tolerances/search windows that remain active anywhere timing fields are still present and not explicitly ignored.

**Why it still matters**
- Dialogue/music-vocals segment arrays were partially updated, but recognized-song time ranges still remain benchmark-significant.
- That means benchmark truth can still fail for timing reasons even if the index-only lane output is otherwise correct enough for the new contract.
- If the next run is used to evaluate whether the migration helped, this keeps the score/report surface partially pinned to the old time-bearing contract.

**Category:** **Must-fix-before-next-run**

---

## Can defer (important, but not the immediate next-run blocker)

### 4) Dialogue final artifact metadata still carries time-derived contract surface

**Paths**
- `server/scripts/get-context/get-dialogue.cjs:473-579`
- `server/scripts/get-context/get-dialogue.cjs:1934-2008`
- `server/scripts/get-context/get-dialogue.cjs:2041-2050`
- `server/lib/structured-output.cjs:636-671`

**What still relies on timing**
- Dialogue output still preserves / derives `totalDuration`, `timingMode`, and `coverage`.
- Hybrid/chunked branches still describe the lane in terms of `chunk_local`, `full_timeline`, and timing-fidelity quality notes.
- Console/report logging still emphasizes total duration.

**Why it matters**
- Segment timing has been stripped from final dialogue artifacts, but the artifact still presents itself as if timeline metadata is a stable part of the contract.
- That is inconsistent with the approved direction and invites future downstream consumers to keep treating dialogue as timeline-owned.

**Why deferable**
- These fields are no longer the main gating mechanism for reconciliation or benchmarking of dialogue segment order.
- They are contract-dirty, but not the sharpest cause of the current next-run failure.

**Category:** Can-defer

---

### 5) Music-vocals artifact normalization still preserves timing-shaped metadata and optional `timeRanges`

**Paths**
- `server/lib/music-vocals-artifact.cjs:77-122`
- `server/lib/music-vocals-artifact.cjs:139-160`
- `server/lib/structured-output.cjs:775-874`

**What still relies on timing**
- `normalizeRecognizedSong()` still preserves candidate `timeRanges` when present.
- `buildMusicVocalsData()` still emits `totalDuration`, `timingMode`, and full-span `coverage`.
- Validator/normalizer paths still treat time-bearing recognized-song evidence as a first-class shape.

**Why it matters**
- Even after index-first segment chronology landed, the normalized artifact still leaves a lot of time-shaped surface area available for downstream consumers to privilege.
- That is exactly why reconciliation and benchmark paths were able to remain time-gated.

**Why deferable**
- If the consuming paths above are fixed first, these fields become optional/passive rather than actively harmful.
- They should still be cleaned up afterward for contract coherence.

**Category:** Can-defer

---

### 6) Validator-tool contract/examples still teach a partially timeful shape

**Paths**
- `server/lib/phase1-validator-tools.cjs:111-147`
- `server/lib/phase1-validator-tools.cjs:186-240`

**What still relies on timing**
- Dialogue validator example still shows `start`, `end`, `coverage`, `timingMode`, and quality notes about preserved timing.
- Music validator example still shows recognized-song `timeRanges`.
- The tool descriptions still frame timing as normal/expected supporting structure.

**Why it matters**
- These contracts are part of the local validator loop the model sees.
- Even if fields are technically optional, the examples still bias repairs toward reintroducing timeful output.

**Why deferable**
- This is more of a model-shaping / contract-hygiene issue than the hard blocker behind the current rerun regressions.

**Category:** Can-defer

---

### 7) Music-data runtime is still explicitly timeline-first across prompts, parsing, and context helpers

**Paths**
- `server/scripts/get-context/get-music.cjs:1188-1279`
- `server/scripts/get-context/get-music.cjs:1398-1505`
- `server/scripts/get-context/get-music.cjs:1588-1678`
- `test/scripts/get-music.test.js`

**What still relies on timing**
- Whole-asset music output still requires timeline segments with `start` / `end`.
- `globalArc.notableTransitions` are explicitly timed.
- Recognized-song examples still include `timeRanges`.
- Chunk prompts are built around global window times and chunk-local time-bearing evidence.

**Why it matters**
- Music-data is still functioning as a timeline-oriented support lane while dialogue/music-vocals are moving toward index-first chronology.
- That mismatch can keep leaking time-based assumptions back into cross-lane helpers and reconciliation.

**Why deferable**
- This appears to be the subject of the separate follow-up audit/task (`ee-kf3f`).
- It is a real remaining time assumption, but not the narrowest blocker for the next dialogue/music-vocals rerun once reconciliation and benchmark comparison are corrected.

**Category:** Can-defer

---

### 8) Benchmark core still contains generic time-aware heuristics beyond the dialogue/music-vocals ignore paths

**Paths**
- `server/lib/benchmark-runner.cjs:11-16`
- `server/lib/benchmark-runner.cjs:453-481`
- `server/lib/benchmark-runner.cjs:637-646`
- `server/lib/benchmark-runner.cjs:908-993`

**What still relies on timing**
- Global defaults still classify `start`, `end`, `duration`, `totalDuration`, etc. as temporal fields.
- Time-aware candidate search windows and tolerances still shape array alignment whenever timings exist.

**Why it matters**
- The runner is no longer time-authoritative for dialogue/music-vocals segment arrays, but it is still fundamentally a time-aware comparator.
- Any leftover time fields that sneak into these artifacts keep pulling the reports back toward the old worldview.

**Why deferable**
- The segment-array-specific fix already landed.
- The next practical blockers are the still-active recognized-song and reconciliation uses above.

**Category:** Can-defer

---

### 9) Tests and fixtures still lock several time-bearing assumptions

**Paths**
- `test/lib/local-validator-tool-loop.test.js`
- `test/lib/phase1-validator-tools.test.js`
- `test/scripts/get-dialogue.test.js`
- `test/scripts/get-music.test.js`
- `test/scripts/reconcile-famous-song-phase1.test.js`

**What still relies on timing**
- These tests still contain many fixtures with `totalDuration`, timed ranges, and recognized-song `timeRanges`.
- Reconciliation tests in particular are built around timed overlap evidence.

**Why it matters**
- They are not production consumers, but they lock the old assumptions in place and will resist cleanup of the runtime paths above.

**Why deferable**
- They should move in the same changeset as the runtime fixes they protect.
- By themselves they do not block the next run; they block landing the fixes safely.

**Category:** Can-defer

---

## Recommended order

1. **Replace `reconcile-famous-song-phase1.cjs` time-range gating with index/text-evidence gating.**
2. **Replace the timed whole-asset vocals chunk checklist with an index/sequence-oriented recall scaffold.**
3. **Stop benchmark truth/reporting from treating recognized-song `timeRanges` as authoritative for these migrated lanes.**
4. Then clean up leftover metadata/examples (`totalDuration`, `timingMode`, `coverage`, validator examples, test fixtures).

## Suggested output path for plan update

- `docs/2026-04-08-index-only-time-assumption-audit-dialogue-music-music-vocals.md`
