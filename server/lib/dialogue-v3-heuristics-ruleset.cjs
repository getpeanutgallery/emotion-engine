const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

const {
  REQUIRED_TRAIT_FIELDS,
  TRAIT_ENUMS
} = require('./dialogue-v3-source-truth-validator.cjs');
const {
  compactString,
  summarizeValidationErrors
} = require('./structured-output.cjs');

const SUPPORTED_BUCKET_NAMES = Object.freeze([
  'stable_identity_cues',
  'delivery_cues',
  'production_context_cues',
  'gating_cues'
]);

const SUPPORTED_BUCKET_AUTHORITIES = Object.freeze([
  'primary',
  'secondary',
  'reliability_only'
]);

const SUPPORTED_BUCKET_ROLES = Object.freeze([
  'positive_negative_evidence_and_limited_blockers',
  'positive_negative_evidence_only',
  'soft_evidence_and_mismatch_guard',
  'weighting_guard_reuse_guard_abstention_guard'
]);

const SUPPORTED_SENTINEL_NAMES = Object.freeze([
  'unknown',
  'mixed',
  'variable',
  'none_apparent'
]);

const SUPPORTED_COMPARISON_RELATION_NAMES = Object.freeze([
  'exact_match',
  'soft_match',
  'mismatch',
  'abstain',
  'ambiguous'
]);

const SUPPORTED_FIELD_POLICY_FIELDS = Object.freeze([
  'gender_presentation',
  'age_impression',
  'pitch_band',
  'phonation',
  'accent_strength',
  'accent_family',
  'pace',
  'energy',
  'affect',
  'interpersonal_stance',
  'delivery_overlay',
  'transmission_medium',
  'spatial_texture',
  'audibility',
  'overlap'
]);

const SUPPORTED_RULE_RELATIONS = Object.freeze([
  'exact_match',
  'mismatch'
]);

const SUPPORTED_RULE_COMBINE_VALUES = Object.freeze([
  'additive'
]);

const SUPPORTED_RULE_SEVERITIES = Object.freeze([
  'hard',
  'soft_review_block'
]);

const SUPPORTED_BLOCKER_ACTIONS = Object.freeze([
  'hard_block',
  'soft_blocker_review'
]);

const SUPPORTED_BOOLEAN_CONDITION_KEYS = Object.freeze([
  'require_clean_gating',
  'require_additional_clean_identity_mismatch',
  'no_hard_blocker',
  'clean_reuse_gate',
  'both_values_concrete',
  'values_must_differ',
  'and_top_score_below_reuse_threshold'
]);

const SUPPORTED_INTEGER_CONDITION_KEYS = Object.freeze([
  'candidate_group_has_at_least',
  'matched_stable_identity_fields_at_least',
  'max_index_distance',
  'contradictory_exact_mismatches_at_least',
  'additional_stable_identity_mismatches_at_least',
  'matched_concrete_stable_identity_fields_below'
]);

const SUPPORTED_SCALAR_ENUM_CONDITION_KEYS = Object.freeze([
  'action_under_consideration',
  'require_accent_strength_support',
  'line_accent_strength_must_be',
  'group_accent_strength_must_be',
  'line_value',
  'group_value'
]);

const SUPPORTED_ARRAY_ENUM_CONDITION_KEYS = Object.freeze([
  'line_value_in',
  'group_value_in',
  'line_value_not_in',
  'group_value_not_in',
  'neither_value_in',
  'required_fields_among'
]);

const SUPPORTED_TOP_LEVEL_KEYS = Object.freeze([
  'schema_version',
  'ruleset',
  'compatibility',
  'supersession',
  'canonicalization',
  'sentinel_policy',
  'comparison_relations',
  'field_policies',
  'reliability_policy',
  'positive_evidence_rules',
  'negative_evidence_rules',
  'blocker_policy',
  'ambiguity_policy',
  'thresholds',
  'tie_breakers',
  'cleanup_policy',
  'warning_level_guardrails',
  'forbidden_patterns',
  'explainability_requirements',
  'implementation_posture'
]);

const SUPPORTED_RULESET_KEYS = Object.freeze([
  'id',
  'version',
  'status',
  'description',
  'ownership'
]);

const SUPPORTED_OWNERSHIP_KEYS = Object.freeze([
  'source_truth_artifact',
  'source_truth_mode',
  'grouping_output_artifact',
  'source_truth_owns',
  'grouping_owns',
  'source_truth_forbidden'
]);

const SUPPORTED_SOURCE_TRUTH_FORBIDDEN_KEYS = Object.freeze([
  'top_level',
  'per_segment'
]);

const SUPPORTED_COMPATIBILITY_KEYS = Object.freeze([
  'dialogue_schema_version',
  'traits_contract_version',
  'grouping_output_version',
  'required_contract',
  'required_top_level_fields',
  'required_segment_fields',
  'required_traits_fields',
  'closed_traits_object'
]);

const SUPPORTED_REQUIRED_CONTRACT_KEYS = Object.freeze([
  'artifact',
  'mode'
]);

const SUPPORTED_SUPERSESSION_KEYS = Object.freeze([
  'supersedes_reference',
  'notes'
]);

const SUPPORTED_CANONICALIZATION_KEYS = Object.freeze([
  'buckets'
]);

const SUPPORTED_BUCKET_KEYS = Object.freeze([
  'fields',
  'authority',
  'role'
]);

const SUPPORTED_SENTINEL_KEYS = Object.freeze([
  'meaning',
  'default_relation',
  'positive_score',
  'negative_score',
  'blocker_eligible',
  'exact_match_allowed',
  'default_positive_multiplier',
  'default_negative_multiplier'
]);

const SUPPORTED_FIELD_POLICY_KEYS = Object.freeze([
  'exact_match_positive',
  'mismatch_negative',
  'adjacent_band_soft_match_positive',
  'distant_band_mismatch_negative',
  'blocker_when',
  'reliable_values',
  'degraded_values'
]);

const SUPPORTED_RELIABILITY_POLICY_KEYS = Object.freeze([
  'clean_reuse_gate',
  'degraded_penalties',
  'degraded_behavior'
]);

const SUPPORTED_CLEAN_REUSE_GATE_KEYS = Object.freeze([
  'audibility_must_be',
  'overlap_must_be'
]);

const SUPPORTED_DEGRADED_PENALTIES_KEYS = Object.freeze([
  'audibility',
  'overlap'
]);

const SUPPORTED_DEGRADED_BEHAVIOR_KEYS = Object.freeze([
  'suppress_hard_blockers_when_not_clean',
  'downgrade_soft_matches_when_not_clean',
  'prefer_new_group_or_ambiguous_assignment_when_scores_are_close'
]);

const SUPPORTED_EVIDENCE_RULE_KEYS = Object.freeze([
  'id',
  'applies_to_bucket',
  'relation',
  'combine',
  'weight',
  'source',
  'applies_when'
]);

const SUPPORTED_BLOCKER_POLICY_KEYS = Object.freeze([
  'philosophy',
  'rules'
]);

const SUPPORTED_BLOCKER_RULE_KEYS = Object.freeze([
  'id',
  'source_field',
  'severity',
  'only_when'
]);

const SUPPORTED_AMBIGUITY_POLICY_KEYS = Object.freeze([
  'ambiguous_assignment_allowed',
  'create_new_group_when_no_candidate_clears_assign_threshold',
  'mark_ambiguous_when',
  'force_abstention_review_when',
  'ambiguity_outputs'
]);

const SUPPORTED_MARK_AMBIGUOUS_KEYS = Object.freeze([
  'top_score_clears_assign_threshold',
  'top_margin_below'
]);

const SUPPORTED_FORCE_ABSTENTION_KEYS = Object.freeze([
  'matched_concrete_stable_identity_fields_below',
  'and_top_score_below_reuse_threshold'
]);

