# Pipeline Review Report

**Generated:** 2026-03-03  
**Reviewer:** Subagent (pipeline-review)  
**Test Video:** `/.cache/videos/cod.mp4` (140s, ~62MB)  
**Persona:** `impatient-teenager/1.0.0` + `video-ad-evaluation/1.0.0` + `emotion-tracking/1.0.0`

---

## Executive Summary

The Emotion Engine pipeline is **mostly functional** but has several critical issues that could cause failures during a demo. The persona-loader integration in `03-analyze-chunks.cjs` is incomplete, and there are multiple unhandled edge cases across all scripts.

**Overall Risk Level:** 🔴 HIGH (not demo-ready without fixes)

---

## Current State

### Pipeline Architecture
```
01-extract-dialogue.cjs → 02-extract-music.cjs → 03-analyze-chunks.cjs → 04-per-second-emotions.cjs
                                                                          ↓
                                                                   generate-report.cjs
```

### What Works ✅
- Basic pipeline orchestration (`run-pipeline.cjs`)
- FFmpeg audio extraction (steps 1-2)
- OpenRouter API integration with `openai/gpt-audio` model
- Persona file structure (SOUL.md, GOAL.md, TOOLS.md all present)
- SemVer version resolution in `persona-loader.cjs`
- Context loading from previous steps (dialogue + music)

### What's Broken or Risky ❌
- `03-analyze-chunks.cjs` doesn't actually use the persona system prompt correctly
- No JSON validation or retry logic on API responses
- Chunk size limit (10MB) is arbitrary and may skip important segments
- `generate-report.cjs` expects different output format than what `03-analyze-chunks.cjs` produces
- No rate limiting or API quota handling
- Missing error recovery (pipeline stops on first failure)

---

## Identified Risks (By Severity)

### 🔴 CRITICAL (Will Cause Demo Failure)

#### 1. **Persona System Not Actually Used in 03-analyze-chunks.cjs**
**Location:** `server/03-analyze-chunks.cjs`, lines 104-115

**Issue:** The script loads `persona-loader.cjs` and builds a system prompt, but then **ignores it**. The actual prompt sent to the API is a hardcoded string that doesn't use `personaConfig`:

```javascript
// Current code (BROKEN):
const prompt = personaLoader.buildSystemPrompt(personaConfig, { ... });
console.log('   Sending to Qwen (with persona context)...');
// But then sends a DIFFERENT prompt to the API!
```

**Impact:** The persona's voice, behavioral profile, and evaluation criteria are never actually used. All chunks will be analyzed with generic prompts.

**Fix Required:**
```javascript
// Should be:
const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
        model: MODEL,
        messages: [
            { role: 'system', content: prompt },  // ← Add system message
            { role: 'user', content: [{ type: 'text', text: 'Analyze this video chunk...' }, { type: 'video_url', video_url: { url: dataUrl } }] }
        ],
        max_tokens: 2000
    })
});
```

#### 2. **generate-report.cjs Expects Wrong Output Format**
**Location:** `server/generate-report.cjs`, lines 45-60

**Issue:** The report generator expects `chunksData.persona.name` and `chunksData.persona.description`, but `03-analyze-chunks.cjs` outputs:
```json
{
  "persona": {
    "id": "impatient-teenager",
    "goal": "video-ad-evaluation",
    "tools": "emotion-tracking",
    "config": { ... }
  }
}
```

**Impact:** Report generation will crash with `Cannot read property 'name' of undefined`.

**Fix Required:** Either:
- Update `generate-report.cjs` to read from the actual output structure
- Update `03-analyze-chunks.cjs` to include `name` and `description` fields

#### 3. **No JSON Validation on API Responses**
**Location:** All scripts (`01-`, `02-`, `03-`, `04-`)

**Issue:** Scripts assume API responses contain valid JSON. If the API returns an error, rate limit response, or malformed output, the pipeline crashes:

