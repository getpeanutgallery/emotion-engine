const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

const {
  validateDialogueV3SourceTruthObject
} = require('../../server/lib/dialogue-v3-source-truth-validator.cjs');
const {
  validateDialogueV3HeuristicsRulesetObject,
  loadDialogueV3HeuristicsRulesetFromFile
} = require('../../server/lib/dialogue-v3-heuristics-ruleset.cjs');
const {
  runDialogueV3SpeakerGrouping
} = require('../../server/lib/dialogue-v3-speaker-grouping.cjs');
const {
  projectSpeakerGroupingTruthFromDialogueTruth,
  projectRuntimeAlignedSpeakerGroupingTruth,
  compareSpeakerGroupingTruthProjection
} = require('../../server/lib/dialogue-v3-speaker-grouping-benchmark.cjs');

const ROOT = path.resolve(__dirname, '../..');
const FIXTURE_ROOT = path.join(ROOT, 'test/fixtures/dialogue-v3-proof-gates');
const RULESET_PATH = path.join(ROOT, 'docs/2026-04-16-dialogue-traits-v3-speaker-grouping-heuristics-ruleset.yaml');
const COD_DIALOGUE_TRUTH_PATH = path.join(ROOT, 'benchmarks/fixtures/cod-test/truth/dialogue-data.json');
const COD_GROUPING_TRUTH_PATH = path.join(ROOT, 'benchmarks/fixtures/cod-test/truth/speaker-grouping.json');
const COD_RUNTIME_DIALOGUE_V3_PATH = path.join(ROOT, 'output/cod-test/phase1-gather-context/dialogue-v3-source-truth.reconciled.json');
const COD_RUNTIME_ALIGNED_GROUPING_TRUTH_PATH = path.join(ROOT, 'benchmarks/fixtures/cod-test/truth/speaker-grouping.reconciled-runtime-aligned.json');

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(FIXTURE_ROOT, relativePath), 'utf8'));
}

function readYaml(relativePath) {
  return yaml.load(fs.readFileSync(path.join(FIXTURE_ROOT, relativePath), 'utf8'));
}

function loadCodTruthJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

test('proof gate fixtures reject source-truth leakage and superseded names before any real run is trusted', () => {
  const valid = validateDialogueV3SourceTruthObject(readJson('source-truth/valid-dialogue-data.json'));
  assert.equal(valid.ok, true);

  const forbidden = validateDialogueV3SourceTruthObject(readJson('source-truth/reject-forbidden-fields.json'));
  assert.equal(forbidden.ok, false);
  assert.ok(forbidden.errors.some((error) => error.path === '$.speaker_profiles' && error.code === 'forbidden_field'));
  assert.ok(forbidden.errors.some((error) => error.path === '$.dialogue_segments[0].speaker_id' && error.code === 'forbidden_field'));
  assert.ok(forbidden.errors.some((error) => error.path === '$.dialogue_segments[0].start' && error.code === 'forbidden_field'));

  const superseded = validateDialogueV3SourceTruthObject(readJson('source-truth/reject-superseded-traits.json'));
  assert.equal(superseded.ok, false);
  assert.ok(superseded.errors.some((error) => error.path === '$.dialogue_segments[0].traits.channel_texture' && error.code === 'superseded_normative_name'));
  assert.ok(superseded.errors.some((error) => error.path === '$.dialogue_segments[0].traits.delivery_stance' && error.code === 'superseded_normative_name'));
  assert.ok(superseded.errors.some((error) => error.path === '$.dialogue_segments[0].traits.phonation' && error.code === 'superseded_normative_name'));
});

