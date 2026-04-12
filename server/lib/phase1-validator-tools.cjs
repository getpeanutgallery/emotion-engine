const {
  validateDialogueTranscriptionObject,
  validateDialogueStitchObject,
  validateMusicAnalysisObject,
  validateMusicVocalsAnalysisObject
} = require('./structured-output.cjs');

const DIALOGUE_TRANSCRIPTION_TOOL_NAME = 'validate_dialogue_transcription_json';
const DIALOGUE_STITCH_TOOL_NAME = 'validate_dialogue_stitch_json';
const MUSIC_ANALYSIS_TOOL_NAME = 'validate_music_analysis_json';
const MUSIC_VOCALS_TOOL_NAME = 'validate_music_vocals_json';

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
    description: 'Validate a Phase 1 spoken-dialogue transcription JSON candidate against the required local schema before final submission.',
    candidateDescription: requireHandoff
      ? 'Candidate spoken-dialogue transcription JSON with dialogue_segments covering audible spoken words only, optional speaker_profiles, summary, handoffContext, optional per-segment timestamps, and additive analysis/provenance metadata. Grounded acoustic descriptors must use the canonical shape acoustic_descriptors: [{label, confidence?}] (label required; no descriptor/value aliases or string entries). Preserve short masked spoken fragments literally, preserve segment order via index chronology, split immediately at spoken-to-sung pivots, and never reconstruct lyric-like tails into polished dialogue text.'
      : 'Candidate spoken-dialogue transcription JSON with dialogue_segments covering audible spoken words only, optional speaker_profiles, summary, optional per-segment timestamps, and additive analysis/provenance metadata. Grounded acoustic descriptors must use the canonical shape acoustic_descriptors: [{label, confidence?}] (label required; no descriptor/value aliases or string entries). Preserve short masked spoken fragments literally, preserve segment order via index chronology, split immediately at spoken-to-sung pivots, and never reconstruct lyric-like tails into polished dialogue text.',
    example: {
      dialogue_segments: [
        {
          index: 0,
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
            ]
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
      analysisMode: requireHandoff ? 'chunked' : 'whole_asset',
      timingMode: requireHandoff ? 'chunk_local' : 'full_timeline',
      sourceStrategy: 'base64',
      coverage: {
        start: 0,
        end: 10.5,
        duration: 10.5,
        complete: true
      },
      provenance: {
        transportMode: 'inline',
        usedChunking: Boolean(requireHandoff),
        chunkCount: requireHandoff ? 1 : 0,
        fallbackApplied: false
      },
      qualityNotes: requireHandoff
        ? ['Chunk-local timing was preserved for downstream stitching.']
        : ['Whole-asset transcription preserved full-timeline timing.']
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
    description: 'Validate a Phase 1 music-lane JSON candidate against the required local schema before final submission.',
    candidateDescription: 'Candidate music-lane JSON with analysis.type, analysis.description, optional analysis.mood, analysis.intensity, optional rollingSummary, and optional famous-song grounding via recognizedSong + recognitionNotes. Keep this lane focused on coarse non-lexical music analysis, describe score even in mixed chunks, explicitly distinguish spoken-overlay from lyric-bearing music, and remember that spoken dialogue over score is not lyric evidence.',
    example: {
      analysis: {
        type: 'music',
        description: 'Upbeat instrumental pop bed.',
        mood: 'energetic',
        intensity: 7
      },
      rollingSummary: 'The audio stays upbeat and music-led so far.',
      recognizedSong: {
        status: 'possible',
        confidence: 0.64,
        candidates: [
          {
            title: 'Master of Puppets',
            artist: 'Metallica',
            confidence: 0.64,
            evidence: ['Distinctive thrash-metal hook and repeated master chant in the score-adjacent vocal layer.'],
            matchedLyrics: ['Master, master'],
            timeRanges: [
              { start: 76, end: 98 }
            ],
            ambiguity: 'Dialogue, SFX, and trailer editing partially mask the hook.'
          }
        ],
        primaryEvidence: 'A distinctive repeated hook aligns with a likely famous-song match, but masking prevents certainty.',
        ambiguity: 'Recognition remains evidence-gated and partially masked.',
        multipleSongsDetected: false
      },
      recognitionNotes: ['Do not treat spoken dialogue over score as lyric evidence.']
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

function buildMusicVocalsValidatorToolContract() {
  return buildContract({
    name: MUSIC_VOCALS_TOOL_NAME,
    argumentKey: 'musicVocals',
    description: 'Validate a Phase 1 music-vocals JSON candidate against the required local schema before final submission.',
    candidateDescription: 'Candidate music-vocals JSON with rollingSummary, vocalSummary, vocal_segments, optional famous-song grounding via recognizedSong + recognitionNotes, and optional qualityNotes. Preserve vocal_segments chronology by index/order first; array order/index is the truthful chronology signal for this lane. Use whole-asset context plus any high-confidence recognizedSong match as bounded recall scaffolding during chunk refinement, keep repeated hooks and reprises as distinct segments, prefer short literal fragments over polished wrong lyric variants when support is partial, reserve hybrid for truly inseparable mixed delivery, and remember that spoken dialogue over score is not lyric evidence.',
    example: {
      rollingSummary: 'A repeated sung hook dominates the music-led vocals so far.',
      vocalSummary: 'A repeated sung hook lands over the percussion.',
      vocal_segments: [
        {
          index: 0,
          text: 'We rise tonight',
          confidence: 0.91,
          performer: 'Vocalist 1',
          performer_id: 'voc_001',
          delivery: 'sung'
        }
      ],
      recognizedSong: {
        status: 'recognized',
        confidence: 0.93,
        candidates: [
          {
            title: 'Master of Puppets',
            artist: 'Metallica',
            confidence: 0.93,
            evidence: ['Literal lyric fragments match the heard refrain.'],
            matchedLyrics: ['Master, master', 'Obey your master']
          }
        ],
        primaryEvidence: 'Distinct lyric fragments and delivery strongly support one specific song.',
        multipleSongsDetected: false
      },
      recognitionNotes: ['Spoken dialogue elsewhere in the trailer was excluded from lyric evidence.'],
      qualityNotes: ['Crowd noise partially masks the tail of the final word.']
    }
  });
}

function executeMusicVocalsValidatorTool(args) {
  const normalizedArgs = normalizeObjectArgument(args, 'musicVocals');
  if (!normalizedArgs.ok) {
    return {
      ok: false,
      valid: false,
      toolName: MUSIC_VOCALS_TOOL_NAME,
      summary: 'Tool arguments were invalid. Provide {"musicVocals": {...}}.',
      errors: normalizedArgs.errors,
      normalizedValue: null
    };
  }

  const validation = validateMusicVocalsAnalysisObject(normalizedArgs.value.musicVocals);
  return buildToolResult({
    validation,
    toolName: MUSIC_VOCALS_TOOL_NAME,
    invalidArgsSummary: 'Tool arguments were invalid. Provide {"musicVocals": {...}}.'
  });
}

module.exports = {
  DIALOGUE_TRANSCRIPTION_TOOL_NAME,
  DIALOGUE_STITCH_TOOL_NAME,
  MUSIC_ANALYSIS_TOOL_NAME,
  MUSIC_VOCALS_TOOL_NAME,
  buildDialogueTranscriptionValidatorToolContract,
  executeDialogueTranscriptionValidatorTool,
  buildDialogueStitchValidatorToolContract,
  executeDialogueStitchValidatorTool,
  buildMusicAnalysisValidatorToolContract,
  executeMusicAnalysisValidatorTool,
  buildMusicVocalsValidatorToolContract,
  executeMusicVocalsValidatorTool
};
