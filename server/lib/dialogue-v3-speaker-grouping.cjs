'use strict';

const {
  REQUIRED_TRAIT_FIELDS
} = require('./dialogue-v3-source-truth-validator.cjs');

const GROUPING_SCHEMA_VERSION = 1;
const GROUPING_OUTPUT_VERSION = '3.0.0';
const GROUPING_CONTRACT_MODE = 'traits-first-derived';
const DEFAULT_ACTION_CREATE = 'create_group';
const DEFAULT_ACTION_REUSE = 'reuse_group';
const DEFAULT_ACTION_AMBIGUOUS = 'ambiguous_reuse';
const NON_CLEAN_SHARED_DEFAULT_REUSE_PENALTY = -2.5;

const GROUPING_ACTIONS = Object.freeze([
  DEFAULT_ACTION_CREATE,
  DEFAULT_ACTION_REUSE,
  DEFAULT_ACTION_AMBIGUOUS
]);

const ABSTAINING_SENTINELS = Object.freeze(new Set(['unknown']));
const AMBIGUOUS_SENTINELS = Object.freeze(new Set(['mixed', 'variable']));
const SENTINEL_PRECEDENCE = Object.freeze(['variable', 'mixed', 'unknown']);
const ALLOWED_REASON_VOCABULARY = Object.freeze(new Set([
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
  'delivery_overlay',
  'stable_identity_cues',
  'delivery_cues',
  'production_context_cues',
  'gating_cues'
]));
const AGE_IMPRESSION_ORDER = Object.freeze([
  'child',
  'teen',
  'young_adult',
  'adult',
  'older_adult',
  'elder'
]);
const STABLE_IDENTITY_FIELDS = Object.freeze([
  'gender_presentation',
  'age_impression',
  'pitch_band',
  'phonation',
  'accent_strength',
  'accent_family'
]);
const NON_DISCRIMINATIVE_DEFAULT_MATCHES = Object.freeze(new Map([
  ['accent_strength', new Set(['none_apparent'])],
  ['accent_family', new Set(['neutral_or_unmarked'])],
  ['transmission_medium', new Set(['direct'])],
  ['spatial_texture', new Set(['room'])],
  ['interpersonal_stance', new Set(['neutral'])],
  ['delivery_overlay', new Set(['none_apparent'])]
]));

function assertPlainObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object.`);
  }
}

function assertArray(value, label) {
  if (!Array.isArray(value)) {
    throw new TypeError(`${label} must be an array.`);
  }
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function createEmptyFieldSupport() {
  return {
    total_observations: 0,
    concrete_observation_count: 0,
    value_counts: {},
    sentinel_counts: {
      unknown: 0,
      mixed: 0,
      variable: 0
    }
  };
}

function createEmptySupportState() {
  return {
    segment_count: 0,
    ambiguous_member_count: 0,
    trait_value_counts: Object.fromEntries(
      REQUIRED_TRAIT_FIELDS.map((field) => [field, createEmptyFieldSupport()])
    )
  };
}

function isConcreteValue(value) {
  return !ABSTAINING_SENTINELS.has(value) && !AMBIGUOUS_SENTINELS.has(value);
}

function isNonDiscriminativeDefaultFieldMatch(field, value) {
  return NON_DISCRIMINATIVE_DEFAULT_MATCHES.has(field)
    && NON_DISCRIMINATIVE_DEFAULT_MATCHES.get(field).has(value);
}

function sortValueCountEntries(entries) {
  return [...entries].sort((left, right) => {
    if (right[1] !== left[1]) return right[1] - left[1];
    return left[0].localeCompare(right[0]);
  });
}

function deriveCanonicalFieldValue(fieldSupport) {
  const concreteEntries = sortValueCountEntries(Object.entries(fieldSupport.value_counts));
  const concreteLeader = concreteEntries[0] || null;
  const concreteRunnerUp = concreteEntries[1] || null;
  const hasConcreteLeader = Boolean(concreteLeader);
  const uniqueConcreteLeader = hasConcreteLeader && (!concreteRunnerUp || concreteLeader[1] > concreteRunnerUp[1]);

  if (uniqueConcreteLeader) {
    return concreteLeader[0];
  }

  const sentinelCounts = fieldSupport.sentinel_counts || {};
  const sentinelLeader = SENTINEL_PRECEDENCE
    .map((value) => [value, Number(sentinelCounts[value] || 0)])
    .sort((left, right) => {
      if (right[1] !== left[1]) return right[1] - left[1];
      return SENTINEL_PRECEDENCE.indexOf(left[0]) - SENTINEL_PRECEDENCE.indexOf(right[0]);
    })[0];

  if (hasConcreteLeader) {
    if (concreteEntries.length > 1) {
      if (Number(sentinelCounts.variable || 0) > Number(sentinelCounts.mixed || 0)) {
        return 'variable';
      }
      return 'mixed';
    }

    if ((sentinelLeader?.[1] || 0) > concreteLeader[1]) {
      return sentinelLeader[0];
    }

    return concreteLeader[0];
  }

  if ((sentinelLeader?.[1] || 0) > 0) {
    return sentinelLeader[0];
  }

  return 'unknown';
}

function deriveCanonicalTraitsFromSupport(traitValueCounts) {
  return Object.fromEntries(
    REQUIRED_TRAIT_FIELDS.map((field) => [field, deriveCanonicalFieldValue(traitValueCounts[field] || createEmptyFieldSupport())])
  );
}

function applySegmentTraitsToSupport(support, traits, { ambiguous = false } = {}) {
  support.segment_count += 1;
  if (ambiguous) {
    support.ambiguous_member_count += 1;
  }

  for (const field of REQUIRED_TRAIT_FIELDS) {
    const value = traits[field];
    const fieldSupport = support.trait_value_counts[field];
    fieldSupport.total_observations += 1;

    if (ABSTAINING_SENTINELS.has(value) || AMBIGUOUS_SENTINELS.has(value)) {
      fieldSupport.sentinel_counts[value] += 1;
      continue;
    }

    fieldSupport.concrete_observation_count += 1;
    fieldSupport.value_counts[value] = Number(fieldSupport.value_counts[value] || 0) + 1;
  }
}

function buildGroupRecord(groupState) {
  return {
    group_id: groupState.group_id,
    speaker_id: groupState.speaker_id,
    first_segment_index: groupState.first_segment_index,
    last_segment_index: groupState.last_segment_index,
    segment_indexes: [...groupState.segment_indexes],
    ambiguous_segment_indexes: [...groupState.ambiguous_segment_indexes],
    canonical_traits: cloneJson(groupState.canonical_traits),
    support: cloneJson(groupState.support)
  };
}

function buildCandidateSnapshot(groupState, { forSegmentIndex = null } = {}) {
  return {
    snapshot_stage: 'pre_update',
    for_segment_index: Number.isInteger(forSegmentIndex) ? forSegmentIndex : null,
    group_id: groupState.group_id,
    speaker_id: groupState.speaker_id,
    first_segment_index: groupState.first_segment_index,
    last_segment_index: groupState.last_segment_index,
    segment_indexes: [...groupState.segment_indexes],
    ambiguous_segment_indexes: [...groupState.ambiguous_segment_indexes],
    canonical_traits: cloneJson(groupState.canonical_traits),
    support: cloneJson(groupState.support)
  };
}

function buildInputMetadata(dialogueData, sourceRef = {}) {
  return {
    artifact: dialogueData?.contract?.artifact || 'dialogue-data',
    path: sourceRef.path || null,
    dialogue_schema_version: Number.isInteger(dialogueData?.schema_version) ? dialogueData.schema_version : null,
    traits_contract_version: dialogueData?.contract?.traits_contract_version || null,
    segment_count: Array.isArray(dialogueData?.dialogue_segments) ? dialogueData.dialogue_segments.length : 0
  };
}

function buildRulesetMetadata(compiledRuleset, rulesetRef = {}) {
  return {
    id: compiledRuleset?.ruleset?.id || null,
    version: compiledRuleset?.ruleset?.version || null,
    schema_version: Number.isInteger(compiledRuleset?.schema_version) ? compiledRuleset.schema_version : null,
    path: rulesetRef.path || null
  };
}

function buildGroupingArtifactSkeleton({ dialogueData, compiledRuleset, sourceRef = {}, rulesetRef = {}, runtimeMetadata = {} }) {
  return {
    schema_version: GROUPING_SCHEMA_VERSION,
    contract: {
      artifact: 'speaker-grouping',
      mode: GROUPING_CONTRACT_MODE,
      grouping_output_version: GROUPING_OUTPUT_VERSION
    },
    input: buildInputMetadata(dialogueData, sourceRef),
    ruleset: buildRulesetMetadata(compiledRuleset, rulesetRef),
    metadata: {
      reducer: {
        canonicalization_buckets: cloneJson(compiledRuleset?.canonicalization?.buckets || {}),
        pre_update_candidate_snapshot_stage: 'pre_update',
        source_truth_mutation: 'forbidden'
      },
      cleanup: {
        singleton_merge: {
          enabled_in_ruleset: Boolean(compiledRuleset?.cleanup_policy?.enable_singleton_merge_pass),
          executed: false,
          posture: 'deferred_first_slice'
        },
        split_pass: {
          enabled_in_ruleset: Boolean(compiledRuleset?.cleanup_policy?.enable_split_pass),
          executed: false,
          posture: 'deferred_first_slice'
        }
      },
      runtime: cloneJson(runtimeMetadata)
    },
    speaker_groups: [],
    assignments: [],
    decision_ledger: [],
    summary: {
      group_count: 0,
      assignment_count: 0,
      ambiguous_assignment_count: 0,
      singleton_group_count: 0
    }
  };
}

function refreshGroupingArtifactView(artifact, groupsById) {
  const groups = [...groupsById.values()].sort((left, right) => left.created_order - right.created_order);
  artifact.speaker_groups = groups.map((groupState) => buildGroupRecord(groupState));
  artifact.summary.group_count = artifact.speaker_groups.length;
  artifact.summary.assignment_count = artifact.assignments.length;
  artifact.summary.ambiguous_assignment_count = artifact.assignments.filter((assignment) => assignment.ambiguous === true).length;
  artifact.summary.singleton_group_count = artifact.speaker_groups.filter((group) => group.segment_indexes.length === 1).length;
}

function validateDialogueData(dialogueData) {
  assertPlainObject(dialogueData, 'dialogueData');
  assertArray(dialogueData.dialogue_segments, 'dialogueData.dialogue_segments');
  for (const [index, segment] of dialogueData.dialogue_segments.entries()) {
    assertPlainObject(segment, `dialogueData.dialogue_segments[${index}]`);
    assertPlainObject(segment.traits, `dialogueData.dialogue_segments[${index}].traits`);
    for (const field of REQUIRED_TRAIT_FIELDS) {
      if (!Object.prototype.hasOwnProperty.call(segment.traits, field)) {
        throw new Error(`dialogueData.dialogue_segments[${index}].traits.${field} is required.`);
      }
    }
  }
}

function validateCompiledRuleset(compiledRuleset) {
  assertPlainObject(compiledRuleset, 'compiledRuleset');
  assertPlainObject(compiledRuleset.ruleset, 'compiledRuleset.ruleset');
  assertPlainObject(compiledRuleset.canonicalization, 'compiledRuleset.canonicalization');
  assertPlainObject(compiledRuleset.field_policies, 'compiledRuleset.field_policies');
  assertPlainObject(compiledRuleset.thresholds, 'compiledRuleset.thresholds');
}

function getBucketForField(compiledRuleset, field) {
  for (const [bucketName, bucketConfig] of Object.entries(compiledRuleset.canonicalization?.buckets || {})) {
    if (Array.isArray(bucketConfig?.fields) && bucketConfig.fields.includes(field)) {
      return bucketName;
    }
  }
  return null;
}

function sanitizeReasonVocabulary(values) {
  const seen = new Set();
  return values.filter((value) => {
    if (!ALLOWED_REASON_VOCABULARY.has(value) || seen.has(value)) return false;
    seen.add(value);
    return true;
  });
}

function isAdjacentAgeBand(lineValue, groupValue) {
  const leftIndex = AGE_IMPRESSION_ORDER.indexOf(lineValue);
  const rightIndex = AGE_IMPRESSION_ORDER.indexOf(groupValue);
  if (leftIndex === -1 || rightIndex === -1) return false;
  return Math.abs(leftIndex - rightIndex) === 1;
}

function createScoreAccumulator() {
  return {
    total_score: 0,
    contributions: [],
    bucket_totals: {
      stable_identity_cues: 0,
      delivery_cues: 0,
      production_context_cues: 0,
      gating_cues: 0
    }
  };
}

function recordContribution(accumulator, contribution) {
  const entry = {
    source: contribution.source,
    bucket: contribution.bucket || null,
    field: contribution.field || null,
    relation: contribution.relation || null,
    rule_id: contribution.rule_id || null,
    delta: Number(contribution.delta || 0),
    detail: contribution.detail || null,
    value: contribution.value,
    detail_value: contribution.detail_value
  };
  accumulator.total_score += entry.delta;
  if (entry.bucket && Object.prototype.hasOwnProperty.call(accumulator.bucket_totals, entry.bucket)) {
    accumulator.bucket_totals[entry.bucket] += entry.delta;
  }
  accumulator.contributions.push(entry);
}

function evaluateFieldComparison({ field, lineValue, groupValue, compiledRuleset, cleanReuseGate }) {
  const fieldPolicy = compiledRuleset.field_policies[field] || {};
  const bucket = getBucketForField(compiledRuleset, field);
  const downgradeSoftMatches = Boolean(compiledRuleset.reliability_policy?.degraded_behavior?.downgrade_soft_matches_when_not_clean);

  const result = {
    field,
    bucket,
    line_value: lineValue,
    group_value: groupValue,
    relation: 'abstain',
    delta: 0,
    contribution_detail: null,
    abstention: null,
    counts: {
      exact_stable_identity_match: false,
      concrete_stable_identity_match: false,
      stable_identity_mismatch: false,
      contradictory_identity_mismatch: false
    }
  };

  if (ABSTAINING_SENTINELS.has(lineValue) || ABSTAINING_SENTINELS.has(groupValue)) {
    result.relation = 'abstain';
    result.abstention = {
      field,
      relation: 'abstain',
      line_value: lineValue,
      group_value: groupValue
    };
    return result;
  }

  if (AMBIGUOUS_SENTINELS.has(lineValue) || AMBIGUOUS_SENTINELS.has(groupValue)) {
    result.relation = 'ambiguous';
    result.abstention = {
      field,
      relation: 'ambiguous',
      line_value: lineValue,
      group_value: groupValue
    };
    return result;
  }

  if (lineValue === groupValue) {
    result.relation = 'exact_match';
    result.delta = Number(fieldPolicy.exact_match_positive || 0);
    result.contribution_detail = 'exact_match';
  } else if (field === 'age_impression' && isAdjacentAgeBand(lineValue, groupValue) && Number.isFinite(fieldPolicy.adjacent_band_soft_match_positive)) {
    result.relation = 'soft_match';
    result.delta = Number(fieldPolicy.adjacent_band_soft_match_positive || 0);
    if (!cleanReuseGate && downgradeSoftMatches) {
      result.delta = Number((result.delta * 0.5).toFixed(4));
      result.contribution_detail = 'adjacent_band_soft_match_downgraded';
    } else {
      result.contribution_detail = 'adjacent_band_soft_match';
    }
  } else {
    result.relation = 'mismatch';
    if (field === 'age_impression' && Number.isFinite(fieldPolicy.distant_band_mismatch_negative)) {
      result.delta = Number(fieldPolicy.distant_band_mismatch_negative || 0);
      result.contribution_detail = 'distant_band_mismatch';
    } else {
      result.delta = Number(fieldPolicy.mismatch_negative || 0);
      result.contribution_detail = 'mismatch';
    }
  }

  if (bucket === 'stable_identity_cues') {
    result.counts.concrete_stable_identity_match = result.relation === 'exact_match' || result.relation === 'soft_match';
    result.counts.exact_stable_identity_match = result.relation === 'exact_match';
    result.counts.stable_identity_mismatch = result.relation === 'mismatch';
    result.counts.contradictory_identity_mismatch = result.relation === 'mismatch' && ['gender_presentation', 'pitch_band', 'phonation', 'accent_family'].includes(field);
  }

  return result;
}

function computeCleanReuseGate(segment, snapshot, compiledRuleset) {
  const gate = compiledRuleset.reliability_policy?.clean_reuse_gate || {};
  const audibilityMustBe = gate.audibility_must_be || 'clear';
  const overlapMustBe = gate.overlap_must_be || 'single_voice';

  return segment.traits.audibility === audibilityMustBe
    && segment.traits.overlap === overlapMustBe
    && snapshot.canonical_traits?.audibility === audibilityMustBe
    && snapshot.canonical_traits?.overlap === overlapMustBe;
}

function evaluateDegradedPenalties(segment, compiledRuleset) {
  const penalties = compiledRuleset.reliability_policy?.degraded_penalties || {};
  const audibilityPenalty = Number(penalties.audibility?.[segment.traits.audibility] || 0);
  const overlapPenalty = Number(penalties.overlap?.[segment.traits.overlap] || 0);
  return {
    audibility_penalty: audibilityPenalty,
    overlap_penalty: overlapPenalty,
    total: audibilityPenalty + overlapPenalty
  };
}

function evaluateBlockerRules({ segment, snapshot, compiledRuleset, comparisonByField, cleanReuseGate }) {
  const rules = compiledRuleset.blocker_policy?.rules || [];
  const suppressHardBlockersWhenNotClean = Boolean(compiledRuleset.reliability_policy?.degraded_behavior?.suppress_hard_blockers_when_not_clean);
  const stableIdentityMismatches = Object.values(comparisonByField)
    .filter((entry) => entry.counts?.stable_identity_mismatch)
    .map((entry) => entry.field);
  const contradictoryStableIdentityMismatches = Object.values(comparisonByField)
    .filter((entry) => entry.counts?.contradictory_identity_mismatch)
    .map((entry) => entry.field);
  const triggered = [];
  const suppressed = [];
  let hardBlock = false;
  let softReviewBlock = false;

  function concreteValuesDiffer(field) {
    const lineValue = segment.traits[field];
    const groupValue = snapshot.canonical_traits[field];
    return isConcreteValue(lineValue) && isConcreteValue(groupValue) && lineValue !== groupValue;
  }

  for (const rule of rules) {
    const onlyWhen = rule.only_when || {};
    let matched = true;
    let cleanGatePreventedMatch = false;

    if (onlyWhen.clean_reuse_gate === true && !cleanReuseGate) {
      cleanGatePreventedMatch = true;
    }

    if (matched && onlyWhen.both_values_concrete === true) {
      const field = rule.source_field === 'stable_identity_cues' ? null : rule.source_field;
      if (!field) {
        matched = contradictoryStableIdentityMismatches.length > 0;
      } else {
        matched = isConcreteValue(segment.traits[field]) && isConcreteValue(snapshot.canonical_traits[field]);
      }
    }

    if (matched && onlyWhen.values_must_differ === true) {
      if (rule.source_field === 'stable_identity_cues') {
        matched = stableIdentityMismatches.length > 0;
      } else {
        matched = concreteValuesDiffer(rule.source_field);
      }
    }

    if (matched && Array.isArray(onlyWhen.line_value_in)) {
      matched = onlyWhen.line_value_in.includes(segment.traits[rule.source_field]);
    }

    if (matched && Array.isArray(onlyWhen.group_value_in)) {
      matched = onlyWhen.group_value_in.includes(snapshot.canonical_traits[rule.source_field]);
    }

    if (matched && Array.isArray(onlyWhen.line_value_not_in)) {
      matched = !onlyWhen.line_value_not_in.includes(segment.traits[rule.source_field]);
    }

    if (matched && Array.isArray(onlyWhen.group_value_not_in)) {
      matched = !onlyWhen.group_value_not_in.includes(snapshot.canonical_traits[rule.source_field]);
    }

    if (matched && Array.isArray(onlyWhen.neither_value_in)) {
      matched = !onlyWhen.neither_value_in.includes(segment.traits[rule.source_field])
        && !onlyWhen.neither_value_in.includes(snapshot.canonical_traits[rule.source_field]);
    }

    if (matched && typeof onlyWhen.line_value === 'string') {
      matched = segment.traits[rule.source_field] === onlyWhen.line_value;
    }

    if (matched && typeof onlyWhen.group_value === 'string') {
      matched = snapshot.canonical_traits[rule.source_field] === onlyWhen.group_value;
    }

    if (matched && typeof onlyWhen.line_accent_strength_must_be === 'string') {
      matched = segment.traits.accent_strength === onlyWhen.line_accent_strength_must_be;
    }

    if (matched && typeof onlyWhen.group_accent_strength_must_be === 'string') {
      matched = snapshot.canonical_traits.accent_strength === onlyWhen.group_accent_strength_must_be;
    }

    if (matched && Number.isInteger(onlyWhen.additional_stable_identity_mismatches_at_least)) {
      const excludeField = rule.source_field === 'stable_identity_cues' ? null : rule.source_field;
      const mismatchCount = stableIdentityMismatches.filter((field) => field !== excludeField).length;
      matched = mismatchCount >= onlyWhen.additional_stable_identity_mismatches_at_least;
    }

    if (matched && Number.isInteger(onlyWhen.contradictory_exact_mismatches_at_least)) {
      const requiredFields = Array.isArray(onlyWhen.required_fields_among) ? onlyWhen.required_fields_among : [];
      const matchedRequiredFields = contradictoryStableIdentityMismatches.filter((field) => requiredFields.includes(field));
      matched = matchedRequiredFields.length >= onlyWhen.contradictory_exact_mismatches_at_least;
    }

    if (cleanGatePreventedMatch) {
      if (rule.severity === 'hard' && suppressHardBlockersWhenNotClean && matched) {
        suppressed.push({
          rule_id: rule.id,
          severity: rule.severity,
          source_field: rule.source_field,
          clean_reuse_gate: cleanReuseGate,
          suppressed: true
        });
      }
      continue;
    }

    if (!matched) continue;

    const event = {
      rule_id: rule.id,
      severity: rule.severity,
      source_field: rule.source_field,
      clean_reuse_gate: cleanReuseGate,
      suppressed: false
    };

    if (rule.severity === 'hard' && !cleanReuseGate && suppressHardBlockersWhenNotClean) {
      event.suppressed = true;
      suppressed.push(event);
      continue;
    }

    triggered.push(event);
    if (rule.severity === 'hard') hardBlock = true;
    if (rule.severity === 'soft_review_block') softReviewBlock = true;
  }

  return {
    triggered,
    suppressed,
    hard_block: hardBlock,
    soft_review_block: softReviewBlock,
    stable_identity_mismatch_fields: stableIdentityMismatches,
    contradictory_identity_mismatch_fields: contradictoryStableIdentityMismatches
  };
}

function applyEvidenceBonuses({ accumulator, snapshot, compiledRuleset, cleanReuseGate, blockerState, exactStableIdentityMatchCount, discriminativeStableIdentityExactMatchCount, nonDefaultExactMatchFields }) {
  const positiveRules = compiledRuleset.positive_evidence_rules || [];
  const hasSelectiveNonCleanReuseEvidence = Array.isArray(nonDefaultExactMatchFields) && nonDefaultExactMatchFields.length >= 1;
  for (const rule of positiveRules) {
    if (rule.id === 'recent_group_reuse_bonus') {
      const distance = Math.max(0, 0 + (snapshot.for_segment_index - snapshot.last_segment_index));
      const maxDistance = Number(rule.applies_when?.max_index_distance ?? Infinity);
      const allowBonus = cleanReuseGate
        || discriminativeStableIdentityExactMatchCount >= 1
        || hasSelectiveNonCleanReuseEvidence;
      if (distance <= maxDistance && blockerState.hard_block === false && allowBonus) {
        recordContribution(accumulator, {
          source: 'positive_evidence_rule',
          bucket: 'stable_identity_cues',
          rule_id: rule.id,
          relation: 'bonus',
          delta: Number(rule.weight || 0),
          detail: cleanReuseGate || discriminativeStableIdentityExactMatchCount >= 1
            ? 'recent_group_reuse_bonus'
            : 'recent_group_reuse_bonus_from_non_default_exact_support'
        });
      }
      continue;
    }

    if (rule.id === 'repeated_support_bonus') {
      const segmentCount = Number(snapshot.support?.segment_count || 0);
      const candidateGroupAtLeast = Number(rule.applies_when?.candidate_group_has_at_least || 0);
      const matchedAtLeast = Number(rule.applies_when?.matched_stable_identity_fields_at_least || 0);
      const allowBonus = cleanReuseGate || discriminativeStableIdentityExactMatchCount >= matchedAtLeast;
      if (segmentCount >= candidateGroupAtLeast && exactStableIdentityMatchCount >= matchedAtLeast && allowBonus) {
        recordContribution(accumulator, {
          source: 'positive_evidence_rule',
          bucket: 'stable_identity_cues',
          rule_id: rule.id,
          relation: 'bonus',
          delta: Number(rule.weight || 0),
          detail: allowBonus ? 'repeated_support_bonus' : 'repeated_support_bonus_suppressed'
        });
      }
      continue;
    }

    if (rule.relation === 'exact_match' && rule.applies_to_bucket === 'stable_identity_cues' && !cleanReuseGate) {
      // Strong identity evidence remains allowed even when not clean; no extra action here.
    }
  }
}

function applyDegradedPenalties({ accumulator, penalties }) {
  if (penalties.audibility_penalty) {
    recordContribution(accumulator, {
      source: 'negative_evidence_rule',
      bucket: 'gating_cues',
      field: 'audibility',
      rule_id: 'degraded_line_penalty',
      relation: 'penalty',
      delta: penalties.audibility_penalty,
      detail: 'degraded_audibility_penalty'
    });
  }

  if (penalties.overlap_penalty) {
    recordContribution(accumulator, {
      source: 'negative_evidence_rule',
      bucket: 'gating_cues',
      field: 'overlap',
      rule_id: 'degraded_line_penalty',
      relation: 'penalty',
      delta: penalties.overlap_penalty,
      detail: 'degraded_overlap_penalty'
    });
  }
}

function evaluateSparseTraitReuseDiagnostics({ accumulator, cleanReuseGate, matchedConcreteStableIdentityFields, discriminativeStableIdentityExactMatchCount, stableIdentityMismatchCount, abstentions }) {
  const positiveContributions = accumulator.contributions.filter((entry) => entry.delta > 0);
  const exactFieldMatches = positiveContributions.filter((entry) => entry.source === 'field_policy' && entry.relation === 'exact_match');
  const defaultSharedOnlyFieldMatches = exactFieldMatches.filter((entry) => isNonDiscriminativeDefaultFieldMatch(entry.field, entry.detail_value || entry.value));
  const nonDefaultExactFieldMatches = exactFieldMatches.filter((entry) => !isNonDiscriminativeDefaultFieldMatch(entry.field, entry.detail_value || entry.value));
  const exactFieldOnlyUsesDefaults = exactFieldMatches.length > 0 && defaultSharedOnlyFieldMatches.length === exactFieldMatches.length;
  const stableIdentityAbstentionCount = abstentions.filter((item) => STABLE_IDENTITY_FIELDS.includes(item.field)).length;
  const positiveBonusRuleIds = positiveContributions
    .filter((entry) => entry.source === 'positive_evidence_rule')
    .map((entry) => entry.rule_id)
    .filter(Boolean);
  const defaultSharedOnlyReusePressure = !cleanReuseGate
    && matchedConcreteStableIdentityFields > 0
    && discriminativeStableIdentityExactMatchCount === 0
    && stableIdentityMismatchCount === 0
    && stableIdentityAbstentionCount >= 4
    && exactFieldOnlyUsesDefaults
    && positiveBonusRuleIds.every((ruleId) => ['recent_group_reuse_bonus', 'repeated_support_bonus'].includes(ruleId));

  return {
    default_shared_only_reuse_pressure: defaultSharedOnlyReusePressure,
    stable_identity_abstention_count: stableIdentityAbstentionCount,
    discriminative_stable_identity_exact_match_count: discriminativeStableIdentityExactMatchCount,
    matched_concrete_stable_identity_fields: matchedConcreteStableIdentityFields,
    positive_bonus_rule_ids: positiveBonusRuleIds,
    exact_default_shared_match_fields: defaultSharedOnlyFieldMatches.map((entry) => entry.field),
    non_default_exact_match_fields: nonDefaultExactFieldMatches.map((entry) => entry.field),
    selective_non_clean_reuse_support: !cleanReuseGate && nonDefaultExactFieldMatches.length > 0
  };
}

function applySparseTraitReusePenalty({ accumulator, diagnostics }) {
  if (!diagnostics.default_shared_only_reuse_pressure) {
    return;
  }

  recordContribution(accumulator, {
    source: 'negative_evidence_rule',
    bucket: 'stable_identity_cues',
    field: null,
    rule_id: 'default_shared_only_reuse_pressure_penalty',
    relation: 'penalty',
    delta: NON_CLEAN_SHARED_DEFAULT_REUSE_PENALTY,
    detail: 'default_shared_only_reuse_pressure'
  });
}

function summarizeCandidateReasons({ blockerState, accumulator }) {
  const reasonTokens = [];
  if (blockerState.triggered.length > 0) {
    for (const blocker of blockerState.triggered) {
      if (ALLOWED_REASON_VOCABULARY.has(blocker.source_field)) {
        reasonTokens.push(blocker.source_field);
      }
    }
  }

  const contributionReasons = [...accumulator.contributions]
    .sort((left, right) => Math.abs(right.delta) - Math.abs(left.delta))
    .flatMap((entry) => [entry.field, entry.bucket])
    .filter(Boolean);

  return sanitizeReasonVocabulary([...reasonTokens, ...contributionReasons]).slice(0, 4);
}

function scoreCandidateGroup({ segment, snapshot, compiledRuleset }) {
  const cleanReuseGate = computeCleanReuseGate(segment, snapshot, compiledRuleset);
  const accumulator = createScoreAccumulator();
  const comparisonByField = {};
  const abstentions = [];
  let exactStableIdentityMatchCount = 0;
  let matchedConcreteStableIdentityFields = 0;
  let stableIdentityMismatchCount = 0;
  let discriminativeStableIdentityExactMatchCount = 0;
  const nonDefaultExactMatchFields = [];

  for (const field of REQUIRED_TRAIT_FIELDS) {
    const comparison = evaluateFieldComparison({
      field,
      lineValue: segment.traits[field],
      groupValue: snapshot.canonical_traits[field],
      compiledRuleset,
      cleanReuseGate
    });
    comparisonByField[field] = comparison;

    if (comparison.abstention) {
      abstentions.push(comparison.abstention);
      continue;
    }

    if (comparison.delta !== 0) {
      recordContribution(accumulator, {
        source: 'field_policy',
        bucket: comparison.bucket,
        field,
        relation: comparison.relation,
        delta: comparison.delta,
        detail: comparison.contribution_detail,
        value: comparison.line_value,
        detail_value: comparison.line_value
      });
    }

    if (comparison.relation === 'exact_match' && !isNonDiscriminativeDefaultFieldMatch(field, comparison.line_value)) {
      nonDefaultExactMatchFields.push(field);
    }

    if (comparison.counts.exact_stable_identity_match) {
      exactStableIdentityMatchCount += 1;
      if (!isNonDiscriminativeDefaultFieldMatch(field, comparison.line_value)) {
        discriminativeStableIdentityExactMatchCount += 1;
      }
    }
    if (comparison.counts.concrete_stable_identity_match) matchedConcreteStableIdentityFields += 1;
    if (comparison.counts.stable_identity_mismatch) stableIdentityMismatchCount += 1;
  }

  const blockerState = evaluateBlockerRules({
    segment,
    snapshot,
    compiledRuleset,
    comparisonByField,
    cleanReuseGate
  });

  applyEvidenceBonuses({
    accumulator,
    snapshot,
    compiledRuleset,
    cleanReuseGate,
    blockerState,
    exactStableIdentityMatchCount,
    discriminativeStableIdentityExactMatchCount,
    nonDefaultExactMatchFields
  });

  const degradedPenalties = evaluateDegradedPenalties(segment, compiledRuleset);
  applyDegradedPenalties({ accumulator, penalties: degradedPenalties });

  const diagnostics = evaluateSparseTraitReuseDiagnostics({
    accumulator,
    cleanReuseGate,
    matchedConcreteStableIdentityFields,
    discriminativeStableIdentityExactMatchCount,
    stableIdentityMismatchCount,
    abstentions
  });
  applySparseTraitReusePenalty({ accumulator, diagnostics });

  return {
    group_id: snapshot.group_id,
    speaker_id: snapshot.speaker_id,
    score: Number(accumulator.total_score.toFixed(4)),
    clean_reuse_gate: cleanReuseGate,
    hard_blocked: blockerState.hard_block,
    soft_review_blocked: blockerState.soft_review_block,
    blockers_triggered: blockerState.triggered,
    blockers_suppressed: blockerState.suppressed,
    score_contributions_by_field_or_bucket: accumulator.contributions,
    bucket_totals: accumulator.bucket_totals,
    abstentions_from_unknown_mixed_variable: abstentions,
    matched_concrete_stable_identity_fields: matchedConcreteStableIdentityFields,
    exact_stable_identity_match_count: exactStableIdentityMatchCount,
    discriminative_stable_identity_exact_match_count: discriminativeStableIdentityExactMatchCount,
    stable_identity_mismatch_count: stableIdentityMismatchCount,
    previous_occurrence_distance: Math.max(0, segment.index - snapshot.last_segment_index),
    diagnostics,
    short_contract_safe_reason: summarizeCandidateReasons({ blockerState, accumulator })
  };
}

function compareCandidateRank(left, right) {
  if (right.score !== left.score) return right.score - left.score;
  if (right.exact_stable_identity_match_count !== left.exact_stable_identity_match_count) {
    return right.exact_stable_identity_match_count - left.exact_stable_identity_match_count;
  }
  if (left.stable_identity_mismatch_count !== right.stable_identity_mismatch_count) {
    return left.stable_identity_mismatch_count - right.stable_identity_mismatch_count;
  }
  if (right.clean_reuse_gate !== left.clean_reuse_gate) {
    return Number(right.clean_reuse_gate) - Number(left.clean_reuse_gate);
  }
  if (left.previous_occurrence_distance !== right.previous_occurrence_distance) {
    return left.previous_occurrence_distance - right.previous_occurrence_distance;
  }
  return left.group_id.localeCompare(right.group_id);
}

function buildCreateCandidate() {
  return {
    synthetic: true,
    group_id: null,
    speaker_id: null,
    score: -0.5,
    clean_reuse_gate: false,
    hard_blocked: false,
    soft_review_blocked: false,
    blockers_triggered: [],
    blockers_suppressed: [],
    score_contributions_by_field_or_bucket: [{
      source: 'negative_evidence_rule',
      bucket: null,
      field: null,
      relation: 'penalty',
      rule_id: 'singleton_creation_penalty',
      delta: -0.5,
      detail: 'singleton_creation_penalty'
    }],
    bucket_totals: {
      stable_identity_cues: 0,
      delivery_cues: 0,
      production_context_cues: 0,
      gating_cues: 0
    },
    abstentions_from_unknown_mixed_variable: [],
    matched_concrete_stable_identity_fields: 0,
    exact_stable_identity_match_count: 0,
    discriminative_stable_identity_exact_match_count: 0,
    stable_identity_mismatch_count: 0,
    previous_occurrence_distance: Number.POSITIVE_INFINITY,
    diagnostics: {
      default_shared_only_reuse_pressure: false,
      stable_identity_abstention_count: 0,
      discriminative_stable_identity_exact_match_count: 0,
      matched_concrete_stable_identity_fields: 0,
      positive_bonus_rule_ids: [],
      exact_default_shared_match_fields: [],
      non_default_exact_match_fields: [],
      selective_non_clean_reuse_support: false
    },
    short_contract_safe_reason: []
  };
}

function resolveSegmentAssignment({ segment, candidateScores, compiledRuleset }) {
  const assignThreshold = Number(compiledRuleset.thresholds?.assign_threshold || 0);
  const reuseThreshold = Number(compiledRuleset.thresholds?.reuse_threshold || 0);
  const ambiguityMargin = Number(compiledRuleset.thresholds?.ambiguity_margin || 0);
  const minimumCleanIdentityMatches = Number(compiledRuleset.thresholds?.minimum_clean_identity_matches_for_confident_reuse || 0);
  const preferNewOrAmbiguousWhenClose = Boolean(compiledRuleset.reliability_policy?.degraded_behavior?.prefer_new_group_or_ambiguous_assignment_when_scores_are_close);
  const ambiguityAllowed = Boolean(compiledRuleset.ambiguity_policy?.ambiguous_assignment_allowed);
  const createWhenNoCandidateClearsAssignThreshold = Boolean(compiledRuleset.ambiguity_policy?.create_new_group_when_no_candidate_clears_assign_threshold);

  const eligibleCandidates = candidateScores.filter((candidate) => candidate.hard_blocked === false);
  const rankedCandidates = [...eligibleCandidates].sort(compareCandidateRank);
  const topCandidate = rankedCandidates[0] || null;
  const runnerUp = rankedCandidates[1] || null;
  const scoreMargin = topCandidate && runnerUp ? Number((topCandidate.score - runnerUp.score).toFixed(4)) : null;
  const abstentionReasons = new Set();

  const decisionBase = {
    segment_index: segment.index,
    candidate_groups_considered: candidateScores.map((candidate) => ({
      group_id: candidate.group_id,
      speaker_id: candidate.speaker_id,
      score: candidate.score,
      hard_blocked: candidate.hard_blocked,
      soft_review_blocked: candidate.soft_review_blocked,
      clean_reuse_gate: candidate.clean_reuse_gate,
      matched_concrete_stable_identity_fields: candidate.matched_concrete_stable_identity_fields,
      exact_stable_identity_match_count: candidate.exact_stable_identity_match_count,
      discriminative_stable_identity_exact_match_count: candidate.discriminative_stable_identity_exact_match_count,
      stable_identity_mismatch_count: candidate.stable_identity_mismatch_count,
      diagnostics: cloneJson(candidate.diagnostics || {})
    }))
  };

  for (const candidate of candidateScores) {
    for (const item of candidate.abstentions_from_unknown_mixed_variable) {
      abstentionReasons.add(item.field);
    }
    for (const item of candidate.blockers_triggered) {
      if (ALLOWED_REASON_VOCABULARY.has(item.source_field)) {
        abstentionReasons.add(item.source_field);
      }
    }
  }

  if (!topCandidate || (topCandidate.score < assignThreshold && createWhenNoCandidateClearsAssignThreshold)) {
    if (topCandidate && topCandidate.score < assignThreshold) {
      abstentionReasons.add('stable_identity_cues');
    }

    return {
      ...decisionBase,
      chosen_action: DEFAULT_ACTION_CREATE,
      chosen_group_id: null,
      chosen_speaker_id: null,
      ambiguous: false,
      runner_up_group_id: topCandidate?.group_id || null,
      score_margin: null,
      abstention_reasons: sanitizeReasonVocabulary([...abstentionReasons]),
      short_contract_safe_reason: sanitizeReasonVocabulary([
        ...topCandidate?.short_contract_safe_reason || [],
        ...abstentionReasons
      ])
    };
  }

  const belowConfidentReuse = topCandidate.score < reuseThreshold;
  const weakStableIdentitySupport = topCandidate.matched_concrete_stable_identity_fields < minimumCleanIdentityMatches;
  const closeMargin = scoreMargin !== null && scoreMargin < ambiguityMargin;
  const sparseNonCleanReusePressure = topCandidate.clean_reuse_gate === false
    && topCandidate.diagnostics?.default_shared_only_reuse_pressure === true;

  if (topCandidate.soft_review_blocked && belowConfidentReuse) {
    abstentionReasons.add('phonation');
    return {
      ...decisionBase,
      chosen_action: DEFAULT_ACTION_CREATE,
      chosen_group_id: null,
      chosen_speaker_id: null,
      ambiguous: false,
      runner_up_group_id: topCandidate.group_id,
      score_margin: scoreMargin,
      abstention_reasons: sanitizeReasonVocabulary([...abstentionReasons]),
      short_contract_safe_reason: sanitizeReasonVocabulary([
        ...topCandidate.short_contract_safe_reason,
        ...abstentionReasons
      ])
    };
  }

  if (sparseNonCleanReusePressure) {
    abstentionReasons.add('stable_identity_cues');
    abstentionReasons.add('gating_cues');
    return {
      ...decisionBase,
      chosen_action: DEFAULT_ACTION_CREATE,
      chosen_group_id: null,
      chosen_speaker_id: null,
      ambiguous: false,
      runner_up_group_id: topCandidate.group_id,
      score_margin: scoreMargin,
      abstention_reasons: sanitizeReasonVocabulary([...abstentionReasons]),
      short_contract_safe_reason: sanitizeReasonVocabulary([
        ...topCandidate.short_contract_safe_reason,
        ...abstentionReasons
      ])
    };
  }

  if (weakStableIdentitySupport && belowConfidentReuse) {
    abstentionReasons.add('stable_identity_cues');
    return {
      ...decisionBase,
      chosen_action: DEFAULT_ACTION_CREATE,
      chosen_group_id: null,
      chosen_speaker_id: null,
      ambiguous: false,
      runner_up_group_id: topCandidate.group_id,
      score_margin: scoreMargin,
      abstention_reasons: sanitizeReasonVocabulary([...abstentionReasons]),
      short_contract_safe_reason: sanitizeReasonVocabulary([
        ...topCandidate.short_contract_safe_reason,
        ...abstentionReasons
      ])
    };
  }

  if (ambiguityAllowed && closeMargin) {
    return {
      ...decisionBase,
      chosen_action: DEFAULT_ACTION_AMBIGUOUS,
      chosen_group_id: topCandidate.group_id,
      chosen_speaker_id: topCandidate.speaker_id,
      ambiguous: true,
      runner_up_group_id: runnerUp?.group_id || null,
      score_margin: scoreMargin,
      abstention_reasons: sanitizeReasonVocabulary([...abstentionReasons]),
      short_contract_safe_reason: sanitizeReasonVocabulary([
        ...topCandidate.short_contract_safe_reason,
        ...abstentionReasons
      ])
    };
  }

  if (preferNewOrAmbiguousWhenClose && topCandidate.clean_reuse_gate === false && belowConfidentReuse) {
    if (ambiguityAllowed && closeMargin) {
      return {
        ...decisionBase,
        chosen_action: DEFAULT_ACTION_AMBIGUOUS,
        chosen_group_id: topCandidate.group_id,
        chosen_speaker_id: topCandidate.speaker_id,
        ambiguous: true,
        runner_up_group_id: runnerUp?.group_id || null,
        score_margin: scoreMargin,
        abstention_reasons: sanitizeReasonVocabulary([...abstentionReasons]),
        short_contract_safe_reason: sanitizeReasonVocabulary([
          ...topCandidate.short_contract_safe_reason,
          ...abstentionReasons
        ])
      };
    }

    abstentionReasons.add('gating_cues');
    return {
      ...decisionBase,
      chosen_action: DEFAULT_ACTION_CREATE,
      chosen_group_id: null,
      chosen_speaker_id: null,
      ambiguous: false,
      runner_up_group_id: topCandidate.group_id,
      score_margin: scoreMargin,
      abstention_reasons: sanitizeReasonVocabulary([...abstentionReasons]),
      short_contract_safe_reason: sanitizeReasonVocabulary([
        ...topCandidate.short_contract_safe_reason,
        ...abstentionReasons
      ])
    };
  }

  return {
    ...decisionBase,
    chosen_action: DEFAULT_ACTION_REUSE,
    chosen_group_id: topCandidate.group_id,
    chosen_speaker_id: topCandidate.speaker_id,
    ambiguous: false,
    runner_up_group_id: runnerUp?.group_id || null,
    score_margin: scoreMargin,
    abstention_reasons: sanitizeReasonVocabulary([...abstentionReasons]),
    short_contract_safe_reason: sanitizeReasonVocabulary([
      ...topCandidate.short_contract_safe_reason,
      ...abstentionReasons
    ])
  };
}

function buildDecisionLedgerEntry({ segment, decision, candidateScores }) {
  const chosenCandidate = candidateScores.find((candidate) => candidate.group_id === decision.chosen_group_id) || null;
  const topCandidate = [...candidateScores].sort(compareCandidateRank)[0] || null;
  const diagnosticCandidate = chosenCandidate || topCandidate;
  const blockersTriggered = candidateScores.flatMap((candidate) => candidate.blockers_triggered.map((blocker) => ({
    group_id: candidate.group_id,
    ...blocker
  })));

  return {
    segment_index: segment.index,
    candidate_groups_considered: cloneJson(decision.candidate_groups_considered),
    blockers_triggered: blockersTriggered,
    diagnostic_subject_group_id: diagnosticCandidate?.group_id || null,
    score_contributions_by_field_or_bucket: diagnosticCandidate ? cloneJson(diagnosticCandidate.score_contributions_by_field_or_bucket) : [],
    abstentions_from_unknown_mixed_variable: diagnosticCandidate ? cloneJson(diagnosticCandidate.abstentions_from_unknown_mixed_variable) : [],
    diagnostics: diagnosticCandidate ? cloneJson(diagnosticCandidate.diagnostics) : {
      default_shared_only_reuse_pressure: false,
      stable_identity_abstention_count: 0,
      discriminative_stable_identity_exact_match_count: 0,
      matched_concrete_stable_identity_fields: 0,
      positive_bonus_rule_ids: [],
      exact_default_shared_match_fields: [],
      non_default_exact_match_fields: [],
      selective_non_clean_reuse_support: false
    },
    chosen_action: decision.chosen_action,
    chosen_group_id: decision.chosen_group_id,
    chosen_speaker_id: decision.chosen_speaker_id,
    ambiguous: decision.ambiguous,
    runner_up_group_id: decision.runner_up_group_id,
    score_margin: decision.score_margin,
    abstention_reasons: cloneJson(decision.abstention_reasons),
    short_contract_safe_reason: cloneJson(decision.short_contract_safe_reason)
  };
}

function createDialogueV3SpeakerGroupingReducer(options = {}) {
  const {
    dialogueData,
    compiledRuleset,
    sourceRef = {},
    rulesetRef = {},
    runtimeMetadata = {},
    startingGroupNumber = 1,
    startingSpeakerNumber = 1
  } = options;

  validateDialogueData(dialogueData);
  validateCompiledRuleset(compiledRuleset);

  let nextGroupNumber = startingGroupNumber;
  let nextSpeakerNumber = startingSpeakerNumber;
  const groupsById = new Map();
  const artifact = buildGroupingArtifactSkeleton({
    dialogueData,
    compiledRuleset,
    sourceRef,
    rulesetRef,
    runtimeMetadata
  });

  function getSegment(segmentIndex) {
    const segment = dialogueData.dialogue_segments[segmentIndex];
    if (!segment) {
      throw new Error(`segmentIndex ${segmentIndex} is out of range for dialogueData.`);
    }
    return segment;
  }

  function buildNextGroupId() {
    return `grp_${String(nextGroupNumber++).padStart(3, '0')}`;
  }

  function buildNextSpeakerId() {
    return `spk_${String(nextSpeakerNumber++).padStart(3, '0')}`;
  }

  function getCandidateSnapshots({ forSegmentIndex = null } = {}) {
    return [...groupsById.values()]
      .sort((left, right) => left.created_order - right.created_order)
      .map((groupState) => buildCandidateSnapshot(groupState, { forSegmentIndex }));
  }

  function createGroupStateFromSegment(segment, { ambiguous = false } = {}) {
    const support = createEmptySupportState();
    applySegmentTraitsToSupport(support, segment.traits, { ambiguous });
    return {
      created_order: nextGroupNumber,
      group_id: buildNextGroupId(),
      speaker_id: buildNextSpeakerId(),
      first_segment_index: segment.index,
      last_segment_index: segment.index,
      segment_indexes: [segment.index],
      ambiguous_segment_indexes: ambiguous ? [segment.index] : [],
      support,
      canonical_traits: deriveCanonicalTraitsFromSupport(support.trait_value_counts)
    };
  }

  function updateExistingGroupState(groupState, segment, { ambiguous = false } = {}) {
    groupState.last_segment_index = segment.index;
    groupState.segment_indexes.push(segment.index);
    if (ambiguous) {
      groupState.ambiguous_segment_indexes.push(segment.index);
    }
    applySegmentTraitsToSupport(groupState.support, segment.traits, { ambiguous });
    groupState.canonical_traits = deriveCanonicalTraitsFromSupport(groupState.support.trait_value_counts);
    return groupState;
  }

  function recordAssignment({
    segmentIndex,
    action,
    chosenGroup,
    ambiguous = false,
    runnerUpGroupId = null,
    scoreMargin = null,
    abstentionReasons = [],
    preUpdateCandidateSnapshots = []
  }) {
    artifact.assignments.push({
      segment_index: segmentIndex,
      group_id: chosenGroup.group_id,
      speaker_id: chosenGroup.speaker_id,
      chosen_action: action,
      ambiguous,
      runner_up_group_id: runnerUpGroupId || null,
      score_margin: Number.isFinite(scoreMargin) ? scoreMargin : null,
      abstention_reasons: Array.isArray(abstentionReasons) ? [...abstentionReasons] : [],
      pre_update_candidate_group_ids: preUpdateCandidateSnapshots.map((snapshot) => snapshot.group_id)
    });
  }

  function applyDecision(decision = {}) {
    const {
      segmentIndex,
      action = DEFAULT_ACTION_CREATE,
      groupId = null,
      ambiguous = false,
      runnerUpGroupId = null,
      scoreMargin = null,
      abstentionReasons = []
    } = decision;

    if (!GROUPING_ACTIONS.includes(action)) {
      throw new Error(`Unsupported grouping action "${action}".`);
    }

    if (!Number.isInteger(segmentIndex)) {
      throw new TypeError('segmentIndex must be an integer.');
    }

    const segment = getSegment(segmentIndex);
    const preUpdateCandidateSnapshots = getCandidateSnapshots({ forSegmentIndex: segmentIndex });

    let chosenGroup;
    if (action === DEFAULT_ACTION_CREATE) {
      chosenGroup = createGroupStateFromSegment(segment, { ambiguous });
      groupsById.set(chosenGroup.group_id, chosenGroup);
    } else {
      if (!groupId || !groupsById.has(groupId)) {
        throw new Error(`groupId is required for action "${action}" and must reference an existing group.`);
      }
      chosenGroup = updateExistingGroupState(groupsById.get(groupId), segment, { ambiguous });
    }

    recordAssignment({
      segmentIndex,
      action,
      chosenGroup,
      ambiguous,
      runnerUpGroupId,
      scoreMargin,
      abstentionReasons,
      preUpdateCandidateSnapshots
    });

    refreshGroupingArtifactView(artifact, groupsById);

    return {
      assignment: cloneJson(artifact.assignments[artifact.assignments.length - 1]),
      chosen_group: buildGroupRecord(chosenGroup),
      pre_update_candidate_snapshots: preUpdateCandidateSnapshots
    };
  }

  function recordDecisionLedgerEntry(entry) {
    artifact.decision_ledger.push(cloneJson(entry));
    return artifact.decision_ledger.length;
  }

  function getArtifact() {
    return cloneJson(artifact);
  }

  function getGroupRecord(groupId) {
    const groupState = groupsById.get(groupId);
    return groupState ? buildGroupRecord(groupState) : null;
  }

  function scoreSegment(segmentIndex) {
    const segment = getSegment(segmentIndex);
    const snapshots = getCandidateSnapshots({ forSegmentIndex: segmentIndex });
    return snapshots.map((snapshot) => scoreCandidateGroup({ segment, snapshot, compiledRuleset }));
  }

  function scoreAndApplySegment(segmentIndex) {
    const segment = getSegment(segmentIndex);
    const candidateScores = scoreSegment(segmentIndex);
    const decision = resolveSegmentAssignment({ segment, candidateScores, compiledRuleset });
    const applied = applyDecision({
      segmentIndex,
      action: decision.chosen_action,
      groupId: decision.chosen_group_id,
      ambiguous: decision.ambiguous,
      runnerUpGroupId: decision.runner_up_group_id,
      scoreMargin: decision.score_margin,
      abstentionReasons: decision.abstention_reasons
    });
    const ledgerEntry = buildDecisionLedgerEntry({ segment, decision, candidateScores });
    recordDecisionLedgerEntry(ledgerEntry);

    return {
      segment: cloneJson(segment),
      candidate_scores: cloneJson(candidateScores),
      decision: cloneJson(decision),
      assignment: applied.assignment,
      chosen_group: applied.chosen_group,
      pre_update_candidate_snapshots: applied.pre_update_candidate_snapshots,
      ledger_entry: ledgerEntry
    };
  }

  refreshGroupingArtifactView(artifact, groupsById);

  return {
    getArtifact,
    getCandidateSnapshots,
    getGroupRecord,
    applyDecision,
    recordDecisionLedgerEntry,
    scoreSegment,
    scoreAndApplySegment
  };
}

function runDialogueV3SpeakerGrouping(options = {}) {
  const reducer = createDialogueV3SpeakerGroupingReducer(options);
  const steps = [];
  const segmentCount = options?.dialogueData?.dialogue_segments?.length || 0;

  for (let index = 0; index < segmentCount; index += 1) {
    steps.push(reducer.scoreAndApplySegment(index));
  }

  return {
    artifact: reducer.getArtifact(),
    steps
  };
}

module.exports = {
  GROUPING_SCHEMA_VERSION,
  GROUPING_OUTPUT_VERSION,
  GROUPING_CONTRACT_MODE,
  GROUPING_ACTIONS,
  buildGroupingArtifactSkeleton,
  createEmptySupportState,
  deriveCanonicalFieldValue,
  deriveCanonicalTraitsFromSupport,
  evaluateFieldComparison,
  scoreCandidateGroup,
  resolveSegmentAssignment,
  buildDecisionLedgerEntry,
  createDialogueV3SpeakerGroupingReducer,
  runDialogueV3SpeakerGrouping
};
