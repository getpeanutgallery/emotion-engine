const assert = require('node:assert/strict');
const test = require('node:test');

const {
  buildDialogueTranscriptionValidatorToolContract,
  executeDialogueTranscriptionValidatorTool,
  buildDialogueStitchValidatorToolContract,
  executeDialogueStitchValidatorTool,
  buildMusicAnalysisValidatorToolContract,
  executeMusicAnalysisValidatorTool
} = require('../../server/lib/phase1-validator-tools.cjs');

test('dialogue transcription validator tool contract is lane-specific', () => {
  const contract = buildDialogueTranscriptionValidatorToolContract({ requireHandoff: true });
  assert.equal(contract.name, 'validate_dialogue_transcription_json');
  assert.equal(contract.argumentKey, 'transcription');
  assert.deepEqual(contract.inputSchema.required, ['transcription']);
  assert.equal(contract.canonicalEnvelope.tool, 'validate_dialogue_transcription_json');
  assert.match(contract.description, /spoken-dialogue transcription/i);
  assert.match(contract.inputSchema.properties.transcription.description, /audible spoken words only/i);
  assert.ok(contract.canonicalEnvelope.transcription.handoffContext);
});

test('music analysis validator accepts optional music-lane vocal segments', () => {
  const contract = buildMusicAnalysisValidatorToolContract();
  assert.match(contract.description, /music-lane JSON candidate/i);
  assert.match(contract.inputSchema.properties.musicAnalysis.description, /vocal_segments/i);
  assert.match(contract.inputSchema.properties.musicAnalysis.description, /transcript-like text-bearing music-led vocals/i);
  assert.match(contract.inputSchema.properties.musicAnalysis.description, /literal lexical capture/i);

  const result = executeMusicAnalysisValidatorTool({
    musicAnalysis: {
      analysis: {
        type: 'music',
        description: 'Driving chant-led percussion.',
        mood: 'energetic',
        intensity: 8
      },
      rollingSummary: 'The cue stays music-led and aggressive.',
      vocalSummary: 'A chant hook repeats over the downbeat.',
      vocal_segments: [
        {
          start: 2,
          end: 4,
          text: 'Run it back',
          confidence: 0.92,
          performer: 'Crowd',
          performer_id: 'crowd_1',
          delivery: 'chant'
        }
      ]
    }
  });

  assert.equal(result.valid, true);
  assert.equal(result.normalizedValue.vocalSummary, 'A chant hook repeats over the downbeat.');
  assert.equal(result.normalizedValue.vocal_segments[0].delivery, 'chant');
});

test('dialogue transcription validator tool enforces required handoff fields', () => {
  const result = executeDialogueTranscriptionValidatorTool({
    transcription: {
      dialogue_segments: [
        { start: 0, end: 1, speaker: 'Speaker 1', text: 'Hello', confidence: 0.9 }
      ],
      summary: 'Chunk summary',
      totalDuration: 2
    }
  }, { requireHandoff: true });

  assert.equal(result.valid, false);
  assert.match(result.summary, /handoffContext/i);
});

test('dialogue transcription validator normalizes grounded speaker linkage and inferred traits shape', () => {
  const result = executeDialogueTranscriptionValidatorTool({
    transcription: {
      dialogue_segments: [
        { start: 0, end: 1, speaker: 'Speaker 1', text: 'Hello', confidence: 0.9 },
        { start: 1.1, end: 2, speaker: 'Speaker 1', text: 'Again', confidence: 0.88 },
        { start: 2.1, end: 3, speaker: 'Speaker 2', text: 'Hi', confidence: 0.76 }
      ],
      summary: 'Chunk summary',
      totalDuration: 3
    }
  });

  assert.equal(result.valid, true);
  assert.equal(result.normalizedValue.dialogue_segments[0].speaker_id, 'spk_001');
  assert.equal(result.normalizedValue.dialogue_segments[1].speaker_id, 'spk_001');
  assert.equal(result.normalizedValue.dialogue_segments[2].speaker_id, 'spk_002');
  assert.equal(result.normalizedValue.dialogue_segments[0].index, 0);
  assert.equal(result.normalizedValue.dialogue_segments[1].index, 1);
  assert.equal(result.normalizedValue.dialogue_segments[2].index, 2);
  assert.deepEqual(result.normalizedValue.speaker_profiles[0].grounded.linked_segment_indexes, [0, 1]);
  assert.equal(typeof result.normalizedValue.speaker_profiles[0].grounded.confidence, 'number');
  assert.deepEqual(result.normalizedValue.speaker_profiles[0].inferred_traits, { traits: [] });
});


