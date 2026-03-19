# emotion-engine: remove node_modules instrumentation and rerun cleanly

**Date:** 2026-03-18
**Status:** Complete
**Agent:** Cookie 🍪

---

## Goal

Remove the incorrect installed-copy instrumentation under `node_modules`, preserve the intended source-level breadcrumbs in the proper owning repo(s), refresh the consuming runtime cleanly, and then rerun the instrumented record-mode path without any manual install-tree edits.

---

## Overview

The tiny breadcrumb plan was directionally correct, but execution violated the polyrepo rule again: the installed copy under `emotion-engine/node_modules/digital-twin-router/index.js` was patched directly. That makes the current install tree untrustworthy as a source of evidence. Before we rerun anything, we need to restore the installed dependency tree to a clean state and ensure the runtime only consumes instrumentation through committed or refreshable source-owned paths.

This correction plan is tightly scoped. First, remove the bad `node_modules` instrumentation edit and document exactly what was reverted. Second, refresh the consuming install path cleanly so the runtime uses only the source-owned instrumentation from `digital-twin-router` plus the source instrumentation in `emotion-engine`. Third, rerun the instrumented record-mode path and inspect the breadcrumbs to answer the original second-turn hang question without any install-tree cheating.

---

## Tasks

### Task 1: Remove the bad node_modules instrumentation edit

**Bead ID:** `ee-w4n`
**SubAgent:** `main`
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, inspect the installed-copy instrumentation edit under node_modules, remove it cleanly, and verify there are no remaining manual instrumentation edits in installed dependency copies. Update this plan with exact paths reverted and mark the task complete. Claim the assigned bead on start and close it on completion.`

**Folders Created/Deleted/Modified:**
- `emotion-engine/node_modules/`
- `.plans/`

**Files Created/Deleted/Modified:**
- installed runtime file(s) only insofar as they are restored/removed
- `.plans/2026-03-18-remove-node-modules-instrumentation-and-rerun-cleanly.md`

**Status:** ✅ Complete

**Results:** Claimed bead `ee-w4n`, inspected the installed manual instrumentation in `emotion-engine/node_modules/digital-twin-router/index.js`, and restored that installed copy from the dependency commit pinned by `emotion-engine` (`770313a5e3bcab42cb380b3da28501d975aca031`). Exact reverted installed path: `emotion-engine/node_modules/digital-twin-router/index.js`. Verification: a direct diff against the pinned commit now shows `NO_DIFF`; a recursive grep across `emotion-engine/node_modules` for the added breadcrumb helper and breadcrumb strings (`logRecordBreadcrumb`, `record.realTransport.await.*`, `record.engine.record.await.*`, `[digital-twin-router] ... cassette=`) returned no matches; and `node --check node_modules/digital-twin-router/index.js` passed. No rerun was performed in this task.

---

### Task 2: Refresh the runtime cleanly and rerun the instrumented path

**Bead ID:** `ee-3gc`
**SubAgent:** `main`
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, after removing the bad node_modules instrumentation, refresh the runtime cleanly so the source-owned breadcrumbs are what the installed path consumes, then rerun the affected record-mode path and inspect the breadcrumbs to classify the unresolved await. Keep the rerun on the clean install path only. Update this plan with exact refresh/rerun evidence and close the assigned bead.`

**Folders Created/Deleted/Modified:**
- `emotion-engine/`
- `emotion-engine/node_modules/`
- `emotion-engine/output/`
- sibling cassette pack path
- `.plans/`

**Files Created/Deleted/Modified:**
- clean install artifacts as needed
- fresh rerun artifacts/logs/cassettes
- `.plans/2026-03-18-remove-node-modules-instrumentation-and-rerun-cleanly.md`

**Status:** ✅ Complete

**Results:** Claimed bead `ee-3gc`, then refreshed the runtime from the owning source repo instead of patching `node_modules` again. Exact refresh method: committed the intended router breadcrumbs in the sibling source repo `../digital-twin-router/index.js` as commit `695f0db98ebcc619c1cb33588a62a933ccb0747b` (`debug: add record-mode breadcrumbs around awaits`), repointed `emotion-engine/package.json` `overrides.digital-twin-router` to `git+file:///home/derrick/.openclaw/workspace/projects/peanut-gallery/digital-twin-router#695f0db`, and ran `npm install`. Verification after refresh: both direct and provider-context resolution (`require.resolve('digital-twin-router/package.json')` and `createRequire(require.resolve('ai-providers/package.json')).resolve('digital-twin-router/package.json')`) now point to the same real installed file `emotion-engine/node_modules/digital-twin-router/package.json`; `package-lock.json` now resolves `node_modules/digital-twin-router` to `git+file:///home/derrick/.openclaw/workspace/projects/peanut-gallery/digital-twin-router#695f0db98ebcc619c1cb33588a62a933ccb0747b`; `emotion-engine/node_modules/digital-twin-router/index.js` contains the source-owned breadcrumb helper + four record-mode await breadcrumbs; a direct diff against `git -C ../digital-twin-router show 695f0db98ebcc619c1cb33588a62a933ccb0747b:index.js` returned `NO_DIFF`; and `node --check node_modules/digital-twin-router/index.js` passed. That establishes the installed runtime now reflects source-owned instrumentation with no manual installed-copy edits remaining.

