# emotion-engine: expose thinking level and token budget controls in YAML

**Date:** 2026-03-13  
**Status:** Complete  
**Agent:** Cookie 🍪

---

## Goal

Allow pipeline authors to configure normalized per-target output token budgets and thinking intensity in YAML, have those values reach the real provider request path, and verify the live recommendation lane with captured request artifacts.

---

## Overview

This lane standardized the user-facing YAML shape on `ai.<domain>.targets[].adapter.params.max_tokens` and `ai.<domain>.targets[].adapter.params.thinking.level` while keeping existing adapter passthrough behavior intact. The implementation work landed primarily in `server/lib/ai-targets.cjs`, where normalized params are translated into provider options before downstream scripts call `provider.complete(...)`.

The first audit showed that emotion-engine was already forwarding normalized `max_tokens` into provider options and converting `thinking.level` into an OpenRouter-oriented `options.reasoning` object, but the installed OpenRouter adapter did **not** yet serialize `options.reasoning` into the final HTTP request body. That meant unit-level option forwarding worked while the real provider request capture only proved `max_tokens`. I patched that missing provider mapping in the live dependency copy used by this repo and in the sibling provider source repo mirror, then reran the real Phase 3 recommendation lane to prove both values appear in captured provider requests.

The real recommendation lane still fails because Gemini/OpenRouter continues to truncate the JSON response at the token ceiling, but the observability is now correct and the normalized YAML controls are verifiably end-to-end.

---

## Tasks

### Task 1: Audit the config-to-provider path for adapter params

**Bead ID:** `ee-9gp`  
**SubAgent:** `main`

**Folders Created/Deleted/Modified:**
- `server/`
- `.plans/`

**Files Created/Deleted/Modified:**
- `server/lib/ai-targets.cjs`
- `server/scripts/get-context/get-dialogue.cjs`
- `server/scripts/get-context/get-music.cjs`
- `server/scripts/report/recommendation.cjs`
- `.plans/2026-03-13-yaml-configurable-thinking-and-token-budgets.md`

**Status:** ✅ Complete

**Results:**
- Audited the active code path and kept the already-landed normalization helpers in `server/lib/ai-targets.cjs`:
  - `normalizeThinkingLevel(...)`
  - `normalizeAdapterParamsForProvider(...)`
  - `buildProviderOptions(...)`
- Confirmed normalized behavior in emotion-engine:
  - `params.max_tokens` → provider option `maxTokens`
  - `params.thinking.level` → OpenRouter-oriented provider option `reasoning: { effort, enabled }`
- Confirmed downstream scripts now use the shared helper instead of hand-merging raw adapter params:
  - `server/scripts/get-context/get-dialogue.cjs`
  - `server/scripts/get-context/get-music.cjs`
  - `server/scripts/report/recommendation.cjs`
- Confirmed recommendation raw captures already persist `providerRequest` and `providerResponse`, making them the right proof point for end-to-end verification.

---

### Task 2: Define the YAML contract for token and thinking controls

**Bead ID:** `ee-9gp`  
**SubAgent:** `main`

**Folders Created/Deleted/Modified:**
- `docs/`
- `configs/`
- `.plans/`

**Files Created/Deleted/Modified:**
- `docs/CONFIG-GUIDE.md`
- `docs/DEBUG-CONFIG.md`
- `configs/example-pipeline.yaml`
- `configs/cod-test-phase3.yaml`
- `.plans/2026-03-13-yaml-configurable-thinking-and-token-budgets.md`

**Status:** ✅ Complete

**Results:**
- Documented the normalized YAML shape in `docs/CONFIG-GUIDE.md`:

```yaml
ai:
  recommendation:
    targets:
      - adapter:
          name: openrouter
          model: google/gemini-3.1-pro-preview
          params:
            max_tokens: 900
            thinking:
              level: low
```

- Documented normalized semantics:
  - `max_tokens` is the normalized output token budget
  - `thinking.level` is the normalized reasoning intensity enum: `off | low | medium | high`
  - OpenRouter mapping is currently:
    - `off` → `reasoning: { effort: 'none', enabled: false }`
    - `low|medium|high` → `reasoning: { effort: <level>, enabled: true }`
- Updated docs/debug guidance so recommendation raw captures explicitly point readers to `providerRequest` / `providerResponse` as the canonical verification surface.
- Updated config examples:
  - `configs/example-pipeline.yaml`
  - `configs/cod-test-phase3.yaml`

