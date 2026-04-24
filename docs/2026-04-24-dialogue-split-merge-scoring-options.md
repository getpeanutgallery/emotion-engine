# Dialogue split/merge scoring options — 2026-04-24

## Recommendation

Use a **three-surface report with no master rollup**:

1. **`dialogue_text_full_transcript_pct`** — the primary dialogue-text percentage. Compare normalized concatenated runtime dialogue text against normalized concatenated truth dialogue text across the whole artifact.
2. **`dialogue_text_windowed_pct`** — a secondary/diagnostic percentage from local many-to-many alignment windows. This explains *where* text stayed right despite split/merge drift and where it did not.
3. **`dialogue_boundary_pct`** — a separate boundary/segmentation percentage. This keeps split/merge problems visible without letting them distort transcript-text accuracy.

That is the strongest reporting model for Derrick’s locked preference: **every comparison surface gets its own percentage out of 100, and there is no hidden weighted total**.

---

## Why the current scoring is misleading

The current benchmark is still largely segment-to-segment after time-aware alignment. That avoids some cascade after a missing middle segment, but it still treats each matched truth/output segment as a one-to-one field comparison. When one truth line is emitted as two runtime lines, or two truth lines are emitted as one runtime line, the benchmark punishes:

- the structural count mismatch,
- the per-segment text mismatch,
- downstream alignment drift,
- and then all traits on now-misaligned segments.

That is why the current COD report falls to **104/288 = 36.11%** overall field accuracy in `benchmarks/fixtures/cod-test/_reports/artifact-results/dialogueData.json`, even though some of the visible disagreement is boundary drift rather than missing words.

`docs/2026-04-24-current-dialogue-vs-benchmark-audit.md` shows the core issue clearly:

- truth index `0` is one line, runtime indexes `0` + `1` split it
- truth indexes `4` + `5` are two lines, runtime index `5` merges them
- truth index `9` is missing entirely
- truth index `7` has wording corruption
- truth index `16` has wording corruption (`the idea` → `an idea`)
- truth index `19` has punctuation/spelling drift (`preorder` vs `pre-order`, `!` vs `.`)

The scoring model should reward the right thing:

- **text fidelity** when the words are materially there,
- **boundary fidelity** when segmentation is right,
- and keep those separate.

---

## Normalization assumptions

All options below assume the same text normalization layer before scoring:

- lowercase
- Unicode normalization
- collapse repeated whitespace
- strip punctuation for text-similarity surfaces
- treat hyphenation variants like `pre-order` vs `preorder` as equivalent
- preserve actual lexical substitutions like `the` vs `an`
- preserve insertions/deletions from lyric leakage or missing dialogue

This normalization should be shared across all dialogue-text scoring surfaces so percentages remain explainable.

---

## Option 1: Concatenated/full-text normalized comparison as the primary dialogue-text percentage

### Definition

Build one normalized transcript string from all truth dialogue segments in order, and one normalized transcript string from all runtime dialogue segments in order. Score them with a whole-text similarity metric.

Recommended concrete metric:

- **token-level Levenshtein similarity** or equivalent edit-distance-based percentage
- formula: `100 * (1 - edit_distance / max(truth_tokens, output_tokens))`

A character-level metric would work, but token-level is easier to explain and less noisy around punctuation.

### What it measures well

- overall transcript-text fidelity
- tolerance to benign split/merge drift
- penalties for real missing words, inserted words, and substitutions
- lyric leakage still hurts because extra tokens are present

### What it hides

- where segmentation went wrong
- whether the same text was grouped into the wrong local windows
- whether a system is “gaming” by dumping one giant transcript blob

That is why this should be the **primary text percentage**, but not the only reported percentage.

### COD behavior

#### Split example: truth `0` vs runtime `0` + `1`
- Truth: `They want you afraid. Fear makes you easier to control.`
- Runtime: split into two adjacent segments with the same words.
- **Full-transcript score behavior:** nearly no penalty for the split itself; this region should score effectively 100 on text presence.
- This is desirable.

