#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const SCRIPT_RESULT_CONTRACT_VERSION = 'ee.script-result/v1';
const AI_RECOVERY_INPUT_CONTRACT_VERSION = 'ee.ai-recovery-input/v1';
const AI_RECOVERY_RESULT_CONTRACT_VERSION = 'ee.ai-recovery-result/v1';

const DEFAULT_RECOVERY_CONFIG = Object.freeze({
  deterministic: {
    maxAttemptsPerFailure: 2,
    maxRepeatedStrategyUsesPerFailure: 1
  },
  ai: {
    enabled: false,
    lane: 'structured-output-repair',
    adapter: null,
    model: null,
    temperature: 0,
    timeoutMs: 45000,
    attempts: {
      maxPerFailure: 1,
      maxPerScriptRun: 1,
      maxPerPipelineRun: 3
    },
    budgets: {
      maxInputTokens: 12000,
      maxOutputTokens: 2000,
      maxTotalTokens: 14000,
      maxCostUsd: 0.25
    },
    context: {
      maxSnippetChars: 8000,
      maxRawRefs: 12,
      includePromptRef: true,
      includeLastInvalidOutput: true,
      includeValidationSummary: true,
      includeProviderMetadata: true
    },
    reentry: {
      mode: 'same-script-revised-input',
      allowPromptPatch: true,
      allowBoundedContextSummary: true,
      allowSchemaPreservingInputPatch: true,
      allowArtifactMutation: false,
      allowBudgetMutation: false,
      allowCrossScriptReroute: false
    },
    hardFailCategories: ['config', 'dependency', 'io'],
    hardFailCodes: [],
    humanReviewCategories: ['internal'],
    capture: {
      persistPrompt: true,
      persistResponse: true,
      persistDecision: true,
      persistRawEvidenceRefs: true
    }
  },
  stopConditions: {
    internalFailuresPerLineage: 2,
    configFailuresPerLineage: 1,
    dependencyFailuresPerLineage: 1
  }
});

const PRIMARY_ARTIFACT_LOCATIONS = Object.freeze({
  dialogueData: 'phase1-gather-context/dialogue-data.json',
  musicData: 'phase1-gather-context/music-data.json',
  metadataData: 'phase1-gather-context/metadata.json',
  chunkAnalysis: 'phase2-process/chunk-analysis.json',
  perSecondData: 'phase2-process/per-second-data.json',
  metricsData: 'phase3-report/metrics/metrics.json',
  recommendationData: 'phase3-report/recommendation/recommendation.json',
  emotionalAnalysis: 'phase3-report/emotional-analysis/emotional-analysis.json',
  summary: 'phase3-report/summary/summary.json',
  summaryData: 'phase3-report/summary/summary.json',
  finalReport: 'phase3-report/summary/FINAL-REPORT.md'
});

const SCRIPT_FAMILY_DECLARATIONS = Object.freeze({
  'ai.structured-output.v1': {
    family: 'ai.structured-output.v1',
    knownStrategies: [
      { id: 'repair-with-validator-tool-loop', kind: 'repair', consumesAttempt: true, terminalIfUnavailable: false },
      { id: 'retry-same-target', kind: 'retry', consumesAttempt: true, terminalIfUnavailable: false },
      { id: 'failover-next-target', kind: 'retry', consumesAttempt: true, terminalIfUnavailable: false },
      { id: 'retry-with-lower-thinking', kind: 'retry', consumesAttempt: true, terminalIfUnavailable: false }
    ]
  },
  'computed.report.v1': {
    family: 'computed.report.v1',
    knownStrategies: [
      { id: 'reload-persisted-artifacts', kind: 'rebuild', consumesAttempt: true, terminalIfUnavailable: false },
      { id: 'recompute-from-upstream-artifacts', kind: 'rebuild', consumesAttempt: true, terminalIfUnavailable: false }
    ]
  },
  'tool.wrapper.v1': {
    family: 'tool.wrapper.v1',
    knownStrategies: [
      { id: 're-extract-artifact', kind: 'rerun', consumesAttempt: true, terminalIfUnavailable: false },
      { id: 'retry-after-path-normalization', kind: 'repair', consumesAttempt: true, terminalIfUnavailable: false }
    ]
  },
  'none.v1': {
    family: 'none.v1',
    knownStrategies: []
  }
});

const SCRIPT_FAMILY_HINTS = Object.freeze({
  'get-dialogue': 'ai.structured-output.v1',
  'get-music': 'ai.structured-output.v1',
  'video-chunks': 'ai.structured-output.v1',
  'recommendation': 'ai.structured-output.v1',
  'video-per-second': 'computed.report.v1',
  metrics: 'computed.report.v1',
  'emotional-analysis': 'computed.report.v1',
  summary: 'computed.report.v1',
  'final-report': 'computed.report.v1',
  evaluation: 'computed.report.v1',
  'get-metadata': 'tool.wrapper.v1'
});

