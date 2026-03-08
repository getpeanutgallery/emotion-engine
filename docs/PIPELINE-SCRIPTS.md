# Emotion Engine v8.0 - Pipeline Scripts

> **Note:** This document was moved from `server/scripts/README.md` to keep script folders code-only and consolidate documentation under `docs/`.

This directory contains the AI-powered pipeline scripts that perform emotion analysis on video/audio/image assets.

## Directory Structure

```
server/scripts/
├── get-context/           # Phase 1: Gather Context scripts
│   ├── get-dialogue.cjs   # Extract and transcribe dialogue
│   └── get-music.cjs      # Extract and analyze music/audio
│
├── process/               # Phase 2: Process scripts
│   ├── video-chunks.cjs   # Analyze video in chunks with persona
│   └── video-per-second.cjs  # Generate per-second emotion scores
│
└── report/                # Phase 3: Report scripts
    └── evaluation.cjs     # Generate final evaluation report
```

## Scripts Overview

### Phase 1: Gather Context

#### get-dialogue.cjs

**Purpose:** Extract audio from video, transcribe speech, identify speakers.

**Input:**
```javascript
{
  assetPath: string,      // Path to video/audio file
  outputDir: string,      // Where to write artifacts
  config: object          // Pipeline config
}
```

**Output:**
```javascript
{
  artifacts: {
    dialogueData: {
      dialogue_segments: [{
        start: number,      // Start time in seconds
        end: number,        // End time in seconds
        speaker: string,    // Speaker ID
        text: string,       // Transcribed text
        confidence: number  // 0-1 confidence score
      }],
      summary: string,
      totalDuration: number
    }
  }
}
```

**Requirements:**
- `AI_API_KEY` environment variable
- FFmpeg available (provided via `ffmpeg-static`, or system `ffmpeg` if preferred)
- Model that supports audio transcription (e.g., Whisper)

**Usage:**
```bash
AI_API_KEY="your-key" node server/scripts/get-context/get-dialogue.cjs video.mp4 output/
```

---

#### get-music.cjs

**Purpose:** Extract and analyze music/audio from video to identify mood, intensity, and segments.

**Input:**
```javascript
{
  assetPath: string,
  outputDir: string,
  config: object
}
```

**Output:**
```javascript
{
  artifacts: {
    musicData: {
      segments: [{
        start: number,
        end: number,
        type: string,       // 'music', 'speech', 'silence', etc.
        description: string,
        mood: string,       // 'upbeat', 'calm', 'tense', etc.
        intensity: number   // 1-10
      }],
      summary: string,
      hasMusic: boolean
    }
  }
}
```

**Requirements:**
- `AI_API_KEY` environment variable
- FFmpeg available (provided via `ffmpeg-static`, or system `ffmpeg` if preferred)

**Usage:**
```bash
AI_API_KEY="your-key" node server/scripts/get-context/get-music.cjs video.mp4 output/
```

---

### Phase 2: Process

#### video-chunks.cjs

**Purpose:** Analyze video in chunks (e.g., 8-second segments) with persona-based emotion evaluation.

**Input:**
```javascript
{
  assetPath: string,
  outputDir: string,
  artifacts: {
    dialogueData: object,   // From get-dialogue.cjs
    musicData: object       // From get-music.cjs
  },
  toolVariables: {
    soulPath: string,       // Path to SOUL.md
    goalPath: string,       // Path to GOAL.md
    variables: {
      lenses: string[]      // Emotion lenses to evaluate
    }
  },
  config: object
}
```

**Output:**
```javascript
{
  artifacts: {
    chunkAnalysis: {
      chunks: [{
        chunkIndex: number,
        startTime: number,
        endTime: number,
        summary: string,
        emotions: {
          patience: { score: number, reasoning: string },
          boredom: { score: number, reasoning: string },
          excitement: { score: number, reasoning: string }
        },
        dominant_emotion: string,
        tokens: number
      }],
      totalTokens: number,
      persona: object,
      videoDuration: number
    }
  }
}
```

**Requirements:**
- `AI_API_KEY` environment variable
- FFmpeg available (provided via `ffmpeg-static`, or system `ffmpeg` if preferred)
- `tools/emotion-lenses-tool.cjs` available
- Persona files (SOUL.md, GOAL.md)

**Usage:**
```bash
AI_API_KEY="your-key" node server/scripts/process/video-chunks.cjs video.mp4 output/
```

---

#### video-per-second.cjs

**Purpose:** Generate emotion scores for every second of video by interpolating from chunk analysis.

**Input:**
```javascript
{
  assetPath: string,
  outputDir: string,
  artifacts: {
    chunkAnalysis: {      // From video-chunks.cjs
      chunks: [...],
      videoDuration: number
    }
  },
  config: object
}
```

**Output:**
```javascript
{
  artifacts: {
    perSecondData: {
      per_second_data: [{
        second: number,
        timestamp: number,
        emotions: {
          patience: { score: number },
          boredom: { score: number }
        },
        dominant_emotion: string,
        chunkIndex: number
      }],
      totalSeconds: number,
      totalTokens: number,
      summary: string
    }
  }
}
```

