# Dialogue + speakers delta review: current run vs human benchmark

**Date:** 2026-04-07  
**Scope:**
- Current run: `output/cod-test/phase1-gather-context/dialogue-data.reconciled.json`
- Truth: `benchmarks/fixtures/cod-test/truth/dialogue-data.json`
- Report support: `benchmarks/fixtures/cod-test/_reports/artifact-results/dialogueData.json`

## Bottom line

From a human review perspective, the current run is **partially usable for rough spoken-line recall**, but it is **not trustworthy as a dialogue benchmark pass**.

Two things are happening at once:
1. Several spoken lines are still recognizable or nearly recognizable.
2. The run repeatedly **drops lines, fuses adjacent beats, and collapses distinct voices into a handful of broad speaker buckets**.

So the artifact still preserves some broad story shape, but it loses too much line separation and too much speaker separation to count as human-close on dialogue + speakers.

## High-level scorecard

- Dialogue segments: **18 output vs 20 truth**
- Speaker profiles: **5 output vs 13 truth**
- Main failure mode: **content fusion + speaker collapse**, not total transcription failure

## What looks close enough

These parts are reasonably close from a human perspective, even if some speaker IDs are wrong:

- `They want you afraid. Fear makes you easier to control.`
- `It's time to wake up.`
- `We're bringing peace and security to the world.`
- `He refuses to let me go.`
- `A lot of people counting on us for answers.`
- `Pull it together, man!`
- `No more games! This ends now.` (punctuation drift only)

There are also lines that are **recognizable but damaged** rather than fully wrong:

- `Your streets, shall once again run red with your blood.` → output keeps the opening threat but drops the key ending: `Your streets shall once again run red.`
- `Stop looking backwards, David. What matters is what we do next.` → output preserves the intent but damages the wording: `Stop looking backwards, David, but now this is what we do next.`
- `Get the Reznov challenge pack when you preorder now!` → output captures the promo idea, but breaks one line into two weaker fragments: `Get the Reznov challenge pack.` + `And you pre-order now.`

## Main dialogue deltas

### 1) Missing lines

Three truth lines are missing outright as distinct dialogue beats:

- `Menendez is a terrorist.`
- `The hell it ain't!`
- `So eager to leave daddy.`

These are not minor misses. Each one matters to how a human reads the trailer:
- `Menendez is a terrorist.` is a clean propaganda/expository beat.
- `The hell it ain't!` is a distinct squad-response beat in the confusion section.
- `So eager to leave daddy.` is a separate taunt that should land before the later montage line.

### 2) Damaged lines

Some lines survive only in damaged form:

- `Your streets, shall once again run red with your blood.` becomes `Your streets shall once again run red.`
  - The line still reads as a threat, but the most memorable phrase, `with your blood`, is lost from the line where it belongs.
- `Raul Menendez ignited global unrest on an unprecedented scale.` becomes `With your blood, Raul Menendez ignited global unrest on an unprecedented scale. Menendez is a te Paris.`
  - This is materially wrong, not just noisy. It drags leftover words forward and ends with gibberish (`te Paris`).
- `Specter one, report.` becomes `Spectre One report.`
  - This is close enough for human meaning.
- `Get the Reznov challenge pack when you preorder now!` becomes two split promo fragments.
  - Human meaning survives, but the benchmark truth is cleaner and more natural.

### 3) Fused beats are a major problem

The most obvious human-facing defect is that the run keeps **smearing adjacent spoken beats together**.

#### Opening fusion cluster

Truth keeps these as separate beats:
- `Your streets, shall once again run red with your blood.`
- `Raul Menendez ignited global unrest on an unprecedented scale.`
- `Menendez is a terrorist.`

Current run turns that into:
- `Your streets shall once again run red.`
- `With your blood, Raul Menendez ignited global unrest on an unprecedented scale. Menendez is a te Paris.`

Human read:
- the end of the threat line is pulled into the next beat
- the expository line gets contaminated by neighboring material
- the `Menendez is a terrorist.` beat disappears as its own line
- the result feels like stitched-together residue instead of clean dialogue segmentation

#### Late montage fusion cluster

Truth keeps these as separate beats:
- `So eager to leave daddy.`
- `Killing the man is a hell of a lot easier than killing the idea.`

Current run merges them into one long line:
- `So eager to leave, David. Killing a man is is a hell of a lot easier than killing the idea.`

Human read:
- this is materially wrong
- the taunt is altered (`daddy` → `David`)
- the next line inherits the wrong lead-in
- `the man` becomes `a man`
- the double `is is` shows chunk-join damage rather than a small transcription slip

This is exactly the kind of fused-beat error that makes the artifact unreliable for downstream narrative or speaker evaluation.

### 4) Mid-scene line drift after the comms section

Around the `You shall know fear` / `Specter one, report` / `Need a sitrep` / `This isn't real` / `The hell it ain't!` block, the run loses ordering clarity.

