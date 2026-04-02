# Xiaomi direct provider support plan

**Date:** 2026-03-31  
**Status:** Planning only — no code changes proposed in this note  
**Scope:** Design the official Xiaomi / MiMo provider path so Emotion Engine YAML can select `xiaomi` the same way it currently selects `openrouter`, `openai`, `anthropic`, or `gemini`.

---

## Recommendation

Implement Xiaomi as a first-class provider adapter, not as a one-off script path.

That means:

- add a new `xiaomi` adapter in the shared `ai-providers` package
- keep Emotion Engine’s existing target-chain contract (`ai.<domain>.targets[*].adapter.{name,model,params}`)
- let YAML select Xiaomi directly with `adapter.name: xiaomi`
- keep retry/failover behavior in `server/lib/ai-targets.cjs`, not duplicated inside the adapter
- prefer URL-based media delivery for Xiaomi because the MiMo feasibility memo showed that Xiaomi’s first-party API is materially better than OpenRouter for audio/video URL transport

This aligns with the MiMo feasibility memo:

- **direct Xiaomi first**, not OpenRouter-first transport
- **URL-based media staging** as the primary path for audio/video
- **no self-hosting assumptions**

---

## Why this should be an adapter-equivalent path

The repo already has the right abstraction boundary:

- Emotion Engine chooses providers through YAML target adapters
- `server/lib/ai-targets.cjs` handles target ordering, retries, and failover
- `ai-providers/ai-provider-interface.js` dynamically loads provider adapters from `providers/*.cjs`
- the current OpenRouter path is already the closest architectural template for a Xiaomi integration

So the Xiaomi work should be:

1. **new provider adapter** in `ai-providers`
2. **runtime auth/env resolution cleanup** in Emotion Engine so provider-specific keys can be used cleanly
3. **docs/config examples/tests**

Not:

- a special-case Xiaomi script
- a new side transport layer outside `ai-providers`
- a YAML escape hatch that bypasses adapter loading

---

## Proposed adapter surface

### New shared provider file

Planned future file in sibling repo:

- `../ai-providers/providers/xiaomi.cjs`

Adapter contract should match the existing provider contract:

```js
module.exports = {
  name: 'xiaomi',
  complete,
  validate,
  _private: {
    buildRequest,
    transformResponse,
    getTransportTimeoutMs,
    runRequest,
  },
};
```

### Design target

Make `xiaomi.cjs` look operationally similar to `openrouter.cjs`:

- deterministic `buildRequest(...)`
- sanitized error/debug payloads via `provider-debug.cjs`
- transport timeout resolution
- digital twin compatibility via canonical request snapshots
- response transformation to the standard `{ content, usage, providerRequest, providerResponse }` shape

### No new Emotion Engine schema needed

Emotion Engine already validates adapter selection generically via:

```yaml
ai:
  video:
    targets:
      - adapter:
          name: xiaomi
          model: mimo-v2-omni
```

Because `adapter.name` is already free-form, no config-schema expansion is needed just to recognize `xiaomi`.

---

## Auth and environment expectations

### Preferred env contract

Recommend adding Xiaomi-specific environment support while preserving the existing canonical fallback.

**Preferred lookup order for Xiaomi calls:**

1. `XIAOMI_API_KEY`
2. `AI_API_KEY`

Optional settings:

- `XIAOMI_BASE_URL` → defaults to `https://api.xiaomimimo.com/v1`
- `XIAOMI_TIMEOUT_MS` → adapter transport timeout default override

### Why not rely on `AI_API_KEY` only

Today Emotion Engine scripts mostly pass `process.env.AI_API_KEY` directly into provider calls. That works for one active provider at a time, but it is not ideal for an official multi-provider path.

For Xiaomi to feel equivalent to OpenRouter instead of “works if you manually overload the global key,” the runtime should gain a **central provider-aware auth resolver**, for example:

- `server/lib/provider-runtime-config.cjs` (new planned helper)

Proposed behavior:

```js
resolveProviderRuntimeConfig('xiaomi')
// => {
//   apiKey: process.env.XIAOMI_API_KEY || process.env.AI_API_KEY,
//   baseUrl: process.env.XIAOMI_BASE_URL,
//   timeoutMs: process.env.XIAOMI_TIMEOUT_MS,
// }
```

