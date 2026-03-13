# Deterministic Recovery Framework

This doc defines the shared deterministic recovery model for emotion-engine script results.

It is the companion to `docs/UNIVERSAL-SCRIPT-RESULT-CONTRACT.md`:

- the universal contract defines the failure envelope shape
- this doc defines how scripts declare deterministic recoveries and how that envelope is populated

The goal is to make deterministic recovery:

- explicit
- bounded
- machine-routable
- compatible with script-local failure codes
- reusable across script families without flattening them into one fake global schema

---

## Scope

This framework covers the layer between:

1. a script detecting a hard failure, and
2. the orchestrator deciding whether to retry deterministically, invoke AI recovery, request human review, or stop.

It does **not** require every script to support deterministic recovery. Some scripts will explicitly declare that they have no deterministic recovery beyond immediate failure.

It also does **not** replace script-owned payload contracts. Each script still owns:

- its success payload schema
- its failure codes
- its local validation rules
- its local knowledge of what recoveries are safe

---

## Compatibility with agreed architecture

This framework assumes and preserves the repo decisions already recorded in `docs/UNIVERSAL-SCRIPT-RESULT-CONTRACT.md`.

### 1) No `partial_success`

A script result is still either:

- `status: "success"`, or
- `status: "failure"`

Degraded-but-usable outputs remain a success result with diagnostics or warnings inside the success envelope. Deterministic recovery only applies to hard failures.

### 2) Failure codes are script-local

This framework does **not** introduce a global failure-code registry.

Deterministic recovery may switch on:

- `failure.category`
- `failure.code`
- script-local diagnostics

But the interpretation of `failure.code` remains owned by the script family that emits it.

### 3) Result envelopes are script-owned

Each script emits its own result envelope as the durable source of truth.

The orchestrator consumes those envelopes; it does not invent a different failure representation on the side.

### 4) Pipeline-level aggregation uses the same envelope family

The top-level pipeline wrapper may aggregate script envelopes, but it should reuse the same `recoveryPolicy` concepts:

- deterministic eligibility
- attempted / remaining
- next action
- AI recovery eligibility

That keeps script-level and pipeline-level recovery reasoning aligned.

---

## Audit: representative current behavior

The current repo already contains meaningful deterministic retry and repair behavior, but it is spread across helpers, raw-capture artifacts, and lane-local conventions rather than one durable contract.

### A) AI structured-output lanes

Representative scripts:

- `server/scripts/get-context/get-dialogue.cjs`
- `server/scripts/get-context/get-music.cjs`
- `server/scripts/process/video-chunks.cjs`
- `server/scripts/report/recommendation.cjs`

Current deterministic behavior already present:

1. **Target retry + failover** via `server/lib/ai-targets.cjs`
   - `executeWithTargets(...)` retries within a target up to `retry.maxAttempts`
   - retryable runtime failures can fail over to the next configured target
   - auth/capability errors fail fast
   - failover metadata is captured in `pendingFailover`

2. **Local structured-output repair loops**
   - `server/lib/local-validator-tool-loop.cjs` runs a bounded validator-tool loop with:
     - `maxTurns`
     - `maxValidatorCalls`
     - local parse / validation feedback
   - dialogue and music use the shared helper
   - `recommendation.cjs` implements a lane-local copy of the same pattern
   - `emotion-lenses-tool.cjs` uses the shared helper for video chunk analysis

3. **Lane-local invalid-output detection**
   - malformed or schema-invalid structured output becomes `createRetryableError(...)`
   - `video-chunks.cjs` additionally converts chunk-shape validation failures into retryable invalid output
   - `video-chunks.cjs` uses lane-local `shouldRetry(...)` rules to distinguish parse-invalid vs provider-error retryability

4. **Strong observability, weak durable recovery contract**
   - attempts, provider calls, tool-loop history, validation summaries, and failovers are captured in events and raw artifacts
   - but the durable script result still does not emit one universal failure envelope with explicit attempted / remaining recovery state

