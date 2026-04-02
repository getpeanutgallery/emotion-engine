# MiMo-V2-Omni feasibility memo for emotion-engine

**Date:** 2026-03-31  
**Scope:** Research only. No product code changes.  
**Question:** Is `xiaomi/mimo-v2-omni` a practical side-path for emotion-engine multimodal inference, and if so, what transport strategy should we use?

---

## Executive recommendation

Short version: **yes, a narrow prototype looks justified, but it should be designed around direct Xiaomi API access first, not OpenRouter-first transport.**

Why:

- MiMo-V2-Omni is **confirmed** to be a true multimodal model with `text + image + audio + video -> text` support.
- Xiaomi’s first-party API docs explicitly support **public URLs** for **image, audio, and video** inputs, with much larger limits for URL delivery than for Base64 delivery.
- OpenRouter’s generic multimodal docs support mixed-modality requests, but OpenRouter’s current audio docs explicitly say **audio input must be base64-encoded** and **audio URLs are not supported** there.
- For emotion-engine, that makes **OpenRouter materially worse** for real-world audio/video transport, because Base64 inflates payload size and appears likely to collide with Xiaomi’s documented **10 MB Base64-string cap** for non-URL media delivery.
- MiMo-V2-Omni itself does **not appear to be publicly released as self-hostable weights** right now. Xiaomi has open-sourced other MiMo-family models under Apache-2.0, but not this one.

Recommended architecture for prototyping:

1. **Primary path:** direct Xiaomi API (`api.xiaomimimo.com`) using **presigned/object-storage URLs** for media.
2. **Fallback/secondary experiment:** OpenRouter only if we can stay within its supported request shape and keep payloads small enough, especially for audio.
3. **Do not plan around self-hosting MiMo-V2-Omni** unless Xiaomi later publishes the actual Omni weights and serving guidance.

---

## Confirmed facts

### 1) MiMo-V2-Omni can consume multimodal inputs and is marketed as a unified omni model

Confirmed from Xiaomi’s model page:

- MiMo-V2-Omni is described as **“One model. Every modality.”**
- Xiaomi states the model **“sees, hears, and reads simultaneously.”**
- Xiaomi also says it supports **“native audio-video joint input”** and can handle **over 10 hours of continuous audio understanding**.

Confirmed from OpenRouter model metadata:

- `xiaomi/mimo-v2-omni` is listed with architecture modality **`text+image+audio+video->text`**.
- Input modalities are listed as `text`, `audio`, `image`, and `video`.
- Context length is listed as **262,144** tokens.

Implication: the model itself is clearly intended for combined multimodal understanding, not just separate single-modality modes.

### 2) OpenRouter supports mixed-modality requests in one call

OpenRouter’s multimodal overview explicitly says:

- all multimodal inputs use `/api/v1/chat/completions`
- content types are:
  - `image_url`
  - `file` (PDF)
  - `input_audio`
  - `video_url`
- **“You can combine multiple modalities in a single request”**
- FAQ: **“Yes! You can send text, images, PDFs, audio, and video in the same request. The model will process all inputs together.”**

So on the OpenRouter side, **one-pass combined audio + visual requests are confirmed at the API-contract level**.

### 3) Xiaomi first-party API exposes exact multimodal request shapes for MiMo-V2-Omni

From Xiaomi’s OpenAI-compatible API docs:

- endpoint: `https://api.xiaomimimo.com/v1/chat/completions`
- auth via either `api-key: ...` or `Authorization: Bearer ...`
- within user-message `content`, Xiaomi documents support for:
  - `text`
  - `image_url.image_url.url`
  - `input_audio.input_audio.data`
  - `video_url.video_url.url`
  - optional video controls: `fps` and `media_resolution`
- Xiaomi’s schema note says that **currently only `mimo-v2-omni` supports image, audio, or video input** in that content-array contract.

Xiaomi also exposes an Anthropic-compatible endpoint pattern in the modality docs:

- `https://api.xiaomimimo.com/anthropic/v1/messages`

That gives us first-party provider access without needing OpenRouter.

### 4) Xiaomi first-party API explicitly allows remote hosted URLs for all three relevant media types

Confirmed in Xiaomi docs:

- **Images:** public image URL supported
- **Audio:** public audio URL supported
- **Video:** public video URL supported

Exact first-party limits documented by Xiaomi:

