# Dialogue capture prompt exclusion audit

Date: 2026-04-08
Status: Audit only — no runtime behavior changed

## Goal

Identify wording in the live dialogue prompt and recent 2026-04-07 prompt drafts that may cause the first-pass dialogue model to drop, trim, or refuse borderline spoken material because it resembles lyrics, chant, promo VO, or music-led vocals.

## Files reviewed

Live/runtime:
- `server/scripts/get-context/get-dialogue.cjs`
- `test/scripts/get-dialogue.test.js`

Prompt drafts / review notes:
- `docs/dialogue-transcription-prompt-v2-2-draft-2026-04-07.md`
- `docs/dialogue-transcription-prompt-v2-1-draft-2026-04-07.md`
- `docs/dialogue-transcription-prompt-v2-draft-2026-04-07.md`
- `docs/dialogue-prompt-review-2026-04-07.md`
- `.plans/2026-04-07-redraft-dialogue-prompt-to-restore-speaker-detail-and-allow-vocals-for-reconciliation.md`

Observed miss evidence reviewed:
- `docs/2026-04-07-dialogue-and-speakers-delta-review-current-run-vs-benchmark.md`

## Bottom line

The prompt direction improved from the older explicit `spoken-only / split immediately / keep only the spoken portion` language, but the live prompt still contains exclusion wording that can bias the model toward throwing away exactly the ambiguous spoken-vocal material Derrick wants preserved for later reconciliation.

The main issue is not one single line. It is the cumulative effect of repeated instructions that frame music-led or lyric-led vocals as something the dialogue pass should actively reject. For borderline material — chant-like threats, rhythmic promo delivery, shouted callouts over score, speech-song, and hybrid spoken/sung lines — that bias can plausibly cause the model to:
- omit the line entirely,
- keep only a truncated fragment,
- split one coherent spoken-promo line into weaker pieces,
- decide a line belongs somewhere other than dialogue before reconciliation gets a chance to inspect it.

That failure mode matches the reviewed benchmark miss:
- Truth: `Get the Reznov challenge pack when you preorder now!`
- Output: `Get the Reznov challenge pack.` + `And you pre-order now.`

A promo line like that is especially vulnerable because it is rhythmic, stylized, late in the trailer, and partially music-backed. If the prompt keeps reminding the model to exclude lyric-led / melody-led / music-led vocal material, the model has a reason to treat that surface as partially non-dialogue and under-capture it.

## Risky instructions in the live prompt

### 1) Live whole-asset scope rule still tells the model to exclude musical vocal material

From `server/scripts/get-context/get-dialogue.cjs`:

> `- Exclude clearly lyric-led, melody-led, or predominantly musical vocal passages when they do not plausibly function as dialogue.`

Why this is risky:
- `lyric-led`, `melody-led`, and `predominantly musical` are fuzzy categories from the model’s point of view.
- Borderline spoken material in trailers often rides on score, chanting, hype cadence, or promo-announcer rhythm without cleanly separating into "dialogue" vs "song".
- The line gives the model permission to reject a passage before capture if it merely feels musically shaped.
- In practice that can hit promo/challenge-pack copy, shouted cadence lines, villain taunts over music, or chant-like crowd/VO phrases.

Recommendation:
- **Soften or invert.** Replace exclusion-first wording with capture-first wording.
- Better direction: preserve intelligible words whenever the material plausibly functions as speech, promo VO, taunt, comms, narration, or dialogue-like address, even if it is rhythmically or musically delivered.
- Reconciliation should strip clearly non-dialogue lyrics later.

### 2) Live whole-asset mixed-material rule still encourages partial trimming instead of preserving full first-pass evidence

From `server/scripts/get-context/get-dialogue.cjs`:

> `- If a segment mixes spoken content with music-led vocalization, keep the intelligible dialogue-like portion that is supportable from the audio.`

Why this is risky:
- `keep the ... portion` is a trimming instruction.
- It encourages the model to decide, during first-pass capture, which words are the acceptable dialogue-like subset and which words should be discarded.
- That is exactly the judgment Derrick wants to postpone until reconciliation.
- For ambiguous lines, the model may save only a short safe fragment instead of the full intelligible utterance.
- This is a plausible contributor to late promo fragmentation like `Get the Reznov challenge pack.` / `And you pre-order now.` instead of one retained line.

