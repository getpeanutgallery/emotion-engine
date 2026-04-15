# Dialogue Traits Full Enum Audit

**Date:** 2026-04-15  
**Status:** Review-ready design audit  
**Scope:** Full per-trait audit of the current stored-v2 dialogue `traits` contract documented in `docs/2026-04-14-dialogue-line-traits-contract.md`

---

## Executive summary

The stored-v2 contract is structurally strong and should **keep** its closed, source-truth-only posture:

- no speaker ownership in source truth
- no role/lore labels
- no open-ended free text
- required top-level `summary`
- required closed `traits` object on every line

The biggest taxonomy result from this audit is **not** that the whole ontology needs to be exploded. Most current fields are already about as coarse as they should be.

The main recommendations are narrower and more disciplined:

1. **Keep most core fields as-is**: `audibility`, `overlap`, `gender_presentation`, `age_impression`, `pitch_band`, `pace`, `energy`, and mostly `affect`.
2. **Revise `phonation` modestly**: add `whispered`; stop using `distorted` as a voice-quality catch-all.
3. **Restructure `channel_texture`** into at least two dimensions in vNext. The current key mixes transmission medium, spatial distance, and processing artifacts.
4. **Tighten the accent family**: keep the two-field design (`accent_strength` + `accent_family`), but add a non-neutral anglophone bucket and make abstention/consistency rules explicit.
5. **Split the current `delivery_stance` overload** in vNext. It currently mixes interpersonal stance with overlays like laughter. The cleanest vNext shape is `interpersonal_stance` plus a narrow `delivery_overlay` field.
6. **Write down exact sentinel semantics**. `unknown`, `mixed`, and `variable` must stop being soft junk drawers.

If Derrick wants a fidelity-first but still reviewable persisted contract, the right move is a **major contract revision with a small number of high-value structural fixes**, not a giant ontology sprawl.

---

## Current stored-v2 fields under audit

The current stored-v2 line contract contains exactly:

- `audibility`
- `overlap`
- `gender_presentation`
- `age_impression`
- `pitch_band`
- `phonation`
- `pace`
- `energy`
- `channel_texture`
- `accent_strength`
- `accent_family`
- `affect`
- `delivery_stance`

---

## Cross-cutting sentinel semantics

These semantics should be treated as normative in any vNext contract.

### `unknown`

Use `unknown` only when the line does **not** support a reliable call for that field.

`unknown` means:

- insufficient evidence
- masking/noise/overlap prevents confidence
- the field cannot be judged from the retained line

`unknown` does **not** mean:

- “probably X”
- “I do not want to decide”
- “multiple things are present”
- “the value changed over time”

### `mixed`

Use `mixed` only when **multiple materially different values are genuinely present at once** and the field supports that concept.

Good uses:

- `gender_presentation: mixed` for genuinely blended multi-cue presentation in the retained line
- `phonation: mixed` for materially blended textures in the line
- `accent_family: mixed` for truly blended family impressions that cannot be honestly reduced to one family

Bad uses:

- as a substitute for uncertainty
- as a substitute for overlap contamination when the right answer is actually `unknown`

### `variable`

Use `variable` only when **one retained line traverses more than one state over time**.

Good uses:

- `pitch_band: variable`
- `pace: variable`
- `energy: variable`

Bad uses:

- as a synonym for indecision
- as a multi-speaker overlap token

### `none_apparent`

Where present, `none_apparent` is an affirmative observation, not abstention.

Example:

- `accent_strength: none_apparent` means the line sounds unmarked/neutral to the annotator, not that accent could not be judged.

---

## Summary verdict table

| Field | Current verdict | Recommended action |
| --- | --- | --- |
| `audibility` | strong | keep as-is |
| `overlap` | strong | keep as-is, tighten semantics |
| `gender_presentation` | strong | keep as-is, clarify `androgynous` vs `mixed` |
| `age_impression` | acceptable | keep as-is, treat as weak cue |
| `pitch_band` | strong | keep as-is |
| `phonation` | incomplete | add `whispered`; stop overloading `distorted` |
| `pace` | strong | keep as-is |
| `energy` | acceptable | keep as-is |
| `channel_texture` | overloaded | replace with multiple dimensions in vNext |
| `accent_strength` | usable but fuzzy | keep field, revise sentinel semantics |
| `accent_family` | least mature | keep field, add non-neutral anglophone bucket, tighten guidance |
| `affect` | mostly good | keep mostly as-is |
| `delivery_stance` | overloaded | split in vNext |

---

## Field-by-field audit

## 1. `audibility`

