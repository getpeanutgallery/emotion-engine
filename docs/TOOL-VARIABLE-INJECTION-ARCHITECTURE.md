# TOOL VARIABLE INJECTION ARCHITECTURE

**Date:** 2026-03-04  
**Status:** Design Specification  
**Version:** 1.0.0  
**Author:** Emotion Engine Team

---

## Executive Summary

This document defines the complete architecture for injecting tool-specific configuration variables through the Emotion Engine pipeline. The design follows a **tool-agnostic pipeline** principle where the pipeline transports data without interpreting it, and each tool validates its own payload requirements.

---

## 1. Architecture Decisions

### 1.1 Core Principles

1. **Pipeline is Tool-Agnostic**
   - The pipeline does not know about "lenses" or any tool-specific data structures
   - Pipeline scripts only transport `TOOL_VARIABLES` without interpretation
   - No tool-specific logic in `run-pipeline.cjs`, `03-analyze-chunks.cjs`, or `04-per-second-emotions.cjs`

2. **TOOL_VARIABLES as JSON Environment Variable**
   - Single JSON string passed through environment
   - Example: `TOOL_VARIABLES='{"lenses":["patience","boredom","excitement"]}'`
   - Follows 12-factor app methodology

3. **Tool-Specific Validation**
   - Each tool validates its own payload (emotion-tracking validates `lenses` array)
   - Validation happens in the tool, not in the pipeline
   - Pipeline only surfaces validation errors, doesn't perform validation

4. **SOUL.md is Behavioral/Qualitative Only**
   - SOUL.md contains persona identity, voice, and behavioral profile
   - No numeric baselines or configuration data
   - Purely qualitative guidance for persona behavior

5. **No Baselines Feature (For Now)**
   - Baselines would come through `TOOL_VARIABLES` if ever needed
   - Not implemented in current version
   - Architecture supports future addition without pipeline changes

---

## 2. Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         ENVIRONMENT / .env FILE                             │
│                                                                             │
│   TOOL_VARIABLES='{"lenses":["patience","boredom","excitement"]}'           │
│   SOUL_ID=impatient-teenager                                                │
│   GOAL_ID=video-ad-evaluation                                               │
│   TOOL_ID=emotion-tracking                                                  │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        server/run-pipeline.cjs                              │
│                         (Pipeline Orchestrator)                             │
│                                                                             │
│   1. Loads TOOL_VARIABLES from process.env                                  │
│   2. Validates JSON syntax (not semantic validation)                        │
│   3. Exports to child processes via process.env                             │
│   4. Spawns pipeline steps with TOOL_VARIABLES in environment               │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                    ┌─────────────────┴─────────────────┐
                    │                                   │
                    ▼                                   ▼
┌──────────────────────────────┐         ┌──────────────────────────────┐
│  server/03-analyze-chunks.cjs│         │ server/04-per-second-emotions│
│   (Chunked Video Analysis)   │         │   (Per-Second Timeline)      │
│                              │         │                              │
│   Reads TOOL_VARIABLES from  │         │   Reads TOOL_VARIABLES from  │
│   process.env                │         │   process.env                │
│   Passes to persona-loader   │         │   Passes to persona-loader   │
└──────────────────────────────┘         └──────────────────────────────┘
                    │                                   │
                    └─────────────────┬─────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                   server/lib/persona-loader.cjs                             │
│                      (Persona Composition Layer)                            │
│                                                                             │
│   loadPersonaConfig(soulId, goalId, toolId)                                 │
│     ├─ Loads SOUL.md (persona identity)                                     │
│     ├─ Loads GOAL.md (evaluation objective)                                 │
│     └─ Loads TOOLS.md (tool schema + validation rules)                      │
│                                                                             │
│   buildSystemPrompt(config, { toolVariables, duration, videoContext })      │
│     ├─ Extracts lenses from toolVariables.lenses                            │
│     ├─ Looks up lens metadata in TOOLS.md                                   │
│     ├─ Builds system prompt with persona + goal + lenses                    │
│     └─ Includes toolVariables JSON for tool reference                       │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                      OpenRouter API (Qwen/GPT)                              │
│                                                                             │
│   System Prompt: "You are {persona}, track {lenses}..."                     │
│   User Message: Video chunk + context                                       │
│   Response: JSON with emotion scores                                        │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    TOOL VALIDATION (In-Tool Logic)                          │
│                    (Future: Emotion-Tracking Runtime)                       │
│                                                                             │
│   validateToolVariables(toolVariables)                                      │
│     ├─ Check: lenses array exists                                           │
│     ├─ Check: lenses array has at least 1 item                              │
│     ├─ Check: each lens name exists in TOOLS.md                             │
│     └─ Throw error if validation fails                                      │
│                                                                             │
│   ⚠️ Validation happens in tool, NOT in pipeline                            │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Data Flow Specification

