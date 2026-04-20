# Dialogue V3 Task 9 — Independent Audit of First Execution Slice

Date: 2026-04-18
Bead: `ee-ns9e`
Status: Failed audit

## Audit verdict

The slice **passes seam-preservation and proof-gate checks**, but **fails readiness for a split/no-split product recommendation**.

The current evidence supports a narrower conclusion:

1. the raw-vs-reconciled ownership seam is now materially preserved;
2. the persisted native v3 grouping seam is real and comparator-visible;
3. the current runtime lane is **not** calibrated enough to use this slice for architectural split guidance;
4. the next correct move is **additional calibration/seam work**, not a split recommendation.

## Files audited

### Planning / narrative evidence
- `.plans/2026-04-16-ee-gqnc-v3-traits-execution-plan.md`
- `docs/2026-04-17-phase1-reconciliation-contract-posture.md`
- `docs/2026-04-17-dialogue-v3-task8-first-real-cod-slice.md`
- `docs/2026-04-17-dialogue-v3-task8-native-persisted-v3-rerun.md`

### Runtime artifacts
- `output/cod-test/phase1-gather-context/dialogue-data.json`
- `output/cod-test/phase1-gather-context/dialogue-data.reconciled.json`
- `output/cod-test/phase1-gather-context/dialogue-v3-source-truth.reconciled.json`
- `output/cod-test/phase1-gather-context/speaker-grouping.json`
- `output/cod-test/phase1-gather-context/speaker-grouping.decision-ledger.json`
- `output/cod-test/phase1-gather-context/famous-song-reconciliation.json`

### Comparator / truth artifacts
- `benchmarks/fixtures/cod-test/truth/speaker-grouping.json`
- `benchmarks/fixtures/cod-test/_reports/artifact-results/speakerGrouping.json`
- `benchmarks/fixtures/cod-test/_reports/artifact-results/speakerGrouping.miss-clusters.json`

### Code / tests used as proof evidence
- `server/lib/phase1-baseline-resolution.cjs`
- `server/lib/persisted-artifacts.cjs`
- `server/lib/benchmark-runner.cjs`
- `server/lib/dialogue-v3-speaker-grouping.cjs`
- `docs/2026-04-16-dialogue-traits-v3-speaker-grouping-heuristics-ruleset.yaml`
- `test/lib/dialogue-v3-proof-gates.test.js`
- `test/lib/dialogue-v3-speaker-grouping.test.js`
- `test/lib/gather-context-runner.test.js`
- `test/scripts/reconcile-famous-song-phase1.test.js`

## 1) Ownership split audit

### A. Source-truth vs runtime grouping artifact seam

This seam is preserved.

Evidence:
- `output/cod-test/phase1-gather-context/dialogue-v3-source-truth.reconciled.json` is a source-truth-style artifact with per-segment traits and no grouping output fields.
- `output/cod-test/phase1-gather-context/speaker-grouping.json` is a separate derived artifact with:
  - `contract.artifact = "speaker-grouping"`
  - `input.path = "output/cod-test/phase1-gather-context/dialogue-v3-source-truth.reconciled.json"`
  - its own `speaker_groups`, `assignments`, and `decision_ledger`
- `test/lib/dialogue-v3-proof-gates.test.js` contains a deterministic proof gate asserting the reducer/scorer/ledger bundle is produced as a separate artifact seam.
- `test/lib/dialogue-v3-speaker-grouping.test.js` contains explicit checks that scorer-side trace lands in `decision_ledger` without mutating the source truth and that the reducer updates only the derived group artifact.

Audit conclusion: **pass**.

### B. Raw vs reconciled Phase 1 posture

This seam is preserved in both code and current run posture.

Evidence:
- `server/lib/phase1-baseline-resolution.cjs` defines separate raw and reconciled paths and separate runtime keys:
  - raw: `dialogueData`, `musicVocalsData`
  - reconciled runtime keys: `dialogueDataReconciled`, `dialogueV3SourceTruthReconciled`, `musicVocalsDataReconciled`
