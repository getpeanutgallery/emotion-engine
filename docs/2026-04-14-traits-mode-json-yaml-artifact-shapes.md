# Traits-Mode JSON and YAML Artifact Shapes (Stored v2)

**Date:** 2026-04-14  
**Status:** Proposed design / stored v2 review record  
**Scope:** Persisted artifact ownership and example shapes for traits-mode dialogue and deterministic grouping

---

## Goal

Record the stored v2 artifact boundaries so implementation can proceed against a stable persisted contract.

This doc covers:

- persisted `dialogue-data.json` in traits mode
- deterministic grouping output artifacts
- YAML grouping ruleset boundaries
- source-of-truth vs derived-output ownership

---

## Stored v2 decisions locked by this doc

1. **Persisted `dialogue-data.json` no longer stores per-line `start` / `end`.**
2. **Persisted `dialogue-data.json` requires top-level `summary`.**
3. **Persisted `dialogue-data.json` does not store `handoffContext`.**
4. **The stored line-level trait contract is closed and includes `accent_family`, `affect`, and `delivery_stance`.**
5. **Role/lore labels remain forbidden in source truth and must not be reintroduced through YAML or derived artifacts.**
6. **Deterministic grouping still owns `speaker_id` and grouping outputs; the dialogue artifact still does not.**

---

## Ownership boundaries

## 1. Source-of-truth artifacts

### 1.1 `dialogue-data.json`

**Owner:** dialogue model + strict validator  
**Truth level:** source of truth for line text and line-local stored traits  
**Mutable by grouping engine:** no

This persisted artifact owns:

- segment ordering
- segment indexes
- line text
- required top-level summary
- closed per-line `traits`

It does **not** own:

- per-line `start` / `end`
- `handoffContext`
- speaker grouping decisions
- speaker continuity
- `speaker_id`
- `speaker_group_id`
- cross-line merges/splits
- weighted heuristics
- candidate ledgers
- role/lore metadata

### 1.2 YAML ruleset

**Owner:** deterministic grouping configuration  
**Truth level:** source of truth for grouping policy, thresholds, and versioned heuristic behavior  
**Mutable by dialogue model:** no

It owns:

- compatibility declarations
- canonical field bucket mapping
- hard blocker policy
- scoring weights
- decision thresholds
- tie-break order
- cleanup-pass policy

It does **not** own:

- line text
- open-ended semantic inference
- free-text role/lore interpretation
- any field not backed by the closed stored trait contract

---

## 2. Derived artifacts

### 2.1 `speaker-grouping.json`

**Owner:** deterministic grouping engine  
**Truth level:** primary derived truth for grouping decisions in traits mode

This is the main grouping output. It records:

- which ruleset ran
- which source artifact was consumed
- deterministic group membership
- per-segment assignment decisions
- group-level summaries derived from member traits

### 2.2 `dialogue-speakers.json`

**Owner:** deterministic grouping engine or downstream adapter  
**Truth level:** convenience projection only

This is a downstream-friendly view that combines source dialogue lines with deterministic assignments.

It is **not** source truth.

---

## Contract-safe field boundary

### Layer A — model/stored line vocabulary
Only the exact closed fields from the stored v2 line-traits contract:

- `audibility`
- `overlap`
- `gender_presentation`
- `age_impression`
- `pitch_band`
- `phonation`
- `pace`
- `energy`
- `channel_texture`
- `accent_strength`
- `accent_family`
- `affect`
- `delivery_stance`

### Layer B — deterministic bucket vocabulary
Used internally by the grouping engine and YAML ruleset. These are derived buckets, not model fields:

- `stable_identity_cues`
- `delivery_cues`
- `production_context_cues`
- `gating_cues`

### Layer C — grouping output vocabulary
Used only in derived grouping artifacts:

- `group_id`
- `speaker_id`
- `segment_indexes`
- `assignments`
- `canonical_traits`
- `decision`

Layer B and Layer C must never be written back into the source `traits` object.

---

## Normative deterministic bucket map

| Traits field | Derived bucket | Grouping role |
| --- | --- | --- |
| `gender_presentation` | `stable_identity_cues` | positive / negative evidence |
| `age_impression` | `stable_identity_cues` | positive / negative evidence |
| `pitch_band` | `stable_identity_cues` | positive / negative evidence |
| `phonation` | `stable_identity_cues` | positive / negative evidence |
| `accent_strength` | `stable_identity_cues` | positive / negative evidence |
| `accent_family` | `stable_identity_cues` | positive / negative evidence |
| `pace` | `delivery_cues` | soft evidence only |
| `energy` | `delivery_cues` | soft evidence only |
| `affect` | `delivery_cues` | soft evidence only; apparent feeling state |
| `delivery_stance` | `delivery_cues` | soft evidence only; outward directed/performed stance |
| `channel_texture` | `production_context_cues` | evidence and mismatch guard |
| `audibility` | `gating_cues` | gating / reliability input |
| `overlap` | `gating_cues` | gating / overlap guard |

### Stored-v2 interpretation notes

