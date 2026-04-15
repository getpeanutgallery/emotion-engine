# Dialogue Traits Pass-Ownership Architecture

**Date:** 2026-04-15  
**Status:** Review-ready architecture note  
**Scope:** Recommended extraction-topology posture for a fidelity-first dialogue traits contract

---

## Goal

Classify each dialogue-trait family by likely extraction topology so future implementation can make a deliberate choice between:

- keeping one broad base dialogue pass
- moving a family into a narrower bundled pass
- giving a family its own likely specialist pass

This document does **not** force a split today. It gives Derrick a reviewable framework for deciding when a one-pass system is still good enough and when it is starting to lie.

---

## Design posture

The right question is **not** “can one prompt technically emit all of these fields?”

It probably can.

The right question is:

> for each trait family, when does one-pass extraction stop being honest enough to deserve its own narrower treatment?

A fidelity-first system should be willing to say:

- these cues are safe to ask for in the base dialogue pass
- these cues probably belong together in a narrower bundle if quality slips
- these cues are specialist enough that we should expect them to split once the product really cares about them

That is a healthier architecture posture than pretending every field is equally easy and equally reliable.

---

## Recommended family classification

| Trait family | Fields | Category | Short reason |
| --- | --- | --- | --- |
| Reliability / gating | `audibility`, `overlap` | **safe in base dialogue pass** | Directly tied to the line being transcribed at all. |
| Core prosody / kinetics | `pitch_band`, `pace`, `energy` | **safe in base dialogue pass** | Coarse, audible, and relatively low-theory. |
| Broad presentation | `gender_presentation`, `age_impression` | **plausible bundle candidate** | Commonly recoverable, but not as source-critical as transcription/gating. |
| Voice quality | `phonation` | **plausible bundle candidate** | High-value, but can get confounded by channel artifacts and stylization. |
| Channel / environment | `transmission_medium`, `spatial_texture` | **plausible bundle candidate** | Perceptually real, but easier to do well when not competing with semantic extraction. |
| Accent | `accent_strength`, `accent_family` | **likely specialist-pass candidate** | Highest sociolinguistic risk and one of the least stable families. |
| Emotion / pragmatics | `affect`, `interpersonal_stance`, `delivery_overlay` | **plausible bundle candidate** | Valuable together, but fidelity drops when squeezed into a transcript-first pass. |

---

## Family-by-family rationale

## 1. Reliability / gating

### Fields
- `audibility`
- `overlap`

### Classification
**Safe in base dialogue pass**

### Why
These fields are almost inseparable from the core work of dialogue extraction itself.

A system cannot honestly transcribe a line without already making an implicit read on:

- how audible it is
- whether it is overlapped

These are not specialist judgments layered on top of transcription. They are part of transcription hygiene.

### Failure mode if split too early
If these fields are moved out too soon, the base pass may start pretending all lines are equally trustworthy. That would be worse than keeping them local to the line-capture pass.

### Recommendation
Keep these in the base pass unless the architecture changes radically.

---

## 2. Core prosody / kinetics

### Fields
- `pitch_band`
- `pace`
- `energy`

### Classification
**Safe in base dialogue pass**

### Why
These are among the most audible and least theory-heavy non-textual cues.

They are also:

- compact
- closed
- relatively easy to explain
- useful downstream even when coarse

They do not require lore inference, character knowledge, or sociolinguistic speculation.

### Failure mode if kept in base too long
The main risk is not catastrophic error. It is lazy overuse of middle/default bins like `mid`, `measured`, and `steady`.

That is a real quality concern, but it is usually a prompt/validator issue before it becomes a topology issue.

### Recommendation
Keep these in the base pass first. Split only if evidence shows the base pass is flattening them into default buckets at high rates.

---

## 3. Broad presentation

### Fields
- `gender_presentation`
- `age_impression`

### Classification
**Plausible bundle candidate**

### Why
These fields are often recoverable in one pass, but they are not equally important to the act of line capture itself.

They also share some characteristics:

- both are coarse presentation impressions rather than textual truth
- both are perceptual but somewhat socially loaded
- both benefit from conservative abstention
- both can be over-guessed when the model is trying to be helpful

That makes them decent candidates for a small “voice presentation” bundle if the one-pass system starts guessing too aggressively.

### Why not immediate specialist-pass candidate?
Because at the current level of coarseness they are still broad enough to ask for alongside transcription.

### Failure signatures to watch
- high `unknown` avoidance on short/noisy lines
- obvious false certainty in adjacent bins (`young_adult` vs `adult`)
- `mixed` used as indecision rather than true blend

### Recommendation
Start in base if needed, but be willing to pull them into a presentation bundle if unsupported-guess pressure shows up.

