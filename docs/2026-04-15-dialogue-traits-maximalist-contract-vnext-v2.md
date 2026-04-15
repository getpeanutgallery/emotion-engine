# Dialogue Traits Maximalist Contract vNext v2

**Date:** 2026-04-15  
**Status:** Review-ready proposed persisted contract  
**Scope:** Revised fidelity-first successor to stored-v2 for persisted traits-mode `dialogue-data.json`, updated for Derrick’s speaker-recognition north star.

---

## Executive summary

This document revises the first vNext contract draft around a sharper design target:

> preserve the perceptual cues humans use to recognize the same speaker across unrelated performances, even when role, text, and context change.

The governing philosophy does **not** change:

- source truth remains line text + chronology + closed per-line traits
- no persisted speaker ownership in source truth
- no role/lore/biography labels
- no open-ended free text in `traits`
- deterministic grouping remains the first owner of `speaker_id`

The core structural decisions from the first vNext draft still stand:

1. `channel_texture` stays replaced by `transmission_medium` + `spatial_texture`
2. `delivery_stance` stays replaced by `interpersonal_stance` + `delivery_overlay`
3. `phonation` keeps `whispered`
4. `accent_family` keeps `anglophone_non_neutral`
5. sentinel semantics remain explicit and normative

The biggest north-star-driven revision is narrower but important:

- **`affect` expands** to better cover common human-recognizable emotional states, especially `disgusted`, `amused`, and `tense`

Just as important, this revision makes one explicit design restraint:

- **do not add a standalone `tone` field**

Human-recognizable “tone” is already better preserved by the combination of:

- `pitch_band`
- `phonation`
- `pace`
- `energy`
- `affect`
- `interpersonal_stance`
- `delivery_overlay`

A single `tone` field would collapse distinct perceptual dimensions back into a fuzzy junk drawer.

---

## What changed from the first vNext package

This v2 draft is a revision of `docs/2026-04-15-dialogue-traits-maximalist-contract-vnext.md`, not a brand-new philosophy.

### Kept from the first vNext package
- closed source-truth posture
- `3.x` major-version posture
- `channel_texture` split
- `delivery_stance` split
- `phonation: whispered`
- `accent_family: anglophone_non_neutral`
- explicit `unknown` / `mixed` / `variable` / `none_apparent` semantics

### Changed in this v2 draft
1. **`affect` is expanded** with:
   - `tense`
   - `amused`
   - `disgusted`

2. **Affect is reframed as a first-class speaker-recognition family, not a “good enough” side lane.**

3. **`interpersonal_stance`, `delivery_overlay`, `transmission_medium`, and accent fields get tighter boundary guidance** so the richer contract does not drift into fuzzy annotation.

4. **Cross-field semantic checks are explicitly warning-level / retry-level guidance, not hard schema failures.**

5. **This draft explicitly rejects a standalone `tone` field.**

---

## Design goals

The persisted contract should satisfy all of these at once:

1. **Persist only line-local source truth.**
2. **Preserve the cues humans use for cross-performance speaker recognition.**
3. **Stay closed and validator-friendly.**
4. **Improve fidelity only where the previous contract was genuinely too lossy.**
5. **Avoid taxonomy bloat and free-text escape hatches.**
6. **Remain clean input to deterministic grouping and later evaluation.**

---

## Version posture

### Recommended persisted contract version

```json
"traits_contract_version": "3.0.0"
```

### Why this stays `3.0.0`

The original vNext proposal already represented a major break from stored-v2. This document **revises that same proposed target** before implementation lock.

So the right review posture is:

- treat this document as the authoritative replacement for the earlier vNext draft
- keep the proposed persisted target at `3.0.0`
- do **not** mint `3.1.0` unless `3.0.0` first ships and then changes again

---

## Persisted envelope expectations

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
- any grouping-output field
- any free-text notes or guidance field

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
  "summary": "A tense exchange with amused taunts, disgust, and mixed direct/radio delivery.",
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

### Full field list
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
- gating field, not identity field
- keep stored-v2 meaning

---

## 2. `overlap`

**Meaning:** Whether other voices materially overlap the line.

**Allowed values:**
- `single_voice`
- `background_overlap`
- `competing_overlap`
- `unknown`

**Notes:**
- `background_overlap` = one dominant readable line remains
- `competing_overlap` = overlap materially contaminates recognition evidence

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
- `androgynous` = one stable presentation that does not read strongly feminine or masculine
- `mixed` = materially blended/conflicting cues, not simple uncertainty

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
- weaker cue than pitch, phonation, affect, or stance

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
- `variable` = one line audibly traverses multiple pitch regions

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
- `clear` means unmarked phonation, not audibility
- `whispered` is a first-class value
- obvious channel distortion belongs in `transmission_medium`, not here

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

