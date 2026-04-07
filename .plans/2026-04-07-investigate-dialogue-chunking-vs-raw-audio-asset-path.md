# emotion-engine: investigate dialogue chunking vs raw-audio asset path

**Date:** 2026-04-07  
**Status:** Complete  
**Agent:** Cookie 🍪

---

## Goal

Investigate whether the current cod-test dialogue chunking path is causing regressions and determine whether the engine should support a staged raw-audio asset path alongside the existing optimized video asset.

---

## Overview

The current dialogue validation rerun surfaced a provider-side multimodal 400 on a chunked dialogue request. Derrick wants to investigate whether chunking itself is part of the problem, whether increasing time-per-chunk could effectively simulate a whole-asset path, and whether a cleaner long-term option would be to stage/upload raw audio directly so the dialogue lane can consume a dedicated audio asset instead of relying only on the raw source video and optimized video delivery path.

This lane should first trace the exact chunking decision path for dialogue in `cod-test`: how chunk durations are chosen, why the current failing chunk landed where it did, what config and code paths are active, and whether the current behavior represents a regression. Then it should inspect the current asset/media plumbing to see whether raw audio can already be staged as a first-class asset or whether that capability would need new config/runtime support.

The output should leave behind a grounded recommendation comparing near-term options (bigger chunks / simulate whole-asset behavior / disable chunking if possible) versus longer-term support for a raw-audio asset path.

---

## Tasks

### Task 1: Trace the exact dialogue chunking path in cod-test and assess regression risk

**Bead ID:** `ee-qgbl`  
**SubAgent:** `research`  
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, trace the exact dialogue chunking decision path for cod-test. Identify how get-dialogue chooses chunking, what config fields control it, why the current chunk boundaries land where they do, and whether the current behavior looks like a regression relative to the intended design. Update this plan truthfully with the exact code/config path and findings. Claim the assigned bead at start with bd update <ID> --status in_progress --json and close it on completion with bd close <ID> --reason "Dialogue chunking path traced" --json.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `configs/`
- `server/scripts/get-context/`
- `server/lib/`
- `output/`

**Files Created/Deleted/Modified:**
- `.plans/2026-04-07-investigate-dialogue-chunking-vs-raw-audio-asset-path.md`
- `configs/cod-test.yaml`
- `configs/cod-test-mimo-openrouter-compare.yaml`
- `configs/cod-test-xiaomi-mimo-v2-omni-openrouter-high-thinking-rerun.yaml`
- `server/scripts/get-context/get-dialogue.cjs`
- `server/lib/audio-preflight.cjs`
- `output/cod-test/phase1-gather-context/raw/ffmpeg/dialogue/chunk-plan.json`
- `output/cod-test/phase1-gather-context/raw/ai/dialogue-chunks/chunk-0006/attempt-01/capture.json`
- `.logs/cod-test-20260407-1454-ee-esm8-lean-dialogue-rerun.log`
- `.plans/archive/2026-04-04-whole-asset-dialogue-finalization-honesty-fix.md`

**Status:** ✅ Complete

**Results:** `configs/cod-test.yaml` drives Phase 1 dialogue through `server/scripts/get-context/get-dialogue.cjs`, but unlike the newer Xiaomi/OpenRouter comparison lanes it does **not** set `settings.phase1.dialogue`. That means `normalizeDialoguePhase1ModeConfig(...)` falls back to the legacy defaults in code: `mode: auto`, `timing_refinement: auto`, `maxWholeAssetDurationSeconds: 60`, `fallbackToChunked: true`, and `preserveChunkPlanMetadata: true`. Inside `get-dialogue.cjs`, the extracted MP3 first goes through `preflightAudio(...)` from `server/lib/audio-preflight.cjs`. For the failing run, raw preflight evidence in `output/cod-test/phase1-gather-context/raw/ffmpeg/dialogue/chunk-plan.json` shows the dialogue audio was `140.042449s`, `3361792` bytes raw, and only `4482392` bytes estimated Base64 against a `9437184` byte budget, so transport budgeting alone would have allowed a single whole-asset request. The chunking decision instead comes from `resolveDialogueChunkingPreflight(...)`: because duration exceeded the default 60s whole-asset ceiling, it forced chunking with reason `dialogue_timing_force_chunking` and a forced base chunk duration of `20s`.

