# Phase 2 Persona Thought Contract Design Note

**Date:** 2026-05-13  
**Task:** `ee-8q0d`  
**Scope:** Audit why persona-thought behavior disappeared from the current Phase 2 path and propose the exact JSON contract to restore it without destabilizing benchmarked fields.

## Executive Summary

The older persona-thought behavior disappeared for a simple architectural reason:

1. **Legacy persona prompt lineage** (`server/lib/persona-loader.cjs`) still describes a per-second schema with `thought` and `scroll_risk`.
2. **The current Phase 2 runtime does not use that loader.** `server/scripts/process/video-chunks.cjs` calls `tools/emotion-lenses-tool.cjs`, which builds a different prompt and requires a different final JSON shape.
3. **The current prompt contract explicitly asks for only** `summary`, `emotions`, `dominant_emotion`, and `confidence`.
4. **The validator/normalizer contract enforces only those fields** via `validateEmotionStateObject(...)` in both `tools/lib/structured-output.cjs` and `server/lib/structured-output.cjs`.
5. **`video-chunks.cjs` then projects only those normalized fields into `chunkResult`**, so even if a model emitted extra persona-style fields, they would be dropped before `chunk-analysis.json` is written.
6. **Benchmarking currently compares chunk-analysis structurally**, so adding output-only fields without comparator/truth changes would currently fail the benchmark.

So the disappearance was not a subtle model regression. The contract was narrowed at the prompt + validator + projection layers.

## What the current Phase 2 path actually is

### Runtime path now

`server/scripts/process/video-chunks.cjs`
→ `tools/emotion-lenses-tool.cjs` (`buildBasePromptFromInput`, `executeEmotionAnalysisToolLoop`)
→ `tools/lib/structured-output.cjs` (`validateEmotionStateObject`)
→ `chunkResult` projection in `video-chunks.cjs`
→ `phase2-process/chunk-analysis.json`

### Important audit finding

`server/lib/persona-loader.cjs` is **legacy prompt lineage**, not the active chunk-analysis runtime for `video-chunks.cjs`.
It still carries the older persona concept:
- persona-authentic `thought`
- `scroll_risk`
- per-second analysis framing

But the live Phase 2 chunk path has already moved to a chunk-summary + per-lens-emotions contract.

## Evidence by layer

### 1) Prompt contract drift

#### Older/legacy lineage
`server/lib/persona-loader.cjs` still says:
- use the persona's authentic voice in `thought` fields
- mark `scroll_risk` as `SCROLLING`
- output `per_second_analysis[]`

That is the last clear first-class home for persona-thought behavior.

#### Current/live Phase 2 prompt
`tools/emotion-lenses-tool.cjs` now instructs the model to return exactly:
- `summary`
- `emotions.<lens>.score`
- `emotions.<lens>.reasoning`
- `dominant_emotion`
- `confidence`

No `thought`, no `continuationThought`, no `personaMeta`, no `scroll_risk`.

### 2) Model response expectation drift

The validator tool contract in `tools/emotion-lenses-tool.cjs` builds an example object with only:
- `summary`
- `emotions`
- `dominant_emotion`
- `confidence`

The local validator loop therefore teaches the model that those are the full final artifact.

### 3) Validator/normalizer narrowing

`validateEmotionStateObject(...)` in both structured-output files only validates and returns:
- `summary`
- `emotions`
- `dominant_emotion`
- `confidence`

Anything else is outside the normalized value. Even if the parser accepts extra keys, they are not preserved in `validated.value`.

### 4) Downstream artifact projection narrowing

`server/scripts/process/video-chunks.cjs` constructs `candidateChunkResult` from parsed output using only:
- `summary`
- `emotions`
- `dominant_emotion`
- `confidence`
- status/tokens/persona metadata

So the artifact writer has no path for persona-thought fields today.

### 5) Artifact outcome now

Current artifact:
`output/cod-test-phase2-only-retest-2026-05-06-with-timestamps/phase2-process/chunk-analysis.json`

