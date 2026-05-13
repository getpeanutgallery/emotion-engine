# Peanut Gallery Emotion Engine

**Date:** 2026-05-13  
**Status:** In Progress  
**Agent:** Cookie 🍪

---

## Goal

Close the last audit-blocking continuity bug by widening the Phase 2 local-countdown guardrail, then rerun and re-audit the chunk 14/15 lane to confirm micro-video phrasing is gone.

---

## Overview

The larger Phase 2 continuity-state refinement materially improved lived-sequence behavior, but the auditor correctly blocked final sign-off because one residual continuation line still used local-countdown phrasing: `If the next 5 seconds hit hard, I'm sharing this.` That means the guardrail currently catches numeric-second tokens like `0.0s` and `2.0s`, but not natural-language countdown phrasing such as `next 5 seconds`, `in the next second`, or `next few seconds`.

This follow-up should stay narrow. We do not need another schema pass or broad redesign. We need one targeted implementation update in the prompt/validator layer, the smallest honest rerun around the affected chunk 14/15 lane plus sanity checks on adjacent windows, and then QA + independent audit to close the remaining bead cleanly.

---

## REFERENCES

| ID | Description | Path |
| --- | --- | --- |
| `REF-01` | Active continuity-state refinement plan | `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/.plans/2026-05-13-phase2-continuity-state-refinement.md` |
| `REF-02` | Continuity-state design note | `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/.plans/artifacts/2026-05-13-phase2-continuity-state-design/design-note.md` |
| `REF-03` | Bounded rerun summary showing the residual line | `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/.plans/artifacts/2026-05-13-phase2-continuity-state-rerun/summary.md` |
| `REF-04` | QA summary noting the chunk 14 miss | `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/.plans/artifacts/2026-05-13-phase2-continuity-state-qa/qa-summary.md` |
| `REF-05` | Audit summary blocking final pass | `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/.plans/artifacts/2026-05-13-phase2-continuity-state-audit/audit-summary.md` |
| `REF-06` | Tools prompt builder | `/home/derrick/.openclaw/workspace/projects/peanut-gallery/tools/emotion-lenses-tool.cjs` |
| `REF-07` | Tools structured-output validator | `/home/derrick/.openclaw/workspace/projects/peanut-gallery/tools/lib/structured-output.cjs` |
| `REF-08` | Mirrored emotion-engine validator | `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/server/lib/structured-output.cjs` |

---

## Tasks

### Task 1: Implement widened local-countdown guardrail

**Bead ID:** `ee-1ms5`  
**SubAgent:** `primary` (for `coder` workflow role)  
**Role:** `coder`  
**References:** `REF-01`, `REF-02`, `REF-05`, `REF-06`, `REF-07`, `REF-08`  
**Prompt:** `Implement the smallest durable follow-up fix for the residual local-countdown phrase bug. Widen the prompt + validator guardrail beyond numeric second tokens so it also rejects natural-language countdown phrasing like 'next 5 seconds', 'in the next second', and 'next few seconds' in thought/continuationThought. Add focused tests, update the plan with what actually happened, commit/push by default, and hand off the exact rerun target lane.`

**Folders Created/Deleted/Modified:**
- `/home/derrick/.openclaw/workspace/projects/peanut-gallery/tools/`
- `server/lib/`
- `.plans/`

**Files Created/Deleted/Modified:**
- `/home/derrick/.openclaw/workspace/projects/peanut-gallery/tools/emotion-lenses-tool.cjs`
- `/home/derrick/.openclaw/workspace/projects/peanut-gallery/tools/lib/structured-output.cjs`
- `server/lib/structured-output.cjs`
- `/home/derrick/.openclaw/workspace/projects/peanut-gallery/tools/test/emotion-lenses-tool.test.js`
- `test/lib/structured-output-emotion.test.js`
- `.plans/2026-05-13-phase2-continuity-guardrail-followup.md`

**Status:** ✅ Complete

**Results:** Implemented the smallest durable follow-up guardrail widening without disturbing the continuity-state carryover work. The prompt in `REF-06` now explicitly bans local countdown phrasing in `thought` / `continuationThought`, including examples `next 5 seconds`, `in the next second`, and `next few seconds`, alongside the existing numeric-token ban. Both mirrored validators (`REF-07`, `REF-08`) were widened on the same existing `invalid_temporal_framing` seam: they still reject numeric local timestamps like `0.0s` / `2.0s`, and now also reject narrow natural-language countdown patterns centered on `next ... second(s)` phrasing while leaving natural continuity language like `still`, `by this point`, and `now` valid. Added focused regression tests in both repos for `next 5 seconds` and `next few seconds` while preserving the existing natural-language-allowed case. Local validation passed: `node --check tools/emotion-lenses-tool.cjs && node --check tools/lib/structured-output.cjs && node --check emotion-engine/server/lib/structured-output.cjs && (cd tools && node --test test/emotion-lenses-tool.test.js) && (cd emotion-engine && node --test test/lib/structured-output-emotion.test.js test/scripts/video-chunks.test.js)`. Rerun handoff for `ee-u2ct`: target the previously failing chunk 14/15 continuity lane first, verify the former `If the next 5 seconds hit hard, I'm sharing this.` pattern is gone, and sanity-check adjacent windows for no new phrasing regressions.

---

### Task 2: Rerun affected lane and verify the phrase is gone

**Bead ID:** `ee-u2ct`  
**SubAgent:** `primary` (for `coder` workflow role)  
**Role:** `coder`  
**References:** `REF-03`, `REF-04`, `REF-05`  
**Prompt:** `Run the smallest honest rerun around the affected chunk 14/15 lane plus any adjacent sanity windows needed to prove the widened guardrail worked. Capture before/after evidence showing the residual 'next 5 seconds' style phrasing is gone and no new regressions appeared. Produce a durable artifact and update the plan.`

**Folders Created/Deleted/Modified:**
- `output/`
- `.plans/`
- `.plans/artifacts/`

**Files Created/Deleted/Modified:**
- `.plans/2026-05-13-phase2-continuity-guardrail-followup.md`
- `.plans/artifacts/2026-05-13-phase2-continuity-guardrail-rerun/`

**Status:** ⏳ Pending

**Results:** Pending.

---

### Task 3: QA and audit closure

**Bead ID:** `ee-ieux` / `ee-jca2`  
**SubAgent:** `primary` (for `qa` then `auditor` workflow roles)  
**Role:** `qa` / `auditor`  
**References:** `REF-03`, `REF-04`, `REF-05`  
**Prompt:** `QA and then independently audit the follow-up guardrail fix. Confirm the local-countdown phrasing bug is actually gone, continuity still feels human, and there are no new grounding regressions. Produce durable QA + audit notes, update the plan, and only close the audit bead if the work is honestly complete.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `.plans/artifacts/`

**Files Created/Deleted/Modified:**
- `.plans/2026-05-13-phase2-continuity-guardrail-followup.md`
- `.plans/artifacts/2026-05-13-phase2-continuity-guardrail-qa/`
- `.plans/artifacts/2026-05-13-phase2-continuity-guardrail-audit/`

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
