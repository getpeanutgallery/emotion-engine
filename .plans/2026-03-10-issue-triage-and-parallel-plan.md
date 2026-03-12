# emotion-engine: issue triage + parallel execution plan

**Date:** 2026-03-10  
**Status:** Superseded
**Agent:** Cookie 🍪

---

## Goal

Enumerate current `.issues/*.md` across emotion-engine (and key polyrepo siblings where relevant), then propose a priority order and identify what can be executed simultaneously.

---

## Tasks

### Task 1: Enumerate issues

**SubAgent:** `primary`
**Prompt:** List `.issues/*.md` in:
- `projects/peanut-gallery/emotion-engine/.issues`
- `projects/peanut-gallery/ai-providers/.issues`
- `projects/peanut-gallery/digital-twin-router/.issues`
Return filenames + 1-line summary for each (title + first paragraph).

**Status:** ✅ Complete

**Results:**
- emotion-engine:
  - `cod-test-openrouter-invalid-model-id.md`
  - `cod-test-phase3-only-config.md`
  - `cod-test-recommendation-invalid-json-20260310.md`
  - `expose-ffmpeg-compression-vars-via-yaml.md`
  - `investigate-recent-run-error-responses-taxonomy.md`
  - `investigate-run-root-raw-folder-location.md`
  - `openrouter-errors-and-debugging-alignment.md`
- ai-providers:
  - `adapter-anthropic-api-key-smoketest.md`
  - `adapter-gemini-api-key-smoketest.md`
  - `adapter-openai-api-key-smoketest.md`
  - `oauth-anthropic-adapter.md`
  - `oauth-architecture-decision.md`
  - `oauth-gemini-adapter.md`
  - `oauth-openai-adapter.md`
- digital-twin-router:
  - no `.issues/` directory currently (clean)

---

### Task 2: Triage + parallelization proposal

**SubAgent:** `primary`
**Prompt:** Using the issue list, categorize by:
- Unblocks cod-test end-to-end pass
- Improves iteration speed (dev UX)
- Longer-term platform work
Then propose:
- top 3 priorities
- what can be done in parallel (non-overlapping files/repos)
- suggested subagent assignments (coder/research/primary)

**Status:** ✅ Complete

**Results (proposed):**
- **P0 (unblock cod-test pass):** `cod-test-recommendation-invalid-json-20260310.md`
- **P0/P1 (speed up iteration):** `cod-test-phase3-only-config.md`
- **P1 (diagnostics):** `investigate-recent-run-error-responses-taxonomy.md` + `openrouter-errors-and-debugging-alignment.md`
- **P2 (structural):** `investigate-run-root-raw-folder-location.md`
- **P2 (clean-break config):** `expose-ffmpeg-compression-vars-via-yaml.md`
- **Likely close soon:** `cod-test-openrouter-invalid-model-id.md` (config corrected; verify no remaining references / rerun proof).

**Parallelization suggestion:**
- Stream A (`coder`): Fix Phase3 recommendation JSON guarantees + rerun cod-test.
- Stream B (`coder`): Implement Phase3-only config + docs.
- Stream C (`primary`/`coder`): Build error taxonomy aggregator + enrich captures.
- Stream D (`coder`, longer): OpenRouter error/debug alignment work (may touch `ai-providers`).
- Stream E (`coder`, longer): ffmpeg compression vars YAML clean-break implementation.


---

## Final Results

**Status:** ⏳ In Progress
