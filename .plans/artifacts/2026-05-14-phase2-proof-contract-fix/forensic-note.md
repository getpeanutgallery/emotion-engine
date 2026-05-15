# Phase 2 proof-lane forensic note

**Date:** 2026-05-14  
**Bead:** `ee-p44s`  
**Scope:** Determine where the canonical `cod-test` full-run lane drifted away from the intended `chunk-analysis` proof surface, without implementing fixes.

## Executive finding

The drift is now concrete and narrow:

- **The intended proof surface is still `chunk-analysis`.**
- **The current canonical full-run config (`configs/cod-test.yaml`) no longer runs that surface.** It runs `server/scripts/process/whole-video-mimo.cjs`, which only emits `phase2-process/whole-video-analysis.json`.
- **The benchmark and downstream proof-review contract still correctly require `phase2-process/chunk-analysis.json`.**

So the canonical lane is internally contradictory: the config routes Phase 2 through the whole-video prototype, while the benchmark/report proof contract still expects the long-standing chunk-analysis artifact.

## Evidence

### 1) Current canonical config points at the wrong Phase 2 script for proof

`configs/cod-test.yaml` currently declares:

```yaml
process:
- server/scripts/process/whole-video-mimo.cjs
```

That script describes itself as:

> "Whole-video MiMo Phase 2 prototype"  
> "Side-path only: preserves the existing chunked Phase 2 lane"

And it writes only:

- `phase2-process/whole-video-analysis.json`

It returns `primaryArtifactKey: 'wholeVideoAnalysis'`, not `chunkAnalysis`.

### 2) Current benchmark contract still correctly requires chunk-analysis

`benchmarks/fixtures/cod-test/benchmark.json` currently requires:

- `artifactKey: "chunkAnalysis"`
- `script: "video-chunks"`
- `output.path: "phase2-process/chunk-analysis.json"`
- `truth.path: "truth/chunk-analysis.json"`

This matches Derrick's clarification and the historical proof surface.

### 3) Fresh rerun failure is exactly the config/benchmark mismatch

The 2026-05-14 rerun summary records:

- Phase 2 executed from `configs/cod-test.yaml`
- Phase 2 produced `phase2-process/whole-video-analysis.json`
- It did **not** produce `phase2-process/chunk-analysis.json`
- Benchmark then failed with:

```text
Produced artifact missing for chunkAnalysis: /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/output/cod-test/phase2-process/chunk-analysis.json
```

So the failure is not ambiguous runtime noise; it is a direct proof-contract mismatch.

### 4) Recent successful proof history still points to chunk-analysis as canonical

Two independent historical references align:

- `/home/derrick/.openclaw/workspace/memory/2026-03-16.md`
  - records a successful full `cod-test` rerun where:
    - `output/cod-test/phase2-process/chunk-analysis.json` regenerated truthfully
- `/home/derrick/.openclaw/workspace/memory/2026-05-13.md`
  - records the successful full thought-contract rerun at:
    - `output/cod-test-phase2-full-thought-rerun-2026-05-13/phase2-process/chunk-analysis.json`

The required artifact from that May 13 rerun is present and valid:

- `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/output/cod-test-phase2-full-thought-rerun-2026-05-13/phase2-process/chunk-analysis.json`

This is the strongest proof that the intended full-run review lane remained chunk-analysis even after the thought/continuity contract work.

### 5) The repo already documented this mismatch before today

The archived 2026-05-06 retest plan explicitly says the current canonical full-run config `configs/cod-test.yaml` is **not** the right direct entrypoint because it runs `whole-video-mimo.cjs`, not `video-chunks.cjs`.

That means the contradiction was already known operationally, but it remained unresolved at the canonical config surface.

## Drift timeline

### Stable canonical proof lane

- `5a5d28f` (`Ship cod-test benchmark system and retire per-second pipeline`)
  - `configs/cod-test.yaml` used:
    - `process: server/scripts/process/video-chunks.cjs`
  - benchmark required `chunkAnalysis`

- 2026-03-16 successful full rerun
  - regenerated `output/cod-test/phase2-process/chunk-analysis.json`

- 2026-05-13 successful full rerun
  - regenerated `output/.../phase2-process/chunk-analysis.json`

### First drift point: canonical config switched to whole-video prototype

