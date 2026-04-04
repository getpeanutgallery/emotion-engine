function extractBalancedJsonObject(text) {
  if (typeof text !== 'string') return null;

  let start = -1;
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];

    if (inString) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (ch === '\\') {
        escaped = true;
        continue;
      }
      if (ch === '"') {
        inString = false;
      }
      continue;
    }

    if (ch === '"') {
      inString = true;
      continue;
    }

    if (ch === '{') {
      if (depth === 0) start = i;
      depth += 1;
      continue;
    }

    if (ch === '}') {
      if (depth > 0) {
        depth -= 1;
        if (depth === 0 && start >= 0) {
          return text.slice(start, i + 1);
        }
      }
    }
  }

  return null;
}

function parseMinuteSecondTimestampToSeconds(value) {
  if (typeof value !== 'string') return null;

  const match = value.trim().match(/^(\d+):([0-5]\d)(\.\d+)?$/);
  if (!match) return null;

  const minutes = Number(match[1]);
  const seconds = Number(`${match[2]}${match[3] || ''}`);
  if (!Number.isFinite(minutes) || !Number.isFinite(seconds)) return null;

  return (minutes * 60) + seconds;
}

function normalizeUnquotedTimestampFields(candidate, keys = []) {
  if (typeof candidate !== 'string' || !Array.isArray(keys) || keys.length === 0) return candidate;

  const escapedKeys = keys
    .filter((key) => typeof key === 'string' && key.trim().length > 0)
    .map((key) => key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));

  if (escapedKeys.length === 0) return candidate;

  const pattern = new RegExp(`("(?:${escapedKeys.join('|')})"\\s*:\\s*)(\\d+:\\d{2}(?:\\.\\d+)?)(?=\\s*[,}\\]])`, 'g');
  return candidate.replace(pattern, (match, prefix, timestamp) => {
    const normalized = parseMinuteSecondTimestampToSeconds(timestamp);
    return normalized === null ? match : `${prefix}${normalized}`;
  });
}

function normalizeJsonCandidate(candidate, options = {}) {
  if (typeof candidate !== 'string') return candidate;

  let text = candidate.trim();
  if (!text) return text;

  text = text.replace(/^\uFEFF/, '');
  text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  text = text.replace(/^json\s*/i, '').trim();
  text = text.replace(/,\s*([}\]])/g, '$1');

  if (Array.isArray(options.repairTimestampKeys) && options.repairTimestampKeys.length > 0) {
    text = normalizeUnquotedTimestampFields(text, options.repairTimestampKeys);
  }

  return text;
}

function parseJsonObjectCandidate(candidate) {
  if (typeof candidate !== 'string' || candidate.trim().length === 0) {
    return { ok: false, error: 'empty candidate' };
  }

  try {
    return { ok: true, value: JSON.parse(candidate) };
  } catch (error) {
    return { ok: false, error: error?.message || String(error) };
  }
}

function buildInvalidJsonResult({ raw, candidates, parseError }) {
  return {
    ok: false,
    value: null,
    errors: [
      {
        path: '$',
        code: 'invalid_json',
        message: 'Response was not valid JSON.'
      }
    ],
    summary: parseError
      ? `Response was not valid JSON (${parseError}). Return corrected JSON only.`
      : 'Response was not valid JSON. Return corrected JSON only.',
    meta: {
      stage: 'parse',
      raw,
      extracted: candidates,
      parseError: parseError || null,
      repairApplied: false
    }
  };
}

function parseJsonObjectInput(input, options = {}) {
  if (input && typeof input === 'object' && !Array.isArray(input)) {
    return {
      ok: true,
      value: input,
      errors: [],
      summary: null,
      meta: {
        stage: 'parse',
        raw: null,
        extracted: null,
        parseError: null,
        repairApplied: false,
        sourceType: 'object'
      }
    };
  }

  const raw = typeof input === 'string' ? input : String(input ?? '');
  const trimmed = raw.trim();
  const candidates = [];
  const seen = new Set();

  const pushCandidate = (value) => {
    const normalized = normalizeJsonCandidate(value, options);
    if (typeof normalized !== 'string' || normalized.length === 0) return;
    if (seen.has(normalized)) return;
    seen.add(normalized);
    candidates.push(normalized);
  };

  pushCandidate(trimmed);

  const fencedBlocks = raw.match(/```(?:json)?\s*[\s\S]*?```/gi) || [];
  for (const block of fencedBlocks) {
    pushCandidate(block);
  }

  const balancedObject = extractBalancedJsonObject(raw);
  if (balancedObject) {
    pushCandidate(balancedObject);
  }

  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    const unwrapped = trimmed.slice(1, -1).trim();
    pushCandidate(unwrapped);

    try {
      const reparsed = JSON.parse(trimmed);
      if (typeof reparsed === 'string') {
        pushCandidate(reparsed);
      }
    } catch {
      // Ignore wrapper parse errors.
    }
  }

  let lastError = null;
  for (const candidate of candidates) {
    const parsed = parseJsonObjectCandidate(candidate);
    if (parsed.ok) {
      return {
        ok: true,
        value: parsed.value,
        errors: [],
        summary: null,
        meta: {
          stage: 'parse',
          raw,
          extracted: candidate,
          parseError: null,
          repairApplied: candidate !== normalizeJsonCandidate(raw, options),
          sourceType: 'string'
        }
      };
    }
    lastError = parsed.error;
  }

  return buildInvalidJsonResult({ raw, candidates, parseError: lastError });
}

module.exports = {
  extractBalancedJsonObject,
  parseMinuteSecondTimestampToSeconds,
  normalizeUnquotedTimestampFields,
  normalizeJsonCandidate,
  parseJsonObjectCandidate,
  parseJsonObjectInput
};
