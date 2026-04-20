# cod-test dialogue traits human-review packet — 2026-04-20

## Purpose

This note is the durable human-review handoff for the clean-break Phase 1 dialogue truth reset in `benchmarks/fixtures/cod-test/truth/dialogue-data.json`.

This is **QA/review prep only**. It does **not** re-migrate the file or claim final gold alignment by itself. The goal is to tell Derrick exactly what to listen for before treating the new traits-mode file as settled gold truth.

---

## Current readiness read

**Verdict:** structurally ready for human review, with a small set of semantic judgment calls still worth Derrick's ears.

What is already in good shape:
- file matches the locked clean-break traits contract
- validator passes on the current file
- `dialogue_segments.length === 20`
- no obvious lyric/chant leakage was found in `dialogue-data.json`
- spoken dialogue vs music-vocals boundary is materially cleaner than the legacy truth surface
- uncertainty is mostly represented honestly with `unknown`, `mixed`, or `variable` instead of fake precision

What still needs human confirmation:
- accent abstention choices on Menendez-coded lines
- whether line 9 should remain `processed_or_synthetic` + `reverberant`
- whether line 17 should keep the current heavy abstention / overlap posture
- whether the expository/promo reads are best labeled `performative` versus `neutral`
- whether any line-local affect or stance should be tightened after a fresh listen

---

## Gold truth vs non-gold boundaries

### Gold truth in `truth/dialogue-data.json`

These fields are intended to become the authoritative human-reviewed source truth for the spoken-dialogue lane:
- top-level `summary`
- `dialogue_segments[*].index`
- `dialogue_segments[*].text`
- every closed field inside `dialogue_segments[*].traits`

Important nuance:
- `unknown`, `mixed`, and `variable` **can still be gold truth** when they honestly represent perceptual uncertainty.
- Gold here means “human-reviewed and intentionally chosen,” not “maximally specific.”

### Scaffold / non-gold / derived surfaces

These should **not** be treated as the primary truth Derrick is editing in this pass:
- `truth/speaker-grouping.json`
- `truth/speaker-grouping.reconciled-runtime-aligned.json`
- runtime `speaker_id` assignments
- grouping labels / group keys / assignment ledgers
- benchmark `_reports/*`
- old speaker-profile assumptions from the legacy truth artifact

Those surfaces are downstream comparators or deterministic projections. If Derrick changes dialogue gold truth, those surfaces should be regenerated or re-compared later rather than hand-edited first.

---

## Explicit manual-review checklist

Use this as the direct listening checklist.

### 1) Menendez-related accent abstention

Review indexes:
- `2` — "Your streets, shall once again run red with your blood."
- `9` — "You shall know fear."
- `15` — "So eager to leave David."
- `16` — "Killing a man is a hell of a lot easier than killing the idea."

Current posture:
- all four keep `accent_strength: unknown`
- all four keep `accent_family: unknown`

What to verify manually:
- is the current abstention still the most honest read after a fresh listen?
- if not, is there enough audible evidence to move only to a **conservative** stronger label such as:
  - `accent_strength: subtle_non_neutral` or `clear_non_neutral`
  - `accent_family: hispanic` or another family bucket
- do **not** tighten this just because the character is Raul Menendez narratively; only tighten if the line itself audibly supports it

Recommended default if still uncertain:
- keep the current abstention posture exactly as-is

### 2) Line 9 filtered threat read

Review index:
- `9` — "You shall know fear."

Current traits worth special attention:
- `audibility: partially_masked`
- `transmission_medium: processed_or_synthetic`
- `spatial_texture: reverberant`
- `accent_*: unknown`

What to verify manually:
- does the voice actually sound electronically filtered / mediated enough to justify `processed_or_synthetic`?
- is the space itself reverberant, or is the effect more just filter/distortion without room bloom?
- should `phonation: strained` stay, or is `raspy` / `clear` more faithful?

