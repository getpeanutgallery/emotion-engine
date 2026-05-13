# Peanut Gallery Emotion Engine

**Date:** 2026-05-13  
**Status:** Draft  
**Agent:** Cookie 🍪

---

## Goal

Refine Phase 2 continuity-state behavior so persona thoughts read like one continuous watch experience across the full trailer, not disconnected 5-second micro-videos, while preserving chunk-local grounding and the restored thought contract.

---

## Overview

The restored thought-layer contract is working structurally: `thought`, optional `continuationThought`, and bounded `personaMeta.scrollRisk` now survive end to end, reports render them, and benchmark scoring is unaffected. However, Derrick’s review of the full rerun surfaced a deeper behavioral issue. The persona is still too chunk-local. Repeated `0.0s ...` phrasing and lines like chunk 18’s `No intro fluff` suggest the model is anchoring itself to the local chunk timeline instead of staying inside one continuous trailer watch experience.

The code path explains why. The Phase 2 runner currently passes forward only `previousState.summary` and previous emotions; it does not persist the previous `thought`, previous `continuationThought`, or a compact viewer-state handoff. The prompt also frames `thought` as a reaction "for this chunk" and treats previous summary as continuity-only support, which was a good anti-hallucination safety move but leaves continuity too weak to sustain real cumulative persona awareness.

This pass should not redesign the full schema again. Instead, it should tighten the behavioral seam: carry forward a small but explicit continuity state, prevent chunk-local timestamp phrasing in persona thoughts, reframe the prompt so the persona is still watching one continuous trailer, and allow chunk-present dialogue to matter more in `thought` when the attached video clearly supports it. Validation should focus on the specific symptoms Derrick called out: intro continuity, dialogue-aware beats, chunk 18’s false local reset, and the promo/end-card lane.

---

## REFERENCES

| ID | Description | Path |
| --- | --- | --- |
| `REF-01` | Full thought-contract restoration plan and audit trail | `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/.plans/2026-05-13-phase2-persona-thought-contract-restoration.md` |
| `REF-02` | Full successful thought rerun digest | `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/.plans/artifacts/2026-05-13-phase2-full-thought-digest/full-thought-digest.md` |
| `REF-03` | Full successful rerun chunk-analysis artifact | `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/output/cod-test-phase2-full-thought-rerun-2026-05-13/phase2-process/chunk-analysis.json` |
| `REF-04` | Phase 2 chunk runner showing carried previous state | `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/server/scripts/process/video-chunks.cjs` |
| `REF-05` | Live emotion-lenses prompt builder in tools repo | `/home/derrick/.openclaw/workspace/projects/peanut-gallery/tools/emotion-lenses-tool.cjs` |
| `REF-06` | Tools structured-output validator for thought contract | `/home/derrick/.openclaw/workspace/projects/peanut-gallery/tools/lib/structured-output.cjs` |
| `REF-07` | Thought comparison artifact old vs new tone | `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/.plans/artifacts/2026-05-13-phase2-thought-comparison/thought-comparison.md` |
| `REF-08` | Prior memory confirming dialogue chunk grounding is correct and not leaking cross-window | `memory/2026-05-06.md` |
| `REF-09` | Prior memory confirming current next lane is Phase 2 prompt/goal refinement, not timestamp R&D | `memory/2026-05-12.md` |

---

## Tasks

### Task 1: Forensic design pass for continuity-state carryover and prompt rules

