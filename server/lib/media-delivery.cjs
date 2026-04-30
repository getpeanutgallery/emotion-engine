const fs = require('fs');
const path = require('path');
const { estimateBase64SizeBytes } = require('./audio-preflight.cjs');

const VALID_DELIVERY_MODES = new Set(['url', 'inline']);
const VALID_URL_TYPES = new Set(['public', 'presigned']);
const VALID_MEDIA_KINDS = new Set(['video', 'audio', 'image', 'file']);

function compactString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function ensureArray(value) {
  return Array.isArray(value) ? value : [];
}

function detectMimeType(candidate = '') {
  const ext = path.extname(candidate).toLowerCase();
  if (ext === '.mov') return 'video/quicktime';
  if (ext === '.webm') return 'video/webm';
  if (ext === '.mkv') return 'video/x-matroska';
  if (ext === '.mp3') return 'audio/mpeg';
  if (ext === '.wav') return 'audio/wav';
  if (ext === '.png') return 'image/png';
  if (ext === '.webp') return 'image/webp';
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  return 'video/mp4';
}

function resolveRelativePath(candidatePath, baseDir = process.cwd()) {
  const normalized = compactString(candidatePath);
  if (!normalized) return null;
  return path.isAbsolute(normalized)
    ? normalized
    : path.resolve(baseDir, normalized);
}

function sameResolvedPath(leftPath, rightPath, baseDir = process.cwd()) {
  const resolvedLeft = resolveRelativePath(leftPath, baseDir);
  const resolvedRight = resolveRelativePath(rightPath, baseDir);
  if (!resolvedLeft || !resolvedRight) return false;
  return resolvedLeft === resolvedRight;
}

function inferKindFromDomain(domain) {
  if (domain === 'audio' || domain === 'music' || domain === 'dialogue') return 'audio';
  if (domain === 'image') return 'image';
  return 'video';
}

function normalizeDeliveryMode(value) {
  const normalized = compactString(value).toLowerCase();
  if (!normalized) return null;
  if (normalized === 'base64') return 'inline';
  if (normalized === 'provider_default') return 'provider_default';
  return VALID_DELIVERY_MODES.has(normalized) ? normalized : null;
}

function normalizeAllowedModes(value) {
  return ensureArray(value)
    .map((entry) => normalizeDeliveryMode(entry))
    .filter((entry, index, array) => entry && entry !== 'provider_default' && array.indexOf(entry) === index);
}

function normalizeDeliveryConfig(input = {}, fallback = {}) {
  const safeInput = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
  const safeFallback = fallback && typeof fallback === 'object' && !Array.isArray(fallback) ? fallback : {};

  const preferredMode = normalizeDeliveryMode(safeInput.preferredMode)
    || normalizeDeliveryMode(safeFallback.preferredMode)
    || 'provider_default';

  const allowedModes = normalizeAllowedModes(ensureArray(safeInput.allowedModes).length > 0
    ? safeInput.allowedModes
    : safeFallback.allowedModes);

  return {
    preferredMode,
    allowedModes: allowedModes.length > 0 ? allowedModes : ['inline'],
    allowFallback: safeInput.allowFallback !== undefined
      ? safeInput.allowFallback !== false
      : safeFallback.allowFallback !== false
  };
}

