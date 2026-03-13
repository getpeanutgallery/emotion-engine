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

function readLatestChunkRawCapture(rawAiDir, chunkIndex, splitIndex = 0) {
  const legacyFileName = splitIndex > 0
    ? `chunk-${chunkIndex}-split-${splitIndex}.json`
    : `chunk-${chunkIndex}.json`;

  const pointerPath = path.join(rawAiDir, legacyFileName);
  const pointer = JSON.parse(fs.readFileSync(pointerPath, 'utf8'));

  if (pointer && pointer.kind === 'pointer' && pointer.target && pointer.target.file) {
    const capturePath = path.join(rawAiDir, pointer.target.file);
    const capture = JSON.parse(fs.readFileSync(capturePath, 'utf8'));
    return { pointer, capture };
  }

  // Backward compat if legacy file is still the capture payload.
  return { pointer: null, capture: pointer };
}

const analyzeCalls = [];
let analyzeImplementation = async (input) => {
  analyzeCalls.push(input);
  return {
    completion: {
      content: JSON.stringify({
        summary: 'Test chunk summary',
        emotions: {
          patience: { score: 7, reasoning: 'Test reasoning' },
          boredom: { score: 3, reasoning: 'Test reasoning' },
          excitement: { score: 6, reasoning: 'Test reasoning' }
        },
        dominant_emotion: 'patience',
        confidence: 0.85
      }),
      usage: { input: 150, output: 100 }
    },
    parsed: {
      summary: 'Test chunk summary',
      emotions: {
        patience: { score: 7, reasoning: 'Test reasoning' },
        boredom: { score: 3, reasoning: 'Test reasoning' },
        excitement: { score: 6, reasoning: 'Test reasoning' }
      },
      dominant_emotion: 'patience',
      confidence: 0.85
    },
    toolLoop: {
      toolName: 'validate_emotion_analysis_json',
      turns: 2,
      validatorCalls: 1,
      history: [
        { role: 'tool', kind: 'validator_acceptance' }
      ]
    }
  };
};

