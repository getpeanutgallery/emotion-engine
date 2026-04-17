# Emotion Engine

**Date:** 2026-04-16  
**Status:** In Progress  
**Agent:** Cookie 🍪

---

## Goal

Execute bead `ee-gqnc` as a bounded first vertical slice: implement the strict v3 dialogue source-truth boundary, implement deterministic speaker grouping as a separate post-pass that emits a runtime `speaker-grouping` artifact, validate it against golden benchmark `speaker-grouping` truth for `cod-test`, and use that evidence to decide whether the one-pass architecture is good enough or where the first split should happen.

---

## Overview

The design side is now strong enough to stop iterating on schema philosophy and start landing code. The approved execution posture is:
- keep the current `cod-test` YAML config as a durable execution anchor
- keep the golden benchmark truth as the durable truth anchor
- build the runtime `speaker-grouping` artifact as the new deterministic seam
- compare runtime grouping against golden benchmark grouping truth directly
- treat legacy compatibility help as disposable if needed, not something to preserve

This plan keeps the first slice intentionally narrow. We are not building a generalized rules engine, not turning on singleton merge, not adding specialist passes, and not doing broad benchmark-system migration. We are proving one clean seam: `dialogue-data` source truth -> deterministic grouping -> `speaker-grouping` benchmark comparison.

The execution order is strict. First lock the transition/runtime note and the benchmark truth surface. Then implement validators/loaders before scorer logic. Then land the reducer/scorer/ledger as one coherent deterministic unit. Then prove the behavior on deterministic fixtures and targeted eval gates. Only then run the first real cod-test interpretation and audit the miss clusters.

---

## REFERENCES

| ID | Description | Path |
| --- | --- | --- |
| `REF-01` | High-level execution epic | `ee-gqnc` |
| `REF-02` | Review-ready execution proposal | `.plans/2026-04-16-v3-traits-implementation-proposal-and-red-team-review.md` |
| `REF-03` | Existing vertical-slice plan | `.plans/2026-04-15-implement-dialogue-traits-v2-and-run-cod-test-vertical-slice.md` |
| `REF-04` | v3 heuristics ruleset | `docs/2026-04-16-dialogue-traits-v3-speaker-grouping-heuristics-ruleset.yaml` |
| `REF-05` | v3 heuristics contract summary | `docs/2026-04-16-dialogue-traits-v3-speaker-grouping-heuristics-contract.md` |
| `REF-06` | phonation normalization audit follow-up | `docs/2026-04-16-dialogue-traits-v3-speaker-grouping-heuristics-audit-followup-phonation-normalization.md` |
| `REF-07` | v2 maximalist traits contract | `docs/2026-04-15-dialogue-traits-maximalist-contract-vnext-v2.md` |
| `REF-08` | targeted eval slice | `docs/2026-04-15-dialogue-traits-v2-targeted-eval-slice.md` |
| `REF-09` | calibration artifact | `docs/2026-04-15-dialogue-traits-v2-calibration-artifact.md` |
| `REF-10` | cod-test config / benchmark truth anchor | `configs/*cod-test*.yaml`, `benchmarks/fixtures/cod-test/` |
| `REF-11` | current-session approval to target golden `speaker-grouping` truth directly | current session |

---

## Tasks

### Task 1: Lock the first-slice transition/runtime note and golden `speaker-grouping` truth target

**Bead ID:** `ee-v5i4`  
**SubAgent:** `primary`  
**References:** `REF-02`, `REF-03`, `REF-10`, `REF-11`  
**Prompt:** In `projects/peanut-gallery/emotion-engine`, write the short implementation note that locks the first-slice transition posture before code work expands. It must answer: what exact current `cod-test` YAML config is the execution anchor; what golden `speaker-grouping` truth artifact or truth projection is the primary benchmark target; whether any disposable compatibility bridge is needed; and what artifact/reporting surface is primary for approval. Keep it short and operational, not philosophical.