function normalizeMediaRef(refName, refConfig = {}, { assetPath, domain = 'video', baseDir = process.cwd() } = {}) {
  const kind = compactString(refConfig?.kind) || inferKindFromDomain(domain);
  const sourcePath = resolveRelativePath(refConfig?.source?.path || assetPath || null, baseDir);
  const stagedUrl = compactString(refConfig?.staged?.url);
  const sourceStats = sourcePath && fs.existsSync(sourcePath) ? fs.statSync(sourcePath) : null;
  const metadata = {
    filename: compactString(refConfig?.metadata?.filename) || path.basename(sourcePath || stagedUrl || refName || `${kind}.bin`),
    mimeType: compactString(refConfig?.metadata?.mimeType) || detectMimeType(sourcePath || stagedUrl || ''),
    sizeBytes: Number.isFinite(Number(refConfig?.metadata?.sizeBytes))
      ? Number(refConfig.metadata.sizeBytes)
      : (sourceStats?.size || null),
    durationSeconds: Number.isFinite(Number(refConfig?.metadata?.durationSeconds)) ? Number(refConfig.metadata.durationSeconds) : null,
    width: Number.isFinite(Number(refConfig?.metadata?.width)) ? Number(refConfig.metadata.width) : null,
    height: Number.isFinite(Number(refConfig?.metadata?.height)) ? Number(refConfig.metadata.height) : null,
    fps: Number.isFinite(Number(refConfig?.metadata?.fps)) ? Number(refConfig.metadata.fps) : null,
    sha256: compactString(refConfig?.metadata?.sha256) || null
  };

  return {
    ref: refName,
    kind,
    role: compactString(refConfig?.role) || 'primary',
    source: sourcePath ? { path: sourcePath } : {},
    staged: stagedUrl
      ? {
          url: stagedUrl,
          urlType: compactString(refConfig?.staged?.urlType) || 'public',
          expiresAt: refConfig?.staged?.expiresAt || null
        }
      : {},
    delivery: normalizeDeliveryConfig(refConfig?.delivery, stagedUrl ? {
      preferredMode: 'url',
      allowedModes: ['url', 'inline'],
      allowFallback: true
    } : {
      preferredMode: 'inline',
      allowedModes: ['inline'],
      allowFallback: false
    }),
    metadata
  };
}

function getTargetMediaOverride(target, refName) {
  if (!target || typeof target !== 'object' || !refName) return null;
  return target?.adapter?.media?.[refName] || target?.media?.[refName] || null;
}

function buildDeliveryOrder(delivery) {
  const preferredMode = normalizeDeliveryMode(delivery?.preferredMode);
  const allowedModes = normalizeAllowedModes(delivery?.allowedModes);

  if (preferredMode && preferredMode !== 'provider_default') {
    return [preferredMode, ...allowedModes.filter((value) => value !== preferredMode)];
  }

  return allowedModes;
}

function buildCapabilityMismatch(message, extra = {}) {
  const error = new Error(message);
  error.code = 'CAPABILITY_MISMATCH';
  error.aiTargets = {
    classification: 'capability',
    ...(extra.aiTargets || {})
  };
  error.mediaDelivery = extra.mediaDelivery || null;
  return error;
}

function getDefaultCapabilities() {
  return {
    media: {
      image: {
        inline: { supported: true, maxBytes: Number.POSITIVE_INFINITY },
        url: { supported: true, maxBytes: Number.POSITIVE_INFINITY, urlTypes: ['public', 'presigned'] }
      },
      audio: {
        inline: { supported: true, maxBytes: Number.POSITIVE_INFINITY },
        url: { supported: true, maxBytes: Number.POSITIVE_INFINITY, urlTypes: ['public', 'presigned'] }
      },
      video: {
        inline: { supported: true, maxBytes: Number.POSITIVE_INFINITY },
        url: { supported: true, maxBytes: Number.POSITIVE_INFINITY, urlTypes: ['public', 'presigned'] }
      },
      file: {
        inline: { supported: true, maxBytes: Number.POSITIVE_INFINITY },
        url: { supported: true, maxBytes: Number.POSITIVE_INFINITY, urlTypes: ['public', 'presigned'] }
      }
    }
  };
}

function getModeCapability(kind, mode, capabilities = null) {
  const source = capabilities && typeof capabilities === 'object' ? capabilities : getDefaultCapabilities();
  return source?.media?.[kind]?.[mode] || null;
}

