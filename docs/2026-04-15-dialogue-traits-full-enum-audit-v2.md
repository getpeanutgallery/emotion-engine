# Dialogue Traits Full Enum Audit v2

**Date:** 2026-04-15  
**Status:** Review-ready design audit  
**Scope:** Revised per-trait audit of the proposed vNext dialogue traits contract using Derrick’s new north star: preserve the perceptual cues humans use to recognize the same speaker across unrelated performances.

---

## Executive summary

The first vNext package was directionally right, but this north star changes the center of gravity.

The contract is no longer just trying to be a cleaner closed trait bundle. It is trying to preserve the **perceptual evidence a human uses to say “that still sounds like the same speaker”** even when:

- the role changes
- the text changes
- the scene context changes
- the performance emotion changes

That sharpened goal does **not** justify reopening the source-truth boundary. The following still remain correct and non-negotiable:

- no speaker ownership in source truth
- no role/lore labels
- no free-text traits
- closed required per-line trait fields

What it **does** change is which perceptual dimensions deserve persistence emphasis.

### Biggest conclusions from this v2 audit

1. **The first vNext field split decisions still stand.**  
   `channel_texture` should remain split into `transmission_medium` + `spatial_texture`, and `delivery_stance` should remain split into `interpersonal_stance` + `delivery_overlay`.

2. **Affect can no longer be treated as merely “mostly good enough.”**  
   If the contract is supposed to preserve cross-performance recognizability, the affect enum set needs to cover more of the common human emotion space at a coarse-but-useful level.

3. **The highest-value affect additions are `disgusted`, `amused`, and `tense`.**  
   Derrick explicitly called these out, and they also clear the design bar independently.

4. **Do not add a standalone `tone` field.**  
   Human-recognizable “tone” is real, but as a contract field it would become a junk drawer. The right design is to preserve tone compositionally through:
   - `pitch_band`
   - `phonation`
   - `pace`
   - `energy`
   - `affect`
   - `interpersonal_stance`
   - `delivery_overlay`

5. **`taunting` remains the right stance addition.**  
   The first vNext package was right to add it. It captures a common delivery posture that humans distinguish from generic confrontation.

6. **Most other core fields were already about the right width.**  
   This north-star revision should be remembered as an **affect/completeness tightening pass**, not a license for taxonomy sprawl.

---

## North-star framing

The key design question is no longer just:

> what traits can we persist as closed source truth?

It is now also:

> which closed perceptual traits best preserve the cues humans use to recognize the same speaker across unrelated performances?

That reframes the field families like this:

### Primary speaker-recognition cues
These are among the strongest line-local cues for same-speaker recognition:

- `gender_presentation`
- `pitch_band`
- `phonation`
- `pace`
- `energy`
- `accent_strength`
- `accent_family`
- `affect`
- `interpersonal_stance`
- `delivery_overlay`

### Supporting but lower-authority cues
These can still help, but should not be over-trusted:

- `age_impression`
- `transmission_medium`
- `spatial_texture`

### Gating / reliability cues
These do not identify the speaker, but they determine whether other cues should be trusted:

- `audibility`
- `overlap`

---

## Summary verdict table

| Field | Speaker-recognition value | v2 verdict | Recommendation |
| --- | --- | --- | --- |
| `audibility` | indirect / gating | strong | keep as-is |
| `overlap` | indirect / gating | strong | keep as-is |
| `gender_presentation` | high | strong | keep as-is |
| `age_impression` | medium-low | acceptable | keep as-is, keep low-authority |
| `pitch_band` | high | strong | keep as-is |
| `phonation` | very high | strong after v1 revision | keep v1 shape; clarify `clear` semantics |
| `pace` | medium-high | strong | keep as-is |
| `energy` | medium-high | strong enough | keep as-is |
| `transmission_medium` | support/context | strong | keep as v1 split field |
| `spatial_texture` | support/context | strong | keep as v1 split field |
| `accent_strength` | medium-high | usable | keep with conservative abstention |
| `accent_family` | medium-high but risky | usable with guardrails | keep with bounded broad-family rules |
| `affect` | very high | insufficient in v1 | expand materially |
| `interpersonal_stance` | high | strong | keep v1 shape; tighten boundaries |
| `delivery_overlay` | medium-high | strong enough | keep as-is |

---

## Cross-cutting sentinel policy

These semantics should remain normative.

### `unknown`
Use `unknown` when the retained line does not support a reliable call for that specific field.

