#!/usr/bin/env node
/**
 * Recommendation Report Script (Phase 3 - AI Advisor)
 *
 * Uses YAML-configured AI targets to generate actionable recommendations
 * based on phase2 chunk analysis + phase3 metrics.
 *
 * Raw capture schema v2 parity:
 * - attempt-scoped capture payloads under phase3-report/raw/ai/recommendation/
 * - legacy pointer file (recommendation.json) pointing at latest attempt
 *
 * Config (new):
 * - ai.recommendation.targets[*].adapter.{name,model,params?}
 * - ai.recommendation.retry.{maxAttempts,backoffMs}
 * - ai.recommendation.toolLoop.{maxTurns,maxValidatorCalls}
 *
 * @module scripts/report/recommendation
 */

const fs = require('fs');
const path = require('path');

const outputManager = require('../../lib/output-manager.cjs');
const { splitChunksByStatus } = require('../../lib/chunk-analysis-status.cjs');
const { shouldCaptureRaw, getRawPhaseDir, sanitizeRawCaptureValue, writeRawJson } = require('../../lib/raw-capture.cjs');
const {
  executeWithTargets,
  getProviderForTarget,
  createRetryableError,
  buildProviderOptions,
  getPersistedErrorInfo
} = require('../../lib/ai-targets.cjs');
const { getEventsLogger } = require('../../lib/events-timeline.cjs');
const { storePromptPayload } = require('../../lib/prompt-store.cjs');
const { parseJsonObjectInput } = require('../../lib/json-validator.cjs');
const { parseRecommendationResponse } = require('../../lib/recommendation-validator.cjs');
const { getRecoveryRuntime, buildRecoveryPromptAddendum } = require('../../lib/ai-recovery-runtime.cjs');
const {
  TOOL_NAME,
  buildRecommendationValidatorToolContract,
  executeRecommendationValidatorTool,
  parseRecommendationToolCallEnvelope
} = require('../../lib/recommendation-validator-tool.cjs');

const PHASE_KEY = 'phase3-report';
const SCRIPT_ID = 'recommendation';

function isReplayMode() {
  return (process.env.DIGITAL_TWIN_MODE || '').trim().toLowerCase() === 'replay';
}

function pad(value, width) {
  return String(value).padStart(width, '0');
}

function getRetryConfig(config = {}) {
  const retry = config?.ai?.recommendation?.retry || {};

  return {
    maxAttempts: Number.isInteger(retry.maxAttempts) && retry.maxAttempts > 0 ? retry.maxAttempts : 1,
    backoffMs: Number.isInteger(retry.backoffMs) && retry.backoffMs >= 0 ? retry.backoffMs : 0
  };
}

function getToolLoopConfig(config = {}) {
  const toolLoop = config?.ai?.recommendation?.toolLoop || {};

  return {
    maxTurns: Number.isInteger(toolLoop.maxTurns) && toolLoop.maxTurns > 1 ? toolLoop.maxTurns : 4,
    maxValidatorCalls: Number.isInteger(toolLoop.maxValidatorCalls) && toolLoop.maxValidatorCalls > 0 ? toolLoop.maxValidatorCalls : 3
  };
}

function ensurePhaseErrorArtifacts({ captureRaw, rawMetaDir, events, phaseOutcome, fatalPhaseError, phaseErrors }) {
  if (!captureRaw) return;

  fs.mkdirSync(rawMetaDir, { recursive: true });
  const errorsPath = path.join(rawMetaDir, 'errors.jsonl');

  const lines = phaseErrors.length > 0
    ? phaseErrors.map((e) => JSON.stringify(e)).join('\n') + '\n'
    : '';
  fs.writeFileSync(errorsPath, lines, 'utf8');

  if (events) {
    events.artifactWrite({ absolutePath: errorsPath, role: 'raw.meta', phase: PHASE_KEY, script: SCRIPT_ID });
  }

  const totalErrors = fs.existsSync(errorsPath)
    ? fs.readFileSync(errorsPath, 'utf8').split('\n').filter(Boolean).length
    : 0;

  const summary = {
    schemaVersion: 1,
    phase: PHASE_KEY,
    outcome: phaseOutcome,
    generatedAt: new Date().toISOString(),
    totalErrors,
    fatalError: fatalPhaseError
      ? {
          name: fatalPhaseError?.name || null,
          message: fatalPhaseError?.message || String(fatalPhaseError),
          stack: typeof fatalPhaseError?.stack === 'string' ? fatalPhaseError.stack : null
        }
      : null
  };

  const summaryPath = writeRawJson(rawMetaDir, 'errors.summary.json', summary);
  if (events) {
    events.artifactWrite({ absolutePath: summaryPath, role: 'raw.meta', phase: PHASE_KEY, script: SCRIPT_ID });
  }
}

