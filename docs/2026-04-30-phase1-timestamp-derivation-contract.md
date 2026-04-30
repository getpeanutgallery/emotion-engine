# Phase 1 Timestamp-Derivation Contract

**Date:** 2026-04-30  
**Status:** Drafted for implementation  
**Scope:** Dialogue + music-vocals timestamp derivation only

---

## Purpose

Define the exact contract for new bounded Phase 1 follow-on scripts that derive timestamps against source audio from already-produced Phase 1 text artifacts, without mutating the canonical existing text artifacts.

This contract covers:

- `server/scripts/get-context/get-dialogue-timestamps.cjs`
- `server/scripts/get-context/get-music-vocals-timestamps.cjs`

It does **not** cover:

- changing `get-dialogue.cjs` or `get-music-vocals.cjs` primary artifact semantics
- changing the reconciliation policy itself
- inventing a new generalized lyric/dialogue extraction architecture
- adding Phase 2/3 consumers yet

---

## Current baseline facts this contract must preserve

### 1. Existing Phase 1 dialogue/music-vocals artifacts are intentionally text/index first

`get-dialogue.cjs`, `get-music-vocals.cjs`, and `reconcile-famous-song-phase1.cjs` all strip final `start` / `end` timing from the shipped artifacts. Chronology currently lives in array order and `index`, not in persisted timing fields.

### 2. Reconciliation already defines a raw vs reconciled surface

`server/lib/phase1-baseline-resolution.cjs` already treats these artifacts as having canonical raw/reconciled variants:

- `dialogueData`
- `dialogueV3SourceTruth`
- `musicVocalsData`

When famous-song reconciliation is configured, `runtimeArtifactSurface: 'canonical'` resolves to the reconciled artifact when that artifact key has a reconciled surface.

### 3. Reconciliation is allowed to remove dialogue contamination, but not rewrite music-vocals transcript text

`reconcile-famous-song-phase1.cjs` preserves music-vocals transcript text and only uses recognized-song metadata as identity/support metadata. That boundary must remain intact for timestamp derivation too.

### 4. Persisted-artifact loading already depends on canonical raw/reconciled resolution

`server/lib/persisted-artifacts.cjs` resolves Phase 1 baseline artifacts through `selectCanonicalPhase1ArtifactFromBag()` / `resolvePhase1ArtifactPath()`. The new timestamped artifacts should plug into the same model instead of bypassing it.

---

## High-level contract

The new scripts are **derivation scripts**, not extraction scripts.

They must:

1. read an already-persisted source transcript artifact (`dialogueData` or `musicVocalsData`)
2. choose the correct source surface (`raw` vs `reconciled`) using the existing Phase 1 surface-resolution rules
3. derive timeline timestamps against the source audio
4. write a **new sibling artifact** that preserves the chosen source text verbatim while adding timing/alignment metadata
5. record provenance that makes the source surface, timing method, and confidence/quality caveats explicit

They must **not**:

- overwrite `dialogue-data.json`
- overwrite `dialogue-data.reconciled.json`
- overwrite `music-vocals-data.json`
- overwrite `music-vocals-data.reconciled.json`
- rewrite source transcript text to make timing easier
- silently collapse raw/reconciled distinctions

---

## Exact script/output naming contract

### New script files

- `server/scripts/get-context/get-dialogue-timestamps.cjs`
- `server/scripts/get-context/get-music-vocals-timestamps.cjs`

### New artifact keys

Add these Phase 1 artifact keys:

- `dialogueTimestampsData`
- `musicVocalsTimestampsData`

### New runtime reconciled keys

Add these reconciled runtime keys:

- `dialogueTimestampsDataReconciled`
- `musicVocalsTimestampsDataReconciled`

### New persisted file paths

#### Raw-surface timestamp outputs

- `phase1-gather-context/dialogue-timestamps-data.json`
- `phase1-gather-context/music-vocals-timestamps-data.json`

#### Reconciled-surface timestamp outputs

- `phase1-gather-context/dialogue-timestamps-data.reconciled.json`
- `phase1-gather-context/music-vocals-timestamps-data.reconciled.json`

### Why this naming

This is the least surprising extension of the existing contract:

- current text artifacts stay where they are
- reconciled variants keep the existing `.reconciled.json` suffix model
- timestamped derivatives get their own artifact family instead of pretending to be the original artifacts
- the raw/reconciled distinction remains visible in both runtime keys and persisted filenames