- `server/lib/persisted-artifacts.cjs` resolves canonical Phase 1 artifacts through `selectCanonicalPhase1ArtifactFromBag(...)` / `resolvePhase1ArtifactPath(...)`, preferring reconciled artifacts when reconciliation is configured.
- `test/lib/gather-context-runner.test.js` explicitly verifies that raw and reconciled artifacts coexist in the runtime bag instead of one overwriting the other.
- `test/scripts/reconcile-famous-song-phase1.test.js` explicitly verifies that:
  - raw files stay unchanged,
  - reconciled files are written separately,
  - `dialogueV3SourceTruthReconciled` is emitted and validator-compatible.
- `output/cod-test/phase1-gather-context/famous-song-reconciliation.json` shows reconciliation was configured but `status = "skipped"` because `trigger.passed = false` with reason `hasSupportingMusicConsensus`.
- Current run spot check:
  - `dialogue-data.json` segment count = `18`
  - `dialogue-data.reconciled.json` segment count = `18`
  - `dialogue-v3-source-truth.reconciled.json` segment count = `18`
  - raw and reconciled dialogue segment texts are currently identical in this run, which is consistent with reconciliation being skipped.

Audit conclusion: **pass**.

## 2) Artifact/evidence consistency audit

### What lines up cleanly

The following files exist and are internally consistent with the native rerun story:
- `output/cod-test/phase1-gather-context/dialogue-v3-source-truth.reconciled.json`
- `output/cod-test/phase1-gather-context/speaker-grouping.json`
- `output/cod-test/phase1-gather-context/speaker-grouping.decision-ledger.json`
- `benchmarks/fixtures/cod-test/_reports/artifact-results/speakerGrouping.json`
- `benchmarks/fixtures/cod-test/_reports/artifact-results/speakerGrouping.miss-clusters.json`
- `docs/2026-04-17-dialogue-v3-task8-native-persisted-v3-rerun.md`

The current artifact bundle is consistent with these concrete counts:
- runtime segments: `18`
- runtime groups: `2`
- runtime assignments: `18`
- comparator mismatches: `15`
- miss clusters:
  - `grouping_assignment_mismatch`: `13`
  - `runtime_missing_segment_for_truth_index`: `2`

These counts match both:
- `output/cod-test/phase1-gather-context/speaker-grouping.json`
- `benchmarks/fixtures/cod-test/_reports/artifact-results/speakerGrouping.json`
- `benchmarks/fixtures/cod-test/_reports/artifact-results/speakerGrouping.miss-clusters.json`
- `docs/2026-04-17-dialogue-v3-task8-native-persisted-v3-rerun.md`

### What does not line up cleanly

`docs/2026-04-17-dialogue-v3-task8-first-real-cod-slice.md` describes the earlier first-slice state:
- runtime groups: `18`
- comparator mismatches: `8`
- build commit: `72f614a`

But the current checked-in runtime artifacts now report the later rerun state:
- runtime groups: `2`
- comparator mismatches: `15`
- build commit: `f482ee7`

So the exact artifact file paths named in the first-slice doc were later overwritten by the native rerun. That rerun is documented, but it means the first-slice evidence is no longer fully frozen at those same output paths.

Audit conclusion:
- **pass** for existence and present-day internal consistency;
- **warning** for evidence traceability, because the first-slice doc and the current artifact files are no longer a 1:1 snapshot pair.

## 3) Deterministic proof-gate audit

I reran the claimed proof-gate suite directly:

```bash
node --test test/lib/dialogue-v3-source-truth-validator.test.js \
  test/lib/dialogue-v3-heuristics-ruleset.test.js \
  test/lib/dialogue-v3-speaker-grouping.test.js \
  test/lib/dialogue-v3-proof-gates.test.js
```

Result: **31/31 passing**.

This is enough to confirm the claimed deterministic gates were actually satisfied at audit time.

Important proof points covered by the suite:
- source-truth validator rejects leakage and superseded trait names;
- ruleset loader/compiler fails closed on unknown keys and invalid enums;
- micro-fixture produces deterministic reducer/scorer/ledger behavior;
- checked-in `benchmarks/fixtures/cod-test/truth/speaker-grouping.json` matches the comparator-ready projection from dialogue truth;
- comparator flags partition drift correctly on a controlled mismatch case.

Audit conclusion: **pass**.

## 4) Honest miss-cluster classification

## A. `runtime_missing_segment_for_truth_index` (`2` mismatches: truth indexes `18`, `19`)

