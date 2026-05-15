# Phase 3 forensic note after Phase 1/2 drift

**Date:** 2026-05-14  
**Bead:** `ee-x211`  
**Role:** `research`

## Executive call

Today’s Phase 3 red surface is **not** the March 2026 failure class.

Back then, the main problem was **Phase 3 runtime / JSON production reliability**: recommendation output could fail to validate, the tool-loop/recovery path needed hardening, and Phase3-only live runs were not yet trustworthy. The archived March notes (`REF-07`, `REF-08`, `REF-09`) all point at that lane.

Today, the fresh repaired `cod-test` packet proves a different situation:

- Phase 2 now truthfully emits the canonical `phase2-process/chunk-analysis.json` proof artifact again (`REF-02`, `REF-05`).
- Phase 3 now **runs and emits all expected artifacts** (`REF-04`, `REF-06`).
- The current benchmark red is a mix of:
  1. **one real Phase 3 consumer bug** caused by stale score semantics,
  2. **stale benchmark truth** that still reflects older Phase 1/2-era packet meaning,
  3. **report presentation drift** that makes current Phase 3 output look less truthful than it is.

So the narrow honest repair lane is **not** “redo March’s recommendation JSON hardening.” That would be rediscovering old fixes blindly.

---

## What changed since the earlier Phase 3 repair burst

The archived March work focused on making Phase 3 recommendation generation survive real provider output:

- validator-loop / JSON repair hardening,
- malformed envelope recovery,
- live Phase3-only validation,
- deciding whether full `cod-test` was safe next.

That work mattered, but today’s fresh outputs show it is **not** the active blocker:

- `output/cod-test/phase3-report/recommendation/recommendation.json` exists and is parseable.
- `output/cod-test/phase3-report/metrics/metrics.json` exists.
- `output/cod-test/phase3-report/emotional-analysis/emotional-data.json` exists.
- `output/cod-test/phase3-report/summary/summary.json` exists.
- `output/cod-test/phase3-report/summary/FINAL-REPORT.md` exists.

So the current question is no longer “can Phase 3 produce JSON?” It can. The real question is “which Phase 3 consumers still interpret upstream truth incorrectly, and which benchmark surfaces are now stale?”

---

## Forensic findings by artifact class

### 1) `metrics.json` has a real consumer bug against current Phase 2 semantics

**Artifact:** `output/cod-test/phase3-report/metrics/metrics.json`  
**Status:** **True Phase 3 consumer drift**  
**Severity:** **Highest**

#### What is wrong

`metrics.cjs` normalizes emotion scores like this:

- if `rawScore <= 1`, it treats the value as already normalized `0..1`
- otherwise it divides by `10`

That was survivable only if upstream Phase 2 sometimes emitted normalized fractions. The fresh repaired packet in `REF-05` emits integer emotion scores on a **1..10** scale. Under that contract, a literal upstream score of `1` means **1/10**, not **100%**.

So current Phase 3 metrics misread any exact score of `1` as maximal `1.0`.

#### Concrete evidence

Current Phase 2 chunk truth (`REF-05`):

- chunk 19 / `95-100s`: boredom = `1`, excitement = `10`
- chunk 23 / `115-120s`: boredom = `1`, excitement = `9`

Those are obviously **low boredom** action beats in the fresh packet.

But current `metrics.json` reports:

- `boredom.highest.timestamp = 95`
- boredom trend = `increasing`
- boredom averages = `0.328571...`

That only happens because exact `1` values are being interpreted as `1.0` instead of `0.1`.

If the current Phase 2 packet is normalized honestly from `score / 10`, the same fresh packet yields:

- boredom average ≈ `0.2643`
- boredom highest timestamp = `125`
- boredom first-half average ≈ `0.2643`
- boredom second-half average ≈ `0.2643`
- boredom trend is effectively **flat**, not increasing

So `metrics.json` is not just benchmark-red; it is semantically wrong for the fresh upstream packet.

#### Why this matters

This is the narrowest real Phase 3 breakage because downstream Phase 3 prose trusts these derived metrics.

---

### 2) `emotional-data.json` inherits the same score-semantics bug

**Artifact:** `output/cod-test/phase3-report/emotional-analysis/emotional-data.json`  
**Status:** **True Phase 3 consumer drift**  
**Severity:** **Highest (same root cause as metrics)**

#### What is wrong

`emotional-analysis.cjs` uses the same normalization rule as `metrics.cjs`, so it makes the same mistake when current Phase 2 emits exact score `1` values.

