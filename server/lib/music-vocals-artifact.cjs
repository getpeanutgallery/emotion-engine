'use strict';

function compactString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

const MUSIC_VOCAL_DELIVERIES = new Set(['sung', 'chant', 'rap', 'melodic_refrain', 'hybrid']);
const RECOGNIZED_SONG_STATUSES = new Set(['recognized', 'possible', 'multiple_possible', 'unknown', 'none_present']);

function clampMusicVocalTime(value, maxDuration) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  const upperBound = Number.isFinite(maxDuration) && maxDuration >= 0 ? maxDuration : Number.POSITIVE_INFINITY;
  return Math.max(0, Math.min(upperBound, Number(numeric.toFixed(3))));
}

function normalizeMusicVocalSegments(segments, { maxDuration = Number.POSITIVE_INFINITY } = {}) {
  if (!Array.isArray(segments)) return [];

  const normalized = segments.map((segment, fallbackIndex) => {
    if (!segment || typeof segment !== 'object' || Array.isArray(segment)) return null;

    const text = compactString(segment.text);
    if (!text) return null;

    const explicitIndex = Number(segment.index ?? segment.segment_index ?? segment.segmentIndex);
    const chronologyIndex = Number.isFinite(explicitIndex) && explicitIndex >= 0
      ? Math.trunc(explicitIndex)
      : fallbackIndex;

    const start = clampMusicVocalTime(segment.start, maxDuration);
    const end = clampMusicVocalTime(segment.end, maxDuration);
    const hasValidTimedRange = Number.isFinite(start) && Number.isFinite(end) && end > start;

    const performer = compactString(segment.performer || segment.singer || segment.voice) || null;
    const performerIdSource = compactString(segment.performer_id || segment.performerId || segment.singer_id || segment.singerId);
    const performer_id = performerIdSource
      ? performerIdSource.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || null
      : null;
    const confidence = Number(segment.confidence);
    const delivery = compactString(segment.delivery).toLowerCase();

    return {
      index: chronologyIndex,
      ...(hasValidTimedRange ? { start, end } : {}),
      text,
      confidence: Number.isFinite(confidence) ? Math.max(0, Math.min(1, Number(confidence.toFixed(4)))) : null,
      performer,
      performer_id,
      delivery: MUSIC_VOCAL_DELIVERIES.has(delivery) ? delivery : null
    };
  }).filter(Boolean);

  normalized.sort((left, right) => {
    if (left.index !== right.index) return left.index - right.index;
    const leftStart = Number.isFinite(left.start) ? left.start : Number.POSITIVE_INFINITY;
    const rightStart = Number.isFinite(right.start) ? right.start : Number.POSITIVE_INFINITY;
    if (leftStart !== rightStart) return leftStart - rightStart;
    return 0;
  });

  return normalized.map((segment, index) => ({
    ...segment,
    index
  }));
}

function generateMusicVocalsSummary(segments = []) {
  if (!Array.isArray(segments) || segments.length === 0) {
    return 'No text-bearing music-led vocals detected.';
  }

  const deliveries = Array.from(new Set(segments.map((segment) => compactString(segment.delivery)).filter(Boolean)));
  const deliveryLabel = deliveries.length > 0 ? deliveries.join(', ') : 'music-led';
  return `${segments.length} text-bearing ${deliveryLabel} vocal segment(s) detected in the music lane.`;
}

function normalizeRecognitionNotes(values) {
  return Array.from(new Set((Array.isArray(values) ? values : []).map((value) => compactString(value)).filter(Boolean)));
}

