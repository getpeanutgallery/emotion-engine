# Dialogue Traits v2 Emotion/Pragmatics Split Triggers

**Date:** 2026-04-15  
**Status:** Review-ready topology criteria  
**Scope:** Evidence-gated criteria for deciding when `affect`, `interpersonal_stance`, and `delivery_overlay` should move from one-pass extraction into a dedicated bundled pass.

---

## Purpose

This document defines when the architecture note's "strong early bundle candidate" should become an actual split decision.

The goal is to keep the system from splitting too early out of caution, while also avoiding the opposite failure mode: pretending one-pass extraction is good enough after the eval slice has already shown systematic expressive flattening.

The bundle under consideration is:
- `affect`
- `interpersonal_stance`
- `delivery_overlay`

This is a **bundle split only**. It does **not** change the closed persisted contract and does **not** create an accent specialist lane by default.

---

## Decision principle

Split emotion/pragmatics only when there is repeated evidence that one-pass extraction is failing **specifically on the expressive vector**, not just failing in a general or unrelated way.

That means the split decision should be driven by:
- targeted eval results
- repeatable collapse patterns
- instability across reruns
- qualitative reviewer evidence that the base pass is flattening expressive lines

It should **not** be driven by hunches, isolated weird lines, or failure families that belong somewhere else.

---

## Required evidence before making the call

Before recommending a split, collect all of the following:

1. **Run the targeted 30-asset eval slice** described in `docs/2026-04-15-dialogue-traits-v2-targeted-eval-slice.md`.
2. **Run it at least 3 times** under the same one-pass setup to check stability.
3. **Score by bucket**, not just overall average.
4. **Review misses manually** so default collapse, honest abstention, and unsupported specificity are separated.
5. **Allow one focused prompt/validator refinement cycle** before escalating to a topology change.

If the failure survives that refinement cycle, the evidence is strong enough to use for a split decision.

---

## Primary trigger conditions

Any split recommendation should be based on the expressive buckets only:
- Bucket A — `fearful` vs `tense`
- Bucket B — `happy` vs `amused`
- Bucket C — `angry` vs `disgusted`
- Bucket D — `taunting` vs `confrontational`
- Bucket E — overlay interactions

These are the buckets that test the proposed bundle directly.

## Trigger 1 — sustained expressive bucket underperformance
Recommend a split if, **after one focused prompt/validator revision**, either of the following remains true across the 3-run eval summary:

- **overall expressive boundary-hit rate is below 85%**, or
- **two or more expressive buckets score below 75%**

Use the approved-alternate sets from the eval slice when calculating these scores.

### Why this triggers a split
At that point the one-pass system is not just missing edge cases; it is failing recurrently on the family the architecture note already identified as the strongest early bundle candidate.

---

## Trigger 2 — default-collapse is persistent and concentrated
Recommend a split if **20% or more of expressive assets** show one of the following collapse patterns after the refinement cycle:

- `serious` used where the gold set expects `tense`
- `happy` used where the gold set expects `amused`
- `angry` used where the gold set expects `disgusted`
- `confrontational` used where the gold set expects `taunting`
- `delivery_overlay: none_apparent` used where laughter or crying is clearly audible

### Why this triggers a split
This is the clearest sign that the one-pass prompt is budget-constrained or attention-collapsed on exactly the expressive distinctions v2 was created to preserve.

---

## Trigger 3 — rerun instability on expressive fields
Recommend a split if expressive target fields fail the stability check after the refinement cycle:

- **rerun stability below 80%** for the expressive target fields across the 3 repeated runs

A line counts as stable only if the output stays the same or stays within the approved-alternate set for the target field(s).

### Why this triggers a split
An unstable one-pass system is not just wrong occasionally; it is showing that these judgments are too crowded or weakly anchored in the base pass.

---

## Trigger 4 — qualitative reviewer evidence of flattened expressive vectors
Recommend a split if reviewers repeatedly observe this pattern on the same assets:

- the model gets the text, audibility, and basic prosody roughly right
- but the output strips the line down to safer broad labels
- and the misses are not random; they repeatedly erase the same expressive distinctions

Typical reviewer language that supports a split:
- "It keeps hearing the line as generic serious instead of tense."
- "It understands hostility but keeps missing the taunting/baiting quality."
- "It notices positivity but flattens amused mockery into happy."
- "The laughter is audible, but the model keeps dropping it or converting it into a full affect label."

### Why this triggers a split
This is direct evidence that the one-pass system is preserving coarse delivery but not the recognition-relevant expressive vector.

---

## Trigger 5 — prompt refinement stops helping
Recommend a split when a narrowly targeted improvement cycle fails to produce meaningful gains.

A split is justified if **both** are true:
- the team made one focused prompt/validator iteration aimed specifically at emotion/pragmatics failures
- the expressive scores remain materially below the trigger thresholds above, or the collapse patterns remain essentially unchanged

