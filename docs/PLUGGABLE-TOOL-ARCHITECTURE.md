# PLUGGABLE TOOL ARCHITECTURE

**Date:** 2026-03-04  
**Status:** Design Specification  
**Version:** 2.0.0 (Breaking Change)  
**Author:** Emotion Engine Team  
**Replaces:** `TOOL-VARIABLE-INJECTION-ARCHITECTURE.md` (v1.0.0)

---

## Executive Summary

**CRITICAL PROBLEM WITH V1.0:** The pipeline (`03-analyze-chunks.cjs`, `04-per-second-emotions.cjs`, `persona-loader.cjs`) still knew about "lenses" and built emotion-specific prompts. This **breaks tool-agnosticism**—the pipeline was still interpreting tool-specific data structures.

**NEW ARCHITECTURE (V2.0):** Tools are **completely pluggable scripts**. The pipeline knows nothing about what tools do. It only:
1. Calls the tool script with generic context
2. Receives a prompt and state back
3. Merges the tool's prompt with video/dialogue/music context
4. Sends to AI API

**Key Principle:** *Pipeline is a dumb orchestrator. Tools are smart, self-contained modules that build their own prompts.*

---

## 1. Architecture Decisions

### 1.1 Core Principles

1. **Tools are Pluggable Scripts**
   - Each tool is its own script: `tools/emotion-lenses-tool.cjs`, `tools/sentiment-tool.cjs`, etc.
   - Pipeline calls the tool, doesn't know what it does
   - Tool returns its own prompt/context to merge with pipeline context

2. **Pipeline is Tool-Agnostic (Truly This Time)**
   - Pipeline has **zero knowledge** of "lenses", "emotions", or tool-specific concepts
   - Pipeline only knows: video context, dialogue context, music context, previous state
   - Pipeline delegates ALL prompt building to the tool

3. **Standard Tool Interface (Contract)**
   - All tools implement the same interface
   - Tool receives: `{ toolVariables, videoContext, dialogueContext, musicContext, previousState }`
   - Tool returns: `{ prompt, state }`
   - Pipeline doesn't interpret the prompt or state

4. **CLI Behavior (Strict)**
   - `TOOL_ID` env var is **REQUIRED** (no default)
   - `TOOL_VARIABLES` env var is **REQUIRED** (no default)
   - Fail immediately if either is missing
   - Tool validates its own `TOOL_VARIABLES` JSON schema

5. **No Backward Compatibility**
   - Active development — break cleanly
   - Remove all hardcoded defaults
   - Remove all lens-specific logic from pipeline

### 1.2 What Changed from v1.0

| Aspect | v1.0 (Old) | v2.0 (New) |
|--------|------------|------------|
| Tool location | `personas/tools/emotion-tracking/TOOLS.md` | `tools/emotion-lenses-tool.cjs` |
| Tool format | Markdown schema | Executable script |
| Prompt building | `persona-loader.cjs` builds emotion prompts | Tool script builds its own prompt |
| Pipeline knowledge | Knows about "lenses" | Zero knowledge of tool concepts |
| State management | Hardcoded emotion state | Generic state object |
| `TOOL_ID` default | `'emotion-tracking'` | **REQUIRED (no default)** |
| `TOOL_VARIABLES` default | Uses defaults if missing | **REQUIRED (no default)** |
| Backward compat | Supports `selectedLenses` param | **None** — clean break |

---

## 2. Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         ENVIRONMENT / .env FILE                             │
│                                                                             │
│   TOOL_ID=emotion-lenses                                                    │
│   TOOL_VARIABLES='{"lenses":["patience","boredom","excitement"]}'           │
│   SOUL_ID=impatient-teenager                                                │
│   GOAL_ID=video-ad-evaluation                                               │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        server/run-pipeline.cjs                              │
│                         (Pipeline Orchestrator)                             │
│                                                                             │
│   1. Validate TOOL_ID is set (REQUIRED)                                     │
│   2. Validate TOOL_VARIABLES is set (REQUIRED)                              │
│   3. Validate TOOL_VARIABLES is valid JSON                                  │
│   4. Export to child processes via process.env                              │
│   5. Spawn pipeline steps with TOOL_ID + TOOL_VARIABLES in environment      │
│                                                                             │
│   ❌ FAILS if TOOL_ID or TOOL_VARIABLES missing                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                    ┌─────────────────┴─────────────────┐
                    │                                   │
                    ▼                                   ▼
