# Modular Pipeline Workflow Engine

**Version:** 1.0  
**Date:** 2026-03-04  
**Status:** Design Specification

---

## 🎯 Core Insight

The pipeline should be a **workflow orchestrator** with three phases, each accepting 0-N pluggable scripts:

```
Phase 1: Gather Context (0-N scripts, OPTIONAL)
  - scripts/get-context/get-dialogue.cjs
  - scripts/get-context/get-music.cjs
  - scripts/get-context/get-metadata.cjs
  - (or none, for silent video)

Phase 2: Process (0-N scripts, OPTIONAL)
  - scripts/process/video-chunks.cjs
  - scripts/process/video-per-second.cjs
  - scripts/process/image-frames.cjs (for images)
  - scripts/process/audio-segments.cjs (for audio)

Phase 3: Report (0-N scripts, OPTIONAL)
  - scripts/report/evaluation.cjs
  - scripts/report/graphs.cjs
  - scripts/report/assets.cjs
```

**Key Rule:** At least 1 script must exist somewhere in the pipeline (across all phases combined).

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
│   (0-N scripts)   │     │   (0-N scripts)   │     │   (0-N scripts)   │
│                   │     │                   │     │                   │
│ • get-dialogue    │     │ • video-chunks    │     │ • evaluation      │
│ • get-music       │     │ • video-per-second│     │ • graphs          │
│ • get-metadata    │     │ • image-frames    │     │ • assets          │
└───────────────────┘     └───────────────────┘     └───────────────────┘
        │                           │                           │
        │                           │                           │
        ▼                           ▼                           ▼
┌───────────────────┐     ┌───────────────────┐     ┌───────────────────┐
│    artifacts      │     │    artifacts      │     │    artifacts      │
│  (script-defined) │────▶│  (script-defined) │────▶│  (script-defined) │
│                   │     │                   │     │                   │
│  [accumulates]    │     │  [accumulates]    │     │  [final output]   │
└───────────────────┘     └───────────────────┘     └───────────────────┘
```

### Artifact Flow Between Phases

```
┌──────────────────────────────────────────────────────────────────────────┐
│                         PHASE CONTRACTS                                  │
│                                                                          │
│  ⚠️  IMPORTANT: The pipeline does not validate or enforce specific      │
│  field names in artifacts. Each script documents its own input/output   │
│  contract. Scripts are responsible for validating that required         │
│  artifacts are present.                                                  │
└──────────────────────────────────────────────────────────────────────────┘

Phase 1: Gather Context
┌─────────────────────────────────────────────────────────────────────────┐
│  INPUT:  {                                                              │
│            assetPath: string,      // Path to source asset              │
│            outputDir: string,      // Where to write artifacts          │
│            config: object          // Pipeline config (optional)        │
│          }                                                              │
│  OUTPUT: {                                                              │
│            artifacts: object       // Script-defined structure          │
│          }                                                              │
│                                                                         │
│  Scripts run: 0-N (can skip entirely for silent video)                  │
│  Execution: Sequential or Parallel (no dependencies between scripts)    │
└─────────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
Phase 2: Process
┌─────────────────────────────────────────────────────────────────────────┐
│  INPUT:  {                                                              │
│            assetPath: string,                                           │
│            outputDir: string,                                           │
│            artifacts: object,      // From previous phases              │
│            toolPath?: string,      // Optional: path to tool script     │
│            toolVariables?: object, // Optional: tool config             │
│            config: object                                               │
│          }                                                              │
│  OUTPUT: {                                                              │
│            artifacts: object       // Script-defined structure          │
│          }                                                              │
│                                                                         │
│  Scripts run: 0-N (OPTIONAL)                                            │
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
│            artifacts: object,      // From previous phases              │
│            outputDir: string                                            │
│          }                                                              │
│  OUTPUT: {                                                              │
│            artifacts: object       // Script-defined structure          │
│          }                                                              │
│                                                                         │
│  Scripts run: 0-N (OPTIONAL)                                            │
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

# Phase 2: Process (optional, 0-N scripts)
process:
  - scripts/process/video-chunks.cjs
  - scripts/process/video-per-second.cjs

