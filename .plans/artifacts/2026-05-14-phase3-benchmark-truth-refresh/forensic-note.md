# Phase 3 benchmark-truth refresh forensic note

**Date:** 2026-05-14  
**Bead:** `ee-hoqm`  
**Role:** `research`

## Scope

Design the narrow benchmark-truth refresh lane for the current repaired `cod-test` Phase 3 packet. This note identifies:

- which benchmark truth fixtures are stale
- which specific expectations must be retired
- the refresh order
- the exact files to touch
- whether comparator / matcher code changes are required now

## Sources checked

- `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/.plans/2026-05-14-phase3-benchmark-truth-refresh.md`
- `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/.plans/artifacts/2026-05-14-phase3-repair-after-phase1-phase2-drift/audit-summary.md`
- `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/benchmarks/fixtures/cod-test/_reports/benchmark-summary.md`
- `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/benchmarks/fixtures/cod-test/_reports/benchmark-summary.json`
- `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/benchmarks/fixtures/cod-test/_reports/artifact-results/metricsData.json`
- `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/benchmarks/fixtures/cod-test/_reports/artifact-results/emotionalAnalysisData.json`
- `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/benchmarks/fixtures/cod-test/_reports/artifact-results/recommendationData.json`
- `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/benchmarks/fixtures/cod-test/benchmark.json`
- `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/output/cod-test/phase2-process/chunk-analysis.json`
- `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/output/cod-test/phase3-report/metrics/metrics.json`
- `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/output/cod-test/phase3-report/emotional-analysis/emotional-data.json`
- `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/output/cod-test/phase3-report/recommendation/recommendation.json`
- `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/output/cod-test/phase3-report/summary/FINAL-REPORT.md`
- `/home/derrick/.openclaw/workspace/memory/2026-05-04.md`

## Executive conclusion

The current red benchmark state is dominated by **stale truth fixtures**, not by an active Phase 3 logic/comparator bug.

For the current repaired packet, **fixture refresh alone is sufficient** to realign the benchmark surface for:

- `metrics`
- `emotional-analysis`
- `recommendation`

No matcher/comparator code change is required to score the **current repaired canonical outputs** honestly.

However:

- `recommendation` remains inherently brittle because the benchmark currently scores prose/list items with normalized fuzzy string equality plus index/structural list checks.
- That brittleness is a **separate acceptance-design problem**, not a blocker to this refresh lane.
- Treat any broader semantic matcher work as optional follow-up, not part of the narrow refresh.

## Forensic findings by artifact

### 1) Metrics truth is stale and should be fully refreshed

**Truth file:**
- `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/benchmarks/fixtures/cod-test/truth/metrics.json`

**Current runtime output:**
- `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/output/cod-test/phase3-report/metrics/metrics.json`

**Why it is stale**

The current truth still encodes the pre-repair emotional packet shape. The current runtime metrics are consistent with the repaired Phase 2 chunk packet and the audit summary.

**Stale expectations to retire**

Retire these truth expectations from `truth/metrics.json`:

- `averages.boredom = 0.42857142857142855`
- `peakMoments.patience.highest.timestamp = 75`
- `peakMoments.patience.lowest.timestamp = 0`
- `peakMoments.boredom.highest.timestamp = 75`
- `peakMoments.boredom.highest.score = 1`
- `peakMoments.boredom.lowest.timestamp = 5`
- `peakMoments.excitement.highest.timestamp = 5`
- `peakMoments.excitement.lowest.timestamp = 120`
- `trends.boredom.direction = increasing`
- `trends.boredom.change = 0.24285714285714283`
- `trends.boredom.secondHalfAverage = 0.5499999999999999`
- `trends.excitement.direction = stable`

**Refresh target surface**

Refresh the truth file to the current repaired output values, anchored to the current Phase 2 packet:

- boredom average ≈ `0.26428571428571423`
- patience peak at `55s`
- boredom peak at `125s` with score `0.8`
- boredom low at `95s` with score `0.1`
- excitement peak at `55s` with score `1`
- excitement low at `125s` with score `0.2`
- boredom trend becomes `stable`
- excitement trend becomes `increasing`

**Judgment**

This is a pure fixture refresh. No comparator change needed.

---

### 2) Emotional-analysis truth is stale and should be fully refreshed

**Truth file:**
- `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/benchmarks/fixtures/cod-test/truth/emotional-analysis.json`

**Current runtime output:**
- `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/output/cod-test/phase3-report/emotional-analysis/emotional-data.json`

**Why it is stale**

The existing truth still encodes the old corrupted packet where exact integer `1` values behaved like normalized `1.0`, which fabricated high-boredom lanes in multiple chunks.

