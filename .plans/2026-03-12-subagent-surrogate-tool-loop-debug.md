# emotion-engine: debug Phase3 validator tool loop using a subagent surrogate

**Date:** 2026-03-12  
**Status:** Draft  
**Agent:** Cookie 🍪

---

## Goal

Use an OpenClaw subagent as a surrogate for the Phase 3 recommendation model so we can inspect how the tool-loop prompt is being interpreted and where the response goes wrong.

This is a diagnostic lane, not a final production fix.

---

## Why this test is useful

The live provider/model (`openrouter / google/gemini-3.1-pro-preview`) keeps failing before validator invocation, even after:
- canonical envelope simplification
- malformed-envelope recovery
- retry budget increase

A subagent test gives us a more observable environment where we can inspect:
- whether the prompt is confusing
- whether the tool-call envelope is awkward to produce
- whether the model tries to comply but chooses the wrong shape
- whether the tool-loop instructions are over-constraining or under-specifying behavior

---

## Experiment design

### Task 1: Extract the effective recommendation/tool-loop prompt shape

**SubAgent:** `main` or direct inspection  
**Status:** Pending

**What to inspect:**
- current `server/scripts/report/recommendation.cjs`
- latest prompt artifact from Phase3-only run
- tool-call instructions and canonical envelope example

**Target result:**
- we know exactly what prompt/instructions the live model is seeing
- we can reuse that prompt shape for the surrogate experiment

---

### Task 2: Run a subagent through the same recommendation/tool-loop task

**SubAgent:** `main`  
**Status:** Pending

**Execution idea:**
- spawn a subagent with the same recommendation task and same canonical tool-call rules
- provide it the same or equivalent input payload used by Phase 3
- require it to either:
  - emit the validator tool-call envelope, or
  - explain why it cannot
- inspect whether it naturally:
  - emits malformed JSON
  - uses the wrong tool envelope shape
  - tries to skip the tool and jump straight to final JSON

**Target result:**
- collect the subagent’s actual attempted outputs and reasoning path
- identify prompt/protocol friction more directly than with the opaque live provider output

---

### Task 3: Compare subagent behavior vs live provider artifacts

**SubAgent:** `main` or direct inspection  
**Status:** Pending

**Compare:**
- subagent first response
- live provider first response from `attempt-01/02/03` captures
- envelope shape correctness
- failure mode category

**Target result:**
- clear hypothesis about whether the issue is:
  - provider truncation/output transport
  - prompt ambiguity
  - envelope complexity
  - model tendency to answer in prose instead of machine JSON

---

### Task 4: Produce next-fix recommendation

**SubAgent:** `main` or direct inspection  
**Status:** Pending

**Output should recommend one of:**
- keep tool-loop design but switch provider/model
- keep provider but simplify prompt/protocol further
- abandon tool-envelope-first for this provider and use a different control loop
- split tool call and final artifact into separate forced stages

---

## Constraints

- This is a debugging experiment only.
- Do not treat subagent success as proof that the live provider will succeed.
- Use the experiment to isolate *where* the current live path is breaking.
- Do not run full `cod-test` as part of this lane.

---

## Success criteria

This experiment succeeds if it tells us something actionable about the failure mode.

Minimum useful outcome:
- we can point to a specific mismatch between the tool-loop prompt/protocol and actual model behavior.

Best outcome:
- we identify an obvious next fix or provider-selection change with evidence.

---

## Next question for Derrick

**Is this plan ready to execute?**
