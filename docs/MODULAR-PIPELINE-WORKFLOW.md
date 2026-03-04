# Modular Pipeline Workflow Engine

**Version:** 1.0  
**Date:** 2026-03-04  
**Status:** Design Specification

---

## 🎯 Core Insight

The pipeline should be a **workflow orchestrator** with three phases, each accepting 0-N pluggable scripts:

```
Phase 1: Gather Context (0-N scripts)
  - scripts/get-context/get-dialogue.cjs
  - scripts/get-context/get-music.cjs
  - scripts/get-context/get-metadata.cjs
  - (or none, for silent video)
  
Phase 2: Process (1-N scripts, REQUIRED)
  - scripts/process/video-chunks.cjs
  - scripts/process/per-second.cjs
  - scripts/process/image-frames.cjs (for images)
  - scripts/process/audio-segments.cjs (for audio)
  
Phase 3: Report (1-N scripts)
  - scripts/report/evaluation.cjs
  - scripts/report/graphs.cjs
  - scripts/report/assets.cjs
```

---

## 📐 Architecture Overview

### High-Level Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        PIPELINE ORCHESTRATOR                            │
│                    (server/run-pipeline.cjs)                            │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
                    ┌───────────────────────────────┐
                    │   Load Config (YAML/JSON)     │
                    │   OR Parse CLI Arguments      │
                    └───────────────────────────────┘
                                    │
        ┌───────────────────────────┼───────────────────────────┐
        │                           │                           │
        ▼                           ▼                           ▼
┌───────────────────┐     ┌───────────────────┐     ┌───────────────────┐
│   PHASE 1         │     │   PHASE 2         │     │   PHASE 3         │
│   Gather Context  │────▶│   Process         │────▶│   Report          │
│   (0-N scripts)   │     │   (1-N scripts)   │     │   (1-N scripts)   │
│                   │     │                   │     │                   │
│ • get-dialogue    │     │ • video-chunks    │     │ • evaluation      │
│ • get-music       │     │ • per-second      │     │ • graphs          │
│ • get-metadata    │     │ • image-frames    │     │ • assets          │
└───────────────────┘     └───────────────────┘     └───────────────────┘
        │                           │                           │
        │                           │                           │
        ▼                           ▼                           ▼
┌───────────────────┐     ┌───────────────────┐     ┌───────────────────┐
│ contextArtifacts  │     │ processArtifacts  │     │   reportFiles     │
│ • dialogueData    │     │ • chunkAnalysis   │     │ • FINAL-REPORT.md │
│ • musicData       │     │ • perSecondData   │     │ • charts/         │
│ • metadata        │     │ • emotionTimeline │     │ • assets/         │
└───────────────────┘     └───────────────────┘     └───────────────────┘
```

### Artifact Flow Between Phases

```
┌──────────────────────────────────────────────────────────────────────────┐
│                         PHASE CONTRACTS                                  │
└──────────────────────────────────────────────────────────────────────────┘

Phase 1: Gather Context
┌─────────────────────────────────────────────────────────────────────────┐
│  INPUT:  { assetPath, outputDir }                                       │
│  OUTPUT: { contextArtifacts: { dialogueData, musicData, metadata } }    │
│                                                                         │
│  Scripts run: 0-N (can skip entirely for silent video)                  │
│  Execution: Sequential or Parallel (no dependencies between scripts)    │
└─────────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
Phase 2: Process
┌─────────────────────────────────────────────────────────────────────────┐
│  INPUT:  {                                                              │
│            assetPath,                                                   │
│            contextArtifacts,      ← from Phase 1                        │
│            toolPath,              ← persona/tool config                 │
│            toolVariables,         ← lens selections                     │
│            outputDir                                                    │
│          }                                                              │
│  OUTPUT: { processArtifacts: { chunkAnalysis, perSecondData, ... } }    │
│                                                                         │
│  Scripts run: 1-N (REQUIRED, at least one)                              │
│  Execution: Sequential (default) or Parallel                            │
│                                                                         │
│  Sequential: Each script receives { ...previousOutput }                 │
│  Parallel: Each script receives base input, outputs merged after        │
└─────────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
Phase 3: Report
┌─────────────────────────────────────────────────────────────────────────┐
│  INPUT:  {                                                              │
│            processArtifacts,      ← from Phase 2                        │
│            contextArtifacts,      ← from Phase 1                        │
│            outputDir                                                    │
│          }                                                              │
│  OUTPUT: { reportFiles: ['FINAL-REPORT.md', 'charts/', 'assets/'] }     │
│                                                                         │
│  Scripts run: 1-N (REQUIRED)                                            │
│  Execution: Sequential or Parallel                                      │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 📋 Config File Schema

### YAML Structure

