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
  createFailureResult,
  inferApplicableStrategies
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

  const toolWrapper = lookupDeterministicRecoveryDeclaration({ scriptId: 'get-metadata' });
  assert.strictEqual(toolWrapper.family, 'tool.wrapper.v1');
  assert(toolWrapper.knownStrategies.some((entry) => entry.id === 'retry-after-path-normalization'));
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

test('script-contract - inferApplicableStrategies bounds AI-lane deterministic strategies to configured retries/targets', () => {
  const declaration = lookupDeterministicRecoveryDeclaration({ scriptId: 'recommendation' });

  const onlyRepair = inferApplicableStrategies({
    declaration,
    scriptId: 'recommendation',
    config: {
      ai: {
        recommendation: {
          retry: { maxAttempts: 1 },
          targets: [{ adapter: { name: 'openrouter', model: 'test' } }]
        }
      }
    }
  });
  assert.deepStrictEqual(onlyRepair, ['repair-with-validator-tool-loop']);

  const withRetryAndFailover = inferApplicableStrategies({
    declaration,
    scriptId: 'recommendation',
    config: {
      ai: {
        recommendation: {
          retry: { maxAttempts: 2 },
          targets: [
            { adapter: { name: 'openrouter', model: 'test-a', params: { thinking: { level: 'high' } } } },
            { adapter: { name: 'openrouter', model: 'test-b' } }
          ]
        }
      }
    }
  });
  assert.deepStrictEqual(withRetryAndFailover, [
    'repair-with-validator-tool-loop',
    'retry-same-target',
    'failover-next-target',
    'retry-with-lower-thinking'
  ]);

  const toolWrapperDeclaration = lookupDeterministicRecoveryDeclaration({ scriptId: 'get-metadata' });
  const pathNormalizationFirst = inferApplicableStrategies({
    declaration: toolWrapperDeclaration,
    scriptId: 'get-metadata',
    config: {},
    failure: {
      category: 'dependency',
      message: 'Source video not found',
      sourceError: { pathNormalizationEligible: true }
    }
  });
  assert.deepStrictEqual(pathNormalizationFirst, ['retry-after-path-normalization', 're-extract-artifact']);
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
  assert.strictEqual(failure.envelope.recoveryPolicy.nextAction.policy, 'ai_recovery');
  assert.strictEqual(failure.envelope.recoveryPolicy.nextAction.target, 'structured-output-repair');
  assert(failure.envelope.diagnostics.rawCaptureRefs.includes('phase2-process/raw/_meta/errors.jsonl'));

  const nextActionPath = path.join(outputDir, 'phase2-process', 'recovery', 'video-chunks', 'next-action.json');
  assert(fs.existsSync(nextActionPath));
  assert.strictEqual(failure.result.artifacts.__scriptExecution['video-chunks'].refs.nextAction, 'phase2-process/recovery/video-chunks/next-action.json');

  const toolWrapperFailure = createFailureResult({
    phase: 'phase1-gather-context',
    script: 'get-metadata',
    config: { name: 'test-run' },
    outputDir,
    error: Object.assign(new Error('Source video not found: /tmp/missing.mp4'), {
      failureCategory: 'dependency',
      failureCode: 'GET_METADATA_SOURCE_MISSING',
      retryable: true,
      pathNormalizationEligible: true
    }),
    previousExecution: null,
    declaration: lookupDeterministicRecoveryDeclaration({ scriptId: 'get-metadata' }),
    startedAt: new Date('2026-03-14T18:00:03.000Z'),
    completedAt: new Date('2026-03-14T18:00:04.000Z')
  });

  assert.strictEqual(toolWrapperFailure.envelope.failure.category, 'dependency');
  assert.strictEqual(toolWrapperFailure.envelope.failure.retryable, true);
  assert.strictEqual(toolWrapperFailure.envelope.recoveryPolicy.nextAction.policy, 'deterministic_recovery');
  assert.strictEqual(toolWrapperFailure.envelope.recoveryPolicy.nextAction.target, 'retry-after-path-normalization');
});

