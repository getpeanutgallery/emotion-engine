#!/usr/bin/env node
/**
 * Whole-video MiMo Phase 2 prototype.
 *
 * Side-path only: preserves the existing chunked Phase 2 lane while adding a
 * full-video multimodal persona evaluation script that consumes the shared
 * media-delivery contract and emits phase2-process/whole-video-analysis.json.
 */

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');
const outputManager = require('../../lib/output-manager.cjs');
const { loadPersonaConfig } = require('../../lib/persona-loader.cjs');
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
  DEFAULT_PRIMARY_LENSES,
  WHOLE_VIDEO_CATEGORY_KEYS,
  buildWholeVideoAnalysisValidatorToolContract,
  executeWholeVideoAnalysisValidatorTool
} = require('../../lib/whole-video-analysis-validator.cjs');
const { ffprobePath } = require('../../lib/ffmpeg-path.cjs');

const execAsync = promisify(exec);
const ENGINE_REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
const TOOLS_REPO_ROOT = path.resolve(ENGINE_REPO_ROOT, '..', 'tools');
const DEFAULT_CATEGORY_LABELS = Object.freeze({
  hookEffectiveness: 'Hook Effectiveness',
  valueClarity: 'Value Clarity',
  dialogueAuthenticity: 'Dialogue Authenticity',
  musicEnergyAlignment: 'Music Energy Alignment',
  visualMomentum: 'Visual Momentum',
  ctaPackaging: 'CTA Packaging',
  trust: 'Trust'
});

function normalizeToolRepoPath(inputPath) {
  if (!inputPath || path.isAbsolute(inputPath)) return inputPath;

  const directToolsPath = path.resolve(TOOLS_REPO_ROOT, inputPath);
  if (fs.existsSync(directToolsPath)) {
    return inputPath;
  }

  if (inputPath.startsWith('cast/')) {
    return `../${inputPath}`;
  }

  if (inputPath.startsWith('goals/')) {
    return `../${inputPath}`;
  }

  const legacyEnginePath = path.resolve(ENGINE_REPO_ROOT, inputPath);
  if (fs.existsSync(legacyEnginePath)) {
    return path.relative(TOOLS_REPO_ROOT, legacyEnginePath);
  }

  return inputPath;
}

function isReplayMode() {
  return (process.env.DIGITAL_TWIN_MODE || '').trim().toLowerCase() === 'replay';
}

function getRetryConfig(config = {}) {
  const retry = config?.ai?.video?.retry || {};

  return {
    maxAttempts: Number.isInteger(retry.maxAttempts) && retry.maxAttempts > 0 ? retry.maxAttempts : 2,
    backoffMs: Number.isInteger(retry.backoffMs) && retry.backoffMs >= 0 ? retry.backoffMs : 500,
    retryOnParseError: true,
    retryOnProviderError: true
  };
}

function getToolLoopConfig(config = {}) {
  const toolLoop = config?.ai?.video?.toolLoop || {};

  return {
    maxTurns: Number.isInteger(toolLoop.maxTurns) && toolLoop.maxTurns > 1 ? toolLoop.maxTurns : 4,
    maxValidatorCalls: Number.isInteger(toolLoop.maxValidatorCalls) && toolLoop.maxValidatorCalls > 0 ? toolLoop.maxValidatorCalls : 3
  };
}

function getPrimaryVideoAdapter(config = {}) {
  const targets = config?.ai?.video?.targets;
  if (Array.isArray(targets) && targets.length > 0) {
    const adapter = targets[0]?.adapter;
    if (adapter && typeof adapter === 'object' && !Array.isArray(adapter)) {
      return adapter;
    }
  }

  const legacyModel = config?.ai?.video?.model;
  if (typeof legacyModel === 'string' && legacyModel.trim().length > 0) {
    return {
      name: config?.ai?.provider || 'openrouter',
      model: legacyModel
    };
  }

  return null;
}

function compactString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizePrimaryLenses(toolVariables = {}) {
  const configured = Array.isArray(toolVariables?.variables?.lenses)
    ? toolVariables.variables.lenses.map((value) => compactString(value)).filter(Boolean)
    : [];
  return configured.length > 0 ? configured : [...DEFAULT_PRIMARY_LENSES];
}

