# Dialogue V3 — `ee-cmw8` investigation of remaining truthful-reuse misses

Date: 2026-04-18  
Bead: `ee-cmw8`  
Status: Complete

## Scope

Investigate the remaining `grouping_reuse_miss_after_source_truth_conversion` cluster after `ee-b3g3` and `ee-61jg`, classify the six remaining misses, and recommend the most justified bounded next lane.

Constraint reminder: `runtime_missing_segment_for_truth_index` remains separate and is not treated here as the same problem class.

## Files reviewed

- `.plans/2026-04-16-ee-gqnc-v3-traits-execution-plan.md`
- `docs/2026-04-18-dialogue-v3-task9-independent-audit.md`
- `docs/2026-04-17-dialogue-v3-task8-native-persisted-v3-rerun.md`
- `output/cod-test/phase1-gather-context/speaker-grouping.json`
- `output/cod-test/phase1-gather-context/speaker-grouping.decision-ledger.json`
- `benchmarks/fixtures/cod-test/_reports/artifact-results/speakerGrouping.json`
- `benchmarks/fixtures/cod-test/_reports/artifact-results/speakerGrouping.miss-clusters.json`
- `benchmarks/fixtures/cod-test/truth/speaker-grouping.json`
- `server/lib/dialogue-v3-speaker-grouping.cjs`
- `docs/2026-04-16-dialogue-traits-v3-speaker-grouping-heuristics-ruleset.yaml`

## Executive read

The remaining six reuse misses are **not primarily one clean scorer bug**.

Strongest evidence-backed read:

- **5 of the 6** are better explained by a **comparator / truth-conversion expectation mismatch** on the current COD surface.
- **1 of the 6** (`segment_index = 8`) still looks like a **real runtime under-reuse caused by sparse discriminative support**.
- Because of that mix, the most justified next move is **not** another immediate grouping implementation pass.
- The next bead should first **clean up / realign the truth-comparison surface** so the remaining misses are asking the runtime the right question.

## Why this changed my read

The six misses are all still labeled as `grouping_reuse_miss_after_source_truth_conversion`, but several no longer line up textually with the runtime segment at the same index.

That matters because the comparator is still reporting a grouping-layer reuse miss even when the runtime segment text clearly corresponds to a **different truth row** (or to text omitted/merged differently on the truth side).

In other words: some of the “reuse misses” are probably **index-surface mismatch artifacts**, not genuine cases where the current scorer saw the right candidate and wrongly refused reuse.

## Row-by-row classification

| Runtime segment | Current miss label | Evidence | Most likely classification |
| --- | --- | --- | --- |
| `1` | expected `first_segment_000`, actual singleton `first_segment_001` | Runtime text is `Fear makes you easier to control.`; truth row `1` text is `It's time to wake up.`; runtime text instead matches truth row `0` (`They want you afraid. Fear makes you easier to control.`) | **Comparator / truth-conversion expectation mismatch** |
| `4` | expected `first_segment_000`, actual singleton `first_segment_004` | Runtime text is `Raul Menendez ignited global unrest on an unprecedented scale.`; truth row `4` text is `Menendez is a terrorist.`; runtime text matches truth row `3` | **Comparator / truth-conversion expectation mismatch** |
| `5` | expected `first_segment_000`, actual singleton `first_segment_005` | Runtime text is merged: `Menendez is a terrorist. We're bringing peace and security to the world.`; truth rows `4` and `5` are split across two assignments | **Comparator / truth-conversion expectation mismatch** |
| `8` | expected `first_segment_006`, actual singleton `first_segment_008` | Runtime text matches truth row `8` exactly. Decision ledger shows many indistinguishable non-clean candidates, all driven by shared defaults and sparse identity support | **Real runtime under-reuse from missing discriminative support** |
| `11` | expected `first_segment_010`, actual singleton `first_segment_011` | Runtime text is the long lyric spillover (`Obey your master...`); truth row `11` is `Need a sitrep.`; there is no same-index textual alignment | **Comparator / truth-conversion expectation mismatch** |
| `15` | expected `first_segment_002`, actual singleton `first_segment_015` | Runtime text is `You were never cut out to be a Mason.`; truth row `15` is `So eager to leave David.`; runtime text instead matches truth row `17` | **Comparator / truth-conversion expectation mismatch** |

