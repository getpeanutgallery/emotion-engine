# emotion-engine: harden validator tool-call envelope + rerun live Phase3

**Date:** 2026-03-12  
**Status:** Complete  
**Agent:** Cookie 🍪

---

## Goal

Fix the current live failure mode in the new Option A recommendation flow:

- the model is attempting the validator tool loop,
- but its **first tool-call envelope is returning as truncated / malformed JSON**,
- so the validator never gets invoked.

This plan hardens that first tool-call exchange, gives the live Phase3 lane enough retry room, and reruns the Phase3-only workflow before touching full `cod-test`.

---

## What we learned from the last live run

### Confirmed good news
- The live model **did** attempt the validator-mediated flow.
- `promptMode: "tool_loop"` confirms the new architecture is active.
- The raw output began as a `validate_recommendation_json` tool call.

### Current failure mode
- The tool-call envelope itself came back as malformed/truncated JSON.
- Because the envelope could not be parsed, the tool was never executed.
- Observed from artifacts:
  - `validatorCalls: 0`
  - `turn: 1`
  - parse error: unterminated string in the tool-call JSON

### Implication
The next priority is **not** recommendation content quality yet.
It is **transport robustness for the tool-call envelope itself**.

---

## Desired outcome

After this plan:
- the tool-call envelope is smaller, stricter, and easier for the model to emit correctly
- malformed first tool-call envelopes can be recovered from more gracefully
- Phase3-only has enough retry budget to actually exercise recovery live
- we can prove one of these outcomes honestly:
  - tool call succeeds and validator is reached
  - tool call fails again but with stronger evidence about the remaining weak point

---

## Execution strategy

### Task 1: Simplify and harden the tool-call envelope format

**SubAgent:** `main`  
**Files/folders touched:**
- `server/lib/recommendation-validator-tool.cjs`
- `server/scripts/report/recommendation.cjs`
- related tests

**Status:** Pending

**Changes to make:**
- minimize the expected tool-call envelope shape
- prefer a very small canonical form, e.g. something like:
  ```json
  {
    "toolName": "validate_recommendation_json",
    "arguments": {
      "recommendation": { ... }
    }
  }
  ```
  or an even tighter equivalent if the current parser can be simplified further
- remove unnecessary optional wrapper variants from the model-facing protocol if they increase ambiguity
- tighten the system/prompt instructions so the model knows the exact first-step shape to emit
- keep acceptance strict on the engine side, but keep the model-facing protocol minimal

**Acceptance criteria:**
- one canonical model-facing tool-call format exists
- docs/prompt/examples do not encourage multiple equivalent shapes
- tests cover the exact envelope we want live models to produce

---

### Task 2: Add malformed-envelope recovery path

**SubAgent:** `main`  
**Files/folders touched:**
- `server/scripts/report/recommendation.cjs`
- possibly helper parsing utilities under `server/lib/`
- tests

**Status:** Pending

**Changes to make:**
- when the first assistant turn looks like a tool-call attempt but fails to parse cleanly:
  - classify it as a **tool-envelope parse failure** instead of a generic recommendation failure
  - feed a very compact correction request back to the model on the next turn
- example repair instruction:
  - “Your validator tool call was invalid JSON. Return only a valid tool-call envelope in the exact required shape.”
- if feasible, salvage obvious near-miss cases using existing JSON extraction helpers without broadening ambiguity too much

**Acceptance criteria:**
- malformed tool-call envelopes get a dedicated recovery path
- raw captures clearly distinguish:
  - malformed tool-call envelope
  - validator rejection
  - final artifact rejection

---

### Task 3: Increase Phase3-only live retry budget

**SubAgent:** `main`  
**Files/folders touched:**
- `configs/cod-test-phase3.yaml`

**Status:** Pending

**Changes to make:**
- raise `ai.recommendation.retry.maxAttempts` above `1`
- enough to allow:
  - one malformed initial tool call
  - one repair attempt
  - optionally one extra recovery attempt
- likely target: `3`

**Acceptance criteria:**
- live Phase3-only config can actually exercise recovery behavior
- the lane is no longer single-shot when the first tool-call envelope is malformed

---

### Task 4: Add tests for malformed tool-call envelope recovery

**SubAgent:** `main`  
**Files/folders touched:**
- `test/scripts/recommendation.test.js`
- any new helper tests as needed

**Status:** Pending

**Add test coverage for:**
- malformed/truncated tool-call envelope on first turn
- repair prompt requesting corrected tool envelope
- successful second-turn valid tool call
- validator execution after repaired tool call
- bounded failure if the model keeps emitting broken envelopes

**Acceptance criteria:**
- local tests prove the new recovery path works before we spend on live retries

---

### Task 5: Rerun live Phase3-only validation

**SubAgent:** `main`  
**Files/folders touched:**
- runtime outputs under `output/cod-test/`

**Status:** Pending

**Command target:**
```bash
node server/run-pipeline.cjs --config configs/cod-test-phase3.yaml --verbose
```

**Capture and report:**
- exit code
- provider/model used
- whether a validator tool call was successfully parsed
- whether validator was actually invoked
- number of turns / validatorCalls
- whether recovery/retry occurred
- final success/failure
- artifact paths for tool-loop trace
- whether full `cod-test` is safe next

**Acceptance criteria:**
- we can prove the live system got farther than the previous failure mode
- ideally: validator is actually invoked live
- best case: Phase3 recommendation completes successfully

---

## Ordering

Run in this order:
1. simplify envelope
2. add malformed-envelope recovery
3. increase retry budget
4. run tests
5. rerun live Phase3-only

Do **not** run full `cod-test` until this lane is green.

---

## Risks / watchouts

- Simplifying the envelope too much may reduce flexibility later
  - acceptable for now; live reliability matters more than envelope elegance
- More retries increase cost slightly
  - acceptable because we are testing the exact recovery mechanism we need
- Provider may still return truncated JSON repeatedly
  - if so, that becomes strong evidence the chosen recommendation model is a poor fit for strict tool-discipline tasks

---

## Success criteria

This plan succeeds if we can honestly say:
- the validator tool loop is still active,
- the model can now emit a valid tool-call envelope often enough to invoke the validator live,
- and Phase3-only either succeeds or fails at a more advanced, better-instrumented point.

The specific minimum bar for progress is:
- **validatorCalls > 0** in a live Phase3-only run.

---

## Execution tasks

### Task 1: Simplify envelope + add malformed-envelope recovery

**Bead ID:** `ee-n51`  
**SubAgent:** `main`  
**Status:** Complete

**Target result:**
- one canonical minimal tool-call envelope
- malformed tool-call attempts get a dedicated repair path
- raw captures distinguish envelope parse failure from validator rejection

### Task 2: Raise retry budget + add tests

**Bead ID:** `ee-n51`  
**SubAgent:** `main`  
**Status:** Complete

**Target result:**
- Phase3-only config allows live recovery attempts
- local tests cover malformed envelope recovery and bounded failure

### Task 3: Rerun live Phase3-only

**Bead ID:** `ee-5dv`  
**SubAgent:** `main`  
**Status:** Complete

**Target result:**
- validatorCalls > 0 in a live run
- decide whether full `cod-test` is safe next
