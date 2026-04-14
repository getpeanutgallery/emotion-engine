# Deterministic Speaker Grouping Architecture — v1 `traits`-Bound Revision

**Date:** 2026-04-14  
**Status:** Design repair / implementation-ready spec  
**Scope:** Deterministic grouping that consumes the closed v1 per-line `traits` contract and emits grouped speaker assignments  
**Supersedes in part:** `docs/2026-04-14-deterministic-speaker-grouping-architecture.md`

---

## Goal

Repair the deterministic grouping architecture so it is strictly grounded in the actual v1 closed `traits` contract defined in `docs/2026-04-14-dialogue-line-traits-contract.md`.

This revision does four things:

1. binds grouping inputs to the exact v1 `traits` fields and enum values
2. removes non-contract vocabulary from the normative design
3. defines the normative mapping from contract fields into deterministic grouping buckets
4. specifies how `unknown`, `mixed`, and `variable` behave during deterministic comparison

This is a design artifact only. It does **not** implement code.

---

## Normative source of truth

The grouping layer must treat the following as fixed upstream contract inputs:

- `docs/2026-04-14-dialogue-line-traits-contract.md`
- `docs/2026-04-14-dialogue-traits-validator-retry-contract.md`

For v1, the grouping layer may only consume these `traits` fields:

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

The grouping layer must **not** require, invent, or assume any additional upstream per-line fields.

---

## Explicit v1 exclusions

The following terms are **not** part of the v1 grouping contract and must not appear as required canonical inputs, YAML feature names, or worked-example fields for v1:

- `vocal_texture`
- `accent_family`
- `presentation`
- `intensity`
- `cadence`
- `phrasing`
- `role_mode`
- `scene_function`
- `role_context`
- geography labels such as `general_american`
- semantic labels such as `narration`, `taunt`, `announcer`, `briefing voice`
- open-ended coded labels such as `feminine-coded voice`, `older masculine-coded voice`

If a future design wants richer categories, it must expand the upstream `traits` contract first. v1 grouping must not smuggle that vocabulary in downstream.

---

## Ownership boundary

### Dialogue lane owns

- line chronology
- line text
- the closed per-line `traits` object
- strict schema validity for those traits

### Deterministic grouping owns

- converting validated v1 `traits` into deterministic comparison buckets
- scoring and blocker policy
- group creation and reuse decisions
- ambiguity handling
- stable `speaker_id` assignment as derived output
- debug and benchmark artifacts

### Important consequence

`speaker_id` is derived **after** validated `traits` exist. It is not an AI-authored line field in this architecture.

---

## Input contract to grouping

The grouping engine consumes validated dialogue lines shaped like:

```json
{
  "index": 10,
  "start": 51.0,
  "end": 52.0,
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
    "accent_strength": "subtle_non_neutral"
  }
}
```

The grouping engine must assume:

- all ten trait fields are present
- values are already validated against the closed v1 enum sets
- no legacy per-line `speaker`, `speaker_id`, or `confidence` fields are part of the grouping input contract

If those assumptions are violated, grouping should refuse to run.

---

## Normative field-to-bucket mapping

For v1, every trait field maps into exactly one deterministic comparison bucket.

### Bucket 1: `stable_identity_cues`

These are the v1 fields most appropriate for cross-line speaker continuity evidence.

| Trait field | Bucket role | Notes |
| --- | --- | --- |
| `gender_presentation` | stable identity cue | Coarse voice-presentation signal only; not identity metadata. |
| `age_impression` | stable identity cue | Coarse age impression; may help continuity. |
| `pitch_band` | stable identity cue | Useful when not `variable`/`unknown`. |
| `phonation` | stable identity cue | Voice texture/quality cue from the actual contract. |
| `accent_strength` | stable identity cue | Only strength/coarseness, not geography. |

### Bucket 2: `delivery_cues`

These may vary more from line to line, but remain valid deterministic evidence.

| Trait field | Bucket role | Notes |
| --- | --- | --- |
| `pace` | delivery cue | Helpful but less stable than identity cues. |
| `energy` | delivery cue | Helpful but expected to drift with line context. |

### Bucket 3: `production_context_cues`

These describe recording/presentation conditions rather than intrinsic voice identity. They may help or hurt grouping depending on ruleset weights.

