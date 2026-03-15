const TOOL_NAME = 'validate_ai_recovery_decision_json';
const ARGUMENT_KEY = 'recoveryDecision';
const ALLOWED_OUTCOMES = new Set(['reenter_script', 'hard_fail', 'human_review', 'no_change_fail']);
const ALLOWED_CONFIDENCE = new Set(['low', 'medium', 'high']);
const ALLOWED_MUTABLE_PATHS = new Set(['repairInstructions', 'boundedContextSummary']);
const ALLOWED_CHANGE_KEYS = new Set(['path', 'op', 'value']);
const ALLOWED_DECISION_KEYS = new Set(['outcome', 'reason', 'confidence', 'hardFail', 'humanReviewRequired']);
const ALLOWED_REVISED_INPUT_KEYS = new Set(['kind', 'changes']);
const ALLOWED_ROOT_KEYS = new Set(['decision', 'revisedInput']);

function buildAiRecoveryValidatorToolContract() {
  return {
    name: TOOL_NAME,
    argumentKey: ARGUMENT_KEY,
    description: 'Validate a bounded AI recovery decision before final submission. The decision must stay within the same-script revised-input contract and may only mutate repairInstructions or boundedContextSummary.',
    canonicalEnvelope: {
      tool: TOOL_NAME,
      [ARGUMENT_KEY]: {
        decision: {
          outcome: 'reenter_script',
          reason: 'Short reason tied to the failure package.',
          confidence: 'medium',
          hardFail: false,
          humanReviewRequired: false
        },
        revisedInput: {
          kind: 'same-script-revised-input',
          changes: [
            { path: 'repairInstructions', op: 'set', value: ['Return valid JSON only.'] },
            { path: 'boundedContextSummary', op: 'set', value: 'Previous output was malformed JSON.' }
          ]
        }
      }
    },
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      required: [ARGUMENT_KEY],
      properties: {
        [ARGUMENT_KEY]: {
          type: 'object',
          description: 'Candidate AI recovery decision containing decision and optional revisedInput constrained to the same-script bounded mutable input surface.'
        }
      }
    }
  };
}

function normalizeAiRecoveryToolArguments(args) {
  if (!args || typeof args !== 'object' || Array.isArray(args)) {
    return {
      ok: false,
      errors: [{ path: '$', code: 'invalid_tool_arguments', message: `Tool arguments must be a JSON object containing ${ARGUMENT_KEY}.` }]
    };
  }

  const recoveryDecision = args[ARGUMENT_KEY];
  if (!recoveryDecision || typeof recoveryDecision !== 'object' || Array.isArray(recoveryDecision)) {
    return {
      ok: false,
      errors: [{ path: `$.${ARGUMENT_KEY}`, code: 'invalid_tool_arguments', message: `${ARGUMENT_KEY} must be a JSON object.` }]
    };
  }

  return {
    ok: true,
    value: { [ARGUMENT_KEY]: recoveryDecision }
  };
}

function pushUnexpectedKeyErrors(errors, value, allowedKeys, pathPrefix) {
  for (const key of Object.keys(value || {})) {
    if (!allowedKeys.has(key)) {
      errors.push({
        path: pathPrefix,
        code: 'unexpected_property',
        message: `Unexpected property "${key}" at ${pathPrefix}.`
      });
    }
  }
}