# Phase 3: Report (optional, 0-N scripts)
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
    "scripts/process/video-per-second.cjs"
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

  // Phase 2: Process (optional, 0-N scripts)
  // Can be sequential (array) or parallel (object with parallel array)
  process?: string[] | { parallel: ProcessItem[] };

  // Phase 3: Report (optional, 0-N scripts)
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

| Phase            | Required   | Min Scripts | Max Scripts | Notes                                                   |
| ---------------- | ---------- | ----------- | ----------- | ------------------------------------------------------- |
| `gather_context` | ❌ Optional | 0           | N           | Can be omitted for silent video                         |
| `process`        | ❌ Optional | 0           | N           | Can be omitted for gather-only or report-only pipelines |
| `report`         | ❌ Optional | 0           | N           | Can be omitted for raw analysis output                  |

**Validation Rule:** The pipeline must have at least 1 script across all phases combined.

```javascript
// Validation logic in run-pipeline.cjs
const totalScripts = 
  (config.gather_context?.length || 0) +
  (config.process?.length || 0) +
  (config.report?.length || 0);

if (totalScripts < 1) {
  throw new Error('Pipeline must have at least 1 script in any phase');
}
```

### Valid Phase-Skipping Use Case Examples

**1. Gather + Report (skip Process):**

```yaml
gather_context:
  - scripts/get-context/get-dialogue.cjs
process: []  # Skip
report:
  - scripts/report/dialogue-summary.cjs
```

→ Transcribe audio, generate dialogue summary (no persona evaluation)

**2. Process Only (skip Gather + Report):**

```yaml
gather_context: []  # Skip
process:
  - scripts/process/video-chunks.cjs
report: []  # Skip
```

→ Just run analysis, output raw JSON

**3. Gather Only (skip Process + Report):**

```yaml
gather_context:
  - scripts/get-context/get-metadata.cjs
process: []  # Skip
report: []  # Skip
```

→ Just extract metadata, done

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
  - scripts/process/video-per-second.cjs  # Receives output from video-chunks
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

**Input Contract (Generic):**

```javascript
{
  assetPath: string,      // Path to source asset
  outputDir: string,      // Where to write artifacts
  config: object          // Pipeline config (optional metadata)
}
```

**Output Contract (Generic):**

```javascript
{
  artifacts: object       // Script-defined structure (pipeline doesn't validate)
}
```

> **Note:** The specific structure of `artifacts` is defined by each script. See the "Example Script Contracts" section below for concrete examples.

**Example: `scripts/get-context/get-dialogue.cjs`**

```javascript
#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

async function run(input) {
  const { assetPath, outputDir, config } = input;

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
    artifacts: {
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

**Input Contract (Generic):**

```javascript
{
  assetPath: string,
  outputDir: string,
  artifacts: object,      // From previous phases (structure unknown to pipeline)
  toolPath?: string,      // Optional: path to tool script
  toolVariables?: object, // Optional: tool config
  config: object
}
```

**Output Contract (Generic):**

```javascript
{
  artifacts: object       // Script-defined structure (pipeline doesn't validate)
}
```

> **Note:** The specific structure of `artifacts` is defined by each script. See the "Example Script Contracts" section below for concrete examples.

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
    artifacts,        // Generic: contains output from previous phases
    toolPath, 
    toolVariables,
    outputDir, 
    config
  } = input;

  console.log('🎬 Processing video chunks...');

  // Load persona configuration (using paths, not IDs)
  const personaConfig = personaLoader.loadPersonaConfig(
    toolVariables.soulPath,
    toolVariables.goalPath
  );

  // Get video duration
  const duration = await getDuration(assetPath);
  const chunkDuration = config?.chunk_duration || 8;
  const numChunks = Math.ceil(duration / chunkDuration);

  const results = [];
  let previousSummary = '';

  // Process each chunk
  for (let i = 0; i < numChunks && i < (config?.max_chunks || numChunks); i++) {
    const startTime = i * chunkDuration;
    const endTime = Math.min(startTime + chunkDuration, duration);

    // Extract relevant context for this chunk
    // Note: Script validates that required artifacts exist
    const dialogueContext = getRelevantDialogue(
      artifacts.dialogueData, 
      startTime, 
      endTime
    );
    const musicContext = getRelevantMusic(
      artifacts.musicData, 
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
    artifacts: {
      chunkAnalysis: {
        chunks: results,
        totalTokens: results.reduce((sum, r) => sum + r.tokens, 0),
        persona: {
          soulPath: toolVariables.soulPath,
          config: personaConfig
        }
      }
    }
  };
}

module.exports = { run };
```

