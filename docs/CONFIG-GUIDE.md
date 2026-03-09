# Config Guide (Emotion Engine)

This repo is YAML-driven. The canonical reference for what is accepted is:

- `server/lib/config-loader.cjs` (`validateConfig`)
- working examples under `configs/` (start with `configs/cod-test.yaml`)

---

## Canonical commands

```bash
npm run validate-configs
npm run pipeline -- --config configs/cod-test.yaml --dry-run
npm run pipeline -- --config configs/cod-test.yaml
npm test
```

---

## Environment variables

### Required for live calls

- `AI_API_KEY` — API key used by the configured provider adapter(s)

### Digital twin (record/replay)

These are consumed by the provider layer to replay recorded responses or capture new cassettes:

- `DIGITAL_TWIN_MODE` — `replay` or `record` (anything else behaves like “live”)
- `DIGITAL_TWIN_PACK` — path to a twin pack repo directory (contains `cassettes/`)
- `DIGITAL_TWIN_CASSETTE` — cassette id (filename without `.json`)

---

## Minimal runnable config

This is the minimum shape that passes schema validation.

```yaml
name: "Example"
asset:
  inputPath: "examples/videos/emotion-tests/cod.mp4"
  outputDir: "output/example"

gather_context: []
process:
  - server/scripts/process/example-process.cjs
report: []

# At least one script across all phases is required (this example uses example-process).

ai:
  dialogue:
    targets:
      - adapter:
          name: openrouter
          model: openai/gpt-audio-mini
  music:
    targets:
      - adapter:
          name: openrouter
          model: openai/gpt-audio-mini
  video:
    targets:
      - adapter:
          name: openrouter
          model: google/gemini-2.5-flash
```

Note: most real configs will include at least one script in `gather_context`, `process`, or `report`.

---

## Required fields

### `asset`

```yaml
asset:
  inputPath: "path/to/input.mp4"
  outputDir: "output/my-run"
```

- `asset.inputPath` (string) — input asset (video/audio/image)
- `asset.outputDir` (string) — run output directory

### `ai` (targets-based)

Each domain must define at least one target:

- `ai.dialogue.targets` (non-empty array)
- `ai.music.targets` (non-empty array)
- `ai.video.targets` (non-empty array)

A target looks like:

```yaml
ai:
  video:
    targets:
      - adapter:
          name: openrouter
          model: google/gemini-2.5-flash
          params:
            temperature: 0.2
```

Supported target keys:

- `adapter.name` (string) — provider adapter name (e.g. `openrouter`, `openai`, `anthropic`, `gemini`)
- `adapter.model` (string) — model id for that adapter
- `adapter.params` (object, optional) — forwarded into provider options (engine does not validate its schema)

Optional per-domain retry settings:

```yaml
ai:
  video:
    retry:
      maxAttempts: 2
      backoffMs: 500
    targets:
      - adapter: { name: openrouter, model: google/gemini-2.5-flash }
```

---

## Phases and script lists

At least **one** script across all phases is required.

### Phase formats

Each phase supports either:

1) Simple array of script paths:

```yaml
gather_context:
  - server/scripts/get-context/get-dialogue.cjs
  - server/scripts/get-context/get-music.cjs

process:
  - server/scripts/process/video-chunks.cjs

report:
  - server/scripts/report/metrics.cjs
```

2) Structured object for parallel/sequential execution:

```yaml
process:
  sequential:
    - script: server/scripts/process/video-chunks.cjs
    - script: server/scripts/process/video-per-second.cjs

# gather_context and report support { parallel: [...] } as well
```

---

## Tool variables

Some scripts (notably `video-chunks`) use persona/goal/tool context.

Example:

```yaml
tool_variables:
  soulPath: "cast/impatient-teenager/SOUL.md"
  goalPath: "goals/video-ad-evaluation.md"
  variables:
    lenses: [patience, boredom, excitement]
```

---

## Debug flags

See `docs/DEBUG-CONFIG.md` for details.

Common:

```yaml
debug:
  captureRaw: true
  keepProcessedIntermediates: true
```

---

## Recommended starting points

- `configs/cod-test.yaml` — “real” end-to-end config used as an acceptance gate
- `configs/quick-test.yaml` — smaller/faster config for local iteration