**Requirements:**
- `chunkAnalysis` artifact from video-chunks.cjs

**Usage:**
```bash
node server/scripts/process/video-per-second.cjs video.mp4 output/
```

---

### Phase 3: Report

#### evaluation.cjs

**Purpose:** Generate final evaluation report from all analysis data.

**Input:**
```javascript
{
  outputDir: string,
  artifacts: {
    dialogueData: object,     // From get-dialogue.cjs
    musicData: object,        // From get-music.cjs
    chunkAnalysis: object,    // From video-chunks.cjs
    perSecondData: object     // From video-per-second.cjs
  },
  config: object
}
```

**Output:**
```javascript
{
  artifacts: {
    reportFiles: {
      main: string,           // Path to FINAL-REPORT.md
      json: string            // Path to analysis-data.json
    },
    summary: {
      totalTokens: number,
      duration: number,
      keyMetrics: {
        avgPatience: number,
        avgBoredom: number,
        avgExcitement: number
      },
      recommendation: string
    }
  }
}
```

**Requirements:**
- All artifacts from previous phases
- `AI_API_KEY` environment variable (optional, for AI recommendation)

**Usage:**
```bash
AI_API_KEY="your-key" node server/scripts/report/evaluation.cjs output/
```

---

## Running the Full Pipeline

### Quick Test (2 chunks, ~16 seconds)

```bash
# Set environment variables
export AI_API_KEY="your-api-key"
export AI_MODEL="qwen/qwen-3.5-397b-a17b"

# Run quick test pipeline
cd /path/to/emotion-engine
node server/run-pipeline.cjs --config configs/quick-test.yaml
```

### Full Analysis

```bash
# Run full analysis pipeline
node server/run-pipeline.cjs --config configs/full-analysis.yaml
```

### Expected Output

```
output/full-analysis/
├── FINAL-REPORT.md          # Main evaluation report
├── analysis-data.json       # Raw JSON data
├── dialogue-data.json       # Dialogue transcription
├── music-data.json          # Music analysis
├── chunk-analysis.json      # Chunk-by-chunk analysis
└── per-second-data.json     # Per-second emotion data
```

---

## Testing

### Unit Tests

```bash
# Run all tests
npm test

# Run specific test file
node --test test/scripts/emotion-lenses-tool.test.js
```

### Manual Testing

**Test individual scripts:**

```bash
# Test get-dialogue
AI_API_KEY="key" node server/scripts/get-context/get-dialogue.cjs test.mp4 output/

# Test get-music
AI_API_KEY="key" node server/scripts/get-context/get-music.cjs test.mp4 output/

# Test video-chunks
AI_API_KEY="key" node server/scripts/process/video-chunks.cjs test.mp4 output/

# Test evaluation
AI_API_KEY="key" node server/scripts/report/evaluation.cjs output/
```

---

## Architecture

### Script Interface

All scripts export a single async function:

```javascript
async function run(input) {
  // Script logic here
  return { artifacts: {...} };
}

module.exports = { run };
```

### Artifact Flow

```
Phase 1 (Gather) → Phase 2 (Process) → Phase 3 (Report)
     ↓                    ↓                    ↓
dialogueData        chunkAnalysis        FINAL-REPORT.md
musicData           perSecondData        analysis-data.json
```

### AI Provider Integration

Scripts use the AI provider abstraction layer:

```javascript
const aiProvider = require('../../lib/ai-providers/ai-provider-interface.js');

const provider = aiProvider.getProviderFromEnv();
const response = await provider.complete({
  prompt: 'Your prompt here',
  model: process.env.AI_MODEL,
  apiKey: process.env.AI_API_KEY,
  attachments: [...]  // Optional: images, audio, video
});
```

### Storage Integration

Scripts use the storage abstraction layer:

```javascript
const storage = require('../../lib/storage/storage-interface.js');

// Write artifact
await storage.write('output/data.json', JSON.stringify(data));

// Read artifact
const data = await storage.read('output/data.json');
```

---

## Troubleshooting

### Common Issues

**1. "AI_API_KEY environment variable is required"**

Set the API key:
```bash
export AI_API_KEY="your-api-key"
```

**2. "ffmpeg not found"**

If you are not using the bundled FFmpeg (`ffmpeg-static`) and need a system install:

```bash
# Ubuntu/Debian
sudo apt-get install ffmpeg

# macOS
brew install ffmpeg
```

**3. "chunkAnalysis artifact is required"**

Ensure `video-chunks.cjs` runs before `video-per-second.cjs` in the pipeline config.

**4. "Failed to load persona"**

Check that `soulPath` and `goalPath` point to valid files:
```bash
ls -la /path/to/personas/souls/impatient-teenager/1.0.0/SOUL.md
```

---

## Contributing

When creating new scripts:

1. Follow the standard interface: `async function run(input) { return { artifacts }; }`
2. Document input/output contracts in JSDoc comments
3. Use AI provider abstraction (don't call APIs directly)
4. Use storage abstraction (don't use fs directly)
5. Write unit tests in `test/scripts/`
6. Add example config in `configs/`

---

*Emotion Engine v8.0 - Generated 2026-03-04*
