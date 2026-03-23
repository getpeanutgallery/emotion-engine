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
  assert.ok(contract.canonicalEnvelope.transcription.handoffContext);
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
            ],
            acoustic_descriptors_abstained: false
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
  assert.equal(Object.hasOwn(result.normalizedValue.speaker_profiles[0].grounded, 'acoustic_descriptors_abstained'), false);
  assert.equal(Object.hasOwn(result.normalizedValue.speaker_profiles[0].grounded, 'confidence_abstained'), false);
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
            ],
            acoustic_descriptors_abstained: false
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
  assert.equal(Object.hasOwn(result.normalizedValue.speaker_profiles[0].grounded, 'confidence_abstained'), false);
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
