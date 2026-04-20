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

function normalizeComparableText(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '');
}

function tokenizeComparableText(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFKD')
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

function computeTokenOverlapScore(leftText, rightText) {
  const leftTokens = new Set(tokenizeComparableText(leftText));
  const rightTokens = new Set(tokenizeComparableText(rightText));
  if (leftTokens.size === 0 || rightTokens.size === 0) {
    return 0;
  }

  let intersection = 0;
  for (const token of leftTokens) {
    if (rightTokens.has(token)) {
      intersection += 1;
    }
  }

  return intersection / Math.max(leftTokens.size, rightTokens.size);
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
      text: typeof segment.text === 'string' ? segment.text : null,
      normalized_text: normalizeComparableText(segment.text)
    });
  }
  return map;
}

function buildTruthSpeakerProfileMap(dialogueTruth) {
  assertArray(dialogueTruth.speaker_profiles, 'dialogueTruth.speaker_profiles');
  const map = new Map();

  for (const [profileIndex, profile] of dialogueTruth.speaker_profiles.entries()) {
    assertPlainObject(profile, `dialogueTruth.speaker_profiles[${profileIndex}]`);
    if (typeof profile.speaker_id !== 'string' || profile.speaker_id.trim().length === 0) {
      throw new Error(`dialogueTruth.speaker_profiles[${profileIndex}].speaker_id must be a non-empty string.`);
    }

    map.set(profile.speaker_id, {
      speaker_id: profile.speaker_id,
      label: typeof profile.label === 'string' && profile.label.trim().length > 0 ? profile.label : null,
      linked_segment_indexes: normalizeSegmentIndexes(
        profile?.grounded?.linked_segment_indexes,
        `dialogueTruth.speaker_profiles[${profileIndex}].grounded.linked_segment_indexes`
      )
    });
  }

  return map;
}

function buildRuntimeSegmentList(runtimeDialogue) {
  assertPlainObject(runtimeDialogue, 'runtimeDialogue');
  assertArray(runtimeDialogue.dialogue_segments, 'runtimeDialogue.dialogue_segments');

  return runtimeDialogue.dialogue_segments.map((segment, entryIndex) => {
    assertPlainObject(segment, `runtimeDialogue.dialogue_segments[${entryIndex}]`);
    if (!Number.isInteger(segment.index) || segment.index < 0) {
      throw new Error(`runtimeDialogue.dialogue_segments[${entryIndex}].index must be a non-negative integer.`);
    }
    if (typeof segment.text !== 'string' || segment.text.trim().length === 0) {
      throw new Error(`runtimeDialogue.dialogue_segments[${entryIndex}].text must be a non-empty string.`);
    }

    return {
      index: segment.index,
      text: segment.text,
      normalized_text: normalizeComparableText(segment.text)
    };
  }).sort((left, right) => left.index - right.index);
}

function buildAlignmentTruthState(dialogueTruth) {
  const segmentMap = buildTruthSegmentMap(dialogueTruth);
  return [...segmentMap.values()]
    .sort((left, right) => left.index - right.index)
    .map((segment) => ({
      index: segment.index,
      speaker_id: segment.speaker_id,
      label: segment.label,
      text: segment.text,
      normalized_text: segment.normalized_text,
      remaining_normalized_text: segment.normalized_text
    }));
}

