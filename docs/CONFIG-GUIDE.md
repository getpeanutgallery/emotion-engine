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
- `ai.recommendation.targets` (non-empty array) — required when running `server/scripts/report/recommendation.cjs`


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
            max_tokens: 900
            thinking:
              level: low
```

Supported target keys:

- `adapter.name` (string) — provider adapter name (e.g. `openrouter`, `openai`, `anthropic`, `gemini`)
- `adapter.model` (string) — model id for that adapter
- `adapter.params` (object, optional) — provider options plus normalized repo-level controls
  - `max_tokens` (number) — normalized output token budget
  - `thinking.level` (`off | low | medium | high`) — normalized reasoning intensity
  - other keys are still forwarded as provider options for adapter-specific passthrough

Normalized adapter param behavior:

- `adapter.params.max_tokens` is normalized to provider option `maxTokens`
- `adapter.params.thinking.level` is normalized before provider mapping
- for `openrouter`, `thinking.level` currently maps to `reasoning` options:
  - `off` → `{ reasoning: { effort: none, enabled: false } }`
  - `low` / `medium` / `high` → `{ reasoning: { effort: <level>, enabled: true } }`
- unsupported normalized controls currently degrade as no-ops unless the underlying adapter implements a mapping

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

## Recovery config

Recovery config is validated and normalized by `server/lib/script-contract.cjs` (`validateRecoveryConfig(...)` / `normalizeRecoveryConfig(...)`).

Important runtime behavior:

- omitting `recovery:` is valid and falls back to repo defaults
- the default is **AI recovery disabled**
- AI recovery only runs for scripts that export `aiRecovery` metadata and only when YAML sets:
  - `recovery.ai.enabled: true`
  - `recovery.ai.adapter`
  - `recovery.ai.model`
- the current checked-in AI recovery re-entry surface is intentionally narrow: `repairInstructions` and `boundedContextSummary`

Current AI-recovery-capable lanes:

- `server/scripts/get-context/get-dialogue.cjs`
- `server/scripts/get-context/get-music.cjs`
- `server/scripts/process/video-chunks.cjs`
- `server/scripts/report/recommendation.cjs`

Canonical shape:

```yaml
recovery:
  deterministic:
    maxAttemptsPerFailure: 2
    maxRepeatedStrategyUsesPerFailure: 1

  ai:
    enabled: true
    lane: structured-output-repair
    adapter: openrouter
    model: openai/gpt-5.4
    temperature: 0
    timeoutMs: 45000

    attempts:
      maxPerFailure: 1
      maxPerScriptRun: 1
      maxPerPipelineRun: 3

    budgets:
      maxInputTokens: 12000
      maxOutputTokens: 2000
      maxTotalTokens: 14000
      maxCostUsd: 0.25

    context:
      maxSnippetChars: 8000
      maxRawRefs: 12
      includePromptRef: true
      includeLastInvalidOutput: true
      includeValidationSummary: true
      includeProviderMetadata: true

    reentry:
      mode: same-script-revised-input
      allowPromptPatch: true
      allowBoundedContextSummary: true
      allowSchemaPreservingInputPatch: true
      allowArtifactMutation: false
      allowBudgetMutation: false
      allowCrossScriptReroute: false

    hardFailCategories: [config, dependency, io]
    humanReviewCategories: [internal]

    capture:
      persistPrompt: true
      persistResponse: true
      persistDecision: true
      persistRawEvidenceRefs: true

  stopConditions:
    internalFailuresPerLineage: 2
    configFailuresPerLineage: 1
    dependencyFailuresPerLineage: 1
```

Minimal activation example:

```yaml
recovery:
  ai:
    enabled: true
    adapter: openrouter
    model: openai/gpt-5.4
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
  soulPath: "../cast/impatient-teenager/SOUL.md"
  goalPath: "../goals/video-ad-evaluation.md"
  variables:
    lenses: [patience, boredom, excitement]
