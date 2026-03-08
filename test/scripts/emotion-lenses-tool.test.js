const path = require('path');
const fs = require('fs');
const assert = require('node:assert/strict');
const test = require('node:test');
const { property, ok, rejects, is } = require('../helpers/assertions');

process.env.AI_API_KEY = 'test-api-key';

// Mock helper
function mockModule(modulePath, mockExports) {
  const absolutePath = require.resolve(modulePath, { paths: [__dirname] });
  if (require.cache[absolutePath]) delete require.cache[absolutePath];
  require.cache[absolutePath] = { exports: mockExports, loaded: true, id: absolutePath, filename: absolutePath };
}

// Mock AI provider
const mockAIProvider = {
  getProviderFromEnv: () => ({
    complete: async (options) => ({
      content: JSON.stringify({
        summary: 'Test chunk analysis',
        emotions: {
          patience: { score: 7, reasoning: 'Test reasoning' },
          boredom: { score: 3, reasoning: 'Test reasoning' },
          excitement: { score: 6, reasoning: 'Test reasoning' }
        },
        dominant_emotion: 'patience',
        confidence: 0.85
      }),
      usage: { input: 150, output: 100 }
    })
  })
};

mockModule('ai-providers/ai-provider-interface.js', mockAIProvider);

const emotionLensesTool = require('tools/emotion-lenses-tool.cjs');

