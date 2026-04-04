# emotion-engine: debug OpenRouter no-content failure and digital-twin leakage

**Date:** 2026-04-03
**Status:** In Progress
**Agent:** Cookie 🍪

---

## Goal

Determine why the latest bounded Xiaomi/OpenRouter rerun failed with `OpenRouter: No content in response` and why digital-twin record-mode behavior still appeared during the supposedly clean live rerun, then identify the smallest truthful fix lane.

---

## Overview

The dialogue coverage honesty fix landed and passed focused tests, but the next live Xiaomi/OpenRouter rerun failed before it could prove the new artifact semantics end to end. The failure moved upstream: `get-dialogue` returned `OpenRouter: No content in response`, with a raw capture showing no usable content and an internal-server-error style body. At the same time, the run unexpectedly logged digital-twin router record-mode behavior even though the wrapper explicitly unset several digital-twin environment variables before invoking the pipeline.

Those two anomalies may be unrelated, but they both undermine trust in the rerun as a clean live verification of the new coverage semantics. The first question is whether digital-twin/cassette mode is actually still influencing the run through some other env/config path, sourced shell helper, npm script wrapper, or inherited runtime setting. The second question is whether the no-content failure is a real upstream provider issue, a local wrapper/request-shape issue, or a side effect of record-mode interception.

This tranche should stay review-only. We should inspect the failing artifacts, npm/pipeline launch path, env/config seams, and digital-twin router wiring before making changes. The output should be a precise diagnosis and the smallest recommended next implementation lane.

---

## Tasks

### Task 1: Audit the failing Xiaomi/OpenRouter no-content run artifacts and request path

**Bead ID:** `ee-slo0`
**SubAgent:** `research`
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, inspect the latest bounded Xiaomi/OpenRouter rerun failure artifacts to determine what actually happened during the 'OpenRouter: No content in response' failure. Use the fresh logs, events, failure envelope, and raw capture to identify the exact request/response path, whether any content was returned, and whether the failure looks upstream, wrapper-induced, or interception-related. Update the active plan with exact evidence. This is review-only: do not modify code or prompts. Claim bead ee-slo0 on start with bd update ee-slo0 --status in_progress --json and close it on completion with bd close ee-slo0 --reason "Audited Xiaomi/OpenRouter no-content failure artifacts" --json.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `.logs/`
- `output/`
- optional `docs/research/`

**Files Created/Deleted/Modified:**
- `.plans/2026-04-03-openrouter-no-content-and-digital-twin-leakage-debug.md`

**Status:** ✅ Complete

**Results:** Audited the latest failing rerun artifacts in `output/cod-test-xiaomi-mimo-v2-omni-openrouter-high-thinking-rerun/` and the matching launcher log `.logs/2026-04-03-151155-cod-test-xiaomi-mimo-v2-omni-openrouter-high-thinking-rerun-ee-scid.log`.

