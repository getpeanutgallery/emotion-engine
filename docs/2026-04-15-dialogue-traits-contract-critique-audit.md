# Dialogue Traits Contract Critique Audit (Stored v2)

**Date:** 2026-04-15  
**Auditor:** Independent critique-lane audit  
**Scope audited:** `docs/2026-04-15-dialogue-traits-contract-critique.md` against current stored-v2 source docs and migration seam

---

## 1. Audit verdict

**Verdict: Pass with conditions.**

The critique is largely faithful to the current stored-v2 contract and preserves the core closed-contract philosophy:
- keeps source-truth narrow (`index`, `text`, closed `traits`, required top-level `summary`)
- preserves removal of persisted `start`/`end`, `speaker`/`speaker_id`/`confidence`, `speaker_profiles`, `handoffContext`
- does not reintroduce role/lore/character labels or open-ended trait fields
- keeps deterministic grouping as first owner of `speaker_id`

Its strongest recommendations are migration/validator hygiene and enum-semantics tightening. Enum additions are mostly concrete, but **not all should be accepted unconditionally**.

---

## 2. What the critique got right

1. **Accurate representation of stored-v2 boundaries.**  
   The critique correctly reflects the current contract docs on required envelope fields, closed per-line traits, and forbidden speaker/timing/handoff ownership.

2. **Correct closed-contract posture.**  
   It does not advocate free-text expansion, confidence fields in traits, or role/lore backdoors.

3. **Correct `affect` vs `delivery_stance` interpretation.**  
   It preserves the reviewed distinction (internal-feeling impression vs outward delivery orientation).

4. **Valid migration risk callout.**  
   The warning about legacy surfaces is evidence-backed (current repo still contains speaker/timing contract logic in validator tooling and benchmark assumptions).

5. **Useful emphasis on abstention semantics.**  
   Tightening `unknown`/`mixed`/`variable` definitions is high-value and directly supports contract stability.

---

## 3. Recommendations that pass audit

These are strong and should proceed.

1. **Create/maintain a clean traits-mode validation/prompt lane (no speaker-contract shim).**  
   This is the highest-confidence recommendation and aligns with the migration seam docs.

2. **Define explicit semantics for `unknown`, `mixed`, and `variable` per field class.**  
   This is necessary to prevent catch-all drift under required-all-fields constraints.

3. **Add `phonation: whispered` (closed enum addition).**  
   Concrete, non-redundant, and frequently needed.

4. **Add `channel_texture: pa_or_intercom` (closed enum addition).**  
   Concrete and operationally useful for common media textures that are poorly represented by current buckets.

5. **Treat gating cues (`audibility`, `overlap`) as reliability controls, not just score features.**  
   Strongly justified by current Layer A/B/C architecture.

6. **Migrate benchmark/comparator surfaces so traits mode is evaluated against traits-mode truth.**  
   Necessary to avoid schema-mismatch false regressions.

---

## 4. Recommendations that need tightening / conditions

1. **`accent_family` addition for non-neutral anglophone accents** — **Conditional**  
   The gap is real, but acceptance should require:
   - neutral token naming that avoids identity-coded framing
   - explicit scope notes to avoid geography/lore creep
   - an explicit versioning/migration decision (`traits_contract_version` bump policy)

2. **`delivery_stance: taunting`** — **Conditional**  
   Reasonable candidate, but should be accepted only with a tight discriminator versus existing `confrontational` and `performative`, plus examples.

3. **Precedence rules for ambiguous residual buckets (`distorted`, `processed`, `mixed`, `performative`)** — **Conditional**  
   Good recommendation, but must be implemented as concise deterministic rules to avoid introducing subjective branching.

4. **Lightweight semantic contradiction checks** — **Conditional**  
   Keep as warning/retry heuristics only. Avoid hard constraints that could produce false failures in noisy audio.

---

## 5. Recommendations to defer or reject

1. **Defer any broad accent taxonomy redesign.**  
   The critique itself suggests deferral; audit agrees. Current evidence does not justify large pre-implementation taxonomy expansion.

2. **Defer broader affect/delivery granularity expansion beyond clearly justified additions.**  
   Avoid premature class proliferation before artifact evidence.

3. **Reject any interpretation of this critique as permission to alter source-truth ownership boundaries.**  
   No reintroduction of speaker ownership, timing ownership, handoff persistence, or open text in `traits`.

---

## 6. Any missed risks in the critique

1. **Contract-versioning/migration mechanics are under-specified.**  
   If enums change, the plan must explicitly state version bump and compatibility expectations (`2.0.0` vs next).

2. **Top-level closedness enforcement details are not explicit enough.**  
   The critique discusses forbidden fields but does not explicitly call out strict extra-key policy at top-level vs additive metadata strategy for traits mode.

3. **Accent taxonomy governance risk is underplayed.**  
   New accent buckets can drift toward sociocultural labeling if guidance is not extremely explicit and bounded.

4. **Inter-rater/model consistency risk for new stance classes is not quantified.**  
   New labels (e.g., `taunting`) need acceptance criteria and examples to avoid reducing reliability.

---

## 7. Final operator guidance

1. **Adopt the critique’s architecture/migration recommendations now.**
2. **Adopt enum-semantics clarifications (`unknown`/`mixed`/`variable`) now.**
3. **Approve only high-confidence enum additions immediately (`whispered`, `pa_or_intercom`).**
4. **Gate `accent_family` and `taunting` additions behind explicit definition + versioning decisions.**
5. **Keep closed-contract guardrails non-negotiable:** no role/lore labels, no speaker ownership in source truth, no open-ended trait fields.

**Bottom line:** The critique is rigorous and mostly implementation-ready, but a subset of enum recommendations should be treated as conditional until definition and versioning details are locked.
