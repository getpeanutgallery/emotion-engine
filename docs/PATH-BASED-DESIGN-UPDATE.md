# PATH-BASED DESIGN UPDATE

**Date:** 2026-03-04  
**Status:** Design Specification  
**Version:** 3.0.0 (Breaking Change from v2.0)  
**Author:** Emotion Engine Team  
**Supersedes:** `PLUGGABLE-TOOL-ARCHITECTURE.md` (v2.0)

---

## Executive Summary

**CRITICAL PROBLEM WITH V2.0:** The pipeline (or `persona-loader.cjs`) still resolves IDs like `impatient-teenager` → `personas/souls/impatient-teenager/1.0.0/SOUL.md`. This **couples the pipeline to the persona directory structure and versioning logic**.

**NEW ARCHITECTURE (V3.0):** Pipeline accepts **direct file paths**, not IDs. All ID resolution happens **outside** the pipeline, in a separate resolver utility or CLI wrapper.

**Key Principle:** *Pipeline is a dumb file processor. It knows nothing about personas, versioning, or directory structure. User (or CLI wrapper) provides absolute paths to files.*

---

## 1. Architecture Decisions

### 1.1 Core Principles

1. **Pipeline Accepts Paths, Not IDs**
   - `SOUL_PATH=/absolute/path/to/SOUL.md` (not `SOUL_ID=impatient-teenager`)
   - `GOAL_PATH=/absolute/path/to/GOAL.md` (not `GOAL_ID=video-ad-evaluation`)
   - `TOOL_PATH=/absolute/path/to/tool.cjs` (not `TOOL_ID=emotion-lenses`)

2. **Pipeline Does No File System Lookups**
   - No directory scanning
   - No SemVer resolution
   - No path construction from IDs
   - Only validates that provided paths exist

3. **Pipeline Knows Nothing About Persona Structure**
   - Doesn't know about `personas/souls/`, `personas/goals/`, `personas/tools/`
   - Doesn't know about versioning (SemVer)
   - Doesn't care how user organizes files

4. **Resolution is External**
   - Optional CLI wrapper (`bin/run-analysis.js`) handles ID → path resolution
   - Optional resolver utility (`lib/persona-resolver.cjs`) handles SemVer logic
   - Pipeline never calls resolver — receives already-resolved paths

5. **User Freedom**
   - User can organize files however they want
   - User can use IDs (via CLI wrapper) or paths (direct pipeline call)
   - Pipeline works the same either way

### 1.2 What Changed from v2.0

| Aspect | v2.0 (Old) | v3.0 (New) |
|--------|------------|------------|
| Environment variables | `SOUL_ID`, `GOAL_ID`, `TOOL_ID` | `SOUL_PATH`, `GOAL_PATH`, `TOOL_PATH` |
| Version handling | `SOUL_VERSION`, `GOAL_VERSION` | None (path includes version) |
| Resolution logic | In `persona-loader.cjs` | In `lib/persona-resolver.cjs` (optional) |
| Pipeline knowledge | Knows about persona directory structure | Zero knowledge |
| File system lookups | `persona-loader` scans directories | None (paths provided) |
| CLI interface | Direct pipeline call | Optional wrapper (`bin/run-analysis.js`) |
| Backward compatibility | Supports v1.0 ID format | **None** — clean break |

---

## 2. Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         USER / CLI WRAPPER                                  │
│                                                                             │
│   Option A: User-facing CLI (accepts IDs)                                   │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │  node bin/run-analysis.js                                           │   │
│   │    --soul impatient-teenager                                        │   │
│   │    --goal video-ad-evaluation                                       │   │
│   │    --tool emotion-lenses                                            │   │
│   │    video.mp4 output/                                                │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                          │                                                   │
│                          ▼                                                   │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │  lib/persona-resolver.cjs (OPTIONAL - used by CLI, not pipeline)    │   │
│   │                                                                     │   │
│   │  resolveSoulPath('impatient-teenager', '1.0.0')                     │   │
│   │    → /path/to/personas/souls/impatient-teenager/1.0.0/SOUL.md       │   │
│   │                                                                     │   │
│   │  resolveGoalPath('video-ad-evaluation', '1.0.0')                    │   │
│   │    → /path/to/personas/goals/video-ad-evaluation/1.0.0/GOAL.md      │   │
│   │                                                                     │   │
│   │  resolveToolPath('emotion-lenses')                                  │   │
│   │    → /path/to/tools/emotion-lenses-tool.cjs                         │   │
│   │                                                                     │   │
│   │  ✅ Handles SemVer, directory structure, file system lookups        │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                          │                                                   │
│                          ▼                                                   │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │  Spawns pipeline with resolved paths                                │   │
│   │                                                                     │   │
│   │  SOUL_PATH=/path/to/SOUL.md                                         │   │
│   │  GOAL_PATH=/path/to/GOAL.md                                         │   │
│   │  TOOL_PATH=/path/to/tool.cjs                                        │   │
│   │  node server/run-pipeline.cjs video.mp4 output/                     │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│   Option B: Direct pipeline call (user provides paths)                      │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │  SOUL_PATH=/absolute/path/to/my/custom/SOUL.md                      │   │
│   │  GOAL_PATH=/absolute/path/to/my/custom/GOAL.md                      │   │
│   │  TOOL_PATH=/absolute/path/to/my/custom/tool.cjs                     │   │
│   │  node server/run-pipeline.cjs video.mp4 output/                     │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        server/run-pipeline.cjs                              │
│                         (Pipeline Orchestrator)                             │
│                                                                             │
│   1. Read SOUL_PATH from env (REQUIRED)                                     │
│   2. Read GOAL_PATH from env (REQUIRED)                                     │
│   3. Read TOOL_PATH from env (REQUIRED)                                     │
│   4. Validate all paths exist (fail if not found)                           │
│   5. Export to child processes via process.env                              │
│   6. Spawn pipeline steps with paths in environment                         │
│                                                                             │
│   ❌ NO ID resolution                                                        │
│   ❌ NO directory scanning                                                   │
│   ❌ NO SemVer logic                                                         │
│   ❌ NO knowledge of persona structure                                       │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                    ┌─────────────────┴─────────────────┐
                    │                                   │
                    ▼                                   ▼
