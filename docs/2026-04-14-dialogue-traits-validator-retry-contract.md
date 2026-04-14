# Dialogue `traits` Validator and Retry Contract

**Date:** 2026-04-14  
**Status:** Proposed design / implementation-ready spec  
**Scope:** Phase 1 dialogue generation validation for closed per-line `traits`

---

## Goal

Define the validation and retry contract for invalid `traits` values in the dialogue phase.

This doc is the follow-on to:

- `.plans/2026-04-13-pivot-dialogue-traits-and-deterministic-speaker-grouping.md`
- `docs/2026-04-14-dialogue-line-traits-contract.md`
- `server/scripts/get-context/get-dialogue.cjs`

The contract here keeps the pivot intact:

- **closed schema**
- **loud invalid-value handling**
- **no silent coercion**
- **no model-side weighting**
- **deterministic downstream ownership of grouping / speaker identity**

---

## Summary of the contract

When the dialogue model emits invalid `traits`, the system should:

1. **reject the candidate loudly** during local validation
2. **classify the failure** as either parse / schema / semantic validation failure
3. **generate a bounded retry payload** that names the exact invalid paths, received values, and allowed values
4. **retry within the existing validator-tool loop** using repair instructions that preserve the original task and schema
5. **persist full failure details durably** so debugging does not depend on ephemeral logs or prompt memory
6. **hard-fail with `invalid_output`** if retries are exhausted

The validator must **not**:

- silently map legacy values to new enums
- silently drop legacy fields
- guess which trait the model "probably meant"
- ask the model to rank, weight, or prioritize traits
- let open vocabulary back into the contract via repair prompts

---

## Relationship to the current dialogue lane

`server/scripts/get-context/get-dialogue.cjs` already has the right high-level retry structure:

- local validator-tool loop
- `invalid_output` retryable failures
- `validationErrors` + `validationSummary`
- durable raw attempt capture
- bounded AI recovery addenda

This design does **not** require a new recovery architecture.

It requires the dialogue transcription validator contract to pivot from the old speaker-oriented shape to the new line-oriented `traits` shape, then to classify and report `traits` failures precisely.

---

## Required target shape for validation

Per `docs/2026-04-14-dialogue-line-traits-contract.md`, the persisted traits-mode `dialogue-data.json` artifact should validate against this top-level shape:

```json
{
  "schema_version": 1,
  "contract": {
    "artifact": "dialogue-data",
    "mode": "traits",
    "traits_contract_version": "1.0.0"
  },
  "dialogue_segments": [
    {
      "index": 0,
      "start": 0.0,
      "end": 5.0,
      "text": "They want you afraid.",
      "traits": {
        "audibility": "clear",
        "overlap": "single_voice",
        "gender_presentation": "feminine",
        "age_impression": "adult",
        "pitch_band": "mid",
        "phonation": "clear",
        "pace": "measured",
        "energy": "steady",
        "channel_texture": "clean",
        "accent_strength": "none_apparent"
      }
    }
  ]
}
```

Optional top-level `summary` and `handoffContext` may be present when emitted by the dialogue lane, but the validator should treat `schema_version`, `contract`, `contract.traits_contract_version`, and `dialogue_segments` as the required persisted-artifact envelope. Within that envelope, the `traits` object is **required and closed** for every segment.

---

## Validation stages

Validation should happen in this order:

### 1. Parse validation

Reject output that is not valid JSON or not a top-level object.

This remains the existing `parse` / `invalid_output` class.

### 2. Schema validation

Validate the candidate against the exact required structural contract.

This includes:

- top-level shape
- required top-level fields: `schema_version`, `contract`, `dialogue_segments`
- required top-level contract fields: `contract.artifact`, `contract.mode`, `contract.traits_contract_version`
- `dialogue_segments` array shape
- allowed segment keys
- `traits` object presence
- required trait keys
- no extra trait keys
- type checking
- enum membership
- deprecated legacy field rejection