```yaml
# configs/video-analysis.yaml

# Pipeline metadata (optional)
name: "Full Video Analysis Pipeline"
description: "Complete emotion analysis with dialogue, music, and video processing"
version: "1.0"

# Phase 1: Gather Context (optional, 0-N scripts)
gather_context:
  - scripts/get-context/get-dialogue.cjs
  - scripts/get-context/get-music.cjs
  # - scripts/get-context/get-metadata.cjs

# Phase 2: Process (REQUIRED, 1-N scripts)
process:
  - scripts/process/video-chunks.cjs
  - scripts/process/per-second.cjs

# Phase 3: Report (REQUIRED, 1-N scripts)
report:
  - scripts/report/evaluation.cjs
  - scripts/report/graphs.cjs
  - scripts/report/assets.cjs

# Global settings (optional)
settings:
  chunk_duration: 8          # seconds
  max_chunks: 4              # for testing
  api_request_delay: 1000    # milliseconds
  chunk_quality: "medium"    # low|medium|high
```

### JSON Structure

```json
{
  "name": "Full Video Analysis Pipeline",
  "description": "Complete emotion analysis with dialogue, music, and video processing",
  "version": "1.0",
  "gather_context": [
    "scripts/get-context/get-dialogue.cjs",
    "scripts/get-context/get-music.cjs"
  ],
  "process": [
    "scripts/process/video-chunks.cjs",
    "scripts/process/per-second.cjs"
  ],
  "report": [
    "scripts/report/evaluation.cjs",
    "scripts/report/graphs.cjs",
    "scripts/report/assets.cjs"
  ],
  "settings": {
    "chunk_duration": 8,
    "max_chunks": 4,
    "api_request_delay": 1000,
    "chunk_quality": "medium"
  }
}
```

### Schema Definition

```typescript
interface PipelineConfig {
  // Metadata (optional)
  name?: string;
  description?: string;
  version?: string;
  
  // Phase 1: Gather Context (optional, 0-N scripts)
  gather_context?: string[] | { parallel: GatherContextItem[] };
  
  // Phase 2: Process (REQUIRED, 1-N scripts)
  // Can be sequential (array) or parallel (object with parallel array)
  process: string[] | { parallel: ProcessItem[] };
  
  // Phase 3: Report (REQUIRED, 1-N scripts)
  report?: string[] | { parallel: ReportItem[] };
  
  // Global settings (optional)
  settings?: {
    chunk_duration?: number;
    max_chunks?: number;
    api_request_delay?: number;
    chunk_quality?: 'low' | 'medium' | 'high';
    [key: string]: any;       // Allow custom settings
  };
}

// Sequential script (simple string path)
type ScriptPath = string;

// Parallel process script item (extended configuration)
interface ProcessItem {
  script: string;             // Script path
  soulPath?: string;          // Optional: override soul path
  goalPath?: string;          // Optional: override goal path
  toolPath?: string;          // Optional: override tool path
  toolVariables?: {           // Optional: override tool variables
    [key: string]: any;
  };
}

// Parallel gather/report script item (can extend similarly)
interface GatherContextItem {
  script: string;
  [key: string]: any;
}

interface ReportItem {
  script: string;
  [key: string]: any;
}
```

### Required vs Optional Phases

| Phase | Required | Min Scripts | Max Scripts | Notes |
|-------|----------|-------------|-------------|-------|
| `gather_context` | ❌ Optional | 0 | N | Can be omitted for silent video |
| `process` | ✅ REQUIRED | 1 | N | Must have at least 1 script |
| `report` | ✅ REQUIRED | 1 | N | Must have at least 1 script |

### Script Ordering

- **Within phases (sequential):** Scripts run in array order (index 0 → N)
- **Within phases (parallel):** Scripts run simultaneously, outputs merged after completion
- **Between phases:** Phase 1 → Phase 2 → Phase 3 (strict ordering)
- **Parallel execution:** Enabled per-phase using `parallel:` key in config

### Parallel Execution Syntax

**Sequential (default):**
```yaml
process:
  - scripts/process/video-chunks.cjs
  - scripts/process/per-second.cjs  # Receives output from video-chunks
```

**Parallel:**
```yaml
process:
  parallel:
    - script: scripts/process/video-chunks.cjs
      soulPath: /path/to/impatient-teenager/SOUL.md
      toolVariables: { lenses: ["patience","boredom"] }
    - script: scripts/process/video-chunks.cjs
      soulPath: /path/to/skeptical-cfo/SOUL.md
      toolVariables: { lenses: ["patience","boredom"] }
    - script: scripts/process/brand-detection.cjs
    - script: scripts/process/ocr-extraction.cjs
```