┌──────────────────────────────┐         ┌──────────────────────────────┐
│  server/03-analyze-chunks.cjs│         │ server/04-per-second-emotions│
│   (Chunked Video Analysis)   │         │   (Per-Second Timeline)      │
│                              │         │                              │
│   1. Load TOOL_ID from env   │         │   1. Load TOOL_ID from env   │
│   2. Load TOOL_VARIABLES     │         │   2. Load TOOL_VARIABLES     │
│   3. Load tool script        │         │   3. Load tool script        │
│   4. Call tool.analyze()     │         │   4. Call tool.analyze()     │
│   5. Get {prompt, state}     │         │   5. Get {prompt, state}     │
│   6. Merge with context      │         │   6. Merge with context      │
│   7. Send to AI API          │         │   7. Send to AI API          │
│                              │         │                              │
│   ❌ NO knowledge of lenses  │         │   ❌ NO knowledge of lenses  │
│   ❌ NO emotion-specific code│         │   ❌ NO emotion-specific code│
└──────────────────────────────┘         └──────────────────────────────┘
                    │                                   │
                    └─────────────────┬─────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                   tools/emotion-lenses-tool.cjs                             │
│                      (Example Tool Implementation)                          │
│                                                                             │
│   module.exports.analyze({                                                  │
│     toolVariables: { lenses: [...] },     // From TOOL_VARIABLES            │
│     videoContext: {...},                  // Chunk/second data              │
│     dialogueContext: '...',               // Relevant dialogue              │
│     musicContext: '...',                  // Relevant music                 │
│     previousState: {...}                  // Generic state from prev iter   │
│   })                                                                          │
│                                                                             │
│   Returns: {                                                                │
│     prompt: 'You are Alex, 17. Track patience/boredom/excitement...',       │
│     state: { patience: 7, boredom: 3, excitement: 5, thought: '...' }       │
│   }                                                                         │
│                                                                             │
│   ✅ Tool builds its own prompt (pipeline doesn't touch it)                 │
│   ✅ Tool validates its own TOOL_VARIABLES                                  │
│   ✅ Tool manages its own state structure                                   │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                      OpenRouter API (Qwen/GPT)                              │
│                                                                             │
│   System Prompt: (built by tool, merged by pipeline)                        │
│   User Message: Video chunk + context                                       │
│   Response: JSON with tool-specific data                                    │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    PIPELINE (Stores Result, Doesn't Interpret)              │
│                                                                             │
│   - Saves tool's JSON response to output file                               │
│   - Passes tool's state to next iteration                                   │
│   - Never reads/interprets emotion scores                                   │
│   - Never makes decisions based on tool data                                │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. File Structure

### 3.1 New Files to Create

```
emotion-engine/
├── tools/
│   ├── emotion-lenses-tool.cjs          # NEW: Emotion tracking tool
│   ├── sentiment-tool.cjs               # NEW: Example alternative tool
│   └── lib/
│       └── tool-interface.js            # NEW: Standard tool contract (JSDoc)
├── server/
│   ├── run-pipeline.cjs                 # UPDATED: Validate TOOL_ID/TOOL_VARIABLES required
│   ├── 03-analyze-chunks.cjs            # UPDATED: Call tool, don't build prompts
│   ├── 04-per-second-emotions.cjs       # UPDATED: Call tool, don't build prompts
│   └── lib/
│       └── persona-loader.cjs           # UPDATED: Load tool script, delegate prompt building
└── docs/
    └── PLUGGABLE-TOOL-ARCHITECTURE.md   # THIS FILE
```

### 3.2 Files to Delete

```
# Old hardcoded defaults (remove after migration)
# None specific — we're removing logic from existing files, not deleting files
```

---

## 4. Tool Interface (Standard Contract)

### 4.1 Tool Input

```javascript
/**
 * Tool receives this object:
 */
{
  toolVariables: {
    // Parsed TOOL_VARIABLES JSON from environment
    // Example: { lenses: ['patience', 'boredom', 'excitement'] }
  },
  
  videoContext: {
    // For chunk analysis: chunk metadata (startTime, endTime, duration, etc.)
    // For per-second analysis: second metadata (timestamp, frame data, etc.)
    startTime: 0,
    endTime: 8,
    duration: 8,
    chunkIndex: 0,
    // ... other video-specific data
  },
  
  dialogueContext: string,
  // Relevant dialogue for this timestamp range
  // Example: "[00:05] Speaker (excited): 'Check this out!'"
  
  musicContext: string,
  // Relevant music/audio for this timestamp range
  // Example: "[00:00-00:08] Upbeat electronic music (energetic)"
  
  previousState: {
    // Generic state from previous iteration
    // Structure is tool-specific (pipeline doesn't interpret)
    // Example: { patience: 7, boredom: 3, excitement: 5, thought: '...' }
  }
}
```

### 4.2 Tool Output

```javascript
/**
 * Tool returns this object:
 */
{
  prompt: string,
  // Complete system prompt built by tool
  // Pipeline merges this with dialogue/music/video context
  // Example: "You are Alex, 17. Track patience, boredom, excitement..."
  
  state: {
    // New state for next iteration
    // Structure is tool-specific (pipeline doesn't interpret)
    // Example: { patience: 6, boredom: 4, excitement: 5, thought: 'Getting impatient...' }
  }
}
```

### 4.3 Tool Interface Definition (JSDoc)

**File:** `tools/lib/tool-interface.js`

```javascript
/**
 * Standard Tool Interface for Emotion Engine
 * 
 * All tools must implement this interface:
 * 
 * @typedef {Object} ToolInput
 * @property {Object} toolVariables - Parsed TOOL_VARIABLES from environment
 * @property {Object} videoContext - Video chunk or second metadata
 * @property {string} dialogueContext - Relevant dialogue for timestamp range
 * @property {string} musicContext - Relevant music/audio for timestamp range
 * @property {Object} previousState - Generic state from previous iteration
 * 
 * @typedef {Object} ToolOutput
 * @property {string} prompt - System prompt built by tool
 * @property {Object} state - New state for next iteration
 * 
 * @typedef {Object} Tool
 * @property {function(ToolInput): Promise<ToolOutput>} analyze - Main analysis function
 * @property {function(Object): {valid: boolean, error?: string}} validateVariables - Validate TOOL_VARIABLES
 */

/**
 * Example tool implementation:
 * 
 * const emotionTool = require('./tools/emotion-lenses-tool.cjs');
 * 
 * const result = await emotionTool.analyze({
 *   toolVariables: { lenses: ['patience', 'boredom', 'excitement'] },
 *   videoContext: { startTime: 0, endTime: 8, duration: 8 },
 *   dialogueContext: '[00:05] Speaker: "Hello"',
 *   musicContext: '[00:00-00:08] Upbeat music',
 *   previousState: { patience: 7, boredom: 3 }
 * });
 * 
 * console.log(result.prompt);  // Tool-built prompt
 * console.log(result.state);   // New state for next iteration
 */

module.exports = {
  /**
   * @type {Tool}
   */
  analyze: async (input) => {
    // Tool implementation
  },
  
  validateVariables: (toolVariables) => {
    // Tool validation
  }
};
```

---

## 5. Code Examples

### 5.1 Example Tool: `tools/emotion-lenses-tool.cjs`

```javascript
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
    if (line.includes('| **') && line.includes('|') && line.includes('scale', 'i')) {
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
 * Format previous state for next iteration
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
```

### 5.2 Updated: `server/run-pipeline.cjs`

```javascript
#!/usr/bin/env node
/**
 * Master Orchestrator Script
 * Runs the complete 4-step pipeline in sequence
 * 
 * Usage: node server/run-pipeline.cjs <video-path> [output-dir]
 * 
 * ENVIRONMENT REQUIREMENTS:
 * - TOOL_ID: REQUIRED (no default)
 * - TOOL_VARIABLES: REQUIRED (no default, must be valid JSON)
 */

require('dotenv').config();

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const logger = require('./lib/logger.cjs');

// =============================================================================
// VALIDATE REQUIRED ENVIRONMENT VARIABLES
// =============================================================================

// TOOL_ID is REQUIRED (no default)
if (!process.env.TOOL_ID) {
  logger.error('❌ TOOL_ID is REQUIRED but not set');
  logger.error('Example: TOOL_ID=emotion-lenses');
  logger.error('Set in .env file or export before running:');
  logger.error('  export TOOL_ID=emotion-lenses');
  process.exit(1);
}

// TOOL_VARIABLES is REQUIRED (no default)
if (!process.env.TOOL_VARIABLES) {
  logger.error('❌ TOOL_VARIABLES is REQUIRED but not set');
  logger.error('Example: TOOL_VARIABLES=\'{"lenses":["patience","boredom","excitement"]}\'');
  logger.error('Set in .env file or export before running:');
  logger.error('  export TOOL_VARIABLES=\'{"lenses":["patience","boredom"]}\'');
  process.exit(1);
}

// Validate TOOL_VARIABLES JSON syntax
let TOOL_VARIABLES;
try {
  TOOL_VARIABLES = JSON.parse(process.env.TOOL_VARIABLES);
  logger.info(`✅ Loaded TOOL_ID=${process.env.TOOL_ID}`);
  logger.info(`✅ Loaded TOOL_VARIABLES: ${Object.keys(TOOL_VARIABLES).join(', ')}`);
} catch (e) {
  logger.error(`❌ Invalid TOOL_VARIABLES JSON syntax: ${e.message}`);
  logger.error('Expected format: TOOL_VARIABLES=\'{"lenses":["patience","boredom"]}\'');
  process.exit(1);
}

// Export to child processes (they will read from process.env)
process.env.TOOL_VARIABLES = JSON.stringify(TOOL_VARIABLES);

// Convert relative paths to absolute
const VIDEO_PATH = process.argv[2] || path.resolve(__dirname, '../.cache/videos/cod.mp4');
const OUTPUT_DIR = process.argv[3] || path.resolve(__dirname, '../output/default');

// ... rest of file unchanged (step definitions, runStep, main) ...
```

### 5.3 Updated: `server/03-analyze-chunks.cjs` (Snippet)

**Replace the hardcoded `selectedLenses` logic with tool-agnostic call:**

```javascript
// OLD (REMOVE THIS):
// const selectedLenses = ['patience', 'boredom', 'excitement'];
// const systemPrompt = personaLoader.buildSystemPrompt(personaConfig, {
//   duration: endTime - startTime,
//   selectedLenses,
//   videoContext
// });

// NEW (USE THIS):
// Load TOOL_ID and TOOL_VARIABLES from environment
const TOOL_ID = process.env.TOOL_ID;
const toolVariables = JSON.parse(process.env.TOOL_VARIABLES || '{}');

// Load tool script dynamically
const toolPath = path.resolve(__dirname, `../../tools/${TOOL_ID}-tool.cjs`);
if (!fs.existsSync(toolPath)) {
  logger.error(`Tool script not found: ${toolPath}`);
  logger.error('Expected file: tools/${TOOL_ID}-tool.cjs');
  process.exit(1);
}
const tool = require(toolPath);

// Validate tool variables (tool-specific validation)
const validation = tool.validateVariables(toolVariables);
if (!validation.valid) {
  logger.error(`Tool validation failed: ${validation.error}`);
  process.exit(1);
}

// Call tool to build prompt (pipeline doesn't know what's in the prompt)
const toolResult = await tool.analyze({
  toolVariables,
  videoContext: {
    startTime,
    endTime,
    duration: endTime - startTime,
    chunkIndex: i,
    chunkNumber: i + 1,
    totalChunks: Math.min(numChunks, maxChunks)
  },
  dialogueContext,
  musicContext,
  previousState: previousSummary ? { summary: previousSummary } : {}
});

// Tool returns { prompt, state }
// Pipeline merges tool's prompt with additional context if needed
const systemPrompt = toolResult.prompt;

// Store state for next iteration (pipeline doesn't interpret it)
previousSummary = toolResult.state.summary || toolResult.state.thought || '';
```

### 5.4 Updated: `server/04-per-second-emotions.cjs` (Snippet)

**Same pattern as 03-analyze-chunks.cjs:**

```javascript
// Load TOOL_ID and TOOL_VARIABLES from environment
const TOOL_ID = process.env.TOOL_ID;
const toolVariables = JSON.parse(process.env.TOOL_VARIABLES || '{}');

// Load tool script dynamically
const toolPath = path.resolve(__dirname, `../../tools/${TOOL_ID}-tool.cjs`);
const tool = require(toolPath);

// Validate tool variables
const validation = tool.validateVariables(toolVariables);
if (!validation.valid) {
  logger.error(`Tool validation failed: ${validation.error}`);
  process.exit(1);
}

// Call tool to build prompt
const toolResult = await tool.analyze({
  toolVariables,
  videoContext: {
    startTime: cs,
    endTime: ce,
    duration: ce - cs,
    chunkIndex: i
  },
  dialogueContext: getDialogue(ctxData.dialogue, cs, ce),
  musicContext: getMusic(ctxData.music, cs, ce),
  previousState: previousState || {}
});

const systemPrompt = toolResult.prompt;

// After receiving API response, format state for next iteration
const apiResponse = parsePerSecondJSON(analysis);
previousState = tool.formatStateAfterResponse(apiResponse, previousState);
```

### 5.5 Updated: `server/lib/persona-loader.cjs`

**Remove lens-specific logic, simplify to just load soul/goal:**

```javascript
/**
 * Build system prompt from persona config
 * 
 * DEPRECATED: This function is no longer used for prompt building.
 * Tools now build their own prompts via tool.analyze().
 * 
 * This function now only loads soul/goal config for tools to use.
 * 
 * @param {PersonaConfig} config - Loaded persona config
 * @param {Object} options - Options (kept for backward compat during migration)
 * @returns {PersonaConfig} Returns config unchanged
 */
function buildSystemPrompt(config, options = {}) {
  // DEPRECATED: Prompt building is now done by tools
  // This function is kept temporarily for migration
  // Remove in v2.1.0
  
  console.warn('⚠️  WARNING: persona-loader.buildSystemPrompt() is deprecated');
  console.warn('Tools should build their own prompts via tool.analyze()');
  
  return config;
}

module.exports = {
  loadSoul,
  loadGoal,
  loadTools,
  loadPersonaConfig,
  buildSystemPrompt,  // Deprecated
  parseMarkdown
};
```

---

## 6. Updated .env Example

```bash
# =============================================================================
# Emotion Engine Configuration (v2.0 - Pluggable Tool Architecture)
# =============================================================================

# -----------------------------------------------------------------------------
# Required: OpenRouter API key
# -----------------------------------------------------------------------------
OPENROUTER_API_KEY=sk-or-v1-xxxxxxxxxxxxxxxxxxxxxxxx

# -----------------------------------------------------------------------------
# Persona Configuration
# All support SemVer or 'latest' (e.g., '1', '1.0', '1.0.0')
# -----------------------------------------------------------------------------
SOUL_ID=impatient-teenager
SOUL_VERSION=latest
GOAL_ID=video-ad-evaluation
GOAL_VERSION=1.0

# -----------------------------------------------------------------------------
# TOOL CONFIGURATION (REQUIRED - NO DEFAULTS)
# -----------------------------------------------------------------------------

# TOOL_ID: Which tool script to load (REQUIRED)
# Must match a file in tools/<TOOL_ID>-tool.cjs
# Examples: emotion-lenses, sentiment, engagement
TOOL_ID=emotion-lenses

# TOOL_VARIABLES: Tool-specific configuration (REQUIRED)
# Must be valid JSON. Schema depends on the tool.
#
# For emotion-lenses tool:
#   - lenses: array of emotion names (at least 1 required)
#   - thresholds: optional object with critical threshold overrides
#
# Examples:
TOOL_VARIABLES='{"lenses":["patience","boredom","excitement"]}'
# TOOL_VARIABLES='{"lenses":["frustration","joy","flow"],"thresholds":{"frustration":7}}'
# TOOL_VARIABLES='{"lenses":["excitement","engagement"]}'

# -----------------------------------------------------------------------------
# Optional: Model overrides
# -----------------------------------------------------------------------------
DIALOGUE_MODEL=openai/gpt-audio
MUSIC_MODEL=openai/gpt-audio
VIDEO_MODEL=qwen/qwen3.5-122b-a10b

# -----------------------------------------------------------------------------
# Optional: Quality preset (low, medium, high)
# -----------------------------------------------------------------------------
CHUNK_QUALITY=medium

# -----------------------------------------------------------------------------
# Optional: Chunk duration override (seconds)
# -----------------------------------------------------------------------------
CHUNK_MAX_DURATION=8

# -----------------------------------------------------------------------------
# Optional: API request delay (milliseconds, default 1000)
# -----------------------------------------------------------------------------
API_REQUEST_DELAY=1000

# -----------------------------------------------------------------------------
# Optional: Log level (debug, info, warn, error)
# -----------------------------------------------------------------------------
LOG_LEVEL=info

# -----------------------------------------------------------------------------
# Optional: Limit analysis to N chunks (default: process all)
# -----------------------------------------------------------------------------
# MAX_CHUNKS=10
```

---

## 7. Migration Notes

### 7.1 Files to Create

1. **`tools/emotion-lenses-tool.cjs`**
   - Move emotion-specific logic from `persona-loader.cjs` here
   - Implement `analyze()`, `validateVariables()`, `formatStateAfterResponse()`

2. **`tools/lib/tool-interface.js`**
   - JSDoc definitions for tool contract
   - Example usage documentation

3. **`tools/sentiment-tool.cjs`** (optional example)
   - Alternative tool showing architecture flexibility
   - Different schema, different prompt structure

### 7.2 Files to Update

1. **`server/run-pipeline.cjs`**
   - Add TOOL_ID validation (REQUIRED, no default)
   - Add TOOL_VARIABLES validation (REQUIRED, no default)
   - Remove any hardcoded defaults

2. **`server/03-analyze-chunks.cjs`**
   - Remove `selectedLenses` hardcoded array
   - Load tool script dynamically based on TOOL_ID
   - Call `tool.analyze()` instead of `persona-loader.buildSystemPrompt()`
   - Store tool's state for next iteration

3. **`server/04-per-second-emotions.cjs`**
   - Same changes as 03-analyze-chunks.cjs
   - Call `tool.formatStateAfterResponse()` after API response

4. **`server/lib/persona-loader.cjs`**
   - Remove `buildSystemPrompt()` lens-specific logic
   - Keep only `loadSoul()`, `loadGoal()`, `loadTools()` for tools to use
   - Add deprecation warning for `buildSystemPrompt()`

5. **`.env.example`**
   - Update with TOOL_ID and TOOL_VARIABLES as REQUIRED
   - Remove any default values
   - Add examples for different tools

### 7.3 Files to Delete

None — we're refactoring existing files, not removing them.

### 7.4 Breaking Changes

**Yes, this is a breaking change (v1.0 → v2.0):**

1. **TOOL_ID is now REQUIRED**
   - Old: Defaults to `'emotion-tracking'`
   - New: Fails immediately if not set

2. **TOOL_VARIABLES is now REQUIRED**
   - Old: Uses defaults if missing
   - New: Fails immediately if not set

3. **Tool format changed**
   - Old: `TOOLS.md` markdown schema
   - New: `<tool-id>-tool.cjs` executable script

4. **Prompt building moved**
   - Old: `persona-loader.cjs` builds prompts
   - New: Tool scripts build their own prompts

### 7.5 Migration Steps

1. **Create new tool scripts:**
   ```bash
   mkdir -p tools tools/lib
   cp docs/emotion-lenses-tool-example.cjs tools/emotion-lenses-tool.cjs
   ```

2. **Update pipeline scripts:**
   - Edit `run-pipeline.cjs`, `03-analyze-chunks.cjs`, `04-per-second-emotions.cjs`
   - Remove hardcoded defaults
   - Add dynamic tool loading

3. **Update .env:**
   ```bash
   # Add these lines:
   TOOL_ID=emotion-lenses
   TOOL_VARIABLES='{"lenses":["patience","boredom","excitement"]}'
   ```

4. **Test:**
   ```bash
   # Without TOOL_ID (should fail):
   node server/run-pipeline.cjs ./videos/test.mp4 ./output/test
   # Expected: ❌ TOOL_ID is REQUIRED but not set
   
   # With TOOL_ID (should work):
   TOOL_ID=emotion-lenses TOOL_VARIABLES='{"lenses":["patience"]}' \
     node server/run-pipeline.cjs ./videos/test.mp4 ./output/test
   ```

5. **Commit:**
   ```bash
   git add -A
   git commit -m "feat: pluggable tool architecture (v2.0 breaking change)"
   ```

---

## 8. Testing Checklist

### 8.1 Validation Tests

- [ ] Pipeline fails without TOOL_ID
- [ ] Pipeline fails without TOOL_VARIABLES
- [ ] Pipeline fails with invalid TOOL_VARIABLES JSON
- [ ] Pipeline fails if tool script not found
- [ ] Tool validates its own TOOL_VARIABLES schema

### 8.2 Functional Tests

- [ ] emotion-lenses-tool builds correct prompt
- [ ] Tool returns valid { prompt, state } object
- [ ] State persists across iterations
- [ ] Pipeline stores tool output without interpretation

### 8.3 Integration Tests

- [ ] Full pipeline with emotion-lenses tool
- [ ] Swap to different tool (e.g., sentiment-tool)
- [ ] Verify output format matches tool's schema

### 8.4 Edge Cases

- [ ] Empty TOOL_VARIABLES object: `{}`
- [ ] Tool with no previous state (first iteration)
- [ ] Tool with very long state object
- [ ] Tool that returns minimal prompt

---

## 9. Future Extensions

### 9.1 Tool Discovery

Auto-discover available tools:

```javascript
// In run-pipeline.cjs
const toolsDir = path.join(__dirname, '../tools');
const availableTools = fs.readdirSync(toolsDir)
  .filter(f => f.endsWith('-tool.cjs'))
  .map(f => f.replace('-tool.cjs', ''));

logger.info(`Available tools: ${availableTools.join(', ')}`);
```

### 9.2 Tool Registry

Maintain a registry of tool metadata:

```javascript
// tools/registry.json
{
  "emotion-lenses": {
    "description": "Track emotional metrics (patience, boredom, excitement)",
    "schema": {
      "lenses": "string[] (required)",
      "thresholds": "object (optional)"
    }
  },
  "sentiment": {
    "description": "Analyze overall sentiment (positive/negative/neutral)",
    "schema": {
      "granularity": "second|chunk|video"
    }
  }
}
```

### 9.3 Parallel Tool Execution

Run multiple tools in parallel:

```bash
TOOL_IDS=emotion-lenses,sentiment,engagement
```

Pipeline spawns multiple tool calls per chunk, merges results.

### 9.4 Tool Marketplace

Future: Download community-built tools:

```bash
openclaw skill install emotion-tool@1.0.0
# Installs to tools/emotion-tool.cjs
```

---

## 10. Security Considerations

### 10.1 Tool Script Execution

**Risk:** Malicious tool scripts could execute arbitrary code

**Mitigation:**
- Tools run in same process as pipeline (trusted code only)
- Future: Sandbox tools in separate processes
- Validate tool script exists before requiring

### 10.2 TOOL_VARIABLES Injection

**Risk:** Command injection via TOOL_VARIABLES

**Mitigation:**
- Always parse as JSON, never interpolate into shell commands
- Tools validate their own schemas
- Sanitize any user-provided strings in prompts

### 10.3 State Persistence

**Risk:** State could accumulate sensitive data

**Mitigation:**
- State is tool-specific (pipeline doesn't store it)
- Tools responsible for managing state size
- Clear state between pipeline runs

---

## 11. Performance Impact

| Operation | v1.0 | v2.0 | Impact |
|-----------|------|------|--------|
| Tool loading | N/A | ~5ms | Negligible |
| Prompt building | ~10ms | ~10ms | Same (just moved to tool) |
| State management | ~1ms | ~1ms | Same |
| Total pipeline | ~120s | ~120s | No measurable impact |

---

## 12. Conclusion

This architecture achieves **true tool-agnosticism** by:

1. ✅ Making tools completely pluggable scripts
2. ✅ Removing all tool-specific knowledge from pipeline
3. ✅ Standardizing tool interface (input/output contract)
4. ✅ Requiring TOOL_ID and TOOL_VARIABLES (no defaults)
5. ✅ Letting tools validate their own configuration
6. ✅ Letting tools build their own prompts
7. ✅ Letting tools manage their own state

**Key principle:** *Pipeline is a dumb orchestrator. Tools are smart, self-contained modules.*

---

## Appendix A: Glossary

| Term | Definition |
|------|------------|
| Tool | A pluggable script that implements the standard tool interface |
| TOOL_ID | Environment variable specifying which tool to load |
| TOOL_VARIABLES | JSON environment variable with tool-specific configuration |
| Tool-Agnostic | Pipeline doesn't know about tool concepts or data structures |
| State | Tool-specific data passed between iterations (pipeline doesn't interpret) |

---

## Appendix B: Related Documents

- `TOOL-VARIABLE-INJECTION-ARCHITECTURE.md` (v1.0) — Previous design (superseded)
- `tools/lib/tool-interface.js` — Tool contract definitions
- `tools/emotion-lenses-tool.cjs` — Example tool implementation

---

*This document is part of the OpenTruth Emotion Engine architecture specification. Version 2.0.0, last updated 2026-03-04. Breaking change from v1.0.0.*