function cloneJson(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function deepMerge(base, override) {
  if (!isPlainObject(base)) return cloneJson(override);
  if (!isPlainObject(override)) return cloneJson(base);

  const merged = cloneJson(base);
  for (const [key, value] of Object.entries(override)) {
    if (isPlainObject(value) && isPlainObject(merged[key])) {
      merged[key] = deepMerge(merged[key], value);
    } else {
      merged[key] = cloneJson(value);
    }
  }
  return merged;
}

function pushValidationError(errors, message) {
  errors.push(message);
}

function validateInteger(errors, value, label, { min = 0, nullable = false } = {}) {
  if (value == null) {
    if (!nullable) pushValidationError(errors, `"${label}" is required`);
    return;
  }
  if (!Number.isInteger(value) || value < min) {
    pushValidationError(errors, `"${label}" must be an integer >= ${min}`);
  }
}

function validateNumber(errors, value, label, { min = 0, nullable = false } = {}) {
  if (value == null) {
    if (!nullable) pushValidationError(errors, `"${label}" is required`);
    return;
  }
  if (typeof value !== 'number' || Number.isNaN(value) || !Number.isFinite(value) || value < min) {
    pushValidationError(errors, `"${label}" must be a finite number >= ${min}`);
  }
}

function validateBoolean(errors, value, label) {
  if (value !== undefined && typeof value !== 'boolean') {
    pushValidationError(errors, `"${label}" must be a boolean when provided`);
  }
}

function validateString(errors, value, label, { nullable = false } = {}) {
  if (value == null) {
    if (!nullable) pushValidationError(errors, `"${label}" is required`);
    return;
  }
  if (typeof value !== 'string' || value.trim().length === 0) {
    pushValidationError(errors, `"${label}" must be a non-empty string`);
  }
}

function validateStringArray(errors, value, label) {
  if (value === undefined) return;
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== 'string' || entry.trim().length === 0)) {
    pushValidationError(errors, `"${label}" must be an array of non-empty strings when provided`);
  }
}

function normalizeRecoveryConfig(recoveryConfig) {
  if (recoveryConfig === undefined) {
    return cloneJson(DEFAULT_RECOVERY_CONFIG);
  }
  return deepMerge(DEFAULT_RECOVERY_CONFIG, recoveryConfig);
}

