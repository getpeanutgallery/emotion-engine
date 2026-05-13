# Peanut Gallery Emotion Engine

**Date:** 2026-05-13  
**Status:** Complete  
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

**Status:** ✅ Complete

**Results:** Ran the smallest honest rerun that still exercised the real symptom path by doing a fresh full-video Phase 2 + Phase 3 rerun while reusing the already-proven Phase 1 packet from `REF-03`. The continuity-specific config lives at `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/.plans/artifacts/2026-05-13-phase2-continuity-state-rerun/full-video-phase2-report.fast-config.yaml`, and the resulting runtime landed at `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/output/cod-test-phase2-continuity-rerun-2026-05-13/`. The main artifact is `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/output/cod-test-phase2-continuity-rerun-2026-05-13/phase2-process/chunk-analysis.json`; durable rerun notes and before/after evidence were captured in `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/.plans/artifacts/2026-05-13-phase2-continuity-state-rerun/summary.md` and `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/.plans/artifacts/2026-05-13-phase2-continuity-state-rerun/evidence.json`. Required windows covered: intro continuity (chunks 0-2), dialogue-relevant transition (chunks 4-5 with overlapping dialogue timing evidence), late-action continuity (chunk 18), and promo/end-card lane (chunks 24-25). The explicit local-relative timestamp phrasing materially dropped from `5` hits in the prior full rerun (`0, 4, 13, 14, 16`) to `0` hits in the rerun artifact. Targeted before/after reads showed better cumulative watch-state carryover: intro chunk 1 now explicitly says the generic intro is over, chunk 18 dropped the false-local `No intro fluff` reset and now says it is seeing the sequence through to the end card, and chunk 25 carries forward the date-focused end-card state from chunk 24 instead of reacting like a fresh cold open. Dialogue-informed thoughts improved in the 20s-30s lane without overcommitting to exposition: chunk 4 now reacts more naturally to the speaking/implant/robot beat, while chunk 5 still stays skeptical about the talking-head cut. Sanity checks also confirmed Phase 3 output shape stayed intact: `summary.json` and `emotional-data.json` preserved their expected top-level keys and `FINAL-REPORT.md` still rendered `Thought`, optional `Continuation Thought`, and `Scroll Risk`. No additional immediate full rerun is justified before QA because this pass already covered the real full-video continuity path.

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

**Status:** ✅ Complete

**Results:** QA completed and a durable artifact was added at `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/.plans/artifacts/2026-05-13-phase2-continuity-state-qa/qa-summary.md`. The continuity refinement was judged to be a real lived-sequence improvement, not merely a regex cleanup: chunk 1 now carries forward the weak-intro reaction, chunks 4-5 use dialogue-supported context naturally without overclaiming, chunk 18 now reads as a late-trailer payoff (`through to the end card`) instead of a cold open, and chunks 24-25 preserve end-card awareness while still acknowledging promo clutter. However, QA found one residual audit-blocking continuity-language issue in the rerun artifact: chunk 14 `continuationThought` still says `If the next 5 seconds hit hard, I'm sharing this.`, which is local-relative timing language inside the thought layer. No obvious grounding regressions were found in the targeted windows or broader thought sweep. Audit handoff: treat the continuity-state refinement as materially improved but not fully complete until the prompt/validator guardrail is widened beyond numeric-second tokens (for example `0.0s`) to also catch natural-language variants like `next 5 seconds`. 

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

**Status:** ❌ Failed

**Results:** Independent audit completed and a durable artifact was added at `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/.plans/artifacts/2026-05-13-phase2-continuity-state-audit/audit-summary.md`. Audit confirmed the continuity-state refinement is a real lived-sequence improvement, not a fake regex win: the rerun removed all prior numeric `0.0s` / `2.0s` timestamp leakage, chunk 1 now explicitly carries forward intro memory, chunk 18 dropped the false-local `No intro fluff` reset and now reads as late-trailer payoff, and chunks 24-25 preserve end-card/date awareness. However, the audit agreed with QA that the residual chunk 14 `continuationThought` — `If the next 5 seconds hit hard, I'm sharing this.` — is still audit-blocking because it reintroduces local 5-second micro-video framing inside the thought layer. The smallest required follow-up is narrow: widen the prompt + validator guardrail beyond numeric-second tokens so it also rejects natural-language local countdown phrasing like `next 5 seconds`, `in the next second`, and similar beat-count language, then rerun the smallest honest validation centered on that lane before re-audit. Bead `ee-8leh` was intentionally left open because the work is materially improved but not yet complete.

---

## Final Results

**Status:** ✅ Complete

**What We Built:** A materially better Phase 2 continuity-state seam: the runner now carries forward compact viewer continuity state, the prompt now frames `thought` as one continuous trailer watch, dialogue-supported thought phrasing improved, and micro-video reset language was eliminated first at the numeric-token layer and then fully closed with the follow-up natural-language countdown guardrail pass. The reruns showed real lived-sequence gains in the intro, late-action, and end-card windows, and the follow-up closure removed the last blocked chunk-14 countdown phrase.

**Reference Check:** `REF-04`, `REF-05`, and `REF-06` were satisfied for the implemented continuity-state carryover, prompt reframing, and validator path. `REF-02`, `REF-03`, and `REF-07` were initially only partially satisfied at first audit time because chunk 14 still contained `next 5 seconds` phrasing, but they were fully satisfied after the narrow follow-up plan `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/.plans/2026-05-13-phase2-continuity-guardrail-followup.md` widened the guardrail and cleared the rerun/audit sweep.

**Commits:**
- `a4751f3` - Refine phase2 continuity state prompts
- `0ef9cf2` - Refine emotion continuity prompt framing
- `51f6898` - Widen local countdown phrasing guardrail
- `4e76e3b` - Tighten continuity countdown guardrail follow-up

**Lessons Learned:** Fixing the continuity seam required more than removing explicit `0.0s`-style timestamps. The real bug class also included natural-language local countdown phrasing, so the durable closure had to encode that class explicitly in both prompt and validator layers and then prove it with the smallest honest continuity-preserving rerun.

---

*Completed on 2026-05-13*