#### Merge example: truth `4` + `5` vs runtime `5`
- Truth: `Menendez is a terrorist.` + `We're bringing peace and security to the world.`
- Runtime: merged into one segment.
- **Full-transcript score behavior:** nearly no penalty for the merge itself; words are still present in order.
- Also desirable.

#### Missing line: truth `9`
- Truth: `You shall know fear.`
- Runtime: missing.
- **Full-transcript score behavior:** clear penalty because tokens are absent.
- Desirable.

#### Wording corruption: truth `7`
- Truth: `What matters is what we do next.`
- Runtime: `but matters is what we do next.`
- **Full-transcript score behavior:** penalized for substitution/deletion.
- Desirable.

#### Wording corruption: truth `16`
- Truth: `...killing the idea.`
- Runtime: `...killing an idea.`
- **Full-transcript score behavior:** small but real penalty.
- Desirable.

#### End card punctuation/hyphenation: truth `19`
- Truth: `preorder now!`
- Runtime: `pre-order now.`
- **Full-transcript score behavior:** little or no penalty after normalization, assuming `preorder` and `pre-order` normalize together and punctuation is ignored.
- That matches human judgment better than the current hard fail.

### Tradeoffs

**Pros**
- simplest primary percentage
- robust to split/merge drift
- hard to accidentally punish boundary-only variance
- easy to explain to humans

**Cons**
- can be gamed by emitting one giant transcript block
- gives weak localization for debugging
- does not tell you whether boundaries are good

### Implementation complexity

Low.

This is the easiest surface to add and the clearest improvement over today’s segment-by-segment text failure mode.

---

## Option 2: Local many-to-many alignment windows as a secondary or diagnostic percentage

### Definition

Align truth and runtime segments into **local windows** rather than forcing one-to-one segment matches. Each aligned window can contain:

- 1 truth ↔ 1 runtime
- 1 truth ↔ many runtime
- many truth ↔ 1 runtime
- many truth ↔ many runtime

Within each matched window, concatenate normalized text on both sides and score that local text similarity.

Recommended algorithm shape:

1. walk truth/output in chronological order
2. allow window growth up to a small cap, such as 3 truth segments and 3 output segments
3. choose the smallest local window that maximizes text similarity while respecting order
4. mark unpaired truth/output windows as misses/extras
5. compute a separate `dialogue_text_windowed_pct`

### What it measures well

- local robustness to split/merge drift
- keeps scoring anchored to chronology and neighborhood
- provides much better diagnostics than one giant full-transcript score
- still penalizes local wording errors or missing lines

### What it hides less than full-transcript scoring

Because windows are local, it is much harder for a system to cheat by dumping all text into one huge segment. The text has to be right in the right neighborhood.

### COD behavior

#### Split example: truth `0` vs runtime `0` + `1`
- One truth segment can align to a two-output window.
- Window text matches almost exactly.
- **Windowed score behavior:** this region scores ~100.
- Better than today’s hard mismatch.

#### Merge example: truth `4` + `5` vs runtime `5`
- Two truth segments can align to one-output window.
- **Windowed score behavior:** this region scores ~100.
- Again, better than today.

#### Missing line: truth `9`
- No nearby output text can cover `You shall know fear.`
- **Windowed score behavior:** one unmatched truth window or a low-similarity window, causing a meaningful local penalty.
- Desirable.

#### Wording corruption: truth `7`
- The local window still aligns, but its text similarity drops.
- **Windowed score behavior:** moderate penalty, localized to that window.

#### Wording corruption: truth `16`
- `the idea` vs `an idea` produces a small local penalty.

#### End card truth `19`
- If aligned locally to runtime `16`, normalization may yield near-100 despite punctuation/hyphenation drift.

### Tradeoffs

**Pros**
- preserves local honesty while tolerating split/merge variance
- much harder to game than pure full-transcript scoring
- excellent diagnostics for implementation and audit
- keeps chronology/order meaningful

**Cons**
- more complex than full-transcript scoring
- can become opaque if the window search is too clever
- needs explicit limits to avoid “best possible” global rematching that hides real disorder

### Gaming risk

