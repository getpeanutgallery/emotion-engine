const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const CURRENT_DIALOGUE_TRUTH_PATH = path.join(REPO_ROOT, 'benchmarks/fixtures/cod-test/truth/dialogue-data.json');
const CURRENT_MUSIC_VOCALS_TRUTH_PATH = path.join(REPO_ROOT, 'benchmarks/fixtures/cod-test/truth/music-vocals-data.json');
const OUTPUT_DIALOGUE_TRUTH_PATH = path.join(REPO_ROOT, 'benchmarks/fixtures/cod-test/truth/dialogue-timestamps-data.reconciled.json');
const OUTPUT_MUSIC_VOCALS_TRUTH_PATH = path.join(REPO_ROOT, 'benchmarks/fixtures/cod-test/truth/music-vocals-timestamps-data.json');
const HISTORICAL_DIALOGUE_COMMIT = '1771225';
const HISTORICAL_DIALOGUE_GIT_PATH = 'benchmarks/fixtures/cod-test/truth/dialogue-data.json';

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, payload) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(payload, null, 2) + '\n', 'utf8');
}

function normalizeDialogueText(value) {
  return String(value ?? '')
    .normalize('NFKC')
    .replace(/\s+/g, ' ')
    .trim();
}

function loadHistoricalDialogueTruth() {
  const raw = execFileSync(
    'git',
    ['show', `${HISTORICAL_DIALOGUE_COMMIT}:${HISTORICAL_DIALOGUE_GIT_PATH}`],
    { cwd: REPO_ROOT, encoding: 'utf8' }
  );
  return JSON.parse(raw);
}

function assertDialogueParity(currentDialogueTruth, historicalDialogueTruth) {
  const currentSegments = currentDialogueTruth?.dialogue_segments;
  const historicalSegments = historicalDialogueTruth?.dialogue_segments;

  if (!Array.isArray(currentSegments)) {
    throw new Error(`Current dialogue truth is missing dialogue_segments: ${CURRENT_DIALOGUE_TRUTH_PATH}`);
  }
  if (!Array.isArray(historicalSegments)) {
    throw new Error(`Historical dialogue truth is missing dialogue_segments from ${HISTORICAL_DIALOGUE_COMMIT}`);
  }
  if (currentSegments.length !== 20) {
    throw new Error(`Expected 20 current dialogue truth rows, found ${currentSegments.length}`);
  }
  if (historicalSegments.length !== 20) {
    throw new Error(`Expected 20 historical dialogue truth rows, found ${historicalSegments.length}`);
  }

  currentSegments.forEach((currentSegment, index) => {
    const historicalSegment = historicalSegments[index];
    if (!historicalSegment) {
      throw new Error(`Missing historical dialogue segment at index ${index}`);
    }
    if (currentSegment.index !== index) {
      throw new Error(`Current dialogue index mismatch at row ${index}: expected ${index}, found ${currentSegment.index}`);
    }
    if (historicalSegment.index !== index) {
      throw new Error(`Historical dialogue index mismatch at row ${index}: expected ${index}, found ${historicalSegment.index}`);
    }

    const currentText = normalizeDialogueText(currentSegment.text);
    const historicalText = normalizeDialogueText(historicalSegment.text);
    if (currentText !== historicalText) {
      throw new Error(
        `Dialogue parity break at row ${index}: current text ${JSON.stringify(currentSegment.text)} != historical text ${JSON.stringify(historicalSegment.text)}`
      );
    }
  });
}

function buildDialogueTimestampTruth(currentDialogueTruth, historicalDialogueTruth) {
  assertDialogueParity(currentDialogueTruth, historicalDialogueTruth);

  const dialogue_segments = currentDialogueTruth.dialogue_segments.map((currentSegment, index) => {
    const historicalSegment = historicalDialogueTruth.dialogue_segments[index];
    return {
      index: currentSegment.index,
      text: currentSegment.text,
      speaker: historicalSegment.speaker,
      speaker_id: historicalSegment.speaker_id,
      start: historicalSegment.start,
      end: historicalSegment.end
    };
  });

  return {
    _benchmark: {
      ignorePaths: [
        '$.analysisMode',
        '$.timingMode',
        '$.sourceStrategy',
        '$.coverage',
        '$.provenance',
        '$.qualityNotes',
        '$.dialogue_segments[*].timing'
      ]
    },
    dialogue_segments,
    summary: currentDialogueTruth.summary,
    totalDuration: historicalDialogueTruth.totalDuration
  };
}

