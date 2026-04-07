const assert = require('assert');
const fs = require('fs');
const path = require('path');
const test = require('node:test');
const {
  resolveBenchmarkConfig,
  runBenchmarkStage,
  MANIFEST_CONTRACT_VERSION,
  FIXTURE_CONTRACT_VERSION
} = require('../../server/lib/benchmark-runner.cjs');

function writeJson(filePath, payload) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), 'utf8');
}

function makeTempFixture(rootDir, options = {}) {
  const configDir = path.join(rootDir, 'configs');
  const benchmarkDir = path.join(rootDir, 'benchmarks', 'fixtures', 'temp-fixture');
  const outputDir = path.join(rootDir, 'output', 'temp-run');
  const configPath = path.join(configDir, 'temp.yaml');
  const benchmarkPath = path.join(benchmarkDir, 'benchmark.json');
  const fixturePath = path.join(benchmarkDir, 'fixture.json');
  const truthPath = path.join(benchmarkDir, 'truth', 'dialogue-data.json');
  const outputPath = path.join(outputDir, 'phase1-gather-context', 'dialogue-data.json');

  fs.mkdirSync(configDir, { recursive: true });
  fs.writeFileSync(configPath, 'name: temp benchmark config\n', 'utf8');

  writeJson(fixturePath, {
    contractVersion: FIXTURE_CONTRACT_VERSION,
    fixtureId: 'temp-fixture',
    asset: { repoPath: 'examples/videos/emotion-tests/cod.mp4' },
    config: { repoPath: 'configs/temp.yaml' },
    benchmark: { entryPath: 'benchmark.json' },
    notes: ['temp test fixture']
  });

  writeJson(benchmarkPath, {
    contractVersion: MANIFEST_CONTRACT_VERSION,
    fixtureId: 'temp-fixture',
    fixture: { path: 'fixture.json' },
    reports: { outputDir: '_reports' },
    artifacts: [
      {
        artifactKey: 'dialogueData',
        label: 'Dialogue',
        phase: 'phase1-gather-context',
        script: 'get-dialogue',
        output: { path: 'phase1-gather-context/dialogue-data.json' },
        truth: { path: 'truth/dialogue-data.json' },
        comparator: {
          kind: 'json-structured',
          profile: 'dialogue-default',
          options: {
            timingToleranceSeconds: 2,
            unknownSentinels: ['unknown', 'ambiguous']
          }
        },
        required: true
      }
    ]
  });

  const truthPayload = options.truthPayload || {
    dialogue_segments: [
      {
        start: 1,
        end: 3,
        speaker: 'Speaker 1',
        text: 'Wake up now.',
        confidence: 0.98
      }
    ],
    summary: 'Trailer dialogue sample.',
    totalDuration: 20,
    handoffContext: null
  };

  const outputPayload = options.outputPayload || truthPayload;

  writeJson(truthPath, truthPayload);
  writeJson(outputPath, outputPayload);

  return { configPath, benchmarkPath, fixturePath, outputDir };
}

test('benchmark runner - resolveBenchmarkConfig skips when benchmark block is absent', () => {
  const resolved = resolveBenchmarkConfig({}, { configPath: '/tmp/example/config.yaml' });
  assert.strictEqual(resolved.enabled, false);
  assert.strictEqual(resolved.reason, 'absent');
});

test('benchmark runner - resolveBenchmarkConfig rejects enabled benchmark path that is not benchmark.json', () => {
  assert.throws(() => {
    resolveBenchmarkConfig({
      benchmark: {
        enabled: true,
        path: '../benchmarks/fixtures/cod-test/not-benchmark.txt'
      }
    }, { configPath: '/tmp/example/config.yaml' });
  }, /benchmark\.json/);
});

test('benchmark runner - runBenchmarkStage writes reports and passes for matching truth/output', async (t) => {
  const rootDir = path.join(__dirname, 'tmp-benchmark-pass');
  fs.rmSync(rootDir, { recursive: true, force: true });
  t.after(() => fs.rmSync(rootDir, { recursive: true, force: true }));

  const { configPath, outputDir } = makeTempFixture(rootDir);

  const result = runBenchmarkStage({
    config: {
      name: 'Temp benchmark pass',
      benchmark: {
        enabled: true,
        path: '../benchmarks/fixtures/temp-fixture/benchmark.json'
      }
    },
    configPath,
    outputDir
  });

  assert.strictEqual(result.enabled, true);
  assert.strictEqual(result.status, 'pass');
  assert(fs.existsSync(result.summaryPath), 'summary JSON should be written');
  assert(fs.existsSync(path.join(result.reportDir, 'benchmark-summary.md')), 'summary markdown should be written');
  assert(fs.existsSync(path.join(result.reportDir, 'artifact-results', 'dialogueData.json')), 'artifact report should be written');
});

test('benchmark runner - runBenchmarkStage uses reconciled phase1 baselines when reconciliation is configured', async (t) => {
  const rootDir = path.join(__dirname, 'tmp-benchmark-reconciled');
  fs.rmSync(rootDir, { recursive: true, force: true });
  t.after(() => fs.rmSync(rootDir, { recursive: true, force: true }));

  const { configPath, outputDir } = makeTempFixture(rootDir, {
    outputPayload: {
      dialogue_segments: [
        {
          start: 1,
          end: 3,
          speaker: 'Speaker 1',
          text: 'raw mismatch line',
          confidence: 0.98
        }
      ],
      summary: 'Raw mismatch payload.',
      totalDuration: 20,
      handoffContext: null
    }
  });

  writeJson(path.join(outputDir, 'phase1-gather-context', 'dialogue-data.reconciled.json'), {
    dialogue_segments: [
      {
        start: 1,
        end: 3,
        speaker: 'Speaker 1',
        text: 'Wake up now.',
        confidence: 0.98
      }
    ],
    summary: 'Trailer dialogue sample.',
    totalDuration: 20,
    handoffContext: null
  });

  const result = runBenchmarkStage({
    config: {
      name: 'Temp benchmark reconciled pass',
      benchmark: {
        enabled: true,
        path: '../benchmarks/fixtures/temp-fixture/benchmark.json'
      },
      gather_context: [
        'server/scripts/get-context/get-dialogue.cjs',
        'server/scripts/get-context/reconcile-famous-song-phase1.cjs'
      ]
    },
    configPath,
    outputDir
  });

  assert.strictEqual(result.status, 'pass');
  assert(result.artifactResults[0].output.path.endsWith('dialogue-data.reconciled.json'));
});

test('benchmark runner - runBenchmarkStage fails fast when reconciliation is configured but reconciled artifact is missing', async (t) => {
  const rootDir = path.join(__dirname, 'tmp-benchmark-reconciled-missing');
  fs.rmSync(rootDir, { recursive: true, force: true });
  t.after(() => fs.rmSync(rootDir, { recursive: true, force: true }));

  const { configPath, outputDir } = makeTempFixture(rootDir);
  fs.rmSync(path.join(outputDir, 'phase1-gather-context', 'dialogue-data.json'), { force: true });

  assert.throws(() => runBenchmarkStage({
    config: {
      name: 'Temp benchmark reconciled missing',
      benchmark: {
        enabled: true,
        path: '../benchmarks/fixtures/temp-fixture/benchmark.json'
      },
      gather_context: [
        'server/scripts/get-context/get-dialogue.cjs',
        'server/scripts/get-context/reconcile-famous-song-phase1.cjs'
      ]
    },
    configPath,
    outputDir
  }), /reconciled dialogueData artifact is missing/);
});

test('benchmark runner - runBenchmarkStage fails for mismatched scoreable values', async (t) => {
  const rootDir = path.join(__dirname, 'tmp-benchmark-fail');
  fs.rmSync(rootDir, { recursive: true, force: true });
  t.after(() => fs.rmSync(rootDir, { recursive: true, force: true }));

  const { configPath, outputDir } = makeTempFixture(rootDir, {
    outputPayload: {
      dialogue_segments: [
        {
          start: 1,
          end: 3,
          speaker: 'Speaker 1',
          text: 'Different line entirely.',
          confidence: 0.98
        }
      ],
      summary: 'Trailer dialogue sample.',
      totalDuration: 20,
      handoffContext: null
    }
  });

  const result = runBenchmarkStage({
    config: {
      name: 'Temp benchmark fail',
      benchmark: {
        enabled: true,
        path: '../benchmarks/fixtures/temp-fixture/benchmark.json'
      }
    },
    configPath,
    outputDir
  });

  assert.strictEqual(result.status, 'fail');
  assert.strictEqual(result.artifactResults[0].status, 'fail');
  assert(result.artifactResults[0].failures.some((failure) => failure.path.includes('text')));
});

