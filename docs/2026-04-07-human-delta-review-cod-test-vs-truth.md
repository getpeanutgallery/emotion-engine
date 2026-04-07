# Human delta review: current reconciled cod-test run vs human-verified truth

**Date:** 2026-04-07  
**Fixture:** `cod-test`  
**Scope:** dialogue, speaker profiles, music, music-vocals  
**Run artifacts reviewed:**
- `output/cod-test/phase1-gather-context/dialogue-data.reconciled.json`
- `output/cod-test/phase1-gather-context/music-data.json`
- `output/cod-test/phase1-gather-context/music-vocals-data.reconciled.json`

**Truth artifacts reviewed:**
- `benchmarks/fixtures/cod-test/truth/dialogue-data.json`
- `benchmarks/fixtures/cod-test/truth/music-data.json`
- `benchmarks/fixtures/cod-test/truth/music-vocals-data.json`

**Benchmark report surfaces consulted:**
- `benchmarks/fixtures/cod-test/_reports/benchmark-summary.json`
- `benchmarks/fixtures/cod-test/_reports/artifact-results/dialogueData.json`
- `benchmarks/fixtures/cod-test/_reports/artifact-results/musicData.json`
- `benchmarks/fixtures/cod-test/_reports/artifact-results/musicVocalsData.json`

## Bottom line

From a human review perspective, the current run is **closer than the raw benchmark failure counts make it look**, but it is still **materially wrong in two places**:

1. **speaker separation / dialogue attribution** is still too collapsed to trust as a human-reviewed transcript, and
2. **music-vocals timing/content coverage** still misses important lyric windows and mis-orders the main lyric sequence.

The **music lane** looks much healthier than the score implies. It is coarse and overstates non-music windows as speech/SFX, but a human would still say it captured the main arc and song presence reasonably well.

## Comparator-shape noise vs real human delta

### Mostly comparator-shape / report-shape noise

These inflate benchmark pain but are not the main human problem:

- Extra operational fields in output such as `analysisMode`, `timingMode`, `sourceStrategy`, `coverage`, and `provenance`.
- `musicData` report errors caused by output-only structure like `globalArc` and `qualityNotes`.
- Some recognized-song evidence/note array mismatches where the run is clearly describing the same song but with different evidence packing.
- Synthetic label differences like `Vocalist 1` vs `Metallica lead vocal` or generic `Speaker N` naming by themselves.
- Some timing shifts that are annoying for strict field scoring but still land in the right general moment for a human reviewer.

### Real human-meaningful gaps

These are the differences that still matter after discounting comparator noise:

- Missing spoken lines in dialogue.
- Distinct speaker buckets being merged into only five run-level speakers.
- Multiple truth dialogue beats being fused into one long output segment, which hides speaker changes.
- Music lane under-describing continuous score coverage and intensity outside the obvious metal section.
- Vocal lane missing the early chant entry and later reprise windows.
- Main lyric sequence drifting enough that several lines are anchored to the wrong windows or replaced by nearby but different lyrics.

## Area-by-area review

## 1) Dialogue

### Human verdict

**Partially right, but not transcript-trustworthy yet.** The run captures much of the trailer's spoken content and general story arc, but it still drops lines, merges adjacent lines, and blurs who is talking.

### What is close enough

- The opening spoken setup is broadly there:
  - "They want you afraid. Fear makes you easier to control."
  - "It's time to wake up."
- The Menendez / unrest idea is present.
- Mid-trailer tactical lines are mostly present:
  - "He refuses to let me go."
  - "Stop looking backwards, David..."
  - "A lot of people counting on us for answers."
  - "Spectre One report."
  - "Need a sitrep."
  - "This isn't real."
  - "Pull it together, man!"
  - "No more games. This ends now."
- The trailer still clearly pivots into the preorder promo at the end.

A human listener would say the run understood the trailer's broad spoken beats.

### What still materially differs

#### Missing or materially damaged lines

- The truth line **"Menendez is a terrorist."** is missing as a standalone beat. In the run it is swallowed into the previous long expository segment as corrupted text: **"Menendez is a te Paris."**
- The truth line **"You shall know fear."** is missing entirely from dialogue.
- The final promo truth line **"Get the Reznov challenge pack when you preorder now!"** is split into two weaker lines:
  - "Get the Reznov challenge pack."
  - "And you pre-order now."
  This is understandable, but it is still a degradation from a human transcript perspective.