```javascript
// Current (fragile):
const jsonData = JSON.parse(jsonMatch[1]);

// Should be:
try {
    const jsonData = JSON.parse(jsonMatch[1]);
} catch (err) {
    console.error(`Failed to parse JSON: ${err.message}`);
    console.error(`Raw response: ${analysis.substring(0, 500)}`);
    // Retry or skip with warning
}
```

**Impact:** Single bad API response kills entire pipeline.

#### 4. **04-per-second-emotions.cjs Doesn't Use Persona Loader**
**Location:** `server/04-per-second-emotions.cjs`, line 14

**Issue:** Hardcodes persona instead of using `persona-loader.cjs`:
```javascript
const PERSONA = { name: 'The Impatient Teenager', description: '17yo Gen Z, scrolls if bored' };
```

**Impact:** Inconsistent persona usage across pipeline. If persona files are updated, step 4 won't reflect changes.

---

### 🟡 HIGH (Likely to Cause Issues)

#### 5. **Chunk Size Limit May Skip Content**
**Location:** `server/03-analyze-chunks.cjs`, line 152

**Issue:** Chunks >10MB are skipped:
```javascript
if (sizeMB > 10) {
    console.log('   ⚠️  Chunk too large (>10MB), skipping');
    continue;
}
```

**Impact:** For a 140s video at 62MB, average chunk size is ~4.4MB. However, action-heavy segments could exceed 10MB and be skipped, creating gaps in analysis.

**Fix:** Use bitrate-based limiting or compress chunks before sending:
```javascript
// Compress chunk to target size
await compressChunk(chunkPath, chunkPath + '.compressed', 8 * 1024 * 1024);
```

#### 6. **No API Rate Limiting**
**Location:** All scripts

**Issue:** Scripts make API calls in rapid succession without delay. OpenRouter may rate limit:

```javascript
// Add between API calls:
await new Promise(r => setTimeout(r, 1000)); // 1s delay
```

**Impact:** API may return 429 errors, causing pipeline failure.

#### 7. **Timestamp Parsing Is Fragile**
**Location:** `server/03-analyze-chunks.cjs`, lines 68-85

**Issue:** Assumes timestamps are always `MM:SS` format. If API returns `H:MM:SS` or `SS.mmm`, parsing fails:

```javascript
const parseTime = (t) => {
    const parts = t.split(':');
    return parseInt(parts[0]) * 60 + parseInt(parts[1]);
};
```

**Fix:**
```javascript
const parseTime = (t) => {
    const parts = t.split(':').map(p => parseInt(p) || 0);
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    if (parts.length === 2) return parts[0] * 60 + parts[1];
    return parseFloat(t) || 0;
};
```

#### 8. **Missing Context When Previous Steps Fail**
**Location:** `server/03-analyze-chunks.cjs`, lines 43-64

**Issue:** If steps 1-2 fail or produce empty output, step 3 continues without context but doesn't warn the user:

```javascript
if (!dialogueData) {
    console.log('   ⚠️  No dialogue file found (run step 1 first)');
    // Continues anyway
}
```

**Impact:** Analysis runs but produces lower-quality results. User may not realize context is missing.

**Fix:** Add `--require-context` flag or fail fast if context is critical.

---

### 🟠 MEDIUM (Should Fix Before Production)

#### 9. **No Retry Logic for Transient Failures**
**Location:** All scripts

**Issue:** Network errors, API timeouts, or temporary failures cause immediate exit:

```javascript
// Add retry wrapper:
async function fetchWithRetry(url, options, maxRetries = 3) {
    for (let i = 0; i < maxRetries; i++) {
        try {
            const res = await fetch(url, options);
            if (res.ok) return res;
        } catch (err) {
            if (i === maxRetries - 1) throw err;
            await new Promise(r => setTimeout(r, 2000 * (i + 1)));
        }
    }
}
```

#### 10. **Memory/Payload Limits Not Enforced**
**Location:** `server/03-analyze-chunks.cjs`, line 99

