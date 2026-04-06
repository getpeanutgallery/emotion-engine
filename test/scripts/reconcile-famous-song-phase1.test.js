const fs = require('fs');
const os = require('os');
const path = require('path');
const test = require('node:test');
const assert = require('node:assert/strict');

const reconcileScript = require('../../server/scripts/get-context/reconcile-famous-song-phase1.cjs');

function makeTempDir(prefix = 'ee-famous-song-reconcile-') {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function writeJson(filePath, payload) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), 'utf8');
}

function makeArtifacts(overrides = {}) {
  return {
    dialogueData: {
      dialogue_segments: [
        { start: 10, end: 12.2, speaker: 'VO', text: 'Obey your master', confidence: 0.91 },
        { start: 30, end: 33, speaker: 'Captain', text: 'Move now, squad up.', confidence: 0.99 }
      ],
      summary: 'Two spoken segments are present.',
      totalDuration: 60
    },
    musicData: {
      summary: 'Heavy guitars build underneath the trailer.',
      totalDuration: 60
    },
    musicVocalsData: {
      vocal_segments: [
        { start: 10, end: 12.3, text: 'Control your master', confidence: 0.9, performer: 'Lead', delivery: 'sung' },
        { start: 14, end: 16, text: 'Twisting your mind', confidence: 0.92, performer: 'Lead', delivery: 'sung' }
      ],
      summary: 'Two lyric-bearing vocal segments are present.',
      totalDuration: 60,
      recognizedSong: {
        status: 'recognized',
        confidence: 0.97,
        multipleSongsDetected: false,
        candidates: [
          {
            title: 'Master of Puppets',
            artist: 'Metallica',
            confidence: 0.97,
            evidence: ['Matched chorus wording', 'Time-aligned hook'],
            matchedLyrics: ['Obey your master', 'Twisting your mind'],
            timeRanges: [
              { start: 9.5, end: 16.5 }
            ]
          }
        ]
      }
    },
    ...overrides
  };
}

test('reconcile-famous-song-phase1 script', async (t) => {
  let outputDir;

  t.beforeEach(() => {
    outputDir = makeTempDir();
  });

  t.afterEach(() => {
    if (outputDir && fs.existsSync(outputDir)) {
      fs.rmSync(outputDir, { recursive: true, force: true });
    }
  });

  await t.test('preserves raw artifacts while emitting reconciled companions and ledger', async () => {
    const artifacts = makeArtifacts();
    const rawDialoguePath = path.join(outputDir, 'phase1-gather-context', 'dialogue-data.json');
    const rawMusicPath = path.join(outputDir, 'phase1-gather-context', 'music-data.json');
    const rawMusicVocalsPath = path.join(outputDir, 'phase1-gather-context', 'music-vocals-data.json');

    writeJson(rawDialoguePath, artifacts.dialogueData);
    writeJson(rawMusicPath, artifacts.musicData);
    writeJson(rawMusicVocalsPath, artifacts.musicVocalsData);

    const result = await reconcileScript.run({ outputDir, artifacts });

    const rawDialogueAfter = JSON.parse(fs.readFileSync(rawDialoguePath, 'utf8'));
    const rawMusicVocalsAfter = JSON.parse(fs.readFileSync(rawMusicVocalsPath, 'utf8'));
    const reconciledDialoguePath = path.join(outputDir, 'phase1-gather-context', 'dialogue-data.reconciled.json');
    const reconciledMusicVocalsPath = path.join(outputDir, 'phase1-gather-context', 'music-vocals-data.reconciled.json');
    const ledgerPath = path.join(outputDir, 'phase1-gather-context', 'famous-song-reconciliation.json');

    assert.deepEqual(rawDialogueAfter, artifacts.dialogueData);
    assert.deepEqual(rawMusicVocalsAfter, artifacts.musicVocalsData);
    assert.equal(fs.existsSync(reconciledDialoguePath), true);
    assert.equal(fs.existsSync(reconciledMusicVocalsPath), true);
    assert.equal(fs.existsSync(ledgerPath), true);

    const reconciledDialogue = JSON.parse(fs.readFileSync(reconciledDialoguePath, 'utf8'));
    const reconciledMusicVocals = JSON.parse(fs.readFileSync(reconciledMusicVocalsPath, 'utf8'));
    const ledger = JSON.parse(fs.readFileSync(ledgerPath, 'utf8'));

    assert.equal(reconciledDialogue.dialogue_segments.length, 1);
    assert.equal(reconciledDialogue.dialogue_segments[0].text, 'Move now, squad up.');
    assert.equal(reconciledMusicVocals.vocal_segments[0].text, 'Obey your master');
    assert.equal(result.artifacts.dialogueData.dialogue_segments.length, 1);
    assert.equal(result.artifacts.musicVocalsData.vocal_segments[0].text, 'Obey your master');
    assert.equal(ledger.status, 'applied');
    assert.equal(ledger.decisions.removedDialogueSegments.length, 1);
    assert.equal(ledger.decisions.lyricCorrections.length, 1);
  });

  await t.test('does not overcorrect when recognized-song evidence is weak or ambiguous', async () => {
    const artifacts = makeArtifacts({
      dialogueData: {
        dialogue_segments: [
          { start: 10, end: 12.2, speaker: 'VO', text: 'We own the night', confidence: 0.98 }
        ],
        summary: 'One spoken segment is present.',
        totalDuration: 60
      },
      musicVocalsData: {
        vocal_segments: [
          { start: 10, end: 12.3, text: 'We roam the night', confidence: 0.84, performer: 'Lead', delivery: 'sung' }
        ],
        summary: 'One uncertain lyric-bearing segment is present.',
        totalDuration: 60,
        recognizedSong: {
          status: 'possible',
          confidence: 0.66,
          multipleSongsDetected: true,
          candidates: [
            {
              title: 'Unknown Song',
              artist: 'Unknown Artist',
              confidence: 0.66,
              evidence: ['Vague similarity'],
              matchedLyrics: ['We own the night'],
              timeRanges: [{ start: 9.5, end: 12.5 }]
            },
            {
              title: 'Another Song',
              artist: 'Another Artist',
              confidence: 0.61,
              evidence: ['Competing guess'],
              matchedLyrics: ['We own tonight'],
              timeRanges: [{ start: 9.5, end: 12.5 }]
            }
          ]
        }
      }
    });

    writeJson(path.join(outputDir, 'phase1-gather-context', 'dialogue-data.json'), artifacts.dialogueData);
    writeJson(path.join(outputDir, 'phase1-gather-context', 'music-data.json'), artifacts.musicData);
    writeJson(path.join(outputDir, 'phase1-gather-context', 'music-vocals-data.json'), artifacts.musicVocalsData);

    await reconcileScript.run({ outputDir, artifacts });

    const reconciledDialogue = JSON.parse(fs.readFileSync(path.join(outputDir, 'phase1-gather-context', 'dialogue-data.reconciled.json'), 'utf8'));
    const reconciledMusicVocals = JSON.parse(fs.readFileSync(path.join(outputDir, 'phase1-gather-context', 'music-vocals-data.reconciled.json'), 'utf8'));
    const ledger = JSON.parse(fs.readFileSync(path.join(outputDir, 'phase1-gather-context', 'famous-song-reconciliation.json'), 'utf8'));

    assert.deepEqual(reconciledDialogue, artifacts.dialogueData);
    assert.deepEqual(reconciledMusicVocals, artifacts.musicVocalsData);
    assert.equal(ledger.status, 'skipped');
    assert.equal(Array.isArray(ledger.trigger.reasons), true);
    assert.notEqual(ledger.trigger.reasons.length, 0);
  });
});
