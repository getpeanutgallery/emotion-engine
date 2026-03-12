# emotion-engine: issue — audit recommendation AI inputs (hallucination concerns)

**Date:** 2026-03-10  
**Status:** In Progress  
**Agent:** Cookie 🍪

---

## Goal

Create a new issue in `emotion-engine/.issues/` to investigate the inputs being fed into the Phase3 recommendation AI (prompt + embedded JSON input payload), because the resulting recommendation appears hallucination-heavy / not grounded.

---

## Tasks

### Task 1: Create issue + commit + push

**SubAgent:** `coder`
**Prompt:** In `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine`:

1) Create a new `.issues/*.md` that covers:
- **Context:** Phase3-only run succeeded and produced a recommendation that appears hallucinated/unfaithful to actual video content.
- **Investigation focus:** validate exactly what data is passed into `recommendation.cjs`:
  - `artifacts.metricsData` (averages/trends/frictionIndex/peakMoments)
  - `artifacts.chunkAnalysis.chunks` (summaries, dominant emotions, confidence, etc.)
  - pipelineMeta (persona/goal paths)
- **Data sources to inspect:**
  - recommendation prompt payload under `output/<run>/raw/ai/_prompts/*.json` (promptRef)
  - `output/<run>/phase3-report/raw/ai/recommendation/attempt-*/capture.json`
  - upstream artifacts on disk that feed into it:
    - `output/<run>/phase2-process/chunk-analysis.json`
    - `output/<run>/phase3-report/metrics/metrics.json` (or wherever metricsData is persisted)
    - `output/<run>/raw/_meta/events.jsonl`
- **Hypotheses to test:**
  - metrics/friction index computed incorrectly (e.g. bogus 79.82)
  - chunk summaries contain invented claims that propagate
  - recommendation prompt includes stale/legacy placeholders or overly-leading instructions
  - wrong artifact hydration for Phase3-only run (persisted-artifacts hydration pulling from stale path)
- **Deliverables:**
  - a small script or documented procedure to print the exact JSON “INPUT” object used in the prompt (before stringification)
  - a comparison checklist: prompt input vs on-disk source artifacts
  - suggestions to add grounding constraints (e.g., require quoting fields, ban timestamps unless present, include provenance refs)
- **Acceptance criteria:**
  - We can reproduce and explain each “strong claim” in the recommendation by pointing to a specific field in the input payload.
  - If not explainable, we identify which upstream artifact generation is hallucinating and file follow-up issues.

2) Commit and push to `origin/main`.

Return issue filename + commit hash.

**Status:** ⏳ Pending

---

## Final Results

**Status:** ⏳ In Progress
