# V3 Traits Proposal — QA / Benchmark-Truth Red-Team Critique

**Date:** 2026-04-16  
**Reviewer:** QA / benchmark-truth red-team pass  
**Primary references:**
- `.plans/2026-04-16-v3-traits-implementation-proposal-and-red-team-review.md`
- `.plans/2026-04-15-implement-dialogue-traits-v2-and-run-cod-test-vertical-slice.md`
- `docs/2026-04-15-dialogue-traits-v2-calibration-artifact.md`
- `docs/2026-04-15-dialogue-traits-v2-targeted-eval-slice.md`
- `benchmarks/fixtures/cod-test/`

## Verdict

The proposal is directionally right, but **it is not yet QA-safe for the first real cod-test vertical-slice run**.

Right now the plan under-specifies how to:
- separate **parser/scorer/comparator bugs** from genuine upstream extraction/model misses
- avoid **misleading cod-test headlines** from unrelated or non-gold artifacts
- preserve the **minimum evidence bundle** needed to debug a bad run honestly
- define **go / no-go acceptance criteria** before the first end-to-end run

If execution starts without those gates, the first cod-test result is likely to produce a noisy score that looks authoritative but does not actually answer whether the v3 grouping seam worked.

---

## What the references already prove

### 1) The current cod-test benchmark can already fail for structural reasons that swamp semantic interpretation

The existing dialogue benchmark output shows structural and alignment failures, not just semantic misses:
- `benchmarks/fixtures/cod-test/dialogue-only/_reports/benchmark-summary.json` reports `status: error`
- `benchmarks/fixtures/cod-test/_reports/artifact-results/dialogueData.json` shows:
  - `dialogue_segments` length mismatch (`truth=20`, `output=32`)
  - a cascading index-alignment failure where early transcript segmentation drift causes many later text/speaker mismatches
  - a structural error on `cleanedTranscript`

This matters because the v3 plan proposes a new parser/scorer/ledger seam, but the current benchmark already demonstrates that **one segmentation or contract mismatch can avalanche into dozens of downstream “misses.”**

If that happens again, the resulting cod-test score will not cleanly answer:
- did the extractor miss the line?
- did the parser normalize it wrong?
- did the scorer group it wrong?
- did the comparator misalign the arrays?
- did the truth artifact assume an older shape?

### 2) The current cod-test fixture is not uniformly gold truth across artifacts

`benchmarks/fixtures/cod-test/fixture.json` explicitly says several truth artifacts are bootstrap truth copied from prior outputs rather than human-reviewed gold:
- `chunk-analysis`
- `metrics`
- `emotional-analysis`
- recommendation truth also ignores volatile debug/usage payloads

The full benchmark summary confirms how noisy this is:
- `benchmarks/fixtures/cod-test/_reports/benchmark-summary.md`
  - `0/6` artifacts passed
  - `emotionalAnalysisData` has only `3.5%` coverage
  - multiple artifacts are in `error`

So a full-benchmark headline is currently a **bad primary readiness signal** for the v3 dialogue/grouping seam. It mixes:
- unrelated surfaces
- partially bootstrapped truth
- low-coverage artifacts
- structural comparator problems

### 3) The v2 calibration/eval references already define stronger QA expectations than the v3 proposal currently carries forward

`docs/2026-04-15-dialogue-traits-v2-calibration-artifact.md` and `docs/2026-04-15-dialogue-traits-v2-targeted-eval-slice.md` already say the system should explicitly watch for:
- default-collapse patterns (`serious` swallowing `tense`, `happy` swallowing `amused`, etc.)
- honest abstention vs unsupported specificity
- approved alternates on boundary-heavy lines
- rerun stability across **3 repeated runs**
- preservation of run identifiers, prompt/model version, warnings, and full extracted line-level outputs

The v3 proposal mentions focused fixture cases and artifact preservation, but it does **not yet convert those expectations into concrete QA gates.**

---

## Main red-team findings

## 1) The plan could produce misleading cod-test results because it does not define the benchmark surface precisely enough

Phase A says the new source-truth envelope should reject forbidden fields such as `speaker_id` and timing. But the current cod-test dialogue truth still contains `speaker_id`, speaker-profile structures, and comparator expectations built around the legacy artifact shape in `benchmarks/fixtures/cod-test/truth/dialogue-data.json`.

That creates a major QA risk:
- the implementation may correctly enforce the new v3 boundary
- the benchmark may still expect old-shape dialogue artifacts
- the run then reports a benchmark `error` that looks like a regression
- but the “failure” is really an **interface mismatch between new artifact shape and old comparator/truth assumptions**

