# OpenRouter "No content in response" for video model (qwen)

## Problem
During Phase2 video chunk analysis (e.g. `cod-test`), OpenRouter sometimes returns an error: "No content in response" for the configured video model (historically `qwen/qwen3.5-122b-a10b`). This blocks recording a clean golden cassette.

## Why it matters
Golden runs need provider stability; intermittent provider/model failures turn golden recording into a coin flip.

## Now that captureRaw v2 is shipped
We can capture attempt-scoped artifacts + phase-level error summaries, so we should:
- inspect the failing chunk attempt folders
- examine sanitized provider debug payloads (request-id headers, status, truncated body)

## Mitigation (shipped)
We mitigated this by adding an ordered failover chain to the Phase2 video config (`configs/cod-test.yaml` → `ai.video.targets`).

- Best-first target: `google/gemini-2.5-flash` on OpenRouter (more reliable content responses)
- Fallback targets: Qwen variants (`qwen/qwen-3.5-397b-a17b` → `qwen/qwen3.5-122b-a10b`)

This defers a deeper root-cause fix (provider/model intermittency) in favor of making golden recording resilient.

## Potential deeper fixes (deferred)
- Investigate why OpenRouter intermittently returns "No content in response" for specific video models.
- Improve provider transport debug capture (cross-provider consistency).
- Add error-classification specific retry tuning (beyond generic retryable runtime errors).

## Acceptance criteria
- Record a full cod-test golden with Phase2 video completing all chunks with zero fatal failures.
- Deterministic replay produces identical outputs (modulo timestamps).
