# Dialogue Traits v2 Targeted Eval Slice

**Date:** 2026-04-15  
**Status:** Review-ready eval design  
**Scope:** Small but representative evaluation slice for stress-testing the revised v2 contract, especially the emotion/pragmatics boundaries most likely to flatten in one-pass extraction.

---

## Purpose

This eval slice is designed to answer one operational question:

> is one-pass extraction preserving the honest expressive vector of the line, or is it flattening boundary-heavy emotion/pragmatics judgments into defaults and catch-alls?

The slice is intentionally small enough to run often and review manually, but specific enough to expose the failure modes called out in the v2 audit and architecture note.

This is **not** a full benchmark. It is a targeted stress slice for prompt tuning, validator design, and topology decisions.

---

## Eval package shape

### Recommended size
**30 assets total**.

That is large enough to cover the hard boundaries repeatedly, but still small enough for careful manual review across multiple reruns.

### Recommended asset unit
Each asset should include:
- one retained dialogue line or very short clip
- the literal line text
- the expected trait focus fields for review
- approved alternate labels where warning-level disagreement is acceptable
- a short note about what boundary the asset is probing

### Recommended clip length
- target **1 to 8 seconds** per asset
- long enough to hear delivery shape
- short enough that the judgment stays line-local

### Gold/reference posture
Do **not** make the gold set overly brittle.

For each asset, store:
- **primary expected label(s)**
- **approved alternate label(s)** only where boundary disagreement is genuinely defensible
- **review notes** explaining why the line belongs in the slice

The slice is meant to detect flattening and dishonesty, not punish every near-boundary human disagreement.

---

## Slice composition

## Bucket A — `fearful` vs `tense` under pressure (4 assets)

### Include lines like:
- low-volume urgent whisper with obvious internal pressure but no clear fear signal
- startled or alarmed line with audible fear reaction
- brittle high-stakes briefing line
- danger-response line with retreat/flinch energy

### Boundary probed
- `affect: fearful` vs `tense`
- secondary checks: `phonation`, `energy`, `delivery_overlay` should not be invented

### Failure signature to watch
- defaulting both categories to `serious`
- defaulting both categories to `fearful`
- using text content alone instead of audible fear/strain evidence

---

## Bucket B — `happy` vs `amused` (4 assets)

### Include lines like:
- warm relief or sincere pleasure
- playful delight without mockery
- entertained mockery / smirking reaction
- lightly teasing line with no audible laughter

### Boundary probed
- `affect: happy` vs `amused`
- secondary checks: interaction with `interpersonal_stance: taunting` or `supportive`

### Failure signature to watch
- flattening `amused` to `happy`
- assuming a positive line is always `happy`
- requiring laughter before allowing `amused`

---

## Bucket C — `angry` vs `disgusted` (4 assets)

### Include lines like:
- forceful accusation line
- revulsion/recoil line
- disdain-heavy rejection line
- mixed heat + revulsion line

### Boundary probed
- `affect: angry` vs `disgusted`
- whether `mixed` is used when both are clearly present

### Failure signature to watch
- flattening `disgusted` into `angry`
- overusing `disgusted` for any contemptuous line
- refusing `mixed` when the line audibly carries both

---

## Bucket D — `taunting` vs `confrontational` (4 assets)

### Include lines like:
- baiting challenge with audible smirk/enjoyment
- direct threat or hard challenge with no mockery
- needling line with weak but present playful edge
- hostile line where text sounds taunting but delivery does not

### Boundary probed
- `interpersonal_stance: taunting` vs `confrontational`
- coupling with `affect: amused`, `angry`, or `disgusted`

### Failure signature to watch
- flattening `taunting` into `confrontational`
- inferring `taunting` from wording alone when delivery is simply hostile
- losing the stance distinction whenever the line is aggressive

---

## Bucket E — overlay interactions (`laughing`, `crying`) (4 assets)