Evidence:
- The failing call path was `get-dialogue` → local validator tool loop → `openrouter` adapter → `digital-twin-router` transport seam → `POST https://openrouter.ai/api/v1/chat/completions` with model `xiaomi/mimo-v2-omni`, content types `text` + `input_audio`, `thinking.level=high`, and prompt ref `_meta/ai/_prompts/d5e8ebc8...json`.
- `_meta/events.jsonl` shows the request started at `2026-04-03T19:12:00.161Z` and failed at `2026-04-03T19:14:03.848Z` after a single provider await on tool-loop turn 1. There is no `tool.loop.provider.await.end` or `tool.loop.complete` event before failure, so the model never returned a usable tool call or final JSON artifact.
- The failure envelope `phase1-gather-context/script-results/get-dialogue.failure.json` classifies the run as `invalid_response/no_content` with message `OpenRouter: No content in response`, `retryable=false`, and request id `9e6a61e26a0f42f0-MIA`.
- The raw capture pointer `phase1-gather-context/raw/ai/dialogue-transcription.json` resolves to `dialogue-transcription/attempt-01/capture.json`, where `rawResponse`, `parsed`, and `toolLoop` are all `null`. That means no assistant content was accepted by the wrapper.
- However, the same capture preserves `errorDebug.response.body` and `errorResponse` showing a body was returned: `{ "error": { "message": "Internal Server Error", "code": 500 } }`, while the HTTP status was still `200` and header `cf-ray` was `9e6a61e26a0f42f0-MIA`.
- So content **was not** returned, but a provider error payload **was** returned inside a 200 response. The wrapper then surfaced that malformed success/error hybrid as `OpenRouter: No content in response`.
- This looks primarily upstream/provider-side (or OpenRouter edge/provider integration) rather than prompt-shape drift: the immediately earlier successful run in `output/_archives/cod-test-xiaomi-mimo-v2-omni-openrouter-high-thinking-rerun-pre-ee-scid-2026-04-03-151155/` used the same prompt ref `d5e8ebc8...`, same model, same request path, and received normal assistant content plus a completed tool loop.
- This does **not** currently look like a digital-twin interception artifact causing the empty content by itself. The same digital-twin record logging appears in the earlier successful run (`.logs/2026-04-03-105416-cod-test-xiaomi-mimo-v2-omni-openrouter-high-thinking-rerun-ee-j1en.log`), while the failing capture still shows a real OpenRouter request/response pair rather than a cassette-only synthetic payload.
- The wrapper may still deserve a follow-up for error classification quality, because the user-visible message says `No content` even though the preserved body clearly contains an upstream error object.

---

### Task 2: Audit the digital-twin/record-mode activation path and explain why it still appeared in the live rerun

**Bead ID:** `ee-ddr1`  
**SubAgent:** `research`  
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, inspect the npm/pipeline launch path, environment/config seams, and digital-twin router wiring to determine why record-mode / cassette logging still appeared even after the rerun wrapper unset DIGITAL_TWIN_MODE, DIGITAL_TWIN_PACK, DIGITAL_TWIN_CASSETTE, and OPENROUTER_TIMEOUT_MS. Identify the exact activation source if possible and update the active plan with the evidence. This is review-only: do not modify code or prompts. Claim bead ee-ddr1 on start with bd update ee-ddr1 --status in_progress --json and close it on completion with bd close ee-ddr1 --reason "Audited digital-twin record-mode activation leakage" --json.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `server/`
- `package.json`
- optional `.env*`
- optional `scripts/`

**Files Created/Deleted/Modified:**
- `.plans/2026-04-03-openrouter-no-content-and-digital-twin-leakage-debug.md`

**Status:** ✅ Complete

**Results:** Traced the activation path and the record-mode leakage is not coming from `npm run pipeline`, the YAML config, or a hidden router default. It is being re-enabled by the repo-local `.env` file itself, and in this specific rerun the wrapper re-imported that file immediately after unsetting the vars. Exact evidence chain:

- The recorded rerun wrapper in `.plans/2026-04-03-dialogue-coverage-honesty-fix-and-rerun.md` ran:
  - `unset DIGITAL_TWIN_MODE DIGITAL_TWIN_PACK DIGITAL_TWIN_CASSETTE OPENROUTER_TIMEOUT_MS || true; set -a; [ -f .env ] && . ./.env; set +a; npm run pipeline -- --config configs/cod-test-xiaomi-mimo-v2-omni-openrouter-high-thinking-rerun.yaml`
  - so the unset was immediately undone by sourcing `.env` into the shell environment before Node started.
- Current repo-local `.env:5-8` explicitly defines the same digital-twin record-mode state:
  - `DIGITAL_TWIN_MODE=record`
  - `DIGITAL_TWIN_PACK=/home/derrick/.openclaw/workspace/projects/peanut-gallery/digital-twin-openrouter-emotion-engine`
  - `DIGITAL_TWIN_CASSETTE=cod-test-record-20260318-202023`
