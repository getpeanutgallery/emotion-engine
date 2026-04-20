# Dialogue V3 runtime-aligned speaker/grouping review packet

Date: 2026-04-18  
Repo: `projects/peanut-gallery/emotion-engine`  
Bead: `ee-kia6`

## Purpose / context

This packet exists because `ee-xjsl` replaced the old source-index-only grouping comparator surface with a runtime-aligned truth projection:

- durable source anchor stays: `benchmarks/fixtures/cod-test/truth/dialogue-data.json`
- aligned comparison surface is now: `benchmarks/fixtures/cod-test/truth/speaker-grouping.reconciled-runtime-aligned.json`
- current runtime result is compared via: `benchmarks/fixtures/cod-test/_reports/artifact-results/speakerGrouping.json`

That change removed the misleading grouping-side `runtime_missing_segment_for_truth_index` bucket and exposed the current review surface more honestly:

- `5` reuse misses: runtime segments `1, 2, 5, 8, 16`
- `3` assignment mismatches: runtime segments `13, 14, 17`
- `1` runtime-extra segment: runtime segment `11`

So the next session should review the alignment/mapping choices first, then decide which remaining misses are real grouping errors versus truth-surface decisions that now need to be locked before any further benchmark-truth refresh.

## Exact reviewer checklist for next session

1. Re-read `docs/2026-04-18-dialogue-v3-ee-xjsl-runtime-aligned-speaker-truth.md` for the intended posture.
2. Confirm the aligned truth surface should remain derived from `truth/dialogue-data.json` rather than hand-edited independently.
3. Verify split handling for runtime segments `0` and `1` against truth segment `0`.
4. Verify merge handling for runtime segment `5` against truth segments `4` and `5`.
5. Verify fuzzy alignments at runtime segments `7`, `10`, and `14` are acceptable enough to keep as truth anchors.
6. Confirm runtime segment `11` should remain classified as `runtime_extra_segment_not_in_truth` rather than forced into a speaker group/truth row.
7. Review the five reuse misses (`1, 2, 5, 8, 16`) and decide whether each expected reuse in aligned truth is still correct.
8. Review the three assignment mismatches (`13, 14, 17`) and decide whether runtime grouped to the wrong prior bucket or aligned truth picked the wrong bucket.
9. If any mapping/alignment decisions change, regenerate the aligned truth surface before judging grouping behavior again.
10. Only after steps 1-9, decide what benchmark-truth alignment follow-up bead should edit the truth surface.

## Mapping / alignment decisions to verify

### 1) Split / merge handling

- **Runtime `0` + `1` -> truth `0`**
  - Truth `0`: `They want you afraid. Fear makes you easier to control.`
  - Runtime `0`: `They want you afraid.`
  - Runtime `1`: `Fear makes you easier to control.`
  - Expected aligned group key for both runtime rows: `first_segment_000`
  - Review question: is the split unquestionably correct, or did the runtime cut create any speaker ambiguity that the aligned truth is currently hiding?

- **Runtime `5` -> truth `4` + `5`**
  - Truth `4`: `Menendez is a terrorist.`
  - Truth `5`: `We're bringing peace and security to the world.`
  - Runtime `5`: merged line with both clauses
  - Expected aligned group key: `first_segment_000`
  - Review question: should this merged runtime row stay treated as one Speaker 1 assignment, or is there any reason to separate the clauses at truth-review time?

### 2) Fuzzy matches to sanity-check

- **Runtime `7` -> truth `7`**
  - Truth: `Stop looking backwards, David. What matters is what we do next.`
  - Runtime: `Stop looking backwards, David, but matters is what we do next.`
  - Current aligned truth: `fuzzy_truth_segment`, source speaker `spk_007`, key `first_segment_007`
  - Review question: wording drift only, or enough transcription corruption to weaken this as a clean alignment anchor?

- **Runtime `10` -> truth `13`**
  - Truth: `The hell it ain't!`
  - Runtime: `The hell it isn't!`
  - Current aligned truth: `fuzzy_truth_segment`, source speaker `spk_010`, key `first_segment_010`
  - Review question: same intended line/speaker, yes or no?

- **Runtime `14` -> truth `16`**
  - Truth: `Killing a man is a hell of a lot easier than killing the idea.`
  - Runtime: `Killing a man is a hell of a lot easier than killing an idea.`
  - Current aligned truth: `fuzzy_truth_segment`, source speaker `spk_013`, key `first_segment_014`
  - Review question: is this still clearly the same montage voice line despite the article swap?

### 3) Runtime-extra / segmentation drift

- **Runtime `11`**
  - Runtime text is the long lyric-heavy `Master...` segment.
  - Current aligned truth classification: `runtime_extra_segment_not_in_truth`
  - It matches no truth segment and no truth speaker group.
  - Review question: keep as explicit runtime-extra drift, or does next-session truth work need a different non-dialogue/reconciled handling rule?

