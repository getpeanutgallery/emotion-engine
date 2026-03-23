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

function validateOptionalNonEmptyString(value, path, label, errors) {
  if (value === undefined || value === null || value === '') return null;
  return validateNonEmptyString(value, path, label, errors);
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

function validateOptionalFiniteNumber(value, path, label, errors, range = {}) {
  if (value === undefined || value === null) return null;
  return validateFiniteNumber(value, path, label, errors, range);
}

function validateBoolean(value, path, label, errors) {
  if (typeof value !== 'boolean') {
    pushError(errors, path, 'required_boolean', `${label} must be a boolean.`);
    return null;
  }
  return value;
}

function validateOptionalBoolean(value, path, label, errors) {
  if (value === undefined || value === null) return null;
  return validateBoolean(value, path, label, errors);
}

function summarizeValidationErrors(prefix, errors = []) {
  if (!Array.isArray(errors) || errors.length === 0) return null;
  const parts = errors.slice(0, 6).map((error) => `${error.path}: ${error.message}`);
  const suffix = errors.length > 6 ? ` (+${errors.length - 6} more)` : '';
  return `${prefix} ${parts.join(' | ')}${suffix} Return corrected JSON only.`;
}

function buildAnonymousSpeakerId(index) {
  return `spk_${String(index + 1).padStart(3, '0')}`;
}

function normalizeSpeakerId(value) {
  const normalized = compactString(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return normalized || null;
}

function validateAcousticDescriptors(input, errors, path) {
  if (input === undefined || input === null) return [];

  if (!Array.isArray(input)) {
    pushError(errors, path, 'required_array', 'acoustic_descriptors must be an array.');
    return [];
  }

  return input.map((entry, index) => {
    const itemPath = `${path}[${index}]`;
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      pushError(errors, itemPath, 'invalid_type', 'acoustic_descriptors entries must be objects.');
      return null;
    }

    return {
      label: validateNonEmptyString(entry.label ?? entry.descriptor, `${itemPath}.label`, 'acoustic descriptor label', errors),
      confidence: validateOptionalFiniteNumber(entry.confidence, `${itemPath}.confidence`, 'acoustic descriptor confidence', errors, { min: 0, max: 1 })
    };
  }).filter(Boolean);
}

function validateInferredTraits(input, errors, path = '$.inferred_traits') {
  if (input === undefined || input === null) {
    return {
      traits: []
    };
  }

  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    pushError(errors, path, 'invalid_type', 'inferred_traits must be an object.');
    return {
      traits: []
    };
  }

  const traitsInput = input.traits ?? input.values ?? [];
  let traits = [];
  if (!Array.isArray(traitsInput)) {
    pushError(errors, `${path}.traits`, 'required_array', 'inferred_traits.traits must be an array.');
  } else {
    traits = traitsInput.map((entry, index) => {
      const itemPath = `${path}.traits[${index}]`;
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
        pushError(errors, itemPath, 'invalid_type', 'inferred trait entries must be objects.');
        return null;
      }

      return {
        trait: validateNonEmptyString(entry.trait ?? entry.key, `${itemPath}.trait`, 'inferred trait name', errors),
        value: validateNonEmptyString(entry.value, `${itemPath}.value`, 'inferred trait value', errors),
        confidence: validateOptionalFiniteNumber(entry.confidence, `${itemPath}.confidence`, 'inferred trait confidence', errors, { min: 0, max: 1 }),
        note: validateOptionalNonEmptyString(entry.note, `${itemPath}.note`, 'inferred trait note', errors)
      };
    }).filter(Boolean);
  }

  return {
    traits
  };
}