### Phase 3: Report Scripts

**Input Contract (Generic):**

```javascript
{
  artifacts: object,      // From previous phases (structure unknown to pipeline)
  outputDir: string
}
```

**Output Contract (Generic):**

```javascript
{
  artifacts: object       // Script-defined structure (pipeline doesn't validate)
}
```

> **Note:** The specific structure of `artifacts` is defined by each script. See the "Example Script Contracts" section below for concrete examples.

---

## 📝 Example Script Contracts

The pipeline uses generic contracts (shown above). Each script defines its own specific input/output structure. Below are examples of how scripts should document their contracts.

### Example: Video Analysis Scripts

**`scripts/get-context/get-dialogue.cjs`**

```javascript
// scripts/get-context/get-dialogue.cjs
/**
 * @input
 * @property {string} assetPath - Video/audio file path
 * @property {string} outputDir - Output directory path
 * @property {object} config - Pipeline config (optional)
 * 
 * @output
 * @property {object} artifacts.dialogueData - Transcription results
 * @property {Array} artifacts.dialogueData.dialogue_segments - Dialogue segments
 * @property {string} artifacts.dialogueData.summary - Summary text
 */
```

**`scripts/process/video-chunks.cjs`**

```javascript
// scripts/process/video-chunks.cjs
/**
 * @input
 * @property {string} assetPath - Video file path
 * @property {string} outputDir - Output directory path
 * @property {object} artifacts - Must include dialogueData from get-dialogue.cjs
 * @property {string} toolPath - Path to emotion-lenses-tool.cjs
 * @property {object} toolVariables - Must include lenses array
 * @property {object} config - Pipeline config
 * 
 * @output
 * @property {object} artifacts.chunkAnalysis - Array of chunk analysis results
 * @property {Array} artifacts.chunkAnalysis.chunks - Chunk results
 * @property {number} artifacts.chunkAnalysis.totalTokens - Token count
 * @property {object} artifacts.chunkAnalysis.persona - Persona info
 */
```

**`scripts/process/video-per-second.cjs`**

```javascript
// scripts/process/video-per-second.cjs
/**
 * @input
 * @property {string} assetPath - Video file path
 * @property {string} outputDir - Output directory path
 * @property {object} artifacts - Must include chunkAnalysis from video-chunks.cjs
 * @property {object} config - Pipeline config
 * 
 * @output
 * @property {object} artifacts.perSecondData - Per-second emotion data
 * @property {Array} artifacts.perSecondData.per_second_data - Second-by-second data
 * @property {number} artifacts.perSecondData.totalTokens - Token count
 */
```

### Script Documentation Pattern

Scripts should document their contracts using JSDoc-style comments at the top of the file:

```javascript
// scripts/process/video-chunks.cjs
/**
 * @input
 * @property {string} assetPath - Video file path
 * @property {object} artifacts - Must include dialogueSummary from get-dialogue.cjs
 * @property {string} toolPath - Path to emotion-lenses-tool.cjs
 * @property {object} toolVariables - Must include lenses array
 * 
 * @output
 * @property {object} artifacts.chunkAnalysis - Array of chunk analysis results
 */
```

**Key Points:**

- Scripts document their **own** input/output contracts
- Scripts specify which artifacts they **require** from previous phases
- The pipeline does **not** validate artifact structure — scripts do
- Use clear `@property` annotations for each expected field

---

**Example: `scripts/report/evaluation.cjs`**