test('benchmark runner - fuzzy string comparison tolerates case and punctuation drift on generated prose fields', async (t) => {
  const rootDir = path.join(__dirname, 'tmp-benchmark-fuzzy');
  fs.rmSync(rootDir, { recursive: true, force: true });
  t.after(() => fs.rmSync(rootDir, { recursive: true, force: true }));

  const { configPath, outputDir } = makeTempFixture(rootDir, {
    truthPayload: {
      dialogue_segments: [
        {
          start: 1,
          end: 3,
          speaker: 'Speaker 1',
          text: 'Specter One, report.',
          confidence: 0.98,
          label: 'Authoritative, News-Anchor Style',
          note: 'Professional, expository tone.'
        }
      ],
      summary: 'Trailer dialogue sample.',
      totalDuration: 20,
      handoffContext: 'Speaker 1: The hell it isn\'t.'
    },
    outputPayload: {
      dialogue_segments: [
        {
          start: 1,
          end: 3,
          speaker: 'Speaker 1',
          text: 'specter one report',
          confidence: 0.98,
          label: 'authoritative news anchor style',
          note: 'Professional expository tone'
        }
      ],
      summary: 'TRAILER dialogue sample!',
      totalDuration: 20,
      handoffContext: 'speaker 1 the hell it isn\'t!'
    }
  });

  const result = runBenchmarkStage({
    config: {
      name: 'Temp benchmark fuzzy',
      benchmark: {
        enabled: true,
        path: '../benchmarks/fixtures/temp-fixture/benchmark.json'
      }
    },
    configPath,
    outputDir
  });

  assert.strictEqual(result.status, 'pass');
  assert.strictEqual(result.artifactResults[0].status, 'pass');
});

test('benchmark runner - confidence fields use tolerant numeric comparison', async (t) => {
  const rootDir = path.join(__dirname, 'tmp-benchmark-confidence');
  fs.rmSync(rootDir, { recursive: true, force: true });
  t.after(() => fs.rmSync(rootDir, { recursive: true, force: true }));

  const { configPath, outputDir } = makeTempFixture(rootDir, {
    truthPayload: {
      dialogue_segments: [
        {
          start: 1,
          end: 3,
          speaker: 'Speaker 1',
          text: 'Wake up now.',
          confidence: 0.98
        }
      ],
      summary: 'Trailer dialogue sample.',
      totalDuration: 20,
      handoffContext: null
    },
    outputPayload: {
      dialogue_segments: [
        {
          start: 1,
          end: 3,
          speaker: 'Speaker 1',
          text: 'Wake up now.',
          confidence: 0.91
        }
      ],
      summary: 'Trailer dialogue sample.',
      totalDuration: 20,
      handoffContext: null
    }
  });

  const result = runBenchmarkStage({
    config: {
      name: 'Temp benchmark confidence',
      benchmark: {
        enabled: true,
        path: '../benchmarks/fixtures/temp-fixture/benchmark.json'
      }
    },
    configPath,
    outputDir
  });

  assert.strictEqual(result.status, 'pass');
  assert.strictEqual(result.artifactResults[0].status, 'pass');
});

function makeTempRecommendationFixture(rootDir, options = {}) {
  const configDir = path.join(rootDir, 'configs');
  const benchmarkDir = path.join(rootDir, 'benchmarks', 'fixtures', 'temp-recommendation-fixture');
  const outputDir = path.join(rootDir, 'output', 'temp-run');
  const configPath = path.join(configDir, 'temp.yaml');
  const benchmarkPath = path.join(benchmarkDir, 'benchmark.json');
  const fixturePath = path.join(benchmarkDir, 'fixture.json');
  const truthPath = path.join(benchmarkDir, 'truth', 'recommendation.json');
  const outputPath = path.join(outputDir, 'phase3-report', 'recommendation', 'recommendation.json');

  fs.mkdirSync(configDir, { recursive: true });
  fs.writeFileSync(configPath, 'name: temp recommendation benchmark config\n', 'utf8');

  writeJson(fixturePath, {
    contractVersion: FIXTURE_CONTRACT_VERSION,
    fixtureId: 'temp-recommendation-fixture',
    asset: { repoPath: 'examples/videos/emotion-tests/cod.mp4' },
    config: { repoPath: 'configs/temp.yaml' },
    benchmark: { entryPath: 'benchmark.json' },
    notes: ['temp recommendation benchmark fixture']
  });

  writeJson(benchmarkPath, {
    contractVersion: MANIFEST_CONTRACT_VERSION,
    fixtureId: 'temp-recommendation-fixture',
    fixture: { path: 'fixture.json' },
    reports: { outputDir: '_reports' },
    artifacts: [
      {
        artifactKey: 'recommendationData',
        label: 'Recommendation',
        phase: 'phase3-report',
        script: 'recommendation',
        output: { path: 'phase3-report/recommendation/recommendation.json' },
        truth: { path: 'truth/recommendation.json' },
        comparator: {
          kind: 'json-structured',
          profile: 'recommendation-default',
          options: {
            numericTolerance: 0.1,
            unknownSentinels: ['unknown', 'ambiguous'],
            ignorePaths: ['$.generatedAt', '$.ai']
          }
        },
        required: true
      }
    ]
  });

  const truthPayload = options.truthPayload || {
    generatedAt: '2026-03-26T00:00:00.000Z',
    pipelineVersion: '1.0',
    text: 'Front-load the strongest spectacle.',
    reasoning: 'The opening is weak, while later visuals are stronger.',
    confidence: 0.92,
    keyFindings: ['Opening underperforms.', 'Mid-video spectacle works.'],
    suggestions: ['Open on action.', 'Trim exposition.'],
    failedChunks: 0,
    ai: {
      attempt: 1,
      provider: 'openrouter',
      model: 'openai/gpt-5.4',
      failover: null,
      toolLoop: { turns: 2, validatorCalls: 2 },
      usage: { input: 100, output: 50 }
    }
  };

  const outputPayload = options.outputPayload || truthPayload;

  writeJson(truthPath, truthPayload);
  writeJson(outputPath, outputPayload);

  return { configPath, outputDir };
}

test('benchmark runner - recommendation comparator supports ignored volatile metadata and fuzzy list fields', async (t) => {
  const rootDir = path.join(__dirname, 'tmp-benchmark-recommendation');
  fs.rmSync(rootDir, { recursive: true, force: true });
  t.after(() => fs.rmSync(rootDir, { recursive: true, force: true }));

  const { configPath, outputDir } = makeTempRecommendationFixture(rootDir, {
    outputPayload: {
      generatedAt: '2026-03-27T12:34:56.000Z',
      pipelineVersion: '1.0',
      text: 'front load the strongest spectacle',
      reasoning: 'The opening is weak while later visuals are stronger!',
      confidence: 0.88,
      keyFindings: ['opening underperforms', 'Mid video spectacle works!'],
      suggestions: ['Open on action!', 'trim exposition'],
      failedChunks: 0,
      ai: {
        attempt: 2,
        provider: 'openrouter',
        model: 'openai/gpt-5.4',
        failover: null,
        toolLoop: { turns: 3, validatorCalls: 1 },
        usage: { input: 999, output: 111 }
      }
    }
  });

  const result = runBenchmarkStage({
    config: {
      name: 'Temp benchmark recommendation',
      benchmark: {
        enabled: true,
        path: '../benchmarks/fixtures/temp-recommendation-fixture/benchmark.json'
      }
    },
    configPath,
    outputDir
  });

  assert.strictEqual(result.status, 'pass');
  assert.strictEqual(result.artifactResults[0].status, 'pass');
  assert(result.artifactResults[0].skips.some((skip) => skip.path === 'generatedAt'));
  assert(result.artifactResults[0].skips.some((skip) => skip.path === 'ai.usage.input'));
});

