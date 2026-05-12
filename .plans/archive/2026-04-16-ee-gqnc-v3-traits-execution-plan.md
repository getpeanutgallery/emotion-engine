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
| `REF-12` | current-session clarification that raw dialogue may intentionally retain music-vocal leakage pre-reconciliation and that dialogue gold-truth refresh should be deferred until Phase 1 contracts stabilize | current session |
| `REF-13` | `ee-cmw8` investigation of remaining truthful-reuse misses | `docs/2026-04-18-dialogue-v3-ee-cmw8-reuse-miss-investigation.md` |

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
- `test/fixtures/dialogue-v3-proof-gates/`
- `test/lib/`
- `server/lib/`
- `docs/`
- `.plans/`

**Files Created/Deleted/Modified:**
- `benchmarks/fixtures/cod-test/truth/speaker-grouping.json`
- `server/lib/dialogue-v3-speaker-grouping-benchmark.cjs`
- `test/lib/dialogue-v3-proof-gates.test.js`
- `test/fixtures/dialogue-v3-proof-gates/source-truth/valid-dialogue-data.json`
- `test/fixtures/dialogue-v3-proof-gates/source-truth/reject-forbidden-fields.json`
- `test/fixtures/dialogue-v3-proof-gates/source-truth/reject-superseded-traits.json`
- `test/fixtures/dialogue-v3-proof-gates/ruleset/reject-unknown-key.yaml`
- `test/fixtures/dialogue-v3-proof-gates/ruleset/reject-bad-enum.yaml`
- `test/fixtures/dialogue-v3-proof-gates/grouping/micro-clean-reuse-dialogue-data.json`
- `docs/2026-04-17-dialogue-v3-proof-gates-evidence-bundle.md`
- `.plans/2026-04-16-ee-gqnc-v3-traits-execution-plan.md`

**Status:** ✅ Complete

**Results:** Added a deterministic proof-gate lane for the first trusted `cod-test` interpretation. Checked in rejection fixtures for source-truth validation under `test/fixtures/dialogue-v3-proof-gates/source-truth/`, rejection fixtures for the ruleset loader/compiler under `test/fixtures/dialogue-v3-proof-gates/ruleset/`, and a bounded micro-fixture for reducer/scorer/ledger behavior under `test/fixtures/dialogue-v3-proof-gates/grouping/`. Added `test/lib/dialogue-v3-proof-gates.test.js` to prove those seams fail closed when invalid, stay deterministic when valid, and keep the reducer/scorer/ledger bundle coherent. Added `server/lib/dialogue-v3-speaker-grouping-benchmark.cjs` plus the checked-in `benchmarks/fixtures/cod-test/truth/speaker-grouping.json` projection so the golden first-slice grouping truth is explicit, reproducible from `truth/dialogue-data.json`, and comparator-ready without depending on runtime-generated group/speaker ids. Added `docs/2026-04-17-dialogue-v3-proof-gates-evidence-bundle.md` to lock the exact evidence bundle required before any first real run is trusted. Validation actually run for this task: focused proof-gate suites `node --test test/lib/dialogue-v3-source-truth-validator.test.js test/lib/dialogue-v3-heuristics-ruleset.test.js test/lib/dialogue-v3-speaker-grouping.test.js test/lib/dialogue-v3-proof-gates.test.js` passed cleanly (31/31). Broad repo suite `npm test` still reports pre-existing unrelated failures in benchmark-iteration-runner missing lane config, report-package smoke, script-runner AI recovery, config-loader missing `configs/video-analysis.yaml`, and `get-dialogue` prompt/chunking tests; those failures were present outside the new proof-gate files and do not come from this task’s additions.

---

### Task 7: Run targeted deterministic gates and a dialogue-focused cod-test structural sanity pass

**Bead ID:** `ee-ke8y`  
**SubAgent:** `qa`  
**References:** `REF-08`, `REF-09`, `REF-10`, `REF-11`  
**Prompt:** Execute the deterministic gates once the validator/loader/reducer/scorer/ledger seams are implemented. Require green rejection fixtures, green micro-fixtures, targeted expressive evaluation reruns, and a dialogue-focused cod-test structural sanity run with no structural benchmark errors before the first semantic interpretation of the full slice.

**Folders Created/Deleted/Modified:**
- `output/`
- `docs/`
- `.plans/`
- `benchmarks/fixtures/cod-test/dialogue-only/_reports/`

