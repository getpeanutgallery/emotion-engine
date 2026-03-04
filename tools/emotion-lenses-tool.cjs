#!/usr/bin/env node
/**
 * Emotion Lenses Tool
 * 
 * Tracks emotional metrics (patience, boredom, excitement, etc.) across video content.
 * 
 * TOOL_VARIABLES Schema:
 * {
 *   "lenses": string[],      // Required: Array of emotion names
 *   "thresholds"?: {         // Optional: Custom thresholds
 *     [lensName: string]: number
 *   }
 * }
 * 
 * Example:
 * TOOL_VARIABLES='{"lenses":["patience","boredom","excitement"]}'
 * 
 * Usage:
 *   TOOL_ID=emotion-lenses TOOL_VARIABLES='{"lenses":["patience","boredom"]}' \
 *     node server/run-pipeline.cjs ./videos/test.mp4 ./output/test
 */

const fs = require('fs');
const path = require('path');

// Load TOOLS.md for lens definitions
const TOOLS_MD_PATH = path.join(__dirname, '../../personas/tools/emotion-tracking/1.0.0/TOOLS.md');

/**
 * Validate TOOL_VARIABLES for emotion-lenses tool
 * @param {Object} toolVariables - Parsed TOOL_VARIABLES
 * @returns {{valid: boolean, error?: string}}
 */
function validateVariables(toolVariables) {
  if (!toolVariables.lenses) {
    return {
      valid: false,
      error: 'emotion-lenses tool requires "lenses" field in TOOL_VARIABLES'
    };
  }
  
  if (!Array.isArray(toolVariables.lenses)) {
    return {
      valid: false,
      error: 'emotion-lenses tool: "lenses" must be an array'
    };
  }
  
  if (toolVariables.lenses.length === 0) {
    return {
      valid: false,
      error: 'emotion-lenses tool: "lenses" array must have at least 1 item'
    };
  }
  
  for (const lens of toolVariables.lenses) {
    if (typeof lens !== 'string') {
      return {
        valid: false,
        error: `emotion-lenses tool: lens name must be a string, got ${typeof lens}`
      };
    }
  }
  
  // Optional: validate thresholds if present
  if (toolVariables.thresholds && typeof toolVariables.thresholds !== 'object') {
    return {
      valid: false,
      error: 'emotion-lenses tool: "thresholds" must be an object'
    };
  }
  
  return { valid: true };
}

/**
 * Parse TOOLS.md to get lens metadata
 * @returns {Object} Lens definitions from TOOLS.md
 */
function loadLensDefinitions() {
  if (!fs.existsSync(TOOLS_MD_PATH)) {
    return {};
  }
  
  const content = fs.readFileSync(TOOLS_MD_PATH, 'utf8');
  const lenses = {};
  
  // Simple parser for TOOLS.md table format
  const lines = content.split('\n');
  for (const line of lines) {
    if (line.includes('| **') && line.includes('|') && line.toLowerCase().includes('scale')) {
      const parts = line.split('|').map(p => p.trim()).filter(p => p);
      if (parts.length >= 3) {
        const name = parts[0].replace(/\*\*/g, '').toLowerCase();
        const description = parts[1];
        lenses[name] = { name, description };
      }
    }
  }
  
  return lenses;
}

/**
 * Build system prompt for emotion tracking
 * @param {Object} personaConfig - Loaded persona (soul + goal)
 * @param {Object} toolVariables - Tool configuration
 * @param {Object} videoContext - Video context
 * @param {string} dialogueContext - Dialogue context
 * @param {string} musicContext - Music context
 * @param {Object} previousState - Previous state
 * @returns {string} System prompt
 */
