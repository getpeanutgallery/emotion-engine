# TOOL VARIABLE INJECTION INVESTIGATION FINDINGS

**Date:** 2026-03-04  
**Status:** Investigation Complete  
**Project:** Emotion Engine - Tool Variable Injection System  
**Tasks Completed:** 4 (Investigation → Design → Architecture → Documentation)

---

## 1. Executive Summary

We investigated the emotion-engine tool variable injection system to determine how emotional lenses are configured and whether the pipeline supports tool-agnostic variable injection. **Key finding:** The system currently hardcodes `['patience', 'boredom', 'excitement']` in **7 locations** across the codebase, with no environment variable support for tool-specific configuration. The pipeline is tightly coupled to lens-specific logic, violating the principle of tool-agnosticism. **Recommendation:** Implement a generic `TOOL_VARIABLES` JSON environment variable that the pipeline loads and forwards unchanged, letting each tool validate its own payload requirements. This enables true tool-agnosticism while maintaining backward compatibility.

---

## 2. Current Architecture Summary

### 2.1 How TOOLS.md Loads Today

The current system loads persona configuration through a multi-step process:

1. **Environment Variables** (`.env` file):
   ```bash
   SOUL_ID=impatient-teenager
   GOAL_ID=video-ad-evaluation
   TOOL_ID=emotion-tracking
   ```

2. **Persona Loader** (`server/lib/persona-loader.cjs`):
   - Loads `SOUL.md` (persona identity)
   - Loads `GOAL.md` (evaluation objective)
   - Loads `TOOLS.md` (tool schema + lens definitions)
   - Builds system prompt with hardcoded lens logic

3. **Pipeline Scripts** (`03-analyze-chunks.cjs`, `04-per-second-emotions.cjs`):
   - Call `personaLoader.loadPersonaConfig()`
   - Hardcode `selectedLenses = ['patience', 'boredom', 'excitement']`
   - Pass lenses to `buildSystemPrompt()`

### 2.2 Hardcoded Default Locations (7 Total)

| # | File | Line | Hardcoded Value | Context |
|---|------|------|-----------------|---------|
| 1 | `server/03-analyze-chunks.cjs` | ~200 | `selectedLenses = ['patience', 'boredom', 'excitement']` | Chunked video analysis |
| 2 | `server/04-per-second-emotions.cjs` | ~181 | `selectedLenses = ['patience', 'boredom', 'excitement']` | Per-second timeline |
| 3 | `server/lib/persona-loader.cjs` | ~169 | `selectedLenses = ['patience', 'boredom', 'excitement']` | Default parameter in `buildSystemPrompt()` |
| 4 | `server/lib/persona-loader.cjs` | ~160 | Lens lookup logic | Assumes specific TOOLS.md table format |
| 5 | `server/lambda/lib/openrouter-enhanced.cjs` | ~165 | Lens defaults | Lambda runtime |
| 6 | `server/lambda/handler.cjs` | ~124, 354 | Lens defaults | Lambda handler (2 locations) |
| 7 | `server/lambda/index.js` | ~121, 330 | Lens defaults | Lambda entry point (2 locations) |

**Note:** Lines 5-7 are in Lambda deployment code and follow the same pattern.

### 2.3 Current Coupling: SOUL/GOAL/TOOLS

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   SOUL.md    │     │   GOAL.md    │     │   TOOLS.md   │
│  (Identity)  │     │  (Objective) │     │  (Schema)    │
│              │     │              │     │              │
│ - Name       │     │ - Primary    │     │ - Lenses     │
│ - Age        │     │   Objective  │     │   Table      │
│ - Demographic│     │ - Success    │     │ - Validation │
│ - Core Truth │     │   Criteria   │     │   Rules      │
│ - Behavioral │     │              │     │              │
│   Profile    │     │              │     │              │
└──────┬───────┘     └──────┬───────┘     └──────┬───────┘
       │                    │                    │
       └────────────────────┼────────────────────┘
                            │
                            ▼
                 ┌──────────────────────┐
                 │  persona-loader.cjs  │
                 │  buildSystemPrompt() │
                 │                      │
                 │  ❌ KNOWS ABOUT      │
                 │     LENSES           │
                 └──────────────────────┘
