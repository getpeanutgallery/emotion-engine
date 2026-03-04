# Emotion Engine Implementation Plan

**Date:** 2026-03-04  
**Status:** Ready to Execute  
**Agent:** Cookie 🍪

---

## Goal

Implement the new modular, tool-agnostic Emotion Engine architecture (v8.0) based on all investigation findings.

---

## Overview

We've completed a comprehensive investigation (Tasks 1-4k) that transformed the architecture from a hardcoded video analysis pipeline into a **modular, asset-agnostic workflow engine** with:

- Pluggable tool scripts (provider-agnostic)
- Modular pipeline phases (0-N scripts each)
- AI provider abstraction (OpenRouter, Anthropic, Gemini, OpenAI)
- Storage abstraction (local-fs, S3, GCS, Azure)
- Multi-modal support (URL, path, base64 attachments)
- Path-based configuration (no ID resolution in pipeline)
- Self-contained YAML configs (git-safe, reproducible)

**This plan implements the core emotion-engine only.** The public-facing website (HTML/CSS/JS) will be a separate repo and separate plan.

---

## Phases

### Phase 1: Repo Cleanup & Structure ✅

**Goal:** Remove frontend files, establish clean repo structure.

| Task | SubAgent | Description |
|------|----------|-------------|
| 1.1 | `coder` | Delete all HTML/CSS/JS frontend files |
| 1.2 | `coder` | Create new directory structure (server/lib, tools, scripts, configs) |
| 1.3 | `coder` | Move existing pipeline scripts to new structure |
| 1.4 | `coder` | Update package.json (remove frontend dependencies) |
| 1.5 | `coder` | Create .gitignore (exclude .env, output/, .cache/) |

**Files to Delete:**
- `index.html`
- `index.js`
- `managers/` (api-manager.js, state-manager.js, ui-manager.js)
- `components/` (all Web Components)
- `css/`
- `docs/` (frontend-related docs)

**New Structure:**
```
emotion-engine/
├── server/
│   ├── lib/
│   │   ├── ai-providers/
│   │   ├── storage/
│   │   ├── persona-loader.cjs
│   │   └── logger.cjs
│   ├── scripts/
│   │   ├── get-context/
│   │   ├── process/
│   │   └── report/
│   ├── run-pipeline.cjs
│   └── ...
├── tools/
│   ├── emotion-lenses-tool.cjs
│   └── lib/
├── configs/
│   └── *.yaml
├── personas/
│   ├── souls/
│   ├── goals/
│   └── tools/
├── docs/
├── .env.example
├── .gitignore
└── package.json
```

---

### Phase 2: Core Infrastructure

**Goal:** Implement AI provider + storage abstractions.

| Task | SubAgent | Description |
|------|----------|-------------|
| 2.1 | `coder` | Implement AI provider interface + utilities |
| 2.2 | `coder` | Implement OpenRouter provider (reference) |
| 2.3 | `coder` | Implement Anthropic provider |
| 2.4 | `coder` | Implement Gemini provider |
| 2.5 | `coder` | Implement OpenAI provider |
| 2.6 | `coder` | Implement storage interface |
| 2.7 | `coder` | Implement local-fs storage provider |
| 2.8 | `coder` | Implement AWS S3 storage provider |
| 2.9 | `coder` | Write unit tests for all providers |

**Files Created:**
- `server/lib/ai-providers/ai-provider-interface.js`
- `server/lib/ai-providers/utils/file-utils.cjs`
- `server/lib/ai-providers/providers/*.cjs` (4 providers)
- `server/lib/storage/storage-interface.js`
- `server/lib/storage/providers/*.cjs` (2 providers)

---

### Phase 3: Pipeline Orchestrator

**Goal:** Implement modular pipeline with YAML config loading.

| Task | SubAgent | Description |
|------|----------|-------------|
| 3.1 | `coder` | Create YAML config loader |
| 3.2 | `coder` | Implement Phase 1 (Gather Context) runner |
| 3.3 | `coder` | Implement Phase 2 (Process) runner (sequential + parallel) |
| 3.4 | `coder` | Implement Phase 3 (Report) runner |
| 3.5 | `coder` | Implement artifact passing between phases |
| 3.6 | `coder` | Add validation (1 script minimum, any phase) |
| 3.7 | `coder` | Create CLI interface (--config only) |
| 3.8 | `coder` | Write integration tests |

**Files Created:**
- `server/run-pipeline.cjs` (new orchestrator)
- `server/lib/config-loader.cjs`
- `server/lib/pipeline-runner.cjs`

---

### Phase 4: Migrate Existing Scripts

**Goal:** Port current pipeline scripts to new modular structure.

| Task | SubAgent | Description |
|------|----------|-------------|
| 4.1 | `coder` | Migrate `01-extract-dialogue.cjs` → `scripts/get-context/get-dialogue.cjs` |
| 4.2 | `coder` | Migrate `02-extract-music.cjs` → `scripts/get-context/get-music.cjs` |
| 4.3 | `coder` | Migrate `03-analyze-chunks.cjs` → `scripts/process/video-chunks.cjs` |
| 4.4 | `coder` | Migrate `04-per-second-emotions.cjs` → `scripts/process/video-per-second.cjs` |
| 4.5 | `coder` | Migrate `generate-report.cjs` → `scripts/report/evaluation.cjs` |
| 4.6 | `coder` | Update all scripts to use AI provider interface |
| 4.7 | `coder` | Update all scripts to use storage interface |
| 4.8 | `coder` | Test migrated scripts end-to-end |

**Key Changes:**
- Scripts use generic `artifacts` object (not specific field names)
- Scripts call `aiProvider.complete()` (not direct API calls)
- Scripts use `storage.write()`/`storage.read()` (not direct fs)

---

