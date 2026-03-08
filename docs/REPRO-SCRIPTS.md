# Repro scripts

This repo keeps runnable reproduction scripts in:

- `scripts/repro/`

These scripts are used to isolate provider / integration bugs (often related to OpenRouter + transcription) and, when applicable, to record **digital-twin cassettes**.

## Notes

- Repro scripts may load local `.env` for API keys.
- Prefer keeping ephemeral scratch work in a local `tmp/` folder (not committed). If you create `tmp/`, it should stay untracked.
