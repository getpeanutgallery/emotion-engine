# Emotion Engine Repo Audit - File Inventory

**Date:** 2026-03-04  
**Audit Purpose:** Identify files to keep vs delete before Phase 1 implementation  
**Repo:** `/home/derrick/.openclaw/workspace/projects/opentruth/emotion-engine`

---

## Summary

| Category | Count | Description |
|----------|-------|-------------|
| **KEEP** | 28 | Active, relevant files for v8.0 architecture |
| **DELETE** | 17 | Investigation artifacts, superseded docs, temp files |
| **REVIEW** | 3 | Uncertain, needs human decision |

---

## File Inventory

### Root Level (*.md files)

| File | Category | Reason |
|------|----------|--------|
| `README.md` | **REVIEW** | Outdated (v0.3.0), needs complete rewrite for v8.0 |
| `IMPLEMENTATION-PLAN.md` | **KEEP** | Current implementation plan (Phase 0-7) |
| `TASK-4j-COMPLETION.md` | **DELETE** | Investigation task completion report (obsolete) |
| `TOOL-VARIABLE-INVESTIGATION.md` | **DELETE** | Investigation artifact (superseded by docs/) |
| `FIX-API-RESPONSE-READING.md` | **REVIEW** | Bug fix doc - check if still relevant |
| `HARDENING_PLAN.md` | **REVIEW** | Security hardening - check if implemented |
| `PHASE-OPTIONAL-UPDATE.md` | **DELETE** | Temporary planning doc (superseded) |
| `PIPELINE_REVIEW.md` | **DELETE** | Investigation artifact (superseded) |
| `TOKEN-USAGE-UPDATE.md` | **DELETE** | Temporary update note (superseded) |

### docs/ Folder

| File | Category | Reason |
|------|----------|--------|
| `AI-PROVIDER-ARCHITECTURE.md` | **KEEP** | Final architecture spec (v2.0, multi-modal) |
| `STORAGE-ARCHITECTURE.md` | **KEEP** | Final architecture spec (v1.0) |
| `MODULAR-PIPELINE-WORKFLOW.md` | **KEEP** | Final architecture spec (v1.0, workflow engine) |
| `PLUGGABLE-TOOL-ARCHITECTURE.md` | **DELETE** | Superseded by PATH-BASED-DESIGN-UPDATE.md (v2.0 → v3.0) |
| `PATH-BASED-DESIGN-UPDATE.md` | **KEEP** | Current architecture (v3.0, path-based) |
| `TOOL-VARIABLE-INJECTION-ARCHITECTURE.md` | **DELETE** | Superseded by PLUGGABLE-TOOL-ARCHITECTURE.md (v1.0 → v2.0) |
| `TOOL-VARIABLE-INVESTIGATION-FINDINGS.md` | **DELETE** | Investigation artifact (findings report) |
| `variable-injection-design.md` | **DELETE** | Investigation artifact (design proposal) |
| `MIGRATION-GUIDE-v2.md` | **KEEP** | Migration guide (all versions v1→v8) |
| `TASK-4K-IMPLEMENTATION.md` | **DELETE** | Task completion report (obsolete) |

### configs/ Folder

| File | Category | Reason |
|------|----------|--------|
| `audio-analysis.yaml` | **KEEP** | Current config (multi-analysis) |
| `dialogue-transcription.yaml` | **KEEP** | Current config (multi-analysis) |
| `image-analysis.yaml` | **KEEP** | Current config (multi-analysis) |
| `metadata-extract.yaml` | **KEEP** | Current config (multi-analysis) |
| `multi-analysis.yaml` | **KEEP** | Current config (multi-analysis) |
| `multi-persona-swarm.yaml` | **KEEP** | Current config (multi-persona) |
| `quick-test.yaml` | **KEEP** | Current config (quick test) |
| `raw-analysis.yaml` | **KEEP** | Current config (raw analysis) |
| `video-analysis.yaml` | **KEEP** | Current config (multi-analysis) |

### personas/ Folder

| File | Category | Reason |
|------|----------|--------|
| `personas/goals/video-ad-evaluation/1.0.0/GOAL.md` | **KEEP** | Active persona file |
| `personas/souls/impatient-teenager/1.0.0/SOUL.md` | **KEEP** | Active persona file |
| `personas/tools/emotion-tracking/1.0.0/TOOLS.md` | **KEEP** | Active persona file |

### server/ Folder