```javascript
#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

async function run(input) {
  const { artifacts, outputDir, config } = input;

  console.log('📊 Generating evaluation report...');

  // Extract artifacts from previous phases
  const { chunkAnalysis } = artifacts;
  const { dialogueData, musicData } = artifacts;

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
    artifacts: {
      reportFiles: {
        main: reportPath
      },
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
│   │   │   ├── video-per-second.cjs     # (from 04-per-second-emotions.cjs)
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

| Current Script                      | New Location                                  | Phase          | Notes                                  |
| ----------------------------------- | --------------------------------------------- | -------------- | -------------------------------------- |
| `server/01-extract-dialogue.cjs`    | `server/scripts/get-context/get-dialogue.cjs` | Gather Context | Refactor to use `run(input)` interface |
| `server/02-extract-music.cjs`       | `server/scripts/get-context/get-music.cjs`    | Gather Context | Refactor to use `run(input)` interface |
| `server/03-analyze-chunks.cjs`      | `server/scripts/process/video-chunks.cjs`     | Process        | Refactor to use `run(input)` interface |
| `server/04-per-second-emotions.cjs` | `server/scripts/process/video-per-second.cjs`       | Process        | Refactor to use `run(input)` interface |
| `server/generate-report.cjs`        | `server/scripts/report/evaluation.cjs`        | Report         | Refactor to use `run(input)` interface |

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
   # Old way (v5.0 - no longer supported in v6.0)
   node server/run-pipeline.cjs --config configs/video-analysis.yaml video.mp4 output/
   
   # New way (v6.0 - asset paths are in the YAML file)
   node server/run-pipeline.cjs --config configs/video-analysis.yaml
   ```

---

## 🖥️ CLI Interface

### YAML-Only Configuration (v4.0+)

**The pipeline accepts ONLY a config file.** The YAML file contains ALL configuration including asset paths and output directory. CLI arguments for asset-path and output-dir have been removed.

```bash
# Pipeline (YAML only - asset paths are IN the YAML file)
node server/run-pipeline.cjs --config configs/video-analysis.yaml
```

**Example YAML with asset paths:**
```yaml
# configs/video-analysis.yaml
asset:
  inputPath: ".cache/videos/cod.mp4"
  outputDir: "output/cod-test"

gather_context:
  - scripts/get-context/get-dialogue.cjs
  - scripts/get-context/get-music.cjs

process:
  sequential:
    - script: scripts/process/video-chunks.cjs
      toolPath: tools/emotion-lenses-tool.cjs
      tool_variables:
        soulPath: /path/to/SOUL.md
        goalPath: /path/to/GOAL.md
        variables:
          lenses: [patience, boredom, excitement]
    - script: scripts/process/video-per-second.cjs
      toolPath: tools/emotion-lenses-tool.cjs
      tool_variables:
        soulPath: /path/to/SOUL.md
        goalPath: /path/to/GOAL.md
        variables:
          lenses: [patience, boredom, excitement]

report:
  - scripts/report/evaluation.cjs
  - scripts/report/graphs.cjs
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
  --chunks 4

# Wrapper generates YAML (with asset paths) and calls pipeline:
# node server/run-pipeline.cjs --config /tmp/generated-config.yaml
```

### CLI Arguments

```
Usage: node server/run-pipeline.cjs --config <config-file>

Options:
  --config <path>           Path to YAML/JSON config file (REQUIRED)
  --verbose                 Enable verbose logging
  --dry-run                 Validate config without executing

Note: Asset paths (inputPath and outputDir) are specified in the YAML config file,
not as CLI arguments. This ensures reproducible, source-controllable pipeline runs.
```

### Example Commands

