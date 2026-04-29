const { parseAndValidateJsonObject } = require('./structured-output.cjs');
const { pushEnglishOnlyError } = require('./english-only-contract.cjs');

const TOOL_NAME = 'validate_visual_identity_json';
const ANALYSIS_MODES = new Set(['whole_asset', 'hybrid', 'chunked']);
const TIMING_MODES = new Set(['full_timeline', 'chunk_local']);
const TIMELINE_KINDS = new Set(['scene', 'sequence', 'beat', 'window']);

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

  return value
    .map((entry, index) => validateNonEmptyString(entry, `${path}[${index}]`, `${label} entry`, errors))
    .filter(Boolean);
}

function validateContinuity(value, path, errors) {
  const input = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  if (value !== undefined && (!value || typeof value !== 'object' || Array.isArray(value))) {
    pushError(errors, path, 'invalid_type', 'continuity must be an object when provided.');
  }

  return {
    introduces: validateStringArray(input.introduces || [], `${path}.introduces`, 'continuity introduces', errors),
    paysOff: validateStringArray(input.paysOff || [], `${path}.paysOff`, 'continuity paysOff', errors),
    callbacks: validateStringArray(input.callbacks || [], `${path}.callbacks`, 'continuity callbacks', errors)
  };
}

function validateTimelineEntry(value, index, errors) {
  const path = `$.timeline[${index}]`;
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    pushError(errors, path, 'invalid_type', 'timeline entries must be objects.');
    return null;
  }

  const start = validateFiniteNumber(value.start, `${path}.start`, 'timeline start', errors, { min: 0 });
  const end = validateFiniteNumber(value.end, `${path}.end`, 'timeline end', errors, { min: 0 });
  if (start !== null && end !== null && end < start) {
    pushError(errors, `${path}.end`, 'invalid_range', 'timeline end must be >= timeline start.');
  }

  return {
    start,
    end,
    kind: validateStringEnum(value.kind, TIMELINE_KINDS, `${path}.kind`, 'timeline kind', errors),
    visualSummary: validateNonEmptyString(value.visualSummary, `${path}.visualSummary`, 'timeline visualSummary', errors),
    entities: validateStringArray(value.entities || [], `${path}.entities`, 'timeline entities', errors),
    hooks: validateStringArray(value.hooks || [], `${path}.hooks`, 'timeline hooks', errors),
    risks: validateStringArray(value.risks || [], `${path}.risks`, 'timeline risks', errors),
    continuity: validateContinuity(value.continuity, `${path}.continuity`, errors)
  };
}

function validateBeat(value, path, label, errors) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    pushError(errors, path, 'invalid_type', `${label} entries must be objects.`);
    return null;
  }

  const start = validateFiniteNumber(value.start, `${path}.start`, `${label} start`, errors, { min: 0 });
  const end = validateFiniteNumber(value.end, `${path}.end`, `${label} end`, errors, { min: 0 });
  if (start !== null && end !== null && end < start) {
    pushError(errors, `${path}.end`, 'invalid_range', `${label} end must be >= start.`);
  }

  return {
    start,
    end,
    label: validateNonEmptyString(value.label, `${path}.label`, `${label} label`, errors),
    summary: validateNonEmptyString(value.summary, `${path}.summary`, `${label} summary`, errors)
  };
}

function validateBeatArray(value, path, label, errors) {
  if (!Array.isArray(value)) {
    pushError(errors, path, 'required_array', `${label} must be an array.`);
    return [];
  }

  return value.map((entry, index) => validateBeat(entry, `${path}[${index}]`, label, errors)).filter(Boolean);
}

function validateIdentityRegistry(value, errors) {
  const path = '$.identityRegistry';
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    pushError(errors, path, 'invalid_type', 'identityRegistry must be an object.');
    return {
      characters: [],
      locations: [],
      objects: [],
      motifs: []
    };
  }

  return {
    characters: validateStringArray(value.characters || [], `${path}.characters`, 'identityRegistry.characters', errors),
    locations: validateStringArray(value.locations || [], `${path}.locations`, 'identityRegistry.locations', errors),
    objects: validateStringArray(value.objects || [], `${path}.objects`, 'identityRegistry.objects', errors),
    motifs: validateStringArray(value.motifs || [], `${path}.motifs`, 'identityRegistry.motifs', errors)
  };
}

function validateEditorialSignals(value, errors) {
  const path = '$.editorialSignals';
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    pushError(errors, path, 'invalid_type', 'editorialSignals must be an object.');
    return {
      openingRead: null,
      midpointEscalation: null,
      endingMomentum: null,
      continuityStrength: null
    };
  }

  return {
    openingRead: validateNonEmptyString(value.openingRead, `${path}.openingRead`, 'editorialSignals.openingRead', errors),
    midpointEscalation: validateNonEmptyString(value.midpointEscalation, `${path}.midpointEscalation`, 'editorialSignals.midpointEscalation', errors),
    endingMomentum: validateNonEmptyString(value.endingMomentum, `${path}.endingMomentum`, 'editorialSignals.endingMomentum', errors),
    continuityStrength: validateNonEmptyString(value.continuityStrength, `${path}.continuityStrength`, 'editorialSignals.continuityStrength', errors)
  };
}