test('dialogue transcription validator preserves inferred traits separately from grounded data', () => {
  const result = executeDialogueTranscriptionValidatorTool({
    transcription: {
      dialogue_segments: [
        { start: 0, end: 1, speaker: 'Speaker 1', speaker_id: 'spk_007', text: 'Hello', confidence: 0.9 }
      ],
      speaker_profiles: [
        {
          speaker_id: 'spk_007',
          label: 'Speaker 1',
          grounded: {
            confidence: 0.83,
            linked_segment_indexes: [0],
            acoustic_descriptors: [
              { label: 'calm, measured delivery', confidence: 0.62 }
            ]
          },
          inferred_traits: {
            traits: [
              { trait: 'accent', value: 'possibly Midwestern US', confidence: 0.31, note: 'guess' }
            ]
          }
        }
      ],
      summary: 'Chunk summary',
      totalDuration: 1
    }
  });

  assert.equal(result.valid, true);
  assert.equal(result.normalizedValue.speaker_profiles[0].grounded.acoustic_descriptors[0].label, 'calm, measured delivery');
  assert.equal(result.normalizedValue.speaker_profiles[0].inferred_traits.traits[0].trait, 'accent');
  assert.equal(result.normalizedValue.speaker_profiles[0].inferred_traits.traits[0].value, 'possibly Midwestern US');
  assert.deepEqual(Object.keys(result.normalizedValue.speaker_profiles[0].grounded).sort(), ['acoustic_descriptors', 'confidence', 'linked_segment_indexes']);
});

test('dialogue transcription validator preserves additive analysis metadata', () => {
  const result = executeDialogueTranscriptionValidatorTool({
    transcription: {
      dialogue_segments: [
        { start: 0, end: 1, speaker: 'Speaker 1', speaker_id: 'spk_001', text: 'Hello', confidence: 0.9 }
      ],
      summary: 'Whole-asset summary',
      totalDuration: 1,
      analysisMode: 'whole_asset',
      timingMode: 'full_timeline',
      sourceStrategy: 'base64',
      coverage: {
        start: 0,
        end: 1,
        duration: 1,
        complete: true
      },
      provenance: {
        transportMode: 'inline',
        usedChunking: false,
        chunkCount: 0,
        fallbackApplied: false
      },
      qualityNotes: ['Whole-asset timing preserved full coverage.']
    }
  });

  assert.equal(result.valid, true);
  assert.equal(result.normalizedValue.analysisMode, 'whole_asset');
  assert.equal(result.normalizedValue.timingMode, 'full_timeline');
  assert.equal(result.normalizedValue.sourceStrategy, 'base64');
  assert.deepEqual(result.normalizedValue.coverage, {
    start: 0,
    end: 1,
    duration: 1,
    complete: true
  });
  assert.deepEqual(result.normalizedValue.provenance, {
    transportMode: 'inline',
    usedChunking: false,
    chunkCount: 0,
    fallbackApplied: false
  });
  assert.deepEqual(result.normalizedValue.qualityNotes, ['Whole-asset timing preserved full coverage.']);
});