function validateGroundedSpeakerProfile(input, errors, path = '$.grounded') {
  if (input === undefined || input === null) {
    return {
      confidence: null,
      linked_segment_indexes: [],
      acoustic_descriptors: []
    };
  }

  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    pushError(errors, path, 'invalid_type', 'grounded must be an object.');
    return {
      confidence: null,
      linked_segment_indexes: [],
      acoustic_descriptors: []
    };
  }

  const linkedSegmentIndexesInput = input.linked_segment_indexes ?? input.linkedSegmentIndexes ?? [];
  let linked_segment_indexes = [];
  if (!Array.isArray(linkedSegmentIndexesInput)) {
    pushError(errors, `${path}.linked_segment_indexes`, 'required_array', 'linked_segment_indexes must be an array.');
  } else {
    linked_segment_indexes = linkedSegmentIndexesInput.map((value, index) => {
      const itemPath = `${path}.linked_segment_indexes[${index}]`;
      return validateFiniteNumber(value, itemPath, 'linked segment index', errors, { min: 0 });
    }).filter((value) => value !== null).map((value) => Math.trunc(value));
  }

  const acoustic_descriptors = validateAcousticDescriptors(
    input.acoustic_descriptors ?? input.acousticDescriptors,
    errors,
    `${path}.acoustic_descriptors`
  );

  const confidence = validateOptionalFiniteNumber(input.confidence, `${path}.confidence`, 'grounded confidence', errors, { min: 0, max: 1 });
  const acousticAbstainedInput = input.acoustic_descriptors_abstained ?? input.acousticDescriptorsAbstained;
  if (acousticAbstainedInput !== undefined && acousticAbstainedInput !== null) {
    validateOptionalBoolean(acousticAbstainedInput, `${path}.acoustic_descriptors_abstained`, 'acoustic descriptors abstained', errors);
  }

  return {
    confidence,
    linked_segment_indexes,
    acoustic_descriptors
  };
}

function validateSpeakerProfiles(profiles, errors, path = '$.speaker_profiles') {
  if (profiles === undefined || profiles === null) return [];

  if (!Array.isArray(profiles)) {
    pushError(errors, path, 'required_array', 'speaker_profiles must be an array.');
    return [];
  }

  return profiles.map((profile, index) => {
    const itemPath = `${path}[${index}]`;
    if (!profile || typeof profile !== 'object' || Array.isArray(profile)) {
      pushError(errors, itemPath, 'invalid_type', 'speaker_profiles entries must be objects.');
      return null;
    }

    const speaker_id = validateOptionalNonEmptyString(
      profile.speaker_id ?? profile.speakerId,
      `${itemPath}.speaker_id`,
      'speaker profile speaker_id',
      errors
    );

    const label = validateOptionalNonEmptyString(
      profile.label ?? profile.speaker ?? profile.name,
      `${itemPath}.label`,
      'speaker profile label',
      errors
    );

    return {
      speaker_id: speaker_id || null,
      label: label || null,
      grounded: validateGroundedSpeakerProfile(profile.grounded ?? profile.grounding, errors, `${itemPath}.grounded`),
      inferred_traits: validateInferredTraits(profile.inferred_traits ?? profile.inferredTraits, errors, `${itemPath}.inferred_traits`)
    };
  }).filter(Boolean);
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

    const speaker = validateNonEmptyString(segment.speaker, `${itemPath}.speaker`, 'dialogue segment speaker', errors) ?? 'Speaker 1';
    const speaker_id = validateOptionalNonEmptyString(
      segment.speaker_id ?? segment.speakerId,
      `${itemPath}.speaker_id`,
      'dialogue segment speaker_id',
      errors
    );

    const providedIndex = segment.index ?? segment.segment_index ?? segment.segmentIndex;
    if (providedIndex !== undefined && providedIndex !== null) {
      validateFiniteNumber(providedIndex, `${itemPath}.index`, 'dialogue segment index', errors, { min: 0 });
    }

    return {
      start: validateFiniteNumber(segment.start, `${itemPath}.start`, 'dialogue segment start', errors, { min: 0 }) ?? 0,
      end: validateFiniteNumber(segment.end, `${itemPath}.end`, 'dialogue segment end', errors, { min: 0 }) ?? 0,
      speaker,
      speaker_id: speaker_id || null,
      text: validateNonEmptyString(segment.text, `${itemPath}.text`, 'dialogue segment text', errors) ?? '',
      confidence: validateFiniteNumber(segment.confidence, `${itemPath}.confidence`, 'dialogue segment confidence', errors, { min: 0, max: 1 }) ?? 0
    };
  }).filter(Boolean);
}

const GENERIC_SPEAKER_LABEL_RE = /^speaker\s+\d+$/i;

function isGenericSpeakerLabel(label) {
  return GENERIC_SPEAKER_LABEL_RE.test(compactString(label));
}

function choosePreferredSpeakerLabel(currentLabel, candidateLabel) {
  const current = compactString(currentLabel);
  const candidate = compactString(candidateLabel);

  if (!candidate) return current || null;
  if (!current) return candidate;

  const currentIsGeneric = isGenericSpeakerLabel(current);
  const candidateIsGeneric = isGenericSpeakerLabel(candidate);

  if (currentIsGeneric && !candidateIsGeneric) return candidate;
  return current;
}

