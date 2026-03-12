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
let completeImplementation = async ({ options }) => ({
  content: JSON.stringify({
    text: 'Test recommendation',
    reasoning: 'Because test data suggests it.',
    confidence: 0.75,
    keyFindings: ['Finding 1', 'Finding 2', 'Finding 3'],
    suggestions: ['Suggestion 1', 'Suggestion 2']
  }),
  usage: { input: 42, output: 24 },
  debug: { options }
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

function makeConfig({ targets, retry, debug } = {}) {
  return {
    ai: {
      recommendation: {
        ...(retry !== undefined ? { retry } : {}),
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
    completeImplementation = async (args) => ({
      content: JSON.stringify({
        text: 'Test recommendation',
        reasoning: 'Because test data suggests it.',
        confidence: 0.75,
        keyFindings: ['Finding 1', 'Finding 2', 'Finding 3'],
        suggestions: ['Suggestion 1', 'Suggestion 2']
      }),
      usage: { input: 42, output: 24 },
      debug: { args }
    });

    fs.rmSync(testOutputDir, { recursive: true, force: true });
    fs.mkdirSync(testOutputDir, { recursive: true });
  });

  t.afterEach(() => {
    fs.rmSync(testOutputDir, { recursive: true, force: true });
  });

  await t.test('runs under new ai.recommendation.targets config and writes recommendation.json', async () => {
    const result = await recommendationScript.run({
      outputDir: testOutputDir,
      artifacts: makeArtifacts(),
      config: makeConfig()
    });

    property(result, 'artifacts');
    property(result.artifacts, 'recommendationData');
    is(typeof result.artifacts.recommendationData.text, 'string');

    const recPath = path.join(testOutputDir, 'phase3-report', 'recommendation', 'recommendation.json');
    ok(fs.existsSync(recPath));

    const saved = JSON.parse(fs.readFileSync(recPath, 'utf8'));
    is(saved.text, 'Test recommendation');
    is(saved.confidence, 0.75);
  });

  await t.test('forwards adapter params into provider.complete options', async () => {
    await recommendationScript.run({
      outputDir: testOutputDir,
      artifacts: makeArtifacts(),
      config: makeConfig({
        targets: [
          { adapter: { name: 'openrouter', model: 'test-rec-model', params: { temperature: 0.9, maxTokens: 222 } } }
        ]
      })
    });

    is(providerCalls.length, 1);
    const call = providerCalls[0];
    property(call, 'options');
    is(call.options.temperature, 0.9);
    is(call.options.maxTokens, 222);
  });

  await t.test('repairs markdown-fenced JSON with trailing commas', async () => {
    completeImplementation = async () => ({
      content: [
        'Here is the recommendation JSON:',
        '```json',
        '{',
        '  "text": "Tighten the hook.",',
        '  "reasoning": "The opening is strong but the middle drifts.",',
        '  "confidence": 0.91,',
        '  "keyFindings": ["Strong first beat", "Mid-video drag",],',
        '  "suggestions": ["Trim exposition", "Front-load payoff",]',
        '}',
        '```'
      ].join('\n'),
      usage: { input: 11, output: 22 }
    });

    const result = await recommendationScript.run({
      outputDir: testOutputDir,
      artifacts: makeArtifacts(),
      config: makeConfig()
    });

    is(result.artifacts.recommendationData.text, 'Tighten the hook.');
    assert.deepStrictEqual(result.artifacts.recommendationData.keyFindings, ['Strong first beat', 'Mid-video drag']);
    assert.deepStrictEqual(result.artifacts.recommendationData.suggestions, ['Trim exposition', 'Front-load payoff']);
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
  });

  await t.test('retryable failure exhausts retries then falls back to next target', async () => {
    completeImplementation = async (args) => {
      if (args.model === 'primary-model') {
        const err = new Error('upstream failure');
        err.response = { status: 503, data: { error: 'service unavailable' } };
        throw err;
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

    is(providerCalls.length, 3);
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
