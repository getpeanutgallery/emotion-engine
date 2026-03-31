const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { loadConfig, validateConfig } = require('./config-loader.cjs');
const { resolveBenchmarkConfig } = require('./benchmark-runner.cjs');

const LANE_CONTRACT_VERSION = 'ee.benchmark-iteration-lane/v1';
const LEDGER_CONTRACT_VERSION = 'ee.benchmark-iteration-ledger/v1';

function readJsonFile(filePath, label) {
  let raw;
  try {
    raw = fs.readFileSync(filePath, 'utf8');
  } catch (error) {
    throw new Error(`Failed to read ${label}: ${filePath} (${error.message})`);
  }

  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new Error(`Failed to parse ${label} as JSON: ${filePath} (${error.message})`);
  }
}

function normalizeRepoPath(filePath, repoRoot) {
  return path.relative(repoRoot, filePath).split(path.sep).join('/');
}

function ensureFile(filePath, label) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`${label} not found: ${filePath}`);
  }
  const stat = fs.statSync(filePath);
  if (!stat.isFile()) {
    throw new Error(`${label} is not a file: ${filePath}`);
  }
}

function validateLaneShape(lane, lanePath) {
  if (!lane || typeof lane !== 'object' || Array.isArray(lane)) {
    throw new Error(`Lane config must be an object: ${lanePath}`);
  }

  if (lane.contractVersion !== LANE_CONTRACT_VERSION) {
    throw new Error(`Unsupported lane contractVersion in ${lanePath}: expected ${LANE_CONTRACT_VERSION}`);
  }

  if (typeof lane.laneId !== 'string' || lane.laneId.trim().length === 0) {
    throw new Error(`laneId must be a non-empty string: ${lanePath}`);
  }

  if (typeof lane.displayName !== 'string' || lane.displayName.trim().length === 0) {
    throw new Error(`displayName must be a non-empty string: ${lanePath}`);
  }

  if (typeof lane.scope?.narrowConfigPath !== 'string' || lane.scope.narrowConfigPath.trim().length === 0) {
    throw new Error(`scope.narrowConfigPath must be a non-empty string: ${lanePath}`);
  }

  if (typeof lane.scope?.benchmarkManifestPath !== 'string' || lane.scope.benchmarkManifestPath.trim().length === 0) {
    throw new Error(`scope.benchmarkManifestPath must be a non-empty string: ${lanePath}`);
  }

  if (typeof lane.scope?.ledgerPath !== 'string' || lane.scope.ledgerPath.trim().length === 0) {
    throw new Error(`scope.ledgerPath must be a non-empty string: ${lanePath}`);
  }
}

function validateLedgerShape(ledger, ledgerPath, lane) {
  if (!ledger || typeof ledger !== 'object' || Array.isArray(ledger)) {
    throw new Error(`Lane ledger must be an object: ${ledgerPath}`);
  }

  if (ledger.contractVersion !== LEDGER_CONTRACT_VERSION) {
    throw new Error(`Unsupported lane ledger contractVersion in ${ledgerPath}: expected ${LEDGER_CONTRACT_VERSION}`);
  }

  if (ledger.laneId !== lane.laneId) {
    throw new Error(`Lane/ledger laneId mismatch: ${lane.laneId} != ${ledger.laneId}`);
  }

  if (!ledger.activeBaseline || typeof ledger.activeBaseline !== 'object' || Array.isArray(ledger.activeBaseline)) {
    throw new Error(`Ledger activeBaseline must be an object: ${ledgerPath}`);
  }
}

function summarizeSessionAttempts(ledger, sessionId) {
  const attempts = Array.isArray(ledger?.history?.attempts) ? ledger.history.attempts : [];
  const matchedAttempts = sessionId
    ? attempts.filter((attempt) => attempt && attempt.sessionId === sessionId)
    : [];

  return {
    sessionId: sessionId || null,
    attemptCount: matchedAttempts.length,
    attempts: matchedAttempts
  };
}

