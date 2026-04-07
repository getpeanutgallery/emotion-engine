---
plan_id: plan-2026-03-31-mimo-tranche2-xiaomi-and-phase1
bead_ids:
  - ee-gr0r
  - ee-4k05
  - ee-jdji
  - ee-dond
  - ee-s1jj
  - ee-rig5
---
# emotion-engine: MiMo tranche 2 — Xiaomi direct + Phase 1 expansion

**Date:** 2026-03-31  
**Status:** Complete  
**Agent:** Cookie 🍪

---

## Goal

Implement the next MiMo lane by adding direct Xiaomi provider support for staged-URL live execution, then expand Phase 1 with additive whole-asset / hybrid dialogue and music support plus a dedicated visual identity artifact.

---

## Overview

Tranche 1 proved the architecture and wiring we needed for a whole-video MiMo side path inside `emotion-engine`: shared media delivery config, URL-first staged media resolution, a whole-video Phase 2 side-path script, and a cod-test OpenRouter comparison config that resolves to a real `video_url` using the staged S3 asset. The remaining gap is live execution proof. Verification showed the current environment lacked `AI_API_KEY`, so tranche 1 stopped at request-shape proof rather than a real provider-backed artifact.

Tranche 2 should therefore start with the stronger long-term provider path instead of sinking more effort into OpenRouter uncertainty. Based on today’s research and planning, Xiaomi-direct is the better target for staged public media URLs and the cleaner place to prove a live whole-video MiMo run. Once that exists, we can broaden the system around it by adding non-chunked or hybrid Phase 1 dialogue/music support and a new `visualIdentityData` artifact so richer Phase 3 reporting is preserved instead of being flattened into one opaque whole-video judgment.

This tranche remains additive. We are not replacing the current chunked system yet. We are adding a stronger multimodal lane and richer evidence-generation options that can later compete with or partially absorb parts of the older stitched flow.

---

## Tasks

### Task 1: Implement Xiaomi-direct provider support inside the adapter system

**Bead ID:** `ee-gr0r`  
**SubAgent:** `coder`  
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, implement direct Xiaomi provider support as a first-class adapter/provider path aligned with docs/design/2026-03-31-xiaomi-direct-provider-support.md. Keep it inside the existing adapter/provider architecture, not as a one-off script. Support staged URL media handling, auth/env resolution, request normalization, error capture, and retries/timeouts where appropriate. Add focused tests. Claim bead <id> on start with bd update <id> --status in_progress --json and close it on completion with bd close <id> --reason "..." --json.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `server/lib/`
- `server/providers/`
- `server/scripts/`
- `test/lib/`
- `test/ai-providers/`
- `test/scripts/`
- `docs/`

**Files Created/Deleted/Modified:**
- `.plans/2026-03-31-mimo-tranche2-xiaomi-and-phase1.md`
- `.env.example`
- `docs/CONFIG-GUIDE.md`
- `server/lib/ai-recovery-lane.cjs`
- `server/lib/ai-targets.cjs`
- `server/lib/provider-registry.cjs`
- `server/lib/provider-runtime-config.cjs`
- `server/providers/xiaomi.cjs`
- `server/scripts/get-context/get-dialogue.cjs`
- `server/scripts/get-context/get-music.cjs`
- `server/scripts/process/video-chunks.cjs`
- `server/scripts/process/whole-video-mimo.cjs`
- `server/scripts/report/recommendation.cjs`
- `test/ai-providers/xiaomi-provider.test.js`
- `test/lib/ai-targets.test.js`
- `test/lib/provider-runtime-config.test.js`
- `test/scripts/video-chunks.test.js`
- `test/scripts/whole-video-mimo.test.js`

**Status:** ✅ Complete

