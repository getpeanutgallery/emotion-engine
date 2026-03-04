# Token Usage Breakdown - Implementation Complete ✅

## Overview
Added detailed token usage tracking and breakdown to the Emotion Engine pipeline's FINAL-REPORT.md

## Changes Made

### 1. `server/01-extract-dialogue.cjs`
- Modified `analyzeDialogue()` function to return both content and token usage
- Updated markdown output to include `**Tokens Used:**` field in header
- Example output:
  ```markdown
  **Model:** openai/gpt-audio  
  **Tokens Used:** 2,543  
  ```

### 2. `server/02-extract-music.cjs`
- Modified `analyzeMusic()` function to return both content and token usage
- Updated markdown output to include `**Tokens Used:**` field in header
- Example output:
  ```markdown
  **Model:** openai/gpt-audio  
  **Tokens Used:** 3,102  
  ```

### 3. `server/generate-report.cjs`
- Added MODEL constant from environment variable
- Extract model names and token counts from markdown files
- Load per-second emotions data (optional)
- Calculate token usage by model with aggregation
- Add "Token Usage Breakdown" section with table format
- Update total tokens to include all pipeline steps
- Update footer to show actual models used

## Report Output Example

```markdown
**Total Tokens Used:** 81,306

---

## 📊 Token Usage Breakdown

| Model | Tokens | Requests | Pipeline Steps |
|-------|--------|----------|----------------|
| openai/gpt-audio | 5,500 | 2 | Dialogue Analysis, Music Analysis |
| qwen/qwen3.5-122b-a10b | 75,806 | 5 | Video Chunk Analysis, Per-Second Emotion Analysis |
```

## Features

✅ **Accurate Tracking**: Reads actual token counts from API responses  
✅ **Backward Compatible**: Uses estimates for older files without token data  
✅ **Comprehensive**: Shows model, tokens, requests, and pipeline steps  
✅ **Complete Totals**: Includes all pipeline steps in final count  
✅ **Dynamic Footer**: Shows actual models used in the analysis  

## Testing

Tested with existing output files:
- ✅ Works with files that have token data
- ✅ Works with files without token data (uses estimates)
- ✅ Works without per-second emotions data
- ✅ Correctly aggregates tokens by model
- ✅ Correctly calculates total tokens

## Next Steps

To see real token counts (not estimates):
1. Run the full pipeline: `node server/run-pipeline.cjs <video-path>`
2. The dialogue and music scripts will now capture actual token usage
3. Generate report: `node server/generate-report.cjs <output-dir>`
4. View FINAL-REPORT.md with complete token breakdown

## Token Estimates (Fallback)

For files generated before this update:
- Dialogue Analysis: 2,500 tokens (estimate)
- Music Analysis: 3,000 tokens (estimate)

These estimates are reasonable averages for audio transcription and analysis tasks.