The repaired runtime output now matches the corrected packet shape:

- early opener is no longer a catastrophic boredom spike
- `75-80s`, `95-100s`, and `115-120s` are no longer boredom=`1.0` lanes
- the dominant negative lane moves to the promo stretch at `120-130s`

**Stale expectations to retire**

Retire these stale families from `truth/emotional-analysis.json`:

1. **Opening chunk misread**
   - chunk `0` expectations that force `patience=0.2`, `boredom=0.8`, `scrollRisk=0.70`, `scrollRiskLevel=high`, dominant emotion `boredom`

2. **False boredom-peak family**
   - chunk `15` boredom=`1`, dominant boredom, high-risk expectation
   - chunk `19` boredom=`1`, dominant boredom, high-risk expectation
   - chunk `23` boredom=`1`, dominant boredom, high-risk expectation
   - chunk `27` boredom=`1`, dominant boredom, high-risk expectation

3. **Late-promo/post-promo misplacement**
   - chunk `24` expecting excitement low at `0.3` instead of the repaired `0.5`
   - chunk `25` expecting balanced `0.5/0.5/0.7` instead of the repaired strongest negative lane (`patience=0.3`, `boredom=0.8`, `excitement=0.2`)
   - chunk `26` expecting low patience / moderate boredom / high excitement instead of repaired rebound (`0.8/0.2/0.9`)
   - chunk `27` expecting boredom `1` instead of repaired `0.2`

4. **Critical moment set that must be retired**
   Remove old critical-moment keys that exist only because of stale truth, especially:
   - `timestamp=75,emotion=boredom,type=threshold-high,chunkIndex=15`
   - `timestamp=115,emotion=boredom,type=threshold-high,chunkIndex=23`
   - `timestamp=95,emotion=boredom,type=threshold-high,chunkIndex=19`
   - `timestamp=95,emotion=excitement,type=threshold-high,chunkIndex=19`
   - `timestamp=80,emotion=boredom,type=threshold-low,chunkIndex=16`
   - `timestamp=100,emotion=boredom,type=threshold-low,chunkIndex=20`
   - `timestamp=120,emotion=excitement,type=threshold-low,chunkIndex=24`

**Refresh target surface**

Rebuild the full file from the current repaired output, including:

- `summary.criticalMomentsCount = 9`
- `summary.averageScrollRisk ≈ 0.4064285714285719`
- all `chunkAnalysis[*]` entries
- the entire `emotionalArc` family
- the full `scrollRiskTimeline`
- the exact repaired `criticalMoments` list:
  - `120 boredom threshold-high chunk 24`
  - `130 excitement threshold-high chunk 26`
  - `5 excitement threshold-high chunk 1`
  - `35 excitement threshold-high chunk 7`
  - `15 excitement threshold-high chunk 3`
  - `130 boredom threshold-low chunk 26`
  - `15 boredom threshold-low chunk 3`
  - `125 excitement threshold-low chunk 25`
  - `30 boredom threshold-low chunk 6`

**Judgment**

This is also a fixture refresh, not a comparator problem. The structural errors are coming from the stale truth keyset, not from broken matcher alignment.

---

### 3) Recommendation truth is stale and should be refreshed to the repaired packet story

**Truth file:**
- `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/benchmarks/fixtures/cod-test/truth/recommendation.json`

**Current runtime output:**
- `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/output/cod-test/phase3-report/recommendation/recommendation.json`

**Why it is stale**

The existing truth encodes an older editorial reading of the packet:

- it says the biggest retention leak is `0-5s`
- it still leans on earlier false boredom semantics
- it expects 6 key findings and 11 suggestions
- it expects a much longer and differently framed recommendation narrative

The repaired packet now tells a different, narrower story:

- early static title-card friction remains real, but the first chunk itself is no longer the worst boredom lane
- the strongest negative lane is the pre-order/promo stretch at `120-130s`
- the output recommendation is shorter, more concrete, and structured as `4` findings / `5` suggestions

**Stale expectations to retire**

Retire the entire old prose surface in `truth/recommendation.json`, including:

- the old `text`
- the old `reasoning`
- all `6` old `keyFindings`
- all `11` old `suggestions`

Specifically retire claims that depend on stale expectations, including:

- “The opening 0-5s is the biggest retention risk”
- “The 5-10s segment is the clearest hook model” as the canonical wording
- “Boredom increases significantly in the second half” tied to old numerical reasoning
- “85-95s Alaska/Hawaii transition” suggestion family as a required benchmark truth item
- the long suggestion set about 60-85s “wtf visuals” / end-slate parity as required exact list structure

