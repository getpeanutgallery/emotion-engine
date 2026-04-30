'use strict';

const path = require('path');

function roundNumber(value, digits = 3) {
  if (!Number.isFinite(value)) return null;
  return Number(value.toFixed(digits));
}

function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[^a-z0-9'\s]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenize(value) {
  const normalized = normalizeText(value);
  return normalized ? normalized.split(' ').filter(Boolean) : [];
}

function createTokenCountMap(tokens) {
  const counts = new Map();
  for (const token of tokens) {
    counts.set(token, (counts.get(token) || 0) + 1);
  }
  return counts;
}

function computeTokenOverlapScore(sourceText, candidateText) {
  const sourceNormalized = normalizeText(sourceText);
  const candidateNormalized = normalizeText(candidateText);
  if (!sourceNormalized || !candidateNormalized) return 0;
  if (sourceNormalized === candidateNormalized) return 1;
  if (candidateNormalized.includes(sourceNormalized) || sourceNormalized.includes(candidateNormalized)) {
    const shorter = Math.min(sourceNormalized.length, candidateNormalized.length);
    const longer = Math.max(sourceNormalized.length, candidateNormalized.length) || 1;
    return Math.max(0.8, shorter / longer);
  }

  const sourceTokens = tokenize(sourceNormalized);
  const candidateTokens = tokenize(candidateNormalized);
  if (sourceTokens.length === 0 || candidateTokens.length === 0) return 0;

  const sourceCounts = createTokenCountMap(sourceTokens);
  const candidateCounts = createTokenCountMap(candidateTokens);

  let overlap = 0;
  for (const [token, count] of sourceCounts.entries()) {
    overlap += Math.min(count, candidateCounts.get(token) || 0);
  }

  if (overlap === 0) return 0;

  const precision = overlap / candidateTokens.length;
  const recall = overlap / sourceTokens.length;
  if (precision <= 0 || recall <= 0) return 0;
  return (2 * precision * recall) / (precision + recall);
}

function buildCandidateText(segments, startIndex, endIndex) {
  return segments
    .slice(startIndex, endIndex + 1)
    .map((segment) => String(segment?.text || '').trim())
    .filter(Boolean)
    .join(' ')
    .trim();
}

function chooseTimingWindow(sourceSegment, alignmentSegments, cursor) {
  if (!Array.isArray(alignmentSegments) || alignmentSegments.length === 0) {
    return null;
  }

  const maxWindowSize = Math.min(4, alignmentSegments.length);
  let best = null;

  for (let startIndex = cursor; startIndex < alignmentSegments.length; startIndex += 1) {
    for (let windowSize = 1; windowSize <= maxWindowSize && startIndex + windowSize - 1 < alignmentSegments.length; windowSize += 1) {
      const endIndex = startIndex + windowSize - 1;
      const candidateText = buildCandidateText(alignmentSegments, startIndex, endIndex);
      const score = computeTokenOverlapScore(sourceSegment?.text, candidateText);
      if (!best || score > best.score) {
        best = { startIndex, endIndex, score, candidateText };
      }
    }

    if (best && best.score >= 0.999) {
      break;
    }
  }

  if (!best || best.score < 0.45) {
    return null;
  }

  const first = alignmentSegments[best.startIndex];
  const last = alignmentSegments[best.endIndex];
  if (!Number.isFinite(first?.start) || !Number.isFinite(last?.end) || last.end <= first.start) {
    return null;
  }

  return {
    startIndex: best.startIndex,
    endIndex: best.endIndex,
    score: best.score,
    start: roundNumber(first.start),
    end: roundNumber(last.end)
  };
}

