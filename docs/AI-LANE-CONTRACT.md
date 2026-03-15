# AI lane schema / validator contract

**Status:** Active  
**Established:** 2026-03-13

---

## Purpose

This document defines the universal output contract for every **AI lane** in emotion-engine that expects machine-readable output.

For the broader cross-family script envelope contract used by AI lanes, computed lanes, and tool-wrapper lanes, see `docs/UNIVERSAL-SCRIPT-RESULT-CONTRACT.md`.

A lane may have a different response shape, prompt, model, and validation details, but all lanes must follow the same top-level discipline:

1. expect **JSON-only** model output
2. validate against a **lane-specific schema**
3. emit **shared diagnostics** when parse/validation fails
4. use a deterministic **retry / repair** policy
5. persist **raw capture** for debugging when `debug.captureRaw: true`
6. document the lane well enough that a future audit can tell whether it conforms

This contract exists so new lanes do not invent their own half-compatible parsing rules.

---

## Scope

An **AI lane** is any script or helper that sends a prompt to a model and expects structured output back.

In this repo, the meaningful current lanes are:

- Phase 1 dialogue transcription
- Phase 1 dialogue chunk transcription
- Phase 1 dialogue stitch
- Phase 1 music analysis
- Phase 2 video chunk emotion analysis
- Phase 3 recommendation

Non-AI scripts like ffprobe metadata extraction or purely computed report scripts are out of scope.

---

## Universal requirements

> **Hard rule:** Every meaningful AI lane must use a lane-specific validator tool before final acceptance. JSON-only prompting and post-response schema validation are necessary but not sufficient on their own.

### 1) JSON-only is mandatory

Every structured AI lane must instruct the model to return **JSON only**.

Required properties of the prompt contract:

- explicitly say `Return JSON only` / `Respond ONLY with valid JSON`
- forbid markdown fences, commentary, and mixed prose
- show or describe the expected object shape
- make the lane's acceptance target obvious to the model

The parser may attempt limited local recovery for common wrapper mistakes (for example fenced JSON, extra prose around one object, trailing commas, quoted JSON strings), but that recovery is a convenience layer, **not** the contract itself.

**Rule:** the expected artifact is always a JSON object, never freeform text with best-effort extraction.

---

### 2) Every lane needs its own schema validator

There is no single universal schema for all AI lanes. Each lane must define a **lane-specific validator** matching its own output contract.

Examples:

- dialogue transcription needs `dialogue_segments`, `summary`, `totalDuration`, optional/required handoff fields
- dialogue stitch needs `cleanedTranscript`, `auditTrail`, `debug`
- music analysis needs `analysis.type`, `analysis.description`, `analysis.intensity`, optional rolling summary
- video emotion analysis needs `summary`, `dominant_emotion`, `confidence`, and one entry per configured lens
- recommendation needs `text`, `reasoning`, `confidence`, `keyFindings`, `suggestions`

Allowed implementations:

- direct validator function in code
- validator helper wrapping shared parsing
- validator tool contract plus local execution

Not allowed:

- accepting arbitrary objects and hoping downstream consumers survive
- treating prompt text alone as the schema
- silently coercing missing required fields into success

---

### 3) Shared parse / validation diagnostics are mandatory

Every lane must use shared parse/validation behavior or produce equivalent diagnostics.

Minimum diagnostics on failure:

- `group`: parse / validation / tool_loop / equivalent failure stage
- `raw`: original model output when available
- `extracted`: repaired / extracted candidate JSON when available
- `parseError`: JSON parse error when relevant
- `validationErrors`: structured list of field/path failures when relevant
- `validationSummary`: short human-readable summary suitable for retry prompts and logs

Preferred implementation:

- use `server/lib/json-validator.cjs` for JSON-object parsing and light repair
- use `server/lib/structured-output.cjs` or lane-specific validator helpers for schema checks
- wrap failures as retryable invalid-output errors through the consolidated target/retry path

