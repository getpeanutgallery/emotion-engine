# COD test pipeline fails: OpenRouter 400 "not a valid model ID" for `qwen/qwen-3.5-397b-a17b`

## Context
Running the cod test pipeline via `configs/cod-test.yaml` fails immediately in Phase 2 (`video-chunks`) when calling OpenRouter with the configured video model `qwen/qwen-3.5-397b-a17b`.

OpenRouter returns HTTP 400:

> `qwen/qwen-3.5-397b-a17b is not a valid model ID`

Because `server/lib/ai-targets.cjs` classifies 400s as **fatal** (not retryable), the engine does **not** fail over to the remaining video targets.

## Repro
From repo root:

```bash
# env vars required (values omitted)
# - AI_API_KEY

node server/run-pipeline.cjs --config configs/cod-test.yaml --verbose
```

Run metadata (this report):
- Start: 2026-03-10T08:52:38-04:00
- End:   2026-03-10T08:52:50-04:00
- Exit:  1
- Output dir: `output/cod-test`
- Console log: `.logs/cod-test-20260310-085238.log`

## Expected
- Pipeline should proceed through Phase 2 (`video-chunks`) and complete Phase 3 reports.
- If the first configured video target is invalid/unavailable, the engine should fail over to the next configured target.

## Actual
- Phase 1 succeeds.
- Phase 2 fails on the first chunk / first target with OpenRouter 400.
- No retries/failover occur; the run aborts.

## Key artifacts
- Provider error capture (includes OpenRouter response body):
  - `output/cod-test/phase2-process/raw/ai/chunk-0000/split-00/attempt-01/capture.json`
- Phase 2 error summary:
  - `output/cod-test/phase2-process/raw/_meta/errors.summary.json`
- Full run event timeline:
  - `output/cod-test/raw/_meta/events.jsonl`

## Notes / suspected cause
- `configs/cod-test.yaml` sets `ai.video.targets[0].adapter.model` to `qwen/qwen-3.5-397b-a17b`.
- OpenRouter rejects this model id.
- Similar model strings appear in many configs and tests (grep for `qwen/qwen-3.5-397b-a17b`).

## Suggested fix / next steps
1. Update configs to a currently-valid OpenRouter model id for video analysis (or update `qwen/qwen-3.5-397b-a17b` to the correct current identifier).
2. Consider improving `server/lib/ai-targets.cjs` classification so that “invalid model ID” (OpenRouter 400) is treated as **retryable/failover-able** rather than fatal, allowing fallback targets to be attempted.
   - For example: detect error messages like `not a valid model ID` / `is not a valid model` and classify as retryable.
3. Add a lightweight preflight/validation step that warns (or fails fast with clearer messaging) when configured model ids are invalid.
