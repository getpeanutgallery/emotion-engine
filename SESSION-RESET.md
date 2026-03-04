# Session Reset Guide - Emotion Engine v8.0

**Date:** 2026-03-04  
**Status:** Ready for Phase 1 Implementation  
**Version:** 8.0 (Modular Workflow Engine)

---

## Quick Start for New Sessions

**Read these 5 files to get up to speed:**

1. **README.md** - Project overview and quick start
2. **IMPLEMENTATION-PLAN.md** - Current implementation roadmap (Phases 1-7)
3. **docs/AI-PROVIDER-ARCHITECTURE.md** - AI provider abstraction layer
4. **docs/STORAGE-ARCHITECTURE.md** - Storage abstraction layer
5. **docs/MODULAR-PIPELINE-WORKFLOW.md** - Workflow engine design

---

## Architecture Summary (1 Page)

### What We're Building

A **modular, asset-agnostic workflow engine** that evaluates media (video, audio, images) against synthetic personas to measure emotional impact.

### Core Architecture (v8.0)

```
┌─────────────────────────────────────────────────────────────┐
│                    PIPELINE ORCHESTRATOR                     │
│              (Accepts YAML config or CLI args)               │
└─────────────────────────────────────────────────────────────┘
         │
         ├──► Phase 1: Get Context (0-N scripts, optional)
         │     - scripts/get-context/dialogue.cjs
         │     - scripts/get-context/music.cjs
         │     - scripts/get-context/metadata.cjs
         │
         ├──► Phase 2: Process (0-N scripts, optional)
         │     - scripts/process/chunked-analysis.cjs
         │     - scripts/process/per-second.cjs
         │     - scripts/process/image-frames.cjs
         │
         └──► Phase 3: Report (0-N scripts, optional)
               - scripts/report/evaluation.cjs
               - scripts/report/graphs.cjs
```

### Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| **Path-based config** | Pipeline doesn't resolve IDs → no coupling to directory structure |
| **Pluggable tools** | Tools are self-contained scripts → easy to add new analysis types |
| **AI provider abstraction** | Tools don't know which provider → easy to switch OpenRouter/Anthropic/Gemini |
| **Storage abstraction** | Scripts don't know storage backend → easy to use local/S3/GCS |
| **Multi-modal support** | All providers support video/audio/images → unified interface |
| **Git-safe YAML** | No secrets in configs → safe to commit, share, version |
| **All phases optional** | At least 1 script somewhere → flexible workflows |

### File Structure

```
emotion-engine/
├── bin/                    # CLI wrappers
├── configs/                # YAML analysis configs
├── docs/                   # Architecture docs
├── personas/               # SOUL, GOAL, TOOLS definitions
├── server/                 # Core engine
│   ├── lib/ai-providers/   # AI provider implementations
│   ├── lib/storage/        # Storage provider implementations
│   └── lambda/             # AWS Lambda deployment
├── tools/                  # Pluggable tool scripts
├── test/                   # Unit tests
└── examples/               # Example code
```

---

## Current Status

### ✅ Completed (Phase 0)

- [x] Investigation tasks (1-4k) complete
- [x] Architecture design finalized (v8.0)
- [x] AI provider interface implemented (multi-modal)
- [x] Storage interface implemented (local-fs, S3, GCS, Azure)
- [x] File utils implemented (base64, MIME detection)
- [x] Documentation written (all architecture docs)
- [x] Repo audit complete (FILE-INVENTORY.md)
- [x] Cleanup script ready (CLEANUP-SCRIPT.sh)

### 🚧 Ready to Start (Phase 1)

- [ ] Execute cleanup script (delete obsolete files)
- [ ] Rewrite README.md for v8.0
- [ ] Delete frontend files (moving to separate repo)
- [ ] Reorganize directory structure

### 📋 Upcoming Phases

**Phase 2:** Core Infrastructure
- Implement AI provider utilities
- Implement storage providers
- Write unit tests

**Phase 3:** Pipeline Orchestrator
- Implement new run-pipeline.cjs
- Support YAML config loading
- Support CLI argument parsing

**Phase 4:** Script Migration
- Migrate old scripts to new structure
- Update imports and paths
- Test end-to-end

**Phase 5:** Lambda Deployment
- Update Lambda handler
- Test serverless deployment
- Configure CI/CD

**Phase 6:** Documentation
- Complete API docs
- Add usage examples
- Create tutorial videos

**Phase 7:** Launch
- Beta testing
- Performance optimization
- Production deployment

---

## Key Commands

```bash
# Run analysis with config
node bin/run-analysis.js --config configs/video-analysis.yaml

# Run analysis with CLI args
node bin/run-analysis.js \
  --input ./videos/ad.mp4 \
  --output ./output/test \
  --soul ./personas/souls/impatient-teenager/1.0.0/SOUL.md \
  --goal ./personas/goals/video-ad-evaluation/1.0.0/GOAL.md \
  --tool ./tools/emotion-lenses-tool.cjs \
  --tool-variables '{"lenses":["patience","boredom","excitement"]}'

# Run tests
pnpm test

# Start local server
python3 -m http.server 8080
```

---

## Environment Setup

```bash
# Required
AI_PROVIDER=openrouter
AI_API_KEY=sk-or-your-key-here
AI_MODEL=anthropic/claude-3.5-sonnet

STORAGE_PROVIDER=local-fs

# Optional
DEBUG=true
LOG_LEVEL=info
```

---

## Important Links

- [Full Implementation Plan](IMPLEMENTATION-PLAN.md)
- [AI Provider Architecture](docs/AI-PROVIDER-ARCHITECTURE.md)
- [Storage Architecture](docs/STORAGE-ARCHITECTURE.md)
- [Modular Pipeline Workflow](docs/MODULAR-PIPELINE-WORKFLOW.md)
- [Migration Guide](docs/MIGRATION-GUIDE-v2.md)

---

## Next Session Checklist

1. [ ] Read this file (SESSION-RESET.md)
2. [ ] Read IMPLEMENTATION-PLAN.md
3. [ ] Execute CLEANUP-SCRIPT.sh
4. [ ] Rewrite README.md (follow README-UPDATE-PLAN.md)
5. [ ] Begin Phase 1 tasks

---

*Created: 2026-03-04 17:20 EST*  
*Repo: /home/derrick/.openclaw/workspace/projects/opentruth/emotion-engine*