---

## 4. Voice quality

### Fields
- `phonation`

### Classification
**Plausible bundle candidate**

### Why
Voice quality is often highly useful for speaker grouping and line characterization, but it is vulnerable to interference from:

- channel artifacts
- whispering vs breathiness confusion
- stylized trailer/post-processing
- overlap contamination

It is still realistic to ask for broad voice quality in a base pass, but it also has a clean specialist path if quality matters more later.

### Why not “safe in base”?
Because once the taxonomy becomes fidelity-first instead of bare-minimum, phonation starts competing with the transcript itself for attention. It is still viable in base, but less obviously so than pitch/pace/energy.

### Failure signatures to watch
- `clear` used as a lazy default too often
- `unknown` avoided even on damaged lines
- channel distortion leaking into `phonation`
- whispered lines repeatedly mislabeled as `breathy`

### Recommendation
Treat this as a likely bundle member with other voice-identity cues if base-pass quality stalls.

---

## 5. Channel / environment

### Fields
- `transmission_medium`
- `spatial_texture`

### Classification
**Plausible bundle candidate**

### Why
These cues are perceptually real and high-value, especially for later grouping and scene-shape understanding. But they are not always best extracted while the model is also doing line segmentation and lexical recovery.

They benefit from a narrower question like:

- what path is the voice traveling through?
- how close / roomy / reverberant / distant does it sound?

That is often easier to answer when the pass is not also trying to solve emotion, accent, and transcript repair at the same time.

### Why not “likely specialist-pass candidate”?
Because the coarse version of these judgments is still broadly accessible in one pass.

### Failure signatures to watch
- default collapse to `direct` + `close`
- confusion between `processed_or_synthetic` and `radio`
- spatial texture guessed from scene semantics rather than audio evidence

### Recommendation
Keep available to the base pass, but treat them as a strong candidate for a separate acoustic-context bundle if fidelity matters.

---

## 6. Accent

### Fields
- `accent_strength`
- `accent_family`

### Classification
**Likely specialist-pass candidate**

### Why
This is the family most likely to deserve its own specialist handling if the system truly wants fidelity.

Reasons:

1. **It is one of the least stable families.**  
   Accent reads degrade fast under masking, overlap, processing, and short lines.

2. **It has the highest overreach risk.**  
   A sloppy accent lane can drift into nationality, ethnicity, or lore-like inference very easily.

3. **It is sociolinguistically sensitive.**  
   That raises the cost of false confidence.

4. **It benefits from dedicated attention.**  
   Accent strength and broad family are easier to assess when the prompt is not also juggling segmentation, stance, overlay, and general transcript quality.

### Why keep it in the persisted contract at all?
Because it still has real grouping value and is a meaningful audible property when used carefully.

### Failure signatures to watch
- pressure to avoid `unknown`
- `neutral_or_unmarked` used as a default instead of an earned read
- `accent_family` behaving like open geography in practice
- strong disagreement between reviewers/models on the same clean lines

### Recommendation
Assume this family will be the first serious split candidate once the product starts caring about fidelity, not just structural completeness.

---

## 7. Emotion / pragmatics

### Fields
- `affect`
- `interpersonal_stance`
- `delivery_overlay`

### Classification
**Plausible bundle candidate**

### Why
These fields belong together conceptually.

They describe different parts of a related problem:

- how the speaker seems to feel
- how the line is directed at others
- what audible overlay is riding on top of that stance

Bundling them together later would make architectural sense.

### Why not “safe in base dialogue pass”?
Because the quality cliff is real. When transcript recovery is hard, emotion/pragmatics are among the first families to become guessy.

### Why not immediately “likely specialist-pass candidate”?
Because the broad versions of these fields are still often accessible from the same evidence the transcription model is already using. A narrower emotion/pragmatics bundle is attractive, but not mandatory on day one.

### Failure signatures to watch
- `serious` and `neutral` becoming lazy defaults
- `confrontational` used as a catch-all for all hostile lines
- `mixed` used as indecision instead of real coexistence
- laughter overlay forgotten because stance consumed the whole field

### Recommendation
Design as a bundle candidate, not as a permanent single-pass assumption.

---

## Suggested future bundle boundaries

If implementation later splits the work, these are the cleanest likely bundle seams.

### Bundle A — Voice presentation bundle

Fields:
- `gender_presentation`
- `age_impression`
- `pitch_band`
- `phonation`

Why this bundle makes sense:
- all are broad voice-identity / presentation impressions
- all can support grouping
- all benefit from focused listening rather than semantic interpretation

### Bundle B — Acoustic context bundle

Fields:
- `transmission_medium`
- `spatial_texture`
- optionally `audibility`
- optionally `overlap`