| Trait field | Bucket role | Notes |
| --- | --- | --- |
| `channel_texture` | production context cue | Channel/filter context, not speaker identity. |

### Bucket 4: `gating_cues`

These are reliability and reuse guards. They influence how strongly a line should be compared, but they are not identity evidence by themselves.

| Trait field | Bucket role | Notes |
| --- | --- | --- |
| `audibility` | gating cue | Reliability/clarity cue; often better as reduced-weight or reuse-gating evidence. |
| `overlap` | gating cue | Overlap state affects comparison reliability and ambiguity handling. |

### Sentinel handling layer: `unknown`, `mixed`, `variable`

Sentinels are not a separate bucket family. They are deterministic handling rules applied across the bucketed fields above.

| Sentinel | Where allowed | Meaning for grouping |
| --- | --- | --- |
| `unknown` | multiple fields | abstention / unsupported evidence |
| `mixed` | `gender_presentation`, `phonation`, `accent_strength` | blended/conflicted evidence within the retained line |
| `variable` | `pitch_band`, `pace`, `energy` | within-line variation that resists reduction to one stable token |

---

## Normative comparison behavior by bucket

The grouping engine must treat bucket types differently.

### 1. `stable_identity_cues`

Default v1 behavior:

- can contribute positive evidence when two compared values match exactly
- can contribute negative evidence when two compared values are different, subject to sentinel rules below
- can participate in hard blockers only if the chosen ruleset explicitly declares the blocker and the blocker is defined only in terms of v1 contract fields

### 2. `delivery_cues`

Default v1 behavior:

- can contribute positive or negative evidence
- should normally carry lower authority than `stable_identity_cues`
- should not be the sole basis for a hard blocker in v1

### 3. `production_context_cues`

Default v1 behavior:

- can contribute positive or negative evidence
- should normally carry lower authority than `stable_identity_cues`
- should not cause the architecture to infer semantic roles or character types

### 4. `gating_cues`

Default v1 behavior:

- control whether a line is safe for strong reuse or should be treated cautiously
- may contribute small penalties or reduced-confidence signals
- should not be treated as identity evidence by themselves
- must remain visible in debug artifacts so benchmark tuning can distinguish low-reliability reuse from direct mismatched evidence

---

## Explicit handling of `unknown`, `mixed`, and `variable`

This section is normative for v1.

## `unknown`

`unknown` means the line does not provide usable evidence for that field.

Required behavior:

- treat `unknown` as **abstention**, not as a match and not as a contradiction
- `unknown` vs any concrete value must contribute no positive evidence by default
- `unknown` vs any concrete value should not trigger a hard blocker by default
- `unknown` should reduce explainability certainty because the engine is making a decision with missing evidence

Example:

- `pitch_band: unknown` on a line does **not** mean “maybe mid”; it means pitch evidence is unavailable for that line

## `mixed`

`mixed` means the retained line genuinely contains blended/conflicting evidence for a field where the contract allows it.

Required behavior:

- do not coerce `mixed` into any concrete value
- treat `mixed` as noisy evidence, not as a stable positive match token
- `mixed` may trigger caution penalties or ambiguity flags when compared to concrete group values
- `mixed` should not create a hard contradiction by itself unless a ruleset explicitly declares one using only contract-safe logic

Field-specific intent:

- `gender_presentation: mixed` means blended/conflicting presentation cues in the retained line
- `phonation: mixed` means multiple competing voice textures are present in the retained line
- `accent_strength: mixed` means mixed accent-strength evidence in the retained line; not geography blending

## `variable`

`variable` means the line traverses or varies strongly within the field dimension.

Required behavior:

- do not collapse `variable` to a concrete bucket such as `mid`, `measured`, or `steady`
- treat `variable` as unstable line-local evidence
- `variable` can justify reduced weight, ambiguity flags, or no contribution for that field
- `variable` should not be treated as an exact match token against any concrete group value

Field-specific intent:

- `pitch_band: variable` means the line traverses pitch bands or cannot honestly be reduced to one band
- `pace: variable` means line pacing varies materially within the line
- `energy: variable` means delivery intensity varies materially within the line

---

## Grouping reliability gates

Before comparing a line strongly against existing groups, v1 grouping should consider whether the line is even reliable enough for strong continuity evidence.

Recommended v1 interpretation:

- `audibility: heavily_masked` reduces confidence in all other cues from that line
- `overlap: competing_overlap` reduces confidence in all other cues from that line
- `overlap: background_overlap` is weaker degradation than `competing_overlap`
- `audibility: clear` plus `overlap: single_voice` is the cleanest input condition

This does **not** mean unreliable lines are discarded. It means the ruleset should be able to tune how much evidence they contribute.

---

## Deterministic flow

The v1 grouping architecture should use this flow:

1. validate presence and version compatibility of the v1 traits contract
2. transform each line’s validated `traits` into the four deterministic buckets defined above
3. process lines in ascending `index` order
4. compare each line against existing groups using only contract-safe bucket values
5. apply hard blockers first
6. apply weighted evidence scoring second
7. choose one deterministic action:
   - `create_group`
   - `assign_existing`
   - `assign_existing_ambiguous`
8. update the chosen group’s aggregate state
9. run an optional bounded cleanup pass
10. assign stable derived `speaker_id` values by first group appearance order
11. emit debug and benchmark artifacts

This remains a deterministic post-pass. No model inference happens here.

---

## Hard blocker policy for v1

The prior architecture draft was too loose here. v1 blocker policy must stay narrow and contract-safe.

### Allowed blocker inputs

Only these v1 contract fields may appear in blocker logic:

- `gender_presentation`
- `age_impression`
- `pitch_band`
- `phonation`
- `accent_strength`
- `pace`
- `energy`
- `channel_texture`
- `audibility`
- `overlap`

### Disallowed blocker inputs

Blockers must not depend on:

- semantic role labels
- geography labels
- inferred character identity
- inferred narrative function
- invented downstream feature names not backed by contract fields

### Recommended blocker conservatism

For v1, blockers should be sparse and explicit. Most comparisons should resolve through weighted evidence plus thresholding, not aggressive contradiction rules.

Reason: the contract is intentionally coarse. Over-blocking on coarse cues will create brittle false splits.

---

## Group aggregate state

A group’s state must remain grounded in v1 contract tokens.

Recommended per-group state:

- `group_id`
- `first_segment_index`
- `last_segment_index`
- `segment_indexes[]`
- per-field support histograms for each of the ten v1 fields
- current canonical group values chosen from accumulated support
- ambiguity markers
- decision-history summaries

### Canonical group values

Canonical group values must be stored using the original v1 field names, for example:

```json
{
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
    "accent_strength": "none_apparent"
  }
}
```

The architecture should not rename these to speculative synonyms.

---

## Explainability requirements

Every assignment decision must be explainable using v1 contract vocabulary.

At minimum, the decision ledger for each line should show:

- compared `segment_index`
- candidate groups considered
- blockers triggered, if any
- score contributions by original v1 trait field or by declared bucket name
- whether sentinel handling affected the comparison
- chosen action
- ambiguity flag
- short human-readable reason using contract-safe vocabulary

Example reason:

- “matched on `gender_presentation`, `pitch_band`, and `phonation`; `pace` was `variable`, so it did not contribute; `channel_texture` differed and applied a small penalty.”

Bad reason examples for v1:

- “same announcer voice”
- “same narration role”
- “same American accent family”

Those are not contract-safe.

---

## YAML heuristics contract for v1

A v1 YAML ruleset is still allowed, but it must reference only contract-safe fields and the four buckets defined in this revision.

## Allowed YAML references for v1

### Buckets

- `stable_identity_cues`
- `delivery_cues`
- `production_context_cues`
- `gating_cues`

### Raw fields

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

### Example contract-safe YAML sketch

```yaml
schema_version: 1
ruleset:
  id: default
  version: 1.0.0
compatibility:
  traits_contract: 1.x
bucket_map:
  stable_identity_cues:
    - gender_presentation
    - age_impression
    - pitch_band
    - phonation
    - accent_strength
  delivery_cues:
    - pace
    - energy
  production_context_cues:
    - channel_texture
  gating_cues:
    - audibility
    - overlap
sentinel_policy:
  unknown:
    default_relation: abstain
  mixed:
    default_relation: ambiguous
  variable:
    default_relation: unstable
weights:
  positive:
    stable_identity_cues.exact_match: 3.0
    delivery_cues.exact_match: 1.25
    production_context_cues.exact_match: 0.75
    gating_cues.reliable_reuse: 0.5
  negative:
    stable_identity_cues.mismatch: -2.5
    delivery_cues.mismatch: -1.0
    production_context_cues.mismatch: -0.75
    gating_cues.low_reliability_penalty: -0.5
thresholds:
  assign_existing: 3.5
  strong_reuse: 5.0
  ambiguity_margin: 1.0
```