Current gaps:

- strategy names are mostly implicit in helper behavior, not explicitly declared by scripts
- retry state is captured operationally, not as a stable result-envelope contract
- next action is inferred by executor flow rather than emitted as durable policy
- recommendation duplicates tool-loop logic instead of converging on one shared helper boundary

### B) Tool-wrapper / artifact scripts

Representative scripts:

- `server/scripts/get-context/get-metadata.cjs`
- ffmpeg / ffprobe extraction paths inside `get-dialogue.cjs`, `get-music.cjs`, and `video-chunks.cjs`

Current deterministic behavior already present:

- these scripts often have deterministic operations only: invoke ffprobe/ffmpeg, parse JSON, write artifacts
- they sometimes capture durable raw evidence when `debug.captureRaw` is enabled

Current gaps:

- most failures still throw plain `Error(...)`
- known deterministic recoveries are not declared in code or docs
- no universal failure envelope currently records whether a retry, re-extract, or alternate-path repair exists
- the repo currently cannot tell from the durable result whether failure is terminal or just lacks implementation

### C) Computed / aggregation / rendering scripts

Representative scripts:

- `server/scripts/process/video-per-second.cjs`
- `server/scripts/report/summary.cjs`
- `server/scripts/report/final-report.cjs`
- `server/scripts/report/metrics.cjs`
- `server/scripts/report/emotional-analysis.cjs`

Current deterministic behavior already present:

- some scripts already encode graceful degradation inside success outputs
  - example: `video-per-second.cjs` excludes failed chunks and fills uncovered seconds with placeholder values
  - example: summary/report code supplies defaults like `No recommendation available`

Current gaps:

- this degraded behavior is not yet formalized under the universal success envelope
- hard failures still surface mostly as thrown errors
- there is no declared deterministic recovery policy for missing preconditions, rebuild-from-artifact flows, or unrecoverable dependency failures

### Audit conclusion

The repo is already using three recurring deterministic recovery styles:

1. **retry/failover** against ordered AI targets
2. **bounded local repair loops** for structured output
3. **deterministic recomputation / re-extraction** in non-AI lanes

What is missing is not the idea of recovery. What is missing is a shared declaration model and a durable failure-envelope representation.

---

## Core framework

### Design rule

Deterministic recovery is a **declared script capability**, not an emergent side effect of helper code.

Every meaningful script should define a deterministic recovery declaration, even if that declaration says the script has no deterministic recovery.

### Recovery declaration shape

A script declares its known deterministic recoveries in script-local code or script-family-local shared code using this conceptual shape:

```json
{
  "family": "ai.structured-output.v1",
  "knownStrategies": [
    {
      "id": "retry-same-target",
      "kind": "retry",
      "when": {
        "categories": ["provider_transport", "timeout", "invalid_output"],
        "codes": ["DIALOGUE_INVALID_JSON", "DIALOGUE_PROVIDER_EMPTY"]
      },
      "usesHelper": "executeWithTargets",
      "consumesAttempt": true,
      "terminalIfUnavailable": false
    },
    {
      "id": "failover-next-target",
      "kind": "retry",
      "when": {
        "categories": ["provider_transport", "invalid_output"]
      },
      "usesHelper": "executeWithTargets",
      "consumesAttempt": true,
      "terminalIfUnavailable": false
    },
    {
      "id": "repair-with-validator-tool-loop",
      "kind": "repair",
      "when": {
        "categories": ["invalid_output"]
      },
      "usesHelper": "executeLocalValidatorToolLoop",
      "consumesAttempt": true,
      "terminalIfUnavailable": false
    }
  ]
}
```

This is a **declaration model**, not yet a mandated source file format. During rollout, scripts may express it as:

- local constants
- builder functions
- script-family shared helper configuration
- durable docs if a lane family is still mid-migration

### Required declaration semantics

Each declared deterministic strategy must answer these questions:

| Field | Meaning |
| --- | --- |
| `id` | Stable strategy identifier emitted in `recoveryPolicy.deterministic.*` fields. |
| `kind` | `retry`, `repair`, `reroute`, `rebuild`, or another small stable label. |
| `when` | Script-local applicability rules based on category/code/diagnostics/preconditions. |
| `usesHelper` | Which shared helper or local executor performs it. |
| `consumesAttempt` | Whether this strategy burns deterministic budget. |
| `terminalIfUnavailable` | Whether lack of this strategy forces immediate fail/human-review. |

Rules:

- strategy IDs are stable within the script family
- strategy IDs are not global repo enums
- applicability can inspect script-local failure codes and diagnostics
- only bounded, auditable actions count as deterministic recovery
- open-ended model reasoning is **not** deterministic recovery; that belongs to AI recovery

---

## Script-family guidance for declarations

### Family 1: AI structured-output lanes

Typical known strategies:

- `retry-same-target`
- `failover-next-target`
- `retry-with-lower-thinking`
- `repair-with-validator-tool-loop`
- `retry-after-structured-repair-summary`

Expected shared helper use:

- `executeWithTargets(...)`
- `executeLocalValidatorToolLoop(...)`
- shared JSON parse / validation helpers

Important rule:

- the script still owns which failure codes allow which strategies
- the shared helper should not hardcode script-local policy beyond generic mechanics

### Family 2: Tool-wrapper / artifact lanes

Typical known strategies:

- `rerun-tool-once`
- `re-extract-artifact`
- `rebuild-temp-dir`
- `retry-after-path-normalization`

Expected shared helper use:

- shared subprocess wrappers
- shared raw-capture helpers
- shared file/path validation helpers

Important rule:

- only declare a strategy if the script can explain exactly why rerunning may deterministically change the result
- if a tool failure is truly terminal, declare no deterministic recovery and emit `eligible: false`

### Family 3: Computed / aggregation / rendering lanes

Typical known strategies:

- `recompute-from-upstream-artifacts`
- `reload-persisted-artifacts`
- `rebuild-derived-output`

Expected shared helper use:

- shared artifact-loading helpers
- shared envelope writers
- shared dependency/precondition diagnostics helpers

Important rule:

- degraded-but-usable recomputation remains `status: "success"`
- deterministic recovery only enters the picture when the script cannot produce a valid script-owned success payload

---

## Failure-envelope mapping

The universal failure envelope stays the durable runtime record.

Deterministic recovery must be represented inside `recoveryPolicy.deterministic` and `recoveryPolicy.nextAction`.

### Required deterministic block semantics

```json
{
  "eligible": true,
  "family": "ai.structured-output.v1",
  "strategyOrder": [
    "repair-with-validator-tool-loop",
    "retry-same-target",
    "failover-next-target"
  ],
  "attempted": [
    "repair-with-validator-tool-loop"
  ],
  "remaining": [
    "retry-same-target",
    "failover-next-target"
  ],
  "maxAttempts": 3,
  "attemptsUsed": 1
}
```

Interpretation:

- `family`: script-family recovery family, used for understanding helper expectations and rollout grouping
- `strategyOrder`: the ordered deterministic strategy list recognized for **this failure situation**, after filtering out strategies that do not apply
- `attempted`: ordered strategy IDs already consumed in this failure lineage
- `remaining`: ordered strategy IDs still available in this failure lineage
- `maxAttempts` / `attemptsUsed`: bounded deterministic budget for this failure lineage

### How `attempted` is tracked

`attempted` is not a historical dump of every low-level log event. It is the ordered list of deterministic strategies that were actually consumed for the current failure lineage.

Rules:

1. append a strategy ID when the system genuinely executed that strategy
2. do not append strategies that were merely considered
3. if a helper internally performs multiple low-level actions that are one declared strategy, record the declared strategy once
4. preserve order so downstream code can reconstruct what already happened

Examples:

- one `executeWithTargets(...)` same-target retry attempt may record `retry-same-target`
- failover to another target may record `failover-next-target`
- one bounded validator-tool repair loop may record `repair-with-validator-tool-loop`