const SUPPORTED_THRESHOLDS_KEYS = Object.freeze([
  'assign_threshold',
  'reuse_threshold',
  'ambiguity_margin',
  'singleton_merge_threshold',
  'split_review_threshold',
  'minimum_clean_identity_matches_for_confident_reuse'
]);

const SUPPORTED_CLEANUP_POLICY_KEYS = Object.freeze([
  'enable_singleton_merge_pass',
  'enable_split_pass',
  'singleton_merge_requirements',
  'split_policy'
]);

const SUPPORTED_SINGLETON_MERGE_REQUIREMENTS_KEYS = Object.freeze([
  'clean_reuse_gate_preferred',
  'score_must_clear',
  'no_hard_blocker',
  'matched_concrete_stable_identity_fields_at_least'
]);

const SUPPORTED_SPLIT_POLICY_KEYS = Object.freeze([
  'posture',
  'note'
]);

const SUPPORTED_WARNING_LEVEL_GUARDRAILS_KEYS = Object.freeze([
  'cross_field_checks'
]);

const SUPPORTED_CROSS_FIELD_CHECK_KEYS = Object.freeze([
  'id',
  'when',
  'level',
  'reason'
]);

const SUPPORTED_EXPLAINABILITY_REQUIREMENTS_KEYS = Object.freeze([
  'per_assignment_must_record',
  'allowed_reason_vocabulary'
]);

const SUPPORTED_IMPLEMENTATION_POSTURE_KEYS = Object.freeze([
  'design_only',
  'no_runtime_code_locked_here',
  'benchmark_tuning_expected',
  'initial_next_step'
]);

const SUPPORTED_TIE_BREAKERS = Object.freeze([
  'highest_score',
  'fewest_stable_identity_mismatches',
  'cleanest_gating_profile',
  'nearest_previous_occurrence',
  'earliest_group_creation'
]);

const SUPPORTED_TIE_BREAKER_OBJECT_KEYS = Object.freeze([
  'most_exact_matches_in_bucket'
]);

const SUPPORTED_WARNING_LEVELS = Object.freeze([
  'warning'
]);

const SUPPORTED_WARNING_WHEN_KEYS = Object.freeze([
  'accent_strength',
  'accent_family_not',
  'accent_family',
  'accent_strength_not_in',
  'delivery_overlay_in',
  'transmission_medium',
  'any_field'
]);

const SUPPORTED_FORBIDDEN_PATTERNS = Object.freeze([
  'role_labels',
  'lore_labels',
  'biography_inference',
  'geography_prose',
  'open_text_traits',
  'source_truth_speaker_fields',
  'source_truth_grouping_outputs',
  'normalization_of_unknown_mixed_or_variable_to_concrete_values',
  'using_delivery_cues_alone_as_hard_blockers',
  'using_production_context_cues_alone_as_hard_blockers'
]);

const SUPPORTED_ACTION_UNDER_CONSIDERATION = Object.freeze([
  'create_group'
]);

const SUPPORTED_ACCENT_STRENGTH_SUPPORT = Object.freeze([
  'clear_non_neutral'
]);

const SUPPORTED_ALLOWED_REASON_VOCABULARY = Object.freeze([
  ...SUPPORTED_FIELD_POLICY_FIELDS,
  ...SUPPORTED_BUCKET_NAMES
]);

const SUPPORTS_RULESET_SCHEMA_VERSION = 1;

function pushError(errors, path, code, message) {
  errors.push({ path, code, message });
}

function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function validateClosedKeys(input, allowedKeys, errors, basePath, label) {
  for (const key of Object.keys(input)) {
    if (!allowedKeys.includes(key)) {
      pushError(errors, `${basePath}.${key}`, 'unknown_key', `${label} contains unsupported key "${key}".`);
    }
  }
}

function validateNonEmptyString(value, errors, path, label) {
  const normalized = compactString(value);
  if (!normalized) {
    pushError(errors, path, 'required_string', `${label} must be a non-empty string.`);
    return null;
  }
  return normalized;
}

function validateBoolean(value, errors, path, label) {
  if (typeof value !== 'boolean') {
    pushError(errors, path, 'required_boolean', `${label} must be a boolean.`);
    return null;
  }
  return value;
}

function validateFiniteNumber(value, errors, path, label) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    pushError(errors, path, 'required_number', `${label} must be a finite number.`);
    return null;
  }
  return value;
}

