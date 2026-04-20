# cod-test human master notes — 2026-03-30

## Purpose and scope

This note is the durable, fixture-owned editorial source for the 2026-03-30 human review pass on the `cod-test` trailer. It exists to preserve what Derrick reviewed today in one place before that context gets diluted across benchmark truth JSON, plan notes, and generated artifacts.

The intent is not to replace `truth/dialogue-data.json`. That JSON stays the comparator-facing benchmark artifact. This note is the upstream human-authored source that explains what was actually heard, what was seen on screen around those lines, where speaker reads felt solid, and where uncertainty was intentionally preserved.

This should be usable for at least three later purposes:
- maintaining the gold human-verified dialogue pass
- informing future chunk-analysis review when a line needs to be checked against nearby visuals
- seeding future visual/context benchmark work without pretending this note is frame-perfect shot annotation

## Editorial guardrails used in this note

- Timestamps are trailer-order editorial timings as established in today’s review and carried into `truth/dialogue-data.json`.
- Visual notes are grounded in what Derrick could see in the trailer and the surrounding reviewed chunk context, not in a claim of exact shot-by-shot exhaustiveness.
- Speaker identity notes prefer honesty over neatness.
- If a character read stayed fuzzy, this note leaves it fuzzy.
- Lyrics, promo VO, and overlap-heavy hallucination blends stay separated from normal in-scene dialogue.

## Trailer-order dialogue and context notes

### 0s-10s opening manipulation / wake-up setup

- **0s-5s** — **"They want you afraid. Fear makes you easier to control."**
  - **Visual/context:** Opening glitchy trailer language and destruction imagery; the trailer is still in its stylized setup phase rather than grounded squad action.
  - **Speaker note:** Human-reviewed read supports the same urgent female office/corporate-style speaker used again shortly after.
  - **Confidence / uncertainty:** Speaker lane is fairly solid; exact in-world role remains presentation-first rather than canon-first.

- **8s-10s** — **"It’s time to wake up."**
  - **Visual/context:** City-bending / gravity-distortion imagery and high-intensity cinematic escalation.
  - **Speaker note:** Same reviewed female opening speaker lane as the prior line.
  - **Confidence / uncertainty:** Timing and continuity were treated as settled in today’s pass.

### 12s-26s Menendez threat + official exposition + propaganda beat

- **12s-17s** — **"Your streets, shall once again run red with your blood."**
  - **Visual/context:** Black Ops title-card transition into fire, damaged-screen imagery, and antagonist-coded visual menace.
  - **Speaker note:** Human review strongly supports the deep, gravelly Menendez lane here.
  - **Confidence / uncertainty:** High confidence on the voice read; punctuation/comma style is editorial.

- **17s-21s** — **"Raul Menendez ignited global unrest on an unprecedented scale."**
  - **Visual/context:** Glitching villain face, fire, military destruction, and expository trailer framing.
  - **Speaker note:** Treated as an authoritative male expository/briefing speaker, not automatically the same voice as Menendez.
  - **Confidence / uncertainty:** This is one of the key honesty boundaries. The line names Menendez, but naming him is not proof the speaker is him. Human review kept the identity open: possibly the older general/leader, possibly a separate one-off expository voice.

- **22s-24s** — **"Menendez is a terrorist."**
  - **Visual/context:** Rapid destruction imagery, a near-future title-card / public-message feel, then transition toward tactical deployment.
  - **Speaker note:** Human-reviewed as the same urgent female office/corporate delivery from the opening.
  - **Confidence / uncertainty:** Stronger than the expository male identity question above.

- **24s-26s** — **"We’re bringing peace and security to the world."**
  - **Visual/context:** Corporate-propaganda feel over mech / military escalation, then move into more grounded character and deployment material.
  - **Speaker note:** Same female office/corporate lane as **"Menendez is a terrorist."**
  - **Confidence / uncertainty:** Intentionally kept distinct from the male expository line even though the surrounding section is propaganda-heavy.

### 28s-36s David and the older leader

- **28s-29s** — **"He refuses to let me go."**
  - **Visual/context:** Transition out of propaganda montage into more character-centered trailer material.
  - **Speaker note:** Human-reviewed as David / a distressed younger male character voice.
  - **Confidence / uncertainty:** David read is considered solid on the reviewed segments carrying this voice.

- **30s-33s** — **"Stop looking backwards, David. What matters is what we do next."**
  - **Visual/context:** Serious mentor / commander beat around squad and aircraft staging imagery.
  - **Speaker note:** Human-reviewed older military-leader / general read.
  - **Confidence / uncertainty:** Strong on the older authoritative male lane, without needing to force a specific canon name.

- **35s-36s** — **"A lot of people counting on us for answers."**
  - **Visual/context:** Transition through aircraft / city / staging visuals.
  - **Speaker note:** Human-reviewed as David again, not the older leader.
  - **Confidence / uncertainty:** Important because the emotional ownership of the line stayed with the younger distressed male lane.