**Parallel Use Cases:**
- **Multi-persona swarm:** Same video, different personas analyzing simultaneously
- **Multi-model analysis:** Same persona, different AI models
- **Independent analyses:** Emotion + brand detection + OCR extraction

**Phase Contracts:**
- **Sequential:** Each script receives `{ ...previousOutput }` from prior script
- **Parallel:** Each script receives base input only; outputs are merged after all complete

---

## 🔌 Script Interface Specification

### Universal Script Template

Every script exports a single async function:

```javascript
#!/usr/bin/env node
/**
 * Script Name: Get Dialogue
 * Phase: Gather Context
 * Description: Transcribe speech, identify speakers, detect emotions
 */

/**
 * Main entry point - called by pipeline orchestrator
 * @param {object} input - Phase-specific input object
 * @returns {Promise<object>} - Phase-specific output object
 */
async function run(input) {
  // Your script logic here
  return output;
}

// Export for pipeline orchestrator
module.exports = { run };

// Allow standalone execution (optional)
if (require.main === module) {
  // Parse CLI args and call run()
  const assetPath = process.argv[2];
  const outputDir = process.argv[3];
  
  run({ assetPath, outputDir })
    .then(result => console.log('Complete:', result))
    .catch(console.error);
}
```

### Phase 1: Gather Context Scripts

**Input Contract:**
```javascript
{
  assetPath: string,      // Absolute path to video/audio/image file
  outputDir: string,      // Absolute path to output directory
  settings?: object       // Global settings from config
}
```

**Output Contract:**
```javascript
{
  contextArtifacts: {
    dialogueData?: {      // From get-dialogue.cjs
      dialogue_segments: Array<{
        timestamp_start: string,
        timestamp_end: string,
        speaker: string,
        text: string,
        emotion: string,
        delivery: string,
        confidence: number
      }>,
      summary: string
    },
    musicData?: {         // From get-music.cjs
      audio_segments: Array<{
        timestamp_range: string,
        description: string,
        mood: string,
        genre: string,
        sfx: string[]
      }>
    },
    metadata?: {          // From get-metadata.cjs
      duration: number,
      resolution: string,
      codec: string,
      fps: number
    }
  }
}
```

**Example: `scripts/get-context/get-dialogue.cjs`**
```javascript
#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

async function run(input) {
  const { assetPath, outputDir, settings } = input;
  
  console.log('🎤 Extracting dialogue from:', assetPath);
  
  // Extract audio from video
  const tempDir = fs.mkdtempSync('/tmp/dialogue-');
  const audioPath = path.join(tempDir, 'audio.wav');
  
  await extractAudio(assetPath, audioPath);
  
  // Call API for transcription
  const dialogueData = await analyzeDialogue(audioPath);
  
  // Cleanup
  fs.rmSync(tempDir, { recursive: true, force: true });
  
  return {
    contextArtifacts: {
      dialogueData
    }
  };
}

async function extractAudio(videoPath, outputPath) {
  return new Promise((resolve, reject) => {
    spawn('ffmpeg', [
      '-i', videoPath,
      '-vn', '-acodec', 'pcm_s16le',
      '-ar', '16000', '-ac', '1',
      '-y', outputPath
    ]).on('close', (code) => code === 0 ? resolve() : reject());
  });
}

async function analyzeDialogue(audioPath) {
  // ... API call logic ...
  return {
    dialogue_segments: [...],
    summary: "..."
  };
}

module.exports = { run };
```

### Phase 2: Process Scripts

**Input Contract:**
```javascript
{
  assetPath: string,          // Absolute path to video/audio/image file
  contextArtifacts: {         // Output from Phase 1
    dialogueData?: object,
    musicData?: object,
    metadata?: object
  },
  toolPath: string,           // Path to persona/tool config
  toolVariables: {            // Selected lenses, persona settings
    soulId: string,
    goalId: string,
    toolId: string,
    selectedLenses: string[]
  },
  outputDir: string,          // Absolute path to output directory
  settings?: object,          // Global settings from config
  processArtifacts?: {        // Output from previous process script (if any)
    chunkAnalysis?: object,
    // ... other artifacts
  }
}
```

**Output Contract:**
```javascript
{
  processArtifacts: {
    chunkAnalysis?: {       // From video-chunks.cjs
      chunks: Array<{
        chunkIndex: number,
        startTime: number,
        endTime: number,
        analysis: string,
        tokens: number,
        contextUsed: object
      }>,
      totalTokens: number,
      persona: object
    },
    perSecondData?: {       // From per-second.cjs
      per_second_data: Array<{
        timestamp: number,
        patience: number,
        boredom: number,
        excitement: number,
        scroll_risk: string,
        visuals: string,
        thought: string
      }>,
      totalTokens: number
    }
  }
}
```

