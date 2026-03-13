const fs = require('fs');
const path = require('path');
const test = require('node:test');
const assert = require('node:assert/strict');
const { ok, is, property, rejects } = require('../helpers/assertions');

process.env.AI_API_KEY = 'test-api-key';

function mockModule(modulePath, mockExports) {
  const absolutePath = require.resolve(modulePath, { paths: [__dirname] });
  if (require.cache[absolutePath]) delete require.cache[absolutePath];
  require.cache[absolutePath] = {
    exports: mockExports,
    loaded: true,
    id: absolutePath,
    filename: absolutePath
  };
}

function readLatestRecommendationRawCapture(rawRecDir) {
  const pointerPath = path.join(rawRecDir, 'recommendation.json');
  const pointer = JSON.parse(fs.readFileSync(pointerPath, 'utf8'));

  if (pointer && pointer.kind === 'pointer' && pointer.target && pointer.target.file) {
    const capturePath = path.join(rawRecDir, pointer.target.file);
    const capture = JSON.parse(fs.readFileSync(capturePath, 'utf8'));
    return { pointer, capture };
  }

  return { pointer: null, capture: pointer };
}

const providerCalls = [];
let completeImplementation = async () => ({
  content: JSON.stringify({
    text: 'Test recommendation',
    reasoning: 'Because test data suggests it.',
    confidence: 0.75,
    keyFindings: ['Finding 1', 'Finding 2', 'Finding 3'],
    suggestions: ['Suggestion 1', 'Suggestion 2']
  }),
  usage: { input: 42, output: 24 }
});

const mockAIProviderInterface = {
  getProviderFromConfig: () => ({
    complete: async (args) => {
      providerCalls.push(args);
      return completeImplementation(args);
    }
  }),
  loadProvider: () => ({
    complete: async (args) => {
      providerCalls.push(args);
      return completeImplementation(args);
    }
  })
};

mockModule('ai-providers/ai-provider-interface.js', mockAIProviderInterface);

const recommendationScript = require('../../server/scripts/report/recommendation.cjs');

function makeConfig({ targets, retry, debug, toolLoop } = {}) {
  return {
    ai: {
      recommendation: {
        ...(retry !== undefined ? { retry } : {}),
        ...(toolLoop !== undefined ? { toolLoop } : {}),
        targets: targets || [
          { adapter: { name: 'openrouter', model: 'test-rec-model' } }
        ]
      }
    },
    ...(debug ? { debug } : {})
  };
}

function makeArtifacts() {
  return {
    chunkAnalysis: {
      chunks: [
        {
          chunkIndex: 0,
          startTime: 0,
          endTime: 8,
          summary: 'Hook is fast and energetic.',
          emotions: {
            excitement: { score: 8 },
            boredom: { score: 2 },
            curiosity: { score: 7 }
          },
          dominant_emotion: 'excitement',
          confidence: 0.8
        }
      ],
      totalTokens: 100,
      videoDuration: 8
    },
    metricsData: {
      averages: { excitement: 0.8, boredom: 0.2, curiosity: 0.7 },
      frictionIndex: 0.2
    }
  };
}