### 3. Semantic validation

Validate cross-field meaning rules that are still deterministic and closed.

These are **not** fuzzy heuristics. They are explicit contract checks over already-valid enum tokens.

### 4. Suspicion / warning checks

Keep a separate non-failing warning lane for combinations that may be odd but are still contract-legal.

Warnings must never mutate output and must never become hidden coercions.

---

## Schema-invalid vs semantically invalid

## Schema-invalid

A candidate is **schema-invalid** when its structure or token inventory breaks the contract.

These are hard failures.

### Hard schema-invalid cases

#### A. Missing or malformed `traits`

- `traits` missing
- `traits` is not an object
- `traits` is `null`
- `traits` is an array

#### B. Missing required trait keys

Any missing required key is invalid:

- `audibility`
- `overlap`
- `gender_presentation`
- `age_impression`
- `pitch_band`
- `phonation`
- `pace`
- `energy`
- `channel_texture`
- `accent_strength`

#### C. Extra keys inside `traits`

Any key not listed above is invalid.

Examples:

- `role`
- `presentation`
- `accent`
- `gender`
- `confidence`
- `weight`
- `notes`

#### D. Wrong types

Invalid examples:

- enum field is number / boolean / null / array / object
- `text` is empty or non-string
- `index` is missing or non-numeric
- `start` / `end` are non-numeric when present

#### E. Invalid enum tokens

Any value outside the field's allowed closed set is invalid.

Examples:

- `"gender_presentation": "female"`
- `"age_impression": "middle_aged"`
- `"pitch_band": "mid-range"`
- `"channel_texture": "megaphone"`
- `"accent_strength": "midwestern"`

#### F. Deprecated legacy line fields present

These fields are invalid in the pivoted line schema:

- `speaker`
- `speaker_id`
- `confidence`

If they appear on a line object, validation should fail even if `traits` is otherwise valid.

#### G. Missing required top-level persisted-artifact envelope fields

In strict pivot mode, these are invalid:

- missing top-level `schema_version`
- missing top-level `contract`
- missing `contract.artifact`
- missing `contract.mode`
- missing `contract.traits_contract_version`
- `contract.artifact` not equal to `dialogue-data`
- `contract.mode` not equal to `traits`

This locks the persisted `dialogue-data.json` envelope so downstream readers do not have to guess which traits contract revision they are consuming.

#### H. Deprecated or legacy top-level structures present in strict pivot mode

In strict pivot mode, these are invalid:

- top-level `speaker_profiles`
- top-level `speakerProfiles`

This keeps ownership boundaries clean: the dialogue phase produces lines plus traits, not speaker identity structure.

---

## Semantically invalid

A candidate is **semantically invalid** when it uses valid enum tokens in a way that violates the contract's explicit meaning rules.

These are also hard failures, but they should use semantic-specific error codes so debugging is honest.

### Hard semantic-invalid cases

#### 1. `gender_presentation: mixed` with `overlap: single_voice`

`mixed` for `gender_presentation` in this contract means the retained line genuinely contains blended/conflicting presentation cues in one retained line.

With `single_voice`, that meaning becomes contradictory.

This should fail as a semantic contradiction.

#### 2. Field-specific sentinel misuse

These are semantic, not enum-shape, failures when the token exists in the overall vocabulary but is illegal for that field meaning.

Examples:

- using `mixed` on a field that does not allow `mixed`
- using `variable` on a field that does not allow `variable`

If implemented as field-specific enums, these may also surface as schema-invalid. Either way is acceptable internally, but the surfaced error should say the problem is **field-specific token misuse**.

#### 3. Deprecated synonym use that was pre-normalized upstream

If any upstream parsing layer ever converts a legacy synonym into a string token before validation, the validator must still fail rather than treating it as normalized.

Examples:

- `female` intended to mean `feminine`
- `male` intended to mean `masculine`
- `unclear` intended to mean `unknown`

This is semantically invalid because the candidate is trying to smuggle open vocabulary back into the closed contract.

