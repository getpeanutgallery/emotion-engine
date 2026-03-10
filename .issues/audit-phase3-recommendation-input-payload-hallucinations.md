# Audit Phase 3 recommendation input payload (hallucination-heavy output)

## Context
Recent Phase 3 `server/scripts/report/recommendation.cjs` outputs feel **hallucination-heavy** (strong claims that do not seem grounded in the video’s analyzed chunks/metrics).

This issue is to audit the **exact input payload** that the recommendation prompt is built from, and to ensure we can trace every claim back to a concrete input field.

## What to Investigate
`server/scripts/report/recommendation.cjs` builds the prompt from:

- `artifacts.metricsData` (Phase 3 metrics outputs)
- `artifacts.chunkAnalysis.chunks` (Phase 2 chunk analysis)
- `pipelineMeta` derived from pipeline config (`config.name`, `config.version`, `tool_variables.*`)

Specifically, validate that the prompt input object:

```js
{ pipelineMeta, metricsSummary, chunkSummaries }
```

matches the **true, current** artifacts for the run (not stale, not partially hydrated, not mutated).

## Artifacts to Inspect (per-run)
Use a specific run dir under `output/<run>/` and inspect:

- Prompt payload (promptRef):
  - `output/<run>/raw/ai/_prompts/*.json`
- Recommendation attempt captures:
  - `output/<run>/phase3-report/raw/ai/recommendation/attempt-*/capture.json`
- Chunk analysis source:
  - `output/<run>/phase2-process/chunk-analysis.json`
- Phase 3 metrics outputs (whatever `metricsData` is sourced from for that pipeline):
  - `output/<run>/phase3-report/**` (metrics JSON/CSV artifacts)
- Timeline + artifact writes (ground truth for what was produced/loaded when):
  - `output/<run>/raw/_meta/events.jsonl`

## Hypotheses (why output is hallucination-heavy)
1. **Bogus metrics / friction index**
   - `metricsData` may be incorrect (bad aggregation, wrong duration normalization, mismatched chunk count), leading the model to “explain” nonsense.
2. **Chunk summaries are invented / degraded**
   - `chunkAnalysis.chunks[*].summary` might be empty/garbled, or derived from an earlier step that already hallucinated.
3. **Prompt is too leading**
   - Instruction framing may bias the model toward confident, specific “retention beats” even when the data is thin.
4. **Persisted-artifacts hydration is wrong or stale**
   - Phase 3 may be reading cached artifacts from a previous run, or mixing run roots (e.g. wrong `outputDir`, pointer files, or replay-mode artifacts).

## Deliverables
1. **Script/procedure to dump the exact INPUT object** used for recommendation
   - Goal: produce a JSON file that matches what `buildPrompt()` stringifies (before it becomes a string prompt).
   - Options:
     - Add a debug flag (e.g. `DUMP_RECOMMENDATION_INPUT=1`) to write `phase3-report/raw/ai/recommendation/input.json` alongside attempt captures.
     - OR a standalone node script that loads `output/<run>/phase2-process/chunk-analysis.json` + Phase 3 metrics artifacts and reconstructs the exact object.
2. **Checklist** to compare prompt input vs source artifacts
   - Verify:
     - chunk count, indices, start/end times
     - each chunk summary/emotion fields come from `phase2-process/chunk-analysis.json`
     - metricsSummary fields come from the metrics artifacts (not computed defaults)
     - pipelineMeta matches the invoked config (name/version/persona paths)
3. **Grounding / provenance improvements**
   - Ensure recommendation output can cite stable references:
     - include `chunkIndex` + `[startTime,endTime]` in the input (already present) and optionally require the model to reference them
     - include a `sources`/`evidence` array in the output schema (e.g. `{ kind: 'metric'|'chunk', path: 'metricsSummary.frictionIndex'|'chunkSummaries[3].summary', note }`)
     - write raw-captured `recommendation.input.json` + include its hash/promptRef in the attempt capture for traceability

## Acceptance Criteria
- For a chosen run, we can show the **exact** recommendation input object that was fed into `buildPrompt()`.
- Every **strong claim** in `recommendation.text`, `reasoning`, `keyFindings`, and `suggestions` is traceable to:
  - a specific field in `{ pipelineMeta, metricsSummary, chunkSummaries }`, **or**
  - is explicitly flagged as ungrounded (and we identify the upstream step that hallucinated).
- If we find upstream hallucinations (e.g. invented chunk summaries or bogus metrics), file follow-up issues pointing at the responsible script/phase and add minimal repro + artifact pointers.