**Issue:** Base64-encoded video chunks could exceed model token limits:
```javascript
const dataUrl = `data:video/mp4;base64,${buf.toString('base64')}`;
```

For a 10MB chunk, base64 encoding = ~13.3MB string. Qwen-2.5-VL supports ~10MB images, but video may differ.

**Fix:** Add size validation before encoding:
```javascript
const maxBase64Size = 8 * 1024 * 1024; // 8MB
if (buf.length > maxBase64Size * 0.75) {
    console.log('   ⚠️  Chunk too large, compressing...');
    // Compress or split chunk
}
```

#### 11. **No Model Fallback**
**Location:** All scripts

**Issue:** Hardcoded model IDs. If `openai/gpt-audio` or `qwen/qwen3.5-122b-a10b` becomes unavailable, pipeline fails.

**Fix:** Add `MODEL_BACKUP` env var support:
```javascript
const MODEL = process.env.MODEL || process.env.MODEL_BACKUP || 'qwen/qwen3.5-122b-a10b';
```

#### 12. **Persona Version Resolution Is Incomplete**
**Location:** `server/lib/persona-loader.cjs`, lines 37-66

**Issue:** SemVer range operators (`^`, `~`) are marked as TODO:
```javascript
// TODO: Support semver ranges (^, ~) if needed
```

**Impact:** Can't specify flexible version ranges. Must pin exact versions.

**Priority:** Low for demo, but needed for production.

---

### 🟢 LOW (Nice to Have)

#### 13. **No Progress Indicators for Long Operations**
**Location:** All scripts

**Issue:** FFmpeg operations and API calls show no progress. For a 140s video, step 3 could take 5-10 minutes with no feedback.

**Fix:** Add progress bars or percentage completion:
```javascript
console.log(`   Processing chunk ${i + 1}/${numChunks} (${Math.round((i + 1) / numChunks * 100)}%)`);
```

#### 14. **No Output File Validation**
**Location:** `server/run-pipeline.cjs`, lines 73-79

**Issue:** Only checks if output file exists, not if it's valid:
```javascript
if (fs.existsSync(outputPath)) {
    const stats = fs.statSync(outputPath);
    console.log(`   Output: ${step.output} (${(stats.size / 1024).toFixed(1)} KB)`);
    resolve();
}
```

**Fix:** Validate file size > 0 and (for JSON) valid syntax.

#### 15. **Hardcoded Output Paths**
**Location:** Multiple scripts

**Issue:** Output directory defaults are relative (`../output/default`), which may resolve differently depending on working directory.

**Fix:** Use absolute paths:
```javascript
const OUTPUT_DIR = process.argv[3] || path.resolve(__dirname, '../output/default');
```

---

## Specific Code Fixes Needed

### Fix 1: 03-analyze-chunks.cjs - Use Persona System Prompt
**File:** `server/03-analyze-chunks.cjs`  
**Lines:** 104-115

```diff
  const prompt = personaLoader.buildSystemPrompt(personaConfig, {
      duration: endTime - startTime,
      selectedLenses,
      videoContext
  });

  console.log('   Sending to Qwen (with persona context)...');
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
          model: MODEL,
-         messages: [{ role: 'user', content: [{ type: 'text', text: prompt }, { type: 'video_url', video_url: { url: dataUrl } }] }],
+         messages: [
+             { role: 'system', content: prompt },
+             { role: 'user', content: [{ type: 'text', text: 'Analyze this video chunk using the persona above.' }, { type: 'video_url', video_url: { url: dataUrl } }] }
+         ],
          max_tokens: 2000
      })
  });
```

### Fix 2: generate-report.cjs - Match Actual Output Structure
**File:** `server/generate-report.cjs`  
**Lines:** 45-50

```diff
- report += `**Persona:** ${chunksData.persona.name} — ${chunksData.persona.description}\n\n`;
+ const personaName = chunksData.persona?.config?.soul?.Name || chunksData.persona?.id || 'Unknown';
+ report += `**Persona:** ${personaName}\n\n`;
```