`buildOpeningWeightedChunkPlan(...)` then reshaped that base plan using the default opening provenance arbitration settings embedded in code: `dialogue_opening_provenance_seconds` defaults to `24s`, and `dialogue_opening_chunk_duration_seconds` defaults to `8s`. That produced the exact recorded plan `[0-8]`, `[8-16]`, `[16-24]`, `[24-44]`, `[44-64]`, `[64-84]`, `[84-104]`, `[104-124]`, `[124-140.042449]`. So **chunk 6** landed at **84-104s** simply because it is the fourth 20-second chunk after the first 24 seconds were split into three 8-second opening arbitration chunks. The math comes directly from `planTimeChunks(...)` in `server/lib/audio-preflight.cjs` plus the opening-window wrapper in `get-dialogue.cjs`; this does **not** look like a boundary-calculation bug.

In the active chunked execution path, each planned chunk is extracted by ffmpeg, sent to the `ai.dialogue` target with a rolling handoff, and accumulated into chunk summaries plus a mechanical transcript. Once all chunk calls succeed, `get-dialogue.cjs` requires `config.ai.dialogue_stitch.targets` and invokes the stitcher to reconcile chunk outputs into the final dialogue artifact. The current failure happened before stitching: `.logs/cod-test-20260407-1454-ee-esm8-lean-dialogue-rerun.log` and `output/cod-test/phase1-gather-context/raw/ai/dialogue-chunks/chunk-0006/attempt-01/capture.json` show chunk 6 (`84-104s`) failed with OpenRouter/Xiaomi 400 `"Multimodal data is corrupted or cannot be processed."`

Regression assessment: the evidence points to a **path/config regression relative to the recently intended design**, not to a new bug in chunk planning. The April 4 archived plan (`.plans/archive/2026-04-04-whole-asset-dialogue-finalization-honesty-fix.md`) documents that the intended clean rerun path for the Xiaomi/OpenRouter cod-test lanes was explicit whole-asset dialogue. The newer configs `configs/cod-test-mimo-openrouter-compare.yaml` and `configs/cod-test-xiaomi-mimo-v2-omni-openrouter-high-thinking-rerun.yaml` both opt into that path with `settings.phase1.dialogue.mode: whole_asset`, `timing_refinement: disabled`, `max_whole_asset_duration_seconds: 180`, and `fallback_to_chunked: false`. `configs/cod-test.yaml` never adopted those Phase 1 dialogue settings, so it silently stayed on the older default auto-chunked path and therefore reintroduced chunked Xiaomi requests for this run.

---

### Task 2: Investigate whether raw audio can already be staged as a first-class asset

**Bead ID:** `ee-in48`  
**SubAgent:** `research`  
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, inspect the current asset/media plumbing and determine whether the engine already supports pointing a lane at a staged raw-audio asset alongside the optimized video, or whether that would require new config/runtime support. Be explicit about current capabilities, missing support, and the likely seams to change. Update this plan truthfully with the findings. Claim the assigned bead at start with bd update <ID> --status in_progress --json and close it on completion with bd close <ID> --reason "Raw-audio asset support investigated" --json.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `configs/`
- `server/`
- `docs/`

**Files Created/Deleted/Modified:**
- `.plans/2026-04-07-investigate-dialogue-chunking-vs-raw-audio-asset-path.md`
- `server/lib/media-delivery.cjs`
- `server/lib/config-loader.cjs`
- `server/providers/xiaomi.cjs`
- `server/scripts/get-context/get-dialogue.cjs`
- `server/scripts/get-context/get-music.cjs`
- `server/scripts/get-context/get-music-vocals.cjs`
- `server/scripts/get-context/get-visual-identity.cjs`
- `server/scripts/process/whole-video-mimo.cjs`
- `configs/cod-test.yaml`
- `configs/cod-test-mimo-openrouter-compare.yaml`
- `docs/MIMO-MEDIA-DELIVERY-CONTRACT-2026-03-31.md`
- `docs/CONFIG-GUIDE.md`

**Status:** ✅ Complete

**Results:** The repo now has a **real first-class media catalog and resolver layer**, but it is only wired through the **video / visual whole-asset lanes**, not the Phase 1 dialogue or music lanes.

What already exists today:
- `server/lib/media-delivery.cjs` plus `server/lib/config-loader.cjs` support `asset.media.refs`, `ai.<domain>.inputRefs`, staged HTTP URLs, delivery preferences (`url` vs `inline`), and provider capability checks.
- That shared resolver is actively used by `server/scripts/process/whole-video-mimo.cjs` and `server/scripts/get-context/get-visual-identity.cjs`, which is why current configs such as `configs/cod-test.yaml` can point `ai.video.inputRefs` at `asset.media.refs.source_video` and deliver the staged optimized video URL as a first-class provider attachment.
- Xiaomi provider capabilities explicitly advertise audio/video/image URL support in `server/providers/xiaomi.cjs`, so the provider surface itself is not the blocker.

