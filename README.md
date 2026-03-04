# OpenTruth Emotion Engine

> **Version:** 0.3.0 (Hardened)  
> **Status:** Production Ready ✅  
> **Mission:** Replace 50,000 USD focus groups with 0.15 USD AI swarms

The Emotion Engine is a serverless, multi-modal AI platform that evaluates video content against synthetic demographic personas to measure emotional impact and predict audience engagement—before you spend a dollar on ad spend or human testing.

---

## ⚡ Quick Start

### 1. Install Dependencies

```bash
# Node.js 18+ required
node --version

# FFmpeg required (for video processing)
ffmpeg -version
```

### 2. Configure API Key

```bash
# Copy the template
cp .env.example .env

# Edit .env and add your OpenRouter API key
nano .env  # or use your preferred editor

# Required: Replace this line with your actual key
OPENROUTER_API_KEY=sk-or-your-actual-key-here
```

**Get your API key:** https://openrouter.ai/keys

### 3. Run the Pipeline

```bash
# Full pipeline (recommended)
node server/run-pipeline.cjs path/to/video.mp4 output/my-test

# Example with test video
node server/run-pipeline.cjs .cache/videos/cod.mp4 output/cod-test
```

### 4. View Results

```bash
# Start local server
python3 -m http.server 8080

# Open final report in browser
open http://localhost:8080/output/cod-test/FINAL-REPORT.md

# Or view JSON data
cat output/cod-test/03-chunked-analysis.json | jq .
```

---

## 🔐 Environment Setup

### Required: Configure Your .env File

The Emotion Engine uses `dotenv` to automatically load environment variables from a `.env` file at runtime. **You must create this file before running the pipeline.**

**Setup Steps:**

1. **Copy the example template:**
   ```bash
   cp .env.example .env
   ```

2. **Edit the `.env` file:**
   ```bash
   nano .env  # or use your preferred editor (vim, code, etc.)
   ```

3. **Add your OpenRouter API key:**
   ```bash
   # Replace this line with your actual key
   OPENROUTER_API_KEY=sk-or-your-actual-key-here
   ```

4. **Save and close the file.**

**Get your API key:** https://openrouter.ai/keys

**Important:**
- The `.env` file is **gitignored** and will never be committed to version control
- Never share your `.env` file or commit it to Git
- The `dotenv` package automatically loads these variables when the pipeline runs
- All other configuration options in `.env.example` have sensible defaults and are optional

---

## 🔧 Configuration

### Environment Variables (.env)

See the **Environment Setup** section above for setup instructions. The `.env` file is automatically loaded by `dotenv` when the pipeline runs.

**Required:**

| Variable | Description | Example |
|----------|-------------|---------|
| `OPENROUTER_API_KEY` | Your OpenRouter API key | `sk-or-...` |

**Optional (with defaults):**

| Variable | Default | Description |
|----------|---------|-------------|
| `SOUL_ID` | `impatient-teenager` | Persona to use |
| `SOUL_VERSION` | `latest` | Persona version: `latest`, `1`, `1.0`, `1.0.0` |
| `GOAL_ID` | `video-ad-evaluation` | Evaluation goal |
| `GOAL_VERSION` | `1.0` | Goal version |
| `TOOL_ID` | `emotion-tracking` | Tools config |
| `TOOL_VERSION` | `latest` | Tools version |
| `CHUNK_QUALITY` | `medium` | Quality preset: `low`, `medium`, `high` |
| `API_REQUEST_DELAY` | `1000` | Delay between API calls (ms) |
| `API_MAX_RETRIES` | `3` | Max retry attempts on failure |
| `LOG_LEVEL` | `info` | Log level: `debug`, `info`, `warn`, `error` |
| `LOG_FILE` | *(none)* | Optional: Path to log file |

### Quality Presets

| Preset | Chunk Duration | Target Size | Best For |
|--------|----------------|-------------|----------|
| `low` | 4 seconds | 4 MB | Quick tests, slow connections |
| `medium` | 8 seconds | 8 MB | **Default** - balanced quality/speed |
| `high` | 12 seconds | 9 MB | Final runs, maximum detail |

