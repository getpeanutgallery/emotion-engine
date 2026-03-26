const fs = require('fs');
const path = require('path');

const MANIFEST_CONTRACT_VERSION = 'ee.benchmark-manifest/v1';
const FIXTURE_CONTRACT_VERSION = 'ee.benchmark-fixture/v1';
const REPORT_CONTRACT_VERSION = 'ee.benchmark-report/v1';
const DEFAULT_UNKNOWN_SENTINELS = ['unknown', 'ambiguous'];
const DEFAULT_TIMING_TOLERANCE_SECONDS = 2;
const DEFAULT_NUMERIC_TOLERANCE = 0.1;
const DEFAULT_TEMPORAL_FIELD_NAMES = new Set(['start', 'end', 'startTime', 'endTime', 'duration', 'totalDuration', 'videoDuration']);
const DEFAULT_TOLERANT_NUMBER_FIELD_NAMES = new Set(['confidence']);
const DEFAULT_FUZZY_STRING_FIELD_NAMES = new Set(['text', 'summary', 'description', 'reasoning', 'cleanedTranscript', 'handoffContext', 'label', 'note', 'keyFindings', 'suggestions']);

function resolveBenchmarkConfig(config, options = {}) {
  const benchmark = config?.benchmark;
  const configPath = options.configPath ? path.resolve(options.configPath) : null;
  const configDir = configPath ? path.dirname(configPath) : process.cwd();

  if (benchmark === undefined) {
    return {
      enabled: false,
      reason: 'absent',
      path: null,
      absolutePath: null,
      configDir
    };
  }

  if (typeof benchmark !== 'object' || benchmark === null || Array.isArray(benchmark)) {
    throw new Error('"benchmark" must be an object when provided');
  }

  if (typeof benchmark.enabled !== 'boolean') {
    throw new Error('"benchmark.enabled" must be a boolean when benchmark is provided');
  }

  if (benchmark.path !== undefined && (typeof benchmark.path !== 'string' || benchmark.path.trim().length === 0)) {
    throw new Error('"benchmark.path" must be a non-empty string when provided');
  }

  if (!benchmark.enabled) {
    return {
      enabled: false,
      reason: 'disabled',
      path: benchmark.path || null,
      absolutePath: benchmark.path ? path.resolve(configDir, benchmark.path) : null,
      configDir
    };
  }

  if (!benchmark.path) {
    throw new Error('"benchmark.path" is required when benchmark.enabled is true');
  }

  const absolutePath = path.resolve(configDir, benchmark.path);

  if (path.basename(absolutePath) !== 'benchmark.json') {
    throw new Error(`benchmark.path must point to benchmark.json: ${benchmark.path}`);
  }

  if (!fs.existsSync(absolutePath)) {
    throw new Error(`Benchmark manifest not found: ${absolutePath}`);
  }

  const stat = fs.statSync(absolutePath);
  if (!stat.isFile()) {
    throw new Error(`Benchmark manifest is not a file: ${absolutePath}`);
  }

  return {
    enabled: true,
    reason: 'enabled',
    path: benchmark.path,
    absolutePath,
    configDir
  };
}

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

