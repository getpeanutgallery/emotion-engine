const { parseAndValidateJsonObject, summarizeValidationErrors } = require('./structured-output.cjs');

const TOOL_NAME = 'validate_dialogue_v3_source_truth_json';

const REQUIRED_TOP_LEVEL_FIELDS = Object.freeze([
  'schema_version',
  'contract',
  'summary',
  'dialogue_segments'
]);

const REQUIRED_CONTRACT_FIELDS = Object.freeze([
  'artifact',
  'mode',
  'traits_contract_version'
]);

const REQUIRED_SEGMENT_FIELDS = Object.freeze([
  'index',
  'text',
  'traits'
]);

const REQUIRED_TRAIT_FIELDS = Object.freeze([
  'audibility',
  'overlap',
  'gender_presentation',
  'age_impression',
  'pitch_band',
  'phonation',
  'pace',
  'energy',
  'transmission_medium',
  'spatial_texture',
  'accent_strength',
  'accent_family',
  'affect',
  'interpersonal_stance',
  'delivery_overlay'
]);

const TRAIT_ENUMS = Object.freeze({
  audibility: Object.freeze(['clear', 'partially_masked', 'heavily_masked', 'unknown']),
  overlap: Object.freeze(['single_voice', 'background_overlap', 'competing_overlap', 'unknown']),
  gender_presentation: Object.freeze(['feminine', 'masculine', 'androgynous', 'mixed', 'unknown']),
  age_impression: Object.freeze(['child', 'teen', 'young_adult', 'adult', 'older_adult', 'elder', 'unknown']),
  pitch_band: Object.freeze(['low', 'mid', 'high', 'variable', 'unknown']),
  phonation: Object.freeze(['clear', 'breathy', 'whispered', 'raspy', 'nasal', 'thin', 'full', 'strained', 'mixed', 'unknown']),
  pace: Object.freeze(['slow', 'measured', 'fast', 'variable', 'unknown']),
  energy: Object.freeze(['calm', 'steady', 'intense', 'variable', 'unknown']),
  transmission_medium: Object.freeze(['direct', 'phone', 'radio', 'pa_or_intercom', 'media_playback', 'processed_or_synthetic', 'unknown']),
  spatial_texture: Object.freeze(['close', 'room', 'reverberant', 'distant', 'variable', 'unknown']),
  accent_strength: Object.freeze(['none_apparent', 'subtle_non_neutral', 'clear_non_neutral', 'variable', 'unknown']),
  accent_family: Object.freeze(['neutral_or_unmarked', 'anglophone_non_neutral', 'hispanic', 'slavic', 'germanic', 'romance', 'south_asian', 'east_asian', 'southeast_asian', 'african', 'middle_eastern', 'mixed', 'unknown']),
  affect: Object.freeze(['calm', 'serious', 'angry', 'sad', 'fearful', 'tense', 'happy', 'amused', 'disgusted', 'surprised', 'determined', 'sensual', 'mixed', 'unknown']),
  interpersonal_stance: Object.freeze(['neutral', 'directive', 'confrontational', 'supportive', 'pleading', 'taunting', 'seductive', 'performative', 'mixed', 'unknown']),
  delivery_overlay: Object.freeze(['none_apparent', 'laughing', 'crying', 'mixed', 'unknown'])
});

const FORBIDDEN_TOP_LEVEL_FIELDS = Object.freeze(new Map([
  ['handoffContext', 'handoffContext is forbidden in persisted v3 dialogue-data source truth.'],
  ['handoff', 'handoff is forbidden in persisted v3 dialogue-data source truth.'],
  ['speaker_profiles', 'speaker_profiles is forbidden in persisted v3 dialogue-data source truth.'],
  ['speakerProfiles', 'speakerProfiles is forbidden in persisted v3 dialogue-data source truth.'],
  ['speaker_groups', 'speaker_groups is grouping output and forbidden in source truth.'],
  ['speakerGroups', 'speakerGroups is grouping output and forbidden in source truth.'],
  ['dialogue_speakers', 'dialogue_speakers is grouping output and forbidden in source truth.'],
  ['dialogueSpeakers', 'dialogueSpeakers is grouping output and forbidden in source truth.'],
  ['groups', 'groups is grouping output and forbidden in source truth.'],
  ['assignments', 'assignments is grouping output and forbidden in source truth.'],
  ['canonical_traits', 'canonical_traits is grouping output and forbidden in source truth.'],
  ['canonicalTraits', 'canonicalTraits is grouping output and forbidden in source truth.'],
  ['decision_ledger', 'decision_ledger is runtime/grouping output and forbidden in source truth.'],
  ['decisionLedger', 'decisionLedger is runtime/grouping output and forbidden in source truth.'],
  ['notes', 'notes is forbidden in persisted v3 dialogue-data source truth.'],
  ['guidance', 'guidance is forbidden in persisted v3 dialogue-data source truth.'],
  ['instructions', 'instructions is forbidden in persisted v3 dialogue-data source truth.']
]));

