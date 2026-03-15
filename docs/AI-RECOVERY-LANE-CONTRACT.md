# AI Recovery Lane Contract

**Status:** Active architecture contract  
**Established:** 2026-03-14

---

## Purpose

This document defines the **AI recovery lane contract** for `emotion-engine`.

It sits on top of the already-settled architecture in:

- `docs/UNIVERSAL-SCRIPT-RESULT-CONTRACT.md`
- `docs/DETERMINISTIC-RECOVERY-FRAMEWORK.md`
- `docs/AI-LANE-CONTRACT.md`

Those docs already establish that:

1. meaningful scripts emit a universal success/failure envelope
2. deterministic recovery is declared, explicit, and bounded
3. meaningful AI lanes already use strict validator-tool acceptance contracts

This doc adds the missing layer between a **script failure envelope** and a **bounded AI-driven recovery attempt**.

The goal is to make AI recovery:

- explicit
- bounded
- auditable
- configuration-driven
- safe to re-enter from
- impossible to loop forever

The strict global ceilings, lineage rules, mandatory capture requirements, degraded-success boundaries, and hard-stop conditions that constrain this lane are defined in `docs/RECOVERY-GUARDRAILS-AND-BUDGET-POLICY.md`.

AI recovery is **not** a replacement for deterministic recovery. It is the fallback lane for failures that remain unresolved after deterministic recovery is exhausted, inapplicable, or explicitly skipped by policy.

---

## Scope

This contract covers the dedicated lane that consumes a structured failure package and decides whether to:

1. stop with a hard failure,
2. request human review, or
3. produce a revised input package for one bounded re-entry attempt of the failing script.

It applies to recovery for meaningful scripts whose failures already conform to the universal failure envelope.

It does **not** authorize open-ended planner behavior, broad repo rewrites, or freeform multi-step agent loops.

### Mandatory recovery validator-tool contract

The live AI recovery lane now uses a dedicated lane-specific validator tool. Its prompt wording should follow the shared cross-repo wording standard in `docs/AI-LANE-CONTRACT.md` for Option B enum notes, canonical minimal envelopes, wrapper-key prohibitions, and final acceptance after validator success.

The live AI recovery lane now uses a dedicated lane-specific validator tool:

- **Tool name:** `validate_ai_recovery_decision_json`
- **Canonical tool-call envelope:**

```json
{
  "tool": "validate_ai_recovery_decision_json",
  "recoveryDecision": {
    "decision": {
      "outcome": "reenter_script",
      "reason": "Short bounded reason.",
      "confidence": "medium",
      "hardFail": false,
      "humanReviewRequired": false
    },
    "revisedInput": {
      "kind": "same-script-revised-input",
      "changes": [
        { "path": "repairInstructions", "op": "set", "value": ["Return valid JSON only."] },
        { "path": "boundedContextSummary", "op": "set", "value": "Previous output was malformed JSON." }
      ]
    }
  }
}
```

Hard rules for the validator-tool lane:

- the model must call the validator tool before any final recovery decision can be accepted
- the final accepted artifact must still be the bare decision JSON object, not the tool envelope
- only `repairInstructions` and `boundedContextSummary` may be mutated in `revisedInput.changes`
- only `set` operations are allowed
- terminal outcomes (`hard_fail`, `human_review`, `no_change_fail`) must not carry non-empty `revisedInput.changes`
- malformed envelopes, forbidden mutation paths, or out-of-contract decision shapes must fail deterministically rather than falling back to plain direct JSON acceptance

The AI recovery lane is allowed to reason about:

- why the script failed
- whether the failure is safely recoverable within declared policy
- what revised input or prompt/package should be fed back into the same script

It is **not** allowed to:

- invent new downstream pipeline structure
- bypass validation contracts
- alter unrelated artifacts
- recurse into another AI recovery lane
- keep trying until it “feels fixed”

---

## Position in the recovery stack

Recovery order is strictly:

1. script executes normally
2. script fails and emits the universal failure envelope
3. deterministic recovery is evaluated first
4. AI recovery is considered only if deterministic recovery cannot or should not resolve the failure
5. at most one configured AI recovery attempt is consumed per failure lineage unless a script family explicitly documents a higher cap
6. if AI recovery cannot safely produce a valid re-entry package, the system hard-fails or escalates to human review

