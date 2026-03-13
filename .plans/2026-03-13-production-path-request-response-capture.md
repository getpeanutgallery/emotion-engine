# emotion-engine: capture exact production request/response for Phase 3 recommendation

**Date:** 2026-03-13  
**Status:** Complete  
**Agent:** Cookie 🍪

---

## Goal

Instrument the real `recommendation.cjs` production path so we can capture the exact provider request payload and the full raw OpenRouter response before transform/extraction, then rerun Phase 3-only and compare raw vs extracted behavior.

---

## Overview

This lane stayed on the real production recommendation path used by `configs/cod-test-phase3.yaml`: `server/scripts/report/recommendation.cjs` → `server/lib/ai-targets.cjs` provider resolution → installed `ai-providers` OpenRouter adapter at `node_modules/ai-providers/providers/openrouter.cjs`.

The narrowest useful instrumentation point turned out to be the OpenRouter adapter response transform boundary. That is the last place where both the exact final request object and the untouched provider HTTP response body are available together before `recommendation.cjs` only sees the extracted `{ content, usage }` shape. I added those fields to the provider result and then persisted them in the existing recommendation attempt capture payloads.

I also mirrored the adapter change into the source repo copy at `../ai-providers/providers/openrouter.cjs` so the instrumentation is documented in the real provider repo, even though the live run in this worktree executed the installed dependency under `node_modules/`.

---

## Tasks

### Task 1: Inspect the live production call path and define capture points

**Bead ID:** `ee-jmi`  
**SubAgent:** `main`

**Folders Created/Deleted/Modified:**
- `output/`
- `server/`
- `node_modules/ai-providers/`
- `../ai-providers/`

**Files Created/Deleted/Modified:**
- `server/scripts/report/recommendation.cjs`
- `node_modules/ai-providers/providers/openrouter.cjs`
- `../ai-providers/providers/openrouter.cjs`
- `.plans/2026-03-13-production-path-request-response-capture.md`

**Status:** ✅ Complete

**Results:**
- Verified the live Phase 3 call path is:
  - `server/scripts/report/recommendation.cjs`
  - `executeWithTargets(...)` / `getProviderForTarget(...)` from `server/lib/ai-targets.cjs`
  - installed OpenRouter adapter at `node_modules/ai-providers/providers/openrouter.cjs`
- Identified the narrowest safe capture point as `transformResponse(axiosResponse, request)` inside the OpenRouter adapter, because it has:
  - the exact final request object produced by `buildRequest(...)`
  - the full raw `axiosResponse.data` body before `extractTextFromContent(...)`
- Determined that `recommendation.cjs` already writes per-attempt raw capture payloads, so the minimum integration was to surface `providerRequest` + `providerResponse` from the provider result and persist them there.

---

### Task 2: Add raw request/response capture without changing the recommendation protocol

**Bead ID:** `ee-jmi`  
**SubAgent:** `main`

**Folders Created/Deleted/Modified:**
- `server/`
- `node_modules/ai-providers/`
- `../ai-providers/`

**Files Created/Deleted/Modified:**
- `server/scripts/report/recommendation.cjs`
- `node_modules/ai-providers/providers/openrouter.cjs`
- `../ai-providers/providers/openrouter.cjs`
- `test/ai-providers/openrouter.test.js`
- `test/scripts/recommendation.test.js`
- `.plans/2026-03-13-production-path-request-response-capture.md`

**Status:** ✅ Complete

**Results:**
- In `node_modules/ai-providers/providers/openrouter.cjs`:
  - extended `transformResponse(...)` to include:
    - `providerRequest: { method, url, headers, body }`
    - `providerResponse: { status, headers, body }`
  - attached the same fields to the `OpenRouterNoContentError` path so failed attempts can still preserve the request/response boundary when content extraction fails