test('benchmark runner - truth-declared _benchmark.ignorePaths are stripped from truth comparison and surfaced as ignored differences', async (t) => {
  const rootDir = path.join(__dirname, 'tmp-benchmark-recommendation-truth-directives');
  fs.rmSync(rootDir, { recursive: true, force: true });
  t.after(() => fs.rmSync(rootDir, { recursive: true, force: true }));

  const { configPath, outputDir } = makeTempRecommendationFixture(rootDir, {
    truthPayload: {
      _benchmark: {
        ignorePaths: ['$.generatedAt', '$.ai']
      },
      generatedAt: '2026-03-26T00:00:00.000Z',
      pipelineVersion: '1.0',
      text: 'Front-load the strongest spectacle.',
      reasoning: 'The opening is weak, while later visuals are stronger.',
      confidence: 0.92,
      keyFindings: ['Opening underperforms.', 'Mid-video spectacle works.'],
      suggestions: ['Open on action.', 'Trim exposition.'],
      failedChunks: 0,
      ai: {
        attempt: 1,
        provider: 'openrouter',
        model: 'openai/gpt-5.4',
        failover: null,
        toolLoop: { turns: 2, validatorCalls: 2 },
        usage: { input: 100, output: 50 }
      }
    },
    outputPayload: {
      generatedAt: '2026-03-27T12:34:56.000Z',
      pipelineVersion: '1.0',
      text: 'Front-load the strongest spectacle.',
      reasoning: 'The opening is weak, while later visuals are stronger.',
      confidence: 0.92,
      keyFindings: ['Opening underperforms.', 'Mid-video spectacle works.'],
      suggestions: ['Open on action.', 'Trim exposition.'],
      failedChunks: 0,
      ai: {
        attempt: 2,
        provider: 'openrouter',
        model: 'openai/gpt-5.4',
        failover: null,
        toolLoop: { turns: 3, validatorCalls: 1 },
        usage: { input: 999, output: 111 },
        cache: { hit: true }
      }
    }
  });

  const benchmarkPath = path.join(rootDir, 'benchmarks', 'fixtures', 'temp-recommendation-fixture', 'benchmark.json');
  const benchmark = JSON.parse(fs.readFileSync(benchmarkPath, 'utf8'));
  delete benchmark.artifacts[0].comparator.options.ignorePaths;
  fs.writeFileSync(benchmarkPath, JSON.stringify(benchmark, null, 2), 'utf8');

  const result = runBenchmarkStage({
    config: {
      name: 'Temp benchmark recommendation truth directives',
      benchmark: {
        enabled: true,
        path: '../benchmarks/fixtures/temp-recommendation-fixture/benchmark.json'
      }
    },
    configPath,
    outputDir
  });

  const artifact = result.artifactResults[0];
  assert.strictEqual(result.status, 'pass');
  assert.strictEqual(artifact.status, 'pass');
  assert.deepStrictEqual(artifact.comparator.directives.truthIgnorePaths, ['$.generatedAt', '$.ai']);
  assert.deepStrictEqual(artifact.comparator.directives.comparatorIgnorePaths, []);
  assert(artifact.comparator.directives.effectiveIgnorePaths.includes('$.generatedAt'));
  assert(artifact.comparator.directives.effectiveIgnorePaths.includes('$.ai'));
  assert(!artifact.fieldResults.some((field) => field.path.includes('_benchmark')));
  assert(artifact.skips.some((skip) => skip.path === 'generatedAt'));
  assert(artifact.ignoredDifferences.some((entry) => entry.path === 'generatedAt'));
  assert(artifact.ignoredDifferences.some((entry) => entry.path === 'ai.usage.input'));
  assert(artifact.ignoredDifferences.some((entry) => entry.path === 'ai.cache'));
  assert.strictEqual(artifact.counts.ignoredDifferenceFields, artifact.ignoredDifferences.length);
  assert.strictEqual(result.aggregate.coverage.ignoredDifferences, artifact.ignoredDifferences.length);
});

test('benchmark runner - invalid truth _benchmark.ignorePaths fails fast', async (t) => {
  const rootDir = path.join(__dirname, 'tmp-benchmark-invalid-truth-directives');
  fs.rmSync(rootDir, { recursive: true, force: true });
  t.after(() => fs.rmSync(rootDir, { recursive: true, force: true }));

  const { configPath, outputDir } = makeTempRecommendationFixture(rootDir, {
    truthPayload: {
      _benchmark: {
        ignorePaths: ['$.generatedAt', '']
      },
      generatedAt: '2026-03-26T00:00:00.000Z',
      pipelineVersion: '1.0',
      text: 'Front-load the strongest spectacle.',
      reasoning: 'The opening is weak, while later visuals are stronger.',
      confidence: 0.92,
      keyFindings: ['Opening underperforms.'],
      suggestions: ['Open on action.'],
      failedChunks: 0,
      ai: { attempt: 1, provider: 'openrouter', model: 'openai/gpt-5.4', failover: null, toolLoop: { turns: 2, validatorCalls: 2 }, usage: { input: 100, output: 50 } }
    }
  });

  const benchmarkPath = path.join(rootDir, 'benchmarks', 'fixtures', 'temp-recommendation-fixture', 'benchmark.json');
  const benchmark = JSON.parse(fs.readFileSync(benchmarkPath, 'utf8'));
  delete benchmark.artifacts[0].comparator.options.ignorePaths;
  fs.writeFileSync(benchmarkPath, JSON.stringify(benchmark, null, 2), 'utf8');

  assert.throws(() => runBenchmarkStage({
    config: {
      name: 'Temp benchmark invalid truth directives',
      benchmark: {
        enabled: true,
        path: '../benchmarks/fixtures/temp-recommendation-fixture/benchmark.json'
      }
    },
    configPath,
    outputDir
  }), /Invalid ignorePaths/);
});

test('benchmark runner - truth-declared ignorePaths suppress extra output-only fields even when truth omits them', async (t) => {
  const rootDir = path.join(__dirname, 'tmp-benchmark-extra-output-ignore');
  fs.rmSync(rootDir, { recursive: true, force: true });
  t.after(() => fs.rmSync(rootDir, { recursive: true, force: true }));

  const { configPath, outputDir } = makeTempFixture(rootDir, {
    truthPayload: {
      _benchmark: {
        ignorePaths: ['$.analysisMode', '$.coverage']
      },
      dialogue_segments: [
        { start: 1, end: 3, speaker: 'Speaker 1', text: 'Wake up now.', confidence: 0.98 }
      ],
      summary: 'Trailer dialogue sample.',
      totalDuration: 20,
      handoffContext: null
    },
    outputPayload: {
      dialogue_segments: [
        { start: 1, end: 3, speaker: 'Speaker 1', text: 'Wake up now.', confidence: 0.98 }
      ],
      summary: 'Trailer dialogue sample.',
      totalDuration: 20,
      handoffContext: null,
      analysisMode: 'chunked',
      coverage: { start: 0, end: 20, duration: 20, complete: true }
    }
  });

  const result = runBenchmarkStage({
    config: {
      name: 'Temp benchmark extra output ignore',
      benchmark: {
        enabled: true,
        path: '../benchmarks/fixtures/temp-fixture/benchmark.json'
      }
    },
    configPath,
    outputDir
  });

  const artifact = result.artifactResults[0];
  assert.strictEqual(result.status, 'pass');
  assert.strictEqual(artifact.status, 'pass');
  assert(!artifact.errors.some((entry) => entry.path === 'analysisMode'));
  assert(!artifact.errors.some((entry) => entry.path === 'coverage'));
  assert(artifact.ignoredDifferences.some((entry) => entry.path === 'analysisMode'));
  assert(artifact.ignoredDifferences.some((entry) => entry.path === 'coverage'));
});

function makeTempChunkAnalysisFixture(rootDir, options = {}) {
  const configDir = path.join(rootDir, 'configs');
  const benchmarkDir = path.join(rootDir, 'benchmarks', 'fixtures', 'temp-chunk-analysis-fixture');
  const outputDir = path.join(rootDir, 'output', 'temp-run');
  const configPath = path.join(configDir, 'temp.yaml');
  const fixturePath = path.join(benchmarkDir, 'fixture.json');
  const benchmarkPath = path.join(benchmarkDir, 'benchmark.json');
  const truthPath = path.join(benchmarkDir, 'truth', 'chunk-analysis.json');
  const outputPath = path.join(outputDir, 'phase2-process', 'chunk-analysis.json');

  fs.mkdirSync(configDir, { recursive: true });
  fs.writeFileSync(configPath, 'name: temp chunk analysis benchmark config\n', 'utf8');

  writeJson(fixturePath, {
    contractVersion: FIXTURE_CONTRACT_VERSION,
    fixtureId: 'temp-chunk-analysis-fixture',
    asset: { repoPath: 'examples/videos/emotion-tests/cod.mp4' },
    config: { repoPath: 'configs/temp.yaml' },
    benchmark: { entryPath: 'benchmark.json' },
    notes: ['temp chunk analysis benchmark fixture', 'truth is bootstrap truth for comparator validation only']
  });

  writeJson(benchmarkPath, {
    contractVersion: MANIFEST_CONTRACT_VERSION,
    fixtureId: 'temp-chunk-analysis-fixture',
    fixture: { path: 'fixture.json' },
    reports: { outputDir: '_reports' },
    artifacts: [
      {
        artifactKey: 'chunkAnalysis',
        label: 'Chunk analysis',
        phase: 'phase2-process',
        script: 'video-chunks',
        output: { path: 'phase2-process/chunk-analysis.json' },
        truth: { path: 'truth/chunk-analysis.json' },
        comparator: {
          kind: 'json-structured',
          profile: 'chunk-analysis-default',
          options: {
            timingToleranceSeconds: 2,
            numericTolerance: 0.1,
            unknownSentinels: ['unknown', 'ambiguous'],
            ignorePaths: ['$.chunks[*].tokens', '$.totalTokens']
          }
        },
        required: true
      }
    ]
  });

  const truthPayload = options.truthPayload || {
    chunks: [
      {
        chunkIndex: 0,
        splitIndex: 0,
        startTime: 0,
        endTime: 5,
        status: 'success',
        summary: 'Opening action beat with glitchy text.',
        emotions: {
          patience: { score: 2, reasoning: 'The opening text feels generic.' },
          boredom: { score: 8, reasoning: 'The hook is weak.' },
          excitement: { score: 4, reasoning: 'Action exists but does not fully land yet.' }
        },
        dominant_emotion: 'boredom',
        confidence: 0.9,
        tokens: 1000,
        persona: {
          soulPath: '../cast/impatient-teenager/SOUL.md',
          goalPath: '../goals/video-ad-evaluation.md',
          lenses: ['patience', 'boredom', 'excitement']
        }
      },
      {
        chunkIndex: 1,
        splitIndex: 0,
        startTime: 5,
        endTime: 10,
        status: 'success',
        summary: 'Spectacle ramps up immediately.',
        emotions: {
          patience: { score: 8, reasoning: 'Rapid visual novelty keeps attention.' },
          boredom: { score: 2, reasoning: 'No dead air.' },
          excitement: { score: 9, reasoning: 'Big surreal visual moment lands.' }
        },
        dominant_emotion: 'excitement',
        confidence: 0.95,
        tokens: 2000,
        persona: {
          soulPath: '../cast/impatient-teenager/SOUL.md',
          goalPath: '../goals/video-ad-evaluation.md',
          lenses: ['patience', 'boredom', 'excitement']
        }
      }
    ],
    totalTokens: 3000,
    statusSummary: {
      total: 2,
      successful: 2,
      failed: 0,
      failedChunkIndexes: []
    },
    persona: {
      soulPath: '../cast/impatient-teenager/SOUL.md',
      goalPath: '../goals/video-ad-evaluation.md',
      config: {
        chunkDuration: 8,
        numChunks: 2
      }
    },
    videoDuration: 10
  };

  const outputPayload = options.outputPayload || truthPayload;

  writeJson(truthPath, truthPayload);
  writeJson(outputPath, outputPayload);

  return { configPath, outputDir };
}