test('dialogue transcription validator normalizes numeric and m:ss(.d) segment timestamps into seconds', () => {
  const result = executeDialogueTranscriptionValidatorTool({
    transcription: {
      dialogue_segments: [
        { start: 80, end: 82.5, speaker: 'Speaker 1', text: 'Plain numeric seconds', confidence: 0.95 },
        { start: '1:23', end: '1:25', speaker: 'Speaker 2', text: 'Minute second timestamps', confidence: 0.92 },
        { start: '2:17.5', end: '2:20.0', speaker: 'Speaker 3', text: 'Fractional minute second timestamps', confidence: 0.91 }
      ],
      summary: 'Whole-asset summary',
      totalDuration: 140.04
    }
  });

  assert.equal(result.valid, true);
  assert.deepEqual(
    result.normalizedValue.dialogue_segments.map((segment) => [segment.start, segment.end]),
    [
      [80, 82.5],
      [83, 85],
      [137.5, 140]
    ]
  );
});

test('dialogue transcription validator still rejects malformed non-time timestamp variants', () => {
  const result = executeDialogueTranscriptionValidatorTool({
    transcription: {
      dialogue_segments: [
        { start: '1:2', end: 'not-a-time', speaker: 'Speaker 1', text: 'Bad timestamps', confidence: 0.95 }
      ],
      summary: 'Whole-asset summary',
      totalDuration: 10
    }
  });

  assert.equal(result.valid, false);
  assert.match(result.summary, /dialogue segment start must be a finite number/i);
  assert.match(result.summary, /dialogue segment end must be a finite number/i);
});

test('dialogue transcription validator merges duplicate speaker profiles by speaker_id and preserves the strongest stable label', () => {
  const result = executeDialogueTranscriptionValidatorTool({
    transcription: {
      dialogue_segments: [
        { start: 0, end: 1, speaker: 'Speaker 1', speaker_id: 'spk_001', text: 'Opening line', confidence: 0.95 },
        { start: 1.2, end: 2.2, speaker: 'Raul Menendez', speaker_id: 'spk_001', text: 'Follow-up line', confidence: 0.94 }
      ],
      speaker_profiles: [
        {
          speaker_id: 'spk_001',
          label: 'Speaker 1',
          grounded: {
            confidence: 0.81,
            linked_segment_indexes: [0],
            acoustic_descriptors: [
              { label: 'measured, controlled delivery', confidence: 0.6 }
            ]
          },
          inferred_traits: {
            traits: []
          }
        },
        {
          speaker_id: 'spk_001',
          label: 'Raul Menendez',
          grounded: {
            confidence: 0.88,
            linked_segment_indexes: [1],
            acoustic_descriptors: [
              { label: 'low, menacing tone', confidence: 0.74 }
            ]
          },
          inferred_traits: {
            traits: [
              { trait: 'accent', value: 'possibly Latin American', confidence: 0.33, note: 'speculative' }
            ]
          }
        }
      ],
      summary: 'Chunk summary',
      totalDuration: 3
    }
  });

  assert.equal(result.valid, true);
  assert.equal(result.normalizedValue.dialogue_segments[0].speaker, 'Raul Menendez');
  assert.equal(result.normalizedValue.dialogue_segments[1].speaker, 'Raul Menendez');
  assert.deepEqual(result.normalizedValue.speaker_profiles[0].grounded.linked_segment_indexes, [0, 1]);
  assert.equal(result.normalizedValue.speaker_profiles[0].grounded.acoustic_descriptors.length, 2);
  assert.equal(result.normalizedValue.speaker_profiles[0].inferred_traits.traits[0].trait, 'accent');
});