### What the key is trying to capture
How intelligible the line is as heard.

### Current enum set
- `clear`
- `partially_masked`
- `heavily_masked`
- `unknown`

### Sufficiency
**Sufficient as-is.**

This is one of the cleanest fields in the contract. It is short, operationally useful, and directly relevant to later reliability handling.

### Missing values
None urgent.

I would **not** add finer bins like `slightly_masked` or `barely_intelligible`. That would create apparent precision without much real value.

### Overloaded values that should be split
None.

### Should the key itself be restructured?
No.

### Exact abstention semantics
- `unknown` = the annotator cannot reliably judge line audibility from the retained line itself
- do **not** use `unknown` just because the line is damaged; use `partially_masked` or `heavily_masked` when the damage level is itself clear

### Examples
- `"Get down!"` over light score bleed but still readable → `partially_masked`
- clipped, overlap-heavy line where words survive only in fragments → `heavily_masked`

### Recommendation
**Keep as-is in vNext.**

---

## 2. `overlap`

### What the key is trying to capture
Whether other voices materially contaminate the retained line.

### Current enum set
- `single_voice`
- `background_overlap`
- `competing_overlap`
- `unknown`

### Sufficiency
**Sufficient as-is.**

### Missing values
None urgent.

Adding more overlap bins would likely make annotation less stable without buying much downstream value.

### Overloaded values that should be split
Not split, but definitions need tightening:

- `background_overlap` should mean there is still one clearly dominant primary line
- `competing_overlap` should mean multiple voices materially compete for intelligibility or identity cues

### Should the key itself be restructured?
No.

### Exact abstention semantics
- `unknown` = overlap state itself cannot be judged
- do not use `unknown` simply because the line is noisy; if the overlap pattern is clear, use the concrete overlap value

### Examples
- command line with faint crowd chatter under it → `background_overlap`
- two characters shouting across each other in the same retained line → `competing_overlap`

### Recommendation
**Keep as-is in vNext, but add sharper definitions.**

---

## 3. `gender_presentation`

### What the key is trying to capture
Coarse perceived vocal presentation, not identity.

### Current enum set
- `feminine`
- `masculine`
- `androgynous`
- `mixed`
- `unknown`

### Sufficiency
**Sufficient as-is.**

### Missing values
None urgent.

### Overloaded values that should be split
The real issue is semantic drift between `androgynous`, `mixed`, and `unknown`.

Recommended distinction:

- `androgynous` = one stable presentation that reads neither strongly masculine nor strongly feminine
- `mixed` = materially blended or conflicting presentation cues within the retained line
- `unknown` = insufficient evidence to judge

### Should the key itself be restructured?
No.

### Exact abstention semantics
- prefer `unknown` for uncertainty
- do not use `mixed` as “hard to tell”

### Examples
- one calm, stable voice with ambiguous presentation → `androgynous`
- retained line contains blended or conflicting presentation cues from overlap/dual voicing → `mixed`

### Recommendation
**Keep as-is in vNext; clarify definitions only.**

---

## 4. `age_impression`

### What the key is trying to capture
Coarse perceived age impression of the audible voice.

### Current enum set
- `child`
- `teen`
- `young_adult`
- `adult`
- `older_adult`
- `elder`
- `unknown`

### Sufficiency
**Sufficient enough to keep.**

### Missing values
No urgent missing values.

### Overloaded values that should be split
Adjacent middle bins are inherently fuzzy:

- `teen`
- `young_adult`
- `adult`
- `older_adult`

That fuzziness is acceptable if the field stays coarse and low-authority.

### Should the key itself be restructured?
No. A more detailed age ontology would not be trustworthy enough.

### Exact abstention semantics
- `unknown` should be used aggressively on short, masked, or stylized lines
- do not force a middle-age distinction when the audio does not support it

### Examples
- child voice in clear isolation → `child`
- short processed comms line with little age evidence → `unknown`

### Recommendation
**Keep as-is in vNext; explicitly treat it as a weak cue.**

---

## 5. `pitch_band`

### What the key is trying to capture
Coarse perceived pitch region.

### Current enum set
- `low`
- `mid`
- `high`
- `variable`
- `unknown`

### Sufficiency
**Strong as-is.**

### Missing values
None urgent.

### Overloaded values that should be split
None.

### Should the key itself be restructured?
No.

### Exact abstention semantics
- `variable` = the line audibly traverses bands or resists honest reduction to one band
- `unknown` = pitch region cannot be judged

### Examples
- taunt that starts low and rises sharply into a sneer → `variable`
- heavily masked radio line with unclear pitch region → `unknown`

