const { parseJsonObjectInput } = require('./json-validator.cjs');

function compactString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function pushError(errors, path, code, message) {
  errors.push({ path, code, message });
}

function validateNonEmptyString(value, path, label, errors) {
  const normalized = compactString(value);
  if (!normalized) {
    pushError(errors, path, 'required_string', `${label} must be a non-empty string.`);
    return null;
  }
  return normalized;
}

function validateFiniteNumber(value, path, label, errors, { min = null, max = null } = {}) {
  if (typeof value !== 'number' || Number.isNaN(value) || !Number.isFinite(value)) {
    pushError(errors, path, 'required_number', `${label} must be a finite number.`);
    return null;
  }

  if (min !== null && value < min) {
    pushError(errors, path, 'out_of_range', `${label} must be >= ${min}.`);
    return null;
  }

  if (max !== null && value > max) {
    pushError(errors, path, 'out_of_range', `${label} must be <= ${max}.`);
    return null;
  }

  return value;
}

function summarizeValidationErrors(prefix, errors = []) {
  if (!Array.isArray(errors) || errors.length === 0) return null;
  const parts = errors.slice(0, 6).map((error) => `${error.path}: ${error.message}`);
  const suffix = errors.length > 6 ? ` (+${errors.length - 6} more)` : '';
  return `${prefix} ${parts.join(' | ')}${suffix} Return corrected JSON only.`;
}

function validateDialogueSegments(segments, errors, path = '$.dialogue_segments') {
  if (!Array.isArray(segments)) {
    pushError(errors, path, 'required_array', 'dialogue_segments must be an array.');
    return [];
  }

  return segments.map((segment, index) => {
    const itemPath = `${path}[${index}]`;
    if (!segment || typeof segment !== 'object' || Array.isArray(segment)) {
      pushError(errors, itemPath, 'invalid_type', 'Each dialogue segment must be an object.');
      return null;
    }

    return {
      start: validateFiniteNumber(segment.start, `${itemPath}.start`, 'dialogue segment start', errors, { min: 0 }) ?? 0,
      end: validateFiniteNumber(segment.end, `${itemPath}.end`, 'dialogue segment end', errors, { min: 0 }) ?? 0,
      speaker: validateNonEmptyString(segment.speaker, `${itemPath}.speaker`, 'dialogue segment speaker', errors) ?? 'Speaker 1',
      text: validateNonEmptyString(segment.text, `${itemPath}.text`, 'dialogue segment text', errors) ?? '',
      confidence: validateFiniteNumber(segment.confidence, `${itemPath}.confidence`, 'dialogue segment confidence', errors, { min: 0, max: 1 }) ?? 0
    };
  }).filter(Boolean);
}

function validateDialogueTranscriptionObject(input, { requireHandoff = false } = {}) {
  const errors = [];

  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return {
      ok: false,
      value: null,
      errors: [{ path: '$', code: 'invalid_type', message: 'Dialogue output must be a JSON object.' }],
      summary: 'Dialogue output must be a JSON object. Return corrected JSON only.',
      meta: { stage: 'validation' }
    };
  }

  const dialogue_segments = validateDialogueSegments(input.dialogue_segments, errors);
  const summary = validateNonEmptyString(input.summary, '$.summary', 'summary', errors);
  const totalDuration = validateFiniteNumber(input.totalDuration, '$.totalDuration', 'totalDuration', errors, { min: 0 });

  const handoffValue = input.handoffContext ?? input.handoff;
  let handoffContext = null;
  if (handoffValue !== undefined && handoffValue !== null) {
    handoffContext = validateNonEmptyString(handoffValue, '$.handoffContext', 'handoffContext', errors);
  } else if (requireHandoff) {
    pushError(errors, '$.handoffContext', 'required_string', 'handoffContext must be a non-empty string.');
  }

  return {
    ok: errors.length === 0,
    value: errors.length === 0 ? {
      dialogue_segments,
      summary,
      totalDuration,
      handoffContext: handoffContext || null
    } : null,
    errors,
    summary: summarizeValidationErrors('Dialogue JSON validation failed.', errors),
    meta: { stage: 'validation' }
  };
}

function validateDialogueStitchObject(input) {
  const errors = [];

  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return {
      ok: false,
      value: null,
      errors: [{ path: '$', code: 'invalid_type', message: 'Dialogue stitch output must be a JSON object.' }],
      summary: 'Dialogue stitch output must be a JSON object. Return corrected JSON only.',
      meta: { stage: 'validation' }
    };
  }

  const cleanedTranscript = validateNonEmptyString(input.cleanedTranscript, '$.cleanedTranscript', 'cleanedTranscript', errors);

  let auditTrail = [];
  if (!Array.isArray(input.auditTrail)) {
    pushError(errors, '$.auditTrail', 'required_array', 'auditTrail must be an array.');
  } else {
    auditTrail = input.auditTrail.map((entry, index) => {
      const entryPath = `$.auditTrail[${index}]`;
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
        pushError(errors, entryPath, 'invalid_type', 'auditTrail entries must be objects.');
        return null;
      }
      return {
        op: validateNonEmptyString(entry.op, `${entryPath}.op`, 'auditTrail op', errors),
        chunkIndex: entry.chunkIndex === undefined ? null : validateFiniteNumber(entry.chunkIndex, `${entryPath}.chunkIndex`, 'auditTrail chunkIndex', errors, { min: 0 }),
        detail: validateNonEmptyString(entry.detail, `${entryPath}.detail`, 'auditTrail detail', errors)
      };
    }).filter(Boolean);
  }

  const debug = (!input.debug || typeof input.debug !== 'object' || Array.isArray(input.debug))
    ? null
    : {
        inputKind: typeof input.debug.inputKind === 'string' ? input.debug.inputKind : null,
        inputChunks: typeof input.debug.inputChunks === 'number' ? input.debug.inputChunks : null,
        notes: typeof input.debug.notes === 'string' ? input.debug.notes : null,
        refs: Array.isArray(input.debug.refs) ? input.debug.refs : []
      };

  return {
    ok: errors.length === 0,
    value: errors.length === 0 ? {
      cleanedTranscript,
      auditTrail,
      debug
    } : null,
    errors,
    summary: summarizeValidationErrors('Dialogue stitch JSON validation failed.', errors),
    meta: { stage: 'validation' }
  };
}