- Mirrored that same adapter change into `../ai-providers/providers/openrouter.cjs` for durability in the dependency source repo
- In `server/scripts/report/recommendation.cjs`:
  - extended `writeRecommendationRaw(...)` payloads to persist top-level `providerRequest` and `providerResponse` alongside the existing `rawResponse`, `parseMeta`, `validation`, and `toolLoop` fields
- Did **not** redesign the prompt, switch providers, or alter tool-loop semantics
- Validation run:
  - `node test/ai-providers/openrouter.test.js`
  - `node --test test/scripts/recommendation.test.js`
  - Result: passing (`9/9` provider tests, `12/12` recommendation tests)

---

### Task 3: Rerun Phase 3-only through the real production path and collect evidence

**Bead ID:** `ee-jmi`  
**SubAgent:** `main`

**Folders Created/Deleted/Modified:**
- `output/`
- `.plans/`

**Files Created/Deleted/Modified:**
- `output/_logs/phase3-production-path-capture-20260313-093403.log`
- `output/cod-test/phase3-report/raw/ai/recommendation/attempt-01/capture.json`
- `output/cod-test/phase3-report/raw/ai/recommendation/attempt-02/capture.json`
- `output/cod-test/phase3-report/raw/ai/recommendation/attempt-03/capture.json`
- `output/cod-test/phase3-report/raw/ai/recommendation/recommendation.json`
- `output/cod-test/phase3-report/raw/_meta/errors.summary.json`
- `output/cod-test/raw/_meta/events.jsonl`
- `.plans/2026-03-13-production-path-request-response-capture.md`

**Status:** ✅ Complete

**Results:**
- Real Phase 3-only rerun command:
  - `AI_API_KEY="$OPENROUTER_API_KEY" node server/run-pipeline.cjs --config configs/cod-test-phase3.yaml --verbose`
- Console/log artifact:
  - `output/_logs/phase3-production-path-capture-20260313-093403.log`
- Outcome:
  - Phase 3 recommendation still failed after 3 attempts
  - error: `Recommendation generation failed after 3 attempts: invalid_output: response was not valid JSON`
  - provider/model remained `openrouter / google/gemini-3.1-pro-preview`

**Concrete comparison from the new artifacts:**

| Attempt | finish_reason | extracted content length | raw provider `message.reasoning` length | completion tokens | key observation |
|---|---:|---:|---:|---:|---|
| 1 | `length` | 163 | 1299 | 896 | `message.content` starts as the canonical validator envelope, then truncates mid-string |
| 2 | `length` | 174 | 1106 | 896 | `message.content` is non-JSON prose fragment while separate reasoning text is still present |
| 3 | `length` | 117 | 1128 | 896 | `message.content` again starts as JSON, then truncates mid-string |

**What the artifacts prove:**
- `providerRequest.body` now shows the exact final request payload that was sent:
  - model: `google/gemini-3.1-pro-preview`
  - one `user` message containing the full tool-loop prompt text
  - `temperature: 0.2`
  - `max_tokens: 900`
- `providerResponse.body` shows the untouched 200-response before extraction, including:
  - `choices[0].message.content`
  - `choices[0].message.reasoning`
  - `choices[0].message.reasoning_details`
  - `usage.completion_tokens = 896`
  - `usage.completion_tokens_details.reasoning_tokens ≈ 860+`
- `rawResponse.content` in the capture equals `providerResponse.body.choices[0].message.content` exactly on all three attempts
- `recommendation.cjs` is therefore **not dropping valid JSON from some alternate field after extraction**; it is faithfully receiving the already-bad / truncated `message.content`
- The large token count is explained by the provider returning substantial hidden/auxiliary reasoning data while `message.content` remains short and truncated; the output token spend is **not** evidence that the actual final JSON existed intact in some extracted field that `recommendation.cjs` lost

**Artifact excerpts worth checking first:**
- `output/cod-test/phase3-report/raw/ai/recommendation/attempt-01/capture.json`
  - `providerRequest.body`
  - `providerResponse.body.choices[0].message.content`
  - `providerResponse.body.choices[0].message.reasoning`
  - `providerResponse.body.usage`
