const {
  parseJsonObjectInput,
  parseMinuteSecondTimestampToSeconds
} = require('./json-validator.cjs');
const { pushEnglishOnlyError } = require('./english-only-contract.cjs');

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

function validateDialogueTimestamp(value, path, label, errors, range = {}) {
  if (typeof value === 'string') {
    const normalized = parseMinuteSecondTimestampToSeconds(compactString(value));
    if (normalized !== null) {
      return validateFiniteNumber(normalized, path, label, errors, range);
    }
  }

  return validateFiniteNumber(value, path, label, errors, range);
}

function validateOptionalDialogueTimestamp(value, path, label, errors, range = {}) {
  if (value === undefined || value === null || value === '') return null;
  return validateDialogueTimestamp(value, path, label, errors, range);
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
      pushError(errors, itemPath, 'invalid_type', 'acoustic_descriptors entries must be objects with a non-empty label.');
      return null;
    }

    if (Object.prototype.hasOwnProperty.call(entry, 'descriptor')) {
      pushError(errors, `${itemPath}.descriptor`, 'invalid_key', 'Use acoustic_descriptors[*].label; descriptor is not allowed.');
    }

    if (Object.prototype.hasOwnProperty.call(entry, 'value')) {
      pushError(errors, `${itemPath}.value`, 'invalid_key', 'Use acoustic_descriptors[*].label; value is not allowed.');
    }

    return {
      label: validateNonEmptyString(entry.label, `${itemPath}.label`, 'acoustic descriptor label', errors),
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

  const acousticDescriptorInput = Object.prototype.hasOwnProperty.call(input, 'acoustic_descriptors')
    ? input.acoustic_descriptors
    : undefined;

  if (Object.prototype.hasOwnProperty.call(input, 'acousticDescriptors')) {
    pushError(errors, `${path}.acousticDescriptors`, 'invalid_key', 'Use grounded.acoustic_descriptors (snake_case) only; acousticDescriptors is not allowed.');
  }

  const acoustic_descriptors = validateAcousticDescriptors(
    acousticDescriptorInput,
    errors,
    `${path}.acoustic_descriptors`
  );

  const confidence = validateOptionalFiniteNumber(input.confidence, `${path}.confidence`, 'grounded confidence', errors, { min: 0, max: 1 });

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

    const start = validateOptionalDialogueTimestamp(segment.start, `${itemPath}.start`, 'dialogue segment start', errors, { min: 0 });
    const end = validateOptionalDialogueTimestamp(segment.end, `${itemPath}.end`, 'dialogue segment end', errors, { min: 0 });

    if (start !== null && end !== null && end <= start) {
      pushError(errors, itemPath, 'invalid_range', 'dialogue segment end must be greater than start when both timestamps are provided.');
    }

    return {
      ...(start !== null ? { start } : {}),
      ...(end !== null ? { end } : {}),
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

const DIALOGUE_ANALYSIS_MODES = new Set(['chunked', 'whole_asset', 'hybrid']);
const DIALOGUE_TIMING_MODES = new Set(['chunk_local', 'full_timeline']);
const DIALOGUE_SOURCE_STRATEGIES = new Set(['base64', 'public_url', 'file_handle', 'mixed']);
const DIALOGUE_TRANSPORT_MODES = new Set(['inline', 'remote_url']);

function validateOptionalEnumString(value, allowedValues, path, label, errors) {
  if (value === undefined || value === null || value === '') return null;
  const normalized = validateNonEmptyString(value, path, label, errors);
  if (!normalized) return null;
  if (!allowedValues.has(normalized)) {
    pushError(errors, path, 'invalid_value', `${label} must be one of: ${Array.from(allowedValues).join(', ')}.`);
    return null;
  }
  return normalized;
}

function validateDialogueCoverage(input, errors, path = '$.coverage') {
  if (input === undefined || input === null) return null;
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    pushError(errors, path, 'invalid_type', 'coverage must be an object.');
    return null;
  }

  const start = validateFiniteNumber(input.start, `${path}.start`, 'coverage.start', errors, { min: 0 });
  const end = validateFiniteNumber(input.end, `${path}.end`, 'coverage.end', errors, { min: 0 });
  const duration = validateFiniteNumber(input.duration, `${path}.duration`, 'coverage.duration', errors, { min: 0 });
  const complete = validateBoolean(input.complete, `${path}.complete`, 'coverage.complete', errors);

  return {
    start,
    end,
    duration,
    complete
  };
}

function validateDialogueProvenance(input, errors, path = '$.provenance') {
  if (input === undefined || input === null) return null;
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    pushError(errors, path, 'invalid_type', 'provenance must be an object.');
    return null;
  }

  const transportMode = validateOptionalEnumString(
    input.transportMode,
    DIALOGUE_TRANSPORT_MODES,
    `${path}.transportMode`,
    'provenance.transportMode',
    errors
  );
  const usedChunking = validateOptionalBoolean(input.usedChunking, `${path}.usedChunking`, 'provenance.usedChunking', errors);
  const chunkCountRaw = validateOptionalFiniteNumber(input.chunkCount, `${path}.chunkCount`, 'provenance.chunkCount', errors, { min: 0 });
  const fallbackApplied = validateOptionalBoolean(input.fallbackApplied, `${path}.fallbackApplied`, 'provenance.fallbackApplied', errors);
  const fallbackReason = validateOptionalNonEmptyString(input.fallbackReason, `${path}.fallbackReason`, 'provenance.fallbackReason', errors);

  const provenance = {
    ...(transportMode ? { transportMode } : {}),
    ...(usedChunking !== null ? { usedChunking } : {}),
    ...(chunkCountRaw !== null ? { chunkCount: Math.trunc(chunkCountRaw) } : {}),
    ...(fallbackApplied !== null ? { fallbackApplied } : {}),
    ...(fallbackReason ? { fallbackReason } : {})
  };

  const chunkPlan = input.chunkPlan;
  if (chunkPlan !== undefined && chunkPlan !== null) {
    if (!chunkPlan || typeof chunkPlan !== 'object' || Array.isArray(chunkPlan)) {
      pushError(errors, `${path}.chunkPlan`, 'invalid_type', 'provenance.chunkPlan must be an object.');
    } else {
      const reason = validateOptionalNonEmptyString(chunkPlan.reason, `${path}.chunkPlan.reason`, 'provenance.chunkPlan.reason', errors);
      const recommendedChunkDurationSeconds = validateOptionalFiniteNumber(
        chunkPlan.recommendedChunkDurationSeconds,
        `${path}.chunkPlan.recommendedChunkDurationSeconds`,
        'provenance.chunkPlan.recommendedChunkDurationSeconds',
        errors,
        { min: 0 }
      );

      let openingArbitration = null;
      if (chunkPlan.openingArbitration !== undefined && chunkPlan.openingArbitration !== null) {
        if (!chunkPlan.openingArbitration || typeof chunkPlan.openingArbitration !== 'object' || Array.isArray(chunkPlan.openingArbitration)) {
          pushError(errors, `${path}.chunkPlan.openingArbitration`, 'invalid_type', 'provenance.chunkPlan.openingArbitration must be an object.');
        } else {
          const coverageSeconds = validateOptionalFiniteNumber(
            chunkPlan.openingArbitration.coverageSeconds,
            `${path}.chunkPlan.openingArbitration.coverageSeconds`,
            'provenance.chunkPlan.openingArbitration.coverageSeconds',
            errors,
            { min: 0 }
          );
          const chunkDurationSeconds = validateOptionalFiniteNumber(
            chunkPlan.openingArbitration.chunkDurationSeconds,
            `${path}.chunkPlan.openingArbitration.chunkDurationSeconds`,
            'provenance.chunkPlan.openingArbitration.chunkDurationSeconds',
            errors,
            { min: 0 }
          );
          openingArbitration = {
            ...(coverageSeconds !== null ? { coverageSeconds } : {}),
            ...(chunkDurationSeconds !== null ? { chunkDurationSeconds } : {})
          };
        }
      }

      provenance.chunkPlan = {
        ...(reason ? { reason } : {}),
        ...(recommendedChunkDurationSeconds !== null ? { recommendedChunkDurationSeconds } : {}),
        ...(openingArbitration && Object.keys(openingArbitration).length > 0 ? { openingArbitration } : {})
      };
    }
  }

  return provenance;
}

