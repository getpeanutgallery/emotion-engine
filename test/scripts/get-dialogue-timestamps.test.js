const fs = require('fs');
const os = require('os');
const path = require('path');
const test = require('node:test');
const assert = require('node:assert/strict');

function mockModule(modulePath, mockExports) {
  const absolutePath = require.resolve(modulePath, { paths: [__dirname] });
  delete require.cache[absolutePath];
  require.cache[absolutePath] = {
    exports: mockExports,
    loaded: true,
    id: absolutePath,
    filename: absolutePath
  };
}

function loadScriptWithMock(mockRun) {
  const getDialoguePath = require.resolve('../../server/scripts/get-context/get-dialogue.cjs', { paths: [__dirname] });
  const targetPath = require.resolve('../../server/scripts/get-context/get-dialogue-timestamps.cjs', { paths: [__dirname] });
  delete require.cache[getDialoguePath];
  delete require.cache[targetPath];
  mockModule('../../server/scripts/get-context/get-dialogue.cjs', { run: mockRun });
  return require('../../server/scripts/get-context/get-dialogue-timestamps.cjs');
}

function makeTempDir(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function writeJson(filePath, payload) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), 'utf8');
}

test('get-dialogue-timestamps applies bounded retry defaults to the alignment rerun without mutating the caller config', async (t) => {
  const outputDir = makeTempDir('ee-dialogue-ts-retry-');
  t.after(() => fs.rmSync(outputDir, { recursive: true, force: true }));

  writeJson(path.join(outputDir, 'phase1-gather-context', 'dialogue-data.json'), {
    dialogue_segments: [
      { index: 0, speaker: 'Speaker 1', speaker_id: 'spk_001', text: 'Hello, world!', confidence: 0.9 }
    ],
    summary: 'Raw dialogue',
    totalDuration: 12.4
  });

  let capturedConfig = null;
  const originalConfig = {
    ai: {
      dialogue: {
        targets: [
          {
            adapter: {
              name: 'openrouter',
              model: 'xiaomi/mimo-v2-omni'
            }
          }
        ]
      }
    },
    gather_context: ['server/scripts/get-context/get-dialogue.cjs']
  };

  const script = loadScriptWithMock(async ({ config }) => {
    capturedConfig = config;
    return {
      artifacts: {
        dialogueData: {
          dialogue_segments: [
            { index: 0, speaker: 'Speaker 1', speaker_id: 'spk_001', text: 'hello world', start: 1.1, end: 2.3, confidence: 0.8 }
          ],
          summary: 'Timed dialogue',
          totalDuration: 12.4
        }
      }
    };
  });

  await script.run({
    assetPath: '/tmp/fake-asset.mp4',
    outputDir,
    config: originalConfig
  });

  assert.ok(capturedConfig);
  assert.equal(capturedConfig.ai.dialogue.retry.maxAttempts, 2);
  assert.equal(capturedConfig.ai.dialogue.retry.backoffMs, 1000);
  assert.equal(originalConfig.ai.dialogue.retry, undefined);
});

test('get-dialogue-timestamps preserves stronger caller retry config on the alignment rerun', async (t) => {
  const outputDir = makeTempDir('ee-dialogue-ts-retry-existing-');
  t.after(() => fs.rmSync(outputDir, { recursive: true, force: true }));

  writeJson(path.join(outputDir, 'phase1-gather-context', 'dialogue-data.json'), {
    dialogue_segments: [
      { index: 0, speaker: 'Speaker 1', speaker_id: 'spk_001', text: 'Hello, world!', confidence: 0.9 }
    ],
    summary: 'Raw dialogue',
    totalDuration: 12.4
  });

  let capturedConfig = null;
  const script = loadScriptWithMock(async ({ config }) => {
    capturedConfig = config;
    return {
      artifacts: {
        dialogueData: {
          dialogue_segments: [
            { index: 0, speaker: 'Speaker 1', speaker_id: 'spk_001', text: 'hello world', start: 1.1, end: 2.3, confidence: 0.8 }
          ],
          summary: 'Timed dialogue',
          totalDuration: 12.4
        }
      }
    };
  });

  await script.run({
    assetPath: '/tmp/fake-asset.mp4',
    outputDir,
    config: {
      ai: {
        dialogue: {
          retry: {
            maxAttempts: 4,
            backoffMs: 2500
          }
        }
      },
      gather_context: ['server/scripts/get-context/get-dialogue.cjs']
    }
  });

  assert.ok(capturedConfig);
  assert.equal(capturedConfig.ai.dialogue.retry.maxAttempts, 4);
  assert.equal(capturedConfig.ai.dialogue.retry.backoffMs, 2500);
});

