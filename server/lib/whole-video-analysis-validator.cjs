const { parseAndValidateJsonObject } = require('./structured-output.cjs');

const TOOL_NAME = 'validate_whole_video_analysis_json';
const DEFAULT_PRIMARY_LENSES = Object.freeze(['patience', 'boredom', 'excitement']);
const WHOLE_VIDEO_CATEGORY_KEYS = Object.freeze([
  'hookEffectiveness',
  'valueClarity',
  'dialogueAuthenticity',
  'musicEnergyAlignment',
  'visualMomentum',
  'ctaPackaging',
  'trust'
]);
const EVIDENCE_TYPES = new Set(['positive', 'friction']);
const EVIDENCE_DRIVERS = new Set(['dialogue', 'music', 'visual', 'cross_modal']);
const EVIDENCE_IMPACTS = new Set(['low', 'medium', 'high']);
const RETENTION_VERDICTS = new Set(['yes', 'maybe', 'no']);

function compactString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function pushError(errors, path, code, message) {
  errors.push({ path, code, message });
}

function summarizeValidationErrors(prefix, errors = []) {
  if (!Array.isArray(errors) || errors.length === 0) return null;
  const parts = errors.slice(0, 8).map((error) => `${error.path}: ${error.message}`);
  const suffix = errors.length > 8 ? ` (+${errors.length - 8} more)` : '';
  return `${prefix} ${parts.join(' | ')}${suffix} Return corrected JSON only.`;
}

function validateNonEmptyString(value, path, label, errors) {
  const normalized = compactString(value);
  if (!normalized) {
    pushError(errors, path, 'required_string', `${label} must be a non-empty string.`);
    return null;
  }
  return normalized;
}

function validateFiniteNumber(value, path, label, errors, { min = null, max = null } = {}) {
  if (typeof value !== 'number' || Number.isNaN(value) || !Number.isFinite(value)) {
    pushError(errors, path, 'required_number', `${label} must be a finite number.`);
    return null;
  }

  if (min !== null && value < min) {
    pushError(errors, path, 'out_of_range', `${label} must be >= ${min}.`);
    return null;
  }

  if (max !== null && value > max) {
    pushError(errors, path, 'out_of_range', `${label} must be <= ${max}.`);
    return null;
  }

  return value;
}

function validateStringEnum(value, allowed, path, label, errors) {
  const normalized = validateNonEmptyString(value, path, label, errors);
  if (!normalized) return null;
  if (!allowed.has(normalized)) {
    pushError(errors, path, 'invalid_enum', `${label} must be one of: ${Array.from(allowed).join(', ')}.`);
    return null;
  }
  return normalized;
}

function validateStringArray(value, path, label, errors, { minItems = 0 } = {}) {
  if (!Array.isArray(value)) {
    pushError(errors, path, 'required_array', `${label} must be an array.`);
    return [];
  }

  if (value.length < minItems) {
    pushError(errors, path, 'array_too_short', `${label} must contain at least ${minItems} item(s).`);
  }

  return value.map((entry, index) => {
    return validateNonEmptyString(entry, `${path}[${index}]`, `${label} entry`, errors);
  }).filter(Boolean);
}

function normalizePrimaryLenses(lenses = []) {
  if (!Array.isArray(lenses) || lenses.length === 0) {
    return [...DEFAULT_PRIMARY_LENSES];
  }

  const normalized = [];
  const seen = new Set();
  for (const lens of lenses) {
    const value = compactString(lens);
    if (!value || seen.has(value)) continue;
    seen.add(value);
    normalized.push(value);
  }

  return normalized.length > 0 ? normalized : [...DEFAULT_PRIMARY_LENSES];
}

function validateScoreReasoningMap(input, keys, path, label, errors) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    pushError(errors, path, 'invalid_type', `${label} must be an object.`);
    return {};
  }

  const normalized = {};
  for (const key of keys) {
    const entryPath = `${path}.${key}`;
    const value = input[key];
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      pushError(errors, entryPath, 'invalid_type', `${label} entry "${key}" must be an object.`);
      continue;
    }

    normalized[key] = {
      score: validateFiniteNumber(value.score, `${entryPath}.score`, `${key} score`, errors, { min: 1, max: 10 }),
      reasoning: validateNonEmptyString(value.reasoning, `${entryPath}.reasoning`, `${key} reasoning`, errors)
    };
  }

  return normalized;
}

