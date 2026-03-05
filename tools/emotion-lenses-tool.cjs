#!/usr/bin/env node
/**
 * Emotion Lenses Tool
 * 
 * Evaluates media against a persona using emotion lenses.
 * This tool is called by process scripts (video-chunks, video-per-second) to perform
 * AI-powered emotion analysis.
 * 
 * @module tools/emotion-lenses-tool
 */

const fs = require('fs');
const path = require('path');
const aiProvider = require('../server/lib/ai-providers/ai-provider-interface.js');
const personaLoader = require('../server/lib/persona-loader.cjs');

/**
 * Tool Input Contract
 * @typedef {Object} EmotionLensesInput
 * @property {Object} toolVariables - Tool configuration
 * @property {string} toolVariables.soulPath - Path to SOUL.md
 * @property {string} toolVariables.goalPath - Path to GOAL.md
 * @property {Object} toolVariables.variables - Additional variables
 * @property {string[]} toolVariables.variables.lenses - Emotion lenses to evaluate
 * @property {Object} [videoContext] - Video context
 * @property {Array} videoContext.frames - Video frames (base64 or paths)
 * @property {number} videoContext.duration - Duration in seconds
 * @property {Object} [dialogueContext] - Dialogue context
 * @property {Array} dialogueContext.segments - Dialogue segments
 * @property {Object} [musicContext] - Music context
 * @property {Array} musicContext.segments - Music segments
 * @property {Object} [previousState] - State from previous chunk (for continuity)
 * @property {string} previousState.summary - Previous summary
 * @property {Object} previousState.emotions - Previous emotion scores
 */

/**
 * Tool Output Contract
 * @typedef {Object} EmotionLensesOutput
 * @property {string} prompt - The prompt sent to AI
 * @property {Object} state - Analysis state
 * @property {string} state.summary - AI summary of this chunk
 * @property {Object} state.emotions - Emotion scores per lens
 * @property {string} state.previousSummary - Summary from previous chunk
 * @property {Object} usage - Token usage
 * @property {number} usage.input - Input tokens
 * @property {number} usage.output - Output tokens
 */

/**
 * Analyze media using emotion lenses
 * 
 * @async
 * @function analyze
 * @param {EmotionLensesInput} input - Tool input
 * @returns {Promise<EmotionLensesOutput>} - Analysis results
 */
async function analyze(input) {
  const {
    toolVariables,
    videoContext = { frames: [], duration: 0 },
    dialogueContext = { segments: [] },
    musicContext = { segments: [] },
    previousState = { summary: '', emotions: {} }
  } = input;

  // Validate required inputs
  if (!toolVariables?.soulPath || !toolVariables?.goalPath) {
    throw new Error('EmotionLensesTool: soulPath and goalPath are required in toolVariables');
  }

  const lenses = toolVariables.variables?.lenses || ['patience', 'boredom', 'excitement'];

  // Load persona configuration
  const personaConfig = personaLoader.loadPersonaConfig(
    toolVariables.soulPath,
    toolVariables.goalPath
  );

  if (!personaConfig) {
    throw new Error(`EmotionLensesTool: Failed to load persona from ${toolVariables.soulPath} and ${toolVariables.goalPath}`);
  }

  // Build the prompt
  const prompt = buildPrompt(personaConfig, {
    lenses,
    videoContext,
    dialogueContext,
    musicContext,
    previousState
  });

  // Prepare attachments (video frames as images)
  const attachments = [];
  if (videoContext.frames && videoContext.frames.length > 0) {
    for (const frame of videoContext.frames) {
      if (frame.path) {
        // Pattern 2: Local path (auto-convert to base64)
        attachments.push({
          type: 'image',
          path: frame.path
        });
      } else if (frame.data) {
        // Pattern 3: Direct base64 data
        attachments.push({
          type: 'image',
          data: frame.data,
          mimeType: frame.mimeType || 'image/jpeg'
        });
      }
    }
  }

  // Get AI provider from environment
  const provider = aiProvider.getProviderFromEnv();
  const model = process.env.AI_MODEL || 'qwen/qwen-3.5-397b-a17b';
  const apiKey = process.env.AI_API_KEY;

  if (!apiKey) {
    throw new Error('EmotionLensesTool: AI_API_KEY environment variable is required');
  }

  // Call AI provider
  const response = await provider.complete({
    prompt,
    model,
    apiKey,
    attachments: attachments.length > 0 ? attachments : undefined,
    options: {
      temperature: 0.7,
      maxTokens: 2048
    }
  });

  // Parse response into structured state
  const state = parseResponse(response.content, previousState, lenses);

  return {
    prompt,
    state,
    usage: {
      input: response.usage?.input || 0,
      output: response.usage?.output || 0
    }
  };
}

