# V3 Traits Implementation Proposal — Architecture Red-Team Critique

**Date:** 2026-04-16  
**Auditor lens:** architecture / cohesion / ownership boundaries  
**Primary proposal under review:** `.plans/2026-04-16-v3-traits-implementation-proposal-and-red-team-review.md`

---

## Verdict

**Directionally correct, but not yet execution-clean.**

The proposal is aiming at the right seam — a deterministic grouping post-pass over the locked v3 traits envelope — but it currently bundles too many responsibilities into one implementation lane and leaves several architecture-critical handoffs implicit. As written, it risks producing:

1. a source-truth validator that knows too much about downstream grouping,
2. a mini rules engine instead of a bounded ruleset interpreter,
3. a scorer whose mutable group state is under-specified,
4. a cod-test run that cannot cleanly separate extraction misses from grouping misses.

My recommendation is **revise before implementation**. Keep the overall direction, but tighten the artifact boundaries, add the missing reducer/output seams, and explicitly defer the extra cleanup/runtime behaviors that would otherwise sneak into the first vertical slice.

---

## References reviewed

- `.plans/2026-04-16-v3-traits-implementation-proposal-and-red-team-review.md`
- `.plans/2026-04-15-implement-dialogue-traits-v2-and-run-cod-test-vertical-slice.md`
- `docs/2026-04-16-dialogue-traits-v3-speaker-grouping-heuristics-ruleset.yaml`
- `docs/2026-04-16-dialogue-traits-v3-speaker-grouping-heuristics-contract.md`
- `docs/2026-04-16-dialogue-traits-v3-speaker-grouping-heuristics-audit-followup-phonation-normalization.md`
- `docs/2026-04-15-dialogue-traits-pass-ownership-architecture-v2.md`

---

## What the proposal gets right

- It keeps the main goal bounded to the first `cod-test` vertical slice instead of a product-wide rollout.
- It correctly treats the v3 traits artifact as the locked source-truth input and the grouping layer as the first owner of `speaker_id`.
- It correctly preserves the current posture that `unknown` / `mixed` / `variable` are first-class states rather than hidden concrete labels.
- It correctly defers automatic split behavior.
- It correctly treats explainability as part of the contract, not an optional debug luxury.

Those are the right instincts. The problems are in the seams.

---

## Critical architecture issues

### 1. The proposal quietly couples source-truth validation to downstream grouping validation

### Why this is a problem

Phase A currently says both:

- enforce the locked v3 source-truth envelope on persisted `dialogue-data.json`, and
- add compatibility validation for the heuristics YAML ruleset.

Those are not the same architectural responsibility.

The ruleset contract says `dialogue-data` owns source truth and grouping owns derived outputs. If the dialogue artifact validator has to know whether a particular heuristics YAML is valid, the source-truth layer is now downstream-aware. That weakens the core split the package has been trying to establish.

### Why this matters against the references

- The ruleset explicitly says `source_truth_artifact: dialogue-data` and `grouping_output_artifact: speaker-grouping`.
- The pass-ownership architecture note argues against premature topology sprawl and against moving ownership around casually.
- The 2026-04-15 vertical-slice plan explicitly says to keep the architecture otherwise intact.

### Concrete change

Split validation into two separate gates:

1. **Dialogue artifact validation gate**
   - validates only the persisted v3 `dialogue-data` source-truth envelope
   - rejects forbidden source-truth fields and superseded normative names
   - does **not** load or care about a grouping ruleset

2. **Grouping entrypoint validation gate**
   - validates the YAML ruleset shape/version
   - validates compatibility between the loaded ruleset and the input artifact metadata
   - refuses to run if either side is incompatible

That keeps the source-truth vs grouping split real instead of nominal.

---

### 2. The proposal is missing an explicit grouping output artifact seam

### Why this is a problem

The proposal talks about parser, scorer, and ledger behavior, but it never clearly says what artifact gets written, where the decision ledger lives, or how the grouping output is versioned relative to the source-truth artifact.

Without that seam, implementers are likely to either:

- mutate `dialogue-data.json` with grouping outputs, or
- smuggle grouping/debug state into the wrong artifact surface.

That would directly undermine the source-truth vs grouping split.

### Concrete change

Add an explicit output contract section to the proposal. The first vertical slice should write a separate grouping artifact, e.g. `speaker-grouping.json`, that owns at minimum:

- grouping contract/version metadata
- source input artifact ref/version metadata
- ruleset id/version ref
- `speaker_groups`
- `assignments`
- `canonical_traits`
- decision ledger / explainability records
- ambiguity outputs

And the proposal should state plainly:

> `dialogue-data.json` is immutable source truth for this pass. Grouping outputs are written only to the derived grouping artifact.