function validateRecoveryConfig(recoveryConfig) {
  const errors = [];

  if (recoveryConfig === undefined) {
    return { valid: true, errors, normalized: normalizeRecoveryConfig(undefined) };
  }

  if (!isPlainObject(recoveryConfig)) {
    return {
      valid: false,
      errors: ['"recovery" must be an object when provided'],
      normalized: normalizeRecoveryConfig(undefined)
    };
  }

  const normalized = normalizeRecoveryConfig(recoveryConfig);
  const deterministic = normalized.deterministic || {};
  const ai = normalized.ai || {};
  const stopConditions = normalized.stopConditions || {};

  validateInteger(errors, deterministic.maxAttemptsPerFailure, 'recovery.deterministic.maxAttemptsPerFailure', { min: 0 });
  validateInteger(errors, deterministic.maxRepeatedStrategyUsesPerFailure, 'recovery.deterministic.maxRepeatedStrategyUsesPerFailure', { min: 0 });

  validateBoolean(errors, ai.enabled, 'recovery.ai.enabled');
  if (ai.lane !== null) validateString(errors, ai.lane, 'recovery.ai.lane');
  if (ai.adapter !== null) validateString(errors, ai.adapter, 'recovery.ai.adapter');
  if (ai.model !== null) validateString(errors, ai.model, 'recovery.ai.model');
  validateNumber(errors, ai.temperature, 'recovery.ai.temperature', { min: 0 });
  validateInteger(errors, ai.timeoutMs, 'recovery.ai.timeoutMs', { min: 1 });

  validateInteger(errors, ai.attempts?.maxPerFailure, 'recovery.ai.attempts.maxPerFailure', { min: 0 });
  validateInteger(errors, ai.attempts?.maxPerScriptRun, 'recovery.ai.attempts.maxPerScriptRun', { min: 0 });
  validateInteger(errors, ai.attempts?.maxPerPipelineRun, 'recovery.ai.attempts.maxPerPipelineRun', { min: 0 });

  validateInteger(errors, ai.budgets?.maxInputTokens, 'recovery.ai.budgets.maxInputTokens', { min: 0 });
  validateInteger(errors, ai.budgets?.maxOutputTokens, 'recovery.ai.budgets.maxOutputTokens', { min: 0 });
  validateInteger(errors, ai.budgets?.maxTotalTokens, 'recovery.ai.budgets.maxTotalTokens', { min: 0 });
  validateNumber(errors, ai.budgets?.maxCostUsd, 'recovery.ai.budgets.maxCostUsd', { min: 0, nullable: true });

  validateInteger(errors, ai.context?.maxSnippetChars, 'recovery.ai.context.maxSnippetChars', { min: 0 });
  validateInteger(errors, ai.context?.maxRawRefs, 'recovery.ai.context.maxRawRefs', { min: 0 });
  validateBoolean(errors, ai.context?.includePromptRef, 'recovery.ai.context.includePromptRef');
  validateBoolean(errors, ai.context?.includeLastInvalidOutput, 'recovery.ai.context.includeLastInvalidOutput');
  validateBoolean(errors, ai.context?.includeValidationSummary, 'recovery.ai.context.includeValidationSummary');
  validateBoolean(errors, ai.context?.includeProviderMetadata, 'recovery.ai.context.includeProviderMetadata');

  if (ai.reentry?.mode !== null) validateString(errors, ai.reentry?.mode, 'recovery.ai.reentry.mode');
  validateBoolean(errors, ai.reentry?.allowPromptPatch, 'recovery.ai.reentry.allowPromptPatch');
  validateBoolean(errors, ai.reentry?.allowBoundedContextSummary, 'recovery.ai.reentry.allowBoundedContextSummary');
  validateBoolean(errors, ai.reentry?.allowSchemaPreservingInputPatch, 'recovery.ai.reentry.allowSchemaPreservingInputPatch');
  validateBoolean(errors, ai.reentry?.allowArtifactMutation, 'recovery.ai.reentry.allowArtifactMutation');
  validateBoolean(errors, ai.reentry?.allowBudgetMutation, 'recovery.ai.reentry.allowBudgetMutation');
  validateBoolean(errors, ai.reentry?.allowCrossScriptReroute, 'recovery.ai.reentry.allowCrossScriptReroute');

  validateStringArray(errors, ai.hardFailCategories, 'recovery.ai.hardFailCategories');
  validateStringArray(errors, ai.hardFailCodes, 'recovery.ai.hardFailCodes');
  validateStringArray(errors, ai.humanReviewCategories, 'recovery.ai.humanReviewCategories');

  validateBoolean(errors, ai.capture?.persistPrompt, 'recovery.ai.capture.persistPrompt');
  validateBoolean(errors, ai.capture?.persistResponse, 'recovery.ai.capture.persistResponse');
  validateBoolean(errors, ai.capture?.persistDecision, 'recovery.ai.capture.persistDecision');
  validateBoolean(errors, ai.capture?.persistRawEvidenceRefs, 'recovery.ai.capture.persistRawEvidenceRefs');

  validateInteger(errors, stopConditions.internalFailuresPerLineage, 'recovery.stopConditions.internalFailuresPerLineage', { min: 1 });
  validateInteger(errors, stopConditions.configFailuresPerLineage, 'recovery.stopConditions.configFailuresPerLineage', { min: 1 });
  validateInteger(errors, stopConditions.dependencyFailuresPerLineage, 'recovery.stopConditions.dependencyFailuresPerLineage', { min: 1 });

  return {
    valid: errors.length === 0,
    errors,
    normalized
  };
}

function inferScriptId(scriptPath) {
  const base = path.basename(scriptPath || '', path.extname(scriptPath || ''));
  return base || 'unknown-script';
}

function lookupDeterministicRecoveryDeclaration({ scriptId, scriptPath, scriptModule } = {}) {
  const explicit = scriptModule?.deterministicRecovery || scriptModule?.recoveryContract?.deterministic;
  if (explicit && isPlainObject(explicit)) {
    return cloneJson(explicit);
  }

  const resolvedScriptId = scriptId || inferScriptId(scriptPath);
  const family = SCRIPT_FAMILY_HINTS[resolvedScriptId] || 'none.v1';
  const declaration = SCRIPT_FAMILY_DECLARATIONS[family] || SCRIPT_FAMILY_DECLARATIONS['none.v1'];
  return {
    script: resolvedScriptId,
    ...cloneJson(declaration)
  };
}

function resolveRunAttempt(previousExecution) {
  const previousAttempt = previousExecution?.lineage?.scriptRunAttempt || previousExecution?.run?.attempt || 0;
  return previousAttempt + 1;
}

