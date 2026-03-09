# Debug Configuration (Emotion Engine)

This doc covers the **debug/observability** knobs in the Emotion Engine pipeline.

If you want a runnable example, start with `configs/cod-test.yaml`.

---

## TL;DR

```yaml
debug:
  captureRaw: true                 # write raw AI/ffmpeg captures into phase*/raw/
  keepProcessedIntermediates: true # default (set false to auto-clean assets/processed)
  # captureRawEvents: true         # default (writes raw/_meta/events.jsonl)
```

---

## Debug keys

### `debug.captureRaw` (recommended when debugging)

When `true`, scripts write raw capture artifacts alongside their normal outputs.

What you get:

- AI request/response captures (sanitized)
- ffmpeg/ffprobe command logs
- tool version snapshots
- per-phase error logs (`errors.jsonl` + `errors.summary.json`)

Raw capture is **phase-scoped** (e.g. `phase2-process/raw/...`). See [Raw output layout](#raw-output-layout).

### `debug.keepProcessedIntermediates`

Controls whether intermediate extracted assets are kept under `assets/processed/`.

- Default: **keep** (so you can inspect extracted audio/chunks)
- Set to `false` to aggressively clean up processed intermediates after each script completes.

```yaml
debug:
  keepProcessedIntermediates: false
```

#### Backward-compatible aliases

The engine still reads older keys as aliases:

- `debug.keepProcessedFiles` (alias)
- `debug.keepTempFiles` (legacy alias)

If multiple are present, `keepProcessedIntermediates` wins.

### `debug.captureRawEvents` (run timeline)

The orchestrator maintains a run-level, append-only timeline at:

- `raw/_meta/events.jsonl`

This is **enabled by default**. You can explicitly disable emission with:

```yaml
debug:
  captureRawEvents: false
```

Note: the file is still created (empty) so tooling can rely on it existing.

---

## Output locations

### Processed intermediates (`assets/processed/`)

Intermediate files (audio extracts, chunks, etc.) are written under:

- `output/<run-name>/assets/processed/`

Common subfolders:

- `assets/processed/dialogue/` (e.g. `audio.wav`)
- `assets/processed/music/` (e.g. segment wav files)
- `assets/processed/chunks/` (e.g. `chunk-0.mp4`)

Retention is controlled by `debug.keepProcessedIntermediates`.

### Raw output layout

When `debug.captureRaw: true`, phase-scoped raw folders are populated:

```text
output/<run-name>/
  phase1-gather-context/raw/
  phase2-process/raw/
  phase3-report/raw/
```

Each phase raw directory typically contains:

```text
phaseX-.../raw/
  _meta/
    errors.jsonl
    errors.summary.json
  ai/
    ... (attempt-scoped capture payloads)
  ffmpeg/
    ... (ffmpeg/ffprobe logs)
  tools/_versions/
    ... (tool version snapshots)
```

### Run-level raw (`raw/`)

Independently of phase raw capture, the run also has a run-level `raw/` folder:

```text
output/<run-name>/raw/
  _meta/events.jsonl          # pipeline timeline (JSONL)
  ai/_prompts/<sha256>.json   # stored prompt payloads (when captureRaw is enabled)
```

When raw AI captures are written, they may include a `promptRef` like:

```json
{ "promptRef": { "sha256": "...", "file": "raw/ai/_prompts/<sha256>.json" } }
```

---

## Practical tips

- Prefer **digital-twin replay** when iterating on debug output (fast, deterministic):
  - `DIGITAL_TWIN_MODE=replay`
  - `DIGITAL_TWIN_PACK=...`
  - `DIGITAL_TWIN_CASSETTE=...`
- Use `npm run pipeline -- --config configs/cod-test.yaml --dry-run` to validate schema without running scripts.