**Files Created/Deleted/Modified:**
- `configs/cod-test-dialogue-structural-sanity.yaml`
- `docs/2026-04-17-dialogue-v3-task7-deterministic-gates-and-structural-sanity.md`
- `output/cod-test-dialogue-structural-sanity/phase1-gather-context/dialogue-data.json`
- `benchmarks/fixtures/cod-test/dialogue-only/_reports/benchmark-summary.json`
- `benchmarks/fixtures/cod-test/dialogue-only/_reports/benchmark-summary.md`
- `benchmarks/fixtures/cod-test/dialogue-only/_reports/artifact-results/dialogueData.json`
- `.plans/2026-04-16-ee-gqnc-v3-traits-execution-plan.md`

**Status:** ❌ Failed

**Results:** Ran the locked deterministic proof-gate lane first via `node --test test/lib/dialogue-v3-source-truth-validator.test.js test/lib/dialogue-v3-heuristics-ruleset.test.js test/lib/dialogue-v3-speaker-grouping.test.js test/lib/dialogue-v3-proof-gates.test.js`; it passed cleanly at 31/31 and preserved the rejection fixtures, micro reducer/scorer/ledger bundle, golden truth projection, and comparator smoke required by `REF-08`. Then attempted the dialogue-only structural sanity pass. The archived baseline config at `configs/archive/cod-test-dialogue-benchmark-baseline.yaml` failed before execution because its `../benchmarks/...` path resolves incorrectly from `configs/archive/`. Created a repo-local QA config at `configs/cod-test-dialogue-structural-sanity.yaml` and reran `node server/run-pipeline.cjs --config configs/cod-test-dialogue-structural-sanity.yaml --verbose`. Phase 1 completed and wrote `output/cod-test-dialogue-structural-sanity/phase1-gather-context/dialogue-data.json`, but the benchmark surface still failed structurally: `benchmarks/fixtures/cod-test/dialogue-only/_reports/benchmark-summary.json` reported `status: error`, `47/206` scoreable fields passed, `29` output dialogue segments vs `20` truth segments, `9` output speaker profiles vs `13` truth profiles, lyric/non-truth leakage into `dialogueData`, and a hard structural error because `cleanedTranscript` was missing from output while present in truth. Also checked the targeted expressive rerun requirement against `REF-09`/`REF-10`; only design docs exist today, not a runnable asset package/reviewer sheet/3-run harness, so that gate remains unmet. Durable evidence was recorded in `docs/2026-04-17-dialogue-v3-task7-deterministic-gates-and-structural-sanity.md`. Follow-on bead `ee-m4eq` was created for the missing targeted expressive rerun surface. Post-run product clarification under `REF-12` changed how these misses should be interpreted: raw dialogue may intentionally retain music-vocal leakage until the end-of-Phase-1 reconciliation/post-processing lane is finalized, and the current dialogue gold benchmark is provisional/stale in both boundary and shape. That means lyric leakage in this raw artifact is no longer treated as a product bug by itself, and the earlier blocker bead `ee-i4a1` was later closed as superseded. The remaining honest blockers before semantic interpretation are the stale benchmark surface, the missing reconciled/raw contract clarity, the `cleanedTranscript` shape mismatch, and the still-missing runnable targeted expressive rerun harness.

---

### Task 7b: Stabilize the end-of-Phase-1 reconciliation/post-processing contract before gold-truth refresh

**Bead ID:** `ee-emj3`  
**SubAgent:** `primary`  
**References:** `REF-10`, `REF-12`  
**Prompt:** In `projects/peanut-gallery/emotion-engine`, document and lock the provisional execution posture for the remainder of Phase 1: raw dialogue may intentionally retain music-vocal leakage until the end-of-Phase-1 reconciliation/post-processing lane is finalized; the current dialogue gold benchmark is provisional/stale in both boundary and shape; and honest comparator work should defer gold-truth refresh until the Phase 1 script contracts settle. Identify the concrete next implementation bead(s) needed to stabilize the reconciliation/post-processing contract and the raw-vs-reconciled artifact boundary.

**Folders Created/Deleted/Modified:**
- `.plans/`
- `docs/`
- `.beads/`

**Files Created/Deleted/Modified:**
- `.plans/2026-04-16-ee-gqnc-v3-traits-execution-plan.md`
- `docs/2026-04-17-phase1-reconciliation-contract-posture.md`
- related bead records in repo-local Beads

