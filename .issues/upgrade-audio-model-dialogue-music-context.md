# Upgrade audio-capable model for dialogue/music context extraction (cod-test)

## Context
In recent `cod-test` runs, the dialogue and music extractors are using a weaker Gemini model (likely a default/demo from docs). Manual inspection of:
- `output/cod-test/phase1-gather-context/dialogue-data.json`
- `output/cod-test/phase1-gather-context/music-data.json`
shows reduced nuance/accuracy (e.g., miscounting speakers / missing music details).

Historically, these Phase 1 artifacts were more accurate (including tracking unique voices/speakers in the trailer).

## Why it matters
Phase 1 context feeds Phase 2/3 scoring and reporting. If speakers/music metadata is wrong, downstream lens analysis and summaries degrade even if the rest of the pipeline is correct.

## Proposed fix
1) Identify the best available **audio-capable** model on OpenRouter for:
   - speech/dialogue transcription + diarization-ish speaker counting
   - music description / instrumentation / mood
2) Update `configs/cod-test.yaml` (and any referenced configs) to use that model for:
   - dialogue extraction
   - music extraction
3) Record a new golden cassette and validate:
   - run `DIGITAL_TWIN_MODE=record` with new cassette id
   - replay + acceptance checklist PASS
4) Compare Phase 1 artifacts before/after (focus: speaker count, speaker changes, music cues).

## Notes / constraints
- Prefer a model that is robust to nuance over cost/speed for this specific golden config.
- Keep video chunk analysis models unchanged unless evidence suggests they’re also regressing.

## Acceptance criteria
- `dialogue-data.json` correctly reflects number of speakers/unique voices and key dialogue beats.
- `music-data.json` contains richer/accurate music segment details (instrumentation/genre/mood transitions where audible).
- Golden run still passes `docs/COD-TEST-GOLDEN-RUN-CHECKLIST.md`.
- New default cassette/manifest updated only after manual review of Phase 1 quality.
