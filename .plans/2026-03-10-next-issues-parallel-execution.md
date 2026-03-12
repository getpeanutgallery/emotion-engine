# emotion-engine: next issues + parallel execution

**Date:** 2026-03-10  
**Status:** Superseded (draft planning snapshot)
**Agent:** Cookie 🍪

---

## Goal

Pick the next issue(s) to tackle now, prioritize by unblocking stable Phase3 recommendations and improving debuggability, and identify what can be done in parallel.

---

## Current Issues (emotion-engine)

- `cod-test-recommendation-invalid-json-20260310.md`
- `audit-phase3-recommendation-input-payload-hallucinations.md`
- `openrouter-errors-and-debugging-alignment.md`
- `investigate-recent-run-error-responses-taxonomy.md`
- `expose-ffmpeg-compression-vars-via-yaml.md`
- `investigate-run-root-raw-folder-location.md`
- `phase3-cod-test-config-duplicate-recommendation-key.md` (likely closeable)
- `cod-test-openrouter-invalid-model-id.md` (likely closeable)
- `cod-test-phase3-only-config.md` (implemented; likely closeable)

## Current Issues (ai-providers)

- adapter smoketests: openai/anthropic/gemini
- oauth architecture + provider-specific issues

---

## Proposed Priority

### P0: Recommendation grounding + reliability
1) **Audit recommendation inputs** (`audit-phase3-recommendation-input-payload-hallucinations.md`)
2) **Fix recommendation contract / JSON enforcement** (`cod-test-recommendation-invalid-json-20260310.md`)

### P1: Better diagnostics
3) **Error taxonomy aggregator** (`investigate-recent-run-error-responses-taxonomy.md`)
4) **OpenRouter debug alignment** (`openrouter-errors-and-debugging-alignment.md`)

### P2: Structural / long-term
5) ffmpeg compression vars YAML (clean-break)
6) run-root raw folder location
7) ai-providers smoketests/oauth

---

## Parallel Streams (suggested)

- **Stream A (`coder`)**: recommendation input audit (dump exact INPUT object + provenance mapping).
- **Stream B (`coder`)**: recommendation JSON enforcement / model-target tuning / retries.
- **Stream C (`coder` or `primary`)**: error taxonomy script/procedure.

---

## Tasks

### Task 1: Execute Stream A (inputs audit)
**SubAgent:** `coder`
**Prompt:** Implement the deliverables from `audit-phase3-recommendation-input-payload-hallucinations.md`: dump the exact prompt INPUT object + map claims to source artifacts.

**Status:** ⏳ Pending

### Task 2: Execute Stream B (recommendation reliability)
**SubAgent:** `coder`
**Prompt:** Make recommendation outputs reliably parseable JSON across selected OpenRouter models (prompt tightening, response extraction, optional repair pass) and add tests.

**Status:** ⏳ Pending

### Task 3: Execute Stream C (taxonomy)
**SubAgent:** `coder`
**Prompt:** Add a script or documented procedure to aggregate errors by type+frequency from an output folder.

**Status:** ⏳ Pending

---

## Final Results

**Status:** ⏳ Draft