**Change quality:**
```bash
export CHUNK_QUALITY=high
node server/run-pipeline.cjs video.mp4 output/high-quality-test
```

---

## 🧪 Testing & Debugging

### Test the Full Pipeline

```bash
# 1. Clean output directory
rm -rf output/test-*

# 2. Set debug logging
export LOG_LEVEL=debug

# 3. Run with small test video (recommended for first run)
ffmpeg -i .cache/videos/cod.mp4 -t 30 -c copy output/test-30s.mp4
node server/run-pipeline.cjs output/test-30s.mp4 output/test-30s

# Expected: ~5 minutes for 30s video (~4 chunks)
```

### Test Individual Steps

```bash
# Step 1: Extract dialogue
node server/01-extract-dialogue.cjs video.mp4 output/test
# Output: output/test/01-dialogue-analysis.md

# Step 2: Extract music
node server/02-extract-music.cjs video.mp4 output/test
# Output: output/test/02-music-analysis.md

# Step 3: Analyze chunks (with context from steps 1-2)
node server/03-analyze-chunks.cjs video.mp4 output/test
# Output: output/test/03-chunked-analysis.json

# Step 4: Per-second timeline
node server/04-per-second-emotions.cjs video.mp4 output/test
# Output: output/test/04-per-second-emotions.json + .csv

# Generate final report
node server/generate-report.cjs output/test
# Output: output/test/FINAL-REPORT.md
```

### Verify Output Files

```bash
# Check all files exist and are valid
for f in 01-dialogue-analysis.md 02-music-analysis.md 03-chunked-analysis.json 04-per-second-emotions.json FINAL-REPORT.md; do
    if [ -s output/test/$f ]; then
        echo "✅ $f ($(wc -c < output/test/$f) bytes)"
    else
        echo "❌ $f missing or empty"
    fi
done

# Validate JSON files
jq . output/test/03-chunked-analysis.json > /dev/null && echo "✅ 03-chunked-analysis.json is valid JSON"
jq . output/test/04-per-second-emotions.json > /dev/null && echo "✅ 04-per-second-emotions.json is valid JSON"

# Check chunk count
echo "Chunks analyzed: $(jq '.chunks | length' output/test/03-chunked-analysis.json)"
echo "Seconds analyzed: $(jq '.per_second_data | length' output/test/04-per-second-emotions.json)"
```

### Debug Common Issues

#### API Key Errors
```bash
# Check if API key is set
echo $OPENROUTER_API_KEY

# Should start with "sk-or-"
# If empty or wrong, edit .env and re-source:
source .env
```

#### FFmpeg Errors
```bash
# Check FFmpeg installation
ffmpeg -version
ffprobe -version

# Install on Ubuntu/Debian:
sudo apt-get install ffmpeg

# Install on macOS:
brew install ffmpeg
```

#### Out of Memory / Large Chunks
```bash
# Use lower quality preset
export CHUNK_QUALITY=low
node server/run-pipeline.cjs video.mp4 output/low-quality-test

# Or reduce max chunk size
export CHUNK_MAX_SIZE=4194304  # 4MB instead of 8MB
```

#### API Rate Limiting
```bash
# Increase delay between requests
export API_REQUEST_DELAY=2000  # 2 seconds instead of 1

# Or reduce retries
export API_MAX_RETRIES=2
```

#### Enable Detailed Logging
```bash
# Debug mode (verbose output)
export LOG_LEVEL=debug
export LOG_FILE=output/debug.log

node server/run-pipeline.cjs video.mp4 output/test

# View logs
cat output/debug.log | grep -E "ERROR|WARN" | tail -20
```

#### Test from Different Directory
```bash
# Scripts use absolute paths - test from anywhere
cd /tmp
node /home/derrick/Documents/workspace/projects/opentruth/emotion-engine/server/run-pipeline.cjs \
    /home/derrick/Documents/workspace/projects/opentruth/emotion-engine/.cache/videos/cod.mp4 \
    /home/derrick/Documents/workspace/projects/opentruth/emotion-engine/output/test-from-tmp
```

---

