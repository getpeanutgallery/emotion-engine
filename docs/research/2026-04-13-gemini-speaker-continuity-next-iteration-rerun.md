# Gemini Speaker-Continuity Next Iteration Rerun

**Date:** 2026-04-13  
**Bead:** `ee-p9he`  
**Config:** `configs/cod-dialogue-compare-gemini-3.1-pro-preview.yaml`

## Scope

Continue the Gemini dialogue-only prompt-iteration lane against the original COD video, preserving the existing continuity-by-default intent while tightening one remaining ambiguity:

- keep speaker continuity by default,
- require at least two stable acoustic contradictions before minting a new `speaker_id`,
- explicitly prevent re-evaluating identity from scratch on every short line,
- and require contradiction to persist beyond a single fragile moment before splitting.

## Prompt iteration applied

Updated `server/scripts/get-context/get-dialogue.cjs` in three places:

- `buildStructuredSpeakerHandoff`
- `buildTranscriptionPrompt`
- `buildChunkTranscriptionPrompt`

### What changed

Added two continuity-hardening reminders on top of the already-approved wording:

1. **Do not re-evaluate identity from scratch on every short line.**
   - Nearby lines should stay on the same `speaker_id` by default until contradictory acoustic evidence persists.

2. **A contradiction must persist beyond a single fragile moment.**
   - Do not split from one short phrase unless the acoustic break is exceptionally explicit.

This kept the prior JSON-contract / validator discipline unchanged.

## Run command

```bash
npm run pipeline -- --config configs/cod-dialogue-compare-gemini-3.1-pro-preview.yaml --verbose
```

## Primary artifacts

- Log: `.logs/20260413-1500-cod-dialogue-compare-gemini-3.1-pro-preview-ee-p9he.log`
- Dialogue artifact: `output/cod-dialogue-compare-gemini-3.1-pro-preview/phase1-gather-context/dialogue-data.json`
- Script success envelope: `output/cod-dialogue-compare-gemini-3.1-pro-preview/phase1-gather-context/script-results/get-dialogue.success.json`
- Phase error summary: `output/cod-dialogue-compare-gemini-3.1-pro-preview/phase1-gather-context/raw/_meta/errors.summary.json`

## Fresh run outcome

### Dialogue artifact validity / usability

`get-dialogue` itself **succeeded** on attempt 1 and emitted a valid dialogue artifact plus success envelope.

- `script-results/get-dialogue.success.json` status: `success`
- phase error summary: `outcome: success`, `totalErrors: 0`

The top-level pipeline still ends in the already-known benchmark/config mismatch:

- `Produced artifact missing for musicData: .../phase1-gather-context/music-data.json`

That failure happens **after** dialogue extraction and does **not** invalidate the fresh dialogue artifact.

### Continuity metrics (fresh run)

Fresh rerun dialogue snapshot:

- Dialogue segments: **32**
- Distinct speaker IDs: **15**
- Singleton speaker IDs: **9**
- Speaker switches: **18**
- Adjacent same-speaker pairs: **13**
- Analysis mode: `whole_asset`
- Dialogue coverage window reported by artifact: **0.6s -> 76.5s** (`duration: 75.9s`, `complete: false`)

Truth snapshot for context:

- Truth dialogue segments: **20**
- Truth distinct speaker IDs: **13**
- Truth singleton speaker IDs: **9**

## Notable continuity behavior

### Improvements or preserved behavior

- The long `Master` / lyric block remains consolidated under **`spk_013`**, so that section is still not fragmenting into many tiny speaker buckets.
- The dialogue artifact remained structurally valid and usable; no malformed JSON / validator regression was introduced.

### Notable splits

The new wording did **not** produce a net continuity gain versus the prior approved-doc rerun family. Fresh fragmentation still shows up in several places:

- Truth opening continuity is still split:
  - `"They want you afraid."` / `"Fear makes you easier to control."` -> `spk_001`
  - `"It's time to wake up."` -> `spk_002`
  - In truth, those belong to the same opening speaker bucket.
- Truth `spk_001` remains fragmented across multiple model speakers:
  - `spk_001`, `spk_002`, and `spk_005`
- Truth `spk_006` remains fragmented across:
  - `spk_006` (`"He refuses to let me go."`)
  - `spk_008` (`"A lot of people counting on us for answers."`)
  - `spk_011` (`"No more games. This ends now."`)
- Radio/comms lines are still split into separate singleton IDs:
  - `spk_009` = `"Spectre One reporting."`
  - `spk_010` = `"Need a sitrep."`

### Notable merges / cross-speaker bleed

Several cross-truth merges still remain:

- **`spk_003`** absorbs lines that truth separates:
  - `"Your streets shall once again run red ..."`
  - `"So eager to leave the dream."`
  - `"Killing a man is a hell of a lot easier than killing an idea."`
- **`spk_005`** spans:
  - `"Menendez is a terrorist."`
  - `"We're bringing peace and security to the world."`
  - `"You were never cut out to be a Mason."`
  - Those do not belong to one truth speaker bucket.
- **`spk_013`** remains a very large merged bucket (11 segments) covering repeated `Master` lines plus the lyric block and the later `"Obey your master."`

## Overall verdict

This next prompt wording iteration was safe from a contract/validity perspective, but it **did not improve continuity metrics** in the fresh rerun.

Fresh result landed at:

- **32 segments**
- **15 distinct speakers**
- **9 singletons**

So the lane remains usable, but the dominant residual problem is still **speaker-ID instability with a mix of over-fragmentation and cross-speaker merging**. The added “do not re-evaluate from scratch” / “contradiction must persist” wording did not materially move Gemini closer to the truth distribution on this original-video dialogue lane.
