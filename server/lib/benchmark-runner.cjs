const fs = require('fs');
const path = require('path');
const { resolvePhase1ArtifactPath, VALID_RUNTIME_ARTIFACT_SURFACES } = require('./phase1-baseline-resolution.cjs');

const MANIFEST_CONTRACT_VERSION = 'ee.benchmark-manifest/v1';
const FIXTURE_CONTRACT_VERSION = 'ee.benchmark-fixture/v1';
const REPORT_CONTRACT_VERSION = 'ee.benchmark-report/v1';
const DEFAULT_UNKNOWN_SENTINELS = ['unknown', 'ambiguous'];
const DEFAULT_TIMING_TOLERANCE_SECONDS = 2;
const DEFAULT_NUMERIC_TOLERANCE = 0.1;
const DEFAULT_TEMPORAL_FIELD_NAMES = new Set(['start', 'end', 'startTime', 'endTime', 'duration', 'totalDuration', 'videoDuration']);
const DEFAULT_TOLERANT_NUMBER_FIELD_NAMES = new Set(['confidence']);
const DEFAULT_FUZZY_STRING_FIELD_NAMES = new Set(['text', 'summary', 'description', 'reasoning', 'cleanedTranscript', 'handoffContext', 'label', 'note', 'keyFindings', 'suggestions']);
const PROFILE_DEFAULT_IGNORE_PATHS = Object.freeze({
  'dialogue-default': ['$.totalDuration', '$.dialogue_segments[*].start', '$.dialogue_segments[*].end'],
  'dialogue-timestamps-default': ['$.totalDuration', '$.dialogue_segments[*].start', '$.dialogue_segments[*].end', '$.dialogue_segments[*].index'],
  'music-vocals-default': ['$.totalDuration', '$.vocal_segments[*].start', '$.vocal_segments[*].end', '$.vocal_segments[*].index'],
  'music-vocals-timestamps-default': ['$.totalDuration', '$.vocal_segments[*].start', '$.vocal_segments[*].end', '$.vocal_segments[*].index'],
  'chunk-analysis-default': ['$.chunks[*].thought', '$.chunks[*].continuationThought', '$.chunks[*].personaMeta', '$.chunks[*].personaMeta.scrollRisk']
});

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
    if (artifact.runtimeArtifactKey !== undefined && (typeof artifact.runtimeArtifactKey !== 'string' || artifact.runtimeArtifactKey.trim().length === 0)) {
      throw new Error(`${prefix}.runtimeArtifactKey must be a non-empty string when provided`);
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
    if (artifact.benchmarkRouting !== undefined) {
      if (typeof artifact.benchmarkRouting !== 'object' || artifact.benchmarkRouting === null || Array.isArray(artifact.benchmarkRouting)) {
        throw new Error(`${prefix}.benchmarkRouting must be an object when provided`);
      }
      if (artifact.benchmarkRouting.runtimeArtifactSurface !== undefined) {
        if (typeof artifact.benchmarkRouting.runtimeArtifactSurface !== 'string' || !VALID_RUNTIME_ARTIFACT_SURFACES.includes(artifact.benchmarkRouting.runtimeArtifactSurface)) {
          throw new Error(`${prefix}.benchmarkRouting.runtimeArtifactSurface must be one of: ${VALID_RUNTIME_ARTIFACT_SURFACES.join(', ')}`);
        }
      }
      for (const field of ['truthSurface', 'reportSurface']) {
        if (artifact.benchmarkRouting[field] !== undefined && (typeof artifact.benchmarkRouting[field] !== 'string' || artifact.benchmarkRouting[field].trim().length === 0)) {
          throw new Error(`${prefix}.benchmarkRouting.${field} must be a non-empty string when provided`);
        }
      }
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

function tokenizeFuzzyString(value) {
  if (typeof value !== 'string') {
    return [];
  }
  return normalizeFuzzyString(value).split(' ').filter(Boolean);
}

function scoreTokenOverlap(leftValue, rightValue) {
  const leftTokens = new Set(tokenizeFuzzyString(leftValue));
  const rightTokens = new Set(tokenizeFuzzyString(rightValue));
  if (leftTokens.size === 0 && rightTokens.size === 0) {
    return 1;
  }
  if (leftTokens.size === 0 || rightTokens.size === 0) {
    return 0;
  }

  let overlapCount = 0;
  for (const token of leftTokens) {
    if (rightTokens.has(token)) {
      overlapCount += 1;
    }
  }

  return (2 * overlapCount) / (leftTokens.size + rightTokens.size);
}


function normalizeDialogueTextForScoring(value) {
  if (typeof value !== 'string') {
    return '';
  }

  return normalizeWhitespace(
    value
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[’‘]/g, "'")
      .replace(/[“”]/g, '"')
      .toLowerCase()
      .replace(/-/g, '')
      .replace(/[^\p{L}\p{N}\s]+/gu, ' ')
  );
}

function tokenizeDialogueTextForScoring(value) {
  return normalizeDialogueTextForScoring(value).split(' ').filter(Boolean);
}

function levenshteinDistance(leftTokens, rightTokens) {
  const rows = leftTokens.length + 1;
  const cols = rightTokens.length + 1;
  const dp = Array.from({ length: rows }, () => Array(cols).fill(0));

  for (let i = 0; i < rows; i += 1) dp[i][0] = i;
  for (let j = 0; j < cols; j += 1) dp[0][j] = j;

  for (let i = 1; i < rows; i += 1) {
    for (let j = 1; j < cols; j += 1) {
      const cost = leftTokens[i - 1] === rightTokens[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
    }
  }

  return dp[leftTokens.length][rightTokens.length];
}

function scoreTokenSequenceSimilarity(leftTokens, rightTokens) {
  if (leftTokens.length === 0 && rightTokens.length === 0) {
    return { similarity: 1, editDistance: 0, tokenCount: 0 };
  }

  const tokenCount = Math.max(leftTokens.length, rightTokens.length);
  const editDistance = levenshteinDistance(leftTokens, rightTokens);
  const similarity = tokenCount > 0 ? Math.max(0, 1 - (editDistance / tokenCount)) : 1;
  return { similarity, editDistance, tokenCount };
}

function roundPct(value) {
  if (!Number.isFinite(value)) {
    return null;
  }
  return Math.round(value * 10) / 10;
}

function getDialogueSegmentText(segment) {
  return typeof segment?.text === 'string' ? segment.text : '';
}

function getDialogueSegmentOrderValue(segment, fallbackIndex) {
  if (Number.isFinite(segment?.start)) {
    return Number(segment.start);
  }
  if (Number.isFinite(segment?.index)) {
    return Number(segment.index);
  }
  return fallbackIndex;
}

function getSegmentWindowBounds(segments, indexes) {
  const starts = indexes
    .map((index) => Number(segments[index]?.start))
    .filter((value) => Number.isFinite(value));
  const ends = indexes
    .map((index) => Number(segments[index]?.end))
    .filter((value) => Number.isFinite(value));

  return {
    start: starts.length > 0 ? Math.min(...starts) : null,
    end: ends.length > 0 ? Math.max(...ends) : null
  };
}

function hasResolvedSegmentTiming(segment) {
  const timingStatus = typeof segment?.timing?.status === 'string' ? segment.timing.status : null;
  return Number.isFinite(segment?.start)
    && Number.isFinite(segment?.end)
    && timingStatus !== 'unresolved';
}

function buildAlignedTextBoundaryScoring({
  truthSegments,
  outputSegments,
  normalizationProfile,
  transcriptFieldName,
  windowedFieldName,
  boundaryFieldName,
  timestampScoring = null
}) {
  const truthSegmentTokens = truthSegments.map((segment) => tokenizeDialogueTextForScoring(getDialogueSegmentText(segment)));
  const outputSegmentTokens = outputSegments.map((segment) => tokenizeDialogueTextForScoring(getDialogueSegmentText(segment)));
  const truthTranscriptTokens = truthSegmentTokens.flat();
  const outputTranscriptTokens = outputSegmentTokens.flat();
  const fullTranscript = scoreTokenSequenceSimilarity(truthTranscriptTokens, outputTranscriptTokens);

  const maxWindowSegments = 3;
  const minimumWindowSimilarity = 0.5;
  const searchWindow = Array.from({ length: truthSegments.length + 1 }, () => Array(outputSegments.length + 1).fill(null));

  function truthSkipPenalty(index) {
    return truthSegmentTokens[index]?.length || 1;
  }

  function outputSkipPenalty(index) {
    return outputSegmentTokens[index]?.length || 1;
  }

  function windowScore(startTruth, truthLen, startOutput, outputLen) {
    const truthTokens = truthSegmentTokens.slice(startTruth, startTruth + truthLen).flat();
    const outputTokens = outputSegmentTokens.slice(startOutput, startOutput + outputLen).flat();
    const similarityResult = scoreTokenSequenceSimilarity(truthTokens, outputTokens);
    if (similarityResult.similarity < minimumWindowSimilarity) {
      return null;
    }

    const truthWeight = truthTokens.length || truthLen || 1;
    const outputWeight = outputTokens.length || outputLen || 1;
    const weight = Math.max(truthWeight, outputWeight, 1);
    const sizePenalty = (truthLen + outputLen - 2) * 0.05;
    const score = (similarityResult.similarity * weight) - sizePenalty;
    const truthOrderValue = getDialogueSegmentOrderValue(truthSegments[startTruth], startTruth);
    const outputOrderValue = getDialogueSegmentOrderValue(outputSegments[startOutput], startOutput);

    return {
      score,
      similarity: similarityResult.similarity,
      editDistance: similarityResult.editDistance,
      tokenCount: similarityResult.tokenCount,
      truthTokens,
      outputTokens,
      truthLen,
      outputLen,
      orderDelta: Math.abs(truthOrderValue - outputOrderValue)
    };
  }

  function solve(i, j) {
    if (searchWindow[i][j]) {
      return searchWindow[i][j];
    }

    if (i >= truthSegments.length && j >= outputSegments.length) {
      const terminal = { score: 0, steps: [] };
      searchWindow[i][j] = terminal;
      return terminal;
    }

    let best = { score: Number.NEGATIVE_INFINITY, steps: [] };

    if (i < truthSegments.length) {
      const next = solve(i + 1, j);
      const candidate = {
        score: next.score - truthSkipPenalty(i),
        steps: [{ kind: 'missing_truth', truthIndexes: [i], outputIndexes: [] }, ...next.steps]
      };
      if (candidate.score > best.score) {
        best = candidate;
      }
    }

    if (j < outputSegments.length) {
      const next = solve(i, j + 1);
      const candidate = {
        score: next.score - outputSkipPenalty(j),
        steps: [{ kind: 'extra_output', truthIndexes: [], outputIndexes: [j] }, ...next.steps]
      };
      if (candidate.score > best.score) {
        best = candidate;
      }
    }

    for (let truthLen = 1; truthLen <= maxWindowSegments && i + truthLen <= truthSegments.length; truthLen += 1) {
      for (let outputLen = 1; outputLen <= maxWindowSegments && j + outputLen <= outputSegments.length; outputLen += 1) {
        const candidateWindow = windowScore(i, truthLen, j, outputLen);
        if (!candidateWindow) {
          continue;
        }
        const next = solve(i + truthLen, j + outputLen);
        const candidate = {
          score: next.score + candidateWindow.score,
          steps: [{
            kind: 'matched_window',
            truthIndexes: Array.from({ length: truthLen }, (_, offset) => i + offset),
            outputIndexes: Array.from({ length: outputLen }, (_, offset) => j + offset),
            similarity: candidateWindow.similarity,
            editDistance: candidateWindow.editDistance,
            tokenCount: candidateWindow.tokenCount,
            orderDelta: candidateWindow.orderDelta
          }, ...next.steps]
        };
        if (candidate.score > best.score) {
          best = candidate;
        }
      }
    }

    searchWindow[i][j] = best;
    return best;
  }

  const windowSolution = solve(0, 0);
  const matchedWindows = windowSolution.steps.filter((step) => step.kind === 'matched_window');
  const windowWeights = windowSolution.steps.map((step) => {
    if (step.kind === 'matched_window') {
      return Math.max(step.tokenCount, 1);
    }
    if (step.kind === 'missing_truth') {
      return step.truthIndexes.reduce((sum, index) => sum + (truthSegmentTokens[index]?.length || 1), 0);
    }
    return step.outputIndexes.reduce((sum, index) => sum + (outputSegmentTokens[index]?.length || 1), 0);
  });
  const totalWindowWeight = windowWeights.reduce((sum, value) => sum + value, 0);
  const weightedSimilarity = windowSolution.steps.reduce((sum, step, index) => {
    const weight = windowWeights[index] || 1;
    if (step.kind !== 'matched_window') {
      return sum;
    }
    return sum + (step.similarity * weight);
  }, 0);
  const splitEventCount = matchedWindows.filter((step) => step.truthIndexes.length === 1 && step.outputIndexes.length > 1).length;
  const mergeEventCount = matchedWindows.filter((step) => step.truthIndexes.length > 1 && step.outputIndexes.length === 1).length;
  const mixedResegmentationCount = matchedWindows.filter((step) => step.truthIndexes.length > 1 && step.outputIndexes.length > 1).length;
  const missingTruthWindowCount = windowSolution.steps.filter((step) => step.kind === 'missing_truth').length;
  const extraOutputWindowCount = windowSolution.steps.filter((step) => step.kind === 'extra_output').length;

  let matchedBoundaryEvents = 0;
  let missingBoundaryEvents = 0;
  let extraBoundaryEvents = 0;

  for (const step of matchedWindows) {
    const truthBoundaries = Math.max(0, step.truthIndexes.length - 1);
    const outputBoundaries = Math.max(0, step.outputIndexes.length - 1);
    matchedBoundaryEvents += Math.min(truthBoundaries, outputBoundaries);
    missingBoundaryEvents += Math.max(0, truthBoundaries - outputBoundaries);
    extraBoundaryEvents += Math.max(0, outputBoundaries - truthBoundaries);
  }

  const totalBoundaryEvents = matchedBoundaryEvents + missingBoundaryEvents + extraBoundaryEvents;
  const boundaryPct = totalBoundaryEvents > 0 ? (matchedBoundaryEvents / totalBoundaryEvents) * 100 : 100;

  const windowAlignments = windowSolution.steps.map((step) => {
    if (step.kind === 'missing_truth') {
      return {
        truth_indexes: step.truthIndexes,
        output_indexes: [],
        text_similarity_pct: 0,
        boundary_status: 'missing_truth'
      };
    }

    if (step.kind === 'extra_output') {
      return {
        truth_indexes: [],
        output_indexes: step.outputIndexes,
        text_similarity_pct: 0,
        boundary_status: 'extra_output'
      };
    }

    let boundaryStatus = 'boundary_exact';
    if (step.truthIndexes.length === 1 && step.outputIndexes.length > 1) {
      boundaryStatus = 'split';
    } else if (step.truthIndexes.length > 1 && step.outputIndexes.length === 1) {
      boundaryStatus = 'merge';
    } else if (step.truthIndexes.length > 1 && step.outputIndexes.length > 1) {
      boundaryStatus = 'mixed_resegmentation';
    }

    const truthNormalizedText = normalizeDialogueTextForScoring(step.truthIndexes.map((index) => getDialogueSegmentText(truthSegments[index])).join(' '));
    const outputNormalizedText = normalizeDialogueTextForScoring(step.outputIndexes.map((index) => getDialogueSegmentText(outputSegments[index])).join(' '));
    const textMatch = truthNormalizedText === outputNormalizedText ? 'exact_normalized' : 'drift';

    return {
      truth_indexes: step.truthIndexes,
      output_indexes: step.outputIndexes,
      text_similarity_pct: roundPct(step.similarity * 100),
      boundary_status: boundaryStatus,
      text_match: textMatch
    };
  });

  const scoring = {
    [transcriptFieldName]: roundPct(fullTranscript.similarity * 100),
    [windowedFieldName]: totalWindowWeight > 0 ? roundPct((weightedSimilarity / totalWindowWeight) * 100) : 0,
    [boundaryFieldName]: roundPct(boundaryPct),
    truth_segment_count: truthSegments.length,
    output_segment_count: outputSegments.length,
    comparison_unit_count: windowAlignments.length,
    split_event_count: splitEventCount,
    merge_event_count: mergeEventCount,
    mixed_resegmentation_count: mixedResegmentationCount,
    missing_truth_window_count: missingTruthWindowCount,
    extra_output_window_count: extraOutputWindowCount,
    normalization_profile: normalizationProfile,
    window_alignments: windowAlignments
  };

  if (timestampScoring) {
    const timingToleranceSeconds = Number.isFinite(timestampScoring.timingToleranceSeconds)
      ? timestampScoring.timingToleranceSeconds
      : DEFAULT_TIMING_TOLERANCE_SECONDS;
    const resolvedUnitScores = [];
    let timingEligibleUnitCount = 0;
    let timingResolvedUnitCount = 0;
    let timingBlockedByTextDriftCount = 0;

    windowAlignments.forEach((alignment) => {
      const truthIndexes = alignment.truth_indexes || [];
      const outputIndexes = alignment.output_indexes || [];
      const truthHasRows = truthIndexes.length > 0;
      const outputHasRows = outputIndexes.length > 0;
      const truthBounds = getSegmentWindowBounds(truthSegments, truthIndexes);
      const runtimeBounds = getSegmentWindowBounds(outputSegments, outputIndexes);
      const isTextDrift = truthHasRows && outputHasRows && alignment.text_match === 'drift';
      const isWindowComparable = truthHasRows
        && outputHasRows
        && ['boundary_exact', 'split', 'merge', 'mixed_resegmentation'].includes(alignment.boundary_status);

      let timingEligibility = 'not_applicable';
      if (isWindowComparable && alignment.text_match === 'exact_normalized') {
        timingEligibility = alignment.boundary_status === 'boundary_exact' ? 'row_level' : 'window_level';
      } else if (isTextDrift) {
        timingEligibility = 'blocked_by_text_drift';
        timingBlockedByTextDriftCount += 1;
      }

      const hasRuntimeBounds = Number.isFinite(runtimeBounds.start) && Number.isFinite(runtimeBounds.end);
      const hasTruthBounds = Number.isFinite(truthBounds.start) && Number.isFinite(truthBounds.end);
      const startDeltaSeconds = hasTruthBounds && hasRuntimeBounds ? Math.abs(runtimeBounds.start - truthBounds.start) : null;
      const endDeltaSeconds = hasTruthBounds && hasRuntimeBounds ? Math.abs(runtimeBounds.end - truthBounds.end) : null;
      const overlapSeconds = hasTruthBounds && hasRuntimeBounds
        ? Math.max(0, Math.min(truthBounds.end, runtimeBounds.end) - Math.max(truthBounds.start, runtimeBounds.start))
        : null;
      const unionSeconds = hasTruthBounds && hasRuntimeBounds
        ? Math.max(truthBounds.end, runtimeBounds.end) - Math.min(truthBounds.start, runtimeBounds.start)
        : null;
      const windowOverlapPct = unionSeconds === null
        ? null
        : unionSeconds > 0
          ? roundPct((100 * overlapSeconds) / unionSeconds)
          : 100;

      let timingResolutionStatus = 'not_applicable';
      if (timingEligibility === 'blocked_by_text_drift') {
        timingResolutionStatus = 'blocked_by_text_drift';
      } else if (timingEligibility === 'row_level' || timingEligibility === 'window_level') {
        timingEligibleUnitCount += 1;
        const resolved = outputIndexes.every((index) => hasResolvedSegmentTiming(outputSegments[index]))
          && hasTruthBounds
          && hasRuntimeBounds;
        if (resolved) {
          timingResolutionStatus = 'resolved';
          timingResolvedUnitCount += 1;
          resolvedUnitScores.push({
            startPct: Math.max(0, 100 * (1 - (startDeltaSeconds / timingToleranceSeconds))),
            endPct: Math.max(0, 100 * (1 - (endDeltaSeconds / timingToleranceSeconds))),
            windowPct: unionSeconds > 0 ? (100 * overlapSeconds) / unionSeconds : 100
          });
        } else {
          timingResolutionStatus = 'unresolved';
        }
      }

      alignment.timing_eligibility = timingEligibility;
      alignment.timing_resolution_status = timingResolutionStatus;
      alignment.truth_window_start = truthBounds.start;
      alignment.truth_window_end = truthBounds.end;
      alignment.runtime_window_start = runtimeBounds.start;
      alignment.runtime_window_end = runtimeBounds.end;
      alignment.start_delta_seconds = startDeltaSeconds;
      alignment.end_delta_seconds = endDeltaSeconds;
      alignment.window_overlap_pct = windowOverlapPct;
    });

    const resolvedAverage = (fieldName) => {
      if (resolvedUnitScores.length === 0) {
        return null;
      }
      const total = resolvedUnitScores.reduce((sum, entry) => sum + entry[fieldName], 0);
      return roundPct(total / resolvedUnitScores.length);
    };

    const timingUnresolvedUnitCount = Math.max(0, timingEligibleUnitCount - timingResolvedUnitCount);

    scoring[timestampScoring.eligibleFieldName] = windowAlignments.length > 0
      ? roundPct((timingEligibleUnitCount / windowAlignments.length) * 100)
      : null;
    scoring[timestampScoring.resolvedFieldName] = timingEligibleUnitCount > 0
      ? roundPct((timingResolvedUnitCount / timingEligibleUnitCount) * 100)
      : null;
    scoring[timestampScoring.startFieldName] = resolvedAverage('startPct');
    scoring[timestampScoring.endFieldName] = resolvedAverage('endPct');
    scoring[timestampScoring.windowFieldName] = resolvedAverage('windowPct');
    scoring[timestampScoring.blockedFieldName] = windowAlignments.length > 0
      ? roundPct((timingBlockedByTextDriftCount / windowAlignments.length) * 100)
      : null;
    scoring.timing_eligible_unit_count = timingEligibleUnitCount;
    scoring.timing_resolved_unit_count = timingResolvedUnitCount;
    scoring.timing_unresolved_unit_count = timingUnresolvedUnitCount;
    scoring.timing_blocked_by_text_drift_count = timingBlockedByTextDriftCount;
    scoring.timing_tolerance_seconds = timingToleranceSeconds;
  }

  return scoring;
}

function buildDialogueScoring(truthData, outputData) {
  return buildAlignedTextBoundaryScoring({
    truthSegments: Array.isArray(truthData?.dialogue_segments) ? truthData.dialogue_segments : [],
    outputSegments: Array.isArray(outputData?.dialogue_segments) ? outputData.dialogue_segments : [],
    normalizationProfile: 'dialogue-text-v1',
    transcriptFieldName: 'dialogue_text_full_transcript_pct',
    windowedFieldName: 'dialogue_text_windowed_pct',
    boundaryFieldName: 'dialogue_boundary_pct'
  });
}

function buildDialogueTimestampScoring(truthData, outputData, timingToleranceSeconds = DEFAULT_TIMING_TOLERANCE_SECONDS) {
  return buildAlignedTextBoundaryScoring({
    truthSegments: Array.isArray(truthData?.dialogue_segments) ? truthData.dialogue_segments : [],
    outputSegments: Array.isArray(outputData?.dialogue_segments) ? outputData.dialogue_segments : [],
    normalizationProfile: 'dialogue-timestamp-text-v1',
    transcriptFieldName: 'dialogue_text_full_transcript_pct',
    windowedFieldName: 'dialogue_text_windowed_pct',
    boundaryFieldName: 'dialogue_boundary_pct',
    timestampScoring: {
      timingToleranceSeconds,
      eligibleFieldName: 'dialogue_timing_eligible_pct',
      resolvedFieldName: 'dialogue_timing_resolved_pct',
      startFieldName: 'dialogue_timing_start_pct',
      endFieldName: 'dialogue_timing_end_pct',
      windowFieldName: 'dialogue_timing_window_pct',
      blockedFieldName: 'dialogue_timing_blocked_by_text_drift_pct'
    }
  });
}

function buildMusicVocalsScoring(truthData, outputData, fieldResults) {
  const scoring = buildAlignedTextBoundaryScoring({
    truthSegments: Array.isArray(truthData?.vocal_segments) ? truthData.vocal_segments : [],
    outputSegments: Array.isArray(outputData?.vocal_segments) ? outputData.vocal_segments : [],
    normalizationProfile: 'lyrics-text-v1',
    transcriptFieldName: 'vocal_text_full_transcript_pct',
    windowedFieldName: 'vocal_text_windowed_pct',
    boundaryFieldName: 'vocal_boundary_pct'
  });

  return {
    ...scoring,
    vocal_attribution_pct: scoreFieldResults(fieldResults, (result) => /^vocal_segments\[truth=\d+,output=\d+\]\.(performer|performer_id|delivery)$/.test(result.path)),
    recognized_song_identity_pct: scoreFieldResults(fieldResults, (result) => /^recognizedSong\.(status|confidence|multipleSongsDetected)$/.test(result.path)
      || /^recognizedSong\.candidates\[\d+\]\.(title|artist|confidence)$/.test(result.path)),
    recognized_song_support_pct: scoreFieldResults(fieldResults, (result) => /^recognizedSong\.candidates\[\d+\]\.(evidence|matchedLyrics|timeRanges)(\[.*\]|\..*)?$/.test(result.path)
      || /^recognizedSong\.(primaryEvidence|ambiguity)$/.test(result.path)
      || /^recognitionNotes(\[.*\])?$/.test(result.path)
      || /^qualityNotes(\[.*\])?$/.test(result.path))
  };
}

function buildMusicVocalsTimestampScoring(truthData, outputData, fieldResults, timingToleranceSeconds = DEFAULT_TIMING_TOLERANCE_SECONDS) {
  const scoring = buildAlignedTextBoundaryScoring({
    truthSegments: Array.isArray(truthData?.vocal_segments) ? truthData.vocal_segments : [],
    outputSegments: Array.isArray(outputData?.vocal_segments) ? outputData.vocal_segments : [],
    normalizationProfile: 'lyrics-timestamp-text-v1',
    transcriptFieldName: 'vocal_text_full_transcript_pct',
    windowedFieldName: 'vocal_text_windowed_pct',
    boundaryFieldName: 'vocal_boundary_pct',
    timestampScoring: {
      timingToleranceSeconds,
      eligibleFieldName: 'vocal_timing_eligible_pct',
      resolvedFieldName: 'vocal_timing_resolved_pct',
      startFieldName: 'vocal_timing_start_pct',
      endFieldName: 'vocal_timing_end_pct',
      windowFieldName: 'vocal_timing_window_pct',
      blockedFieldName: 'vocal_timing_blocked_by_text_drift_pct'
    }
  });

  return {
    ...scoring,
    vocal_attribution_pct: scoreFieldResults(fieldResults, (result) => /^vocal_segments\[truth=\d+,output=\d+\]\.(performer|performer_id|delivery)$/.test(result.path))
  };
}

function normalizeTopLevelCount(value) {
  return Array.isArray(value) ? value.length : 0;
}

function countMissingTopLevelFamilies(outputData, familyKeys) {
  return familyKeys.filter((key) => !Object.prototype.hasOwnProperty.call(outputData || {}, key)).length;
}

function scoreFieldResults(fieldResults, predicate) {
  const relevant = fieldResults.filter((result) => predicate(result) && (result.status === 'pass' || result.status === 'fail' || result.status === 'error'));
  if (relevant.length === 0) {
    return 0;
  }
  const passed = relevant.filter((result) => result.status === 'pass').length;
  return roundPct((passed / relevant.length) * 100);
}

function buildArtifactScoring(comparatorConfig, truthData, outputData, fieldResults) {
  const comparatorProfile = typeof comparatorConfig === 'string' ? comparatorConfig : comparatorConfig?.profile;
  const timingToleranceSeconds = Number.isFinite(comparatorConfig?.resolvedOptions?.timingToleranceSeconds)
    ? comparatorConfig.resolvedOptions.timingToleranceSeconds
    : DEFAULT_TIMING_TOLERANCE_SECONDS;

  if (comparatorProfile === 'dialogue-default') {
    return { dialogueScoring: buildDialogueScoring(truthData, outputData) };
  }

  if (comparatorProfile === 'dialogue-timestamps-default') {
    return { dialogueTimestampScoring: buildDialogueTimestampScoring(truthData, outputData, timingToleranceSeconds) };
  }

  if (comparatorProfile === 'music-default') {
    return {
      musicScoring: {
        music_segment_timeline_pct: scoreFieldResults(fieldResults, (result) => result.path === 'segments'
          || /^segments\[\d+\]$/.test(result.path)
          || /^segments\[\d+\]\.(start|end|type)$/.test(result.path)),
        music_segment_content_pct: scoreFieldResults(fieldResults, (result) => /^segments\[\d+\]\.(description|mood|intensity)$/.test(result.path)),
        music_summary_pct: scoreFieldResults(fieldResults, (result) => result.path === 'summary'),
        recognized_song_identity_pct: scoreFieldResults(fieldResults, (result) => /^recognizedSong\.(status|confidence|multipleSongsDetected)$/.test(result.path)
          || /^recognizedSong\.candidates\[\d+\]\.(title|artist|confidence)$/.test(result.path)),
        recognized_song_support_pct: scoreFieldResults(fieldResults, (result) => /^recognizedSong\.candidates\[\d+\]\.(evidence|matchedLyrics|timeRanges)(\[.*\]|\..*)?$/.test(result.path)
          || /^recognizedSong\.(primaryEvidence|ambiguity)$/.test(result.path)
          || /^recognitionNotes\[\d+\]$/.test(result.path)),
        truth_segment_count: normalizeTopLevelCount(truthData?.segments),
        output_segment_count: normalizeTopLevelCount(outputData?.segments),
        missing_truth_segment_count: Math.max(0, normalizeTopLevelCount(truthData?.segments) - normalizeTopLevelCount(outputData?.segments)),
        extra_output_segment_count: Math.max(0, normalizeTopLevelCount(outputData?.segments) - normalizeTopLevelCount(truthData?.segments)),
        alignment_strategy: 'time-aware-segments'
      }
    };
  }

  if (comparatorProfile === 'music-vocals-default') {
    return { musicVocalsScoring: buildMusicVocalsScoring(truthData, outputData, fieldResults) };
  }

  if (comparatorProfile === 'music-vocals-timestamps-default') {
    return { musicVocalsTimestampScoring: buildMusicVocalsTimestampScoring(truthData, outputData, fieldResults, timingToleranceSeconds) };
  }

  if (comparatorProfile === 'recommendation-default') {
    return {
      recommendationScoring: {
        recommendation_text_pct: scoreFieldResults(fieldResults, (result) => result.path === 'text'),
        recommendation_reasoning_pct: scoreFieldResults(fieldResults, (result) => result.path === 'reasoning'),
        recommendation_key_findings_pct: scoreFieldResults(fieldResults, (result) => result.path === 'keyFindings' || /^keyFindings\[\d+\]$/.test(result.path)),
        recommendation_suggestions_pct: scoreFieldResults(fieldResults, (result) => result.path === 'suggestions' || /^suggestions\[\d+\]$/.test(result.path)),
        recommendation_confidence_pct: scoreFieldResults(fieldResults, (result) => result.path === 'confidence'),
        key_findings_truth_count: normalizeTopLevelCount(truthData?.keyFindings),
        key_findings_output_count: normalizeTopLevelCount(outputData?.keyFindings),
        suggestions_truth_count: normalizeTopLevelCount(truthData?.suggestions),
        suggestions_output_count: normalizeTopLevelCount(outputData?.suggestions),
        list_alignment_strategy: 'index-or-fuzzy-item'
      }
    };
  }

  if (comparatorProfile === 'metrics-default') {
    return {
      metricsScoring: {
        metrics_summary_pct: scoreFieldResults(fieldResults, (result) => result.path.startsWith('summary.')),
        metrics_implementation_status_pct: scoreFieldResults(fieldResults, (result) => result.path.startsWith('implementationStatus.')),
        metrics_averages_pct: scoreFieldResults(fieldResults, (result) => result.path.startsWith('averages.')),
        metrics_peak_moments_pct: scoreFieldResults(fieldResults, (result) => result.path.startsWith('peakMoments.')),
        metrics_trends_pct: scoreFieldResults(fieldResults, (result) => result.path.startsWith('trends.')),
        friction_index_pct: scoreFieldResults(fieldResults, (result) => result.path === 'frictionIndex'),
        missing_metric_family_count: countMissingTopLevelFamilies(outputData, ['averages', 'peakMoments', 'trends'])
      }
    };
  }

  if (comparatorProfile === 'emotional-analysis-default') {
    return {
      emotionalAnalysisScoring: {
        emotional_summary_pct: scoreFieldResults(fieldResults, (result) => result.path.startsWith('summary.')),
        chunk_emotions_pct: scoreFieldResults(fieldResults, (result) => result.path === 'chunkAnalysis'
          || /^chunkAnalysis\[[^\]]+\](\..+)?$/.test(result.path)),
        emotional_arc_pct: scoreFieldResults(fieldResults, (result) => result.path.startsWith('emotionalArc.')),
        scroll_risk_timeline_pct: scoreFieldResults(fieldResults, (result) => result.path === 'scrollRiskTimeline'
          || /^scrollRiskTimeline\[\d+\](\..+)?$/.test(result.path)),
        critical_moments_pct: scoreFieldResults(fieldResults, (result) => result.path === 'criticalMoments'
          || /^criticalMoments\[\d+\](\..+)?$/.test(result.path)),
        emotional_implementation_status_pct: scoreFieldResults(fieldResults, (result) => result.path.startsWith('implementationStatus.')),
        missing_family_count: countMissingTopLevelFamilies(outputData, ['chunkAnalysis', 'emotionalArc', 'scrollRiskTimeline', 'criticalMoments']),
        truth_chunk_count: normalizeTopLevelCount(truthData?.chunkAnalysis),
        output_chunk_count: normalizeTopLevelCount(outputData?.chunkAnalysis),
        truth_critical_moment_count: normalizeTopLevelCount(truthData?.criticalMoments),
        output_critical_moment_count: normalizeTopLevelCount(outputData?.criticalMoments)
      }
    };
  }

  if (comparatorProfile === 'chunk-analysis-default') {
    return {
      chunkAnalysisScoring: {
        chunk_timeline_pct: scoreFieldResults(fieldResults, (result) => result.path === 'chunks'
          || /^chunks\[[^\]]+\]\.(startTime|endTime|status)$/.test(result.path)),
        chunk_summary_pct: scoreFieldResults(fieldResults, (result) => /^chunks\[[^\]]+\]\.summary$/.test(result.path)),
        chunk_emotion_scores_pct: scoreFieldResults(fieldResults, (result) => /^chunks\[[^\]]+\]\.emotions\.[^.]+\.score$/.test(result.path)),
        chunk_dominant_emotion_pct: scoreFieldResults(fieldResults, (result) => /^chunks\[[^\]]+\]\.dominant_emotion$/.test(result.path)),
        chunk_persona_contract_pct: scoreFieldResults(fieldResults, (result) => result.path.startsWith('persona.') || /^chunks\[[^\]]+\]\.persona\./.test(result.path)),
        truth_chunk_count: normalizeTopLevelCount(truthData?.chunks),
        output_chunk_count: normalizeTopLevelCount(outputData?.chunks),
        alignment_strategy: 'chunkIndex+splitIndex'
      }
    };
  }

  return {};
}