```

**Problem:** The pipeline (persona-loader) knows about "lenses" and interprets them, making it impossible to use different tools with different variable structures without modifying the pipeline.

---

## 3. Problems Identified

### 3.1 Hardcoded Lens Array in 7 Places

**Impact:** Changing emotional lenses requires editing multiple files across the codebase.

**Example:**
```javascript
// Current (hardcoded in 7 files)
const selectedLenses = ['patience', 'boredom', 'excitement'];
```

**Problem:** 
- No runtime configurability
- Violates DRY principle
- Makes A/B testing different lens combinations difficult
- Tightly couples pipeline to emotion-tracking tool

### 3.2 No Environment Variable Support for Tool Variables

**Impact:** Cannot override lens configuration without code changes.

**Current State:**
```bash
# .env file has NO support for tool variables
SOUL_ID=impatient-teenager  # ✅ Configurable
GOAL_ID=video-ad-evaluation # ✅ Configurable
TOOL_ID=emotion-tracking    # ✅ Configurable
# Lenses? ❌ Hardcoded in source
```

**Desired State:**
```bash
# .env file with full configurability
SOUL_ID=impatient-teenager
GOAL_ID=video-ad-evaluation
TOOL_ID=emotion-tracking
TOOL_VARIABLES='{"lenses":["patience","boredom","excitement"]}'  # ✅ Configurable
```

### 3.3 SOUL.md Has Numeric Baselines Tied to Specific Lens Names

**Current SOUL.md Structure:**
```markdown
## Behavioral Profile

**Baseline Scores:**
- Patience: 3/10 (quick to frustration)
- Boredom: 7/10 (easily bored)
- Excitement: 5/10 (moderate enthusiasm)
```

**Problems:**
- Baselines are **numeric** (should be qualitative/behavioral)
- Baselines are **lens-specific** (breaks tool-agnosticism)
- If you change lenses, SOUL.md becomes invalid
- Pipeline would need to parse and interpret baselines

**Principle Violation:** SOUL.md should describe **who the persona is**, not **how to configure the tool**.

### 3.4 Pipeline Knows About "Lenses"

**Current Flow:**
```javascript
// persona-loader.cjs (pipeline code)
function buildSystemPrompt(config, options = {}) {
    const { selectedLenses = ['patience', 'boredom', 'excitement'] } = options;
    
    // ❌ Pipeline interprets lenses
    const lensesText = selectedLenses.map(lens => {
        const lensInfo = findLensInfo(tools, lens);
        return `- **${capitalize(lens)}**: ${lensInfo.description}`;
    }).join('\n');
}
```

**Problem:** The pipeline should be a **dumb messenger**, not a **smart interpreter**. It should:
- ✅ Load `TOOL_VARIABLES` from environment
- ✅ Pass them through unchanged
- ❌ NOT know what "lenses" are
- ❌ NOT validate lens names
- ❌ NOT interpret tool-specific data structures

---

## 4. Proposed Solution

### 4.1 TOOL_VARIABLES as JSON Environment Variable

**Format:**
```bash
TOOL_VARIABLES='{"lenses":["patience","boredom","excitement"],"thresholds":{"patience":3}}'
```

**Why JSON:**
- ✅ Single source of truth
- ✅ Supports complex nested structures
- ✅ Easy to override in CI/CD, Docker, CLI
- ✅ Follows 12-factor app methodology
- ✅ No additional config files needed

### 4.2 Pipeline Loads and Forwards Unchanged

**New Flow:**
```javascript
// run-pipeline.cjs (entry point)
const TOOL_VARIABLES = JSON.parse(process.env.TOOL_VARIABLES || '{}');
process.env.TOOL_VARIABLES = JSON.stringify(TOOL_VARIABLES);

// 03-analyze-chunks.cjs (pipeline step)
const toolVariables = JSON.parse(process.env.TOOL_VARIABLES || '{}');

