# Phase 1 reconciliation contract posture (raw vs reconciled)

**Date:** 2026-04-17  
**Related beads:** `ee-emj3`, `ee-baqh`, `ee-7i76`

## Bottom line

For the current Phase 1 slice, raw dialogue is allowed to be noisy.
That includes music-vocal leakage when the dialogue capture pass keeps borderline spoken-vocal material for later cleanup.
That is not, by itself, a product bug right now.

The near-term product seam we actually need to stabilize is:

1. **raw Phase 1 extraction artifacts** (`dialogueData`, `musicVocalsData`, `musicData`)  
2. **end-of-Phase-1 reconciliation / post-processing artifacts** (reconciled dialogue, reconciled music-vocals, reconciliation ledger)  
3. **comparison/reporting posture** that stays honest about which surface is provisional vs actionable

We should **defer regenerating dialogue golden benchmark surfaces** until the Phase 1 script and contract shape settle.

## What the current code already proves

### 1) The file-level contract already has a raw/reconciled split

`server/lib/phase1-baseline-resolution.cjs` already defines a useful file-level distinction:

- raw Phase 1 artifacts:
  - `phase1-gather-context/dialogue-data.json`
  - `phase1-gather-context/music-data.json`
  - `phase1-gather-context/music-vocals-data.json`
- reconciled post-processing artifacts:
  - `phase1-gather-context/dialogue-data.reconciled.json`
  - `phase1-gather-context/music-vocals-data.reconciled.json`
  - `phase1-gather-context/famous-song-reconciliation.json`

`server/lib/persisted-artifacts.cjs` and `server/lib/benchmark-runner.cjs` already resolve to the reconciled file when reconciliation is configured.
So the **disk contract** is ahead of the **runtime artifact-bag contract**.

### 2) The runtime artifact bag still blurs ownership

`server/scripts/get-context/reconcile-famous-song-phase1.cjs` writes the reconciled files to disk, but it also returns:

- `dialogueData: strippedDialogueData`
- `musicVocalsData: strippedMusicVocalsData`
- `musicData: musicData`
- `famousSongReconciliation: ledger`

That means the reconciliation/post-processing lane is still re-emitting post-processed dialogue and music-vocals back under the raw top-level keys.
So even though the files on disk are split cleanly, the in-memory artifact bag still makes ownership ambiguous.

### 3) Prior array-duplication risk was a symptom of the same seam problem

`docs/research/2026-04-08-whole-video-prompt-duplication-investigation.md` showed that same-key re-emission from reconciliation combined badly with Phase 1 merge behavior.
`server/lib/phases/gather-context-runner.cjs` has since been tightened so overlapping nested arrays replace rather than concatenate, which helps.
But that fix does **not** fully settle the contract question.
It reduces one failure mode while leaving the raw-vs-reconciled ownership boundary fuzzy in memory.

### 4) The current dialogue comparator surface is not trustworthy enough to drive product judgments

Task 7 evidence already showed:

- the current dialogue benchmark truth is provisional/stale in both **boundary** and **shape**
- `cleanedTranscript` currently mismatches structurally
- raw dialogue may intentionally retain lyric leakage before reconciliation/post-processing settles

So a direct raw-dialogue-vs-current-gold reading will over-report failure for reasons we already know are provisional.
That needs to be treated as **deferred contract drift**, not as a clean product-bug signal.

## Execution posture for the rest of this slice

### Treat raw dialogue as evidence collection, not final judgment

Until the reconciliation/post-processing seam is stabilized:

- raw dialogue is an extraction surface
- reconciled dialogue is the first candidate comparison surface
- the reconciliation ledger is the ownership/audit surface that explains what changed and why

### Do not refresh gold truth yet

Do **not** regenerate dialogue gold artifacts yet.
The benchmark surface should wait until:

- raw-vs-reconciled ownership is explicit
- end-of-Phase-1 post-processing responsibilities are explicit
- comparison/reporting can distinguish provisional contract drift from real regressions

### Keep the comparator honest in the meantime

Near-term reporting should separate:

- raw extraction drift
- reconciled/post-processing drift
- stale benchmark-shape drift

Those are not the same class of problem and should not collapse into one headline number.

## Next concrete implementation beads

### `ee-baqh` — Split raw and reconciled Phase 1 lane artifacts in-memory and preserve post-processing ownership

Why it exists:
- the disk contract is already split, but the runtime artifact bag still is not
- reconciliation needs to own explicit post-processing outputs instead of overwriting raw lane ownership in memory
- this is the cleanest next execution slice because it stabilizes the artifact seam other work will build on

### `ee-7i76` — Make Phase 1 dialogue comparison/reporting honest about provisional raw-vs-reconciled boundaries

Why it exists:
- current structural misses are being interpreted against a benchmark surface we already know is stale
- we need truthful comparison/reporting before any new semantic read of the Phase 1 slice
- this lets us defer gold refresh without pretending the current comparator output is product-truth

## Recommended next bead

**Execute `ee-baqh` next.**

Why:
- it fixes the narrowest contract problem first
- it makes raw vs reconciled ownership explicit at runtime, not just on disk
- it gives `ee-7i76` a stable artifact contract to report against
- it is the prerequisite seam for any honest next cod-test interpretation