```bash
# Full video analysis (asset paths are in the YAML file)
node server/run-pipeline.cjs --config configs/video-analysis.yaml

# Image analysis
node server/run-pipeline.cjs --config configs/image-analysis.yaml

# Audio analysis
node server/run-pipeline.cjs --config configs/audio-analysis.yaml

# Quick test (minimal pipeline)
node server/run-pipeline.cjs --config configs/quick-test.yaml

# Multi-persona swarm (parallel execution)
node server/run-pipeline.cjs --config configs/multi-persona-swarm.yaml

# Multi-analysis (parallel independent analyses)
node server/run-pipeline.cjs --config configs/multi-analysis.yaml
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

  // Initialize artifacts (generic, accumulates across phases)
  let artifacts = {};

  // Phase 1: Gather Context (0-N scripts)
  if (config.gather_context) {
    console.log('📥 Phase 1: Gather Context');
    for (const scriptPath of config.gather_context) {
      const result = await runScript(scriptPath, { assetPath, outputDir, config });
      artifacts = { ...artifacts, ...result.artifacts };
    }
  }

  // Phase 2: Process (1-N scripts, sequential)
  console.log('⚙️  Phase 2: Process');
  for (const scriptPath of config.process) {
    const result = await runScript(scriptPath, {
      assetPath,
      artifacts,              // Generic: all previous artifacts
      toolPath: config.tool_path,
      toolVariables: config.tool_variables,
      outputDir,
      config
    });
    artifacts = { ...artifacts, ...result.artifacts };
  }

  // Phase 3: Report (1-N scripts)
  console.log('📊 Phase 3: Report');
  for (const scriptPath of config.report) {
    const result = await runScript(scriptPath, {
      artifacts,
      outputDir,
      config
    });
    artifacts = { ...artifacts, ...result.artifacts };
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
  // Count total scripts across all phases
  const gatherCount = Array.isArray(config.gather_context) 
    ? config.gather_context.length 
    : config.gather_context?.parallel?.length || 0;

  const processCount = Array.isArray(config.process) 
    ? config.process.length 
    : config.process?.parallel?.length || 0;

  const reportCount = Array.isArray(config.report) 
    ? config.report.length 
    : config.report?.parallel?.length || 0;

  const totalScripts = gatherCount + processCount + reportCount;

  // Only validation: at least 1 script somewhere in the pipeline
  if (totalScripts < 1) {
    throw new Error('Pipeline must have at least 1 script in any phase');
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
  - scripts/process/video-per-second.cjs

report:
  - scripts/report/evaluation.cjs
  - scripts/report/graphs.cjs
  - scripts/report/assets.cjs

settings:
  chunk_duration: 8
  max_chunks: 4
  api_request_delay: 1000
  chunk_quality: "medium"

asset:
  inputPath: ".cache/videos/cod.mp4"
  outputDir: "output/cod-test"

tool_variables:
  soulPath: "/absolute/path/to/personas/souls/impatient-teenager/1.0.0/SOUL.md"
  goalPath: "/absolute/path/to/personas/goals/video-ad-evaluation/1.0.0/GOAL.md"
  variables:
    lenses:
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

asset:
  inputPath: ".cache/images/sample.png"
  outputDir: "output/image-test"

tool_variables:
  soulPath: "/absolute/path/to/personas/souls/impatient-teenager/1.0.0/SOUL.md"
  goalPath: "/absolute/path/to/personas/goals/image-evaluation/1.0.0/GOAL.md"
  variables:
    lenses:
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

asset:
  inputPath: ".cache/audio/podcast.mp3"
  outputDir: "output/audio-test"

tool_variables:
  soulPath: "/absolute/path/to/personas/souls/impatient-teenager/1.0.0/SOUL.md"
  goalPath: "/absolute/path/to/personas/goals/audio-evaluation/1.0.0/GOAL.md"
  variables:
    lenses:
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

### `configs/dialogue-transcription.yaml` — Gather + Report (Skip Process)

```yaml
name: "Dialogue Transcription Pipeline"
description: "Transcribe audio and generate summary (no persona evaluation)"
version: "1.0"

# Gather dialogue from audio/video
gather_context:
  - scripts/get-context/get-dialogue.cjs

# Skip persona-based processing
process: []

# Generate transcription summary report
report:
  - scripts/report/dialogue-summary.cjs

settings:
  api_request_delay: 1000
```

**Use Case:** Transcribe meetings, interviews, or podcasts without persona evaluation. Outputs clean dialogue transcript with speaker identification and summary.

### `configs/raw-analysis.yaml` — Process Only (Skip Gather + Report)

```yaml
name: "Raw Analysis Pipeline"
description: "Run analysis and output raw JSON (no context gathering, no report)"
version: "1.0"

# Skip context gathering
gather_context: []

# Run analysis only
process:
  - scripts/process/video-chunks.cjs

# Skip report generation (raw JSON output only)
report: []

settings:
  chunk_duration: 8
  max_chunks: 4
  api_request_delay: 1000

asset:
  inputPath: ".cache/videos/cod.mp4"
  outputDir: "output/raw-test"

tool_variables:
  soulPath: "/absolute/path/to/personas/souls/impatient-teenager/1.0.0/SOUL.md"
  goalPath: "/absolute/path/to/personas/goals/video-ad-evaluation/1.0.0/GOAL.md"
  variables:
    lenses:
      - patience
      - boredom
      - excitement
