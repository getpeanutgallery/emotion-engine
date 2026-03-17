---
plan_id: plan-2026-03-09-captureraw-meta-triple-implementation
---
# captureRaw/meta: events.jsonl + prompt dedupe + provider debug consistency

**Date:** 2026-03-09  
**Status:** Superseded (split into implemented work + remaining Beads)
**Agent:** Cookie 🍪

---

## Goal

Implement all three captureRaw/meta issues together:

1) `events.jsonl` timeline for raw capture
2) prompt dedupe hash store
3) consistent sanitized `error.debug` across providers (ai-providers)

Constraint: we will **not** attempt a new golden run until **all current issues** are handled; verification here should stay at smoke-test level.

---

## Safety / Compatibility Strategy

Per Derrick: **breaking changes are acceptable**; it’s OK to delete old runs/cassettes.

- **Make the new captureRaw format the default**: enable `events.jsonl` + prompt dedupe by default (no opt-in flags required) unless there’s a strong reason not to.
- **Provider debug consistency remains additive**: standardize `error.debug` shape in `ai-providers`, but still avoid removing existing fields.
- **Determinism for the *next* golden**: it’s fine if outputs differ from historical runs; but the new format should be stable run-to-run (avoid volatile timestamps unless clearly labeled as such).

---

## Tasks

### Task 1: Implement provider debug consistency in `ai-providers`

**SubAgent:** `coder`
**Prompt:** In the `ai-providers` repo (under `~/.openclaw/workspace/projects/peanut-gallery/`), implement a shared helper to attach a consistent sanitized `error.debug` payload across adapters (OpenAI/Anthropic/Gemini/OpenRouter). Requirements:

- Provide a stable schema: `{ provider, adapter, model?, request?, response?, status?, headers?, timing?, retry?, cause? }` (only include safe/sanitized subsets)
- Ensure it preserves any existing debug fields (merge, don’t overwrite)
- Ensure secrets are redacted (API keys, Authorization headers, raw prompt contents if configured to avoid)
- Add/extend tests if present
- Commit + push to main

**Files Modified:**

- `ai-providers/*`

**Status:** ✅ Complete

**Results:**
- Landed standardized debug helper + provider integrations + tests in `ai-providers`.
- Commit: `1a6dc181d646fe350ac2acc248f7036ef9a71bae` — `feat(debug): standardize provider error.debug payload`
- Pushed to `origin/main`


---

### Task 2: Pin `emotion-engine` to the new `ai-providers` commit

**SubAgent:** `coder`
**Prompt:** Update `emotion-engine` to pin `ai-providers` dependency to the new commit via git+ssh (matching repo conventions). Run minimal tests (`npm test` if available) and commit + push.

**Files Modified:**

- `emotion-engine/package.json` / lockfile as applicable

**Status:** ✅ Complete

**Results:**
- Pinned `ai-providers` to `1a6dc181d646fe350ac2acc248f7036ef9a71bae`.
- Tests: `npm test` passing.
- Commit: `08a479f` — `chore(deps): pin ai-providers for standardized debug`
- Pushed to `origin/main`
- Note: a local git stash was left behind in the repo (`stash@{0}`) from the subagent workflow.


---

### Task 3: Implement `raw/_meta/events.jsonl` (default ON) in `emotion-engine`

**SubAgent:** `coder`
**Prompt:** Implement `captureRaw-events-jsonl-timeline` in emotion-engine as the new default behavior.

**Status:** ✅ Complete

**Results:**
- Added run-level events timeline: `raw/_meta/events.jsonl` (default ON).
- Emits append-only JSONL events for: `run.*`, `phase.*`, `script.*`, `attempt.*`, `provider.call.*`, `artifact.write`, `error`.
- Marks mode `record` vs `replay` via `DIGITAL_TWIN_MODE`.
- Redacts secret-like keys/values and is resilient to output-dir deletions during tests.
- Commit: `16425ff` — `feat(captureRaw): events.jsonl + prompt dedupe` (also includes prompt store work)
- Pushed to `origin/main`

---

### Task 4: Implement prompt dedupe hash store (default ON) in `emotion-engine`

**SubAgent:** `coder`
**Prompt:** Implement `prompt-dedupe-hash-store` in emotion-engine as the new default behavior.

**Status:** ✅ Complete

**Results:**
- Added prompt store: `raw/ai/_prompts/<sha256>.json`.
- Attempt capture writers now store prompts by sha256 and write `promptRef` instead of embedding `prompt` blobs.
- Updated scripts: dialogue, music, video-chunks, recommendation.
- Tests updated to assert `promptRef` + prompt file existence.
- Commit: `16425ff` — `feat(captureRaw): events.jsonl + prompt dedupe`
- Pushed to `origin/main`

---

### Task 5: Verify end-to-end + clear obsolete artifacts

**SubAgent:** `coder`
**Prompt:** In emotion-engine: minimal verification.

**Status:** ✅ Complete

**Results:**
- `npm test` passing.
- New captureRaw artifacts now expected by default:
  - `raw/_meta/events.jsonl`
  - `raw/ai/_prompts/<sha256>.json` + attempt-level `promptRef`
- Implemented in commit: `16425ff`


---

## Final Results

**Status:** ✅ Complete

**Commits:**
- `1a6dc181d646fe350ac2acc248f7036ef9a71bae` (ai-providers) — `feat(debug): standardize provider error.debug payload`
- `08a479f` (emotion-engine) — `chore(deps): pin ai-providers for standardized debug`
- `16425ff` (emotion-engine) — `feat(captureRaw): events.jsonl + prompt dedupe`

**Notes:**
- There is a local git stash present in the emotion-engine repo (`stash@{0}`) left by the pinning workflow; we should inspect and drop/apply as appropriate.

*Completed on 2026-03-09*