- `package.json` proves the npm layer is only a thin wrapper: `scripts.pipeline = "node server/run-pipeline.cjs"`. `bin/run-pipeline.js` is also just a direct spawn of `server/run-pipeline.cjs`. No digital-twin vars are injected there.
- `server/run-pipeline.cjs` always calls `require('dotenv').config()` at startup, so even without the shell `set -a && . ./.env` step, the same `.env` file would still repopulate the digital-twin vars unless the file contents changed or dotenv loading was bypassed/overridden. The fresh log `.logs/2026-04-03-151155-cod-test-xiaomi-mimo-v2-omni-openrouter-high-thinking-rerun-ee-scid.log:5` shows `[dotenv@17.3.1] injecting env (0) from .env`, which is consistent with the shell already having loaded the `.env` values before Node started.
- The runtime evidence matches that activation source exactly:
  - `.logs/2026-04-03-151155-cod-test-xiaomi-mimo-v2-omni-openrouter-high-thinking-rerun-ee-scid.log:22` prints `[digital-twin-router] record.realTransport.await.start cassette=cod-test-record-20260318-202023`
  - `output/cod-test-xiaomi-mimo-v2-omni-openrouter-high-thinking-rerun/_meta/events.jsonl:1-20` reports `mode:"record"` from `run.start` through `run.end`
  - the cassette id in the router log is the same stale cassette id hardcoded in `.env`, which ties the active behavior back to that file rather than to config/YAML state.
- The provider seam confirms why this matters. The installed OpenRouter provider at `node_modules/.pnpm/ai-providers@https+++codeload.github.com+getpeanutgallery+ai-providers+tar.gz+79838d5cf1d3acf77cf8f9b0ac5823a43085d1ec/node_modules/ai-providers/providers/openrouter.cjs` only enters `digital-twin-router` when `NODE_ENV === 'test' || !!process.env.DIGITAL_TWIN_MODE`, and then requires `DIGITAL_TWIN_PACK`. `server/providers/xiaomi.cjs` uses the same gate shape. So once `.env` repopulates `DIGITAL_TWIN_MODE`, record-mode interception is expected behavior, not a separate hidden bug.
- `OPENROUTER_TIMEOUT_MS` followed the same pattern conceptually: the wrapper unset it, but the real surprising vars were the digital-twin values in `.env`. In this specific failing rerun, the active attempt already had `adapter.params.timeoutMs: 180000` in `_meta/events.jsonl:7`, so the timeout env was not the decisive activation source for the record-mode leakage.

Bottom line: the exact activation source is the repo-local `.env` digital-twin record settings, with the immediate trigger being the rerun wrapper's `set -a; . ./.env; set +a` step after `unset`. There is a secondary seam too: `server/run-pipeline.cjs` also auto-loads `.env`, so merely unsetting the vars in the wrapper is insufficient as long as `.env` continues to define them.

---

### Task 3: Synthesize the audits into a precise diagnosis and recommend the smallest next fix lane

**Bead ID:** `ee-vndl`
**SubAgent:** `primary`
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, synthesize the no-content failure audit and the digital-twin activation audit into a precise diagnosis. Explain whether the main blocker is upstream provider instability, local runtime-mode leakage, request-shape/wrapper behavior, or an interaction between them. Recommend the smallest truthful next implementation lane and the exact rerun conditions needed for a clean verification of the dialogue coverage honesty fix. Update the active plan with the final recommendation. This is review-only: recommend, do not implement. Claim bead ee-vndl on start with bd update ee-vndl --status in_progress --json and close it on completion with bd close ee-vndl --reason "Diagnosed no-content failure and digital-twin leakage; recommended next fix lane" --json.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- optional `docs/research/`

**Files Created/Deleted/Modified:**
- `.plans/2026-04-03-openrouter-no-content-and-digital-twin-leakage-debug.md`

**Status:** ✅ Complete

**Results:** Synthesized the two completed audits into a single diagnosis.

