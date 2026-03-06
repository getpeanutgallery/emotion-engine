# Generic Variable Injection System Design

**Date:** 2026-03-04  
**Status:** Design Proposal  
**Author:** SubAgent (Task 2)

---

## Goal

Design a tool-agnostic variable injection system where pipeline scripts load generic `TOOL_VARIABLES` and pass them to tools, letting each tool validate its own requirements.

---

## Overview

The current system hardcodes lens-specific logic in `persona-loader.cjs` and pipeline scripts. This design proposes a **generic payload system** where:

1. Pipeline scripts load `TOOL_VARIABLES` from environment/config
2. Variables are passed through persona-loader to tools
3. **Tool-specific validation happens in the tool itself**, not the pipeline
4. Pipeline remains completely agnostic to what the variables mean

This enables:
- Emotion-tracking tool validates `lenses` array
- Future sentiment-analysis tool validates different fields (e.g., `sentimentCategories`)
- No pipeline changes needed when adding new tools

---

## Current Architecture Analysis

### Files Examined

1. **`server/run-pipeline.cjs`** - Main orchestrator
   - Spawns 4 pipeline steps sequentially
   - Passes `VIDEO_PATH` and `OUTPUT_DIR` as CLI args
   - **No config injection currently**

2. **`server/lib/persona-loader.cjs`** - Persona composition
   - Loads SOUL.md, GOAL.md, TOOLS.md
   - `buildSystemPrompt()` accepts `selectedLenses` array
   - **Currently hardcodes lens logic** (finds lens info in TOOLS.md table)

3. **`server/lib/models.cjs`** - Model configuration
   - Loads from `config/models.json`
   - Supports defaults + fallbacks
   - **Good pattern for config management**

4. **`server/03-analyze-chunks.cjs`** and **`server/04-per-second-emotions.cjs`**
   - Load persona config via `personaLoader.loadPersonaConfig()`
   - Hardcode `selectedLenses = ['patience', 'boredom', 'excitement']`
   - Call `personaLoader.buildSystemPrompt(config, { selectedLenses, ... })`
   - **Problem:** Pipeline knows about lenses (should be tool-agnostic)

---

## Injection Points

### 1. **Primary Injection Point: `server/run-pipeline.cjs`**

**Location:** Line 17-25 (after loading env, before running steps)

**Current:**
```javascript
const VIDEO_PATH = process.argv[2] || path.resolve(__dirname, '../examples/videos/emotion-tests/cod.mp4');
const OUTPUT_DIR = process.argv[3] || path.resolve(__dirname, '../output/default');
```

**Proposed:**
```javascript
const VIDEO_PATH = process.argv[2] || path.resolve(__dirname, '../examples/videos/emotion-tests/cod.mp4');
const OUTPUT_DIR = process.argv[3] || path.resolve(__dirname, '../output/default');

// Load generic tool variables (JSON string from env)
const TOOL_VARIABLES = process.env.TOOL_VARIABLES ? JSON.parse(process.env.TOOL_VARIABLES) : {};
```

**Why here:**
- Single entry point for all pipeline runs
- Environment variable allows CI/CD, Docker, local overrides
- Can also support config file fallback

---

### 2. **Secondary Injection Point: `server/lib/persona-loader.cjs`**

**Location:** `buildSystemPrompt()` function signature and implementation

**Current:**
```javascript
function buildSystemPrompt(config, options = {}) {
    const { duration = 30, selectedLenses = ['patience', 'boredom', 'excitement'], videoContext = '' } = options;
    // ... hardcodes lens processing
}
```

**Proposed:**
```javascript
function buildSystemPrompt(config, options = {}) {
    const { duration = 30, videoContext = '', toolVariables = {} } = options;
    
    // Pass toolVariables through - don't interpret them here
    // Let the tool's TOOLS.md define how to use them
}
```

**Changes needed:**
- Remove lens-specific logic from `buildSystemPrompt()`
- Add `toolVariables` to prompt context generically
- Tool's TOOLS.md should define variable structure

---

### 3. **Pipeline Step Scripts: `03-analyze-chunks.cjs`, `04-per-second-emotions.cjs`**

**Location:** Where they call `personaLoader.buildSystemPrompt()`

**Current (03-analyze-chunks.cjs line ~200):**
```javascript
const selectedLenses = ['patience', 'boredom', 'excitement'];
const systemPrompt = personaLoader.buildSystemPrompt(personaConfig, {
    duration: endTime - startTime,
    selectedLenses,
    videoContext
});
```

**Proposed:**
```javascript
// Load TOOL_VARIABLES from environment (set by run-pipeline.cjs or .env)
const toolVariables = JSON.parse(process.env.TOOL_VARIABLES || '{}');

const systemPrompt = personaLoader.buildSystemPrompt(personaConfig, {
    duration: endTime - startTime,
    toolVariables,  // Generic payload - no lens knowledge
    videoContext
});
```