Recommended change threshold:
- only downgrade `processed_or_synthetic` or `reverberant` if a fresh listen makes those effects feel clearly overstated

### 3) Overlapping Mason line

Review index:
- `17` — "You were never cut out to be a Mason."

Current high-abstention posture:
- `audibility: partially_masked`
- `overlap: competing_overlap`
- `gender_presentation: mixed`
- `age_impression: unknown`
- `pitch_band: variable`
- `phonation: mixed`
- `transmission_medium: processed_or_synthetic`
- `spatial_texture: unknown`
- `accent_*: unknown`

What to verify manually:
- is this line still best represented as a blended/competing overlap rather than a single stable speaker read?
- is `gender_presentation: mixed` still the safest description, or does one layer clearly dominate enough to collapse to `feminine` or `masculine`?
- does `processed_or_synthetic` still fit, or is the line more naturally just chaotic direct overlap?

Recommended default if still messy:
- keep the current high-abstention posture
- do not promote a crisp single-speaker identity unless the audio clearly supports it

### 4) Expository / promo stance labeling

Review indexes:
- `3` — "Raul Menendez ignited global unrest on an unprecedented scale."
- `4` — "Menendez is a terrorist."
- `5` — "We're bringing peace and security to the world."
- `16` — "Killing a man is a hell of a lot easier than killing the idea."
- `19` — "Get the Reznov challenge pack when you preorder now!"

Current stance calls:
- `3`: `interpersonal_stance: performative`
- `4`: `interpersonal_stance: performative`
- `5`: `interpersonal_stance: performative`
- `16`: `interpersonal_stance: performative`
- `19`: `interpersonal_stance: performative`

What to verify manually:
- do these lines feel like addressed/public-facing VO or promo rhetoric (`performative`)?
- or are any of them better treated as simply `neutral` because they do not feel interpersonally aimed?

My QA read:
- `3`, `4`, `5`, and `19` are defensible as `performative`
- `16` is the one I would re-listen to most carefully; it may stay `performative`, but `taunting` or `serious`/`neutral`-adjacent could be arguable depending on how directly it feels addressed

### 5) Dialogue/music-vocals boundary sanity check

What to verify manually:
- confirm no sung or chanted lyric content leaked into `dialogue-data.json`
- confirm the chant/lyric lane still lives only in `truth/music-vocals-data.json`

Current QA finding:
- no obvious lyric fragments such as `master`, `puppets`, `obey`, `strings`, or `lies` appear in the dialogue truth file
- the runtime-aligned grouping truth still shows the expected extra runtime lyric block around segment 11, which is appropriate for the separate music-vocals lane rather than a dialogue truth bug

### 6) Low-risk spot checks worth doing while already listening

These are not red flags, just cheap confirmations:
- `7` / `10` / `11`: are the current `anglophone_non_neutral` calls still warranted, or should any of them be softened?
- `14`: does `gender_presentation: feminine` still feel right on "Pull it together, man!" or should it stay unknown?
- `6`, `8`, `18`: does the David/younger-male cluster still sound internally consistent at the trait level without forcing speaker identity into gold truth?

---

## Line-by-line watchlist summary

### High-priority review items
- `2` — Menendez threat line: accent abstention
- `9` — filtered threat line: processed/synthetic + reverberant call
- `16` — expository/antagonist line: accent abstention + `performative` vs another stance
- `17` — Mason overlap line: keep high-abstention posture?
- `19` — preorder CTA: `performative` still correct

### Medium-priority review items
- `3`, `4`, `5` — expository / propaganda phrasing still best as `performative`?
- `7`, `10`, `11` — accent-family confidence on non-neutral anglophone reads
- `14` — feminine read confidence

---

## Benchmark and comparator follow-up after Derrick edits

If Derrick changes any gold fields in `truth/dialogue-data.json`, the following downstream surfaces should be refreshed or rechecked.

