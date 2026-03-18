---
plan_id: plan-2026-03-12-prioritize-phase3-json-validation-and-grounding
bead_ids:
  - ee-kyk
  - ee-5dv
---
# emotion-engine: prioritize Phase 3 JSON validation + grounding work

**Date:** 2026-03-12  
**Status:** Draft  
**Agent:** Cookie 🍪

---

## Goal

Compare the current canonical plan and open Beads for `emotion-engine`, then rank the next execution lane around the recent Phase 3 recommendation JSON reliability work.

---

## Inputs reviewed

### Canonical plan
- `2026-03-12-reconstruct-cod-test-state-and-next-step.md`

### Open Beads reviewed
- `ee-5dv` — recommendation invalid JSON failure
- `ee-2fs` — audit recommendation input payload / grounding provenance
- `ee-1er` — align OpenRouter + cross-provider debug capture
- `ee-9or` — categorize recent run error responses
- `ee-03m` — expose FFmpeg settings via YAML
- `ee-0gv` — investigate run-root `raw/` folder structure

### Code reality checked
- `server/scripts/report/recommendation.cjs`

---

## Current state summary

### What is already true

- Recommendation parsing is no longer naïve string-to-JSON only.
- `recommendation.cjs` now attempts recovery from:
  - fenced JSON
  - balanced object extraction
  - light normalization (BOM/code-fence/trailing comma cleanup)
- Unit tests for recommendation parsing are passing.
- The canonical repo plan correctly says the next lane is **live validation**.

### What is still missing

The script still does **post-hoc repair**, not **pre-submit self-check** by the model.

Current prompt asks for valid JSON only, but does **not** require the model to:
- validate its own object before finalizing,
- return evidence/provenance for claims,
- or use a stricter output contract that makes malformed / weakly grounded output easier to reject.

So the malformed-JSON risk is reduced, but not eliminated. The grounding/hallucination risk is even less solved than the syntax risk.

---

## Priority ranking

### 1) `ee-5dv` — live validate the repaired recommendation path
**Priority:** Highest / execute first

Why:
- This is the narrowest proof step.
- It tells us whether the current parser hardening is already sufficient against real provider output.
- It unlocks truth: either close the bead, or collect fresh failure artifacts.

Decision:
- Keep as top execution lane.
- Validate with Phase3-only first, then full `cod-test` if green.

---

### 2) `ee-2fs` — add recommendation input dump + grounding/evidence path
**Priority:** Highest design follow-up, likely next implementation even if `ee-5dv` passes

Why:
- This is the bead that matches Derrick’s concern most directly.
- If the model is forced to output structured JSON, the next failure mode is not just malformed syntax — it is **confident but weakly grounded JSON**.
- We need the exact input object preserved and a schema that makes the model show its work.

Recommended expansion of this bead:
- persist exact `{ pipelineMeta, metricsSummary, chunkSummaries }` as raw artifact
- extend output schema with evidence/provenance, e.g.:
  - `evidence[]`
  - each item references chunk index, time range, or metric path
- add a validation pass that rejects output when required evidence is missing or malformed
- optionally add a retry prompt that says: “Your previous response failed validation; fix only the JSON object.”

This is the bead that should become the main Phase 3 quality lane.

---

### 3) `ee-1er` — persist better provider/debug metadata
**Priority:** High, but after the two recommendation-focused items

Why:
- If live validation still fails, this bead increases our ability to understand *why*.
- It improves errorStatus / requestId / structured provider error capture.
- It supports future provider work and makes retry/failover debugging much less squishy.

Best order:
- do this immediately after `ee-5dv` if the live run still fails in a provider-specific way.
- otherwise do it after grounding/provenance improvements.

---

### 4) `ee-9or` — run-level taxonomy/report over recent failures
**Priority:** Medium

Why:
- Useful once we have enough fresh failures or noisy runs to analyze.
- Less important than directly fixing the known Phase 3 recommendation lane.
- Better as a multiplier after capture quality improves.

---

### 5) `ee-03m` — FFmpeg YAML canon
**Priority:** Medium-low for current goal

Why:
- Good architecture cleanup.
- Not on the critical path for the current Phase 3 recommendation reliability problem.

---

### 6) `ee-0gv` — run-root raw folder naming/layout
**Priority:** Low for now

Why:
- Important cleanup, but mostly a naming/structure decision.
- It does not unblock recommendation correctness or validation.

---

## Recommended execution order

1. **Validate** current fix:
   - `ee-5dv` Phase3-only live run
   - if green, full `cod-test`
2. **Strengthen “show your work” contract** in recommendation output:
   - expand `ee-2fs`
   - dump exact input object
   - add evidence fields to response schema
   - add programmatic validation + retry-on-invalid
3. **Improve provider/debug observability** if failures remain unclear:
   - `ee-1er`
4. **Only then** broader analytics / cleanup:
   - `ee-9or`
   - `ee-03m`
   - `ee-0gv`

---

## Concrete design recommendation for Derrick’s concern

To reduce malformed JSON and weak self-checking, the next implementation should add a **local JSON validation tool + validator loop** around recommendation output.