---

## Warnings only, not hard failures

Some combinations may be suspicious but should **not** fail automatically.

Examples:

- `audibility: heavily_masked` with many non-`unknown` fields
- `overlap: competing_overlap` with highly specific traits
- `accent_strength: mixed` with `overlap: single_voice`
- `phonation: mixed` with `overlap: single_voice`

These should emit warnings only if the implementation wants extra observability.

Reason: the pivot explicitly prefers coarse capture plus downstream determinism. Over-aggressive semantic policing would create retry churn without clearly improving artifact quality.

---

## Error code contract

Every validation failure should produce structured issues using stable codes.

Recommended codes:

| Code | Meaning |
| --- | --- |
| `invalid_json` | Response was not valid JSON |
| `invalid_type` | Field had wrong JSON type |
| `required_field_missing` | Required field absent |
| `unexpected_field` | Extra field present |
| `invalid_enum_value` | Value not in allowed enum set |
| `deprecated_field_present` | Legacy field present in strict pivot mode |
| `invalid_range` | Numeric range error such as `end <= start` |
| `semantic_conflict` | Cross-field contradiction |
| `empty_string_not_allowed` | Required string was empty |
| `tool_call_limit_exceeded` | Existing validator-tool loop ceiling was exceeded |
| `tool_loop_exhausted` | Existing validator-tool loop ended without valid output |

Recommended per-issue shape:

```json
{
  "path": "$.dialogue_segments[3].traits.gender_presentation",
  "code": "invalid_enum_value",
  "message": "gender_presentation must be one of: feminine, masculine, androgynous, mixed, unknown.",
  "received": "female",
  "allowed": ["feminine", "masculine", "androgynous", "mixed", "unknown"],
  "segmentIndex": 3,
  "lineText": "They want you afraid."
}
```

Notes:

- `received`, `allowed`, `segmentIndex`, and `lineText` are optional but strongly recommended.
- `lineText` should be clipped if needed for log hygiene.
- Never include speculative fixups such as `suggestedValue` that could be mistaken for silent coercion.

---

## Failure surfacing contract

## Inside the local validator-tool loop

When a candidate fails validation, the dialogue lane should continue using the existing local validator-tool loop semantics:

- validator returns `valid: false`
- validator returns `summary`
- validator returns `errors[]`
- repair prompt is built from those errors
- model retries with the same task and schema

This remains a **same-attempt repair**, not a new business-level dialogue attempt.

## At script error level

If the tool loop is exhausted or the provider attempt ends invalid, the script should surface a retryable error with:

- message prefix: `invalid_output:`
- group: `parse`, `validation`, or `tool_loop`
- full `validationErrors`
- full `validationSummary`
- full tool-loop history already captured by the current machinery

This keeps it aligned with `createRetryableError(...)` and the current `get-dialogue.cjs` flow.

## Fatal phase surface

If all retry budget is exhausted, the phase should fail loudly as `invalid_output`.

It must not:

- downgrade to success
- emit partial normalized traits output
- silently remove invalid segments
- fall back to legacy `speaker_id` generation

---

## Retry payload contract

The retry path should use a **machine-readable repair payload** plus a **bounded prompt rendering**.

The machine-readable payload is the durable source of truth. The prompt rendering is a clipped, human/model-readable projection.

## Machine-readable retry payload shape

Recommended shape:

```json
{
  "kind": "dialogue_traits_validation_failure",
  "schemaVersion": 1,
  "domain": "dialogue",
  "artifact": "dialogue_transcription",
  "retryable": true,
  "failureClass": "schema",
  "summary": "Traits validation failed for 2 dialogue segments.",
  "issueCounts": {
    "total": 3,
    "schema": 2,
    "semantic": 1,
    "warnings": 0
  },
  "issues": [
    {
      "path": "$.dialogue_segments[3].traits.gender_presentation",
      "code": "invalid_enum_value",
      "message": "gender_presentation must be one of: feminine, masculine, androgynous, mixed, unknown.",
      "received": "female",
      "allowed": ["feminine", "masculine", "androgynous", "mixed", "unknown"],
      "segmentIndex": 3,
      "lineText": "They want you afraid."
    },
    {
      "path": "$.dialogue_segments[3].speaker_id",
      "code": "deprecated_field_present",
      "message": "speaker_id is not allowed in pivoted dialogue line output.",
      "received": "spk_001",
      "segmentIndex": 3,
      "lineText": "They want you afraid."
    }
  ],
  "repairInstructions": [
    "Return JSON only with the required schema.",
    "Keep the same dialogue text and chronology unless a field itself is invalid.",
    "Use only allowed traits keys and allowed enum values.",
    "Do not output speaker, speaker_id, confidence, speaker_profiles, notes, weights, or confidence fields.",
    "Use unknown rather than guessing.",
    "Do not invent synonyms or free-text trait labels."
  ],
  "context": {
    "promptMode": "lean_repair",
    "attempt": 1,
    "turn": 2,
    "maxTurns": 4,
    "validatorTool": "validate_dialogue_transcription_json"
  }
}
```

## Rendered retry message shape

The rendered retry text given back to the dialogue model should stay short and mechanical.

Recommended rendering:

```text
LOCAL VALIDATION REPAIR:
- Return JSON only with the same required schema.
- Keep the same task and domain assumptions; fix only the invalid output behavior.
- Do not wrap the JSON in a tool call envelope, markdown fence, or explanation.

Fix these issues:
- Traits validation failed for 2 dialogue segments.
- $.dialogue_segments[3].traits.gender_presentation: gender_presentation must be one of: feminine, masculine, androgynous, mixed, unknown.
- $.dialogue_segments[3].speaker_id: speaker_id is not allowed in pivoted dialogue line output.

Additional repair instructions:
- Use only allowed traits keys and enum values.
- Use unknown rather than guessing.
- Do not emit speaker, speaker_id, confidence, or speaker_profiles.
```

## Retry payload rules

### 1. Full details durable, clipped details in-prompt

- Persist the **full** `issues[]` list durably.
- Render only the top few issues in the retry prompt.
- Default clipping target: first **3** unique actionable issues, matching current repair-addendum behavior.

### 2. No suggested coercions

Do **not** tell the model:

- `female -> feminine`
- `mid-range -> mid`
- `just remove this field`

Instead tell it the contract and allowed values. The model must repair the output, not the runtime.

### 3. Preserve task scope

The retry payload must say, in effect:

- keep the same transcription task
- keep the same dialogue text unless text fields themselves were invalid
- fix only the invalid output behavior

This aligns with `buildRecoveryPromptAddendum(...)` and `buildLocalValidationRepairPromptAddendum(...)`.

### 4. No weighting language

The retry payload must not say things like:

- "focus more on gender than accent"
- "prioritize overlap and energy"
- "speaker grouping depends mostly on X"

That would leak deterministic grouping policy back into the model.

---

## Durable artifacts and logging contract

Debugging must not depend on reproducing the provider output live. Every traits validation failure should leave durable traces.

## Required durable artifacts

### 1. Attempt capture stays the primary record

Continue using the existing attempt-scoped raw capture under:

- whole asset: `raw/ai/dialogue-transcription/attempt-XX/capture.json`
- chunked: `raw/ai/dialogue-chunks/chunk-XXXX/attempt-XX/capture.json`

Each capture should include the existing:

- `rawResponse`
- `parsed`
- `toolLoop`
- `validationSummary`
- `validationErrors`

### 2. Add a dedicated `traitsValidation` block inside attempt capture

Recommended shape:

```json
{
  "traitsValidation": {
    "schemaVersion": 1,
    "contractRef": "docs/2026-04-14-dialogue-line-traits-contract.md",
    "validatorRef": "docs/2026-04-14-dialogue-traits-validator-retry-contract.md",
    "failureClass": "schema",
    "issueCounts": {
      "total": 3,
      "schema": 2,
      "semantic": 1,
      "warnings": 0
    },
    "issues": [],
    "repairPayloadRef": "raw/ai/dialogue-transcription/attempt-01/traits-repair-payload.json"
  }
}
```

This avoids burying traits-specific debugging inside a generic `validationErrors` bag.

### 3. Persist the repair payload itself

When a retry is triggered, write the machine-readable retry payload to a sibling file:

- whole asset: `raw/ai/dialogue-transcription/attempt-XX/traits-repair-payload.json`
- chunked: `raw/ai/dialogue-chunks/chunk-XXXX/attempt-XX/traits-repair-payload.json`

### 4. Persist a phase-level summary for quick triage

Recommended summary artifact:

- `raw/ai/dialogue-traits-validation-summary.json`

Suggested contents:

- attempts with traits failures
- counts by code
- counts by segment path
- whether failures were whole-asset or chunked
- whether final run succeeded after repair or failed terminally

This summary is for triage only. Attempt captures remain the source of truth.

---

## Event logging contract

Recommended additional timeline events:

- `dialogue.traits.validation_failed`
- `dialogue.traits.retry_issued`
- `dialogue.traits.validation_recovered`
- `dialogue.traits.validation_terminal`

Suggested payload fields:

- `attempt`
- `attemptInTarget`
- `chunkIndex` when applicable
- `failureClass`
- `issueCount`
- `issueCodes`
- `topPaths`
- `provider`
- `model`

These events should summarize, not duplicate entire raw payloads.

---

## Rollout guidance for deprecated legacy fields

The pivot introduces a compatibility problem: current `get-dialogue.cjs` and `structured-output.cjs` still expect legacy speaker-oriented fields.

That rollout should be handled explicitly.

## Rule: no silent migration on model output

When validating model output for the pivoted dialogue phase:

- do **not** silently transform legacy line fields into traits
- do **not** silently ignore `speaker_profiles`
- do **not** silently backfill missing traits from old inferred-traits structures

If the model returns legacy fields, fail loudly and retry.

## Recommended rollout phases

### Phase A — dual-code preparation, strict model-output failure

Implement the new validator and prompt in parallel with existing legacy code paths if needed, but for the new pivoted dialogue output:

- legacy fields on **model output** are immediate validation failures
- retry message explicitly says those fields are not allowed

This is the preferred default.

### Phase B — optional consumer-side compatibility projection

If downstream consumers temporarily still need old shapes, generate those only in a **separate deterministic compatibility adapter**, never in the model output contract.

That adapter may project or derive compatibility structures for short-lived migration use, but:

- it must be deterministic
- it must be clearly marked deprecated
- it must not change what the model is asked to emit
- it must not relax the validator

### Phase C — remove compatibility projection

Once downstream consumers are updated, remove the compatibility adapter and keep only the pivoted contract.

---

## Recommended implementation behavior in `get-dialogue.cjs`

This section is intentionally implementation-ready but still non-code.

### 1. Replace the dialogue validator contract example and description

The `buildDialogueTranscriptionValidatorToolContract(...)` contract text should be rewritten so the model sees the pivoted line shape, not the legacy speaker-profile shape.

### 2. Replace `validateDialogueTranscriptionObject(...)`

That validator should move from speaker/profile validation to:

- top-level dialogue artifact validation
- segment validation with required `traits`
- strict trait key + enum validation
- legacy field rejection
- semantic contradiction checks

### 3. Keep `invalid_output` as the error class

Traits failures are still `invalid_output`. They should not become a new high-level failure family.

Recommended mapping:

- malformed JSON -> `group: parse`
- traits shape / enum issues -> `group: validation`
- exhausted repair loop -> `group: tool_loop`

### 4. Add traits-aware repair payload generation

Build a dedicated normalization step that converts raw validation errors into the machine-readable retry payload described above, then render the clipped repair text from it.