/**
 * Build prompt for AI analysis
 * 
 * @function buildPrompt
 * @param {Object} personaConfig - Loaded persona config
 * @param {Object} options - Prompt options
 * @returns {string} - Complete prompt
 */
function buildPrompt(personaConfig, options) {
  const { soul, goal, tools } = personaConfig;
  const {
    lenses,
    videoContext,
    dialogueContext,
    musicContext,
    previousState
  } = options;

  let prompt = '';

  // SOUL section
  if (soul) {
    prompt += '# PERSONA\n\n';
    for (const [section, content] of Object.entries(soul)) {
      prompt += `## ${section}\n${content}\n\n`;
    }
    prompt += '\n';
  }

  // GOAL section
  if (goal) {
    prompt += '# EVALUATION GOAL\n\n';
    for (const [section, content] of Object.entries(goal)) {
      prompt += `## ${section}\n${content}\n\n`;
    }
    prompt += '\n';
  }

  // Emotion Lenses section
  prompt += '# EMOTION LENSES TO TRACK\n\n';
  prompt += `Evaluate the following emotions on a scale of 1-10:\n\n`;
  for (const lens of lenses) {
    prompt += `- **${capitalize(lens)}**: Rate from 1 (lowest) to 10 (highest)\n`;
  }
  prompt += '\n';

  // Context section
  prompt += '# CONTEXT\n\n';

  // Previous state (for continuity)
  if (previousState?.summary) {
    prompt += `## Previous Summary\n${previousState.summary}\n\n`;
  }

  // Video context
  if (videoContext?.duration) {
    prompt += `## Video Segment\n`;
    prompt += `Duration: ${videoContext.duration} seconds\n`;
    if (videoContext.frames?.length > 0) {
      prompt += `Attached: ${videoContext.frames.length} frame(s) for visual analysis\n`;
    }
    prompt += '\n';
  }

  // Dialogue context
  if (dialogueContext?.segments && dialogueContext.segments.length > 0) {
    prompt += `## Dialogue\n`;
    for (const seg of dialogueContext.segments) {
      const timeRange = formatTimeRange(seg.start, seg.end);
      prompt += `[${timeRange}] ${seg.speaker || 'Speaker'}: ${seg.text}\n`;
    }
    prompt += '\n';
  }

  // Music context
  if (musicContext?.segments && musicContext.segments.length > 0) {
    prompt += `## Music/Audio\n`;
    for (const seg of musicContext.segments) {
      const timeRange = formatTimeRange(seg.start, seg.end);
      prompt += `[${timeRange}] ${seg.description || seg.mood || 'Audio'} (intensity: ${seg.intensity || 'N/A'})\n`;
    }
    prompt += '\n';
  }

  // Instructions
  prompt += '# INSTRUCTIONS\n\n';
  prompt += `Analyze the provided media and context. Respond with a JSON object in the following format:\n\n`;
  prompt += '```json\n';
  prompt += JSON.stringify({
    summary: "Brief summary of what happens in this segment",
    emotions: {
      [lenses[0]]: {
        score: 5,
        reasoning: "Why this score was given"
      }
    },
    dominant_emotion: "lens_name",
    confidence: 0.85
  }, null, 2);
  prompt += '\n```\n\n';

  prompt += 'IMPORTANT:\n';
  prompt += '- Respond ONLY with valid JSON (no markdown, no explanation)\n';
  prompt += '- Be honest and critical—this persona\'s job is to provide authentic feedback\n';
  prompt += '- Consider the previous context for continuity\n';

  return prompt;
}