**Results:** Added a repo-local Xiaomi provider overlay inside the existing adapter/provider architecture instead of a one-off script. The new path includes a local provider registry overlay, provider-aware env/auth/baseUrl/timeout resolution, Xiaomi request normalization for text+media attachments, staged-URL-friendly media handling through the tranche-1 delivery contract, provider debug/error capture, and the existing `executeWithTargets` retry/failover path. Also updated direct-provider call sites (`whole-video-mimo`, `video-chunks`, `get-dialogue`, `get-music`, `recommendation`, and AI recovery) so provider-specific env vars work beyond `AI_API_KEY`. Focused tests now cover the Xiaomi provider request shape, runtime env resolution, local provider loading, staged URL execution wiring, and the updated provider-credential gating.

---

### Task 2: Add a cod-test Xiaomi-direct MiMo config and prove a live staged-URL smoke run

**Bead ID:** `ee-4k05`  
**SubAgent:** `coder`  
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, add a narrow cod-test Xiaomi-direct MiMo config using the canonical staged asset URL https://gambit-games-tests.s3.us-east-1.amazonaws.com/peanut-gallery/cod.mp4. Validate the config, perform the smallest safe live smoke run possible, and capture exact commands, logs, outputs, and failure/success conditions. The goal is to prove a real provider-backed whole-video artifact, not just request-shape wiring. Claim bead <id> on start with bd update <id> --status in_progress --json and close it on completion with bd close <id> --reason "..." --json.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `configs/`
- `output/`
- `.logs/`

**Files Created/Deleted/Modified:**
- `.plans/2026-03-31-mimo-tranche2-xiaomi-and-phase1.md`
- `configs/cod-test-mimo-xiaomi-direct-smoke.yaml`
- `.logs/2026-03-31-cod-test-mimo-xiaomi-direct-smoke-validate-configs.log`
- `.logs/2026-03-31-cod-test-mimo-xiaomi-direct-smoke-dry-run.log`
- `.logs/2026-03-31-cod-test-mimo-xiaomi-direct-smoke-live.log`
- `output/cod-test-mimo-xiaomi-direct-smoke/phase2-process/script-results/whole-video-mimo.failure.json`
- `output/cod-test-mimo-xiaomi-direct-smoke/phase2-process/raw/_meta/errors.jsonl`
- `output/cod-test-mimo-xiaomi-direct-smoke/phase2-process/raw/_meta/errors.summary.json`
- `output/cod-test-mimo-xiaomi-direct-smoke/_meta/ai/_prompts/f5bae11e897f31cd733d623573500947642e6ae2f61c044c001e7f67a21dd200.json`

**Status:** ✅ Complete

**Results:** Added `configs/cod-test-mimo-xiaomi-direct-smoke.yaml` as the narrowest Xiaomi-direct lane: process-only `whole-video-mimo`, staged public S3 `video_url`, `allowedModes: [url]`, and `ai.video.retry.maxAttempts: 1` to keep the live proof attempt single-shot. The initial same-day live attempt failed with Xiaomi HTTP 401 `invalid_key` while the runtime only had the fallback credential path available. After local `XIAOMI_API_KEY` was provided, the rerun succeeded. Validation command: `npm run pipeline -- --config configs/cod-test-mimo-xiaomi-direct-smoke.yaml --dry-run --verbose` (`.logs/2026-03-31-cod-test-mimo-xiaomi-direct-smoke-rerun-dry-run.log`). Live command: `npm run pipeline -- --config configs/cod-test-mimo-xiaomi-direct-smoke.yaml --verbose` (`.logs/2026-03-31-cod-test-mimo-xiaomi-direct-smoke-rerun-live.log`). The live run produced a real provider-backed `output/cod-test-mimo-xiaomi-direct-smoke/phase2-process/whole-video-analysis.json`, raw capture at `output/cod-test-mimo-xiaomi-direct-smoke/phase2-process/raw/ai/whole-video/attempt-01/capture.json`, and `phase2-process/raw/_meta/errors.summary.json` with `outcome: success` / `totalErrors: 0`. The capture shows a Xiaomi direct request to the staged public S3 URL `https://gambit-games-tests.s3.us-east-1.amazonaws.com/peanut-gallery/cod.mp4` and a 200 response from `https://api.xiaomimimo.com/v1/chat/completions`, so the live whole-video proof is now complete.

