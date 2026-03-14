#!/usr/bin/env node
'use strict';

function normalizeRecoveryTextList(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
    .filter(Boolean);
}

function getRecoveryRuntime(input = {}) {
  const runtime = input?.recoveryRuntime;
  if (!runtime || typeof runtime !== 'object' || Array.isArray(runtime)) {
    return null;
  }

  const repairInstructions = normalizeRecoveryTextList(runtime.repairInstructions);
  const boundedContextSummary = typeof runtime.boundedContextSummary === 'string' && runtime.boundedContextSummary.trim().length > 0
    ? runtime.boundedContextSummary.trim()
    : null;

  if (repairInstructions.length === 0 && !boundedContextSummary) {
    return null;
  }

  return {
    attempt: Number.isInteger(runtime.attempt) && runtime.attempt > 0 ? runtime.attempt : 1,
    sourceFailureId: typeof runtime.sourceFailureId === 'string' && runtime.sourceFailureId.trim().length > 0
      ? runtime.sourceFailureId.trim()
      : null,
    repairInstructions,
    boundedContextSummary
  };
}

function buildRecoveryPromptAddendum(recoveryRuntime, { heading = 'AI RECOVERY RE-ENTRY' } = {}) {
  if (!recoveryRuntime) return '';

  const lines = [
    '',
    `${heading}:`,
    '- This is a bounded same-script recovery re-entry attempt.',
    '- Preserve the original task and schema; only repair the failing output behavior.',
    '- Return JSON only with the exact required schema.',
    '- Do not change unrelated semantics or invent new upstream facts.'
  ];

  if (recoveryRuntime.boundedContextSummary) {
    lines.push('', 'Bounded context summary:', recoveryRuntime.boundedContextSummary);
  }

  if (recoveryRuntime.repairInstructions.length > 0) {
    lines.push('', 'Repair instructions:');
    for (const instruction of recoveryRuntime.repairInstructions) {
      lines.push(`- ${instruction}`);
    }
  }

  return lines.join('\n');
}

module.exports = {
  getRecoveryRuntime,
  buildRecoveryPromptAddendum
};
