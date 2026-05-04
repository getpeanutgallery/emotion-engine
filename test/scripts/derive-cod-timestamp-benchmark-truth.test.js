const fs = require('fs');
const test = require('node:test');
const assert = require('node:assert/strict');

const derive = require('../../scripts/qa/derive-cod-timestamp-benchmark-truth.cjs');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

test('derive-cod-timestamp-benchmark-truth recovers the 20-row dialogue timing benchmark without parity drift', () => {
  const currentDialogueTruth = readJson(derive.CURRENT_DIALOGUE_TRUTH_PATH);
  const historicalDialogueTruth = derive.loadHistoricalDialogueTruth();

  assert.doesNotThrow(() => derive.assertDialogueParity(currentDialogueTruth, historicalDialogueTruth));

  const output = derive.buildDialogueTimestampTruth(currentDialogueTruth, historicalDialogueTruth);
  assert.equal(output.dialogue_segments.length, 20);
  assert.deepEqual(Object.keys(output.dialogue_segments[0]), ['index', 'text', 'speaker', 'speaker_id', 'start', 'end']);
  assert.equal(output.dialogue_segments[0].text, currentDialogueTruth.dialogue_segments[0].text);
  assert.equal(output.dialogue_segments[19].text, currentDialogueTruth.dialogue_segments[19].text);
  assert.equal(output.dialogue_segments[0].start, historicalDialogueTruth.dialogue_segments[0].start);
  assert.equal(output.dialogue_segments[19].end, historicalDialogueTruth.dialogue_segments[19].end);
  assert.ok(!('timing' in output.dialogue_segments[0]));
  assert.ok(!('confidence' in output.dialogue_segments[0]));
});

test('derive-cod-timestamp-benchmark-truth extracts stable-index music-vocals timing truth without runtime-only fields', () => {
  const currentMusicVocalsTruth = readJson(derive.CURRENT_MUSIC_VOCALS_TRUTH_PATH);
  const output = derive.buildMusicVocalsTimestampTruth(currentMusicVocalsTruth);

  assert.equal(output.vocal_segments.length, currentMusicVocalsTruth.vocal_segments.length);
  assert.deepEqual(Object.keys(output.vocal_segments[0]), ['index', 'text', 'performer', 'performer_id', 'delivery', 'start', 'end']);
  assert.equal(output.vocal_segments[0].index, 0);
  assert.equal(output.vocal_segments.at(-1).index, currentMusicVocalsTruth.vocal_segments.length - 1);
  assert.equal(output.vocal_segments[0].text, currentMusicVocalsTruth.vocal_segments[0].text);
  assert.ok(!('timing' in output.vocal_segments[0]));
  assert.ok(!('confidence' in output.vocal_segments[0]));
});

test('derive-cod-timestamp-benchmark-truth check matches the persisted benchmark files', () => {
  const outputs = derive.commandCheck();
  const persistedDialogue = readJson(derive.OUTPUT_DIALOGUE_TRUTH_PATH);
  const persistedMusicVocals = readJson(derive.OUTPUT_MUSIC_VOCALS_TRUTH_PATH);

  assert.deepEqual(persistedDialogue, outputs.dialogue);
  assert.deepEqual(persistedMusicVocals, outputs.musicVocals);
});
