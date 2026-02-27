# OpenTruth Emotion Engine — Prototype

> **Status:** Week 1 (Frame Extraction)  
> **Goal:** Validate AI emotional analysis of video content  
> **Stack:** Vanilla JS + Web Components + AWS Lambda

## Quick Start

### Testing the Frame Slicer (Week 1 Deliverable)

**With YouTube Video (Call of Duty Trailer):**
```bash
cd /home/derrick/Documents/GitHub/OpenTruth/emotion-engine

# Download and serve the YouTube video locally
# Prerequisites: Node.js + yt-dlp installed
node dev-proxy.cjs "https://youtu.be/9txkGBj_trg"

# This will:
# 1. Download the CoD trailer
# 2. Start a local server at http://localhost:8080
# 3. Serve the video at http://localhost:8080/test-video
```

**With Local Video File:**
```bash
cd /home/derrick/Documents/GitHub/OpenTruth/emotion-engine
python3 -m http.server 8080

# Open http://localhost:8080/test-slicer.html
# Drag any MP4/WebM file into the upload area
```

### Full Application
```bash
cd /home/derrick/Documents/GitHub/OpenTruth/emotion-engine
python3 -m http.server 8080
open http://localhost:8080
```

## Architecture

### Frontend (Vanilla JS + Web Components)
- **app-shell** — Root orchestrator, manages global state
- **video-uploader** — Drag-drop + URL input
- **ffmpeg-slicer** — Client-side frame extraction (every 2s)
- **emotion-config** — Persona selection (MVP: hardcoded)
- **radar-chart** — 5-axis visualization (Canvas API)
- **friction-timeline** — Time-series graphs
- **council-report** — AI recommendations
- **wallet-manager** — Stripe pre-paid credits

### Backend (AWS Lambda)
- `/v1/process` — Frame evaluation via OpenRouter (Kimi-2.5 Vision)
- `/v1/personas/:id` — Persona definitions
- `/v1/sessions/:id` — Session results
- `/v1/health` — Health check

### Key Tech
- `ffmpeg.wasm` — Browser-side video slicing (zero compute cost)
- Web Workers — Non-blocking frame extraction
- OpenRouter — Multi-model LLM routing
- DynamoDB — Session storage
- S3 — Ephemeral report artifacts

## MVP Persona

**Impatient Teenager** (`impatient-teenager`)
- Abandons if hook > 3 seconds
- Tracks: Patience, Boredom, Excitement
- Use case: Viral video pacing validation

## Frame Extraction

- **Interval:** 2 seconds (deterministic)
- **Output:** Base64 JPEG frames
- **Audio:** Optional per-frame snippets
- **Payload:** JSON with metadata → Lambda API

## Development

### Week 1-2: Slicer Foundation ✅
- [x] Project scaffold
- [x] Web Component structure
- [x] ffmpeg.wasm integration
- [ ] Frame extraction verification
- [ ] YouTube URL support

### Week 3-4: Emotion Engine
- [ ] Lambda handler
- [ ] OpenRouter integration
- [ ] Persona prompt engineering
- [ ] Results aggregation

### Week 5-6: Visualization
- [ ] Radar chart (Canvas)
- [ ] Timeline graphs
- [ ] Council report UI

### Week 7-8: Polish
- [ ] Stripe wallet
- [ ] Freemium gating
- [ ] Error handling

## License

MIT — Gambit Games LLC