Each chunk contains only:
- timeline/status fields
- `summary`
- lens `reasoning`
- `dominant_emotion`
- `confidence`
- `persona`

That produces reviewable analysis, but not the intended "persona as a person reacting in voice" layer.

### 6) Benchmark/scoring assumption now

`server/lib/benchmark-runner.cjs` uses profile `chunk-analysis-default`.
It currently scores:
- chunk timeline
- chunk summary
- emotion scores
- dominant emotion
- persona contract (`persona.*` and `chunks[*].persona.*`)

It does **not** define a scoring lane for `thought`, `continuationThought`, or `personaMeta`.

More importantly, the structured comparator treats extra output fields as hard failures unless ignored. So adding new chunk fields without comparator/truth adjustments will break chunk-analysis benchmark runs.

That matters because the cod-test chunk-analysis truth is still explicitly described as **bootstrap truth, not reviewed gold truth** in `benchmarks/fixtures/cod-test/fixture.json`.

## Why the current outputs feel less persona-like

The current contract pushes persona voice into two weaker places:
- generic `summary`
- lens `reasoning`

Those fields are useful for scoring, but they are not a stable home for:
- first-person internal monologue
- carry-forward reaction from the prior chunk
- optional persona-specific extras like scroll-risk posture

The result is exactly what the recent digest observed: the artifact keeps clean analysis, while richer persona-ish text survives only inconsistently in raw captures or disappears entirely from the normalized artifact.

## Proposed exact JSON contract

### Proposed chunk payload shape

```json
{
  "summary": "Brief summary of this chunk (1-2 sentences)",
  "thought": "Persona-voiced internal monologue for this chunk.",
  "continuationThought": "Optional follow-on reaction that carries momentum from the prior chunk.",
  "emotions": {
    "patience": { "score": 4, "reasoning": "..." },
    "boredom": { "score": 8, "reasoning": "..." },
    "excitement": { "score": 3, "reasoning": "..." }
  },
  "dominant_emotion": "boredom",
  "confidence": 0.9,
  "personaMeta": {
    "scrollRisk": "high"
  }
}
```

### Exact field rules

#### Required
- `summary: string`
- `thought: string`
- `emotions: object`
- `dominant_emotion: string`
- `confidence: number`

#### Optional
- `continuationThought: string`
- `personaMeta: object`
- `personaMeta.scrollRisk: "low" | "medium" | "high" | "SCROLLING"`

### Why this exact shape

- `summary` stays as the benchmark-friendly neutral description.
- `thought` becomes the required stable home for persona voice.
- `continuationThought` stays optional because some chunks genuinely do not need a second line of reaction.
- `personaMeta` stays optional and tightly bounded so it does not become a junk drawer.
- `scrollRisk` is preserved only as an optional persona extra, not a universal required field.

## Validation and normalization rules

### `summary`
- required non-empty string
- English-only under the same current contract
- should remain concise and evidence-grounded

### `thought`
- required non-empty string
- English-only
- should be persona-voiced rather than neutral analyst prose
- should refer to the current chunk, not generic personality boilerplate
- can be first-person and informal

### `continuationThought`
- optional
- if present, must be a non-empty English string
- should add sequence continuity or escalation, not just restate `thought`
- if trimmed value equals `thought`, reject it as redundant

### `personaMeta`
- optional
- if present, must be a plain JSON object
- **initial rule: `additionalProperties: false`**
- allowed key set for the first restoration pass:
  - `scrollRisk`
- `scrollRisk` enum: `low | medium | high | SCROLLING`

### `emotions`
- unchanged from current validator
- exactly one entry per configured lens
- each `score` finite number in `1..10`
- each `reasoning` required non-empty English string

### `dominant_emotion`
- unchanged
- must match one configured lens

### `confidence`
- unchanged
- finite number in `0..1`

## Backward-compatibility plan

### Output compatibility

Existing consumers that only read:
- `summary`
- `emotions`
- `dominant_emotion`
- `confidence`

