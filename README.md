# OpenTruth Emotion Engine

> **Version:** 0.2.0 (Alpha)  
> **Status:** Week 1-2 Complete ✅ | Pipeline Validated  
> **Mission:** Replace 50,000 USD focus groups with 0.15 USD AI swarms

The Emotion Engine is a serverless, multi-modal AI platform that evaluates video content against synthetic demographic personas to measure emotional impact and predict audience engagement—before you spend a dollar on ad spend or human testing.

---

## The Problem

AI can generate 50 video ad variations in an hour. But validating which one converts still costs **50,000 USD** and takes **a month** with traditional focus groups. Creation moves at the speed of compute. Validation still moves at the speed of humans.

---

## The Solution

Drop your MP4 or YouTube URL into the Emotion Engine. Our synthetic personas (like the **Impatient Teenager**) watch every frame and track emotional dimensions (Boredom, Excitement, Patience) second-by-second. You get a **Friction Index** and actionable recommendations in 15 seconds for **pennies**.

---

## Tech Stack

### Server-Side (Node.js)
- **Runtime:** Node.js 18+ (`.cjs` modules)
- **Video Processing:** `ffmpeg` (CLI)
- **AI Models:** OpenRouter API (`openai/gpt-audio`, `qwen/qwen3.5-122b-a10b`)
- **Deployment Target:** AWS Lambda + API Gateway
- **Database:** DynamoDB (pending)

### Client-Side (Browser)
- **Language:** Vanilla JavaScript with JSDOC type hints
- **UI Architecture:** Web Components (custom elements)
- **State Management:** Singleton managers
- **Build Tools:** None (prototype phase)
- **API Communication:** Native `fetch()`

**Why this stack?**
- Server-side pipeline scripts use Node.js native modules (`fs`, `child_process`, `ffmpeg`) that never run in the browser—no need to make them universal
- Browser is UI-only: displays results, calls API, no heavy lifting
- Web Components provide encapsulation without framework overhead
- JSDOC gives IDE autocomplete and type safety without TypeScript complexity
- Singletons for managers (API, State, UI) keep global scope clean and testable

---

## Quick Start

### Prerequisites

```bash
# Node.js 18+
node --version

# FFmpeg (for video processing)
ffmpeg -version

# OpenRouter API key (set in environment)
export OPENROUTER_API_KEY="your-key-here"
```

### Run Complete Pipeline (Recommended)

```bash
cd emotion-engine

# Run all steps in sequence (dialogue → music → chunks → timeline → report)
node server/run-pipeline.cjs path/to/video.mp4 output/<session-name>

# Generate final report
node server/generate-report.cjs output/<session-name>
```

### Run Individual Steps

```bash
# Step 1: Extract dialogue with timestamps
node server/01-extract-dialogue.cjs path/to/video.mp4 output/<session-name>

# Step 2: Extract music/audio analysis
node server/02-extract-music.cjs path/to/video.mp4 output/<session-name>

# Step 3: Analyze video chunks with context (8-second intervals)
node server/03-analyze-chunks.cjs path/to/video.mp4 output/<session-name>

# Step 4: Generate per-second emotion timeline
node server/04-per-second-emotions.cjs path/to/video.mp4 output/<session-name>
```

### View Results

```bash
# Start local server
python3 -m http.server 8080

# View final report
open http://localhost:8080/output/<session-name>/FINAL-REPORT.md

# Open web app
open http://localhost:8080/index.html
```

---

## Architecture

