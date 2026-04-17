# Dialogue v3 deterministic proof gates and required evidence bundle

**Date:** 2026-04-17  
**Status:** Locked before first real cod-test interpretation

## Purpose

This note defines the exact deterministic evidence bundle that must exist before the first real `cod-test` interpretation is trusted.

The goal is simple: no real run gets interpreted semantically until the source-truth boundary, ruleset boundary, reducer/scorer/ledger seam, and cod-test golden grouping truth surface are all proven on deterministic fixtures.

## Required proof gates

### Gate 1 — source-truth rejection fixtures must be green

These fixtures must continue to reject invalid source truth:
- `test/fixtures/dialogue-v3-proof-gates/source-truth/reject-forbidden-fields.json`
- `test/fixtures/dialogue-v3-proof-gates/source-truth/reject-superseded-traits.json`

These fixtures must continue to validate cleanly:
- `test/fixtures/dialogue-v3-proof-gates/source-truth/valid-dialogue-data.json`

Operational meaning:
- grouping-owned fields must not leak into persisted `dialogue-data`
- superseded v2 names/values must not silently sneak through
- the validator seam must fail closed before any grouping logic runs

### Gate 2 — ruleset loader/compiler rejection fixtures must be green

These fixtures must continue to reject invalid rulesets:
- `test/fixtures/dialogue-v3-proof-gates/ruleset/reject-unknown-key.yaml`
- `test/fixtures/dialogue-v3-proof-gates/ruleset/reject-bad-enum.yaml`

Operational meaning:
- unknown keys stay fail-closed
- invalid enum references stay fail-closed
- the locked predicate vocabulary is enforced before any reducer/scorer run is trusted

### Gate 3 — micro reducer/scorer/ledger fixture must be green

The deterministic micro-fixture is:
- `test/fixtures/dialogue-v3-proof-gates/grouping/micro-clean-reuse-dialogue-data.json`

This fixture must continue to prove:
- first segment creates a group
- second segment cleanly reuses that group
- third segment creates a new group after a deterministic blocker-triggered rejection
- one decision-ledger row exists per assignment

Operational meaning:
- the reducer state, scoring, blocker evaluation, action resolution, and ledger emission are all still coherent as one bounded unit

### Gate 4 — cod-test golden speaker-grouping truth surface must be explicit

The explicit checked-in golden truth file is now:
- `benchmarks/fixtures/cod-test/truth/speaker-grouping.json`

It is derived from the human-reviewed source truth at:
- `benchmarks/fixtures/cod-test/truth/dialogue-data.json`

Projection/comparator support lives at:
- `server/lib/dialogue-v3-speaker-grouping-benchmark.cjs`

The checked-in truth file must remain exactly reproducible from these source paths:
- `dialogue_segments[*].index`
- `dialogue_segments[*].speaker_id`
- `speaker_profiles[*].speaker_id`
- `speaker_profiles[*].grounded.linked_segment_indexes`
- `speaker_profiles[*].label`

Operational meaning:
- cod-test grouping truth is no longer implicit prose or buried inside legacy dialogue comparison reports
- the truth surface is now durable, explicit, and comparator-ready

### Gate 5 — comparator smoke must be green

The comparator projection must prove both:
- a perfect normalized runtime `speaker-grouping` artifact matches `truth/speaker-grouping.json`
- a deliberate partition drift produces a deterministic mismatch

Operational meaning:
- the approval lane is artifact-level grouping comparison, not hand-wavy eyeballing

## Exact evidence bundle required before the first real run is trusted

All of the following must exist together:

1. **Validator evidence**
   - green deterministic source-truth proof-gate test output
2. **Ruleset evidence**
   - green deterministic ruleset proof-gate test output
3. **Reducer/scorer/ledger evidence**
   - green deterministic micro-fixture test output
4. **Golden truth surface**
   - checked-in `benchmarks/fixtures/cod-test/truth/speaker-grouping.json`
5. **Projection/comparator evidence**
   - green proof that checked-in cod-test truth matches the projection derived from `truth/dialogue-data.json`
   - green proof that a perfect normalized runtime artifact passes comparison
   - green proof that a deliberate grouping drift fails comparison
6. **Run metadata for any future real interpretation**
   - exact config path: `configs/cod-test.yaml`
   - exact ruleset path/version
   - exact source truth artifact path
   - exact runtime `speaker-grouping` artifact path
   - exact decision-ledger artifact path
   - exact comparator report output path

If any item above is missing, stale, or red, the first real run is **not trusted** and must be treated as blocked.

## Minimum validation command set

At minimum, this proof-gate lane should stay green:

```bash
node --test \
  test/lib/dialogue-v3-source-truth-validator.test.js \
  test/lib/dialogue-v3-heuristics-ruleset.test.js \
  test/lib/dialogue-v3-speaker-grouping.test.js \
  test/lib/dialogue-v3-proof-gates.test.js
```

## Approval posture

The first real cod-test interpretation is unlocked only when the deterministic proof-gate lane above is green **and** the checked-in cod-test golden grouping truth remains projection-consistent.