**Example: `scripts/process/video-chunks.cjs`**
```javascript
#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const personaLoader = require('../lib/persona-loader.cjs');
const videoUtils = require('../lib/video-utils.cjs');

async function run(input) {
  const { 
    assetPath, 
    contextArtifacts, 
    toolPath, 
    toolVariables,
    outputDir, 
    settings,
    processArtifacts 
  } = input;
  
  console.log('🎬 Processing video chunks...');
  
  // Load persona configuration
  const personaConfig = personaLoader.loadPersonaConfig(
    toolVariables.soulId,
    toolVariables.goalId,
    toolVariables.toolId
  );
  
  // Get video duration
  const duration = await getDuration(assetPath);
  const chunkDuration = settings?.chunk_duration || 8;
  const numChunks = Math.ceil(duration / chunkDuration);
  
  const results = [];
  let previousSummary = '';
  
  // Process each chunk
  for (let i = 0; i < numChunks && i < (settings?.max_chunks || numChunks); i++) {
    const startTime = i * chunkDuration;
    const endTime = Math.min(startTime + chunkDuration, duration);
    
    // Extract relevant context for this chunk
    const dialogueContext = getRelevantDialogue(
      contextArtifacts.dialogueData, 
      startTime, 
      endTime
    );
    const musicContext = getRelevantMusic(
      contextArtifacts.musicData, 
      startTime, 
      endTime
    );
    
    // Analyze chunk with context
    const result = await analyzeChunk(
      assetPath, 
      startTime, 
      endTime,
      {
        previousSummary,
        dialogueContext,
        musicContext,
        personaConfig,
        toolVariables
      }
    );
    
    results.push(result);
    previousSummary = result.summary;
  }
  
  return {
    processArtifacts: {
      chunkAnalysis: {
        chunks: results,
        totalTokens: results.reduce((sum, r) => sum + r.tokens, 0),
        persona: {
          id: toolVariables.soulId,
          config: personaConfig
        }
      }
    }
  };
}

module.exports = { run };
```

### Phase 3: Report Scripts

**Input Contract:**
```javascript
{
  processArtifacts: {       // Output from Phase 2
    chunkAnalysis?: object,
    perSecondData?: object
  },
  contextArtifacts: {       // Output from Phase 1
    dialogueData?: object,
    musicData?: object,
    metadata?: object
  },
  outputDir: string,        // Absolute path to output directory
  settings?: object         // Global settings from config
}
```

**Output Contract:**
```javascript
{
  reportFiles: {
    main: string,           // Path to main report file
    appendix?: string,      // Path to appendix file
    charts?: string[],      // Paths to chart files
    assets?: string[]       // Paths to asset files
  },
  summary: {
    totalTokens: number,
    duration: number,
    keyMetrics: object
  }
}
```

**Example: `scripts/report/evaluation.cjs`**
```javascript
#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

async function run(input) {
  const { processArtifacts, contextArtifacts, outputDir, settings } = input;
  
  console.log('📊 Generating evaluation report...');
  
  const { chunkAnalysis } = processArtifacts;
  const { dialogueData, musicData } = contextArtifacts;
  
  // Calculate metrics
  const avgPatience = calculateAverage(chunkAnalysis, 'patience');
  const avgBoredom = calculateAverage(chunkAnalysis, 'boredom');
  const avgExcitement = calculateAverage(chunkAnalysis, 'excitement');
  
  // Build report
  let report = `# Emotion Analysis Report\n\n`;
  report += `## Executive Summary\n\n`;
  report += `| Metric | Average |\n`;
  report += `|--------|--------|\n`;
  report += `| Patience | ${avgPatience.toFixed(1)}/10 |\n`;
  report += `| Boredom | ${avgBoredom.toFixed(1)}/10 |\n`;
  report += `| Excitement | ${avgExcitement.toFixed(1)}/10 |\n`;
  
  // Save report
  const reportPath = path.join(outputDir, 'FINAL-REPORT.md');
  fs.writeFileSync(reportPath, report);
  
  return {
    reportFiles: {
      main: reportPath,
      summary: {
        totalTokens: chunkAnalysis.totalTokens,
        duration: chunkAnalysis.duration,
        keyMetrics: { avgPatience, avgBoredom, avgExcitement }
      }
    }
  };
}

