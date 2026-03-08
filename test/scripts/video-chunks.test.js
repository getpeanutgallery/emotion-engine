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

const analyzeCalls = [];
let analyzeImplementation = async (input) => {
  analyzeCalls.push(input);
  return {
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
  };
};

const mockEmotionLensesTool = {
  analyze: async (input) => analyzeImplementation(input)
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
    analyzeCalls.length = 0;
    analyzeImplementation = async (input) => {
      analyzeCalls.push(input);
      return {
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
      };
    };
    if (!fs.existsSync(testOutputDir)) fs.mkdirSync(testOutputDir, { recursive: true });
  });

  t.afterEach(() => {
    delete process.env.AI_MODEL;
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
          ai: {
            video: { model: 'yaml-video-model' }
          },
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
        },
        config: {
          ai: {
            video: { model: 'yaml-video-model' }
          }
        }
      });

      const artifactPath = path.join(testOutputDir, 'phase2-process', 'chunk-analysis.json');
      ok(fs.existsSync(artifactPath));
      const data = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
      property(data, 'chunks');
      property(data, 'totalTokens');
    });

    await tNested.test('uses YAML config.ai.video.model for chunk analysis', async () => {
      process.env.AI_MODEL = 'env-model-that-must-be-ignored';

      await videoChunksScript.run({
        assetPath: '/path/to/test-video.mp4',
        outputDir: testOutputDir,
        artifacts: {},
        toolVariables: {
          soulPath: '/path/to/SOUL.md',
          goalPath: '/path/to/GOAL.md',
          variables: { lenses: ['patience'] }
        },
        config: {
          ai: {
            video: { model: 'yaml-video-model' }
          }
        }
      });

      is(analyzeCalls.length > 0, true);
      is(analyzeCalls[0].toolVariables.variables.model, 'yaml-video-model');
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
          ai: {
            video: { model: 'yaml-video-model' }
          },
          tool_variables: {
            chunk_strategy: { type: 'duration-based', config: { chunkDuration: 8 } }
          },
          settings: { max_chunks: 2 }
        }
      });

      is(result.artifacts.chunkAnalysis.totalTokens, 500);
    });

    await tNested.test('marks parse fallback chunk as failed and continues', async () => {
      let callCount = 0;
      analyzeImplementation = async (input) => {
        analyzeCalls.push(input);
        callCount += 1;

        if (callCount === 2) {
          return {
            prompt: 'Test prompt',
            state: {
              summary: 'Analysis completed',
              emotions: {
                patience: { score: 5, reasoning: 'Default - could not parse response' },
                boredom: { score: 5, reasoning: 'Default - could not parse response' }
              },
              dominant_emotion: 'patience',
              confidence: 0.5
            },
            usage: { input: 10, output: 10 }
          };
        }

        return {
          prompt: 'Test prompt',
          state: {
            summary: 'Valid chunk summary',
            emotions: {
              patience: { score: 8, reasoning: 'Solid hook' },
              boredom: { score: 2, reasoning: 'Engaging' }
            },
            dominant_emotion: 'patience',
            confidence: 0.9
          },
          usage: { input: 100, output: 50 }
        };
      };

      const result = await videoChunksScript.run({
        assetPath: '/path/to/test-video.mp4',
        outputDir: testOutputDir,
        artifacts: {},
        toolVariables: {
          soulPath: '/path/to/SOUL.md',
          goalPath: '/path/to/GOAL.md',
          variables: { lenses: ['patience', 'boredom'] }
        },
        config: {
          ai: {
            video: { model: 'yaml-video-model' }
          },
          tool_variables: {
            chunk_strategy: { type: 'duration-based', config: { chunkDuration: 8 } }
          },
          settings: { max_chunks: 2 }
        }
      });

      const failed = result.artifacts.chunkAnalysis.chunks.find((chunk) => chunk.status === 'failed');
      ok(!!failed);
      ok(failed.errorReason.includes('parse_error'));
      is(result.artifacts.chunkAnalysis.statusSummary.successful, 1);
      is(result.artifacts.chunkAnalysis.statusSummary.failed, 1);
    });
  });
});
