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
  evaluateFieldComparison,
  resolveSegmentAssignment,
  createDialogueV3SpeakerGroupingReducer,
  runDialogueV3SpeakerGrouping
} = require('../../server/lib/dialogue-v3-speaker-grouping.cjs');

const RULESET_PATH = path.resolve(
  __dirname,
  '../../docs/2026-04-16-dialogue-traits-v3-speaker-grouping-heuristics-ruleset.yaml'
);

function buildBaseTraits(overrides = {}) {
  return {
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
    delivery_overlay: 'none_apparent',
    ...overrides
  };
}

function buildDialogueDataFromTraits(segmentTraits) {
  return {
    schema_version: 1,
    contract: {
      artifact: 'dialogue-data',
      mode: 'traits',
      traits_contract_version: '3.0.0'
    },
    summary: 'Synthetic dialogue fixture for deterministic grouping tests.',
    dialogue_segments: segmentTraits.map((traits, index) => ({
      index,
      text: `Line ${index}`,
      traits: buildBaseTraits(traits)
    }))
  };
}

function buildValidDialogueData() {
  return buildDialogueDataFromTraits([
    {},
    {
      audibility: 'unknown',
      pace: 'fast',
      affect: 'determined',
      interpersonal_stance: 'supportive'
    },
    {
      gender_presentation: 'feminine',
      energy: 'intense',
      accent_strength: 'clear_non_neutral',
      accent_family: 'anglophone_non_neutral',
      affect: 'angry'
    }
  ]);
}

function loadCompiledRuleset() {
  const result = loadDialogueV3HeuristicsRulesetFromFile(RULESET_PATH);
  assert.equal(result.ok, true);
  return result.value;
}

function validateDialogueData(dialogueData) {
  const validation = validateDialogueV3SourceTruthObject(dialogueData);
  assert.equal(validation.ok, true);
  return validation.value;
}