### Pipeline Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│  Step 1: Dialogue Extraction                                        │
│  ffmpeg → openai/gpt-audio → dialogue-analysis.md                   │
└─────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────┐
│  Step 2: Music/Audio Extraction                                     │
│  ffmpeg → openai/gpt-audio → music-analysis.md                      │
└─────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────┐
│  Step 3: Chunked Video Analysis (WITH CONTEXT)                      │
│  ffmpeg → 8s chunks (<10MB) + dialogue + music + memory → Qwen     │
│  Output: chunked-analysis.json                                      │
└─────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────┐
│  Step 4: Per-Second Timeline (Optional)                             │
│  Strict JSON output → per-second-emotions.json + .csv               │
└─────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────┐
│  Step 5: Final Report Generation                                    │
│  Merges all outputs → FINAL-REPORT.md                               │
└─────────────────────────────────────────────────────────────────────┘
```

### System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│  Browser (Vanilla JS + Web Components)                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                 │
│  │ VideoUpload │  │ RadarChart  │  │ Timeline    │                 │
│  │ Component   │  │ Component   │  │ Component   │                 │
│  └─────────────┘  └─────────────┘  └─────────────┘                 │
│         ↓                ↓                ↓                         │
│  ┌─────────────────────────────────────────────────┐               │
│  │           Singleton Managers                     │               │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────────┐  │               │
│  │  │ API mgr  │  │ State mgr│  │ UI mgr       │  │               │
│  │  └──────────┘  └──────────┘  └──────────────┘  │               │
│  └─────────────────────────────────────────────────┘               │
└─────────────────────────────────────────────────────────────────────┘
                                    ↓ fetch()
┌─────────────────────────────────────────────────────────────────────┐
│  AWS Lambda (Node.js .cjs)                                          │
│  ┌─────────────────────────────────────────────────┐               │
│  │  /v1/process  →  Runs pipeline, returns JSON    │               │
│  │  /v1/personas   →  Persona registry             │               │
│  │  /v1/sessions   →  DynamoDB storage             │               │
│  └─────────────────────────────────────────────────┘               │
└─────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Layer | Technology | Responsibility |
|-------|------------|----------------|
| **Dialogue Extraction** | `ffmpeg` + `openai/gpt-audio` | Extract speech, speakers, emotion |
| **Music Extraction** | `ffmpeg` + `openai/gpt-audio` | Analyze music, SFX, atmosphere |
| **Video Analysis** | `ffmpeg` + `qwen/qwen3.5-122b-a10b` | Chunked evaluation with context |
| **Context Memory** | Previous chunk summary | Emotional continuity across chunks |
| **Report Generation** | Node.js script | Merge outputs into markdown |
| **API Backend** | AWS Lambda (Node.js `.cjs`) | REST API, orchestration |
| **Database** | DynamoDB | Session storage (pending) |
| **Billing** | Stripe (planned) | Pre-paid wallet (pending) |
| **UI Components** | Web Components | Reusable, encapsulated UI |
| **State Management** | Singleton managers | Global state, API calls |

---

## Project Structure

```
emotion-engine/
├── index.html                      # Main entry point (served by AWS)
├── index.js                        # App bootstrap
├── .gitignore                      # Ignores output/, .cache/
├── server/                         # Server-side pipeline + Lambda
│   ├── 01-extract-dialogue.cjs     # Step 1: Dialogue extraction
│   ├── 02-extract-music.cjs        # Step 2: Music/audio extraction
│   ├── 03-analyze-chunks.cjs       # Step 3: Chunked analysis
│   ├── 04-per-second-emotions.cjs  # Step 4: Timeline generation
│   ├── run-pipeline.cjs            # Orchestrator: runs 01→02→03→04
│   ├── generate-report.cjs         # Final report generator
│   ├── lambda/                     # AWS Lambda deployment
│   │   ├── handler.cjs             # Lambda function
│   │   └── lib/                    # Lambda utilities
│   │       ├── openrouter.js       # API client
│   │       ├── openrouter-enhanced.cjs
│   │       └── store.js            # DynamoDB wrapper
│   └── personas/                   # Persona definitions
│       └── impatient-teenager.md
├── managers/                       # Singleton managers
│   ├── api-manager.js              # API calls + mock mode
│   ├── state-manager.js            # Global state + listeners
│   └── ui-manager.js               # UI coordination
├── components/                     # Web Components
│   ├── video-upload.js             # <video-upload>
│   ├── persona-selector.js         # <persona-selector>
│   ├── analysis-progress.js        # <analysis-progress>
│   ├── radar-chart.js              # <radar-chart>
│   ├── emotion-timeline.js         # <emotion-timeline>
│   ├── friction-index.js           # <friction-index>
│   └── recommendations.js          # <recommendations>
├── css/                            # Styles
│   ├── main.css
│   └── variables.css
├── output/                         # Generated results (gitignored)
│   └── <session-name>/             # Per-analysis outputs
│       ├── 01-dialogue-analysis.md
│       ├── 02-music-analysis.md
│       ├── 03-chunked-analysis.json
│       ├── 04-per-second-emotions.json
│       ├── 04-per-second-emotions.csv
│       └── FINAL-REPORT.md
├── .cache/                         # Temporary cache (gitignored)
│   └── videos/                     # Test videos
└── docs/                           # Documentation
    ├── PROJECT_SUMMARY.md
    ├── OPENROUTER_INTEGRATION.md
    ├── TEST_GUIDE.md
    └── WEEK1_SUMMARY.md
