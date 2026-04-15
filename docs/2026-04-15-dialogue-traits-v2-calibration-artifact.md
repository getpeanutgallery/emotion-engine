# Dialogue Traits v2 Calibration Artifact

**Date:** 2026-04-15  
**Status:** Review-ready calibration guidance  
**Scope:** Operational boundary guidance for the revised v2 dialogue traits contract.

---

## Purpose

This document turns the v2 contract and audit notes into short, repeatable calibration rules.

It is meant to help future prompt design, human review, validator-warning design, and eval interpretation stay aligned on the boundary-heavy labels that are most likely to drift or flatten in one-pass extraction.

This is **not** a schema change and **not** a source-truth expansion. The persisted contract stays closed. These rules only clarify how to choose among existing allowed values.

---

## Non-negotiable source-truth boundaries

1. **Stay line-local.** Use only what is audible in the retained line and its immediate presentation context.
2. **Do not infer biography, role, plot, or hidden motive.**
3. **Do not turn weak evidence into forced specificity.** Prefer `unknown` over a guessed concrete label.
4. **Do not use overlay as a shortcut for affect.** `laughing` and `crying` are audible overlays, not full emotional interpretations.
5. **Do not use transmission/spatial labels as identity guesses.** They describe how the line is heard, not who the speaker is.
6. **Accent labels stay conservative.** Broad-family calls require audible support; otherwise abstain.

---

## Fast decision order

Use this order when a line feels ambiguous:

1. **Can I actually hear the line well enough?** If not, use `unknown` for the affected field rather than forcing a guess.
2. **Is there an audible overlay?** Mark `delivery_overlay` only if laughter or crying is clearly heard.
3. **What is the best-supported affect?** Choose the narrower affect only when the line contains audible evidence for that narrower read.
4. **What is the best-supported interpersonal stance?** Aim the line outward: reassuring, taunting, confronting, directing, pleading, etc.
5. **How is the line being heard?** Separate `transmission_medium` from `spatial_texture`.
6. **Is accent marked at all?** First decide `accent_strength`; only then decide whether `accent_family` is supportable.

---

## Sentinel policy: when to abstain, split, or warn

### Prefer `unknown` when:
- the audible evidence for that field is weak, masked, too short, or distorted
- two labels are plausible but neither is actually supported strongly enough
- accent feels "non-neutral" in a vague way but no broad family is trustworthy
- the line is so mediated, shouted, overlapped, or stylized that the field cannot be called honestly

### Prefer `mixed` when:
- two materially different readings are simultaneously present and both are clearly audible
- the field allows `mixed`
- examples:
  - `affect: mixed` when a line audibly carries both anger and disgust at once
  - `interpersonal_stance: mixed` when a line is both directive and supportive in the same breath
  - `delivery_overlay: mixed` when both audible laughter and crying are present

### Prefer `variable` when:
- the field supports `variable`
- the line audibly changes over time within that same retained line
- examples:
  - `pitch_band: variable`
  - `pace: variable`
  - `energy: variable`
  - `spatial_texture: variable`
  - `accent_strength: variable`

Do **not** use `variable` for `affect` or `interpersonal_stance`; those fields use `mixed` rather than `variable`.

### Prefer `none_apparent` when:
- the field uses that sentinel
- the evidence supports an affirmative absence rather than uncertainty
- examples:
  - `delivery_overlay: none_apparent` when no laughter/crying is audibly present
  - `accent_strength: none_apparent` when the line genuinely sounds unmarked rather than merely too weak to judge

### Use warning-level disagreement when:
- one label is still defensible as the primary answer
- a nearby alternate label is also understandable to a careful reviewer
- the disagreement is boundary-local rather than evidence-free
- examples:
  - `fearful` vs `tense` on a hushed urgent line with obvious strain but only mild fear evidence
  - `taunting` vs `confrontational` on a mocking line where the enjoyment signal is weak

Warning-level disagreement should **not** be used to excuse unsupported guesses. If the evidence is not there, use `unknown`.

---

## Boundary cards

## 1. `fearful` vs `tense`

### Core discriminator
- **`fearful`** = the line audibly carries fear, alarm, threat response, or flinch/avoidance.
- **`tense`** = the line audibly carries strain, pressure, or wound-up control without clearly reading as fear.

### Choose `fearful` when you hear:
- alarm, panic, dread, or being spooked
- retreat/avoidance energy
- a line that sounds driven by danger or perceived threat

### Choose `tense` when you hear:
- controlled pressure
- brittle focus
- high-stakes tightness without obvious fear reaction
- a speaker holding themselves together rather than sounding afraid

### Positive examples
- **Prefer `fearful`:** "Did you hear that?" with audible tremor, flinch, and alarm.
- **Prefer `tense`:** "Everybody stay sharp." in a clipped pre-breach whisper with contained pressure.

### Negative examples
- Do **not** call a merely urgent or clipped line `fearful` if no actual fear response is audible.
- Do **not** flatten an obviously alarmed line to `tense` just because it is controlled.