## 📁 Output Files

After a successful run, `output/<session-name>/` contains:

| File | Description | Size |
|------|-------------|------|
| `01-dialogue-analysis.md` | Transcribed dialogue with timestamps, speakers, emotions | ~10-50 KB |
| `02-music-analysis.md` | Music/SFX analysis with mood, tempo, instruments | ~10-50 KB |
| `03-chunked-analysis.json` | Per-chunk persona analysis with emotional scores | ~100 KB - 1 MB |
| `04-per-second-emotions.json` | Per-second emotion timeline (JSON) | ~50-200 KB |
| `04-per-second-emotions.csv` | Per-second emotion timeline (CSV for Excel) | ~10-50 KB |
| `FINAL-REPORT.md` | **Human-readable summary with recommendations** | ~20-100 KB |

---

## 🏗️ Architecture

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
│  ffmpeg → chunks (<10MB) + dialogue + music + memory → Qwen        │
│  Output: chunked-analysis.json                                      │
└─────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────┐
│  Step 4: Per-Second Timeline                                        │
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

---

## 🎭 Persona System

The Emotion Engine uses a **composable persona system** with three file types:

| File Type | Location | Purpose | Example |
|-----------|----------|---------|---------|
| **SOUL.md** | `/personas/souls/<id>/<semver>/` | "Who" - persona identity, demographics, voice | `impatient-teenager/1.0.0` |
| **GOAL.md** | `/personas/goals/<id>/<semver>/` | "What" - evaluation objective, success criteria | `video-ad-evaluation/1.0.0` |
| **TOOLS.md** | `/personas/tools/<id>/<semver>/` | "How" - emotional lenses, JSON schemas, prompts | `emotion-tracking/1.0.0` |

### Versioning (SemVer)

All persona configs use **Semantic Versioning** (`Major.Minor.Patch`):

- **Major** (`1.0.0` → `2.0.0`): Breaking changes (schema, identity, behavior)
- **Minor** (`1.0.0` → `1.1.0`): Non-breaking additions (new lenses, traits)
- **Patch** (`1.0.0` → `1.0.1`): Typos, clarifications

**Version resolution:**
- `latest` → Highest available version
- `1` → Latest `1.x.x`
- `1.0` → Latest `1.0.x`
- `1.0.0` → Exact match

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

### Using Custom Personas

```bash
# Use default persona
node server/run-pipeline.cjs video.mp4 output/test1

# Override persona via environment variables
export SOUL_ID=skeptical-cfo
export GOAL_ID=video-ad-evaluation
export SOUL_VERSION=1      # Use latest 1.x.x
export GOAL_VERSION=1.0    # Use latest 1.0.x
export TOOLS_VERSION=latest # Use highest available
export SELECTED_LENSES=patience,boredom,excitement,roi-confidence
node server/run-pipeline.cjs video.mp4 output/test2
```

---

## 💰 Cost Analysis

| Test | Duration | Chunks | Est. Cost | Time |
|------|----------|--------|-----------|------|
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

## 🚀 Roadmap

### Phase 1: Core Validation (Weeks 1-4) ✅
- [x] Dialogue extraction pipeline
- [x] Music/audio extraction pipeline
- [x] Context-aware chunked analysis
- [x] Per-second emotion timeline
- [x] Report generation
- [x] Web Components scaffolded
- [x] **Hardening: Retry logic, error handling, validation**
- [x] **Hardening: Quality presets, chunk compression**
- [x] **Hardening: Progress indicators, logging**
- [ ] Lambda deployment

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

## 🛠️ Development

### Project Structure

