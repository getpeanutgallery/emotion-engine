# Audio LLM Integration Notes

## OpenRouter Audio Model — Working Configuration

**Model ID**: `openai/gpt-audio`  
**Source**: OpenRouter SDK documentation

### Working Code Snippet

```javascript
import { OpenRouter } from "@openrouter/sdk";

const openrouter = new OpenRouter({ 
    apiKey: "<OPENROUTER_API_KEY>" 
});

const stream = await openrouter.chat.send({
    model: "openai/gpt-audio",  // NOT gpt-4o-audio-preview
    messages: [
        {
            "role": "user",
            "content": [
                {
                    "type": "text",
                    "text": "What is in this audio?"
                },
                {
                    "type": "input_audio",
                    "input_audio": {
                        "data": "UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB",  // base64 audio
                        "format": "wav"  // or "mp3"
                    }
                }
            ]
        }
    ],
    stream: true
});

for await (const chunk of stream) {
    const content = chunk.choices[0]?.delta?.content;
    if (content) {
        process.stdout.write(content);
    }
}
```

## Key Differences from Previous Attempts

| Attempt | Model | Result |
|---------|-------|--------|
| ❌ Failed | `gpt-4o-audio-preview` | "No endpoints support input audio" |
| ✅ Should Work | `openai/gpt-audio` | Official OpenRouter SDK format |

## Audio Format

- **Format**: WAV or MP3 (base64 encoded)
- **Input type**: `input_audio` with nested `input_audio` object
- **Data field**: Base64 string of audio file
- **Format field**: `"wav"` or `"mp3"`

## Integration Path

1. Use existing extracted MP3 files from `audio-output/`
2. Convert to base64
3. Send with stateful vision context
4. Parse music/sound/dialogue understanding
5. Merge with vision results for complete multi-modal analysis

## Files Ready

- `audio-output/audio-XXXs.mp3` — 11 clips (3 seconds each)
- `stateful-output/frame-XXX.json` — Vision analysis with emotional state
- Ready to merge for unified multi-modal report

## Expected Output

Audio model should provide:
- Music genre/style identification
- Sound effect detection
- Dialogue/speech transcription
- Audio emotional tone
- How audio complements or contradicts visual content

## Next Steps

1. Update `test-audio-layer.cjs` to use correct model name
2. Adjust format to match SDK snippet
3. Run audio analysis on all 11 clips
4. Generate merged vision + audio final report

## Cost Estimation

- `openai/gpt-audio` pricing unknown but likely similar to GPT-4o
- Estimated: ~$0.005-0.01 per 3-second clip
- Total for 11 clips: ~$0.05-0.11

## Testing Checklist

- [ ] Update model name to `openai/gpt-audio`
- [ ] Verify base64 encoding works
- [ ] Test with one audio clip first
- [ ] Verify response format
- [ ] Integrate with vision context
- [ ] Generate final merged report
- [ ] Compare to ffmpeg-only version

---
**Status**: Audio files extracted, vision analysis complete, awaiting audio LLM integration
**Date**: 2026-02-26
**Blocked by**: Model name mismatch (now resolved)
