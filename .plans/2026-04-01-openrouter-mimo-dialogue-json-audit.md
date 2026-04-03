# emotion-engine: audit failed OpenRouter MiMo dialogue JSON contract

**Date:** 2026-04-01
**Status:** Complete
**Agent:** Cookie 🍪

---

## Goal

Inspect the most recent failed OpenRouter MiMo run at the raw-capture level, determine exactly what the model/provider returned when Phase 1 dialogue failed with invalid JSON, and turn that evidence into a source-backed recommendation for the next implementation fix.

---

## Overview

The transport/public-URL lane is now sufficiently verified. The optimized staged asset is in place, the OpenRouter `baseUrl: null` bug is fixed, and live evidence shows the request is now reaching `https://openrouter.ai/api/v1/chat/completions` with real HTTP 200 behavior. That means the next blocker is no longer request routing - it is the Phase 1 dialogue contract itself.

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

**Results:** Verified the Task 1 conclusions against the current source. The parser/validator path is internally consistent and is not the primary failure source: `server/lib/json-validator.cjs` already tolerates fenced JSON, balanced-object extraction, quoted JSON strings, and light trailing-comma cleanup; `server/lib/local-validator-tool-loop.cjs` only reaches malformed-tool-envelope handling or schema validation after `parseJsonObjectInput(rawContent)` succeeds, and the failed chunk 7 run dies before either branch. The prompt/tool-loop contract also matches the validator tooling: `server/scripts/get-context/get-dialogue.cjs` asks for JSON-only dialogue output, `server/lib/phase1-validator-tools.cjs` defines the canonical `validate_dialogue_transcription_json` envelope, and `executeLocalValidatorToolLoop()` explicitly allows either that canonical tool call or a final JSON artifact - but both still require parseable JSON first. That means the failure remains primarily a model-output problem on chunk 7 turn 1, not a parser-contract mismatch. The source-owned regression that is clearly present is observability: the tool loop throws with rich `error.aiTargets.raw|extracted|parseError|completion|toolLoop` diagnostics, but `get-dialogue.cjs` raw capture and `server/lib/script-contract.cjs` failure envelopes persist `error.debug` / top-level fields instead, so the exact offending payload is lost. Recent churn is concentrated in `get-dialogue.cjs` prompt/handoff tightening, and the failing chunk carries a larger rolling handoff than the prior successful chunk (chunk 7 `rollingHandoffIn` 4289 chars vs chunk 6 4096 chars), so the verified interpretation is a combination of chunk-local model brittleness plus source-owned diagnostics loss, with prompt growth as the most plausible contributor from recent script changes. Proposed next lane: patch failure persistence first so chunk failures retain `error.aiTargets.*`, then rerun the isolated chunk-7 OpenRouter case under the same config to classify the real payload (prose vs truncation vs malformed JSON) before making parser changes or broad model/provider swaps.

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

**Status:** ✅ Complete

**Results:** Reran the isolated failing chunk 7 under the same OpenRouter config by reusing the exact saved chunk prompt and extracted audio chunk through the same local validator tool loop. The rerun succeeded rather than reproducing the parse failure, so there was no new malformed payload to classify. Concrete verification artifacts: `tmp/rerun-openrouter-dialogue-chunk7.cjs` (repro harness), `tmp/rerun-openrouter-dialogue-chunk7-2026-04-02T20-36-52-625Z.json` (captured rerun result), `output/cod-test-mimo-openrouter-compare/_meta/ai/_prompts/ed9b0e17bc1692a6cb330a4562c6bf06d7a2227e9769dda58ebad2a78ebb86f4.json` (exact chunk-7 prompt), and `output/cod-test-mimo-openrouter-compare/phase1-gather-context/raw/ffmpeg/dialogue/chunks/chunk_007.mp3` (exact chunk audio). The successful rerun returned a valid single JSON object on turn 1, auto-validated cleanly, and included no refusal/prose wrapper or truncation symptoms. That strengthens the conclusion that the original 2026-04-01 failure was intermittent model-output brittleness on chunk 7 rather than a deterministic parser/tool-loop contract bug.

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

**Status:** ✅ Complete

**What We Built:** A source-backed OpenRouter dialogue JSON audit, a persistence fix that now preserves `error.aiTargets.*` on parse-stage failures, an isolated chunk-7 rerun proving the formerly failing prompt/audio pair can now complete successfully under the same config, a narrowly hardened `cod-test-mimo-openrouter-compare` config with bounded retry strategy plus tightly budgeted AI structured-output recovery, and a fresh live rerun showing the hardened lane completes successfully end-to-end. The active evidence set now distinguishes a real observability bug from the likely intermittent model-output failure that triggered the original audit, and the latest live artifacts show self-healing was available but not consumed on this successful pass.

**Commits:**
- Pending

**Lessons Learned:** The durable fix from this lane was observability, not parser loosening. Once the failure path preserved the real tool-loop diagnostics, the next isolated rerun no longer failed — which means the original chunk-7 break was not deterministic for the saved prompt/audio pair. Future stabilization work should focus on reducing chunk-local model brittleness and gathering more repeated-sample evidence before changing the parser contract.

---

## Follow-on stabilization lane

### Task 6: Add bounded retries and AI recovery fallback to the OpenRouter MiMo cod-test config

**Bead ID:** `ee-fprh`
**SubAgent:** `coder`
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, update the OpenRouter MiMo cod-test config so this lane has bounded retry behavior and AI recovery fallback for intermittent invalid-output failures without turning it into a broad uncontrolled experiment. Use the existing recovery patterns already present in nearby configs as reference, keep the change as narrow as possible to the OpenRouter MiMo compare lane, validate the config and any focused tests that make sense, and update the active plan with exactly what changed. Claim bead ee-fprh on start with bd update ee-fprh --status in_progress --json and close it on completion with bd close ee-fprh --reason "Added bounded retries and AI recovery fallback to OpenRouter MiMo cod-test config" --json.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `configs/`