**Folders Created/Deleted/Modified:**
- `docs/`
- `.plans/`

**Files Created/Deleted/Modified:**
- `docs/2026-04-16-cod-test-speaker-grouping-first-slice-anchor-note.md`
- `.plans/2026-04-16-ee-gqnc-v3-traits-execution-plan.md`

**Status:** ✅ Complete

**Results:** Wrote `docs/2026-04-16-cod-test-speaker-grouping-first-slice-anchor-note.md` to lock the first-slice execution posture before runtime code expands. Actual findings recorded there: the durable cod-test execution anchor is `configs/cod-test.yaml`, linked through `benchmarks/fixtures/cod-test/fixture.json` to `benchmarks/fixtures/cod-test/benchmark.json`; the current golden grouping truth anchor is not yet a dedicated `truth/speaker-grouping.json` file but the existing human-reviewed `benchmarks/fixtures/cod-test/truth/dialogue-data.json`, specifically projected from `dialogue_segments[*].index`, `dialogue_segments[*].speaker_id`, `speaker_profiles[*].speaker_id`, and `speaker_profiles[*].grounded.linked_segment_indexes`; any first-slice compatibility help should be a minimal disposable benchmark-side truth projection only, not a runtime preservation lane; and the primary approval surface is the artifact-level runtime `speaker-grouping` vs golden grouping comparator result, with roll-up benchmark summaries treated as secondary.

---

### Task 2: Implement strict v3 source-truth validation for `dialogue-data`

**Bead ID:** `ee-okba`  
**SubAgent:** `coder`  
**References:** `REF-02`, `REF-05`, `REF-07`, `REF-10`  
**Prompt:** Implement the strict validator for the authoritative v3 `dialogue-data` source-truth artifact. Enforce required top-level fields, required segment fields, closed `traits`, forbidden source-owned fields, and rejection of superseded normative names unless a named disposable adapter path is explicitly in play. This validator must not know grouping semantics or load the YAML ruleset.

**Folders Created/Deleted/Modified:**
- `server/`
- `tests/` or repo-appropriate fixture/test paths
- `.plans/`

**Files Created/Deleted/Modified:**
- validator code/tests at repo-appropriate paths
- `.plans/2026-04-16-ee-gqnc-v3-traits-execution-plan.md`

**Status:** ✅ Complete

**Results:** Added `server/lib/dialogue-v3-source-truth-validator.cjs` plus `test/lib/dialogue-v3-source-truth-validator.test.js` as the dedicated strict validator seam for the authoritative v3 `dialogue-data` artifact. The implementation hard-locks the allowed top-level, contract, segment, and `traits` fields; enforces all required v3 fields and closed trait enums; rejects forbidden source-owned leakage such as `handoffContext`, `speaker_profiles`, timing, speaker/group identifiers, notes, and related runtime/grouping fields; and surfaces targeted supersession errors for stored-v2 trait names (`channel_texture`, `delivery_stance`) unless the explicitly named disposable adapter path `v2-superseded-trait-names-bridge` is enabled. It also rejects known superseded stored-v2 enum values with targeted diagnostics while staying fully isolated from grouping semantics and the YAML ruleset. Validation run in this task: focused unit suite `node --test test/lib/dialogue-v3-source-truth-validator.test.js` passed; broad repo suite `npm test` still shows pre-existing unrelated failures in benchmark/config/report/script/get-dialogue tests that are outside this validator change.

---

### Task 3: Implement the fail-closed ruleset loader/compiler for the v3 YAML

**Bead ID:** `ee-o1b1`  
**SubAgent:** `coder`  
**References:** `REF-04`, `REF-05`, `REF-06`  
**Prompt:** Implement the bounded loader/compiler for the v3 heuristics YAML. Fail closed on unknown keys, unsupported predicate shapes, bad enum references, and wrong scalar/array types. Support only the allowlisted predicate vocabulary currently required by the locked ruleset, including scalar equality keys and membership/exclusion keys. Do not build a generalized rules engine.

