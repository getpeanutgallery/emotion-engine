# Peanut Gallery Emotion Engine

**Date:** 2026-05-04  
**Status:** In Progress  
**Agent:** Cookie 🍪

---

## Goal

Add `% out of 100` benchmark scoring for the new dialogue-timestamps and music-vocals-timestamps benchmark comparisons so we can judge how close those timestamp artifacts are to truth at a glance.

---

## Overview

We now have dedicated timestamp benchmark truth surfaces for dialogue and music-vocals, plus a benchmark-anchored human-review packet for dialogue. What is still missing is the same kind of summarized `% out of 100` scoring we already use in the rest of the benchmark system. Right now we can inspect detailed drift, windows, and blocked units, but we do not yet get a compact overall score that answers “how close are we?” in the same language the rest of the repo already uses.

This slice should stay benchmark-focused. We are not changing the runtime timestamp artifacts themselves, and we are not changing the underlying benchmark truth we just built. Instead, we should extend the comparator / reporting layer so timestamp benchmarks produce meaningful percentage metrics that are honest about split/merge drift, unresolved timing, and text-drift-blocked regions. The most likely shape is to reuse the existing artifact-specific `% out of 100` pattern that landed in the benchmark system earlier, then define timestamp-specific scoring semantics for dialogue and music-vocals.

The main design risk is score honesty. For dialogue timestamps especially, some regions are blocked by upstream text drift or segmentation drift, so a naïve index-to-index timing compare would produce misleading percentages. The new scoring needs to preserve the benchmark-authoritative split/merge-tolerant posture we just established: exact text-clean units can be judged directly, grouped windows can be judged at the window level, and blocked units need an explicit scoring treatment instead of being silently folded into timing failure.

---

## REFERENCES

| ID | Description | Path |
| --- | --- | --- |
| `REF-01` | Benchmark-surface creation plan for timestamp truth files | `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/.plans/2026-05-04-recover-dialogue-timing-truth-and-split-timestamp-benchmarks.md` |
| `REF-02` | Dialogue timestamp comparison findings / drift classes | `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/.plans/2026-05-04-dialogue-timestamp-output-vs-golden-truth.md` |
| `REF-03` | Dialogue human-review packet plan | `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/.plans/2026-05-04-dialogue-timestamp-human-review-against-benchmark.md` |
| `REF-04` | Dedicated dialogue timestamp benchmark truth | `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/benchmarks/fixtures/cod-test/truth/dialogue-timestamps-data.reconciled.json` |
| `REF-05` | Dedicated music-vocals timestamp benchmark truth | `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/benchmarks/fixtures/cod-test/truth/music-vocals-timestamps-data.json` |
| `REF-06` | Existing machine comparison artifact for dialogue timestamps | `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/output/cod-test-phase1-timestamp-validation/phase1-gather-context/dialogue-timestamp-vs-truth.comparison.json` |
| `REF-07` | Prior benchmark percentage extension work | `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/.plans/2026-04-24-extend-benchmark-percentages-and-add-lyric-leakage-regression.md` |
| `REF-08` | Benchmark-runner timing/segment alignment prior work | `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/server/lib/benchmark-runner.cjs` |
| `REF-09` | Current benchmark fixture root | `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/benchmarks/fixtures/cod-test/` |

---

## Execution-Ready Timestamp Percentage Contract

### 1) Artifact shape and reporting posture

Add two new artifact-specific scoring blocks with **no composite/master timestamp score**:

- `dialogueTimestampScoring` for `dialogue-timestamps-data.reconciled.json`
- `musicVocalsTimestampScoring` for `music-vocals-timestamps-data*.json`

These blocks should follow the repo’s existing reporting style:

- every surfaced percentage is its own explicit `% out of 100`
- raw counts / alignments stay visible beside percentages
- summary markdown/json should print the timestamp percentages directly
- no hidden weighting that blends text, segmentation, blocked regions, and timing into one rolled-up number

### 2) Comparison-unit contract

Use the same split/merge-tolerant monotonic windowing posture already established for dialogue scoring, but apply it to the dedicated timestamp benchmark truth surfaces.

For both dialogue and music-vocals timestamp artifacts:

1. Build ordered comparison units/windows between truth and runtime rows.
2. Normalize concatenated text exactly as the current dialogue/music-vocals text scoring already does.
3. Classify each unit into one of:
   - `boundary_exact`
   - `split`
   - `merge`
   - `mixed_resegmentation`
   - `missing_truth`
   - `extra_output`