function normalizeRecognizedSong(recognizedSong, { maxDuration = Number.POSITIVE_INFINITY } = {}) {
  if (!recognizedSong || typeof recognizedSong !== 'object' || Array.isArray(recognizedSong)) return null;

  const status = compactString(recognizedSong.status).toLowerCase();
  if (!RECOGNIZED_SONG_STATUSES.has(status)) return null;

  const confidence = Number(recognizedSong.confidence);
  const primaryEvidence = compactString(recognizedSong.primaryEvidence) || null;
  const ambiguity = compactString(recognizedSong.ambiguity) || null;
  const multipleSongsDetected = recognizedSong.multipleSongsDetected === true;
  const candidates = Array.isArray(recognizedSong.candidates)
    ? recognizedSong.candidates.slice(0, 3).map((candidate) => {
        if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) return null;
        const title = compactString(candidate.title) || null;
        const artist = compactString(candidate.artist) || null;
        const candidateConfidence = Number(candidate.confidence);
        const evidence = normalizeRecognitionNotes(candidate.evidence);
        if (evidence.length === 0) return null;
        const matchedLyrics = normalizeRecognitionNotes(candidate.matchedLyrics);
        const timeRanges = Array.isArray(candidate.timeRanges)
          ? candidate.timeRanges.map((range) => {
              if (!range || typeof range !== 'object' || Array.isArray(range)) return null;
              const start = clampMusicVocalTime(range.start, maxDuration);
              const end = clampMusicVocalTime(range.end, maxDuration);
              if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return null;
              return { start, end };
            }).filter(Boolean)
          : [];
        const candidateAmbiguity = compactString(candidate.ambiguity) || null;

        return {
          title,
          artist,
          confidence: Number.isFinite(candidateConfidence) ? Math.max(0, Math.min(1, Number(candidateConfidence.toFixed(4)))) : 0,
          evidence,
          ...(matchedLyrics.length > 0 ? { matchedLyrics } : {}),
          ...(timeRanges.length > 0 ? { timeRanges } : {}),
          ...(candidateAmbiguity ? { ambiguity: candidateAmbiguity } : {})
        };
      }).filter(Boolean)
    : [];

  return {
    status,
    confidence: Number.isFinite(confidence) ? Math.max(0, Math.min(1, Number(confidence.toFixed(4)))) : 0,
    candidates,
    ...(primaryEvidence ? { primaryEvidence } : {}),
    ...(ambiguity ? { ambiguity } : {}),
    multipleSongsDetected
  };
}

function buildMusicVocalsData({
  vocalSegments,
  summary,
  duration,
  analysisMode,
  timingMode,
  sourceStrategy,
  provenance,
  qualityNotes,
  recognizedSong,
  recognitionNotes
}) {
  const normalizedSegments = normalizeMusicVocalSegments(vocalSegments, { maxDuration: duration });
  const normalizedSummary = compactString(summary) || generateMusicVocalsSummary(normalizedSegments);
  const normalizedQualityNotes = Array.from(new Set((Array.isArray(qualityNotes) ? qualityNotes : []).map((value) => compactString(value)).filter(Boolean)));
  const normalizedRecognizedSong = normalizeRecognizedSong(recognizedSong, { maxDuration: duration });
  const normalizedRecognitionNotes = normalizeRecognitionNotes(recognitionNotes);

  return {
    vocal_segments: normalizedSegments,
    summary: normalizedSummary,
    hasVocals: normalizedSegments.length > 0,
    totalDuration: duration,
    analysisMode,
    timingMode,
    sourceStrategy,
    coverage: {
      start: 0,
      end: duration,
      duration,
      complete: true
    },
    provenance: { ...(provenance || {}) },
    ...(normalizedRecognizedSong ? { recognizedSong: normalizedRecognizedSong } : {}),
    ...(normalizedRecognitionNotes.length > 0 ? { recognitionNotes: normalizedRecognitionNotes } : {}),
    ...(normalizedQualityNotes.length > 0 ? { qualityNotes: normalizedQualityNotes } : {})
  };
}

module.exports = {
  compactString,
  MUSIC_VOCAL_DELIVERIES,
  clampMusicVocalTime,
  normalizeMusicVocalSegments,
  generateMusicVocalsSummary,
  normalizeRecognizedSong,
  normalizeRecognitionNotes,
  buildMusicVocalsData
};