- `affect` is about how the speaker seems to feel.
- `delivery_stance` is about how the line is directed or performed toward others.
- These fields may correlate, but the grouping layer should not collapse them into one pseudo-field.
- No bucket may introduce role/lore labels as substitute identity features.

---

## `dialogue-data.json` in traits mode

## Required top-level shape

```json
{
  "schema_version": 1,
  "contract": {
    "artifact": "dialogue-data",
    "mode": "traits",
    "traits_contract_version": "2.0.0"
  },
  "summary": "A tense exchange about fear and control.",
  "dialogue_segments": [
    {
      "index": 0,
      "text": "They want you afraid. Fear makes you easier to control.",
      "traits": {
        "audibility": "clear",
        "overlap": "single_voice",
        "gender_presentation": "feminine",
        "age_impression": "adult",
        "pitch_band": "mid",
        "phonation": "clear",
        "pace": "measured",
        "energy": "steady",
        "channel_texture": "clean",
        "accent_strength": "none_apparent",
        "accent_family": "neutral_or_unmarked",
        "affect": "serious",
        "delivery_stance": "neutral"
      }
    }
  ]
}
```

## Source-of-truth notes

- `dialogue_segments[*].text` is source truth for line text.
- `dialogue_segments[*].traits` is source truth for line-local traits only.
- `schema_version`, `contract`, `contract.traits_contract_version`, and top-level `summary` are required persisted fields.
- persisted `handoffContext` is not part of the stored artifact contract.
- persisted per-line `start` / `end` are not part of the stored artifact contract.

## Forbidden in stored v2 traits mode

The following fields are not allowed anywhere in `dialogue_segments[*]`:

- `start`
- `end`
- `speaker`
- `speaker_id`
- `confidence`
- `speaker_group_id`
- `group_id`
- `notes`
- `weights`

The following top-level fields are forbidden in strict stored v2 traits mode:

- `handoffContext`
- `speaker_profiles`
- `speakerProfiles`

---

## Review-safe example with overlap

```json
{
  "schema_version": 1,
  "contract": {
    "artifact": "dialogue-data",
    "mode": "traits",
    "traits_contract_version": "2.0.0"
  },
  "summary": "A hostile overlapping exchange.",
  "dialogue_segments": [
    {
      "index": 17,
      "text": "You were never cut out to be a Mason.",
      "traits": {
        "audibility": "partially_masked",
        "overlap": "competing_overlap",
        "gender_presentation": "mixed",
        "age_impression": "unknown",
        "pitch_band": "variable",
        "phonation": "mixed",
        "pace": "measured",
        "energy": "steady",
        "channel_texture": "processed",
        "accent_strength": "unknown",
        "accent_family": "unknown",
        "affect": "angry",
        "delivery_stance": "confrontational"
      }
    }
  ]
}
```

---

## Deterministic grouping output artifacts

## 1. Primary derived artifact: `speaker-grouping.json`

### Required top-level shape

```json
{
  "schema_version": 1,
  "contract": {
    "artifact": "speaker-grouping",
    "mode": "traits-first-derived",
    "grouping_output_version": "2.0.0"
  },
  "input": {
    "path": "phase1-gather-context/dialogue-data.json",
    "dialogue_schema_version": 1,
    "traits_contract_version": "2.0.0",
    "segment_count": 20
  },
  "ruleset": {
    "id": "default",
    "version": "2.0.0",
    "schema_version": 1
  },
  "speaker_groups": [],
  "assignments": [],
  "summary": {
    "group_count": 0,
    "ambiguous_assignment_count": 0,
    "singleton_group_count": 0
  }
}
```

### Review-safe example

```json
{
  "schema_version": 1,
  "contract": {
    "artifact": "speaker-grouping",
    "mode": "traits-first-derived",
    "grouping_output_version": "2.0.0"
  },
  "input": {
    "path": "phase1-gather-context/dialogue-data.json",
    "dialogue_schema_version": 1,
    "traits_contract_version": "2.0.0",
    "segment_count": 2
  },
  "ruleset": {
    "id": "default",
    "version": "2.0.0",
    "schema_version": 1
  },
  "speaker_groups": [
    {
      "group_id": "grp_001",
      "speaker_id": "spk_001",
      "first_segment_index": 0,
      "last_segment_index": 0,
      "segment_indexes": [0],
      "canonical_traits": {
        "audibility": "clear",
        "overlap": "single_voice",
        "gender_presentation": "feminine",
        "age_impression": "adult",
        "pitch_band": "mid",
        "phonation": "clear",
        "pace": "measured",
        "energy": "steady",
        "channel_texture": "clean",
        "accent_strength": "none_apparent",
        "accent_family": "neutral_or_unmarked",
        "affect": "serious",
        "delivery_stance": "neutral"
      },
      "support": {
        "segment_count": 1,
        "ambiguous_member_count": 0
      }
    },
    {
      "group_id": "grp_002",
      "speaker_id": "spk_002",
      "first_segment_index": 1,
      "last_segment_index": 1,
      "segment_indexes": [1],
      "canonical_traits": {
        "audibility": "clear",
        "overlap": "single_voice",
        "gender_presentation": "masculine",
        "age_impression": "adult",
        "pitch_band": "low",
        "phonation": "raspy",
        "pace": "measured",
        "energy": "intense",
        "channel_texture": "clean",
        "accent_strength": "clear_non_neutral",
        "accent_family": "slavic",
        "affect": "happy",
        "delivery_stance": "laughing"
      },
      "support": {
        "segment_count": 1,
        "ambiguous_member_count": 0
      }
    }
  ],
  "assignments": [],
  "summary": {
    "group_count": 2,
    "ambiguous_assignment_count": 0,
    "singleton_group_count": 2
  }
}
```

