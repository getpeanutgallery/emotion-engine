# Update README + key docs to match current repo + polyrepo reality (cod-test / record / replay)

## Context
We’re using this repo as part of a polyrepo system (emotion-engine + `tools` + `ai-providers` + `digital-twin-router` + one or more twin-pack repos).

Doc drift is currently a source of wasted time:
- README and `docs/*` contain older assumptions (env var names/modes, output layout, script locations).
- “How to run cod-test / record / replay” needs to be consistent across:
  - this repo’s README
  - cod-test checklist
  - any sibling repo README(s) that reference emotion-engine

This issue is to refresh docs so a new contributor (or future-us) can run cod-test and golden record/replay without guesswork.

## Scope
Update **README.md** and any key supporting docs (at least those listed below) to reflect:

### Setup
- install instructions that match current lockfile tool (npm)
- required env vars:
  - `AI_API_KEY` for live calls
  - digital-twin env vars for replay/record
- polyrepo sibling expectations + where they live in `projects/peanut-gallery/*`

### Running `cod-test`
- exact command(s) to run the pipeline using `configs/cod-test.yaml`
- expected runtime behavior (phase folders, artifact names)

### Record / replay
- canonical record command (writes cassette into twin-pack)
- canonical replay command (no live calls)
- how to select pack + cassette id
- how to “promote” a new golden cassette (update twin-pack manifest default cassette id)

### Troubleshooting
- missing cassette
- wrong digital-twin mode values
- provider “no content” errors and where to look in raw captures
- ffmpeg/ffprobe issues
- config validation errors (common missing keys)

### Where outputs and cassettes live
- outputs: `output/<run-name>/...` including raw capture folders
- cassettes: twin-pack repo location (e.g., `projects/peanut-gallery/digital-twin-*/cassettes/*.json`) + manifest

## Acceptance Criteria
- README contains explicit sections:
  - **Setup**
  - **Running cod-test**
  - **Record / Replay (digital-twin)**
  - **Troubleshooting**
  - **Outputs & Cassettes locations**
- Commands in README are copy/paste runnable on a fresh clone (given correct API key / pack path).
- Digital-twin env var names + allowed modes match current `digital-twin-router` behavior (record/replay/off).
- Docs do not reference obsolete paths (e.g., old script locations) and do not instruct to use legacy CLIs unless intentionally supported.
- Any doc that remains intentionally stale is labeled clearly (or removed).

## Notes/Links
Docs to review/update for consistency:
- `README.md`
- `docs/COD-TEST-GOLDEN-RUN-CHECKLIST.md`
- `docs/CONFIG-GUIDE.md`
- `docs/DEBUG-CONFIG.md`
- `docs/PIPELINE-SCRIPTS.md`
- `docs/REPRO-SCRIPTS.md`

Polyrepo siblings to reference (as applicable):
- `projects/peanut-gallery/tools`
- `projects/peanut-gallery/ai-providers`
- `projects/peanut-gallery/digital-twin-router`
- twin packs (examples):
  - `projects/peanut-gallery/digital-twin-openrouter-emotion-engine`
  - other provider-specific twin packs as they’re added

Related canonical-ish plan doc (may become obsolete once README/docs are correct):
- `~/.openclaw/workspace/plans/peanut-gallery/emotion-engine/CANONICAL-PIPELINE-PLAYBOOK.md`