function validateMusicAnalysisObject(input) {
  const errors = [];

  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return {
      ok: false,
      value: null,
      errors: [{ path: '$', code: 'invalid_type', message: 'Music output must be a JSON object.' }],
      summary: 'Music output must be a JSON object. Return corrected JSON only.',
      meta: { stage: 'validation' }
    };
  }

  const analysis = (input.analysis && typeof input.analysis === 'object' && !Array.isArray(input.analysis))
    ? input.analysis
    : input;

  const type = validateNonEmptyString(analysis.type, '$.analysis.type', 'analysis.type', errors);
  const description = validateNonEmptyString(analysis.description, '$.analysis.description', 'analysis.description', errors);
  const intensity = validateFiniteNumber(analysis.intensity, '$.analysis.intensity', 'analysis.intensity', errors, { min: 0, max: 10 });
  const mood = analysis.mood === undefined || analysis.mood === null
    ? null
    : validateNonEmptyString(analysis.mood, '$.analysis.mood', 'analysis.mood', errors);

  const rollingSummarySource = input.rollingSummary ?? input.rolling_summary ?? input.chunkSummary;
  const rollingSummary = rollingSummarySource === undefined || rollingSummarySource === null
    ? null
    : validateNonEmptyString(rollingSummarySource, '$.rollingSummary', 'rollingSummary', errors);

  return {
    ok: errors.length === 0,
    value: errors.length === 0 ? {
      analysis: {
        type,
        description,
        mood: mood || null,
        intensity
      },
      rollingSummary: rollingSummary || null
    } : null,
    errors,
    summary: summarizeValidationErrors('Music JSON validation failed.', errors),
    meta: { stage: 'validation' }
  };
}

function validateEmotionStateObject(input, lenses = []) {
  const errors = [];

  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return {
      ok: false,
      value: null,
      errors: [{ path: '$', code: 'invalid_type', message: 'Emotion analysis output must be a JSON object.' }],
      summary: 'Emotion analysis output must be a JSON object. Return corrected JSON only.',
      meta: { stage: 'validation' }
    };
  }

  const summary = validateNonEmptyString(input.summary, '$.summary', 'summary', errors);
  const dominantEmotion = validateNonEmptyString(input.dominant_emotion, '$.dominant_emotion', 'dominant_emotion', errors);
  const confidence = validateFiniteNumber(input.confidence, '$.confidence', 'confidence', errors, { min: 0, max: 1 });

  const emotionsInput = input.emotions;
  if (!emotionsInput || typeof emotionsInput !== 'object' || Array.isArray(emotionsInput)) {
    pushError(errors, '$.emotions', 'invalid_type', 'emotions must be an object keyed by lens.');
  }

  const emotions = {};
  for (const lens of lenses) {
    const lensPath = `$.emotions.${lens}`;
    const value = emotionsInput?.[lens];
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      pushError(errors, lensPath, 'invalid_type', `emotion entry for lens "${lens}" must be an object.`);
      continue;
    }

    emotions[lens] = {
      score: validateFiniteNumber(value.score, `${lensPath}.score`, `${lens} score`, errors, { min: 1, max: 10 }),
      reasoning: validateNonEmptyString(value.reasoning, `${lensPath}.reasoning`, `${lens} reasoning`, errors)
    };
  }

  return {
    ok: errors.length === 0,
    value: errors.length === 0 ? {
      summary,
      emotions,
      dominant_emotion: dominantEmotion,
      confidence
    } : null,
    errors,
    summary: summarizeValidationErrors('Emotion JSON validation failed.', errors),
    meta: { stage: 'validation' }
  };
}

function parseAndValidateJsonObject(input, validate) {
  const parsed = parseJsonObjectInput(input);
  if (!parsed.ok) return parsed;

  const validated = validate(parsed.value);
  if (!validated.ok) {
    return {
      ...validated,
      meta: {
        ...parsed.meta,
        ...validated.meta,
        raw: parsed.meta?.raw ?? null,
        extracted: parsed.meta?.extracted ?? null,
        repairApplied: parsed.meta?.repairApplied ?? false,
        sourceType: parsed.meta?.sourceType || 'unknown'
      }
    };
  }

  return {
    ok: true,
    value: validated.value,
    errors: [],
    summary: null,
    meta: {
      ...parsed.meta,
      stage: 'validation'
    }
  };
}

module.exports = {
  compactString,
  summarizeValidationErrors,
  parseAndValidateJsonObject,
  validateDialogueTranscriptionObject,
  validateDialogueStitchObject,
  validateMusicAnalysisObject,
  validateEmotionStateObject
};
