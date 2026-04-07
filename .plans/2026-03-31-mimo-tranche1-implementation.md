---
plan_id: plan-2026-03-31-mimo-tranche1-implementation
bead_ids:
  - ee-4pj3
  - ee-8jpd
  - ee-fhic
  - ee-a04a
  - ee-m6uf
---
# emotion-engine: MiMo tranche 1 implementation

**Date:** 2026-03-31  
**Status:** In Progress  
**Agent:** Cookie 🍪

---

## Goal

Implement the first end-to-end MiMo prototype lane in `emotion-engine` by adding reusable public-URL media delivery support, a whole-video Phase 2 analysis path, and a cod-test OpenRouter comparison config that points at the real staged S3 video.

---

## Overview

This plan converts today’s MiMo research and design work into the first coding tranche. The objective is not to replace the current chunked pipeline yet. The objective is to create the smallest honest working prototype that can answer whether whole-video multimodal evaluation is viable enough to justify deeper rollout.

The canonical staged prototype asset for this tranche is:
- `https://gambit-games-tests.s3.us-east-1.amazonaws.com/peanut-gallery/cod.mp4`

Tranche 1 intentionally focuses on the fastest comparison route:
- keep the current architecture intact
- extend media transport so providers can receive either inline Base64 or public URLs
- add a whole-video Phase 2 script that emits a sidecar analysis artifact
- add a narrow cod-test OpenRouter MiMo config using the staged S3 URL
- only create a compressed fallback asset if OpenRouter URL handling proves insufficient

This tranche should leave Xiaomi-direct integration and expanded Phase 1 non-chunked / visual metadata support for the next tranche, unless a blocker discovered here forces reprioritization.

---

## Tasks

### Task 1: Implement shared media delivery contract and URL-vs-inline resolver

**Bead ID:** `ee-4pj3`  
**SubAgent:** `coder`  
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, implement the tranche-1 shared media delivery contract described in docs/MIMO-MEDIA-DELIVERY-CONTRACT-2026-03-31.md. Add the reusable media catalog + resolver so providers can receive media as either inline Base64 or staged public URL depending on config and provider capability. Keep the design reusable rather than MiMo-only. Include focused tests. Claim bead <id> on start with bd update <id> --status in_progress --json and close it on completion with bd close <id> --reason "..." --json.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `server/`
- `test/`
- possibly `docs/`

**Files Created/Deleted/Modified:**
- `.plans/2026-03-31-mimo-tranche1-implementation.md`
- `server/lib/media-delivery.cjs`
- `server/lib/config-loader.cjs`
- `test/lib/media-delivery.test.js`

**Status:** ✅ Complete

**Results:** Finalized the shared media-delivery contract surface around `asset.media.refs` / `ai.<domain>.inputRefs`, including staged-URL vs inline resolution, provider-capability checks, per-target adapter media overrides, and Base64 budget enforcement. Wired `validateConfig()` to run the shared media-delivery validation so bad refs / delivery modes fail early, and verified focused resolver coverage with `node --test test/lib/media-delivery.test.js test/pipeline/config-loader.test.js`.

---

### Task 2: Implement OpenRouter public-video-url support for MiMo comparison path

**Bead ID:** `ee-8jpd`  
**SubAgent:** `coder`  
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, implement the OpenRouter-side payload support needed for the tranche-1 MiMo comparison lane so staged public video URLs can be honored instead of implicitly converting local files to Base64. Keep the implementation aligned with the shared media delivery contract and add focused tests. Claim bead <id> on start with bd update <id> --status in_progress --json and close it on completion with bd close <id> --reason "..." --json.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `server/`
- `test/`

**Files Created/Deleted/Modified:**
- `.plans/2026-03-31-mimo-tranche1-implementation.md`
- `server/lib/ai-targets.cjs`
- `server/lib/media-delivery.cjs`
- `server/scripts/process/video-chunks.cjs`
- `test/lib/ai-targets.test.js`
- `test/lib/media-delivery.test.js`
- `test/scripts/video-chunks.test.js`

**Status:** ✅ Complete