function buildPrompt({ chunks, metricsData, config, recoveryRuntime = null }) {
  const metricsSummary = {
    averages: metricsData?.averages || null,
    trends: metricsData?.trends || null,
    frictionIndex: typeof metricsData?.frictionIndex === 'number' ? metricsData.frictionIndex : null,
    peakMoments: metricsData?.peakMoments || null
  };

  const chunkSummaries = (chunks || []).map((chunk) => ({
    chunkIndex: typeof chunk?.chunkIndex === 'number' ? chunk.chunkIndex : null,
    startTime: typeof chunk?.startTime === 'number' ? chunk.startTime : null,
    endTime: typeof chunk?.endTime === 'number' ? chunk.endTime : null,
    summary: typeof chunk?.summary === 'string' ? chunk.summary : null,
    dominant_emotion: chunk?.dominant_emotion || null,
    confidence: typeof chunk?.confidence === 'number' ? chunk.confidence : null,
    emotions: chunk?.emotions || null
  }));

  const pipelineMeta = {
    pipelineName: config?.name || null,
    pipelineVersion: config?.version || null,
    persona: {
      soulPath: config?.tool_variables?.soulPath || null,
      goalPath: config?.tool_variables?.goalPath || null
    }
  };

  const prompt = [
    'You are an expert short-form video creative director and retention analyst.',
    '',
    'Using the provided chunk-level emotion analysis and computed metrics, generate actionable recommendations to improve viewer retention and emotional impact.',
    '',
    'Final recommendation JSON schema:',
    '{',
    '  "text": string,                  // 2-5 sentence executive recommendation',
    '  "reasoning": string,             // 3-8 sentences referencing evidence in the data',
    '  "confidence": number,            // 0..1',
    '  "keyFindings": string[],         // 3-8 bullets',
    '  "suggestions": string[]          // 5-12 bullets; concrete edits',
    '}',
    '',
    'Rules:',
    '- Keep it specific (talk about the start/hook, pacing, emotional beats).',
    '- If data is insufficient, say so and provide next steps.',
    '- Do not invent timestamps or quotes not present in the input.',
    '- Return JSON only. No markdown fences or commentary.',
    '',
    'INPUT:',
    JSON.stringify({ pipelineMeta, metricsSummary, chunkSummaries }, null, 2)
  ].join('\n');

  return `${prompt}${buildRecoveryPromptAddendum(recoveryRuntime)}`;
}

function buildToolLoopPrompt({ basePrompt, toolContract, history, remainingTurns, remainingValidatorCalls }) {
  return [
    basePrompt,
    '',
    'LOCAL TOOL LOOP:',
    'You have access to one local validation tool. You may respond with exactly one JSON object in one of these forms:',
    '1) Canonical minimal tool call envelope:',
    JSON.stringify(toolContract.canonicalEnvelope, null, 2),
    '2) Final recommendation JSON matching the schema above.',
    '',
    'Acceptance rules:',
    `- The final recommendation is accepted only after ${TOOL_NAME} returns {"valid": true}.`,
    `- If you call the tool, use exactly this canonical minimal envelope: {"tool":"${TOOL_NAME}","recommendation":{...}}.`,
    '- Do not add type/toolName/arguments/args/input wrappers around the tool call. Wrapper aliases are forbidden.',
    '- If the validator reports problems, revise and either call the tool again or return a revised recommendation JSON candidate.',
    '- After the validator returns valid=true, return ONLY the final recommendation JSON object with no wrapper.',
    '- Do not emit markdown, prose, or multiple objects.',
    '',
    'Tool contract:',
    JSON.stringify(toolContract, null, 2),
    '',
    'Current turn budget:',
    JSON.stringify({ remainingTurns, remainingValidatorCalls }, null, 2),
    '',
    'Conversation state:',
    JSON.stringify(history, null, 2)
  ].join('\n');
}

