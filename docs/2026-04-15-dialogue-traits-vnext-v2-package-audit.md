# Dialogue Traits vNext v2 Package Audit

**Date:** 2026-04-15  
**Auditor:** Independent package audit (`ee-j2gw`)  
**Scope audited:**
- `docs/2026-04-15-dialogue-traits-full-enum-audit-v2.md`
- `docs/2026-04-15-dialogue-traits-maximalist-contract-vnext-v2.md`
- `docs/2026-04-15-dialogue-traits-pass-ownership-architecture-v2.md`
- `docs/2026-04-15-dialogue-traits-vnext-package-audit.md`
- `.plans/2026-04-15-revise-vnext-contract-from-north-star-feedback.md`

---

## 1. Audit verdict

**Verdict: Pass with focused conditions.**

The revised v2 package is materially coherent across enum audit, contract spec, and architecture note, and is directionally faithful to the north star:
- preserve perceptual cues that let humans recognize the same speaker across unrelated performances,
- improve emotion/affect coverage where previous coverage was too narrow,
- keep closed-contract/source-truth guardrails intact.

The package does **not** reintroduce prohibited patterns (role/lore labels, source-truth speaker ownership, free-text traits). The major v2 changes are appropriately concentrated in affect completeness and architecture prioritization, rather than broad taxonomy sprawl.

---

## 2. What the revised package gets right

- **Cross-doc coherence is strong.**
  - Enum audit calls for `affect` expansion (`tense`, `amused`, `disgusted`), keeps `taunting`, rejects standalone `tone`.
  - Contract encodes those exact choices in allowed values and policy text.
  - Architecture note updates split priority to elevate emotion/pragmatics while keeping accent as first true specialist lane.

- **Closed-contract philosophy remains intact.**
  - Contract remains closed-required per-line fields with no free-text trait escape hatch.
  - Explicitly forbids speaker ownership/timing/handoff fields in persisted source truth.
  - Keeps source truth at line-local perceptual observations rather than narrative semantics.

- **North-star alignment is improved where it matters most.**
  - Expanded affect coverage is directly tied to cross-performance recognizability (not “more labels for their own sake”).
  - `taunting` is retained and justified as distinct from broad confrontation.
  - `tone` is correctly treated as composite output of existing fields rather than a junk-drawer enum.

- **v1 structural splits were preserved appropriately.**
  - `channel_texture` split (`transmission_medium` + `spatial_texture`) remains defensible.
  - `delivery_stance` split (`interpersonal_stance` + `delivery_overlay`) remains defensible.

---

## 3. Recommendations that pass audit strongly

1. **Approve the v2 affect expansion exactly as proposed** (`tense`, `amused`, `disgusted`).  
   This is the most justified north-star-driven correction and is consistently represented in all revised docs.

2. **Approve keeping `taunting` in `interpersonal_stance`.**  
   Distinguishing baiting/mockery from generic confrontation materially improves perceptual fidelity.

3. **Approve rejecting a standalone `tone` field.**  
   The current composite approach (`pitch_band`, `phonation`, `pace`, `energy`, `affect`, `interpersonal_stance`, `delivery_overlay`) is cleaner and less collapse-prone.

4. **Approve preserving v1 structural splits.**  
   No evidence in the revised package suggests reversing those splits; they remain high-value disambiguations.

5. **Approve architecture v2 direction:** emotion/pragmatics as strongest early bundle candidate, accent as first true specialist family.

---

## 4. Recommendations that need tightening / conditions

1. **Condition: Add concise boundary heuristics for new affect distinctions** to protect annotation consistency:
   - `fearful` vs `tense`
   - `happy` vs `amused`
   - `angry` vs `disgusted`
   - `calm`/`serious` interactions (to prevent `serious` becoming a catch-all)

2. **Condition: Tighten stance discriminators for `taunting` vs `confrontational`.**  
   Current rationale is good, but consistency will depend on short, explicit “choose X / not Y” examples.

3. **Condition: Add calibration guidance for overlay/affect interactions.**  
   e.g., laughing overlay does not force amused affect; crying overlay does not force sad affect.

4. **Condition: Keep accent-family guardrails operational, not just aspirational.**  
   The contract warns against identity overreach, but practical consistency needs explicit “prefer `unknown`” thresholds under weak evidence.

5. **Condition: Gate architecture splits on measured failure signatures.**  
   The architecture note proposes the right direction; adoption should be contingent on observed flattening/default-collapse metrics, not assumed in advance.

---

## 5. Recommendations to defer or reject

1. **Reject adding standalone `tone` now (and by default).**

2. **Defer further affect-taxonomy expansion beyond v2 additions** until inter-rater stability is measured on real annotation slices.

3. **Defer expanding `delivery_overlay` beyond `laughing`/`crying`** unless current overlays demonstrably underfit high-frequency data.

4. **Reject any reintroduction of source-truth speaker ownership, role/lore labels, or open text in traits.**

5. **Defer hard-fail enforcement of cross-field semantic coherence rules.**  
   Keep as warning/retry guidance until false-positive/over-rejection rates are known.

---

## 6. Architecture-note verdict

**Verdict: Strong and justified with evidence-gated execution.**

The revised architecture note is coherent with the revised contract and north star:
- It correctly elevates emotion/pragmatics as the first likely bundle when one-pass quality flattens.
- It still correctly treats accent as the first true specialist lane.
- It avoids premature multi-pass sprawl by framing split decisions as conditional and metric-driven.

No structural contradiction found between architecture-v2 and contract-v2.

---

## 7. Final operator guidance

1. **Adopt this v2 package as the current review baseline.**
2. **Proceed with implementation planning using the approved core choices:**
   - affect expansion,
   - `taunting` retention,
   - no standalone tone field,
   - preserved v1 splits,
   - architecture priority shift to emotion/pragmatics as early bundle candidate.
3. **Before lock/rollout, require a short calibration artifact** (examples + discriminator rules) for the new affect and stance boundaries.
4. **Use a targeted eval slice** (amused-taunting, disgusted-confrontational, tense low-volume, crying/pleading, laughter-overlay lines) to confirm annotation consistency and flattening reduction.

**Concise conclusion:** The v2 package is a meaningful north-star-aligned improvement and is ready to advance, provided boundary calibration guidance is added before implementation lock.