/**
 * Parse AI response into structured state
 * 
 * @function parseResponse
 * @param {string} responseContent - AI response content
 * @param {Object} previousState - Previous state
 * @param {string[]} lenses - Emotion lenses
 * @returns {Object} - Parsed state
 */
function parseResponse(responseContent, previousState, lenses) {
  // Try to extract JSON from response
  let jsonData = null;
  
  try {
    // Try parsing as-is first
    jsonData = JSON.parse(responseContent.trim());
  } catch (e) {
    // Try to extract JSON from markdown code block
    const jsonMatch = responseContent.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      try {
        jsonData = JSON.parse(jsonMatch[1].trim());
      } catch (e2) {
        console.warn('EmotionLensesTool: Failed to parse JSON from response, using fallback');
      }
    }
  }

  // Build state from parsed JSON or create fallback
  const state = {
    summary: jsonData?.summary || 'Analysis completed',
    emotions: {},
    previousSummary: previousState?.summary || ''
  };

  // Parse emotion scores
  if (jsonData?.emotions) {
    for (const lens of lenses) {
      const emotionData = jsonData.emotions[lens];
      state.emotions[lens] = {
        score: typeof emotionData?.score === 'number' ? emotionData.score : 5,
        reasoning: emotionData?.reasoning || 'No reasoning provided'
      };
    }
  } else {
    // Fallback: default scores
    for (const lens of lenses) {
      state.emotions[lens] = {
        score: 5,
        reasoning: 'Default score (parsing failed)'
      };
    }
  }

  // Add dominant emotion if provided
  if (jsonData?.dominant_emotion) {
    state.dominant_emotion = jsonData.dominant_emotion;
  }

  // Add confidence if provided
  if (typeof jsonData?.confidence === 'number') {
    state.confidence = jsonData.confidence;
  }

  return state;
}

/**
 * Format time range as MM:SS
 * 
 * @function formatTimeRange
 * @param {number} start - Start time in seconds
 * @param {number} end - End time in seconds
 * @returns {string} - Formatted time range
 */
function formatTimeRange(start, end) {
  const format = (s) => {
    const mins = Math.floor(s / 60);
    const secs = Math.floor(s % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };
  return `${format(start)}-${format(end)}`;
}

/**
 * Capitalize first letter
 * 
 * @function capitalize
 * @param {string} str - Input string
 * @returns {string} - Capitalized string
 */
function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Validate tool variables
 * 
 * @function validateVariables
 * @param {Object} toolVariables - Tool variables to validate
 * @returns {{valid: boolean, error?: string}} - Validation result
 */
function validateVariables(toolVariables) {
  if (!toolVariables) {
    return { valid: false, error: 'toolVariables is required' };
  }

  if (!toolVariables.soulPath) {
    return { valid: false, error: 'toolVariables.soulPath is required' };
  }

  if (!toolVariables.goalPath) {
    return { valid: false, error: 'toolVariables.goalPath is required' };
  }

  if (!toolVariables.variables?.lenses || !Array.isArray(toolVariables.variables.lenses)) {
    return { 
      valid: false, 
      error: 'toolVariables.variables.lenses must be an array of emotion lens names' 
    };
  }

  return { valid: true };
}

module.exports = {
  analyze,
  validateVariables,
  buildPrompt,
  parseResponse
};

// Allow standalone execution for testing
if (require.main === module) {
  console.log('Emotion Lenses Tool - Test Mode');
  console.log('Usage: Set AI_API_KEY and run with test input');
  
  // Example test (won't run without actual files and API key)
  const testInput = {
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
    dialogueContext: {
      segments: []
    },
    musicContext: {
      segments: []
    },
    previousState: {
      summary: '',
      emotions: {}
    }
  };
  
  console.log('Test input structure:', JSON.stringify(testInput, null, 2));
}
