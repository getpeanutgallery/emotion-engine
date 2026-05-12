# Emotion Engine

**Date:** 2026-04-16  
**Status:** Complete  
**Agent:** Cookie 🍪

---

## Goal

Produce a review-ready execution proposal for the v3 dialogue-traits + deterministic speaker-grouping lane by folding the architecture, runtime, and QA red-team critiques back into one sharper first-slice plan Derrick can approve, redirect, or reject before implementation starts.

---

## Overview

The design package is now strong enough to stop debating the contract and start debating execution. The persisted traits/source-truth envelope is locked, the deterministic YAML heuristics contract exists, and the phonation blocker ambiguity has been reduced to an implementation-safe conservative posture. The remaining problem is not design intent; it is execution shape.

The red-team critiques all converged on the same risk pattern: the earlier draft was directionally correct, but it still left too many architecture seams implicit. In particular, it blurred source-truth validation with grouping validation, failed to name the derived grouping artifact explicitly, skipped the canonical group-state / `canonical_traits` reducer seam, left the scorer action ordering too vague, and reached cod-test too early without deterministic pre-gates or a benchmark-surface decision.

This revision tightens the first vertical slice around a safer execution posture: keep grouping as a deterministic post-pass over validated v3 source truth, introduce a separate derived `speaker-grouping` artifact, implement a fail-closed ruleset loader/compiler instead of a generic rules engine, land ledger/tracing with scorer implementation, and require deterministic proof gates before the first real cod-test interpretation. The proposal below is intended to be review-ready rather than optimistic.

---

## REFERENCES

| ID | Description | Path |
| --- | --- | --- |
| `REF-01` | Existing vertical-slice implementation plan | `.plans/2026-04-15-implement-dialogue-traits-v2-and-run-cod-test-vertical-slice.md` |
| `REF-02` | v3 heuristics ruleset | `docs/2026-04-16-dialogue-traits-v3-speaker-grouping-heuristics-ruleset.yaml` |
| `REF-03` | v3 heuristics contract summary | `docs/2026-04-16-dialogue-traits-v3-speaker-grouping-heuristics-contract.md` |
| `REF-04` | v3 heuristics audit follow-up after phonation normalization | `docs/2026-04-16-dialogue-traits-v3-speaker-grouping-heuristics-audit-followup-phonation-normalization.md` |
| `REF-05` | v2 maximalist traits contract | `docs/2026-04-15-dialogue-traits-maximalist-contract-vnext-v2.md` |
| `REF-06` | v2 pass-ownership architecture note | `docs/2026-04-15-dialogue-traits-pass-ownership-architecture-v2.md` |
| `REF-07` | v2 calibration artifact | `docs/2026-04-15-dialogue-traits-v2-calibration-artifact.md` |
| `REF-08` | v2 targeted eval slice | `docs/2026-04-15-dialogue-traits-v2-targeted-eval-slice.md` |
| `REF-09` | cod-test benchmark truth system | `benchmarks/fixtures/cod-test/` |
| `REF-10` | high-level execution epic | `ee-gqnc` |
| `REF-11` | Current session discussion / approval to plan deeply and red-team it | current session |
| `REF-12` | Architecture red-team critique | `docs/2026-04-16-v3-traits-proposal-architecture-red-team.md` |
| `REF-13` | Runtime / implementation red-team critique | `docs/2026-04-16-v3-traits-proposal-runtime-red-team.md` |
| `REF-14` | QA / benchmark-truth red-team critique | `docs/2026-04-16-v3-traits-proposal-qa-red-team.md` |

---

## Review-Ready Execution Proposal

### First-slice decision summary

This proposal assumes the first implementation slice should prove the new v3 seam **without** pretending the repo has already completed a full artifact and benchmark migration. The safest review-ready posture is:

1. keep the current raw/legacy extraction path alive as transitional input if needed,
2. add a strict validated v3 source-truth artifact boundary,
3. run deterministic grouping as a **separate post-pass** over that validated source truth,
4. write grouping outputs only to a derived `speaker-grouping` artifact,
5. treat dialogue-only v3 + grouping comparison as the primary truth surface for this lane,
6. treat any legacy compatibility bridge as secondary and explicitly non-authoritative,
7. defer singleton merge even though the YAML currently supports it.

