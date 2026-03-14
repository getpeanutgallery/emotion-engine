#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const test = require('node:test');

const {
  normalizeRecoveryConfig,
  validateRecoveryConfig,
  lookupDeterministicRecoveryDeclaration,
  wrapLegacySuccessResult,
  createFailureResult
} = require('../../server/lib/script-contract.cjs');
const { executeScript } = require('../../server/lib/script-runner.cjs');

function makeTempDir(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

test('script-contract - normalizeRecoveryConfig applies safe defaults', () => {
  const normalized = normalizeRecoveryConfig({
    ai: {
      enabled: true,
      adapter: 'google',
      model: 'gemini-3.1-pro-preview'
    }
  });

  assert.strictEqual(normalized.ai.enabled, true);
  assert.strictEqual(normalized.ai.adapter, 'google');
  assert.strictEqual(normalized.ai.model, 'gemini-3.1-pro-preview');
  assert.strictEqual(normalized.ai.attempts.maxPerFailure, 1);
  assert.strictEqual(normalized.deterministic.maxAttemptsPerFailure, 2);
});

test('script-contract - validateRecoveryConfig rejects malformed policy fields', () => {
  const result = validateRecoveryConfig({
    ai: {
      enabled: 'yes',
      attempts: { maxPerFailure: -1 }
    }
  });

  assert.strictEqual(result.valid, false);
  assert(result.errors.some((entry) => entry.includes('recovery.ai.enabled')));
  assert(result.errors.some((entry) => entry.includes('recovery.ai.attempts.maxPerFailure')));
});

test('script-contract - deterministic declaration lookup is centralized by family', () => {
  const declaration = lookupDeterministicRecoveryDeclaration({ scriptId: 'recommendation' });
  assert.strictEqual(declaration.family, 'ai.structured-output.v1');
  assert(declaration.knownStrategies.some((entry) => entry.id === 'repair-with-validator-tool-loop'));
});

test('script-contract - wrapLegacySuccessResult persists canonical success envelope and execution refs', () => {
  const outputDir = makeTempDir('ee-script-success-');
  const phaseRawMetaDir = path.join(outputDir, 'phase1-gather-context', 'raw', '_meta');
  fs.mkdirSync(phaseRawMetaDir, { recursive: true });
  fs.writeFileSync(path.join(phaseRawMetaDir, 'errors.summary.json'), JSON.stringify({ ok: true }), 'utf8');

  const promptFile = path.join(outputDir, 'raw', 'ai', '_prompts', 'abc.json');
  fs.mkdirSync(path.dirname(promptFile), { recursive: true });
  fs.writeFileSync(promptFile, JSON.stringify({ prompt: 'hello' }), 'utf8');

  const wrapped = wrapLegacySuccessResult({
    result: {
      artifacts: {
        dialogueData: {
          summary: 'hello world',
          promptRef: { sha256: 'abc', file: 'raw/ai/_prompts/abc.json' }
        }
      }
    },
    phase: 'phase1-gather-context',
    script: 'get-dialogue',
    config: { name: 'test-run', debug: { captureRaw: true } },
    outputDir,
    previousExecution: null,
    startedAt: new Date('2026-03-14T18:00:00.000Z'),
    completedAt: new Date('2026-03-14T18:00:01.000Z')
  });

  assert.strictEqual(wrapped.scriptResult.status, 'success');
  assert.strictEqual(wrapped.scriptResult.payload.artifactKey, 'dialogueData');
  assert(wrapped.scriptResult.diagnostics.captureRefs.includes('raw/ai/_prompts/abc.json'));
  assert(wrapped.scriptResult.diagnostics.captureRefs.includes('phase1-gather-context/raw/_meta/errors.summary.json'));

  const resultPath = path.join(outputDir, 'phase1-gather-context', 'script-results', 'get-dialogue.success.json');
  const lineagePath = path.join(outputDir, 'phase1-gather-context', 'recovery', 'get-dialogue', 'lineage.json');
  assert(fs.existsSync(resultPath));
  assert(fs.existsSync(lineagePath));

  assert.strictEqual(wrapped.artifacts.__scriptExecution['get-dialogue'].refs.result, 'phase1-gather-context/script-results/get-dialogue.success.json');
});

test('script-contract - createFailureResult persists next-action and lineage for shared recovery plumbing', () => {
  const outputDir = makeTempDir('ee-script-failure-');
  const phaseRawMetaDir = path.join(outputDir, 'phase2-process', 'raw', '_meta');
  fs.mkdirSync(phaseRawMetaDir, { recursive: true });
  fs.writeFileSync(path.join(phaseRawMetaDir, 'errors.jsonl'), '{"kind":"error"}\n', 'utf8');

  const failure = createFailureResult({
    phase: 'phase2-process',
    script: 'video-chunks',
    config: {
      name: 'test-run',
      recovery: {
        ai: {
          enabled: true,
          adapter: 'google',
          model: 'gemini-3.1-pro-preview'
        }
      }
    },
    outputDir,
    error: new Error('Validation failed: malformed JSON from provider'),
    previousExecution: null,
    declaration: lookupDeterministicRecoveryDeclaration({ scriptId: 'video-chunks' }),
    startedAt: new Date('2026-03-14T18:00:00.000Z'),
    completedAt: new Date('2026-03-14T18:00:02.000Z')
  });

  assert.strictEqual(failure.envelope.status, 'failure');
  assert.strictEqual(failure.envelope.failure.category, 'invalid_output');
  assert.strictEqual(failure.envelope.recoveryPolicy.nextAction.policy, 'deterministic_recovery');
  assert.strictEqual(failure.envelope.recoveryPolicy.nextAction.target, 'repair-with-validator-tool-loop');
  assert(failure.envelope.diagnostics.rawCaptureRefs.includes('phase2-process/raw/_meta/errors.jsonl'));

  const nextActionPath = path.join(outputDir, 'phase2-process', 'recovery', 'video-chunks', 'next-action.json');
  assert(fs.existsSync(nextActionPath));
  assert.strictEqual(failure.result.artifacts.__scriptExecution['video-chunks'].refs.nextAction, 'phase2-process/recovery/video-chunks/next-action.json');
});

test('script-runner - executeScript wraps legacy success results without migrating the script module', async () => {
  const scriptDir = makeTempDir('ee-script-module-');
  const scriptPath = path.join(scriptDir, 'success-script.cjs');
  fs.writeFileSync(scriptPath, "module.exports.run = async () => ({ artifacts: { metadataData: { ok: true } } });\n", 'utf8');

  const outputDir = makeTempDir('ee-script-runner-');
  const result = await executeScript({
    phase: 'phase1-gather-context',
    scriptPath,
    input: {
      outputDir,
      config: { name: 'runner-test' },
      artifacts: {}
    }
  });

  assert.strictEqual(result.scriptResult.status, 'success');
  assert.strictEqual(result.artifacts.metadataData.ok, true);
  assert(result.artifacts.__scriptExecution['success-script']);
});
