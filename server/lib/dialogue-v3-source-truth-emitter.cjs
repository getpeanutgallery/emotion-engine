'use strict';

const {
  TRAIT_ENUMS,
  validateDialogueV3SourceTruthObject
} = require('./dialogue-v3-source-truth-validator.cjs');

const TRAIT_FIELDS = Object.freeze(Object.keys(TRAIT_ENUMS));

function compactString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function tokenizeEvidence(values = []) {
  const phrases = [];
  const tokens = new Set();

  for (const value of values) {
    const normalized = compactString(value).toLowerCase();
    if (!normalized) continue;
    phrases.push(normalized);
    for (const token of normalized.split(/[^a-z0-9_]+/).filter(Boolean)) {
      tokens.add(token);
    }
  }

  return {
    phrases,
    tokens
  };
}

function hasPhrase(evidence, matcher) {
  return evidence.phrases.some((phrase) => matcher(phrase));
}

function hasAnyPhrase(evidence, fragments = []) {
  return hasPhrase(evidence, (phrase) => fragments.some((fragment) => phrase.includes(fragment)));
}

function hasAnyToken(evidence, tokens = []) {
  return tokens.some((token) => evidence.tokens.has(token));
}

function buildUnknownTraits() {
  return {
    audibility: 'unknown',
    overlap: 'unknown',
    gender_presentation: 'unknown',
    age_impression: 'unknown',
    pitch_band: 'unknown',
    phonation: 'unknown',
    pace: 'unknown',
    energy: 'unknown',
    transmission_medium: 'unknown',
    spatial_texture: 'unknown',
    accent_strength: 'unknown',
    accent_family: 'unknown',
    affect: 'unknown',
    interpersonal_stance: 'neutral',
    delivery_overlay: 'none_apparent'
  };
}

function findFirstMatch(pairs, predicate) {
  for (const [enumValue, fragments] of pairs) {
    if (hasAnyPhrase(predicate, fragments) || hasAnyToken(predicate, fragments)) return enumValue;
  }
  return null;
}

function resolveAudibility(evidence, segment) {
  if (hasAnyPhrase(evidence, ['heavily masked', 'barely audible', 'almost inaudible', 'severely clipped'])) return 'heavily_masked';
  if (hasAnyPhrase(evidence, ['partially masked', 'masked', 'muffled', 'clipped', 'distorted', 'noisy', 'unclear'])) return 'partially_masked';

  const confidence = typeof segment?.confidence === 'number' && Number.isFinite(segment.confidence)
    ? segment.confidence
    : null;
  if (confidence !== null && confidence < 0.45) return 'heavily_masked';
  if (confidence !== null && confidence < 0.72) return 'partially_masked';
  if (confidence !== null) return 'clear';
  return 'unknown';
}

function resolveOverlap(evidence) {
  if (hasAnyPhrase(evidence, ['competing overlap', 'cross-talk', 'crosstalk', 'multiple voices', 'two voices', 'overlapping voices'])) return 'competing_overlap';
  if (hasAnyPhrase(evidence, ['background overlap', 'over music', 'under music', 'crowd behind', 'background voices', 'ambient voices'])) return 'background_overlap';
  return 'single_voice';
}

function resolveGenderPresentation(evidence) {
  if (hasAnyPhrase(evidence, ['androgynous'])) return 'androgynous';
  if (hasAnyPhrase(evidence, ['mixed gender', 'mixed presentation'])) return 'mixed';
  if (hasAnyPhrase(evidence, ['feminine', 'female', 'woman', 'girl'])) return 'feminine';
  if (hasAnyPhrase(evidence, ['masculine', 'male', 'man', 'boy'])) return 'masculine';
  return 'unknown';
}

function resolveAgeImpression(evidence) {
  if (hasAnyPhrase(evidence, ['child', 'kid'])) return 'child';
  if (hasAnyPhrase(evidence, ['teen', 'teenage'])) return 'teen';
  if (hasAnyPhrase(evidence, ['young adult', 'young'])) return 'young_adult';
  if (hasAnyPhrase(evidence, ['older adult', 'middle-aged', 'middle aged', 'older'])) return 'older_adult';
  if (hasAnyPhrase(evidence, ['elder', 'elderly'])) return 'elder';
  if (hasAnyPhrase(evidence, ['adult'])) return 'adult';
  return 'unknown';
}

