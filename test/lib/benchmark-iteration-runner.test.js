const assert = require('assert');
const fs = require('fs');
const path = require('path');
const test = require('node:test');
const {
  loadLaneState,
  createAttemptScaffold,
  runLane
} = require('../../server/lib/benchmark-iteration-runner.cjs');

const repoRoot = path.resolve(__dirname, '..', '..');
const lanePath = 'benchmarks/iterations/lanes/dialogue-gold-optimization.json';

test('benchmark iteration runner - loads lane metadata and baseline context', async () => {
  const state = await loadLaneState(lanePath, {
    repoRoot,
    sessionId: '2026-03-30-task-2-contract-bootstrap'
  });

  assert.strictEqual(state.lane.laneId, 'dialogue-gold-optimization');
  assert.strictEqual(state.session.maxScoredAttemptsPerSession, 5);
  assert.strictEqual(state.session.attemptCount, 0);
  assert.strictEqual(state.nextAttemptNumber, 3);
  assert.strictEqual(state.baseline.status, 'error');
  assert(state.baseline.references.every((ref) => ref.exists), 'baseline references should resolve');
});

test('benchmark iteration runner - creates an attempt scaffold with lane commands', async () => {
  const state = await loadLaneState(lanePath, {
    repoRoot,
    sessionId: 'test-session-1'
  });

  const scaffold = createAttemptScaffold(state, {
    sessionId: 'test-session-1',
    proposal: 'Tighten generic speaker continuity handling.'
  });

  assert.strictEqual(scaffold.attemptNumber, state.nextAttemptNumber);
  assert.strictEqual(scaffold.sessionId, 'test-session-1');
  assert.strictEqual(scaffold.proposal, 'Tighten generic speaker continuity handling.');
  assert(scaffold.commands.some((command) => command.includes('benchmark-iteration-runner.cjs run')));
  assert.strictEqual(scaffold.result.benchmarkSummaryJsonPath, 'benchmarks/fixtures/cod-test/dialogue-only/_reports/benchmark-summary.json');
});

test('benchmark iteration runner - can dry-run the configured narrow loop without mutating ledger state', async (t) => {
  const state = await loadLaneState(lanePath, {
    repoRoot,
    sessionId: 'test-session-dry-run'
  });

  const logFile = path.join(repoRoot, '.logs', 'test-benchmark-iteration-runner-dry-run.log');
  t.after(() => fs.rmSync(logFile, { force: true }));

  const result = runLane(state, {
    dryRun: true,
    verbose: true,
    captureOutput: true,
    logFile
  });

  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.exitCode, 0);
  assert(fs.existsSync(logFile), 'dry-run log should be written when captureOutput + logFile are set');
  assert.match(result.stdout, /Dry run mode/);
});