- **Image URL input:** single image file **<= 10 MB**
- **Image Base64 input:** converted Base64 string **<= 10 MB**
- **Audio URL input:** single audio file **<= 100 MB**
- **Audio Base64 input:** converted Base64 string **<= 10 MB**
- **Video URL input:** single video file **<= 300 MB**
- **Video Base64 input:** converted Base64 string **<= 10 MB**

This is the clearest transport fact uncovered in the research.

### 5) OpenRouter URL support is modality-specific, not uniform

Confirmed in OpenRouter docs:

- **Images:** direct URLs supported
- **Audio:** **direct URLs are not supported**; docs say audio inputs **must be base64-encoded**
- **Video:** URLs are supported **provider-specifically**; OpenRouter says it only forwards video URLs to providers that explicitly support them
- OpenRouter also recommends URLs for large files where available because URLs reduce request payload size

This matters a lot for emotion-engine: OpenRouter’s generic multimodal API is capable, but its current audio transport contract is materially tighter than Xiaomi first-party.

### 6) OpenRouter does not document a blanket 10 MB media cap in the docs reviewed

I did **not** find an official OpenRouter doc stating a blanket **10 MB media limit** across all multimodal inputs.

What OpenRouter docs do clearly say instead:

- URLs are preferable for large public files because they reduce request payload size.
- Audio input is Base64-only on OpenRouter.
- Video URL support is provider-specific.

So the strongest confirmed statement is:

- **Xiaomi first-party documents a 10 MB cap for Base64 strings for image/audio/video, and larger limits for URL delivery.**
- **OpenRouter docs do not, in the sources reviewed, publish a universal 10 MB cap of their own.**

### 7) Direct provider access exists and can avoid at least some OpenRouter transport constraints

Confirmed:

- Xiaomi provides first-party access at `platform.xiaomimimo.com` / `api.xiaomimimo.com`.
- The first-party API is OpenAI-compatible and also exposes Anthropic-style message endpoints.
- First-party docs explicitly support remote URLs for image/audio/video.

This means a direct Xiaomi integration can avoid OpenRouter’s documented **audio-URL prohibition** and take advantage of Xiaomi’s larger URL-based limits.

### 8) MiMo family has open-source components, but MiMo-V2-Omni itself does not appear publicly released as weights

Confirmed:

- Xiaomi’s GitHub org and Hugging Face org publicly expose other MiMo-family repos/models, including:
  - `MiMo`
  - `MiMo-V2-Flash`
  - `MiMo-Audio`
  - `MiMo-VL`
  - `MiMo-Embodied`
- Public LICENSE files for `MiMo`, `MiMo-V2-Flash`, and `MiMo-Audio` are **Apache-2.0**.
- I did **not** find a publicly accessible MiMo-V2-Omni weights/model page in Xiaomi’s public GitHub or Hugging Face listings during this pass.

Interpretation of the evidence: MiMo as a family is partially open, but **MiMo-V2-Omni currently looks API-available rather than publicly self-hostable**.

### 9) Confirmed availability surfaces besides OpenRouter

Confirmed availability surfaces found during research:

- **Official / first-party:** Xiaomi MiMo Platform (`platform.xiaomimimo.com`, `api.xiaomimimo.com`)
- **Aggregator/router:** OpenRouter
- **Third-party wrapper surface:** Puter exposes `xiaomi/mimo-v2-omni` through its own OpenAI-compatible endpoint

Of those, the **only clearly authoritative provider docs** found were Xiaomi first-party and OpenRouter.

---

## Likely but unconfirmed inferences

These are important, but I do **not** want to overstate them as vendor-confirmed facts.

### A) Combined audio + visual input in one Xiaomi request is very likely supported in practice

Why this is likely:

- Xiaomi says the model sees/hears/reads simultaneously.
- Xiaomi’s schema allows text, image, audio, and video parts in the same user content array.
- OpenRouter’s multimodal overview explicitly says multiple modalities can be mixed in one request.

What is missing:

- I did not find a first-party Xiaomi example snippet showing, in one exact request, **image + audio**, or **video + extra audio/image**, all together.

Conclusion:

- **Very likely yes**, but we should still treat “single-call mixed-modality request against Xiaomi first-party” as something to validate in the prototype rather than assume blindly.

### B) The “10 MB limit” that matters operationally is probably the provider/Base64 path, not an OpenRouter-global rule

Why this is likely:

- Xiaomi explicitly documents a **10 MB Base64-string cap** for image/audio/video.
- OpenRouter explicitly forces **audio** into Base64 form and recommends URL transport for large files when possible.
- Base64 adds roughly ~33% size overhead before JSON envelope overhead.

