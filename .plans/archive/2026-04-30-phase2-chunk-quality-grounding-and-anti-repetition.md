# Peanut Gallery Emotion Engine

**Date:** 2026-04-30  
**Status:** Draft  
**Agent:** Cookie 🍪

---

## Goal

Improve Phase 2 chunk-analysis quality by reducing repetitive/generic chunk summaries and reasoning, strengthening chunk-local grounding, and then rerunning the cod-test benchmark lane to measure whether the output becomes more distinct and benchmark-honest.

---

## Overview

Yesterday’s handoff moved the bottleneck from runtime correctness to output quality: `cod-test` now gets through Phase 2 successfully, but the chunk-analysis artifact is still weak because many chunk summaries and reasoning blocks repeat the same generic trailer/action boilerplate. The immediate goal is to attack that quality rot without reopening the already-fixed contract/runtime issues.

The first slice is an audit of the current Phase 2 `video-chunks` path: prompt construction, chunk-local context injection, validator/recovery interactions, and any config surfaces that may be encouraging bland or repeated outputs. From there, the implementation slice should stay bounded to prompt/context/normalization changes that make each chunk judgment more locally grounded and less copy-pasted in spirit. After implementation, the standard coder → QA → auditor loop will verify both targeted tests and a fresh benchmark rerun.

---

## REFERENCES

| ID | Description | Path |
| --- | --- | --- |
| `REF-01` | Yesterday’s handoff memory naming the current blocker and next-session focus | `memory/2026-04-29.md` |
| `REF-02` | Main Phase 2 implementation path for chunk analysis | `server/scripts/process/video-chunks.cjs` |
| `REF-03` | Existing Phase 2 script tests and regression coverage | `test/scripts/video-chunks.test.js` |
| `REF-04` | Dedicated cod-test Phase 2 benchmark config used for bounded reruns | `configs/cod-test-phase2-chunk-benchmark.yaml` |

---

## Tasks

### Task 1: Audit current Phase 2 chunk-analysis quality failure modes

**Bead ID:** `ee-4gh3`  
**SubAgent:** `primary` (for `research` workflow role)  
**Role:** `research`  
**References:** `REF-01`, `REF-02`, `REF-03`, `REF-04`  
**Prompt:** Audit the current Peanut Gallery Emotion Engine Phase 2 `video-chunks` path for chunk-quality failure modes. Claim the assigned bead on start with `bd update <BEAD_ID> --status in_progress --json`. Review the current prompt/context/build path in `server/scripts/process/video-chunks.cjs`, the bounded benchmark config in `configs/cod-test-phase2-chunk-benchmark.yaml`, and the latest relevant cod-test chunk-analysis artifacts if needed. Focus specifically on why chunk summaries and reasoning become repetitive/generic instead of chunk-local and distinct. Do not implement fixes yet. Produce a concise diagnosis with concrete file/line anchors and recommended bounded fix directions. Do not close the bead unless explicitly instructed by the orchestrator.  

**Folders Created/Deleted/Modified:**
- `.plans/`

**Files Created/Deleted/Modified:**
- `.plans/2026-04-30-phase2-chunk-quality-grounding-and-anti-repetition.md`

**Status:** ✅ Complete

**Results:** Audit complete. Highest-confidence causes are: (1) every chunk prompt receives broad repeated global support context, which biases the model toward trailer-wide boilerplate; (2) previous-summary carry-over reinforces repetition across adjacent chunks; (3) the benchmark lane is actually chunking at 5s via `tool_variables.chunk_strategy.config.chunkDuration` even though `settings.chunk_duration` says 8, creating many near-duplicate microsegments; and (4) current tests/validators accept generic-but-schema-valid output because they do not assert chunk-local distinctness/grounding. No implementation changes made yet; awaiting Derrick review/direction before proceeding.

---

### Task 2: Implement bounded Phase 2 chunk-video delivery fix, duration-truth alignment, and chunk-local reasoning cue