function buildMusicVocalsTimestampTruth(currentMusicVocalsTruth) {
  const segments = currentMusicVocalsTruth?.vocal_segments;
  if (!Array.isArray(segments)) {
    throw new Error(`Current music-vocals truth is missing vocal_segments: ${CURRENT_MUSIC_VOCALS_TRUTH_PATH}`);
  }

  return {
    _benchmark: {
      ignorePaths: [
        '$.analysisMode',
        '$.timingMode',
        '$.sourceStrategy',
        '$.coverage',
        '$.provenance',
        '$.qualityNotes',
        '$.recognitionNotes',
        '$.recognizedSong',
        '$.vocal_segments[*].timing'
      ]
    },
    vocal_segments: segments.map((segment, index) => ({
      index,
      text: segment.text,
      performer: segment.performer,
      performer_id: segment.performer_id,
      delivery: segment.delivery,
      start: segment.start,
      end: segment.end
    })),
    summary: currentMusicVocalsTruth.summary,
    hasVocals: currentMusicVocalsTruth.hasVocals,
    totalDuration: currentMusicVocalsTruth.totalDuration
  };
}

function buildTimestampBenchmarkTruth() {
  const currentDialogueTruth = readJson(CURRENT_DIALOGUE_TRUTH_PATH);
  const historicalDialogueTruth = loadHistoricalDialogueTruth();
  const currentMusicVocalsTruth = readJson(CURRENT_MUSIC_VOCALS_TRUTH_PATH);

  return {
    dialogue: buildDialogueTimestampTruth(currentDialogueTruth, historicalDialogueTruth),
    musicVocals: buildMusicVocalsTimestampTruth(currentMusicVocalsTruth)
  };
}

function commandWrite() {
  const outputs = buildTimestampBenchmarkTruth();
  writeJson(OUTPUT_DIALOGUE_TRUTH_PATH, outputs.dialogue);
  writeJson(OUTPUT_MUSIC_VOCALS_TRUTH_PATH, outputs.musicVocals);
  return outputs;
}

function commandCheck() {
  const outputs = buildTimestampBenchmarkTruth();
  const persistedDialogue = readJson(OUTPUT_DIALOGUE_TRUTH_PATH);
  const persistedMusicVocals = readJson(OUTPUT_MUSIC_VOCALS_TRUTH_PATH);

  const expectedDialogue = JSON.stringify(outputs.dialogue);
  const actualDialogue = JSON.stringify(persistedDialogue);
  if (expectedDialogue !== actualDialogue) {
    throw new Error(`Persisted dialogue timestamp benchmark does not match regenerated output: ${OUTPUT_DIALOGUE_TRUTH_PATH}`);
  }

  const expectedMusicVocals = JSON.stringify(outputs.musicVocals);
  const actualMusicVocals = JSON.stringify(persistedMusicVocals);
  if (expectedMusicVocals !== actualMusicVocals) {
    throw new Error(`Persisted music-vocals timestamp benchmark does not match regenerated output: ${OUTPUT_MUSIC_VOCALS_TRUTH_PATH}`);
  }

  return outputs;
}

function main(argv = process.argv.slice(2)) {
  const mode = argv[0] || 'write';
  let outputs;

  if (mode === 'write') {
    outputs = commandWrite();
  } else if (mode === 'check') {
    outputs = commandCheck();
  } else {
    throw new Error(`Unknown mode ${JSON.stringify(mode)}. Expected one of: write, check`);
  }

  console.log(JSON.stringify({
    ok: true,
    mode,
    dialogueSegments: outputs.dialogue.dialogue_segments.length,
    musicVocalSegments: outputs.musicVocals.vocal_segments.length,
    dialogueOutput: path.relative(REPO_ROOT, OUTPUT_DIALOGUE_TRUTH_PATH),
    musicVocalsOutput: path.relative(REPO_ROOT, OUTPUT_MUSIC_VOCALS_TRUTH_PATH)
  }, null, 2));
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}

module.exports = {
  REPO_ROOT,
  CURRENT_DIALOGUE_TRUTH_PATH,
  CURRENT_MUSIC_VOCALS_TRUTH_PATH,
  OUTPUT_DIALOGUE_TRUTH_PATH,
  OUTPUT_MUSIC_VOCALS_TRUTH_PATH,
  HISTORICAL_DIALOGUE_COMMIT,
  loadHistoricalDialogueTruth,
  normalizeDialogueText,
  assertDialogueParity,
  buildDialogueTimestampTruth,
  buildMusicVocalsTimestampTruth,
  buildTimestampBenchmarkTruth,
  commandWrite,
  commandCheck,
  main
};
