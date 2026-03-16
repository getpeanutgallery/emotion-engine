const fs = require('fs');
const path = require('path');
const os = require('os');
const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('events');

function mockModule(modulePath, mockExports) {
  const absolutePath = require.resolve(modulePath, { paths: [__dirname] });
  if (require.cache[absolutePath]) delete require.cache[absolutePath];
  require.cache[absolutePath] = { exports: mockExports, loaded: true, id: absolutePath, filename: absolutePath };
}

let lastSpawnArgs = null;

mockModule('child_process', {
  spawn: (command, args) => {
    lastSpawnArgs = { command, args };
    const proc = new EventEmitter();
    proc.stderr = new EventEmitter();

    process.nextTick(() => {
      fs.writeFileSync(args[args.length - 1], 'mock chunk');
      proc.emit('close', 0);
    });

    return proc;
  }
});

mockModule('../../server/lib/ffmpeg-path.cjs', {
  ffmpegPath: 'ffmpeg'
});

const { extractVideoChunk } = require('../../server/lib/video-chunk-extractor.cjs');

test('video-chunk-extractor', async (t) => {
  let tempDir;
  let sourcePath;

  t.beforeEach(() => {
    lastSpawnArgs = null;
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'video-chunk-extractor-'));
    sourcePath = path.join(tempDir, 'input.mp4');
    fs.writeFileSync(sourcePath, 'source');
  });

  t.afterEach(() => {
    if (tempDir && fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  await t.test('uses a bounded duration slice via -t instead of an absolute -to end time', async () => {
    const outputDir = path.join(tempDir, 'chunks');
    const result = await extractVideoChunk(sourcePath, 10, 15, outputDir, 1);

    assert.equal(result.success, true);
    assert.ok(lastSpawnArgs);
    assert.deepEqual(lastSpawnArgs.args.slice(0, 6), ['-ss', '10', '-i', sourcePath, '-t', '5']);
    assert.ok(!lastSpawnArgs.args.includes('-to'));
    assert.ok(fs.existsSync(result.chunkPath));
  });
});
