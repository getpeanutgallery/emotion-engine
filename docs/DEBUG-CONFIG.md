# Debug Configuration Guide

## Overview

The Emotion Engine supports debug configuration options to control whether temporary files are kept or deleted during pipeline execution. This is useful for debugging, testing, and inspecting intermediate artifacts.

## Configuration Options

Add the following to your YAML configuration file:

```yaml
# Debug settings (for development/testing)
debug:
  keepTempFiles: false       # Keep ffmpeg extracts, chunk files for debugging
  keepProcessedAssets: true  # Copy to assets/processed/
```

### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `keepTempFiles` | boolean | `false` | When `true`, temporary files (audio extracts, video chunks) are preserved instead of deleted |
| `keepProcessedAssets` | boolean | `true` | When `true` and `keepTempFiles` is also `true`, temp files are copied to `assets/processed/<type>/<timestamp>/` to avoid overwrites |

## Behavior

### When `debug.keepTempFiles: false` (Default)

- Temporary files are deleted after processing
- No additional storage is used
- Clean output directory

### When `debug.keepTempFiles: true` and `keepProcessedAssets: false`

- Temporary files are kept in their original locations
- Files may be overwritten on subsequent runs
- Useful for quick inspection

### When `debug.keepTempFiles: true` and `keepProcessedAssets: true` (Recommended)

- Temporary files are copied to timestamped directories
- Multiple runs don't overwrite each other
- Files are organized by type and run time
- **Best for debugging and testing**

## File Locations

When debug mode is enabled, temp files are organized as follows:

```
output/<run-name>/
├── phase1-gather-context/
│   └── assets/
│       └── processed/
│           ├── dialogue/
│           │   └── 2026-03-06T21-19-50/  # Timestamp
│           │       ├── audio.wav
│           │       └── ...
│           └── music/
│               └── 2026-03-06T21-19-50/
│                   ├── audio.wav
│                   ├── segment-0.wav
│                   ├── segment-1.wav
│                   └── ...
└── phase2-process/
    └── assets/
        └── processed/
            └── chunks/
                └── 2026-03-06T21-19-50/
                    ├── chunk-0.mp4
                    ├── chunk-1.mp4
                    └── ...
```

## Which Scripts Are Affected

### 1. `get-dialogue.cjs`

- **Temp files:** Extracted audio (`.wav` files)
- **Location:** `assets/processed/dialogue/`
- **When:** Phase 1 (Gather Context)

### 2. `get-music.cjs`

- **Temp files:** Extracted audio and segments (`.wav` files)
- **Location:** `assets/processed/music/`
- **When:** Phase 1 (Gather Context)

### 3. `video-chunks.cjs`

- **Temp files:** Extracted video chunks (`.mp4` files)
- **Location:** `assets/processed/chunks/`
- **When:** Phase 2 (Process)

## Console Output

When debug mode is enabled, you'll see messages like:

```
💾 Kept dialogue temp file for debugging: audio.wav → /path/to/output/phase1-gather-context/assets/processed/dialogue/2026-03-06T21-19-50/audio.wav
💾 Debug mode: Dialogue temp files preserved in /path/to/output/phase1-gather-context/assets/processed/dialogue/2026-03-06T21-19-50

💾 Kept music temp file for debugging: segment-0.wav → /path/to/output/phase1-gather-context/assets/processed/music/2026-03-06T21-19-50/segment-0.wav
💾 Debug mode: Music temp files preserved in /path/to/output/phase1-gather-context/assets/processed/music/2026-03-06T21-19-50

💾 Kept chunk file for debugging: chunk-0.mp4 → /path/to/output/phase2-process/assets/processed/chunks/2026-03-06T21-19-50/chunk-0.mp4
💾 Debug mode: Chunk files preserved in /path/to/output/phase2-process/assets/processed/chunks/2026-03-06T21-19-50
```

When debug mode is disabled:

```
🧹 Cleaned up extracted chunk files
```

## Example Configurations

### Quick Test (Debug Enabled)

```yaml
# configs/quick-test.yaml
settings:
  chunk_duration: 8
  max_chunks: 2
  api_request_delay: 500
  music_segment_duration: 30

debug:
  keepTempFiles: true
  keepProcessedAssets: true
```

### Production (Debug Disabled)

```yaml
# configs/video-analysis.yaml
settings:
  chunk_duration: 8
  max_chunks: 4
  api_request_delay: 1000
  chunk_quality: "medium"
  music_segment_duration: 30

debug:
  keepTempFiles: false
  keepProcessedAssets: true
```

## Testing

Run the debug config test:

```bash
cd emotion-engine
node test-debug-config.cjs
```

Run a pipeline with debug enabled:

```bash
# Using quick-test config (has debug enabled)
node bin/run-analysis.js --config configs/quick-test.yaml

# Or manually set in any config
```

Then inspect the output:

```bash
# Check dialogue temp files
ls -la output/quick-test/phase1-gather-context/assets/processed/dialogue/

# Check music temp files
ls -la output/quick-test/phase1-gather-context/assets/processed/music/

# Check video chunk files
ls -la output/quick-test/phase2-process/assets/processed/chunks/
```

## Implementation Details

### Timestamp Format

Timestamps use ISO 8601 format with unsafe characters removed:

```
2026-03-06T21-19-50
```

This format:
- Is sortable chronologically
- Avoids filesystem-unsafe characters (`:`, `.`)
- Provides second-level precision
- Is human-readable

### Config Access Pattern

Scripts access the debug config using optional chaining:

```javascript
const keepTempFiles = config?.debug?.keepTempFiles === true;
const keepProcessedAssets = config?.debug?.keepProcessedAssets !== false;
```

This ensures:
- Missing config doesn't crash the script
- Default behavior is to delete temp files (`keepTempFiles: false`)
- Explicit `false` is respected

### Cleanup Logic

Each script handles cleanup in its `finally` block:

```javascript
try {
  // ... processing logic ...
} finally {
  if (keepTempFiles && keepProcessedAssets) {
    // Copy to timestamped directory
  } else if (keepTempFiles) {
    // Keep in place
  } else {
    // Delete temp files
  }
}
```

This ensures cleanup happens even if processing fails.

## Best Practices

1. **Development:** Enable `keepTempFiles: true` for debugging
2. **Production:** Use `keepTempFiles: false` to save disk space
3. **Testing:** Always use `keepProcessedAssets: true` to avoid overwrites
4. **CI/CD:** Disable debug mode to keep builds clean and fast

## Troubleshooting

### Temp files not being kept

- Verify `debug.keepTempFiles: true` in your config
- Check console output for debug messages
- Ensure config is being loaded correctly

### Files being overwritten

- Enable `keepProcessedAssets: true` to use timestamped directories
- Check that timestamp is being generated correctly

### Disk space issues

- Disable debug mode in production
- Clean up old timestamped directories manually
- Consider adding automated cleanup for old runs

---

*Last updated: 2026-03-06*
