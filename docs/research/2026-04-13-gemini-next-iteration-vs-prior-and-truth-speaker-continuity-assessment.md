# Gemini Next-Iteration Rerun vs Prior 2026-04-10 Runs and Truth: Speaker-Continuity Assessment

**Date:** 2026-04-13  
**Bead:** `ee-dttt`  
**Fresh run under review:** `ee-p9he`  
**Scope:** Dialogue speaker continuity only — fragmentation, singleton behavior, over-merge behavior, and line-level speaker assignment differences.

## Artifacts compared

### Fresh rerun
- `docs/research/2026-04-13-gemini-speaker-continuity-next-iteration-rerun.md`
- `output/cod-dialogue-compare-gemini-3.1-pro-preview/phase1-gather-context/dialogue-data.json`
- `output/cod-dialogue-compare-gemini-3.1-pro-preview/phase1-gather-context/script-results/get-dialogue.success.json`

### Prior 2026-04-10 references
- `docs/research/2026-04-10-gemini-speaker-continuity-rerun.md`
- `docs/research/2026-04-10-gemini-speaker-continuity-comparison-vs-truth.md`
- `docs/research/2026-04-10-gemini-approved-doc-vs-truth-speaker-continuity-assessment.md`

### Benchmark truth
- `benchmarks/fixtures/cod-test/truth/dialogue-data.json`

## Snapshot metrics

| Metric | 2026-04-10 continuity-hardened rerun | 2026-04-10 approved-doc rerun | 2026-04-13 next-iteration rerun | Truth |
|---|---:|---:|---:|---:|
| Dialogue segments | 29 | 32 | 32 | 20 |
| Distinct speaker IDs | 13 | 15 | 15 | 13 |
| Singleton speaker IDs | 8 | 10 | 9 | 9 |
| Speaker switches | 17 | 19 | 18 | 16 |
| Adjacent same-speaker pairs | 11 | n/a | 13 | 3 |
| Truth lines covered at high text similarity | 18/20 | 19/20 | 17/20* | 20/20 |
| Speaker matches on covered truth lines (raw ID) | 7 | 7 | 7 | 20 |

\* Fresh rerun coverage count is lower mainly because the new output splits a few truth-combined lines into shorter fragments and still substitutes the `You shall know fear.` moment with `Obey your master.`

## What changed relative to the two 2026-04-10 baselines

### Versus the 2026-04-10 continuity-hardened rerun
The new wording **regressed** on the best 2026-04-10 continuity baseline:

- segments worsened **29 -> 32**
- distinct speakers worsened **13 -> 15**
- singletons worsened **8 -> 9**
- switches worsened **17 -> 18**
- line-level raw speaker-match count stayed flat at **7**

So the fresh wording did **not** beat the strongest prior continuity result.

### Versus the 2026-04-10 approved-doc rerun
The fresh wording is only a **small cleanup**, not a real advance:

- segments stayed flat at **32**
- distinct speakers stayed flat at **15**
- singletons improved slightly **10 -> 9**
- switches improved slightly **19 -> 18**
- raw speaker-match count stayed flat at **7**

That is a marginal smoothing of churn, not a meaningful speaker-continuity gain.

## Fragmentation findings

### Opening speaker continuity still breaks too early
Truth keeps the opening cluster under the same speaker bucket (`spk_001`), but the fresh rerun still splits it:

- Fresh `spk_001`: `They want you afraid.` / `Fear makes you easier to control.`
- Fresh `spk_002`: `It's time to wake up.`
- Truth keeps all of that opening material under `spk_001`

This is one of the clearest signs that the new “do not re-evaluate identity from scratch on every short line” wording did **not** solve the short-line identity reset problem.

### Truth speaker `spk_001` remains fragmented across three model speakers
Truth `spk_001` material is still spread across:

- fresh `spk_001` — opening lines
- fresh `spk_002` — `It's time to wake up.`
- fresh `spk_005` — `Menendez is a terrorist.` and `We're bringing peace and security to the world.`

So the model still fails to preserve one consistent identity across that truth speaker’s arc.

### Truth speaker `spk_006` is still split into three buckets
Truth groups the following together under `spk_006`:

- `He refuses to let me go.`
- `A lot of people counting on us for answers.`
- `No more games! This ends now.`

Fresh rerun assigns those to:

- `spk_006`
- `spk_008`
- `spk_011`

That is persistent mid-to-late fragmentation on a speaker that should stay coherent.