### Hard rule

**AI recovery never runs as an unbounded inner loop.**

It is a declared lane with explicit budgets and attempt ceilings. The orchestrator must be able to answer, from durable artifacts alone:

- why AI recovery was invoked
- what it saw
- what it decided
- what revised input it produced, if any
- whether the re-entry attempt succeeded or failed
- why recovery stopped

---

## Preconditions for AI recovery eligibility

AI recovery may be considered only when all of the following are true:

1. the failing script emitted a valid universal failure envelope
2. `recoveryPolicy.aiRecovery.eligible === true`
3. deterministic recovery either:
   - has no applicable remaining strategies, or
   - is explicitly disabled by policy for this failure, or
   - has exhausted its declared budget
4. AI recovery attempt budget remains
5. the failing script family documents a safe re-entry boundary
6. required diagnostics and raw captures are available, or the failure explicitly records why they are absent

If any of those conditions are not met, the next action must be `fail` or `human_review`, not `ai_recovery`.

---

## Failure package input contract

The AI recovery lane consumes a **failure package** assembled from the script's universal failure envelope plus bounded context needed for repair.

### Canonical failure package schema

```json
{
  "contractVersion": "ee.ai-recovery-input/v1",
  "sourceFailure": {
    "contractVersion": "ee.script-result/v1",
    "status": "failure",
    "phase": "phase3-report",
    "script": "recommendation",
    "run": {
      "configName": "cod-test",
      "outputDir": "output/cod-test",
      "startedAt": "2026-03-14T16:00:00.000Z",
      "completedAt": "2026-03-14T16:00:15.000Z",
      "durationMs": 15000,
      "attempt": 1
    },
    "failure": {
      "category": "invalid_output",
      "code": "RECOMMENDATION_INVALID_JSON",
      "message": "Strict JSON output was invalid after validator-tool retries.",
      "retryable": true,
      "failedOperation": "generate_recommendation",
      "failedUnit": {
        "unitType": "script",
        "unitId": "recommendation"
      }
    },
    "recoveryPolicy": {
      "deterministic": {
        "eligible": true,
        "family": "ai.structured-output.v1",
        "strategyOrder": [
          "repair-with-validator-tool-loop",
          "failover-next-target"
        ],
        "attempted": [
          "repair-with-validator-tool-loop",
          "failover-next-target"
        ],
        "remaining": [],
        "maxAttempts": 2,
        "attemptsUsed": 2
      },
      "aiRecovery": {
        "eligible": true,
        "reason": "Deterministic structured-output repair was exhausted.",
        "maxAttempts": 1,
        "attemptsUsed": 0,
        "attemptsRemaining": 1,
        "budget": {
          "maxInputTokens": 12000,
          "maxOutputTokens": 2000,
          "maxCostUsd": 0.25
        }
      },
      "nextAction": {
        "policy": "ai_recovery",
        "target": "structured-output-repair",
        "humanRequired": false,
        "stopPipelineOnFailure": true
      }
    },
    "diagnostics": {
      "summary": "Model continued to return malformed JSON after validator feedback.",
      "stage": "validator.final_parse",
      "provider": {
        "adapter": "google",
        "model": "gemini-3.1-pro-preview",
        "requestId": "req_123"
      },
      "structured": {
        "parseError": "Unexpected token } in JSON at position 481",
        "validationErrors": [],
        "validationSummary": "Final recommendation object could not be parsed as JSON."
      },
      "rawCaptureRefs": [
        "output/cod-test/phase3-report/raw/ai/recommendation/attempt-02/capture.json",
        "output/cod-test/phase3-report/raw/_meta/errors.jsonl"
      ],
      "stack": null
    }
  },
  "lineage": {
    "failureId": "recommendation:phase3-report:attempt-1",
    "scriptRunAttempt": 1,
    "deterministicAttemptsUsed": 2,
    "aiRecoveryAttemptsUsed": 0,
    "maxAiRecoveryAttempts": 1,
    "reentryAttemptNumber": 1
  },
  "reentryContract": {
    "mode": "same-script-revised-input",
    "script": "recommendation",
    "allowedMutableInputs": [
      "repairInstructions",
      "boundedContextSummary"
    ],
    "forbiddenMutableInputs": [
      "upstreamArtifacts",
      "artifactPaths",
      "schemaDefinition",
      "runtimeBudgets"
    ]
  },
  "context": {
    "inputSummary": {
      "artifactRefs": [
        "output/cod-test/phase3-report/recommendation-input.json"
      ],
      "promptRef": "output/cod-test/phase3-report/raw/prompts/recommendation-prompt.md"
    },
    "failureSummary": "Recommendation JSON remained malformed after deterministic repair.",
    "rawEvidenceRefs": [
      "output/cod-test/phase3-report/raw/ai/recommendation/attempt-02/capture.json",
      "output/cod-test/phase3-report/raw/_meta/errors.jsonl"
    ],
    "boundedSnippets": {
      "lastInvalidOutput": "{\"text\":\"...",
      "validationSummary": "JSON parse failed near the end of the object."
    }
  },
  "policy": {
    "adapter": "google",
    "model": "gemini-3.1-pro-preview",
    "temperature": 0,
    "maxInputTokens": 12000,
    "maxOutputTokens": 2000,
    "maxCostUsd": 0.25,
    "timeoutMs": 45000
  }
}
```