Why this bundle makes sense:
- all are about the heard signal path/context
- they are easy to evaluate together
- they can be decoupled from speaker/persona speculation

### Bundle C — Emotion / pragmatics bundle

Fields:
- `affect`
- `interpersonal_stance`
- `delivery_overlay`

Why this bundle makes sense:
- all are interpretive but still closed
- they share the same core evidence source
- the split from transcript-first work is conceptually clean

### Specialist D — Accent specialist pass

Fields:
- `accent_strength`
- `accent_family`

Why this is the cleanest specialist:
- highest ambiguity cost
- strongest benefit from conservative abstention rules
- easiest family to overfit or overclaim in a crowded prompt

---

## What should stay in the base pass no matter what

Even in a multi-pass future, the base dialogue pass should continue to own at least:

- `index`
- `text`
- `audibility`
- `overlap`
- likely `pitch_band`
- likely `pace`
- likely `energy`

Those are the traits most directly tied to honest line capture and basic reliability.

---

## Evaluation strategy for deciding when one-pass is failing enough to justify splitting

This should be evidence-driven, not preference-driven.

## 1. Build a review set by family, not just by asset

Create a labeled review set with intentional coverage of:

- clean lines
- masked lines
- overlap-heavy lines
- radio/phone/intercom lines
- whisper lines
- emotion-heavy lines
- accent-salient lines

The goal is not just average accuracy. The goal is to expose where specific families break.

## 2. Measure five things per family

For each trait family, track:

1. **Exact-match rate on clean lines**  
   Are we getting the easy cases right?

2. **Unsupported-guess rate**  
   How often did the model choose a concrete value when reviewers thought the right answer was `unknown`?

3. **Sentinel misuse rate**  
   Are `mixed` and `variable` being used correctly, or as generic uncertainty?

4. **Cross-run stability**  
   If the same input is rerun, does the family stay stable or wobble?

5. **Downstream harm**  
   Does bad output in this family materially distort speaker grouping, QA review, or benchmark trust?

## 3. Use split thresholds, not vibes

A family should become a serious split candidate when one or more of these happen on the review set:

- exact-match rate is materially below nearby families on clean lines
- unsupported-guess rate stays high despite prompt/validator tightening
- repeated reruns show high wobble on the same lines
- the family’s errors contaminate adjacent families or downstream grouping
- a narrow experimental bundle or specialist prompt produces a clear sustained gain

### Practical threshold suggestion

Treat a split as justified if a narrower pass improves one or more of these by a clearly material margin, such as:

- **+8 to +10 absolute points** on clean-line exact match
- **~30% or better reduction** in unsupported-guess rate
- materially better rerun stability on the same review set
- clearly lower downstream grouping confusion attributable to that family

These numbers are not sacred, but they are concrete enough to keep decisions honest.

## 4. Split the smallest failing family first

Do not jump from one-pass to five passes because one family is weak.

Preferred order:

1. accent specialist first if needed
2. then emotion/pragmatics bundle if needed
3. then acoustic-context bundle if needed
4. only later consider finer presentation/voice bundles

That keeps the architecture from fragmenting too early.

## 5. Re-evaluate after each split

Every split adds:

- orchestration complexity
- validation complexity
- benchmark complexity
- integration complexity

So each split should earn its keep. If a split does not improve the targeted family enough, roll it back or do not generalize it.

---

## Anti-patterns to avoid

### 1. Splitting because a family is “interesting”

Interesting is not enough. Split only when one-pass failure is measurable.

### 2. Refusing to split because one prompt can technically emit all fields

Capability is not the same thing as reliability.

### 3. Leaving low-fidelity families in the base pass forever out of convenience

That often leads to quiet fake precision.

### 4. Splitting everything immediately

That creates operational sprawl before there is evidence it helps.

### 5. Turning specialist passes into lore passes

Even a specialist accent or emotion pass must remain closed, structural, and anti-biographical.

---

## Recommended posture for Derrick review

If Derrick wants the cleanest immediate path:

- keep one base dialogue pass for now
- adopt the fidelity-first vNext persisted contract
- explicitly mark accent as the first likely specialist family
- treat emotion/pragmatics and channel/context as bundle-ready if evidence says one-pass quality is flattening them
- keep reliability/gating and basic prosody in the base pass

That gives the system a strong design target without prematurely forcing a multi-pass implementation.

---

## Bottom line

The correct architectural stance is:

- **some families are genuinely safe in the base pass**
- **some families should be designed as bundle-ready even if not split yet**
- **accent should be treated as a likely specialist from day one**

That is how a fidelity-first contract stays honest without turning into premature implementation sprawl.