### Include lines like:
- amused line with clear laughter overlay
- taunting line with laughter overlay
- pleading or fearful line with crying overlay
- line with audible overlay where underlying affect is ambiguous

### Boundary probed
- `delivery_overlay` vs `affect`
- `delivery_overlay` vs `interpersonal_stance`

### Failure signature to watch
- missing audible overlay entirely
- turning every `laughing` line into `affect: amused`
- turning every `crying` line into `affect: sad`
- losing stance because overlay was detected

---

## Bucket F — transmission-medium and spatial independence (4 assets)

### Include lines like:
- close-sounding radio/comms line
- direct but distant line
- PA/intercom announcement in reverberant space
- media playback heard in a room

### Boundary probed
- `transmission_medium` vs `spatial_texture`
- keeping these fields separate from emotion judgments

### Failure signature to watch
- collapsing everything to `direct` + `close`
- using `processed_or_synthetic` when a specific medium is recognizable
- treating medium as a proxy for distance or vice versa

---

## Bucket G — accent abstention and overreach control (3 assets)

### Include lines like:
- short usable line with no clear accent markedness
- marked-sounding but family-ambiguous line
- heavily processed or masked line where accent should be abstained

### Boundary probed
- `accent_strength` abstention honesty
- `accent_family` conservatism

### Failure signature to watch
- forcing broad-family labels from weak evidence
- using `neutral_or_unmarked` when the line is actually too weak to judge
- treating accent as demographic inference

---

## Bucket H — control lines for over-labeling checks (3 assets)

### Include lines like:
- straightforward `serious` line
- straightforward `neutral`/`directive` line
- straightforward no-overlay line

### Boundary probed
- whether the model is over-correcting into narrow labels everywhere

### Failure signature to watch
- inventing `amused`, `disgusted`, `taunting`, or overlays on clean control lines
- refusing ordinary `serious` or `none_apparent` when they are actually right

---

## What should be stored for each asset

Each asset record should contain at least:

- `asset_id`
- `audio_path` or source pointer
- `text`
- `bucket`
- `target_fields`
- `primary_expected`
- `approved_alternates`
- `review_focus`
- `notes`

### Example shape

```json
{
  "asset_id": "affect-amused-02",
  "bucket": "happy-vs-amused",
  "text": "Oh, now that's interesting.",
  "target_fields": ["affect", "interpersonal_stance", "delivery_overlay"],
  "primary_expected": {
    "affect": "amused",
    "interpersonal_stance": "taunting",
    "delivery_overlay": "none_apparent"
  },
  "approved_alternates": {
    "interpersonal_stance": ["confrontational"]
  },
  "review_focus": "Does the system preserve amused mockery without requiring laughter?",
  "notes": "Use as a taunting-without-overlay test."
}
```

---

## Outputs that matter

The eval should preserve the full one-pass output, but review should focus on the fields the slice is designed to stress.

### Must retain per run
- full extracted line-level trait object
- any validator warnings or retry warnings
- run identifier / prompt version / model version
- reviewer judgment against the primary and approved-alternate sets

### Target fields to review closely
- `affect`
- `interpersonal_stance`
- `delivery_overlay`
- `transmission_medium`
- `spatial_texture`
- `accent_strength`
- `accent_family`

### Secondary context fields to monitor
- `audibility`
- `overlap`
- `phonation`
- `energy`

These matter because some systems hide expressive errors behind noisy gating assumptions.

---

## Reviewer questions

For every asset, reviewers should answer these questions:

1. **Did the output land on the intended boundary, or collapse to a safer default?**
2. **If it missed, was the miss at least an honest abstention?**
3. **Did the model confuse overlay with affect?**
4. **Did the model confuse `taunting` with `confrontational`?**
5. **Did the model confuse `disgusted` with `angry`, or `amused` with `happy`?**
6. **Did the model keep transmission and spatial judgments independent?**
7. **Did the model over-claim accent from weak evidence?**
8. **Would a careful human reviewer call this a true error, or only a warning-level boundary disagreement?**

