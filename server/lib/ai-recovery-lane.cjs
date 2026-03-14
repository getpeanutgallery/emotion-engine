#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const { parseJsonObjectInput } = require('./json-validator.cjs');
const { getProviderForTarget, buildProviderOptions } = require('./ai-targets.cjs');
const {
  AI_RECOVERY_INPUT_CONTRACT_VERSION,
  AI_RECOVERY_RESULT_CONTRACT_VERSION,
  normalizeRecoveryConfig
} = require('./script-contract.cjs');

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
  return dirPath;
}

function writeJson(filePath, payload) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), 'utf8');
}

function writeText(filePath, content) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, String(content || ''), 'utf8');
}

function relativeTo(outputDir, absolutePath) {
  return path.relative(path.resolve(outputDir), absolutePath).replace(/\\/g, '/');
}

function clip(value, maxChars) {
  if (typeof value !== 'string') return null;
  if (value.length <= maxChars) return value;
  return `${value.slice(0, maxChars)}…`;
}

function resolvePolicy(config = {}) {
  const recovery = normalizeRecoveryConfig(config.recovery);
  return recovery.ai;
}

function buildFailurePackage({ phase, scriptId, input, failureEnvelope, scriptModule }) {
  const outputDir = input.outputDir;
  const policy = resolvePolicy(input.config || {});
  const diagnostics = failureEnvelope?.diagnostics || {};
  const structured = diagnostics?.structured || {};
  const reentry = scriptModule?.aiRecovery?.reentry || {};
  const rawEvidenceRefs = Array.isArray(diagnostics.rawCaptureRefs)
    ? diagnostics.rawCaptureRefs.slice(0, policy.context.maxRawRefs)
    : [];

  return {
    contractVersion: AI_RECOVERY_INPUT_CONTRACT_VERSION,
    sourceFailure: failureEnvelope,
    lineage: {
      failureId: failureEnvelope?.recoveryPolicy?.lineage?.failureId || `${scriptId}:${phase}:attempt-${failureEnvelope?.run?.attempt || 1}`,
      script: scriptId,
      phase,
      scriptRunAttempt: failureEnvelope?.run?.attempt || 1,
      deterministicAttemptsUsed: failureEnvelope?.recoveryPolicy?.deterministic?.attemptsUsed || 0,
      aiRecoveryAttemptsUsed: failureEnvelope?.recoveryPolicy?.aiRecovery?.attemptsUsed || 0,
      maxAiRecoveryAttempts: failureEnvelope?.recoveryPolicy?.aiRecovery?.maxAttempts || policy.attempts.maxPerFailure,
      reentryAttemptNumber: (failureEnvelope?.run?.attempt || 1)
    },
    reentryContract: {
      mode: policy.reentry.mode,
      script: scriptId,
      allowedMutableInputs: Array.isArray(reentry.allowedMutableInputs) ? reentry.allowedMutableInputs : ['repairInstructions', 'boundedContextSummary'],
      forbiddenMutableInputs: Array.isArray(reentry.forbiddenMutableInputs) ? reentry.forbiddenMutableInputs : ['upstreamArtifacts', 'artifactPaths', 'schemaDefinition', 'runtimeBudgets']
    },
    context: {
      inputSummary: {
        artifactRefs: Object.values(input?.artifacts || {})
          .map((value) => (value && typeof value === 'object' && typeof value.path === 'string' ? relativeTo(outputDir, value.path) : null))
          .filter(Boolean),
        promptRef: diagnostics?.rawCaptureRefs?.find((ref) => String(ref).includes('/_prompts/')) || null
      },
      failureSummary: diagnostics.summary || failureEnvelope?.failure?.message || null,
      rawEvidenceRefs,
      boundedSnippets: {
        lastInvalidOutput: policy.context.includeLastInvalidOutput ? clip(structured.parseError ? diagnostics.summary || structured.parseError : null, policy.context.maxSnippetChars) : null,
        validationSummary: policy.context.includeValidationSummary ? clip(structured.validationSummary || diagnostics.summary || null, policy.context.maxSnippetChars) : null
      }
    },
    policy: {
      lane: policy.lane,
      adapter: policy.adapter,
      model: policy.model,
      temperature: policy.temperature,
      maxInputTokens: policy.budgets.maxInputTokens,
      maxOutputTokens: policy.budgets.maxOutputTokens,
      maxTotalTokens: policy.budgets.maxTotalTokens,
      maxCostUsd: policy.budgets.maxCostUsd,
      timeoutMs: policy.timeoutMs
    }
  };
}