Do **not** use `unknown` to mean:

- “probably X”
- “multiple things are present”
- “it changed over time”
- “I do not want to decide cleanly”

### `mixed`
Use `mixed` only when materially different values are simultaneously or inseparably present in a field that supports mixing.

Do **not** use `mixed` as generic uncertainty.

### `variable`
Use `variable` only when one retained line audibly traverses multiple states over time.

Do **not** use `variable` for multi-speaker contamination.

### `none_apparent`
Where present, `none_apparent` is an affirmative read, not abstention.

---

## Tone is real, but should stay distributed

The north star explicitly names **tone** as a key human recognition signal.

That does **not** mean the contract should add:

```json
"tone": "warm"
```

That would immediately collapse multiple distinct phenomena back into one fuzzy bucket.

The cleaner design is to let “tone” emerge from a stable combination of existing fields:

- **pitch region** via `pitch_band`
- **voice texture / tone color** via `phonation`
- **kinetic profile** via `pace` + `energy`
- **emotional coloring** via `affect`
- **directed delivery** via `interpersonal_stance`
- **salient overlays** via `delivery_overlay`

That preserves the perceptual signal without reintroducing a junk-drawer field.

---

## Field-by-field audit

## 1. `audibility`

### What it captures
How intelligible the line is as heard.

### Recommended enum set
- `clear`
- `partially_masked`
- `heavily_masked`
- `unknown`

### Speaker-recognition relevance
Indirect but essential. If audibility is bad, every other same-speaker cue becomes less trustworthy.

### v2 verdict
**Keep as-is.**

### Recommendation
No new values needed. The right move is to continue using this as a gating field rather than trying to make it more expressive.

---

## 2. `overlap`

### What it captures
Whether other voices materially contaminate the line.

### Recommended enum set
- `single_voice`
- `background_overlap`
- `competing_overlap`
- `unknown`

### Speaker-recognition relevance
Indirect but essential. Overlap is one of the fastest ways to hallucinate a speaker-specific cue that does not actually belong to one speaker.

### v2 verdict
**Keep as-is.**

### Recommendation
No new values needed. Keep the line between `background_overlap` and `competing_overlap` sharp.

---

## 3. `gender_presentation`

### What it captures
Coarse perceived vocal presentation, not identity.

### Recommended enum set
- `feminine`
- `masculine`
- `androgynous`
- `mixed`
- `unknown`

### Speaker-recognition relevance
High. Humans use this heavily when tracking the same voice across very different lines.

### v2 verdict
**Keep as-is.**

### Recommendation
No expansion needed. The important work here is definitional discipline:

- `androgynous` = one stable presentation that reads neither strongly feminine nor masculine
- `mixed` = materially blended/conflicting cues
- `unknown` = insufficient support

---

## 4. `age_impression`

### What it captures
Coarse perceived age impression of the heard voice.

### Recommended enum set
- `child`
- `teen`
- `young_adult`
- `adult`
- `older_adult`
- `elder`
- `unknown`

### Speaker-recognition relevance
Real but weaker than pitch, phonation, accent, or affect.

### v2 verdict
**Keep as-is, but keep it low-authority.**

### Recommendation
Do not expand. The current bins are already at the outer edge of what line-local evidence can support honestly.

---

## 5. `pitch_band`

### What it captures
Coarse perceived pitch region.

### Recommended enum set
- `low`
- `mid`
- `high`
- `variable`
- `unknown`

### Speaker-recognition relevance
High. This is one of the clearest cross-performance cues humans use.

### v2 verdict
**Keep as-is.**

### Recommendation
No expansion needed. `variable` remains important because some recognizable performers move pitch dramatically within a line.

---

## 6. `phonation`

### What it captures
Primary voice-quality / tone-color impression.

### Recommended enum set
- `clear`
- `breathy`
- `whispered`
- `raspy`
- `nasal`
- `thin`
- `full`
- `strained`
- `mixed`
- `unknown`

### Speaker-recognition relevance
Very high. Along with pitch, this is one of the strongest line-local same-speaker cues.

### v2 verdict
**Keep the first vNext shape.**

### Why this is enough for now
The first vNext package already fixed the biggest miss by adding `whispered`. That remains the correct move.

The current set now captures the main coarse voice-color distinctions humans actually notice:

- airy / breath-led
- whispered
- rough / rasped
- nasal
- thin / light-bodied
- full / resonant
- strained / pressed