The exact object shape may vary slightly by lane, but these semantics must remain consistent.

---

### 4) Raw capture is required when debugging is enabled

When `debug.captureRaw: true`, each lane must persist enough information to reconstruct what happened at the provider boundary and at the validator boundary.

Minimum attempt capture expectations:

- lane / attempt identity
- provider / model / target metadata
- prompt reference (`promptRef`) when prompts are persisted
- raw response content or provider response envelope
- parsed or normalized structured result when available
- validation / parse failure details when present
- failover / retry context when present

Recommendation-lane provider request/response capture is the strongest current pattern and should be treated as the gold standard for high-value structured lanes.

**Rule:** if a lane can fail because of malformed structured output, its debug capture must preserve the evidence needed to explain that failure.

---

### 5) Retry / repair behavior is required

Every structured lane must define what happens when the model returns invalid output.

Minimum behavior:

- invalid JSON or schema-invalid JSON is treated as **invalid_output**
- invalid output flows into the lane's retry path through `executeWithTargets(...)` or equivalent
- retry decisions are deterministic and documented
- final failure preserves parse/validation diagnostics in persisted artifacts/events

Valid repair styles:

#### A. Direct schema validation with retry (internal helper only)

Use this as an internal building block inside a stricter lane, not as the final acceptance architecture for a meaningful AI lane.

Flow:

1. ask for JSON-only output
2. parse JSON with shared parser
3. validate with lane-specific schema
4. route the candidate through the lane's local validator tool before final acceptance
5. if invalid, return a validation summary and retry/fail over

Direct schema validation is still useful as the underlying deterministic validator, but it is no longer sufficient as the final acceptance path by itself.

#### B. Tool-mediated validation / repair loop

Use when the model must iteratively validate a candidate against a local contract before returning the final artifact.

Flow:

1. give the model a local validator-tool contract
2. allow the model to submit candidate JSON to the validator tool
3. return validator errors into the prompt loop
4. accept final output only after validator success and final-artifact revalidation

This is stricter than direct schema validation and is currently the right pattern for recommendation-style high-value outputs.

---

### 6) Documentation is part of the contract

Every AI lane must be documentable in durable repo docs and understandable in code review.

At minimum, repo docs or lane-family docs must make these things discoverable:

- what the lane is supposed to return
- whether direct schema validation or tool-mediated validation is used
- where the validator lives
- what raw artifacts are expected when `debug.captureRaw` is enabled
- what retry / repair policy applies

A lane is not fully compliant if the implementation is strict but the contract is invisible to future maintainers.

### Cross-repo prompt-contract wording standard

Use these exact wording rules anywhere this repo family documents or prompts a meaningful AI lane. This is the canonical wording standard for `emotion-engine` and downstream sibling surfaces.

#### 1) Option B enum documentation

Use **Option B throughout** for closed string fields:

- keep example JSON concrete
- do **not** place pipe-placeholder enums such as `"foo|bar|baz"` inside example JSON
- for every closed enum-like string field, add an explicit nearby allowed-values note

Mechanical wording template:

- `Allowed values for <jsonPath>: <value1> | <value2> | <value3>.`

Preferred pattern:

```json
{
  "decision": {
    "outcome": "reenter_script"
  }
}
```

Allowed-values note placed immediately below or beside the example:

- `Allowed values for decision.outcome: reenter_script | hard_fail | human_review | no_change_fail.`

#### 2) Validator-tool usage wording

When a lane requires validator-tool mediation, use this exact acceptance wording:

- `You have access to one local validation tool.`
- `You may respond with exactly one JSON object in one of these forms:`
- `If you call the tool, use exactly this minimal envelope: <canonicalEnvelope>.`
- `The final <artifactLabel> JSON is accepted only after <toolName> returns {"valid": true}.`
- `After the validator returns valid=true, return ONLY the final <artifactLabel> JSON object with no wrapper.`