function validateDialogueQualityNotes(input, errors, path = '$.qualityNotes') {
  if (input === undefined || input === null) return null;
  if (!Array.isArray(input)) {
    pushError(errors, path, 'required_array', 'qualityNotes must be an array.');
    return null;
  }

  return input.map((entry, index) => validateNonEmptyString(entry, `${path}[${index}]`, 'quality note', errors)).filter(Boolean);
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
  const totalDuration = validateOptionalFiniteNumber(input.totalDuration, '$.totalDuration', 'totalDuration', errors, { min: 0 });
  const analysisMode = validateOptionalEnumString(input.analysisMode, DIALOGUE_ANALYSIS_MODES, '$.analysisMode', 'analysisMode', errors);
  const timingMode = validateOptionalEnumString(input.timingMode, DIALOGUE_TIMING_MODES, '$.timingMode', 'timingMode', errors);
  const sourceStrategy = validateOptionalEnumString(input.sourceStrategy, DIALOGUE_SOURCE_STRATEGIES, '$.sourceStrategy', 'sourceStrategy', errors);
  const coverage = validateDialogueCoverage(input.coverage, errors);
  const provenance = validateDialogueProvenance(input.provenance, errors);
  const qualityNotes = validateDialogueQualityNotes(input.qualityNotes, errors);

  const handoffValue = input.handoffContext ?? input.handoff;
  let handoffContext = null;
  if (handoffValue !== undefined && handoffValue !== null) {
    handoffContext = validateNonEmptyString(handoffValue, '$.handoffContext', 'handoffContext', errors);
  } else if (requireHandoff) {
    pushError(errors, '$.handoffContext', 'required_string', 'handoffContext must be a non-empty string.');
  }

  pushEnglishOnlyError(errors, '$.summary', 'summary', summary);
  pushEnglishOnlyError(errors, '$.handoffContext', 'handoffContext', handoffContext);
  for (const segment of speaker_profiles) {
    pushEnglishOnlyError(errors, '$.speaker_profiles.label', 'speaker profile label', segment?.label);
    for (const descriptor of Array.isArray(segment?.grounded?.acoustic_descriptors) ? segment.grounded.acoustic_descriptors : []) {
      pushEnglishOnlyError(errors, '$.speaker_profiles.grounded.acoustic_descriptors[].label', 'acoustic descriptor label', descriptor?.label);
    }
    for (const trait of Array.isArray(segment?.inferred_traits?.traits) ? segment.inferred_traits.traits : []) {
      pushEnglishOnlyError(errors, '$.speaker_profiles.inferred_traits.traits[].trait', 'inferred trait name', trait?.trait);
      pushEnglishOnlyError(errors, '$.speaker_profiles.inferred_traits.traits[].value', 'inferred trait value', trait?.value);
      pushEnglishOnlyError(errors, '$.speaker_profiles.inferred_traits.traits[].note', 'inferred trait note', trait?.note);
    }
  }
  for (const note of Array.isArray(qualityNotes) ? qualityNotes : []) {
    pushEnglishOnlyError(errors, '$.qualityNotes[]', 'qualityNotes entry', note);
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

  const normalizedValue = {
    dialogue_segments: normalizedSpeakerContract.dialogue_segments,
    speaker_profiles: normalizedSpeakerContract.speaker_profiles,
    summary,
    ...(totalDuration !== null ? { totalDuration } : {}),
    handoffContext: handoffContext || null,
    ...(analysisMode ? { analysisMode } : {}),
    ...(timingMode ? { timingMode } : {}),
    ...(sourceStrategy ? { sourceStrategy } : {}),
    ...(coverage ? { coverage } : {}),
    ...(provenance ? { provenance } : {}),
    ...(qualityNotes ? { qualityNotes } : {})
  };

  return {
    ok: true,
    value: normalizedValue,
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

  for (const entry of auditTrail) {
    pushEnglishOnlyError(errors, '$.auditTrail[].op', 'auditTrail op', entry?.op);
    pushEnglishOnlyError(errors, '$.auditTrail[].detail', 'auditTrail detail', entry?.detail);
  }
  pushEnglishOnlyError(errors, '$.debug.notes', 'debug notes', debug?.notes);

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

const MUSIC_VOCAL_DELIVERIES = new Set(['sung', 'chant', 'rap', 'melodic_refrain', 'hybrid']);
const RECOGNIZED_SONG_STATUSES = new Set(['recognized', 'possible', 'multiple_possible', 'unknown', 'none_present']);

function validateMusicVocalSegments(segments, errors, path = '$.vocal_segments') {
  if (segments === undefined || segments === null) return [];

  if (!Array.isArray(segments)) {
    pushError(errors, path, 'required_array', 'vocal_segments must be an array when provided.');
    return [];
  }

  return segments.map((segment, index) => {
    const itemPath = `${path}[${index}]`;
    if (!segment || typeof segment !== 'object' || Array.isArray(segment)) {
      pushError(errors, itemPath, 'invalid_type', 'Each music vocal segment must be an object.');
      return null;
    }

    const performer = validateOptionalNonEmptyString(
      segment.performer ?? segment.singer ?? segment.voice,
      `${itemPath}.performer`,
      'music vocal performer',
      errors
    );
    const performer_id = validateOptionalNonEmptyString(
      segment.performer_id ?? segment.performerId ?? segment.singer_id ?? segment.singerId,
      `${itemPath}.performer_id`,
      'music vocal performer_id',
      errors
    );
    const delivery = validateOptionalEnumString(
      segment.delivery,
      MUSIC_VOCAL_DELIVERIES,
      `${itemPath}.delivery`,
      'music vocal delivery',
      errors
    );

    const providedIndex = segment.index ?? segment.segment_index ?? segment.segmentIndex;
    if (providedIndex !== undefined && providedIndex !== null) {
      validateFiniteNumber(providedIndex, `${itemPath}.index`, 'music vocal segment index', errors, { min: 0 });
    }

    const start = validateOptionalDialogueTimestamp(segment.start, `${itemPath}.start`, 'music vocal segment start', errors, { min: 0 });
    const end = validateOptionalDialogueTimestamp(segment.end, `${itemPath}.end`, 'music vocal segment end', errors, { min: 0 });
    if (start !== null && end !== null && end <= start) {
      pushError(errors, itemPath, 'invalid_range', 'music vocal segment end must be greater than start when both timestamps are provided.');
    }

    return {
      ...(start !== null ? { start } : {}),
      ...(end !== null ? { end } : {}),
      text: validateNonEmptyString(segment.text, `${itemPath}.text`, 'music vocal segment text', errors) ?? '',
      confidence: validateFiniteNumber(segment.confidence, `${itemPath}.confidence`, 'music vocal segment confidence', errors, { min: 0, max: 1 }) ?? 0,
      performer: performer || null,
      performer_id: performer_id || null,
      delivery: delivery || null
    };
  }).filter(Boolean);
}

function validateRecognitionEvidenceArray(values, errors, path, label) {
  if (!Array.isArray(values)) {
    pushError(errors, path, 'required_array', `${label} must be an array.`);
    return [];
  }

  const normalized = values.map((value, index) => {
    const itemPath = `${path}[${index}]`;
    return validateNonEmptyString(value, itemPath, `${label} entry`, errors);
  }).filter(Boolean);

  if (normalized.length === 0) {
    pushError(errors, path, 'required_non_empty_array', `${label} must contain at least one entry.`);
  }

  return normalized;
}

function validateOptionalRecognitionNotes(values, errors, path = '$.recognitionNotes') {
  if (values === undefined || values === null) return [];
  if (!Array.isArray(values)) {
    pushError(errors, path, 'required_array', 'recognitionNotes must be an array when provided.');
    return [];
  }

  return values.map((value, index) => {
    const itemPath = `${path}[${index}]`;
    return validateNonEmptyString(value, itemPath, 'recognitionNotes entry', errors);
  }).filter(Boolean);
}

function validateRecognizedSongCandidate(candidate, errors, path, { minTime = 0, maxTime = Number.POSITIVE_INFINITY } = {}) {
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
    pushError(errors, path, 'invalid_type', 'recognizedSong candidates must be objects.');
    return null;
  }

  const title = validateOptionalNonEmptyString(candidate.title, `${path}.title`, 'recognized song candidate title', errors);
  const artist = validateOptionalNonEmptyString(candidate.artist, `${path}.artist`, 'recognized song candidate artist', errors);
  const confidence = validateFiniteNumber(candidate.confidence, `${path}.confidence`, 'recognized song candidate confidence', errors, { min: 0, max: 1 });
  const evidence = validateRecognitionEvidenceArray(candidate.evidence, errors, `${path}.evidence`, 'recognized song candidate evidence');
  const matchedLyrics = candidate.matchedLyrics === undefined || candidate.matchedLyrics === null
    ? []
    : validateRecognitionEvidenceArray(candidate.matchedLyrics, errors, `${path}.matchedLyrics`, 'recognized song candidate matchedLyrics');
  const timeRanges = candidate.timeRanges === undefined || candidate.timeRanges === null
    ? []
    : Array.isArray(candidate.timeRanges)
      ? candidate.timeRanges.map((range, index) => {
          const itemPath = `${path}.timeRanges[${index}]`;
          if (!range || typeof range !== 'object' || Array.isArray(range)) {
            pushError(errors, itemPath, 'invalid_type', 'recognized song candidate timeRanges entries must be objects.');
            return null;
          }

          const start = validateDialogueTimestamp(range.start, `${itemPath}.start`, 'recognized song candidate time range start', errors, { min: minTime, max: maxTime });
          const end = validateDialogueTimestamp(range.end, `${itemPath}.end`, 'recognized song candidate time range end', errors, { min: minTime, max: maxTime });
          if (start !== null && end !== null && end <= start) {
            pushError(errors, itemPath, 'invalid_range', 'recognized song candidate time range end must be greater than start.');
          }

          return start !== null && end !== null ? { start, end } : null;
        }).filter(Boolean)
      : (pushError(errors, `${path}.timeRanges`, 'required_array', 'recognized song candidate timeRanges must be an array when provided.'), []);
  const ambiguity = validateOptionalNonEmptyString(candidate.ambiguity, `${path}.ambiguity`, 'recognized song candidate ambiguity', errors);

  return {
    title: title || null,
    artist: artist || null,
    confidence: confidence ?? 0,
    evidence,
    ...(matchedLyrics.length > 0 ? { matchedLyrics } : {}),
    ...(timeRanges.length > 0 ? { timeRanges } : {}),
    ...(ambiguity ? { ambiguity } : {})
  };
}

function validateRecognizedSong(input, errors, path = '$.recognizedSong', { minTime = 0, maxTime = Number.POSITIVE_INFINITY } = {}) {
  if (input === undefined || input === null) return null;
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    pushError(errors, path, 'invalid_type', 'recognizedSong must be an object when provided.');
    return null;
  }

  const status = validateOptionalEnumString(input.status, RECOGNIZED_SONG_STATUSES, `${path}.status`, 'recognizedSong status', errors);
  const confidence = validateFiniteNumber(input.confidence, `${path}.confidence`, 'recognizedSong confidence', errors, { min: 0, max: 1 });
  const candidatesInput = input.candidates;
  let candidates = [];
  if (!Array.isArray(candidatesInput)) {
    pushError(errors, `${path}.candidates`, 'required_array', 'recognizedSong candidates must be an array.');
  } else {
    if (candidatesInput.length > 3) {
      pushError(errors, `${path}.candidates`, 'out_of_range', 'recognizedSong candidates may contain at most 3 entries.');
    }
    candidates = candidatesInput.slice(0, 3).map((candidate, index) => (
      validateRecognizedSongCandidate(candidate, errors, `${path}.candidates[${index}]`, { minTime, maxTime })
    )).filter(Boolean);
  }

  const primaryEvidence = validateOptionalNonEmptyString(input.primaryEvidence, `${path}.primaryEvidence`, 'recognizedSong primaryEvidence', errors);
  const ambiguity = validateOptionalNonEmptyString(input.ambiguity, `${path}.ambiguity`, 'recognizedSong ambiguity', errors);
  const multipleSongsDetected = validateBoolean(input.multipleSongsDetected, `${path}.multipleSongsDetected`, 'recognizedSong multipleSongsDetected', errors);

  if ((status === 'recognized' || status === 'possible' || status === 'multiple_possible') && candidates.length === 0) {
    pushError(errors, `${path}.candidates`, 'required_non_empty_array', `recognizedSong candidates must contain at least one entry when status is ${status}.`);
  }
  if (status === 'multiple_possible' && multipleSongsDetected === false) {
    pushError(errors, `${path}.multipleSongsDetected`, 'invalid_value', 'recognizedSong multipleSongsDetected must be true when status is multiple_possible.');
  }
  if (status === 'recognized' && candidates.length > 1 && multipleSongsDetected !== true) {
    pushError(errors, `${path}.multipleSongsDetected`, 'invalid_value', 'recognizedSong multipleSongsDetected must be true when multiple recognized-song candidates are supplied.');
  }

  return {
    status: status || 'unknown',
    confidence: confidence ?? 0,
    candidates,
    primaryEvidence: primaryEvidence || null,
    ambiguity: ambiguity || null,
    multipleSongsDetected: multipleSongsDetected ?? false
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
  const recognizedSong = validateRecognizedSong(input.recognizedSong, errors, '$.recognizedSong');
  const recognitionNotes = validateOptionalRecognitionNotes(input.recognitionNotes, errors);

  pushEnglishOnlyError(errors, '$.analysis.description', 'analysis.description', description);
  pushEnglishOnlyError(errors, '$.analysis.mood', 'analysis.mood', mood);
  pushEnglishOnlyError(errors, '$.rollingSummary', 'rollingSummary', rollingSummary);
  if (recognizedSong) {
    pushEnglishOnlyError(errors, '$.recognizedSong.primaryEvidence', 'recognizedSong primaryEvidence', recognizedSong.primaryEvidence);
    pushEnglishOnlyError(errors, '$.recognizedSong.ambiguity', 'recognizedSong ambiguity', recognizedSong.ambiguity);
    for (const candidate of Array.isArray(recognizedSong.candidates) ? recognizedSong.candidates : []) {
      pushEnglishOnlyError(errors, '$.recognizedSong.candidates[].ambiguity', 'recognized song candidate ambiguity', candidate?.ambiguity);
      for (const evidenceEntry of Array.isArray(candidate?.evidence) ? candidate.evidence : []) {
        pushEnglishOnlyError(errors, '$.recognizedSong.candidates[].evidence[]', 'recognized song candidate evidence', evidenceEntry);
      }
    }
  }
  for (const note of recognitionNotes) {
    pushEnglishOnlyError(errors, '$.recognitionNotes[]', 'recognitionNotes entry', note);
  }

  return {
    ok: errors.length === 0,
    value: errors.length === 0 ? {
      analysis: {
        type,
        description,
        mood: mood || null,
        intensity
      },
      rollingSummary: rollingSummary || null,
      ...(recognizedSong ? { recognizedSong } : {}),
      ...(recognitionNotes.length > 0 ? { recognitionNotes } : {})
    } : null,
    errors,
    summary: summarizeValidationErrors('Music JSON validation failed.', errors),
    meta: { stage: 'validation' }
  };
}

function validateMusicVocalsAnalysisObject(input) {
  const errors = [];

  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return {
      ok: false,
      value: null,
      errors: [{ path: '$', code: 'invalid_type', message: 'Music vocals output must be a JSON object.' }],
      summary: 'Music vocals output must be a JSON object. Return corrected JSON only.',
      meta: { stage: 'validation' }
    };
  }

  const rollingSummarySource = input.rollingSummary ?? input.rolling_summary ?? input.chunkSummary;
  const rollingSummary = rollingSummarySource === undefined || rollingSummarySource === null
    ? null
    : validateOptionalNonEmptyString(rollingSummarySource, '$.rollingSummary', 'rollingSummary', errors);

  const vocalSummarySource = input.vocalSummary ?? input.vocal_summary ?? input.musicVocalsSummary ?? input.summary;
  const vocalSummary = vocalSummarySource === undefined || vocalSummarySource === null
    ? null
    : validateOptionalNonEmptyString(vocalSummarySource, '$.vocalSummary', 'vocalSummary', errors);

  const vocal_segments = validateMusicVocalSegments(input.vocal_segments, errors);
  const recognizedSong = validateRecognizedSong(input.recognizedSong, errors, '$.recognizedSong');
  const recognitionNotes = validateOptionalRecognitionNotes(input.recognitionNotes, errors);

  const qualityNotes = Array.isArray(input.qualityNotes)
    ? input.qualityNotes.map((note, index) => {
        const normalized = validateOptionalNonEmptyString(note, `$.qualityNotes[${index}]`, 'qualityNotes entry', errors);
        return normalized || null;
      }).filter(Boolean)
    : [];

  if (input.qualityNotes !== undefined && !Array.isArray(input.qualityNotes)) {
    pushError(errors, '$.qualityNotes', 'invalid_type', 'qualityNotes must be an array when provided.');
  }

  pushEnglishOnlyError(errors, '$.rollingSummary', 'rollingSummary', rollingSummary);
  pushEnglishOnlyError(errors, '$.vocalSummary', 'vocalSummary', vocalSummary);
  if (recognizedSong) {
    pushEnglishOnlyError(errors, '$.recognizedSong.primaryEvidence', 'recognizedSong primaryEvidence', recognizedSong.primaryEvidence);
    pushEnglishOnlyError(errors, '$.recognizedSong.ambiguity', 'recognizedSong ambiguity', recognizedSong.ambiguity);
    for (const candidate of Array.isArray(recognizedSong.candidates) ? recognizedSong.candidates : []) {
      pushEnglishOnlyError(errors, '$.recognizedSong.candidates[].ambiguity', 'recognized song candidate ambiguity', candidate?.ambiguity);
      for (const evidenceEntry of Array.isArray(candidate?.evidence) ? candidate.evidence : []) {
        pushEnglishOnlyError(errors, '$.recognizedSong.candidates[].evidence[]', 'recognized song candidate evidence', evidenceEntry);
      }
    }
  }
  for (const note of recognitionNotes) {
    pushEnglishOnlyError(errors, '$.recognitionNotes[]', 'recognitionNotes entry', note);
  }
  for (const note of qualityNotes) {
    pushEnglishOnlyError(errors, '$.qualityNotes[]', 'qualityNotes entry', note);
  }

  return {
    ok: errors.length === 0,
    value: errors.length === 0 ? {
      rollingSummary: rollingSummary || null,
      vocalSummary: vocalSummary || null,
      vocal_segments: vocal_segments.map((segment, index) => ({
        ...segment,
        index
      })),
      ...(recognizedSong ? { recognizedSong } : {}),
      ...(recognitionNotes.length > 0 ? { recognitionNotes } : {}),
      qualityNotes
    } : null,
    errors,
    summary: summarizeValidationErrors('Music vocals JSON validation failed.', errors),
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
    pushEnglishOnlyError(errors, `${lensPath}.reasoning`, `${lens} reasoning`, emotions[lens].reasoning);
  }

  pushEnglishOnlyError(errors, '$.summary', 'summary', summary);

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
  validateMusicVocalsAnalysisObject,
  validateRecognizedSong,
  validateOptionalRecognitionNotes,
  validateEmotionStateObject
};
