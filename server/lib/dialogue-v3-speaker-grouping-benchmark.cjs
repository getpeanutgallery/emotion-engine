'use strict';

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

function padIndex(index) {
  return String(index).padStart(3, '0');
}

function buildSpeakerGroupKey(firstSegmentIndex) {
  return `first_segment_${padIndex(firstSegmentIndex)}`;
}

function sortNumericAscending(values) {
  return [...values].sort((left, right) => left - right);
}

function normalizeSegmentIndexes(indexes, label) {
  assertArray(indexes, label);
  const normalized = indexes.map((value, index) => {
    if (!Number.isInteger(value) || value < 0) {
      throw new Error(`${label}[${index}] must be a non-negative integer.`);
    }
    return value;
  });

  const unique = sortNumericAscending(Array.from(new Set(normalized)));
  if (unique.length !== normalized.length) {
    throw new Error(`${label} must not contain duplicate segment indexes.`);
  }
  return unique;
}

function buildTruthSegmentMap(dialogueTruth) {
  assertPlainObject(dialogueTruth, 'dialogueTruth');
  assertArray(dialogueTruth.dialogue_segments, 'dialogueTruth.dialogue_segments');

  const map = new Map();
  for (const [entryIndex, segment] of dialogueTruth.dialogue_segments.entries()) {
    assertPlainObject(segment, `dialogueTruth.dialogue_segments[${entryIndex}]`);
    if (!Number.isInteger(segment.index) || segment.index < 0) {
      throw new Error(`dialogueTruth.dialogue_segments[${entryIndex}].index must be a non-negative integer.`);
    }
    if (typeof segment.speaker_id !== 'string' || segment.speaker_id.trim().length === 0) {
      throw new Error(`dialogueTruth.dialogue_segments[${entryIndex}].speaker_id must be a non-empty string.`);
    }
    if (map.has(segment.index)) {
      throw new Error(`dialogueTruth.dialogue_segments contains duplicate index ${segment.index}.`);
    }
    map.set(segment.index, {
      index: segment.index,
      speaker_id: segment.speaker_id,
      label: typeof segment.speaker === 'string' && segment.speaker.trim().length > 0 ? segment.speaker : null,
      text: typeof segment.text === 'string' ? segment.text : null
    });
  }
  return map;
}

function projectSpeakerGroupingTruthFromDialogueTruth(dialogueTruth, { sourcePath = null } = {}) {
  const segmentMap = buildTruthSegmentMap(dialogueTruth);
  assertArray(dialogueTruth.speaker_profiles, 'dialogueTruth.speaker_profiles');

  const projectedGroups = dialogueTruth.speaker_profiles.map((profile, profileIndex) => {
    assertPlainObject(profile, `dialogueTruth.speaker_profiles[${profileIndex}]`);
    if (typeof profile.speaker_id !== 'string' || profile.speaker_id.trim().length === 0) {
      throw new Error(`dialogueTruth.speaker_profiles[${profileIndex}].speaker_id must be a non-empty string.`);
    }

    const linkedIndexes = normalizeSegmentIndexes(
      profile?.grounded?.linked_segment_indexes,
      `dialogueTruth.speaker_profiles[${profileIndex}].grounded.linked_segment_indexes`
    );

    if (linkedIndexes.length === 0) {
      throw new Error(`dialogueTruth.speaker_profiles[${profileIndex}] must link at least one segment.`);
    }

    for (const segmentIndex of linkedIndexes) {
      const segment = segmentMap.get(segmentIndex);
      if (!segment) {
        throw new Error(`dialogueTruth.speaker_profiles[${profileIndex}] references missing segment index ${segmentIndex}.`);
      }
      if (segment.speaker_id !== profile.speaker_id) {
        throw new Error(
          `dialogueTruth.speaker_profiles[${profileIndex}] linked segment ${segmentIndex} belongs to ${segment.speaker_id}, not ${profile.speaker_id}.`
        );
      }
    }

    const firstSegmentIndex = linkedIndexes[0];
    return {
      speaker_group_key: buildSpeakerGroupKey(firstSegmentIndex),
      first_segment_index: firstSegmentIndex,
      segment_indexes: linkedIndexes,
      source_speaker_id: profile.speaker_id,
      label: typeof profile.label === 'string' && profile.label.trim().length > 0 ? profile.label : null,
      segment_count: linkedIndexes.length
    };
  }).sort((left, right) => {
    if (left.first_segment_index !== right.first_segment_index) {
      return left.first_segment_index - right.first_segment_index;
    }
    return left.source_speaker_id.localeCompare(right.source_speaker_id);
  });

  const groupBySpeakerId = new Map(projectedGroups.map((group) => [group.source_speaker_id, group]));
  const assignments = [...segmentMap.values()]
    .sort((left, right) => left.index - right.index)
    .map((segment) => {
      const group = groupBySpeakerId.get(segment.speaker_id);
      if (!group) {
        throw new Error(`dialogueTruth.dialogue_segments[${segment.index}] speaker_id ${segment.speaker_id} has no speaker_profile entry.`);
      }
      return {
        segment_index: segment.index,
        speaker_group_key: group.speaker_group_key,
        source_speaker_id: group.source_speaker_id,
        label: group.label,
        text: segment.text
      };
    });

  return {
    schema_version: 1,
    contract: {
      artifact: 'speaker-grouping-truth',
      mode: 'first-slice-comparator-projection',
      source_artifact: 'dialogue-data'
    },
    projection: {
      source_path: sourcePath,
      derived_from_paths: [
        'dialogue_segments[*].index',
        'dialogue_segments[*].speaker_id',
        'speaker_profiles[*].speaker_id',
        'speaker_profiles[*].grounded.linked_segment_indexes',
        'speaker_profiles[*].label'
      ],
      stable_group_key_rule: 'first_segment_index'
    },
    speaker_groups: projectedGroups,
    assignments,
    summary: {
      group_count: projectedGroups.length,
      assignment_count: assignments.length
    }
  };
}