That same helper can also clean up the existing providers:

- `openrouter` → `OPENROUTER_API_KEY || AI_API_KEY`
- `openai` → `OPENAI_API_KEY || AI_API_KEY`
- `anthropic` → `ANTHROPIC_API_KEY || AI_API_KEY`
- `gemini` → `GEMINI_API_KEY || AI_API_KEY`

### Header style

Xiaomi’s first-party docs support both:

- `api-key: <key>`
- `Authorization: Bearer <key>`

Recommendation:

- default to **`Authorization: Bearer`** in the adapter for interface consistency with current providers
- optionally allow `adapter.params.authMode: bearer | api-key` if Xiaomi proves header-sensitive in practice
- keep `apiKey` as the provider-interface auth field; no interface-wide rename is needed for this planning step

---

## Request-shape normalization

### Base endpoint

Use Xiaomi’s OpenAI-compatible endpoint:

- `POST https://api.xiaomimimo.com/v1/chat/completions`

### Prompt contract

Match the OpenRouter adapter behavior:

- accept `prompt` as either:
  - a string
  - an OpenAI-style `messages` array
- accept `attachments` as the repo-standard attachment list
- build one canonical OpenAI-compatible request body

### Normalization rules

#### 1) Text-only

```js
{
  model,
  messages: [{ role: 'user', content: [{ type: 'text', text: prompt }] }]
}
```

If the incoming prompt is already an array of messages, pass it through with minimal normalization, same spirit as OpenRouter.

#### 2) Image attachments

Map to Xiaomi/OpenAI-compatible image parts:

```json
{
  "type": "image_url",
  "image_url": { "url": "https://... or data:image/...;base64,..." }
}
```

Rules:

- URL input stays URL input
- local file / raw base64 becomes a `data:` URL
- use the same image handling semantics the repo already uses for OpenRouter/OpenAI-compatible requests

#### 3) Audio attachments

Xiaomi’s first-party contract is the key difference from OpenRouter.

Map to:

```json
{
  "type": "input_audio",
  "input_audio": { "data": "https://... or data:audio/...;base64,..." }
}
```

Rules:

- **do not skip audio URLs**
- if the attachment is a public URL, preserve it as-is
- if the attachment is local/base64, convert to `data:{mime};base64,...`
- unlike the current OpenRouter adapter, do **not** force audio into a raw base64-only shape

This is a direct consequence of the feasibility memo’s finding that Xiaomi officially supports audio URLs and OpenRouter currently does not.

#### 4) Video attachments

Map to:

```json
{
  "type": "video_url",
  "video_url": { "url": "https://... or data:video/...;base64,..." },
  "fps": 2,
  "media_resolution": "default"
}
```

Rules:

- support URL and `data:` URL inputs
- surface Xiaomi’s documented video knobs
- resolve `fps` and `media_resolution` from `attachment` metadata first, then `adapter.params`, then Xiaomi defaults

Recommended supported adapter params:

- `fps`
- `media_resolution` (`default` | `max`)
- `temperature`
- `max_completion_tokens`
- `timeoutMs`

#### 5) Unsupported attachment types

The Xiaomi OpenAI-compatible lane in scope here should reject unsupported file/document attachments explicitly.

Recommendation:

- reject `type: 'file'` in the `xiaomi` adapter with a clear capability error
- let Emotion Engine classify that as non-retryable / capability mismatch

That keeps the provider contract honest instead of silently dropping attachments.

### Token/output option mapping

Xiaomi docs use `max_completion_tokens` in examples.

Recommendation:

- keep Emotion Engine’s normalized `adapter.params.max_tokens`
- map it in `xiaomi.cjs` to `max_completion_tokens`
- continue passing `temperature` through directly

That preserves repo-level YAML ergonomics without leaking provider-specific option names into configs.

---

## Media URL handling

### URL-first policy

Per the feasibility memo, Xiaomi direct support should be designed around **URL-first transport**, especially for audio and video.

Recommended provider behavior:

- if an attachment is already a public URL, pass it through unchanged
- do **not** download-and-reupload inside the adapter
- do **not** convert public URLs to inline base64 unless the caller already supplied inline data

### Why URL-first matters

Documented Xiaomi limits are much better for URLs than for base64 strings:

- image URL: up to 10 MB
- audio URL: up to 100 MB
- video URL: up to 300 MB
- base64 string for image/audio/video: 10 MB cap

So the adapter should treat base64 as the fallback path, not the happy path.

### Preflight expectations outside the adapter

The adapter should remain transport-focused, but the surrounding pipeline should preflight:

- URL reachability
- MIME correctness
- TTL long enough for provider fetch + retry window
- file size before submission

### Data URL behavior

If local files or raw base64 are passed into the adapter, normalize them to provider-legal `data:` URL strings for image/audio/video.

This keeps the canonical request deterministic and makes digital-twin snapshots easier to reason about.

### Debug redaction

Actual request URLs may include signed query parameters. The adapter should send the full URL to Xiaomi, but debug output should remain sanitized via the existing `provider-debug.cjs` URL redaction path.

---

## Error capture

### Reuse existing provider-debug utilities

Do not invent Xiaomi-specific error plumbing from scratch.

Use the same shared helpers already used by OpenRouter/OpenAI/Anthropic/Gemini:

- `wrapTransportError(...)`
- `attachResponseDebugAndRethrow(...)`
- `buildProviderExchange(...)`
- `createNoContentError(...)`
- shared request/response sanitization

### Expected classifications

Recommended default classification behavior:

- `400` / `422` → `invalid_request` (non-retryable)
- `401` / `403` → `auth` (non-retryable, fail-fast)
- `404` → `provider_response` unless Xiaomi documents model-not-found semantics more specifically
- `408` / transport timeout → `timeout` (retryable)
- `429` → `rate_limit` (retryable)
- `5xx` → `provider_response` (retryable)
- network errors (`ECONNRESET`, `ENOTFOUND`, `EAI_AGAIN`, etc.) → `network` (retryable)

### Xiaomi-specific useful error details to preserve

When present, preserve in sanitized debug metadata:

- provider request URL (sanitized)
- HTTP status
- Xiaomi request-id / trace-id style headers if provided
- error body snippet
- normalized request model and content types

### Capability-style failures to message clearly

Clear non-retryable messages should exist for:

- unsupported `file` attachments
- invalid `fps` / `media_resolution`
- unsupported model (for example, non-`mimo-v2-omni` multimodal usage)
- base64 payload too large
- Xiaomi rejecting a non-public / unreachable URL

The goal is to make these failures explainable in Emotion Engine raw captures and failover logs.

---

## Retries and timeouts

### Timeout precedence

Recommend matching OpenRouter’s precedence pattern:

1. `adapter.params.timeoutMs`
2. `XIAOMI_TIMEOUT_MS`
3. adapter default (recommend `120000` ms initially)

### Retry ownership

Keep retry ownership where it already belongs:

- adapter handles **one request attempt**
- `server/lib/ai-targets.cjs` handles **retry/failover policy**

Do **not** add nested Xiaomi-specific retry loops in the adapter, or the repo will get duplicated retry semantics and harder-to-read attempt accounting.

### Retryable vs non-retryable guidance

**Retryable:**

- timeout / aborted transport
- transient network failure
- `429`
- `5xx`

**Usually non-retryable:**

- invalid auth
- malformed multimodal request
- bad/unreachable URL returned as request validation failure
- unsupported attachment type
- base64 payload too large
- invalid `fps` or `media_resolution`

### Why this split matters for Xiaomi

A major Xiaomi-direct advantage is URL-based media fetch. But URL-based failures are often **configuration/input failures**, not transient provider failures. Those should fail clearly and move to failover only if the next target/provider can realistically succeed.

---

## Configuration examples

### Minimal direct Xiaomi video target

```yaml
ai:
  video:
    retry:
      maxAttempts: 2
      backoffMs: 750
    targets:
      - adapter:
          name: xiaomi
          model: mimo-v2-omni
          params:
            temperature: 0.2
            max_tokens: 1500
            fps: 2
            media_resolution: default
            timeoutMs: 120000
```

### Dialogue lane using Xiaomi directly

```yaml
ai:
  dialogue:
    targets:
      - adapter:
          name: xiaomi
          model: mimo-v2-omni
          params:
            temperature: 0
            max_tokens: 1200
            timeoutMs: 90000
```

### Mixed fallback chain: Xiaomi first, OpenRouter second