### Must rerun / refresh
- `benchmarks/fixtures/cod-test/dialogue-only/_reports/*`
  - because this is the narrowest direct comparator against the dialogue truth file
- `benchmarks/fixtures/cod-test/_reports/artifact-results/dialogueData.json`
- `benchmarks/fixtures/cod-test/_reports/benchmark-summary.{json,md}`
  - at minimum if the full cod-test benchmark packet is being treated as current evidence

### Very likely needs regeneration or at least re-comparison
- `benchmarks/fixtures/cod-test/truth/speaker-grouping.reconciled-runtime-aligned.json`
  - especially if any trait changes affect grouping-relevant line-local evidence
- `benchmarks/fixtures/cod-test/truth/speaker-grouping.json`
  - legacy grouping truth projection / audit anchor may also need refresh for consistency
- `benchmarks/fixtures/cod-test/_reports/artifact-results/speakerGrouping.json`
- `benchmarks/fixtures/cod-test/_reports/artifact-results/speakerGrouping.miss-clusters.json`

### Usually does **not** need change from this review alone
Unless Derrick also changes non-dialogue truth or reruns the full product pipeline:
- `truth/music-vocals-data.json`
- `truth/music-data.json`
- `truth/metrics.json`
- `truth/emotional-analysis.json`
- `truth/recommendation.json`

### Important interpretation note
If Derrick only edits gold dialogue truth and does **not** rerun the live pipeline, then refreshed benchmark surfaces will reflect:
- new truth vs existing output artifacts

They will **not** prove runtime model improvement by themselves.

---

## Human-review outcome applied — 2026-04-20

The following human-confirmed gold-truth edits were applied directly to `truth/dialogue-data.json`:

- `index 2`
  - `accent_strength: clear_non_neutral`
  - `accent_family: hispanic`
- `index 4`
  - `interpersonal_stance: confrontational`
- `index 5`
  - `interpersonal_stance: confrontational`
- `index 6`
  - `spatial_texture: unknown`
  - `affect: tense`
  - `interpersonal_stance: neutral`
- `index 7`
  - `accent_strength: none_apparent`
  - `accent_family: neutral_or_unmarked`
- `index 8`
  - `spatial_texture: unknown`
- `index 10`
  - `accent_strength: clear_non_neutral`
  - `accent_family: anglophone_non_neutral`
- `index 11`
  - `accent_strength: clear_non_neutral`
  - `accent_family: anglophone_non_neutral`
- `index 16`
  - `accent_strength: none_apparent`
  - `accent_family: neutral_or_unmarked`
  - `interpersonal_stance: neutral`
- `index 18`
  - `spatial_texture: unknown`
  - `affect: angry`
  - `interpersonal_stance: confrontational`

Explicit keep decisions preserved without change:
- `index 3` kept `interpersonal_stance: performative`
- `index 9` kept all current values
- `index 14` kept `gender_presentation: feminine`
- `index 17` kept all current values
- `index 19` kept `interpersonal_stance: performative`

Post-edit validator result:
- `validateDialogueV3SourceTruthObject(...).ok === true`
- `errorCount === 0`
- `dialogue_segments.length === 20`

Status note:
- human-review truth updates are now applied and validated
- downstream reruns were intentionally **not** started in this pass

## Recommended next step after review

1. Use this updated `truth/dialogue-data.json` as the settled gold truth for the next narrow comparator refresh.
2. Re-run the dialogue-focused comparator first.
3. Rebuild speaker-grouping truth/comparator surfaces if the confirmed edits materially affect grouping evidence.
4. Only then let the broader audit lane decide whether the benchmark base is settled enough for the next execution slice.

---

## QA bottom line

The new `dialogue-data.json` looks ready to hand to Derrick as the active spoken-dialogue gold-review surface.

The file does **not** look like another migration pass is needed first.

The remaining work is human semantic confirmation on a few deliberately conservative calls, not structural repair.