function dedupeAcousticDescriptors(descriptors = []) {
  const byKey = new Map();

  for (const descriptor of Array.isArray(descriptors) ? descriptors : []) {
    if (!descriptor || typeof descriptor !== 'object' || Array.isArray(descriptor)) continue;
    const label = compactString(descriptor.label);
    if (!label) continue;
    const key = label.toLowerCase();
    const existing = byKey.get(key);

    if (!existing || ((descriptor.confidence ?? -1) > (existing.confidence ?? -1))) {
      byKey.set(key, {
        label,
        confidence: typeof descriptor.confidence === 'number' && Number.isFinite(descriptor.confidence)
          ? descriptor.confidence
          : null
      });
    }
  }

  return Array.from(byKey.values());
}

function dedupeInferredTraits(traits = []) {
  const byKey = new Map();

  for (const trait of Array.isArray(traits) ? traits : []) {
    if (!trait || typeof trait !== 'object' || Array.isArray(trait)) continue;
    const traitName = compactString(trait.trait);
    const traitValue = compactString(trait.value);
    if (!traitName || !traitValue) continue;
    const key = `${traitName.toLowerCase()}::${traitValue.toLowerCase()}`;
    const existing = byKey.get(key);

    if (!existing || ((trait.confidence ?? -1) > (existing.confidence ?? -1))) {
      byKey.set(key, {
        trait: traitName,
        value: traitValue,
        confidence: typeof trait.confidence === 'number' && Number.isFinite(trait.confidence)
          ? trait.confidence
          : null,
        note: compactString(trait.note) || null
      });
    }
  }

  return Array.from(byKey.values());
}

function createNormalizedSpeakerProfileState({ speaker_id, label = null, grounded = null, inferred_traits = null } = {}) {
  return {
    speaker_id,
    label: compactString(label) || null,
    grounded: {
      confidence: typeof grounded?.confidence === 'number' && Number.isFinite(grounded.confidence)
        ? grounded.confidence
        : null,
      linked_segment_indexes: [],
      acoustic_descriptors: dedupeAcousticDescriptors(grounded?.acoustic_descriptors)
    },
    inferred_traits: {
      traits: dedupeInferredTraits(inferred_traits?.traits)
    },
    _segment_confidences: []
  };
}

function mergeSpeakerProfileState(target, incoming) {
  if (!target) return createNormalizedSpeakerProfileState(incoming);
  if (!incoming) return target;

  target.label = choosePreferredSpeakerLabel(target.label, incoming.label);

  const incomingConfidence = incoming.grounded?.confidence;
  if ((target.grounded.confidence === null || target.grounded.confidence === undefined) && incomingConfidence !== null && incomingConfidence !== undefined) {
    target.grounded.confidence = incomingConfidence;
  }

  target.grounded.acoustic_descriptors = dedupeAcousticDescriptors([
    ...target.grounded.acoustic_descriptors,
    ...(incoming.grounded?.acoustic_descriptors || [])
  ]);
  target.inferred_traits.traits = dedupeInferredTraits([
    ...target.inferred_traits.traits,
    ...(incoming.inferred_traits?.traits || [])
  ]);
  target._segment_confidences = [
    ...(Array.isArray(target._segment_confidences) ? target._segment_confidences : []),
    ...(Array.isArray(incoming._segment_confidences) ? incoming._segment_confidences : [])
  ].filter((value) => typeof value === 'number' && Number.isFinite(value));

  return target;
}

function deriveGroundedProfileConfidence(profile) {
  const explicitConfidence = profile?.grounded?.confidence;
  if (typeof explicitConfidence === 'number' && Number.isFinite(explicitConfidence)) {
    return Math.min(1, Math.max(0, explicitConfidence));
  }

  const segmentConfidences = Array.isArray(profile?._segment_confidences)
    ? profile._segment_confidences.filter((value) => typeof value === 'number' && Number.isFinite(value))
    : [];

  if (segmentConfidences.length === 0) return 0;

  const averageConfidence = segmentConfidences.reduce((sum, value) => sum + value, 0) / segmentConfidences.length;
  return Math.min(1, Math.max(0, Number(averageConfidence.toFixed(4))));
}

