# OpenRouter MiMo dialogue JSON audit — Task 1

**Date:** 2026-04-01  
**Scope:** Latest failed Phase 1 `get-dialogue` run in `output/cod-test-mimo-openrouter-compare/`

## Verdict

The Phase 1 failure is a **first-turn JSON parse failure on dialogue chunk 7**, not a schema-validation failure and not a transport/no-content failure.

What is provable from the artifacts:

- OpenRouter successfully returned valid JSON for chunks 0-6 in the same run.
- The failing request reached OpenRouter, waited ~84.7s, and then the tool loop threw at `parseJsonObjectInput(rawContent)` before any validator/tool-call handling could occur.
- The provider therefore returned a **non-empty text completion that was not parseable as JSON**, even after the parser's fence/object extraction and light normalization passes.
- The **exact offending raw payload is not recoverable from the saved artifacts** because the failure capture path currently drops the `error.aiTargets` parse/completion/tool-loop diagnostics that `executeLocalValidatorToolLoop()` produces.

So the most precise truthful classification is:

> **Unparseable provider text response on chunk 7 turn 1** (likely malformed/truncated JSON or prose), with the exact payload shape obscured by a source-owned failure-capture regression.

## Primary evidence

### 1) The run only fails on chunk 7; chunks 0-6 completed normally

- `output/cod-test-mimo-openrouter-compare/_meta/events.jsonl`
  - seq 8-16: chunk 0 succeeds
  - seq 19-27: chunk 1 succeeds
  - seq 30-38: chunk 2 succeeds
  - seq 41-49: chunk 3 succeeds
  - seq 52-60: chunk 4 succeeds
  - seq 63-71: chunk 5 succeeds
  - seq 74-82: chunk 6 succeeds
  - seq 85-91: chunk 7 starts, waits, then fails
- The chunk 7 call starts at `2026-04-01T14:09:25.014Z` and ends failed at `2026-04-01T14:10:49.724Z` (`durationMs: 84710`).

### 2) The failure is raised exactly at JSON parse time inside the local validator tool loop

- `server/lib/local-validator-tool-loop.cjs:227-271`
  - `completion = await callProvider(...)`
  - `rawContent = completion?.content`
  - `parseJsonObjectInput(rawContent)`
  - if parse fails, throws `invalid_output: dialogue transcription chunk response was not valid JSON`
- The failure stack in both:
  - `output/cod-test-mimo-openrouter-compare/phase1-gather-context/script-results/get-dialogue.failure.json`
  - `output/cod-test-mimo-openrouter-compare/phase1-gather-context/raw/_meta/errors.summary.json`
  points to `server/lib/local-validator-tool-loop.cjs:253`.

This means the contract broke **before** malformed-tool-envelope handling, validator rejection, or final-artifact revalidation.

### 3) This was not a no-content / empty-provider-envelope transport error

- `node_modules/ai-providers/providers/openrouter.cjs:231-263`
  - `transformResponse()` extracts `message.content` / `audio.transcript`
  - if neither exists, it throws `OpenRouter: No content in response`
- The saved failure artifacts do **not** show that error shape:
  - `errorStatus: null`
  - `errorRequestId: null`
  - `errorResponse: null`
  - message is specifically `invalid_output: dialogue transcription chunk response was not valid JSON`

That means the OpenRouter provider layer returned a completion object to the tool loop; the failure happened **after** provider response extraction, during JSON parsing of `completion.content`.

### 4) The parser already tolerates common wrapper noise, so this was not a simple fenced-JSON mismatch

