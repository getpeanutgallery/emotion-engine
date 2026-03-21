# emotion-engine: investigate provider-transport await seam in record mode

**Date:** 2026-03-18  
**Status:** Complete  
**Agent:** Cookie 🍪

---

## Goal

Determine why the Phase 2 chunk-4 OpenRouter request in record mode stalls inside `digital-twin-router` at `await realTransport(request)` and land the smallest truthful source-owned fix.

---

## Overview

The current record-mode blocker is no longer about cassette-path routing, `engine.record(...)`, or AI recovery unwinding. Fresh clean-install evidence shows the run advances through Phase 1 and Phase 2 chunks 1-3, then times out on Phase 2 chunk 4 after emitting only `record.realTransport.await.start` from `digital-twin-router`. There is no matching `record.realTransport.await.end`, no `record.engine.record.await.start`, and no completed chunk-4 response in the fresh cassette.

That means the next engineering lane has to start at the real provider transport boundary used by the Phase 2 `video-chunks` path. The execution chain to verify is: `emotion-engine/server/scripts/process/video-chunks.cjs` -> `../tools/emotion-lenses-tool.cjs` -> `../tools/lib/local-validator-tool-loop.cjs` -> `provider.complete(...)` -> `ai-providers/providers/openrouter.cjs` -> `digital-twin-router/index.js` `await realTransport(request)`. The first job is to prove the exact installed/runtime resolution at that seam before adding any more breadcrumbs or changing behavior.

Use the existing clean rerun artifacts as the baseline truth for this lane:
- log: `emotion-engine/.logs/cod-test-20260318-214258-clean-refresh-rerun.log`
- cassette: `digital-twin-openrouter-emotion-engine/cassettes/cod-test-record-20260318-214258.json`
- events tail: `emotion-engine/output/cod-test/_meta/events.jsonl` ending at seq `840` with the chunk-4 `provider.call.start`

Guardrail: do not patch `node_modules`. Any instrumentation or fix must land in the owning source repo(s), then be refreshed into consumers cleanly. This is an explicit Derrick constraint for this lane because stray `node_modules` edits have been a recurring failure mode; subagents must treat it as a hard stop.

---

## Tasks

### Task 1: Prove the active Phase 2 runtime resolution at the provider seam

**Bead ID:** `ee-406`  
**SubAgent:** `primary`
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, claim bead ee-406 with bd update ee-406 --status in_progress --json, then trace the exact runtime resolution used by the Phase 2 video-chunks path for provider transport in record mode. Prove which files are actually loaded for ../tools/emotion-lenses-tool.cjs, ../tools/lib/local-validator-tool-loop.cjs, ai-providers/providers/openrouter.cjs, and digital-twin-router/index.js during the cod-test path, then update this plan with the exact resolved paths and any drift found. Hard guardrail: do not patch node_modules or make ad-hoc installed-package edits; if runtime drift is found, document it and modify only owning source repos or plan/docs unless an explicit next-step fix is requested. Close bead ee-406 when finished.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `../tools/`
- `../ai-providers/`
- `../digital-twin-router/`

**Files Created/Deleted/Modified:**
- `.plans/2026-03-18-investigate-provider-transport-await-seam.md`
- runtime-resolution notes or touched source files only if needed

**Status:** ✅ Complete

**Results:** Proved the live record-mode resolution chain without touching `node_modules`.

- Exact loaded path from the Phase 2 entrypoint:
  - `emotion-engine/server/scripts/process/video-chunks.cjs` requires `../../../../tools/emotion-lenses-tool.cjs` -> `/home/derrick/.openclaw/workspace/projects/peanut-gallery/tools/emotion-lenses-tool.cjs`
  - `tools/emotion-lenses-tool.cjs` requires `./lib/local-validator-tool-loop.cjs` -> `/home/derrick/.openclaw/workspace/projects/peanut-gallery/tools/lib/local-validator-tool-loop.cjs`
