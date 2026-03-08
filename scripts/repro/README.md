# Repro scripts

This folder contains **small, runnable reproduction scripts** for provider or integration issues.

These are intentionally minimal and may:

- require local `.env` (API keys)
- make live network calls
- record **digital-twin cassettes** when `DIGITAL_TWIN_MODE=record`

## OpenRouter transcription 404 repro

### `repro-openrouter-transcription-404.cjs`

Exercises the emotion-engine `get-dialogue` path using the OpenRouter provider and records a **failed** request (e.g. HTTP 404) into a cassette.

Required env vars:

- `DIGITAL_TWIN_MODE=record`
- `DIGITAL_TWIN_PACK=/absolute/or/relative/path/to/digital-twin-pack`
- `DIGITAL_TWIN_CASSETTE=<cassette-id>`
- `AI_API_KEY` (or `OPENROUTER_API_KEY`)
- `ASSET_PATH=/path/to/audio.wav` (optional; defaults to `/tmp/openrouter-transcription-404.wav`)
- `OUTPUT_DIR=/path/to/output/dir` (optional)
- `DIALOGUE_MODEL=openai/whisper-large` (optional)

Run:

```bash
node scripts/repro/repro-openrouter-transcription-404.cjs
```

### `repro-openrouter-transcriptions-endpoint-404.cjs`

Directly calls the OpenRouter `/audio/transcriptions` endpoint and records the response (including non-2xx) into a cassette.

Required env vars:

- `DIGITAL_TWIN_MODE=record`
- `DIGITAL_TWIN_PACK=...`
- `OPENROUTER_API_KEY` (or `AI_API_KEY`)

Run:

```bash
node scripts/repro/repro-openrouter-transcriptions-endpoint-404.cjs
```
