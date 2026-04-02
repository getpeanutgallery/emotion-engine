# emotion-engine: audit failed OpenRouter MiMo dialogue JSON contract

**Date:** 2026-04-01  
**Status:** In Progress  
**Agent:** Cookie 🍪

---

## Goal

Inspect the most recent failed OpenRouter MiMo run at the raw-capture level, determine exactly what the model/provider returned when Phase 1 dialogue failed with invalid JSON, and turn that evidence into a source-backed recommendation for the next implementation fix.

---

## Overview

The transport/public-URL lane is now sufficiently verified. The optimized staged asset is in place, the OpenRouter `baseUrl: null` bug is fixed, and live evidence shows the request is now reaching `https://openrouter.ai/api/v1/chat/completions` with real HTTP 200 behavior. That means the next blocker is no longer request routing — it is the Phase 1 dialogue contract itself.

The right next move is not to guess at prompt or parser changes. We should first inspect the exact failing run artifacts and read what OpenRouter actually returned. We already have raw captures, failure summaries, and the specific failed run output directory. That gives us a bounded evidence-first lane: reconstruct the final request/response sequence, classify whether the failure is malformed JSON, truncated JSON, prose instead of tool output, wrong envelope, or parser/validator mismatch, then recommend the smallest truthful fix.

This plan therefore starts with a research-grade artifact audit. Only after we understand the exact failure shape should we decide whether the right follow-up is prompt hardening, validator/tool-loop protocol adjustment, parser tolerance, retry/recovery tuning, or model/provider fallback. Xiaomi remains important, but it should stay second until the faster/cleaner OpenRouter failure is fully understood.

---

## Tasks

### Task 1: Audit the latest failed OpenRouter MiMo dialogue run and reconstruct the exact failure contract

**Bead ID:** `ee-fu8b`  
**SubAgent:** `research`
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, inspect the latest failed OpenRouter MiMo run that now fails with invalid JSON in Phase 1 dialogue. Use the raw captures, logs, request/response artifacts, and error summaries to determine exactly what the provider returned and where the contract broke. Classify the failure shape precisely (for example: truncated JSON, wrong envelope, prose, markdown fences, malformed tool call, parser mismatch, etc.), identify the specific files that prove it, and write a concise recommendation for the smallest truthful next fix. Treat prior OpenRouter success on this tooling path as a regression hypothesis to evaluate against recent script changes. Claim bead ee-fu8b on start with bd update ee-fu8b --status in_progress --json and close it on completion with bd close ee-fu8b --reason "Audited failed OpenRouter MiMo dialogue run and reconstructed JSON failure contract" --json.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `docs/research/`
- `output/`
- `.logs/`

**Files Created/Deleted/Modified:**
- `.plans/2026-04-01-openrouter-mimo-dialogue-json-audit.md`
- `docs/research/2026-04-01-openrouter-mimo-dialogue-json-audit-task1.md`

**Status:** ✅ Complete

**Results:** Audited the failed `output/cod-test-mimo-openrouter-compare/` Phase 1 dialogue lane and wrote `docs/research/2026-04-01-openrouter-mimo-dialogue-json-audit-task1.md`. The evidence shows chunk 7 failed on the first tool-loop turn at `parseJsonObjectInput(rawContent)` inside `server/lib/local-validator-tool-loop.cjs`, after OpenRouter response extraction but before validator/schema handling. This excludes a general parser mismatch, a markdown-fenced-valid-JSON case, and a well-formed wrong tool envelope. The exact offending payload from OpenRouter cannot be reconstructed from the saved artifacts because the failure path persists `error.debug` but drops the richer `error.aiTargets` parse/completion/tool-loop diagnostics; that observability gap is source-owned and directly proven by `server/scripts/get-context/get-dialogue.cjs` and `server/lib/script-contract.cjs`. Recent hot-path churn is concentrated in `get-dialogue.cjs` prompt/handoff hardening rather than the parser itself, so the most likely interpretation is chunk-specific model-output brittleness plus a diagnostics persistence regression. Smallest truthful next fix: persist `error.aiTargets.*` on failure, then rerun the failing chunk once before changing prompt/model behavior.

---

### Task 2: Verify the audit conclusions against current parser / validator / prompt code paths