function normalizeDialogueSpeakerContract(dialogue_segments, speaker_profiles = []) {
  const profilesById = new Map();
  const speakerIdByLabel = new Map();
  const generatedIdsByLabel = new Map();
  let nextGeneratedIndex = 0;

  for (const profile of speaker_profiles) {
    const normalizedId = normalizeSpeakerId(profile.speaker_id) || (profile.label ? generatedIdsByLabel.get(profile.label) : null) || null;
    if (!normalizedId && !profile.label) continue;

    const speaker_id = normalizedId || buildAnonymousSpeakerId(nextGeneratedIndex++);
    const label = compactString(profile.label) || `Speaker ${nextGeneratedIndex}`;

    if (!generatedIdsByLabel.has(label)) generatedIdsByLabel.set(label, speaker_id);
    speakerIdByLabel.set(label, speaker_id);

    const existing = profilesById.get(speaker_id) || null;
    profilesById.set(speaker_id, mergeSpeakerProfileState(existing, createNormalizedSpeakerProfileState({
      speaker_id,
      label,
      grounded: profile.grounded,
      inferred_traits: profile.inferred_traits
    })));
  }

  const normalizedSegments = dialogue_segments.map((segment, index) => {
    const explicitId = normalizeSpeakerId(segment.speaker_id);
    const label = compactString(segment.speaker) || 'Speaker 1';
    let speaker_id = explicitId || speakerIdByLabel.get(label) || generatedIdsByLabel.get(label);

    if (!speaker_id) {
      speaker_id = buildAnonymousSpeakerId(nextGeneratedIndex++);
      generatedIdsByLabel.set(label, speaker_id);
      speakerIdByLabel.set(label, speaker_id);
    }

    let profile = profilesById.get(speaker_id);
    if (!profile) {
      profile = createNormalizedSpeakerProfileState({ speaker_id, label });
      profilesById.set(speaker_id, profile);
    }

    profile.label = choosePreferredSpeakerLabel(profile.label, label);
    profile.grounded.linked_segment_indexes.push(index);
    profile._segment_confidences.push(segment.confidence);

    const normalizedLabel = compactString(profile.label) || label;
    if (!speakerIdByLabel.has(normalizedLabel)) speakerIdByLabel.set(normalizedLabel, speaker_id);

    return {
      ...segment,
      index,
      speaker: normalizedLabel,
      speaker_id
    };
  });

  const normalizedProfiles = Array.from(profilesById.values())
    .map((profile) => ({
      speaker_id: profile.speaker_id,
      label: profile.label || `Speaker ${profile.speaker_id}`,
      grounded: {
        confidence: deriveGroundedProfileConfidence(profile),
        linked_segment_indexes: Array.from(new Set(profile.grounded.linked_segment_indexes)).sort((a, b) => a - b),
        acoustic_descriptors: dedupeAcousticDescriptors(profile.grounded.acoustic_descriptors)
      },
      inferred_traits: {
        traits: dedupeInferredTraits(profile.inferred_traits.traits)
      }
    }))
    .filter((profile) => profile.grounded.linked_segment_indexes.length > 0)
    .sort((a, b) => a.speaker_id.localeCompare(b.speaker_id));

  return {
    dialogue_segments: normalizedSegments,
    speaker_profiles: normalizedProfiles
  };
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
  const speaker_profiles = validateSpeakerProfiles(input.speaker_profiles ?? input.speakerProfiles, errors);
  const summary = validateNonEmptyString(input.summary, '$.summary', 'summary', errors);
  const totalDuration = validateFiniteNumber(input.totalDuration, '$.totalDuration', 'totalDuration', errors, { min: 0 });

  const handoffValue = input.handoffContext ?? input.handoff;
  let handoffContext = null;
  if (handoffValue !== undefined && handoffValue !== null) {
    handoffContext = validateNonEmptyString(handoffValue, '$.handoffContext', 'handoffContext', errors);
  } else if (requireHandoff) {
    pushError(errors, '$.handoffContext', 'required_string', 'handoffContext must be a non-empty string.');
  }

  if (errors.length > 0) {
    return {
      ok: false,
      value: null,
      errors,
      summary: summarizeValidationErrors('Dialogue JSON validation failed.', errors),
      meta: { stage: 'validation' }
    };
  }

  const normalizedSpeakerContract = normalizeDialogueSpeakerContract(dialogue_segments, speaker_profiles);

  return {
    ok: true,
    value: {
      dialogue_segments: normalizedSpeakerContract.dialogue_segments,
      speaker_profiles: normalizedSpeakerContract.speaker_profiles,
      summary,
      totalDuration,
      handoffContext: handoffContext || null
    },
    errors: [],
    summary: null,
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
  normalizeDialogueSpeakerContract,
  validateDialogueTranscriptionObject,
  validateDialogueStitchObject,
  validateMusicAnalysisObject,
  validateEmotionStateObject
};