function buildReducer(dialogueData = buildValidDialogueData()) {
  return createDialogueV3SpeakerGroupingReducer({
    dialogueData: validateDialogueData(dialogueData),
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

test('evaluateFieldComparison keeps phonation as strong scoring evidence while treating unknown and mixed as non-concrete', () => {
  const compiledRuleset = loadCompiledRuleset();

  const exact = evaluateFieldComparison({
    field: 'phonation',
    lineValue: 'whispered',
    groupValue: 'whispered',
    compiledRuleset,
    cleanReuseGate: true
  });
  assert.equal(exact.relation, 'exact_match');
  assert.equal(exact.delta, 3);

  const mismatch = evaluateFieldComparison({
    field: 'phonation',
    lineValue: 'whispered',
    groupValue: 'clear',
    compiledRuleset,
    cleanReuseGate: true
  });
  assert.equal(mismatch.relation, 'mismatch');
  assert.equal(mismatch.delta, -2.5);

  const abstain = evaluateFieldComparison({
    field: 'phonation',
    lineValue: 'unknown',
    groupValue: 'whispered',
    compiledRuleset,
    cleanReuseGate: true
  });
  assert.equal(abstain.relation, 'abstain');
  assert.equal(abstain.delta, 0);

  const ambiguous = evaluateFieldComparison({
    field: 'phonation',
    lineValue: 'mixed',
    groupValue: 'clear',
    compiledRuleset,
    cleanReuseGate: true
  });
  assert.equal(ambiguous.relation, 'ambiguous');
  assert.equal(ambiguous.delta, 0);
});

test('automatic scorer reuses a strong matching group and records a deterministic ledger entry', () => {
  const reducer = buildReducer(buildDialogueDataFromTraits([
    {},
    {
      affect: 'determined',
      energy: 'steady'
    }
  ]));

  const first = reducer.scoreAndApplySegment(0);
  assert.equal(first.decision.chosen_action, 'create_group');

  const second = reducer.scoreAndApplySegment(1);
  assert.equal(second.decision.chosen_action, 'reuse_group');
  assert.equal(second.assignment.group_id, first.assignment.group_id);
  assert.equal(second.ledger_entry.chosen_action, 'reuse_group');
  assert.equal(second.ledger_entry.candidate_groups_considered.length, 1);
  assert.ok(second.ledger_entry.score_contributions_by_field_or_bucket.some((entry) => entry.field === 'gender_presentation'));
  assert.deepEqual(second.ledger_entry.abstentions_from_unknown_mixed_variable, []);
});

test('automatic scorer creates a new group when a clean hard blocker fires', () => {
  const reducer = buildReducer(buildDialogueDataFromTraits([
    {},
    {
      gender_presentation: 'feminine',
      pitch_band: 'high',
      accent_strength: 'clear_non_neutral',
      accent_family: 'anglophone_non_neutral'
    }
  ]));

  const first = reducer.scoreAndApplySegment(0);
  const second = reducer.scoreAndApplySegment(1);

  assert.equal(first.decision.chosen_action, 'create_group');
  assert.equal(second.decision.chosen_action, 'create_group');
  assert.notEqual(second.assignment.group_id, first.assignment.group_id);
  assert.ok(second.decision.candidate_groups_considered[0].hard_blocked);
  assert.ok(second.ledger_entry.blockers_triggered.some((blocker) => blocker.rule_id === 'clean_binary_gender_conflict'));
});

test('automatic scorer uses only the normalized whispered-vs-nonwhispered soft-review blocker posture', () => {
  const reducer = buildReducer(buildDialogueDataFromTraits([
    {
      phonation: 'clear'
    },
    {
      phonation: 'whispered',
      gender_presentation: 'feminine',
      pitch_band: 'high'
    }
  ]));

  reducer.scoreAndApplySegment(0);
  const second = reducer.scoreAndApplySegment(1);

  assert.equal(second.decision.chosen_action, 'create_group');
  assert.ok(second.ledger_entry.blockers_triggered.some((blocker) => blocker.rule_id === 'whispered_line_vs_nonwhispered_group_guard'));
  assert.ok(second.decision.abstention_reasons.includes('phonation'));
});

test('automatic scorer suppresses hard blockers under degraded gating and the resolver prefers ambiguity when close scores remain', () => {
  const dialogueData = buildDialogueDataFromTraits([
    {
      gender_presentation: 'masculine',
      pitch_band: 'mid',
      phonation: 'clear',
      accent_strength: 'none_apparent',
      accent_family: 'neutral_or_unmarked',
      affect: 'serious'
    },
    {
      gender_presentation: 'feminine',
      pitch_band: 'high',
      phonation: 'clear',
      accent_strength: 'clear_non_neutral',
      accent_family: 'anglophone_non_neutral',
      affect: 'angry'
    },
    {
      audibility: 'partially_masked',
      gender_presentation: 'feminine',
      pitch_band: 'high',
      phonation: 'clear',
      accent_strength: 'clear_non_neutral',
      accent_family: 'anglophone_non_neutral',
      affect: 'serious'
    }
  ]);
  const reducer = buildReducer(dialogueData);
  const compiledRuleset = loadCompiledRuleset();

  reducer.scoreAndApplySegment(0);
  reducer.scoreAndApplySegment(1);
  const candidateScores = reducer.scoreSegment(2);

  assert.ok(candidateScores.some((candidate) => candidate.blockers_suppressed.length > 0));

  const closeDecision = resolveSegmentAssignment({
    segment: {
      index: 2,
      traits: buildBaseTraits({ audibility: 'partially_masked' })
    },
    candidateScores: candidateScores.map((candidate, index) => ({
      ...candidate,
      score: index === 0 ? 6.2 : 5.7,
      hard_blocked: false,
      soft_review_blocked: false,
      clean_reuse_gate: false,
      matched_concrete_stable_identity_fields: 4,
      exact_stable_identity_match_count: 4,
      discriminative_stable_identity_exact_match_count: 4,
      stable_identity_mismatch_count: index,
      previous_occurrence_distance: index + 1,
      blockers_triggered: [],
      blockers_suppressed: candidate.blockers_suppressed,
      abstentions_from_unknown_mixed_variable: [],
      diagnostics: {
        default_shared_only_reuse_pressure: false,
        stable_identity_abstention_count: 0,
        discriminative_stable_identity_exact_match_count: 4,
        matched_concrete_stable_identity_fields: 4,
        positive_bonus_rule_ids: [],
        exact_default_shared_match_fields: [],
        non_default_exact_match_fields: ['gender_presentation', 'pitch_band', 'phonation'],
        selective_non_clean_reuse_support: true
      }
    })),
    compiledRuleset
  });

  assert.equal(closeDecision.chosen_action, 'ambiguous_reuse');
  assert.equal(closeDecision.ambiguous, true);
  assert.ok(closeDecision.score_margin < 1);
});

test('automatic scorer creates a new group under non-clean sparse-trait default-shared-only reuse pressure and records diagnostics', () => {
  const reducer = buildReducer(buildDialogueDataFromTraits([
    {
      audibility: 'partially_masked',
      gender_presentation: 'unknown',
      age_impression: 'unknown',
      pitch_band: 'unknown',
      phonation: 'unknown',
      pace: 'unknown',
      energy: 'unknown',
      transmission_medium: 'direct',
      spatial_texture: 'room',
      accent_strength: 'none_apparent',
      accent_family: 'neutral_or_unmarked',
      affect: 'unknown',
      interpersonal_stance: 'neutral',
      delivery_overlay: 'none_apparent'
    },
    {
      audibility: 'partially_masked',
      gender_presentation: 'unknown',
      age_impression: 'unknown',
      pitch_band: 'unknown',
      phonation: 'unknown',
      pace: 'unknown',
      energy: 'unknown',
      transmission_medium: 'direct',
      spatial_texture: 'room',
      accent_strength: 'none_apparent',
      accent_family: 'neutral_or_unmarked',
      affect: 'unknown',
      interpersonal_stance: 'neutral',
      delivery_overlay: 'none_apparent'
    }
  ]));

  reducer.scoreAndApplySegment(0);
  const second = reducer.scoreAndApplySegment(1);

  assert.equal(second.decision.chosen_action, 'create_group');
  assert.equal(second.candidate_scores[0].clean_reuse_gate, false);
  assert.equal(second.candidate_scores[0].diagnostics.default_shared_only_reuse_pressure, true);
  assert.ok(second.candidate_scores[0].score_contributions_by_field_or_bucket.some((entry) => entry.rule_id === 'default_shared_only_reuse_pressure_penalty'));
  assert.equal(second.ledger_entry.diagnostics.default_shared_only_reuse_pressure, true);
  assert.deepEqual(second.ledger_entry.diagnostics.exact_default_shared_match_fields.sort(), [
    'accent_family',
    'accent_strength',
    'delivery_overlay',
    'interpersonal_stance',
    'spatial_texture',
    'transmission_medium'
  ]);
});

test('automatic scorer still allows non-clean reuse when discriminative stable identity evidence is concrete', () => {
  const reducer = buildReducer(buildDialogueDataFromTraits([
    {
      audibility: 'partially_masked',
      gender_presentation: 'masculine',
      age_impression: 'unknown',
      pitch_band: 'mid',
      phonation: 'clear',
      pace: 'unknown',
      energy: 'unknown',
      transmission_medium: 'direct',
      spatial_texture: 'room',
      accent_strength: 'none_apparent',
      accent_family: 'neutral_or_unmarked',
      affect: 'unknown',
      interpersonal_stance: 'neutral',
      delivery_overlay: 'none_apparent'
    },
    {
      audibility: 'partially_masked',
      gender_presentation: 'masculine',
      age_impression: 'unknown',
      pitch_band: 'mid',
      phonation: 'clear',
      pace: 'unknown',
      energy: 'unknown',
      transmission_medium: 'direct',
      spatial_texture: 'room',
      accent_strength: 'none_apparent',
      accent_family: 'neutral_or_unmarked',
      affect: 'unknown',
      interpersonal_stance: 'neutral',
      delivery_overlay: 'none_apparent'
    }
  ]));

  const first = reducer.scoreAndApplySegment(0);
  const second = reducer.scoreAndApplySegment(1);

  assert.equal(first.decision.chosen_action, 'create_group');
  assert.equal(second.decision.chosen_action, 'reuse_group');
  assert.equal(second.assignment.group_id, first.assignment.group_id);
  assert.equal(second.candidate_scores[0].diagnostics.default_shared_only_reuse_pressure, false);
  assert.ok(second.candidate_scores[0].discriminative_stable_identity_exact_match_count >= 3);
});

test('automatic scorer recovers non-clean recent reuse when a non-default exact cue provides selective support', () => {
  const reducer = buildReducer(buildDialogueDataFromTraits([
    {
      audibility: 'partially_masked',
      gender_presentation: 'unknown',
      age_impression: 'unknown',
      pitch_band: 'unknown',
      phonation: 'unknown',
      pace: 'fast',
      energy: 'unknown',
      transmission_medium: 'direct',
      spatial_texture: 'room',
      accent_strength: 'none_apparent',
      accent_family: 'neutral_or_unmarked',
      affect: 'unknown',
      interpersonal_stance: 'neutral',
      delivery_overlay: 'none_apparent'
    },
    {
      audibility: 'partially_masked',
      gender_presentation: 'unknown',
      age_impression: 'unknown',
      pitch_band: 'unknown',
      phonation: 'unknown',
      pace: 'fast',
      energy: 'unknown',
      transmission_medium: 'direct',
      spatial_texture: 'room',
      accent_strength: 'none_apparent',
      accent_family: 'neutral_or_unmarked',
      affect: 'unknown',
      interpersonal_stance: 'neutral',
      delivery_overlay: 'none_apparent'
    }
  ]));

  const first = reducer.scoreAndApplySegment(0);
  const second = reducer.scoreAndApplySegment(1);

  assert.equal(first.decision.chosen_action, 'create_group');
  assert.equal(second.decision.chosen_action, 'reuse_group');
  assert.equal(second.assignment.group_id, first.assignment.group_id);
  assert.equal(second.candidate_scores[0].diagnostics.default_shared_only_reuse_pressure, false);
  assert.deepEqual(second.candidate_scores[0].diagnostics.non_default_exact_match_fields, ['pace']);
  assert.equal(second.candidate_scores[0].diagnostics.selective_non_clean_reuse_support, true);
  assert.ok(second.candidate_scores[0].diagnostics.positive_bonus_rule_ids.includes('recent_group_reuse_bonus'));
  assert.ok(second.ledger_entry.score_contributions_by_field_or_bucket.some((entry) => entry.detail === 'recent_group_reuse_bonus_from_non_default_exact_support'));
});

test('resolveSegmentAssignment deterministically falls back to create when evidence stays below assign threshold', () => {
  const segment = {
    index: 7,
    traits: buildBaseTraits({
      audibility: 'unknown',
      overlap: 'background_overlap',
      gender_presentation: 'unknown',
      age_impression: 'unknown',
      pitch_band: 'unknown',
      phonation: 'unknown',
      accent_strength: 'unknown',
      accent_family: 'unknown'
    })
  };
  const compiledRuleset = loadCompiledRuleset();
  const decision = resolveSegmentAssignment({
    segment,
    candidateScores: [
      {
        group_id: 'grp_001',
        speaker_id: 'spk_001',
        score: 1.25,
        hard_blocked: false,
        soft_review_blocked: false,
        clean_reuse_gate: false,
        matched_concrete_stable_identity_fields: 0,
        exact_stable_identity_match_count: 0,
        discriminative_stable_identity_exact_match_count: 0,
        stable_identity_mismatch_count: 0,
        previous_occurrence_distance: 3,
        short_contract_safe_reason: ['gating_cues'],
        abstentions_from_unknown_mixed_variable: [
          { field: 'gender_presentation', relation: 'abstain' },
          { field: 'phonation', relation: 'abstain' }
        ],
        blockers_triggered: [],
        blockers_suppressed: [],
        score_contributions_by_field_or_bucket: [],
        diagnostics: {
          default_shared_only_reuse_pressure: false,
          stable_identity_abstention_count: 6,
          discriminative_stable_identity_exact_match_count: 0,
          matched_concrete_stable_identity_fields: 0,
          positive_bonus_rule_ids: [],
          exact_default_shared_match_fields: [],
          non_default_exact_match_fields: [],
          selective_non_clean_reuse_support: false
        }
      }
    ],
    compiledRuleset
  });

  assert.equal(decision.chosen_action, 'create_group');
  assert.equal(decision.chosen_group_id, null);
  assert.ok(decision.abstention_reasons.includes('gender_presentation'));
});

test('runDialogueV3SpeakerGrouping processes segments in order and emits one ledger row per assignment', () => {
  const dialogueData = validateDialogueData(buildDialogueDataFromTraits([
    {},
    {
      affect: 'determined'
    },
    {
      gender_presentation: 'feminine',
      pitch_band: 'high',
      accent_strength: 'clear_non_neutral',
      accent_family: 'anglophone_non_neutral'
    }
  ]));

  const result = runDialogueV3SpeakerGrouping({
    dialogueData,
    compiledRuleset: loadCompiledRuleset(),
    sourceRef: { path: 'output/test-run/dialogue-data.json' },
    rulesetRef: { path: RULESET_PATH },
    runtimeMetadata: { run_id: 'full-run-test' }
  });

  assert.equal(result.steps.length, 3);
  assert.equal(result.artifact.assignments.length, 3);
  assert.equal(result.artifact.decision_ledger.length, 3);
  assert.equal(result.artifact.metadata.cleanup.singleton_merge.executed, false);
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