| File | Category | Reason |
|------|----------|--------|
| `server/config/models.json` | **KEEP** | Model configuration |
| `server/lambda/index.js` | **KEEP** | Lambda entry point |
| `server/lambda/lib/openrouter.js` | **KEEP** | Lambda OpenRouter client |
| `server/lambda/lib/store.js` | **KEEP** | Lambda storage |
| `server/lambda/package.json` | **KEEP** | Lambda dependencies |
| `server/lambda/pnpm-lock.yaml` | **KEEP** | Lambda lockfile |
| `server/lib/ai-providers/ai-provider-interface.js` | **KEEP** | Core AI provider interface |
| `server/lib/ai-providers/README.md` | **KEEP** | AI provider docs |
| `server/lib/ai-providers/utils/README.md` | **KEEP** | Utils docs |
| `server/lib/storage/storage-interface.js` | **KEEP** | Core storage interface |
| `server/01-extract-dialogue.cjs` | **DELETE** | Old hardcoded pipeline (superseded) |
| `server/02-extract-music.cjs` | **DELETE** | Old hardcoded pipeline (superseded) |
| `server/03-analyze-chunks.cjs` | **DELETE** | Old hardcoded pipeline (superseded) |
| `server/04-per-second-emotions.cjs` | **DELETE** | Old hardcoded pipeline (superseded) |
| `server/generate-report.cjs` | **DELETE** | Old hardcoded pipeline (superseded) |
| `server/run-pipeline.cjs` | **DELETE** | Old hardcoded pipeline (superseded) |

### tools/ Folder

| File | Category | Reason |
|------|----------|--------|
| `tools/lib/tool-interface.js` | **KEEP** | Tool interface definition |
| `tools/emotion-lenses-tool.cjs` | **REVIEW** | Check if this is the new pluggable tool or old hardcoded |

### lib/ Folder

| File | Category | Reason |
|------|----------|--------|
| `lib/persona-resolver.cjs` | **KEEP** | Path-based persona resolver |

### bin/ Folder

| File | Category | Reason |
|------|----------|--------|
| `bin/run-analysis.js` | **KEEP** | CLI wrapper for path resolution |

### test/ Folder

| File | Category | Reason |
|------|----------|--------|
| `test/file-utils.test.js` | **KEEP** | Unit tests for file utils |

### examples/ Folder

| File | Category | Reason |
|------|----------|--------|
| `examples/attachment-patterns.js` | **KEEP** | Multi-modal attachment examples |
| `examples/multi-modal-storage-example.cjs` | **KEEP** | Storage abstraction examples |

### Frontend Files (DELETE ALL)

| File | Category | Reason |
|------|----------|--------|
| `index.html` | **DELETE** | Frontend (being moved to separate repo) |
| `index.js` | **DELETE** | Frontend Web Component manager |
| `managers/api-manager.js` | **DELETE** | Frontend code |
| `managers/state-manager.js` | **DELETE** | Frontend code |
| `managers/ui-manager.js` | **DELETE** | Frontend code |
| `components/*.js` (all 8 files) | **DELETE** | Frontend Web Components |
| `css/*.css` (all 2 files) | **DELETE** | Frontend styles |
| `visualizations/*.png` (all 4 files) | **DELETE** | Frontend assets |

---

## Files Requiring Human Review

### 1. `README.md`
**Issue:** Describes v0.3.0 pipeline, completely outdated  
**Decision Needed:** Rewrite from scratch for v8.0 or keep as-is temporarily?  
**Recommendation:** Rewrite (see README-UPDATE-PLAN.md)

### 2. `FIX-API-RESPONSE-READING.md`
**Issue:** Bug fix documentation  
**Decision Needed:** Is this fix already implemented in current code?  
**Recommendation:** If implemented, delete; if pending, move to docs/

### 3. `HARDENING_PLAN.md`
**Issue:** Security hardening plan (21KB)  
**Decision Needed:** Is this implemented? Should it be in docs/?  
**Recommendation:** If implemented, delete; if pending, move to docs/

### 4. `tools/emotion-lenses-tool.cjs`
**Issue:** Need to verify if this is new pluggable tool or old hardcoded  
**Decision Needed:** Check if it follows new tool interface  
**Recommendation:** Review code structure

---

## Cleanup Commands

See `CLEANUP-SCRIPT.sh` for exact deletion commands.

---

## Next Steps

1. **Review** files marked as REVIEW (4 files)
2. **Execute** cleanup script to delete obsolete files
3. **Rewrite** README.md for v8.0 architecture
4. **Create** SESSION-RESET.md for next session
5. **Begin** Phase 1 implementation

---

*Audit completed: 2026-03-04 17:15 EST*
