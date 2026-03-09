# OpenRouter + `openai/gpt-audio-mini` returns "No content in response" (Phase 1 dialogue/music)

## Context
We attempted to set `configs/cod-test.yaml`:
- `ai.dialogue.model: openai/gpt-audio-mini`
- `ai.music.model: openai/gpt-audio-mini`

Then ran `DIGITAL_TWIN_MODE=record` to create a new golden cassette.

## Symptom
The record run fails during Phase 1 dialogue transcription with:
- `OpenRouter: No content in response`

The failure occurs before a cassette is created, so we cannot replay.

A raw error artifact was written:
- `output/<run>/phase1-gather-context/raw/ai/dialogue-transcription.error.json`

Stack trace indicates the error is thrown in:
- `node_modules/ai-providers/providers/openrouter.cjs` in `transformResponse()`

## Likely root cause
`ai-providers` OpenRouter response parsing likely assumes:
- `choices[0].message.content` is a non-empty string

But for some models (esp. audio/multimodal), `message.content` may be:
- an array of content parts (e.g. `{type:'text', text:'...'}`)
- empty while transcript lives elsewhere (e.g. `message.audio.transcript`)
- otherwise structured differently

So the provider returns a valid response, but our parser drops it and throws.

## Proposed fix
1) Improve OpenRouter response parsing:
- Support `message.content` as either string or array-of-parts.
- If audio transcript fields exist, use them as fallback.
2) When throwing "No content", capture the raw HTTP/body payload to a debug artifact so this is diagnosable.
3) Add a minimal unit/integration test for `openai/gpt-audio-mini` response shape handling.

## Acceptance criteria
- Running `cod-test` record with `openai/gpt-audio-mini` succeeds through Phase 1.
- `response.content` delivered to scripts is a usable string.
- A golden cassette can be recorded and replayed.