So a practical inference is:

- even if OpenRouter itself does not impose a blanket 10 MB media cap, **OpenRouter can still push us into the 10 MB provider-side cap sooner** because it currently requires Base64 audio input.

### C) OpenRouter is probably still viable for image-first or small-media experiments, but not the best long-run transport for emotion-engine

Likely because:

- image URLs are supported
- multimodal mixing is supported
- OpenRouter offers routing/fallback convenience

But for emotion-engine we care about practical audio/video ingestion and predictable payload behavior, so direct Xiaomi looks like the stronger fit.

### D) Self-hosting would buy control and uptime only if the actual Omni weights become available

That sounds obvious, but it matters:

- with no public Omni weights, there is no near-term self-host plan for the actual target model
- if weights later appear, self-hosting could buy:
  - lower dependence on router/provider outages
  - local queueing / retry control
  - no URL-fetch dependency on vendor side
  - potentially lower marginal cost at scale

Right now this is hypothetical, not actionable.

---

## Constraints

### Product / architecture constraints

- emotion-engine likely benefits most from **audio + visual + text** jointly, not single-modality evaluation alone.
- Large inline payloads are bad for reliability, latency, and cost accounting.
- We should avoid designs that require Base64 for long audio or sizable video when a URL-based path exists.

### Provider/API constraints

- OpenRouter audio input is currently **Base64-only**.
- OpenRouter video URL support is **provider-specific**.
- Xiaomi first-party requires **publicly accessible** URLs for URL-mode inputs.
- Xiaomi first-party Base64 mode is capped at **10 MB string size** for image/audio/video.
- Xiaomi first-party URL-mode still has modality caps:
  - image 10 MB
  - audio 100 MB
  - video 300 MB

### Operational constraints

- URL-based submission means we need reliable temporary object storage with signed/public fetchable URLs.
- Provider-side URL fetches introduce an external dependency on URL reachability, TTLs, headers, and MIME correctness.
- Large videos will still require compression/downscaling if we want fast iteration and low token burn.

---

## Risks

### 1) Hidden incompatibility between generic docs and model-specific behavior

Even though the contracts strongly suggest mixed-modality requests should work, model-specific behavior can differ. We should validate:

- image + audio in one call
- video + text in one call
- whether video already includes enough audio context, or whether separate audio adds value / conflicts

### 2) URL fetch failures from provider side

If we use presigned URLs, failures can come from:

- expired links
- blocked bot/provider fetches
- incorrect content type
- redirects or auth mismatches
- vendor inability to reach private buckets

### 3) Base64 inflation can quietly break requests

A file that seems “under 10 MB” on disk can exceed a 10 MB Base64-string cap after encoding. That creates confusing failures if we do not preflight size after encoding.

### 4) Token/cost blow-up on video

Xiaomi’s docs expose `fps` and `media_resolution`, and their own token guidance makes clear that video cost grows with duration, extracted frames, and frame resolution. A naive prototype could be expensive and noisy.

### 5) Self-hosting distraction risk

Given current evidence, any serious self-hosting plan for MiMo-V2-Omni would be speculative churn. That would distract from the more realistic goal: validating whether direct API use improves emotion-engine quality enough to matter.

---

## Practical delivery strategies for emotion-engine

### Strategy 1 — Recommended: direct Xiaomi API + object storage URLs

**Flow**

1. Preprocess local media into prototype-safe sizes.
2. Upload to S3/R2/MinIO/compatible storage.
3. Generate short-lived presigned URLs.
4. Send Xiaomi-first-party request with `image_url`, `input_audio.data`, and/or `video_url.url` using those URLs.

**Why this is the best fit**

- Uses Xiaomi’s documented strongest path.
- Avoids Base64 inflation.
- Preserves larger provider-side size limits for audio/video.
- Keeps request bodies small and predictable.

**What to preflight before request**

- URL reachability
- MIME type
- file size
- TTL long enough for provider fetch + retries

### Strategy 2 — Conditional fallback: OpenRouter + URLs where possible

Use OpenRouter only if we specifically want routing convenience or model abstraction.

Practical shape:

- use image URLs
- use video URLs only if the selected provider path truly supports them
- keep audio very short if forced into Base64, or skip audio on this route

This is acceptable for small experiments, but not the strongest mainline path for emotion-engine.

### Strategy 3 — Compression/downscaling before upload