That keeps the first slice honest: it proves the new ownership split and the deterministic grouping lane before broader cleanup or product-scale migration.

### Artifact and ownership seams

#### Artifact 0 — Transitional raw/legacy dialogue output
- Purpose: preserve the current producer path while the new v3 boundary is introduced.
- Ownership: existing extraction/runtime code.
- First-slice rule: allowed as transitional input only; **not** the authoritative source-truth contract for grouping.

#### Artifact 1 — Validated v3 source-truth `dialogue-data`
- Purpose: the first authoritative input to deterministic grouping.
- Ownership: source truth only.
- Must contain only the locked v3 envelope and closed `traits` object.
- Must reject forbidden source-truth fields and superseded normative names.
- Must not know or care whether a grouping ruleset exists.

#### Artifact 2 — Derived `speaker-grouping`
- Purpose: own all grouping outputs and explainability.
- Ownership: deterministic grouping pass only.
- Minimum required contents for the first slice:
  - grouping schema/version metadata
  - source artifact ref/hash/version metadata
  - ruleset ref/hash/version metadata
  - `speaker_groups`
  - `assignments`
  - `canonical_traits`
  - ambiguity outputs
  - decision ledger / trace records
- First-slice rule: `dialogue-data` remains immutable source truth; grouping never mutates it in place.

#### Artifact 3 — Golden benchmark `speaker-grouping` truth surface
- Purpose: provide the primary development and benchmark target for deterministic grouping in `cod-test`.
- Ownership: golden benchmark truth / comparator layer.
- First-slice rule: should mirror the runtime `speaker-grouping` seam closely enough to compare assignments, group continuity behavior, ambiguity posture, and any approved derived summaries like-to-like.

#### Artifact 4 — Optional disposable compatibility bridge
- Purpose: keep any remaining legacy comparator/downstream surfaces minimally usable during the transition if strictly needed.
- Ownership: compatibility layer only.
- First-slice rule: may exist if needed, but is explicitly secondary, disposable, and must never become the source of truth for grouping correctness.

### Benchmark-surface decision

For the first slice, the **primary approval surface** should be the new speaker-grouping comparison lane anchored to golden benchmark truth:
- validated v3 source-truth `dialogue-data`,
- derived runtime `speaker-grouping` output,
- golden benchmark `speaker-grouping` truth for `cod-test`,
- comparator/reporting that can separate source-truth deltas from grouping deltas.

This means the implementation target is not a legacy blended dialogue surface. The runtime should produce a real derived `speaker-grouping` artifact, and the benchmark side should provide a matching golden `speaker-grouping` truth surface or comparator-ready truth projection so development and testing can happen like-to-like against the seam we are actually building.

The current `cod-test` YAML config and golden benchmark truth remain the durable anchors for the first slice. Legacy cassette preservation is not a goal. If a temporary compatibility bridge is still needed anywhere in the harness, it should be minimal, disposable, and explicitly non-authoritative.

### Explicit non-goals for the first slice

- no automatic split pass
- no emotion/pragmatics specialist pass
- no accent specialist pass
- no generalized rules authoring system or open-ended predicate language
- no mutation of `dialogue-data` with grouping outputs
- no silent migration of historical stored-v2 artifacts beyond explicit validation/rejection or named compatibility adapters
- no singleton merge execution in the first slice, even if the ruleset field is present

---

## Required Execution Phases and Gates

### Phase 0 — Transition seam and benchmark-surface lock

Before scorer code starts, record the transition posture explicitly:
- what current raw/legacy artifact remains alive,
- what exact v3 source-truth artifact is authoritative,
- whether a temporary compatibility bridge is needed,
- what comparator surface is primary for approval,
- what existing downstream consumers continue reading during the transition.

**Required output:** one short design/runtime note in the implementation plan or task notes that locks those answers before implementation expands.

