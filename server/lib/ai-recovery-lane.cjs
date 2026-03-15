#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const { getProviderForTarget, buildProviderOptions } = require('./ai-targets.cjs');
const {
  AI_RECOVERY_INPUT_CONTRACT_VERSION,
  AI_RECOVERY_RESULT_CONTRACT_VERSION,
  normalizeRecoveryConfig
} = require('./script-contract.cjs');
const { executeLocalValidatorToolLoop } = require('./local-validator-tool-loop.cjs');
const {
  buildAiRecoveryValidatorToolContract,
  executeAiRecoveryValidatorTool
} = require('./ai-recovery-validator-tool.cjs');

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

function resolveToolLoopConfig(aiPolicy = {}) {
  const toolLoop = aiPolicy.toolLoop || {};
  return {
    maxTurns: Number.isInteger(toolLoop.maxTurns) && toolLoop.maxTurns > 1 ? toolLoop.maxTurns : 4,
    maxValidatorCalls: Number.isInteger(toolLoop.maxValidatorCalls) && toolLoop.maxValidatorCalls > 0 ? toolLoop.maxValidatorCalls : 3
  };
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

function buildRecoveryBasePrompt({ failurePackage, scriptId, scriptModule }) {
  const domainGuidance = scriptModule?.aiRecovery?.guidance || `You are repairing the ${scriptId} script's structured JSON output.`;
  return [
    'You are a bounded AI recovery lane for emotion-engine.',
    domainGuidance,
    'Decide whether the failing script can safely re-enter once with schema-preserving input changes.',
    'You must use the provided local validator tool before any final AI recovery decision can be accepted.',
    'The final accepted decision artifact must have this shape:',
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
    '- If repair is unsafe or unsupported, choose hard_fail, human_review, or no_change_fail and do not include revisedInput changes.',
    '- Never suggest mutating upstream artifacts, schema, budgets, targets, or contracts.',
    '- Malformed or out-of-contract decisions are rejected deterministically.',
    '',
    'Failure package:',
    JSON.stringify(failurePackage, null, 2)
  ].join('\n');
}

function normalizeRevisedInput(candidate) {
  const revisedInput = candidate?.revisedInput;
  if (!revisedInput || typeof revisedInput !== 'object' || Array.isArray(revisedInput)) {
    return { kind: 'same-script-revised-input', changes: [] };
  }

  const changes = Array.isArray(revisedInput.changes) ? revisedInput.changes : [];
  return {
    kind: 'same-script-revised-input',
    changes: changes.map((change) => ({ path: change.path, op: 'set', value: change.value }))
  };
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

function buildFailedRecoveryResult({
  aiPolicy,
  attemptNumber,
  failurePackage,
  phase,
  scriptId,
  input,
  promptPath,
  responsePath,
  resultPath,
  toolLoopPath,
  error,
  completion
}) {
  const validationSummary = error?.aiTargets?.validationSummary || error?.message || 'AI recovery validator-tool loop failed.';
  const history = error?.aiTargets?.toolLoop?.history || [];

  return {
    contractVersion: AI_RECOVERY_RESULT_CONTRACT_VERSION,
    status: 'failed',
    lane: aiPolicy.lane,
    lineage: {
      failureId: failurePackage.lineage.failureId,
      script: scriptId,
      phase,
      scriptRunAttempt: failurePackage.lineage.scriptRunAttempt,
      aiRecoveryAttempt: attemptNumber,
      maxAiRecoveryAttempts: aiPolicy.attempts.maxPerFailure
    },
    decision: {
      outcome: 'no_change_fail',
      reason: validationSummary,
      confidence: 'low',
      hardFail: true,
      humanReviewRequired: false
    },
    revisedInput: {
      kind: 'same-script-revised-input',
      changes: [],
      targetScript: scriptId,
      candidateInputRef: null
    },
    budgets: {
      inputTokensUsed: completion?.usage?.input ?? error?.aiTargets?.completion?.usage?.input ?? null,
      outputTokensUsed: completion?.usage?.output ?? error?.aiTargets?.completion?.usage?.output ?? null,
      estimatedCostUsd: null,
      withinBudget: true
    },
    observability: {
      promptRef: relativeTo(input.outputDir, promptPath),
      responseRef: relativeTo(input.outputDir, responsePath),
      decisionRef: relativeTo(input.outputDir, resultPath),
      toolLoopRef: relativeTo(input.outputDir, toolLoopPath),
      rawCaptureRefs: [relativeTo(input.outputDir, responsePath)],
      toolLoopHistoryKinds: history.map((entry) => entry.kind)
    },
    nextAction: {
      policy: 'fail',
      target: null,
      stopPipelineOnFailure: true
    }
  };
}

async function attemptAiRecovery({ phase, scriptId, scriptModule, input, failureEnvelope }) {
  const aiPolicy = resolvePolicy(input.config || {});
  const toolLoopConfig = resolveToolLoopConfig(aiPolicy);
  const attemptNumber = (failureEnvelope?.recoveryPolicy?.aiRecovery?.attemptsUsed || 0) + 1;
  const recoveryDir = path.join(path.resolve(input.outputDir), phase, 'recovery', scriptId, 'ai-recovery', `attempt-${String(attemptNumber).padStart(2, '0')}`);
  ensureDir(recoveryDir);

  const failurePackage = buildFailurePackage({ phase, scriptId, input, failureEnvelope, scriptModule });
  const basePrompt = buildRecoveryBasePrompt({ failurePackage, scriptId, scriptModule });

  const packagePath = path.join(recoveryDir, 'failure-package.json');
  const promptPath = path.join(recoveryDir, 'prompt.md');
  const responsePath = path.join(recoveryDir, 'response.json');
  const resultPath = path.join(recoveryDir, 'result.json');
  const revisedInputPath = path.join(recoveryDir, 'revised-input.json');
  const toolLoopPath = path.join(recoveryDir, 'tool-loop.json');

  writeJson(packagePath, failurePackage);
  writeText(promptPath, basePrompt);

  const target = { adapter: { name: aiPolicy.adapter, model: aiPolicy.model } };
  const configForTarget = {
    ...input.config,
    ai: {
      ...(input.config?.ai || {}),
      provider: aiPolicy.adapter
    }
  };

  const provider = getProviderForTarget({ configForTarget, target });
  const toolContract = buildAiRecoveryValidatorToolContract();
  let completion = null;

  try {
    const toolLoopResult = await executeLocalValidatorToolLoop({
      provider,
      adapter: target.adapter,
      basePrompt,
      toolContract,
      toolLoopConfig,
      promptRef: null,
      events: null,
      ctx: null,
      phaseKey: phase,
      scriptId,
      domain: 'ai_recovery',
      artifactLabel: 'AI recovery decision',
      finalArtifactDescription: 'The final artifact must be the bounded AI recovery decision JSON object. Only the same-script revised-input contract is allowed.',
      finalArtifactRules: [
        'Call the validator tool before returning the final decision artifact.',
        'Only repairInstructions and boundedContextSummary may appear in revisedInput.changes.',
        'For hard_fail, human_review, and no_change_fail outcomes, revisedInput.changes must be empty.'
      ],
      requireExplicitToolCallBeforeFinalArtifact: true,
      callProvider: ({ prompt }) => provider.complete({
        prompt,
        model: aiPolicy.model,
        apiKey: process.env.AI_API_KEY,
        options: buildProviderOptions({
          adapter: target.adapter,
          defaults: {
            temperature: aiPolicy.temperature,
            timeoutMs: aiPolicy.timeoutMs,
            maxTokens: aiPolicy.budgets.maxOutputTokens
          }
        })
      }),
      executeValidatorTool: (args) => executeAiRecoveryValidatorTool(args),
      normalizeValidatedValue: (value) => JSON.stringify(value)
    });

    completion = toolLoopResult.completion || null;
    writeJson(responsePath, completion || null);
    writeJson(toolLoopPath, toolLoopResult.toolLoop || null);

    const parsed = toolLoopResult.parsed;
    const decision = parsed.decision;
    const revisedInput = normalizeRevisedInput(parsed);

    const result = {
      contractVersion: AI_RECOVERY_RESULT_CONTRACT_VERSION,
      status: 'completed',
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
        toolLoopRef: relativeTo(input.outputDir, toolLoopPath),
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
  } catch (error) {
    completion = error?.aiTargets?.completion || null;
    writeJson(responsePath, completion || { error: error?.message || String(error) });
    writeJson(toolLoopPath, error?.aiTargets?.toolLoop || null);

    const result = buildFailedRecoveryResult({
      aiPolicy,
      attemptNumber,
      failurePackage,
      phase,
      scriptId,
      input,
      promptPath,
      responsePath,
      resultPath,
      toolLoopPath,
      error,
      completion
    });
    writeJson(resultPath, result);

    return {
      result,
      reentryInput: null
    };
  }
}

module.exports = {
  attemptAiRecovery,
  buildFailurePackage,
  buildRecoveryBasePrompt,
  resolveToolLoopConfig
};
