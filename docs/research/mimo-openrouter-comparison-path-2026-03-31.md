# MiMo OpenRouter comparison path design note

**Date:** 2026-03-31  
**Scope:** Planning only. No code or config implementation in this task.  
**Question:** What is the fastest credible OpenRouter-based comparison path for `xiaomi/mimo-v2-omni` using the already-staged public S3 cod-test video?

---

## Recommendation

Use OpenRouter as a **narrow comparison lane**, not the primary architecture:

1. Send **one full-video request** to `xiaomi/mimo-v2-omni` through OpenRouter.
2. Use the **existing public S3 MP4 URL** as the first-choice transport.
3. Keep Phase 1 dialogue/music gathering in the pipeline only to preserve comparison context and fallback analysis material.
4. **Do not add separate OpenRouter audio attachments** for this experiment unless forced to, because OpenRouter docs are explicit that audio input must be Base64 and audio URLs are not supported.
5. Fall back to a **smaller public MP4 URL first**, and only fall back to **compressed inline Base64 video** if remote URL delivery proves unsupported or unreliable for this model/provider route.

Why this is the quickest path:

- it reuses the already-staged cod-test asset in S3
- it avoids the current inline-video payload bloat when URL delivery works
- it minimizes implementation scope to one new whole-video lane plus one URL-aware media handoff change
- it gives a clean answer to the real comparison question: **is OpenRouter viable enough to prototype MiMo quickly, even if Xiaomi-direct may still be the better long-term transport?**

---

## What we know vs. what is still uncertain

### Strongly grounded

- OpenRouter multimodal docs explicitly allow `video_url` with either a public URL or a Base64 data URL.
- OpenRouter docs explicitly warn that **video URL support varies by provider**.
- Xiaomi first-party docs explicitly allow **public video URLs** for `mimo-v2-omni` and document a much larger URL-size limit than Base64 delivery.
- The current repo/provider path already supports OpenRouter video as `messages[*].content[*] = { type: 'video_url', video_url: { url: ... } }`.
- The current repo/tool path **prefers Base64** when `videoContext.chunkPath` exists, so today it would not naturally choose the staged public URL path without a deliberate payload-shape change.

### Uncertain / weaker than Xiaomi-first-party docs

- OpenRouter’s generic docs imply this should work, but I did **not** find model-specific OpenRouter documentation stating, in an authoritative per-model way, that `xiaomi/mimo-v2-omni` accepts arbitrary public MP4 URLs end-to-end on the routed provider path.
- OpenRouter docs do not clearly spell out whether the routed MiMo path preserves all Xiaomi-specific multimodal knobs such as `fps` and `media_resolution`.
- Because OpenRouter is a router, even a valid generic `video_url` request can still fail due to provider-specific fetch restrictions, timeouts, or modality forwarding differences.

That uncertainty is why this should remain a **comparison lane** rather than the default architecture.

---

## Fastest proposed experiment shape

### High-level flow

1. Reuse the **same cod-test local input** for existing repo validation and Phase 1 dialogue/music extraction.
2. Add a new **whole-video MiMo comparison config** that points the video-review lane at the **public S3 MP4 URL**.
3. Send a request to OpenRouter with:
   - one `text` part
   - one `video_url` part pointing at the public S3 URL
   - no separate `input_audio` part unless we later prove it is necessary
4. Save one structured artifact that is easy to compare against the current chunked Phase 2 outputs.
5. If URL delivery fails, retry with a **smaller public MP4 URL**.
6. Only if URL mode is still blocked, try **compressed inline Base64 MP4** as the last OpenRouter fallback.

---

## Proposed new cod-test YAML

This should be a **new config file**, not a mutation of canonical `configs/cod-test.yaml`, so the comparison lane stays isolated.

**Suggested file:** `configs/cod-test-mimo-openrouter-compare.yaml`

### Proposed YAML sketch

