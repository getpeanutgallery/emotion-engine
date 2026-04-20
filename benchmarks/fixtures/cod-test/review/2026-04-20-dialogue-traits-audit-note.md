# cod-test dialogue truth clean-break audit note — 2026-04-20

## Scope

Independent audit of the active `benchmarks/fixtures/cod-test/truth/dialogue-data.json` reset against `docs/2026-04-20-cod-test-dialogue-source-truth-contract.md`, with checks on legacy/archive separation, dialogue vs music-vocals separation, and benchmark follow-up coherence.

---

## Verdict

**Pass with one explicit residual follow-up.**

The active `dialogue-data.json` is now a clean-break Phase 1 traits-mode source-truth artifact and is a sound base for:
- Derrick's human correction pass
- the next dialogue-focused benchmark rerun

It is **not yet a sound base for claiming fully refreshed grouping/comparator parity** until the sibling `speaker-grouping*.json` derived artifacts are regenerated or revised to stop advertising removed legacy source paths.

---

## What passed

### 1) Active source truth matches the locked contract

Observed in `truth/dialogue-data.json`:
- top-level keys are exactly `schema_version`, `contract`, `summary`, `dialogue_segments`
- `contract` is `artifact: "dialogue-data"`, `mode: "traits"`, `traits_contract_version: "3.0.0"`
- `dialogue_segments.length === 20`
- validator passes via `server/lib/dialogue-v3-source-truth-validator.cjs` (`ok: true`)
- a legacy-key scan found **no** `_benchmark`, `speaker_profiles`, `handoffContext`, `cleanedTranscript`, `totalDuration`, `speaker`, `speaker_id`, `start`, `end`, `confidence`, `group_id`, or similar fields inside the active file

### 2) No obvious legacy contract leakage remains in active source truth

The active file keeps ownership where it belongs:
- gold source truth = summary + line text + closed per-line traits
- no speaker labels / ids in source truth
- no timing ownership in source truth
- no confidence / handoff / grouping payloads in source truth

This satisfies the locked source-truth vs deterministic-grouping boundary.

### 3) Legacy cod-test remains archived reference only

The prior speaker-oriented truth still exists under:
- `benchmarks/fixtures/.archived/cod-test (legacy)/truth/dialogue-data.json`

That archived file still carries the old speaker/timing/confidence/profile contract, which is appropriate as history/reference and no longer defines the active lane.

### 4) Dialogue vs music-vocals separation is preserved

Observed:
- `truth/dialogue-data.json` summary explicitly says lyrics/chants remain in `music-vocals-data.json`
- a quick lyric-term sanity scan of the dialogue file found no `master` / `puppets` / `strings` / `lies` / `obey` leakage
- `truth/music-vocals-data.json` still owns the lyric/chant lane

This preserves the intended split.

### 5) Benchmark follow-up guidance is coherent

The QA packet's recommended sequence is directionally correct:
1. Derrick reviews targeted watchlist items in `truth/dialogue-data.json`
2. apply any confirmed gold edits there
3. rerun the dialogue-focused comparator first
4. refresh grouping/comparator projections if confirmed edits materially affect grouping evidence

That order matches the contract boundary and avoids treating derived grouping outputs as first-class gold truth.

---

## Residual gap / risk

### Derived grouping artifacts still advertise legacy source-field assumptions

Both sibling grouping truth files are explicitly non-gold derived artifacts, but their metadata still references removed legacy source fields such as:
- `dialogue_segments[*].speaker_id`
- `speaker_profiles[*].speaker_id`
- `speaker_profiles[*].grounded.linked_segment_indexes`
- `speaker_profiles[*].label`

Those references appear in:
- `truth/speaker-grouping.json`
- `truth/speaker-grouping.reconciled-runtime-aligned.json`

That means the **active source-truth file is clean**, but the **derived grouping surfaces are still carrying stale legacy provenance language**. This is a documentation/projection follow-up, not a blocker for Derrick's human correction pass.

### Risk interpretation

- **Low risk** for the immediate human review of `dialogue-data.json`
- **Low risk** for a dialogue-only rerun whose purpose is to compare active output against the new gold truth
- **Moderate risk** if someone treats the current `speaker-grouping*.json` files as already fully refreshed evidence of the new contract boundary without regenerating them

---

## Readiness call

### Ready now
- Derrick human correction pass on `truth/dialogue-data.json`
- next dialogue-focused rerun / comparator refresh

### Follow-up still needed soon
- regenerate or revise `truth/speaker-grouping*.json` so their projection metadata no longer points at removed legacy source fields before using grouping-specific benchmark claims as settled evidence

---

## Bottom line

The clean break succeeded where it mattered most: the active `dialogue-data.json` truth surface now honors the locked traits-only source-truth contract and keeps dialogue/music-vocals separation intact.

The remaining honesty note is that the sibling grouping projections still need a cleanup/regeneration pass to align their provenance metadata with the new source-truth world.
