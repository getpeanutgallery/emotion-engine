# Dialogue Traits v2 Calibration/Eval/Split-Trigger Package Audit

**Date:** 2026-04-15  
**Auditor:** Independent audit (`ee-u616`)  
**Scope audited:**
- `docs/2026-04-15-dialogue-traits-v2-calibration-artifact.md`
- `docs/2026-04-15-dialogue-traits-v2-targeted-eval-slice.md`
- `docs/2026-04-15-dialogue-traits-v2-emotion-pragmatics-split-triggers.md`
- `docs/2026-04-15-dialogue-traits-maximalist-contract-vnext-v2.md`
- `docs/2026-04-15-dialogue-traits-pass-ownership-architecture-v2.md`
- `docs/2026-04-15-dialogue-traits-vnext-v2-package-audit.md`
- `.plans/2026-04-15-calibration-artifact-eval-slice-and-split-triggers.md`

---

## 1. Audit verdict

**Verdict: Pass with targeted tightening conditions.**

The package is coherent across calibration guidance, eval design, and split-decision criteria, and it stays aligned with the revised v2 contract and architecture direction:
- closed persisted contract is respected,
- boundary-heavy expressive distinctions are explicitly operationalized,
- split decisions are evidence-gated rather than intuition-driven.

The package is actionable enough for next prompt/validator/planning work now, but several scoring and governance details should be tightened before using it as a hard topology-decision gate.

---

## 2. What the package gets right

- **Cross-document coherence is strong and deliberate.**  
  Calibration boundary cards map directly to targeted eval buckets:
  - `fearful` vs `tense` (Bucket A),
  - `happy` vs `amused` (Bucket B),
  - `angry` vs `disgusted` (Bucket C),
  - `taunting` vs `confrontational` (Bucket D),
  - overlay interactions (Bucket E).

- **Contract/architecture alignment is intact.**  
  Calibration rules respect v2 enum and sentinel semantics (especially `unknown`, `mixed`, `variable`, `none_apparent`) and preserve the contract’s “closed, line-local, no lore/identity inference” posture. Split-trigger guidance matches architecture v2: emotion/pragmatics as first likely bundle candidate, accent as non-trigger for this split.

- **Boundary guidance is useful without being overfitted to single phrasings.**  
  The calibration artifact emphasizes audible evidence and abstention discipline, not keyword matching or textual shortcuts.

- **Targeted eval slice is representative of the intended failure family.**  
  The 30-asset structure covers both hard boundary buckets and control lines, includes approved alternates, and requires reruns and manual review. This is practical for iterative prompt/validator cycles.

- **Split-trigger framing is properly evidence-gated and not premature.**  
  It requires:
  1) targeted slice execution,  
  2) repeated runs,  
  3) manual miss classification, and  
  4) one focused refinement cycle before split escalation.

---

## 3. Recommendations that pass audit strongly

1. **Keep the calibration artifact’s abstention-first discipline as normative.**  
   “Prefer `unknown` over unsupported specificity” is the right anti-hallucination guardrail for these labels.

2. **Keep warning-level disagreement handling (not hard-fail) for boundary-adjacent misses.**  
   This matches the contract’s warning/retry philosophy and reduces brittle over-enforcement.

3. **Adopt the targeted 30-asset bucket model as the standard pre-implementation stress slice.**  
   It is small enough to rerun frequently but broad enough to reveal flattening patterns.

4. **Keep split decisions constrained to expressive-bucket evidence (A–E).**  
   Treat accent/medium/gating failure families as separate remediation paths unless expressive flattening is clearly concentrated.

5. **Retain one focused prompt/validator iteration before topology change.**  
   This is a good threshold between premature splitting and analysis paralysis.

---

## 4. Recommendations that need tightening / conditions

1. **Clarify denominator and aggregation math for split thresholds.**  
   The split-trigger doc should explicitly state whether rates are computed:
   - per run then averaged, or
   - pooled across all 3 runs,
   and whether trigger checks require consistency in each run vs summary-only.

2. **Define a hard reviewer protocol for adjudicating “approved alternates.”**  
   Current docs are directionally right, but without a fixed adjudication rule, alternates can drift into post-hoc pass inflation.

3. **Require at least two reviewers for boundary buckets A–E when split decisions are on the table.**  
   One reviewer is acceptable for tuning loops; topology-change evidence should use stronger inter-rater grounding.

4. **Add explicit minimum evidence requirements for non-trigger diagnosis.**  
   Example: before declaring “not an expressive problem,” require documented evidence that audibility/overlap/transcription quality is not the primary failure source.

5. **Constrain asset refresh cadence and provenance tracking.**  
   To avoid overfitting to a frozen mini-set, define when assets are rotated and require source/provenance metadata per asset.

6. **Tighten borderline-zone exit criteria.**  
   “Do one focused revision cycle” is good; add explicit “accept / split / defer” decision outputs to prevent repeated ambiguous reruns.

---

## 5. Recommendations to defer or reject

1. **Reject any move to make these cross-field semantics hard schema invalidators right now.**  
   Keep semantics as warning/retry/human-review signals until false-positive burden is measured.

2. **Reject broadening split triggers to non-expressive buckets for this decision path.**  
   Doing so would blur architecture intent and weaken causal attribution.

3. **Defer raising complexity (larger benchmark, extra bundle candidates, multi-lane split experiments) until this 30-asset protocol yields stable evidence over multiple cycles.**

4. **Defer introducing additional affect/stance taxonomy changes during this phase.**  
   First validate whether current v2 boundaries can be learned and scored consistently.

---

## 6. Final operator guidance

- Treat this package as **ready for operational use in next-cycle prompt/validator planning**, with the tightening items above applied before using results as a hard architecture gate.
- Run the targeted slice as written, preserve full run artifacts, and score expressive buckets with explicit alternate-handling rules.
- Use split escalation only when threshold failures are both:
  1) reproducible across reruns/refinement, and  
  2) clearly concentrated in `affect` + `interpersonal_stance` + `delivery_overlay`.
- If failures primarily cluster in accent, medium/spatial, or capture/gating reliability, route fixes there and do not misclassify them as evidence for emotion/pragmatics topology split.

**Concise conclusion:** The calibration/eval/split-trigger package is coherent and actionable, and should proceed with implementation-planning use now, provided scoring-governance details are tightened before making irreversible topology decisions.