## Contract-safety notes

- `canonical_traits` intentionally uses the same field names as the source contract.
- Derived artifacts must not invent role/lore or open-ended semantic profile labels.
- Derived artifacts may summarize source traits, but they must not mutate the source contract.

---

## 2. Convenience projection: `dialogue-speakers.json`

This is a downstream-friendly merge of source lines plus derived assignment.

```json
{
  "schema_version": 1,
  "contract": {
    "artifact": "dialogue-speakers",
    "mode": "derived-projection",
    "projection_version": "2.0.0"
  },
  "source": {
    "dialogue_path": "phase1-gather-context/dialogue-data.json",
    "grouping_path": "phase1-gather-context/speaker-grouping.json"
  },
  "summary": "A tense exchange about fear and control.",
  "dialogue_segments": [
    {
      "index": 0,
      "text": "They want you afraid. Fear makes you easier to control.",
      "traits": {
        "audibility": "clear",
        "overlap": "single_voice",
        "gender_presentation": "feminine",
        "age_impression": "adult",
        "pitch_band": "mid",
        "phonation": "clear",
        "pace": "measured",
        "energy": "steady",
        "channel_texture": "clean",
        "accent_strength": "none_apparent",
        "accent_family": "neutral_or_unmarked",
        "affect": "serious",
        "delivery_stance": "neutral"
      },
      "speaker_group_id": "grp_001",
      "speaker_id": "spk_001"
    }
  ]
}
```

Projection rule:

- `dialogue-data.json` wins for line text and traits.
- `speaker-grouping.json` wins for grouping assignments.

---

## Versioned YAML heuristics / rules

## Required schema shape

```yaml
schema_version: 1
ruleset:
  id: default
  version: 2.0.0
  description: Baseline deterministic grouping rules for stored-v2 traits-mode dialogue.
compatibility:
  traits_contract_version: 2.x
  dialogue_schema_version: 1.x
  grouping_output_version: 2.x
canonicalization:
  buckets:
    stable_identity_cues:
      - gender_presentation
      - age_impression
      - pitch_band
      - phonation
      - accent_strength
      - accent_family
    delivery_cues:
      - pace
      - energy
      - affect
      - delivery_stance
    production_context_cues:
      - channel_texture
    gating_cues:
      - audibility
      - overlap
hard_blockers: []
weights:
  positive: {}
  negative: {}
decision_policy:
  assign_threshold: 0
  reuse_threshold: 0
  ambiguity_margin: 0
  singleton_merge_threshold: 0
tie_breakers: []
cleanup_policy:
  enable_singleton_merge_pass: false
  enable_split_pass: false
```

## YAML ownership notes

The YAML ruleset may define:

- how contract fields are bucketed
- what counts as a hard blocker
- weights and thresholds
- tie-break order
- cleanup behavior

The YAML ruleset may **not** define or smuggle in:

- role labels
- lore labels
- character labels
- free-text accent geography
- any source field not present in the stored v2 closed contract

---

## Minimal review checklist

A future implementation should be rejected if any of the following happen:

- persisted `dialogue-data.json` still contains per-line `start` or `end`
- persisted `dialogue-data.json` omits top-level `summary`
- persisted `dialogue-data.json` still contains `handoffContext`
- source or derived artifacts reintroduce `speaker`, `speaker_id`, `confidence`, or `speaker_profiles` into source truth
- YAML rules reference non-contract source fields
- any layer writes role/lore labels into traits or canonical traits

---

## Final contract summary

### Source truth

- `dialogue-data.json`
  - owns line text, ordering, required `summary`, and closed stored-v2 `traits`

- grouping YAML ruleset
  - owns deterministic policy and compatibility metadata

### Derived truth

- `speaker-grouping.json`
  - owns group membership and `speaker_id` assignment

- `dialogue-speakers.json`
  - convenience projection only

### Stored v2 source trait fields

- `audibility`
- `overlap`
- `gender_presentation`
- `age_impression`
- `pitch_band`
- `phonation`
- `pace`
- `energy`
- `channel_texture`
- `accent_strength`
- `accent_family`
- `affect`
- `delivery_stance`

This is the stored v2 artifact split: **closed traits in source truth, deterministic grouping later, no persisted timing ownership, no persisted handoff payload, and no role/lore labels.**