### Phase A — Source-truth validation gate only

This phase owns only the persisted v3 source-truth boundary.

Required work:
- validate the locked v3 `dialogue-data` envelope,
- enforce required top-level, segment, and traits fields,
- enforce closed `traits`,
- reject forbidden source-owned fields such as `speaker_id`, `group_id`, timing, `handoffContext`, `speaker_profiles`, and other grouping/runtime leakage,
- reject superseded normative names such as stored-v2 `channel_texture` and `delivery_stance` unless a named compatibility adapter is explicitly in play.

Critical boundary rule:
- this validator must **not** load the grouping YAML and must **not** know grouping semantics.

### Phase B — Ruleset loader / compiler gate only

This phase owns only the grouping ruleset contract.

Required work:
- validate the YAML schema/version and compatibility metadata,
- compile each section into a narrow typed internal representation,
- fail closed on unknown keys, unsupported predicate shapes, and bad enum references,
- support only the explicitly observed predicate vocabulary,
- keep section-specific parsers rather than a generic “evaluate arbitrary YAML conditions” runtime.

Allowed predicate vocabulary for the first slice includes only the currently required shapes from the locked ruleset, including:
- scalar equality: `line_value`, `group_value`
- membership: `line_value_in`, `group_value_in`
- exclusion: `line_value_not_in`, `group_value_not_in`, `neither_value_in`
- boolean/numeric gates such as `clean_reuse_gate`, `additional_stable_identity_mismatches_at_least`, `contradictory_exact_mismatches_at_least`, and related allowlisted predicates

Critical boundary rule:
- the YAML loader/compiler is a **bounded contract parser**, not a general rules engine.

### Phase C — Canonical group-state / `canonical_traits` reducer seam

This is now an explicit mandatory seam rather than an implicit scorer detail.

Required work:
- introduce a deterministic reducer that owns per-group support state,
- derive `canonical_traits` from accumulated group evidence,
- expose pre-update candidate group snapshots to the scorer,
- define how concrete values, `unknown`, `mixed`, `variable`, and `none_apparent` participate in group state,
- make reducer state snapshot-testable independently of scorer threshold tuning.

Critical boundary rule:
- scorer logic may read reducer snapshots but may not hide ad hoc mutable group state internally.

### Phase D — Deterministic scorer + trace/ledger + action resolver

Tracing lands here **with** scorer implementation, not later.

Required work:
- compare line traits against candidate group snapshots,
- apply positive/negative evidence,
- apply degraded gating penalties,
- evaluate hard blockers and soft-review blockers,
- score `create_group` as an explicit action path rather than an implicit fallback,
- resolve reuse vs create vs ambiguous vs abstention through an explicit deterministic action order,
- emit trace objects that serialize cleanly into the final decision ledger.

Required decision order for the first slice:
1. load validated v3 source truth,
2. load compiled ruleset,
3. build candidate group pre-update snapshots from the reducer,
4. compute clean/degraded gating state,
5. compute field/bucket relations and score contributions,
6. evaluate blocker hits and suppressed blocker hits,
7. eliminate or mark candidates according to blocker severity,
8. compare surviving reuse candidates against the explicit `create_group` path,
9. apply threshold, tie-breaker, ambiguity, and abstention logic,
10. choose action,
11. record the pre-update decision ledger entry,
12. update reducer state and `canonical_traits`,
13. write the derived `speaker-grouping` artifact.

Cleanup ordering rule:
- singleton merge is **not** executed in the first slice.
- if its ruleset setting is present, the runtime may parse it for future compatibility but must record that cleanup execution is deferred and out of scope for the first slice.

### Phase E — Deterministic proof gates before the first real cod-test interpretation

The first real cod-test interpretation does not begin until these deterministic pre-gates are green.

#### Gate 1 — Source-truth rejection fixtures
Must pass 100% on deterministic fixtures that prove:
- forbidden source-truth fields are rejected,
- superseded normative names are rejected or explicitly adapter-routed,
- source-truth validation is separate from grouping validation.