test('get-dialogue-timestamps derives raw-surface timestamps and preserves source text verbatim', async (t) => {
  const outputDir = makeTempDir('ee-dialogue-ts-raw-');
  t.after(() => fs.rmSync(outputDir, { recursive: true, force: true }));

  writeJson(path.join(outputDir, 'phase1-gather-context', 'dialogue-data.json'), {
    dialogue_segments: [
      { index: 0, speaker: 'Speaker 1', speaker_id: 'spk_001', text: 'Hello, world!', confidence: 0.9 },
      { index: 1, speaker: 'Speaker 2', speaker_id: 'spk_002', text: 'General Kenobi.', confidence: 0.91 }
    ],
    summary: 'Raw dialogue',
    totalDuration: 12.4
  });

  const script = loadScriptWithMock(async () => ({
    artifacts: {
      dialogueData: {
        dialogue_segments: [
          { index: 0, speaker: 'Speaker 1', speaker_id: 'spk_001', text: 'hello world', start: 1.1, end: 2.3, confidence: 0.8 },
          { index: 1, speaker: 'Speaker 2', speaker_id: 'spk_002', text: 'general kenobi', start: 3.0, end: 4.5, confidence: 0.81 }
        ],
        summary: 'Timed dialogue',
        totalDuration: 12.4
      }
    }
  }));

  const result = await script.run({
    assetPath: '/tmp/fake-asset.mp4',
    outputDir,
    config: { gather_context: ['server/scripts/get-context/get-dialogue.cjs'] }
  });

  assert.equal(result.primaryArtifactKey, 'dialogueTimestampsData');
  assert.ok(result.artifacts.dialogueTimestampsData);
  assert.equal(result.artifacts.dialogueTimestampsData.provenance.runtimeArtifactSurface, 'raw');
  assert.equal(result.artifacts.dialogueTimestampsData.provenance.sourceRuntimeKey, 'dialogueData');
  assert.equal(result.artifacts.dialogueTimestampsData.dialogue_segments[0].text, 'Hello, world!');
  assert.equal(result.artifacts.dialogueTimestampsData.dialogue_segments[1].text, 'General Kenobi.');
  assert.equal(result.artifacts.dialogueTimestampsData.dialogue_segments[0].start, 1.1);
  assert.equal(result.artifacts.dialogueTimestampsData.dialogue_segments[1].end, 4.5);

  const persisted = JSON.parse(fs.readFileSync(path.join(outputDir, 'phase1-gather-context', 'dialogue-timestamps-data.json'), 'utf8'));
  assert.equal(persisted.dialogue_segments[0].text, 'Hello, world!');
  assert.equal(persisted.provenance.sourceTextIntegrity, 'verbatim');
});

