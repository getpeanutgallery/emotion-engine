# Dialogue Traits Pass-Ownership Architecture v2

**Date:** 2026-04-15  
**Status:** Focused review-ready architecture note  
**Scope:** Revision of the vNext pass-ownership guidance only where Derrick’s speaker-recognition north star materially changes extraction-topology recommendations.

---

## Executive summary

The new north star does **not** require a total topology rewrite.

It does, however, change one important prioritization:

> because affect/emotion coverage is now broader and explicitly part of the same-speaker-recognition goal, the case for an eventual dedicated **emotion/pragmatics bundle** is stronger than it was in the first vNext package.

The broad architectural picture still holds:

- reliability/gating stays in the base dialogue pass
- core prosody stays safe in the base dialogue pass
- accent remains the clearest true specialist family
- channel/context remains bundleable if quality slips

What changes is the ranking and urgency of the emotion lane.

### Revised takeaway
- **First likely additional bundled pass:** emotion/pragmatics
- **First likely true specialist pass:** accent

That is the main north-star-driven architecture change.

---

## What did not change

The following recommendations from the first architecture note still stand.

### Safe in the base dialogue pass
- `audibility`
- `overlap`
- `pitch_band`
- `pace`
- `energy`

### Still plausible bundle candidates
- `gender_presentation`
- `age_impression`
- `phonation`
- `transmission_medium`
- `spatial_texture`

### Still the clearest specialist family
- `accent_strength`
- `accent_family`

The new north star does not weaken any of those conclusions.

---

## What the north star changes

In the first vNext package, emotion/pragmatics was a sensible bundle candidate, but not yet the most urgent one.

That is no longer quite right.

The revised contract now treats the following as central to preserving how a human recognizes the same speaker across different performances:

- affect / emotion
- delivery posture toward others
- salient overlays like laughter or crying

That means the family:

- `affect`
- `interpersonal_stance`
- `delivery_overlay`

is no longer just “nice to have if quality improves.” It is part of the perceptual identity target itself.

At the same time, `affect` is now broader than in the first draft because it includes at least:

- `tense`
- `amused`
- `disgusted`

That extra breadth increases both value and failure risk.

---

## Revised family classification

| Trait family | Fields | v1 posture | v2 posture | Why |
| --- | --- | --- | --- | --- |
| Reliability / gating | `audibility`, `overlap` | safe in base pass | **unchanged** | inseparable from honest line capture |
| Core prosody / kinetics | `pitch_band`, `pace`, `energy` | safe in base pass | **unchanged** | primary audible cues, still cheap to ask in base |
| Broad presentation | `gender_presentation`, `age_impression` | plausible bundle candidate | **unchanged** | still useful, still not first split pressure |
| Voice quality | `phonation` | plausible bundle candidate | **unchanged** | still strong identity value, but not the main topology change here |
| Channel / environment | `transmission_medium`, `spatial_texture` | plausible bundle candidate | **unchanged** | still useful context, still secondary to recognition core |
| Accent | `accent_strength`, `accent_family` | likely specialist-pass candidate | **unchanged** | still highest sociolinguistic overreach risk |
| Emotion / pragmatics | `affect`, `interpersonal_stance`, `delivery_overlay` | plausible bundle candidate | **strong early bundle candidate** | richer affect coverage is now central to the north star |

---

## Why emotion/pragmatics moves up

## 1. The north star explicitly elevates emotion and delivery

Derrick’s new direction is not abstract. It explicitly says humans recognize the same speaker across performances using cues like:

- emotion
- gender
- pitch
- tone
- delivery

This means emotion/pragmatics is no longer peripheral annotation polish. It is one of the core fidelity targets.

## 2. The affect space is now broader

A narrower affect set can sometimes survive inside a transcript-first pass without too much damage.

A broader and more honest set is harder to extract consistently, especially when the model is also trying to:

- segment dialogue
- repair text
- judge accent
- judge channel/context
- manage overlap uncertainty

Once `affect` includes distinctions like:

- `fearful` vs `tense`
- `happy` vs `amused`
- `angry` vs `disgusted`