### 45s-55s fear / comms checkpoint

- **45s-47s** — **"You shall know fear."**
  - **Visual/context:** Futuristic facility combat, emergency-color lighting, and hallucinatory escalation.
  - **Speaker note:** Older male voice with a robotic / processed filter; antagonist-coded.
  - **Confidence / uncertainty:** Possible Menendez read, but not certain enough to promote. Today’s review explicitly preserved that uncertainty.

- **51s-52s** — **"Specter one, report."**
  - **Visual/context:** Tactical breach / combat comms beat.
  - **Speaker note:** Younger male comms/radio speaker.
  - **Confidence / uncertainty:** Human review supports the same speaker as the next line. An African-American read is supported by the audible pronunciation cue on "report," but that stays as a read, not a hard fact.

- **54s-55s** — **"Need a sitrep."**
  - **Visual/context:** Continued tactical comms pressure during active combat movement.
  - **Speaker note:** Same younger male comms/radio voice as **"Specter one, report."**
  - **Confidence / uncertainty:** One of the reviewed places where speaker continuity was intentionally firmed up.

### 61s-99s squad confusion + Master of Puppets lyric run

- **61s-62s** — **"This isn’t real."**
  - **Visual/context:** Surreal battlefield imagery, impossible-scale objects, and reality-bending action.
  - **Speaker note:** Deeper squadmate voice in-scene.
  - **Confidence / uncertainty:** Human review read this as a deeper African-American male squadmate voice, but that remains a careful read.

- **63s-64s** — **"The hell it ain’t!"**
  - **Visual/context:** Same hallucinatory combat stretch.
  - **Speaker note:** Distinct angry white male squadmate voice.
  - **Confidence / uncertainty:** Human review explicitly ruled out David here.

- **64s-98s lyric sequence**
  - **Lines in order:**
    - **64s-65s** — **"Obey your master."**
    - **68s-70s** — **"Control faster."**
    - **76s-78s** — **"Master of puppets are pulling the strings!"**
    - **80s-83s** — **"Twisting your mind, smashing your dreams!"**
    - **84s-86s** — **"Blinded by me, you can’t see a thing"**
    - **87s-88s** — **"Just call my name ’cause I’ll hear you scream"**
    - **89s-94s** — **"Master, master, where’s the dreams that I’ve been after?"**
    - **94s-98s** — **"Master, master, you promised only lies!"**
  - **Visual/context:** The trailer is fully in surreal combat montage mode: floating islands, impossible landscapes, urban combat, aircraft, location cards, and escalating spectacle.
  - **Speaker note:** These are treated as heavy-metal lyric vocals, not scene dialogue.
  - **Confidence / uncertainty:** The important reviewed decision is categorical, not lyrical perfection: keep the song voice separate from character speech.

- **98s-99s** — **"Pull it together, man!"**
  - **Visual/context:** Late-action squad crisis beat.
  - **Speaker note:** Human review read an African-American female squadmate, with tattoos noted visually in today’s discussion.
  - **Confidence / uncertainty:** Gender read is reasonably strong; detailed visual identity remains descriptive rather than canon-certified.

### 100s-118s menace / memory / confrontation beats

- **100s-102s** — **"So eager to leave daddy."**
  - **Visual/context:** Rapid montage of breaches, strange tech, jungle/desert soldier imagery, and escalating threat language.
  - **Speaker note:** Returns to the Menendez lane.
  - **Confidence / uncertainty:** Human-reviewed as the same deep antagonist voice used earlier.

- **103s-105s** — **"Killing the man is a hell of a lot easier than killing the idea."**
  - **Visual/context:** This lands against the part of the trailer where Frank Woods imagery / memorial-style visual material is in play.
  - **Speaker note:** Distinct white male-sounding montage voice.
  - **Confidence / uncertainty:** Important honesty boundary: likely tied to Frank Woods visual imagery, but not proven to literally be Woods. Also not safely collapsible into Raul or David.

- **108s-110s** — **"You were never cut out to be a Mason."**
  - **Visual/context:** Frank Woods tombstone / memory-heavy montage region with fast transitions into more tactical visuals.
  - **Speaker note:** Mixed, overlap-heavy hallucination blend with female-primary audible layer.
  - **Confidence / uncertainty:** This stayed intentionally messy in the reviewed truth. Treating it as one clean speaker identity would overstate confidence.

- **112s-114s** — **"No more games! This ends now."**
  - **Visual/context:** Full action payoff: soldiers, explosions, giant mech, and confrontation energy.
  - **Speaker note:** Human-reviewed as David.
  - **Confidence / uncertainty:** One of the clearest character-ownership lines in the later trailer.

- **116s-118s** — **"Obey your master!"**
  - **Visual/context:** Climax-to-title-card transition.
  - **Speaker note:** Lyric vocal again, not in-scene character dialogue.
  - **Confidence / uncertainty:** Keep in the music/lyric lane.

### 122s-130s promo closeout / tail