**Refresh target surface**

Refresh the recommendation truth to the current repaired output surface:

- current `text`
- current `reasoning`
- `confidence = 0.9`
- `4` current `keyFindings`
- `5` current `suggestions`

Also use `FINAL-REPORT.md` only as a cross-check that the human-facing story matches the JSON recommendation story; do not derive benchmark truth from the markdown formatting.

**Judgment**

For this refresh lane, this is still a fixture refresh.

The comparator is strict and prose-brittle, but nothing in the current failure evidence proves a comparator bug. The current comparator is doing what it was configured to do: compare the truth prose/list surface to the output prose/list surface. The surface itself is stale.

## Matcher / comparator decision

### Required now

**No matcher/comparator code changes are required for this lane.**

Do **not** change:

- `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/server/lib/benchmark-runner.cjs`
- `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/benchmarks/fixtures/cod-test/benchmark.json`

Reason:

- `metrics` failures are value mismatches against stale truth
- `emotional-analysis` failures/errors are stale numeric/structural expectations, especially stale critical-moment keys
- `recommendation` failures/errors are stale prose and stale list cardinality

### Optional later follow-up, not part of this lane

If the team wants recommendation benchmarking to remain stable across future model paraphrase instead of snapshotting one canonical wording, open a separate acceptance-design lane later. That future lane could explore:

- semantic clustering for recommendation bullets
- rubric-based recommendation scoring
- looser list-cardinality rules
- citation/anchor-based recommendation acceptance instead of prose equality

That is **not** needed to refresh truth for the current repaired canonical packet.

## Recommended refresh order

1. **Refresh `metrics` truth first**
   - smallest surface
   - cleanest proof that stale peak/trend expectations are the issue
   - easiest first rerun sanity check

2. **Refresh `emotional-analysis` truth second**
   - largest stale surface
   - should be regenerated from the repaired output as a complete packet, not partially patched
   - especially important to replace the old `criticalMoments` set wholesale

3. **Refresh `recommendation` truth third**
   - update only after metrics/emotional-analysis truth is settled so the narrative references the same repaired packet story
   - snapshot the current canonical recommendation JSON as the refreshed truth for this lane

4. **Rerun benchmark and inspect reports**
   - regenerate `_reports/benchmark-summary.*`
   - verify remaining red, if any, is genuinely new and not stale truth residue

## Exact files to touch

### Files to edit directly in the refresh lane

- `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/benchmarks/fixtures/cod-test/truth/metrics.json`
- `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/benchmarks/fixtures/cod-test/truth/emotional-analysis.json`
- `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/benchmarks/fixtures/cod-test/truth/recommendation.json`
- `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/.plans/2026-05-14-phase3-benchmark-truth-refresh.md`

### Files that should be regenerated by rerun, not hand-edited

- `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/benchmarks/fixtures/cod-test/_reports/benchmark-summary.md`
- `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/benchmarks/fixtures/cod-test/_reports/benchmark-summary.json`
- `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/benchmarks/fixtures/cod-test/_reports/artifact-results/metricsData.json`
- `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/benchmarks/fixtures/cod-test/_reports/artifact-results/emotionalAnalysisData.json`
- `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/benchmarks/fixtures/cod-test/_reports/artifact-results/recommendationData.json`

### Files explicitly not to touch in this lane

- `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/server/lib/benchmark-runner.cjs`
- `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/benchmarks/fixtures/cod-test/benchmark.json`
- live output artifacts under `/output/cod-test/phase3-report/`

## Practical guidance for the coder lane

- Prefer replacing each stale truth file wholesale from the current repaired canonical output rather than hand-patching individual fields.
- For `emotional-analysis`, replace the complete truth packet so `chunkAnalysis`, `emotionalArc`, `scrollRiskTimeline`, and `criticalMoments` stay mutually consistent.
- For `recommendation`, accept that the refreshed truth will snapshot the current canonical wording and list structure. That is okay for this lane; do not widen scope into semantic matcher redesign.
- Keep any optional generation helper out of scope unless the coder can add it without delaying the narrow truth refresh.

## Bottom line

The benchmark-truth refresh lane should touch exactly three truth fixtures first:

1. `benchmarks/fixtures/cod-test/truth/metrics.json`
2. `benchmarks/fixtures/cod-test/truth/emotional-analysis.json`
3. `benchmarks/fixtures/cod-test/truth/recommendation.json`

Then rerun the benchmark and inspect regenerated reports.

For the **current repaired Phase 3 packet**, **fixture refresh alone is sufficient**. Comparator changes are optional future hardening, not required now.
