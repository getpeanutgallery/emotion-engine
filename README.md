# Emotion Engine v8.0

**Modular, tool-agnostic AI workflow engine for multi-modal emotion analysis**

---

## Overview

Emotion Engine is a **3-phase modular pipeline** that orchestrates AI-powered analysis of video, audio, and image content. It extracts context (dialogue, music, visuals), processes it through customizable scripts, and generates structured reports with emotion scores, recommendations, and visual charts.

The system is **provider-agnostic** — swap AI models (OpenRouter, Anthropic, Gemini, OpenAI) and storage backends (Local FS, AWS S3) without changing your pipeline scripts. Configuration is driven by YAML files, making workflows reproducible and git-safe.

**Current Focus:** Video emotion analysis for ad evaluation, using persona-driven AI analysis to score emotional engagement, dialogue quality, music mood, and visual patterns.

---

## Current Architecture

### 3-Phase Pipeline

```
┌─────────────────────────────────────────────────────────────┐
│  PHASE 1: GATHER CONTEXT                                    │
│  └─ Extract raw data: dialogue (transcription), music       │
│     (mood/intensity segments), metadata                     │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  PHASE 2: PROCESS                                           │
│  └─ Analyze video chunks, per-second emotions, visual       │
│     patterns with AI + persona lenses                       │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  PHASE 3: REPORT                                            │
│  └─ Generate JSON artifacts, SVG charts, markdown summaries │
│     with emotional analysis, metrics, recommendations       │
└─────────────────────────────────────────────────────────────┘
```

### Folder Structure

```
emotion-engine/
├── server/
│   ├── lib/
│   │   ├── storage/                # Storage abstraction
│   │   │   ├── storage-interface.js
│   │   │   └── providers/
│   │   │       ├── local-fs.cjs    # Default: local filesystem
│   │   │       └── aws-s3.cjs      # Cloud storage
│   │   ├── chunk-strategies/       # Video chunking logic
│   │   ├── artifact-manager.cjs    # Manages pipeline artifacts
│   │   ├── config-loader.cjs       # YAML config parser
│   │   ├── persona-loader.cjs      # Loads SOUL/GOAL/TOOLS from packages
│   │   ├── cli-parser.cjs          # CLI argument parsing
│   │   ├── output-manager.cjs      # Output file management
│   │   └── video-chunk-extractor.cjs # FFmpeg video processing
│   ├── scripts/
│   │   ├── get-context/            # Phase 1: Data extraction
│   │   │   ├── get-dialogue.cjs    # Audio transcription
│   │   │   └── get-music.cjs       # Music/mood analysis
│   │   ├── process/                # Phase 2: Analysis
│   │   │   ├── video-chunks.cjs    # Chunk-based emotion analysis
│   │   │   └── video-per-second.cjs # Per-second emotion scoring
│   │   └── report/                 # Phase 3: Output generation
│   │       ├── emotional-analysis.cjs
│   │       ├── metrics.cjs
│   │       ├── recommendation.cjs
│   │       ├── summary.cjs
│   │       └── final-report.cjs
│   └── run-pipeline.cjs            # Main orchestrator
├── configs/                        # YAML pipeline configurations
│   ├── video-analysis.yaml         # Full video analysis
│   ├── cod-test.yaml               # Test configuration
│   ├── quick-test.yaml             # Lightweight test
│   └── ... (12 total configs)
├── bin/
│   └── run-analysis.js             # User-friendly CLI wrapper
├── docs/                           # Technical documentation
│   ├── MODULAR-PIPELINE-WORKFLOW.md
│   ├── STORAGE-ARCHITECTURE.md
│   └── AI-PROVIDER-ARCHITECTURE.md
├── examples/
│   └── videos/
│       └── emotion-tests/          # Test video assets
│           └── cod.mp4             # Current test video (62 MB)
├── test/                           # Unit + integration tests
│   ├── ai-providers/
│   ├── pipeline/
│   ├── scripts/
│   └── storage/
├── output/                         # Pipeline output artifacts
├── .env.example                    # Environment variable template
├── package.json
└── README.md

# Package Dependencies (installed via pnpm/npm):
# - cast/              → Personas (SOUL.md files)
# - goals/             → Goal definitions (GOAL.md files)
# - tools/             → Tool scripts (e.g., emotion-lenses-tool.cjs)
# - ai-providers/      → AI provider interface
# - retry-strategy/    → Retry logic implementations
```

---

## Tech Stack

**Runtime:**
- Node.js >= 18.0.0 (CommonJS modules)
- FFmpeg & FFprobe — **automatically installed via `ffmpeg-static` and `ffprobe-static` packages** (no manual installation required!)