- Critical seam truth: `tools/lib/local-validator-tool-loop.cjs` does **not** resolve/load the provider itself. The real provider object is created earlier in `emotion-engine/server/lib/ai-targets.cjs#getProviderForTarget(...)` and injected into `emotionLensesTool.executeEmotionAnalysisToolLoop({ provider, ... })`, which then calls `provider.complete(...)` through the `callProvider` callback.
- Exact provider transport files actually reached by the live seam:
  - `emotion-engine/server/lib/ai-targets.cjs` resolves `ai-providers/ai-provider-interface.js` from the emotion-engine install, not from `../tools`.
  - That installed provider interface resolves `./providers/openrouter.cjs` -> `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/node_modules/ai-providers/providers/openrouter.cjs`
  - In record mode, `openrouter.cjs` lazily requires `digital-twin-router` inside `complete(...)`, resolving to `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/node_modules/digital-twin-router/index.js`
- Evidence used:
  - Static code path review:
    - `video-chunks.cjs` imports `../../../../tools/emotion-lenses-tool.cjs` and passes `provider` from `getProviderForTarget(...)` into `executeEmotionAnalysisToolLoop(...)`.
    - `tools/emotion-lenses-tool.cjs` forwards provider calls via `callProvider: ({ prompt }) => provider.complete(...)`.
    - `emotion-engine/node_modules/ai-providers/providers/openrouter.cjs` only requires `digital-twin-router` when `DIGITAL_TWIN_MODE`/test mode is active.
  - Dynamic load proof with a small Node harness:
    - observed module loads for the cod-test chain as:
      1. `/home/derrick/.openclaw/workspace/projects/peanut-gallery/tools/emotion-lenses-tool.cjs`
      2. `/home/derrick/.openclaw/workspace/projects/peanut-gallery/tools/lib/local-validator-tool-loop.cjs`
      3. `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/node_modules/ai-providers/providers/openrouter.cjs`
      4. `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/node_modules/digital-twin-router/index.js`
    - forcing `DIGITAL_TWIN_MODE=record` with no pack confirmed the lazy record-mode boundary: `provider.complete(...)` loaded `digital-twin-router` and then stopped at the expected env guard (`DIGITAL_TWIN_PACK environment variable must be set when using digital twin transport`) before any network call.
- Drift found:
  - `../tools` still has its **own** installed `tools/node_modules/ai-providers/ai-provider-interface.js`, and `emotion-lenses-tool.cjs` imports it at module top level.
  - That tools-local install resolves `./providers/openrouter.cjs` to `/home/derrick/.openclaw/workspace/projects/peanut-gallery/tools/node_modules/ai-providers/providers/openrouter.cjs`, which is a different file from the emotion-engine installed copy (different SHA-256 / byte size) and currently cannot run record mode because `tools/node_modules/digital-twin-router` is missing.
  - Controlled proof: calling the tools-local provider in record mode fails with `Cannot find module 'digital-twin-router'` from `tools/node_modules/ai-providers/providers/openrouter.cjs`.
  - Therefore the active Phase 2 record-mode seam is only working because `video-chunks.cjs` injects the provider object from emotion-engine’s `server/lib/ai-targets.cjs`; if `emotion-lenses-tool.cjs` ever falls back to `getActiveProvider(...)`, it would drift onto the stale tools-local install and fail.
- Installed-vs-source alignment at the live seam:
  - `emotion-engine/node_modules/digital-twin-router/index.js` matches sibling source `../digital-twin-router/index.js` byte-for-byte (same SHA-256), so the live router install is aligned with the sibling source repo.
  - `emotion-engine/node_modules/ai-providers/providers/openrouter.cjs` does **not** match sibling source `../ai-providers/providers/openrouter.cjs`, so the live OpenRouter transport code is an installed snapshot rather than the current sibling working tree.
  - `emotion-engine/package-lock.json` pins:
    - `node_modules/ai-providers` -> `git+ssh://git@github.com/getpeanutgallery/ai-providers.git#1a6dc181d646fe350ac2acc248f7036ef9a71bae`
    - `node_modules/digital-twin-router` -> `git+file:///home/derrick/.openclaw/workspace/projects/peanut-gallery/digital-twin-router#695f0db98ebcc619c1cb33588a62a933ccb0747b`

