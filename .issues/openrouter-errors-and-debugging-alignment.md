# Align OpenRouter error + debugging capture with official guide (preserve unified adapter debug shape)

## Official reference
- OpenRouter docs: **Errors and Debugging**
  - https://openrouter.ai/docs/api/reference/errors-and-debugging.md

## Goal
Ensure our OpenRouter (and other adapter) error + debug capture:
- matches OpenRouter’s documented error/debug behaviors,
- preserves a **single, unified `error.debug` shape** across adapters (openrouter/openai/anthropic/gemini),
- and is **fully persisted** into emotion-engine artifacts (`raw/ai/**/capture.json`, `raw/_meta/events.jsonl`, `errors.summary.json`).

## What OpenRouter documents (key fields + best practices)

### 1) Standard (pre-stream / request) error response shape
OpenRouter returns JSON shaped like:

```ts
type ErrorResponse = {
  error: {
    code: number;        // usually matches HTTP status
    message: string;
    metadata?: Record<string, unknown>;
  };
};
```

Notes:
- The **HTTP status** will generally match `error.code` when the request is invalid, unauthorized, out of credits, etc.
- If the model *started* processing, OpenRouter may still return **HTTP 200**, and surface errors in the **body** or **stream events**.

### 2) Important HTTP status codes
Documented request-level statuses include:
- 400 bad request
- 401 unauthorized
- 402 payment required / insufficient credits
- 403 moderation flagged
- 408 timeout
- 429 rate limited
- 502 upstream/provider error
- 503 no available provider meeting routing requirements

### 3) Error metadata shapes (when present)
Moderation errors:

```ts
type ModerationErrorMetadata = {
  reasons: string[];
  flagged_input: string;   // truncated to ~100 chars
  provider_name: string;
  model_slug: string;
};
```

Provider errors:

```ts
type ProviderErrorMetadata = {
  provider_name: string;
  raw: unknown;            // raw upstream error object
};
```

### 4) “No content generated” guidance
OpenRouter explicitly calls out occasional **no-content** responses (cold start / scaling). Recommended handling:
- implement a simple **retry** mechanism
- optionally try a different provider/model
- be aware you may still be charged upstream

### 5) Streaming: mid-stream errors are delivered as SSE chunks (HTTP stays 200)
When `stream: true`, errors after tokens begin are delivered as an SSE `data:` event with **top-level** `error` plus a terminating choice:

```ts
type MidStreamError = {
  id: string;
  object: 'chat.completion.chunk';
  created: number;
  model: string;
  provider: string;
  error: { code: string | number; message: string };
  choices: [{
    index: 0;
    delta: { content: '' };
    finish_reason: 'error';
    native_finish_reason?: string;
  }];
};
```

### 6) Debug option: `debug.echo_upstream_body` (streaming chat completions only)
- Request option:

```ts
debug: { echo_upstream_body: true }
```

- Only works for **streaming** chat completions (`stream: true`).
- The response includes an initial chunk with `debug.echo_upstream_body` containing the transformed upstream provider payload.
- **Not for production**; can contain sensitive request material (OpenRouter notes best-effort redaction).

## Our current behavior (where we capture errors + debug)

### A) ai-providers: OpenRouter adapter debug (current)
Location:
- `node_modules/ai-providers/providers/openrouter.cjs`

Current behavior:
- Wraps transport errors and attaches a sanitized debug payload on `err.debug`:
  - `debug.provider = 'openrouter'`
  - `debug.request`: method/url/model + derived `contentTypes` + safe headers
  - `debug.response`: `status`, request-id-like headers subset, and a **redacted + truncated** `body` snippet
- Throws `OpenRouterNoContentError` when a response has no `choices[0].message.content`, and attaches the same debug payload.

### B) Emotion-engine raw capture: attempt-level `capture.json`
Locations (pattern):
- `output/<run>/<phase>/raw/ai/**/attempt-XX/capture.json`
- Writers in scripts:
  - `server/scripts/process/video-chunks.cjs`
  - `server/scripts/get-context/get-dialogue.cjs`
  - `server/scripts/get-context/get-music.cjs`
  - `server/scripts/report/recommendation.cjs`

