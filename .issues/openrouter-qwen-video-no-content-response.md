# OpenRouter "No content in response" for video model (qwen)

## Problem
During Phase2 video chunk analysis (e.g. `cod-test`), OpenRouter sometimes returns an error: "No content in response" for the configured video model (historically `qwen/qwen3.5-122b-a10b`). This blocks recording a clean golden cassette.

## Why it matters
Golden runs need provider stability; intermittent provider/model failures turn golden recording into a coin flip.

## Now that captureRaw v2 is shipped
We can capture attempt-scoped artifacts + phase-level error summaries, so we should:
- inspect the failing chunk attempt folders
- examine sanitized provider debug payloads (request-id headers, status, truncated body)

## Potential fixes
- Switch to a more reliable OpenRouter model for Phase2 video.
- Add a fallback model/provider for Phase2 when a transport/provider error happens.
- Increase retry policy for this specific error classification.
- Improve provider transport debug capture (cross-provider consistency).

## Acceptance criteria
- Record a full cod-test golden with Phase2 video completing all chunks with zero fatal failures.
- Deterministic replay produces identical outputs (modulo timestamps).