test('Recommendation Script', async (t) => {
  const testOutputDir = '/tmp/test-recommendation-output';

  t.beforeEach(() => {
    providerCalls.length = 0;
    completeImplementation = async () => ({
      content: JSON.stringify({
        text: 'Test recommendation',
        reasoning: 'Because test data suggests it.',
        confidence: 0.75,
        keyFindings: ['Finding 1', 'Finding 2', 'Finding 3'],
        suggestions: ['Suggestion 1', 'Suggestion 2']
      }),
      usage: { input: 42, output: 24 }
    });

    fs.rmSync(testOutputDir, { recursive: true, force: true });
    fs.mkdirSync(testOutputDir, { recursive: true });
  });

  t.afterEach(() => {
    fs.rmSync(testOutputDir, { recursive: true, force: true });
  });

  await t.test('runs under new ai.recommendation.targets config and writes recommendation.json after validator-mediated loop', async () => {
    let callCount = 0;
    completeImplementation = async () => {
      callCount += 1;
      return {
        content: JSON.stringify({
          text: 'Test recommendation',
          reasoning: 'Because test data suggests it.',
          confidence: 0.75,
          keyFindings: ['Finding 1', 'Finding 2', 'Finding 3'],
          suggestions: ['Suggestion 1', 'Suggestion 2']
        }),
        usage: { input: 42, output: 24 }
      };
    };

    const result = await recommendationScript.run({
      outputDir: testOutputDir,
      artifacts: makeArtifacts(),
      config: makeConfig({ debug: { captureRaw: true } })
    });

    property(result, 'artifacts');
    property(result.artifacts, 'recommendationData');
    is(typeof result.artifacts.recommendationData.text, 'string');
    is(callCount, 2);
    assert.match(providerCalls[1].prompt, /Recommendation JSON is valid\. Return the final JSON artifact\./);

    const recPath = path.join(testOutputDir, 'phase3-report', 'recommendation', 'recommendation.json');
    ok(fs.existsSync(recPath));

    const saved = JSON.parse(fs.readFileSync(recPath, 'utf8'));
    is(saved.text, 'Test recommendation');
    is(saved.confidence, 0.75);
    is(saved.ai.toolLoop.validatorCalls, 2);

    const rawRecDir = path.join(testOutputDir, 'phase3-report', 'raw', 'ai', 'recommendation');
    const { capture } = readLatestRecommendationRawCapture(rawRecDir);
    is(capture.schemaVersion, 3);
    is(capture.toolLoop.turns, 2);
    is(capture.toolLoop.validatorCalls, 2);
    is(capture.toolLoop.history[1].kind, 'tool_result_auto_validation');
  });

  await t.test('forwards adapter params into provider.complete options', async () => {
    let callCount = 0;
    completeImplementation = async () => {
      callCount += 1;
      return {
        content: JSON.stringify({
          text: 'Test recommendation',
          reasoning: 'Because test data suggests it.',
          confidence: 0.75,
          keyFindings: ['Finding 1', 'Finding 2', 'Finding 3'],
          suggestions: ['Suggestion 1', 'Suggestion 2']
        }),
        usage: { input: 42, output: 24 }
      };
    };

    await recommendationScript.run({
      outputDir: testOutputDir,
      artifacts: makeArtifacts(),
      config: makeConfig({
        targets: [
          { adapter: { name: 'openrouter', model: 'test-rec-model', params: { temperature: 0.9, maxTokens: 222 } } }
        ]
      })
    });

    is(callCount, 2);
    const call = providerCalls[0];
    property(call, 'options');
    is(call.options.temperature, 0.9);
    is(call.options.maxTokens, 222);
  });

  await t.test('supports the canonical minimal tool call envelope followed by final JSON', async () => {
    let callCount = 0;
    completeImplementation = async () => {
      callCount += 1;

      if (callCount === 1) {
        return {
          content: JSON.stringify({
            tool: 'validate_recommendation_json',
            recommendation: {
              text: 'Tighten the hook and compress the middle.',
              reasoning: 'The intro is strong but the slower middle reduces momentum before payoff.',
              confidence: 0.83,
              keyFindings: ['Strong intro', 'Mid-video drag', 'Late payoff'],
              suggestions: ['Trim exposition', 'Move payoff earlier', 'Maintain faster cuts']
            }
          }),
          usage: { input: 10, output: 12 }
        };
      }

      return {
        content: JSON.stringify({
          text: 'Tighten the hook and compress the middle.',
          reasoning: 'The intro is strong but the slower middle reduces momentum before payoff.',
          confidence: 0.83,
          keyFindings: ['Strong intro', 'Mid-video drag', 'Late payoff'],
          suggestions: ['Trim exposition', 'Move payoff earlier', 'Maintain faster cuts']
        }),
        usage: { input: 11, output: 13 }
      };
    };

    const result = await recommendationScript.run({
      outputDir: testOutputDir,
      artifacts: makeArtifacts(),
      config: makeConfig({ debug: { captureRaw: true } })
    });

    is(callCount, 2);
    is(result.artifacts.recommendationData.confidence, 0.83);

    const rawRecDir = path.join(testOutputDir, 'phase3-report', 'raw', 'ai', 'recommendation');
    const { capture } = readLatestRecommendationRawCapture(rawRecDir);
    is(capture.toolLoop.history[1].toolName, 'validate_recommendation_json');
    is(capture.toolLoop.history[1].kind, 'validator_acceptance');
    is(capture.toolLoop.history[1].result.valid, true);
    is(capture.toolLoop.history[2].kind, 'model_output');
  });

  await t.test('recovers from a malformed legacy tool-call envelope and reaches final acceptance', async () => {
    let callCount = 0;
    completeImplementation = async (args) => {
      callCount += 1;

      if (callCount === 1) {
        return {
          content: JSON.stringify({
            type: 'tool_call',
            toolName: 'validate_recommendation_json',
            arguments: {
              recommendation: {
                text: 'Legacy wrapper attempt',
                reasoning: 'This uses the old envelope and should be rejected for recovery.',
                confidence: 0.77,
                keyFindings: ['Old wrapper'],
                suggestions: ['Use canonical envelope']
              }
            }
          }),
          usage: { input: 6, output: 8 }
        };
      }

      if (callCount === 2) {
        assert.match(args.prompt, /Malformed validate_recommendation_json tool call envelope/i);
        assert.match(args.prompt, /Do not add type\/toolName\/arguments\/args\/input wrappers/i);
        return {
          content: JSON.stringify({
            text: 'Use a stronger hook and remove drag in the middle.',
            reasoning: 'The opening pulls attention, but the middle section softens momentum before payoff. Tightening that segment should preserve curiosity and improve retention continuity.',
            confidence: 0.81,
            keyFindings: ['Strong opening', 'Middle drag', 'Late payoff'],
            suggestions: ['Trim the middle section', 'Advance the payoff', 'Keep faster pacing between beats']
          }),
          usage: { input: 7, output: 9 }
        };
      }

      return {
        content: JSON.stringify({
          text: 'Use a stronger hook and remove drag in the middle.',
          reasoning: 'The opening pulls attention, but the middle section softens momentum before payoff. Tightening that segment should preserve curiosity and improve retention continuity.',
          confidence: 0.81,
          keyFindings: ['Strong opening', 'Middle drag', 'Late payoff'],
          suggestions: ['Trim the middle section', 'Advance the payoff', 'Keep faster pacing between beats']
        }),
        usage: { input: 8, output: 10 }
      };
    };

    const result = await recommendationScript.run({
      outputDir: testOutputDir,
      artifacts: makeArtifacts(),
      config: makeConfig({
        debug: { captureRaw: true },
        retry: { maxAttempts: 1, backoffMs: 0 }
      })
    });

    is(callCount, 3);
    is(result.artifacts.recommendationData.confidence, 0.81);

    const rawRecDir = path.join(testOutputDir, 'phase3-report', 'raw', 'ai', 'recommendation');
    const { capture } = readLatestRecommendationRawCapture(rawRecDir);
    is(capture.toolLoop.turns, 3);
    is(capture.toolLoop.validatorCalls, 2);
    is(capture.toolLoop.history[1].kind, 'malformed_tool_call_envelope');
    assert.match(capture.toolLoop.history[1].result.summary, /Expected exactly \{"tool":"validate_recommendation_json","recommendation":\{\.\.\.\}\}/);
    is(capture.toolLoop.history[3].kind, 'tool_result_auto_validation');
  });

  await t.test('uses validator tool results to revise an invalid recommendation before final acceptance', async () => {
    let callCount = 0;
    completeImplementation = async (args) => {
      callCount += 1;

      if (callCount === 1) {
        return {
          content: JSON.stringify({
            text: '  ',
            reasoning: 'Needs more specific support.',
            confidence: 1.4,
            keyFindings: ['Strong intro', ''],
            suggestions: []
          }),
          usage: { input: 5, output: 6 }
        };
      }

      if (callCount === 2) {
        assert.match(args.prompt, /confidence must be between 0 and 1/i);
        assert.match(args.prompt, /Recommendation JSON validation failed\./);
        return {
          content: JSON.stringify({
            tool: 'validate_recommendation_json',
            recommendation: {
              text: 'Tighten the middle and pay off the hook earlier.',
              reasoning: 'The opening wins attention, but pacing softens before the payoff. Compressing the slower middle should preserve momentum and keep the emotional arc coherent.',
              confidence: 0.82,
              keyFindings: ['Strong intro', 'Middle loses momentum', 'Payoff lands too late'],
              suggestions: ['Trim setup in the middle', 'Move payoff earlier', 'Keep fast cuts through the transition']
            }
          }),
          usage: { input: 7, output: 9 }
        };
      }

      return {
        content: JSON.stringify({
          text: 'Tighten the middle and pay off the hook earlier.',
          reasoning: 'The opening wins attention, but pacing softens before the payoff. Compressing the slower middle should preserve momentum and keep the emotional arc coherent.',
          confidence: 0.82,
          keyFindings: ['Strong intro', 'Middle loses momentum', 'Payoff lands too late'],
          suggestions: ['Trim setup in the middle', 'Move payoff earlier', 'Keep fast cuts through the transition']
        }),
        usage: { input: 8, output: 10 }
      };
    };

    const result = await recommendationScript.run({
      outputDir: testOutputDir,
      artifacts: makeArtifacts(),
      config: makeConfig({
        debug: { captureRaw: true },
        retry: { maxAttempts: 1, backoffMs: 0 }
      })
    });

    is(callCount, 3);
    is(result.artifacts.recommendationData.confidence, 0.82);

    const rawRecDir = path.join(testOutputDir, 'phase3-report', 'raw', 'ai', 'recommendation');
    const { capture } = readLatestRecommendationRawCapture(rawRecDir);
    is(capture.toolLoop.turns, 3);
    is(capture.toolLoop.validatorCalls, 3);
    assert.match(capture.toolLoop.history[1].result.summary, /Recommendation JSON validation failed\./);
    is(capture.toolLoop.history[3].result.valid, true);
  });

  await t.test('captures raw malformed response when parse ultimately fails', async () => {
    completeImplementation = async () => ({
      content: 'I cannot comply with JSON only. Recommendation: tighten pacing.',
      usage: { input: 5, output: 7 }
    });

    await rejects(recommendationScript.run({
      outputDir: testOutputDir,
      artifacts: makeArtifacts(),
      config: makeConfig({
        debug: { captureRaw: true },
        retry: { maxAttempts: 1, backoffMs: 0 }
      })
    }), /failed after 1 attempts: invalid_output: response was not valid JSON/);

    const rawRecDir = path.join(testOutputDir, 'phase3-report', 'raw', 'ai', 'recommendation');
    const { capture } = readLatestRecommendationRawCapture(rawRecDir);
    property(capture, 'rawResponse');
    is(capture.rawResponse.content, 'I cannot comply with JSON only. Recommendation: tighten pacing.');
    property(capture, 'parseMeta');
    is(capture.parseMeta.raw, 'I cannot comply with JSON only. Recommendation: tighten pacing.');
    is(capture.parseMeta.stage, 'parse');
    property(capture, 'validation');
    assert.match(capture.validation.summary, /Response was not valid JSON/);
  });

  await t.test('repeated malformed tool-call envelopes fail in bounded turns with diagnostic raw capture', async () => {
    completeImplementation = async () => ({
      content: JSON.stringify({
        type: 'tool_call',
        toolName: 'validate_recommendation_json',
        arguments: {
          recommendation: {
            text: 'Still using the wrong wrapper',
            reasoning: 'This should never reach the validator.',
            confidence: 0.5,
            keyFindings: ['Legacy wrapper'],
            suggestions: ['Use the canonical envelope']
          }
        }
      }),
      usage: { input: 1, output: 1 }
    });

    await rejects(recommendationScript.run({
      outputDir: testOutputDir,
      artifacts: makeArtifacts(),
      config: makeConfig({
        debug: { captureRaw: true },
        retry: { maxAttempts: 1, backoffMs: 0 },
        toolLoop: { maxTurns: 3, maxValidatorCalls: 3 }
      })
    }), /failed after 1 attempts: invalid_output: recommendation tool loop exhausted after 3 turns/);

    const rawRecDir = path.join(testOutputDir, 'phase3-report', 'raw', 'ai', 'recommendation');
    const { capture } = readLatestRecommendationRawCapture(rawRecDir);
    is(capture.parseMeta.stage, 'tool_loop');
    assert.match(capture.validation.summary, /exhausted after 3 turns/i);
    is(capture.toolLoop.validatorCalls, 0);
    is(capture.toolLoop.history[1].kind, 'malformed_tool_call_envelope');
    is(capture.toolLoop.history[3].kind, 'malformed_tool_call_envelope');
  });

  await t.test('tool-call limit exhaustion fails with diagnostic raw capture', async () => {
    completeImplementation = async () => ({
      content: JSON.stringify({
        tool: 'validate_recommendation_json',
        recommendation: {
          text: 'Still working',
          reasoning: 'Looping forever.',
          confidence: 0.5,
          keyFindings: ['A'],
          suggestions: ['B']
        }
      }),
      usage: { input: 1, output: 1 }
    });

    await rejects(recommendationScript.run({
      outputDir: testOutputDir,
      artifacts: makeArtifacts(),
      config: makeConfig({
        debug: { captureRaw: true },
        retry: { maxAttempts: 1, backoffMs: 0 },
        toolLoop: { maxTurns: 4, maxValidatorCalls: 1 }
      })
    }), /failed after 1 attempts: invalid_output: exceeded validate_recommendation_json tool-call limit/);

    const rawRecDir = path.join(testOutputDir, 'phase3-report', 'raw', 'ai', 'recommendation');
    const { capture } = readLatestRecommendationRawCapture(rawRecDir);
    is(capture.parseMeta.stage, 'tool_loop');
    assert.match(capture.validation.summary, /tool-call limit/i);
  });

  await t.test('retryable failure exhausts retries then falls back to next target', async () => {
    completeImplementation = async (args) => {
      if (args.model === 'primary-model') {
        const err = new Error('upstream failure');
        err.response = { status: 503, data: { error: 'service unavailable' } };
        throw err;
      }

      if (args.prompt.includes('Recommendation JSON is valid. Return the final JSON artifact.')) {
        return {
          content: JSON.stringify({
            text: 'Fallback recommendation',
            reasoning: 'Recovered on fallback.',
            confidence: 0.88,
            keyFindings: ['A', 'B', 'C'],
            suggestions: ['S1', 'S2', 'S3']
          }),
          usage: { input: 9, output: 7 }
        };
      }

      return {
        content: JSON.stringify({
          text: 'Fallback recommendation',
          reasoning: 'Recovered on fallback.',
          confidence: 0.88,
          keyFindings: ['A', 'B', 'C'],
          suggestions: ['S1', 'S2', 'S3']
        }),
        usage: { input: 9, output: 7 }
      };
    };

    await recommendationScript.run({
      outputDir: testOutputDir,
      artifacts: makeArtifacts(),
      config: makeConfig({
        retry: { maxAttempts: 2, backoffMs: 0 },
        targets: [
          { adapter: { name: 'openrouter', model: 'primary-model' } },
          { adapter: { name: 'openrouter', model: 'fallback-model' } }
        ],
        debug: { captureRaw: true }
      })
    });

    is(providerCalls.length, 4);
    is(providerCalls[0].model, 'primary-model');
    is(providerCalls[2].model, 'fallback-model');

    const rawRecDir = path.join(testOutputDir, 'phase3-report', 'raw', 'ai', 'recommendation');
    ok(fs.existsSync(path.join(rawRecDir, 'recommendation.json')));

    const { pointer, capture } = readLatestRecommendationRawCapture(rawRecDir);
    is(pointer.latestAttempt, 3);
    is(capture.model, 'fallback-model');
    property(capture, 'failover');
    is(capture.failover.from.model, 'primary-model');
    is(capture.failover.to.model, 'fallback-model');
  });

  await t.test('hard-stops on auth error (no retry, no failover)', async () => {
    completeImplementation = async () => {
      const err = new Error('unauthorized');
      err.response = { status: 401, data: { error: 'invalid api key' } };
      throw err;
    };

    await rejects(recommendationScript.run({
      outputDir: testOutputDir,
      artifacts: makeArtifacts(),
      config: makeConfig({
        retry: { maxAttempts: 3, backoffMs: 0 },
        targets: [
          { adapter: { name: 'openrouter', model: 'primary-model' } },
          { adapter: { name: 'openrouter', model: 'fallback-model' } }
        ],
        debug: { captureRaw: true }
      })
    }), /failed after 1 attempts: unauthorized/);

    is(providerCalls.length, 1);

    const rawRecDir = path.join(testOutputDir, 'phase3-report', 'raw', 'ai', 'recommendation');
    const { pointer } = readLatestRecommendationRawCapture(rawRecDir);
    is(pointer.latestAttempt, 1);
  });

  await t.test('hard-stops on capability mismatch (no retry, no failover)', async () => {
    completeImplementation = async () => {
      const err = new Error('model does not support attachments');
      err.response = { status: 400, data: { error: 'unsupported input' } };
      throw err;
    };

    await rejects(recommendationScript.run({
      outputDir: testOutputDir,
      artifacts: makeArtifacts(),
      config: makeConfig({
        retry: { maxAttempts: 3, backoffMs: 0 },
        targets: [
          { adapter: { name: 'openrouter', model: 'primary-model' } },
          { adapter: { name: 'openrouter', model: 'fallback-model' } }
        ],
        debug: { captureRaw: true }
      })
    }), /failed after 1 attempts/);

    is(providerCalls.length, 1);
  });
});