**Files Created/Deleted/Modified:**
- `.plans/2026-04-01-openrouter-mimo-dialogue-json-audit.md`
- `configs/cod-test-mimo-openrouter-compare.yaml`

**Status:** ✅ Complete

**Results:** Hardened `configs/cod-test-mimo-openrouter-compare.yaml` with the smallest nearby-pattern change set needed for intermittent invalid-output handling in this lane. Specifically, added a bounded `settings.retry_strategy` block (`exponential-backoff`, `maxRetries: 3`, `initialDelayMs: 1000`, `maxDelayMs: 10000`, `exponentialBase: 2`, `jitter: true`) and enabled the existing structured-output AI recovery lane under `recovery.ai` using the same tightly budgeted OpenRouter Gemini repair posture already used in nearby configs (`google/gemini-3.1-pro-preview`, `temperature: 0`, `timeoutMs: 45000`, `attempts maxPerFailure/maxPerScriptRun/maxPerPipelineRun = 1/1/3`, token budget `12000/2000/14000`, `maxCostUsd: 0.25`). Kept the deterministic recovery caps unchanged at `1/0` so this did not become a broader uncontrolled retry experiment, and did not add any wider model-target expansion or script changes.

---

### Task 7: Verify the hardened OpenRouter MiMo config still behaves as intended

**Bead ID:** `ee-6bp3`
**SubAgent:** `primary`
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, verify the hardened OpenRouter MiMo cod-test config after bounded retries and AI recovery fallback are added. Confirm the config validates, the retry/recovery posture is actually present where expected, and document any behavioral caveats before broader reruns. Update the active plan with what actually happened, claim bead ee-6bp3 on start with bd update ee-6bp3 --status in_progress --json, and close it on completion with bd close ee-6bp3 --reason "Verified hardened OpenRouter MiMo config retry and AI recovery posture" --json.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `configs/`

**Files Created/Deleted/Modified:**
- `.plans/2026-04-01-openrouter-mimo-dialogue-json-audit.md`

**Status:** ✅ Complete

**Results:** Verified the hardened lane with both a repository-wide YAML parse pass and a focused semantic dry run for the target config. `npm run validate-configs` passed, including `configs/cod-test-mimo-openrouter-compare.yaml`, and `npm run pipeline -- --config configs/cod-test-mimo-openrouter-compare.yaml --dry-run` also passed with `✅ Valid (3 script(s) across all phases)`. Behavioral caveat: this change only adds bounded generic retry policy plus one-budgeted structured-output repair path; it intentionally does not expand the target chain, loosen parser behavior, or raise deterministic recovery counts beyond the current `1/0` cap.

---

### Task 8: Run the hardened OpenRouter MiMo compare lane and capture how retry/recovery behaves under live conditions

**Bead ID:** `ee-90z8`
**SubAgent:** `primary`
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, run the hardened OpenRouter MiMo compare lane live with configs/cod-test-mimo-openrouter-compare.yaml now that bounded retry behavior and AI recovery fallback are enabled. Capture whether the run succeeds, whether retry or AI recovery is actually exercised, and which concrete artifacts/logs prove the outcome. Update the active plan with what actually happened, claim bead ee-90z8 on start with bd update ee-90z8 --status in_progress --json, and close it on completion with bd close ee-90z8 --reason "Ran hardened OpenRouter MiMo compare lane and captured retry/recovery behavior" --json.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `output/`
- `.logs/`

**Files Created/Deleted/Modified:**
- `.plans/2026-04-01-openrouter-mimo-dialogue-json-audit.md`
- live-run outputs/logs to be determined

**Status:** ✅ Complete

**Results:** Ran the hardened lane live with `npm run pipeline -- --config configs/cod-test-mimo-openrouter-compare.yaml` and captured the console transcript in `.logs/2026-04-02-200045-cod-test-mimo-openrouter-compare-hardened-live.log`. The run completed successfully at 2026-04-03T00:04:49Z with exit code 0, producing fresh artifacts under `output/cod-test-mimo-openrouter-compare/`, including `phase1-gather-context/script-results/get-dialogue.success.json`, `phase1-gather-context/script-results/get-music.success.json`, `phase2-process/script-results/whole-video-mimo.success.json`, and `artifacts-complete.json`. The hardened self-healing paths were present but not actually exercised: all three lineage files (`phase1-gather-context/recovery/get-dialogue/lineage.json`, `phase1-gather-context/recovery/get-music/lineage.json`, `phase2-process/recovery/whole-video-mimo/lineage.json`) record `deterministicAttemptsUsed: 0` and `aiRecoveryAttemptsUsed: 0`, and the fresh phase error summaries (`phase1-gather-context/raw/_meta/errors.summary.json`, `phase2-process/raw/_meta/errors.summary.json`) both show successful outcomes with zero errors. `_meta/events.jsonl` is append-only and still contains the older 2026-04-01 failed chunk-7 evidence, so the trustworthy proof for this live rerun is the new 2026-04-03 event window (seq 107+), the success envelopes, the zero-use lineage counters, and the fresh console log. One nuance: normal validator tool-loop follow-up turns still occurred inside successful first attempts (for example dialogue chunk 0 used 3 tool-loop turns and dialogue stitch used 2 turns), but those are ordinary in-attempt schema/tool-loop interactions, not bounded retry or AI recovery fallback.