#### Gate 2 — Ruleset loader/compiler rejection fixtures
Must pass 100% on deterministic fixtures that prove:
- unknown YAML keys fail closed,
- unsupported predicate shapes fail closed,
- wrong scalar/array types fail closed,
- unsupported field names/enums fail closed.

#### Gate 3 — Reducer/scorer/ledger micro-fixtures
Must pass 100% on deterministic fixtures that prove:
- clean reuse,
- create-new-group,
- ambiguity between plausible groups,
- abstention/review under degraded gating,
- whispered vs non-whispered soft-review posture,
- sentinel handling for `unknown`, `mixed`, `variable`, and `none_apparent`,
- canonical group-state evolution over multiple lines,
- ledger completeness and allowed reason vocabulary,
- pre-update snapshot semantics.

#### Gate 4 — Targeted expressive evaluation carry-forward
Before the first full cod-test interpretation, rerun the targeted expressive slice with explicit review posture carried forward from the v2 calibration/eval docs:
- 3 repeated runs,
- honest abstention checks,
- collapse-pattern review,
- approved-alternate posture where applicable,
- durable run records linking model/prompt/ruleset ids.

#### Gate 5 — Dialogue-focused cod-test structural sanity
Before using any cod-test result semantically, the dialogue-focused benchmark lane must finish without structural benchmark errors, and every miss must be classifiable.

Allowed miss buckets:
- source-truth extraction/input miss
- source-truth validator/normalization bug
- grouping reducer/scorer bug
- comparator/reporting bug
- truth-gap / truth-migration issue

### Phase F — First real cod-test vertical slice and reporting

Only after Gates 1–5 are green should the first real cod-test interpretation be treated as evidence for the new seam.

Required reporting posture:
- preserve all artifacts and replay/cassette evidence,
- report **source-truth deltas** separately from **grouping deltas**,
- classify misses instead of collapsing them into one headline,
- record whether any result came from the primary v3 surface or a secondary compatibility bridge,
- keep dialogue-focused truth as the primary acceptance lane even if the broader six-artifact cod-test suite is also run.

Required evidence bundle for the first real vertical-slice attempt:
- input asset identity/hash
- exact command(s) used
- git commit SHA
- current `cod-test` YAML config path/hash
- prompt path/version
- model id/version
- ruleset path/hash
- validator/reducer/scorer build identifier
- raw extractor output (if used)
- validated v3 source-truth artifact path
- derived runtime `speaker-grouping` artifact path
- golden benchmark `speaker-grouping` truth artifact path or comparator truth-projection path
- decision ledger path
- comparator result JSON/MD paths
- reviewer miss-classification note
- plan path and bead linkage

---

## Approval choices / unresolved tradeoffs

These are the remaining real decisions Derrick may want to approve explicitly:

1. **Primary comparator implementation path**  
   Recommendation: make the primary approval lane runtime `speaker-grouping` vs golden benchmark `speaker-grouping` truth for `cod-test`, with source-truth and grouping deltas reported separately.

2. **Transition shape in the repo**  
   Recommendation: keep the current raw/legacy artifact path alive only as transitional input if needed, add a strict validated v3 source-truth projection, then run grouping from that projection rather than replacing every downstream consumer in one move.

3. **Legacy compatibility / cassette posture**  
   Recommendation: do not spend effort preserving legacy cassette workflows; if a temporary compatibility bridge is needed, keep it minimal and disposable.

4. **Singleton merge timing**  
   Recommendation: defer execution entirely for the first slice, even if the YAML contains the field, and revisit only after base scorer/reducer/ledger behavior is proven.

Derrick approved the sharper benchmark posture in the current session: create the runtime `speaker-grouping` artifact, create/use the golden benchmark `speaker-grouping` truth surface for `cod-test`, and develop/test against that seam first. With that approval recorded, the proposal is ready for implementation planning against bead `ee-gqnc`.

---

## Tasks

### Task 1: Draft the detailed implementation proposal for the v3 scorer/parser/ledger vertical slice

