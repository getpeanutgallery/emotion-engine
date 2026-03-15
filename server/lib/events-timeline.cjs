#!/usr/bin/env node

'use strict';

/**
 * Raw events timeline capture.
 *
 * Always emits (creates) a run-level file:
 *   <runOutputDir>/_meta/events.jsonl
 *
 * This file is intended to be stable and append-only, providing a chronological
 * view of the pipeline execution.
 *
 * Historical runs may still contain:
 *   <runOutputDir>/raw/_meta/events.jsonl
 */

const fs = require('fs');
const path = require('path');
const outputManager = require('./output-manager.cjs');

const SCHEMA_VERSION = 1;

function getCaptureMode() {
  return (process.env.DIGITAL_TWIN_MODE || '').trim().toLowerCase() === 'replay'
    ? 'replay'
    : 'record';
}

function shouldCaptureRawEvents(config) {
  // Default ON. Allow explicit opt-out.
  if (config && config.debug && Object.prototype.hasOwnProperty.call(config.debug, 'captureRawEvents')) {
    return config.debug.captureRawEvents !== false;
  }
  return true;
}

function ensureFileExists(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, '', 'utf8');
  }
}

function safeRelativePath(runOutputDir, absolutePath) {
  try {
    const rel = path.relative(runOutputDir, absolutePath);
    return rel.split(path.sep).join('/');
  } catch {
    return null;
  }
}

function sanitizeEventValue(value, depth = 0, seen = new WeakSet()) {
  if (value === null || value === undefined) return value;
  if (depth > 8) return '[Truncated]';

  if (typeof value === 'string') {
    if (value.startsWith('Bearer ')) return 'Bearer [REDACTED]';
    return value;
  }

  if (typeof value !== 'object') return value;

  if (seen.has(value)) return '[Circular]';
  seen.add(value);

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeEventValue(item, depth + 1, seen));
  }

  const out = {};
  for (const [k, v] of Object.entries(value)) {
    if (/authorization/i.test(k) || /api[_-]?key/i.test(k) || /token/i.test(k)) {
      out[k] = '[REDACTED]';
      continue;
    }
    out[k] = sanitizeEventValue(v, depth + 1, seen);
  }
  return out;
}

const LOGGERS = new Map();

function getEventsLogger({ outputDir, config } = {}) {
  if (!outputDir) {
    throw new Error('getEventsLogger: outputDir is required');
  }

  const runOutputDir = outputManager.resolveRunOutputDir(path.resolve(outputDir));
  const key = runOutputDir;

  const existing = LOGGERS.get(key);
  if (existing) {
    ensureFileExists(existing.eventsPath);
    return existing;
  }

  const enabled = shouldCaptureRawEvents(config);
  const eventsPath = path.join(runOutputDir, '_meta', 'events.jsonl');

  // Always create the file (even when disabled) so tooling can rely on it.
  ensureFileExists(eventsPath);

  let seq = 0;
  try {
    const existingText = fs.readFileSync(eventsPath, 'utf8');
    seq = existingText.split('\n').filter(Boolean).length;
  } catch {
    seq = 0;
  }

  const logger = {
    runOutputDir,
    eventsPath,
    enabled,
    emit: (event) => {
      if (!enabled) return null;

      // Tests and callers may delete output dirs between runs; re-ensure on each emit.
      ensureFileExists(eventsPath);

      seq += 1;

      const base = {
        schemaVersion: SCHEMA_VERSION,
        seq,
        ts: new Date().toISOString(),
        mode: getCaptureMode(),
      };

      const payload = sanitizeEventValue({
        ...base,
        ...(event && typeof event === 'object' ? event : { kind: 'event', value: event })
      });

      const compact = {};
      for (const [k, v] of Object.entries(payload)) {
        if (v === undefined) continue;
        compact[k] = v;
      }

      fs.appendFileSync(eventsPath, `${JSON.stringify(compact)}\n`, 'utf8');
      return compact;
    },
    artifactWrite: ({ absolutePath, role, phase, script, extra } = {}) => {
      if (!enabled) return null;
      if (!absolutePath) return null;

      return logger.emit({
        kind: 'artifact.write',
        path: safeRelativePath(runOutputDir, absolutePath) || null,
        role: role || null,
        phase: phase || null,
        script: script || null,
        ...(extra && typeof extra === 'object' ? { extra } : {})
      });
    },
    error: ({ message, phase, script, where, extra } = {}) => {
      if (!enabled) return null;

      return logger.emit({
        kind: 'error',
        message: message || null,
        phase: phase || null,
        script: script || null,
        where: where || null,
        ...(extra && typeof extra === 'object' ? { extra } : {})
      });
    }
  };

  LOGGERS.set(key, logger);
  return logger;
}

module.exports = {
  getEventsLogger,
  shouldCaptureRawEvents,
  getCaptureMode,
};
