# emotion-engine: investigate reconciliation rerun stall and recover a clean validation run

**Date:** 2026-04-05  
**Status:** In Progress  
**Agent:** Cookie 🍪

---

## Goal

Determine whether the reconciliation-backed cod-test Phase 2 stall was just the usual intermittent OpenRouter behavior or a regression introduced by the new lane, then recover one fully completed benchmark-backed run for honest evaluation.

---

## Overview

The first reconciliation-backed rerun gave us a partial signal: Phase 1 completed, reconciled artifacts were emitted, and dialogue contamination appeared to improve. But the run stalled in Phase 2 before benchmark/report completion, so we still do not have a clean end-to-end measurement of the new baseline. Since OpenRouter stalls have happened before, the first task is to diagnose whether this was likely the normal transport/provider hang pattern or something introduced by the reconciliation changes.

This plan keeps the scope narrow. First, inspect the failed/stalled run evidence and compare it to known stall patterns so we can decide whether the reconciliation lane is implicated. If it looks like the normal intermittent OpenRouter/provider hang pattern, the diagnosis should also audit the active retry/timeout/recovery config and recommend any hardening needed before the recovery run. Then recover a fresh completed run with the reconciliation script still enabled and use that run for the real benchmark-backed judgment.

---

## Tasks

### Task 1: Diagnose the Phase 2 stall after the reconciliation-backed rerun

**Bead ID:** `ee-5e6v`  
**SubAgent:** `research`  
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, inspect the stalled reconciliation-backed rerun evidence and determine whether the Phase 2 chunk-3 stall looks like the normal intermittent OpenRouter/provider hang pattern or a regression introduced by the new reconciliation lane. Review the latest log, events, raw captures, and any nearby historical evidence that helps compare the failure mode. If it looks like the usual OpenRouter/provider hang, also audit the active timeout/retry/recovery config for the affected lane(s) and recommend any hardening needed before the recovery rerun. Update this plan with an implementation-ready diagnosis and recommended recovery approach. Do not change code. Close bead ee-5e6v when done.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `.logs/`
- `output/`

**Files Created/Deleted/Modified:**
- `.plans/2026-04-05-investigate-reconciliation-rerun-stall-and-recover.md`
- referenced stall artifacts/logs only

**Status:** ✅ Complete

**Results:** Diagnosis completed without code changes.

- **Verdict:** this looks like the usual intermittent OpenRouter/provider stall family, **not** evidence that the new reconciliation lane introduced a Phase 2 regression.
- **Primary live evidence:** the canonical stalled run log `.logs/cod-test-20260405-202844-ee-hk49-reconciliation-rerun.log` shows Phase 1 completing normally, then Phase 2 reaching `Processing chunk 3/28`, successfully finishing that chunk, then entering `Processing chunk 4/28` and stopping after the provider/transport await begins. There is no reconciliation-specific exception, missing-artifact failure, schema break, or recovery-lane failure before the process goes silent.
- **Failure-shape match:** this silent stop inside the provider/transport portion of `video-chunks` matches the repo’s existing OpenRouter instability pattern much more closely than a reconciliation bug. Nearby historical evidence under `output/_archives/cod-test-pre-ee-hk49-20260405-202844/` and `output/_archives/cod-test-phase2-3chunk-comparison-pre-ee-9zg1/` shows the same Phase 2 lane already producing retryable OpenRouter failures such as `OpenRouter: timeout of 10000ms exceeded`, `OpenRouter: No content in response`, and validator-loop exhaustion before retry/failover recovery.
- **What does *not* look regressed:** the new reconciliation-enabled Phase 1 flow completed and emitted reconciled artifacts before the stall. If reconciliation were the direct regression, the more likely signatures would be missing reconciled inputs, path/prompt assembly errors, deterministic first-chunk failure, or schema/contract breakage. None of those appeared in the inspected evidence.
- **Artifact-level read:** the latest live Phase 2 packet in `output/cod-test/phase2-process/raw/ai/` stops before producing the next pointer/capture for the next chunk after the last successful one, which is consistent with the process hanging inside the provider call rather than failing cleanly and writing a normal captured error envelope.
- **Config audit for the affected lane:** `configs/cod-test.yaml` still runs `server/scripts/process/video-chunks.cjs` first in Phase 2 with OpenRouter video targets headed by `qwen/qwen3.5-397b-a17b`. That primary target is pinned to `timeoutMs: 10000`, while the script-level retry posture only gives the video lane two attempts on the same target before failover (`ai.video.retry.maxAttempts` default from code), short `500ms` backoff, and normal provider-error retry. Historical captures show this exact 10s timeout is already noisy/brittle for the OpenRouter video lane and frequently forces retries/failover even when a run eventually succeeds.
- **Implementation-ready recovery recommendation before Task 2 rerun:**
  1. **Keep the reconciliation script enabled** for the recovery rerun; current evidence does not justify backing it out.
  2. **Use a fresh output/archive location** so the next run’s `_meta/events.jsonl` and raw captures are isolated from earlier canonical `output/cod-test` history.
  3. **Raise the primary OpenRouter video target timeout above 10s** for the recovery rerun so the first target is not operating on a known-fragile ceiling.
  4. **Preserve retry/failover and avoid a short outer shell watchdog**, so provider slowness is handled by the lane’s own recovery posture instead of being misclassified as a new regression.
  5. **If a fresh rerun still stalls after timeout hardening**, then re-open the possibility of a deeper Phase 2 runtime bug. On current evidence, though, the honest read is provider instability first and reconciliation regression unproven.