function createRunMetadata({ config, outputDir, startedAt, completedAt, attempt }) {
  const startedIso = startedAt instanceof Date ? startedAt.toISOString() : new Date(startedAt || Date.now()).toISOString();
  const completedIso = completedAt instanceof Date ? completedAt.toISOString() : new Date(completedAt || Date.now()).toISOString();
  const durationMs = Math.max(0, new Date(completedIso).getTime() - new Date(startedIso).getTime());

  return {
    configName: config?.name || null,
    outputDir,
    startedAt: startedIso,
    completedAt: completedIso,
    durationMs,
    attempt
  };
}

function collectPromptRefs(value, refs = new Set()) {
  if (!value || typeof value !== 'object') return refs;

  if (Array.isArray(value)) {
    for (const item of value) collectPromptRefs(item, refs);
    return refs;
  }

  if (value.promptRef && typeof value.promptRef === 'object' && typeof value.promptRef.file === 'string') {
    refs.add(value.promptRef.file);
  }

  if (Array.isArray(value.captureRefs)) {
    for (const ref of value.captureRefs) if (typeof ref === 'string') refs.add(ref);
  }

  if (Array.isArray(value.rawCaptureRefs)) {
    for (const ref of value.rawCaptureRefs) if (typeof ref === 'string') refs.add(ref);
  }

  for (const nested of Object.values(value)) {
    collectPromptRefs(nested, refs);
  }

  return refs;
}

function toRelativePath(outputDir, absolutePath) {
  if (!absolutePath) return null;
  const absoluteOutputDir = path.resolve(outputDir);
  const absolute = path.resolve(absolutePath);
  if (absolute === absoluteOutputDir) return '.';
  const relative = path.relative(absoluteOutputDir, absolute).replace(/\\/g, '/');
  return relative.startsWith('..') ? absolute : relative;
}

function resolveExistingRef(outputDir, relativeOrAbsolutePath) {
  if (!relativeOrAbsolutePath || typeof relativeOrAbsolutePath !== 'string') return null;
  const absolute = path.isAbsolute(relativeOrAbsolutePath)
    ? relativeOrAbsolutePath
    : path.join(path.resolve(outputDir), relativeOrAbsolutePath);
  return fs.existsSync(absolute) ? toRelativePath(outputDir, absolute) : null;
}

function collectDefaultCaptureRefs({ outputDir, phase, payload, diagnostics }) {
  const refs = collectPromptRefs(payload || {}, new Set());
  collectPromptRefs(diagnostics || {}, refs);

  const phaseRawDir = path.join(path.resolve(outputDir), phase, 'raw');
  const metaCandidates = [
    path.join(phaseRawDir, '_meta', 'errors.jsonl'),
    path.join(phaseRawDir, '_meta', 'errors.summary.json')
  ];

  for (const candidate of metaCandidates) {
    if (fs.existsSync(candidate)) {
      refs.add(toRelativePath(outputDir, candidate));
    }
  }

  return Array.from(refs).filter(Boolean).sort();
}

function inferPrimaryArtifactKey(artifacts) {
  if (!isPlainObject(artifacts)) return null;
  const keys = Object.keys(artifacts).filter((key) => !key.startsWith('__'));
  return keys.length > 0 ? keys[0] : null;
}

function inferArtifactRefs({ artifactKey, payloadData, outputDir }) {
  let primaryPath = null;

  if (payloadData?.path && typeof payloadData.path === 'string') {
    primaryPath = resolveExistingRef(outputDir, payloadData.path) || payloadData.path;
  } else if (PRIMARY_ARTIFACT_LOCATIONS[artifactKey]) {
    primaryPath = PRIMARY_ARTIFACT_LOCATIONS[artifactKey];
  }

  const primary = {
    key: artifactKey,
    path: primaryPath,
    mediaType: primaryPath && primaryPath.toLowerCase().endsWith('.md') ? 'text/markdown' : 'application/json'
  };

  const additional = [];
  if (payloadData?.analysisDataPath && typeof payloadData.analysisDataPath === 'string') {
    additional.push({
      key: `${artifactKey}:analysisData`,
      path: resolveExistingRef(outputDir, payloadData.analysisDataPath) || payloadData.analysisDataPath,
      mediaType: 'application/json'
    });
  }

  return { primary, additional };
}

function inferMetrics({ payloadData, resultMetrics, diagnostics }) {
  return {
    tokensTotal: resultMetrics?.tokensTotal ?? payloadData?.totalTokens ?? null,
    warningsCount: Array.isArray(diagnostics?.warnings) ? diagnostics.warnings.length : 0,
    ...(resultMetrics && isPlainObject(resultMetrics) ? resultMetrics : {})
  };
}