### Calibration note
If reviewers split because the line is clearly pressured but only weakly fear-colored, keep `tense` as the safer default and log a warning-level disagreement.

---

## 2. `happy` vs `amused`

### Core discriminator
- **`happy`** = pleased, warm, satisfied, cheerful, or positively uplifted.
- **`amused`** = entertained, playful, slyly delighted, or enjoying the moment/person with a "that’s funny" quality.

### Choose `happy` when you hear:
- warmth
- relief
- gratitude
- open pleasure or contentment

### Choose `amused` when you hear:
- smirking enjoyment
- entertained mockery
- playful irony
- delight aimed at something specifically funny, absurd, or satisfying in a mischievous way

### Positive examples
- **Prefer `happy`:** "You made it." with warm relief and sincere pleasure.
- **Prefer `amused`:** "Oh, that’s your plan?" with audible smirk and entertained needling.

### Negative examples
- Do **not** flatten playful mockery into generic `happy`.
- Do **not** force `amused` just because the line is positive; simple warmth is still `happy`.

### Calibration note
`amused` often pairs well with `taunting` and sometimes with `delivery_overlay: laughing`, but neither is required. A line can be amused without laughter and can laugh without being amused.

---

## 3. `angry` vs `disgusted`

### Core discriminator
- **`angry`** = forceful hostility, challenge, protest, or heat.
- **`disgusted`** = revulsion, recoil, contemptuous rejection, or "get that away from me" energy.

### Choose `angry` when you hear:
- attack or opposition
- heat and push
- direct hostile challenge

### Choose `disgusted` when you hear:
- recoil or contamination response
- audible disdain or revulsion
- rejecting something as gross, beneath contempt, or unacceptable in a "ugh" way

### Positive examples
- **Prefer `angry`:** "You lied to me." with force, accusation, and heat.
- **Prefer `disgusted`:** "Don’t touch me." with recoil, disdain, and audible revulsion.

### Negative examples
- Do **not** flatten revulsion into `angry` just because the line is intense.
- Do **not** use `disgusted` for every contemptuous challenge if there is no actual recoil/disdain signal.

### Calibration note
If both heat and revulsion are strongly audible, `affect: mixed` is valid. If one dominates and the other is secondary, choose the dominant label and record warning-level disagreement only if a careful reviewer could reasonably defend the alternate.

---

## 4. `taunting` vs `confrontational`

### Core discriminator
- **`taunting`** = baiting, mocking, needling, or provoking with some enjoyment or performative savoring.
- **`confrontational`** = openly hostile, challenging, or oppositional without the baiting/mockery signal.

### Choose `taunting` when you hear:
- a verbal poke
- enjoyment in provocation
- ridicule, teasing, or "come on, hit me" energy
- the speaker sounding like they want a reaction

### Choose `confrontational` when you hear:
- direct challenge or hostility
- hard opposition or threat
- conflict without the extra mocking/playful edge

### Positive examples
- **Prefer `taunting`:** "That all you got?" delivered with smirk and baiting enjoyment.
- **Prefer `confrontational`:** "Say that again." delivered as a hard challenge, no mockery.

### Negative examples
- Do **not** treat every aggressive line as `taunting`.
- Do **not** collapse clear mockery into `confrontational` just because the line is hostile.

### Calibration note
If the line is needling but the enjoyment signal is faint, `confrontational` may be the safer primary label with warning-level disagreement. If the line clearly wants to embarrass or bait, prefer `taunting`.

---

## 5. Overlay vs affect interactions (`laughing`, `crying`)

### Core rule
`delivery_overlay` records an audible surface phenomenon. `affect` records the best-supported emotional coloring. They are related but not interchangeable.

### `laughing`
Use `delivery_overlay: laughing` only when laughter is actually audible.

Possible affect pairings include:
- `amused` + `laughing`
- `happy` + `laughing`
- `angry` + `laughing` (disbelieving or mocking laugh)
- `fearful` + `laughing` is rarer but possible in unstable or panic-laugh reads
- `unknown` + `laughing` if the laughter is audible but the underlying affect is not trustworthy

### `crying`
Use `delivery_overlay: crying` only when crying or sobbing is actually audible.

Possible affect pairings include:
- `sad` + `crying`
- `fearful` + `crying`
- `pleading` stance + `crying`
- `mixed` affect + `crying`
- `unknown` affect + `crying` if the crying is clear but the emotional read is not

### Positive examples
- "You really thought that would work?" with an audible chuckle can be `delivery_overlay: laughing`, `affect: amused`, `interpersonal_stance: taunting`.
- "Please don’t leave." with sobbing can be `delivery_overlay: crying`, `affect: sad`, `interpersonal_stance: pleading`.

### Negative examples
- Do **not** set `affect: amused` only because a laugh is heard; mocking laughter can sit on anger or taunting.
- Do **not** set `affect: sad` only because the speaker is crying; crying can accompany fear, pleading, relief, or mixed emotion.
- Do **not** invent an overlay from text alone.