module.exports = { run };
```

---

## 🗂️ Updated File Structure

```
emotion-engine/
├── server/
│   ├── run-pipeline.cjs           # ← Pipeline orchestrator (updated)
│   │
│   ├── scripts/
│   │   ├── get-context/           # ← Phase 1 scripts
│   │   │   ├── get-dialogue.cjs   # (from 01-extract-dialogue.cjs)
│   │   │   ├── get-music.cjs      # (from 02-extract-music.cjs)
│   │   │   └── get-metadata.cjs   # (new)
│   │   │
│   │   ├── process/               # ← Phase 2 scripts
│   │   │   ├── video-chunks.cjs   # (from 03-analyze-chunks.cjs)
│   │   │   ├── per-second.cjs     # (from 04-per-second-emotions.cjs)
│   │   │   ├── image-frames.cjs   # (new, for images)
│   │   │   └── audio-segments.cjs # (new, for audio)
│   │   │
│   │   └── report/                # ← Phase 3 scripts
│   │       ├── evaluation.cjs     # (from generate-report.cjs)
│   │       ├── graphs.cjs         # (new, chart generation)
│   │       └── assets.cjs         # (new, asset management)
│   │
│   └── lib/
│       ├── persona-loader.cjs
│       ├── api-utils.cjs
│       ├── video-utils.cjs
│       └── logger.cjs
│
├── configs/                       # ← NEW: Pipeline configurations
│   ├── video-analysis.yaml        # Full video pipeline
│   ├── image-analysis.yaml        # Image-only pipeline
│   ├── audio-analysis.yaml        # Audio-only pipeline
│   └── quick-test.yaml            # Minimal pipeline (testing)
│
├── docs/
│   └── MODULAR-PIPELINE-WORKFLOW.md  # ← This document
│
└── output/
    └── default/                   # Analysis outputs
```

---

## 🔄 Migration from Current Structure

### Script Mapping

| Current Script | New Location | Phase | Notes |
|----------------|--------------|-------|-------|
| `server/01-extract-dialogue.cjs` | `server/scripts/get-context/get-dialogue.cjs` | Gather Context | Refactor to use `run(input)` interface |
| `server/02-extract-music.cjs` | `server/scripts/get-context/get-music.cjs` | Gather Context | Refactor to use `run(input)` interface |
| `server/03-analyze-chunks.cjs` | `server/scripts/process/video-chunks.cjs` | Process | Refactor to use `run(input)` interface |
| `server/04-per-second-emotions.cjs` | `server/scripts/process/per-second.cjs` | Process | Refactor to use `run(input)` interface |
| `server/generate-report.cjs` | `server/scripts/report/evaluation.cjs` | Report | Refactor to use `run(input)` interface |

### Migration Steps

1. **Create new directory structure:**
   ```bash
   mkdir -p server/scripts/get-context
   mkdir -p server/scripts/process
   mkdir -p server/scripts/report
   mkdir -p configs
   ```

2. **Copy and refactor each script:**
   - Move file to new location
   - Wrap main logic in `async function run(input) { ... }`
   - Update path resolution to use `input.assetPath` and `input.outputDir`
   - Export: `module.exports = { run }`

3. **Update `run-pipeline.cjs`:**
   - Replace hardcoded step array with config loading
   - Implement phase execution logic
   - Add artifact passing between phases

4. **Create config files:**
   - `configs/video-analysis.yaml`
   - `configs/image-analysis.yaml`
   - `configs/audio-analysis.yaml`
   - `configs/quick-test.yaml`

5. **Test migration:**
   ```bash
   # Old way (still works during transition)
   node server/run-pipeline.cjs video.mp4 output/
   
   # New way
   node server/run-pipeline.cjs --config configs/video-analysis.yaml video.mp4 output/
   ```

---

## 🖥️ CLI Interface

### YAML-Only Configuration (v3.0+)

**The pipeline accepts ONLY a config file.** Inline CLI flags have been removed to simplify the interface and ensure reproducibility.

```bash
# Pipeline (YAML only)
node server/run-pipeline.cjs --config configs/video-analysis.yaml video.mp4 output/
```

**Benefits of YAML-Only:**
- ✅ Single configuration interface (no sync hell between CLI and config)
- ✅ YAML configs are reproducible (commit to git)
- ✅ YAML handles complex nested structures better than flags
- ✅ No duplication of option parsing logic
- ✅ Parallel execution syntax is cleaner in YAML

### Optional CLI Wrapper (Separate Concern)

For users who prefer flag-based invocation, optional CLI wrappers are provided as **separate tools** (not part of the pipeline core):

- **`bin/run-analysis.js`** — User-friendly wrapper that generates YAML from flags
- **`bin/generate-config.js`** — Config generator/templater

These are syntactic sugar — the pipeline doesn't know about them.

```bash
# Example CLI wrapper (optional, not part of pipeline)
node bin/run-analysis.js \
  --soul impatient-teenager \
  --goal video-ad-evaluation \
  --tool emotion-lenses \
  --lens patience \
  --lens boredom \
  --chunks 4 \
  video.mp4 output/

# Wrapper generates YAML and calls pipeline:
# node server/run-pipeline.cjs --config /tmp/generated-config.yaml video.mp4 output/
```

### CLI Arguments

```
Usage: node server/run-pipeline.cjs --config <config-file> <asset-path> <output-dir>