### QA implication
Before any real cod-test run, the plan must name which of these is being benchmarked:
1. the **legacy dialogue artifact** expected by the existing comparator
2. a **new v3 source-truth artifact** with a dedicated comparator
3. both, via a **temporary bridge / derived compatibility artifact**

Without that decision, cod-test can fail for reasons that say nothing about grouping quality.

## 2) The proposal does not yet isolate parser/scorer correctness from upstream extraction quality

The current cod-test evidence shows a classic cascade failure mode:
- upstream transcript segmentation drifts
- array lengths diverge
- positional comparison shifts
- later speaker/text diffs become mostly meaningless as scorer evidence

If the first v3 vertical slice is run only end-to-end from the video, the team will not know whether a miss came from:
- extraction/transcription
- parser normalization
- ruleset parsing
- deterministic grouping logic
- ledger emission
- truth/comparator alignment

### QA implication
The proposal needs **two separate validation lanes** before the first real end-to-end run:

#### Lane A — frozen-input scorer replay
Run the scorer/ledger against a frozen, already-reviewed dialogue input artifact so parser/scorer/ledger behavior can be validated without extractor noise.

#### Lane B — full end-to-end cod-test run
Run from the video only after Lane A passes, and classify misses as:
- extractor miss
- parser bug
- scorer bug
- comparator bug
- truth gap / truth migration issue

If Lane A is skipped, the first cod-test run will blur implementation bugs with model/extractor misses.

## 3) Fixture coverage is too weak for the actual v3 failure modes

The proposal’s Phase D names the right categories at a high level, but it is still too vague for deterministic QA.

The current cod-test fixture does **not** give strong controlled coverage for at least these v3-specific seams:
- old-field-name rejection
- forbidden-source-field rejection
- YAML predicate compatibility (`line_value`, `group_value`, membership/exclusion, blocker predicates)
- sentinel behavior for `unknown`, `mixed`, `variable`, `none_apparent`
- whispered vs non-whispered soft-review blocker posture
- abstention when gating cues degrade
- ledger completeness and reason-vocabulary correctness
- ambiguity handling when multiple candidate groups are plausible
- no-match / create-new-group behavior

### QA implication
Before cod-test, the repo needs a **purpose-built deterministic micro-fixture suite** for parser/scorer/ledger verification.

For deterministic code, these should be exact fixtures with exact expected outcomes, not fuzzy “looks reasonable” review.

## 4) The proposal is missing artifact-preservation requirements that are necessary to debug the first bad run honestly

Phase E says to preserve artifacts/replay/cassette evidence, but that is still too underspecified.

For this seam, the minimum evidence bundle should include:
- input asset identity / hash
- config path + config hash
- prompt version / prompt file path
- model id/version
- ruleset file path + hash
- validator version / commit SHA
- raw extractor output
- normalized parser input
- validated source-truth artifact
- scorer decision ledger
- comparator result JSON
- reviewer miss-classification note
- replay/cassette references
- exact command(s) used to run the slice

Without this bundle, a “bad” cod-test result becomes hard to reproduce and even harder to classify.

## 5) The proposal lacks concrete acceptance criteria before the first real vertical-slice run

Right now the plan says to do fixture verification and then run cod-test, but it does not say what must be true before that run is allowed.

That is a gap.

The first real vertical-slice run should not happen until the deterministic preconditions are satisfied.

---

## Recommended QA gates before the first real cod-test run

## Gate 0 — Benchmark-interface decision is explicit

Before implementation-run validation starts, record which benchmark surface is authoritative for this lane:
- legacy dialogue artifact
- new v3 artifact
- or compatibility bridge output

**Required evidence:**
- one short design note or plan update naming the benchmarked artifact(s)
- comparator/truth update scope explicitly listed

## Gate 1 — Parser / schema rejection fixtures pass 100%

Create deterministic fixtures that prove the validator rejects:
- forbidden old field names
- forbidden source-truth fields (`speaker_id`, timing, etc., if that remains the contract)
- malformed or unsupported YAML predicate shapes

**Required pass condition:** `100%`

**Required evidence:**
- fixture file paths
- exact validator output
- expected vs actual rejection reasons

## Gate 2 — Deterministic scorer + ledger fixtures pass 100%

Create micro-fixtures for:
- clean reuse
- ambiguity between multiple candidate groups
- abstention / no-link under degraded gating
- whispered vs non-whispered blocker case
- sentinel abstention cases
- no-match / create-new-group path
- candidate score ties or near-ties
- ledger reason vocabulary / completeness

**Required pass condition:** `100%`

