#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const {
  projectRuntimeAlignedSpeakerGroupingTruth
} = require('../../server/lib/dialogue-v3-speaker-grouping-benchmark.cjs');

const ROOT = path.resolve(__dirname, '..', '..');
const DIALOGUE_TRUTH_PATH = path.join(ROOT, 'benchmarks/fixtures/cod-test/truth/dialogue-data.json');
const RUNTIME_DIALOGUE_V3_PATH = path.join(ROOT, 'output/cod-test/phase1-gather-context/dialogue-v3-source-truth.reconciled.json');
const OUTPUT_PATH = path.join(ROOT, 'benchmarks/fixtures/cod-test/truth/speaker-grouping.reconciled-runtime-aligned.json');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function rel(filePath) {
  return path.relative(ROOT, filePath).replace(/\\/g, '/');
}

function main() {
  const dialogueTruth = readJson(DIALOGUE_TRUTH_PATH);
  const runtimeDialogue = readJson(RUNTIME_DIALOGUE_V3_PATH);

  const alignedTruth = projectRuntimeAlignedSpeakerGroupingTruth(dialogueTruth, runtimeDialogue, {
    sourcePath: rel(DIALOGUE_TRUTH_PATH),
    runtimeDialoguePath: rel(RUNTIME_DIALOGUE_V3_PATH)
  });

  writeJson(OUTPUT_PATH, alignedTruth);

  console.log(JSON.stringify({
    ok: true,
    output_path: rel(OUTPUT_PATH),
    group_count: alignedTruth.summary.group_count,
    assignment_count: alignedTruth.summary.assignment_count,
    unmatched_truth_segment_indexes: alignedTruth.alignment.unmatched_truth_segment_indexes,
    unmatched_runtime_segment_indexes: alignedTruth.alignment.unmatched_runtime_segment_indexes
  }, null, 2));
}

main();