test('Emotion Lenses Tool', async (t) => {
  const testOutputDir = '/tmp/test-emotion-lenses-tool';
  let soulPath, goalPath;

  t.beforeEach(() => {
    if (!fs.existsSync(testOutputDir)) {
      fs.mkdirSync(testOutputDir, { recursive: true });
    }
    // Create temporary SOUL.md and GOAL.md for tests
    soulPath = path.join(testOutputDir, 'SOUL.md');
    goalPath = path.join(testOutputDir, 'GOAL.md');
    fs.writeFileSync(soulPath, `# Identity\n**Name:** Test Persona\n**Age:** 25\n\n## Core Truth\nThis is a test persona for unit testing.\n\n## Tools\n### Emotional Lenses\n- Patience: Test lens\n- Boredom: Test lens\n- Excitement: Test lens`);
    fs.writeFileSync(goalPath, `# Primary Objective\nTest emotion analysis\n\n## Success Criteria\n- Criterion 1\n- Criterion 2`);
  });

  t.afterEach(() => {
    if (fs.existsSync(testOutputDir)) {
      fs.rmSync(testOutputDir, { recursive: true, force: true });
    }
  });

  t.test('validateVariables', (tNested) => {
    tNested.test('returns valid for correct input', () => {
      const toolVariables = {
        soulPath: soulPath,
        goalPath: goalPath,
        variables: { lenses: ['patience', 'boredom', 'excitement'] }
      };
      const result = emotionLensesTool.validateVariables(toolVariables);
      ok(result.valid);
      ok(result.error === undefined);
    });

    tNested.test('returns invalid when toolVariables is missing', () => {
      const result = emotionLensesTool.validateVariables(null);
      ok(!result.valid);
      ok(result.error.includes('required'));
    });

    tNested.test('returns invalid when soulPath is missing', () => {
      const toolVariables = {
        goalPath: goalPath,
        variables: { lenses: ['patience'] }
      };
      const result = emotionLensesTool.validateVariables(toolVariables);
      ok(!result.valid);
      ok(result.error.includes('soulPath'));
    });

    tNested.test('returns invalid when goalPath is missing', () => {
      const toolVariables = {
        soulPath: soulPath,
        variables: { lenses: ['patience'] }
      };
      const result = emotionLensesTool.validateVariables(toolVariables);
      ok(!result.valid);
      ok(result.error.includes('goalPath'));
    });

    tNested.test('returns invalid when lenses is not an array', () => {
      const toolVariables = {
        soulPath: soulPath,
        goalPath: goalPath,
        variables: { lenses: 'patience' } // Should be array
      };
      const result = emotionLensesTool.validateVariables(toolVariables);
      ok(!result.valid);
      ok(result.error.includes('array'));
    });
  });

  t.test('buildPrompt', (tNested) => {
    tNested.test('builds prompt with all sections', () => {
      const personaConfig = {
        soul: { 'Identity': 'Test Persona' },
        goal: { 'Objective': 'Test Goal' },
        tools: { 'Lenses': 'Test lenses' }
      };
      const options = {
        lenses: ['patience', 'boredom'],
        videoContext: { duration: 8, frames: [] },
        dialogueContext: { segments: [] },
        musicContext: { segments: [] },
        previousState: { summary: '' }
      };
      const prompt = emotionLensesTool.buildPrompt(personaConfig, options);
      ok(prompt.includes('# PERSONA'));
      ok(prompt.includes('# EVALUATION GOAL'));
      ok(prompt.includes('# EMOTION LENSES TO TRACK'));
      ok(prompt.includes('patience'));
      ok(prompt.includes('boredom'));
      ok(prompt.includes('# CONTEXT'));
      ok(prompt.includes('# INSTRUCTIONS'));
    });

    tNested.test('includes previous state in prompt', () => {
      const personaConfig = { soul: {}, goal: {}, tools: {} };
      const options = {
        lenses: ['patience'],
        previousState: { summary: 'Previous chunk summary' }
      };
      const prompt = emotionLensesTool.buildPrompt(personaConfig, options);
      ok(prompt.includes('Previous Summary'));
      ok(prompt.includes('Previous chunk summary'));
    });

    tNested.test('includes dialogue context in prompt', () => {
      const personaConfig = { soul: {}, goal: {}, tools: {} };
      const options = {
        lenses: ['patience'],
        dialogueContext: {
          segments: [{ start: 0, end: 5, speaker: 'Speaker 1', text: 'Hello' }]
        }
      };
      const prompt = emotionLensesTool.buildPrompt(personaConfig, options);
      ok(prompt.includes('## Dialogue'));
      ok(prompt.includes('Speaker 1'));
      ok(prompt.includes('Hello'));
    });
  });

  t.test('parseResponse', (tNested) => {
    tNested.test('parses valid JSON response', () => {
      const responseContent = JSON.stringify({
        summary: 'Test summary',
        emotions: {
          patience: { score: 8, reasoning: 'Good pacing' },
          boredom: { score: 2, reasoning: 'Very engaging' }
        },
        dominant_emotion: 'patience',
        confidence: 0.9
      });
      const state = emotionLensesTool.parseResponse(responseContent, {}, ['patience', 'boredom']);
      is(state.summary, 'Test summary');
      is(state.emotions.patience.score, 8);
      is(state.emotions.boredom.score, 2);
      is(state.dominant_emotion, 'patience');
      is(state.confidence, 0.9);
    });

    tNested.test('parses JSON from markdown code block', () => {
      const responseContent = '```json\n' + JSON.stringify({
        summary: 'Test summary',
        emotions: {
          patience: { score: 7, reasoning: 'Test' }
        }
      }) + '\n```';
      const state = emotionLensesTool.parseResponse(responseContent, {}, ['patience']);
      is(state.summary, 'Test summary');
      is(state.emotions.patience.score, 7);
    });

    tNested.test('uses fallback for invalid JSON', () => {
      const responseContent = 'Invalid response';
      const state = emotionLensesTool.parseResponse(responseContent, {}, ['patience', 'boredom']);
      is(state.summary, 'Analysis completed');
      is(state.emotions.patience.score, 5);
      is(state.emotions.boredom.score, 5);
    });

    tNested.test('includes previous summary in state', () => {
      const responseContent = JSON.stringify({
        summary: 'New summary',
        emotions: {}
      });
      const previousState = { summary: 'Previous summary' };
      const state = emotionLensesTool.parseResponse(responseContent, previousState, []);
      is(state.previousSummary, 'Previous summary');
    });
  });

  t.test('analyze (integration)', (tNested) => {
    tNested.test('calls AI provider and returns structured result', async () => {
      const input = {
        toolVariables: {
          soulPath: soulPath,
          goalPath: goalPath,
          variables: { lenses: ['patience', 'boredom', 'excitement'] }
        },
        videoContext: {
          frames: [],
          duration: 8
        },
        dialogueContext: { segments: [] },
        musicContext: { segments: [] },
        previousState: { summary: '', emotions: {} }
      };
      const result = await emotionLensesTool.analyze(input);
      property(result, 'prompt');
      property(result, 'state');
      property(result, 'usage');
      is(result.state.summary, 'Test chunk analysis');
      is(result.state.emotions.patience.score, 7);
      is(result.usage.input, 150);
      is(result.usage.output, 100);
    });

    tNested.test('throws error when toolVariables is invalid', async () => {
      const input = { toolVariables: null };
      await rejects(emotionLensesTool.analyze(input), /toolVariables is required/);
    });
  });
});