function validateManifest(manifest, manifestPath) {
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) {
    throw new Error(`Benchmark manifest must be an object: ${manifestPath}`);
  }

  if (manifest.contractVersion !== MANIFEST_CONTRACT_VERSION) {
    throw new Error(`Unsupported benchmark manifest contractVersion in ${manifestPath}: expected ${MANIFEST_CONTRACT_VERSION}`);
  }

  if (typeof manifest.fixtureId !== 'string' || manifest.fixtureId.trim().length === 0) {
    throw new Error(`Benchmark manifest fixtureId must be a non-empty string: ${manifestPath}`);
  }

  if (typeof manifest.fixture?.path !== 'string' || manifest.fixture.path.trim().length === 0) {
    throw new Error(`Benchmark manifest fixture.path must be a non-empty string: ${manifestPath}`);
  }

  if (typeof manifest.reports?.outputDir !== 'string' || manifest.reports.outputDir.trim().length === 0) {
    throw new Error(`Benchmark manifest reports.outputDir must be a non-empty string: ${manifestPath}`);
  }

  if (!Array.isArray(manifest.artifacts) || manifest.artifacts.length === 0) {
    throw new Error(`Benchmark manifest artifacts must be a non-empty array: ${manifestPath}`);
  }

  manifest.artifacts.forEach((artifact, index) => {
    const prefix = `Benchmark manifest artifacts[${index}]`;
    if (!artifact || typeof artifact !== 'object' || Array.isArray(artifact)) {
      throw new Error(`${prefix} must be an object`);
    }
    const requiredStringFields = ['artifactKey', 'phase', 'script'];
    for (const field of requiredStringFields) {
      if (typeof artifact[field] !== 'string' || artifact[field].trim().length === 0) {
        throw new Error(`${prefix}.${field} must be a non-empty string`);
      }
    }
    if (typeof artifact.output?.path !== 'string' || artifact.output.path.trim().length === 0) {
      throw new Error(`${prefix}.output.path must be a non-empty string`);
    }
    if (typeof artifact.truth?.path !== 'string' || artifact.truth.path.trim().length === 0) {
      throw new Error(`${prefix}.truth.path must be a non-empty string`);
    }
    if (typeof artifact.comparator?.kind !== 'string' || artifact.comparator.kind.trim().length === 0) {
      throw new Error(`${prefix}.comparator.kind must be a non-empty string`);
    }
    if (typeof artifact.comparator?.profile !== 'string' || artifact.comparator.profile.trim().length === 0) {
      throw new Error(`${prefix}.comparator.profile must be a non-empty string`);
    }
    if (artifact.comparator.options !== undefined && (typeof artifact.comparator.options !== 'object' || artifact.comparator.options === null || Array.isArray(artifact.comparator.options))) {
      throw new Error(`${prefix}.comparator.options must be an object when provided`);
    }
    if (typeof artifact.required !== 'boolean') {
      throw new Error(`${prefix}.required must be a boolean`);
    }
  });
}

function validateFixture(fixture, fixturePath, manifest) {
  if (!fixture || typeof fixture !== 'object' || Array.isArray(fixture)) {
    throw new Error(`Benchmark fixture must be an object: ${fixturePath}`);
  }

  if (fixture.contractVersion !== FIXTURE_CONTRACT_VERSION) {
    throw new Error(`Unsupported benchmark fixture contractVersion in ${fixturePath}: expected ${FIXTURE_CONTRACT_VERSION}`);
  }

  if (fixture.fixtureId !== manifest.fixtureId) {
    throw new Error(`fixtureId mismatch between manifest and fixture: ${manifest.fixtureId} != ${fixture.fixtureId}`);
  }

  if (typeof fixture.asset?.repoPath !== 'string' || fixture.asset.repoPath.trim().length === 0) {
    throw new Error(`Benchmark fixture asset.repoPath must be a non-empty string: ${fixturePath}`);
  }

  if (typeof fixture.config?.repoPath !== 'string' || fixture.config.repoPath.trim().length === 0) {
    throw new Error(`Benchmark fixture config.repoPath must be a non-empty string: ${fixturePath}`);
  }

  if (typeof fixture.benchmark?.entryPath !== 'string' || fixture.benchmark.entryPath.trim().length === 0) {
    throw new Error(`Benchmark fixture benchmark.entryPath must be a non-empty string: ${fixturePath}`);
  }
}

function ensureParentDir(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function normalizeWhitespace(value) {
  return value.trim().replace(/\s+/g, ' ');
}

function normalizeFuzzyString(value) {
  return normalizeWhitespace(
    value
      .normalize('NFKC')
      .replace(/[’‘]/g, "'")
      .replace(/[“”]/g, '"')
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]+/gu, ' ')
  );
}

function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function normalizeComparablePath(pathString) {
  return pathString.replace(/^\$\.?/, '');
}

function wildcardComparablePath(pathString) {
  return normalizeComparablePath(pathString).replace(/\[[^\]]+\]/g, '[*]');
}

function getLastPathSegment(pathString) {
  const comparablePath = normalizeComparablePath(pathString);
  const withoutTrailingIndex = comparablePath.replace(/\[\d+\]$/, '');
  const propertyMatch = withoutTrailingIndex.match(/(?:^|\.)([A-Za-z0-9_]+)$/);
  if (propertyMatch) return propertyMatch[1];

  const indexMatch = comparablePath.match(/\[\d+\]$/);
  if (indexMatch) return indexMatch[0];

  return comparablePath;
}