function describeCapabilityFailure({ mediaRef, mode, capability }) {
  const refLabel = mediaRef?.ref || 'media';

  if (mode === 'url') {
    if (!mediaRef?.staged?.url || !/^https?:\/\//i.test(mediaRef.staged.url)) {
      return {
        kind: 'unavailable',
        message: `Media ref "${refLabel}" has no usable staged HTTP URL for url delivery.`
      };
    }

    if (capability?.supported === false) {
      return {
        kind: 'capability',
        message: `Provider does not support URL delivery for ${mediaRef.kind} ref "${refLabel}".`
      };
    }

    const allowedUrlTypes = ensureArray(capability?.urlTypes).map((entry) => compactString(entry)).filter(Boolean);
    const urlType = compactString(mediaRef?.staged?.urlType) || 'public';
    if (allowedUrlTypes.length > 0 && !allowedUrlTypes.includes(urlType)) {
      return {
        kind: 'capability',
        message: `Provider does not accept ${urlType} URLs for ${mediaRef.kind} ref "${refLabel}".`
      };
    }

    return null;
  }

  if (mode === 'inline') {
    const sourcePath = compactString(mediaRef?.source?.path);
    if (!sourcePath || !fs.existsSync(sourcePath)) {
      return {
        kind: 'unavailable',
        message: `Media ref "${refLabel}" has no readable local source for inline delivery.`
      };
    }

    if (capability?.supported === false) {
      return {
        kind: 'capability',
        message: `Provider does not support inline delivery for ${mediaRef.kind} ref "${refLabel}".`
      };
    }

    const maxBytes = Number(capability?.maxBytes);
    const sizeBytes = Number(mediaRef?.metadata?.sizeBytes || 0);
    const estimatedBase64Bytes = Math.ceil(sizeBytes / 3) * 4;
    if (Number.isFinite(maxBytes) && maxBytes > 0 && estimatedBase64Bytes > maxBytes) {
      return {
        kind: 'capability',
        message: `Inline delivery for ${mediaRef.kind} ref "${refLabel}" exceeds provider budget (${estimatedBase64Bytes} > ${maxBytes} bytes base64-encoded).`
      };
    }

    return null;
  }

  return {
    kind: 'unavailable',
    message: `Unsupported delivery mode "${mode}" for media ref "${refLabel}".`
  };
}

function chooseDeliveryMode(mediaRef, { target = null, capabilities = null } = {}) {
  const override = getTargetMediaOverride(target, mediaRef.ref);
  const delivery = normalizeDeliveryConfig(override, mediaRef.delivery);
  const orderedModes = buildDeliveryOrder(delivery);

  const failures = [];
  for (const mode of orderedModes) {
    const capability = getModeCapability(mediaRef.kind, mode, capabilities);
    const failure = describeCapabilityFailure({ mediaRef, mode, capability });
    if (!failure) {
      return mode;
    }
    failures.push({ mode, ...failure });
    if (!delivery.allowFallback) break;
  }

  const capabilityFailure = failures.find((entry) => entry.kind === 'capability');
  if (capabilityFailure) {
    throw buildCapabilityMismatch(capabilityFailure.message, {
      mediaDelivery: {
        ref: mediaRef.ref,
        mode: capabilityFailure.mode,
        failures
      }
    });
  }

  const available = orderedModes.join(', ') || 'none';
  throw new Error(`Media delivery could not resolve a usable mode for ref "${mediaRef.ref}". Tried: ${available}.`);
}

function buildResolvedAttachment(mediaRef, deliveryMode) {
  const base = {
    ref: mediaRef.ref,
    kind: mediaRef.kind,
    role: mediaRef.role,
    deliveryMode,
    mimeType: mediaRef.metadata.mimeType,
    metadata: { ...mediaRef.metadata },
    sourceSummary: {
      sourcePath: mediaRef.source?.path || null,
      stagedUrlType: mediaRef.staged?.urlType || null
    }
  };

  if (deliveryMode === 'url') {
    return {
      ...base,
      url: mediaRef.staged.url,
      path: null,
      data: null
    };
  }

  return {
    ...base,
    url: null,
    path: mediaRef.source?.path || null,
    data: null
  };
}

function getConfiguredRefNames(config = {}, domain = 'video') {
  const refNames = ensureArray(config?.ai?.[domain]?.inputRefs)
    .map((value) => compactString(value))
    .filter(Boolean);

  if (refNames.length > 0) return refNames;

  const mediaRefs = config?.asset?.media?.refs;
  if (!mediaRefs || typeof mediaRefs !== 'object') return [];

  const domainKind = inferKindFromDomain(domain);
  const preferred = Object.entries(mediaRefs)
    .filter(([, refConfig]) => compactString(refConfig?.role || 'primary') === 'primary'
      && compactString(refConfig?.kind || domainKind) === domainKind)
    .map(([refName]) => refName);
  if (preferred.length > 0) return preferred;

  return Object.keys(mediaRefs);
}