Then reran the affected record-mode path on the clean install only, with a fresh cassette id and captured log: `DIGITAL_TWIN_CASSETTE=cod-test-record-20260318-214258 timeout 300s node server/run-pipeline.cjs --config configs/cod-test.yaml --verbose 2>&1 | tee .logs/cod-test-20260318-214258-clean-refresh-rerun.log`. Outcome: the bounded rerun exited `124` (timeout) after Phase 1 completed successfully and Phase 2 advanced through chunks 1-3 successfully, then stalled on chunk 4 (`15.0s-20.0s`). Fresh evidence: log file `.logs/cod-test-20260318-214258-clean-refresh-rerun.log`; fresh cassette `../digital-twin-openrouter-emotion-engine/cassettes/cod-test-record-20260318-214258.json`; and fresh `output/cod-test/_meta/events.jsonl` entries for the rerun from seq `785` onward. The current run’s event tail ends at seq `840` with `provider.call.start` for `phase2-process` chunk `3` / split `0`, and there are fresh Phase 2 AI capture files only through chunk 2 (`output/cod-test/phase2-process/raw/ai/chunk-0000/...`, `chunk-0001/...`, `chunk-0002/...`, plus `chunk-0.json` through `chunk-2.json`). The refreshed router breadcrumbs sharpen the classification: the terminal log line is `[digital-twin-router] record.realTransport.await.start cassette=cod-test-record-20260318-214258`, and there is **no** matching `record.realTransport.await.end`, **no** `record.engine.record.await.start`, **no** `record.engine.record.await.end`, and the fresh cassette contains only `9` interactions total (Phase 1 plus Phase 2 chunks 1-3) with no completed response recorded for chunk 4. Exact conclusion: on the clean installed runtime, the unresolved await is currently **inside `digital-twin-router` at `await realTransport(request)` for the Phase 2 chunk-4 first-turn provider call**, i.e. before the provider response returned into the router, before cassette persistence (`engine.record`) began, and before any second-turn/local-validator completion path could fire.

One additional truth surfaced while inspecting the rerun evidence: the Phase 2 lane still does not emit `tool.loop.provider.await.*` events because `video-chunks` calls `../tools/emotion-lenses-tool.cjs`, which in turn uses `../tools/lib/local-validator-tool-loop.cjs`, not `emotion-engine/server/lib/local-validator-tool-loop.cjs`. So the decisive classification for this rerun comes from the refreshed router breadcrumbs plus the fresh events/cassette/log boundary, not from Phase 2 local-validator await events.

---

## Final Results

**Status:** ✅ Complete

**What We Built:** Removed the invalid installed-copy breadcrumb hack, refreshed `emotion-engine` so its installed `digital-twin-router` now cleanly consumes the breadcrumbed source-owned router code from sibling commit `695f0db98ebcc619c1cb33588a62a933ccb0747b`, and reran the affected record-mode path on that clean installed runtime with fresh artifacts. The rerun did not complete; it timed out after advancing through Phase 2 chunk 3. The exact breadcrumb conclusion is now sharper than before: the unresolved await is not in installed-copy cassette persistence and not in the second-turn validator follow-up — it is currently stuck at the Phase 2 chunk-4 provider transport boundary inside `digital-twin-router`’s `await realTransport(request)`.

**Commits:**
- `695f0db` - debug: add record-mode breadcrumbs around awaits (`../digital-twin-router`)

**Lessons Learned:** Installed dependency copies are never a valid instrumentation surface in this polyrepo workflow. For this lane, proving the installed file matches source exactly matters more than proving the sibling file was edited. Also, the Phase 2 validator-loop instrumentation lives in `../tools/lib/local-validator-tool-loop.cjs`, so instrumenting only `emotion-engine/server/lib/local-validator-tool-loop.cjs` does not surface await breadcrumbs for the `video-chunks` path.

---

*Completed on 2026-03-18*