const FORBIDDEN_SEGMENT_FIELDS = Object.freeze(new Map([
  ['start', 'Per-line start is forbidden in persisted v3 dialogue-data source truth.'],
  ['end', 'Per-line end is forbidden in persisted v3 dialogue-data source truth.'],
  ['speaker', 'Per-line speaker is forbidden in persisted v3 dialogue-data source truth.'],
  ['speaker_id', 'Per-line speaker_id is grouping output and forbidden in source truth.'],
  ['speaker_group_id', 'Per-line speaker_group_id is grouping output and forbidden in source truth.'],
  ['group_id', 'Per-line group_id is grouping output and forbidden in source truth.'],
  ['confidence', 'Per-line confidence is forbidden in persisted v3 dialogue-data source truth.'],
  ['notes', 'Per-line notes is forbidden in persisted v3 dialogue-data source truth.'],
  ['weights', 'Per-line weights is forbidden in persisted v3 dialogue-data source truth.']
]));

const SUPERSEDED_TRAIT_FIELDS = Object.freeze(new Map([
  ['channel_texture', {
    replacement: 'transmission_medium + spatial_texture',
    adapter: 'v2-superseded-trait-names-bridge'
  }],
  ['delivery_stance', {
    replacement: 'interpersonal_stance + delivery_overlay',
    adapter: 'v2-superseded-trait-names-bridge'
  }]
]));

const SUPERSEDED_TRAIT_VALUES = Object.freeze({
  phonation: Object.freeze(new Map([
    ['distorted', 'stored-v2 phonation "distorted" was removed; use transmission_medium for channel effects or a current phonation enum.']]
  )),
  accent_strength: Object.freeze(new Map([
    ['mixed', 'stored-v2 accent_strength "mixed" was superseded by "variable".']]
  )),
  interpersonal_stance: Object.freeze(new Map([
    ['sexual', 'stored-v2 delivery_stance/interpersonal_stance value "sexual" was superseded by "seductive".']
  ]))
});

const COMPATIBILITY_ADAPTERS = Object.freeze(new Set([
  'v2-superseded-trait-names-bridge'
]));

function compactString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function pushError(errors, path, code, message) {
  errors.push({ path, code, message });
}

function validateNonEmptyString(value, path, label, errors) {
  const normalized = compactString(value);
  if (!normalized) {
    pushError(errors, path, 'required_string', `${label} must be a non-empty string.`);
    return null;
  }
  return normalized;
}

function validateInteger(value, path, label, errors, { min = null } = {}) {
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    pushError(errors, path, 'required_integer', `${label} must be an integer.`);
    return null;
  }

  if (min !== null && value < min) {
    pushError(errors, path, 'out_of_range', `${label} must be >= ${min}.`);
    return null;
  }

  return value;
}

function validateStringEnum(value, allowedValues, path, label, errors, { superseded = null } = {}) {
  const normalized = validateNonEmptyString(value, path, label, errors);
  if (!normalized) return null;

  if (superseded instanceof Map && superseded.has(normalized)) {
    pushError(errors, path, 'superseded_normative_name', superseded.get(normalized));
    return null;
  }

  if (!allowedValues.includes(normalized)) {
    pushError(errors, path, 'invalid_enum', `${label} must be one of: ${allowedValues.join(', ')}.`);
    return null;
  }

  return normalized;
}

function normalizeCompatibilityAdapter(value, errors) {
  if (value === undefined || value === null || value === '') return null;
  const normalized = compactString(value);
  if (!COMPATIBILITY_ADAPTERS.has(normalized)) {
    pushError(
      errors,
      '$.compatibilityAdapter',
      'unknown_adapter',
      `compatibilityAdapter must be one of: ${Array.from(COMPATIBILITY_ADAPTERS).join(', ')}.`
    );
    return null;
  }
  return normalized;
}

function validateClosedObjectKeys(input, allowedKeys, path, label, errors, { forbiddenMap = null, allowedExtraKeys = [] } = {}) {
  const seenAllowedExtras = new Set(allowedExtraKeys);
  const allowed = new Set([...allowedKeys, ...allowedExtraKeys]);

  for (const key of Object.keys(input)) {
    const keyPath = `${path}.${key}`;
    if (forbiddenMap instanceof Map && forbiddenMap.has(key)) {
      pushError(errors, keyPath, 'forbidden_field', forbiddenMap.get(key));
      continue;
    }

    if (!allowed.has(key)) {
      pushError(errors, keyPath, 'unknown_field', `${label} contains unsupported field "${key}".`);
      continue;
    }

    if (!allowedKeys.includes(key) && !seenAllowedExtras.has(key)) {
      pushError(errors, keyPath, 'unknown_field', `${label} contains unsupported field "${key}".`);
    }
  }
}

