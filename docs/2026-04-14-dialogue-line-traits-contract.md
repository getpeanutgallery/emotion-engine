# Dialogue Line `traits` Contract (Stored v2)

**Date:** 2026-04-14  
**Status:** Proposed design / stored v2 review record  
**Scope:** Persisted traits-mode `dialogue-data.json` line entries

---

## Goal

Define the **closed stored v2 `traits` contract** for each persisted dialogue line in `dialogue-data.json`.

This contract keeps Phase 1 dialogue output narrow:

- line order
- line text
- one closed per-line `traits` object
- required top-level summary

It does **not** let the stored dialogue artifact own speaker identity, role/lore labeling, or dialogue-owned timing.

---

## Stored v2 decisions captured here

This stored v2 revision locks the following review decisions:

1. **Per-line `start` / `end` are removed from the persisted dialogue contract.**
2. **Top-level `summary` is required in persisted `dialogue-data.json`.**
3. **Persisted `handoffContext` is removed from the stored artifact contract.**
4. **`traits` remains a strict closed object.**
5. **`accent_family` is added as a closed field.**
6. **`affect` and `delivery_stance` are added as closed fields.**
7. **Role, lore, character, or scene-function labels remain explicitly forbidden.**

---

## Contract summary

Each `dialogue_segments[*]` entry must use this stored shape:

```json
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
```

### Explicit removals from the persisted line contract

The persisted dialogue artifact must **not** contain these per-line fields:

- `start`
- `end`
- `speaker`
- `speaker_id`
- `confidence`

---

## Required top-level envelope for persisted `dialogue-data.json`

Required top-level fields for persisted traits-mode `dialogue-data.json`:

- `schema_version`
- `contract`
- `summary`
- `dialogue_segments`

Required `contract` fields:

- `artifact: "dialogue-data"`
- `mode: "traits"`
- `traits_contract_version`

Persisted top-level fields that are **not allowed** in the stored contract:

- `handoffContext`
- `speaker_profiles`
- `speakerProfiles`

Example persisted envelope:

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

---

## Exact line shape

Each `dialogue_segments[*]` entry must be an object with these fields:

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `index` | integer | yes | Zero-based chronological line index. |
| `text` | string | yes | Literal captured dialogue text. Non-empty. |
| `traits` | object | yes | Closed per-line traits object defined below. |

### `traits` object

`traits` is required and closed. It must contain **all** fields listed below.

| Field | Type | Allowed values |
| --- | --- | --- |
| `audibility` | string | `clear`, `partially_masked`, `heavily_masked`, `unknown` |
| `overlap` | string | `single_voice`, `background_overlap`, `competing_overlap`, `unknown` |
| `gender_presentation` | string | `feminine`, `masculine`, `androgynous`, `mixed`, `unknown` |
| `age_impression` | string | `child`, `teen`, `young_adult`, `adult`, `older_adult`, `elder`, `unknown` |
| `pitch_band` | string | `low`, `mid`, `high`, `variable`, `unknown` |
| `phonation` | string | `clear`, `breathy`, `raspy`, `nasal`, `thin`, `full`, `strained`, `distorted`, `mixed`, `unknown` |
| `pace` | string | `slow`, `measured`, `fast`, `variable`, `unknown` |
| `energy` | string | `calm`, `steady`, `intense`, `variable`, `unknown` |
| `channel_texture` | string | `clean`, `reverberant`, `radio`, `phone`, `distant`, `processed`, `unknown` |
| `accent_strength` | string | `none_apparent`, `subtle_non_neutral`, `clear_non_neutral`, `mixed`, `unknown` |
| `accent_family` | string | `neutral_or_unmarked`, `hispanic`, `slavic`, `germanic`, `romance`, `south_asian`, `east_asian`, `southeast_asian`, `african`, `middle_eastern`, `mixed`, `unknown` |
| `affect` | string | `calm`, `serious`, `angry`, `sad`, `fearful`, `happy`, `sensual`, `surprised`, `determined`, `mixed`, `unknown` |
| `delivery_stance` | string | `neutral`, `directive`, `confrontational`, `supportive`, `pleading`, `sexual`, `laughing`, `performative`, `mixed`, `unknown` |