┌──────────────────────────────┐         ┌──────────────────────────────┐
│  server/03-analyze-chunks.cjs│         │ server/04-per-second-emotions│
│   (Chunked Video Analysis)   │         │   (Per-Second Timeline)      │
│                              │         │                              │
│   1. Load SOUL_PATH from env │         │   1. Load SOUL_PATH from env │
│   2. Load GOAL_PATH from env │         │   2. Load GOAL_PATH from env │
│   3. Load TOOL_PATH from env │         │   3. Load TOOL_PATH from env │
│   4. Load files directly     │         │   4. Load files directly     │
│   5. Call tool.analyze()     │         │   5. Call tool.analyze()     │
│   6. Get {prompt, state}     │         │   6. Get {prompt, state}     │
│   7. Merge with context      │         │   7. Merge with context      │
│   8. Send to AI API          │         │   8. Send to AI API          │
│                              │         │                              │
│   ❌ NO ID resolution          │         │   ❌ NO ID resolution          │
│   ❌ NO path construction      │         │   ❌ NO path construction      │
└──────────────────────────────┘         └──────────────────────────────┘
                    │                                   │
                    └─────────────────┬─────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                   server/lib/persona-loader.cjs                             │
│                      (Simple File Loader - No Resolution)                   │
│                                                                             │
│   loadSoulFromPath(so   ulPath)                                              │
│     → fs.readFileSync(so   ulPath, 'utf8')                                    │
│     → parseMarkdown(content)                                                 │
│     → { Name: 'Alex', Age: '17', ... }                                       │
│                                                                             │
│   loadGoalFromPath(goalPath)                                                 │
│     → fs.readFileSync(goalPath, 'utf8')                                      │
│     → parseMarkdown(content)                                                 │
│     → { 'Primary Objective': '...', ... }                                    │
│                                                                             │
│   loadToolFromPath(toolPath)                                                 │
│     → require(toolPath)                                                      │
│     → { analyze, validateVariables, formatStateAfterResponse }               │
│                                                                             │
│   ✅ Just reads files (no resolution logic)                                  │
│   ✅ No resolveVersion() function                                            │
│   ✅ No directory scanning                                                   │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                   tools/emotion-lenses-tool.cjs                             │
│                      (Tool Implementation - Unchanged)                      │
│                                                                             │
│   module.exports.analyze({                                                  │
│     toolVariables: { lenses: [...] },     // From TOOL_VARIABLES            │
│     personaConfig: { soul, goal },      // Loaded from paths by pipeline    │
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
│   ✅ Tool receives persona config (already loaded by pipeline)              │
│   ✅ Tool builds its own prompt                                              │
│   ✅ Tool validates its own TOOL_VARIABLES                                   │
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
├── bin/
│   └── run-analysis.js                  # NEW: User-facing CLI wrapper
├── lib/
│   └── persona-resolver.cjs             # NEW: ID → path resolver (optional)
├── server/lib/
│   └── persona-loader.cjs               # UPDATED: Load from paths, no resolution
├── server/
│   └── run-pipeline.cjs                 # UPDATED: Accept paths, validate existence
└── docs/
    └── PATH-BASED-DESIGN-UPDATE.md      # THIS FILE
```

### 3.2 Files to Update

1. **`server/run-pipeline.cjs`** - Remove ID env vars, accept paths
2. **`server/lib/persona-loader.cjs`** - Remove `resolveVersion()`, load from paths
3. **`server/03-analyze-chunks.cjs`** - Use path-based loading
4. **`server/04-per-second-emotions.cjs`** - Use path-based loading
5. **`.env.example`** - Update with path-based env vars
6. **`docs/PLUGGABLE-TOOL-ARCHITECTURE.md`** - Update to reflect path-based design
7. **`docs/MIGRATION-GUIDE-v2.md`** - Add v2.0 → v3.0 migration section

---

## 4. Environment Variables

### 4.1 New Environment Variables (v3.0)

```bash
# =============================================================================
# Emotion Engine Configuration (v3.0 - Path-Based Architecture)
# =============================================================================

# -----------------------------------------------------------------------------
# Required: OpenRouter API key
# -----------------------------------------------------------------------------
OPENROUTER_API_KEY=sk-or-...

# -----------------------------------------------------------------------------
# FILE PATHS (REQUIRED - ABSOLUTE PATHS)
# All paths must be absolute and point to existing files
# -----------------------------------------------------------------------------

# SOUL_PATH: Absolute path to SOUL.md file (REQUIRED)
# Example: /home/user/personas/souls/impatient-teenager/1.0.0/SOUL.md
SOUL_PATH=/absolute/path/to/personas/souls/impatient-teenager/1.0.0/SOUL.md

# GOAL_PATH: Absolute path to GOAL.md file (REQUIRED)
# Example: /home/user/personas/goals/video-ad-evaluation/1.0.0/GOAL.md
GOAL_PATH=/absolute/path/to/personas/goals/video-ad-evaluation/1.0.0/GOAL.md

# TOOL_PATH: Absolute path to tool script (REQUIRED)
# Example: /home/user/tools/emotion-lenses-tool.cjs
TOOL_PATH=/absolute/path/to/tools/emotion-lenses-tool.cjs

# -----------------------------------------------------------------------------
# TOOL VARIABLES (REQUIRED - JSON)
# -----------------------------------------------------------------------------

# TOOL_VARIABLES: Tool-specific configuration (REQUIRED)
# Must be valid JSON. Schema depends on the tool.
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
# Optional: API request delay (milliseconds, default 1000)
# -----------------------------------------------------------------------------
API_REQUEST_DELAY=1000

# -----------------------------------------------------------------------------
# Optional: Log level (debug, info, warn, error)
# -----------------------------------------------------------------------------
LOG_LEVEL=info
```

### 4.2 Removed Environment Variables

These are **no longer used** in v3.0:

```bash
# REMOVED (v2.0 → v3.0):
SOUL_ID=impatient-teenager
SOUL_VERSION=latest
GOAL_ID=video-ad-evaluation
GOAL_VERSION=1.0
TOOL_ID=emotion-lenses
TOOL_VERSION=latest
```

---

## 5. Code Examples

### 5.1 New: `lib/persona-resolver.cjs` (Optional Utility)

```javascript
#!/usr/bin/env node
/**
 * Persona Resolver Utility
 * 
 * Converts persona IDs to absolute file paths.
 * Used by CLI wrapper, NOT by pipeline.
 * 
 * Usage:
 *   const resolver = require('./lib/persona-resolver.cjs');
 *   const soulPath = resolver.resolveSoulPath('impatient-teenager', '1.0.0');
 *   const goalPath = resolver.resolveGoalPath('video-ad-evaluation', 'latest');
 *   const toolPath = resolver.resolveToolPath('emotion-lenses');
 */

const fs = require('fs');
const path = require('path');

// Base directories (configurable)
const PERSONAS_ROOT = process.env.PERSONAS_ROOT || path.join(__dirname, '../personas');
const TOOLS_ROOT = process.env.TOOLS_ROOT || path.join(__dirname, '../tools');

/**
 * Resolve SemVer version to actual folder
 * Supports: 'latest', '1', '1.0', '1.0.0', '^1.0.0', '~1.0.0'
 * @param {string} baseDir - Base directory to search
 * @param {string} version - Version string
 * @returns {string|null} Resolved version folder name or null
 */
function resolveVersion(baseDir, version = 'latest') {
  if (!fs.existsSync(baseDir)) return null;
  
  // Get all version folders
  const folders = fs.readdirSync(baseDir)
    .filter(f => fs.statSync(path.join(baseDir, f)).isDirectory())
    .filter(f => /^\d+\.\d+\.\d+$/.test(f)); // Only SemVer folders
  
  if (folders.length === 0) return null;
  
  // Sort by SemVer (descending)
  folders.sort((a, b) => {
    const [aMajor, aMinor, aPatch] = a.split('.').map(Number);
    const [bMajor, bMinor, bPatch] = b.split('.').map(Number);
    if (aMajor !== bMajor) return bMajor - aMajor;
    if (aMinor !== bMinor) return bMinor - aMinor;
    return bPatch - aPatch;
  });
  
  if (version === 'latest') {
    return folders[0];
  }
  
  // Exact match
  if (folders.includes(version)) {
    return version;
  }
  
  // Major only (e.g., '1' → latest 1.x.x)
  const majorMatch = version.match(/^(\d+)$/);
  if (majorMatch) {
    const major = parseInt(majorMatch[1]);
    return folders.find(f => f.startsWith(`${major}.`)) || null;
  }
  
  // Major.Minor (e.g., '1.0' → latest 1.0.x)
  const minorMatch = version.match(/^(\d+)\.(\d+)$/);
  if (minorMatch) {
    const prefix = `${minorMatch[1]}.${minorMatch[2]}.`;
    return folders.find(f => f.startsWith(prefix)) || null;
  }
  
  return null;
}

/**
 * Resolve soul ID to absolute path
 * @param {string} soulId - Soul ID (e.g., 'impatient-teenager')
 * @param {string} version - SemVer version (e.g., '1.0.0', 'latest')
 * @returns {string|null} Absolute path to SOUL.md or null
 */
function resolveSoulPath(soulId, version = 'latest') {
  const baseDir = path.join(PERSONAS_ROOT, 'souls', soulId);
  const resolvedVersion = resolveVersion(baseDir, version);
  
  if (!resolvedVersion) {
    return null;
  }
  
  return path.join(baseDir, resolvedVersion, 'SOUL.md');
}

/**
 * Resolve goal ID to absolute path
 * @param {string} goalId - Goal ID (e.g., 'video-ad-evaluation')
 * @param {string} version - SemVer version
 * @returns {string|null} Absolute path to GOAL.md or null
 */
function resolveGoalPath(goalId, version = 'latest') {
  const baseDir = path.join(PERSONAS_ROOT, 'goals', goalId);
  const resolvedVersion = resolveVersion(baseDir, version);
  
  if (!resolvedVersion) {
    return null;
  }
  
  return path.join(baseDir, resolvedVersion, 'GOAL.md');
}

/**
 * Resolve tool ID to absolute path
 * @param {string} toolId - Tool ID (e.g., 'emotion-lenses')
 * @returns {string|null} Absolute path to tool script or null
 */
function resolveToolPath(toolId) {
  const toolPath = path.join(TOOLS_ROOT, `${toolId}-tool.cjs`);
  
  if (!fs.existsSync(toolPath)) {
    return null;
  }
  
  return toolPath;
}

/**
 * Resolve all IDs to paths
 * @param {Object} options - Resolution options
 * @param {string} options.soulId - Soul ID
 * @param {string} options.soulVersion - Soul version
 * @param {string} options.goalId - Goal ID
 * @param {string} options.goalVersion - Goal version
 * @param {string} options.toolId - Tool ID
 * @returns {{soulPath: string|null, goalPath: string|null, toolPath: string|null}}
 */
function resolveAll({ soulId, soulVersion = 'latest', goalId, goalVersion = 'latest', toolId }) {
  return {
    soulPath: resolveSoulPath(soulId, soulVersion),
    goalPath: resolveGoalPath(goalId, goalVersion),
    toolPath: resolveToolPath(toolId)
  };
}

module.exports = {
  resolveSoulPath,
  resolveGoalPath,
  resolveToolPath,
  resolveAll,
  resolveVersion
};
```

### 5.2 New: `bin/run-analysis.js` (CLI Wrapper)

```javascript
#!/usr/bin/env node
/**
 * User-Facing CLI for Emotion Engine
 * 
 * Accepts persona IDs and resolves them to paths, then calls pipeline.
 * This is the "nice" interface; pipeline is the "dumb" engine.
 * 
 * Usage:
 *   node bin/run-analysis.js --soul impatient-teenager --goal video-ad-evaluation --tool emotion-lenses video.mp4 output/
 * 
 * Or with versions:
 *   node bin/run-analysis.js --soul impatient-teenager --soul-version 1.0.0 --goal video-ad-evaluation --tool emotion-lenses video.mp4 output/
 */

const { spawn } = require('child_process');
const path = require('path');
const resolver = require('../lib/persona-resolver.cjs');

// Parse command line arguments
const args = process.argv.slice(2);
const options = {
  soul: null,
  soulVersion: 'latest',
  goal: null,
  goalVersion: 'latest',
  tool: null,
  videoPath: null,
  outputDir: null
};

// Parse flags
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--soul' && args[i + 1]) {
    options.soul = args[++i];
  } else if (args[i] === '--soul-version' && args[i + 1]) {
    options.soulVersion = args[++i];
  } else if (args[i] === '--goal' && args[i + 1]) {
    options.goal = args[++i];
  } else if (args[i] === '--goal-version' && args[i + 1]) {
    options.goalVersion = args[++i];
  } else if (args[i] === '--tool' && args[i + 1]) {
    options.tool = args[++i];
  } else if (!args[i].startsWith('--')) {
    // Positional arguments: video path, output dir
    if (!options.videoPath) {
      options.videoPath = args[i];
    } else if (!options.outputDir) {
      options.outputDir = args[i];
    }
  }
}