```yaml
ai:
  video:
    retry:
      maxAttempts: 2
      backoffMs: 1000
    targets:
      - adapter:
          name: xiaomi
          model: mimo-v2-omni
          params:
            fps: 2
            media_resolution: default
            max_tokens: 1500
      - adapter:
          name: openrouter
          model: xiaomi/mimo-v2-omni
          params:
            max_tokens: 1500
            thinking:
              level: low
```

### Recovery lane example (if Xiaomi is desired there too)

```yaml
recovery:
  ai:
    enabled: true
    adapter: xiaomi
    model: mimo-v2-omni
    temperature: 0
    timeoutMs: 45000
```

Recommendation: recovery remains optional. For text-only repair flows, OpenRouter/OpenAI may still be the better default until Xiaomi-direct behavior is benchmarked.

---

## Planned implementation impact

### Emotion Engine repo (future implementation, not done here)

Recommended future touch points:

- `server/lib/ai-targets.cjs`
  - no schema change required
  - optionally consume a new provider-runtime resolver instead of assuming `AI_API_KEY`
- `server/lib/ai-recovery-lane.cjs`
  - switch to provider-aware runtime auth lookup
- `server/scripts/get-context/get-dialogue.cjs`
- `server/scripts/get-context/get-music.cjs`
- `server/scripts/process/video-chunks.cjs`
- `server/scripts/report/recommendation.cjs`
  - replace direct `process.env.AI_API_KEY` usage with centralized provider-aware resolution
- `.env.example`
  - document `XIAOMI_API_KEY`, `XIAOMI_BASE_URL`, `XIAOMI_TIMEOUT_MS`
- `docs/CONFIG-GUIDE.md`
  - add Xiaomi adapter examples and env notes

### ai-providers repo (future implementation, not done here)

Recommended future touch points:

- `providers/xiaomi.cjs` (new)
- `README.md`
- `test/` additions for:
  - provider discovery / loadability
  - request-shape normalization for image/audio/video URL + base64 cases
  - timeout precedence
  - sanitized error/debug payloads
  - response transformation / no-content handling

---

## Testing plan for the future implementation

### Unit coverage

1. `xiaomi` appears in provider discovery and loads successfully
2. text-only request normalization matches expected body
3. image URL request normalization
4. image base64/data-URL normalization
5. audio URL normalization (important difference vs OpenRouter)
6. audio base64/data-URL normalization
7. video URL normalization with `fps` and `media_resolution`
8. video base64/data-URL normalization
9. file/document attachment rejection produces capability-style failure
10. timeout resolution precedence works
11. transport errors are wrapped and sanitized
12. response parsing returns standard `{ content, usage }`
13. empty content creates structured no-content failure

### Emotion Engine integration coverage

1. `adapter.name: xiaomi` works in `ai.<domain>.targets`
2. provider-specific key lookup prefers `XIAOMI_API_KEY`
3. fallback to `AI_API_KEY` still works
4. retry/failover still runs through `ai-targets`
5. raw capture contains sanitized provider metadata for Xiaomi failures
6. replay/record remains deterministic for digital-twin snapshots

---

## Recommended implementation order

1. **Add `xiaomi.cjs` in `ai-providers`** using `openrouter.cjs` as the closest template
2. **Add provider-aware runtime env resolution** in Emotion Engine so Xiaomi can use `XIAOMI_API_KEY` cleanly
3. **Document Xiaomi env + YAML examples** in `.env.example` and `docs/CONFIG-GUIDE.md`
4. **Add unit coverage** for request normalization, errors, and timeout behavior
5. **Add one or two Emotion Engine fixture configs** that demonstrate direct Xiaomi selection

This keeps the work provider-native and testable.

---

## Bottom line

The clean design is:

- **new provider:** `xiaomi`
- **same adapter system:** no special Xiaomi side-channel
- **URL-first media handling:** especially for audio/video
- **shared retry/failover logic:** stay in `ai-targets`
- **shared debug/error plumbing:** stay in `provider-debug.cjs`
- **provider-aware env resolution:** prefer `XIAOMI_API_KEY`, fall back to `AI_API_KEY`

That gives Emotion Engine an official Xiaomi-direct path equivalent to today’s OpenRouter path while preserving the architecture recommended by the MiMo feasibility memo.
