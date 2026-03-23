const {
  validateDialogueTranscriptionObject,
  validateDialogueStitchObject,
  validateMusicAnalysisObject
} = require('./structured-output.cjs');

const DIALOGUE_TRANSCRIPTION_TOOL_NAME = 'validate_dialogue_transcription_json';
const DIALOGUE_STITCH_TOOL_NAME = 'validate_dialogue_stitch_json';
const MUSIC_ANALYSIS_TOOL_NAME = 'validate_music_analysis_json';

function buildContract({ name, description, argumentKey, candidateDescription, example }) {
  return {
    name,
    argumentKey,
    description,
    canonicalEnvelope: {
      tool: name,
      [argumentKey]: example
    },
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      required: [argumentKey],
      properties: {
        [argumentKey]: {
          type: 'object',
          description: candidateDescription
        }
      }
    }
  };
}

function normalizeObjectArgument(args, argumentKey) {
  if (!args || typeof args !== 'object' || Array.isArray(args)) {
    return {
      ok: false,
      errors: [{ path: '$', code: 'invalid_tool_arguments', message: `Tool arguments must be a JSON object containing ${argumentKey}.` }]
    };
  }

  const value = args[argumentKey];
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {
      ok: false,
      errors: [{ path: `$.${argumentKey}`, code: 'invalid_tool_arguments', message: `${argumentKey} must be a JSON object.` }]
    };
  }

  return {
    ok: true,
    value: { [argumentKey]: value }
  };
}

function buildToolResult({ validation, toolName, invalidArgsSummary }) {
  if (!validation) {
    return {
      ok: false,
      valid: false,
      toolName,
      summary: invalidArgsSummary,
      errors: [],
      normalizedValue: null
    };
  }

  return {
    ok: validation.ok,
    valid: validation.ok,
    toolName,
    summary: validation.ok
      ? 'JSON is valid. The validator returned valid=true. Return the final JSON artifact with no wrapper.'
      : validation.summary,
    errors: validation.errors,
    normalizedValue: validation.ok ? validation.value : null
  };
}

function buildDialogueTranscriptionValidatorToolContract({ requireHandoff = false } = {}) {
  return buildContract({
    name: DIALOGUE_TRANSCRIPTION_TOOL_NAME,
    argumentKey: 'transcription',
    description: 'Validate a Phase 1 dialogue transcription JSON candidate against the required local schema before final submission.',
    candidateDescription: requireHandoff
      ? 'Candidate dialogue transcription JSON with dialogue_segments, optional speaker_profiles, summary, handoffContext, and totalDuration.'
      : 'Candidate dialogue transcription JSON with dialogue_segments, optional speaker_profiles, summary, and totalDuration.',
    example: {
      dialogue_segments: [
        {
          start: 0,
          end: 1.2,
          speaker: 'Speaker 1',
          speaker_id: 'spk_001',
          text: 'Hello there',
          confidence: 0.95
        }
      ],
      speaker_profiles: [
        {
          speaker_id: 'spk_001',
          label: 'Speaker 1',
          grounded: {
            confidence: 0.82,
            linked_segment_indexes: [0],
            acoustic_descriptors: [
              {
                label: 'steady, conversational delivery',
                confidence: 0.61
              }
            ],
            acoustic_descriptors_abstained: false
          },
          inferred_traits: {
            traits: [
              {
                trait: 'accent',
                value: 'possibly mid-Atlantic American English',
                confidence: 0.31,
                note: 'speculative inference from delivery only'
              }
            ]
          }
        }
      ],
      summary: 'Short summary of the dialogue.',
      ...(requireHandoff ? { handoffContext: 'Short continuity handoff for the next chunk.' } : {}),
      totalDuration: 10.5
    }
  });
}

