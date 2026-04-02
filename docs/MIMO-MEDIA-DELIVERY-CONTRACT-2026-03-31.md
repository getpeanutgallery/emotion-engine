# MiMo media delivery contract design

**Date:** 2026-03-31  
**Scope:** Planning/design only. No code changes in this note.  
**Goal:** Define a reusable config + adapter contract so `emotion-engine` can deliver media as either inline Base64 or remote URL references, selected per provider capability and per-payload constraints.

---

## Decision summary

The reusable abstraction should be:

1. **Config declares media once** in a canonical asset catalog.
2. **Scripts/domains reference media by ref name**, not by hard-coded transport mode.
3. **A shared media-delivery resolver chooses `url` vs `inline`** for each target using:
   - configured preference/order
   - provider capability metadata
   - payload size / MIME / URL availability validation
4. **Adapters receive already-resolved media attachments** with an explicit `deliveryMode`; they should not guess from local file paths.
5. **`cod-test` MiMo configs should keep `asset.inputPath` for local provenance** but point the whole-video prototype at a staged public S3 URL under the new media catalog.

This keeps the MiMo prototype narrow while creating a general provider abstraction instead of another `tool_variables.file_transfer` one-off.

---

## Design principles

- **Provider-neutral authoring:** YAML should describe the media and acceptable delivery modes without encoding OpenRouter/Xiaomi request quirks directly into scripts.
- **Capability-driven transport:** Provider adapters declare what they support; the resolver picks the payload shape.
- **Fail early:** Transport mismatches should be config/preflight failures where possible, not mid-request surprises.
- **Keep local provenance:** Local `asset.inputPath` still matters for reproducibility, hashing, output packaging, and fallback.
- **Separate source media from delivery media:** local path, staged URL, and inline Base64 are different representations of the same logical media asset.

---

## Recommended YAML shape

### 1) Canonical media catalog under `asset.media.refs`

Keep the existing required fields:

```yaml
asset:
  inputPath: examples/videos/emotion-tests/cod.mp4
  outputDir: output/cod-test-mimo-openrouter-url
```

Add a reusable media catalog:

```yaml
asset:
  inputPath: examples/videos/emotion-tests/cod.mp4
  outputDir: output/cod-test-mimo-openrouter-url

  media:
    refs:
      source_video:
        kind: video
        role: primary

        source:
          path: examples/videos/emotion-tests/cod.mp4

        staged:
          url: https://<bucket>.s3.amazonaws.com/cod-test/cod.mp4
          urlType: public # public | presigned
          expiresAt: null # required when urlType=presigned

        delivery:
          preferredMode: url # provider_default | url | inline
          allowedModes: [url, inline]
          allowFallback: true

        metadata:
          filename: cod.mp4
          mimeType: video/mp4
          sizeBytes: 12345678
          durationSeconds: 140.017
          width: 1920
          height: 1080
          fps: 24
          sha256: <optional-source-hash>
```

### 2) Domain/script references use media refs, not transport literals

For the MiMo whole-video lane:

```yaml
ai:
  video:
    inputRefs:
      - source_video

    targets:
      - adapter:
          name: openrouter
          model: xiaomi/mimo-v2-omni

      - adapter:
          name: xiaomi
          model: mimo-v2-omni
```

### 3) Optional per-target media override

If a specific target needs stricter behavior, allow a per-target override:

```yaml
ai:
  video:
    inputRefs: [source_video]
    targets:
      - adapter:
          name: xiaomi
          model: mimo-v2-omni
          media:
            source_video:
              preferredMode: url
              allowedModes: [url, inline]
              allowFallback: true

      - adapter:
          name: openrouter
          model: xiaomi/mimo-v2-omni
          media:
            source_video:
              preferredMode: url
              allowedModes: [url, inline]
              allowFallback: false
```

Use overrides only when a target truly differs from the media ref default.

### 4) Keep extracted/chunked media on the same contract

For Phase 1 audio or Phase 2 chunked video, the script-generated artifact should still become a **logical media ref** before adapter invocation. That means the eventual contract is the same whether the media started as:

- the original source file
- an extracted audio file
- a compressed derivative
- a split video chunk

The resolver should work from the same normalized descriptor regardless of where the artifact came from.

---

## Recommended runtime contract

### A) Normalized media ref produced from config or script outputs

Before provider selection, runtime should normalize each referenced asset into a transport-agnostic object:

```yaml
mediaRef:
  ref: source_video
  kind: video
  role: primary
  source:
    path: examples/videos/emotion-tests/cod.mp4
  staged:
    url: https://<bucket>.s3.amazonaws.com/cod-test/cod.mp4
    urlType: public
    expiresAt: null
  delivery:
    preferredMode: url
    allowedModes: [url, inline]
    allowFallback: true
  metadata:
    filename: cod.mp4
    mimeType: video/mp4
    sizeBytes: 12345678
    durationSeconds: 140.017
    width: 1920
    height: 1080
    fps: 24
    sha256: ...
```

### B) Provider capability contract

Each adapter should publish capability metadata at least at this granularity:

```yaml
capabilities:
  media:
    video:
      inline:
        supported: true
        maxBytes: 10485760
      url:
        supported: true
        urlTypes: [public, presigned]
        maxBytes: 314572800
    audio:
      inline:
        supported: true
        maxBytes: 10485760
      url:
        supported: false
        urlTypes: []
    image:
      inline:
        supported: true
        maxBytes: 10485760
      url:
        supported: true
        urlTypes: [public, presigned]
        maxBytes: 10485760
```

Minimum capability fields to standardize:

- `supported`
- `maxBytes`
- `urlTypes` (`public`, `presigned`)
- optional `mimeTypes` allowlist
- optional provider notes like `requiresBase64`, `providerFetchesRemoteUrl`, `supportsMixedModalRequest`

### C) Shared resolver output passed into adapters

The resolver should choose a concrete delivery mode and hand adapters an explicit attachment object:

```yaml
resolvedAttachment:
  ref: source_video
  kind: video
  role: primary
  deliveryMode: url # url | inline
  value: https://<bucket>.s3.amazonaws.com/cod-test/cod.mp4
  metadata:
    filename: cod.mp4
    mimeType: video/mp4
    sizeBytes: 12345678
    durationSeconds: 140.017
    width: 1920
    height: 1080
    fps: 24
    sha256: ...
  sourceSummary:
    sourcePath: examples/videos/emotion-tests/cod.mp4
    stagedUrlType: public
```

If inline is chosen, `value` is Base64 and `deliveryMode: inline`.

### D) Adapter expectations

Adapters should:

1. accept `resolvedAttachment[]`
2. map `deliveryMode=url` to provider URL fields (`video_url`, `image_url`, etc.)
3. map `deliveryMode=inline` to provider inline/Base64 fields (`input_audio.data`, inline file payloads, etc.)
4. reject unsupported modes with a **capability mismatch** error
5. avoid reading arbitrary local files directly as part of provider mapping once the resolver exists
6. capture raw payload metadata without persisting giant Base64 blobs unless explicitly enabled

The important split is:

- **resolver owns transport selection and preflight**
- **adapter owns provider-specific field mapping**

---

## Media metadata requirements

### Required metadata for every media ref

These should be required at normalization time, either declared in YAML or computed before send:

- `kind` (`video | audio | image`)
- `metadata.mimeType`
- `metadata.filename`
- `metadata.sizeBytes`
- at least one deliverable source:
  - `source.path`, or
  - `staged.url`, or
  - precomputed inline data

### Required by media kind

#### Video

- `durationSeconds`
- `width`
- `height`
- optional but useful: `fps`, `codec`

#### Audio

- `durationSeconds`
- optional but useful: `sampleRateHz`, `channels`, `codec`

#### Image

- `width`
- `height`

### Strongly recommended metadata

- `sha256` for source identity / provenance
- `staged.urlType`
- `staged.expiresAt` for presigned URLs
- `source.originalPath` when a derivative/chunk is being used
- `derivation` metadata for chunked or compressed artifacts

The runtime should be allowed to compute missing metadata from the local source file, but the normalized object handed to adapters should be complete.

---

## Validation and preflight rules

### Config validation

Additive validation rules should include:

1. `asset.media.refs` must be an object when present.
2. Each ref must declare:
   - `kind`
   - `delivery`
   - `metadata.mimeType`
   - at least one usable source (`source.path` and/or `staged.url`)
3. `ai.<domain>.inputRefs[*]` must reference an existing media ref.
4. If a target override exists at `adapter.media.<ref>`, that ref must exist.
5. `delivery.allowedModes` must be a non-empty subset of `[url, inline]`.
6. `delivery.preferredMode` must be one of `[provider_default, url, inline]`.

### Preflight resolution rules

Before the first provider call for a target:

1. Merge config defaults + target overrides.
2. Load adapter capabilities.
3. Choose delivery mode in this order:
   - explicit required/override mode
   - preferred mode if supported and viable
   - fallback mode if allowed and viable
   - otherwise fail
