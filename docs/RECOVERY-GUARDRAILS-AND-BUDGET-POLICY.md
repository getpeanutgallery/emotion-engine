# Recovery guardrails and budget policy

**Status:** Active global architecture policy  
**Established:** 2026-03-14

---

## Purpose

This document defines the **strict global guardrails** for deterministic recovery and AI recovery in `emotion-engine`.

It complements and constrains:

- `docs/UNIVERSAL-SCRIPT-RESULT-CONTRACT.md`
- `docs/DETERMINISTIC-RECOVERY-FRAMEWORK.md`
- `docs/AI-RECOVERY-LANE-CONTRACT.md`
- `docs/ROLLOUT-FAMILIES-AND-SIBLING-IMPACT.md`

Those docs define the envelope shapes, recovery layers, and rollout scope. This doc defines the **non-negotiable global policy** for:

- retry ceilings and counter semantics
- token / time / cost ceilings
- loop-prevention and lineage rules
- mandatory raw/debug capture
- human-review vs hard-fail boundaries
- stop conditions for repeated internal / config / dependency failures
- when degraded success is acceptable vs when failure is mandatory
- default safe settings vs optional per-lane overrides

The intent is to make recovery behavior:

- bounded
- auditable
- comparable across lanes
- safe to reason about after the fact
- impossible to stretch into open-ended autonomous retry behavior

---

## Global policy principles

1. **Failure envelopes are mandatory before recovery.**  
   No deterministic or AI recovery policy may run from thrown errors, ad hoc logs, or inferred control flow alone.

2. **Deterministic recovery always goes first.**  
   AI recovery is a fallback layer, never the default first reaction.

3. **Every recovery attempt consumes an explicit counter.**  
   Hidden helper-level retries may exist for transport mechanics, but declared recovery policy must expose bounded, durable counters.

4. **Lineage is never reset mid-failure.**  
   Re-entry, failover, and AI recovery all remain attached to the same failure lineage until that lineage resolves or terminates.

5. **Missing observability is itself a policy failure.**  
   If the system cannot explain why recovery was attempted or why it stopped, the run is out of contract.

6. **Degraded success is allowed only when downstream continuation is explicitly safe.**  
   “Some output exists” is not enough.

7. **Repeated internal, config, or dependency failures must stop quickly.**  
   Recovery is for bounded repair, not for masking broken code, broken configuration, or broken prerequisites.

---

## Mandatory lineage model

Every hard failure that enters recovery must carry a stable lineage record durable enough to audit from artifacts alone.

### Required lineage identity

At minimum, each failure lineage must retain:

- `failureId`
- `phase`
- `script`
- `scriptRunAttempt`
- `deterministicAttemptsUsed`
- `aiRecoveryAttemptsUsed`
- `reentryAttemptNumber`
- `parentFailureId` when a later aggregation layer wraps a child failure

### Lineage rules

1. A lineage begins when a script emits a universal failure envelope.
2. The lineage remains the same across:
   - deterministic retry
   - deterministic repair
   - target failover
   - AI recovery
   - one bounded same-script re-entry
3. A successful re-entry closes the lineage.
4. A new top-level script invocation may create a new lineage, but **must not** silently inherit a partially consumed budget unless explicitly declared by the pipeline wrapper.
5. No component may reset `attemptsUsed` counters by constructing a new envelope without linking back to the original lineage.

### Loop-prevention rule

The system must be able to prove from the lineage artifact chain that a failure did **not** cycle through:

- deterministic recovery repeatedly with the same effective inputs
- AI recovery more times than allowed
- AI recovery → same-script re-entry → AI recovery again without explicit remaining budget and a durable new failure artifact

If the artifact chain cannot prove that, the run is out of contract and must stop.

---

## Counter semantics

The architecture uses four counter families. They must not be conflated.

### 1) Script run attempt counter

`run.attempt` counts full executions of the script boundary.

It increments when the script is invoked again as a script-level run, including AI-authorized same-script re-entry.