function formatPct(value) {
  return value === null || value === undefined ? 'n/a' : `${Number(value).toFixed(1)}%`;
}

function appendArtifactSpecificMarkdown(lines, artifact) {
  if (artifact.dialogueScoring) {
    lines.push(`  - dialogue_text_full_transcript_pct=${formatPct(artifact.dialogueScoring.dialogue_text_full_transcript_pct)}`);
    lines.push(`  - dialogue_text_windowed_pct=${formatPct(artifact.dialogueScoring.dialogue_text_windowed_pct)}`);
    lines.push(`  - dialogue_boundary_pct=${formatPct(artifact.dialogueScoring.dialogue_boundary_pct)}`);
    lines.push(`  - splits=${artifact.dialogueScoring.split_event_count}, merges=${artifact.dialogueScoring.merge_event_count}, missingTruthWindows=${artifact.dialogueScoring.missing_truth_window_count}, extraOutputWindows=${artifact.dialogueScoring.extra_output_window_count}`);
  }
  if (artifact.dialogueTimestampScoring) {
    lines.push(`  - dialogue_text_full_transcript_pct=${formatPct(artifact.dialogueTimestampScoring.dialogue_text_full_transcript_pct)}`);
    lines.push(`  - dialogue_text_windowed_pct=${formatPct(artifact.dialogueTimestampScoring.dialogue_text_windowed_pct)}`);
    lines.push(`  - dialogue_boundary_pct=${formatPct(artifact.dialogueTimestampScoring.dialogue_boundary_pct)}`);
    lines.push(`  - dialogue_timing_eligible_pct=${formatPct(artifact.dialogueTimestampScoring.dialogue_timing_eligible_pct)}`);
    lines.push(`  - dialogue_timing_resolved_pct=${formatPct(artifact.dialogueTimestampScoring.dialogue_timing_resolved_pct)}`);
    lines.push(`  - dialogue_timing_start_pct=${formatPct(artifact.dialogueTimestampScoring.dialogue_timing_start_pct)}`);
    lines.push(`  - dialogue_timing_end_pct=${formatPct(artifact.dialogueTimestampScoring.dialogue_timing_end_pct)}`);
    lines.push(`  - dialogue_timing_window_pct=${formatPct(artifact.dialogueTimestampScoring.dialogue_timing_window_pct)}`);
    lines.push(`  - dialogue_timing_blocked_by_text_drift_pct=${formatPct(artifact.dialogueTimestampScoring.dialogue_timing_blocked_by_text_drift_pct)}`);
    lines.push(`  - splits=${artifact.dialogueTimestampScoring.split_event_count}, merges=${artifact.dialogueTimestampScoring.merge_event_count}, mixed=${artifact.dialogueTimestampScoring.mixed_resegmentation_count}, timingEligible=${artifact.dialogueTimestampScoring.timing_eligible_unit_count}, timingResolved=${artifact.dialogueTimestampScoring.timing_resolved_unit_count}, timingBlocked=${artifact.dialogueTimestampScoring.timing_blocked_by_text_drift_count}`);
  }
  if (artifact.musicScoring) {
    lines.push(`  - music_segment_timeline_pct=${formatPct(artifact.musicScoring.music_segment_timeline_pct)}`);
    lines.push(`  - music_segment_content_pct=${formatPct(artifact.musicScoring.music_segment_content_pct)}`);
    lines.push(`  - music_summary_pct=${formatPct(artifact.musicScoring.music_summary_pct)}`);
    lines.push(`  - recognized_song_identity_pct=${formatPct(artifact.musicScoring.recognized_song_identity_pct)}`);
    lines.push(`  - recognized_song_support_pct=${formatPct(artifact.musicScoring.recognized_song_support_pct)}`);
  }
  if (artifact.musicVocalsScoring) {
    lines.push(`  - vocal_text_full_transcript_pct=${formatPct(artifact.musicVocalsScoring.vocal_text_full_transcript_pct)}`);
    lines.push(`  - vocal_text_windowed_pct=${formatPct(artifact.musicVocalsScoring.vocal_text_windowed_pct)}`);
    lines.push(`  - vocal_boundary_pct=${formatPct(artifact.musicVocalsScoring.vocal_boundary_pct)}`);
    lines.push(`  - vocal_attribution_pct=${formatPct(artifact.musicVocalsScoring.vocal_attribution_pct)}`);
    lines.push(`  - recognized_song_identity_pct=${formatPct(artifact.musicVocalsScoring.recognized_song_identity_pct)}`);
    lines.push(`  - recognized_song_support_pct=${formatPct(artifact.musicVocalsScoring.recognized_song_support_pct)}`);
    lines.push(`  - splits=${artifact.musicVocalsScoring.split_event_count}, merges=${artifact.musicVocalsScoring.merge_event_count}, missingTruthWindows=${artifact.musicVocalsScoring.missing_truth_window_count}, extraOutputWindows=${artifact.musicVocalsScoring.extra_output_window_count}`);
  }
  if (artifact.musicVocalsTimestampScoring) {
    lines.push(`  - vocal_text_full_transcript_pct=${formatPct(artifact.musicVocalsTimestampScoring.vocal_text_full_transcript_pct)}`);
    lines.push(`  - vocal_text_windowed_pct=${formatPct(artifact.musicVocalsTimestampScoring.vocal_text_windowed_pct)}`);
    lines.push(`  - vocal_boundary_pct=${formatPct(artifact.musicVocalsTimestampScoring.vocal_boundary_pct)}`);
    lines.push(`  - vocal_timing_eligible_pct=${formatPct(artifact.musicVocalsTimestampScoring.vocal_timing_eligible_pct)}`);
    lines.push(`  - vocal_timing_resolved_pct=${formatPct(artifact.musicVocalsTimestampScoring.vocal_timing_resolved_pct)}`);
    lines.push(`  - vocal_timing_start_pct=${formatPct(artifact.musicVocalsTimestampScoring.vocal_timing_start_pct)}`);
    lines.push(`  - vocal_timing_end_pct=${formatPct(artifact.musicVocalsTimestampScoring.vocal_timing_end_pct)}`);
    lines.push(`  - vocal_timing_window_pct=${formatPct(artifact.musicVocalsTimestampScoring.vocal_timing_window_pct)}`);
    lines.push(`  - vocal_timing_blocked_by_text_drift_pct=${formatPct(artifact.musicVocalsTimestampScoring.vocal_timing_blocked_by_text_drift_pct)}`);
    lines.push(`  - vocal_attribution_pct=${formatPct(artifact.musicVocalsTimestampScoring.vocal_attribution_pct)}`);
    lines.push(`  - splits=${artifact.musicVocalsTimestampScoring.split_event_count}, merges=${artifact.musicVocalsTimestampScoring.merge_event_count}, mixed=${artifact.musicVocalsTimestampScoring.mixed_resegmentation_count}, timingEligible=${artifact.musicVocalsTimestampScoring.timing_eligible_unit_count}, timingResolved=${artifact.musicVocalsTimestampScoring.timing_resolved_unit_count}, timingBlocked=${artifact.musicVocalsTimestampScoring.timing_blocked_by_text_drift_count}`);
  }
  if (artifact.recommendationScoring) {
    lines.push(`  - recommendation_text_pct=${formatPct(artifact.recommendationScoring.recommendation_text_pct)}`);
    lines.push(`  - recommendation_reasoning_pct=${formatPct(artifact.recommendationScoring.recommendation_reasoning_pct)}`);
    lines.push(`  - recommendation_key_findings_pct=${formatPct(artifact.recommendationScoring.recommendation_key_findings_pct)}`);
    lines.push(`  - recommendation_suggestions_pct=${formatPct(artifact.recommendationScoring.recommendation_suggestions_pct)}`);
    lines.push(`  - recommendation_confidence_pct=${formatPct(artifact.recommendationScoring.recommendation_confidence_pct)}`);
  }
  if (artifact.metricsScoring) {
    lines.push(`  - metrics_summary_pct=${formatPct(artifact.metricsScoring.metrics_summary_pct)}`);
    lines.push(`  - metrics_implementation_status_pct=${formatPct(artifact.metricsScoring.metrics_implementation_status_pct)}`);
    lines.push(`  - metrics_averages_pct=${formatPct(artifact.metricsScoring.metrics_averages_pct)}`);
    lines.push(`  - metrics_peak_moments_pct=${formatPct(artifact.metricsScoring.metrics_peak_moments_pct)}`);
    lines.push(`  - metrics_trends_pct=${formatPct(artifact.metricsScoring.metrics_trends_pct)}`);
    lines.push(`  - friction_index_pct=${formatPct(artifact.metricsScoring.friction_index_pct)}`);
  }
  if (artifact.emotionalAnalysisScoring) {
    lines.push(`  - emotional_summary_pct=${formatPct(artifact.emotionalAnalysisScoring.emotional_summary_pct)}`);
    lines.push(`  - chunk_emotions_pct=${formatPct(artifact.emotionalAnalysisScoring.chunk_emotions_pct)}`);
    lines.push(`  - emotional_arc_pct=${formatPct(artifact.emotionalAnalysisScoring.emotional_arc_pct)}`);
    lines.push(`  - scroll_risk_timeline_pct=${formatPct(artifact.emotionalAnalysisScoring.scroll_risk_timeline_pct)}`);
    lines.push(`  - critical_moments_pct=${formatPct(artifact.emotionalAnalysisScoring.critical_moments_pct)}`);
    lines.push(`  - emotional_implementation_status_pct=${formatPct(artifact.emotionalAnalysisScoring.emotional_implementation_status_pct)}`);
  }
  if (artifact.chunkAnalysisScoring) {
    lines.push(`  - chunk_timeline_pct=${formatPct(artifact.chunkAnalysisScoring.chunk_timeline_pct)}`);
    lines.push(`  - chunk_summary_pct=${formatPct(artifact.chunkAnalysisScoring.chunk_summary_pct)}`);
    lines.push(`  - chunk_emotion_scores_pct=${formatPct(artifact.chunkAnalysisScoring.chunk_emotion_scores_pct)}`);
    lines.push(`  - chunk_dominant_emotion_pct=${formatPct(artifact.chunkAnalysisScoring.chunk_dominant_emotion_pct)}`);
    lines.push(`  - chunk_persona_contract_pct=${formatPct(artifact.chunkAnalysisScoring.chunk_persona_contract_pct)}`);
  }
}

