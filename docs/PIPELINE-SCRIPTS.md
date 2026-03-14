# Pipeline Scripts (Emotion Engine)

This doc is a **map** of the script modules under `server/scripts/`.

For how to run the repo, start with:

- `README.md` (canonical commands)
- `docs/CONFIG-GUIDE.md` (current YAML schema)
- `docs/UNIVERSAL-SCRIPT-RESULT-CONTRACT.md` (future-facing universal success/failure envelope contract)
- `docs/DETERMINISTIC-RECOVERY-FRAMEWORK.md` (shared deterministic recovery declaration + policy model)
- `docs/AI-RECOVERY-LANE-CONTRACT.md` (bounded AI recovery layer, failure package, result schema, and YAML policy)
- `docs/ROLLOUT-FAMILIES-AND-SIBLING-IMPACT.md` (current rollout-family map and sibling repo boundary for the unified contract)

---

## Directory structure

```text
server/scripts/
  get-context/    # Phase 1: gather_context
  process/        # Phase 2: process
  report/         # Phase 3: report
```

Current scripts (non-exhaustive):

- Phase 1 (`gather_context`)
  - `server/scripts/get-context/get-dialogue.cjs`
  - `server/scripts/get-context/get-music.cjs`
  - `server/scripts/get-context/get-metadata.cjs`

- Phase 2 (`process`)
  - `server/scripts/process/video-chunks.cjs`
  - `server/scripts/process/video-per-second.cjs`

- Phase 3 (`report`)
  - `server/scripts/report/metrics.cjs` *(computed; no live AI call)*
  - `server/scripts/report/recommendation.cjs` *(AI lane; validator-tool mediated final acceptance)*
  - `server/scripts/report/emotional-analysis.cjs` *(computed; no live AI call)*
  - `server/scripts/report/summary.cjs` *(aggregation; no live AI call)*
  - `server/scripts/report/final-report.cjs` *(rendering; no live AI call)*
  - `server/scripts/report/evaluation.cjs` (legacy combined report)

---

## How scripts are executed

Scripts are invoked by the orchestrator (`server/run-pipeline.cjs`) using a YAML config.

Canonical:

```bash
npm run pipeline -- --config configs/cod-test.yaml
```

Scripts are CommonJS modules that export a single async `run(input)` function:

```js
module.exports = { run };
```

The input is phase-dependent but generally includes:

- `assetPath`
- `outputDir`
- `config`
- `artifacts` (artifacts accumulated so far)

Some scripts also consume `tool_variables` (persona/goal/lenses, etc.).

---

## Observability + debug output

- Run timeline: `output/<run>/raw/_meta/events.jsonl`
- Raw AI/ffmpeg capture (when enabled): `output/<run>/phase*/raw/`
- Stored prompt payloads (referenced via `promptRef`): `output/<run>/raw/ai/_prompts/`

See `docs/DEBUG-CONFIG.md`.

---

## Digital twin (record/replay)

To run deterministically (no live calls), set:

- `DIGITAL_TWIN_MODE=replay`
- `DIGITAL_TWIN_PACK=...`
- `DIGITAL_TWIN_CASSETTE=...`

See `docs/COD-TEST-GOLDEN-RUN-CHECKLIST.md` for a working end-to-end replay flow.
