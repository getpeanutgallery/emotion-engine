---
plan_id: plan-2026-03-31-phase1-proof-compare-after-mimo-tranche2
bead_ids:
  - ee-jk3t
  - ee-exrj
  - ee-kh15
  - ee-h64p
---
# emotion-engine: Phase 1 proof/compare lane after MiMo tranche 2

**Date:** 2026-03-31  
**Status:** In Progress  
**Agent:** Cookie 🍪

---

## Goal

Run a bounded cod-test Phase 1 proof/compare lane that generates real additive Phase 1 artifacts for dialogue, music, and visual identity, then compares those outputs against the current chunked baseline so we can validate the new evidence architecture before starting a broader tranche 3.

---

## Overview

MiMo tranche 2 successfully proved the most important risky hypothesis: `emotion-engine` can execute a real Xiaomi-direct whole-video MiMo run using the staged S3 `video_url` and persist a valid `whole-video-analysis.json` artifact. In parallel, the additive Phase 1 lanes for dialogue, music, and visual identity were implemented and passed focused local verification. What is still missing is a real runtime proof packet for those new Phase 1 modes.

That gap matters because the current architecture direction is not just “use MiMo once for the whole video.” The real design is a hybrid system: whole-video MiMo can provide holistic judgment, while richer Phase 1 evidence lanes provide more structured metadata and stronger downstream reporting. Before we widen rollout or refactor further, we should verify that the additive Phase 1 modes produce sensible real artifacts on `cod-test`, preserve contract compatibility, and actually record the provenance/timing metadata we designed for them.

This lane should therefore stay bounded and proof-oriented. We are not trying to optimize benchmark score here. We are trying to prove that the new dialogue/music hybrid modes and the visual identity lane can run end-to-end on the real asset, emit artifacts with the expected additive metadata, and compare cleanly against the current chunked baseline. If the outputs are good, we will have a stronger foundation for a future tranche 3 that can decide how aggressively to fuse the old and new paths.

The canonical staged source asset remains:
- `https://gambit-games-tests.s3.us-east-1.amazonaws.com/peanut-gallery/cod.mp4`

---

## Tasks

### Task 1: Design the bounded cod-test Phase 1 proof config for hybrid dialogue/music + visual identity