### Recommendation
**Keep as-is in vNext.**

---

## 6. `phonation`

### What the key is trying to capture
Primary vocal texture / voice-quality impression.

### Current enum set
- `clear`
- `breathy`
- `raspy`
- `nasal`
- `thin`
- `full`
- `strained`
- `distorted`
- `mixed`
- `unknown`

### Sufficiency
**Not sufficient unchanged.**

### Missing values
The most obvious missing value is:

- `whispered`

Whispering is common, perceptually salient, and not the same as ordinary breathiness.

### Overloaded values that should be split
The problematic value is:

- `distorted`

It currently risks mixing:

- voice-production roughness
- channel distortion
- electronic processing
- clipped or filtered transmission artifacts

That is too much for one token in a field that is supposed to describe voice quality.

### Should the key itself be restructured?
**Not necessarily split into multiple keys**, but the enum set should be cleaned.

The simplest high-value fix is:

- add `whispered`
- remove or strongly de-emphasize `distorted` as a voice-quality bucket
- let obvious transmission distortion live in the channel/environment family instead

### Exact abstention semantics
- `mixed` = multiple voice textures are materially present in the retained line
- `unknown` = not enough reliable signal to judge voice quality
- do not use `mixed` as a substitute for channel damage

### Examples
- hushed threat delivered without normal voiced tone → `whispered`
- line with both breathy and raspy qualities → `mixed`
- radio crackle causing apparent distortion while the core voice seems otherwise plain → not `phonation: distorted`; put the artifact in the channel family

### Recommendation
**Revise in vNext.**

Recommended vNext enum set:

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

---

## 7. `pace`

### What the key is trying to capture
How quickly the line is delivered.

### Current enum set
- `slow`
- `measured`
- `fast`
- `variable`
- `unknown`

### Sufficiency
**Strong as-is.**

### Missing values
None urgent.

### Overloaded values that should be split
None.

### Should the key itself be restructured?
No.

### Exact abstention semantics
- `variable` = the line materially shifts pacing within itself
- `unknown` = pacing cannot be judged from the line

### Examples
- clipped panic line that accelerates mid-sentence → `variable`
- clean briefing voice with steady cadence → `measured`

### Recommendation
**Keep as-is in vNext.**

---

## 8. `energy`

### What the key is trying to capture
Coarse delivery intensity.

### Current enum set
- `calm`
- `steady`
- `intense`
- `variable`
- `unknown`

### Sufficiency
**Good enough to keep.**

### Missing values
No urgent additions.

A more detailed intensity scale would probably increase inconsistency faster than value.

### Overloaded values that should be split
`steady` is broad, but that is acceptable for a coarse field.

### Should the key itself be restructured?
No.

### Exact abstention semantics
- `variable` = intensity changes materially within the line
- `unknown` = insufficient evidence

### Examples
- low-key but firm briefing → `steady`
- screaming or highly forceful line → `intense`

### Recommendation
**Keep as-is in vNext.**

---

## 9. `channel_texture`

### What the key is trying to capture
How the recording/transmission path sounds, separate from the speaker’s intrinsic voice.

### Current enum set
- `clean`
- `reverberant`
- `radio`
- `phone`
- `distant`
- `processed`
- `unknown`

### Sufficiency
**Not sufficient as one field.**

This is the most clearly overloaded current key.

### Missing values
The most obvious missing value in current form is:

- `pa_or_intercom`

But the bigger problem is not just one missing value. The field mixes multiple dimensions.

### Overloaded values that should be split
Current values mix at least three different questions:

1. **Transmission medium**
   - `radio`
   - `phone`
   - missing `pa_or_intercom`
   - much of `processed`

2. **Spatial / room perspective**
   - `distant`
   - `reverberant`
   - some of `clean`

3. **Signal treatment**
   - much of `processed`

`clean` is also overloaded because it can imply both “no obvious transmission medium” and “close/dry capture.”

### Should the key itself be restructured?
**Yes.**

This key should be replaced in vNext by at least two fields:

- `transmission_medium`
- `spatial_texture`

That gives the contract a much cleaner place for lines like:

- direct but distant voice
- radio but close/intelligible voice
- intercom in a reverberant hall
- processed/synthetic but close voice

### Exact abstention semantics
For current stored-v2:

- `unknown` = the line does not support a reliable read on channel texture

For vNext:

- each replacement field should have its own `unknown`
- do not encode spatial uncertainty inside medium values or vice versa

### Examples
- overhead base announcement → current field wants `pa_or_intercom`, but really also implies its own room character
- same speaker heard clean in one line and on radio in the next → current field handles that, but cannot cleanly distinguish medium from distance/space