Recommendation:
- **Remove or invert.** Prefer preserving the full intelligible utterance when the utterance still functions as speech-like content, then mark lower confidence if needed.
- If a later cleanup pass wants to split or discard the musical parts, let it do so with broader context.

### 3) Live chunked prompt repeats the same exclusion/partial-keep bias

From `server/scripts/get-context/get-dialogue.cjs`:

> `- Exclude clearly lyric-led, melody-led, or predominantly musical vocal passages when they do not plausibly function as dialogue.`

> `- If a segment mixes spoken content with music-led vocalization, keep the intelligible dialogue-like portion that is supportable from the audio.`

Why this is risky:
- The chunked pass is even more vulnerable than the whole-asset pass because it has less global context.
- A local chunk may over-read a stylized line as "musical" and discard it, even if the full trailer makes it obvious the line functions as promo copy, threat, or narration.
- When repeated in both whole-asset and chunked prompts, the exclusion bias becomes stable and test-reinforced rather than incidental.

Recommendation:
- Make the chunked prompt at least as capture-friendly as the whole-asset intent Derrick wants.
- Explicitly tell the chunk model not to discard intelligible speech-like vocals merely because score, chant cadence, or melodic contour is present.

### 4) Final artifact rules echo the same exclusion shape during validator/runtime guidance

From `server/scripts/get-context/get-dialogue.cjs` final artifact rules:

> `Include intelligible dialogue and dialogue-like vocal material when it plausibly functions as dialogue. Exclude purely instrumental or otherwise non-vocal sections.`

> `Keep the intelligible dialogue-like portion of mixed spoken/music-led vocal material when it is supportable from the audio.`

Why this is risky:
- The first line is mostly fine, but paired with the second it still teaches partial retention instead of evidence preservation.
- The validator-visible reminder can push repairs toward the smaller "safe" fragment instead of the fuller spoken line.
- On retries, a model often becomes more conservative, so repeated partial-keep wording can magnify under-capture.

Recommendation:
- Keep the non-vocal exclusion.
- Remove the partial-keep wording and replace it with a first-pass preservation rule for intelligible speech-like material, even when mixed with music-led delivery.

## Stronger exclusion language in the immediate predecessor drafts

These older 2026-04-07 drafts are not the current live wording, but they matter because they show the recent design bias and may still influence surrounding expectations/tests.

### 5) v2.1 draft explicitly tells the model to split away music-led delivery immediately

From `docs/dialogue-transcription-prompt-v2-1-draft-2026-04-07.md`:

> `- If delivery pivots from spoken dialogue into clearly sung, chant-like, rap-like, or otherwise music-led vocal delivery, split immediately at that pivot and keep only the spoken portion in dialogue_segments.`

> `- Do not use adjacent spoken context to pull a music-led vocal phrase into dialogue.`

Why this is risky:
- This is the clearest version of the over-exclusion problem.
- `split immediately` and `keep only the spoken portion` tell the model to discard borderline material early.
- That instruction is almost tailor-made to lose chant-like callouts, rhythmic threats, and promo VO that sits on the dialogue/music boundary.
- The second line removes any permission to preserve the line when nearby context strongly suggests it functions as speech.

Recommendation:
- **Do not revive this wording.** Treat it as the language to explicitly avoid.
- If any implementation or future edit drifts back toward this structure, that is likely to reintroduce line loss fast.

### 6) v2 draft contains the same early-split / spoken-only bias

From `docs/dialogue-transcription-prompt-v2-draft-2026-04-07.md`:

> `- If delivery pivots from spoken dialogue into clearly sung, chant-like, rap-like, or otherwise music-led vocal delivery, split immediately at that pivot and keep only the spoken portion in dialogue_segments.`

> `- Do not use adjacent spoken context to pull a music-led vocal phrase into dialogue.`

