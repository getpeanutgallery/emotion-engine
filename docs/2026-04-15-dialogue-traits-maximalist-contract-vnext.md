# Dialogue Traits Maximalist Contract vNext

**Date:** 2026-04-15  
**Status:** Review-ready proposed persisted contract  
**Scope:** Proposed fidelity-first successor to stored-v2 for persisted traits-mode `dialogue-data.json`

---

## Executive summary

This document proposes a **maximalist but still closed** persisted dialogue traits contract for `dialogue-data.json`.

The governing philosophy does **not** change:

- source truth remains line text + chronology + closed per-line traits
- no persisted speaker ownership in source truth
- no role/lore/character labels
- no open-ended free text in `traits`
- deterministic grouping remains the first owner of `speaker_id`

What does change is the trait ontology.

The proposed vNext contract keeps most high-performing stored-v2 fields, but fixes the places where stored-v2 is structurally overloaded:

1. `phonation` gains `whispered` and stops using `distorted` as a catch-all.
2. `channel_texture` is replaced by `transmission_medium` and `spatial_texture`.
3. `delivery_stance` is replaced by `interpersonal_stance` and `delivery_overlay`.
4. `accent_family` gains `anglophone_non_neutral`.
5. sentinel semantics (`unknown`, `mixed`, `variable`, `none_apparent`) are made explicit and normative.

This is a **major contract revision**, not a patch. The recommended contract posture is therefore:

- keep `schema_version: 1`
- introduce `contract.traits_contract_version: "3.0.0"`

---

## Design goals

The vNext contract should satisfy all of these at once:

1. **Persist only line-local source truth.**
2. **Stay closed and validator-friendly.**
3. **Improve fidelity where stored-v2 is clearly collapsing distinct phenomena.**
4. **Avoid ontology sprawl where the added complexity is not worth it.**
5. **Remain compatible with downstream deterministic grouping and benchmarking.**
6. **Preserve anti-lore / anti-biography / anti-speaker-ownership boundaries.**

---

## Version posture

### Recommended contract version

```json
"traits_contract_version": "3.0.0"
```

### Why this should be a major bump

This proposal changes persisted contract behavior in ways that are not backwards-compatible with stored-v2:

- the required `traits` field list changes
- `channel_texture` is removed
- `delivery_stance` is removed
- two new replacement fields are introduced for each of those areas
- `phonation` allowed values change
- `accent_strength` semantics change
- `accent_family` allowed values change

That is major-version material.

---

## Persisted envelope expectations

The top-level persisted envelope should remain structurally narrow.

### Required top-level fields

- `schema_version`
- `contract`
- `summary`
- `dialogue_segments`

### Required `contract` fields

- `artifact: "dialogue-data"`
- `mode: "traits"`
- `traits_contract_version: "3.0.0"`

### Forbidden top-level fields in persisted source truth

- `handoffContext`
- `speaker_profiles`
- `speakerProfiles`
- any speaker grouping output field
- any free-text trait guidance or notes field

### Forbidden per-line fields in persisted source truth

- `start`
- `end`
- `speaker`
- `speaker_id`
- `speaker_group_id`
- `group_id`
- `confidence`
- `notes`
- `weights`

---

## Normative persisted shape

```json
{
  "schema_version": 1,
  "contract": {
    "artifact": "dialogue-data",
    "mode": "traits",
    "traits_contract_version": "3.0.0"
  },
  "summary": "A tense exchange involving commands, taunts, and radio/intercom speech.",
  "dialogue_segments": [
    {
      "index": 0,
      "text": "All personnel report to the lower deck immediately.",
      "traits": {
        "audibility": "clear",
        "overlap": "single_voice",
        "gender_presentation": "masculine",
        "age_impression": "adult",
        "pitch_band": "mid",
        "phonation": "clear",
        "pace": "measured",
        "energy": "steady",
        "transmission_medium": "pa_or_intercom",
        "spatial_texture": "reverberant",
        "accent_strength": "subtle_non_neutral",
        "accent_family": "anglophone_non_neutral",
        "affect": "serious",
        "interpersonal_stance": "directive",
        "delivery_overlay": "none_apparent"
      }
    }
  ]
}
```

---

## Exact per-line shape

Each `dialogue_segments[*]` entry must be an object with exactly these fields:

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `index` | integer | yes | Zero-based chronological line index. |
| `text` | string | yes | Literal captured dialogue text. Non-empty. |
| `traits` | object | yes | Closed required per-line traits object defined below. |

