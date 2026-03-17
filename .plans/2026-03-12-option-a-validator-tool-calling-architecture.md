---
plan_id: plan-2026-03-12-option-a-validator-tool-calling-architecture
bead_ids:
  - ee-7kn
  - ee-5dv
---
# emotion-engine: Option A — true validator tool-calling architecture for Phase 3 recommendation

**Date:** 2026-03-12  
**Status:** Complete  
**Agent:** Cookie 🍪

---

## Goal

Adopt **Option A** as the target solution for Phase 3 recommendations:

> the model should be able to use a real validator tool during generation, validate its JSON artifact before final submission, and only turn in the final artifact after it passes.

This plan is **local-first** but intentionally shaped so the same architecture can run later on AWS.

---

## Why we are choosing this path

The current completion-based loop is still fundamentally:
- model returns text
- engine validates afterward
- engine retries if needed

That is better than nothing, but it is still a **post-submit gate**.

What we want instead is:
- model drafts JSON
- model calls validator tool
- tool returns pass/fail + structured errors
- model revises
- model submits only the validated artifact

This is the cleanest way to make the model actually “check its work” instead of merely being warned that validation exists.

---

## Target architecture

### Core interaction model

The recommendation lane becomes a small tool-using agent workflow:

1. system provides recommendation task + schema + grounding input
2. model drafts candidate JSON
3. model calls `validate_recommendation_json`
4. local validator runs and returns structured result
5. model revises as needed
6. when validator returns `ok: true`, model emits final JSON artifact
7. engine persists the final artifact and the tool-call trace

---

## Proposed tool contract

### Tool name
- `validate_recommendation_json`

### Tool input
```json
{
  "candidate": {"text": "..."}
}
```

### Tool output (success)
```json
{
  "ok": true,
  "errors": [],
  "normalized": {
    "text": "...",
    "reasoning": "...",
    "confidence": 0.72,
    "keyFindings": ["..."],
    "suggestions": ["..."]
  }
}
```

### Tool output (failure)
```json
{
  "ok": false,
  "errors": [
    {
      "path": "$.confidence",
      "code": "out_of_range",
      "message": "confidence must be between 0 and 1"
    }
  ]
}
```

### Notes
- tool returns plain JSON only
- deterministic-ish error codes/messages where possible
- no local path assumptions in the core API
- future-friendly for HTTP/service wrapping on AWS

---

## Local-first implementation approach

### Task 1: Introduce a recommendation tool-loop orchestrator

**SubAgent:** `main`  
**Files/folders touched:**
- `server/scripts/report/recommendation.cjs`
- possibly new helper(s) under `server/lib/`

**Status:** Pending

**What changes:**
- replace the current single-shot completion mindset with a multi-turn orchestration loop
- the loop should support:
  - assistant draft
  - tool call request
  - tool execution
  - tool result return
  - assistant final artifact
- keep the loop bounded by max turns / max tool calls to avoid runaway behavior

**Acceptance criteria:**
- recommendation execution can progress through multiple turns in one run
- the model can receive validator output before the final artifact is accepted

---

### Task 2: Expose the existing validator as a real tool contract

**SubAgent:** `main`  
**Files/folders touched:**
- `server/lib/recommendation-validator.cjs`
- optional wrapper file such as `server/lib/recommendation-validator-tool.cjs`

**Status:** Pending

**What changes:**
- wrap current validator logic behind a tool-style interface
- accept a candidate object/string
- return structured pass/fail JSON
- preserve normalized output when valid

**Acceptance criteria:**
- tool contract is stable and directly callable from local orchestration code
- validator remains reusable outside the tool flow as a plain library

---

### Task 3: Decide how the model expresses tool calls locally

**SubAgent:** `main`  
**Files/folders touched:**
- `server/scripts/report/recommendation.cjs`
- maybe provider abstraction files if needed

**Status:** Pending

**Implementation options to choose between:**

#### Option A1 — provider-native tool calling
Use native function/tool calling if the selected adapter/provider supports it reliably.

**Pros:**
- closest to real tool use
- elegant if provider support is solid

**Cons:**
- depends on provider abstraction support in `ai-providers`
- likely uneven across target models/providers

#### Option A2 — local structured tool protocol over text
Use a controlled text protocol in which the model is instructed to emit either:
- a tool call envelope, or
- final JSON

For example:
```json
{
  "tool": "validate_recommendation_json",
  "arguments": {
    "candidate": { ... }
  }
}
```

The engine interprets this as a tool call, executes it, and returns the tool result for the next round.

**Pros:**
- works immediately with current completion-style providers
- still gives the model real validator interaction
- local-first and AWS-friendly

**Cons:**
- simulated protocol rather than provider-native tool API
- requires robust parsing/guardrails for tool-call envelopes

