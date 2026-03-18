---
plan_id: plan-2026-03-12-subagent-surrogate-tool-loop-debug
---
# emotion-engine: debug Phase3 validator tool loop using a subagent surrogate

**Date:** 2026-03-12  
**Status:** Complete  
**Agent:** Cookie 🍪

---

## Goal

Use a surrogate run to determine whether the Phase 3 recommendation failure is mainly caused by prompt/protocol ambiguity, tool-envelope complexity, or provider transport/truncation.

---

## What I inspected

### Code paths
- `server/scripts/report/recommendation.cjs`
- `server/lib/recommendation-validator-tool.cjs`
- `node_modules/ai-providers/providers/openrouter.cjs`

### Prompt + live artifacts
- Base prompt artifact from the current Phase 3-only rerun:
  - `output/cod-test/raw/ai/_prompts/2c8f47cff6e096c70a9e9a5122f9816629cf18c2f269b853bca558dc819932e5.json`
- Live attempt captures for the current Gemini preview rerun:
  - `output/cod-test/phase3-report/raw/ai/recommendation/attempt-01/capture.json`
  - `output/cod-test/phase3-report/raw/ai/recommendation/attempt-02/capture.json`
  - `output/cod-test/phase3-report/raw/ai/recommendation/attempt-03/capture.json`
- Parent bug context:
  - `bd show ee-5dv --json`
- Run log:
  - `output/_logs/phase3-live-validation-20260312-2206-rerun.log`

### Surrogate artifacts created
- Reconstructed effective turn-1 prompt actually sent to the provider:
  - `output/cod-test/phase3-report/raw/ai/recommendation/surrogate-effective-turn1-prompt.txt`
- Surrogate first-step output:
  - `output/cod-test/phase3-report/raw/ai/recommendation/surrogate-gemini-first-step.txt`

---

## Reconstructed effective provider protocol

The live provider does **not** see only the base prompt artifact. On turn 1 it sees:

1. The base recommendation prompt (`buildPrompt(...)`)
2. A local tool-loop wrapper (`buildToolLoopPrompt(...)`)
3. The validator contract and canonical tool envelope
4. Turn budget + validator-call budget
5. Conversation history (empty on turn 1)

### Turn-1 wrapper excerpt

From `output/cod-test/phase3-report/raw/ai/recommendation/surrogate-effective-turn1-prompt.txt`:

- Canonical tool envelope:
  - `{"tool":"validate_recommendation_json","recommendation":{...}}`
- Alternative allowed form:
  - final recommendation JSON directly
- Acceptance rules:
  - final recommendation accepted only after validator says `{"valid": true}`
  - no wrappers like `type/toolName/arguments/args/input`
  - no markdown, prose, or multiple objects

### Important implementation detail from `recommendation.cjs`

The tool loop is stricter in the prompt than in the actual control flow:

- If the model returns the canonical tool envelope, the loop executes the validator directly.
- If the model returns a plain recommendation JSON object, the loop **auto-validates it anyway** by wrapping it as `{ recommendation: parsedObject.value }` and calling `executeRecommendationValidatorTool(...)`.
- So a clean final JSON object on turn 1 is still viable in practice even if the prompt strongly nudges tool-first behavior.

This matters because a surrogate that skips the tool envelope is not necessarily evidence of failure.

---

## Live capture comparison

### Attempt 1
- File: `output/cod-test/phase3-report/raw/ai/recommendation/attempt-01/capture.json`
- Raw content length: **118 chars**
- Starts as:
  - `{"tool": "validate_recommendation_json", "recommendation": { "text": "The video features a highly effective 1`
- Parse error:
  - `Unterminated string in JSON at position 118`
- `validatorCalls`: **0**
- Usage reports:
  - `input=7915`, `output=896`, `total=8811`

### Attempt 2
- File: `output/cod-test/phase3-report/raw/ai/recommendation/attempt-02/capture.json`
- Raw content length: **119 chars**
- Starts as:
  - `{"tool": "validate_recommendation_json", "recommendation": { "text": "The video features a highly effective 15`
- Parse error:
  - `Unterminated string in JSON at position 119`
- `validatorCalls`: **0**
- Usage reports:
  - `input=7915`, `output=896`, `total=8811`

### Attempt 3
- File: `output/cod-test/phase3-report/raw/ai/recommendation/attempt-03/capture.json`
- Raw content length: **132 chars**
- Starts as:
  - `9 music track (excitement at 8/10), the transition to abstract threats like "global unrest" ...`
- Parse error:
  - `Unexpected non-whitespace character after JSON at position 2`
- `validatorCalls`: **0**
- Usage reports:
  - `input=7915`, `output=896`, `total=8811`

### What those three attempts imply

1. The live provider clearly understands the protocol **well enough to start the canonical tool envelope** on attempts 1 and 2.
2. Attempt 3 begins **mid-sentence**, which is not a natural prompt-compliance failure mode; it looks like a response fragment starting from the middle of a longer completion.
3. All three attempts report **896 output tokens** while only **118–132 characters** were captured in `content`.
   - That is the strongest signal in this investigation.
   - If the provider truly only emitted 118 chars, output usage would not plausibly be 896 tokens.
   - The capture is almost certainly not the full assistant text that the provider claims it generated.