Why this is risky:
- Same issue as v2.1: it treats ambiguity as a reason to cut away material instead of retain it for later adjudication.

Recommendation:
- Keep this wording out of the live prompt and out of any future approval draft.

## Review docs already describe the problem correctly

### 7) The redraft plan already documented the exact risky pattern

From `.plans/2026-04-07-redraft-dialogue-prompt-to-restore-speaker-detail-and-allow-vocals-for-reconciliation.md`:

> `Top-level final artifact rule: "Include audible spoken words only. Exclude sung lyrics, chant-like vocals, rap synchronized to music, melodic refrains, and purely instrumental or otherwise non-vocal sections."`

> `Full/chunk scope rule: "If delivery pivots from spoken dialogue into clearly sung, chant-like, rap-like, or otherwise music-led vocal delivery, split immediately at that pivot and keep only the spoken portion in dialogue_segments."`

> `Full/chunk scope rule: "Do not use adjacent spoken context to pull a music-led vocal phrase into dialogue."`

> `Likely effect: borderline speech-song, shouted chant, rhythmic promo vocal, and other ambiguous hybrid material gets rejected early instead of being preserved for later reconciliation.`

Why this matters:
- This earlier audit correctly named the failure mode.
- The live prompt improved on the worst wording, but it did not fully remove the exclusion-first posture.
- The remaining live `exclude...` and `keep the ... portion` lines are softer versions of the same underlying behavior.

Recommendation:
- Finish the job: move from "less strict exclusion" to explicit first-pass preservation.

## Tests currently encode the exclusion wording

From `test/scripts/get-dialogue.test.js`:

> `ok(completionPrompts[0].includes('Exclude clearly lyric-led, melody-led, or predominantly musical vocal passages when they do not plausibly function as dialogue.'));`

> `ok(completionPrompts[0].includes('If a segment mixes spoken content with music-led vocalization, keep the intelligible dialogue-like portion that is supportable from the audio.'));`

Why this matters:
- The tests currently lock in the exact exclusion/partial-keep lines that should be reconsidered.
- If Derrick edits the prompt in the desired direction, these assertions will need to change or they will pull the implementation back toward over-cautious exclusion.

Recommendation:
- When the prompt is revised, update these assertions to protect the new preservation-first wording instead.
- Good tests should enforce: preserve intelligible speech-like vocals for later reconciliation; do not drop or trim them merely because they are music-backed or melodically delivered.

## Specific recommendations

### Remove
- `Exclude clearly lyric-led, melody-led, or predominantly musical vocal passages when they do not plausibly function as dialogue.`
- Any return of `split immediately at that pivot and keep only the spoken portion in dialogue_segments.`
- Any return of `Do not use adjacent spoken context to pull a music-led vocal phrase into dialogue.`

### Soften or invert
- `If a segment mixes spoken content with music-led vocalization, keep the intelligible dialogue-like portion that is supportable from the audio.`

Preferred directional replacement:
- preserve the full intelligible utterance when it plausibly functions as dialogue-like speech, promo VO, comms, narration, taunt, or address, even if it overlaps score or carries chant/melodic/rhythmic delivery
- lower confidence or mark ambiguity rather than trimming the line away
- let reconciliation decide whether any retained phrase should later be stripped as lyric-only material

### Keep
- `Exclude purely instrumental or non-vocal sections.`
- anti-merging / anti-bridging rules that preserve timeline boundaries
- acoustic-first speaker-separation rules

Those rules help with structural integrity and speaker attribution. They are not the likely cause of lyric-related line loss.

## Suggested high-level prompt posture

The dialogue pass should behave like this:
- If intelligible words are present and the passage could reasonably function as speech, capture it.
- If the passage is ambiguous between speech and music-vocals, capture it anyway and express uncertainty with confidence, notes, or later reconciliation.
- Only exclude material that is truly non-vocal or clearly unusable as dialogue-like speech.
- Do not ask the first-pass dialogue model to be the final judge of whether a vocal phrase is "too musical" to retain.

That posture is more aligned with Derrick’s stated goal and better matched to the observed miss pattern around late promo/challenge-pack style lines.