### Why this triggers a split
At that point the issue is probably architectural crowding, not just wording.

---

## Non-trigger conditions

The following do **not** justify an emotion/pragmatics split on their own.

## 1. Accent is the dominant failure family
If the main problems are:
- over-claiming `accent_family`
- weak `accent_strength` abstention
- sociolinguistic overreach

that supports accent guardrail work or an accent specialist lane, **not** an emotion/pragmatics split.

## 2. Medium/spatial judgments are the main problem
If failures cluster around:
- `transmission_medium`
- `spatial_texture`

that is medium/context work, not evidence that affect/stance/overlay need their own pass.

## 3. Gating/transcription quality is the real blocker
If text recovery, audibility, or overlap are unreliable enough that expressive judgments are downstream noise, fix capture/gating first.

Do not split emotion/pragmatics to compensate for poor line capture.

## 4. Only isolated boundary misses appear
One or two hard misses on a 30-asset slice do not justify a topology change.

Boundary-heavy labels will always have some human-review friction. The trigger is **systematic pattern**, not isolated difficulty.

## 5. Honest abstention is high but unsupported specificity is low
If the model is conservative and often chooses `unknown` on genuinely weak assets, that is not by itself a split trigger.

That may justify prompt tuning, but honest abstention is preferable to fabricated precision.

## 6. Problems disappear after one targeted prompt fix
If the system improves materially after a single focused refinement cycle and clears the thresholds, keep the one-pass topology.

---

## Warning-level only conditions

These should be logged and watched, but should **not** trigger a split by themselves.

- occasional `fearful` vs `tense` reviewer disagreement on a whispered high-pressure line
- occasional `taunting` vs `confrontational` disagreement when the enjoyment signal is faint
- one missed soft laugh or soft cry on a borderline overlay line
- one `angry` vs `disgusted` disagreement on a line where both are plausibly audible
- small pockets of overuse of `serious` that do not form a recurring bucket-wide pattern
- rerun instability on a single extremely ambiguous line

These are calibration and review issues first.

---

## Recommended threshold summary

Use this as the practical decision table after one focused refinement cycle.

### Keep one-pass if:
- expressive boundary-hit rate is **85% or higher**
- no more than **one expressive bucket** is below **75%**
- expressive rerun stability is **80% or higher**
- default-collapse affects **less than 20%** of expressive assets
- most misses are honest abstentions or warning-level disagreements

### Escalate for split if:
- expressive boundary-hit rate is **below 85%**, **or**
- **two or more** expressive buckets are below **75%**, **or**
- expressive rerun stability is **below 80%**, **or**
- default-collapse affects **20% or more** of expressive assets,

**and** the misses are clearly concentrated in `affect` / `interpersonal_stance` / `delivery_overlay` rather than unrelated fields.

### Borderline zone: prompt/validator retry first
If results sit near the thresholds and reviewer notes suggest the system is close rather than collapsed, do one focused revision cycle before splitting.

Do **not** loop endlessly. One refinement cycle is enough to distinguish prompt wording issues from architectural crowding.

---

## What to keep in the base pass even if the split happens

If emotion/pragmatics is split into a bundled pass, the base dialogue pass should still own:
- `index`
- `text`
- `audibility`
- `overlap`
- `pitch_band`
- `pace`
- `energy`

This preserves the architecture note's core principle: reliability and core prosody stay attached to honest line capture.

---

## What the split should and should not change

## If the split happens, it should:
- isolate the interpretation-heavy expressive bundle
- reduce prompt crowding in the base pass
- preserve the same persisted closed contract
- keep accent as a separate, more specialist decision lane

## If the split happens, it should not:
- reopen the schema
- add free-text justifications to persisted source truth
- promote accent decisions into the same bundle by default
- use the bundle as an excuse to over-specify weak lines

---

## Review observations worth recording explicitly

When reviewers summarize the eval, they should note whether the one-pass system is doing any of the following:

- repeatedly picking the broader safe label instead of the narrower expressive label
- repeatedly dropping audible overlays
- repeatedly converting overlays into affect labels
- repeatedly missing the outward-directed posture of the line even when the affect is roughly right
- showing stable mistakes on the same asset across runs
- improving after prompt changes only on easy lines, while hard expressive lines remain flattened

These notes make the split decision easier to defend later.

---

## Bottom line

The split decision should be governed by one simple rule:

> move emotion/pragmatics into its own bundled pass only when repeated targeted eval evidence shows that one-pass extraction is preserving coarse line capture but flattening the recognition-relevant expressive vector.

That keeps the architecture disciplined:
- **emotion/pragmatics** remains the strongest early bundled split candidate
- **accent** remains the clearest true specialist lane
- and topology changes happen because the evidence says they are needed, not because the categories feel theoretically hard.