```yaml
name: COD Test MiMo OpenRouter Compare
description: Narrow full-video OpenRouter comparison lane for MiMo using the staged public cod-test URL
version: '1.0'

asset:
  # Keep local asset for current repo validation + Phase 1 context extraction.
  inputPath: examples/videos/emotion-tests/cod.mp4
  outputDir: output/cod-test-mimo-openrouter-compare

gather_context:
  - server/scripts/get-context/get-dialogue.cjs
  - server/scripts/get-context/get-music.cjs

process:
  # New whole-video Phase 2 script from the MiMo prototype lane.
  - server/scripts/process/mimo-full-video-review.cjs

report: []

settings:
  api_request_delay: 500
  ffmpeg:
    audio:
      loglevel: error
      codec: libmp3lame
      bitrate: 192k
      sample_rate_hz: 44100
      channels: 2
      container: mp3
    video:
      compress:
        vcodec: libx264
        preset: fast
        max_width: 1280
        fps: 24
        audio_codec: aac
        audio_bitrate: 128k
        size_headroom_ratio: 0.9
      compress_aggressive:
        vcodec: libx264
        preset: slow
        fps: 24
        audio_codec: aac
        audio_bitrate: 96k
        vf: scale='min(1280,iw)':-1:force_original_aspect_ratio=decrease
        maxrate_multiplier: 1.2
        bufsize_multiplier: 2
        size_headroom_ratio: 0.95

debug:
  captureRaw: true

recovery:
  deterministic:
    maxAttemptsPerFailure: 1
    maxRepeatedStrategyUsesPerFailure: 0

tool_variables:
  soulPath: ../cast/impatient-teenager/SOUL.md
  goalPath: ../goals/video-ad-evaluation.md
  file_transfer:
    strategy: public-url
    mimeType: video/mp4
    publicUrl: https://<existing-public-cod-test-url>.mp4
    allowBase64Fallback: true
    fallbackPublicUrl: https://<existing-public-cod-test-url-smaller>.mp4
    maxFileSize: 10485760
  variables:
    lenses:
      - patience
      - boredom
      - excitement

ai:
  dialogue:
    targets:
      - adapter:
          name: openrouter
          model: google/gemini-3.1-flash-lite-preview
  music:
    targets:
      - adapter:
          name: openrouter
          model: google/gemini-3.1-flash-lite-preview
  video:
    targets:
      - adapter:
          name: openrouter
          model: xiaomi/mimo-v2-omni
          params:
            max_tokens: 4000
            timeoutMs: 180000
            thinking:
              level: low
```

### Why this YAML shape is the fastest useful one

- `asset.inputPath` remains local because current repo config validation expects it and Phase 1 still benefits from local extraction.
- `report: []` avoids dragging existing Phase 3 scripts into a new artifact shape before we know the lane is viable.
- `tool_variables.file_transfer` extends an already-existing config seam instead of inventing a separate delivery contract just for this experiment.
- one video target is enough for the comparison lane; we are testing transport + usefulness first, not building a full target chain.

---

## Payload-shape changes needed for OpenRouter public URL delivery

## Current behavior that gets in the way

Today the pipeline/tool/provider seam is biased toward inline media:

1. `server/scripts/process/video-chunks.cjs` already emits `videoContext.transferStrategy` and `mimeType`.
2. `../tools/emotion-lenses-tool.cjs` currently calls `getInlineVideoBase64(videoContext)` before preferring a URL.
3. If `videoContext.chunkPath` exists, the tool reads the file and emits Base64.
4. `node_modules/ai-providers/providers/openrouter.cjs` then serializes that as:

```json
{
  "type": "video_url",
  "video_url": {
    "url": "data:video/mp4;base64,..."
  }
}
```

That is useful as a fallback, but it defeats the goal of testing the staged public URL path.

## Minimal payload-shape change

For the new full-video comparison lane, the media handoff should become:

### Internal attachment intent

```json
{
  "type": "video",
  "url": "https://<public-s3-cod-test>.mp4",
  "mimeType": "video/mp4"
}
```

### OpenRouter request content

```json
{
  "role": "user",
  "content": [
    {
      "type": "text",
      "text": "<prompt>"
    },
    {
      "type": "video_url",
      "video_url": {
        "url": "https://<public-s3-cod-test>.mp4"
      }
    }
  ]
}
```

## Concrete design implications

1. **Honor `transferStrategy` explicitly.**  
   If `videoContext.transferStrategy === 'public-url'` and `videoContext.url` exists, the tool should emit a URL attachment first and must not auto-read `chunkPath` into Base64.

2. **Pass the actual public URL in `videoContext`.**  
   The whole-video lane should hand off both:
   - `videoContext.url` = public S3 URL
   - `videoContext.transferStrategy` = `public-url`

3. **Keep Base64 as a deliberate fallback, not implicit default.**  
   The tool can still support Base64, but only when:
   - `transferStrategy` requests it, or
   - URL mode fails and the recovery policy explicitly chooses inline fallback.