**Status:** ✅ Complete

**Results:** Read the active plan plus the current reconciliation/runtime/docs to lock the clarified execution posture. Wrote `docs/2026-04-17-phase1-reconciliation-contract-posture.md` as the durable short note for this slice. Actual findings: the file-level Phase 1 contract is already split cleanly in `server/lib/phase1-baseline-resolution.cjs` (`dialogue-data.json` / `music-vocals-data.json` as raw, `dialogue-data.reconciled.json` / `music-vocals-data.reconciled.json` plus `famous-song-reconciliation.json` as post-processing outputs), and downstream loaders/comparators (`server/lib/persisted-artifacts.cjs`, `server/lib/benchmark-runner.cjs`) already resolve to the reconciled file when reconciliation is configured. But the runtime artifact bag is still not honest about ownership: `server/scripts/get-context/reconcile-famous-song-phase1.cjs` writes reconciled files to disk while also re-emitting reconciled dialogue/music-vocals back under the raw top-level keys, so raw-vs-reconciled ownership remains blurred in memory even after the earlier `gather-context-runner` merge tightening reduced the array-duplication failure mode documented in `docs/research/2026-04-08-whole-video-prompt-duplication-investigation.md`. Re-read Task 7 evidence in light of `REF-12`: raw dialogue lyric leakage is acceptable in this provisional slice, the current dialogue benchmark remains stale in both boundary and shape, and structural misses such as `cleanedTranscript` should be treated as deferred contract drift rather than proof of a product bug. Created two follow-on beads for the next execution slice: `ee-baqh` (**Split raw and reconciled Phase 1 lane artifacts in-memory and preserve post-processing ownership**) and `ee-7i76` (**Make Phase 1 dialogue comparison/reporting honest about provisional raw-vs-reconciled boundaries**). Added both as blockers for Task 8 bead `ee-x7l5`. Recommended next bead: `ee-baqh`, because it stabilizes the runtime artifact seam before comparator/reporting work and before any new cod-test semantic read.

Task 7b follow-through landed under bead `ee-baqh`: the runtime artifact bag now preserves raw `dialogueData` / `musicVocalsData` ownership, reconciliation emits explicit `dialogueDataReconciled` / `musicVocalsDataReconciled` companions in-memory, and persisted-artifact loading now resolves the canonical reconciled surface from `artifacts-complete.json` when reconciliation is configured. Focused regression coverage was added for the raw-vs-reconciled boundary and reconciliation-configured consumer behavior without regenerating golden benchmarks.

Bead `ee-7i76` then made the benchmark/reporting surface honest about that provisional boundary without touching gold truth: `server/lib/benchmark-runner.cjs` now supports a minimal `phase1-dialogue-provisional` posture contract that classifies mismatches by boundary instead of collapsing them into product-bug headlines. For dialogue Phase 1 comparisons, raw-surface misses are reported as `provisional_raw_dialogue_drift`, stale contract-shape paths such as `cleanedTranscript`, `speaker_profiles`, and `handoffContext` are reported as `deferred_contract_drift`, and reconciliation-configured dialogue comparisons reclassify non-deferred misses as `reconciled_post_processing_contract_mismatch`. Focused benchmark-runner tests covered both raw and reconciled cases, and a repo-real rerun against `configs/cod-test-dialogue-structural-sanity.yaml` confirmed the current cod dialogue-only report now headlines the posture honestly (`provisional raw drift=75`, `deferred contract drift=85`) while still preserving the underlying fail/error counts until the contract settles.

---

### Task 8: Run the first real cod-test vertical slice and compare runtime `speaker-grouping` vs golden truth

**Bead ID:** `ee-x7l5`  
**SubAgent:** `qa`  
**References:** `REF-08`, `REF-09`, `REF-10`, `REF-11`, `REF-12`  
**Prompt:** Run the current cod-test YAML config only after the proof gates are green and after the provisional raw-vs-reconciled Phase 1 posture is honest. Produce the validated v3 source-truth artifact, the runtime `speaker-grouping` artifact, the decision ledger, and the comparator outputs against golden `speaker-grouping` truth. Record evidence with exact config/model/ruleset/build identifiers and classify misses by source rather than collapsing them into one headline.

**Folders Created/Deleted/Modified:**
- `output/`
- `.logs/`
- `docs/`
- `.plans/`