### 5. Preserve existing raw capture behavior

Do not throw away the current capture machinery. Extend it.

---

## Example failure scenarios

## Example 1: invalid enum value

Candidate:

```json
{
  "index": 0,
  "text": "They want you afraid.",
  "traits": {
    "audibility": "clear",
    "overlap": "single_voice",
    "gender_presentation": "female",
    "age_impression": "adult",
    "pitch_band": "mid",
    "phonation": "clear",
    "pace": "measured",
    "energy": "steady",
    "channel_texture": "clean",
    "accent_strength": "none_apparent"
  }
}
```

Surface as:

- failure class: `schema`
- code: `invalid_enum_value`
- path: `$.dialogue_segments[0].traits.gender_presentation`
- retryable: yes

## Example 2: legacy field present

Candidate:

```json
{
  "index": 0,
  "speaker_id": "spk_001",
  "text": "They want you afraid.",
  "traits": {
    "audibility": "clear",
    "overlap": "single_voice",
    "gender_presentation": "feminine",
    "age_impression": "adult",
    "pitch_band": "mid",
    "phonation": "clear",
    "pace": "measured",
    "energy": "steady",
    "channel_texture": "clean",
    "accent_strength": "none_apparent"
  }
}
```

Surface as:

- failure class: `schema`
- code: `deprecated_field_present`
- path: `$.dialogue_segments[0].speaker_id`
- retryable: yes

## Example 3: semantic contradiction

Candidate:

```json
{
  "index": 0,
  "text": "They want you afraid.",
  "traits": {
    "audibility": "clear",
    "overlap": "single_voice",
    "gender_presentation": "mixed",
    "age_impression": "adult",
    "pitch_band": "mid",
    "phonation": "clear",
    "pace": "measured",
    "energy": "steady",
    "channel_texture": "clean",
    "accent_strength": "none_apparent"
  }
}
```

Surface as:

- failure class: `semantic`
- code: `semantic_conflict`
- path: `$.dialogue_segments[0].traits`
- message: `gender_presentation=mixed is not allowed when overlap=single_voice.`
- retryable: yes

---

## Final contract decisions

1. **`traits` failures are hard failures, not soft cleanup opportunities.**
2. **Schema-invalid and semantic-invalid are separate surfaced classes.**
3. **The persisted traits-mode `dialogue-data.json` envelope requires top-level `schema_version`, `contract`, and `contract.traits_contract_version`.**
4. **`summary` and `handoffContext` remain optional top-level fields.**
5. **Retry feedback is explicit, bounded, and machine-readable.**
6. **Prompt repair text is clipped; durable artifacts keep the full issue list.**
7. **No silent coercion or legacy normalization is allowed on model output.**
8. **No model-side weighting language is allowed in either validation or retry prompts.**
9. **Legacy speaker-oriented structures should be rejected in strict pivot mode and, if temporarily needed, recreated only by a deterministic compatibility adapter outside the model contract.**

---

## Open issues for audit / implementation review

1. **Strict top-level legacy rejection timing**
   - This doc recommends failing top-level `speaker_profiles` immediately in strict pivot mode.
   - Auditor should verify whether any nearby consumer still hard-depends on that structure.

2. **Semantic rule minimalism**
   - This doc intentionally keeps hard semantic checks narrow.
   - Auditor should confirm that `gender_presentation=mixed` + `overlap=single_voice` is worth making fatal, and that other suspicious combinations should remain warnings.

3. **Attempt-capture extension shape**
   - This doc recommends a dedicated `traitsValidation` block and sibling repair-payload files.
   - Auditor should check whether that extension fits the repo's current raw-capture conventions cleanly or whether a more generic validation artifact already exists.

4. **Transition sequencing inside `structured-output.cjs`**
   - Auditor should verify that swapping the contract does not accidentally preserve speaker normalization side effects from `normalizeDialogueSpeakerContract(...)` during the pivot.
