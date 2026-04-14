# Dialogue Traits-Mode Migration Seam (Stored v2)

**Date:** 2026-04-14  
**Status:** Proposed design / stored v2 migration record  
**Scope:** Migration boundary from speaker-owned dialogue output to stored v2 traits-mode dialogue output

---

## Goal

Define the exact seam where Phase 1 dialogue generation stops owning speaker identity and persists only the stored v2 traits-mode dialogue artifact.

This doc is about migration boundaries, not runtime implementation. It records what the stored artifact must look like after Derrick's reviewed v2 decisions.

---

## Executive summary

The stored v2 dialogue artifact now has these durable boundaries:

1. **Dialogue generation owns only line capture plus a closed per-line `traits` object.**
2. **Persisted dialogue lines no longer store `start` / `end`.**
3. **Persisted `dialogue-data.json` now requires top-level `summary`.**
4. **Persisted `handoffContext` is removed from the stored artifact.**
5. **The stored trait set now includes `accent_family`, `affect`, and `delivery_stance`.**
6. **The dialogue artifact still does not own `speaker_id`, speaker grouping, role labels, or lore labels.**
7. **Deterministic grouping remains the first owner of `speaker_id`.**

If implementation ignores this seam, the likely failure is still a false pivot where dialogue output appears traits-first on paper but still quietly preserves speaker-owned or prompt-only legacy structure.

---

## Target persisted artifact boundary

## Legacy mode

Current legacy dialogue output effectively centers speaker-owned fields such as:

- per-line `speaker`
- per-line `speaker_id`
- per-line `confidence`
- top-level `speaker_profiles`
- optional `handoffContext`
- optional summary/analysis metadata

## Stored v2 traits mode

Persisted traits-mode `dialogue-data.json` must now become:

- top-level `schema_version`
- top-level `contract.artifact = "dialogue-data"`
- top-level `contract.mode = "traits"`
- top-level `contract.traits_contract_version = "2.0.0"`
- top-level `summary` (required)
- `dialogue_segments[*].index`
- `dialogue_segments[*].text`
- `dialogue_segments[*].traits`

Persisted traits-mode `dialogue-data.json` must **not** contain:

- `dialogue_segments[*].start`
- `dialogue_segments[*].end`
- `speaker`
- `speaker_id`
- `confidence`
- `speaker_profiles`
- `speakerProfiles`
- persisted `handoffContext`
- role/lore labels
- inferred speaker-profile prose

---

## Normative ownership boundaries during rollout

## Dialogue model owns

Only:

- line segmentation
- literal line text capture
- closed per-line `traits`
- top-level dialogue `summary`

The dialogue model does **not** own:

- persisted timing fields
- persisted handoff payload
- speaker identity
- same-speaker grouping across lines
- speaker continuity across chunks
- `speaker_id`
- speaker profile objects
- weighting of traits for grouping
- role labels / character labels / lore labels

## Traits validator owns

Only:

- parse validation
- schema validation against the stored v2 line-traits contract
- semantic validation for contract-safe contradictions
- bounded retry payload generation
- durable validation failure capture

The traits validator does **not** own:

- speaker normalization
- backfilling missing speaker fields
- generating synthetic IDs
- merging lines by same-speaker logic
- grouping lines into speakers
- reintroducing removed persisted fields

## Dialogue chunk stitch / aggregation owns

Only:

- concatenating chunk-local line arrays into one chronological dialogue artifact
- preserving chronology
- ensuring the persisted final artifact matches the stored v2 shape

The chunk stitch path in stored v2 does **not** own:

- speaker repair
- speaker-aware adjacent merge
- speaker registry propagation
- persisted handoff payload
- persisted timing ownership

## Deterministic grouping layer owns

First ownership of:

- same-speaker grouping decisions
- grouping debug evidence
- group IDs / `speaker_id`
- speaker-facing derived artifacts

---

## Prompt contract changes implied by stored v2

## Whole-asset dialogue prompt

The whole-asset prompt must no longer ask for:

- `speaker`
- `speaker_id`
- `confidence`
- `speaker_profiles`
- role labels
- lore labels

It must target the stored v2 traits contract instead.