- `server/lib/json-validator.cjs:51-170`
  - strips BOM
  - strips ```json fences
  - strips leading `json`
  - removes trailing commas before `}` / `]`
  - tries fenced-block extraction
  - tries balanced-object extraction
  - tries unwrapping quoted JSON strings

Because `parseJsonObjectInput()` still failed, the bad payload was **not** any of these easy cases:

- valid JSON wrapped in markdown fences
- valid JSON with a leading `json` token
- valid JSON with minor trailing commas only
- a valid balanced JSON object embedded in prose
- a well-formed but wrong tool envelope

A wrong tool envelope would still be valid JSON and would go through `parseValidatorToolCallEnvelope()` instead of failing at parse time.

### 5) Successful chunk captures prove this path normally records raw provider content when the response is parseable

- `output/cod-test-mimo-openrouter-compare/phase1-gather-context/raw/ai/dialogue-chunks/chunk-0006/attempt-01/capture.json`
  includes:
  - `rawResponse.content` with plain JSON text
  - `rawResponse.providerResponse.body.choices[0].message.content` containing the exact JSON string
  - `toolLoop.history[0].raw` with the same JSON
  - `toolLoop.validatorCalls: 1`, `turns: 1`

This confirms the current OpenRouter path **does** return the expected JSON shape when the model complies.

### 6) The failure capture path drops the exact parse diagnostics for chunk 7

Failed chunk capture:
- `output/cod-test-mimo-openrouter-compare/phase1-gather-context/raw/ai/dialogue-chunks/chunk-0007/attempt-01/capture.json`
  shows:
  - `rawResponse: null`
  - `parsed: null`
  - `toolLoop: null`
  - `errorDebug: null`
  - `errorResponse: null`
  - only the top-level retryable error message survives

But the throwing code *did* populate those diagnostics on `error.aiTargets`:
- `server/lib/local-validator-tool-loop.cjs:253-270`
  stores `raw`, `extracted`, `parseError`, `completion`, and `toolLoop` inside `createRetryableError(..., extra)`.

The saved capture misses them because the writer reads `error.debug`, not `error.aiTargets`:
- `server/scripts/get-context/get-dialogue.cjs:1387-1398`
  - failure path saves `toolLoop` from `error?.debug?.toolLoop`
  - failure path saves `errorDebug` from `error?.debug`
  - it does **not** persist `error?.aiTargets?.raw`, `error?.aiTargets?.completion`, `error?.aiTargets?.parseError`, or `error?.aiTargets?.toolLoop`

The script-result contract also drops those structured parse fields:
- `server/lib/script-contract.cjs:709-718`
  reads `error?.parseError`, `error?.validationErrors`, and `error?.validationSummary`
  instead of the `error.aiTargets.*` fields produced by the tool loop.

## Failure classification

### What it is

- **Provider/model output contract break at JSON parse stage**
- **Chunk-local, first-turn failure** (`chunkIndex: 7`, turn 1)
- **Not transport/auth/rate-limit/capability related**
- **Not validator/schema rejection**
- **Not a well-formed wrong tool envelope**
- **Not a simple markdown-fence/parser-tolerance miss**

### What it most likely was

From the code path and remaining possibilities, the provider likely returned one of:

1. malformed JSON text,
2. truncated/incomplete JSON text, or
3. prose/refusal/non-JSON text.

The exact subtype cannot be reconstructed from the current saved artifacts because the raw payload was not persisted on failure.

## Regression assessment

### Provider regression vs script regression

The evidence does **not** support a broad parser regression:

- same run, same provider/model, same tool loop, same parser, same config
- chunks 0-6 all returned valid JSON and auto-validated in one turn

So this is **not** a general "OpenRouter no longer returns JSON on this path" failure.

What *has* changed recently in the source-owned hot path is mostly prompt/handoff hardening in `server/scripts/get-context/get-dialogue.cjs`:

- `90dbcaf` Tighten opening seam speaker arbitration
- `c120277` Harden opening dialogue provenance arbitration
- `1126f9a` Probe opening dialogue attribution boundary
- `7ac9a2c` Tighten dialogue speaker attribution contract
- `8713428` Fix dialogue speaker registry stitching
- `0109e52` Stabilize dialogue timing and slim inferred traits
- `71e0c2b` Add grounded dialogue speaker contract

By contrast, the parser/validator plumbing touched in this failure (`local-validator-tool-loop.cjs`, `json-validator.cjs`) does not show same-day changes introducing a clear parser mismatch.

### Most likely regression shape

There are two plausible regressions, with different confidence levels:

1. **High confidence:** a source-owned **failure observability regression** now hides the exact offending payload on parse failures.
   - The tool loop stores parse diagnostics under `error.aiTargets`, but the capture/result writers only persist `error.debug` / top-level fields.
   - This is directly proven by source + saved artifacts.

2. **Medium confidence:** recent prompt-contract tightening in `get-dialogue.cjs` likely increased brittleness for later chunk prompts, but did **not** create a universal parser mismatch.
   - Chunk 7 is the largest prompt in the run (`~8491` chars vs chunk 6 `~8297`) and is the only one that fails.
   - That supports "prompt/model fragility on this chunk" more than "parser broke globally."
   - It does **not** prove which exact non-JSON payload the model produced.

## Smallest truthful next fix

Do **not** start with model swaps or broad parser changes.

The smallest truthful next fix is:

1. **First, restore failure observability** for this lane by persisting `error.aiTargets.raw`, `error.aiTargets.extracted`, `error.aiTargets.parseError`, `error.aiTargets.completion`, and `error.aiTargets.toolLoop` into the raw capture + script-result failure envelope.
2. Then rerun the single failing chunk / same config once.
3. Only after seeing the exact payload, choose the follow-up:
   - if prose/refusal: tighten prompt / tool-loop instructions or choose a more reliable model
   - if truncated JSON: add targeted retry / lower-thinking / shorter prompt mitigation
   - if a new provider envelope shape: adapt provider extraction or parser tolerance

Without step 1, any prompt/parser/model change would still be partly guesswork.

## Files that prove the conclusion

- `.logs/2026-04-01-cod-test-mimo-openrouter-compare-optimized-rerun-live.log`
- `output/cod-test-mimo-openrouter-compare/phase1-gather-context/script-results/get-dialogue.failure.json`
- `output/cod-test-mimo-openrouter-compare/phase1-gather-context/raw/_meta/errors.summary.json`
- `output/cod-test-mimo-openrouter-compare/_meta/events.jsonl`
- `output/cod-test-mimo-openrouter-compare/phase1-gather-context/raw/ai/dialogue-chunks/chunk-0006/attempt-01/capture.json`
- `output/cod-test-mimo-openrouter-compare/phase1-gather-context/raw/ai/dialogue-chunks/chunk-0007/attempt-01/capture.json`
- `output/cod-test-mimo-openrouter-compare/_meta/ai/_prompts/ed9b0e17bc1692a6cb330a4562c6bf06d7a2227e9769dda58ebad2a78ebb86f4.json`
- `server/lib/local-validator-tool-loop.cjs`
- `server/lib/json-validator.cjs`
- `server/scripts/get-context/get-dialogue.cjs`
- `server/lib/script-contract.cjs`
- `node_modules/ai-providers/providers/openrouter.cjs`
