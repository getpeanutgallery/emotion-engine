# Add Phase3-only cod-test config for fast iteration on report fixes

## Problem / motivation
When iterating on **Phase 3** report scripts (metrics/recommendation/emotional-analysis/summary/final-report), we currently have to re-run the full pipeline (Phase 1 + Phase 2) to regenerate the artifacts that Phase 3 reads.

This is slow and also noisy for debugging because it:
- re-extracts dialogue/music (Phase 1)
- re-runs video chunk analysis (Phase 2)
- potentially triggers additional AI calls and/or digital-twin replays that are unrelated to the Phase 3 fix

We want a **Phase3-only** config/workflow that:
- reuses an existing run folder containing Phase 1/2 artifacts (e.g. `output/cod-test`)
- runs only the Phase 3 scripts
- enables very fast “edit → run Phase 3 → inspect outputs” loops

---

## Proposal
Add a dedicated config, e.g.:
- `configs/cod-test-phase3.yaml`

Key design points:
- **Phase selection**
  - `gather_context: []`
  - `process: []`
  - `report:` includes the Phase 3 scripts
- **Reuse existing artifacts**
  - `asset.outputDir` points at an *existing* run folder that already contains Phase 1/2 outputs
  - Example: `asset.outputDir: output/cod-test`
  - `asset.inputPath` remains set (required by schema), but Phase 3 should not depend on it unless a report script explicitly needs it

### Suggested `configs/cod-test-phase3.yaml`

```yaml
# Phase3-only pipeline for iterating on report scripts using an existing run folder.

name: "COD Test Pipeline (Phase 3 only)"
description: "Run only Phase 3 report scripts using existing Phase 1/2 artifacts in output/cod-test"
version: "1.0"

asset:
  # Required by config validation. For Phase 3 runs, prefer keeping this identical to
  # the original run that produced output/cod-test to avoid confusion.
  inputPath: "examples/videos/emotion-tests/cod.mp4"

  # IMPORTANT: points at an existing run folder with Phase 1 + Phase 2 artifacts.
  # This is what makes Phase 3 fast.
  outputDir: "output/cod-test"

# No Phase 1/2 work in this config.
gather_context: []
process: []

# Phase 3 report scripts only.
report:
  - server/scripts/report/metrics.cjs
  - server/scripts/report/recommendation.cjs
  - server/scripts/report/emotional-analysis.cjs
  - server/scripts/report/summary.cjs
  - server/scripts/report/final-report.cjs

# Keep settings aligned with the original run where possible (especially if the
# report scripts rely on config-derived parameters).
settings:
  chunk_duration: 8
  max_chunks: 100
  api_request_delay: 500

debug:
  captureRaw: true

# AI config is still required by schema and may still be used by some phase3 scripts
# (notably recommendation). Keep it consistent with cod-test.yaml or specialize
# if desired.
ai:
  dialogue:
    targets:
      - adapter: { name: openrouter, model: google/gemini-3.1-flash-lite-preview }
  music:
    targets:
      - adapter: { name: openrouter, model: google/gemini-3.1-flash-lite-preview }
  video:
    targets:
      - adapter: { name: openrouter, model: google/gemini-3.1-pro-preview }

  # Optional: set explicit recommendation targets if we want Phase 3 to be fully
  # decoupled from other op target chains.
  # recommendation:
  #   targets:
  #     - adapter: { name: openrouter, model: google/gemini-3.1-pro-preview }
```

Notes:
- The `ai.*` section above is intentionally minimal; in practice we likely want to copy the full chains from `configs/cod-test.yaml`.
- If `recommendation.cjs` is the script under iteration and we want deterministic/offline runs, prefer **digital-twin replay** (see below).

---

## Digital twin interaction (replay mode pitfalls)
When using digital twin replay:

```bash
export DIGITAL_TWIN_MODE=replay
export DIGITAL_TWIN_PACK=...              # path to the twin pack repo/dir
export DIGITAL_TWIN_CASSETTE=...          # cassette id
```

The twin system performs **strict request matching** (stable hashing of the request payload). This is great for fast, deterministic iteration, but it has an important implication for Phase3-only runs:

- If a Phase 3 fix changes **any request content** (prompt text, prompt formatting, model params, tool variables, etc.), the replayed request hash can change.
- That causes a **replay cache miss / mismatch** (the cassette no longer contains that request), and the run will fail unless:
  - you switch to live mode (unset `DIGITAL_TWIN_MODE` / set to `off`), or
  - you record a new cassette (`DIGITAL_TWIN_MODE=record`), or
  - you keep the request stable and only change purely local post-processing code.

This should be explicitly documented near the Phase3-only workflow so it’s clear why a “Phase 3 only” run might suddenly start failing in replay mode after a prompt change.

---

## Workflow (intended)
1) Run the full pipeline once (or use an existing `output/cod-test` run) to produce Phase 1/2 artifacts.
2) Iterate quickly on Phase 3 scripts using:

```bash
node server/run-pipeline.cjs --config configs/cod-test-phase3.yaml --verbose
```

Expected behavior:
- Phase 1 scripts are not executed.
- Phase 2 scripts are not executed.
- Phase 3 scripts run and write outputs under `output/cod-test/phase3-report/...` (plus run-level `raw/_meta/events.jsonl`).

---

## Acceptance criteria
- A new config exists (e.g. `configs/cod-test-phase3.yaml`) that:
  - sets `gather_context: []`
  - sets `process: []`
  - sets `report:` to Phase 3 scripts
  - points `asset.outputDir` at an existing run folder (e.g. `output/cod-test`) with Phase 1/2 artifacts
- Running the pipeline with the Phase3-only config generates Phase 3 outputs **without rerunning Phase 1/2**.
- Documentation is updated to describe the Phase3-only workflow and the **digital twin replay mismatch** caveat when request payloads change.
