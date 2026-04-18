# V3 Traits Proposal Runtime / Implementation Red-Team Critique

**Date:** 2026-04-16  
**Reviewer:** coder / runtime-seam red-team for bead `ee-3dna`  
**Primary target:** `.plans/2026-04-16-v3-traits-implementation-proposal-and-red-team-review.md`

---

## Verdict

**Directionally correct, but not implementation-ready as written.**

The current proposal has the right high-level phases, but it underspecifies the riskiest runtime seams:

1. the transition from the repo's current Phase 1 `dialogue-data.json` contract to the locked v3 source-truth + grouping split,
2. the deterministic definition of `group_value` / `canonical_traits`,
3. the action-order/state-machine semantics for blockers, ambiguity, abstention, create-vs-reuse, and cleanup,
4. the benchmark/comparator migration needed before a cod-test run can honestly validate the new seam.

If implementation starts from the proposal exactly as written, the likely failure mode is not "bad scoring weights". It is **runtime seam churn**: parser work spreads into a generic mini-language, group state becomes implicit, downstream consumers silently break on removed fields, and cod-test results become hard to interpret because the benchmark machinery still expects the old artifact shape.

---

## What the proposal gets right

- It keeps the work bounded to the first vertical slice instead of jumping to product-scale rollout.
- It correctly calls out parser/schema drift, blocker over/under-fire, sentinel mishandling, and benchmark honesty as major risks.
- It keeps automatic split behavior deferred, which is the right restraint for now.
- It recognizes that fixture-level verification should happen before cod-test.

Those are all good instincts. The problem is that the proposal still skips several runtime seams that have to be made explicit before implementation is safe.

---

## Findings

### 1. The parser seam is larger than the proposal admits

Phase A says:

- validate the v3 source-truth envelope,
- validate the heuristics YAML,
- parse the predicate vocabulary into typed runtime structures.

That sounds small, but the YAML is not one simple schema. It contains **multiple distinct rule families**, each with a different execution shape:

- compatibility contract / ownership constraints
- field scoring policies
- sentinel policy
- reliability policy
- positive evidence rules
- negative evidence rules
- blocker rules
- ambiguity policy
- thresholds
- tie breakers
- cleanup policy
- warning-level guardrails
- explainability requirements

Within those sections, the current ruleset already uses multiple condition shapes, for example:

- scalar equality: `line_value`, `group_value`
- membership: `line_value_in`, `group_value_in`
- exclusion: `line_value_not_in`, `group_value_not_in`, `neither_value_in`
- boolean gates: `clean_reuse_gate`, `both_values_concrete`, `values_must_differ`
- counted conditions: `additional_stable_identity_mismatches_at_least`, `contradictory_exact_mismatches_at_least`, `matched_concrete_stable_identity_fields_below`
- cross-field predicates: `line_accent_strength_must_be`, `group_accent_strength_must_be`
- action-context predicates: `action_under_consideration: create_group`

That is already enough surface area to accidentally grow a hidden generic DSL.

### Why this matters

If implementation builds a generic "evaluate arbitrary YAML conditions" engine, coder work will get slower and more dangerous with every rule tweak. The safer posture is:

- **treat each ruleset section as its own small typed contract**, not one shared interpreter,
- reject unknown keys at load time,
- compile the YAML into explicit runtime objects/functions once,
- keep the runtime evaluator exhaustive and boring.

### Concrete critique

The proposal should explicitly say **no generic rules interpreter**. Otherwise "parse the YAML into typed runtime structures" is too loose and invites mini-language creep.

---

### 2. The proposal is missing the hardest transition seam: the repo still runs on the old dialogue artifact shape

The plan talks as if implementation begins at the v3 parser/scorer boundary. In the actual repo, the current Phase 1 dialogue lane is still built around the older contract shape.

Concrete evidence in current code:

- `server/lib/structured-output.cjs` validates and normalizes `dialogue_segments[*]` with `speaker`, optional `speaker_id`, optional `start/end`, and required `confidence`, plus top-level `speaker_profiles`, `handoffContext`, `totalDuration`, etc.
- `server/lib/phase1-validator-tools.cjs` examples/prompts still teach the model to emit `speaker_id`, `speaker_profiles`, timestamps, and `handoffContext`.
- `server/scripts/get-context/get-dialogue.cjs` prompt text and continuity instructions are still explicitly centered on speaker-id reuse and speaker-profile generation.
- `server/lib/benchmark-runner.cjs` uses `dialogue-default` time-aware alignment on `dialogue_segments` and the cod-test truth fixture still contains `start`, `end`, `speaker`, `speaker_id`, and `speaker_profiles`.
- `server/scripts/process/whole-video-mimo.cjs` formats dialogue context using timing + `speaker` labels.

### Why this matters

The locked v3 source-truth posture says persisted `dialogue-data.json` forbids:

- `speaker_id`
- speaker/group ownership fields
- `handoffContext`
- per-line `start` / `end`

That is not just a new validator. It is a **repo-wide contract migration seam**.

### Concrete critique

The proposal needs an explicit answer to this question before coding starts:

> For the first vertical slice, is the system replacing the current Phase 1 `dialogue-data.json` in place, or adding a derived v3-normalized artifact alongside the current raw/transitional one?

Right now that is unspecified, and it is the biggest implementation-risk hole in the proposal.

### Safer posture

For the first slice, the lower-risk move is:

1. keep the current raw dialogue extraction artifact path alive,
2. add a **strict normalization / projection step** that emits the locked v3 source-truth envelope,
3. run deterministic grouping from that normalized artifact,
4. migrate benchmark/comparator/downstream consumers only after the normalized artifact and grouping output are stable.

That avoids trying to rewrite producer, scorer, benchmark harness, and downstream prompt consumers in one pass.

---

### 3. The proposal skips the `group_value` / `canonical_traits` seam entirely

The ruleset repeatedly compares `line_value` to `group_value`, and the ownership section says grouping owns `canonical_traits`.

But the proposal never names the runtime component that makes `group_value` exist.

That is not a detail. It is a core deterministic seam.

### Missing questions the proposal does not answer

- How is a candidate group's canonical trait state derived from its assigned lines?
- When lines disagree, does the group state hold a single concrete value, a sentinel, a distribution, or both?
- When does a group become `mixed` or `variable` vs staying concrete with lower confidence?
- Are `group_value`s computed from all assigned lines, only confident lines, only recent lines, or a reduced subset?
- How are blocker-support counters such as `additional_stable_identity_mismatches_at_least` computed against group state?
- How does the singleton merge pass consume the same canonical state without drifting from initial assignment behavior?

### Why this matters

If canonical group state is implicit or ad hoc, then the scorer is not actually deterministic in the sense the design wants. Two coders can implement the same YAML and get materially different behavior depending on how they summarize a group's prior evidence.

### Concrete critique

The proposal needs a dedicated seam, probably before scorer implementation:

- **group state reducer / canonical-traits builder**
- pure, deterministic, snapshot-testable
- shared by assignment scoring and cleanup/merge logic

Without that seam, the current phase list is missing a major work item.

---

### 4. Blocker and action sequencing are still underspecified

Phase B says to implement deterministic candidate-group scoring and conservative blocker behavior. That is necessary but not sufficient.

The current ruleset implies a full action state machine, and the proposal does not lock the order.

### Sequencing questions that are still open

- Is `clean_reuse_gate` computed once per line, once per line/group comparison, or both?
- Are hard blockers checked before scoring, during scoring, or after raw score accumulation?
- Does a soft-review blocker eliminate a candidate, lower its score, force ambiguity, or force "create/review"?
- When gating is degraded and blockers are suppressed, does the system still record latent blocker evidence in the ledger?
- Is `create_group` scored as a synthetic candidate alongside reuse candidates, or only considered after all reuse candidates fail thresholds?
- In ambiguity handling, what happens first: top-score threshold, reuse threshold, ambiguity-margin check, abstention-review rule, or degraded-prefer-new-group rule?
- When exactly does `cleanup_policy.enable_singleton_merge_pass: true` run relative to the first-pass assignments?