#### Concrete evidence

Current `emotional-data.json` claims structural moments like:

- boredom threshold-high at `95s`, chunk `19`
- boredom threshold-high at `115s`, chunk `23`
- excitement threshold-high at `130s`, chunk `26`
- boredom threshold-low at `130s`, chunk `26`

Those first two are artifacts of the bad `1 => 1.0` interpretation, not truthful readings of the fresh packet.

The same file also reports:

- `criticalMomentsCount = 11`
- `averageScrollRisk = 0.39357...`

Yet the benchmark truth for emotional analysis expects a different older moment set (`criticalMomentsCount = 13`) because that truth file was authored against an older semantic packet. So the artifact is getting hit by **both**:

1. a real current consumer bug, and
2. stale benchmark truth.

#### Why this matters

This artifact directly drives the benchmark’s `scroll_risk_timeline_pct` and `critical_moments_pct`, both currently at `0.0%`. Not all of that red is Phase 3’s fault, but the exact-score normalization bug is.

---

### 3) `recommendation.json` is mostly benchmark debt, with one narrow inherited drift

**Artifact:** `output/cod-test/phase3-report/recommendation/recommendation.json`  
**Status:** **Mostly stale benchmark truth; minor downstream drift from bad metrics**  
**Severity:** **Medium**

#### What is still truthful

The current recommendation is clearly grounded in the fresh packet’s visible end-slate drag:

- title-card friction around `10-15s`
- promotional boredom around `120-130s`
- action-heavy center staying strong

That matches `REF-05` and `REF-06` much better than the older benchmark truth does.

#### What is stale / misleading

Two narrower issues remain:

1. **It inherits a false metrics narrative**
   - current reasoning says boredom shows an increasing trend,
   - but that trend is being distorted by the exact-score normalization bug in metrics.

2. **It references internal zero-based chunk IDs in human prose**
   - reasoning cites `chunks 2, 24, and 25`,
   - while the final report renders human-facing section headers as `Chunk 1`, `Chunk 2`, etc. using `chunkIndex + 1`.
   - So the prose mixes internal zero-based indexing with one-based display numbering.

#### Why the benchmark is still so red

The loudest benchmark failures here are structural stale-truth misses:

- missing legacy truth key finding about the end-slate,
- missing three older truth suggestions at the tail,
- full-text / reasoning mismatches.

That is not evidence of another March-style Phase 3 generation failure. It is mainly evidence that `benchmarks/fixtures/cod-test/truth/recommendation.json` still encodes older packet semantics and older editorial expectations.

---

### 4) `FINAL-REPORT.md` is materially misleading in presentation even where upstream data is usable

**Artifact:** `output/cod-test/phase3-report/summary/FINAL-REPORT.md`  
**Status:** **True Phase 3 presentation drift**  
**Severity:** **Medium**

#### What is wrong

The final report still presents normalized averages as if they were raw 1..10 scores:

- table header says `Average Score (1-10)`
- displayed values are `0.3`, `0.8`, `0.7`
- emoji bars are built from `Math.round(value)` on those normalized values

So the report currently mixes:

- chunk-level scores shown on a real 1..10 scale, and
- aggregate averages shown on a 0..1 scale but labeled as 1..10

That is materially misleading even if the underlying JSON were corrected.

#### Additional presentation drift

The report reproduces recommendation prose with zero-based chunk references (`chunks 2, 24, 25`) while the per-chunk sections are one-based (`Chunk 1`, `Chunk 2`, ...). That makes the markdown harder to trust for human review.

#### Important distinction

This is **not** the main source of benchmark red, because the benchmark scores JSON artifacts, not this markdown report. But it is still a truthful Phase 3 repair target because it makes the fresh packet look more confused than it actually is.

---

### 5) `summary.json` is mostly a pass-through summary of the current Phase 3 state

**Artifact:** `output/cod-test/phase3-report/summary/summary.json`  
**Status:** **Mostly okay; inherits recommendation + metrics drift**  
**Severity:** **Low**

This file mostly republishes:

- metadata,
- current metrics summary,
- current recommendation summary,
- report paths.

So it is not independently broken. Its problems are inherited from the metrics/recommendation issues above.

---

## Benchmark debt vs true Phase 3 drift

### A) True Phase 3 consumer drift

These are real Phase 3 bugs / stale consumers that should be repaired in code or report shaping:

1. **Exact-score normalization bug** in metrics/emotional-analysis
   - exact `1` is interpreted as normalized `1.0` instead of `0.1`
   - corrupts boredom peaks, trends, critical moments, and scroll risk
