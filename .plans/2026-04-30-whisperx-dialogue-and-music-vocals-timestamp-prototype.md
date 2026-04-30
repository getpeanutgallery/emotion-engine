# Peanut Gallery Emotion Engine

**Date:** 2026-04-30  
**Status:** Draft  
**Agent:** Cookie 🍪

---

## Goal

Prototype Phase 1 timestamp-alignment scripts using WhisperX for dialogue and music-vocals, preferring reconciled artifacts when available and falling back to raw dialogue/music-vocals artifacts when reconciled versions are missing.

---

## Overview

The current Emotion Engine can produce materially useful dialogue and music-vocals text, but it still lacks a trustworthy way to anchor those lines back onto the media timeline. That missing alignment layer is the main reason Phase 2 must currently treat dialogue/music/music-vocals as support context instead of chunk-authoritative truth. Derrick’s hypothesis is sound: if we can provide known text plus the media audio to an alignment tool, we may be able to recover timestamps without asking the LLM to invent them.

The timestamp-tooling research suggests WhisperX is the best first prototype for a local dialogue-alignment path and a reasonable experiment for music-vocals, even though it is speech-first and may struggle with heavily musical or noisy vocal segments. This prototype should therefore stay honest and bounded: build separate Phase 1 scripts for dialogue and music-vocals alignment, prefer reconciled inputs when they exist, fall back to the non-reconciled artifacts when needed, and preserve unresolved cases instead of fabricating timestamps.

This slice is a prototype, not a final architecture commitment. It should tell us whether WhisperX can produce useful timestamp anchors on real COD-style trailer media, where it breaks down, and what a follow-up specialized singing-alignment path might need to replace or supplement.

---

## REFERENCES

| ID | Description | Path |
| --- | --- | --- |
| `REF-01` | Timestamp-tooling research findings and constraints from the current phase2 trusted-window plan | `.plans/2026-04-30-phase2-trusted-window-benchmark-maintenance.md` |
| `REF-02` | Current dialogue artifacts and reconciliation surfaces | `output/cod-test/` |
| `REF-03` | Current music-vocals artifacts and reconciliation surfaces | `output/cod-test/` |
| `REF-04` | Existing Phase 1 script architecture for context extraction | `server/scripts/get-context/` |
| `REF-05` | Current COD benchmark/config surfaces for validation | `configs/cod-test.yaml` |

---

## Tasks

### Task 1: Audit WhisperX integration requirements and artifact contracts

**Bead ID:** `Pending`  
**SubAgent:** `primary` (for `research` workflow role)  
**Role:** `research`  
**References:** `REF-01`, `REF-02`, `REF-03`, `REF-04`, `REF-05`  
**Prompt:** Audit how a WhisperX-based timestamp prototype should integrate into Emotion Engine Phase 1. Claim the assigned bead on start with `bd update <BEAD_ID> --status in_progress --json`. Define the exact artifact contract for two new scripts: one for dialogue timestamp alignment and one for music-vocals timestamp alignment. Respect this fallback rule: prefer reconciled dialogue/music-vocals artifacts when present; if reconciled is missing but the raw dialogue/music-vocals artifact exists, use that instead. Identify required local dependencies, model/runtime assumptions, artifact shapes, and unresolved-risk cases before implementation. Do not implement in this task.  

**Folders Created/Deleted/Modified:**
- `.plans/`
- `server/scripts/get-context/`

**Files Created/Deleted/Modified:**
- `.plans/2026-04-30-whisperx-dialogue-and-music-vocals-timestamp-prototype.md`

**Status:** ⏳ Pending

**Results:** Pending.

---

### Task 2: Implement WhisperX-based dialogue and music-vocals timestamp prototype scripts