function getArtifactComparisonDisplay(artifact) {
  const boundary = artifact.comparisonBoundary || {};
  if (boundary.comparisonMode === 'dual-dialogue-surface') {
    const roleLabel = boundary.reportSurface === 'primary'
      ? 'primary spoken benchmark'
      : boundary.reportSurface === 'diagnostic'
        ? 'diagnostic raw capture'
        : `${boundary.reportSurface || 'unclassified'} dialogue surface`;
    return `${artifact.label || artifact.artifactKey} [${roleLabel}]`;
  }
  return artifact.label || artifact.artifactKey;
}

function sortArtifactsForSummary(artifacts) {
  const reportSurfaceRank = { primary: 0, diagnostic: 1 };
  return [...artifacts].sort((left, right) => {
    const leftBoundary = left.comparisonBoundary || {};
    const rightBoundary = right.comparisonBoundary || {};
    const leftRank = Object.prototype.hasOwnProperty.call(reportSurfaceRank, leftBoundary.reportSurface) ? reportSurfaceRank[leftBoundary.reportSurface] : 9;
    const rightRank = Object.prototype.hasOwnProperty.call(reportSurfaceRank, rightBoundary.reportSurface) ? reportSurfaceRank[rightBoundary.reportSurface] : 9;
    if (leftRank !== rightRank) return leftRank - rightRank;
    return 0;
  });
}

