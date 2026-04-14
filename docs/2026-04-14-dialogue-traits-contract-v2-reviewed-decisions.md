# Dialogue Traits Contract v2 Reviewed Decisions

**Date:** 2026-04-14  
**Status:** Durable review note  
**Purpose:** Compact source of truth for the reviewed stored-v2 dialogue traits decisions

---

## Stored artifact decisions

For persisted traits-mode `dialogue-data.json`:

- remove per-line `start`
- remove per-line `end`
- require top-level `summary`
- remove persisted `handoffContext`
- keep the line `traits` contract closed
- do not add role, lore, character, or scene-function labels
- keep deterministic grouping as the first owner of `speaker_id`

---

## Stored v2 per-line field list

The persisted stored-v2 `traits` object contains exactly:

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

---

## Closed enum additions locked by review

### `accent_family`

Allowed values:

- `neutral_or_unmarked`
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

### `affect`

Allowed values:

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

Meaning:

- `affect` = how the speaker seems to feel

### `delivery_stance`

Allowed values:

- `neutral`
- `directive`
- `confrontational`
- `supportive`
- `pleading`
- `sexual`
- `laughing`
- `performative`
- `mixed`
- `unknown`

Meaning:

- `delivery_stance` = how the line is directed or performed toward others

These meanings must stay distinct.

---

## Persisted envelope reminder

Stored v2 persisted `dialogue-data.json` requires:

- `schema_version`
- `contract.artifact = "dialogue-data"`
- `contract.mode = "traits"`
- `contract.traits_contract_version = "2.0.0"`
- `summary`
- `dialogue_segments`

Persisted stored v2 must not include:

- `handoffContext`
- `speaker`
- `speaker_id`
- `confidence`
- `speaker_profiles`
- `speakerProfiles`

---

## Audit focus

If an audit finds any of the following, the stored docs or implementation drifted from review:

- per-line `start` or `end` still shown in persisted examples
- top-level `summary` marked optional
- persisted `handoffContext` still present
- `accent_family`, `affect`, or `delivery_stance` missing from the stored trait list
- `happy` or `sensual` missing from `affect`
- `sexual` or `laughing` missing from `delivery_stance`
- role/lore labels allowed anywhere in source truth