test('benchmark runner - chunk analysis comparator supports keyed chunk alignment and ignores volatile token counts', async (t) => {
  const rootDir = path.join(__dirname, 'tmp-benchmark-chunk-analysis');
  fs.rmSync(rootDir, { recursive: true, force: true });
  t.after(() => fs.rmSync(rootDir, { recursive: true, force: true }));

  const { configPath, outputDir } = makeTempChunkAnalysisFixture(rootDir, {
    outputPayload: {
      chunks: [
        {
          chunkIndex: 1,
          splitIndex: 0,
          startTime: 5,
          endTime: 10,
          status: 'success',
          summary: 'spectacle ramps up immediately!',
          emotions: {
            patience: { score: 8, reasoning: 'Rapid visual novelty keeps attention' },
            boredom: { score: 2, reasoning: 'No dead air' },
            excitement: { score: 9, reasoning: 'Big surreal visual moment lands' }
          },
          dominant_emotion: 'excitement',
          confidence: 0.9,
          tokens: 9999,
          persona: {
            soulPath: '../cast/impatient-teenager/SOUL.md',
            goalPath: '../goals/video-ad-evaluation.md',
            lenses: ['patience', 'boredom', 'excitement']
          }
        },
        {
          chunkIndex: 0,
          splitIndex: 0,
          startTime: 0,
          endTime: 5,
          status: 'success',
          summary: 'Opening action beat with glitchy text',
          emotions: {
            patience: { score: 2, reasoning: 'The opening text feels generic' },
            boredom: { score: 8, reasoning: 'The hook is weak' },
            excitement: { score: 4, reasoning: 'Action exists but does not fully land yet' }
          },
          dominant_emotion: 'boredom',
          confidence: 0.84,
          tokens: 7777,
          persona: {
            soulPath: '../cast/impatient-teenager/SOUL.md',
            goalPath: '../goals/video-ad-evaluation.md',
            lenses: ['patience', 'boredom', 'excitement']
          }
        }
      ],
      totalTokens: 17776,
      statusSummary: {
        total: 2,
        successful: 2,
        failed: 0,
        failedChunkIndexes: []
      },
      persona: {
        soulPath: '../cast/impatient-teenager/SOUL.md',
        goalPath: '../goals/video-ad-evaluation.md',
        config: {
          chunkDuration: 8,
          numChunks: 2
        }
      },
      videoDuration: 10
    }
  });

  const result = runBenchmarkStage({
    config: {
      name: 'Temp benchmark chunk analysis',
      benchmark: {
        enabled: true,
        path: '../benchmarks/fixtures/temp-chunk-analysis-fixture/benchmark.json'
      }
    },
    configPath,
    outputDir
  });

  assert.strictEqual(result.status, 'pass');
  assert.strictEqual(result.artifactResults[0].status, 'pass');
  assert(result.artifactResults[0].skips.some((skip) => skip.path === 'chunks[chunkIndex=0,splitIndex=0].tokens'));
  assert(result.artifactResults[0].skips.some((skip) => skip.path === 'totalTokens'));
});


function makeTempMetricsFixture(rootDir, options = {}) {
  const configDir = path.join(rootDir, 'configs');
  const benchmarkDir = path.join(rootDir, 'benchmarks', 'fixtures', 'temp-metrics-fixture');
  const outputDir = path.join(rootDir, 'output', 'temp-run');
  const configPath = path.join(configDir, 'temp.yaml');
  const fixturePath = path.join(benchmarkDir, 'fixture.json');
  const benchmarkPath = path.join(benchmarkDir, 'benchmark.json');
  const truthPath = path.join(benchmarkDir, 'truth', 'metrics.json');
  const outputPath = path.join(outputDir, 'phase3-report', 'metrics', 'metrics.json');

  fs.mkdirSync(configDir, { recursive: true });
  fs.writeFileSync(configPath, 'name: temp metrics benchmark config\n', 'utf8');

  writeJson(fixturePath, {
    contractVersion: FIXTURE_CONTRACT_VERSION,
    fixtureId: 'temp-metrics-fixture',
    asset: { repoPath: 'examples/videos/emotion-tests/cod.mp4' },
    config: { repoPath: 'configs/temp.yaml' },
    benchmark: { entryPath: 'benchmark.json' },
    notes: ['temp metrics benchmark fixture', 'truth is bootstrap truth for comparator validation only']
  });

  writeJson(benchmarkPath, {
    contractVersion: MANIFEST_CONTRACT_VERSION,
    fixtureId: 'temp-metrics-fixture',
    fixture: { path: 'fixture.json' },
    reports: { outputDir: '_reports' },
    artifacts: [
      {
        artifactKey: 'metricsData',
        label: 'Metrics',
        phase: 'phase3-report',
        script: 'metrics',
        output: { path: 'phase3-report/metrics/metrics.json' },
        truth: { path: 'truth/metrics.json' },
        comparator: {
          kind: 'json-structured',
          profile: 'metrics-default',
          options: {
            timingToleranceSeconds: 2,
            numericTolerance: 0.1,
            unknownSentinels: ['unknown', 'ambiguous'],
            ignorePaths: ['$.generatedAt']
          }
        },
        required: true
      }
    ]
  });

  const truthPayload = options.truthPayload || {
    generatedAt: '2026-03-26T13:35:12.112Z',
    pipelineVersion: '1.0',
    summary: {
      totalChunks: 28,
      failedChunks: 0,
      totalSeconds: 140,
      videoDuration: 140.017
    },
    implementationStatus: {
      state: 'computed',
      dataSource: 'derived-from-phase2.chunkAnalysis'
    },
    averages: {
      patience: 0.6428571428571428,
      boredom: 0.42857142857142855,
      excitement: 0.7821428571428576
    },
    peakMoments: {
      patience: {
        highest: { timestamp: 75, score: 0.9 },
        lowest: { timestamp: 0, score: 0.2 }
      },
      boredom: {
        highest: { timestamp: 75, score: 1 },
        lowest: { timestamp: 5, score: 0.2 }
      }
    },
    trends: {
      patience: {
        direction: 'increasing',
        change: 0.05714285714285705,
        firstHalfAverage: 0.6142857142857141,
        secondHalfAverage: 0.6714285714285712
      },
      boredom: {
        direction: 'increasing',
        change: 0.24285714285714283,
        firstHalfAverage: 0.3071428571428571,
        secondHalfAverage: 0.5499999999999999
      }
    },
    frictionIndex: 100
  };

  const outputPayload = options.outputPayload || truthPayload;

  writeJson(truthPath, truthPayload);
  writeJson(outputPath, outputPayload);

  return { configPath, outputDir };
}

test('benchmark runner - metrics comparator ignores generatedAt and tolerates derived numeric drift', async (t) => {
  const rootDir = path.join(__dirname, 'tmp-benchmark-metrics');
  fs.rmSync(rootDir, { recursive: true, force: true });
  t.after(() => fs.rmSync(rootDir, { recursive: true, force: true }));

  const { configPath, outputDir } = makeTempMetricsFixture(rootDir, {
    outputPayload: {
      generatedAt: '2026-03-27T12:34:56.000Z',
      pipelineVersion: '1.0',
      summary: {
        totalChunks: 28,
        failedChunks: 0,
        totalSeconds: 140,
        videoDuration: 141.1
      },
      implementationStatus: {
        state: 'computed',
        dataSource: 'derived-from-phase2.chunkAnalysis'
      },
      averages: {
        patience: 0.68,
        boredom: 0.39,
        excitement: 0.75
      },
      peakMoments: {
        patience: {
          highest: { timestamp: 76.2, score: 0.85 },
          lowest: { timestamp: 0, score: 0.25 }
        },
        boredom: {
          highest: { timestamp: 74.4, score: 0.95 },
          lowest: { timestamp: 6.1, score: 0.23 }
        }
      },
      trends: {
        patience: {
          direction: 'increasing',
          change: 0.09,
          firstHalfAverage: 0.59,
          secondHalfAverage: 0.69
        },
        boredom: {
          direction: 'increasing',
          change: 0.19,
          firstHalfAverage: 0.35,
          secondHalfAverage: 0.58
        }
      },
      frictionIndex: 99.95
    }
  });

  const result = runBenchmarkStage({
    config: {
      name: 'Temp benchmark metrics',
      benchmark: {
        enabled: true,
        path: '../benchmarks/fixtures/temp-metrics-fixture/benchmark.json'
      }
    },
    configPath,
    outputDir
  });

  assert.strictEqual(result.status, 'pass');
  assert.strictEqual(result.artifactResults[0].status, 'pass');
  assert(result.artifactResults[0].skips.some((skip) => skip.path === 'generatedAt'));
  assert(result.artifactResults[0].fieldResults.some((field) => field.path === 'summary.videoDuration' && field.rule === 'tolerant-time'));
  assert(result.artifactResults[0].fieldResults.some((field) => field.path === 'averages.patience' && field.rule === 'tolerant-number'));
});