function deriveFallbackRef({ config = {}, domain = 'video', assetPath, baseDir = process.cwd() } = {}) {
  const kind = inferKindFromDomain(domain);
  const configuredInputPath = compactString(config?.asset?.inputPath);
  const configuredStagedUrl = compactString(config?.asset?.stagedPublicUrl || config?.asset?.stagedUrl);
  const sourcePath = resolveRelativePath(configuredInputPath || assetPath, baseDir);
  const filename = path.basename(sourcePath || configuredStagedUrl || `asset.${kind}`);
  const mimeType = compactString(config?.asset?.mimeType) || detectMimeType(sourcePath || configuredStagedUrl || filename);
  const sourceStats = sourcePath && fs.existsSync(sourcePath) ? fs.statSync(sourcePath) : null;
  const durationSeconds = Number(config?.asset?.durationSeconds);

  return {
    ref: `${kind}_asset`,
    kind,
    role: 'primary',
    source: sourcePath ? { path: sourcePath } : {},
    staged: configuredStagedUrl
      ? {
          url: configuredStagedUrl,
          urlType: compactString(config?.asset?.urlType) || 'public',
          expiresAt: config?.asset?.expiresAt || null
        }
      : {},
    delivery: {
      preferredMode: configuredStagedUrl ? 'url' : 'inline',
      allowedModes: configuredStagedUrl ? ['url', 'inline'] : ['inline'],
      allowFallback: configuredStagedUrl
    },
    metadata: {
      filename,
      mimeType,
      sizeBytes: sourceStats?.size || null,
      durationSeconds: Number.isFinite(durationSeconds) && durationSeconds > 0 ? durationSeconds : null
    }
  };
}

function validateMediaDeliveryConfig(config = {}) {
  const errors = [];
  const refs = config?.asset?.media?.refs;

  if (refs !== undefined && (!refs || typeof refs !== 'object' || Array.isArray(refs))) {
    errors.push('asset.media.refs must be an object when provided');
    return errors;
  }

  for (const [refName, refConfig] of Object.entries(refs || {})) {
    const basePath = `asset.media.refs.${refName}`;
    const kind = compactString(refConfig?.kind);
    if (kind && !VALID_MEDIA_KINDS.has(kind)) {
      errors.push(`${basePath}.kind must be one of: ${Array.from(VALID_MEDIA_KINDS).join(', ')}`);
    }

    const urlType = compactString(refConfig?.staged?.urlType);
    if (urlType && !VALID_URL_TYPES.has(urlType)) {
      errors.push(`${basePath}.staged.urlType must be one of: ${Array.from(VALID_URL_TYPES).join(', ')}`);
    }

    const stagedUrl = compactString(refConfig?.staged?.url);
    if (stagedUrl && !/^https?:\/\//i.test(stagedUrl)) {
      errors.push(`${basePath}.staged.url must be an http(s) URL when provided`);
    }

    const preferredModeRaw = refConfig?.delivery?.preferredMode;
    if (preferredModeRaw !== undefined && !normalizeDeliveryMode(preferredModeRaw)) {
      errors.push(`${basePath}.delivery.preferredMode must be one of: provider_default, url, inline`);
    }

    const allowedModes = refConfig?.delivery?.allowedModes;
    if (allowedModes !== undefined) {
      if (!Array.isArray(allowedModes)) {
        errors.push(`${basePath}.delivery.allowedModes must be an array when provided`);
      } else if (normalizeAllowedModes(allowedModes).length !== allowedModes.length) {
        errors.push(`${basePath}.delivery.allowedModes may only contain: url, inline`);
      }
    }
  }

  for (const [domain, domainConfig] of Object.entries(config?.ai || {})) {
    if (!domainConfig || typeof domainConfig !== 'object' || Array.isArray(domainConfig)) continue;
    const inputRefs = ensureArray(domainConfig.inputRefs);
    inputRefs.forEach((refName, index) => {
      const normalized = compactString(refName);
      if (!normalized || !refs || !refs[normalized]) {
        errors.push(`ai.${domain}.inputRefs[${index}] references unknown media ref "${refName}"`);
      }
    });
  }

  return errors;
}

