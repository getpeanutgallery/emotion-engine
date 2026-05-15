# Fresh full Phase 2 proof rerun summary

**Date:** 2026-05-14  
**Bead:** `ee-odxn`  
**Status:** ❌ Did not complete cleanly

## Exact command

```bash
npm run pipeline -- --config configs/cod-test.yaml --verbose
```

## Pre-run validation

```bash
npm run validate-configs
npm run pipeline -- --config configs/cod-test.yaml --dry-run --verbose
```

Both validation commands passed.

## Output path

Fresh rerun output root:

- `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/output/cod-test`

Pre-rerun preserved output moved aside first so the rerun wrote a fresh output folder:

- `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/output/cod-test-pre-fresh-proof-rerun-20260514-131540`

## Runtime notes

- The canonical full-run config in current repo state is `configs/cod-test.yaml`.
- Current canonical Phase 2 config path is:
  - `process:` → `server/scripts/process/whole-video-mimo.cjs`
- The rerun created a fresh `output/cod-test` folder and completed Phase 1, Phase 2, and Phase 3 script execution.
- Phase 2 wrote:
  - `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/output/cod-test/phase2-process/whole-video-analysis.json`
- The rerun did **not** write:
  - `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/output/cod-test/phase2-process/chunk-analysis.json`
- The run then failed during the benchmark stage because the benchmark expects `chunkAnalysis` at `phase2-process/chunk-analysis.json`.
- `_meta/events.jsonl` recorded `run.end` with `outcome:"failed"` and duration `419053ms`.
- Console/runtime logs showed active digital-twin record-mode transport traces during the run, including cassette label `cod-test-record-20260318-202023`.

## Exact failure

```text
Produced artifact missing for chunkAnalysis: /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/output/cod-test/phase2-process/chunk-analysis.json
```

## Fresh artifacts produced before failure

- `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/output/cod-test/phase1-gather-context/dialogue-data.json`
- `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/output/cod-test/phase1-gather-context/music-data.json`
- `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/output/cod-test/phase1-gather-context/music-vocals-data.json`
- `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/output/cod-test/phase2-process/whole-video-analysis.json`
- `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/output/cod-test/phase3-report/metrics/metrics.json`
- `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/output/cod-test/phase3-report/recommendation/recommendation.json`
- `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/output/cod-test/phase3-report/summary/FINAL-REPORT.md`
- `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/output/cod-test/_meta/events.jsonl`

## Completion judgment

The fresh rerun was executed honestly against the current post-continuity / post-guardrail repo state, but it did **not** complete cleanly. The blocker was not a provider/runtime crash inside Phase 2; it was a benchmark-stage contract mismatch between the current canonical Phase 2 output artifact (`whole-video-analysis.json`) and the benchmark expectation for `chunk-analysis.json`.
