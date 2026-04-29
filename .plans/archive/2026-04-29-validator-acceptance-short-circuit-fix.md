# Peanut Gallery Emotion Engine

**Date:** 2026-04-29  
**Status:** Complete  
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

### Task 5: QA the short-circuit fix against targeted tests and chunk-0020 artifacts

**Bead ID:** `ee-w6im`  
**SubAgent:** `primary` (for `qa` workflow role)  
**Role:** `qa`  
**References:** `REF-03`, `REF-04`, `REF-05`  
**Prompt:** `Perform an independent QA verification of the validator acceptance short-circuit fix. Verify the bounded regression slice end-to-end using the strongest honest repo-local evidence available. Confirm immediate acceptance on first validator success with normalizedValue, preservation of same-turn metadata/completion behavior, intact pre-acceptance repair behavior, neutralization of the chunk-0020 failure mode, and no scope drift beyond the bounded regression.`

**Folders Created/Deleted/Modified:**
- `.plans/`

**Files Created/Deleted/Modified:**
- `.plans/2026-04-29-validator-acceptance-short-circuit-fix.md`

**Status:** ✅ Complete

**Results:** Independent QA verified the bounded fix using repo-local evidence only. Commit inspection confirmed the production change is confined to `tools/lib/local-validator-tool-loop.cjs` with targeted regression coverage in `tools/test/emotion-lenses-tool.test.js`; the companion docs commit is confined to the plan plus audit/rollout docs, with no prompt/schema/runtime production drift outside the bounded slice. Validation commands: `node --test --test-name-pattern "executeEmotionAnalysisToolLoop" test/emotion-lenses-tool.test.js` ✅ pass; `node --test test/emotion-lenses-tool.test.js` ❌ still shows the two pre-existing prompt-formatting expectation failures already documented by the coder (`builds strict prompt with all sections`, `clips overlapping dialogue and music ranges to the active chunk window in the prompt`) plus their parent suite wrappers, outside this acceptance regression slice; and a targeted Node replay harness over `REF-04` and `REF-05` proved both captured attempt-01 and attempt-02 turn-1 tool envelopes now terminate immediately with `providerCalls=1`, `turns=1`, `validatorCalls=1`, `requestPrompt.mode="tool_loop"`, history `['model_output','validator_acceptance']`, and a single `tool.loop.complete` event carrying the acceptance-turn attempt metadata. QA conclusion: the old post-acceptance `final_artifact_revalidation` / validator-budget-exhaustion failure mode is neutralized for the observed chunk-0020 captures, and pre-acceptance invalid/repair behavior remains intact.

---

### Task 6: Audit the bounded short-circuit fix against code, tests, and captured failure artifacts

**Bead ID:** `ee-917v`  
**SubAgent:** `primary` (for `auditor` workflow role)  
**Role:** `auditor`  
**References:** `REF-03`, `REF-04`, `REF-05`, `REF-06`  
**Prompt:** `Perform an independent audit of the validator acceptance short-circuit fix after coder and QA. Decide whether the bounded slice is actually done by checking the current shared loop implementation, targeted tests, capture-backed replay evidence for chunk-0020 attempt-01 and attempt-02, and the characterization of unrelated full-file test failures. Close the bead only if the slice truly passes without scope drift.`

**Folders Created/Deleted/Modified:**
- `.plans/`

**Files Created/Deleted/Modified:**
- `.plans/2026-04-29-validator-acceptance-short-circuit-fix.md`

**Status:** ✅ Complete

**Results:** Independent audit passed. I verified the production change is still confined to `/home/derrick/.openclaw/workspace/projects/peanut-gallery/tools/lib/local-validator-tool-loop.cjs` and that the only targeted test changes are in `/home/derrick/.openclaw/workspace/projects/peanut-gallery/tools/test/emotion-lenses-tool.test.js`, matching the bounded rollout contract in `docs/2026-04-29-validator-acceptance-short-circuit-rollout.md`. I re-ran `node --test --test-name-pattern "executeEmotionAnalysisToolLoop" test/emotion-lenses-tool.test.js` (pass), re-ran `node --test test/emotion-lenses-tool.test.js` (same unrelated prompt-formatting failures outside this slice), inspected both chunk-0020 captures to confirm turn-1 `validator_acceptance` with `normalizedValue`, and replayed both real capture histories through the current shared loop implementation. Both attempt-01 and attempt-02 now terminate successfully on turn 1 with `providerCalls=1`, `validatorCalls=1`, history `['model_output','validator_acceptance']`, and a single `tool.loop.complete` event, which neutralizes the old post-acceptance validator-budget failure mode without changing pre-acceptance invalid/repair behavior.

---

## Final Results

**Status:** ✅ Complete

**What We Built:** The shared local validator loop now short-circuits immediately on the first validator-approved normalized emotion-analysis artifact, preserving same-turn completion metadata and diagnostics while removing the false post-acceptance validator-budget failure seen in chunk-0020.

**Reference Check:** `REF-03` satisfied by the bounded shared-loop code change plus targeted regression coverage; `REF-04` and `REF-05` satisfied by direct capture inspection and replay through the current loop showing turn-1 success; `REF-06` satisfied by showing the old failure category/message correspond to a post-acceptance exhaustion mode that the new semantics eliminate. No production scope drift into prompts, schemas, chunk consumer logic, or English-only policy was found in this slice.

**Commits:**
- `334b7b9` - Short-circuit validator acceptance in tool loop
- `4cd6699` - Document validator acceptance short-circuit fix

**Lessons Learned:** When a local validator already returns a canonical normalized artifact, treating later provider turns as mandatory “confirmation” is a correctness bug, not just an efficiency bug. Capture-backed replay is a strong audit tool for proving semantic regressions are actually neutralized.

---

*Completed on 2026-04-29*