**Bead ID:** `ee-zfuk`  
**SubAgent:** `primary` (for `research` workflow role)  
**Role:** `research`  
**References:** `REF-01`, `REF-02`, `REF-03`, `REF-04`, `REF-05`, `REF-06`, `REF-07`, `REF-08`, `REF-09`  
**Prompt:** `Audit the current Phase 2 continuity seam and propose the smallest durable design to fix the micro-video behavior. Focus on: what prior state should carry forward, how to ban local-relative timestamp phrasing like 0.0s in persona thoughts, how to frame thought as ongoing watch experience rather than isolated chunk reaction, and how to let chunk-supported dialogue influence thought more naturally without weakening grounding. Produce a durable design note and crisp coder guidance. Claim the bead on start and close it when done.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `.plans/artifacts/`

**Files Created/Deleted/Modified:**
- `.plans/2026-05-13-phase2-continuity-state-refinement.md`
- `.plans/artifacts/2026-05-13-phase2-continuity-state-design/`

**Status:** ✅ Complete

**Results:** Research audit completed. The current seam was confirmed in `server/scripts/process/video-chunks.cjs`: Phase 2 carries forward only `previousState.summary` plus prior `emotions`, so the next chunk loses the persona’s actual watch-state (`thought`, `continuationThought`, `scrollRisk`, dominant lane, and prior absolute position in the trailer). The prompt in `/home/derrick/.openclaw/workspace/projects/peanut-gallery/tools/emotion-lenses-tool.cjs` still frames `thought` as reaction "to this chunk," which combines with visible chunk-window timing to encourage micro-video resets like repeated `0.0s ...` phrasing and false-local-openers such as chunk 18’s `No intro fluff`. A durable design note was added at `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/.plans/artifacts/2026-05-13-phase2-continuity-state-design/design-note.md`. It proposes the smallest durable fix: carry a compact internal viewer continuity state (`summary`, `thought`, optional `continuationThought`, `dominantEmotion`, `scrollRisk`, and prior chunk window/index), reframe `thought` as ongoing full-trailer internal monologue rather than isolated chunk reaction, explicitly allow chunk-supported dialogue to shape `thought`, and hard-ban local-relative timestamp tokens in `thought`/`continuationThought` via both prompt rules and structured-output validation. Coder guidance and bounded validation expectations were included, with likely touch points in `video-chunks.cjs`, `tools/emotion-lenses-tool.cjs`, both structured-output validators, and the related prompt/runner/validator tests.

---

### Task 2: Implement continuity-state refinement in runner + prompt/tool path

**Bead ID:** `ee-n9cv`  
**SubAgent:** `primary` (for `coder` workflow role)  
**Role:** `coder`  
**References:** `REF-04`, `REF-05`, `REF-06`  
**Prompt:** `Implement the approved continuity-state refinement with the smallest durable change set. Likely areas include carried previous state in video-chunks.cjs and prompt wording/tool behavior in the tools repo. Preserve the restored thought contract, preserve benchmark compatibility, and preserve chunk-local grounding safeguards. Add/adjust tests and validation. Commit/push by default before handoff.`

**Folders Created/Deleted/Modified:**
- `server/scripts/process/`
- `/home/derrick/.openclaw/workspace/projects/peanut-gallery/tools/`
- `.plans/`

**Files Created/Deleted/Modified:**
- `server/scripts/process/video-chunks.cjs`
- `server/lib/structured-output.cjs`
- `test/scripts/video-chunks.test.js`
- `test/lib/structured-output-emotion.test.js`
- `/home/derrick/.openclaw/workspace/projects/peanut-gallery/tools/emotion-lenses-tool.cjs`
- `/home/derrick/.openclaw/workspace/projects/peanut-gallery/tools/lib/structured-output.cjs`
- `/home/derrick/.openclaw/workspace/projects/peanut-gallery/tools/test/emotion-lenses-tool.test.js`
- `.plans/2026-05-13-phase2-continuity-state-refinement.md`

**Status:** ✅ Complete

**Results:** Implemented the smallest durable Phase 2 continuity-state refinement across the runner, prompt builder, and mirrored validators. `server/scripts/process/video-chunks.cjs` now carries forward a compact viewer continuity state between chunks (`summary`, `thought`, optional `continuationThought`, `dominantEmotion`, `scrollRisk`, prior chunk window/index, plus prior `emotions` for compatibility) instead of only summary/emotions. `/home/derrick/.openclaw/workspace/projects/peanut-gallery/tools/emotion-lenses-tool.cjs` now renders that state as a bounded “Viewer Continuity State” support block, reframes `thought` as an ongoing full-trailer internal monologue, explicitly allows chunk-supported dialogue to shape `thought`, and adds an explicit ban on local-relative timestamp phrasing in `thought` / `continuationThought`. The ban is enforced in both validator copies (`tools/lib/structured-output.cjs` and `server/lib/structured-output.cjs`) with a narrow numeric-seconds check so restored thought-contract compatibility stays intact while blocking the observed `0.0s` / `2.0s later` failure mode. Focused repo-local validation passed: `emotion-engine: node --test test/scripts/video-chunks.test.js test/lib/structured-output-emotion.test.js` and `tools: node --test test/emotion-lenses-tool.test.js`. Rerun handoff for `ee-nyc6`: use the next bounded QA pass to confirm the new continuity prompt materially reduces reset-style thought phrasing and that dialogue-supported thoughts stay chunk-grounded in benchmark/problem assets without regressing summary/emotion outputs.

---

### Task 3: Run a bounded validation rerun focused on continuity and dialogue-use symptoms

**Bead ID:** `ee-nyc6`  
**SubAgent:** `primary` (for `coder` workflow role)  
**Role:** `coder`  
**References:** `REF-02`, `REF-03`, `REF-07`  
**Prompt:** `Run the smallest honest rerun that can validate the continuity-state fix against the real symptoms Derrick called out. Include intro continuity windows, a dialogue-relevant window, chunk 18 / late-action continuity, and promo/end-card windows. Capture before/after evidence for 0.0s phrasing, continuity behavior, and dialogue-use in thought. Produce a durable rerun artifact and note whether a full rerun is justified next.`

**Folders Created/Deleted/Modified:**
- `output/`
- `.plans/`
- `.plans/artifacts/`

**Files Created/Deleted/Modified:**
- `.plans/2026-05-13-phase2-continuity-state-refinement.md`
- `.plans/artifacts/2026-05-13-phase2-continuity-state-rerun/`

**Status:** ⏳ Pending

**Results:** Pending.

---

### Task 4: QA the continuity fix for lived-sequence behavior

**Bead ID:** `ee-aqg0`  
**SubAgent:** `primary` (for `qa` workflow role)  
**Role:** `qa`  
**References:** `REF-02`, `REF-03`, `REF-07`  
**Prompt:** `QA whether the continuity refinement actually changes the persona from disconnected chunk reviewer into continuous viewer. Specifically check: no misleading 0.0s-style local reset language, better continuity awareness in later chunks like chunk 18, more natural use of chunk-supported dialogue in thought, and no grounding regressions. Produce a durable QA summary and a clear audit handoff.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `.plans/artifacts/`
- `output/` inspection only

**Files Created/Deleted/Modified:**
- `.plans/2026-05-13-phase2-continuity-state-refinement.md`
- `.plans/artifacts/2026-05-13-phase2-continuity-state-qa/`

**Status:** ⏳ Pending

**Results:** Pending.

---

### Task 5: Independent audit and next-step decision

**Bead ID:** `ee-8leh`  
**SubAgent:** `primary` (for `auditor` workflow role)  
**Role:** `auditor`  
**References:** `REF-01`, `REF-02`, `REF-03`, `REF-04`, `REF-05`, `REF-06`, `REF-07`  
**Prompt:** `Audit whether the continuity-state refinement honestly solves the micro-video behavior without weakening the contract restoration or grounding discipline. Decide whether the work is complete, whether a full rerun should be done immediately after pass, and what the remaining gap is if any. Close the bead only if the work passes.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `.plans/artifacts/`

**Files Created/Deleted/Modified:**
- `.plans/2026-05-13-phase2-continuity-state-refinement.md`
- `.plans/artifacts/2026-05-13-phase2-continuity-state-audit/`

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