---

### 4. **Tool-Specific Validation: In Tool's Runtime (Future)**

**Location:** When tool receives the prompt (not in pipeline)

**Example for emotion-tracking tool:**
```javascript
// Inside emotion-tracking tool validation (not yet implemented)
function validateToolVariables(vars) {
    if (!vars.lenses || !Array.isArray(vars.lenses) || vars.lenses.length === 0) {
        throw new Error('emotion-tracking tool requires non-empty lenses array');
    }
    return true;
}
```

**For future sentiment-analysis tool:**
```javascript
// Different validation, same generic interface
function validateToolVariables(vars) {
    if (!vars.sentimentCategories || !Array.isArray(vars.sentimentCategories)) {
        throw new Error('sentiment-analysis tool requires sentimentCategories array');
    }
    return true;
}
```

---

## Recommended Interface

### Format: **JSON Environment Variable**

```bash
# .env file
TOOL_VARIABLES='{"lenses":["patience","boredom","excitement"],"thresholds":{"patience":3}}'
```

**Why JSON env var:**
- ✅ Single source of truth
- ✅ Easy to override in CI/CD, Docker, CLI
- ✅ Supports complex nested structures
- ✅ No additional config files to manage
- ✅ Follows 12-factor app methodology

**Alternative considered:** Separate config file
- ❌ Requires file path management
- ❌ Harder to override per-run
- ❌ More complex deployment

---

## Implementation Details

### Step 1: Update `run-pipeline.cjs`

Add at top of file (after dotenv.config()):

```javascript
// Load and validate TOOL_VARIABLES
let TOOL_VARIABLES = {};
if (process.env.TOOL_VARIABLES) {
    try {
        TOOL_VARIABLES = JSON.parse(process.env.TOOL_VARIABLES);
        logger.info(`Loaded TOOL_VARIABLES: ${Object.keys(TOOL_VARIABLES).join(', ')}`);
    } catch (e) {
        logger.error(`Invalid TOOL_VARIABLES JSON: ${e.message}`);
        process.exit(1);
    }
}

// Export to child processes
process.env.TOOL_VARIABLES = JSON.stringify(TOOL_VARIABLES);
```

### Step 2: Update `persona-loader.cjs`

**Change function signature:**
```javascript
/**
 * @param {Object} options.toolVariables - Generic tool-specific payload
 */
function buildSystemPrompt(config, options = {}) {
    const { duration = 30, videoContext = '', toolVariables = {} } = options;
    
    // Extract lenses if present (for backward compatibility)
    const selectedLenses = toolVariables.lenses || ['patience', 'boredom', 'excitement'];
    
    // Build lenses section from TOOLS.md
    const lensesText = selectedLenses.map(lens => {
        const lensInfo = findLensInfo(tools, lens);
        return `- **${capitalize(lens)}**: ${lensInfo?.description || 'Emotional metric'} (scale 1-10)`;
    }).join('\n');
    
    // Add toolVariables as JSON context for the tool to interpret
    const toolVariablesSection = Object.keys(toolVariables).length > 0 
        ? `\nTOOL CONFIGURATION:\n${JSON.stringify(toolVariables, null, 2)}\n`
        : '';
    
    // ... rest of prompt building
    prompt += toolVariablesSection;
}
```

### Step 3: Update Pipeline Step Scripts

**In `03-analyze-chunks.cjs` and `04-per-second-emotions.cjs`:**

Replace hardcoded lenses:
```javascript
// OLD: const selectedLenses = ['patience', 'boredom', 'excitement'];

// NEW: Load from environment (set by run-pipeline.cjs)
const toolVariables = JSON.parse(process.env.TOOL_VARIABLES || '{}');

const systemPrompt = personaLoader.buildSystemPrompt(personaConfig, {
    duration: endTime - startTime,
    toolVariables,  // Pass generic payload
    videoContext
});
```

### Step 4: Update `.env.example`

Add documentation:
```bash
# Tool-specific variables (JSON format)
# Emotion-tracking tool expects: {"lenses":["patience","boredom","excitement"]}
# Future tools may expect different fields
TOOL_VARIABLES='{"lenses":["patience","boredom","excitement"],"thresholds":{"patience":3}}'
```

---

## Where Validation Should Occur

### ✅ **IN TOOL (Correct)**

Each tool validates its own requirements when it receives the payload:

```javascript
// Emotion-tracking tool (future implementation)
function validateToolVariables(vars) {
    if (!vars.lenses || !Array.isArray(vars.lenses) || vars.lenses.length === 0) {
        throw new Error('emotion-tracking: lenses array required and must be non-empty');
    }
    // Validate each lens exists in TOOLS.md
    return true;
}
```

