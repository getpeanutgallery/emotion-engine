# Dialogue Traits v3 Deterministic Speaker-Grouping Heuristics Contract

**Date:** 2026-04-16  
**Status:** Review-ready design contract  
**Primary artifact:** `docs/2026-04-16-dialogue-traits-v3-speaker-grouping-heuristics-ruleset.yaml`

---

## Purpose

Lock the deterministic YAML heuristics contract that consumes the **v3 persisted dialogue traits source truth** and decides whether a line should:

- reuse an existing speaker group,
- create a new speaker group, or
- attach ambiguously while preserving explainability.

This is design work only. It does **not** implement runtime code.

---

## Locked source-truth boundary

The YAML contract is intentionally aligned to the 2026-04-15 v2 design package that locks the persisted source-truth envelope:

- top-level `summary` is required
- persisted `dialogue-data.json` does **not** own per-line `start` / `end`
- persisted `dialogue-data.json` does **not** own `handoffContext`
- persisted source truth does **not** own `speaker_id`, `group_id`, or grouping outputs
- `traits` remains **closed** and required
- deterministic grouping is the first owner of `speaker_id`
- the normative v3 trait fields are:
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

## Compatibility posture

The ruleset explicitly targets:

- `dialogue_schema_version: 1.x`
- `traits_contract_version: 3.x`
- `grouping_output_version: 3.x`

This is an intentional **major-version posture**. The ruleset is not meant to silently run against earlier stored-v2 field names.

### Supersession rule

The older stored-v2 names:

- `channel_texture`
- `delivery_stance`

are treated as **superseded history only**. They may appear in migration notes or adapters, but not as normative YAML fields for the v3 ruleset.

---

## Deterministic bucket map

The contract locks four deterministic buckets:

### 1. `stable_identity_cues`
Primary continuity evidence:

- `gender_presentation`
- `age_impression`
- `pitch_band`
- `phonation`
- `accent_strength`
- `accent_family`

### 2. `delivery_cues`
Secondary but still useful evidence:

- `pace`
- `energy`
- `affect`
- `interpersonal_stance`
- `delivery_overlay`

### 3. `production_context_cues`
Contextual evidence and mismatch guards:

- `transmission_medium`
- `spatial_texture`

### 4. `gating_cues`
Reliability only, not identity evidence:

- `audibility`
- `overlap`

---

## Core decision posture

### Positive evidence

- exact matches on stable identity cues carry the most weight
- delivery and production-context matches help, but are lower-authority
- recent reuse and repeated support provide only modest bonuses

### Negative evidence

- stable identity mismatches penalize most strongly
- delivery mismatches penalize lightly
- production-context mismatches penalize lightly-to-moderately
- degraded audibility/overlap reduce confidence and can suppress stronger conclusions

### Blockers

The ruleset stays intentionally conservative:

- hard blockers are allowed only for a small set of clean, well-supported identity conflicts
- blockers are suppressed when gating is degraded
- delivery-only and production-only contradictions are **not** allowed to hard-block by themselves
- `phonation` remains a strong scoring field, but its ambiguous field-local blocker table is intentionally removed
- the only remaining explicit phonation blocker posture is a global whispered-vs-nonwhispered **soft-review** guard under clean gating plus additional stable-identity mismatch support

### Ambiguity / abstention

- `unknown` means abstain, not guess
- `mixed` and `variable` remain unstable evidence, not hidden concrete matches
- when evidence is weak or the margin is too small, the grouping output should preserve ambiguity instead of pretending certainty

---

## Key threshold posture

The YAML currently locks this baseline behavior:

- `assign_threshold: 4.0`
- `reuse_threshold: 6.0`
- `ambiguity_margin: 1.0`
- `singleton_merge_threshold: 6.5`
- `split_review_threshold: 8.0`

These are review-ready defaults, not benchmark-final truths.

---

## Warning-level guardrails

The contract encodes cross-field checks as **warning-level**, not hard schema failures. Key examples:

- `accent_strength: none_apparent` should usually pair with `accent_family: neutral_or_unmarked`
- `delivery_overlay` must not be collapsed into `affect`
- `transmission_medium: direct` must not force `spatial_texture: close`
- `unknown` must never be treated as a hidden concrete label

This preserves the design-package posture that cross-field awkwardness should guide review/retry instead of creating brittle invalidation.

---

## Exact artifacts created

- `docs/2026-04-16-dialogue-traits-v3-speaker-grouping-heuristics-ruleset.yaml`
- `docs/2026-04-16-dialogue-traits-v3-speaker-grouping-heuristics-contract.md`

---

## Key contract decisions

1. **Speaker grouping is version-locked to the v3 traits envelope, not the older stored-v2 field names.**
2. **`speaker_id` remains a derived deterministic output, never source truth.**
3. **Stable identity cues dominate reuse decisions; delivery/context cues support but do not overrule them casually.**
4. **`phonation` stays heavily weighted for scoring, but the contract removes the ambiguous field-local phonation blocker table.**
5. **The only explicit phonation blocker posture is a conservative global whispered-vs-nonwhispered soft-review guard under clean gating with additional stable-identity mismatch support.**
6. **Hard blockers stay sparse and require clean gating plus concrete contradictions.**
7. **`unknown`, `mixed`, and `variable` remain first-class abstention/ambiguity states.**
8. **Cross-field semantic checks stay warning-level.**
9. **Automatic split behavior remains deferred; the current contract only locks split-review triggers, not auto-splitting.**

---

## References

- `docs/2026-04-15-dialogue-traits-maximalist-contract-vnext-v2.md`
- `docs/2026-04-15-dialogue-traits-pass-ownership-architecture-v2.md`
- `docs/2026-04-15-dialogue-traits-full-enum-audit-v2.md`
- `docs/2026-04-15-dialogue-traits-v2-calibration-artifact.md`
- `docs/2026-04-15-dialogue-traits-vnext-v2-package-audit.md`
- `docs/2026-04-14-traits-mode-json-yaml-artifact-shapes.md`
