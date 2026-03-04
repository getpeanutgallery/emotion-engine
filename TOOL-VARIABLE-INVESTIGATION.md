# Emotion Engine: Tool Variable Injection Investigation

**Date:** 2026-03-04  
**Status:** Draft  
**Agent:** Cookie 🍪

---

## Goal

Investigate how the emotion-engine pipeline currently handles tool configuration, and design a system for passing dynamic variables (like `SELECTED_LENSES`) to tools without enforcing defaults.

---

## Overview

Derrick wants to:
1. Remove default Core Lenses enforcement from emotion-tracking tool
2. Require at least 1 lens (fail on empty array)
3. Decouple persona SOUL from emotional lenses entirely
4. Create a generic variable injection system for tools (not just lenses)
5. Investigate current implementation to understand what needs to change

This plan focuses on **investigation first** — we need to understand the current architecture before making changes.

---

## Tasks

### Task 1: Map Current Tool Loading Flow

**SubAgent:** `primary`  
**Prompt:** 
```
Investigate how the emotion-engine currently loads and uses TOOLS.md files.

Search the codebase for:
1. Where TOOLS.md is loaded (look in server/lib/persona-loader.cjs)
2. How emotional lenses are currently passed to the AI prompts
3. Where SELECTED_LENSES or similar variables are used
4. How the pipeline constructs the system prompt

Files to examine:
- server/lib/persona-loader.cjs
- server/03-analyze-chunks.cjs
- server/04-per-second-emotions.cjs
- server/run-pipeline.cjs
- Any config files that set default lenses

Output a detailed report with:
- File paths and line numbers where lens configuration happens
- Current flow diagram (text-based)
- List of all hardcoded defaults related to lenses
- Any environment variables currently used
```

**Folders Created/Deleted/Modified:**
- None (read-only investigation)

**Files Created/Deleted/Modified:**
- None (read-only investigation)

**Status:** ⏳ Pending

**Results:** <Waiting for SubAgent completion>

---

### Task 2: Identify Variable Injection Points

**SubAgent:** `primary`  
**Prompt:**
```
Based on the findings from Task 1, design a GENERIC variable injection system.

CRITICAL REQUIREMENT:
The pipeline scripts (03-analyze-chunks.cjs, 04-per-second-emotions.cjs, etc.)
should NOT know about "lenses" or any tool-specific data. They should only:
1. Load a generic TOOL_VARIABLES payload (from env/config)
2. Pass it to the tool/persona system
3. Let the TOOL itself validate and interpret the payload

This means:
- Emotion-tracking tool validates that lenses array is present and non-empty
- A future "sentiment-analysis" tool could validate different fields
- Pipeline is tool-agnostic

Specifically:
1. Where should TOOL_VARIABLES be loaded in the pipeline?
2. What format? (JSON env var, separate config file, CLI args?)
3. How does persona-loader.cjs pass this to tools?
4. Where should tool-specific validation happen?

Examine:
- server/run-pipeline.cjs (main entry point)
- server/lib/persona-loader.cjs (persona config loading)
- server/lib/models.cjs (any config defaults)

Output:
- List of injection points with file paths
- Recommended interface (generic, not lens-specific)
- Where validation should occur (in tool, not pipeline)
- Any breaking changes this would introduce
```

**Folders Created/Deleted/Modified:**
- None (read-only investigation)

**Files Created/Deleted/Modified:**
- None (read-only investigation)

**Status:** ⏳ Pending

**Results:** <Waiting for SubAgent completion>

---

### Task 3: Review Persona System Decoupling

**SubAgent:** `primary`  
**Prompt:**
```
Investigate how SOUL.md files currently reference emotional lenses.

Search for:
1. Any SOUL.md files that mention specific lenses
2. Any hardcoded lens references in persona identities
3. How GOAL.md files interact with TOOLS.md

Examine:
- personas/souls/*/SOUL.md (all persona files)
- personas/goals/*/GOAL.md (all goal files)
- personas/tools/*/TOOLS.md (all tool files)

Output:
- List of all SOUL/GOAL files and whether they reference lenses
- Current coupling between SOUL and TOOLS
- What needs to be decoupled
- Recommended separation of concerns
```

**Folders Created/Deleted/Modified:**
- None (read-only investigation)

**Files Created/Deleted/Modified:**
- None (read-only investigation)

**Status:** ✅ Complete

**Results:** 
SOUL.md has numeric baselines tied to lens names (e.g., "Patience Baseline: 5/10"). This breaks tool-agnosticism.

**Decision:** SOUL.md should be behavioral/qualitative only. Numeric baselines removed — if baselines are ever needed, they'd come through TOOL_VARIABLES as JSON, not hardcoded in SOUL.

---

### Task 4: Design Variable Injection Architecture

