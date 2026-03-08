#!/usr/bin/env node
/**
 * Chunk analysis status helpers.
 *
 * Provides consistent detection for failed/placeholder chunk records.
 */

function looksLikeParseFallback(chunk = {}) {
  if (!chunk || typeof chunk !== 'object') return false;
  if (chunk.summary !== 'Analysis completed') return false;

  const emotions = chunk.emotions || {};
  const entries = Object.values(emotions);
  if (entries.length === 0) return false;

  return entries.every((emotion) => {
    const score = emotion?.score;
    const reasoning = typeof emotion?.reasoning === 'string' ? emotion.reasoning.toLowerCase() : '';
    return score === 5 && reasoning.includes('could not parse response');
  });
}

function getChunkFailureReason(chunk = {}) {
  if (!chunk || typeof chunk !== 'object') {
    return 'invalid_chunk_record';
  }

  if (chunk.status === 'failed') {
    return chunk.errorReason || 'chunk_marked_failed';
  }

  if (looksLikeParseFallback(chunk)) {
    return 'parse_error: placeholder fallback detected (unparseable model response)';
  }

  return null;
}

function isChunkFailed(chunk = {}) {
  return getChunkFailureReason(chunk) !== null;
}

function splitChunksByStatus(chunks = []) {
  const successfulChunks = [];
  const failedChunks = [];

  for (const chunk of chunks || []) {
    const reason = getChunkFailureReason(chunk);
    if (reason) {
      failedChunks.push({
        ...chunk,
        status: 'failed',
        errorReason: chunk.errorReason || reason
      });
    } else {
      successfulChunks.push({
        ...chunk,
        status: chunk.status || 'success'
      });
    }
  }

  return {
    successfulChunks,
    failedChunks
  };
}

module.exports = {
  looksLikeParseFallback,
  getChunkFailureReason,
  isChunkFailed,
  splitChunksByStatus
};