function validateInteger(value, errors, path, label, { min = null } = {}) {
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

function validatePlainObject(value, errors, path, label) {
  if (!isPlainObject(value)) {
    pushError(errors, path, 'invalid_type', `${label} must be an object.`);
    return null;
  }
  return value;
}

function validateStringArray(value, errors, path, label, { minLength = 0, allowedValues = null } = {}) {
  if (!Array.isArray(value)) {
    pushError(errors, path, 'required_array', `${label} must be an array.`);
    return null;
  }

  if (value.length < minLength) {
    pushError(errors, path, 'required_non_empty_array', `${label} must contain at least ${minLength} entr${minLength === 1 ? 'y' : 'ies'}.`);
  }

  const normalized = [];
  value.forEach((entry, index) => {
    const itemPath = `${path}[${index}]`;
    const item = validateNonEmptyString(entry, errors, itemPath, `${label} entry`);
    if (!item) return;
    if (allowedValues && !allowedValues.includes(item)) {
      pushError(errors, itemPath, 'invalid_enum_reference', `${label} entry must be one of: ${allowedValues.join(', ')}.`);
      return;
    }
    normalized.push(item);
  });

  return normalized;
}

function validateScalarEnum(value, errors, path, label, allowedValues) {
  const normalized = validateNonEmptyString(value, errors, path, label);
  if (!normalized) return null;
  if (!allowedValues.includes(normalized)) {
    pushError(errors, path, 'invalid_enum_reference', `${label} must be one of: ${allowedValues.join(', ')}.`);
    return null;
  }
  return normalized;
}

function validateStringMapOfFiniteNumbers(value, errors, path, label, allowedKeys, allowedValueEnum) {
  const input = validatePlainObject(value, errors, path, label);
  if (!input) return null;
  validateClosedKeys(input, allowedKeys, errors, path, label);

  const normalized = {};
  for (const key of allowedKeys) {
    const item = input[key];
    if (item === undefined) continue;
    if (allowedValueEnum && !allowedValueEnum.includes(key)) {
      pushError(errors, `${path}.${key}`, 'invalid_enum_reference', `${label} contains unsupported key "${key}".`);
      continue;
    }
    normalized[key] = validateFiniteNumber(item, errors, `${path}.${key}`, `${label}.${key}`);
  }
  return normalized;
}

function validateConditionObject(input, errors, path, label, { extraAllowedKeys = [] } = {}) {
  const objectValue = validatePlainObject(input, errors, path, label);
  if (!objectValue) return null;

  const allowedKeys = [
    ...SUPPORTED_BOOLEAN_CONDITION_KEYS,
    ...SUPPORTED_INTEGER_CONDITION_KEYS,
    ...SUPPORTED_SCALAR_ENUM_CONDITION_KEYS,
    ...SUPPORTED_ARRAY_ENUM_CONDITION_KEYS,
    ...extraAllowedKeys
  ];
  validateClosedKeys(objectValue, allowedKeys, errors, path, label);

  const normalized = {};

  for (const key of Object.keys(objectValue)) {
    const keyPath = `${path}.${key}`;
    const value = objectValue[key];

    if (SUPPORTED_BOOLEAN_CONDITION_KEYS.includes(key)) {
      normalized[key] = validateBoolean(value, errors, keyPath, `${label}.${key}`);
      continue;
    }

    if (SUPPORTED_INTEGER_CONDITION_KEYS.includes(key)) {
      normalized[key] = validateInteger(value, errors, keyPath, `${label}.${key}`, { min: 0 });
      continue;
    }

    if (SUPPORTED_SCALAR_ENUM_CONDITION_KEYS.includes(key)) {
      if (key === 'action_under_consideration') {
        normalized[key] = validateScalarEnum(value, errors, keyPath, `${label}.${key}`, SUPPORTED_ACTION_UNDER_CONSIDERATION);
      } else if (key === 'require_accent_strength_support' || key === 'line_accent_strength_must_be' || key === 'group_accent_strength_must_be') {
        normalized[key] = validateScalarEnum(value, errors, keyPath, `${label}.${key}`, SUPPORTED_ACCENT_STRENGTH_SUPPORT);
      } else {
        normalized[key] = validateNonEmptyString(value, errors, keyPath, `${label}.${key}`);
      }
      continue;
    }

    if (SUPPORTED_ARRAY_ENUM_CONDITION_KEYS.includes(key)) {
      if (key === 'required_fields_among') {
        normalized[key] = validateStringArray(value, errors, keyPath, `${label}.${key}`, {
          minLength: 1,
          allowedValues: ['gender_presentation', 'pitch_band', 'phonation', 'accent_family']
        });
      } else {
        normalized[key] = validateStringArray(value, errors, keyPath, `${label}.${key}`, { minLength: 1 });
      }
    }
  }

  return normalized;
}

function validateOwnership(input, errors, path) {
  const value = validatePlainObject(input, errors, path, 'ruleset.ownership');
  if (!value) return null;
  validateClosedKeys(value, SUPPORTED_OWNERSHIP_KEYS, errors, path, 'ruleset.ownership');

  const sourceTruthForbidden = validatePlainObject(value.source_truth_forbidden, errors, `${path}.source_truth_forbidden`, 'ruleset.ownership.source_truth_forbidden');
  if (sourceTruthForbidden) {
    validateClosedKeys(
      sourceTruthForbidden,
      SUPPORTED_SOURCE_TRUTH_FORBIDDEN_KEYS,
      errors,
      `${path}.source_truth_forbidden`,
      'ruleset.ownership.source_truth_forbidden'
    );
  }

  return {
    source_truth_artifact: validateScalarEnum(value.source_truth_artifact, errors, `${path}.source_truth_artifact`, 'ruleset.ownership.source_truth_artifact', ['dialogue-data']),
    source_truth_mode: validateScalarEnum(value.source_truth_mode, errors, `${path}.source_truth_mode`, 'ruleset.ownership.source_truth_mode', ['traits']),
    grouping_output_artifact: validateScalarEnum(value.grouping_output_artifact, errors, `${path}.grouping_output_artifact`, 'ruleset.ownership.grouping_output_artifact', ['speaker-grouping']),
    source_truth_owns: validateStringArray(value.source_truth_owns, errors, `${path}.source_truth_owns`, 'ruleset.ownership.source_truth_owns', { minLength: 1 }),
    grouping_owns: validateStringArray(value.grouping_owns, errors, `${path}.grouping_owns`, 'ruleset.ownership.grouping_owns', { minLength: 1 }),
    source_truth_forbidden: sourceTruthForbidden ? {
      top_level: validateStringArray(sourceTruthForbidden.top_level, errors, `${path}.source_truth_forbidden.top_level`, 'ruleset.ownership.source_truth_forbidden.top_level', { minLength: 1 }),
      per_segment: validateStringArray(sourceTruthForbidden.per_segment, errors, `${path}.source_truth_forbidden.per_segment`, 'ruleset.ownership.source_truth_forbidden.per_segment', { minLength: 1 })
    } : null
  };
}

function validateCompatibility(input, errors, path) {
  const value = validatePlainObject(input, errors, path, 'ruleset.compatibility');
  if (!value) return null;
  validateClosedKeys(value, SUPPORTED_COMPATIBILITY_KEYS, errors, path, 'ruleset.compatibility');

  const requiredContract = validatePlainObject(value.required_contract, errors, `${path}.required_contract`, 'ruleset.compatibility.required_contract');
  if (requiredContract) {
    validateClosedKeys(requiredContract, SUPPORTED_REQUIRED_CONTRACT_KEYS, errors, `${path}.required_contract`, 'ruleset.compatibility.required_contract');
  }

  return {
    dialogue_schema_version: validateScalarEnum(value.dialogue_schema_version, errors, `${path}.dialogue_schema_version`, 'ruleset.compatibility.dialogue_schema_version', ['1.x']),
    traits_contract_version: validateScalarEnum(value.traits_contract_version, errors, `${path}.traits_contract_version`, 'ruleset.compatibility.traits_contract_version', ['3.x']),
    grouping_output_version: validateScalarEnum(value.grouping_output_version, errors, `${path}.grouping_output_version`, 'ruleset.compatibility.grouping_output_version', ['3.x']),
    required_contract: requiredContract ? {
      artifact: validateScalarEnum(requiredContract.artifact, errors, `${path}.required_contract.artifact`, 'ruleset.compatibility.required_contract.artifact', ['dialogue-data']),
      mode: validateScalarEnum(requiredContract.mode, errors, `${path}.required_contract.mode`, 'ruleset.compatibility.required_contract.mode', ['traits'])
    } : null,
    required_top_level_fields: validateStringArray(value.required_top_level_fields, errors, `${path}.required_top_level_fields`, 'ruleset.compatibility.required_top_level_fields', { minLength: 1 }),
    required_segment_fields: validateStringArray(value.required_segment_fields, errors, `${path}.required_segment_fields`, 'ruleset.compatibility.required_segment_fields', { minLength: 1 }),
    required_traits_fields: validateStringArray(value.required_traits_fields, errors, `${path}.required_traits_fields`, 'ruleset.compatibility.required_traits_fields', {
      minLength: REQUIRED_TRAIT_FIELDS.length,
      allowedValues: REQUIRED_TRAIT_FIELDS
    }),
    closed_traits_object: validateBoolean(value.closed_traits_object, errors, `${path}.closed_traits_object`, 'ruleset.compatibility.closed_traits_object')
  };
}

function validateSupersession(input, errors, path) {
  const value = validatePlainObject(input, errors, path, 'ruleset.supersession');
  if (!value) return null;
  validateClosedKeys(value, SUPPORTED_SUPERSESSION_KEYS, errors, path, 'ruleset.supersession');

  return {
    supersedes_reference: validateNonEmptyString(value.supersedes_reference, errors, `${path}.supersedes_reference`, 'ruleset.supersession.supersedes_reference'),
    notes: validateStringArray(value.notes, errors, `${path}.notes`, 'ruleset.supersession.notes', { minLength: 1 })
  };
}

function validateCanonicalization(input, errors, path) {
  const value = validatePlainObject(input, errors, path, 'ruleset.canonicalization');
  if (!value) return null;
  validateClosedKeys(value, SUPPORTED_CANONICALIZATION_KEYS, errors, path, 'ruleset.canonicalization');

  const buckets = validatePlainObject(value.buckets, errors, `${path}.buckets`, 'ruleset.canonicalization.buckets');
  if (!buckets) return null;

  const normalizedBuckets = {};
  for (const key of Object.keys(buckets)) {
    const bucketPath = `${path}.buckets.${key}`;
    if (!SUPPORTED_BUCKET_NAMES.includes(key)) {
      pushError(errors, bucketPath, 'invalid_enum_reference', `ruleset.canonicalization.buckets contains unsupported bucket "${key}".`);
      continue;
    }

    const bucket = validatePlainObject(buckets[key], errors, bucketPath, `ruleset.canonicalization.buckets.${key}`);
    if (!bucket) continue;
    validateClosedKeys(bucket, SUPPORTED_BUCKET_KEYS, errors, bucketPath, `ruleset.canonicalization.buckets.${key}`);

    const allowedFields = key === 'gating_cues'
      ? ['audibility', 'overlap']
      : SUPPORTED_FIELD_POLICY_FIELDS.filter((field) => !['audibility', 'overlap'].includes(field));

    normalizedBuckets[key] = {
      fields: validateStringArray(bucket.fields, errors, `${bucketPath}.fields`, `ruleset.canonicalization.buckets.${key}.fields`, {
        minLength: 1,
        allowedValues: allowedFields
      }),
      authority: validateScalarEnum(bucket.authority, errors, `${bucketPath}.authority`, `ruleset.canonicalization.buckets.${key}.authority`, SUPPORTED_BUCKET_AUTHORITIES),
      role: validateScalarEnum(bucket.role, errors, `${bucketPath}.role`, `ruleset.canonicalization.buckets.${key}.role`, SUPPORTED_BUCKET_ROLES)
    };
  }

  for (const bucketName of SUPPORTED_BUCKET_NAMES) {
    if (!Object.prototype.hasOwnProperty.call(buckets, bucketName)) {
      pushError(errors, `${path}.buckets.${bucketName}`, 'required_field', `ruleset.canonicalization.buckets.${bucketName} is required.`);
    }
  }

  return { buckets: normalizedBuckets };
}

function validateSentinelPolicy(input, errors, path) {
  const value = validatePlainObject(input, errors, path, 'ruleset.sentinel_policy');
  if (!value) return null;

  const normalized = {};
  for (const key of Object.keys(value)) {
    const sentinelPath = `${path}.${key}`;
    if (!SUPPORTED_SENTINEL_NAMES.includes(key)) {
      pushError(errors, sentinelPath, 'invalid_enum_reference', `ruleset.sentinel_policy contains unsupported sentinel "${key}".`);
      continue;
    }

    const sentinel = validatePlainObject(value[key], errors, sentinelPath, `ruleset.sentinel_policy.${key}`);
    if (!sentinel) continue;
    validateClosedKeys(sentinel, SUPPORTED_SENTINEL_KEYS, errors, sentinelPath, `ruleset.sentinel_policy.${key}`);

    normalized[key] = {
      meaning: validateNonEmptyString(sentinel.meaning, errors, `${sentinelPath}.meaning`, `ruleset.sentinel_policy.${key}.meaning`),
      ...(sentinel.default_relation !== undefined ? {
        default_relation: validateScalarEnum(sentinel.default_relation, errors, `${sentinelPath}.default_relation`, `ruleset.sentinel_policy.${key}.default_relation`, ['abstain', 'ambiguous', 'unstable', 'concrete'])
      } : {}),
      ...(sentinel.blocker_eligible !== undefined ? {
        blocker_eligible: validateBoolean(sentinel.blocker_eligible, errors, `${sentinelPath}.blocker_eligible`, `ruleset.sentinel_policy.${key}.blocker_eligible`)
      } : {}),
      ...(sentinel.positive_score !== undefined ? { positive_score: validateFiniteNumber(sentinel.positive_score, errors, `${sentinelPath}.positive_score`, `ruleset.sentinel_policy.${key}.positive_score`) } : {}),
      ...(sentinel.negative_score !== undefined ? { negative_score: validateFiniteNumber(sentinel.negative_score, errors, `${sentinelPath}.negative_score`, `ruleset.sentinel_policy.${key}.negative_score`) } : {}),
      ...(sentinel.exact_match_allowed !== undefined ? { exact_match_allowed: validateBoolean(sentinel.exact_match_allowed, errors, `${sentinelPath}.exact_match_allowed`, `ruleset.sentinel_policy.${key}.exact_match_allowed`) } : {}),
      ...(sentinel.default_positive_multiplier !== undefined ? { default_positive_multiplier: validateFiniteNumber(sentinel.default_positive_multiplier, errors, `${sentinelPath}.default_positive_multiplier`, `ruleset.sentinel_policy.${key}.default_positive_multiplier`) } : {}),
      ...(sentinel.default_negative_multiplier !== undefined ? { default_negative_multiplier: validateFiniteNumber(sentinel.default_negative_multiplier, errors, `${sentinelPath}.default_negative_multiplier`, `ruleset.sentinel_policy.${key}.default_negative_multiplier`) } : {})
    };
  }

  for (const sentinelName of SUPPORTED_SENTINEL_NAMES) {
    if (!Object.prototype.hasOwnProperty.call(value, sentinelName)) {
      pushError(errors, `${path}.${sentinelName}`, 'required_field', `ruleset.sentinel_policy.${sentinelName} is required.`);
    }
  }

  return normalized;
}

function validateComparisonRelations(input, errors, path) {
  const value = validatePlainObject(input, errors, path, 'ruleset.comparison_relations');
  if (!value) return null;

  const normalized = {};
  for (const key of Object.keys(value)) {
    const keyPath = `${path}.${key}`;
    if (!SUPPORTED_COMPARISON_RELATION_NAMES.includes(key)) {
      pushError(errors, keyPath, 'invalid_enum_reference', `ruleset.comparison_relations contains unsupported relation "${key}".`);
      continue;
    }
    normalized[key] = validateNonEmptyString(value[key], errors, keyPath, `ruleset.comparison_relations.${key}`);
  }

  for (const relation of SUPPORTED_COMPARISON_RELATION_NAMES) {
    if (!Object.prototype.hasOwnProperty.call(value, relation)) {
      pushError(errors, `${path}.${relation}`, 'required_field', `ruleset.comparison_relations.${relation} is required.`);
    }
  }

  return normalized;
}

function validateFieldPolicies(input, errors, path) {
  const value = validatePlainObject(input, errors, path, 'ruleset.field_policies');
  if (!value) return null;

  const normalized = {};
  for (const key of Object.keys(value)) {
    const fieldPath = `${path}.${key}`;
    if (!SUPPORTED_FIELD_POLICY_FIELDS.includes(key)) {
      pushError(errors, fieldPath, 'invalid_enum_reference', `ruleset.field_policies contains unsupported field "${key}".`);
      continue;
    }

    const fieldPolicy = validatePlainObject(value[key], errors, fieldPath, `ruleset.field_policies.${key}`);
    if (!fieldPolicy) continue;
    validateClosedKeys(fieldPolicy, SUPPORTED_FIELD_POLICY_KEYS, errors, fieldPath, `ruleset.field_policies.${key}`);

    const normalizedPolicy = {
      blocker_when: []
    };

    if (fieldPolicy.exact_match_positive !== undefined) {
      normalizedPolicy.exact_match_positive = validateFiniteNumber(fieldPolicy.exact_match_positive, errors, `${fieldPath}.exact_match_positive`, `ruleset.field_policies.${key}.exact_match_positive`);
    }
    if (fieldPolicy.mismatch_negative !== undefined) {
      normalizedPolicy.mismatch_negative = validateFiniteNumber(fieldPolicy.mismatch_negative, errors, `${fieldPath}.mismatch_negative`, `ruleset.field_policies.${key}.mismatch_negative`);
    }
    if (fieldPolicy.adjacent_band_soft_match_positive !== undefined) {
      normalizedPolicy.adjacent_band_soft_match_positive = validateFiniteNumber(fieldPolicy.adjacent_band_soft_match_positive, errors, `${fieldPath}.adjacent_band_soft_match_positive`, `ruleset.field_policies.${key}.adjacent_band_soft_match_positive`);
    }
    if (fieldPolicy.distant_band_mismatch_negative !== undefined) {
      normalizedPolicy.distant_band_mismatch_negative = validateFiniteNumber(fieldPolicy.distant_band_mismatch_negative, errors, `${fieldPath}.distant_band_mismatch_negative`, `ruleset.field_policies.${key}.distant_band_mismatch_negative`);
    }

    if (fieldPolicy.blocker_when !== undefined) {
      if (!Array.isArray(fieldPolicy.blocker_when)) {
        pushError(errors, `${fieldPath}.blocker_when`, 'required_array', `ruleset.field_policies.${key}.blocker_when must be an array.`);
      } else {
        normalizedPolicy.blocker_when = fieldPolicy.blocker_when.map((entry, index) => {
          const entryPath = `${fieldPath}.blocker_when[${index}]`;
          const condition = validateConditionObject(entry, errors, entryPath, `ruleset.field_policies.${key}.blocker_when[${index}]`, { extraAllowedKeys: ['action'] });
          if (!condition) return null;
          if (condition.action) {
            condition.action = validateScalarEnum(condition.action, errors, `${entryPath}.action`, `${entryPath}.action`, SUPPORTED_BLOCKER_ACTIONS);
          }
          return condition;
        }).filter(Boolean);
      }
    }

    if (fieldPolicy.reliable_values !== undefined) {
      normalizedPolicy.reliable_values = validateStringArray(
        fieldPolicy.reliable_values,
        errors,
        `${fieldPath}.reliable_values`,
        `ruleset.field_policies.${key}.reliable_values`,
        { minLength: 1, allowedValues: TRAIT_ENUMS[key] || null }
      );
    }

    if (fieldPolicy.degraded_values !== undefined) {
      normalizedPolicy.degraded_values = validateStringArray(
        fieldPolicy.degraded_values,
        errors,
        `${fieldPath}.degraded_values`,
        `ruleset.field_policies.${key}.degraded_values`,
        { minLength: 1, allowedValues: TRAIT_ENUMS[key] || null }
      );
    }

    normalized[key] = normalizedPolicy;
  }

  for (const requiredField of SUPPORTED_FIELD_POLICY_FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(value, requiredField)) {
      pushError(errors, `${path}.${requiredField}`, 'required_field', `ruleset.field_policies.${requiredField} is required.`);
    }
  }

  return normalized;
}