### How `remaining` is computed

`remaining` is derived from the script's declared `knownStrategies`, filtered in this order:

1. keep only strategies whose `when` clause matches the current failure
2. remove strategies already present in `attempted`
3. remove strategies disallowed by current config, runtime state, or exhausted budget
4. preserve declared order

`remaining` therefore means: **what deterministic actions are still both known and currently legal**.

### Budget semantics

`maxAttempts` / `attemptsUsed` are about deterministic recovery budget, not total script runtime or raw provider call count.

Rules:

- they count declared recovery strategy consumption, not every internal helper step
- script families may map one strategy to multiple low-level operations
- the mapping must be stable and documented
- budgets must be bounded and small enough to keep failure review auditable

If a script needs more detailed telemetry, that belongs in diagnostics/events/raw artifacts, not in the top-level policy contract.

---

## Next-action determination

`recoveryPolicy.nextAction` is the orchestrator-facing decision output.

It must be derived **after** the failure is fully classified and the deterministic block is populated.

### Decision algorithm

Use this order:

1. **If the script actually succeeded**, emit a success envelope and stop. No next-action block is needed.
2. **If deterministic recovery is not eligible**, skip to AI recovery evaluation.
3. **If `remaining` contains at least one strategy and deterministic budget remains**, then:
   - `nextAction.policy = "deterministic_recovery"`
   - `nextAction.target = remaining[0]`
4. **Else if AI recovery is eligible and budget remains**, then:
   - `nextAction.policy = "ai_recovery"`
   - `nextAction.target = <script-owned AI recovery lane id or null>`
5. **Else if human intervention is required or configured**, then:
   - `nextAction.policy = "human_review"`
   - `nextAction.humanRequired = true`
6. **Else**:
   - `nextAction.policy = "fail"`
   - `nextAction.target = null`

### Decision ownership

The script owns the ingredients:

- failure code
- diagnostics
- deterministic declaration
- AI-recovery eligibility
- stop-the-pipeline expectations

Shared helpers may compute the generic selection logic, but they must use script-owned declarations and script-owned failure facts.

### `stopPipelineOnFailure`

`stopPipelineOnFailure` remains explicit because some later pipeline wrappers may support queueing a repair lane outside the main linear flow.

Default guidance:

- `true` for most hard script failures
- only `false` when the pipeline design explicitly supports continuing without this script's artifact

---

## Shared helpers vs script-local logic

This boundary matters. The repo should share mechanics, not erase script ownership.

### Shared helpers should own

1. **Envelope assembly primitives**
   - build success/failure envelope shells
   - normalize common `run` metadata
   - normalize `recoveryPolicy` shape

2. **Generic deterministic bookkeeping**
   - append strategy IDs to `attempted`
   - derive `remaining` from declaration + current state
   - compute `nextAction` from populated policy blocks
   - enforce budget ceilings

3. **Family-level execution mechanics**
   - target retry/failover mechanics in `executeWithTargets(...)`
   - validator-tool loop mechanics in `executeLocalValidatorToolLoop(...)`
   - generic subprocess retry wrappers if later introduced

4. **Generic diagnostics shaping**
   - parse / validation summaries
   - provider metadata extraction
   - raw-capture references
   - shared event emission

### Script-local logic should own

1. **Failure classification**
   - mapping local conditions to `failure.category`
   - choosing script-local `failure.code`
   - deciding what counts as degraded success vs hard failure

2. **Recovery declaration**
   - which strategies are known
   - which failure codes they apply to
   - whether a strategy is safe for this script

3. **Family-specific policy decisions**
   - whether parse-invalid is retryable
   - whether same-target retry is allowed before failover
   - whether a lower-thinking retry exists
   - whether deterministic recovery should be skipped entirely for some codes

4. **Payload ownership**
   - success payload schema
   - script-local failure diagnostics beyond shared minimums
   - any script-specific recovery context needed for later execution

### Boundary rule of thumb

