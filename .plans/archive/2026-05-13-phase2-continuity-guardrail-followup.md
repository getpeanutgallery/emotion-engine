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

**Status:** ✅ Complete

**Results:** Ran the smallest honest rerun as a bounded Phase 2-only pass capped at `max_chunks: 17`, which rebuilds continuity from chunk 0 through chunk 16 while avoiding another unnecessary full 28-chunk sweep. To keep the run truthful but narrow, I reused the already-proven Phase 1 packet from `output/cod-test-phase2-full-thought-rerun-2026-05-13/` by copying `phase1-gather-context/` and `assets/` into a fresh output root, then executed `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/.plans/artifacts/2026-05-13-phase2-continuity-guardrail-rerun/chunk14-16-phase2-only.fast-config.yaml` with `node server/run-pipeline.cjs --config ... --clean-live-digital-twin --verbose`. The rerun completed successfully at `output/cod-test-phase2-continuity-guardrail-rerun-2026-05-13/phase2-process/chunk-analysis.json` with `17/17` successful chunks, `0` failures, and `211416` total tokens (`.logs/20260513-165939-ee-u2ct-continuity-guardrail-rerun.time`: `real 1461.38`). Durable evidence lives under `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/.plans/artifacts/2026-05-13-phase2-continuity-guardrail-rerun/` in `summary.md` and `evidence.json`. The old audit-blocking continuation line in chunk 14 — `If the next 5 seconds hit hard, I'm sharing this.` — is gone, replaced by `If the jungle scene hits as hard as the city one, I'm locked in.` A pattern sweep across rerun `thought` / `continuationThought` found `0` hits for the widened local-countdown guardrail class (`next <number> seconds`, `in the next second`, `next few seconds`, and numeric `0.0s`-style tokens), down from the prior rerun's chunk-0 `next few seconds` residue plus the chunk-14 `next 5 seconds` miss. Adjacent sanity windows 13, 15, and 16 stayed low-risk and did not introduce new countdown phrasing, preserving the continuity-state gains already achieved. QA handoff for `ee-ieux`: verify chunk 14 no longer contains the residual phrase or a nearby substitute, read chunks 13-16 together for lived-sequence continuity, and spot-check chunk 0 to confirm the earlier `next few seconds` residue is also gone.

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

**Status:** ✅ Complete

**Results:** QA completed for the follow-up guardrail fix and produced durable artifacts under `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/.plans/artifacts/2026-05-13-phase2-continuity-guardrail-qa/` (`qa-summary.md`, `evidence.json`). QA confirmed the exact audit-blocking chunk 14 line `If the next 5 seconds hit hard, I'm sharing this.` is gone from the bounded rerun and replaced by `If the jungle scene hits as hard as the city one, I'm locked in.` Pattern-sweep evidence from the rerun remained at `afterHitCount: 0` for the widened local-countdown class, and a manual read of chunks 13-16 found the lane still plays like one lived trailer watch rather than four fresh micro-clips. Chunk 0 was also spot-checked against the prior full-thought rerun: the old natural-language miss `Unless Will Smith does something wild in the next second, I'm already scrolling.` is gone from `continuationThought`, now replaced with `If the next beat drops hard enough, I might stick around to see who's actually fighting.` The final audit then independently checked the source artifacts plus the actual rerun output and both cited implementation commits (`51f6898` in `tools`, `4e76e3b` in `emotion-engine`). Durable audit artifacts were written under `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/.plans/artifacts/2026-05-13-phase2-continuity-guardrail-audit/` (`audit-summary.md`, `evidence.json`). Audit confirmed the exact blocked chunk 14 bug is gone, the widened prompt/validator guardrail now covers the intended natural-language countdown class, and chunks 13-16 still preserve lived-sequence continuity without obvious regressions. The remaining generic `seconds` mentions in `thought` fields (for example chunk 0, 4, and 9) were judged non-blocking because they read as persona or full-watch duration commentary rather than local next-chunk reset framing. Outcome: this follow-up plan passed audit, and the larger continuity-state lane can now be closed cleanly.

---

## Final Results

**Status:** ✅ Complete

**What We Built:** Narrow follow-up closure for the Phase 2 continuity-state lane: the prompt/validator guardrail was widened to reject natural-language local countdown phrasing alongside numeric local timestamps, the affected chunk 14/15 lane was rerun with a bounded Phase 2-only pass through chunk 16, QA verified the old phrase was gone, and the final audit confirmed the bug class is closed without reopening continuity regressions.

**Reference Check:** `REF-03`, `REF-04`, and `REF-05` were satisfied by the rerun, QA, and final audit evidence showing the prior chunk 14 miss is gone and the intended bug class now sweeps cleanly. `REF-06`, `REF-07`, and `REF-08` were satisfied by the actual prompt/validator widening in commits `51f6898` and `4e76e3b`. `REF-01` and `REF-02` remain satisfied because the follow-up preserved the larger continuity-state gains and allows that lane to close cleanly.

**Commits:**
- `51f6898` - Widen local countdown phrasing guardrail
- `4e76e3b` - Tighten continuity countdown guardrail follow-up

**Lessons Learned:** Numeric-token bans were not enough for this contract; the real behavioral bug class included natural-language local countdown framing too. The durable fix was to encode that class explicitly in both prompt and validator layers, then prove closure with the smallest honest continuity-preserving rerun rather than another full sweep.

---

*Completed on 2026-05-13*