**Bead ID:** `Pending`  
**SubAgent:** `primary`  
**References:** `REF-01`, `REF-02`, `REF-03`, `REF-04`, `REF-05`, `REF-06`, `REF-07`, `REF-08`, `REF-09`, `REF-10`  
**Prompt:** Draft a concrete implementation proposal for the v3 dialogue-traits + deterministic grouping seam. Break the work into parser/validation, scorer/blockers, explainability ledger, fixture-level verification, cod-test run, and truth-comparison phases. Keep it bounded to the first vertical slice and explicitly call out risks, touchpoints, validation gates, and what should not be built yet.

**Folders Created/Deleted/Modified:**
- `.plans/`

**Files Created/Deleted/Modified:**
- `.plans/2026-04-16-v3-traits-implementation-proposal-and-red-team-review.md`

**Status:** ✅ Complete

**Results:** Initial execution proposal drafted in this plan, then red-teamed and substantially revised. The first draft correctly aimed at a deterministic grouping post-pass over the locked v3 source-truth envelope, but left several architecture/runtime/QA seams implicit. Those gaps were addressed in Task 5.

---

### Task 2: Architecture red-team critique of the proposal

**Bead ID:** `ee-tbcc`  
**SubAgent:** `auditor`  
**References:** `REF-01`, `REF-02`, `REF-03`, `REF-05`, `REF-06`, `REF-11`  
**Prompt:** Critique the proposal as an architecture reviewer. Look for hidden scope creep, ownership-boundary violations, overcomplicated runtime seams, poor abstraction boundaries, and places where the plan could accidentally undermine the source-truth vs grouping split.

**Folders Created/Deleted/Modified:**
- `docs/`
- `.plans/`

**Files Created/Deleted/Modified:**
- `docs/2026-04-16-v3-traits-proposal-architecture-red-team.md`
- `.plans/2026-04-16-v3-traits-implementation-proposal-and-red-team-review.md`

**Status:** ✅ Complete

**Results:** Critique written at `docs/2026-04-16-v3-traits-proposal-architecture-red-team.md`. Verdict: directionally correct, but not yet execution-clean — the proposal needed an explicit derived grouping artifact seam, a separate group-state reducer seam, stricter source-truth vs grouping validation boundaries, a deterministic post-pass pipeline placement, and an explicit first-slice decision to defer singleton-merge scope.

---

### Task 3: Execution-risk and runtime-seam critique of the proposal

**Bead ID:** `ee-3dna`  
**SubAgent:** `coder`  
**References:** `REF-02`, `REF-03`, `REF-04`, `REF-05`, `REF-06`, `REF-11`  
**Prompt:** Critique the proposal as the future implementer. Look for parser-shape ambiguity, blocker execution ambiguity, hidden runtime complexity, likely touchpoint underestimation, testing blind spots, and any place where the proposed sequencing could make implementation or debugging harder than necessary.

**Folders Created/Deleted/Modified:**
- `docs/`
- `.plans/`

**Files Created/Deleted/Modified:**
- `docs/2026-04-16-v3-traits-proposal-runtime-red-team.md`
- `.plans/2026-04-16-v3-traits-implementation-proposal-and-red-team-review.md`

**Status:** ✅ Complete

**Results:** Wrote runtime-seam critique to `docs/2026-04-16-v3-traits-proposal-runtime-red-team.md`. Verdict: the proposal was directionally right but not implementation-ready because the transition seam from the current Phase 1 artifact, canonical group-state derivation, action-order/state-machine semantics, benchmark migration, and “no generic rules engine” constraint were still underspecified.

---

### Task 4: QA / benchmark-truth critique of the proposal

**Bead ID:** `ee-6wei`  
**SubAgent:** `qa`  
**References:** `REF-07`, `REF-08`, `REF-09`, `REF-11`  
**Prompt:** Critique the proposal from the QA / benchmark-truth perspective. Look for places where the plan could produce misleading cod-test results, insufficient fixture coverage, poor artifact preservation, or confusion between parser/scorer bugs and upstream extraction/model misses.

