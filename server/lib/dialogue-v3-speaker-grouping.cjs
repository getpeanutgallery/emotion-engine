'use strict';

const {
  REQUIRED_TRAIT_FIELDS,
  TRAIT_ENUMS
} = require('./dialogue-v3-source-truth-validator.cjs');

const GROUPING_SCHEMA_VERSION = 1;
const GROUPING_OUTPUT_VERSION = '3.0.0';
const GROUPING_CONTRACT_MODE = 'traits-first-derived';
const DEFAULT_ACTION_CREATE = 'create_group';
const DEFAULT_ACTION_REUSE = 'reuse_group';
const DEFAULT_ACTION_AMBIGUOUS = 'ambiguous_reuse';

const GROUPING_ACTIONS = Object.freeze([
  DEFAULT_ACTION_CREATE,
  DEFAULT_ACTION_REUSE,
  DEFAULT_ACTION_AMBIGUOUS
]);

const ABSTAINING_SENTINELS = Object.freeze(new Set(['unknown']));
const AMBIGUOUS_SENTINELS = Object.freeze(new Set(['mixed', 'variable']));
const SENTINEL_PRECEDENCE = Object.freeze(['variable', 'mixed', 'unknown']);

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

  refreshGroupingArtifactView(artifact, groupsById);

  return {
    getArtifact,
    getCandidateSnapshots,
    getGroupRecord,
    applyDecision,
    recordDecisionLedgerEntry
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
  createDialogueV3SpeakerGroupingReducer
};
