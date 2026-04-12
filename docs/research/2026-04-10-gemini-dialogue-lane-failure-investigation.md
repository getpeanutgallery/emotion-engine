# Gemini 3.1 Pro Preview Dialogue-Only Lane Failure Investigation

**Date:** 2026-04-10  
**Config:** `configs/cod-dialogue-compare-gemini-3.1-pro-preview.yaml`  
**Bead:** `ee-xdy8`

## Artifacts Reviewed

- `.logs/2026-04-10-cod-dialogue-compare-gemini-3.1-pro-preview-ee-1gs4.log`
- `.logs/2026-04-10-cod-dialogue-compare-gemini-3.1-pro-preview-ee-1gs4-retry1.log`
- `.logs/2026-04-10-cod-dialogue-compare-gemini-3.1-pro-preview-ee-1gs4-retry2.log`
- `output/cod-dialogue-compare-gemini-3.1-pro-preview/phase1-gather-context/script-results/get-dialogue.failure.json`
- `output/cod-dialogue-compare-gemini-3.1-pro-preview/phase1-gather-context/raw/_meta/errors.summary.json`
- `output/cod-dialogue-compare-gemini-3.1-pro-preview/phase1-gather-context/recovery/get-dialogue/lineage.json`
- `output/cod-dialogue-compare-gemini-3.1-pro-preview/phase1-gather-context/recovery/get-dialogue/next-action.json`
- `output/cod-dialogue-compare-gemini-3.1-pro-preview/phase1-gather-context/raw/ai/dialogue-transcription/attempt-01/capture.json`

## Failure Timeline Across Attempts

1. **Initial run** (`...ee-1gs4.log`, mtime ~11:07 ET)
   - Fails in Phase 1 `get-dialogue` with **transport-level error**: `OpenRouter: aborted`.
   - Stack trace points to `axios` stream abort path inside `ai-providers/providers/openrouter.cjs`.

2. **Retry 1** (`...ee-1gs4-retry1.log`, mtime ~11:12 ET)
   - Fails again in Phase 1 `get-dialogue` with **provider response-shape/transport error**: `OpenRouter: No content in response`.
   - Error emitted from `transformResponse` in OpenRouter provider adapter.

3. **Retry 2** (`...ee-1gs4-retry2.log`, mtime ~11:20 ET)
   - Transport succeeds far enough to enter local validator tool loop.
   - Final failure: `invalid_output: dialogue transcription tool loop exhausted after 4 turns`.
   - Persisted as `GET_DIALOGUE_INVALID_OUTPUT` in `get-dialogue.failure.json` with deterministic recovery suggesting `retry-with-lower-thinking` next.

## Dominant Failure Modes

### 1) OpenRouter transport/provider instability (2 of 3 runs)
- `OpenRouter: aborted`
- `OpenRouter: No content in response`

These occurred before useful structured-output convergence and indicate an upstream request/response reliability problem for this lane.

### 2) Schema/tool-loop non-convergence after transport recovered (1 of 3 runs)
In the successful transport attempt, the model repeatedly missed the `acoustic_descriptors` contract:
- Turn 1 and 3: entries treated as strings (`invalid_type`, expected objects)
- Turn 2 and 4: entries switched to objects but with `value` field and **missing required `label`** (`required_string`)

Tool-loop history shows 4 validator-rejection cycles without convergence, then hard stop.

## Root-Cause Hypothesis

Primary cause is **mixed**:

1. **OpenRouter+Gemini preview transport fragility** in this exact whole-asset audio lane (aborted/no-content twice).  
2. **Contract-following mismatch** between the dialogue prompt/schema and Gemini response tendencies once transport works.

Important nuance: the prompt text in this lane demonstrates `acoustic_descriptors` as string array in one place, while validator expects descriptor objects with required `label`. GPT Audio succeeded in this repo despite that tension, but Gemini oscillated between string form and object-with-`value` form, never satisfying the strict validator.

## Is this Gemini-specific, OpenRouter-specific, or our config/contract?

- **Not purely config fatal**, since another model lane (`cod-dialogue-compare-gpt-audio`) completes under the same broader pipeline/contract family.
- **Likely partly OpenRouter transport-specific** for this model pairing, due to repeated abort/no-content failures.
- **Likely partly Gemini 3.1 Pro Preview behavior-specific** on strict JSON repair loops (oscillation between two near-miss shapes).
- **Also partly our prompt/contract ergonomics** (ambiguous descriptor shape examples increase risk of loop churn).

So this is best treated as an **interaction failure** (Gemini preview + OpenRouter transport + brittle schema prompt alignment), not a single-point defect.

## Concrete Next Fixes / Experiments

1. **Fix prompt/schema alignment first (low cost, high leverage)**
   - Make every `acoustic_descriptors` example use canonical object form with required `label`.
   - Add an explicit “DO NOT use `value`; use `label`” line in repair instructions.

2. **Improve validator repair guidance**
   - On `required_string` at `*.label`, inject a one-line minimal patch instruction plus micro-example.
   - Consider adding one deterministic normalizer pass for `{ value: "..." } -> { label: "..." }` before rejecting.

3. **Reduce generation volatility for Gemini retry lane**
   - Run the suggested deterministic recovery path (`retry-with-lower-thinking`).
   - Optionally reduce output/token budget to discourage overlong structured responses and reduce transport stress.

4. **Isolate transport vs model behavior**
   - Re-run the same config/model directly (same prompt) 3-5 times to measure abort/no-content rate.
   - If available, run same Gemini model through a non-OpenRouter adapter for A/B.

## Recommendation: Is Gemini Worth Retrying Here?

**Yes, but only as a controlled retry experiment, not as current production winner.**

Recommended retry gate:
- Apply prompt/schema fix first.
- Re-run with lower-thinking deterministic retry enabled.
- Require at least 2 consecutive successful `get-dialogue` completions before considering Gemini comparable in this lane.

Without those fixes, failure probability appears high and the lane remains non-rankable for benchmark comparison.