can continue to function unchanged if the new fields are added alongside them.

### Validation compatibility

The validator should be changed to:
- require `thought`
- tolerate missing `continuationThought`
- tolerate missing `personaMeta`

That means **new runs** require the restored field, while **old artifacts** still need to remain readable by reporting/benchmark tools.

### Artifact compatibility recommendation

Do **not** rewrite old artifact files.
Instead:
- make downstream readers tolerant of absent `thought`, `continuationThought`, and `personaMeta`
- only require them for newly generated outputs after the prompt/validator change lands

## Benchmark recommendation

### Recommendation: keep new persona-thought fields non-scored initially

For the first restoration pass, treat these fields as **informational / surfaced / ignored for scoring**:
- `chunks[*].thought`
- `chunks[*].continuationThought`
- `chunks[*].personaMeta`
- `chunks[*].personaMeta.scrollRisk`

### Why

1. Current chunk-analysis truth is still bootstrap truth, not reviewed gold truth.
2. The comparator treats extra output fields as failures unless ignored.
3. Long-form persona voice is exactly the kind of field that should not become scoreable until we have reviewed truth and stable editorial expectations.

### Concrete benchmark guidance

The coder should choose one of these two safe options:

#### Preferred option
Update the chunk-analysis comparator profile/default ignore paths so these paths are ignored as output-only informational fields for now:
- `chunks[*].thought`
- `chunks[*].continuationThought`
- `chunks[*].personaMeta`
- `chunks[*].personaMeta.scrollRisk`

#### Acceptable option
Add the same paths to truth-level `_benchmark.ignorePaths` in `benchmarks/fixtures/cod-test/truth/chunk-analysis.json` if that is operationally cleaner.

### Do not score initially
Do **not** add an initial `chunk_thought_pct` or `chunk_scroll_risk_pct` score lane yet.
If we later editorially review thought fields, add a separate scoring family rather than quietly mixing them into summary or persona contract scores.

## Implementation guidance for the coder

1. **Prompt contract**
   - Update `tools/emotion-lenses-tool.cjs` prompt text and validator-tool example so the final JSON shape explicitly includes required `thought`, optional `continuationThought`, and optional `personaMeta.scrollRisk`.
   - Keep `summary` as neutral artifact prose and `thought` as persona voice.

2. **Validator/normalizer contract**
   - Update both structured-output validators (`tools/lib/structured-output.cjs` and `server/lib/structured-output.cjs`) so the normalized value preserves the new fields.
   - Add a small helper for optional bounded `personaMeta` validation rather than allowing arbitrary nested payloads.

3. **Chunk result projection**
   - Update `server/scripts/process/video-chunks.cjs` so `candidateChunkResult` copies through:
     - `thought`
     - `continuationThought` when present
     - `personaMeta` when present

4. **Backward-tolerant readers**
   - Any digest/report layer that displays chunk data should treat missing new fields as normal for old artifacts.

5. **Benchmark safety**
   - Before rerunning cod-test benchmarks, ignore the new paths so output-only additions do not produce structural failures.

## Recommended acceptance criteria for the restoration pass

A restoration pass should count as successful when:
- every new chunk output contains a non-empty persona-voiced `thought`
- `continuationThought` appears only when it adds real sequence value
- `personaMeta` is absent unless it has meaningful content
- existing numeric emotion scoring remains unchanged in shape
- old chunk-analysis artifacts remain readable
- benchmark runs do not fail just because the new informational fields exist

## Bottom line

The persona-thought layer disappeared because the active Phase 2 chunk path was simplified to a benchmark-friendly emotion JSON contract and the validator/projection path now preserves only that minimal shape.

The safest restoration is:
- add **required `thought`**
- add **optional `continuationThought`**
- add **optional bounded `personaMeta`** with only `scrollRisk` allowed in pass 1
- keep those new fields **non-scored initially**
- preserve all current benchmarked emotion fields exactly as they are

That restores the human-readable persona layer without destabilizing the scoring contract.
