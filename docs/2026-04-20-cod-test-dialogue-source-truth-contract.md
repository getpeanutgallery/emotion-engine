# cod-test Phase 1 Dialogue Source-Truth Contract

**Date:** 2026-04-20  
**Status:** Locked for Task 1 / migration-ready  
**Applies to:** `benchmarks/fixtures/cod-test/truth/dialogue-data.json`

---

## Purpose

Define the exact clean-break contract for the active `cod-test` dialogue truth artifact under the **Phase 1 dialogue-traits** architecture.

This document intentionally separates:

- **human-reviewable gold source truth** owned by `dialogue-data.json`
- **non-gold deterministic projections** owned by sibling `speaker-grouping*.json` artifacts
- the separate **music-vocals** truth lane owned by `music-vocals-data.json`

This is the active contract for `cod-test`. The old `cod-test` dialogue shape is historical reference only.

---

## Current-state note

As of this document, the live `benchmarks/fixtures/cod-test/truth/dialogue-data.json` file is still the older speaker-oriented artifact shape and does **not** yet satisfy this contract.

That mismatch is intentional for the moment: Task 1 locks the contract first; Task `ee-b9sl` will migrate the file itself.

---

## Active ownership boundary

### `dialogue-data.json` owns

This file is the **human-reviewable gold truth** for spoken dialogue lines only.

It owns:

- spoken-dialogue line inclusion/exclusion
- line ordering via `index`
- literal line text via `text`
- closed per-line perceptual traits via `traits`
- top-level benchmark summary

### `dialogue-data.json` does not own

This file is **not** the owner of:

- timestamps
- speaker labels
- `speaker_id`
- `group_id`
- speaker profiles
- segment-to-group assignments
- grouping explanations / decision ledgers
- handoff prose or prompt guidance
- confidence scores
- free-text notes
- music-vocal lyric truth

### `speaker-grouping*.json` owns

These sibling artifacts are **derived deterministic comparator/projection outputs**, not gold source truth.

They own:

- `speaker_id`
- group creation and reuse
- runtime-aligned grouping projections
- alignment between runtime segmentation and source-truth lines
- grouping/explainability outputs used for comparison and audit

### `music-vocals-data.json` owns

This sibling artifact owns the **separate vocal/lyric lane**.

It owns:

- sung or chanted vocal segments
- performer labels / performer ids for music-vocals benchmarking
- song-recognition evidence and notes

Anything intentionally treated as lyrics or music-vocal content must stay out of `dialogue-data.json`.

---

## Exact required shape for active `dialogue-data.json`

```json
{
  "schema_version": 1,
  "contract": {
    "artifact": "dialogue-data",
    "mode": "traits",
    "traits_contract_version": "3.0.0"
  },
  "summary": "<required summary>",
  "dialogue_segments": [
    {
      "index": 0,
      "text": "<required spoken line>",
      "traits": {
        "audibility": "clear|partially_masked|heavily_masked|unknown",
        "overlap": "single_voice|background_overlap|competing_overlap|unknown",
        "gender_presentation": "feminine|masculine|androgynous|mixed|unknown",
        "age_impression": "child|teen|young_adult|adult|older_adult|elder|unknown",
        "pitch_band": "low|mid|high|variable|unknown",
        "phonation": "clear|breathy|whispered|raspy|nasal|thin|full|strained|mixed|unknown",
        "pace": "slow|measured|fast|variable|unknown",
        "energy": "calm|steady|intense|variable|unknown",
        "transmission_medium": "direct|phone|radio|pa_or_intercom|media_playback|processed_or_synthetic|unknown",
        "spatial_texture": "close|room|reverberant|distant|variable|unknown",
        "accent_strength": "none_apparent|subtle_non_neutral|clear_non_neutral|variable|unknown",
        "accent_family": "neutral_or_unmarked|anglophone_non_neutral|hispanic|slavic|germanic|romance|south_asian|east_asian|southeast_asian|african|middle_eastern|mixed|unknown",
        "affect": "calm|serious|angry|sad|fearful|tense|happy|amused|disgusted|surprised|determined|sensual|mixed|unknown",
        "interpersonal_stance": "neutral|directive|confrontational|supportive|pleading|taunting|seductive|performative|mixed|unknown",
        "delivery_overlay": "none_apparent|laughing|crying|mixed|unknown"
      }
    }
  ]
}
```

---

## Required top-level fields

- `schema_version`
- `contract`
- `summary`
- `dialogue_segments`

## Required `contract` fields

- `artifact: "dialogue-data"`
- `mode: "traits"`
- `traits_contract_version: "3.0.0"`