**Bead ID:** `ee-itqm`  
**SubAgent:** `primary` (for `coder` workflow role)  
**Role:** `coder`  
**References:** `REF-02`, `REF-03`, `REF-04`  
**Prompt:** Implement the approved bounded Phase 2 fix set for Peanut Gallery Emotion Engine. Claim bead `ee-itqm` on start with `bd update ee-itqm --status in_progress --json`. Scope is intentionally narrow: (1) make the Phase 2 chunk-video lane deliver the intended chunk video asset to the provider instead of the staged full source video URL; (2) align declared chunk-duration truth with the actual chunking input used in the bounded benchmark lane/artifacts; and (3) strengthen the Phase 2 prompt/instructions so reasoning cites chunk-local visual cues. Do not try to solve the larger timestamped dialogue/music support-context problem in this slice. Preserve canonical video attachment behavior, staged URL vs inline expectations where still correct, canonical lane artifact selection, and retry/raw-capture machinery unless a minimal change is required. Add or update targeted tests in `test/scripts/video-chunks.test.js` (and any directly related tests) for the new behavior. Run relevant automated validation before handoff, commit/push by default, and report exact changes plus remaining risks. Leave the bead open for QA/audit unless explicitly told otherwise.  

**Folders Created/Deleted/Modified:**
- `server/scripts/process/`
- `server/lib/`
- `test/scripts/`

**Files Created/Deleted/Modified:**
- `server/scripts/process/video-chunks.cjs`
- `server/lib/media-delivery.cjs`
- `test/scripts/video-chunks.test.js`
- any directly related test files required for the bounded fix

**Status:** ✅ Complete

**Results:** Coder slice complete. The bounded implementation fixed the Phase 2 chunk-video delivery bug so chunk-local assets are no longer replaced by the staged full-source URL when the active asset is an extracted chunk, aligned reported chunk-duration truth with the active chunk strategy, updated the bounded benchmark config from 8s to 5s, and strengthened Phase 2 prompt instructions so reasoning cites chunk-local visual cues instead of leaning on dialogue/music/continuity as a substitute. Targeted validation passed: `node --test test/lib/media-delivery.test.js test/scripts/video-chunks.test.js ../tools/test/emotion-lenses-tool.test.js` with 76 passing / 0 failing. Commits pushed: `76b4421` in `emotion-engine` (`Fix phase 2 chunk video delivery and duration truth`) and `ee0d5f3` in `tools` (`Strengthen chunk-local grounding instructions`). Residual scope note: timestamped dialogue/music/music-vocals attribution remains intentionally out of scope for this slice.

---

### Task 3: Verify with targeted tests and bounded cod-test rerun

**Bead ID:** `ee-snp9`  
**SubAgent:** `primary` (for `qa` workflow role)  
**Role:** `qa`  
**References:** `REF-03`, `REF-04`  
**Prompt:** QA the bounded Phase 2 chunk-video fix. Claim bead `ee-snp9` on start with `bd update ee-snp9 --status in_progress --json`. Run the relevant targeted tests, then run the bounded benchmark lane using `configs/cod-test-phase2-chunk-benchmark.yaml`. Specifically verify that representative chunks are now analyzed against the intended chunk video asset, that chunk-duration truth is consistent in artifacts/config behavior, and that reasoning includes chunk-local visual cues where appropriate. Re-inspect the previously problematic later chunks/endcard region and record exact commands, artifact paths, and findings. Do not close the bead unless explicitly instructed by the orchestrator.  

**Folders Created/Deleted/Modified:**
- `output/`
- `.logs/`

**Files Created/Deleted/Modified:**
- `output/cod-test/phase2-process/chunk-analysis.json`
- `output/cod-test/phase2-process/raw/`
- benchmark/report artifacts produced by the bounded rerun

**Status:** ❌ Failed