4. Also classify text status per unit:
   - `exact_normalized`
   - `drift`

This comparison-unit layer is the gate for all timestamp percentages. Timing is judged **only after** text/window ownership is settled.

### 3) Separate percentage surfaces to report

#### Dialogue timestamp artifact

`dialogueTimestampScoring` should expose:

- `dialogue_text_full_transcript_pct`
- `dialogue_text_windowed_pct`
- `dialogue_boundary_pct`
- `dialogue_timing_eligible_pct`
- `dialogue_timing_resolved_pct`
- `dialogue_timing_start_pct`
- `dialogue_timing_end_pct`
- `dialogue_timing_window_pct`
- `dialogue_timing_blocked_by_text_drift_pct`

#### Music-vocals timestamp artifact

`musicVocalsTimestampScoring` should expose:

- `vocal_text_full_transcript_pct`
- `vocal_text_windowed_pct`
- `vocal_boundary_pct`
- `vocal_timing_eligible_pct`
- `vocal_timing_resolved_pct`
- `vocal_timing_start_pct`
- `vocal_timing_end_pct`
- `vocal_timing_window_pct`
- `vocal_timing_blocked_by_text_drift_pct`
- `vocal_attribution_pct`

Notes:

- The three text/boundary percentages should reuse the existing scoring semantics already used for dialogue / music-vocals benchmark text artifacts so the new timestamp surfaces stay comparable to the repo’s current style.
- `vocal_attribution_pct` remains valuable on timestamp artifacts because performer / delivery ownership can still drift independently from lyric text.
- Recognized-song identity/support percentages do **not** belong in this timestamp-specific slice; keep scope on timed-segment truth.

### 4) Exact timing-eligibility rules

A comparison unit is **timing-eligible** only when all of the following are true:

- it contains at least one truth row and at least one runtime row
- concatenated normalized text is `exact_normalized`
- the unit is one of `boundary_exact`, `split`, `merge`, or `mixed_resegmentation`

A unit is **not timing-eligible** when it is:

- `text_drift`
- `missing_truth`
- `extra_output`

This preserves the honesty rule that we do not blame timing for upstream wording / omission / insertion defects.

### 5) Split/merge timing semantics

For timing-eligible units:

- `boundary_exact` → score at the row level
- `split` / `merge` / `mixed_resegmentation` → score at the **window span** level only

Window span construction:

- `truth_window_start = min(truth.start)` across the truth rows in the unit
- `truth_window_end = max(truth.end)` across the truth rows in the unit
- `runtime_window_start = min(runtime.start)` across the runtime rows in the unit **only when numeric starts exist**
- `runtime_window_end = max(runtime.end)` across the runtime rows in the unit **only when numeric ends exist**

Critical honesty rule:

- **Never invent sub-line truth timing boundaries** inside a split truth row.
- **Never judge per-subrow timing** inside a merge window.
- Split/merge correctness is already reflected by `*_boundary_pct`; timestamp scoring should judge only whether the emitted window covers the correct spoken span.

### 6) Exact timing-resolved vs unresolved semantics

A timing-eligible unit is **resolved** only when every runtime row in that unit supplies a usable numeric `start` and `end`, and its timing status is benchmark-comparable (for current artifacts, effectively the aligned / resolved posture rather than `unresolved`).

If a timing-eligible unit lacks usable runtime timing, classify it as `timing_unresolved`.

Resolved/unresolved treatment:

- `*_timing_resolved_pct` = `100 * resolved_eligible_unit_count / timing_eligible_unit_count`
- unresolved eligible units **reduce `*_timing_resolved_pct`**
- unresolved eligible units do **not** get fake `0` start/end/window accuracy scores injected into the accuracy means
- if `resolved_eligible_unit_count == 0`, then:
  - `*_timing_start_pct = null`
  - `*_timing_end_pct = null`
  - `*_timing_window_pct = null`
  - summary markdown should render these as `n/a`, not `0.0%`

That keeps “unable to judge timing” distinct from “judged and bad timing.”

### 7) Exact per-unit timing scoring formulas

For each **resolved timing-eligible unit**:

- `start_delta_seconds = abs(runtime_window_start - truth_window_start)`
- `end_delta_seconds = abs(runtime_window_end - truth_window_end)`
- `overlap_seconds = max(0, min(truth_window_end, runtime_window_end) - max(truth_window_start, runtime_window_start))`
- `union_seconds = max(truth_window_end, runtime_window_end) - min(truth_window_start, runtime_window_start)`

Per-unit percentages:

- `unit_start_pct = max(0, 100 * (1 - (start_delta_seconds / timingToleranceSeconds)))`
- `unit_end_pct = max(0, 100 * (1 - (end_delta_seconds / timingToleranceSeconds)))`
- `unit_window_pct = union_seconds > 0 ? (100 * overlap_seconds / union_seconds) : 100`

Where `timingToleranceSeconds` should use the benchmark runner’s existing timing tolerance option (currently `2` seconds by default) so the new scoring semantics stay aligned with the repo’s existing tolerant-time posture.

Aggregate artifact percentages:

- `*_timing_start_pct` = arithmetic mean of `unit_start_pct` across resolved timing-eligible units
- `*_timing_end_pct` = arithmetic mean of `unit_end_pct` across resolved timing-eligible units
- `*_timing_window_pct` = arithmetic mean of `unit_window_pct` across resolved timing-eligible units

Why this split:

- start/end percentages expose clipped-leading vs clipped-trailing defects separately
- window percentage exposes overall span overlap honesty
- resolved percentage exposes whether the system produced benchmark-usable timing at all

### 8) Blocked text-drift treatment

Blocked text-drift regions must be surfaced explicitly rather than silently folded into timing failure.

Definitions:

- `timing_blocked_by_text_drift_count` = units with both truth/runtime text present but `text_match = drift`
- `*_timing_blocked_by_text_drift_pct = 100 * timing_blocked_by_text_drift_count / comparison_unit_count`

Blocked text-drift rules:

- blocked units still count against the text percentages
- blocked units still influence boundary / missing / extra diagnostics as appropriate
- blocked units do **not** count as timing-eligible
- blocked units do **not** reduce start/end/window timing accuracy means directly
- blocked units are not allowed to masquerade as timing failures

For dialogue specifically, this preserves the truth established in the current machine comparison artifact: the `we/you`, missing line, `Specter/Spectre`, `So eager to leave…`, and `the/an idea` cases are upstream text-surface problems first, not proven timing-placement failures.

### 9) Summary counts / diagnostics that must appear

Each timestamp scoring block should also emit the supporting counts needed to interpret the percentages honestly:

- `truth_segment_count`
- `output_segment_count`
- `comparison_unit_count`
- `split_event_count`
- `merge_event_count`
- `mixed_resegmentation_count`
- `missing_truth_window_count`
- `extra_output_window_count`
- `timing_eligible_unit_count`
- `timing_resolved_unit_count`
- `timing_unresolved_unit_count`
- `timing_blocked_by_text_drift_count`
- `normalization_profile`
- `timing_tolerance_seconds`
- `window_alignments`

And each `window_alignments[]` entry should grow enough timing metadata to explain the score:

- `truth_indexes`
- `output_indexes`
- `text_similarity_pct`
- `boundary_status`
- `timing_eligibility`
- `timing_resolution_status` (`resolved`, `unresolved`, `blocked_by_text_drift`, `not_applicable`)
- `truth_window_start`
- `truth_window_end`
- `runtime_window_start`
- `runtime_window_end`
- `start_delta_seconds`
- `end_delta_seconds`
- `window_overlap_pct`

### 10) Practical meaning on current benchmark surfaces

This contract intentionally yields an honest shape on the known current artifacts:

- **Dialogue timestamps:** text/window percentages should reflect the same drift story already documented in the dialogue comparison artifact; `dialogue_timing_blocked_by_text_drift_pct` should surface that a non-trivial slice of units cannot yet be timing-judged honestly; text-clean resolved units can still earn strong timing percentages.
- **Music-vocals timestamps:** current artifact output is largely unresolved and text-drifted relative to truth, so `vocal_timing_resolved_pct` should fall sharply (likely to `0` on the present machine artifact), while `vocal_timing_start_pct`, `vocal_timing_end_pct`, and `vocal_timing_window_pct` should render as `n/a` if no resolved eligible units exist.

That is the intended honesty: poor timing availability should show up as poor resolved coverage, not as fake precise timing-quality numbers.

---

## Tasks