Lower than full-transcript scoring, but still present if windows are allowed to grow too large. Keep caps tight:

- maximum 3 truth segments
- maximum 3 output segments
- maximum local time/index span
- monotonic alignment only

### Implementation complexity

Medium.

This is realistic and worth doing, but it should be the **secondary text surface or main diagnostic**, not the only primary percentage.

---

## Option 3: Boundary/segmentation scoring as its own separate percentage

### Definition

Score segmentation independently from text accuracy.

Recommended definition:

- derive boundary events between adjacent dialogue units on truth and runtime sides
- reward correct preservation of boundaries
- penalize splits, merges, missing boundaries, and extra boundaries
- report as **`dialogue_boundary_pct`**

Possible concrete boundary events:

- boundary after truth segment `i`
- boundary after runtime segment `j`
- optionally classify by cause: pause, speaker change, interruption, spoken-to-sung pivot, etc.

Simplest v1 calculation:

- map local window alignments
- when 1 truth ↔ many output, count extra runtime boundaries in that truth window as split penalties
- when many truth ↔ 1 output, count missing runtime boundaries as merge penalties
- boundary percentage = `100 * matched_boundaries / total_boundary_events_considered`

### What it measures well

- whether the model segmented the dialogue correctly
- whether runtime output is over-splitting or over-merging
- keeps structure visible without poisoning transcript-text score

### COD behavior

#### Split example: truth `0` vs runtime `0` + `1`
- Text may be fine.
- **Boundary score behavior:** penalize the extra runtime boundary inside what truth treats as one line.

#### Merge example: truth `4` + `5` vs runtime `5`
- Text may be fine.
- **Boundary score behavior:** penalize the missing boundary between those two truth lines.

#### Missing line: truth `9`
- Boundary score should also degrade because the missing segment removes expected structure, though the bigger pain belongs in text score.

#### Wording corruption: truth `7` or `16`
- Boundary score may stay fine if segmentation is fine.
- That is exactly the point: bad wording should not masquerade as a segmentation problem.

### Tradeoffs

**Pros**
- makes split/merge problems visible
- discourages gaming by collapsing everything into one block
- cleanly separates structure from words

**Cons**
- boundary semantics need careful definition
- if over-engineered, can become hard to explain
- some misses are mixed text+boundary failures and will affect more than one percentage

### Implementation complexity

Low to medium if derived from local window alignment. High if trying to infer rich pause/speaker semantics immediately. Start simple.

---

## Option 4: Best hybrid reporting model without a hidden weighted total

## Recommended hybrid

Report these top-level percentages side by side:

- **`dialogue_text_full_transcript_pct`** — primary
- **`dialogue_text_windowed_pct`** — secondary/diagnostic
- **`dialogue_boundary_pct`** — structural

And report supporting counts/diagnostics:

- `truth_segment_count`
- `output_segment_count`
- `split_event_count`
- `merge_event_count`
- `missing_truth_window_count`
- `extra_output_window_count`
- `window_alignments[]`
- `normalization_profile`

### Why this is the strongest model

It gives Derrick exactly what he asked for:

- **no weighted/composite master score**
- **every comparison surface is its own 0-100 percentage**
- **text accuracy is protected from boundary-only distortion**
- **segmentation failures remain visible and auditable**

It also gives engineering a very practical split between:

- the number humans will use first (`dialogue_text_full_transcript_pct`)
- the number engineers will use to debug local quality (`dialogue_text_windowed_pct`)
- the number that exposes structure drift (`dialogue_boundary_pct`)

### Why not use only the hybrid windowed score as the primary?

Because Derrick explicitly wants the main dialogue-text percentage to reflect the whole golden truth comparison, and full-transcript normalized comparison is the cleanest expression of that. Windowed alignment is best as a corroborating surface, not the only headline number.

---

## Comparison summary