// Validate required arguments
if (!options.soul || !options.goal || !options.tool) {
  console.error('❌ Missing required arguments');
  console.error('');
  console.error('Usage:');
  console.error('  node bin/run-analysis.js --soul <id> --goal <id> --tool <id> <video-path> [output-dir]');
  console.error('');
  console.error('Options:');
  console.error('  --soul <id>              Soul/persona ID (required)');
  console.error('  --soul-version <ver>     Soul version (default: latest)');
  console.error('  --goal <id>              Goal ID (required)');
  console.error('  --goal-version <ver>     Goal version (default: latest)');
  console.error('  --tool <id>              Tool ID (required)');
  console.error('  <video-path>             Path to video file');
  console.error('  [output-dir]             Output directory (default: ./output/default)');
  console.error('');
  console.error('Example:');
  console.error('  node bin/run-analysis.js --soul impatient-teenager --goal video-ad-evaluation --tool emotion-lenses video.mp4 output/');
  process.exit(1);
}

if (!options.videoPath) {
  console.error('❌ Video path is required');
  process.exit(1);
}

// Resolve IDs to paths
console.log('🔍 Resolving persona IDs to paths...');

const resolved = resolver.resolveAll({
  soulId: options.soul,
  soulVersion: options.soulVersion,
  goalId: options.goal,
  goalVersion: options.goalVersion,
  toolId: options.tool
});