test('get-dialogue-timestamps prefers reconciled dialogue when canonical surface resolves reconciled', async (t) => {
  const outputDir = makeTempDir('ee-dialogue-ts-reconciled-');
  t.after(() => fs.rmSync(outputDir, { recursive: true, force: true }));

  writeJson(path.join(outputDir, 'phase1-gather-context', 'dialogue-data.json'), {
    dialogue_segments: [
      { index: 0, speaker: 'Speaker 1', speaker_id: 'spk_001', text: 'Raw mixed lyric line', confidence: 0.8 }
    ],
    summary: 'Raw dialogue',
    totalDuration: 9
  });
  writeJson(path.join(outputDir, 'phase1-gather-context', 'dialogue-data.reconciled.json'), {
    dialogue_segments: [
      { index: 0, speaker: 'Speaker 1', speaker_id: 'spk_001', text: 'Clean reconciled line', confidence: 0.93 }
    ],
    summary: 'Reconciled dialogue',
    totalDuration: 9
  });

  const script = loadScriptWithMock(async () => ({
    artifacts: {
      dialogueData: {
        dialogue_segments: [
          { index: 0, speaker: 'Speaker 1', speaker_id: 'spk_001', text: 'clean reconciled line', start: 0.5, end: 1.8, confidence: 0.86 }
        ],
        summary: 'Timed dialogue',
        totalDuration: 9
      }
    }
  }));

  const result = await script.run({
    assetPath: '/tmp/fake-asset.mp4',
    outputDir,
    config: {
      gather_context: [
        'server/scripts/get-context/get-dialogue.cjs',
        'server/scripts/get-context/reconcile-famous-song-phase1.cjs'
      ]
    }
  });

  assert.ok(result.artifacts.dialogueTimestampsDataReconciled);
  assert.equal(result.artifacts.dialogueTimestampsDataReconciled.provenance.runtimeArtifactSurface, 'reconciled');
  assert.equal(result.artifacts.dialogueTimestampsDataReconciled.provenance.sourceRuntimeKey, 'dialogueDataReconciled');
  assert.equal(result.artifacts.dialogueTimestampsDataReconciled.provenance.sourcePath, 'phase1-gather-context/dialogue-data.reconciled.json');
  assert.equal(result.artifacts.dialogueTimestampsDataReconciled.dialogue_segments[0].text, 'Clean reconciled line');
  assert.ok(!result.artifacts.dialogueTimestampsData);

  const persisted = JSON.parse(fs.readFileSync(path.join(outputDir, 'phase1-gather-context', 'dialogue-timestamps-data.reconciled.json'), 'utf8'));
  assert.equal(persisted.dialogue_segments[0].text, 'Clean reconciled line');
});

test('get-dialogue-timestamps uses canonical reconciled dialogue from artifacts-complete.json without requiring the reconciled file on disk', async (t) => {
  const outputDir = makeTempDir('ee-dialogue-ts-complete-');
  t.after(() => fs.rmSync(outputDir, { recursive: true, force: true }));

  writeJson(path.join(outputDir, 'artifacts-complete.json'), {
    dialogueData: {
      dialogue_segments: [
        { index: 0, speaker: 'Speaker 1', speaker_id: 'spk_001', text: 'Raw mixed lyric line', confidence: 0.8 }
      ],
      summary: 'Raw dialogue',
      totalDuration: 9
    },
    dialogueDataReconciled: {
      dialogue_segments: [
        { index: 0, speaker: 'Speaker 1', speaker_id: 'spk_001', text: 'Hydrated reconciled line', confidence: 0.93 }
      ],
      summary: 'Reconciled dialogue',
      totalDuration: 9
    }
  });

  const script = loadScriptWithMock(async () => ({
    artifacts: {
      dialogueData: {
        dialogue_segments: [
          { index: 0, speaker: 'Speaker 1', speaker_id: 'spk_001', text: 'hydrated reconciled line', start: 0.5, end: 1.8, confidence: 0.86 }
        ],
        summary: 'Timed dialogue',
        totalDuration: 9
      }
    }
  }));

  const result = await script.run({
    assetPath: '/tmp/fake-asset.mp4',
    outputDir,
    config: {
      gather_context: [
        'server/scripts/get-context/get-dialogue.cjs',
        'server/scripts/get-context/reconcile-famous-song-phase1.cjs'
      ]
    }
  });

  assert.ok(result.artifacts.dialogueTimestampsDataReconciled);
  assert.equal(result.artifacts.dialogueTimestampsDataReconciled.provenance.runtimeArtifactSurface, 'reconciled');
  assert.equal(result.artifacts.dialogueTimestampsDataReconciled.provenance.sourceRuntimeKey, 'dialogueDataReconciled');
  assert.equal(result.artifacts.dialogueTimestampsDataReconciled.provenance.sourcePath, 'phase1-gather-context/dialogue-data.reconciled.json');
  assert.equal(result.artifacts.dialogueTimestampsDataReconciled.dialogue_segments[0].text, 'Hydrated reconciled line');
});

