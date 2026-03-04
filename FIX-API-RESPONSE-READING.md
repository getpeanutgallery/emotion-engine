# API Response Body Reading Fix

**Date:** 2026-03-03  
**Issue:** API response body not being consumed before JSON.parse()  
**Status:** ✅ Fixed

---

## Problem

The logs showed:
- API returns 200 OK with content-type: application/json
- Response is 7089 bytes with 'content-encoding: gzip'
- Body content never logged or parsed (shows "Raw API Response (7089 bytes):" with nothing after)

**Root Cause:** The `validateJSON()` function in `server/lib/api-utils.cjs` is **async** (uses `await response.text()`), but all caller files were calling it **without `await`**, which returned a Promise object instead of the actual result.

---

## Files Fixed

All files that call `validateJSON()` now properly await the result:

1. ✅ `server/01-extract-dialogue.cjs` - Line 118
2. ✅ `server/02-extract-music.cjs` - Line 123
3. ✅ `server/03-analyze-chunks.cjs` - Line 226
4. ✅ `server/04-per-second-emotions.cjs` - Line 189

**Change:** `const result = utils.validateJSON(res);` → `const result = await utils.validateJSON(res);`

---

## How It Works Now

1. **Response body is read asynchronously** using `await response.text()`
2. **Node.js fetch auto-decompresses gzip** - No manual decompression needed (Node.js v25.5.0)
3. **Full response body is logged** (truncated at 500 chars for readability)
4. **Body is read BEFORE JSON.parse()** - Proper async/await flow
5. **Error handling** - Catches read errors and parse errors separately

---

## Testing

Created test script: `test-validate-json.cjs`

**Tests:**
- ✅ Valid JSON response
- ✅ Empty response handling
- ✅ Invalid JSON handling
- ✅ Large JSON response (7089 bytes simulation)
- ✅ Null response handling

**Run tests:**
```bash
npm run test:validate-json
# or
node test-validate-json.cjs
```

---

## Key Code in api-utils.cjs

```javascript
async function validateJSON(response) {
  // ... logging headers ...
  
  // Get response text first to handle all cases
  let text;
  try {
    text = await response.text();  // ← Properly awaited
  } catch (err) {
    return {
      success: false,
      error: `Failed to read response body: ${err.message}`
    };
  }

  // Log raw response for debugging (truncated if too long)
  const truncatedText = text.length > 500 ? text.substring(0, 500) + '... [truncated]' : text;
  console.log(`🔍 Raw API Response (${text.length} bytes):`, truncatedText);

  // ... rest of validation ...
}
```

---

## Notes on Gzip

**Node.js fetch automatically handles gzip decompression.** When the API returns:
```
content-encoding: gzip
```

Node.js fetch will:
1. Automatically decompress the body
2. Return the decompressed content via `response.text()` or `response.json()`
3. No manual decompression code needed

**Reference:** Node.js fetch implementation follows the Fetch Standard which requires automatic content encoding handling.

---

## Verification

After the fix, the logs will show:
```
🔍 API Response Status: 200 OK
🔍 API Response Headers: { 'content-type': 'application/json', 'content-encoding': 'gzip' }
🔍 Content-Type: application/json
🔍 Raw API Response (7089 bytes): {"choices":[...actual content...]}
✅ API response parsed successfully
```

Instead of:
```
🔍 Raw API Response (7089 bytes):
```
(empty - because the Promise was never awaited)

---

*Fixed by subagent on 2026-03-03*