The important distinction:
- the **AI can use** the validator during the generation/repair loop,
- but the **engine owns** the final decision.

That gives us the local-first behavior we need now, while keeping the design portable to AWS later.

### Local-first / AWS-ready architecture

Build this as a small pure-JS validator module inside `emotion-engine`, not as an interactive local-only shell hack.

Recommended shape:
- `server/lib/json-validator.cjs`
- optional recommendation-specific wrapper:
  - `server/lib/recommendation-validator.cjs`

Why this shape:
- works locally in Node with no special machine assumptions
- can run unchanged later inside Lambda, ECS, EC2, or a container task
- avoids coupling validation logic to desktop-only process behavior
- keeps the validator callable from tests, scripts, and future API/server handlers

### Proposed responsibilities

#### 1) Generic JSON validator utility
Input:
- raw model text
- schema / validation rules
- optional grounding context

Output:
```json
{
  "ok": true,
  "parsed": {"...": "..."},
  "errors": []
}
```

or

```json
{
  "ok": false,
  "parsed": null,
  "errors": [
    {
      "code": "invalid_type",
      "path": "confidence",
      "message": "confidence must be a number between 0 and 1"
    }
  ]
}
```

#### 2) Recommendation-specific validation
Validate:
- parseability
- object shape
- required fields
- bounds / types
- evidence references against known input chunks + metrics

#### 3) Repair loop contract
If validation fails, the pipeline retries with a compact machine-readable validation report, e.g.:
- “Your previous response failed validation.”
- “Return ONLY corrected JSON.”
- include only the minimal error list

This is much stronger than hoping the model self-checks without feedback.

### Proposed contract
The model returns:
```json
{
  "text": "...",
  "reasoning": "...",
  "confidence": 0.72,
  "keyFindings": ["..."],
  "suggestions": ["..."],
  "evidence": [
    {
      "kind": "chunk",
      "chunkIndex": 3,
      "startTime": 24,
      "endTime": 32,
      "field": "summary",
      "quote": "..."
    },
    {
      "kind": "metric",
      "path": "metricsSummary.frictionIndex",
      "value": 0.42
    }
  ]
}
```

### Validation stages
1. **Parse validation**
   - valid JSON object only
2. **Schema validation**
   - required fields exist
   - arrays are arrays of strings/objects
   - numbers are within range
3. **Grounding validation**
   - every `evidence` reference points to a real metric path or chunk
   - no chunk/time reference outside the input set
4. **Retry loop on failure**
   - send compact validation errors back to the same target or next target
   - ask for corrected JSON only

### Local-first implementation details

Recommended first version:
- implement with plain JavaScript validation logic inside the repo
- keep the validation result shape stable
- add unit tests around malformed JSON, wrong types, missing keys, and bad evidence references

Optional next step:
- add JSON Schema compatibility later if we want external tooling or API-level schema reuse
- but do not block local implementation on picking a schema framework today

This keeps the first version lightweight and easy to ship.

### AWS readiness requirements

Design constraints so we do not repaint later:
- no shell-only validator dependency
- no dependence on local file paths in the core validator API
- validator accepts plain JS objects / strings and returns plain JS objects
- grounding context passed as data, not hidden process state
- deterministic error codes/messages where possible for server logs and retries

That way the same validator can later run:
- inside the existing local Node pipeline
- inside an HTTP service
- inside a queue worker / batch job on AWS

### Why this is better than prompt-only instructions
Because the model cannot be trusted to reliably self-certify. The engine should be the final validator, and the validator should be reusable wherever the pipeline runs.

---

## Execution tasks

### Task 1: Implement local validator + repair loop

**Bead ID:** `ee-kyk`  
**SubAgent:** `main`  
**Files/folders touched:**
- `server/lib/`
- `server/scripts/report/recommendation.cjs`
- `test/scripts/recommendation.test.js`
- optional new validator tests/helpers

**Status:** In progress

**Target result:**
- reusable pure-JS validator module exists
- recommendation flow validates output before acceptance
- repair/retry loop uses validation errors as feedback
- tests cover malformed JSON and schema failures

### Task 2: Verify locally

**Bead ID:** `ee-kyk`  
**SubAgent:** `main` or direct verification  
**Status:** Complete

**Target result:**
- targeted tests pass locally
- we have a clear summary of files changed and what remains before live Phase3 validation

**Actual result:**
- targeted validator + recommendation tests passed locally (`12 passed, 0 failed`)
- validator/repair loop is ready for live Phase3 validation

### Task 3: Run live Phase3-only validation

**Bead ID:** `ee-5dv`  
**SubAgent:** `main`  
**Status:** In progress

**Target result:**
- run `configs/cod-test-phase3.yaml` against live provider output
- confirm whether repaired recommendation path succeeds in practice
- inspect raw captures and recommendation output if it fails
- decide whether full `cod-test` is safe next

---

## Outcome

Current recommendation:
- **Top priority remains `ee-5dv` live validation**.
- **Execution starts with a local validator implementation that strengthens `ee-2fs` and improves the odds that `ee-5dv` passes when we run it live.**

That gives us the fastest path to a recommendation system that is both syntactically reliable and easier to trust.
