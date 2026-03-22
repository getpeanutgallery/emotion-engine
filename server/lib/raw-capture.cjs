#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const outputManager = require('./output-manager.cjs');

const SECRET_HEADER_KEY_RE = /^(authorization|x-api-key|api[_-]?key|proxy-authorization)$/i;
const SECRET_FIELD_KEY_RE = /(authorization|api[_-]?key|secret|token|password|session|cookie|set-cookie)/i;
const SECRET_VALUE_PATTERNS = [
  { pattern: /Bearer\s+[A-Za-z0-9._~+/=-]{8,}/gi, replacement: 'Bearer [REDACTED]' },
  { pattern: /\bsk-(?:or-|proj-)?[A-Za-z0-9_-]{8,}\b/g, replacement: '[REDACTED_SECRET]' },
  { pattern: /\bAIza[0-9A-Za-z_-]{20,}\b/g, replacement: '[REDACTED_SECRET]' },
  { pattern: /([?&](?:api[_-]?key|token|key|auth)=)[^&\s]+/gi, replacement: '$1[REDACTED]' }
];

function shouldCaptureRaw(config) {
  return !!config?.debug?.captureRaw;
}

function getRawPhaseDir(outputDir, phaseKey) {
  return outputManager.getPhaseRawDirectory(outputDir, phaseKey);
}

function sanitizeSecretString(value) {
  if (typeof value !== 'string') return value;

  let sanitized = value;
  for (const { pattern, replacement } of SECRET_VALUE_PATTERNS) {
    sanitized = sanitized.replace(pattern, replacement);
  }
  return sanitized;
}

function sanitizeRawCaptureValue(value, depth = 0, seen = new WeakSet(), keyHint = '') {
  if (value === null || value === undefined) return value;
  if (depth > 8) return '[Truncated]';

  if (typeof value === 'string') {
    if (SECRET_FIELD_KEY_RE.test(keyHint)) {
      return '[REDACTED]';
    }
    return sanitizeSecretString(value);
  }

  if (typeof value !== 'object') return value;

  if (seen.has(value)) return '[Circular]';
  seen.add(value);

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeRawCaptureValue(item, depth + 1, seen, keyHint));
  }

  const out = {};
  for (const [key, item] of Object.entries(value)) {
    if (SECRET_HEADER_KEY_RE.test(key) || SECRET_FIELD_KEY_RE.test(key)) {
      out[key] = '[REDACTED]';
      continue;
    }
    out[key] = sanitizeRawCaptureValue(item, depth + 1, seen, key);
  }

  return out;
}

function writeRawJson(baseDir, relativePath, payload) {
  const fullPath = path.join(baseDir, relativePath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  const sanitizedPayload = sanitizeRawCaptureValue(payload);
  fs.writeFileSync(fullPath, JSON.stringify(sanitizedPayload, null, 2), 'utf8');
  return fullPath;
}

module.exports = {
  shouldCaptureRaw,
  getRawPhaseDir,
  sanitizeRawCaptureValue,
  sanitizeSecretString,
  writeRawJson
};
