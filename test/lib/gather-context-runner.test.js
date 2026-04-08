#!/usr/bin/env node
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

function loadRunnerWithMocks({ executeScriptImpl, clearPhaseExecutionSurfacesImpl = () => {} }) {
  const runnerPath = require.resolve('../../server/lib/phases/gather-context-runner.cjs', { paths: [__dirname] });
  const scriptRunnerPath = require.resolve('../../server/lib/script-runner.cjs', { paths: [__dirname] });
  const outputManagerPath = require.resolve('../../server/lib/output-manager.cjs', { paths: [__dirname] });

  delete require.cache[runnerPath];
  delete require.cache[scriptRunnerPath];
  delete require.cache[outputManagerPath];

  require.cache[scriptRunnerPath] = {
    exports: { executeScript: executeScriptImpl },
    loaded: true,
    id: scriptRunnerPath,
    filename: scriptRunnerPath
  };

  require.cache[outputManagerPath] = {
    exports: { clearPhaseExecutionSurfaces: clearPhaseExecutionSurfacesImpl },
    loaded: true,
    id: outputManagerPath,
    filename: outputManagerPath
  };

  return require('../../server/lib/phases/gather-context-runner.cjs');
}

test('gather-context-runner merges overlapping artifact objects without duplicating nested arrays', async () => {
  const scriptResults = {
    'script-a.cjs': {
      artifacts: {
        musicData: {
          summary: 'original summary',
          segments: [
            { index: 0, text: 'cue one' },
            { index: 1, text: 'cue two' }
          ],
          provenance: { source: 'script-a' },
          tags: ['raw']
        },
        phaseNotes: ['from-a']
      }
    },
    'script-b.cjs': {
      artifacts: {
        musicData: {
          summary: 'reconciled summary',
          segments: [
            { index: 0, text: 'cue one' },
            { index: 1, text: 'cue two' }
          ],
          provenance: { reviewer: 'script-b' },
          tags: ['reconciled']
        },
        phaseNotes: ['from-b']
      }
    }
  };

  const { runGatherContext } = loadRunnerWithMocks({
    executeScriptImpl: async ({ scriptPath }) => {
      const entry = scriptResults[scriptPath];
      if (!entry) {
        throw new Error(`Unexpected scriptPath: ${scriptPath}`);
      }
      return entry;
    }
  });

  const result = await runGatherContext({
    assetPath: 'fixture.mp4',
    outputDir: '/tmp/test-output',
    config: {},
    scripts: ['script-a.cjs', 'script-b.cjs'],
    artifacts: {}
  });

  assert.equal(result.artifacts.musicData.summary, 'reconciled summary');
  assert.deepEqual(result.artifacts.musicData.segments, [
    { index: 0, text: 'cue one' },
    { index: 1, text: 'cue two' }
  ]);
  assert.deepEqual(result.artifacts.musicData.tags, ['reconciled']);
  assert.deepEqual(result.artifacts.musicData.provenance, {
    source: 'script-a',
    reviewer: 'script-b'
  });

  // Keep intentional additive merge behavior for explicit top-level arrays.
  assert.deepEqual(result.artifacts.phaseNotes, ['from-a', 'from-b']);
});

test('mergeArtifacts keeps nested object additions while replacing nested arrays for overlapping keys', () => {
  const { mergeArtifacts } = loadRunnerWithMocks({
    executeScriptImpl: async () => ({ artifacts: {} })
  });

  const merged = mergeArtifacts(
    {
      musicVocalsData: {
        vocal_segments: [{ index: 0, text: 'line one' }],
        metadata: { pass: 1 }
      }
    },
    {
      musicVocalsData: {
        vocal_segments: [{ index: 0, text: 'line one' }],
        metadata: { pass: 2, reconciled: true }
      }
    }
  );

  assert.deepEqual(merged.musicVocalsData.vocal_segments, [{ index: 0, text: 'line one' }]);
  assert.deepEqual(merged.musicVocalsData.metadata, { pass: 2, reconciled: true });
});