function buildArtifactSummaryBits(artifactScoring) {
  const bits = [];
  if (artifactScoring.dialogueScoring) {
    bits.push(`dialogue_text_full_transcript_pct=${formatPct(artifactScoring.dialogueScoring.dialogue_text_full_transcript_pct)}`);
    bits.push(`dialogue_text_windowed_pct=${formatPct(artifactScoring.dialogueScoring.dialogue_text_windowed_pct)}`);
    bits.push(`dialogue_boundary_pct=${formatPct(artifactScoring.dialogueScoring.dialogue_boundary_pct)}`);
  }
  if (artifactScoring.dialogueTimestampScoring) {
    bits.push(`dialogue_text_full_transcript_pct=${formatPct(artifactScoring.dialogueTimestampScoring.dialogue_text_full_transcript_pct)}`);
    bits.push(`dialogue_text_windowed_pct=${formatPct(artifactScoring.dialogueTimestampScoring.dialogue_text_windowed_pct)}`);
    bits.push(`dialogue_boundary_pct=${formatPct(artifactScoring.dialogueTimestampScoring.dialogue_boundary_pct)}`);
    bits.push(`dialogue_timing_eligible_pct=${formatPct(artifactScoring.dialogueTimestampScoring.dialogue_timing_eligible_pct)}`);
    bits.push(`dialogue_timing_resolved_pct=${formatPct(artifactScoring.dialogueTimestampScoring.dialogue_timing_resolved_pct)}`);
    bits.push(`dialogue_timing_start_pct=${formatPct(artifactScoring.dialogueTimestampScoring.dialogue_timing_start_pct)}`);
    bits.push(`dialogue_timing_end_pct=${formatPct(artifactScoring.dialogueTimestampScoring.dialogue_timing_end_pct)}`);
    bits.push(`dialogue_timing_window_pct=${formatPct(artifactScoring.dialogueTimestampScoring.dialogue_timing_window_pct)}`);
    bits.push(`dialogue_timing_blocked_by_text_drift_pct=${formatPct(artifactScoring.dialogueTimestampScoring.dialogue_timing_blocked_by_text_drift_pct)}`);
  }
  if (artifactScoring.musicScoring) {
    bits.push(`music_segment_timeline_pct=${formatPct(artifactScoring.musicScoring.music_segment_timeline_pct)}`);
    bits.push(`music_segment_content_pct=${formatPct(artifactScoring.musicScoring.music_segment_content_pct)}`);
    bits.push(`music_summary_pct=${formatPct(artifactScoring.musicScoring.music_summary_pct)}`);
    bits.push(`recognized_song_identity_pct=${formatPct(artifactScoring.musicScoring.recognized_song_identity_pct)}`);
    bits.push(`recognized_song_support_pct=${formatPct(artifactScoring.musicScoring.recognized_song_support_pct)}`);
  }
  if (artifactScoring.musicVocalsScoring) {
    bits.push(`vocal_text_full_transcript_pct=${formatPct(artifactScoring.musicVocalsScoring.vocal_text_full_transcript_pct)}`);
    bits.push(`vocal_text_windowed_pct=${formatPct(artifactScoring.musicVocalsScoring.vocal_text_windowed_pct)}`);
    bits.push(`vocal_boundary_pct=${formatPct(artifactScoring.musicVocalsScoring.vocal_boundary_pct)}`);
    bits.push(`vocal_attribution_pct=${formatPct(artifactScoring.musicVocalsScoring.vocal_attribution_pct)}`);
    bits.push(`recognized_song_identity_pct=${formatPct(artifactScoring.musicVocalsScoring.recognized_song_identity_pct)}`);
    bits.push(`recognized_song_support_pct=${formatPct(artifactScoring.musicVocalsScoring.recognized_song_support_pct)}`);
  }
  if (artifactScoring.musicVocalsTimestampScoring) {
    bits.push(`vocal_text_full_transcript_pct=${formatPct(artifactScoring.musicVocalsTimestampScoring.vocal_text_full_transcript_pct)}`);
    bits.push(`vocal_text_windowed_pct=${formatPct(artifactScoring.musicVocalsTimestampScoring.vocal_text_windowed_pct)}`);
    bits.push(`vocal_boundary_pct=${formatPct(artifactScoring.musicVocalsTimestampScoring.vocal_boundary_pct)}`);
    bits.push(`vocal_timing_eligible_pct=${formatPct(artifactScoring.musicVocalsTimestampScoring.vocal_timing_eligible_pct)}`);
    bits.push(`vocal_timing_resolved_pct=${formatPct(artifactScoring.musicVocalsTimestampScoring.vocal_timing_resolved_pct)}`);
    bits.push(`vocal_timing_start_pct=${formatPct(artifactScoring.musicVocalsTimestampScoring.vocal_timing_start_pct)}`);
    bits.push(`vocal_timing_end_pct=${formatPct(artifactScoring.musicVocalsTimestampScoring.vocal_timing_end_pct)}`);
    bits.push(`vocal_timing_window_pct=${formatPct(artifactScoring.musicVocalsTimestampScoring.vocal_timing_window_pct)}`);
    bits.push(`vocal_timing_blocked_by_text_drift_pct=${formatPct(artifactScoring.musicVocalsTimestampScoring.vocal_timing_blocked_by_text_drift_pct)}`);
    bits.push(`vocal_attribution_pct=${formatPct(artifactScoring.musicVocalsTimestampScoring.vocal_attribution_pct)}`);
  }
  if (artifactScoring.recommendationScoring) {
    bits.push(`recommendation_text_pct=${formatPct(artifactScoring.recommendationScoring.recommendation_text_pct)}`);
    bits.push(`recommendation_reasoning_pct=${formatPct(artifactScoring.recommendationScoring.recommendation_reasoning_pct)}`);
    bits.push(`recommendation_key_findings_pct=${formatPct(artifactScoring.recommendationScoring.recommendation_key_findings_pct)}`);
    bits.push(`recommendation_suggestions_pct=${formatPct(artifactScoring.recommendationScoring.recommendation_suggestions_pct)}`);
    bits.push(`recommendation_confidence_pct=${formatPct(artifactScoring.recommendationScoring.recommendation_confidence_pct)}`);
  }
  if (artifactScoring.metricsScoring) {
    bits.push(`metrics_summary_pct=${formatPct(artifactScoring.metricsScoring.metrics_summary_pct)}`);
    bits.push(`metrics_implementation_status_pct=${formatPct(artifactScoring.metricsScoring.metrics_implementation_status_pct)}`);
    bits.push(`metrics_averages_pct=${formatPct(artifactScoring.metricsScoring.metrics_averages_pct)}`);
    bits.push(`metrics_peak_moments_pct=${formatPct(artifactScoring.metricsScoring.metrics_peak_moments_pct)}`);
    bits.push(`metrics_trends_pct=${formatPct(artifactScoring.metricsScoring.metrics_trends_pct)}`);
    bits.push(`friction_index_pct=${formatPct(artifactScoring.metricsScoring.friction_index_pct)}`);
  }
  if (artifactScoring.emotionalAnalysisScoring) {
    bits.push(`emotional_summary_pct=${formatPct(artifactScoring.emotionalAnalysisScoring.emotional_summary_pct)}`);
    bits.push(`chunk_emotions_pct=${formatPct(artifactScoring.emotionalAnalysisScoring.chunk_emotions_pct)}`);
    bits.push(`emotional_arc_pct=${formatPct(artifactScoring.emotionalAnalysisScoring.emotional_arc_pct)}`);
    bits.push(`scroll_risk_timeline_pct=${formatPct(artifactScoring.emotionalAnalysisScoring.scroll_risk_timeline_pct)}`);
    bits.push(`critical_moments_pct=${formatPct(artifactScoring.emotionalAnalysisScoring.critical_moments_pct)}`);
    bits.push(`emotional_implementation_status_pct=${formatPct(artifactScoring.emotionalAnalysisScoring.emotional_implementation_status_pct)}`);
  }
  if (artifactScoring.chunkAnalysisScoring) {
    bits.push(`chunk_timeline_pct=${formatPct(artifactScoring.chunkAnalysisScoring.chunk_timeline_pct)}`);
    bits.push(`chunk_summary_pct=${formatPct(artifactScoring.chunkAnalysisScoring.chunk_summary_pct)}`);
    bits.push(`chunk_emotion_scores_pct=${formatPct(artifactScoring.chunkAnalysisScoring.chunk_emotion_scores_pct)}`);
    bits.push(`chunk_dominant_emotion_pct=${formatPct(artifactScoring.chunkAnalysisScoring.chunk_dominant_emotion_pct)}`);
    bits.push(`chunk_persona_contract_pct=${formatPct(artifactScoring.chunkAnalysisScoring.chunk_persona_contract_pct)}`);
  }
  return bits;
}