If the lane requires an explicit tool call before any final artifact is accepted, add this exact line:

- `You must call <toolName> at least once before any final <artifactLabel> JSON can be accepted.`

#### 3) Canonical tool-envelope wording

Whenever the prompt shows the validator-tool call shape, describe it as the **canonical minimal envelope** and show the exact JSON object:

- `Canonical tool call envelope:`
- `<canonicalEnvelope rendered as JSON>`

Use the real lane key in the envelope (`transcription`, `stitch`, `musicAnalysis`, `emotionAnalysis`, `recommendation`, `recoveryDecision`, etc.). Do not document alias envelope shapes as alternatives.

#### 4) Wrapper-key prohibition wording

Use this exact prohibition sentence in validator-tool prompts unless a lane has an even stricter lane-local addition:

- `Do not add type/toolName/arguments/args/input wrappers around the tool call.`

This wording is the shared baseline. If a lane also rejects other alias keys in parsing, keep the prompt wording additive rather than replacing this baseline sentence.

#### 5) Final acceptance after validator success wording

Use the same acceptance sequence everywhere:

1. validator-tool usage is the only pre-acceptance validation path
2. validator success means the tool returned `{"valid": true}`
3. only after that success may the model return the bare final artifact JSON
4. the final accepted artifact is the bare artifact object, never the tool envelope

Mechanical wording pair:

- `The final <artifactLabel> JSON is accepted only after <toolName> returns {"valid": true}.`
- `After the validator returns valid=true, return ONLY the final <artifactLabel> JSON object with no wrapper.`

---

## Enforcement levels

Use these levels as **audit labels**, not as a menu of equally acceptable end states for meaningful AI lanes. Under this contract, meaningful AI lanes are expected to end at **Level 3**; Level 0-2 describe weaker or transitional states that may still appear in historical audits.

### Level 0 — Weak / freeform

- prompt asks for structure but there is no reliable schema gate
- freeform or placeholder output can slip through
- failures are not consistently represented as parse/validation diagnostics

### Level 1 — JSON prompt only

- prompt strongly asks for JSON-only output
- parsing may exist
- no reliable lane-specific schema gate, or only ad hoc fallback logic

### Level 2 — Direct schema validation with retry

- JSON-only prompt
- lane-specific validator
- invalid output becomes retryable failure
- raw capture and validation diagnostics exist or are substantially present
- no local validator tool loop

### Level 3 — Tool-mediated validation / repair loop

- includes all Level 2 requirements
- model must satisfy a local validator-tool contract before final acceptance
- tool loop state / validator calls / final revalidation are captured

---

## When direct schema validation can remain an internal helper

Direct schema validation remains the right **local implementation primitive** when **all** of the following are true:

- the lane has a deterministic validator for one final JSON artifact
- the validator can accept/reject that artifact in one pass
- the same validator can be wrapped behind a lane-specific validator tool
- retry instructions can still be expressed through structured validator feedback

What changed in this contract:

- direct schema validation is still encouraged as the local truth source
- but it is **not** sufficient as the final acceptance gate for a meaningful AI lane
- the final acceptance path must still pass through the lane-specific validator tool

---

## When tool-mediated validation is required

Tool-mediated validation is required when **one or more** of these are true:

- acceptance depends on the model successfully consulting a local validator before final submission
- the output is high-value enough that a single invalid but plausible JSON object is too risky to accept on first parse
- the lane has shown repeated malformed-envelope / near-miss behavior where ordinary retries are too lossy
- the lane benefits from an explicit inner loop of `candidate -> validator feedback -> revised candidate -> final artifact`
- the final output should only be accepted after the same local validator has already said `valid: true`

Current examples in emotion-engine:

- dialogue transcription
- dialogue stitch
- music analysis
- video chunk emotion analysis
- recommendation

Future lanes with complex nested report contracts or expensive downstream side effects should start in this stricter mode, with direct schema validation reused underneath as the local validator implementation.

