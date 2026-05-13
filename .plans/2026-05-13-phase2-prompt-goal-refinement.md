# Peanut Gallery Emotion Engine

**Date:** 2026-05-13  
**Status:** Draft  
**Agent:** Cookie 🍪

---

## Goal

Run one bounded Phase 2 prompt/goal refinement pass aimed at reducing interpretation and continuity drift—especially the chunk 18 failure mode—without reopening music-vocals timestamp R&D unless the evidence unexpectedly forces that conclusion.

---

## Overview

The May 12 cleanup, rerun, QA, and final audit narrowed the honest bottleneck. The timestamp lane is still imperfect, especially in music-heavy windows where untimed lyric fallback can leak non-local support into a chunk prompt, but the audit conclusion was that this is no longer the highest-value next problem. The strongest residual miss is chunk 18 (`90–95s`), where the output drifted toward generalized wingsuit/city-action momentum instead of grounding on the Hawaii title-card / soldier-platform transition with dominant `patience`.

That miss pattern points at a Phase 2 reasoning problem more than a Phase 1 timestamp-generation problem. The next pass should therefore focus on how the model is instructed to prioritize local visual evidence, how previous-summary continuity is framed so it cannot overpower fresh chunk evidence, and how support context such as dialogue/music-vocals is explicitly demoted to secondary evidence. This should be handled as a bounded refinement pass, not an open-ended redesign.

The purpose of this plan is to produce one honest iteration loop: inspect the current Phase 2 prompt/goal surfaces against the known miss windows, propose and implement a tightly scoped refinement, rerun the relevant evaluation lane, then QA and audit whether the refinement actually reduces the specific drift we care about. If it helps, we continue iterating from evidence. If it does not, we reconsider whether prompt-level work is insufficient and whether some previously deferred timestamp/support-context work needs to return.

---

## REFERENCES

| ID | Description | Path |
| --- | --- | --- |
| `REF-01` | Final May 12 audit decision setting next lane to Phase 2 prompt/goal refinement | `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/.plans/artifacts/2026-05-12-final-audit/decision.md` |
| `REF-02` | May 12 rerun QA summary | `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/.plans/artifacts/2026-05-12-rerun-qa/qa-summary.md` |
| `REF-03` | May 12 benchmark comparison packet | `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/.plans/artifacts/2026-05-12-rerun-qa/benchmark-comparison.json` |
| `REF-04` | May 12 chunk context audit packet | `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/.plans/artifacts/2026-05-12-rerun-qa/chunk-context-audit.json` |
| `REF-05` | Finalized May 12 cleanup + rerun plan | `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/.plans/2026-05-12-phase1-phase2-current-state-cleanup-and-rerun.md` |
| `REF-06` | Current Phase 2 chunk-processing / prompt assembly script | `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/server/scripts/process/video-chunks.cjs` |
| `REF-07` | Current retest config used in the May 12 rerun | `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/configs/cod-test-phase2-only-retest-2026-05-06.yaml` |
| `REF-08` | Yesterday’s memory handoff | `/home/derrick/.openclaw/workspace/memory/2026-05-12.md` |

---

## Tasks

### Task 1: Forensic review of Phase 2 miss windows and current prompt/goal hierarchy

