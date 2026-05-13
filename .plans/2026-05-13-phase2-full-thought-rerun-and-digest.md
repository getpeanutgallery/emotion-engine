# Peanut Gallery Emotion Engine

**Date:** 2026-05-13  
**Status:** Draft  
**Agent:** Cookie 🍪

---

## Goal

Run an honest full-scope Phase 2 rerun with the restored `thought` contract and produce a complete per-chunk digest of the new persona thoughts so Derrick can judge the overall tone before deciding whether prompt refinement is needed.

---

## Overview

The restored Phase 2 contract has already passed implementation, bounded rerun verification, QA, and audit. However, the bounded reruns only covered representative windows. Derrick now wants the whole thing: the new persona thoughts per chunk across the full video, not just spot checks, so he can decide whether the current tone is already good enough.

This plan should first determine the safest honest rerun path for the full video using the now-landed contract, avoiding the earlier stalled whole-video path if that still reproduces. Once the rerun succeeds, the output should be turned into a readable chunk-by-chunk digest focused on the persona `thought` field, with `continuationThought` and `personaMeta.scrollRisk` included where present.

---

## REFERENCES

| ID | Description | Path |
| --- | --- | --- |
| `REF-01` | Restored Phase 2 contract plan and audit trail | `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/.plans/2026-05-13-phase2-persona-thought-contract-restoration.md` |
| `REF-02` | Bounded rerun summary | `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/.plans/artifacts/2026-05-13-phase2-persona-contract-rerun/summary.md` |
| `REF-03` | Current comparison artifact | `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/.plans/artifacts/2026-05-13-phase2-thought-comparison/thought-comparison.md` |
| `REF-04` | Current Phase 2 runtime | `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/server/scripts/process/video-chunks.cjs` |
| `REF-05` | Current rerun configs/output conventions | `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/output/` |

---

## Tasks

### Task 1: Run a full video Phase 2 thought-contract rerun and capture the complete chunk outputs

**Bead ID:** `ee-7w2d`  
**SubAgent:** `primary` (for `coder` workflow role)  
**Role:** `coder`  
**References:** `REF-01`, `REF-02`, `REF-04`, `REF-05`  
**Prompt:** `Run a full video Phase 2 rerun using the restored thought contract. Prefer the safest honest whole-video path; if the previously observed stall recurs, diagnose enough to choose the next honest full-run path rather than silently falling back to partial windows. Capture the output path and ensure the resulting chunk-analysis artifact includes thought, optional continuationThought, and personaMeta.scrollRisk where present.`

**Folders Created/Deleted/Modified:**
- `output/`
- `.plans/`

**Files Created/Deleted/Modified:**
- `.plans/2026-05-13-phase2-full-thought-rerun-and-digest.md`
- `.plans/artifacts/2026-05-13-phase2-persona-contract-rerun/full-video-phase2-only.fast-config.yaml`
- rerun output files under `output/cod-test-phase2-full-thought-rerun-2026-05-13/`

**Status:** ✅ Complete

**Results:** Used the safest honest whole-video path by avoiding the repo-local `.env`'s forced `DIGITAL_TWIN_MODE=record` lane that had previously been implicated in whole-video stalls, and instead launched a clean live Phase 2-only rerun with `--clean-live-digital-twin`. To keep the run truthful but low-risk, I reused the already-proven 2026-05-06 timestamped Phase 1 packet by copying its `phase1-gather-context/` and `assets/` into a fresh output root, then ran a fresh Phase 2-only config at `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/.plans/artifacts/2026-05-13-phase2-persona-contract-rerun/full-video-phase2-only.fast-config.yaml`. The rerun completed successfully at `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/output/cod-test-phase2-full-thought-rerun-2026-05-13/phase2-process/chunk-analysis.json` with 28 analyzed chunks, 0 phase errors, and totalTokens `347947`. Contract check passed on the resulting artifact: all 28 chunks include `thought`, 25 include `continuationThought`, and all 28 include `personaMeta.scrollRisk`. The earlier stall did not reproduce on this clean live path, so no partial-window fallback was needed.

---

### Task 2: Build a complete per-chunk thought digest for Derrick review

**Bead ID:** `ee-50ze`  
**SubAgent:** `primary` (for `research` workflow role)  
**Role:** `research`  
**References:** `REF-01`, `REF-05`  
**Prompt:** `Using the successful full rerun output, build a readable chunk-by-chunk digest of the new persona thoughts. Include for each chunk: time window, thought, continuationThought if present, and scrollRisk if present. Keep it compact but complete so Derrick can review the full run without digging through raw JSON.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `.plans/artifacts/`

**Files Created/Deleted/Modified:**
- `.plans/2026-05-13-phase2-full-thought-rerun-and-digest.md`
- `.plans/artifacts/2026-05-13-phase2-full-thought-digest/`

**Status:** ⏳ Pending

**Results:** Pending.

---

## Final Results

**Status:** ⏳ Pending

**What We Built:** Pending.

**Reference Check:** Pending.

**Commits:**
- Pending.

**Lessons Learned:** Pending.

---

*Completed on Pending*
