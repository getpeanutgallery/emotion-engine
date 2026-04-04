# emotion-engine: investigate Xiaomi tool-loop finalization bug

**Date:** 2026-04-03  
**Status:** Draft  
**Agent:** Cookie 🍪

---

## Goal

Determine why the Xiaomi MiMo high-thinking dialogue run keeps consuming validator/tool-loop turns even after the validator reports `valid: true`, and identify the smallest truthful next fix lane.

---

## Overview

The latest Xiaomi MiMo high-thinking rerun produced a strange and valuable failure. The dialogue step did not fail because the model emitted prose or obviously malformed JSON. Instead, the tool-loop history shows multiple successful validator outcomes (`valid: true`), followed by additional model outputs until the run died with `tool_call_limit_exceeded`. That makes this look less like a schema-generation failure and more like a control-flow / finalization bug in the interaction between the model, local validator loop, and the script’s acceptance logic.

This is a good bounded investigation target because the failure appears reproducible in captured artifacts and is likely source-owned at least in part. We need to inspect the exact turn-by-turn history, compare the successive model outputs, verify what the tool loop expected to happen after each `valid: true`, and read the relevant acceptance/finalization code. The main question is whether Xiaomi is truly repeating nearly identical artifacts, whether the framework is failing to accept a valid final artifact after revalidation, or whether some subtle post-validation rule is causing the loop to continue.

This tranche should stay review-only. It should not change prompt text or implementation yet. The output should be a precise diagnosis of where the extra turns come from and a recommendation for the next narrow implementation lane.

---

## Tasks

### Task 1: Audit the Xiaomi tool-loop history turn by turn and compare the successive outputs after validator success

**Bead ID:** `ee-8xt3`  
**SubAgent:** `research`  
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, inspect the Xiaomi high-thinking get-dialogue failure artifacts and compare the tool-loop turn history step by step. Determine whether turns 1-4 are materially different, whether the model is repeating near-identical final JSON after validator success, and what exact event immediately precedes tool-call exhaustion. Update the active plan with the evidence. This is review-only: do not modify prompts or code. Claim bead ee-8xt3 on start with bd update ee-8xt3 --status in_progress --json and close it on completion with bd close ee-8xt3 --reason "Audited Xiaomi tool-loop history and repeated outputs" --json.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `output/`
- optional `docs/research/`

**Files Created/Deleted/Modified:**
- `.plans/2026-04-03-xiaomi-tool-loop-finalization-bug-investigation.md`

**Status:** ✅ Complete

**Results:** Audited the captured turn history embedded in `output/cod-test-xiaomi-mimo-v2-omni-openrouter-high-thinking-rerun/phase1-gather-context/recovery/get-dialogue/ai-recovery/attempt-01/failure-package.json` under `sourceFailure.diagnostics.aiTargets.toolLoop.history` (the sibling `tool-loop.json` file is `null`, so the usable trace lives in the failure package).