**Bead ID:** `Pending`  
**SubAgent:** `primary` (for `coder` workflow role)  
**Role:** `coder`  
**References:** `REF-01`, `REF-02`, `REF-03`, `REF-04`, `REF-05`  
**Prompt:** Implement the bounded WhisperX timestamp prototype for Emotion Engine. Claim the assigned bead on start with `bd update <BEAD_ID> --status in_progress --json`. Add two new Phase 1 scripts under `server/scripts/get-context/`: one for dialogue timestamp alignment and one for music-vocals timestamp alignment. Contract rules: prefer reconciled dialogue/music-vocals artifacts when present; if reconciled artifacts are missing but raw dialogue/music-vocals artifacts exist, align those instead; if no usable text artifact exists, fail honestly or emit an unresolved/skip artifact according to the repo's conventions. The scripts should use WhisperX locally, produce timestamped outputs without inventing unresolved timings, and include enough artifact/debug data to evaluate quality. Add/update tests and docs as needed. Commit/push by default before QA handoff.  

**Folders Created/Deleted/Modified:**
- `server/scripts/get-context/`
- `test/scripts/`
- `.plans/`

**Files Created/Deleted/Modified:**
- new dialogue timestamp script
- new music-vocals timestamp script
- related helpers/tests/docs
- `.plans/2026-04-30-whisperx-dialogue-and-music-vocals-timestamp-prototype.md`

**Status:** ⏳ Pending

**Results:** Pending.

---

### Task 3: QA WhisperX prototype on COD-style media

**Bead ID:** `Pending`  
**SubAgent:** `primary` (for `qa` workflow role)  
**Role:** `qa`  
**References:** `REF-02`, `REF-03`, `REF-05`  
**Prompt:** QA the WhisperX timestamp prototype. Claim the assigned bead on start with `bd update <BEAD_ID> --status in_progress --json`. Run the new dialogue and music-vocals timestamp scripts against COD-style media/artifacts. Verify the reconciled-first fallback logic, inspect emitted timestamps, and document where WhisperX produces useful anchors versus where the mixed trailer audio makes results unreliable. Record exact commands, artifact paths, and failure/uncertainty modes.  

**Folders Created/Deleted/Modified:**
- `output/`
- `.logs/`
- `.plans/`

**Files Created/Deleted/Modified:**
- fresh prototype output artifacts/logs
- `.plans/2026-04-30-whisperx-dialogue-and-music-vocals-timestamp-prototype.md`

**Status:** ⏳ Pending

**Results:** Pending.

---

### Task 4: Independent audit and recommendation for WhisperX follow-up

**Bead ID:** `Pending`  
**SubAgent:** `primary` (for `auditor` workflow role)  
**Role:** `auditor`  
**References:** `REF-01`, `REF-02`, `REF-03`, `REF-04`, `REF-05`  
**Prompt:** Independently audit the WhisperX timestamp prototype slice. Claim the assigned bead on start with `bd update <BEAD_ID> --status in_progress --json`. Verify that the scripts respected the reconciled-first fallback contract, that unresolved cases were handled honestly, and that the resulting timestamps are useful enough (or not) for future Emotion Engine grounding work. Recommend whether to continue with WhisperX, restrict it to dialogue only, or pivot to a specialized lyrics aligner for music-vocals. If the slice passes, close the bead with a precise reason.  

**Folders Created/Deleted/Modified:**
- `.plans/`

**Files Created/Deleted/Modified:**
- `.plans/2026-04-30-whisperx-dialogue-and-music-vocals-timestamp-prototype.md`

**Status:** ⏳ Pending

**Results:** Pending.

---

## Final Results

**Status:** ⚠️ Partial

**What We Built:** Draft WhisperX prototype plan created; execution not started yet.

**Reference Check:** `REF-01` captures the research recommendation and fallback expectations. `REF-02` through `REF-05` identify the artifact and script surfaces the prototype should integrate with.

**Commits:**
- Pending

**Lessons Learned:** Alignment should prefer known text plus media over LLM-invented timestamps, but unresolved timing must stay unresolved when the audio is too noisy or the aligner confidence is weak.

---

*Completed on 2026-04-30*