### ❌ **NOT IN PIPELINE (Current Problem)**

Pipeline should NOT know about lenses:
```javascript
// DON'T DO THIS:
if (toolVariables.lenses.length === 0) { /* ... */ }
```

---

## Breaking Changes

### 1. **Environment Variable Required**

**Impact:** Existing runs without `TOOL_VARIABLES` will use defaults

**Mitigation:** 
- Provide sensible defaults in `persona-loader.cjs`
- Update `.env` files with example `TOOL_VARIABLES`

### 2. **Persona-Loader API Change**

**Impact:** `buildSystemPrompt()` signature changes

**Old:**
```javascript
buildSystemPrompt(config, { duration, selectedLenses, videoContext })
```

**New:**
```javascript
buildSystemPrompt(config, { duration, toolVariables, videoContext })
```

**Mitigation:**
- Support both for backward compatibility (check for `selectedLenses` fallback)
- Update all call sites (only 2: `03-analyze-chunks.cjs`, `04-per-second-emotions.cjs`)

### 3. **TOOL.md Format May Need Updates**

**Impact:** Tools may need to document expected `TOOL_VARIABLES` structure

**Mitigation:**
- Add "Expected Variables" section to TOOLS.md template
- Example: `{"lenses": ["array", "of", "emotion", "names"]}`

---

## File-by-File Changes Summary

| File | Changes | Breaking? |
|------|---------|-----------|
| `server/run-pipeline.cjs` | Add TOOL_VARIABLES loading + validation | No (adds feature) |
| `server/lib/persona-loader.cjs` | Change `buildSystemPrompt()` to accept `toolVariables` | **Yes** (API change) |
| `server/03-analyze-chunks.cjs` | Replace hardcoded lenses with `toolVariables` | No |
| `server/04-per-second-emotions.cjs` | Replace hardcoded lenses with `toolVariables` | No |
| `.env.example` | Add TOOL_VARIABLES example | No |
| `cast/*/TOOLS.md` | Document expected variables (future) - personas now in cast repo | No |

---

## Testing Strategy

1. **Backward Compatibility Test:**
   - Run pipeline without `TOOL_VARIABLES` set
   - Should use defaults: `['patience', 'boredom', 'excitement']`

2. **Override Test:**
   - Set `TOOL_VARIABLES='{"lenses":["frustration","joy"]}'`
   - Verify persona uses these lenses instead

3. **Validation Test (Future):**
   - Set `TOOL_VARIABLES='{"lenses":[]}'`
   - Emotion-tracking tool should reject (not pipeline)

4. **Tool-Agnostic Test:**
   - Create mock "sentiment-analysis" tool
   - Pass different `TOOL_VARIABLES` structure
   - Verify pipeline doesn't break

---

## Future Extensions

### 1. **Per-Step Tool Variables**

Different steps could use different tools:
```bash
STEP_3_TOOL_VARIABLES='{"lenses":["patience","boredom"]}'
STEP_4_TOOL_VARIABLES='{"lenses":["excitement","engagement"]}'
```

### 2. **Tool Discovery**

Auto-detect tool from `TOOL_ID` and load validation schema:
```javascript
// Tools are now in the tools/ directory (personas moved to cast repo)
const validationSchema = require(`../tools/${TOOL_ID}/schema.json`);
validateAgainstSchema(toolVariables, validationSchema);
```

### 3. **Config File Fallback**

Support both env var and config file:
```javascript
const TOOL_VARIABLES = process.env.TOOL_VARIABLES 
    ? JSON.parse(process.env.TOOL_VARIABLES)
    : fs.existsSync('./config/tool-variables.json')
        ? JSON.parse(fs.readFileSync('./config/tool-variables.json'))
        : {};
```

---

## Recommendations

### Immediate Actions

1. ✅ Implement `TOOL_VARIABLES` loading in `run-pipeline.cjs`
2. ✅ Update `persona-loader.cjs` to accept generic `toolVariables`
3. ✅ Update pipeline step scripts to use `toolVariables`
4. ✅ Add backward compatibility (support `selectedLenses` fallback)
5. ✅ Update `.env.example` with documentation

### Future Actions

1. 📋 Add validation logic to emotion-tracking tool (not pipeline)
2. 📋 Document `TOOL_VARIABLES` schema in TOOLS.md files
3. 📋 Create test suite for variable injection
4. 📋 Consider per-step variable overrides

---

## Conclusion

This design achieves **tool-agnostic pipeline** by:

- ✅ Loading generic `TOOL_VARIABLES` payload at pipeline entry point
- ✅ Passing payload through without interpretation
- ✅ Letting tools validate their own requirements
- ✅ Supporting future tools with different variable structures

**Key principle:** Pipeline is a dumb messenger. Tools are smart validators.

---

*Design complete. Ready for implementation in Task 3.*