function resolvePitchBand(evidence) {
  if (hasAnyPhrase(evidence, ['variable pitch'])) return 'variable';
  if (hasAnyPhrase(evidence, ['low', 'deep', 'baritone', 'bass'])) return 'low';
  if (hasAnyPhrase(evidence, ['high', 'shrill', 'piercing', 'falsetto'])) return 'high';
  if (hasAnyPhrase(evidence, ['mid'])) return 'mid';
  return 'unknown';
}

function resolvePhonation(evidence) {
  const hits = [];
  const pairs = [
    ['breathy', ['breathy']],
    ['whispered', ['whisper', 'whispered']],
    ['raspy', ['raspy', 'gravelly', 'rough']],
    ['nasal', ['nasal']],
    ['thin', ['thin']],
    ['full', ['full', 'rich']],
    ['strained', ['strained', 'strained-out', 'strained out']],
    ['clear', ['clear', 'clean']]
  ];

  for (const [enumValue, fragments] of pairs) {
    if (hasAnyPhrase(evidence, fragments)) hits.push(enumValue);
  }

  if (hits.length > 1) return 'mixed';
  return hits[0] || 'unknown';
}

function resolvePace(evidence, text) {
  if (hasAnyPhrase(evidence, ['variable pace', 'pace changes'])) return 'variable';
  if (hasAnyPhrase(evidence, ['slow', 'drawn out', 'drawled'])) return 'slow';
  if (hasAnyPhrase(evidence, ['measured', 'deliberate', 'steady cadence'])) return 'measured';
  if (hasAnyPhrase(evidence, ['fast', 'rapid', 'quick', 'hurried'])) return 'fast';
  if (/\.{3,}$/.test(text)) return 'measured';
  return 'unknown';
}

function resolveEnergy(evidence, text) {
  if (hasAnyPhrase(evidence, ['variable energy'])) return 'variable';
  if (hasAnyPhrase(evidence, ['calm', 'gentle', 'soft'])) return 'calm';
  if (hasAnyPhrase(evidence, ['steady', 'measured', 'resolute', 'controlled'])) return 'steady';
  if (hasAnyPhrase(evidence, ['intense', 'forceful', 'urgent', 'aggressive', 'explosive'])) return 'intense';
  if (/[!?]/.test(text)) return 'intense';
  return 'unknown';
}

function resolveTransmissionMedium(evidence) {
  if (hasAnyPhrase(evidence, ['phone', 'telephone', 'call quality'])) return 'phone';
  if (hasAnyPhrase(evidence, ['radio', 'walkie', 'comms'])) return 'radio';
  if (hasAnyPhrase(evidence, ['intercom', 'public-address', 'public address', 'pa system', 'pa voice'])) return 'pa_or_intercom';
  if (hasAnyPhrase(evidence, ['playback', 'recorded', 'television', 'tv speaker', 'monitor speaker'])) return 'media_playback';
  if (hasAnyPhrase(evidence, ['synthetic', 'robotic', 'processed', 'digital filter', 'vocoder'])) return 'processed_or_synthetic';
  return 'direct';
}

function resolveSpatialTexture(evidence) {
  if (hasAnyPhrase(evidence, ['close-mic', 'close mic', 'intimate', 'up-close', 'up close'])) return 'close';
  if (hasAnyPhrase(evidence, ['reverberant', 'echoing', 'echoey', 'hall-like'])) return 'reverberant';
  if (hasAnyPhrase(evidence, ['distant', 'far away', 'far-off', 'far off'])) return 'distant';
  if (hasAnyPhrase(evidence, ['room', 'roomy', 'indoor room'])) return 'room';
  return 'room';
}

function resolveAccentStrength(evidence) {
  if (hasAnyPhrase(evidence, ['variable accent'])) return 'variable';
  if (hasAnyPhrase(evidence, ['clear accent', 'heavy accent', 'strong accent'])) return 'clear_non_neutral';
  if (hasAnyPhrase(evidence, ['slight accent', 'subtle accent', 'possibly'])) return 'subtle_non_neutral';
  return 'none_apparent';
}