```

**Use Case:** Generate raw analysis data for downstream processing, integration with other tools, or custom reporting pipelines.

### `configs/metadata-extract.yaml` — Gather Only (Skip Process + Report)

```yaml
name: "Metadata Extraction Pipeline"
description: "Extract video/audio metadata only (no analysis, no report)"
version: "1.0"

# Extract metadata only
gather_context:
  - scripts/get-context/get-metadata.cjs

# Skip processing
process: []

# Skip report generation
report: []
```

**Use Case:** Quick metadata extraction for cataloging, indexing, or validation purposes. Outputs duration, resolution, codec, fps, etc.

---

## 🎯 Key Design Decisions

### 1. Asset Agnostic Pipeline

The pipeline orchestrator doesn't know if it's processing video, image, audio, or text. It just:

- Passes `assetPath` to scripts
- Scripts decide what to do with the asset

**Benefit:** Easy to add new asset types without changing orchestrator.

### 2. Minimal Validation

Pipeline requires only 1 script total (in any phase). All phases are optional.

**Example:** You can run a pipeline with just a Process script, or just Gather + Report, or any combination.

**Validation Rule:**
```javascript
const totalScripts = 
  (config.gather_context?.length || 0) +
  (config.process?.length || 0) +
  (config.report?.length || 0);

if (totalScripts < 1) {
  throw new Error('Pipeline must have at least 1 script in any phase');
}
```

**Benefit:** Maximum flexibility for specialized workflows (transcription-only, analysis-only, metadata-only, etc.).

### 3. Flexible Context Gathering

Phase 1 can have 0 scripts (silent video), 1 script (dialogue only), or N scripts (dialogue + music + metadata).

**Benefit:** Pipelines can be tailored to asset type and analysis needs.

### 4. Standard Script Interface

All scripts export `async function run(input) { return output; }`.

**Benefit:** Scripts are interchangeable and testable in isolation.

### 5. Config-Driven Execution

Pipeline behavior is defined in YAML/JSON config files, not hardcoded.

**Benefit:** Easy to create custom pipelines without code changes.

### 6. AI Provider Abstraction

Tools use a provider-agnostic interface for AI completions. API keys are injected at runtime via environment variables (never in YAML).

**Interface:**
```javascript
const aiProvider = require('../server/lib/ai-providers/ai-provider-interface.js');

const response = await aiProvider.complete({
  prompt: buildPrompt(input),
  model: process.env.AI_MODEL,
  apiKey: process.env.AI_API_KEY,  // Injected at runtime
  baseUrl: process.env.AI_BASE_URL,
});
```

**Providers:** OpenRouter, Anthropic, Gemini, OpenAI, Azure OpenAI (planned)

**Benefits:**
- ✅ Git-safe configs (no API keys in YAML)
- ✅ Easy provider switching (change env var)
- ✅ Provider-agnostic tools
- ✅ Standardized interface across all AI operations
- ✅ Multi-modal support (video, audio, images, files)

**See:** [`docs/AI-PROVIDER-ARCHITECTURE.md`](AI-PROVIDER-ARCHITECTURE.md) for full specification.

---

## 💾 Storage Abstraction

### Overview

The Emotion Engine uses a pluggable storage interface that allows scripts to be storage-agnostic. Scripts write to and read from storage without knowing whether they're using local filesystem, AWS S3, Google Cloud Storage, or Azure Blob Storage.

### Architecture

```
┌─────────────────────────────────────────┐
│           Script Layer                  │
│  (scripts/process/video-chunks.cjs)     │
│                                         │
│  const storage = require(               │
│    '../../server/lib/storage/           │
│    storage-interface.js'                │
│  );                                     │
│                                         │
│  await storage.write(                   │
│    'output/chunk-1.json',               │
│    JSON.stringify(data)                 │
│  );                                     │
└─────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────┐
│      Storage Interface                  │
│  (storage-interface.js)                 │
│                                         │
│  - write(path, data, options)           │
│  - read(path)                           │
│  - exists(path)                         │
│  - list(prefix)                         │
│  - getUrl(path)                         │
│  - delete(path)                         │
└─────────────────────────────────────────┘
          │           │           │
          ▼           ▼           ▼
    ┌──────────┐ ┌──────────┐ ┌──────────┐
    │ local-fs │ │  aws-s3  │ │   gcs    │
    └──────────┘ └──────────┘ └──────────┘