Net: the real Phase 2 record-mode provider await seam is `video-chunks.cjs` -> sibling `tools/emotion-lenses-tool.cjs` -> sibling `tools/lib/local-validator-tool-loop.cjs` -> **injected** provider from `emotion-engine/server/lib/ai-targets.cjs` -> installed `emotion-engine/node_modules/ai-providers/providers/openrouter.cjs` -> installed `emotion-engine/node_modules/digital-twin-router/index.js`. The biggest actionable drift is the stale/self-inconsistent `tools/node_modules/ai-providers` fallback path, but it was documented only here and not changed.

---

### Task 2: Eliminate the stale tools-local provider fallback before touching the real transport seam

**Bead ID:** `ee-9e1`  
**SubAgent:** `primary`
**Prompt:** `After ee-406 proves the live resolution chain, claim bead ee-9e1 with bd update ee-9e1 --status in_progress --json, then eliminate or hard-fail the dangerous tools-local provider fallback in the owning source repo before adding more transport breadcrumbs. Prefer the narrowest source-owned fix surface; do not patch node_modules. Update this plan with exact files changed, direct runtime proof, and the next real transport validation lane, then close bead ee-9e1 if the fix surface is proven and the next lane is unambiguous.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `../tools/`

**Files Created/Deleted/Modified:**
- `.plans/2026-03-18-investigate-provider-transport-await-seam.md`
- `../tools/emotion-lenses-tool.cjs`
- `../tools/test/emotion-lenses-tool.test.js`
- `emotion-engine/test/scripts/emotion-lenses-tool.test.js`

**Status:** ✅ Complete

**Results:** The stale fallback risk was real, source-owned, and narrow enough to fix without touching installed packages.

- Reconfirmed direct runtime drift:
  - canonical seam remains `video-chunks.cjs` -> `../tools/emotion-lenses-tool.cjs` -> injected provider from `emotion-engine/server/lib/ai-targets.cjs` -> `emotion-engine/node_modules/ai-providers/providers/openrouter.cjs` -> `emotion-engine/node_modules/digital-twin-router/index.js`
  - fallback seam remained separate and stale: `../tools/node_modules/ai-providers/providers/openrouter.cjs`
  - `emotion-engine` and `tools` installed `openrouter.cjs` snapshots still differ by SHA-256, and `../tools` still lacks a resolvable `digital-twin-router`
- Controlled failure proof:
  - calling the tools-local provider directly in `DIGITAL_TWIN_MODE=record` still fails with `Cannot find module 'digital-twin-router'`
- Smallest owning-repo fix surface proved:
  - the risky silent drift was caused by `../tools/emotion-lenses-tool.cjs#getActiveProvider(...)`
  - that module now lazy-loads `ai-providers` only for explicit opt-in fallback and otherwise throws `EmotionLensesTool: provider must be injected explicitly; refusing fallback to tools-local ai-providers install`
  - requiring `../tools/emotion-lenses-tool.cjs` and calling `analyze(...)` without a provider no longer loads anything from `../tools/node_modules/ai-providers/`
- Validation:
  - `node --test ../tools/test/emotion-lenses-tool.test.js`
  - `node --test test/scripts/emotion-lenses-tool.test.js`
  - both passed after updating tests to inject providers explicitly and assert the new hard-fail path
- Outcome:
  - this closes the stale-fallback lane cleanly without mutating `node_modules`
  - the next code-change/validation lane is now precise: run a bounded record-mode reproduction on the real installed provider/router seam and classify whether the original `await realTransport(request)` hang still reproduces.

---

### Task 3: Reproduce with a bounded record-mode rerun and classify the unresolved await precisely