test('proof gate fixtures reject ruleset unknown keys and invalid enum references fail-closed', () => {
  const unknownKey = validateDialogueV3HeuristicsRulesetObject(readYaml('ruleset/reject-unknown-key.yaml'));
  assert.equal(unknownKey.ok, false);
  assert.ok(unknownKey.errors.some((error) => error.path === '$.not_supported_here' && error.code === 'unknown_key'));

  const badEnum = validateDialogueV3HeuristicsRulesetObject(readYaml('ruleset/reject-bad-enum.yaml'));
  assert.equal(badEnum.ok, false);
  assert.ok(badEnum.errors.some((error) => error.path === '$.reliability_policy.clean_reuse_gate.audibility_must_be' && error.code === 'invalid_enum_reference'));
  assert.ok(badEnum.errors.some((error) => error.path === '$.field_policies.audibility.reliable_values[1]' && error.code === 'invalid_enum_reference'));
  assert.ok(badEnum.errors.some((error) => error.path === '$.blocker_policy.rules[0].source_field' && error.code === 'invalid_enum_reference'));
  assert.ok(badEnum.errors.some((error) => error.path === '$.warning_level_guardrails.cross_field_checks[0].level' && error.code === 'invalid_enum_reference'));
});

test('proof gate micro-fixture produces a deterministic reducer/scorer/ledger bundle', () => {
  const dialogueValidation = validateDialogueV3SourceTruthObject(readJson('grouping/micro-clean-reuse-dialogue-data.json'));
  assert.equal(dialogueValidation.ok, true);

  const ruleset = loadDialogueV3HeuristicsRulesetFromFile(RULESET_PATH);
  assert.equal(ruleset.ok, true);

  const result = runDialogueV3SpeakerGrouping({
    dialogueData: dialogueValidation.value,
    compiledRuleset: ruleset.value,
    sourceRef: { path: 'test/fixtures/dialogue-v3-proof-gates/grouping/micro-clean-reuse-dialogue-data.json' },
    rulesetRef: { path: RULESET_PATH },
    runtimeMetadata: { proof_gate: 'micro-clean-reuse' }
  });

  assert.equal(result.artifact.summary.group_count, 2);
  assert.equal(result.artifact.summary.assignment_count, 3);
  assert.equal(result.artifact.summary.ambiguous_assignment_count, 0);
  assert.equal(result.artifact.decision_ledger.length, 3);
  assert.equal(result.artifact.assignments[0].chosen_action, 'create_group');
  assert.equal(result.artifact.assignments[1].chosen_action, 'reuse_group');
  assert.equal(result.artifact.assignments[1].group_id, result.artifact.assignments[0].group_id);
  assert.equal(result.artifact.assignments[2].chosen_action, 'create_group');
  assert.notEqual(result.artifact.assignments[2].group_id, result.artifact.assignments[0].group_id);
  assert.ok(result.artifact.decision_ledger[2].blockers_triggered.some((blocker) => blocker.rule_id === 'clean_binary_gender_conflict'));
});

test('cod-test golden speaker-grouping truth file matches the comparator-ready projection from dialogue truth', () => {
  const dialogueTruth = loadCodTruthJson(COD_DIALOGUE_TRUTH_PATH);
  const projected = projectSpeakerGroupingTruthFromDialogueTruth(dialogueTruth, {
    sourcePath: 'benchmarks/fixtures/cod-test/truth/dialogue-data.json'
  });
  const checkedIn = loadCodTruthJson(COD_GROUPING_TRUTH_PATH);

  assert.deepEqual(checkedIn, projected);
  assert.equal(checkedIn.summary.group_count, 13);
  assert.equal(checkedIn.summary.assignment_count, 20);
  assert.equal(checkedIn.assignments[0].speaker_group_key, 'first_segment_000');
  assert.equal(checkedIn.assignments[19].speaker_group_key, 'first_segment_019');
});