That is the most important missing seam in the current draft.

---

### 3. The scorer seam is under-specified because group-state ownership is not defined

### Why this is a problem

The proposal says to implement candidate-group scoring and to emit a decision ledger, but it does not say how candidate groups maintain state over time.

That is not an implementation detail. It is an architecture seam.

The ruleset says grouping owns `canonical_traits`, but the proposal never defines:

- how `canonical_traits` are derived,
- whether they are recomputed from member support histograms or updated incrementally,
- when the scorer reads them,
- whether the decision ledger records the pre-update or post-update group state.

If this is left implicit, the scorer will become order-sensitive in undocumented ways and the benchmark/debug story will get muddy fast.

### Concrete change

Insert a separate seam between scoring and output:

**Group-state reducer seam**
- owns per-group support histograms / counts
- derives canonical group values deterministically from accumulated support
- exposes the candidate group snapshot that the scorer is allowed to compare against
- records whether ledger entries were captured against pre-update state

The proposal should explicitly forbid ad hoc mutable state hidden inside the scorer.

---

### 4. The YAML parser scope is still too loose and risks becoming a mini rules engine

### Why this is a problem

Phase A says to parse the YAML into typed runtime structures with support for the currently used predicate vocabulary. That sounds safe, but in practice it is exactly how teams accidentally build a general-purpose expression interpreter.

The phonation follow-up audit normalized one ambiguous blocker seam, but it also explicitly noted the parser now needs a small predicate vocabulary (`line_value`, `group_value`, membership/exclusion forms, numeric gates, etc.).

If the proposal does not freeze that boundary sharply, the first vertical slice will quietly absorb:

- open-ended predicate expansion,
- ad hoc operator handling,
- rule-evaluation complexity that belongs in a later design pass.

### Concrete change

Revise the proposal so implementation is explicitly:

1. **YAML loader** → schema validation only
2. **Ruleset normalizer/compiler** → converts allowed YAML shapes into a narrow typed internal representation
3. **Scorer** → consumes only the normalized representation, never arbitrary YAML

And add a hard rule:

> Unknown keys or unsupported predicate shapes fail closed at load time.

No expression language. No custom runtime operators. No “temporary” fallback interpretation.

---

### 5. The proposal leaves the pipeline placement ambiguous

### Why this is a problem

Phase E says to run the current vertical-slice lane in the existing Phase 1 architecture, but it does not define whether grouping is:

- inline with dialogue extraction,
- a deterministic post-pass after `dialogue-data` is finalized,
- part of benchmark comparison only,
- or mixed into an existing artifact-writing step.

That ambiguity matters because the 2026-04-15 plan and the pass-ownership note both rely on keeping topology changes bounded.

If grouping is folded into the base dialogue lane instead of running as a clearly separate post-pass, then:

- failure attribution gets worse,
- retries get muddier,
- and the source-truth/grouping split becomes harder to preserve operationally.

### Concrete change

State the runtime placement explicitly:

> For the first vertical slice, deterministic grouping runs as a separate post-pass over validated `dialogue-data`, with its own success/failure artifact surface and its own benchmark delta reporting.

That single sentence would remove a lot of downstream ambiguity.

---

### 6. The proposal under-specifies benchmark truth separation

### Why this is a problem

The plan rightly warns about benchmark dishonesty, but the current phase structure still lumps too much together at cod-test time.

If the same run both changes the source-truth validator path and adds grouping, then a bad cod-test result could come from:

- extraction differences,
- source-truth validation drift,
- grouping-rule behavior,
- group-state reducer bugs,
- or comparator assumptions.

That is too many moving parts for a first proving slice.

### Concrete change

Require the cod-test output review to report **two delta classes separately**:

1. **source-truth deltas**
   - line/trait fidelity before grouping

2. **grouping deltas**
   - reuse/create/ambiguity/speaker assignment behavior after grouping

Do not allow the first benchmark report to collapse those into one blended miss bucket.

That separation is necessary if the architecture is supposed to stay honest.

---

## Hidden scope creep to cut now

### 7. The current proposal risks implementing more than the first vertical slice actually needs

The overall shape sounds bounded, but several items together add up to a much larger implementation than the plan admits:

- strict source-truth validator changes
- full YAML compatibility layer
- typed predicate support
- deterministic scorer
- blocker engine
- decision ledger
- focused fixture suite
- cod-test run
- truth comparison classification

That is not one seam. That is a small subsystem rollout.

### Concrete change

Add explicit execution gates inside the proposal:

- **Gate 1:** source-truth validation only
- **Gate 2:** ruleset load/normalize only
- **Gate 3:** scorer + reducer + derived artifact
- **Gate 4:** focused fixture proof
- **Gate 5:** cod-test benchmark run

And add a policy line:

> cod-test does not start until Gates 1–4 are green on focused fixtures.

Without that, cod-test becomes integration debugging instead of benchmark truth checking.

---

### 8. `cleanup_policy.enable_singleton_merge_pass: true` is a hidden extra pass, and the proposal never resolves it

### Why this is a problem

The ruleset currently enables a singleton merge pass while disabling auto split. The proposal mentions deferring split behavior, but it says nothing about the cleanup merge pass.

That means an implementer could reasonably read the ruleset literally and ship:

- initial group assignment,
- then an additional cleanup merge phase,
- all inside the “first vertical slice.”

That is hidden scope creep.

It also makes debugging much harder because a bad result may have been introduced during initial assignment or during cleanup.

### Concrete change

Make an explicit first-slice decision in the proposal:

- either **defer singleton merge entirely** for the first runtime slice, or
- treat it as a separately gated subphase after the base scorer is proven.

My recommendation: **defer singleton merge for the first slice**. Prove the primary scorer first.

---

### 9. The proposal needs explicit non-goals to stay aligned with the pass-ownership architecture

The pass-ownership architecture note is clear that future split candidates exist, especially emotion/pragmatics and accent, but those are future topology decisions.

The current proposal would be stronger if it explicitly said the first slice will **not** do any of the following:

- no new emotion/pragmatics bundle
- no accent specialist pass
- no channel/context bundle
- no automatic split pass
- no generalized rule authoring system
- no migration of historical stored-v2 artifacts beyond strict rejection/compat checks

Without a non-goals list, scope will drift through “reasonable” implementation choices.

---

## Places where the proposal is too vague to execute cleanly

### 10. “Explainability ledger” is right, but the storage and consumer story is vague

Questions the proposal should answer explicitly:

- Is the ledger embedded in the grouping artifact or stored as a sibling debug artifact?
- Is there one ledger entry per segment assignment only, or also per cleanup pass action?
- Are ledger reasons contract-safe enums/keys only, or short text assembled from an allowlist?
- What exact state snapshot is logged for each candidate group?

### Concrete change

Add a short ledger contract subsection with:

- storage location
- one-record-per-assignment rule
- pre-update snapshot rule
- allowed reason vocabulary source
- whether cleanup actions are out of scope for first slice

---

### 11. The fixture plan needs architecture-shaped cases, not just behavior examples

The current fixture bullets are useful but incomplete for this seam. A first-slice fixture pack should also cover:

- hard failure on forbidden source-truth fields
- hard failure on superseded v2 normative names
- hard failure on unknown ruleset predicate keys
- sentinel handling (`unknown`, `mixed`, `variable`, `none_apparent`)
- deterministic group-state evolution across multiple lines
- ledger shape / reason-vocabulary validity
- compatibility failure when input contract version and ruleset version disagree

That is the minimum set needed to prove the architecture, not just the output examples.

---

## Recommended proposal rewrite

I would revise the implementation proposal to use this execution structure:

### Phase A — Source-truth gate only
- validate persisted v3 `dialogue-data`
- reject forbidden fields and superseded normative names
- no grouping YAML awareness here

### Phase B — Ruleset load / normalize gate
- validate YAML shape and contract compatibility
- compile allowlisted predicates into typed internal structures
- fail closed on unknown keys/operators

### Phase C — Deterministic grouping core
- line-to-group scoring
- blocker evaluation
- explicit group-state reducer
- separate derived grouping artifact output

### Phase D — Explainability contract proof
- ledger shape
- contract-safe reasons
- pre-update state snapshots
- no cleanup pass yet

### Phase E — Focused fixture matrix
- compatibility rejects
- sentinel cases
- blocker cases
- ambiguity cases
- group-state evolution cases

### Phase F — cod-test run with split reporting
- preserve artifacts
- report source-truth deltas separately from grouping deltas
- classify misses honestly

That revised structure is much closer to the architecture actually implied by the ruleset and ownership docs.

---

## Bottom line

The current proposal has the right **destination** but not yet the right **shape**.

The main things to fix before implementation are:

1. separate source-truth validation from grouping validation,
2. add an explicit derived grouping artifact contract,
3. define the group-state reducer seam,
4. narrow the YAML parser into a fail-closed normalized ruleset layer,
5. state grouping as a separate deterministic post-pass,
6. defer singleton merge for the first slice,
7. require benchmark reporting to separate source-truth deltas from grouping deltas.

If those changes land, the proposal becomes much more cohesive and far less likely to erode the source-truth vs grouping split it is supposed to protect.
