# Dialogue v3 Task 7 QA — deterministic gates and dialogue-only structural sanity

**Date:** 2026-04-17  
**Bead:** `ee-ke8y`  
**Status:** Deterministic gates green; dialogue-only structural sanity blocked; first semantic interpretation still blocked

## Scope

This QA pass executed the locked deterministic proof-gate lane first, then attempted the dialogue-only cod-test structural sanity pass required before any semantic interpretation of the first full slice.

This note is intentionally structural, not semantic. It records what ran, what passed, what failed, and which gates remain unmet.

## References used

- `.plans/2026-04-16-ee-gqnc-v3-traits-execution-plan.md`
- `docs/2026-04-17-dialogue-v3-proof-gates-evidence-bundle.md`
- `docs/2026-04-15-dialogue-traits-v2-targeted-eval-slice.md`
- `docs/2026-04-15-dialogue-traits-v2-calibration-artifact.md`
- `docs/2026-04-16-v3-traits-proposal-qa-red-team.md`
- `configs/cod-test.yaml`
- `benchmarks/fixtures/cod-test/`
- `test/lib/dialogue-v3-proof-gates.test.js`

## Commands run and exact outcomes

### 1) Deterministic proof-gate suite

```bash
node --test \
  test/lib/dialogue-v3-source-truth-validator.test.js \
  test/lib/dialogue-v3-heuristics-ruleset.test.js \
  test/lib/dialogue-v3-speaker-grouping.test.js \
  test/lib/dialogue-v3-proof-gates.test.js
```

**Outcome:** pass
- 31 tests passed
- 0 failed
- 0 errored
- duration: ~129.8 ms

Operationally, this kept the validator rejection fixtures, ruleset rejection fixtures, micro reducer/scorer/ledger fixture, golden truth projection, and comparator smoke lane green.

### 2) Archived dialogue-only baseline config check

```bash
node server/run-pipeline.cjs --config configs/archive/cod-test-dialogue-benchmark-baseline.yaml --verbose
```

**Outcome:** failed before run execution
- config validation error
- benchmark manifest path resolved incorrectly from `configs/archive/`
- attempted path: `configs/benchmarks/fixtures/cod-test/dialogue-only/benchmark.json`

This was a config pathing issue, not the dialogue comparator itself.

### 3) Dialogue-only structural sanity rerun with repo-local QA config

A task-local config was created at:
- `configs/cod-test-dialogue-structural-sanity.yaml`

Then run:

```bash
node server/run-pipeline.cjs --config configs/cod-test-dialogue-structural-sanity.yaml --verbose
```

**Outcome:** pipeline Phase 1 completed, benchmark stage errored
- dialogue extraction completed in whole-asset mode
- output artifact: `output/cod-test-dialogue-structural-sanity/phase1-gather-context/dialogue-data.json`
- reported dialogue segments: 29
- benchmark summary: `benchmarks/fixtures/cod-test/dialogue-only/_reports/benchmark-summary.json`
- artifact report: `benchmarks/fixtures/cod-test/dialogue-only/_reports/artifact-results/dialogueData.json`
- benchmark status: `error`
- scoreable fields passed: `47/206`
- truth coverage: `206/208`

## Structural sanity result

**Structural sanity did not pass cleanly.**

The dialogue-only benchmark did not merely show semantic misses; it still produced structural blockers that must be cleared before the first semantic interpretation is trusted.

### Structural blocker summary

1. **`cleanedTranscript` missing from output**
   - artifact report status escalated to `error`
   - exact benchmark error:
     - `cleanedTranscript`: output object missing field present in truth

2. **Dialogue segment count drifted from truth**
   - truth: 20 dialogue segments
   - output: 29 dialogue segments
   - benchmark recorded a structural array length mismatch

3. **Spoken dialogue output leaked music-vocal lines / extra non-truth dialogue**
   Unmatched output segments included lines such as:
   - `Just call my name, 'cause I'll hear you scream.`
   - `Master, master.`
   - `Obey your master.`

   This is not acceptable for the dialogue-only truth surface, which explicitly says sung heavy-metal lyrics must not be scored in `dialogueData`.

4. **Speaker-profile structure drifted materially**
   - truth speaker profiles: 13
   - output speaker profiles: 9
   - multiple unmatched truth profiles and unmatched output profiles were recorded
   - several output inferred-trait fields also drifted into speculative role/gender-presentation language that does not match the current truth surface

## Targeted expressive rerun gate status

The targeted expressive rerun gate is **still unmet**.

I checked the repo for a runnable targeted eval package and found only the design docs:
- `docs/2026-04-15-dialogue-traits-v2-targeted-eval-slice.md`
- `docs/2026-04-15-dialogue-traits-v2-calibration-artifact.md`
- `docs/2026-04-16-v3-traits-proposal-qa-red-team.md`

I did **not** find:
- a repo-local asset pack for the slice
- a reviewer sheet template
- a 3-run execution harness
- prior run artifacts proving the gate green

So this gate cannot honestly be marked complete yet.

## Interpretation posture

Do **not** interpret the first full cod-test slice semantically yet.

Current truthful status:
- deterministic proof gates: **green**
- targeted expressive reruns: **not yet runnable / not green**
- dialogue-only structural sanity: **red**

That means the first semantic interpretation remains blocked.

## Follow-on work created

Two concrete follow-on beads were opened:

1. `ee-m4eq` — **Assemble runnable targeted expressive eval slice and 3-run review harness**
2. `ee-i4a1` — **Fix dialogue-only cod-test structural blockers before first semantic interpretation**

## Durable evidence paths

- Task 7 QA note: `docs/2026-04-17-dialogue-v3-task7-deterministic-gates-and-structural-sanity.md`
- Dialogue-only run artifact: `output/cod-test-dialogue-structural-sanity/phase1-gather-context/dialogue-data.json`
- Dialogue benchmark summary JSON: `benchmarks/fixtures/cod-test/dialogue-only/_reports/benchmark-summary.json`
- Dialogue benchmark summary MD: `benchmarks/fixtures/cod-test/dialogue-only/_reports/benchmark-summary.md`
- Dialogue artifact-level report: `benchmarks/fixtures/cod-test/dialogue-only/_reports/artifact-results/dialogueData.json`

## Bottom line

Task 7 succeeded in proving the deterministic seams are green, but it did **not** unlock semantic interpretation.

The blocked state is now explicit and evidence-backed:
- one missing/misaligned structural field (`cleanedTranscript`)
- dialogue/music-vocal boundary leakage
- speaker-profile structural drift
- no runnable targeted expressive rerun package yet
