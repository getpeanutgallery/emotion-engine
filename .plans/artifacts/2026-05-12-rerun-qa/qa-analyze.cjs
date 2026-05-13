const fs = require('fs');
const path = require('path');
const { __test } = require('../../../server/scripts/process/video-chunks.cjs');

const repoRoot = path.resolve(__dirname, '../..', '..');
const outputDir = path.join(repoRoot, 'output/cod-test-phase2-only-retest-2026-05-06-with-timestamps');
const phase1Dir = path.join(outputDir, 'phase1-gather-context');
const phase2Dir = path.join(outputDir, 'phase2-process');
const artifactDir = __dirname;

const TRUSTED = new Set([3,4,8,9,10,11,12,13,14,15,17,22,23,24,25,26,27]);
const EXCLUDED = new Set([0,1,2,5,6,7,16,18,19,20,21]);

function readJson(p) { return JSON.parse(fs.readFileSync(p, 'utf8')); }
function writeJson(name, value) { fs.writeFileSync(path.join(artifactDir, name), JSON.stringify(value, null, 2) + '\n', 'utf8'); }
function overlapRatio(a, b) {
  if (!a || !b) return 0;
  const start = Math.max(a.start, b.start);
  const end = Math.min(a.end, b.end);
  return Math.max(0, end - start);
}
function normalizeText(s) {
  return String(s || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[’‘]/g, "'")
    .replace(/[“”]/g, '"')
    .toLowerCase()
    .replace(/[^a-z0-9\s]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
function tokenize(s) { return normalizeText(s).split(' ').filter(Boolean); }
function tokenF1(a, b) {
  const A = new Set(tokenize(a));
  const B = new Set(tokenize(b));
  if (!A.size && !B.size) return 1;
  if (!A.size || !B.size) return 0;
  let overlap = 0;
  for (const tok of A) if (B.has(tok)) overlap += 1;
  return (2 * overlap) / (A.size + B.size);
}
function getPromptText(chunkIndex) {
  const capturePath = path.join(phase2Dir, 'raw/ai', `chunk-${String(chunkIndex).padStart(4, '0')}`, 'split-00', 'attempt-01', 'capture.json');
  const capture = readJson(capturePath);
  const promptPath = path.join(outputDir, capture.promptRef.file);
  const promptDoc = readJson(promptPath);
  const promptText = typeof promptDoc === 'string'
    ? promptDoc
    : (promptDoc.payload || promptDoc.prompt || '');
  return { capture, promptText };
}
function extractSection(promptText, heading) {
  const needle = `## ${heading}`;
  const start = promptText.indexOf(needle);
  if (start === -1) return null;
  const after = promptText.indexOf('\n## ', start + needle.length);
  return promptText.slice(start, after === -1 ? promptText.length : after).trim();
}
function extractBulletEntries(sectionText) {
  if (!sectionText) return [];
  return sectionText
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('- ') && !line.startsWith('- Trailer-wide'));
}
function classifyChunk(index) {
  if (TRUSTED.has(index)) return 'trusted_window';
  if (EXCLUDED.has(index)) return 'excluded_window';
  return 'unclassified';
}
function summarizeMetrics(rows) {
  const out = {
    chunkCount: rows.length,
    dominantExact: 0,
    dominantRate: null,
    scoreExact: 0,
    scoreWithin1: 0,
    scoreWithin2: 0,
    scoreTotal: rows.length * 3,
    avgAbsDiff: { patience: 0, boredom: 0, excitement: 0, overall: 0 },
    summaryTokenF1Avg: 0,
    practicalPassCount: 0,
    practicalPassRate: null
  };
  if (!rows.length) return out;
  let overallAbs = 0;
  for (const row of rows) {
    if (row.dominantMatch) out.dominantExact += 1;
    if (row.practicalPass) out.practicalPassCount += 1;
    for (const lens of ['patience', 'boredom', 'excitement']) {
      const diff = row.scoreDiffs[lens].abs;
      overallAbs += diff;
      out.avgAbsDiff[lens] += diff;
      if (diff === 0) out.scoreExact += 1;
      if (diff <= 1) out.scoreWithin1 += 1;
      if (diff <= 2) out.scoreWithin2 += 1;
    }
    out.summaryTokenF1Avg += row.summaryTokenF1;
  }
  out.dominantRate = out.dominantExact / rows.length;
  out.practicalPassRate = out.practicalPassCount / rows.length;
  out.avgAbsDiff.patience /= rows.length;
  out.avgAbsDiff.boredom /= rows.length;
  out.avgAbsDiff.excitement /= rows.length;
  out.avgAbsDiff.overall = overallAbs / (rows.length * 3);
  out.summaryTokenF1Avg /= rows.length;
  return out;
}

const truth = readJson(path.join(repoRoot, 'benchmarks/fixtures/cod-test/truth/chunk-analysis.json'));
const output = readJson(path.join(phase2Dir, 'chunk-analysis.json'));
const dialogueSource = readJson(path.join(phase1Dir, 'dialogue-data.json'));
const dialogueTimestamps = readJson(path.join(phase1Dir, 'dialogue-timestamps-data.reconciled.json'));
const musicVocalsSource = readJson(path.join(phase1Dir, 'music-vocals-data.reconciled.json'));
const musicVocalsTimestamps = readJson(path.join(phase1Dir, 'music-vocals-timestamps-data.reconciled.json'));

const rows = [];
const contextAudit = [];
const representativeChunks = [0,5,6,16,18,19,24,25];
const representativeEvidence = [];

for (const outChunk of output.chunks) {
  const truthChunk = truth.chunks.find((chunk) => chunk.chunkIndex === outChunk.chunkIndex && chunk.splitIndex === outChunk.splitIndex);
  if (!truthChunk) continue;
  const scoreDiffs = {};
  for (const lens of ['patience', 'boredom', 'excitement']) {
    const truthScore = Number(truthChunk.emotions?.[lens]?.score);
    const outputScore = Number(outChunk.emotions?.[lens]?.score);
    scoreDiffs[lens] = {
      truth: truthScore,
      output: outputScore,
      diff: outputScore - truthScore,
      abs: Math.abs(outputScore - truthScore)
    };
  }
  const maxAbs = Math.max(scoreDiffs.patience.abs, scoreDiffs.boredom.abs, scoreDiffs.excitement.abs);
  const summaryF1 = tokenF1(truthChunk.summary, outChunk.summary);
  const dominantMatch = truthChunk.dominant_emotion === outChunk.dominant_emotion;
  const practicalPass = dominantMatch && maxAbs <= 2 && summaryF1 >= 0.45;
  rows.push({
    chunkIndex: outChunk.chunkIndex,
    splitIndex: outChunk.splitIndex,
    window: { start: outChunk.startTime, end: outChunk.endTime },
    classification: classifyChunk(outChunk.chunkIndex),
    dominantMatch,
    truthDominant: truthChunk.dominant_emotion,
    outputDominant: outChunk.dominant_emotion,
    scoreDiffs,
    maxAbsScoreDiff: maxAbs,
    summaryTokenF1: Number(summaryF1.toFixed(4)),
    practicalPass,
    truthSummary: truthChunk.summary,
    outputSummary: outChunk.summary
  });

  const dialogueCtx = __test.buildChunkDialogueContext({
    sourceDialogueData: dialogueSource,
    timestampDialogueData: dialogueTimestamps,
    startTime: outChunk.startTime,
    endTime: outChunk.endTime
  });
  const vocalsCtx = __test.buildChunkMusicVocalsContext({
    sourceMusicVocalsData: musicVocalsSource,
    timestampMusicVocalsData: musicVocalsTimestamps,
    startTime: outChunk.startTime,
    endTime: outChunk.endTime
  });
  const { capture, promptText } = getPromptText(outChunk.chunkIndex);
  const dialogueSection = extractSection(promptText, 'Timestamp-Grounded Dialogue Context');
  const vocalsSection = extractSection(promptText, 'Global Music-Vocals Context (ordered support only)');
  const previousSummarySection = extractSection(promptText, 'Previous Summary (continuity only — do not let this override fresh evidence)');
  const promptMusicSection = extractSection(promptText, 'Global Music Context (support only)');
  const actualDialogueSegments = dialogueCtx.segments.map((seg) => ({ index: seg.index, speaker: seg.speaker, text: seg.text, start: seg.start, end: seg.end, overlapSeconds: Number(overlapRatio(seg, {start: outChunk.startTime, end: outChunk.endTime}).toFixed(3)) }));
  const actualVocalSegments = vocalsCtx.segments.map((seg) => ({ index: seg.index, performer: seg.performer, text: seg.text, start: seg.start ?? null, end: seg.end ?? null, timingStatus: seg.timing?.status || null, overlapsWindow: Number.isFinite(seg.start) && Number.isFinite(seg.end) ? overlapRatio(seg, {start: outChunk.startTime, end: outChunk.endTime}) > 0 : null }));
  contextAudit.push({
    chunkIndex: outChunk.chunkIndex,
    window: { start: outChunk.startTime, end: outChunk.endTime },
    classification: classifyChunk(outChunk.chunkIndex),
    dialogueGrounding: {
      grounding: dialogueCtx.grounding,
      selectedSegments: actualDialogueSegments,
      allSelectedSegmentsOverlapWindow: actualDialogueSegments.every((seg) => seg.overlapSeconds > 0),
      promptSectionPresent: Boolean(dialogueSection),
      promptBulletEntries: extractBulletEntries(dialogueSection)
    },
    musicVocalsGrounding: {
      grounding: vocalsCtx.grounding,
      selectedSegments: actualVocalSegments,
      allTimedSelectedSegmentsOverlapWindow: actualVocalSegments.every((seg) => seg.start === null || seg.overlapsWindow === true),
      unresolvedSelectedSegmentCount: actualVocalSegments.filter((seg) => seg.timingStatus === 'unresolved').length,
      promptSectionPresent: Boolean(vocalsSection),
      promptBulletEntries: extractBulletEntries(vocalsSection)
    },
    promptSections: {
      previousSummary: previousSummarySection,
      globalMusic: promptMusicSection,
      globalMusicVocals: vocalsSection
    },
    outputSummary: outChunk.summary,
    capturePromptSha: capture.promptRef.sha256
  });

  if (representativeChunks.includes(outChunk.chunkIndex)) {
    representativeEvidence.push({
      chunkIndex: outChunk.chunkIndex,
      window: { start: outChunk.startTime, end: outChunk.endTime },
      classification: classifyChunk(outChunk.chunkIndex),
      truthSummary: truthChunk.summary,
      outputSummary: outChunk.summary,
      truthDominant: truthChunk.dominant_emotion,
      outputDominant: outChunk.dominant_emotion,
      scoreDiffs,
      dialogueGrounding: contextAudit[contextAudit.length - 1].dialogueGrounding,
      musicVocalsGrounding: contextAudit[contextAudit.length - 1].musicVocalsGrounding,
      previousSummary: previousSummarySection ? previousSummarySection.replace(/^## .*?\n/, '') : null
    });
  }
}

const overall = summarizeMetrics(rows);
const trustedRows = rows.filter((row) => row.classification === 'trusted_window');
const excludedRows = rows.filter((row) => row.classification === 'excluded_window');
const trusted = summarizeMetrics(trustedRows);
const excluded = summarizeMetrics(excludedRows);
const dominantMismatches = rows.filter((row) => !row.dominantMatch).map((row) => ({
  chunkIndex: row.chunkIndex,
  classification: row.classification,
  truthDominant: row.truthDominant,
  outputDominant: row.outputDominant,
  scoreDiffs: row.scoreDiffs,
  truthSummary: row.truthSummary,
  outputSummary: row.outputSummary
}));
const worstSummaryDrift = [...rows].sort((a,b) => a.summaryTokenF1 - b.summaryTokenF1).slice(0,8).map((row) => ({
  chunkIndex: row.chunkIndex,
  classification: row.classification,
  summaryTokenF1: row.summaryTokenF1,
  truthSummary: row.truthSummary,
  outputSummary: row.outputSummary
}));
const musicVocalsLeakRisk = contextAudit.filter((row) => row.musicVocalsGrounding.promptBulletEntries.some((entry) => entry.includes('index '))).map((row) => ({
  chunkIndex: row.chunkIndex,
  classification: row.classification,
  window: row.window,
  promptBulletEntries: row.musicVocalsGrounding.promptBulletEntries
}));

const benchmarkComparison = {
  outputDir: path.relative(repoRoot, outputDir),
  truthPath: 'benchmarks/fixtures/cod-test/truth/chunk-analysis.json',
  truthLimitations: {
    note: 'This truth surface is only partially human-trusted. The fixture notes say chunk-analysis truth is bootstrap, and the 2026-04-30 maintenance note says only approved windows were refreshed/trusted: 3-4, 8-15, 17, 22-27.',
    trustedChunkIndexes: [...TRUSTED],
    excludedChunkIndexes: [...EXCLUDED]
  },
  metrics: { overall, trusted, excluded },
  dominantMismatches,
  worstSummaryDrift,
  representativeEvidence
};

writeJson('benchmark-comparison.json', benchmarkComparison);
writeJson('chunk-context-audit.json', {
  outputDir: path.relative(repoRoot, outputDir),
  dialogueTimestampPath: path.relative(repoRoot, path.join(phase1Dir, 'dialogue-timestamps-data.reconciled.json')),
  musicVocalsTimestampPath: path.relative(repoRoot, path.join(phase1Dir, 'music-vocals-timestamps-data.reconciled.json')),
  rows: contextAudit,
  leakRiskMusicVocalsChunks: musicVocalsLeakRisk
});

const qaSummary = [];
qaSummary.push('# 2026-05-12 rerun QA summary');
qaSummary.push('');
qaSummary.push('## Verdicts');
qaSummary.push('');
qaSummary.push(`- Golden-truth adequacy right now: **${trusted.practicalPassRate >= 0.8 && trusted.dominantRate >= 0.85 ? 'conditional yes for the trusted benchmark windows, no for the full asset as a universal gold-truth pass' : 'no'}**.`);
qaSummary.push(`- Chunk-local dialogue/music-vocals context appropriateness: **dialogue yes, music-vocals mixed**.`);
qaSummary.push(`- Residual music-vocals timestamp weakness: **present, but not the main blocker for downstream usefulness in this rerun**.`);
qaSummary.push('');
qaSummary.push('## Benchmark/truth reality check');
qaSummary.push('');
qaSummary.push('- The repo truth surface for `chunk-analysis.json` is **not fully human-gold across all 28 chunks**.');
qaSummary.push('- Fixture notes say chunk-analysis truth started as bootstrap from a live output.');
qaSummary.push('- The 2026-04-30 maintenance note says only these windows are trusted/refreshed for bounded evaluation: `3-4, 8-15, 17, 22-27`.');
qaSummary.push('- So the honest acceptance question is: does the fresh rerun stay good enough on the trusted windows, and does it avoid obvious local-context leakage elsewhere?');
qaSummary.push('');
qaSummary.push('## Practical comparison vs truth');
qaSummary.push('');
qaSummary.push(`- Trusted windows: ${trusted.practicalPassCount}/${trusted.chunkCount} practical passes (${(trusted.practicalPassRate*100).toFixed(1)}%), dominant emotion exact on ${trusted.dominantExact}/${trusted.chunkCount} (${(trusted.dominantRate*100).toFixed(1)}%), average abs score diff ${trusted.avgAbsDiff.overall.toFixed(2)}, average summary token-F1 ${trusted.summaryTokenF1Avg.toFixed(2)}.`);
qaSummary.push(`- Excluded/frozen windows: ${excluded.practicalPassCount}/${excluded.chunkCount} practical passes (${(excluded.practicalPassRate*100).toFixed(1)}%), dominant emotion exact on ${excluded.dominantExact}/${excluded.chunkCount} (${(excluded.dominantRate*100).toFixed(1)}%), average abs score diff ${excluded.avgAbsDiff.overall.toFixed(2)}, average summary token-F1 ${excluded.summaryTokenF1Avg.toFixed(2)}.`);
qaSummary.push(`- Whole run: ${overall.practicalPassCount}/${overall.chunkCount} practical passes (${(overall.practicalPassRate*100).toFixed(1)}%), dominant emotion exact on ${overall.dominantExact}/${overall.chunkCount} (${(overall.dominantRate*100).toFixed(1)}%).`);
qaSummary.push('');
qaSummary.push('## Strong areas');
qaSummary.push('');
qaSummary.push('- Trusted late-trailer windows `22-27` are solid. Chunks 23-27 all stay directionally aligned with truth, and chunk 24 correctly lands on boredom for the static pre-order card segment.');
qaSummary.push('- Mid-action trusted window `8-15` is also directionally strong: dominant emotion stays excitement across all those chunks, matching truth, with low score drift.');
qaSummary.push('- Dialogue timestamp selection is behaving correctly at the chunk-window level. In sampled chunks with dialogue (`5`, `6`, `19`, `24`, `25`), every selected dialogue segment overlaps the chunk window, and the prompt contains only those overlapping lines in the timestamp-grounded dialogue section.');
qaSummary.push('');
qaSummary.push('## Weak or ambiguous areas');
qaSummary.push('');
qaSummary.push('- Chunk `18` is the clearest practical miss. Truth says this is the Hawaii title-card / soldier-platform window with `patience` dominant; output instead summarizes wingsuit-city action and marks `excitement` dominant. That is not a minor wording drift; it is a semantic miss in a frozen/skeptical region.');
qaSummary.push('- Chunk `5` flips the dominant emotion from truth `excitement` to output `patience`, although the score deltas are small and the dialogue context itself is correctly window-bounded.');
qaSummary.push('- Chunk `6` is usable but summary-heavy on the dialogue line. The prompt gave one overlapping dialogue segment only, which is correct, but the model summary underweights the aircraft/city visuals present in truth.');
qaSummary.push('- Because the benchmark truth is only partly trusted, failures in the excluded windows should be read as product risk signals, not as definitive gold-truth contract breaks.');
qaSummary.push('');
qaSummary.push('## Chunk-local context audit');
qaSummary.push('');
qaSummary.push('- **Dialogue:** good. The current selection code in `server/scripts/process/video-chunks.cjs` uses timestamp overlap (`segment.start < endTime && segment.end > startTime`) and the sampled prompt payloads confirm that only overlapping dialogue lines are inserted into `Timestamp-Grounded Dialogue Context`. I did not find evidence of cross-window dialogue leakage in the fresh rerun.');
qaSummary.push('- **Music-vocals:** mixed. The grounding helper also uses overlap selection, but the timestamp artifact still has many unresolved lyric segments. In music-heavy chunks like `18`, the prompt therefore includes a `Global Music-Vocals Context` block with one timed overlapping lyric plus several untimed ordered entries (`index 2` through `index 8`). That is better than blind full-history dumping, but it still exposes non-local lyric continuity into the chunk prompt.');
qaSummary.push('- The prompt instructions explicitly warn the model not to treat those global lyric entries as authoritative chunk evidence. In the sampled outputs, I did not see a blatant lyric-text hallucination contaminating summaries or dominant-emotion calls.');
qaSummary.push('');
qaSummary.push('## Is the music-vocals timestamp weakness materially harming downstream usefulness?');
qaSummary.push('');
qaSummary.push('- **Not materially, for this rerun’s practical Phase 2 usefulness.**');
qaSummary.push('- It is still a real weakness: music-heavy prompts can carry untimed lyric entries beyond the chunk window, so leakage risk has not been fully eliminated.');
qaSummary.push('- But the fresh output’s main practical misses are better explained by chunk interpretation / continuity drift in skeptical windows than by obvious lyric contamination. The strong performance on trusted windows, including the late trailer and promo-card stretch, suggests the residual vocals weakness is no longer the dominant blocker.');
qaSummary.push('');
qaSummary.push('## Representative evidence');
qaSummary.push('');
for (const sample of representativeEvidence) {
  qaSummary.push(`### Chunk ${sample.chunkIndex} (${sample.window.start}-${sample.window.end}s, ${sample.classification})`);
  qaSummary.push(`- Truth dominant: ${sample.truthDominant}`);
  qaSummary.push(`- Output dominant: ${sample.outputDominant}`);
  qaSummary.push(`- Truth summary: ${sample.truthSummary}`);
  qaSummary.push(`- Output summary: ${sample.outputSummary}`);
  qaSummary.push(`- Dialogue grounding strategy: ${sample.dialogueGrounding.grounding.strategy}; selected=${sample.dialogueGrounding.selectedSegments.length}`);
  qaSummary.push(`- Music-vocals grounding strategy: ${sample.musicVocalsGrounding.grounding.strategy}; selected=${sample.musicVocalsGrounding.selectedSegments.length}; unresolvedSelected=${sample.musicVocalsGrounding.unresolvedSelectedSegmentCount}`);
  if (sample.dialogueGrounding.selectedSegments.length > 0) {
    qaSummary.push(`- Dialogue lines: ${sample.dialogueGrounding.selectedSegments.map((seg) => `${seg.start}-${seg.end}s ${seg.speaker}: ${seg.text}`).join(' | ')}`);
  }
  if (sample.musicVocalsGrounding.promptBulletEntries.length > 0) {
    qaSummary.push(`- Prompt music-vocals support entries: ${sample.musicVocalsGrounding.promptBulletEntries.join(' | ')}`);
  }
  qaSummary.push('');
}

fs.writeFileSync(path.join(artifactDir, 'qa-summary.md'), qaSummary.join('\n') + '\n', 'utf8');
console.log('Wrote benchmark-comparison.json, chunk-context-audit.json, qa-summary.md');