function makeTempEmotionalAnalysisFixture(rootDir, options = {}) {
  const configDir = path.join(rootDir, 'configs');
  const benchmarkDir = path.join(rootDir, 'benchmarks', 'fixtures', 'temp-emotional-fixture');
  const outputDir = path.join(rootDir, 'output', 'temp-run');
  const configPath = path.join(configDir, 'temp.yaml');
  const benchmarkPath = path.join(benchmarkDir, 'benchmark.json');
  const fixturePath = path.join(benchmarkDir, 'fixture.json');
  const truthPath = path.join(benchmarkDir, 'truth', 'emotional-analysis.json');
  const outputPath = path.join(outputDir, 'phase3-report', 'emotional-analysis', 'emotional-data.json');

  fs.mkdirSync(configDir, { recursive: true });
  fs.writeFileSync(configPath, 'name: temp emotional benchmark config\n', 'utf8');

  writeJson(fixturePath, {
    contractVersion: FIXTURE_CONTRACT_VERSION,
    fixtureId: 'temp-emotional-fixture',
    asset: { repoPath: 'examples/videos/emotion-tests/cod.mp4' },
    config: { repoPath: 'configs/temp.yaml' },
    benchmark: { entryPath: 'benchmark.json' },
    notes: ['temp emotional analysis fixture']
  });

  writeJson(benchmarkPath, {
    contractVersion: MANIFEST_CONTRACT_VERSION,
    fixtureId: 'temp-emotional-fixture',
    fixture: { path: 'fixture.json' },
    reports: { outputDir: '_reports' },
    artifacts: [
      {
        artifactKey: 'emotionalAnalysisData',
        label: 'Emotional analysis',
        phase: 'phase3-report',
        script: 'emotional-analysis',
        output: { path: 'phase3-report/emotional-analysis/emotional-data.json' },
        truth: { path: 'truth/emotional-analysis.json' },
        comparator: {
          kind: 'json-structured',
          profile: 'emotional-analysis-default',
          options: {
            timingToleranceSeconds: 2,
            numericTolerance: 0.1,
            unknownSentinels: ['unknown', 'ambiguous'],
            ignorePaths: ['$.generatedAt', '$.criticalMoments[*].context']
          }
        },
        required: true
      }
    ]
  });

  const truthPayload = options.truthPayload || {
    generatedAt: '2026-03-26T13:35:50.603Z',
    pipelineVersion: '1.0',
    implementationStatus: {
      state: 'computed',
      dataSource: 'derived-from-phase2.chunkAnalysis'
    },
    summary: {
      totalChunks: 2,
      failedChunks: 0,
      totalSeconds: 10,
      videoDuration: 10.017,
      criticalMomentsCount: 1,
      averageScrollRisk: 0.505
    },
    chunkAnalysis: [
      {
        chunkIndex: 0,
        startTime: 0,
        endTime: 5,
        duration: 5,
        emotions: { patience: 0.2, boredom: 0.8, excitement: 0.4 },
        emotionalVelocity: { patience: 0.2, boredom: 0.8, excitement: 0.4 },
        scrollRisk: 0.7,
        scrollRiskLevel: 'high',
        dominantEmotion: { emotion: 'boredom', score: 0.8 },
        emotionalSignature: 'low-patience-high-boredom-moderate-excitement',
        dataPoints: 5
      },
      {
        chunkIndex: 1,
        startTime: 5,
        endTime: 10,
        duration: 5,
        emotions: { patience: 0.8, boredom: 0.2, excitement: 0.9 },
        emotionalVelocity: { patience: 0.16, boredom: 0.04, excitement: 0.18 },
        scrollRisk: 0.31,
        scrollRiskLevel: 'medium',
        dominantEmotion: { emotion: 'excitement', score: 0.9 },
        emotionalSignature: 'high-patience-low-boredom-high-excitement',
        dataPoints: 5
      }
    ],
    failedChunkDetails: [],
    emotionalArc: {
      timestamps: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
      emotions: {
        patience: [0.2, 0.2, 0.2, 0.2, 0.2, 0.8, 0.8, 0.8, 0.8, 0.8],
        boredom: [0.8, 0.8, 0.8, 0.8, 0.8, 0.2, 0.2, 0.2, 0.2, 0.2],
        excitement: [0.4, 0.4, 0.4, 0.4, 0.4, 0.9, 0.9, 0.9, 0.9, 0.9]
      },
      smoothedEmotions: {
        patience: [0.2, 0.2, 0.32, 0.44, 0.56, 0.68, 0.8, 0.8, 0.8, 0.8],
        boredom: [0.8, 0.8, 0.68, 0.56, 0.44, 0.32, 0.2, 0.2, 0.2, 0.2],
        excitement: [0.4, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 0.9, 0.9, 0.9]
      },
      windowSize: 5
    },
    scrollRiskTimeline: [
      { timestamp: 0, scrollRisk: 0.7, scrollRiskLevel: 'high', dominantEmotion: 'boredom' },
      { timestamp: 5, scrollRisk: 0.31, scrollRiskLevel: 'medium', dominantEmotion: 'excitement' }
    ],
    criticalMoments: [
      {
        timestamp: 5,
        emotion: 'boredom',
        type: 'threshold-low',
        score: 0.2,
        previousScore: 0.8,
        threshold: 0.3,
        chunkIndex: 1,
        severity: 0.55,
        context: 'Boredom drops quickly after the opening hook.'
      }
    ]
  };

  const outputPayload = options.outputPayload || truthPayload;

  writeJson(truthPath, truthPayload);
  writeJson(outputPath, outputPayload);

  return { configPath, outputDir };
}

test('benchmark runner - emotional analysis comparator benchmarks deterministic structure while ignoring generated prose context', async (t) => {
  const rootDir = path.join(__dirname, 'tmp-benchmark-emotional-analysis');
  fs.rmSync(rootDir, { recursive: true, force: true });
  t.after(() => fs.rmSync(rootDir, { recursive: true, force: true }));

  const { configPath, outputDir } = makeTempEmotionalAnalysisFixture(rootDir, {
    outputPayload: {
      generatedAt: '2026-03-27T12:34:56.000Z',
      pipelineVersion: '1.0',
      implementationStatus: {
        state: 'computed',
        dataSource: 'derived-from-phase2.chunkAnalysis'
      },
      summary: {
        totalChunks: 2,
        failedChunks: 0,
        totalSeconds: 10,
        videoDuration: 10.9,
        criticalMomentsCount: 1,
        averageScrollRisk: 0.51
      },
      chunkAnalysis: [
        {
          chunkIndex: 1,
          startTime: 5,
          endTime: 10,
          duration: 5,
          emotions: { patience: 0.82, boredom: 0.22, excitement: 0.88 },
          emotionalVelocity: { patience: 0.14, boredom: 0.05, excitement: 0.16 },
          scrollRisk: 0.33,
          scrollRiskLevel: 'medium',
          dominantEmotion: { emotion: 'excitement', score: 0.88 },
          emotionalSignature: 'high-patience-low-boredom-high-excitement',
          dataPoints: 5
        },
        {
          chunkIndex: 0,
          startTime: 0,
          endTime: 5,
          duration: 5,
          emotions: { patience: 0.22, boredom: 0.78, excitement: 0.41 },
          emotionalVelocity: { patience: 0.22, boredom: 0.78, excitement: 0.41 },
          scrollRisk: 0.68,
          scrollRiskLevel: 'high',
          dominantEmotion: { emotion: 'boredom', score: 0.79 },
          emotionalSignature: 'low-patience-high-boredom-moderate-excitement',
          dataPoints: 5
        }
      ],
      failedChunkDetails: [],
      emotionalArc: {
        timestamps: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
        emotions: {
          patience: [0.22, 0.2, 0.2, 0.21, 0.2, 0.82, 0.8, 0.8, 0.79, 0.8],
          boredom: [0.78, 0.8, 0.8, 0.79, 0.8, 0.22, 0.2, 0.2, 0.21, 0.2],
          excitement: [0.41, 0.4, 0.4, 0.39, 0.4, 0.88, 0.9, 0.9, 0.89, 0.9]
        },
        smoothedEmotions: {
          patience: [0.2, 0.21, 0.33, 0.45, 0.55, 0.69, 0.79, 0.8, 0.8, 0.79],
          boredom: [0.8, 0.79, 0.67, 0.55, 0.45, 0.31, 0.21, 0.2, 0.2, 0.21],
          excitement: [0.4, 0.41, 0.49, 0.61, 0.69, 0.79, 0.89, 0.9, 0.9, 0.89]
        },
        windowSize: 5
      },
      scrollRiskTimeline: [
        { timestamp: 5.5, scrollRisk: 0.33, scrollRiskLevel: 'medium', dominantEmotion: 'excitement' },
        { timestamp: 0.2, scrollRisk: 0.68, scrollRiskLevel: 'high', dominantEmotion: 'boredom' }
      ],
      criticalMoments: [
        {
          timestamp: 5.2,
          emotion: 'boredom',
          type: 'threshold-low',
          score: 0.22,
          previousScore: 0.79,
          threshold: 0.3,
          chunkIndex: 1,
          severity: 0.56,
          context: 'Completely rewritten prose should be ignored by the comparator.'
        }
      ]
    }
  });

  const result = runBenchmarkStage({
    config: {
      name: 'Temp benchmark emotional analysis',
      benchmark: {
        enabled: true,
        path: '../benchmarks/fixtures/temp-emotional-fixture/benchmark.json'
      }
    },
    configPath,
    outputDir
  });

  assert.strictEqual(result.status, 'pass');
  assert.strictEqual(result.artifactResults[0].status, 'pass');
  assert(result.artifactResults[0].skips.some((skip) => skip.path === 'generatedAt'));
  assert(result.artifactResults[0].skips.some((skip) => skip.path === 'criticalMoments[timestamp=5,emotion=boredom,type=threshold-low,chunkIndex=1].context'));
  assert(result.artifactResults[0].fieldResults.some((field) => field.path === 'summary.averageScrollRisk' && field.rule === 'tolerant-number'));
  assert(result.artifactResults[0].fieldResults.some((field) => field.path === 'scrollRiskTimeline[timestamp=0].scrollRisk' && field.rule === 'tolerant-number'));
  assert(result.artifactResults[0].fieldResults.some((field) => field.path === 'criticalMoments[timestamp=5,emotion=boredom,type=threshold-low,chunkIndex=1].timestamp' && field.rule === 'tolerant-time'));
});

