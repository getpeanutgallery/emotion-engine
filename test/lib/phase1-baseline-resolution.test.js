const assert = require('assert');
const fs = require('fs');
const path = require('path');
const test = require('node:test');
const {
  resolvePhase1ArtifactPath,
  selectCanonicalPhase1ArtifactFromBag,
  normalizeRuntimeArtifactSurface,
  getReconciledArtifactRuntimeKey
} = require('../../server/lib/phase1-baseline-resolution.cjs');

function makeTempOutputDir(rootDir) {
  const outputDir = path.join(rootDir, 'output');
  fs.mkdirSync(path.join(outputDir, 'phase1-gather-context'), { recursive: true });
  return outputDir;
}

test('phase1 baseline resolution - normalizeRuntimeArtifactSurface validates supported surfaces', () => {
  assert.strictEqual(normalizeRuntimeArtifactSurface(), 'canonical');
  assert.strictEqual(normalizeRuntimeArtifactSurface('raw'), 'raw');
  assert.strictEqual(normalizeRuntimeArtifactSurface('reconciled'), 'reconciled');
  assert.throws(() => normalizeRuntimeArtifactSurface('weird'), /Unsupported runtime artifact surface/);
});

test('phase1 baseline resolution - canonical routing prefers reconciled output when reconciliation is configured', async (t) => {
  const rootDir = path.join(__dirname, 'tmp-phase1-baseline-canonical');
  fs.rmSync(rootDir, { recursive: true, force: true });
  t.after(() => fs.rmSync(rootDir, { recursive: true, force: true }));

  const outputDir = makeTempOutputDir(rootDir);
  fs.writeFileSync(path.join(outputDir, 'phase1-gather-context', 'dialogue-v3-source-truth.json'), '{}');
  fs.writeFileSync(path.join(outputDir, 'phase1-gather-context', 'dialogue-v3-source-truth.reconciled.json'), '{}');

  const resolution = resolvePhase1ArtifactPath(outputDir, 'dialogueData', {
    aliasArtifactKey: 'dialogueV3SourceTruth',
    runtimeArtifactSurface: 'canonical',
    config: {
      gather_context: [
        'server/scripts/get-context/get-dialogue.cjs',
        'server/scripts/get-context/reconcile-famous-song-phase1.cjs'
      ]
    }
  });

  assert.strictEqual(resolution.resolvedRuntimeSurface, 'reconciled');
  assert(resolution.resolvedPath.endsWith('dialogue-v3-source-truth.reconciled.json'));
});

test('phase1 baseline resolution - explicit raw routing ignores reconciliation auto-selection', async (t) => {
  const rootDir = path.join(__dirname, 'tmp-phase1-baseline-raw');
  fs.rmSync(rootDir, { recursive: true, force: true });
  t.after(() => fs.rmSync(rootDir, { recursive: true, force: true }));

  const outputDir = makeTempOutputDir(rootDir);
  fs.writeFileSync(path.join(outputDir, 'phase1-gather-context', 'dialogue-v3-source-truth.json'), '{}');
  fs.writeFileSync(path.join(outputDir, 'phase1-gather-context', 'dialogue-v3-source-truth.reconciled.json'), '{}');

  const resolution = resolvePhase1ArtifactPath(outputDir, 'dialogueDataRaw', {
    aliasArtifactKey: 'dialogueV3SourceTruth',
    runtimeArtifactSurface: 'raw',
    config: {
      gather_context: [
        'server/scripts/get-context/get-dialogue.cjs',
        'server/scripts/get-context/reconcile-famous-song-phase1.cjs'
      ]
    }
  });

  assert.strictEqual(resolution.resolvedRuntimeSurface, 'raw');
  assert(resolution.resolvedPath.endsWith('dialogue-v3-source-truth.json'));
});

test('phase1 baseline resolution - explicit reconciled bag routing can reuse a shared runtime artifact family', () => {
  const resolution = selectCanonicalPhase1ArtifactFromBag({
    dialogueV3SourceTruth: { lane: 'raw' },
    dialogueV3SourceTruthReconciled: { lane: 'reconciled' }
  }, 'dialogueData', {
    aliasArtifactKey: 'dialogueV3SourceTruth',
    runtimeArtifactSurface: 'reconciled',
    config: {}
  });

  assert.strictEqual(resolution.resolvedRuntimeSurface, 'reconciled');
  assert.strictEqual(resolution.resolvedRuntimeKey, 'dialogueV3SourceTruthReconciled');
  assert.deepStrictEqual(resolution.resolvedArtifact, { lane: 'reconciled' });
});

test('phase1 baseline resolution - dialogue timestamp artifact family exposes reconciled path/runtime wiring', async (t) => {
  const rootDir = path.join(__dirname, 'tmp-phase1-baseline-dialogue-timestamps');
  fs.rmSync(rootDir, { recursive: true, force: true });
  t.after(() => fs.rmSync(rootDir, { recursive: true, force: true }));

  const outputDir = makeTempOutputDir(rootDir);
  fs.writeFileSync(path.join(outputDir, 'phase1-gather-context', 'dialogue-timestamps-data.json'), '{}');
  fs.writeFileSync(path.join(outputDir, 'phase1-gather-context', 'dialogue-timestamps-data.reconciled.json'), '{}');

  const resolution = resolvePhase1ArtifactPath(outputDir, 'dialogueTimestampsData', {
    runtimeArtifactSurface: 'reconciled',
    config: {
      gather_context: ['server/scripts/get-context/reconcile-famous-song-phase1.cjs']
    }
  });

  assert.strictEqual(resolution.resolvedRuntimeSurface, 'reconciled');
  assert.ok(resolution.resolvedPath.endsWith('dialogue-timestamps-data.reconciled.json'));
  assert.strictEqual(getReconciledArtifactRuntimeKey('dialogueTimestampsData'), 'dialogueTimestampsDataReconciled');
});

test('phase1 baseline resolution - music-vocals timestamp artifact family exposes reconciled path/runtime wiring', async (t) => {
  const rootDir = path.join(__dirname, 'tmp-phase1-baseline-music-vocals-timestamps');
  fs.rmSync(rootDir, { recursive: true, force: true });
  t.after(() => fs.rmSync(rootDir, { recursive: true, force: true }));

  const outputDir = makeTempOutputDir(rootDir);
  fs.writeFileSync(path.join(outputDir, 'phase1-gather-context', 'music-vocals-timestamps-data.json'), '{}');
  fs.writeFileSync(path.join(outputDir, 'phase1-gather-context', 'music-vocals-timestamps-data.reconciled.json'), '{}');

  const resolution = resolvePhase1ArtifactPath(outputDir, 'musicVocalsTimestampsData', {
    runtimeArtifactSurface: 'reconciled',
    config: {
      gather_context: ['server/scripts/get-context/reconcile-famous-song-phase1.cjs']
    }
  });

  assert.strictEqual(resolution.resolvedRuntimeSurface, 'reconciled');
  assert.ok(resolution.resolvedPath.endsWith('music-vocals-timestamps-data.reconciled.json'));
  assert.strictEqual(getReconciledArtifactRuntimeKey('musicVocalsTimestampsData'), 'musicVocalsTimestampsDataReconciled');
});