**Bead ID:** `ee-wum9`  
**SubAgent:** `primary`
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, verify the OpenRouter MiMo dialogue audit conclusions against the current source-owned parser, validator, and prompt/tool-loop code paths. Confirm whether the failure is primarily a model-output problem, a parser-contract mismatch, a regression introduced by recent script changes, or some combination, and update the plan with the verified interpretation and proposed next lane. Claim bead ee-wum9 on start with bd update ee-wum9 --status in_progress --json and close it on completion with bd close ee-wum9 --reason "Verified OpenRouter JSON audit against parser validator and prompt code" --json.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `server/lib/`
- `server/scripts/get-context/`
- `docs/research/`

**Files Created/Deleted/Modified:**
- `.plans/2026-04-01-openrouter-mimo-dialogue-json-audit.md`
- `docs/research/2026-04-01-openrouter-mimo-dialogue-json-audit-task1.md`
- `server/lib/json-validator.cjs`
- `server/lib/local-validator-tool-loop.cjs`
- `server/lib/phase1-validator-tools.cjs`
- `server/lib/script-contract.cjs`
- `server/scripts/get-context/get-dialogue.cjs`

**Status:** ✅ Complete

**Results:** Verified the Task 1 conclusions against the current source. The parser/validator path is internally consistent and is not the primary failure source: `server/lib/json-validator.cjs` already tolerates fenced JSON, balanced-object extraction, quoted JSON strings, and light trailing-comma cleanup; `server/lib/local-validator-tool-loop.cjs` only reaches malformed-tool-envelope handling or schema validation after `parseJsonObjectInput(rawContent)` succeeds, and the failed chunk 7 run dies before either branch. The prompt/tool-loop contract also matches the validator tooling: `server/scripts/get-context/get-dialogue.cjs` asks for JSON-only dialogue output, `server/lib/phase1-validator-tools.cjs` defines the canonical `validate_dialogue_transcription_json` envelope, and `executeLocalValidatorToolLoop()` explicitly allows either that canonical tool call or a final JSON artifact — but both still require parseable JSON first. That means the failure remains primarily a model-output problem on chunk 7 turn 1, not a parser-contract mismatch. The source-owned regression that is clearly present is observability: the tool loop throws with rich `error.aiTargets.raw|extracted|parseError|completion|toolLoop` diagnostics, but `get-dialogue.cjs` raw capture and `server/lib/script-contract.cjs` failure envelopes persist `error.debug` / top-level fields instead, so the exact offending payload is lost. Recent churn is concentrated in `get-dialogue.cjs` prompt/handoff tightening, and the failing chunk carries a larger rolling handoff than the prior successful chunk (chunk 7 `rollingHandoffIn` 4289 chars vs chunk 6 4096 chars), so the verified interpretation is a combination of chunk-local model brittleness plus source-owned diagnostics loss, with prompt growth as the most plausible contributor from recent script changes. Proposed next lane: patch failure persistence first so chunk failures retain `error.aiTargets.*`, then rerun the isolated chunk-7 OpenRouter case under the same config to classify the real payload (prose vs truncation vs malformed JSON) before making parser changes or broad model/provider swaps.

---

### Task 3: Recommend the next implementation lane for OpenRouter dialogue stabilization