Primary classification: **source-truth extraction/input issues**

Why:
- the runtime grouping projection contains only `18` assignments;
- `benchmarks/fixtures/cod-test/truth/speaker-grouping.json` contains `20` assignments;
- `benchmarks/fixtures/cod-test/_reports/artifact-results/speakerGrouping.json` identifies the missing runtime matches at truth indexes `18` and `19` before grouping quality is even considered.

Secondary note:
- this could still reflect some benchmark-shape migration drift, but the current comparator output is behaving correctly and the mismatch class is honest.

## B. `grouping_assignment_mismatch` (`13` mismatches)

Primary classification: **grouping reducer/scorer/calibration bugs**

Secondary contributing factor: **source-truth extraction/input weakness**

Why primary belongs to grouping calibration:
- `output/cod-test/phase1-gather-context/speaker-grouping.json` collapses `18` assignments into only `2` groups.
- `grp_001` alone absorbs segment indexes `0,1,2,3,4,5,6,8,9,10,11,12,13,14,15,16`.
- `output/cod-test/phase1-gather-context/speaker-grouping.decision-ledger.json` shows reuse decisions repeatedly won even while `clean_reuse_gate` was `false`.
- the ruleset explicitly says clean-only blockers should govern conservative reuse, but the current scoring still allows non-clean candidates to accumulate enough score from shared defaults and bonuses.
- repeated exact matches on low-discrimination defaults are doing too much work:
  - `accent_strength = none_apparent`
  - `accent_family = neutral_or_unmarked`
  - `transmission_medium = direct`
  - `spatial_texture = room`
  - `interpersonal_stance = neutral`
  - `delivery_overlay = none_apparent`
  - plus `recent_group_reuse_bonus`
  - and occasionally `repeated_support_bonus`

Why source-truth weakness is still a real contributor:
- in `output/cod-test/phase1-gather-context/dialogue-v3-source-truth.reconciled.json` the stable identity surface is still sparse:
  - `gender_presentation`: `16/18` are `unknown`
  - `age_impression`: `18/18` are `unknown`
  - `pitch_band`: `18/18` are `unknown`
  - `phonation`: `18/18` are `unknown`
- that means the grouping scorer is often operating without discriminative identity evidence.

Why this is **not** primarily a validator bug:
- the persisted v3 artifact is validator-compatible;
- proof-gate validator tests are green;
- the failure mode is not malformed data getting through, but sparse data plus permissive reuse behavior.

Why this is **not** primarily a comparator/reporting bug:
- the comparator’s mismatch list matches the runtime projection exactly;
- the reported miss classes are coherent with the underlying artifact geometry.

Why this is **not** primarily a benchmark-truth gap:
- the truth projection itself is proof-gated and internally consistent;
- the dominant failure is runtime collapse into two groups, which the benchmark truth is correctly exposing.

## 5) Lane-readiness decision

The lane is **not ready** for a split/no-split recommendation.

The correct next move is more basic calibration/seam work first.

Reason:
- current misses do **not** isolate the architectural question Derrick actually wants answered;
- they are still dominated by a mixture of:
  - sparse native trait emission,
  - reuse/scoring overreach under non-clean conditions,
  - residual segmentation drift.

Any split/no-split recommendation made from this slice would be confounded by those more basic issues.

## 6) Recommended next implementation bead

Recommended bead title:

**Calibrate native v3 grouping under sparse-trait runs before any split recommendation**

Recommended scope:
1. tighten non-clean reuse behavior so shared defaults plus recency cannot collapse many speakers into one group when stable identity evidence is mostly `unknown`;
2. require stronger positive evidence for reuse when `clean_reuse_gate` is false, or increase the abstain/create bias in that state;
3. surface explicit scoring diagnostics for “default-shared-only reuse” so this failure mode is easy to audit;
4. keep the segmentation drift for truth indexes `18` and `19` tracked as a separate upstream lane, not mixed into grouping calibration claims.

## 7) Final audit call

- Audit result for `ee-ns9e`: **fail**
- Bead closure: **do not close**
- Lane status: **not ready for split/no-split recommendation**
- Procedural note: plan-update bead `ee-1o5b` can proceed because the audit is complete and documented, but it should record a failed audit and recommend calibration work rather than a split decision.
