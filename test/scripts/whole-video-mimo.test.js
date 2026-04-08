const fs = require('fs');
const os = require('os');
const path = require('path');
const test = require('node:test');
const assert = require('node:assert/strict');

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

const providerCalls = [];

mockModule('../../server/lib/ai-targets.cjs', {
  executeWithTargets: async ({ config, domain, operation, onAttempt }) => {
    const ctx = {
      domain,
      target: config.ai.video.targets[0],
      targetIndex: 0,
      targetCount: 1,
      attempt: 1,
      attemptInTarget: 1,
      configForTarget: config,
      failover: null
    };

    const result = await operation(ctx);
    if (typeof onAttempt === 'function') {
      await onAttempt({
        ok: true,
        attempt: 1,
        attemptInTarget: 1,
        target: ctx.target,
        targetIndex: 0,
        targetCount: 1,
        configForTarget: config,
        result,
        error: null
      });
    }

    return { result, meta: { attempt: 1, target: ctx.target, targetIndex: 0 } };
  },
  createRetryableError: (message, extra = {}) => {
    const error = new Error(message);
    error.aiTargets = { classification: 'retryable', ...extra };
    return error;
  },
  getProviderForTarget: () => ({
    complete: async ({ prompt, attachments, options, model, apiKey, baseUrl }) => {
      providerCalls.push({ prompt, attachments, options, model, apiKey, baseUrl });
      return {
        content: JSON.stringify({
          wholeVideoScores: {
            patience: { score: 6, reasoning: 'The opening tests patience before the middle recovers momentum.' },
            boredom: { score: 4, reasoning: 'The action-heavy middle limits boredom.' },
            excitement: { score: 8, reasoning: 'The strongest visuals cluster in the middle and lift energy.' }
          },
          wholeVideoCategories: {
            hookEffectiveness: { score: 4, reasoning: 'The hook is clear but not urgent enough.' },
            valueClarity: { score: 7, reasoning: 'The ad promise becomes clear quickly once the action starts.' },
            dialogueAuthenticity: { score: 6, reasoning: 'The spoken lines mostly support the premise.' },
            musicEnergyAlignment: { score: 8, reasoning: 'The score reinforces the strongest action beats.' },
            visualMomentum: { score: 8, reasoning: 'The middle sustains the best visual energy.' },
            ctaPackaging: { score: 3, reasoning: 'The ending asks for too much attention after the payoff.' },
            trust: { score: 6, reasoning: 'The core promise is believable, but the packaging feels slightly heavy.' }
          },
          overallSummary: 'The middle of the spot carries the strongest energy, but the opening and CTA still reduce completion confidence.',
          retentionVerdict: {
            wouldComplete: 'maybe',
            confidence: 0.8,
            reasoning: 'The stronger middle beats recover attention after a soft start.'
          },
          evidenceMoments: [
            {
              timestamp: 0,
              timeRange: { start: 0, end: 3 },
              type: 'friction',
              driver: 'cross_modal',
              category: 'hookEffectiveness',
              impact: 'high',
              summary: 'The opening frames do not immediately earn commitment.'
            },
            {
              timestamp: 42,
              timeRange: { start: 40, end: 48 },
              type: 'positive',
              driver: 'visual',
              category: 'visualMomentum',
              impact: 'high',
              summary: 'The action-heavy middle sequence provides the clearest excitement spike.'
            }
          ],
          strongestMoments: ['The action-heavy middle sequence provides the strongest payoff.'],
          biggestRisks: ['The CTA packaging feels dense relative to the payoff.'],
          recommendationSeeds: ['Rebuild the opening around the strongest reveal.']
        }),
        usage: { input: 900, output: 450 }
      };
    }
  }),
  getPersistedErrorInfo: () => ({ status: null, requestId: null, classification: null, response: null }),
  buildProviderOptions: ({ adapter, defaults = {} }) => ({ ...defaults, ...(adapter?.params || {}) })
});

const wholeVideoMiMo = require('../../server/scripts/process/whole-video-mimo.cjs');

