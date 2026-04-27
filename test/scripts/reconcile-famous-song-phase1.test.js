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

  await t.test('removes the remaining middle lyric lines via one extra bounded second-hop promotion', async () => {
    const artifacts = makeArtifacts({
      dialogueData: {
        dialogue_segments: [
          { index: 0, speaker: 'Captain', text: 'Hold your ground.', confidence: 0.99 },
          { index: 10, speaker: 'Singer', text: 'Silver skyline.', confidence: 0.43 },
          { index: 11, speaker: 'Singer', text: 'Neon thunder calling softly.', confidence: 0.45 },
          { index: 12, speaker: 'Singer', text: 'Static hearts are falling slowly.', confidence: 0.45 },
          { index: 13, speaker: 'Singer', text: 'Midnight engines turning over.', confidence: 0.45 },
          { index: 20, speaker: 'Captain', text: 'Move to the ridge!', confidence: 0.99 },
          { index: 30, speaker: 'Singer', text: 'Final refrain.', confidence: 0.43 }
        ],
        summary: 'Sparse lyric anchors leave one middle line requiring a bounded second hop.'
      },
      musicVocalsData: {
        vocal_segments: [
          { index: 10, text: 'Silver skyline', confidence: 0.95, performer: 'Lead', delivery: 'sung' },
          { index: 11, text: 'Neon thunder calling softly', confidence: 0.95, performer: 'Lead', delivery: 'sung' },
          { index: 12, text: 'Static hearts are falling slowly', confidence: 0.95, performer: 'Lead', delivery: 'sung' },
          { index: 13, text: 'Midnight engines turning over', confidence: 0.95, performer: 'Lead', delivery: 'sung' },
          { index: 30, text: 'Final refrain', confidence: 0.95, performer: 'Lead', delivery: 'sung' }
        ],
        summary: 'The vocal lane captures a recognized song with sparse lyric anchors.',
        recognizedSong: {
          status: 'recognized',
          confidence: 0.95,
          multipleSongsDetected: false,
          candidates: [
            {
              title: 'City Lights',
              artist: 'Example Artist',
              confidence: 0.95,
              evidence: ['Sparse anchors with a longer local lyric chain.'],
              matchedLyrics: ['Silver skyline', 'Final refrain']
            }
          ]
        }
      }
    });

    await reconcileScript.run({ outputDir, artifacts });

    const reconciledDialogue = JSON.parse(fs.readFileSync(path.join(outputDir, 'phase1-gather-context', 'dialogue-data.reconciled.json'), 'utf8'));
    const ledger = JSON.parse(fs.readFileSync(path.join(outputDir, 'phase1-gather-context', 'famous-song-reconciliation.json'), 'utf8'));

    assert.deepEqual(
      reconciledDialogue.dialogue_segments.map((segment) => segment.index),
      [0, 20]
    );
    assert.deepEqual(
      ledger.decisions.removedDialogueSegments.map((segment) => segment.indexOrder),
      [10, 11, 12, 13, 30]
    );
    const removedByIndex = new Map(
      ledger.decisions.removedDialogueSegments.map((segment) => [segment.indexOrder, segment])
    );

    assert.equal(removedByIndex.get(13).evidence.promotionHop, 2);
    assert.equal(
      [11, 12].every((index) => {
        const segment = removedByIndex.get(index);
        return Boolean(segment) && ['direct_vocal_support', 'bounded_lyric_bridge'].includes(segment.evidence.evidenceType);
      }),
      true
    );
  });

  await t.test('stops after the bounded extra hop instead of propagating indefinitely', async () => {
    const artifacts = makeArtifacts({
      dialogueData: {
        dialogue_segments: [
          { index: 0, speaker: 'Singer', text: 'Silver skyline.', confidence: 0.43 },
          { index: 1, speaker: 'Singer', text: 'Neon thunder calling softly.', confidence: 0.45 },
          { index: 2, speaker: 'Singer', text: 'Static hearts are falling slowly.', confidence: 0.45 },
          { index: 3, speaker: 'Singer', text: 'Midnight engines turning over.', confidence: 0.45 },
          { index: 4, speaker: 'Singer', text: 'Paper sirens fading under.', confidence: 0.45 },
          { index: 10, speaker: 'Captain', text: 'Hold the line!', confidence: 0.99 },
          { index: 20, speaker: 'Singer', text: 'Final refrain.', confidence: 0.43 }
        ],
        summary: 'Only one extra local propagation hop should be allowed.'
      },
      musicVocalsData: {
        vocal_segments: [
          { index: 0, text: 'Silver skyline', confidence: 0.95, performer: 'Lead', delivery: 'sung' },
          { index: 1, text: 'Neon thunder calling softly', confidence: 0.95, performer: 'Lead', delivery: 'sung' },
          { index: 2, text: 'Static hearts are falling slowly', confidence: 0.95, performer: 'Lead', delivery: 'sung' },
          { index: 3, text: 'Midnight engines turning over', confidence: 0.95, performer: 'Lead', delivery: 'sung' },
          { index: 4, text: 'Paper sirens fading under', confidence: 0.95, performer: 'Lead', delivery: 'sung' },
          { index: 20, text: 'Final refrain', confidence: 0.95, performer: 'Lead', delivery: 'sung' }
        ],
        summary: 'The vocal lane captures a sparse-anchor lyric cluster.',
        recognizedSong: {
          status: 'recognized',
          confidence: 0.95,
          multipleSongsDetected: false,
          candidates: [
            {
              title: 'City Lights',
              artist: 'Example Artist',
              confidence: 0.95,
              evidence: ['Sparse anchors with a longer direct-vocal lyric chain.'],
              matchedLyrics: ['Silver skyline', 'Final refrain']
            }
          ]
        }
      }
    });

    await reconcileScript.run({ outputDir, artifacts });

    const reconciledDialogue = JSON.parse(fs.readFileSync(path.join(outputDir, 'phase1-gather-context', 'dialogue-data.reconciled.json'), 'utf8'));
    const ledger = JSON.parse(fs.readFileSync(path.join(outputDir, 'phase1-gather-context', 'famous-song-reconciliation.json'), 'utf8'));

    assert.deepEqual(
      reconciledDialogue.dialogue_segments.map((segment) => segment.index),
      [4, 10]
    );
    const removedByIndex = new Map(
      ledger.decisions.removedDialogueSegments.map((segment) => [segment.indexOrder, segment])
    );

    assert.equal(removedByIndex.get(3).evidence.promotionHop, 2);
    assert.equal(removedByIndex.has(4), false);
    assert.equal(
      [1, 2].every((index) => {
        const segment = removedByIndex.get(index);
        return Boolean(segment) && ['direct_vocal_support', 'bounded_lyric_bridge'].includes(segment.evidence.evidenceType);
      }),
      true
    );
  });

  await t.test('removes a low-confidence lyric bridge line sandwiched between confirmed same-speaker contamination', async () => {
    const artifacts = makeArtifacts({
      dialogueData: {
        dialogue_segments: [
          { index: 11, speaker: 'Speaker 7', text: "This isn't real.", confidence: 0.85 },
          { index: 12, speaker: 'Speaker 8', text: "The hell it ain't!", confidence: 0.85 },
          { index: 13, speaker: 'Speaker 9', text: 'Obey your master, master', confidence: 0.7 },
          { index: 14, speaker: 'Speaker 9', text: 'Come crawling faster', confidence: 0.7 },
          { index: 15, speaker: 'Speaker 9', text: 'Obey your master, master', confidence: 0.7 },
          { index: 16, speaker: 'Speaker 9', text: 'Your life burns faster', confidence: 0.7 },
          { index: 17, speaker: 'Speaker 9', text: 'Obey your master, master', confidence: 0.7 },
          { index: 18, speaker: 'Speaker 8', text: 'Pull it together, man!', confidence: 0.8 }
        ],
        summary: 'A low-confidence lyric bridge line sits inside an already confirmed sung contamination run.'
      },
      musicVocalsData: {
        vocal_segments: [
          { index: 0, text: 'Obey your master', confidence: 0.95, performer: 'Lead', delivery: 'sung' },
          { index: 1, text: 'Master! Master!', confidence: 0.95, performer: 'Lead', delivery: 'sung' },
          { index: 2, text: 'Come crawling faster', confidence: 0.95, performer: 'Lead', delivery: 'sung' },
          { index: 3, text: 'Obey your master!', confidence: 0.95, performer: 'Lead', delivery: 'sung' },
          { index: 4, text: 'Master of puppets, I am pulling your strings', confidence: 0.95, performer: 'Lead', delivery: 'sung' }
        ],
        summary: 'The vocal lane strongly supports a recognized song but omits the bridge line text.',
        recognizedSong: {
          status: 'recognized',
          confidence: 0.95,
          multipleSongsDetected: false,
          candidates: [
            {
              title: 'Master of Puppets',
              artist: 'Metallica',
              confidence: 0.95,
              evidence: ['Adjacent lyric lines align with the vocal transcript.'],
              matchedLyrics: ['Obey your master', 'Come crawling faster', 'Master of puppets, I am pulling your strings']
            }
          ]
        }
      }
    });

    await reconcileScript.run({ outputDir, artifacts });

    const reconciledDialogue = JSON.parse(fs.readFileSync(path.join(outputDir, 'phase1-gather-context', 'dialogue-data.reconciled.json'), 'utf8'));
    const ledger = JSON.parse(fs.readFileSync(path.join(outputDir, 'phase1-gather-context', 'famous-song-reconciliation.json'), 'utf8'));
    const bridgedRemoval = ledger.decisions.removedDialogueSegments.find((segment) => segment.indexOrder === 16);

    assert.deepEqual(
      reconciledDialogue.dialogue_segments.map((segment) => segment.index),
      [11, 12, 18]
    );
    assert.equal(Boolean(bridgedRemoval), true);
    assert.equal(bridgedRemoval.evidence.evidenceType, 'bounded_lyric_bridge');
    assert.equal(bridgedRemoval.evidence.boundedLyricBridge, true);
  });

  await t.test('does not let lyric-like neighbors count as spoken support', async () => {
    const artifacts = makeArtifacts({
      dialogueData: {
        dialogue_segments: [
          { index: 0, speaker: 'Speaker 8', text: 'Come crawling faster, master.', confidence: 0.45 },
          { index: 1, speaker: 'Speaker 8', text: "Master of puppets, I'm pulling your strings.", confidence: 0.45 },
          { index: 2, speaker: 'Speaker 8', text: 'Twisting your mind and smashing your dreams.', confidence: 0.45 },
          { index: 3, speaker: 'Captain', text: 'Hold the perimeter.', confidence: 0.99 }
        ],
        summary: 'Same-speaker lyric lines should not preserve each other as speech.'
      },
      musicVocalsData: {
        vocal_segments: [
          { index: 0, text: 'Come crawling faster', confidence: 0.95, performer: 'Lead', delivery: 'sung' },
          { index: 1, text: "Master of puppets I'll pull your strings", confidence: 0.95, performer: 'Lead', delivery: 'sung' },
          { index: 2, text: 'Twisting your mind and smashing your dreams', confidence: 0.95, performer: 'Lead', delivery: 'sung' }
        ],
        summary: 'The vocal lane strongly supports a recognized song.',
        recognizedSong: {
          status: 'recognized',
          confidence: 0.95,
          multipleSongsDetected: false,
          candidates: [
            {
              title: 'Master of Puppets',
              artist: 'Metallica',
              confidence: 0.95,
              evidence: ['Adjacent lyric lines align with the vocal transcript.'],
              matchedLyrics: ['Come crawling faster', "Master of puppets I'll pull your strings"]
            }
          ]
        }
      }
    });

    await reconcileScript.run({ outputDir, artifacts });

    const reconciledDialogue = JSON.parse(fs.readFileSync(path.join(outputDir, 'phase1-gather-context', 'dialogue-data.reconciled.json'), 'utf8'));
    const ledger = JSON.parse(fs.readFileSync(path.join(outputDir, 'phase1-gather-context', 'famous-song-reconciliation.json'), 'utf8'));

    assert.deepEqual(
      reconciledDialogue.dialogue_segments.map((segment) => segment.index),
      [3]
    );
    assert.deepEqual(
      ledger.decisions.removedDialogueSegments.map((segment) => segment.indexOrder),
      [0, 1, 2]
    );
  });

  await t.test('does not bridge across a high-confidence same-speaker spoken line between lyric contamination', async () => {
    const artifacts = makeArtifacts({
      dialogueData: {
        dialogue_segments: [
          { index: 13, speaker: 'Speaker 9', text: 'Obey your master, master', confidence: 0.7 },
          { index: 14, speaker: 'Speaker 9', text: 'Need immediate evac at the south stairwell.', confidence: 0.99 },
          { index: 15, speaker: 'Speaker 9', text: 'Come crawling faster', confidence: 0.7 },
          { index: 16, speaker: 'Captain', text: 'Move now, squad up.', confidence: 0.99 }
        ],
        summary: 'A real high-confidence spoken line should not be removed just because lyric contamination surrounds it.'
      },
      musicVocalsData: {
        vocal_segments: [
          { index: 0, text: 'Obey your master', confidence: 0.95, performer: 'Lead', delivery: 'sung' },
          { index: 1, text: 'Come crawling faster', confidence: 0.95, performer: 'Lead', delivery: 'sung' }
        ],
        summary: 'The vocal lane supports the lyric lines but not the spoken instruction.',
        recognizedSong: {
          status: 'recognized',
          confidence: 0.95,
          multipleSongsDetected: false,
          candidates: [
            {
              title: 'Master of Puppets',
              artist: 'Metallica',
              confidence: 0.95,
              evidence: ['Two lyric anchors surround a real spoken line.'],
              matchedLyrics: ['Obey your master', 'Come crawling faster']
            }
          ]
        }
      }
    });

    await reconcileScript.run({ outputDir, artifacts });

    const reconciledDialogue = JSON.parse(fs.readFileSync(path.join(outputDir, 'phase1-gather-context', 'dialogue-data.reconciled.json'), 'utf8'));
    const ledger = JSON.parse(fs.readFileSync(path.join(outputDir, 'phase1-gather-context', 'famous-song-reconciliation.json'), 'utf8'));

    assert.deepEqual(
      reconciledDialogue.dialogue_segments.map((segment) => segment.index),
      [13, 14, 15, 16]
    );
    assert.equal(reconciledDialogue.dialogue_segments[1].text, 'Need immediate evac at the south stairwell.');
    assert.deepEqual(ledger.decisions.removedDialogueSegments, []);
  });

  await t.test('preserves a real spoken neighbor while still removing adjacent lyric contamination', async () => {
    const artifacts = makeArtifacts({
      dialogueData: {
        dialogue_segments: [
          { index: 0, speaker: 'Speaker 8', text: 'You can do this, stay with me now.', confidence: 0.45 },
          { index: 1, speaker: 'Speaker 8', text: 'Twisting your mind and smashing your dreams.', confidence: 0.45 },
          { index: 2, speaker: 'Captain', text: 'Move now, squad up.', confidence: 0.99 },
          { index: 3, speaker: 'Narrator', text: 'Obey your master.', confidence: 0.43 }
        ],
        summary: 'A real spoken line sits beside lyric-contaminated dialogue.'
      },
      musicVocalsData: {
        vocal_segments: [
          { index: 1, text: 'Twisting your mind and smashing your dreams', confidence: 0.95, performer: 'Lead', delivery: 'sung' },
          { index: 3, text: 'Obey your master', confidence: 0.95, performer: 'Lead', delivery: 'sung' }
        ],
        summary: 'The vocal lane identifies a known song.',
        recognizedSong: {
          status: 'recognized',
          confidence: 0.95,
          multipleSongsDetected: false,
          candidates: [
            {
              title: 'Master of Puppets',
              artist: 'Metallica',
              confidence: 0.95,
              evidence: ['One lyric line appears beside real spoken dialogue.'],
              matchedLyrics: ['Twisting your mind', 'Obey your master']
            }
          ]
        }
      }
    });

    await reconcileScript.run({ outputDir, artifacts });

    const reconciledDialogue = JSON.parse(fs.readFileSync(path.join(outputDir, 'phase1-gather-context', 'dialogue-data.reconciled.json'), 'utf8'));
    const ledger = JSON.parse(fs.readFileSync(path.join(outputDir, 'phase1-gather-context', 'famous-song-reconciliation.json'), 'utf8'));

    assert.deepEqual(
      reconciledDialogue.dialogue_segments.map((segment) => segment.index),
      [0, 1, 2]
    );
    assert.equal(reconciledDialogue.dialogue_segments[0].text, 'You can do this, stay with me now.');
    assert.deepEqual(
      ledger.decisions.removedDialogueSegments.map((segment) => segment.indexOrder),
      [3]
    );
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
