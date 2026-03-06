# Emotion-Engine Path-Based Soul/Goal Loading - Changes Summary

**Date:** 2026-03-06  
**Goal:** Modify the emotion-engine codebase to accept full paths for soulId/goalId instead of ID-based lookup.

---

## Files Modified

### 1. `tools/emotion-lenses-tool.cjs`

**Changes:**
- Removed dependency on `personaLoader` for path construction
- Changed validation to check for `soulPath` and `goalPath` instead of `soulId` and `goalId`
- Added `loadPersonaFromPaths()` function that loads files directly using `fs.readFileSync()`
- Added local `parseMarkdown()` function (copied from persona-loader for independence)
- Added `loadTools()` helper that still uses persona-loader for TOOLS.md (optional)

**Key Code Changes:**
```javascript
// Old:
const personaLoader = require('../server/lib/persona-loader.cjs');
const personaConfig = personaLoader.loadPersonaConfig(toolVariables.soulId, toolVariables.goalId);

// New:
function loadPersonaFromPaths(soulPath, goalPath, toolId = 'emotion-tracking') {
  // Direct file loading without ID lookup
  const soulContent = fs.readFileSync(soulPath, 'utf8');
  const goalContent = fs.readFileSync(goalPath, 'utf8');
  return { soul: parseMarkdown(soulContent), goal: parseMarkdown(goalContent) };
}
```

---

### 2. `server/lib/persona-loader.cjs`

**Changes:**
- Modified `loadSoul()` to detect if input is a full path or an ID
- Modified `loadGoal()` to detect if input is a full path or an ID
- If full path (starts with `/` or contains `personas/`), uses it directly
- If ID, constructs path as before (backward compatibility maintained)

**Key Code Changes:**
```javascript
// Old:
function loadSoul(soulId, version = 'latest') {
    const baseDir = path.join(PERSONAS_ROOT, 'souls', soulId);
    const resolvedVersion = resolveVersion(baseDir, version);
    const soulPath = path.join(baseDir, resolvedVersion, 'SOUL.md');
    // ...
}

// New:
function loadSoul(soulIdOrPath, version = 'latest') {
    let soulPath;
    
    // Detect if input is a full path or an ID
    if (soulIdOrPath.startsWith('/') || soulIdOrPath.includes('personas/')) {
        // Full path provided - use directly
        soulPath = soulIdOrPath;
        if (!fs.existsSync(soulPath)) {
            console.error(`❌ SOUL.md not found at path: ${soulPath}`);
            return null;
        }
    } else {
        // ID provided - construct path (backward compatibility)
        const baseDir = path.join(PERSONAS_ROOT, 'souls', soulIdOrPath);
        // ... construct path as before
    }
    // ...
}
```

**Backward Compatibility:** The persona-loader still accepts IDs and will construct paths from them. This allows existing code that uses IDs to continue working.

---

### 3. `server/scripts/process/video-chunks.cjs`

**Changes:**
- Updated validation to check for `soulPath` and `goalPath` instead of `soulId` and `goalId`
- Updated chunk result to include both `soulPath` and `goalPath` in persona info
- Updated test mode console message to reference correct property names

**Key Code Changes:**
```javascript
// Old:
if (!toolVariables?.soulId || !toolVariables?.goalId) {
    throw new Error('VideoChunks: toolVariables.soulId and toolVariables.goalId are required');
}

// New:
if (!toolVariables?.soulPath || !toolVariables?.goalPath) {
    throw new Error('VideoChunks: toolVariables.soulPath and toolVariables.goalPath are required');
}
```

---

### 4. `configs/cod-test.yaml`

**Changes:**
- Renamed `soulId` → `soulPath`
- Renamed `goalId` → `goalPath`
- Paths remain the same (relative paths to persona files)

**Key Code Changes:**
```yaml
# Old:
tool_variables:
  soulId: "personas/souls/impatient-teenager/1.0.0/SOUL.md"
  goalId: "personas/goals/video-ad-evaluation/1.0.0/GOAL.md"

# New:
tool_variables:
  soulPath: "personas/souls/impatient-teenager/1.0.0/SOUL.md"
  goalPath: "personas/goals/video-ad-evaluation/1.0.0/GOAL.md"
```

---

### 5. `server/scripts/report/recommendation.cjs`

**Changes:**
- Updated to check for `soulPath` instead of `soulId`
- Extracts persona name from path for display in suggestions
- Updated test mode config to use `soulPath`

**Key Code Changes:**
```javascript
// Old:
if (config?.tool_variables?.soulId) {
    recommendation.suggestions.push(
      `Consider testing with different personas (current: ${config.tool_variables.soulId})`
    );
}

// New:
if (config?.tool_variables?.soulPath) {
    const soulPath = config.tool_variables.soulPath;
    const personaName = soulPath.split('/').slice(-3, -2)[0] || soulPath;
    recommendation.suggestions.push(
      `Consider testing with different personas (current: ${personaName})`
    );
}
```

---

## Testing

**Validation performed:**
1. ✅ `persona-loader` accepts full paths and detects them correctly (starts with `/` or contains `personas/`)
2. ✅ `persona-loader` maintains backward compatibility with IDs
3. ✅ `emotion-lenses-tool` validates `soulPath` and `goalPath`
4. ✅ `cod-test.yaml` uses correct property names and valid paths
5. ✅ Paths resolve correctly and files load successfully
6. ✅ No remaining references to old `soulId`/`goalId` property names in tool variables

---

## Backward Compatibility Concerns

### What's Maintained:
- **persona-loader.cjs**: Still accepts IDs and constructs paths from them
- **loadPersonaConfig()**: Still works with ID-based lookup
- **persona-resolver.cjs**: Still provides ID-to-path resolution functions

### What's Changed:
- **emotion-lenses-tool.cjs**: Now requires full paths (no ID lookup)
- **video-chunks.cjs**: Now requires full paths in toolVariables
- **cod-test.yaml**: Uses `soulPath`/`goalPath` instead of `soulId`/`goalId`

### Migration Path:
Configs that use `soulId`/`goalId` will need to be updated to use `soulPath`/`goalPath`. The persona-loader will still support ID-based loading for other use cases, but the emotion-lenses-tool now expects full paths.

---

## System Behavior

**Before:** 
- YAML config provided `soulId` and `goalId` (e.g., "impatient-teenager")
- Code constructed paths: `personas/souls/impatient-teenager/1.0.0/SOUL.md`
- Persona-loader resolved version and loaded files

**After:**
- YAML config provides full paths (e.g., "personas/souls/impatient-teenager/1.0.0/SOUL.md")
- Code loads files directly with `fs.readFileSync()`
- No ID-to-path conversion needed
- Path detection: if path starts with `/` or contains `personas/`, it's treated as a full path

---

## Summary

The emotion-engine now accepts full paths for soul and goal configuration, eliminating the need for ID-to-path conversion in the primary analysis pipeline. The persona-loader maintains backward compatibility for other use cases that may still use ID-based lookup.

**All files modified:**
1. `tools/emotion-lenses-tool.cjs`
2. `server/lib/persona-loader.cjs`
3. `server/scripts/process/video-chunks.cjs`
4. `configs/cod-test.yaml`
5. `server/scripts/report/recommendation.cjs`

**System now accepts full paths without ID lookup!** ✅
