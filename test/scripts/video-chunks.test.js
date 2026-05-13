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
const promptBuildInputs = [];
let analyzeImplementation = async (input) => {
  analyzeCalls.push(input);
  return {
    completion: {
      content: JSON.stringify({
        summary: 'Test chunk summary',
        thought: 'That lands cleanly enough to keep me watching.',
        continuationThought: 'One more strong beat and I am fully in.',
        emotions: {
          patience: { score: 7, reasoning: 'Test reasoning' },
          boredom: { score: 3, reasoning: 'Test reasoning' },
          excitement: { score: 6, reasoning: 'Test reasoning' }
        },
        dominant_emotion: 'patience',
        confidence: 0.85,
        personaMeta: { scrollRisk: 'medium' }
      }),
      usage: { input: 150, output: 100 }
    },
    parsed: {
      summary: 'Test chunk summary',
      thought: 'That lands cleanly enough to keep me watching.',
      continuationThought: 'One more strong beat and I am fully in.',
      emotions: {
        patience: { score: 7, reasoning: 'Test reasoning' },
        boredom: { score: 3, reasoning: 'Test reasoning' },
        excitement: { score: 6, reasoning: 'Test reasoning' }
      },
      dominant_emotion: 'patience',
      confidence: 0.85,
      personaMeta: { scrollRisk: 'medium' }
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
  buildBasePromptFromInput: (input) => {
    promptBuildInputs.push(input);
    const lenses = input?.toolVariables?.variables?.lenses?.join(', ') || 'none';
    const musicSummary = input?.musicContext?.summary || 'none';
    const musicDetails = Array.isArray(input?.musicContext?.segments)
      ? input.musicContext.segments.map((segment) => segment.description || segment.mood || segment.type).join(' | ')
      : 'none';
    return `Prompt for ${lenses}\nMusic summary: ${musicSummary}\nMusic details: ${musicDetails}`;
  },
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

mockModule('../../../tools/emotion-lenses-tool.cjs', mockEmotionLensesTool);
mockModule('child_process', mockChildProcess);
mockModule('../../server/lib/video-chunk-extractor.cjs', mockVideoChunkExtractor);

const videoChunksScript = require('../../server/scripts/process/video-chunks.cjs');

test('Video Chunks Script', async (t) => {
  const testOutputDir = '/tmp/test-chunks-output';

  t.beforeEach(() => {
    analyzeCalls.length = 0;
    promptBuildInputs.length = 0;
    analyzeImplementation = async (input) => {
      analyzeCalls.push(input);
      return {
        completion: {
          content: JSON.stringify({
            summary: 'Test chunk summary',
            thought: 'That lands cleanly enough to keep me watching.',
            continuationThought: 'One more strong beat and I am fully in.',
            emotions: {
              patience: { score: 7, reasoning: 'Test reasoning' },
              boredom: { score: 3, reasoning: 'Test reasoning' },
              excitement: { score: 6, reasoning: 'Test reasoning' }
            },
            dominant_emotion: 'patience',
            confidence: 0.85,
            personaMeta: { scrollRisk: 'medium' }
          }),
          usage: { input: 150, output: 100 }
        },
        parsed: {
          summary: 'Test chunk summary',
          thought: 'That lands cleanly enough to keep me watching.',
          continuationThought: 'One more strong beat and I am fully in.',
          emotions: {
            patience: { score: 7, reasoning: 'Test reasoning' },
            boredom: { score: 3, reasoning: 'Test reasoning' },
            excitement: { score: 6, reasoning: 'Test reasoning' }
          },
          dominant_emotion: 'patience',
          confidence: 0.85,
          personaMeta: { scrollRisk: 'medium' }
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

    await tNested.test('includes bounded recovery addendum when re-entered by the AI recovery lane', async () => {
      await videoChunksScript.run({
        assetPath: '/path/to/test-video.mp4',
        outputDir: testOutputDir,
        toolVariables: { soulPath: 'soul.md', goalPath: 'goal.md', variables: { lenses: ['joy'] } },
        recoveryRuntime: {
          repairInstructions: ['Return only the final chunk analysis JSON.'],
          boundedContextSummary: 'Previous output used markdown instead of JSON.'
        },
        config: {
          ai: {
            video: { targets: [{ adapter: { name: 'openrouter', model: 'yaml-video-model' } }] }
          },
          tool_variables: {
            chunk_strategy: { type: 'duration-based', config: { chunkDuration: 8 } }
          }
        }
      });

      is(analyzeCalls.length > 0, true);
      ok(String(analyzeCalls[0].basePrompt).includes('AI RECOVERY RE-ENTRY:'));
      ok(String(analyzeCalls[0].basePrompt).includes('Return only the final chunk analysis JSON.'));
    });

    await tNested.test('normalizes legacy engine-relative soul/goal paths for the sibling tools repo', async () => {
      await videoChunksScript.run({
        assetPath: '/path/to/test-video.mp4',
        outputDir: testOutputDir,
        artifacts: {
          dialogueData: { dialogue_segments: [], summary: '' },
          musicData: { segments: [] }
        },
        toolVariables: {
          soulPath: 'cast/impatient-teenager/SOUL.md',
          goalPath: 'goals/video-ad-evaluation.md',
          variables: { lenses: ['patience'] }
        },
        config: {
          ai: {
            video: { targets: [{ adapter: { name: 'openrouter', model: 'yaml-video-model' } }] }
          },
          tool_variables: {
            chunk_strategy: { type: 'duration-based', config: { chunkDuration: 16 } }
          },
          settings: { max_chunks: 1 }
        }
      });

      is(analyzeCalls.length > 0, true);
      is(analyzeCalls[0].toolVariables.soulPath, '../cast/impatient-teenager/SOUL.md');
      is(analyzeCalls[0].toolVariables.goalPath, '../goals/video-ad-evaluation.md');
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

    await tNested.test('carries forward compact viewer continuity state between chunks', async () => {
      await videoChunksScript.run({
        assetPath: '/path/to/test-video.mp4',
        outputDir: testOutputDir,
        artifacts: {},
        toolVariables: {
          soulPath: '/path/to/SOUL.md',
          goalPath: '/path/to/GOAL.md',
          variables: { lenses: ['patience', 'boredom', 'excitement'] }
        },
        config: {
          ai: {
            video: { targets: [ { adapter: { name: 'openrouter', model: 'yaml-video-model' } } ] }
          },
          settings: { max_chunks: 2 },
          tool_variables: {
            chunk_strategy: { type: 'duration-based', config: { chunkDuration: 8 } }
          }
        }
      });

      is(promptBuildInputs.length, 2);
      is(promptBuildInputs[0].previousState.summary, '');
      is(promptBuildInputs[1].previousState.summary, 'Test chunk summary');
      is(promptBuildInputs[1].previousState.thought, 'That lands cleanly enough to keep me watching.');
      is(promptBuildInputs[1].previousState.continuationThought, 'One more strong beat and I am fully in.');
      is(promptBuildInputs[1].previousState.dominantEmotion, 'patience');
      is(promptBuildInputs[1].previousState.scrollRisk, 'medium');
      is(promptBuildInputs[1].previousState.chunkIndex, 0);
      is(promptBuildInputs[1].previousState.startTime, 0);
      is(promptBuildInputs[1].previousState.endTime, 8);
      is(promptBuildInputs[1].previousState.emotions.patience.score, 7);
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

    await tNested.test('extracts bounded frame metadata and passes it into the emotion lane', async () => {
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
          settings: { max_chunks: 1 },
          tool_variables: {
            chunk_strategy: { type: 'duration-based', config: { chunkDuration: 8 } }
          }
        }
      });

      is(analyzeCalls.length > 0, true);
      is(analyzeCalls[0].videoContext.chunkPath.endsWith('chunk-0.mp4'), true);
      is(analyzeCalls[0].videoContext.mimeType, 'video/mp4');
      is(analyzeCalls[0].videoContext.transferStrategy, 'base64');
      is('frames' in analyzeCalls[0].videoContext, false);
    });

    await tNested.test('passes videoContext into the validator-tool loop so the canonical video chunk can be attached', async () => {
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
          settings: { max_chunks: 1 }
        }
      });

      is(analyzeCalls.length > 0, true);
      is(analyzeCalls[0].videoContext.chunkIndex, 0);
      is(analyzeCalls[0].videoContext.chunkPath.endsWith('chunk-0.mp4'), true);
      is(analyzeCalls[0].videoContext.transferStrategy, 'base64');
    });

    await tNested.test('keeps chunk-analysis delivery grounded on the extracted chunk asset even when the shared source video ref prefers staged URLs', async () => {
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
          asset: {
            inputPath: 'examples/videos/emotion-tests/cod.mp4',
            media: {
              refs: {
                source_video: {
                  kind: 'video',
                  source: { path: 'examples/videos/emotion-tests/cod.mp4' },
                  staged: {
                    url: 'https://example.com/cod.mp4',
                    urlType: 'public'
                  },
                  delivery: {
                    preferredMode: 'url',
                    allowedModes: ['url', 'inline'],
                    allowFallback: false
                  },
                  metadata: {
                    mimeType: 'video/mp4'
                  }
                }
              }
            }
          },
          ai: {
            video: {
              inputRefs: ['source_video'],
              targets: [ { adapter: { name: 'openrouter', model: 'yaml-video-model' } } ]
            }
          },
          settings: { max_chunks: 1 }
        }
      });

      is(analyzeCalls.length > 0, true);
      is(analyzeCalls[0].videoContext.deliveryMode, 'inline');
      is(analyzeCalls[0].videoContext.transferStrategy, 'base64');
      is(analyzeCalls[0].videoContext.chunkPath.endsWith('chunk-0.mp4'), true);
      is('url' in analyzeCalls[0].videoContext, false);
    });

    await tNested.test('honors per-target inline overrides when shared media refs allow multiple modes', async () => {
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
          asset: {
            inputPath: 'examples/videos/emotion-tests/cod.mp4',
            media: {
              refs: {
                source_video: {
                  kind: 'video',
                  source: { path: 'examples/videos/emotion-tests/cod.mp4' },
                  staged: {
                    url: 'https://example.com/cod.mp4',
                    urlType: 'public'
                  },
                  delivery: {
                    preferredMode: 'url',
                    allowedModes: ['url', 'inline'],
                    allowFallback: true
                  },
                  metadata: {
                    mimeType: 'video/mp4'
                  }
                }
              }
            }
          },
          ai: {
            video: {
              inputRefs: ['source_video'],
              targets: [
                {
                  adapter: {
                    name: 'openrouter',
                    model: 'yaml-video-model',
                    media: {
                      source_video: {
                        preferredMode: 'inline',
                        allowedModes: ['inline'],
                        allowFallback: false
                      }
                    }
                  }
                }
              ]
            }
          },
          settings: { max_chunks: 1 }
        }
      });

      is(analyzeCalls.length > 0, true);
      is(analyzeCalls[0].videoContext.deliveryMode, 'inline');
      is(analyzeCalls[0].videoContext.transferStrategy, 'base64');
      is(analyzeCalls[0].videoContext.chunkPath.endsWith('chunk-0.mp4'), true);
    });

    await tNested.test('passes full global music context (not overlap-filtered chunk cues) into the emotion lane', async () => {
      await videoChunksScript.run({
        assetPath: '/path/to/test-video.mp4',
        outputDir: testOutputDir,
        artifacts: {
          musicData: {
            summary: 'Trailer-wide music stays tense and cinematic.',
            segments: [
              { start: 0, end: 8, type: 'music', description: 'Opening pulse', mood: 'tense', intensity: 6 },
              { start: 8, end: 16, type: 'music', description: 'Escalates into pounding percussion', mood: 'energetic', intensity: 9 }
            ]
          }
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
          settings: { max_chunks: 1 },
          tool_variables: {
            chunk_strategy: { type: 'duration-based', config: { chunkDuration: 8 } }
          }
        }
      });

      is(analyzeCalls.length > 0, true);
      ok(String(analyzeCalls[0].basePrompt).includes('Music summary: Trailer-wide music stays tense and cinematic.'));
      ok(String(analyzeCalls[0].basePrompt).includes('Music details: Opening pulse | Escalates into pounding percussion'));
    });

    await tNested.test('passes chunk-local music-vocals context grounded by Phase 1 timestamp windows into the emotion lane', async () => {
      await videoChunksScript.run({
        assetPath: '/path/to/test-video.mp4',
        outputDir: testOutputDir,
        artifacts: {
          musicVocalsData: {
            summary: 'Lyric-bearing cues recur in a chant pattern.',
            vocal_segments: [
              { index: 0, performer: 'Vocal Lead', text: 'Obey your master' },
              { index: 1, performer: 'Vocal Lead', text: 'Master, master' },
              { index: 2, performer: 'Vocal Lead', text: 'Nothing else matters' }
            ]
          },
          musicVocalsTimestampsData: {
            vocal_segments: [
              { index: 0, performer: 'Vocal Lead', text: 'Obey your master', start: 0.2, end: 1.0 },
              { index: 1, performer: 'Vocal Lead', text: 'Master, master', start: 7.2, end: 7.9 },
              { index: 2, performer: 'Vocal Lead', text: 'Nothing else matters', start: 8.4, end: 9.2 }
            ]
          }
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
          settings: { max_chunks: 1 },
          tool_variables: {
            chunk_strategy: { type: 'duration-based', config: { chunkDuration: 8 } }
          }
        }
      });

      is(promptBuildInputs.length > 0, true);
      is(promptBuildInputs[0].musicVocalsContext.summary, '');
      is(Array.isArray(promptBuildInputs[0].musicVocalsContext.segments), true);
      is(promptBuildInputs[0].musicVocalsContext.segments.length, 2);
      is(promptBuildInputs[0].musicVocalsContext.segments[0].text, 'Obey your master');
      is(promptBuildInputs[0].musicVocalsContext.segments[1].text, 'Master, master');
      is(promptBuildInputs[0].musicVocalsContext.grounding.strategy, 'phase1_timestamp_overlap');
      is(promptBuildInputs[0].musicVocalsContext.grounding.scope, 'chunk_window');
    });

    await tNested.test('surfaces a dialogue-assisted music-vocals anchor in the 80s chunk without pulling dialogue text into the vocals lane', () => {
      const musicVocalsContext = videoChunksScript.__test.buildChunkMusicVocalsContext({
        sourceMusicVocalsData: {
          vocal_segments: [
            { index: 5, performer: 'Vocal Lead', text: 'Master! Master!' },
            { index: 6, performer: 'Vocal Lead', text: 'Twisting your mind and smashing your dreams' },
            { index: 7, performer: 'Vocal Lead', text: 'Obey your master!' }
          ]
        },
        timestampMusicVocalsData: {
          vocal_segments: [
            { index: 5, performer: 'Vocal Lead', text: 'Master! Master!', start: 89.8, end: 91.68, timing: { status: 'partial', method: 'lyric_alignment', provenance: 'segment_level' } },
            {
              index: 6,
              performer: 'Vocal Lead',
              text: 'Twisting your mind and smashing your dreams',
              start: 80.5,
              end: 82.5,
              timing: {
                status: 'aligned',
                confidence: 1,
                method: 'dialogue_assisted_anchor',
                provenance: 'dialogue_text_match',
                support: {
                  lane: 'dialogue',
                  segmentIndex: 14,
                  text: 'Twisting your mind and smashing your dreams.'
                }
              }
            },
            { index: 7, performer: 'Vocal Lead', text: 'Obey your master!', timing: { status: 'unresolved', method: 'lyric_alignment', provenance: 'segment_level' } }
          ]
        },
        startTime: 80,
        endTime: 85
      });

      is(musicVocalsContext.grounding.strategy, 'phase1_timestamp_overlap');
      is(musicVocalsContext.grounding.scope, 'chunk_window');
      is(musicVocalsContext.segments.length, 1);
      is(musicVocalsContext.segments[0].text, 'Twisting your mind and smashing your dreams');
      is(musicVocalsContext.segments[0].timing.method, 'dialogue_assisted_anchor');
      is(musicVocalsContext.segments[0].timing.support.lane, 'dialogue');
    });

    await tNested.test('uses one canonical lane artifact (reconciled preferred over raw/final) for chunk prompt context', async () => {
      await videoChunksScript.run({
        assetPath: '/path/to/test-video.mp4',
        outputDir: testOutputDir,
        artifacts: {
          musicDataReconciled: {
            summary: 'RECONCILED summary',
            segments: [{ description: 'RECONCILED segment' }]
          },
          musicData: {
            summary: 'RAW summary',
            segments: [{ description: 'RAW segment' }]
          },
          musicDataFinal: {
            summary: 'FINAL summary',
            segments: [{ description: 'FINAL segment' }]
          }
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
          settings: { max_chunks: 1 },
          tool_variables: {
            chunk_strategy: { type: 'duration-based', config: { chunkDuration: 8 } }
          }
        }
      });

      is(promptBuildInputs.length > 0, true);
      is(promptBuildInputs[0].musicContext.summary, 'RECONCILED summary');
      is(promptBuildInputs[0].musicContext.segments.length, 1);
      is(promptBuildInputs[0].musicContext.segments[0].description, 'RECONCILED segment');
    });

    await tNested.test('falls back to lane final artifact timing when reconciled/raw are unavailable', async () => {
      await videoChunksScript.run({
        assetPath: '/path/to/test-video.mp4',
        outputDir: testOutputDir,
        artifacts: {
          musicVocalsDataFinal: {
            summary: 'FINAL vocals summary',
            vocal_segments: [{ index: 0, performer: 'Vocal Lead', text: 'FINAL vocal segment', start: 0.5, end: 1.5 }]
          }
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
          settings: { max_chunks: 1 },
          tool_variables: {
            chunk_strategy: { type: 'duration-based', config: { chunkDuration: 8 } }
          }
        }
      });

      is(promptBuildInputs.length > 0, true);
      is(promptBuildInputs[0].musicVocalsContext.summary, '');
      is(promptBuildInputs[0].musicVocalsContext.segments.length, 1);
      is(promptBuildInputs[0].musicVocalsContext.segments[0].text, 'FINAL vocal segment');
      is(promptBuildInputs[0].musicVocalsContext.grounding.strategy, 'source_segment_timing_overlap_fallback');
      is(promptBuildInputs[0].musicVocalsContext.grounding.fallbackReason, 'timestamp_artifact_missing');
    });

    await tNested.test('passes chunk-local dialogue context grounded by Phase 1 timestamp windows into the emotion lane', async () => {
      await videoChunksScript.run({
        assetPath: '/path/to/test-video.mp4',
        outputDir: testOutputDir,
        artifacts: {
          dialogueData: {
            dialogue_segments: [
              { index: 0, speaker: 'Speaker 1', speaker_id: 'spk_001', text: 'Hello there' },
              { index: 1, speaker: 'Speaker 1', speaker_id: 'spk_001', text: 'General Kenobi' },
              { index: 2, speaker: 'Speaker 2', speaker_id: 'spk_002', text: 'You are a bold one' }
            ],
            speaker_profiles: [
              {
                speaker_id: 'spk_001',
                label: 'Speaker 1',
                grounded: {
                  confidence: 0.81,
                  linked_segment_indexes: [0, 1],
                  acoustic_descriptors: [{ label: 'measured delivery', confidence: 0.58 }]
                },
                inferred_traits: {
                  traits: []
                }
              },
              {
                speaker_id: 'spk_002',
                label: 'Speaker 2',
                grounded: {
                  confidence: 0.74,
                  linked_segment_indexes: [2],
                  acoustic_descriptors: [{ label: 'sharp response', confidence: 0.55 }]
                },
                inferred_traits: {
                  traits: []
                }
              }
            ],
            summary: 'Dialogue summary'
          },
          dialogueTimestampsData: {
            dialogue_segments: [
              { index: 0, speaker: 'Speaker 1', speaker_id: 'spk_001', text: 'Hello there', start: 0.4, end: 1.1 },
              { index: 1, speaker: 'Speaker 1', speaker_id: 'spk_001', text: 'General Kenobi' },
              { index: 2, speaker: 'Speaker 2', speaker_id: 'spk_002', text: 'You are a bold one', start: 6.3, end: 7.4 }
            ]
          }
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
          settings: { max_chunks: 1 },
          tool_variables: {
            chunk_strategy: { type: 'duration-based', config: { chunkDuration: 8 } }
          }
        }
      });

      is(promptBuildInputs.length > 0, true);
      is(Array.isArray(promptBuildInputs[0].dialogueContext.segments), true);
      is(promptBuildInputs[0].dialogueContext.segments.length, 2);
      is(promptBuildInputs[0].dialogueContext.segments[0].text, 'Hello there');
      is(promptBuildInputs[0].dialogueContext.segments[1].text, 'You are a bold one');
      is(promptBuildInputs[0].dialogueContext.grounding.strategy, 'phase1_timestamp_overlap');
      is(promptBuildInputs[0].dialogueContext.grounding.usedBoundedIndexFallback, true);
      is(Array.isArray(promptBuildInputs[0].dialogueContext.speakers), true);
      is(promptBuildInputs[0].dialogueContext.speakers.length, 2);
      is(promptBuildInputs[0].dialogueContext.speakers[0].speaker_id, 'spk_001');
      is(promptBuildInputs[0].dialogueContext.speakers[1].speaker_id, 'spk_002');
    });

    await tNested.test('filters unresolved bounded timestamp dialogue placeholders before prompt assembly', () => {
      const dialogueContext = videoChunksScript.__test.buildChunkDialogueContext({
        sourceDialogueData: {
          dialogue_segments: [
            { index: 5, speaker: 'Speaker 3', speaker_id: 'spk_003', text: 'Menendez is a terrorist.' },
            { index: 6, speaker: 'Speaker 3', speaker_id: 'spk_003', text: "We're bringing peace and security to the world." },
            { index: 7, speaker: 'Speaker 3', speaker_id: 'spk_003', text: 'You think I am evil.' }
          ],
          speaker_profiles: [
            { speaker_id: 'spk_003', label: 'Speaker 3', grounded: { linked_segment_indexes: [5, 6, 7] } }
          ]
        },
        timestampDialogueData: {
          dialogue_segments: [
            { index: 5, speaker: 'Speaker 3', speaker_id: 'spk_003', text: 'Menendez is a terrorist.', start: 23.22, end: 27.02 },
            {
              index: 6,
              speaker: 'Speaker 3',
              speaker_id: 'spk_003',
              text: "We're bringing peace and security to the world.",
              timing: { status: 'unresolved' }
            },
            { index: 7, speaker: 'Speaker 3', speaker_id: 'spk_003', text: 'You think I am evil.', start: 27.88, end: 29.88 }
          ]
        },
        startTime: 25,
        endTime: 30
      });

      is(dialogueContext.grounding.strategy, 'phase1_timestamp_overlap');
      is(dialogueContext.grounding.usedBoundedIndexFallback, true);
      is(dialogueContext.segments.length, 2);
      is(dialogueContext.segments[0].index, 5);
      is(dialogueContext.segments[1].index, 7);
      is(dialogueContext.speakers.length, 1);
      is(dialogueContext.speakers[0].speaker_id, 'spk_003');
    });

    await tNested.test('falls back to source-timed dialogue overlap when timestamp artifacts are missing', async () => {
      await videoChunksScript.run({
        assetPath: '/path/to/test-video.mp4',
        outputDir: testOutputDir,
        artifacts: {
          dialogueData: {
            dialogue_segments: [
              { index: 0, speaker: 'Speaker 1', speaker_id: 'spk_001', text: 'Hello there', start: 0.3, end: 1.1 },
              { index: 1, speaker: 'Speaker 2', speaker_id: 'spk_002', text: 'Ignored later line', start: 9.0, end: 10.0 }
            ],
            speaker_profiles: [
              { speaker_id: 'spk_001', label: 'Speaker 1', grounded: { linked_segment_indexes: [0] } },
              { speaker_id: 'spk_002', label: 'Speaker 2', grounded: { linked_segment_indexes: [1] } }
            ]
          }
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
          settings: { max_chunks: 1 },
          tool_variables: {
            chunk_strategy: { type: 'duration-based', config: { chunkDuration: 8 } }
          }
        }
      });

      is(promptBuildInputs.length > 0, true);
      is(promptBuildInputs[0].dialogueContext.segments.length, 1);
      is(promptBuildInputs[0].dialogueContext.segments[0].text, 'Hello there');
      is(promptBuildInputs[0].dialogueContext.grounding.strategy, 'source_segment_timing_overlap_fallback');
      is(promptBuildInputs[0].dialogueContext.grounding.fallbackReason, 'timestamp_artifact_missing');
      is(promptBuildInputs[0].dialogueContext.speakers.length, 1);
      is(promptBuildInputs[0].dialogueContext.speakers[0].speaker_id, 'spk_001');
    });

    await tNested.test('falls back honestly to empty chunk-local dialogue context when timestamp coverage is missing for the window', async () => {
      await videoChunksScript.run({
        assetPath: '/path/to/test-video.mp4',
        outputDir: testOutputDir,
        artifacts: {
          dialogueData: {
            dialogue_segments: [
              { index: 0, speaker: 'Speaker 1', speaker_id: 'spk_001', text: 'Hello there' }
            ],
            speaker_profiles: [
              {
                speaker_id: 'spk_001',
                label: 'Speaker 1',
                grounded: {
                  confidence: 0.81,
                  linked_segment_indexes: [0]
                }
              }
            ]
          },
          dialogueTimestampsData: {
            dialogue_segments: [
              { index: 0, speaker: 'Speaker 1', speaker_id: 'spk_001', text: 'Hello there', start: 10.2, end: 11.0 }
            ]
          }
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
          settings: { max_chunks: 1 },
          tool_variables: {
            chunk_strategy: { type: 'duration-based', config: { chunkDuration: 8 } }
          }
        }
      });

      is(promptBuildInputs.length > 0, true);
      is(promptBuildInputs[0].dialogueContext.segments.length, 0);
      is(promptBuildInputs[0].dialogueContext.speakers.length, 0);
      is(promptBuildInputs[0].dialogueContext.grounding.strategy, 'empty');
      is(promptBuildInputs[0].dialogueContext.grounding.fallbackReason, 'timestamp_artifact_present_but_no_overlapping_timed_dialogue');
    });

    await tNested.test('skips a final provider-facing video chunk shorter than 1 second', async () => {
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
          settings: { max_chunks: 2 },
          tool_variables: {
            chunk_strategy: { type: 'duration-based', config: { chunkDuration: 15.5 } }
          }
        }
      });

      is(analyzeCalls.length, 1);
      is(result.artifacts.chunkAnalysis.chunks.length, 1);
      is(result.artifacts.chunkAnalysis.statusSummary.total, 1);
      is(result.artifacts.chunkAnalysis.chunks[0].chunkIndex, 0);
    });

    await tNested.test('keeps a final provider-facing video chunk that is exactly 1 second long', async () => {
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
          settings: { max_chunks: 2 },
          tool_variables: {
            chunk_strategy: { type: 'duration-based', config: { chunkDuration: 15 } }
          }
        }
      });

      is(analyzeCalls.length, 2);
      is(result.artifacts.chunkAnalysis.chunks.length, 2);
      is(result.artifacts.chunkAnalysis.statusSummary.total, 2);
      is(result.artifacts.chunkAnalysis.chunks[1].chunkIndex, 1);
    });


    await tNested.test('reports chunkDuration from the active chunk strategy instead of stale settings metadata', async () => {
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
          settings: {
            max_chunks: 1,
            chunk_duration: 8
          },
          tool_variables: {
            chunk_strategy: { type: 'duration-based', config: { chunkDuration: 5 } }
          }
        }
      });

      is(result.artifacts.chunkAnalysis.persona.config.chunkDuration, 5);
    });

    await tNested.test('uses canonical chunk split settings and flat maxFileSize when splitting oversized chunks', async () => {
      const splitCalls = [];
      const localAnalyzeCalls = [];
      const originalCacheEntries = {};
      const modulePaths = [
        '../../../tools/emotion-lenses-tool.cjs',
        'child_process',
        '../../server/lib/video-chunk-extractor.cjs',
        '../../server/lib/split-strategy.cjs',
        '../../server/scripts/process/video-chunks.cjs'
      ].map((modulePath) => require.resolve(modulePath, { paths: [__dirname] }));

      for (const absolutePath of modulePaths) {
        originalCacheEntries[absolutePath] = require.cache[absolutePath];
        delete require.cache[absolutePath];
      }

      const localMockEmotionLensesTool = {
        buildBasePromptFromInput: () => 'Prompt',
        executeEmotionAnalysisToolLoop: async (input) => {
          localAnalyzeCalls.push(input);
          return {
            completion: {
              content: JSON.stringify({
                summary: 'Split chunk summary',
                thought: 'That cut finally gives me something to react to.',
                emotions: { patience: { score: 7, reasoning: 'Visible evidence' } },
                dominant_emotion: 'patience',
                confidence: 0.8
              }),
              usage: { input: 10, output: 5 }
            },
            parsed: {
              summary: 'Split chunk summary',
              thought: 'That cut finally gives me something to react to.',
              emotions: { patience: { score: 7, reasoning: 'Visible evidence' } },
              dominant_emotion: 'patience',
              confidence: 0.8
            },
            toolLoop: { toolName: 'validate_emotion_analysis_json', turns: 1, validatorCalls: 1, history: [] }
          };
        }
      };

      const localMockChildProcess = {
        exec: (cmd, callback) => {
          if (cmd.includes('ffprobe')) {
            callback?.(null, { stdout: '4.0', stderr: '' });
          } else {
            callback?.(null, { stdout: '', stderr: '' });
          }
          return { on: () => {} };
        },
        execSync: () => Buffer.from('4.0')
      };

      const localMockVideoChunkExtractor = {
        extractVideoChunk: async (assetPath, startTime, endTime, chunksDir, chunkIndex) => {
          const chunkPath = path.join(chunksDir, `chunk-${chunkIndex}.mp4`);
          fs.mkdirSync(chunksDir, { recursive: true });
          fs.writeFileSync(chunkPath, 'X'.repeat(64));
          return { success: true, chunkPath };
        }
      };

      const localMockSplitStrategy = {
        splitChunk: (chunkPath, maxFileSize, maxSplits, splitFactor) => {
          splitCalls.push({ chunkPath, maxFileSize, maxSplits, splitFactor });
          const splitPath = `${chunkPath}.part0.mp4`;
          fs.writeFileSync(splitPath, 'split chunk');
          return [splitPath];
        }
      };

      mockModule('../../../tools/emotion-lenses-tool.cjs', localMockEmotionLensesTool);
      mockModule('child_process', localMockChildProcess);
      mockModule('../../server/lib/video-chunk-extractor.cjs', localMockVideoChunkExtractor);
      mockModule('../../server/lib/split-strategy.cjs', localMockSplitStrategy);

      const isolatedVideoChunksScript = require('../../server/scripts/process/video-chunks.cjs');

      try {
        await isolatedVideoChunksScript.run({
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
            settings: { max_chunks: 1 },
            tool_variables: {
              maxFileSize: 16,
              chunk_strategy: {
                type: 'duration-based',
                config: { chunkDuration: 8 },
                split: {
                  enabled: true,
                  max_splits: 3,
                  split_factor: 2
                }
              }
            }
          }
        });
      } finally {
        for (const absolutePath of modulePaths) {
          delete require.cache[absolutePath];
        }
        for (const [absolutePath, entry] of Object.entries(originalCacheEntries)) {
          if (entry) require.cache[absolutePath] = entry;
        }
      }

      is(splitCalls.length, 1);
      is(splitCalls[0].maxFileSize, 16);
      is(splitCalls[0].maxSplits, 3);
      is(splitCalls[0].splitFactor, 0.5);
      is(localAnalyzeCalls.length, 1);
      is(localAnalyzeCalls[0].videoContext.duration, 4);
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

  t.test('provider credential requirement by DIGITAL_TWIN_MODE', async (tNested) => {
    await tNested.test('requires provider credentials when DIGITAL_TWIN_MODE is off', async () => {
      const originalAiApiKey = process.env.AI_API_KEY;
      const originalOpenrouterApiKey = process.env.OPENROUTER_API_KEY;

      delete process.env.AI_API_KEY;
      delete process.env.OPENROUTER_API_KEY;
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
        }), /VideoChunks: missing provider credentials for domain "video".*openrouter: OPENROUTER_API_KEY or AI_API_KEY/);
      } finally {
        if (originalAiApiKey === undefined) delete process.env.AI_API_KEY;
        else process.env.AI_API_KEY = originalAiApiKey;

        if (originalOpenrouterApiKey === undefined) delete process.env.OPENROUTER_API_KEY;
        else process.env.OPENROUTER_API_KEY = originalOpenrouterApiKey;

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
              thought: 'Okay, that hook actually works.',
              continuationThought: 'If it keeps escalating like this, I am not bailing.',
              emotions: {
                patience: { score: 8, reasoning: 'Solid hook' },
                boredom: { score: 2, reasoning: 'Engaging' }
              },
              dominant_emotion: 'patience',
              confidence: 0.9,
              personaMeta: { scrollRisk: 'low' }
            }),
            usage: { input: 100, output: 50 }
          },
          parsed: {
            summary: 'Valid chunk summary',
            thought: 'Okay, that hook actually works.',
            continuationThought: 'If it keeps escalating like this, I am not bailing.',
            emotions: {
              patience: { score: 8, reasoning: 'Solid hook' },
              boredom: { score: 2, reasoning: 'Engaging' }
            },
            dominant_emotion: 'patience',
            confidence: 0.9,
            personaMeta: { scrollRisk: 'low' }
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
      is(result.artifacts.chunkAnalysis.chunks[0].thought, 'Okay, that hook actually works.');
      is(result.artifacts.chunkAnalysis.chunks[0].continuationThought, 'If it keeps escalating like this, I am not bailing.');
      is(result.artifacts.chunkAnalysis.chunks[0].personaMeta.scrollRisk, 'low');
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
              thought: 'Fallback path saved this beat.',
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
            thought: 'Fallback path saved this beat.',
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
