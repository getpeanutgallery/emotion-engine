#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');
const {
  validateDialogueV3SourceTruthObject
} = require('../../server/lib/dialogue-v3-source-truth-validator.cjs');
const {
  loadDialogueV3HeuristicsRulesetFromFile
} = require('../../server/lib/dialogue-v3-heuristics-ruleset.cjs');
const {
  runDialogueV3SpeakerGrouping
} = require('../../server/lib/dialogue-v3-speaker-grouping.cjs');
const {
  compareSpeakerGroupingTruthProjection
} = require('../../server/lib/dialogue-v3-speaker-grouping-benchmark.cjs');

const ROOT = path.resolve(__dirname, '..', '..');
const CONFIG_PATH = path.join(ROOT, 'configs/cod-test.yaml');
const RULESET_PATH = path.join(ROOT, 'docs/2026-04-16-dialogue-traits-v3-speaker-grouping-heuristics-ruleset.yaml');
const RUNTIME_DIALOGUE_PATH = path.join(ROOT, 'output/cod-test/phase1-gather-context/dialogue-data.reconciled.json');
const RUNTIME_DIALOGUE_V3_PATH = path.join(ROOT, 'output/cod-test/phase1-gather-context/dialogue-v3-source-truth.reconciled.json');
const RUNTIME_RECONCILIATION_LEDGER_PATH = path.join(ROOT, 'output/cod-test/phase1-gather-context/famous-song-reconciliation.json');
const TRUTH_GROUPING_PATH = path.join(ROOT, 'benchmarks/fixtures/cod-test/truth/speaker-grouping.reconciled-runtime-aligned.json');
const LEGACY_TRUTH_GROUPING_PATH = path.join(ROOT, 'benchmarks/fixtures/cod-test/truth/speaker-grouping.json');
const ARTIFACTS_COMPLETE_PATH = path.join(ROOT, 'output/cod-test/artifacts-complete.json');
const GET_DIALOGUE_RESULT_PATH = path.join(ROOT, 'output/cod-test/phase1-gather-context/script-results/get-dialogue.success.json');
const GET_MUSIC_RESULT_PATH = path.join(ROOT, 'output/cod-test/phase1-gather-context/script-results/get-music.success.json');
const GET_MUSIC_VOCALS_RESULT_PATH = path.join(ROOT, 'output/cod-test/phase1-gather-context/script-results/get-music-vocals.success.json');
const WHOLE_VIDEO_RESULT_PATH = path.join(ROOT, 'output/cod-test/phase2-process/script-results/whole-video-mimo.success.json');