function executeDialogueTranscriptionValidatorTool(args, { requireHandoff = false } = {}) {
  const normalizedArgs = normalizeObjectArgument(args, 'transcription');
  if (!normalizedArgs.ok) {
    return {
      ok: false,
      valid: false,
      toolName: DIALOGUE_TRANSCRIPTION_TOOL_NAME,
      summary: 'Tool arguments were invalid. Provide {"transcription": {...}}.',
      errors: normalizedArgs.errors,
      normalizedValue: null
    };
  }

  const validation = validateDialogueTranscriptionObject(normalizedArgs.value.transcription, { requireHandoff });
  return buildToolResult({
    validation,
    toolName: DIALOGUE_TRANSCRIPTION_TOOL_NAME,
    invalidArgsSummary: 'Tool arguments were invalid. Provide {"transcription": {...}}.'
  });
}

function buildDialogueStitchValidatorToolContract() {
  return buildContract({
    name: DIALOGUE_STITCH_TOOL_NAME,
    argumentKey: 'stitch',
    description: 'Validate a Phase 1 dialogue stitch JSON candidate against the required local schema before final submission.',
    candidateDescription: 'Candidate dialogue stitch JSON with cleanedTranscript, auditTrail, and optional debug payload.',
    example: {
      cleanedTranscript: 'Speaker 1: Hello\nSpeaker 2: Hi',
      auditTrail: [
        { op: 'merge_boundary', chunkIndex: 0, detail: 'Removed duplicated phrase at a boundary.' }
      ],
      debug: {
        inputKind: 'dialogue.stitch.input',
        inputChunks: 2,
        notes: 'No major issues.',
        refs: []
      }
    }
  });
}

function executeDialogueStitchValidatorTool(args) {
  const normalizedArgs = normalizeObjectArgument(args, 'stitch');
  if (!normalizedArgs.ok) {
    return {
      ok: false,
      valid: false,
      toolName: DIALOGUE_STITCH_TOOL_NAME,
      summary: 'Tool arguments were invalid. Provide {"stitch": {...}}.',
      errors: normalizedArgs.errors,
      normalizedValue: null
    };
  }

  const validation = validateDialogueStitchObject(normalizedArgs.value.stitch);
  return buildToolResult({
    validation,
    toolName: DIALOGUE_STITCH_TOOL_NAME,
    invalidArgsSummary: 'Tool arguments were invalid. Provide {"stitch": {...}}.'
  });
}

function buildMusicAnalysisValidatorToolContract() {
  return buildContract({
    name: MUSIC_ANALYSIS_TOOL_NAME,
    argumentKey: 'musicAnalysis',
    description: 'Validate a Phase 1 music analysis JSON candidate against the required local schema before final submission.',
    candidateDescription: 'Candidate music analysis JSON with analysis.type, analysis.description, optional analysis.mood, analysis.intensity, and optional rollingSummary.',
    example: {
      analysis: {
        type: 'music',
        description: 'Upbeat instrumental pop bed.',
        mood: 'energetic',
        intensity: 7
      },
      rollingSummary: 'The audio stays upbeat and music-led so far.'
    }
  });
}

function executeMusicAnalysisValidatorTool(args) {
  const normalizedArgs = normalizeObjectArgument(args, 'musicAnalysis');
  if (!normalizedArgs.ok) {
    return {
      ok: false,
      valid: false,
      toolName: MUSIC_ANALYSIS_TOOL_NAME,
      summary: 'Tool arguments were invalid. Provide {"musicAnalysis": {...}}.',
      errors: normalizedArgs.errors,
      normalizedValue: null
    };
  }

  const validation = validateMusicAnalysisObject(normalizedArgs.value.musicAnalysis);
  return buildToolResult({
    validation,
    toolName: MUSIC_ANALYSIS_TOOL_NAME,
    invalidArgsSummary: 'Tool arguments were invalid. Provide {"musicAnalysis": {...}}.'
  });
}

module.exports = {
  DIALOGUE_TRANSCRIPTION_TOOL_NAME,
  DIALOGUE_STITCH_TOOL_NAME,
  MUSIC_ANALYSIS_TOOL_NAME,
  buildDialogueTranscriptionValidatorToolContract,
  executeDialogueTranscriptionValidatorTool,
  buildDialogueStitchValidatorToolContract,
  executeDialogueStitchValidatorTool,
  buildMusicAnalysisValidatorToolContract,
  executeMusicAnalysisValidatorTool
};