Evidence summary:
- The history contains 7 entries: assistant turn 1 → validator_acceptance turn 1 (`valid: true`) → assistant turn 2 → validator_acceptance turn 2 (`valid: true`) → assistant turn 3 → final_artifact_revalidation turn 3 (`valid: true`) → assistant turn 4.
- **Turns 1 and 2 are not materially different.** They are both wrapped validator tool calls (`{"tool":"validate_dialogue_transcription_json","transcription":...}`) and normalize to the same payload after whitespace removal. The only difference is formatting length (`7851` vs `7725` chars). Both keep the same 16 segments, `totalDuration: 120`, same summary, same `analysisMode/coverage/provenance/qualityNotes`, and the same weaker timing/profile guess set (for example segment 10 starts at `40.0` and Speaker 2’s inferred accent is just `possibly Spanish`).
- **Turn 3 is materially different from turns 1-2.** It switches from wrapped tool call to final artifact JSON, drops the additive metadata fields, and changes the content itself: e.g. `totalDuration` jumps from `120` to `165`, segment timings move later (`40-41` becomes `104-106`), confidence scores rise, the summary becomes the longer “dramatic dialogue / manipulation and resistance / Reznov Challenge Pack” version, and speaker profile descriptors become richer (`possibly Spanish-influenced English`, extra acoustic descriptors, etc.).
- **Turns 3 and 4 are near-identical repeats of the same final JSON.** After stripping the markdown fence from turn 3, turns 3 and 4 normalize exactly equal (`cleanEqual=true`, same normalized length `4903`). Turn 4 is just the same final artifact emitted again without the ```json fence wrapper.
- The model therefore **does repeat a near-identical final JSON after validator success**. Specifically: turn 3 final artifact is auto-revalidated and accepted with `valid: true`, then turn 4 emits the same final artifact again instead of terminating.
- The **exact event immediately preceding tool-call exhaustion** is assistant **turn 4 model_output**, which arrives after turn 3’s `final_artifact_revalidation` already returned `valid: true`. In the run event log this appears as `_meta/events.jsonl` seq `16` (`tool.loop.provider.await.end`, turn 4) immediately followed by seq `17` (`provider.call.end`, `ok:false`, error `invalid_output: exceeded validate_dialogue_transcription_json tool-call limit`). There is no intervening validator-success event for turn 4; by that point the prompt state says `remainingValidatorCalls: 0`, so the loop dies right after receiving the repeated final artifact instead of accepting it and stopping.

---

### Task 2: Inspect the local validator-tool-loop acceptance/finalization code path to determine why `valid: true` does not terminate the run

**Bead ID:** `ee-um57`  
**SubAgent:** `research`  
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, inspect the source code for the local validator-tool-loop and get-dialogue acceptance/finalization path to determine what should happen after validator success and why the Xiaomi run may still continue to consume turns. Focus on the code that handles validator success, final artifact auto-revalidation, and loop termination. Update the active plan with the exact control-flow interpretation and likely failure seam. This is review-only: do not modify prompts or code. Claim bead ee-um57 on start with bd update ee-um57 --status in_progress --json and close it on completion with bd close ee-um57 --reason "Inspected tool-loop finalization code path after validator success" --json.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `server/lib/`
- `server/scripts/get-context/`
- optional `docs/research/`

**Files Created/Deleted/Modified:**
- `.plans/2026-04-03-xiaomi-tool-loop-finalization-bug-investigation.md`

**Status:** ✅ Complete

**Results:** The loop behavior is now clear in source. `get-dialogue` routes both transcription and stitch acceptance through `executeLocalValidatorToolLoop(...)` and passes `normalizeValidatedValue: (value) => JSON.stringify(value)` (`server/scripts/get-context/get-dialogue.cjs:2147-2185`, `2200-2231`). The validator tool itself explicitly tells the model that once it returns `valid=true`, it should "Return the final JSON artifact with no wrapper" and exposes the accepted normalized value as `normalizedValue` (`server/lib/phase1-validator-tools.cjs:56-77`, `150-168`). But in the shared local tool loop, an explicit canonical tool call that returns `valid=true` does **not** terminate the run; it only increments `validatorCalls`, stores `successfulValidatedValue`, appends `validator_acceptance`, and `continue`s to the next model turn (`server/lib/local-validator-tool-loop.cjs:279-317`). The only success return path is later, in the non-tool-call branch: the model must emit a bare JSON artifact, the loop auto-validates it, and only if that revalidated artifact normalizes exactly equal to the previously validated value does the function emit `tool.loop.complete` and return (`server/lib/local-validator-tool-loop.cjs:389-459`). If the bare JSON differs, even while still valid, the loop updates `successfulValidatedValue` and continues (`422-424`). So the real acceptance contract is two-step convergence, not "validator said valid=true, therefore stop". Likely failure seam for Xiaomi: after receiving validator success, the model appears to keep spending another turn on another tool-call envelope instead of switching to the required final bare JSON. That repeatedly burns `validatorCalls`; once the model emits one more canonical tool call after the budget is exhausted, the loop throws `tool_call_limit_exceeded` immediately in the tool-call branch (`280-299`). The archived Xiaomi failure is consistent with this seam: the run ended with `invalid_output: exceeded validate_dialogue_transcription_json tool-call limit`, and the event log shows three provider turns with no `tool.loop.complete` event before failure (`output/_archives/cod-test-phase1-proof-compare-after-mimo-tranche2-xiaomi-toolloop-limit-20260401-1222/phase1-gather-context/script-results/get-dialogue.failure.json`, `_meta/events.jsonl`). Smallest truthful diagnosis: this is primarily a framework/model interaction bug, with the sharpest framework seam being that explicit validator success never finalizes immediately and always depends on one extra bare-artifact turn plus equality revalidation.
---

### Task 3: Synthesize the artifact and code audits into a precise diagnosis and recommend the smallest implementation lane

**Bead ID:** `ee-2yg1`  
**SubAgent:** `primary`  
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, synthesize the Xiaomi tool-loop history audit and the code-path audit into a precise diagnosis of why validator-success does not terminate cleanly. Recommend the smallest truthful implementation lane, explain whether the bug is model behavior, framework control-flow, or an interaction between them, and identify what should be changed first. Update the active plan with the final recommendation. This is review-only: recommend, do not implement. Claim bead ee-2yg1 on start with bd update ee-2yg1 --status in_progress --json and close it on completion with bd close ee-2yg1 --reason "Diagnosed Xiaomi tool-loop finalization failure and recommended next fix lane" --json.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- optional `docs/research/`

**Files Created/Deleted/Modified:**
- `.plans/2026-04-03-xiaomi-tool-loop-finalization-bug-investigation.md`

**Status:** ✅ Complete

**Results:** Combined diagnosis: the observed failure is **not** that the validator’s `valid: true` result is supposed to terminate and mysteriously does not. In current source, a successful canonical tool call is only a checkpoint. The loop records `successfulValidatedValue` and then explicitly waits for one more assistant turn that returns a bare final JSON artifact, auto-revalidates that artifact, and only terminates if its normalized value exactly matches the previously validated candidate (`server/lib/local-validator-tool-loop.cjs`, tool-call success branch vs. final-artifact branch). The Xiaomi history lines up with that contract: turns 1-2 are repeated canonical tool calls that both validate, turn 3 is the first bare final artifact and it also validates, but turn 4 repeats the same final artifact again instead of the loop having already exited. The immediate crash happens because the framework had already spent the validator-call budget during the earlier tool-call + revalidation sequence, so the extra post-success turn arrives when `remainingValidatorCalls` is already `0` and the run aborts with `tool_call_limit_exceeded` rather than cleanly accepting completion.

Classification: this is best described as an **interaction bug**, with the primary sharp edge in **framework control-flow** and the triggering behavior in the **model**. Xiaomi does contribute the bad behavior by not reliably honoring the intended handoff from “validator accepted candidate” to “emit final artifact once and stop.” But the framework makes that brittle by encoding success as a two-step convergence protocol that requires an additional generation after success, spends from the same validator budget for both explicit tool calls and final-artifact auto-revalidation, and only returns on exact equality after that extra turn. That means a model that is merely redundant or slightly non-compliant can convert an already-valid artifact into a hard failure.

Smallest truthful implementation lane: **change the loop finalization contract first, not the prompt first.** The narrowest source-owned fix lane is to let an explicit canonical tool call that returns `valid=true` terminate immediately with the validated normalized artifact (or equivalently make the tool result itself the accepted final artifact), instead of requiring a second bare-artifact turn for convergence. If keeping a final bare-artifact turn is considered important for provider consistency, the next-smallest fallback lane is still framework-first: do not burn failure on a repeated post-success artifact that normalizes equal to the accepted value, and/or stop counting final-artifact auto-revalidation against the same validator-call ceiling used for explicit tool calls. Prompt tuning can remain a secondary mitigation, but it should not be the first change because the current failure only exists because the framework makes model redundancy fatal after success.

Recommended first change: update `executeLocalValidatorToolLoop(...)` so that `toolResult.valid === true` in the explicit tool-call branch can produce a successful return path using `toolResult.normalizedValue` (after the existing normalization step), with history/event emission preserved. That is the smallest truthful lane because it directly removes the extra-turn seam exposed by Xiaomi, aligns runtime behavior with the validator summary text (“Return the final JSON artifact with no wrapper”), and reduces dependence on provider-specific obedience after the artifact is already known-good.

---

## Final Results

**Status:** ✅ Complete

**What We Built:** A review-only diagnosis of the Xiaomi validator-success finalization failure, plus a concrete recommendation for the next implementation lane: fix the framework’s post-success finalization contract before trying more prompt tuning.

**Commits:**
- Pending

**Lessons Learned:** `valid=true` in the local validator loop is currently only provisional success. Because the loop requires an extra bare-artifact convergence turn and charges that path against the same validator budget, a model can produce a valid artifact and still fail purely due to redundant post-success behavior. That makes this a framework-shaped interaction bug, not a pure schema-generation failure.

---

*Completed on 2026-04-03*
