const fs = require('fs');
const os = require('os');
const path = require('path');
const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('events');

const {
  deriveWhisperXMusicVocalsTiming
} = require('../../server/lib/whisperx-music-vocals-timing.cjs');

function makeTempDir(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function createFakeChild({ stdoutText = '', stderrText = '', closeCode = 0, launchError = null }) {
  const child = new EventEmitter();
  child.stdout = new EventEmitter();
  child.stderr = new EventEmitter();

  process.nextTick(() => {
    if (stdoutText) child.stdout.emit('data', Buffer.from(stdoutText));
    if (stderrText) child.stderr.emit('data', Buffer.from(stderrText));
    if (launchError) {
      child.emit('error', launchError);
      return;
    }
    child.emit('close', closeCode);
  });

  return child;
}

test('deriveWhisperXMusicVocalsTiming spawns the repo-local bridge with repo-local caches', async (t) => {
  const workspaceDir = makeTempDir('ee-wx-music-helper-success-');
  t.after(() => fs.rmSync(workspaceDir, { recursive: true, force: true }));

  const pythonPath = path.join(workspaceDir, '.venv-whisperx', 'bin', 'python');
  const scriptPath = path.join(workspaceDir, 'server', 'scripts', 'get-context', 'whisperx-transcribe.py');
  const hfHome = path.join(workspaceDir, '.cache', 'huggingface');
  const downloadRoot = path.join(workspaceDir, '.cache', 'whisperx');

  fs.mkdirSync(path.dirname(pythonPath), { recursive: true });
  fs.mkdirSync(path.dirname(scriptPath), { recursive: true });
  fs.writeFileSync(pythonPath, '#!/usr/bin/env python3\n', 'utf8');
  fs.writeFileSync(scriptPath, '# bridge\n', 'utf8');

  const calls = [];
  const debugEvidence = [];
  const result = await deriveWhisperXMusicVocalsTiming({
    assetPath: '/tmp/fake-asset.mp4',
    pythonPath,
    scriptPath,
    hfHome,
    downloadRoot,
    model: 'small.en',
    batchSize: 8,
    onDebugEvidence: (payload) => debugEvidence.push(payload),
    spawnImpl: (command, args, options) => {
      calls.push({ command, args, options });
      return createFakeChild({
        stdoutText: JSON.stringify({
          dialogue_segments: [
            { text: 'hello from the chorus', start: 1.1, end: 2.4, words: [{ word: 'hello', start: 1.1, end: 1.5, score: 0.91 }] }
          ],
          summary: '',
          totalDuration: 9.5,
          runtime: { device: 'cuda', computeType: 'float16', model: 'small.en', batchSize: 8, language: 'en', alignmentModel: 'WAV2VEC2_ASR_LARGE_LV60K_960H', wordTimestamps: true, vadFilter: false },
          engine: { name: 'whisperx', version: '3.3.1' },
          warnings: []
        })
      });
    }
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].command, pythonPath);
  assert.deepEqual(calls[0].args, [
    scriptPath,
    '--asset-path', '/tmp/fake-asset.mp4',
    '--model', 'small.en',
    '--download-root', downloadRoot,
    '--batch-size', '8'
  ]);
  assert.equal(calls[0].options.env.HF_HOME, hfHome);
  assert.ok(fs.existsSync(hfHome));
  assert.ok(fs.existsSync(downloadRoot));
  assert.equal(result.musicVocalsData.vocal_segments[0].start, 1.1);
  assert.equal(result.metadata.engine.name, 'whisperx');
  assert.equal(debugEvidence[0].backend, 'whisperx');
  assert.equal(debugEvidence[0].bridgePayload.engine.name, 'whisperx');
});

test('deriveWhisperXMusicVocalsTiming fails clearly when the repo-local WhisperX runtime is missing', async () => {
  await assert.rejects(() => deriveWhisperXMusicVocalsTiming({
    assetPath: '/tmp/fake-asset.mp4',
    pythonPath: '/tmp/does-not-exist/.venv-whisperx/bin/python',
    scriptPath: '/tmp/does-not-exist/server/scripts/get-context/whisperx-transcribe.py'
  }), /Repo-local WhisperX Python is missing/);
});

test('deriveWhisperXMusicVocalsTiming surfaces bridge stderr on non-zero exit', async (t) => {
  const workspaceDir = makeTempDir('ee-wx-music-helper-error-');
  t.after(() => fs.rmSync(workspaceDir, { recursive: true, force: true }));

  const pythonPath = path.join(workspaceDir, '.venv-whisperx', 'bin', 'python');
  const scriptPath = path.join(workspaceDir, 'server', 'scripts', 'get-context', 'whisperx-transcribe.py');

  fs.mkdirSync(path.dirname(pythonPath), { recursive: true });
  fs.mkdirSync(path.dirname(scriptPath), { recursive: true });
  fs.writeFileSync(pythonPath, '#!/usr/bin/env python3\n', 'utf8');
  fs.writeFileSync(scriptPath, '# bridge\n', 'utf8');

  await assert.rejects(async () => {
    await deriveWhisperXMusicVocalsTiming({
      assetPath: '/tmp/fake-asset.mp4',
      pythonPath,
      scriptPath,
      spawnImpl: () => createFakeChild({
        stderrText: JSON.stringify({
          error: 'All WhisperX runtime attempts failed.',
          attempts: [
            { device: 'cuda', computeType: 'float16', error: 'RuntimeError: no GPU' },
            { device: 'cpu', computeType: 'int8', error: 'ImportError: torchaudio missing' }
          ]
        }),
        closeCode: 1
      })
    });
  }, (error) => {
    assert.equal(error.name, 'WhisperXMusicVocalsTimingError');
    assert.equal(error.exitCode, 1);
    assert.match(error.stderr, /All WhisperX runtime attempts failed/);
    return true;
  });
});
