# Provider debug capture consistency (ai-providers)

## Problem
OpenRouter attaches a sanitized `err.debug` payload on errors; other providers (OpenAI/Anthropic/Gemini) don’t consistently wrap transport errors with a stable, sanitized debug object.

## Goal
Create a shared utility in `ai-providers` to attach a consistent sanitized debug payload on *transport/provider* errors across all providers.

## Notes
- Allowlist only: method, url (no creds), status, request-id-like headers, truncated response body snippet.
- Never persist auth headers / API keys / cookies.

## Acceptance criteria
- On provider error, emotion-engine raw capture can persist `error.debug` in a consistent shape regardless of provider.