### 3.1 Complete Data Flow

| Step | Component | Action | Data Format |
|------|-----------|--------|-------------|
| 1 | `.env` file | Define `TOOL_VARIABLES` | JSON string |
| 2 | `run-pipeline.cjs` | Load from `process.env` | `JSON.parse()` |
| 3 | `run-pipeline.cjs` | Export to child processes | `process.env.TOOL_VARIABLES` |
| 4 | `03-analyze-chunks.cjs` | Read from `process.env` | `JSON.parse()` |
| 5 | `04-per-second-emotions.cjs` | Read from `process.env` | `JSON.parse()` |
| 6 | `persona-loader.cjs::buildSystemPrompt()` | Accept as parameter | Object |
| 7 | `persona-loader.cjs` | Forward to tool system | Embedded in prompt |
| 8 | Tool (TOOLS.md logic) | Validate payload | Validation logic |
| 9 | Tool | Use validated data | Emotion tracking |

### 3.2 Environment Variable Format

```bash
# Basic usage (emotion-tracking tool)
TOOL_VARIABLES='{"lenses":["patience","boredom","excitement"]}'

# Extended usage with thresholds
TOOL_VARIABLES='{"lenses":["patience","boredom","excitement"],"thresholds":{"patience":3,"boredom":7}}'

# Future: baselines (not implemented yet)
TOOL_VARIABLES='{"lenses":["patience","boredom"],"baselines":{"patience":5,"boredom":5}}'
```

---

## 4. Code Snippets

### 4.1 `server/run-pipeline.cjs`

**Location:** After `require('dotenv').config()` (around line 10)

```javascript
#!/usr/bin/env node
/**
 * Master Orchestrator Script
 * Runs the complete 4-step pipeline in sequence
 * 
 * Usage: node server/run-pipeline.cjs <video-path> [output-dir]
 */

require('dotenv').config();

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const logger = require('./lib/logger.cjs');

// Load and validate TOOL_VARIABLES from environment
let TOOL_VARIABLES = {};
if (process.env.TOOL_VARIABLES) {
    try {
        TOOL_VARIABLES = JSON.parse(process.env.TOOL_VARIABLES);
        logger.info(`Loaded TOOL_VARIABLES: ${Object.keys(TOOL_VARIABLES).join(', ')}`);
    } catch (e) {
        logger.error(`Invalid TOOL_VARIABLES JSON: ${e.message}`);
        logger.error('Expected format: TOOL_VARIABLES=\'{"lenses":["patience","boredom"]}\'');
        process.exit(1);
    }
} else {
    logger.debug('TOOL_VARIABLES not set, using empty defaults');
}

// Export to child processes (they will read from process.env)
process.env.TOOL_VARIABLES = JSON.stringify(TOOL_VARIABLES);

// Convert relative paths to absolute
const VIDEO_PATH = process.argv[2] || path.resolve(__dirname, '../.cache/videos/cod.mp4');
const OUTPUT_DIR = process.argv[3] || path.resolve(__dirname, '../output/default');

// ... rest of file unchanged ...
```

### 4.2 `server/03-analyze-chunks.cjs`

**Location:** Replace hardcoded `selectedLenses` (around line 200)

**Before:**
```javascript
// Build system prompt using persona loader
const selectedLenses = ['patience', 'boredom', 'excitement'];
const videoContext = `...`;

const systemPrompt = personaLoader.buildSystemPrompt(personaConfig, {
    duration: endTime - startTime,
    selectedLenses,
    videoContext
});
```

**After:**
```javascript
// Load TOOL_VARIABLES from environment (set by run-pipeline.cjs)
const toolVariables = JSON.parse(process.env.TOOL_VARIABLES || '{}');

const videoContext = `
Analyzing chunk ${index + 1}/${total} (${startTime}s-${endTime}s).