function createFailureCode(scriptId, category, error) {
  if (typeof error?.failureCode === 'string' && error.failureCode.trim()) {
    return error.failureCode.trim();
  }
  const normalizedScript = String(scriptId || 'script').replace(/[^a-zA-Z0-9]+/g, '_').toUpperCase();
  const normalizedCategory = String(category || 'internal').replace(/[^a-zA-Z0-9]+/g, '_').toUpperCase();
  return `${normalizedScript}_${normalizedCategory}`;
}

function classifyFailure(error, scriptId) {
  const message = String(error?.message || error || 'Unknown error');
  const lower = message.toLowerCase();

  let category = 'internal';
  if (error?.failureCategory) {
    category = error.failureCategory;
  } else if (lower.includes('timeout') || lower.includes('timed out') || error?.code === 'ETIMEDOUT') {
    category = 'timeout';
  } else if (lower.includes('invalid_output') || lower.includes('output was invalid') || lower.includes('invalid json') || lower.includes('malformed json') || lower.includes('validation failed') || lower.includes('schema')) {
    category = 'invalid_output';
  } else if (lower.includes('config') || lower.includes('yaml') || lower.includes('missing required')) {
    category = 'config';
  } else if (lower.includes('ffmpeg') || lower.includes('ffprobe') || lower.includes('tool')) {
    category = 'tool';
  } else if (lower.includes('network') || lower.includes('rate limit') || lower.includes('provider') || lower.includes('transport')) {
    category = 'provider_transport';
  } else if (['ENOENT', 'EACCES', 'EIO'].includes(error?.code)) {
    category = 'io';
  } else if (lower.includes('not found') || lower.includes('missing dependency') || lower.includes('module not found')) {
    category = 'dependency';
  }

  const retryable = ['timeout', 'provider_transport', 'invalid_output', 'tool'].includes(category);
  return {
    category,
    code: createFailureCode(scriptId, category, error),
    message,
    retryable,
    failedOperation: scriptId,
    failedUnit: {
      unitType: 'script',
      unitId: scriptId
    }
  };
}

function resolveConfiguredAiDomain(scriptId) {
  if (scriptId === 'get-dialogue') return 'dialogue';
  if (scriptId === 'get-music') return 'music';
  if (scriptId === 'video-chunks') return 'video';
  if (scriptId === 'recommendation') return 'recommendation';
  return null;
}

function inferApplicableStrategies({ declaration, config, scriptId }) {
  const strategyOrder = [];
  const knownIds = new Set((Array.isArray(declaration?.knownStrategies) ? declaration.knownStrategies : []).map((entry) => entry.id).filter(Boolean));
  const family = declaration?.family || 'none.v1';

  if (family !== 'ai.structured-output.v1') {
    return Array.from(knownIds);
  }

  const domain = resolveConfiguredAiDomain(scriptId);
  const domainConfig = domain ? (config?.ai?.[domain] || {}) : {};
  const targets = Array.isArray(domainConfig?.targets) ? domainConfig.targets : [];
  const retry = domainConfig?.retry || {};
  const maxAttempts = Number.isInteger(retry.maxAttempts) && retry.maxAttempts > 0 ? retry.maxAttempts : 1;
  const hasThinking = targets.some((target) => !!target?.adapter?.params?.thinking);

  if (knownIds.has('repair-with-validator-tool-loop')) strategyOrder.push('repair-with-validator-tool-loop');
  if (knownIds.has('retry-same-target') && maxAttempts > 1) strategyOrder.push('retry-same-target');
  if (knownIds.has('failover-next-target') && targets.length > 1) strategyOrder.push('failover-next-target');
  if (knownIds.has('retry-with-lower-thinking') && hasThinking) strategyOrder.push('retry-with-lower-thinking');

  return strategyOrder;
}

function inferAttemptedStrategies({ failure, previousExecution, strategyOrder }) {
  const attempted = Array.isArray(previousExecution?.recoveryPolicy?.deterministic?.attempted)
    ? previousExecution.recoveryPolicy.deterministic.attempted.slice()
    : [];
  const error = failure?.sourceError || null;
  const aiTargets = error?.aiTargets || {};
  const diagnosticToolLoop = error?.debug?.toolLoop || aiTargets?.toolLoop;

  const pushAttempted = (strategyId, condition = true) => {
    if (!condition) return;
    if (!strategyOrder.includes(strategyId)) return;
    if (!attempted.includes(strategyId)) attempted.push(strategyId);
  };

  pushAttempted('repair-with-validator-tool-loop', !!diagnosticToolLoop || failure?.category === 'invalid_output');
  pushAttempted('retry-same-target', Number.isInteger(aiTargets?.attempts) && aiTargets.attempts > 1);
  pushAttempted('failover-next-target', Number.isInteger(aiTargets?.targetIndex) && aiTargets.targetIndex > 0);
  pushAttempted('retry-with-lower-thinking', /thinking/i.test(String(error?.message || '')));

  return attempted;
}

