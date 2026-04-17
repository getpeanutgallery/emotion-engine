const test = require('node:test');
const assert = require('node:assert/strict');

const {
  TOOL_NAME,
  COMPATIBILITY_ADAPTERS,
  validateDialogueV3SourceTruthObject,
  parseDialogueV3SourceTruthResponse,
  buildDialogueV3SourceTruthValidatorToolContract,
  executeDialogueV3SourceTruthValidatorTool
} = require('../../server/lib/dialogue-v3-source-truth-validator.cjs');

function buildValidDialogueData() {
  return {
    schema_version: 1,
    contract: {
      artifact: 'dialogue-data',
      mode: 'traits',
      traits_contract_version: '3.0.0'
    },
    summary: 'A tense exchange with a clipped command over radio.',
    dialogue_segments: [
      {
        index: 0,
        text: 'Hold your fire until I say so.',
        traits: {
          audibility: 'clear',
          overlap: 'single_voice',
          gender_presentation: 'masculine',
          age_impression: 'adult',
          pitch_band: 'mid',
          phonation: 'clear',
          pace: 'measured',
          energy: 'steady',
          transmission_medium: 'radio',
          spatial_texture: 'room',
          accent_strength: 'none_apparent',
          accent_family: 'neutral_or_unmarked',
          affect: 'serious',
          interpersonal_stance: 'directive',
          delivery_overlay: 'none_apparent'
        }
      },
      {
        index: 1,
        text: 'Copy that.',
        traits: {
          audibility: 'clear',
          overlap: 'single_voice',
          gender_presentation: 'feminine',
          age_impression: 'adult',
          pitch_band: 'high',
          phonation: 'clear',
          pace: 'fast',
          energy: 'steady',
          transmission_medium: 'radio',
          spatial_texture: 'room',
          accent_strength: 'subtle_non_neutral',
          accent_family: 'anglophone_non_neutral',
          affect: 'determined',
          interpersonal_stance: 'supportive',
          delivery_overlay: 'none_apparent'
        }
      }
    ]
  };
}

test('validateDialogueV3SourceTruthObject accepts a contract-compliant authoritative v3 artifact', () => {
  const result = validateDialogueV3SourceTruthObject(buildValidDialogueData());

  assert.equal(result.ok, true);
  assert.equal(result.errors.length, 0);
  assert.equal(result.value.contract.traits_contract_version, '3.0.0');
  assert.equal(result.value.dialogue_segments[1].traits.accent_family, 'anglophone_non_neutral');
});

test('validateDialogueV3SourceTruthObject rejects required-field omissions and sequence drift', () => {
  const invalid = buildValidDialogueData();
  delete invalid.summary;
  delete invalid.dialogue_segments[0].traits.affect;
  invalid.dialogue_segments[1].index = 7;

  const result = validateDialogueV3SourceTruthObject(invalid);

  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.path === '$.summary' && error.code === 'required_field'));
  assert.ok(result.errors.some((error) => error.path === '$.dialogue_segments[0].traits.affect' && error.code === 'required_field'));
  assert.ok(result.errors.some((error) => error.path === '$.dialogue_segments[1].index' && error.code === 'invalid_sequence'));
});

test('validateDialogueV3SourceTruthObject rejects forbidden source-owned top-level and segment fields', () => {
  const invalid = buildValidDialogueData();
  invalid.handoffContext = 'Keep speaker continuity alive.';
  invalid.speaker_profiles = [];
  invalid.dialogue_segments[0].start = 1.25;
  invalid.dialogue_segments[0].speaker_id = 'spk_001';
  invalid.dialogue_segments[0].confidence = 0.98;

  const result = validateDialogueV3SourceTruthObject(invalid);

  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.path === '$.handoffContext' && error.code === 'forbidden_field'));
  assert.ok(result.errors.some((error) => error.path === '$.speaker_profiles' && error.code === 'forbidden_field'));
  assert.ok(result.errors.some((error) => error.path === '$.dialogue_segments[0].start' && error.code === 'forbidden_field'));
  assert.ok(result.errors.some((error) => error.path === '$.dialogue_segments[0].speaker_id' && error.code === 'forbidden_field'));
  assert.ok(result.errors.some((error) => error.path === '$.dialogue_segments[0].confidence' && error.code === 'forbidden_field'));
});