Options:
  --config <path>           Path to YAML/JSON config file (REQUIRED)
  --verbose                 Enable verbose logging
  --dry-run                 Validate config without executing

Arguments:
  <asset-path>              Path to video/image/audio file
  <output-dir>              Output directory for results
```

### Example Commands

```bash
# Full video analysis
node server/run-pipeline.cjs --config configs/video-analysis.yaml video.mp4 output/

# Image analysis
node server/run-pipeline.cjs --config configs/image-analysis.yaml image.png output/

# Audio analysis
node server/run-pipeline.cjs --config configs/audio-analysis.yaml audio.mp3 output/

# Quick test (minimal pipeline)
node server/run-pipeline.cjs --config configs/quick-test.yaml video.mp4 output/

# Multi-persona swarm (parallel execution)
node server/run-pipeline.cjs --config configs/multi-persona-swarm.yaml video.mp4 output/

# Multi-analysis (parallel independent analyses)
node server/run-pipeline.cjs --config configs/multi-analysis.yaml video.mp4 output/
```

### CLI Implementation Sketch

```javascript
#!/usr/bin/env node
/**
 * Pipeline Orchestrator
 * server/run-pipeline.cjs
 */

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

async function main() {
  const args = parseArgs(process.argv.slice(2));
  
  // Load config from file or build from CLI args
  let config;
  if (args.config) {
    config = loadConfigFile(args.config);
  } else {
    config = buildConfigFromArgs(args);
  }
  
  // Validate config
  validateConfig(config);
  
  const assetPath = path.resolve(args._[0]);
  const outputDir = path.resolve(args._[1]);
  
  // Ensure output directory exists
  fs.mkdirSync(outputDir, { recursive: true });
  
  // Initialize artifacts
  let contextArtifacts = {};
  let processArtifacts = {};
  
  // Phase 1: Gather Context (0-N scripts)
  if (config.gather_context) {
    console.log('📥 Phase 1: Gather Context');
    for (const scriptPath of config.gather_context) {
      const result = await runScript(scriptPath, { assetPath, outputDir, settings: config.settings });
      contextArtifacts = { ...contextArtifacts, ...result.contextArtifacts };
    }
  }
  
  // Phase 2: Process (1-N scripts, sequential)
  console.log('⚙️  Phase 2: Process');
  for (const scriptPath of config.process) {
    const result = await runScript(scriptPath, {
      assetPath,
      contextArtifacts,
      toolPath: config.tool_path,
      toolVariables: config.tool_variables,
      outputDir,
      settings: config.settings,
      processArtifacts  // Pass previous output
    });
    processArtifacts = { ...processArtifacts, ...result.processArtifacts };
  }
  
  // Phase 3: Report (1-N scripts)
  console.log('📊 Phase 3: Report');
  for (const scriptPath of config.report) {
    await runScript(scriptPath, {
      processArtifacts,
      contextArtifacts,
      outputDir,
      settings: config.settings
    });
  }
  
  console.log('✅ Pipeline complete!');
}

async function runScript(scriptPath, input) {
  const absolutePath = path.resolve(scriptPath);
  const script = require(absolutePath);
  console.log(`   Running: ${scriptPath}`);
  const result = await script.run(input);
  return result;
}

function loadConfigFile(configPath) {
  const content = fs.readFileSync(configPath, 'utf8');
  if (configPath.endsWith('.yaml') || configPath.endsWith('.yml')) {
    return yaml.load(content);
  } else if (configPath.endsWith('.json')) {
    return JSON.parse(content);
  }
  throw new Error('Unsupported config file format');
}

function buildConfigFromArgs(args) {
  return {
    gather_context: args.gather || [],
    process: args.process || [],
    report: args.report || [],
    settings: {}
  };
}

function validateConfig(config) {
  if (!config.process || config.process.length === 0) {
    throw new Error('At least one process script is required');
  }
  if (!config.report || config.report.length === 0) {
    throw new Error('At least one report script is required');
  }
}

function parseArgs(args) {
  const parsed = { _: [] };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--config') {
      parsed.config = args[++i];
    } else if (args[i] === '--gather') {
      parsed.gather = parsed.gather || [];
      parsed.gather.push(args[++i]);
    } else if (args[i] === '--process') {
      parsed.process = parsed.process || [];
      parsed.process.push(args[++i]);
    } else if (args[i] === '--report') {
      parsed.report = parsed.report || [];
      parsed.report.push(args[++i]);
    } else if (!args[i].startsWith('--')) {
      parsed._.push(args[i]);
    }
  }
  return parsed;
}

