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
    const target = config.ai[domain].targets[0];
    const ctx = {
      domain,
      target,
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
        target,
        targetIndex: 0,
        targetCount: 1,
        configForTarget: config,
        result,
        error: null
      });
    }

    return { result, meta: { attempt: 1, target, targetIndex: 0 } };
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
          analysisMode: 'whole_asset',
          timingMode: 'full_timeline',
          summary: 'The ad opens with an immediate product reveal, repeats a bold blue motif, and loses momentum slightly on the final CTA slate.',
          timeline: [
            {
              start: 0,
              end: 4,
              kind: 'scene',
              visualSummary: 'A bold product reveal lands immediately against a high-contrast backdrop.',
              entities: ['product pack', 'blue energy streak'],
              hooks: ['Immediate reveal', 'High contrast'],
              risks: [],
              continuity: {
                introduces: ['blue energy motif'],
                paysOff: [],
                callbacks: []
              }
            },
            {
              start: 22,
              end: 28,
              kind: 'beat',
              visualSummary: 'The motion escalates and pays off the opening streak motif.',
              entities: ['product pack', 'athlete silhouette'],
              hooks: ['Motion escalation'],
              risks: [],
              continuity: {
                introduces: [],
                paysOff: ['blue energy motif'],
                callbacks: ['opening reveal']
              }
            }
          ],
          identityRegistry: {
            characters: ['athlete silhouette'],
            locations: ['studio backdrop'],
            objects: ['product pack'],
            motifs: ['blue energy streak']
          },
          visualBeats: {
            hookMoments: [
              {
                start: 0,
                end: 3,
                label: 'Immediate pack reveal',
                summary: 'The opener communicates the product before the viewer has to work for it.'
              }
            ],
            patternInterrupts: [
              {
                start: 14,
                end: 16,
                label: 'Hard cut typography burst',
                summary: 'A sudden typography change refreshes attention.'
              }
            ],
            titleCards: [
              {
                start: 14,
                end: 16,
                label: 'Benefit title card',
                summary: 'The claim card is legible but brief.'
              }
            ],
            ctaScreens: [
              {
                start: 54,
                end: 60,
                label: 'Final CTA slate',
                summary: 'The static end slate slightly slows the finish.'
              }
            ],
            noveltyPeaks: [
              {
                start: 22,
                end: 28,
                label: 'Escalation payoff',
                summary: 'The visual system peaks when the motion motif expands into a wider frame.'
              }
            ],
            fatigueRisks: [
              {
                start: 54,
                end: 60,
                label: 'Static CTA drag',
                summary: 'The end slate holds a little too long relative to the payoff.'
              }
            ]
          },
          editorialSignals: {
            openingRead: 'The opening is immediately legible and novelty-forward.',
            midpointEscalation: 'The midpoint escalates the same motif instead of introducing a disconnected visual system.',
            endingMomentum: 'Momentum softens on the final CTA slate.',
            continuityStrength: 'The recurring blue energy motif keeps the piece visually coherent.'
          }
        }),
        usage: { input: 700, output: 380 }
      };
    }
  }),
  getPersistedErrorInfo: () => ({ status: null, requestId: null, classification: null, response: null }),
  buildProviderOptions: ({ adapter, defaults = {} }) => ({ ...defaults, ...(adapter?.params || {}) })
});

const getVisualIdentity = require('../../server/scripts/get-context/get-visual-identity.cjs');