function normalizeRecommendationForComparison(recommendation) {
  if (!recommendation || typeof recommendation !== 'object' || Array.isArray(recommendation)) return null;

  return JSON.stringify({
    text: recommendation.text,
    reasoning: recommendation.reasoning,
    confidence: recommendation.confidence,
    keyFindings: recommendation.keyFindings,
    suggestions: recommendation.suggestions
  });
}

async function executeRecommendationToolLoop({
  provider,
  adapter,
  basePrompt,
  toolLoopConfig,
  promptRef,
  events,
  ctx
}) {
  const toolContract = buildRecommendationValidatorToolContract();
  const history = [];
  let successfulValidatedRecommendation = null;
  let validatorCalls = 0;
  let finalCompletion = null;
  let finalValidation = null;
  let finalPromptMode = 'tool_loop';

  for (let turn = 1; turn <= toolLoopConfig.maxTurns; turn += 1) {
    const remainingTurns = toolLoopConfig.maxTurns - turn + 1;
    const remainingValidatorCalls = Math.max(toolLoopConfig.maxValidatorCalls - validatorCalls, 0);
    const prompt = buildToolLoopPrompt({
      basePrompt,
      toolContract,
      history,
      remainingTurns,
      remainingValidatorCalls
    });

    const promptMode = turn === 1 ? 'tool_loop' : 'tool_loop_followup';
    finalPromptMode = promptMode;

    const completion = await provider.complete({
      prompt,
      model: adapter?.model,
      apiKey: process.env.AI_API_KEY,
      options: buildProviderOptions({
        adapter,
        defaults: {
          temperature: 0.2
        }
      })
    });

    finalCompletion = completion;
    const rawContent = completion?.content;

    history.push({
      role: 'assistant',
      turn,
      kind: 'model_output',
      raw: rawContent
    });

    const parsedObject = parseJsonObjectInput(rawContent);
    if (!parsedObject.ok) {
      throw createRetryableError('invalid_output: response was not valid JSON', {
        group: parsedObject.meta?.stage || 'parse',
        raw: parsedObject.meta?.raw || rawContent || null,
        extracted: parsedObject.meta?.extracted || null,
        parseError: parsedObject.meta?.parseError || null,
        validationErrors: parsedObject.errors,
        validationSummary: parsedObject.summary,
        completion,
        promptMode,
        promptRef: promptRef ? { sha256: promptRef.sha256, file: promptRef.file } : null,
        toolLoop: {
          maxTurns: toolLoopConfig.maxTurns,
          maxValidatorCalls: toolLoopConfig.maxValidatorCalls,
          turn,
          validatorCalls,
          history
        }
      });
    }

    const toolCall = parseRecommendationToolCallEnvelope(parsedObject.value);
    if (toolCall.ok) {
      if (validatorCalls >= toolLoopConfig.maxValidatorCalls) {
        throw createRetryableError(`invalid_output: exceeded ${TOOL_NAME} tool-call limit`, {
          group: 'tool_loop',
          raw: rawContent || null,
          extracted: parsedObject.meta?.extracted || null,
          validationErrors: [
            {
              path: '$',
              code: 'tool_call_limit_exceeded',
              message: `Exceeded ${TOOL_NAME} tool-call limit.`
            }
          ],
          validationSummary: `Exceeded ${TOOL_NAME} tool-call limit. Return a final validated recommendation JSON.`,
          completion,
          promptMode,
          promptRef: promptRef ? { sha256: promptRef.sha256, file: promptRef.file } : null,
          toolLoop: {
            maxTurns: toolLoopConfig.maxTurns,
            maxValidatorCalls: toolLoopConfig.maxValidatorCalls,
            turn,
            validatorCalls,
            history
          }
        });
      }

      validatorCalls += 1;
      const toolResult = executeRecommendationValidatorTool(toolCall.value.arguments);

      history.push({
        role: 'tool',
        turn,
        kind: toolResult.valid ? 'validator_acceptance' : 'validator_rejection',
        toolName: TOOL_NAME,
        toolCall: toolCall.value,
        result: toolResult
      });

      if (toolResult.valid && toolResult.normalizedRecommendation) {
        successfulValidatedRecommendation = toolResult.normalizedRecommendation;
      }

      continue;
    }

    if (toolCall.kind === 'malformed_tool_call') {
      history.push({
        role: 'tool',
        turn,
        kind: 'malformed_tool_call_envelope',
        toolName: TOOL_NAME,
        source: 'model_output',
        toolCall: sanitizeRawCaptureValue(toolCall.envelope || parsedObject.value),
        result: {
          ok: false,
          valid: false,
          toolName: TOOL_NAME,
          summary: toolCall.summary,
          errors: toolCall.errors || [],
          malformedEnvelope: true
        }
      });
      continue;
    }

    const autoToolArgs = { recommendation: parsedObject.value };

    if (validatorCalls >= toolLoopConfig.maxValidatorCalls) {
      throw createRetryableError(`invalid_output: exceeded ${TOOL_NAME} tool-call limit`, {
        group: 'tool_loop',
        raw: rawContent || null,
        extracted: parsedObject.meta?.extracted || null,
        validationErrors: [
          {
            path: '$',
            code: 'tool_call_limit_exceeded',
            message: `Exceeded ${TOOL_NAME} tool-call limit before recommendation could be validated.`
          }
        ],
        validationSummary: `Exceeded ${TOOL_NAME} tool-call limit before recommendation could be validated.`,
        completion,
        promptMode,
        promptRef: promptRef ? { sha256: promptRef.sha256, file: promptRef.file } : null,
        toolLoop: {
          maxTurns: toolLoopConfig.maxTurns,
          maxValidatorCalls: toolLoopConfig.maxValidatorCalls,
          turn,
          validatorCalls,
          history
        }
      });
    }

    validatorCalls += 1;
    const toolResult = executeRecommendationValidatorTool(autoToolArgs);
    const autoValidationKind = successfulValidatedRecommendation
      ? (toolResult.valid ? 'final_artifact_revalidation' : 'final_artifact_rejection')
      : (toolResult.valid ? 'tool_result_auto_validation' : 'validator_rejection');

    history.push({
      role: 'tool',
      turn,
      kind: autoValidationKind,
      toolName: TOOL_NAME,
      source: successfulValidatedRecommendation ? 'final_artifact_auto_validation' : 'auto_validate_candidate_json',
      toolCall: {
        tool: TOOL_NAME,
        recommendation: autoToolArgs.recommendation,
        arguments: autoToolArgs
      },
      result: toolResult
    });

    if (!toolResult.valid) {
      continue;
    }

    const parsedRecommendation = parseRecommendationResponse(parsedObject.value);
    if (!parsedRecommendation.ok) {
      continue;
    }

    const validatedRecommendation = toolResult.normalizedRecommendation;
    const parsedNormalized = normalizeRecommendationForComparison(parsedRecommendation.value);
    const validatedNormalized = normalizeRecommendationForComparison(validatedRecommendation);

    if (!successfulValidatedRecommendation) {
      successfulValidatedRecommendation = validatedRecommendation;
      continue;
    }

    if (parsedNormalized !== validatedNormalized) {
      successfulValidatedRecommendation = validatedRecommendation;
      continue;
    }

    finalValidation = parsedRecommendation;

    events.emit({
      kind: 'tool.loop.complete',
      phase: PHASE_KEY,
      script: SCRIPT_ID,
      domain: 'recommendation',
      attempt: ctx.attempt,
      attemptInTarget: ctx.attemptInTarget,
      targetIndex: ctx.targetIndex,
      validatorCalls,
      turns: turn,
      toolName: TOOL_NAME,
      provider: adapter?.name || null,
      model: adapter?.model || null,
    });

    return {
      completion,
      parsed: parsedRecommendation.value,
      validation: parsedRecommendation,
      requestPrompt: {
        mode: promptMode,
        repairSummary: null
      },
      toolLoop: {
        toolName: TOOL_NAME,
        maxTurns: toolLoopConfig.maxTurns,
        maxValidatorCalls: toolLoopConfig.maxValidatorCalls,
        turns: turn,
        validatorCalls,
        history,
        finalRecommendation: validatedRecommendation
      }
    };
  }

  throw createRetryableError(`invalid_output: recommendation tool loop exhausted after ${toolLoopConfig.maxTurns} turns`, {
    group: 'tool_loop',
    raw: finalCompletion?.content || null,
    extracted: null,
    parseError: null,
    validationErrors: [
      {
        path: '$',
        code: 'tool_loop_exhausted',
        message: `Recommendation tool loop exhausted after ${toolLoopConfig.maxTurns} turns.`
      }
    ],
    validationSummary: `Recommendation tool loop exhausted after ${toolLoopConfig.maxTurns} turns. Ensure the model validates the recommendation and then returns final JSON only.`,
    completion: finalCompletion,
    promptMode: finalPromptMode,
    promptRef: promptRef ? { sha256: promptRef.sha256, file: promptRef.file } : null,
    toolLoop: {
      toolName: TOOL_NAME,
      maxTurns: toolLoopConfig.maxTurns,
      maxValidatorCalls: toolLoopConfig.maxValidatorCalls,
      turns: toolLoopConfig.maxTurns,
      validatorCalls,
      history,
      finalValidation: finalValidation ? sanitizeRawCaptureValue(finalValidation) : null
    }
  });
}

