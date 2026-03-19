# emotion-engine: instrument record-mode second-turn hang

**Date:** 2026-03-18  
**Status:** Superseded  
**Agent:** Cookie 🍪

---

## Goal

Add tiny non-invasive breadcrumbs around the record-mode second-turn provider/recording seam, rerun the affected path, and determine whether the hang occurs before provider completion or during record-mode persistence.

---

## Overview

The previous investigation narrowed the record-mode Phase 2 hang to a very specific boundary: chunk 6 passes first-turn validator-envelope handling, then stalls during the second provider round-trip that should return the final bare artifact. Existing artifacts are strong enough to localize the seam, but not strong enough to distinguish between a provider await that never resolves and a record-mode write path that hangs after provider return.

So this plan stays deliberately tiny. We will add breadcrumbs before/after `callProvider(...)` in the local validator tool loop, and before/after the record-mode transport’s `realTransport(...)` and `engine.record(...)` completion points in `digital-twin-router`. Then we will rerun the affected record-mode path and inspect the new logs/events/artifacts to identify the exact unresolved await. Only after that should we choose a direct fix.

---

## Tasks

### Task 1: Add tiny breadcrumbs at the second-turn provider and record seams

**Bead ID:** `ee-4bt`  
**SubAgent:** `main`  
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, add a tiny non-invasive instrumentation pass for the record-mode second-turn hang. Add breadcrumbs before/after each callProvider(...) in server/lib/local-validator-tool-loop.cjs, and add matching before/after breadcrumbs around realTransport(request) resolution and engine.record(...) resolution in the active digital-twin-router source used by this polyrepo workflow. Keep the instrumentation minimal and easy to remove. Update this plan with exact files changed and mark the task complete. Claim the assigned bead on start and close it on completion.`

**Folders Created/Deleted/Modified:**
- `emotion-engine/server/`
- sibling `digital-twin-router/`
- `.plans/`

**Files Created/Deleted/Modified:**
- `server/lib/local-validator-tool-loop.cjs`
- `../digital-twin-router/index.js`
- `node_modules/digital-twin-router/index.js` *(active installed runtime copy used by this workflow)*
- `.plans/2026-03-18-instrument-record-mode-second-turn-hang.md`

**Status:** ✅ Complete

**Results:** Claimed bead `ee-4bt`, added tiny turn-scoped provider-await breadcrumbs to `server/lib/local-validator-tool-loop.cjs`, and added matching one-line record-mode transport breadcrumbs to both the sibling `../digital-twin-router/index.js` source and the active installed runtime copy at `node_modules/digital-twin-router/index.js` so the next rerun can distinguish “stuck before provider returned” from “stuck after provider returned but before/inside record persistence.” Exact breadcrumbs added: event kinds `tool.loop.provider.await.start` and `tool.loop.provider.await.end` around each `await callProvider(...)`; router stderr breadcrumbs `[digital-twin-router] record.realTransport.await.start`, `.end`, `[digital-twin-router] record.engine.record.await.start`, and `.end` around `await realTransport(request)` and `await engine.record(request, response)`. Validation: `node --check` passed for all three touched JS files.

---

### Task 2: Rerun the affected record-mode path and classify the exact unresolved await

**Bead ID:** `ee-0ta`  
**SubAgent:** `main`  
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, rerun the affected record-mode path with the new breadcrumbs in place, inspect the new trace output plus events/cassette/log state, and determine exactly whether the hang occurs before provider completion or during record-mode persistence. Update this plan with the exact evidence and the recommended direct fix lane, then close the assigned bead.`

**Folders Created/Deleted/Modified:**
- `emotion-engine/output/`
- sibling cassette pack path
- `.plans/`

**Files Created/Deleted/Modified:**
- fresh rerun artifacts/logs/cassettes
- `.plans/2026-03-18-instrument-record-mode-second-turn-hang.md`

**Status:** ✅ Complete

**Results:** Superseded by the later clean-runtime investigation lane. The decisive rerun/classification work landed in `.plans/archive/2026-03-18-remove-node-modules-instrumentation-and-rerun-cleanly.md`, which proved the unresolved await occurs earlier than this plan originally framed: inside `digital-twin-router` at `await realTransport(request)` during the Phase 2 chunk-4 first-turn provider call, before `engine.record(...)` and before any second-turn completion path. No further work remains under this older plan.

---

## Final Results

**Status:** ✅ Complete

**What We Built:** Added the tiny breadcrumb pass, then carried the actual rerun/classification forward into the later clean-runtime lane that replaced this plan. This plan is archived as superseded by the more accurate provider-await-seam handoff.

**Commits:**
- See downstream archived plans for the clean-runtime rerun and router-breadcrumb commit history.

**Lessons Learned:** The breadcrumb idea was correct, but this plan’s original framing was too narrow. The truthful next lane had to move to the clean installed runtime and then to the provider-transport await seam handoff once the rerun proved the stall happens inside `await realTransport(request)`.

---

*Completed on 2026-03-18*
