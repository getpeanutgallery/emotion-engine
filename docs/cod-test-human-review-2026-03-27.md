# cod-test human review memo

**Date:** 2026-03-27  
**Reviewer lane:** human-quality review / gold-truth hardening handoff  
**Scope:** current canonical `output/cod-test` packet plus benchmark execution evidence

## Artifacts reviewed

Primary output packet:
- `output/cod-test/phase2-process/chunk-analysis.json`
- `output/cod-test/phase3-report/metrics/metrics.json`
- `output/cod-test/phase3-report/recommendation/recommendation.json`
- `output/cod-test/phase3-report/emotional-analysis/emotional-data.json`
- `output/cod-test/phase3-report/summary/summary.json`
- `output/cod-test/phase3-report/summary/FINAL-REPORT.md`

Execution / acceptance evidence:
- `.logs/cod-test-20260320-155949-ee-acq-clean-full.log`
- `.logs/cod-test-20260326-1235-ee-dn02.log`
- `benchmarks/fixtures/cod-test/_reports/benchmark-summary.json`
- `benchmarks/fixtures/cod-test/_reports/artifact-results/*.json`

## Bottom line

The packet is **partly useful as a human-facing review artifact**, especially at the chunk-summary and top-level recommendation layers, but it is **not yet trustworthy as human gold truth end-to-end**.

What feels genuinely aligned with human expectations:
- The broad editorial read is good: weak opening hook, very strong action-heavy middle, weak late promo/info-dump block.
- Most chunk summaries read grounded and usable for a human editor.
- The recommendation text is directionally strong and would help a trailer editor make sensible cuts.

What only appears technically consistent because the benchmark truth is still bootstrap truth:
- `emotional-analysis` contains obvious truth mismatches, especially boredom values and downstream critical-moment flags.
- The benchmark acceptance story is muddled: the 2026-03-26 rerun log reports benchmark failure while the saved `_reports/benchmark-summary.json` still says pass, so the repo currently contains contradictory acceptance evidence.
- Some recommendation details are specific enough to be brittle or hallucination-prone and should not be treated as durable gold truth without direct human confirmation.

## Strong areas

### 1) Chunk-level editorial read is mostly believable
The strongest part of the packet is `phase2-process/chunk-analysis.json`.

Examples that feel human-credible:
- `0-5s`: opening glitch text and generic trailer language being a turnoff for an impatient viewer is believable.
- `40-105s`: repeated high-excitement / low-boredom reads on the dense action montage feel right for this persona.
- `120-130s`: title/upsell/Vault Edition screens reading as boredom spikes is highly believable.

These chunk summaries are short, concrete, and actually useful for edit review.

### 2) The top-line recommendation is good
`recommendation.json.text` is the clearest human-usable output in the packet. The advice to:
- rebuild the first 5 seconds,
- model more of the cut on the energetic middle,
- and avoid ending on dense promo screens,

matches the chunk-level evidence and matches normal human trailer instincts.

### 3) Metrics are directionally useful at the top level
`metrics.json` and `summary.json` are useful as lightweight rollups when read cautiously:
- average excitement is strong,
- boredom is elevated enough to suggest avoidable drag,
- the low point around `125s` lines up with the static promo block.

These are good as summary indicators, not as final truth for every derived field.

## Weak areas / obvious truth mismatches

### 1) `emotional-analysis` appears to mishandle boredom normalization
This is the clearest human-review failure.

In `phase2-process/chunk-analysis.json`, several strong action chunks correctly score boredom at `1/10`:
- `40-45s` (`chunkIndex 8`)
- `65-70s` (`chunkIndex 13`)
- `80-85s` (`chunkIndex 16`)
- `90-95s` (`chunkIndex 18`)
- `100-105s` (`chunkIndex 20`)

But in `phase3-report/emotional-analysis/emotional-data.json`, those same chunks show boredom at `1.0` and often become boredom-dominant or high-scroll-risk moments.

Examples:
- `chunkIndex 8` / `40-45s`: phase 2 boredom = `1/10`, emotional-analysis boredom = `1.0`
- `chunkIndex 16` / `80-85s`: phase 2 boredom = `1/10`, emotional-analysis boredom = `1.0`
- `chunkIndex 18` / `90-95s`: phase 2 boredom = `1/10`, emotional-analysis boredom = `1.0`