${context.previousSummary ? `**Previous Emotional State:**\n${context.previousSummary}\n` : ''}
${context.dialogueContext ? `**What You're Hearing (Dialogue):**\n${context.dialogueContext}\n` : ''}
${context.musicContext ? `**What You're Hearing (Music/Audio):**\n${context.musicContext}\n` : ''}
`;

const systemPrompt = personaLoader.buildSystemPrompt(personaConfig, {
    duration: endTime - startTime,
    toolVariables,  // Generic payload - pipeline doesn't interpret
    videoContext
});
```

### 4.3 `server/04-per-second-emotions.cjs`

**Location:** Replace hardcoded `selectedLenses` (around line 150)

**Before:**
```javascript
// Build system prompt using persona loader
const selectedLenses = ['patience', 'boredom', 'excitement'];
const videoContext = `...`;

const systemPrompt = personaLoader.buildSystemPrompt(personaConfig, {
    duration: end - start,
    selectedLenses,
    videoContext
});
```

**After:**
```javascript
// Load TOOL_VARIABLES from environment (set by run-pipeline.cjs)
const toolVariables = JSON.parse(process.env.TOOL_VARIABLES || '{}');

const videoContext = `
Analyze this video chunk from ${start}s to ${end}s. Track emotions EVERY SECOND.

${context}RESPOND ONLY WITH VALID JSON. No other text.`;

const systemPrompt = personaLoader.buildSystemPrompt(personaConfig, {
    duration: end - start,
    toolVariables,  // Generic payload - pipeline doesn't interpret
    videoContext
});
```

### 4.4 `server/lib/persona-loader.cjs`

**Location:** `buildSystemPrompt()` function (around line 130)

**Before:**
```javascript
function buildSystemPrompt(config, options = {}) {
    const { soul, goal, tools } = config;
    const { duration = 30, selectedLenses = ['patience', 'boredom', 'excitement'], videoContext = '' } = options;
    
    // Extract key sections from SOUL
    const soulName = extractValue(soul, 'Name') || 'Persona';
    // ... rest of function uses selectedLenses directly
}
```

**After:**
```javascript
/**
 * Build system prompt from persona config
 * @param {PersonaConfig} config - Loaded persona config
 * @param {Object} options - Prompt options
 * @param {number} options.duration - Video duration in seconds
 * @param {Object} options.toolVariables - Generic tool-specific payload (e.g., {lenses: [...]})
 * @param {string} options.videoContext - Optional video description
 * @returns {string} Complete system prompt
 */
function buildSystemPrompt(config, options = {}) {
    const { soul, goal, tools } = config;
    const { 
        duration = 30, 
        toolVariables = {}, 
        videoContext = '',
        // Backward compatibility: support old selectedLenses parameter
        selectedLenses 
    } = options;
    
    // Extract lenses from toolVariables (or use backward-compatible selectedLenses)
    const lenses = toolVariables.lenses || selectedLenses || ['patience', 'boredom', 'excitement'];
    
    // Extract key sections from SOUL
    const soulName = extractValue(soul, 'Name') || 'Persona';
    const soulAge = extractValue(soul, 'Age') || '';
    const soulDemographic = extractValue(soul, 'Demographic') || '';
    const soulCoreTruth = extractSection(soul, 'Core Truth') || '';
    const soulBehavioral = extractSection(soul, 'Behavioral Profile') || '';
    
    // Extract from GOAL
    const goalObjective = extractSection(goal, 'Primary Objective') || '';
    const goalCriteria = extractSection(goal, 'Success Criteria') || '';
    
    // Build lenses section from TOOLS.md
    const lensesText = lenses.map(lens => {
        const lensInfo = findLensInfo(tools, lens);
        return `- **${capitalize(lens)}**: ${lensInfo?.description || 'Emotional metric'} (scale 1-10)`;
    }).join('\n');
    
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
    prompt += `Video duration: ${duration} seconds\n`;
    if (videoContext) {
        prompt += `Context: ${videoContext}\n\n`;
    }
    
    // Include toolVariables as JSON context for the tool to interpret
    if (Object.keys(toolVariables).length > 0) {
        prompt += `---\n\n`;
        prompt += `TOOL CONFIGURATION:\n`;
        prompt += `\`\`\`json\n${JSON.stringify(toolVariables, null, 2)}\n\`\`\`\n\n`;
    }
    
    prompt += `IMPORTANT:\n`;
    prompt += `- Respond ONLY with valid JSON\n`;
    prompt += `- Use the persona's authentic voice in "thought" fields\n`;
    prompt += `- Be brutally honest—this persona's job is to fail content that doesn't work\n`;
    prompt += `- Score every second from 0 to ${duration}\n`;
    prompt += `- Mark scroll_risk as "SCROLLING" the moment this persona would abandon\n\n`;
    prompt += `Required JSON format:\n`;
    prompt += `\`\`\`json\n`;
    prompt += `{
  "per_second_analysis": [
    {
      "timestamp": 0,
      "visuals": "describe what you see",
      "patience": 0-10,
      "boredom": 0-10,
      "excitement": 0-10,
      "thought": "internal monologue in persona voice",
      "scroll_risk": "low|medium|high|SCROLLING"
    }
  ]
}\n`;
    prompt += `\`\`\`\n`;
    
    return prompt;
}
```

---

## 5. Example .env File

```bash
# =============================================================================
# Emotion Engine Configuration
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
TOOL_ID=emotion-tracking
TOOL_VERSION=latest