### Additional note
`clear` here must mean **unmarked phonation**, not “audible” or “high fidelity.”

### Recommendation
Do not add a separate `tone_color` field. `phonation` is already carrying the right part of that load.

---

## 7. `pace`

### What it captures
How quickly the line is delivered.

### Recommended enum set
- `slow`
- `measured`
- `fast`
- `variable`
- `unknown`

### Speaker-recognition relevance
Medium-high. Delivery speed is one of the recurring cues humans remember.

### v2 verdict
**Keep as-is.**

### Recommendation
No changes needed.

---

## 8. `energy`

### What it captures
Coarse delivery intensity.

### Recommended enum set
- `calm`
- `steady`
- `intense`
- `variable`
- `unknown`

### Speaker-recognition relevance
Medium-high. Energy profile is part of recognizability, especially across emotionally different performances.

### v2 verdict
**Keep as-is.**

### Recommendation
No expansion needed. Do not add extra bins like `explosive` or `subdued`; they would mostly create unstable boundary fights.

---

## 9. `transmission_medium`

### What it captures
What kind of transmission or reproduction path the voice appears to travel through.

### Recommended enum set
- `direct`
- `phone`
- `radio`
- `pa_or_intercom`
- `media_playback`
- `processed_or_synthetic`
- `unknown`

### Speaker-recognition relevance
Secondary. This is mostly support/context rather than stable speaker identity.

### v2 verdict
**Keep the first vNext split.**

### Why it still matters
Even though it is not a core identity field, it preserves context that prevents false non-matches or false matches.

The same speaker can sound very different across:

- direct speech
- radio speech
- PA/intercom speech
- synthetic or heavily processed playback

### Recommendation
Keep this field, but do not over-weight it as identity evidence.

---

## 10. `spatial_texture`

### What it captures
How the voice sits spatially/acoustically in the heard scene.

### Recommended enum set
- `close`
- `room`
- `reverberant`
- `distant`
- `variable`
- `unknown`

### Speaker-recognition relevance
Secondary. Mostly contextual, but still perceptually important.

### v2 verdict
**Keep the first vNext split.**

### Recommendation
Keep as-is. Like `transmission_medium`, this is mainly valuable because it preserves context honestly rather than pretending the voice is presented the same way in all lines.

---

## 11. `accent_strength`

### What it captures
Whether a non-neutral accent impression is absent, subtle, clear, changing, or unsupported.

### Recommended enum set
- `none_apparent`
- `subtle_non_neutral`
- `clear_non_neutral`
- `variable`
- `unknown`

### Speaker-recognition relevance
Medium-high. Accent-markedness is one of the cues humans do use for recognition, but it is fragile under masking and overlap.

### v2 verdict
**Keep as-is with conservative abstention.**

### Recommendation
The field shape is fine. The important discipline is to avoid forcing an accent-strength call on weak evidence.

---

## 12. `accent_family`

### What it captures
Broad accent-family impression while remaining coarse and non-biographical.

### Recommended enum set
- `neutral_or_unmarked`
- `anglophone_non_neutral`
- `hispanic`
- `slavic`
- `germanic`
- `romance`
- `south_asian`
- `east_asian`
- `southeast_asian`
- `african`
- `middle_eastern`
- `mixed`
- `unknown`

### Speaker-recognition relevance
Medium-high, but also one of the highest-risk fields.

### v2 verdict
**Keep the first vNext expansion, but keep it tightly bounded.**

### Why it still belongs
Humans do use broad accent-family impressions as part of same-speaker recognition.

### Why it must stay conservative
If this field gets loose, it drifts immediately toward:

- nationality claims
- ethnicity claims
- lore claims
- fake confidence

### Recommendation
Keep the field, keep `anglophone_non_neutral`, and prefer `unknown` aggressively when the line does not support a clean broad-family call.

---

## 13. `affect`

### What it captures
Apparent internal feeling state or affective coloring.

### First vNext package problem
This is where the old package was too conservative.

The earlier view was that `affect` was “mostly sufficient.” Under the new north star, that is no longer convincing.

If the system is meant to preserve the cues humans use to recognize the same speaker across unrelated performances, affect needs to cover more than:

- calm
- serious
- angry
- sad
- fearful
- happy
- sensual
- surprised
- determined

That older set misses several common human-recognizable affective states that materially change how the same speaker sounds.

### Recommended enum set
- `calm`
- `serious`
- `angry`
- `sad`
- `fearful`
- `tense`
- `happy`
- `amused`
- `disgusted`
- `surprised`
- `determined`
- `sensual`
- `mixed`
- `unknown`