test('benchmark runner - music-vocals truth is benchmarked separately from dialogue truth', async (t) => {
  const rootDir = path.join(__dirname, 'tmp-benchmark-music-vocals');
  fs.rmSync(rootDir, { recursive: true, force: true });
  t.after(() => fs.rmSync(rootDir, { recursive: true, force: true }));

  const configDir = path.join(rootDir, 'configs');
  const benchmarkDir = path.join(rootDir, 'benchmarks', 'fixtures', 'temp-music-vocals-fixture');
  const outputDir = path.join(rootDir, 'output', 'temp-run');
  const configPath = path.join(configDir, 'temp.yaml');
  const fixturePath = path.join(benchmarkDir, 'fixture.json');
  const benchmarkPath = path.join(benchmarkDir, 'benchmark.json');
  const dialogueTruthPath = path.join(benchmarkDir, 'truth', 'dialogue-data.json');
  const vocalsTruthPath = path.join(benchmarkDir, 'truth', 'music-vocals-data.json');
  const dialogueOutputPath = path.join(outputDir, 'phase1-gather-context', 'dialogue-data.json');
  const vocalsOutputPath = path.join(outputDir, 'phase1-gather-context', 'music-vocals-data.json');

  fs.mkdirSync(configDir, { recursive: true });
  fs.writeFileSync(configPath, 'name: temp music vocals benchmark config\n', 'utf8');

  writeJson(fixturePath, {
    contractVersion: FIXTURE_CONTRACT_VERSION,
    fixtureId: 'temp-music-vocals-fixture',
    asset: { repoPath: 'examples/videos/emotion-tests/cod.mp4' },
    config: { repoPath: 'configs/temp.yaml' },
    benchmark: { entryPath: 'benchmark.json' },
    notes: ['temp music vocals benchmark fixture']
  });

  writeJson(benchmarkPath, {
    contractVersion: MANIFEST_CONTRACT_VERSION,
    fixtureId: 'temp-music-vocals-fixture',
    fixture: { path: 'fixture.json' },
    reports: { outputDir: '_reports' },
    artifacts: [
      {
        artifactKey: 'dialogueData',
        label: 'Dialogue',
        phase: 'phase1-gather-context',
        script: 'get-dialogue',
        output: { path: 'phase1-gather-context/dialogue-data.json' },
        truth: { path: 'truth/dialogue-data.json' },
        comparator: {
          kind: 'json-structured',
          profile: 'dialogue-default',
          options: { timingToleranceSeconds: 2, unknownSentinels: ['unknown', 'ambiguous'] }
        },
        required: true
      },
      {
        artifactKey: 'musicVocalsData',
        label: 'Music vocals',
        phase: 'phase1-gather-context',
        script: 'get-music-vocals',
        output: { path: 'phase1-gather-context/music-vocals-data.json' },
        truth: { path: 'truth/music-vocals-data.json' },
        comparator: {
          kind: 'json-structured',
          profile: 'music-vocals-default',
          options: { timingToleranceSeconds: 2, unknownSentinels: ['unknown', 'ambiguous'] }
        },
        required: true
      }
    ]
  });

  writeJson(dialogueTruthPath, {
    dialogue_segments: [
      { start: 0, end: 1, speaker: 'Speaker 1', text: 'Wake up now.', confidence: 0.98 }
    ],
    summary: 'Spoken dialogue only.',
    totalDuration: 10,
    handoffContext: null
  });
  writeJson(vocalsTruthPath, {
    vocal_segments: [
      { start: 2, end: 4, text: 'Master, master', confidence: 0.95, performer: 'Metallica', performer_id: 'voc_001', delivery: 'chant' }
    ],
    summary: 'Sung vocals only.',
    hasVocals: true,
    totalDuration: 10,
    recognizedSong: {
      status: 'recognized',
      confidence: 0.95,
      candidates: [
        {
          title: 'Master of Puppets',
          artist: 'Metallica',
          confidence: 0.95,
          evidence: ['Literal lyric fragment matches the heard chant.'],
          matchedLyrics: ['Master, master'],
          timeRanges: [{ start: 2, end: 4 }]
        }
      ],
      primaryEvidence: 'Literal lyric evidence grounds one specific song.',
      multipleSongsDetected: false
    },
    recognitionNotes: ['Dialogue was excluded from lyric evidence.']
  });

  writeJson(dialogueOutputPath, {
    dialogue_segments: [
      { start: 0, end: 1, speaker: 'Speaker 1', text: 'Wake up now.', confidence: 0.98 }
    ],
    summary: 'Spoken dialogue only.',
    totalDuration: 10,
    handoffContext: null
  });
  writeJson(vocalsOutputPath, {
    vocal_segments: [
      { start: 2, end: 4, text: 'Master, master', confidence: 0.91, performer: 'Metallica', performer_id: 'voc_001', delivery: 'chant' }
    ],
    summary: 'Sung vocals only.',
    hasVocals: true,
    totalDuration: 10,
    recognizedSong: {
      status: 'recognized',
      confidence: 0.9,
      candidates: [
        {
          title: 'Master of Puppets',
          artist: 'Metallica',
          confidence: 0.9,
          evidence: ['Literal lyric fragment matches the heard chant.'],
          matchedLyrics: ['Master, master'],
          timeRanges: [{ start: 2, end: 4 }]
        }
      ],
      primaryEvidence: 'Literal lyric evidence grounds one specific song.',
      multipleSongsDetected: false
    },
    recognitionNotes: ['Dialogue was excluded from lyric evidence.']
  });

  const result = runBenchmarkStage({
    config: {
      name: 'Temp benchmark music vocals',
      benchmark: {
        enabled: true,
        path: '../benchmarks/fixtures/temp-music-vocals-fixture/benchmark.json'
      }
    },
    configPath,
    outputDir
  });

  assert.strictEqual(result.status, 'pass');
  assert.strictEqual(result.artifactResults.length, 2);
  assert(result.artifactResults.some((artifact) => artifact.artifactKey === 'dialogueData' && artifact.status === 'pass'));
  assert(result.artifactResults.some((artifact) => artifact.artifactKey === 'musicVocalsData' && artifact.status === 'pass'));
  assert(fs.existsSync(path.join(result.reportDir, 'artifact-results', 'musicVocalsData.json')));
});