main().catch(console.error);
```

---

## 📝 Example Configs

### `configs/video-analysis.yaml` — Full Video Pipeline (Sequential)

```yaml
name: "Full Video Analysis Pipeline"
description: "Complete emotion analysis with dialogue, music, and video processing"
version: "1.0"

gather_context:
  - scripts/get-context/get-dialogue.cjs
  - scripts/get-context/get-music.cjs

# Sequential process (default): each script receives output from previous
process:
  - scripts/process/video-chunks.cjs
  - scripts/process/per-second.cjs

report:
  - scripts/report/evaluation.cjs
  - scripts/report/graphs.cjs
  - scripts/report/assets.cjs

settings:
  chunk_duration: 8
  max_chunks: 4
  api_request_delay: 1000
  chunk_quality: "medium"

tool_variables:
  soulId: "impatient-teenager"
  goalId: "video-ad-evaluation"
  toolId: "emotion-tracking"
  selectedLenses:
    - patience
    - boredom
    - excitement
```

### `configs/video-analysis.yaml` — Parallel Multi-Persona Swarm (Example)

```yaml
# Uncomment to use parallel execution instead of sequential
name: "Multi-Persona Swarm Analysis"
description: "Same video analyzed by 3 different personas simultaneously"
version: "1.0"

gather_context:
  - scripts/get-context/get-dialogue.cjs
  - scripts/get-context/get-music.cjs

# Parallel process: all scripts run simultaneously, outputs merged after
process:
  parallel:
    - script: scripts/process/video-chunks.cjs
      soulPath: /path/to/impatient-teenager/SOUL.md
      toolVariables: { lenses: ["patience","boredom"] }
    - script: scripts/process/video-chunks.cjs
      soulPath: /path/to/skeptical-cfo/SOUL.md
      toolVariables: { lenses: ["patience","boredom"] }
    - script: scripts/process/video-chunks.cjs
      soulPath: /path/to/optimistic-gen-z/SOUL.md
      toolVariables: { lenses: ["excitement","fomo"] }

report:
  - scripts/report/evaluation.cjs
  - scripts/report/graphs.cjs

settings:
  chunk_duration: 8
  max_chunks: 4
  api_request_delay: 1000
```

### `configs/image-analysis.yaml` — Image-Only Pipeline

```yaml
name: "Image Analysis Pipeline"
description: "Analyze static images (no dialogue or music)"
version: "1.0"

# No context gathering for images
gather_context: []

process:
  - scripts/process/image-frames.cjs

report:
  - scripts/report/evaluation.cjs
  - scripts/report/graphs.cjs

settings:
  api_request_delay: 1000

tool_variables:
  soulId: "impatient-teenager"
  goalId: "image-evaluation"
  toolId: "emotion-tracking"
  selectedLenses:
    - patience
    - boredom
    - excitement
```

### `configs/audio-analysis.yaml` — Audio-Only Pipeline

```yaml
name: "Audio Analysis Pipeline"
description: "Analyze audio files (podcasts, music, etc.)"
version: "1.0"

gather_context:
  - scripts/get-context/get-dialogue.cjs

process:
  - scripts/process/audio-segments.cjs

report:
  - scripts/report/evaluation.cjs

settings:
  segment_duration: 30
  api_request_delay: 1000

tool_variables:
  soulId: "impatient-teenager"
  goalId: "audio-evaluation"
  toolId: "emotion-tracking"
  selectedLenses:
    - patience
    - boredom
```

### `configs/quick-test.yaml` — Minimal Pipeline

```yaml
name: "Quick Test Pipeline"
description: "Minimal pipeline for testing (1 process script only)"
version: "1.0"

# Skip context gathering for speed
gather_context: []

process:
  - scripts/process/video-chunks.cjs

report:
  - scripts/report/evaluation.cjs

settings:
  chunk_duration: 8
  max_chunks: 2  # Only 2 chunks for fast testing
  api_request_delay: 500
```

### `configs/multi-persona-swarm.yaml` — Parallel Multi-Persona Analysis

```yaml
name: "Multi-Persona Swarm Analysis"
description: "Same video analyzed by 3 different personas in parallel"
version: "1.0"

gather_context:
  - scripts/get-context/get-dialogue.cjs
  - scripts/get-context/get-music.cjs

# All 3 personas analyze the same video simultaneously
process:
  parallel:
    - script: scripts/process/video-chunks.cjs
      soulPath: /home/derrick/.openclaw/workspace/projects/opentruth/emotion-engine/personas/souls/impatient-teenager/1.0.0/SOUL.md
      toolVariables:
        lenses: ["patience", "boredom"]
    - script: scripts/process/video-chunks.cjs
      soulPath: /home/derrick/.openclaw/workspace/projects/opentruth/emotion-engine/personas/souls/skeptical-cfo/1.0.0/SOUL.md
      toolVariables:
        lenses: ["patience", "boredom", "skepticism"]
    - script: scripts/process/video-chunks.cjs
      soulPath: /home/derrick/.openclaw/workspace/projects/opentruth/emotion-engine/personas/souls/optimistic-gen-z/1.0.0/SOUL.md
      toolVariables:
        lenses: ["excitement", "fomo", "joy"]