**Results:** QA validation is mixed. Targeted tests and config validation passed, but the bounded live rerun failed immediately on chunk 0 before any provider analysis completed. Failure: `Video delivery resolution failed for media ref "source_video" on openrouter: preferredMode=inline, allowFallback=false, stagedUrl=missing, sourcePath=present`. This means the fix is test-level proven but live-lane unproven. No fresh rerun artifacts were produced for chunks 24-27, so the intended real-run verification remains incomplete.

---

### Task 4: Independent audit of fix scope and evidence

**Bead ID:** `ee-fqov`  
**SubAgent:** `primary` (for `auditor` workflow role)  
**Role:** `auditor`  
**References:** `REF-01`, `REF-02`, `REF-03`, `REF-04`  
**Prompt:** Independently audit the bounded Phase 2 chunk-video fix lane. Claim bead `ee-fqov` on start with `bd update ee-fqov --status in_progress --json`. Review the plan, implementation diff, updated tests, QA rerun evidence, and the previously identified artifact mismatch. Confirm whether the work actually fixes the core bug that the cod-test lane was likely sending the full staged source video URL instead of the intended chunk video, whether chunk-duration truth is aligned, and whether the chunk-local reasoning cue was added without reopening settled runtime/media/retry contracts. If the bead passes, close it with a clear reason. If it fails, leave it open and report the exact gap.  

**Folders Created/Deleted/Modified:**
- `.plans/`

**Files Created/Deleted/Modified:**
- `.plans/2026-04-30-phase2-chunk-quality-grounding-and-anti-repetition.md`

**Status:** ⏳ Pending

**Results:** Pending.

---

### Task 5: Investigate per-chunk visual grounding artifacts and model-view evidence

**Bead ID:** `ee-v271`  
**SubAgent:** `primary` (for `research` workflow role)  
**Role:** `research`  
**References:** `REF-02`, `REF-04`  
**Prompt:** Investigate what the Phase 2 persona model is actually seeing for each chunk in the current Peanut Gallery Emotion Engine cod-test lane. Claim bead `ee-v271` on start with `bd update ee-v271 --status in_progress --json`. Trace the exact artifact chain for representative problematic chunks: raw provider-facing video chunk file(s), any staged/compressed chunk assets, attempt capture metadata, and prompt payload references. Determine whether the model is plausibly seeing the expected video chunk for those indices, and identify any evidence of stale/global context overwhelming local visual grounding. Do not implement changes. Produce a user-reviewable map of chunk index -> video asset path -> capture/prompt path -> summary text so Derrick can inspect the clips directly. Leave the bead open unless explicitly told otherwise.  

**Folders Created/Deleted/Modified:**
- `.plans/`
- `output/`

**Files Created/Deleted/Modified:**
- `.plans/2026-04-30-phase2-chunk-quality-grounding-and-anti-repetition.md`
- `output/cod-test/phase2-process/raw/`
- `output/cod-test/phase2-process/chunk-analysis.json`

**Status:** ✅ Complete

**Results:** Investigation complete. Confirmed the cod-test Phase 2 lane likely delivers the staged full source video URL instead of the intended local chunk video in URL mode, confirmed the 5s vs 8s chunk-duration mismatch, and assembled representative chunk/video/capture/prompt artifact paths for manual review of the mismatch.

---

### Task 6: Audit live inline chunk-delivery resolution failure and plan the follow-up fix

**Bead ID:** `ee-w1gq`  
**SubAgent:** `primary` (for `research` workflow role)  
**Role:** `research`  
**References:** `REF-02`, `REF-03`, `REF-04`  
**Prompt:** Audit the live rerun failure that appeared after the bounded chunk-video delivery fix. Claim bead `ee-w1gq` on start with `bd update ee-w1gq --status in_progress --json`. Determine exactly why the tests passed but the bounded cod-test rerun failed at chunk 0 with `preferredMode=inline, allowFallback=false, stagedUrl=missing, sourcePath=present`. Focus on media-delivery mode selection, config constraints (`preferredMode` / `allowedModes` / `allowFallback`), and how chunk-local delivery should work when the source asset is originally an online file. Produce the likely root cause, concrete file/line anchors, and a bounded next-fix plan. Do not implement changes in this task.  

