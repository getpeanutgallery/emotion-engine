# Universal script result contract

**Status:** Active architecture contract  
**Established:** 2026-03-13

---

## Purpose

This document defines the **universal success JSON contract** and **universal failure JSON contract** for every meaningful `emotion-engine` script.

"Meaningful" means any script whose output is machine-consumed, persisted as a durable artifact, used to drive later phases, or used to make retry / recovery decisions. That includes:

- AI lanes
- computed / aggregation lanes
- tool-wrapper / artifact-producing lanes

This contract is intentionally broader than the AI-lane validator contract. AI lanes still need their own lane-specific schemas and validator-tool loops, but after that lane-specific work is done, every script should still converge on the same system envelope.

For the shared declaration model and next-action rules behind `recoveryPolicy.deterministic`, see `docs/DETERMINISTIC-RECOVERY-FRAMEWORK.md`.

For the bounded failure-package, decision/result, YAML budget, and safe re-entry contract behind `recoveryPolicy.aiRecovery`, see `docs/AI-RECOVERY-LANE-CONTRACT.md`.

For the strict global ceilings, lineage rules, observability requirements, human-review boundaries, and hard-fail stop conditions that constrain both recovery layers, see `docs/RECOVERY-GUARDRAILS-AND-BUDGET-POLICY.md`.

---

## Audit of the current repo state

Representative current script families already show a **partial convergence** on success shape, but **not yet** on failure shape.

### 1) AI gather-context lanes

Representative scripts:

- `server/scripts/get-context/get-dialogue.cjs`
- `server/scripts/get-context/get-music.cjs`

Current success behavior:

- return a plain JS object shaped like:

```json
{
  "artifacts": {
    "dialogueData": { "...lane specific payload...": true }
  }
}
```

or:

```json
{
  "artifacts": {
    "musicData": { "...lane specific payload...": true }
  }
}
```

Current failure behavior:

- fatal path throws an exception
- when raw capture is enabled, writes `raw/_meta/errors.jsonl` and `errors.summary.json`
- AI-attempt diagnostics are preserved in sidecar capture files
- no universal top-level failure JSON envelope is returned to the orchestrator

### 2) AI process lane

Representative script:

- `server/scripts/process/video-chunks.cjs`

Current success behavior:

- returns:

```json
{
  "artifacts": {
    "chunkAnalysis": {
      "chunks": ["..."],
      "totalTokens": 123,
      "statusSummary": {
        "total": 10,
        "successful": 9,
        "failed": 1,
        "failedChunkIndexes": [4]
      }
    }
  }
}
```

Current failure behavior:

- fatal script failure throws
- per-chunk failures may also be represented *inside* a successful artifact as `chunk.status === "failed"`
- raw capture preserves `errors.jsonl` and provider/validator attempt evidence
- there is still no universal script-level failure JSON contract

### 3) Tool-wrapper / artifact lanes

Representative script:

- `server/scripts/get-context/get-metadata.cjs`

Current success behavior:

- returns:

```json
{
  "artifacts": {
    "metadataData": { "...ffprobe-derived payload...": true }
  }
}
```

Current failure behavior:

- throws a plain error such as `get-metadata failed: ...`
- no structured failure envelope is emitted

### 4) Computed / aggregation / rendering lanes

Representative scripts:

- `server/scripts/process/video-per-second.cjs`
- `server/scripts/report/metrics.cjs`
- `server/scripts/report/emotional-analysis.cjs`
- `server/scripts/report/summary.cjs`
- `server/scripts/report/final-report.cjs`

Current success behavior:

- same broad pattern: `return { artifacts: { ... } }`
- artifact payloads vary by lane family (`perSecondData`, `summary`, `summaryData`, `finalReport`)

Current failure behavior:

- usually throws a plain error
- little or no durable structured failure JSON beyond logs

### 5) Pipeline boundary

Representative entrypoints:

- `server/run-pipeline.cjs`
- `bin/run-pipeline.js`

Current behavior:

- pipeline-level API returns `{ success: boolean, artifacts: object }`
- CLI boundary communicates failure through process exit code
- this is useful, but it is still not a script-level universal success/failure envelope

### Audit summary

What already exists:

- a de facto success convention: `{"artifacts": {...}}`
- strong lane-specific payload schemas in meaningful AI lanes
- strong raw debug capture for many AI failures
- some partial/degraded-success semantics already encoded inside payloads (for example `chunkAnalysis.statusSummary`)

What is missing:

- one universal top-level success envelope
- one universal top-level failure envelope
- one universal recovery-policy block
- one universal structured diagnostics block
- one uniform distinction between **script failed hard** vs **script succeeded with degraded payload**

**Implementation status (2026-03-14):**

- the shared runtime from `ee-d4x.1` is now live for the current AI lanes **and** the computed/report family (`video-per-second`, `metrics`, `emotional-analysis`, `summary`, `final-report`)
- computed/report lanes now emit the same persisted success/failure envelopes and lineage refs as AI lanes, but use lane-specific degraded-success warnings instead of AI recovery metadata when they can safely continue with partial data
- `evaluation.cjs` remains available only as a legacy compatibility wrapper and is no longer considered the canonical Phase 3 reporting path

---

## Contract design principles

1. **Keep the top-level envelope universal.**  
   Lane-specific structure belongs under `payload`.

2. **Keep payload schemas lane-specific.**  
   The universal contract must not flatten dialogue, music, chunk analysis, recommendation, metadata, or summary into one fake super-schema.

3. **Make recovery policy explicit at failure time.**  
   Recovery decisions must not depend on parsing a stack trace or reading prose logs.

4. **Keep success and failure machine-routable.**  
   A downstream runner should be able to decide what to do next by reading a small stable set of fields.

5. **Support degraded-but-usable success without inventing a third top-level failure type.**  
   If a script produced a downstream-safe artifact, it should still use the success envelope, with warnings / degradation details carried explicitly.

---

## Universal success JSON contract

### Canonical success envelope

```json
{
  "contractVersion": "ee.script-result/v1",
  "status": "success",
  "phase": "phase2-process",
  "script": "video-chunks",
  "run": {
    "configName": "cod-test",
    "outputDir": "output/cod-test",
    "startedAt": "2026-03-13T19:00:00.000Z",
    "completedAt": "2026-03-13T19:00:15.000Z",
    "durationMs": 15000,
    "attempt": 1
  },
  "payload": {
    "artifactKey": "chunkAnalysis",
    "data": {
      "chunks": [],
      "statusSummary": {
        "total": 0,
        "successful": 0,
        "failed": 0,
        "failedChunkIndexes": []
      }
    }
  },
  "artifacts": {
    "primary": {
      "key": "chunkAnalysis",
      "path": "output/cod-test/phase2-process/chunk-analysis.json",
      "mediaType": "application/json"
    },
    "additional": []
  },
  "metrics": {
    "tokensTotal": 145488,
    "warningsCount": 0
  },
  "diagnostics": {
    "warnings": [],
    "degraded": false,
    "debugCaptureEnabled": true,
    "captureRefs": []
  }
}
```

### Required top-level fields

| Field | Type | Meaning |
| --- | --- | --- |
| `contractVersion` | string | Must be `ee.script-result/v1` for this contract version. |
| `status` | string | Must be `success`. |
| `phase` | string | Canonical phase key, e.g. `phase1-gather-context`. |
| `script` | string | Stable script ID, e.g. `get-dialogue`. |
| `run` | object | Execution identity and timing metadata. |
| `payload` | object | Lane-specific payload wrapper. |
| `artifacts` | object | Durable artifact references produced by the script. |
| `metrics` | object | Small machine-consumable execution metrics. |
| `diagnostics` | object | Warnings, degradation flags, and debug-capture references. |