function isIgnoredPath(pathString, ignorePaths = []) {
  const comparablePath = normalizeComparablePath(pathString);
  const wildcardPath = wildcardComparablePath(pathString);
  return ignorePaths.some((candidate) => {
    const normalizedCandidate = normalizeComparablePath(candidate);
    return normalizedCandidate === comparablePath || normalizedCandidate === wildcardPath;
  });
}

function getArrayAlignmentKey(pathString, comparator, item) {
  if (!isPlainObject(item)) return null;

  const comparablePath = normalizeComparablePath(pathString);
  if (comparator.profile === 'chunk-analysis-default' && comparablePath === 'chunks') {
    if (!Number.isInteger(item.chunkIndex)) {
      return null;
    }
    const splitIndex = Number.isInteger(item.splitIndex) ? item.splitIndex : 0;
    return `chunkIndex=${item.chunkIndex},splitIndex=${splitIndex}`;
  }

  if (comparator.profile === 'emotional-analysis-default') {
    if (comparablePath === 'chunkAnalysis') {
      if (!Number.isInteger(item.chunkIndex)) {
        return null;
      }
      return `chunkIndex=${item.chunkIndex}`;
    }

    if (comparablePath === 'scrollRiskTimeline') {
      if (!Number.isFinite(item.timestamp)) {
        return null;
      }
      return `timestamp=${Math.floor(item.timestamp)}`;
    }

    if (comparablePath === 'criticalMoments') {
      if (!Number.isFinite(item.timestamp) || typeof item.emotion !== 'string' || typeof item.type !== 'string') {
        return null;
      }
      const chunkIndex = Number.isInteger(item.chunkIndex) ? item.chunkIndex : 'na';
      return `timestamp=${Math.floor(item.timestamp)},emotion=${item.emotion},type=${item.type},chunkIndex=${chunkIndex}`;
    }
  }

  return null;
}

function createComparator(artifact) {
  if (artifact.comparator.kind !== 'json-structured') {
    throw new Error(`Unsupported comparator kind: ${artifact.comparator.kind}`);
  }

  const supportedProfiles = new Set(['dialogue-default', 'music-default', 'recommendation-default', 'chunk-analysis-default', 'metrics-default', 'emotional-analysis-default']);
  if (!supportedProfiles.has(artifact.comparator.profile)) {
    throw new Error(`Unsupported comparator profile for MVP: ${artifact.comparator.profile}`);
  }

  const resolvedOptions = {
    timingToleranceSeconds: DEFAULT_TIMING_TOLERANCE_SECONDS,
    numericTolerance: DEFAULT_NUMERIC_TOLERANCE,
    unknownSentinels: [...DEFAULT_UNKNOWN_SENTINELS],
    ignorePaths: [],
    ...(artifact.comparator.options || {})
  };

  if (!Number.isFinite(resolvedOptions.timingToleranceSeconds) || resolvedOptions.timingToleranceSeconds < 0) {
    throw new Error(`Invalid timingToleranceSeconds for ${artifact.artifactKey}`);
  }

  if (!Number.isFinite(resolvedOptions.numericTolerance) || resolvedOptions.numericTolerance < 0) {
    throw new Error(`Invalid numericTolerance for ${artifact.artifactKey}`);
  }

  if (!Array.isArray(resolvedOptions.unknownSentinels) || resolvedOptions.unknownSentinels.some((value) => typeof value !== 'string')) {
    throw new Error(`Invalid unknownSentinels for ${artifact.artifactKey}`);
  }

  if (!Array.isArray(resolvedOptions.ignorePaths) || resolvedOptions.ignorePaths.some((value) => typeof value !== 'string' || value.trim().length === 0)) {
    throw new Error(`Invalid ignorePaths for ${artifact.artifactKey}`);
  }

  return {
    kind: artifact.comparator.kind,
    profile: artifact.comparator.profile,
    resolvedOptions
  };
}