/**
 * Main entry point
 */
async function run(input) {
  const { outputDir, artifacts = {}, config } = input;

  console.log('   🤖 Generating AI recommendation...');

  const replayMode = isReplayMode();

  if (!replayMode && !process.env.AI_API_KEY) {
    console.error('   ❌ ERROR: AI_API_KEY environment variable is not set');
    throw new Error('AI_API_KEY is required for recommendations unless DIGITAL_TWIN_MODE=replay');
  }

  const configForRecommendation = config || {};
  const retryConfig = getRetryConfig(configForRecommendation);
  const toolLoopConfig = getToolLoopConfig(configForRecommendation);
  const recoveryRuntime = getRecoveryRuntime(input);

  fs.mkdirSync(outputDir, { recursive: true });

  const {
    chunkAnalysis = { chunks: [], totalTokens: 0, videoDuration: 0 },
    metricsData = {}
  } = artifacts;

  const chunks = Array.isArray(chunkAnalysis.chunks) ? chunkAnalysis.chunks : [];
  const { successfulChunks, failedChunks } = splitChunksByStatus(chunks);

  const captureRaw = shouldCaptureRaw(configForRecommendation);

  const events = getEventsLogger({ outputDir, config: configForRecommendation });
  events.emit({ kind: 'script.start', phase: PHASE_KEY, script: SCRIPT_ID });

  const rawDir = getRawPhaseDir(outputDir, PHASE_KEY);
  const rawMetaDir = path.join(rawDir, '_meta');
  const aiRawDir = path.join(rawDir, 'ai', 'recommendation');

  const phaseErrors = [];
  let phaseOutcome = 'success';
  let fatalPhaseError = null;

  const recordPhaseError = (entry) => {
    phaseErrors.push({
      ts: new Date().toISOString(),
      ...entry
    });

    events.error({
      message: entry?.message || null,
      phase: PHASE_KEY,
      script: SCRIPT_ID,
      where: entry?.kind || entry?.level || null,
      extra: {
        kind: entry?.kind || null,
        level: entry?.level || null,
        errorName: entry?.errorName || null,
        errorCode: entry?.errorCode || null,
        errorStatus: entry?.errorStatus || null,
        errorRequestId: entry?.errorRequestId || null,
        errorClassification: entry?.errorClassification || null,
      }
    });
  };

  const writeRecommendationRaw = (payload) => {
    if (!captureRaw) return;

    const attempt = Number.isInteger(payload?.attempt) ? payload.attempt : 1;

    const attemptRelDir = path.join(`attempt-${pad(attempt, 2)}`);
    const attemptRelPath = path.join(attemptRelDir, 'capture.json');

    const capturePath = writeRawJson(aiRawDir, attemptRelPath, payload);
    events.artifactWrite({ absolutePath: capturePath, role: 'raw.ai.attempt', phase: PHASE_KEY, script: SCRIPT_ID });

    const pointerPath = writeRawJson(aiRawDir, 'recommendation.json', {
      schemaVersion: 2,
      kind: 'pointer',
      updatedAt: new Date().toISOString(),
      latestAttempt: attempt,
      target: {
        dir: attemptRelDir,
        file: attemptRelPath
      }
    });
    events.artifactWrite({ absolutePath: pointerPath, role: 'raw.ai.pointer', phase: PHASE_KEY, script: SCRIPT_ID });
  };

  try {
    const recommendationTargets = configForRecommendation?.ai?.recommendation?.targets;
    if (!Array.isArray(recommendationTargets) || recommendationTargets.length < 1) {
      const err = new Error(
        'Missing required "ai.recommendation.targets" (must be a non-empty array). ' +
        'This script no longer falls back to ai.video.targets; update your config to include ai.recommendation.targets.'
      );
      err.code = 'CONFIG_MISSING_RECOMMENDATION_TARGETS';
      throw err;
    }

    const basePrompt = buildPrompt({
      chunks: successfulChunks,
      metricsData,
      config: configForRecommendation,
      recoveryRuntime
    });

    const promptRef = captureRaw
      ? storePromptPayload({ outputDir, payload: basePrompt })
      : null;

    if (promptRef?.absolutePath) {
      events.artifactWrite({ absolutePath: promptRef.absolutePath, role: 'raw.prompt', phase: PHASE_KEY, script: SCRIPT_ID });
    }

    const attemptStartMs = new Map();

    const { result: aiResult, meta } = await executeWithTargets({
      config: configForRecommendation,
      domain: 'recommendation',
      retry: retryConfig,
      replayMode,
      operation: async (ctx) => {
        const adapter = ctx?.target?.adapter;
        const attemptKey = String(ctx?.attempt || '');

        if (attemptKey && !attemptStartMs.has(attemptKey)) {
          attemptStartMs.set(attemptKey, Date.now());
          events.emit({
            kind: 'attempt.start',
            phase: PHASE_KEY,
            script: SCRIPT_ID,
            domain: 'recommendation',
            attempt: ctx.attempt,
            attemptInTarget: ctx.attemptInTarget,
            targetIndex: ctx.targetIndex,
            targetCount: ctx.targetCount,
            adapter: adapter || null,
          });
        }

        const provider = getProviderForTarget({
          configForTarget: ctx.configForTarget,
          target: ctx.target
        });

        const providerCallStart = Date.now();
        events.emit({
          kind: 'provider.call.start',
          phase: PHASE_KEY,
          script: SCRIPT_ID,
          domain: 'recommendation',
          attempt: ctx.attempt,
          attemptInTarget: ctx.attemptInTarget,
          targetIndex: ctx.targetIndex,
          targetCount: ctx.targetCount,
          provider: adapter?.name || null,
          model: adapter?.model || null,
        });

        try {
          const result = await executeRecommendationToolLoop({
            provider,
            adapter,
            basePrompt,
            toolLoopConfig,
            promptRef,
            events,
            ctx
          });

          events.emit({
            kind: 'provider.call.end',
            phase: PHASE_KEY,
            script: SCRIPT_ID,
            domain: 'recommendation',
            attempt: ctx.attempt,
            attemptInTarget: ctx.attemptInTarget,
            targetIndex: ctx.targetIndex,
            ok: true,
            durationMs: Date.now() - providerCallStart,
            provider: adapter?.name || null,
            model: adapter?.model || null,
          });

          return result;
        } catch (error) {
          events.emit({
            kind: 'provider.call.end',
            phase: PHASE_KEY,
            script: SCRIPT_ID,
            domain: 'recommendation',
            attempt: ctx.attempt,
            attemptInTarget: ctx.attemptInTarget,
            targetIndex: ctx.targetIndex,
            ok: false,
            durationMs: Date.now() - providerCallStart,
            provider: adapter?.name || null,
            model: adapter?.model || null,
            error: error?.message || String(error),
          });
          throw error;
        }
      },
      onAttempt: ({
        ok,
        attempt,
        attemptInTarget,
        target,
        targetIndex,
        targetCount,
        failover,
        result,
        error,
        configForTarget
      }) => {
        const attemptKey = String(attempt || '');
        const startedAt = attemptKey && attemptStartMs.has(attemptKey) ? attemptStartMs.get(attemptKey) : null;

        const persistedError = ok ? null : getPersistedErrorInfo(error);

        events.emit({
          kind: 'attempt.end',
          phase: PHASE_KEY,
          script: SCRIPT_ID,
          domain: 'recommendation',
          attempt,
          attemptInTarget,
          targetIndex,
          targetCount,
          ok,
          durationMs: startedAt ? (Date.now() - startedAt) : null,
          provider: target?.adapter?.name || null,
          model: target?.adapter?.model || null,
          error: ok ? null : (error?.message || String(error)),
          errorStatus: persistedError?.status || null,
          errorRequestId: persistedError?.requestId || null,
          errorClassification: persistedError?.classification || null,
        });

        if (!captureRaw) return;

        const adapter = target?.adapter || null;
        const completion = ok
          ? result?.completion
          : error?.aiTargets?.completion;
        const errorMessage = ok ? null : (error?.message || String(error));
        const toolLoop = ok ? result?.toolLoop : error?.aiTargets?.toolLoop;

        writeRecommendationRaw({
          schemaVersion: 3,
          domain: 'recommendation',
          generatedAt: new Date().toISOString(),
          attempt,
          attemptInTarget,
          targetIndex,
          targetCount,
          adapter,
          failover: failover || null,
          promptRef: promptRef ? { sha256: promptRef.sha256, file: promptRef.file } : null,
          promptMode: ok ? (result?.requestPrompt?.mode || 'tool_loop') : (error?.aiTargets?.promptMode || 'tool_loop'),
          repairSummary: ok ? (result?.requestPrompt?.repairSummary || null) : (error?.aiTargets?.validationSummary || null),
          rawResponse: sanitizeRawCaptureValue(completion || null),
          providerRequest: sanitizeRawCaptureValue(
            ok
              ? (completion?.providerRequest || null)
              : (error?.aiTargets?.completion?.providerRequest || null)
          ),
          providerResponse: sanitizeRawCaptureValue(
            ok
              ? (completion?.providerResponse || null)
              : (error?.aiTargets?.completion?.providerResponse || null)
          ),
          parsed: ok ? (result?.parsed || null) : null,
          parseMeta: ok
            ? sanitizeRawCaptureValue(result?.parsed?._meta || null)
            : sanitizeRawCaptureValue({
                stage: error?.aiTargets?.group || null,
                raw: error?.aiTargets?.raw || error?.aiTargets?.completion?.content || null,
                extracted: error?.aiTargets?.extracted || null,
                parseError: error?.aiTargets?.parseError || null,
                validationSummary: error?.aiTargets?.validationSummary || null,
                validationErrors: error?.aiTargets?.validationErrors || null
              }),
          validation: ok
            ? sanitizeRawCaptureValue({
                summary: result?.validation?.summary || null,
                errors: result?.validation?.errors || []
              })
            : sanitizeRawCaptureValue({
                summary: error?.aiTargets?.validationSummary || null,
                errors: error?.aiTargets?.validationErrors || []
              }),
          toolLoop: sanitizeRawCaptureValue(toolLoop || null),
          error: errorMessage,
          errorName: ok ? null : (error?.name || null),
          errorCode: ok ? null : (error?.code || null),
          errorStatus: ok ? null : (persistedError?.status || null),
          errorRequestId: ok ? null : (persistedError?.requestId || null),
          errorClassification: ok ? null : (persistedError?.classification || null),
          errorStack: ok ? null : (typeof error?.stack === 'string' ? error.stack : null),
          errorDebug: ok ? null : (sanitizeRawCaptureValue(error?.debug) || null),
          errorResponse: ok ? null : (sanitizeRawCaptureValue(persistedError?.response) || null),
          provider: adapter?.name || (configForTarget?.ai?.provider || null),
          model: adapter?.model || (configForTarget?.ai?.recommendation?.model || null),
          requestMeta: {
            adapter,
            provider: adapter?.name || null,
            model: adapter?.model || null,
            attempt,
            attemptInTarget,
            targetIndex,
            targetCount,
            toolLoopConfig
          }
        });
      }
    });

    const parsed = aiResult.parsed;

    const recommendation = {
      generatedAt: new Date().toISOString(),
      pipelineVersion: configForRecommendation?.version || '8.0.0',
      text: parsed.text,
      reasoning: parsed.reasoning,
      confidence: parsed.confidence,
      keyFindings: parsed.keyFindings,
      suggestions: parsed.suggestions,
      failedChunks: failedChunks.length,
      ai: {
        attempt: meta?.attempt || 1,
        provider: meta?.target?.adapter?.name || null,
        model: meta?.target?.adapter?.model || null,
        failover: meta?.failover || null,
        toolLoop: {
          toolName: TOOL_NAME,
          maxTurns: toolLoopConfig.maxTurns,
          maxValidatorCalls: toolLoopConfig.maxValidatorCalls,
          turns: aiResult?.toolLoop?.turns || null,
          validatorCalls: aiResult?.toolLoop?.validatorCalls || null
        },
        usage: {
          input: aiResult?.completion?.usage?.input ?? null,
          output: aiResult?.completion?.usage?.output ?? null
        }
      }
    };

    const recommendationDir = outputManager.createReportDirectory(outputDir, 'recommendation');
    const recommendationPath = path.join(recommendationDir, 'recommendation.json');
    fs.writeFileSync(recommendationPath, JSON.stringify(recommendation, null, 2), 'utf8');
    events.artifactWrite({ absolutePath: recommendationPath, role: 'artifact', phase: PHASE_KEY, script: SCRIPT_ID });
    console.log(`   ✅ Recommendation saved to: ${recommendationPath}`);

    return {
      artifacts: {
        recommendationData: {
          path: recommendationPath,
          generatedAt: recommendation.generatedAt,
          text: recommendation.text,
          reasoning: recommendation.reasoning,
          confidence: recommendation.confidence,
          keyFindings: recommendation.keyFindings,
          suggestions: recommendation.suggestions,
          summary: {
            hasRecommendation: !!recommendation.text && recommendation.text !== 'No recommendation available',
            confidence: recommendation.confidence || 0
          }
        }
      }
    };
  } catch (error) {
    phaseOutcome = 'failed';
    fatalPhaseError = error;

    const isConfigError = error?.code === 'CONFIG_MISSING_RECOMMENDATION_TARGETS';
    const persistedError = getPersistedErrorInfo(error);

    recordPhaseError({
      kind: isConfigError ? 'recommendation_config_invalid' : 'recommendation_failed',
      message: error?.message || String(error),
      errorName: error?.name || null,
      errorCode: error?.code || null,
      stack: typeof error?.stack === 'string' ? error.stack : null,
      errorStatus: persistedError.status,
      errorRequestId: persistedError.requestId,
      errorClassification: persistedError.classification
    });

    if (isConfigError) {
      throw error;
    }

    const attempts = Number.isInteger(error?.aiTargets?.attempts)
      ? error.aiTargets.attempts
      : retryConfig.maxAttempts;

    throw new Error(`Recommendation generation failed after ${attempts} attempts: ${error.message}`);
  } finally {
    try {
      ensurePhaseErrorArtifacts({
        captureRaw,
        rawMetaDir,
        events,
        phaseOutcome,
        fatalPhaseError,
        phaseErrors
      });

      events.emit({ kind: 'script.end', phase: PHASE_KEY, script: SCRIPT_ID, outcome: phaseOutcome });
    } catch (e) {
      console.warn('   ⚠️  Warning: Failed to write recommendation raw error artifacts:', e?.message || String(e));
    }
  }
}