report:
  - scripts/report/evaluation.cjs
  - scripts/report/graphs.cjs

settings:
  chunk_duration: 8
  max_chunks: 4
  api_request_delay: 1000
```

**Use Case:** Compare how different personas react to the same content. Useful for:
- Testing content against multiple audience archetypes
- Getting diverse perspectives on the same video
- A/B testing persona responses

### `configs/multi-analysis.yaml` — Parallel Independent Analyses

```yaml
name: "Multi-Analysis Pipeline"
description: "Run independent analyses (emotion + brand + OCR) in parallel"
version: "1.0"

gather_context:
  - scripts/get-context/get-dialogue.cjs
  - scripts/get-context/get-music.cjs

# Independent analyses run in parallel, outputs merged after completion
process:
  parallel:
    - script: scripts/process/video-chunks.cjs
      soulPath: /home/derrick/.openclaw/workspace/projects/opentruth/emotion-engine/personas/souls/impatient-teenager/1.0.0/SOUL.md
      toolVariables:
        lenses: ["patience", "boredom", "excitement"]
    - script: scripts/process/brand-detection.cjs
      # Brand detection doesn't need persona config
    - script: scripts/process/ocr-extraction.cjs
      # OCR extraction doesn't need persona config

report:
  - scripts/report/evaluation.cjs
  - scripts/report/graphs.cjs
  - scripts/report/assets.cjs

settings:
  chunk_duration: 8
  max_chunks: 4
  api_request_delay: 1000
```

**Use Case:** Run multiple independent analysis types on the same video:
- **Emotion analysis:** How does the persona feel?
- **Brand detection:** What brands/logos appear?
- **OCR extraction:** What text is visible on screen?

**Benefit:** 3x faster than running sequentially (no dependencies between analyses).

---

## 🎯 Key Design Decisions

### 1. Asset Agnostic Pipeline

The pipeline orchestrator doesn't know if it's processing video, image, audio, or text. It just:
- Passes `assetPath` to scripts
- Scripts decide what to do with the asset

**Benefit:** Easy to add new asset types without changing orchestrator.

### 2. Sequential Process Phase

Process scripts run sequentially (not parallel), allowing each script to use output from previous scripts.

**Example:** `per-second.cjs` can use `chunkAnalysis` from `video-chunks.cjs`.

### 3. Flexible Context Gathering

Phase 1 can have 0 scripts (silent video), 1 script (dialogue only), or N scripts (dialogue + music + metadata).

**Benefit:** Pipelines can be tailored to asset type and analysis needs.

### 4. Standard Script Interface

All scripts export `async function run(input) { return output; }`.

**Benefit:** Scripts are interchangeable and testable in isolation.

### 5. Config-Driven Execution

Pipeline behavior is defined in YAML/JSON config files, not hardcoded.

**Benefit:** Easy to create custom pipelines without code changes.

---

## 🧪 Testing Strategy

### Unit Testing Scripts

```javascript
// test/scripts/get-dialogue.test.js
const { run } = require('../../server/scripts/get-context/get-dialogue.cjs');

test('get-dialogue extracts dialogue from video', async () => {
  const input = {
    assetPath: '/path/to/test-video.mp4',
    outputDir: '/tmp/test-output'
  };
  
  const result = await run(input);
  
  expect(result.contextArtifacts.dialogueData).toBeDefined();
  expect(result.contextArtifacts.dialogueData.dialogue_segments).toBeInstanceOf(Array);
});
```

### Integration Testing Pipelines

```bash
# Test full pipeline
node server/run-pipeline.cjs --config configs/video-analysis.yaml test-video.mp4 /tmp/test-output

# Validate outputs
test -f /tmp/test-output/FINAL-REPORT.md && echo "✅ Report generated"
test -f /tmp/test-output/03-chunked-analysis.json && echo "✅ Chunks analyzed"
```

---

## 🚀 Next Steps

1. **Implement orchestrator:** Update `server/run-pipeline.cjs` with config loading and phase execution
2. **Refactor scripts:** Migrate existing scripts to new `run(input)` interface
3. **Create configs:** Write YAML configs for common pipelines
4. **Test migration:** Verify old and new ways work side-by-side
5. **Document:** Add examples and troubleshooting guide

---

*Generated by OpenTruth Emotion Engine - Pipeline Design Module*