function appendSections(title, sections = {}) {
  const entries = Object.entries(sections || {}).filter(([, value]) => compactString(value));
  if (entries.length === 0) return '';
  return `${title}\n\n${entries.map(([key, value]) => `## ${key}\n${value}`).join('\n\n')}\n\n`;
}

function formatDialogueContext(dialogueData = {}, { maxSegments = 40 } = {}) {
  const lines = [];

  if (compactString(dialogueData?.summary)) {
    lines.push(`- Summary: ${compactString(dialogueData.summary)}`);
  }

  const segments = Array.isArray(dialogueData?.dialogue_segments) ? dialogueData.dialogue_segments.slice(0, maxSegments) : [];
  if (segments.length > 0) {
    lines.push('- Notable dialogue moments:');
    for (const segment of segments) {
      const start = Number(segment?.start);
      const end = Number(segment?.end);
      const timing = Number.isFinite(start) && Number.isFinite(end)
        ? `${start.toFixed(1)}s-${end.toFixed(1)}s`
        : `${segment?.start ?? '?'}s-${segment?.end ?? '?'}s`;
      const speaker = compactString(segment?.speaker) || 'Speaker';
      const text = compactString(segment?.text) || '[inaudible / unavailable]';
      lines.push(`  - ${timing}: ${speaker}: ${text}`);
    }

    if (Array.isArray(dialogueData?.dialogue_segments) && dialogueData.dialogue_segments.length > segments.length) {
      lines.push(`  - … ${dialogueData.dialogue_segments.length - segments.length} additional segment(s) omitted for brevity.`);
    }
  }

  return lines.join('\n');
}

function formatMusicContext(musicData = {}, { maxSegments = 30 } = {}) {
  const lines = [];

  if (compactString(musicData?.summary)) {
    lines.push(`- Summary: ${compactString(musicData.summary)}`);
  }

  const segments = Array.isArray(musicData?.segments) ? musicData.segments.slice(0, maxSegments) : [];
  if (segments.length > 0) {
    lines.push('- Notable music cues:');
    for (const segment of segments) {
      const start = Number(segment?.start);
      const end = Number(segment?.end);
      const timing = Number.isFinite(start) && Number.isFinite(end)
        ? `${start.toFixed(1)}s-${end.toFixed(1)}s`
        : `${segment?.start ?? '?'}s-${segment?.end ?? '?'}s`;
      const description = compactString(segment?.description)
        || compactString(segment?.mood)
        || compactString(segment?.type)
        || 'music cue';
      lines.push(`  - ${timing}: ${description}`);
    }

    if (Array.isArray(musicData?.segments) && musicData.segments.length > segments.length) {
      lines.push(`  - … ${musicData.segments.length - segments.length} additional cue(s) omitted for brevity.`);
    }
  }

  return lines.join('\n');
}