### Required top-level input fields

| Field | Type | Meaning |
| --- | --- | --- |
| `contractVersion` | string | Must be `ee.ai-recovery-input/v1`. |
| `sourceFailure` | object | The original universal failure envelope. |
| `lineage` | object | Attempt and lineage identity for bounded recovery. |
| `reentryContract` | object | Safe re-entry declaration for the failing script. |
| `context` | object | Bounded context, references, and snippets made available to the AI lane. |
| `policy` | object | Resolved YAML-configured adapter/model/budget policy for this recovery attempt. |

### Failure package rules

1. `sourceFailure` is authoritative. AI recovery must not reinterpret the failure by ignoring the original envelope.
2. `context` may include summaries and bounded excerpts, but must keep durable references to the underlying raw evidence.
3. Large raw artifacts may be summarized, but the package must preserve refs back to the durable source files.
4. `reentryContract` must explicitly state what may be changed before feeding the package back into the failing script.
5. `policy` is resolved configuration, not an open prompt suggestion.

---

## AI recovery decision/result contract

The AI recovery lane itself must emit a durable machine-readable result.

### Canonical decision/result schema

```json
{
  "contractVersion": "ee.ai-recovery-result/v1",
  "status": "completed",
  "lane": "structured-output-repair",
  "lineage": {
    "failureId": "recommendation:phase3-report:attempt-1",
    "script": "recommendation",
    "phase": "phase3-report",
    "scriptRunAttempt": 1,
    "aiRecoveryAttempt": 1,
    "maxAiRecoveryAttempts": 1
  },
  "decision": {
    "outcome": "reenter_script",
    "reason": "The failure appears confined to malformed final JSON; a revised prompt package is safe.",
    "confidence": "medium",
    "hardFail": false,
    "humanReviewRequired": false
  },
  "revisedInput": {
    "kind": "same-script-revised-input",
    "changes": [
      {
        "path": "repairInstructions",
        "op": "set",
        "value": [
          "Return one JSON object only.",
          "Do not include markdown fences.",
          "Ensure the object closes cleanly and re-check bracket balance before final output."
        ]
      },
      {
        "path": "boundedContextSummary",
        "op": "set",
        "value": "Previous output failed final JSON parsing near the object tail; keep the same semantic content but regenerate a syntactically valid object."
      }
    ]
  },
  "budgets": {
    "inputTokensUsed": 6421,
    "outputTokensUsed": 731,
    "estimatedCostUsd": 0.09,
    "withinBudget": true
  },
  "observability": {
    "promptRef": "output/cod-test/phase3-report/recovery/raw/attempt-01/prompt.md",
    "responseRef": "output/cod-test/phase3-report/recovery/raw/attempt-01/response.json",
    "decisionRef": "output/cod-test/phase3-report/recovery/decision.json",
    "rawCaptureRefs": [
      "output/cod-test/phase3-report/recovery/raw/attempt-01/response.json"
    ]
  },
  "nextAction": {
    "policy": "reenter_script",
    "target": "recommendation",
    "stopPipelineOnFailure": true
  }
}
```