```
emotion-engine/
├── .env                        # Your config (gitignored)
├── .env.example                # Template (commit-safe)
├── .gitignore                  # Git ignore rules
├── index.html                  # Main entry point (browser UI)
├── index.js                    # App bootstrap
├── server/                     # Server-side pipeline + Lambda
│   ├── 01-extract-dialogue.cjs     # Step 1: Dialogue extraction
│   ├── 02-extract-music.cjs        # Step 2: Music/audio extraction
│   ├── 03-analyze-chunks.cjs       # Step 3: Chunked analysis
│   ├── 04-per-second-emotions.cjs  # Step 4: Timeline generation
│   ├── run-pipeline.cjs            # Orchestrator: runs 01→02→03→04
│   ├── generate-report.cjs         # Final report generator
│   ├── lib/                        # Shared utilities
│   │   ├── api-utils.cjs           # Retry logic, JSON validation
│   │   ├── models.cjs              # Model configuration + fallbacks
│   │   ├── persona-loader.cjs      # Loads SOUL/GOAL/TOOLS.md
│   │   ├── video-utils.cjs         # Chunk compression
│   │   └── logger.cjs              # Structured logging
│   ├── config/                     # Configuration files
│   │   └── models.json             # Default models + fallbacks
│   └── personas/                   # Persona definitions
│       ├── souls/                  # Persona identities
│       ├── goals/                  # Evaluation objectives
│       └── tools/                  # Response schemas
├── managers/                   # Browser singleton managers
│   ├── api-manager.js
│   ├── state-manager.js
│   └── ui-manager.js
├── components/                 # Web Components
│   ├── video-upload.js
│   ├── persona-selector.js
│   ├── analysis-progress.js
│   ├── radar-chart.js
│   ├── emotion-timeline.js
│   ├── friction-index.js
│   └── recommendations.js
├── css/                        # Styles
├── output/                     # Generated results (gitignored)
│   └── <session-name>/         # Per-analysis outputs
├── .cache/                     # Temporary cache (gitignored)
│   └── videos/                 # Test videos
└── docs/                       # Documentation
```

### Running Tests

```bash
# Syntax check all scripts
for f in server/*.cjs; do
    node --check $f && echo "✅ $(basename $f)"
done

# Test persona loader
node -e "const loader = require('./server/lib/persona-loader.cjs'); const config = loader.loadPersonaConfig('impatient-teenager', 'video-ad-evaluation'); console.log(config ? '✅ Persona loads' : '❌ Failed')"

# Test API utils
node -e "const utils = require('./server/lib/api-utils.cjs'); console.log('✅ API utils loaded')"

# Test models config
node -e "const models = require('./server/lib/models.cjs'); console.log('✅ Models loaded:', models.getDefaults())"

# Test video utils
node -e "const video = require('./server/lib/video-utils.cjs'); console.log('✅ Video utils loaded')"

# Test logger
node -e "const logger = require('./server/lib/logger.cjs'); logger.info('Test message'); console.log('✅ Logger loaded')"
```

---

## 📄 License

MIT — Gambit Games LLC

---

## 🆘 Troubleshooting

### "OPENROUTER_API_KEY not set"
```bash
# Check if .env exists
ls -la .env

# Check if key is set
grep OPENROUTER_API_KEY .env

# Should NOT be "sk-or-your-actual-key-here"
# If .env doesn't exist, create it:
cp .env.example .env
nano .env  # Add your real OPENROUTER_API_KEY
```

### "FFmpeg not found"
```bash
# Check installation
which ffmpeg

# Install if missing
sudo apt-get install ffmpeg  # Ubuntu/Debian
brew install ffmpeg          # macOS
```

### "Chunk too large, compression failed"
```bash
# Use lower quality preset
export CHUNK_QUALITY=low
node server/run-pipeline.cjs video.mp4 output/test

# Or reduce max chunk size
export CHUNK_MAX_SIZE=4194304  # 4MB
```

### "API rate limited (429)"
```bash
# Increase delay between requests
export API_REQUEST_DELAY=3000  # 3 seconds
export API_MAX_RETRIES=5       # More retries
```

### "JSON parse error"
```bash
# Enable debug logging to see raw response
export LOG_LEVEL=debug
export LOG_FILE=output/debug.log

# Re-run and check logs
cat output/debug.log | grep -A5 "JSON parse error"
```

### "Persona not found"
```bash
# Check persona files exist
ls -la personas/souls/impatient-teenager/

# Should show version folders (e.g., 1.0.0/)
# If missing, restore from git or re-download
```

---

*Last updated: 2026-03-03 - Hardening complete (v0.3.0)*