function normalizeRuntimeSpeakerGroupingArtifact(runtimeArtifact) {
  assertPlainObject(runtimeArtifact, 'runtimeArtifact');
  assertArray(runtimeArtifact.assignments, 'runtimeArtifact.assignments');
  assertArray(runtimeArtifact.speaker_groups, 'runtimeArtifact.speaker_groups');

  const groupsById = new Map();
  for (const [groupIndex, group] of runtimeArtifact.speaker_groups.entries()) {
    assertPlainObject(group, `runtimeArtifact.speaker_groups[${groupIndex}]`);
    if (typeof group.group_id !== 'string' || group.group_id.trim().length === 0) {
      throw new Error(`runtimeArtifact.speaker_groups[${groupIndex}].group_id must be a non-empty string.`);
    }
    const segmentIndexes = normalizeSegmentIndexes(
      group.segment_indexes,
      `runtimeArtifact.speaker_groups[${groupIndex}].segment_indexes`
    );
    if (segmentIndexes.length === 0) {
      throw new Error(`runtimeArtifact.speaker_groups[${groupIndex}] must contain at least one segment index.`);
    }

    const firstSegmentIndex = Number.isInteger(group.first_segment_index)
      ? group.first_segment_index
      : segmentIndexes[0];
    const stableGroupKey = buildSpeakerGroupKey(firstSegmentIndex);

    groupsById.set(group.group_id, {
      group_id: group.group_id,
      speaker_group_key: stableGroupKey,
      first_segment_index: firstSegmentIndex,
      segment_indexes: segmentIndexes,
      segment_count: segmentIndexes.length
    });
  }

  const assignments = runtimeArtifact.assignments.map((assignment, assignmentIndex) => {
    assertPlainObject(assignment, `runtimeArtifact.assignments[${assignmentIndex}]`);
    if (!Number.isInteger(assignment.segment_index) || assignment.segment_index < 0) {
      throw new Error(`runtimeArtifact.assignments[${assignmentIndex}].segment_index must be a non-negative integer.`);
    }
    if (typeof assignment.group_id !== 'string' || assignment.group_id.trim().length === 0) {
      throw new Error(`runtimeArtifact.assignments[${assignmentIndex}].group_id must be a non-empty string.`);
    }
    const group = groupsById.get(assignment.group_id);
    if (!group) {
      throw new Error(`runtimeArtifact.assignments[${assignmentIndex}] references unknown group_id ${assignment.group_id}.`);
    }
    return {
      segment_index: assignment.segment_index,
      speaker_group_key: group.speaker_group_key,
      group_id: assignment.group_id
    };
  }).sort((left, right) => left.segment_index - right.segment_index);

  return {
    schema_version: 1,
    contract: {
      artifact: 'speaker-grouping-runtime-normalized',
      mode: 'first-slice-comparator-projection'
    },
    speaker_groups: [...groupsById.values()].sort((left, right) => left.first_segment_index - right.first_segment_index),
    assignments,
    summary: {
      group_count: groupsById.size,
      assignment_count: assignments.length
    }
  };
}

function compareSpeakerGroupingTruthProjection({ truthProjection, runtimeArtifact }) {
  assertPlainObject(truthProjection, 'truthProjection');
  const normalizedRuntime = normalizeRuntimeSpeakerGroupingArtifact(runtimeArtifact);

  const truthAssignments = new Map();
  for (const assignment of truthProjection.assignments || []) {
    truthAssignments.set(assignment.segment_index, assignment.speaker_group_key);
  }

  const runtimeAssignments = new Map();
  for (const assignment of normalizedRuntime.assignments) {
    runtimeAssignments.set(assignment.segment_index, assignment.speaker_group_key);
  }

  const segmentIndexes = sortNumericAscending(Array.from(new Set([
    ...truthAssignments.keys(),
    ...runtimeAssignments.keys()
  ])));

  const mismatches = [];
  for (const segmentIndex of segmentIndexes) {
    const expectedGroupKey = truthAssignments.get(segmentIndex) || null;
    const actualGroupKey = runtimeAssignments.get(segmentIndex) || null;
    if (expectedGroupKey !== actualGroupKey) {
      mismatches.push({
        segment_index: segmentIndex,
        expected_speaker_group_key: expectedGroupKey,
        actual_speaker_group_key: actualGroupKey
      });
    }
  }

  return {
    ok: mismatches.length === 0,
    truth_group_count: Number(truthProjection.summary?.group_count || 0),
    runtime_group_count: normalizedRuntime.summary.group_count,
    truth_assignment_count: Number(truthProjection.summary?.assignment_count || 0),
    runtime_assignment_count: normalizedRuntime.summary.assignment_count,
    mismatch_count: mismatches.length,
    mismatches,
    runtime_projection: normalizedRuntime
  };
}

module.exports = {
  buildSpeakerGroupKey,
  projectSpeakerGroupingTruthFromDialogueTruth,
  normalizeRuntimeSpeakerGroupingArtifact,
  compareSpeakerGroupingTruthProjection
};
