# CaptureRaw v2 parity for Phase1 (dialogue/music)

## Problem
We shipped captureRaw v2 for Phase2 (attempt-scoped directories, phase-level error summaries, version capture). Phase1 dialogue/music scripts still use the older flat raw capture style and don’t persist provider debug/response details on errors consistently.

## Goal
Bring Phase1 raw capture up to the same standard as Phase2:
- attempt-scoped artifacts (even if retries are added later)
- persist sanitized provider debug payloads on errors
- phase-level `_meta/errors.jsonl` + `errors.summary.json`

## Acceptance criteria
- On a Phase1 failure, we can inspect prompt/request/response/error debug without rerunning.
- Artifact layout matches Phase2 conventions.