const mockEmotionLensesTool = {
  buildBasePromptFromInput: (input) => `Prompt for ${input?.toolVariables?.variables?.lenses?.join(', ') || 'none'}`,
  executeEmotionAnalysisToolLoop: async (input) => analyzeImplementation(input)
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
mockModule('../../server/lib/emotion-lenses-tool.cjs', mockEmotionLensesTool);
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
        completion: {
          content: JSON.stringify({
            summary: 'Test chunk summary',
            emotions: {
              patience: { score: 7, reasoning: 'Test reasoning' },
              boredom: { score: 3, reasoning: 'Test reasoning' },
              excitement: { score: 6, reasoning: 'Test reasoning' }
            },
            dominant_emotion: 'patience',
            confidence: 0.85
          }),
          usage: { input: 150, output: 100 }
        },
        parsed: {
          summary: 'Test chunk summary',
          emotions: {
            patience: { score: 7, reasoning: 'Test reasoning' },
            boredom: { score: 3, reasoning: 'Test reasoning' },
            excitement: { score: 6, reasoning: 'Test reasoning' }
          },
          dominant_emotion: 'patience',
          confidence: 0.85
        },
        toolLoop: {
          toolName: 'validate_emotion_analysis_json',
          turns: 2,
          validatorCalls: 1,
          history: [
            { role: 'tool', kind: 'validator_acceptance' }
          ]
        }
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
            video: { targets: [ { adapter: { name: 'openrouter', model: 'yaml-video-model' } } ] }
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
            video: { targets: [ { adapter: { name: 'openrouter', model: 'yaml-video-model' } } ] }
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
            video: { targets: [ { adapter: { name: 'openrouter', model: 'yaml-video-model' } } ] }
          }
        }
      });

      is(analyzeCalls.length > 0, true);
      is(analyzeCalls[0].toolVariables.variables.model, 'yaml-video-model');
    });

    await tNested.test('forwards adapter.params into analyze config (phase2 chunk analysis)', async () => {
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
            video: {
              targets: [
                {
                  adapter: {
                    name: 'openrouter',
                    model: 'yaml-video-model',
                    params: { temperature: 0.9, maxTokens: 222 }
                  }
                }
              ]
            }
          }
        }
      });

      is(analyzeCalls.length > 0, true);
      is(analyzeCalls[0].config.ai.video.params.temperature, 0.9);
      is(analyzeCalls[0].config.ai.video.params.maxTokens, 222);
    });

    await tNested.test('passes validator-tool loop config into the phase2 emotion lane', async () => {
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
            video: {
              targets: [ { adapter: { name: 'openrouter', model: 'yaml-video-model' } } ],
              toolLoop: {
                maxTurns: 5,
                maxValidatorCalls: 2
              }
            }
          }
        }
      });

      is(analyzeCalls.length > 0, true);
      is(analyzeCalls[0].toolLoopConfig.maxTurns, 5);
      is(analyzeCalls[0].toolLoopConfig.maxValidatorCalls, 2);
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
            video: { targets: [ { adapter: { name: 'openrouter', model: 'yaml-video-model' } } ] }
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
            video: { targets: [ { adapter: { name: 'openrouter', model: 'yaml-video-model' } } ] }
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
            video: { targets: [ { adapter: { name: 'openrouter', model: 'yaml-video-model' } } ] }
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
            video: { targets: [ { adapter: { name: 'openrouter', model: 'yaml-video-model' } } ] }
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

      const rawAiDir = path.join(testOutputDir, 'phase2-process', 'raw', 'ai');
      const { pointer, capture: rawChunk } = readLatestChunkRawCapture(rawAiDir, 0, 0);

      ok(pointer);
      is(pointer.latestAttempt, 1);

      property(rawChunk, 'chunkIndex');
      property(rawChunk, 'promptRef');

      const promptPath = path.join(testOutputDir, rawChunk.promptRef.file);
      ok(fs.existsSync(promptPath));
      const storedPrompt = JSON.parse(fs.readFileSync(promptPath, 'utf8'));
      is(typeof storedPrompt, 'string');
      ok(storedPrompt.length > 0);

      property(rawChunk, 'rawResponse');
      property(rawChunk, 'parsed');
      property(rawChunk, 'toolLoop');
      property(rawChunk, 'provider');
      property(rawChunk, 'model');
      is(rawChunk.model, 'yaml-video-model');
      is(typeof rawChunk.rawResponse, 'string');
      ok(rawChunk.rawResponse.length > 0);
      is(rawChunk.toolLoop.toolName, 'validate_emotion_analysis_json');
      is(rawChunk.toolLoop.validatorCalls, 1);

      ok(analyzeCalls.length > 0);
      is(analyzeCalls[0]?.config?.debug?.captureRaw, true);

      const chunksDir = path.join(testOutputDir, 'assets', 'processed', 'chunks');
      if (fs.existsSync(chunksDir)) {
        is(fs.readdirSync(chunksDir).length, 0);
      } else {
        ok(true);
      }
    });

    await tNested.test('captures provider debug payload when AI provider throws', async () => {
      analyzeImplementation = async (input) => {
        analyzeCalls.push(input);
        const err = new Error('provider exploded');
        err.code = 'ETIMEDOUT';
        err.debug = {
          request: {
            url: 'https://openrouter.ai/api/v1/chat/completions',
            headers: { Authorization: 'Bearer super-secret' },
            body: { model: input?.config?.ai?.video?.model }
          },
          response: { status: 500, data: { error: 'upstream failure' } }
        };
        throw err;
      };

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
            video: {
              targets: [
                { adapter: { name: 'openrouter', model: 'yaml-video-model' } }
              ],
              retry: { maxAttempts: 1, backoffMs: 0 }
            }
          },
          debug: { captureRaw: true },
          settings: { max_chunks: 1 },
          tool_variables: {
            chunk_strategy: { type: 'duration-based', config: { chunkDuration: 8 } }
          }
        }
      }), /failed after 1 attempts: provider exploded/);

      const rawChunkPath = path.join(testOutputDir, 'phase2-process', 'raw', 'ai', 'chunk-0.json');
      ok(fs.existsSync(rawChunkPath));

      const rawAiDir = path.join(testOutputDir, 'phase2-process', 'raw', 'ai');
      const { pointer, capture: rawChunk } = readLatestChunkRawCapture(rawAiDir, 0, 0);

      ok(pointer);
      is(pointer.latestAttempt, 1);

      is(rawChunk.error, 'provider exploded');
      property(rawChunk, 'errorDebug');
      property(rawChunk, 'requestMeta');
      is(rawChunk.requestMeta.model, 'yaml-video-model');
      is(rawChunk.requestMeta.chunkIndex, 0);
      is(rawChunk.requestMeta.attempt, 1);
      is(rawChunk.errorDebug.request.headers.Authorization, '[REDACTED]');
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
              video: { targets: [ { adapter: { name: 'openrouter', model: 'yaml-video-model' } } ] }
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
              video: { targets: [ { adapter: { name: 'openrouter', model: 'yaml-video-model' } } ] }
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
            video: { targets: [ { adapter: { name: 'openrouter', model: 'yaml-video-model' } } ] }
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
            completion: {
              content: JSON.stringify({
                summary: 'Analysis completed',
                emotions: {
                  patience: { score: 5, reasoning: 'Default - could not parse response' },
                  boredom: { score: 5, reasoning: 'Default - could not parse response' }
                },
                dominant_emotion: 'patience',
                confidence: 0.5
              }),
              usage: { input: 10, output: 10 }
            },
            parsed: {
              summary: 'Analysis completed',
              emotions: {
                patience: { score: 5, reasoning: 'Default - could not parse response' },
                boredom: { score: 5, reasoning: 'Default - could not parse response' }
              },
              dominant_emotion: 'patience',
              confidence: 0.5
            },
            toolLoop: {
              toolName: 'validate_emotion_analysis_json',
              turns: 2,
              validatorCalls: 1,
              history: [{ role: 'tool', kind: 'validator_acceptance' }]
            }
          };
        }

        return {
          completion: {
            content: JSON.stringify({
              summary: 'Valid chunk summary',
              emotions: {
                patience: { score: 8, reasoning: 'Solid hook' },
                boredom: { score: 2, reasoning: 'Engaging' }
              },
              dominant_emotion: 'patience',
              confidence: 0.9
            }),
            usage: { input: 100, output: 50 }
          },
          parsed: {
            summary: 'Valid chunk summary',
            emotions: {
              patience: { score: 8, reasoning: 'Solid hook' },
              boredom: { score: 2, reasoning: 'Engaging' }
            },
            dominant_emotion: 'patience',
            confidence: 0.9
          },
          toolLoop: {
            toolName: 'validate_emotion_analysis_json',
            turns: 2,
            validatorCalls: 1,
            history: [{ role: 'tool', kind: 'validator_acceptance' }]
          }
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
              targets: [
                { adapter: { name: 'openrouter', model: 'yaml-video-model' } }
              ],
              retry: {
                maxAttempts: 2,
                backoffMs: 0
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
              targets: [
                { adapter: { name: 'openrouter', model: 'yaml-video-model' } }
              ],
              retry: {
                maxAttempts: 2,
                backoffMs: 0
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

    await tNested.test('falls back to second target after retryable failures exhaust on first target', async () => {
      analyzeImplementation = async (input) => {
        analyzeCalls.push(input);

        const model = input?.config?.ai?.video?.model;
        if (model === 'primary-model') {
          const err = new Error('upstream failure');
          err.response = { status: 503, data: { error: 'service unavailable' } };
          throw err;
        }

        return {
          completion: {
            content: JSON.stringify({
              summary: 'Fallback chunk summary',
              emotions: {
                patience: { score: 8, reasoning: 'Recovered on fallback' },
                boredom: { score: 2, reasoning: 'Still engaging' }
              },
              dominant_emotion: 'patience',
              confidence: 0.9
            }),
            usage: { input: 100, output: 50 }
          },
          parsed: {
            summary: 'Fallback chunk summary',
            emotions: {
              patience: { score: 8, reasoning: 'Recovered on fallback' },
              boredom: { score: 2, reasoning: 'Still engaging' }
            },
            dominant_emotion: 'patience',
            confidence: 0.9
          },
          toolLoop: {
            toolName: 'validate_emotion_analysis_json',
            turns: 2,
            validatorCalls: 1,
            history: [{ role: 'tool', kind: 'validator_acceptance' }]
          }
        };
      };

      await videoChunksScript.run({
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
              targets: [
                { adapter: { name: 'openrouter', model: 'primary-model' } },
                { adapter: { name: 'openrouter', model: 'fallback-model' } }
              ],
              retry: {
                maxAttempts: 2,
                backoffMs: 0
              }
            }
          },
          debug: { captureRaw: true },
          tool_variables: {
            chunk_strategy: { type: 'duration-based', config: { chunkDuration: 8 } }
          },
          settings: { max_chunks: 1 }
        }
      });

      is(analyzeCalls.length, 3);
      is(analyzeCalls[0]?.config?.ai?.video?.model, 'primary-model');
      is(analyzeCalls[2]?.config?.ai?.video?.model, 'fallback-model');

      const rawAiDir = path.join(testOutputDir, 'phase2-process', 'raw', 'ai');
      const { pointer, capture: rawChunk } = readLatestChunkRawCapture(rawAiDir, 0, 0);
      is(pointer.latestAttempt, 3);
      is(rawChunk.model, 'fallback-model');
      property(rawChunk, 'failover');
      is(rawChunk.failover.from.model, 'primary-model');
      is(rawChunk.failover.to.model, 'fallback-model');
    });

    await tNested.test('hard-stops on auth error (no retry, no failover)', async () => {
      analyzeImplementation = async (input) => {
        analyzeCalls.push(input);
        const err = new Error('unauthorized');
        err.response = { status: 401, data: { error: 'invalid api key' } };
        throw err;
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
              targets: [
                { adapter: { name: 'openrouter', model: 'primary-model' } },
                { adapter: { name: 'openrouter', model: 'fallback-model' } }
              ],
              retry: {
                maxAttempts: 3,
                backoffMs: 0
              }
            }
          },
          debug: { captureRaw: true },
          tool_variables: {
            chunk_strategy: { type: 'duration-based', config: { chunkDuration: 8 } }
          },
          settings: { max_chunks: 1 }
        }
      }), /failed after 1 attempts: unauthorized/);

      is(analyzeCalls.length, 1);
    });
  });
});