function validateVisualIdentityObject(input) {
  const errors = [];

  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return {
      ok: false,
      value: null,
      errors: [{ path: '$', code: 'invalid_type', message: 'Visual identity output must be a JSON object.' }],
      summary: 'Visual identity output must be a JSON object. Return corrected JSON only.',
      meta: { stage: 'validation' }
    };
  }

  if (!Array.isArray(input.timeline)) {
    pushError(errors, '$.timeline', 'required_array', 'timeline must be an array.');
  }

  const timeline = Array.isArray(input.timeline)
    ? input.timeline.map((entry, index) => validateTimelineEntry(entry, index, errors)).filter(Boolean)
    : [];

  if (timeline.length === 0) {
    pushError(errors, '$.timeline', 'array_too_short', 'timeline must contain at least 1 item.');
  }

  const visualBeatsInput = input.visualBeats;
  if (!visualBeatsInput || typeof visualBeatsInput !== 'object' || Array.isArray(visualBeatsInput)) {
    pushError(errors, '$.visualBeats', 'invalid_type', 'visualBeats must be an object.');
  }

  const visualBeats = {
    hookMoments: validateBeatArray(visualBeatsInput?.hookMoments || [], '$.visualBeats.hookMoments', 'visualBeats.hookMoments', errors),
    patternInterrupts: validateBeatArray(visualBeatsInput?.patternInterrupts || [], '$.visualBeats.patternInterrupts', 'visualBeats.patternInterrupts', errors),
    titleCards: validateBeatArray(visualBeatsInput?.titleCards || [], '$.visualBeats.titleCards', 'visualBeats.titleCards', errors),
    ctaScreens: validateBeatArray(visualBeatsInput?.ctaScreens || [], '$.visualBeats.ctaScreens', 'visualBeats.ctaScreens', errors),
    noveltyPeaks: validateBeatArray(visualBeatsInput?.noveltyPeaks || [], '$.visualBeats.noveltyPeaks', 'visualBeats.noveltyPeaks', errors),
    fatigueRisks: validateBeatArray(visualBeatsInput?.fatigueRisks || [], '$.visualBeats.fatigueRisks', 'visualBeats.fatigueRisks', errors)
  };

  const normalized = {
    analysisMode: validateStringEnum(input.analysisMode, ANALYSIS_MODES, '$.analysisMode', 'analysisMode', errors),
    timingMode: validateStringEnum(input.timingMode, TIMING_MODES, '$.timingMode', 'timingMode', errors),
    summary: validateNonEmptyString(input.summary, '$.summary', 'summary', errors),
    timeline,
    identityRegistry: validateIdentityRegistry(input.identityRegistry, errors),
    visualBeats,
    editorialSignals: validateEditorialSignals(input.editorialSignals, errors)
  };

  pushEnglishOnlyError(errors, '$.summary', 'summary', normalized.summary);
  for (const entry of timeline) {
    pushEnglishOnlyError(errors, '$.timeline[].kind', 'timeline kind', entry?.kind);
    pushEnglishOnlyError(errors, '$.timeline[].visualSummary', 'timeline visualSummary', entry?.visualSummary);
    for (const value of entry?.entities || []) pushEnglishOnlyError(errors, '$.timeline[].entities[]', 'timeline entities entry', value);
    for (const value of entry?.hooks || []) pushEnglishOnlyError(errors, '$.timeline[].hooks[]', 'timeline hooks entry', value);
    for (const value of entry?.risks || []) pushEnglishOnlyError(errors, '$.timeline[].risks[]', 'timeline risks entry', value);
    for (const value of entry?.continuity?.introduces || []) pushEnglishOnlyError(errors, '$.timeline[].continuity.introduces[]', 'continuity introduces entry', value);
    for (const value of entry?.continuity?.paysOff || []) pushEnglishOnlyError(errors, '$.timeline[].continuity.paysOff[]', 'continuity paysOff entry', value);
    for (const value of entry?.continuity?.callbacks || []) pushEnglishOnlyError(errors, '$.timeline[].continuity.callbacks[]', 'continuity callbacks entry', value);
  }
  for (const key of ['characters', 'locations', 'objects', 'motifs']) {
    for (const value of normalized.identityRegistry?.[key] || []) {
      pushEnglishOnlyError(errors, `$.identityRegistry.${key}[]`, `identityRegistry.${key} entry`, value);
    }
  }
  for (const [beatKey, beats] of Object.entries(normalized.visualBeats || {})) {
    for (const beat of beats || []) {
      pushEnglishOnlyError(errors, `$.visualBeats.${beatKey}[].label`, `${beatKey} label`, beat?.label);
      pushEnglishOnlyError(errors, `$.visualBeats.${beatKey}[].summary`, `${beatKey} summary`, beat?.summary);
    }
  }
  pushEnglishOnlyError(errors, '$.editorialSignals.openingRead', 'editorialSignals.openingRead', normalized.editorialSignals?.openingRead);
  pushEnglishOnlyError(errors, '$.editorialSignals.midpointEscalation', 'editorialSignals.midpointEscalation', normalized.editorialSignals?.midpointEscalation);
  pushEnglishOnlyError(errors, '$.editorialSignals.endingMomentum', 'editorialSignals.endingMomentum', normalized.editorialSignals?.endingMomentum);
  pushEnglishOnlyError(errors, '$.editorialSignals.continuityStrength', 'editorialSignals.continuityStrength', normalized.editorialSignals?.continuityStrength);

  return {
    ok: errors.length === 0,
    value: errors.length === 0 ? normalized : null,
    errors,
    summary: summarizeValidationErrors('Visual identity JSON validation failed.', errors),
    meta: { stage: 'validation' }
  };
}

