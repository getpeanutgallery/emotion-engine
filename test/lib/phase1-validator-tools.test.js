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