async function loadLaneState(lanePath, options = {}) {
  const repoRoot = path.resolve(options.repoRoot || process.cwd());
  const absoluteLanePath = path.resolve(repoRoot, lanePath);
  ensureFile(absoluteLanePath, 'Lane config');

  const lane = readJsonFile(absoluteLanePath, 'lane config');
  validateLaneShape(lane, absoluteLanePath);

  const absoluteLedgerPath = path.resolve(repoRoot, lane.scope.ledgerPath);
  const absoluteConfigPath = path.resolve(repoRoot, lane.scope.narrowConfigPath);
  const absoluteManifestPath = path.resolve(repoRoot, lane.scope.benchmarkManifestPath);

  ensureFile(absoluteLedgerPath, 'Lane ledger');
  ensureFile(absoluteConfigPath, 'Lane narrow config');
  ensureFile(absoluteManifestPath, 'Lane benchmark manifest');

  const ledger = readJsonFile(absoluteLedgerPath, 'lane ledger');
  validateLedgerShape(ledger, absoluteLedgerPath, lane);

  const config = await loadConfig(absoluteConfigPath);
  const configValidation = validateConfig(config, { configPath: absoluteConfigPath });
  if (!configValidation.valid) {
    throw new Error(`Lane config references an invalid pipeline config: ${configValidation.errors.join('; ')}`);
  }

  const resolvedBenchmark = resolveBenchmarkConfig(config, { configPath: absoluteConfigPath });
  if (!resolvedBenchmark.enabled) {
    throw new Error(`Lane pipeline config does not enable benchmark execution: ${absoluteConfigPath}`);
  }

  if (path.resolve(resolvedBenchmark.absolutePath) !== absoluteManifestPath) {
    throw new Error([
      'Lane benchmark manifest mismatch:',
      `lane scope benchmarkManifestPath => ${absoluteManifestPath}`,
      `pipeline benchmark.path => ${resolvedBenchmark.absolutePath}`
    ].join('\n'));
  }

  const manifest = readJsonFile(absoluteManifestPath, 'benchmark manifest');
  const summaryPath = path.join(path.dirname(absoluteManifestPath), manifest.reports.outputDir, 'benchmark-summary.json');
  const summaryExists = fs.existsSync(summaryPath);
  const latestSummary = summaryExists ? readJsonFile(summaryPath, 'benchmark summary') : null;
  const outputDir = path.resolve(repoRoot, config.asset.outputDir);
  const sessionSummary = summarizeSessionAttempts(ledger, options.sessionId);
  const maxScoredAttemptsPerSession = Number.isInteger(lane?.sessionPolicy?.maxScoredAttemptsPerSession)
    ? lane.sessionPolicy.maxScoredAttemptsPerSession
    : Number.isInteger(ledger?.targets?.maxScoredAttemptsPerSession)
      ? ledger.targets.maxScoredAttemptsPerSession
      : null;
  const remainingAttempts = maxScoredAttemptsPerSession === null
    ? null
    : Math.max(0, maxScoredAttemptsPerSession - sessionSummary.attemptCount);

  const baseline = ledger.activeBaseline || {};
  const baselineReferences = baseline.references || {};
  const baselineReferenceChecks = Object.entries(baselineReferences).map(([key, relativePath]) => {
    const absolutePath = path.resolve(repoRoot, relativePath);
    return {
      key,
      path: relativePath,
      exists: fs.existsSync(absolutePath)
    };
  });

  return {
    repoRoot,
    lanePath: absoluteLanePath,
    ledgerPath: absoluteLedgerPath,
    configPath: absoluteConfigPath,
    manifestPath: absoluteManifestPath,
    outputDir,
    benchmarkSummaryPath: summaryPath,
    lane,
    ledger,
    config,
    manifest,
    latestSummary,
    nextAttemptNumber: Number.isInteger(ledger.nextAttemptNumber)
      ? ledger.nextAttemptNumber
      : (Array.isArray(ledger?.history?.attempts) ? ledger.history.attempts.length + 1 : 1),
    session: {
      ...sessionSummary,
      maxScoredAttemptsPerSession,
      remainingAttempts
    },
    baseline: {
      baselineId: baseline.baselineId || null,
      establishedAt: baseline.establishedAt || null,
      status: baseline?.result?.status || null,
      accuracyRate: baseline?.result?.accuracy?.rate ?? null,
      coverageRate: baseline?.result?.coverage?.rate ?? null,
      mismatchBuckets: Array.isArray(baseline.knownMismatchBuckets) ? baseline.knownMismatchBuckets : [],
      references: baselineReferenceChecks
    }
  };
}

