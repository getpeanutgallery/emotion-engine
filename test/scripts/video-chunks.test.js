const fs = require('fs');
const path = require('path');
const test = require('node:test');
const { property, ok, is, rejects } = require('../helpers/assertions');

process.env.AI_API_KEY = 'test-api-key';

function mockModule(modulePath, mockExports) {
  const absolutePath = require.resolve(modulePath, { paths: [__dirname] });
  if (require.cache[absolutePath]) delete require.cache[absolutePath];
  require.cache[absolutePath] = {
    exports: mockExports,
    loaded: true,
    id: absolutePath,
    filename: absolutePath
  };
}

const mockEmotionLensesTool = {
  analyze: async () => ({
    prompt: 'Test prompt',
    state: {
      summary: 'Test chunk summary',
      emotions: {
        patience: { score: 7, reasoning: 'Test reasoning' },
        boredom: { score: 3, reasoning: 'Test reasoning' },
        excitement: { score: 6, reasoning: 'Test reasoning' }
      },
      dominant_emotion: 'patience',
      confidence: 0.85,
      previousSummary: ''
    },
    usage: { input: 150, output: 100 }
  })
};

const mockVideoChunkExtractor = {
  extractVideoChunk: async (assetPath, startTime, endTime, chunksDir, chunkIndex) => {
    const chunkPath = path.join(chunksDir, `chunk-${chunkIndex}.mp4`);
    fs.mkdirSync(chunksDir, { recursive: true });
    fs.writeFileSync(chunkPath, 'mock chunk');
    return { success: true, chunkPath };
  }
};

const mockChildProcess = {
  exec: (cmd, callback) => {
    if (cmd.includes('ffprobe')) {
      callback?.(null, { stdout: '16.0', stderr: '' });
    } else {
      callback?.(null, { stdout: '', stderr: '' });
    }
    return { on: () => {} };
  },
  execSync: () => Buffer.from('16.0')
};

mockModule('tools/emotion-lenses-tool.cjs', mockEmotionLensesTool);
mockModule('child_process', mockChildProcess);
mockModule('../../server/lib/video-chunk-extractor.cjs', mockVideoChunkExtractor);

const videoChunksScript = require('../../server/scripts/process/video-chunks.cjs');

test('Video Chunks Script', async (t) => {
  const testOutputDir = '/tmp/test-chunks-output';

  t.beforeEach(() => {
    if (!fs.existsSync(testOutputDir)) fs.mkdirSync(testOutputDir, { recursive: true });
  });

  t.afterEach(() => {
    if (fs.existsSync(testOutputDir)) fs.rmSync(testOutputDir, { recursive: true, force: true });
  });

  t.test('run function', async (tNested) => {
    await tNested.test('exports run function', () => {
      is(typeof videoChunksScript.run, 'function');
    });

    await tNested.test('throws error when toolVariables is missing', async () => {
      await rejects(videoChunksScript.run({
        assetPath: '/path/to/test-video.mp4',
        outputDir: testOutputDir,
        artifacts: {},
        toolVariables: null
      }), /toolVariables\.soulPath and toolVariables\.goalPath are required/);
    });

    await tNested.test('throws error when soulPath is missing', async () => {
      await rejects(videoChunksScript.run({
        assetPath: '/path/to/test-video.mp4',
        outputDir: testOutputDir,
        artifacts: {},
        toolVariables: {
          goalPath: '/path/to/GOAL.md',
          variables: { lenses: ['patience'] }
        }
      }), /toolVariables\.soulPath and toolVariables\.goalPath are required/);
    });

    await tNested.test('returns correct output structure', async () => {
      const result = await videoChunksScript.run({
        assetPath: '/path/to/test-video.mp4',
        outputDir: testOutputDir,
        artifacts: {
          dialogueData: { dialogue_segments: [], summary: '' },
          musicData: { segments: [] }
        },
        toolVariables: {
          soulPath: '/path/to/SOUL.md',
          goalPath: '/path/to/GOAL.md',
          variables: { lenses: ['patience'] }
        },
        config: {
          tool_variables: {
            chunk_strategy: { type: 'duration-based', config: { chunkDuration: 8 } }
          }
        }
      });

      property(result, 'artifacts');
      property(result.artifacts, 'chunkAnalysis');
      property(result.artifacts.chunkAnalysis, 'chunks');
      property(result.artifacts.chunkAnalysis, 'totalTokens');
      property(result.artifacts.chunkAnalysis, 'persona');
    });

    await tNested.test('writes chunk-analysis.json to phase output directory', async () => {
      await videoChunksScript.run({
        assetPath: '/path/to/test-video.mp4',
        outputDir: testOutputDir,
        artifacts: {},
        toolVariables: {
          soulPath: '/path/to/SOUL.md',
          goalPath: '/path/to/GOAL.md',
          variables: { lenses: ['patience'] }
        }
      });

      const artifactPath = path.join(testOutputDir, 'phase2-process', 'chunk-analysis.json');
      ok(fs.existsSync(artifactPath));
      const data = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
      property(data, 'chunks');
      property(data, 'totalTokens');
    });
  });

  t.test('token counting', async (tNested) => {
    await tNested.test('tracks total tokens correctly', async () => {
      const result = await videoChunksScript.run({
        assetPath: '/path/to/test-video.mp4',
        outputDir: testOutputDir,
        artifacts: {},
        toolVariables: {
          soulPath: '/path/to/SOUL.md',
          goalPath: '/path/to/GOAL.md',
          variables: { lenses: ['patience'] }
        },
        config: {
          tool_variables: {
            chunk_strategy: { type: 'duration-based', config: { chunkDuration: 8 } }
          },
          settings: { max_chunks: 2 }
        }
      });

      is(result.artifacts.chunkAnalysis.totalTokens, 500);
    });
  });
});
