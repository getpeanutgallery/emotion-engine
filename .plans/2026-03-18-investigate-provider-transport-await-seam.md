# emotion-engine: investigate provider-transport await seam in record mode

**Date:** 2026-03-18  
**Status:** Draft  
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

Guardrail: do not patch `node_modules`. Any instrumentation or fix must land in the owning source repo(s), then be refreshed into consumers cleanly.

---

## Tasks

### Task 1: Prove the active Phase 2 runtime resolution at the provider seam

**Bead ID:** `Pending`  
**SubAgent:** `primary`
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, trace the exact runtime resolution used by the Phase 2 video-chunks path for provider transport in record mode. Prove which files are actually loaded for ../tools/emotion-lenses-tool.cjs, ../tools/lib/local-validator-tool-loop.cjs, ai-providers/providers/openrouter.cjs, and digital-twin-router/index.js during the cod-test path, then update this plan with the exact resolved paths and any drift found. Claim the bead on start and close it on completion.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `../tools/`
- `../ai-providers/`
- `../digital-twin-router/`

**Files Created/Deleted/Modified:**
- `.plans/2026-03-18-investigate-provider-transport-await-seam.md`
- runtime-resolution notes or touched source files only if needed

**Status:** ⏳ Pending

**Results:** Pending.

---

### Task 2: Add minimal source-owned transport breadcrumbs or timeout guards at the real provider boundary

**Bead ID:** `Pending`  
**SubAgent:** `primary`
**Prompt:** `After proving the live resolution chain, add the smallest truthful source-owned instrumentation needed to distinguish whether the unresolved await is inside the provider HTTP request, response parsing, or error wrapping path. Prefer the owning repo(s) that actually execute: likely ../ai-providers/providers/openrouter.cjs and/or ../digital-twin-router/index.js. Keep breadcrumbs low-noise, redact-safe, and easy to remove. Update this plan with exact files changed and validation run. Claim the bead on start and close it on completion.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `../ai-providers/`
- `../digital-twin-router/`

**Files Created/Deleted/Modified:**
- `.plans/2026-03-18-investigate-provider-transport-await-seam.md`
- `../ai-providers/providers/openrouter.cjs`
- `../digital-twin-router/index.js`
- any directly related source-owned tests if added

**Status:** ⏳ Pending

**Results:** Pending.

---

### Task 3: Reproduce with a bounded record-mode rerun and classify the unresolved await precisely

**Bead ID:** `Pending`  
**SubAgent:** `primary`
**Prompt:** `Run only the bounded record-mode reproduction needed to capture the next breadcrumb boundary for the cod-test Phase 2 hang. Use a fresh cassette name, preserve the fresh log/events/cassette artifacts, and classify whether the await is stuck before HTTP completion, during response transformation, or during wrapped error propagation. Update this plan with the exact command, timeout result, and artifact paths. Claim the bead on start and close it on completion.`

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

**Status:** ⏳ Pending

**Results:** Pending.

---

### Task 4: Land the smallest source-owned fix and refresh consumers cleanly

**Bead ID:** `Pending`  
**SubAgent:** `primary`
**Prompt:** `Once the exact unresolved await is classified, implement the smallest truthful fix in the owning source repo(s), refresh emotion-engine consumers cleanly without patching node_modules, and rerun enough validation to prove the hang is resolved or more tightly reclassified. Update this plan with exact repos/files changed, dependency refresh steps, validation commands, and remaining risk. Claim the bead on start and close it on completion.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `../ai-providers/`
- `../digital-twin-router/`
- `emotion-engine/`

**Files Created/Deleted/Modified:**
- `.plans/2026-03-18-investigate-provider-transport-await-seam.md`
- owning source files in sibling repos
- consumer dependency manifests/lockfiles only if required by the clean refresh

**Status:** ⏳ Pending

**Results:** Pending.

---

## Final Results

**Status:** ⏳ Pending

**What We Built:** Pending.

**Commits:**
- Pending.

**Lessons Learned:** Pending.

---

*Created on 2026-03-18*
