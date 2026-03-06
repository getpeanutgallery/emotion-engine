/**
 * Unit Tests for Emotion Lenses Tool
 * 
 * Tests the emotion-lenses-tool.cjs module.
 * Uses mock AI provider (no real API calls).
 */

const path = require('path');

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
      usage: {
        input: 150,
        output: 100
      }
    })
  })
};

// Mock persona loader
const mockPersonaLoader = {
  loadPersonaConfig: (soulPath, goalPath) => ({
    soul: {
      'Identity': '**Name:** Test Persona\n**Age:** 25',
      'Core Truth': 'This is a test persona for unit testing.'
    },
    goal: {
      'Primary Objective': 'Test emotion analysis',
      'Success Criteria': '- Criterion 1\n- Criterion 2'
    },
    tools: {
      'Emotional Lenses': '- Patience: Test lens\n- Boredom: Test lens'
    }
  })
};

// Mock modules before requiring the actual module
jest.mock('ai-providers/ai-provider-interface.js', () => mockAIProvider);
jest.mock('../../server/lib/persona-loader.cjs', () => mockPersonaLoader);

const emotionLensesTool = require('tools/emotion-lenses-tool.cjs');

describe('Emotion Lenses Tool', () => {
  describe('validateVariables', () => {
    test('returns valid for correct input', () => {
      const toolVariables = {
        soulPath: '/path/to/SOUL.md',
        goalPath: '/path/to/GOAL.md',
        variables: {
          lenses: ['patience', 'boredom', 'excitement']
        }
      };

      const result = emotionLensesTool.validateVariables(toolVariables);

      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    test('returns invalid when toolVariables is missing', () => {
      const result = emotionLensesTool.validateVariables(null);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('required');
    });

    test('returns invalid when soulPath is missing', () => {
      const toolVariables = {
        goalPath: '/path/to/GOAL.md',
        variables: {
          lenses: ['patience']
        }
      };

      const result = emotionLensesTool.validateVariables(toolVariables);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('soulPath');
    });

    test('returns invalid when goalPath is missing', () => {
      const toolVariables = {
        soulPath: '/path/to/SOUL.md',
        variables: {
          lenses: ['patience']
        }
      };

      const result = emotionLensesTool.validateVariables(toolVariables);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('goalPath');
    });

    test('returns invalid when lenses is not an array', () => {
      const toolVariables = {
        soulPath: '/path/to/SOUL.md',
        goalPath: '/path/to/GOAL.md',
        variables: {
          lenses: 'patience' // Should be array
        }
      };

      const result = emotionLensesTool.validateVariables(toolVariables);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('array');
    });
  });

  describe('buildPrompt', () => {
    test('builds prompt with all sections', () => {
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

      expect(prompt).toContain('# PERSONA');
      expect(prompt).toContain('# EVALUATION GOAL');
      expect(prompt).toContain('# EMOTION LENSES TO TRACK');
      expect(prompt).toContain('patience');
      expect(prompt).toContain('boredom');
      expect(prompt).toContain('# CONTEXT');
      expect(prompt).toContain('# INSTRUCTIONS');
    });

    test('includes previous state in prompt', () => {
      const personaConfig = { soul: {}, goal: {}, tools: {} };
      const options = {
        lenses: ['patience'],
        previousState: { summary: 'Previous chunk summary' }
      };

      const prompt = emotionLensesTool.buildPrompt(personaConfig, options);

      expect(prompt).toContain('Previous Summary');
      expect(prompt).toContain('Previous chunk summary');
    });

    test('includes dialogue context in prompt', () => {
      const personaConfig = { soul: {}, goal: {}, tools: {} };
      const options = {
        lenses: ['patience'],
        dialogueContext: {
          segments: [{ start: 0, end: 5, speaker: 'Speaker 1', text: 'Hello' }]
        }
      };

      const prompt = emotionLensesTool.buildPrompt(personaConfig, options);

      expect(prompt).toContain('## Dialogue');
      expect(prompt).toContain('Speaker 1');
      expect(prompt).toContain('Hello');
    });
  });

  describe('parseResponse', () => {
    test('parses valid JSON response', () => {
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

      expect(state.summary).toBe('Test summary');
      expect(state.emotions.patience.score).toBe(8);
      expect(state.emotions.boredom.score).toBe(2);
      expect(state.dominant_emotion).toBe('patience');
      expect(state.confidence).toBe(0.9);
    });

    test('parses JSON from markdown code block', () => {
      const responseContent = '```json\n' + JSON.stringify({
        summary: 'Test summary',
        emotions: {
          patience: { score: 7, reasoning: 'Test' }
        }
      }) + '\n```';

      const state = emotionLensesTool.parseResponse(responseContent, {}, ['patience']);

      expect(state.summary).toBe('Test summary');
      expect(state.emotions.patience.score).toBe(7);
    });

    test('uses fallback for invalid JSON', () => {
      const responseContent = 'Invalid response';

      const state = emotionLensesTool.parseResponse(responseContent, {}, ['patience', 'boredom']);

      expect(state.summary).toBe('Analysis completed');
      expect(state.emotions.patience.score).toBe(5); // Default score
      expect(state.emotions.boredom.score).toBe(5); // Default score
    });

    test('includes previous summary in state', () => {
      const responseContent = JSON.stringify({
        summary: 'New summary',
        emotions: {}
      });

      const previousState = { summary: 'Previous summary' };
      const state = emotionLensesTool.parseResponse(responseContent, previousState, []);

      expect(state.previousSummary).toBe('Previous summary');
    });
  });

  describe('analyze (integration)', () => {
    test('calls AI provider and returns structured result', async () => {
      const input = {
        toolVariables: {
          soulPath: '/path/to/SOUL.md',
          goalPath: '/path/to/GOAL.md',
          variables: {
            lenses: ['patience', 'boredom', 'excitement']
          }
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

      expect(result).toHaveProperty('prompt');
      expect(result).toHaveProperty('state');
      expect(result).toHaveProperty('usage');
      expect(result.state.summary).toBe('Test chunk analysis');
      expect(result.state.emotions.patience.score).toBe(7);
      expect(result.usage.input).toBe(150);
      expect(result.usage.output).toBe(100);
    });

    test('throws error when toolVariables is invalid', async () => {
      const input = {
        toolVariables: null
      };

      await expect(emotionLensesTool.analyze(input)).rejects.toThrow('soulPath and goalPath are required');
    });
  });
});
