# OpenRouter public video URL audit — 2026-04-01

## Scope

Research the official OpenRouter contract for passing a public video URL, then audit the current `emotion-engine` implementation to explain the observed `OpenRouter: Invalid URL` failure in the MiMo proof lane.

## Official OpenRouter contract

Official sources reviewed:

- OpenRouter Video Inputs docs: <https://openrouter.ai/docs/guides/overview/multimodal/videos>
- OpenRouter Multimodal overview: <https://openrouter.ai/docs/guides/overview/multimodal/overview>
- OpenRouter chat completions API reference: <https://openrouter.ai/docs/api/api-reference/chat/send-chat-completion-request>

### Required payload shape for a public video URL

For JSON requests sent to `POST https://openrouter.ai/api/v1/chat/completions`, OpenRouter documents video input as a `messages[*].content[*]` item with:

```json
{
  "type": "video_url",
  "video_url": {
    "url": "https://example.com/video.mp4"
  }
}
```

Important doc details:

- The multimodal overview explicitly says video inputs use `type: "video_url"`.
- The video guide explicitly says requests with video files use the `video_url` content type.
- For raw JSON requests, the nested field is `video_url.url`.
- OpenRouter supports both direct public URLs and base64 data URLs for video.
- Public URL support is provider-dependent, but OpenRouter’s documented request shape for URL-based video is still the same.

## What the repo currently does for OpenRouter video URLs

### 1) The OpenRouter adapter already serializes video attachments into the documented shape

`node_modules/ai-providers/providers/openrouter.cjs`:

- `buildRequest(...)` defaults to `POST <baseUrl>/chat/completions` at lines 72-80 and 171-179.
- For `attachment.type === 'video'`, it emits:
  - `type: 'video_url'`
  - `video_url: { url: attachment.url }`
  - at lines 115-127.

So the adapter’s JSON payload shape matches the official OpenRouter raw-request docs.

### 2) The MiMo whole-video lane already produces the right attachment object

`server/scripts/process/whole-video-mimo.cjs`:

- `toProviderAttachment(...)` returns `{ type: 'video', url, mimeType }` for URL delivery at lines 272-278.
- The provider call passes that attachment through to OpenRouter at lines 682-687.

That is the correct repo-owned precursor shape for the adapter above.

### 3) Existing request-shape proof artifacts already show the correct OpenRouter JSON

These repo artifacts prove the shape before transport:

- `.logs/2026-03-31-mimo-tranche1-request-shape-verify.json`
- `.logs/2026-03-31-cod-test-mimo-openrouter-compare-request-shape.json`

Both show:

```json
{
  "type": "video_url",
  "video_url": {
    "url": "https://gambit-games-tests.s3.us-east-1.amazonaws.com/peanut-gallery/cod.mp4"
  }
}
```

So the public-video request shape is not the bug.

## What is actually broken

The observed live failure is not a malformed `video_url` block. It is a malformed transport URL.

### Evidence from the failing capture

`output/_archives/cod-test-phase1-proof-compare-after-mimo-tranche2-openrouter-invalid-url-20260401-1218/phase1-gather-context/raw/ai/dialogue-transcription/attempt-01/capture.json`

The debug payload shows:

```json
"request": {
  "method": "POST",
  "url": "null/chat/completions",
  "model": "google/gemini-3.1-flash-lite-preview"
}
```

And the stack shows Axios throwing before any provider response exists:

- `TypeError: Invalid URL`
- from Axios request dispatch
- while executing `node_modules/ai-providers/providers/openrouter.cjs:268`

This means the failure happens before OpenRouter evaluates the multimodal body.

## Root cause in code

### 1) Runtime config resolves OpenRouter `baseUrl` to `null`

`server/lib/provider-runtime-config.cjs` line 70:

```js
const baseUrl = compactString(spec.baseUrlEnv ? env?.[spec.baseUrlEnv] : '') || spec.defaultBaseUrl || null;
```

For `openrouter`, `PROVIDER_ENV_MAP.openrouter` defines `baseUrlEnv: 'OPENROUTER_BASE_URL'`, but **does not define `defaultBaseUrl`**.

So when `OPENROUTER_BASE_URL` is unset, the resolved runtime config returns:

```js
{ baseUrl: null }
```

### 2) Call sites pass that `null` through explicitly

Example call sites:

- `server/scripts/get-context/get-dialogue.cjs` lines 2090-2095
- `server/scripts/process/whole-video-mimo.cjs` lines 682-687

They call the provider with:

```js
baseUrl: runtimeConfig.baseUrl
```

When `runtimeConfig.baseUrl` is `null`, the option is still explicitly present.

### 3) The OpenRouter adapter only falls back when `baseUrl` is `undefined`, not when it is `null`

`node_modules/ai-providers/providers/openrouter.cjs` lines 73-80:

```js
const {
  ...,
  baseUrl = DEFAULT_BASE_URL,
  ...
} = options;
```

Because JavaScript destructuring defaults do **not** replace `null`, passing `baseUrl: null` results in:

```js
url: `${baseUrl}/chat/completions`
```

which becomes:

```text
null/chat/completions
```

Axios then throws `ERR_INVALID_URL`.

## Exact mismatch

### Required transport + payload contract

OpenRouter expects both of these to be true at once:

1. Request target URL must be a valid absolute endpoint, normally:
   - `https://openrouter.ai/api/v1/chat/completions`
2. Request body must include the video part as:
   - `content[*].type = "video_url"`
   - `content[*].video_url.url = "https://..."`

### Observed repo behavior

- The **payload** side for video URL is correct.
- The **transport URL** side is wrong when `OPENROUTER_BASE_URL` is unset, because repo runtime config produces `baseUrl: null` and call sites pass that through.

So the mismatch is **not** `video_url` vs some other video field. The mismatch is:

- expected: omit `baseUrl` or provide a valid absolute URL
- actual: explicitly pass `baseUrl: null`

## Recommended source-owned fix

Fix this at the owning runtime-config seam, not by patching request payloads.

### Preferred fix

Make OpenRouter runtime config resolve to the real default base URL when no override is provided.

Concrete change:

- In `server/lib/provider-runtime-config.cjs`, add:

```js
openrouter: {
  apiKeyEnv: ['OPENROUTER_API_KEY', 'AI_API_KEY'],
  baseUrlEnv: 'OPENROUTER_BASE_URL',
  timeoutEnv: 'OPENROUTER_TIMEOUT_MS',
  defaultBaseUrl: 'https://openrouter.ai/api/v1'
}
```

Why this is the best owning fix:

- It keeps provider defaults in the runtime-config owner rather than scattering null-guards across call sites.
- It fixes both the current `get-dialogue` OpenRouter lane and the whole-video MiMo lane, because both consume the same runtime config.
- It preserves intentional override support via `OPENROUTER_BASE_URL`.

### Acceptable hardening follow-up

As a belt-and-suspenders follow-up, provider call sites may also avoid passing `baseUrl` when falsey, or the adapter could coerce `null` to its own default. But those are secondary hardening moves; the primary bug is the missing OpenRouter default in `provider-runtime-config.cjs`.

## Bottom line

- Official OpenRouter public-video URL shape: correct and already implemented.
- Current MiMo/OpenRouter `Invalid URL` failure: caused by `baseUrl: null`, not by the `video_url` payload.
- Recommended fix: give OpenRouter a default runtime base URL in `server/lib/provider-runtime-config.cjs` so the transport URL becomes `https://openrouter.ai/api/v1/chat/completions` when no env override is set.