4. **Do not attach standalone audio in the first comparison attempt.**  
   OpenRouter audio docs currently say audio input must be Base64 and direct audio URLs are not supported. For the fastest MiMo comparison, use the MP4 video lane and let the model consume whatever embedded audio the provider path supports.

5. **Treat provider-specific video controls as optional.**  
   Xiaomi-first-party docs mention `fps` and `media_resolution`; OpenRouter’s generic docs do not clearly guarantee those controls for routed MiMo. The comparison path should not depend on them initially.

---

## Fallback plan if the public URL path fails

### Fallback 1 — smaller public MP4 URL

Preferred first fallback:

- generate a compressed MP4 derivative of the same cod-test asset
- upload or stage it at another public S3 URL
- keep the same OpenRouter request shape, only swap the URL

Why first:

- preserves the low-payload advantage
- tests whether failures are about file size / fetch time rather than URL-mode incompatibility

### Fallback 2 — compressed inline Base64 MP4

Use only if OpenRouter accepts the model but repeatedly fails on remote URL fetches.

Constraints:

- compress aggressively enough that the resulting Base64 data URL stays within whatever practical request-size/provider limits we hit
- expect worse latency, larger raw debug artifacts, and more transport fragility

### Explicitly avoid as first fallback

- separate `input_audio` via OpenRouter unless absolutely necessary
- mixed video URL + audio Base64 in the first experiment
- broad chunking / split logic before the full-video URL hypothesis is tested once

Those additions add complexity before answering the main viability question.

---

## Success signals: when OpenRouter is viable enough for a prototype

OpenRouter is viable enough for a prototype if most of the following are true on the first narrow comparison pass:

1. **Transport success**  
   The routed request succeeds with one public `video_url` and no schema/provider-modality rejection.

2. **Fetch success**  
   The provider can reliably retrieve the public S3 video without intermittent URL-fetch failures.

3. **Output usefulness**  
   The model references concrete COD moments and emotional arc details rather than generic trailer-language filler.

4. **Comparison value**  
   The output is interpretable against the existing chunked cod-test baseline without a lot of custom glue.

5. **Operational simplicity**  
   We can run the lane without special casing a pile of media preprocessing rules beyond maybe one compressed derivative.

6. **Latency is prototype-tolerable**  
   One full-video request finishes in a time window that feels usable for iteration (roughly minutes, not “come back later tonight”).

7. **Failure rate is low**  
   The lane does not require repeated manual retries just to get a valid response.

If those signals hold, OpenRouter earns a spot as the fast comparison route.

---

## Failure signals: when OpenRouter is not viable enough

OpenRouter should be considered **not good enough for the prototype lane** if any of these become the dominant pattern:

1. repeated `video_url` rejection or provider capability mismatch for `xiaomi/mimo-v2-omni`
2. repeated remote-fetch failures against valid public S3 URLs
3. only inline Base64 works, and it requires heavy compression that materially harms fidelity
4. responses are consistently generic or clearly less grounded than the existing chunked baseline
5. the lane needs a lot of OpenRouter-specific workaround logic before a single trustworthy comparison run exists
6. routed behavior is too opaque to debug compared with direct Xiaomi-first-party access

At that point, the right call is to stop polishing the OpenRouter lane and move effort to Xiaomi-direct transport.

---

## Implementation order I would recommend later

When someone implements this after planning:

1. add the new comparison config
2. add a URL-first full-video handoff in the new whole-video review lane
3. make the tool/provider seam honor `public-url` over implicit Base64
4. run exactly one narrow OpenRouter MiMo comparison against the staged S3 MP4
5. only if that fails, produce a smaller public MP4 derivative and rerun
6. only if that also fails, try compressed inline Base64 as the final OpenRouter fallback

This keeps the experiment crisp and answers the real question quickly.

---

## Bottom line

**Best fast comparison route:** one OpenRouter request to `xiaomi/mimo-v2-omni` using the staged public S3 `video_url`, with Phase 1 context kept local and separate, and Base64 retained only as the final fallback.

**Most important design change:** stop auto-promoting `chunkPath` into inline Base64 when the config explicitly asks for `public-url` delivery.

**Main uncertainty:** OpenRouter generic docs are supportive, but Xiaomi-first-party docs are still the stronger authority on what MiMo definitely accepts. That makes this a good comparison experiment, not a strong default architecture choice.