**Dependencies:**
- `@aws-sdk/client-s3` — AWS S3 storage backend
- `axios` — HTTP client for API calls
- `dotenv` — Environment variable management
- `js-yaml` — YAML configuration parsing
- `ffmpeg-static` — Cross-platform FFmpeg binary (auto-installed)
- `ffprobe-static` — Cross-platform FFprobe binary (auto-installed)
- `cast` — Persona definitions (SOUL.md files) - [GitHub](https://github.com/getpeanutgallery/cast)
- `goals` — Goal definitions (GOAL.md files) - [GitHub](https://github.com/getpeanutgallery/goals)
- `tools` — Composable tool scripts - [GitHub](https://github.com/getpeanutgallery/tools)
- `ai-providers` — AI provider interface - [GitHub](https://github.com/getpeanutgallery/ai-providers)
- `retry-strategy` — Retry logic implementations - [GitHub](https://github.com/getpeanutgallery/retry-strategy)

**AI Providers:**
- OpenRouter (multi-model gateway)
- Anthropic (Claude)
- Google Gemini
- OpenAI (GPT)

**Storage Backends:**
- Local filesystem (default)
- AWS S3

**Testing:**
- Node.js native test runner (`node --test`)
- 70+ unit tests across AI providers, pipeline, scripts, and storage

---

## Quick Start

### 1. Install

```bash
pnpm install
# or: npm install
```

**Note:** FFmpeg is now automatically installed via the `ffmpeg-static` package. No manual installation required!

### 2. Configure

Copy `.env.example` to `.env` and set your API keys:

```bash
cp .env.example .env
```

Required environment variables (depending on your AI provider):
- `OPENROUTER_API_KEY` — For OpenRouter (recommended)
- `ANTHROPIC_API_KEY` — For Anthropic/Claude
- `GEMINI_API_KEY` — For Google Gemini
- `OPENAI_API_KEY` — For OpenAI/GPT

Optional (for cloud storage):
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `AWS_REGION`
- `STORAGE_PROVIDER=s3`
- `STORAGE_BUCKET=your-bucket-name`

### 3. Run a Pipeline

```bash
# Using the user-friendly CLI (flat paths, no versioning)
node bin/run-analysis.js \
  --soul impatient-teenager \
  --goal video-ad-evaluation \
  --tool emotion-lenses \
  path/to/video.mp4 \
  output/

# Or directly with pipeline orchestrator
pnpm run pipeline --config configs/video-analysis.yaml
```

**Note:** Personas, goals, and tools are loaded from package dependencies:
- **Personas:** [cast repo](https://github.com/getpeanutgallery/cast) - Path format: `cast/<persona>/SOUL.md` (e.g., `cast/impatient-teenager/SOUL.md`)
- **Goals:** [goals repo](https://github.com/getpeanutgallery/goals) - Path format: `goals/<goal-name>.md` (e.g., `goals/video-ad-evaluation.md`)
- **Tools:** [tools repo](https://github.com/getpeanutgallery/tools) - Path format: `tools/<tool-name>.cjs` (e.g., `tools/emotion-lenses-tool.cjs`)

The old `personas/`, `tools/`, and `goals/` folders have been extracted into separate packages.

### 4. Run Tests

```bash
# Run all tests
npm test

# Validate JSON output format
npm run test:validate-json
```

---

## Test Videos

### Location

Test videos are stored in:
```
examples/videos/emotion-tests/
```

### Current Test Video

**File:** `cod.mp4`  
**Size:** 62 MB  
**Status:** Committed to git  

**Purpose:** End-to-end (E2E) testing and development of the emotion analysis pipeline.

### Adding New Test Videos

To add new test videos for testing different scenarios:

1. **Place the video** in `examples/videos/emotion-tests/` or create an appropriate subfolder for categorization
2. **Use descriptive names** that indicate the test purpose:
   - `neutral-baseline.mp4` — Baseline emotional neutrality test
   - `poor-lighting-test.mp4` — Low lighting condition analysis
   - `high-energy-montage.mp4` — Fast-paced content testing
   - `dialogue-heavy-scene.mp4` — Speech/transcription focus
3. **Update this README** when adding new videos — document what each video tests
4. **Consider file size** for git tracking — large videos (>100 MB) may need `.gitignore` rules or external storage

### Usage in Testing

Test videos are used with pipeline configs like `configs/cod-test.yaml` and `configs/quick-test.yaml` for validation during development and CI runs.

---

## Key Features

### ✅ Implemented & Working

**Core Pipeline:**
- 3-phase modular orchestrator (Gather → Process → Report)
- YAML-based configuration system (12+ pre-built configs)
- Sequential and parallel execution modes for Phase 2
- Artifact management with JSON output
- Robust error handling and retry logic

**AI Integration:**
- 4 AI provider implementations (OpenRouter, Anthropic, Gemini, OpenAI)
- Unified interface with automatic fallbacks
- Support for text, image, and audio inputs
- JSON response parsing with error recovery

**Video Analysis:**
- FFmpeg-based video chunk extraction
- Per-second emotion scoring
- Dialogue transcription from audio
- Music/mood segment detection
- SVG chart generation for visual correlation

**Persona System:**
- SOUL.md (personality), GOAL.md (objectives), TOOLS (analysis scripts)
- **Personas:** Loaded from [cast repo](https://github.com/getpeanutgallery/cast) package - Path format: `cast/<persona>/SOUL.md`
- **Goals:** Loaded from [goals repo](https://github.com/getpeanutgallery/goals) package - Path format: `goals/<goal-name>.md`
- **Tools:** Loaded from [tools repo](https://github.com/getpeanutgallery/tools) package - Path format: `tools/<tool-name>.cjs`
- Emotion lenses (patience, boredom, excitement, etc.)

**Storage:**
- Local filesystem (default)
- AWS S3 integration
- Pluggable storage interface

**CLI:**
- `bin/run-analysis.js` — User-friendly wrapper with persona ID resolution
- `server/run-pipeline.cjs` — Direct pipeline execution
- YAML config support with `--config` flag

**Testing:**
- 70+ unit tests
- Integration tests for AI provider flows
- Storage backend tests
- Script-level tests for all pipeline phases

### 📋 Planned / In Progress

- Additional AI providers (Azure OpenAI, local models)
- More storage backends (GCS, Azure Blob)
- Real-time streaming analysis
- Web UI for pipeline monitoring
- Enhanced persona discovery and management tools

---

## Configuration Examples

### Basic Video Analysis

```yaml
# configs/video-analysis.yaml
name: Video Emotion Analysis
description: Full pipeline for video emotion evaluation

phases:
  gather:
    - scripts/get-context/get-dialogue.cjs
    - scripts/get-context/get-music.cjs
  
  process:
    mode: parallel
    scripts:
      - scripts/process/video-chunks.cjs
      - scripts/process/video-per-second.cjs
  
  report:
    - scripts/report/emotional-analysis.cjs
    - scripts/report/metrics.cjs
    - scripts/report/recommendation.cjs
    - scripts/report/summary.cjs
    - scripts/report/final-report.cjs

persona:
  # Package dependencies:
  # - cast: https://github.com/getpeanutgallery/cast
  # - goals: https://github.com/getpeanutgallery/goals
  # - tools: https://github.com/getpeanutgallery/tools
  soul: cast/impatient-teenager/SOUL.md
  goal: goals/video-ad-evaluation.md
  tool: tools/emotion-lenses-tool.cjs

assets:
  - type: video
    path: ./examples/videos/emotion-tests/cod.mp4
```

### Custom Persona CLI

```bash
# Package dependencies:
# - cast: https://github.com/getpeanutgallery/cast
# - goals: https://github.com/getpeanutgallery/goals
# - tools: https://github.com/getpeanutgallery/tools
node bin/run-analysis.js \
  --soul cast/impatient-teenager/SOUL.md \
  --goal video-ad-evaluation \
  --tool emotion-lenses \
  video.mp4 \
  output/my-analysis
```

---

## Recent Activity

**Latest Commits (March 2026):**
- **Refactored report system** — Split monolithic `evaluation.cjs` into 5 modular scripts (emotional-analysis, metrics, recommendation, summary, final-report)
- **Improved retry logic** — Enhanced API failure handling with configurable strategies
- **Added SVG correlation charts** — Replaced ASCII charts with visual timeline correlations
- **Fixed music timestamp parsing** — Support for multiple timestamp formats
- **Added subset warnings** — Reports now warn when analysis covers <100% of video duration
- **Enhanced JSON error handling** — Robust parsing with debug logging and fallbacks

**Recent Focus:**
- Modular report generation (Phase 4 completion)
- Visual output improvements (SVG charts, markdown summaries)
- Error resilience and debugging capabilities
- Documentation and test coverage

---

## Status

**Current State:** ✅ **Active Development**

- **Version:** 8.0.0
- **Stability:** Stable core pipeline, experimental features in docs/
- **Test Coverage:** 70+ tests passing
- **Last Major Update:** March 5, 2026 (Phase 4 report system refactor)

The core 3-phase pipeline is production-ready for video emotion analysis. The persona system, AI provider abstraction, and storage backends are fully functional.

---

## Next Steps

**Immediate:**
1. Run end-to-end tests with real video assets
2. Validate all 12 YAML configs work as expected
3. Document output artifact schemas for each script
4. Add integration tests for parallel execution mode

**Near-Term:**
- Add GCS and Azure storage providers
- Implement streaming mode for long videos
- Build web dashboard for pipeline monitoring
- Expand persona library with more souls/goals/tools

---

## Documentation

- **Pipeline Workflow:** `docs/MODULAR-PIPELINE-WORKFLOW.md` — Full architecture spec
- **Storage:** `docs/STORAGE-ARCHITECTURE.md` — Storage provider details
- **AI Providers:** `docs/AI-PROVIDER-ARCHITECTURE.md` — Provider interface docs
- **Migration:** `docs/MIGRATION-GUIDE-v2.md` — Upgrading from v1.x

---

## License

MIT License — see [LICENSE](LICENSE) for details.

---

**Built with ❤️ by OpenTruth**

*Last updated: March 6, 2026*