### Required top-level result fields

| Field | Type | Meaning |
| --- | --- | --- |
| `contractVersion` | string | Must be `ee.ai-recovery-result/v1`. |
| `status` | string | Must be `completed` or `failed`. |
| `lane` | string | Stable AI recovery lane ID. |
| `lineage` | object | Recovery attempt identity. |
| `decision` | object | The lane's bounded decision. |
| `budgets` | object | Measured usage against declared budgets. |
| `observability` | object | Durable refs to prompt/response/decision/raw evidence. |
| `nextAction` | object | What the orchestrator should do after the lane finishes. |

### Allowed `decision.outcome` values

| Outcome | Meaning |
| --- | --- |
| `reenter_script` | Recovery produced a safe revised input package for one more attempt of the same script. |
| `hard_fail` | Recovery determined the failure is not safely recoverable within policy. |
| `human_review` | Recovery determined human inspection is required. |
| `no_change_fail` | Recovery could not produce a safe patch or meaningful revision. |

Rules:

- AI recovery must not emit a vague “maybe retry” result.
- It must produce either a concrete revised-input package or a terminal/escalation decision.
- `hard_fail` and `no_change_fail` are distinct: `hard_fail` means policy says stop; `no_change_fail` means recovery could not safely improve the input.

### Dedicated validator-tool contract for the recovery lane

The AI recovery lane must use its own local validator tool before any recovery decision is accepted.

**Tool name:** `validate_ai_recovery_decision_json`

**Canonical tool-call envelope:**

```json
{
  "tool": "validate_ai_recovery_decision_json",
  "recoveryDecision": {
    "decision": {
      "outcome": "reenter_script",
      "reason": "Previous failure was malformed JSON after deterministic validator retries; one bounded same-script repair is safe.",
      "confidence": "medium",
      "hardFail": false,
      "humanReviewRequired": false
    },
    "revisedInput": {
      "kind": "same-script-revised-input",
      "changes": [
        {
          "path": "repairInstructions",
          "op": "set",
          "value": [
            "Return one JSON object only.",
            "Do not include markdown fences."
          ]
        },
        {
          "path": "boundedContextSummary",
          "op": "set",
          "value": "Previous output failed final JSON parsing near the object tail."
        }
      ]
    }
  }
}
```

**Accepted decision values:**

- `reenter_script`
- `hard_fail`
- `human_review`
- `no_change_fail`

**Canonical revised-input shape:**

```json
{
  "kind": "same-script-revised-input",
  "changes": [
    {
      "path": "repairInstructions",
      "op": "set",
      "value": ["non-empty instruction string"]
    },
    {
      "path": "boundedContextSummary",
      "op": "set",
      "value": "non-empty bounded context summary"
    }
  ]
}
```

**Validator-enforced bounded constraints:**

1. The only accepted tool-call envelope is exactly `{"tool":"validate_ai_recovery_decision_json","recoveryDecision":{...}}`; no wrapper aliases like `toolName`, `arguments`, `args`, `input`, or extra top-level keys are allowed.
2. `recoveryDecision` must be a JSON object with a required `decision` object and an optional `revisedInput` object.
3. `decision.outcome` must be one of `reenter_script`, `hard_fail`, `human_review`, or `no_change_fail`.
4. `decision.reason` must be a non-empty string. `decision.confidence` must be one of `low`, `medium`, or `high`.
5. `decision.hardFail` and `decision.humanReviewRequired` must be booleans and stay semantically aligned with `decision.outcome`:
   - `reenter_script` => `hardFail: false`, `humanReviewRequired: false`
   - `hard_fail` => `hardFail: true`, `humanReviewRequired: false`
   - `human_review` => `hardFail: false`, `humanReviewRequired: true`
   - `no_change_fail` => `hardFail: false`, `humanReviewRequired: false`
