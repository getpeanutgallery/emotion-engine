const { parseJsonObjectInput } = require('./json-validator.cjs');
const { validateRecommendationObject } = require('./recommendation-validator.cjs');

const TOOL_NAME = 'validate_recommendation_json';

function compactString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function buildRecommendationValidatorToolContract() {
  return {
    name: TOOL_NAME,
    description: 'Validate a Phase 3 recommendation JSON candidate against the required local schema before final submission.',
    canonicalEnvelope: {
      tool: TOOL_NAME,
      recommendation: {
        text: 'string',
        reasoning: 'string',
        confidence: 0.5,
        keyFindings: ['string'],
        suggestions: ['string']
      }
    },
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['recommendation'],
      properties: {
        recommendation: {
          type: 'object',
          description: 'Candidate recommendation JSON with text, reasoning, confidence, keyFindings, and suggestions fields.'
        }
      }
    }
  };
}

function normalizeRecommendationToolArguments(args) {
  if (!args || typeof args !== 'object' || Array.isArray(args)) {
    return {
      ok: false,
      errors: [
        {
          path: '$',
          code: 'invalid_tool_arguments',
          message: 'Tool arguments must be a JSON object containing recommendation.'
        }
      ]
    };
  }

  const recommendation = args.recommendation;
  if (!recommendation || typeof recommendation !== 'object' || Array.isArray(recommendation)) {
    return {
      ok: false,
      errors: [
        {
          path: '$.recommendation',
          code: 'invalid_tool_arguments',
          message: 'recommendation must be a JSON object.'
        }
      ]
    };
  }

  return {
    ok: true,
    value: { recommendation }
  };
}

function executeRecommendationValidatorTool(args) {
  const normalizedArgs = normalizeRecommendationToolArguments(args);
  if (!normalizedArgs.ok) {
    return {
      ok: false,
      valid: false,
      toolName: TOOL_NAME,
      summary: 'Tool arguments were invalid. Provide {"recommendation": {...}}.',
      errors: normalizedArgs.errors,
      normalizedRecommendation: null
    };
  }

  const validation = validateRecommendationObject(normalizedArgs.value.recommendation);

  return {
    ok: validation.ok,
    valid: validation.ok,
    toolName: TOOL_NAME,
    summary: validation.ok
      ? 'Recommendation JSON is valid. Return the final JSON artifact.'
      : validation.summary,
    errors: validation.errors,
    normalizedRecommendation: validation.ok ? validation.value : null
  };
}

function looksLikeToolEnvelopeAttempt(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return false;

  const markers = [
    input.tool,
    input.toolName,
    input.type,
    input.kind,
    input.arguments,
    input.args,
    input.input,
    input.name
  ];

  if (markers.some((value) => value !== undefined)) return true;

  return false;
}

function summarizeMalformedEnvelope(input) {
  const actualTool = compactString(input?.tool || input?.toolName || input?.name || '');

  if (actualTool && actualTool !== TOOL_NAME) {
    return `Malformed ${TOOL_NAME} tool call envelope. Expected {"tool":"${TOOL_NAME}","recommendation":{...}} but received tool "${actualTool}".`;
  }

  return `Malformed ${TOOL_NAME} tool call envelope. Expected exactly {"tool":"${TOOL_NAME}","recommendation":{...}}.`;
}

function parseRecommendationToolCallEnvelope(input) {
  const parsed = parseJsonObjectInput(input);
  if (!parsed.ok) {
    return {
      ok: false,
      kind: 'parse_error',
      errors: parsed.errors,
      summary: parsed.summary,
      meta: parsed.meta
    };
  }

  const value = parsed.value;
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {
      ok: false,
      kind: 'not_tool_call',
      errors: [
        {
          path: '$',
          code: 'not_tool_call_envelope',
          message: `Object was not a ${TOOL_NAME} tool call envelope.`
        }
      ],
      summary: `Object was not a ${TOOL_NAME} tool call envelope.`,
      meta: parsed.meta
    };
  }

  const tool = compactString(value.tool);
  const recommendation = value.recommendation;
  const extraKeys = Object.keys(value).filter((key) => key !== 'tool' && key !== 'recommendation');

  if (tool === TOOL_NAME && recommendation && typeof recommendation === 'object' && !Array.isArray(recommendation) && extraKeys.length === 0) {
    return {
      ok: true,
      kind: 'canonical_tool_call',
      value: {
        tool: TOOL_NAME,
        recommendation,
        arguments: {
          recommendation
        }
      },
      meta: parsed.meta
    };
  }

  if (looksLikeToolEnvelopeAttempt(value)) {
    const errors = [];

    if (tool !== TOOL_NAME) {
      errors.push({
        path: '$.tool',
        code: 'invalid_tool_name',
        message: `tool must equal "${TOOL_NAME}".`
      });
    }

    if (!recommendation || typeof recommendation !== 'object' || Array.isArray(recommendation)) {
      errors.push({
        path: '$.recommendation',
        code: 'invalid_tool_arguments',
        message: 'recommendation must be a JSON object.'
      });
    }

    if (extraKeys.length > 0) {
      errors.push({
        path: '$',
        code: 'unexpected_tool_envelope_keys',
        message: `Unexpected tool envelope keys: ${extraKeys.join(', ')}.`
      });
    }

    return {
      ok: false,
      kind: 'malformed_tool_call',
      errors,
      summary: summarizeMalformedEnvelope(value),
      meta: parsed.meta,
      envelope: value
    };
  }

  return {
    ok: false,
    kind: 'not_tool_call',
    errors: [
      {
        path: '$',
        code: 'not_tool_call_envelope',
        message: `Object was not a ${TOOL_NAME} tool call envelope.`
      }
    ],
    summary: `Object was not a ${TOOL_NAME} tool call envelope.`,
    meta: parsed.meta
  };
}

module.exports = {
  TOOL_NAME,
  buildRecommendationValidatorToolContract,
  normalizeRecommendationToolArguments,
  executeRecommendationValidatorTool,
  parseRecommendationToolCallEnvelope
};
