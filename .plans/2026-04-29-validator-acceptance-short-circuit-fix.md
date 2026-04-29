# Peanut Gallery Emotion Engine

**Date:** 2026-04-29  
**Status:** In Progress  
**Agent:** Cookie 🍪

---

## Goal

Fix the validator-loop regression so a chunk run immediately accepts the normalized artifact once `validate_emotion_analysis_json` returns `valid=true`, instead of requiring the persona model to keep re-emitting the artifact afterward.

---

## Overview

The fresh `cod-test` rerun showed a real runtime bug in our local validator tool loop. On the failing later chunk, the persona model produced validator-approved emotion-analysis candidates multiple times, but the runtime still treated the chunk as incomplete because it expected an additional final response turn from the model. That burned the validator-call budget and turned a logical success into an `invalid_output` failure.

This slice should stay tightly focused on acceptance semantics in the structured-output loop and its chunk consumer. We are not changing the emotion schema, benchmark contract, persona prompts, or English-only rollout policy here. The fix should make the runtime short-circuit to success as soon as it already holds a validator-approved normalized artifact, while preserving existing repair behavior for genuinely invalid candidates.

The implementation needs a clean coder → QA → auditor loop with direct regression evidence from the chunk-21 failure trail. Validation should include a replay or targeted rerun path showing that a valid validator result now terminates the chunk successfully rather than consuming extra validator calls.

---

## REFERENCES

| ID | Description | Path |
| --- | --- | --- |
| `REF-01` | English-only rollout plan and current clarified contract | `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/.plans/2026-04-29-english-only-ai-prompts-across-phases.md` |
| `REF-02` | Current canonical chunk prompt/tool runtime that hit the bug | `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/server/scripts/process/video-chunks.cjs` |
| `REF-03` | Shared local validator loop implementation likely responsible for acceptance semantics | `/home/derrick/.openclaw/workspace/projects/peanut-gallery/tools/lib/local-validator-tool-loop.cjs` |
| `REF-04` | Failing chunk trail, attempt 1 | `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/output/cod-test/phase2-process/raw/ai/chunk-0020/split-00/attempt-01/capture.json` |
| `REF-05` | Failing chunk trail, attempt 2 | `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/output/cod-test/phase2-process/raw/ai/chunk-0020/split-00/attempt-02/capture.json` |
| `REF-06` | Script-level failure summary from the fresh rerun | `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/output/cod-test/phase2-process/script-results/video-chunks.failure.json` |

---

## Tasks

### Task 1: Audit the validator-loop regression and define the exact acceptance fix

**Bead ID:** `ee-2fff`  
**SubAgent:** `primary` (for `research` workflow role)  
**Role:** `research`  
**References:** `REF-02`, `REF-03`, `REF-04`, `REF-05`, `REF-06`  
**Prompt:** `Audit the validator-loop regression using the chunk-21 failure artifacts and the local validator loop implementation. Identify exactly where the runtime keeps asking for more turns after already receiving a validator-approved normalized artifact, what the correct short-circuit behavior should be, and the smallest implementation surface needed to fix it without broadening scope. Save the findings in docs/ and update this plan.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `docs/`

**Files Created/Deleted/Modified:**
- `.plans/2026-04-29-validator-acceptance-short-circuit-fix.md`
- `docs/2026-04-29-validator-acceptance-short-circuit-audit.md`

**Status:** ✅ Complete

**Results:** Audit complete. The regression is in the shared local validator loop (`/home/derrick/.openclaw/workspace/projects/peanut-gallery/tools/lib/local-validator-tool-loop.cjs`), not in `server/scripts/process/video-chunks.cjs`. The loop preserves `toolResult.normalizedValue` after `validator_acceptance` but always continues instead of short-circuiting to success; the plain-final-artifact branch also keeps revalidating later outputs and can fail on validator-call exhaustion after a logical success. Evidence and the bounded fix surface were documented in `docs/2026-04-29-validator-acceptance-short-circuit-audit.md` using `REF-02` through `REF-06`. Smallest scoped implementation surface: the shared loop file, plus targeted regression-test updates to align expectations with immediate acceptance.

---

### Task 2: Define the bounded rollout contract for the short-circuit fix

**Bead ID:** `ee-83af`  
**SubAgent:** `primary` (for `research` workflow role)  
**Role:** `research`  
**References:** `REF-02`, `REF-03`, `REF-04`, `REF-05`, `REF-06`  
**Prompt:** `Using the regression audit, define the exact implementation/verification contract for the validator acceptance short-circuit fix. Specify when the runtime must accept a candidate immediately, what data must be persisted, what remains invalid/failure behavior, and what targeted regression validation is required. Keep it tightly scoped to acceptance semantics.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `docs/`

**Files Created/Deleted/Modified:**
- `.plans/2026-04-29-validator-acceptance-short-circuit-fix.md`
- `docs/2026-04-29-validator-acceptance-short-circuit-rollout.md`

