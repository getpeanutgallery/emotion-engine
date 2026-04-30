#!/usr/bin/env node
/**
 * Get Dialogue Script
 * 
 * Extracts audio from video, transcribes speech, and identifies speakers.
 * This script runs in Phase 1 (Gather Context) of the pipeline.
 * 
 * Raw capture schema v2 parity (Phase2-style):
 * - attempt-scoped capture payloads (even if attempt is always 1 for now)
 * - legacy flat files preserved as pointer JSON
 * - phase error artifacts written to raw/_meta/errors.jsonl + errors.summary.json
 * 
 * @module scripts/get-context/get-dialogue
 */

const fs = require('fs');
const path = require('path');
const { spawn, execSync } = require('child_process');
const {
  executeWithTargets,
  getProviderForTarget,
  buildProviderOptions,
  createRetryableError,
  getPersistedErrorInfo
} = require('../../lib/ai-targets.cjs');
const storage = require('../../lib/storage/storage-interface.js');
const outputManager = require('../../lib/output-manager.cjs');
const { shouldKeepProcessedIntermediates } = require('../../lib/processed-assets-policy.cjs');
const { shouldCaptureRaw, getRawPhaseDir, sanitizeRawCaptureValue, writeRawJson } = require('../../lib/raw-capture.cjs');
const { ensureToolVersionsCaptured } = require('../../lib/tool-versions.cjs');
const { ffmpegPath, ffprobePath } = require('../../lib/ffmpeg-path.cjs');
const { getEventsLogger } = require('../../lib/events-timeline.cjs');
const { storePromptPayload } = require('../../lib/prompt-store.cjs');
const { preflightAudio, planTimeChunks } = require('../../lib/audio-preflight.cjs');
const { getRecoveryRuntime, buildRecoveryPromptAddendum } = require('../../lib/ai-recovery-runtime.cjs');
const { buildEnglishOnlyOutputRuleBlock } = require('../../lib/english-only-contract.cjs');
const { extractAudioChunk } = require('../../lib/audio-chunk-extractor.cjs');
const {
  buildAudioExtractArgs,
  formatCommand,
  getAudioMimeType,
  getAudioOutputExtension,
  getRequiredAudioConfig
} = require('../../lib/ffmpeg-config.cjs');
const {
  parseAndValidateJsonObject,
  normalizeDialogueSpeakerContract,
  validateDialogueTranscriptionObject,
  validateDialogueStitchObject
} = require('../../lib/structured-output.cjs');
const {
  buildDialogueTranscriptionValidatorToolContract,
  executeDialogueTranscriptionValidatorTool,
  buildDialogueStitchValidatorToolContract,
  executeDialogueStitchValidatorTool
} = require('../../lib/phase1-validator-tools.cjs');
const { buildDialogueV3SourceTruth } = require('../../lib/dialogue-v3-source-truth-emitter.cjs');
const { executeLocalValidatorToolLoop } = require('../../lib/local-validator-tool-loop.cjs');
const { applyFailureMetadata } = require('../../lib/tool-wrapper-contract.cjs');
const {
  resolveProviderRuntimeConfigForTarget,
  ensureRuntimeAuthForDomain,
  buildProviderOptionDefaults
} = require('../../lib/provider-runtime-config.cjs');

const PHASE_KEY = 'phase1-gather-context';
const SCRIPT_ID = 'get-dialogue';

function pad(value, width) {
  return String(value).padStart(width, '0');
}

