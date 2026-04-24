# Current dialogue vs benchmark audit — 2026-04-24

## Verdict

**The dominant remaining drift is in the raw dialogue/transcript/segmentation layer, not primarily in the traits/grouping layer.**

The traits/grouping lane is also weak, but it is mostly operating on an already-drifted dialogue surface: wrong line boundaries, missing truth lines, merged lines, lyric leakage in the raw capture, and text substitutions that shift downstream alignment.

---

## Files audited

### Benchmark truth / comparator
- `benchmarks/fixtures/cod-test/truth/dialogue-data.json`
- `benchmarks/fixtures/cod-test/truth/speaker-grouping.json`
- `benchmarks/fixtures/cod-test/truth/speaker-grouping.reconciled-runtime-aligned.json`
- `benchmarks/fixtures/cod-test/_reports/artifact-results/dialogueData.json`
- `benchmarks/fixtures/cod-test/_reports/artifact-results/speakerGrouping.json`
- `benchmarks/fixtures/cod-test/_reports/benchmark-summary.md`

### Current output artifacts
- `output/cod-test/phase1-gather-context/dialogue-data.reconciled.json`
- `output/cod-test/phase1-gather-context/dialogue-v3-source-truth.reconciled.json`
- `output/cod-test/phase1-gather-context/speaker-grouping.json`
- `output/cod-test-dialogue-structural-sanity/phase1-gather-context/dialogue-data.json`

### Contracts / design docs
- `docs/2026-04-20-cod-test-dialogue-source-truth-contract.md`
- `docs/2026-04-20-cod-test-derived-speaker-grouping-provenance-contract.md`
- `docs/2026-04-14-dialogue-line-traits-contract.md`

---

## Strongest evidence that the drift is upstream in dialogue capture / segmentation

### 1) Segment count is wrong before grouping

- Truth has **20** spoken dialogue segments in `benchmarks/fixtures/cod-test/truth/dialogue-data.json`.
- Current reconciled dialogue surface has **17** segments in `output/cod-test/phase1-gather-context/dialogue-v3-source-truth.reconciled.json`.
- The dialogue comparator records this directly in `benchmarks/fixtures/cod-test/_reports/artifact-results/dialogueData.json`:
  - `dialogue_segments` length mismatch: **truth=20, output=17**
  - `15` text failures
  - `3` unmatched truth segments
  - `184` total failed scoreable fields

That means the benchmark is already off at the line inventory / segmentation layer.

### 2) The raw/current dialogue output still shows lyric leakage and extra non-dialogue lines

`output/cod-test-dialogue-structural-sanity/phase1-gather-context/dialogue-data.json` has **29** segments, including music-vocal lines that should not be in dialogue at all, for example:
- index `13`: `Obey your master.`
- index `14`: `Come crawling faster.`
- index `15`: `Master of puppets, I'm pulling your strings.`
- index `16`: `Twisting your mind and smashing your dreams.`
- index `17`: `Blinded by me, you can't see a thing.`
- index `18`: `Just call my name, 'cause I'll hear you scream.`
- index `19`: `Master, master.`
- index `20`: `Just call my name, 'cause I'll hear you scream.`
- index `21`: `Master, master.`
- index `27`: `Obey your master.`

The truth contract in `docs/2026-04-20-cod-test-dialogue-source-truth-contract.md` explicitly says lyrics/chants belong in `music-vocals-data.json`, not dialogue. So the raw capture is still contaminating the dialogue lane before traits/grouping even start.

### 3) The current dialogue surface has clear split / merge / missing / wording drift

Concrete examples from truth vs current reconciled output:

#### Split where truth expects one line
- Truth `dialogue-data.json` index `0`:
  - `They want you afraid. Fear makes you easier to control.`
- Current `dialogue-v3-source-truth.reconciled.json` indexes `0` and `1`:
  - `They want you afraid.`
  - `Fear makes you easier to control.`

This alone shifts all subsequent index-based comparisons.

#### Merge where truth expects two lines
- Truth index `4`: `Menendez is a terrorist.`
- Truth index `5`: `We're bringing peace and security to the world.`
- Current reconciled index `5`:
  - `Menendez is a terrorist. We're bringing peace and security to the world.`

#### Missing spoken truth line
- Truth index `9`: `You shall know fear.`
- No matching line appears in either:
  - `output/cod-test/phase1-gather-context/dialogue-v3-source-truth.reconciled.json`
  - `output/cod-test-dialogue-structural-sanity/phase1-gather-context/dialogue-data.json`

#### Wording corruption / substitution
- Truth index `7`:
  - `Stop looking backwards, David. What matters is what we do next.`
- Raw current index `7`:
  - `Stop looking backwards, David. What matters is what you do next.`
- Reconciled current index `7`:
  - `Stop looking backwards, David, but matters is what we do next.`

