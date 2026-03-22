const path = require('path');
const fs = require('fs');
const test = require('node:test');
const { property, ok, rejects, is } = require('../helpers/assertions');

process.env.AI_API_KEY = 'test-api-key';

function mockModule(modulePath, mockExports) {
  const absolutePath = require.resolve(modulePath, { paths: [__dirname] });
  if (require.cache[absolutePath]) delete require.cache[absolutePath];
  require.cache[absolutePath] = { exports: mockExports, loaded: true, id: absolutePath, filename: absolutePath };
}

let lastCompletionOptions = null;
const mockAIProvider = {
  getProviderFromConfig: () => ({
    complete: async (options) => {
      lastCompletionOptions = options;
      return {
        content: JSON.stringify({
          summary: 'Test chunk analysis',
          emotions: {
            patience: { score: 7, reasoning: 'Calm pacing' },
            boredom: { score: 3, reasoning: 'Still engaging' },
            excitement: { score: 6, reasoning: 'Hook lands' }
          },
          dominant_emotion: 'patience',
          confidence: 0.85
        }),
        usage: { input: 150, output: 100 }
      };
    }
  }),
  getProviderFromEnv: () => {
    throw new Error('getProviderFromEnv should not be used in emotion-lenses-tool');
  }
};

mockModule('ai-providers/ai-provider-interface.js', mockAIProvider);
mockModule('../../../tools/node_modules/ai-providers/ai-provider-interface.js', mockAIProvider);

const emotionLensesTool = require('../../../tools/emotion-lenses-tool.cjs');