---

## Surrogate experiment

### Method

I reconstructed the exact turn-1 prompt and ran a one-shot surrogate completion with Gemini CLI:

```bash
gemini --model gemini-2.5-pro "$(cat output/cod-test/phase3-report/raw/ai/recommendation/surrogate-effective-turn1-prompt.txt)"
```

Output captured at:
- `output/cod-test/phase3-report/raw/ai/recommendation/surrogate-gemini-first-step.txt`

### Surrogate first-step behavior

The surrogate returned a **complete recommendation JSON object on the first step**, not a tool envelope.

Notable details:
- It produced a coherent, full recommendation body.
- It ignored the intended validator-first choreography.
- The CLI wrapped the object in markdown fences and appended a footer line, so the raw CLI output is not directly machine-usable.
- However, the underlying recommendation object itself is structurally complete and substantially longer than the live captured fragments.

Surrogate output length:
- **3281 chars** total in the captured CLI output file.

### Interpretation

The surrogate suggests:
- The prompt/input shape is understandable enough for another model to produce a detailed recommendation immediately.
- The tool-loop instructions are **not perfectly binding**; models may skip directly to final JSON.
- But because `recommendation.cjs` auto-validates plain JSON candidates, this is **not** the dominant blocker.

If the live provider had returned a clean full recommendation JSON instead of a fragment, the current loop likely would have progressed.

---

## Failure mode judgment

## Dominant failure mode: provider truncation / transport / response extraction mismatch

This lane points most strongly to **provider transport or adapter extraction mismatch**, not prompt ambiguity.

### Why not prompt ambiguity?
- Attempts 1 and 2 begin with the exact expected tool name: `validate_recommendation_json`.
- That means the model is already tracking the protocol closely enough to attempt the right envelope.
- A prompt-ambiguity failure would more likely look like prose, markdown explanation, wrong key names, or a different object shape.

### Why not envelope complexity as the dominant issue?
- Envelope complexity is a secondary weakness: the surrogate skipped the tool call and went straight to final JSON.
- But the live failures are not malformed-wrapper failures like `toolName/arguments/args/input` nesting.
- The live outputs are **abnormally tiny fragments**.
- Even a perfect simpler envelope would still fail if the transport/adapter only surfaces the first ~120 chars or a mid-stream slice.

### Why transport/extraction is the best fit
- Live attempt content sizes are tiny but usage says the model produced **896 output tokens** each time.
- Attempt 3 starts in the **middle of a sentence**, which looks like broken extraction, partial content selection, or upstream truncation rather than normal model behavior.
- `node_modules/ai-providers/providers/openrouter.cjs` only extracts text from `choices[0].message.content` (or `message.audio.transcript`) and ignores other OpenRouter/provider-specific fields that may contain the actual usable output or structured result.
- The current raw capture stores the **transformed completion**, not the full raw OpenRouter response body, so the exact extraction failure point is still invisible.

---

## Recommended next fix

### Immediate next fix for ee-5dv

**Instrument the OpenRouter adapter / recommendation lane to capture the full raw provider response before `transformResponse()` and before content extraction, then rerun the Phase 3-only path.**

Concretely:
1. In `node_modules/ai-providers/providers/openrouter.cjs` (or a repo-owned shim if preferred), capture the raw `response.data` for recommendation attempts when debug/raw capture is enabled.
2. Persist that raw response beside the existing recommendation attempt capture.
3. Compare:
   - raw OpenRouter JSON
   - extracted `message.content`
   - reported usage
4. Verify whether Gemini preview is returning text in:
   - a different content field
   - structured parts the extractor is skipping
   - tool-call / reasoning / provider-native fields not currently merged into `content`
   - or whether OpenRouter itself is surfacing only a fragment

### Secondary mitigation if a quick unblock is needed

If Derrick wants the fastest path to green rather than adapter forensics:
- switch the recommendation target away from `openrouter/google/gemini-3.1-pro-preview`, or
- bypass OpenRouter for a native provider path whose response shape is already known/stable for JSON generation.

But the evidence here says the **next engineering fix** should be response-capture instrumentation first, because otherwise we are debugging blind.

---

## Follow-up notes for parent bug `ee-5dv`

- The surrogate experiment does **not** support “rewrite the prompt again” as the primary next move.
- The current prompt/protocol is imperfect but understandable.
- The validator loop’s real blocker is upstream of validation: the validator never runs because the saved completion is already mangled/truncated.
- Best next bead candidate:
  - capture full raw OpenRouter/Gemini preview response payload for recommendation attempts and reconcile it against `usage.output` vs extracted `content`.

---

## Final result

**Status:** ✅ Complete

### Conclusion

The dominant failure mode is **provider truncation / transport / response extraction mismatch**.

Prompt ambiguity and envelope complexity exist as secondary issues, but they do **not** explain:
- canonical tool-call starts on attempts 1/2,
- a mid-sentence fragment on attempt 3,
- and `usage.output=896` paired with only ~118–132 captured characters.

### Recommended next action

Capture and persist the **full raw OpenRouter response body** for recommendation attempts before transformation/extraction, then rerun the Phase 3-only recommendation step. That is the highest-value next fix for `ee-5dv`.

---

*Completed on 2026-03-13*
