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


## Audit results (2026-03-09)

### Audited inventory (repo reality)

#### Entrypoints / CLIs
- [x] `package.json` scripts
  - [x] `npm run pipeline` → `node server/run-pipeline.cjs`
  - [x] `npm test` (Node’s built-in test runner)
  - [x] `npm run test:providers:check` (digital-twin cassette preflight)
  - [x] `npm run test:validate-json`
  - [x] `npm run validate-configs` (YAML parse check; added)
- [x] `bin/run-pipeline.js` (the `emotion-engine` bin; forwards to `server/run-pipeline.cjs`)
- [x] `bin/run-analysis.js` (legacy; now hard-deprecated to avoid footguns)

#### Orchestrator + phase runners
- [x] `server/run-pipeline.cjs`
- [x] `server/lib/phases/gather-context-runner.cjs`
- [x] `server/lib/phases/process-runner.cjs`
- [x] `server/lib/phases/report-runner.cjs`

#### Phase scripts
- [x] Phase 1 (gather-context)
  - [x] `server/scripts/get-context/get-dialogue.cjs`
  - [x] `server/scripts/get-context/get-music.cjs`
  - [x] `server/scripts/get-context/get-metadata.cjs` (added; supports metadata-extract config)
- [x] Phase 2 (process)
  - [x] `server/scripts/process/video-chunks.cjs`
  - [x] `server/scripts/process/video-per-second.cjs`
- [x] Phase 3 (report)
  - [x] `server/scripts/report/metrics.cjs`
  - [x] `server/scripts/report/recommendation.cjs`
  - [x] `server/scripts/report/emotional-analysis.cjs`
  - [x] `server/scripts/report/summary.cjs`
  - [x] `server/scripts/report/final-report.cjs`
  - [x] `server/scripts/report/evaluation.cjs` (legacy wrapper)

#### Helpers that commonly drift
- [x] Config parsing + schema validation: `server/lib/config-loader.cjs`
- [x] CLI flags: `server/lib/cli-parser.cjs`
- [x] Output layout + raw capture: `server/lib/output-manager.cjs`, `server/lib/raw-capture.cjs`
- [x] Digital-twin preflight (tests): `test/helpers/digital-twin-preflight.cjs`
- [x] Example env vars: `.env.example`

---

### Canonical commands (as-of audit)

#### Validate configs
- YAML parsing (single-document; fast):

```bash
npm run validate-configs
```

- Pipeline schema validation (recommended; runs config-loader validation):

```bash
npm run pipeline -- --config configs/cod-test.yaml --dry-run
# equivalent:
# npm exec emotion-engine -- --config configs/cod-test.yaml --dry-run
```

#### Dry-run cod-test

```bash
npm run pipeline -- --config configs/cod-test.yaml --dry-run
```

#### Replay (deterministic)

```bash
export DIGITAL_TWIN_MODE=replay
export DIGITAL_TWIN_PACK="$(pwd)/../digital-twin-openrouter-emotion-engine"
export DIGITAL_TWIN_CASSETTE=<cassette-name>

npm run pipeline -- --config configs/cod-test.yaml
```

#### Record (captures a cassette; requires live API access)

```bash
export DIGITAL_TWIN_MODE=record
export DIGITAL_TWIN_PACK="$(pwd)/../digital-twin-openrouter-emotion-engine"
export DIGITAL_TWIN_CASSETTE="cod-full-pipeline-$(date +%Y%m%d-%H%M%S)"
export AI_API_KEY=...   # or via .env

npm run pipeline -- --config configs/cod-test.yaml
```

#### Unit tests

```bash
npm test
```

Related helpers:

```bash
npm run test:validate-json
npm run test:providers:check
```

---

### Mismatches found (and status)

#### Fixed in this kickoff
- `validate-configs.cjs` previously used `yaml.loadAll()` (multi-doc YAML) which *did not* match the pipeline loader (`yaml.load()` single-doc). Updated to match repo reality.
- Added `npm run validate-configs` to `package.json` so the parse check is discoverable.
- `bin/run-analysis.js` referenced `../lib/persona-resolver.cjs` (missing) and docs referenced a `--config` flag it did not support. Replaced with a clear hard-deprecation message pointing to the canonical pipeline entrypoints.
- `docs/DEBUG-CONFIG.md` and `test-debug-config.cjs` referenced `bin/run-analysis.js` and old output paths. Updated to use `npm run pipeline` and run-level `assets/processed/...` folders.
- Multiple configs referenced `scripts/...` paths that do not exist in this repo. Normalized configs to `server/scripts/...` and removed references to unimplemented scripts (brand/OCR/graphs/assets/dialogue-summary/audio-segments).
- `configs/metadata-extract.yaml` referenced a missing `get-metadata` script; implemented `server/scripts/get-context/get-metadata.cjs` to make it real.
- README note incorrectly claimed `package.json#bin` was legacy/incomplete; clarified that only `bin/run-analysis.js` is legacy and `npm exec emotion-engine` is supported.

#### Still outstanding / follow-ups
- `docs/CONFIG-GUIDE.md` is substantially stale:
  - refers to `scripts/...` paths (should be `server/scripts/...`)
  - documents old AI schema (`ai.provider`, per-op `.model`) which is now forbidden by `server/lib/config-loader.cjs` (expects per-domain `targets[*].adapter.{name,model}`)
  - documents old debug folder semantics (timestamped processed assets) vs current run-level `assets/processed/...`.
- Digital-twin acceptance language drift:
  - issue AC mentions `DIGITAL_TWIN_PACK` contains `manifest.json`, but current test fixtures/packs do not include one and preflight expects `$PACK/cassettes/$CASSETTE.json`.
  - `.env.example` mentions `passthrough`; scripts generally only special-case `DIGITAL_TWIN_MODE=replay` (live-call gating). Consider documenting the effective modes used here: `replay` vs everything-else.
- Some docs (e.g., COD checklist) still claim `AI_API_KEY` is required in replay; in current scripts it is *not* required when `DIGITAL_TWIN_MODE=replay`.