### Calibration note
If overlay is clear but underlying affect remains uncertain, keep the overlay concrete and set `affect: unknown`. That is more honest than forcing an emotional label from the overlay alone.

---

## 6. `transmission_medium` vs `spatial_texture`

### Core discriminator
- **`transmission_medium`** answers: *what path is the voice traveling through?*
- **`spatial_texture`** answers: *how does the voice sit acoustically in the heard scene?*

### Practical rule
These fields are independent enough that one should not be used as a shortcut for the other.

### Good combinations
- `direct` + `distant`
- `direct` + `reverberant`
- `radio` + `close`
- `pa_or_intercom` + `reverberant`
- `media_playback` + `room`

### Positive examples
- A close-mic comms line can be `radio` + `close`.
- A far-away person shouting in a hallway can be `direct` + `reverberant` or `direct` + `distant`.
- A recorded announcement from a nearby speaker can be `media_playback` + `room`.

### Negative examples
- Do **not** assume `direct` means `close`.
- Do **not** use `processed_or_synthetic` if the line is clearly identifiable as `phone`, `radio`, or `pa_or_intercom`.
- Do **not** use spatial labels to imply medium, or medium labels to imply distance.

### Calibration note
If a line is heavily mediated and spatially ambiguous, keep the recognizable medium concrete and use `spatial_texture: unknown` rather than forcing a fake room/distance call.

---

## 7. Accent abstention guidance

### Decision order
1. Decide whether accent markedness is actually supported: `none_apparent`, `subtle_non_neutral`, `clear_non_neutral`, `variable`, or `unknown`.
2. Only after that, decide whether a broad family is supportable.

### Prefer `accent_strength: unknown` when:
- the line is too short
- the line is shouted, whispered, masked, stylized, or heavily processed
- only one or two weak cues suggest markedness
- reviewers feel "maybe non-neutral" but cannot defend it cleanly

### Prefer `accent_strength: none_apparent` when:
- the line provides enough usable speech to support an affirmative unmarked read
- there is no clear non-neutral accent evidence

### Prefer `accent_family: unknown` when:
- the line sounds marked but broad family is not trustworthy
- the speaker is clearly non-neutral but the family guess would be a leap
- there is any temptation to smuggle in nationality/ethnicity/backstory

### Prefer `accent_family: neutral_or_unmarked` when:
- `accent_strength` is `none_apparent`
- the line actually supports an unmarked read rather than mere uncertainty

### Negative examples
- Do **not** jump from one vowel or one consonant to a broad family label.
- Do **not** force `neutral_or_unmarked` if the line is too weak to judge.
- Do **not** use accent labels as demographic claims.

### Calibration note
For accent, the honest mistake should usually be **under-claiming**, not over-claiming.

---

## 8. Catch-all prevention: `serious`, `unknown`, and default collapse

### `serious`
Use `serious` when the line reads plainly sober, focused, or unplayful, but does **not** cleanly support a narrower emotion such as `tense`, `angry`, `fearful`, or `disgusted`.

Do **not** use `serious` as a dump bin for every hard-to-read expressive line.

### `unknown`
Use `unknown` when the field is genuinely unsupported.

Do **not** use `unknown` to avoid a narrow but well-supported label.

### Warning signs of collapse
Flag calibration risk if reviewers or model outputs repeatedly do any of the following on expressive lines:
- `serious` swallowing `tense`
- `happy` swallowing `amused`
- `angry` swallowing `disgusted`
- `confrontational` swallowing `taunting`
- `none_apparent` swallowing audible overlays

These are evaluation problems, not schema problems.

---

## Minimal reviewer checklist

For each disputed line, ask:

1. **What exact audible evidence supports the chosen label?**
2. **Is the narrower label really supported, or just imaginable?**
3. **Would `unknown` be more honest than the concrete choice?**
4. **Is an overlay being mistaken for affect, or vice versa?**
5. **Are medium and spatial labels being kept separate?**
6. **Is accent being over-claimed from weak evidence?**
7. **Is this a true error or only a warning-level boundary disagreement?**

---

## Short implementation-planning takeaways

1. Future prompts should explicitly remind the model that `laughing`/`crying` do not determine affect.
2. Validator work should treat most cross-field awkwardness here as warning/retry territory, not hard schema failure.
3. Eval design should deliberately include lines that force these boundary calls rather than only easy center-of-category examples.
4. Any one-pass system that repeatedly collapses these distinctions is giving evidence for an emotion/pragmatics bundle split.

---

## Bottom line

The main calibration rule is simple:

> choose the narrower expressive label only when the line audibly earns it; otherwise abstain honestly, and treat nearby defensible alternatives as warning-level review issues rather than excuses for fake certainty.

That keeps v2 practical, closed-contract, and usable for future prompt, validator, and topology planning.