It does **not** increment for:

- provider-level HTTP retries
- inner validator turns
- low-level helper parse retries

### 2) Deterministic recovery counter

`recoveryPolicy.deterministic.attemptsUsed` counts consumed **declared deterministic strategies** in the current failure lineage.

Rules:

- increment once per consumed declared strategy
- do not increment for merely considering a strategy
- do not increment per micro-step inside a single declared helper strategy
- never exceed `maxAttempts`

### 3) AI recovery counter

`recoveryPolicy.aiRecovery.attemptsUsed` counts AI recovery lane executions for the current failure lineage.

Rules:

- increment once per completed AI recovery lane attempt, regardless of whether it recommends `reenter_script`, `hard_fail`, `human_review`, or `no_change_fail`
- if the AI recovery lane crashes after consuming provider/model budget, the attempt still counts
- no silent retries inside the AI recovery lane are allowed beyond what its own durable accounting records

### 4) Provider / validator telemetry counters

Provider calls, validator turns, parse attempts, tool invocations, and failovers belong in metrics/diagnostics telemetry.

They are important for debugging, but they are **not** substitutes for script-run, deterministic, or AI recovery counters.

---

## Global retry ceilings

These are the default safe ceilings for the architecture.

### Deterministic ceilings

Unless a lane family explicitly documents a narrower policy, the default deterministic ceilings are:

- `maxAttempts` per failure lineage: **2**
- maximum repeated consumption of the **same declared strategy ID** in one lineage: **1**
- maximum same-script deterministic re-entry cycles before AI-or-terminal decision: **0** unless the script family explicitly documents one

Interpretation:

- a lane may, for example, consume one repair strategy and one failover strategy
- it may **not** loop `retry-same-target` or `repair-with-validator-tool-loop` indefinitely
- if a lane needs more than 2 declared deterministic strategies, it must justify that in the family contract and remain auditable

### AI recovery ceilings

Default AI recovery ceilings are stricter:

- `maxPerFailure`: **1**
- `maxPerScriptRun`: **1**
- `maxPerPipelineRun`: **3**
- maximum same-script AI-authorized re-entry attempts for one lineage: **1**

Interpretation:

- a failure gets one bounded AI recovery decision
- that decision may authorize one same-script re-entry
- if the re-entry still hard-fails, the default next action is `fail` or `human_review`, not another AI recovery loop

### Override policy

Per-lane overrides are allowed only when all of the following are true:

1. the override is documented in the lane-family contract or config
2. the override is **narrower or equally safe** by default, or has a written justification if broader
3. the override remains machine-readable in emitted policy artifacts
4. the broader override still preserves bounded auditability

Broadening AI recovery beyond one attempt per failure lineage should be treated as exceptional.

---

## Token, time, and cost ceilings

AI recovery must never run without hard machine-readable ceilings.

### Minimum required ceilings

Every AI recovery policy must define:

- `maxInputTokens`
- `maxOutputTokens`
- `maxTotalTokens` or an equivalent aggregate bound
- `timeoutMs`
- `maxCostUsd` when cost accounting exists; otherwise `null` is allowed only if token/time ceilings still exist

### Default safe ceilings

Unless a lane explicitly documents a narrower or justified broader cap, the default AI recovery ceilings are:

- `maxInputTokens`: **12000**
- `maxOutputTokens`: **2000**
- `maxTotalTokens`: **14000**
- `timeoutMs`: **45000**
- `maxCostUsd`: **0.25**

### Cost accounting rules

1. Budget checks must happen **before** the recovery call when estimated size already exceeds the ceiling.
2. Budget accounting must be persisted **after** the call with actual or best-known usage.
3. If accurate cost accounting is unavailable, token/time ceilings still remain mandatory and the artifact must record cost as `null` rather than fabricating a number.
4. If actual or estimated usage exceeds any hard ceiling, the recovery attempt must terminate as `hard_fail` or `human_review`; it must not continue optimistically.

### Deterministic time ceilings

