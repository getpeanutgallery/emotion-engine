# Emotion Engine v8.0

**Modular, tool-agnostic AI workflow engine for multi-modal emotion analysis**

---

## Quick Start

### 1. Install

```bash
pnpm install
```

### 2. Configure

Copy `.env.example` to `.env` and set your API keys:

```bash
cp .env.example .env
# Edit .env with your API keys (OpenRouter, Anthropic, Gemini, OpenAI, AWS, etc.)
```

### 3. Run

```bash
pnpm run pipeline --config configs/video-analysis.yaml
```

---

## Architecture Overview

Emotion Engine v8.0 uses a **3-phase modular pipeline**:

```
┌─────────────────────────────────────────────────────────────┐
│  PHASE 1: GATHER CONTEXT                                    │
│  └─ Scripts extract raw data (dialogue, music, visuals)     │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  PHASE 2: PROCESS                                           │
│  └─ Scripts analyze, score, and interpret emotions          │
│     (supports sequential or parallel execution)             │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  PHASE 3: REPORT                                            │
│  └─ Scripts generate final output (JSON, charts, summaries) │
└─────────────────────────────────────────────────────────────┘
```

**Key Features:**
- **Pluggable Tools:** Scripts are provider-agnostic (swap AI models easily)
- **Multi-Modal:** Supports video, audio, images, text
- **AI Provider Abstraction:** OpenRouter, Anthropic, Gemini, OpenAI
- **Storage Abstraction:** Local FS, AWS S3, GCS, Azure Blob
- **Path-Based Configs:** Self-contained YAML files (git-safe, reproducible)

---

## Example YAML Config

```yaml
# configs/video-analysis.yaml
name: Video Emotion Analysis
description: Full pipeline for video emotion evaluation

phases:
  gather:
    - scripts/get-context/get-dialogue.cjs
    - scripts/get-context/get-music.cjs
  
  process:
    mode: parallel  # or 'sequential'
    scripts:
      - scripts/process/video-chunks.cjs
      - scripts/process/per-second-emotions.cjs
  
  report:
    - scripts/report/evaluation.cjs

persona:
  soul: personas/souls/impatient-teenager/1.0.0
  goal: personas/goals/video-ad-evaluation/1.0.0
  tools:
    - personas/tools/emotion-tracking/1.0.0

assets:
  - type: video
    path: ./examples/test-video.mp4
```

---

## Example CLI Usage

```bash
# Run full pipeline
pnpm run pipeline --config configs/video-analysis.yaml

# Run with custom config
pnpm run pipeline --config configs/quick-test.yaml

# Run with environment override
OPENROUTER_API_KEY=sk-xxx pnpm run pipeline --config configs/video-analysis.yaml
```

---

## Configuration Reference

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `OPENROUTER_API_KEY` | OpenRouter API key for multi-model access | Yes (for OpenRouter provider) |
| `ANTHROPIC_API_KEY` | Anthropic API key | Yes (for Anthropic provider) |
| `GEMINI_API_KEY` | Google Gemini API key | Yes (for Gemini provider) |
| `OPENAI_API_KEY` | OpenAI API key | Yes (for OpenAI provider) |
| `AWS_ACCESS_KEY_ID` | AWS access key (for S3 storage) | No (local FS default) |
| `AWS_SECRET_ACCESS_KEY` | AWS secret key | No |
| `AWS_REGION` | AWS region | No |
| `STORAGE_PROVIDER` | Storage backend: `local-fs`, `s3`, `gcs`, `azure` | No (default: `local-fs`) |
| `STORAGE_BUCKET` | Bucket/container name (for cloud storage) | No |

### YAML Config Options

```yaml
name: string              # Config name (required)
description: string       # Config description (optional)

phases:
  gather: string[]        # Scripts for Phase 1 (optional)
  process:                # Phase 2 config (optional)
    mode: sequential|parallel
    scripts: string[]
  report: string[]        # Scripts for Phase 3 (optional)

persona:
  soul: string            # Path to SOUL.md (required)
  goal: string            # Path to GOAL.md (optional)
  tools: string[]         # Paths to TOOLS.md (optional)

assets:                   # Input assets (required)
  - type: video|audio|image|text
    path: string          # Local path or URL
    base64: string        # Or base64 data (optional)
```

**Validation Rules:**
- At least one phase must have scripts
- `soul` persona path is required
- At least one asset is required

---

## Project Structure

```
emotion-engine/
├── server/
│   ├── lib/
│   │   ├── ai-providers/       # AI provider implementations
│   │   │   ├── ai-provider-interface.js
│   │   │   ├── providers/
│   │   │   │   ├── openrouter.cjs
│   │   │   │   ├── anthropic.cjs
│   │   │   │   ├── gemini.cjs
│   │   │   │   └── openai.cjs
│   │   │   └── utils/
│   │   ├── storage/            # Storage provider implementations
│   │   │   ├── storage-interface.js
│   │   │   └── providers/
│   │   │       ├── local-fs.cjs
│   │   │       └── s3.cjs
│   │   ├── persona-loader.cjs  # Load SOUL/GOAL/TOOLS from paths
│   │   └── logger.cjs          # Logging utilities
│   ├── scripts/
│   │   ├── get-context/        # Phase 1 scripts (gather data)
│   │   ├── process/            # Phase 2 scripts (analyze)
│   │   └── report/             # Phase 3 scripts (output)
│   └── run-pipeline.cjs        # Main pipeline orchestrator
├── tools/
│   ├── lib/                    # Tool system utilities
│   └── emotion-lenses-tool.cjs # Reference tool implementation
├── configs/                    # YAML configuration files
│   ├── video-analysis.yaml
│   ├── quick-test.yaml
│   ├── multi-persona-swarm.yaml
│   └── ...
├── personas/
│   ├── souls/                  # SOUL.md definitions
│   ├── goals/                  # GOAL.md definitions
│   └── tools/                  # TOOLS.md definitions
├── bin/                        # CLI entry points
├── docs/                       # Full documentation
├── examples/                   # Example assets and outputs
├── test/                       # Unit and integration tests
├── .env.example                # Environment template
├── package.json
└── README.md
```

---

## Full Documentation

- **Architecture:** See `docs/ARCHITECTURE.md`
- **API Reference:** See `docs/API.md`
- **Migration Guide:** See `docs/MIGRATION-GUIDE.md` (v1.0 → v8.0)
- **Contributing:** See `docs/CONTRIBUTING.md`

---

## License

MIT License - see [LICENSE](LICENSE) for details.

---

**Built with ❤️ by OpenTruth**
