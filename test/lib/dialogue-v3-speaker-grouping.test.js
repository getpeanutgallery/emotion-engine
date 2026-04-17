const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');

const {
  validateDialogueV3SourceTruthObject
} = require('../../server/lib/dialogue-v3-source-truth-validator.cjs');
const {
  loadDialogueV3HeuristicsRulesetFromFile
} = require('../../server/lib/dialogue-v3-heuristics-ruleset.cjs');
const {
  GROUPING_OUTPUT_VERSION,
  GROUPING_CONTRACT_MODE,
  deriveCanonicalFieldValue,
  createDialogueV3SpeakerGroupingReducer
} = require('../../server/lib/dialogue-v3-speaker-grouping.cjs');

const RULESET_PATH = path.resolve(
  __dirname,
  '../../docs/2026-04-16-dialogue-traits-v3-speaker-grouping-heuristics-ruleset.yaml'
);

function buildValidDialogueData() {
  return {
    schema_version: 1,
    contract: {
      artifact: 'dialogue-data',
      mode: 'traits',
      traits_contract_version: '3.0.0'
    },
    summary: 'Three voiced lines with conflicting and abstaining evidence.',
    dialogue_segments: [
      {
        index: 0,
        text: 'Hold your fire until I say so.',
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
      },
      {
        index: 1,
        text: 'Copy that.',
        traits: {
          audibility: 'unknown',
          overlap: 'single_voice',
          gender_presentation: 'masculine',
          age_impression: 'adult',
          pitch_band: 'mid',
          phonation: 'clear',
          pace: 'fast',
          energy: 'steady',
          transmission_medium: 'radio',
          spatial_texture: 'room',
          accent_strength: 'none_apparent',
          accent_family: 'neutral_or_unmarked',
          affect: 'determined',
          interpersonal_stance: 'supportive',
          delivery_overlay: 'none_apparent'
        }
      },
      {
        index: 2,
        text: 'I said stand down.',
        traits: {
          audibility: 'clear',
          overlap: 'single_voice',
          gender_presentation: 'feminine',
          age_impression: 'adult',
          pitch_band: 'mid',
          phonation: 'clear',
          pace: 'measured',
          energy: 'intense',
          transmission_medium: 'radio',
          spatial_texture: 'room',
          accent_strength: 'clear_non_neutral',
          accent_family: 'anglophone_non_neutral',
          affect: 'angry',
          interpersonal_stance: 'directive',
          delivery_overlay: 'none_apparent'
        }
      }
    ]
  };
}

function loadCompiledRuleset() {
  const result = loadDialogueV3HeuristicsRulesetFromFile(RULESET_PATH);
  assert.equal(result.ok, true);
  return result.value;
}

function buildReducer(dialogueData = buildValidDialogueData()) {
  const validation = validateDialogueV3SourceTruthObject(dialogueData);
  assert.equal(validation.ok, true);

  return createDialogueV3SpeakerGroupingReducer({
    dialogueData: validation.value,
    compiledRuleset: loadCompiledRuleset(),
    sourceRef: {
      path: 'output/test-run/phase1-gather-context/dialogue-data.json'
    },
    rulesetRef: {
      path: RULESET_PATH
    },
    runtimeMetadata: {
      run_id: 'unit-test-run'
    }
  });
}

test('deriveCanonicalFieldValue keeps concrete leaders, treats none_apparent as concrete, and collapses unresolved conflicts to mixed/variable', () => {
  assert.equal(deriveCanonicalFieldValue({
    total_observations: 2,
    concrete_observation_count: 2,
    value_counts: {
      none_apparent: 2
    },
    sentinel_counts: {
      unknown: 0,
      mixed: 0,
      variable: 0
    }
  }), 'none_apparent');

  assert.equal(deriveCanonicalFieldValue({
    total_observations: 2,
    concrete_observation_count: 2,
    value_counts: {
      masculine: 1,
      feminine: 1
    },
    sentinel_counts: {
      unknown: 0,
      mixed: 0,
      variable: 0
    }
  }), 'mixed');

  assert.equal(deriveCanonicalFieldValue({
    total_observations: 2,
    concrete_observation_count: 0,
    value_counts: {},
    sentinel_counts: {
      unknown: 0,
      mixed: 1,
      variable: 2
    }
  }), 'variable');
});