### Task 1: Design honest `% out of 100` scoring semantics for timestamp benchmarks

**Bead ID:** `ee-oy2v`  
**SubAgent:** `primary` (for `research` workflow role)  
**Role:** `research`  
**References:** `REF-02`, `REF-04`, `REF-05`, `REF-06`, `REF-07`, `REF-08`  
**Prompt:** `Claim bead ee-oy2v on start with bd update ee-oy2v --status in_progress --json. Audit the existing percentage-based benchmark/reporting system and define honest scoring semantics for dialogue-timestamps and music-vocals-timestamps. Specify which timestamp dimensions should receive separate percentages, how split/merge windows should score, how blocked text-drift regions should be treated, and what summary metrics should appear in benchmark output. Keep the design benchmark-honest and compatible with the existing % out of 100 reporting style. Update the active plan with the exact scoring contract and close bead ee-oy2v with bd close ee-oy2v --reason "Timestamp percentage scoring contract documented" --json only when the implementation lane is execution-ready.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- benchmark/comparator inspection paths as needed

**Files Created/Deleted/Modified:**
- `.plans/2026-05-04-add-percent-scoring-for-dialogue-and-music-vocals-timestamps.md`

**Status:** ✅ Complete

**Results:** Documented an execution-ready timestamp percentage scoring contract directly in the active plan. Locked the metric family to separate text, boundary, timing-eligibility, timing-resolution, start-edge, end-edge, window-overlap, and blocked-by-text-drift percentages with no master rollup. Locked the split/merge rule that timestamp scoring must aggregate to truth/runtime window spans instead of inventing sub-line boundaries, and locked the blocked-region rule that text-drifted units are explicitly surfaced via `*_timing_blocked_by_text_drift_pct` rather than blamed as timing failures. Also locked the unresolved-data rule that `*_timing_resolved_pct` drops when runtime timing is missing/unresolved, while `*_timing_start_pct` / `*_timing_end_pct` / `*_timing_window_pct` render `n/a` when there are zero resolved eligible units. This leaves the coder lane execution-ready without broadening into implementation in this bead.

---

### Task 2: Implement timestamp benchmark percentage scoring and reporting

**Bead ID:** `ee-3tvs`  
**SubAgent:** `primary` (for `coder` workflow role)  
**Role:** `coder`  
**References:** `REF-04`, `REF-05`, `REF-07`, `REF-08`, `REF-09`  
**Prompt:** `Claim bead ee-3tvs on start with bd update ee-3tvs --status in_progress --json. Implement the approved % out of 100 scoring for dialogue-timestamps and music-vocals-timestamps in the benchmark/comparator/reporting layer. Keep the change narrowly scoped to benchmark scoring/reporting and any minimal fixture or test updates required. Add regression coverage proving the new metrics appear and are honest about split/merge/blocked or unresolved conditions. Commit/push before QA handoff unless explicitly blocked, and close bead ee-3tvs with bd close ee-3tvs --reason "Timestamp percentage scoring implemented" --json only when the feature is durable.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `server/`
- `test/`
- `benchmarks/fixtures/cod-test/` only if a narrow fixture/reporting update is required

**Files Created/Deleted/Modified:**
- `.plans/2026-05-04-add-percent-scoring-for-dialogue-and-music-vocals-timestamps.md`
- `server/lib/benchmark-runner.cjs`
- `test/lib/benchmark-runner.test.js`

**Status:** ✅ Complete

**Results:** Implemented narrow benchmark/comparator/reporting support for timestamp percentage scoring in `server/lib/benchmark-runner.cjs` and added focused regression coverage in `test/lib/benchmark-runner.test.js`. The benchmark runner now supports `dialogue-timestamps-default` and `music-vocals-timestamps-default` comparator profiles, emits `dialogueTimestampScoring` / `musicVocalsTimestampScoring` blocks, and prints the locked text/boundary/timing percentages into summary markdown + artifact summary bits with no composite score. The shared window-alignment scoring path was extended to (a) classify `mixed_resegmentation`, (b) compute timing eligibility/resolution/blocked counts, (c) score start/end by linear decay against the comparator timing tolerance, and (d) score window overlap by span intersection-over-union while leaving start/end/window percentages `null` when no eligible unit resolves. Timestamp profiles deliberately ignore raw comparator leaf checks for per-row `start`/`end`/`index` so unresolved timing does not masquerade as a structural compare error; the benchmark-specific timing judgments now live in the scoring block and enriched `window_alignments` metadata instead.