**Meaning:** What kind of transmission or reproduction path the voice appears to travel through.

**Allowed values:**
- `direct`
- `phone`
- `radio`
- `pa_or_intercom`
- `media_playback`
- `processed_or_synthetic`
- `unknown`

**Notes:**
- `direct` = no obvious mediated path
- `phone` = phone / handset / telecom coloration
- `radio` = radio / comms coloration
- `pa_or_intercom` = PA / overhead / intercom speech
- `media_playback` = heard as playback from a device/speaker source
- `processed_or_synthetic` = obvious synthetic or non-radio/non-phone processing treatment

**Boundary guidance:**
- prefer `radio` / `phone` / `pa_or_intercom` over generic `processed_or_synthetic` when the medium is specifically recognizable
- prefer `media_playback` when the voice is being heard from a recording/device rather than live in-scene transmission

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
- `close` = dry or close-mic perspective
- `room` = present in a room without strong distance or echo emphasis
- `reverberant` = strong hall/echo/resonance impression
- `distant` = clearly far-away source perspective

---

## 11. `accent_strength`

**Meaning:** Whether a non-neutral accent impression is absent, subtle, clear, changing, or unsupported.

**Allowed values:**
- `none_apparent`
- `subtle_non_neutral`
- `clear_non_neutral`
- `variable`
- `unknown`

**Notes:**
- `none_apparent` is affirmative, not abstention
- prefer `unknown` over forced markedness
- `variable` = markedness audibly changes within the retained line

---

## 12. `accent_family`

**Meaning:** Broad accent-family impression, kept intentionally closed and non-biographical.

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
- broad-family impression only
- must never be back-interpreted as nationality, ethnicity, biography, or role
- prefer `unknown` when the line supports non-neutrality but not a trustworthy broad family call

---

## 13. `affect`

**Meaning:** Apparent internal feeling state or affective coloring.

**Allowed values:**
- `calm`
- `serious`
- `angry`
- `sad`
- `fearful`
- `tense`
- `happy`
- `amused`
- `disgusted`
- `surprised`
- `determined`
- `sensual`
- `mixed`
- `unknown`

**Notes:**
- `tense` covers tight, wound-up, or anxious delivery that does not cleanly reduce to `fearful`
- `amused` covers entertained/playful enjoyment and should not be flattened into `happy`
- `disgusted` covers revulsion/recoil/disdain that should not be flattened into `angry`
- `serious` remains intentionally allowed as a broad affective tone token

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
- `taunting` = baiting, needling, mocking, or enjoying provocation
- `confrontational` = openly hostile/challenging without the specific baiting quality
- `supportive` should cover reassuring/encouraging delivery without needing a second near-duplicate enum
- `performative` should be reserved for address-to-audience / staged / announcer-like delivery

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
- `none_apparent` is the normal affirmative default
- use only for clearly heard overlays, not inferred emotion
- `laughing` does not replace stance; a laughing line can still be `supportive`, `taunting`, `performative`, etc.

---

## Tone policy

The contract intentionally does **not** include a standalone `tone` field.

### Reason
In natural language, “tone” usually blends:

- voice quality
- pitch behavior
- intensity
- pacing
- emotion
- directed posture
- overlays like laughter/crying

Those are already modeled separately here. A single `tone` enum would erase distinctions the vNext contract is specifically trying to preserve.

### Normative interpretation
Reviewers and downstream systems should treat perceived “tone” as a **composite reading** over:

- `pitch_band`
- `phonation`
- `pace`
- `energy`
- `affect`
- `interpersonal_stance`
- `delivery_overlay`

---

## Sentinel policy

This section is normative.

### `unknown`
`unknown` means the line does **not** support a reliable judgment for that field.

Do not use `unknown` to mean:
- “probably X”
- “mixed”
- “variable over time”
- “I hesitate but will not abstain cleanly”

### `mixed`
`mixed` means multiple materially different values are simultaneously or inseparably present for a field that allows mixing.

Do not use `mixed` as generic uncertainty.

### `variable`
`variable` means one retained line audibly traverses multiple values over time.

Do not use `variable` for multi-speaker contamination.

### `none_apparent`
`none_apparent` is an affirmative observation, not abstention.

---

## Cross-field coherence rules

These are **warning/retry guidance**, not hard schema invalidators.

### Accent coherence
1. If `accent_strength = none_apparent`, `accent_family` should usually be `neutral_or_unmarked`.
2. If `accent_family = neutral_or_unmarked`, `accent_strength` should usually be `none_apparent` or `unknown`.
3. If `accent_strength = clear_non_neutral`, `accent_family` should usually not be `neutral_or_unmarked`.