6. `revisedInput` is **required** when `decision.outcome === "reenter_script"` and **forbidden** for `hard_fail`, `human_review`, and `no_change_fail`.
7. `revisedInput.kind` must be exactly `same-script-revised-input`.
8. `revisedInput.changes` must be a non-empty array when present, with at most two entries total and no duplicate `path` values.
9. Each change must use `op: "set"` and may target only `repairInstructions` or `boundedContextSummary`.
10. `repairInstructions` must be an array of non-empty strings. `boundedContextSummary` must be a non-empty string.
11. No change may mutate budgets, schema, upstream artifacts, output contract versions, or cross-script routing. Any path outside `repairInstructions` and `boundedContextSummary` is invalid.
12. Even after the validator accepts a recovery decision, the subsequent same-script re-entry must still pass the original lane-specific validator-tool and normal script/result contracts.

### Result failure semantics

If the AI recovery lane itself fails operationally, it still must emit `ee.ai-recovery-result/v1` with:

- `status: "failed"`
- a `decision.outcome` of `hard_fail` or `human_review`
- durable diagnostics in `observability.rawCaptureRefs`
- budget/accounting fields populated as far as known

The system must not silently swallow recovery-lane failures.

---

## YAML configuration contract

AI recovery is configuration-driven. The lane selection, model/adapter choice, and budgets must come from YAML rather than ad hoc code constants.

### Canonical YAML shape

```yaml
recovery:
  ai:
    enabled: true
    lane: structured-output-repair
    adapter: google
    model: gemini-3.1-pro-preview
    temperature: 0
    timeoutMs: 45000

    attempts:
      maxPerFailure: 1
      maxPerScriptRun: 1
      maxPerPipelineRun: 3

    budgets:
      maxInputTokens: 12000
      maxOutputTokens: 2000
      maxTotalTokens: 14000
      maxCostUsd: 0.25

    context:
      maxSnippetChars: 8000
      maxRawRefs: 12
      includePromptRef: true
      includeLastInvalidOutput: true
      includeValidationSummary: true
      includeProviderMetadata: true

    reentry:
      mode: same-script-revised-input
      allowPromptPatch: true
      allowBoundedContextSummary: true
      allowSchemaPreservingInputPatch: true
      allowArtifactMutation: false
      allowBudgetMutation: false
      allowCrossScriptReroute: false

    hardFailCategories:
      - config
      - dependency
      - io

    hardFailCodes:
      - METADATA_REQUIRED_INPUT_MISSING
      - CONFIG_SCHEMA_INVALID

    humanReviewCategories:
      - internal

    capture:
      persistPrompt: true
      persistResponse: true
      persistDecision: true
      persistRawEvidenceRefs: true
```

### Required YAML semantics

#### Adapter/model selection

- `adapter` and `model` select the recovery lane's provider target.
- This selection is separate from the failing script's original provider target.
- The resolved selection must be copied into the failure package `policy` block and the resulting recovery artifact.

#### Attempts

At minimum the YAML contract must support:

- `maxPerFailure`
- `maxPerScriptRun`
- `maxPerPipelineRun`

Default architecture guidance:

- `maxPerFailure: 1`
- `maxPerScriptRun: 1`
- keep pipeline-wide caps small and reviewable

#### Budgets

At minimum the YAML contract must support:

- `maxInputTokens`
- `maxOutputTokens`
- `maxTotalTokens` or equivalent bounded aggregate ceiling
- `maxCostUsd` when cost accounting exists
- `timeoutMs`

If cost accounting is unavailable, `maxCostUsd` may be `null`, but token/time ceilings are still mandatory.

#### Context shaping

The YAML contract must control how much raw context is fed into AI recovery. This prevents accidental giant prompts and makes recovery auditable.

#### Re-entry policy

The YAML contract must explicitly encode what kinds of mutations are allowed before re-entering the failing script.

#### Hard-fail / human-review routing

The YAML contract may define policy-level denial lists such as categories or codes that should skip AI recovery even when the failure envelope says recovery is generally eligible.

---

## Retry and attempt budgeting

Budgeting must remain simple enough that a human can audit it from artifacts alone.

### Required counters

For each failure lineage, the system must track:

- original script run attempt number
- deterministic recovery attempts used
- AI recovery attempts used
- remaining AI recovery attempts
- whether the current re-entry attempt is the final allowed attempt

### Caps

The architecture requires all of the following caps:

1. **Per failure lineage cap**  
   Prevents the same failure from bouncing between AI recovery and script re-entry forever.