function validateReliabilityPolicy(input, errors, path) {
  const value = validatePlainObject(input, errors, path, 'ruleset.reliability_policy');
  if (!value) return null;
  validateClosedKeys(value, SUPPORTED_RELIABILITY_POLICY_KEYS, errors, path, 'ruleset.reliability_policy');

  const cleanReuseGate = validatePlainObject(value.clean_reuse_gate, errors, `${path}.clean_reuse_gate`, 'ruleset.reliability_policy.clean_reuse_gate');
  if (cleanReuseGate) {
    validateClosedKeys(cleanReuseGate, SUPPORTED_CLEAN_REUSE_GATE_KEYS, errors, `${path}.clean_reuse_gate`, 'ruleset.reliability_policy.clean_reuse_gate');
  }

  const degradedPenalties = validatePlainObject(value.degraded_penalties, errors, `${path}.degraded_penalties`, 'ruleset.reliability_policy.degraded_penalties');
  if (degradedPenalties) {
    validateClosedKeys(degradedPenalties, SUPPORTED_DEGRADED_PENALTIES_KEYS, errors, `${path}.degraded_penalties`, 'ruleset.reliability_policy.degraded_penalties');
  }

  const degradedBehavior = validatePlainObject(value.degraded_behavior, errors, `${path}.degraded_behavior`, 'ruleset.reliability_policy.degraded_behavior');
  if (degradedBehavior) {
    validateClosedKeys(degradedBehavior, SUPPORTED_DEGRADED_BEHAVIOR_KEYS, errors, `${path}.degraded_behavior`, 'ruleset.reliability_policy.degraded_behavior');
  }

  return {
    clean_reuse_gate: cleanReuseGate ? {
      audibility_must_be: validateScalarEnum(cleanReuseGate.audibility_must_be, errors, `${path}.clean_reuse_gate.audibility_must_be`, 'ruleset.reliability_policy.clean_reuse_gate.audibility_must_be', TRAIT_ENUMS.audibility),
      overlap_must_be: validateScalarEnum(cleanReuseGate.overlap_must_be, errors, `${path}.clean_reuse_gate.overlap_must_be`, 'ruleset.reliability_policy.clean_reuse_gate.overlap_must_be', TRAIT_ENUMS.overlap)
    } : null,
    degraded_penalties: degradedPenalties ? {
      audibility: validateStringMapOfFiniteNumbers(degradedPenalties.audibility, errors, `${path}.degraded_penalties.audibility`, 'ruleset.reliability_policy.degraded_penalties.audibility', ['partially_masked', 'heavily_masked', 'unknown'], ['partially_masked', 'heavily_masked', 'unknown']),
      overlap: validateStringMapOfFiniteNumbers(degradedPenalties.overlap, errors, `${path}.degraded_penalties.overlap`, 'ruleset.reliability_policy.degraded_penalties.overlap', ['background_overlap', 'competing_overlap', 'unknown'], ['background_overlap', 'competing_overlap', 'unknown'])
    } : null,
    degraded_behavior: degradedBehavior ? {
      suppress_hard_blockers_when_not_clean: validateBoolean(degradedBehavior.suppress_hard_blockers_when_not_clean, errors, `${path}.degraded_behavior.suppress_hard_blockers_when_not_clean`, 'ruleset.reliability_policy.degraded_behavior.suppress_hard_blockers_when_not_clean'),
      downgrade_soft_matches_when_not_clean: validateBoolean(degradedBehavior.downgrade_soft_matches_when_not_clean, errors, `${path}.degraded_behavior.downgrade_soft_matches_when_not_clean`, 'ruleset.reliability_policy.degraded_behavior.downgrade_soft_matches_when_not_clean'),
      prefer_new_group_or_ambiguous_assignment_when_scores_are_close: validateBoolean(degradedBehavior.prefer_new_group_or_ambiguous_assignment_when_scores_are_close, errors, `${path}.degraded_behavior.prefer_new_group_or_ambiguous_assignment_when_scores_are_close`, 'ruleset.reliability_policy.degraded_behavior.prefer_new_group_or_ambiguous_assignment_when_scores_are_close')
    } : null
  };
}