// Check if all paths were resolved
if (!resolved.soulPath) {
  console.error(`❌ Soul not found: ${options.soul}@${options.soulVersion}`);
  process.exit(1);
}

if (!resolved.goalPath) {
  console.error(`❌ Goal not found: ${options.goal}@${options.goalVersion}`);
  process.exit(1);
}

if (!resolved.toolPath) {
  console.error(`❌ Tool not found: ${options.tool}`);
  process.exit(1);
}

console.log(`✅ Soul: ${resolved.soulPath}`);
console.log(`✅ Goal: ${resolved.goalPath}`);
console.log(`✅ Tool: ${resolved.toolPath}`);

// Set environment variables for pipeline
process.env.SOUL_PATH = resolved.soulPath;
process.env.GOAL_PATH = resolved.goalPath;
process.env.TOOL_PATH = resolved.toolPath;

// Set TOOL_VARIABLES if not already set
if (!process.env.TOOL_VARIABLES) {
  process.env.TOOL_VARIABLES = JSON.stringify({
    lenses: ['patience', 'boredom', 'excitement']
  });
}

// Spawn pipeline
console.log('');
console.log('🚀 Starting pipeline...');
console.log('');

const pipelinePath = path.join(__dirname, '../server/run-pipeline.cjs');
const pipelineArgs = [pipelinePath, options.videoPath];