**Exact files changed:**
- `server/lib/benchmark-runner.cjs`
- `test/lib/benchmark-runner.test.js`
- `.plans/2026-05-04-add-percent-scoring-for-dialogue-and-music-vocals-timestamps.md`

**Commands run:**
- `node --test test/lib/benchmark-runner.test.js`
- `npm test` *(repo-level suite still has unrelated pre-existing failures outside this slice: `test/lib/script-contract.test.js` expected retry count and `test/pipeline/config-loader.test.js` missing `configs/video-analysis.yaml`)*
- `npm run test:validate-json`
- `npm run validate-configs`

**Validation notes:**
- Added a dialogue timestamp regression that proves split/merge comparison units keep text at `100%`, emit window-level timing percentages, and surface timing deltas/overlap without inventing sub-line truth boundaries.
- Added a music-vocals timestamp regression that proves blocked text drift is reported separately from unresolved timing and renders start/end/window percentages as `n/a`/`null` when nothing resolves.
- Full repo `npm test` is not clean at HEAD for unrelated reasons, so the durable validation signal for this bead is the targeted benchmark-runner suite plus JSON/config validation.

**Implementation caveats for QA/audit:**
- This bead wires the scoring/reporting layer and comparator profiles; it does **not** yet promote the real cod-test timestamp artifacts into the shared benchmark fixture manifest. QA should decide whether that activation belongs in a follow-up benchmark-fixture wiring pass once the pipeline owner is ready for those artifacts to participate in normal benchmark runs.
- Structural benchmark pass/fail behavior for split/merge timestamp artifacts remains separate from the new percentage surfaces: a split/merge case can still fail the strict structured compare while producing truthful percentage diagnostics in the timestamp scoring block.

---

### Task 3: QA the new timestamp percentages against known dialogue/music-vocals truth surfaces