### Required `run` fields

```json
{
  "configName": "cod-test",
  "outputDir": "output/cod-test",
  "startedAt": "ISO-8601",
  "completedAt": "ISO-8601",
  "durationMs": 1234,
  "attempt": 1
}
```

Notes:

- `attempt` is the script-run attempt number, not the provider attempt number inside an AI lane.
- If some value is unknown at emission time, prefer `null` over omission unless the field is explicitly optional.

### Required `payload` fields

```json
{
  "artifactKey": "dialogueData",
  "data": { "...lane specific schema...": true }
}
```

Rules:

- `artifactKey` is the canonical key downstream code uses in the shared artifact context.
- `data` is the lane-specific success payload.
- `data` must still satisfy its own lane-specific schema.

Examples:

- dialogue lane → `artifactKey: "dialogueData"`
- music lane → `artifactKey: "musicData"`
- metadata lane → `artifactKey: "metadataData"`
- chunk analysis lane → `artifactKey: "chunkAnalysis"`
- recommendation lane → `artifactKey: "recommendationData"`
- computed summary lane → `artifactKey: "summary"` or another explicitly documented key

### Required `artifacts` fields

```json
{
  "primary": {
    "key": "dialogueData",
    "path": "output/.../dialogue-data.json",
    "mediaType": "application/json"
  },
  "additional": []
}
```

Rules:

- `primary.key` must match `payload.artifactKey`.
- `primary.path` must be the durable artifact path when the payload is persisted.
- `additional` lists other durable outputs such as markdown reports, sidecar summaries, or auxiliary JSON files.

### Required `metrics` fields

`metrics` is always present, even if values are minimal:

```json
{
  "tokensTotal": null,
  "warningsCount": 0
}
```

Allowed optional additions include:

- `providerAttempts`
- `validatorCalls`
- `processedUnits`
- `successfulUnits`
- `failedUnits`
- `outputBytes`

### Required `diagnostics` fields

```json
{
  "warnings": [],
  "degraded": false,
  "debugCaptureEnabled": true,
  "captureRefs": []
}
```

Rules:

- `warnings` is a structured list or string list describing non-fatal issues.
- `degraded: true` means the script succeeded and produced a downstream-safe artifact, but quality or completeness was reduced.
- `captureRefs` may point to `raw/_meta/errors.jsonl`, AI capture files, or other debug evidence.

### Success semantics

A script may emit the success envelope only when **all** of the following are true:

1. it produced a payload that satisfies the lane-specific success schema
2. downstream consumers are allowed to continue with that payload
3. any partial loss is explicitly described under `diagnostics`

Examples of still-successful outcomes:

- `video-chunks` finishes with a valid `chunkAnalysis` artifact but `statusSummary.failed > 0`
- `summary.cjs` produces a usable summary even though some optional upstream data was absent and clearly flagged

Examples that must **not** be marked success:

- no valid lane payload exists
- a required artifact path was never written
- downstream continuation would be unsafe or undefined

---

## Universal failure JSON contract

### Canonical failure envelope

```json
{
  "contractVersion": "ee.script-result/v1",
  "status": "failure",
  "phase": "phase3-report",
  "script": "recommendation",
  "run": {
    "configName": "cod-test",
    "outputDir": "output/cod-test",
    "startedAt": "2026-03-13T19:00:00.000Z",
    "completedAt": "2026-03-13T19:00:15.000Z",
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
      "strategyOrder": ["retry-next-target", "retry-with-lower-thinking"],
      "attempted": ["retry-next-target"],
      "remaining": ["retry-with-lower-thinking"],
      "maxAttempts": 2,
      "attemptsUsed": 1
    },
    "aiRecovery": {
      "eligible": true,
      "reason": "Deterministic strategies may exhaust without repairing malformed structured output.",
      "maxAttempts": 1,
      "attemptsUsed": 0,
      "attemptsRemaining": 1,
      "budget": {
        "maxInputTokens": 12000,
        "maxOutputTokens": 2000,
        "maxCostUsd": null
      }
    },
    "nextAction": {
      "policy": "deterministic_recovery",
      "target": "retry-with-lower-thinking",
      "humanRequired": false,
      "stopPipelineOnFailure": true
    }
  },
  "diagnostics": {
    "summary": "Provider returned malformed JSON and the validator-tool loop could not repair it.",
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
}
```