test('Emotion Lenses Tool', async (t) => {
  const testOutputDir = '/tmp/test-emotion-lenses-tool';
  let soulPath;
  let goalPath;

  t.beforeEach(() => {
    lastCompletionOptions = null;
    if (!fs.existsSync(testOutputDir)) fs.mkdirSync(testOutputDir, { recursive: true });

    soulPath = path.join(testOutputDir, 'SOUL.md');
    goalPath = path.join(testOutputDir, 'GOAL.md');
    fs.writeFileSync(soulPath, '# Identity\nTest Persona\n\n## Core Truth\nCalm but observant.\n');
    fs.writeFileSync(goalPath, '# Objective\nAnalyze emotion chunk output.\n');
  });

  t.afterEach(() => {
    if (fs.existsSync(testOutputDir)) fs.rmSync(testOutputDir, { recursive: true, force: true });
  });

  t.test('validateVariables', async (tNested) => {
    await tNested.test('accepts valid input', () => {
      const result = emotionLensesTool.validateVariables({
        soulPath,
        goalPath,
        variables: { lenses: ['patience', 'boredom'] }
      });
      ok(result.valid);
    });

    await tNested.test('rejects missing toolVariables', () => {
      const result = emotionLensesTool.validateVariables(null);
      ok(!result.valid);
      ok(result.error.includes('required'));
    });

    await tNested.test('rejects non-array lenses', () => {
      const result = emotionLensesTool.validateVariables({
        soulPath,
        goalPath,
        variables: { lenses: 'patience' }
      });
      ok(!result.valid);
      ok(result.error.includes('array'));
    });
  });

  t.test('buildBasePromptFromInput', async (tNested) => {
    await tNested.test('includes strict JSON instructions and lens-specific schema', () => {
      const prompt = emotionLensesTool.buildBasePromptFromInput({
        toolVariables: {
          soulPath,
          goalPath,
          variables: { lenses: ['patience', 'boredom'] }
        },
        videoContext: {
          chunkPath: __filename,
          mimeType: 'video/mp4',
          transferStrategy: 'base64',
          duration: 8,
          startTime: 0,
          endTime: 8
        },
        dialogueContext: { segments: [{ start: 0, end: 2, speaker: 'Speaker 1', text: 'Hello' }] },
        musicContext: {
          summary: 'Trailer-wide music stays tense and cinematic.',
          segments: [{
            start: 0,
            end: 8,
            type: 'music',
            description: 'Aggressive percussion hits under the opening threat.',
            mood: 'tense',
            intensity: 6
          }]
        },
        previousState: { summary: 'Earlier chunk was measured.' }
      });

      ok(prompt.includes('Return JSON only.'));
      ok(prompt.includes('Ground your judgment in the attached video chunk first'));
      ok(prompt.includes('Attached video chunk: video/mp4 (base64)'));
      ok(prompt.includes('dominant_emotion must match one of the configured lens names'));
      ok(prompt.includes('"patience"'));
      ok(prompt.includes('"boredom"'));
      ok(prompt.includes('Previous Summary'));
      ok(prompt.includes('Speaker 1'));
      ok(prompt.includes('Trailer-wide context: Trailer-wide music stays tense and cinematic.'));
      ok(prompt.includes('- Active chunk cues:'));
      ok(prompt.includes('detail: Aggressive percussion hits under the opening threat.'));
    });

    await tNested.test('clips overlapping Phase 1 context to the active chunk window in the built prompt', () => {
      const prompt = emotionLensesTool.buildBasePromptFromInput({
        toolVariables: {
          soulPath,
          goalPath,
          variables: { lenses: ['patience', 'boredom'] }
        },
        videoContext: {
          chunkPath: __filename,
          mimeType: 'video/mp4',
          transferStrategy: 'base64',
          duration: 5,
          startTime: 5,
          endTime: 10
        },
        dialogueContext: { segments: [{ start: 0, end: 6, speaker: 'Speaker 1', text: 'They want you afraid.' }] },
        musicContext: {
          summary: 'The trailer stays high-intensity and tense overall.',
          segments: [{
            start: 0,
            end: 140.042449,
            type: 'music',
            description: 'Sustained tense orchestral pulse with pounding percussion.',
            mood: 'tense',
            intensity: 8
          }]
        },
        previousState: { summary: '' }
      });

      ok(prompt.includes('- 5.0s-6.0s: Speaker 1: They want you afraid.'));
      ok(prompt.includes('Trailer-wide context: The trailer stays high-intensity and tense overall.'));
      ok(prompt.includes('- 5.0s-10.0s: music, detail: Sustained tense orchestral pulse with pounding percussion., mood: tense, intensity: 8'));
      ok(!prompt.includes('0.0s-6.0s: Speaker 1'));
      ok(!prompt.includes('0.0s-140.0s: music'));
    });

    await tNested.test('preserves full music summary and description text in the built prompt', () => {
      const longSummary = 'Trailer-wide arc: the cue starts with a hush, swells through dread, pivots into bruising percussion, then keeps layering anxious strings without ever fully releasing the pressure before the end card lands.';
      const longDescription = 'Detailed cue: low brass pulses creep underneath a brittle riser, then syncopated percussion stomps in while scraped strings and distorted impacts keep ratcheting the tension higher instead of resolving cleanly.';
      const prompt = emotionLensesTool.buildBasePromptFromInput({
        toolVariables: {
          soulPath,
          goalPath,
          variables: { lenses: ['patience'] }
        },
        videoContext: {
          chunkPath: __filename,
          mimeType: 'video/mp4',
          transferStrategy: 'base64',
          duration: 5,
          startTime: 10,
          endTime: 15
        },
        dialogueContext: { segments: [] },
        musicContext: {
          summary: longSummary,
          segments: [{
            start: 10,
            end: 15,
            type: 'music',
            description: longDescription,
            mood: 'tense',
            intensity: 9
          }]
        },
        previousState: { summary: '' }
      });

      ok(prompt.includes(`Trailer-wide context: ${longSummary}`));
      ok(prompt.includes(`detail: ${longDescription}`));
      ok(!prompt.includes('…'));
    });
  });

  t.test('validator-tool contract helpers', async (tNested) => {
    await tNested.test('builds a lane-specific validator contract', () => {
      const contract = emotionLensesTool.buildEmotionAnalysisValidatorToolContract({
        lenses: ['patience', 'boredom']
      });

      is(contract.name, 'validate_emotion_analysis_json');
      is(contract.argumentKey, 'emotionAnalysis');
      is(contract.canonicalEnvelope.tool, 'validate_emotion_analysis_json');
      property(contract.canonicalEnvelope, 'emotionAnalysis');
      property(contract.canonicalEnvelope.emotionAnalysis.emotions, 'patience');
      property(contract.canonicalEnvelope.emotionAnalysis.emotions, 'boredom');
    });

    await tNested.test('validates a correct candidate artifact', () => {
      const result = emotionLensesTool.executeEmotionAnalysisValidatorTool({
        emotionAnalysis: {
          summary: 'Steady and focused.',
          emotions: {
            patience: { score: 8, reasoning: 'Measured delivery.' },
            boredom: { score: 2, reasoning: 'Momentum stays intact.' }
          },
          dominant_emotion: 'patience',
          confidence: 0.9
        }
      }, {
        lenses: ['patience', 'boredom']
      });

      ok(result.valid);
      is(result.normalizedValue.summary, 'Steady and focused.');
    });

    await tNested.test('rejects missing required lens entries', () => {
      const result = emotionLensesTool.executeEmotionAnalysisValidatorTool({
        emotionAnalysis: {
          summary: 'Incomplete payload.',
          emotions: {
            patience: { score: 8, reasoning: 'Present.' }
          },
          dominant_emotion: 'patience',
          confidence: 0.9
        }
      }, {
        lenses: ['patience', 'boredom']
      });

      ok(!result.valid);
      ok(result.summary.includes('boredom'));
    });
  });

  t.test('analyze', async (tNested) => {
    await tNested.test('calls provider and returns structured result', async () => {
      const result = await emotionLensesTool.analyze({
        toolVariables: {
          soulPath,
          goalPath,
          variables: { lenses: ['patience', 'boredom', 'excitement'] }
        },
        videoContext: {
          chunkPath: __filename,
          mimeType: 'video/mp4',
          transferStrategy: 'base64',
          duration: 8
        },
        dialogueContext: { segments: [] },
        musicContext: { segments: [] },
        previousState: { summary: '', emotions: {} },
        provider: mockAIProvider.getProviderFromConfig(),
        config: {
          ai: {
            provider: 'openrouter',
            video: { model: 'yaml-video-model' }
          }
        }
      });

      property(result, 'prompt');
      property(result, 'state');
      property(result, 'usage');
      is(result.state.summary, 'Test chunk analysis');
      is(result.state.emotions.patience.score, 7);
      is(lastCompletionOptions.model, 'yaml-video-model');
      is(lastCompletionOptions.attachments.length, 1);
      is(lastCompletionOptions.attachments[0].type, 'video');
      is(lastCompletionOptions.attachments[0].mimeType, 'video/mp4');
      ok(typeof lastCompletionOptions.attachments[0].data === 'string');
      ok(lastCompletionOptions.attachments[0].data.length > 0);
    });

    await tNested.test('throws on invalid variables', async () => {
      await rejects(emotionLensesTool.analyze({ toolVariables: null }), /toolVariables is required/);
    });

    await tNested.test('hard-fails when provider is not injected explicitly', async () => {
      await rejects(
        emotionLensesTool.analyze({
          toolVariables: {
            soulPath,
            goalPath,
            variables: { lenses: ['patience'] }
          },
          videoContext: {
            chunkPath: __filename,
            mimeType: 'video/mp4',
            transferStrategy: 'base64',
            duration: 8
          },
          dialogueContext: { segments: [] },
          musicContext: { segments: [] },
          previousState: { summary: '', emotions: {} },
          config: {
            ai: {
              provider: 'openrouter',
              video: { model: 'yaml-video-model' }
            }
          },
          apiKey: 'override-key'
        }),
        /provider must be injected explicitly/
      );
    });
  });
});