test('get-visual-identity script', async (t) => {
  let tempDir;
  let outputDir;
  let videoPath;

  t.beforeEach(() => {
    providerCalls.length = 0;
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ee-visual-identity-'));
    outputDir = path.join(tempDir, 'output');
    videoPath = path.join(tempDir, 'fixture.mp4');
    fs.writeFileSync(videoPath, 'fixture-video-payload');
  });

  t.afterEach(() => {
    if (tempDir && fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  await t.test('writes visual-identity-data.json as a dedicated additive Phase 1 artifact', async () => {
    const result = await getVisualIdentity.run({
      assetPath: videoPath,
      outputDir,
      artifacts: {
        dialogueData: {
          summary: 'Two short spoken lines set up the payoff and CTA.'
        },
        musicData: {
          summary: 'The score swells into the midpoint and softens on the close.'
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
                  durationSeconds: 60
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

    const artifactPath = path.join(outputDir, 'phase1-gather-context', 'visual-identity-data.json');
    const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));

    assert.equal(result.artifacts.visualIdentityData.analysisMode, 'whole_asset');
    assert.equal(result.artifacts.visualIdentityData.provenance.requestedMode, 'auto');
    assert.equal(result.artifacts.visualIdentityData.provenance.effectiveMode, 'whole_asset');
    assert.equal(result.artifacts.visualIdentityData.provenance.modeAliasApplied, false);
    assert.equal(result.artifacts.visualIdentityData.provenance.provider.transport, 'public_url');
    assert.equal(result.artifacts.visualIdentityData.provenance.configuredDomain, 'video');
    assert.equal(result.artifacts.visualIdentityData.videoDuration, 60);
    assert.equal(artifact.schemaVersion, 1);
    assert.equal(artifact.provenance.sourceStrategy, 'public_url');
    assert.equal(artifact.identityRegistry.motifs[0], 'blue energy streak');
    assert.equal(result.artifacts.visualIdentityData.path, 'phase1-gather-context/visual-identity-data.json');
    assert.equal(artifact.comparisonHints.additivePhase1Artifact, true);

    assert.equal(providerCalls.length, 1);
    assert.equal(providerCalls[0].attachments[0].url, 'https://gambit-games-tests.s3.us-east-1.amazonaws.com/peanut-gallery/cod.mp4');
    assert.equal(providerCalls[0].apiKey, process.env.OPENROUTER_API_KEY || 'test-api-key');
    assert.match(providerCalls[0].prompt, /PHASE 1 VISUAL IDENTITY TASK/);
    assert.match(providerCalls[0].prompt, /SUPPORTING NON-VISUAL CONTEXT/);
    assert.match(providerCalls[0].prompt, /visualBeats/);
  });
  await t.test('records hybrid requests honestly while aliasing execution to whole_asset', async () => {
    const result = await getVisualIdentity.run({
      assetPath: videoPath,
      outputDir,
      artifacts: {},
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
                  durationSeconds: 60
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
        },
        settings: {
          phase1: {
            visual_identity: {
              mode: 'hybrid',
              max_whole_asset_duration_seconds: 90,
              fallback_to_chunked: true
            }
          }
        }
      }
    });

    assert.equal(result.artifacts.visualIdentityData.analysisMode, 'whole_asset');
    assert.equal(result.artifacts.visualIdentityData.provenance.requestedMode, 'hybrid');
    assert.equal(result.artifacts.visualIdentityData.provenance.effectiveMode, 'whole_asset');
    assert.equal(result.artifacts.visualIdentityData.provenance.modeAliasApplied, true);
    assert.equal(result.artifacts.visualIdentityData.provenance.modeAliasReason, 'hybrid_currently_maps_to_whole_asset');
    assert.ok(Array.isArray(result.artifacts.visualIdentityData.qualityNotes));
    assert.match(result.artifacts.visualIdentityData.qualityNotes[0], /aliases to whole-asset visual identity analysis/);
  });

  await t.test('fails clearly when chunked visual identity mode is requested', async () => {
    await assert.rejects(() => getVisualIdentity.run({
      assetPath: videoPath,
      outputDir,
      artifacts: {},
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
                  durationSeconds: 60
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
        },
        settings: {
          phase1: {
            visual_identity: {
              mode: 'chunked'
            }
          }
        }
      }
    }), /chunked" is not supported yet/);
  });


});