**Folders Created/Deleted/Modified:**
- `docs/`
- `.plans/`

**Files Created/Deleted/Modified:**
- `docs/2026-04-16-v3-traits-proposal-qa-red-team.md`
- `.plans/2026-04-16-v3-traits-implementation-proposal-and-red-team-review.md`

**Status:** ✅ Complete

**Results:** Critique written at `docs/2026-04-16-v3-traits-proposal-qa-red-team.md`. Verdict: the proposal was not yet QA-safe until it explicitly named the benchmark surface, separated parser/scorer/comparator failures from extraction misses, added deterministic pre-gates, and required a durable evidence bundle.

---

### Task 5: Revise the proposal from critique and present the review-ready execution plan

**Bead ID:** `ee-whvw`  
**SubAgent:** `primary`  
**References:** `REF-01`, `REF-02`, `REF-03`, `REF-04`, `REF-09`, `REF-10`, `REF-11`, `REF-12`, `REF-13`, `REF-14`  
**Prompt:** Fold the architecture, runtime-risk, and QA critiques back into this plan. Update the proposal to reflect valid criticisms, record unresolved tradeoffs honestly, and present a review-ready execution proposal Derrick can approve or redirect before implementation starts.

**Folders Created/Deleted/Modified:**
- `.plans/`

**Files Created/Deleted/Modified:**
- `.plans/2026-04-16-v3-traits-implementation-proposal-and-red-team-review.md`

**Status:** ✅ Complete

**Results:** Revised this plan using the exact critique files `docs/2026-04-16-v3-traits-proposal-architecture-red-team.md`, `docs/2026-04-16-v3-traits-proposal-runtime-red-team.md`, and `docs/2026-04-16-v3-traits-proposal-qa-red-team.md`. Actual revisions made:
- separated source-truth validation from grouping/ruleset validation,
- added an explicit derived `speaker-grouping` artifact seam,
- added an explicit canonical group-state / `canonical_traits` reducer seam,
- fixed pipeline placement so grouping is a deterministic post-pass over validated v3 source truth,
- constrained the YAML loader/compiler to an allowlisted fail-closed contract parser instead of a general rules engine,
- made blocker / ambiguity / create-vs-reuse / cleanup ordering explicit,
- explicitly deferred singleton merge for the first slice even though the YAML currently exposes it,
- added deterministic Gates 1–5 before the first real cod-test interpretation,
- required an explicit benchmark-surface decision and a durable evidence bundle,
- required separate source-truth vs grouping delta reporting,
- moved ledger/tracing into the scorer implementation phase rather than leaving it for later,
- recorded the remaining approval choices / tradeoffs honestly.

The proposal is now review-ready for Derrick to approve, reject, or redirect before implementation begins.

---

## Final Results

**Status:** ✅ Complete

**What We Built:** A substantially revised, review-ready execution proposal for the v3 dialogue-traits + deterministic speaker-grouping first slice. The plan now names the transition seam, the authoritative v3 source-truth boundary, the derived `speaker-grouping` artifact, the canonical group-state reducer, the fail-closed ruleset compiler boundary, the scorer/ledger/state-machine order, the deterministic pre-gates, the benchmark-surface decision, and the evidence/reporting requirements for the first real cod-test interpretation.

**Reference Check:** `REF-01` through `REF-04` and `REF-09` through `REF-14` were incorporated directly. The revised proposal now reflects the red-team critiques while staying aligned with the locked v3 heuristics contract and the prior vertical-slice plan. Deliberate first-slice deviation called out explicitly: although `REF-02` exposes singleton-merge configuration, this proposal defers executing singleton merge until a later gated slice.

**Commits:**
- None in this planning-only revision pass.

**Lessons Learned:** Execution risk here is mostly seam risk, not weighting risk. The review became materially stronger once source-truth validation, ruleset compilation, reducer state, scorer tracing, benchmark surface, and evidence requirements were treated as separate first-class boundaries instead of one blended implementation phase.

---

*Completed on 2026-04-16*