Because this scorer is deterministic, near-miss language is not good enough.

**Required evidence:**
- input fixture
- expected assignment action
- expected candidate scores / blocker state summary
- emitted ledger artifact

## Gate 3 — Targeted expressive eval slice runs 3 times with explicit review

Carry forward the v2 targeted eval rules instead of treating them as optional background docs.

**Required pass condition:**
- run the same slice **3 times**
- no control-line over-labeling failures
- zero unsupported overlay inference from text-only evidence
- zero unsupported accent-family specificity on abstention cases
- rerun outputs stay within primary or approved-alternate sets for at least `90%` of reviewed target-field judgments

**Required evidence:**
- run ids
- prompt/model/ruleset identifiers
- per-asset reviewer sheet
- bucket summary with collapse patterns and honest-abstention notes

## Gate 4 — Dialogue-only cod-test run completes with no structural benchmark errors

Do **not** use the full 6-artifact aggregate as the first readiness gate for this lane.

First require a dialogue-focused run that finishes without:
- missing required fields
- incompatible artifact shape
- comparator structural error
- unclassified array-alignment failure

**Required pass condition:**
- `status` is not `error` for the dialogue benchmark surface
- every miss is classifiable into extractor / parser / scorer / comparator / truth-gap buckets

**Required evidence:**
- dialogue-only benchmark summary JSON/MD
- artifact-level diff output
- short miss-cluster note

## Gate 5 — Full cod-test benchmark is secondary, not primary

Only after the dialogue-specific gates pass should the full benchmark be used as a broader regression surface.

**Required interpretation rule:**
- recommendation / metrics / chunk-analysis / emotional-analysis scores must not be used as the primary acceptance signal for the v3 dialogue/grouping seam until their truth surfaces are known-good for this purpose

---

## Additional evidence requirements the current plan should add

For the first real vertical-slice attempt, require a durable run record that links:
- plan path
- bead id
- git commit SHA
- benchmark fixture version
- benchmark report path
- replay/cassette path
- ledger artifact path
- reviewer note path

This should be a durable doc artifact, not just terminal output.

---

## Concrete places the plan can confuse bug classes today

These are the main failure-mode confusions I would expect if the plan ran as currently written:

### A. Parser/comparator mismatch misread as grouping failure
If the new v3 artifact drops fields the old benchmark expects, the run can error structurally and be misread as “v3 failed.”

### B. Upstream segmentation drift misread as scorer regression
If transcript segmentation changes early, positional diffing makes many later speaker/text differences look like grouping failures when the scorer may never have seen comparable inputs.

### C. Truth-shape migration misread as model weakness
If the truth file still encodes older speaker/profile assumptions, an honest v3 output can be penalized for not matching the legacy representational shape.

### D. Overlay / affect / stance boundary collapse hidden by cod-test aggregate scores
The v2 calibration docs already say the real risk is collapse of `tense`, `amused`, `disgusted`, `taunting`, and overlays into safer defaults. A single aggregate cod-test score can hide those exact failure patterns.

### E. Non-gold artifacts diluting the signal
A poor full-benchmark headline can be caused by unrelated artifacts with bootstrap truth, masking real dialogue/grouping improvement.

---

## Recommended edits to the proposal

Add these requirements explicitly to the plan before execution:

1. **Name the benchmark surface.** State whether the first cod-test comparison is against a legacy-compatible artifact, a new v3 artifact, or both.
2. **Add a frozen-input scorer replay gate.** Do not rely on video-only end-to-end results to validate deterministic grouping.
3. **Promote the targeted eval slice into an explicit pre-cod-test gate.** Include 3 reruns, approved alternates, collapse tracking, and honest-abstention review.
4. **Require exact micro-fixture coverage for parser/scorer/ledger seams.** Especially blocker, sentinel, ambiguity, and rejection cases.
5. **Specify the evidence bundle.** Artifacts, hashes, run ids, comparator outputs, ledger, miss classifications, replay/cassettes.
6. **Demote the full 6-artifact cod-test aggregate to a secondary signal.** Dialogue-focused truth is the primary gate for this lane.
7. **Require miss classification after the first dialogue run.** Every miss must be labeled as extractor, parser, scorer, comparator, or truth-gap before any architecture decision is made.

---

## Bottom line

The proposal is close, but from a QA / benchmark-truth perspective it still needs one more hardening pass.

The core issue is simple:

> the current plan describes what to build, but it does not yet describe how to prove that the first bad cod-test result means the right thing.

Until the benchmark surface, deterministic gates, and evidence bundle are made explicit, the first real vertical-slice run is too likely to generate misleading evidence.