---

### Task 3: Implement additive Phase 1 whole-asset / hybrid dialogue support

**Bead ID:** `ee-jdji`  
**SubAgent:** `coder`  
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, implement additive Phase 1 whole-asset or hybrid dialogue support as designed in docs/phase1-non-chunked-and-visual-identity-plan-2026-03-31.md. Preserve the existing dialogueData contract and extend it additively with provenance / analysis-mode metadata rather than breaking consumers. Add focused tests and keep chunking available where it still wins. Claim bead <id> on start with bd update <id> --status in_progress --json and close it on completion with bd close <id> --reason "..." --json.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `server/`
- `test/`

**Files Created/Deleted/Modified:**
- `.plans/2026-03-31-mimo-tranche2-xiaomi-and-phase1.md`
- `server/scripts/get-context/get-dialogue.cjs`
- `server/lib/structured-output.cjs`
- `server/lib/phase1-validator-tools.cjs`
- `test/scripts/get-dialogue.test.js`
- `test/lib/phase1-validator-tools.test.js`

**Status:** ✅ Complete

**Results:** Added additive `settings.phase1.dialogue.*` execution controls for `auto`, `whole_asset`, `chunked`, and `hybrid` while keeping the existing chunked path intact and still available when inline budget or timing-stability rules say chunking wins. `dialogueData` now keeps its existing `dialogue_segments`, `speaker_profiles`, `summary`, `handoffContext`, `totalDuration`, and optional `cleanedTranscript` contract while adding preserved analysis metadata (`analysisMode`, `timingMode`, `sourceStrategy`, `coverage`, `provenance`, `qualityNotes`). Hybrid mode now preserves a whole-asset summary/context pass while refining timings through the existing chunk/stitch path; explicit whole-asset / hybrid requests can fall back to chunked with provenance flags when inline transport forces it. Focused tests run: `node --test test/scripts/get-dialogue.test.js test/lib/phase1-validator-tools.test.js` and `node --test test/scripts/video-chunks.test.js`.

---

### Task 4: Implement additive Phase 1 whole-asset / hybrid music support

**Bead ID:** `ee-dond`  
**SubAgent:** `coder`  
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, implement additive Phase 1 whole-asset or hybrid music support as designed in docs/phase1-non-chunked-and-visual-identity-plan-2026-03-31.md. Preserve the existing musicData contract and extend it additively with provenance / analysis-mode metadata rather than breaking consumers. Add focused tests and keep chunking available where it still wins. Claim bead <id> on start with bd update <id> --status in_progress --json and close it on completion with bd close <id> --reason "..." --json.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `server/`
- `test/`

**Files Created/Deleted/Modified:**
- `.plans/2026-03-31-mimo-tranche2-xiaomi-and-phase1.md`
- `server/scripts/get-context/get-music.cjs`
- `test/scripts/get-music.test.js`

**Status:** ✅ Complete (verified)

**Results:** Added additive whole-asset and hybrid Phase 1 music modes behind `settings.phase1.music.*` controls while keeping legacy chunked behavior as the default. `musicData` now preserves `segments`, `summary`, and `hasMusic` while extending the artifact with `analysisMode`, `timingMode`, `sourceStrategy`, `coverage`, optional `globalArc`, `qualityNotes`, and `provenance` metadata. Hybrid mode carries whole-asset arc context into chunk prompts; explicit whole-asset mode falls back to chunked when inline budget/duration gating says chunking still wins. Verified after the broken handoff under bead `ee-ga8a`: the lane is complete rather than partial, no code repair was required, and the landed implementation files for this lane remain `server/scripts/get-context/get-music.cjs` and `test/scripts/get-music.test.js` (this follow-up only updated the plan). Focused verification tests run: `node --test test/scripts/get-music.test.js` and `node --test test/scripts/video-chunks.test.js test/scripts/whole-video-mimo.test.js test/scripts/get-visual-identity.test.js`.