**Folders Created/Deleted/Modified:**
- `server/`
- `tests/` or repo-appropriate fixture/test paths
- `.plans/`

**Files Created/Deleted/Modified:**
- loader/compiler code/tests at repo-appropriate paths
- `.plans/2026-04-16-ee-gqnc-v3-traits-execution-plan.md`

**Status:** ✅ Complete

**Results:** Added `server/lib/dialogue-v3-heuristics-ruleset.cjs` plus `test/lib/dialogue-v3-heuristics-ruleset.test.js` as the bounded, fail-closed YAML ruleset loader/compiler seam for the locked v3 speaker-grouping heuristics contract. The implementation parses the review-ready YAML, validates it section-by-section with closed-key allowlists, and compiles only the currently required predicate vocabulary into typed runtime structures: scalar equality (`line_value`, `group_value`), membership/exclusion (`*_in`, `*_not_in`, `neither_value_in`), and the bounded boolean/numeric gate keys already present in the locked ruleset. It fails closed on unknown keys, unsupported predicate shapes, bad bucket/field/severity/level references, bad trait-enum references, and scalar-vs-array type mismatches, while explicitly avoiding a generalized rules engine. Validation run in this task: focused suites `node --test test/lib/dialogue-v3-heuristics-ruleset.test.js` and `node --test test/lib/dialogue-v3-source-truth-validator.test.js test/lib/dialogue-v3-heuristics-ruleset.test.js` passed. Broad repo suite `npm test` still reports pre-existing unrelated failures in benchmark-iteration-runner, report-package smoke, script-runner AI recovery, config-loader single-document YAML loading, and get-dialogue prompt/chunking tests that are outside this ruleset-loader change.

---

### Task 4: Implement the canonical group-state reducer and `speaker-grouping` artifact seam

**Bead ID:** `ee-qx33`  
**SubAgent:** `coder`  
**References:** `REF-02`, `REF-04`, `REF-05`, `REF-11`  
**Prompt:** Implement the deterministic canonical group-state reducer that owns per-group support state and derives `canonical_traits`. Define pre-update candidate snapshots clearly. Implement the derived runtime `speaker-grouping` artifact seam so grouping outputs, assignments, ambiguity fields, canonical traits, and metadata live outside source truth. Keep singleton merge deferred for the first slice.

**Folders Created/Deleted/Modified:**
- `server/`
- `test/`
- `.plans/`

**Files Created/Deleted/Modified:**
- `server/lib/dialogue-v3-speaker-grouping.cjs`
- `test/lib/dialogue-v3-speaker-grouping.test.js`
- `.plans/2026-04-16-ee-gqnc-v3-traits-execution-plan.md`

**Status:** ✅ Complete

**Results:** Added `server/lib/dialogue-v3-speaker-grouping.cjs` plus `test/lib/dialogue-v3-speaker-grouping.test.js` as the bounded reducer/artifact seam for first-slice deterministic grouping. The reducer now owns per-group support state (`support.trait_value_counts`), derives stable `canonical_traits` deterministically from accumulated evidence, exposes immutable serializable `pre_update` candidate snapshots for scorer consumption, and writes all grouping-owned state to a separate `speaker-grouping` artifact skeleton with source/ruleset metadata, assignments, ambiguity fields, summary counts, and deferred cleanup posture. Singleton merge and split execution remain explicitly deferred in artifact metadata for the first slice, and source truth stays untouched. Validation run in this task: focused suites `node --test test/lib/dialogue-v3-speaker-grouping.test.js test/lib/dialogue-v3-source-truth-validator.test.js test/lib/dialogue-v3-heuristics-ruleset.test.js` passed; broad repo suite `npm test` still reports pre-existing unrelated failures in benchmark-iteration-runner, report-package smoke, script-runner AI recovery, config-loader single-document YAML loading, and get-dialogue prompt/chunking tests that are outside this reducer/artifact change.