function resolveAccentFamily(evidence) {
  if (hasAnyPhrase(evidence, ['mixed accent'])) return 'mixed';
  if (hasAnyPhrase(evidence, ['latino', 'latina', 'hispanic', 'spanish'])) return 'hispanic';
  if (hasAnyPhrase(evidence, ['slavic', 'russian', 'ukrainian', 'polish'])) return 'slavic';
  if (hasAnyPhrase(evidence, ['german', 'germanic', 'scandinavian', 'nordic'])) return 'germanic';
  if (hasAnyPhrase(evidence, ['french', 'italian', 'portuguese', 'romanian', 'romance'])) return 'romance';
  if (hasAnyPhrase(evidence, ['indian', 'pakistani', 'south asian', 'desi'])) return 'south_asian';
  if (hasAnyPhrase(evidence, ['chinese', 'japanese', 'korean', 'east asian'])) return 'east_asian';
  if (hasAnyPhrase(evidence, ['thai', 'vietnamese', 'filipino', 'southeast asian'])) return 'southeast_asian';
  if (hasAnyPhrase(evidence, ['african', 'nigerian', 'kenyan', 'south african'])) return 'african';
  if (hasAnyPhrase(evidence, ['arabic', 'middle eastern', 'persian', 'iranian'])) return 'middle_eastern';
  if (hasAnyPhrase(evidence, ['british', 'irish', 'scottish', 'welsh', 'australian', 'new zealand', 'southern us', 'midwestern', 'texan', 'cockney'])) return 'anglophone_non_neutral';
  return 'neutral_or_unmarked';
}

function resolveAffect(evidence, text) {
  if (hasAnyPhrase(evidence, ['mixed affect'])) return 'mixed';
  if (hasAnyPhrase(evidence, ['calm'])) return 'calm';
  if (hasAnyPhrase(evidence, ['serious', 'matter-of-fact', 'stern'])) return 'serious';
  if (hasAnyPhrase(evidence, ['angry', 'furious', 'aggressive'])) return 'angry';
  if (hasAnyPhrase(evidence, ['sad', 'somber'])) return 'sad';
  if (hasAnyPhrase(evidence, ['fearful', 'afraid', 'panicked'])) return 'fearful';
  if (hasAnyPhrase(evidence, ['tense', 'urgent'])) return 'tense';
  if (hasAnyPhrase(evidence, ['happy', 'cheerful'])) return 'happy';
  if (hasAnyPhrase(evidence, ['amused', 'playful'])) return 'amused';
  if (hasAnyPhrase(evidence, ['disgusted'])) return 'disgusted';
  if (hasAnyPhrase(evidence, ['surprised'])) return 'surprised';
  if (hasAnyPhrase(evidence, ['determined', 'resolute'])) return 'determined';
  if (hasAnyPhrase(evidence, ['sensual', 'seductive'])) return 'sensual';
  if (/!$/.test(text)) return 'tense';
  return 'unknown';
}

function resolveInterpersonalStance(evidence, text) {
  if (hasAnyPhrase(evidence, ['mixed stance'])) return 'mixed';
  if (hasAnyPhrase(evidence, ['supportive', 'reassuring'])) return 'supportive';
  if (hasAnyPhrase(evidence, ['pleading', 'begging'])) return 'pleading';
  if (hasAnyPhrase(evidence, ['taunting', 'mocking'])) return 'taunting';
  if (hasAnyPhrase(evidence, ['seductive', 'flirtatious'])) return 'seductive';
  if (hasAnyPhrase(evidence, ['performative', 'announcer', 'public-address', 'public address'])) return 'performative';
  if (hasAnyPhrase(evidence, ['confrontational', 'hostile', 'aggressive'])) return 'confrontational';
  if (hasAnyPhrase(evidence, ['directive', 'authoritative', 'commanding', 'orders'])) return 'directive';
  if (/^(hold|move|go|stay|keep|stop|listen|look|wait|take|get|do)\b/i.test(compactString(text))) return 'directive';
  return 'neutral';
}

