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
    assert.equal(Object.prototype.hasOwnProperty.call(reconciledDialogue.dialogue_segments[0], 'start'), false);
    assert.equal(Object.prototype.hasOwnProperty.call(reconciledDialogue.dialogue_segments[0], 'end'), false);
    assert.equal(reconciledMusicVocals.vocal_segments[0].text, 'Obey your master');
    assert.equal(Object.prototype.hasOwnProperty.call(reconciledMusicVocals.vocal_segments[0], 'start'), false);
    assert.equal(Object.prototype.hasOwnProperty.call(reconciledMusicVocals.vocal_segments[0], 'end'), false);
    assert.equal(result.artifacts.dialogueData.dialogue_segments.length, 1);
    assert.equal(result.artifacts.musicVocalsData.vocal_segments[0].text, 'Obey your master');
    assert.equal(ledger.status, 'applied');
    assert.equal(ledger.decisions.removedDialogueSegments.length, 1);
    assert.equal(ledger.decisions.lyricCorrections.length, 1);
    assert.equal(ledger.decisions.lyricCorrections[0].lane, 'generic');
  });

  await t.test('runs lyric cleanup in index-only mode without timeRanges or timing overlap checks', async () => {
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
    assert.equal(reconciledMusicVocals.vocal_segments[0].text, 'Obey your master');
    assert.equal(ledger.status, 'applied');
    assert.equal(ledger.trigger.reasons.length, 0);
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
  });

  await t.test('allows relaxed gate for repeated/re-entry lyric order when first occurrences have a strong ordered subsequence', async () => {
    const artifacts = makeArtifacts({
      dialogueData: {
        dialogue_segments: [
          { index: 0, speaker: 'VO', text: 'Obey your master', confidence: 0.92 },
          { index: 1, speaker: 'VO', text: 'Come crawling faster', confidence: 0.92 },
          { index: 2, speaker: 'VO', text: 'Master, master', confidence: 0.91 },
          { index: 3, speaker: 'Captain', text: 'Move now, squad up.', confidence: 0.99 },
          { index: 4, speaker: 'VO', text: 'Obey your master', confidence: 0.91 }
        ],
        summary: 'Dialogue includes lyric re-entry contamination.'
      },
      musicData: {
        summary: 'Music lane is uncertain on the specific song.',
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
      },
      musicVocalsData: {
        vocal_segments: [
          { index: 0, text: 'Obey your master', confidence: 0.9, performer: 'Lead', delivery: 'sung' },
          { index: 1, text: 'Master, master', confidence: 0.9, performer: 'Lead', delivery: 'sung' },
          { index: 2, text: 'Come crawling faster', confidence: 0.9, performer: 'Lead', delivery: 'sung' },
          { index: 3, text: "Master of puppets, I'm pulling your strings", confidence: 0.9, performer: 'Lead', delivery: 'sung' },
          { index: 7, text: 'Master, master', confidence: 0.9, performer: 'Lead', delivery: 'sung' }
        ],
        summary: 'Vocal lane includes real chorus-style re-entry.',
        recognizedSong: {
          status: 'recognized',
          confidence: 0.97,
          multipleSongsDetected: false,
          candidates: [
            {
              title: 'Master of Puppets',
              artist: 'Metallica',
              confidence: 0.97,
              evidence: ['Matched chorus wording', 'Repeated chorus returns'],
              matchedLyrics: [
                'Obey your master',
                'Master, master',
                'Come crawling faster',
                "Master of puppets, I'm pulling your strings"
              ]
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

    const gate = reconcileScript._private.buildRecognitionGate(
      artifacts.musicVocalsData,
      artifacts.musicData,
      artifacts.dialogueData
    );
    assert.equal(gate.evidence.hasStrongDialogueVocalsEvidence, true);
    assert.equal(gate.evidence.requiresSupportingMusicConsensus, false);
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
    const ledger = JSON.parse(fs.readFileSync(path.join(outputDir, 'phase1-gather-context', 'famous-song-reconciliation.json'), 'utf8'));

    assert.equal(reconciledDialogue.dialogue_segments.length, 2);
    assert.equal(ledger.status, 'skipped');
    assert.equal(ledger.trigger.reasons.includes('hasSupportingMusicConsensus'), true);
  });

  await t.test('admits anchored near-miss lyric corrections around the relaxed floor', async () => {
    const artifacts = makeArtifacts({
      musicVocalsData: {
        vocal_segments: [
          { start: 10, end: 12.3, text: 'Come control your master', confidence: 0.9, performer: 'Lead', delivery: 'sung' },
          { start: 13, end: 14.8, text: 'Control your master', confidence: 0.9, performer: 'Lead', delivery: 'sung' }
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
              timeRanges: [{ start: 9.5, end: 16.5 }]
            }
          ]
        }
      }
    });

    await reconcileScript.run({ outputDir, artifacts });

    const reconciledMusicVocals = JSON.parse(fs.readFileSync(path.join(outputDir, 'phase1-gather-context', 'music-vocals-data.reconciled.json'), 'utf8'));
    const ledger = JSON.parse(fs.readFileSync(path.join(outputDir, 'phase1-gather-context', 'famous-song-reconciliation.json'), 'utf8'));

    assert.equal(reconciledMusicVocals.vocal_segments[0].text, 'Obey your master');
    assert.equal(reconciledMusicVocals.vocal_segments[1].text, 'Obey your master');
    assert.equal(ledger.decisions.lyricCorrections.length, 2);
    assert.equal(ledger.decisions.lyricCorrections[0].lane, 'anchored_near_miss');
    assert.equal(ledger.decisions.lyricCorrections[1].lane, 'generic');
  });

  await t.test('blocks unsafe fragment-shortening rewrites even when similarity is otherwise high', async () => {
    const artifacts = makeArtifacts({
      musicVocalsData: {
        vocal_segments: [
          { start: 10, end: 13.3, text: 'Twisting your mind and smashing your dreams', confidence: 0.93, performer: 'Lead', delivery: 'sung' },
          { start: 14, end: 17.5, text: "Master of puppets, I'm pulling your strings", confidence: 0.93, performer: 'Lead', delivery: 'sung' }
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
              matchedLyrics: ['Twisting your mind', 'Master of puppets'],
              timeRanges: [{ start: 9.5, end: 18 }]
            }
          ]
        }
      }
    });

    await reconcileScript.run({ outputDir, artifacts });

    const reconciledMusicVocals = JSON.parse(fs.readFileSync(path.join(outputDir, 'phase1-gather-context', 'music-vocals-data.reconciled.json'), 'utf8'));
    const ledger = JSON.parse(fs.readFileSync(path.join(outputDir, 'phase1-gather-context', 'famous-song-reconciliation.json'), 'utf8'));

    assert.equal(reconciledMusicVocals.vocal_segments[0].text, 'Twisting your mind and smashing your dreams');
    assert.equal(reconciledMusicVocals.vocal_segments[1].text, "Master of puppets, I'm pulling your strings");
    assert.equal(ledger.decisions.lyricCorrections.length, 0);
    assert.equal(ledger.decisions.skippedCorrections[0].reason, 'target_too_short_relative_to_source');
    assert.equal(ledger.decisions.skippedCorrections[1].reason, 'target_too_short_relative_to_source');
  });

  await t.test('keeps weakly anchored fragments from rewriting to a different full lyric', async () => {
    const artifacts = makeArtifacts({
      musicVocalsData: {
        vocal_segments: [
          { start: 10, end: 12.3, text: 'Master, master', confidence: 0.9, performer: 'Lead', delivery: 'sung' },
          { start: 12.5, end: 14.2, text: 'Promised only lies', confidence: 0.9, performer: 'Lead', delivery: 'sung' }
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
              timeRanges: [{ start: 9.5, end: 16.5 }]
            }
          ]
        }
      }
    });

    await reconcileScript.run({ outputDir, artifacts });

    const reconciledMusicVocals = JSON.parse(fs.readFileSync(path.join(outputDir, 'phase1-gather-context', 'music-vocals-data.reconciled.json'), 'utf8'));
    const ledger = JSON.parse(fs.readFileSync(path.join(outputDir, 'phase1-gather-context', 'famous-song-reconciliation.json'), 'utf8'));

    assert.equal(reconciledMusicVocals.vocal_segments[0].text, 'Master, master');
    assert.equal(reconciledMusicVocals.vocal_segments[1].text, 'Promised only lies');
    assert.equal(ledger.decisions.lyricCorrections.length, 0);
    assert.equal(ledger.decisions.skippedCorrections[0].reason, 'lyric_similarity_below_threshold');
    assert.equal(ledger.decisions.skippedCorrections[1].reason, 'lyric_similarity_below_threshold');
  });

  await t.test('uses the real-shape archived near-miss without loosening the strong song gate', async () => {
    const artifacts = makeArtifacts({
      musicVocalsData: {
        vocal_segments: [
          { start: 10, end: 12.4, text: 'Come control your master', confidence: 0.9, performer: 'Lead', delivery: 'sung' }
        ],
        summary: 'One lyric-bearing vocal segment is present.',
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
              matchedLyrics: ['Obey your master', 'Twisting your mind', 'Master of puppets'],
              timeRanges: [{ start: 9.5, end: 16.5 }]
            }
          ]
        }
      }
    });

    await reconcileScript.run({ outputDir, artifacts });

    const reconciledMusicVocals = JSON.parse(fs.readFileSync(path.join(outputDir, 'phase1-gather-context', 'music-vocals-data.reconciled.json'), 'utf8'));
    const ledger = JSON.parse(fs.readFileSync(path.join(outputDir, 'phase1-gather-context', 'famous-song-reconciliation.json'), 'utf8'));

    assert.equal(reconciledMusicVocals.vocal_segments[0].text, 'Obey your master');
    assert.equal(ledger.decisions.lyricCorrections.length, 1);
    assert.equal(ledger.decisions.lyricCorrections[0].lane, 'anchored_near_miss');
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
  });

  await t.test('exposes the anchored lane and truncation guard helpers directly', () => {
    const decisionNearMiss = reconcileScript._private.classifyLyricCorrection('Come control your master', 'Obey your master', 0.5789473684210527);
    const decisionTruncation = reconcileScript._private.classifyLyricCorrection('Twisting your mind and smashing your dreams', 'Twisting your mind', 0.6667);

    assert.equal(decisionNearMiss.allowed, true);
    assert.equal(decisionNearMiss.lane, 'anchored_near_miss');
    assert.equal(reconcileScript._private.hasStrongPhraseAnchor('Come control your master', 'Obey your master'), true);
    assert.equal(decisionTruncation.allowed, false);
    assert.equal(decisionTruncation.reason, 'target_too_short_relative_to_source');
  });
});