function validateEvidenceRules(input, errors, path, label, { allowSource = false } = {}) {
  if (!Array.isArray(input)) {
    pushError(errors, path, 'required_array', `${label} must be an array.`);
    return null;
  }

  return input.map((rule, index) => {
    const rulePath = `${path}[${index}]`;
    const value = validatePlainObject(rule, errors, rulePath, `${label}[${index}]`);
    if (!value) return null;
    validateClosedKeys(value, SUPPORTED_EVIDENCE_RULE_KEYS, errors, rulePath, `${label}[${index}]`);

    const normalized = {
      id: validateNonEmptyString(value.id, errors, `${rulePath}.id`, `${label}[${index}].id`)
    };

    if (value.applies_to_bucket !== undefined) {
      normalized.applies_to_bucket = validateScalarEnum(value.applies_to_bucket, errors, `${rulePath}.applies_to_bucket`, `${label}[${index}].applies_to_bucket`, SUPPORTED_BUCKET_NAMES);
    }
    if (value.relation !== undefined) {
      normalized.relation = validateScalarEnum(value.relation, errors, `${rulePath}.relation`, `${label}[${index}].relation`, SUPPORTED_RULE_RELATIONS);
    }
    if (value.combine !== undefined) {
      normalized.combine = validateScalarEnum(value.combine, errors, `${rulePath}.combine`, `${label}[${index}].combine`, SUPPORTED_RULE_COMBINE_VALUES);
    }
    if (value.weight !== undefined) {
      normalized.weight = validateFiniteNumber(value.weight, errors, `${rulePath}.weight`, `${label}[${index}].weight`);
    }
    if (value.source !== undefined) {
      if (!allowSource) {
        pushError(errors, `${rulePath}.source`, 'unsupported_predicate_shape', `${label}[${index}].source is not supported in this rule family.`);
      } else {
        normalized.source = validateScalarEnum(value.source, errors, `${rulePath}.source`, `${label}[${index}].source`, ['reliability_policy.degraded_penalties']);
      }
    }
    if (value.applies_when !== undefined) {
      normalized.applies_when = validateConditionObject(value.applies_when, errors, `${rulePath}.applies_when`, `${label}[${index}].applies_when`);
    }

    return normalized;
  }).filter(Boolean);
}