test('validateDialogueV3SourceTruthObject rejects superseded v2 trait field names unless the named adapter is explicitly enabled', () => {
  const invalid = buildValidDialogueData();
  invalid.dialogue_segments[0].traits.channel_texture = 'radio';
  invalid.dialogue_segments[0].traits.delivery_stance = 'directive';

  const strictResult = validateDialogueV3SourceTruthObject(invalid);
  assert.equal(strictResult.ok, false);
  assert.ok(strictResult.errors.some((error) => error.path === '$.dialogue_segments[0].traits.channel_texture' && error.code === 'superseded_normative_name'));
  assert.ok(strictResult.errors.some((error) => error.path === '$.dialogue_segments[0].traits.delivery_stance' && error.code === 'superseded_normative_name'));

  const adapterResult = validateDialogueV3SourceTruthObject(invalid, {
    compatibilityAdapter: 'v2-superseded-trait-names-bridge'
  });
  assert.equal(adapterResult.ok, true);
  assert.equal(Object.prototype.hasOwnProperty.call(adapterResult.value.dialogue_segments[0].traits, 'channel_texture'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(adapterResult.value.dialogue_segments[0].traits, 'delivery_stance'), false);
});

test('validateDialogueV3SourceTruthObject rejects superseded stored-v2 enum values with targeted diagnostics', () => {
  const invalid = buildValidDialogueData();
  invalid.dialogue_segments[0].traits.phonation = 'distorted';
  invalid.dialogue_segments[0].traits.accent_strength = 'mixed';
  invalid.dialogue_segments[0].traits.interpersonal_stance = 'sexual';

  const result = validateDialogueV3SourceTruthObject(invalid);

  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.path === '$.dialogue_segments[0].traits.phonation' && error.code === 'superseded_normative_name'));
  assert.ok(result.errors.some((error) => error.path === '$.dialogue_segments[0].traits.accent_strength' && error.code === 'superseded_normative_name'));
  assert.ok(result.errors.some((error) => error.path === '$.dialogue_segments[0].traits.interpersonal_stance' && error.code === 'superseded_normative_name'));
});

test('parseDialogueV3SourceTruthResponse carries parse metadata through validation', () => {
  const payload = JSON.stringify(buildValidDialogueData());
  const result = parseDialogueV3SourceTruthResponse(payload);

  assert.equal(result.ok, true);
  assert.equal(result.meta.stage, 'validation');
  assert.equal(result.meta.sourceType, 'string');
});

test('validator tool contract and executor expose the local validation seam', () => {
  const contract = buildDialogueV3SourceTruthValidatorToolContract();
  assert.equal(contract.name, TOOL_NAME);
  assert.deepEqual(contract.inputSchema.required, ['dialogueData']);
  assert.ok(COMPATIBILITY_ADAPTERS.has('v2-superseded-trait-names-bridge'));

  const valid = executeDialogueV3SourceTruthValidatorTool({
    dialogueData: buildValidDialogueData()
  });
  assert.equal(valid.ok, true);
  assert.equal(valid.valid, true);

  const invalid = executeDialogueV3SourceTruthValidatorTool({
    dialogueData: {
      schema_version: 2,
      contract: {
        artifact: 'dialogue-data',
        mode: 'traits',
        traits_contract_version: '3.0.0'
      },
      summary: 'bad schema version',
      dialogue_segments: []
    }
  });
  assert.equal(invalid.ok, false);
  assert.match(invalid.summary, /schema_version must be 1/);
});