This sketch is intentionally narrow. It avoids non-contract concepts.

---

## Benchmark-tunable requirements

The architecture must remain tunable without changing the upstream `traits` contract.

That means benchmark tuning may adjust:

- field weights
- bucket weights
- reliability penalties
- ambiguity thresholds
- cleanup thresholds
- blocker lists defined only with v1 fields

Benchmark tuning may **not** introduce:

- new upstream trait fields
- new enum tokens
- semantic role labels
- geography labels
- hidden normalization from `unknown` / `mixed` / `variable` to concrete values

---

## Worked v1-safe examples

### Example A: clean reuse

Line A:

```json
{
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
    "accent_strength": "subtle_non_neutral"
  }
}
```

Existing group canonical values match on:

- `gender_presentation`
- `age_impression`
- `pitch_band`
- `phonation`
- `channel_texture`
- `accent_strength`

Likely deterministic result:

- assign to existing group with strong evidence

### Example B: abstention-heavy line

```json
{
  "traits": {
    "audibility": "heavily_masked",
    "overlap": "competing_overlap",
    "gender_presentation": "unknown",
    "age_impression": "unknown",
    "pitch_band": "unknown",
    "phonation": "distorted",
    "pace": "unknown",
    "energy": "intense",
    "channel_texture": "processed",
    "accent_strength": "unknown"
  }
}
```

Likely deterministic result:

- weak comparison against all groups
- likely ambiguity or new-group creation depending on thresholds
- explainability log must show that most identity fields abstained via `unknown`

### Example C: mixed / variable handling

```json
{
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
    "accent_strength": "unknown"
  }
}
```

Likely deterministic result:

- `gender_presentation: mixed` does not count as an exact stable match
- `pitch_band: variable` does not count as a concrete stable match
- `phonation: mixed` remains ambiguous evidence, not a concrete texture token
- the line remains usable, but with degraded continuity strength

---

## Output contract

The grouping output may introduce derived speaker grouping structures, but it must preserve the source-contract language in its explainability and canonical group summaries. Derived outputs should use one flat `canonical_traits` object keyed by the original v1 field names rather than a renamed pseudo-schema.

Recommended output fields:

```json
{
  "schema_version": 1,
  "contract": {
    "artifact": "speaker-grouping",
    "mode": "traits-first-derived",
    "grouping_output_version": "1.0.0"
  },
  "input": {
    "dialogue_schema_version": 1,
    "traits_contract_version": "1.0.0"
  },
  "ruleset": {
    "id": "default",
    "version": "1.0.0"
  },
  "speaker_groups": [
    {
      "group_id": "grp_001",
      "speaker_id": "spk_001",
      "segment_indexes": [0, 1, 4, 5],
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
        "accent_strength": "none_apparent"
      }
    }
  ],
  "assignments": [
    {
      "segment_index": 0,
      "group_id": "grp_001",
      "speaker_id": "spk_001",
      "decision": {
        "action": "create_group",
        "ambiguous": false,
        "reason": "first valid line created initial group"
      }
    }
  ]
}
```

Derived outputs may be richer than this, but must remain grounded in the v1 contract.

---

## Migration-safe conclusions for v1

This revision makes the following architectural decisions explicit:

1. v1 grouping is bound to the exact ten-field closed `traits` contract.
2. Non-contract vocabulary is deferred, not implied.
3. `role_context` is out of scope for v1.
4. `unknown`, `mixed`, and `variable` are first-class deterministic cases with explicit semantics.
5. Coarse `production_context_cues` and `gating_cues` may influence grouping, but do not authorize semantic inference.
6. Benchmark tuning happens through weights, thresholds, and contract-safe blockers — not through invented feature vocabularies.

---

## Final recommendation

Implementation should use this revision as the normative grouping architecture for v1.

If future work needs richer cues such as geography, role, or finer phonation subtypes, the correct order is:

1. revise the upstream `traits` contract
2. revise the validator contract
3. then revise grouping buckets and YAML rulesets

Not the other way around.
