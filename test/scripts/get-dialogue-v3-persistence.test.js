const fs = require('fs');
const path = require('path');
const os = require('os');
const assert = require('node:assert/strict');
const test = require('node:test');
const { EventEmitter } = require('node:events');
const { validateDialogueV3SourceTruthObject } = require('../../server/lib/dialogue-v3-source-truth-validator.cjs');

process.env.AI_API_KEY = 'test-api-key';

function mockModule(modulePath, mockExports) {
  const absolutePath = require.resolve(modulePath, { paths: [__dirname] });
  if (require.cache[absolutePath]) delete require.cache[absolutePath];
  require.cache[absolutePath] = { exports: mockExports, loaded: true, id: absolutePath, filename: absolutePath };
}

let mockExtractedAudioData = Buffer.from('mock audio data');
let completeImplementation = async (options) => {
  if (String(options?.prompt || '').includes('dialogue transcript stitcher')) {
    return {
      content: JSON.stringify({
        cleanedTranscript: 'CLEANED TRANSCRIPT',
        auditTrail: [],
        debug: { refs: [] }
      }),
      usage: { input: 100, output: 150 }
    };
  }

  return {
    content: JSON.stringify({
      dialogue_segments: [
        {
          start: 0,
          end: 1.5,
          speaker: 'Commander',
          speaker_id: 'spk_001',
          text: 'Move now, squad up!',
          confidence: 0.96
        }
      ],
      speaker_profiles: [
        {
          speaker_id: 'spk_001',
          label: 'Commander',
          grounded: {
            confidence: 0.84,
            linked_segment_indexes: [0],
            acoustic_descriptors: [
              { label: 'older, authoritative public-address male voice with close-mic radio texture', confidence: 0.9 },
              { label: 'steady, resolute delivery', confidence: 0.72 }
            ]
          },
          inferred_traits: {
            traits: [
              { trait: 'accent', value: 'possibly Southern US', confidence: 0.31, note: 'speculative' }
            ]
          }
        }
      ],
      summary: 'Runtime dialogue summary',
      handoffContext: 'Continue',
      totalDuration: 10
    }),
    usage: { input: 100, output: 150 }
  };
};

mockModule('ai-providers/ai-provider-interface.js', {
  getProviderFromConfig: () => ({ complete: completeImplementation }),
  loadProvider: () => ({ complete: completeImplementation }),
  getProviderFromEnv: () => {
    throw new Error('getProviderFromEnv should not be used in get-dialogue');
  }
});

mockModule('child_process', {
  exec: (cmd, callback) => {
    const match = cmd.match(/-y\s+"([^"]+)"/);
    if (match) {
      const outputPath = match[1];
      fs.mkdirSync(path.dirname(outputPath), { recursive: true });
      fs.writeFileSync(outputPath, mockExtractedAudioData);
    }
    if (callback) callback(null, { stdout: '', stderr: '' });
    return { on: () => {} };
  },
  spawn: (cmd, args) => {
    const proc = new EventEmitter();
    proc.stderr = new EventEmitter();
    const outputPath = args[args.length - 1];
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, mockExtractedAudioData);
    setImmediate(() => proc.emit('close', 0));
    return proc;
  },
  execSync: (cmd) => {
    if (cmd.includes('ffprobe')) return Buffer.from('10.0');
    return Buffer.from('');
  }
});

const getDialogueScript = require('../../server/scripts/get-context/get-dialogue.cjs');

function makeDialogueConfig() {
  return {
    ai: {
      dialogue: {
        targets: [
          {
            adapter: {
              name: 'openrouter',
              model: 'test-dialogue-model'
            }
          }
        ]
      }
    },
    settings: {
      ffmpeg: {
        audio: {
          loglevel: 'error',
          codec: 'pcm_s16le',
          sample_rate_hz: 16000,
          channels: 1,
          container: 'wav'
        }
      }
    }
  };
}

function makeTempDir(prefix = 'ee-get-dialogue-v3-') {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

test('get-dialogue persists validator-compatible dialogue v3 source truth alongside dialogue-data', async () => {
  const outputDir = makeTempDir();

  const result = await getDialogueScript.run({
    assetPath: '/path/to/test-video.mp4',
    outputDir,
    config: makeDialogueConfig()
  });

  const persistedPath = path.join(outputDir, 'phase1-gather-context', 'dialogue-v3-source-truth.json');
  const persisted = JSON.parse(fs.readFileSync(persistedPath, 'utf8'));
  const validation = validateDialogueV3SourceTruthObject(persisted);

  assert.equal(validation.ok, true);
  assert.deepEqual(result.artifacts.dialogueV3SourceTruth, persisted);
  assert.equal(persisted.dialogue_segments[0].text, 'Move now, squad up!');
  assert.equal(persisted.dialogue_segments[0].traits.transmission_medium, 'radio');
  assert.equal(persisted.dialogue_segments[0].traits.spatial_texture, 'close');
  assert.equal(persisted.dialogue_segments[0].traits.interpersonal_stance, 'performative');
  assert.equal(persisted.dialogue_segments[0].traits.affect, 'determined');
  assert.equal(persisted.dialogue_segments[0].traits.accent_family, 'anglophone_non_neutral');
  assert.equal(persisted.dialogue_segments[0].traits.delivery_overlay, 'none_apparent');
});