function clampNumber(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function countTranscriptWords(text) {
  return String(text || '').trim().split(/\s+/).filter(Boolean).length;
}

function estimateMinimumPlausibleSpeechDurationSeconds(text) {
  const wordCount = countTranscriptWords(text);
  if (wordCount <= 0) return 0;
  const FAST_SPEECH_WORDS_PER_SECOND = 6;
  return Math.max(0.35, wordCount / FAST_SPEECH_WORDS_PER_SECOND);
}

function shouldDropImplausiblyClippedDialogueSegment(segment, start, end, boundedDuration) {
  const originalStart = Number.isFinite(segment?.start) ? segment.start : null;
  const originalEnd = Number.isFinite(segment?.end) ? segment.end : null;

  if (!Number.isFinite(originalStart) || !Number.isFinite(originalEnd)) return false;
  if (originalEnd <= originalStart) return true;
  if (originalEnd <= boundedDuration) return false;

  const originalDuration = originalEnd - originalStart;
  const retainedDuration = end - start;
  const retainedRatio = originalDuration > 0 ? retainedDuration / originalDuration : 0;
  const minimumPlausibleDuration = estimateMinimumPlausibleSpeechDurationSeconds(segment?.text);

  return retainedRatio < 0.2 && retainedDuration < minimumPlausibleDuration;
}

function previousSegmentLooksOpenEnded(text) {
  const normalizedText = String(text || '').trim();
  if (!normalizedText) return false;
  if (/(\.\.\.|[,;:\-–—])$/.test(normalizedText)) return true;
  if (/(\b(?:and|or|but|so|because|that|which|who|when|while|to|of|for|in|on|with|at|from|by)\b)$/i.test(normalizedText)) return true;
  return !/[.!?]["')\]]?$/.test(normalizedText);
}

function nextSegmentLooksContinuation(text) {
  return /^[a-z(\[]/.test(String(text || '').trim());
}

function shouldAdoptNextSpeakerForBoundaryContinuation(previousSegment, nextSegment) {
  if (!previousSegment || !nextSegment) return false;

  const previousSpeakerId = typeof previousSegment?.speaker_id === 'string' ? previousSegment.speaker_id.trim() : '';
  const nextSpeakerId = typeof nextSegment?.speaker_id === 'string' ? nextSegment.speaker_id.trim() : '';
  if (!previousSpeakerId || !nextSpeakerId || previousSpeakerId === nextSpeakerId) return false;

  const previousEnd = Number.isFinite(previousSegment?.end) ? previousSegment.end : null;
  const nextStart = Number.isFinite(nextSegment?.start) ? nextSegment.start : null;
  if (!Number.isFinite(previousEnd) || !Number.isFinite(nextStart)) return false;

  const gapSeconds = nextStart - previousEnd;
  if (gapSeconds < -0.1 || gapSeconds > 0.15) return false;

  return previousSegmentLooksOpenEnded(previousSegment?.text) && nextSegmentLooksContinuation(nextSegment?.text);
}

function repairBoundaryContinuationSpeakerDrift(segments) {
  const repaired = Array.isArray(segments) ? segments.map((segment) => ({ ...segment })) : [];

  for (let index = 1; index < repaired.length; index += 1) {
    const previous = repaired[index - 1];
    const current = repaired[index];
    if (!shouldAdoptNextSpeakerForBoundaryContinuation(previous, current)) continue;
    previous.speaker_id = current.speaker_id;
    previous.speaker = current.speaker;
  }

  return repaired;
}

function shouldMergeAdjacentDialogueSegments(previousSegment, nextSegment) {
  if (!previousSegment || !nextSegment) return false;

  const previousSpeakerId = typeof previousSegment?.speaker_id === 'string' ? previousSegment.speaker_id.trim() : '';
  const nextSpeakerId = typeof nextSegment?.speaker_id === 'string' ? nextSegment.speaker_id.trim() : '';
  const previousSpeaker = typeof previousSegment?.speaker === 'string' ? previousSegment.speaker.trim() : '';
  const nextSpeaker = typeof nextSegment?.speaker === 'string' ? nextSegment.speaker.trim() : '';

  const sameSpeaker = (previousSpeakerId && nextSpeakerId && previousSpeakerId === nextSpeakerId)
    || (!previousSpeakerId && !nextSpeakerId && previousSpeaker && nextSpeaker && previousSpeaker === nextSpeaker);

  if (!sameSpeaker) return false;

  const previousEnd = Number.isFinite(previousSegment?.end) ? previousSegment.end : null;
  const nextStart = Number.isFinite(nextSegment?.start) ? nextSegment.start : null;
  if (!Number.isFinite(previousEnd) || !Number.isFinite(nextStart)) return false;

  const gapSeconds = nextStart - previousEnd;
  if (gapSeconds < -0.25 || gapSeconds > 0.75) return false;

  const previousText = String(previousSegment?.text || '').trim();
  const nextText = String(nextSegment?.text || '').trim();
  if (!previousText || !nextText) return false;

  if (gapSeconds <= 0.05) return true;

  return previousSegmentLooksOpenEnded(previousText) || nextSegmentLooksContinuation(nextText);
}

function joinAdjacentDialogueTexts(previousText, nextText) {
  const left = String(previousText || '').trim().replace(/\s*\.\.\.\s*$/, '').trim();
  const right = String(nextText || '').trim();
  if (!left) return right;
  if (!right) return left;
  if (/[\-–—]$/.test(left)) return `${left}${right}`.replace(/\s+/g, ' ').trim();
  return `${left} ${right}`.replace(/\s+/g, ' ').trim();
}

function mergeAdjacentDialogueSegments(segments) {
  const inputSegments = Array.isArray(segments) ? segments : [];
  if (inputSegments.length <= 1) return inputSegments.slice();

  const merged = [];
  for (const segment of inputSegments) {
    const previous = merged[merged.length - 1] || null;
    if (shouldMergeAdjacentDialogueSegments(previous, segment)) {
      previous.end = Number.isFinite(segment?.end) ? Math.max(previous.end, segment.end) : previous.end;
      previous.text = joinAdjacentDialogueTexts(previous.text, segment?.text);
      if (typeof segment?.confidence === 'number' && Number.isFinite(segment.confidence)) {
        const previousConfidence = typeof previous?.confidence === 'number' && Number.isFinite(previous.confidence)
          ? previous.confidence
          : segment.confidence;
        previous.confidence = Number(Math.max(previousConfidence, segment.confidence).toFixed(4));
      }
      continue;
    }

    merged.push({ ...segment });
  }

  return merged;
}

function looksLikeRepairableLateSuffixOverrun(segments, boundedDuration) {
  if (!Array.isArray(segments) || segments.length === 0) return false;
  if (!Number.isFinite(boundedDuration) || boundedDuration <= 0) return false;

  let previousStart = -Infinity;
  let previousEnd = -Infinity;
  for (const segment of segments) {
    const start = Number.isFinite(segment?.start) ? segment.start : null;
    const end = Number.isFinite(segment?.end) ? segment.end : null;
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return false;
    if (start < previousStart - 0.1) return false;
    if (end < previousEnd - 0.1) return false;
    previousStart = start;
    previousEnd = end;
  }

  const firstOverrunIndex = segments.findIndex((segment) => segment.end > boundedDuration + 0.001 || segment.start >= boundedDuration);
  if (firstOverrunIndex < 0) return false;

  const suffix = segments.slice(firstOverrunIndex);
  const prefix = segments.slice(0, firstOverrunIndex);
  const prefixEnd = prefix.reduce((maxEnd, segment) => Number.isFinite(segment?.end) ? Math.max(maxEnd, segment.end) : maxEnd, 0);
  const suffixStart = Number.isFinite(suffix[0]?.start) ? suffix[0].start : null;
  const suffixEnd = Number.isFinite(suffix[suffix.length - 1]?.end) ? suffix[suffix.length - 1].end : null;
  if (!Number.isFinite(suffixStart) || !Number.isFinite(suffixEnd)) return false;

  const overrunSeconds = suffixEnd - boundedDuration;
  const maxOverrunSeconds = Math.max(1.5, Math.min(8, boundedDuration * 0.05));
  if (overrunSeconds <= 0 || overrunSeconds > maxOverrunSeconds) return false;

  const lateWindowSeconds = Math.max(6, Math.min(24, boundedDuration * 0.2));
  if (suffixStart < Math.max(0, boundedDuration - lateWindowSeconds)) return false;

  const shiftedSuffixStart = suffixStart - overrunSeconds;
  if (shiftedSuffixStart < prefixEnd - 0.15) return false;

  return true;
}

function repairLateSuffixDialogueSegmentOverrun(segments, boundedDuration) {
  if (!looksLikeRepairableLateSuffixOverrun(segments, boundedDuration)) return Array.isArray(segments) ? segments.slice() : [];

  const repaired = segments.map((segment) => ({ ...segment }));
  const firstOverrunIndex = repaired.findIndex((segment) => segment.end > boundedDuration + 0.001 || segment.start >= boundedDuration);
  const suffixEnd = repaired[repaired.length - 1].end;
  const shiftSeconds = suffixEnd - boundedDuration;

  for (let index = firstOverrunIndex; index < repaired.length; index += 1) {
    repaired[index].start = Math.max(0, repaired[index].start - shiftSeconds);
    repaired[index].end = Math.max(repaired[index].start, repaired[index].end - shiftSeconds);
  }

  return repaired;
}

function normalizeDialogueDataToDuration(
  dialogueData,
  actualDuration,
  { requireHandoff = false, preserveReportedTotalDuration = false } = {}
) {
  const boundedDuration = Number.isFinite(actualDuration) && actualDuration >= 0 ? actualDuration : 0;
  const rawInputSegments = Array.isArray(dialogueData?.dialogue_segments) ? dialogueData.dialogue_segments : [];
  const inputSegments = requireHandoff
    ? rawInputSegments
    : repairLateSuffixDialogueSegmentOverrun(rawInputSegments, boundedDuration);

  const clampedSegments = inputSegments.map((segment) => {
    const hasStart = Number.isFinite(segment?.start);
    const hasEnd = Number.isFinite(segment?.end);

    // Preserve untimed-but-valid dialogue segments for the index/text contract.
    if (!hasStart && !hasEnd) {
      return {
        ...segment
      };
    }

    // Keep the existing behavior for partially timed segments: require both bounds.
    if (!hasStart || !hasEnd) return null;

    const start = clampNumber(segment.start, 0, boundedDuration);
    const end = clampNumber(segment.end, 0, boundedDuration);

    if (end <= start) return null;
    if (shouldDropImplausiblyClippedDialogueSegment(segment, start, end, boundedDuration)) return null;

    return {
      ...segment,
      start,
      end
    };
  }).filter(Boolean);

  const supportedSegmentEnd = clampedSegments.reduce((maxEnd, segment) => {
    if (!Number.isFinite(segment?.end)) return maxEnd;
    return Math.max(maxEnd, segment.end);
  }, 0);
  const normalizedTotalDuration = preserveReportedTotalDuration && Number.isFinite(dialogueData?.totalDuration)
    ? Math.max(supportedSegmentEnd, clampNumber(dialogueData.totalDuration, 0, boundedDuration))
    : boundedDuration;

  const normalized = validateDialogueTranscriptionObject({
    ...dialogueData,
    dialogue_segments: clampedSegments,
    totalDuration: normalizedTotalDuration
  }, { requireHandoff });

  if (!normalized.ok) {
    throw new Error(normalized.summary || 'Failed to normalize dialogue timing to source duration.');
  }

  return {
    ...normalized.value,
    ...(dialogueData?.cleanedTranscript ? { cleanedTranscript: dialogueData.cleanedTranscript } : {})
  };
}

function buildOpeningWeightedChunkPlan({ durationSeconds, baseChunkDurationSeconds, config = {} }) {
  const totalDuration = Number.isFinite(durationSeconds) ? durationSeconds : 0;
  const baseChunkDuration = Number.isFinite(baseChunkDurationSeconds) && baseChunkDurationSeconds > 0
    ? baseChunkDurationSeconds
    : Math.min(20, Math.max(5, totalDuration));

  const openingCoverageSeconds = Number.isFinite(config?.settings?.dialogue_opening_provenance_seconds)
    ? Math.max(0, Math.min(config.settings.dialogue_opening_provenance_seconds, totalDuration))
    : Math.min(24, totalDuration);
  const openingChunkDurationSeconds = Number.isFinite(config?.settings?.dialogue_opening_chunk_duration_seconds)
    ? Math.max(4, Math.min(config.settings.dialogue_opening_chunk_duration_seconds, openingCoverageSeconds || baseChunkDuration))
    : Math.min(8, openingCoverageSeconds || baseChunkDuration);

  if (openingCoverageSeconds <= 0 || openingChunkDurationSeconds >= baseChunkDuration || openingCoverageSeconds <= openingChunkDurationSeconds) {
    const chunkPlan = planTimeChunks({
      durationSeconds: totalDuration,
      chunkDurationSeconds: baseChunkDuration
    });
    return {
      chunkPlan,
      openingApplied: false,
      openingCoverageSeconds: 0,
      openingChunkDurationSeconds: null
    };
  }

  const openingPlan = planTimeChunks({
    durationSeconds: openingCoverageSeconds,
    chunkDurationSeconds: openingChunkDurationSeconds
  }).map((chunk) => ({
    startTime: chunk.startTime,
    endTime: chunk.endTime
  }));

  const remainingDuration = Math.max(0, totalDuration - openingCoverageSeconds);
  const remainingPlan = remainingDuration > 0
    ? planTimeChunks({
        durationSeconds: remainingDuration,
        chunkDurationSeconds: baseChunkDuration
      }).map((chunk) => ({
        startTime: chunk.startTime + openingCoverageSeconds,
        endTime: chunk.endTime + openingCoverageSeconds
      }))
    : [];

  const chunkPlan = [...openingPlan, ...remainingPlan].map((chunk, index) => ({
    index,
    startTime: chunk.startTime,
    endTime: chunk.endTime
  }));

  return {
    chunkPlan,
    openingApplied: true,
    openingCoverageSeconds,
    openingChunkDurationSeconds
  };
}

function resolveDialogueChunkingPreflight(preflight, config = {}, options = {}) {
  const durationSeconds = Number.isFinite(preflight?.durationSeconds) ? preflight.durationSeconds : 0;
  const maxWholeFileDurationSeconds = Number.isFinite(options?.maxWholeAssetDurationSeconds)
    ? Math.max(5, options.maxWholeAssetDurationSeconds)
    : (Number.isFinite(config?.settings?.dialogue_max_whole_file_duration_seconds)
        ? Math.max(5, config.settings.dialogue_max_whole_file_duration_seconds)
        : 60);
  const forceChunking = options?.forceChunking === true;
  const forcedReason = typeof options?.forceReason === 'string' && options.forceReason.trim().length > 0
    ? options.forceReason.trim()
    : 'dialogue_timing_force_chunking';

  if (preflight?.needsChunking || (!forceChunking && durationSeconds <= maxWholeFileDurationSeconds)) {
    const baseChunkDurationSeconds = Number.isFinite(preflight?.recommendedChunkDurationSeconds) && preflight.recommendedChunkDurationSeconds > 0
      ? preflight.recommendedChunkDurationSeconds
      : Math.min(20, Math.max(5, durationSeconds));
    const openingWeightedPlan = buildOpeningWeightedChunkPlan({
      durationSeconds,
      baseChunkDurationSeconds,
      config
    });

    return {
      ...preflight,
      chunkPlan: openingWeightedPlan.chunkPlan,
      trace: {
        ...preflight?.trace,
        chunks: openingWeightedPlan.chunkPlan.length,
        openingArbitration: openingWeightedPlan.openingApplied ? {
          coverageSeconds: openingWeightedPlan.openingCoverageSeconds,
          chunkDurationSeconds: openingWeightedPlan.openingChunkDurationSeconds
        } : null
      }
    };
  }

  const forcedChunkDurationSeconds = Number.isFinite(config?.settings?.dialogue_forced_chunk_duration_seconds)
    ? Math.max(5, Math.min(config.settings.dialogue_forced_chunk_duration_seconds, durationSeconds))
    : Math.min(20, durationSeconds);

  const openingWeightedPlan = buildOpeningWeightedChunkPlan({
    durationSeconds,
    baseChunkDurationSeconds: forcedChunkDurationSeconds,
    config
  });

  return {
    ...preflight,
    needsChunking: true,
    recommendedChunkDurationSeconds: forcedChunkDurationSeconds,
    chunkPlan: openingWeightedPlan.chunkPlan,
    trace: {
      ...(preflight?.trace || {}),
      reason: forcedReason,
      originalReason: preflight?.trace?.reason || null,
      maxWholeFileDurationSeconds,
      recommendedChunkDurationSeconds: forcedChunkDurationSeconds,
      chunks: openingWeightedPlan.chunkPlan.length,
      openingArbitration: openingWeightedPlan.openingApplied ? {
        coverageSeconds: openingWeightedPlan.openingCoverageSeconds,
        chunkDurationSeconds: openingWeightedPlan.openingChunkDurationSeconds
      } : null
    }
  };
}

function roundDialogueMetric(value, digits = 4) {
  if (!Number.isFinite(value)) return null;
  return Number(value.toFixed(digits));
}

function normalizeDialoguePhase1ModeConfig(config = {}) {
  const phase1Dialogue = config?.settings?.phase1?.dialogue;
  const phase1Config = phase1Dialogue && typeof phase1Dialogue === 'object' && !Array.isArray(phase1Dialogue)
    ? phase1Dialogue
    : {};
  const requestedModeRaw = typeof phase1Config.mode === 'string' ? phase1Config.mode.trim().toLowerCase() : 'auto';
  const requestedMode = ['auto', 'chunked', 'whole_asset', 'hybrid'].includes(requestedModeRaw)
    ? requestedModeRaw
    : 'auto';
  const timingRefinementRaw = typeof phase1Config.timing_refinement === 'string'
    ? phase1Config.timing_refinement.trim().toLowerCase()
    : 'auto';
  const timingRefinement = ['auto', 'disabled', 'chunk_refine'].includes(timingRefinementRaw)
    ? timingRefinementRaw
    : 'auto';
  const legacyMaxWholeFileDurationSeconds = Number.isFinite(config?.settings?.dialogue_max_whole_file_duration_seconds)
    ? Math.max(5, config.settings.dialogue_max_whole_file_duration_seconds)
    : 60;
  const maxWholeAssetDurationSeconds = Number.isFinite(phase1Config.max_whole_asset_duration_seconds)
    ? Math.max(5, phase1Config.max_whole_asset_duration_seconds)
    : legacyMaxWholeFileDurationSeconds;

  return {
    requestedMode,
    timingRefinement,
    maxWholeAssetDurationSeconds,
    fallbackToChunked: phase1Config.fallback_to_chunked !== false,
    preserveChunkPlanMetadata: phase1Config.preserve_chunk_plan_metadata !== false
  };
}

function deriveDialogueCoverage(dialogueData, totalDuration) {
  const normalizedDialogueData = dialogueData && typeof dialogueData === 'object' ? dialogueData : {};
  const normalizedTotalDuration = Number.isFinite(totalDuration)
    ? Math.max(0, totalDuration)
    : (Number.isFinite(normalizedDialogueData?.totalDuration) ? Math.max(0, normalizedDialogueData.totalDuration) : 0);
  const roundedTotalDuration = roundDialogueMetric(normalizedTotalDuration, 3);
  const totalCoverageGapToleranceSeconds = 0.001;
  const coverageCanTruthfullyBeComplete = (start, end) => start <= totalCoverageGapToleranceSeconds
    && end >= Math.max(0, roundedTotalDuration - totalCoverageGapToleranceSeconds);
  const existingCoverage = normalizedDialogueData?.coverage && typeof normalizedDialogueData.coverage === 'object'
    ? normalizedDialogueData.coverage
    : null;

  if (existingCoverage) {
    const start = roundDialogueMetric(Number.isFinite(existingCoverage.start) ? Math.max(0, existingCoverage.start) : 0, 3);
    const end = roundDialogueMetric(Number.isFinite(existingCoverage.end) ? Math.max(start, existingCoverage.end) : start, 3);
    const duration = roundDialogueMetric(Number.isFinite(existingCoverage.duration) ? Math.max(0, existingCoverage.duration) : 0, 3);

    return {
      start,
      end,
      duration,
      complete: existingCoverage.complete === true && coverageCanTruthfullyBeComplete(start, end)
    };
  }

  const segments = Array.isArray(normalizedDialogueData?.dialogue_segments) ? normalizedDialogueData.dialogue_segments : [];
  const timedSegments = segments.filter((segment) => Number.isFinite(segment?.start) && Number.isFinite(segment?.end));

  if (timedSegments.length === 0) {
    return {
      start: 0,
      end: 0,
      duration: 0,
      complete: false
    };
  }

  const start = roundDialogueMetric(Math.max(0, Math.min(...timedSegments.map((segment) => segment.start))), 3);
  const end = roundDialogueMetric(Math.max(start, Math.max(...timedSegments.map((segment) => segment.end))), 3);
  const duration = roundDialogueMetric(Math.max(0, end - start), 3);

  return {
    start,
    end,
    duration,
    complete: coverageCanTruthfullyBeComplete(start, end)
  };
}

function buildDialogueAnalysisMetadata({
  dialogueData,
  analysisMode,
  timingMode,
  sourceStrategy = 'base64',
  durationSeconds,
  usedChunking = false,
  chunkPlan = null,
  fallbackApplied = false,
  fallbackReason = null,
  preserveChunkPlanMetadata = false,
  qualityNotes = []
} = {}) {
  const normalizedDialogueData = dialogueData && typeof dialogueData === 'object' ? { ...dialogueData } : {};
  const normalizedDuration = Number.isFinite(durationSeconds)
    ? Math.max(0, durationSeconds)
    : (Number.isFinite(normalizedDialogueData?.totalDuration) ? Math.max(0, normalizedDialogueData.totalDuration) : 0);
  const normalizedQualityNotes = Array.from(new Set(
    (Array.isArray(qualityNotes) ? qualityNotes : [])
      .map((entry) => String(entry || '').trim())
      .filter(Boolean)
  ));

  const provenance = {
    transportMode: sourceStrategy === 'public_url' ? 'remote_url' : 'inline',
    usedChunking,
    chunkCount: Array.isArray(chunkPlan?.chunkPlan) ? chunkPlan.chunkPlan.length : 0,
    fallbackApplied,
    ...(fallbackApplied && fallbackReason ? { fallbackReason } : {})
  };

  if (preserveChunkPlanMetadata && usedChunking && chunkPlan) {
    provenance.chunkPlan = {
      ...(chunkPlan?.trace?.reason ? { reason: chunkPlan.trace.reason } : {}),
      ...(Number.isFinite(chunkPlan?.recommendedChunkDurationSeconds)
        ? { recommendedChunkDurationSeconds: roundDialogueMetric(chunkPlan.recommendedChunkDurationSeconds, 3) }
        : {}),
      ...(chunkPlan?.trace?.openingArbitration ? {
        openingArbitration: {
          ...(Number.isFinite(chunkPlan.trace.openingArbitration.coverageSeconds)
            ? { coverageSeconds: roundDialogueMetric(chunkPlan.trace.openingArbitration.coverageSeconds, 3) }
            : {}),
          ...(Number.isFinite(chunkPlan.trace.openingArbitration.chunkDurationSeconds)
            ? { chunkDurationSeconds: roundDialogueMetric(chunkPlan.trace.openingArbitration.chunkDurationSeconds, 3) }
            : {})
        }
      } : {})
    };
  }

  return {
    ...normalizedDialogueData,
    analysisMode,
    timingMode,
    sourceStrategy,
    coverage: deriveDialogueCoverage(normalizedDialogueData, normalizedDuration),
    provenance,
    ...(normalizedQualityNotes.length > 0 ? { qualityNotes: normalizedQualityNotes } : {})
  };
}

function stripDialogueSegmentTiming(dialogueData) {
  if (!dialogueData || typeof dialogueData !== 'object' || Array.isArray(dialogueData)) {
    return dialogueData;
  }

  const dialogueSegments = Array.isArray(dialogueData.dialogue_segments)
    ? dialogueData.dialogue_segments.map((segment) => {
        if (!segment || typeof segment !== 'object' || Array.isArray(segment)) return segment;
        const { start, end, ...rest } = segment;
        return rest;
      })
    : [];

  return {
    ...dialogueData,
    dialogue_segments: dialogueSegments
  };
}

function describeDialogueChunkingReason(preflight) {
  if (preflight?.trace?.reason === 'dialogue_timing_force_chunking') {
    return `timing-stability guard over ${preflight.trace?.maxWholeFileDurationSeconds ?? 'unknown'}s`;
  }
  if (preflight?.trace?.reason === 'dialogue_mode_chunked') {
    return 'explicit chunked mode';
  }
  if (preflight?.trace?.reason === 'dialogue_hybrid_timing_refinement') {
    return 'hybrid timing refinement';
  }
  return 'Base64 budget';
}

function runCommand(command, args) {
  return new Promise((resolve, reject) => {
    const proc = spawn(command, args);
    let stdout = '';
    let stderr = '';

    proc.stdout?.on('data', (data) => {
      stdout += data.toString();
    });

    proc.stderr?.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
        return;
      }

      const error = new Error(`${command} exited with code ${code}`);
      error.code = code;
      error.stdout = stdout;
      error.stderr = stderr;
      reject(error);
    });

    proc.on('error', (error) => {
      error.stdout = stdout;
      error.stderr = stderr;
      reject(error);
    });
  });
}

function getRetryConfig(config = {}, domain = 'dialogue') {
  const retry = config?.ai?.[domain]?.retry || {};

  return {
    maxAttempts: Number.isInteger(retry.maxAttempts) && retry.maxAttempts > 0 ? retry.maxAttempts : 1,
    backoffMs: Number.isInteger(retry.backoffMs) && retry.backoffMs >= 0 ? retry.backoffMs : 0
  };
}

function getToolLoopConfig(config = {}, domain = 'dialogue') {
  const toolLoop = config?.ai?.[domain]?.toolLoop || {};

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
  // Rewrite the current script invocation snapshot so reruns do not inherit stale
  // phase error lines from previous executions using the same outputDir.
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

/**
 * Script Input Contract
 * @typedef {Object} GetDialogueInput
 * @property {string} assetPath - Path to video/audio file
 * @property {string} outputDir - Output directory
 * @property {Object} [config] - Pipeline config
 */

/**
 * Script Output Contract
 * @typedef {Object} GetDialogueOutput
 * @property {Object} artifacts - Script artifacts
 * @property {Object} artifacts.dialogueData - Dialogue analysis results
 * @property {Array} artifacts.dialogueData.dialogue_segments - Dialogue segments
 * @property {string} artifacts.dialogueData.summary - Brief summary
 * @property {number} artifacts.dialogueData.totalDuration - Total duration in seconds
 */

/**
 * Main entry point
 * 
 * @async
 * @function run
 * @param {GetDialogueInput} input - Script input
 * @returns {Promise<GetDialogueOutput>} - Script output
 */
async function run(input) {
  const { assetPath, outputDir, config } = input;
  const preserveSegmentTiming = input?.preserveSegmentTiming === true;
  const recoveryRuntime = getRecoveryRuntime(input);

  console.log('   🎤 Extracting and transcribing dialogue from:', assetPath);

  // Create phase-aware output directory
  const phaseDir = outputManager.createPhaseDirectory(outputDir, PHASE_KEY);

  // Create assets directory for processed files (canonical run-level assets)
  const assetsDirs = outputManager.createAssetsDirectory(outputDir);

  // Create temp directory for audio extraction in assets/processed/dialogue/
  const tempDir = path.join(assetsDirs.processedDir, 'dialogue');
  fs.mkdirSync(tempDir, { recursive: true });

  // Default to keeping processed/intermediate files unless explicitly disabled
  const keepProcessedIntermediates = shouldKeepProcessedIntermediates(config);
  const captureRaw = shouldCaptureRaw(config);

  const events = getEventsLogger({ outputDir, config });
  events.emit({ kind: 'script.start', phase: PHASE_KEY, script: SCRIPT_ID });

  const rawDir = getRawPhaseDir(outputDir, PHASE_KEY);
  const rawMetaDir = path.join(rawDir, '_meta');
  const ffmpegRawDir = path.join(rawDir, 'ffmpeg', 'dialogue');
  const aiRawDir = path.join(rawDir, 'ai');
  const toolVersionsDir = path.join(rawDir, 'tools', '_versions');

  await ensureToolVersionsCaptured({
    captureRaw,
    toolVersionsDir,
    tools: [
      { name: 'ffmpeg', path: ffmpegPath },
      { name: 'ffprobe', path: ffprobePath }
    ]
  });

  const phaseErrors = [];
  let phaseOutcome = 'success';
  let fatalPhaseError = null;

  const recordPhaseError = (entry) => {
    phaseErrors.push({
      ts: new Date().toISOString(),
      phase: PHASE_KEY,
      script: SCRIPT_ID,
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

  const writeDialogueRaw = (attempt, payload) => {
    if (!captureRaw) return;

    const attemptRelDir = path.join('dialogue-transcription', `attempt-${pad(attempt, 2)}`);
    const attemptRelPath = path.join(attemptRelDir, 'capture.json');

    // Schema v2: attempt-scoped capture payloads (do not overwrite retries)
    const capturePath = writeRawJson(aiRawDir, attemptRelPath, payload);
    events.artifactWrite({ absolutePath: capturePath, role: 'raw.ai.attempt', phase: PHASE_KEY, script: SCRIPT_ID });

    // Legacy pointer: keep dialogue-transcription.json as a pointer to latest attempt
    const pointerPath = writeRawJson(aiRawDir, 'dialogue-transcription.json', {
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

  let prompt = null;
  let promptRef = null;
  let response = null;
  let model = null;

  try {
    // Extract audio from video (if needed)
    const audioPath = await extractAudio(assetPath, tempDir, {
      captureRaw,
      ffmpegRawDir,
      logName: 'extract-audio.json',
      config
    });

    const transportPreflight = preflightAudio({
      audioPath,
      config,
      rawCapture: {
        captureRaw,
        rawLogger: (payload) => writeRawJson(ffmpegRawDir, 'ffprobe-audio-duration.json', payload)
      }
    });
    const dialogueModeConfig = normalizeDialoguePhase1ModeConfig(config);
    const wholeAssetTransportSafe = !transportPreflight.needsChunking;
    const wholeAssetDurationEligible = transportPreflight.durationSeconds <= dialogueModeConfig.maxWholeAssetDurationSeconds;
    const wholeAssetEligible = wholeAssetTransportSafe && wholeAssetDurationEligible;
    const shouldAttemptWholeAsset = wholeAssetEligible && (
      dialogueModeConfig.requestedMode === 'whole_asset'
      || dialogueModeConfig.requestedMode === 'hybrid'
      || dialogueModeConfig.requestedMode === 'auto'
    );
    const hybridTimingRefinementRequested = dialogueModeConfig.requestedMode === 'hybrid'
      && wholeAssetEligible
      && dialogueModeConfig.timingRefinement !== 'disabled';
    const wholeAssetUnavailableReason = !wholeAssetTransportSafe
      ? 'inline_audio_budget_exceeded'
      : (!wholeAssetDurationEligible ? 'max_whole_asset_duration_exceeded' : null);
    const shouldRunChunked = transportPreflight.needsChunking
      || dialogueModeConfig.requestedMode === 'chunked'
      || (dialogueModeConfig.requestedMode === 'auto' && !shouldAttemptWholeAsset)
      || hybridTimingRefinementRequested
      || ((dialogueModeConfig.requestedMode === 'whole_asset' || dialogueModeConfig.requestedMode === 'hybrid')
        && !wholeAssetEligible
        && dialogueModeConfig.fallbackToChunked);
    const chunkingPreflight = shouldRunChunked
      ? resolveDialogueChunkingPreflight(transportPreflight, config, {
          maxWholeAssetDurationSeconds: dialogueModeConfig.maxWholeAssetDurationSeconds,
          forceChunking: dialogueModeConfig.requestedMode === 'chunked' || hybridTimingRefinementRequested,
          forceReason: dialogueModeConfig.requestedMode === 'chunked'
            ? 'dialogue_mode_chunked'
            : (hybridTimingRefinementRequested ? 'dialogue_hybrid_timing_refinement' : 'dialogue_timing_force_chunking')
        })
      : null;
    const executionTrace = {
      requestedMode: dialogueModeConfig.requestedMode,
      timingRefinement: dialogueModeConfig.timingRefinement,
      transport: transportPreflight.trace,
      effective: shouldRunChunked && chunkingPreflight ? chunkingPreflight.trace : transportPreflight.trace,
      strategy: {
        wholeAsset: shouldAttemptWholeAsset,
        chunked: shouldRunChunked,
        effectiveMode: shouldAttemptWholeAsset && shouldRunChunked
          ? 'hybrid'
          : (shouldAttemptWholeAsset ? 'whole_asset' : 'chunked')
      }
    };

    if (!shouldAttemptWholeAsset
      && !shouldRunChunked
      && !dialogueModeConfig.fallbackToChunked
      && (dialogueModeConfig.requestedMode === 'whole_asset' || dialogueModeConfig.requestedMode === 'hybrid')
      && !wholeAssetEligible) {
      const reasonMessage = wholeAssetUnavailableReason === 'inline_audio_budget_exceeded'
        ? 'the source exceeded the inline audio budget'
        : `the source duration ${transportPreflight.durationSeconds.toFixed(1)}s exceeded max_whole_asset_duration_seconds=${dialogueModeConfig.maxWholeAssetDurationSeconds.toFixed(1)}`;
      throw new Error(`GetDialogue: phase1 dialogue mode "${dialogueModeConfig.requestedMode}" requires whole-asset delivery, but ${reasonMessage} and fallback_to_chunked=false.`);
    }

    if (!shouldAttemptWholeAsset && !shouldRunChunked) {
      throw new Error(`GetDialogue: phase1 dialogue mode "${dialogueModeConfig.requestedMode}" had no viable execution path.`);
    }

    events.emit({
      kind: 'audio.preflight',
      phase: PHASE_KEY,
      script: SCRIPT_ID,
      domain: 'dialogue',
      trace: executionTrace
    });

    if (captureRaw) {
      const planPath = writeRawJson(ffmpegRawDir, 'chunk-plan.json', {
        schemaVersion: 2,
        kind: 'audio.chunk.plan',
        domain: 'dialogue',
        createdAt: new Date().toISOString(),
        requestedMode: dialogueModeConfig.requestedMode,
        timingRefinement: dialogueModeConfig.timingRefinement,
        transportTrace: transportPreflight.trace,
        effectiveTrace: shouldRunChunked && chunkingPreflight ? chunkingPreflight.trace : transportPreflight.trace,
        chunks: shouldRunChunked && chunkingPreflight ? chunkingPreflight.chunkPlan : transportPreflight.chunkPlan
      });
      events.artifactWrite({ absolutePath: planPath, role: 'raw.ffmpeg.plan', phase: PHASE_KEY, script: SCRIPT_ID });
    }

    // config.ai.dialogue.targets[*].adapter.model is required (validated by config-loader)

    ensureRuntimeAuthForDomain({
      config,
      domain: 'dialogue',
      replayMode: false,
      prefix: 'GetDialogue'
    });

    const retryConfig = getRetryConfig(config, 'dialogue');
    const toolLoopConfig = getToolLoopConfig(config, 'dialogue');

    const writeDialogueChunkRaw = (chunkIndex, attempt, payload) => {
      if (!captureRaw) return;

      const chunkLabel = `chunk-${pad(chunkIndex, 4)}`;
      const attemptRelDir = path.join('dialogue-chunks', chunkLabel, `attempt-${pad(attempt, 2)}`);
      const attemptRelPath = path.join(attemptRelDir, 'capture.json');

      const capturePath = writeRawJson(aiRawDir, attemptRelPath, payload);
      events.artifactWrite({ absolutePath: capturePath, role: 'raw.ai.attempt', phase: PHASE_KEY, script: SCRIPT_ID });

      const pointerPath = writeRawJson(aiRawDir, `dialogue-${chunkLabel}.json`, {
        schemaVersion: 2,
        kind: 'pointer',
        updatedAt: new Date().toISOString(),
        chunkIndex,
        latestAttempt: attempt,
        target: {
          dir: attemptRelDir,
          file: attemptRelPath
        }
      });
      events.artifactWrite({ absolutePath: pointerPath, role: 'raw.ai.pointer', phase: PHASE_KEY, script: SCRIPT_ID });
    };

    const makeChunkHandoffFallback = (segments) => {
      if (!Array.isArray(segments) || segments.length === 0) return '';
      const tail = segments.slice(Math.max(0, segments.length - 4));
      return tail.map((s) => {
        const speaker = s?.speaker ? String(s.speaker) : 'Speaker';
        const text = s?.text ? String(s.text) : '';
        return `${speaker}: ${text}`.trim();
      }).join('\n');
    };

    const buildStructuredSpeakerHandoff = ({ speakerProfiles = [], segments = [] } = {}) => {
      const lines = [];
      const sourceProfiles = Array.isArray(speakerProfiles) ? speakerProfiles : [];
      const sourceSegments = Array.isArray(segments) ? segments : [];
      const normalizedSpeakerContract = normalizeDialogueSpeakerContract(sourceSegments, sourceProfiles);
      const normalizedProfiles = Array.isArray(normalizedSpeakerContract?.speaker_profiles)
        ? normalizedSpeakerContract.speaker_profiles
        : [];
      const normalizedSegments = Array.isArray(normalizedSpeakerContract?.dialogue_segments)
        ? normalizedSpeakerContract.dialogue_segments
        : sourceSegments;

      if (normalizedProfiles.length > 0) {
        lines.push('Speaker registry (reuse speaker_id only for the same acoustic voice):');
        for (const profile of normalizedProfiles) {
          const speakerId = typeof profile?.speaker_id === 'string' && profile.speaker_id.trim().length > 0
            ? profile.speaker_id.trim()
            : null;
          if (!speakerId) continue;

          const label = typeof profile?.label === 'string' && profile.label.trim().length > 0
            ? profile.label.trim()
            : 'Speaker';
          const descriptors = Array.isArray(profile?.grounded?.acoustic_descriptors)
            ? profile.grounded.acoustic_descriptors
                .map((entry) => typeof entry?.label === 'string' ? entry.label.trim() : '')
                .filter(Boolean)
                .slice(0, 3)
            : [];
          const traits = Array.isArray(profile?.inferred_traits?.traits)
            ? profile.inferred_traits.traits
                .map((entry) => {
                  const trait = typeof entry?.trait === 'string' ? entry.trait.trim() : '';
                  const value = typeof entry?.value === 'string' ? entry.value.trim() : '';
                  return trait && value ? `${trait}: ${value}` : '';
                })
                .filter(Boolean)
                .slice(0, 2)
            : [];
          const recentSample = normalizedSegments
            .filter((segment) => segment?.speaker_id === speakerId)
            .slice(-2)
            .map((segment) => typeof segment?.text === 'string' ? segment.text.trim() : '')
            .filter(Boolean)
            .join(' / ');

          const groundedConfidence = typeof profile?.grounded?.confidence === 'number' && Number.isFinite(profile.grounded.confidence)
            ? `grounded confidence: ${profile.grounded.confidence.toFixed(2)}`
            : null;

          const parts = [`- ${speakerId} => ${label}`];
          if (groundedConfidence) parts.push(groundedConfidence);
          if (descriptors.length > 0) parts.push(`acoustic cues: ${descriptors.join('; ')}`);
          if (traits.length > 0) parts.push(`inferred traits: ${traits.join('; ')}`);
          if (recentSample) parts.push(`recent lines: ${recentSample}`);
          lines.push(parts.join(' | '));
        }
      }

      const tail = normalizedSegments.slice(Math.max(0, normalizedSegments.length - 2));
      if (lines.length > 0) {
        lines.push('');
        lines.push('Voice separation reminders (priority order):');
        lines.push('- Default to continuity: speaker_id identity is acoustic, not semantic. Reuse the current speaker_id unless there is clear acoustic contradiction.');
        lines.push('- A single cue is never enough to mint a new speaker_id.');
        lines.push('- Create a new speaker_id only when at least TWO stable acoustic signals disagree with the current voice profile (core timbre/phonation quality, persistent accent/dialect impression, sustained delivery profile).');
        lines.push('- Fragile cues are split-insufficient on their own: intensity/energy shifts, pacing changes, microphone distance changes, channel/FX texture, role/style label shifts, or uncertain age/gender impression changes.');
        lines.push('- If evidence is mixed or weak, keep the existing speaker_id and lower confidence. Preserve uncertainty in grounded descriptors/inferred traits.');
        lines.push('- Minimize speaker-id proliferation. One-line speaker IDs are discouraged unless there is strong explicit acoustic contradiction.');
        lines.push('- Anti-over-merge guardrail: if two or more stable acoustic signals consistently conflict with the current speaker across adjacent lines, split to a new speaker_id.');
        lines.push('- If adjacent words are one uninterrupted utterance from the same voice, keep them together instead of splitting them into artificial fragments.');
        lines.push('- The handoff is reference-only memory. Never copy or continue prior lines unless they are audibly present in THIS chunk.');
        lines.push('- If the current chunk only contains one audible promo/narration line, return only that line; do not invent follow-up tactical chatter from prior chunks.');
      }

      if (tail.length > 0) {
        if (lines.length > 0) lines.push('');
        lines.push('Recent dialogue tail (reference only, not transcript continuation):');
        for (const segment of tail) {
          const speakerId = typeof segment?.speaker_id === 'string' && segment.speaker_id.trim().length > 0
            ? ` (${segment.speaker_id.trim()})`
            : '';
          const speaker = segment?.speaker ? String(segment.speaker).trim() : 'Speaker';
          const text = segment?.text ? String(segment.text).trim() : '';
          lines.push(`- ${speaker}${speakerId}: ${text}`.trim());
        }
      }

      return lines.join('\n').trim();
    };

    let wholeAssetDialogueResult = null;
    let chunkedDialogueResult = null;

    if (shouldAttemptWholeAsset) {
      // --------------------
      // Within-budget path
      // --------------------
      // Convert audio to base64 for AI provider
      const audioBase64 = fs.readFileSync(audioPath).toString('base64');
      const audioMimeType = getAudioMimeType(config);

      // Build transcription prompt
      prompt = buildTranscriptionPrompt({
        recoveryRuntime,
        measuredRuntimeSeconds: transportPreflight.durationSeconds
      });

      promptRef = captureRaw
        ? storePromptPayload({ outputDir, payload: prompt })
        : null;

      if (promptRef?.absolutePath) {
        events.artifactWrite({ absolutePath: promptRef.absolutePath, role: 'raw.prompt', phase: PHASE_KEY, script: SCRIPT_ID });
      }

      console.log(`   🔁 Dialogue retry config: attempts=${retryConfig.maxAttempts}, backoffMs=${retryConfig.backoffMs}`);

      // Call AI provider for transcription (targets + consolidated retries)
      console.log('   🤖 Calling AI provider for transcription...');

      const attemptStartMs = new Map();

      const { result: dialogueResult, meta } = await executeWithTargets({
        config,
        domain: 'dialogue',
        retry: retryConfig,
        operation: async (ctx) => {
          const adapter = ctx?.target?.adapter;
          const attemptKey = String(ctx?.attempt || '');

          if (attemptKey && !attemptStartMs.has(attemptKey)) {
            attemptStartMs.set(attemptKey, Date.now());
            events.emit({
              kind: 'attempt.start',
              phase: PHASE_KEY,
              script: SCRIPT_ID,
              domain: 'dialogue',
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
          const runtimeConfig = resolveProviderRuntimeConfigForTarget({
            configForTarget: ctx.configForTarget,
            target: ctx.target
          });

          const providerCallStart = Date.now();
          events.emit({
            kind: 'provider.call.start',
            phase: PHASE_KEY,
            script: SCRIPT_ID,
            domain: 'dialogue',
            attempt: ctx.attempt,
            attemptInTarget: ctx.attemptInTarget,
            targetIndex: ctx.targetIndex,
            targetCount: ctx.targetCount,
            provider: adapter?.name || null,
            model: adapter?.model || null,
          });

          try {
            const toolLoopResult = await executeDialogueTranscriptionToolLoop({
              provider,
              adapter,
              basePrompt: prompt,
              toolLoopConfig,
              promptRef,
              events,
              ctx,
              runtimeConfig,
              audioBase64,
              audioMimeType,
              requireHandoff: false,
              finalArtifactRules: [
                'Identify speakers as Speaker 1, Speaker 2, etc. for human-readable labels, while reusing anonymous speaker_id values for same-speaker linkage.',
                'Preserve dialogue chronology using array order/index; include start/end timestamps only when directly supportable from the audio.',
                'Keep grounded speaker identity separate from any inferred_traits guesswork.',
                'Include audibly supported spoken dialogue and dialogue-like vocal material when it plausibly functions as dialogue, including short spoken fragments when only part of a weak, filtered, or partially masked line is recoverable. Exclude purely instrumental or otherwise non-vocal sections.',
                'Do not drop or trim audibly supported spoken words merely because musical score is present underneath, delivery has melodic contour, or a phrase might also resemble lyrics.',
                'If classification is ambiguous, preserve the line and express uncertainty through conservative confidence rather than suppressing it.',
                'Reconciliation happens later; do not act as the final filter for whether a retained speech-like phrase should be stripped as lyric-only material.',
                'If a spoken line is real but weak, filtered, reverberant, synthetic-sounding, or only partly recoverable, keep the audible portion as its own segment instead of dropping it.',
                'Do not absorb a short weak spoken line into stronger neighboring lines merely because the neighboring lines are clearer, longer, or easier to summarize.',
                'Low confidence is an allowed outcome. If spoken words are audibly supported but faint or uncertain, preserve them with reduced confidence rather than suppressing them.',
                'If no audibly supported spoken words or spoken fragments are detected, return an empty dialogue_segments array.'
              ]
            });

            events.emit({
              kind: 'provider.call.end',
              phase: PHASE_KEY,
              script: SCRIPT_ID,
              domain: 'dialogue',
              attempt: ctx.attempt,
              attemptInTarget: ctx.attemptInTarget,
              targetIndex: ctx.targetIndex,
              ok: true,
              durationMs: Date.now() - providerCallStart,
              provider: adapter?.name || null,
              model: adapter?.model || null,
            });

            const actualDuration = transportPreflight.durationSeconds;
            const dialogueData = normalizeDialogueDataToDuration(toolLoopResult.parsed, actualDuration, {
              preserveReportedTotalDuration: true
            });

            return { completion: toolLoopResult.completion, dialogueData, toolLoop: toolLoopResult.toolLoop };
          } catch (error) {
            events.emit({
              kind: 'provider.call.end',
              phase: PHASE_KEY,
              script: SCRIPT_ID,
              domain: 'dialogue',
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
          error
        }) => {
          const attemptKey = String(attempt || '');
          const startedAt = attemptKey && attemptStartMs.has(attemptKey) ? attemptStartMs.get(attemptKey) : null;

          const persistedError = ok ? null : getPersistedErrorInfo(error);

          events.emit({
            kind: 'attempt.end',
            phase: PHASE_KEY,
            script: SCRIPT_ID,
            domain: 'dialogue',
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
          const failureAiTargets = !ok && error?.aiTargets ? sanitizeRawCaptureValue({
            classification: error.aiTargets.classification || null,
            group: error.aiTargets.group || null,
            raw: error.aiTargets.raw || null,
            extracted: error.aiTargets.extracted || null,
            parseError: error.aiTargets.parseError || null,
            validationErrors: error.aiTargets.validationErrors || [],
            validationSummary: error.aiTargets.validationSummary || null,
            completion: error.aiTargets.completion || null,
            toolLoop: error.aiTargets.toolLoop || null,
            promptRef: error.aiTargets.promptRef || null,
            attempts: Number.isInteger(error.aiTargets.attempts) ? error.aiTargets.attempts : null,
            domain: error.aiTargets.domain || null,
            targetIndex: Number.isInteger(error.aiTargets.targetIndex) ? error.aiTargets.targetIndex : null,
            targetCount: Number.isInteger(error.aiTargets.targetCount) ? error.aiTargets.targetCount : null,
            adapter: error.aiTargets.adapter || null
          }) : null;

          writeDialogueRaw(attempt, {
            attempt,
            attemptInTarget,
            targetIndex,
            targetCount,
            adapter,
            failover: failover || null,
            promptRef: promptRef ? { sha256: promptRef.sha256, file: promptRef.file } : null,
            rawResponse: ok
              ? sanitizeRawCaptureValue(result?.completion)
              : (sanitizeRawCaptureValue(error?.aiTargets?.completion || error?.aiTargets?.raw) || null),
            parsed: ok ? result?.dialogueData : null,
            toolLoop: ok
              ? sanitizeRawCaptureValue(result?.toolLoop)
              : (sanitizeRawCaptureValue(error?.aiTargets?.toolLoop || error?.debug?.toolLoop) || null),
            aiTargets: failureAiTargets,
            error: ok ? null : (error?.message || String(error)),
            errorName: ok ? null : (error?.name || null),
            errorCode: ok ? null : (error?.code || null),
            errorStatus: ok ? null : (persistedError?.status || null),
            errorRequestId: ok ? null : (persistedError?.requestId || null),
            errorClassification: ok ? null : (persistedError?.classification || null),
            errorStack: ok ? null : (typeof error?.stack === 'string' ? error.stack : null),
            errorDebug: ok ? null : (sanitizeRawCaptureValue(error?.debug) || null),
            errorResponse: ok ? null : (sanitizeRawCaptureValue(persistedError?.response) || null),
            provider: adapter?.name || null,
            model: adapter?.model || null,
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

      response = dialogueResult?.completion || null;
      const dialogueData = dialogueResult.dialogueData;
      model = meta?.target?.adapter?.model || null;
      wholeAssetDialogueResult = {
        dialogueData,
        response,
        model
      };
    }

    // --------------------
    // Over-budget / refinement path: chunk + rolling handoff + REQUIRED stitcher
    // --------------------
    if (shouldRunChunked) {
      if (!config?.ai?.dialogue_stitch?.targets || !Array.isArray(config.ai.dialogue_stitch.targets) || config.ai.dialogue_stitch.targets.length === 0) {
        throw new Error('GetDialogue: chunking requires config.ai.dialogue_stitch.targets (OpenRouter-only stitcher chain)');
      }

      const chunksDir = captureRaw
      ? path.join(ffmpegRawDir, 'chunks')
      : path.join(tempDir, 'chunks');
    fs.mkdirSync(chunksDir, { recursive: true });

    const chunkSegments = [];
    const chunkSpeakerProfiles = [];
    const chunkSummaries = [];
    const debugChunkRefs = [];

    let rollingHandoff = '';

    const chunkingReason = describeDialogueChunkingReason(chunkingPreflight);
    const openingArbitration = chunkingPreflight.trace?.openingArbitration;
    const openingArbitrationNote = openingArbitration
      ? ` with opening provenance arbitration (${Number(openingArbitration.coverageSeconds).toFixed(1)}s @ ~${Number(openingArbitration.chunkDurationSeconds).toFixed(1)}s chunks)`
      : '';
    console.log(`   🧩 Dialogue chunking enabled via ${chunkingReason}${openingArbitrationNote}, chunking into ${chunkingPreflight.chunkPlan.length} chunks (~${chunkingPreflight.recommendedChunkDurationSeconds.toFixed(1)}s base chunks)`);

    for (const chunk of chunkingPreflight.chunkPlan) {
      const { index: chunkIndex, startTime, endTime } = chunk;

      const extraction = await extractAudioChunk(
        audioPath,
        startTime,
        endTime,
        chunksDir,
        chunkIndex,
        {
          config,
          rawLogger: captureRaw
            ? (payload) => writeRawJson(ffmpegRawDir, `extract-chunk-${chunkIndex}.json`, payload)
            : null
        }
      );

      if (!extraction.success) {
        const extractionError = new Error(`Failed to extract audio chunk ${chunkIndex}: ${extraction.error}`);
        applyFailureMetadata(extractionError, extraction.failure, {
          diagnostics: {
            ...(extraction.failure?.diagnostics || {}),
            chunkIndex,
            startTime,
            endTime
          }
        });
        throw extractionError;
      }

      if (captureRaw) {
        events.artifactWrite({ absolutePath: extraction.chunkPath, role: 'raw.ffmpeg.chunk', phase: PHASE_KEY, script: SCRIPT_ID });
      }

      const audioBase64 = fs.readFileSync(extraction.chunkPath).toString('base64');
      const audioMimeType = getAudioMimeType(config);

      const chunkPrompt = buildChunkTranscriptionPrompt({
        chunkIndex,
        startTime,
        endTime,
        priorHandoff: rollingHandoff,
        recoveryRuntime,
        openingArbitration: chunkingPreflight.trace?.openingArbitration && startTime < chunkingPreflight.trace.openingArbitration.coverageSeconds
          ? chunkingPreflight.trace.openingArbitration
          : null
      });

      const chunkPromptRef = captureRaw
        ? storePromptPayload({ outputDir, payload: chunkPrompt })
        : null;

      if (chunkPromptRef?.absolutePath) {
        events.artifactWrite({ absolutePath: chunkPromptRef.absolutePath, role: 'raw.prompt', phase: PHASE_KEY, script: SCRIPT_ID });
      }

      const attemptStartMs = new Map();

      const { result: chunkResult } = await executeWithTargets({
        config,
        domain: 'dialogue',
        retry: retryConfig,
        operation: async (ctx) => {
          const adapter = ctx?.target?.adapter;
          const attemptKey = String(ctx?.attempt || '');

          if (attemptKey && !attemptStartMs.has(attemptKey)) {
            attemptStartMs.set(attemptKey, Date.now());
            events.emit({
              kind: 'attempt.start',
              phase: PHASE_KEY,
              script: SCRIPT_ID,
              domain: 'dialogue',
              chunkIndex,
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
          const runtimeConfig = resolveProviderRuntimeConfigForTarget({
            configForTarget: ctx.configForTarget,
            target: ctx.target
          });

          const providerCallStart = Date.now();
          events.emit({
            kind: 'provider.call.start',
            phase: PHASE_KEY,
            script: SCRIPT_ID,
            domain: 'dialogue',
            chunkIndex,
            attempt: ctx.attempt,
            attemptInTarget: ctx.attemptInTarget,
            targetIndex: ctx.targetIndex,
            targetCount: ctx.targetCount,
            provider: adapter?.name || null,
            model: adapter?.model || null,
          });

          try {
            const toolLoopResult = await executeDialogueTranscriptionToolLoop({
              provider,
              adapter,
              basePrompt: chunkPrompt,
              toolLoopConfig,
              promptRef: chunkPromptRef,
              events,
              ctx,
              runtimeConfig,
              audioBase64,
              audioMimeType,
              requireHandoff: true,
              finalArtifactRules: [
                'Preserve chunk-local dialogue chronology using array order/index; include chunk-local start/end timestamps only when directly supportable from the audio.',
                'Preserve prior speaker_id continuity by default; introduce a new speaker_id only when this chunk provides clear acoustic contradiction.',
                'Keep grounded speaker identity separate from any inferred_traits guesswork.',
                'Include audibly supported spoken dialogue and dialogue-like vocal material in this chunk when it plausibly functions as dialogue, including short spoken fragments when only part of a weak, filtered, or partially masked line is recoverable. Exclude purely instrumental or otherwise non-vocal sections.',
                'Do not drop or trim audibly supported spoken words merely because musical score is present underneath, delivery has melodic contour, or a phrase might also resemble lyrics.',
                'If classification is ambiguous, preserve the line and express uncertainty through conservative confidence rather than suppressing it.',
                'Reconciliation happens later; do not act as the final filter for whether a retained speech-like phrase should be stripped as lyric-only material.',
                'If a spoken line is real but weak, filtered, reverberant, synthetic-sounding, or only partly recoverable, keep the audible portion as its own segment instead of dropping it.',
                'Do not absorb a short weak spoken line into stronger neighboring lines merely because the neighboring lines are clearer, longer, or easier to summarize.',
                'Low confidence is an allowed outcome. If spoken words are audibly supported but faint or uncertain, preserve them with reduced confidence rather than suppressing them.',
                'If no audibly supported spoken words or spoken fragments are detected, return an empty dialogue_segments array.',
                'handoffContext must stay brief and continuity-focused.'
              ]
            });

            events.emit({
              kind: 'provider.call.end',
              phase: PHASE_KEY,
              script: SCRIPT_ID,
              domain: 'dialogue',
              chunkIndex,
              attempt: ctx.attempt,
              attemptInTarget: ctx.attemptInTarget,
              targetIndex: ctx.targetIndex,
              ok: true,
              durationMs: Date.now() - providerCallStart,
              provider: adapter?.name || null,
              model: adapter?.model || null,
            });

            const actualDuration = endTime - startTime;
            const dialogueData = normalizeDialogueDataToDuration(toolLoopResult.parsed, actualDuration, { requireHandoff: true });

            return { completion: toolLoopResult.completion, dialogueData, toolLoop: toolLoopResult.toolLoop };
          } catch (error) {
            events.emit({
              kind: 'provider.call.end',
              phase: PHASE_KEY,
              script: SCRIPT_ID,
              domain: 'dialogue',
              chunkIndex,
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
          error
        }) => {
          const attemptKey = String(attempt || '');
          const startedAt = attemptKey && attemptStartMs.has(attemptKey) ? attemptStartMs.get(attemptKey) : null;

          const persistedError = ok ? null : getPersistedErrorInfo(error);

          events.emit({
            kind: 'attempt.end',
            phase: PHASE_KEY,
            script: SCRIPT_ID,
            domain: 'dialogue',
            chunkIndex,
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
          const failureAiTargets = !ok && error?.aiTargets ? sanitizeRawCaptureValue({
            classification: error.aiTargets.classification || null,
            group: error.aiTargets.group || null,
            raw: error.aiTargets.raw || null,
            extracted: error.aiTargets.extracted || null,
            parseError: error.aiTargets.parseError || null,
            validationErrors: error.aiTargets.validationErrors || [],
            validationSummary: error.aiTargets.validationSummary || null,
            completion: error.aiTargets.completion || null,
            toolLoop: error.aiTargets.toolLoop || null,
            promptRef: error.aiTargets.promptRef || null,
            attempts: Number.isInteger(error.aiTargets.attempts) ? error.aiTargets.attempts : null,
            domain: error.aiTargets.domain || null,
            targetIndex: Number.isInteger(error.aiTargets.targetIndex) ? error.aiTargets.targetIndex : null,
            targetCount: Number.isInteger(error.aiTargets.targetCount) ? error.aiTargets.targetCount : null,
            adapter: error.aiTargets.adapter || null
          }) : null;

          writeDialogueChunkRaw(chunkIndex, attempt, {
            chunkIndex,
            startTime,
            endTime,
            rollingHandoffIn: rollingHandoff || null,
            attempt,
            attemptInTarget,
            targetIndex,
            targetCount,
            adapter,
            failover: failover || null,
            promptRef: chunkPromptRef ? { sha256: chunkPromptRef.sha256, file: chunkPromptRef.file } : null,
            rawResponse: ok
              ? sanitizeRawCaptureValue(result?.completion)
              : (sanitizeRawCaptureValue(error?.aiTargets?.completion || error?.aiTargets?.raw) || null),
            parsed: ok ? result?.dialogueData : null,
            toolLoop: ok
              ? sanitizeRawCaptureValue(result?.toolLoop)
              : (sanitizeRawCaptureValue(error?.aiTargets?.toolLoop || error?.debug?.toolLoop) || null),
            aiTargets: failureAiTargets,
            error: ok ? null : (error?.message || String(error)),
            errorName: ok ? null : (error?.name || null),
            errorCode: ok ? null : (error?.code || null),
            errorStatus: ok ? null : (persistedError?.status || null),
            errorRequestId: ok ? null : (persistedError?.requestId || null),
            errorClassification: ok ? null : (persistedError?.classification || null),
            errorStack: ok ? null : (typeof error?.stack === 'string' ? error.stack : null),
            errorDebug: ok ? null : (sanitizeRawCaptureValue(error?.debug) || null),
            errorResponse: ok ? null : (sanitizeRawCaptureValue(persistedError?.response) || null),
            provider: adapter?.name || null,
            model: adapter?.model || null,
            requestMeta: {
              adapter,
              provider: adapter?.name || null,
              model: adapter?.model || null,
              chunkIndex,
              attempt,
              attemptInTarget,
              targetIndex,
              targetCount
            }
          });
        }
      });

      const parsed = chunkResult.dialogueData;
      const segments = Array.isArray(parsed.dialogue_segments) ? parsed.dialogue_segments : [];
      const segmentIndexOffset = chunkSegments.length;

      const offsetSegments = segments.map((seg) => ({
        ...seg,
        start: typeof seg.start === 'number' ? seg.start + startTime : startTime,
        end: typeof seg.end === 'number' ? seg.end + startTime : endTime
      }));

      chunkSegments.push(...offsetSegments);
      const repairedChunkSegments = repairBoundaryContinuationSpeakerDrift(chunkSegments);
      const mergedChunkSegments = mergeAdjacentDialogueSegments(repairedChunkSegments);
      chunkSegments.splice(0, chunkSegments.length, ...mergedChunkSegments);

      const profiles = Array.isArray(parsed.speaker_profiles) ? parsed.speaker_profiles : [];
      const offsetProfiles = profiles.map((profile) => ({
        ...profile,
        grounded: {
          ...(profile?.grounded || {}),
          linked_segment_indexes: Array.isArray(profile?.grounded?.linked_segment_indexes)
            ? profile.grounded.linked_segment_indexes
                .map((value) => Number.isFinite(value) ? Math.trunc(value) + segmentIndexOffset : null)
                .filter((value) => value !== null)
            : []
        }
      }));
      chunkSpeakerProfiles.push(...offsetProfiles);

      chunkSummaries.push({
        chunkIndex,
        startTime,
        endTime,
        summary: parsed.summary || null
      });

      const handoff = buildStructuredSpeakerHandoff({
        speakerProfiles: chunkSpeakerProfiles,
        segments: chunkSegments
      }) || parsed.handoffContext || makeChunkHandoffFallback(segments);
      rollingHandoff = String(handoff || '').trim();

      debugChunkRefs.push({
        chunkIndex,
        startTime,
        endTime,
        audioPath: extraction.chunkPath,
        promptRef: chunkPromptRef ? chunkPromptRef.file : null
      });
    }

    // Mechanical stitched transcript (best-effort)
    const mechanicalLines = [];
    for (const chunk of chunkingPreflight.chunkPlan) {
      mechanicalLines.push(`--- CHUNK ${chunk.index} [${chunk.startTime.toFixed(2)}s - ${chunk.endTime.toFixed(2)}s] ---`);
      const segs = chunkSegments.filter((s) => s.start < chunk.endTime && s.end > chunk.startTime);
      for (const seg of segs) {
        mechanicalLines.push(`[${seg.start.toFixed(2)}-${seg.end.toFixed(2)}] ${seg.speaker || 'Speaker'}: ${seg.text || ''}`.trim());
      }
      mechanicalLines.push('');
    }

    const stitchRawDir = path.join(aiRawDir, 'dialogue-stitch');
    const mechanicalTranscript = mechanicalLines.join('\n').trim() + '\n';

    if (captureRaw) {
      fs.mkdirSync(stitchRawDir, { recursive: true });
      const mechanicalPath = path.join(stitchRawDir, 'mechanical-transcript.txt');
      fs.writeFileSync(mechanicalPath, mechanicalTranscript, 'utf8');
      events.artifactWrite({ absolutePath: mechanicalPath, role: 'raw.ai.stitch.input', phase: PHASE_KEY, script: SCRIPT_ID });
    }

    const stitchInput = {
      schemaVersion: 1,
      kind: 'dialogue.stitch.input',
      createdAt: new Date().toISOString(),
      preflight: chunkingPreflight.trace,
      chunks: chunkSummaries,
      debugRefs: debugChunkRefs.map((ref) => ({
        chunkIndex: ref.chunkIndex,
        startTime: ref.startTime,
        endTime: ref.endTime,
        audioPath: ref.audioPath ? path.relative(events.runOutputDir || outputDir, ref.audioPath).split(path.sep).join('/') : null,
        promptRef: ref.promptRef
      })),
      mechanicalTranscript
    };

    const stitchInputPath = captureRaw
      ? writeRawJson(stitchRawDir, 'input.json', stitchInput)
      : null;

    if (stitchInputPath) {
      events.artifactWrite({ absolutePath: stitchInputPath, role: 'raw.ai.stitch.input', phase: PHASE_KEY, script: SCRIPT_ID });
    }

    const stitcherRetry = getRetryConfig(config, 'dialogue_stitch');
    const stitcherToolLoopConfig = getToolLoopConfig(config, 'dialogue_stitch');

    const stitcherPrompt = buildDialogueStitcherPrompt(stitchInput, recoveryRuntime);
    const stitcherPromptRef = captureRaw
      ? storePromptPayload({ outputDir, payload: stitcherPrompt })
      : null;

    if (stitcherPromptRef?.absolutePath) {
      events.artifactWrite({ absolutePath: stitcherPromptRef.absolutePath, role: 'raw.prompt', phase: PHASE_KEY, script: SCRIPT_ID });
    }

    const stitchAttemptStartMs = new Map();

    const writeStitchRaw = (attempt, payload) => {
      if (!captureRaw) return;

      const attemptRelDir = path.join('dialogue-stitch', `attempt-${pad(attempt, 2)}`);
      const attemptRelPath = path.join(attemptRelDir, 'capture.json');

      const capturePath = writeRawJson(aiRawDir, attemptRelPath, payload);
      events.artifactWrite({ absolutePath: capturePath, role: 'raw.ai.attempt', phase: PHASE_KEY, script: SCRIPT_ID });

      const pointerPath = writeRawJson(aiRawDir, 'dialogue-stitch.json', {
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

    const { result: stitchResult, meta: stitchMeta } = await executeWithTargets({
      config,
      domain: 'dialogue_stitch',
      retry: stitcherRetry,
      operation: async (ctx) => {
        const adapter = ctx?.target?.adapter;
        const attemptKey = String(ctx?.attempt || '');

        if (attemptKey && !stitchAttemptStartMs.has(attemptKey)) {
          stitchAttemptStartMs.set(attemptKey, Date.now());
          events.emit({
            kind: 'attempt.start',
            phase: PHASE_KEY,
            script: SCRIPT_ID,
            domain: 'dialogue_stitch',
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
        const runtimeConfig = resolveProviderRuntimeConfigForTarget({
          configForTarget: ctx.configForTarget,
          target: ctx.target
        });

        const providerCallStart = Date.now();
        events.emit({
          kind: 'provider.call.start',
          phase: PHASE_KEY,
          script: SCRIPT_ID,
          domain: 'dialogue_stitch',
          attempt: ctx.attempt,
          attemptInTarget: ctx.attemptInTarget,
          targetIndex: ctx.targetIndex,
          targetCount: ctx.targetCount,
          provider: adapter?.name || null,
          model: adapter?.model || null,
        });

        try {
          const toolLoopResult = await executeDialogueStitchToolLoop({
            provider,
            adapter,
            basePrompt: stitcherPrompt,
            toolLoopConfig: stitcherToolLoopConfig,
            promptRef: stitcherPromptRef,
            events,
            ctx,
            runtimeConfig
          });

          events.emit({
            kind: 'provider.call.end',
            phase: PHASE_KEY,
            script: SCRIPT_ID,
            domain: 'dialogue_stitch',
            attempt: ctx.attempt,
            attemptInTarget: ctx.attemptInTarget,
            targetIndex: ctx.targetIndex,
            ok: true,
            durationMs: Date.now() - providerCallStart,
            provider: adapter?.name || null,
            model: adapter?.model || null,
          });

          return { completion: toolLoopResult.completion, parsed: toolLoopResult.parsed, toolLoop: toolLoopResult.toolLoop };
        } catch (error) {
          events.emit({
            kind: 'provider.call.end',
            phase: PHASE_KEY,
            script: SCRIPT_ID,
            domain: 'dialogue_stitch',
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
        error
      }) => {
        const attemptKey = String(attempt || '');
        const startedAt = attemptKey && stitchAttemptStartMs.has(attemptKey) ? stitchAttemptStartMs.get(attemptKey) : null;

        const persistedError = ok ? null : getPersistedErrorInfo(error);

        events.emit({
          kind: 'attempt.end',
          phase: PHASE_KEY,
          script: SCRIPT_ID,
          domain: 'dialogue_stitch',
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
        const failureAiTargets = !ok && error?.aiTargets ? sanitizeRawCaptureValue({
          classification: error.aiTargets.classification || null,
          group: error.aiTargets.group || null,
          raw: error.aiTargets.raw || null,
          extracted: error.aiTargets.extracted || null,
          parseError: error.aiTargets.parseError || null,
          validationErrors: error.aiTargets.validationErrors || [],
          validationSummary: error.aiTargets.validationSummary || null,
          completion: error.aiTargets.completion || null,
          toolLoop: error.aiTargets.toolLoop || null,
          promptRef: error.aiTargets.promptRef || null,
          attempts: Number.isInteger(error.aiTargets.attempts) ? error.aiTargets.attempts : null,
          domain: error.aiTargets.domain || null,
          targetIndex: Number.isInteger(error.aiTargets.targetIndex) ? error.aiTargets.targetIndex : null,
          targetCount: Number.isInteger(error.aiTargets.targetCount) ? error.aiTargets.targetCount : null,
          adapter: error.aiTargets.adapter || null
        }) : null;

        writeStitchRaw(attempt, {
          attempt,
          attemptInTarget,
          targetIndex,
          targetCount,
          adapter,
          failover: failover || null,
          promptRef: stitcherPromptRef ? { sha256: stitcherPromptRef.sha256, file: stitcherPromptRef.file } : null,
          stitchInputRef: stitchInputPath ? path.relative(events.runOutputDir || outputDir, stitchInputPath).split(path.sep).join('/') : null,
          rawResponse: ok
            ? sanitizeRawCaptureValue(result?.completion)
            : (sanitizeRawCaptureValue(error?.aiTargets?.completion || error?.aiTargets?.raw) || null),
          parsed: ok ? result?.parsed : null,
          toolLoop: ok
            ? sanitizeRawCaptureValue(result?.toolLoop)
            : (sanitizeRawCaptureValue(error?.aiTargets?.toolLoop || error?.debug?.toolLoop) || null),
          aiTargets: failureAiTargets,
          error: ok ? null : (error?.message || String(error)),
          errorName: ok ? null : (error?.name || null),
          errorCode: ok ? null : (error?.code || null),
          errorStatus: ok ? null : (persistedError?.status || null),
          errorRequestId: ok ? null : (persistedError?.requestId || null),
          errorClassification: ok ? null : (persistedError?.classification || null),
          errorStack: ok ? null : (typeof error?.stack === 'string' ? error.stack : null),
          errorDebug: ok ? null : (sanitizeRawCaptureValue(error?.debug) || null),
          errorResponse: ok ? null : (sanitizeRawCaptureValue(persistedError?.response) || null),
          provider: adapter?.name || null,
          model: adapter?.model || null,
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

    const stitchParsed = stitchResult.parsed || {};

    const stitchOutputPath = captureRaw
      ? writeRawJson(stitchRawDir, 'output.json', stitchParsed)
      : null;

    if (stitchOutputPath) {
      events.artifactWrite({ absolutePath: stitchOutputPath, role: 'raw.ai.stitch.output', phase: PHASE_KEY, script: SCRIPT_ID });
    }

    const cleanedTranscript = typeof stitchParsed.cleanedTranscript === 'string'
      ? stitchParsed.cleanedTranscript
      : (typeof stitchParsed.cleaned_transcript === 'string' ? stitchParsed.cleaned_transcript : null);

    const normalizedDialogueValidation = validateDialogueTranscriptionObject({
      dialogue_segments: chunkSegments,
      speaker_profiles: chunkSpeakerProfiles,
      summary: cleanedTranscript || 'Chunked transcription completed',
      totalDuration: transportPreflight.durationSeconds,
      ...(rollingHandoff ? { handoffContext: rollingHandoff } : {})
    });

    if (!normalizedDialogueValidation.ok) {
      throw new Error(normalizedDialogueValidation.summary || 'Failed to normalize chunked dialogue contract.');
    }

    const dialogueData = {
      ...normalizedDialogueValidation.value,
      ...(cleanedTranscript ? { cleanedTranscript } : {})
    };

    model = stitchMeta?.target?.adapter?.model || null;
    chunkedDialogueResult = {
      dialogueData,
      response: stitchResult?.completion || null,
      model
    };
    }

    if (!wholeAssetDialogueResult && !chunkedDialogueResult) {
      throw new Error('GetDialogue: no dialogue result was produced.');
    }

    const fallbackReason = (dialogueModeConfig.requestedMode === 'whole_asset' || dialogueModeConfig.requestedMode === 'hybrid')
      && !wholeAssetDialogueResult
      && chunkedDialogueResult
      ? (wholeAssetUnavailableReason || transportPreflight?.trace?.reason || chunkingPreflight?.trace?.reason || 'transport_budget_exceeded')
      : null;

    const effectiveAnalysisMode = wholeAssetDialogueResult && chunkedDialogueResult
      ? 'hybrid'
      : (wholeAssetDialogueResult ? 'whole_asset' : 'chunked');

    let finalDialogueData = null;

    if (wholeAssetDialogueResult && chunkedDialogueResult) {
      finalDialogueData = buildDialogueAnalysisMetadata({
        dialogueData: {
          ...chunkedDialogueResult.dialogueData,
          summary: wholeAssetDialogueResult.dialogueData?.summary || chunkedDialogueResult.dialogueData?.summary,
          handoffContext: chunkedDialogueResult.dialogueData?.handoffContext
            || wholeAssetDialogueResult.dialogueData?.handoffContext
            || null
        },
        analysisMode: 'hybrid',
        timingMode: 'chunk_local',
        sourceStrategy: 'base64',
        durationSeconds: transportPreflight.durationSeconds,
        usedChunking: true,
        chunkPlan: chunkingPreflight,
        preserveChunkPlanMetadata: dialogueModeConfig.preserveChunkPlanMetadata,
        qualityNotes: [
          'Whole-asset summary/context was preserved while chunked stitching retained local timing fidelity.'
        ]
      });
    } else if (wholeAssetDialogueResult) {
      finalDialogueData = buildDialogueAnalysisMetadata({
        dialogueData: wholeAssetDialogueResult.dialogueData,
        analysisMode: 'whole_asset',
        timingMode: 'full_timeline',
        sourceStrategy: 'base64',
        durationSeconds: transportPreflight.durationSeconds,
        usedChunking: false,
        preserveChunkPlanMetadata: dialogueModeConfig.preserveChunkPlanMetadata,
        qualityNotes: dialogueModeConfig.requestedMode === 'hybrid'
          ? ['Hybrid mode resolved to a single whole-asset pass because chunk refinement was not needed.']
          : []
      });
    } else {
      finalDialogueData = buildDialogueAnalysisMetadata({
        dialogueData: chunkedDialogueResult.dialogueData,
        analysisMode: 'chunked',
        timingMode: 'chunk_local',
        sourceStrategy: 'base64',
        durationSeconds: transportPreflight.durationSeconds,
        usedChunking: true,
        chunkPlan: chunkingPreflight,
        fallbackApplied: Boolean(fallbackReason),
        fallbackReason,
        preserveChunkPlanMetadata: dialogueModeConfig.preserveChunkPlanMetadata,
        qualityNotes: fallbackReason
          ? ['Whole-asset dialogue delivery was unavailable, so chunked fallback remained active.']
          : []
      });
    }

    if (!preserveSegmentTiming) {
      finalDialogueData = stripDialogueSegmentTiming(finalDialogueData);
    }

    response = chunkedDialogueResult?.response || wholeAssetDialogueResult?.response || response;
    model = chunkedDialogueResult?.model || wholeAssetDialogueResult?.model || model;

    const dialogueV3SourceTruth = buildDialogueV3SourceTruth(finalDialogueData, {
      summary: finalDialogueData.summary
    });

    const artifactPath = path.join(phaseDir, 'dialogue-data.json');
    fs.writeFileSync(artifactPath, JSON.stringify(finalDialogueData, null, 2));
    events.artifactWrite({ absolutePath: artifactPath, role: 'artifact', phase: PHASE_KEY, script: SCRIPT_ID });

    const dialogueV3ArtifactPath = path.join(phaseDir, 'dialogue-v3-source-truth.json');
    fs.writeFileSync(dialogueV3ArtifactPath, JSON.stringify(dialogueV3SourceTruth, null, 2));
    events.artifactWrite({ absolutePath: dialogueV3ArtifactPath, role: 'artifact', phase: PHASE_KEY, script: SCRIPT_ID });

    console.log(`   ✅ Dialogue extraction complete (${effectiveAnalysisMode})`);
    console.log(`      Output: ${artifactPath}`);
    console.log(`      Found ${finalDialogueData.dialogue_segments.length} dialogue segments`);
    console.log(`      Total duration: ${finalDialogueData.totalDuration.toFixed(1)}s`);

    return {
      artifacts: {
        dialogueData: finalDialogueData,
        dialogueV3SourceTruth
      }
    };
  } catch (error) {
    phaseOutcome = 'failed';
    fatalPhaseError = error;

    const persistedError = getPersistedErrorInfo(error);

    recordPhaseError({
      level: 'error',
      kind: 'fatal',
      message: error?.message || String(error),
      errorName: error?.name || null,
      errorCode: error?.code || null,
      errorStatus: persistedError.status,
      errorRequestId: persistedError.requestId,
      errorClassification: persistedError.classification
    });

    // AI attempts (including errors) are captured via executeWithTargets(onAttempt).

    console.error('   ❌ Error extracting dialogue:', error.message);
    throw error;
  } finally {
    ensurePhaseErrorArtifacts({
      captureRaw,
      rawMetaDir,
      events,
      phaseOutcome,
      fatalPhaseError,
      phaseErrors
    });

    events.emit({ kind: 'script.end', phase: PHASE_KEY, script: SCRIPT_ID, outcome: phaseOutcome });

    // Handle temp file cleanup based on config
    if (keepProcessedIntermediates) {
      console.log(`   💾 Keeping dialogue temp files in ${tempDir}`);
    } else {
      // Clean up temp files
      try {
        if (fs.existsSync(tempDir)) {
          fs.rmSync(tempDir, { recursive: true, force: true });
        }
      } catch (e) {
        console.warn('   ⚠️  Warning: Failed to cleanup dialogue temp files:', e.message);
      }
    }
  }
}

/**
 * Extract audio from video using ffmpeg
 * 
 * @async
 * @function extractAudio
 * @param {string} videoPath - Path to video file
 * @param {string} outputDir - Output directory for audio file
 * @returns {Promise<string>} - Path to extracted audio file
 */
async function extractAudio(videoPath, outputDir, rawCapture = {}) {
  const ffmpegAudioConfig = getRequiredAudioConfig(rawCapture.config);
  const audioPath = path.join(outputDir, `audio.${getAudioOutputExtension(ffmpegAudioConfig)}`);

  // Check if input is already audio
  const ext = path.extname(videoPath).toLowerCase();
  const isAudio = ['.mp3', '.wav', '.ogg', '.m4a', '.flac'].includes(ext);

  if (isAudio) {
    // Copy audio file directly
    fs.copyFileSync(videoPath, audioPath);
    if (rawCapture.captureRaw) {
      writeRawJson(rawCapture.ffmpegRawDir, rawCapture.logName || 'extract-audio.json', {
        tool: 'copy',
        command: 'fs.copyFileSync',
        input: videoPath,
        output: audioPath,
        status: 'success'
      });
    }
    return audioPath;
  }

  const args = buildAudioExtractArgs({
    inputPath: videoPath,
    outputPath: audioPath,
    ffmpegAudioConfig,
    disableVideo: true
  });
  const command = formatCommand(ffmpegPath, args);

  try {
    const { stdout, stderr } = await runCommand(ffmpegPath, args);
    if (rawCapture.captureRaw) {
      writeRawJson(rawCapture.ffmpegRawDir, rawCapture.logName || 'extract-audio.json', {
        tool: 'ffmpeg',
        command,
        args,
        stdout,
        stderr,
        status: 'success'
      });
    }
    return audioPath;
  } catch (error) {
    if (rawCapture.captureRaw) {
      writeRawJson(rawCapture.ffmpegRawDir, rawCapture.logName || 'extract-audio.json', {
        tool: 'ffmpeg',
        command,
        args,
        stdout: error.stdout || '',
        stderr: error.stderr || '',
        status: 'failed',
        error: error.message
      });
    }
    throw new Error(`Failed to extract audio: ${error.message}`);
  }
}

/**
 * Build transcription prompt for AI
 * 
 * @function buildTranscriptionPrompt
 * @returns {string} - Transcription prompt
 */
function buildDialogueInferredTraitsRules() {
  return [
    '- inferred_traits must always be present as an object with a traits array.',
    '- If you are unsure or have no supportable speculative traits, return exactly "inferred_traits": { "traits": [] }.',
    '- Every inferred_traits.traits[*] entry must be an object with at least "trait" and "value" string fields. You may optionally add "confidence" and "note".',
    '- Valid inferred trait example: { "trait": "accent", "value": "possibly Midwestern US", "confidence": 0.31, "note": "speculative" }.',
    '- Do not return bare strings, descriptor-only objects, or grounded evidence inside inferred_traits.',
    '- Keep inferred_traits clearly speculative and separate from grounded same-speaker evidence.'
  ].join('\n');
}

function buildTranscriptionPrompt({ recoveryRuntime = null, measuredRuntimeSeconds = null } = {}) {
  const runtimeAnchorRules = Number.isFinite(measuredRuntimeSeconds)
    ? [
        `- The attached media runtime was measured locally at ${Number(measuredRuntimeSeconds).toFixed(2)} seconds and may include non-dialogue spans.`,
        '- Preserve dialogue segment order via array order/index chronology. Include start/end timestamps only when they are directly supportable from the audio.'
      ]
    : [];
  const inferredTraitsRules = buildDialogueInferredTraitsRules();

  const prompt = `Transcribe the audible dialogue and dialogue-like vocal material in this audio.

Return JSON only with this shape:
{
  "dialogue_segments": [
    {
      "index": 0,
      "start": 0.0,
      "end": 1.2,
      "speaker": "Speaker 1",
      "speaker_id": "spk_001",
      "text": "example line",
      "confidence": 0.72
    }
  ],
  "speaker_profiles": [
    {
      "speaker_id": "spk_001",
      "label": "Speaker 1",
      "grounded": {
        "confidence": 0.68,
        "linked_segment_indexes": [0],
        "acoustic_descriptors": [{ "label": "low raspy voice", "confidence": 0.62 }, { "label": "close-mic delivery", "confidence": 0.58 }]
      },
      "inferred_traits": {
        "traits": [
          {
            "trait": "presentation",
            "value": "adult masculine-coded voice",
            "confidence": 0.45,
            "note": "speculative impression from timbre only"
          }
        ]
      }
    }
  ],
  "summary": "brief summary of the dialogue content"
}

Rules:
${buildEnglishOnlyOutputRuleBlock()}
- Return JSON only. No markdown. No explanation.
- Preserve dialogue segment chronology via array order/index values.
- start/end timestamps are optional and should be included only when directly supportable from the audio.
- If no audibly supported spoken words or spoken fragments are present, return an empty dialogue_segments array.
${runtimeAnchorRules.join('\n')}

Segmentation rules:
- Preserve real utterance boundaries.
- Do not merge adjacent beats just because they are semantically related, grammatically compatible, or close together in time.
- Treat pauses, interruptions, overlap changes, delivery pivots, and speaker changes as evidence of separate segments.
- If two phrases are separated by a noticeable pause, interruption, overlap change, or speaker change, keep them as separate dialogue_segments even if combining them would read more smoothly.
- If words are part of one uninterrupted utterance from the same voice, keep them in one segment; do not split artificially.
- Do not bridge across silence, music-only gaps, or non-vocal stretches to create a cleaner sentence.
- Preserve utterance ordering from the source audio; do not pull later lines earlier or compress dialogue into earlier entries.
- Do not absorb a short weak spoken line into stronger neighboring lines merely because the neighboring lines are clearer, longer, or easier to summarize.
- A brief audible insert between stronger surrounding lines should stay as its own segment when the insert itself is audibly supported, even if its confidence is low.

Damaged-speech rules:
- When speech is partially masked, clipped, distant, distorted, reverberant, filtered, synthetic-sounding, or overlapped, prefer a short literal fragment of what is actually audible.
- Preserve damaged speech as heard.
- Do not smooth a damaged line into a cleaner full sentence.
- Do not borrow missing words from neighboring beats, scene context, likely script memory, or semantic expectation.
- If only part of a line is supported by the audio, return only that supported fragment.
- If a spoken line is real but weak, filtered, reverberant, synthetic-sounding, or only partly recoverable, keep the audible portion as its own segment instead of dropping it.
- When deciding between omitting a weak spoken line and keeping a short supported fragment with low confidence, prefer the supported fragment.
- Prefer a short literal fragment over a polished but weakly supported reconstruction.

Speaker rules:
- Speaker continuity is acoustic, not semantic.
- For adjacent or near-adjacent lines, default to reusing the current speaker_id unless there is clear acoustic contradiction.
- A named character, repeated topic, scene continuity, or conversational adjacency is not proof that two lines came from the same speaker.
- A single cue is never enough to mint a new speaker_id.
- Create a new speaker_id only when at least TWO stable acoustic signals disagree with the current voice profile.
- Stable signals: core timbre/phonation quality, persistent accent/dialect impression, and sustained delivery profile across more than a fleeting phrase.
- Do not split solely on fragile cues: intensity/energy shifts, pacing changes, microphone distance changes, channel/FX texture, role/style label shifts, or uncertain age/gender impression changes.
- If identity evidence is mixed or weak, keep the existing speaker_id, lower confidence, and preserve uncertainty in grounded descriptors/speculative traits.
- Minimize speaker-id proliferation: one-line speaker IDs are discouraged unless the line has strong explicit acoustic contradiction against nearby continuity.
- Anti-over-merge guardrail: if two or more stable acoustic signals consistently conflict with the current speaker across adjacent lines, split to a new speaker_id.

Confidence rules:
- Use conservative confidence values.
- Confidence must reflect both transcription certainty and speaker-assignment certainty.
- Lower confidence materially when speech is short, masked, clipped, overlapped, stylized, distant, noisy, filtered, reverberant, or speaker attribution is ambiguous.
- Low confidence is an allowed outcome. If spoken words are audibly supported but faint or uncertain, preserve them with reduced confidence rather than suppressing them.
- Do not use near-certain scores unless the words and the speaker match are both strongly supported by the audio.
- Similar-sounding voices, damaged fragments, and overlap-heavy moments should often stay moderate-confidence rather than near-certain.
- Do not signal certainty you did not earn from the audio.

Speaker profile rules:
- Use generic display labels such as "Speaker 1", "Speaker 2", etc., but preserve continuity with anonymous speaker_id values such as "spk_001".
- Every speaker_profiles[*].grounded object must include a numeric confidence from 0.0 to 1.0.
- grounded should contain cautious same-speaker evidence: anonymous continuity, linked_segment_indexes, and acoustically supported descriptors.
- When supportable, include practical acoustic_descriptors that would help a later reviewer distinguish or reunify speakers, such as pitch range, raspiness/smoothness, breathiness, intensity, cadence, pacing, mic distance, recording texture, accent impression, age impression, or delivery mode.
- Do not leave acoustic_descriptors empty just because the description is imperfect; include concise grounded descriptors when the audio gives real support.
- acoustic_descriptors must be an array of objects.
- Every acoustic_descriptors[*] entry must include a non-empty string label.
- acoustic_descriptors[*].confidence is optional; when present it must be a number from 0.0 to 1.0.
- Do not return plain strings in acoustic_descriptors.
- Do not use alternate keys such as value, descriptor, or acousticDescriptors for grounded descriptors; use acoustic_descriptors entries with label only.
- If no grounded descriptor is supportable, return exactly "acoustic_descriptors": [].
- If validation mentions acoustic_descriptors shape, rewrite descriptors to objects like [{"label":"...","confidence":0.6}] (or [] when unsupported).
${inferredTraitsRules}
- Use inferred_traits for clearly speculative impressions that may still help review, such as age range, gender presentation, role impression, or demeanor.
- If a trait is only weakly supported, include it with a low confidence and a short note that makes the uncertainty explicit.

Scope rules:
- Include audibly supported spoken dialogue, including short spoken fragments when only part of a weak, filtered, or partially masked line is recoverable.
- Exclude purely instrumental or non-vocal sections.
- Do not drop or trim audibly supported spoken words merely because musical score is present underneath, the delivery has melodic contour, or the phrase might also resemble lyrics.
- If classification is ambiguous, preserve the line and express uncertainty through conservative confidence rather than suppressing it.
- Reconciliation happens later; do not act as the final filter for whether a retained speech-like phrase should be stripped as lyric-only material.
- Do not use the summary to justify dropping ambiguous dialogue-like vocals early.
- The summary is secondary; do not alter segmentation, wording, or speaker assignment to make the summary cleaner.`;

  return `${prompt}${buildRecoveryPromptAddendum(recoveryRuntime)}`;
}

function parseJsonResponse(responseContent) {
  const parsed = parseAndValidateJsonObject(responseContent, (value) => ({
    ok: true,
    value,
    errors: [],
    summary: null,
    meta: { stage: 'validation' }
  }));

  return parsed.ok ? parsed.value : null;
}

function parseDialogueStitchResponse(responseContent) {
  const parsed = parseAndValidateJsonObject(responseContent, validateDialogueStitchObject);
  if (!parsed.ok) {
    throw createRetryableError(`invalid_output: ${parsed.summary || 'dialogue stitch output was invalid'}`, {
      group: parsed.meta?.stage || 'parse',
      raw: parsed.meta?.raw || responseContent || null,
      extracted: parsed.meta?.extracted || null,
      parseError: parsed.meta?.parseError || null,
      validationErrors: parsed.errors,
      validationSummary: parsed.summary
    });
  }

  return parsed.value;
}

async function executeDialogueTranscriptionToolLoop({
  provider,
  adapter,
  basePrompt,
  toolLoopConfig,
  promptRef,
  events,
  ctx,
  runtimeConfig,
  audioBase64,
  audioMimeType,
  requireHandoff = false,
  finalArtifactRules = []
}) {
  const toolContract = buildDialogueTranscriptionValidatorToolContract({ requireHandoff });

  return executeLocalValidatorToolLoop({
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
    domain: 'dialogue',
    artifactLabel: requireHandoff ? 'dialogue transcription chunk' : 'dialogue transcription',
    finalArtifactDescription: requireHandoff
      ? 'The final artifact must include handoffContext so the next chunk can preserve continuity.'
      : 'The final artifact must be the full dialogue transcription JSON object.',
    finalArtifactRules,
    callProvider: ({ prompt }) => provider.complete({
      prompt,
      model: adapter?.model,
      apiKey: runtimeConfig?.apiKey,
      baseUrl: runtimeConfig?.baseUrl,
      attachments: [
        {
          type: 'audio',
          data: audioBase64,
          mimeType: audioMimeType
        }
      ],
      options: buildProviderOptions({
        adapter,
        defaults: buildProviderOptionDefaults(runtimeConfig, {
          temperature: 0.3
        })
      })
    }),
    executeValidatorTool: (args) => executeDialogueTranscriptionValidatorTool(args, { requireHandoff }),
    normalizeValidatedValue: (value) => JSON.stringify(value),
    runtimeStyle: 'lean'
  });
}

async function executeDialogueStitchToolLoop({
  provider,
  adapter,
  basePrompt,
  toolLoopConfig,
  promptRef,
  events,
  ctx,
  runtimeConfig
}) {
  const toolContract = buildDialogueStitchValidatorToolContract();

  return executeLocalValidatorToolLoop({
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
    domain: 'dialogue_stitch',
    artifactLabel: 'dialogue stitch',
    finalArtifactDescription: 'The final artifact must be the cleaned stitched transcript JSON object.',
    finalArtifactRules: [
      'Keep meaning intact and do not invent dialogue.',
      'auditTrail must describe the major stitch operations that were actually applied.'
    ],
    callProvider: ({ prompt }) => provider.complete({
      prompt,
      model: adapter?.model,
      apiKey: runtimeConfig?.apiKey,
      baseUrl: runtimeConfig?.baseUrl,
      options: buildProviderOptions({
        adapter,
        defaults: buildProviderOptionDefaults(runtimeConfig, {
          temperature: 0.2
        })
      })
    }),
    executeValidatorTool: executeDialogueStitchValidatorTool,
    normalizeValidatedValue: (value) => JSON.stringify(value)
  });
}

function buildChunkTranscriptionPrompt({ chunkIndex, startTime, endTime, priorHandoff, recoveryRuntime = null, openingArbitration = null } = {}) {
  const handoff = typeof priorHandoff === 'string' && priorHandoff.trim().length > 0
    ? priorHandoff.trim()
    : null;
  const inferredTraitsRules = buildDialogueInferredTraitsRules();
  const openingArbitrationNote = openingArbitration && Number.isFinite(openingArbitration.coverageSeconds)
    ? `Opening provenance mode: this chunk falls inside the first ${Number(openingArbitration.coverageSeconds).toFixed(2)} seconds of the full asset, where rapid montage edits can place different voices close together. Prioritize this chunk's local acoustic evidence over storyline continuity assumptions.`
    : null;

  const prompt = `You are transcribing CHUNK ${chunkIndex} of a longer audio file.

Chunk time window: ${Number(startTime).toFixed(2)}s to ${Number(endTime).toFixed(2)}s on the global timeline.
${openingArbitrationNote ? `${openingArbitrationNote}\n` : ''}
${handoff ? `Previous chunk handoff (reference only, not transcript continuation):\n${handoff}\n\n` : ''}Transcribe the audible dialogue and dialogue-like vocal material in this chunk.

Return JSON only with this shape:
{
  "dialogue_segments": [
    {
      "index": 0,
      "start": 0.0,
      "end": 1.2,
      "speaker": "Speaker 1",
      "speaker_id": "spk_001",
      "text": "example line",
      "confidence": 0.72
    }
  ],
  "speaker_profiles": [
    {
      "speaker_id": "spk_001",
      "label": "Speaker 1",
      "grounded": {
        "confidence": 0.68,
        "linked_segment_indexes": [0],
        "acoustic_descriptors": [{ "label": "low raspy voice", "confidence": 0.62 }, { "label": "close-mic delivery", "confidence": 0.58 }]
      },
      "inferred_traits": {
        "traits": [
          {
            "trait": "presentation",
            "value": "adult masculine-coded voice",
            "confidence": 0.45,
            "note": "speculative impression from timbre only"
          }
        ]
      }
    }
  ],
  "summary": "brief summary for this chunk",
  "handoffContext": "short continuity handoff for the next chunk"
}

Rules:
${buildEnglishOnlyOutputRuleBlock()}
- Return JSON only. No markdown. No explanation.
- Preserve dialogue segment chronology via array order/index values.
- start/end timestamps are optional and should be chunk-local only when directly supportable from the audio.
- If no audibly supported spoken words or spoken fragments are present, return an empty dialogue_segments array.
- Keep handoffContext brief and continuity-focused.
- The handoff is reference-only memory. Never copy or continue prior lines unless they are audibly present in this chunk.

Segmentation rules:
- Preserve real utterance boundaries inside this chunk.
- Do not merge adjacent beats just because they are semantically related or close together in time.
- Treat pauses, interruptions, overlap changes, delivery pivots, and speaker changes as evidence of separate segments.
- If words are part of one uninterrupted utterance from the same voice, keep them in one segment; do not split artificially.
- Do not bridge across silence, music-only gaps, or non-vocal stretches to create a cleaner sentence.
- Preserve utterance ordering faithfully; do not compress late dialogue into early entries or reshuffle chronology.
- Do not absorb a short weak spoken line into stronger neighboring lines merely because the neighboring lines are clearer, longer, or easier to summarize.
- A brief audible insert between stronger surrounding lines should stay as its own segment when the insert itself is audibly supported, even if its confidence is low.

Damaged-speech rules:
- When speech is masked, clipped, distant, distorted, reverberant, filtered, synthetic-sounding, or overlapped, prefer a short literal fragment of what is actually audible.
- Preserve damaged speech as heard.
- Do not smooth a damaged line into a cleaner full sentence.
- Do not borrow missing words from neighboring chunks, scene context, or semantic expectation.
- If only part of a line is supported by the audio, return only that supported fragment.
- If a spoken line is real but weak, filtered, reverberant, synthetic-sounding, or only partly recoverable, keep the audible portion as its own segment instead of dropping it.
- When deciding between omitting a weak spoken line and keeping a short supported fragment with low confidence, prefer the supported fragment.

Speaker rules:
- Speaker continuity is acoustic, not semantic.
- Treat the handoff speaker registry as continuity memory and default to reusing a prior speaker_id unless there is clear acoustic contradiction.
- A single cue is never enough to mint a new speaker_id.
- Create a new speaker_id only when at least TWO stable acoustic signals disagree with the current voice profile.
- Stable signals: core timbre/phonation quality, persistent accent/dialect impression, and sustained delivery profile across more than a fleeting phrase.
- Do not split solely on fragile cues: intensity/energy shifts, pacing changes, microphone distance changes, channel/FX texture, role/style label shifts, or uncertain age/gender impression changes.
- If identity evidence is mixed or weak, keep the existing speaker_id, lower confidence, and preserve uncertainty in grounded descriptors/speculative traits.
- Minimize speaker-id proliferation across chunks: one-line speaker IDs are discouraged unless there is strong explicit acoustic contradiction.
- Anti-over-merge guardrail: if two or more stable acoustic signals consistently conflict with the current speaker across adjacent lines, split to a new speaker_id.
- In opening montage conditions, prefer local chunk provenance over storyline continuity.

Confidence and profile rules:
- Use conservative confidence values.
- Confidence must reflect both transcription certainty and speaker-assignment certainty.
- Lower confidence materially when speech is short, masked, clipped, overlapped, stylized, distant, noisy, filtered, reverberant, or speaker attribution is ambiguous.
- Low confidence is an allowed outcome. If spoken words are audibly supported but faint or uncertain, preserve them with reduced confidence rather than suppressing them.
- Every speaker_profiles[*].grounded object must include a numeric confidence from 0.0 to 1.0.
- grounded should contain cautious same-speaker evidence: anonymous continuity, linked_segment_indexes, and acoustically supported descriptors.
- When supportable, include practical acoustic_descriptors that would help a later reviewer distinguish or reunify speakers, such as pitch range, raspiness/smoothness, breathiness, intensity, cadence, pacing, mic distance, recording texture, accent impression, age impression, or delivery mode.
- Do not leave acoustic_descriptors empty just because the description is imperfect; include concise grounded descriptors when the audio gives real support.
- acoustic_descriptors must be an array of objects.
- Every acoustic_descriptors[*] entry must include a non-empty string label.
- acoustic_descriptors[*].confidence is optional; when present it must be a number from 0.0 to 1.0.
- Do not return plain strings in acoustic_descriptors.
- Do not use alternate keys such as value, descriptor, or acousticDescriptors for grounded descriptors; use acoustic_descriptors entries with label only.
- If no grounded descriptor is supportable, return exactly "acoustic_descriptors": [].
- If validation mentions acoustic_descriptors shape, rewrite descriptors to objects like [{"label":"...","confidence":0.6}] (or [] when unsupported).
${inferredTraitsRules}
- Use inferred_traits for clearly speculative impressions that may still help review, such as age range, gender presentation, role impression, or demeanor.
- If a trait is only weakly supported, include it with a low confidence and a short note that makes the uncertainty explicit.

Scope rules:
- Include audibly supported spoken dialogue and dialogue-like vocal material, including short spoken fragments when only part of a weak, filtered, or partially masked line is recoverable.
- Exclude purely instrumental or non-vocal sections.
- Do not drop or trim audibly supported spoken words merely because musical score is present underneath, the delivery has melodic contour, or the phrase might also resemble lyrics.
- If classification is ambiguous, preserve the line and express uncertainty through conservative confidence rather than suppressing it.
- Reconciliation happens later; do not act as the final filter for whether a retained speech-like phrase should be stripped as lyric-only material.
- Do not use adjacent spoken context or the handoff summary to pull unsupported words into this chunk.`;

  return `${prompt}${buildRecoveryPromptAddendum(recoveryRuntime)}`;
}

function buildDialogueStitcherPrompt(stitchInput, recoveryRuntime = null) {
  // The stitcher is text-only and must return structured JSON.
  const prompt = `You are a dialogue transcript stitcher.

You are given a mechanically-stitched transcript with chunk boundaries. Your job is to:
- produce a cleaned, readable transcript (fix punctuation, remove duplicated boundary fragments, normalize speaker labels)
- keep meaning intact; do NOT invent content
- provide an audit trail of the main merge operations and assumptions
- include debugging references/payloads so downstream tooling can trace back

${buildEnglishOnlyOutputRuleBlock()}
Return JSON only with this structure:

{
  "cleanedTranscript": "...",
  "auditTrail": [
    { "op": "merge_boundary", "chunkIndex": 3, "detail": "Removed duplicated phrase at boundary" }
  ],
  "debug": {
    "inputKind": "dialogue.stitch.input",
    "inputChunks": 0,
    "notes": "any notes",
    "refs": []
  }
}

Allowed values for debug.inputKind: dialogue.stitch.input.

Here is the stitch input (including mechanical transcript):
${JSON.stringify(stitchInput, null, 2)}
`;

  return `${prompt}${buildRecoveryPromptAddendum(recoveryRuntime)}`;
}

/**
 * Parse AI transcription response
 * 
 * @function parseTranscriptionResponse
 * @param {string} responseContent - AI response content
 * @param {string} audioPath - Path to audio file (for duration calculation)
 * @returns {Object} - Parsed dialogue data
 */
function parseTranscriptionResponse(responseContent, audioPath, rawCapture = {}, { requireHandoff = false } = {}) {
  const parsed = parseAndValidateJsonObject(
    responseContent,
    (value) => validateDialogueTranscriptionObject(value, { requireHandoff })
  );

  if (!parsed.ok) {
    throw createRetryableError(`invalid_output: ${parsed.summary || 'dialogue transcription output was invalid'}`, {
      group: parsed.meta?.stage || 'parse',
      raw: parsed.meta?.raw || responseContent || null,
      extracted: parsed.meta?.extracted || null,
      parseError: parsed.meta?.parseError || null,
      validationErrors: parsed.errors,
      validationSummary: parsed.summary
    });
  }

  return {
    ...parsed.value,
    totalDuration: typeof parsed.value.totalDuration === 'number'
      ? parsed.value.totalDuration
      : getAudioDuration(audioPath, rawCapture)
  };
}

/**
 * Get audio duration using ffprobe
 * 
 * @function getAudioDuration
 * @param {string} audioPath - Path to audio file
 * @returns {number} - Duration in seconds
 */
function getAudioDuration(audioPath, rawCapture = {}) {
  const command = `"${ffprobePath}" -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${audioPath}"`;
  try {
    const stdout = execSync(command, { encoding: 'utf8' });
    const stdoutText = typeof stdout === 'string' ? stdout : stdout.toString();
    if (rawCapture.captureRaw) {
      writeRawJson(rawCapture.ffmpegRawDir, rawCapture.ffprobeLogName || 'ffprobe-audio-duration.json', {
        tool: 'ffprobe',
        command,
        stdout: stdoutText,
        status: 'success'
      });
    }
    return parseFloat(stdoutText.trim()) || 0;
  } catch (e) {
    if (rawCapture.captureRaw) {
      writeRawJson(rawCapture.ffmpegRawDir, rawCapture.ffprobeLogName || 'ffprobe-audio-duration.json', {
        tool: 'ffprobe',
        command,
        stdout: e.stdout ? e.stdout.toString() : '',
        stderr: e.stderr ? e.stderr.toString() : '',
        status: 'failed',
        error: e.message
      });
    }
    return 0;
  }
}

module.exports = {
  run,
  aiRecovery: {
    guidance: 'Repair malformed or validator-rejected dialogue JSON while preserving the same transcript/stitch task and schema.',
    reentry: {
      allowedMutableInputs: ['repairInstructions', 'boundedContextSummary'],
      forbiddenMutableInputs: ['upstreamArtifacts', 'artifactPaths', 'schemaDefinition', 'runtimeBudgets']
    }
  }
};

// Allow standalone execution for testing
if (require.main === module) {
  const assetPath = process.argv[2] || 'test-audio.wav';
  const outputDir = process.argv[3] || 'output/test-dialogue';

  console.log('Get Dialogue Script - Test Mode');
  console.log('Asset:', assetPath);
  console.log('Output:', outputDir);
  console.log('');
  console.log('⚠️  This script requires:');
  console.log('   - AI_API_KEY environment variable');
  console.log('   - config.ai.dialogue.targets[*].adapter.{name,model} (set in pipeline YAML)');
  console.log('   - ffmpeg installed for audio extraction');
  console.log('   - A model that supports audio transcription (e.g., Whisper)');
  console.log('');
  console.log('Note: This script is designed to be run within the pipeline.');
  console.log('      The model must be explicitly configured in the YAML.');
}