**Files Created/Deleted/Modified:**
- run artifacts/comparison notes at repo-appropriate paths
- `.plans/2026-04-16-ee-gqnc-v3-traits-execution-plan.md`

**Status:** ✅ Complete

**Results:** Re-ran the locked proof-gate suite first, then executed the real full COD slice with `node server/run-pipeline.cjs --config configs/cod-test.yaml --verbose`, which completed end-to-end successfully on build `72f614ad1c7dd11b744b921930e0c22662af0873` using `openrouter/xiaomi/mimo-v2-omni` for Phase 1 dialogue/music/music-vocals and Phase 2 whole-video, with the configured repair lane `openrouter/google/gemini-3.1-pro-preview` not used in this run. Preserved the approved raw-vs-reconciled posture by driving grouping from `output/cod-test/phase1-gather-context/dialogue-data.reconciled.json` and recording the reconciliation ledger (`famous-song-reconciliation.json`); in this specific run reconciliation status was `skipped` with reason `hasSupportingMusicConsensus`, so raw and reconciled dialogue contents were effectively identical even though the evidence posture remained pinned to the reconciled surface. Added a durable QA harness `scripts/qa/run-cod-task8-speaker-grouping.cjs` plus the evidence note `docs/2026-04-17-dialogue-v3-task8-first-real-cod-slice.md`, and produced the requested artifacts: validated v3 source-truth at `output/cod-test/phase1-gather-context/dialogue-v3-source-truth.json`, runtime grouping at `output/cod-test/phase1-gather-context/speaker-grouping.json`, decision ledger at `output/cod-test/phase1-gather-context/speaker-grouping.decision-ledger.json`, and comparator outputs at `benchmarks/fixtures/cod-test/_reports/artifact-results/speakerGrouping.json` plus `speakerGrouping.miss-clusters.json`. The comparator is honestly red rather than hand-wavy: runtime count was 18 segments / 18 groups / 18 assignments versus golden truth 20 assignments / 13 groups, with 8 mismatches classified as 6 `grouping_reuse_miss_after_source_truth_conversion` and 2 `runtime_missing_segment_for_truth_index`. Actual read: the seam is now real and evidence-rich, but the first live grouping slice is still bottlenecked by upstream truth/input shape — QA had to synthesize a minimal persisted v3 source-truth envelope from reconciled runtime dialogue because the live lane still does not emit native per-line v3 traits, all substantive traits were therefore `unknown`, the reducer abstained on every reuse candidate and emitted 18 singleton groups, and the real runtime segmentation still differs from golden truth before grouping even starts. This means the current miss headline should stay anchored on missing runtime v3 trait emission plus residual segmentation drift, not on comparator/reporting or on a proven reducer bug.

---

### Task 8b: Emit native persisted v3 per-line traits in the real runtime dialogue lane

**Bead ID:** `ee-ud61`  
**SubAgent:** `coder`  
**References:** `REF-05`, `REF-10`, `REF-12`  
**Prompt:** Implement native persisted v3 per-line trait emission in the real runtime dialogue lane so the first real cod-test speaker-grouping harness can consume production artifacts directly instead of synthesizing a minimal v3 envelope with `unknown` substantive traits. Keep the current raw-vs-reconciled posture intact, avoid regenerating gold truth, and add focused validation that the persisted runtime artifact is validator-compatible and carries the real per-line traits needed for grouping reuse decisions.

**Folders Created/Deleted/Modified:**
- `server/`
- `test/`
- `.plans/`

**Files Created/Deleted/Modified:**
- runtime dialogue emission / persistence code at repo-appropriate paths
- focused tests at repo-appropriate paths
- `.plans/2026-04-16-ee-gqnc-v3-traits-execution-plan.md`

**Status:** ✅ Complete

**Results:** Added a native runtime `dialogue-v3-source-truth` emitter, persisted raw + reconciled v3 dialogue artifacts beside the existing dialogue lane, extended canonical phase1/persisted-artifact resolution for the new artifact key, and switched the Task 8 harness to validate + consume the persisted runtime v3 artifact directly instead of synthesizing an all-`unknown` envelope. Focused validation passed via new emitter/get-dialogue/reconciliation/persistence tests, and a real `output/cod-test` rerun now reads `output/cod-test/phase1-gather-context/dialogue-v3-source-truth.reconciled.json` directly.

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
- `docs/2026-04-18-dialogue-v3-task9-independent-audit.md`
- `.plans/2026-04-16-ee-gqnc-v3-traits-execution-plan.md`