function buildRecoveryPrompt({ failurePackage, scriptId, scriptModule }) {
  const domainGuidance = scriptModule?.aiRecovery?.guidance || `You are repairing the ${scriptId} script's structured JSON output.`;
  return [
    'You are a bounded AI recovery lane for emotion-engine.',
    domainGuidance,
    'Decide whether the failing script can safely re-enter once with schema-preserving input changes.',
    'Return JSON only with this shape:',
    JSON.stringify({
      decision: {
        outcome: 'reenter_script',
        reason: 'short reason',
        confidence: 'low|medium|high',
        hardFail: false,
        humanReviewRequired: false
      },
      revisedInput: {
        kind: 'same-script-revised-input',
        changes: [
          { path: 'repairInstructions', op: 'set', value: ['instruction'] },
          { path: 'boundedContextSummary', op: 'set', value: 'summary' }
        ]
      }
    }, null, 2),
    'Rules:',
    '- Only use paths allowed by reentryContract.allowedMutableInputs.',
    '- Keep edits schema-preserving and same-script only.',
    '- If repair is unsafe or unsupported, choose hard_fail or human_review and omit revisedInput changes.',
    '- Never suggest mutating upstream artifacts, schema, or budgets.',
    '',
    'Failure package:',
    JSON.stringify(failurePackage, null, 2)
  ].join('\n');
}

function normalizeDecision(parsed, fallbackReason) {
  const outcome = parsed?.decision?.outcome;
  if (!['reenter_script', 'hard_fail', 'human_review', 'no_change_fail'].includes(outcome)) {
    return {
      outcome: 'no_change_fail',
      reason: fallbackReason || 'AI recovery did not return a valid bounded decision.',
      confidence: 'low',
      hardFail: false,
      humanReviewRequired: false
    };
  }

  return {
    outcome,
    reason: typeof parsed?.decision?.reason === 'string' ? parsed.decision.reason : fallbackReason || outcome,
    confidence: typeof parsed?.decision?.confidence === 'string' ? parsed.decision.confidence : 'low',
    hardFail: !!parsed?.decision?.hardFail,
    humanReviewRequired: !!parsed?.decision?.humanReviewRequired
  };
}

function normalizeRevisedInput(parsed) {
  const changes = Array.isArray(parsed?.revisedInput?.changes) ? parsed.revisedInput.changes : [];
  const normalized = [];
  for (const change of changes) {
    if (!change || typeof change !== 'object') continue;
    if (!['repairInstructions', 'boundedContextSummary'].includes(change.path)) continue;
    if (change.op !== 'set') continue;
    normalized.push({ path: change.path, op: 'set', value: change.value });
  }
  return { kind: 'same-script-revised-input', changes: normalized };
}

function applyRevisedInput(input, failureEnvelope, revisedInput) {
  const runtime = {
    attempt: (failureEnvelope?.recoveryPolicy?.aiRecovery?.attemptsUsed || 0) + 1,
    sourceFailureId: failureEnvelope?.recoveryPolicy?.lineage?.failureId || null,
    repairInstructions: [],
    boundedContextSummary: null
  };

  for (const change of revisedInput.changes) {
    if (change.path === 'repairInstructions' && Array.isArray(change.value)) {
      runtime.repairInstructions = change.value.filter((entry) => typeof entry === 'string' && entry.trim().length > 0);
    }
    if (change.path === 'boundedContextSummary' && typeof change.value === 'string') {
      runtime.boundedContextSummary = change.value.trim() || null;
    }
  }

  const patchedArtifacts = JSON.parse(JSON.stringify(input.artifacts || {}));
  const scriptId = failureEnvelope?.script;
  if (!patchedArtifacts.__scriptExecution) {
    patchedArtifacts.__scriptExecution = {};
  }
  const executionState = patchedArtifacts.__scriptExecution[scriptId] || {
    status: failureEnvelope?.status || 'failure',
    run: failureEnvelope?.run || null,
    lineage: failureEnvelope?.recoveryPolicy?.lineage || null,
    failureCountsByCategory: {},
    recoveryPolicy: failureEnvelope?.recoveryPolicy ? JSON.parse(JSON.stringify(failureEnvelope.recoveryPolicy)) : null,
    refs: {}
  };
  patchedArtifacts.__scriptExecution[scriptId] = executionState;
  if (executionState?.recoveryPolicy?.aiRecovery) {
    executionState.recoveryPolicy.aiRecovery.attemptsUsed = runtime.attempt;
    executionState.recoveryPolicy.aiRecovery.attemptsRemaining = Math.max(0, (executionState.recoveryPolicy.aiRecovery.maxAttempts || runtime.attempt) - runtime.attempt);
  }

  return {
    ...input,
    artifacts: patchedArtifacts,
    recoveryRuntime: runtime
  };
}