---

### Task 2: Harden the fragile OpenRouter timeout/retry config for the recovery rerun

**Bead ID:** `ee-du3x`  
**SubAgent:** `coder`  
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, apply the narrow config hardening recommended by Task 1 for the reconciliation recovery rerun. Raise the fragile primary OpenRouter video timeout above the current 10000ms ceiling in the active cod-test config, preserve retry/failover behavior, keep reconciliation enabled, and avoid unnecessary scope expansion. Run focused config validation, update this plan truthfully with exact files/tests/outcomes, commit after validation passes, and do not push. Close bead ee-du3x when done.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `configs/`
- `test/` (only if minimal config validation updates are needed)

**Files Created/Deleted/Modified:**
- `.plans/2026-04-05-investigate-reconciliation-rerun-stall-and-recover.md`
- `configs/cod-test.yaml`

**Status:** ✅ Complete

**Results:** Applied the narrow hardening change in `configs/cod-test.yaml` only.

- Raised the primary Phase 2 OpenRouter video target (`qwen/qwen3.5-397b-a17b`) timeout from `10000` ms to `30000` ms in the active `cod-test` config.
- Left reconciliation enabled and preserved the existing video target order, retry posture, and failover chain unchanged.
- Validation run: `npm run validate-configs` ✅ (`node validate-configs.cjs`; all 27 YAML configs parsed successfully).
- No test code or other config surfaces were changed, keeping scope limited to the known-fragile timeout ceiling.

---

### Task 3: Recover a clean completed reconciliation-backed cod-test run

**Bead ID:** `ee-k4o2`  
**SubAgent:** `primary`  
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, after Task 1 diagnosis lands and Task 2 config hardening is complete, recover a fully completed cod-test rerun with the reconciliation pass still enabled. Capture the exact command, cassette, logs, timing, artifact/report paths, and benchmark summary. Compare the completed result against the prior raw-only and partial reconciled runs, then update this plan truthfully with exact deltas and honest conclusions. Do not push. Commit only if a durable review artifact warrants it. Close bead ee-k4o2 when done.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `.logs/`
- `output/`
- `benchmarks/fixtures/cod-test/_reports/`

**Files Created/Deleted/Modified:**
- `.plans/2026-04-05-investigate-reconciliation-rerun-stall-and-recover.md`
- fresh rerun artifacts/logs/reports

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

*Started on 2026-04-05*