function parseVisualIdentityResponse(input) {
  return parseAndValidateJsonObject(input, (value) => validateVisualIdentityObject(value));
}

function buildVisualIdentityValidatorToolContract() {
  return {
    name: TOOL_NAME,
    argumentKey: 'visualIdentity',
    description: 'Validate a Phase 1 visual identity JSON candidate against the required local schema before final submission.',
    canonicalEnvelope: {
      tool: TOOL_NAME,
      visualIdentity: {
        analysisMode: 'whole_asset',
        timingMode: 'full_timeline',
        summary: 'The piece opens with a strong reveal, repeats two title-card motifs, and loses momentum during the end slate.',
        timeline: [
          {
            start: 0,
            end: 5,
            kind: 'scene',
            visualSummary: 'A fast mech reveal establishes the core novelty immediately.',
            entities: ['mech silhouette', 'storm sky'],
            hooks: ['Immediate novelty', 'High-contrast silhouette'],
            risks: [],
            continuity: {
              introduces: ['mech silhouette motif'],
              paysOff: [],
              callbacks: []
            }
          }
        ],
        identityRegistry: {
          characters: ['Pilot'],
          locations: ['Storm plateau'],
          objects: ['Mech silhouette'],
          motifs: ['High-contrast reveal']
        },
        visualBeats: {
          hookMoments: [
            {
              start: 0,
              end: 3,
              label: 'Opening mech reveal',
              summary: 'The opener lands because the novelty is immediately legible.'
            }
          ],
          patternInterrupts: [],
          titleCards: [],
          ctaScreens: [],
          noveltyPeaks: [
            {
              start: 24,
              end: 30,
              label: 'Environment escalation',
              summary: 'The world expands and refreshes attention.'
            }
          ],
          fatigueRisks: [
            {
              start: 54,
              end: 60,
              label: 'End slate drag',
              summary: 'Static packaging undercuts the payoff.'
            }
          ]
        },
        editorialSignals: {
          openingRead: 'The first three seconds clearly communicate novelty.',
          midpointEscalation: 'The midpoint adds scale and motion, creating a visible escalation.',
          endingMomentum: 'Momentum drops once the end slate holds too long.',
          continuityStrength: 'Recurring mech silhouettes create a coherent identity thread.'
        }
      }
    },
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['visualIdentity'],
      properties: {
        visualIdentity: {
          type: 'object',
          description: 'Candidate visual identity JSON with timeline, identity registry, visual beats, and editorial signals.'
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

function executeVisualIdentityValidatorTool(args) {
  const normalizedArgs = normalizeObjectArgument(args, 'visualIdentity');
  if (!normalizedArgs.ok) {
    return {
      ok: false,
      valid: false,
      toolName: TOOL_NAME,
      summary: 'Tool arguments were invalid. Provide {"visualIdentity": {...}}.',
      errors: normalizedArgs.errors,
      normalizedValue: null
    };
  }

  const validation = validateVisualIdentityObject(normalizedArgs.value.visualIdentity);
  return {
    ok: validation.ok,
    valid: validation.ok,
    toolName: TOOL_NAME,
    summary: validation.ok
      ? 'Visual identity JSON is valid. Return the final JSON artifact.'
      : validation.summary,
    errors: validation.errors,
    normalizedValue: validation.ok ? validation.value : null
  };
}

module.exports = {
  TOOL_NAME,
  validateVisualIdentityObject,
  parseVisualIdentityResponse,
  buildVisualIdentityValidatorToolContract,
  executeVisualIdentityValidatorTool
};