**Bead ID:** `ee-wo3`  
**SubAgent:** `primary`
**Prompt:** `After ee-9e1 lands the minimal source-owned instrumentation, claim bead ee-wo3 with bd update ee-wo3 --status in_progress --json, then run only the bounded record-mode reproduction needed to capture the next breadcrumb boundary for the cod-test Phase 2 hang. Use a fresh cassette name, preserve the fresh log/events/cassette artifacts, and classify whether the await is stuck before HTTP completion, during response transformation, or during wrapped error propagation. Hard guardrail: do not patch node_modules or make ad-hoc installed-package edits. Update this plan with the exact command, timeout result, and artifact paths, then close bead ee-wo3 on completion.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `.logs/`
- `output/`
- `../digital-twin-openrouter-emotion-engine/cassettes/`

**Files Created/Deleted/Modified:**
- `.plans/2026-03-18-investigate-provider-transport-await-seam.md`
- fresh bounded rerun log(s)
- fresh cassette(s)
- fresh output meta/artifact files from the bounded rerun

**Status:** ✅ Complete

**Results:** Claimed `ee-wo3` and reran the smallest bounded reproduction already proven to hit this seam cleanly: a timeout-wrapped true record-mode `cod-test` pipeline run with a fresh cassette id after the tools-local fallback hard-fail landed.

- Exact command executed:
  - `DIGITAL_TWIN_MODE=record DIGITAL_TWIN_PACK=/home/derrick/.openclaw/workspace/projects/peanut-gallery/digital-twin-openrouter-emotion-engine DIGITAL_TWIN_CASSETTE=cod-test-record-20260320-123834-ee-wo3 timeout 300s node server/run-pipeline.cjs --config configs/cod-test.yaml --verbose 2>&1 | tee .logs/cod-test-20260320-123834-ee-wo3.log`
- Terminal outcome:
  - exit code `124`
  - Phase 1 completed successfully
  - Phase 2 chunks 1-3 completed successfully
  - rerun stalled again on Phase 2 chunk 4 (`15.0s-20.0s`, zero-based `chunkIndex: 3`)
- Fresh artifacts:
  - log: `.logs/cod-test-20260320-123834-ee-wo3.log`
  - cassette: `../digital-twin-openrouter-emotion-engine/cassettes/cod-test-record-20260320-123834-ee-wo3.json`
  - events: `output/cod-test/_meta/events.jsonl`
  - fresh Phase 2 AI pointers: `output/cod-test/phase2-process/raw/ai/chunk-0.json`, `output/cod-test/phase2-process/raw/ai/chunk-1.json`, `output/cod-test/phase2-process/raw/ai/chunk-2.json`
  - absent fresh chunk-4 success artifacts: no `output/cod-test/phase2-process/raw/ai/chunk-3.json` and no `output/cod-test/phase2-process/raw/ai/chunk-0003/...`
- Fresh evidence boundary:
  - log tail ends with only `[digital-twin-router] record.realTransport.await.start cassette=cod-test-record-20260320-123834-ee-wo3`
  - there is no matching `record.realTransport.await.end`
  - there is no `record.engine.record.await.start` / `record.engine.record.await.end` for the stuck request
  - `output/cod-test/_meta/events.jsonl` ends at seq `903` with `provider.call.start` for `phase2-process` / `video-chunks` / `chunkIndex: 3`
  - cassette `../digital-twin-openrouter-emotion-engine/cassettes/cod-test-record-20260320-123834-ee-wo3.json` contains `9` interactions total, with the last recorded interaction timestamped `2026-03-20T16:43:09.475Z`, i.e. the completed chunk-3 boundary
- Classification:
  - the await still hangs **before HTTP completion returns into the router**
  - it is still the same installed seam: `digital-twin-router` `await realTransport(request)` for the Phase 2 chunk-4 first-turn provider call
  - it is **not** during response transformation and **not** during wrapped error propagation, because the run never reaches the post-transport breadcrumbs or `provider.call.end`
- Additional truth after the fallback seal:
  - because `../tools/emotion-lenses-tool.cjs` now refuses uninjected fallback, this rerun remained on the previously proven injected seam (`video-chunks.cjs` -> sibling `../tools/emotion-lenses-tool.cjs` -> injected provider from `emotion-engine/server/lib/ai-targets.cjs` -> installed `emotion-engine/node_modules/ai-providers/providers/openrouter.cjs` -> installed `emotion-engine/node_modules/digital-twin-router/index.js`) rather than drifting into `../tools/node_modules/ai-providers`
- Outcome:
  - this classification is precise enough to unblock the next fix lane, so `ee-wo3` can close cleanly and hand off to `ee-hxi` for the smallest source-owned fix/refresh cycle.

---

### Task 4: Land the smallest source-owned fix and refresh consumers cleanly

**Bead ID:** `ee-hxi`  
**SubAgent:** `primary`
**Prompt:** `Once ee-wo3 classifies the unresolved await precisely, claim bead ee-hxi with bd update ee-hxi --status in_progress --json, then implement the smallest truthful fix in the owning source repo(s), refresh emotion-engine consumers cleanly without patching node_modules, and rerun enough validation to prove the hang is resolved or more tightly reclassified. Hard guardrail: do not patch node_modules or make ad-hoc installed-package edits. Update this plan with exact repos/files changed, dependency refresh steps, validation commands, and remaining risk, then close bead ee-hxi on completion.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `../ai-providers/`
- `../digital-twin-router/`
- `emotion-engine/`

