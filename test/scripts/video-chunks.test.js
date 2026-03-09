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
    rawResponse: '{"summary":"Test chunk summary","emotions":{"patience":{"score":7,"reasoning":"Test reasoning"}}}',
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
        rawResponse: '{"summary":"Test chunk summary","emotions":{"patience":{"score":7,"reasoning":"Test reasoning"}}}',
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

    await tNested.test('keeps processed chunk files by default', async () => {
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

      const chunksDir = path.join(testOutputDir, 'assets', 'processed', 'chunks');
      ok(fs.existsSync(chunksDir));
      ok(fs.readdirSync(chunksDir).some((file) => file.endsWith('.mp4')));
    });

    await tNested.test('cleans processed chunk files when debug.keepProcessedIntermediates=false', async () => {
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
          },
          debug: {
            keepProcessedIntermediates: false
          }
        }
      });

      const chunksDir = path.join(testOutputDir, 'assets', 'processed', 'chunks');
      if (fs.existsSync(chunksDir)) {
        is(fs.readdirSync(chunksDir).length, 0);
      } else {
        ok(true);
      }
    });

    await tNested.test('stores processed debug chunks under run-level assets directory (not phase assets)', async () => {
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
          },
          debug: { keepTempFiles: true, keepProcessedAssets: true },
          settings: { max_chunks: 1 },
          tool_variables: {
            chunk_strategy: { type: 'duration-based', config: { chunkDuration: 8 } }
          }
        }
      });

      const processedChunksDir = path.join(testOutputDir, 'assets', 'processed', 'chunks');
      ok(fs.existsSync(processedChunksDir));

      const chunkFiles = fs.readdirSync(processedChunksDir);
      ok(chunkFiles.length > 0);

      const legacyPhaseAssetsDir = path.join(testOutputDir, 'phase2-process', 'assets');
      ok(!fs.existsSync(legacyPhaseAssetsDir));
    });

    await tNested.test('captures chunk AI raw output even when processed intermediates are cleaned', async () => {
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
            provider: 'openrouter',
            video: { model: 'yaml-video-model' }
          },
          debug: {
            captureRaw: true,
            keepProcessedIntermediates: false
          },
          settings: { max_chunks: 1 },
          tool_variables: {
            chunk_strategy: { type: 'duration-based', config: { chunkDuration: 8 } }
          }
        }
      });

      const rawChunkPath = path.join(testOutputDir, 'phase2-process', 'raw', 'ai', 'chunk-0.json');
      ok(fs.existsSync(rawChunkPath));

      const rawChunk = JSON.parse(fs.readFileSync(rawChunkPath, 'utf8'));
      property(rawChunk, 'chunkIndex');
      property(rawChunk, 'prompt');
      property(rawChunk, 'rawResponse');
      property(rawChunk, 'parsed');
      property(rawChunk, 'provider');
      property(rawChunk, 'model');
      is(rawChunk.model, 'yaml-video-model');
      is(typeof rawChunk.rawResponse, 'string');
      ok(rawChunk.rawResponse.length > 0);

      ok(analyzeCalls.length > 0);
      is(analyzeCalls[0]?.config?.debug?.captureRaw, true);

      const chunksDir = path.join(testOutputDir, 'assets', 'processed', 'chunks');
      if (fs.existsSync(chunksDir)) {
        is(fs.readdirSync(chunksDir).length, 0);
      } else {
        ok(true);
      }
    });
  });

  t.test('AI_API_KEY requirement by DIGITAL_TWIN_MODE', async (tNested) => {
    await tNested.test('requires AI_API_KEY when DIGITAL_TWIN_MODE is off', async () => {
      delete process.env.AI_API_KEY;
      process.env.DIGITAL_TWIN_MODE = 'off';

      try {
        await rejects(videoChunksScript.run({
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
        }), /AI_API_KEY is required for chunk analysis unless DIGITAL_TWIN_MODE=replay/);
      } finally {
        process.env.AI_API_KEY = 'test-api-key';
        delete process.env.DIGITAL_TWIN_MODE;
      }
    });

    await tNested.test('allows missing AI_API_KEY when DIGITAL_TWIN_MODE=replay', async () => {
      delete process.env.AI_API_KEY;
      process.env.DIGITAL_TWIN_MODE = 'replay';

      try {
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
            }
          }
        });

        property(result, 'artifacts');
        property(result.artifacts, 'chunkAnalysis');
      } finally {
        process.env.AI_API_KEY = 'test-api-key';
        delete process.env.DIGITAL_TWIN_MODE;
      }
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

    await tNested.test('retries invalid first response and succeeds on second attempt', async () => {
      let callCount = 0;
      analyzeImplementation = async (input) => {
        analyzeCalls.push(input);
        callCount += 1;

        if (callCount === 1) {
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
            video: {
              model: 'yaml-video-model',
              retry: {
                maxAttempts: 2,
                backoffMs: 0,
                retryOnParseError: true,
                retryOnProviderError: true
              }
            }
          },
          tool_variables: {
            chunk_strategy: { type: 'duration-based', config: { chunkDuration: 8 } }
          },
          settings: { max_chunks: 1 }
        }
      });

      is(analyzeCalls.length, 2);
      is(result.artifacts.chunkAnalysis.statusSummary.successful, 1);
      is(result.artifacts.chunkAnalysis.statusSummary.failed, 0);
      is(result.artifacts.chunkAnalysis.chunks[0].summary, 'Valid chunk summary');
    });

    await tNested.test('hard-fails run after repeated provider errors', async () => {
      analyzeImplementation = async (input) => {
        analyzeCalls.push(input);
        throw new Error('provider timeout');
      };

      await rejects(videoChunksScript.run({
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
            video: {
              model: 'yaml-video-model',
              retry: {
                maxAttempts: 2,
                backoffMs: 0,
                retryOnParseError: true,
                retryOnProviderError: true
              }
            }
          },
          tool_variables: {
            chunk_strategy: { type: 'duration-based', config: { chunkDuration: 8 } }
          },
          settings: { max_chunks: 1 }
        }
      }), /failed after 2 attempts: provider timeout/);

      is(analyzeCalls.length, 2);
      const artifactPath = path.join(testOutputDir, 'phase2-process', 'chunk-analysis.json');
      is(fs.existsSync(artifactPath), false);
    });
  });
});