function buildDeterministicState({ declaration, failure, previousExecution, recoveryConfig, config, scriptId }) {
  const strategyOrder = inferApplicableStrategies({ declaration, config, scriptId });
  const attempted = inferAttemptedStrategies({ failure, previousExecution, strategyOrder });
  const maxAttempts = recoveryConfig?.deterministic?.maxAttemptsPerFailure ?? DEFAULT_RECOVERY_CONFIG.deterministic.maxAttemptsPerFailure;
  const remaining = strategyOrder.filter((strategyId) => !attempted.includes(strategyId));

  return {
    eligible: failure.retryable && strategyOrder.length > 0,
    family: declaration?.family || 'none.v1',
    strategyOrder,
    attempted,
    remaining,
    maxAttempts,
    attemptsUsed: attempted.length
  };
}

function buildAiRecoveryState({ failure, previousExecution, recoveryConfig }) {
  const normalized = normalizeRecoveryConfig(recoveryConfig);
  const previousAttemptsUsed = previousExecution?.recoveryPolicy?.aiRecovery?.attemptsUsed || 0;
  const maxAttempts = normalized.ai.attempts.maxPerFailure;

  return {
    eligible: !!normalized.ai.enabled && failure.retryable,
    reason: failure.retryable ? 'Configured AI recovery fallback.' : 'Failure category is not retryable.',
    lane: normalized.ai.lane,
    maxAttempts,
    attemptsUsed: previousAttemptsUsed,
    attemptsRemaining: Math.max(0, maxAttempts - previousAttemptsUsed),
    budget: {
      maxInputTokens: normalized.ai.budgets.maxInputTokens,
      maxOutputTokens: normalized.ai.budgets.maxOutputTokens,
      maxTotalTokens: normalized.ai.budgets.maxTotalTokens,
      maxCostUsd: normalized.ai.budgets.maxCostUsd,
      timeoutMs: normalized.ai.timeoutMs
    },
    policy: {
      adapter: normalized.ai.adapter,
      model: normalized.ai.model,
      temperature: normalized.ai.temperature
    }
  };
}

function buildFailureCounts(previousExecution, category) {
  const counts = cloneJson(previousExecution?.failureCountsByCategory || {});
  counts[category] = (counts[category] || 0) + 1;
  return counts;
}

function determineNextAction({ failure, deterministicState, aiRecoveryState, failureCountsByCategory, recoveryConfig }) {
  const normalized = normalizeRecoveryConfig(recoveryConfig);
  const hardFailCategories = new Set(normalized.ai.hardFailCategories || []);
  const humanReviewCategories = new Set(normalized.ai.humanReviewCategories || []);
  const hardFailCodes = new Set(normalized.ai.hardFailCodes || []);

  const categoryCount = failureCountsByCategory?.[failure.category] || 0;

  if (hardFailCategories.has(failure.category) || hardFailCodes.has(failure.code)) {
    return { policy: 'fail', target: null, humanRequired: false, stopPipelineOnFailure: true };
  }

  if (failure.category === 'internal') {
    const limit = normalized.stopConditions.internalFailuresPerLineage;
    if (categoryCount >= limit) {
      return { policy: 'fail', target: null, humanRequired: false, stopPipelineOnFailure: true };
    }
    if (humanReviewCategories.has('internal')) {
      return { policy: 'human_review', target: null, humanRequired: true, stopPipelineOnFailure: true };
    }
  }

  if (failure.category === 'config' && categoryCount >= normalized.stopConditions.configFailuresPerLineage) {
    return { policy: 'fail', target: null, humanRequired: false, stopPipelineOnFailure: true };
  }

  if (failure.category === 'dependency' && categoryCount >= normalized.stopConditions.dependencyFailuresPerLineage) {
    return { policy: 'fail', target: null, humanRequired: false, stopPipelineOnFailure: true };
  }

  if (deterministicState.eligible && deterministicState.remaining.length > 0 && deterministicState.attemptsUsed < deterministicState.maxAttempts) {
    return {
      policy: 'deterministic_recovery',
      target: deterministicState.remaining[0],
      humanRequired: false,
      stopPipelineOnFailure: true
    };
  }

  if (aiRecoveryState.eligible && aiRecoveryState.attemptsRemaining > 0) {
    return {
      policy: 'ai_recovery',
      target: aiRecoveryState.lane || null,
      humanRequired: false,
      stopPipelineOnFailure: true
    };
  }

  if (humanReviewCategories.has(failure.category)) {
    return { policy: 'human_review', target: null, humanRequired: true, stopPipelineOnFailure: true };
  }

  return { policy: 'fail', target: null, humanRequired: false, stopPipelineOnFailure: true };
}