function validateContract(input, errors) {
  const path = '$.contract';
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    pushError(errors, path, 'invalid_type', 'contract must be an object.');
    return null;
  }

  validateClosedObjectKeys(input, REQUIRED_CONTRACT_FIELDS, path, 'contract', errors);

  const artifact = validateNonEmptyString(input.artifact, `${path}.artifact`, 'contract.artifact', errors);
  if (artifact && artifact !== 'dialogue-data') {
    pushError(errors, `${path}.artifact`, 'invalid_value', 'contract.artifact must be "dialogue-data".');
  }

  const mode = validateNonEmptyString(input.mode, `${path}.mode`, 'contract.mode', errors);
  if (mode && mode !== 'traits') {
    pushError(errors, `${path}.mode`, 'invalid_value', 'contract.mode must be "traits".');
  }

  const traitsContractVersion = validateNonEmptyString(
    input.traits_contract_version,
    `${path}.traits_contract_version`,
    'contract.traits_contract_version',
    errors
  );
  if (traitsContractVersion && traitsContractVersion !== '3.0.0') {
    pushError(errors, `${path}.traits_contract_version`, 'invalid_value', 'contract.traits_contract_version must be "3.0.0".');
  }

  return {
    artifact: artifact || null,
    mode: mode || null,
    traits_contract_version: traitsContractVersion || null
  };
}

function validateTraits(input, errors, segmentPath, options = {}) {
  const path = `${segmentPath}.traits`;
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    pushError(errors, path, 'invalid_type', 'traits must be an object.');
    return null;
  }

  const allowedLegacyFields = [];
  for (const [legacyField, rule] of SUPERSEDED_TRAIT_FIELDS.entries()) {
    if (options.compatibilityAdapter === rule.adapter) {
      allowedLegacyFields.push(legacyField);
    }
  }

  validateClosedObjectKeys(input, REQUIRED_TRAIT_FIELDS, path, 'traits', errors, { allowedExtraKeys: allowedLegacyFields });

  for (const field of REQUIRED_TRAIT_FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(input, field)) {
      pushError(errors, `${path}.${field}`, 'required_field', `traits.${field} is required.`);
    }
  }

  for (const [legacyField, rule] of SUPERSEDED_TRAIT_FIELDS.entries()) {
    if (!Object.prototype.hasOwnProperty.call(input, legacyField)) continue;
    if (options.compatibilityAdapter === rule.adapter) continue;

    pushError(
      errors,
      `${path}.${legacyField}`,
      'superseded_normative_name',
      `traits.${legacyField} is superseded in v3; use ${rule.replacement}. Only allow it when compatibilityAdapter="${rule.adapter}" is explicitly in play.`
    );
  }

  const normalized = {};
  for (const field of REQUIRED_TRAIT_FIELDS) {
    normalized[field] = validateStringEnum(
      input[field],
      TRAIT_ENUMS[field],
      `${path}.${field}`,
      `traits.${field}`,
      errors,
      { superseded: SUPERSEDED_TRAIT_VALUES[field] || null }
    );
  }

  return normalized;
}

function validateDialogueSegment(input, index, errors, options = {}) {
  const path = `$.dialogue_segments[${index}]`;
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    pushError(errors, path, 'invalid_type', 'dialogue_segments entries must be objects.');
    return null;
  }

  validateClosedObjectKeys(input, REQUIRED_SEGMENT_FIELDS, path, 'dialogue segment', errors, { forbiddenMap: FORBIDDEN_SEGMENT_FIELDS });

  for (const field of REQUIRED_SEGMENT_FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(input, field)) {
      pushError(errors, `${path}.${field}`, 'required_field', `dialogue_segments[*].${field} is required.`);
    }
  }

  const normalizedIndex = validateInteger(input.index, `${path}.index`, 'dialogue segment index', errors, { min: 0 });
  if (normalizedIndex !== null && normalizedIndex !== index) {
    pushError(errors, `${path}.index`, 'invalid_sequence', `dialogue segment index must match array order (${index}).`);
  }

  return {
    index: normalizedIndex,
    text: validateNonEmptyString(input.text, `${path}.text`, 'dialogue segment text', errors),
    traits: validateTraits(input.traits, errors, path, options)
  };
}