function resolveMediaAttachmentsForTarget({ config = {}, domain = 'video', assetPath, target = null, baseDir = process.cwd(), capabilities = null } = {}) {
  const configuredRefs = config?.asset?.media?.refs;
  const refNames = getConfiguredRefNames(config, domain);

  const mediaRefs = [];
  if (configuredRefs && typeof configuredRefs === 'object' && refNames.length > 0) {
    for (const refName of refNames) {
      if (!configuredRefs[refName]) {
        throw new Error(`Configured media inputRefs for domain "${domain}" did not match any asset.media.refs entry.`);
      }
      mediaRefs.push(normalizeMediaRef(refName, configuredRefs[refName], {
        assetPath,
        domain,
        baseDir
      }));
    }
  } else {
    mediaRefs.push(deriveFallbackRef({ config, domain, assetPath, baseDir }));
  }

  return mediaRefs.map((mediaRef) => {
    const deliveryMode = chooseDeliveryMode(mediaRef, { target, capabilities });
    const baseAttachment = buildResolvedAttachment(mediaRef, deliveryMode);

    if (deliveryMode === 'url') {
      return {
        ref: mediaRef.ref,
        type: mediaRef.kind,
        url: baseAttachment.url,
        mimeType: mediaRef.metadata.mimeType,
        deliveryMode,
        metadata: { ...mediaRef.metadata },
        sourceSummary: { ...baseAttachment.sourceSummary }
      };
    }

    const data = fs.readFileSync(mediaRef.source.path).toString('base64');
    return {
      ref: mediaRef.ref,
      type: mediaRef.kind,
      data,
      mimeType: mediaRef.metadata.mimeType,
      deliveryMode,
      metadata: { ...mediaRef.metadata },
      sourceSummary: { ...baseAttachment.sourceSummary }
    };
  });
}

function pickDomainMediaRef(config = {}, domain = 'video') {
  const inputRefs = ensureArray(config?.ai?.[domain]?.inputRefs);
  const refs = config?.asset?.media?.refs;
  if (!refs || typeof refs !== 'object') return null;

  const refName = compactString(inputRefs[0]);
  if (refName && refs[refName]) {
    return { refName, mediaRef: refs[refName] };
  }

  const first = Object.keys(refs)[0];
  return first ? { refName: first, mediaRef: refs[first] } : null;
}

