# Gemini Approved-Doc Rerun vs Benchmark Truth: Speaker-Continuity Assessment

**Date:** 2026-04-10  
**Plan Task:** `.plans/2026-04-10-gemini-speaker-continuity-prompt-doc.md` Task 3 (`ee-ahpw`)  
**Run under review:** `output/cod-dialogue-compare-gemini-3.1-pro-preview/phase1-gather-context/dialogue-data.json` (approved-doc rerun)  
**Benchmark truth:** `benchmarks/fixtures/cod-test/truth/dialogue-data.json`

## Scope

Compare the approved-doc Gemini rerun against benchmark truth with focus on:

1. speaker assignment continuity vs truth,
2. fragmentation movement,
3. specific over-merge behavior,
4. net prompt-change impact (improvement vs regression).

## Snapshot metrics

| Metric | Prior continuity-hardened rerun | Approved-doc rerun | Truth |
|---|---:|---:|---:|
| Dialogue segments | 29 | 32 | 20 |
| Distinct speaker IDs | 13 | 15 | 13 |
| Speaker singletons | 8 | 10 | 9 |
| Speaker switches | 17 | 19 | 16 |
| Truth lines covered (best text sim >= 0.75) | 18/20 | 19/20 | 20/20 |
| Speaker matches on covered truth lines (raw ID) | 7/18 | 7/19 | 20/20 |

## Line-level continuity findings (approved-doc rerun vs truth)

### Where speaker assignment clearly matches truth

Strong line-level alignment still exists for several anchor lines, including:

- `It's time to wake up.` (`spk_001 -> spk_001`)
- `Your streets ... run red ...` (`spk_002 -> spk_002`)
- `Raul Menendez ignited ...` (`spk_003 -> spk_003`)
- `He refuses to let me go.` (`spk_006 -> spk_006`)
- `Stop looking backwards, David ...` (`spk_007 -> spk_007`)

Text coverage remains high (19/20 lines at >=0.75 best similarity), so transcript usability is intact.

### Where speaker assignment deviates from truth

Key continuity deviations in this rerun:

- **Truth `spk_001` is fragmented across three model IDs**
  - `spk_001` (opening lines), then split to `spk_004` and `spk_005` for:
    - `Menendez is a terrorist.`
    - `We're bringing peace and security to the world.`
- **Truth `spk_006` is fragmented** between `spk_006` and `spk_008`.
- **Truth `spk_008` is fragmented** between `spk_009` and `spk_010`.
- **Truth line missing / replaced semantically:**
  - Truth: `You shall know fear.`
  - Rerun nearest line: `Obey your master` (low similarity, ~0.40).

### Cross-speaker over-merge still present

A meaningful over-merge remains in model `spk_007`, which absorbs lines belonging to different truth speakers:

- truth `spk_007`: `Stop looking backwards, David ...`
- truth `spk_010`: `The hell it ain't!`
- truth `spk_013`: `Killing a man is a hell of a lot easier than killing the idea.`

So the rerun still has role-boundary bleed even while also over-fragmenting elsewhere.

## Specific over-merge check (tail pair)

Previously observed over-merge problem:

- `Killing a man ...` and `You were never cut out to be a Mason.` were merged to one model speaker in the prior continuity-hardened rerun.

Approved-doc rerun behavior:

- `Killing a man ...` -> `spk_007`
- `You were never cut out to be a Mason.` -> `spk_014`

**Result:** this specific over-merge was fixed (the pair is now split).

## Fragmentation movement and net continuity result

Compared with the prior continuity-hardened rerun, approved-doc rerun is a **net regression for speaker continuity**:

- More segments (**29 -> 32**)
- More distinct IDs (**13 -> 15**)
- More singletons (**8 -> 10**)
- More switches (**17 -> 19**)

Although one concrete tail over-merge improved, the broader outcome is renewed speaker-ID churn and fragmentation. Prompt changes did not produce a net continuity gain versus the immediate baseline.

## Verdict

The approved-doc prompt changes preserved valid output quality and improved one known over-merge edge case, but overall caused **worse speaker continuity relative to truth** due to increased fragmentation and continued cross-role merges. Net result for speaker-ID continuity is **regression**, not improvement.