**Status:** ❌ Failed

**Results:** Independent audit completed and documented in `docs/2026-04-18-dialogue-v3-task9-independent-audit.md`. Audit result: **fail** for lane readiness. Verified the source-truth vs derived grouping seam is preserved, raw vs reconciled Phase 1 posture is preserved, and the deterministic proof-gate suite still passes (`31/31`). Verified the current runtime artifacts line up with the native rerun evidence (`dialogue-v3-source-truth.reconciled.json` -> `speaker-grouping.json` -> comparator outputs) but no longer line up 1:1 with the earlier first-slice artifact snapshot because those output paths were refreshed by the rerun. Honest miss-cluster read: `runtime_missing_segment_for_truth_index` is an upstream source-truth/segmentation issue, while the dominant `grouping_assignment_mismatch` cluster is primarily a grouping reducer/scorer calibration problem exposed by sparse native stable-identity traits (`gender_presentation` unknown in `16/18`, `age_impression`/`pitch_band`/`phonation` unknown in `18/18`). Conclusion: the lane is **not yet ready** for a split/no-split recommendation; the next move should be a calibration bead that tightens non-clean reuse under sparse-trait runs and keeps the remaining segmentation drift tracked separately. Bead `ee-ns9e` was **not** closed because the audit found blocking gaps.

---

### Task 9b: Calibrate sparse-trait non-clean grouping reuse after the failed audit

**Bead ID:** `ee-b3g3`  
**SubAgent:** `coder`  
**References:** `REF-02`, `REF-05`, `REF-09`, `REF-10`, `REF-11`, `REF-12`  
**Prompt:** Implement the next bounded calibration pass recommended by the independent audit: tighten non-clean reuse in `server/lib/dialogue-v3-speaker-grouping.cjs` so shared defaults plus recency/repeated-support cannot collapse many speakers into one group when stable identity evidence is mostly `unknown`; require stronger positive evidence or a stronger create/abstain bias when `clean_reuse_gate` is false; add explicit scoring/ledger diagnostics for the default-shared-only reuse failure mode; keep residual segment-count drift tracked separately; do not broaden into a generalized rules engine or new architecture split.

**Folders Created/Deleted/Modified:**
- `server/`
- `test/`
- `output/`
- `benchmarks/fixtures/cod-test/_reports/artifact-results/`
- `.plans/`

**Files Created/Deleted/Modified:**
- `server/lib/dialogue-v3-speaker-grouping.cjs`
- `test/lib/dialogue-v3-speaker-grouping.test.js`
- `output/cod-test/phase1-gather-context/speaker-grouping.json`
- `output/cod-test/phase1-gather-context/speaker-grouping.decision-ledger.json`
- `benchmarks/fixtures/cod-test/_reports/artifact-results/speakerGrouping.json`
- `benchmarks/fixtures/cod-test/_reports/artifact-results/speakerGrouping.miss-clusters.json`
- `.plans/2026-04-16-ee-gqnc-v3-traits-execution-plan.md`

**Status:** ✅ Complete

**Results:** Implemented a bounded scorer/resolver calibration instead of a broader architecture change. In `server/lib/dialogue-v3-speaker-grouping.cjs`, non-clean reuse now suppresses recency/repeated-support bonuses unless discriminative stable-identity exact matches are present, classifies a concrete `default_shared_only_reuse_pressure` diagnostic when a candidate is winning mostly on shared defaults under sparse stable-identity abstention, applies a targeted penalty (`default_shared_only_reuse_pressure_penalty`), and biases the resolver to create a new group rather than reuse when that diagnostic is active. Decision-ledger rows now carry the diagnostic surface even on create decisions via `diagnostic_subject_group_id` plus `diagnostics`. Focused tests were added for the sparse-trait collapse case, the new ledger/scoring diagnostics, and the retained non-clean reuse path when discriminative identity evidence is actually present. Focused validation passed with `node --test test/lib/dialogue-v3-speaker-grouping.test.js` (`14/14`). A targeted rerun of `node scripts/qa/run-cod-task8-speaker-grouping.cjs` improved the real artifact geometry from `2` runtime groups / `15` mismatches (`13` grouping assignment mismatches + `2` missing-segment drift) to `15` runtime groups / `11` mismatches (`6` reuse misses after source-truth conversion + `3` grouping assignment mismatches + the same `2` missing-segment drift). This confirms the pathological over-merge/collapse was materially reduced while the upstream segmentation drift remained separate.