- `3a28409` (`feat: align cod whole-video pipeline with index-only context`)
  - changed `configs/cod-test.yaml` from:
    - `server/scripts/process/video-chunks.cjs`
  - to:
    - `server/scripts/process/whole-video-mimo.cjs`
  - and **simultaneously removed** the `chunkAnalysis` benchmark entry from `benchmarks/fixtures/cod-test/benchmark.json`

That commit created a self-consistent whole-video experiment lane, but it moved the canonical `cod-test` config off the historical chunk-analysis proof surface.

### Second drift point: benchmark restored, config not restored

- `429d95f` (`Restore cod-test chunk benchmark lane`)
  - restored the benchmark requirement for:
    - `phase2-process/chunk-analysis.json`
    - script `video-chunks`
  - **did not** switch `configs/cod-test.yaml` back from `whole-video-mimo.cjs`

This is the likely decisive drift point that produced today's contradiction. From that moment forward:

- benchmark truth said `chunk-analysis`
- canonical full-run config still ran `whole-video-mimo`

Everything after that inherited the mismatch.

## Script/runner/report contract edges

### Canonical proof contract edge

The benchmark surface is the authoritative proof consumer here:

- `chunkAnalysis` is required
- expected path is `phase2-process/chunk-analysis.json`
- expected Phase 2 script identity is `video-chunks`

### Whole-video script edge

`server/scripts/process/whole-video-mimo.cjs` is not a drop-in replacement for proof purposes because it emits:

- `wholeVideoAnalysis`
- `phase2-process/whole-video-analysis.json`

It does **not** emit `chunkAnalysis` or a compatibility shim artifact.

### Report edge

Phase 3 reports are also chunk-analysis-oriented. For example `server/scripts/report/metrics.cjs` marks whole-video-only runs as:

- `state: "not_applicable"`
- `reason: "Chunk-derived timeline metrics were skipped because this run produced wholeVideoAnalysis without chunkAnalysis timeseries data."`

So even where Phase 3 can technically run, whole-video is still not the canonical proof surface for the current reporting/benchmark stack.

## Intended canonical Phase 2 surface

Based on repo history, benchmark truth, recent successful rerun history, and Derrick's clarification, the intended canonical full-run proof surface is:

- config: `configs/cod-test.yaml`
- Phase 2 script: `server/scripts/process/video-chunks.cjs`
- primary Phase 2 artifact: `phase2-process/chunk-analysis.json`
- benchmark artifact under review: `benchmarks/fixtures/cod-test/truth/chunk-analysis.json`
- downstream Phase 3 proof consumers: metrics / recommendation / emotional-analysis / summary / final-report, all fed from `chunkAnalysis`

Whole-video should remain a separate experimental/test lane, not the canonical `cod-test` proof lane.

## Recommended narrow fix path

### Files that should change

1. **`/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/configs/cod-test.yaml`**
   - restore canonical Phase 2 `process:` from `server/scripts/process/whole-video-mimo.cjs`
   - back to `server/scripts/process/video-chunks.cjs`

### Files that may change only if Derrick wants the whole-video experiment preserved in an active non-archive config

2. **Optional: add or rename a separate non-canonical whole-video config**
   - only if needed for convenience
   - for example, a dedicated `cod-test-whole-video-*.yaml` lane
   - this should be additive, not a benchmark-contract rewrite

### Files that should **not** be changed for this fix

- `benchmarks/fixtures/cod-test/benchmark.json`
  - already matches the intended proof surface
- `server/scripts/process/video-chunks.cjs`
  - already produces the required proof artifact
- `server/scripts/process/whole-video-mimo.cjs`
  - still useful as a side/test lane
- report scripts (`metrics.cjs`, `recommendation.cjs`, `summary.cjs`, `final-report.cjs`, `emotional-analysis.cjs`)
  - they are correctly reflecting current chunk-analysis-oriented proof assumptions

## Bottom line

The canonical lane drifted in two steps, but the **actionable** drift is narrow:

1. `configs/cod-test.yaml` was moved to the whole-video prototype in `3a28409`.
2. The chunk-analysis benchmark contract was later restored in `429d95f` without restoring the config.

That left the canonical full-run lane split across two incompatible truths. The smallest honest repair is to restore `configs/cod-test.yaml` to `video-chunks.cjs` and keep whole-video as a non-canonical experimental config.