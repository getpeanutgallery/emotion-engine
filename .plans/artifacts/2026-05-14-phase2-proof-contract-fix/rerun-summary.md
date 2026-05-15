# Repaired cod-test proof rerun summary

**Date:** 2026-05-14  
**Bead:** `ee-6mwr`  
**Status:** ⚠️ Phase 2 proof artifact restored; full pipeline still exits on benchmark red

## Exact command

```bash
npm run pipeline -- --config configs/cod-test.yaml --verbose
```

## Output path

Fresh rerun output root:

- `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/output/cod-test`

Pre-rerun preserved output moved aside first so the rerun wrote a fresh output folder:

- `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/output/cod-test-pre-proof-contract-rerun-20260514-184119`

## Runtime notes

- The rerun used the canonical config at `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/configs/cod-test.yaml`.
- Phase 2 now correctly ran `server/scripts/process/video-chunks.cjs`.
- Console/runtime logs showed dotenv loading `.env`, `mode: "record"` in `_meta/events.jsonl`, and active digital-twin record-mode traces with cassette label `cod-test-record-20260318-202023`.
- The pipeline completed Phase 1, Phase 2, and Phase 3 script execution, then failed in the benchmark stage.
- `_meta/events.jsonl` recorded `run.end` with `outcome: "failed"` and `durationMs: 1052356`.

## Phase 2 artifact result

The required proof artifact **was produced at the expected proof location**:

- `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/output/cod-test/phase2-process/chunk-analysis.json`

Observed artifact facts:

- file exists: `yes`
- `chunks.length`: `28`
- `statusSummary`: `{"total":28,"successful":28,"failed":0,"failedChunkIndexes":[]}`

The old contract-mismatch failure is gone: the rerun produced `chunk-analysis.json` where benchmark/proof consumers expect it.

## Remaining blocker

The full pipeline still exited with code `1`, but the failure moved downstream from artifact-missing to benchmark-quality red:

```text
Benchmark error: 0/8 artifacts passed. 2268/3270 scoreable fields passed. Truth coverage was 3270/3477 fields.
```

Benchmark summary output:

- `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/benchmarks/fixtures/cod-test/_reports/benchmark-summary.json`

## Completion judgment

This rerun successfully completed the unblock step for the proof-lane contract repair: `phase2-process/chunk-analysis.json` is now generated in the canonical `cod-test` full-run output packet. The exact next blocker is no longer a missing Phase 2 artifact; it is the benchmark-scoring failure captured above.