# emotion-engine: audio-too-large chunking strategy (Phase1)

**Date:** 2026-03-09  
**Status:** In Progress (approved for execution)  
**Agent:** Cookie 🍪

---

## Goal

Implement a robust strategy for Phase1 audio inputs that would exceed the provider **Base64 payload** limit (≈10MB) so `cod-test` and real runs don’t fail or silently degrade.

This should cover dialogue + music context extraction paths.

---

## Non-Goals (for now)

- Perfect diarization/speaker separation improvements beyond what the model already provides.
- Golden recording (explicitly deferred until all issues are addressed).

---

## Design Overview

We’ll implement an **audio ingestion pipeline that mirrors the video strategy** (time chunking + sequential processing + “rolling context”), and we will **not** rely on silence detection.

### Core principles
- **Chunk first** when the audio payload would exceed provider limits.
- Use the **same mental model as Phase2 video**: chunk → analyze each chunk → pass forward rolling context → do a final consolidation pass.
- **OpenRouter-only for now**: all AI calls (chunk analysis + stitcher) use `adapter.name: openrouter` with model fallbacks.
- Avoid silent quality degradation: no “bitrate-crank compression” strategy.

### Key constraint: size measured as Base64 payload
Provider limits typically hit at the **encoded payload** level, so the trigger should be:
- If `base64(audioBytes).length` would exceed ~10MB (or configured limit), then chunk.

(Implementation detail: Base64 expands by ~4/3; we can estimate encoded size from raw bytes without actually encoding.)

### Pipeline

1) **Preflight (budgeting)**
   - Determine audio file size + duration.
   - Estimate bytes/sec and compute a safe **chunk duration** that will keep the **Base64 payload** under the provider limit with margin.

2) **Chunking (default for >limit)**
   - Split audio into time-based chunks sized to fit the Base64 budget.
   - Deterministic chunk filenames + stable ordering.

3) **Sequential processing with rolling context (music AND dialogue)**
   - **Music/context:** per-chunk context extraction; each chunk prompt includes the prior chunk’s summary (rolling context), same pattern as our video persona-style analysis.
   - **Dialogue:** per-chunk transcription + per-chunk “handoff context” (brief summary of last utterances / entities / speaker labels). Next chunk receives that context so the model can bridge across boundaries.

4) **Merge strategy (LLM-assisted stitching; REQUIRED)**
   - First produce a mechanical stitched transcript (concatenate chunk transcripts with timestamps and chunk boundaries).
   - Then run a **required stitcher-agent pass** that returns **(B)**:
     - cleaned transcript
     - audit trail of merge operations/decisions
     - debugging payloads / references to raw artifacts (so we can trace back)
   - Output should be structured (JSON) to preserve the audit trail.
   - **Storage requirement (per Derrick):** persist stitcher input/output + audit trail under the Phase1 `raw/` tree (same place we store other debug/audit artifacts), with file refs captured in `events.jsonl`.
     - This is intentionally “best effort” rather than perfect, matching our broader agentic strategy.

5) **Observability**
   - Emit events in `raw/_meta/events.jsonl` for: preflight, chunk plan, chunk processing, rolling-context handoffs, and merge.
   - Persist per-chunk raw artifacts + final merged output.

---

## Acceptance Criteria

- Running Phase1 on an audio input whose **Base64 payload** would exceed the configured limit (≈10MB) **does not throw** due to provider limits.
- **Chunking is the default** when over budget; we do not apply quality-degrading compression as the primary strategy.
- Music chunking includes rolling-context carry (each chunk aware of previous summary).
- Dialogue chunking includes rolling-context handoff (each chunk receives prior transcript context) and produces a coherent merged transcript.
- Merge includes:
  - mechanical stitched transcript with timestamps/boundaries
  - **required** stitcher-agent pass that returns cleaned transcript + audit trail + debug refs (best-effort)
- Chunking produces:
  - per-chunk artifacts (promptRef + provider debug on errors)
  - final merged output artifact(s)
- Works for both:
  - `server/scripts/get-context/get-dialogue.cjs`
  - `server/scripts/get-context/get-music.cjs`
- Unit tests cover:
  - “within limit” path
  - “over limit → chunking” path
  - dialogue rolling-context handoff + **required** stitcher invocation (can be stubbed)
  - music rolling-summary merge
- Config schema/docs updated.

---

## Tasks

### Task 1: Inspect current Phase1 audio flow + limits

