# 2026-05-12 Phase 1 → Phase 2 rerun summary

## Command

```bash
npm run validate-configs
npm run pipeline -- --config configs/cod-test-phase2-only-retest-2026-05-06.yaml --verbose
```

## Config

- `configs/cod-test-phase2-only-retest-2026-05-06.yaml`
- `asset.outputDir`: `output/cod-test-phase2-only-retest-2026-05-06-with-timestamps`
- `settings.phase1.music_vocals.timestamp_backend`: `faster_whisper`
- Backend default also remains `faster_whisper` in `server/lib/music-vocals-timestamp-backend.cjs`

## Runtime notes

- Started from the repo's current post-May-7 state without switching the music-vocals backend.
- Run started at `2026-05-12T18:07:32-04:00` and completed by `2026-05-12T18:26:11-04:00`.
- Phase 1 ran all six configured gather scripts, including `get-music-vocals-timestamps.cjs`.
- Phase 2 ran `server/scripts/process/video-chunks.cjs` and processed 29 calculated chunks, with 28 provider-facing chunks analyzed successfully.
- The terminal `0.017s` micro-chunk was skipped intentionally: `Skipping terminal provider-facing micro-chunk under 1s`.
- The observed run used the digital-twin router in record mode against cassette `cod-test-record-20260318-202023` while still completing a live canonical pipeline pass.
- Phase 2 reported `Total tokens used: 225210` and `Average per successful chunk: 8043 tokens`.
- No fatal errors occurred. Benchmarking remained disabled by config, and Phase 3 remained empty/skipped by config design.

## Output directory

- `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/output/cod-test-phase2-only-retest-2026-05-06-with-timestamps`

## Artifact verification

Verified the following QA-relevant artifacts exist in the fresh output:

### Phase 1 gather artifacts
- `output/cod-test-phase2-only-retest-2026-05-06-with-timestamps/phase1-gather-context/dialogue-data.json`
- `output/cod-test-phase2-only-retest-2026-05-06-with-timestamps/phase1-gather-context/music-data.json`
- `output/cod-test-phase2-only-retest-2026-05-06-with-timestamps/phase1-gather-context/music-vocals-data.json`
- `output/cod-test-phase2-only-retest-2026-05-06-with-timestamps/phase1-gather-context/dialogue-timestamps-data.reconciled.json`
- `output/cod-test-phase2-only-retest-2026-05-06-with-timestamps/phase1-gather-context/music-vocals-timestamps-data.reconciled.json`

### Phase 2 artifacts
- `output/cod-test-phase2-only-retest-2026-05-06-with-timestamps/phase2-process/chunk-analysis.json`
- `output/cod-test-phase2-only-retest-2026-05-06-with-timestamps/phase2-process/script-results/video-chunks.success.json`

## Contract note

This fresh run emitted the timestamp artifacts under the current reconciled filenames (`*.reconciled.json`). Repo code/docs already treat those reconciled paths as valid current-resolution surfaces alongside the older bare artifact names.