---

### Task 3: Implement provider request mapping for the supported controls

**Bead ID:** `ee-9gp`  
**SubAgent:** `main`

**Folders Created/Deleted/Modified:**
- `server/`
- `node_modules/ai-providers/`
- `../ai-providers/`
- `.plans/`

**Files Created/Deleted/Modified:**
- `server/lib/ai-targets.cjs`
- `server/scripts/get-context/get-dialogue.cjs`
- `server/scripts/get-context/get-music.cjs`
- `server/scripts/report/recommendation.cjs`
- `node_modules/ai-providers/providers/openrouter.cjs`
- `../ai-providers/providers/openrouter.cjs`
- `.plans/2026-03-13-yaml-configurable-thinking-and-token-budgets.md`

**Status:** ✅ Complete

**Results:**
- Kept/finalized the shared normalization layer in emotion-engine.
- Fixed the missing end-to-end provider mapping in the OpenRouter adapter:
  - before fix: `providerOptions.reasoning` was accepted by emotion-engine but never serialized into `requestBody.reasoning`
  - after fix: OpenRouter `buildRequest(...)` now emits:

```json
{
  "max_tokens": 900,
  "reasoning": { "effort": "low", "enabled": true }
}
```

- Mirrored the same adapter change into the sibling source repo at `../ai-providers/providers/openrouter.cjs` for durability.

---

### Task 4: Add validation, fixtures, and docs

**Bead ID:** `ee-9gp`  
**SubAgent:** `main`

**Folders Created/Deleted/Modified:**
- `test/`
- `configs/`
- `docs/`
- `.plans/`

**Files Created/Deleted/Modified:**
- `test/lib/ai-targets.test.js`
- `test/pipeline/config-loader.test.js`
- `test/scripts/recommendation.test.js`
- `test/ai-providers/openrouter.test.js`
- `docs/CONFIG-GUIDE.md`
- `docs/DEBUG-CONFIG.md`
- `configs/example-pipeline.yaml`
- `configs/cod-test-phase3.yaml`
- `.plans/2026-03-13-yaml-configurable-thinking-and-token-budgets.md`

**Status:** ✅ Complete

**Results:**
- Added focused helper coverage in `test/lib/ai-targets.test.js` for:
  - normalized level parsing
  - `max_tokens` → `maxTokens`
  - `thinking.level` → `reasoning`
  - `thinking.off` semantics
  - default merge behavior
- Added config-loader coverage to prove normalized adapter params are allowed as plain objects.
- Updated recommendation script tests to verify normalized params reach `provider.complete(...).options`, including `reasoning`.
- Kept provider tests green after request/response capture and request-body mapping changes.

**Tests Run:**
- `node test/ai-providers/openrouter.test.js`
- `node --test test/lib/ai-targets.test.js`
- `node --test test/pipeline/config-loader.test.js`
- `node --test test/scripts/recommendation.test.js`
- `node --test test/lib/ai-targets.test.js test/scripts/recommendation.test.js test/pipeline/config-loader.test.js`

All targeted tests passed.

---

### Task 5: Verify with a recommendation-lane config and document the outcome

**Bead ID:** `ee-9gp`  
**SubAgent:** `main`

**Folders Created/Deleted/Modified:**
- `output/`
- `.plans/`

**Files Created/Deleted/Modified:**
- `output/_logs/phase3-thinking-token-verify-20260313-103628.log`
- `output/_logs/phase3-thinking-token-verify-rerun-20260313-103829.log`
- `output/cod-test/phase3-report/raw/ai/recommendation/attempt-01/capture.json`
- `output/cod-test/phase3-report/raw/ai/recommendation/attempt-02/capture.json`
- `output/cod-test/phase3-report/raw/ai/recommendation/attempt-03/capture.json`
- `output/cod-test/phase3-report/raw/ai/recommendation/recommendation.json`
- `.plans/2026-03-13-yaml-configurable-thinking-and-token-budgets.md`

**Status:** ✅ Complete

**Results:**
- Real verification command (Phase 3 only, production path, no cod-test):
  - `AI_API_KEY="$OPENROUTER_API_KEY" node server/run-pipeline.cjs --config configs/cod-test-phase3.yaml --verbose`
- First live run (`output/_logs/phase3-thinking-token-verify-20260313-103628.log`) proved:
  - `providerRequest.body.max_tokens = 900`
  - but `providerRequest.body.reasoning` was missing
  - this exposed the missing serialization bug in the installed OpenRouter adapter