### Stored-v2 conceptual prompt envelope

```json
{
  "schema_version": 1,
  "contract": {
    "artifact": "dialogue-data",
    "mode": "traits",
    "traits_contract_version": "2.0.0"
  },
  "summary": "brief summary of the dialogue content",
  "dialogue_segments": [
    {
      "index": 0,
      "text": "example line",
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

## Chunk handoff implication

Chunk-local handoff may still exist as an internal prompting aid during runtime, but it is no longer part of the stored persisted dialogue artifact.

That means the migration seam must distinguish between:

- **transient runtime handoff** if the implementation still needs one
- **persisted dialogue-data contract**, which now excludes `handoffContext`

The stored contract is the durable rule.

---

## Validator contract changes

Traits-mode validation must now:

1. validate top-level `schema_version`, `contract`, `contract.traits_contract_version`, and required `summary`
2. validate `dialogue_segments[*]` against the stored v2 line-traits contract
3. reject deprecated legacy line fields:
   - `start`
   - `end`
   - `speaker`
   - `speaker_id`
   - `confidence`
4. reject deprecated top-level fields in strict stored v2 mode:
   - `handoffContext`
   - `speaker_profiles`
   - `speakerProfiles`
5. validate that `traits` is present and closed
6. validate the new closed fields:
   - `accent_family`
   - `affect`
   - `delivery_stance`
7. reject role/lore labels if they are smuggled in as trait fields or values
8. return normalized value without speaker normalization

During rollout there must still be explicit separation between:

- legacy speaker-mode dialogue validation
- stored-v2 traits-mode dialogue validation

Traits mode must not call speaker normalization as a convenience shim.

---

## Legacy seams that must be bypassed or removed in stored v2 traits mode

1. **Speaker normalization seam**  
   Traits mode must bypass it completely.

2. **Boundary speaker repair seam**  
   Traits mode must not mutate dialogue ownership based on speaker continuity.

3. **Adjacent merge seam based on same-speaker logic**  
   Traits mode must not depend on `speaker` or `speaker_id`.

4. **Speaker-profile accumulation seam**  
   Remove from the traits-mode path.

5. **Structured speaker handoff seam**  
   If runtime handoff still exists, it must remain transient and must not become persisted `handoffContext`.

6. **Prompt examples and final artifact rules seam**  
   Rewrite to match stored v2.

7. **Final chunked normalization seam**  
   Traits mode must validate only the stored v2 final artifact and must not synthesize speaker structure.

8. **Downstream consumer seam**  
   Readers must stop assuming `dialogue-data.json` exposes persisted speaker fields or handoff payloads.

---

## Benchmark and comparator migration notes

After this stored v2 pivot:

- `dialogue-data.json` benchmark truth should score only:
  - line array structure
  - line text
  - closed per-line `traits`
  - required top-level `summary`

- `dialogue-data.json` benchmark truth should no longer score:
  - per-line timing ownership
  - speaker identity ownership
  - persisted `handoffContext`
  - `speaker_profiles`

- deterministic grouping artifacts should be benchmarked separately for:
  - group membership
  - emitted `speaker_id`
  - derived speaker summaries

---

## Acceptance criteria for implementation handoff

This migration seam is ready to hand off only if implementation can guarantee all of the following:

- persisted traits-mode prompts no longer mention `speaker_id` ownership
- persisted traits-mode validator requires top-level `summary`
- persisted traits-mode validator rejects per-line `start` and `end`
- persisted traits-mode validator rejects persisted `handoffContext`
- persisted traits-mode validator accepts only the closed stored v2 field list
- stored traits docs preserve the distinction between `affect` and `delivery_stance`
- no layer reintroduces role/lore labels into source truth
- no speaker-based repair/merge helpers run in traits mode
- deterministic grouping remains the first owner of `speaker_id`

---

## Final stored v2 summary

The durable stored v2 persisted dialogue artifact is:

- lines with `index`
- line `text`
- one closed `traits` object per line
- required top-level `summary`
- no persisted line timing
- no persisted `handoffContext`
- no speaker identity ownership
- no role/lore labels

That is the migration seam the audit should enforce.