test('benchmark runner - dialogue comparator uses time-aware alignment to avoid cascade after a missing middle segment', async (t) => {
  const rootDir = path.join(__dirname, 'tmp-benchmark-dialogue-time-aware-alignment');
  fs.rmSync(rootDir, { recursive: true, force: true });
  t.after(() => fs.rmSync(rootDir, { recursive: true, force: true }));

  const { configPath, outputDir } = makeTempFixture(rootDir, {
    truthPayload: {
      dialogue_segments: [
        { start: 0, end: 2, speaker: 'Speaker 1', text: 'Alpha.', confidence: 0.98 },
        { start: 4, end: 6, speaker: 'Speaker 2', text: 'Bravo.', confidence: 0.98 },
        { start: 8, end: 10, speaker: 'Speaker 3', text: 'Charlie.', confidence: 0.98 },
        { start: 12, end: 14, speaker: 'Speaker 4', text: 'Delta.', confidence: 0.98 }
      ],
      summary: 'Dialogue alignment test.',
      totalDuration: 20,
      handoffContext: null
    },
    outputPayload: {
      dialogue_segments: [
        { start: 0, end: 2, speaker: 'Speaker 1', text: 'Alpha.', confidence: 0.98 },
        { start: 8, end: 10, speaker: 'Speaker 3', text: 'Charlie.', confidence: 0.98 },
        { start: 12, end: 14, speaker: 'Speaker 4', text: 'Delta.', confidence: 0.98 }
      ],
      summary: 'Dialogue alignment test.',
      totalDuration: 20,
      handoffContext: null
    }
  });

  const result = runBenchmarkStage({
    config: {
      name: 'Temp benchmark dialogue time-aware alignment',
      benchmark: {
        enabled: true,
        path: '../benchmarks/fixtures/temp-fixture/benchmark.json'
      }
    },
    configPath,
    outputDir
  });

  const artifact = result.artifactResults[0];
  assert.strictEqual(result.status, 'fail');
  assert.strictEqual(artifact.status, 'fail');
  assert.strictEqual(artifact.errors.length, 0);
  assert(artifact.alignments.some((entry) => entry.path === 'dialogue_segments' && entry.matches.some((match) => match.truthIndex === 2 && match.outputIndex === 1)));
  assert(artifact.failures.some((failure) => failure.path === 'dialogue_segments[truth=1]'));
  assert(artifact.fieldResults.some((field) => field.path === 'dialogue_segments[truth=2,output=1].text' && field.status === 'pass'));
  assert(artifact.fieldResults.some((field) => field.path === 'dialogue_segments[truth=3,output=2].text' && field.status === 'pass'));
});

test('benchmark runner - music-vocals comparator uses time-aware alignment to recover later lyric matches after early truth-only chant segments', async (t) => {
  const rootDir = path.join(__dirname, 'tmp-benchmark-music-vocals-time-aware-alignment');
  fs.rmSync(rootDir, { recursive: true, force: true });
  t.after(() => fs.rmSync(rootDir, { recursive: true, force: true }));

  const configDir = path.join(rootDir, 'configs');
  const benchmarkDir = path.join(rootDir, 'benchmarks', 'fixtures', 'temp-music-vocals-time-aware-fixture');
  const outputDir = path.join(rootDir, 'output', 'temp-run');
  const configPath = path.join(configDir, 'temp.yaml');
  const fixturePath = path.join(benchmarkDir, 'fixture.json');
  const benchmarkPath = path.join(benchmarkDir, 'benchmark.json');
  const truthPath = path.join(benchmarkDir, 'truth', 'music-vocals-data.json');
  const outputPath = path.join(outputDir, 'phase1-gather-context', 'music-vocals-data.json');

  fs.mkdirSync(configDir, { recursive: true });
  fs.writeFileSync(configPath, 'name: temp music vocals time-aware benchmark config\n', 'utf8');

  writeJson(fixturePath, {
    contractVersion: FIXTURE_CONTRACT_VERSION,
    fixtureId: 'temp-music-vocals-time-aware-fixture',
    asset: { repoPath: 'examples/videos/emotion-tests/cod.mp4' },
    config: { repoPath: 'configs/temp.yaml' },
    benchmark: { entryPath: 'benchmark.json' },
    notes: ['temp music vocals time-aware fixture']
  });

  writeJson(benchmarkPath, {
    contractVersion: MANIFEST_CONTRACT_VERSION,
    fixtureId: 'temp-music-vocals-time-aware-fixture',
    fixture: { path: 'fixture.json' },
    reports: { outputDir: '_reports' },
    artifacts: [
      {
        artifactKey: 'musicVocalsData',
        label: 'Music vocals',
        phase: 'phase1-gather-context',
        script: 'get-music-vocals',
        output: { path: 'phase1-gather-context/music-vocals-data.json' },
        truth: { path: 'truth/music-vocals-data.json' },
        comparator: {
          kind: 'json-structured',
          profile: 'music-vocals-default',
          options: { timingToleranceSeconds: 2, unknownSentinels: ['unknown', 'ambiguous'] }
        },
        required: true
      }
    ]
  });

  writeJson(truthPath, {
    vocal_segments: [
      { start: 10, end: 12, text: 'Obey your master', confidence: 0.9, performer: 'Metallica', performer_id: 'voc_001', delivery: 'chant' },
      { start: 14, end: 16, text: 'Your life burns faster', confidence: 0.9, performer: 'Metallica', performer_id: 'voc_001', delivery: 'chant' },
      { start: 20, end: 24, text: 'Master of puppets', confidence: 0.9, performer: 'Metallica', performer_id: 'voc_001', delivery: 'sung' },
      { start: 26, end: 28, text: 'Master, master', confidence: 0.9, performer: 'Metallica', performer_id: 'voc_001', delivery: 'chant' }
    ],
    summary: 'Music vocals alignment test.',
    hasVocals: true,
    totalDuration: 40,
    recognizedSong: {
      status: 'recognized',
      confidence: 0.95,
      candidates: [
        {
          title: 'Master of Puppets',
          artist: 'Metallica',
          confidence: 0.95,
          evidence: ['Literal lyric fragments match the heard chant.'],
          matchedLyrics: ['Master of puppets', 'Master, master'],
          timeRanges: [{ start: 20, end: 28 }]
        }
      ],
      primaryEvidence: 'Literal lyric evidence grounds one specific song.',
      multipleSongsDetected: false
    },
    recognitionNotes: ['Dialogue was excluded from lyric evidence.']
  });

  writeJson(outputPath, {
    vocal_segments: [
      { start: 20, end: 24, text: 'Master of puppets', confidence: 0.9, performer: 'Metallica', performer_id: 'voc_001', delivery: 'sung' },
      { start: 26, end: 28, text: 'Master, master', confidence: 0.9, performer: 'Metallica', performer_id: 'voc_001', delivery: 'chant' }
    ],
    summary: 'Music vocals alignment test.',
    hasVocals: true,
    totalDuration: 40,
    recognizedSong: {
      status: 'recognized',
      confidence: 0.95,
      candidates: [
        {
          title: 'Master of Puppets',
          artist: 'Metallica',
          confidence: 0.95,
          evidence: ['Literal lyric fragments match the heard chant.'],
          matchedLyrics: ['Master of puppets', 'Master, master'],
          timeRanges: [{ start: 20, end: 28 }]
        }
      ],
      primaryEvidence: 'Literal lyric evidence grounds one specific song.',
      multipleSongsDetected: false
    },
    recognitionNotes: ['Dialogue was excluded from lyric evidence.']
  });

  const result = runBenchmarkStage({
    config: {
      name: 'Temp benchmark music vocals time-aware alignment',
      benchmark: {
        enabled: true,
        path: '../benchmarks/fixtures/temp-music-vocals-time-aware-fixture/benchmark.json'
      }
    },
    configPath,
    outputDir
  });

  const artifact = result.artifactResults[0];
  assert.strictEqual(result.status, 'fail');
  assert.strictEqual(artifact.status, 'fail');
  assert.strictEqual(artifact.errors.length, 0);
  assert(artifact.alignments.some((entry) => entry.path === 'vocal_segments' && entry.matches.some((match) => match.truthIndex === 2 && match.outputIndex === 0)));
  assert(artifact.failures.some((failure) => failure.path === 'vocal_segments[truth=0]'));
  assert(artifact.failures.some((failure) => failure.path === 'vocal_segments[truth=1]'));
  assert(artifact.fieldResults.some((field) => field.path === 'vocal_segments[truth=2,output=0].text' && field.status === 'pass'));
  assert(artifact.fieldResults.some((field) => field.path === 'vocal_segments[truth=3,output=1].text' && field.status === 'pass'));
});

