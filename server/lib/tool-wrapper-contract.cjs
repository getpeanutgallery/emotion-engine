#!/usr/bin/env node
'use strict';

function cloneJson(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function createStructuredError(message, options = {}) {
  const error = new Error(message || options?.message || 'Tool-wrapper failure');
  const metadata = createFailureMetadata({
    message,
    ...options
  });
  Object.assign(error, metadata);
  if (options?.cause) {
    error.cause = options.cause;
  }
  return error;
}

function createFailureMetadata({
  category = 'tool',
  code = 'TOOL_WRAPPER_FAILURE',
  stage = 'tool.wrapper',
  message = null,
  diagnostics = null,
  payload = null,
  retryable,
  systemCode,
  pathNormalizationEligible = false
} = {}) {
  const normalizedDiagnostics = diagnostics && typeof diagnostics === 'object'
    ? cloneJson(diagnostics)
    : null;

  return {
    failureCategory: category,
    failureCode: code,
    stage,
    diagnostics: normalizedDiagnostics,
    payload: payload ? cloneJson(payload) : null,
    retryable: typeof retryable === 'boolean' ? retryable : ['tool', 'timeout', 'invalid_output'].includes(category),
    pathNormalizationEligible: !!pathNormalizationEligible,
    systemCode: systemCode || null,
    message: message || null
  };
}

function createFailureResult(message, options = {}) {
  const metadata = createFailureMetadata({
    message,
    ...options
  });

  return {
    success: false,
    error: message || options?.message || 'Tool-wrapper failure',
    failure: metadata
  };
}

function applyFailureMetadata(error, metadata, extra = {}) {
  if (!error || typeof error !== 'object' || !metadata || typeof metadata !== 'object') {
    return error;
  }

  Object.assign(error, metadata, extra);
  return error;
}

function looksLikeMissingPath(text) {
  const value = String(text || '').toLowerCase();
  return value.includes('no such file')
    || value.includes('not found')
    || value.includes('could not open')
    || value.includes('unable to find')
    || value.includes('input/output error')
    || value.includes('invalid argument');
}

function createCommandFailure({
  stage,
  code,
  command,
  args = [],
  stdout = '',
  stderr = '',
  exitCode = null,
  message = null,
  tool = null,
  outputPath = null
} = {}) {
  const combined = `${stdout || ''}\n${stderr || ''}`;
  const missingPath = looksLikeMissingPath(combined);
  const category = missingPath ? 'dependency' : 'tool';

  return createFailureResult(message || `${tool || 'command'} failed`, {
    category,
    code,
    stage,
    retryable: true,
    pathNormalizationEligible: missingPath,
    diagnostics: {
      tool: tool || null,
      command: command || null,
      args,
      stdout,
      stderr,
      exitCode,
      outputPath: outputPath || null
    }
  });
}

function createPathFailure({ stage, code, message, path, systemCode = null, retryable = true } = {}) {
  return createFailureResult(message || 'Path resolution failed', {
    category: 'dependency',
    code,
    stage,
    retryable,
    pathNormalizationEligible: true,
    systemCode,
    diagnostics: {
      path: path || null
    }
  });
}

function createIoFailure({ stage, code, message, path, systemCode = null, retryable = false, diagnostics = null } = {}) {
  return createFailureResult(message || 'I/O failure', {
    category: 'io',
    code,
    stage,
    retryable,
    pathNormalizationEligible: false,
    systemCode,
    diagnostics: {
      path: path || null,
      ...(diagnostics && typeof diagnostics === 'object' ? diagnostics : {})
    }
  });
}

function createInvalidOutputFailure({ stage, code, message, diagnostics = null, retryable = true } = {}) {
  return createFailureResult(message || 'Invalid output', {
    category: 'invalid_output',
    code,
    stage,
    retryable,
    diagnostics
  });
}

module.exports = {
  createStructuredError,
  createFailureMetadata,
  createFailureResult,
  applyFailureMetadata,
  createCommandFailure,
  createPathFailure,
  createIoFailure,
  createInvalidOutputFailure,
  looksLikeMissingPath
};