function validateBlockerPolicy(input, errors, path) {
  const value = validatePlainObject(input, errors, path, 'ruleset.blocker_policy');
  if (!value) return null;
  validateClosedKeys(value, SUPPORTED_BLOCKER_POLICY_KEYS, errors, path, 'ruleset.blocker_policy');

  if (!Array.isArray(value.rules)) {
    pushError(errors, `${path}.rules`, 'required_array', 'ruleset.blocker_policy.rules must be an array.');
    return {
      philosophy: validateNonEmptyString(value.philosophy, errors, `${path}.philosophy`, 'ruleset.blocker_policy.philosophy'),
      rules: []
    };
  }

  return {
    philosophy: validateNonEmptyString(value.philosophy, errors, `${path}.philosophy`, 'ruleset.blocker_policy.philosophy'),
    rules: value.rules.map((rule, index) => {
      const rulePath = `${path}.rules[${index}]`;
      const blockerRule = validatePlainObject(rule, errors, rulePath, `ruleset.blocker_policy.rules[${index}]`);
      if (!blockerRule) return null;
      validateClosedKeys(blockerRule, SUPPORTED_BLOCKER_RULE_KEYS, errors, rulePath, `ruleset.blocker_policy.rules[${index}]`);
      return {
        id: validateNonEmptyString(blockerRule.id, errors, `${rulePath}.id`, `ruleset.blocker_policy.rules[${index}].id`),
        source_field: validateScalarEnum(blockerRule.source_field, errors, `${rulePath}.source_field`, `ruleset.blocker_policy.rules[${index}].source_field`, [...SUPPORTED_FIELD_POLICY_FIELDS, 'stable_identity_cues']),
        severity: validateScalarEnum(blockerRule.severity, errors, `${rulePath}.severity`, `ruleset.blocker_policy.rules[${index}].severity`, SUPPORTED_RULE_SEVERITIES),
        only_when: validateConditionObject(blockerRule.only_when, errors, `${rulePath}.only_when`, `ruleset.blocker_policy.rules[${index}].only_when`)
      };
    }).filter(Boolean)
  };
}

function validateAmbiguityPolicy(input, errors, path) {
  const value = validatePlainObject(input, errors, path, 'ruleset.ambiguity_policy');
  if (!value) return null;
  validateClosedKeys(value, SUPPORTED_AMBIGUITY_POLICY_KEYS, errors, path, 'ruleset.ambiguity_policy');

  const markAmbiguousWhen = validatePlainObject(value.mark_ambiguous_when, errors, `${path}.mark_ambiguous_when`, 'ruleset.ambiguity_policy.mark_ambiguous_when');
  if (markAmbiguousWhen) {
    validateClosedKeys(markAmbiguousWhen, SUPPORTED_MARK_AMBIGUOUS_KEYS, errors, `${path}.mark_ambiguous_when`, 'ruleset.ambiguity_policy.mark_ambiguous_when');
  }

  const forceAbstentionReviewWhen = validatePlainObject(value.force_abstention_review_when, errors, `${path}.force_abstention_review_when`, 'ruleset.ambiguity_policy.force_abstention_review_when');
  if (forceAbstentionReviewWhen) {
    validateClosedKeys(forceAbstentionReviewWhen, SUPPORTED_FORCE_ABSTENTION_KEYS, errors, `${path}.force_abstention_review_when`, 'ruleset.ambiguity_policy.force_abstention_review_when');
  }

  return {
    ambiguous_assignment_allowed: validateBoolean(value.ambiguous_assignment_allowed, errors, `${path}.ambiguous_assignment_allowed`, 'ruleset.ambiguity_policy.ambiguous_assignment_allowed'),
    create_new_group_when_no_candidate_clears_assign_threshold: validateBoolean(value.create_new_group_when_no_candidate_clears_assign_threshold, errors, `${path}.create_new_group_when_no_candidate_clears_assign_threshold`, 'ruleset.ambiguity_policy.create_new_group_when_no_candidate_clears_assign_threshold'),
    mark_ambiguous_when: markAmbiguousWhen ? {
      top_score_clears_assign_threshold: validateBoolean(markAmbiguousWhen.top_score_clears_assign_threshold, errors, `${path}.mark_ambiguous_when.top_score_clears_assign_threshold`, 'ruleset.ambiguity_policy.mark_ambiguous_when.top_score_clears_assign_threshold'),
      top_margin_below: validateFiniteNumber(markAmbiguousWhen.top_margin_below, errors, `${path}.mark_ambiguous_when.top_margin_below`, 'ruleset.ambiguity_policy.mark_ambiguous_when.top_margin_below')
    } : null,
    force_abstention_review_when: forceAbstentionReviewWhen ? {
      matched_concrete_stable_identity_fields_below: validateInteger(forceAbstentionReviewWhen.matched_concrete_stable_identity_fields_below, errors, `${path}.force_abstention_review_when.matched_concrete_stable_identity_fields_below`, 'ruleset.ambiguity_policy.force_abstention_review_when.matched_concrete_stable_identity_fields_below', { min: 0 }),
      and_top_score_below_reuse_threshold: validateBoolean(forceAbstentionReviewWhen.and_top_score_below_reuse_threshold, errors, `${path}.force_abstention_review_when.and_top_score_below_reuse_threshold`, 'ruleset.ambiguity_policy.force_abstention_review_when.and_top_score_below_reuse_threshold')
    } : null,
    ambiguity_outputs: validateStringArray(value.ambiguity_outputs, errors, `${path}.ambiguity_outputs`, 'ruleset.ambiguity_policy.ambiguity_outputs', {
      minLength: 1,
      allowedValues: ['ambiguous', 'runner_up_group_id', 'score_margin', 'abstention_reasons']
    })
  };
}

function validateThresholds(input, errors, path) {
  const value = validatePlainObject(input, errors, path, 'ruleset.thresholds');
  if (!value) return null;
  validateClosedKeys(value, SUPPORTED_THRESHOLDS_KEYS, errors, path, 'ruleset.thresholds');

  return {
    assign_threshold: validateFiniteNumber(value.assign_threshold, errors, `${path}.assign_threshold`, 'ruleset.thresholds.assign_threshold'),
    reuse_threshold: validateFiniteNumber(value.reuse_threshold, errors, `${path}.reuse_threshold`, 'ruleset.thresholds.reuse_threshold'),
    ambiguity_margin: validateFiniteNumber(value.ambiguity_margin, errors, `${path}.ambiguity_margin`, 'ruleset.thresholds.ambiguity_margin'),
    singleton_merge_threshold: validateFiniteNumber(value.singleton_merge_threshold, errors, `${path}.singleton_merge_threshold`, 'ruleset.thresholds.singleton_merge_threshold'),
    split_review_threshold: validateFiniteNumber(value.split_review_threshold, errors, `${path}.split_review_threshold`, 'ruleset.thresholds.split_review_threshold'),
    minimum_clean_identity_matches_for_confident_reuse: validateInteger(value.minimum_clean_identity_matches_for_confident_reuse, errors, `${path}.minimum_clean_identity_matches_for_confident_reuse`, 'ruleset.thresholds.minimum_clean_identity_matches_for_confident_reuse', { min: 0 })
  };
}

