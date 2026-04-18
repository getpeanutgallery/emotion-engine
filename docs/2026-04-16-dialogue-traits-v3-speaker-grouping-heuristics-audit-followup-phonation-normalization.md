# Dialogue Traits v3 Speaker-Grouping Heuristics Audit Follow-up — Phonation Normalization

**Date:** 2026-04-16  
**Auditor:** Independent audit for bead `ee-9e04`  
**Scope audited:**
- `docs/2026-04-16-dialogue-traits-v3-speaker-grouping-heuristics-ruleset.yaml`
- `docs/2026-04-16-dialogue-traits-v3-speaker-grouping-heuristics-contract.md`
- `.plans/2026-04-16-normalize-phonation-blocker-and-unblock-v3-scorer-seam.md`
- prior blocker note: `docs/2026-04-16-dialogue-traits-v3-speaker-grouping-heuristics-audit.md`

---

## Verdict

**Pass. The phonation blocker seam is now implementation-ready for blocker behavior.**

The earlier blocker was the ambiguous field-local `field_policies.phonation.blocker_when` pair-table shape. That ambiguity is now removed cleanly. `phonation` remains a strong scoring field, while the only remaining explicit phonation blocker posture is a conservative, global, clean-gated, whispered-vs-nonwhispered **soft-review** guard with additional stable-identity mismatch support.

This is materially safer for implementation than the prior design because it removes the under-specified zipped-pair/table interpretation problem and replaces it with explicit named rules.

---

## What passes audit

### 1. Phonation remains a strong scoring field

In `field_policies.phonation`:
- `exact_match_positive: 3.0`
- `mismatch_negative: -2.5`

Those weights remain intact, so phonation still contributes strongly to stable-identity scoring rather than being demoted into a blocker-only or vague-support field.

### 2. The ambiguous field-local phonation blocker table is gone

`field_policies.phonation.blocker_when` is now:

```yaml
blocker_when: []
```

That removes the exact ambiguity identified in the prior audit:
- no more implicit zipped list pairing question
- no more duplicated/odd table values to interpret
- no more uncertainty about whether field-local phonation rules or global blocker rules are authoritative

### 3. The remaining phonation blocker posture is explicit, conservative, and implementation-safe

The only remaining phonation blockers are two named global rules under `blocker_policy.rules`:
- `whispered_line_vs_nonwhispered_group_guard`
- `nonwhispered_line_vs_whispered_group_guard`

Both are:
- `severity: soft_review_block`
- gated by `clean_reuse_gate: true`
- gated by `additional_stable_identity_mismatches_at_least: 2`

That is conservative in the right way:
- not a hard blocker
- not triggered on degraded evidence
- not triggered on phonation alone
- not broadened into a speculative taxonomy of other phonation conflicts

### 4. The mirrored whispered-vs-nonwhispered guards are coherent and do not broaden scope

The two rules are a readable symmetric expansion of the previously one-direction posture:
- whispered line vs non-whispered group
- non-whispered line vs whispered group

The mirror does **not** broaden scope beyond the approved simple version because:
- both rules are still limited to whispered vs clearly non-whispered contrast
- both exclude `mixed` and `unknown`
- both still require clean gating plus additional stable-identity mismatch support
- both remain soft-review only

So the change improves symmetry/readability without introducing a wider phonation conflict system.

---

## Parser / key-shape truth check

### Important distinction

The normalization removed the old ambiguous **pair-table** shape, which was the real implementation blocker.

The mirrored global guards do introduce a small predicate-shape detail that implementers should note:
- `line_value: whispered`
- `group_value: whispered`

These scalar equality predicates now appear alongside existing list-style predicates such as:
- `line_value_in`
- `group_value_in`
- `line_value_not_in`
- `group_value_not_in`
- `neither_value_in`

### Audit conclusion on parser risk

**This is not a blocker.**

Why:
1. Scalar equality keys are semantically clear; they do not require zipped-pair interpretation.
2. List-negation keys were already present elsewhere in the ruleset, so the mirrored guards are not introducing a brand-new general condition language.
3. The new scalar keys are narrowly scoped and easy to support in a deterministic evaluator.
4. The contract is now more explicit overall than the previous phonation table design.

### Implementation note

The scorer/parser should treat blocker predicates as an explicit small predicate vocabulary, including at least:
- scalar equality: `line_value`, `group_value`
- membership: `line_value_in`, `group_value_in`
- exclusion: `line_value_not_in`, `group_value_not_in`, `neither_value_in`
- boolean/numeric gates such as `clean_reuse_gate` and `additional_stable_identity_mismatches_at_least`

That is a straightforward parser concern, not a design blocker.

---

## Bottom line

The phonation blocker normalization resolves the earlier audit blocker cleanly.

**The blocker seam is now implementation-ready.** Specifically:
- phonation scoring remains strong
- the ambiguous field-local phonation blocker table is removed
- the remaining phonation blocker posture is explicit and conservative
- the mirrored whispered guards are coherent and bounded
- no new ambiguity comparable to the prior pair-table problem was introduced

The next scorer implementation can safely treat phonation blocker behavior as locked to this simple posture.