### Recommendation
**Restructure in vNext.**

Recommended replacement fields:

#### `transmission_medium`
- `direct`
- `phone`
- `radio`
- `pa_or_intercom`
- `media_playback`
- `processed_or_synthetic`
- `unknown`

#### `spatial_texture`
- `close`
- `room`
- `reverberant`
- `distant`
- `variable`
- `unknown`

---

## 10. `accent_strength`

### What the key is trying to capture
Whether a non-neutral accent impression is absent, subtly present, clearly present, or not supportable.

### Current enum set
- `none_apparent`
- `subtle_non_neutral`
- `clear_non_neutral`
- `mixed`
- `unknown`

### Sufficiency
**Usable, but not clean enough.**

### Missing values
The bigger issue is not a missing concrete strength level. It is that `mixed` is doing the wrong job here.

### Overloaded values that should be split
`mixed` is ambiguous in this field. It can accidentally mean:

- multiple speakers
- code-switching
- unstable accent read over time
- blended accent signals
- mere annotator uncertainty

That is too much.

### Should the key itself be restructured?
The two-field accent design should stay, but the strength field needs cleaner sentinel behavior.

### Exact abstention semantics
Recommended vNext semantics:

- `none_apparent` = affirmative read that no non-neutral accent impression is apparent
- `subtle_non_neutral` = present but weak/subtle
- `clear_non_neutral` = present and clear
- `variable` = same retained line shifts accent-markedness over time in a way the annotator can hear
- `unknown` = the line does not support a reliable accent-strength judgment

Notably:

- use `unknown` instead of `mixed` for simple uncertainty
- use `unknown` instead of `mixed` when multi-speaker contamination prevents clean judgment

### Examples
- clean unmarked line → `none_apparent`
- subtle but consistent non-neutral English accent coloring → `subtle_non_neutral`
- overlap-heavy line where accent cannot be isolated → `unknown`

### Recommendation
**Keep the field, revise the sentinel policy.**

Recommended vNext enum set:

- `none_apparent`
- `subtle_non_neutral`
- `clear_non_neutral`
- `variable`
- `unknown`

---

## 11. `accent_family`

### What the key is trying to capture
A broad-family accent impression while remaining structurally closed and non-biographical.

### Current enum set
- `neutral_or_unmarked`
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

### Sufficiency
**This is the least mature field in the current contract.**

### Missing values
The biggest practical hole is:

- `anglophone_non_neutral`

Without that bucket, many common English-language accent impressions are forced into either `neutral_or_unmarked` or poor-fit families like `germanic`.

### Overloaded values that should be split
Several current values are much broader or more uneven than others:

- `germanic`
- `hispanic`
- `african`

That said, I do **not** recommend a huge pre-implementation accent ontology.

### Should the key itself be restructured?
Not into many more fields yet. The right move is still one closed family field paired with accent strength.

But it needs stricter governance:

- it must stay broad
- it must not become nationality, ethnicity, or lore labeling
- it should be treated as a likely lower-reliability field than pitch/pace/overlap

### Exact abstention semantics
- `neutral_or_unmarked` should only be used when the line genuinely sounds unmarked/neutral and `accent_strength` is `none_apparent`
- `mixed` should mean materially blended family impressions, not uncertainty
- `unknown` should be used aggressively when evidence is weak or contaminated

### Examples
- clearly non-neutral British/Commonwealth-style English accent impression → `anglophone_non_neutral`
- line has clear non-neutral accent strength but family cannot be responsibly narrowed → `unknown`
- overlap creates conflicting family reads → usually `unknown`, not automatically `mixed`

### Recommendation
**Keep the field, expand modestly, and tighten rules.**

Recommended vNext enum set:

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

This is still imperfect, but it plugs the biggest real-world coverage hole without turning the field into a sociolinguistic research project.

---

## 12. `affect`

### What the key is trying to capture
Apparent internal feeling state or affective read.

### Current enum set
- `calm`
- `serious`
- `angry`
- `sad`
- `fearful`
- `happy`
- `sensual`
- `surprised`
- `determined`
- `mixed`
- `unknown`

### Sufficiency
**Mostly sufficient.**

### Missing values
One can argue for additional emotions like `disgusted`, `amused`, or `tense`, but I do not think they clear the bar for immediate persisted-contract expansion.

### Overloaded values that should be split
The main impure token is:

- `serious`

`serious` is broader than a pure emotion. It is closer to general affective tone or demeanor.

Even so, I recommend keeping it. Why?