**Files Created/Deleted/Modified:**
- `.plans/2026-03-18-investigate-provider-transport-await-seam.md`
- `../ai-providers/providers/openrouter.cjs`
- `../ai-providers/test/openrouter-transformResponse.test.cjs`
- `emotion-engine/package-lock.json`
- owning runtime logs/cassettes/output artifacts from validation reruns

**Status:** ✅ Complete

**Results:** Claimed `ee-hxi` and landed the smallest truthful source-owned fix at the owning provider transport boundary in sibling `../ai-providers`, then refreshed `emotion-engine` from source and reran bounded record-mode validation. This lane later resolved fully via the 2026-03-20 follow-on plan: the broad 1200000ms timeout rollout was proven to be the regression, the narrow evidence-based `10000ms` timeout remained only on the first Phase 2 video target, and a fresh clean full `cod-test` acceptance rerun passed after that config restoration.

- Source-owned fix surface chosen:
  - `../ai-providers/providers/openrouter.cjs`
  - reason: the unresolved seam was still inside `digital-twin-router -> await realTransport(request)`, and the live installed `ai-providers` snapshot still sent OpenRouter Axios requests with no timeout bound
- Durable source changes landed in `../ai-providers`:
  - added `DEFAULT_TRANSPORT_TIMEOUT_MS = 120000`
  - added `_private.getTransportTimeoutMs(options)` that prefers `options.options.timeoutMs`, then `OPENROUTER_TIMEOUT_MS`, then the default
  - updated `runRequest(request, transportOptions)` to pass `timeout: getTransportTimeoutMs(transportOptions)` into Axios
  - threaded provider `options` through both direct and digital-twin `makeRealTransport(options)` calls so the owning provider transport, not `node_modules`, now owns the bound
  - exported `_private.runRequest` / `_private.getTransportTimeoutMs` for focused regression coverage
- Regression coverage added in `../ai-providers/test/openrouter-transformResponse.test.cjs`:
  - default/env/provider-option timeout resolution
  - `runRequest(...)` forwards the resolved timeout to Axios
- Owning-repo validation:
  - `node --test test/openrouter-transformResponse.test.cjs test/provider-debug.test.cjs`
  - passed (`18/18`)
- Clean consumer refresh (no `node_modules` edits by hand):
  - packed sibling source with `npm pack` in `../ai-providers` -> `../ai-providers/ai-providers-1.0.0.tgz`
  - refreshed the consumer install with `npm install --no-save ../ai-providers/ai-providers-1.0.0.tgz` from `emotion-engine`
  - installed runtime proof after refresh: `emotion-engine/node_modules/ai-providers/providers/openrouter.cjs` now contains `timeout: getTransportTimeoutMs(transportOptions)`
