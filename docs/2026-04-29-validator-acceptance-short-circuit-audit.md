# Validator Acceptance Short-Circuit Audit

**Date:** 2026-04-29  
**Scope:** Audit only. No implementation changes.  
**Primary failure bead:** `ee-2fff`

---

## Executive Summary

The regression lives in the shared local validator loop, not in the `video-chunks` chunk consumer.

Once `validate_emotion_analysis_json` returns `valid: true`, the runtime already has a validator-approved normalized artifact in hand, but `executeLocalValidatorToolLoop(...)` does **not** accept it. Instead, it keeps prompting the model for more turns and spends more validator-call budget trying to observe an additional final artifact turn. That turns a logical success into `invalid_output: exceeded validate_emotion_analysis_json tool-call limit`.

The smallest safe fix is to short-circuit to success inside the shared tool loop at the first validator-approved acceptance point, using the normalized artifact already returned by the validator tool. No schema, prompt, provider, chunk-analysis, or pipeline contract broadening is required.

---

## References Audited

- Plan: `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/.plans/2026-04-29-validator-acceptance-short-circuit-fix.md`
- Chunk consumer: `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/server/scripts/process/video-chunks.cjs`
- Shared loop: `/home/derrick/.openclaw/workspace/projects/peanut-gallery/tools/lib/local-validator-tool-loop.cjs`
- Failure trace attempt 1: `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/output/cod-test/phase2-process/raw/ai/chunk-0020/split-00/attempt-01/capture.json`
- Failure trace attempt 2: `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/output/cod-test/phase2-process/raw/ai/chunk-0020/split-00/attempt-02/capture.json`
- Script failure summary: `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/output/cod-test/phase2-process/script-results/video-chunks.failure.json`

---

## Exact Failure Location

### 1) Primary leak: accepted tool-call branch keeps looping instead of returning

In `/home/derrick/.openclaw/workspace/projects/peanut-gallery/tools/lib/local-validator-tool-loop.cjs`, inside `executeLocalValidatorToolLoop(...)`, the `toolCall.ok` branch does this:

- increments `validatorCalls`
- runs `executeValidatorTool(...)`
- records `validator_acceptance`
- stores `successfulValidatedValue = toolResult.normalizedValue`
- then **always `continue`s** to the next turn

That means the runtime explicitly preserves a valid normalized artifact but refuses to terminate on it.

### 2) Secondary leak: direct-final-artifact branch requires extra post-acceptance churn

Later in the same file, when the model emits plain final JSON instead of a tool envelope, the loop:

- checks whether validator budget is already exhausted
- auto-validates the final artifact
- if valid, compares `normalizeValidatedValue(validatedValue)` against the earlier `successfulValidatedValue`
- if they differ, it updates `successfulValidatedValue` and **continues again**
- it only returns success when the new validated final artifact matches the prior stored validated value exactly

So even after prior validator acceptance, the loop still expects another final artifact turn and, in some cases, repeated matching final artifact turns.

---

## What the Captured Failure Shows

### Attempt 1 (`attempt-01/capture.json`)

Observed sequence:

1. Turn 1: model emits canonical tool envelope → validator returns `valid: true`
2. Turn 2: model emits canonical tool envelope again → validator returns `valid: true`
3. Turn 3: model emits canonical tool envelope again → validator returns `valid: true`
4. Turn 4: model finally emits plain final JSON
5. Runtime throws `Exceeded validate_emotion_analysis_json tool-call limit before emotion analysis could be validated.`

Why this fails:

- The loop consumed all 3 validator calls on already-valid tool calls.
- Because the tool-call acceptance path never returned, turn 4 entered the plain-final-artifact path.
- That path checks `if (validatorCalls >= maxValidatorCalls)` **before** auto-validating the final JSON.
- Result: a logically successful run is converted into a budget-exhaustion failure.

### Attempt 2 (`attempt-02/capture.json`)

Observed sequence:

1. Turn 1: model emits canonical tool envelope → validator returns `valid: true`
2. Turn 2: model emits plain final JSON → auto-validation returns `valid: true`
3. Turn 3: model emits another plain final JSON → auto-validation returns `valid: true`
4. Turn 4: model emits another plain final JSON
5. Runtime again throws `Exceeded validate_emotion_analysis_json tool-call limit before emotion analysis could be validated.`

Why this fails:

- After the first accepted tool call, the loop still did not return.
- On turns 2 and 3, the loop revalidated plain final JSON and treated those as `final_artifact_revalidation` events.
- Because the final JSON kept changing across turns, the normalized outputs did not match the previously stored accepted value, so the loop kept replacing `successfulValidatedValue` and continuing.
- By turn 4, validator budget was exhausted, so the final artifact could not even be auto-validated again.

### Script summary corroboration

`/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/output/cod-test/phase2-process/script-results/video-chunks.failure.json` reports:

- `category: invalid_output`
- `message: Chunk 21 failed after 2 attempts: invalid_output: exceeded validate_emotion_analysis_json tool-call limit`

