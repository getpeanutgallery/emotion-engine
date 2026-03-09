# Fix chunk-analysis raw captures writing `rawResponse: null` with `debug.captureRaw: true`

## Context
Phase 2 chunk analysis writes per-chunk raw artifacts under `phase2-process/raw/ai/*.json` when `debug.captureRaw` is enabled. These files are expected to preserve the provider's raw response payload for debugging, replay fidelity, and schema-failure diagnosis.

## Symptoms (with example paths)
With `configs/cod-test.yaml` (`debug.captureRaw: true`), chunk raw artifacts show `rawResponse: null` even for successful calls:

- `output/cod-test/phase2-process/raw/ai/chunk-1.json`
- `output/cod-test/phase2-process/raw/ai/chunk-10.json`
- `output/cod-test/phase2-process/raw/ai/chunk-26.json`

Observed pattern in those files:

```json
{
  "prompt": "...",
  "rawResponse": null,
  "parsed": { "summary": "...", "emotions": { "joy": { "score": 7 } } }
}
```

## Root cause hypothesis
`video-chunks.cjs` writes raw payload from:

- `toolResult.rawResponse || toolResult.response || null`

However, `emotion-lenses-tool.cjs` currently returns only `{ prompt, state, usage }` and does not include provider raw output fields (`rawResponse` / `response`). As a result, the raw writer always falls back to `null` on non-error paths.

## Proposed fix
1. Update `tools/emotion-lenses-tool.cjs` to include raw provider output in the return object (at minimum `rawResponse`, optionally normalized `response`).
2. Standardize a cross-tool contract for raw capture fields (e.g., `rawResponse`, `providerResponseMeta`) so all scripts can persist consistent artifacts.
3. Add/update tests for phase2 raw artifact generation to assert non-null raw payload when capture is enabled and provider call succeeds.
4. Keep error-path capture behavior explicit (e.g., include structured error payload when provider fails before content parse).

## Acceptance criteria
- Running pipeline with `debug.captureRaw: true` produces `phase2-process/raw/ai/chunk-*.json` files where successful chunks include non-null raw provider payload.
- `rawResponse` (or agreed replacement field) is documented and consistent across tool outputs.
- Tests fail if successful chunk raw artifacts regress to `rawResponse: null`.
- Existing parse/error handling still works (including retries and invalid output paths).
