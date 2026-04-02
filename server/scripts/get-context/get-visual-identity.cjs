#!/usr/bin/env node
/**
 * Dedicated Phase 1 visual identity extraction lane.
 *
 * Produces an additive phase1-gather-context/visual-identity-data.json artifact
 * without overloading chunkAnalysis.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');

const outputManager = require('../../lib/output-manager.cjs');
const { shouldCaptureRaw, getRawPhaseDir, sanitizeRawCaptureValue, writeRawJson } = require('../../lib/raw-capture.cjs');
const { getEventsLogger } = require('../../lib/events-timeline.cjs');
const { storePromptPayload } = require('../../lib/prompt-store.cjs');
const { getRecoveryRuntime, buildRecoveryPromptAddendum } = require('../../lib/ai-recovery-runtime.cjs');
const {
  executeWithTargets,
  createRetryableError,
  getProviderForTarget,
  getPersistedErrorInfo,
  buildProviderOptions
} = require('../../lib/ai-targets.cjs');
const { executeLocalValidatorToolLoop } = require('../../lib/local-validator-tool-loop.cjs');
const { resolveMediaInput } = require('../../lib/media-delivery.cjs');
const {
  resolveProviderRuntimeConfigForTarget,
  ensureRuntimeAuthForDomain,
  buildProviderOptionDefaults
} = require('../../lib/provider-runtime-config.cjs');
const {
  TOOL_NAME,
  buildVisualIdentityValidatorToolContract,
  executeVisualIdentityValidatorTool
} = require('../../lib/visual-identity-validator.cjs');
const { ffprobePath } = require('../../lib/ffmpeg-path.cjs');

const execAsync = promisify(exec);
const PHASE_KEY = 'phase1-gather-context';
const SCRIPT_ID = 'get-visual-identity';

function compactString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function isReplayMode() {
  return (process.env.DIGITAL_TWIN_MODE || '').trim().toLowerCase() === 'replay';
}

function getRetryConfig(config = {}, domain = 'video_identity') {
  const retry = config?.ai?.[domain]?.retry || {};
  return {
    maxAttempts: Number.isInteger(retry.maxAttempts) && retry.maxAttempts > 0 ? retry.maxAttempts : 2,
    backoffMs: Number.isInteger(retry.backoffMs) && retry.backoffMs >= 0 ? retry.backoffMs : 500,
    retryOnParseError: true,
    retryOnProviderError: true
  };
}

function getToolLoopConfig(config = {}, domain = 'video_identity') {
  const toolLoop = config?.ai?.[domain]?.toolLoop || {};
  return {
    maxTurns: Number.isInteger(toolLoop.maxTurns) && toolLoop.maxTurns > 1 ? toolLoop.maxTurns : 4,
    maxValidatorCalls: Number.isInteger(toolLoop.maxValidatorCalls) && toolLoop.maxValidatorCalls > 0 ? toolLoop.maxValidatorCalls : 3
  };
}

function hasConfiguredTargets(config = {}, domain = 'video_identity') {
  const domainConfig = config?.ai?.[domain] || {};
  return (Array.isArray(domainConfig.targets) && domainConfig.targets.length > 0)
    || compactString(domainConfig.model).length > 0;
}

function resolveVisualIdentityDomain(config = {}) {
  return hasConfiguredTargets(config, 'video_identity') ? 'video_identity' : 'video';
}

function getPrimaryAdapter(config = {}, domain = 'video_identity') {
  const targets = config?.ai?.[domain]?.targets;
  if (Array.isArray(targets) && targets.length > 0) {
    const adapter = targets[0]?.adapter;
    if (adapter && typeof adapter === 'object' && !Array.isArray(adapter)) {
      return adapter;
    }
  }

  const legacyModel = config?.ai?.[domain]?.model;
  if (typeof legacyModel === 'string' && legacyModel.trim().length > 0) {
    return {
      name: config?.ai?.provider || 'openrouter',
      model: legacyModel
    };
  }

  return null;
}

function formatTransportLabel(resolvedAttachment) {
  if (resolvedAttachment?.deliveryMode === 'url') {
    return resolvedAttachment?.sourceSummary?.stagedUrlType === 'presigned' ? 'presigned_url' : 'public_url';
  }
  return 'inline';
}

function formatSourceStrategy(resolvedAttachment) {
  if (resolvedAttachment?.deliveryMode === 'url') {
    return resolvedAttachment?.sourceSummary?.stagedUrlType === 'presigned' ? 'presigned_url' : 'public_url';
  }
  if (compactString(resolvedAttachment?.path)) return 'file_handle';
  if (compactString(resolvedAttachment?.data)) return 'base64';
  return 'inline';
}

function toProviderAttachment(resolvedAttachment) {
  if (resolvedAttachment?.deliveryMode === 'url' && compactString(resolvedAttachment?.url)) {
    return {
      type: 'video',
      url: resolvedAttachment.url,
      mimeType: resolvedAttachment.mimeType
    };
  }

  if (compactString(resolvedAttachment?.path)) {
    return {
      type: 'video',
      path: resolvedAttachment.path,
      mimeType: resolvedAttachment.mimeType
    };
  }

  if (compactString(resolvedAttachment?.data)) {
    return {
      type: 'video',
      data: resolvedAttachment.data,
      mimeType: resolvedAttachment.mimeType
    };
  }

  throw new Error('GetVisualIdentity: resolved attachment is missing a usable url/path/data payload.');
}

async function getVideoDuration(videoPath) {
  if (!compactString(videoPath)) return 0;
  const command = `"${ffprobePath}" -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${videoPath}"`;
  try {
    const { stdout } = await execAsync(command);
    return parseFloat(stdout.trim()) || 0;
  } catch {
    return 0;
  }
}

async function resolveDurationSeconds({ mediaRef, assetPath }) {
  const configured = Number(mediaRef?.metadata?.durationSeconds);
  if (Number.isFinite(configured) && configured > 0) {
    return configured;
  }

  const fallbackPath = compactString(mediaRef?.source?.path) || compactString(assetPath);
  const probed = await getVideoDuration(fallbackPath);
  return Number.isFinite(probed) && probed > 0 ? probed : 0;
}

function formatSupportingContext(dialogueData = {}, musicData = {}) {
  const lines = [];

  if (compactString(dialogueData?.summary)) {
    lines.push(`- Dialogue summary: ${compactString(dialogueData.summary)}`);
  }

  if (compactString(musicData?.summary)) {
    lines.push(`- Music summary: ${compactString(musicData.summary)}`);
  }

  return lines.join('\n');
}

function buildVisualIdentityPrompt({
  durationSeconds,
  transportLabel,
  resolvedAttachment,
  dialogueData,
  musicData
}) {
  let prompt = '';
  prompt += '# PHASE 1 VISUAL IDENTITY TASK\n\n';
  prompt += 'Analyze the attached FULL video as a dedicated Phase 1 visual identity evidence lane. Stay timeline-aware, evidence-oriented, and non-persona-judgment-heavy. Focus on recurring motifs, continuity, hook visuals, title-card behavior, novelty peaks, fatigue risks, and end-slate momentum.\n\n';

  prompt += '# AVAILABLE INPUTS\n\n';
  prompt += `- Attached full video transport: ${transportLabel}\n`;
  prompt += `- Attached full video MIME type: ${resolvedAttachment?.mimeType || 'video/mp4'}\n`;
  if (Number.isFinite(durationSeconds) && durationSeconds > 0) {
    prompt += `- Full video duration: ${durationSeconds.toFixed(3)} seconds\n`;
  }
  if (compactString(resolvedAttachment?.url)) {
    prompt += `- Provider-reachable staged video URL: ${resolvedAttachment.url}\n`;
  }
  prompt += '\n';

  const supportingContext = formatSupportingContext(dialogueData, musicData);
  if (supportingContext) {
    prompt += '# SUPPORTING NON-VISUAL CONTEXT\n\n';
    prompt += 'Use these only as secondary hints. Prefer the observed video when there is tension between text context and the actual asset.\n\n';
    prompt += `${supportingContext}\n\n`;
  }

  prompt += '# WHAT TO EXTRACT\n\n';
  prompt += '- A concise overall summary of the asset\'s visual identity and continuity logic.\n';
  prompt += '- A timeline of the most meaningful visual windows across the full video.\n';
  prompt += '- An identity registry covering recurring characters, locations, objects, and motifs.\n';
  prompt += '- Visual beat collections for hook moments, pattern interrupts, title cards, CTA screens, novelty peaks, and fatigue risks.\n';
  prompt += '- Editorial signals about opening read, midpoint escalation, ending momentum, and continuity strength.\n\n';

  prompt += '# GUARDRAILS\n\n';
  prompt += '- Keep the timeline sparse and meaningful; do not invent frame-by-frame coverage.\n';
  prompt += '- Prefer concrete visual evidence over abstract persona judgment.\n';
  prompt += '- When uncertain, say so plainly instead of inventing specifics.\n';
  prompt += '- Treat title cards, supers, and CTA screens as visual evidence when they materially affect momentum.\n';
  prompt += '- Keep motif labels concise and reusable so downstream reporting can cite them.\n\n';

  prompt += '# OUTPUT REQUIREMENTS\n\n';
  prompt += 'Return JSON only. No markdown fences, prose, or wrapper text. The runtime will add provenance and input metadata, so return ONLY this analysis-core JSON object:\n\n';
  prompt += '{\n';
  prompt += '  "analysisMode": "whole_asset",\n';
  prompt += '  "timingMode": "full_timeline",\n';
  prompt += '  "summary": "...",\n';
  prompt += '  "timeline": [\n';
  prompt += '    {\n';
  prompt += '      "start": 0,\n';
  prompt += '      "end": 5,\n';
  prompt += '      "kind": "scene",\n';
  prompt += '      "visualSummary": "...",\n';
  prompt += '      "entities": ["..."],\n';
  prompt += '      "hooks": ["..."],\n';
  prompt += '      "risks": ["..."],\n';
  prompt += '      "continuity": {\n';
  prompt += '        "introduces": ["..."],\n';
  prompt += '        "paysOff": ["..."],\n';
  prompt += '        "callbacks": ["..."]\n';
  prompt += '      }\n';
  prompt += '    }\n';
  prompt += '  ],\n';
  prompt += '  "identityRegistry": {\n';
  prompt += '    "characters": ["..."],\n';
  prompt += '    "locations": ["..."],\n';
  prompt += '    "objects": ["..."],\n';
  prompt += '    "motifs": ["..."]\n';
  prompt += '  },\n';
  prompt += '  "visualBeats": {\n';
  prompt += '    "hookMoments": [{ "start": 0, "end": 3, "label": "...", "summary": "..." }],\n';
  prompt += '    "patternInterrupts": [{ "start": 0, "end": 0, "label": "...", "summary": "..." }],\n';
  prompt += '    "titleCards": [{ "start": 0, "end": 0, "label": "...", "summary": "..." }],\n';
  prompt += '    "ctaScreens": [{ "start": 0, "end": 0, "label": "...", "summary": "..." }],\n';
  prompt += '    "noveltyPeaks": [{ "start": 0, "end": 0, "label": "...", "summary": "..." }],\n';
  prompt += '    "fatigueRisks": [{ "start": 0, "end": 0, "label": "...", "summary": "..." }]\n';
  prompt += '  },\n';
  prompt += '  "editorialSignals": {\n';
  prompt += '    "openingRead": "...",\n';
  prompt += '    "midpointEscalation": "...",\n';
  prompt += '    "endingMomentum": "...",\n';
  prompt += '    "continuityStrength": "..."\n';
  prompt += '  }\n';
  prompt += '}\n\n';
  prompt += 'Make the output grounded, reusable by downstream reporting, and honest about uncertainty.\n';

  return prompt;
}

function buildRequestMeta({ attempt, attemptInTarget, targetIndex, targetCount, adapter }) {
  return {
    adapter: adapter || null,
    provider: adapter?.name || null,
    model: adapter?.model || null,
    attempt,
    attemptInTarget: attemptInTarget || null,
    targetIndex: Number.isInteger(targetIndex) ? targetIndex : null,
    targetCount: Number.isInteger(targetCount) ? targetCount : null
  };
}

function writeVisualIdentityRaw(aiRawDir, payload) {
  const attempt = Number.isInteger(payload?.attempt) ? payload.attempt : 1;
  const attemptDir = path.join('visual-identity', `attempt-${String(attempt).padStart(2, '0')}`);
  const attemptPath = path.join(attemptDir, 'capture.json');

  writeRawJson(aiRawDir, attemptPath, payload);
  writeRawJson(aiRawDir, 'visual-identity.json', {
    schemaVersion: 2,
    kind: 'pointer',
    updatedAt: new Date().toISOString(),
    latestAttempt: attempt,
    target: {
      dir: attemptDir,
      file: attemptPath
    }
  });
}

function buildFinalArtifact({
  visualIdentityCore,
  resolvedAttachment,
  mediaRef,
  adapter,
  durationSeconds,
  completion,
  domain
}) {
  const usage = completion?.usage || {};
  const inputTokens = Number(usage.input) || 0;
  const outputTokens = Number(usage.output) || 0;
  const coreProvenance = visualIdentityCore?.provenance && typeof visualIdentityCore.provenance === 'object' && !Array.isArray(visualIdentityCore.provenance)
    ? visualIdentityCore.provenance
    : {};

  return {
    schemaVersion: 1,
    analysisMode: visualIdentityCore.analysisMode || 'whole_asset',
    timingMode: visualIdentityCore.timingMode || 'full_timeline',
    videoDuration: durationSeconds,
    summary: visualIdentityCore.summary,
    timeline: Array.isArray(visualIdentityCore.timeline) ? visualIdentityCore.timeline : [],
    identityRegistry: visualIdentityCore.identityRegistry || {
      characters: [],
      locations: [],
      objects: [],
      motifs: []
    },
    visualBeats: visualIdentityCore.visualBeats || {
      hookMoments: [],
      patternInterrupts: [],
      titleCards: [],
      ctaScreens: [],
      noveltyPeaks: [],
      fatigueRisks: []
    },
    editorialSignals: visualIdentityCore.editorialSignals || {
      openingRead: '',
      midpointEscalation: '',
      endingMomentum: '',
      continuityStrength: ''
    },
    provenance: {
      ...coreProvenance,
      lane: 'phase1.visual_identity',
      configuredDomain: domain,
      usedChunking: false,
      fallbackApplied: false,
      transportMode: resolvedAttachment?.deliveryMode === 'url' ? 'remote_url' : 'inline',
      sourceStrategy: formatSourceStrategy(resolvedAttachment),
      mediaRef: mediaRef?.ref || null,
      sourcePath: mediaRef?.source?.path || null,
      videoUrl: resolvedAttachment?.url || null,
      provider: {
        adapter: adapter?.name || 'openrouter',
        model: adapter?.model || null,
        transport: formatTransportLabel(resolvedAttachment)
      }
    },
    ai: {
      usage: {
        input: inputTokens,
        output: outputTokens,
        total: inputTokens + outputTokens
      },
      requestCount: 1
    },
    comparisonHints: {
      additivePhase1Artifact: true,
      safeForLegacyReporting: true,
      intendedConsumers: ['phase2_optional', 'phase3_optional'],
      note: 'visualIdentityData is additive and should not replace chunkAnalysis.'
    }
  };
}

async function run(input) {
  const {
    assetPath,
    outputDir,
    artifacts = {},
    config
  } = input;

  const replayMode = isReplayMode();
  const domain = resolveVisualIdentityDomain(config);

  ensureRuntimeAuthForDomain({
    config,
    domain,
    replayMode,
    prefix: 'GetVisualIdentity'
  });

  fs.mkdirSync(outputDir, { recursive: true });

  const captureRaw = shouldCaptureRaw(config);
  const recoveryRuntime = getRecoveryRuntime(input);
  const events = getEventsLogger({ outputDir, config });
  events.emit({ kind: 'script.start', phase: PHASE_KEY, script: SCRIPT_ID });

  const phaseDir = outputManager.createPhaseDirectory(outputDir, PHASE_KEY);
  const rawDir = getRawPhaseDir(outputDir, PHASE_KEY);
  const rawMetaDir = path.join(rawDir, '_meta');
  const aiRawDir = path.join(rawDir, 'ai');
  const phaseErrors = [];
  let phaseOutcome = 'success';

  const recordPhaseError = (entry) => {
    phaseErrors.push({ ts: new Date().toISOString(), ...entry });
    events.error({
      message: entry?.message || null,
      phase: PHASE_KEY,
      script: SCRIPT_ID,
      where: entry?.kind || entry?.name || null,
      extra: {
        kind: entry?.kind || null,
        errorStatus: entry?.errorStatus || null,
        errorRequestId: entry?.errorRequestId || null,
        errorClassification: entry?.errorClassification || null
      }
    });
  };

  const writePhaseErrors = () => {
    if (!captureRaw) return;
    fs.mkdirSync(rawMetaDir, { recursive: true });
    fs.writeFileSync(path.join(rawMetaDir, 'errors.jsonl'), phaseErrors.map((entry) => JSON.stringify(entry)).join('\n') + (phaseErrors.length ? '\n' : ''), 'utf8');
    writeRawJson(rawMetaDir, 'errors.summary.json', {
      schemaVersion: 1,
      phase: PHASE_KEY,
      outcome: phaseOutcome,
      generatedAt: new Date().toISOString(),
      totalErrors: phaseErrors.length
    });
  };

  const primaryAdapter = getPrimaryAdapter(config, domain);
  if (!primaryAdapter?.model) {
    throw new Error(`GetVisualIdentity: config.ai.${domain}.targets[*].adapter.model is required`);
  }

  const retryConfig = getRetryConfig(config, domain);
  const toolLoopConfig = getToolLoopConfig(config, domain);
  const dialogueData = artifacts.dialogueData || {};
  const musicData = artifacts.musicData || {};
  const toolContract = buildVisualIdentityValidatorToolContract();

  try {
    const { result: analysisResult } = await executeWithTargets({
      config,
      domain,
      retry: retryConfig,
      replayMode,
      shouldRetry: ({ error }) => {
        const group = error?.aiTargets?.group;
        const message = String(error?.message || '');
        const parseish = group === 'parse' || group === 'tool_loop' || message.startsWith('invalid_output:');
        return parseish ? retryConfig.retryOnParseError : retryConfig.retryOnProviderError;
      },
      operation: async (ctx) => {
        const adapter = ctx?.target?.adapter;
        const provider = getProviderForTarget({
          configForTarget: ctx.configForTarget,
          target: ctx.target
        });
        const runtimeConfig = resolveProviderRuntimeConfigForTarget({
          configForTarget: ctx.configForTarget,
          target: ctx.target
        });
        const { mediaRef, resolvedAttachment } = resolveMediaInput({
          config: ctx.configForTarget,
          domain,
          assetPath,
          target: ctx.target,
          capabilities: provider?.capabilities || null
        });
        const durationSeconds = await resolveDurationSeconds({ mediaRef, assetPath });
        const transportLabel = formatTransportLabel(resolvedAttachment);
        const basePrompt = `${buildVisualIdentityPrompt({
          durationSeconds,
          transportLabel,
          resolvedAttachment,
          dialogueData,
          musicData
        })}${buildRecoveryPromptAddendum(recoveryRuntime)}`;

        const promptRef = captureRaw
          ? storePromptPayload({ outputDir, payload: basePrompt })
          : null;

        if (promptRef?.absolutePath) {
          events.artifactWrite({ absolutePath: promptRef.absolutePath, role: 'raw.prompt', phase: PHASE_KEY, script: SCRIPT_ID });
        }

        const toolLoopResult = await executeLocalValidatorToolLoop({
          provider,
          adapter,
          basePrompt,
          toolContract,
          toolLoopConfig,
          promptRef,
          events,
          ctx,
          phaseKey: PHASE_KEY,
          scriptId: SCRIPT_ID,
          domain,
          artifactLabel: 'visual identity analysis',
          finalArtifactDescription: 'Return the visual identity analysis core JSON only. Runtime metadata such as provenance and input details are added locally after validation.',
          finalArtifactRules: [
            'Include analysisMode, timingMode, summary, timeline, identityRegistry, visualBeats, and editorialSignals.',
            'Keep the timeline sparse and evidence-based instead of frame-by-frame.',
            'Treat title cards, novelty peaks, continuity callbacks, fatigue risks, and CTA screens as first-class visual evidence.',
            'Do not collapse this output into chunkAnalysis.'
          ],
          callProvider: ({ prompt }) => provider.complete({
            prompt,
            model: adapter?.model || primaryAdapter.model,
            apiKey: runtimeConfig.apiKey,
            baseUrl: runtimeConfig.baseUrl,
            attachments: [toProviderAttachment(resolvedAttachment)],
            options: buildProviderOptions({
              adapter,
              defaults: buildProviderOptionDefaults(runtimeConfig, { temperature: 0.2 })
            })
          }),
          executeValidatorTool: (args) => executeVisualIdentityValidatorTool(args),
          normalizeValidatedValue: (value) => JSON.stringify(value)
        });

        const visualIdentityData = buildFinalArtifact({
          visualIdentityCore: toolLoopResult.parsed,
          resolvedAttachment,
          mediaRef,
          adapter,
          durationSeconds,
          completion: toolLoopResult.completion,
          domain
        });

        return {
          visualIdentityData,
          completion: toolLoopResult.completion,
          toolLoop: toolLoopResult.toolLoop,
          promptRef,
          resolvedAttachment,
          mediaRef
        };
      },
      onAttempt: ({ ok, attempt, attemptInTarget, target, targetIndex, targetCount, configForTarget, result, error }) => {
        if (!captureRaw) return;

        const persistedError = ok ? null : getPersistedErrorInfo(error);
        writeVisualIdentityRaw(aiRawDir, {
          attempt,
          attemptInTarget,
          targetIndex,
          targetCount,
          adapter: target?.adapter || null,
          provider: target?.adapter?.name || configForTarget?.ai?.provider || 'openrouter',
          model: target?.adapter?.model || null,
          promptRef: ok && result?.promptRef ? { sha256: result.promptRef.sha256, file: result.promptRef.file } : null,
          attachment: ok ? sanitizeRawCaptureValue(result?.resolvedAttachment || null) : null,
          mediaRef: ok ? sanitizeRawCaptureValue(result?.mediaRef || null) : null,
          rawResponse: ok ? (result?.completion?.content || null) : null,
          providerCompletion: ok ? sanitizeRawCaptureValue(result?.completion || null) : null,
          parsed: ok ? sanitizeRawCaptureValue(result?.visualIdentityData || null) : null,
          toolLoop: ok ? sanitizeRawCaptureValue(result?.toolLoop || null) : sanitizeRawCaptureValue(error?.aiTargets?.toolLoop || null),
          error: ok ? null : (error?.message || String(error)),
          errorStatus: ok ? null : (persistedError?.status || null),
          errorRequestId: ok ? null : (persistedError?.requestId || null),
          errorClassification: ok ? null : (persistedError?.classification || null),
          errorResponse: ok ? null : sanitizeRawCaptureValue(persistedError?.response || null),
          requestMeta: buildRequestMeta({
            attempt,
            attemptInTarget,
            targetIndex,
            targetCount,
            adapter: target?.adapter || null
          })
        });
      }
    });

    const artifactPath = path.join(phaseDir, 'visual-identity-data.json');
    fs.writeFileSync(artifactPath, JSON.stringify(analysisResult.visualIdentityData, null, 2), 'utf8');
    events.artifactWrite({ absolutePath: artifactPath, role: 'artifact', phase: PHASE_KEY, script: SCRIPT_ID });

    return {
      primaryArtifactKey: 'visualIdentityData',
      artifacts: {
        visualIdentityData: {
          ...analysisResult.visualIdentityData,
          path: 'phase1-gather-context/visual-identity-data.json'
        }
      }
    };
  } catch (error) {
    phaseOutcome = 'failed';
    const persistedError = getPersistedErrorInfo(error);
    recordPhaseError({
      kind: 'visual_identity_failed',
      message: error?.message || String(error),
      stack: typeof error?.stack === 'string' ? error.stack : null,
      errorStatus: persistedError.status,
      errorRequestId: persistedError.requestId,
      errorClassification: persistedError.classification
    });
    throw error;
  } finally {
    try {
      writePhaseErrors();
    } catch {
      // ignore raw-capture write errors during cleanup
    }
    events.emit({ kind: 'script.end', phase: PHASE_KEY, script: SCRIPT_ID, outcome: phaseOutcome });
  }
}

module.exports = {
  run,
  aiRecovery: {
    guidance: 'Repair malformed or validator-rejected visual identity JSON while preserving the same full-video Phase 1 evidence-extraction task and staged media contract.',
    reentry: {
      allowedMutableInputs: ['repairInstructions', 'boundedContextSummary'],
      forbiddenMutableInputs: ['upstreamArtifacts', 'artifactPaths', 'schemaDefinition', 'runtimeBudgets']
    }
  },
  _private: {
    buildVisualIdentityPrompt,
    resolveVisualIdentityDomain,
    buildFinalArtifact,
    formatTransportLabel,
    formatSourceStrategy,
    toProviderAttachment,
    resolveDurationSeconds
  }
};

if (require.main === module) {
  console.log('get-visual-identity.cjs is intended to run via the pipeline.');
}