**Bead ID:** `ee-5wca`  
**SubAgent:** `primary` (for `qa` workflow role)  
**Role:** `qa`  
**References:** `REF-02`, `REF-04`, `REF-05`, `REF-06`, `REF-09`  
**Prompt:** `Claim bead ee-5wca on start with bd update ee-5wca --status in_progress --json. Run benchmark-focused QA on the new timestamp percentage metrics. Confirm the scores populate in output, reflect the expected truth posture for dialogue and music-vocals, and do not overstate quality in blocked or unresolved regions. Record exact commands, output locations, and the practical meaning of the resulting percentages in the active plan. Close bead ee-5wca with bd close ee-5wca --reason "Timestamp percentage metrics QA-validated" --json only when findings are fully documented.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- benchmark output / reports inspection paths as needed

**Files Created/Deleted/Modified:**
- `.plans/2026-05-04-add-percent-scoring-for-dialogue-and-music-vocals-timestamps.md`
- `output/cod-test-phase1-timestamp-validation/qa-timestamp-metrics/fixture/benchmark.json`
- `output/cod-test-phase1-timestamp-validation/qa-timestamp-metrics/fixture/fixture.json`
- `output/cod-test-phase1-timestamp-validation/qa-timestamp-metrics/fixture/qa-config.yaml`
- `output/cod-test-phase1-timestamp-validation/qa-timestamp-metrics/qa-run-result.json`
- `output/cod-test-phase1-timestamp-validation/qa-timestamp-metrics/reports/benchmark-summary.json`
- `output/cod-test-phase1-timestamp-validation/qa-timestamp-metrics/reports/benchmark-summary.md`
- `output/cod-test-phase1-timestamp-validation/qa-timestamp-metrics/reports/artifact-results/dialogueTimestampsData.json`
- `output/cod-test-phase1-timestamp-validation/qa-timestamp-metrics/reports/artifact-results/musicVocalsTimestampsData.json`
- `output/cod-test-phase1-timestamp-validation/qa-timestamp-metrics/2026-05-04-timestamp-metrics-qa.md`

**Status:** ✅ Complete

**Results:** Ran benchmark-style QA directly against the real cod-test timestamp truth/output surfaces by creating a QA-only fixture under `output/cod-test-phase1-timestamp-validation/qa-timestamp-metrics/fixture/` and executing `runBenchmarkStage()` against `output/cod-test-phase1-timestamp-validation`. The resulting summary/report artifacts prove that the new percentage blocks populate in real benchmark output: `output/cod-test-phase1-timestamp-validation/qa-timestamp-metrics/reports/benchmark-summary.{json,md}` plus per-artifact reports in `.../artifact-results/`. Added a durable QA note at `output/cod-test-phase1-timestamp-validation/qa-timestamp-metrics/2026-05-04-timestamp-metrics-qa.md` capturing the exact commands, output paths, percentages, and interpretation.

**Observed dialogue timestamp percentages (real cod-test timestamp-validation output):** `dialogue_text_full_transcript_pct=93.6%`, `dialogue_text_windowed_pct=93.6%`, `dialogue_boundary_pct=0.0%`, `dialogue_timing_eligible_pct=72.2%`, `dialogue_timing_resolved_pct=100.0%`, `dialogue_timing_start_pct=7.7%`, `dialogue_timing_end_pct=0.0%`, `dialogue_timing_window_pct=4.3%`, `dialogue_timing_blocked_by_text_drift_pct=27.8%` with `timing_eligible_unit_count=13`, `timing_resolved_unit_count=13`, `timing_blocked_by_text_drift_count=5`. QA verdict: the metrics are benchmark-honest. They show that most dialogue text is alignable, blocked text-drift regions are surfaced explicitly instead of depressing timing accuracy directly, and the emitted runtime timestamps are resolvable but land far away from the benchmark truth windows on this artifact pair (hence the near-zero start/end/window scores).

**Observed music-vocals timestamp percentages (real cod-test timestamp-validation output):** `vocal_text_full_transcript_pct=50.8%`, `vocal_text_windowed_pct=54.9%`, `vocal_boundary_pct=33.3%`, `vocal_timing_eligible_pct=10.0%`, `vocal_timing_resolved_pct=0.0%`, `vocal_timing_start_pct=n/a`, `vocal_timing_end_pct=n/a`, `vocal_timing_window_pct=n/a`, `vocal_timing_blocked_by_text_drift_pct=40.0%`, `vocal_attribution_pct=57.6%` with `timing_eligible_unit_count=1`, `timing_resolved_unit_count=0`, `timing_blocked_by_text_drift_count=4`. QA verdict: this is exactly the intended honesty posture for unresolved lyric timing — the system does not invent fake timing-accuracy percentages when no eligible unit resolves, and it exposes a large blocked slice separately via `vocal_timing_blocked_by_text_drift_pct`.

**QA caveat deliberately documented, not repaired:** both QA artifacts still reported overall artifact status `error` because the real timestamp truth surfaces omit fields like output `confidence`, so the raw structured comparator still records schema/field mismatches outside the new scoring block. That did not prevent the new timestamp percentage metrics from appearing and being interpretable, but it is relevant audit context for Task 4.

---

### Task 4: Audit score honesty and readiness for ongoing human + machine review

**Bead ID:** `ee-r1ek`  
**SubAgent:** `primary` (for `auditor` workflow role)  
**Role:** `auditor`  
**References:** `REF-01`, `REF-02`, `REF-03`, `REF-07`, `REF-08`  
**Prompt:** `Claim bead ee-r1ek on start with bd update ee-r1ek --status in_progress --json. Independently audit the new timestamp percentage scoring. Confirm the metrics are benchmark-honest, compatible with the existing % out of 100 system, and useful for judging dialogue/music-vocals timestamp closeness without hiding blocked/text-drift realities. Close bead ee-r1ek with bd close ee-r1ek --reason "Timestamp percentage scoring audited" --json only when the readiness verdict is evidence-backed and the next users of the scores will not be misled.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- benchmark/report inspection paths as needed

**Files Created/Deleted/Modified:**
- `.plans/2026-05-04-add-percent-scoring-for-dialogue-and-music-vocals-timestamps.md`

**Status:** ✅ Complete

**Results:** Independent audit passed. Re-read the active scoring contract, implementation in `server/lib/benchmark-runner.cjs`, focused regression coverage in `test/lib/benchmark-runner.test.js`, the QA note, the QA compact result, the benchmark summary markdown, and the per-artifact report JSONs for both timestamp artifacts. Also re-ran the focused benchmark-runner suite with `node --test test/lib/benchmark-runner.test.js --test-name-pattern 'timestamp scoring|time-aware alignment|split merge timing percentages|separates blocked text drift'` and confirmed all targeted tests passed.