#### Fused segments that hide real structure

- The run fuses truth segments 2 through 4 into one long block:
  - truth separates **"Your streets...run red with your blood"**
  - then **"Raul Menendez ignited global unrest..."**
  - then **"Menendez is a terrorist."**
- The run instead produces:
  - **"Your streets shall once again run red."**
  - followed by **"With your blood, Raul Menendez ignited global unrest on an unprecedented scale. Menendez is a te Paris."**

This is more than a formatting issue. It collapses speaker changes and damages one of the lines.

- The run also fuses **"So eager to leave daddy."** and **"Killing the man is a hell of a lot easier than killing the idea."** into one segment attributed to a single speaker:
  - **"So eager to leave, David. Killing a man is is a hell of a lot easier than killing the idea."**

That is a real semantic/transcript problem: different wording, merged boundaries, and likely wrong speaker assignment.

#### Wording drift that still matters

- **"The hell it ain't!"** becomes **"The hell it isn't!"** — close, but not exact.
- **"So eager to leave daddy."** becomes **"So eager to leave, David."** — that is a meaningful content change, not just punctuation drift.
- **"Killing the man..."** becomes **"Killing a man..."** — small on paper, but it changes the line.

### Human conclusion for dialogue

The run is **not a disaster**. A person could still understand the trailer and most spoken beats from it. But it is **not yet human-equivalent** because it still drops at least two meaningful lines and collapses enough adjacent material that transcript structure and attribution are unreliable.

## 2) Speaker profiles / speaker separation

### Human verdict

**This is the biggest remaining dialogue-side problem.** The run reduces the trailer to **5 speakers** where truth keeps **13 distinct acoustic buckets**. That compression is too aggressive for human-reviewed output.

### What is close enough

- The run does preserve that there are recurring voices rather than treating every line as a one-off.
- A few buckets are directionally reasonable:
  - one recurring opening/antagonist-like bucket
  - one expository/promo bucket
  - one distressed/personal bucket
  - one command/tactical bucket

If the task were only "roughly group similar voices," the run would be passable.

### What still materially differs

#### Distinct voices are collapsed together

Examples:

- **Run Speaker 1** combines multiple truth roles that should stay separate:
  - opening female/corporate delivery,
  - the "Your streets...run red" menace line,
  - "The hell it ain't!",
  - and the overlap-heavy **"You were never cut out to be a Mason."** bucket.

- **Run Speaker 2** mixes:
  - the expository narrator/newsreel voice,
  - **"We're bringing peace and security to the world,"**
  - and the late promo VO.

- **Run Speaker 4** absorbs several truth speakers that should remain distinct:
  - the older military-leader cadence,
  - the "A lot of people counting on us" line that truth groups with David,
  - **"Pull it together, man!"**
  - and the separate **"Killing the man..."** montage line.

- **Run Speaker 5** merges radio-comms lines with **"No more games. This ends now."** even though truth treats those as different speaker buckets.

#### The model is grouping by rough function instead of acoustic identity

The truth handoff specifically warns not to collapse:
- scene dialogue,
- radio/comms,
- promo VO,
- overlap-heavy hallucination lines,
- and unrelated one-off montage voices.

The run still collapses across those categories. That is a real human-quality issue, not just a benchmark-shape complaint.

#### Profile descriptions are too generic to rescue the clustering

The run's speaker profiles mostly say things like:
- "likely adult"
- "authoritative"
- "tactical"
- "emotional"

Those descriptors are not wrong, but they are too broad to compensate for the over-merged clusters. A human reviewer still would not trust these profiles as evidence that the voice separation is correct.

### Human conclusion for speaker profiles

Speaker profiling is **not close enough yet**. The system is retaining a few recurring voice buckets, but it is still collapsing too many distinct voices into broad classes. This is the clearest remaining semantic gap on the dialogue side.

## 3) Music

### Human verdict

**Closer than the benchmark score suggests.** The run's music result is coarse, but a human would probably accept it as a decent high-level music summary with the caveat that it under-represents continuous score coverage.

### What is close enough

- It correctly identifies that the trailer builds into a **high-energy metal section** tied to **"Master of Puppets."**
- It understands the overall arc: early tension -> stronger build -> aggressive metal peak -> promo/close.
- It marks music as present and recognizes the likely song correctly.

