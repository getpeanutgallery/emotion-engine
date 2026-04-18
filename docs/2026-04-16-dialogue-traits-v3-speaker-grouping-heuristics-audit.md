# Dialogue Traits v3 Speaker-Grouping Heuristics Audit

**Date:** 2026-04-16  
**Auditor:** Independent audit for bead `ee-j3kr`  
**Scope audited:**
- `docs/2026-04-16-dialogue-traits-v3-speaker-grouping-heuristics-ruleset.yaml`
- `docs/2026-04-16-dialogue-traits-v3-speaker-grouping-heuristics-contract.md`
- `.plans/2026-04-15-define-dialogue-traits-v2-speaker-grouping-heuristics-yaml-contract.md`

**Required references checked:**
- `docs/2026-04-15-dialogue-traits-maximalist-contract-vnext-v2.md`
- `docs/2026-04-15-dialogue-traits-pass-ownership-architecture-v2.md`
- `docs/2026-04-15-dialogue-traits-vnext-v2-package-audit.md`
- `docs/2026-04-14-traits-mode-json-yaml-artifact-shapes.md`

---

## 1. Verdict

**Verdict: Pass for contract direction and parser/ledger implementation, with one focused blocking clarification before scorer/blocker behavior is treated as fully locked.**

The package is broadly coherent with the latest locked persisted traits JSON shape and preserves the intended source-truth/grouping boundary. It correctly upgrades the contract to the v3 field family (`transmission_medium`, `spatial_texture`, `interpersonal_stance`, `delivery_overlay`), keeps abstention/ambiguity states honest, and does not smuggle in role/lore identity logic.

However, one ruleset detail remains too ambiguous for a fully confident runtime scorer lock:

- the `field_policies.phonation.blocker_when` value-pair table is internally inconsistent and reads partly like a typo list rather than a deliberate comparison policy.

That issue does **not** invalidate the overall package design, but it **does** mean the scorer should not treat phonation soft-blocker behavior as fully specified until that table is normalized or replaced with a clearer rule expression.

---

## 2. What passes audit cleanly

### A. Latest locked persisted JSON shape is preserved

The ruleset correctly encodes the v3 source-truth envelope:
- requires top-level `schema_version`, `contract`, `summary`, and `dialogue_segments`
- requires per-segment `index`, `text`, and `traits`
- requires the closed v3 traits object with:
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
- marks `closed_traits_object: true`

This matches the vNext v2 contract’s normative persisted shape and the package-audit posture that the v3 family is the locked source-truth target.

### B. Source-truth vs grouping ownership boundary is preserved

The package correctly keeps source truth and grouping output separated:
- source truth owns `summary`, `dialogue_segments.index`, `dialogue_segments.text`, and `dialogue_segments.traits`
- grouping owns group creation/reuse, ambiguity flags, `group_id`, `speaker_id`, `canonical_traits`, and the decision ledger
- source truth explicitly forbids timing, handoff, speaker ownership, grouping IDs, confidence, notes, and weights

This is coherent with both the architecture note and the older artifact-shape doc, while explicitly moving the contract forward from stored-v2.

### C. New normative v3 fields are used correctly

The ruleset and companion contract consistently use:
- `transmission_medium`
- `spatial_texture`
- `interpersonal_stance`
- `delivery_overlay`

Those fields are bucketed coherently:
- `transmission_medium` + `spatial_texture` -> `production_context_cues`
- `interpersonal_stance` + `delivery_overlay` -> `delivery_cues`

This is exactly the intended v3 supersession of stored-v2 `channel_texture` and `delivery_stance`.

### D. No regression to stored-v2 names except explicit supersession notes

The older names appear only in explicit supersession/history language, which is correct:
- `channel_texture`
- `delivery_stance`

The contract clearly states they are historical-only and non-normative for v3. That is the right way to acknowledge the stored-v2 baseline without regressing the active contract.

### E. Ambiguity and abstention posture is honest

The package preserves the intended sentinel semantics:
- `unknown` -> abstain, not guess
- `mixed` -> ambiguous, not a hidden concrete match
- `variable` -> unstable over-time evidence, not a stable concrete value
- `none_apparent` -> affirmative absence, not abstention