- After patching the OpenRouter adapter, second live run (`output/_logs/phase3-thinking-token-verify-rerun-20260313-103829.log`) proved across all three captured attempts:

```json
{
  "max_tokens": 900,
  "reasoning": { "effort": "low", "enabled": true }
}
```

- Concrete captured evidence from rerun artifacts:
  - `output/cod-test/phase3-report/raw/ai/recommendation/attempt-01/capture.json`
  - `output/cod-test/phase3-report/raw/ai/recommendation/attempt-02/capture.json`
  - `output/cod-test/phase3-report/raw/ai/recommendation/attempt-03/capture.json`
- Extracted verification summary from the rerun:
  - Attempt 1: `max_tokens=900`, `reasoning={effort:"low",enabled:true}`, `finish_reason="length"`, `completion_tokens=896`, `reasoning_tokens=860`
  - Attempt 2: `max_tokens=900`, `reasoning={effort:"low",enabled:true}`, `finish_reason="length"`, `completion_tokens=896`, `reasoning_tokens=861`
  - Attempt 3: `max_tokens=900`, `reasoning={effort:"low",enabled:true}`, `finish_reason="length"`, `completion_tokens=896`, `reasoning_tokens=863`
- Outcome:
  - The normalized YAML controls are now verifiably present in the live provider request payloads.
  - The recommendation lane still fails due to truncated non-JSON output from the provider/model path (`finish_reason: length` on every attempt), so this lane improved control + observability but did not resolve the upstream JSON truncation problem.

---

## Success Criteria

- [x] YAML can express per-target token budget and thinking/reasoning controls.
- [x] The chosen config shape is documented and tested.
- [x] Provider request payloads reflect the configured values on the real recommendation lane.
- [x] Existing configs continue to work when the new fields are omitted.
- [x] Verification used captured real request artifacts instead of inference.

---

## Final Results

**Status:** ✅ Complete

**What We Built:**
- Normalized YAML controls for:
  - `ai.<domain>.targets[].adapter.params.max_tokens`
  - `ai.<domain>.targets[].adapter.params.thinking.level`
- Shared translation helpers in emotion-engine for provider option construction.
- OpenRouter request-body serialization for normalized reasoning controls.
- Focused tests, docs, and config examples.
- Live recommendation-lane proof that both normalized values appear in captured provider requests.

**Changed Files:**
- `server/lib/ai-targets.cjs`
- `server/scripts/get-context/get-dialogue.cjs`
- `server/scripts/get-context/get-music.cjs`
- `server/scripts/report/recommendation.cjs`
- `test/lib/ai-targets.test.js`
- `test/pipeline/config-loader.test.js`
- `test/scripts/recommendation.test.js`
- `test/ai-providers/openrouter.test.js`
- `docs/CONFIG-GUIDE.md`
- `docs/DEBUG-CONFIG.md`
- `configs/example-pipeline.yaml`
- `configs/cod-test-phase3.yaml`
- `node_modules/ai-providers/providers/openrouter.cjs` *(live runtime dependency copy used by the verification run)*
- `../ai-providers/providers/openrouter.cjs` *(mirrored source repo copy)*
- `.plans/2026-03-13-yaml-configurable-thinking-and-token-budgets.md`

**Artifacts:**
- `output/_logs/phase3-thinking-token-verify-20260313-103628.log`
- `output/_logs/phase3-thinking-token-verify-rerun-20260313-103829.log`
- `output/cod-test/phase3-report/raw/ai/recommendation/attempt-01/capture.json`
- `output/cod-test/phase3-report/raw/ai/recommendation/attempt-02/capture.json`
- `output/cod-test/phase3-report/raw/ai/recommendation/attempt-03/capture.json`
- `output/cod-test/phase3-report/raw/ai/recommendation/recommendation.json`

**Commits:**
- None created in this subagent lane.

**Lessons Learned:**
- The normalization work in emotion-engine was mostly correct before this pass; the missing gap was the final OpenRouter request-body serialization for `reasoning`.
- Live request capture was essential. Unit tests alone would have made the lane look complete while the real provider request still omitted the normalized thinking control.
- Lowering normalized thinking to `low` did not fix the recommendation truncation problem; the real lane still spends ~860 reasoning tokens out of 896 completion tokens and exits with `finish_reason: length`.

---

*Completed on 2026-03-13*
