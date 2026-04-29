# Validator Acceptance Short-Circuit Rollout Contract

**Date:** 2026-04-29  
**Scope:** Decision package only. No implementation in this document.  
**Primary bead:** `ee-83af`

---

## Purpose

Define the exact bounded contract for fixing the validator acceptance regression in the shared local validator tool loop.

This contract is intentionally narrow:

- it changes **when success is declared** after validator acceptance
- it keeps the fix inside validator acceptance semantics
- it does **not** broaden schema, prompt, chunking, retry, or persona behavior

---

## Inputs Reviewed

- Plan: `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/.plans/2026-04-29-validator-acceptance-short-circuit-fix.md`
- Audit: `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/docs/2026-04-29-validator-acceptance-short-circuit-audit.md`
- Shared loop implementation: `/home/derrick/.openclaw/workspace/projects/peanut-gallery/tools/lib/local-validator-tool-loop.cjs`
- Existing targeted test file: `/home/derrick/.openclaw/workspace/projects/peanut-gallery/tools/test/emotion-lenses-tool.test.js`
- Failure artifact 1: `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/output/cod-test/phase2-process/raw/ai/chunk-0020/split-00/attempt-01/capture.json`
- Failure artifact 2: `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/output/cod-test/phase2-process/raw/ai/chunk-0020/split-00/attempt-02/capture.json`

---

## Exact Acceptance Rule

### Required rule

Inside `executeLocalValidatorToolLoop(...)`, the run must be accepted **immediately** when all of the following are true in the canonical tool-call branch:

1. the model output parses as the canonical validator tool envelope for the active tool contract
2. `executeValidatorTool(...)` returns `toolResult.valid === true`
3. `toolResult.normalizedValue` is present and is the validator-approved artifact

When those conditions are met, the loop must **stop immediately** and return success from that same turn.

### Explicitly accepted point

The acceptance point is the first `validator_acceptance` event whose tool result contains the normalized artifact.

### Explicitly not required for success

After the acceptance point above, the runtime must **not require** any of the following before succeeding:

- a follow-up plain final JSON turn from the model
- a second validator pass over the same artifact
- normalized equality between later model outputs and the already accepted artifact
- additional provider turns for artifact “confirmation”

### Why this is the source-of-truth rule

At that point the validator has already established that the candidate satisfies the schema and normalization contract. The runtime already has the accepted artifact in hand. Requiring another model turn adds no correctness and is the direct cause of the observed false failures.

---

## Data That Must Be Persisted At Acceptance Time

At the exact acceptance turn, the runtime must preserve the same diagnostic/result shape it already returns on later success, but using the accepted validator result immediately.

### Required returned/persisted data

1. **Accepted normalized artifact**
   - `parsed = toolResult.normalizedValue`
   - `toolLoop.finalArtifact = toolResult.normalizedValue`

2. **Completion associated with the acceptance turn**
   - preserve the current `completion`
   - this is the provider completion whose content produced the accepted tool call

3. **Prompt metadata for that turn**
   - `requestPrompt.mode = promptMode`
   - `requestPrompt.repairSummary = null` (same as current success path unless the implementation already computes something else earlier)

4. **Tool loop diagnostics**
   - `toolLoop.toolName`
   - `toolLoop.maxTurns`
   - `toolLoop.maxValidatorCalls`
   - `toolLoop.turns = current turn`
   - `toolLoop.validatorCalls = current validator call count after increment`
   - `toolLoop.history` including:
     - the assistant model output for the turn
     - the `validator_acceptance` tool event for the turn

5. **Normal completion event emission**
   - emit `tool.loop.complete` once, from the acceptance turn
   - event payload should continue to report the actual turn and validator call count used up to that acceptance point

### Persistence constraint

No new persistence sink is required. The existing consumer contract is sufficient as long as the shared loop returns success immediately with the data above.

---

## What Remains Invalid / Failure Behavior

This fix is **not** a general relaxation of validation. Genuinely bad candidates must still use the current repair/failure path.

### Still invalid: malformed tool envelope

If the model emits an invalid or malformed tool-call envelope:

- continue to record `malformed_tool_call_envelope`
- continue the loop exactly as today
- do not accept

### Still invalid: validator rejection

If `executeValidatorTool(...)` returns `valid !== true`:

- record `validator_rejection`
- continue the repair loop exactly as today
- do not accept

### Still invalid: plain final JSON before any successful validator acceptance

If the model emits plain final JSON before any successful validator acceptance:

- the runtime may continue its current auto-validation path
- success is allowed only if that auto-validation returns `valid === true`
- if invalid, continue repair behavior exactly as today

### Still invalid: parse failure / non-JSON output

If the provider emits non-JSON or otherwise unparsable content:

- keep the current retryable invalid-output behavior
- do not accept

### Still invalid: real tool-call budget exhaustion before any acceptance

If the runtime reaches `maxValidatorCalls` **before** obtaining any successful validator acceptance or valid auto-validated final artifact:

- keep throwing the current tool-call-limit failure
- do not soften this behavior

### Important post-fix boundary

Only **post-acceptance** failures are removed. Pre-acceptance failures remain unchanged.

---

## Smallest Implementation Surface

### Required production change

Only the shared loop requires production logic change:

- `/home/derrick/.openclaw/workspace/projects/peanut-gallery/tools/lib/local-validator-tool-loop.cjs`

### Intended code-shape boundary

The change should be confined to the `toolCall.ok` branch in `executeLocalValidatorToolLoop(...)`.

Concretely:

- after the validator result is recorded in history
- if the validator accepted and produced `normalizedValue`
- immediately emit `tool.loop.complete`
- immediately return the same success object shape currently returned later in the function

### Must stay out of scope

Do **not** require production changes in:

- `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/server/scripts/process/video-chunks.cjs`
- schema definitions for emotion analysis
- prompt wording beyond what already exists
- retry target selection or failover policy
- English-only policy logic
- chunk capture writing / raw artifact persistence behavior
- scoring semantics for patience / boredom / excitement

---

## Targeted Regression Validation Required

The regression proof should be narrow and directly tied to the bug.

### 1) Unit-level/tool-loop regression coverage

Update or add targeted assertions in:

- `/home/derrick/.openclaw/workspace/projects/peanut-gallery/tools/test/emotion-lenses-tool.test.js`

Required proof points:

1. when the first response is a canonical tool envelope whose validator result is valid,
   - the loop returns success immediately
   - `result.parsed` equals the validator `normalizedValue`
   - `toolLoop.validatorCalls === 1`
   - the loop history ends with `validator_acceptance`
   - there is **no** required `final_artifact_revalidation` event for the success path

2. the returned result still includes:
   - `completion`
   - `requestPrompt`
   - `toolLoop.history`
   - `toolLoop.finalArtifact`

3. existing rejection/repair behavior remains intact for invalid candidates

### 2) Artifact-backed regression check against the observed failure mode

Use the two capture artifacts as acceptance evidence for expected behavior:

- `output/cod-test/phase2-process/raw/ai/chunk-0020/split-00/attempt-01/capture.json`
- `output/cod-test/phase2-process/raw/ai/chunk-0020/split-00/attempt-02/capture.json`

Required conclusion the coder/QA/auditor must verify:

- **attempt 1** would have succeeded on turn 1, not failed after spending all 3 validator calls
- **attempt 2** would have succeeded on turn 1, not continued into repeated `final_artifact_revalidation`

A replay harness is acceptable if available, but it is **not required** if targeted test construction proves the same acceptance-turn semantics directly.

### 3) Optional high-fidelity check if cheap to run

If the repo already has a practical low-cost rerun path, a targeted rerun of the affected chunk/window is good additional evidence, but it is optional for this bounded fix. The must-have proof is the unit/tool-loop regression coverage plus artifact-backed reasoning above.

---

## Explicit Non-Goals / Scope Boundaries

This rollout contract does **not** attempt to solve any of the following:

- improving model obedience after validator success
- forcing providers to emit stable summaries/reasoning across turns
- changing how plain final artifacts are normalized before any acceptance exists
- revising the local validator prompt language
- handling multilingual chain-of-thought leakage or provider reasoning language
- changing the meaning of `final_artifact_revalidation` outside the accepted-before-final case
- broad refactors of `executeLocalValidatorToolLoop(...)`
- changing chunk-21 semantic content, persona interpretation, or scoring correctness
- introducing new telemetry schemas or capture formats

---

## Implementation Handoff Summary

A coder should implement exactly this:

1. in the shared loop’s canonical tool-call branch, treat the first `valid === true` + `normalizedValue` result as terminal success
2. return the normalized artifact immediately using the existing success result structure
3. preserve current diagnostics/history/completion metadata from the acceptance turn
4. leave all pre-acceptance invalid/repair/failure behavior unchanged
5. update targeted tests so they prove immediate success on validator acceptance and no longer require a follow-up final-artifact revalidation step

That is the bounded fix.