Current error/debug fields written on failures (example from `video-chunks.cjs`):
- `error`: message (or adapter-provided invalidReason)
- `errorName`, `errorCode`
- `errorStatus`: **currently** `error.response?.status || null`
- `errorDebug`: sanitized `error.debug` (if present)
- `errorResponse`: sanitized `error.response?.data` (if present)

### C) Run/phase meta: errors + events
- `output/<run>/raw/_meta/events.jsonl` (run-level event timeline)
- `output/<run>/<phase>/raw/_meta/errors.jsonl` + `errors.summary.json` (phase-level)

Current behavior:
- `events.jsonl` includes `attempt.end` with `error: error.message` but not status/request ids.
- `errors.summary.json` is primarily counts + fatal error info (stack/message), but does not normalize provider/debug metadata.

### D) Retry/failover classification
- `server/lib/ai-targets.cjs`

Important detail:
- `getErrorStatus(error)` checks:
  - `error.response.status`
  - `error.debug.response.status`
  - `error.status`

So we already *classify* based on `error.debug.response.status` (useful for OpenRouter wrapper errors), but we do **not** consistently **persist** that status into raw captures.

## Gap analysis (vs OpenRouter docs + our observability needs)

### 1) Status/body often missing in `capture.json` for wrapped OpenRouter errors
Because the OpenRouter adapter wraps axios errors into a new `Error`, the thrown error often has:
- `error.debug.response.status` (present)
- but **no** `error.response.status` (missing)

Our raw capture currently records:
- `errorStatus = error.response.status` → often `null`
- `errorResponse = error.response.data` → often `null`

Result: the most important triage fields (HTTP status + provider error payload) are present only as a **string snippet** inside `errorDebug.response.body`.

### 2) Missing first-class request correlation identifiers
OpenRouter recommends using returned identifiers for debugging; our adapter already retains request-id-like headers in `debug.response.headers`, but we:
- don’t extract/persist a first-class `requestId` in:
  - `capture.json`
  - `events.jsonl`
  - `errors.summary.json`

### 3) No normalized parsing of OpenRouter `ErrorResponse`
We do not currently parse `{ error: { code, message, metadata } }` into structured fields.
- Moderation metadata (`reasons`, `flagged_input`, …) is not preserved as structured fields.
- Provider error metadata (`provider_name`, `raw`) is not preserved as structured fields.

### 4) “HTTP 200 but error in body/choices” isn’t explicitly detected
Docs note that if processing starts, OpenRouter can return HTTP 200 and surface errors in body or stream.
- Our current OpenRouter adapter treats “no content” as `OpenRouterNoContentError`, but does not explicitly detect:
  - `data.error` at top-level
  - `choices[0].finish_reason === 'error'`
  - other error-in-body patterns

### 5) Mid-stream SSE errors + OpenRouter debug echo are unsupported / unhandled
We currently use non-streaming chat completions.
If we later switch to streaming:
- we need explicit parsing for **mid-stream error chunks** (finish_reason: error)
- we need an opt-in pathway for `debug.echo_upstream_body` (dev-only) with careful redaction + persistence.

### 6) Unified adapter debug shape is inconsistent across providers
OpenRouter has a nice sanitized `error.debug` payload. OpenAI/Anthropic/Gemini providers currently rely on raw axios errors.
This makes downstream capture and classification brittle, and can accidentally retain unsafe/huge structures.

## Proposed improvements (keep a unified error/debug schema)

### A) Define/confirm a unified `error.debug` contract (all adapters)
Target shape (compatible with existing OpenRouter debug payload):