From a human perspective, this is plainly wrong. Those are among the most exciting sections, not the most boring.

### 2) Downstream `criticalMoments` are therefore not trustworthy
Because the boredom values are wrong, `criticalMoments` and related scroll-risk interpretations inherit false positives.

Current examples that look wrong to a human reviewer:
- boredom threshold-high moments at `40s`, `65s`, `80s`, `90s`, and `100s`
- those moments are actually the trailer's strongest action stretch, not likely skip points

This means the artifact may be internally self-consistent, but it is not human-credible truth.

### 3) `frictionIndex: 100` reads overstated
The top-line recommendation identifies real problems, but a friction index of `100` reads too absolute given that the middle of the trailer is consistently strong.

Human take:
- the trailer has clear weak zones,
- but it is not wall-to-wall friction,
- so `100` feels more like an artifact of derived math / thresholding than a trustworthy human severity score.

### 4) Acceptance evidence is contradictory
The current repo state is confusing:
- `.logs/cod-test-20260326-1235-ee-dn02.log` shows a benchmark failure: `0/2 artifacts passed. 80/227 scoreable fields passed.`
- `benchmarks/fixtures/cod-test/_reports/benchmark-summary.json` still says the benchmark passed `6/6 artifacts` with full accuracy.

For human review and future gold-truth hardening, the 2026-03-26 rerun log is the more useful acceptance artifact because it reflects the current mismatch reality. The saved benchmark summary appears stale or at least not synchronized with the failing rerun outcome.

### 5) Some recommendation details are useful but too brittle for strict truth
The recommendation includes highly specific claims such as:
- `weird butterfly visual`
- `visible green-screen corridor moment`
- exact example inserts like `wingsuit/mech material` or `cyberpunk parkour`

These may be directionally fine, but they are the kind of specifics that can drift between runs or be slightly hallucinated. They are better treated as **advisory prose** than as exact gold-truth targets.

## Candidate fields for human gold-truth edits

### Highest priority
1. `output/cod-test/phase3-report/emotional-analysis/emotional-data.json`
   - `chunkAnalysis[*].emotions.boredom`
   - `chunkAnalysis[*].dominantEmotion`
   - `chunkAnalysis[*].scrollRisk`
   - `chunkAnalysis[*].scrollRiskLevel`
   - `criticalMoments[*]`
   - `summary.averageScrollRisk`

2. Any benchmark truth derived from the above emotional-analysis fields
   - especially fields currently rewarding false boredom spikes in the strongest action chunks

### Medium priority
3. `output/cod-test/phase3-report/metrics/metrics.json`
   - review whether `frictionIndex` should remain gold-truthed as-is
   - review peak-moment semantics if they are being inferred from unstable downstream transforms

4. `output/cod-test/phase3-report/recommendation/recommendation.json`
   - keep the top-line recommendation intent
   - avoid gold-truthing overly specific illustrative examples unless a human explicitly confirms them from the source video

### Lower priority
5. `output/cod-test/phase3-report/summary/summary.json`
   - mostly fine as a container
   - ensure it does not harden stale metadata or derived fields known to be wrong downstream

6. `output/cod-test/phase3-report/summary/FINAL-REPORT.md`
   - human-readable and useful
   - but it should not be treated as the authoritative truth surface where the underlying JSON is still unstable

## Recommended handoff stance

Use the current packet as:
- **good bootstrap truth** for chunk summaries and top-line editorial direction
- **bad gold truth** for emotional-analysis-derived boredom / scroll-risk / critical-moment claims
- **partial gold-truth candidate** for recommendation intent, but not for every concrete noun/example in the prose

If only a small first hardening pass is done, the best human-value move is:
1. fix or manually override the clearly wrong emotional-analysis boredom/critical-moment truth,
2. mark brittle prose fields as bootstrap/advisory rather than strict truth,
3. treat the 2026-03-26 rerun log as the current acceptance artifact until benchmark report generation is made consistent.
