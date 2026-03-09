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
 *
 * @module scripts/report/recommendation
 */

const fs = require('fs');
const path = require('path');

const outputManager = require('../../lib/output-manager.cjs');
const { splitChunksByStatus } = require('../../lib/chunk-analysis-status.cjs');
const { shouldCaptureRaw, getRawPhaseDir, writeRawJson } = require('../../lib/raw-capture.cjs');
const {
  executeWithTargets,
  getProviderForTarget,
  createRetryableError
} = require('../../lib/ai-targets.cjs');

const PHASE_KEY = 'phase3-report';

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

function sanitizeRawCaptureValue(value, depth = 0, seen = new WeakSet()) {
  if (value === null || value === undefined) return value;
  if (depth > 8) return '[Truncated]';

  if (typeof value === 'string') {
    if (value.startsWith('Bearer ')) return 'Bearer [REDACTED]';
    return value;
  }

  if (typeof value !== 'object') return value;

  if (seen.has(value)) return '[Circular]';
  seen.add(value);

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeRawCaptureValue(item, depth + 1, seen));
  }

  const out = {};
  for (const [key, item] of Object.entries(value)) {
    if (/authorization/i.test(key) || /api[_-]?key/i.test(key)) {
      out[key] = '[REDACTED]';
      continue;
    }
    out[key] = sanitizeRawCaptureValue(item, depth + 1, seen);
  }

  return out;
}

