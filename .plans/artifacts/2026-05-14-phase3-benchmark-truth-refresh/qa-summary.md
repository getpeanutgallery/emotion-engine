# Phase 3 benchmark-truth refresh QA summary

**Date:** 2026-05-14  
**Bead:** `ee-6zm5`  
**Role:** `qa`

## Scope

QA the refreshed `cod-test` Phase 3 benchmark surface and decide whether the benchmark now evaluates the **current repaired Phase 3 outputs** honestly instead of rewarding stale pre-repair semantics.

## References checked

- `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/.plans/2026-05-14-phase3-benchmark-truth-refresh.md`
- `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/.plans/artifacts/2026-05-14-phase3-benchmark-truth-refresh/forensic-note.md`
- `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/.plans/artifacts/2026-05-14-phase3-benchmark-truth-refresh/rerun-summary.md`
- `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/benchmarks/fixtures/cod-test/truth/metrics.json`
- `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/benchmarks/fixtures/cod-test/truth/emotional-analysis.json`
- `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/benchmarks/fixtures/cod-test/truth/recommendation.json`
- `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/benchmarks/fixtures/cod-test/_reports/benchmark-summary.json`
- `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/output/cod-test/phase3-report/metrics/metrics.json`
- `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/output/cod-test/phase3-report/emotional-analysis/emotional-data.json`
- `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/output/cod-test/phase3-report/recommendation/recommendation.json`

## QA method

1. Read the plan, forensic note, and rerun summary to understand the intended benchmark-truth refresh scope.
2. Compared each refreshed Phase 3 truth fixture to the corresponding current Phase 3 runtime artifact.
3. Reviewed the refreshed benchmark report to separate:
   - honest Phase 3 alignment
   - remaining benchmark debt in other lanes
   - acceptable comparator limitations / model-variance concerns
   - any newly exposed live-output problems

## Direct fixture-to-output check

The refreshed truth fixtures now match the current repaired Phase 3 outputs exactly, apart from intentional benchmark metadata:

- `truth/metrics.json` == `output/.../metrics/metrics.json` except `_benchmark.ignorePaths`
- `truth/emotional-analysis.json` == `output/.../emotional-analysis/emotional-data.json` except `_benchmark.ignorePaths`
- `truth/recommendation.json` == `output/.../recommendation/recommendation.json` except `_benchmark.ignorePaths`

Retained ignore-path behavior is narrow and appropriate:

- `metrics`: ignores `$.generatedAt`
- `emotional-analysis`: ignores `$.generatedAt`
- `recommendation`: ignores `$.generatedAt` and `$.ai`

This means the refreshed benchmark is no longer asking the repaired runtime to conform to stale boredom-heavy semantics. It is now anchored to the current repaired packet.

## Artifact-by-artifact QA judgment

### 1) `metricsData`

**Judgment:** Honest and aligned.

The refreshed metrics truth now tracks the repaired report surface, including:

- boredom average `0.26428571428571423`
- patience peak at `55s`
- boredom peak at `125s` with score `0.8`
- boredom trend `stable`
- excitement trend `increasing`

Benchmark result:

- status: `pass`
- accuracy: `100%`
- coverage: `97.2%`

This is the expected outcome if the stale pre-repair metrics expectations were the real problem.

### 2) `emotionalAnalysisData`

**Judgment:** Honest and aligned.

The refreshed emotional-analysis truth now tracks the repaired packet rather than the old fabricated boredom story. In particular, the QA check is consistent with the refreshed truth surface described in the forensic note:

- opener is no longer scored as a catastrophic boredom spike
- the false boredom-`1.0` family is gone
- the strongest negative lane is the `120-130s` promo stretch
- `criticalMomentsCount = 9`
- `averageScrollRisk ≈ 0.4064285714285719`

Benchmark result:

- status: `pass`
- accuracy: `100%`
- coverage: `99.5%`

Important nuance:

- `scroll_risk_timeline_pct = 0.0%`
- `critical_moments_pct = 0.0%`

Those zeroed sub-metrics did **not** produce a failing artifact because those families are presently treated as non-scoreable / structurally unscored in the current comparator setup. That is benchmark-design debt, not evidence that the refreshed truth is dishonest and not evidence of a newly exposed live-output defect.

### 3) `recommendationData`

**Judgment:** Honest for the current canonical output, with known future brittleness.

The refreshed recommendation truth now matches the repaired recommendation story:

- shorter concrete recommendation text
- repaired reasoning centered on early title-card friction and `120-130s` promo-screen boredom
- `4` key findings
- `5` suggestions
- `confidence = 0.9`

Benchmark result:

- status: `pass`
- accuracy: `100%`
- coverage: `53.8%`

QA interpretation:

- For this lane, the benchmark is now honest because it no longer rewards stale prose or stale list cardinality.
- However, recommendation acceptance is still snapshot-style and prose-brittle. It is acceptable for the current canonical lane, but it remains benchmark debt if the team later wants tolerance for paraphrase or model variance.

## Remaining red: what belongs to other lanes

The overall benchmark remains globally `error`, but the remaining red is outside the refreshed Phase 3 truth lane.

Remaining non-Phase-3 red in `benchmark-summary.json`:

- `dialogueData` — `fail`
- `dialogueDataRaw` — `fail`
- `musicData` — `error`
- `musicVocalsData` — `fail`
- `chunkAnalysis` — `fail`

QA judgment on ownership:

- `dialogueData`, `dialogueDataRaw`, `musicData`, `musicVocalsData` belong to Phase 1 / music acceptance debt.
- `chunkAnalysis` belongs to Phase 2 benchmark debt.
- None of those failures are evidence that the refreshed Phase 3 benchmark truth is still stale.

## Acceptable model variance vs benchmark debt

### Acceptable for this lane

- Ignoring `generatedAt` and recommendation `ai` metadata is appropriate.
- Snapshotting the current repaired recommendation wording is acceptable for the purpose of verifying the current canonical packet.

### Still benchmark debt

- Recommendation scoring remains brittle to future paraphrase because it compares a specific prose/list surface.
- Emotional-analysis structural families such as scroll-risk timeline and critical moments are still weakly represented in score math despite the artifact passing.
- Low coverage on `recommendationData` and the zeroed emotional-analysis sub-metrics should be treated as acceptance-surface debt, not live-output regression.

## Newly exposed live-output problems

**None found in this QA pass.**

The refreshed benchmark did not expose a new Phase 3 runtime bug. Instead, it confirmed the opposite: once the stale truth fixtures were replaced, the current repaired Phase 3 outputs scored cleanly.

## Go / no-go judgment

**GO** for the refreshed Phase 3 benchmark lane.

Reason:

- the three refreshed truth fixtures now evaluate the current repaired Phase 3 outputs honestly
- the benchmark is no longer rewarding stale semantics for metrics, emotional-analysis, or recommendation
- the remaining global benchmark red belongs to other lanes, not this Phase 3 truth-refresh lane

## Bottom line

The refreshed benchmark surface is now a truthful acceptance surface for the current repaired Phase 3 packet. Keep this lane moving forward as complete, but open separate follow-up work for broader benchmark-design hardening only if the team wants future tolerance for recommendation paraphrase or stronger scoring of currently structural emotional-analysis families.