**Results:** Added a reusable media-delivery resolver that honors shared `asset.media.refs` / `ai.video.inputRefs` staged URL config plus legacy `asset.stagedPublicUrl`, then wired `video-chunks.cjs` to resolve per-target video delivery before calling the emotion lane. OpenRouter-target runs can now preserve staged public video URLs instead of implicitly falling back to local chunk Base64, while target-specific adapter media overrides can still force inline delivery when needed. Focused tests cover resolver behavior, adapter-extra preservation in AI target normalization, and the chunk-analysis integration path.

---

### Task 3: Implement whole-video Phase 2 MiMo analysis script and sidecar artifact

**Bead ID:** `ee-fhic`  
**SubAgent:** `coder`  
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, implement the tranche-1 whole-video Phase 2 MiMo prototype described in docs/design/mimo-whole-video-phase2-prototype-2026-03-31.md. Add a new whole-video Phase 2 script that consumes the staged video via the shared media-delivery contract, performs whole-video multimodal persona evaluation, and writes the sidecar artifact phase2-process/whole-video-analysis.json. Keep this a side path rather than replacing the existing chunked system. Add focused tests where practical. Claim bead <id> on start with bd update <id> --status in_progress --json and close it on completion with bd close <id> --reason "..." --json.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `server/`
- `test/`
- `docs/` if minor design clarification is needed

**Files Created/Deleted/Modified:**
- `.plans/2026-03-31-mimo-tranche1-implementation.md`
- `server/scripts/process/whole-video-mimo.cjs`
- `server/lib/whole-video-analysis-validator.cjs`
- `server/lib/script-contract.cjs`
- `server/lib/persisted-artifacts.cjs`
- `server/lib/artifact-manager.cjs`
- `test/lib/media-delivery.test.js`
- `test/lib/whole-video-analysis-validator.test.js`
- `test/scripts/whole-video-mimo.test.js`

**Status:** ✅ Complete

**Results:** Added a side-path Phase 2 whole-video MiMo script that resolves the staged video through the shared media-delivery contract, runs a full-video multimodal persona evaluation with a local validator-tool loop, and writes `phase2-process/whole-video-analysis.json` without disturbing the chunked lane. Added a dedicated whole-video analysis validator plus focused tests for the whole-video script, validator, and media-delivery contract coverage. Registered the new `wholeVideoAnalysis` artifact in script-contract / persistence helpers so the sidecar can be referenced and hydrated consistently.

---

### Task 4: Add cod-test OpenRouter MiMo config using the staged S3 URL and validate the lane

**Bead ID:** `ee-a04a`  
**SubAgent:** `coder`  
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, add the tranche-1 cod-test OpenRouter MiMo comparison config using the canonical staged asset URL https://gambit-games-tests.s3.us-east-1.amazonaws.com/peanut-gallery/cod.mp4. Keep the lane narrow, validate the config, run the smallest safe validation path that proves the wiring, and document exact commands and artifacts. Only create a compressed fallback asset if the OpenRouter path truly requires it. Claim bead <id> on start with bd update <id> --status in_progress --json and close it on completion with bd close <id> --reason "..." --json.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `configs/`
- `server/lib/`
- `.logs/`

**Files Created/Deleted/Modified:**
- `.plans/2026-03-31-mimo-tranche1-implementation.md`
- `configs/cod-test-mimo-openrouter-compare.yaml`
- `server/lib/media-delivery.cjs`
- `.logs/2026-03-31-cod-test-mimo-openrouter-compare-validate-configs.log`
- `.logs/2026-03-31-cod-test-mimo-openrouter-compare-dry-run.log`
- `.logs/2026-03-31-cod-test-mimo-openrouter-compare-media-delivery-test.log`
- `.logs/2026-03-31-cod-test-mimo-openrouter-compare-whole-video-url-test.log`
- `.logs/2026-03-31-cod-test-mimo-openrouter-compare-request-shape.json`

**Status:** ✅ Complete