test('get-dialogue-timestamps uses in-memory canonical reconciled dialogue without requiring the reconciled file on disk', async (t) => {
  const outputDir = makeTempDir('ee-dialogue-ts-runtime-');
  t.after(() => fs.rmSync(outputDir, { recursive: true, force: true }));

  const script = loadScriptWithMock(async () => ({
    artifacts: {
      dialogueData: {
        dialogue_segments: [
          { index: 0, speaker: 'Speaker 1', speaker_id: 'spk_001', text: 'runtime reconciled line', start: 0.25, end: 1.1, confidence: 0.89 }
        ],
        summary: 'Timed dialogue',
        totalDuration: 6
      }
    }
  }));

  const result = await script.run({
    assetPath: '/tmp/fake-asset.mp4',
    outputDir,
    artifacts: {
      dialogueDataReconciled: {
        dialogue_segments: [
          { index: 0, speaker: 'Speaker 1', speaker_id: 'spk_001', text: 'Runtime reconciled line', confidence: 0.95 }
        ],
        summary: 'Runtime reconciled dialogue',
        totalDuration: 6
      }
    },
    config: {
      gather_context: [
        'server/scripts/get-context/get-dialogue.cjs',
        'server/scripts/get-context/reconcile-famous-song-phase1.cjs'
      ]
    }
  });

  assert.ok(result.artifacts.dialogueTimestampsDataReconciled);
  assert.equal(result.artifacts.dialogueTimestampsDataReconciled.provenance.runtimeArtifactSurface, 'reconciled');
  assert.equal(result.artifacts.dialogueTimestampsDataReconciled.provenance.sourceRuntimeKey, 'dialogueDataReconciled');
  assert.equal(result.artifacts.dialogueTimestampsDataReconciled.provenance.sourcePath, 'phase1-gather-context/dialogue-data.reconciled.json');
  assert.equal(result.artifacts.dialogueTimestampsDataReconciled.dialogue_segments[0].text, 'Runtime reconciled line');
});

test('get-dialogue-timestamps fails loudly when canonical/reconciled dialogue is expected but unavailable', async (t) => {
  const outputDir = makeTempDir('ee-dialogue-ts-missing-');
  t.after(() => fs.rmSync(outputDir, { recursive: true, force: true }));

  writeJson(path.join(outputDir, 'phase1-gather-context', 'dialogue-data.json'), {
    dialogue_segments: [{ index: 0, speaker: 'Speaker 1', speaker_id: 'spk_001', text: 'Only raw line', confidence: 0.7 }],
    summary: 'Raw dialogue',
    totalDuration: 7
  });

  const script = loadScriptWithMock(async () => ({
    artifacts: {
      dialogueData: {
        dialogue_segments: [
          { index: 0, speaker: 'Speaker 1', speaker_id: 'spk_001', text: 'only raw line', start: 0.3, end: 1.2, confidence: 0.75 }
        ],
        summary: 'Timed dialogue',
        totalDuration: 7
      }
    }
  }));

  await assert.rejects(() => script.run({
    assetPath: '/tmp/fake-asset.mp4',
    outputDir,
    config: {
      gather_context: [
        'server/scripts/get-context/get-dialogue.cjs',
        'server/scripts/get-context/reconcile-famous-song-phase1.cjs'
      ]
    }
  }), /reconciled dialogueData artifact is missing/);
});