function deriveDialogueSegmentTimings(sourceSegments, alignmentSegments) {
  const normalizedSourceSegments = Array.isArray(sourceSegments) ? sourceSegments : [];
  const normalizedAlignmentSegments = Array.isArray(alignmentSegments) ? alignmentSegments.filter((segment) => Number.isFinite(segment?.start) && Number.isFinite(segment?.end)) : [];

  let cursor = 0;

  return normalizedSourceSegments.map((segment, index) => {
    const matchedWindow = chooseTimingWindow(segment, normalizedAlignmentSegments, cursor);

    const emitted = {
      ...segment,
      index: Number.isInteger(segment?.index) ? segment.index : index,
      text: String(segment?.text || ''),
      timing: {
        status: 'unresolved',
        confidence: 0,
        method: 'asr_alignment',
        provenance: 'segment_level'
      }
    };

    if (!matchedWindow) {
      return emitted;
    }

    cursor = matchedWindow.endIndex + 1;
    emitted.start = matchedWindow.start;
    emitted.end = matchedWindow.end;
    emitted.timing = {
      status: matchedWindow.score >= 0.75 ? 'aligned' : 'partial',
      confidence: roundNumber(matchedWindow.score, 4),
      method: 'asr_alignment',
      provenance: 'segment_level'
    };

    return emitted;
  });
}

function deriveCoverage(totalDuration) {
  const boundedDuration = Number.isFinite(totalDuration) ? Math.max(0, totalDuration) : 0;
  const rounded = roundNumber(boundedDuration);
  return {
    start: 0,
    end: rounded,
    duration: rounded,
    complete: boundedDuration > 0
  };
}

function normalizeQualityNotes(notes = []) {
  return Array.from(new Set((Array.isArray(notes) ? notes : []).map((entry) => String(entry || '').trim()).filter(Boolean)));
}

function toOutputRelativePath(outputDir, absolutePath) {
  return path.relative(path.resolve(outputDir), path.resolve(absolutePath)).replace(/\\/g, '/');
}

function buildDialogueTimestampArtifact({
  sourceDialogueData,
  alignmentDialogueData,
  outputDir,
  sourcePath,
  runtimeArtifactSurface,
  sourceRuntimeKey,
  sourceArtifactKey = 'dialogueData'
}) {
  const dialogueSegments = deriveDialogueSegmentTimings(sourceDialogueData?.dialogue_segments, alignmentDialogueData?.dialogue_segments);
  const totalDuration = Number.isFinite(sourceDialogueData?.totalDuration)
    ? sourceDialogueData.totalDuration
    : alignmentDialogueData?.totalDuration;

  const qualityNotes = normalizeQualityNotes([
    'Timing was derived after transcript extraction; timestamps are a downstream alignment product, not source-captured timings.',
    runtimeArtifactSurface === 'reconciled'
      ? 'Reconciled dialogue surface was selected before timing derivation, so any lyric cleanup happened upstream of this alignment pass.'
      : null,
    'Chunked or stitched dialogue alignment may make exact segment boundaries softer than native word-level ASR anchors.'
  ]);

  return {
    dialogue_segments: dialogueSegments,
    summary: String(sourceDialogueData?.summary || alignmentDialogueData?.summary || ''),
    totalDuration: roundNumber(totalDuration),
    analysisMode: 'timestamp_derivation',
    timingMode: 'full_timeline',
    sourceStrategy: 'derived_from_phase1_artifact',
    coverage: deriveCoverage(totalDuration),
    provenance: {
      derivationKind: 'phase1_timestamp_derivation',
      runtimeArtifactSurface,
      sourceArtifactKey,
      sourceRuntimeKey,
      sourcePath: toOutputRelativePath(outputDir, sourcePath),
      sourceTextIntegrity: 'verbatim',
      sourceTimingPolicy: 'source_artifact_was_untimed',
      alignmentEngine: 'phase1_dialogue_asr_rerun',
      alignmentEngineVersion: null
    },
    qualityNotes
  };
}

module.exports = {
  normalizeText,
  computeTokenOverlapScore,
  deriveDialogueSegmentTimings,
  buildDialogueTimestampArtifact,
  toOutputRelativePath
};
