# cod-test fails in report/recommendation: invalid_output (non-JSON response)

## Repro
From repo root:

```bash
node server/run-pipeline.cjs --config configs/cod-test.yaml --verbose
```

## Expected
Pipeline completes Phase 3 (Report) and writes final report artifacts.

## Actual
Pipeline fails during Phase 3 `server/scripts/report/recommendation.cjs`:

- `Recommendation generation failed after 4 attempts: invalid_output: response was not valid JSON`
- Exit code: `1`

Failover sequence (per events):
1. `openrouter/qwen/qwen3.5-397b-a17b` → `OpenRouter: No content in response`
2. `openrouter/google/gemini-3.1-pro-preview` → `invalid_output: response was not valid JSON`
3. `openrouter/z-ai/glm-4.6v` → `invalid_output: response was not valid JSON`
4. `openrouter/bytedance-seed/seed-2.0-mini` → `invalid_output: response was not valid JSON`

## Artifacts
Output dir:
- `output/cod-test/`

Run log:
- `output/_logs/cod-test-20260310-092321.log`

Raw event log (has attempt timeline + errors):
- `output/cod-test/raw/_meta/events.jsonl`

Recommendation attempt captures:
- `output/cod-test/phase3-report/raw/ai/recommendation/attempt-01/capture.json`
- `output/cod-test/phase3-report/raw/ai/recommendation/attempt-02/capture.json`
- `output/cod-test/phase3-report/raw/ai/recommendation/attempt-03/capture.json`
- `output/cod-test/phase3-report/raw/ai/recommendation/attempt-04/capture.json`

Recommendation prompt used:
- `output/cod-test/raw/ai/_prompts/1bc76fbb564a7ad25ba1b37115fa3a91069f0d3e830ceb907c47fccdb14bf1fc.json`

Phase-level error summary:
- `output/cod-test/phase3-report/raw/_meta/errors.summary.json`

## Notes
`configs/cod-test.yaml` appears to have the intended model slug for video + dialogue_stitch: `qwen/qwen3.5-397b-a17b`.