function alignItemsByScore(truthItems, outputItems, scoreCandidate) {
  const candidates = [];
  for (let truthIndex = 0; truthIndex < truthItems.length; truthIndex += 1) {
    for (let outputIndex = 0; outputIndex < outputItems.length; outputIndex += 1) {
      const candidate = scoreCandidate(truthItems[truthIndex], outputItems[outputIndex], truthIndex, outputIndex);
      if (candidate && Number.isFinite(candidate.score) && candidate.score > 0) {
        candidates.push({
          truthIndex,
          outputIndex,
          ...candidate
        });
      }
    }
  }

  candidates.sort((left, right) => {
    if (right.score !== left.score) {
      return right.score - left.score;
    }
    if (left.truthIndex !== right.truthIndex) {
      return left.truthIndex - right.truthIndex;
    }
    return left.outputIndex - right.outputIndex;
  });

  const usedTruthIndexes = new Set();
  const usedOutputIndexes = new Set();
  const matches = [];

  for (const candidate of candidates) {
    if (usedTruthIndexes.has(candidate.truthIndex) || usedOutputIndexes.has(candidate.outputIndex)) {
      continue;
    }
    usedTruthIndexes.add(candidate.truthIndex);
    usedOutputIndexes.add(candidate.outputIndex);
    matches.push(candidate);
  }

  return {
    matches,
    unmatchedTruthIndexes: truthItems.map((_, index) => index).filter((index) => !usedTruthIndexes.has(index)),
    unmatchedOutputIndexes: outputItems.map((_, index) => index).filter((index) => !usedOutputIndexes.has(index))
  };
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

function validateIgnorePaths(ignorePaths, label) {
  if (!Array.isArray(ignorePaths) || ignorePaths.some((value) => typeof value !== 'string' || value.trim().length === 0)) {
    throw new Error(`Invalid ignorePaths for ${label}`);
  }
}

function normalizeIgnorePaths(ignorePaths = []) {
  return [...new Set(ignorePaths.map((value) => value.trim()))];
}

function normalizePosturePaths(paths = []) {
  return [...new Set(paths.map((value) => String(value || '').trim()).filter(Boolean))];
}

function normalizePostureComparablePath(pathString) {
  return normalizeComparablePath(String(pathString || ''))
    .replace(/\[[^\]]+\]/g, '[*]')
    .replace(/\.\[\*\]/g, '[*]');
}

function posturePathMatches(pathString, candidatePath) {
  const normalizedPath = normalizePostureComparablePath(pathString);
  const normalizedCandidate = normalizePostureComparablePath(candidatePath);
  if (!normalizedCandidate) {
    return false;
  }

  return normalizedPath === normalizedCandidate
    || normalizedPath.startsWith(`${normalizedCandidate}.`)
    || normalizedPath.startsWith(`${normalizedCandidate}[*]`);
}

function getProfileDefaultIgnorePaths(profile) {
  return Array.isArray(PROFILE_DEFAULT_IGNORE_PATHS[profile])
    ? [...PROFILE_DEFAULT_IGNORE_PATHS[profile]]
    : [];
}