```

---

## Persona System

The Emotion Engine uses a **composable persona system** with three file types:

| File Type | Location | Purpose | Example |
|-----------|----------|---------|---------|
| **SOUL.md** | `/personas/souls/<id>/v1/` | "Who" - persona identity, demographics, voice | `impatient-teenager` |
| **GOAL.md** | `/personas/goals/<id>/v1/` | "What" - evaluation objective, success criteria | `video-ad-evaluation` |
| **TOOLS.md** | `/personas/tools/<id>/v1/` | "How" - emotional lenses, JSON schemas, prompts | `emotion-tracking` |

### Available Personas

#### Impatient Teenager (`impatient-teenager`)

**SOUL:** Alex Chen, 17, Gen Z digital native  
**Core Truth:** "I abandon content if the hook takes longer than 3 seconds."  
**Best For:** Testing viral video hooks, short-form ads, TikTok/Reels content

**Test Result (CoD Black Ops 7 Trailer):**
- **Patience:** 2/10 ❌ Annoyed
- **Boredom:** 8-9/10 ❌ Critical (would scroll at 0s)
- **Excitement:** 2-3/10 ❌ Disengaged
- **Verdict:** ❌ **WOULD SCROLL**

> *"0.0s and it's already a dark, cluttered mess with generic 'RISING TENSIONS' corporate buzzwords..."*

### Available Goals

| Goal ID | Purpose | Use Case |
|---------|---------|----------|
| `video-ad-evaluation` | Test ad retention & engagement | Most common |
| `software-qa-review` | Evaluate UX walkthroughs | Product demos |
| `accessibility-audit` | Check accessibility compliance | WCAG reviews |

### Available Emotional Lenses

**Core Lenses** (always available):
- Patience, Boredom, Excitement

**Extended Lenses** (optional, composable):
- Clarity, Trust, Frustration, Confusion, Overwhelm, Flow, Joy, Relief, Skepticism, Anxiety, Empowerment, Confidence, Cringe, ROI Confidence, Empathy

### Using Personas

```bash
# Use default persona (impatient-teenager + video-ad-evaluation)
node server/run-pipeline.cjs video.mp4 output/test1