**Status:** ✅ Complete

**Results:** Decision package complete in `docs/2026-04-29-validator-acceptance-short-circuit-rollout.md`. The contract fixes only validator acceptance semantics: once the shared loop receives a canonical validator tool result with `valid === true` and a `normalizedValue`, it must short-circuit immediately and return success from that same turn with the accepted normalized artifact plus the existing completion/history metadata. The package preserves current failure behavior for malformed, rejected, or pre-acceptance exhausted candidates, keeps the smallest production surface in `tools/lib/local-validator-tool-loop.cjs`, and defines the required targeted regression proof in `tools/test/emotion-lenses-tool.test.js` using the chunk-21 attempt artifacts as grounding evidence.

---

### Task 3: Prepare execution beads for coder → QA → auditor

**Bead ID:** `ee-zy4r`  
**SubAgent:** `primary` (for `primary` workflow role)  
**Role:** `primary`  
**References:** `REF-02`, `REF-03`, `REF-04`, `REF-05`, `REF-06`  
**Prompt:** `After the short-circuit fix contract is approved in the plan, create the repo-local execution beads needed for implementation, QA, and audit. The bead package must stay bounded to the validator acceptance regression and its targeted rerun/replay verification.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `.beads/`

**Files Created/Deleted/Modified:**
- `.plans/2026-04-29-validator-acceptance-short-circuit-fix.md`

**Status:** ✅ Complete

**Results:** Execution bead package prepared and linked in repo-local Beads. Created `ee-8dqr` for the coder lane (implement the shared-loop short-circuit in `tools/lib/local-validator-tool-loop.cjs` plus the smallest targeted regression-test updates in `tools/test/emotion-lenses-tool.test.js`, with explicit artifact-backed reasoning for chunk-0020 attempt-01 and attempt-02); created `ee-w6im` for the QA lane (independent targeted replay/rerun-style verification that the implementation now terminates on first `validator_acceptance` and resolves the observed failure mode without scope drift); and created `ee-917v` for the auditor lane (independent truth-check of bounded scope, final diff, and verification evidence before closure). Dependency order is explicit: `ee-w6im` depends on `ee-8dqr`, and `ee-917v` depends on both `ee-8dqr` and `ee-w6im`, so the coder → QA → auditor loop is enforced in Beads rather than left implicit in prose.

---

### Task 4: Implement the short-circuit fix and capture bounded regression proof

**Bead ID:** `ee-8dqr`  
**SubAgent:** `primary` (for `coder` workflow role)  
**Role:** `coder`  
**References:** `REF-03`, `REF-04`, `REF-05`  
**Prompt:** `Implement the bounded validator acceptance short-circuit fix in the shared local validator loop. Keep scope tightly bounded to acceptance semantics and targeted regression proof. Update the plan with exact files changed, validation commands/results, and the artifact-backed explanation for how chunk-0020 attempt-01 and attempt-02 now terminate on first validator acceptance.`

**Folders Created/Deleted/Modified:**
- `/home/derrick/.openclaw/workspace/projects/peanut-gallery/tools/lib/`
- `/home/derrick/.openclaw/workspace/projects/peanut-gallery/tools/test/`
- `.plans/`

**Files Created/Deleted/Modified:**
- `/home/derrick/.openclaw/workspace/projects/peanut-gallery/tools/lib/local-validator-tool-loop.cjs`
- `/home/derrick/.openclaw/workspace/projects/peanut-gallery/tools/test/emotion-lenses-tool.test.js`
- `.plans/2026-04-29-validator-acceptance-short-circuit-fix.md`

**Status:** ✅ Complete

**Results:** Implemented the short-circuit in `executeLocalValidatorToolLoop(...)` so the first canonical `validator_acceptance` with a present `normalizedValue` now immediately emits `tool.loop.complete` and returns success from that same turn with `parsed`, `requestPrompt.mode`, `toolLoop.history`, `toolLoop.turns`, `toolLoop.validatorCalls`, and `toolLoop.finalArtifact` preserved from the acceptance turn. Targeted tests were updated to assert one-turn acceptance with preserved completion metadata and to prove pre-acceptance repair behavior is unchanged. Validation: `node --test --test-name-pattern "executeEmotionAnalysisToolLoop" test/emotion-lenses-tool.test.js` passed; the wider file still has two pre-existing prompt-formatting failures outside this slice (`builds strict prompt with all sections`, `clips overlapping dialogue and music ranges to the active chunk window in the prompt`). Artifact-backed regression evidence: a direct capture inspection confirmed both `REF-04` and `REF-05` recorded `validator_acceptance` on turn 1 after only one validator call, so under the new loop semantics both attempts would now terminate successfully at that first acceptance instead of continuing to turn 4 and exhausting the validator-call budget.

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