### Fix 3: 04-per-second-emotions.cjs - Use Persona Loader
**File:** `server/04-per-second-emotions.cjs`  
**Lines:** 1-20

```diff
+ const personaLoader = require('./lib/persona-loader.cjs');
+ const SOUL_ID = process.env.SOUL_ID || 'impatient-teenager';
+ const GOAL_ID = process.env.GOAL_ID || 'video-ad-evaluation';
+ const TOOL_ID = process.env.TOOL_ID || 'emotion-tracking';
+ const personaConfig = personaLoader.loadPersonaConfig(SOUL_ID, GOAL_ID, TOOL_ID);
+ 
- const PERSONA = { name: 'The Impatient Teenager', description: '17yo Gen Z, scrolls if bored' };
+ if (!personaConfig) {
+     console.error('❌ Failed to load persona configuration');
+     process.exit(1);
+ }
```

### Fix 4: Add JSON Parsing Error Handling
**File:** All scripts (`01-`, `02-`, `03-`, `04-`)

```javascript
function safeParseJSON(analysis, fallback = {}) {
    try {
        const jsonMatch = analysis.match(/```json\s*\n([\s\S]*?)\n```/) || 
                         analysis.match(/({[\s\S]*})/);
        if (!jsonMatch) throw new Error('No JSON found');
        
        const parsed = JSON.parse(jsonMatch[1] || jsonMatch[0]);
        return { success: true, data: parsed };
    } catch (err) {
        console.error(`JSON parse error: ${err.message}`);
        console.error(`Response preview: ${analysis.substring(0, 300)}...`);
        return { success: false, error: err.message, raw: analysis };
    }
}
```

### Fix 5: Add API Retry Logic
**File:** `server/lib/api-utils.cjs` (new file)

```javascript
/**
 * Fetch with exponential backoff retry
 */
async function fetchWithRetry(url, options, maxRetries = 3) {
    const delays = [1000, 2000, 4000]; // Exponential backoff
    
    for (let i = 0; i < maxRetries; i++) {
        try {
            const res = await fetch(url, options);
            
            if (res.status === 429) {
                const retryAfter = res.headers.get('Retry-After');
                const waitTime = retryAfter ? parseInt(retryAfter) * 1000 : delays[i];
                console.log(`   Rate limited, waiting ${waitTime}ms...`);
                await new Promise(r => setTimeout(r, waitTime));
                continue;
            }
            
            if (!res.ok) {
                const error = await res.json().catch(() => ({ error: { message: res.statusText } }));
                throw new Error(error.error?.message || `HTTP ${res.status}`);
            }
            
            return res;
        } catch (err) {
            if (i === maxRetries - 1) throw err;
            console.log(`   Request failed, retrying (${i + 1}/${maxRetries})...`);
            await new Promise(r => setTimeout(r, delays[i]));
        }
    }
}

module.exports = { fetchWithRetry };
```

---

## Recommended Test Sequence

### Phase 1: Unit Tests (Before Full Pipeline)
```bash
# 1. Test persona loader
cd /home/derrick/Documents/workspace/projects/opentruth/emotion-engine/server
node -e "const loader = require('./lib/persona-loader.cjs'); const config = loader.loadPersonaConfig('impatient-teenager', 'video-ad-evaluation', 'emotion-tracking'); console.log(config ? '✅ Persona loaded' : '❌ Failed')"

# 2. Test FFmpeg availability
ffmpeg -version | head -1
ffprobe -version | head -1

# 3. Test API key
echo $OPENROUTER_API_KEY | grep -q "^sk-" && echo "✅ API key set" || echo "❌ API key missing"
```