const OUTPUT_DIR = path.join(ROOT, 'output/cod-test/phase1-gather-context');
const REPORT_DIR = path.join(ROOT, 'benchmarks/fixtures/cod-test/_reports/artifact-results');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function sha256(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function rel(filePath) {
  return path.relative(ROOT, filePath).replace(/\\/g, '/');
}

function safeGit(command, fallback = null) {
  try {
    return execSync(command, { cwd: ROOT, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
  } catch {
    return fallback;
  }
}

function classifyMismatches(comparator, truthGrouping) {
  const truthAssignments = new Map((truthGrouping.assignments || []).map((a) => [a.segment_index, a]));
  const runtimeAssignments = new Map((comparator.runtime_projection.assignments || []).map((a) => [a.segment_index, a]));
  const runtimeGroups = new Map((comparator.runtime_projection.speaker_groups || []).map((g) => [g.speaker_group_key, g]));
  const truthGroups = new Map((truthGrouping.speaker_groups || []).map((g) => [g.speaker_group_key, g]));

  const categorized = comparator.mismatches.map((mismatch) => {
    const expected = truthAssignments.get(mismatch.segment_index) || null;
    const actual = runtimeAssignments.get(mismatch.segment_index) || null;

    let category = 'grouping_assignment_mismatch';
    let rationale = 'Expected and runtime both assigned this segment index, but the chosen stable group keys differ.';

    if (expected && !actual) {
      category = 'runtime_missing_segment_for_truth_index';
      rationale = 'Truth has a segment at this index but the runtime projection does not; this points to segmentation/boundary drift before grouping.';
    } else if (!expected && actual) {
      category = 'runtime_extra_segment_not_in_truth';
      rationale = 'Runtime produced a segment index not present in golden truth; this points to extraction/segmentation drift before grouping.';
    } else if (expected && actual) {
      const truthGroup = truthGroups.get(expected.speaker_group_key);
      const runtimeGroup = runtimeGroups.get(actual.speaker_group_key);
      if ((truthGroup?.segment_count || 0) > 1 && (runtimeGroup?.segment_count || 0) === 1) {
        category = 'grouping_reuse_miss_after_source_truth_conversion';
        rationale = 'Golden truth expects this line to reuse an earlier speaker group, but runtime grouping left it as a singleton. With the current converted v3 source truth, this is a reuse miss at the grouping layer.';
      }
    }

    return {
      ...mismatch,
      category,
      rationale
    };
  });

  const summaryByCategory = categorized.reduce((acc, item) => {
    acc[item.category] = (acc[item.category] || 0) + 1;
    return acc;
  }, {});

  return { categorized, summaryByCategory };
}

function main() {
  const runtimeDialogue = readJson(RUNTIME_DIALOGUE_PATH);
  const runtimeDialogueV3 = readJson(RUNTIME_DIALOGUE_V3_PATH);
  const truthGrouping = readJson(TRUTH_GROUPING_PATH);
  const rulesetResult = loadDialogueV3HeuristicsRulesetFromFile(RULESET_PATH);
  if (!rulesetResult.ok) {
    throw new Error(`Ruleset failed to load: ${rulesetResult.summary}`);
  }

  const config = fs.readFileSync(CONFIG_PATH, 'utf8');
  const artifactsComplete = readJson(ARTIFACTS_COMPLETE_PATH);
  const getDialogueResult = readJson(GET_DIALOGUE_RESULT_PATH);
  const getMusicResult = readJson(GET_MUSIC_RESULT_PATH);
  const getMusicVocalsResult = readJson(GET_MUSIC_VOCALS_RESULT_PATH);
  const wholeVideoResult = readJson(WHOLE_VIDEO_RESULT_PATH);
  const reconciliationLedger = readJson(RUNTIME_RECONCILIATION_LEDGER_PATH);

  const validation = validateDialogueV3SourceTruthObject(runtimeDialogueV3);
  if (!validation.ok) {
    throw new Error(`Persisted runtime v3 source truth did not validate: ${validation.summary}`);
  }

  const build = {
    git_commit: safeGit('git rev-parse HEAD'),
    git_short: safeGit('git rev-parse --short HEAD'),
    git_branch: safeGit('git branch --show-current'),
    generated_at: new Date().toISOString()
  };

  const sourceTruthArtifactPath = RUNTIME_DIALOGUE_V3_PATH;
  const groupingArtifactPath = path.join(OUTPUT_DIR, 'speaker-grouping.json');
  const decisionLedgerPath = path.join(OUTPUT_DIR, 'speaker-grouping.decision-ledger.json');
  const comparatorPath = path.join(REPORT_DIR, 'speakerGrouping.json');
  const comparatorMissesPath = path.join(REPORT_DIR, 'speakerGrouping.miss-clusters.json');

  const groupingRun = runDialogueV3SpeakerGrouping({
    dialogueData: validation.value,
    compiledRuleset: rulesetResult.value,
    sourceRef: {
      path: rel(sourceTruthArtifactPath),
      derived_from: rel(RUNTIME_DIALOGUE_V3_PATH),
      posture: 'reconciled_phase1_runtime_dialogue_v3_surface'
    },
    rulesetRef: {
      path: rel(RULESET_PATH),
      sha256: sha256(RULESET_PATH)
    },
    runtimeMetadata: {
      build,
      config: {
        path: rel(CONFIG_PATH),
        sha256: crypto.createHash('sha256').update(config).digest('hex')
      },
      model_lineage: {
        phase1_dialogue: getDialogueResult?.payload?.data ? 'openrouter/xiaomi/mimo-v2-omni' : null,
        phase1_music: getMusicResult?.payload?.data ? 'openrouter/xiaomi/mimo-v2-omni' : null,
        phase1_music_vocals: getMusicVocalsResult?.payload?.data ? 'openrouter/xiaomi/mimo-v2-omni' : null,
        phase2_video: wholeVideoResult?.payload?.data?.provider ? `${wholeVideoResult.payload.data.provider.adapter}/${wholeVideoResult.payload.data.provider.model}` : null,
        ai_recovery_lane_configured: 'openrouter/google/gemini-3.1-pro-preview',
        ai_recovery_used: false
      },
      posture: {
        phase1_dialogue_surface_used_for_grouping: 'dialogue-v3-source-truth.reconciled.json',
        raw_dialogue_artifact: rel(path.join(ROOT, 'output/cod-test/phase1-gather-context/dialogue-data.json')),
        reconciled_dialogue_artifact: rel(RUNTIME_DIALOGUE_PATH),
        reconciled_dialogue_v3_artifact: rel(RUNTIME_DIALOGUE_V3_PATH),
        reconciliation_status: reconciliationLedger.status,
        reconciliation_trigger_passed: reconciliationLedger?.trigger?.passed === true
      },
      source_conversion: {
        strategy: 'runtime-native-persisted-v3-dialogue-artifact',
        traits_population: 'native_runtime_emission_from_dialogue_lane',
        removed_runtime_only_fields: []
      },
      artifacts_complete_path: rel(ARTIFACTS_COMPLETE_PATH)
    }
  });

  const comparator = compareSpeakerGroupingTruthProjection({
    truthProjection: truthGrouping,
    runtimeArtifact: groupingRun.artifact
  });

  const classified = classifyMismatches(comparator, truthGrouping);
  const evidence = {
    run: {
      config_name: getDialogueResult.run.configName,
      output_dir: rel(OUTPUT_DIR),
      started_at: getDialogueResult.run.startedAt,
      completed_at: wholeVideoResult.run.completedAt
    },
    identifiers: {
      build,
      config: {
        path: rel(CONFIG_PATH),
        sha256: sha256(CONFIG_PATH)
      },
      ruleset: {
        id: rulesetResult.value?.ruleset?.id || null,
        version: rulesetResult.value?.ruleset?.version || null,
        path: rel(RULESET_PATH),
        sha256: sha256(RULESET_PATH)
      },
      models: {
        phase1_dialogue: 'openrouter/xiaomi/mimo-v2-omni',
        phase1_music: 'openrouter/xiaomi/mimo-v2-omni',
        phase1_music_vocals: 'openrouter/xiaomi/mimo-v2-omni',
        phase2_video: wholeVideoResult?.payload?.data?.provider ? `${wholeVideoResult.payload.data.provider.adapter}/${wholeVideoResult.payload.data.provider.model}` : null,
        recovery_configured: 'openrouter/google/gemini-3.1-pro-preview',
        recovery_used: false
      }
    },
    posture: {
      raw_dialogue_path: rel(path.join(ROOT, 'output/cod-test/phase1-gather-context/dialogue-data.json')),
      reconciled_dialogue_path: rel(RUNTIME_DIALOGUE_PATH),
      reconciled_dialogue_v3_path: rel(RUNTIME_DIALOGUE_V3_PATH),
      grouping_input_surface: rel(RUNTIME_DIALOGUE_V3_PATH),
      reconciliation_ledger_path: rel(RUNTIME_RECONCILIATION_LEDGER_PATH),
      reconciliation_status: reconciliationLedger.status,
      reconciliation_skip_reasons: reconciliationLedger?.trigger?.reasons || [],
      interpretation_note: 'Grouping comparator refresh was driven from the reconciled persisted runtime dialogue-v3 surface projected against the active traits-only gold dialogue truth. The reconciliation ledger still documents the upstream raw-vs-reconciled dialogue posture; in this run it was skipped, so the raw and reconciled dialogue contents were effectively the same before v3 projection.'
    },
    artifacts: {
      source_truth_v3: rel(sourceTruthArtifactPath),
      runtime_grouping: rel(groupingArtifactPath),
      decision_ledger: rel(decisionLedgerPath),
      comparator: rel(comparatorPath),
      comparator_miss_clusters: rel(comparatorMissesPath),
      truth_grouping: rel(TRUTH_GROUPING_PATH),
      legacy_truth_grouping: rel(LEGACY_TRUTH_GROUPING_PATH)
    },
    counts: {
      runtime_segment_count: validation.value.dialogue_segments.length,
      runtime_group_count: groupingRun.artifact.speaker_groups.length,
      runtime_assignment_count: groupingRun.artifact.assignments.length,
      truth_group_count: truthGrouping.summary.group_count,
      truth_assignment_count: truthGrouping.summary.assignment_count,
      comparator_mismatch_count: comparator.mismatch_count
    },
    miss_clusters: classified.summaryByCategory
  };

  if (!fs.existsSync(sourceTruthArtifactPath) || sha256(sourceTruthArtifactPath) !== crypto.createHash('sha256').update(JSON.stringify(validation.value, null, 2) + '\n').digest('hex')) {
    writeJson(sourceTruthArtifactPath, validation.value);
  }
  writeJson(groupingArtifactPath, groupingRun.artifact);
  writeJson(decisionLedgerPath, groupingRun.artifact.decision_ledger);
  writeJson(comparatorPath, {
    ok: comparator.ok,
    truth_group_count: comparator.truth_group_count,
    runtime_group_count: comparator.runtime_group_count,
    truth_assignment_count: comparator.truth_assignment_count,
    runtime_assignment_count: comparator.runtime_assignment_count,
    mismatch_count: comparator.mismatch_count,
    mismatch_categories: classified.summaryByCategory,
    mismatches: classified.categorized,
    runtime_projection: comparator.runtime_projection,
    evidence
  });
  writeJson(comparatorMissesPath, {
    mismatch_count: comparator.mismatch_count,
    summary_by_category: classified.summaryByCategory,
    mismatches: classified.categorized
  });

  console.log(JSON.stringify({
    ok: true,
    artifacts: evidence.artifacts,
    counts: evidence.counts,
    miss_clusters: evidence.miss_clusters
  }, null, 2));
}

main();