test('whole-video-mimo script', async (t) => {
  let tempDir;
  let outputDir;
  let videoPath;
  let soulPath;
  let goalPath;

  t.beforeEach(() => {
    providerCalls.length = 0;
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ee-whole-video-mimo-'));
    outputDir = path.join(tempDir, 'output');
    videoPath = path.join(tempDir, 'fixture.mp4');
    soulPath = path.join(tempDir, 'SOUL.md');
    goalPath = path.join(tempDir, 'GOAL.md');

    fs.writeFileSync(videoPath, 'fixture-video-payload');
    fs.writeFileSync(soulPath, '# Persona\n\n## Identity\nImpatient but honest viewer.\n');
    fs.writeFileSync(goalPath, '# Goal\n\n## Primary Objective\nJudge whether the full ad would hold attention.\n');
  });

  t.afterEach(() => {
    if (tempDir && fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  await t.test('writes whole-video-analysis.json using the staged URL side path', async () => {
    const result = await wholeVideoMiMo.run({
      assetPath: videoPath,
      outputDir,
      artifacts: {
        dialogueData: {
          summary: 'Two short spoken beats explain the setup and payoff.',
          dialogue_segments: [
            { start: 2, end: 5, speaker: 'Narrator', text: 'Here is the setup.' },
            { start: 54, end: 58, speaker: 'Narrator', text: 'Here is the payoff.' }
          ]
        },
        musicData: {
          summary: 'The score ramps up into the middle action beat and softens at the end.',
          segments: [
            { start: 0, end: 12, description: 'Measured opening pulse' },
            { start: 40, end: 52, description: 'High-energy action swell' }
          ]
        },
        musicVocalsData: {
          summary: 'A short repeated vocal hook carries through the midpoint.',
          vocal_segments: [
            { index: 0, performer: 'Vocal Lead', text: 'Rise up now' },
            { index: 1, performer: 'Vocal Lead', text: 'Rise up now' }
          ]
        },
        visualIdentityData: {
          summary: 'The ad repeats a bright energy motif from the opener through the midpoint and then slows on the end slate.',
          identityRegistry: {
            characters: ['Hero runner'],
            locations: ['Training floor'],
            objects: ['Energy product'],
            motifs: ['Bright energy streak']
          },
          timeline: [
            { start: 0, end: 4, visualSummary: 'Immediate reveal of the product and lead performer.' },
            { start: 40, end: 48, visualSummary: 'Midpoint payoff expands the motion motif.' }
          ],
          visualBeats: {
            hookMoments: [
              { start: 0, end: 3, label: 'Immediate reveal', summary: 'The opener lands quickly.' }
            ],
            noveltyPeaks: [
              { start: 40, end: 48, label: 'Motion payoff', summary: 'The midpoint is the most visually energizing.' }
            ],
            fatigueRisks: [
              { start: 54, end: 60, label: 'Dense end slate', summary: 'The CTA feels visually heavy after the payoff.' }
            ]
          }
        }
      },
      toolVariables: {
        soulPath,
        goalPath,
        variables: {
          lenses: ['patience', 'boredom', 'excitement']
        }
      },
      config: {
        asset: {
          media: {
            refs: {
              source_video: {
                kind: 'video',
                role: 'primary',
                source: { path: videoPath },
                staged: {
                  url: 'https://gambit-games-tests.s3.us-east-1.amazonaws.com/peanut-gallery/cod.mp4',
                  urlType: 'public'
                },
                delivery: {
                  preferredMode: 'url',
                  allowedModes: ['url', 'inline'],
                  allowFallback: false
                },
                metadata: {
                  filename: 'cod.mp4',
                  mimeType: 'video/mp4',
                  durationSeconds: 140.017
                }
              }
            }
          }
        },
        ai: {
          video: {
            targets: [
              {
                adapter: {
                  name: 'openrouter',
                  model: 'xiaomi/mimo-v2-omni',
                  params: {
                    maxTokens: 12000,
                    temperature: 0.2
                  }
                }
              }
            ]
          }
        }
      }
    });

    const artifactPath = path.join(outputDir, 'phase2-process', 'whole-video-analysis.json');
    const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));

    assert.equal(result.artifacts.wholeVideoAnalysis.provider.adapter, 'openrouter');
    assert.equal(result.artifacts.wholeVideoAnalysis.provider.transport, 'public_url');
    assert.equal(result.artifacts.wholeVideoAnalysis.input.videoUrl, 'https://gambit-games-tests.s3.us-east-1.amazonaws.com/peanut-gallery/cod.mp4');
    assert.equal(result.artifacts.wholeVideoAnalysis.wholeVideoScores.excitement.score, 8);
    assert.equal(artifact.schemaVersion, 'ee.phase2.whole-video/v1');
    assert.equal(artifact.provider.transport, 'public_url');
    assert.equal(artifact.input.durationSeconds, 140.017);
    assert.ok(Array.isArray(artifact.evidenceMoments));
    assert.equal(fs.existsSync(path.join(outputDir, 'phase2-process', 'chunk-analysis.json')), false);

    assert.equal(providerCalls.length, 1);
    assert.equal(providerCalls[0].attachments[0].url, 'https://gambit-games-tests.s3.us-east-1.amazonaws.com/peanut-gallery/cod.mp4');
    assert.equal(providerCalls[0].apiKey, process.env.OPENROUTER_API_KEY || 'test-api-key');
    assert.match(providerCalls[0].prompt, /FULL video as a single multimodal experience/);
    assert.match(providerCalls[0].prompt, /Use the Phase 1 lane artifacts below as optional supporting context only/);
    assert.match(providerCalls[0].prompt, /GLOBAL PHASE 1 CONTEXT/);
    assert.match(providerCalls[0].prompt, /DIALOGUE CONTEXT/);
    assert.match(providerCalls[0].prompt, /MUSIC CONTEXT/);
    assert.match(providerCalls[0].prompt, /MUSIC VOCALS CONTEXT/);
    assert.match(providerCalls[0].prompt, /VISUAL IDENTITY CONTEXT/);
  });

  await t.test('injects one canonical lane dataset per section (reconciled preferred, raw/final fallback)', async () => {
    await wholeVideoMiMo.run({
      assetPath: videoPath,
      outputDir,
      artifacts: {
        dialogueDataReconciled: {
          summary: 'RECONCILED dialogue summary',
          dialogue_segments: [{ index: 0, speaker: 'Recon', text: 'reconciled line' }]
        },
        dialogueData: {
          summary: 'RAW dialogue summary',
          dialogue_segments: [{ index: 0, speaker: 'Raw', text: 'raw line' }]
        },
        dialogueDataFinal: {
          summary: 'FINAL dialogue summary',
          dialogue_segments: [{ index: 0, speaker: 'Final', text: 'final line' }]
        },
        musicDataFinal: {
          summary: 'FINAL music summary',
          segments: [{ index: 0, description: 'final music cue' }]
        },
        musicVocalsDataFinal: {
          summary: 'FINAL vocals summary',
          vocal_segments: [{ index: 0, performer: 'Vocal Lead', text: 'final vocals line' }]
        }
      },
      toolVariables: {
        soulPath,
        goalPath,
        variables: {
          lenses: ['patience', 'boredom', 'excitement']
        }
      },
      config: {
        asset: {
          media: {
            refs: {
              source_video: {
                kind: 'video',
                role: 'primary',
                source: { path: videoPath },
                staged: {
                  url: 'https://gambit-games-tests.s3.us-east-1.amazonaws.com/peanut-gallery/cod.mp4',
                  urlType: 'public'
                },
                delivery: {
                  preferredMode: 'url',
                  allowedModes: ['url', 'inline'],
                  allowFallback: false
                },
                metadata: {
                  filename: 'cod.mp4',
                  mimeType: 'video/mp4',
                  durationSeconds: 140.017
                }
              }
            }
          }
        },
        ai: {
          video: {
            targets: [
              {
                adapter: {
                  name: 'openrouter',
                  model: 'xiaomi/mimo-v2-omni'
                }
              }
            ]
          }
        }
      }
    });

    assert.equal(providerCalls.length, 1);
    const prompt = providerCalls[0].prompt;
    assert.match(prompt, /RECONCILED dialogue summary/);
    assert.doesNotMatch(prompt, /RAW dialogue summary/);
    assert.doesNotMatch(prompt, /FINAL dialogue summary/);
    assert.match(prompt, /FINAL music summary/);
    assert.match(prompt, /FINAL vocals summary/);
  });

  await t.test('accepts provider-specific Xiaomi auth envs for direct Xiaomi targets', async () => {
    const originalAiApiKey = process.env.AI_API_KEY;
    const originalXiaomiApiKey = process.env.XIAOMI_API_KEY;
    const originalXiaomiBaseUrl = process.env.XIAOMI_BASE_URL;

    delete process.env.AI_API_KEY;
    process.env.XIAOMI_API_KEY = 'xiaomi-test-key';
    process.env.XIAOMI_BASE_URL = 'https://api.xiaomi.example/v1';

    try {
      await wholeVideoMiMo.run({
        assetPath: videoPath,
        outputDir,
        artifacts: {},
        toolVariables: {
          soulPath,
          goalPath,
          variables: {
            lenses: ['patience', 'boredom', 'excitement']
          }
        },
        config: {
          asset: {
            media: {
              refs: {
                source_video: {
                  kind: 'video',
                  role: 'primary',
                  source: { path: videoPath },
                  staged: {
                    url: 'https://gambit-games-tests.s3.us-east-1.amazonaws.com/peanut-gallery/cod.mp4',
                    urlType: 'public'
                  },
                  delivery: {
                    preferredMode: 'url',
                    allowedModes: ['url', 'inline'],
                    allowFallback: false
                  },
                  metadata: {
                    filename: 'cod.mp4',
                    mimeType: 'video/mp4',
                    durationSeconds: 140.017
                  }
                }
              }
            }
          },
          ai: {
            video: {
              targets: [
                {
                  adapter: {
                    name: 'xiaomi',
                    model: 'mimo-v2-omni',
                    params: {
                      maxTokens: 12000,
                      temperature: 0.2
                    }
                  }
                }
              ]
            }
          }
        }
      });

      assert.equal(providerCalls.length, 1);
      assert.equal(providerCalls[0].apiKey, 'xiaomi-test-key');
      assert.equal(providerCalls[0].baseUrl, 'https://api.xiaomi.example/v1');
    } finally {
      if (originalAiApiKey === undefined) delete process.env.AI_API_KEY;
      else process.env.AI_API_KEY = originalAiApiKey;

      if (originalXiaomiApiKey === undefined) delete process.env.XIAOMI_API_KEY;
      else process.env.XIAOMI_API_KEY = originalXiaomiApiKey;

      if (originalXiaomiBaseUrl === undefined) delete process.env.XIAOMI_BASE_URL;
      else process.env.XIAOMI_BASE_URL = originalXiaomiBaseUrl;
    }
  });
});
