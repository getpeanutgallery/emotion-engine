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