// persona-loader.cjs (composition layer)
function buildSystemPrompt(config, options = {}) {
    const { toolVariables = {} } = options;
    // Pass through - don't interpret
}
```

**Key Principle:** Pipeline is a **dumb messenger**.

### 4.3 Tools Validate Their Own Payloads

**Tool-Specific Validation (in tool, not pipeline):**
```javascript
// Emotion-tracking tool validation (future implementation)
function validateToolVariables(vars) {
    if (!vars.lenses || !Array.isArray(vars.lenses) || vars.lenses.length === 0) {
        throw new Error('emotion-tracking: lenses array required');
    }
    return true;
}

// Future sentiment-analysis tool (different validation, same interface)
function validateToolVariables(vars) {
    if (!vars.sentimentCategories || !Array.isArray(vars.sentimentCategories)) {
        throw new Error('sentiment-analysis: sentimentCategories array required');
    }
    return true;
}
```

**Key Principle:** Tools are **smart validators**.

### 4.4 SOUL.md Becomes Behavioral/Qualitative Only

**New SOUL.md Structure:**
```markdown
## Behavioral Profile

**Emotional Baselines:**
- Generally impatient with slow-paced content
- Quick to detect inauthenticity
- Easily bored by repetitive visuals
- Engages with rapid cuts and dynamic audio

**Voice:**
- Sarcastic, direct, Gen-Z vernacular
- No patience for corporate speak
```

**Changes:**
- ❌ Remove numeric scores tied to specific lens names
- ✅ Keep qualitative behavioral descriptions
- ✅ Focus on **who the persona is**, not **how to configure the tool**

---

## 5. Implementation Plan

### Phase 1: Add TOOL_VARIABLES Support to Pipeline

**Goal:** Enable environment variable loading without breaking existing functionality.

**Steps:**

1. **Update `server/run-pipeline.cjs`** (entry point)
   ```javascript
   // Add after dotenv.config()
   let TOOL_VARIABLES = {};
   if (process.env.TOOL_VARIABLES) {
       try {
           TOOL_VARIABLES = JSON.parse(process.env.TOOL_VARIABLES);
           logger.info(`Loaded TOOL_VARIABLES: ${Object.keys(TOOL_VARIABLES).join(', ')}`);
       } catch (e) {
           logger.error(`Invalid TOOL_VARIABLES JSON: ${e.message}`);
           process.exit(1);
       }
   }
   process.env.TOOL_VARIABLES = JSON.stringify(TOOL_VARIABLES);
   ```

2. **Update `server/lib/persona-loader.cjs`** (composition layer)
   ```javascript
   function buildSystemPrompt(config, options = {}) {
       const { 
           duration = 30, 
           toolVariables = {}, 
           videoContext = '',
           selectedLenses  // Backward compatibility
       } = options;
       
       // Extract lenses from toolVariables (or use backward-compatible fallback)
       const lenses = toolVariables.lenses || selectedLenses || ['patience', 'boredom', 'excitement'];
       
       // ... rest of function
   }
   ```

3. **Update `.env.example`** (documentation)
   ```bash
   # Tool-specific variables (JSON format)
   TOOL_VARIABLES='{"lenses":["patience","boredom","excitement"]}'
   ```

**Testing:**
- ✅ Run without `TOOL_VARIABLES` (uses defaults)
- ✅ Run with `TOOL_VARIABLES` override
- ✅ Run with invalid JSON (fails gracefully)

---

### Phase 2: Remove Hardcoded Defaults from 7 Locations

**Goal:** Eliminate all hardcoded lens arrays.

**Files to Update:**

| File | Change |
|------|--------|
| `server/03-analyze-chunks.cjs` (line ~198) | Replace `selectedLenses = [...]` with `toolVariables = JSON.parse(process.env.TOOL_VARIABLES \|\| '{}')` |
| `server/04-per-second-emotions.cjs` (line ~181) | Same as above |
| `server/lib/persona-loader.cjs` (line ~169) | Update default parameter to use `toolVariables.lenses` |
| `server/lambda/lib/openrouter-enhanced.cjs` (line ~165) | Same pattern |
| `server/lambda/handler.cjs` (lines ~124, 354) | Same pattern (2 locations) |
| `server/lambda/index.js` (lines ~121, 330) | Same pattern (2 locations) |

**Testing:**
- ✅ Verify all 7 locations use `toolVariables` from environment
- ✅ Run full pipeline with custom lenses
- ✅ Verify output uses correct lenses

---

### Phase 3: Add Tool-Side Validation (Emotion-Tracking)

**Goal:** Move validation logic from pipeline to tool.

**Steps:**

1. **Create validation function** (in emotion-tracking tool runtime)
   ```javascript
   function validateToolVariables(toolVariables) {
       if (!toolVariables.lenses || !Array.isArray(toolVariables.lenses)) {
           throw new Error('emotion-tracking: lenses array required');
       }
       if (toolVariables.lenses.length === 0) {
           throw new Error('emotion-tracking: lenses array must have at least 1 item');
       }
       return true;
   }
   ```

2. **Update TOOLS.md** (document expected variables)
   ```markdown
   ## Expected Variables
   
   ```json
   {
     "lenses": ["array", "of", "emotion", "names"],
     "thresholds": {"emotion_name": critical_threshold_number},
     "baselines": {"emotion_name": baseline_score}
   }
   ```
   ```

**Testing:**
- ✅ Pass valid `TOOL_VARIABLES` (succeeds)
- ✅ Pass empty lenses array (fails with clear error)
- ✅ Pass missing lenses field (fails with clear error)

---

### Phase 4: Refactor SOUL.md to Remove Numeric Baselines

**Goal:** Make SOUL.md purely qualitative/behavioral.

**File:** `personas/souls/impatient-teenager/1.0.0/SOUL.md`

**Before:**
```markdown
## Behavioral Profile

