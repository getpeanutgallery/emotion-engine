# cod-test dialogue truth provenance — 2026-03-30

This note records the first honest human-reviewed hardening pass for `benchmarks/fixtures/cod-test/truth/dialogue-data.json`.

## Why this exists

The dialogue truth payload must stay close to real pipeline output schema so the benchmark runner can compare it directly. That means it is a bad place to invent new provenance-only JSON fields that the pipeline does not emit.

So this pass uses a split approach:

- **Truth JSON** holds the corrected dialogue content in pipeline-shaped form.
- **This doc** records which parts are now human-reviewed gold truth, which parts remain bootstrap-derived scaffolding, and where uncertainty is intentionally preserved.

## Human-reviewed gold truth in this pass

Human review directly corrected or approved the following dialogue surfaces:

- `dialogue_segments[*].text` for segments `0` through `29` in the revised sequence
- `dialogue_segments[*].speaker_id` / `speaker` assignments for the revised sequence
- the post-segment-8 ordering reset, replacing the obviously wrong bootstrap continuation with the recovered actual-order lines
- `speaker_profiles[*].grounded.linked_segment_indexes` for the reviewed speakers used by those segments
- the most important `speaker_profiles[*].grounded.acoustic_descriptors` / `inferred_traits` needed to encode speaker separation honestly
- `cleanedTranscript`, regenerated from the revised ordered segment list
- `handoffContext`, rewritten to reflect the corrected registry and to preserve uncertainty instead of hiding it

## Bootstrap-derived or lightly carried-forward fields

These fields were kept as minimal scaffold rather than promoted to "fully reviewed gold" status:

- `dialogue_segments[*].confidence` — retained as benchmark-tolerant numeric scaffolding, not a separately human-verified scoring pass
- `speaker_profiles[*].label` — generic `Speaker N` labels kept for schema parity with pipeline output style
- `speaker_profiles[*].grounded.confidence` — pragmatic truth-shaping values, not a fresh confidence adjudication exercise
- `totalDuration` — carried forward from existing fixture context; this pass was about dialogue truth, not duration remeasurement
- `summary` — rewritten to stop reflecting the bad bootstrap order, but still treated as a compact derived overview rather than line-by-line editorial gold prose

## Intentionally uncertain fields / decisions

Where the human review was uncertain, the truth was made honest rather than overconfident:

- `spk_003` stays a separate expository speaker with inferred `male`, but is **not** merged with the later older general/leader
- `spk_014` (`"You shall know fear."`) is kept as an older processed antagonist-coded male voice and **not** promoted to confirmed Raul identity
- `spk_008` covers both comms lines (`"Specter one, report."` / `"Need a sitrep."`) because they are likely the same voice, but that reuse remains explicitly uncertain in notes
- `spk_013` (`"Killing the man..."`) stays a distinct uncertain white male-sounding montage voice and is **not** collapsed into Raul, David, or Woods as fact
- `spk_015` exists because `"You were never cut out to be a Mason."` is an overlap-heavy hallucination blend; treating it as a single clean identity would be dishonest
- sung `Master of Puppets` lines are separated from scene dialogue as `spk_011`
- the preorder tag is separated from scene dialogue and lyrics as promo VO `spk_016`

## Editorial rule used in this pass

When forced to choose between a clean benchmark shape and an honest benchmark shape, this pass chose honesty.

That means:

- unknown identity stayed unknown
- mixed voices stayed mixed
- lyrics stayed lyrics
- promo VO stayed promo VO
- human-reviewed corrections replaced obviously wrong bootstrap text even when that meant larger downstream sequence surgery

## How to use dialogue fixtures during future prompt iteration

When a dialogue-facing prompt changes, treat `benchmarks/fixtures/cod-test/truth/dialogue-data.json` as the first human-reviewed regression gate, not just as a convenient snapshot of whatever the model emitted last.

Recommended workflow:

1. run the prompt change against `cod-test`
2. compare the resulting dialogue artifact against the human-reviewed dialogue truth
3. inspect every benchmark failure in light of provenance instead of assuming all mismatches are equally meaningful
4. if the prompt change is genuinely better, update human-reviewed truth only after an explicit editorial review pass rather than silently refreshing the fixture from output
5. once more fixtures exist, repeat the same check across those human-reviewed dialogue fixtures so improvements for one trailer do not quietly regress another

### How to interpret regressions

Not every regression means the same thing.

- regressions on human-reviewed speaker assignment, reviewed line text/order, cleaned transcript alignment, or reviewed speaker-profile grounding should be treated as **high-signal prompt regressions** until a human decides the new output is actually better
- regressions limited to still-bootstrap fields should be treated as **investigation prompts**, not automatic proof that the prompt got worse
- regressions concentrated in intentionally uncertain areas (for example mixed/overlap-heavy lines or intentionally unknown identities) should be read as **low-confidence signals** unless they spill into reviewed identity/ordering surfaces
- a benchmark pass on bootstrap-heavy fields should never be over-interpreted as proof that the output is human-good; it only means the new output stayed close to the current scaffold

### Current confidence boundary

`cod-test` is now useful as a real dialogue regression fixture because it contains a first human-reviewed pass on the highest-value dialogue surfaces. But confidence is still intentionally bounded.

Current limits that still matter:

- only part of the dialogue payload has been promoted to human-reviewed gold truth
- `cod-test` is still just one fixture, so prompt changes can overfit this trailer if we treat one pass here as universal proof
- confidence-like numeric fields remain mostly scaffold, not deeply adjudicated human truth
- non-dialogue benchmark artifacts in this fixture (recommendation, chunk-analysis, metrics, emotional-analysis) still contain substantial bootstrap truth and should not be treated as equally trustworthy semantic regression signals

So the right reading is: use `cod-test` dialogue truth as the main source-owned regression guard for dialogue prompt work now, but keep a human in the loop and expand the corpus before making broad claims about prompt quality across all cases.