### Comms pair still over-fragments into singletons
Truth keeps the comms pair on one speaker (`spk_008`), but the fresh rerun still splits them into separate singleton IDs:

- fresh `spk_009`: `Spectre One reporting.`
- fresh `spk_010`: `Need a sitrep.`

This is exactly the kind of fragile short-line split the new wording was supposed to reduce.

## Singleton behavior

Fresh rerun lands at **9 singleton speaker IDs**, which is:

- better than the approved-doc rerun (**10**)
- worse than the best 2026-04-10 continuity-hardened rerun (**8**)
- equal to truth (**9**), but for the wrong reasons

The singleton count looking “truth-like” is misleading. In the fresh run, several singletons are still artifacts of unstable identity assignment rather than correct role separation. The comms split (`spk_009` / `spk_010`) is the clearest example.

## Over-merge findings

### Large merged `spk_013` bucket remains
Fresh `spk_013` still absorbs a very large block of material:

- repeated `Obey your master.` / `Master.` lines
- the lyric block
- a later `Obey your master.`

That bucket covers **11 segments**, so the rerun still leans on a broad merged “music/chant” speaker instead of separating the benchmark-only `You shall know fear.` moment or better isolating different material around that section.

### Tail villain cluster still bleeds across truth speakers
Fresh `spk_003` covers:

- `Your streets shall once again run red with your blood.`
- `So eager to leave the dream.`
- `Killing a man is a hell of a lot easier than killing an idea.`

Truth splits those across different speakers (`spk_002` and `spk_013`). So the fresh rerun still trades fragmentation for cross-speaker bleed in the late villain material.

### `spk_005` still merges incompatible truth roles
Fresh `spk_005` contains:

- `Menendez is a terrorist.`
- `We're bringing peace and security to the world.`
- `You were never cut out to be a Mason.`

Those lines do not belong to one truth speaker bucket. This is still a cross-role over-merge.

## Concrete line-level examples

### Example 1: opening continuity still split
- **Truth:** one speaker (`spk_001`) carries the opening and `It's time to wake up.`
- **Fresh:** `spk_001` for the first two lines, then `spk_002` for `It's time to wake up.`
- **Takeaway:** the new wording did not stop short-line re-identification.

### Example 2: comms pair still broken apart
- **Truth (`spk_008`):** `Specter one, report.` + `Need a sitrep.`
- **Fresh:** `spk_009` + `spk_010`
- **Takeaway:** fragile radio lines are still splitting into separate singletons.

### Example 3: late villain material still over-merged
- **Truth:** `So eager to leave David.` belongs with `spk_002`, while `Killing a man ...` belongs with `spk_013`
- **Fresh:** both are assigned to `spk_003`
- **Takeaway:** the rerun still collapses adjacent but distinct villain voices into one bucket.

### Example 4: one specific 2026-04-10 over-merge fix did not generalize into a broader win
The approved-doc assessment noted a local improvement where the tail pair stopped being merged to one speaker. The fresh rerun keeps `Killing a man ...` (`spk_003`) and `You were never cut out ...` (`spk_005`) separated, which is better than the older continuity-hardened over-merge on that pair. But that local improvement is outweighed by the broader fragmentation and other cross-speaker merges still present.

## Net assessment

The 2026-04-13 wording iteration is **not a net continuity improvement**.

Best reading of the comparison:

- **Against the strongest 2026-04-10 continuity-hardened run:** it clearly **hurt**.
- **Against the later approved-doc rerun:** it is only **slightly less noisy**, effectively **flat** in practical terms.
- **Against truth:** it still shows the same unresolved pattern mix:
  - early and mid-scene fragmentation,
  - short-line singleton churn,
  - and large cross-speaker merges in villain/music regions.

## Recommendation

**Use this wording only as an input to the next iteration. Do not keep it as the active prompt wording.**

Reasoning:

1. It did not beat the best 2026-04-10 continuity-hardened baseline.
2. It only marginally improved the approved-doc rerun, with no movement in raw speaker-match count.
3. The exact failure modes it targeted — short-line re-identification and fragile one-line splits — are still visible in the opening and comms examples.
4. The fresh run still carries substantial over-merge behavior in `spk_003`, `spk_005`, and the oversized `spk_013` bucket.

If a baseline must be selected today for continuity, the 2026-04-10 continuity-hardened rerun remains the stronger reference point. The 2026-04-13 wording is useful as evidence about what did **not** materially move Gemini, but not as the wording to promote.