test('speaker-grouping reducer exposes a separate artifact seam with deferred singleton merge metadata', () => {
  const reducer = buildReducer();
  const artifact = reducer.getArtifact();

  assert.equal(artifact.contract.artifact, 'speaker-grouping');
  assert.equal(artifact.contract.mode, GROUPING_CONTRACT_MODE);
  assert.equal(artifact.contract.grouping_output_version, GROUPING_OUTPUT_VERSION);
  assert.equal(artifact.input.path, 'output/test-run/phase1-gather-context/dialogue-data.json');
  assert.equal(artifact.ruleset.path, RULESET_PATH);
  assert.equal(artifact.metadata.cleanup.singleton_merge.enabled_in_ruleset, true);
  assert.equal(artifact.metadata.cleanup.singleton_merge.executed, false);
  assert.equal(artifact.metadata.cleanup.singleton_merge.posture, 'deferred_first_slice');
  assert.deepEqual(artifact.speaker_groups, []);
  assert.deepEqual(artifact.assignments, []);
  assert.deepEqual(artifact.decision_ledger, []);
});

test('speaker-grouping reducer returns immutable pre-update candidate snapshots and keeps source truth unmodified', () => {
  const dialogueData = buildValidDialogueData();
  const original = JSON.parse(JSON.stringify(dialogueData));
  const reducer = buildReducer(dialogueData);

  const firstDecision = reducer.applyDecision({
    segmentIndex: 0,
    action: 'create_group'
  });
  assert.equal(firstDecision.pre_update_candidate_snapshots.length, 0);

  const secondDecision = reducer.applyDecision({
    segmentIndex: 1,
    action: 'reuse_group',
    groupId: firstDecision.chosen_group.group_id,
    ambiguous: true,
    runnerUpGroupId: null,
    scoreMargin: 0.4,
    abstentionReasons: ['audibility']
  });

  assert.equal(secondDecision.pre_update_candidate_snapshots.length, 1);
  assert.equal(secondDecision.pre_update_candidate_snapshots[0].snapshot_stage, 'pre_update');
  assert.equal(secondDecision.pre_update_candidate_snapshots[0].for_segment_index, 1);
  assert.deepEqual(secondDecision.pre_update_candidate_snapshots[0].segment_indexes, [0]);

  const groupAfterReuse = reducer.getGroupRecord(firstDecision.chosen_group.group_id);
  assert.deepEqual(groupAfterReuse.segment_indexes, [0, 1]);
  assert.deepEqual(secondDecision.pre_update_candidate_snapshots[0].segment_indexes, [0]);
  assert.equal(secondDecision.assignment.ambiguous, true);
  assert.deepEqual(secondDecision.assignment.abstention_reasons, ['audibility']);
  assert.deepEqual(secondDecision.assignment.pre_update_candidate_group_ids, [firstDecision.chosen_group.group_id]);

  assert.deepEqual(dialogueData, original);
  assert.equal(Object.prototype.hasOwnProperty.call(dialogueData.dialogue_segments[0], 'speaker_id'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(dialogueData.dialogue_segments[1], 'group_id'), false);
});

test('speaker-grouping reducer updates canonical_traits and support state on the derived group artifact only', () => {
  const reducer = buildReducer();

  const created = reducer.applyDecision({
    segmentIndex: 0,
    action: 'create_group'
  });

  reducer.applyDecision({
    segmentIndex: 2,
    action: 'reuse_group',
    groupId: created.chosen_group.group_id
  });

  const artifact = reducer.getArtifact();
  assert.equal(artifact.summary.group_count, 1);
  assert.equal(artifact.summary.assignment_count, 2);
  assert.equal(artifact.summary.singleton_group_count, 0);

  const group = artifact.speaker_groups[0];
  assert.deepEqual(group.segment_indexes, [0, 2]);
  assert.equal(group.support.segment_count, 2);
  assert.equal(group.support.trait_value_counts.gender_presentation.value_counts.masculine, 1);
  assert.equal(group.support.trait_value_counts.gender_presentation.value_counts.feminine, 1);
  assert.equal(group.canonical_traits.gender_presentation, 'mixed');
  assert.equal(group.canonical_traits.accent_strength, 'mixed');
  assert.equal(group.canonical_traits.accent_family, 'mixed');
  assert.equal(group.canonical_traits.transmission_medium, 'radio');

  const assignment = artifact.assignments[1];
  assert.equal(assignment.segment_index, 2);
  assert.equal(assignment.group_id, group.group_id);
  assert.equal(assignment.speaker_id, group.speaker_id);
});

test('speaker-grouping reducer lets scorer-side trace land in decision_ledger without mutating group records', () => {
  const reducer = buildReducer();
  const created = reducer.applyDecision({ segmentIndex: 0, action: 'create_group' });

  reducer.recordDecisionLedgerEntry({
    segment_index: 0,
    chosen_group_id: created.chosen_group.group_id,
    candidate_groups_considered: [],
    short_contract_safe_reason: ['gender_presentation', 'pitch_band']
  });

  const artifact = reducer.getArtifact();
  assert.equal(artifact.decision_ledger.length, 1);
  assert.equal(artifact.decision_ledger[0].chosen_group_id, created.chosen_group.group_id);
  assert.equal(artifact.speaker_groups.length, 1);
});
