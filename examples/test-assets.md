# Test Assets for Emotion Engine v8.0

This document describes test assets used for validating the Emotion Engine pipeline scripts.

## Required Test Assets

### 1. Test Video

**Location:** `examples/videos/emotion-tests/cod.mp4` (current test video)

**Requirements:**
- Duration: 30-60 seconds (for quick testing)
- Format: MP4 (H.264 video, AAC audio)
- Content: Should include both speech and background music
- Resolution: Any (720p or higher recommended)

**How to Create:**
```bash
# Option 1: Use existing test video
cp examples/videos/emotion-tests/cod.mp4 /path/to/your/test.mp4

# Option 2: Create test video with ffmpeg (color bars + tone)
ffmpeg -f lavfi -i testsrc=duration=30:size=1280x720:rate=30 \
       -f lavfi -i sine=frequency=440:duration=30 \
       -c:v libx264 -c:a aac \
       examples/videos/emotion-tests/test-video.mp4

# Option 3: Download sample video
# Use a Creative Commons video from Pexels, Pixabay, etc.
```

### 2. Test Audio (Optional)

**Location:** Extract from test video as needed

**Requirements:**
- Duration: 30 seconds
- Format: WAV or MP3
- Content: Clear speech for transcription testing

**How to Create:**
```bash
# Extract audio from test video
ffmpeg -i examples/videos/emotion-tests/cod.mp4 -vn -acodec pcm_s16le test-audio.wav
```

### 3. Test Image (Optional)

**Location:** Extract from test video as needed

**Requirements:**
- Format: JPEG
- Resolution: 1280x720 or similar
- Content: Frame from test video

**How to Create:**
```bash
# Extract frame from test video at 5 seconds
ffmpeg -i examples/videos/emotion-tests/cod.mp4 -ss 5 -vframes 1 test-frame.jpg
```

## Using Test Assets

### Quick Test (2 chunks, ~16 seconds)

```bash
# Set environment variables
export AI_API_KEY="your-api-key"
export AI_MODEL="qwen/qwen-3.5-397b-a17b"

# Run quick test pipeline with cod.mp4
cd /home/derrick/.openclaw/workspace/projects/opentruth/emotion-engine
node server/run-pipeline.cjs --config configs/quick-test.yaml
```

### Full Test (all scripts)

```bash
# Run full analysis pipeline with cod.mp4
node server/run-pipeline.cjs --config configs/video-analysis.yaml
```

### Individual Script Testing

**Test get-dialogue.cjs:**
```bash
AI_API_KEY="your-key" node server/scripts/get-context/get-dialogue.cjs \
  .cache/videos/test-video.mp4 \
  output/test-dialogue
```

**Test get-music.cjs:**
```bash
AI_API_KEY="your-key" node server/scripts/get-context/get-music.cjs \
  .cache/videos/test-video.mp4 \
  output/test-music
```

**Test video-chunks.cjs:**
```bash
AI_API_KEY="your-key" node server/scripts/process/video-chunks.cjs \
  .cache/videos/test-video.mp4 \
  output/test-chunks
```

**Test evaluation.cjs:**
```bash
# Requires artifacts from previous phases
node server/scripts/report/evaluation.cjs output/test-report
```

## Mock Data (No API Key Required)

For unit testing without calling real APIs, use mock data:

**Location:** `test/fixtures/mock-artifacts.json`

```json
{
  "dialogueData": {
    "dialogue_segments": [
      {
        "start": 0.5,
        "end": 3.2,
        "speaker": "Speaker 1",
        "text": "Hello, welcome to our product demo.",
        "confidence": 0.95
      }
    ],
    "summary": "Product demonstration with clear speech",
    "totalDuration": 30.0
  },
  "musicData": {
    "segments": [
      {
        "start": 0,
        "end": 30,
        "type": "music",
        "description": "Upbeat background music",
        "mood": "energetic",
        "intensity": 6
      }
    ],
    "summary": "Upbeat background music throughout",
    "hasMusic": true
  },
  "chunkAnalysis": {
    "chunks": [
      {
        "chunkIndex": 0,
        "startTime": 0,
        "endTime": 8,
        "summary": "Opening scene with product introduction",
        "emotions": {
          "patience": { "score": 7, "reasoning": "Clear and concise intro" },
          "boredom": { "score": 3, "reasoning": "Engaging visuals" },
          "excitement": { "score": 6, "reasoning": "Upbeat music builds interest" }
        },
        "dominant_emotion": "patience",
        "tokens": 450
      }
    ],
    "totalTokens": 450,
    "videoDuration": 30
  }
}
```

## Troubleshooting

### No Test Video Available

If you don't have a test video, the scripts will fail with ffmpeg errors. Solutions:

1. **Create a minimal test video** (see above)
2. **Use a placeholder video** from online sources
3. **Test with mock data only** (unit tests)

### API Key Issues

If AI_API_KEY is not set:
- Scripts will throw errors when trying to call AI provider
- Use mock AI provider in tests (see `test/scripts/*.test.js`)

### ffmpeg Not Installed

**Note:** FFmpeg is now automatically installed via the `ffmpeg-static` package when you run `pnpm install` or `npm install`. Manual installation is not required!

If you need ffmpeg for other purposes:
```bash
# Ubuntu/Debian
sudo apt-get install ffmpeg

# macOS
brew install ffmpeg

# Windows (via Chocolatey)
choco install ffmpeg
```

## Expected Output

After running the full pipeline, you should see:

```
output/full-analysis/
├── FINAL-REPORT.md          # Main evaluation report
├── analysis-data.json       # Raw JSON data
├── dialogue-data.json       # Dialogue transcription
├── music-data.json          # Music analysis
├── chunk-analysis.json      # Chunk-by-chunk analysis
└── per-second-data.json     # Per-second emotion data
```

The `FINAL-REPORT.md` should contain:
- Executive summary with recommendation
- Key metrics table (average scores per emotion)
- Chunk-by-chunk breakdown
- Dialogue summary
- Music/audio summary
- Technical details

---

*Last updated: 2026-03-04*