function ensurePhaseErrorArtifacts({ captureRaw, rawMetaDir, phaseOutcome, fatalPhaseError, phaseErrors }) {
  if (!captureRaw) return;

  fs.mkdirSync(rawMetaDir, { recursive: true });
  const errorsPath = path.join(rawMetaDir, 'errors.jsonl');

  if (phaseErrors.length > 0) {
    const lines = phaseErrors.map((e) => JSON.stringify(e)).join('\n') + '\n';
    fs.appendFileSync(errorsPath, lines, 'utf8');
  } else if (!fs.existsSync(errorsPath)) {
    // Create empty file so downstream tooling can rely on it existing.
    fs.writeFileSync(errorsPath, '', 'utf8');
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

  writeRawJson(rawMetaDir, 'errors.summary.json', summary);
}

function buildPrompt({ chunks, metricsData, config }) {
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

  return [
    'You are an expert short-form video creative director and retention analyst.',
    '',
    'Using the provided chunk-level emotion analysis and computed metrics, generate actionable recommendations to improve viewer retention and emotional impact.',
    '',
    'Return ONLY valid JSON (no markdown, no commentary) matching this schema:',
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
    '',
    'INPUT:',
    JSON.stringify({ pipelineMeta, metricsSummary, chunkSummaries }, null, 2)
  ].join('\n');
}

function parseRecommendationResponse(content) {
  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch (e) {
    throw createRetryableError('invalid_output: response was not valid JSON', {
      group: 'parse',
      raw: content
    });
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw createRetryableError('invalid_output: response must be a JSON object', {
      group: 'parse',
      parsed
    });
  }

  if (typeof parsed.text !== 'string' || parsed.text.trim().length === 0) {
    throw createRetryableError('invalid_output: "text" must be a non-empty string', {
      group: 'parse',
      parsed
    });
  }

  if (typeof parsed.reasoning !== 'string' || parsed.reasoning.trim().length === 0) {
    throw createRetryableError('invalid_output: "reasoning" must be a non-empty string', {
      group: 'parse',
      parsed
    });
  }

  const confidence = typeof parsed.confidence === 'number' && !Number.isNaN(parsed.confidence)
    ? Math.max(0, Math.min(1, parsed.confidence))
    : 0.5;

  const keyFindings = Array.isArray(parsed.keyFindings)
    ? parsed.keyFindings.filter((x) => typeof x === 'string' && x.trim().length > 0)
    : [];

  const suggestions = Array.isArray(parsed.suggestions)
    ? parsed.suggestions.filter((x) => typeof x === 'string' && x.trim().length > 0)
    : [];

  return {
    text: parsed.text.trim(),
    reasoning: parsed.reasoning.trim(),
    confidence,
    keyFindings,
    suggestions
  };
}

function getConfigForRecommendation(config = {}) {
  // Backward compatibility: if ai.recommendation is absent, reuse video targets.
  // This keeps existing configs functioning while the new keys roll out.
  if (config?.ai?.recommendation?.targets) return config;

  if (config?.ai?.video?.targets) {
    return {
      ...config,
      ai: {
        ...(config.ai || {}),
        recommendation: {
          // Inherit a retry policy if one exists for video; otherwise, the default
          // retry config is (1 attempt, 0 backoff).
          ...(config?.ai?.video?.retry ? { retry: config.ai.video.retry } : {}),
          targets: config.ai.video.targets
        }
      }
    };
  }

  return config;
}

/**
 * Main entry point
 *
 * @async
 * @function run
 * @param {object} input - Script input
 * @param {string} input.outputDir - Base output directory
 * @param {object} input.artifacts - Artifacts from previous phases/scripts
 * @param {object} input.config - Pipeline config
 * @returns {Promise<object>} - Script output: { artifacts: object }
 */
async function run(input) {
  const { outputDir, artifacts = {}, config } = input;

  console.log('   🤖 Generating AI recommendation...');

  const replayMode = isReplayMode();

  // Verify AI_API_KEY is available for live calls only
  if (!replayMode && !process.env.AI_API_KEY) {
    console.error('   ❌ ERROR: AI_API_KEY environment variable is not set');
    throw new Error('AI_API_KEY is required for recommendations unless DIGITAL_TWIN_MODE=replay');
  }

  const configForRecommendation = getConfigForRecommendation(config);
  const retryConfig = getRetryConfig(configForRecommendation);

  // Ensure output directory exists
  fs.mkdirSync(outputDir, { recursive: true });

  // Extract artifacts from previous phases
  const {
    chunkAnalysis = { chunks: [], totalTokens: 0, videoDuration: 0 },
    metricsData = {}
  } = artifacts;

  const chunks = Array.isArray(chunkAnalysis.chunks) ? chunkAnalysis.chunks : [];
  const { successfulChunks, failedChunks } = splitChunksByStatus(chunks);

  const captureRaw = shouldCaptureRaw(configForRecommendation);
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
  };

  const writeRecommendationRaw = (payload) => {
    if (!captureRaw) return;

    const attempt = Number.isInteger(payload?.attempt) ? payload.attempt : 1;

    const attemptRelDir = path.join(`attempt-${pad(attempt, 2)}`);
    const attemptRelPath = path.join(attemptRelDir, 'capture.json');

    writeRawJson(aiRawDir, attemptRelPath, payload);

    // Legacy pointer file for stable discovery.
    writeRawJson(aiRawDir, 'recommendation.json', {
      schemaVersion: 2,
      kind: 'pointer',
      updatedAt: new Date().toISOString(),
      latestAttempt: attempt,
      target: {
        dir: attemptRelDir,
        file: attemptRelPath
      }
    });
  };

  try {
    const prompt = buildPrompt({ chunks: successfulChunks, metricsData, config: configForRecommendation });

    const { result: aiResult, meta } = await executeWithTargets({
      config: configForRecommendation,
      domain: 'recommendation',
      retry: retryConfig,
      replayMode,
      operation: async (ctx) => {
        const adapter = ctx?.target?.adapter;
        const provider = getProviderForTarget({
          configForTarget: ctx.configForTarget,
          target: ctx.target
        });

        const completion = await provider.complete({
          prompt,
          model: adapter?.model,
          apiKey: process.env.AI_API_KEY,
          options: {
            temperature: 0.4,
            maxTokens: 900,
            ...(
              adapter && adapter.params && typeof adapter.params === 'object' && !Array.isArray(adapter.params)
                ? adapter.params
                : {}
            )
          }
        });

        const parsed = parseRecommendationResponse(completion.content);
        return { completion, parsed };
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
        const adapter = target?.adapter || null;

        const completion = ok
          ? result?.completion
          : error?.aiTargets?.completion;

        const errorMessage = ok ? null : (error?.message || String(error));

        writeRecommendationRaw({
          schemaVersion: 2,
          domain: 'recommendation',
          generatedAt: new Date().toISOString(),
          attempt,
          attemptInTarget,
          targetIndex,
          targetCount,
          adapter,
          failover: failover || null,
          prompt,
          rawResponse: ok ? sanitizeRawCaptureValue(completion) : null,
          parsed: ok ? (result?.parsed || null) : null,
          error: errorMessage,
          errorName: ok ? null : (error?.name || null),
          errorCode: ok ? null : (error?.code || null),
          errorStatus: ok ? null : (error?.response?.status || null),
          errorStack: ok ? null : (typeof error?.stack === 'string' ? error.stack : null),
          errorDebug: ok ? null : (sanitizeRawCaptureValue(error?.debug) || null),
          errorResponse: ok ? null : (sanitizeRawCaptureValue(error?.response?.data) || null),
          provider: adapter?.name || (configForTarget?.ai?.provider || null),
          model: adapter?.model || (configForTarget?.ai?.recommendation?.model || null),
          requestMeta: {
            adapter,
            provider: adapter?.name || null,
            model: adapter?.model || null,
            attempt,
            attemptInTarget,
            targetIndex,
            targetCount
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
        usage: {
          input: aiResult?.completion?.usage?.input ?? null,
          output: aiResult?.completion?.usage?.output ?? null
        }
      }
    };

    // Create recommendation subdirectory under phase3-report
    const recommendationDir = outputManager.createReportDirectory(outputDir, 'recommendation');

    // Save recommendation JSON
    const recommendationPath = path.join(recommendationDir, 'recommendation.json');
    fs.writeFileSync(recommendationPath, JSON.stringify(recommendation, null, 2), 'utf8');
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

    recordPhaseError({
      kind: 'recommendation_failed',
      message: error?.message || String(error),
      stack: typeof error?.stack === 'string' ? error.stack : null
    });

    const attempts = Number.isInteger(error?.aiTargets?.attempts)
      ? error.aiTargets.attempts
      : retryConfig.maxAttempts;

    throw new Error(`Recommendation generation failed after ${attempts} attempts: ${error.message}`);
  } finally {
    try {
      ensurePhaseErrorArtifacts({
        captureRaw,
        rawMetaDir,
        phaseOutcome,
        fatalPhaseError,
        phaseErrors
      });
    } catch (e) {
      console.warn('   ⚠️  Warning: Failed to write recommendation raw error artifacts:', e?.message || String(e));
    }
  }
}

module.exports = { run };

// Allow standalone execution for testing
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