Human read of the output:
- `Spectre One report.` and `Need a sitrep.` are both present
- `This isn't real.` is present
- but `You shall know fear.` disappears into the comms bucket area
- and `The hell it ain't!` is replaced by `The hell it isn't!`

`The hell it isn't!` is semantically close to the truth line, but in this artifact it lands where the benchmark expects a different speaker beat (`This isn't real.` / `The hell it ain't!` sequence). So it is not just wording drift; it also contributes to beat confusion.

## Main speaker-grouping deltas

### 1) The run collapses 13 truth speakers into 5 output buckets

This is the biggest speaker problem.

Truth intentionally preserves separate buckets for:
- opening female office/corporate voice
- antagonist threat voice
- expository/briefing voice
- David / distressed younger male voice
- older military leader voice
- comms voice
- separate squadmate responses
- urgent female squadmate command
- montage voice tied to Frank Woods imagery
- overlap-heavy `Mason` line
- distinct promo announcer voice

The current run compresses all of that into only five buckets. That is far too aggressive.

### 2) Speaker 1 is over-expanded

Output `spk_001` covers:
- the two opening lines
- the damaged threat line
- `The hell it isn't!`
- `You were never cut out to be a Mason.`

Human read:
- the opening voice being grouped together is fine
- everything after that is over-merged
- the `Mason` line is explicitly overlap-heavy in truth and should not be treated as just the opening speaker continuing
- the squad-response line `The hell it isn't!` also should not collapse back into the opening female bucket

So `spk_001` becomes a catch-all bucket for unrelated material.

### 3) Speaker 2 mixes antagonist/expository/promotional surfaces

Output `spk_002` covers:
- the expository `Raul Menendez ignited...` line (already contaminated)
- `We're bringing peace and security to the world.`
- both promo fragments at the end

Human read:
- this bucket wrongly joins at least three different surfaces:
  - villain threat residue
  - formal propaganda/expository narration
  - end-card sales VO
- truth explicitly keeps the end promo as its own speaker (`spk_016`)
- truth also keeps the antagonist taunt voice distinct from the expository narration

This collapse materially hurts human interpretation because scene voice, propaganda voice, and promo voice do not function like one person.

### 4) Speaker 4 is doing too much work

Output `spk_004` covers:
- `Stop looking backwards, David...`
- `A lot of people counting on us for answers.`
- `Pull it together, man!`
- fused `So eager to leave, David... Killing a man...`

Human read:
- truth splits these across several distinct voices: older leader, David, urgent squadmate command, and a separate montage voice
- output turns them into one broad authoritative bucket
- this is a classic collapsed-speaker failure: similar intensity/cadence gets mistaken for same-speaker continuity

This bucket alone wipes out some of the most important human distinctions in the clip.

### 5) Speaker 5 also over-collapses separate contexts

Output `spk_005` covers:
- `Spectre One report.`
- `Need a sitrep.`
- `No more games. This ends now.`

Human read:
- the first two lines do belong together in truth as the same comms voice
- but `No more games! This ends now.` belongs to David's distressed character voice (`spk_006`), not the radio/comms bucket

So this is a good example of something that is **partly right and then materially wrong**.

### 6) Overlap-heavy attribution is flattened instead of preserved

Truth intentionally treats `You were never cut out to be a Mason.` as an overlap-heavy speaker bucket with mixed layers and female-primary audibility.

Output assigns it cleanly to `Speaker 1`.

Human read:
- the text itself is fine
- the attribution is too certain
- the benchmark is right to preserve ambiguity here
- output loses an important fact about how the line is actually heard

This matters because the artifact is supposed to help human interpretation, and false certainty is worse than explicit ambiguity in overlap-heavy audio.

## What is close enough vs materially wrong

### Close enough

These are acceptable or near-acceptable from a human line-content perspective:
- opening two lines
- `We're bringing peace and security to the world.`
- `He refuses to let me go.`
- `A lot of people counting on us for answers.`
- `Pull it together, man!`
- `No more games! This ends now.`
- `Specter one, report.` / `Need a sitrep.` as text capture, though speaker grouping later drifts

### Materially wrong

These are the biggest problems:
- loss of three distinct truth lines entirely
- opening-line contamination across `with your blood` / `Raul Menendez...` / `Menendez is a terrorist.`
- late fusion of `So eager to leave daddy.` into `Killing the man...`
- collapse from 13 truth speaker profiles to 5 output profiles
- promo VO merged into the same bucket as earlier non-promo lines
- overlap-heavy `Mason` line assigned with false precision
- comms/squad/leader/montage voices repeatedly merged into broad generic buckets

## Human conclusion

If the question is, "Can a human still recognize the trailer's broad spoken content from this run?" the answer is **yes, partly**.

If the question is, "Is this run close enough to the benchmark on dialogue content and speaker grouping?" the answer is **no**.

The dominant issue is not ordinary word error. It is **structure error**:
- adjacent beats getting fused
- distinct beats disappearing
- distinct voices getting collapsed into a few generic buckets

That means the run is still useful as rough recall, but it is not reliable enough for human-grade dialogue/speaker truth.