---

### Task 5: Implement scorer, blockers, action resolver, and decision ledger together

**Bead ID:** `ee-vi2m`  
**SubAgent:** `coder`  
**References:** `REF-04`, `REF-05`, `REF-06`, `REF-11`  
**Prompt:** Implement the deterministic scorer as one coherent unit with blocker evaluation, ambiguity handling, explicit create-vs-reuse action resolution, and decision-ledger/tracing output. Respect the normalized simple phonation posture exactly: strong phonation scoring, whispered-vs-nonwhispered as the only explicit phonation blocker posture, no field-local phonation blocker revival. Do not execute singleton merge in the first slice even if the YAML exposes it.

**Folders Created/Deleted/Modified:**
- `server/`
- `tests/` or repo-appropriate fixture/test paths
- `.plans/`

**Files Created/Deleted/Modified:**
- scorer/action/ledger code/tests at repo-appropriate paths
- `.plans/2026-04-16-ee-gqnc-v3-traits-execution-plan.md`

**Status:** ✅ Complete

**Results:** Expanded `server/lib/dialogue-v3-speaker-grouping.cjs` from a reducer-only seam into the first deterministic scorer implementation. The runtime now evaluates bounded per-field scoring against canonical group snapshots, applies explicit blocker evaluation with triggered-vs-suppressed tracking, resolves `create_group` vs `reuse_group` vs `ambiguous_reuse` deterministically, and writes first-class per-assignment decision-ledger rows alongside artifact assignments. The phonation posture stays normalized exactly as approved: phonation remains strong scoring evidence, the only explicit phonation blocker behavior is the whispered-vs-nonwhispered soft-review guard from the normalized ruleset, and no field-local phonation blocker path was revived. Singleton merge also remains explicitly unexecuted in the first slice even though the YAML exposes it. Updated `test/lib/dialogue-v3-speaker-grouping.test.js` to cover scorer reuse, clean hard-block create decisions, normalized phonation blocker behavior, degraded-gating blocker suppression, ambiguity resolution, deterministic fallback-to-create, ledger emission, and end-to-end ordered grouping runs. Validation run in this task: focused suites `node --test test/lib/dialogue-v3-speaker-grouping.test.js test/lib/dialogue-v3-source-truth-validator.test.js test/lib/dialogue-v3-heuristics-ruleset.test.js` passed. Broad repo suite `npm test` still reports pre-existing unrelated failures in benchmark-iteration-runner, report-package smoke, script-runner AI recovery, config-loader single-document YAML loading, and get-dialogue prompt/chunking tests that are outside this scorer/ledger change.

---

### Task 6: Build deterministic proof gates and golden `speaker-grouping` comparison fixtures

**Bead ID:** `ee-evxb`  
**SubAgent:** `qa`  
**References:** `REF-02`, `REF-08`, `REF-09`, `REF-10`, `REF-11`  
**Prompt:** Build and/or formalize the deterministic proof gates required before the first real cod-test interpretation. This includes rejection fixtures for source-truth validation, rejection fixtures for the ruleset loader/compiler, micro-fixtures for reducer/scorer/ledger behavior, and the golden `speaker-grouping` benchmark truth surface or comparator-ready truth projection for `cod-test`. Define the exact evidence bundle that must exist before the first real run is trusted.

**Folders Created/Deleted/Modified:**
- `benchmarks/`
- `tests/` or repo-appropriate fixture/test paths
- `docs/`
- `.plans/`

**Files Created/Deleted/Modified:**
- golden truth/comparator fixtures/docs at repo-appropriate paths
- deterministic gate tests/docs
- `.plans/2026-04-16-ee-gqnc-v3-traits-execution-plan.md`

**Status:** ⏳ Pending

**Results:** Pending.

---

### Task 7: Run targeted deterministic gates and a dialogue-focused cod-test structural sanity pass