function resolveVideoContextForTarget({ config = {}, target = {}, videoContext = {} } = {}) {
  if (!videoContext || typeof videoContext !== 'object' || Array.isArray(videoContext)) {
    return videoContext;
  }

  const refInfo = pickDomainMediaRef(config, 'video');
  const refName = refInfo?.refName || null;
  const mediaRef = refInfo?.mediaRef || null;
  const override = getTargetMediaOverride(target, refName);

  const preferredMode = normalizeDeliveryMode(override?.preferredMode)
    || normalizeDeliveryMode(mediaRef?.delivery?.preferredMode)
    || normalizeDeliveryMode(videoContext?.deliveryMode)
    || normalizeDeliveryMode(videoContext?.transferStrategy)
    || 'provider_default';

  const hintedMode = normalizeDeliveryMode(videoContext?.deliveryMode)
    || normalizeDeliveryMode(videoContext?.transferStrategy)
    || 'inline';

  const allowedModes = normalizeAllowedModes(ensureArray(override?.allowedModes).length > 0
    ? override.allowedModes
    : mediaRef?.delivery?.allowedModes);
  const allowFallback = override?.allowFallback ?? mediaRef?.delivery?.allowFallback ?? true;

  const explicitChunkPath = compactString(videoContext?.chunkPath) || null;
  const configuredSourcePath = compactString(mediaRef?.source?.path)
    || compactString(config?.asset?.inputPath)
    || null;
  const usesConfiguredSourceAsset = !explicitChunkPath || sameResolvedPath(explicitChunkPath, configuredSourcePath);
  const explicitChunkUrl = compactString(videoContext?.url) || null;

  const stagedUrl = explicitChunkUrl
    || (usesConfiguredSourceAsset
      ? (compactString(mediaRef?.staged?.url)
        || compactString(config?.asset?.stagedPublicUrl)
        || null)
      : null);

  const sourcePath = explicitChunkPath
    || configuredSourcePath
    || null;

  const inlineData = compactString(videoContext?.chunkBase64)
    || compactString(videoContext?.base64)
    || compactString(videoContext?.data)
    || null;

  const mimeType = compactString(videoContext?.mimeType)
    || compactString(mediaRef?.metadata?.mimeType)
    || compactString(config?.asset?.mimeType)
    || 'video/mp4';

  const effectivePreferredMode = (!explicitChunkUrl && explicitChunkPath && !usesConfiguredSourceAsset && preferredMode === 'url')
    ? hintedMode
    : preferredMode;

  const candidateModes = [];
  const pushMode = (mode) => {
    if (mode && mode !== 'provider_default' && !candidateModes.includes(mode)) {
      candidateModes.push(mode);
    }
  };

  if (effectivePreferredMode && effectivePreferredMode !== 'provider_default') {
    pushMode(effectivePreferredMode);
    if (allowFallback) pushMode(effectivePreferredMode === 'url' ? 'inline' : 'url');
  } else {
    pushMode(hintedMode || 'inline');
    if (allowFallback) pushMode((hintedMode || 'inline') === 'url' ? 'inline' : 'url');
  }

  const filteredModes = allowedModes.length > 0
    ? candidateModes.filter((mode) => allowedModes.includes(mode))
    : candidateModes;

  const scopedMediaRefConfig = refName
    ? {
        ...(mediaRef || {}),
        source: sourcePath ? { ...(mediaRef?.source || {}), path: sourcePath } : (mediaRef?.source || {}),
        staged: stagedUrl ? { ...(mediaRef?.staged || {}), url: stagedUrl } : {}
      }
    : null;

  const normalizedMediaRef = refName
    ? normalizeMediaRef(refName, scopedMediaRefConfig || {}, { assetPath: sourcePath || config?.asset?.inputPath, domain: 'video' })
    : null;

  for (const mode of filteredModes) {
    if (mode === 'url' && stagedUrl) {
      const resolved = {
        ...videoContext,
        url: stagedUrl,
        deliveryMode: 'url',
        transferStrategy: 'url',
        mimeType,
        sourcePath,
        resolvedAttachment: normalizedMediaRef ? buildResolvedAttachment(normalizedMediaRef, 'url') : null
      };
      delete resolved.chunkPath;
      delete resolved.chunkBase64;
      delete resolved.base64;
      delete resolved.data;
      return resolved;
    }

    if (mode === 'inline' && (inlineData || sourcePath)) {
      return {
        ...videoContext,
        chunkPath: explicitChunkPath || sourcePath,
        deliveryMode: 'inline',
        transferStrategy: 'base64',
        mimeType,
        sourcePath,
        resolvedAttachment: normalizedMediaRef ? buildResolvedAttachment(normalizedMediaRef, 'inline') : null
      };
    }
  }

  const adapterName = target?.adapter?.name || config?.ai?.provider || 'provider';
  const refLabel = refName ? `media ref "${refName}"` : 'video input';
  throw new Error(
    `Video delivery resolution failed for ${refLabel} on ${adapterName}: ` +
    `preferredMode=${effectivePreferredMode}, allowFallback=${allowFallback}, stagedUrl=${stagedUrl ? 'present' : 'missing'}, sourcePath=${sourcePath ? 'present' : 'missing'}`
  );
}

function resolveMediaInput({ config = {}, domain = 'video', assetPath, target = null, baseDir = process.cwd(), capabilities = null } = {}) {
  const configuredRefs = config?.asset?.media?.refs;
  const refNames = getConfiguredRefNames(config, domain);

  let mediaRef = null;
  if (configuredRefs && typeof configuredRefs === 'object' && refNames.length > 0) {
    const refName = refNames.find((candidate) => configuredRefs[candidate]);
    if (!refName) {
      throw new Error(`Configured media inputRefs for domain "${domain}" did not match any asset.media.refs entry.`);
    }
    mediaRef = normalizeMediaRef(refName, configuredRefs[refName], { assetPath, domain, baseDir });
  } else {
    mediaRef = deriveFallbackRef({ config, domain, assetPath, baseDir });
  }

  const deliveryMode = chooseDeliveryMode(mediaRef, { target, capabilities });
  return {
    mediaRef,
    resolvedAttachment: buildResolvedAttachment(mediaRef, deliveryMode)
  };
}

module.exports = {
  VALID_DELIVERY_MODES,
  VALID_URL_TYPES,
  VALID_MEDIA_KINDS,
  detectMimeType,
  normalizeDeliveryMode,
  normalizeAllowedModes,
  normalizeMediaRef,
  validateMediaDeliveryConfig,
  chooseDeliveryMode,
  buildResolvedAttachment,
  resolveMediaInput,
  resolveMediaAttachmentsForTarget,
  pickDomainMediaRef,
  resolveVideoContextForTarget
};