---

## `traits` object

`traits` is **required** and **closed**. It must contain every field listed below and no extras.

### Full vNext field list

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

## Allowed values and field definitions

## 1. `audibility`

**Meaning:** How intelligible the line is as heard.

**Allowed values:**
- `clear`
- `partially_masked`
- `heavily_masked`
- `unknown`

**Notes:**
- keep exactly the stored-v2 meaning
- reliability/gating field, not identity field

---

## 2. `overlap`

**Meaning:** Whether other voices materially overlap the line.

**Allowed values:**
- `single_voice`
- `background_overlap`
- `competing_overlap`
- `unknown`

**Notes:**
- `background_overlap` = one readable dominant line with non-dominant overlap
- `competing_overlap` = overlap materially contaminates identity/delivery evidence

---

## 3. `gender_presentation`

**Meaning:** Coarse vocal presentation impression only, not identity.

**Allowed values:**
- `feminine`
- `masculine`
- `androgynous`
- `mixed`
- `unknown`

**Notes:**
- `androgynous` = one stable presentation that does not read strongly masculine or feminine
- `mixed` = materially blended/conflicting presentation cues, not mere uncertainty

---

## 4. `age_impression`

**Meaning:** Coarse perceived age impression of the voice, not factual age.

**Allowed values:**
- `child`
- `teen`
- `young_adult`
- `adult`
- `older_adult`
- `elder`
- `unknown`

**Notes:**
- intentionally coarse
- should be treated as a weak cue downstream

---

## 5. `pitch_band`

**Meaning:** Coarse perceived pitch region.

**Allowed values:**
- `low`
- `mid`
- `high`
- `variable`
- `unknown`

**Notes:**
- `variable` = the line traverses bands or cannot honestly be reduced to one band

---

## 6. `phonation`

**Meaning:** Primary voice-quality / phonation impression.

**Allowed values:**
- `clear`
- `breathy`
- `whispered`
- `raspy`
- `nasal`
- `thin`
- `full`
- `strained`
- `mixed`
- `unknown`

**Notes:**
- `whispered` is a first-class addition in vNext
- `mixed` = materially blended voice textures are present
- obvious transmission distortion belongs in the channel/environment family, not here

---

## 7. `pace`

**Meaning:** How quickly the line is delivered.

**Allowed values:**
- `slow`
- `measured`
- `fast`
- `variable`
- `unknown`

---

## 8. `energy`

**Meaning:** Coarse delivery intensity.

**Allowed values:**
- `calm`
- `steady`
- `intense`
- `variable`
- `unknown`

---

## 9. `transmission_medium`

**Meaning:** What kind of transmission or reproduction path the voice appears to be traveling through.

**Allowed values:**
- `direct`
- `phone`
- `radio`
- `pa_or_intercom`
- `media_playback`
- `processed_or_synthetic`
- `unknown`

**Notes:**
- this replaces part of stored-v2 `channel_texture`
- `direct` = no obvious mediated transmission path is apparent
- `media_playback` = heard as playback from a device/screen/speaker source rather than direct speech or two-way comms
- `processed_or_synthetic` = obvious non-radio/non-phone signal treatment or synthetic treatment

---

## 10. `spatial_texture`

**Meaning:** How the line sits spatially/acoustically in the heard scene.

**Allowed values:**
- `close`
- `room`
- `reverberant`
- `distant`
- `variable`
- `unknown`

**Notes:**
- this replaces the rest of stored-v2 `channel_texture`
- `close` = dry or close-mic perspective
- `room` = present in a room without strong reverb or distance cues
- `reverberant` = strong echo/hall/resonance impression
- `distant` = clearly far-away source perspective

---

## 11. `accent_strength`

**Meaning:** Whether a non-neutral accent impression is absent, subtle, clear, varying, or unsupported.

**Allowed values:**
- `none_apparent`
- `subtle_non_neutral`
- `clear_non_neutral`
- `variable`
- `unknown`

**Notes:**
- vNext removes stored-v2 `mixed` from this field
- `none_apparent` is an affirmative read, not abstention
- `variable` = the retained line audibly shifts markedness over time

---

## 12. `accent_family`

**Meaning:** Broad accent-family impression, kept intentionally closed and coarse.

