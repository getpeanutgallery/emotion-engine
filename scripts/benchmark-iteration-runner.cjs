#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const {
  loadLaneState,
  createAttemptScaffold,
  formatRate,
  runLane
} = require('../server/lib/benchmark-iteration-runner.cjs');

function printHelp() {
  console.log(`Benchmark iteration runner

Usage:
  node scripts/benchmark-iteration-runner.cjs inspect --lane <lane.json> [--session-id <id>] [--json]
  node scripts/benchmark-iteration-runner.cjs scaffold --lane <lane.json> [--session-id <id>] [--proposal "..."] [--json] [--write <file>]
  node scripts/benchmark-iteration-runner.cjs run --lane <lane.json> [--session-id <id>] [--dry-run] [--verbose] [--capture-output] [--log-file <file>] [--json]

Commands:
  inspect    Load the lane + ledger, validate key paths, and show baseline/attempt context.
  scaffold   Emit a starter attempt record using the lane contract fields.
  run        Execute the lane's configured narrow pipeline benchmark path.
`);
}

function parseArgs(argv) {
  const args = {
    command: null,
    lane: null,
    sessionId: null,
    proposal: '',
    dryRun: false,
    verbose: false,
    json: false,
    write: null,
    captureOutput: false,
    logFile: null,
    repoRoot: process.cwd()
  };

  const positional = [];
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) {
      positional.push(token);
      continue;
    }

    switch (token) {
      case '--lane':
        args.lane = argv[++i];
        break;
      case '--session-id':
        args.sessionId = argv[++i];
        break;
      case '--proposal':
        args.proposal = argv[++i] || '';
        break;
      case '--dry-run':
        args.dryRun = true;
        break;
      case '--verbose':
        args.verbose = true;
        break;
      case '--json':
        args.json = true;
        break;
      case '--write':
        args.write = argv[++i];
        break;
      case '--capture-output':
        args.captureOutput = true;
        break;
      case '--log-file':
        args.logFile = argv[++i];
        break;
      case '--repo-root':
        args.repoRoot = argv[++i];
        break;
      case '--help':
      case '-h':
        args.help = true;
        break;
      default:
        throw new Error(`Unknown argument: ${token}`);
    }
  }

  args.command = positional[0] || 'inspect';
  return args;
}

