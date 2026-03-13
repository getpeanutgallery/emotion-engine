# emotion-engine: make recommendation prompt validator-aware + rerun live Phase3

**Date:** 2026-03-12  
**Status:** Draft  
**Agent:** Cookie 🍪

---

## Goal

Strengthen the Phase 3 recommendation lane so the model is explicitly told about the strict validation gate, then rerun the live Phase3-only workflow with enough retry attempts to prove the repair loop works against real provider output.

---

## Why this plan exists

We now have a local validator + repair loop in code, but the last live Phase3-only run still failed because:

1. the model was not strongly framed around the validator contract in the **base prompt**
2. the Phase3 config only allowed **one attempt**, so the repair loop never actually got a live retry

That means we have only partially validated the new architecture.

---

## Desired outcome

After this plan:
- the recommendation prompt explicitly tells the model that a strict validator will check the response
- the base prompt lists the exact field constraints in validator terms
- the Phase3-only config allows enough retry attempts to exercise repair
- a live Phase3-only run proves one of two things:
  - success path: malformed/weak output is corrected on retry and final recommendation succeeds, or
  - failure path: we get better, more truthful evidence about what still breaks

---

## Execution strategy

### Task 1: Make the base recommendation prompt explicitly validator-aware

**SubAgent:** `main`  
**Files/folders touched:**
- `server/scripts/report/recommendation.cjs`
- optional validator helper if prompt text is centralized

**Status:** Pending

**Changes to make:**
- update the base recommendation prompt so it clearly states:
  - output is checked by a strict JSON validator
  - only the final validator-compliant JSON should be returned
  - field rules are strict, not advisory
- tighten the rules section to mirror the actual validator contract:
  - `text` → non-empty string
  - `reasoning` → non-empty string
  - `confidence` → finite number between `0` and `1`
  - `keyFindings` → array of one or more non-empty strings
  - `suggestions` → array of one or more non-empty strings
- keep wording provider-friendly: concise, direct, no giant wall of procedural text

**Acceptance criteria:**
- prompt text explicitly references the validator gate
- prompt constraints match actual code-level validator behavior closely enough that the model is not guessing the acceptance rules

---

### Task 2: Raise Phase3-only recommendation retry count so repair can run live

**SubAgent:** `main`  
**Files/folders touched:**
- `configs/cod-test-phase3.yaml`
- possibly docs/comments if needed

**Status:** Pending

**Changes to make:**
- update `ai.recommendation.retry.maxAttempts` from `1` to at least `2` (prefer `3`)
- keep backoff reasonable for live testing
- do not broaden scope to full cod-test config yet unless Phase3 proves green

**Acceptance criteria:**
- Phase3-only config gives the repair loop at least one live retry after a failed base response

---

### Task 3: Add/adjust tests for validator-aware prompting if needed

**SubAgent:** `main`  
**Files/folders touched:**
- `test/scripts/recommendation.test.js`

**Status:** Pending

**Changes to make:**
- add/update assertions for prompt/repair behavior only if the current tests do not already cover enough of it
- avoid over-testing exact prose unless necessary; prefer testing for required validator-aware language and repair-loop behavior

**Acceptance criteria:**
- test coverage protects the prompt/repair behavior we now depend on

---

### Task 4: Run live Phase3-only validation again

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
- whether retry/repair occurred
- whether final recommendation succeeded
- artifact paths for attempts and prompt captures
- whether full `cod-test` is safe next

**Acceptance criteria:**
- we can prove the live repair loop either worked or failed with clear artifacts
- recommendation result is no longer judged solely from first-attempt behavior

---

## Priority and sequencing

Run in this order:
1. prompt update
2. config retry update
3. tests
4. live Phase3-only run

Do **not** jump to full `cod-test` until Phase3-only is green.

---

## Risks / watchouts

- Too much validator text in the base prompt may bloat or distract the model
  - mitigate by keeping the validator language short and concrete
- Increasing retries may increase spend slightly
  - acceptable here because this is the exact feature we are trying to validate
- A provider may still return broken JSON repeatedly
  - if so, that becomes strong evidence for provider/model selection changes rather than parser weakness alone

---

## Success criteria for closing the lane

We can consider the immediate lane healthy when:
- live Phase3-only succeeds with the updated local code/config, and
- we have evidence that either:
  - first-pass output was valid, or
  - repair retry corrected an invalid first pass successfully

At that point, full `cod-test` becomes the next sensible validation step.

---

## Next question for Derrick

**Is this plan ready to execute?**