test('benchmark runner - speaker_profiles comparator aligns by grounded segment evidence and downgrades clustering structure misses to failures', async (t) => {
  const rootDir = path.join(__dirname, 'tmp-benchmark-speaker-profiles-comparator');
  fs.rmSync(rootDir, { recursive: true, force: true });
  t.after(() => fs.rmSync(rootDir, { recursive: true, force: true }));

  const { configPath, outputDir } = makeTempFixture(rootDir, {
    truthPayload: {
      dialogue_segments: [
        { start: 0, end: 2, speaker: 'Speaker 1', text: 'Alpha.', confidence: 0.98 },
        { start: 4, end: 6, speaker: 'Speaker 2', text: 'Bravo.', confidence: 0.98 },
        { start: 8, end: 10, speaker: 'Speaker 1', text: 'Charlie.', confidence: 0.98 }
      ],
      speaker_profiles: [
        {
          speaker_id: 'spk_001',
          label: 'Speaker 1',
          grounded: {
            confidence: 0.9,
            linked_segment_indexes: [0, 2],
            acoustic_descriptors: [
              { label: 'calm leader', confidence: 0.8 }
            ]
          },
          inferred_traits: {
            traits: [
              { trait: 'role', value: 'leader', confidence: 0.8, note: 'grounded by two segments' }
            ]
          }
        },
        {
          speaker_id: 'spk_002',
          label: 'Speaker 2',
          grounded: {
            confidence: 0.9,
            linked_segment_indexes: [1],
            acoustic_descriptors: [
              { label: 'sharp response', confidence: 0.7 }
            ]
          },
          inferred_traits: {
            traits: [
              { trait: 'role', value: 'responder', confidence: 0.7, note: 'single grounded segment' }
            ]
          }
        }
      ],
      summary: 'Speaker profile comparator test.',
      totalDuration: 12,
      handoffContext: null
    },
    outputPayload: {
      dialogue_segments: [
        { start: 0, end: 2, speaker: 'Speaker A', text: 'Alpha.', confidence: 0.98 },
        { start: 4, end: 6, speaker: 'Speaker B', text: 'Bravo.', confidence: 0.98 },
        { start: 8, end: 10, speaker: 'Speaker A', text: 'Charlie.', confidence: 0.98 }
      ],
      speaker_profiles: [
        {
          speaker_id: 'synthetic_9',
          label: 'Merged responder',
          grounded: {
            confidence: 0.88,
            linked_segment_indexes: [1],
            acoustic_descriptors: [
              { label: 'sharp response', confidence: 0.72 }
            ]
          },
          inferred_traits: {
            traits: [
              { trait: 'role', value: 'responder', confidence: 0.7, note: 'single grounded segment' }
            ]
          }
        },
        {
          speaker_id: 'synthetic_4',
          label: 'Main speaker cluster',
          grounded: {
            confidence: 0.88,
            linked_segment_indexes: [0, 2, 1],
            acoustic_descriptors: [
              { label: 'calm leader', confidence: 0.82 },
              { label: 'extra over-clustered descriptor', confidence: 0.4 }
            ]
          },
          inferred_traits: {
            traits: [
              { trait: 'role', value: 'leader', confidence: 0.8, note: 'grounded by two segments' }
            ]
          }
        }
      ],
      summary: 'Speaker profile comparator test.',
      totalDuration: 12,
      handoffContext: null
    }
  });

  const result = runBenchmarkStage({
    config: {
      name: 'Temp benchmark speaker profiles comparator',
      benchmark: {
        enabled: true,
        path: '../benchmarks/fixtures/temp-fixture/benchmark.json'
      }
    },
    configPath,
    outputDir
  });

  const artifact = result.artifactResults[0];
  assert.strictEqual(result.status, 'fail');
  assert.strictEqual(artifact.status, 'fail');
  assert.strictEqual(artifact.errors.length, 0);
  assert(artifact.alignments.some((entry) => entry.path === 'speaker_profiles' && entry.matches.some((match) => match.truthIndex === 0 && match.outputIndex === 1)));
  assert(!artifact.fieldResults.some((field) => field.path.includes('speaker_id') || field.path.includes('.label')));
  assert(artifact.failures.some((failure) => failure.path.includes('speaker_profiles[truth=0,output=1].grounded.linked_segment_indexes')));
  assert(artifact.failures.some((failure) => failure.path.includes('speaker_profiles[truth=0,output=1].grounded.acoustic_descriptors[1]')));
});

test('benchmark runner - recognizedSong support comparator treats support lists as unordered fuzzy evidence while preserving missing time-range failures', async (t) => {
  const rootDir = path.join(__dirname, 'tmp-benchmark-recognized-song-support-comparator');
  fs.rmSync(rootDir, { recursive: true, force: true });
  t.after(() => fs.rmSync(rootDir, { recursive: true, force: true }));

  const configDir = path.join(rootDir, 'configs');
  const benchmarkDir = path.join(rootDir, 'benchmarks', 'fixtures', 'temp-recognized-song-support-fixture');
  const outputDir = path.join(rootDir, 'output', 'temp-run');
  const configPath = path.join(configDir, 'temp.yaml');
  const fixturePath = path.join(benchmarkDir, 'fixture.json');
  const benchmarkPath = path.join(benchmarkDir, 'benchmark.json');
  const truthPath = path.join(benchmarkDir, 'truth', 'music-vocals-data.json');
  const outputPath = path.join(outputDir, 'phase1-gather-context', 'music-vocals-data.json');

  fs.mkdirSync(configDir, { recursive: true });
  fs.writeFileSync(configPath, 'name: temp recognized song support benchmark config\n', 'utf8');

  writeJson(fixturePath, {
    contractVersion: FIXTURE_CONTRACT_VERSION,
    fixtureId: 'temp-recognized-song-support-fixture',
    asset: { repoPath: 'examples/videos/emotion-tests/cod.mp4' },
    config: { repoPath: 'configs/temp.yaml' },
    benchmark: { entryPath: 'benchmark.json' },
    notes: ['temp recognized song support benchmark fixture']
  });

  writeJson(benchmarkPath, {
    contractVersion: MANIFEST_CONTRACT_VERSION,
    fixtureId: 'temp-recognized-song-support-fixture',
    fixture: { path: 'fixture.json' },
    reports: { outputDir: '_reports' },
    artifacts: [
      {
        artifactKey: 'musicVocalsData',
        label: 'Music vocals',
        phase: 'phase1-gather-context',
        script: 'get-music-vocals',
        output: { path: 'phase1-gather-context/music-vocals-data.json' },
        truth: { path: 'truth/music-vocals-data.json' },
        comparator: {
          kind: 'json-structured',
          profile: 'music-vocals-default',
          options: { timingToleranceSeconds: 2, unknownSentinels: ['unknown', 'ambiguous'] }
        },
        required: true
      }
    ]
  });

  writeJson(truthPath, {
    vocal_segments: [
      { start: 64, end: 65, text: 'Obey your master', confidence: 0.9, performer: 'Metallica lead vocal', performer_id: 'voc_001', delivery: 'chant' },
      { start: 76, end: 98, text: 'Master of puppets section', confidence: 0.9, performer: 'Metallica lead vocal', performer_id: 'voc_001', delivery: 'sung' },
      { start: 116, end: 118, text: 'Obey your master', confidence: 0.9, performer: 'Metallica lead vocal', performer_id: 'voc_001', delivery: 'chant' }
    ],
    summary: 'Recognized song support comparator test.',
    hasVocals: true,
    totalDuration: 140,
    recognizedSong: {
      status: 'recognized',
      confidence: 0.98,
      candidates: [
        {
          title: 'Master of Puppets',
          artist: 'Metallica',
          confidence: 0.98,
          evidence: [
            'Literal lyric fragments such as Master, master and Obey your master are audible.',
            'The surrounding sung lines align with the song chorus sequence.'
          ],
          matchedLyrics: [
            'Obey your master',
            'Master, master, where\'s the dreams that I\'ve been after?'
          ],
          timeRanges: [
            { start: 64, end: 98 },
            { start: 116, end: 118 }
          ]
        }
      ],
      primaryEvidence: 'Repeated lyric fragments ground one specific song.',
      multipleSongsDetected: false
    },
    recognitionNotes: ['Dialogue is excluded from lyric evidence.']
  });

  writeJson(outputPath, {
    vocal_segments: [
      { start: 64, end: 65, text: 'Obey your master', confidence: 0.92, performer: 'Metallica lead vocal', performer_id: 'voc_001', delivery: 'chant' },
      { start: 76, end: 98, text: 'Master of puppets section', confidence: 0.92, performer: 'Metallica lead vocal', performer_id: 'voc_001', delivery: 'sung' }
    ],
    summary: 'Recognized song support comparator test.',
    hasVocals: true,
    totalDuration: 140,
    recognizedSong: {
      status: 'recognized',
      confidence: 0.95,
      candidates: [
        {
          title: 'Master of Puppets',
          artist: 'Metallica',
          confidence: 0.95,
          evidence: [
            'The sung lines line up with the same chorus sequence.',
            'Master, master and obey your master are both clearly audible.'
          ],
          matchedLyrics: [
            'Master, master',
            'Obey your master'
          ],
          timeRanges: [
            { start: 64, end: 98 }
          ]
        }
      ],
      primaryEvidence: 'Repeated lyric fragments ground one specific song.',
      multipleSongsDetected: false
    },
    recognitionNotes: ['Dialogue is excluded from lyric evidence.']
  });

  const result = runBenchmarkStage({
    config: {
      name: 'Temp recognized song support comparator',
      benchmark: {
        enabled: true,
        path: '../benchmarks/fixtures/temp-recognized-song-support-fixture/benchmark.json'
      }
    },
    configPath,
    outputDir
  });

  const artifact = result.artifactResults[0];
  assert.strictEqual(result.status, 'fail');
  assert.strictEqual(artifact.status, 'fail');
  assert.strictEqual(artifact.errors.length, 0);
  assert(artifact.fieldResults.some((field) => field.path.includes('recognizedSong.candidates[truth=0,output=0].evidence[truth=0') && field.status === 'pass'));
  assert(artifact.fieldResults.some((field) => field.path.includes('recognizedSong.candidates[truth=0,output=0].matchedLyrics[truth=0') && field.status === 'pass'));
  assert(artifact.failures.some((failure) => failure.path === 'recognizedSong.candidates[truth=0,output=0].timeRanges[truth=1]'));
});