**Audit verdict on score honesty / compatibility:**
- The new timestamp percentages are **benchmark-honest and compatible with the repo’s existing `% out of 100` model**. They follow the same artifact-specific pattern established in `REF-07`: explicit percentage families, no composite/master score, raw counts retained beside the percentages, and markdown/json summary surfaces that print `n/a` rather than fake `0.0%` timing-quality numbers when nothing resolved.
- Dialogue results are honest on the real cod artifact pair: strong text similarity (`93.6%`) coexists with explicit blocked text drift (`27.8%`) and terrible timing closeness (`7.7 / 0.0 / 4.3`), so the scoring does **not** confuse “we found timestamps” with “the timestamps are close to truth.”
- Music-vocals results are also honest: only `10.0%` of units are timing-eligible, `0.0%` of those resolve, and the start/end/window timing fields render `n/a`, which is the correct posture for unresolved lyric timing rather than fake precision.

**Audit verdict on usefulness:**
- The scores are **useful for judging closeness** because they separate the three things a reviewer actually needs to know: text fidelity, how much of the artifact was even timing-judgeable, and how good the resolved timing was.
- `*_timing_blocked_by_text_drift_pct` is doing real work here. It prevents blocked regions from silently depressing timing accuracy means while still making the blocker visible. That keeps the scores readable without hiding upstream drift.
- The split/merge window treatment is also ready for next-session decision-making: the tests prove window-level timing percentages can be emitted without inventing sub-line truth boundaries, so these scores remain compatible with the repo’s established benchmark-authoritative split/merge posture instead of regressing to naive index math.

**QA caveat resolved at the audit level (not repaired in code):**
- The overall artifact `status=error` seen in QA is currently driven by **non-timestamp structural/schema mismatches outside the new scoring block**, most visibly output-only per-segment `confidence` fields that the dedicated timestamp truth files intentionally omit. The per-artifact report JSONs confirm this directly: the `errors[]` arrays are confidence-field structural misses, while the new timestamp scoring blocks and `window_alignments` still populate correctly and remain interpretable.
- Recommendation: preserve this as the **one caveat for next session**. If we want the overall benchmark artifact status to stop reading as `error` for these timestamp surfaces, we should do a narrow follow-up on comparator posture / ignore-path policy for output-only metadata like `confidence`. That is a cleanup/readability slice, not a reason to distrust the new percentage metrics.

**Readiness recommendation:**
- This scoring slice is **complete enough to hand off for next-session review and decision-making now**. The metrics are honest, the regression tests cover the critical split/merge and unresolved-timing cases, and the real cod QA surfaces demonstrate that the scores communicate the right story.
- Next users should rely on the timestamp percentage blocks for closeness judgment, while remembering that current raw artifact `error` status still includes unrelated schema noise from omitted non-owned fields like `confidence`.

---

## Final Results

**Status:** ✅ Complete

**What We Built:** The repo now has a complete timestamp-percentage scoring slice for dialogue and music-vocals benchmark artifacts. The benchmark runner emits dedicated `dialogueTimestampScoring` / `musicVocalsTimestampScoring` blocks with explicit text, boundary, timing-eligibility, timing-resolution, start-edge, end-edge, window-overlap, blocked-by-text-drift, and attribution percentages; enriched window-alignment diagnostics; and no composite/master score.

**Reference Check:** The final audit revalidated the contract and implementation against `REF-04`, `REF-05`, `REF-07`, and `REF-08`, and revalidated the practical honesty of the scores against the real cod QA surfaces. The focused test coverage explicitly proves the intended honesty rules from `REF-06`: split/merge timing is judged at the window level, blocked text drift is surfaced separately, and unresolved timing yields `n/a` timing-quality percentages rather than fake zeros.

**Commits:**
- None in this audit lane (`do not commit` respected here). The plan reflects the completed audit/readiness verdict only.

**Lessons Learned:** The right place to summarize timestamp quality is the artifact-specific scoring block, not the raw structured-compare status. The remaining confusion comes from schema noise such as output-only `confidence` fields causing overall artifact `error`, while the new percentage metrics themselves already tell the truth clearly. That caveat should be preserved for the next session as a comparator/readability cleanup, not as a knock against the scoring model.

---

*Completed on 2026-05-04*