---

### Task 5: Implement dedicated Phase 1 visual identity artifact/lane

**Bead ID:** `ee-s1jj`  
**SubAgent:** `coder`  
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, implement the dedicated Phase 1 visual identity lane/artifact as designed in docs/phase1-non-chunked-and-visual-identity-plan-2026-03-31.md. Add a separate visualIdentityData artifact rather than overloading chunkAnalysis, keep it compatible with existing reporting, and add focused tests. Claim bead <id> on start with bd update <id> --status in_progress --json and close it on completion with bd close <id> --reason "..." --json.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `server/lib/`
- `server/scripts/get-context/`
- `server/scripts/process/`
- `server/scripts/report/`
- `test/pipeline/`
- `test/scripts/`

**Files Created/Deleted/Modified:**
- `.plans/2026-03-31-mimo-tranche2-xiaomi-and-phase1.md`
- `server/lib/artifact-manager.cjs`
- `server/lib/config-loader.cjs`
- `server/lib/persisted-artifacts.cjs`
- `server/lib/script-contract.cjs`
- `server/lib/visual-identity-validator.cjs`
- `server/run-pipeline.cjs`
- `server/scripts/get-context/get-visual-identity.cjs`
- `server/scripts/process/whole-video-mimo.cjs`
- `server/scripts/report/evaluation.cjs`
- `test/pipeline/config-loader.test.js`
- `test/scripts/get-visual-identity.test.js`
- `test/scripts/whole-video-mimo.test.js`

**Status:** ✅ Complete

**Results:** Added a dedicated Phase 1 `visualIdentityData` artifact lane with a new validator-backed `get-visual-identity.cjs` full-video analysis path that writes `phase1-gather-context/visual-identity-data.json` instead of overloading `chunkAnalysis`. Persisted artifact hydration, artifact phase mapping, script-contract pathing, optional `ai.video_identity` validation, and legacy evaluation payload export now recognize the new artifact. `whole-video-mimo.cjs` also accepts `visualIdentityData` as additive context without changing existing behavior when the artifact is absent. Focused tests run: `node --test test/scripts/get-visual-identity.test.js test/scripts/whole-video-mimo.test.js test/pipeline/config-loader.test.js`.

---

### Task 6: Verify tranche-2 outputs and update MiMo handoff state

**Bead ID:** `ee-rig5`  
**SubAgent:** `primary`  
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, verify tranche-2 outputs after implementation tasks complete. Confirm files exist, run relevant tests/validation, record what is proven live versus only locally validated, update the plan with real results, and prepare the next explicit MiMo handoff. Claim bead <id> on start with bd update <id> --status in_progress --json and close it on completion with bd close <id> --reason "..." --json.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `output/`
- `.logs/`

**Files Created/Deleted/Modified:**
- `.plans/2026-03-31-mimo-tranche2-xiaomi-and-phase1.md`
- `.logs/2026-03-31-mimo-tranche2-file-check.log`
- `.logs/2026-03-31-mimo-tranche2-focused-tests.log`
- `.logs/2026-03-31-mimo-tranche2-validate-configs.log`
- `.logs/2026-03-31-mimo-tranche2-live-proof.log`

**Status:** ✅ Complete

**Results:** Verified the tranche-2 landing with durable file checks, focused tests, config validation, and live-artifact inspection. Exact verification commands run:

```bash
bd update ee-rig5 --status in_progress --json

printf '%s\n' \
  configs/cod-test-mimo-xiaomi-direct-smoke.yaml \
  .logs/2026-03-31-cod-test-mimo-xiaomi-direct-smoke-rerun-dry-run.log \
  .logs/2026-03-31-cod-test-mimo-xiaomi-direct-smoke-rerun-live.log \
  output/cod-test-mimo-xiaomi-direct-smoke/phase2-process/whole-video-analysis.json \
  output/cod-test-mimo-xiaomi-direct-smoke/phase2-process/raw/ai/whole-video/attempt-01/capture.json \
  output/cod-test-mimo-xiaomi-direct-smoke/phase2-process/raw/_meta/errors.summary.json \
  server/providers/xiaomi.cjs \
  server/scripts/get-context/get-dialogue.cjs \
  server/scripts/get-context/get-music.cjs \
  server/scripts/get-context/get-visual-identity.cjs \
  server/scripts/process/whole-video-mimo.cjs \
  test/ai-providers/xiaomi-provider.test.js \
  test/scripts/get-dialogue.test.js \
  test/scripts/get-music.test.js \
  test/scripts/get-visual-identity.test.js | while read -r f; do if [ -e "$f" ]; then echo "OK $f"; else echo "MISSING $f"; fi; done

node --test test/ai-providers/xiaomi-provider.test.js test/lib/ai-targets.test.js test/lib/provider-runtime-config.test.js test/scripts/video-chunks.test.js test/scripts/whole-video-mimo.test.js test/scripts/get-dialogue.test.js test/lib/phase1-validator-tools.test.js test/scripts/get-music.test.js test/scripts/get-visual-identity.test.js test/pipeline/config-loader.test.js

npm run pipeline -- --config configs/cod-test-mimo-xiaomi-direct-smoke.yaml --dry-run --verbose
```

Verification logs:
- `.logs/2026-03-31-mimo-tranche2-file-check.log`
- `.logs/2026-03-31-mimo-tranche2-focused-tests.log`
- `.logs/2026-03-31-mimo-tranche2-validate-configs.log`
- `.logs/2026-03-31-mimo-tranche2-live-proof.log`

**Live-proven Xiaomi results**
- `output/cod-test-mimo-xiaomi-direct-smoke/phase2-process/whole-video-analysis.json` exists and records `provider.adapter: xiaomi`, `model: mimo-v2-omni`, `transport: public_url`, source asset `examples/videos/emotion-tests/cod.mp4`, staged URL `https://gambit-games-tests.s3.us-east-1.amazonaws.com/peanut-gallery/cod.mp4`, and a retained verdict of `wouldComplete: yes` / `confidence: 0.82`.
- `output/cod-test-mimo-xiaomi-direct-smoke/phase2-process/raw/ai/whole-video/attempt-01/capture.json` proves a real Xiaomi-direct POST to `https://api.xiaomimimo.com/v1/chat/completions` with the staged S3 `video_url`, returning HTTP `200`, response id `e1049f9e3dd54b7b92d246287f643375`, and usage `{ input: 46071, output: 2541, total: 48612 }`.
- `output/cod-test-mimo-xiaomi-direct-smoke/phase2-process/raw/_meta/errors.summary.json` records `outcome: success` and `totalErrors: 0`.
- `.logs/2026-03-31-cod-test-mimo-xiaomi-direct-smoke-rerun-live.log` confirms the process-only Xiaomi smoke lane completed end-to-end and saved the output packet.

**Locally validated additive lanes only**
- Dialogue whole-asset / hybrid support is present in `server/scripts/get-context/get-dialogue.cjs` and covered by `test/scripts/get-dialogue.test.js` plus `test/lib/phase1-validator-tools.test.js`, including additive metadata, fallback provenance, and hybrid timing refinement.
- Music whole-asset / hybrid support is present in `server/scripts/get-context/get-music.cjs` and covered by `test/scripts/get-music.test.js`, including additive metadata, whole-asset mode, hybrid refinement, and chunked fallback behavior.
- The dedicated visual identity lane is present in `server/scripts/get-context/get-visual-identity.cjs` and covered by `test/scripts/get-visual-identity.test.js`, `test/scripts/whole-video-mimo.test.js`, and `test/pipeline/config-loader.test.js`.
- No fresh provider-backed verification run in this Task 6 generated live `dialogue-data.json`, `music-data.json`, or `visual-identity-data.json` artifacts for the cod asset, so those additive Phase 1 lanes are still honestly classified as locally validated contract/test proof rather than live-proven runtime proof.