**Bead ID:** `ee-ke8y`  
**SubAgent:** `qa`  
**References:** `REF-08`, `REF-09`, `REF-10`, `REF-11`  
**Prompt:** Execute the deterministic gates once the validator/loader/reducer/scorer/ledger seams are implemented. Require green rejection fixtures, green micro-fixtures, targeted expressive evaluation reruns, and a dialogue-focused cod-test structural sanity run with no structural benchmark errors before the first semantic interpretation of the full slice.

**Folders Created/Deleted/Modified:**
- output/`
- `.logs/`
- `docs/`
- `.plans/`

**Files Created/Deleted/Modified:**
- gate results / notes / run artifacts at repo-appropriate paths
- `.plans/2026-04-16-ee-gqnc-v3-traits-execution-plan.md`

**Status:** ⏳ Pending

**Results:** Pending.

---

### Task 8: Run the first real cod-test vertical slice and compare runtime `speaker-grouping` vs golden truth

**Bead ID:** `ee-x7l5`  
**SubAgent:** `qa`  
**References:** `REF-08`, `REF-09`, `REF-10`, `REF-11`  
**Prompt:** Run the current cod-test YAML config only after the proof gates are green. Produce the validated v3 source-truth artifact, the runtime `speaker-grouping` artifact, the decision ledger, and the comparator outputs against golden `speaker-grouping` truth. Record evidence with exact config/model/ruleset/build identifiers and classify misses by source rather than collapsing them into one headline.

**Folders Created/Deleted/Modified:**
- `output/`
- `.logs/`
- `docs/`
- `.plans/`

**Files Created/Deleted/Modified:**
- run artifacts/comparison notes at repo-appropriate paths
- `.plans/2026-04-16-ee-gqnc-v3-traits-execution-plan.md`

**Status:** ⏳ Pending

**Results:** Pending.

---

### Task 9: Independent audit of implementation, evidence quality, and miss-cluster interpretation

**Bead ID:** `ee-ns9e`  
**SubAgent:** `auditor`  
**References:** `REF-02`, `REF-04`, `REF-05`, `REF-08`, `REF-09`, `REF-10`, `REF-11`  
**Prompt:** Audit the first execution slice independently. Verify the ownership split is preserved, the artifacts match the approved seams, the deterministic proof gates were actually satisfied, and the cod-test comparison is being interpreted honestly. Classify the miss clusters into source-truth extraction/input issues, validator/normalization bugs, grouping reducer/scorer bugs, comparator/reporting bugs, and benchmark-truth gaps or migration issues. Decide whether the lane is genuinely ready for split/no-split recommendation.

**Folders Created/Deleted/Modified:**
- `docs/`
- `.plans/`

**Files Created/Deleted/Modified:**
- audit note(s) under `docs/`
- `.plans/2026-04-16-ee-gqnc-v3-traits-execution-plan.md`

**Status:** ⏳ Pending

**Results:** Pending.

---

### Task 10: Update the living plan with final outcome and recommend the next architectural move

**Bead ID:** `ee-1o5b`  
**SubAgent:** `primary`  
**References:** `REF-02`, `REF-03`, `REF-08`, `REF-09`, `REF-10`, `REF-11`  
**Prompt:** Update this plan after implementation, gates, cod-test comparison, and audit are complete. Record what was built, what proved true, what failed, where misses cluster, and whether the correct next move is keep one-pass for now, split emotion/pragmatics first, split accent first, or fix a more basic source-truth/grouping seam bug before any split decision.

**Folders Created/Deleted/Modified:**
- `.plans/`

**Files Created/Deleted/Modified:**
- `.plans/2026-04-16-ee-gqnc-v3-traits-execution-plan.md`

**Status:** ⏳ Pending

**Results:** Pending.

---

## Final Results

**Status:** ⏳ Pending

**What We Built:** Pending.

**Reference Check:** Pending.

**Commits:**
- Pending.

**Lessons Learned:** Pending.

---

*Drafted on 2026-04-16*