function buildPrompt(personaConfig, toolVariables, videoContext, dialogueContext, musicContext, previousState) {
  const { soul, goal } = personaConfig;
  const lenses = toolVariables.lenses;
  const lensDefs = loadLensDefinitions();
  
  // Extract persona info
  const soulName = soul['Name'] || 'Persona';
  const soulAge = soul['Age'] || '';
  const soulDemographic = soul['Demographic'] || '';
  const soulCoreTruth = soul['Core Truth'] || '';
  const soulBehavioral = soul['Behavioral Profile'] || '';
  const goalObjective = goal['Primary Objective'] || '';
  const goalCriteria = goal['Success Criteria'] || '';
  
  // Build lenses section
  const lensesText = lenses.map(lens => {
    const def = lensDefs[lens.toLowerCase()] || { description: 'Emotional metric' };
    return `- **${lens.charAt(0).toUpperCase() + lens.slice(1)}**: ${def.description} (scale 1-10)`;
  }).join('\n');
  
  // Build previous state section (if exists)
  let previousStateText = '';
  if (previousState && Object.keys(previousState).length > 0) {
    previousStateText = `\n**Previous Emotional State:**\n`;
    for (const [key, value] of Object.entries(previousState)) {
      if (key !== 'thought' && typeof value === 'number') {
        previousStateText += `- ${key}: ${value}/10\n`;
      }
    }
    if (previousState.thought) {
      previousStateText += `- Thought: "${previousState.thought}"\n`;
    }
  }
  
  // Compose full prompt
  let prompt = `You are ${soulName}`;
  if (soulAge) prompt += `, ${soulAge}`;
  if (soulDemographic) prompt += `, ${soulDemographic}`;
  prompt += `.\n\n`;
  
  prompt += `${soulCoreTruth}\n\n`;
  prompt += `${soulBehavioral}\n\n`;
  prompt += `---\n\n`;
  prompt += `YOUR EVALUATION GOAL:\n${goalObjective}\n\n`;
  prompt += `Success criteria:\n${goalCriteria}\n\n`;
  prompt += `---\n\n`;
  prompt += `TRACK THESE EMOTIONS:\n${lensesText}\n\n`;
  prompt += `${previousStateText}`;
  prompt += `Video duration: ${videoContext.duration || videoContext.endTime - videoContext.startTime} seconds\n`;
  
  if (dialogueContext) {
    prompt += `\n**What You're Hearing (Dialogue):**\n${dialogueContext}\n`;
  }
  if (musicContext) {
    prompt += `\n**What You're Hearing (Music/Audio):**\n${musicContext}\n`;
  }
  
  prompt += `\n---\n\n`;
  prompt += `IMPORTANT:\n`;
  prompt += `- Respond ONLY with valid JSON\n`;
  prompt += `- Use the persona's authentic voice in "thought" fields\n`;
  prompt += `- Be brutally honest—this persona's job is to fail content that doesn't work\n`;
  
  // Different format for chunk vs per-second analysis
  if (videoContext.chunkIndex !== undefined) {
    // Chunk analysis
    prompt += `- Provide a summary for this ${videoContext.duration}s chunk\n\n`;
    prompt += `Required JSON format:\n`;
    prompt += `\`\`\`json\n`;
    prompt += `{
  "chunk_index": ${videoContext.chunkIndex},
  "start_time": ${videoContext.startTime},
  "end_time": ${videoContext.endTime},
  "average_scores": {
    "${lenses[0]}": 0-10,
    "${lenses[1] || 'boredom'}": 0-10
  },
  "summary": "emotional arc for this chunk",
  "scroll_decision": "WATCHING|CONSIDERING_SCROLL|SCROLLING"
}\n`;
    prompt += `\`\`\`\n`;
  } else {
    // Per-second analysis
    prompt += `- Score EVERY SECOND from ${videoContext.startTime || 0} to ${videoContext.endTime}\n`;
    prompt += `- Mark scroll_risk as "SCROLLING" the moment this persona would abandon\n\n`;
    prompt += `Required JSON format:\n`;
    prompt += `\`\`\`json\n`;
    prompt += `{
  "per_second_analysis": [
    {
      "timestamp": 0,
      "visuals": "describe what you see",
      "${lenses[0]}": 0-10,
      "${lenses[1] || 'boredom'}": 0-10,
      "${lenses[2] || 'excitement'}": 0-10,
      "thought": "internal monologue in persona voice",
      "scroll_risk": "low|medium|high|SCROLLING"
    }
  ]
}\n`;
    prompt += `\`\`\`\n`;
  }
  
  return prompt;
}

/**
 * Format state after receiving API response
 * @param {Object} apiResponse - Parsed API response
 * @param {Object} previousState - Previous state
 * @returns {Object} New state
 */
function formatState(apiResponse, previousState) {
  // Extract scores from API response
  // This is emotion-specific logic (pipeline doesn't do this)
  
  if (apiResponse.per_second_analysis && apiResponse.per_second_analysis.length > 0) {
    // Per-second analysis: return last second as state
    const last = apiResponse.per_second_analysis[apiResponse.per_second_analysis.length - 1];
    return {
      timestamp: last.timestamp,
      patience: last.patience,
      boredom: last.boredom,
      excitement: last.excitement,
      thought: last.thought
    };
  } else if (apiResponse.average_scores) {
    // Chunk analysis: return averages as state
    return {
      chunkIndex: apiResponse.chunk_index,
      ...apiResponse.average_scores,
      thought: apiResponse.summary
    };
  }
  
  return previousState || {};
}

/**
 * Main analysis function
 * @param {Object} input - Tool input
 * @returns {Promise<{prompt: string, state: Object}>}
 */
async function analyze(input) {
  const { toolVariables, videoContext, dialogueContext, musicContext, previousState } = input;
  
  // Validate TOOL_VARIABLES
  const validation = validateVariables(toolVariables);
  if (!validation.valid) {
    throw new Error(`Emotion-lenses tool validation failed: ${validation.error}`);
  }
  
  // Load persona config (soul + goal, NOT tools)
  const personaLoader = require('../../server/lib/persona-loader.cjs');
  const SOUL_ID = process.env.SOUL_ID || 'impatient-teenager';
  const GOAL_ID = process.env.GOAL_ID || 'video-ad-evaluation';
  
  const soul = personaLoader.loadSoul(SOUL_ID);
  const goal = personaLoader.loadGoal(GOAL_ID);
  
  if (!soul || !goal) {
    throw new Error(`Failed to load persona config: SOUL_ID=${SOUL_ID}, GOAL_ID=${GOAL_ID}`);
  }
  
  const personaConfig = { soul, goal };
  
  // Build prompt (tool-specific logic)
  const prompt = buildPrompt(
    personaConfig,
    toolVariables,
    videoContext,
    dialogueContext,
    musicContext,
    previousState
  );
  
  // Return prompt and placeholder state
  // (Actual state will be computed after API response)
  return {
    prompt,
    state: previousState || {}
  };
}

/**
 * Format state after receiving API response
 * @param {Object} apiResponse - Parsed API response
 * @param {Object} previousState - Previous state
 * @returns {Object} New state
 */
function formatStateAfterResponse(apiResponse, previousState) {
  return formatState(apiResponse, previousState);
}

module.exports = {
  analyze,
  validateVariables,
  formatStateAfterResponse
};