test('dialogue transcription validator rebuilds linked segment indexes from the final segment array', () => {
  const result = executeDialogueTranscriptionValidatorTool({
    transcription: {
      dialogue_segments: [
        { start: 0, end: 1, speaker: 'Speaker 4', speaker_id: 'spk_004', text: 'Hello', confidence: 0.9 },
        { start: 1.1, end: 2, speaker: 'Speaker 2', speaker_id: 'spk_002', text: 'Hi', confidence: 0.82 },
        { start: 2.1, end: 3, speaker: 'Speaker 4', speaker_id: 'spk_004', text: 'Back again', confidence: 0.88 }
      ],
      speaker_profiles: [
        {
          speaker_id: 'spk_004',
          label: 'Speaker 4',
          grounded: {
            confidence: 0.83,
            linked_segment_indexes: [4, 12],
            acoustic_descriptors: [
              { label: 'calm, measured delivery', confidence: 0.62 }
            ]
          },
          inferred_traits: {
            traits: []
          }
        }
      ],
      summary: 'Chunk summary',
      totalDuration: 3
    }
  });

  assert.equal(result.valid, true);
  assert.deepEqual(result.normalizedValue.speaker_profiles.find((profile) => profile.speaker_id === 'spk_004').grounded.linked_segment_indexes, [0, 2]);
});

test('dialogue transcription validator drops orphaned profiles and derives grounded confidence from linked segments when needed', () => {
  const result = executeDialogueTranscriptionValidatorTool({
    transcription: {
      dialogue_segments: [
        { start: 0, end: 1, speaker: 'Speaker 1', speaker_id: 'spk_001', text: 'Hello', confidence: 0.9 },
        { start: 1.2, end: 2.2, speaker: 'Speaker 1', speaker_id: 'spk_001', text: 'Again', confidence: 0.7 }
      ],
      speaker_profiles: [
        {
          speaker_id: 'spk_001',
          label: 'Speaker 1',
          grounded: {
            linked_segment_indexes: [0, 1],
            acoustic_descriptors: [
              { label: 'steady, measured delivery', confidence: 0.62 }
            ]
          },
          inferred_traits: { traits: [] }
        },
        {
          speaker_id: 'spk_999',
          label: 'Ghost Speaker',
          grounded: {
            confidence: 0.5,
            linked_segment_indexes: [4],
            acoustic_descriptors: []
          },
          inferred_traits: { traits: [] }
        }
      ],
      summary: 'Chunk summary',
      totalDuration: 3
    }
  });

  assert.equal(result.valid, true);
  assert.deepEqual(result.normalizedValue.speaker_profiles.map((profile) => profile.speaker_id), ['spk_001']);
  assert.equal(result.normalizedValue.speaker_profiles[0].grounded.confidence, 0.8);
  assert.deepEqual(Object.keys(result.normalizedValue.speaker_profiles[0].grounded).sort(), ['acoustic_descriptors', 'confidence', 'linked_segment_indexes']);
});

test('dialogue stitch validator tool validates stitched transcript payloads', () => {
  const contract = buildDialogueStitchValidatorToolContract();
  assert.equal(contract.name, 'validate_dialogue_stitch_json');

  const result = executeDialogueStitchValidatorTool({
    stitch: {
      cleanedTranscript: 'Speaker 1: Hello',
      auditTrail: [{ op: 'merge_boundary', chunkIndex: 0, detail: 'Removed duplicate.' }],
      debug: { inputKind: 'dialogue.stitch.input', inputChunks: 1, notes: 'ok', refs: [] }
    }
  });

  assert.equal(result.valid, true);
  assert.equal(result.normalizedValue.cleanedTranscript, 'Speaker 1: Hello');
});

test('music analysis validator tool enforces analysis envelope', () => {
  const contract = buildMusicAnalysisValidatorToolContract();
  assert.equal(contract.name, 'validate_music_analysis_json');
  assert.equal(contract.argumentKey, 'musicAnalysis');

  const invalid = executeMusicAnalysisValidatorTool({
    musicAnalysis: {
      analysis: {
        type: 'music'
      }
    }
  });
  assert.equal(invalid.valid, false);
  assert.match(invalid.summary, /description/i);

  const valid = executeMusicAnalysisValidatorTool({
    musicAnalysis: {
      analysis: {
        type: 'music',
        description: 'Bright synth pop bed.',
        mood: 'energetic',
        intensity: 7
      },
      rollingSummary: 'Still upbeat.'
    }
  });
  assert.equal(valid.valid, true);
  assert.equal(valid.normalizedValue.analysis.type, 'music');
});