### Why the three additions clear the bar

#### `tense`
Important because many line reads are audibly tight, strained, wound-up, or anxious **without** reading as fully fearful.

Examples:
- clipped pre-combat whisper
- brittle high-stakes briefing
- tightly controlled line with obvious internal strain

`tense` preserves a common human reading that neither `serious` nor `fearful` captures well.

#### `amused`
Important because amusement is a common recognizable delivery color and is not the same as generic happiness.

Examples:
- entertained mockery
- playful delight
- sly enjoyment while baiting another character

Many speakers sound recognizably like themselves when amused in a way that `happy` flattens.

#### `disgusted`
Important because disgust/revulsion is a common human emotion and is not reducible to anger.

Examples:
- audible revulsion
- recoiling disdain
- contempt-inflected rejection

`disgusted` often carries a distinct mouth shape, timing, and tone pattern that humans recognize.

### Values considered but not added now

#### `contemptuous`
Not added as a separate affect value because it can often be represented well enough by:

- `disgusted`
- plus `interpersonal_stance: taunting` or `confrontational`

#### `affectionate`
Not added because the signal usually reads more cleanly through a combination of:

- `happy` or `sensual`
- plus `interpersonal_stance: supportive` or `seductive`

#### `bored`
Not added because it risks becoming a catch-all for low-energy serious delivery.

### v2 verdict
**Expand materially.** This is the single most important north-star-driven change.

---

## 14. `interpersonal_stance`

### What it captures
How the line is outwardly directed or positioned toward others.

### Recommended enum set
- `neutral`
- `directive`
- `confrontational`
- `supportive`
- `pleading`
- `taunting`
- `seductive`
- `performative`
- `mixed`
- `unknown`

### Speaker-recognition relevance
High. Humans do not just hear what someone feels; they hear how the line is being aimed.

### v2 verdict
**Keep the first vNext shape.**

### Why `taunting` still matters
`taunting` remains the right addition because it captures a recurring posture that is not well modeled by `confrontational` alone.

Key distinction:
- `confrontational` = openly hostile, challenging, or aggressive
- `taunting` = baiting, needling, mocking, or enjoying the provocation

### Recommendation
No new stance values are required right now. The main need is boundary guidance, not taxonomy growth.

---

## 15. `delivery_overlay`

### What it captures
Narrow audible overlays riding on top of the main stance.

### Recommended enum set
- `none_apparent`
- `laughing`
- `crying`
- `mixed`
- `unknown`

### Speaker-recognition relevance
Medium-high. Overlays can radically change the surface performance while still preserving same-speaker identity cues.

### v2 verdict
**Keep as-is.**

### Recommendation
Keep the field narrow. Do not let it become a grab-bag for every delivery nuance. That would recreate the exact overload this split was meant to fix.

---

## Recommended v2 contract posture by field

### Keep unchanged from the first vNext package
- `audibility`
- `overlap`
- `gender_presentation`
- `age_impression`
- `pitch_band`
- `phonation`
- `pace`
- `energy`
- `transmission_medium`
- `spatial_texture`
- `accent_strength`
- `accent_family`
- `interpersonal_stance`
- `delivery_overlay`

### Change from the first vNext package
- **expand `affect`** with:
  - `tense`
  - `amused`
  - `disgusted`

### Explicit non-change
- **do not add a standalone `tone` field**

---

## Biggest design decisions in this v2 audit

1. **The north star strengthens the case for richer affect, not for open text.**
2. **Speaker-recognition fidelity is mostly preserved through a vector, not one magic field.**
3. **Affect needed real expansion; stance did not need another burst of taxonomy.**
4. **Tone should stay distributed across phonation/prosody/affect/stance, not become a new junk drawer.**
5. **The first vNext structural splits were right and should be preserved.**

---

## Bottom line

The first vNext package got the structure mostly right.

The north-star revision changes one thing decisively:

> affect must cover more of the common human emotion space if the contract is supposed to preserve the cues people use to recognize the same speaker across unrelated performances.

The review-ready v2 posture is therefore:

- keep the closed source-truth boundary
- keep the first vNext field architecture
- keep `taunting`
- keep tone distributed rather than adding a new `tone` field
- expand `affect` with `disgusted`, `amused`, and `tense`

That is the minimal-but-real change needed to make the contract better aligned with Derrick’s stated north star.