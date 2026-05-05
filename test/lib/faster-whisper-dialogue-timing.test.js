const fs = require('fs');
const os = require('os');
const path = require('path');
const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('events');

const {
  deriveFasterWhisperDialogueTiming
} = require('../../server/lib/faster-whisper-dialogue-timing.cjs');

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

test('deriveFasterWhisperDialogueTiming spawns the repo-local bridge with repo-local caches', async (t) => {
  const workspaceDir = makeTempDir('ee-fw-helper-success-');
  t.after(() => fs.rmSync(workspaceDir, { recursive: true, force: true }));

  const pythonPath = path.join(workspaceDir, '.venv-faster-whisper', 'bin', 'python');
  const scriptPath = path.join(workspaceDir, 'server', 'scripts', 'get-context', 'faster-whisper-transcribe.py');
  const hfHome = path.join(workspaceDir, '.cache', 'huggingface');
  const downloadRoot = path.join(workspaceDir, '.cache', 'faster-whisper');

  fs.mkdirSync(path.dirname(pythonPath), { recursive: true });
  fs.mkdirSync(path.dirname(scriptPath), { recursive: true });
  fs.writeFileSync(pythonPath, '#!/usr/bin/env python3\n', 'utf8');
  fs.writeFileSync(scriptPath, '# bridge\n', 'utf8');

  const calls = [];
  const result = await deriveFasterWhisperDialogueTiming({
    assetPath: '/tmp/fake-asset.mp4',
    pythonPath,
    scriptPath,
    hfHome,
    downloadRoot,
    model: 'small.en',
    spawnImpl: (command, args, options) => {
      calls.push({ command, args, options });
      return createFakeChild({
        stdoutText: JSON.stringify({
          dialogue_segments: [
            { text: 'hello world', start: 1.1, end: 2.4, words: [{ word: 'hello', start: 1.1, end: 1.5 }] }
          ],
          summary: '',
          totalDuration: 9.5,
          runtime: { device: 'cuda', computeType: 'float16', model: 'small.en', wordTimestamps: true, vadFilter: false },
          engine: { name: 'faster_whisper', version: '1.2.3' },
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
    '--download-root', downloadRoot
  ]);
  assert.equal(calls[0].options.env.HF_HOME, hfHome);
  assert.ok(fs.existsSync(hfHome));
  assert.ok(fs.existsSync(downloadRoot));
  assert.equal(result.dialogueData.dialogue_segments[0].start, 1.1);
  assert.deepEqual(result.metadata, {
    runtime: { device: 'cuda', computeType: 'float16', model: 'small.en', wordTimestamps: true, vadFilter: false },
    engine: { name: 'faster_whisper', version: '1.2.3' },
    warnings: []
  });
});

test('deriveFasterWhisperDialogueTiming fails when the bridge returns no timed segments', async (t) => {
  const workspaceDir = makeTempDir('ee-fw-helper-empty-');
  t.after(() => fs.rmSync(workspaceDir, { recursive: true, force: true }));

  const pythonPath = path.join(workspaceDir, '.venv-faster-whisper', 'bin', 'python');
  const scriptPath = path.join(workspaceDir, 'server', 'scripts', 'get-context', 'faster-whisper-transcribe.py');

  fs.mkdirSync(path.dirname(pythonPath), { recursive: true });
  fs.mkdirSync(path.dirname(scriptPath), { recursive: true });
  fs.writeFileSync(pythonPath, '#!/usr/bin/env python3\n', 'utf8');
  fs.writeFileSync(scriptPath, '# bridge\n', 'utf8');

  await assert.rejects(() => deriveFasterWhisperDialogueTiming({
    assetPath: '/tmp/fake-asset.mp4',
    pythonPath,
    scriptPath,
    spawnImpl: () => createFakeChild({
      stdoutText: JSON.stringify({
        dialogue_segments: [{ text: 'hello world' }],
        summary: '',
        totalDuration: 9.5,
        runtime: { device: 'cpu', computeType: 'int8', model: 'small.en' },
        engine: { name: 'faster_whisper', version: '1.2.3' },
        warnings: []
      })
    })
  }), /did not return any timed dialogue segments/);
});

test('deriveFasterWhisperDialogueTiming surfaces bridge stderr on non-zero exit', async (t) => {
  const workspaceDir = makeTempDir('ee-fw-helper-error-');
  t.after(() => fs.rmSync(workspaceDir, { recursive: true, force: true }));

  const pythonPath = path.join(workspaceDir, '.venv-faster-whisper', 'bin', 'python');
  const scriptPath = path.join(workspaceDir, 'server', 'scripts', 'get-context', 'faster-whisper-transcribe.py');

  fs.mkdirSync(path.dirname(pythonPath), { recursive: true });
  fs.mkdirSync(path.dirname(scriptPath), { recursive: true });
  fs.writeFileSync(pythonPath, '#!/usr/bin/env python3\n', 'utf8');
  fs.writeFileSync(scriptPath, '# bridge\n', 'utf8');

  await assert.rejects(async () => {
    await deriveFasterWhisperDialogueTiming({
      assetPath: '/tmp/fake-asset.mp4',
      pythonPath,
      scriptPath,
      spawnImpl: () => createFakeChild({
        stderrText: JSON.stringify({
          error: 'All faster-whisper runtime attempts failed.',
          attempts: [
            { device: 'cuda', computeType: 'float16', error: 'RuntimeError: no GPU' },
            { device: 'cpu', computeType: 'int8', error: 'RuntimeError: bad model cache' }
          ]
        }),
        closeCode: 1
      })
    });
  }, (error) => {
    assert.equal(error.name, 'FasterWhisperDialogueTimingError');
    assert.equal(error.exitCode, 1);
    assert.match(error.stderr, /All faster-whisper runtime attempts failed/);
    return true;
  });
});