Deterministic recovery should also remain bounded. Default global expectations:

- one deterministic strategy should not block indefinitely
- deterministic helpers must honor existing subprocess/network timeouts
- repeated timeout-class failures count toward stop conditions; they do not justify infinite retries

---

## Mandatory observability and raw/debug capture

Recovery is only in contract when durable evidence exists.

### Required for every hard failure envelope

The failure artifact must preserve or reference:

- failure category and code
- precise failing stage
- structured parse/validation/tool details where applicable
- raw evidence refs for provider/tool artifacts when available
- deterministic attempted/remaining state
- AI recovery eligibility and remaining budget
- next action decision

### Required for every AI recovery attempt

The recovery artifacts must preserve or reference:

- the exact failure package input
- the resolved YAML/config policy used
- prompt or prompt ref
- raw model/provider response or response ref
- parsed decision/result artifact
- revised input artifact, if any
- token/time/cost accounting
- lineage identifiers linking back to the source failure

### Missing-capture rule

If a failure category normally requires raw/debug evidence and that evidence is absent, the run must record one of only two allowed states:

1. `human_review` because required audit evidence is missing, or
2. `hard_fail` because required audit evidence is missing

The system must **not** continue autonomous recovery while pretending the missing evidence does not matter.

### Minimum retention rule

Large artifacts may be summarized for prompt input, but the durable refs to original raw evidence must remain. Summary-only recovery without durable raw refs is out of contract.

---

## Human review vs hard fail

These two outcomes must stay distinct.

### Human review is required when

Use `human_review` when:

- evidence exists, but safe automated repair is ambiguous
- multiple mutually plausible fixes exist
- upstream artifacts appear contradictory or corrupted
- repeated internal failures suggest a code defect but the artifact trail is still valuable for diagnosis
- the allowed re-entry mutation surface is too narrow to fix the problem autonomously
- required repair would cross script boundaries or alter policy/schema

### Hard fail is required when

Use `hard_fail` when:

- the failure is in a hard-fail category/code
- required source artifacts are missing and cannot be recreated within contract
- the contract envelope is malformed
- policy budgets are exhausted
- the system detects a loop or lineage inconsistency
- required config is invalid
- required dependency/tooling is unavailable
- the run has already exceeded repeated-internal-failure stop conditions

### Rule of thumb

- **Ambiguous but diagnosable** → `human_review`
- **Unsafe, out-of-contract, or impossible within policy** → `hard_fail`

---

## Hard-fail categories and repeated-failure stop conditions

### Always hard-fail by default

Unless a lane-family contract explicitly narrows this with justification, these categories skip autonomous AI recovery:

- `config`
- `dependency`
- contract-version mismatch / malformed envelope states
- policy-denied execution states
- unrecoverable required-input `io` failures

### Repeated internal failure stop condition

`internal` failures are not allowed to churn.

Default global rule:

- after **2 internal failures** in the same script lineage, stop autonomous recovery
- after **1 internal failure** following an AI recovery-authorized re-entry, stop autonomous recovery

Interpretation:

- one internal error may still produce `human_review`
- repeated internal errors indicate probable code defects or broken invariants, not input repair opportunities

### Repeated config/dependency failure stop condition

For `config` or `dependency` failures:

- stop immediately on first occurrence for the lineage
- no deterministic retry unless a script-family contract explicitly documents one truly deterministic preflight repair
- no AI recovery by default

### Repeated timeout / provider transport stop condition

Timeout or provider transport failures may use bounded deterministic recovery when declared, but must stop when:

- deterministic budget is exhausted, or
- the same effective target/path has already been retried once, or
- pipeline-wide recovery caps would be exceeded

They do not justify repeated AI recovery by default.

---

## Degraded success vs mandatory failure

This is a key boundary for keeping success honest.

### Degraded success is acceptable only when all are true

A script may emit `status: "success"` with `diagnostics.degraded: true` only when:

1. the payload still satisfies the lane-specific success schema
2. the primary artifact exists and is durable
3. downstream consumers are explicitly allowed to continue safely
4. the missing/reduced quality is described in structured diagnostics/warnings
5. no required contract or validation boundary was bypassed

### Mandatory failure is required when any are true

A script must emit `status: "failure"` when:

- the payload no longer satisfies the lane-specific success schema
- the primary artifact is absent or unusable
- continuation would hide unknown corruption or undefined semantics
- required validators were not run
- the script only produced fallback prose / placeholder content that is not contract-valid
- raw evidence needed to justify degraded continuation is absent

### Examples

#### Acceptable degraded success

- a computed aggregation produces a valid summary while clearly marking omitted failed chunks
- a reporting lane emits a contract-valid report with explicit warnings about absent optional upstream sections

#### Must fail

- structured JSON remained invalid but a lane tries to synthesize “best effort” output outside the schema
- a required metadata artifact is missing but a later lane invents default values to keep moving
- a re-entry result claims success without re-running the original script boundary

---

## Default safe settings vs per-lane overrides

### Default global settings

These defaults apply unless a lane-family contract explicitly overrides them:

```yaml
recovery:
  deterministic:
    maxAttemptsPerFailure: 2
    maxRepeatedStrategyUsesPerFailure: 1
  ai:
    maxPerFailure: 1
    maxPerScriptRun: 1
    maxPerPipelineRun: 3
    budgets:
      maxInputTokens: 12000
      maxOutputTokens: 2000
      maxTotalTokens: 14000
      timeoutMs: 45000
      maxCostUsd: 0.25
  stopConditions:
    internalFailuresPerLineage: 2
    configFailuresPerLineage: 1
    dependencyFailuresPerLineage: 1
```

### Allowed override categories

Per-lane overrides may narrow or specialize:

- deterministic strategy order
- deterministic max attempts when lower than the default
- AI model/adapter selection
- token/time/cost ceilings when lower than the default
- hard-fail code lists
- human-review routing for special cases
- context-shaping limits such as snippet size / raw refs count

### Overrides that require explicit justification

These broader-than-default overrides require written justification in the family contract and emitted policy artifacts:

- deterministic max attempts above 2
- AI recovery attempts above 1 per failure lineage
- pipeline-wide AI cap above 3
- token ceilings materially above the default safe budget
- allowing mutation outside same-script schema-preserving re-entry

### Forbidden overrides

Per-lane policy must not override away these global rules:

- deterministic before AI recovery
- mandatory failure envelopes
- mandatory lineage accounting
- mandatory raw/debug capture requirements
- hard stop on malformed contract or exhausted budget
- prohibition on open-ended AI recovery loops

---

## Audit checklist

A recovery system is only compliant with this policy if a reviewer can answer **yes** to all of the following from durable artifacts alone:

1. Is there a valid universal failure envelope?
2. Is the failure lineage stable and non-reset?
3. Are deterministic attempts and AI recovery attempts counted separately?
4. Are remaining budgets explicit?
5. Are raw/debug refs present, or is their absence explicitly terminal/escalated?
6. Is the next action (`deterministic_recovery`, `ai_recovery`, `human_review`, `fail`) explicit?
7. If success was degraded, is downstream safety explicitly justified?
8. If recovery stopped, is the stopping reason explicit: budget, hard-fail category, repeated internal failure, missing evidence, or human-review boundary?
9. Can the reviewer prove the system did not loop beyond configured caps?

If any answer is no, the run is out of contract.

---

## Bottom line

The global recovery policy for `emotion-engine` is intentionally strict:

- deterministic recovery is first and small
- AI recovery is second and usually one-shot
- counters are explicit and lineage-bound
- token/time/cost budgets are mandatory
- missing evidence is terminal or escalated, not ignored
- repeated internal/config/dependency failures stop quickly
- degraded success is allowed only when downstream continuation remains contract-safe
- per-lane overrides may specialize policy, but may not relax the core guardrails into open-ended autonomous behavior