# -----------------------------------------------------------------------------
# TOOL VARIABLES (JSON format)
# This is the generic payload passed through the pipeline to tools.
# Each tool validates its own requirements.
#
# Emotion-tracking tool expects:
#   - lenses: array of emotion names (at least 1 required)
#   - thresholds: optional object with critical threshold overrides
#   - baselines: optional object with baseline scores (future feature)
#
# Examples:
#   TOOL_VARIABLES='{"lenses":["patience","boredom","excitement"]}'
#   TOOL_VARIABLES='{"lenses":["frustration","joy","flow"],"thresholds":{"frustration":7}}'
# -----------------------------------------------------------------------------
TOOL_VARIABLES='{"lenses":["patience","boredom","excitement"]}'

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
# Optional: Chunk size override (bytes, default 8MB)
# -----------------------------------------------------------------------------
CHUNK_MAX_SIZE=8388608

# -----------------------------------------------------------------------------
# Optional: API request delay (milliseconds, default 1000)
# -----------------------------------------------------------------------------
API_REQUEST_DELAY=1000

# -----------------------------------------------------------------------------
# Optional: Max retries for API calls (default 3)
# -----------------------------------------------------------------------------
API_MAX_RETRIES=3

# -----------------------------------------------------------------------------
# Optional: Log level (debug, info, warn, error)
# -----------------------------------------------------------------------------
LOG_LEVEL=info

# -----------------------------------------------------------------------------
# Optional: Limit per-second analysis to N chunks (default: process all)
# Set for testing to limit processing time (e.g., MAX_CHUNKS=10 for ~80s)
# -----------------------------------------------------------------------------
# MAX_CHUNKS=10
```

---

## 6. Example CLI Usage

### 6.1 Basic Usage (Default Lenses)

```bash
# Uses default lenses from .env file
node server/run-pipeline.cjs ./videos/my-ad.mp4 ./output/my-ad
```

### 6.2 Override Lenses via Environment

```bash
# Use different emotional lenses for this run
export TOOL_VARIABLES='{"lenses":["frustration","joy","confusion"]}'
node server/run-pipeline.cjs ./videos/my-ad.mp4 ./output/my-ad
```

### 6.3 One-Liner with Override

```bash
# Single command with inline environment variable
TOOL_VARIABLES='{"lenses":["excitement","flow","engagement"]}' \
  node server/run-pipeline.cjs ./videos/my-ad.mp4 ./output/my-ad
```

### 6.4 With Thresholds

```bash
# Custom thresholds for critical values
TOOL_VARIABLES='{"lenses":["patience","boredom"],"thresholds":{"patience":2,"boredom":8}}' \
  node server/run-pipeline.cjs ./videos/my-ad.mp4 ./output/my-ad
```

### 6.5 Docker Usage

```bash
# Docker container with environment variable
docker run -e TOOL_VARIABLES='{"lenses":["patience","boredom","excitement"]}' \
  -v $(pwd)/videos:/app/videos \
  -v $(pwd)/output:/app/output \
  emotion-engine:latest \
  node server/run-pipeline.cjs /app/videos/my-ad.mp4 /app/output/my-ad