#### Punctuation / wording drift on end-card line
- Truth index `19`:
  - `Get the Reznov challenge pack when you preorder now!`
- Raw current index `28`:
  - `Get the Reznov challenge pack when you pre-order now.`
- Reconciled current index `16`:
  - `Get the Reznov challenge pack when you pre-order now.`

#### Additional wording drift
- Truth index `16`:
  - `Killing a man is a hell of a lot easier than killing the idea.`
- Raw current index `24` / reconciled current index `13`:
  - `Killing a man is a hell of a lot easier than killing an idea.`

These are raw dialogue-surface problems, not grouping problems.

### 4) Comparator alignment failure points are dialogue-boundary failures

`benchmarks/fixtures/cod-test/_reports/artifact-results/dialogueData.json` marks these truth segments as unmatched:
- truth index `17`: `You were never cut out to be a Mason.`
- truth index `18`: `No more games! This ends now.`
- truth index `19`: `Get the Reznov challenge pack when you preorder now!`

The report reason is: **`Unmatched truth segment: no plausible time-aware output match`**.

That is explicit evidence that the benchmark cannot reliably line up the current output to truth before any higher-level grouping judgment.

---

## Speaker / grouping issues that do exist

The grouping layer is still bad, but it looks downstream of the dialogue drift plus weak trait evidence.

### 1) Grouping comparator still shows mismatches

`benchmarks/fixtures/cod-test/_reports/artifact-results/speakerGrouping.json` reports:
- `mismatch_count: 15`
- categories:
  - `grouping_assignment_mismatch: 13`
  - `runtime_missing_segment_for_truth_index: 2`

The two `runtime_missing_segment_for_truth_index` mismatches are already admitted by the report as pre-grouping failures:
- segment index `18`
- segment index `19`
- rationale: `this points to segmentation/boundary drift before grouping`

### 2) Current grouping output is unstable because the dialogue/traits surface is weak

The current runtime grouping file `output/cod-test/phase1-gather-context/speaker-grouping.json` creates **14 speaker groups for 17 segments**, which is already a sign that continuity evidence is not stable.

At the same time, the speaker-grouping comparator’s normalized runtime projection in `benchmarks/fixtures/cod-test/_reports/artifact-results/speakerGrouping.json` collapses most assignments into just **2 groups**:
- `first_segment_000` with segment indexes `[0,1,2,3,4,5,6,8,9,10,11,12,13,14,15,16]`
- `first_segment_007` with segment indexes `[7,17]`

That mismatch pattern is consistent with a poor upstream evidence surface: the grouping lane is not seeing enough reliable line-local information to preserve distinct speakers.

---

## Traits-only issues

There **are** traits-layer problems, but they do not look like the primary source of benchmark drift.

### 1) Most current traits are low-information / defaulted

In `output/cod-test/phase1-gather-context/dialogue-v3-source-truth.reconciled.json`, many segments are dominated by `unknown` values for:
- `gender_presentation`
- `age_impression`
- `pitch_band`
- `phonation`
- `pace`
- `energy`

Example: current reconciled index `0` (`They want you afraid.`) has:
- `gender_presentation: unknown`
- `age_impression: unknown`
- `pitch_band: unknown`
- `phonation: unknown`
- `pace: unknown`
- `energy: unknown`
- `spatial_texture: room`
- `affect: fearful`
- `interpersonal_stance: neutral`

But truth index `0` expects:
- `gender_presentation: feminine`
- `age_impression: adult`
- `pitch_band: mid`
- `phonation: clear`
- `pace: measured`
- `energy: steady`
- `spatial_texture: close`
- `affect: serious`
- `interpersonal_stance: confrontational`

### 2) Trait mismatches are numerous, but mostly on already-misaligned lines

`benchmarks/fixtures/cod-test/_reports/artifact-results/dialogueData.json` shows:
- `164` trait-field failures
- but those sit on top of:
  - wrong segment count
  - 15 text mismatches
  - missing/unmatched truth segments
  - prior split/merge drift

So the high trait mismatch count is real, but it is not clean evidence that the traits system is the **main** remaining problem. Much of it is attached to already wrong or shifted lines.

---

## Bottom line

**Answer to Derrick’s focus question:** the differences are **primarily in the raw dialogue output / transcript / segmentation layer**.

The strongest evidence is:
1. current reconciled dialogue has the wrong segment count (**17 vs truth 20**);
2. the raw current dialogue still includes lyric lines that should not be in dialogue at all;
3. the current output has clear split/merge/missing/wrong-wording examples before grouping;
4. even the grouping comparator flags some misses as segmentation drift before grouping;
5. the traits/grouping layer is weak, but it is mostly reacting to an already corrupted dialogue surface with many `unknown` traits.

So the highest-leverage next fix is still the **dialogue capture/reconciliation layer**: get the spoken line inventory and boundaries exactly aligned to truth first, then judge grouping/traits quality on top of that cleaner surface.
