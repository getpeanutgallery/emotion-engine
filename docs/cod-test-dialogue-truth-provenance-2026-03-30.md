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
- in the follow-up reviewed wording pass, the targeted speaker-profile grounding text for `spk_003`, `spk_008`, and `spk_013`, with `spk_012`, `spk_014`, and `spk_015` explicitly kept as already-approved wording
- in the follow-up timing sanity pass, `dialogue_segments[*].start` / `end` were explicitly re-approved as currently stored for segments `0` through `28`, and segment `29` was corrected from `2:07-2:08` to `2:07-2:10`
- in the follow-up summary-only pass, `summary` was replaced with approved human-reviewed overview prose aligned to the corrected dialogue order and themes
- in the follow-up confidence pass, `dialogue_segments[*].confidence` for segments `0` through `29` were updated from untouched scaffold values to human-reviewed confidence judgments derived from Derrick's line-by-line review, using rounded benchmark-friendly numbers and preserving uncertainty rather than fake calibration
- `cleanedTranscript`, regenerated from the revised ordered segment list
- `handoffContext`, rewritten to reflect the corrected registry and to preserve uncertainty instead of hiding it

## Bootstrap-derived or lightly carried-forward fields

These fields were kept as minimal scaffold rather than promoted to "fully reviewed gold" status:

- `dialogue_segments[*].confidence` outside the reviewed `0..29` cod-test sequence would still be scaffold if present; for the current reviewed sequence, those values are now human-reviewed confidence judgments derived from the review conversation rather than untouched bootstrap numerics
- `speaker_profiles[*].label` — generic `Speaker N` labels kept for schema parity with pipeline output style
- `speaker_profiles[*].grounded.confidence` — pragmatic truth-shaping values, not a fresh confidence adjudication exercise
- `totalDuration` — carried forward from existing fixture context; even after the timing sanity pass this was not a duration remeasurement task
- `summary` — no longer bootstrap-carried after the follow-up human-reviewed summary-only pass; it is now approved human-reviewed overview prose, while still remaining compact and pipeline-shaped
- the reviewed `dialogue_segments[*].confidence` numerics are still editorial judgment calls for benchmark honesty, not mathematically calibrated probabilities

## Intentionally uncertain fields / decisions

Where the human review was uncertain, the truth was made honest rather than overconfident:

- `spk_003` keeps an authoritative male expository/briefing read, but the identity remains intentionally open: it could be the older African-American general/leader or a separate one-off expository speaker, and there is still not enough confidence to merge it
- `spk_014` (`"You shall know fear."`) is kept as an older processed antagonist-coded male voice and **not** promoted to confirmed Raul identity
- `spk_008` now treats both comms lines (`"Specter one, report."` / `"Need a sitrep."`) as the same younger male comms speaker based on human review, while preserving the African-American read as an audible-pronunciation cue rather than hard fact
- `spk_013` (`"Killing the man..."`) stays a distinct uncertain white male-sounding montage voice tied to Frank Woods visual imagery and is **not** collapsed into Raul, David, or Woods as fact
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
- human-reviewed segment timings are editorially accurate, but still approximate enough that benchmark comparison should allow roughly `1-2` seconds of fuzziness for otherwise-correct model outputs

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
- many confidence-like numeric fields outside `dialogue_segments[*].confidence` remain scaffold-ish or lightly adjudicated rather than deeply calibrated human truth
- non-dialogue benchmark artifacts in this fixture (recommendation, chunk-analysis, metrics, emotional-analysis) still contain substantial bootstrap truth and should not be treated as equally trustworthy semantic regression signals

So the right reading is: use `cod-test` dialogue truth as the main source-owned regression guard for dialogue prompt work now, but keep a human in the loop and expand the corpus before making broad claims about prompt quality across all cases.
