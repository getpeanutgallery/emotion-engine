const { parseJsonObjectInput } = require('./json-validator.cjs');

function compactString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function validateNonEmptyString(value, path, label, errors) {
  const normalized = compactString(value);
  if (!normalized) {
    errors.push({
      path,
      code: 'required_string',
      message: `${label} must be a non-empty string.`
    });
    return null;
  }
  return normalized;
}

function validateStringArray(value, path, label, errors) {
  if (!Array.isArray(value)) {
    errors.push({
      path,
      code: 'required_string_array',
      message: `${label} must be an array of non-empty strings.`
    });
    return [];
  }

  const normalized = value
    .map((entry) => compactString(entry))
    .filter(Boolean);

  if (normalized.length === 0) {
    errors.push({
      path,
      code: 'required_string_array',
      message: `${label} must include at least one non-empty string.`
    });
  } else if (normalized.length !== value.length) {
    errors.push({
      path,
      code: 'invalid_string_array_entry',
      message: `${label} must only contain non-empty strings.`
    });
  }

  return normalized;
}

function validateRecommendationObject(input) {
  const errors = [];

  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return {
      ok: false,
      value: null,
      errors: [
        {
          path: '$',
          code: 'invalid_type',
          message: 'Recommendation output must be a JSON object.'
        }
      ],
      summary: 'Recommendation output must be a JSON object. Return corrected JSON only.',
      meta: {
        stage: 'validation'
      }
    };
  }

  const text = validateNonEmptyString(input.text, '$.text', 'text', errors);
  const reasoning = validateNonEmptyString(input.reasoning, '$.reasoning', 'reasoning', errors);

  let confidence = null;
  if (typeof input.confidence !== 'number' || Number.isNaN(input.confidence) || !Number.isFinite(input.confidence)) {
    errors.push({
      path: '$.confidence',
      code: 'required_number',
      message: 'confidence must be a number between 0 and 1.'
    });
  } else if (input.confidence < 0 || input.confidence > 1) {
    errors.push({
      path: '$.confidence',
      code: 'out_of_range',
      message: 'confidence must be between 0 and 1.'
    });
  } else {
    confidence = input.confidence;
  }

  const keyFindings = validateStringArray(input.keyFindings, '$.keyFindings', 'keyFindings', errors);
  const suggestions = validateStringArray(input.suggestions, '$.suggestions', 'suggestions', errors);

  const summary = summarizeValidationErrors(errors);

  return {
    ok: errors.length === 0,
    value: errors.length === 0
      ? {
          text,
          reasoning,
          confidence,
          keyFindings,
          suggestions
        }
      : null,
    errors,
    summary,
    meta: {
      stage: 'validation'
    }
  };
}

function summarizeValidationErrors(errors = []) {
  if (!Array.isArray(errors) || errors.length === 0) return null;

  const parts = errors.slice(0, 5).map((error) => {
    const path = error?.path || '$';
    const message = error?.message || 'Invalid value.';
    return `${path}: ${message}`;
  });

  const suffix = errors.length > 5 ? ` (+${errors.length - 5} more)` : '';
  return `Recommendation JSON validation failed. ${parts.join(' | ')}${suffix} Return corrected JSON only.`;
}

function parseRecommendationResponse(input) {
  const parsed = parseJsonObjectInput(input);
  if (!parsed.ok) {
    return parsed;
  }

  const validated = validateRecommendationObject(parsed.value);
  if (!validated.ok) {
    return {
      ...validated,
      meta: {
        ...parsed.meta,
        ...validated.meta,
        raw: parsed.meta?.raw ?? null,
        extracted: parsed.meta?.extracted ?? null,
        repairApplied: parsed.meta?.repairApplied ?? false,
        sourceType: parsed.meta?.sourceType || 'unknown'
      }
    };
  }

  return {
    ok: true,
    value: {
      ...validated.value,
      _meta: {
        raw: parsed.meta?.raw ?? null,
        extracted: parsed.meta?.extracted ?? null,
        repairApplied: parsed.meta?.repairApplied ?? false,
        sourceType: parsed.meta?.sourceType || 'unknown'
      }
    },
    errors: [],
    summary: null,
    meta: {
      ...parsed.meta,
      stage: 'validation'
    }
  };
}

function buildRecommendationRepairPrompt({ basePrompt, validationSummary }) {
  if (!validationSummary) return basePrompt;

  return [
    basePrompt,
    '',
    'PREVIOUS OUTPUT FAILED VALIDATION.',
    validationSummary,
    'Re-read the schema and return corrected JSON only.',
    'Do not include markdown fences, prose, or explanations.'
  ].join('\n');
}

module.exports = {
  validateRecommendationObject,
  summarizeValidationErrors,
  parseRecommendationResponse,
  buildRecommendationRepairPrompt
};