**SubAgent:** `coder`
**Prompt:** In emotion-engine, inspect `get-dialogue.cjs` and `get-music.cjs` to identify where audio is loaded, encoded, and sent to providers; identify current size assumptions and where failures occur. Propose where to insert preflight + chunking + rolling-context + stitcher pipeline with minimal disruption. Summarize findings.

**Status:** ⏳ Pending

---

### Task 2: Implement reusable audio preflight + Base64 budget helpers

**SubAgent:** `coder`
**Prompt:** Add a helper module (e.g., `server/lib/audio-preflight.cjs`) that:
- gets file size + duration (ffprobe)
- estimates bytes/sec and computes a safe chunk duration based on a **Base64 payload limit**
  - use Base64 expansion factor (~4/3) + safety margin
- returns a decision trace describing why chunking is needed and what chunk plan was chosen
Integrate with captureRaw events timeline.

**Status:** ⏳ Pending

---

### Task 3: Implement chunk planner + splitter (video-like)

**SubAgent:** `coder`
**Prompt:** Implement chunk planning based on **Base64 payload budget** → computed duration.
- No silence detection/cutting.
- Add splitter helper (ffmpeg segmenting) producing deterministic chunk filenames under the run output (Phase1 raw area).
- Ensure events emitted and artifacts written.

**Status:** ⏳ Pending

---

### Task 4: Update `get-dialogue.cjs` to use preflight/chunk + rolling context + REQUIRED stitcher

**SubAgent:** `coder`
**Prompt:** Update `server/scripts/get-context/get-dialogue.cjs`:
- try single-call if within Base64 budget
- else chunk (video-like)
- process chunks sequentially:
  - each chunk produces: transcript segment + a small "handoff context" payload
  - next chunk prompt includes prior handoff context
- after chunk processing:
  - write a mechanical stitched transcript (with timestamps + chunk boundaries)
  - run a **required stitcher-agent pass** (text-only via `ai.dialogue_stitch`) that returns JSON (B):
    - cleaned transcript
    - audit trail (merge decisions/ops)
    - debug refs/payloads (links back to chunk artifacts)
  - persist stitcher **input + output** under Phase1 `raw/` (and reference them from `events.jsonl`)
- write clear artifacts for each chunk + stitched + stitcher outputs
- ensure failures record provider debug and continue/fail according to retry policy

**Status:** ⏳ Pending

---

### Task 5: Update `get-music.cjs` to use preflight/chunk + rolling context merge

**SubAgent:** `coder`
**Prompt:** Update `server/scripts/get-context/get-music.cjs`:
- try single-call if within Base64 budget
- else chunk (video-like)
- process chunks sequentially with rolling summary context (each chunk sees previous summary)
- write per-chunk summaries + final merged summary output
- persist artifacts and emit events

**Status:** ⏳ Pending

---

### Task 6: Add stitcher-agent target chain to YAML (OpenRouter-only)

**SubAgent:** `coder`
**Prompt:** Add a new AI domain in config for the dialogue stitcher step (text-only). Example domain name: `ai.dialogue_stitch`.

Constraint from Derrick: **use OpenRouter for everything** for now.

Update `configs/cod-test.yaml` (and any other relevant configs) to include a `targets` chain for this domain using the existing schema:

- `ai.dialogue_stitch.targets[*].adapter.{name,model,params?}`

Use multiple OpenRouter-backed models as fallbacks, e.g.:
- `openrouter / openai/gpt-4.1`
- `openrouter / anthropic/claude-3.5-sonnet`
- `openrouter / google/gemini-2.5-pro`

Then wire `get-dialogue.cjs` to call this domain via the targets executor.

**Status:** ⏳ Pending

---

### Task 7: Tests + docs + issue closure

**SubAgent:** `coder`
**Prompt:** Add/update unit tests for oversized audio handling (mock ffprobe/ffmpeg as needed or use small fixtures). Update docs/config guide with new knobs and document:
- Base64 budget chunking trigger
- rolling-context strategy for dialogue + music
- required stitcher output contract (cleaned transcript + audit trail + debug refs) and where it is stored under `raw/`
- `ai.dialogue_stitch` OpenRouter target chain

Then delete `.issues/audio-too-large-chunking-strategy.md`, commit, and push.

**Status:** ⏳ Pending

---

## Final Results

**Status:** ⏳ Draft

*Completed on 2026-03-09*