function formatRate(value) {
  if (typeof value !== 'number' || Number.isNaN(value)) return 'n/a';
  return `${(value * 100).toFixed(2)}%`;
}

function createAttemptScaffold(state, options = {}) {
  const sessionId = options.sessionId || null;
  const proposal = options.proposal || '';
  return {
    laneId: state.lane.laneId,
    displayName: state.lane.displayName,
    attemptNumber: state.nextAttemptNumber,
    sessionId,
    proposal,
    challengeReview: {
      benchmarkEvidence: '',
      genericityCheck: '',
      regressionRisk: '',
      scopeCheck: '',
      successSignal: ''
    },
    decision: 'pending',
    filesTouched: [],
    commands: [
      `node scripts/benchmark-iteration-runner.cjs inspect --lane ${normalizeRepoPath(state.lanePath, state.repoRoot)}${sessionId ? ` --session-id ${sessionId}` : ''}`,
      `node scripts/benchmark-iteration-runner.cjs run --lane ${normalizeRepoPath(state.lanePath, state.repoRoot)}${sessionId ? ` --session-id ${sessionId}` : ''} --verbose`
    ],
    result: {
      status: null,
      accuracyRate: null,
      coverageRate: null,
      benchmarkSummaryJsonPath: normalizeRepoPath(state.benchmarkSummaryPath, state.repoRoot)
    },
    deltaVsBaseline: {
      accuracyRate: null,
      coverageRate: null,
      statusChanged: null
    },
    tradeoffs: '',
    baselineDecision: '',
    nextHypothesis: ''
  };
}

function runLane(state, options = {}) {
  if (state.session.maxScoredAttemptsPerSession !== null && state.session.remainingAttempts === 0) {
    throw new Error(`Session cap reached for ${state.session.sessionId || 'current session'}: ${state.session.maxScoredAttemptsPerSession} scored attempts already recorded.`);
  }

  const commandArgs = ['server/run-pipeline.cjs', '--config', state.configPath];
  if (options.verbose) commandArgs.push('--verbose');
  if (options.dryRun) commandArgs.push('--dry-run');

  const child = spawnSync(process.execPath, commandArgs, {
    cwd: state.repoRoot,
    encoding: 'utf8',
    stdio: options.captureOutput ? 'pipe' : 'inherit',
    env: process.env,
    maxBuffer: 10 * 1024 * 1024
  });

  if (options.captureOutput && options.logFile) {
    fs.mkdirSync(path.dirname(options.logFile), { recursive: true });
    const combined = [child.stdout || '', child.stderr || ''].filter(Boolean).join('');
    fs.writeFileSync(options.logFile, combined, 'utf8');
  }

  const result = {
    ok: child.status === 0,
    exitCode: child.status,
    signal: child.signal,
    command: [process.execPath, ...commandArgs].join(' '),
    logFile: options.logFile ? normalizeRepoPath(options.logFile, state.repoRoot) : null,
    stdout: options.captureOutput ? child.stdout : null,
    stderr: options.captureOutput ? child.stderr : null
  };

  if (!options.dryRun && fs.existsSync(state.benchmarkSummaryPath)) {
    const summary = readJsonFile(state.benchmarkSummaryPath, 'benchmark summary');
    result.summary = {
      path: normalizeRepoPath(state.benchmarkSummaryPath, state.repoRoot),
      status: summary.status,
      accuracyRate: summary?.accuracy?.rate ?? null,
      coverageRate: summary?.coverage?.rate ?? null,
      artifacts: summary.artifacts || []
    };
    result.deltaVsBaseline = {
      accuracyRate: typeof result.summary.accuracyRate === 'number' && typeof state.baseline.accuracyRate === 'number'
        ? result.summary.accuracyRate - state.baseline.accuracyRate
        : null,
      coverageRate: typeof result.summary.coverageRate === 'number' && typeof state.baseline.coverageRate === 'number'
        ? result.summary.coverageRate - state.baseline.coverageRate
        : null,
      statusChanged: result.summary.status && state.baseline.status
        ? result.summary.status !== state.baseline.status
        : null
    };
  }

  return result;
}

module.exports = {
  LANE_CONTRACT_VERSION,
  LEDGER_CONTRACT_VERSION,
  loadLaneState,
  createAttemptScaffold,
  formatRate,
  runLane
};