# Override persona via environment variables
export SOUL_ID=skeptical-cfo
export GOAL_ID=video-ad-evaluation
export SELECTED_LENSES=patience,boredom,excitement,roi-confidence
node server/run-pipeline.cjs video.mp4 output/test2
```

### Creating Custom Personas

1. **Add a SOUL.md** in `/personas/souls/<your-persona>/v1/SOUL.md`
2. **Pick a GOAL.md** (or create custom in `/personas/goals/`)
3. **Select lenses** from TOOLS.md (or extend in `/personas/tools/`)

See existing personas for templates.

---

## Cost Analysis

| Test | Duration | Chunks | Cost | Time |
|------|----------|--------|------|------|
| Single chunk | 8s | 1 | ~0.01 USD | 15s |
| Quick test (3 chunks) | 24s | 3 | ~0.03 USD | 45s |
| Full 30s | 30s | 4 | ~0.04 USD | 4 min |
| Full video (70 chunks) | ~9min | 70 | ~0.70 USD | 18 min |

**Model Comparison (per 1M tokens):**
- **Qwen 3.5 122B:** ~0.50/2.00 USD — ✅ Recommended (best value)
- Kimi K2.5 Vision: ~0.50/2.00 USD — Good for single-frame analysis
- GPT-4o: 2.50/10.00 USD — 5x cost, 3x faster
- Claude 3.5: 3.00/15.00 USD — Best reasoning, 7.5x cost

---

## Roadmap

### Phase 1: Core Validation (Weeks 1-4) ✅
- [x] Dialogue extraction pipeline
- [x] Music/audio extraction pipeline
- [x] Context-aware chunked analysis
- [x] Per-second emotion timeline
- [x] Report generation
- [x] Web Components scaffolded
- [ ] Lambda deployment
- [ ] Persona system expansion

### Phase 2: Production Ready (Weeks 5-8)
- [ ] DynamoDB session storage
- [ ] Stripe pre-paid wallet
- [ ] Freemium queue system
- [ ] 5+ personas
- [ ] 15 emotional lenses
- [ ] Financial circuit breakers

### Phase 3: Scale & Swarm (Weeks 9-12)
- [ ] Emotion batching (parallel processing)
- [ ] Priority swarm concurrency
- [ ] Resolution Council (4-model debate)
- [ ] Community Persona Hub
- [ ] Multi-tenant architecture

---

## Development Guidelines

### Server-Side Scripts (`.cjs`)

```javascript
/**
 * @fileoverview Step 1: Extract dialogue from video
 * @author OpenTruth Team
 */

const fs = require('fs');
const path = require('path');

/**
 * Extract audio from video file
 * @param {string} videoPath - Path to input video
 * @param {string} outputPath - Path for output audio
 * @returns {Promise<void>}
 */
async function extractAudio(videoPath, outputPath) {
    // Implementation
}
```

### Browser Web Components

```javascript
/**
 * @fileoverview Video upload web component
 * @author OpenTruth Team
 */

/**
 * @typedef {Object} UploadResult
 * @property {string} sessionId
 * @property {number} duration
 * @property {string} status
 */

class VideoUploadComponent extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
    }

    /**
     * Handle file selection
     * @param {File} file - Selected video file
     * @returns {Promise<UploadResult>}
     */
    async handleUpload(file) {
        // Implementation
    }
}

customElements.define('video-upload', VideoUploadComponent);
```

### Singleton Managers

```javascript
/**
 * @fileoverview API Manager Singleton
 * @author OpenTruth Team
 */

class APIManager {
    static #instance = null;

    constructor() {
        if (APIManager.#instance) {
            return APIManager.#instance;
        }
        this.baseUrl = '/api/v1';
        APIManager.#instance = this;
    }

    /**
     * Make authenticated API call
     * @param {string} endpoint - API endpoint
     * @param {RequestInit} options - Fetch options
     * @returns {Promise<any>}
     */
    async call(endpoint, options = {}) {
        // Implementation
    }
}

// Usage: const api = new APIManager();
```

---

## Contributing

This is the open-source core of the OpenTruth validation platform. See the [OpenTruth Pitch](../gambit-games-truth-pitch.md) for the full vision.

**To contribute:**
1. Add new personas to `/server/personas/`
2. Improve emotional lens prompts
3. Optimize chunk extraction performance
4. Build Web Components for UI

---

## License

MIT — Gambit Games LLC

---

*Last updated: 2026-03-03*
