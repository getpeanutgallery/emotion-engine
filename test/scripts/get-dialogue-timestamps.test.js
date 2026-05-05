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

function loadScriptWithMock(mockDeriveFasterWhisperDialogueTiming) {
  const helperPath = require.resolve('../../server/lib/faster-whisper-dialogue-timing.cjs', { paths: [__dirname] });
  const targetPath = require.resolve('../../server/scripts/get-context/get-dialogue-timestamps.cjs', { paths: [__dirname] });
  delete require.cache[helperPath];
  delete require.cache[targetPath];
  mockModule('../../server/lib/faster-whisper-dialogue-timing.cjs', {
    deriveFasterWhisperDialogueTiming: mockDeriveFasterWhisperDialogueTiming
  });
  return require('../../server/scripts/get-context/get-dialogue-timestamps.cjs');
}

function makeTempDir(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function writeJson(filePath, payload) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), 'utf8');
}

test('get-dialogue-timestamps invokes faster-whisper timing with the asset path', async (t) => {
  const outputDir = makeTempDir('ee-dialogue-ts-whisper-call-');
  t.after(() => fs.rmSync(outputDir, { recursive: true, force: true }));

  writeJson(path.join(outputDir, 'phase1-gather-context', 'dialogue-data.json'), {
    dialogue_segments: [
      { index: 0, speaker: 'Speaker 1', speaker_id: 'spk_001', text: 'Hello, world!', confidence: 0.9 }
    ],
    summary: 'Raw dialogue',
    totalDuration: 12.4
  });

  const captured = [];
  const script = loadScriptWithMock(async (input) => {
    captured.push(input);
    return {
      dialogueData: {
        dialogue_segments: [
          { index: 0, speaker: 'Speaker 1', speaker_id: 'spk_001', text: 'hello world', start: 1.1, end: 2.3, confidence: 0.8 }
        ],
        summary: 'Timed dialogue',
        totalDuration: 12.4
      },
      metadata: {
        runtime: { device: 'cuda', computeType: 'float16', model: 'small.en', wordTimestamps: true, vadFilter: false },
        engine: { name: 'faster_whisper', version: '1.2.3' },
        warnings: []
      }
    };
  });

  await script.run({
    assetPath: '/tmp/fake-asset.mp4',
    outputDir,
    config: { gather_context: ['server/scripts/get-context/get-dialogue.cjs'] }
  });

  assert.deepEqual(captured, [{ assetPath: '/tmp/fake-asset.mp4' }]);
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
    dialogueData: {
      dialogue_segments: [
        { index: 0, speaker: 'Speaker 1', speaker_id: 'spk_001', text: 'hello world', start: 1.1, end: 2.3, confidence: 0.8 },
        { index: 1, speaker: 'Speaker 2', speaker_id: 'spk_002', text: 'general kenobi', start: 3.0, end: 4.5, confidence: 0.81 }
      ],
      summary: 'Timed dialogue',
      totalDuration: 12.4
    },
    metadata: {
      runtime: { device: 'cuda', computeType: 'float16', model: 'small.en', wordTimestamps: true, vadFilter: false },
      engine: { name: 'faster_whisper', version: '1.2.3' },
      warnings: []
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
  assert.equal(result.artifacts.dialogueTimestampsData.provenance.alignmentEngine, 'faster_whisper');
  assert.equal(result.artifacts.dialogueTimestampsData.provenance.alignmentEngineVersion, '1.2.3');
  assert.deepEqual(result.artifacts.dialogueTimestampsData.provenance.alignmentRuntime, {
    device: 'cuda',
    computeType: 'float16',
    model: 'small.en',
    wordTimestamps: true,
    vadFilter: false
  });
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
    dialogueData: {
      dialogue_segments: [
        { index: 0, speaker: 'Speaker 1', speaker_id: 'spk_001', text: 'clean reconciled line', start: 0.5, end: 1.8, confidence: 0.86 }
      ],
      summary: 'Timed dialogue',
      totalDuration: 9
    },
    metadata: {
      runtime: { device: 'cpu', computeType: 'int8', model: 'small.en', wordTimestamps: true, vadFilter: false },
      engine: { name: 'faster_whisper', version: '1.2.3' },
      warnings: ['Fallback from cuda/float16 due to RuntimeError: GPU unavailable']
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
  assert.deepEqual(persisted.provenance.alignmentRuntime, {
    device: 'cpu',
    computeType: 'int8',
    model: 'small.en',
    wordTimestamps: true,
    vadFilter: false
  });
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
    dialogueData: {
      dialogue_segments: [
        { index: 0, speaker: 'Speaker 1', speaker_id: 'spk_001', text: 'hydrated reconciled line', start: 0.5, end: 1.8, confidence: 0.86 }
      ],
      summary: 'Timed dialogue',
      totalDuration: 9
    },
    metadata: {
      runtime: { device: 'cuda', computeType: 'float16', model: 'small.en', wordTimestamps: true, vadFilter: false },
      engine: { name: 'faster_whisper', version: '1.2.3' },
      warnings: []
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
    dialogueData: {
      dialogue_segments: [
        { index: 0, speaker: 'Speaker 1', speaker_id: 'spk_001', text: 'runtime reconciled line', start: 0.25, end: 1.1, confidence: 0.89 }
      ],
      summary: 'Timed dialogue',
      totalDuration: 6
    },
    metadata: {
      runtime: { device: 'cuda', computeType: 'float16', model: 'small.en', wordTimestamps: true, vadFilter: false },
      engine: { name: 'faster_whisper', version: '1.2.3' },
      warnings: []
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
    dialogueData: {
      dialogue_segments: [
        { index: 0, speaker: 'Speaker 1', speaker_id: 'spk_001', text: 'only raw line', start: 0.3, end: 1.2, confidence: 0.75 }
      ],
      summary: 'Timed dialogue',
      totalDuration: 7
    },
    metadata: {
      runtime: { device: 'cuda', computeType: 'float16', model: 'small.en', wordTimestamps: true, vadFilter: false },
      engine: { name: 'faster_whisper', version: '1.2.3' },
      warnings: []
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