function extractTruthBenchmarkDirectives(truthData, artifact, truthAbsolutePath) {
  if (!isPlainObject(truthData) || !Object.prototype.hasOwnProperty.call(truthData, '_benchmark')) {
    return {
      truthData,
      directives: {
        ignorePaths: []
      }
    };
  }

  const benchmarkDirectives = truthData._benchmark;
  if (!isPlainObject(benchmarkDirectives)) {
    throw new Error(`Invalid _benchmark block for ${artifact.artifactKey}: ${truthAbsolutePath}`);
  }

  const supportedDirectiveKeys = new Set(['ignorePaths']);
  for (const key of Object.keys(benchmarkDirectives)) {
    if (!supportedDirectiveKeys.has(key)) {
      throw new Error(`Unsupported _benchmark directive "${key}" for ${artifact.artifactKey}: ${truthAbsolutePath}`);
    }
  }

  const ignorePaths = benchmarkDirectives.ignorePaths || [];
  validateIgnorePaths(ignorePaths, `${artifact.artifactKey} truth _benchmark.ignorePaths`);

  const sanitizedTruthData = { ...truthData };
  delete sanitizedTruthData._benchmark;

  return {
    truthData: sanitizedTruthData,
    directives: {
      ignorePaths: normalizeIgnorePaths(ignorePaths)
    }
  };
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

function getTimeAwareArrayAlignmentConfig(pathString, comparator) {
  const comparablePath = normalizeComparablePath(pathString);
  if ((comparator.profile === 'dialogue-default' || comparator.profile === 'dialogue-timestamps-default') && comparablePath === 'dialogue_segments') {
    return {
      kind: 'time-aware-segments',
      label: 'dialogue_segments'
    };
  }

  if ((comparator.profile === 'music-vocals-default' || comparator.profile === 'music-vocals-timestamps-default') && comparablePath === 'vocal_segments') {
    return {
      kind: 'time-aware-segments',
      label: 'vocal_segments'
    };
  }

  return null;
}

function getSegmentTiming(item) {
  if (!isPlainObject(item) || !Number.isFinite(item.start) || !Number.isFinite(item.end)) {
    return null;
  }

  const start = Number(item.start);
  const end = Number(item.end);
  const normalizedEnd = end >= start ? end : start;
  return {
    start,
    end: normalizedEnd,
    center: (start + normalizedEnd) / 2,
    duration: Math.max(normalizedEnd - start, 0)
  };
}

function getSegmentChronologyIndex(item, fallbackIndex) {
  if (isPlainObject(item) && Number.isFinite(item.index)) {
    return Number(item.index);
  }
  return fallbackIndex;
}

function scoreTimeAwareSegmentCandidate(truthItem, outputItem, truthIndex, outputIndex, comparator) {
  const truthTiming = getSegmentTiming(truthItem);
  const outputTiming = getSegmentTiming(outputItem);

  if (truthTiming && outputTiming) {
    const overlapStart = Math.max(truthTiming.start, outputTiming.start);
    const overlapEnd = Math.min(truthTiming.end, outputTiming.end);
    const overlapSeconds = Math.max(0, overlapEnd - overlapStart);
    const unionSeconds = Math.max(truthTiming.end, outputTiming.end) - Math.min(truthTiming.start, outputTiming.start);
    const overlapRatio = unionSeconds > 0 ? overlapSeconds / unionSeconds : 0;
    const centerDelta = Math.abs(truthTiming.center - outputTiming.center);
    const startDelta = Math.abs(truthTiming.start - outputTiming.start);
    const endDelta = Math.abs(truthTiming.end - outputTiming.end);
    const indexDelta = Math.abs(truthIndex - outputIndex);
    const searchWindowSeconds = Math.max(comparator.resolvedOptions.timingToleranceSeconds * 4, 6);
    const eligible = overlapSeconds > 0 || centerDelta <= searchWindowSeconds || startDelta <= searchWindowSeconds || endDelta <= searchWindowSeconds;
    if (!eligible) {
      return null;
    }

    const score = 1000 + (overlapRatio * 1000) + (overlapSeconds * 50) - (centerDelta * 20) - (startDelta * 5) - (endDelta * 2) - indexDelta;
    if (score <= 0) {
      return null;
    }

    return {
      score,
      overlapSeconds,
      overlapRatio,
      centerDelta,
      startDelta,
      endDelta,
      indexDelta,
      searchWindowSeconds,
      truthTiming,
      outputTiming
    };
  }

  const truthChronologyIndex = getSegmentChronologyIndex(truthItem, truthIndex);
  const outputChronologyIndex = getSegmentChronologyIndex(outputItem, outputIndex);
  const chronologyDelta = Math.abs(truthChronologyIndex - outputChronologyIndex);
  const chronologyWindow = Math.max(Math.round(comparator.resolvedOptions.timingToleranceSeconds) + 2, 3);
  if (chronologyDelta > chronologyWindow) {
    return null;
  }

  const indexDelta = Math.abs(truthIndex - outputIndex);
  const score = 1000 - (chronologyDelta * 80) - (indexDelta * 10);
  if (score <= 0) {
    return null;
  }

  return {
    score,
    overlapSeconds: null,
    overlapRatio: null,
    centerDelta: null,
    startDelta: null,
    endDelta: null,
    indexDelta,
    searchWindowSeconds: null,
    truthTiming,
    outputTiming,
    chronologyDelta,
    chronologyWindow,
    truthChronologyIndex,
    outputChronologyIndex
  };
}

function alignTimeAwareSegments(truthValue, outputValue, comparator) {
  const truthCount = truthValue.length;
  const outputCount = outputValue.length;
  const dp = Array.from({ length: truthCount + 1 }, () => Array(outputCount + 1).fill(0));
  const steps = Array.from({ length: truthCount + 1 }, () => Array(outputCount + 1).fill(null));
  const candidates = Array.from({ length: truthCount }, () => Array(outputCount).fill(null));

  for (let i = 0; i < truthCount; i += 1) {
    for (let j = 0; j < outputCount; j += 1) {
      candidates[i][j] = scoreTimeAwareSegmentCandidate(truthValue[i], outputValue[j], i, j, comparator);
    }
  }

  for (let i = truthCount; i >= 0; i -= 1) {
    for (let j = outputCount; j >= 0; j -= 1) {
      if (i === truthCount && j === outputCount) {
        continue;
      }

      let bestScore = Number.NEGATIVE_INFINITY;
      let bestStep = null;

      if (i < truthCount) {
        const candidateScore = dp[i + 1][j];
        if (candidateScore > bestScore) {
          bestScore = candidateScore;
          bestStep = { kind: 'skip-truth' };
        }
      }

      if (j < outputCount) {
        const candidateScore = dp[i][j + 1];
        if (candidateScore > bestScore) {
          bestScore = candidateScore;
          bestStep = { kind: 'skip-output' };
        }
      }

      if (i < truthCount && j < outputCount && candidates[i][j]) {
        const candidateScore = candidates[i][j].score + dp[i + 1][j + 1];
        if (candidateScore > bestScore) {
          bestScore = candidateScore;
          bestStep = { kind: 'match', candidate: candidates[i][j] };
        }
      }

      dp[i][j] = Number.isFinite(bestScore) ? bestScore : 0;
      steps[i][j] = bestStep;
    }
  }

  const matches = [];
  const unmatchedTruthIndexes = [];
  const unmatchedOutputIndexes = [];
  let i = 0;
  let j = 0;
  while (i < truthCount || j < outputCount) {
    const step = steps[i][j];
    if (!step) break;

    if (step.kind === 'match') {
      matches.push({
        truthIndex: i,
        outputIndex: j,
        score: step.candidate.score,
        overlapSeconds: step.candidate.overlapSeconds,
        overlapRatio: step.candidate.overlapRatio,
        centerDelta: step.candidate.centerDelta,
        startDelta: step.candidate.startDelta,
        endDelta: step.candidate.endDelta,
        indexDelta: step.candidate.indexDelta,
        searchWindowSeconds: step.candidate.searchWindowSeconds,
        truthTiming: step.candidate.truthTiming,
        outputTiming: step.candidate.outputTiming
      });
      i += 1;
      j += 1;
      continue;
    }

    if (step.kind === 'skip-truth') {
      unmatchedTruthIndexes.push(i);
      i += 1;
      continue;
    }

    if (step.kind === 'skip-output') {
      unmatchedOutputIndexes.push(j);
      j += 1;
      continue;
    }
  }

  while (i < truthCount) {
    unmatchedTruthIndexes.push(i);
    i += 1;
  }
  while (j < outputCount) {
    unmatchedOutputIndexes.push(j);
    j += 1;
  }

  return {
    matches,
    unmatchedTruthIndexes,
    unmatchedOutputIndexes,
    totalScore: dp[0][0]
  };
}

function createComparator(artifact, directives = {}) {
  if (artifact.comparator.kind !== 'json-structured') {
    throw new Error(`Unsupported comparator kind: ${artifact.comparator.kind}`);
  }

  const supportedProfiles = new Set(['dialogue-default', 'dialogue-timestamps-default', 'music-default', 'music-vocals-default', 'music-vocals-timestamps-default', 'recommendation-default', 'chunk-analysis-default', 'metrics-default', 'emotional-analysis-default']);
  if (!supportedProfiles.has(artifact.comparator.profile)) {
    throw new Error(`Unsupported comparator profile for MVP: ${artifact.comparator.profile}`);
  }

  const comparatorIgnorePaths = artifact.comparator.options?.ignorePaths || [];
  const truthIgnorePaths = directives.ignorePaths || [];
  const profileDefaultIgnorePaths = getProfileDefaultIgnorePaths(artifact.comparator.profile);
  validateIgnorePaths(comparatorIgnorePaths, `${artifact.artifactKey} comparator options`);
  validateIgnorePaths(truthIgnorePaths, `${artifact.artifactKey} truth directives`);

  const rawComparatorOptions = artifact.comparator.options || {};
  const posture = rawComparatorOptions.posture === undefined ? null : rawComparatorOptions.posture;
  const resolvedOptions = {
    timingToleranceSeconds: DEFAULT_TIMING_TOLERANCE_SECONDS,
    numericTolerance: DEFAULT_NUMERIC_TOLERANCE,
    unknownSentinels: [...DEFAULT_UNKNOWN_SENTINELS],
    ignorePaths: [],
    posture: null,
    ...rawComparatorOptions,
    ignorePaths: normalizeIgnorePaths([...profileDefaultIgnorePaths, ...comparatorIgnorePaths, ...truthIgnorePaths]),
    posture
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

  validateIgnorePaths(resolvedOptions.ignorePaths, artifact.artifactKey);

  if (resolvedOptions.posture !== null) {
    if (!isPlainObject(resolvedOptions.posture)) {
      throw new Error(`Invalid posture for ${artifact.artifactKey}`);
    }

    if (resolvedOptions.posture.kind !== 'phase1-dialogue-provisional') {
      throw new Error(`Unsupported posture kind for ${artifact.artifactKey}: ${resolvedOptions.posture.kind}`);
    }

    const deferredContractPaths = normalizePosturePaths(resolvedOptions.posture.deferredContractPaths || []);
    resolvedOptions.posture = {
      kind: resolvedOptions.posture.kind,
      deferredContractPaths
    };
  }

  return {
    kind: artifact.comparator.kind,
    profile: artifact.comparator.profile,
    resolvedOptions,
    directives: {
      comparatorIgnorePaths: normalizeIgnorePaths(comparatorIgnorePaths),
      truthIgnorePaths: normalizeIgnorePaths(truthIgnorePaths),
      effectiveIgnorePaths: [...resolvedOptions.ignorePaths]
    }
  };
}

function compareArtifact({ artifact, comparator, truthData, outputData, truthPath, outputPath, fixtureId, benchmarkPath, comparisonBoundary = null }) {
  const fieldResults = [];
  const failures = [];
  const skips = [];
  const errors = [];
  const ignoredDifferences = [];
  const alignments = [];
  const comparatorState = {
    dialogueSegmentTruthToOutput: new Map(),
    dialogueSegmentOutputToTruth: new Map()
  };

  let hardError = null;

  function classifyMismatch(pathString) {
    const posture = comparator.resolvedOptions.posture;
    if (!posture) {
      return null;
    }

    if (posture.kind === 'phase1-dialogue-provisional') {
      const deferredPaths = posture.deferredContractPaths || [];
      if (deferredPaths.some((candidatePath) => posturePathMatches(pathString, candidatePath))) {
        return 'deferred_contract_drift';
      }

      if (comparisonBoundary?.outputSurface === 'raw') {
        return 'provisional_raw_dialogue_drift';
      }

      if (comparisonBoundary?.outputSurface === 'reconciled') {
        return 'reconciled_post_processing_contract_mismatch';
      }
    }

    return null;
  }

  function summarizeMismatchClassifications(results) {
    return results.reduce((acc, result) => {
      const classification = result.classification;
      if (!classification) {
        return acc;
      }
      acc[classification] = (acc[classification] || 0) + 1;
      return acc;
    }, {});
  }

  function pushFieldResult(result) {
    const classification = result.status === 'fail' || result.status === 'error'
      ? classifyMismatch(result.path)
      : null;
    const resultWithClassification = classification ? { ...result, classification } : result;
    fieldResults.push(resultWithClassification);
    if (resultWithClassification.status === 'fail') {
      failures.push({
        path: resultWithClassification.path,
        rule: resultWithClassification.rule,
        truthValue: resultWithClassification.truthValue,
        outputValue: resultWithClassification.outputValue,
        reason: resultWithClassification.reason || null,
        ...(classification ? { classification } : {})
      });
    } else if (resultWithClassification.status === 'skip') {
      skips.push({
        path: resultWithClassification.path,
        truthValue: resultWithClassification.truthValue,
        reason: resultWithClassification.reason || 'Explicit truth sentinel'
      });
    } else if (resultWithClassification.status === 'error') {
      errors.push({
        path: resultWithClassification.path,
        rule: resultWithClassification.rule,
        truthValue: resultWithClassification.truthValue,
        outputValue: resultWithClassification.outputValue,
        reason: resultWithClassification.reason || 'Comparator error',
        ...(classification ? { classification } : {})
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

  function emitIgnoredSubtree(pathString, truthValue, outputValue, reason = 'Comparator ignored benchmark path') {
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

  function emitIgnoredDifference(pathString, reason, truthValue, outputValue) {
    ignoredDifferences.push({
      path: pathString,
      truthValue,
      outputValue,
      reason
    });
  }

  function collectIgnoredDifferences(pathString, truthValue, outputValue) {
    if (Array.isArray(truthValue)) {
      if (!Array.isArray(outputValue)) {
        emitIgnoredDifference(pathString, 'Ignored path output shape mismatch: expected array', truthValue, outputValue);
        return;
      }

      if (truthValue.length != outputValue.length) {
        emitIgnoredDifference(pathString, `Ignored path array length mismatch: truth=${truthValue.length} output=${outputValue.length}`, { length: truthValue.length }, { length: outputValue.length });
      }

      const maxLength = Math.max(truthValue.length, outputValue.length);
      for (let i = 0; i < maxLength; i += 1) {
        const childPath = `${pathString}[${i}]`;
        if (i >= truthValue.length) {
          emitIgnoredDifference(childPath, 'Ignored path contains extra output item', undefined, outputValue[i]);
          continue;
        }
        if (i >= outputValue.length) {
          emitIgnoredDifference(childPath, 'Ignored path is missing output item', truthValue[i], undefined);
          continue;
        }
        collectIgnoredDifferences(childPath, truthValue[i], outputValue[i]);
      }
      return;
    }

    if (isPlainObject(truthValue)) {
      if (!isPlainObject(outputValue)) {
        emitIgnoredDifference(pathString, 'Ignored path output shape mismatch: expected object', truthValue, outputValue);
        return;
      }

      const truthKeys = new Set(Object.keys(truthValue));
      const outputKeys = new Set(Object.keys(outputValue));

      for (const key of outputKeys) {
        if (!truthKeys.has(key)) {
          emitIgnoredDifference(pathString === '$' ? key : `${pathString}.${key}`, 'Ignored path contains extra output field', undefined, outputValue[key]);
        }
      }

      for (const key of truthKeys) {
        const childPath = pathString === '$' ? key : `${pathString}.${key}`;
        if (!outputKeys.has(key)) {
          emitIgnoredDifference(childPath, 'Ignored path is missing output field', truthValue[key], undefined);
          continue;
        }
        collectIgnoredDifferences(childPath, truthValue[key], outputValue[key]);
      }
      return;
    }

    if (truthValue !== outputValue) {
      emitIgnoredDifference(pathString, 'Ignored path values differed', truthValue, outputValue);
    }
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

  function compareTimeAwareSegmentArray(pathString, truthValue, outputValue, alignmentConfig) {
    const alignment = alignTimeAwareSegments(truthValue, outputValue, comparator);
    const outputTimings = outputValue.map((item) => getSegmentTiming(item));
    const truthTimings = truthValue.map((item) => getSegmentTiming(item));
    const searchWindowSeconds = Math.max(comparator.resolvedOptions.timingToleranceSeconds * 4, 6);

    if (alignmentConfig.label === 'dialogue_segments') {
      comparatorState.dialogueSegmentTruthToOutput = new Map(alignment.matches.map((entry) => [entry.truthIndex, entry.outputIndex]));
      comparatorState.dialogueSegmentOutputToTruth = new Map(alignment.matches.map((entry) => [entry.outputIndex, entry.truthIndex]));
    }

    const inferSuspicion = (kind, index) => {
      if (kind === 'truth') {
        const timing = truthTimings[index];
        if (!timing) return null;
        const nearbyUnmatchedOutputs = alignment.unmatchedOutputIndexes.filter((outputIndex) => {
          const outputTiming = outputTimings[outputIndex];
          if (!outputTiming) return false;
          return Math.abs(outputTiming.center - timing.center) <= searchWindowSeconds;
        });
        if (nearbyUnmatchedOutputs.length >= 2) {
          return 'possible truth segment split across multiple output segments';
        }
        const nearbyMatchedOutputs = alignment.matches.filter((entry) => {
          const outputTiming = outputTimings[entry.outputIndex];
          if (!outputTiming) return false;
          return Math.abs(outputTiming.center - timing.center) <= searchWindowSeconds;
        });
        if (nearbyMatchedOutputs.length >= 1 && nearbyUnmatchedOutputs.length >= 1) {
          return 'possible merged/split neighborhood around matched output segment';
        }
        return null;
      }

      const timing = outputTimings[index];
      if (!timing) return null;
      const nearbyUnmatchedTruth = alignment.unmatchedTruthIndexes.filter((truthIndex) => {
        const truthTiming = truthTimings[truthIndex];
        if (!truthTiming) return false;
        return Math.abs(truthTiming.center - timing.center) <= searchWindowSeconds;
      });
      if (nearbyUnmatchedTruth.length >= 2) {
        return 'possible output segment merged across multiple truth segments';
      }
      const nearbyMatchedTruth = alignment.matches.filter((entry) => {
        const truthTiming = truthTimings[entry.truthIndex];
        if (!truthTiming) return false;
        return Math.abs(truthTiming.center - timing.center) <= searchWindowSeconds;
      });
      if (nearbyMatchedTruth.length >= 1 && nearbyUnmatchedTruth.length >= 1) {
        return 'possible merged/split neighborhood around matched truth segment';
      }
      return null;
    };

    if (truthValue.length !== outputValue.length) {
      pushFieldResult({
        path: pathString,
        status: 'fail',
        rule: 'structural',
        truthValue: { length: truthValue.length },
        outputValue: { length: outputValue.length },
        reason: `Array length mismatch: truth=${truthValue.length} output=${outputValue.length}`
      });
    }

    alignments.push({
      path: pathString,
      strategy: alignmentConfig.kind,
      matches: alignment.matches.map((entry) => ({
        truthIndex: entry.truthIndex,
        outputIndex: entry.outputIndex,
        overlapSeconds: entry.overlapSeconds,
        overlapRatio: entry.overlapRatio,
        centerDelta: entry.centerDelta,
        startDelta: entry.startDelta,
        endDelta: entry.endDelta,
        indexDelta: entry.indexDelta,
        score: entry.score
      })),
      unmatchedTruth: alignment.unmatchedTruthIndexes.map((truthIndex) => ({
        truthIndex,
        reason: inferSuspicion('truth', truthIndex) || 'no plausible time-aware output match',
        segment: truthValue[truthIndex]
      })),
      unmatchedOutput: alignment.unmatchedOutputIndexes.map((outputIndex) => ({
        outputIndex,
        reason: inferSuspicion('output', outputIndex) || 'no plausible time-aware truth match',
        segment: outputValue[outputIndex]
      }))
    });

    for (const entry of alignment.matches) {
      walk(`${pathString}[truth=${entry.truthIndex},output=${entry.outputIndex}]`, truthValue[entry.truthIndex], outputValue[entry.outputIndex]);
    }

    for (const truthIndex of alignment.unmatchedTruthIndexes) {
      pushFieldResult({
        path: `${pathString}[truth=${truthIndex}]`,
        status: 'fail',
        rule: 'structural',
        truthValue: truthValue[truthIndex],
        outputValue: undefined,
        reason: inferSuspicion('truth', truthIndex) || 'Unmatched truth segment: no plausible time-aware output match'
      });
    }

    for (const outputIndex of alignment.unmatchedOutputIndexes) {
      pushFieldResult({
        path: `${pathString}[output=${outputIndex}]`,
        status: 'fail',
        rule: 'structural',
        truthValue: undefined,
        outputValue: outputValue[outputIndex],
        reason: inferSuspicion('output', outputIndex) || 'Unmatched output segment: no plausible time-aware truth match'
      });
    }
  }

  function toComparableProfileCoverage(profile, side) {
    const linkedIndexes = Array.isArray(profile?.grounded?.linked_segment_indexes) ? profile.grounded.linked_segment_indexes : [];
    return linkedIndexes
      .filter((index) => Number.isInteger(index))
      .map((index) => {
        if (side === 'truth') {
          if (comparatorState.dialogueSegmentTruthToOutput.has(index)) {
            return `output=${comparatorState.dialogueSegmentTruthToOutput.get(index)}`;
          }
          return `truth-only=${index}`;
        }

        return `output=${index}`;
      });
  }

  function compareLinkedSegmentIndexArray(pathString, truthValue, outputValue) {
    const truthRefs = truthValue
      .filter((index) => Number.isInteger(index))
      .map((index) => comparatorState.dialogueSegmentTruthToOutput.has(index) ? `output=${comparatorState.dialogueSegmentTruthToOutput.get(index)}` : `truth-only=${index}`);
    const outputRefs = outputValue
      .filter((index) => Number.isInteger(index))
      .map((index) => `output=${index}`);

    if (truthRefs.length !== outputRefs.length) {
      pushFieldResult({
        path: pathString,
        status: 'fail',
        rule: 'structural',
        truthValue: { length: truthRefs.length, refs: truthRefs },
        outputValue: { length: outputRefs.length, refs: outputRefs },
        reason: `Linked segment coverage mismatch: truth=${truthRefs.length} output=${outputRefs.length}`
      });
    }

    const truthSet = new Set(truthRefs);
    const outputSet = new Set(outputRefs);

    for (const truthRef of truthRefs) {
      pushFieldResult({
        path: `${pathString}[${truthRef}]`,
        status: outputSet.has(truthRef) ? 'pass' : 'fail',
        rule: 'speaker-profile-linked-segments',
        truthValue: truthRef,
        outputValue: outputSet.has(truthRef) ? truthRef : undefined,
        ...(outputSet.has(truthRef) ? {} : { reason: 'Matched speaker profile did not preserve grounded segment coverage' })
      });
    }

    for (const outputRef of outputRefs) {
      if (truthSet.has(outputRef)) {
        continue;
      }
      pushFieldResult({
        path: `${pathString}[${outputRef}]`,
        status: 'fail',
        rule: 'speaker-profile-linked-segments',
        truthValue: undefined,
        outputValue: outputRef,
        reason: 'Matched speaker profile claimed extra grounded segment coverage'
      });
    }
  }

  function compareUnorderedFuzzySupportArray(pathString, truthValue, outputValue, options = {}) {
    const minimumSimilarity = options.minimumSimilarity || 0.5;
    const rule = options.rule || 'fuzzy-support-list';
    const allowExtraOutput = options.allowExtraOutput === true;
    const missingTruthReason = options.missingTruthReason || 'Missing supported item in output list';
    const extraOutputReason = options.extraOutputReason || 'Extra unsupported item in output list';
    const alignment = alignItemsByScore(truthValue, outputValue, (truthItem, outputItem, truthIndex, outputIndex) => {
      if (typeof truthItem !== 'string' || typeof outputItem !== 'string') {
        return null;
      }
      const similarity = scoreTokenOverlap(truthItem, outputItem);
      if (similarity < minimumSimilarity) {
        return null;
      }
      return {
        score: similarity * 1000 - Math.abs(truthIndex - outputIndex),
        similarity
      };
    });

    if (!allowExtraOutput && truthValue.length !== outputValue.length) {
      pushFieldResult({
        path: pathString,
        status: 'fail',
        rule: 'structural',
        truthValue: { length: truthValue.length },
        outputValue: { length: outputValue.length },
        reason: `Array length mismatch: truth=${truthValue.length} output=${outputValue.length}`
      });
    }

    alignments.push({
      path: pathString,
      strategy: rule,
      minimumSimilarity,
      allowExtraOutput,
      matches: alignment.matches.map((entry) => ({
        truthIndex: entry.truthIndex,
        outputIndex: entry.outputIndex,
        similarity: entry.similarity,
        score: entry.score
      })),
      unmatchedTruth: alignment.unmatchedTruthIndexes.map((truthIndex) => ({ truthIndex, value: truthValue[truthIndex] })),
      unmatchedOutput: alignment.unmatchedOutputIndexes.map((outputIndex) => ({ outputIndex, value: outputValue[outputIndex] }))
    });

    for (const entry of alignment.matches) {
      pushFieldResult({
        path: `${pathString}[truth=${entry.truthIndex},output=${entry.outputIndex}]`,
        status: 'pass',
        rule,
        truthValue: truthValue[entry.truthIndex],
        outputValue: outputValue[entry.outputIndex],
        metrics: { similarity: entry.similarity, minimumSimilarity }
      });
    }

    for (const truthIndex of alignment.unmatchedTruthIndexes) {
      pushFieldResult({
        path: `${pathString}[truth=${truthIndex}]`,
        status: 'fail',
        rule,
        truthValue: truthValue[truthIndex],
        outputValue: undefined,
        reason: missingTruthReason
      });
    }

    for (const outputIndex of alignment.unmatchedOutputIndexes) {
      if (allowExtraOutput) {
        emitIgnoredDifference(`${pathString}[output=${outputIndex}]`, extraOutputReason, undefined, outputValue[outputIndex]);
        continue;
      }
      pushFieldResult({
        path: `${pathString}[output=${outputIndex}]`,
        status: 'fail',
        rule,
        truthValue: undefined,
        outputValue: outputValue[outputIndex],
        reason: extraOutputReason
      });
    }
  }

  function compareLooseStructured(pathString, truthValue, outputValue, options = {}) {
    const currentPath = pathString || '$';
    const ignoreFields = options.ignoreFields || new Set();

    if (Array.isArray(truthValue)) {
      if (!Array.isArray(outputValue)) {
        pushFieldResult({
          path: currentPath,
          status: 'fail',
          rule: 'structural',
          truthValue,
          outputValue,
          reason: 'Output shape mismatch: expected array'
        });
        return;
      }

      if (currentPath.endsWith('.linked_segment_indexes')) {
        compareLinkedSegmentIndexArray(currentPath, truthValue, outputValue);
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
      for (let index = 0; index < maxLength; index += 1) {
        const childPath = `${currentPath}[${index}]`;
        if (index >= truthValue.length) {
          pushFieldResult({
            path: childPath,
            status: 'fail',
            rule: 'structural',
            truthValue: undefined,
            outputValue: outputValue[index],
            reason: 'Truth array missing item present in output'
          });
          continue;
        }
        if (index >= outputValue.length) {
          pushFieldResult({
            path: childPath,
            status: 'fail',
            rule: 'structural',
            truthValue: truthValue[index],
            outputValue: undefined,
            reason: 'Output array missing item present in truth'
          });
          continue;
        }
        compareLooseStructured(childPath, truthValue[index], outputValue[index], options);
      }
      return;
    }

    if (isPlainObject(truthValue)) {
      if (!isPlainObject(outputValue)) {
        pushFieldResult({
          path: currentPath,
          status: 'fail',
          rule: 'structural',
          truthValue,
          outputValue,
          reason: 'Output shape mismatch: expected object'
        });
        return;
      }

      const truthKeys = Object.keys(truthValue).filter((key) => !ignoreFields.has(key));
      const outputKeys = Object.keys(outputValue).filter((key) => !ignoreFields.has(key));
      const truthKeySet = new Set(truthKeys);
      const outputKeySet = new Set(outputKeys);

      for (const key of outputKeys) {
        if (!truthKeySet.has(key)) {
          const childPath = currentPath === '$' ? key : `${currentPath}.${key}`;
          pushFieldResult({
            path: childPath,
            status: 'fail',
            rule: 'structural',
            truthValue: undefined,
            outputValue: outputValue[key],
            reason: 'Truth object missing field present in output'
          });
        }
      }

      for (const key of truthKeys) {
        const childPath = currentPath === '$' ? key : `${currentPath}.${key}`;
        if (!outputKeySet.has(key)) {
          pushFieldResult({
            path: childPath,
            status: 'fail',
            rule: 'structural',
            truthValue: truthValue[key],
            outputValue: undefined,
            reason: 'Output object missing field present in truth'
          });
          continue;
        }
        compareLooseStructured(childPath, truthValue[key], outputValue[key], options);
      }
      return;
    }

    compareLeaf(currentPath, truthValue, outputValue);
  }

  function compareSpeakerProfilesArray(pathString, truthValue, outputValue) {
    const truthCoverage = truthValue.map((profile) => toComparableProfileCoverage(profile, 'truth'));
    const outputCoverage = outputValue.map((profile) => toComparableProfileCoverage(profile, 'output'));
    const alignment = alignItemsByScore(truthCoverage, outputCoverage, (truthRefs, outputRefs) => {
      const truthSet = new Set(truthRefs);
      const outputSet = new Set(outputRefs);
      let overlapCount = 0;
      for (const ref of truthSet) {
        if (outputSet.has(ref)) {
          overlapCount += 1;
        }
      }
      if (overlapCount === 0) {
        return null;
      }
      const unionCount = new Set([...truthSet, ...outputSet]).size;
      return {
        score: 1000 + (overlapCount * 100) + ((overlapCount / Math.max(unionCount, 1)) * 100),
        overlapCount,
        truthCoverageCount: truthSet.size,
        outputCoverageCount: outputSet.size
      };
    });

    if (truthValue.length !== outputValue.length) {
      pushFieldResult({
        path: pathString,
        status: 'fail',
        rule: 'structural',
        truthValue: { length: truthValue.length },
        outputValue: { length: outputValue.length },
        reason: `Array length mismatch: truth=${truthValue.length} output=${outputValue.length}`
      });
    }

    alignments.push({
      path: pathString,
      strategy: 'dialogue-speaker-profile-coverage',
      matches: alignment.matches.map((entry) => ({
        truthIndex: entry.truthIndex,
        outputIndex: entry.outputIndex,
        overlapCount: entry.overlapCount,
        truthCoverageCount: entry.truthCoverageCount,
        outputCoverageCount: entry.outputCoverageCount,
        score: entry.score
      })),
      unmatchedTruth: alignment.unmatchedTruthIndexes.map((truthIndex) => ({
        truthIndex,
        coverage: truthCoverage[truthIndex],
        profile: truthValue[truthIndex]
      })),
      unmatchedOutput: alignment.unmatchedOutputIndexes.map((outputIndex) => ({
        outputIndex,
        coverage: outputCoverage[outputIndex],
        profile: outputValue[outputIndex]
      }))
    });

    for (const entry of alignment.matches) {
      compareLooseStructured(`${pathString}[truth=${entry.truthIndex},output=${entry.outputIndex}]`, truthValue[entry.truthIndex], outputValue[entry.outputIndex], {
        ignoreFields: new Set(['speaker_id', 'label'])
      });
    }

    for (const truthIndex of alignment.unmatchedTruthIndexes) {
      pushFieldResult({
        path: `${pathString}[truth=${truthIndex}]`,
        status: 'fail',
        rule: 'speaker-profile-alignment',
        truthValue: truthValue[truthIndex],
        outputValue: undefined,
        reason: 'No output speaker profile covered this grounded dialogue evidence'
      });
    }

    for (const outputIndex of alignment.unmatchedOutputIndexes) {
      pushFieldResult({
        path: `${pathString}[output=${outputIndex}]`,
        status: 'fail',
        rule: 'speaker-profile-alignment',
        truthValue: undefined,
        outputValue: outputValue[outputIndex],
        reason: 'Output speaker profile claimed grounded dialogue evidence that did not match any truth profile'
      });
    }
  }

  function compareRecognizedSongObject(pathString, truthValue, outputValue) {
    if (!isPlainObject(outputValue)) {
      emitHardError(pathString, 'Output shape mismatch: expected object', truthValue, outputValue);
      return;
    }

    compareLeaf(`${pathString}.status`, truthValue.status, outputValue.status);
    compareLeaf(`${pathString}.confidence`, truthValue.confidence, outputValue.confidence);
    compareLeaf(`${pathString}.primaryEvidence`, truthValue.primaryEvidence, outputValue.primaryEvidence);
    compareLeaf(`${pathString}.multipleSongsDetected`, truthValue.multipleSongsDetected, outputValue.multipleSongsDetected);

    const truthCandidates = Array.isArray(truthValue.candidates) ? truthValue.candidates : [];
    const outputCandidates = Array.isArray(outputValue.candidates) ? outputValue.candidates : [];
    const truthCandidateKeys = truthCandidates.map((candidate) => `${candidate?.title || ''}::${candidate?.artist || ''}`);
    const outputCandidateKeys = outputCandidates.map((candidate) => `${candidate?.title || ''}::${candidate?.artist || ''}`);
    const keyedTruth = new Map(truthCandidateKeys.map((key, index) => [key, index]));
    const keyedOutput = new Map(outputCandidateKeys.map((key, index) => [key, index]));

    if (truthCandidates.length !== outputCandidates.length) {
      pushFieldResult({
        path: `${pathString}.candidates`,
        status: 'fail',
        rule: 'structural',
        truthValue: { length: truthCandidates.length },
        outputValue: { length: outputCandidates.length },
        reason: `Array length mismatch: truth=${truthCandidates.length} output=${outputCandidates.length}`
      });
    }

    for (const [key, outputIndex] of keyedOutput.entries()) {
      if (!keyedTruth.has(key)) {
        pushFieldResult({
          path: `${pathString}.candidates[output=${outputIndex}]`,
          status: 'fail',
          rule: 'recognized-song-candidate',
          truthValue: undefined,
          outputValue: outputCandidates[outputIndex],
          reason: 'Output candidate song identity was not present in truth'
        });
      }
    }

    for (const [key, truthIndex] of keyedTruth.entries()) {
      if (!keyedOutput.has(key)) {
        pushFieldResult({
          path: `${pathString}.candidates[truth=${truthIndex}]`,
          status: 'fail',
          rule: 'recognized-song-candidate',
          truthValue: truthCandidates[truthIndex],
          outputValue: undefined,
          reason: 'Output omitted a truth candidate song identity'
        });
        continue;
      }

      const outputIndex = keyedOutput.get(key);
      const truthCandidate = truthCandidates[truthIndex];
      const outputCandidate = outputCandidates[outputIndex];
      const candidatePath = `${pathString}.candidates[truth=${truthIndex},output=${outputIndex}]`;

      compareLeaf(`${candidatePath}.title`, truthCandidate.title, outputCandidate.title);
      compareLeaf(`${candidatePath}.artist`, truthCandidate.artist, outputCandidate.artist);
      compareLeaf(`${candidatePath}.confidence`, truthCandidate.confidence, outputCandidate.confidence);
      compareUnorderedFuzzySupportArray(`${candidatePath}.evidence`, Array.isArray(truthCandidate.evidence) ? truthCandidate.evidence : [], Array.isArray(outputCandidate.evidence) ? outputCandidate.evidence : [], {
        minimumSimilarity: 0.4,
        rule: 'recognized-song-support-evidence'
      });
      compareUnorderedFuzzySupportArray(`${candidatePath}.matchedLyrics`, Array.isArray(truthCandidate.matchedLyrics) ? truthCandidate.matchedLyrics : [], Array.isArray(outputCandidate.matchedLyrics) ? outputCandidate.matchedLyrics : [], {
        minimumSimilarity: 0.5,
        rule: 'recognized-song-support-lyrics'
      });
      compareTimeAwareSegmentArray(`${candidatePath}.timeRanges`, Array.isArray(truthCandidate.timeRanges) ? truthCandidate.timeRanges : [], Array.isArray(outputCandidate.timeRanges) ? outputCandidate.timeRanges : [], {
        kind: 'time-aware-ranges',
        label: 'recognizedSong.timeRanges'
      });
    }
  }

  function walk(pathString, truthValue, outputValue) {
    const currentPath = pathString || '$';

    if (isIgnoredPath(currentPath, comparator.resolvedOptions.ignorePaths)) {
      emitIgnoredSubtree(currentPath, truthValue, outputValue);
      collectIgnoredDifferences(currentPath, truthValue, outputValue);
      return;
    }

    if (Array.isArray(truthValue)) {
      if (!Array.isArray(outputValue)) {
        emitHardError(currentPath, 'Output shape mismatch: expected array', truthValue, outputValue);
        return;
      }

      if (comparator.profile === 'dialogue-default' && currentPath === 'speaker_profiles') {
        compareSpeakerProfilesArray(currentPath, truthValue, outputValue);
        return;
      }

      if (comparator.profile === 'music-vocals-default' && (currentPath === 'recognitionNotes' || currentPath === 'qualityNotes')) {
        compareUnorderedFuzzySupportArray(currentPath, truthValue, outputValue, {
          minimumSimilarity: 0.4,
          rule: currentPath === 'recognitionNotes' ? 'music-vocals-recognition-notes' : 'music-vocals-quality-notes',
          allowExtraOutput: true,
          missingTruthReason: 'Missing benchmark-expected note in output',
          extraOutputReason: 'Extra diagnostic note outside benchmark-required coverage'
        });
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
      const timeAwareAlignmentConfig = getTimeAwareArrayAlignmentConfig(currentPath, comparator);

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

      if (timeAwareAlignmentConfig) {
        compareTimeAwareSegmentArray(currentPath, truthValue, outputValue, timeAwareAlignmentConfig);
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
          if (isIgnoredPath(childPath, comparator.resolvedOptions.ignorePaths)) {
            emitIgnoredDifference(childPath, 'Ignored path contains extra output item', undefined, outputValue[i]);
            continue;
          }
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

      if (comparator.profile === 'music-vocals-default' && currentPath === 'recognizedSong') {
        compareRecognizedSongObject(currentPath, truthValue, outputValue);
        return;
      }

      const truthKeys = Object.keys(truthValue);
      const outputKeys = Object.keys(outputValue);
      const truthKeySet = new Set(truthKeys);
      const outputKeySet = new Set(outputKeys);

      for (const key of outputKeys) {
        if (!truthKeySet.has(key)) {
          const childPath = currentPath === '$' ? key : `${currentPath}.${key}`;
          if (isIgnoredPath(childPath, comparator.resolvedOptions.ignorePaths)) {
            emitIgnoredDifference(childPath, 'Ignored path contains extra output field', undefined, outputValue[key]);
            continue;
          }
          emitHardError(childPath, 'Truth object missing field present in output', undefined, outputValue[key]);
        }
      }

      for (const key of truthKeys) {
        const childPath = currentPath === '$' ? key : `${currentPath}.${key}`;
        if (!outputKeySet.has(key)) {
          if (isIgnoredPath(childPath, comparator.resolvedOptions.ignorePaths)) {
            emitIgnoredDifference(childPath, 'Ignored path omits output field present in truth', truthValue[key], undefined);
            continue;
          }
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
    erroredFields: fieldResults.filter((result) => result.status === 'error').length,
    ignoredDifferenceFields: ignoredDifferences.length
  };

  const accuracyRate = counts.scoreableFields > 0 ? counts.passedFields / counts.scoreableFields : null;
  const coverageRate = counts.totalTruthFields > 0 ? counts.scoreableFields / counts.totalTruthFields : null;
  const mismatchClassificationCounts = summarizeMismatchClassifications(fieldResults.filter((result) => result.status === 'fail' || result.status === 'error'));

  let status = 'pass';
  if (hardError || counts.erroredFields > 0) {
    status = 'error';
  } else if (counts.failedFields > 0) {
    status = 'fail';
  }

  const postureSummaryBits = [];
  if (comparisonBoundary?.comparisonMode === 'phase1-dialogue-provisional') {
    if (comparisonBoundary.outputSurface === 'raw') {
      postureSummaryBits.push('posture=provisional raw-vs-reconciled');
    } else if (comparisonBoundary.outputSurface === 'reconciled') {
      postureSummaryBits.push('posture=reconciled/post-processing contract');
    }
  }
  if (mismatchClassificationCounts.provisional_raw_dialogue_drift) {
    postureSummaryBits.push(`provisionalRawDrift=${mismatchClassificationCounts.provisional_raw_dialogue_drift}`);
  }
  if (mismatchClassificationCounts.deferred_contract_drift) {
    postureSummaryBits.push(`deferredContractDrift=${mismatchClassificationCounts.deferred_contract_drift}`);
  }
  if (mismatchClassificationCounts.reconciled_post_processing_contract_mismatch) {
    postureSummaryBits.push(`reconciledContractMismatch=${mismatchClassificationCounts.reconciled_post_processing_contract_mismatch}`);
  }

  const summaryPrefix = postureSummaryBits.length > 0 ? `${postureSummaryBits.join('; ')}. ` : '';
  const artifactScoring = buildArtifactScoring(comparator, truthData, outputData, fieldResults);
  const artifactSummaryBits = buildArtifactSummaryBits(artifactScoring);
  const summary = hardError
    ? `${summaryPrefix}${counts.passedFields}/${counts.scoreableFields} scoreable fields passed; ${counts.skippedFields}/${counts.totalTruthFields} truth fields were skipped.${artifactSummaryBits.length ? ` ${artifactSummaryBits.join('; ')}.` : ''}`
    : `${summaryPrefix}${counts.passedFields}/${counts.scoreableFields} scoreable fields passed; ${counts.skippedFields}/${counts.totalTruthFields} truth fields were skipped.${artifactSummaryBits.length ? ` ${artifactSummaryBits.join('; ')}.` : ''}`;

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
      resolvedOptions: comparator.resolvedOptions,
      directives: comparator.directives
    },
    comparisonBoundary,
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
    mismatchClassificationCounts,
    ...artifactScoring,
    failures,
    skips,
    ignoredDifferences,
    alignments,
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
  lines.push(`- Ignored differences surfaced outside score: ${summary.coverage.ignoredDifferences}`);
  if (summary.mismatchClassificationCounts?.provisional_raw_dialogue_drift) lines.push(`- Provisional raw dialogue drift fields: ${summary.mismatchClassificationCounts.provisional_raw_dialogue_drift}`);
  if (summary.mismatchClassificationCounts?.deferred_contract_drift) lines.push(`- Deferred contract drift fields: ${summary.mismatchClassificationCounts.deferred_contract_drift}`);
  if (summary.mismatchClassificationCounts?.reconciled_post_processing_contract_mismatch) lines.push(`- Reconciled/post-processing contract mismatch fields: ${summary.mismatchClassificationCounts.reconciled_post_processing_contract_mismatch}`);
  lines.push('');
  lines.push('## Artifacts');
  lines.push('');
  for (const artifact of sortArtifactsForSummary(summary.artifacts)) {
    const classificationBits = [];
    if (artifact.comparisonBoundary?.comparisonMode === 'phase1-dialogue-provisional') {
      classificationBits.push(`posture=${artifact.comparisonBoundary.outputSurface === 'raw' ? 'provisional raw-vs-reconciled' : 'reconciled/post-processing contract'}`);
    }
    if (artifact.mismatchClassificationCounts?.provisional_raw_dialogue_drift) classificationBits.push(`provisionalRawDrift=${artifact.mismatchClassificationCounts.provisional_raw_dialogue_drift}`);
    if (artifact.mismatchClassificationCounts?.deferred_contract_drift) classificationBits.push(`deferredContractDrift=${artifact.mismatchClassificationCounts.deferred_contract_drift}`);
    if (artifact.mismatchClassificationCounts?.reconciled_post_processing_contract_mismatch) classificationBits.push(`reconciledContractMismatch=${artifact.mismatchClassificationCounts.reconciled_post_processing_contract_mismatch}`);
    if (artifact.comparisonBoundary?.comparisonMode === 'dual-dialogue-surface') {
      classificationBits.push(`outputSurface=${artifact.comparisonBoundary.outputSurface}`);
      if (artifact.comparisonBoundary.truthSurface) classificationBits.push(`truthSurface=${artifact.comparisonBoundary.truthSurface}`);
      if (artifact.comparisonBoundary.reportSurface) classificationBits.push(`reportSurface=${artifact.comparisonBoundary.reportSurface}`);
    }
    const classificationSuffix = classificationBits.length > 0 ? `, ${classificationBits.join(', ')}` : '';
    lines.push(`- **${artifact.artifactKey}** — ${getArtifactComparisonDisplay(artifact)}; ${artifact.status}; accuracy=${artifact.accuracyRate === null ? 'n/a' : (artifact.accuracyRate * 100).toFixed(1) + '%'}, coverage=${artifact.coverageRate === null ? 'n/a' : (artifact.coverageRate * 100).toFixed(1) + '%'}, ignoredDiffs=${artifact.ignoredDifferenceCount}${classificationSuffix}`);
    appendArtifactSpecificMarkdown(lines, artifact);
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
    const truthAbsolutePath = path.resolve(manifestDir, artifact.truth.path);
    const outputResolution = resolvePhase1ArtifactPath(outputDir, artifact.artifactKey, {
      config,
      strict: artifact.required,
      aliasArtifactKey: artifact.runtimeArtifactKey || null,
      runtimeArtifactSurface: artifact.benchmarkRouting?.runtimeArtifactSurface || 'canonical'
    });
    const outputAbsolutePath = outputResolution.resolvedPath || path.resolve(outputDir, artifact.output.path);

    if (!fs.existsSync(truthAbsolutePath)) {
      throw new Error(`Truth artifact missing for ${artifact.artifactKey}: ${truthAbsolutePath}`);
    }

    if (artifact.required && !fs.existsSync(outputAbsolutePath)) {
      throw new Error(`Produced artifact missing for ${artifact.artifactKey}: ${outputAbsolutePath}`);
    }

    const rawTruthData = readJsonFile(truthAbsolutePath, `truth artifact ${artifact.artifactKey}`);
    const truthDirectives = extractTruthBenchmarkDirectives(rawTruthData, artifact, truthAbsolutePath);
    const comparator = createComparator(artifact, truthDirectives.directives);
    const truthData = truthDirectives.truthData;
    const outputData = readJsonFile(outputAbsolutePath, `produced artifact ${artifact.artifactKey}`);
    const comparisonBoundary = artifact.benchmarkRouting
      ? {
          comparisonMode: 'dual-dialogue-surface',
          outputSurface: outputResolution.resolvedRuntimeSurface,
          truthSurface: artifact.benchmarkRouting.truthSurface || null,
          reportSurface: artifact.benchmarkRouting.reportSurface || null,
          runtimeArtifactKey: artifact.runtimeArtifactKey || artifact.artifactKey
        }
      : comparator.resolvedOptions.posture?.kind === 'phase1-dialogue-provisional'
        ? {
            comparisonMode: 'phase1-dialogue-provisional',
            outputSurface: outputResolution.shouldUseReconciled ? 'reconciled' : 'raw',
            truthSurface: 'provisional-truth',
            deferredContractPaths: comparator.resolvedOptions.posture.deferredContractPaths
          }
        : null;

    const result = compareArtifact({
      artifact,
      comparator,
      truthData,
      outputData,
      truthPath: path.relative(process.cwd(), truthAbsolutePath).split(path.sep).join('/'),
      outputPath: path.relative(process.cwd(), outputAbsolutePath).split(path.sep).join('/'),
      fixtureId: manifest.fixtureId,
      benchmarkPath: path.relative(process.cwd(), manifestPath).split(path.sep).join('/'),
      comparisonBoundary
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
    acc.ignoredDifferenceFields += result.counts.ignoredDifferenceFields;
    for (const [classification, count] of Object.entries(result.mismatchClassificationCounts || {})) {
      acc.mismatchClassificationCounts[classification] = (acc.mismatchClassificationCounts[classification] || 0) + count;
    }
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
    erroredFields: 0,
    ignoredDifferenceFields: 0,
    mismatchClassificationCounts: {}
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
      label: result.label,
      status: result.status,
      accuracyRate: result.accuracy.rate,
      coverageRate: result.coverage.rate,
      ignoredDifferenceCount: result.counts.ignoredDifferenceFields,
      comparisonBoundary: result.comparisonBoundary,
      mismatchClassificationCounts: result.mismatchClassificationCounts,
      dialogueScoring: result.dialogueScoring,
      dialogueTimestampScoring: result.dialogueTimestampScoring,
      musicScoring: result.musicScoring,
      musicVocalsScoring: result.musicVocalsScoring,
      musicVocalsTimestampScoring: result.musicVocalsTimestampScoring,
      recommendationScoring: result.recommendationScoring,
      metricsScoring: result.metricsScoring,
      emotionalAnalysisScoring: result.emotionalAnalysisScoring,
      chunkAnalysisScoring: result.chunkAnalysisScoring
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
      ignoredDifferences: totals.ignoredDifferenceFields,
      totalTruthFields: totals.totalTruthFields,
      rate: totals.totalTruthFields > 0 ? totals.scoreableFields / totals.totalTruthFields : null
    },
    mismatchClassificationCounts: totals.mismatchClassificationCounts,
    errors: artifactResults.flatMap((result) => result.errors.map((error) => ({ artifactKey: result.artifactKey, ...error }))),
    summary: `${totals.artifactsPassed}/${totals.artifactsTotal} artifacts passed. ${totals.passedFields}/${totals.scoreableFields} scoreable fields passed. Truth coverage was ${totals.scoreableFields}/${totals.totalTruthFields} fields.${totals.mismatchClassificationCounts.provisional_raw_dialogue_drift ? ` provisional raw drift=${totals.mismatchClassificationCounts.provisional_raw_dialogue_drift}.` : ''}${totals.mismatchClassificationCounts.deferred_contract_drift ? ` deferred contract drift=${totals.mismatchClassificationCounts.deferred_contract_drift}.` : ''}${totals.mismatchClassificationCounts.reconciled_post_processing_contract_mismatch ? ` reconciled contract mismatch=${totals.mismatchClassificationCounts.reconciled_post_processing_contract_mismatch}.` : ''}`
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