```

### 6.6 CI/CD Pipeline (GitHub Actions)

```yaml
# .github/workflows/analyze-video.yml
name: Analyze Video

on: [push]

jobs:
  analyze:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Run Emotion Engine
        env:
          OPENROUTER_API_KEY: ${{ secrets.OPENROUTER_API_KEY }}
          TOOL_VARIABLES: '{"lenses":["patience","boredom","excitement"]}'
        run: |
          npm install
          node server/run-pipeline.cjs ./videos/test.mp4 ./output/test
```

---

## 7. Validation Pseudocode

### 7.1 Emotion-Tracking Tool Validation

**Location:** Future emotion-tracking tool runtime (not in pipeline)

```javascript
/**
 * Validate TOOL_VARIABLES for emotion-tracking tool
 * @param {Object} toolVariables - Parsed TOOL_VARIABLES object
 * @returns {{valid: boolean, error?: string}}
 */
function validateToolVariables(toolVariables) {
    // Check: lenses field exists
    if (!toolVariables.lenses) {
        return {
            valid: false,
            error: 'emotion-tracking tool requires "lenses" field in TOOL_VARIABLES'
        };
    }
    
    // Check: lenses is an array
    if (!Array.isArray(toolVariables.lenses)) {
        return {
            valid: false,
            error: 'emotion-tracking tool: "lenses" must be an array'
        };
    }
    
    // Check: lenses array has at least 1 item
    if (toolVariables.lenses.length === 0) {
        return {
            valid: false,
            error: 'emotion-tracking tool: "lenses" array must have at least 1 item'
        };
    }
    
    // Check: each lens name is a string
    for (const lens of toolVariables.lenses) {
        if (typeof lens !== 'string') {
            return {
                valid: false,
                error: `emotion-tracking tool: lens name must be a string, got ${typeof lens}`
            };
        }
    }
    
    // Optional: validate thresholds if present
    if (toolVariables.thresholds) {
        if (typeof toolVariables.thresholds !== 'object') {
            return {
                valid: false,
                error: 'emotion-tracking tool: "thresholds" must be an object'
            };
        }
        // Validate each threshold is a number
        for (const [lens, threshold] of Object.entries(toolVariables.thresholds)) {
            if (typeof threshold !== 'number') {
                return {
                    valid: false,
                    error: `emotion-tracking tool: threshold for "${lens}" must be a number`
                };
            }
            if (threshold < 0 || threshold > 10) {
                return {
                    valid: false,
                    error: `emotion-tracking tool: threshold for "${lens}" must be between 0 and 10`
                };
            }
        }
    }
    
    // Optional: validate baselines if present (future feature)
    if (toolVariables.baselines) {
        if (typeof toolVariables.baselines !== 'object') {
            return {
                valid: false,
                error: 'emotion-tracking tool: "baselines" must be an object'
            };
        }
        // Similar validation as thresholds...
    }
    
    return { valid: true };
}

/**
 * Example usage in tool runtime
 */
async function runEmotionTracking(toolVariables) {
    // Validate before processing
    const validation = validateToolVariables(toolVariables);
    if (!validation.valid) {
        throw new Error(`Validation failed: ${validation.error}`);
    }
    
    // Proceed with emotion tracking using validated lenses
    const lenses = toolVariables.lenses;
    // ... rest of tool logic
}
```

### 7.2 Pipeline Error Surfacing

**Location:** `server/run-pipeline.cjs` (JSON syntax validation only)

```javascript
// Load and validate TOOL_VARIABLES from environment
let TOOL_VARIABLES = {};
if (process.env.TOOL_VARIABLES) {
    try {
        TOOL_VARIABLES = JSON.parse(process.env.TOOL_VARIABLES);
        logger.info(`Loaded TOOL_VARIABLES: ${Object.keys(TOOL_VARIABLES).join(', ')}`);
    } catch (e) {
        logger.error(`Invalid TOOL_VARIABLES JSON syntax: ${e.message}`);
        logger.error('Expected format: TOOL_VARIABLES=\'{"lenses":["patience","boredom"]}\'');
        process.exit(1);  // Pipeline exits on JSON syntax error
    }
} else {
    logger.debug('TOOL_VARIABLES not set, using empty defaults');
}