Use ffmpeg aggressively and intentionally.

For video prototype inputs:

- trim to the relevant emotional segment only
- downscale to something like **720p** or lower unless detail truly matters
- reduce frame rate if temporal precision is not critical
- prefer H.264 MP4 for interoperability unless provider docs say otherwise

For audio prototype inputs:

- mono unless stereo matters
- lower sample rate/bitrate when semantic/emotional content survives it
- split or crop to emotionally relevant windows if the full recording is not needed

The goal is not just getting under hard caps; it is reducing latency, token use, and failure rate.

### Strategy 4 — Avoid Base64 unless absolutely necessary

Base64 should be treated as the emergency/local-file path, not the default architecture.

Use Base64 only when:

- the media cannot be placed at a provider-fetchable URL
- the media is small enough after encoding
- privacy rules prohibit URL staging

Even then, preflight on the **encoded** size, not the raw file size.

---

## Concrete next-step options

### Option A — Recommended next step: narrow Xiaomi-direct prototype

Prototype only the transport layer and one evaluation lane:

- one audio+image fixture
- one short video fixture
- one text-only control
- direct Xiaomi API only
- URL-based media delivery only

Success criteria:

- requests succeed consistently
- provider can fetch staged media reliably
- mixed-modality response quality looks materially better than current single-path baseline for the selected fixture(s)

### Option B — Add a small OpenRouter comparison after the direct prototype

Only after Option A works:

- repeat the same fixtures through OpenRouter
- compare response quality, latency, and failure modes
- specifically check whether OpenRouter audio transport is a blocker

### Option C — Do not pursue self-hosting now

Revisit only if one of these changes:

- Xiaomi publishes MiMo-V2-Omni weights
- Xiaomi publishes official self-host/server guidance for Omni
- we find a high-quality public third-party hosted endpoint with stronger SLAs/control than today

---

## Recommendation

For emotion-engine, the best current recommendation is:

- **Proceed with a prototype plan**
- **Center it on direct Xiaomi API access**
- **Use URL-based media delivery via temporary object storage**
- **Preprocess media with ffmpeg before upload**
- **Treat OpenRouter as a secondary comparison route, not the primary architecture**
- **Do not invest in self-hosting work for MiMo-V2-Omni right now**

This gets us a realistic, benchmark-honest answer with the least architectural thrash.

---

## Task 2 note

**Yes, Task 2 looks justified.**

But it should be framed narrowly:

- prototype **transport + inference feasibility**, not full product integration
- validate **one-pass mixed-modality request behavior** directly against Xiaomi
- measure failure modes around URL staging, file-size handling, and response usefulness
- include OpenRouter only as a controlled comparison, not as the assumed production path

---

## Primary sources consulted

### Xiaomi / first-party

- `https://mimo.xiaomi.com/mimo-v2-omni`
- `https://platform.xiaomimimo.com/llms.txt`
- `https://platform.xiaomimimo.com/docs/api/chat/openai-api.md`
- `https://platform.xiaomimimo.com/docs/usage-guide/multimodal-understanding/image-understanding.md`
- `https://platform.xiaomimimo.com/docs/usage-guide/multimodal-understanding/audio-understanding.md`
- `https://platform.xiaomimimo.com/docs/usage-guide/multimodal-understanding/video-understanding.md`

### OpenRouter

- `https://openrouter.ai/api/v1/models`
- `https://openrouter.ai/xiaomi/mimo-v2-omni`
- `https://openrouter.ai/docs/guides/overview/multimodal/overview.mdx`
- `https://openrouter.ai/docs/guides/overview/multimodal/images.mdx`
- `https://openrouter.ai/docs/guides/overview/multimodal/audio.mdx`
- `https://openrouter.ai/docs/guides/overview/multimodal/videos.mdx`
- `https://openrouter.ai/docs/guides/overview/auth/byok.mdx`

### Availability / open-source surface checks

- `https://huggingface.co/XiaomiMiMo`
- `https://github.com/XiaomiMiMo`
- `https://raw.githubusercontent.com/XiaomiMiMo/MiMo-V2-Flash/main/LICENSE`
- `https://raw.githubusercontent.com/XiaomiMiMo/MiMo/main/LICENSE`
- `https://raw.githubusercontent.com/XiaomiMiMo/MiMo-Audio/main/LICENSE`

### Third-party availability surface (non-authoritative)

- `https://developer.puter.com/ai/xiaomi/mimo-v2-omni/`