module.exports = {
  run,
  aiRecovery: {
    guidance: 'Repair malformed or validator-rejected recommendation JSON without changing the recommendation task or upstream evidence.',
    reentry: {
      allowedMutableInputs: ['repairInstructions', 'boundedContextSummary'],
      forbiddenMutableInputs: ['upstreamArtifacts', 'artifactPaths', 'schemaDefinition', 'runtimeBudgets']
    }
  },
  _private: {
    parseRecommendationResponse,
    executeRecommendationToolLoop,
    buildToolLoopPrompt,
    getToolLoopConfig
  }
};

if (require.main === module) {
  const outputDir = process.argv[2] || 'output/test-recommendation';

  run({
    outputDir,
    artifacts: {
      chunkAnalysis: {
        chunks: [
          {
            chunkIndex: 0,
            startTime: 0,
            endTime: 8,
            summary: 'Energetic intro with quick cuts.',
            emotions: {
              excitement: { score: 8, reasoning: 'High energy' },
              boredom: { score: 2, reasoning: 'Very engaging' },
              curiosity: { score: 7, reasoning: 'Intriguing content' }
            },
            dominant_emotion: 'excitement',
            confidence: 0.8
          }
        ],
        videoDuration: 8
      },
      metricsData: {
        averages: { excitement: 0.8, boredom: 0.2, curiosity: 0.7 },
        frictionIndex: 0.1
      }
    },
    config: {
      version: '8.0.0',
      name: 'Test Pipeline',
      ai: {
        recommendation: {
          targets: [
            { adapter: { name: 'openrouter', model: 'google/gemini-2.5-flash' } }
          ]
        }
      },
      debug: { captureRaw: true }
    }
  })
    .then((result) => {
      console.log('Recommendation generation complete:', JSON.stringify(result.artifacts, null, 2));
    })
    .catch((err) => {
      console.error(err);
      process.exitCode = 1;
    });
}