---

## Execution Order Recommendation

1. **Xiaomi-direct provider support**
2. **Xiaomi cod-test live smoke run**
3. **Dialogue Phase 1 additive expansion**
4. **Music Phase 1 additive expansion**
5. **Visual identity artifact/lane**
6. **Verification + handoff**

This ordering held: the Xiaomi-backed whole-video artifact was proven first, then the supporting evidence lanes were implemented and truth-verified without overstating live coverage.

---

## Key References

- Tranche 1 implementation: `.plans/2026-03-31-mimo-tranche1-implementation.md`
- Xiaomi provider design: `docs/design/2026-03-31-xiaomi-direct-provider-support.md`
- Phase 1 expansion design: `docs/phase1-non-chunked-and-visual-identity-plan-2026-03-31.md`
- Whole-video Phase 2 design: `docs/design/mimo-whole-video-phase2-prototype-2026-03-31.md`
- Media contract: `docs/MIMO-MEDIA-DELIVERY-CONTRACT-2026-03-31.md`
- Canonical staged asset: `https://gambit-games-tests.s3.us-east-1.amazonaws.com/peanut-gallery/cod.mp4`

---

## Next MiMo handoff

1. **Run one bounded live Phase 1 proof lane before any tranche-3 work**
   - Add a cod-test config that explicitly exercises `settings.phase1.dialogue.mode: hybrid`, `settings.phase1.music.mode: hybrid`, and `settings.phase1.visual_identity.enabled: true` against the canonical cod asset.
   - Keep the run scope narrow: the goal is persistent Phase 1 artifacts, not a broad new feature sweep.

2. **Promote additive lanes from local proof to runtime proof**
   - Persist and inspect `phase1-gather-context/dialogue-data.json`, `phase1-gather-context/music-data.json`, and `phase1-gather-context/visual-identity-data.json` from a real run.
   - Record each artifact’s `analysisMode`, `timingMode`, `sourceStrategy`, and `provenance` so whole-asset vs hybrid vs chunk-fallback behavior is reported truthfully.

3. **Compare against the current chunked baseline instead of replacing it**
   - Diff the additive Phase 1 artifacts against the existing chunked cod-test outputs for timing truthfulness, continuity, and fallback behavior.
   - If any lane falls back to chunked in practice, preserve that fact explicitly rather than calling it a whole-asset proof.

4. **Only after that proof exists, decide the next MiMo expansion**
   - The recommended next lane is a bounded cod-test Phase 1 proof/compare run, not tranche-3 implementation.

---

## Final Results

**Status:** ✅ Complete

**What We Built:** Tranche 2 is now verified. The repo contains a live-proven Xiaomi-direct whole-video MiMo smoke lane using the staged public S3 asset, plus additive Phase 1 dialogue, music, and visual identity expansions that remain contract-stable and are verified by focused local tests. The plan now records the honest boundary: Xiaomi whole-video execution is proven live; the additive Phase 1 evidence lanes are implemented and locally validated, but still need one bounded real-run proof packet.

**Commits:**
- Pending

**Lessons Learned:** The right rollout shape was to prove one real Xiaomi-backed whole-video artifact first, then extend surrounding evidence lanes additively without pretending they were already live-proven. The remaining risk is no longer provider reachability for Xiaomi whole-video; it is the missing runtime proof packet for the new additive Phase 1 artifact modes.
