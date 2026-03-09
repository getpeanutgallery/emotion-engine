# Emotion Engine v8.0

Modular 3-phase pipeline for video/audio emotion analysis.

## What this repo runs today

**Primary entrypoint (use this):**

```bash
npm run pipeline -- --config <config.yaml>
# equivalent: node server/run-pipeline.cjs --config <config.yaml>
```

The orchestrator (`server/run-pipeline.cjs`) loads YAML/JSON config, validates it, runs scripts in 3 phases, and writes artifacts to `output/...`.

> Note: `bin/run-analysis.js` and `package.json#bin` are legacy/incomplete in this repo state. Prefer `server/run-pipeline.cjs` directly.

---

## Repo structure (quick audit)

```text
emotion-engine/
├── server/run-pipeline.cjs          # main orchestrator
├── server/lib/                      # config loader, phase runners, output/raw helpers
├── server/scripts/
│   ├── get-context/                 # phase 1 scripts
│   ├── process/                     # phase 2 scripts
│   └── report/                      # phase 3 scripts
├── configs/                         # runnable YAML configs
├── test/                            # node --test suites
├── output/                          # run outputs
└── docs/                            # deeper references (some docs are stale)
```

---

## Polyrepo sibling dependencies

This repo expects the Peanut Gallery sibling repos to exist (for development and tests):

- `../ai-providers`
- `../tools`
- `../cast`
- `../goals`
- `../retry-strategy`
- (tests/cassettes) `../digital-twin-*` repos

### Dependency wiring status

`package.json` is already using **git+ssh** dependencies (good):

- `ai-providers`, `tools`, `cast`, `goals`, `retry-strategy` are `git+ssh://...`
- no `file:` deps in `package.json`

This matches CI-friendly polyrepo behavior.

---

## Prerequisites

- Node.js `>=18`
- npm (repo has `package-lock.json`; npm is the safest default)
- GitHub SSH access (for `git+ssh` package installs)
- API key for live provider calls (`AI_API_KEY`) unless running in digital-twin replay
- FFmpeg/FFprobe are provided via `ffmpeg-static` + `ffprobe-static` (no manual apt/brew needed)

Optional for integration/provider tests:

- `digital-twin-emotion-engine-providers` (or another cassette pack)
- valid cassette files under `<pack>/cassettes/`

---

## Install

```bash
cd /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine
npm install
```

Set env (there is currently no `.env.example` in this repo):

```bash
# .env
AI_API_KEY=...
```

---

## Running pipelines

### 1) Validate config only (recommended first)

```bash
npm run pipeline -- --config configs/full-analysis.yaml --dry-run
```

### 2) Run a no-AI smoke test

```bash
npm run pipeline -- --config configs/example-pipeline.yaml
```

### 3) Run full analysis

```bash
npm run pipeline -- --config configs/full-analysis.yaml
```

---

## Output layout

Given `asset.outputDir: output/<run-name>`, the pipeline writes under that folder.

Always created by orchestrator:

```text
output/<run-name>/
├── assets/
│   ├── input/                       # copied input asset + config (+ persona files when available)
│   └── processed/                   # extracted audio/chunks (retention controlled by debug flags)
├── phase1-extract/raw/              # raw capture bucket for phase1
├── phase2-process/raw/              # raw capture bucket for phase2
├── phase3-report/raw/               # raw capture bucket for phase3
└── artifacts-complete.json          # final serialized artifact context
```

Typical script outputs:

- `phase1-gather-context/dialogue-data.json`
- `phase1-gather-context/music-data.json`
- `phase2-process/chunk-analysis.json`
- `phase2-process/per-second-data.json`
- `phase3-report/...` (metrics/recommendation/final report files)

---

## `debug.captureRaw` behavior (new)

When enabled:

```yaml
debug:
  captureRaw: true
```

the scripts persist raw AI + ffmpeg/ffprobe diagnostics into canonical raw folders:

```text
phase1-extract/raw/
  ai/
    dialogue-transcription.json
    music-segment-<n>.json
  ffmpeg/
    extract-audio.json
    extract-segment-<n>.json
    ffprobe-audio-duration.json

phase2-process/raw/
  ai/
    chunk-<n>.json
    chunk-<n>-split-<m>.json
  ffmpeg/
    ffprobe-video-duration.json
    extract-chunk-<n>.json
    split-*.json (when splitting occurs)
```

### Processed intermediates retention

Current behavior defaults to **keep** processed intermediates unless you disable it:

```yaml
debug:
  keepProcessedIntermediates: false
```

Backward-compatible aliases still read:

- `debug.keepProcessedFiles`
- `debug.keepTempFiles` (legacy)

---

## Testing

### Unit / script tests (fast, local)

```bash
npm test
```

or run targeted suites:

```bash
node --test test/scripts/get-dialogue.test.js test/scripts/get-music.test.js test/scripts/video-chunks.test.js
```

### Provider + integration tests (cassette-dependent)

Provider tests use digital-twin defaults:

- `DIGITAL_TWIN_PACK=/home/derrick/.openclaw/workspace/projects/peanut-gallery/digital-twin-emotion-engine-providers`
- `DIGITAL_TWIN_CASSETTE=providers`

If that cassette is missing, tests fail with:

`Cassette not found: providers`

So for green provider/integration tests, ensure a matching cassette exists (or point env vars at a valid pack/cassette).

---

## Troubleshooting

### `Failed to parse config file: expected a single document in the stream, but found more`

Your YAML has multiple documents (`---`). Use a single-document config. Example: `configs/full-analysis.yaml` works; `configs/video-analysis.yaml` currently contains an extra alt doc block.

### `Missing required "ai.dialogue.model" / "ai.music.model" / "ai.video.model"`

Config validation now requires explicit per-domain models.

### `AI_API_KEY ... is required`

Live calls require `AI_API_KEY`. For `video-chunks` replay mode, `DIGITAL_TWIN_MODE=replay` allows running without a live key.

### `Cassette not found: providers`

Set `DIGITAL_TWIN_PACK` and `DIGITAL_TWIN_CASSETTE` to an existing cassette pair, or record new cassettes in the digital-twin repo.

### Persona/goal path failures

Ensure these exist and match sibling repo layout:

- `cast/<persona>/SOUL.md`
- `goals/<goal>.md`
- `tools/<tool>.cjs`

---

## Practical known gaps

- `package.json#bin` points to `./bin/run-pipeline.js` (not present).
- No `.env.example` committed right now.
- Some docs in `docs/` still describe older debug folder semantics (`keepTempFiles` + timestamped folders).

Use this README as the current source of truth for running the repo today.