- `output/cod-test/phase3-report/raw/ai/recommendation/attempt-02/capture.json`
  - same fields; shows prose fragment instead of JSON in `message.content`
- `output/cod-test/phase3-report/raw/ai/recommendation/attempt-03/capture.json`
  - same fields; shows second JSON-start truncation

---

### Task 4: Summarize root-cause evidence and recommend the next fix for `ee-5dv`

**Bead ID:** `ee-jmi`  
**SubAgent:** `main`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `output/`

**Files Created/Deleted/Modified:**
- `.plans/2026-03-13-production-path-request-response-capture.md`
- new output artifacts under `output/`

**Status:** ✅ Complete

**Results:**
- Root-cause evidence now points away from a local extraction bug in `recommendation.cjs`
- The production path is receiving truncated / malformed `message.content` directly from OpenRouter/Gemini on the real lane
- The provider response body also contains a separate `message.reasoning` field and `reasoning_details`, which explains the high output token counts despite tiny unusable `message.content` strings

**Recommended next fix for `ee-5dv`:**
1. Treat this as a **provider/model response-shape reliability issue on the real lane**, not as a missing local extraction field in `recommendation.cjs`
2. Next lane should be a minimal mitigation, in this order:
   - first try a different recommendation target/model on the same production path
   - or force a provider mode / parameter that suppresses reasoning-heavy output if OpenRouter/Gemini supports it for this model
   - only if we intentionally choose to support this response shape, add a narrowly-scoped extraction fallback for provider-specific alternate text fields — but the current artifacts do **not** show a complete valid final JSON hiding in `message.reasoning`
3. Do **not** run full `cod-test` yet; Phase 3-only remains red and the evidence still shows upstream malformed/truncated `message.content`

---

## Success Criteria

- [x] We captured the exact final request payload used for the real recommendation call.
- [x] We captured the full raw OpenRouter response body before transform/extraction.
- [x] We reran the real Phase 3-only lane and preserved artifacts from that exact run.
- [x] We compared raw provider output, extracted content, and usage in one place.
- [x] We produced evidence strong enough to choose the next engineering fix without relying on surrogate behavior.

---

## Final Results

**Status:** ✅ Complete

**What We Built:**
- Production-path instrumentation for the Phase 3 recommendation lane that now persists:
  - exact final OpenRouter request payload
  - full raw provider response body before extraction
- Fresh Phase 3-only production artifacts showing that the bad/truncated JSON is already present in provider `message.content`

**Changed Files:**
- `server/scripts/report/recommendation.cjs`
- `node_modules/ai-providers/providers/openrouter.cjs` *(live runtime copy used for the rerun)*
- `../ai-providers/providers/openrouter.cjs` *(mirrored source-repo copy for durability)*
- `test/ai-providers/openrouter.test.js`
- `test/scripts/recommendation.test.js`
- `.plans/2026-03-13-production-path-request-response-capture.md`

**Artifacts:**
- `output/_logs/phase3-production-path-capture-20260313-093403.log`
- `output/cod-test/phase3-report/raw/ai/recommendation/attempt-01/capture.json`
- `output/cod-test/phase3-report/raw/ai/recommendation/attempt-02/capture.json`
- `output/cod-test/phase3-report/raw/ai/recommendation/attempt-03/capture.json`
- `output/cod-test/phase3-report/raw/ai/recommendation/recommendation.json`
- `output/cod-test/phase3-report/raw/_meta/errors.summary.json`
- `output/cod-test/raw/_meta/events.jsonl`

**Commits:**
- None created in this subagent lane.

**Lessons Learned:**
- The missing observability gap was real; without the raw provider body, the output-token counts made the failure look like a local extraction problem.
- With the new capture in place, the evidence is much cleaner: `message.content` itself is malformed/truncated while separate reasoning payloads consume most of the completion tokens.

---

*Completed on 2026-03-13*
