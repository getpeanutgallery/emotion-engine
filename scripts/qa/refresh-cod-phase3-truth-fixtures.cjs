#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');

const FIXTURES = [
  {
    key: 'metrics',
    truthPath: path.join(ROOT, 'benchmarks/fixtures/cod-test/truth/metrics.json'),
    outputPath: path.join(ROOT, 'output/cod-test/phase3-report/metrics/metrics.json')
  },
  {
    key: 'emotional-analysis',
    truthPath: path.join(ROOT, 'benchmarks/fixtures/cod-test/truth/emotional-analysis.json'),
    outputPath: path.join(ROOT, 'output/cod-test/phase3-report/emotional-analysis/emotional-data.json')
  },
  {
    key: 'recommendation',
    truthPath: path.join(ROOT, 'benchmarks/fixtures/cod-test/truth/recommendation.json'),
    outputPath: path.join(ROOT, 'output/cod-test/phase3-report/recommendation/recommendation.json')
  }
];

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function stableStringify(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function rel(filePath) {
  return path.relative(ROOT, filePath).replace(/\\/g, '/');
}

function buildTruth(existingTruth, runtimeOutput) {
  const nextTruth = { ...runtimeOutput };
  if (existingTruth && typeof existingTruth === 'object' && existingTruth._benchmark) {
    nextTruth._benchmark = existingTruth._benchmark;
  }
  return nextTruth;
}

function main() {
  const mode = process.argv.includes('--check') ? 'check' : 'write';
  const results = [];
  let hasDiff = false;

  for (const fixture of FIXTURES) {
    const existingTruth = readJson(fixture.truthPath);
    const runtimeOutput = readJson(fixture.outputPath);
    const nextTruth = buildTruth(existingTruth, runtimeOutput);

    const currentText = fs.readFileSync(fixture.truthPath, 'utf8');
    const nextText = stableStringify(nextTruth);
    const changed = currentText !== nextText;
    hasDiff = hasDiff || changed;

    if (mode === 'write' && changed) {
      fs.writeFileSync(fixture.truthPath, nextText);
    }

    results.push({
      key: fixture.key,
      truthPath: rel(fixture.truthPath),
      outputPath: rel(fixture.outputPath),
      changed,
      preservedBenchmarkMetadata: Boolean(existingTruth && existingTruth._benchmark)
    });
  }

  console.log(JSON.stringify({
    ok: mode === 'check' ? !hasDiff : true,
    mode,
    changed: hasDiff,
    fixtures: results
  }, null, 2));

  if (mode === 'check' && hasDiff) {
    process.exitCode = 1;
  }
}

main();