---

## Metrics to record

This slice is small enough for manual review, but it still needs concrete scoring.

## 1. Boundary-hit rate
For each bucket, record the percentage of assets where the output matches the primary expected label or an approved alternate for the target field(s).

This is the main bucket-by-bucket score.

## 2. Default-collapse rate
Record how often the system falls back to generic labels when the line was included specifically to test a narrower distinction.

Track at least these collapse patterns:
- `serious` swallowing `tense`
- `happy` swallowing `amused`
- `angry` swallowing `disgusted`
- `confrontational` swallowing `taunting`
- `none_apparent` swallowing audible laughter/crying
- `direct` + `close` overused as a pair on medium/spatial assets
- `neutral_or_unmarked` or a concrete accent family forced when abstention was the honest answer

## 3. Honest-abstention rate
Count lines where the system chose `unknown` and reviewers agree that abstention was justified.

This matters because a system can fail in two opposite ways:
- fake specificity
- blanket flattening to defaults

Honest abstention is acceptable; unsupported specificity is not.

## 4. Unsupported-specificity rate
Count lines where the output chose a narrow concrete label that reviewers judge as not actually supported by the audio.

This is especially important for:
- accent family
- overlay inference from text
- narrow affect labels on weak audio

## 5. Rerun stability
Run the exact same slice at least **3 times** under the same extraction setup.

Track whether the target field outputs stay the same or stay within the approved-alternate set across reruns.

This catches unstable boundary behavior that a single run can hide.

---

## Recommended execution protocol

### Step 1 — Build the slice
Assemble the 30 assets above with primary expectations and approved alternates.

### Step 2 — Run the current one-pass extraction
Use the current candidate prompt/setup with no special per-bucket tailoring.

### Step 3 — Repeat 3 times
Repeat the same slice three times to measure rerun stability.

### Step 4 — Manual review
Have at least one careful reviewer score each asset against the target fields. Two reviewers is better for the hardest boundary lines.

### Step 5 — Summarize by bucket
Produce a brief report with:
- bucket hit rate
- default-collapse patterns
- unsupported-specificity cases
- honest-abstention cases
- rerun instability notes

### Step 6 — Decide next action
Use the results to decide whether:
- one-pass is honest enough
- prompt/validator tuning is still sufficient
- emotion/pragmatics now merits a dedicated bundled pass

---

## What "good enough for one-pass" looks like

The one-pass system is good enough only if reviewers see that it is:
- preserving the narrower expressive labels often enough to matter
- abstaining honestly when the evidence is weak
- not repeatedly collapsing boundary-heavy lines into generic defaults
- not inventing narrow labels from text or weak audio
- stable enough across reruns to trust the outputs operationally

If the slice instead shows a repeated pattern of expressive flattening, the topology decision should move from "maybe later" to "split warranted."

---

## Common failure interpretations

### If medium/spatial scores are weak but emotion buckets are fine
That is **not** evidence for an emotion/pragmatics split. It suggests medium/context prompt or schema guidance problems.

### If accent overreach is the dominant failure
That is **not** evidence for an emotion/pragmatics split. It points toward accent guardrails or an accent specialist lane.

### If text recovery is weak and expressive buckets are noisy because of audibility/overlap
Fix capture/gating reliability first. Do not mistake transcription noise for an emotion architecture problem.

### If the emotional buckets are specifically flattening while other fields are stable
That is exactly the evidence this slice is designed to surface.

---

## Bottom line

This eval slice should be treated as the pre-implementation honesty check for v2.

If a one-pass system cannot survive these 30 assets without repeatedly collapsing `tense`, `amused`, `disgusted`, `taunting`, or audible overlays back into safer defaults, then it is not preserving the recognition-relevant expressive vector the v2 contract was designed to keep.