function formatVisualIdentityContext(visualIdentityData = {}, { maxTimeline = 12, maxBeats = 3 } = {}) {
  const lines = [];

  if (compactString(visualIdentityData?.summary)) {
    lines.push(`- Summary: ${compactString(visualIdentityData.summary)}`);
  }

  const registry = visualIdentityData?.identityRegistry || {};
  const registryFields = [
    ['Characters', registry.characters],
    ['Locations', registry.locations],
    ['Objects', registry.objects],
    ['Motifs', registry.motifs]
  ];

  for (const [label, values] of registryFields) {
    if (Array.isArray(values) && values.length > 0) {
      lines.push(`- ${label}: ${values.slice(0, 8).join(', ')}`);
    }
  }

  const timeline = Array.isArray(visualIdentityData?.timeline) ? visualIdentityData.timeline.slice(0, maxTimeline) : [];
  if (timeline.length > 0) {
    lines.push('- Timeline windows:');
    for (const entry of timeline) {
      const start = Number(entry?.start);
      const end = Number(entry?.end);
      const timing = Number.isFinite(start) && Number.isFinite(end)
        ? `${start.toFixed(1)}s-${end.toFixed(1)}s`
        : `${entry?.start ?? '?'}s-${entry?.end ?? '?'}s`;
      const summary = compactString(entry?.visualSummary) || 'visual beat';
      lines.push(`  - ${timing}: ${summary}`);
    }

    if (Array.isArray(visualIdentityData?.timeline) && visualIdentityData.timeline.length > timeline.length) {
      lines.push(`  - … ${visualIdentityData.timeline.length - timeline.length} additional timeline window(s) omitted for brevity.`);
    }
  }

  const beatGroups = [
    ['Hook moments', visualIdentityData?.visualBeats?.hookMoments],
    ['Novelty peaks', visualIdentityData?.visualBeats?.noveltyPeaks],
    ['Fatigue risks', visualIdentityData?.visualBeats?.fatigueRisks]
  ];

  for (const [label, beats] of beatGroups) {
    const items = Array.isArray(beats) ? beats.slice(0, maxBeats) : [];
    if (items.length === 0) continue;
    lines.push(`- ${label}:`);
    for (const beat of items) {
      const start = Number(beat?.start);
      const end = Number(beat?.end);
      const timing = Number.isFinite(start) && Number.isFinite(end)
        ? `${start.toFixed(1)}s-${end.toFixed(1)}s`
        : `${beat?.start ?? '?'}s-${beat?.end ?? '?'}s`;
      const labelText = compactString(beat?.label) || 'visual signal';
      const summary = compactString(beat?.summary);
      lines.push(`  - ${timing}: ${labelText}${summary ? ` — ${summary}` : ''}`);
    }
  }

  return lines.join('\n');
}