## Required per-segment fields

Each `dialogue_segments[*]` object must contain exactly:

- `index`
- `text`
- `traits`

## Required `traits` fields

The `traits` object is required and closed. It must contain exactly:

- `audibility`
- `overlap`
- `gender_presentation`
- `age_impression`
- `pitch_band`
- `phonation`
- `pace`
- `energy`
- `transmission_medium`
- `spatial_texture`
- `accent_strength`
- `accent_family`
- `affect`
- `interpersonal_stance`
- `delivery_overlay`

---

## Legacy fields removed from the active contract

The following fields are removed from active `dialogue-data.json` ownership and must not appear in the migrated source-truth file:

### Removed top-level fields

- `_benchmark` (comparator scaffolding, not source truth)
- `speaker_profiles`
- `speakerProfiles`
- `handoffContext`
- `cleanedTranscript`
- `totalDuration`
- any grouping object
- any runtime-alignment object
- any free-text benchmark guidance block

### Removed per-segment fields

- `start`
- `end`
- `speaker`
- `speaker_id`
- `speaker_group_id`
- `group_id`
- `confidence`
- `notes`
- `weights`

These fields either belong to runtime artifacts, deterministic grouping, temporary scaffolds, or legacy benchmark comparison surfaces.

---

## Gold vs non-gold status

### Gold, human-reviewable truth

Inside active `dialogue-data.json`, the following are gold and intended for direct human review:

- `summary`
- `dialogue_segments[*].index`
- `dialogue_segments[*].text`
- `dialogue_segments[*].traits.*`

### Non-gold / scaffold / derived

The following are not gold source truth for this benchmark lane:

- `speaker-grouping.json`
- `speaker-grouping.reconciled-runtime-aligned.json`
- any runtime segmentation alignment output
- any grouping key such as `speaker_group_key`
- `speaker_id` continuity assignments
- any comparator-only ignore-path scaffolding
- any old speaker-profile summaries

Important rule: a deterministic grouping output may be useful, stable, and reviewable, but it is **not** the primary gold source-truth contract.

---

## Relationship to sibling truth artifacts

| Artifact | Role | Gold status | Key boundary |
| --- | --- | --- | --- |
| `truth/dialogue-data.json` | Spoken dialogue source truth | Gold | Owns line text + closed line-local traits only |
| `truth/music-vocals-data.json` | Music-vocals / lyric truth | Gold for that lane | Owns sung/chanted vocal content, not dialogue speaker grouping |
| `truth/speaker-grouping.json` | Legacy/simple grouping output | Non-gold derived artifact | Owns deterministic grouping outputs, never source truth |
| `truth/speaker-grouping.reconciled-runtime-aligned.json` | Runtime-aligned grouping comparator | Non-gold derived artifact | Owns alignment/projection from source truth into runtime segmentation |

---

## Migration rules for Task `ee-b9sl`

Task `ee-b9sl` should treat this contract as normative and should:

1. keep only spoken dialogue lines in active `dialogue-data.json`
2. preserve the existing `music-vocals-data.json` split for lyrics/chants
3. remove legacy speaker-oriented ownership from `dialogue-data.json`
4. convert each active line into the closed traits envelope
5. preserve uncertainty honestly using contract sentinel values such as `unknown`, `mixed`, and `variable`
6. avoid smuggling grouping decisions back into source truth through labels, notes, or pseudo-ids
7. leave archived legacy `cod-test` material as historical reference only

---

## Benchmark policy for `cod-test`

For active `cod-test` Phase 1 dialogue benchmarking:

- `dialogue-data.json` is the authoritative source-truth input
- deterministic grouping starts after source truth and may derive `speaker_id`
- comparator artifacts may project source truth into runtime segmentation, but they must remain explicitly derived
- legacy speaker-labeled `cod-test` truth should never be treated as the active contract again unless intentionally reactivated by a later design decision

---

## References

- `docs/2026-04-15-dialogue-traits-maximalist-contract-vnext-v2.md`
- `docs/2026-04-15-dialogue-traits-pass-ownership-architecture-v2.md`
- `docs/2026-04-16-dialogue-traits-v3-speaker-grouping-heuristics-contract.md`
- `docs/2026-04-16-dialogue-traits-v3-speaker-grouping-heuristics-ruleset.yaml`
- `benchmarks/fixtures/cod-test/truth/music-vocals-data.json`
- `benchmarks/fixtures/cod-test/truth/speaker-grouping.reconciled-runtime-aligned.json`
- `benchmarks/fixtures/.archived/cod-test (legacy)/`