function validateTieBreakers(input, errors, path) {
  if (!Array.isArray(input)) {
    pushError(errors, path, 'required_array', 'ruleset.tie_breakers must be an array.');
    return null;
  }

  return input.map((entry, index) => {
    const entryPath = `${path}[${index}]`;
    if (typeof entry === 'string') {
      return validateScalarEnum(entry, errors, entryPath, `ruleset.tie_breakers[${index}]`, SUPPORTED_TIE_BREAKERS);
    }

    if (!isPlainObject(entry)) {
      pushError(errors, entryPath, 'invalid_type', 'ruleset.tie_breakers entries must be strings or single-key objects.');
      return null;
    }

    validateClosedKeys(entry, SUPPORTED_TIE_BREAKER_OBJECT_KEYS, errors, entryPath, `ruleset.tie_breakers[${index}]`);
    return {
      most_exact_matches_in_bucket: validateScalarEnum(entry.most_exact_matches_in_bucket, errors, `${entryPath}.most_exact_matches_in_bucket`, `ruleset.tie_breakers[${index}].most_exact_matches_in_bucket`, ['stable_identity_cues'])
    };
  }).filter(Boolean);
}

function validateCleanupPolicy(input, errors, path) {
  const value = validatePlainObject(input, errors, path, 'ruleset.cleanup_policy');
  if (!value) return null;
  validateClosedKeys(value, SUPPORTED_CLEANUP_POLICY_KEYS, errors, path, 'ruleset.cleanup_policy');

  const singletonMergeRequirements = validatePlainObject(value.singleton_merge_requirements, errors, `${path}.singleton_merge_requirements`, 'ruleset.cleanup_policy.singleton_merge_requirements');
  if (singletonMergeRequirements) {
    validateClosedKeys(singletonMergeRequirements, SUPPORTED_SINGLETON_MERGE_REQUIREMENTS_KEYS, errors, `${path}.singleton_merge_requirements`, 'ruleset.cleanup_policy.singleton_merge_requirements');
  }

  const splitPolicy = validatePlainObject(value.split_policy, errors, `${path}.split_policy`, 'ruleset.cleanup_policy.split_policy');
  if (splitPolicy) {
    validateClosedKeys(splitPolicy, SUPPORTED_SPLIT_POLICY_KEYS, errors, `${path}.split_policy`, 'ruleset.cleanup_policy.split_policy');
  }

  return {
    enable_singleton_merge_pass: validateBoolean(value.enable_singleton_merge_pass, errors, `${path}.enable_singleton_merge_pass`, 'ruleset.cleanup_policy.enable_singleton_merge_pass'),
    enable_split_pass: validateBoolean(value.enable_split_pass, errors, `${path}.enable_split_pass`, 'ruleset.cleanup_policy.enable_split_pass'),
    singleton_merge_requirements: singletonMergeRequirements ? {
      clean_reuse_gate_preferred: validateBoolean(singletonMergeRequirements.clean_reuse_gate_preferred, errors, `${path}.singleton_merge_requirements.clean_reuse_gate_preferred`, 'ruleset.cleanup_policy.singleton_merge_requirements.clean_reuse_gate_preferred'),
      score_must_clear: validateNonEmptyString(singletonMergeRequirements.score_must_clear, errors, `${path}.singleton_merge_requirements.score_must_clear`, 'ruleset.cleanup_policy.singleton_merge_requirements.score_must_clear'),
      no_hard_blocker: validateBoolean(singletonMergeRequirements.no_hard_blocker, errors, `${path}.singleton_merge_requirements.no_hard_blocker`, 'ruleset.cleanup_policy.singleton_merge_requirements.no_hard_blocker'),
      matched_concrete_stable_identity_fields_at_least: validateInteger(singletonMergeRequirements.matched_concrete_stable_identity_fields_at_least, errors, `${path}.singleton_merge_requirements.matched_concrete_stable_identity_fields_at_least`, 'ruleset.cleanup_policy.singleton_merge_requirements.matched_concrete_stable_identity_fields_at_least', { min: 0 })
    } : null,
    split_policy: splitPolicy ? {
      posture: validateNonEmptyString(splitPolicy.posture, errors, `${path}.split_policy.posture`, 'ruleset.cleanup_policy.split_policy.posture'),
      note: validateNonEmptyString(splitPolicy.note, errors, `${path}.split_policy.note`, 'ruleset.cleanup_policy.split_policy.note')
    } : null
  };
}

function validateWarningLevelGuardrails(input, errors, path) {
  const value = validatePlainObject(input, errors, path, 'ruleset.warning_level_guardrails');
  if (!value) return null;
  validateClosedKeys(value, SUPPORTED_WARNING_LEVEL_GUARDRAILS_KEYS, errors, path, 'ruleset.warning_level_guardrails');

  if (!Array.isArray(value.cross_field_checks)) {
    pushError(errors, `${path}.cross_field_checks`, 'required_array', 'ruleset.warning_level_guardrails.cross_field_checks must be an array.');
    return { cross_field_checks: [] };
  }

  return {
    cross_field_checks: value.cross_field_checks.map((check, index) => {
      const checkPath = `${path}.cross_field_checks[${index}]`;
      const entry = validatePlainObject(check, errors, checkPath, `ruleset.warning_level_guardrails.cross_field_checks[${index}]`);
      if (!entry) return null;
      validateClosedKeys(entry, SUPPORTED_CROSS_FIELD_CHECK_KEYS, errors, checkPath, `ruleset.warning_level_guardrails.cross_field_checks[${index}]`);

      const when = validatePlainObject(entry.when, errors, `${checkPath}.when`, `ruleset.warning_level_guardrails.cross_field_checks[${index}].when`);
      if (when) {
        validateClosedKeys(when, SUPPORTED_WARNING_WHEN_KEYS, errors, `${checkPath}.when`, `ruleset.warning_level_guardrails.cross_field_checks[${index}].when`);
      }

      return {
        id: validateNonEmptyString(entry.id, errors, `${checkPath}.id`, `ruleset.warning_level_guardrails.cross_field_checks[${index}].id`),
        when: when ? Object.fromEntries(Object.keys(when).map((key) => {
          const keyPath = `${checkPath}.when.${key}`;
          if (key.endsWith('_in') || key.endsWith('_not_in')) {
            return [key, validateStringArray(when[key], errors, keyPath, `ruleset.warning_level_guardrails.cross_field_checks[${index}].when.${key}`, { minLength: 1 })];
          }
          return [key, validateNonEmptyString(when[key], errors, keyPath, `ruleset.warning_level_guardrails.cross_field_checks[${index}].when.${key}`)];
        })) : null,
        level: validateScalarEnum(entry.level, errors, `${checkPath}.level`, `ruleset.warning_level_guardrails.cross_field_checks[${index}].level`, SUPPORTED_WARNING_LEVELS),
        reason: validateNonEmptyString(entry.reason, errors, `${checkPath}.reason`, `ruleset.warning_level_guardrails.cross_field_checks[${index}].reason`)
      };
    }).filter(Boolean)
  };
}

function validateExplainabilityRequirements(input, errors, path) {
  const value = validatePlainObject(input, errors, path, 'ruleset.explainability_requirements');
  if (!value) return null;
  validateClosedKeys(value, SUPPORTED_EXPLAINABILITY_REQUIREMENTS_KEYS, errors, path, 'ruleset.explainability_requirements');

  return {
    per_assignment_must_record: validateStringArray(value.per_assignment_must_record, errors, `${path}.per_assignment_must_record`, 'ruleset.explainability_requirements.per_assignment_must_record', { minLength: 1 }),
    allowed_reason_vocabulary: validateStringArray(value.allowed_reason_vocabulary, errors, `${path}.allowed_reason_vocabulary`, 'ruleset.explainability_requirements.allowed_reason_vocabulary', {
      minLength: 1,
      allowedValues: SUPPORTED_ALLOWED_REASON_VOCABULARY
    })
  };
}