function validateEvidenceMoment(input, index, errors) {
  const path = `$.evidenceMoments[${index}]`;
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    pushError(errors, path, 'invalid_type', 'evidence moment entries must be objects.');
    return null;
  }

  const timeRangeInput = input.timeRange;
  if (!timeRangeInput || typeof timeRangeInput !== 'object' || Array.isArray(timeRangeInput)) {
    pushError(errors, `${path}.timeRange`, 'invalid_type', 'timeRange must be an object with start and end.');
  }

  const timeRange = {
    start: validateFiniteNumber(timeRangeInput?.start, `${path}.timeRange.start`, 'evidence timeRange.start', errors, { min: 0 }),
    end: validateFiniteNumber(timeRangeInput?.end, `${path}.timeRange.end`, 'evidence timeRange.end', errors, { min: 0 })
  };

  if (timeRange.start !== null && timeRange.end !== null && timeRange.end < timeRange.start) {
    pushError(errors, `${path}.timeRange.end`, 'invalid_range', 'evidence timeRange.end must be >= timeRange.start.');
  }

  return {
    timestamp: validateFiniteNumber(input.timestamp, `${path}.timestamp`, 'evidence timestamp', errors, { min: 0 }),
    timeRange,
    type: validateStringEnum(input.type, EVIDENCE_TYPES, `${path}.type`, 'evidence type', errors),
    driver: validateStringEnum(input.driver, EVIDENCE_DRIVERS, `${path}.driver`, 'evidence driver', errors),
    category: validateNonEmptyString(input.category, `${path}.category`, 'evidence category', errors),
    impact: validateStringEnum(input.impact, EVIDENCE_IMPACTS, `${path}.impact`, 'evidence impact', errors),
    summary: validateNonEmptyString(input.summary, `${path}.summary`, 'evidence summary', errors)
  };
}

function validateWholeVideoAnalysisObject(input, { lenses = DEFAULT_PRIMARY_LENSES } = {}) {
  const errors = [];

  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return {
      ok: false,
      value: null,
      errors: [{ path: '$', code: 'invalid_type', message: 'Whole-video analysis output must be a JSON object.' }],
      summary: 'Whole-video analysis output must be a JSON object. Return corrected JSON only.',
      meta: { stage: 'validation' }
    };
  }

  const primaryLenses = normalizePrimaryLenses(lenses);
  const evidenceMomentsInput = input.evidenceMoments;
  if (!Array.isArray(evidenceMomentsInput)) {
    pushError(errors, '$.evidenceMoments', 'required_array', 'evidenceMoments must be an array.');
  }

  const evidenceMoments = Array.isArray(evidenceMomentsInput)
    ? evidenceMomentsInput.map((entry, index) => validateEvidenceMoment(entry, index, errors)).filter(Boolean)
    : [];

  const retentionVerdictInput = input.retentionVerdict;
  if (!retentionVerdictInput || typeof retentionVerdictInput !== 'object' || Array.isArray(retentionVerdictInput)) {
    pushError(errors, '$.retentionVerdict', 'invalid_type', 'retentionVerdict must be an object.');
  }

  const retentionVerdict = {
    wouldComplete: validateStringEnum(retentionVerdictInput?.wouldComplete, RETENTION_VERDICTS, '$.retentionVerdict.wouldComplete', 'retention verdict', errors),
    confidence: validateFiniteNumber(retentionVerdictInput?.confidence, '$.retentionVerdict.confidence', 'retention verdict confidence', errors, { min: 0, max: 1 }),
    reasoning: validateNonEmptyString(retentionVerdictInput?.reasoning, '$.retentionVerdict.reasoning', 'retention verdict reasoning', errors)
  };

  if (evidenceMoments.length === 0) {
    pushError(errors, '$.evidenceMoments', 'array_too_short', 'evidenceMoments must contain at least 1 item.');
  }

  const normalized = {
    wholeVideoScores: validateScoreReasoningMap(input.wholeVideoScores, primaryLenses, '$.wholeVideoScores', 'wholeVideoScores', errors),
    wholeVideoCategories: validateScoreReasoningMap(input.wholeVideoCategories, WHOLE_VIDEO_CATEGORY_KEYS, '$.wholeVideoCategories', 'wholeVideoCategories', errors),
    overallSummary: validateNonEmptyString(input.overallSummary, '$.overallSummary', 'overallSummary', errors),
    retentionVerdict,
    evidenceMoments,
    strongestMoments: validateStringArray(input.strongestMoments, '$.strongestMoments', 'strongestMoments', errors, { minItems: 1 }),
    biggestRisks: validateStringArray(input.biggestRisks, '$.biggestRisks', 'biggestRisks', errors, { minItems: 1 }),
    recommendationSeeds: validateStringArray(input.recommendationSeeds, '$.recommendationSeeds', 'recommendationSeeds', errors, { minItems: 1 })
  };

  return {
    ok: errors.length === 0,
    value: errors.length === 0 ? normalized : null,
    errors,
    summary: summarizeValidationErrors('Whole-video analysis JSON validation failed.', errors),
    meta: { stage: 'validation' }
  };
}

