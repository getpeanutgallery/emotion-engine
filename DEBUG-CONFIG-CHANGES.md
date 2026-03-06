# Debug Configuration Feature - Implementation Summary

## Overview

Added configuration options to control whether temporary files are kept or deleted during pipeline execution. This enables debugging and inspection of intermediate artifacts like ffmpeg extracts and video chunks.

## Files Modified

### 1. Configuration Examples

#### `configs/video-analysis.yaml`
- Added `music_segment_duration: 30` to settings
- Added new `debug` section:
  ```yaml
  debug:
    keepTempFiles: false       # Keep ffmpeg extracts, chunk files for debugging
    keepProcessedAssets: true  # Copy to assets/processed/
  ```

#### `configs/quick-test.yaml`
- Added `music_segment_duration: 30` to settings
- Added `debug` section with `keepTempFiles: true` for testing

### 2. Scripts Updated

All three scripts that handle temporary files were updated with identical patterns:

#### `server/scripts/get-context/get-dialogue.cjs`
- **Changes:**
  - Added config reading at start of `run()` function
  - Added timestamp generation for unique directories
  - Replaced simple cleanup comment with full cleanup logic in `finally` block
- **Behavior:**
  - When `debug.keepTempFiles: true` and `keepProcessedAssets: true`: Copies audio files to `phase1-gather-context/assets/processed/dialogue/<timestamp>/`
  - When `debug.keepTempFiles: true` only: Keeps files in original `assets/processed/dialogue/` location
  - When `debug.keepTempFiles: false`: Deletes temp files (default)
- **Console output:** Shows which files are being kept and where

#### `server/scripts/get-context/get-music.cjs`
- **Changes:** Same pattern as get-dialogue.cjs
- **Behavior:** Same as above, but for music/audio segments
- **Location:** `phase1-gather-context/assets/processed/music/<timestamp>/`

#### `server/scripts/process/video-chunks.cjs`
- **Changes:**
  - Added config reading at start of `run()` function (after existing setup)
  - Added timestamp generation
  - Replaced old cleanup logic (`config?.debug || config?.keep_chunks`) with new standardized logic
- **Behavior:** Same pattern as above, but for video chunks
- **Location:** `phase2-process/assets/processed/chunks/<timestamp>/`
- **Note:** Old config key `keep_chunks` is no longer supported; use `debug.keepTempFiles`

## Configuration Schema

```yaml
settings:
  chunk_duration: 8
  max_chunks: 4
  music_segment_duration: 30  # NEW: Required for get-music.cjs
  # ... other settings

debug:  # NEW section
  keepTempFiles: false        # Keep temp files for debugging
  keepProcessedAssets: true   # Copy to timestamped directories
```

## Implementation Details

### Config Access Pattern

All scripts use the same optional chaining pattern:

```javascript
const keepTempFiles = config?.debug?.keepTempFiles === true;
const keepProcessedAssets = config?.debug?.keepProcessedAssets !== false;
const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
```

### Timestamp Format

```
2026-03-06T21-19-50
```

- ISO 8601 format with unsafe characters removed
- Sortable chronologically
- Second-level precision
- Safe for all filesystems

### Cleanup Logic Structure

```javascript
try {
  // ... processing logic ...
} finally {
  if (keepTempFiles && keepProcessedAssets) {
    // Copy to timestamped directory with logging
  } else if (keepTempFiles) {
    // Keep in place with logging
  } else {
    // Delete temp files with logging
  }
}
```

## Testing

### Unit Test

Created `test-debug-config.cjs` to verify:
- Config files load correctly
- Debug options are parsed properly
- Scripts can access the config values
- Timestamp format is safe

**Run test:**
```bash
node test-debug-config.cjs
```

**Expected output:**
```
✅ All debug config tests passed!
```

### Integration Test

To test with actual pipeline execution:

```bash
# Run with debug enabled (quick-test.yaml has keepTempFiles: true)
node bin/run-analysis.js --config configs/quick-test.yaml

# Verify temp files are kept
ls -la output/quick-test/phase1-gather-context/assets/processed/dialogue/
ls -la output/quick-test/phase1-gather-context/assets/processed/music/
ls -la output/quick-test/phase2-process/assets/processed/chunks/
```

## Documentation

Created `docs/DEBUG-CONFIG.md` with:
- Configuration options reference
- Behavior explanation for each mode
- File location diagrams
- Console output examples
- Best practices
- Troubleshooting guide

## Console Output Examples

### Debug Mode Enabled (keepTempFiles: true, keepProcessedAssets: true)

```
💾 Kept dialogue temp file for debugging: audio.wav → /path/to/output/phase1-gather-context/assets/processed/dialogue/2026-03-06T21-19-50/audio.wav
💾 Debug mode: Dialogue temp files preserved in /path/to/output/phase1-gather-context/assets/processed/dialogue/2026-03-06T21-19-50

💾 Kept music temp file for debugging: segment-0.wav → /path/to/output/phase1-gather-context/assets/processed/music/2026-03-06T21-19-50/segment-0.wav
💾 Debug mode: Music temp files preserved in /path/to/output/phase1-gather-context/assets/processed/music/2026-03-06T21-19-50

💾 Kept chunk file for debugging: chunk-0.mp4 → /path/to/output/phase2-process/assets/processed/chunks/2026-03-06T21-19-50/chunk-0.mp4
💾 Debug mode: Chunk files preserved in /path/to/output/phase2-process/assets/processed/chunks/2026-03-06T21-19-50
```

### Debug Mode Disabled (Default)

```
🧹 Cleaned up extracted chunk files
```

## Backward Compatibility

- **Breaking change:** Old config key `config?.keep_chunks` in video-chunks.cjs is no longer supported
- **Migration:** Use `debug.keepTempFiles` instead
- **Default behavior:** Unchanged (temp files are deleted by default)

## Benefits

1. **Debugging:** Inspect intermediate artifacts to understand pipeline behavior
2. **Testing:** Verify ffmpeg extraction is working correctly
3. **Development:** Debug issues with audio/video processing
4. **Flexibility:** Choose between keeping files in place or organized by timestamp
5. **Safety:** Timestamped directories prevent overwrites from multiple runs

## Next Steps

To complete the feature:

1. ✅ Config schema updated
2. ✅ Scripts updated to check config
3. ✅ Temp files moved to `assets/processed/<type>/<timestamp>/` when enabled
4. ✅ Console logs indicate when files are kept
5. ✅ Test script created and passing
6. ✅ Documentation created

**Remaining:** Manual integration test with actual video file (requires API key and time)

---

*Implementation completed: 2026-03-06*