**Results:** Added `configs/cod-test-mimo-openrouter-compare.yaml` as the narrow cod-test MiMo/OpenRouter lane using the canonical staged URL `https://gambit-games-tests.s3.us-east-1.amazonaws.com/peanut-gallery/cod.mp4` via `asset.media.refs.source_video` + `ai.video.inputRefs`, aligned to the tranche-1 whole-video side path by pointing Phase 2 at `server/scripts/process/whole-video-mimo.cjs`. Validation exposed that the shared `server/lib/media-delivery.cjs` file in this tree was missing the exported config-validation / resolver surface already expected by `config-loader`, `whole-video-mimo`, and existing tests, so I repaired that seam and re-ran the lane checks. Commands run: `node --test test/lib/media-delivery.test.js`, `node --test test/scripts/whole-video-mimo.test.js --test-name-pattern "staged URL side path"`, `node validate-configs.cjs`, `node server/run-pipeline.cjs --config configs/cod-test-mimo-openrouter-compare.yaml --dry-run --verbose`, plus a targeted Node probe that loaded the new config, resolved `resolveMediaInput(...)`, and serialized the OpenRouter request into `.logs/2026-03-31-cod-test-mimo-openrouter-compare-request-shape.json`. The probe artifact shows `deliveryMode: "url"`, attachment `{ "type": "video", "url": "https://gambit-games-tests.s3.us-east-1.amazonaws.com/peanut-gallery/cod.mp4" }`, and OpenRouter request content containing a `video_url` part for the same S3 URL. No compressed fallback asset was needed.

---

### Task 5: Verify tranche-1 output, update plan with real results, and prepare tranche-2 handoff

**Bead ID:** `ee-m6uf`  
**SubAgent:** `primary`  
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, verify the tranche-1 MiMo prototype outputs after implementation tasks complete. Confirm files exist, run the relevant validation/tests, summarize what worked vs what remains blocked, update the implementation plan with real results, and prepare the explicit tranche-2 handoff (Xiaomi-direct + expanded Phase 1 metadata lanes). Claim bead <id> on start with bd update <id> --status in_progress --json and close it on completion with bd close <id> --reason "..." --json.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `.logs/`

**Files Created/Deleted/Modified:**
- `.plans/2026-03-31-mimo-tranche1-implementation.md`
- `.logs/2026-03-31-mimo-tranche1-file-check.log`
- `.logs/2026-03-31-mimo-tranche1-focused-tests.log`
- `.logs/2026-03-31-mimo-tranche1-validate-configs.log`
- `.logs/2026-03-31-mimo-tranche1-dry-run.log`
- `.logs/2026-03-31-mimo-tranche1-request-shape-verify.json`

**Status:** ✅ Complete

**Results:** Verified the landed tranche-1 files, test coverage, and config wiring without starting tranche 2. Exact commands run: `(1)` a `test -f` verification loop recorded in `.logs/2026-03-31-mimo-tranche1-file-check.log`, `(2)` `node --test test/lib/media-delivery.test.js test/lib/ai-targets.test.js test/lib/whole-video-analysis-validator.test.js test/pipeline/config-loader.test.js test/scripts/video-chunks.test.js test/scripts/whole-video-mimo.test.js`, `(3)` `node validate-configs.cjs`, `(4)` `node server/run-pipeline.cjs --config configs/cod-test-mimo-openrouter-compare.yaml --dry-run --verbose`, `(5)` a targeted Node probe that loaded `configs/cod-test-mimo-openrouter-compare.yaml`, resolved `resolveMediaInput(...)`, and rebuilt the OpenRouter request into `.logs/2026-03-31-mimo-tranche1-request-shape-verify.json`, plus `(6)` explicit checks that `output/cod-test-mimo-openrouter-compare` is still absent and `AI_API_KEY` is currently missing.

Proven in tranche 1:
- Landed files exist for the shared media-delivery contract, OpenRouter URL path, whole-video MiMo side path, validator, config, and focused tests.
- Focused verification passed: `111/111` tests green in `.logs/2026-03-31-mimo-tranche1-focused-tests.log`.
- Config validation passed repo-wide, including `configs/cod-test-mimo-openrouter-compare.yaml`, recorded in `.logs/2026-03-31-mimo-tranche1-validate-configs.log`.
- The cod-test MiMo config dry-runs cleanly, recorded in `.logs/2026-03-31-mimo-tranche1-dry-run.log`.
- The OpenRouter request-shape proof is real: `.logs/2026-03-31-mimo-tranche1-request-shape-verify.json` shows `deliveryMode: "url"`, attachment `{ "type": "video", "url": "https://gambit-games-tests.s3.us-east-1.amazonaws.com/peanut-gallery/cod.mp4" }`, and request content containing a `video_url` part for the same staged S3 URL.
- The whole-video sidecar artifact is wired into the repo contract surface: `server/lib/script-contract.cjs`, `server/lib/persisted-artifacts.cjs`, and `server/lib/artifact-manager.cjs` all register `wholeVideoAnalysis` at `phase2-process/whole-video-analysis.json`.