**Allowed values:**
- `neutral_or_unmarked`
- `anglophone_non_neutral`
- `hispanic`
- `slavic`
- `germanic`
- `romance`
- `south_asian`
- `east_asian`
- `southeast_asian`
- `african`
- `middle_eastern`
- `mixed`
- `unknown`

**Notes:**
- vNext adds `anglophone_non_neutral`
- this field is still broad by design
- it must never be back-interpreted as nationality, ethnicity, role, or lore

---

## 13. `affect`

**Meaning:** Apparent internal feeling state or affective read.

**Allowed values:**
- `calm`
- `serious`
- `angry`
- `sad`
- `fearful`
- `happy`
- `sensual`
- `surprised`
- `determined`
- `mixed`
- `unknown`

**Notes:**
- vNext intentionally keeps this set mostly unchanged
- `serious` remains allowed as a pragmatic broad affective tone token

---

## 14. `interpersonal_stance`

**Meaning:** How the line is outwardly directed or positioned toward others.

**Allowed values:**
- `neutral`
- `directive`
- `confrontational`
- `supportive`
- `pleading`
- `taunting`
- `seductive`
- `performative`
- `mixed`
- `unknown`

**Notes:**
- this replaces stored-v2 `delivery_stance`
- vNext adds `taunting`
- vNext uses `seductive` instead of stored-v2 `sexual` because the field is about delivery posture, not explicit content labeling
- `performative` should be reserved for overt address-to-audience / staged / announcer-like posture, not any expressive line

---

## 15. `delivery_overlay`

**Meaning:** Narrow overlay phenomena audible on top of the main stance.

**Allowed values:**
- `none_apparent`
- `laughing`
- `crying`
- `mixed`
- `unknown`

**Notes:**
- this splits out phenomena that did not fit cleanly inside stored-v2 `delivery_stance`
- `none_apparent` is the normal affirmative default

---

## Sentinel policy

This section is normative.

### `unknown`

`unknown` means the line does **not** support a reliable judgment for that field.

Do not use `unknown` to mean:

- “probably X”
- “mixed”
- “variable over time”
- “I am hesitant but will not abstain cleanly”

### `mixed`

`mixed` means **multiple materially different values are simultaneously or inseparably present** in the retained line for a field that allows mixing.

Do not use `mixed` as a synonym for uncertainty.

### `variable`

`variable` means **one retained line traverses multiple values over time**.

Do not use `variable` for multi-speaker contamination.

### `none_apparent`

`none_apparent` is an affirmative observation, not abstention.

---

## Cross-field consistency rules

These should be enforced or at least used for warning/retry behavior.

### Accent consistency

1. If `accent_strength = none_apparent`, then `accent_family` should normally be `neutral_or_unmarked`.
2. If `accent_family = neutral_or_unmarked`, then `accent_strength` should normally be `none_apparent` or `unknown`.
3. If `accent_strength = clear_non_neutral`, `accent_family` should not be `neutral_or_unmarked`.

### Overlay consistency

1. `delivery_overlay = none_apparent` means no overlay is heard, not that overlay was impossible to judge.
2. `delivery_overlay = laughing` does not replace stance; the stance field still must be populated.

### Channel consistency

1. `transmission_medium = direct` does **not** force `spatial_texture = close`; a line can be direct but `room`, `reverberant`, or `distant`.
2. obvious radio/phone/intercom cues should prefer `transmission_medium` over generic `processed_or_synthetic`.

### Sentinel consistency

1. use `unknown` rather than a fake concrete value when support is weak
2. do not silently collapse `mixed` or `variable` to a stable concrete token in normalized output

---

## Invalid-value policy

The following are immediate contract failures:

- missing `traits`
- any missing required trait key
- any extra key inside `traits`
- any trait value outside the allowed enum set for that field
- `null`, arrays, objects, or numbers used as trait values
- omitted top-level `summary`
- extra speaker/timing/handoff ownership fields in persisted source truth

Examples of invalid output:

```json
"accent_family": "midwestern"
```

Invalid because the contract remains closed.

```json
"interpersonal_stance": "laughing"
```

Invalid because laughter lives in `delivery_overlay`.

```json
"phonation": "distorted"
```

Invalid in vNext because channel/signal distortion is no longer a phonation token.

```json
"delivery_overlay": "none"
```

Invalid because the exact token is `none_apparent`.

---

## Worked examples

## Example A — direct clean line