### Explicit non-decision

Do **not** add a timestamped `dialogue-v3-source-truth` artifact in this slice.

Reason:

- the bounded request is about dialogue + music-vocals timestamp derivation
- `dialogue-v3-source-truth` is a trait-emission artifact, not the canonical consumer-facing timed transcript surface
- adding a third timed artifact family in this slice would broaden scope and create avoidable schema ambiguity

If downstream consumers later need a timed dialogue-v3 projection, that should be a separate follow-on artifact with its own contract.

---

## Required helper/library integration

Implementation should extend the existing helper contracts instead of special-casing timestamp files.

### `server/lib/phase1-baseline-resolution.cjs`

Extend the following maps:

#### `RAW_PHASE1_PATHS`

Add:

- `dialogueTimestampsData: ['phase1-gather-context', 'dialogue-timestamps-data.json']`
- `musicVocalsTimestampsData: ['phase1-gather-context', 'music-vocals-timestamps-data.json']`

#### `RECONCILED_PHASE1_PATHS`

Add:

- `dialogueTimestampsData: ['phase1-gather-context', 'dialogue-timestamps-data.reconciled.json']`
- `musicVocalsTimestampsData: ['phase1-gather-context', 'music-vocals-timestamps-data.reconciled.json']`

#### `RECONCILED_PHASE1_RUNTIME_KEYS`

Add:

- `dialogueTimestampsData: 'dialogueTimestampsDataReconciled'`
- `musicVocalsTimestampsData: 'musicVocalsTimestampsDataReconciled'`

### `server/lib/persisted-artifacts.cjs`

Extend `DEFAULT_LOCATIONS` with the raw-path defaults:

- `dialogueTimestampsData: ['phase1-gather-context', 'dialogue-timestamps-data.json']`
- `musicVocalsTimestampsData: ['phase1-gather-context', 'music-vocals-timestamps-data.json']`

That allows `loadPersistedArtifacts()` and `getArtifactFileHints()` to resolve timestamped derivatives through the same canonical raw/reconciled logic already used for baseline Phase 1 artifacts.

### `server/lib/script-contract.cjs`

Add primary artifact locations for the new raw artifact keys:

- `dialogueTimestampsData: 'phase1-gather-context/dialogue-timestamps-data.json'`
- `musicVocalsTimestampsData: 'phase1-gather-context/music-vocals-timestamps-data.json'`

This keeps script-result envelopes consistent when either timestamp script is a script-primary artifact producer.

---

## Input selection rules

## Default posture

Both new scripts must accept `runtimeArtifactSurface` with the same supported values already used by baseline resolution:

- `raw`
- `reconciled`
- `canonical`

Default should be:

- `runtimeArtifactSurface: 'canonical'`

### Canonical resolution rule

For both lanes, `canonical` means:

1. if famous-song reconciliation is configured **and** the source artifact family has a reconciled variant, use the reconciled source artifact
2. otherwise use the raw source artifact

This must be implemented by reusing:

- `selectCanonicalPhase1ArtifactFromBag()` when source artifacts are already in memory
- `resolvePhase1ArtifactPath()` when loading from disk

### Dialogue input source

`get-dialogue-timestamps.cjs` reads from:

- `dialogueData` when resolved surface is `raw`
- `dialogueDataReconciled` when resolved surface is `reconciled`

### Music-vocals input source

`get-music-vocals-timestamps.cjs` reads from:

- `musicVocalsData` when resolved surface is `raw`
- `musicVocalsDataReconciled` when resolved surface is `reconciled`

### Strictness rule

The scripts should support a strict mode aligned with the helper contract:

- if caller explicitly requests `runtimeArtifactSurface: 'reconciled'` and the reconciled artifact is missing, fail loudly
- if caller uses `canonical` and reconciliation is configured but the reconciled input artifact is missing, also fail loudly for these scripts

Reason: timestamp derivation is downstream of source-text selection. Silently deriving timestamps from the wrong transcript surface would create misleading artifacts.

This is stricter than some baseline fallback behavior on read-only helpers, and that is appropriate here because these scripts are writing durable derived artifacts.

### Output surface must mirror input surface

The script must write the timestamped artifact that matches the surface actually used:

- raw input source => raw timestamp output file/runtime key
- reconciled input source => reconciled timestamp output file/runtime key

It must **not** write both in one run unless explicitly invoked twice.