function buildLineage({ phase, script, runAttempt, previousExecution, deterministicState, aiRecoveryState }) {
  const parentFailureId = previousExecution?.lineage?.failureId || null;
  const failureId = `${script}:${phase}:attempt-${runAttempt}`;
  return {
    failureId,
    parentFailureId,
    phase,
    script,
    scriptRunAttempt: runAttempt,
    deterministicAttemptsUsed: deterministicState?.attemptsUsed || 0,
    aiRecoveryAttemptsUsed: aiRecoveryState?.attemptsUsed || 0,
    maxAiRecoveryAttempts: aiRecoveryState?.maxAttempts || 0,
    reentryAttemptNumber: Math.max(0, runAttempt - 1)
  };
}

function buildSuccessEnvelope({ phase, script, config, outputDir, runAttempt, startedAt, completedAt, payloadArtifactKey, payloadData, artifactRefs, resultMetrics, diagnostics }) {
  const run = createRunMetadata({ config, outputDir, startedAt, completedAt, attempt: runAttempt });
  const captureRefs = collectDefaultCaptureRefs({ outputDir, phase, payload: payloadData, diagnostics });
  const resolvedDiagnostics = {
    warnings: Array.isArray(diagnostics?.warnings) ? diagnostics.warnings : [],
    degraded: !!diagnostics?.degraded,
    debugCaptureEnabled: !!config?.debug?.captureRaw,
    captureRefs
  };

  return {
    contractVersion: SCRIPT_RESULT_CONTRACT_VERSION,
    status: 'success',
    phase,
    script,
    run,
    payload: {
      artifactKey: payloadArtifactKey,
      data: payloadData
    },
    artifacts: artifactRefs,
    metrics: inferMetrics({ payloadData, resultMetrics, diagnostics: resolvedDiagnostics }),
    diagnostics: resolvedDiagnostics
  };
}

function buildFailureEnvelope({ phase, script, config, outputDir, runAttempt, startedAt, completedAt, error, declaration, previousExecution, recoveryConfig }) {
  const failure = classifyFailure(error, script);
  const deterministicState = buildDeterministicState({ declaration, failure, previousExecution, recoveryConfig, config, scriptId: script });
  const aiRecoveryState = buildAiRecoveryState({ failure, previousExecution, recoveryConfig });
  const failureCountsByCategory = buildFailureCounts(previousExecution, failure.category);
  const nextAction = determineNextAction({ failure, deterministicState, aiRecoveryState, failureCountsByCategory, recoveryConfig });
  const diagnostics = {
    summary: failure.message,
    stage: error?.stage || 'script.run',
    provider: error?.provider || null,
    structured: {
      parseError: error?.parseError || null,
      validationErrors: Array.isArray(error?.validationErrors) ? error.validationErrors : [],
      validationSummary: error?.validationSummary || null
    },
    rawCaptureRefs: collectDefaultCaptureRefs({ outputDir, phase, payload: error?.payload || null, diagnostics: error?.diagnostics || null }),
    stack: error?.stack || null
  };
  const lineage = buildLineage({ phase, script, runAttempt, previousExecution, deterministicState, aiRecoveryState });

  return {
    envelope: {
      contractVersion: SCRIPT_RESULT_CONTRACT_VERSION,
      status: 'failure',
      phase,
      script,
      run: createRunMetadata({ config, outputDir, startedAt, completedAt, attempt: runAttempt }),
      failure,
      recoveryPolicy: {
        deterministic: deterministicState,
        aiRecovery: aiRecoveryState,
        nextAction,
        lineage
      },
      diagnostics
    },
    lineage,
    failureCountsByCategory
  };
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
  return dirPath;
}

function persistJson(outputDir, relativePath, payload) {
  const absolutePath = path.join(path.resolve(outputDir), relativePath);
  ensureDir(path.dirname(absolutePath));
  fs.writeFileSync(absolutePath, JSON.stringify(payload, null, 2), 'utf8');
  return {
    absolutePath,
    relativePath: relativePath.replace(/\\/g, '/')
  };
}

function persistExecutionArtifacts({ outputDir, phase, script, envelope, lineage }) {
  const resultRef = persistJson(outputDir, `${phase}/script-results/${script}.${envelope.status}.json`, envelope);
  const lineageRef = persistJson(outputDir, `${phase}/recovery/${script}/lineage.json`, lineage || envelope.recoveryPolicy?.lineage || {
    failureId: `${script}:${phase}:attempt-${envelope.run?.attempt || 1}`,
    phase,
    script,
    scriptRunAttempt: envelope.run?.attempt || 1,
    deterministicAttemptsUsed: 0,
    aiRecoveryAttemptsUsed: 0,
    reentryAttemptNumber: 0,
    parentFailureId: null
  });

  let nextActionRef = null;
  if (envelope.recoveryPolicy?.nextAction) {
    nextActionRef = persistJson(outputDir, `${phase}/recovery/${script}/next-action.json`, envelope.recoveryPolicy.nextAction);
  }

  return { resultRef, lineageRef, nextActionRef };
}