- **122s-124s** — **"Get the Reznov challenge pack when you preorder now!"**
  - **Visual/context:** Pure end-slate / preorder-bonus sales screen.
  - **Speaker note:** Distinct white adult male promo VO.
  - **Confidence / uncertainty:** Strongly separate from scene dialogue and from lyric vocals.

- **127s-130s** — **"Master, master"**
  - **Visual/context:** Static / marketing-heavy late trailer tail with action flashes around the closeout.
  - **Speaker note:** Lyric tail, still not scene dialogue.
  - **Confidence / uncertainty:** End timing was one of the reviewed corrections today and should stay at this longer tail rather than the earlier too-short cutoff.

## Speaker identity notes consolidated

### Human-reviewed stronger reads

- **Speaker 1 / spk_001** — urgent female office/corporate delivery; owns the opening manipulation lines and the anti-Menendez / peace-and-security propaganda lines.
- **Speaker 2 / spk_002** — deep, gravelly antagonist delivery; reviewed as Raul Menendez on the supported segments.
- **Speaker 6 / spk_006** — distressed younger male character voice; reviewed as David on the supported segments.
- **Speaker 7 / spk_007** — older authoritative military-leader cadence; reviewed as an older general/leader read.
- **Speaker 8 / spk_008** — same younger male comms/radio speaker across both comms lines.
- **Speaker 11 / spk_011** — `Master of Puppets` lyric voice, not scene dialogue.
- **Speaker 16 / spk_016** — male promo voiceover, distinct from both scene dialogue and lyrics.

### Human-reviewed but intentionally bounded reads

- **Speaker 3 / spk_003** — authoritative male expository/briefing delivery, but identity not proven. Could be the older general/leader or a separate one-off expository voice.
- **Speaker 9 / spk_009** — deeper in-scene squadmate voice; human review supports a deeper African-American male read, but that remains interpretive.
- **Speaker 10 / spk_010** — angry white male squadmate read; importantly, not David.
- **Speaker 12 / spk_012** — urgent female squadmate command; human review supported an African-American female read and tattoos in the visual impression, but this remains descriptive, not canon-certified.
- **Speaker 13 / spk_013** — white male-sounding montage voice tied to Frank Woods visual imagery; likely contextual connection, not confirmed literal identity.
- **Speaker 14 / spk_014** — older processed antagonist-coded male voice; possibly Menendez, but not certain.
- **Speaker 15 / spk_015** — overlap-heavy blend; female-primary audible layer, but not a clean single-speaker case.

## Uncertainty boundaries to preserve later

These are the places future benchmark work should preserve honestly unless new evidence appears:

- The **17s-21s expository line** should not be auto-collapsed into Menendez just because it names him.
- The **45s-47s processed threat** is antagonist-coded, maybe Menendez, but still not certain enough to mark as confirmed.
- The **103s-105s montage line** belongs with Frank Woods visual imagery context, but the voice should not be promoted to confirmed Frank Woods without stronger evidence.
- The **108s-110s Mason line** is overlap-heavy and should stay represented as mixed / fuzzy rather than flattened into one confident speaker.
- Ethnicity reads that came up in review are best kept as descriptive human impressions tied to voice or visuals, not hard canonical facts.
- Song lyrics and promo VO should remain separate benchmark surfaces from in-scene dialogue.

## Downstream benchmark surfaces this can inform later

### 1. Dialogue truth maintenance

This note is the editorial backstop for `benchmarks/fixtures/cod-test/truth/dialogue-data.json`.

If a future prompt change produces a different dialogue result, this note helps answer:
- was the previous truth grounded in human hearing, or was it scaffold drift?
- was a speaker split intentionally preserved because of real uncertainty?
- was a line categorized as lyric / promo / overlap for an honest reason?

### 2. Chunk-analysis review

The note ties dialogue beats to nearby visible trailer content well enough to sanity-check chunk-analysis summaries later.

Examples:
- the opening manipulation lines belong with glitch / propaganda / destruction setup
- the Woods-adjacent montage line and Mason line belong near the tombstone / memory-heavy stretch
- the preorder line belongs strictly to the end-slate sales section

That makes this useful when checking whether chunk summaries are placing the right visual context around the right spoken material.

### 3. Future visual/context benchmarks

This note is a seed document for future benchmark surfaces that may want to score:
- whether visual context is attached to the right dialogue moment
- whether expository / propaganda / squad / hallucination / promo phases are recognized correctly
- whether the system respects uncertainty in identity-heavy montage sections

It is not yet a frame-by-frame gold visual annotation set, but it is the durable human-authored map of what mattered today.

## Bottom line

The main thing to preserve from today’s review is not just the cleaned dialogue text. It is the combination of:
- trailer-order line placement
- visible contextual beats Derrick was actually reacting to
- honest speaker separation
- and the refusal to pretend uncertain identities were solved when they were not

That combination is what makes this useful as the upstream editorial source for the current gold dialogue pass and for later video-chunk benchmarking work.
