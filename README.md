# Emotion Engine v8.0

Modular 3-phase pipeline for video/audio emotion analysis.

## Quickstart (canonical commands)

```bash
npm install
npm run validate-configs
npm run pipeline -- --config configs/cod-test.yaml --dry-run
npm test
```

Digital-twin (record/replay) knobs:

- `DIGITAL_TWIN_MODE` — `replay` (offline/deterministic) or `record` (capture new cassettes)
- `DIGITAL_TWIN_PACK` — path to a twin pack repo (contains `cassettes/`)
- `DIGITAL_TWIN_CASSETTE` — cassette id (filename without `.json`)

## What this repo runs today

**Primary entrypoint (use this):**

```bash
npm run pipeline -- --config <config.yaml>
# equivalent: node server/run-pipeline.cjs --config <config.yaml>
```

The orchestrator (`server/run-pipeline.cjs`) loads YAML/JSON config, validates it, runs scripts in 3 phases, and writes artifacts to `output/...`.

> `npm exec emotion-engine` (bin shim → `server/run-pipeline.cjs`) is supported and equivalent to `npm run pipeline`.

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
└── docs/                            # deeper references
```

---

## Polyrepo sibling dependencies

This repo is part of the Peanut Gallery polyrepo ecosystem and integrates with sibling repos. In normal installs, dependencies are pulled via `git+ssh` (see `package.json`). For local development across repos, sibling checkouts are useful:

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

Set env:

```bash
cp .env.example .env
# edit .env
AI_API_KEY=...
```

---

## Running pipelines

Canonical CLI invocation (via `package.json#bin`):

```bash
npm exec emotion-engine -- --config configs/full-analysis.yaml --dry-run
```

Or run the underlying script directly:

```bash
npm run pipeline -- --config configs/full-analysis.yaml --dry-run
```

### 1) Validate configs (parse + schema)

Parse all `configs/*.yaml` (single-doc YAML):

```bash
npm run validate-configs
```

Validate a specific config against the engine schema (no execution):

```bash
npm run pipeline -- --config configs/cod-test.yaml --dry-run
```

### 2) Run a no-AI smoke test

```bash
npm run pipeline -- --config configs/example-pipeline.yaml
```

### 3) Run full analysis

```bash
npm run pipeline -- --config configs/full-analysis.yaml
```

### 4) Phase 3-only (fast iteration on report scripts)

If you already have a run folder with Phase 1/2 artifacts (default: `output/cod-test`), you can iterate on Phase 3 without rerunning extraction/chunk analysis:

- `server/scripts/report/recommendation.cjs` is the only current Phase 3 AI lane.
- `metrics`, `emotional-analysis`, `summary`, and `final-report` are computed report scripts that reuse earlier artifacts; they are not validator-tool AI lanes.

```bash
npm run pipeline -- --config configs/cod-test-phase3.yaml --verbose
# equivalent:
# node server/run-pipeline.cjs --config configs/cod-test-phase3.yaml --verbose
```

See `docs/CONFIG-GUIDE.md#phase-3-only-iteration-fast-report-debugging` for digital-twin replay caveats (strict request matching).

---

## Output layout

Given `asset.outputDir: output/<run-name>`, the pipeline writes under that folder.

Always created by orchestrator (regardless of `debug.captureRaw`):

```text
output/<run-name>/
├── assets/
│   ├── input/                       # copied input asset + config (+ persona files when available)
│   └── processed/                   # extracted audio/chunks (retention controlled by debug flags)
├── phase1-gather-context/
├── phase2-process/
├── phase3-report/
├── raw/
│   ├── _meta/events.jsonl           # run timeline (append-only JSONL)
│   └── ai/_prompts/<sha256>.json    # stored prompt payloads (referenced via promptRef)
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

the scripts persist raw AI + ffmpeg/ffprobe diagnostics into phase-scoped raw folders (and reference run-level prompt payloads via `promptRef`):

```text
phase1-gather-context/raw/
  _meta/
    errors.jsonl
    errors.summary.json
  ai/
    dialogue-transcription.json         # pointer to latest attempt capture
    dialogue-transcription/attempt-01/capture.json
    music-analysis.json                 # pointer to latest attempt capture
    music-analysis/attempt-01/capture.json
  ffmpeg/
    dialogue/extract-audio.json
    dialogue/ffprobe-audio-duration.json
    music/extract-audio.json
    ...
  tools/_versions/
    ffmpeg.json
    ffprobe.json

phase2-process/raw/
  _meta/
    errors.jsonl
    errors.summary.json
  ai/
    chunk-analysis/attempt-01/capture.json
  ffmpeg/
    ...

phase3-report/raw/
  ...

raw/ai/_prompts/<sha256>.json           # prompt payloads (run-level)
raw/_meta/events.jsonl                 # run timeline (run-level)
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

- `DIGITAL_TWIN_PACK=test/fixtures/digital-twin-emotion-engine-providers` (included minimal cassette pack)
- `DIGITAL_TWIN_CASSETTE=providers`

If that cassette is missing, tests fail with:

`Cassette not found: providers`

So for green provider/integration tests, ensure a matching cassette exists (or point env vars at a valid pack/cassette).

---

## Troubleshooting

### `Failed to parse config file: expected a single document in the stream, but found more`

Your YAML has multiple documents (`---`). Keep configs single-document. `configs/video-analysis.yaml` is single-doc; the parallel example lives in `configs/video-analysis-parallel.yaml`.

### `Missing required "ai.<domain>.targets"`

Config validation requires explicit per-domain targets:

- `ai.dialogue.targets[*].adapter.{name,model}`
- `ai.music.targets[*].adapter.{name,model}`
- `ai.video.targets[*].adapter.{name,model}`

See `configs/cod-test.yaml` for a working example.

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

## Docs

- `docs/AI-LANE-CONTRACT.md` — universal schema / validator contract for structured AI lanes
- `docs/AI-RECOVERY-LANE-CONTRACT.md` — bounded AI recovery contract, failure package, result schema, and YAML policy shape
- `docs/ROLLOUT-FAMILIES-AND-SIBLING-IMPACT.md` — rollout-family map, sibling repo boundary, reused beads, and safe implementation order
- `docs/CONFIG-GUIDE.md` — current YAML schema + examples
- `docs/DEBUG-CONFIG.md` — `debug.captureRaw` + processed intermediates retention
- `docs/COD-TEST-GOLDEN-RUN-CHECKLIST.md` — deterministic replay/record checklist for `configs/cod-test.yaml`