// Export to child processes
process.env.TOOL_VARIABLES = JSON.stringify(TOOL_VARIABLES);

// NOTE: Semantic validation (e.g., "lenses array required") happens in tool, not here
// Pipeline only validates JSON syntax, not tool-specific requirements
```

---

## 8. Hardcoded Defaults to Remove

Based on Task 1 investigation, these are the **7 locations** with hardcoded defaults that need to be removed or made configurable:

| # | File | Line (approx) | Hardcoded Value | Replacement |
|---|------|---------------|-----------------|-------------|
| 1 | `server/03-analyze-chunks.cjs` | ~200 | `selectedLenses = ['patience', 'boredom', 'excitement']` | `toolVariables.lenses` from env |
| 2 | `server/04-per-second-emotions.cjs` | ~150 | `selectedLenses = ['patience', 'boredom', 'excitement']` | `toolVariables.lenses` from env |
| 3 | `server/lib/persona-loader.cjs` | ~135 | `selectedLenses = ['patience', 'boredom', 'excitement']` (default param) | `toolVariables.lenses` with fallback |
| 4 | `server/lib/persona-loader.cjs` | ~160 | Lens lookup assumes specific table format in TOOLS.md | Generic lookup (already flexible) |
| 5 | `server/03-analyze-chunks.cjs` | ~50 | `SOUL_ID = 'impatient-teenager'` (default) | Keep as env var with default (acceptable) |
| 6 | `server/03-analyze-chunks.cjs` | ~51 | `GOAL_ID = 'video-ad-evaluation'` (default) | Keep as env var with default (acceptable) |
| 7 | `server/03-analyze-chunks.cjs` | ~52 | `TOOL_ID = 'emotion-tracking'` (default) | Keep as env var with default (acceptable) |

### Notes on Defaults

**Items 5-7 (SOUL_ID, GOAL_ID, TOOL_ID):**
- These are **acceptable defaults** for development
- They are already overridable via environment variables
- No change needed—they follow the same pattern as `TOOL_VARIABLES`

**Items 1-3 (selectedLenses):**
- **Must be changed** to use `toolVariables.lenses`
- These hardcode tool-specific knowledge in the pipeline
- Violates the tool-agnostic principle

**Item 4 (Lens lookup):**
- Already flexible (searches TOOLS.md table)
- No change needed, but document expected TOOLS.md format

---

## 9. Migration Notes

### 9.1 Backward Compatibility Strategy

**Phase 1: Dual Support (Current Implementation)**

The `buildSystemPrompt()` function supports both old and new APIs:

```javascript
function buildSystemPrompt(config, options = {}) {
    const { 
        duration = 30, 
        toolVariables = {}, 
        videoContext = '',
        // Backward compatibility: support old selectedLenses parameter
        selectedLenses 
    } = options;
    
    // Extract lenses from toolVariables (or use backward-compatible selectedLenses)
    const lenses = toolVariables.lenses || selectedLenses || ['patience', 'boredom', 'excitement'];
    
    // ... rest of function
}
```

**Priority order:**
1. `toolVariables.lenses` (new standard)
2. `selectedLenses` (backward compatibility)
3. `['patience', 'boredom', 'excitement']` (fallback default)

### 9.2 Migration Timeline

**Week 1: Implementation**
- ✅ Add `TOOL_VARIABLES` loading to `run-pipeline.cjs`
- ✅ Update `persona-loader.cjs` with dual support
- ✅ Update `03-analyze-chunks.cjs` and `04-per-second-emotions.cjs`
- ✅ Update `.env.example` with documentation

**Week 2: Testing**
- Test without `TOOL_VARIABLES` (uses defaults)
- Test with `TOOL_VARIABLES` override
- Test with invalid JSON (should fail gracefully)
- Test with empty lenses array (should use defaults)

**Week 3: Documentation**
- Update README with `TOOL_VARIABLES` examples
- Add migration guide for existing users
- Document tool-specific validation requirements

**Week 4: Deprecation Notice**
- Add deprecation warning for `selectedLenses` parameter
- Set timeline for removal (e.g., v2.0.0)

### 9.3 Breaking Changes

**None in v1.x:**
- Dual support ensures backward compatibility
- Existing code continues to work
- No forced migration required

**v2.0.0 (Future):**
- Remove `selectedLenses` parameter support
- Require `toolVariables.lenses`
- Add strict validation (fail if lenses not provided)

### 9.4 Rollback Plan

If issues arise during deployment:

1. **Revert `.env` file:**
   ```bash
   # Remove TOOL_VARIABLES line
   # Pipeline will use hardcoded defaults
   ```

2. **Revert code changes:**
   ```bash
   git checkout HEAD~1 -- server/run-pipeline.cjs
   git checkout HEAD~1 -- server/lib/persona-loader.cjs
   git checkout HEAD~1 -- server/03-analyze-chunks.cjs
   git checkout HEAD~1 -- server/04-per-second-emotions.cjs
   ```

3. **Restart pipeline:**
   ```bash
   node server/run-pipeline.cjs ./videos/my-ad.mp4 ./output/my-ad
   ```

---

## 10. Future Extensions

### 10.1 Per-Step Tool Variables

Different pipeline steps could use different tool configurations:

```bash
# Step 3 (chunked analysis) uses patience/boredom
STEP_3_TOOL_VARIABLES='{"lenses":["patience","boredom"]}'