**Folders Created/Deleted/Modified:**
- `.plans/`
- `.logs/`

**Files Created/Deleted/Modified:**
- `.plans/2026-04-30-phase2-chunk-quality-grounding-and-anti-repetition.md`
- `.logs/cod-test-phase2-chunk-benchmark-20260430-091135-ee-snp9.log`
- `output/cod-test/phase2-process/raw/ai/chunk-0000/split-00/attempt-01/capture.json`

**Status:** ⏳ Pending

**Results:** Audit complete. Root cause for the live rerun failure is a delivery-policy ownership mismatch: chunk-local extracted assets correctly stop reusing the staged full-source URL, but they still inherit the original `source_video` ref's URL-only delivery constraints (`allowedModes: [url]`, `allowFallback: false`), leaving no legal inline delivery path for chunk-local analysis in the bounded live lane.

---

### Task 7: Implement chunk-local delivery policy override for the live Phase 2 rerun

**Bead ID:** `ee-hveo`  
**SubAgent:** `primary` (for `coder` workflow role)  
**Role:** `coder`  
**References:** `REF-02`, `REF-03`, `REF-04`  
**Prompt:** Implement the bounded follow-up fix for the live Phase 2 rerun. Claim bead `ee-hveo` on start with `bd update ee-hveo --status in_progress --json`. Fix the media-delivery policy ownership mismatch so when `videoContext.chunkPath` points at an extracted chunk that is not the configured full-source asset, the resolver can legally choose chunk-local inline/base64 delivery instead of inheriting the full-source `source_video` URL-only contract. Preserve whole-video / true-source staged URL behavior for lanes that intentionally use the configured source asset. Add/update targeted tests for this exact ownership mismatch and run relevant validation before handoff. Commit/push by default and report exact changes, validation, and residual risks.  

**Folders Created/Deleted/Modified:**
- `server/lib/`
- `test/lib/`
- `test/scripts/`

**Files Created/Deleted/Modified:**
- `server/lib/media-delivery.cjs`
- related tests for delivery-policy resolution

**Status:** ✅ Complete

**Results:** Bounded follow-up fix implemented and pushed. `server/lib/media-delivery.cjs` now scopes delivery-policy ownership so chunk-local assets that are not the configured full-source asset no longer inherit the source ref's strict URL-only `allowedModes` / `allowFallback` contract. Instead, chunk-local assets use an asset-local policy that allows inline/base64 delivery when appropriate, while configured-source / whole-video behavior remains unchanged. Regression coverage was tightened in `test/lib/media-delivery.test.js` for the exact previously failing case, and whole-video staged URL behavior remains covered. Validation passed: `node --test test/lib/media-delivery.test.js` (8/8) and `node --test test/scripts/video-chunks.test.js` (39/39). Commit pushed: `bd59c2d33e9e3691ee72faa38ba5a429f548856b` (`Fix chunk-local video delivery policy ownership`).

---

### Task 8: QA chunk-local delivery policy override with bounded cod-test rerun

**Bead ID:** `ee-dhez`  
**SubAgent:** `primary` (for `qa` workflow role)  
**Role:** `qa`  
**References:** `REF-03`, `REF-04`  
**Prompt:** QA the bounded chunk-local delivery policy override. Claim bead `ee-dhez` on start with `bd update ee-dhez --status in_progress --json`. Re-run the targeted tests and the bounded benchmark lane using `configs/cod-test-phase2-chunk-benchmark.yaml`. Confirm the live rerun now gets past chunk 0, then inspect representative later chunks/endcard-region behavior (especially 24-27) to see whether summaries now look grounded in the intended chunk assets. Record exact commands, artifact paths, and findings.  

**Folders Created/Deleted/Modified:**
- `output/`
- `.logs/`

**Files Created/Deleted/Modified:**
- live rerun artifacts under `output/cod-test/`
- log artifacts under `.logs/`

