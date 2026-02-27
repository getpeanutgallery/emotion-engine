# Testing Frame Extraction — Call of Duty Trailer

## Quick Setup

### Step 1: Install Prerequisites

You need **yt-dlp** installed to download YouTube videos:

```bash
# macOS
brew install yt-dlp

# Linux
pip3 install yt-dlp

# Windows (via pip)
pip install yt-dlp
```

### Step 2: Download & Test

Run the dev proxy server:

```bash
cd /home/derrick/Documents/GitHub/OpenTruth/emotion-engine

# Download the CoD trailer and start the test server
node dev-proxy.cjs "https://youtu.be/9txkGBj_trg"
```

This will:
1. Download the video to `.dev-cache/9txkGBj_trg.mp4`
2. Start a server at http://localhost:8080
3. Serve the video at http://localhost:8080/test-video

### Step 3: Open the Test Page

```bash
open http://localhost:8080/test-slicer.html
```

## What You'll See

1. **Video Uploader** — Drag-drop area for files
2. **Processing Status** — FFmpeg extraction progress
3. **Results Section** — Appears after extraction completes showing:
   - Total frames extracted
   - Video duration
   - Extraction interval (2s)
   - Average frame size
   - Grid of extracted frames with timestamps

## Expected Output

For the Call of Duty trailer (~2-3 minutes), you should see:
- **~60-90 frames** (one every 2 seconds)
- **480px width** frames (downscaled for performance)
- **JPEG format** (compressed for smaller payload)
- **Base64 encoded** (ready for API transmission)

## If You Don't Have yt-dlp

### Option A: Manual Download
Use any YouTube downloader (4K Video Downloader, etc.) and save as `test-video.mp4` in the project folder, then:

```bash
python3 -m http.server 8080
```

Drag the file into the test page.

### Option B: Use a Different Video
Any local MP4/WebM file works. Just drag it into the upload area.

## Troubleshooting

### "FFmpeg not loaded" Error
- Check browser console for CDN loading issues
- The inline Web Worker might fail in some browsers
- Try Chrome or Edge (best WebAssembly support)

### Video Too Large
The slicer has a 100MB limit. For larger videos:
- Download at lower resolution (720p or less)
- Use a shorter clip

### Frames Look Wrong
- Check that video is actually being decoded
- Look at Debug Log section for FFmpeg output
- Frame interval is hardcoded to 2 seconds

## Next Steps

Once frame extraction works:
1. ✅ Week 1 deliverable complete
2. Next: Lambda API integration (Week 3-4)
3. Test persona evaluation on these frames

## Test Checklist

- [ ] Video downloads successfully via dev-proxy.js
- [ ] test-slicer.html loads without errors
- [ ] Frames extract and display in grid
- [ ] Base64 data is valid (can copy/paste into decoder)
- [ ] Progress bar updates during extraction
- [ ] No console errors during processing