| Option | Honest on split/merge text | Keeps segmentation visible | Gaming risk | Complexity | Best role |
| --- | --- | --- | --- | --- | --- |
| Full-transcript normalized | Strong | Weak alone | Medium | Low | Primary dialogue-text percentage |
| Local many-to-many windows | Strong | Medium/strong | Lower | Medium | Secondary text percentage + diagnostics |
| Boundary percentage | Not a text score | Strong | Low | Low/medium | Separate structural percentage |
| Three-surface hybrid | Strongest overall | Strong | Low/medium | Medium | Recommended reporting model |

---

## Preferred implementation-ready shape

## Output fields

Add a dedicated dialogue text/boundary block to the artifact result, for example:

```json
{
  "dialogueScoring": {
    "dialogue_text_full_transcript_pct": 87.4,
    "dialogue_text_windowed_pct": 84.2,
    "dialogue_boundary_pct": 71.4,
    "truth_segment_count": 20,
    "output_segment_count": 17,
    "split_event_count": 1,
    "merge_event_count": 1,
    "missing_truth_window_count": 1,
    "extra_output_window_count": 0,
    "normalization_profile": "dialogue-text-v1",
    "window_alignments": [
      {
        "truth_indexes": [0],
        "output_indexes": [0, 1],
        "text_similarity_pct": 100.0,
        "boundary_status": "split"
      },
      {
        "truth_indexes": [4, 5],
        "output_indexes": [5],
        "text_similarity_pct": 100.0,
        "boundary_status": "merge"
      },
      {
        "truth_indexes": [9],
        "output_indexes": [],
        "text_similarity_pct": 0.0,
        "boundary_status": "missing_truth"
      }
    ]
  }
}
```

Percentages should stay numerically independent. Do **not** compute or report any combined overall score from them.

## Suggested algorithm order

1. Normalize truth and output dialogue text.
2. Compute `dialogue_text_full_transcript_pct` from concatenated token sequences.
3. Build monotonic local many-to-many windows.
4. Compute `dialogue_text_windowed_pct` from the aligned windows.
5. Derive split/merge/missing/extra boundary events from those windows.
6. Compute `dialogue_boundary_pct`.
7. Keep existing per-segment/trait diagnostics, but stop presenting the current field-rollup as the only dialogue-quality number.

## Suggested constraints for window alignment

- monotonic only; never reorder chronology
- max 3 truth segments ↔ max 3 output segments
- prefer the smallest sufficient window
- require minimum local similarity to declare a match
- treat unmatched windows as explicit missing/extra evidence

These caps prevent the algorithm from cheating by sweeping too much text into one window.

---

## Gaming analysis

### Risk: one giant runtime transcript blob

- **Full-transcript score alone:** could still look strong if all words are present.
- **Mitigation:** boundary percentage will be terrible, and windowed alignment will show large merges.

### Risk: over-splitting into many tiny lines

- **Full-transcript score alone:** may still look fine.
- **Mitigation:** boundary percentage drops; windowed diagnostics show repeated split events.

### Risk: stuffing extra lyric/non-dialogue text into dialogue lane

- **Full-transcript score:** extra tokens reduce score.
- **Windowed score:** local extra-output windows reduce score.
- **Boundary score:** often also degrades due to added structure.

### Risk: semantically similar but wrong wording

- Example: `the idea` → `an idea`
- **Full-transcript and windowed text scores** both drop slightly.
- **Boundary score** stays unaffected.
- That is the correct behavior.

---

## Final recommendation

Implement **three separate dialogue percentages**:

1. **`dialogue_text_full_transcript_pct`** as the headline dialogue-text number
2. **`dialogue_text_windowed_pct`** as the local split/merge-tolerant corroborating number
3. **`dialogue_boundary_pct`** as the explicit segmentation/structure number

This model best preserves honest text evaluation when runtime dialogue is split or merged differently from truth. It fixes the main human-judgment problem in the COD examples:

- truth `0` split into runtime `0` + `1` should stop looking like a huge text failure
- truth `4` + `5` merged into runtime `5` should stop looking like a huge text failure
- missing truth `9` should still hurt
- corrupted truth `7` and `16` should still hurt
- punctuation/hyphen drift on truth `19` should not be over-penalized

In short: **score words as words, score boundaries as boundaries, and never blend them into a hidden master number.**