**Status:** ⏳ Pending

**Results:** Pending.

---

### Task 9: Audit chunk-local delivery policy override scope and evidence

**Bead ID:** `ee-iix6`  
**SubAgent:** `primary` (for `auditor` workflow role)  
**Role:** `auditor`  
**References:** `REF-01`, `REF-02`, `REF-03`, `REF-04`  
**Prompt:** Independently audit the chunk-local delivery policy override lane. Claim bead `ee-iix6` on start with `bd update ee-iix6 --status in_progress --json`. Review the implementation diff, tests, QA rerun evidence, and plan history. Confirm whether the fix resolves the delivery-policy ownership mismatch without breaking whole-video staged URL behavior or other settled media/runtime contracts. If it passes, close the bead with a precise reason; if not, leave it open and explain the gap.  

**Folders Created/Deleted/Modified:**
- `.plans/`

**Files Created/Deleted/Modified:**
- `.plans/2026-04-30-phase2-chunk-quality-grounding-and-anti-repetition.md`

**Status:** ⏳ Pending

**Results:** Pending.

---

### Task 10: Audit chunk-1 multimodal payload corruption in the live Phase 2 rerun

**Bead ID:** `ee-yqos`  
**SubAgent:** `primary` (for `research` workflow role)  
**Role:** `research`  
**References:** `REF-02`, `REF-03`, `REF-04`  
**Prompt:** Audit the chunk-1 multimodal payload corruption failure from the latest bounded live rerun. Claim bead `ee-yqos` on start with `bd update ee-yqos --status in_progress --json`. Verify whether the extracted chunk file itself is a legitimate video file, whether the base64/inline payload built from it looks structurally correct, and whether the OpenRouter request shape for that chunk appears correct for the target model. Inspect the fresh rerun artifacts/captures/logs, trace the exact packaging path from chunk file -> videoContext -> tool/provider payload, and identify the most likely root cause with concrete file/line anchors. Do not implement changes in this task. Produce a bounded fix recommendation only after proving the evidence chain as far as possible.  

**Folders Created/Deleted/Modified:**
- `.plans/`
- `output/`
- `.logs/`

**Files Created/Deleted/Modified:**
- `.plans/2026-04-30-phase2-chunk-quality-grounding-and-anti-repetition.md`
- `output/cod-test/assets/processed/chunks/chunk_001.mp4`
- `output/cod-test/phase2-process/raw/ai/chunk-0001/split-00/attempt-01/capture.json`
- `.logs/cod-test-phase2-chunk-benchmark-20260430-094756-ee-dhez-qa.log`

**Status:** ⏳ Pending

**Results:** Audit complete. Chunk 1 is a real MP4 and its base64/request shape appear structurally sane, but the provider-facing chunk is extracted via copy-cut and starts mid-GOP on a non-keyframe. That makes the asset plausibly acceptable to tolerant local decoders while still failing stricter multimodal ingestion as `Multimodal data is corrupted or cannot be processed.`

---

### Task 11: Implement provider-safe Phase 2 chunk extraction for multimodal delivery

**Bead ID:** `ee-x8q0`  
**SubAgent:** `primary` (for `coder` workflow role)  
**Role:** `coder`  
**References:** `REF-02`, `REF-03`, `REF-04`  
**Prompt:** Implement the bounded Phase 2 fix for provider-safe multimodal chunk delivery. Claim bead `ee-x8q0` on start with `bd update ee-x8q0 --status in_progress --json`. Focus specifically on making provider-facing chunk assets independently decodable / safe for multimodal ingestion, rather than copy-cut mid-GOP fragments. Keep scope narrow: do not reopen the broader support-context problem, and do not break already-fixed chunk-local delivery policy ownership or whole-video staged URL behavior. Add/update targeted tests where feasible, run relevant validation, commit/push by default, and report exact changes, validation, and residual risks.  