**Bead ID:** `ee-jk3t`  
**SubAgent:** `primary`  
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, design the narrowest honest cod-test config for proving the additive Phase 1 lanes after MiMo tranche 2. The config should enable settings.phase1.dialogue.mode=hybrid, settings.phase1.music.mode=hybrid, and settings.phase1.visual_identity.enabled=true, while keeping the run bounded and comparison-friendly. Keep this as planning only. Define the config shape, scripts to run, expected output paths, and how it should stay comparable to the current chunked baseline. Claim bead <id> on start with bd update <id> --status in_progress --json and close it on completion with bd close <id> --reason "..." --json.`

**Folders Created/Deleted/Modified:**
- `.plans/`

**Files Created/Deleted/Modified:**
- `.plans/2026-03-31-phase1-proof-compare-after-mimo-tranche2.md`

**Status:** ✅ Complete

**Results:** Designed the narrowest honest follow-up config as a new future file `configs/cod-test-phase1-proof-compare-after-mimo-tranche2.yaml` (planning only; not created in this task). The recommended lane is gather-context only (`get-dialogue`, `get-music`, `get-visual-identity`) with no Phase 2/3 scripts, same cod asset + persona/goal as the existing bounded comparison lane, `settings.phase1.dialogue.mode: hybrid` with `timing_refinement: chunk_refine` so dialogue stays honestly hybrid and comparison-friendly, `settings.phase1.music.mode: hybrid`, and `settings.phase1.visual_identity.enabled: true` backed by a staged public S3 media ref plus `ai.video_identity` Xiaomi-direct target. The comparison anchor should be `output/cod-test-phase2-3chunk-comparison/phase1-gather-context/` for dialogue/music, because that is the existing bounded chunked baseline packet rather than a full broad rerun.

---

### Task 2: Implement the proof config and run the bounded Phase 1 proof lane

**Bead ID:** `ee-exrj`  
**SubAgent:** `coder`  
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, implement the bounded cod-test Phase 1 proof lane for the additive architecture. Add the new proof config, validate it, and run the smallest safe execution path that produces real dialogue-data.json, music-data.json, and visual-identity-data.json artifacts. Record exact commands, logs, and outputs. Claim bead <id> on start with bd update <id> --status in_progress --json and close it on completion with bd close <id> --reason "..." --json.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `configs/`
- `output/`
- `output/_archives/`
- `.logs/`

**Files Created/Deleted/Modified:**
- `.plans/2026-03-31-phase1-proof-compare-after-mimo-tranche2.md`
- `configs/cod-test-phase1-proof-compare-after-mimo-tranche2.yaml`
- `.logs/2026-04-01-cod-test-phase1-proof-compare-after-mimo-tranche2-dry-run.log`
- `.logs/2026-04-01-cod-test-phase1-proof-compare-after-mimo-tranche2-live.log`
- `.logs/2026-04-01-cod-test-phase1-proof-compare-after-mimo-tranche2-dry-run-xiaomi-recovery.log`
- `.logs/2026-04-01-cod-test-phase1-proof-compare-after-mimo-tranche2-live-xiaomi-recovery.log`
- `.logs/2026-04-01-cod-test-phase1-proof-compare-after-mimo-tranche2-dry-run-xiaomi-toolloop.log`
- `.logs/2026-04-01-cod-test-phase1-proof-compare-after-mimo-tranche2-live-xiaomi-toolloop.log`
- `output/cod-test-phase1-proof-compare-after-mimo-tranche2/**`
- `output/_archives/cod-test-phase1-proof-compare-after-mimo-tranche2-openrouter-invalid-url-20260401-1218/**`
- `output/_archives/cod-test-phase1-proof-compare-after-mimo-tranche2-xiaomi-toolloop-limit-20260401-1222/**`

**Status:** ⚠️ Partial / blocked

**Results:** Implemented `configs/cod-test-phase1-proof-compare-after-mimo-tranche2.yaml` and executed the required dry-run plus three bounded live attempts.

What actually happened:
- Initial config matched the Task 1 design closely: Phase 1 only (`get-dialogue`, `get-music`, `get-visual-identity`), canonical staged S3 `source_video`, hybrid dialogue/music, additive visual identity, bounded retries.
- Dry-run validation succeeded immediately.
- Live attempt 1 (OpenRouter for dialogue/music, Xiaomi for visual identity) failed in `get-dialogue` with `OpenRouter: Invalid URL` before any Phase 1 artifact completed.
- I preserved that partial run at `output/_archives/cod-test-phase1-proof-compare-after-mimo-tranche2-openrouter-invalid-url-20260401-1218/` and then made a truthful bounded recovery edit: dialogue/music/dialogue_stitch were switched to Xiaomi while keeping the same Phase 1-only lane and staged video ref.
- Dry-run validation succeeded again.
- Live attempt 2 failed in `get-dialogue` with `invalid_output: exceeded validate_dialogue_transcription_json tool-call limit`.
- I preserved that partial run at `output/_archives/cod-test-phase1-proof-compare-after-mimo-tranche2-xiaomi-toolloop-limit-20260401-1222/` and made one final bounded recovery edit by raising only the dialogue tool-loop ceiling to `maxTurns: 6` and `maxValidatorCalls: 5`.
- Dry-run validation succeeded a third time.
- Live attempt 3 still failed in `get-dialogue`, this time with `Xiaomi: timeout of 180000ms exceeded`.

Exact commands actually run:

```bash
bd update ee-exrj --status in_progress --json
npm run pipeline -- --config configs/cod-test-phase1-proof-compare-after-mimo-tranche2.yaml --dry-run --verbose \
  | tee .logs/2026-04-01-cod-test-phase1-proof-compare-after-mimo-tranche2-dry-run.log
npm run pipeline -- --config configs/cod-test-phase1-proof-compare-after-mimo-tranche2.yaml --verbose \
  | tee .logs/2026-04-01-cod-test-phase1-proof-compare-after-mimo-tranche2-live.log
mv output/cod-test-phase1-proof-compare-after-mimo-tranche2 \
  output/_archives/cod-test-phase1-proof-compare-after-mimo-tranche2-openrouter-invalid-url-20260401-1218
npm run pipeline -- --config configs/cod-test-phase1-proof-compare-after-mimo-tranche2.yaml --dry-run --verbose \
  | tee .logs/2026-04-01-cod-test-phase1-proof-compare-after-mimo-tranche2-dry-run-xiaomi-recovery.log
npm run pipeline -- --config configs/cod-test-phase1-proof-compare-after-mimo-tranche2.yaml --verbose \
  | tee .logs/2026-04-01-cod-test-phase1-proof-compare-after-mimo-tranche2-live-xiaomi-recovery.log
mv output/cod-test-phase1-proof-compare-after-mimo-tranche2 \
  output/_archives/cod-test-phase1-proof-compare-after-mimo-tranche2-xiaomi-toolloop-limit-20260401-1222
npm run pipeline -- --config configs/cod-test-phase1-proof-compare-after-mimo-tranche2.yaml --dry-run --verbose \
  | tee .logs/2026-04-01-cod-test-phase1-proof-compare-after-mimo-tranche2-dry-run-xiaomi-toolloop.log
npm run pipeline -- --config configs/cod-test-phase1-proof-compare-after-mimo-tranche2.yaml --verbose \
  | tee .logs/2026-04-01-cod-test-phase1-proof-compare-after-mimo-tranche2-live-xiaomi-toolloop.log
```

Durable diagnostics captured:
- `output/cod-test-phase1-proof-compare-after-mimo-tranche2/phase1-gather-context/script-results/get-dialogue.failure.json`
- `output/cod-test-phase1-proof-compare-after-mimo-tranche2/phase1-gather-context/raw/_meta/errors.summary.json`
- `output/cod-test-phase1-proof-compare-after-mimo-tranche2/phase1-gather-context/recovery/get-dialogue/next-action.json`

Actual artifact state after Task 2:
- Present:
  - `output/cod-test-phase1-proof-compare-after-mimo-tranche2/_meta/events.jsonl`
  - `output/cod-test-phase1-proof-compare-after-mimo-tranche2/assets/input/config.yaml`
  - `output/cod-test-phase1-proof-compare-after-mimo-tranche2/assets/processed/dialogue/audio.mp3`
  - `output/cod-test-phase1-proof-compare-after-mimo-tranche2/phase1-gather-context/script-results/get-dialogue.failure.json`
  - `output/cod-test-phase1-proof-compare-after-mimo-tranche2/phase1-gather-context/raw/...`
- Missing / not produced:
  - `output/cod-test-phase1-proof-compare-after-mimo-tranche2/phase1-gather-context/dialogue-data.json`
  - `output/cod-test-phase1-proof-compare-after-mimo-tranche2/phase1-gather-context/music-data.json`
  - `output/cod-test-phase1-proof-compare-after-mimo-tranche2/phase1-gather-context/visual-identity-data.json`

Bottom line: the proof config is real and dry-run-valid, but the live proof lane did **not** complete. The current blocker is Phase 1 dialogue runtime/provider behavior, not config schema shape or staged-video wiring.

---

### Task 3: Compare the new Phase 1 artifacts against the current chunked baseline

**Bead ID:** `ee-kh15`  
**SubAgent:** `research`  
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, compare the new bounded Phase 1 proof artifacts against the current chunked baseline outputs for cod-test. Focus on whether the additive metadata is present and sensible, whether provenance/timing/source strategy fields reflect reality, whether the new artifacts appear useful for stronger downstream reporting, and where the hybrid lanes clearly help or still need refinement. Produce a concise comparison note with concrete findings. Claim bead <id> on start with bd update <id> --status in_progress --json and close it on completion with bd close <id> --reason "..." --json.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- optional `docs/`
- `output/`

**Files Created/Deleted/Modified:**
- `.plans/2026-03-31-phase1-proof-compare-after-mimo-tranche2.md`
- optional comparison note path

**Status:** ⏳ Pending

**Results:** Pending.

---

### Task 4: Verify the proof lane, update handoff state, and recommend tranche 3 scope

**Bead ID:** `ee-h64p`  
**SubAgent:** `primary`  
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, verify the bounded Phase 1 proof/compare lane after implementation and comparison complete. Confirm key files/artifacts exist, summarize what is now proven versus still uncertain, update the plan with real results, and recommend the next tranche 3 scope. Claim bead <id> on start with bd update <id> --status in_progress --json and close it on completion with bd close <id> --reason "..." --json.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `output/`
- `.logs/`

**Files Created/Deleted/Modified:**
- `.plans/2026-03-31-phase1-proof-compare-after-mimo-tranche2.md`
- verification notes/log references to be determined

**Status:** ⏳ Pending

**Results:** Pending.

---

## Task 1 design outcome (planning)

### Planned config file

- `configs/cod-test-phase1-proof-compare-after-mimo-tranche2.yaml`

### Recommended config shape

```yaml
name: COD Test Phase 1 Proof Compare After MiMo Tranche 2
description: Bounded Phase 1-only proof lane for hybrid dialogue/music plus visual identity against the cod asset
version: '1.0'

asset:
  inputPath: examples/videos/emotion-tests/cod.mp4
  outputDir: output/cod-test-phase1-proof-compare-after-mimo-tranche2
  media:
    refs:
      source_video:
        kind: video
        source:
          path: examples/videos/emotion-tests/cod.mp4
        staged:
          url: https://gambit-games-tests.s3.us-east-1.amazonaws.com/peanut-gallery/cod.mp4
          urlType: public
        delivery:
          preferredMode: url
          allowedModes: [url]
          allowFallback: false
        metadata:
          mimeType: video/mp4

gather_context:
  - server/scripts/get-context/get-dialogue.cjs
  - server/scripts/get-context/get-music.cjs
  - server/scripts/get-context/get-visual-identity.cjs

process: []
report: []

settings:
  api_request_delay: 250
  audio_base64_max_bytes: 10485760
  audio_base64_headroom_ratio: 0.9
  ffmpeg:
    audio:
      loglevel: error
      codec: libmp3lame
      bitrate: 192k
      sample_rate_hz: 44100
      channels: 2
      container: mp3
    video:
      compress:
        vcodec: libx264
        preset: fast
        max_width: 1280
        fps: 24
        audio_codec: aac
        audio_bitrate: 128k
        size_headroom_ratio: 0.9
      compress_aggressive:
        vcodec: libx264
        preset: slow
        fps: 24
        audio_codec: aac
        audio_bitrate: 96k
        vf: scale='min(1280,iw)':-1:force_original_aspect_ratio=decrease
        maxrate_multiplier: 1.2
        bufsize_multiplier: 2
        size_headroom_ratio: 0.95
  phase1:
    dialogue:
      mode: hybrid
      timing_refinement: chunk_refine
      max_whole_asset_duration_seconds: 180
      fallback_to_chunked: true
      preserve_chunk_plan_metadata: true
    music:
      mode: hybrid
      max_whole_asset_duration_seconds: 180
      analysis_window_seconds: 30
      emit_global_arc: true
      fallback_to_chunked: true
    visual_identity:
      enabled: true

debug:
  captureRaw: true

recovery:
  deterministic:
    maxAttemptsPerFailure: 1
    maxRepeatedStrategyUsesPerFailure: 0

tool_variables:
  soulPath: ../cast/impatient-teenager/SOUL.md
  goalPath: ../goals/video-ad-evaluation.md
  variables:
    lenses:
      - patience
      - boredom
      - excitement

ai:
  dialogue:
    retry:
      maxAttempts: 1
      backoffMs: 0
    toolLoop:
      maxTurns: 3
      maxValidatorCalls: 2
    targets:
      - adapter:
          name: openrouter
          model: google/gemini-3.1-flash-lite-preview
          params:
            max_tokens: 25000
            thinking:
              level: low
  dialogue_stitch:
    targets:
      - adapter:
          name: openrouter
          model: openai/gpt-5.4
          params:
            max_tokens: 25000
            thinking:
              level: low
  music:
    retry:
      maxAttempts: 1
      backoffMs: 0
    toolLoop:
      maxTurns: 3
      maxValidatorCalls: 2
    targets:
      - adapter:
          name: openrouter
          model: google/gemini-3.1-flash-lite-preview
          params:
            max_tokens: 25000
            thinking:
              level: low
  video:
    targets:
      - adapter:
          name: xiaomi
          model: mimo-v2-omni
          params:
            max_tokens: 4000
            timeoutMs: 180000
            temperature: 0.2
            fps: 2
            media_resolution: default
  video_identity:
    retry:
      maxAttempts: 1
      backoffMs: 0
    toolLoop:
      maxTurns: 3
      maxValidatorCalls: 2
    inputRefs:
      - source_video
    targets:
      - adapter:
          name: xiaomi
          model: mimo-v2-omni
          params:
            max_tokens: 4000
            timeoutMs: 180000
            temperature: 0.2
            fps: 2
            media_resolution: default
```

### Scripts to run in Task 2

1. Validate just the planned proof lane shape:

```bash
npm run pipeline -- --config configs/cod-test-phase1-proof-compare-after-mimo-tranche2.yaml --dry-run --verbose
```

2. Execute the bounded proof lane and keep a durable run log:

```bash
npm run pipeline -- --config configs/cod-test-phase1-proof-compare-after-mimo-tranche2.yaml --verbose \
  | tee .logs/2026-03-31-cod-test-phase1-proof-compare-after-mimo-tranche2-live.log
```

3. Sanity-check the additive metadata packet after the run:

```bash
node - <<'NODE'
const fs = require('fs');
const base = 'output/cod-test-phase1-proof-compare-after-mimo-tranche2/phase1-gather-context';
for (const name of ['dialogue-data.json', 'music-data.json', 'visual-identity-data.json']) {
  const p = `${base}/${name}`;
  const json = JSON.parse(fs.readFileSync(p, 'utf8'));
  console.log(name, {
    analysisMode: json.analysisMode,
    timingMode: json.timingMode,
    sourceStrategy: json.sourceStrategy || json.provenance?.sourceStrategy || null,
    provenance: json.provenance
  });
}
NODE
```

### Expected output paths

Primary proof packet:
- `output/cod-test-phase1-proof-compare-after-mimo-tranche2/artifacts-complete.json`
- `output/cod-test-phase1-proof-compare-after-mimo-tranche2/phase1-gather-context/dialogue-data.json`
- `output/cod-test-phase1-proof-compare-after-mimo-tranche2/phase1-gather-context/music-data.json`
- `output/cod-test-phase1-proof-compare-after-mimo-tranche2/phase1-gather-context/visual-identity-data.json`

Comparison inputs / provenance support:
- `output/cod-test-phase1-proof-compare-after-mimo-tranche2/_meta/events.jsonl`
- `output/cod-test-phase1-proof-compare-after-mimo-tranche2/_meta/ai/_prompts/`
- `output/cod-test-phase1-proof-compare-after-mimo-tranche2/phase1-gather-context/raw/`
- `.logs/2026-03-31-cod-test-phase1-proof-compare-after-mimo-tranche2-live.log`

Chunked comparison anchor:
- `output/cod-test-phase2-3chunk-comparison/phase1-gather-context/dialogue-data.json`
- `output/cod-test-phase2-3chunk-comparison/phase1-gather-context/music-data.json`

### Why this stays bounded and comparison-friendly

- It is **Phase 1 only**: no `video-chunks`, `whole-video-mimo`, metrics, recommendation, or reporting fan-out.
- It uses the **same cod asset, soulPath, and goalPath** as the existing comparison lane, so artifact differences mostly reflect lane mode changes rather than scenario drift.
- Dialogue is set to **`hybrid` + `timing_refinement: chunk_refine`** so the final artifact should stay honestly `analysisMode: hybrid` while still preserving chunk-local timing comparability against the current chunked transcript baseline.
- Music is set to **`hybrid`** with a pinned `analysis_window_seconds: 30`, so it keeps whole-asset arc context but still emits comparison-friendly segments instead of only a broad trailer summary.
- Visual identity is added as a **new additive artifact only**; it should be judged for presence/provenance/utility, not forced into a fake chunked equivalence because no legacy `visualIdentityData` baseline exists.
- The lane keeps **single-target / single-attempt** execution where practical, with small validator-tool limits, so the proof packet reflects one bounded real run instead of a broad retry-optimization sweep.
- The comparison baseline should come from **`output/cod-test-phase2-3chunk-comparison/phase1-gather-context/`**, not a fresh full cod-test rerun, because that is already the repo’s bounded chunked comparison packet.
- Keep `settings.phase1.visual_identity.enabled: true` in the config for declarative symmetry, but note that the **actual runtime gate today is still inclusion of `server/scripts/get-context/get-visual-identity.cjs` in `gather_context` plus a configured `ai.video_identity`/`ai.video` target**.

## Recommended execution order

1. Design the narrow proof config
2. Run the bounded proof lane
3. Compare new artifacts vs chunked baseline
4. Verify + write the next handoff

---

## Success criteria

- A bounded cod-test proof run produces real:
  - `dialogue-data.json`
  - `music-data.json`
  - `visual-identity-data.json`
- The additive metadata is present and meaningful:
  - `analysisMode`
  - `timingMode`
  - `sourceStrategy`
  - `provenance`
  - lane-specific additive fields like `qualityNotes` / `globalArc` where expected
- Existing artifact consumers remain compatible
- We end with a clear recommendation for whether tranche 3 should focus on:
  - deeper MiMo fusion,
  - Phase 3/reporting integration,
  - benchmark comparison,
  - or further Phase 1 refinement

---

## References

- Tranche 2 implementation: `.plans/2026-03-31-mimo-tranche2-xiaomi-and-phase1.md`
- Tranche 1 implementation: `.plans/2026-03-31-mimo-tranche1-implementation.md`
- Xiaomi provider design: `docs/design/2026-03-31-xiaomi-direct-provider-support.md`
- Phase 1 expansion design: `docs/phase1-non-chunked-and-visual-identity-plan-2026-03-31.md`
- Whole-video MiMo design: `docs/design/mimo-whole-video-phase2-prototype-2026-03-31.md`
- Canonical staged asset: `https://gambit-games-tests.s3.us-east-1.amazonaws.com/peanut-gallery/cod.mp4`

---

## Final Results

**Status:** ⚠️ Partial

**What We Built:** The bounded Phase 1 proof config now exists at `configs/cod-test-phase1-proof-compare-after-mimo-tranche2.yaml`, uses the canonical staged cod video URL, and validates cleanly in dry-run mode. Task 2 also produced durable evidence/logging for three real bounded live attempts, but the live proof packet is still blocked in `get-dialogue` and therefore did not produce the required final Phase 1 JSON artifacts.

**Commits:**
- Pending

**Lessons Learned:** Dry-run success confirmed the config/schema path, but real execution exposed runtime/provider instability in the dialogue lane: OpenRouter transport is misconfigured (`Invalid URL`) in this environment, and Xiaomi did not complete the dialogue tool loop within the current bounded settings. Before Task 3 can compare artifacts, Derrick will likely need either a working OpenRouter base URL/runtime fix or a more reliable direct-provider path for Phase 1 dialogue.