4. Viability rules:
   - `url` requires `staged.url`
   - `url` requires `http` or `https`
   - `urlType` must be supported by adapter capabilities
   - `inline` requires readable local source or precomputed Base64
   - `inline` size check uses **encoded Base64 bytes**, not raw file bytes
   - `url` size check uses raw file bytes when known
   - MIME type must be allowed by adapter capability rules if declared

### Presigned URL rules

If `urlType: presigned`:

- `expiresAt` is required
- TTL must exceed:
  - provider timeout budget
  - retry/failover budget
  - a fixed fetch buffer
- For benchmark/acceptance configs, prefer **public stable URLs** over presigned URLs unless the asset must remain private

### Error classification

Use explicit classification so failover logic stays sane:

- missing media ref / invalid YAML → `config`
- unsupported provider delivery mode → `capability`
- staged URL missing/expired/unreachable before request → `io` or `dependency`
- provider rejects URL fetch or payload size → `capability` if deterministic, otherwise `retryable`

---

## Provider capability implications

The contract should let provider capabilities influence payload shape automatically.

### Xiaomi direct (recommended long-term path)

Based on the feasibility memo:

- image URL supported
- audio URL supported
- video URL supported
- Base64 supported but capped much lower

Implication:

- prefer `url` for video/audio/image when a staged URL exists
- allow inline fallback only for small files or local-only testing

### OpenRouter (comparison path)

Based on the feasibility memo and current repo behavior:

- image URL is viable
- audio currently needs inline/Base64
- video URL support is provider-specific and should be capability-gated, not assumed universally

Implication:

- for audio targets, resolver should choose `inline`
- for video targets, choose `url` only if the selected target capability says that model/provider path accepts remote video URLs
- otherwise fall back to inline only if size is viable; if not viable, fail preflight instead of silently inventing another transport

### Future providers

Any new provider should only need to:

1. declare capabilities
2. implement `resolvedAttachment -> provider payload` mapping

Scripts should not branch on provider names to decide transport.

---

## `cod-test` guidance for the staged public S3 URL

For the MiMo prototype lane, `cod-test` should **not** replace `asset.inputPath` with the S3 URL.

Instead:

- keep `asset.inputPath: examples/videos/emotion-tests/cod.mp4`
- add `asset.media.refs.source_video.staged.url: https://.../cod.mp4`
- set `delivery.preferredMode: url`
- use `ai.video.inputRefs: [source_video]`

Recommended prototype intent:

```yaml
asset:
  inputPath: examples/videos/emotion-tests/cod.mp4
  outputDir: output/cod-test-mimo-openrouter-url
  media:
    refs:
      source_video:
        kind: video
        role: primary
        source:
          path: examples/videos/emotion-tests/cod.mp4
        staged:
          url: https://<public-s3-url>/cod.mp4
          urlType: public
        delivery:
          preferredMode: url
          allowedModes: [url, inline]
          allowFallback: false
        metadata:
          filename: cod.mp4
          mimeType: video/mp4
```

Why `allowFallback: false` for the benchmark prototype config:

- the point of this config is to prove the staged-URL path
- silently falling back to inline would hide the exact transport outcome being tested
- if the target cannot accept the URL path, the run should fail clearly

For private experiments, a separate config can use `urlType: presigned` and `allowFallback: true`.

---

## Migration / implementation guidance

Planning recommendation only:

1. **Introduce the config schema** (`asset.media.refs`, `ai.<domain>.inputRefs`, optional `adapter.media` override).
2. **Add a shared media normalization + delivery resolver** in the engine/lib layer.
3. **Update adapters to consume explicit `resolvedAttachment` objects**.
4. **Move current video/audio call sites off ad hoc `file_transfer` decisions** and onto the shared resolver.
5. **Add a dedicated MiMo cod-test config** that proves the whole-video URL path using the staged public S3 object.

Do not make the first implementation depend on automatic uploads. This contract should assume the staged URL is already provided by config for the prototype lane.

---

## Key recommendations to carry forward

- Add a **media catalog** under `asset.media.refs` instead of hiding transport choices in script-local knobs.
- Let **domains reference media by ref** and let a shared resolver choose `url` vs `inline`.
- Make **provider capabilities explicit**, especially for OpenRouter-vs-Xiaomi multimodal transport differences.
- Keep **local asset paths for provenance** and add **staged URLs for provider fetch**.
- For the first MiMo `cod-test` configs, use a **public S3 URL with `allowFallback: false`** so the experiment measures the intended delivery path honestly.