if (options.outputDir) {
  pipelineArgs.push(options.outputDir);
}

const pipeline = spawn('node', pipelineArgs, {
  stdio: 'inherit',
  env: process.env
});

pipeline.on('close', (code) => {
  if (code === 0) {
    console.log('');
    console.log('✅ Analysis complete!');
  } else {
    console.log('');
    console.error(`❌ Pipeline failed with code ${code}`);
  }
  process.exit(code);
});

pipeline.on('error', (err) => {
  console.error(`❌ Failed to start pipeline: ${err.message}`);
  process.exit(1);
});
```

### 5.3 Updated: `server/run-pipeline.cjs` (Snippet)

**Replace ID-based environment variables with path-based:**

```javascript
#!/usr/bin/env node
/**
 * Master Orchestrator Script
 * Runs the complete 4-step pipeline in sequence
 * 
 * Usage: node server/run-pipeline.cjs <video-path> [output-dir]
 * 
 * ENVIRONMENT REQUIREMENTS (v3.0):
 * - SOUL_PATH: REQUIRED (absolute path to SOUL.md)
 * - GOAL_PATH: REQUIRED (absolute path to GOAL.md)
 * - TOOL_PATH: REQUIRED (absolute path to tool script)
 * - TOOL_VARIABLES: REQUIRED (valid JSON)
 */

require('dotenv').config();

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const logger = require('./lib/logger.cjs');

// =============================================================================
// VALIDATE REQUIRED ENVIRONMENT VARIABLES (PATHS, NOT IDS)
// =============================================================================

// SOUL_PATH is REQUIRED
if (!process.env.SOUL_PATH) {
  logger.error('❌ SOUL_PATH is REQUIRED but not set');
  logger.error('Example: SOUL_PATH=/home/user/personas/souls/impatient-teenager/1.0.0/SOUL.md');
  logger.error('Set in .env file or export before running:');
  logger.error('  export SOUL_PATH=/absolute/path/to/SOUL.md');
  process.exit(1);
}

// GOAL_PATH is REQUIRED
if (!process.env.GOAL_PATH) {
  logger.error('❌ GOAL_PATH is REQUIRED but not set');
  logger.error('Example: GOAL_PATH=/home/user/personas/goals/video-ad-evaluation/1.0.0/GOAL.md');
  process.exit(1);
}

// TOOL_PATH is REQUIRED
if (!process.env.TOOL_PATH) {
  logger.error('❌ TOOL_PATH is REQUIRED but not set');
  logger.error('Example: TOOL_PATH=/home/user/tools/emotion-lenses-tool.cjs');
  process.exit(1);
}

// Validate paths exist
if (!fs.existsSync(process.env.SOUL_PATH)) {
  logger.error(`❌ Soul file not found: ${process.env.SOUL_PATH}`);
  process.exit(1);
}

if (!fs.existsSync(process.env.GOAL_PATH)) {
  logger.error(`❌ Goal file not found: ${process.env.GOAL_PATH}`);
  process.exit(1);
}

if (!fs.existsSync(process.env.TOOL_PATH)) {
  logger.error(`❌ Tool file not found: ${process.env.TOOL_PATH}`);
  process.exit(1);
}

logger.info(`✅ Loaded SOUL_PATH=${process.env.SOUL_PATH}`);
logger.info(`✅ Loaded GOAL_PATH=${process.env.GOAL_PATH}`);
logger.info(`✅ Loaded TOOL_PATH=${process.env.TOOL_PATH}`);

// TOOL_VARIABLES is REQUIRED
if (!process.env.TOOL_VARIABLES) {
  logger.error('❌ TOOL_VARIABLES is REQUIRED but not set');
  logger.error('Example: TOOL_VARIABLES=\'{"lenses":["patience","boredom","excitement"]}\'');
  process.exit(1);
}

// Validate TOOL_VARIABLES JSON syntax
let TOOL_VARIABLES;
try {
  TOOL_VARIABLES = JSON.parse(process.env.TOOL_VARIABLES);
  logger.info(`✅ Loaded TOOL_VARIABLES: ${Object.keys(TOOL_VARIABLES).join(', ')}`);
} catch (e) {
  logger.error(`❌ Invalid TOOL_VARIABLES JSON syntax: ${e.message}`);
  process.exit(1);
}

// Export to child processes
process.env.TOOL_VARIABLES = JSON.stringify(TOOL_VARIABLES);

// Convert relative paths to absolute
const VIDEO_PATH = process.argv[2] || path.resolve(__dirname, '../.cache/videos/cod.mp4');
const OUTPUT_DIR = process.argv[3] || path.resolve(__dirname, '../output/default');

// ... rest of file unchanged ...
```

### 5.4 Updated: `server/lib/persona-loader.cjs` (Simplified)

**Remove all resolution logic, just load from paths:**

```javascript
#!/usr/bin/env node
/**
 * Persona System Loader (v3.0 - Path-Based)
 * 
 * Loads SOUL.md, GOAL.md, and TOOLS.md from absolute paths.
 * No ID resolution, no versioning logic, no directory scanning.
 * 
 * Usage: 
 *   const loader = require('./lib/persona-loader.cjs');
 *   const soul = loader.loadSoulFromPath(process.env.SOUL_PATH);
 *   const goal = loader.loadGoalFromPath(process.env.GOAL_PATH);
 *   const tool = loader.loadToolFromPath(process.env.TOOL_PATH);
 */

const fs = require('fs');
const path = require('path');

