# Pre-golden: audit Phase1/2/3 scripts + helpers vs repo reality (cod-test / record / replay)

## Context
Golden runs (and subsequent determinism replays) are currently gated as much by **repo plumbing correctness** as by model/provider quality.

We have multiple “entrypoints” and doc surfaces (npm scripts, `bin/`, `server/run-pipeline.cjs`, docs, plans) and it’s easy for paths/config keys/output expectations to drift. When they drift, we get avoidable failures when running:
- `cod-test`
- digital-twin **record** (writing cassettes)
- digital-twin **replay** (consuming cassettes deterministically)

This issue is a structured audit to ensure Phase 1/2/3 scripts and their helpers match the current repository and polyrepo reality.

## Scope
Audit (read + run quick validations) across:

### Entrypoints / CLIs
- `package.json` scripts (especially `npm run pipeline`)
- `bin/run-pipeline.js` (what `npm exec emotion-engine` hits)
- any legacy/alternate CLI (`bin/run-analysis.js`) → confirm status: remove, fix, or clearly mark legacy

### Orchestrator + phase runners
- `server/run-pipeline.cjs` orchestrator flags and defaults
- phase runner shims:
  - `server/lib/phases/gather-context-runner.cjs`
  - `server/lib/phases/process-runner.cjs`
  - `server/lib/phases/report-runner.cjs`

### Phase scripts (actual work)
- Phase 1:
  - `server/scripts/get-context/get-dialogue.cjs`
  - `server/scripts/get-context/get-music.cjs`
- Phase 2:
  - `server/scripts/process/video-chunks.cjs`
  - `server/scripts/process/video-per-second.cjs`
- Phase 3:
  - `server/scripts/report/*` (metrics/summary/recommendation/final-report/etc)

### Helpers that commonly drift
- config loader + schema validation paths/keys (e.g., `configs/*.yaml`, `configs/cod-test.yaml`)
- debug/raw capture paths + naming conventions
- output directory layout assumptions (phase folders + artifacts)
- digital-twin env vars + router wiring (record/replay/off)

## Acceptance Criteria
- **Single canonical run command** exists (and is validated):
  - `npm run pipeline -- --config configs/cod-test.yaml` works in both record + replay contexts.
- `npm exec emotion-engine -- --config ...` and `npm run pipeline -- --config ...` are either:
  - both supported and equivalent, or
  - one is explicitly deprecated with clear messaging.
- `configs/cod-test.yaml` (and any referenced configs) use **current** key names for:
  - phase enablement
  - model/provider/adapter selection
  - split/chunk strategy knobs
  - debug flags (captureRaw / keepProcessedIntermediates etc)
- Output structure is stable and matches docs:
  - phase folders exist as expected
  - artifacts are written where downstream phases read them
  - raw capture folders match current “raw v2” semantics
- Digital-twin modes/vars used by scripts match reality:
  - `DIGITAL_TWIN_MODE` values (record/replay/off)
  - `DIGITAL_TWIN_PACK` points at the **twin-pack repo root** (contains `manifest.json`)
  - `DIGITAL_TWIN_CASSETTE` matches a real cassette id/file in that pack
- Documented failure modes (missing cassette, missing key, ffmpeg issues) have an unambiguous fix path.

## Notes/Links
- Files to audit in this repo:
  - `server/run-pipeline.cjs`
  - `server/lib/phases/*-runner.cjs`
  - `server/scripts/**`
  - `configs/cod-test.yaml`
  - `.env.example`
  - `README.md`
  - `docs/PIPELINE-SCRIPTS.md` (likely stale; see related README/docs issue)
- Related docs:
  - `docs/COD-TEST-GOLDEN-RUN-CHECKLIST.md`
  - `docs/DEBUG-CONFIG.md`
  - `docs/CONFIG-GUIDE.md`
- Related plan (for context, not canon):
  - `~/.openclaw/workspace/plans/emotion-engine/2026-03-09-pre-golden-run-hygiene-issues-and-plans-scan.md`