### Phase 2: Individual Steps (With Small Test Video)
```bash
# Create 10-second test video
ffmpeg -i /.cache/videos/cod.mp4 -t 10 -c copy /tmp/test-10s.mp4

# Test step 1 (dialogue)
node 01-extract-dialogue.cjs /tmp/test-10s.mp4 ../output/test

# Test step 2 (music)
node 02-extract-music.cjs /tmp/test-10s.mp4 ../output/test

# Test step 3 (chunks) - should complete in <2 min
MAX_CHUNKS=2 node 03-analyze-chunks.cjs /tmp/test-10s.mp4 ../output/test

# Test step 4 (per-second)
node 04-per-second-emotions.cjs /tmp/test-10s.mp4 ../output/test

# Test report generation
node generate-report.cjs ../output/test
```

### Phase 3: Full Pipeline (With Actual Test Video)
```bash
# Clean output directory
rm -rf ../output/default/*

# Run full pipeline
node run-pipeline.cjs ../.cache/videos/cod.mp4 ../output/default

# Expected runtime: 10-20 minutes for 140s video
# Monitor for:
#   - API rate limits (429 errors)
#   - Chunk size warnings
#   - JSON parse errors
#   - Memory usage (should stay <2GB)
```

### Phase 4: Output Validation
```bash
# Check all output files exist and are non-empty
for f in 01-dialogue-analysis.md 02-music-analysis.md 03-chunked-analysis.json 04-per-second-emotions.json FINAL-REPORT.md; do
    if [ -s ../output/default/$f ]; then
        echo "✅ $f ($(wc -c < ../output/default/$f) bytes)"
    else
        echo "❌ $f missing or empty"
    fi
done

# Validate JSON files
jq . ../output/default/03-chunked-analysis.json > /dev/null && echo "✅ 03-chunked-analysis.json is valid JSON"
jq . ../output/default/04-per-second-emotions.json > /dev/null && echo "✅ 04-per-second-emotions.json is valid JSON"

# Check chunk count (should be ~18 for 140s video with 8s chunks)
echo "Chunks analyzed: $(jq '.chunks | length' ../output/default/03-chunked-analysis.json)"
echo "Seconds analyzed: $(jq '.per_second_data | length' ../output/default/04-per-second-emotions.json)"
```

---

## Pre-Demo Checklist

- [ ] **Fix 1:** Update `03-analyze-chunks.cjs` to use persona system prompt
- [ ] **Fix 2:** Update `generate-report.cjs` to match actual output structure
- [ ] **Fix 3:** Update `04-per-second-emotions.cjs` to use persona loader
- [ ] **Fix 4:** Add JSON parsing error handling to all scripts
- [ ] **Fix 5:** Create `lib/api-utils.cjs` with retry logic
- [ ] **Test:** Run Phase 1 unit tests
- [ ] **Test:** Run Phase 2 individual step tests with 10s video
- [ ] **Test:** Run Phase 3 full pipeline with cod.mp4
- [ ] **Test:** Run Phase 4 output validation
- [ ] **Verify:** FINAL-REPORT.md generates without errors
- [ ] **Verify:** All persona data appears in final report
- [ ] **Monitor:** API usage/costs during test run

---

## Estimated Fix Time

| Task | Priority | Time Estimate |
|------|----------|---------------|
| Fix persona integration (Fix 1-3) | 🔴 Critical | 1-2 hours |
| Add error handling (Fix 4-5) | 🔴 Critical | 1 hour |
| Run Phase 1-2 tests | 🟡 High | 30 min |
| Run Phase 3-4 tests | 🟡 High | 30 min + pipeline runtime |
| Polish and documentation | 🟢 Low | 1 hour |
| **Total** | | **4-5 hours** |

---

## Conclusion

The Emotion Engine pipeline has a solid foundation but is **not demo-ready** in its current state. The persona system integration is incomplete (the most critical issue), and there's insufficient error handling for production use.

**Recommendation:** Implement the critical fixes (1-4) before running the full pipeline test. The pipeline should work end-to-end after these changes, but monitor API usage and chunk processing closely during the first full run.

**Post-Demo Improvements:** Add retry logic, rate limiting, progress indicators, and model fallbacks for production reliability.

---

*Report generated by pipeline-review subagent*