What dialogue/music support today:
- `server/scripts/get-context/get-dialogue.cjs`, `get-music.cjs`, and `get-music-vocals.cjs` still take `asset.inputPath` as the authoritative source asset, then call their local `extractAudio(...)` helper.
- If `asset.inputPath` is already an audio file, those scripts just copy it locally and continue. So the engine **does support source-audio runs instead of source-video runs** at the top-level asset slot.
- After extraction/copy, the Phase 1 audio lanes read the local file/chunks with `fs.readFileSync(...).toString('base64')` and send inline audio payloads. That means the current runtime supports **derived/extracted local audio files** and **source audio as the primary input asset**, but not a separate config-addressable staged raw-audio asset attached alongside the video catalog.

What is missing for the exact feature Derrick asked about:
- There is **no current first-class way to point `ai.dialogue` (or `ai.music`) at `asset.media.refs.raw_audio` / a staged audio URL** while still keeping `ai.video` pointed at the optimized staged video.
- Even though `validateMediaDeliveryConfig(...)` will accept `asset.media.refs` and generic `ai.dialogue.inputRefs`, the dialogue/music scripts never call `resolveMediaInput(...)`, never read `ai.dialogue.inputRefs`, and never turn an audio media ref into a resolved attachment.
- There is also no checked-in config example or guide text showing a lane-scoped staged audio ref for dialogue/music, and `docs/CONFIG-GUIDE.md` still documents `asset.inputPath` as the canonical input asset instead of documenting per-domain media refs for audio lanes.

So the honest capability split is:
1. **Existing source video support:** yes, including staged optimized video URLs for video-oriented lanes.
2. **Existing derived/extracted local audio support:** yes, via local extraction/copy from `asset.inputPath` and inline Base64 submission.
3. **Existing config-addressable staged raw-audio asset path for dialogue/music:** **no, not yet.**

Likely seams to change if we want proper staged raw-audio support:
- `server/scripts/get-context/get-dialogue.cjs`
- `server/scripts/get-context/get-music.cjs`
- `server/scripts/get-context/get-music-vocals.cjs`
- likely shared Phase 1 audio helper extraction/preflight code in `server/lib/audio-preflight.cjs` and/or a new shared helper so these scripts can resolve a logical audio ref before deciding whole-asset vs chunked handling
- `docs/CONFIG-GUIDE.md` plus one or more `configs/cod-test-*.yaml` examples to document a lane-scoped `raw_audio` media ref

Most likely implementation shape:
- keep `asset.inputPath` for provenance / default extraction fallback
- add a second media ref such as `asset.media.refs.raw_audio` with `kind: audio`, `source.path` and/or `staged.url`
- let `ai.dialogue.inputRefs` / `ai.music.inputRefs` choose that ref
- update the Phase 1 audio scripts to resolve that ref through `resolveMediaInput(...)` (or a shared audio equivalent) instead of unconditionally extracting from `asset.inputPath`
- preserve chunk extraction from the local source path when chunking is needed, but allow whole-asset mode to use the staged raw-audio attachment directly when available and supported

---

### Task 3: Recommend near-term and long-term repair directions

**Bead ID:** `ee-czxg`  
**SubAgent:** `research`  
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, synthesize the chunking-path and raw-audio-asset findings into a recommendation. Compare near-term options like increasing chunk duration, simulating whole-asset behavior, or disabling chunking where possible against longer-term support for a raw-audio staged asset path. Update this plan truthfully with the recommendation and tradeoffs. Claim the assigned bead at start with bd update <ID> --status in_progress --json and close it on completion with bd close <ID> --reason "Chunking vs raw-audio direction summarized" --json.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `docs/`

**Files Created/Deleted/Modified:**
- `.plans/2026-04-07-investigate-dialogue-chunking-vs-raw-audio-asset-path.md`
- docs/ (recommendation note if needed)

**Status:** ✅ Complete

**Results:** Recommendation: treat this as a **near-term config/path correction first**, not as evidence that dialogue chunk sizing itself regressed. For the active `cod-test` path, the concrete problem is that `configs/cod-test.yaml` never adopted the newer Phase 1 dialogue settings, so `get-dialogue.cjs` fell back to legacy `auto` mode with an implicit `maxWholeAssetDurationSeconds=60` and therefore forced chunking for a `140.0s` dialogue track that was still transport-safe as a single inline attachment. The immediate recommendation is to align `cod-test` with the already-proven rerun lane pattern: set `settings.phase1.dialogue.mode: whole_asset`, raise `max_whole_asset_duration_seconds` high enough for this asset class (for cod-test, `180` is already demonstrated), and keep `fallback_to_chunked: false` when the purpose of the run is to verify whole-asset provider behavior honestly.

