const fs = require('fs');
const os = require('os');
const path = require('path');
const test = require('node:test');
const assert = require('node:assert/strict');

const { executeScript } = require('../../server/lib/script-runner.cjs');
const { extractAudioChunk } = require('../../server/lib/audio-chunk-extractor.cjs');
const { extractVideoChunk } = require('../../server/lib/video-chunk-extractor.cjs');
const { preflightAudio } = require('../../server/lib/audio-preflight.cjs');
const { loadPersistedArtifacts } = require('../../server/lib/persisted-artifacts.cjs');
const { serializeArtifacts, loadArtifacts } = require('../../server/lib/artifact-manager.cjs');

function makeTempDir(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

test('deterministic tool-wrapper helpers emit structured failure metadata', async (t) => {
  await t.test('audio chunk extractor surfaces path-normalization-eligible failures for missing source audio', async () => {
    const outputDir = makeTempDir('ee-audio-chunk-');
    const result = await extractAudioChunk('/tmp/definitely-missing-audio.wav', 0, 5, outputDir, 0);

    assert.equal(result.success, false);
    assert.equal(result.failure.failureCategory, 'dependency');
    assert.equal(result.failure.failureCode, 'AUDIO_CHUNK_SOURCE_MISSING');
    assert.equal(result.failure.pathNormalizationEligible, true);
  });

  await t.test('video chunk extractor surfaces path-normalization-eligible failures for missing source video', async () => {
    const outputDir = makeTempDir('ee-video-chunk-');
    const result = await extractVideoChunk('/tmp/definitely-missing-video.mp4', 0, 5, outputDir, 0);

    assert.equal(result.success, false);
    assert.equal(result.failure.failureCategory, 'dependency');
    assert.equal(result.failure.failureCode, 'VIDEO_CHUNK_SOURCE_MISSING');
    assert.equal(result.failure.pathNormalizationEligible, true);
  });

  await t.test('audio preflight throws structured missing-path failures', () => {
    assert.throws(() => preflightAudio({ audioPath: '/tmp/definitely-missing-audio.wav' }), (error) => {
      assert.equal(error.failureCategory, 'dependency');
      assert.equal(error.failureCode, 'AUDIO_PREFLIGHT_SOURCE_MISSING');
      assert.equal(error.pathNormalizationEligible, true);
      return true;
    });
  });
});

test('deterministic persistence helpers emit structured artifact failures', async (t) => {
  await t.test('loadPersistedArtifacts throws structured invalid_output on malformed artifacts-complete.json', () => {
    const outputDir = makeTempDir('ee-persisted-artifacts-');
    fs.writeFileSync(path.join(outputDir, 'artifacts-complete.json'), '{not-json', 'utf8');

    assert.throws(() => loadPersistedArtifacts(outputDir), (error) => {
      assert.equal(error.failureCategory, 'invalid_output');
      assert.equal(error.failureCode, 'PERSISTED_ARTIFACT_INVALID_JSON');
      return true;
    });
  });

  await t.test('serializeArtifacts/loadArtifacts preserve happy-path persistence', async () => {
    const outputDir = makeTempDir('ee-artifact-manager-');
    const artifacts = { metadataData: { ok: true }, chunkAnalysis: { chunks: [] } };

    const saved = await serializeArtifacts(artifacts, outputDir);
    assert.equal(saved.length, 1);
    assert.ok(saved[0].endsWith('artifacts-complete.json'));

    const loaded = await loadArtifacts(outputDir);
    assert.deepEqual(loaded, artifacts);
  });

  await t.test('loadPersistedArtifacts prefers reconciled dialogue/music-vocals when reconciliation is configured', () => {
    const outputDir = makeTempDir('ee-persisted-reconciled-');
    const phaseDir = path.join(outputDir, 'phase1-gather-context');
    fs.mkdirSync(phaseDir, { recursive: true });

    fs.writeFileSync(path.join(phaseDir, 'dialogue-data.json'), JSON.stringify({ summary: 'raw dialogue' }), 'utf8');
    fs.writeFileSync(path.join(phaseDir, 'dialogue-data.reconciled.json'), JSON.stringify({ summary: 'reconciled dialogue' }), 'utf8');
    fs.writeFileSync(path.join(phaseDir, 'music-vocals-data.json'), JSON.stringify({ summary: 'raw vocals' }), 'utf8');
    fs.writeFileSync(path.join(phaseDir, 'music-vocals-data.reconciled.json'), JSON.stringify({ summary: 'reconciled vocals' }), 'utf8');

    const loaded = loadPersistedArtifacts(outputDir, {
      keys: ['dialogueData', 'musicVocalsData'],
      config: {
        gather_context: [
          'server/scripts/get-context/get-dialogue.cjs',
          'server/scripts/get-context/reconcile-famous-song-phase1.cjs'
        ]
      }
    });

    assert.equal(loaded.artifacts.dialogueData.summary, 'reconciled dialogue');
    assert.equal(loaded.artifacts.musicVocalsData.summary, 'reconciled vocals');
  });

  await t.test('loadPersistedArtifacts resolves the canonical reconciled surface from artifacts-complete.json when reconciliation is configured', () => {
    const outputDir = makeTempDir('ee-persisted-complete-reconciled-');
    fs.writeFileSync(path.join(outputDir, 'artifacts-complete.json'), JSON.stringify({
      dialogueData: { summary: 'raw dialogue', dialogue_segments: [{ index: 0, text: 'raw line' }] },
      dialogueDataReconciled: { summary: 'reconciled dialogue', dialogue_segments: [{ index: 0, text: 'reconciled line' }] },
      dialogueV3SourceTruth: { summary: 'raw dialogue v3', dialogue_segments: [{ index: 0, text: 'raw line', traits: { audibility: 'clear' } }] },
      dialogueV3SourceTruthReconciled: { summary: 'reconciled dialogue v3', dialogue_segments: [{ index: 0, text: 'reconciled line', traits: { audibility: 'clear' } }] },
      dialogueTimestampsData: { summary: 'raw dialogue timestamps', dialogue_segments: [{ index: 0, text: 'raw line', start: 1, end: 2 }] },
      dialogueTimestampsDataReconciled: { summary: 'reconciled dialogue timestamps', dialogue_segments: [{ index: 0, text: 'reconciled line', start: 1.2, end: 2.4 }] },
      musicVocalsData: { summary: 'raw vocals', vocal_segments: [{ index: 0, text: 'raw lyric' }] },
      musicVocalsDataReconciled: { summary: 'reconciled vocals', vocal_segments: [{ index: 0, text: 'reconciled lyric' }] }
    }, null, 2), 'utf8');

    const loaded = loadPersistedArtifacts(outputDir, {
      keys: ['dialogueData', 'dialogueV3SourceTruth', 'dialogueTimestampsData', 'musicVocalsData'],
      config: {
        gather_context: ['server/scripts/get-context/reconcile-famous-song-phase1.cjs']
      }
    });

    assert.equal(loaded.artifacts.dialogueData.summary, 'reconciled dialogue');
    assert.equal(loaded.artifacts.dialogueData.dialogue_segments[0].text, 'reconciled line');
    assert.equal(loaded.artifacts.dialogueV3SourceTruth.summary, 'reconciled dialogue v3');
    assert.equal(loaded.artifacts.dialogueV3SourceTruth.dialogue_segments[0].text, 'reconciled line');
    assert.equal(loaded.artifacts.dialogueTimestampsData.summary, 'reconciled dialogue timestamps');
    assert.equal(loaded.artifacts.dialogueTimestampsData.dialogue_segments[0].start, 1.2);
    assert.equal(loaded.artifacts.musicVocalsData.summary, 'reconciled vocals');
    assert.equal(loaded.artifacts.musicVocalsData.vocal_segments[0].text, 'reconciled lyric');
  });

  await t.test('loadPersistedArtifacts fails fast only when reconciliation is configured and reconciled output is missing', () => {
    const outputDir = makeTempDir('ee-persisted-reconciled-missing-');
    const phaseDir = path.join(outputDir, 'phase1-gather-context');
    fs.mkdirSync(phaseDir, { recursive: true });

    fs.writeFileSync(path.join(phaseDir, 'dialogue-data.json'), JSON.stringify({ summary: 'raw dialogue' }), 'utf8');

    assert.throws(() => loadPersistedArtifacts(outputDir, {
      keys: ['dialogueData'],
      strict: true,
      config: {
        gather_context: ['server/scripts/get-context/reconcile-famous-song-phase1.cjs']
      }
    }), /reconciled dialogueData artifact is missing/);

    const fallback = loadPersistedArtifacts(outputDir, {
      keys: ['dialogueData'],
      strict: true,
      config: {
        gather_context: ['server/scripts/get-context/get-dialogue.cjs']
      }
    });

    assert.equal(fallback.artifacts.dialogueData.summary, 'raw dialogue');
  });
});

test('get-metadata rides the shared tool-wrapper contract with deterministic recovery guidance', async () => {
  const outputDir = makeTempDir('ee-get-metadata-');

  await assert.rejects(async () => executeScript({
    phase: 'phase1-gather-context',
    scriptPath: 'server/scripts/get-context/get-metadata.cjs',
    input: {
      assetPath: '/tmp/definitely-missing-video.mp4',
      outputDir,
      artifacts: {},
      config: { name: 'tool-wrapper-test', debug: { captureRaw: false } }
    }
  }), (error) => {
    assert.equal(error.failureCategory, 'dependency');
    assert.ok(error.failureCode === 'GET_METADATA_TOOL_FAILED' || error.failureCode === 'GET_METADATA_SOURCE_MISSING');
    return true;
  });

  const envelopePath = path.join(outputDir, 'phase1-gather-context', 'script-results', 'get-metadata.failure.json');
  const envelope = JSON.parse(fs.readFileSync(envelopePath, 'utf8'));
  assert.equal(envelope.failure.category, 'dependency');
  assert.equal(envelope.recoveryPolicy.nextAction.policy, 'deterministic_recovery');
  assert.equal(envelope.recoveryPolicy.nextAction.target, 'retry-after-path-normalization');
});