function validateDialogueV3SourceTruthObject(input, options = {}) {
  const errors = [];
  const compatibilityAdapter = normalizeCompatibilityAdapter(options.compatibilityAdapter, errors);

  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return {
      ok: false,
      value: null,
      errors: [{ path: '$', code: 'invalid_type', message: 'Dialogue v3 source truth must be a JSON object.' }],
      summary: 'Dialogue v3 source truth must be a JSON object. Return corrected JSON only.',
      meta: {
        stage: 'validation',
        compatibilityAdapter
      }
    };
  }

  validateClosedObjectKeys(input, REQUIRED_TOP_LEVEL_FIELDS, '$', 'dialogue-data', errors, { forbiddenMap: FORBIDDEN_TOP_LEVEL_FIELDS });

  for (const field of REQUIRED_TOP_LEVEL_FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(input, field)) {
      pushError(errors, `$.${field}`, 'required_field', `${field} is required.`);
    }
  }

  const schemaVersion = validateInteger(input.schema_version, '$.schema_version', 'schema_version', errors, { min: 1 });
  if (schemaVersion !== null && schemaVersion !== 1) {
    pushError(errors, '$.schema_version', 'invalid_value', 'schema_version must be 1 for the current authoritative v3 source-truth artifact.');
  }

  const dialogueSegmentsInput = input.dialogue_segments;
  if (!Array.isArray(dialogueSegmentsInput)) {
    pushError(errors, '$.dialogue_segments', 'required_array', 'dialogue_segments must be an array.');
  }

  const dialogueSegments = Array.isArray(dialogueSegmentsInput)
    ? dialogueSegmentsInput.map((segment, index) => validateDialogueSegment(segment, index, errors, { compatibilityAdapter })).filter(Boolean)
    : [];

  const normalized = {
    schema_version: schemaVersion,
    contract: validateContract(input.contract, errors),
    summary: validateNonEmptyString(input.summary, '$.summary', 'summary', errors),
    dialogue_segments: dialogueSegments
  };

  return {
    ok: errors.length === 0,
    value: errors.length === 0 ? normalized : null,
    errors,
    summary: summarizeValidationErrors('Dialogue v3 source-truth validation failed.', errors),
    meta: {
      stage: 'validation',
      compatibilityAdapter
    }
  };
}

function parseDialogueV3SourceTruthResponse(input, options = {}) {
  return parseAndValidateJsonObject(input, (value) => validateDialogueV3SourceTruthObject(value, options));
}

function buildDialogueV3SourceTruthValidatorToolContract() {
  return {
    name: TOOL_NAME,
    argumentKey: 'dialogueData',
    description: 'Validate the authoritative persisted v3 dialogue-data source-truth artifact. This validator enforces the v3 envelope only and does not know grouping semantics or the YAML ruleset.',
    canonicalEnvelope: {
      tool: TOOL_NAME,
      dialogueData: {
        schema_version: 1,
        contract: {
          artifact: 'dialogue-data',
          mode: 'traits',
          traits_contract_version: '3.0.0'
        },
        summary: 'A terse exchange with mixed direct and radio delivery.',
        dialogue_segments: [
          {
            index: 0,
            text: 'Hold position until I call it.',
            traits: {
              audibility: 'clear',
              overlap: 'single_voice',
              gender_presentation: 'masculine',
              age_impression: 'adult',
              pitch_band: 'mid',
              phonation: 'clear',
              pace: 'measured',
              energy: 'steady',
              transmission_medium: 'radio',
              spatial_texture: 'room',
              accent_strength: 'none_apparent',
              accent_family: 'neutral_or_unmarked',
              affect: 'serious',
              interpersonal_stance: 'directive',
              delivery_overlay: 'none_apparent'
            }
          }
        ]
      }
    },
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        dialogueData: {
          type: 'object'
        }
      },
      required: ['dialogueData']
    }
  };
}

function executeDialogueV3SourceTruthValidatorTool(args = {}, options = {}) {
  const result = validateDialogueV3SourceTruthObject(args.dialogueData, options);
  return {
    ok: result.ok,
    valid: result.ok,
    toolName: TOOL_NAME,
    summary: result.summary,
    errors: result.errors,
    normalizedValue: result.value,
    meta: result.meta
  };
}

module.exports = {
  TOOL_NAME,
  REQUIRED_TOP_LEVEL_FIELDS,
  REQUIRED_CONTRACT_FIELDS,
  REQUIRED_SEGMENT_FIELDS,
  REQUIRED_TRAIT_FIELDS,
  TRAIT_ENUMS,
  COMPATIBILITY_ADAPTERS,
  validateDialogueV3SourceTruthObject,
  parseDialogueV3SourceTruthResponse,
  buildDialogueV3SourceTruthValidatorToolContract,
  executeDialogueV3SourceTruthValidatorTool
};