**Bead ID:** `ee-gs7l`  
**SubAgent:** `primary`
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, update the plan with a concrete next implementation recommendation for stabilizing OpenRouter Phase 1 dialogue after the JSON audit. The recommendation should identify the smallest truthful fix class (prompt hardening, validator protocol change, parser tolerance, recovery tuning, model swap, or other) and explain why it should come before the Xiaomi runtime lane. Claim bead ee-gs7l on start with bd update ee-gs7l --status in_progress --json and close it on completion with bd close ee-gs7l --reason "Recommended next OpenRouter dialogue stabilization implementation lane" --json.`

**Folders Created/Deleted/Modified:**
- `.plans/`

**Files Created/Deleted/Modified:**
- `.plans/2026-04-01-openrouter-mimo-dialogue-json-audit.md`

**Status:** ✅ Complete

**Results:** Based on the completed audit and source verification, the smallest truthful next implementation lane is to patch failure persistence first rather than guessing at prompt or parser changes. The recommendation is to persist `error.aiTargets.raw`, `error.aiTargets.extracted`, `error.aiTargets.parseError`, `error.aiTargets.completion`, and `error.aiTargets.toolLoop` into the `get-dialogue` raw capture plus the script-result failure envelope, then rerun the isolated failing OpenRouter chunk-7 case under the same config. That sequence comes before the Xiaomi runtime lane because it converts the current opaque failure into an evidence-rich one and lets the next decision be grounded in the actual returned payload shape instead of speculation.

---

### Task 4: Patch failure persistence so parse-stage dialogue failures retain `error.aiTargets.*`

**Bead ID:** `ee-402v`
**SubAgent:** `coder`
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, patch the Phase 1 get-dialogue failure persistence path so parse-stage OpenRouter dialogue failures retain the rich diagnostics currently stored on error.aiTargets. Persist the relevant aiTargets fields into the raw capture artifact and the script-result failure envelope without breaking existing success-path artifacts. Update the active plan with what changed, claim bead ee-402v on start with bd update ee-402v --status in_progress --json, and close it on completion with bd close ee-402v --reason "Patched get-dialogue failure persistence to retain error.aiTargets diagnostics" --json.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `server/lib/`
- `server/scripts/get-context/`
- `test/lib/`
- `test/scripts/`

**Files Created/Deleted/Modified:**
- `.plans/2026-04-01-openrouter-mimo-dialogue-json-audit.md`
- `server/lib/script-contract.cjs`
- `server/scripts/get-context/get-dialogue.cjs`
- `test/lib/script-contract.test.js`
- `test/scripts/get-dialogue.test.js`

**Status:** ✅ Complete

**Results:** Patched both failure-persistence surfaces without changing the success artifact contract. In `server/scripts/get-context/get-dialogue.cjs`, the whole-asset, chunk, and stitch raw-capture writers now persist an additive failure-side `aiTargets` object plus preserve `rawResponse` and `toolLoop` from `error.aiTargets` instead of falling back to `error.debug` only. In `server/lib/script-contract.cjs`, failure envelopes now lift the relevant `error.aiTargets` fields into `scriptResult.diagnostics.aiTargets`, and the existing structured parse/validation summary fields now fall back to the richer aiTargets diagnostics when top-level error fields are absent. Added focused regression coverage in `test/lib/script-contract.test.js` and `test/scripts/get-dialogue.test.js`. Verification: `node --test test/lib/script-contract.test.js test/scripts/get-dialogue.test.js` passed (43 tests).

---

### Task 5: Rerun the isolated failing OpenRouter chunk after the persistence patch and classify the payload

**Bead ID:** `ee-0cit`
**SubAgent:** `primary`
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, after the persistence patch lands, rerun the isolated failing OpenRouter dialogue chunk under the same config, inspect the newly preserved failure payload if it still fails, and classify the exact shape of the returned content (for example prose/refusal, truncated JSON, or malformed JSON). Update the active plan with the result, claim bead ee-0cit on start with bd update ee-0cit --status in_progress --json, and close it on completion with bd close ee-0cit --reason "Reran isolated failing OpenRouter chunk and classified preserved payload" --json.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `output/`
- `.logs/`
- optional docs/research/

**Files Created/Deleted/Modified:**
- `.plans/2026-04-01-openrouter-mimo-dialogue-json-audit.md`
- rerun outputs/logs to be determined
- optional follow-up research note

**Status:** ⏳ Pending

**Results:** Pending.

---

## Evidence targets

Primary run to inspect:
- `output/cod-test-mimo-openrouter-compare/`

High-value artifacts likely to matter:
- `.logs/2026-04-01-cod-test-mimo-openrouter-compare-optimized-rerun-live.log`
- `output/cod-test-mimo-openrouter-compare/phase1-gather-context/script-results/get-dialogue.failure.json`
- `output/cod-test-mimo-openrouter-compare/phase1-gather-context/raw/_meta/errors.summary.json`
- `output/cod-test-mimo-openrouter-compare/phase1-gather-context/raw/ai/**/capture.json`
- `output/cod-test-mimo-openrouter-compare/_meta/events.jsonl`
- current source-owned dialogue prompt / validator / parser code paths

---

## Success Criteria

- We identify the exact returned payload shape from the failed OpenRouter MiMo dialogue run.
- We classify the JSON failure precisely rather than hand-waving it as generic invalid output.
- We tie the failure to concrete artifact paths.
- We verify whether the current parser/validator contract matches what the model was asked to do.
- We end with a concrete recommendation for the next implementation lane before touching Xiaomi optimization work.

---

## Final Results

**Status:** ⏳ Pending

**What We Built:** Pending.

**Commits:**
- Pending

**Lessons Learned:** Pending.