### Required top-level failure fields

| Field | Type | Meaning |
| --- | --- | --- |
| `contractVersion` | string | Must be `ee.script-result/v1`. |
| `status` | string | Must be `failure`. |
| `phase` | string | Canonical phase key. |
| `script` | string | Stable script ID. |
| `run` | object | Same structure as success. |
| `failure` | object | Stable machine-routable description of what failed. |
| `recoveryPolicy` | object | Required policy block describing what recovery may happen next. |
| `diagnostics` | object | Structured evidence for debugging and recovery. |

### Required `failure` fields

```json
{
  "category": "provider_transport | invalid_output | validation | config | dependency | tool | io | timeout | internal",
  "code": "STABLE_MACHINE_CODE",
  "message": "Human-readable explanation",
  "retryable": true,
  "failedOperation": "generate_recommendation",
  "failedUnit": {
    "unitType": "script | chunk | split | artifact | provider_attempt | tool_call",
    "unitId": "recommendation"
  }
}
```

Rules:

- `category` is a small stable taxonomy for routing and reporting.
- `code` must be stable enough that deterministic recovery code can switch on it.
- `retryable` means retry is logically allowed, not that budget remains.
- `failedUnit` lets failures target a specific chunk/split/tool call instead of only the whole script.

### Required `recoveryPolicy` fields

The failure envelope must always include **all four** of these policy areas.

#### 1) Deterministic recovery policy

```json
{
  "eligible": true,
  "strategyOrder": ["retry-next-target", "repair-json-wrapper"],
  "attempted": ["retry-next-target"],
  "remaining": ["repair-json-wrapper"],
  "maxAttempts": 2,
  "attemptsUsed": 1
}
```

Meaning:

- `eligible`: whether deterministic recovery is allowed at all
- `strategyOrder`: ordered policy list the script family recognizes
- `attempted`: strategies already consumed for this failure path
- `remaining`: strategies still available
- `maxAttempts` / `attemptsUsed`: budgeted count for deterministic recovery

#### 2) AI recovery eligibility and budget

```json
{
  "eligible": true,
  "reason": "Deterministic options may not be sufficient.",
  "maxAttempts": 1,
  "attemptsUsed": 0,
  "attemptsRemaining": 1,
  "budget": {
    "maxInputTokens": 12000,
    "maxOutputTokens": 2000,
    "maxCostUsd": null
  }
}
```

Meaning:

- `eligible` is the explicit allow/deny gate for AI recovery
- `attemptsRemaining` prevents open-ended loops
- `budget` is the hard machine-readable ceiling for the recovery lane

#### 3) Next-action policy

```json
{
  "policy": "fail | deterministic_recovery | ai_recovery | human_review",
  "target": "retry-next-target",
  "humanRequired": false,
  "stopPipelineOnFailure": true
}
```

Meaning:

- `policy` is the immediate next state the orchestrator should take
- `target` identifies the next deterministic strategy or AI recovery lane when relevant
- `humanRequired` gates escalation when autonomous recovery is not allowed
- `stopPipelineOnFailure` tells the orchestrator whether this failure is terminal for the current run if the next action is not taken

#### 4) Structured diagnostics

The failure envelope must include a diagnostics block that recovery code can inspect without reading prose logs.

Minimum shape:

```json
{
  "summary": "Short recovery-facing summary",
  "stage": "provider.response_parse",
  "provider": {
    "adapter": "openrouter",
    "model": "qwen/qwen3.5-397b-a17b",
    "requestId": null
  },
  "structured": {
    "parseError": null,
    "validationErrors": [],
    "validationSummary": null
  },
  "rawCaptureRefs": [],
  "stack": null
}
```

Rules:

- `summary` must be concise enough to feed back into retry/recovery prompts
- `stage` identifies the precise boundary that failed
- `structured.parseError` and `structured.validationErrors` are required slots even when null/empty
- `rawCaptureRefs` points at durable debug evidence

---

## Downstream consumption rules

### Rule 1: Downstream code switches on `status` first

- `status === "success"` → read `payload.artifactKey` and `payload.data`
- `status === "failure"` → read `failure`, `recoveryPolicy`, and `diagnostics`

### Rule 2: Downstream code must not infer failure policy from prose

Recovery orchestration must use:

- `failure.category`
- `failure.code`
- `recoveryPolicy.deterministic`
- `recoveryPolicy.aiRecovery`
- `recoveryPolicy.nextAction`

not freeform log lines or stack traces.

### Rule 3: Lane-specific data always lives under `payload.data`

Examples:

- dialogue transcript object
- music analysis object
- chunk analysis object
- recommendation object
- metadata object
- computed summary object

### Rule 4: Success payloads may still be degraded

Consumers must inspect:

- `diagnostics.degraded`
- `diagnostics.warnings`

before assuming ideal-quality output.

### Rule 5: The same contract applies to durable persisted JSON

When a script emits a canonical result envelope, the persisted result record should preserve the same fields. Sidecar legacy artifacts may still exist, but the contract record becomes the authoritative machine-readable boundary.

---

## Compatibility / rollout guidance

This contract is the **target architecture**. The repo is not fully migrated yet.

Current repo reality:

- most scripts still return legacy `{"artifacts": {...}}`
- failures still primarily surface as thrown errors plus sidecar raw-capture files

Migration rule for rollout beads:

1. keep existing lane-specific artifact schemas intact
2. wrap them in the universal envelope
3. preserve legacy `artifacts` mirroring only as a temporary compatibility bridge where needed
4. add failure-envelope emission before relying on deterministic or AI recovery orchestration

---

## Resolved architecture decisions

1. **No `partial_success`:**  
   Keep only `success` and `failure` at top level. Degraded-but-usable outcomes remain `status: "success"` with `diagnostics.degraded` describing the condition.

2. **Envelope persistence strategy:**  
   Each script emits its own validated JSON result as the source of truth.

3. **Failure code ownership:**  
   `failure.code` values are script-local and may rely on localized knowledge. Shared naming guidance may exist later, but there is no mandatory global registry.

4. **Recovery context richness:**  
   Recovery should receive as much context as practical. Large tool outputs may be wrapped or summarized before an AI recovery lane consumes them.

5. **Top-level pipeline contract alignment:**  
   The top-level pipeline API should adopt the same envelope family as a higher-level aggregation wrapper while preserving per-script envelopes as the underlying source of truth.

## Remaining design questions for later beads

1. **Run-attempt identity and lineage:**  
   Decide whether `run.attempt` is enough or whether later recovery beads need explicit `executionId` / `parentExecutionId` lineage.

2. **Wrapper strategy for large recovery contexts:**  
   Decide how wrapper/summarization helpers should package large tool outputs so AI recovery gets enough context without ingesting excessive raw data.

---

## Bottom line

The durable repo contract going forward is:

- every meaningful script converges on one **universal success envelope**
- every hard failure converges on one **universal failure envelope**
- lane-specific meaning stays under `payload.data`
- deterministic recovery policy, AI recovery eligibility/budget, next-action policy, and structured diagnostics are **required** in every failure envelope

That gives later deterministic-recovery and AI-recovery beads a stable machine contract instead of more prose and special cases.