2. **Per script-run cap**  
   Prevents a single script invocation from consuming many recovery attempts under slightly different failure surfaces.

3. **Per pipeline-run cap**  
   Prevents large runs from burning budget across many failures without bound.

4. **Per-attempt token/time/cost caps**  
   Prevents one recovery attempt from becoming too large.

### Default guidance

Unless a script family has a documented need otherwise:

- deterministic recovery gets the first bounded chance
- AI recovery gets **one** bounded attempt per failure lineage
- AI recovery re-entry gets **one** re-run of the same script using the revised input
- if that re-run still hard-fails, the system stops or escalates; it does not chain another AI recovery attempt by default

### Forbidden patterns

The following are explicitly out of contract:

- `while failure -> ask AI again`
- AI recovery producing another AI recovery request
- silently resetting attempt counters on re-entry
- consuming extra attempts without durable artifacts
- using hidden heuristics instead of explicit counters

---

## Safe re-entry contract

The key safety question is: **what exactly may AI recovery change before the failing script is run again?**

The answer must be script-family-specific and machine-readable.

### Allowed default re-entry mode

The default allowed mode is:

`same-script-revised-input`

Meaning:

- re-run the **same script**
- with the **same lane-specific output schema expectations**
- using a **revised, bounded input package**
- without mutating unrelated upstream artifacts or system policy

### Allowed mutations by default

In the current checked-in implementation, AI recovery may propose changes only to:

- `repairInstructions`
- `boundedContextSummary`

Those are the only accepted same-script revised-input paths for the recovery validator-tool contract.

### Forbidden mutations by default

AI recovery must not, by default:

- mutate upstream source artifacts
- rewrite or relax the target output schema
- change success/failure contract versions
- change retry budgets or policy ceilings
- switch to a different script
- skip required deterministic validation/tool loops
- claim success without re-running the original script boundary

### Safe re-entry rules

1. **Same script boundary**  
   Recovery re-entry targets the same script that failed unless a future contract explicitly defines a reroute mode.

2. **Schema-preserving only**  
   The revised input must still expect the original lane-specific success schema.

3. **One bounded re-entry attempt**  
   A recovery result authorizes at most one new script attempt for that failure lineage unless higher caps are explicitly configured and documented.

4. **No hidden mutation**  
   Every changed field in the revised input package must be represented in the durable recovery result.

5. **No policy mutation**  
   AI recovery cannot increase its own budget, change attempt ceilings, or relax hard-fail rules.

6. **Re-entry is still validated normally**  
   The re-run script must pass through the same validators, output contracts, and deterministic/failure handling as any other run.

---

## Observability, debug, and raw-capture requirements

AI recovery must be at least as auditable as the failing AI lanes it is trying to repair.

### Minimum durable artifacts

For every AI recovery attempt, persist durable refs for:

- the failure package input
- the resolved YAML policy used for the attempt
- the exact recovery prompt or prompt reference
- the raw model response or provider response envelope
- the parsed decision/result artifact
- the revised input package, if produced
- token/cost/time accounting
- links back to source failure raw artifacts

### Minimum observability fields

The recovery result must preserve:

- recovery lane ID
- adapter/model used
- attempt number
- failure lineage ID
- whether output stayed within budget
- whether a revised input was produced
- why the lane chose re-entry vs hard fail vs human review

### Raw capture rules

If debug/raw capture is enabled, the system must preserve enough evidence to answer:

1. what failure package the AI saw
2. what instructions it received
3. what model returned
4. what structured decision was extracted
5. what revised input was generated
6. whether the subsequent re-entry succeeded

Large artifacts may be stored by reference, but the references must be durable and explicit.

### Summary vs raw evidence

Recovery prompts may use bounded summaries instead of full raw artifacts, but:

- the summarization boundary must be visible in the package
- raw evidence refs must still be preserved
- decisions must remain explainable against the original artifacts

---

## Hard-fail boundaries

Some failures must not go through AI recovery, even if an AI could theoretically suggest something.

### Hard-fail by default

These categories are hard-fail unless a narrower family contract explicitly allows otherwise:

- `config`
- `dependency`
- unrecoverable `io` failures where required source artifacts are absent
- security or policy-denied execution states
- contract-version mismatches