The ambiguity policy is also conservative and believable:
- ambiguity is allowed
- runner-up and score margin are preserved
- abstention reasons are first-class outputs
- degraded gating suppresses strong conclusions

This is faithful to the v2 package-audit recommendation to preserve honesty under weak evidence rather than force certainty.

### F. No role/lore/identity smuggling found

The ruleset explicitly forbids:
- `role_labels`
- `lore_labels`
- `biography_inference`
- `geography_prose`
- open-text traits

Nothing in the weighting/bucket/blocker sections appears to sneak narrative identity logic back in through the side door. Accent handling remains broad-family and guarded rather than biographical.

### G. Threshold / blocker / tie-break posture is mostly coherent and conservative

The overall posture is good:
- hard blockers are sparse
- delivery cues cannot hard-block by themselves
- production-context cues cannot hard-block by themselves
- degraded audibility/overlap suppresses stronger conclusions
- tie-breakers prioritize score, stable identity agreement, fewer stable mismatches, gating quality, recency, then creation order
- split behavior is explicitly deferred pending benchmark evidence

This is conservative in the right way for a first deterministic grouping contract.

---

## 3. Focused blocking gap

### Blocking gap: `phonation` soft-blocker comparison table is not implementation-safe as written

The main issue is here in the ruleset:

- `field_policies.phonation.blocker_when`

Current shape:
- `line_value_in: [breathy, full, nasal, raspy, strained, thin, whispered]`
- `group_value_in: [full, breathy, raspy, nasal, clear, clear, full]`
- plus `require_clean_gating: true`
- plus `require_additional_clean_identity_mismatch: true`
- action `soft_blocker_review`

Why this is a problem:
1. The list pairing is not self-describing. It is unclear whether values are meant to be zipped pairwise, treated as any-to-any sets, or interpreted some other way.
2. The apparent pairs are inconsistent and partly duplicated (`clear` and `full` appear multiple times).
3. The policy is not obviously symmetric or semantically justified from the surrounding docs.
4. The package already defines a clearer phonation-related blocker in `blocker_policy.whispered_vs_nonwhispered_guard`, which makes this table feel redundant and under-specified rather than authoritative.

Because of that, a runtime implementation could reasonably produce different blocker behavior from the same YAML text.

**Blocking conclusion:**
- the package is safe as a design baseline,
- but **full scorer/blocker lock should wait until phonation blocker semantics are normalized**.

Recommended fix direction:
- either replace this table with explicit named pair rules,
- or collapse it into the higher-level blocker policy style already used elsewhere,
- or remove it if the intended behavior is already fully covered by `stacked_identity_conflict` plus `whispered_vs_nonwhispered_guard`.

---

## 4. Non-blocking observations

### A. Threshold semantics are conservative, but one distinction should stay explicit in implementation notes

The package uses both:
- `assign_threshold: 4.0`
- `reuse_threshold: 6.0`

That is plausible and conservative, but the runtime implementation should keep the semantic distinction explicit:
- clearing `assign_threshold` does not necessarily mean confident reuse
- clearing `reuse_threshold` is the stronger condition for reuse posture

This is not a contract failure; it is just worth preserving clearly in code comments/tests.

### B. Historical supersession is explicit enough

The older 2026-04-14 stored-v2 artifact-shape doc is clearly superseded where needed. No additional correction is required for the audit goal.

---

## 5. Exact implementation seam that is safe now

**Safe to proceed now:**
- schema/compatibility validation for the v3 ruleset
- parser/loading of the YAML contract into typed runtime structures
- decision-ledger/explainability scaffolding using the locked reason vocabulary and ambiguity outputs
- source-truth boundary enforcement that rejects forbidden source fields and stored-v2 normative field regressions

**Not yet safe to treat as fully locked:**
- final phonation soft-blocker execution semantics in the runtime scorer

If the phonation blocker expression is clarified, the next seam becomes safe to extend into the full deterministic scorer/reuse engine.

---

## 6. Bottom line

This heuristics package is **architecturally coherent and directionally ready**. It matches the latest locked persisted traits JSON shape, preserves the design boundary between source truth and grouping, uses the new normative v3 fields correctly, and keeps abstention/ambiguity honest.

The only material blocker I found is a **localized phonation blocker-spec ambiguity**. Fix that, and the scorer/blocker implementation seam should be clear enough to proceed with confidence.
