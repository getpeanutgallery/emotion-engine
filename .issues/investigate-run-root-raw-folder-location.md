# Issue: Investigate run-root `raw/` folder location + propose clearer structure

## Observation

We currently create a **run-root** raw directory:

- `output/<runId>/raw/` (example: `output/cod-test/raw/`)

Contents observed in a recent run:

- `output/<runId>/raw/_meta/events.jsonl`
- `output/<runId>/raw/ai/_prompts/<sha256>.json`

This exists **in addition** to the phase-scoped raw folders:

- `output/<runId>/phase1-gather-context/raw/...`
- `output/<runId>/phase2-process/raw/...`
- `output/<runId>/phase3-report/raw/...`

Docs also describe this run-level raw folder:

- `README.md` → “Output layout”
- `docs/DEBUG-CONFIG.md` → “Run-level raw (`raw/`)”

## Concern / Problem

The run-root `raw/` folder is ambiguous:

- It’s not under `assets/` (which reads like “input/processed assets”).
- It’s not clearly “metadata” either, yet it contains timeline + prompt store.
- We already have **phase** raw folders; having an additional **run** raw folder can make it unclear where “raw” data should live.

This can create confusion for:

- humans browsing outputs
- tooling that expects raw artifacts to be phase-scoped
- docs/pointers that hardcode `raw/...` paths

The run-root artifacts may be better placed under a clearer namespace like:

- `output/<runId>/_meta/...`
- `output/<runId>/_debug/...`
- `output/<runId>/metadata/...`

(or similar), while keeping phase-scoped raw captures where they are.

## Investigation (what writes `output/<runId>/raw/` today?)

### Code paths

1) **Run timeline** (`events.jsonl`)

- Writer: `server/lib/events-timeline.cjs`
- Path: `path.join(runOutputDir, 'raw', '_meta', 'events.jsonl')`
- Behavior:
  - default ON (config key: `debug.captureRawEvents`)
  - **file is always created** (even if emission disabled) so tooling can rely on it

2) **Prompt payload store** (`ai/_prompts/<sha>.json`)

- Writer: `server/lib/prompt-store.cjs`
- Path: `path.join(runOutputDir, 'raw', 'ai', '_prompts')`
- Used from scripts when `debug.captureRaw` is enabled (e.g. `get-dialogue`, `get-music`, `video-chunks`, `recommendation`).
- Attempt captures reference these via:
  - `promptRef.file = 'raw/ai/_prompts/<sha256>.json'`

### What data is there?

- `raw/_meta/events.jsonl`
  - append-only pipeline timeline
  - includes `artifact.write` events pointing to per-phase outputs and raw captures
- `raw/ai/_prompts/*.json`
  - prompt payload dedupe store
  - referenced by attempt captures (to avoid duplicating full prompt text per attempt)

### Where is it referenced?

- Docs:
  - `README.md`, `docs/DEBUG-CONFIG.md`, `docs/PIPELINE-SCRIPTS.md`, `docs/CONFIG-GUIDE.md`
- Issue templates / troubleshooting docs already reference `output/<run>/raw/_meta/events.jsonl`
- Capture payload pointers embed `promptRef.file` with a `raw/ai/_prompts/...` prefix (so path changes have ripple effects).

## Alternatives / Proposed structures to evaluate

### Option A (recommended candidate): top-level `_meta/` instead of run-root `raw/`

Move run-level artifacts to:

- `output/<runId>/_meta/events.jsonl`
- `output/<runId>/_meta/ai/_prompts/<sha256>.json`

Pros:

- makes “run metadata” explicit
- reduces ambiguity vs phase `raw/`
- keeps phase raw captures unchanged

Cons / migration:

- must update:
  - `server/lib/events-timeline.cjs`
  - `server/lib/prompt-store.cjs`
  - all docs referencing `raw/_meta/events.jsonl`
  - any tooling/greps expecting `output/*/raw/_meta/...`
  - `promptRef.file` canonical prefix (and any validators)

Compatibility idea:

- allow **reading** both `raw/ai/_prompts/*` and `_meta/ai/_prompts/*` for a transition window
- optionally write to the new location but accept old `promptRef.file` prefixes

### Option B: keep `raw/`, but rename the run-level folder to `_debug/` or `debug/`

- `output/<runId>/_debug/events.jsonl`
- `output/<runId>/_debug/ai/_prompts/...`

Pros: emphasizes “debug/observability” (not core outputs)

Cons: same migration/pointer impacts as Option A

### Option C: keep run-root `raw/`, but make semantics explicit

- keep `output/<runId>/raw/` but rename subfolders:
  - `raw/_meta/events.jsonl` → maybe `raw/_run/events.jsonl` or `raw/run/_meta/events.jsonl`

Pros: lowest churn

Cons: still leaves a confusing `raw/` at run-root (esp. given phase raw already exists)

## Migration impact checklist

If we change the canonical location, we need a plan for:

- docs updates:
  - `README.md`, `docs/DEBUG-CONFIG.md`, `docs/PIPELINE-SCRIPTS.md`, `docs/CONFIG-GUIDE.md`
- code updates:
  - writers: `events-timeline.cjs`, `prompt-store.cjs`
  - readers/validators: `loadPromptPayload` currently requires `promptRef.file` to start with `raw/ai/_prompts/`
- backwards compatibility:
  - existing outputs on disk
  - existing `promptRef.file` values in recorded captures
  - any tests/fixtures that rely on old paths

## Acceptance criteria

- [ ] Decision: **canonical location** for run-level timeline + prompt store (keep `raw/` vs move to `_meta/` / `_debug/`)
- [ ] Concrete folder layout documented (run-level vs phase-level responsibilities)
- [ ] Migration plan written down:
  - [ ] whether we support dual-read / dual-write, and for how long
  - [ ] doc updates list
  - [ ] impact on `promptRef.file` values and how we keep replay/fixtures working
- [ ] (Optional) Implementation ticket(s) created for the chosen approach
