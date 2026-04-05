'use strict';

function compactString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

const MUSIC_VOCAL_DELIVERIES = new Set(['sung', 'chant', 'rap', 'melodic_refrain', 'hybrid']);

function clampMusicVocalTime(value, maxDuration) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  const upperBound = Number.isFinite(maxDuration) && maxDuration >= 0 ? maxDuration : Number.POSITIVE_INFINITY;
  return Math.max(0, Math.min(upperBound, Number(numeric.toFixed(3))));
}

function normalizeMusicVocalSegments(segments, { maxDuration = Number.POSITIVE_INFINITY } = {}) {
  if (!Array.isArray(segments)) return [];

  return segments.map((segment) => {
    if (!segment || typeof segment !== 'object' || Array.isArray(segment)) return null;

    const start = clampMusicVocalTime(segment.start, maxDuration);
    const end = clampMusicVocalTime(segment.end, maxDuration);
    const text = compactString(segment.text);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start || !text) return null;

    const performer = compactString(segment.performer || segment.singer || segment.voice) || null;
    const performerIdSource = compactString(segment.performer_id || segment.performerId || segment.singer_id || segment.singerId);
    const performer_id = performerIdSource
      ? performerIdSource.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || null
      : null;
    const confidence = Number(segment.confidence);
    const delivery = compactString(segment.delivery).toLowerCase();

    return {
      start,
      end,
      text,
      confidence: Number.isFinite(confidence) ? Math.max(0, Math.min(1, Number(confidence.toFixed(4)))) : null,
      performer,
      performer_id,
      delivery: MUSIC_VOCAL_DELIVERIES.has(delivery) ? delivery : null
    };
  }).filter(Boolean).sort((left, right) => left.start - right.start || left.end - right.end);
}

function generateMusicVocalsSummary(segments = []) {
  if (!Array.isArray(segments) || segments.length === 0) {
    return 'No text-bearing music-led vocals detected.';
  }

  const deliveries = Array.from(new Set(segments.map((segment) => compactString(segment.delivery)).filter(Boolean)));
  const deliveryLabel = deliveries.length > 0 ? deliveries.join(', ') : 'music-led';
  return `${segments.length} text-bearing ${deliveryLabel} vocal segment(s) detected in the music lane.`;
}

function buildMusicVocalsData({
  vocalSegments,
  summary,
  duration,
  analysisMode,
  timingMode,
  sourceStrategy,
  provenance,
  qualityNotes
}) {
  const normalizedSegments = normalizeMusicVocalSegments(vocalSegments, { maxDuration: duration });
  const normalizedSummary = compactString(summary) || generateMusicVocalsSummary(normalizedSegments);
  const normalizedQualityNotes = Array.from(new Set((Array.isArray(qualityNotes) ? qualityNotes : []).map((value) => compactString(value)).filter(Boolean)));

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
    ...(normalizedQualityNotes.length > 0 ? { qualityNotes: normalizedQualityNotes } : {})
  };
}

module.exports = {
  compactString,
  MUSIC_VOCAL_DELIVERIES,
  clampMusicVocalTime,
  normalizeMusicVocalSegments,
  generateMusicVocalsSummary,
  buildMusicVocalsData
};