test('script-contract - createFailureResult advances eligible AI lanes to ai_recovery after applicable deterministic retries are exhausted', () => {
  const outputDir = makeTempDir('ee-script-ai-recovery-');
  const failure = createFailureResult({
    phase: 'phase3-report',
    script: 'recommendation',
    config: {
      name: 'test-run',
      ai: {
        recommendation: {
          retry: { maxAttempts: 1 },
          targets: [{ adapter: { name: 'openrouter', model: 'test-recommendation-model' } }]
        }
      },
      recovery: {
        ai: {
          enabled: true,
          adapter: 'google',
          model: 'gemini-3.1-pro-preview'
        }
      }
    },
    outputDir,
    error: Object.assign(new Error('invalid_output: recommendation tool loop exhausted after 3 turns'), {
      aiTargets: {
        attempts: 1,
        targetIndex: 0,
        targetCount: 1,
        toolLoop: { turns: 3 }
      }
    }),
    previousExecution: null,
    declaration: lookupDeterministicRecoveryDeclaration({ scriptId: 'recommendation' }),
    startedAt: new Date('2026-03-14T18:00:00.000Z'),
    completedAt: new Date('2026-03-14T18:00:02.000Z')
  });

  assert.strictEqual(failure.envelope.recoveryPolicy.deterministic.attempted[0], 'repair-with-validator-tool-loop');
  assert.strictEqual(failure.envelope.recoveryPolicy.deterministic.remaining.length, 0);
  assert.strictEqual(failure.envelope.recoveryPolicy.nextAction.policy, 'ai_recovery');
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

test('script-runner - executeScript performs one bounded AI recovery re-entry for eligible AI lanes', async () => {
  const providerModulePath = require.resolve('ai-providers/ai-provider-interface.js', { paths: [__dirname] });
  const aiTargetsPath = require.resolve('../../server/lib/ai-targets.cjs', { paths: [__dirname] });
  const aiRecoveryPath = require.resolve('../../server/lib/ai-recovery-lane.cjs', { paths: [__dirname] });
  const runnerPath = require.resolve('../../server/lib/script-runner.cjs', { paths: [__dirname] });

  delete require.cache[providerModulePath];
  delete require.cache[aiTargetsPath];
  delete require.cache[aiRecoveryPath];
  delete require.cache[runnerPath];

  let recoveryCallCount = 0;
  require.cache[providerModulePath] = {
    exports: {
      getProviderFromConfig: () => ({
        complete: async () => {
          recoveryCallCount += 1;
          if (recoveryCallCount === 1) {
            return {
              content: JSON.stringify({
                tool: 'validate_ai_recovery_decision_json',
                recoveryDecision: {
                  decision: {
                    outcome: 'reenter_script',
                    reason: 'Repair the JSON shape without changing meaning.',
                    confidence: 'medium',
                    hardFail: false,
                    humanReviewRequired: false
                  },
                  revisedInput: {
                    kind: 'same-script-revised-input',
                    changes: [
                      { path: 'repairInstructions', op: 'set', value: ['Return the required metadataData JSON only.'] },
                      { path: 'boundedContextSummary', op: 'set', value: 'Prior output was malformed JSON.' }
                    ]
                  }
                }
              }),
              usage: { input: 111, output: 44 }
            };
          }

          return {
            content: JSON.stringify({
              decision: {
                outcome: 'reenter_script',
                reason: 'Repair the JSON shape without changing meaning.',
                confidence: 'medium',
                hardFail: false,
                humanReviewRequired: false
              },
              revisedInput: {
                kind: 'same-script-revised-input',
                changes: [
                  { path: 'repairInstructions', op: 'set', value: ['Return the required metadataData JSON only.'] },
                  { path: 'boundedContextSummary', op: 'set', value: 'Prior output was malformed JSON.' }
                ]
              }
            }),
            usage: { input: 111, output: 44 }
          };
        }
      }),
      loadProvider: () => ({ complete: async () => { throw new Error('unexpected'); } })
    },
    loaded: true,
    id: providerModulePath,
    filename: providerModulePath
  };

  const { executeScript: executeScriptWithRecovery } = require('../../server/lib/script-runner.cjs');

  const scriptDir = makeTempDir('ee-script-module-recovery-');
  const scriptPath = path.join(scriptDir, 'recommendation.cjs');
  fs.writeFileSync(scriptPath, `'use strict';\nmodule.exports = {\n  aiRecovery: {\n    guidance: 'repair recommendation json',\n    reentry: {\n      allowedMutableInputs: ['repairInstructions', 'boundedContextSummary'],\n      forbiddenMutableInputs: ['upstreamArtifacts']\n    }\n  },\n  run: async (input) => {\n    if (!input.recoveryRuntime) {\n      const error = new Error('invalid_output: malformed recommendation json');\n      error.aiTargets = { attempts: 1, targetIndex: 0, targetCount: 1, toolLoop: { turns: 3 } };\n      throw error;\n    }\n    return {\n      artifacts: {\n        recommendationData: {\n          ok: true,\n          repaired: true,\n          repairInstructions: input.recoveryRuntime.repairInstructions,\n          boundedContextSummary: input.recoveryRuntime.boundedContextSummary\n        }\n      }\n    };\n  }\n};\n`, 'utf8');

  const outputDir = makeTempDir('ee-script-runner-recovery-');
  const result = await executeScriptWithRecovery({
    phase: 'phase3-report',
    scriptPath,
    input: {
      outputDir,
      config: {
        name: 'runner-test',
        ai: {
          recommendation: {
            retry: { maxAttempts: 1 },
            targets: [{ adapter: { name: 'openrouter', model: 'test-recommendation-model' } }]
          }
        },
        recovery: {
          ai: {
            enabled: true,
            adapter: 'google',
            model: 'gemini-3.1-pro-preview'
          }
        }
      },
      artifacts: {}
    }
  });

  assert.strictEqual(result.scriptResult.status, 'success');
  assert.strictEqual(recoveryCallCount, 2);
  assert.strictEqual(result.artifacts.__scriptExecution.recommendation.lineage.aiRecoveryAttemptsUsed, 1);
  assert.deepStrictEqual(result.artifacts.recommendationData.repairInstructions, ['Return the required metadataData JSON only.']);
  assert.strictEqual(result.artifacts.recommendationData.boundedContextSummary, 'Prior output was malformed JSON.');
  assert(fs.existsSync(path.join(outputDir, 'phase3-report', 'recovery', 'recommendation', 'ai-recovery', 'attempt-01', 'result.json')));
});

test('script-runner - AI recovery refuses direct final JSON when the validator tool was never called', async () => {
  const providerModulePath = require.resolve('ai-providers/ai-provider-interface.js', { paths: [__dirname] });
  const aiTargetsPath = require.resolve('../../server/lib/ai-targets.cjs', { paths: [__dirname] });
  const aiRecoveryPath = require.resolve('../../server/lib/ai-recovery-lane.cjs', { paths: [__dirname] });
  const runnerPath = require.resolve('../../server/lib/script-runner.cjs', { paths: [__dirname] });

  delete require.cache[providerModulePath];
  delete require.cache[aiTargetsPath];
  delete require.cache[aiRecoveryPath];
  delete require.cache[runnerPath];

  let recoveryCallCount = 0;
  require.cache[providerModulePath] = {
    exports: {
      getProviderFromConfig: () => ({
        complete: async () => {
          recoveryCallCount += 1;
          return {
            content: JSON.stringify({
              decision: {
                outcome: 'reenter_script',
                reason: 'Attempt a retry without using the tool.',
                confidence: 'medium',
                hardFail: false,
                humanReviewRequired: false
              },
              revisedInput: {
                kind: 'same-script-revised-input',
                changes: [
                  { path: 'repairInstructions', op: 'set', value: ['Return the required metadataData JSON only.'] }
                ]
              }
            }),
            usage: { input: 51, output: 19 }
          };
        }
      }),
      loadProvider: () => ({ complete: async () => { throw new Error('unexpected'); } })
    },
    loaded: true,
    id: providerModulePath,
    filename: providerModulePath
  };

  const { executeScript: executeScriptWithRecovery } = require('../../server/lib/script-runner.cjs');

  const scriptDir = makeTempDir('ee-script-module-recovery-no-tool-');
  const scriptPath = path.join(scriptDir, 'recommendation.cjs');
  fs.writeFileSync(scriptPath, `'use strict';\nmodule.exports = {\n  aiRecovery: {\n    guidance: 'repair recommendation json',\n    reentry: {\n      allowedMutableInputs: ['repairInstructions', 'boundedContextSummary'],\n      forbiddenMutableInputs: ['upstreamArtifacts']\n    }\n  },\n  run: async (input) => {\n    if (!input.recoveryRuntime) {\n      const error = new Error('invalid_output: malformed recommendation json');\n      error.aiTargets = { attempts: 1, targetIndex: 0, targetCount: 1, toolLoop: { turns: 3 } };\n      throw error;\n    }\n    return { artifacts: { recommendationData: { ok: true } } };\n  }\n};\n`, 'utf8');

  const outputDir = makeTempDir('ee-script-runner-recovery-no-tool-');
  await assert.rejects(
    () => executeScriptWithRecovery({
      phase: 'phase3-report',
      scriptPath,
      input: {
        outputDir,
        config: {
          name: 'runner-test',
          ai: {
            recommendation: {
              retry: { maxAttempts: 1 },
              targets: [{ adapter: { name: 'openrouter', model: 'test-recommendation-model' } }]
            }
          },
          recovery: {
            ai: {
              enabled: true,
              adapter: 'google',
              model: 'gemini-3.1-pro-preview',
              toolLoop: {
                maxTurns: 2,
                maxValidatorCalls: 2
              }
            }
          }
        },
        artifacts: {}
      }
    }),
    /invalid_output: malformed recommendation json/
  );

  assert.strictEqual(recoveryCallCount, 2);
  const resultPath = path.join(outputDir, 'phase3-report', 'recovery', 'recommendation', 'ai-recovery', 'attempt-01', 'result.json');
  assert(fs.existsSync(resultPath));
  const result = JSON.parse(fs.readFileSync(resultPath, 'utf8'));
  assert.strictEqual(result.status, 'failed');
  assert.strictEqual(result.decision.outcome, 'no_change_fail');
  assert.match(result.decision.reason, /must call validate_ai_recovery_decision_json/i);
});