function parseWholeVideoAnalysisResponse(input, { lenses = DEFAULT_PRIMARY_LENSES } = {}) {
  return parseAndValidateJsonObject(input, (value) => validateWholeVideoAnalysisObject(value, { lenses }));
}

function buildWholeVideoAnalysisValidatorToolContract({ lenses = DEFAULT_PRIMARY_LENSES } = {}) {
  const primaryLenses = normalizePrimaryLenses(lenses);
  const exampleWholeVideoScores = {};
  for (const lens of primaryLenses) {
    exampleWholeVideoScores[lens] = { score: 6, reasoning: `${lens} evidence grounded in the full video.` };
  }

  const exampleWholeVideoCategories = {};
  for (const key of WHOLE_VIDEO_CATEGORY_KEYS) {
    exampleWholeVideoCategories[key] = { score: 6, reasoning: `${key} reasoning grounded in the full video.` };
  }

  return {
    name: TOOL_NAME,
    argumentKey: 'wholeVideoAnalysis',
    description: 'Validate a Phase 2 whole-video MiMo analysis JSON candidate against the required local schema before final submission.',
    canonicalEnvelope: {
      tool: TOOL_NAME,
      wholeVideoAnalysis: {
        wholeVideoScores: exampleWholeVideoScores,
        wholeVideoCategories: exampleWholeVideoCategories,
        overallSummary: 'The middle sustains momentum, but the opening and CTA weaken completion likelihood.',
        retentionVerdict: {
          wouldComplete: 'maybe',
          confidence: 0.78,
          reasoning: 'The strongest action beats recover attention after a soft opening.'
        },
        evidenceMoments: [
          {
            timestamp: 0,
            timeRange: { start: 0, end: 3 },
            type: 'friction',
            driver: 'cross_modal',
            category: 'hookEffectiveness',
            impact: 'high',
            summary: 'The opener is visually legible but does not immediately earn commitment.'
          }
        ],
        strongestMoments: ['The action-heavy middle sequence creates the clearest excitement spike.'],
        biggestRisks: ['The CTA packaging feels heavy relative to the payoff.'],
        recommendationSeeds: ['Rebuild the opening hook around the strongest reveal.']
      }
    },
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['wholeVideoAnalysis'],
      properties: {
        wholeVideoAnalysis: {
          type: 'object',
          description: 'Candidate whole-video MiMo analysis JSON core with whole-video scores, category reasoning, retention verdict, evidence moments, and recommendation seeds.'
        }
      }
    }
  };
}

function normalizeObjectArgument(args, argumentKey) {
  if (!args || typeof args !== 'object' || Array.isArray(args)) {
    return {
      ok: false,
      errors: [{ path: '$', code: 'invalid_tool_arguments', message: `Tool arguments must be a JSON object containing ${argumentKey}.` }]
    };
  }

  const value = args[argumentKey];
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {
      ok: false,
      errors: [{ path: `$.${argumentKey}`, code: 'invalid_tool_arguments', message: `${argumentKey} must be a JSON object.` }]
    };
  }

  return {
    ok: true,
    value: { [argumentKey]: value }
  };
}

function executeWholeVideoAnalysisValidatorTool(args, { lenses = DEFAULT_PRIMARY_LENSES } = {}) {
  const normalizedArgs = normalizeObjectArgument(args, 'wholeVideoAnalysis');
  if (!normalizedArgs.ok) {
    return {
      ok: false,
      valid: false,
      toolName: TOOL_NAME,
      summary: 'Tool arguments were invalid. Provide {"wholeVideoAnalysis": {...}}.',
      errors: normalizedArgs.errors,
      normalizedValue: null
    };
  }

  const validation = validateWholeVideoAnalysisObject(normalizedArgs.value.wholeVideoAnalysis, { lenses });
  return {
    ok: validation.ok,
    valid: validation.ok,
    toolName: TOOL_NAME,
    summary: validation.ok
      ? 'Whole-video analysis JSON is valid. Return the final JSON artifact.'
      : validation.summary,
    errors: validation.errors,
    normalizedValue: validation.ok ? validation.value : null
  };
}

module.exports = {
  TOOL_NAME,
  DEFAULT_PRIMARY_LENSES,
  WHOLE_VIDEO_CATEGORY_KEYS,
  validateWholeVideoAnalysisObject,
  parseWholeVideoAnalysisResponse,
  buildWholeVideoAnalysisValidatorToolContract,
  executeWholeVideoAnalysisValidatorTool
};