```json
{
  "index": 3,
  "text": "They want you afraid.",
  "traits": {
    "audibility": "clear",
    "overlap": "single_voice",
    "gender_presentation": "feminine",
    "age_impression": "adult",
    "pitch_band": "mid",
    "phonation": "clear",
    "pace": "measured",
    "energy": "steady",
    "transmission_medium": "direct",
    "spatial_texture": "close",
    "accent_strength": "none_apparent",
    "accent_family": "neutral_or_unmarked",
    "affect": "serious",
    "interpersonal_stance": "neutral",
    "delivery_overlay": "none_apparent"
  }
}
```

## Example B — radio/intercom command

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
    "transmission_medium": "radio",
    "spatial_texture": "close",
    "accent_strength": "subtle_non_neutral",
    "accent_family": "anglophone_non_neutral",
    "affect": "serious",
    "interpersonal_stance": "directive",
    "delivery_overlay": "none_apparent"
  }
}
```

## Example C — taunting line with laughter overlay

```json
{
  "index": 16,
  "text": "So eager to leave daddy.",
  "traits": {
    "audibility": "clear",
    "overlap": "single_voice",
    "gender_presentation": "masculine",
    "age_impression": "adult",
    "pitch_band": "mid",
    "phonation": "raspy",
    "pace": "measured",
    "energy": "steady",
    "transmission_medium": "direct",
    "spatial_texture": "room",
    "accent_strength": "clear_non_neutral",
    "accent_family": "hispanic",
    "affect": "happy",
    "interpersonal_stance": "taunting",
    "delivery_overlay": "laughing"
  }
}
```

## Example D — masked overlap with clean abstention

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
    "transmission_medium": "processed_or_synthetic",
    "spatial_texture": "unknown",
    "accent_strength": "unknown",
    "accent_family": "unknown",
    "affect": "angry",
    "interpersonal_stance": "confrontational",
    "delivery_overlay": "none_apparent"
  }
}
```

---

## Change log from stored-v2

## Fields kept unchanged
- `audibility`
- `overlap`
- `gender_presentation`
- `age_impression`
- `pitch_band`
- `pace`
- `energy`
- `affect`

## Fields revised in place
- `phonation`
  - adds `whispered`
  - removes stored-v2 `distorted`

- `accent_strength`
  - replaces stored-v2 `mixed` with `variable`
  - clarifies `none_apparent` as affirmative, not abstention

- `accent_family`
  - adds `anglophone_non_neutral`
  - keeps broad closed family posture

## Fields removed and replaced
- `channel_texture`
  - replaced by `transmission_medium`
  - replaced by `spatial_texture`

- `delivery_stance`
  - replaced by `interpersonal_stance`
  - replaced by `delivery_overlay`

## Semantic rename
- stored-v2 `sexual` posture becomes vNext `seductive`

---

## Migration notes for reviewers

This is **not** an implementation plan, but the review package should still be clear about the expected migration seam.

### Stored-v2 to vNext interpretation sketch

- `channel_texture: clean` often maps to `transmission_medium: direct` plus either `spatial_texture: close` or `room`
- `channel_texture: radio` maps to `transmission_medium: radio`
- `channel_texture: phone` maps to `transmission_medium: phone`
- `channel_texture: reverberant` mainly maps to `spatial_texture: reverberant`
- `channel_texture: distant` mainly maps to `spatial_texture: distant`
- `channel_texture: processed` usually maps to `transmission_medium: processed_or_synthetic`
- `delivery_stance: laughing` maps to `delivery_overlay: laughing` plus a separate `interpersonal_stance`
- `delivery_stance: sexual` maps to `interpersonal_stance: seductive`

The important point is that vNext is not a synonym swap. It is a cleaner decomposition.

---

## Why this is the right maximalist boundary

This proposal is intentionally maximalist in **fidelity**, not in raw ontology size.

It does not try to turn source truth into:

- speaker biography
- geography prose
- role labels
- free-text performance analysis
- benchmark notes
- grouping heuristics

It only adds structure where stored-v2 is already visibly collapsing distinct phenomena.

That is the right kind of maximalism for this system.

---

## Final recommendation

Approve vNext as a **review target** with the following posture:

- major contract bump to `3.0.0`
- keep the persisted source-truth envelope narrow and closed
- adopt the field list defined here
- preserve deterministic grouping as first owner of speaker identity
- treat accent as deliberately broad and carefully bounded
- treat `channel_texture` and `delivery_stance` replacement as the most important structural improvements

If Derrick wants a fidelity-first contract that is still operationally sane, this is the best next shape.