function resolveDeliveryOverlay(evidence, text) {
  const laughing = hasAnyPhrase(evidence, ['laughing', 'laugh', 'chuckle']);
  const crying = hasAnyPhrase(evidence, ['crying', 'sobbing', 'tearful']);
  if (laughing && crying) return 'mixed';
  if (laughing) return 'laughing';
  if (crying) return 'crying';
  if (/\[(laughs?|cry(?:ing|s)?)\]/i.test(text)) {
    return /laugh/i.test(text) ? 'laughing' : 'crying';
  }
  return 'none_apparent';
}

function buildEvidenceStrings(segment, speakerProfile) {
  const values = [];
  const text = compactString(segment?.text);
  if (text) values.push(text);
  if (speakerProfile?.label) values.push(speakerProfile.label);

  const descriptors = Array.isArray(speakerProfile?.grounded?.acoustic_descriptors)
    ? speakerProfile.grounded.acoustic_descriptors
    : [];
  for (const descriptor of descriptors) {
    if (descriptor?.label) values.push(descriptor.label);
  }

  const inferredTraits = Array.isArray(speakerProfile?.inferred_traits?.traits)
    ? speakerProfile.inferred_traits.traits
    : [];
  for (const trait of inferredTraits) {
    if (trait?.trait) values.push(trait.trait);
    if (trait?.value) values.push(trait.value);
    if (trait?.note) values.push(trait.note);
  }

  return values;
}

function buildSpeakerProfileMap(dialogueData) {
  const bySpeakerId = new Map();
  const profiles = Array.isArray(dialogueData?.speaker_profiles) ? dialogueData.speaker_profiles : [];

  for (const profile of profiles) {
    const speakerId = compactString(profile?.speaker_id);
    if (!speakerId) continue;
    bySpeakerId.set(speakerId, profile);
  }

  return bySpeakerId;
}

function emitSegmentTraits(segment, speakerProfile) {
  const traits = buildUnknownTraits();
  const text = compactString(segment?.text);
  const evidence = tokenizeEvidence(buildEvidenceStrings(segment, speakerProfile));

  traits.audibility = resolveAudibility(evidence, segment);
  traits.overlap = resolveOverlap(evidence);
  traits.gender_presentation = resolveGenderPresentation(evidence);
  traits.age_impression = resolveAgeImpression(evidence);
  traits.pitch_band = resolvePitchBand(evidence);
  traits.phonation = resolvePhonation(evidence);
  traits.pace = resolvePace(evidence, text);
  traits.energy = resolveEnergy(evidence, text);
  traits.transmission_medium = resolveTransmissionMedium(evidence);
  traits.spatial_texture = resolveSpatialTexture(evidence);
  traits.accent_strength = resolveAccentStrength(evidence);
  traits.accent_family = resolveAccentFamily(evidence);
  traits.affect = resolveAffect(evidence, text);
  traits.interpersonal_stance = resolveInterpersonalStance(evidence, text);
  traits.delivery_overlay = resolveDeliveryOverlay(evidence, text);

  return traits;
}

function buildDialogueV3SourceTruth(dialogueData, options = {}) {
  const profileMap = buildSpeakerProfileMap(dialogueData);
  const summary = compactString(dialogueData?.summary)
    || compactString(options.summary)
    || 'Runtime-emitted dialogue v3 source truth.';
  const dialogueSegments = Array.isArray(dialogueData?.dialogue_segments) ? dialogueData.dialogue_segments : [];

  const candidate = {
    schema_version: 1,
    contract: {
      artifact: 'dialogue-data',
      mode: 'traits',
      traits_contract_version: '3.0.0'
    },
    summary,
    dialogue_segments: dialogueSegments.map((segment, index) => {
      const speakerId = compactString(segment?.speaker_id);
      const speakerProfile = speakerId ? profileMap.get(speakerId) || null : null;
      return {
        index,
        text: compactString(segment?.text),
        traits: emitSegmentTraits(segment, speakerProfile)
      };
    })
  };

  const validation = validateDialogueV3SourceTruthObject(candidate);
  if (!validation.ok) {
    const error = new Error(validation.summary || 'Failed to emit dialogue v3 source truth.');
    error.validation = validation;
    throw error;
  }

  return validation.value;
}

module.exports = {
  buildDialogueV3SourceTruth,
  buildUnknownTraits,
  emitSegmentTraits
};