### Phase 5: Tool System

**Goal:** Implement pluggable tool architecture.

| Task | SubAgent | Description |
|------|----------|-------------|
| 5.1 | `coder` | Create tool interface contract |
| 5.2 | `coder` | Implement emotion-lenses-tool.cjs (reference) |
| 5.3 | `coder` | Update persona-loader to load SOUL/GOAL/TOOLS from paths |
| 5.4 | `coder` | Remove numeric baselines from SOUL.md |
| 5.5 | `coder` | Update TOOLS.md documentation |
| 5.6 | `coder` | Write tool unit tests |

**Files Created:**
- `tools/lib/tool-interface.js`
- `tools/emotion-lenses-tool.cjs`

**Files Updated:**
- `personas/souls/impatient-teenager/1.0.0/SOUL.md` (remove baselines)

---

### Phase 6: Configuration & Examples

**Goal:** Create self-contained YAML configs for all use cases.

| Task | SubAgent | Description |
|------|----------|-------------|
| 6.1 | `coder` | Create video-analysis.yaml (full pipeline) |
| 6.2 | `coder` | Create quick-test.yaml (minimal pipeline) |
| 6.3 | `coder` | Create multi-persona-swarm.yaml (parallel) |
| 6.4 | `coder` | Create dialogue-transcription.yaml (gather + report) |
| 6.5 | `coder` | Create raw-analysis.yaml (process only) |
| 6.6 | `coder` | Create image-analysis.yaml (different asset type) |
| 6.7 | `coder` | Create audio-analysis.yaml (different asset type) |
| 6.8 | `coder` | Update .env.example (all env vars documented) |

---

### Phase 7: Testing & Validation

**Goal:** Comprehensive testing of entire system.

| Task | SubAgent | Description |
|------|----------|-------------|
| 7.1 | `coder` | Unit tests: AI providers (all 4) |
| 7.2 | `coder` | Unit tests: Storage providers (both) |
| 7.3 | `coder` | Unit tests: Pipeline runner |
| 7.4 | `coder` | Unit tests: Tool system |
| 7.5 | `coder` | Integration tests: Full pipeline (video) |
| 7.6 | `coder` | Integration tests: Parallel execution |
| 7.7 | `coder` | Integration tests: Multi-modal attachments |
| 7.8 | `coder` | E2E test: Run full analysis on test video |
| 7.9 | `coder` | Performance benchmarks |

---

### Phase 8: Documentation

**Goal:** Complete documentation for developers.

| Task | SubAgent | Description |
|------|----------|-------------|
| 8.1 | `cheap` | Write README.md (quick start, examples) |
| 8.2 | `cheap` | Write ARCHITECTURE.md (system overview) |
| 8.3 | `cheap` | Write API reference (all interfaces) |
| 8.4 | `cheap` | Write MIGRATION-GUIDE.md (v1.0 → v8.0) |
| 8.5 | `cheap` | Write CONTRIBUTING.md (how to add providers/tools) |
| 8.6 | `cheap` | Document all config options |
| 8.7 | `cheap` | Create example walkthroughs |

---

## Implementation Order

**Recommended Sequence:**

```
Phase 1 (Cleanup) → Phase 2 (Infrastructure) → Phase 3 (Pipeline)
         ↓
Phase 4 (Migrate Scripts) → Phase 5 (Tools) → Phase 6 (Configs)
         ↓
Phase 7 (Testing) → Phase 8 (Documentation)
```

**Critical Path:**
- Phase 2 must complete before Phase 3 (pipeline needs AI/storage interfaces)
- Phase 3 must complete before Phase 4 (scripts need pipeline structure)
- Phase 4 must complete before Phase 7 (need working scripts to test)

**Parallel Work:**
- Phase 6 (configs) can run parallel with Phase 4-5
- Phase 8 (docs) can run parallel with Phase 7 (tests)

---

## Estimated Effort

| Phase | Complexity | Estimated Time |
|-------|------------|----------------|
| Phase 1: Cleanup | Low | 30 min |
| Phase 2: Infrastructure | High | 4-6 hours |
| Phase 3: Pipeline | High | 3-4 hours |
| Phase 4: Migrate Scripts | Medium | 2-3 hours |
| Phase 5: Tool System | Medium | 2-3 hours |
| Phase 6: Configs | Low | 1 hour |
| Phase 7: Testing | High | 4-6 hours |
| Phase 8: Documentation | Medium | 2-3 hours |
| **Total** | | **18-26 hours** |

---

## Success Criteria

**Phase 1-3 (Core Engine):**
- ✅ YAML config loads successfully
- ✅ Pipeline runs with 0-N scripts per phase
- ✅ AI providers work (all 4, multi-modal)
- ✅ Storage providers work (local + S3)
- ✅ Artifacts pass between phases

**Phase 4-5 (Scripts + Tools):**
- ✅ Migrated scripts work end-to-end
- ✅ Tool system loads and executes
- ✅ Emotion lenses tool produces valid output

**Phase 6-8 (Complete):**
- ✅ All example configs work
- ✅ All tests pass (unit + integration + E2E)
- ✅ Documentation complete

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| AI provider API changes | Medium | Abstract interface, easy to update providers |
| Storage provider auth issues | Low | Env var injection, well-documented setup |
| Script migration bugs | Medium | Comprehensive tests, E2E validation |
| Performance regression | Medium | Benchmarks in Phase 7, optimize if needed |

---

## Next Steps

**Ready to start Phase 1?** I'll spawn a SubAgent to:
1. Delete all frontend files (HTML/CSS/JS/components)
2. Create new directory structure
3. Move existing files to new locations
4. Update package.json and .gitignore

This is a clean break — once done, we have a pure backend emotion-engine repo ready for implementation.

---

*Created on 2026-03-04*