Still unproven after tranche 1:
- No live provider success was executed in this verification pass because `AI_API_KEY` is missing in the current environment, so there is still no persisted real run artifact at `output/cod-test-mimo-openrouter-compare/phase2-process/whole-video-analysis.json`.
- Xiaomi-direct provider support was intentionally not implemented here.
- Expanded Phase 1 non-chunked dialogue/music and the new visual identity metadata lane remain design-only (`docs/phase1-non-chunked-and-visual-identity-plan-2026-03-31.md`).
- No compressed fallback asset was needed or created because the URL path proof succeeded.

---

## Execution Notes

- Canonical staged asset URL: `https://gambit-games-tests.s3.us-east-1.amazonaws.com/peanut-gallery/cod.mp4`
- Tranche 1 should prefer the real public URL path, not a fake placeholder.
- Compressed fallback media is allowed only if OpenRouter URL handling proves insufficient.
- Xiaomi-direct provider support stays in tranche 2 unless tranche 1 reveals a hard OpenRouter blocker that makes the comparison route non-viable.
- Keep the existing chunked pipeline intact; the new lane is a side path for honest comparison.
- Verification artifacts added in this task:
  - `.logs/2026-03-31-mimo-tranche1-file-check.log`
  - `.logs/2026-03-31-mimo-tranche1-focused-tests.log`
  - `.logs/2026-03-31-mimo-tranche1-validate-configs.log`
  - `.logs/2026-03-31-mimo-tranche1-dry-run.log`
  - `.logs/2026-03-31-mimo-tranche1-request-shape-verify.json`

### Tranche 2 handoff

1. **Xiaomi-direct provider support**
   - Add an explicit Xiaomi-direct adapter target for the whole-video lane and normalize its OpenAI-compatible `video_url` request shape against the same `asset.media.refs` / `ai.video.inputRefs` contract.
   - Mirror the media capability checks already used by the OpenRouter path so URL-vs-inline decisions remain contract-driven rather than provider-specific script logic.
   - Run a real staged-URL smoke test that persists `output/<run>/phase2-process/whole-video-analysis.json` and records request/response evidence, latency, and any provider-specific fetch failures.

2. **Expanded Phase 1 non-chunked dialogue/music support**
   - Implement the design in `docs/phase1-non-chunked-and-visual-identity-plan-2026-03-31.md` additively: keep `dialogueData` / `musicData` contract-stable while adding provenance such as `analysisMode`, `timingMode`, and fallback metadata.
   - Add `settings.phase1.*` mode toggles (`auto | chunked | whole_asset | hybrid`) plus safe fallbacks so the current chunked baseline remains available.
   - Prove at least one whole-asset or hybrid cod-test run and compare the produced Phase 1 artifacts against the existing chunked outputs rather than replacing them.

3. **New visual identity metadata lane**
   - Add a dedicated Phase 1 script/artifact pair for `visualIdentityData` instead of overloading `chunkAnalysis`.
   - Keep it evidence-oriented and timeline-aware so future Phase 2 / Phase 3 consumers can optionally ingest it without breaking current reports.
   - Validate the artifact contract first, then wire optional downstream consumption behind additive checks.

---

## Final Results

**Status:** ⚠️ Partial

**What We Built:** Tranche 1 is verified as a real side-path implementation: shared media delivery can resolve staged public video URLs, the cod-test OpenRouter MiMo config validates and dry-runs, the whole-video Phase 2 script is contract-registered, and the request-shape proof shows the staged S3 asset flowing into an OpenRouter `video_url` payload. The repo now contains the tranche-2 handoff plan for Xiaomi-direct support plus expanded Phase 1 whole-asset/visual metadata work.

**Commits:**
- Pending

**Lessons Learned:** The tranche-1 landing proves the wiring and contract seams, but not full live provider execution. The honest boundary is: request-shape proof and test proof are green; persistent real-run artifact proof still requires credentials and a live smoke run. Preserving the chunked lane while adding additive whole-video / metadata paths remains the right rollout shape.