### Overlay coherence
1. `delivery_overlay = laughing` or `crying` does not replace `interpersonal_stance`.
2. `delivery_overlay = none_apparent` means no overlay is heard, not that overlay was impossible to judge.

### Transmission coherence
1. `transmission_medium = direct` does not force `spatial_texture = close`.
2. obvious phone/radio/intercom cues should prefer the specific medium token over `processed_or_synthetic`.

### Sentinel coherence
1. use `unknown` instead of a fake concrete guess when evidence is weak
2. do not silently normalize `mixed` or `variable` into a stable concrete value

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

### Important distinction
Shape/enum violations are hard failures. Semantic awkwardness across fields should generally be handled as:

- warning
- retry hint
- human-review flag

not as brittle hard invalidation.

---

## Worked examples

## Example A — tense whispered line

```json
{
  "index": 3,
  "text": "Keep your voice down.",
  "traits": {
    "audibility": "clear",
    "overlap": "single_voice",
    "gender_presentation": "feminine",
    "age_impression": "adult",
    "pitch_band": "mid",
    "phonation": "whispered",
    "pace": "measured",
    "energy": "steady",
    "transmission_medium": "direct",
    "spatial_texture": "close",
    "accent_strength": "none_apparent",
    "accent_family": "neutral_or_unmarked",
    "affect": "tense",
    "interpersonal_stance": "directive",
    "delivery_overlay": "none_apparent"
  }
}
```

## Example B — amused taunt with laughter overlay

```json
{
  "index": 10,
  "text": "That your big plan?",
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
    "affect": "amused",
    "interpersonal_stance": "taunting",
    "delivery_overlay": "laughing"
  }
}
```

## Example C — disgusted confrontation

```json
{
  "index": 14,
  "text": "Don’t touch me.",
  "traits": {
    "audibility": "clear",
    "overlap": "single_voice",
    "gender_presentation": "androgynous",
    "age_impression": "young_adult",
    "pitch_band": "high",
    "phonation": "strained",
    "pace": "measured",
    "energy": "intense",
    "transmission_medium": "direct",
    "spatial_texture": "close",
    "accent_strength": "unknown",
    "accent_family": "unknown",
    "affect": "disgusted",
    "interpersonal_stance": "confrontational",
    "delivery_overlay": "none_apparent"
  }
}
```

## Example D — playback line

```json
{
  "index": 21,
  "text": "This message will repeat every thirty seconds.",
  "traits": {
    "audibility": "clear",
    "overlap": "single_voice",
    "gender_presentation": "masculine",
    "age_impression": "adult",
    "pitch_band": "mid",
    "phonation": "clear",
    "pace": "measured",
    "energy": "steady",
    "transmission_medium": "media_playback",
    "spatial_texture": "room",
    "accent_strength": "none_apparent",
    "accent_family": "neutral_or_unmarked",
    "affect": "serious",
    "interpersonal_stance": "performative",
    "delivery_overlay": "none_apparent"
  }
}
```

---

## Change log from stored-v2

### Fields kept conceptually stable
- `audibility`
- `overlap`
- `gender_presentation`
- `age_impression`
- `pitch_band`
- `pace`
- `energy`

### Fields revised in place
- `phonation`
  - adds `whispered`
  - removes stored-v2 `distorted`

- `accent_strength`
  - replaces stored-v2 `mixed` with `variable`
  - sharpens `none_apparent`

- `accent_family`
  - adds `anglophone_non_neutral`
  - stays broad and closed

- `affect`
  - expands beyond the first vNext draft with:
    - `tense`
    - `amused`
    - `disgusted`

### Fields removed and replaced
- `channel_texture`
  - replaced by `transmission_medium`
  - replaced by `spatial_texture`

- `delivery_stance`
  - replaced by `interpersonal_stance`
  - replaced by `delivery_overlay`

### Semantic rename
- stored-v2 `sexual` posture becomes vNext `seductive`

---

## Why this is the right maximalist boundary

This is maximalist in **fidelity**, not in ontology vanity.

It still refuses to turn source truth into:

- speaker biography
- geography prose
- role labels
- open emotional commentary
- free-text performance analysis
- benchmark notes

It only persists the closed perceptual cues that help preserve what a human would hear and remember.

That is exactly the right north-star boundary.

---

## Final recommendation

Approve this document as the review baseline for the vNext persisted dialogue traits contract.

The most important decisions are:

- keep the closed source-truth envelope
- keep the first vNext structural splits
- keep `traits_contract_version` targeted at `3.0.0`
- **expand `affect` with `tense`, `amused`, and `disgusted`**
- treat “tone” as a composite reading rather than adding a new field
- keep semantic coherence checks advisory rather than brittle hard-fail logic

If Derrick wants a contract that better preserves same-speaker recognizability across unrelated performances without drifting into lore or taxonomy bloat, this is the right v2 shape.