function compareArtifact({ artifact, comparator, truthData, outputData, truthPath, outputPath, fixtureId, benchmarkPath }) {
  const fieldResults = [];
  const failures = [];
  const skips = [];
  const errors = [];

  let hardError = null;

  function pushFieldResult(result) {
    fieldResults.push(result);
    if (result.status === 'fail') {
      failures.push({
        path: result.path,
        rule: result.rule,
        truthValue: result.truthValue,
        outputValue: result.outputValue,
        reason: result.reason || null
      });
    } else if (result.status === 'skip') {
      skips.push({
        path: result.path,
        truthValue: result.truthValue,
        reason: result.reason || 'Explicit truth sentinel'
      });
    } else if (result.status === 'error') {
      errors.push({
        path: result.path,
        rule: result.rule,
        truthValue: result.truthValue,
        outputValue: result.outputValue,
        reason: result.reason || 'Comparator error'
      });
    }
  }

  function emitHardError(pathString, reason, truthValue, outputValue, rule = 'structural') {
    pushFieldResult({
      path: pathString,
      status: 'error',
      rule,
      truthValue,
      outputValue,
      reason
    });
    hardError = hardError || reason;
  }

  function emitIgnoredSubtree(pathString, truthValue, outputValue, reason = 'Comparator ignored volatile field') {
    if (Array.isArray(truthValue)) {
      truthValue.forEach((entry, index) => {
        emitIgnoredSubtree(`${pathString}[${index}]`, entry, Array.isArray(outputValue) ? outputValue[index] : undefined, reason);
      });
      return;
    }

    if (isPlainObject(truthValue)) {
      for (const key of Object.keys(truthValue)) {
        emitIgnoredSubtree(`${pathString}.${key}`, truthValue[key], isPlainObject(outputValue) ? outputValue[key] : undefined, reason);
      }
      return;
    }

    pushFieldResult({
      path: pathString,
      status: 'skip',
      rule: 'structural',
      truthValue,
      outputValue,
      reason
    });
  }

  function chooseRule(pathString, truthValue) {
    const comparablePath = normalizeComparablePath(pathString);
    const segment = getLastPathSegment(pathString);

    if (comparator.profile === 'metrics-default') {
      if (comparablePath === 'summary.videoDuration') {
        return 'tolerant-time';
      }
      if (/^peakMoments\.[^.]+\.(highest|lowest)\.timestamp$/.test(comparablePath)) {
        return 'tolerant-time';
      }
      if (
        /^averages\.[^.]+$/.test(comparablePath)
        || /^peakMoments\.[^.]+\.(highest|lowest)\.score$/.test(comparablePath)
        || /^trends\.[^.]+\.(change|firstHalfAverage|secondHalfAverage)$/.test(comparablePath)
        || comparablePath === 'frictionIndex'
      ) {
        return 'tolerant-number';
      }
    }

    if (comparator.profile === 'emotional-analysis-default') {
      if (comparablePath === 'summary.videoDuration') {
        return 'tolerant-time';
      }
      if (
        comparablePath === 'summary.averageScrollRisk'
        || /^chunkAnalysis\[[^\]]+\]\.emotions\.[^.]+$/.test(comparablePath)
        || /^chunkAnalysis\[[^\]]+\]\.emotionalVelocity\.[^.]+$/.test(comparablePath)
        || /^chunkAnalysis\[[^\]]+\]\.scrollRisk$/.test(comparablePath)
        || /^chunkAnalysis\[[^\]]+\]\.dominantEmotion\.score$/.test(comparablePath)
        || /^emotionalArc\.emotions\.[^.]+\[\d+\]$/.test(comparablePath)
        || /^emotionalArc\.smoothedEmotions\.[^.]+\[\d+\]$/.test(comparablePath)
        || /^scrollRiskTimeline\[[^\]]+\]\.scrollRisk$/.test(comparablePath)
        || /^criticalMoments\[[^\]]+\]\.(score|previousScore|threshold|severity)$/.test(comparablePath)
      ) {
        return 'tolerant-number';
      }
      if (
        /^scrollRiskTimeline\[[^\]]+\]\.timestamp$/.test(comparablePath)
        || /^criticalMoments\[[^\]]+\]\.timestamp$/.test(comparablePath)
      ) {
        return 'tolerant-time';
      }
    }

    if (DEFAULT_TEMPORAL_FIELD_NAMES.has(segment)) {
      return 'tolerant-time';
    }
    if (typeof truthValue === 'number' && DEFAULT_TOLERANT_NUMBER_FIELD_NAMES.has(segment)) {
      return 'tolerant-number';
    }
    if (typeof truthValue === 'string' && DEFAULT_FUZZY_STRING_FIELD_NAMES.has(segment)) {
      return 'fuzzy-string';
    }
    return 'exact';
  }

  function compareLeaf(pathString, truthValue, outputValue) {
    const sentinels = comparator.resolvedOptions.unknownSentinels;
    if (typeof truthValue === 'string' && sentinels.includes(truthValue)) {
      pushFieldResult({
        path: pathString,
        status: 'skip',
        rule: 'exact',
        truthValue,
        outputValue,
        reason: 'Explicit truth sentinel'
      });
      return;
    }

    const rule = chooseRule(pathString, truthValue);
    let pass = false;
    let normalizedTruthValue;
    let normalizedOutputValue;
    let reason = null;
    let metrics;

    if (rule === 'fuzzy-string') {
      normalizedTruthValue = typeof truthValue === 'string' ? normalizeFuzzyString(truthValue) : truthValue;
      normalizedOutputValue = typeof outputValue === 'string' ? normalizeFuzzyString(outputValue) : outputValue;
      pass = normalizedTruthValue === normalizedOutputValue;
      if (!pass) {
        reason = 'Normalized strings differed';
      }
    } else if (rule === 'tolerant-time') {
      if (typeof truthValue !== 'number' || typeof outputValue !== 'number' || Number.isNaN(truthValue) || Number.isNaN(outputValue)) {
        emitHardError(pathString, 'Temporal field comparison expected numeric truth/output values', truthValue, outputValue, rule);
        return;
      }
      const delta = Math.abs(outputValue - truthValue);
      const tolerance = comparator.resolvedOptions.timingToleranceSeconds;
      pass = delta <= tolerance;
      metrics = { deltaSeconds: delta, toleranceSeconds: tolerance };
      if (!pass) {
        reason = `Time delta ${delta} exceeded tolerance ${tolerance}`;
      }
    } else if (rule === 'tolerant-number') {
      if (typeof truthValue !== 'number' || typeof outputValue !== 'number' || Number.isNaN(truthValue) || Number.isNaN(outputValue)) {
        emitHardError(pathString, 'Numeric field comparison expected numeric truth/output values', truthValue, outputValue, rule);
        return;
      }
      const delta = Math.abs(outputValue - truthValue);
      const tolerance = comparator.resolvedOptions.numericTolerance;
      pass = delta <= tolerance;
      metrics = { delta, tolerance };
      if (!pass) {
        reason = `Numeric delta ${delta} exceeded tolerance ${tolerance}`;
      }
    } else {
      pass = truthValue === outputValue;
      if (!pass) {
        reason = 'Values differed';
      }
    }

    pushFieldResult({
      path: pathString,
      status: pass ? 'pass' : 'fail',
      rule,
      truthValue,
      outputValue,
      ...(normalizedTruthValue !== undefined ? { normalizedTruthValue } : {}),
      ...(normalizedOutputValue !== undefined ? { normalizedOutputValue } : {}),
      ...(reason ? { reason } : {}),
      ...(metrics ? { metrics } : {})
    });
  }

  function walk(pathString, truthValue, outputValue) {
    const currentPath = pathString || '$';

    if (isIgnoredPath(currentPath, comparator.resolvedOptions.ignorePaths)) {
      emitIgnoredSubtree(currentPath, truthValue, outputValue);
      return;
    }

    if (Array.isArray(truthValue)) {
      if (!Array.isArray(outputValue)) {
        emitHardError(currentPath, 'Output shape mismatch: expected array', truthValue, outputValue);
        return;
      }

      const truthKeys = truthValue.map((item) => getArrayAlignmentKey(currentPath, comparator, item));
      const outputKeys = outputValue.map((item) => getArrayAlignmentKey(currentPath, comparator, item));
      const canUseKeyedAlignment = truthValue.length > 0
        && outputValue.length > 0
        && truthKeys.every((key) => typeof key === 'string')
        && outputKeys.every((key) => typeof key === 'string')
        && new Set(truthKeys).size === truthKeys.length
        && new Set(outputKeys).size === outputKeys.length;

      if (canUseKeyedAlignment) {
        if (truthValue.length !== outputValue.length) {
          pushFieldResult({
            path: currentPath,
            status: 'fail',
            rule: 'structural',
            truthValue: { length: truthValue.length, keys: truthKeys },
            outputValue: { length: outputValue.length, keys: outputKeys },
            reason: `Array length mismatch: truth=${truthValue.length} output=${outputValue.length}`
          });
        }

        const truthEntries = new Map(truthValue.map((item, index) => [truthKeys[index], item]));
        const outputEntries = new Map(outputValue.map((item, index) => [outputKeys[index], item]));

        for (const key of outputKeys) {
          if (!truthEntries.has(key)) {
            emitHardError(`${currentPath}[${key}]`, 'Truth array missing keyed item present in output', undefined, outputEntries.get(key));
          }
        }

        for (const key of truthKeys) {
          if (!outputEntries.has(key)) {
            emitHardError(`${currentPath}[${key}]`, 'Output array missing keyed item present in truth', truthEntries.get(key), undefined);
            continue;
          }
          walk(`${currentPath}[${key}]`, truthEntries.get(key), outputEntries.get(key));
        }
        return;
      }

      if (truthValue.length !== outputValue.length) {
        pushFieldResult({
          path: currentPath,
          status: 'fail',
          rule: 'structural',
          truthValue: { length: truthValue.length },
          outputValue: { length: outputValue.length },
          reason: `Array length mismatch: truth=${truthValue.length} output=${outputValue.length}`
        });
      }
      const maxLength = Math.max(truthValue.length, outputValue.length);
      for (let i = 0; i < maxLength; i += 1) {
        const childPath = `${currentPath}[${i}]`;
        if (i >= truthValue.length) {
          emitHardError(childPath, 'Truth array missing item present in output', undefined, outputValue[i]);
          continue;
        }
        if (i >= outputValue.length) {
          emitHardError(childPath, 'Output array missing item present in truth', truthValue[i], undefined);
          continue;
        }
        walk(childPath, truthValue[i], outputValue[i]);
      }
      return;
    }

    if (isPlainObject(truthValue)) {
      if (!isPlainObject(outputValue)) {
        emitHardError(currentPath, 'Output shape mismatch: expected object', truthValue, outputValue);
        return;
      }

      const truthKeys = Object.keys(truthValue);
      const outputKeys = Object.keys(outputValue);
      const truthKeySet = new Set(truthKeys);
      const outputKeySet = new Set(outputKeys);

      for (const key of outputKeys) {
        if (!truthKeySet.has(key)) {
          emitHardError(currentPath === '$' ? key : `${currentPath}.${key}`, 'Truth object missing field present in output', undefined, outputValue[key]);
        }
      }

      for (const key of truthKeys) {
        const childPath = currentPath === '$' ? key : `${currentPath}.${key}`;
        if (!outputKeySet.has(key)) {
          emitHardError(childPath, 'Output object missing field present in truth', truthValue[key], undefined);
          continue;
        }
        walk(childPath, truthValue[key], outputValue[key]);
      }
      return;
    }

    compareLeaf(currentPath, truthValue, outputValue);
  }

  walk('$', truthData, outputData);

  const counts = {
    totalTruthFields: fieldResults.filter((result) => result.status === 'pass' || result.status === 'fail' || result.status === 'skip' || result.status === 'error').length,
    scoreableFields: fieldResults.filter((result) => result.status === 'pass' || result.status === 'fail').length,
    skippedFields: fieldResults.filter((result) => result.status === 'skip').length,
    passedFields: fieldResults.filter((result) => result.status === 'pass').length,
    failedFields: fieldResults.filter((result) => result.status === 'fail').length,
    erroredFields: fieldResults.filter((result) => result.status === 'error').length
  };

  const accuracyRate = counts.scoreableFields > 0 ? counts.passedFields / counts.scoreableFields : null;
  const coverageRate = counts.totalTruthFields > 0 ? counts.scoreableFields / counts.totalTruthFields : null;

  let status = 'pass';
  if (hardError || counts.erroredFields > 0) {
    status = 'error';
  } else if (counts.failedFields > 0) {
    status = 'fail';
  }

  const summary = hardError
    ? `${artifact.artifactKey} benchmark errored: ${hardError}`
    : `${counts.passedFields}/${counts.scoreableFields} scoreable fields passed; ${counts.skippedFields}/${counts.totalTruthFields} truth fields were skipped.`;

  return {
    artifactKey: artifact.artifactKey,
    label: artifact.label || artifact.artifactKey,
    phase: artifact.phase,
    script: artifact.script,
    status,
    truth: { path: truthPath },
    output: { path: outputPath },
    comparator: {
      kind: comparator.kind,
      profile: comparator.profile,
      resolvedOptions: comparator.resolvedOptions
    },
    counts,
    accuracy: {
      passed: counts.passedFields,
      failed: counts.failedFields,
      rate: accuracyRate
    },
    coverage: {
      scoreable: counts.scoreableFields,
      skipped: counts.skippedFields,
      totalTruthFields: counts.totalTruthFields,
      rate: coverageRate
    },
    failures,
    skips,
    errors,
    fieldResults,
    summary,
    context: {
      fixtureId,
      benchmarkPath,
      truthPath,
      outputPath
    }
  };
}