function validateAiRecoveryDecisionCandidate(candidate) {
  const errors = [];

  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
    return {
      ok: false,
      errors: [{ path: '$', code: 'invalid_candidate', message: 'AI recovery decision candidate must be a JSON object.' }],
      summary: 'AI recovery decision must be a JSON object.'
    };
  }

  pushUnexpectedKeyErrors(errors, candidate, ALLOWED_ROOT_KEYS, '$');

  const decision = candidate.decision;
  if (!decision || typeof decision !== 'object' || Array.isArray(decision)) {
    errors.push({ path: '$.decision', code: 'required', message: 'decision must be a JSON object.' });
  } else {
    pushUnexpectedKeyErrors(errors, decision, ALLOWED_DECISION_KEYS, '$.decision');

    if (!ALLOWED_OUTCOMES.has(decision.outcome)) {
      errors.push({ path: '$.decision.outcome', code: 'invalid_enum', message: 'decision.outcome must be one of reenter_script, hard_fail, human_review, or no_change_fail.' });
    }
    if (typeof decision.reason !== 'string' || decision.reason.trim().length === 0) {
      errors.push({ path: '$.decision.reason', code: 'invalid_string', message: 'decision.reason must be a non-empty string.' });
    }
    if (!ALLOWED_CONFIDENCE.has(decision.confidence)) {
      errors.push({ path: '$.decision.confidence', code: 'invalid_enum', message: 'decision.confidence must be one of low, medium, or high.' });
    }
    if (typeof decision.hardFail !== 'boolean') {
      errors.push({ path: '$.decision.hardFail', code: 'invalid_boolean', message: 'decision.hardFail must be a boolean.' });
    }
    if (typeof decision.humanReviewRequired !== 'boolean') {
      errors.push({ path: '$.decision.humanReviewRequired', code: 'invalid_boolean', message: 'decision.humanReviewRequired must be a boolean.' });
    }
  }

  const outcome = decision && typeof decision === 'object' ? decision.outcome : null;
  const revisedInput = candidate.revisedInput;

  if (outcome === 'reenter_script') {
    if (!revisedInput || typeof revisedInput !== 'object' || Array.isArray(revisedInput)) {
      errors.push({ path: '$.revisedInput', code: 'required', message: 'revisedInput is required when decision.outcome is reenter_script.' });
    }
  }

  if (revisedInput !== undefined) {
    if (!revisedInput || typeof revisedInput !== 'object' || Array.isArray(revisedInput)) {
      errors.push({ path: '$.revisedInput', code: 'invalid_object', message: 'revisedInput must be a JSON object when provided.' });
    } else {
      pushUnexpectedKeyErrors(errors, revisedInput, ALLOWED_REVISED_INPUT_KEYS, '$.revisedInput');

      if (revisedInput.kind !== 'same-script-revised-input') {
        errors.push({ path: '$.revisedInput.kind', code: 'invalid_value', message: 'revisedInput.kind must equal "same-script-revised-input".' });
      }

      if (!Array.isArray(revisedInput.changes)) {
        errors.push({ path: '$.revisedInput.changes', code: 'invalid_array', message: 'revisedInput.changes must be an array.' });
      } else {
        revisedInput.changes.forEach((change, index) => {
          const changePath = `$.revisedInput.changes[${index}]`;
          if (!change || typeof change !== 'object' || Array.isArray(change)) {
            errors.push({ path: changePath, code: 'invalid_object', message: 'Each revisedInput change must be a JSON object.' });
            return;
          }

          pushUnexpectedKeyErrors(errors, change, ALLOWED_CHANGE_KEYS, changePath);

          if (!ALLOWED_MUTABLE_PATHS.has(change.path)) {
            errors.push({ path: `${changePath}.path`, code: 'forbidden_mutation_path', message: 'Only repairInstructions and boundedContextSummary may be mutated.' });
          }

          if (change.op !== 'set') {
            errors.push({ path: `${changePath}.op`, code: 'invalid_operation', message: 'Only set operations are allowed in revisedInput.changes.' });
          }

          if (change.path === 'repairInstructions') {
            if (!Array.isArray(change.value) || change.value.length === 0 || change.value.some((entry) => typeof entry !== 'string' || entry.trim().length === 0)) {
              errors.push({ path: `${changePath}.value`, code: 'invalid_repair_instructions', message: 'repairInstructions must be a non-empty array of non-empty strings.' });
            }
          }

          if (change.path === 'boundedContextSummary') {
            if (typeof change.value !== 'string' || change.value.trim().length === 0) {
              errors.push({ path: `${changePath}.value`, code: 'invalid_bounded_context_summary', message: 'boundedContextSummary must be a non-empty string.' });
            }
          }
        });
      }
    }
  }

  if (outcome !== 'reenter_script' && revisedInput && Array.isArray(revisedInput.changes) && revisedInput.changes.length > 0) {
    errors.push({ path: '$.revisedInput.changes', code: 'revised_input_not_allowed', message: 'revisedInput.changes must be omitted or empty unless decision.outcome is reenter_script.' });
  }

  if (errors.length > 0) {
    return {
      ok: false,
      errors,
      summary: `AI recovery decision validation failed. ${errors.map((error) => `${error.path}: ${error.message}`).join(' | ')}`
    };
  }

  const normalized = {
    decision: {
      outcome: decision.outcome,
      reason: decision.reason.trim(),
      confidence: decision.confidence,
      hardFail: decision.hardFail,
      humanReviewRequired: decision.humanReviewRequired
    },
    revisedInput: outcome === 'reenter_script'
      ? {
          kind: 'same-script-revised-input',
          changes: revisedInput.changes.map((change) => ({
            path: change.path,
            op: 'set',
            value: change.path === 'repairInstructions'
              ? change.value.map((entry) => entry.trim())
              : change.value.trim()
          }))
        }
      : {
          kind: 'same-script-revised-input',
          changes: []
        }
  };

  return {
    ok: true,
    value: normalized,
    errors: [],
    summary: 'AI recovery decision is valid. The validator returned valid=true. Return the final AI recovery decision JSON artifact with no wrapper.'
  };
}

function executeAiRecoveryValidatorTool(args) {
  const normalizedArgs = normalizeAiRecoveryToolArguments(args);
  if (!normalizedArgs.ok) {
    return {
      ok: false,
      valid: false,
      toolName: TOOL_NAME,
      summary: `Tool arguments were invalid. Provide {"${ARGUMENT_KEY}": {...}}.`,
      errors: normalizedArgs.errors,
      normalizedValue: null
    };
  }

  const validation = validateAiRecoveryDecisionCandidate(normalizedArgs.value[ARGUMENT_KEY]);
  return {
    ok: validation.ok,
    valid: validation.ok,
    toolName: TOOL_NAME,
    summary: validation.ok
      ? 'AI recovery decision JSON is valid. The validator returned valid=true. Return the final JSON artifact with no wrapper.'
      : validation.summary,
    errors: validation.errors,
    normalizedValue: validation.ok ? validation.value : null
  };
}

module.exports = {
  TOOL_NAME,
  ARGUMENT_KEY,
  buildAiRecoveryValidatorToolContract,
  normalizeAiRecoveryToolArguments,
  validateAiRecoveryDecisionCandidate,
  executeAiRecoveryValidatorTool
};