function validateImplementationPosture(input, errors, path) {
  const value = validatePlainObject(input, errors, path, 'ruleset.implementation_posture');
  if (!value) return null;
  validateClosedKeys(value, SUPPORTED_IMPLEMENTATION_POSTURE_KEYS, errors, path, 'ruleset.implementation_posture');

  return {
    design_only: validateBoolean(value.design_only, errors, `${path}.design_only`, 'ruleset.implementation_posture.design_only'),
    no_runtime_code_locked_here: validateBoolean(value.no_runtime_code_locked_here, errors, `${path}.no_runtime_code_locked_here`, 'ruleset.implementation_posture.no_runtime_code_locked_here'),
    benchmark_tuning_expected: validateBoolean(value.benchmark_tuning_expected, errors, `${path}.benchmark_tuning_expected`, 'ruleset.implementation_posture.benchmark_tuning_expected'),
    initial_next_step: validateNonEmptyString(value.initial_next_step, errors, `${path}.initial_next_step`, 'ruleset.implementation_posture.initial_next_step')
  };
}

function validateDialogueV3HeuristicsRulesetObject(input, options = {}) {
  const errors = [];

  if (!isPlainObject(input)) {
    return {
      ok: false,
      value: null,
      errors: [{ path: '$', code: 'invalid_type', message: 'Dialogue v3 heuristics ruleset must be a YAML object.' }],
      summary: 'Dialogue v3 heuristics ruleset must be a YAML object.',
      meta: {
        stage: 'validation',
        sourcePath: options.sourcePath || null
      }
    };
  }

  validateClosedKeys(input, SUPPORTED_TOP_LEVEL_KEYS, errors, '$', 'ruleset document');

  const schemaVersion = validateInteger(input.schema_version, errors, '$.schema_version', 'schema_version', { min: 1 });
  if (schemaVersion !== null && schemaVersion !== SUPPORTS_RULESET_SCHEMA_VERSION) {
    pushError(errors, '$.schema_version', 'invalid_value', `schema_version must be ${SUPPORTS_RULESET_SCHEMA_VERSION}.`);
  }

  const ruleset = validatePlainObject(input.ruleset, errors, '$.ruleset', 'ruleset');
  if (ruleset) {
    validateClosedKeys(ruleset, SUPPORTED_RULESET_KEYS, errors, '$.ruleset', 'ruleset');
  }

  const compiled = {
    schema_version: schemaVersion,
    ruleset: ruleset ? {
      id: validateNonEmptyString(ruleset.id, errors, '$.ruleset.id', 'ruleset.id'),
      version: validateNonEmptyString(ruleset.version, errors, '$.ruleset.version', 'ruleset.version'),
      status: validateNonEmptyString(ruleset.status, errors, '$.ruleset.status', 'ruleset.status'),
      description: validateNonEmptyString(ruleset.description, errors, '$.ruleset.description', 'ruleset.description'),
      ownership: validateOwnership(ruleset.ownership, errors, '$.ruleset.ownership')
    } : null,
    compatibility: validateCompatibility(input.compatibility, errors, '$.compatibility'),
    supersession: validateSupersession(input.supersession, errors, '$.supersession'),
    canonicalization: validateCanonicalization(input.canonicalization, errors, '$.canonicalization'),
    sentinel_policy: validateSentinelPolicy(input.sentinel_policy, errors, '$.sentinel_policy'),
    comparison_relations: validateComparisonRelations(input.comparison_relations, errors, '$.comparison_relations'),
    field_policies: validateFieldPolicies(input.field_policies, errors, '$.field_policies'),
    reliability_policy: validateReliabilityPolicy(input.reliability_policy, errors, '$.reliability_policy'),
    positive_evidence_rules: validateEvidenceRules(input.positive_evidence_rules, errors, '$.positive_evidence_rules', 'positive_evidence_rules'),
    negative_evidence_rules: validateEvidenceRules(input.negative_evidence_rules, errors, '$.negative_evidence_rules', 'negative_evidence_rules', { allowSource: true }),
    blocker_policy: validateBlockerPolicy(input.blocker_policy, errors, '$.blocker_policy'),
    ambiguity_policy: validateAmbiguityPolicy(input.ambiguity_policy, errors, '$.ambiguity_policy'),
    thresholds: validateThresholds(input.thresholds, errors, '$.thresholds'),
    tie_breakers: validateTieBreakers(input.tie_breakers, errors, '$.tie_breakers'),
    cleanup_policy: validateCleanupPolicy(input.cleanup_policy, errors, '$.cleanup_policy'),
    warning_level_guardrails: validateWarningLevelGuardrails(input.warning_level_guardrails, errors, '$.warning_level_guardrails'),
    forbidden_patterns: validateStringArray(input.forbidden_patterns, errors, '$.forbidden_patterns', 'forbidden_patterns', {
      minLength: 1,
      allowedValues: SUPPORTED_FORBIDDEN_PATTERNS
    }),
    explainability_requirements: validateExplainabilityRequirements(input.explainability_requirements, errors, '$.explainability_requirements'),
    implementation_posture: validateImplementationPosture(input.implementation_posture, errors, '$.implementation_posture')
  };

  return {
    ok: errors.length === 0,
    value: errors.length === 0 ? compiled : null,
    errors,
    summary: summarizeValidationErrors('Dialogue v3 heuristics ruleset validation failed.', errors),
    meta: {
      stage: 'validation',
      sourcePath: options.sourcePath || null
    }
  };
}

function parseDialogueV3HeuristicsRulesetString(input, options = {}) {
  if (typeof input !== 'string' || input.trim().length === 0) {
    return {
      ok: false,
      value: null,
      errors: [{ path: '$', code: 'invalid_type', message: 'Ruleset YAML input must be a non-empty string.' }],
      summary: 'Ruleset YAML input must be a non-empty string.',
      meta: {
        stage: 'parse',
        sourcePath: options.sourcePath || null
      }
    };
  }

  let parsed;
  try {
    parsed = yaml.load(input);
  } catch (error) {
    return {
      ok: false,
      value: null,
      errors: [{ path: '$', code: 'yaml_parse_error', message: `Failed to parse YAML: ${error.message}` }],
      summary: `Failed to parse YAML: ${error.message}`,
      meta: {
        stage: 'parse',
        sourcePath: options.sourcePath || null
      }
    };
  }

  const validated = validateDialogueV3HeuristicsRulesetObject(parsed, options);
  return {
    ...validated,
    meta: {
      ...(validated.meta || {}),
      stage: 'validation',
      sourceType: 'string',
      sourcePath: options.sourcePath || null
    }
  };
}

function loadDialogueV3HeuristicsRulesetFromFile(filePath) {
  const absolutePath = path.resolve(filePath);
  const content = fs.readFileSync(absolutePath, 'utf8');
  return parseDialogueV3HeuristicsRulesetString(content, { sourcePath: absolutePath });
}

module.exports = {
  SUPPORTS_RULESET_SCHEMA_VERSION,
  SUPPORTED_BUCKET_NAMES,
  SUPPORTED_FIELD_POLICY_FIELDS,
  SUPPORTED_BOOLEAN_CONDITION_KEYS,
  SUPPORTED_INTEGER_CONDITION_KEYS,
  SUPPORTED_SCALAR_ENUM_CONDITION_KEYS,
  SUPPORTED_ARRAY_ENUM_CONDITION_KEYS,
  SUPPORTED_TIE_BREAKERS,
  validateDialogueV3HeuristicsRulesetObject,
  parseDialogueV3HeuristicsRulesetString,
  loadDialogueV3HeuristicsRulesetFromFile
};
