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
const MIN_CORRECTION_SIMILARITY = 0.66;
const MIN_NEAR_MISS_CORRECTION_SIMILARITY = 0.57;
const MIN_DIALOGUE_LYRIC_SIMILARITY = 0.72;
const MIN_CORRECTION_CONFIDENCE = 0.85;
const MIN_NEAR_MISS_SHARED_TOKENS = 2;
const MIN_NEAR_MISS_SHARED_TARGET_RATIO = 0.6;
const MIN_TARGET_TO_SOURCE_TOKEN_RATIO = 0.75;
const MIN_GATE_LYRIC_TEXT_SIMILARITY = 0.66;
const MIN_DIALOGUE_INDEX_PROXIMITY = 2;

function cloneJson(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function compactString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function stripLaneTiming(data, laneKey) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return data;
  const segments = Array.isArray(data?.[laneKey]) ? data[laneKey] : [];

  return {
    ...data,
    [laneKey]: segments.map((segment) => {
      if (!segment || typeof segment !== 'object' || Array.isArray(segment)) return segment;
      const { start, end, ...rest } = segment;
      return rest;
    })
  };
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

function sameSongCandidate(left, right) {
  if (!left || !right) return false;
  const leftTitle = normalizeText(left.title);
  const rightTitle = normalizeText(right.title);
  if (!leftTitle || !rightTitle || leftTitle !== rightTitle) return false;

  const leftArtist = normalizeText(left.artist);
  const rightArtist = normalizeText(right.artist);
  if (leftArtist && rightArtist) return leftArtist === rightArtist;

  return true;
}

function getSegmentOrderIndex(segment, fallbackIndex = 0) {
  const explicitIndex = parseFiniteNumber(segment?.index);
  if (Number.isFinite(explicitIndex)) return explicitIndex;
  return fallbackIndex;
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
  return words.length <= 6 || (words.length > 0 && uniqueWordCount / words.length < 0.7);
}

function hasStrongSpokenSignal(dialogueSegments, index) {
  const segment = dialogueSegments[index] || {};
  const speaker = compactString(segment.speaker || segment.speaker_id);
  const segmentOrderIndex = getSegmentOrderIndex(segment, index);
  const neighbors = [
    { segment: dialogueSegments[index - 1], fallbackIndex: index - 1 },
    { segment: dialogueSegments[index + 1], fallbackIndex: index + 1 }
  ].filter(({ segment: neighbor }) => Boolean(neighbor));

  return neighbors.some(({ segment: neighbor, fallbackIndex }) => {
    const neighborSpeaker = compactString(neighbor.speaker || neighbor.speaker_id);
    if (!speaker || !neighborSpeaker || speaker !== neighborSpeaker) return false;

    const neighborOrderIndex = getSegmentOrderIndex(neighbor, fallbackIndex);
    const proximity = Math.abs(segmentOrderIndex - neighborOrderIndex);

    return proximity <= 1 && tokenize(neighbor.text).length >= 4 && !isShortOrRefrainLike(neighbor);
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

function buildLyricEvidence(segments = [], matchedLyrics = [], minSimilarity = MIN_GATE_LYRIC_TEXT_SIMILARITY) {
  const hits = [];
  for (let segmentOffset = 0; segmentOffset < segments.length; segmentOffset += 1) {
    const segment = segments[segmentOffset];
    const sourceText = compactString(segment?.text);
    if (!sourceText) continue;

    let bestLyricIndex = -1;
    let bestSimilarity = 0;
    let bestLyric = '';

    for (let lyricIndex = 0; lyricIndex < matchedLyrics.length; lyricIndex += 1) {
      const lyric = matchedLyrics[lyricIndex];
      const similarity = lexicalSimilarity(sourceText, lyric);
      if (similarity > bestSimilarity) {
        bestSimilarity = similarity;
        bestLyricIndex = lyricIndex;
        bestLyric = lyric;
      }
    }

    if (bestLyricIndex < 0 || bestSimilarity < minSimilarity) continue;

    hits.push({
      segmentOffset,
      segmentOrderIndex: getSegmentOrderIndex(segment, segmentOffset),
      lyricIndex: bestLyricIndex,
      lyric: bestLyric,
      similarity: Number(bestSimilarity.toFixed(4))
    });
  }

  const firstOccurrenceHits = [];
  const seenLyricIndexes = new Set();
  for (const hit of hits) {
    if (seenLyricIndexes.has(hit.lyricIndex)) continue;
    seenLyricIndexes.add(hit.lyricIndex);
    firstOccurrenceHits.push(hit);
  }

  const firstOccurrenceIndexes = firstOccurrenceHits.map((hit) => hit.lyricIndex);

  const longestNonDecreasingSubsequenceLength = (() => {
    if (firstOccurrenceIndexes.length === 0) return 0;
    const dp = new Array(firstOccurrenceIndexes.length).fill(1);
    let best = 1;
    for (let i = 1; i < firstOccurrenceIndexes.length; i += 1) {
      for (let j = 0; j < i; j += 1) {
        if (firstOccurrenceIndexes[i] >= firstOccurrenceIndexes[j]) {
          dp[i] = Math.max(dp[i], dp[j] + 1);
        }
      }
      best = Math.max(best, dp[i]);
    }
    return best;
  })();

  const minimumStrongSubsequenceLength = Math.max(2, firstOccurrenceIndexes.length - 1);
  const hasStrongSubsequenceOrder =
    firstOccurrenceIndexes.length < 2 ||
    longestNonDecreasingSubsequenceLength >= minimumStrongSubsequenceLength;

  return {
    hits,
    firstOccurrenceHits,
    hasLyricTextEvidence: hits.length >= 1,
    hasIndexOrderEvidence: hasStrongSubsequenceOrder,
    hitOrderIndexes: hits.map((hit) => hit.segmentOrderIndex)
  };
}

function buildRecognitionGate(musicVocalsData, musicData, dialogueData) {
  const recognizedSong = musicVocalsData?.recognizedSong;
  const candidates = Array.isArray(recognizedSong?.candidates) ? recognizedSong.candidates : [];
  const primaryCandidate = candidates.length === 1 ? candidates[0] : null;
  const matchedLyrics = Array.isArray(primaryCandidate?.matchedLyrics)
    ? primaryCandidate.matchedLyrics.map((entry) => compactString(entry)).filter(Boolean)
    : [];
  const vocalSegments = Array.isArray(musicVocalsData?.vocal_segments) ? musicVocalsData.vocal_segments : [];
  const dialogueSegments = Array.isArray(dialogueData?.dialogue_segments) ? dialogueData.dialogue_segments : [];
  const supportingMusicRecognizedSong = musicData?.recognizedSong || null;

  const vocalLyricEvidence = buildLyricEvidence(vocalSegments, matchedLyrics, MIN_GATE_LYRIC_TEXT_SIMILARITY);
  const dialogueLyricEvidence = buildLyricEvidence(dialogueSegments, matchedLyrics, MIN_DIALOGUE_LYRIC_SIMILARITY);

  const hasSupportingMusicConsensus = (() => {
    if (!supportingMusicRecognizedSong) return true;

    const supportConfidence = Number(supportingMusicRecognizedSong.confidence);
    const supportConfidenceStrongEnough = Number.isFinite(supportConfidence) ? supportConfidence >= 0.7 : true;
    if (!supportConfidenceStrongEnough) return false;

    if (supportingMusicRecognizedSong.status === 'recognized') return true;

    if (supportingMusicRecognizedSong.status !== 'possible') return false;

    const supportCandidates = Array.isArray(supportingMusicRecognizedSong.candidates)
      ? supportingMusicRecognizedSong.candidates
      : [];
    return supportCandidates.some((candidate) => sameSongCandidate(candidate, primaryCandidate));
  })();

  const hasStrongDialogueVocalsEvidence =
    vocalLyricEvidence.hasLyricTextEvidence &&
    vocalLyricEvidence.hasIndexOrderEvidence &&
    dialogueLyricEvidence.hasLyricTextEvidence &&
    dialogueLyricEvidence.hasIndexOrderEvidence;

  const requiresSupportingMusicConsensus = !hasStrongDialogueVocalsEvidence;

  const gateChecks = {
    statusRecognized: recognizedSong?.status === 'recognized',
    confidenceStrong: Number(recognizedSong?.confidence) >= RECOGNITION_CONFIDENCE_GATE,
    singlePrimaryCandidate: candidates.length === 1,
    multipleSongsAbsent: recognizedSong?.multipleSongsDetected !== true,
    sufficientMatchedLyrics: matchedLyrics.length >= 2,
    hasSupportingMusicConsensus: !requiresSupportingMusicConsensus || hasSupportingMusicConsensus
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
    supportingMusicRecognizedSong,
    evidence: {
      vocalLyricEvidence,
      dialogueLyricEvidence,
      hasStrongDialogueVocalsEvidence,
      requiresSupportingMusicConsensus,
      hasSupportingMusicConsensus
    }
  };
}

function reconcileDialogue(dialogueData, gate, musicVocalsData) {
  const dialogueSegments = Array.isArray(dialogueData?.dialogue_segments) ? dialogueData.dialogue_segments : [];
  const vocalSegments = Array.isArray(musicVocalsData?.vocal_segments) ? musicVocalsData.vocal_segments : [];
  const vocalEvidenceIndexes = new Set(gate?.evidence?.vocalLyricEvidence?.hitOrderIndexes || []);
  const removedSegments = [];

  const reconciledSegments = dialogueSegments.filter((segment, index) => {
    const bestMatch = chooseBestLyricMatch(segment?.text, gate.matchedLyrics);
    if (!bestMatch || bestMatch.similarity < MIN_DIALOGUE_LYRIC_SIMILARITY) return true;

    const confidence = Number(segment?.confidence);
    const lowConfidence = !Number.isFinite(confidence) || confidence <= 0.96;
    if (!lowConfidence && !isShortOrRefrainLike(segment)) return true;
    if (hasStrongSpokenSignal(dialogueSegments, index)) return true;

    const dialogueOrderIndex = getSegmentOrderIndex(segment, index);
    const hasNearbyVocalIndexEvidence = Array.from(vocalEvidenceIndexes).some(
      (orderIndex) => Math.abs(orderIndex - dialogueOrderIndex) <= MIN_DIALOGUE_INDEX_PROXIMITY
    );

    const bestVocalMatch = chooseBestLyricMatch(
      segment?.text,
      vocalSegments.map((entry) => compactString(entry?.text)).filter(Boolean)
    );
    const hasDirectVocalTextSupport = bestVocalMatch && bestVocalMatch.similarity >= MIN_GATE_LYRIC_TEXT_SIMILARITY;

    if (!hasNearbyVocalIndexEvidence && !hasDirectVocalTextSupport && vocalEvidenceIndexes.size > 0) {
      return true;
    }

    removedSegments.push({
      index,
      indexOrder: dialogueOrderIndex,
      text: compactString(segment?.text),
      confidence: Number.isFinite(confidence) ? confidence : null,
      matchedLyric: bestMatch.lyric,
      similarity: Number(bestMatch.similarity.toFixed(4)),
      evidence: {
        nearbyVocalIndexEvidence: hasNearbyVocalIndexEvidence,
        directVocalTextSupport: Boolean(hasDirectVocalTextSupport)
      },
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

  const gate = buildRecognitionGate(musicVocalsData, musicData, dialogueData);
  const dialogueResult = gate.passed
    ? reconcileDialogue(dialogueData, gate, musicVocalsData)
    : { reconciledData: cloneJson(dialogueData), removedSegments: [] };
  const musicVocalsResult = gate.passed
    ? reconcileMusicVocals(musicVocalsData, gate)
    : { reconciledData: cloneJson(musicVocalsData), corrections: [], skippedCorrections: gate.reasons.map((reason) => ({ reason })) };

  const strippedDialogueData = stripLaneTiming(dialogueResult.reconciledData, 'dialogue_segments');
  const strippedMusicVocalsData = stripLaneTiming(musicVocalsResult.reconciledData, 'vocal_segments');

  const ledger = buildLedger({
    outputDir,
    gate,
    dialogueResult: {
      ...dialogueResult,
      reconciledData: strippedDialogueData
    },
    musicVocalsResult: {
      ...musicVocalsResult,
      reconciledData: strippedMusicVocalsData
    }
  });

  const dialogueReconciledPath = getReconciledArtifactPath(outputDir, 'dialogueData');
  const musicVocalsReconciledPath = getReconciledArtifactPath(outputDir, 'musicVocalsData');
  const ledgerPath = getReconciledArtifactPath(outputDir, 'famousSongReconciliation');

  fs.writeFileSync(dialogueReconciledPath, JSON.stringify(strippedDialogueData, null, 2), 'utf8');
  fs.writeFileSync(musicVocalsReconciledPath, JSON.stringify(strippedMusicVocalsData, null, 2), 'utf8');
  fs.writeFileSync(ledgerPath, JSON.stringify(ledger, null, 2), 'utf8');

  return {
    primaryArtifactKey: 'famousSongReconciliation',
    artifacts: {
      dialogueData: cloneJson(dialogueData),
      musicData: cloneJson(musicData),
      musicVocalsData: cloneJson(musicVocalsData),
      dialogueDataReconciled: strippedDialogueData,
      musicVocalsDataReconciled: strippedMusicVocalsData,
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
    buildLyricEvidence,
    getSegmentOrderIndex,
    hasStrongPhraseAnchor,
    withinNearMissTokenDelta,
    assessTruncationRisk,
    classifyLyricCorrection,
    sameSongCandidate
  }
};

if (require.main === module) {
  console.log('reconcile-famous-song-phase1.cjs is intended to run via the pipeline.');
}
