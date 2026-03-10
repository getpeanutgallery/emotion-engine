# Expose FFmpeg audio/video compression settings via YAML (canonical, hard error, clean break)

## Context / motivation
Emotion Engine currently hardcodes multiple FFmpeg “compression / normalization” knobs directly in code paths that:

- extract/normalize audio to WAV for Phase 1 (`get-dialogue`, `get-music`, `audio-chunk-extractor`)
- compress video chunks to meet size constraints (`server/lib/video-utils.cjs`)

Examples of currently hardcoded values:

- Audio extraction: `pcm_s16le`, `16000` Hz, mono (`-ac 1`), WAV output
  - `server/scripts/get-context/get-dialogue.cjs` → `extractAudio()`
  - `server/scripts/get-context/get-music.cjs` → `extractAudio()` + `extractAudioSegment()`
  - `server/lib/audio-chunk-extractor.cjs` → `extractAudioChunk()`
- Video compression: `libx264`, preset `fast`/`slow`, `1280` max width, `24` fps, `aac` audio @ `128k`/`96k`, rate-control knobs
  - `server/lib/video-utils.cjs` → `compressChunk()` + `compressChunkAggressive()`

This makes pipelines non-transparent and harder to tune per provider constraints, content type, or model limits.

### Goal
Expose these FFmpeg knobs in the pipeline YAML as the **canonical source of truth**.

- **Hard error if missing**: config validation should fail (or scripts should throw with a clear message) if the required FFmpeg config keys are absent.
- **Clean break**: remove internal defaults and legacy fallbacks. Existing configs must be updated.

---

## Proposed YAML keys / schema
Add a required `settings.ffmpeg` object.

### Required keys (audio)
Used by Phase 1 extraction/chunking (`get-dialogue`, `get-music`, `audio-chunk-extractor`).

```yaml
settings:
  ffmpeg:
    audio:
      loglevel: "error"          # passed as: -v <loglevel>
      codec: "pcm_s16le"         # passed as: -acodec <codec>
      sample_rate_hz: 16000       # passed as: -ar <sample_rate_hz>
      channels: 1                 # passed as: -ac <channels>
      container: "wav"           # determines output filename/extension (e.g. audio.wav, chunk_000.wav)
```

Notes:
- `container` is a policy knob: today we always write WAV. Keeping this explicit avoids hidden behavior.

### Required keys (video compression)
Used by chunk compression (`server/lib/video-utils.cjs`).

```yaml
settings:
  ffmpeg:
    video:
      compress:
        vcodec: "libx264"        # -c:v
        preset: "fast"           # -preset
        max_width: 1280           # scaling policy (see implementation sketch)
        fps: 24                   # -r
        audio_codec: "aac"        # -c:a
        audio_bitrate: "128k"     # -b:a

        # bitrate targeting policy
        size_headroom_ratio: 0.90  # used when computing target bitrate from (maxSizeBytes, duration)

      compress_aggressive:
        vcodec: "libx264"
        preset: "slow"
        fps: 24
        audio_codec: "aac"
        audio_bitrate: "96k"

        # filter for scaling down (kept as a raw ffmpeg filter string)
        vf: "scale='min(1280,iw)':-1:force_original_aspect_ratio=decrease"

        # rate control tuning derived from target bitrate
        maxrate_multiplier: 1.2
        bufsize_multiplier: 2.0
        size_headroom_ratio: 0.95
```

#### Example (minimal “matches current behavior”)
Update existing configs to include a block like:

```yaml
settings:
  # ... existing settings
  ffmpeg:
    audio:
      loglevel: "error"
      codec: "pcm_s16le"
      sample_rate_hz: 16000
      channels: 1
      container: "wav"

    video:
      compress:
        vcodec: "libx264"
        preset: "fast"
        max_width: 1280
        fps: 24
        audio_codec: "aac"
        audio_bitrate: "128k"
        size_headroom_ratio: 0.90

      compress_aggressive:
        vcodec: "libx264"
        preset: "slow"
        fps: 24
        audio_codec: "aac"
        audio_bitrate: "96k"
        vf: "scale='min(1280,iw)':-1:force_original_aspect_ratio=decrease"
        maxrate_multiplier: 1.2
        bufsize_multiplier: 2.0
        size_headroom_ratio: 0.95
```

---

## Implementation sketch

### 1) Make config required + validate it (hard error)
- Add validation in `server/lib/config-loader.cjs` `validateConfig(config)`:
  - require `settings.ffmpeg.audio` with all required keys
  - require `settings.ffmpeg.video.compress` and `settings.ffmpeg.video.compress_aggressive` with all required keys
  - validate types and allowed ranges:
    - `sample_rate_hz` integer > 0
    - `channels` integer >= 1
    - `fps` integer > 0
    - ratios/multipliers are numbers > 0
    - bitrates are strings matching `/^\d+k$/` (or explicitly allow `"96k"`, etc)

No legacy fallback: do not interpret existing `settings.chunk_quality` etc as implicit defaults.

### 2) Centralize FFmpeg arg building
Create helper(s), e.g. `server/lib/ffmpeg-args.cjs`:

- `getFfmpegAudioExtractArgs({ inputPath, outputPath, config })` → returns an args array for spawn, using `settings.ffmpeg.audio.*`
- `getFfmpegVideoCompressArgs({ inputPath, outputPath, maxSizeBytes, durationSeconds, config, aggressive=false })`

This keeps scripts thin and ensures one source of truth.

### 3) Plumb config into call sites
Update the following to read from YAML:

- `server/scripts/get-context/get-dialogue.cjs`
  - `extractAudio()` currently constructs a command string with hardcoded `-acodec pcm_s16le -ar 16000 -ac 1`
  - switch to spawn + args builder (preferred), or build command string from required config
- `server/scripts/get-context/get-music.cjs`
  - `extractAudio()` and `extractAudioSegment()`
- `server/lib/audio-chunk-extractor.cjs`
  - add `config` param (or explicit `ffmpegAudioConfig`) to `extractAudioChunk()` so it no longer hardcodes `16000/mono/pcm_s16le`
- `server/lib/video-utils.cjs`
  - `compressChunk()` and `compressChunkAggressive()` should build args from `settings.ffmpeg.video.*`
  - remove embedded presets/bitrates/filters

### 4) Keep behavior identical (except config required)
Once configs are updated, runs should produce equivalent audio (WAV 16kHz mono) and similar compression behavior, but now controlled by YAML.

---

## Acceptance criteria
- [ ] All FFmpeg audio extraction/normalization knobs used by Phase 1 are defined in YAML and read from config.
- [ ] All FFmpeg video compression knobs used by `server/lib/video-utils.cjs` are defined in YAML and read from config.
- [ ] YAML is the canonical source:
  - [ ] `validateConfig()` fails if `settings.ffmpeg` (and required subkeys) are missing or invalid.
  - [ ] No in-code defaults or legacy fallback paths remain for these knobs.
- [ ] All configs under `configs/*.yaml` updated to include required `settings.ffmpeg` keys.
- [ ] Tests updated/added:
  - [ ] config validation test: missing `settings.ffmpeg.*` → invalid with clear error message(s)
  - [ ] at least one happy-path config validates successfully

---

## Migration notes
- Update all pipeline YAMLs (`configs/*.yaml`, any examples) to include `settings.ffmpeg`.
- Update any tests that create minimal configs to include the new required keys.
- Consider documenting the new knobs in `docs/CONFIG-GUIDE.md` under a new section “FFmpeg settings (required)”.