Precise diagnosis:
- The **immediate failure** on the fresh rerun was a real upstream/provider-side instability event: OpenRouter returned HTTP `200` with an embedded `{ "error": { "message": "Internal Server Error", "code": 500 } }` body and no usable assistant content. That is why `get-dialogue` terminated as `invalid_response/no_content` before finalization.
- The **runtime contamination** is also real, but it is a separate local issue: the run was not a clean live lane because repo-local `.env` re-enabled `DIGITAL_TWIN_MODE=record` and related cassette vars after the wrapper explicitly unset them. That leakage explains why `digital-twin-router` record logging still appeared and why `_meta/events.jsonl` reported `mode: "record"` throughout the run.
- The best explanation is therefore **an interaction, not a single root cause**. Provider instability was the direct blocker for this specific attempt, while local runtime-mode leakage invalidated the rerun as a clean verification surface even if the provider had behaved.
- Current evidence does **not** support request-shape / wrapper drift as the primary blocker. The failing run used the same prompt ref, same model, same tool-loop path, and same multimodal request shape as the immediately earlier successful archived run. The wrapper deserves a later quality-of-diagnosis improvement because it surfaced the malformed provider body as `No content`, but that is not the main fix lane needed before the next honesty verification rerun.

Smallest truthful next implementation lane:
- **First fix only the live-runtime isolation seam** for this rerun lane. Do not broaden into prompt, schema, or provider-wrapper changes yet.
- Concretely, ensure a live verification run cannot inherit record-mode from repo-local `.env` or startup dotenv loading. The minimal target is: when we intentionally run the bounded Xiaomi/OpenRouter verification lane, `DIGITAL_TWIN_MODE`, `DIGITAL_TWIN_PACK`, and `DIGITAL_TWIN_CASSETTE` must remain absent for the actual Node process, and the run must not enter `digital-twin-router` record mode.
- Defer provider-classification cleanup (`200` + embedded error should not read as generic `No content`) until after the honesty fix is verified on a clean live success path, unless the team wants a separate diagnostics-only lane.

Exact rerun conditions required for a clean verification of the dialogue coverage honesty fix:
1. Use the same bounded config: `configs/cod-test-xiaomi-mimo-v2-omni-openrouter-high-thinking-rerun.yaml`.
2. Launch with a runtime environment where repo-local `.env` does **not** repopulate any `DIGITAL_TWIN_*` variables for the Node process. A shell-level `unset` is insufficient unless dotenv import is also prevented or `.env` no longer defines those keys for this run.
3. Before trusting the rerun, confirm the startup evidence is clean:
   - no `[digital-twin-router] record...` lines in the console/log
   - `_meta/events.jsonl` does **not** show `mode: "record"`
   - the active cassette id from `.env` does not appear anywhere in the run logs/artifacts
4. Keep the same model/prompt lane so the rerun answers the intended question about the already-landed honesty fix rather than introducing a new variable.
5. Only count the rerun as verification if `get-dialogue` completes and emits a fresh `phase1-gather-context/dialogue-data.json`.
6. Verification passes only if that fresh artifact shows coverage derived from recovered reach rather than full-file auto-stamping — i.e. coverage should match the recovered dialogue segment bounds and remain `complete: false` whenever recovered reach is partial.
7. If the provider again returns a malformed success/error hybrid or otherwise fails before `dialogue-data.json` is emitted, record it as another provider instability event and treat the honesty verification as **not yet tested**, not failed.

Recommendation summary:
- Main blocker classification: **interaction**.
  - Direct blocker on the observed attempt: **upstream provider instability**.
  - Cleanliness blocker for trustworthy verification: **local runtime-mode leakage from `.env`/dotenv**.
  - Not primary: **request-shape/wrapper behavior**, aside from later diagnostic-message cleanup.

---

## Final Results

**Status:** ✅ Complete

**What We Built:** A review-only diagnosis tying together the failed Xiaomi/OpenRouter rerun and the unexpected digital-twin logging. The truthful conclusion is that the rerun was blocked by an interaction of two issues: the attempt itself died on an upstream/provider-side malformed success response with no usable content, while the run was also locally contaminated because repo `.env` / dotenv re-enabled digital-twin record mode after the wrapper unset those vars. That means the dialogue coverage honesty fix remains implemented and locally validated, but still lacks a clean live end-to-end verification run.

**Commits:**
- None (review-only plan update)

**Lessons Learned:** For the next verification lane, the smallest honest implementation target is not prompt or schema churn; it is isolating the live rerun from `.env`-driven digital-twin activation so a successful provider response can actually test the already-landed honesty fix. If the provider fails before `dialogue-data.json` exists, the correct verdict is "not yet verified," not "honesty fix failed."

---

*Completed on 2026-04-03*