function buildExecutionPatch({ script, envelope, refs, failureCountsByCategory, lineage = null }) {
  return {
    __scriptExecution: {
      [script]: {
        status: envelope.status,
        run: envelope.run,
        lineage: lineage || envelope.recoveryPolicy?.lineage || null,
        failureCountsByCategory: failureCountsByCategory || {},
        recoveryPolicy: envelope.recoveryPolicy || null,
        refs: {
          result: refs.resultRef?.relativePath || null,
          lineage: refs.lineageRef?.relativePath || null,
          nextAction: refs.nextActionRef?.relativePath || null
        }
      }
    }
  };
}

function wrapLegacySuccessResult({ result, phase, script, config, outputDir, previousExecution, startedAt, completedAt }) {
  if (!result || !isPlainObject(result.artifacts)) {
    throw new Error(`Script must return { artifacts: object }: ${script}`);
  }

  const payloadArtifactKey = result.primaryArtifactKey || inferPrimaryArtifactKey(result.artifacts);
  const payloadData = payloadArtifactKey ? result.artifacts[payloadArtifactKey] : null;
  const runAttempt = resolveRunAttempt(previousExecution);
  const envelope = buildSuccessEnvelope({
    phase,
    script,
    config,
    outputDir,
    runAttempt,
    startedAt,
    completedAt,
    payloadArtifactKey,
    payloadData,
    artifactRefs: inferArtifactRefs({ artifactKey: payloadArtifactKey, payloadData, outputDir }),
    resultMetrics: result.metrics,
    diagnostics: result.diagnostics
  });

  const lineage = {
    failureId: `${script}:${phase}:attempt-${runAttempt}`,
    parentFailureId: previousExecution?.lineage?.failureId || null,
    phase,
    script,
    scriptRunAttempt: runAttempt,
    deterministicAttemptsUsed: previousExecution?.recoveryPolicy?.deterministic?.attemptsUsed || 0,
    aiRecoveryAttemptsUsed: previousExecution?.recoveryPolicy?.aiRecovery?.attemptsUsed || 0,
    maxAiRecoveryAttempts: normalizeRecoveryConfig(config?.recovery).ai.attempts.maxPerFailure,
    reentryAttemptNumber: Math.max(0, runAttempt - 1)
  };

  const refs = persistExecutionArtifacts({ outputDir, phase, script, envelope, lineage });
  const executionPatch = buildExecutionPatch({ script, envelope, refs, failureCountsByCategory: {}, lineage });

  return {
    ...result,
    scriptResult: envelope,
    artifacts: deepMerge(result.artifacts, executionPatch)
  };
}

function createFailureResult({ phase, script, config, outputDir, error, previousExecution, declaration, startedAt, completedAt }) {
  const runAttempt = resolveRunAttempt(previousExecution);
  const { envelope, lineage, failureCountsByCategory } = buildFailureEnvelope({
    phase,
    script,
    config,
    outputDir,
    runAttempt,
    startedAt,
    completedAt,
    error,
    declaration,
    previousExecution,
    recoveryConfig: config?.recovery
  });

  const refs = persistExecutionArtifacts({ outputDir, phase, script, envelope, lineage });
  const executionPatch = buildExecutionPatch({ script, envelope, refs, failureCountsByCategory });

  return {
    envelope,
    result: {
      artifacts: executionPatch,
      scriptResult: envelope
    }
  };
}

module.exports = {
  SCRIPT_RESULT_CONTRACT_VERSION,
  AI_RECOVERY_INPUT_CONTRACT_VERSION,
  AI_RECOVERY_RESULT_CONTRACT_VERSION,
  DEFAULT_RECOVERY_CONFIG,
  normalizeRecoveryConfig,
  validateRecoveryConfig,
  lookupDeterministicRecoveryDeclaration,
  resolveRunAttempt,
  buildSuccessEnvelope,
  buildFailureEnvelope,
  wrapLegacySuccessResult,
  createFailureResult,
  inferPrimaryArtifactKey,
  inferArtifactRefs,
  classifyFailure,
  collectDefaultCaptureRefs,
  persistExecutionArtifacts,
  buildExecutionPatch,
  inferApplicableStrategies,
  inferAttemptedStrategies
};