function formatTransportLabel(resolvedAttachment) {
  if (resolvedAttachment?.deliveryMode === 'url') {
    return resolvedAttachment?.sourceSummary?.stagedUrlType === 'presigned' ? 'presigned_url' : 'public_url';
  }
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

  throw new Error('WholeVideoMiMo: resolved attachment is missing a usable url/path/data payload.');
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

function buildWholeVideoPrompt({
  personaConfig,
  primaryLenses,
  durationSeconds,
  transportLabel,
  resolvedAttachment,
  dialogueData,
  musicData,
  visualIdentityData
}) {
  let prompt = '';
  prompt += appendSections('# PERSONA', personaConfig?.soul || {});
  prompt += appendSections('# GOAL', personaConfig?.goal || {});

  prompt += '# WHOLE-VIDEO MIMO PHASE 2 TASK\n\n';
  prompt += 'Analyze the attached FULL video as a single multimodal experience for persona-based ad evaluation. Ground your judgment in what the full video actually shows and sounds like. Use dialogue and music context as supporting hints, but prefer the attached video whenever there is tension between text context and the observed asset.\n\n';

  prompt += '# PRIMARY WHOLE-VIDEO LENSES\n\n';
  for (const lens of primaryLenses) {
    prompt += `- ${lens}: assign a whole-video score from 1-10 plus concise reasoning.\n`;
  }
  prompt += '\n';

  prompt += '# SECONDARY WHOLE-VIDEO CATEGORIES\n\n';
  for (const categoryKey of WHOLE_VIDEO_CATEGORY_KEYS) {
    prompt += `- ${categoryKey}: ${DEFAULT_CATEGORY_LABELS[categoryKey] || categoryKey}; assign a 1-10 score plus concise reasoning.\n`;
  }
  prompt += '\n';

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

  const dialogueContext = formatDialogueContext(dialogueData);
  if (dialogueContext) {
    prompt += '# DIALOGUE CONTEXT\n\n';
    prompt += `${dialogueContext}\n\n`;
  }

  const musicContext = formatMusicContext(musicData);
  if (musicContext) {
    prompt += '# MUSIC CONTEXT\n\n';
    prompt += `${musicContext}\n\n`;
  }

  const visualIdentityContext = formatVisualIdentityContext(visualIdentityData);
  if (visualIdentityContext) {
    prompt += '# VISUAL IDENTITY CONTEXT\n\n';
    prompt += 'Use this additive Phase 1 evidence layer as optional support. Prefer the attached video whenever there is tension between prior structured context and what the video actually shows.\n\n';
    prompt += `${visualIdentityContext}\n\n`;
  }

  prompt += '# EVIDENCE EXPECTATIONS\n\n';
  prompt += '- Cite sparse timed evidence moments only; do NOT invent dense per-second coverage.\n';
  prompt += '- Include opening hook moments, strongest positive beats, strongest friction / abandonment-risk beats, and ending / CTA assessment moments when observable.\n';
  prompt += '- Each evidence moment must include timestamp, timeRange.start, timeRange.end, type (positive|friction), driver (dialogue|music|visual|cross_modal), category, impact (low|medium|high), and summary.\n';
  prompt += '- Treat the video\'s native audio as part of the evidence.\n';
  prompt += '- If dialogue or music details are unclear, say so plainly instead of inventing specifics.\n\n';

  prompt += '# ANTI-HALLUCINATION RULES\n\n';
  prompt += '- Do not claim per-second measurements.\n';
  prompt += '- Do not fabricate exact dialogue lines when unclear.\n';
  prompt += '- Do not fabricate music segmentation details beyond what can be supported.\n';
  prompt += '- Keep the numeric output at the whole-video level only.\n\n';

  prompt += '# OUTPUT REQUIREMENTS\n\n';
  prompt += 'Return JSON only. No markdown fences, prose, or wrapper text. The runtime will add provider/input metadata, so return ONLY this analysis-core JSON object:\n\n';
  prompt += '{\n';
  prompt += '  "wholeVideoScores": {\n';
  for (let index = 0; index < primaryLenses.length; index += 1) {
    const lens = primaryLenses[index];
    prompt += `    "${lens}": { "score": <1-10>, "reasoning": "..." }${index < primaryLenses.length - 1 ? ',' : ''}\n`;
  }
  prompt += '  },\n';
  prompt += '  "wholeVideoCategories": {\n';
  for (let index = 0; index < WHOLE_VIDEO_CATEGORY_KEYS.length; index += 1) {
    const category = WHOLE_VIDEO_CATEGORY_KEYS[index];
    prompt += `    "${category}": { "score": <1-10>, "reasoning": "..." }${index < WHOLE_VIDEO_CATEGORY_KEYS.length - 1 ? ',' : ''}\n`;
  }
  prompt += '  },\n';
  prompt += '  "overallSummary": "...",\n';
  prompt += '  "retentionVerdict": { "wouldComplete": "yes|maybe|no", "confidence": <0-1>, "reasoning": "..." },\n';
  prompt += '  "evidenceMoments": [\n';
  prompt += '    {\n';
  prompt += '      "timestamp": 0,\n';
  prompt += '      "timeRange": { "start": 0, "end": 3 },\n';
  prompt += '      "type": "friction",\n';
  prompt += '      "driver": "cross_modal",\n';
  prompt += '      "category": "hookEffectiveness",\n';
  prompt += '      "impact": "high",\n';
  prompt += '      "summary": "..."\n';
  prompt += '    }\n';
  prompt += '  ],\n';
  prompt += '  "strongestMoments": ["..."],\n';
  prompt += '  "biggestRisks": ["..."],\n';
  prompt += '  "recommendationSeeds": ["..."]\n';
  prompt += '}\n\n';
  prompt += 'Make the output grounded, comparable at the whole-video level, and honest about uncertainty.\n';

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

function writeWholeVideoRaw(aiRawDir, payload) {
  const attempt = Number.isInteger(payload?.attempt) ? payload.attempt : 1;
  const attemptDir = path.join('whole-video', `attempt-${String(attempt).padStart(2, '0')}`);
  const attemptPath = path.join(attemptDir, 'capture.json');

  writeRawJson(aiRawDir, attemptPath, payload);
  writeRawJson(aiRawDir, 'whole-video.json', {
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
  analysisCore,
  toolVariables,
  primaryLenses,
  resolvedAttachment,
  mediaRef,
  adapter,
  durationSeconds,
  completion
}) {
  const usage = completion?.usage || {};
  const inputTokens = Number(usage.input) || 0;
  const outputTokens = Number(usage.output) || 0;

  return {
    schemaVersion: 'ee.phase2.whole-video/v1',
    analysisMode: 'whole_video_mimo',
    provider: {
      adapter: adapter?.name || 'openrouter',
      model: adapter?.model || null,
      transport: formatTransportLabel(resolvedAttachment)
    },
    input: {
      mediaRef: mediaRef?.ref || null,
      sourcePath: mediaRef?.source?.path || null,
      videoUrl: resolvedAttachment?.url || null,
      mimeType: resolvedAttachment?.mimeType || mediaRef?.metadata?.mimeType || 'video/mp4',
      durationSeconds
    },
    persona: {
      soulPath: toolVariables?.soulPath || null,
      goalPath: toolVariables?.goalPath || null,
      primaryLenses
    },
    wholeVideoScores: analysisCore.wholeVideoScores,
    wholeVideoCategories: analysisCore.wholeVideoCategories,
    overallSummary: analysisCore.overallSummary,
    retentionVerdict: analysisCore.retentionVerdict,
    evidenceMoments: analysisCore.evidenceMoments,
    strongestMoments: analysisCore.strongestMoments,
    biggestRisks: analysisCore.biggestRisks,
    recommendationSeeds: analysisCore.recommendationSeeds,
    comparisonHints: {
      safeForChunkEquivalence: false,
      safeForPhase3Metrics: false,
      reason: 'Whole-video output is sparse, evidence-based, and not a benchmark-equivalent per-chunk timeseries.'
    },
    ai: {
      usage: {
        input: inputTokens,
        output: outputTokens,
        total: inputTokens + outputTokens
      },
      requestCount: 1
    }
  };
}

async function run(input) {
  const {
    assetPath,
    outputDir,
    artifacts = {},
    toolVariables,
    config
  } = input;

  if (!toolVariables?.soulPath || !toolVariables?.goalPath) {
    throw new Error('WholeVideoMiMo: toolVariables.soulPath and toolVariables.goalPath are required');
  }

  const replayMode = isReplayMode();
  ensureRuntimeAuthForDomain({
    config,
    domain: 'video',
    replayMode,
    prefix: 'WholeVideoMiMo'
  });

  fs.mkdirSync(outputDir, { recursive: true });

  const captureRaw = shouldCaptureRaw(config);
  const recoveryRuntime = getRecoveryRuntime(input);
  const events = getEventsLogger({ outputDir, config });
  events.emit({ kind: 'script.start', phase: 'phase2-process', script: 'whole-video-mimo' });

  const phaseDir = outputManager.createPhaseDirectory(outputDir, 'phase2-process');
  const rawDir = getRawPhaseDir(outputDir, 'phase2-process');
  const rawMetaDir = path.join(rawDir, '_meta');
  const aiRawDir = path.join(rawDir, 'ai');
  const phaseErrors = [];
  let phaseOutcome = 'success';

  const recordPhaseError = (entry) => {
    phaseErrors.push({ ts: new Date().toISOString(), ...entry });
    events.error({
      message: entry?.message || null,
      phase: 'phase2-process',
      script: 'whole-video-mimo',
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
      phase: 'phase2-process',
      outcome: phaseOutcome,
      generatedAt: new Date().toISOString(),
      totalErrors: phaseErrors.length
    });
  };

  const primaryAdapter = getPrimaryVideoAdapter(config);
  if (!primaryAdapter?.model) {
    throw new Error('WholeVideoMiMo: config.ai.video.targets[*].adapter.model is required');
  }

  const primaryLenses = normalizePrimaryLenses(toolVariables);
  const normalizedToolVariables = {
    ...toolVariables,
    soulPath: normalizeToolRepoPath(toolVariables?.soulPath),
    goalPath: normalizeToolRepoPath(toolVariables?.goalPath),
    variables: {
      ...(toolVariables?.variables || {}),
      lenses: primaryLenses,
      model: primaryAdapter.model
    }
  };

  const personaConfig = loadPersonaConfig(normalizedToolVariables.soulPath, normalizedToolVariables.goalPath);
  if (!personaConfig) {
    throw new Error('WholeVideoMiMo: failed to load persona configuration');
  }

  const retryConfig = getRetryConfig(config);
  const toolLoopConfig = getToolLoopConfig(config);
  const dialogueData = artifacts.dialogueData || {};
  const musicData = artifacts.musicData || {};
  const visualIdentityData = artifacts.visualIdentityData || {};
  const toolContract = buildWholeVideoAnalysisValidatorToolContract({ lenses: primaryLenses });

  try {
    const { result: analysisResult } = await executeWithTargets({
      config,
      domain: 'video',
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
          domain: 'video',
          assetPath,
          target: ctx.target,
          capabilities: provider?.capabilities || null
        });
        const durationSeconds = await resolveDurationSeconds({ mediaRef, assetPath });
        const transportLabel = formatTransportLabel(resolvedAttachment);
        const basePrompt = `${buildWholeVideoPrompt({
          personaConfig,
          primaryLenses,
          durationSeconds,
          transportLabel,
          resolvedAttachment,
          dialogueData,
          musicData,
          visualIdentityData
        })}${buildRecoveryPromptAddendum(recoveryRuntime)}`;

        const promptRef = captureRaw
          ? storePromptPayload({ outputDir, payload: basePrompt })
          : null;

        if (promptRef?.absolutePath) {
          events.artifactWrite({ absolutePath: promptRef.absolutePath, role: 'raw.prompt', phase: 'phase2-process', script: 'whole-video-mimo' });
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
          phaseKey: 'phase2-process',
          scriptId: 'whole-video-mimo',
          domain: 'video',
          artifactLabel: 'whole-video analysis',
          finalArtifactDescription: 'Return the whole-video analysis core JSON only. Runtime metadata such as provider/input/persona is added locally after validation.',
          finalArtifactRules: [
            'Include wholeVideoScores, wholeVideoCategories, overallSummary, retentionVerdict, evidenceMoments, strongestMoments, biggestRisks, and recommendationSeeds.',
            'Use 1-10 scores for each primary lens and category.',
            'Use sparse timed evidence moments instead of synthetic chunk-by-chunk output.',
            'Keep the assessment honest about uncertainty and grounded in the attached full video.'
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
          executeValidatorTool: (args) => executeWholeVideoAnalysisValidatorTool(args, { lenses: primaryLenses }),
          normalizeValidatedValue: (value) => JSON.stringify(value)
        });

        const wholeVideoAnalysis = buildFinalArtifact({
          analysisCore: toolLoopResult.parsed,
          toolVariables,
          primaryLenses,
          resolvedAttachment,
          mediaRef,
          adapter,
          durationSeconds,
          completion: toolLoopResult.completion
        });

        return {
          wholeVideoAnalysis,
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
        writeWholeVideoRaw(aiRawDir, {
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
          parsed: ok ? sanitizeRawCaptureValue(result?.wholeVideoAnalysis || null) : null,
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

    const artifactPath = path.join(phaseDir, 'whole-video-analysis.json');
    fs.writeFileSync(artifactPath, JSON.stringify(analysisResult.wholeVideoAnalysis, null, 2), 'utf8');
    events.artifactWrite({ absolutePath: artifactPath, role: 'artifact', phase: 'phase2-process', script: 'whole-video-mimo' });

    return {
      primaryArtifactKey: 'wholeVideoAnalysis',
      artifacts: {
        wholeVideoAnalysis: {
          ...analysisResult.wholeVideoAnalysis,
          path: 'phase2-process/whole-video-analysis.json'
        }
      }
    };
  } catch (error) {
    phaseOutcome = 'failed';
    const persistedError = getPersistedErrorInfo(error);
    recordPhaseError({
      kind: 'whole_video_analysis_failed',
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
    events.emit({ kind: 'script.end', phase: 'phase2-process', script: 'whole-video-mimo', outcome: phaseOutcome });
  }
}

module.exports = {
  run,
  aiRecovery: {
    guidance: 'Repair malformed or validator-rejected whole-video MiMo analysis JSON while preserving the same full-video persona-evaluation task and staged media contract.',
    reentry: {
      allowedMutableInputs: ['repairInstructions', 'boundedContextSummary'],
      forbiddenMutableInputs: ['upstreamArtifacts', 'artifactPaths', 'schemaDefinition', 'runtimeBudgets']
    }
  },
  _private: {
    buildWholeVideoPrompt,
    formatTransportLabel,
    toProviderAttachment,
    resolveDurationSeconds,
    buildFinalArtifact,
    normalizePrimaryLenses
  }
};

if (require.main === module) {
  console.log('whole-video-mimo.cjs is intended to run via the pipeline.');
}