**SubAgent:** `coder`  
**Prompt:**
```
Based on findings from Tasks 1-3, design a GENERIC tool variable injection architecture.

CRITICAL: Pipeline must be tool-agnostic. It should NOT know about "lenses".

Architecture Requirements:
1. Pipeline loads generic TOOL_VARIABLES (JSON payload)
2. Pipeline passes payload to tool system unchanged
3. TOOL itself validates the payload (e.g., emotion-tracking requires lenses array)
4. Different tools can have different validation rules

Design should include:
1. Environment variable format: TOOL_VARIABLES='{"lenses":["patience","boredom"]}'
2. How persona-loader.cjs receives and forwards the payload
3. How TOOLS.md defines its expected schema (for validation)
4. Validation layer: tool-specific, not pipeline-level
5. Error handling: tool reports validation failures, pipeline just surfaces them

Output:
- Architecture diagram (text-based) showing data flow
- Proposed file changes (which files need editing)
- New files needed (e.g., tool schema validators?)
- Example .env with TOOL_VARIABLES
- Example CLI usage
- Pseudocode for tool-side validation
```

**Folders Created/Deleted/Modified:**
- None (design phase)

**Files Created/Deleted/Modified:**
- None (design phase)

**Status:** ⚠️ Needs Redesign

**Results:** 
Original design still coupled pipeline to emotion lenses. Derrick's feedback:
- Tools should be pluggable scripts (e.g., `tools/emotion-lenses-tool.cjs`)
- `03-analyze-chunks.cjs` and `04-per-second-emotions.cjs` should NOT know about lenses
- Pipeline flow: dialogue context → music context → video chunks (w/ context + prev chunk state) → per-second (w/ context + prev second state)
- `buildSystemPrompt` should be tool-agnostic — tool builds its own prompt
- CLI: fail if no TOOL_ID passed, no defaults
- Tool validates its own JSON — fail if invalid
- No backward compatibility needed (active development)

---

### Task 5: Document Findings & Recommendations

**SubAgent:** `primary`  
**Prompt:**
```
Create a comprehensive findings document summarizing all investigation results.

Include:
1. Current architecture summary
2. Problems identified
3. Proposed solution (from Task 4)
4. Implementation plan (step-by-step)
5. Risk assessment
6. Estimated effort (number of files to change)

Write this to: docs/TOOL-VARIABLE-INJECTION-FINDINGS.md

Format: Markdown with clear sections, code examples, and diagrams.
```

**Folders Created/Deleted/Modified:**
- `docs/`

**Files Created/Deleted/Modified:**
- `docs/TOOL-VARIABLE-INJECTION-FINDINGS.md` (CREATE)

**Status:** ⏳ Pending

**Results:** <Waiting for SubAgent completion>

---

## Final Results

**Status:** ✅ Investigation Complete

**What We Built:**

A complete **pluggable tool architecture** (v3.0) with:

1. **Tool-Agnostic Pipeline** — Pipeline doesn't know about "lenses" or any tool-specific logic
2. **Pluggable Tool Scripts** — Each tool is its own `.cjs` file (`tools/emotion-lenses-tool.cjs`)
3. **Path-Based Configuration** — Pipeline accepts file paths, not IDs (no directory structure coupling)
4. **Standard Tool Interface** — Tools receive `{toolVariables, videoContext, dialogueContext, musicContext, previousState}` and return `{prompt, state}`
5. **CLI Wrapper** — `bin/run-analysis.js` for user-friendly ID-based usage

**Architecture Evolution:**
- v1.0: Hardcoded `['patience','boredom','excitement']` in 7 locations
- v2.0: Generic `TOOL_VARIABLES` injection (still coupled)
- v3.0: Pluggable tools + path-based config (fully decoupled)

**Documents Created:**
- `docs/PLUGGABLE-TOOL-ARCHITECTURE.md` (40KB) — Tool interface spec
- `docs/PATH-BASED-DESIGN-UPDATE.md` (51KB) — Path-based architecture
- `docs/MIGRATION-GUIDE-v2.md` — Migration steps v1→v2→v3
- `tools/emotion-lenses-tool.cjs` — Reference implementation
- `tools/lib/tool-interface.js` — Standard contract (JSDoc)
- `lib/persona-resolver.cjs` — Optional ID→path resolver
- `bin/run-analysis.js` — CLI wrapper

**Files to Change (Implementation):**
- `server/run-pipeline.cjs` — Accept paths, validate, no ID resolution
- `server/03-analyze-chunks.cjs` — Call tool, don't build emotion prompts
- `server/04-per-second-emotions.cjs` — Call tool, don't build emotion prompts
- `server/lib/persona-loader.cjs` — Load from paths, delegate to tool
- `personas/souls/impatient-teenager/1.0.0/SOUL.md` — Remove numeric baselines

**Commits:**
- None yet (investigation phase — ready for implementation)

**Lessons Learned:**
- Separation of concerns is iterative — kept finding new couplings
- "Tool-agnostic" means the pipeline shouldn't even know what a "lens" is
- Path-based config is cleaner than ID resolution in the pipeline
- CLI wrapper gives us best of both worlds: friendly UX + clean architecture

---

*Investigation completed on 2026-03-04*