/**
 * Load SOUL.md from absolute path
 * @param {string} soulPath - Absolute path to SOUL.md
 * @returns {Object|null} Parsed SOUL.md or null if not found
 */
function loadSoulFromPath(soulPath) {
  if (!soulPath || !fs.existsSync(soulPath)) {
    console.error(`❌ Soul file not found: ${soulPath}`);
    return null;
  }
  
  const content = fs.readFileSync(soulPath, 'utf8');
  return parseMarkdown(content);
}

/**
 * Load GOAL.md from absolute path
 * @param {string} goalPath - Absolute path to GOAL.md
 * @returns {Object|null} Parsed GOAL.md or null if not found
 */
function loadGoalFromPath(goalPath) {
  if (!goalPath || !fs.existsSync(goalPath)) {
    console.error(`❌ Goal file not found: ${goalPath}`);
    return null;
  }
  
  const content = fs.readFileSync(goalPath, 'utf8');
  return parseMarkdown(content);
}

/**
 * Load tool script from absolute path
 * @param {string} toolPath - Absolute path to tool script
 * @returns {Object|null} Tool module or null if not found
 */
function loadToolFromPath(toolPath) {
  if (!toolPath || !fs.existsSync(toolPath)) {
    console.error(`❌ Tool file not found: ${toolPath}`);
    return null;
  }
  
  try {
    return require(toolPath);
  } catch (e) {
    console.error(`❌ Failed to load tool: ${e.message}`);
    return null;
  }
}

/**
 * Load complete persona configuration from paths
 * @param {string} soulPath - Path to SOUL.md
 * @param {string} goalPath - Path to GOAL.md
 * @param {string} toolPath - Path to tool script
 * @returns {{soul: Object, goal: Object, tool: Object}|null}
 */
function loadPersonaConfigFromPaths(soulPath, goalPath, toolPath) {
  const soul = loadSoulFromPath(soulPath);
  const goal = loadGoalFromPath(goalPath);
  const tool = loadToolFromPath(toolPath);
  
  if (!soul || !goal || !tool) {
    return null;
  }
  
  return { soul, goal, tool };
}

/**
 * Parse markdown into sections
 * @param {string} markdown - Markdown content
 * @returns {Object} Parsed sections
 */
function parseMarkdown(markdown) {
  const sections = {};
  const lines = markdown.split('\n');
  let currentSection = 'header';
  let currentContent = [];
  
  for (const line of lines) {
    if (line.startsWith('## ')) {
      if (currentContent.length > 0) {
        sections[currentSection] = currentContent.join('\n').trim();
      }
      currentSection = line.replace('## ', '').trim();
      currentContent = [];
    } else {
      currentContent.push(line);
    }
  }
  
  if (currentContent.length > 0) {
    sections[currentSection] = currentContent.join('\n').trim();
  }
  
  return sections;
}

// =============================================================================
// DEPRECATED FUNCTIONS (v2.0 → v3.0)
// These are kept temporarily for migration but should not be used.
// =============================================================================

/**
 * @deprecated Use loadSoulFromPath() instead
 */
function loadSoul(soulId, version = 'latest') {
  console.warn('⚠️  WARNING: loadSoul(soulId, version) is deprecated');
  console.warn('Use loadSoulFromPath(so   ulPath) instead');
  console.warn('Example:');
  console.warn('  const resolver = require(\'./lib/persona-resolver.cjs\');');
  console.warn('  const soulPath = resolver.resolveSoulPath(soulId, version);');
  console.warn('  const soul = loadSoulFromPath(soulPath);');
  return null;
}

/**
 * @deprecated Use loadGoalFromPath() instead
 */
function loadGoal(goalId, version = 'latest') {
  console.warn('⚠️  WARNING: loadGoal(goalId, version) is deprecated');
  console.warn('Use loadGoalFromPath(goalPath) instead');
  return null;
}

/**
 * @deprecated Use loadToolFromPath() instead
 */
function loadTools(toolId, version = 'latest') {
  console.warn('⚠️  WARNING: loadTools(toolId, version) is deprecated');
  console.warn('Use loadToolFromPath(toolPath) instead');
  return null;
}

/**
 * @deprecated Use loadPersonaConfigFromPaths() instead
 */
function loadPersonaConfig(soulId, goalId, toolId = 'emotion-tracking') {
  console.warn('⚠️  WARNING: loadPersonaConfig() is deprecated');
  console.warn('Use loadPersonaConfigFromPaths(so   ulPath, goalPath, toolPath) instead');
  return null;
}

/**
 * @deprecated Removed in v3.0 - tools build their own prompts
 */
function buildSystemPrompt(config, options = {}) {
  console.warn('⚠️  WARNING: buildSystemPrompt() is deprecated');
  console.warn('Tools should build their own prompts via tool.analyze()');
  return config;
}

/**
 * @deprecated Removed in v3.0 - resolution is external to pipeline
 */
function resolveVersion(baseDir, version = 'latest') {
  console.warn('⚠️  WARNING: resolveVersion() is deprecated');
  console.warn('Use lib/persona-resolver.cjs for ID → path resolution');
  return null;
}

module.exports = {
  // New path-based functions (v3.0)
  loadSoulFromPath,
  loadGoalFromPath,
  loadToolFromPath,
  loadPersonaConfigFromPaths,
  parseMarkdown,
  
  // Deprecated functions (kept for migration)
  loadSoul,          // Deprecated
  loadGoal,          // Deprecated
  loadTools,         // Deprecated
  loadPersonaConfig, // Deprecated
  buildSystemPrompt, // Deprecated
  resolveVersion     // Deprecated
};
```

### 5.5 Updated: `server/03-analyze-chunks.cjs` (Snippet)

**Use path-based loading:**

```javascript
// Load persona config from paths (v3.0)
const personaLoader = require('./lib/persona-loader.cjs');