the crowded one-pass prompt has more ways to flatten the output back to generic defaults.

## 3. The fields are coupled and should split together if they split at all

If this family is pulled out of the base pass, it should move as a bundle:

- `affect`
- `interpersonal_stance`
- `delivery_overlay`

Splitting only `affect` would be a mistake because these judgments depend on overlapping evidence.

Examples:
- `amused` + `taunting` + `laughing`
- `sad` + `pleading` + `crying`
- `disgusted` + `confrontational` + `none_apparent`

These are cleaner as one narrow interpretive bundle than as separate passes that can contradict each other.

---

## Recommended topology posture after this revision

## Base dialogue pass should still own
- `index`
- `text`
- `audibility`
- `overlap`
- `pitch_band`
- `pace`
- `energy`

These remain closest to honest line capture.

## First additional bundle if one-pass quality is flattening
- `affect`
- `interpersonal_stance`
- `delivery_overlay`

### Why this is now the best first bundle
Because it aligns directly with the revised north star and isolates the most interpretation-heavy speaker-recognition cues without forcing a fully fragmented architecture.

## First true specialist pass if specialist splitting becomes necessary
- `accent_strength`
- `accent_family`

### Why accent still remains the clearest specialist family
Even after the north-star update, accent still has:

- the highest overreach risk
- the highest sensitivity to masking/overlap
- the strongest drift risk into non-perceptual identity claims

So accent remains the cleanest specialist lane.

---

## Revised split order

If the system eventually needs more than one pass, the best default order is now:

1. **emotion/pragmatics bundle first** if same-speaker-recognition quality is flattening on expressive lines
2. **accent specialist** when accent fidelity matters enough to justify dedicated handling
3. **acoustic-context bundle** (`transmission_medium`, `spatial_texture`, optionally with gating review) if the system keeps collapsing medium/context distinctions
4. **presentation/voice bundle** only later if broad one-pass quality still stalls

This is a change from the first note’s implicit priority ordering.

### Important nuance
This does **not** mean accent is less specialist. It means emotion/pragmatics is now the most valuable **first bundled split**, while accent remains the most justified **true specialist split**.

---

## Failure signatures that now matter more

The north star makes the following failure modes more important than before.

### Emotion flattening
Watch for base-pass output collapsing too often to:
- `serious`
- `angry`
- `happy`
- `neutral`

especially on lines that reviewers hear as:
- `tense`
- `amused`
- `disgusted`
- `taunting`

### Stance collapse
Watch for:
- `confrontational` swallowing `taunting`
- `supportive` swallowing more specific reassuring/comforting delivery
- `performative` used as a vague expressive catch-all

### Overlay drop
Watch for audible laughter or crying disappearing because the base pass spent all its attention budget on text recovery or affect selection.

These are exactly the kinds of errors that make two performances by the same speaker feel less recognizably connected.

---

## Evaluation recommendation

If Derrick wants to test whether the split is justified, build a review slice that specifically stresses:

- amused-taunting lines
- disgusted-confrontational lines
- tense low-volume lines
- crying/pleading lines
- laughter-overlay lines where stance still matters

The question is not just overall exact match. The question is whether the one-pass system preserves the **recognition-relevant expressive vector** instead of flattening it.

A bundled emotion/pragmatics pass is justified if it produces a clear sustained gain on:

- exact-match rate for expressive lines
- lower unsupported-guess rate
- lower default-collapse rate into `serious` / `neutral` / `confrontational`
- better rerun stability on the same lines

---

## Bottom line

The first architecture note was broadly right.

The north-star revision changes one core recommendation:

> emotion/pragmatics should now be treated as the strongest early bundle candidate, because richer affect and delivery coverage is part of the actual speaker-recognition goal rather than optional annotation polish.

So the review-ready v2 posture is:

- keep reliability and core prosody in the base pass
- keep accent as the clearest true specialist family
- **promote emotion/pragmatics to the first likely bundled split if one-pass quality flattens**
- do not split affect alone; split the full emotion/pragmatics bundle together

That keeps the architecture honest to Derrick’s north star without turning the system into premature multi-pass sprawl.