If the logic depends on knowing what `RECOMMENDATION_INVALID_JSON` means versus what `VIDEO_CHUNK_SHAPE_INVALID` means, it is script-local.

If the logic only needs a declared strategy list, current attempted strategies, and a budget, it belongs in shared helpers.

---

## Recommended rollout model

### Step 1: make declarations explicit per family

Each migrated script should expose a small deterministic recovery declaration, even if it currently says:

```json
{
  "family": "tool.wrapper.v1",
  "knownStrategies": []
}
```

That is better than implicit behavior.

### Step 2: emit failure envelopes before orchestration relies on them

Recovery should not be orchestrated from thrown errors alone. A script must emit the universal failure envelope first.

### Step 3: converge duplicate mechanics into helpers

Current priority convergence points:

- align `recommendation.cjs` with `executeLocalValidatorToolLoop(...)`
- share deterministic policy bookkeeping across AI lanes instead of open-coding it per script
- later add helper(s) for deterministic non-AI tool-wrapper retries only if more than one lane truly needs them

### Step 4: lift the same family to pipeline aggregation

The pipeline wrapper should summarize child script envelopes using the same policy vocabulary rather than inventing a second recovery language.

---

## Minimal examples by family

### AI lane failure example

```json
{
  "failure": {
    "category": "invalid_output",
    "code": "RECOMMENDATION_INVALID_JSON",
    "retryable": true
  },
  "recoveryPolicy": {
    "deterministic": {
      "eligible": true,
      "family": "ai.structured-output.v1",
      "strategyOrder": [
        "repair-with-validator-tool-loop",
        "failover-next-target"
      ],
      "attempted": ["repair-with-validator-tool-loop"],
      "remaining": ["failover-next-target"],
      "maxAttempts": 2,
      "attemptsUsed": 1
    },
    "aiRecovery": {
      "eligible": true,
      "attemptsRemaining": 1
    },
    "nextAction": {
      "policy": "deterministic_recovery",
      "target": "failover-next-target",
      "humanRequired": false,
      "stopPipelineOnFailure": true
    }
  }
}
```

### Tool-wrapper failure example

```json
{
  "failure": {
    "category": "tool",
    "code": "METADATA_FFPROBE_FAILED",
    "retryable": false
  },
  "recoveryPolicy": {
    "deterministic": {
      "eligible": false,
      "family": "tool.wrapper.v1",
      "strategyOrder": [],
      "attempted": [],
      "remaining": [],
      "maxAttempts": 0,
      "attemptsUsed": 0
    },
    "aiRecovery": {
      "eligible": false,
      "attemptsRemaining": 0
    },
    "nextAction": {
      "policy": "fail",
      "target": null,
      "humanRequired": false,
      "stopPipelineOnFailure": true
    }
  }
}
```

### Computed lane degraded success reminder

If `video-per-second.cjs` can validly exclude failed chunks and still produce a downstream-safe artifact, that outcome remains a success envelope, not deterministic recovery.

---

## Remaining open questions

These are narrower than the earlier architecture questions and can be handled by later rollout beads.

1. **Declaration storage format**
   - whether declarations should live as exported JS constants, adjacent JSON, or family helper builders

2. **Attempt lineage granularity**
   - whether later beads need optional per-strategy attempt detail in diagnostics beyond `attempted`

3. **Pipeline aggregation detail**
   - whether parent pipeline envelopes should expose only the next actionable child recovery or also summarize all blocked child recoveries

---

## Bottom line

The deterministic recovery framework for emotion-engine is:

- scripts declare their own bounded known deterministic recoveries
- those declarations remain script-local, even when helpers execute the mechanics
- failure envelopes record ordered `attempted` and `remaining` deterministic strategies
- `nextAction` is chosen from that explicit policy state, not from prose logs or thrown-error guesswork
- shared helpers own bookkeeping and execution mechanics
- scripts own failure codes, applicability rules, and payload semantics

That gives later rollout beads a concrete contract for migration without violating the repo's earlier decisions.