2. **Final report aggregate scale labeling bug**
   - normalized `0..1` averages labeled as `1..10`
3. **Human-facing chunk reference drift**
   - recommendation/final report prose uses zero-based chunk identifiers while report sections are one-based
4. **Recommendation prose inherits bad metrics trend wording**
   - likely resolves once metrics semantics are corrected or recommendation is taught to avoid repeating misleading derived trend language

### B) Phase 1/2 benchmark debt masquerading as Phase 3 red

These red areas are mostly stale benchmark truth or earlier-phase semantics drift, not current Phase 3 consumer failure:

1. `benchmarks/fixtures/cod-test/truth/recommendation.json`
   - still expects older wording/findings/suggestion emphasis
2. `benchmarks/fixtures/cod-test/truth/metrics.json`
   - reflects a different upstream emotional profile than the fresh repaired packet
3. `benchmarks/fixtures/cod-test/truth/emotional-analysis.json`
   - expects a different critical-moment set and scroll-risk profile than the fresh repaired packet
4. broader benchmark red in `dialogueData`, `dialogueDataRaw`, `musicData`, `musicVocalsData`, and `chunkAnalysis`
   - these are upstream benchmark debt and should not be blamed on Phase 3

### C) Strong evidence that some benchmark truth is now internally stale

The benchmark truth no longer even forms a perfectly coherent current-world packet across layers:

- `truth/chunk-analysis.json` and `truth/emotional-analysis.json` disagree about which timestamps should become boredom/excitement threshold events.
- today’s fresh output packet in `REF-05` clearly supports the new end-slate interpretation (`120-130s` boredom), while some truth expectations still encode older mid/late semantics.

So blindly “fixing Phase 3 until benchmark green” would risk forcing honest current consumers back toward stale truth.

---

## Ranked breakages

### Rank 1 — Fix first
**Metrics + emotional-analysis exact-score normalization bug**

Why first:
- one root cause,
- real current semantic error,
- contaminates two JSON artifacts plus downstream prose,
- narrow repair with high truth payoff.

### Rank 2 — Fix second
**Final report / human-facing presentation drift**

Specifically:
- normalized averages mislabeled as `1-10`,
- internal zero-based chunk references leaking into human prose.

Why second:
- does not change benchmark core by itself,
- but materially improves truthfulness of the main human review surface.

### Rank 3 — Re-check recommendation after Rank 1**

Do **not** start by rewriting recommendation logic broadly.

Instead:
- repair the metrics/emotional-analysis semantics first,
- rerun Phase 3,
- then inspect whether recommendation still carries false trend wording or whether the fix collapses most of the drift automatically.

### Rank 4 — Only then decide benchmark truth refresh scope

Once current Phase 3 consumers are semantically honest, re-audit:

- `truth/recommendation.json`
- `truth/metrics.json`
- `truth/emotional-analysis.json`

This should be treated as **benchmark truth maintenance**, not as proof that current Phase 3 logic is still broken.

---

## Narrowest truthful repair order

1. **Repair the exact-score normalization contract in Phase 3 derived consumers**
   - target: metrics + emotional-analysis first
   - goal: treat fresh Phase 2 emotion scores consistently as 1..10 source values
2. **Rerun the smallest honest Phase 3 validation lane**
   - confirm `metrics.json`, `emotional-data.json`, `summary.json`, and `FINAL-REPORT.md` on the same fresh packet
3. **Repair report presentation drift**
   - aggregate averages must either be scaled to 1..10 or relabeled as 0..1
   - human prose should not leak zero-based chunk IDs
4. **Only then decide whether recommendation needs a narrow wording adjustment**
   - mainly for inherited trend wording after metrics correction
5. **After Phase 3 semantics are honest, treat remaining red as benchmark-truth refresh work**
   - especially recommendation / metrics / emotional-analysis truth artifacts

---

## Bottom line

The real failure surface is narrower than the benchmark summary makes it look.

- **Do not redo March’s Phase 3 JSON/recovery work.** That class is not the current blocker.
- **Do fix the exact-score semantics bug first.** That is the highest-confidence real Phase 3 consumer drift against the fresh repaired packet.
- **Do fix the final report’s scale/index presentation next.** It is misleading even when the JSON survives.
- **Treat most remaining recommendation/metrics/emotional-analysis benchmark red as stale truth debt until proven otherwise.**

That is the narrowest truthful repair order.