```

### Configuration

**YAML Config (git-safe, no secrets):**

```yaml
# configs/video-analysis.yaml
asset:
  inputPath: ".cache/videos/cod.mp4"
  outputDir: "output/cod-test"

# Storage configuration
storage:
  provider: aws-s3  # or local-fs, gcs, azure-blob
  bucket: my-emotion-engine-bucket
  region: us-east-1

ai:
  provider: openrouter
  model: qwen/qwen-3.5-397b-a17b
```

**Environment Variables:**

```bash
# Local (default)
STORAGE_PROVIDER=local-fs

# AWS S3
STORAGE_PROVIDER=aws-s3
AWS_ACCESS_KEY_ID=$AWS_ACCESS_KEY_ID
AWS_SECRET_ACCESS_KEY=$AWS_SECRET_ACCESS_KEY
AWS_REGION=us-east-1
S3_BUCKET=my-emotion-engine-bucket

# Google Cloud Storage
STORAGE_PROVIDER=gcs
GOOGLE_APPLICATION_CREDENTIALS=$GCP_CREDENTIALS_JSON
GCS_BUCKET=my-emotion-engine-bucket
```

### Usage in Scripts

**Write Artifact:**

```javascript
const storage = require('../../server/lib/storage/storage-interface.js');

async function run(input) {
  const { outputDir } = input;
  
  // Write artifact (doesn't know if local or S3)
  const artifactPath = await storage.write(
    `output/${outputDir}/chunk-1.json`,
    JSON.stringify(chunkData, null, 2)
  );
  
  return { artifacts: { chunkAnalysis: [{ path: artifactPath }] } };
}
```

**Read Artifact:**

```javascript
// Check if exists
if (await storage.exists('output/metadata.json')) {
  // Read artifact
  const data = await storage.read('output/metadata.json');
  const metadata = JSON.parse(data.toString());
  
  // Process metadata...
}
```

**List Artifacts:**

```javascript
// List all chunk files
const chunks = await storage.list('output/chunk-');
// ['output/chunk-1.json', 'output/chunk-2.json', ...]

for (const chunkPath of chunks) {
  const data = await storage.read(chunkPath);
  // Process each chunk...
}
```

**Get Public URL:**

```javascript
// Get shareable URL for report
const reportUrl = await storage.getUrl('output/FINAL-REPORT.md');
console.log(`Report available at: ${reportUrl}`);
```

### Provider Comparison

| Provider | Best For | Cost | Setup |
|----------|----------|------|-------|
| **local-fs** | Development, local testing | Free | ⭐ Easy |
| **aws-s3** | Production, large scale | Pay-per-use | ⭐⭐ Medium |
| **gcs** | GCP ecosystems, ML workloads | Pay-per-use | ⭐⭐ Medium |
| **azure-blob** | Azure ecosystems, enterprise | Pay-per-use | ⭐⭐ Medium |

### Benefits

- ✅ **Pluggable Storage**: Switch between local, S3, GCS, Azure without code changes
- ✅ **Provider-agnostic Scripts**: Scripts don't know which storage backend they're using
- ✅ **Git-safe Configs**: Storage configuration in YAML, credentials in environment
- ✅ **Standardized Interface**: All storage providers implement the same contract
- ✅ **Easy Testing**: Use local-fs for development, S3 for production

**See:** [`docs/STORAGE-ARCHITECTURE.md`](STORAGE-ARCHITECTURE.md) for full specification.

---

## 🧪 Testing Strategy

### Unit Testing Scripts

```javascript
// test/scripts/get-dialogue.test.js
const { run } = require('../../server/scripts/get-context/get-dialogue.cjs');

test('get-dialogue extracts dialogue from video', async () => {
  const input = {
    assetPath: '/path/to/test-video.mp4',
    outputDir: '/tmp/test-output',
    config: {}
  };

  const result = await run(input);

  expect(result.artifacts.dialogueData).toBeDefined();
  expect(result.artifacts.dialogueData.dialogue_segments).toBeInstanceOf(Array);
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