test('cod-test runtime-aligned speaker-grouping truth file is reproducibly derived from golden dialogue truth plus reconciled runtime dialogue surface', () => {
  const dialogueTruth = loadCodTruthJson(COD_DIALOGUE_TRUTH_PATH);
  const runtimeDialogue = loadCodTruthJson(COD_RUNTIME_DIALOGUE_V3_PATH);
  const projected = projectRuntimeAlignedSpeakerGroupingTruth(dialogueTruth, runtimeDialogue, {
    sourcePath: 'benchmarks/fixtures/cod-test/truth/dialogue-data.json',
    runtimeDialoguePath: 'output/cod-test/phase1-gather-context/dialogue-v3-source-truth.reconciled.json'
  });
  const checkedIn = loadCodTruthJson(COD_RUNTIME_ALIGNED_GROUPING_TRUTH_PATH);

  assert.deepEqual(checkedIn, projected);
  assert.equal(checkedIn.summary.group_count, 11);
  assert.equal(checkedIn.summary.assignment_count, 17);
  assert.deepEqual(checkedIn.alignment.unmatched_truth_segment_indexes, [9, 10, 11]);
  assert.deepEqual(checkedIn.alignment.unmatched_runtime_segment_indexes, [11]);
  assert.equal(checkedIn.assignments[0].speaker_group_key, 'first_segment_000');
  assert.equal(checkedIn.assignments[checkedIn.assignments.length - 1].speaker_group_key, 'first_segment_017');
});

test('cod-test comparator-ready truth projection passes a perfect normalized runtime artifact and flags partition drift', () => {
  const truthProjection = loadCodTruthJson(COD_GROUPING_TRUTH_PATH);

  const perfectRuntime = {
    contract: {
      artifact: 'speaker-grouping',
      mode: 'traits-first-derived',
      grouping_output_version: '3.0.0'
    },
    speaker_groups: truthProjection.speaker_groups.map((group, index) => ({
      group_id: `grp_${String(index + 1).padStart(3, '0')}`,
      speaker_id: `runtime_${String(index + 1).padStart(3, '0')}`,
      first_segment_index: group.first_segment_index,
      last_segment_index: group.segment_indexes[group.segment_indexes.length - 1],
      segment_indexes: group.segment_indexes,
      ambiguous_segment_indexes: [],
      canonical_traits: {},
      support: { segment_count: group.segment_indexes.length, ambiguous_member_count: 0, trait_value_counts: {} }
    })),
    assignments: truthProjection.assignments.map((assignment) => {
      const matchingGroupIndex = truthProjection.speaker_groups.findIndex((group) => group.speaker_group_key === assignment.speaker_group_key);
      return {
        segment_index: assignment.segment_index,
        group_id: `grp_${String(matchingGroupIndex + 1).padStart(3, '0')}`,
        speaker_id: `runtime_${String(matchingGroupIndex + 1).padStart(3, '0')}`,
        chosen_action: 'reuse_group',
        ambiguous: false,
        runner_up_group_id: null,
        score_margin: 10,
        abstention_reasons: [],
        pre_update_candidate_group_ids: []
      };
    }),
    decision_ledger: [],
    summary: {
      group_count: truthProjection.summary.group_count,
      assignment_count: truthProjection.summary.assignment_count,
      ambiguous_assignment_count: 0,
      singleton_group_count: truthProjection.speaker_groups.filter((group) => group.segment_indexes.length === 1).length
    }
  };

  const perfectComparison = compareSpeakerGroupingTruthProjection({
    truthProjection,
    runtimeArtifact: perfectRuntime
  });
  assert.equal(perfectComparison.ok, true);
  assert.equal(perfectComparison.mismatch_count, 0);

  const driftedRuntime = JSON.parse(JSON.stringify(perfectRuntime));
  driftedRuntime.assignments.find((assignment) => assignment.segment_index === 15).group_id = 'grp_001';

  const driftedComparison = compareSpeakerGroupingTruthProjection({
    truthProjection,
    runtimeArtifact: driftedRuntime
  });
  assert.equal(driftedComparison.ok, false);
  assert.equal(driftedComparison.mismatch_count, 1);
  assert.deepEqual(driftedComparison.mismatches[0], {
    segment_index: 15,
    expected_speaker_group_key: 'first_segment_002',
    actual_speaker_group_key: 'first_segment_000'
  });
});