```ts
type UnifiedAdapterDebug = {
  provider: 'openrouter' | 'openai' | 'anthropic' | 'gemini' | string;
  request?: {
    method?: string;
    url?: string;
    model?: string;
    contentTypes?: string[];
    headers?: Record<string, string>; // safe subset, already redacted
  };
  response?: {
    status?: number;
    headers?: Record<string, string>; // request-id-like subset
    body?: string;                    // redacted + truncated snippet
  };
  // optional: structured provider error parsing (additive)
  providerError?: {
    httpStatus?: number;
    code?: string | number;
    message?: string;
    metadata?: unknown;
  };
};
```

Principles:
- **Additive only**: do not rename/remove existing OpenRouter fields.
- Keep response body as a **string snippet**, but also add structured `providerError` when safe.

### B) Fix raw capture to persist status/body reliably (use debug fallback)
In every script raw capture writer, set:
- `errorStatus`: use the same logic as `getErrorStatus()` (response.status → debug.response.status → status)
- `errorResponse`: if `error.response.data` exists, keep it; otherwise, (optional) attempt to JSON-parse `error.debug.response.body` when it looks like JSON and store a structured subset.
- Add `errorRequestId`: extract from `error.debug.response.headers` (first value among keys like `x-request-id`, `request-id`, `trace-id`, `cf-ray`, `openrouter-request-id`, etc.).
- Add `errorClassification`: persist `error.aiTargets.classification` when present.

This keeps our raw artifacts usable even when providers wrap errors.

### C) Parse OpenRouter ErrorResponse into structured fields (adapter-side)
In `ai-providers/providers/openrouter.cjs`:
- When `axiosError.response?.data` matches `{ error: { code, message, metadata } }`, attach:
  - `debug.providerError = { httpStatus: response.status, code, message, metadata }`
- Optionally set `err.code` and/or `err.status` (but keep the unified debug as the primary source).

Also detect “HTTP 200 with error field” cases:
- If `axiosResponse.data?.error` exists, throw a typed error (e.g. `OpenRouterBodyError`) and attach `providerError`.
- If `choices[0].finish_reason === 'error'`, treat as error and attach whatever body metadata exists.

### D) Bring OpenAI/Anthropic/Gemini adapters up to the same debug standard
Implement the same sanitized debug attachment pattern used by OpenRouter:
- capture safe request meta
- capture response status + request-id-like headers + body snippet
- avoid leaking Authorization / API keys

This allows emotion-engine capture to be uniform across providers.

### E) Events + summaries: include correlation + status
- Extend `attempt.end` event payloads in `raw/_meta/events.jsonl` to include:
  - `errorStatus`
  - `errorRequestId`
  - `adapter` (name/model) and `classification` (from `aiTargets`) when present

(Keep `errors.summary.json` minimal, but ensure it can point to example captures via paths if we add that later.)

## Acceptance criteria

### Observability / artifacts
- [ ] For an OpenRouter non-2xx error, the attempt `capture.json` contains:
  - [ ] `errorStatus` (non-null)
  - [ ] `errorDebug.response.status` (non-null)
  - [ ] `errorRequestId` when present in headers
  - [ ] a structured representation of `{ error: { code, message, metadata } }` available either in `errorResponse` or `errorDebug.providerError`
- [ ] For an OpenRouter `OpenRouterNoContentError`, the attempt `capture.json` contains:
  - [ ] `errorName === 'OpenRouterNoContentError'`
  - [ ] `errorDebug` with request + response metadata

### Cross-provider consistency
- [ ] OpenAI/Anthropic/Gemini adapters attach an `error.debug` payload compatible with the unified shape.
- [ ] Emotion-engine raw capture writers do not rely solely on `error.response.*` for status/body.

### Safety
- [ ] Debug payloads and raw captures redact secrets (Authorization, API keys, data URLs) and truncate large bodies.
- [ ] Any opt-in OpenRouter `debug.echo_upstream_body` support is guarded behind an explicit config flag and is off by default.

### Tests / regression
- [ ] Add/update tests (or repro scripts) that assert the above fields exist for at least one OpenRouter error case (e.g., 404/400 cassette).
- [ ] Add/update tests for one non-OpenRouter provider to confirm unified debug attachment.