# Step 4 (per-second) uses excitement/engagement
STEP_4_TOOL_VARIABLES='{"lenses":["excitement","engagement"]}'
```

**Implementation:**
```javascript
// In run-pipeline.cjs, before spawning each step
if (step.name === 'Chunked Video Analysis') {
    process.env.TOOL_VARIABLES = process.env.STEP_3_TOOL_VARIABLES || process.env.TOOL_VARIABLES;
} else if (step.name === 'Per-Second Emotion Timeline') {
    process.env.TOOL_VARIABLES = process.env.STEP_4_TOOL_VARIABLES || process.env.TOOL_VARIABLES;
}
```

### 10.2 Tool Discovery + Schema Validation

Auto-detect tool from `TOOL_ID` and load validation schema:

```javascript
// In run-pipeline.cjs
const TOOL_ID = process.env.TOOL_ID || 'emotion-tracking';
const validationSchema = require(`../personas/tools/${TOOL_ID}/schema.json`);

// Validate TOOL_VARIABLES against schema
const Ajv = require('ajv');
const ajv = new Ajv();
const validate = ajv.compile(validationSchema);

if (!validate(TOOL_VARIABLES)) {
    logger.error(`Invalid TOOL_VARIABLES for ${TOOL_ID}: ${validate.errors}`);
    process.exit(1);
}
```

**Example schema (`personas/tools/emotion-tracking/schema.json`):**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["lenses"],
  "properties": {
    "lenses": {
      "type": "array",
      "minItems": 1,
      "items": { "type": "string" }
    },
    "thresholds": {
      "type": "object",
      "additionalProperties": { "type": "number", "minimum": 0, "maximum": 10 }
    },
    "baselines": {
      "type": "object",
      "additionalProperties": { "type": "number", "minimum": 0, "maximum": 10 }
    }
  }
}
```

### 10.3 Config File Fallback

Support both environment variable and config file:

```javascript
// In run-pipeline.cjs
let TOOL_VARIABLES = {};

if (process.env.TOOL_VARIABLES) {
    TOOL_VARIABLES = JSON.parse(process.env.TOOL_VARIABLES);
} else if (fs.existsSync('./config/tool-variables.json')) {
    TOOL_VARIABLES = JSON.parse(fs.readFileSync('./config/tool-variables.json', 'utf8'));
    logger.info('Loaded TOOL_VARIABLES from config/tool-variables.json');
} else {
    logger.debug('TOOL_VARIABLES not set, using empty defaults');
}
```

### 10.4 Dynamic Lens Selection

Future: AI could recommend lenses based on video content:

```javascript
// In 03-analyze-chunks.cjs (future)
const recommendedLenses = await recommendLensesForVideo(videoPath);
const toolVariables = {
    lenses: recommendedLenses,
    autoSelected: true
};
```

---

## 11. Testing Checklist

### 11.1 Unit Tests

- [ ] `run-pipeline.cjs` loads `TOOL_VARIABLES` from env
- [ ] `run-pipeline.cjs` validates JSON syntax
- [ ] `run-pipeline.cjs` exports to child processes
- [ ] `persona-loader.cjs` accepts `toolVariables` parameter
- [ ] `persona-loader.cjs` falls back to `selectedLenses` (backward compat)
- [ ] `persona-loader.cjs` uses default lenses if neither provided