const soul = personaLoader.loadSoulFromPath(process.env.SOUL_PATH);
const goal = personaLoader.loadGoalFromPath(process.env.GOAL_PATH);
const tool = personaLoader.loadToolFromPath(process.env.TOOL_PATH);

if (!soul || !goal || !tool) {
  logger.error('Failed to load persona configuration');
  process.exit(1);
}

const personaConfig = { soul, goal };

// ... later in the file, when calling tool ...

// Call tool to build prompt (pipeline doesn't know what's in the prompt)
const toolResult = await tool.analyze({
  toolVariables,
  personaConfig,  // Pass loaded persona config
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
```

---

## 6. Usage Examples

### 6.1 User-Facing CLI (Accepts IDs)

```bash
# Simple usage (latest versions)
node bin/run-analysis.js \
  --soul impatient-teenager \
  --goal video-ad-evaluation \
  --tool emotion-lenses \
  video.mp4 output/

# With specific versions
node bin/run-analysis.js \
  --soul impatient-teenager --soul-version 1.0.0 \
  --goal video-ad-evaluation --goal-version 1.0 \
  --tool emotion-lenses \
  video.mp4 output/

# Custom TOOL_VARIABLES
TOOL_VARIABLES='{"lenses":["frustration","joy"]}' \
  node bin/run-analysis.js \
    --soul impatient-teenager \
    --goal video-ad-evaluation \
    --tool emotion-lenses \
    video.mp4 output/
```

### 6.2 Direct Pipeline Call (Accepts Paths)

```bash
# Using environment variables
SOUL_PATH=/home/user/personas/souls/impatient-teenager/1.0.0/SOUL.md \
GOAL_PATH=/home/user/personas/goals/video-ad-evaluation/1.0.0/GOAL.md \
TOOL_PATH=/home/user/tools/emotion-lenses-tool.cjs \
TOOL_VARIABLES='{"lenses":["patience","boredom"]}' \
  node server/run-pipeline.cjs video.mp4 output/

# Or export first
export SOUL_PATH=/path/to/SOUL.md
export GOAL_PATH=/path/to/GOAL.md
export TOOL_PATH=/path/to/tool.cjs
export TOOL_VARIABLES='{"lenses":["patience"]}'
node server/run-pipeline.cjs video.mp4 output/
```

### 6.3 Custom File Organization

```bash
# User can organize files however they want
SOUL_PATH=/home/user/my-personas/cool-kid/SOUL.md \
GOAL_PATH=/home/user/my-goals/ad-review/GOAL.md \
TOOL_PATH=/home/user/my-tools/custom-tool.cjs \
  node server/run-pipeline.cjs video.mp4 output/

# No directory structure requirements
# No versioning requirements
# Pipeline just reads the files
```

---

## 7. Benefits

### 7.1 Decoupling

| Component | Knows About | Doesn't Know About |
|-----------|-------------|-------------------|
| **Pipeline** | File paths, video processing, AI API calls | Persona IDs, SemVer, directory structure |
| **Persona Resolver** | IDs, SemVer, directory structure | Video processing, AI API calls |
| **CLI Wrapper** | User-friendly interface | Internal pipeline logic |

### 7.2 Flexibility

1. **User Freedom**: Organize files however you want
2. **Multiple Resolvers**: Different resolver strategies (SemVer, git tags, database)
3. **Testing**: Easy to test pipeline with mock files
4. **Deployment**: Pipeline can run in sandboxed environment (no file system access needed beyond provided paths)

### 7.3 Simplicity

1. **Pipeline Code**: Simpler (no resolution logic)
2. **Testing**: Easier to test (just provide paths)
3. **Debugging**: Clearer error messages ("file not found" vs "ID not resolved")

---

## 8. Migration Guide (v2.0 → v3.0)

### 8.1 Update .env File

**Replace ID-based variables with path-based:**

```bash
# OLD (v2.0):
SOUL_ID=impatient-teenager
SOUL_VERSION=latest
GOAL_ID=video-ad-evaluation
GOAL_VERSION=1.0
TOOL_ID=emotion-lenses

# NEW (v3.0):
SOUL_PATH=/home/derrick/.openclaw/workspace/projects/opentruth/emotion-engine/personas/souls/impatient-teenager/1.0.0/SOUL.md
GOAL_PATH=/home/derrick/.openclaw/workspace/projects/opentruth/emotion-engine/personas/goals/video-ad-evaluation/1.0.0/GOAL.md
TOOL_PATH=/home/derrick/.openclaw/workspace/projects/opentruth/emotion-engine/tools/emotion-lenses-tool.cjs
```

### 8.2 Update Scripts

If you have scripts that call the pipeline:

```bash
# OLD (v2.0):
export SOUL_ID=impatient-teenager
export TOOL_ID=emotion-lenses
node server/run-pipeline.cjs video.mp4 output/

# NEW (v3.0) - Option A: Use CLI wrapper
node bin/run-analysis.js --soul impatient-teenager --tool emotion-lenses video.mp4 output/

# NEW (v3.0) - Option B: Use paths directly
export SOUL_PATH=/path/to/SOUL.md
export TOOL_PATH=/path/to/tool.cjs
node server/run-pipeline.cjs video.mp4 output/
```

### 8.3 Update Code

If you import `persona-loader.cjs`:

```javascript
// OLD (v2.0):
const loader = require('./lib/persona-loader.cjs');
const soul = loader.loadSoul('impatient-teenager', '1.0.0');

// NEW (v3.0):
const loader = require('./lib/persona-loader.cjs');
const soul = loader.loadSoulFromPath(process.env.SOUL_PATH);

// OR with resolver:
const resolver = require('./lib/persona-resolver.cjs');
const soulPath = resolver.resolveSoulPath('impatient-teenager', '1.0.0');
const soul = loader.loadSoulFromPath(soulPath);
```

---

## 9. Testing Checklist

### 9.1 Validation Tests

- [ ] Pipeline fails without SOUL_PATH
- [ ] Pipeline fails without GOAL_PATH
- [ ] Pipeline fails without TOOL_PATH
- [ ] Pipeline fails if SOUL_PATH doesn't exist
- [ ] Pipeline fails if GOAL_PATH doesn't exist
- [ ] Pipeline fails if TOOL_PATH doesn't exist
- [ ] Pipeline fails without TOOL_VARIABLES
- [ ] Pipeline fails with invalid TOOL_VARIABLES JSON

### 9.2 Functional Tests

- [ ] CLI wrapper resolves IDs correctly
- [ ] CLI wrapper passes paths to pipeline
- [ ] Pipeline loads files from paths
- [ ] Pipeline processes video successfully
- [ ] Output matches v2.0 format

### 9.3 Edge Cases

- [ ] Custom file organization (non-standard paths)
- [ ] Paths with spaces
- [ ] Paths with special characters
- [ ] Relative paths (should fail or be converted to absolute)

---

## 10. Future Extensions

### 10.1 Multiple Resolver Strategies

```javascript
// lib/persona-resolver.cjs could support multiple strategies:

// SemVer resolver (current)
const resolver = require('./lib/persona-resolver.cjs');
const path = resolver.resolveSoulPath('impatient-teenager', '1.0.0');

// Git tag resolver (future)
const gitResolver = require('./lib/git-resolver.cjs');
const path = gitResolver.resolveSoulPath('impatient-teenager', 'v1.0.0');

// Database resolver (future)
const dbResolver = require('./lib/db-resolver.cjs');
const path = await dbResolver.resolveSoulPath('impatient-teenager');
```

### 10.2 Path Validation Middleware

```javascript
// Validate paths before pipeline starts
const validator = require('./lib/path-validator.cjs');

const validation = await validator.validatePaths({
  soulPath: process.env.SOUL_PATH,
  goalPath: process.env.GOAL_PATH,
  toolPath: process.env.TOOL_PATH
});

if (!validation.valid) {
  console.error(validation.errors);
  process.exit(1);
}
```

### 10.3 Path Aliases

```bash
# Support aliases in .env
SOUL_PATH=@souls/impatient-teenager
GOAL_PATH=@goals/video-ad-evaluation
TOOL_PATH=@tools/emotion-lenses

# Resolver expands aliases to absolute paths
```

---

## 11. Security Considerations

### 11.1 Path Traversal

**Risk:** User could provide paths to sensitive files (e.g., `/etc/passwd`)

**Mitigation:**
- Validate that paths are within allowed directories
- Use `path.resolve()` to normalize paths
- Check for `..` in paths

```javascript
// Example validation
const allowedDirs = [
  path.join(__dirname, '../personas'),
  path.join(__dirname, '../tools')
];

function isPathAllowed(filePath) {
  const resolved = path.resolve(filePath);
  return allowedDirs.some(dir => resolved.startsWith(dir));
}
```

### 11.2 Code Injection

**Risk:** Malicious tool script could execute arbitrary code

**Mitigation:**
- Same as v2.0 (trusted code only)
- Future: Sandbox tools in separate processes

---

## 12. Performance Impact

| Operation | v2.0 | v3.0 | Impact |
|-----------|------|------|--------|
| Path resolution | ~10ms (in pipeline) | ~10ms (in CLI/resolver) | Same (just moved) |
| File loading | ~5ms | ~5ms | Same |
| Total pipeline | ~120s | ~120s | No measurable impact |

---

## 13. Conclusion

This architecture achieves **complete decoupling** by:

1. ✅ Pipeline accepts paths, not IDs
2. ✅ Pipeline does no file system lookups
3. ✅ Pipeline knows nothing about persona structure
4. ✅ Resolution is external (CLI wrapper or resolver utility)
5. ✅ User can organize files however they want
6. ✅ Clean separation of concerns

**Key principle:** *Pipeline is a dumb file processor. Resolution is a separate concern.*

---

## Appendix A: Glossary

| Term | Definition |
|------|------------|
| Path-Based | Architecture where components communicate via file paths, not IDs |
| Resolver | Utility that converts IDs to paths (external to pipeline) |
| CLI Wrapper | User-facing interface that accepts IDs and calls pipeline with paths |
| Decoupling | Separation of concerns (resolution vs. processing) |

---

## Appendix B: Related Documents

- `PLUGGABLE-TOOL-ARCHITECTURE.md` (v2.0) — Previous design (superseded)
- `MIGRATION-GUIDE-v2.md` — Migration from v1.0 to v2.0 (add v2.0→v3.0 section)
- `lib/persona-resolver.cjs` — ID → path resolver utility
- `bin/run-analysis.js` — User-facing CLI wrapper

---

*This document is part of the OpenTruth Emotion Engine architecture specification. Version 3.0.0, last updated 2026-03-04. Breaking change from v2.0.0.*