function buildMarkdownSummary(summary) {
  const lines = [];
  lines.push(`# Benchmark Summary: ${summary.fixtureId}`);
  lines.push('');
  lines.push(`- Status: **${summary.status}**`);
  lines.push(`- Benchmark: \`${summary.benchmark.path}\``);
  lines.push(`- Fixture: \`${summary.fixture.path}\``);
  lines.push(`- Config: \`${summary.run.configName}\``);
  lines.push(`- Output Dir: \`${summary.run.outputDir}\``);
  lines.push('');
  lines.push('## Totals');
  lines.push('');
  lines.push(`- Artifacts: ${summary.totals.artifactsPassed}/${summary.totals.artifactsTotal} passed, ${summary.totals.artifactsFailed} failed, ${summary.totals.artifactsErrored} errored`);
  lines.push(`- Accuracy: ${summary.accuracy.passed}/${summary.accuracy.passed + summary.accuracy.failed} scoreable fields passed${summary.accuracy.rate === null ? '' : ` (${(summary.accuracy.rate * 100).toFixed(1)}%)`}`);
  lines.push(`- Coverage: ${summary.coverage.scoreable}/${summary.coverage.totalTruthFields} truth fields scoreable${summary.coverage.rate === null ? '' : ` (${(summary.coverage.rate * 100).toFixed(1)}%)`}`);
  lines.push(`- Skipped truth fields: ${summary.coverage.skipped}`);
  lines.push('');
  lines.push('## Artifacts');
  lines.push('');
  for (const artifact of summary.artifacts) {
    lines.push(`- **${artifact.artifactKey}** — ${artifact.status}; accuracy=${artifact.accuracyRate === null ? 'n/a' : (artifact.accuracyRate * 100).toFixed(1) + '%'}, coverage=${artifact.coverageRate === null ? 'n/a' : (artifact.coverageRate * 100).toFixed(1) + '%'}`);
  }
  lines.push('');
  lines.push(summary.summary);
  lines.push('');
  return `${lines.join('\n')}\n`;
}