async function attemptAiRecovery({ phase, scriptId, scriptModule, input, failureEnvelope }) {
  const aiPolicy = resolvePolicy(input.config || {});
  const attemptNumber = (failureEnvelope?.recoveryPolicy?.aiRecovery?.attemptsUsed || 0) + 1;
  const recoveryDir = path.join(path.resolve(input.outputDir), phase, 'recovery', scriptId, 'ai-recovery', `attempt-${String(attemptNumber).padStart(2, '0')}`);
  ensureDir(recoveryDir);

  const failurePackage = buildFailurePackage({ phase, scriptId, input, failureEnvelope, scriptModule });
  const prompt = buildRecoveryPrompt({ failurePackage, scriptId, scriptModule });

  const packagePath = path.join(recoveryDir, 'failure-package.json');
  const promptPath = path.join(recoveryDir, 'prompt.md');
  const responsePath = path.join(recoveryDir, 'response.json');
  const resultPath = path.join(recoveryDir, 'result.json');
  const revisedInputPath = path.join(recoveryDir, 'revised-input.json');

  writeJson(packagePath, failurePackage);
  writeText(promptPath, prompt);

  const target = { adapter: { name: aiPolicy.adapter, model: aiPolicy.model } };
  const configForTarget = {
    ...input.config,
    ai: {
      ...(input.config?.ai || {}),
      provider: aiPolicy.adapter
    }
  };

  const provider = getProviderForTarget({ configForTarget, target });
  let completion;
  let parsed;
  let parseFailure = null;

  try {
    completion = await provider.complete({
      prompt,
      model: aiPolicy.model,
      apiKey: process.env.AI_API_KEY,
      options: buildProviderOptions({
        adapter: { name: aiPolicy.adapter, model: aiPolicy.model },
        defaults: {
          temperature: aiPolicy.temperature,
          timeoutMs: aiPolicy.timeoutMs,
          maxTokens: aiPolicy.budgets.maxOutputTokens
        }
      })
    });

    writeJson(responsePath, completion || null);
    parsed = parseJsonObjectInput(completion?.content || '');
  } catch (error) {
    parseFailure = error;
    completion = { error: error?.message || String(error) };
    writeJson(responsePath, completion);
  }

  const decision = normalizeDecision(parsed?.value, parseFailure ? parseFailure.message : parsed?.summary);
  const revisedInput = normalizeRevisedInput(parsed?.value || null);
  if (decision.outcome !== 'reenter_script') {
    revisedInput.changes = [];
  }

  const result = {
    contractVersion: AI_RECOVERY_RESULT_CONTRACT_VERSION,
    status: parseFailure ? 'failed' : 'completed',
    lane: aiPolicy.lane,
    lineage: {
      failureId: failurePackage.lineage.failureId,
      script: scriptId,
      phase,
      scriptRunAttempt: failurePackage.lineage.scriptRunAttempt,
      aiRecoveryAttempt: attemptNumber,
      maxAiRecoveryAttempts: aiPolicy.attempts.maxPerFailure
    },
    decision,
    revisedInput: {
      ...revisedInput,
      targetScript: scriptId,
      candidateInputRef: decision.outcome === 'reenter_script' ? relativeTo(input.outputDir, revisedInputPath) : null
    },
    budgets: {
      inputTokensUsed: completion?.usage?.input ?? null,
      outputTokensUsed: completion?.usage?.output ?? null,
      estimatedCostUsd: null,
      withinBudget: true
    },
    observability: {
      promptRef: relativeTo(input.outputDir, promptPath),
      responseRef: relativeTo(input.outputDir, responsePath),
      decisionRef: relativeTo(input.outputDir, resultPath),
      rawCaptureRefs: [relativeTo(input.outputDir, responsePath)]
    },
    nextAction: {
      policy: decision.outcome === 'reenter_script' ? 'reenter_script' : (decision.outcome === 'human_review' ? 'human_review' : 'fail'),
      target: decision.outcome === 'reenter_script' ? scriptId : null,
      stopPipelineOnFailure: true
    }
  };

  if (decision.outcome === 'reenter_script') {
    writeJson(revisedInputPath, revisedInput);
  }
  writeJson(resultPath, result);

  return {
    result,
    reentryInput: decision.outcome === 'reenter_script'
      ? applyRevisedInput(input, failureEnvelope, revisedInput)
      : null
  };
}

module.exports = {
  attemptAiRecovery
};