## Detailed notes by miss

### 1) `segment_index = 1`

Runtime surface:
- text: `Fear makes you easier to control.`
- only prior candidate group: `grp_001`
- runtime created `grp_002`
- ledger diagnostics: `default_shared_only_reuse_pressure = true`

But truth comparison surface:
- truth row `1` text is `It's time to wake up.`
- runtime row `1` text instead belongs inside truth row `0`'s merged text: `They want you afraid. Fear makes you easier to control.`

So although this looks superficially like a single-incumbent miss, the comparator is already comparing against a shifted truth row. I would **not** use this row alone to justify a new single-incumbent reuse rule yet.

### 2) `segment_index = 4`

Runtime surface:
- text: `Raul Menendez ignited global unrest on an unprecedented scale.`
- candidate groups were a stack of previously created singletons with identical sparse-default scores (`5.25`)
- runtime created a new singleton again

Truth comparison surface:
- truth row `4` text is `Menendez is a terrorist.`
- runtime row `4` text instead matches truth row `3`

This is much better explained as **truth row/index drift** than as a clean tie-breaker bug.

### 3) `segment_index = 5`

Runtime surface:
- text: `Menendez is a terrorist. We're bringing peace and security to the world.`
- runtime row is a merged line
- all viable prior candidates again tie on sparse defaults

Truth comparison surface:
- truth rows `4` and `5` are split:
  - `Menendez is a terrorist.`
  - `We're bringing peace and security to the world.`
- runtime row `5` is effectively those two truth rows combined

Again this is better explained as a **truth-conversion / comparison-surface mismatch** than as a support-history tie-break problem.

### 4) `segment_index = 8`

This is the one miss that still looks genuinely runtime-side.

Runtime surface:
- text matches truth row `8` exactly: `A lot of people counting on us for answers.`
- expected truth group is `first_segment_006` (`[6, 8, 18]`)
- runtime previously created `grp_007` at segment `6` for `He refuses to let me go.`
- at segment `8`, runtime still created a new singleton `grp_009`

Ledger evidence:
- many prior groups tie at `5.25`
- top candidate diagnostics still show:
  - `default_shared_only_reuse_pressure = true`
  - `discriminative_stable_identity_exact_match_count = 0`
  - only default/shared exact matches are carrying score
- there is no strong support-history signal in the persisted runtime artifact beyond segment count / trait value counts

Interpretation:
- this miss is **not** a good fit for a support-history-derived tie-breaker, because the runtime does not currently have enough discriminative evidence to identify `grp_007` as the rightful incumbent rather than one of many same-shaped prior singletons
- this is also **not** a clean single-incumbent case, because by segment `8` there are already many indistinguishable incumbents in play

So `segment 8` points most strongly to **missing runtime discriminative support**.

### 5) `segment_index = 11`

Runtime surface:
- text is the long lyric spillover (`Obey your master...`)
- runtime created singleton `grp_012`

Truth comparison surface:
- truth row `11` text is `Need a sitrep.`
- expected group `first_segment_010` is truth group `[10, 11]` (`Specter one, report.` / `Need a sitrep.`)

This is a very strong sign that the current comparator/truth surface is not aligned to the runtime segment surface here. Treating this as a grouping reuse bug would be misleading.

### 6) `segment_index = 15`

Runtime surface:
- text: `You were never cut out to be a Mason.`
- runtime created singleton `grp_014`

Truth comparison surface:
- truth row `15` text is `So eager to leave David.`
- runtime row `15` text instead matches truth row `17`

So this miss is also far more credibly a **comparison-surface mismatch** than a runtime reuse decision bug.

## What the runtime evidence says about the current scorer

The current scorer changes from `ee-b3g3` and `ee-61jg` do appear to be doing their intended job:

- they stopped the earlier catastrophic over-merge/collapse
- they preserved selective non-clean reuse when a non-default exact field exists
- they now create new groups under `default_shared_only_reuse_pressure` instead of blindly collapsing sparse/default-only candidates together

The remaining honest runtime-side problem visible in this six-row cluster is narrower:

- when the line is still mostly `unknown` on discriminative stable-identity fields,
- and the candidate field support is dominated by shared defaults,
- and there are several already-created default-shaped singletons,
- the runtime has no principled way to identify the correct incumbent.

That is a **support surface limitation first**, not a proven resolver bug.

## Which next move is most justified?

### Most justified now: **(3) comparator / truth-conversion expectation mismatch**

That is the strongest explanation for the cluster as a whole.

Reason:
- **5/6** rows are more credibly comparison-surface mismatches than runtime grouping mistakes.
- Only **1/6** (`segment 8`) survives as a strong runtime-side reuse miss after textual alignment checks.

### Why not choose `(1) single-incumbent reuse rule` yet?

It only plausibly helps `segment 1`, and even that row is already comparison-surface-shifted relative to truth.

It does **not** explain:
- `4`
- `5`
- `11`
- `15`

And it does not solve `8`, which is the one aligned runtime-side miss.

### Why not choose `(2) support-history-derived tie-breaker` yet?

Current persisted group support only exposes:
- `segment_count`
- `ambiguous_member_count`
- `trait_value_counts`

The aligned miss (`8`) does not show a strong, unique support-history incumbent that the runtime merely failed to prefer. It shows **too many indistinguishable default-shaped incumbents**.

A tie-breaker would risk inventing confidence where the surface does not currently justify it.

### Why not choose a fresh scorer/calibration implementation pass right now?

Because the cluster-level signal is polluted by truth/comparator surface mismatch. Another implementation pass would be hard to evaluate honestly until the comparison surface is cleaned up.

## Recommended next bead

### Title

`Align COD speaker-grouping truth/comparator surface to reconciled runtime segment mapping`

### Tight scope

1. Audit `benchmarks/fixtures/cod-test/truth/speaker-grouping.json` against the current reconciled runtime segment surface row-by-row.
2. Identify where truth assignments are still using stale split/merge boundaries or omitted/shifted lines relative to the current reconciled runtime artifact.
3. Decide the smallest correct repair:
   - regenerate truth grouping from the intended converted source surface, **or**
   - make the comparator compare against a stable converted-segment mapping instead of raw positional index assumptions.
4. Re-run `speakerGrouping.json` / `speakerGrouping.miss-clusters.json` after that cleanup.
5. Keep `runtime_missing_segment_for_truth_index` explicitly separate.

### Expected outcome

After comparator/truth-surface cleanup, the remaining real runtime reuse misses should shrink to a much smaller, better-posed set. Only then should we decide whether a further grouping implementation bead is warranted.

## Precise bounded implementation hypothesis, if one is still needed later

If a post-cleanup rerun still leaves the aligned `segment 8`-style miss class, the next implementation bead should be narrowly phrased as:

> When all top reuse candidates are non-clean, default-shared, and sparse on discriminative stable identity, do not invent a winner via recency alone; instead require one additional discriminative support signal (runtime-emitted or comparator-mapped) before converting create -> reuse.

But I do **not** think that should be the next bead yet.

## Bottom line

Strongest explanation for the remaining six reuse misses:

- **Primarily comparator / truth-conversion expectation mismatch (5/6 rows)**
- with **one surviving real runtime under-reuse miss caused by missing discriminative support (1/6 row, segment 8)**

Recommended next bead:

- **`Align COD speaker-grouping truth/comparator surface to reconciled runtime segment mapping`**

Is another implementation pass justified now?

- **No.** Comparator / truth-surface cleanup should happen first.
- After that cleanup, reassess whether any aligned reuse misses remain; if they do, the next runtime-side bead should stay tightly scoped to sparse-support handling rather than broad scorer changes.