### Why this matters

This is the kind of ambiguity that makes "the scorer mostly works" but leaves edge cases impossible to debug because everyone thought a different ordering was intended.

### Concrete critique

The proposal should not say only "implement scorer + blockers". It should require a written **decision-order truth table / state machine** before or during implementation.

---

### 5. Explainability is placed too late in the sequence

The proposal currently places the ledger after the scoring seam:

- Phase B — scorer
- Phase C — ledger

That is the wrong order for this kind of work.

### Why this matters

The hardest bugs in this seam will be:

- why a blocker did or did not fire,
- why a degraded line reused anyway,
- why `unknown` / `mixed` / `variable` did not abstain the way expected,
- why a runner-up was close,
- why a later singleton merge changed the outcome.

If the scorer is implemented first and the ledger is added later, early debugging will happen through ad hoc `console.log` output and coder memory. That is exactly what the design is trying to avoid.

### Concrete critique

The ledger should be implemented as **first-class trace plumbing inside the scorer from day one**, even if the earliest version is not yet final-form output.

A better posture is:

- field comparator returns both relation + trace data,
- blocker evaluator returns rule hits + suppressed hits,
- scorer accumulates score deltas with provenance,
- action resolver emits chosen action + rejected alternatives,
- final ledger serialization is just formatting a trace object that already exists.

---

### 6. The proposal quietly omits singleton merge even though the ruleset enables it

The plan explicitly says to defer automatic split behavior. Good.

But the current ruleset also says:

- `cleanup_policy.enable_singleton_merge_pass: true`

The proposal does not explicitly account for that work.

### Why this matters

That creates a dangerous mismatch:

- either the first implementation skips singleton merge and silently diverges from the current ruleset,
- or the coder implements it opportunistically late in the slice, which is exactly when hidden state bugs show up.

### Concrete critique

The proposal should explicitly choose one of these:

1. **implement singleton merge in the first vertical slice**, with its own tests and ledger output, or
2. **defer singleton merge and revise the ruleset/contract accordingly before implementation**.

Right now the plan leaves that choice implicit, which is risky.

---

### 7. The current validation plan is not strong enough for parser and seam failures

Phase D fixture coverage is directionally good, but too narrow for the actual risks.

The listed fixtures exercise behavioral cases. They do **not** fully cover:

- unknown/extra predicate keys in YAML sections
- unsupported condition-shape combinations
- group-state reduction edge cases
- transition-artifact failure cases against existing repo consumers
- benchmark migration failures caused by missing timing/speaker fields
- exact ledger-shape regressions

### What is missing

#### Parser/load validation

Need explicit failure tests for:

- unknown top-level ruleset keys that should hard-fail load
- unknown predicate keys inside `blocker_policy.rules`
- wrong scalar-vs-array types
- field-policy keys that reference unsupported field names
- impossible enum references

#### Group-state validation

Need goldens for:

- group canonicalization after clean agreement
- group canonicalization after mixed evidence
- sentinel propagation into group state
- repeated-support bonus against stable vs unstable group states

#### Action-order validation

Need goldens for:

- hard blocker suppressed by degraded gating
- soft-review blocker recorded but candidate still compared
- top candidate below threshold vs top candidate above threshold but too-close margin
- abstention-review behavior when concrete stable matches are too sparse
- singleton merge after initial one-line groups

#### Transition-seam validation

Need tests proving what happens when legacy consumers receive v3-shaped data or when the v3 projection step strips legacy fields.

#### Benchmark validation

Need tests proving cod-test comparison still works honestly once source truth no longer carries `start/end/speaker/speaker_id`.

---

### 8. The cod-test phase is currently sequenced too early relative to benchmark migration

Phase E says:

- run the current vertical-slice lane in the existing Phase 1 architecture,
- compare outputs against cod-test benchmark truth and targeted eval expectations.

That sounds clean, but the current benchmark machinery still assumes the old artifact shape.

Concrete evidence:

