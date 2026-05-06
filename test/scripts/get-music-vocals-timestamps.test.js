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

function loadScriptWithMock(mockDeriveFasterWhisperMusicVocalsTiming) {
  const helperPath = require.resolve('../../server/lib/faster-whisper-music-vocals-timing.cjs', { paths: [__dirname] });
  const targetPath = require.resolve('../../server/scripts/get-context/get-music-vocals-timestamps.cjs', { paths: [__dirname] });
  delete require.cache[helperPath];
  delete require.cache[targetPath];
  mockModule('../../server/lib/faster-whisper-music-vocals-timing.cjs', {
    deriveFasterWhisperMusicVocalsTiming: mockDeriveFasterWhisperMusicVocalsTiming
  });
  return require('../../server/scripts/get-context/get-music-vocals-timestamps.cjs');
}

function makeTempDir(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function writeJson(filePath, payload) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), 'utf8');
}

test('get-music-vocals-timestamps invokes faster-whisper timing with the asset path', async (t) => {
  const outputDir = makeTempDir('ee-music-vocals-ts-whisper-call-');
  t.after(() => fs.rmSync(outputDir, { recursive: true, force: true }));

  writeJson(path.join(outputDir, 'phase1-gather-context', 'music-vocals-data.json'), {
    vocal_segments: [
      { index: 0, performer: 'Vocalist 1', performer_id: 'voc_001', delivery: 'sung', text: 'Hello from the chorus', confidence: 0.9 }
    ],
    summary: 'Raw vocals',
    totalDuration: 12.4
  });

  const captured = [];
  const script = loadScriptWithMock(async (input) => {
    captured.push(input);
    return {
      musicVocalsData: {
        vocal_segments: [
          { index: 0, performer: 'Vocalist 1', performer_id: 'voc_001', delivery: 'sung', text: 'hello from the chorus', start: 1.1, end: 2.3, confidence: 0.8 }
        ],
        summary: 'Timed vocals',
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
    config: { gather_context: ['server/scripts/get-context/get-music-vocals.cjs'] }
  });

  assert.deepEqual(captured, [{ assetPath: '/tmp/fake-asset.mp4' }]);
});

test('get-music-vocals-timestamps derives raw-surface timestamps, preserves source text verbatim, and keeps song metadata truthful', async (t) => {
  const outputDir = makeTempDir('ee-music-vocals-ts-raw-');
  t.after(() => fs.rmSync(outputDir, { recursive: true, force: true }));

  writeJson(path.join(outputDir, 'phase1-gather-context', 'music-vocals-data.json'), {
    vocal_segments: [
      { index: 0, performer: 'Vocalist 1', performer_id: 'voc_001', delivery: 'sung', text: 'Master, master', confidence: 0.92 },
      { index: 1, performer: 'Vocalist 1', performer_id: 'voc_001', delivery: 'chant', text: 'Obey your master!', confidence: 0.9 }
    ],
    summary: 'Raw vocals',
    totalDuration: 18,
    recognizedSong: {
      status: 'possible',
      confidence: 0.78,
      candidates: [{ title: 'Master of Puppets', artist: 'Metallica', confidence: 0.78, evidence: ['Heard refrain'], matchedLyrics: ['Master, master'] }]
    },
    recognitionNotes: ['Short refrain only.']
  });

  const script = loadScriptWithMock(async () => ({
    musicVocalsData: {
      vocal_segments: [
        { index: 0, performer: 'Vocalist 1', performer_id: 'voc_001', delivery: 'sung', text: 'master master', start: 1.2, end: 2.6, confidence: 0.87 },
        { index: 1, performer: 'Vocalist 1', performer_id: 'voc_001', delivery: 'chant', text: 'obey your master', start: 3.4, end: 4.4, confidence: 0.88 }
      ],
      summary: 'Timed vocals',
      totalDuration: 18
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
    config: { gather_context: ['server/scripts/get-context/get-music-vocals.cjs'] }
  });

  assert.equal(result.primaryArtifactKey, 'musicVocalsTimestampsData');
  assert.ok(result.artifacts.musicVocalsTimestampsData);
  assert.equal(result.artifacts.musicVocalsTimestampsData.provenance.runtimeArtifactSurface, 'raw');
  assert.equal(result.artifacts.musicVocalsTimestampsData.provenance.sourceRuntimeKey, 'musicVocalsData');
  assert.equal(result.artifacts.musicVocalsTimestampsData.provenance.alignmentEngine, 'faster_whisper');
  assert.equal(result.artifacts.musicVocalsTimestampsData.provenance.alignmentEngineVersion, '1.2.3');
  assert.deepEqual(result.artifacts.musicVocalsTimestampsData.provenance.alignmentRuntime, {
    device: 'cuda',
    computeType: 'float16',
    model: 'small.en',
    wordTimestamps: true,
    vadFilter: false
  });
  assert.equal(result.artifacts.musicVocalsTimestampsData.provenance.recognizedSongUsedForTextRewrite, false);
  assert.equal(result.artifacts.musicVocalsTimestampsData.vocal_segments[0].text, 'Master, master');
  assert.equal(result.artifacts.musicVocalsTimestampsData.vocal_segments[1].text, 'Obey your master!');
  assert.equal(result.artifacts.musicVocalsTimestampsData.vocal_segments[1].timing.status, 'aligned');
  assert.deepEqual(result.artifacts.musicVocalsTimestampsData.recognizedSong, {
    status: 'possible',
    confidence: 0.78,
    candidates: [{ title: 'Master of Puppets', artist: 'Metallica', confidence: 0.78, evidence: ['Heard refrain'], matchedLyrics: ['Master, master'] }]
  });
  assert.deepEqual(result.artifacts.musicVocalsTimestampsData.recognitionNotes, ['Short refrain only.']);

  const persisted = JSON.parse(fs.readFileSync(path.join(outputDir, 'phase1-gather-context', 'music-vocals-timestamps-data.json'), 'utf8'));
  assert.equal(persisted.vocal_segments[0].text, 'Master, master');
  assert.equal(persisted.provenance.sourceTextIntegrity, 'verbatim');
});

test('get-music-vocals-timestamps prefers reconciled music-vocals when canonical resolves reconciled', async (t) => {
  const outputDir = makeTempDir('ee-music-vocals-ts-reconciled-');
  t.after(() => fs.rmSync(outputDir, { recursive: true, force: true }));

  writeJson(path.join(outputDir, 'phase1-gather-context', 'music-vocals-data.json'), {
    vocal_segments: [{ index: 0, performer: 'Vocalist 1', performer_id: 'voc_001', delivery: 'sung', text: 'Raw mixed lyric', confidence: 0.8 }],
    summary: 'Raw vocals',
    totalDuration: 12
  });
  writeJson(path.join(outputDir, 'phase1-gather-context', 'music-vocals-data.reconciled.json'), {
    vocal_segments: [{ index: 0, performer: 'Vocalist 1', performer_id: 'voc_001', delivery: 'sung', text: 'Clean reconciled lyric', confidence: 0.95 }],
    summary: 'Reconciled vocals',
    totalDuration: 12
  });

  const script = loadScriptWithMock(async () => ({
    musicVocalsData: {
      vocal_segments: [
        { index: 0, performer: 'Vocalist 1', performer_id: 'voc_001', delivery: 'sung', text: 'clean reconciled lyric', start: 0.4, end: 1.9, confidence: 0.86 }
      ],
      summary: 'Timed vocals',
      totalDuration: 12
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
        'server/scripts/get-context/get-music-vocals.cjs',
        'server/scripts/get-context/reconcile-famous-song-phase1.cjs'
      ]
    }
  });

  assert.ok(result.artifacts.musicVocalsTimestampsDataReconciled);
  assert.equal(result.artifacts.musicVocalsTimestampsDataReconciled.provenance.runtimeArtifactSurface, 'reconciled');
  assert.equal(result.artifacts.musicVocalsTimestampsDataReconciled.provenance.sourceRuntimeKey, 'musicVocalsDataReconciled');
  assert.equal(result.artifacts.musicVocalsTimestampsDataReconciled.provenance.sourcePath, 'phase1-gather-context/music-vocals-data.reconciled.json');
  assert.equal(result.artifacts.musicVocalsTimestampsDataReconciled.vocal_segments[0].text, 'Clean reconciled lyric');

  const persisted = JSON.parse(fs.readFileSync(path.join(outputDir, 'phase1-gather-context', 'music-vocals-timestamps-data.reconciled.json'), 'utf8'));
  assert.equal(persisted.vocal_segments[0].text, 'Clean reconciled lyric');
  assert.deepEqual(persisted.provenance.alignmentRuntime, {
    device: 'cpu',
    computeType: 'int8',
    model: 'small.en',
    wordTimestamps: true,
    vadFilter: false
  });
});

test('get-music-vocals-timestamps resolves canonical reconciled source from artifacts-complete.json without requiring the reconciled file on disk', async (t) => {
  const outputDir = makeTempDir('ee-music-vocals-ts-complete-');
  t.after(() => fs.rmSync(outputDir, { recursive: true, force: true }));

  writeJson(path.join(outputDir, 'artifacts-complete.json'), {
    musicVocalsData: {
      vocal_segments: [{ index: 0, performer: 'Vocalist 1', performer_id: 'voc_001', delivery: 'sung', text: 'Raw lyric', confidence: 0.8 }],
      summary: 'Raw vocals',
      totalDuration: 10
    },
    musicVocalsDataReconciled: {
      vocal_segments: [{ index: 0, performer: 'Vocalist 1', performer_id: 'voc_001', delivery: 'sung', text: 'Hydrated reconciled lyric', confidence: 0.93 }],
      summary: 'Reconciled vocals',
      totalDuration: 10
    }
  });

  const script = loadScriptWithMock(async () => ({
    musicVocalsData: {
      vocal_segments: [{ index: 0, performer: 'Vocalist 1', performer_id: 'voc_001', delivery: 'sung', text: 'hydrated reconciled lyric', start: 0.8, end: 2.1, confidence: 0.86 }],
      summary: 'Timed vocals',
      totalDuration: 10
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
    config: { gather_context: ['server/scripts/get-context/reconcile-famous-song-phase1.cjs'] }
  });

  assert.ok(result.artifacts.musicVocalsTimestampsDataReconciled);
  assert.equal(result.artifacts.musicVocalsTimestampsDataReconciled.provenance.sourceRuntimeKey, 'musicVocalsDataReconciled');
  assert.equal(result.artifacts.musicVocalsTimestampsDataReconciled.provenance.sourcePath, 'phase1-gather-context/music-vocals-data.reconciled.json');
  assert.equal(result.artifacts.musicVocalsTimestampsDataReconciled.vocal_segments[0].text, 'Hydrated reconciled lyric');
});

test('get-music-vocals-timestamps marks repeated short hooks as partial and weak anchors as unresolved without rewriting text', async (t) => {
  const outputDir = makeTempDir('ee-music-vocals-ts-partial-');
  t.after(() => fs.rmSync(outputDir, { recursive: true, force: true }));

  writeJson(path.join(outputDir, 'phase1-gather-context', 'music-vocals-data.json'), {
    vocal_segments: [
      { index: 0, performer: 'Vocalist 1', performer_id: 'voc_001', delivery: 'chant', text: 'Master, master', confidence: 0.91 },
      { index: 1, performer: 'Vocalist 1', performer_id: 'voc_001', delivery: 'chant', text: 'Battery!', confidence: 0.7 }
    ],
    summary: 'Hook-heavy vocals',
    totalDuration: 14
  });

  const script = loadScriptWithMock(async () => ({
    musicVocalsData: {
      vocal_segments: [
        { index: 0, performer: 'Vocalist 1', performer_id: 'voc_001', delivery: 'chant', text: 'master master', start: 1.0, end: 1.7, confidence: 0.82 },
        { index: 1, performer: 'Vocalist 1', performer_id: 'voc_001', delivery: 'chant', text: 'crowd noise', start: 3.0, end: 3.5, confidence: 0.3 },
        { index: 2, performer: 'Vocalist 1', performer_id: 'voc_001', delivery: 'chant', text: 'master master', start: 5.0, end: 5.8, confidence: 0.81 }
      ],
      summary: 'Timed vocals',
      totalDuration: 14
    },
    metadata: {
      runtime: { device: 'cpu', computeType: 'int8', model: 'small.en', wordTimestamps: true, vadFilter: false },
      engine: { name: 'faster_whisper', version: '1.2.3' },
      warnings: []
    }
  }));

  const result = await script.run({
    assetPath: '/tmp/fake-asset.mp4',
    outputDir,
    config: { gather_context: ['server/scripts/get-context/get-music-vocals.cjs'] }
  });

  const [hook, weak] = result.artifacts.musicVocalsTimestampsData.vocal_segments;
  assert.equal(hook.text, 'Master, master');
  assert.equal(hook.timing.status, 'partial');
  assert.equal(typeof hook.start, 'number');
  assert.equal(typeof hook.end, 'number');
  assert.equal(weak.text, 'Battery!');
  assert.equal(weak.timing.status, 'unresolved');
  assert.equal(Object.prototype.hasOwnProperty.call(weak, 'start'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(weak, 'end'), false);
  assert.ok(result.artifacts.musicVocalsTimestampsData.qualityNotes.some((note) => note.includes('Repeated hooks')));
});

test('get-music-vocals-timestamps adds dialogue-assisted timing anchors for unresolved exact lyric matches without rewriting lyric text', async (t) => {
  const outputDir = makeTempDir('ee-music-vocals-ts-dialogue-anchor-');
  t.after(() => fs.rmSync(outputDir, { recursive: true, force: true }));

  writeJson(path.join(outputDir, 'phase1-gather-context', 'music-vocals-data.reconciled.json'), {
    vocal_segments: [
      { index: 6, performer: 'Vocalist 1', performer_id: 'voc_001', delivery: 'sung', text: 'Twisting your mind and smashing your dreams', confidence: 0.95 },
      { index: 7, performer: 'Vocalist 1', performer_id: 'voc_001', delivery: 'sung', text: 'Blinding your light I can\'t see you', confidence: 0.95 }
    ],
    summary: 'Reconciled vocals',
    totalDuration: 140.042
  });

  writeJson(path.join(outputDir, 'phase1-gather-context', 'dialogue-timestamps-data.reconciled.json'), {
    dialogue_segments: [
      { index: 14, speaker: 'Speaker 6', speaker_id: 'spk_006', text: 'Twisting your mind and smashing your dreams.', start: 80.5, end: 82.5 },
      { index: 20, speaker: 'Speaker 5', speaker_id: 'spk_005', text: 'Pull it together, man.', start: 96.96, end: 99.16 }
    ],
    totalDuration: 140.042
  });

  const script = loadScriptWithMock(async () => ({
    musicVocalsData: {
      vocal_segments: [
        { index: 0, performer: 'Vocalist 1', performer_id: 'voc_001', delivery: 'sung', text: 'master master', start: 89.8, end: 91.68, confidence: 0.87 }
      ],
      summary: 'Timed vocals',
      totalDuration: 140.042
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
    runtimeArtifactSurface: 'reconciled',
    config: { gather_context: ['server/scripts/get-context/reconcile-famous-song-phase1.cjs'] }
  });

  const [anchored, unresolved] = result.artifacts.musicVocalsTimestampsDataReconciled.vocal_segments;
  assert.equal(anchored.text, 'Twisting your mind and smashing your dreams');
  assert.equal(anchored.start, 80.5);
  assert.equal(anchored.end, 82.5);
  assert.deepEqual(anchored.timing, {
    status: 'aligned',
    confidence: 1,
    method: 'dialogue_assisted_anchor',
    provenance: 'dialogue_text_match',
    support: {
      lane: 'dialogue',
      segmentIndex: 14,
      speaker: 'Speaker 6',
      speaker_id: 'spk_006',
      text: 'Twisting your mind and smashing your dreams.'
    }
  });
  assert.equal(unresolved.text, 'Blinding your light I can\'t see you');
  assert.equal(unresolved.timing.status, 'unresolved');
  assert.equal(Object.prototype.hasOwnProperty.call(unresolved, 'start'), false);
  assert.equal(result.artifacts.musicVocalsTimestampsDataReconciled.provenance.sourceTextIntegrity, 'verbatim');
  assert.deepEqual(result.artifacts.musicVocalsTimestampsDataReconciled.provenance.dialogueTimingAssist, {
    enabled: true,
    assistedSegmentCount: 1,
    policy: 'timing_only_exact_normalized_text_match'
  });
  assert.ok(
    result.artifacts.musicVocalsTimestampsDataReconciled.qualityNotes
      .some((note) => note.includes('Dialogue timing may assist unresolved lyric rows only'))
  );
});

test('get-music-vocals-timestamps refuses ambiguous repeated dialogue lyric matches', async (t) => {
  const outputDir = makeTempDir('ee-music-vocals-ts-dialogue-ambiguous-');
  t.after(() => fs.rmSync(outputDir, { recursive: true, force: true }));

  writeJson(path.join(outputDir, 'phase1-gather-context', 'music-vocals-data.reconciled.json'), {
    vocal_segments: [
      { index: 1, performer: 'Vocalist 1', performer_id: 'voc_001', delivery: 'sung', text: 'Master! Master!', confidence: 0.95 }
    ],
    summary: 'Reconciled vocals',
    totalDuration: 140.042
  });

  writeJson(path.join(outputDir, 'phase1-gather-context', 'dialogue-timestamps-data.reconciled.json'), {
    dialogue_segments: [
      { index: 17, speaker: 'Speaker 6', speaker_id: 'spk_006', text: 'Master. Master.', start: 89.8, end: 91.68 },
      { index: 19, speaker: 'Speaker 6', speaker_id: 'spk_006', text: 'Master. Master.', start: 92.22, end: 96.36 }
    ],
    totalDuration: 140.042
  });

  const script = loadScriptWithMock(async () => ({
    musicVocalsData: {
      vocal_segments: [
        { index: 99, performer: 'Vocalist 1', performer_id: 'voc_001', delivery: 'sung', text: 'crowd wash', start: 10, end: 11, confidence: 0.2 }
      ],
      summary: 'Timed vocals',
      totalDuration: 140.042
    },
    metadata: {
      runtime: { device: 'cpu', computeType: 'int8', model: 'small.en', wordTimestamps: true, vadFilter: false },
      engine: { name: 'faster_whisper', version: '1.2.3' },
      warnings: []
    }
  }));

  const result = await script.run({
    assetPath: '/tmp/fake-asset.mp4',
    outputDir,
    runtimeArtifactSurface: 'reconciled',
    config: { gather_context: ['server/scripts/get-context/reconcile-famous-song-phase1.cjs'] }
  });

  const [segment] = result.artifacts.musicVocalsTimestampsDataReconciled.vocal_segments;
  assert.equal(segment.text, 'Master! Master!');
  assert.equal(segment.timing.status, 'unresolved');
  assert.equal(Object.prototype.hasOwnProperty.call(segment, 'start'), false);
  assert.deepEqual(result.artifacts.musicVocalsTimestampsDataReconciled.provenance.dialogueTimingAssist, {
    enabled: false,
    assistedSegmentCount: 0,
    policy: 'timing_only_exact_normalized_text_match'
  });
});