**Folders Created/Deleted/Modified:**
- `server/lib/`
- `test/lib/`
- `test/scripts/`

**Files Created/Deleted/Modified:**
- `server/lib/video-chunk-extractor.cjs`
- related tests for chunk extraction / video-chunks behavior

**Status:** ✅ Complete

**Results:** Bounded provider-safe chunk extraction fix implemented and pushed. `server/lib/video-chunk-extractor.cjs` now re-encodes provider-facing chunks instead of copy-cutting them, using an FFmpeg path that produces independently decodable H.264/AAC MP4 segments with `yuv420p` and `+faststart`, avoiding mid-GOP/non-keyframe provider-facing fragments. Scope stayed narrow to the extractor and its targeted unit coverage. Validation passed: `node --test test/lib/video-chunk-extractor.test.js test/lib/media-delivery.test.js test/scripts/video-chunks.test.js test/scripts/tool-wrapper-contract.test.js` with 60/60 passing, plus a reality-check extraction + `ffprobe` confirming a decodable 5s output chunk. Commit pushed: `28d4d69` (`Make provider chunk extraction independently decodable`).

---

### Task 12: QA provider-safe chunk extraction with bounded cod-test rerun

**Bead ID:** `ee-voh0`  
**SubAgent:** `primary` (for `qa` workflow role)  
**Role:** `qa`  
**References:** `REF-03`, `REF-04`  
**Prompt:** QA the provider-safe chunk extraction fix. Claim bead `ee-voh0` on start with `bd update ee-voh0 --status in_progress --json`. Re-run targeted tests and the bounded benchmark lane using `configs/cod-test-phase2-chunk-benchmark.yaml`. Confirm the rerun gets past the previous chunk-1 corruption failure, then inspect representative later chunks/endcard-region behavior (especially 24-27) to determine whether summaries now look grounded in the intended chunk assets. Record exact commands, artifact paths, and findings.  

**Folders Created/Deleted/Modified:**
- `output/`
- `.logs/`

**Files Created/Deleted/Modified:**
- live rerun artifacts under `output/cod-test/`
- log artifacts under `.logs/`

**Status:** ⏳ Pending

**Results:** Pending.

---

### Task 13: Audit provider-safe chunk extraction scope and evidence

**Bead ID:** `ee-tc2u`  
**SubAgent:** `primary` (for `auditor` workflow role)  
**Role:** `auditor`  
**References:** `REF-01`, `REF-02`, `REF-03`, `REF-04`  
**Prompt:** Independently audit the provider-safe chunk extraction lane. Claim bead `ee-tc2u` on start with `bd update ee-tc2u --status in_progress --json`. Review the implementation diff, tests, QA rerun evidence, and plan history. Confirm whether the fix resolves the chunk-1 multimodal corruption problem without breaking the already-fixed chunk-local delivery policy or whole-video staged URL behavior. If it passes, close the bead with a precise reason; if it fails, leave it open and explain the gap.  

**Folders Created/Deleted/Modified:**
- `.plans/`

**Files Created/Deleted/Modified:**
- `.plans/2026-04-30-phase2-chunk-quality-grounding-and-anti-repetition.md`

**Status:** ⏳ Pending

**Results:** Pending.

---

## Final Results

**Status:** ⚠️ Partial

**What We Built:** Active execution plan established. Completed research/audit slices identified the likely chunk-quality causes and then isolated a higher-priority core bug: the current cod-test Phase 2 lane likely sends the staged full source video URL instead of the intended chunk video asset. Execution is now proceeding on the bounded fix set: correct chunk-video delivery, align chunk-duration truth, and add chunk-local reasoning cues.

**Reference Check:** `REF-01` established the blocker and next focus. `REF-02` through `REF-04` remain the implementation, test, and rerun surfaces driving execution.

**Commits:**
- Pending

**Lessons Learned:** Keep this slice bounded to chunk-quality behavior; do not reopen already-settled runtime/contract fixes unless new evidence proves a regression.

---

*Completed on 2026-04-30*