Near-term option comparison, grounded in the current engine behavior:
- **Disable chunking where possible / explicit whole-asset mode (recommended now):** best fit for the actual failure. The raw audio extracted for cod-test is only ~4.48 MB estimated Base64 against a ~9 MB budget, so the current 400 happened on a chunked Xiaomi request that we did not need to make for this asset. This requires no new plumbing, only config discipline on the dialogue lane. It also matches the April 4 intended rerun design.
- **Increase chunk duration:** low implementation cost, but weak as a primary fix. Because the cod-test failure is not caused by transport budget pressure, making chunks 20s → 30s/60s/etc. does not remove the fundamental risk that any chunked Xiaomi/OpenRouter audio submission may return the same corruption 400. Bigger chunks reduce stitch overhead and boundary fragmentation, but they still keep us on the same chunk-extraction + inline-audio submission path.
- **Simulate whole-asset behavior while still chunking:** possible inside the existing architecture via hybrid/summary-preserving behavior, but it is only a compromise. `get-dialogue.cjs` can already preserve whole-asset context in hybrid cases, yet timing still comes from chunk-local extraction/stitching and provider exposure still includes chunk uploads. This is useful when a file truly must be chunked, but it should not be the default recommendation for cod-test because whole-asset is already viable there.
- **Stay chunked by default and only tune the opening window / arbitration chunks:** not recommended as the repair direction. The recorded plan (`[0-8] [8-16] [16-24] [24-44] ...`) reflects intended provenance-weighting logic rather than a bug. Tuning those windows may help output quality or reduce boundary ambiguity, but it does not address why cod-test re-entered the chunked path in the first place.

Longer-term recommendation: add a **first-class staged raw-audio media ref path** for Phase 1 audio lanes, but treat it as new capability work rather than the immediate cod-test unblock. Today the engine can either (a) take `asset.inputPath` as a video and locally extract MP3, or (b) take `asset.inputPath` as an audio file and inline-submit it/chunk it. It cannot yet do the cleaner thing Derrick described: keep video lanes on `asset.media.refs.source_video` while letting dialogue/music resolve something like `asset.media.refs.raw_audio` through the shared media resolver and deliver it as a dedicated staged audio asset. That path is worth building because it would reduce repeated local extraction work, let whole-asset dialogue/music use the same staged-media contract already proven by whole-video analysis, and create a cleaner separation between source video provenance and provider-facing audio delivery. But it needs real plumbing changes in `get-dialogue.cjs`, `get-music.cjs`, `get-music-vocals.cjs`, shared audio helpers, and docs/examples.

Tradeoff summary:
- **Near-term explicit whole-asset config:** fastest, lowest-risk, honest to current engine capability; limited to assets that fit inline-budget and whole-asset duration rules.
- **Bigger/smarter chunking:** cheaper than new media plumbing and still necessary as a fallback for longer/larger assets; does not eliminate provider sensitivity on chunk uploads and preserves stitching complexity.
- **Raw-audio staged asset path:** best long-term architecture, cleaner than repeated extraction + Base64, and likely more reusable across dialogue/music lanes; requires new resolver integration, config/docs updates, and provider-path verification before it can replace the current audio flow.

Recommended sequencing:
1. For `cod-test` and similar validation lanes, explicitly configure dialogue whole-asset mode and avoid fallback so reruns reflect the intended provider path truthfully.
2. Keep chunked dialogue as the fallback path for assets that genuinely exceed whole-asset constraints, with chunk-duration tuning considered only as a secondary quality/cost lever.
3. Open follow-up implementation work for staged `raw_audio` media refs on Phase 1 audio lanes instead of trying to fold that plumbing into the immediate cod-test repair.

---

## Final Results

**Status:** ✅ Complete

**What We Built:** Traced the actual `cod-test` dialogue execution path, confirmed the current failure came from an unintended return to the legacy chunked path rather than a chunk-boundary math bug, verified that first-class staged media refs exist today only for video-oriented lanes, and documented a concrete recommendation: fix near-term `cod-test`/validation lanes by explicitly using whole-asset dialogue where the asset already fits current inline limits, while treating staged raw-audio support as a separate follow-up capability for Phase 1 audio lanes.

**Commits:**
- Pending.

**Lessons Learned:** When a validation lane is meant to test whole-asset provider behavior, leaving Phase 1 dialogue on implicit defaults is enough to silently re-enable chunking and muddy the result. The current engine already has enough capability to avoid that for cod-test, but it does not yet have the cleaner long-term staged raw-audio path for dialogue/music.

---

*Completed on 2026-04-07*