Examples:

- missing required input artifact
- invalid YAML/config schema
- required tool binary unavailable
- artifact path points to non-existent input that recovery cannot recreate
- failure envelope itself is malformed

### Human-review boundary examples

These should normally escalate to `human_review` rather than autonomous re-entry:

- repeated internal errors suggesting code bugs
- contradictory or corrupted upstream artifacts
- failures where safe input mutation cannot be expressed through the re-entry contract
- ambiguous cases where multiple scripts or datasets would need mutation

### AI recovery is not allowed to paper over

- missing deterministic audit data
- absent source artifacts required for reproducibility
- invalid contract envelopes
- failures caused by code defects that need implementation changes
- failures requiring schema redesign or prompt-contract redesign beyond bounded patching

---

## Orchestrator decision rules

The orchestrator should use this order:

1. consume the script failure envelope
2. honor deterministic recovery first if `nextAction.policy === "deterministic_recovery"`
3. invoke AI recovery only when `nextAction.policy === "ai_recovery"`
4. consume the AI recovery result
5. if `decision.outcome === "reenter_script"`, run one bounded re-entry attempt of the same script
6. if re-entry succeeds, normal success flow resumes
7. if re-entry fails, do **not** automatically invoke AI recovery again unless budget, policy, and lineage rules explicitly permit it
8. otherwise hard-fail or escalate exactly as the recovery result directs

The orchestrator must not infer extra attempts from logs, heuristics, or “seems fixable” reasoning.

---

## Compatibility and rollout guidance

This doc defines the durable target contract.

### 2026-03-15 implementation note

The shared recovery runtime is now live in checked-in code (`server/lib/script-contract.cjs`, `server/lib/script-runner.cjs`, `server/lib/ai-recovery-lane.cjs`, and `server/lib/ai-recovery-validator-tool.cjs`) and the current same-script AI recovery path is wired for the four meaningful AI lanes:

- `server/scripts/get-context/get-dialogue.cjs`
- `server/scripts/get-context/get-music.cjs`
- `server/scripts/process/video-chunks.cjs`
- `server/scripts/report/recommendation.cjs`

A few parts of this doc were broader than the current implementation and are now bounded here explicitly:

- the live re-entry patch surface is currently limited to `repairInstructions` and `boundedContextSummary`
- the recovery model is now required to use `validate_ai_recovery_decision_json` before final acceptance; malformed or out-of-contract recovery decisions do not fall back to plain direct JSON acceptance
- the emitted `revisedInput.kind` is currently `same-script-revised-input`
- `recovery.ai.context.includePromptRef` and `includeProviderMetadata` remain valid config fields, but the current failure-package builder only opportunistically records a prompt ref and does not yet inject provider metadata into `context`
- activation is still config-driven at run time: the lane only runs when YAML enables `recovery.ai.enabled` and provides a recovery `adapter` + `model`

Read the sections below as the durable contract, with the bullets above reflecting the narrower checked-in implementation as of 2026-03-15.

During rollout:

1. preserve the universal success/failure envelope as the outer boundary
2. preserve deterministic recovery as the first recovery layer
3. introduce AI recovery through a dedicated bounded failure package + result artifact pair
4. keep YAML as the source of adapter/model/budget policy
5. avoid implementation-specific hidden state that cannot be reconstructed from artifacts

Initial migration priority should focus on scripts/lanes where:

- deterministic retry still leaves malformed but plausibly repairable inputs
- structured diagnostics and raw capture already exist
- same-script re-entry is easy to constrain and audit

---

## Bottom line

The `emotion-engine` AI recovery contract is:

- **failure in:** a universal script failure envelope plus bounded recovery context
- **decision out:** a durable AI recovery result with one explicit outcome
- **policy source:** YAML-configured adapter/model/attempt/budget settings
- **re-entry shape:** same-script, schema-preserving, bounded revised input only
- **auditability:** prompt/response/decision/raw refs are mandatory
- **safety:** deterministic recovery goes first, hard-fail boundaries stay explicit, and open-ended loops are forbidden

That gives the repo a concrete architecture for AI-assisted recovery without turning recovery into an unbounded agent system.