---

### Task 9c: Recover selective truthful reuse after anti-collapse calibration

**Bead ID:** `ee-61jg`  
**SubAgent:** `coder`  
**References:** `REF-05`, `REF-09`, `REF-10`, `REF-12`  
**Prompt:** Do a second narrow grouping calibration pass after `ee-b3g3` to recover truthful reuse when discriminative support is genuinely present, without reintroducing sparse-trait collapse. Keep the source-truth vs derived grouping seam intact and keep segmentation drift explicitly out of scope as a separate lane.

**Folders Created/Deleted/Modified:**
- `server/`
- `test/`
- `output/`
- `benchmarks/fixtures/cod-test/_reports/artifact-results/`
- `.plans/`

**Files Created/Deleted/Modified:**
- focused grouping calibration code/tests at repo-appropriate paths
- refreshed Task 8 runtime grouping/comparator outputs
- `.plans/2026-04-16-ee-gqnc-v3-traits-execution-plan.md`

**Status:** ✅ Complete

**Results:** The second bounded calibration pass `ee-61jg` completed after `ee-b3g3` to recover selective truthful reuse without reopening the earlier collapse. The current checked-in comparator outputs now show `15` runtime groups and `11` mismatches (`6` `grouping_reuse_miss_after_source_truth_conversion`, `3` `grouping_assignment_mismatch`, `2` `runtime_missing_segment_for_truth_index`) instead of the earlier post-audit collapse state (`2` runtime groups / `15` mismatches). Honest read: catastrophic over-merge was reduced, some truthful reuse was recovered, and the seam/proof-gate posture stayed intact, but the lane is still not ready for architectural guidance because truthful reuse remains under-recovered and the separate segment-drift misses are still present.

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

**Status:** ✅ Complete

**Results:** Updated the living plan to the honest post-audit, post-calibration state. What proved true: the source-truth vs derived `speaker-grouping` seam is real, the raw-vs-reconciled Phase 1 ownership seam is materially preserved, and the deterministic proof gates remain green (`31/31`). What failed: Task 9 remained a failed independent audit for lane readiness, so this slice cannot yet support a split/no-split architecture recommendation. What changed after that failed audit: `ee-b3g3` materially reduced the catastrophic over-merge/collapse, and follow-on calibration `ee-61jg` recovered some selective truthful reuse without reopening that collapse. Current live comparator state is `15` runtime groups / `11` mismatches against `13` truth groups / `20` truth assignments. The remaining bounded blockers are `6` truthful-reuse misses plus the separate `2` segment-drift misses at truth indexes `18` and `19`; the current `3` assignment mismatches should be investigated alongside the truthful-reuse lane rather than used as evidence for an architecture split. Recommendation: keep the architecture decision open, do **not** claim split/no-split readiness yet, and run bead `ee-cmw8` next as the bounded investigation lane for the remaining truthful-reuse misses (single-incumbent reuse rule vs support-history tie-breaker vs truth-conversion/comparator expectation mismatch), while continuing to track the `2` segment-drift misses separately.

---

### Task 10b: Derive a dedicated speaker/grouping truth surface from the existing golden dialogue benchmark

**Bead ID:** `ee-xjsl`  
**SubAgent:** `primary`  
**References:** `REF-10`, `REF-12`, `REF-13`  
**Prompt:** Derive a dedicated speaker/grouping truth surface from the existing human-reviewed golden dialogue truth at `benchmarks/fixtures/cod-test/truth/dialogue-data.json`, rather than rebuilding truth from scratch. Keep that file as the durable source anchor. Produce the smallest explicit truth artifact or mapping needed for honest grouping comparison against the current reconciled runtime segment surface, and if a per-line traits review scaffold is generated for follow-on cleanup, label it provisional/non-gold until human review. Preserve the prior audit/calibration history in this plan and keep the split/no-split architecture decision explicitly unresolved.

**Folders Created/Deleted/Modified:**
- `benchmarks/fixtures/cod-test/truth/`
- `docs/`
- `.plans/`

**Files Created/Deleted/Modified:**
- comparator/truth-surface artifacts at repo-appropriate paths
- optional provisional review scaffold at repo-appropriate paths
- `.plans/2026-04-16-ee-gqnc-v3-traits-execution-plan.md`

**Status:** ✅ Complete