**Bead ID:** `Pending`  
**SubAgent:** `primary` (for `research` workflow role)  
**Role:** `research`  
**References:** `REF-01`, `REF-02`, `REF-03`, `REF-04`, `REF-06`, `REF-07`  
**Prompt:** `Review the May 12 QA and audit artifacts plus the current Phase 2 prompt assembly code. Focus on chunk 18 first, then any other skeptical windows that support the same failure pattern. Identify exactly where the current prompt/goal hierarchy appears to overvalue previous-summary continuity, generalized trailer momentum, or support context relative to immediate local visual evidence. Produce a durable forensic note plus a concrete bounded refinement proposal. Claim the bead on start and leave clear evidence for implementation.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `server/scripts/process/` (inspection only unless artifact helper needed)

**Files Created/Deleted/Modified:**
- `.plans/2026-05-13-phase2-prompt-goal-refinement.md`
- `.plans/artifacts/2026-05-13-phase2-refinement-review/`

**Status:** ⏳ Pending

**Results:** Pending.

---

### Task 2: Implement one bounded Phase 2 prompt/goal refinement pass

**Bead ID:** `Pending`  
**SubAgent:** `primary` (for `coder` workflow role)  
**Role:** `coder`  
**References:** `REF-01`, `REF-02`, `REF-06`, `REF-07`  
**Prompt:** `Using the approved forensic findings, implement one bounded Phase 2 prompt/goal refinement pass. Keep the architecture and timestamp backend unchanged unless the evidence absolutely requires a tiny supporting adjustment. Prioritize: (1) local visual evidence first, (2) continuity as secondary context that cannot override the current chunk, and (3) dialogue/music-vocals as support rather than scene-defining evidence. Update tests or validation surfaces as appropriate, run repo-local validation, and commit/push by default before handoff.`

**Folders Created/Deleted/Modified:**
- `server/scripts/process/`
- `configs/` (only if a bounded evaluation config change is needed)
- `.plans/`

**Files Created/Deleted/Modified:**
- Phase 2 prompt/runtime files to be identified by Task 1
- `.plans/2026-05-13-phase2-prompt-goal-refinement.md`

**Status:** ⏳ Pending

**Results:** Pending.

---

### Task 3: Rerun the bounded evaluation lane after the refinement

**Bead ID:** `Pending`  
**SubAgent:** `primary` (for `coder` workflow role)  
**Role:** `coder`  
**References:** `REF-02`, `REF-03`, `REF-06`, `REF-07`  
**Prompt:** `Run the appropriate bounded post-change evaluation lane for the Phase 2 refinement. Prefer the smallest honest rerun that can validate the targeted miss pattern without hiding regressions; if a full configured rerun is required, document why. Capture exact commands, runtime notes, output paths, and the prompt/output evidence for chunk 18 plus any other representative windows used in the decision.`

**Folders Created/Deleted/Modified:**
- `output/`
- `.plans/`

**Files Created/Deleted/Modified:**
- `.plans/2026-05-13-phase2-prompt-goal-refinement.md`
- `.plans/artifacts/2026-05-13-phase2-refinement-rerun/`

**Status:** ⏳ Pending

**Results:** Pending.

---

### Task 4: QA the refinement against the known failure modes and trusted windows

**Bead ID:** `Pending`  
**SubAgent:** `primary` (for `qa` workflow role)  
**Role:** `qa`  
**References:** `REF-02`, `REF-03`, `REF-04`, `REF-06`  
**Prompt:** `QA the bounded Phase 2 refinement honestly. Measure whether chunk 18 improves in grounding and dominant emotion, whether chunk 6 or other skeptical windows regress or improve, and whether trusted windows keep their directional strength. Distinguish between real improvement, cosmetic wording drift, and new failure modes. Produce a durable QA packet with benchmark deltas and prompt-evidence commentary.`

**Folders Created/Deleted/Modified:**
- `output/`
- `.plans/`

**Files Created/Deleted/Modified:**
- `.plans/2026-05-13-phase2-prompt-goal-refinement.md`
- `.plans/artifacts/2026-05-13-phase2-refinement-qa/`

**Status:** ⏳ Pending

**Results:** Pending.

---

### Task 5: Audit whether the refinement changed the actual next-step decision surface

**Bead ID:** `Pending`  
**SubAgent:** `primary` (for `auditor` workflow role)  
**Role:** `auditor`  
**References:** `REF-01`, `REF-02`, `REF-03`, `REF-04`, `REF-06`  
**Prompt:** `Independently audit whether the bounded Phase 2 refinement genuinely improved the real bottleneck. Decide whether prompt/goal refinement should continue, whether the work is now good enough to shift toward Phase 3/reporting cleanup, or whether the evidence unexpectedly reopens the deferred timestamp/support-context lane. Close the bead only if the audit finds the task completed honestly; otherwise report the gap precisely.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- output inspection only

**Files Created/Deleted/Modified:**
- `.plans/2026-05-13-phase2-prompt-goal-refinement.md`
- `.plans/artifacts/2026-05-13-phase2-refinement-audit/`

**Status:** ⏳ Pending

**Results:** Pending.

---

## Final Results

**Status:** ⏳ Pending

**What We Built:** Pending.

**Reference Check:** Pending.

**Commits:**
- Pending

**Lessons Learned:** Pending.

---

*Completed on Pending*