- the cod-test truth fixture still includes legacy segment timing and speaker fields,
- `benchmark-runner.cjs` aligns `dialogue_segments` with a time-aware comparator,
- speaker-profile comparison logic still exists and ignores `speaker_id`/`label` only after old-shape alignment.

### Why this matters

If the new vertical slice reaches cod-test before the benchmark harness knows how to compare the new source-truth/grouping split, a failed run will be ambiguous:

- was the scorer wrong?
- was the new source-truth projection wrong?
- did the benchmark fail because the artifact contract changed?
- did a downstream consumer reconstruct comparison data incorrectly?

### Concrete critique

The cod-test run should happen **after** there is an explicit benchmark migration strategy. Otherwise the benchmark is not a truth check; it is just another moving part.

---

## Recommended implementation order

A cleaner order would be:

### 0. Lock the transition strategy before writing scorer code

Decide and document:

- whether the first slice introduces a derived v3-normalized artifact alongside the current raw artifact,
- how existing consumers keep working during the transition,
- how cod-test truth comparison will map old-vs-new artifact ownership.

Do not bury this inside implementation.

### 1. Implement a strict v3 artifact validator + normalizer boundary

Build a dedicated boundary for the locked v3 source-truth envelope:

- reject forbidden source-owned fields,
- enforce the closed `traits` object,
- reject old stored-v2 names,
- keep failure messages precise and contract-oriented.

This should be separate from the YAML scorer contract.

### 2. Implement a strict ruleset loader/compiler, not a generic YAML evaluator

Compile the ruleset into typed runtime structures with:

- exhaustive known-key validation,
- section-specific parsers,
- zero tolerance for unknown predicate vocabulary,
- isolated tests for every current predicate/operator family.

### 3. Implement the group-state reducer / canonical-traits builder

Before the full scorer exists, make `group_value` deterministic.

This module should own:

- canonical trait derivation,
- sentinel handling in group state,
- support counters used by blocker rules,
- reusable state snapshots for ledger/debug output.

### 4. Implement comparison + scoring + tracing together

Field comparators, blocker evaluation, score accumulation, and trace capture should be built in one pass so debugging is possible from the start.

### 5. Implement the action resolver as an explicit state machine

Lock the decision order for:

- blocker elimination/suppression,
- threshold checks,
- ambiguity handling,
- abstention-review,
- create-vs-reuse selection,
- cleanup/singleton merge.

### 6. Add fixture goldens before cod-test

Not just behavioral fixtures, but:

- load/validation failure fixtures,
- group canonicalization goldens,
- ledger snapshot goldens,
- legacy-transition tests,
- benchmark-migration tests.

### 7. Only then wire the cod-test vertical slice

At that point, failures are interpretable.

---

## Specific proposal changes I would make

1. **Add a new explicit phase before the current Phase A:**
   - `Transition seam / artifact strategy`
   - define raw artifact vs normalized v3 artifact vs grouping artifact ownership for the first slice.

2. **Split current Phase A into two separate seams:**
   - v3 source-truth validator/normalizer
   - YAML ruleset loader/compiler

3. **Add a new phase before scoring:**
   - `Canonical group-state reducer`

4. **Merge current Phase B and Phase C conceptually:**
   - scorer, blockers, and ledger trace should land together

5. **Make singleton merge explicit:**
   - either implement it in-slice or formally defer it by contract change

6. **Delay cod-test until benchmark/comparator migration is named and tested**

---

## Bottom line

The proposal is close in spirit, but still too optimistic at the runtime seam level.

The biggest missing pieces are not small implementation details. They are the exact seams that decide whether the first coder can land this cleanly:

- transition strategy from the old dialogue artifact to the v3 source-truth/grouping split,
- deterministic group canonicalization,
- explicit action-order semantics,
- benchmark migration before cod-test,
- ledger-first instrumentation rather than scorer-first instrumentation.

**Recommendation:** revise the proposal before implementation begins. Keep the vertical-slice scope, but make the transition seam, canonical-group seam, action-state-machine seam, and benchmark migration seam explicit first.