**Baseline Scores:**
- Patience: 3/10 (quick to frustration)
- Boredom: 7/10 (easily bored)
- Excitement: 5/10 (moderate enthusiasm)
```

**After:**
```markdown
## Behavioral Profile

**Emotional Tendencies:**
- Generally impatient with slow-paced content
- Quick to detect inauthenticity
- Easily bored by repetitive visuals
- Engages with rapid cuts and dynamic audio
- Skeptical of corporate messaging
```

**Testing:**
- ✅ Verify persona still behaves consistently
- ✅ Verify no numeric baselines referenced in pipeline
- ✅ Verify SOUL.md works with any lens combination

---

### Phase 5: Update TOOLS.md Documentation

**Goal:** Document the new `TOOL_VARIABLES` system.

**Files to Update:**

1. **`TOOLS.md` (workspace root)**
   - Add `TOOL_VARIABLES` section
   - Include examples for emotion-tracking tool
   - Document JSON format

2. **`docs/README.md` (project documentation)**
   - Add migration guide
   - Include CLI examples
   - Document backward compatibility

3. **`.env.example`**
   - Add comprehensive `TOOL_VARIABLES` examples
   - Show different use cases (different lenses, thresholds, etc.)

---

## 6. Files to Change

### Complete List with Line Numbers

| # | File | Lines | Change Type | Priority |
|---|------|-------|-------------|----------|
| 1 | `server/run-pipeline.cjs` | ~17-25 | Add `TOOL_VARIABLES` loading | P0 |
| 2 | `server/03-analyze-chunks.cjs` | ~198 | Replace hardcoded lenses | P0 |
| 3 | `server/04-per-second-emotions.cjs` | ~181 | Replace hardcoded lenses | P0 |
| 4 | `server/lib/persona-loader.cjs` | ~169 | Update `buildSystemPrompt()` signature | P0 |
| 5 | `server/lambda/lib/openrouter-enhanced.cjs` | ~165 | Replace hardcoded lenses | P1 |
| 6 | `server/lambda/handler.cjs` | ~124, 354 | Replace hardcoded lenses (2 locations) | P1 |
| 7 | `server/lambda/index.js` | ~121, 330 | Replace hardcoded lenses (2 locations) | P1 |
| 8 | `personas/souls/impatient-teenager/1.0.0/SOUL.md` | N/A | Remove numeric baselines | P1 |
| 9 | `.env.example` | N/A | Add `TOOL_VARIABLES` documentation | P0 |
| 10 | `docs/README.md` | N/A | Add migration guide | P2 |

**Total Files:** 10 (8 code files + 2 documentation files)

---

## 7. Risk Assessment

### 7.1 Breaking Changes

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| **Missing `TOOL_VARIABLES` env var** | Pipeline uses defaults (non-breaking) | High | Provide sensible defaults in `persona-loader.cjs` |
| **Invalid JSON syntax** | Pipeline exits with error | Medium | Validate JSON syntax early, show clear error message |
| **Empty lenses array** | Tool validation fails (future) | Medium | Tool-side validation with clear error messages |
| **Lambda deployment** | Requires environment variable update | High | Update Lambda environment configuration during deployment |

### 7.2 Backward Compatibility Strategy

**Phase 1: Dual Support (v1.x)**
```javascript
// Support both old and new APIs
const lenses = toolVariables.lenses || selectedLenses || ['patience', 'boredom', 'excitement'];
```

**Priority Order:**
1. `toolVariables.lenses` (new standard)
2. `selectedLenses` (backward compatibility)
3. `['patience', 'boredom', 'excitement']` (fallback default)

**Phase 2: Deprecation Notice (v1.5.0)**
- Add console warnings when `selectedLenses` parameter is used
- Document migration timeline

**Phase 3: Removal (v2.0.0)**
- Remove `selectedLenses` parameter support
- Require `toolVariables.lenses`

### 7.3 Lambda Deployment Considerations

**Current State:**
- Lambda functions have hardcoded lens defaults
- No environment variable configuration

**Required Changes:**
1. Update Lambda environment variables to include `TOOL_VARIABLES`
2. Redeploy Lambda functions with updated code
3. Test Lambda invocation with new environment variable

**Rollback Plan:**
- Keep old Lambda version available
- Revert environment variable if issues arise
- Monitor CloudWatch logs for errors

---

## 8. Estimated Effort

### 8.1 Complexity Assessment

| Metric | Value | Notes |
|--------|-------|-------|
| **Number of Files** | 10 | 8 code files + 2 documentation files |
| **Lines of Code Changed** | ~50 | Mostly find/replace + new env var parsing |
| **Complexity** | Low-Medium | Straightforward changes, no complex logic |
| **Testing Effort** | Medium | Need to verify all pipeline steps work with new flow |
| **Risk** | Low | Backward compatible, easy rollback |

### 8.2 Time Estimate

| Phase | Estimated Time | Dependencies |
|-------|---------------|--------------|
| Phase 1: Add TOOL_VARIABLES support | 2-3 hours | None |
| Phase 2: Remove hardcoded defaults | 2-3 hours | Phase 1 |
| Phase 3: Add tool-side validation | 3-4 hours | Phase 2 |
| Phase 4: Refactor SOUL.md | 1-2 hours | None |
| Phase 5: Update documentation | 1-2 hours | Phase 1-4 |
| **Testing & QA** | 3-4 hours | All phases |
| **Total** | **12-18 hours** | ~2-3 working days |

### 8.3 Testing Requirements

**Unit Tests:**
- [ ] `run-pipeline.cjs` loads `TOOL_VARIABLES` from env
- [ ] `run-pipeline.cjs` validates JSON syntax
- [ ] `persona-loader.cjs` accepts `toolVariables` parameter
- [ ] `persona-loader.cjs` falls back to `selectedLenses` (backward compat)

**Integration Tests:**
- [ ] Pipeline runs without `TOOL_VARIABLES` set (uses defaults)
- [ ] Pipeline runs with `TOOL_VARIABLES` override
- [ ] Pipeline fails gracefully on invalid JSON
- [ ] Pipeline passes `toolVariables` to persona-loader

**End-to-End Tests:**
- [ ] Full pipeline with default lenses
- [ ] Full pipeline with custom lenses
- [ ] Full pipeline with thresholds
- [ ] Output JSON contains expected emotion scores

**Edge Cases:**
- [ ] Empty `TOOL_VARIABLES` object: `{}`
- [ ] Empty lenses array: `{"lenses":[]}`
- [ ] Invalid lens names: `{"lenses":["invalid_emotion"]}`
- [ ] Missing lenses field: `{"thresholds":{"patience":3}}`
- [ ] Non-JSON value: `TOOL_VARIABLES='not json'`

---

## 9. Reference Documents

### 9.1 Investigation Outputs

| Document | Description | Location |
|----------|-------------|----------|
| **Task 1: Hardcoded Defaults Investigation** | Identified 7 locations with hardcoded lens arrays | `docs/TOOL-VARIABLE-INVESTIGATION.md` |
| **Task 2: Variable Injection Design** | Preliminary design proposal | `docs/variable-injection-design.md` |
| **Task 3: Implementation Plan** | Step-by-step implementation guide | (This document, Section 5) |
| **Task 4: Architecture Specification** | Complete architecture with diagrams | `docs/TOOL-VARIABLE-INJECTION-ARCHITECTURE.md` |

### 9.2 Related Files

| File | Purpose |
|------|---------|
| `server/run-pipeline.cjs` | Pipeline orchestrator (entry point) |
| `server/lib/persona-loader.cjs` | Persona composition layer |
| `server/03-analyze-chunks.cjs` | Chunked video analysis pipeline step |
| `server/04-per-second-emotions.cjs` | Per-second emotion timeline pipeline step |
| `personas/souls/impatient-teenager/1.0.0/SOUL.md` | Example persona (needs baseline refactor) |
| `personas/tools/emotion-tracking/1.0.0/TOOLS.md` | Emotion-tracking tool schema |

---

## 10. Recommendations

### 10.1 Immediate Actions (This Week)

1. ✅ **Implement Phase 1** (TOOL_VARIABLES loading in `run-pipeline.cjs`)
2. ✅ **Implement Phase 2** (Remove hardcoded defaults from 7 locations)
3. ✅ **Update `.env.example`** with comprehensive documentation
4. ✅ **Test backward compatibility** (run pipeline with and without `TOOL_VARIABLES`)

### 10.2 Short-Term Actions (Next 2 Weeks)

1. 📋 **Implement Phase 3** (Tool-side validation for emotion-tracking)
2. 📋 **Implement Phase 4** (Refactor SOUL.md to remove numeric baselines)
3. 📋 **Implement Phase 5** (Update TOOLS.md documentation)
4. 📋 **Add unit tests** for all modified files
5. 📋 **Deploy to staging** and run full test suite

### 10.3 Long-Term Considerations (Future)

1. 🔮 **Per-step tool variables** (different lenses for different pipeline steps)
2. 🔮 **Tool discovery + schema validation** (auto-load validation schema from `TOOL_ID`)
3. 🔮 **Config file fallback** (support both env var and `config/tool-variables.json`)
4. 🔮 **Dynamic lens selection** (AI recommends lenses based on video content)

---

## 11. Conclusion

This investigation reveals that the emotion-engine pipeline currently violates the principle of **tool-agnosticism** by hardcoding lens-specific logic in 7 locations. The proposed `TOOL_VARIABLES` system addresses this by:

1. ✅ Loading generic JSON payload from environment
2. ✅ Passing payload through pipeline without interpretation
3. ✅ Letting tools validate their own requirements
4. ✅ Supporting future tools with different variable structures
5. ✅ Maintaining backward compatibility during migration

**Key Principle:** *Pipeline is a dumb messenger. Tools are smart validators.*

**Implementation effort:** 12-18 hours (2-3 working days)  
**Risk level:** Low (backward compatible, easy rollback)  
**Recommendation:** **Proceed with implementation** following the 5-phase plan outlined above.

---

*Investigation complete. Ready for implementation.*

**Last Updated:** 2026-03-04  
**Author:** Emotion Engine Investigation Team  
**Status:** ✅ Investigation Complete → 📋 Ready for Implementation