function projectSpeakerGroupingTruthFromDialogueTruth(dialogueTruth, { sourcePath = null } = {}) {
  const segmentMap = buildTruthSegmentMap(dialogueTruth);
  const speakerProfiles = buildTruthSpeakerProfileMap(dialogueTruth);

  const projectedGroups = [...speakerProfiles.values()].map((profile) => {
    const linkedIndexes = profile.linked_segment_indexes;
    if (linkedIndexes.length === 0) {
      throw new Error(`dialogueTruth speaker profile ${profile.speaker_id} must link at least one segment.`);
    }

    for (const segmentIndex of linkedIndexes) {
      const segment = segmentMap.get(segmentIndex);
      if (!segment) {
        throw new Error(`dialogueTruth speaker profile ${profile.speaker_id} references missing segment index ${segmentIndex}.`);
      }
      if (segment.speaker_id !== profile.speaker_id) {
        throw new Error(
          `dialogueTruth speaker profile ${profile.speaker_id} linked segment ${segmentIndex} belongs to ${segment.speaker_id}.`
        );
      }
    }

    const firstSegmentIndex = linkedIndexes[0];
    return {
      speaker_group_key: buildSpeakerGroupKey(firstSegmentIndex),
      first_segment_index: firstSegmentIndex,
      segment_indexes: linkedIndexes,
      source_speaker_id: profile.speaker_id,
      label: profile.label,
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

function probeTruthAlignmentPlan(runtimeSegment, truthState, cursor, { maxMergeSegments = 4 } = {}) {
  const runtimeNormalizedText = runtimeSegment.normalized_text;
  const current = truthState[cursor];
  if (!current || current.remaining_normalized_text.length === 0) {
    return null;
  }

  if (current.remaining_normalized_text === runtimeNormalizedText) {
    return {
      alignment_kind: current.remaining_normalized_text === current.normalized_text ? 'exact_truth_segment' : 'truth_segment_split_piece',
      matched_truth_segment_indexes: [current.index],
      source_speaker_id: current.speaker_id,
      label: current.label,
      consume: [{ cursor, remaining_normalized_text: '' }],
      cursor_after: cursor + 1
    };
  }

  if (
    current.remaining_normalized_text.startsWith(runtimeNormalizedText) &&
    current.remaining_normalized_text.length > runtimeNormalizedText.length
  ) {
    return {
      alignment_kind: 'truth_segment_split_piece',
      matched_truth_segment_indexes: [current.index],
      source_speaker_id: current.speaker_id,
      label: current.label,
      consume: [{
        cursor,
        remaining_normalized_text: current.remaining_normalized_text.slice(runtimeNormalizedText.length)
      }],
      cursor_after: cursor
    };
  }

  if (
    current.remaining_normalized_text === current.normalized_text &&
    computeTokenOverlapScore(runtimeSegment.text, current.text) >= 0.6
  ) {
    return {
      alignment_kind: 'fuzzy_truth_segment',
      matched_truth_segment_indexes: [current.index],
      source_speaker_id: current.speaker_id,
      label: current.label,
      consume: [{ cursor, remaining_normalized_text: '' }],
      cursor_after: cursor + 1
    };
  }

  if (current.remaining_normalized_text !== current.normalized_text) {
    return null;
  }

  let merged = '';
  const consume = [];
  const matchedTruthSegmentIndexes = [];
  const sourceSpeakerId = current.speaker_id;
  const label = current.label;

  for (let probeCursor = cursor; probeCursor < truthState.length && matchedTruthSegmentIndexes.length < maxMergeSegments; probeCursor += 1) {
    const probe = truthState[probeCursor];
    if (probe.remaining_normalized_text !== probe.normalized_text) {
      break;
    }
    if (probe.speaker_id !== sourceSpeakerId) {
      break;
    }

    merged += probe.normalized_text;
    matchedTruthSegmentIndexes.push(probe.index);
    consume.push({ cursor: probeCursor, remaining_normalized_text: '' });

    if (merged === runtimeNormalizedText) {
      return {
        alignment_kind: matchedTruthSegmentIndexes.length === 1 ? 'exact_truth_segment' : 'merged_truth_segments',
        matched_truth_segment_indexes: matchedTruthSegmentIndexes,
        source_speaker_id: sourceSpeakerId,
        label,
        consume,
        cursor_after: probeCursor + 1
      };
    }

    if (!runtimeNormalizedText.startsWith(merged)) {
      break;
    }
  }

  return null;
}

function applyTruthAlignmentPlan(truthState, plan) {
  for (const update of plan.consume) {
    truthState[update.cursor].remaining_normalized_text = update.remaining_normalized_text;
  }
}

function projectRuntimeAlignedSpeakerGroupingTruth(dialogueTruth, runtimeDialogue, {
  sourcePath = null,
  runtimeDialoguePath = null,
  lookaheadTruthSegments = 8,
  maxMergeSegments = 4
} = {}) {
  const truthState = buildAlignmentTruthState(dialogueTruth);
  const runtimeSegments = buildRuntimeSegmentList(runtimeDialogue);
  const speakerProfiles = buildTruthSpeakerProfileMap(dialogueTruth);

  const alignmentEntries = [];
  const unmatchedTruthSegmentIndexes = [];
  const unmatchedRuntimeSegmentIndexes = [];

  let truthCursor = 0;
  let runtimeCursor = 0;

  while (runtimeCursor < runtimeSegments.length) {
    const runtimeSegment = runtimeSegments[runtimeCursor];
    let matched = false;

    while (!matched) {
      while (truthCursor < truthState.length && truthState[truthCursor].remaining_normalized_text.length === 0) {
        truthCursor += 1;
      }

      if (truthCursor >= truthState.length) {
        unmatchedRuntimeSegmentIndexes.push(runtimeSegment.index);
        alignmentEntries.push({
          runtime_segment_index: runtimeSegment.index,
          runtime_text: runtimeSegment.text,
          runtime_normalized_text: runtimeSegment.normalized_text,
          alignment_kind: 'runtime_extra_segment_not_in_truth',
          matched_truth_segment_indexes: [],
          source_speaker_id: null,
          label: null
        });
        matched = true;
        break;
      }

      let plan = probeTruthAlignmentPlan(runtimeSegment, truthState, truthCursor, { maxMergeSegments });

      if (!plan) {
        for (let candidateCursor = truthCursor + 1; candidateCursor < truthState.length && candidateCursor <= truthCursor + lookaheadTruthSegments; candidateCursor += 1) {
          if (truthState[candidateCursor - 1].remaining_normalized_text !== truthState[candidateCursor - 1].normalized_text) {
            break;
          }
          const candidatePlan = probeTruthAlignmentPlan(runtimeSegment, truthState, candidateCursor, { maxMergeSegments });
          if (candidatePlan) {
            for (let skippedCursor = truthCursor; skippedCursor < candidateCursor; skippedCursor += 1) {
              if (truthState[skippedCursor].remaining_normalized_text.length > 0) {
                unmatchedTruthSegmentIndexes.push(truthState[skippedCursor].index);
                truthState[skippedCursor].remaining_normalized_text = '';
              }
            }
            truthCursor = candidateCursor;
            plan = candidatePlan;
            break;
          }
        }
      }

      if (plan) {
        applyTruthAlignmentPlan(truthState, plan);
        truthCursor = plan.cursor_after;
        alignmentEntries.push({
          runtime_segment_index: runtimeSegment.index,
          runtime_text: runtimeSegment.text,
          runtime_normalized_text: runtimeSegment.normalized_text,
          alignment_kind: plan.alignment_kind,
          matched_truth_segment_indexes: plan.matched_truth_segment_indexes,
          source_speaker_id: plan.source_speaker_id,
          label: plan.label
        });
        matched = true;
        break;
      }

      const nextRuntimeSegment = runtimeSegments[runtimeCursor + 1] || null;
      if (nextRuntimeSegment) {
        const nextPlan = probeTruthAlignmentPlan(nextRuntimeSegment, truthState, truthCursor, { maxMergeSegments });
        if (nextPlan) {
          unmatchedRuntimeSegmentIndexes.push(runtimeSegment.index);
          alignmentEntries.push({
            runtime_segment_index: runtimeSegment.index,
            runtime_text: runtimeSegment.text,
            runtime_normalized_text: runtimeSegment.normalized_text,
            alignment_kind: 'runtime_extra_segment_not_in_truth',
            matched_truth_segment_indexes: [],
            source_speaker_id: null,
            label: null
          });
          matched = true;
          break;
        }
      }

      unmatchedTruthSegmentIndexes.push(truthState[truthCursor].index);
      truthState[truthCursor].remaining_normalized_text = '';
      truthCursor += 1;
    }

    runtimeCursor += 1;
  }

  while (truthCursor < truthState.length) {
    if (truthState[truthCursor].remaining_normalized_text.length > 0) {
      unmatchedTruthSegmentIndexes.push(truthState[truthCursor].index);
      truthState[truthCursor].remaining_normalized_text = '';
    }
    truthCursor += 1;
  }

  const matchedAlignmentEntries = alignmentEntries.filter((entry) => entry.matched_truth_segment_indexes.length > 0);
  const assignmentsBySpeakerId = new Map();

  for (const entry of matchedAlignmentEntries) {
    if (!assignmentsBySpeakerId.has(entry.source_speaker_id)) {
      assignmentsBySpeakerId.set(entry.source_speaker_id, []);
    }
    assignmentsBySpeakerId.get(entry.source_speaker_id).push(entry);
  }

  const projectedGroups = [...assignmentsBySpeakerId.entries()].map(([speakerId, entries]) => {
    const runtimeSegmentIndexes = sortNumericAscending(entries.map((entry) => entry.runtime_segment_index));
    const sourceTruthSegmentIndexes = sortNumericAscending(Array.from(new Set(entries.flatMap((entry) => entry.matched_truth_segment_indexes))));
    const firstRuntimeSegmentIndex = runtimeSegmentIndexes[0];
    const speakerProfile = speakerProfiles.get(speakerId);

    return {
      speaker_group_key: buildSpeakerGroupKey(firstRuntimeSegmentIndex),
      first_segment_index: firstRuntimeSegmentIndex,
      runtime_segment_indexes: runtimeSegmentIndexes,
      source_truth_segment_indexes: sourceTruthSegmentIndexes,
      source_first_segment_index: speakerProfile?.linked_segment_indexes?.[0] ?? sourceTruthSegmentIndexes[0] ?? null,
      source_speaker_id: speakerId,
      label: entries[0].label,
      segment_count: runtimeSegmentIndexes.length
    };
  }).sort((left, right) => {
    if (left.first_segment_index !== right.first_segment_index) {
      return left.first_segment_index - right.first_segment_index;
    }
    return left.source_speaker_id.localeCompare(right.source_speaker_id);
  });

  const groupBySpeakerId = new Map(projectedGroups.map((group) => [group.source_speaker_id, group]));
  const assignments = matchedAlignmentEntries
    .map((entry) => {
      const group = groupBySpeakerId.get(entry.source_speaker_id);
      return {
        segment_index: entry.runtime_segment_index,
        speaker_group_key: group.speaker_group_key,
        source_speaker_id: group.source_speaker_id,
        label: group.label,
        text: entry.runtime_text,
        matched_truth_segment_indexes: entry.matched_truth_segment_indexes,
        alignment_kind: entry.alignment_kind
      };
    })
    .sort((left, right) => left.segment_index - right.segment_index);

  return {
    schema_version: 1,
    contract: {
      artifact: 'speaker-grouping-truth',
      mode: 'runtime-aligned-comparator-projection',
      source_artifact: 'dialogue-data'
    },
    projection: {
      source_path: sourcePath,
      runtime_dialogue_path: runtimeDialoguePath,
      derived_from_paths: [
        'dialogue_segments[*].index',
        'dialogue_segments[*].speaker_id',
        'speaker_profiles[*].speaker_id',
        'speaker_profiles[*].grounded.linked_segment_indexes',
        'speaker_profiles[*].label',
        'runtime.dialogue_segments[*].index',
        'runtime.dialogue_segments[*].text'
      ],
      stable_group_key_rule: 'first_runtime_segment_index',
      alignment_strategy: 'ordered_text_alignment_v1'
    },
    alignment: {
      runtime_segment_count: runtimeSegments.length,
      matched_runtime_segment_count: assignments.length,
      unmatched_runtime_segment_indexes: sortNumericAscending(Array.from(new Set(unmatchedRuntimeSegmentIndexes))),
      unmatched_truth_segment_indexes: sortNumericAscending(Array.from(new Set(unmatchedTruthSegmentIndexes))),
      runtime_segments: alignmentEntries
    },
    speaker_groups: projectedGroups,
    assignments,
    summary: {
      group_count: projectedGroups.length,
      assignment_count: assignments.length,
      unmatched_truth_segment_count: sortNumericAscending(Array.from(new Set(unmatchedTruthSegmentIndexes))).length,
      unmatched_runtime_segment_count: sortNumericAscending(Array.from(new Set(unmatchedRuntimeSegmentIndexes))).length
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
  normalizeComparableText,
  projectSpeakerGroupingTruthFromDialogueTruth,
  projectRuntimeAlignedSpeakerGroupingTruth,
  normalizeRuntimeSpeakerGroupingArtifact,
  compareSpeakerGroupingTruthProjection
};