---

## Audit of current emotion-engine lanes

| Lane | Current implementation | Enforcement level | Contract status | Notes |
| --- | --- | --- | --- | --- |
| Phase 1 dialogue transcription (whole-file + chunk transcription path) | `get-dialogue.cjs` + `phase1-validator-tools.cjs` + `local-validator-tool-loop.cjs` + `validateDialogueTranscriptionObject` | Level 3 | Compliant | Prompted through a validator-tool loop and accepted only after the lane-specific validator-tool path succeeds; shared schema validation remains the deterministic local validator underneath. |
| Phase 1 dialogue stitch | `get-dialogue.cjs` + `phase1-validator-tools.cjs` + `local-validator-tool-loop.cjs` + `validateDialogueStitchObject` | Level 3 | Compliant | Chunk stitch output now uses the same validator-tool discipline rather than plain direct-schema acceptance. |
| Phase 1 music analysis | `get-music.cjs` + `phase1-validator-tools.cjs` + `local-validator-tool-loop.cjs` + `validateMusicAnalysisObject` | Level 3 | Compliant | Legacy direct-schema-only acceptance was replaced with a mandatory validator-tool path; the prompt now requires the strict `analysis` envelope. |
| Phase 2 video chunk emotion analysis | `video-chunks.cjs` + `emotion-lenses-tool.cjs` + `local-validator-tool-loop.cjs` + `validateEmotionStateObject` | Level 3 | Compliant | The main Phase 2 acceptance path now runs through a lane-specific `validate_emotion_analysis_json` validator-tool contract, records tool-loop state in raw capture, and only accepts the final chunk artifact after validator-mediated revalidation succeeds. |
| Phase 3 recommendation | `recommendation.cjs` + recommendation validator + validator tool loop | Level 3 | Compliant | This remains the reference implementation and the strongest current model for validator-tool mediation plus final-artifact revalidation. |

### Audit summary

- **Compliant:** dialogue transcription, dialogue stitch, music, video chunk emotion analysis, recommendation
- **Phase 3/report family boundary:** `server/scripts/report/recommendation.cjs` is the only meaningful **AI lane** in the current Phase 3 family. `metrics.cjs`, `emotional-analysis.cjs`, `summary.cjs`, and `final-report.cjs` are computed/aggregation/report-formatting scripts and therefore remain out of scope for validator-tool mediation.
- **Follow-up needed:** none in the current meaningful lane set

There are also **legacy weaker parser helpers** still present in some files (for example older best-effort JSON parsing helpers in `get-music.cjs` / `get-dialogue.cjs`). They are not the active contract path for the main structured lanes and should not be used as a model for new work.

---

## Implementation guidance for future lanes

When adding or refactoring a structured AI lane:

1. define the lane-specific output shape first
2. define the lane-specific validator and wrap it behind a lane-specific validator tool
3. ship the lane with **Level 3** final acceptance from day one unless the lane is explicitly experimental and not part of the meaningful production lane set
4. use shared JSON parsing / repair helpers underneath that validator-tool path
5. return structured validation diagnostics on failure
6. capture raw request/response evidence when debug capture is enabled
7. add or update durable docs so the lane can be audited later

If a new meaningful AI lane cannot be clearly described as a Level 3 validator-tool-mediated lane, it is underspecified for this repo's contract.

---

## Rollout implications

This contract defines the target state for the remaining rollout beads:

- Phase 1 bead: move dialogue/music/stitch from **partial Level 2** to **compliant Level 3**
- Phase 2 bead: completed — video emotion analysis now runs as a **compliant Level 3** validator-tool lane
- Phase 3 family bead: keep recommendation as the reference implementation and align any future report-style AI lanes to this contract
- sibling-repo bead: apply the same contract outside emotion-engine
- final sweep bead: confirm no remaining AI call sites bypass the validator-tool acceptance contract