**Results:** Derived and checked in a dedicated runtime-aligned grouping-comparison truth surface at `benchmarks/fixtures/cod-test/truth/speaker-grouping.reconciled-runtime-aligned.json`, deterministically projected from the durable golden anchor `benchmarks/fixtures/cod-test/truth/dialogue-data.json` plus the current reconciled runtime dialogue surface `output/cod-test/phase1-gather-context/dialogue-v3-source-truth.reconciled.json`. Added reusable derivation support in `server/lib/dialogue-v3-speaker-grouping-benchmark.cjs`, a generator script at `scripts/qa/derive-cod-runtime-aligned-speaker-grouping-truth.cjs`, a proof-gate regression covering the checked-in aligned artifact, and a concise note at `docs/2026-04-18-dialogue-v3-ee-xjsl-runtime-aligned-speaker-truth.md`. The QA harness now compares against the aligned truth surface while preserving legacy `benchmarks/fixtures/cod-test/truth/speaker-grouping.json` for audit history. On the current runtime artifact, comparator mismatches dropped from `11` to `9`, removing the misleading `runtime_missing_segment_for_truth_index` bucket from grouping comparison and reclassifying the remaining surface to `5` reuse misses, `3` assignment mismatches, and `1` runtime-extra segment. No provisional per-line traits scaffold was emitted. This still does **not** resolve the architecture decision by itself.

---

### Task 10c: Prepare the human review packet for the runtime-aligned speaker/grouping truth surface

**Bead ID:** `ee-kia6`  
**SubAgent:** `primary`  
**References:** `REF-10`, `REF-12`, `REF-13`  
**Prompt:** In `projects/peanut-gallery/emotion-engine`, prepare the next-session human review packet against `benchmarks/fixtures/cod-test/truth/speaker-grouping.reconciled-runtime-aligned.json`. This lane is preparation only, not final truth alignment. The packet must enumerate the exact mapping decisions used to project golden dialogue truth onto the runtime-aligned speaker/grouping surface, call out fuzzy matches, list unmatched truth/runtime rows, and highlight the remaining grouping-error hotspots that still need human judgment before any benchmark-truth refresh or architectural conclusion.

**Folders Created/Deleted/Modified:**
- `docs/`
- `.plans/`

**Files Created/Deleted/Modified:**
- review-packet notes/artifacts at repo-appropriate paths
- `.plans/2026-04-16-ee-gqnc-v3-traits-execution-plan.md`

**Status:** ⏳ Pending

**Results:** Next lane only. The next session's human review should work from the runtime-aligned truth surface, not the legacy source-index projection. Expected packet contents: exact mapping decisions, fuzzy-match rows, unmatched truth/runtime rows, and the remaining grouping-error hotspots surfaced after `ee-xjsl`. This is a preparation lane for human review, not final truth alignment yet.

---

## Final Results

**Status:** ⚠️ Partial

**What We Built:** Landed the first real v3 dialogue source-truth -> deterministic `speaker-grouping` execution seam, including strict source-truth validation, fail-closed ruleset loading, deterministic reducer/scorer/ledger behavior, proof-gated golden grouping comparison, a real COD Task 8 runtime harness, native persisted v3 runtime emission, and two bounded calibration passes after the failed audit. The seam architecture is working and comparator-visible, and the proof gates are green.

**Reference Check:** `REF-02`, `REF-08`, `REF-10`, and `REF-11` are satisfied at the seam/proof/evidence level. `REF-09` now supports the calibration evidence lane rather than a readiness claim. The plan intentionally preserves the Task 9 failed audit result instead of rewriting history, and it does not yet satisfy the higher-level goal of producing a trustworthy split/no-split recommendation.

**Commits:**
- Pending.

**Lessons Learned:** The first honest milestone was seam proof, not architectural guidance. Native persisted v3 traits plus proof-gated comparison were enough to expose real runtime behavior, but sparse-trait calibration issues can confound architecture decisions if treated as product conclusions too early. `ee-xjsl` proved that the grouping comparator also needed its own dedicated runtime-aligned truth surface: once the golden dialogue anchor was projected onto the reconciled runtime segment interpretation, the misleading grouping-side `runtime_missing_segment_for_truth_index` bucket disappeared and the active miss surface became `5` reuse misses, `3` assignment mismatches, and `1` runtime-extra segment. The split/no-split recommendation should still stay open until those remaining aligned misses are resolved or explicitly accepted.

---

*Drafted on 2026-04-16*