- Bounded reruns executed from `emotion-engine`:
  1. `DIGITAL_TWIN_MODE=record DIGITAL_TWIN_PACK=/home/derrick/.openclaw/workspace/projects/peanut-gallery/digital-twin-openrouter-emotion-engine DIGITAL_TWIN_CASSETTE=cod-test-record-20260320-1258-ee-hxi timeout 300s node server/run-pipeline.cjs --config configs/cod-test.yaml --verbose 2>&1 | tee .logs/cod-test-20260320-1258-ee-hxi.log`
  2. `DIGITAL_TWIN_MODE=record DIGITAL_TWIN_PACK=/home/derrick/.openclaw/workspace/projects/peanut-gallery/digital-twin-openrouter-emotion-engine DIGITAL_TWIN_CASSETTE=cod-test-record-20260320-1306-ee-hxi timeout 480s node server/run-pipeline.cjs --config configs/cod-test.yaml --verbose 2>&1 | tee .logs/cod-test-20260320-1306-ee-hxi.log`
- Fresh outcome / tighter classification:
  - the previously stuck boundary at Phase 2 `chunkIndex: 3` no longer hangs; in the fresh `1306` run it now reaches `provider.call.end` and writes `output/cod-test/phase2-process/raw/ai/chunk-3.json`
  - the seam still fails later, but now returns through the provider/router boundary instead of disappearing pre-return:
    - `output/cod-test/_meta/events.jsonl` shows `provider.call.end` for `phase2-process` / `chunkIndex: 4` with `ok:false`, `error:"OpenRouter: aborted"`, `errorClassification:"retryable"`
    - cassette `../digital-twin-openrouter-emotion-engine/cassettes/cod-test-record-20260320-1306-ee-hxi.json` records a synthetic error interaction for that request with `status: 599` and `error.name: OpenRouterError`
    - `output/cod-test/phase2-process/raw/ai/chunk-4.json` exists with fresh timestamp, proving the failure is now recorded at the seam instead of silently hanging before return
- Artifact paths preserved:
  - logs: `.logs/cod-test-20260320-1258-ee-hxi.log`, `.logs/cod-test-20260320-1306-ee-hxi.log`
  - cassettes: `../digital-twin-openrouter-emotion-engine/cassettes/cod-test-record-20260320-1258-ee-hxi.json`, `../digital-twin-openrouter-emotion-engine/cassettes/cod-test-record-20260320-1306-ee-hxi.json`
  - events: `output/cod-test/_meta/events.jsonl`
  - fresh Phase 2 raw pointers now include `output/cod-test/phase2-process/raw/ai/chunk-0.json` through `chunk-4.json`
- Final resolution note:
  - this provider-side fix remained part of the durable solution, but the last blocker turned out to be timeout policy rather than another library seam bug
  - `ee-hxi` ultimately closed only after the follow-on clean full rerun passed under the restored narrow config-owned timeout posture

---

## Final Results

**Status:** ✅ Complete

**What We Built:** Proved the real installed provider/router seam, sealed the dangerous tools-local provider fallback in `../tools`, and landed the owning OpenRouter transport timeout fix in `../ai-providers`. The later follow-on plan confirmed that the remaining regression lived in timeout policy, not another provider seam bug, and full `cod-test` acceptance passed again once the narrow evidence-based timeout posture was restored.

**Commits:**
- `2a6a037` - tools: Require injected provider in emotion lenses tool
- `44b7221` - ai-providers: Add provider-owned OpenRouter transport timeout

**Lessons Learned:** The installed runtime seam had to be proven before changing anything, the tools-local fallback really was dangerous enough to hard-fail, and the final blocker was policy/config around timeout behavior rather than another hidden node_modules-era patch surface.

---

*Completed on 2026-03-20*
