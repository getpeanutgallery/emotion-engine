const fs = require('fs');
const os = require('os');
const path = require('path');
const test = require('node:test');
const assert = require('node:assert/strict');

const reconcileScript = require('../../server/scripts/get-context/reconcile-famous-song-phase1.cjs');
const { validateDialogueV3SourceTruthObject } = require('../../server/lib/dialogue-v3-source-truth-validator.cjs');

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
            evidence: ['Matched chorus wording', 'Ordered lyric fragments'],
            matchedLyrics: ['Obey your master', 'Twisting your mind']
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

  await t.test('preserves raw artifacts while emitting reconciled companions and a transparency ledger', async () => {
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
    const reconciledDialogueV3Path = path.join(outputDir, 'phase1-gather-context', 'dialogue-v3-source-truth.reconciled.json');
    const reconciledMusicVocalsPath = path.join(outputDir, 'phase1-gather-context', 'music-vocals-data.reconciled.json');
    const ledgerPath = path.join(outputDir, 'phase1-gather-context', 'famous-song-reconciliation.json');

    assert.deepEqual(rawDialogueAfter, artifacts.dialogueData);
    assert.deepEqual(rawMusicVocalsAfter, artifacts.musicVocalsData);
    assert.equal(fs.existsSync(reconciledDialoguePath), true);
    assert.equal(fs.existsSync(reconciledDialogueV3Path), true);
    assert.equal(fs.existsSync(reconciledMusicVocalsPath), true);
    assert.equal(fs.existsSync(ledgerPath), true);

    const reconciledDialogue = JSON.parse(fs.readFileSync(reconciledDialoguePath, 'utf8'));
    const reconciledDialogueV3 = JSON.parse(fs.readFileSync(reconciledDialogueV3Path, 'utf8'));
    const reconciledMusicVocals = JSON.parse(fs.readFileSync(reconciledMusicVocalsPath, 'utf8'));
    const ledger = JSON.parse(fs.readFileSync(ledgerPath, 'utf8'));

    assert.equal(reconciledDialogue.dialogue_segments.length, 1);
    assert.equal(reconciledDialogue.dialogue_segments[0].text, 'Move now, squad up.');
    assert.equal(Object.prototype.hasOwnProperty.call(reconciledDialogue.dialogue_segments[0], 'start'), false);
    assert.equal(Object.prototype.hasOwnProperty.call(reconciledDialogue.dialogue_segments[0], 'end'), false);
    assert.equal(validateDialogueV3SourceTruthObject(reconciledDialogueV3).ok, true);
    assert.equal(reconciledDialogueV3.dialogue_segments.length, 1);
    assert.equal(reconciledDialogueV3.dialogue_segments[0].text, 'Move now, squad up.');
    assert.equal(reconciledDialogueV3.dialogue_segments[0].traits.interpersonal_stance, 'directive');
    assert.equal(reconciledDialogueV3.dialogue_segments[0].traits.delivery_overlay, 'none_apparent');
    assert.equal(reconciledMusicVocals.vocal_segments[0].text, 'Control your master');
    assert.equal(Object.prototype.hasOwnProperty.call(reconciledMusicVocals.vocal_segments[0], 'start'), false);
    assert.equal(Object.prototype.hasOwnProperty.call(reconciledMusicVocals.vocal_segments[0], 'end'), false);
    assert.equal(reconciledMusicVocals.recognizedSong.status, 'recognized');
    assert.deepEqual(result.artifacts.dialogueData, artifacts.dialogueData);
    assert.deepEqual(result.artifacts.musicVocalsData, artifacts.musicVocalsData);
    assert.equal(result.artifacts.dialogueDataReconciled.dialogue_segments.length, 1);
    assert.equal(result.artifacts.dialogueDataReconciled.dialogue_segments[0].text, 'Move now, squad up.');
    assert.equal(result.artifacts.musicVocalsDataReconciled.vocal_segments[0].text, 'Control your master');
    assert.equal(ledger.contractVersion, 'ee.famous-song-reconciliation/v2');
    assert.equal(ledger.status, 'applied');
    assert.equal(ledger.decisions.removedDialogueSegments.length, 1);
    assert.deepEqual(ledger.decisions.lyricCorrections, []);
    assert.deepEqual(ledger.decisions.skippedCorrections, []);
    assert.deepEqual(ledger.decisions.musicVocalsPolicy, {
      lyricRepairEnabled: false,
      reason: 'transcript_text_must_remain_audio_faithful',
      recognizedSongRole: 'identity_support_metadata_only'
    });
    assert.equal(ledger.decisions.musicVocalsNotes[0].decision, 'preserved_transcript_text');
  });

  await t.test('runs dialogue lyric cleanup in index-only mode without rewriting music-vocals text', async () => {
    const artifacts = makeArtifacts({
      dialogueData: {
        dialogue_segments: [
          { index: 0, speaker: 'VO', text: 'Obey your master', confidence: 0.9 },
          { index: 1, speaker: 'Captain', text: 'Move now, squad up.', confidence: 0.99 }
        ],
        summary: 'Two spoken segments are present.'
      },
      musicVocalsData: {
        vocal_segments: [
          { index: 0, text: 'Control your master', confidence: 0.9, performer: 'Lead', delivery: 'sung' },
          { index: 1, text: 'Twisting your mind', confidence: 0.92, performer: 'Lead', delivery: 'sung' }
        ],
        summary: 'Two lyric-bearing vocal segments are present.',
        recognizedSong: {
          status: 'recognized',
          confidence: 0.97,
          multipleSongsDetected: false,
          candidates: [
            {
              title: 'Master of Puppets',
              artist: 'Metallica',
              confidence: 0.97,
              evidence: ['Matched chorus wording', 'Ordered lyric fragments'],
              matchedLyrics: ['Obey your master', 'Twisting your mind']
            }
          ]
        }
      }
    });

    await reconcileScript.run({ outputDir, artifacts });

    const reconciledDialogue = JSON.parse(fs.readFileSync(path.join(outputDir, 'phase1-gather-context', 'dialogue-data.reconciled.json'), 'utf8'));
    const reconciledMusicVocals = JSON.parse(fs.readFileSync(path.join(outputDir, 'phase1-gather-context', 'music-vocals-data.reconciled.json'), 'utf8'));
    const ledger = JSON.parse(fs.readFileSync(path.join(outputDir, 'phase1-gather-context', 'famous-song-reconciliation.json'), 'utf8'));

    assert.equal(reconciledDialogue.dialogue_segments.length, 1);
    assert.equal(reconciledDialogue.dialogue_segments[0].text, 'Move now, squad up.');
    assert.equal(reconciledMusicVocals.vocal_segments[0].text, 'Control your master');
    assert.equal(ledger.status, 'applied');
    assert.equal(ledger.trigger.reasons.length, 0);
    assert.deepEqual(ledger.decisions.lyricCorrections, []);
  });

  await t.test('allows dialogue lyric cleanup when supporting music consensus is weak but dialogue/music-vocals evidence is strong', async () => {
    const artifacts = makeArtifacts({
      musicData: {
        summary: 'Music lane is uncertain on the specific song.',
        totalDuration: 60,
        recognizedSong: {
          status: 'possible',
          confidence: 0.41,
          multipleSongsDetected: true,
          candidates: [
            {
              title: 'Master of Puppets',
              artist: 'Metallica',
              confidence: 0.41
            }
          ]
        }
      }
    });

    await reconcileScript.run({ outputDir, artifacts });

    const reconciledDialogue = JSON.parse(fs.readFileSync(path.join(outputDir, 'phase1-gather-context', 'dialogue-data.reconciled.json'), 'utf8'));
    const ledger = JSON.parse(fs.readFileSync(path.join(outputDir, 'phase1-gather-context', 'famous-song-reconciliation.json'), 'utf8'));

    assert.equal(reconciledDialogue.dialogue_segments.length, 1);
    assert.equal(reconciledDialogue.dialogue_segments[0].text, 'Move now, squad up.');
    assert.equal(ledger.status, 'applied');
    assert.deepEqual(ledger.trigger.reasons, []);
    assert.deepEqual(ledger.decisions.lyricCorrections, []);
  });

  await t.test('still requires supporting music consensus when dialogue/music-vocals evidence is not strong enough', async () => {
    const artifacts = makeArtifacts({
      dialogueData: {
        dialogue_segments: [
          { start: 10, end: 12.2, speaker: 'VO', text: 'Stand your ground', confidence: 0.91 },
          { start: 30, end: 33, speaker: 'Captain', text: 'Move now, squad up.', confidence: 0.99 }
        ],
        summary: 'Two spoken segments are present.',
        totalDuration: 60
      },
      musicData: {
        summary: 'Music lane is uncertain on the specific song.',
        totalDuration: 60,
        recognizedSong: {
          status: 'possible',
          confidence: 0.41,
          multipleSongsDetected: true,
          candidates: [
            {
              title: 'Master of Puppets',
              artist: 'Metallica',
              confidence: 0.41
            }
          ]
        }
      }
    });

    await reconcileScript.run({ outputDir, artifacts });

    const reconciledDialogue = JSON.parse(fs.readFileSync(path.join(outputDir, 'phase1-gather-context', 'dialogue-data.reconciled.json'), 'utf8'));
    const reconciledMusicVocals = JSON.parse(fs.readFileSync(path.join(outputDir, 'phase1-gather-context', 'music-vocals-data.reconciled.json'), 'utf8'));
    const ledger = JSON.parse(fs.readFileSync(path.join(outputDir, 'phase1-gather-context', 'famous-song-reconciliation.json'), 'utf8'));

    assert.equal(reconciledDialogue.dialogue_segments.length, 2);
    assert.equal(ledger.status, 'skipped');
    assert.equal(ledger.trigger.reasons.includes('hasSupportingMusicConsensus'), true);
    assert.equal(reconciledMusicVocals.vocal_segments[0].text, artifacts.musicVocalsData.vocal_segments[0].text);
    assert.deepEqual(ledger.decisions.lyricCorrections, []);
  });

  await t.test('never rewrites the harmful Obey your master case toward canonical lyrics', async () => {
    const artifacts = makeArtifacts({
      dialogueData: {
        dialogue_segments: [
          { index: 10, speaker: 'Captain', text: "The hell it isn't!", confidence: 0.5 },
          {
            index: 11,
            speaker: 'VO',
            text: "Obey your master... Master... Just call me faster... Master... Master... The master's puppet's a puppet's brain... Twisting your mind, smashing your day... Blinding from me, you can't see... Just go ahead, it's all in your head... Master, master... Plans and dreams are now in the after... Master, master... You'll be in my grasp...",
            confidence: 0.4
          },
          { index: 12, speaker: 'Captain', text: 'Pull it together, man.', confidence: 0.5 }
        ],
        summary: 'Dialogue includes a long paraphrased lyric contamination block.'
      },
      musicData: {
        summary: 'Music lane is suggestive but not strong enough to carry the gate alone.',
        recognizedSong: {
          status: 'possible',
          confidence: 0.64,
          multipleSongsDetected: false,
          candidates: [
            {
              title: 'Master of Puppets',
              artist: 'Metallica',
              confidence: 0.64,
              matchedLyrics: ['Master, master']
            }
          ]
        }
      },
      musicVocalsData: {
        vocal_segments: [
          { index: 0, text: "I'll be your master", confidence: 0.95, performer: 'Lead', delivery: 'sung' },
          { index: 1, text: 'Master! Master!', confidence: 0.95, performer: 'Lead', delivery: 'sung' },
          { index: 2, text: "Master of puppets, I'm pulling your strings", confidence: 0.85, performer: 'Lead', delivery: 'sung' },
          { index: 4, text: 'Obey your master!', confidence: 0.95, performer: 'Lead', delivery: 'sung' },
          { index: 5, text: 'Twisting your mind and smashing your dreams', confidence: 0.85, performer: 'Lead', delivery: 'sung' },
          { index: 9, text: "Blinded by me, you can't see a thing", confidence: 0.95, performer: 'Lead', delivery: 'sung' },
          { index: 11, text: 'Master, master', confidence: 0.95, performer: 'Lead', delivery: 'sung' }
        ],
        summary: 'Vocal lane captures the recognized song with multiple supporting phrases.',
        recognizedSong: {
          status: 'recognized',
          confidence: 0.95,
          multipleSongsDetected: false,
          candidates: [
            {
              title: 'Master of Puppets',
              artist: 'Metallica',
              confidence: 0.95,
              evidence: ['Distinct lyric fragments and delivery strongly support one specific song.'],
              matchedLyrics: ['Master, master', "I'll be your master", "Master of puppets, I'm pulling your strings"]
            }
          ]
        }
      }
    });

    await reconcileScript.run({ outputDir, artifacts });

    const reconciledDialogue = JSON.parse(fs.readFileSync(path.join(outputDir, 'phase1-gather-context', 'dialogue-data.reconciled.json'), 'utf8'));
    const reconciledMusicVocals = JSON.parse(fs.readFileSync(path.join(outputDir, 'phase1-gather-context', 'music-vocals-data.reconciled.json'), 'utf8'));
    const ledger = JSON.parse(fs.readFileSync(path.join(outputDir, 'phase1-gather-context', 'famous-song-reconciliation.json'), 'utf8'));
    const gate = reconcileScript._private.buildRecognitionGate(
      artifacts.musicVocalsData,
      artifacts.musicData,
      artifacts.dialogueData
    );

    assert.equal(gate.passed, true);
    assert.equal(gate.evidence.dialogueLyricEvidence.hasLyricTextEvidence, true);
    assert.equal(gate.evidence.hasStrongDialogueVocalsEvidence, true);
    assert.equal(gate.evidence.requiresSupportingMusicConsensus, false);
    assert.equal(reconciledDialogue.dialogue_segments.length, 2);
    assert.equal(reconciledDialogue.dialogue_segments.some((segment) => segment.text.includes('Obey your master')), false);
    assert.equal(ledger.status, 'applied');
    assert.equal(ledger.decisions.removedDialogueSegments.length, 1);
    assert.equal(ledger.decisions.removedDialogueSegments[0].evidence.evidenceType, 'composite_anchor_bundle');
    assert.equal(ledger.decisions.removedDialogueSegments[0].evidence.anchorHits.some((entry) => entry.source === 'vocalSegment'), true);
    assert.equal(reconciledMusicVocals.vocal_segments[3].text, 'Obey your master!');
    assert.notEqual(reconciledMusicVocals.vocal_segments[3].text, "I'll be your master");
    assert.deepEqual(ledger.decisions.lyricCorrections, []);
    assert.equal(ledger.decisions.musicVocalsNotes[0].reason, 'recognized_song_metadata_must_not_rewrite_music_vocals_transcript');
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

    assert.equal(reconciledDialogue.dialogue_segments.length, 1);
    assert.equal(reconciledDialogue.dialogue_segments[0].text, artifacts.dialogueData.dialogue_segments[0].text);
    assert.equal(reconciledMusicVocals.vocal_segments.length, 1);
    assert.equal(reconciledMusicVocals.vocal_segments[0].text, artifacts.musicVocalsData.vocal_segments[0].text);
    assert.equal(ledger.status, 'skipped');
    assert.equal(Array.isArray(ledger.trigger.reasons), true);
    assert.notEqual(ledger.trigger.reasons.length, 0);
    assert.deepEqual(ledger.decisions.lyricCorrections, []);
  });
});