Because forcing every non-happy, non-angry, non-fearful, non-sad line into a “pure emotion” ontology would create fake precision. `serious` is imperfect, but pragmatically useful.

### Should the key itself be restructured?
Not yet.

A split into narrower emotion axes would likely create more annotation noise than value at this stage.

### Exact abstention semantics
- `mixed` = multiple affective reads are genuinely present
- `unknown` = the line does not support a stable affect call
- do not use `mixed` for mere indecision

### Examples
- calm but grim warning → `serious`
- frightened character forcing out a line → `fearful`
- line that audibly blends determination and anger → `mixed`

### Recommendation
**Keep mostly as-is in vNext.**

This is one field where “mostly keep it” is the right answer.

---

## 13. `delivery_stance`

### What the key is trying to capture
How the line is directed or performed toward others.

### Current enum set
- `neutral`
- `directive`
- `confrontational`
- `supportive`
- `pleading`
- `sexual`
- `laughing`
- `performative`
- `mixed`
- `unknown`

### Sufficiency
**Not sufficient unchanged.**

### Missing values
The clearest missing value is:

- `taunting`

That is a common dramatic delivery posture and is not the same as generic confrontation.

### Overloaded values that should be split
This key currently mixes at least two different dimensions:

1. **Interpersonal stance**
   - `neutral`
   - `directive`
   - `confrontational`
   - `supportive`
   - `pleading`
   - `sexual`
   - missing `taunting`

2. **Delivery overlay / manner**
   - `laughing`
   - much of what people will mean by `performative`

`laughing` is not really a stance. It is an overlay or manner of delivery.

### Should the key itself be restructured?
**Yes.**

The cleanest vNext fix is:

- rename the stance field to `interpersonal_stance`
- add a second narrow field such as `delivery_overlay`

That lets the contract say:

- a line is `taunting`
- while also being delivered with `laughing`

instead of forcing a single token to do both jobs.

### Exact abstention semantics
For current stored-v2:

- `mixed` should mean multiple directed/performed stances are materially present
- `unknown` should mean the stance cannot be judged

For vNext:

- `delivery_overlay: none_apparent` should be the normal affirmative default when no overlay is heard
- `delivery_overlay: unknown` should be reserved for genuine uncertainty

### Examples
- sneering bait line → `taunting`, not merely `confrontational`
- line delivered while audibly laughing → stance might be `taunting` or `supportive`; overlay is `laughing`
- trailer promo voice addressing an audience → `performative`

### Recommendation
**Restructure in vNext.**

Recommended replacement fields:

#### `interpersonal_stance`
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

#### `delivery_overlay`
- `none_apparent`
- `laughing`
- `crying`
- `mixed`
- `unknown`

Note: `seductive` is a better vNext label than stored-v2 `sexual` because it describes outward delivery posture rather than explicit content claims.

---

## Recommended vNext posture by field

## Keep unchanged
- `audibility`
- `overlap`
- `gender_presentation`
- `age_impression`
- `pitch_band`
- `pace`
- `energy`
- mostly `affect`

## Keep field, revise enums/semantics
- `phonation`
- `accent_strength`
- `accent_family`

## Replace with multiple dimensions
- `channel_texture` → `transmission_medium` + `spatial_texture`
- `delivery_stance` → `interpersonal_stance` + `delivery_overlay`

---

## Biggest design decisions from this audit

1. **Do not reopen the source-truth philosophy.** The anti-lore / anti-speaker-ownership boundary is still right.
2. **Do not explode the ontology everywhere.** Most current fields are already the right width.
3. **Fix the fields that are truly overloaded.** The two biggest structural offenders are `channel_texture` and `delivery_stance`.
4. **Treat accent as real but carefully bounded.** It belongs in the contract, but with stricter rules and likely specialist-pass ownership later.
5. **Preserve `affect` largely as-is.** It is imperfect but still doing useful work.
6. **Write exact sentinel semantics into the contract.** This is mandatory, not optional documentation polish.

---

## Bottom line

The current stored-v2 contract is a good base, but a fidelity-first vNext should not simply be stored-v2 plus four enum values.

The review-worthy maximalist move is:

- keep the closed persisted source-truth envelope
- keep most strong coarse fields
- add `phonation: whispered`
- add a non-neutral anglophone accent-family bucket
- replace `channel_texture` with cleaner channel/environment dimensions
- replace `delivery_stance` with a stance field plus a narrow overlay field
- formalize `unknown` / `mixed` / `variable` so the contract stops leaking ambiguity into random tokens

That yields a contract that is materially more faithful without becoming an ontology hairball.