**Recommended starting choice:**
- **A2 first**, unless `ai-providers` already has dependable tool-calling support for the chosen recommendation models.

This still counts as Option A in the architectural sense because the model is genuinely participating in a tool loop, not just being warned.

**Acceptance criteria:**
- chosen tool-call expression format is documented and implemented
- engine can distinguish tool calls from final artifacts safely

---

### Task 4: Persist tool-loop artifacts for observability

**SubAgent:** `main`  
**Files/folders touched:**
- recommendation raw capture output paths
- possibly `events-timeline` usage in recommendation lane

**Status:** Pending

**Persist at minimum:**
- assistant draft attempts
- tool call payload(s)
- tool result(s)
- final accepted artifact
- turn count / tool call count
- model/provider metadata

**Acceptance criteria:**
- when the lane fails, we can tell whether the failure was:
  - bad draft
  - bad tool call shape
  - validator rejection
  - provider/model failure
  - max-turn exhaustion

---

### Task 5: Add bounded execution policy

**SubAgent:** `main`  
**Files/folders touched:**
- config / recommendation execution logic

**Status:** Pending

**Bounds to add:**
- max conversation turns
- max validator tool calls
- max repair loops
- clear terminal errors when bounds are exceeded

**Acceptance criteria:**
- tool loop cannot spin forever
- failures are explicit and debuggable

---

### Task 6: Add tests for the tool-using flow

**SubAgent:** `main`  
**Files/folders touched:**
- `test/scripts/recommendation.test.js`
- new tests if needed

**Status:** Pending

**Test cases:**
- model emits valid final JSON immediately
- model emits invalid draft, calls validator, repairs successfully
- model emits malformed tool call envelope
- model ignores tool result / keeps failing validation until bounds exceeded
- final accepted artifact is validator-compliant

**Acceptance criteria:**
- local tests prove the tool loop works without live provider dependence

---

### Task 7: Run Phase3-only live validation on the tool-loop implementation

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
- whether the model used the validator tool
- number of tool calls / turns
- provider/model used
- whether final artifact passed validator and completed
- artifact paths for tool call trace
- whether full `cod-test` is safe next

**Acceptance criteria:**
- we can prove the live model actually participated in a validator-mediated loop
- recommendation succeeds, or fails with clear tool-loop evidence

---

## AWS compatibility notes

This plan is intended to port cleanly later.

### Keep these interfaces stable
- validator input/output is plain JSON
- tool-call envelope is plain JSON
- orchestration state is serializable
- no reliance on local-only shell/TTY behavior

### Easy AWS landing zones later
- Lambda: validator as library or service handler
- ECS/EC2: recommendation worker with tool-loop orchestration
- S3: raw captures / artifacts
- CloudWatch / tracing: turn-by-turn logs

The local implementation should behave like a small single-process version of the future online architecture.

---

## Non-goals for this step

To keep scope sane, this plan does **not** require yet:
- generalized multi-tool agenting for every phase
- provider-wide native tool-calling support across the whole polyrepo
- immediate migration of all recommendation providers/models to one tool-native API

We only need a robust local tool-mediated loop for the Phase 3 recommendation lane first.

---

## Recommended sequence

1. implement local tool-loop protocol
2. wrap validator as tool
3. add persistence + bounds
4. test locally
5. run live Phase3-only
6. only then consider full `cod-test`

---

## Risks / watchouts

- provider may ignore structured tool-call instructions
  - mitigate with a strict local envelope protocol and bounded retries
- tool-call envelope parsing becomes a new failure mode
  - mitigate with explicit tests and narrow accepted shapes
- the chosen recommendation model may be poor at tool discipline
  - if so, that becomes strong evidence to change recommendation provider/model selection

---

## Success criteria

We can call this plan successful when:
- the recommendation lane uses a real validator tool loop locally
- the model can validate and revise before final acceptance
- the final artifact is validator-compliant by construction
- live Phase3-only run proves the tool-mediated flow works in practice

---

## Execution tasks

### Task 1: Implement local tool-loop orchestrator + validator tool contract

**Bead ID:** `ee-7kn`  
**SubAgent:** `main`  
**Status:** Complete

**Target result:**
- recommendation lane supports a real validator-mediated loop
- model can emit tool call envelope(s) and receive validator result(s)
- final recommendation artifact is accepted only after validator success

### Task 2: Add persistence, bounds, and local tests

**Bead ID:** `ee-7kn`  
**SubAgent:** `main`  
**Status:** Complete

**Target result:**
- tool call traces are persisted
- max turns / max tool calls are enforced
- local tests cover successful tool use and failure modes

### Task 3: Run live Phase3-only validation

**Bead ID:** `ee-5dv`  
**SubAgent:** `main`  
**Status:** Complete

**Target result:**
- prove the live model actually participates in a validator-mediated loop
- decide whether full `cod-test` is safe next