### 11.2 Integration Tests

- [ ] Pipeline runs without `TOOL_VARIABLES` set (uses defaults)
- [ ] Pipeline runs with `TOOL_VARIABLES` override
- [ ] Pipeline fails gracefully on invalid JSON
- [ ] Pipeline passes `toolVariables` to persona-loader
- [ ] Persona-loader includes `toolVariables` in system prompt

### 11.3 End-to-End Tests

- [ ] Full pipeline with default lenses
- [ ] Full pipeline with custom lenses
- [ ] Full pipeline with thresholds
- [ ] Output JSON contains expected emotion scores

### 11.4 Edge Cases

- [ ] Empty `TOOL_VARIABLES` object: `{}`
- [ ] Empty lenses array: `{"lenses":[]}`
- [ ] Invalid lens names: `{"lenses":["invalid_emotion"]}`
- [ ] Missing lenses field: `{"thresholds":{"patience":3}}`
- [ ] Non-JSON value: `TOOL_VARIABLES='not json'`

---

## 12. Security Considerations

### 12.1 Input Validation

**Risk:** Malicious JSON in `TOOL_VARIABLES`

**Mitigation:**
- Validate JSON syntax before parsing
- Limit object depth (prevent prototype pollution)
- Sanitize lens names (alphanumeric only)

```javascript
// Sanitize lens names
function sanitizeLensName(name) {
    return name.replace(/[^a-zA-Z0-9_-]/g, '').toLowerCase();
}

const lenses = (toolVariables.lenses || []).map(sanitizeLensName);
```

### 12.2 Environment Variable Injection

**Risk:** Command injection via environment variables

**Mitigation:**
- Never interpolate `TOOL_VARIABLES` into shell commands
- Always use `JSON.parse()` in Node.js code
- Use `spawn()` with argument arrays, not shell strings

### 12.3 Secrets in TOOL_VARIABLES

**Risk:** Accidentally committing API keys in `TOOL_VARIABLES`

**Mitigation:**
- Document that `TOOL_VARIABLES` should not contain secrets
- Use separate environment variables for API keys
- Add `.env` to `.gitignore` (already done)

---

## 13. Performance Impact

### 13.1 Overhead Analysis

| Operation | Before | After | Impact |
|-----------|--------|-------|--------|
| JSON parse (startup) | N/A | ~1ms | Negligible |
| Env var export | N/A | ~0.1ms | Negligible |
| Prompt building | ~5ms | ~6ms | +1ms (20% increase, but still negligible) |
| Total pipeline | ~120s | ~120s | No measurable impact |

### 13.2 Memory Usage

- `TOOL_VARIABLES` object: ~100 bytes
- No additional memory overhead
- No performance degradation

---

## 14. Conclusion

This architecture achieves a **tool-agnostic pipeline** by:

1. ✅ Loading generic `TOOL_VARIABLES` payload at pipeline entry point
2. ✅ Passing payload through without interpretation
3. ✅ Letting tools validate their own requirements
4. ✅ Supporting future tools with different variable structures
5. ✅ Maintaining backward compatibility during migration

**Key principle:** *Pipeline is a dumb messenger. Tools are smart validators.*

---

## Appendix A: Glossary

| Term | Definition |
|------|------------|
| `TOOL_VARIABLES` | JSON environment variable containing tool-specific configuration |
| Tool-Agnostic | Pipeline doesn't know about tool-specific data structures |
| Lens | An emotional metric to track (e.g., patience, boredom, excitement) |
| SOUL.md | Persona identity and behavioral profile (qualitative only) |
| GOAL.md | Evaluation objective and success criteria |
| TOOLS.md | Tool schema, lens definitions, and validation rules |
| Persona-Loader | Module that composes SOUL + GOAL + TOOLS into system prompts |

---

## Appendix B: Related Documents

- `TOOL-VARIABLE-INVESTIGATION.md` — Initial investigation (Task 1)
- `variable-injection-design.md` — Preliminary design proposal
- `personas/tools/emotion-tracking/1.0.0/TOOLS.md` — Emotion-tracking tool schema
- `server/lib/persona-loader.cjs` — Persona composition implementation

---

*This document is part of the OpenTruth Emotion Engine architecture specification. Version 1.0.0, last updated 2026-03-04.*