## Remaining grouping hotspots

### Reuse misses

| Runtime seg | Runtime text | Expected aligned truth key | Current runtime key | Truth/source note |
| --- | --- | --- | --- | --- |
| `1` | `Fear makes you easier to control.` | `first_segment_000` | `first_segment_001` | split piece of truth `0`, Speaker 1 / `spk_001` |
| `2` | `It's time to wake up.` | `first_segment_000` | `first_segment_002` | truth `1`, still Speaker 1 / `spk_001` |
| `5` | `Menendez is a terrorist. We're bringing peace and security to the world.` | `first_segment_000` | `first_segment_005` | merged truth `4` + `5`, Speaker 1 / `spk_001` |
| `8` | `A lot of people counting on us for answers.` | `first_segment_006` | `first_segment_008` | truth `8`, Speaker 6 / `spk_006` |
| `16` | `No more games. This ends now.` | `first_segment_006` | `first_segment_016` | truth `18`, Speaker 6 / `spk_006` |

### Assignment mismatches

| Runtime seg | Runtime text | Expected aligned truth key | Current runtime key | What it appears to be doing |
| --- | --- | --- | --- | --- |
| `13` | `So eager to leave, David?` | `first_segment_003` | `first_segment_010` | runtime reuses the `10` bucket instead of the Menendez bucket started at `3` |
| `14` | `Killing a man is a hell of a lot easier than killing an idea.` | `first_segment_014` | `first_segment_012` | runtime reuses the `12` bucket instead of its own expected bucket |
| `17` | `Get the Reznov challenge pack when you pre-order now.` | `first_segment_017` | `first_segment_007` | runtime reuses the `7` bucket instead of keeping promo VO separate |

## Fast side-by-side references

### Expected aligned truth groups

- `first_segment_000` -> Speaker 1 / `spk_001` -> runtime segments `0, 1, 2, 5`
- `first_segment_003` -> Speaker 2 / `spk_002` -> runtime segments `3, 13`
- `first_segment_006` -> Speaker 6 / `spk_006` -> runtime segments `6, 8, 16`
- `first_segment_007` -> Speaker 7 / `spk_007` -> runtime segment `7`
- `first_segment_010` -> Speaker 10 / `spk_010` -> runtime segment `10`
- `first_segment_012` -> Speaker 12 / `spk_012` -> runtime segment `12`
- `first_segment_014` -> Speaker 13 / `spk_013` -> runtime segment `14`
- `first_segment_017` -> Speaker 16 / `spk_016` -> runtime segment `17`

### Current runtime grouping buckets involved in misses

- `first_segment_001`: singleton created for runtime `1`
- `first_segment_002`: singleton created for runtime `2`
- `first_segment_005`: singleton created for runtime `5`
- `first_segment_008`: singleton created for runtime `8`
- `first_segment_016`: singleton created for runtime `16`
- `first_segment_010`: runtime bucket containing segments `10, 13`
- `first_segment_012`: runtime bucket containing segments `12, 14`
- `first_segment_007`: runtime bucket containing segments `7, 17`

### Important runtime evidence note

The current runtime grouping shows a strong pattern on the reuse misses: the engine is still creating new groups when stable-identity cues are mostly unknown, even when aligned truth expects reuse. In the live artifact, the missy early rows repeatedly show abstention/default-shared pressure rather than positive identity evidence.

That means next session should not treat every miss as a bad aligned truth decision. Some are almost certainly still genuine runtime grouping under-reuse.

## Recommended next-session flow

1. Open three files side by side:
   - `benchmarks/fixtures/cod-test/truth/dialogue-data.json`
   - `benchmarks/fixtures/cod-test/truth/speaker-grouping.reconciled-runtime-aligned.json`
   - `benchmarks/fixtures/cod-test/_reports/artifact-results/speakerGrouping.json`
2. Lock the alignment review first: segments `0`, `1`, `5`, `7`, `10`, `11`, `14`.
3. If any of those alignment calls are wrong, regenerate the aligned truth artifact before evaluating grouping misses.
4. Then review the five reuse misses as one cluster: `1`, `2`, `5` together for Speaker 1, and `8`, `16` together for Speaker 6.
5. Then review the three assignment mismatches: `13`, `14`, `17`, because those may indicate either wrong reuse or wrong truth bucket expectations.
6. Once the reviewer is satisfied the aligned truth surface is right, create the next truth-alignment bead to update benchmark truth to the new format or explicitly preserve the derived runtime-aligned surface as the authoritative grouping comparator.
7. Only after that, judge whether the remaining misses are runtime grouping bugs to calibrate versus truth-surface issues already resolved.

## Bottom line

The important thing to preserve next session is order of operations:

**first validate the aligned truth surface, then edit benchmark truth, then interpret remaining grouping misses.**

If that order holds, the next truth-alignment pass should be much cleaner and should avoid mixing segmentation drift with actual speaker-grouping behavior again.