```

---

## Audio Base64 budget & chunking (Phase1)

Phase1 audio scripts (`get-dialogue`, `get-music`) preflight the extracted WAV and estimate the **Base64 payload size**.

Chunking trigger:

- `estimatedBase64Bytes = 4 * ceil(rawBytes / 3)`
- if `estimatedBase64Bytes > (audio_base64_max_bytes * audio_base64_headroom_ratio)` → time-chunk and process sequentially

Config knobs:

```yaml
settings:
  # Encoded payload cap (Base64 bytes). Defaults to ~10MB.
  audio_base64_max_bytes: 10485760

  # Headroom under the cap (default 0.9). Helps avoid provider-side overhead/limits.
  audio_base64_headroom_ratio: 0.9
```

### Dialogue stitcher (required when chunking)

When dialogue chunking is triggered, `get-dialogue` performs a **required** final stitcher pass:

- Domain: `ai.dialogue_stitch`
- Text-only (no attachments)
- **OpenRouter-only** target chain recommended (with model fallbacks)

Example:

```yaml
ai:
  dialogue_stitch:
    targets:
      - adapter: { name: openrouter, model: openai/gpt-4.1 }
      - adapter: { name: openrouter, model: anthropic/claude-3.5-sonnet }
      - adapter: { name: openrouter, model: google/gemini-2.5-pro }
```

Stitcher output contract (JSON):

- `cleanedTranscript` (string)
- `auditTrail` (array)
- `debug` (object, refs/payloads)

### Raw artifacts + traceability

When `debug.captureRaw: true`, the scripts persist (best-effort):

- `phase1-gather-context/raw/ffmpeg/<script>/chunk-plan.json`
- extracted chunk WAVs under `phase1-gather-context/raw/ffmpeg/<script>/chunks/`
- dialogue stitcher I/O under `phase1-gather-context/raw/ai/dialogue-stitch/`:
  - `mechanical-transcript.txt`
  - `input.json`
  - `output.json`

And they emit `artifact.write` events in `_meta/events.jsonl` pointing to these files.

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

## Phase 3-only iteration (fast report debugging)

When iterating on **Phase 3** report scripts (metrics/recommendation/emotional-analysis/summary/final-report), you can skip Phase 1 + 2 entirely and reuse an existing run folder.

Only `server/scripts/report/recommendation.cjs` is a current Phase 3 AI lane. The other Phase 3 scripts are computed/aggregation/report-rendering steps and stay outside the validator-tool AI-lane contract.

Use:

- `configs/cod-test-phase3.yaml` — Phase 3 only, reuses `output/cod-test`

### Workflow

1) Run a full pipeline once (to generate Phase 1/2 artifacts):

```bash
node server/run-pipeline.cjs --config configs/cod-test.yaml --verbose
```

2) Iterate quickly on Phase 3 scripts:

```bash
node server/run-pipeline.cjs --config configs/cod-test-phase3.yaml --verbose
```

Notes:

- `asset.outputDir` intentionally points at an *existing* run folder (default `output/cod-test`).
- The orchestrator will **hydrate persisted artifacts** from that folder (prefers `artifacts-complete.json`, falls back to known phase outputs like `phase2-process/chunk-analysis.json`).
- If required artifacts are missing, the run fails early with a clear error and the expected file paths.

### Digital twin replay caveat (strict request matching)

In replay mode:

```bash
export DIGITAL_TWIN_MODE=replay
export DIGITAL_TWIN_PACK=...          # path to twin pack repo/dir (contains cassettes/)
export DIGITAL_TWIN_CASSETTE=...      # cassette id (filename without .json)
```

Digital twin replay performs **strict request matching** (stable hashing of request payloads). If you change *any* request content (prompt text/formatting, model params, tool variables, etc.), the request hash changes and replay may fail with a mismatch/cache-miss.

Fix options:

- switch to live mode (unset `DIGITAL_TWIN_MODE`, set `AI_API_KEY`), or
- record a new cassette (`DIGITAL_TWIN_MODE=record`), or
- keep the request stable and only change local post-processing.

---

## Recommended starting points

- `configs/cod-test.yaml` — “real” end-to-end config used as an acceptance gate
- `configs/cod-test-phase3.yaml` — Phase 3-only loop for fast report iteration (reuses an existing run folder)
- `configs/quick-test.yaml` — smaller/faster config for local iteration
