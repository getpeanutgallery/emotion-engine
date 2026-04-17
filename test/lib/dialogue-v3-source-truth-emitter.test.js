const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildDialogueV3SourceTruth
} = require('../../server/lib/dialogue-v3-source-truth-emitter.cjs');
const {
  validateDialogueV3SourceTruthObject
} = require('../../server/lib/dialogue-v3-source-truth-validator.cjs');

test('dialogue v3 source-truth emitter derives validator-compatible per-line traits from runtime dialogue artifacts', () => {
  const dialogueData = {
    summary: 'Runtime dialogue artifact',
    dialogue_segments: [
      {
        index: 0,
        speaker: 'Commander',
        speaker_id: 'spk_001',
        text: 'Move now, squad up!',
        confidence: 0.97
      },
      {
        index: 1,
        speaker: 'Speaker 2',
        speaker_id: 'spk_002',
        text: '[laughs] You missed me.',
        confidence: 0.61
      }
    ],
    speaker_profiles: [
      {
        speaker_id: 'spk_001',
        label: 'Commander',
        grounded: {
          confidence: 0.88,
          linked_segment_indexes: [0],
          acoustic_descriptors: [
            { label: 'older, authoritative public-address male voice with close-mic radio texture', confidence: 0.92 },
            { label: 'steady, resolute delivery', confidence: 0.74 }
          ]
        },
        inferred_traits: {
          traits: [
            { trait: 'accent', value: 'possibly Southern US', confidence: 0.33, note: 'speculative' }
          ]
        }
      },
      {
        speaker_id: 'spk_002',
        label: 'Speaker 2',
        grounded: {
          confidence: 0.71,
          linked_segment_indexes: [1],
          acoustic_descriptors: [
            { label: 'high feminine laughing voice under music', confidence: 0.68 },
            { label: 'slight accent', confidence: 0.31 }
          ]
        },
        inferred_traits: {
          traits: [
            { trait: 'accent', value: 'possibly Spanish', confidence: 0.28, note: 'speculative' }
          ]
        }
      }
    ]
  };

  const emitted = buildDialogueV3SourceTruth(dialogueData);
  const validation = validateDialogueV3SourceTruthObject(emitted);

  assert.equal(validation.ok, true);
  assert.equal(emitted.contract.traits_contract_version, '3.0.0');
  assert.equal(emitted.dialogue_segments.length, 2);

  assert.deepEqual(emitted.dialogue_segments[0].traits, {
    audibility: 'clear',
    overlap: 'single_voice',
    gender_presentation: 'masculine',
    age_impression: 'older_adult',
    pitch_band: 'unknown',
    phonation: 'unknown',
    pace: 'unknown',
    energy: 'steady',
    transmission_medium: 'radio',
    spatial_texture: 'close',
    accent_strength: 'subtle_non_neutral',
    accent_family: 'anglophone_non_neutral',
    affect: 'determined',
    interpersonal_stance: 'performative',
    delivery_overlay: 'none_apparent'
  });

  assert.deepEqual(emitted.dialogue_segments[1].traits, {
    audibility: 'partially_masked',
    overlap: 'background_overlap',
    gender_presentation: 'feminine',
    age_impression: 'unknown',
    pitch_band: 'high',
    phonation: 'unknown',
    pace: 'unknown',
    energy: 'unknown',
    transmission_medium: 'direct',
    spatial_texture: 'room',
    accent_strength: 'subtle_non_neutral',
    accent_family: 'hispanic',
    affect: 'unknown',
    interpersonal_stance: 'neutral',
    delivery_overlay: 'laughing'
  });
});
