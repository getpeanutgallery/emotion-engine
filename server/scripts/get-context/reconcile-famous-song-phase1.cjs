#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const {
  getRawArtifactPath,
  getReconciledArtifactPath,
  resolvePhase1ArtifactPath
} = require('../../lib/phase1-baseline-resolution.cjs');

const SCRIPT_ID = 'reconcile-famous-song-phase1';
const PHASE_DIR = 'phase1-gather-context';
const RECOGNITION_CONFIDENCE_GATE = 0.92;
const MIN_DIALOGUE_OVERLAP_SECONDS = 0.75;
const MIN_DIALOGUE_OVERLAP_RATIO = 0.5;
const MIN_CORRECTION_SIMILARITY = 0.66;
const MIN_NEAR_MISS_CORRECTION_SIMILARITY = 0.57;
const MIN_DIALOGUE_LYRIC_SIMILARITY = 0.72;
const MIN_CORRECTION_CONFIDENCE = 0.85;
const MIN_NEAR_MISS_SHARED_TOKENS = 2;
const MIN_NEAR_MISS_SHARED_TARGET_RATIO = 0.6;
const MIN_TARGET_TO_SOURCE_TOKEN_RATIO = 0.75;

function cloneJson(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function compactString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function readJsonIfExists(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function normalizeText(value) {
  return compactString(value)
    .normalize('NFKC')
    .replace(/[’‘]/g, "'")
    .replace(/[“”]/g, '"')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenize(value) {
  const normalized = normalizeText(value);
  return normalized ? normalized.split(' ').filter(Boolean) : [];
}

function uniqueTokens(value) {
  return Array.from(new Set(tokenize(value)));
}

function charBigrams(value) {
  const normalized = normalizeText(value).replace(/\s+/g, ' ');
  if (!normalized) return [];
  if (normalized.length < 2) return [normalized];
  const grams = [];
  for (let index = 0; index < normalized.length - 1; index += 1) {
    grams.push(normalized.slice(index, index + 2));
  }
  return grams;
}

function diceCoefficient(left, right) {
  const leftGrams = charBigrams(left);
  const rightGrams = charBigrams(right);
  if (leftGrams.length === 0 || rightGrams.length === 0) return 0;

  const rightCounts = new Map();
  for (const gram of rightGrams) {
    rightCounts.set(gram, (rightCounts.get(gram) || 0) + 1);
  }

  let shared = 0;
  for (const gram of leftGrams) {
    const count = rightCounts.get(gram) || 0;
    if (count > 0) {
      shared += 1;
      rightCounts.set(gram, count - 1);
    }
  }

  return (2 * shared) / (leftGrams.length + rightGrams.length);
}

function lexicalSimilarity(left, right) {
  const leftTokens = uniqueTokens(left);
  const rightTokens = uniqueTokens(right);
  if (leftTokens.length === 0 || rightTokens.length === 0) return 0;

  const rightSet = new Set(rightTokens);
  const shared = leftTokens.filter((token) => rightSet.has(token)).length;
  const overlap = (2 * shared) / (leftTokens.length + rightTokens.length);
  return Math.max(overlap, diceCoefficient(left, right));
}

function parseFiniteNumber(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function segmentDuration(segment) {
  const start = parseFiniteNumber(segment?.start);
  const end = parseFiniteNumber(segment?.end);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return 0;
  return end - start;
}

function computeOverlap(segmentA, segmentB) {
  const startA = parseFiniteNumber(segmentA?.start);
  const endA = parseFiniteNumber(segmentA?.end);
  const startB = parseFiniteNumber(segmentB?.start);
  const endB = parseFiniteNumber(segmentB?.end);

  if (![startA, endA, startB, endB].every(Number.isFinite)) {
    return { seconds: 0, ratio: 0 };
  }

  const seconds = Math.max(0, Math.min(endA, endB) - Math.max(startA, startB));
  const duration = Math.max(0.001, endA - startA);
  return {
    seconds,
    ratio: seconds / duration
  };
}

function overlapsStrongly(segment, candidates = []) {
  return candidates.some((candidateRange) => {
    const overlap = computeOverlap(segment, candidateRange);
    return overlap.seconds >= MIN_DIALOGUE_OVERLAP_SECONDS || overlap.ratio >= MIN_DIALOGUE_OVERLAP_RATIO;
  });
}

function chooseBestLyricMatch(text, lyricFragments = []) {
  const source = compactString(text);
  if (!source) return null;

  let best = null;
  for (const lyric of lyricFragments) {
    const similarity = lexicalSimilarity(source, lyric);
    if (!best || similarity > best.similarity) {
      best = {
        lyric,
        similarity
      };
    }
  }
  return best;
}

function isShortOrRefrainLike(segment) {
  const text = compactString(segment?.text);
  const words = tokenize(text);
  const uniqueWordCount = new Set(words).size;
  const duration = segmentDuration(segment);
  return words.length <= 6 || duration <= 4.5 || (words.length > 0 && uniqueWordCount / words.length < 0.7);
}

function hasStrongSpokenSignal(dialogueSegments, index) {
  const segment = dialogueSegments[index] || {};
  const speaker = compactString(segment.speaker || segment.speaker_id);
  const neighbors = [dialogueSegments[index - 1], dialogueSegments[index + 1]].filter(Boolean);

  return neighbors.some((neighbor) => {
    const neighborSpeaker = compactString(neighbor.speaker || neighbor.speaker_id);
    if (!speaker || !neighborSpeaker || speaker !== neighborSpeaker) return false;

    const gap = Math.min(
      Math.abs((parseFiniteNumber(segment.start) || 0) - (parseFiniteNumber(neighbor.end) || 0)),
      Math.abs((parseFiniteNumber(neighbor.start) || 0) - (parseFiniteNumber(segment.end) || 0))
    );

    return gap <= 1.25 && tokenize(neighbor.text).length >= 4 && !isShortOrRefrainLike(neighbor);
  });
}

function longestContiguousTokenRun(leftTokens, rightTokens) {
  if (!leftTokens.length || !rightTokens.length) return 0;

  let longest = 0;
  for (let leftIndex = 0; leftIndex < leftTokens.length; leftIndex += 1) {
    for (let rightIndex = 0; rightIndex < rightTokens.length; rightIndex += 1) {
      let run = 0;
      while (
        leftIndex + run < leftTokens.length &&
        rightIndex + run < rightTokens.length &&
        leftTokens[leftIndex + run] === rightTokens[rightIndex + run]
      ) {
        run += 1;
      }
      if (run > longest) longest = run;
    }
  }

  return longest;
}

function countSharedTokens(leftTokens, rightTokens) {
  const leftSet = new Set(leftTokens);
  const rightSet = new Set(rightTokens);
  let shared = 0;
  for (const token of leftSet) {
    if (rightSet.has(token)) shared += 1;
  }
  return shared;
}

function isContiguousTokenFragment(sourceTokens, targetTokens) {
  if (!sourceTokens.length || !targetTokens.length || targetTokens.length >= sourceTokens.length) {
    return false;
  }

  for (let start = 0; start <= sourceTokens.length - targetTokens.length; start += 1) {
    let matches = true;
    for (let offset = 0; offset < targetTokens.length; offset += 1) {
      if (sourceTokens[start + offset] !== targetTokens[offset]) {
        matches = false;
        break;
      }
    }
    if (matches) {
      return {
        start,
        end: start + targetTokens.length - 1,
        extraLeading: start,
        extraTrailing: sourceTokens.length - (start + targetTokens.length)
      };
    }
  }

  return false;
}

function hasStrongPhraseAnchor(sourceText, targetText) {
  const sourceTokens = tokenize(sourceText);
  const targetTokens = tokenize(targetText);
  if (!sourceTokens.length || !targetTokens.length) return false;

  const contiguousRun = longestContiguousTokenRun(sourceTokens, targetTokens);
  if (contiguousRun >= 2) return true;

  const sharedTokens = countSharedTokens(sourceTokens, targetTokens);
  return sharedTokens >= MIN_NEAR_MISS_SHARED_TOKENS && (sharedTokens / targetTokens.length) >= MIN_NEAR_MISS_SHARED_TARGET_RATIO;
}

function withinNearMissTokenDelta(sourceText, targetText) {
  const sourceCount = tokenize(sourceText).length;
  const targetCount = tokenize(targetText).length;
  if (!sourceCount || !targetCount) return false;

  const absoluteDelta = Math.abs(sourceCount - targetCount);
  const shortPhrase = Math.max(sourceCount, targetCount) <= 4;
  return shortPhrase ? absoluteDelta <= 1 : absoluteDelta <= 2;
}

function assessTruncationRisk(sourceText, targetText) {
  const sourceTokens = tokenize(sourceText);
  const targetTokens = tokenize(targetText);
  if (!sourceTokens.length || !targetTokens.length) {
    return { blocked: true, reason: 'invalid_tokenization' };
  }

  const targetToSourceRatio = targetTokens.length / sourceTokens.length;
  if (targetToSourceRatio < MIN_TARGET_TO_SOURCE_TOKEN_RATIO) {
    return {
      blocked: true,
      reason: 'target_too_short_relative_to_source',
      details: {
        sourceTokenCount: sourceTokens.length,
        targetTokenCount: targetTokens.length,
        targetToSourceRatio: Number(targetToSourceRatio.toFixed(4))
      }
    };
  }

  const tokenDelta = sourceTokens.length - targetTokens.length;
  if (sourceTokens.length >= 5 && tokenDelta > 2) {
    return {
      blocked: true,
      reason: 'target_truncates_longer_source_phrase',
      details: {
        sourceTokenCount: sourceTokens.length,
        targetTokenCount: targetTokens.length,
        tokenDelta
      }
    };
  }

  const fragment = isContiguousTokenFragment(sourceTokens, targetTokens);
  if (fragment) {
    const onlySingleEdgeFiller =
      (fragment.extraLeading === 1 && fragment.extraTrailing === 0) ||
      (fragment.extraLeading === 0 && fragment.extraTrailing === 1);

    if (!onlySingleEdgeFiller) {
      return {
        blocked: true,
        reason: 'target_is_strict_fragment_of_source',
        details: {
          sourceTokenCount: sourceTokens.length,
          targetTokenCount: targetTokens.length,
          extraLeading: fragment.extraLeading,
          extraTrailing: fragment.extraTrailing
        }
      };
    }
  }

  return {
    blocked: false,
    reason: null,
    details: {
      sourceTokenCount: sourceTokens.length,
      targetTokenCount: targetTokens.length,
      targetToSourceRatio: Number(targetToSourceRatio.toFixed(4))
    }
  };
}

function classifyLyricCorrection(sourceText, targetText, similarity) {
  const truncationRisk = assessTruncationRisk(sourceText, targetText);
  if (truncationRisk.blocked) {
    return {
      allowed: false,
      lane: null,
      reason: truncationRisk.reason,
      details: truncationRisk.details
    };
  }

  if (similarity >= MIN_CORRECTION_SIMILARITY) {
    return {
      allowed: true,
      lane: 'generic',
      reason: 'recognized_song_near_miss',
      details: truncationRisk.details
    };
  }

  if (similarity < MIN_NEAR_MISS_CORRECTION_SIMILARITY) {
    return {
      allowed: false,
      lane: null,
      reason: 'lyric_similarity_below_threshold',
      details: truncationRisk.details
    };
  }

  if (!hasStrongPhraseAnchor(sourceText, targetText)) {
    return {
      allowed: false,
      lane: null,
      reason: 'near_miss_anchor_too_weak',
      details: truncationRisk.details
    };
  }

  if (!withinNearMissTokenDelta(sourceText, targetText)) {
    return {
      allowed: false,
      lane: null,
      reason: 'near_miss_token_delta_too_large',
      details: truncationRisk.details
    };
  }

  return {
    allowed: true,
    lane: 'anchored_near_miss',
    reason: 'recognized_song_anchored_near_miss',
    details: truncationRisk.details
  };
}

function buildRecognitionGate(musicVocalsData, musicData) {
  const recognizedSong = musicVocalsData?.recognizedSong;
  const candidates = Array.isArray(recognizedSong?.candidates) ? recognizedSong.candidates : [];
  const primaryCandidate = candidates.length === 1 ? candidates[0] : null;
  const matchedLyrics = Array.isArray(primaryCandidate?.matchedLyrics)
    ? primaryCandidate.matchedLyrics.map((entry) => compactString(entry)).filter(Boolean)
    : [];
  const timeRanges = Array.isArray(primaryCandidate?.timeRanges)
    ? primaryCandidate.timeRanges.filter((range) => Number.isFinite(parseFiniteNumber(range?.start)) && Number.isFinite(parseFiniteNumber(range?.end)))
    : [];
  const vocalSegments = Array.isArray(musicVocalsData?.vocal_segments) ? musicVocalsData.vocal_segments : [];
  const supportingMusicRecognizedSong = musicData?.recognizedSong || null;

  const gateChecks = {
    statusRecognized: recognizedSong?.status === 'recognized',
    confidenceStrong: Number(recognizedSong?.confidence) >= RECOGNITION_CONFIDENCE_GATE,
    singlePrimaryCandidate: candidates.length === 1,
    multipleSongsAbsent: recognizedSong?.multipleSongsDetected !== true,
    sufficientMatchedLyrics: matchedLyrics.length >= 2,
    hasTimeRanges: timeRanges.length >= 1,
    overlapsVocalSegments: timeRanges.some((range) => overlapsStrongly(range, vocalSegments))
  };

  const reasons = Object.entries(gateChecks)
    .filter(([, passed]) => !passed)
    .map(([key]) => key);

  return {
    passed: reasons.length === 0,
    reasons,
    recognizedSong: recognizedSong || null,
    primaryCandidate,
    matchedLyrics,
    timeRanges,
    supportingMusicRecognizedSong
  };
}

function reconcileDialogue(dialogueData, gate, musicVocalsData) {
  const dialogueSegments = Array.isArray(dialogueData?.dialogue_segments) ? dialogueData.dialogue_segments : [];
  const vocalSegments = Array.isArray(musicVocalsData?.vocal_segments) ? musicVocalsData.vocal_segments : [];
  const overlapTargets = [...gate.timeRanges, ...vocalSegments];
  const removedSegments = [];

  const reconciledSegments = dialogueSegments.filter((segment, index) => {
    if (!overlapsStrongly(segment, overlapTargets)) return true;

    const bestMatch = chooseBestLyricMatch(segment?.text, gate.matchedLyrics);
    if (!bestMatch || bestMatch.similarity < MIN_DIALOGUE_LYRIC_SIMILARITY) return true;

    const confidence = Number(segment?.confidence);
    const lowConfidence = !Number.isFinite(confidence) || confidence <= 0.96;
    if (!lowConfidence && !isShortOrRefrainLike(segment)) return true;
    if (hasStrongSpokenSignal(dialogueSegments, index)) return true;

    removedSegments.push({
      index,
      start: segment?.start ?? null,
      end: segment?.end ?? null,
      text: compactString(segment?.text),
      confidence: Number.isFinite(confidence) ? confidence : null,
      matchedLyric: bestMatch.lyric,
      similarity: Number(bestMatch.similarity.toFixed(4)),
      reason: 'likely_lyric_contamination'
    });
    return false;
  });

  return {
    reconciledData: {
      ...cloneJson(dialogueData),
      dialogue_segments: reconciledSegments,
      summary: compactString(dialogueData?.summary) || (reconciledSegments.length > 0 ? 'Dialogue segments detected.' : 'No dialogue detected.')
    },
    removedSegments
  };
}

function reconcileMusicVocals(musicVocalsData, gate) {
  const vocalSegments = Array.isArray(musicVocalsData?.vocal_segments) ? cloneJson(musicVocalsData.vocal_segments) : [];
  const corrections = [];
  const skippedCorrections = [];

  for (let index = 0; index < vocalSegments.length; index += 1) {
    const segment = vocalSegments[index];
    if (!overlapsStrongly(segment, gate.timeRanges)) {
      skippedCorrections.push({ index, reason: 'outside_recognized_song_range' });
      continue;
    }

    const confidence = Number(segment?.confidence);
    if (!Number.isFinite(confidence) || confidence < MIN_CORRECTION_CONFIDENCE) {
      skippedCorrections.push({ index, reason: 'segment_confidence_below_threshold' });
      continue;
    }

    const bestMatch = chooseBestLyricMatch(segment?.text, gate.matchedLyrics);
    if (!bestMatch) {
      skippedCorrections.push({ index, reason: 'no_matching_lyric_fragment' });
      continue;
    }

    const normalizedCurrent = normalizeText(segment.text);
    const normalizedTarget = normalizeText(bestMatch.lyric);
    if (!normalizedTarget || normalizedCurrent === normalizedTarget) {
      continue;
    }

    const decision = classifyLyricCorrection(segment.text, bestMatch.lyric, bestMatch.similarity);
    if (!decision.allowed) {
      skippedCorrections.push({
        index,
        reason: decision.reason,
        similarity: Number(bestMatch.similarity.toFixed(4)),
        candidateLyric: bestMatch.lyric,
        lane: decision.lane,
        ...decision.details
      });
      continue;
    }

    corrections.push({
      index,
      start: segment?.start ?? null,
      end: segment?.end ?? null,
      from: segment.text,
      to: bestMatch.lyric,
      similarity: Number(bestMatch.similarity.toFixed(4)),
      lane: decision.lane,
      reason: decision.reason
    });

    segment.text = bestMatch.lyric;
  }

  return {
    reconciledData: {
      ...cloneJson(musicVocalsData),
      vocal_segments: vocalSegments
    },
    corrections,
    skippedCorrections
  };
}

function buildLedger({ outputDir, gate, dialogueResult, musicVocalsResult }) {
  const dialogueRawPath = getRawArtifactPath(outputDir, 'dialogueData');
  const musicRawPath = getRawArtifactPath(outputDir, 'musicData');
  const musicVocalsRawPath = getRawArtifactPath(outputDir, 'musicVocalsData');
  const dialogueReconciledPath = getReconciledArtifactPath(outputDir, 'dialogueData');
  const musicVocalsReconciledPath = getReconciledArtifactPath(outputDir, 'musicVocalsData');
  const ledgerPath = getReconciledArtifactPath(outputDir, 'famousSongReconciliation');

  return {
    contractVersion: 'ee.famous-song-reconciliation/v1',
    script: SCRIPT_ID,
    generatedAt: new Date().toISOString(),
    status: gate.passed ? 'applied' : 'skipped',
    sourceArtifacts: {
      dialogueData: path.relative(process.cwd(), dialogueRawPath).split(path.sep).join('/'),
      musicData: path.relative(process.cwd(), musicRawPath).split(path.sep).join('/'),
      musicVocalsData: path.relative(process.cwd(), musicVocalsRawPath).split(path.sep).join('/')
    },
    reconciledArtifacts: {
      dialogueData: path.relative(process.cwd(), dialogueReconciledPath).split(path.sep).join('/'),
      musicVocalsData: path.relative(process.cwd(), musicVocalsReconciledPath).split(path.sep).join('/'),
      ledger: path.relative(process.cwd(), ledgerPath).split(path.sep).join('/')
    },
    trigger: {
      passed: gate.passed,
      reasons: gate.reasons,
      recognizedSong: gate.recognizedSong,
      primaryCandidate: gate.primaryCandidate,
      supportingMusicRecognizedSong: gate.supportingMusicRecognizedSong
    },
    decisions: {
      removedDialogueSegments: dialogueResult.removedSegments,
      lyricCorrections: musicVocalsResult.corrections,
      skippedCorrections: musicVocalsResult.skippedCorrections
    }
  };
}

async function run(input) {
  const { outputDir, artifacts = {} } = input || {};
  if (!outputDir) {
    throw new Error('reconcile-famous-song-phase1 requires outputDir');
  }

  const phaseDir = path.join(outputDir, PHASE_DIR);
  ensureDir(phaseDir);

  const dialogueData = cloneJson(artifacts.dialogueData) || readJsonIfExists(resolvePhase1ArtifactPath(outputDir, 'dialogueData').rawPath);
  const musicData = cloneJson(artifacts.musicData) || readJsonIfExists(resolvePhase1ArtifactPath(outputDir, 'musicData').rawPath);
  const musicVocalsData = cloneJson(artifacts.musicVocalsData) || readJsonIfExists(resolvePhase1ArtifactPath(outputDir, 'musicVocalsData').rawPath);

  if (!dialogueData || !musicData || !musicVocalsData) {
    throw new Error('reconcile-famous-song-phase1 requires dialogueData, musicData, and musicVocalsData artifacts.');
  }

  const gate = buildRecognitionGate(musicVocalsData, musicData);
  const dialogueResult = gate.passed
    ? reconcileDialogue(dialogueData, gate, musicVocalsData)
    : { reconciledData: cloneJson(dialogueData), removedSegments: [] };
  const musicVocalsResult = gate.passed
    ? reconcileMusicVocals(musicVocalsData, gate)
    : { reconciledData: cloneJson(musicVocalsData), corrections: [], skippedCorrections: gate.reasons.map((reason) => ({ reason })) };

  const ledger = buildLedger({
    outputDir,
    gate,
    dialogueResult,
    musicVocalsResult
  });

  const dialogueReconciledPath = getReconciledArtifactPath(outputDir, 'dialogueData');
  const musicVocalsReconciledPath = getReconciledArtifactPath(outputDir, 'musicVocalsData');
  const ledgerPath = getReconciledArtifactPath(outputDir, 'famousSongReconciliation');

  fs.writeFileSync(dialogueReconciledPath, JSON.stringify(dialogueResult.reconciledData, null, 2), 'utf8');
  fs.writeFileSync(musicVocalsReconciledPath, JSON.stringify(musicVocalsResult.reconciledData, null, 2), 'utf8');
  fs.writeFileSync(ledgerPath, JSON.stringify(ledger, null, 2), 'utf8');

  return {
    primaryArtifactKey: 'famousSongReconciliation',
    artifacts: {
      dialogueData: dialogueResult.reconciledData,
      musicData,
      musicVocalsData: musicVocalsResult.reconciledData,
      famousSongReconciliation: ledger
    }
  };
}

module.exports = {
  run,
  _private: {
    normalizeText,
    tokenize,
    lexicalSimilarity,
    buildRecognitionGate,
    reconcileDialogue,
    reconcileMusicVocals,
    chooseBestLyricMatch,
    overlapsStrongly,
    hasStrongPhraseAnchor,
    withinNearMissTokenDelta,
    assessTruncationRisk,
    classifyLyricCorrection
  }
};

if (require.main === module) {
  console.log('reconcile-famous-song-phase1.cjs is intended to run via the pipeline.');
}