---

## Field definitions

### `audibility`
How intelligible the line is as heard.

### `overlap`
Whether other voices materially overlap the line.

### `gender_presentation`
Coarse voice-presentation impression only. This is not identity, biography, or role.

### `age_impression`
Coarse perceived age impression of the audible voice, not factual age.

### `pitch_band`
Coarse perceived pitch region.

### `phonation`
Primary vocal texture / phonation quality.

### `pace`
How quickly the line is delivered.

### `energy`
Coarse delivery intensity.

### `channel_texture`
How the recording or transmission channel sounds, separate from the speaker's intrinsic voice.

### `accent_strength`
Whether a non-neutral accent or dialect impression is absent, present subtly, or present clearly.

### `accent_family`
A closed broad-family accent impression field. This remains structural and non-biographical. It must not turn into open-ended geography, ethnicity, nationality, role, or lore labeling.

### `affect`
How the speaker seems to feel.

This field is about **apparent internal feeling state**, not what the line is trying to do to another person.

### `delivery_stance`
How the line is directed or performed toward others.

This field is about **outward delivery orientation**, not the speaker's inner emotional state.

### `affect` vs `delivery_stance`
Preserve this distinction:

- `affect` = how the speaker seems to feel
- `delivery_stance` = how the line is directed or performed toward others

These fields may correlate, but they are not interchangeable.

---

## Contract rules

### 1) Closed vocabulary only
Only the fields and values listed in this document are allowed.

The model/output must not invent:

- new trait keys
- new enum values
- synonyms
- free-text labels
- free-text notes
- confidence values
- role labels
- lore labels
- character labels

### 2) All trait fields are required
`traits` must always include every field in this spec.

### 3) No omission-based abstention
Invalid abstention patterns include:

- omitting `traits`
- omitting a required trait field
- using `null`
- using an empty string
- using free text such as `hard to tell`

### 4) No arrays inside `traits`
Every trait value is a single string enum token.

### 5) No role/lore semantics
The model/output must not use `traits` to claim:

- character identity
- role labels such as `villain`, `soldier`, `announcer`, `mentor`
- scene function
- franchise labels
- lore labels
- backstory claims

---

## Invalid-value policy

Immediate contract failures include:

- missing `traits`
- any required trait key missing
- any extra key inside `traits`
- any trait value outside its allowed enum set
- any non-string trait value
- any array/object/null used for a trait value
- persisted line objects containing removed fields: `start`, `end`, `speaker`, `speaker_id`, or `confidence`
- persisted top-level `handoffContext`

Examples:

```json
"gender_presentation": "female"
```

Invalid because the allowed token is `feminine`.

```json
"accent_family": "midwestern"
```

Invalid because `accent_family` is closed and does not allow open geography text.

```json
"role": "announcer"
```

Invalid because role/lore labels are forbidden.

---

## Worked examples

### Example line

```json
{
  "index": 10,
  "text": "Specter one, report.",
  "traits": {
    "audibility": "clear",
    "overlap": "single_voice",
    "gender_presentation": "masculine",
    "age_impression": "young_adult",
    "pitch_band": "mid",
    "phonation": "clear",
    "pace": "measured",
    "energy": "steady",
    "channel_texture": "radio",
    "accent_strength": "subtle_non_neutral",
    "accent_family": "germanic",
    "affect": "serious",
    "delivery_stance": "directive"
  }
}
```

### Example with overlap and uncertainty

```json
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
```

---

## Final stored v2 field list

The persisted per-line stored v2 field list is:

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

This gives the later deterministic grouping lane a closed stored surface without adding role/lore labels or persisted speaker ownership.