That matches the per-attempt traces exactly.

---

## Correct Acceptance Behavior

### Required rule

The runtime should accept success **immediately when the validator tool returns**:

```json
{ "valid": true, "normalizedValue": <artifact> }
```

That is the earliest point at which the system has a schema-approved, normalized artifact. No additional model turn is required to prove success.

### Correct short-circuit behavior

On the first `toolResult.valid === true` with a present `normalizedValue`, the loop should:

1. treat the run as complete
2. emit the normal completion event (`tool.loop.complete`)
3. return the normalized artifact as `parsed`
4. preserve loop history and validator-call counts for diagnostics
5. stop asking the provider for more turns

### Why this is the right boundary

- The validator tool is already the acceptance authority.
- The normalized artifact is already available.
- The consumer (`video-chunks.cjs`) only needs `toolLoopResult.parsed` to build `candidateChunkResult`.
- Requiring an additional provider turn adds cost and creates a false failure mode without increasing correctness.

---

## Data That Should Be Persisted At Acceptance Time

At the moment of validator acceptance, the runtime already has all required durable data.

### Minimum data to return/persist

1. **Accepted normalized artifact**
   - `parsed: toolResult.normalizedValue`
   - `toolLoop.finalArtifact: toolResult.normalizedValue`

2. **Provider completion that produced the accepted tool call**
   - keep the current turn’s `completion`
   - this is the last real model output associated with acceptance
   - its raw content will be the canonical tool-call envelope, which is correct evidence for how acceptance happened

3. **Tool-loop history and counters**
   - `toolLoop.history`
   - `toolLoop.validatorCalls`
   - `toolLoop.turns`
   - these preserve diagnostic traceability

4. **Prompt mode metadata**
   - `requestPrompt.mode`
   - same shape as the existing success path

### Why no extra persistence surface is needed

`/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/server/scripts/process/video-chunks.cjs` already captures and persists:

- `completion`
- `toolLoop`
- parsed chunk result derived from `toolLoopResult.parsed`
- raw capture metadata in `writeChunkRaw(...)`

So the consumer contract is already sufficient. The loop just needs to return success sooner.

---

## Smallest Implementation Surface

### Required code surface

**Primary code change only:**

- `/home/derrick/.openclaw/workspace/projects/peanut-gallery/tools/lib/local-validator-tool-loop.cjs`

### Why this is sufficient

- The bug is in shared acceptance semantics there.
- `video-chunks.cjs` is already consuming the loop result correctly.
- The failure artifacts show the consumer only fails because the loop escalates a post-acceptance false error.

### Likely accompanying validation surface

To lock the regression down, targeted test updates/additions should live in:

- `/home/derrick/.openclaw/workspace/projects/peanut-gallery/tools/test/emotion-lenses-tool.test.js`

Not because production behavior needs that file changed to work, but because current test coverage encodes the old behavior: it expects a `validator_acceptance` event followed by `final_artifact_revalidation`, i.e. a second validation pass after acceptance.

### What should stay out of scope

No changes should be required to:

- `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/server/scripts/process/video-chunks.cjs`
- prompt wording outside what the shared loop already uses
- schema definitions
- chunk strategy / retry policy / failover logic
- emotion scoring semantics
- English-only rollout rules

---

## Recommended Bounded Fix Shape

Inside the `toolCall.ok` branch of `executeLocalValidatorToolLoop(...)`:

- after recording `validator_acceptance`
- if `toolResult.valid && toolResult.normalizedValue`
- emit `tool.loop.complete`
- return the same success structure the loop already returns later:
  - `completion`
  - `parsed`
  - `requestPrompt`
  - `toolLoop` with `history`, `turns`, `validatorCalls`, `finalArtifact`

That removes the need for:

- a mandatory follow-up final JSON turn after tool acceptance
- exact normalized-value equality checks across later turns for already-accepted runs
- further validator budget consumption after acceptance

---

## Notes On Existing Test Intent vs Runtime Reality

The current test in `/home/derrick/.openclaw/workspace/projects/peanut-gallery/tools/test/emotion-lenses-tool.test.js` expects:

- one `validator_acceptance`
- then one `final_artifact_revalidation`
- total `validatorCalls === 2`

That expectation reflects the old two-step contract, not the desired runtime behavior revealed by the chunk-21 failure.

For this regression, the correct behavior is:

- accept on first validator-approved normalized artifact
- do not require a second provider turn or a second validator pass solely to mirror the approved artifact back

---

## Bottom Line

The runtime keeps asking for more turns in the shared local validator loop after already receiving a validator-approved normalized artifact.

**Root cause:** `executeLocalValidatorToolLoop(...)` stores acceptance but does not terminate on it.  
**Correct behavior:** short-circuit immediately on the first `valid=true` normalized validator result.  
**Required persisted data:** accepted normalized artifact, current completion, loop history/counters, and normal request metadata.  
**Smallest fix surface:** shared loop file only, with targeted regression-test updates.