function printInspect(state) {
  console.log(`Lane: ${state.lane.displayName} (${state.lane.laneId})`);
  console.log(`Status: ${state.lane.status || 'unknown'}`);
  console.log(`Goal: ${state.lane.goal || 'n/a'}`);
  console.log('');
  console.log('Paths:');
  console.log(`- Lane: ${path.relative(state.repoRoot, state.lanePath)}`);
  console.log(`- Ledger: ${path.relative(state.repoRoot, state.ledgerPath)}`);
  console.log(`- Narrow config: ${path.relative(state.repoRoot, state.configPath)}`);
  console.log(`- Benchmark manifest: ${path.relative(state.repoRoot, state.manifestPath)}`);
  console.log(`- Output dir: ${path.relative(state.repoRoot, state.outputDir)}`);
  console.log(`- Benchmark summary: ${path.relative(state.repoRoot, state.benchmarkSummaryPath)}`);
  console.log('');
  console.log('Targets and limits:');
  console.log(`- Artifact key: ${state.lane?.artifact?.key || 'n/a'}`);
  console.log(`- Fixture: ${state.lane?.fixture?.id || 'n/a'}`);
  console.log(`- Target accuracy: ${formatRate(state.lane?.targets?.accuracyRate)}`);
  console.log(`- Target benchmark status: ${state.lane?.targets?.benchmarkStatus || 'n/a'}`);
  console.log(`- Max scored attempts per session: ${state.session.maxScoredAttemptsPerSession ?? 'n/a'}`);
  if (state.session.sessionId) {
    console.log(`- Session ${state.session.sessionId}: ${state.session.attemptCount} recorded attempt(s), ${state.session.remainingAttempts} remaining`);
  }
  console.log(`- Next attempt number: ${state.nextAttemptNumber}`);
  console.log('');
  console.log('Baseline:');
  console.log(`- Baseline id: ${state.baseline.baselineId || 'n/a'}`);
  console.log(`- Established: ${state.baseline.establishedAt || 'n/a'}`);
  console.log(`- Status: ${state.baseline.status || 'n/a'}`);
  console.log(`- Accuracy: ${formatRate(state.baseline.accuracyRate)}`);
  console.log(`- Coverage: ${formatRate(state.baseline.coverageRate)}`);
  console.log(`- Mismatch buckets: ${state.baseline.mismatchBuckets.length}`);
  if (state.baseline.mismatchBuckets.length > 0) {
    state.baseline.mismatchBuckets.slice(0, 5).forEach((bucket) => {
      const summary = [bucket.kind, bucket.pathPrefix, bucket.count].filter((value) => value !== undefined && value !== null).join(' | ');
      console.log(`  - ${summary}`);
    });
    if (state.baseline.mismatchBuckets.length > 5) {
      console.log(`  - ... ${state.baseline.mismatchBuckets.length - 5} more`);
    }
  }
  console.log('');
  console.log('Baseline references:');
  state.baseline.references.forEach((ref) => {
    console.log(`- [${ref.exists ? 'ok' : 'missing'}] ${ref.key}: ${ref.path}`);
  });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }

  if (!args.lane) {
    throw new Error('Missing required --lane <lane.json>');
  }

  const state = await loadLaneState(args.lane, {
    repoRoot: args.repoRoot,
    sessionId: args.sessionId
  });

  if (args.command === 'inspect') {
    if (args.json) {
      console.log(JSON.stringify(state, null, 2));
      return;
    }
    printInspect(state);
    return;
  }

  if (args.command === 'scaffold') {
    const scaffold = createAttemptScaffold(state, {
      sessionId: args.sessionId,
      proposal: args.proposal
    });
    const rendered = `${JSON.stringify(scaffold, null, 2)}\n`;
    if (args.write) {
      const targetPath = path.resolve(state.repoRoot, args.write);
      fs.mkdirSync(path.dirname(targetPath), { recursive: true });
      fs.writeFileSync(targetPath, rendered, 'utf8');
    }
    process.stdout.write(rendered);
    return;
  }

  if (args.command === 'run') {
    const logFile = args.logFile ? path.resolve(state.repoRoot, args.logFile) : null;
    const result = runLane(state, {
      dryRun: args.dryRun,
      verbose: args.verbose,
      captureOutput: args.captureOutput,
      logFile
    });

    if (args.json) {
      console.log(JSON.stringify(result, null, 2));
      return;
    }

    console.log(`Command: ${result.command}`);
    console.log(`Exit: ${result.exitCode}`);
    if (result.logFile) {
      console.log(`Log file: ${result.logFile}`);
    }
    if (result.summary) {
      console.log(`Benchmark status: ${result.summary.status}`);
      console.log(`Accuracy: ${formatRate(result.summary.accuracyRate)}`);
      console.log(`Coverage: ${formatRate(result.summary.coverageRate)}`);
      if (typeof result.deltaVsBaseline?.accuracyRate === 'number') {
        const delta = result.deltaVsBaseline.accuracyRate;
        console.log(`Delta vs baseline accuracy: ${delta >= 0 ? '+' : ''}${(delta * 100).toFixed(2)} pts`);
      }
      if (typeof result.deltaVsBaseline?.coverageRate === 'number') {
        const delta = result.deltaVsBaseline.coverageRate;
        console.log(`Delta vs baseline coverage: ${delta >= 0 ? '+' : ''}${(delta * 100).toFixed(2)} pts`);
      }
      console.log(`Summary JSON: ${result.summary.path}`);
    }

    if (!result.ok) {
      process.exitCode = result.exitCode || 1;
    }
    return;
  }

  throw new Error(`Unsupported command: ${args.command}`);
}

main().catch((error) => {
  console.error(`benchmark-iteration-runner failed: ${error.message}`);
  process.exitCode = 1;
});