---

## Text preservation rules

## Hard rule: source text must be preserved verbatim in the emitted timestamp artifact

For every emitted timed segment:

- `text` must exactly match the selected source artifact segment text
- `index` must preserve the selected source artifact chronology/index contract
- lane-specific identity fields must be preserved verbatim where present
  - dialogue: `speaker`, `speaker_id`
  - music-vocals: `performer`, `performer_id`, `delivery`

### What is allowed internally

The implementation may do local normalization **internally** for matching/alignment only, such as:

- whitespace collapsing
- punctuation-insensitive matching
- case folding
- quote/apostrophe normalization
- tokenization helpers
- wordpiece/phoneme alignment helpers

### What is not allowed in emitted artifacts

The implementation may **not** change emitted source text by:

- rewriting to canonical lyrics
- fixing perceived ASR mistakes
- expanding fragments into fuller phrases
- trimming words to force an easier alignment
- merging adjacent source segments
- splitting one source segment into multiple persisted segments in v1

If alignment can only be achieved by mutating source text, that segment must instead be marked unresolved/low-confidence within the timing metadata.

### Why this rule matters

The entire value of the timestamp artifact is “timing for this exact chosen source transcript surface.” Once text mutates, the artifact stops being a trustworthy derivative.

---

## Output schema contract

The timestamped artifacts should be sibling schemas that preserve the source artifact shape where practical, but add derivation metadata and per-segment timing.

## Dialogue timestamp artifact

Artifact key:

- `dialogueTimestampsData`
- or `dialogueTimestampsDataReconciled` in runtime memory when reconciled

Required top-level shape:

```json
{
  "dialogue_segments": [
    {
      "index": 0,
      "start": 1.234,
      "end": 2.468,
      "speaker": "Speaker 1",
      "speaker_id": "spk_001",
      "text": "example line",
      "confidence": 0.72,
      "timing": {
        "status": "aligned",
        "confidence": 0.88,
        "method": "asr_alignment",
        "provenance": "segment_level"
      }
    }
  ],
  "summary": "...",
  "totalDuration": 123.456,
  "analysisMode": "timestamp_derivation",
  "timingMode": "full_timeline",
  "sourceStrategy": "derived_from_phase1_artifact",
  "coverage": {
    "start": 0,
    "end": 123.456,
    "duration": 123.456,
    "complete": true
  },
  "provenance": {
    "derivationKind": "phase1_timestamp_derivation",
    "runtimeArtifactSurface": "reconciled",
    "sourceArtifactKey": "dialogueData",
    "sourceRuntimeKey": "dialogueDataReconciled",
    "sourcePath": "phase1-gather-context/dialogue-data.reconciled.json",
    "sourceTextIntegrity": "verbatim",
    "sourceTimingPolicy": "source_artifact_was_untimed",
    "alignmentEngine": "TBD_AT_IMPLEMENTATION",
    "alignmentEngineVersion": null
  },
  "qualityNotes": [
    "Timing was derived after transcript extraction; timestamps are a downstream alignment product, not source-captured timings."
  ]
}
```

### Dialogue segment-level requirements

Each segment must preserve the selected source segment fields and add:

- `start` number when resolved
- `end` number when resolved
- `timing.status`
- `timing.confidence`
- `timing.method`
- `timing.provenance`

Allowed `timing.status` values:

- `aligned` — segment received a usable start/end pair
- `partial` — some timing evidence exists but precision is degraded
- `unresolved` — source segment was preserved but not confidently aligned

Rules:

- `aligned` requires finite `start` and `end` with `end > start`
- `partial` may still carry `start`/`end`, but quality notes must make degradation explicit
- `unresolved` should omit `start`/`end`

## Music-vocals timestamp artifact

Artifact key:

- `musicVocalsTimestampsData`
- or `musicVocalsTimestampsDataReconciled` in runtime memory when reconciled

Required top-level shape:

```json
{
  "vocal_segments": [
    {
      "index": 0,
      "start": 14.102,
      "end": 15.944,
      "text": "example line",
      "confidence": 0.81,
      "performer": "Vocalist 1",
      "performer_id": "voc_001",
      "delivery": "sung",
      "timing": {
        "status": "aligned",
        "confidence": 0.74,
        "method": "lyric_alignment",
        "provenance": "segment_level"
      }
    }
  ],
  "summary": "...",
  "hasVocals": true,
  "totalDuration": 123.456,
  "analysisMode": "timestamp_derivation",
  "timingMode": "full_timeline",
  "sourceStrategy": "derived_from_phase1_artifact",
  "coverage": {
    "start": 0,
    "end": 123.456,
    "duration": 123.456,
    "complete": true
  },
  "provenance": {
    "derivationKind": "phase1_timestamp_derivation",
    "runtimeArtifactSurface": "raw",
    "sourceArtifactKey": "musicVocalsData",
    "sourceRuntimeKey": "musicVocalsData",
    "sourcePath": "phase1-gather-context/music-vocals-data.json",
    "sourceTextIntegrity": "verbatim",
    "sourceTimingPolicy": "source_artifact_was_untimed",
    "alignmentEngine": "TBD_AT_IMPLEMENTATION",
    "alignmentEngineVersion": null,
    "recognizedSongUsedForTextRewrite": false
  },
  "recognizedSong": { "status": "possible", "confidence": 0.78, "candidates": [] },
  "recognitionNotes": ["..."],
  "qualityNotes": [
    "Music-vocals timing is more fragile than dialogue timing on sung, chant-like, or overlap-heavy material."
  ]
}
```

### Music-vocals segment-level requirements

Same timing field rules as dialogue, but preserve source lane fields:

- `index`
- `text`
- `confidence`
- `performer`
- `performer_id`
- `delivery`

and add:

- `start` / `end` when available
- `timing.*`

### Pass-through metadata rule for music-vocals

If the selected source artifact contains:

- `recognizedSong`
- `recognitionNotes`

then the timestamped artifact should carry them through unchanged unless the implementation has a very narrow reason to normalize structure into the already-validated canonical shape.

These fields remain metadata/support context only. They must not become permission to rewrite lyric text.

---

## Confidence, provenance, and quality-note requirements

## Required provenance fields

Both artifact families must include, at minimum:

- `provenance.derivationKind = 'phase1_timestamp_derivation'`
- `provenance.runtimeArtifactSurface = 'raw' | 'reconciled'`
- `provenance.sourceArtifactKey`
- `provenance.sourceRuntimeKey`
- `provenance.sourcePath`
- `provenance.sourceTextIntegrity = 'verbatim'`
- `provenance.sourceTimingPolicy = 'source_artifact_was_untimed'`
- `provenance.alignmentEngine`
- `provenance.alignmentEngineVersion`

### Required top-level quality note baseline

Both lanes should emit a baseline note equivalent to:

- timestamps are derived after transcript extraction
- they are not source-captured timestamps from the original extraction artifact

### Required lane-specific quality posture

#### Dialogue

Dialogue quality notes should call out when present:

- chunked/stitched dialogue source may make segment boundaries less exact than native full-timeline ASR output
- weak/partial dialogue fragments may align less confidently
- reconciled dialogue removed likely lyric contamination before timing derivation, if reconciled surface was used

#### Music-vocals

Music-vocals quality notes should call out when present:

- sung/chant/rap alignment is intrinsically less stable than ordinary spoken ASR alignment
- masking, overlap, and melodic stretching can reduce timing precision
- recognized-song metadata supported identity/context only and did not authorize text rewriting
- repeated hooks/refrains may be especially timing-ambiguous when the source segment text is intentionally short

## Per-segment timing confidence

Each emitted segment must include a separate timing confidence in `timing.confidence`.

This is distinct from the lane's existing source transcript confidence.

- source `confidence` continues to mean transcription/content confidence from the selected source artifact
- `timing.confidence` means alignment confidence for placing that already-chosen text on the timeline

Those numbers must not be conflated.

---

## Shared infra vs lane-specific differences

## Shared infra that should be reused

Both scripts should share a small timestamp-derivation helper layer for:

- source artifact surface resolution
- persisted artifact loading
- output path/runtime-key resolution
- common provenance construction
- common timing status model (`aligned` / `partial` / `unresolved`)
- common text-integrity enforcement
- common top-level quality note helpers
- common source-audio path validation / duration checks

A likely helper shape is a new Phase 1 timestamp-derivation library, but exact filenames are implementation detail.

## Where dialogue and music-vocals must differ

### Dialogue

Dialogue is the stronger fit for an ASR-anchored alignment path.

Dialogue-specific logic should assume:

- spoken phrasing usually aligns better than sung phrasing
- speaker fields must be preserved
- reconciled dialogue is often the preferred canonical surface when famous-song cleanup is configured

### Music-vocals

Music-vocals needs stricter guardrails.

Music-vocals-specific logic should assume:

- sung timing can be approximate even when text identity is good
- repeated refrains and compressed lyric fragments can make exact placement ambiguous
- recognized-song metadata can support confidence/provenance notes, but not transcript rewriting
- a segment may legitimately remain `partial` or `unresolved` without invalidating the whole artifact

### Important asymmetry

Dialogue timing should generally aim for per-segment aligned output when supportable.

Music-vocals timing should prefer truthfulness over completeness. It is acceptable for music-vocals to produce more `partial` / `unresolved` segment statuses than dialogue.

---

## How this fits existing persisted-artifact contracts

## Runtime artifact bag behavior

When these scripts return artifacts, they should follow the existing runtime bag pattern:

### Dialogue timestamps script

- raw run returns `artifacts.dialogueTimestampsData`
- reconciled run returns `artifacts.dialogueTimestampsDataReconciled`
- `primaryArtifactKey` should remain `dialogueTimestampsData`

### Music-vocals timestamps script

- raw run returns `artifacts.musicVocalsTimestampsData`
- reconciled run returns `artifacts.musicVocalsTimestampsDataReconciled`
- `primaryArtifactKey` should remain `musicVocalsTimestampsData`

That mirrors how `reconcile-famous-song-phase1.cjs` returns raw inputs plus reconciled outputs in the artifact bag, while still naming the artifact family coherently.

## Persisted load behavior

After `persisted-artifacts.cjs` is extended, callers should be able to request:

- `dialogueTimestampsData`
- `musicVocalsTimestampsData`

and still get canonical raw/reconciled behavior through the existing helper layer.

## Canonical downstream rule

Downstream consumers that want “the best current Phase 1 timed transcript surface” should request the timestamp artifact family with `runtimeArtifactSurface: 'canonical'`, exactly the same way existing callers request canonical baseline artifacts.

---

## Explicit implementation decisions from this design pass

1. **Use new sibling artifacts, not in-place mutation.**  
   The existing untimed text artifacts remain canonical for text-only Phase 1 output.

2. **Mirror the existing raw/reconciled surface model.**  
   Timestamp derivation must produce raw and reconciled variants as separate persisted outputs.

3. **Default to canonical source selection.**  
   Canonical means reconciled when famous-song reconciliation is configured and the artifact family supports it.

4. **Preserve source text verbatim in emitted outputs.**  
   Any normalization is internal-only and must not alter persisted text.

5. **Carry lane metadata through instead of reinterpreting it.**  
   Especially for music-vocals `recognizedSong` / `recognitionNotes`.

6. **Do not add a timed dialogue-v3 artifact in this slice.**  
   That is out of scope for the bounded timestamp-derivation lane.

7. **Treat music-vocals timing as more failure-tolerant but less certainty-claiming than dialogue.**  
   More `partial` / `unresolved` outcomes are acceptable if they are honestly marked.

---

## Files directly reviewed for this contract

- `server/lib/phase1-baseline-resolution.cjs`
- `server/lib/persisted-artifacts.cjs`
- `server/lib/script-contract.cjs`
- `server/lib/music-vocals-artifact.cjs`
- `server/lib/dialogue-v3-source-truth-emitter.cjs`
- `server/scripts/get-context/reconcile-famous-song-phase1.cjs`
- `server/scripts/get-context/get-dialogue.cjs`
- `server/scripts/get-context/get-music-vocals.cjs`

---

## Implementation-ready checklist

Before coding starts, the implementation should follow this contract:

- [ ] add new artifact keys/paths/runtime keys to `phase1-baseline-resolution.cjs`
- [ ] add new default locations to `persisted-artifacts.cjs`
- [ ] add new primary artifact locations to `script-contract.cjs`
- [ ] implement `get-dialogue-timestamps.cjs`
- [ ] implement `get-music-vocals-timestamps.cjs`
- [ ] ensure both scripts resolve raw/reconciled input through the existing helper layer
- [ ] ensure emitted text is verbatim from the selected source artifact
- [ ] ensure raw vs reconciled output path mirrors the actual source surface used
- [ ] ensure provenance and quality notes make the derivation boundary explicit
- [ ] ensure music-vocals never uses recognized-song metadata to rewrite text