function runBenchmarkStage({ config, configPath, outputDir }) {
  const benchmarkConfig = resolveBenchmarkConfig(config, { configPath });

  if (!benchmarkConfig.enabled) {
    return {
      enabled: false,
      status: 'skipped',
      reason: benchmarkConfig.reason,
      summary: benchmarkConfig.reason === 'absent' ? 'Benchmark skipped: no benchmark block.' : 'Benchmark skipped: benchmark.enabled is false.'
    };
  }

  const manifestPath = benchmarkConfig.absolutePath;
  const manifestDir = path.dirname(manifestPath);
  const manifest = readJsonFile(manifestPath, 'benchmark manifest');
  validateManifest(manifest, manifestPath);

  const fixturePath = path.resolve(manifestDir, manifest.fixture.path);
  if (!fs.existsSync(fixturePath)) {
    throw new Error(`Benchmark fixture not found: ${fixturePath}`);
  }
  const fixture = readJsonFile(fixturePath, 'benchmark fixture');
  validateFixture(fixture, fixturePath, manifest);

  const reportDir = path.resolve(manifestDir, manifest.reports.outputDir);
  const artifactResultsDir = path.join(reportDir, 'artifact-results');
  fs.mkdirSync(artifactResultsDir, { recursive: true });

  const artifactResults = [];
  for (const artifact of manifest.artifacts) {
    const comparator = createComparator(artifact);
    const truthAbsolutePath = path.resolve(manifestDir, artifact.truth.path);
    const outputAbsolutePath = path.resolve(outputDir, artifact.output.path);

    if (!fs.existsSync(truthAbsolutePath)) {
      throw new Error(`Truth artifact missing for ${artifact.artifactKey}: ${truthAbsolutePath}`);
    }

    if (artifact.required && !fs.existsSync(outputAbsolutePath)) {
      throw new Error(`Produced artifact missing for ${artifact.artifactKey}: ${outputAbsolutePath}`);
    }

    const truthData = readJsonFile(truthAbsolutePath, `truth artifact ${artifact.artifactKey}`);
    const outputData = readJsonFile(outputAbsolutePath, `produced artifact ${artifact.artifactKey}`);

    const result = compareArtifact({
      artifact,
      comparator,
      truthData,
      outputData,
      truthPath: path.relative(process.cwd(), truthAbsolutePath).split(path.sep).join('/'),
      outputPath: path.relative(process.cwd(), outputAbsolutePath).split(path.sep).join('/'),
      fixtureId: manifest.fixtureId,
      benchmarkPath: path.relative(process.cwd(), manifestPath).split(path.sep).join('/')
    });

    artifactResults.push(result);
    const artifactReportPath = path.join(artifactResultsDir, `${artifact.artifactKey}.json`);
    ensureParentDir(artifactReportPath);
    fs.writeFileSync(artifactReportPath, JSON.stringify(result, null, 2), 'utf8');
  }

  const totals = artifactResults.reduce((acc, result) => {
    acc.artifactsTotal += 1;
    if (result.status === 'pass') acc.artifactsPassed += 1;
    if (result.status === 'fail') acc.artifactsFailed += 1;
    if (result.status === 'error') acc.artifactsErrored += 1;
    acc.totalTruthFields += result.counts.totalTruthFields;
    acc.scoreableFields += result.counts.scoreableFields;
    acc.skippedFields += result.counts.skippedFields;
    acc.passedFields += result.counts.passedFields;
    acc.failedFields += result.counts.failedFields;
    acc.erroredFields += result.counts.erroredFields;
    return acc;
  }, {
    artifactsTotal: 0,
    artifactsPassed: 0,
    artifactsFailed: 0,
    artifactsErrored: 0,
    totalTruthFields: 0,
    scoreableFields: 0,
    skippedFields: 0,
    passedFields: 0,
    failedFields: 0,
    erroredFields: 0
  });

  const status = totals.artifactsErrored > 0
    ? 'error'
    : totals.artifactsFailed > 0
      ? 'fail'
      : 'pass';

  const summary = {
    contractVersion: REPORT_CONTRACT_VERSION,
    fixtureId: manifest.fixtureId,
    benchmark: {
      path: path.relative(process.cwd(), manifestPath).split(path.sep).join('/')
    },
    fixture: {
      path: path.relative(process.cwd(), fixturePath).split(path.sep).join('/')
    },
    run: {
      configName: config?.name || path.basename(configPath || ''),
      outputDir: path.relative(process.cwd(), outputDir).split(path.sep).join('/')
    },
    status,
    artifacts: artifactResults.map((result) => ({
      artifactKey: result.artifactKey,
      status: result.status,
      accuracyRate: result.accuracy.rate,
      coverageRate: result.coverage.rate
    })),
    totals,
    accuracy: {
      passed: totals.passedFields,
      failed: totals.failedFields,
      rate: totals.scoreableFields > 0 ? totals.passedFields / totals.scoreableFields : null
    },
    coverage: {
      scoreable: totals.scoreableFields,
      skipped: totals.skippedFields,
      totalTruthFields: totals.totalTruthFields,
      rate: totals.totalTruthFields > 0 ? totals.scoreableFields / totals.totalTruthFields : null
    },
    errors: artifactResults.flatMap((result) => result.errors.map((error) => ({ artifactKey: result.artifactKey, ...error }))),
    summary: `${totals.artifactsPassed}/${totals.artifactsTotal} artifacts passed. ${totals.passedFields}/${totals.scoreableFields} scoreable fields passed. Truth coverage was ${totals.scoreableFields}/${totals.totalTruthFields} fields.`
  };

  ensureParentDir(path.join(reportDir, 'benchmark-summary.json'));
  fs.writeFileSync(path.join(reportDir, 'benchmark-summary.json'), JSON.stringify(summary, null, 2), 'utf8');
  fs.writeFileSync(path.join(reportDir, 'benchmark-summary.md'), buildMarkdownSummary(summary), 'utf8');

  return {
    enabled: true,
    status,
    summary: summary.summary,
    reportDir,
    summaryPath: path.join(reportDir, 'benchmark-summary.json'),
    manifestPath,
    fixturePath,
    artifactResults,
    aggregate: summary
  };
}

module.exports = {
  MANIFEST_CONTRACT_VERSION,
  FIXTURE_CONTRACT_VERSION,
  REPORT_CONTRACT_VERSION,
  resolveBenchmarkConfig,
  runBenchmarkStage
};