### What still materially differs

#### It under-calls music in the early and late trailer

Truth treats the trailer as **music-driven almost wall-to-wall** across all five segments. The run instead labels:
- `0-35` as **speech** with minimal underlying music,
- `120-140` as **sfx** with fade-out.

From a human listening perspective, that is too conservative. The trailer still has score identity in those windows even when dialogue, promo VO, and effects ride on top.

#### Segment descriptions are too narrow and low-energy outside the obvious metal peak

Truth describes a consistently high-intensity cinematic score with orchestral/electronic/percussive drive. The run describes the first half more like dialogue plus atmosphere, which loses how assertive the score actually is.

#### Song recognition is basically right, but coverage evidence is incomplete

The run only gives the recognized-song time range as `76-98`, while truth also carries later lyric-support windows at `116-118` and `127-130`. That matters more in the vocal lane than the music lane, but it still leaves the music recognition support thinner than the human truth.

### Human conclusion for music

This lane feels **human-close at a coarse summary level**. If the goal is a product-facing summary, it is probably acceptable. If the goal is benchmark-truth fidelity, it still needs better treatment of continuous score presence and later refrain support.

## 4) Music-vocals

### Human verdict

**Song ID is right, lyric coverage is not.** The run clearly recognizes that the trailer is using **Metallica - Master of Puppets**, but the extracted vocal windows are still materially incomplete and partially mis-anchored.

### What is close enough

- The run identifies the correct song with high confidence.
- It catches the central lyric block around `76-104`.
- It preserves the idea that there is also a later reprise/return.

A human reviewer would say the system heard the right song and the right general chorus/lyric family.

### What still materially differs

#### Missing early chant window

Truth includes an earlier chant entry before the main sung block:
- `64-65` **"Obey your master"**
- `68-70` **"Your life burns faster"**

The run misses both entirely and starts the vocal story too late at `76`.

#### Main lyric sequence is shifted and partially replaced by nearby lines

Truth's main sequence is:
- `76-78` **"Master of puppets I'm pulling your strings"**
- `80-83` **"Twisting your mind and smashing your dreams"**
- `84-86` **"Blinded by me, you can't see a thing"**
- `87-88` **"Just call my name, 'cause I'll hear you scream"**
- `89-91` **"Master, master"**
- `91-94` **"Where's the dreams that I've been after?"**
- `94-95.5` **"Master, master"**
- `95.5-98` **"You promised only lies"**

The run instead starts with:
- `76-78` **"Obey your master"**
- `78-80` **"Come crawling faster"**

and then shifts subsequent lines down the sequence. So even where the run hears real lyrics, several are attached to the wrong window or substituted with nearby lyric content.

That is not just formatting noise. It means the lyric timeline is still wrong in a way a human reviewer would notice.

#### Missing later chant / reprise windows

Truth includes later returns at:
- `116-118` **"Obey your master"**
- `127-130` **"Master, master"**

The run misses those windows and instead adds a late **`130-132` "Obey your master"**. That preserves the intuition that there is a reprise, but the placement/content is off.

### Human conclusion for music-vocals

This lane is **not close enough yet** if the output is supposed to function as a trustworthy lyric timeline. The model gets the song and catches the loud center of the chorus, but it still misses the opening chant, misses the later reprise windows, and scrambles parts of the lyric ordering.

## Overall judgment by area

- **Dialogue:** partially right but still materially degraded by dropped lines and fused segments.
- **Speaker profiles:** not close enough; too many distinct voices collapse into five buckets.
- **Music:** close enough for high-level summary, not close enough for benchmark-fidelity segmentation.
- **Music-vocals:** song identification is close enough, lyric timing/content coverage is not.

## Recommended interpretation of the current benchmark delta

If we strip away comparator-shape noise, the remaining human-meaningful issues look like this:

1. **Largest real gap:** speaker clustering / dialogue attribution.
2. **Second largest real gap:** vocal timing and lyric-window coverage.
3. **Smaller but real gap:** dialogue line loss and line fusion.
4. **Mostly acceptable:** music summary, as long as we acknowledge that the run is too conservative about nonstop score presence.

That means the current run is **better than the raw field-pass rate suggests**, but it is **not yet human-equivalent** on the two lanes where exact who-said-what and when-was-it-sung matter most.
