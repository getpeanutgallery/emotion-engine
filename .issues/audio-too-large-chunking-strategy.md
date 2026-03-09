# Add strategy for audio inputs exceeding provider file-size limits (10MB)

## Context
Phase 1 dialogue/music extraction sends audio (16kHz mono WAV base64) to OpenRouter audio-capable models.

We currently rely on `tool_variables.file_transfer.maxFileSize` (~10MB) and implicitly assume users won’t provide longer/larger audio.

## Problem / symptoms
If the input audio is longer than the size cap (or if WAV encoding inflates size), we risk:
- hard failures (provider rejects request / payload too large)
- partial/incorrect results if we truncate silently upstream
- inconsistent behavior across providers/models

This is a core reliability issue: the pipeline should degrade gracefully and remain correct for long inputs.

## Root cause
- WAV is large (uncompressed). At ~32KB/s (16kHz mono PCM), 10MB only covers ~5.4 minutes.
- Current pipeline doesn’t implement a canonical “long audio” strategy (compress / chunk / summarize / hierarchical merge).

## Proposed fix (design)
Introduce an explicit long-audio strategy in Phase 1 (dialogue + music):

1) **Preflight sizing**
- Compute duration + estimated encoded size before calling the model.
- Decide path based on provider/model limits and configured max.

2) **Preferred: compress then send**
- Convert WAV → compressed format (e.g. MP3/Opus) when supported by provider/model.
- Keep sample rate consistent.

3) **Chunking fallback (always available)**
- Split audio into time-based chunks (e.g., 30–60s for dialogue diarization, 15–30s for music), with overlap.
- Run model per chunk.
- Merge results deterministically:
  - speaker identity merge (heuristics)
  - dedupe overlapping segments
  - stable ordering by timestamp

4) **Hierarchical summarization (for very long audio)**
- Chunk → extract structured events → reduce into global summary.

5) **Config surface**
Add YAML config knobs under something like:
- `audio.maxUploadBytes`
- `audio.chunkSeconds`, `audio.chunkOverlapSeconds`
- `audio.compression.codec`

## Acceptance criteria
- Inputs longer than the provider limit do not crash the pipeline; the pipeline chooses a chunk/compress path.
- Dialogue/music outputs remain structurally valid and semantically correct (no missing segments due solely to size).
- Determinism: replay runs are stable given the same cassette.
- Tests cover: short audio (single request), long audio (multi-chunk merge), and limit-triggered behavior.
