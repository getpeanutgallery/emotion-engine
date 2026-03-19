# emotion-engine: investigate record-mode Phase 2 hang and recovery behavior

**Date:** 2026-03-18  
**Status:** Complete  
**Agent:** Cookie 🍪

---

## Goal

Investigate the new record-mode `cod-test` hang in Phase 2, determine where execution stopped and why, and explicitly verify whether the AI recovery lane attempted to fire or was bypassed before it could act.

---

## Overview

The original cassette-path issue is now resolved the proper way: `emotion-engine` consumes the fixed `digital-twin-router` through a clean dependency refresh, and record-mode output now lands in the canonical sibling `cassettes/` directory. However, the latest clean-installed record-mode rerun did not complete. It progressed through Phase 1 and into Phase 2, then stalled around chunk 7 after a `provider.call.start` event.

Derrick’s question is the right one: if the system hit an AI/provider failure mode, the recovery lane should have had a chance to fire. So this plan is not just about finding the hang point — it’s about tracing the runtime envelope carefully enough to answer whether the system (a) never classified the condition as a recoverable AI failure, (b) got stuck below the recovery machinery, or (c) did attempt recovery and failed in a different way. The output/event/cassette artifacts from the blocked rerun should give us that answer.

This is a bounded investigation plan only. No fixes yet unless a tiny non-invasive instrumentation step is absolutely required to establish truth.

---

## Tasks

### Task 1: Reconstruct the exact hang point from events, artifacts, and cassette state

**Bead ID:** `ee-2mh`  
**SubAgent:** `main`  
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, inspect the blocked record-mode rerun artifacts and reconstruct the exact hang point. Use output/cod-test/_meta/events.jsonl, Phase 2 raw artifacts, logs, and the new cassette file to determine the last successful step, the last in-flight step, and what stopped changing on disk. Update this plan with exact evidence and mark the task complete when the hang point is truthfully reconstructed. Claim the assigned bead on start and close it on completion.`

**Folders Created/Deleted/Modified:**
- `output/`
- `.plans/`

**Files Created/Deleted/Modified:**
- `.plans/2026-03-18-investigate-record-mode-phase2-hang-and-recovery.md`

**Status:** ✅ Complete

**Results:** Reconstructed the Phase 2 hang boundary from the rerun artifacts. The last fully successful persisted step was `phase2-process` chunk `5` (`chunkIndex: 5`, `splitIndex: 0`, window `25.0s-30.0s`): `output/cod-test/_meta/events.jsonl` shows `tool.loop.complete` seq `772`, `provider.call.end` seq `773`, and `attempt.end` seq `774` at `2026-03-19T00:34:23.111Z`; matching output files were written immediately after at `output/cod-test/phase2-process/raw/ai/chunk-0005/split-00/attempt-01/capture.json` (`2026-03-18 20:34:23.110969244 -0400`) and `output/cod-test/phase2-process/raw/ai/chunk-5.json` (`2026-03-18 20:34:23.112230190 -0400`).

The last in-flight step was chunk `6` (`chunkIndex: 6`, `splitIndex: 0`, window `30.0s-35.0s`). The engine advanced far enough to emit `attempt.start` seq `775` and `provider.call.start` seq `776` at `2026-03-19T00:34:23.137Z`, plus prompt/raw setup artifacts: `output/cod-test/phase2-process/raw/ffmpeg/extract-chunk-6.json` (`20:34:23.124969189 -0400`), `output/cod-test/phase2-process/raw/ffmpeg/split-duration-6-0.json` (`20:34:23.135969145 -0400`), and `output/cod-test/_meta/ai/_prompts/65af05afb2ed1eb9cbb2f26ec884e3e4f0d902366727dfdd16cb8f059351078c.json` / `output/cod-test/_meta/events.jsonl` both at `20:34:23.137969137 -0400`. After seq `777`, `events.jsonl` stops completely — there is no `tool.loop.complete`, no `provider.call.end`, no `attempt.end`, no `output/cod-test/phase2-process/raw/ai/chunk-0006/.../capture.json`, and no `output/cod-test/phase2-process/raw/ai/chunk-6.json` pointer.

The new cassette file shows the provider did return something after the event stream stopped: `../digital-twin-openrouter-emotion-engine/cassettes/cod-test-record-20260318-202023.json` was last updated at `2026-03-18 20:35:21.486735828 -0400`, and its final interaction (`interactionId: bf96a95eab8d17f6918ccade4ab33cc1bd55cd797d16c2855acaaf3a187abe72`, timestamp `2026-03-19T00:35:21.485Z`) is for chunk window `30.0s-35.0s`. That interaction contains only the first-turn validator envelope (`{"tool":"validate_emotion_analysis_json",...}`) and has no corresponding second-turn final-artifact interaction, unlike chunk `5`, which has both the validator-envelope interaction at cassette index `13` (`00:33:39.392Z`) and the final JSON artifact interaction at cassette index `14` (`00:34:23.109Z`).

What stopped changing on disk was the `output/cod-test` run state after prompt emission for chunk `6`: the rerun never wrote the Phase 2 chunk-6 AI capture/pointer artifacts, never advanced `output/cod-test/_meta/events.jsonl` past seq `777`, and never refreshed `output/cod-test/phase2-process/chunk-analysis.json` (its mtime stayed at `2026-03-18 18:32:29.506698538 -0400`, from the earlier successful run, not this rerun). There is also no new rerun log file in `.logs/`; only the older pre-existing `.logs/cod-test-20260310-085238.log` exists. The reconstructed hang boundary is therefore: **after the provider returned chunk 6’s first-turn tool-call response into the cassette, but before the local validator/final-artifact path completed and before any chunk-6 success artifacts were persisted into `output/cod-test`.**

---

### Task 2: Determine whether AI recovery attempted to fire, and why or why not

**Bead ID:** `ee-d98`  
**SubAgent:** `main`  
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, inspect the recovery-related events, script results, and relevant code paths to determine whether the AI recovery lane attempted to fire for the blocked record-mode rerun. If it did not, explain exactly what prevented it from engaging. If it did, explain where it stopped. Update this plan with exact evidence and the most likely next fix lane, then close the assigned bead.`

**Folders Created/Deleted/Modified:**
- `output/`
- `server/`
- `../tools/`
- `.plans/`

**Files Created/Deleted/Modified:**
- `.plans/2026-03-18-investigate-record-mode-phase2-hang-and-recovery.md`
- `server/lib/script-runner.cjs`
- `server/lib/script-contract.cjs`
- `server/scripts/process/video-chunks.cjs`
- `server/lib/local-validator-tool-loop.cjs`
- `../tools/emotion-lenses-tool.cjs`
- `../tools/lib/local-validator-tool-loop.cjs`
- `configs/cod-test.yaml`
- `output/cod-test/_meta/events.jsonl`
- `../digital-twin-openrouter-emotion-engine/cassettes/cod-test-record-20260318-202023.json`

**Status:** ✅ Complete

**Results:** The AI recovery lane did **not** attempt to fire for the blocked record-mode rerun.

Exact evidence:
- `server/lib/script-runner.cjs:66-81` only enters `attemptAiRecovery(...)` **inside the `catch` path**, after `createFailureResult(...)` builds a failure envelope whose `recoveryPolicy.nextAction.policy === 'ai_recovery'`.
- `server/lib/script-contract.cjs:754-860` persists failure/success execution artifacts (`<phase>/script-results/<script>.*.json`, `<phase>/recovery/<script>/lineage.json`, optional `next-action.json`) only when a script returns or throws and the wrapper reaches `wrapLegacySuccessResult(...)` or `createFailureResult(...)`.
- For this rerun, `output/cod-test/_meta/events.jsonl` stops at seq `777` with chunk 6 `provider.call.start` (`2026-03-19T00:34:23.137Z`) and never records chunk 6 `tool.loop.complete`, `provider.call.end`, `attempt.end`, `script.end`, `phase.end`, or `run.end`.
- There is **no** `output/cod-test/phase2-process/recovery/video-chunks/` directory and **no** `output/cod-test/phase2-process/script-results/video-chunks.failure.json` (in fact no Phase 2 `script-results` artifacts at all for this rerun), which means the wrapper never reached failure-envelope creation for `video-chunks`.
- `output/cod-test/phase2-process/raw/_meta/errors.jsonl` and `errors.summary.json` are also absent, reinforcing that Phase 2 never unwound through its failure path.
- `server/scripts/process/video-chunks.cjs:783-820` awaits `emotionLensesTool.executeEmotionAnalysisToolLoop(...)` inside the Phase 2 script body; if that await never resolves/rejects, `script.run(...)` never returns to `script-runner`, so recovery cannot engage.
- `server/scripts/process/video-chunks.cjs:1168-1175` confirms `video-chunks` is recovery-enabled (`module.exports.aiRecovery` exists), and `configs/cod-test.yaml:51-68` confirms bounded AI recovery is enabled for the run. So this was **not** a config-disabled case.
- The cassette proves the provider was still doing work below the wrapper boundary: `../digital-twin-openrouter-emotion-engine/cassettes/cod-test-record-20260318-202023.json` has final interaction index `15` at `2026-03-19T00:35:21.485Z` for chunk window `30.0s-35.0s`, and that response contains only the first-turn validator envelope `{"tool":"validate_emotion_analysis_json", ...}`. By comparison, prior chunk 5 completed with the expected two-step pattern: index `13` = validator envelope, index `14` = final artifact JSON. Chunk 6 never reached that second-turn/final-artifact completion.
- The local validator-tool loop design explains the missing recovery trigger: `server/lib/local-validator-tool-loop.cjs:159-413` only emits `tool.loop.complete` and returns after either (a) a validated final artifact is accepted or (b) it throws a retryable error on parse/tool-loop exhaustion. Here we have evidence of neither completion nor thrown failure reaching the wrapper.

Conclusion:
- The hang occurred **below the AI recovery machinery** and **before failure-envelope creation**—specifically inside the Phase 2 `video-chunks` execution path while awaiting completion of the local validator/final-artifact loop for chunk 6 in record mode.
- Because `script-runner` never received a thrown error from `video-chunks`, it never computed `recoveryPolicy.nextAction`, never invoked `attemptAiRecovery(...)`, and never wrote Phase 2 recovery artifacts.

Most likely next fix lane:
- Narrowly instrument/debug the **record-mode Phase 2 tool-loop completion boundary** for chunk 6: trace `emotionLensesTool.executeEmotionAnalysisToolLoop(...)` / `local-validator-tool-loop` and the digital-twin record adapter around the transition from first-turn validator envelope to second-turn final artifact. The symptom points to the run getting stuck between the captured first response and the expected follow-up completion/rejection, not to a failure inside the AI recovery lane itself.

---

## Final Results

**Status:** ✅ Complete

**What We Built:** Reconstructed the blocked record-mode rerun boundary and proved that Phase 2 never entered the AI recovery lane. The last persisted run event is chunk 6 `provider.call.start` at seq `777`; the cassette still captured a later chunk 6 first-turn validator-envelope response at `2026-03-19T00:35:21.485Z`, but the run never emitted `tool.loop.complete`, `provider.call.end`, `attempt.end`, `script.end`, `phase.end`, or any Phase 2 recovery/script-result artifacts. That places the stall below `script-runner`’s recovery boundary, inside the chunk-6 local validator/final-artifact loop path.

**Commits:**
- None (investigation only).

**Lessons Learned:** The presence of `aiRecovery` metadata on a script and enabled recovery config is not enough to prove the lane ran. The decisive boundary is whether the script unwinds back into `script-runner`’s `catch` so `createFailureResult(...)` can classify the failure and set `nextAction.policy = ai_recovery`. Here it never did, so the next fix should target the record-mode/tool-loop completion path rather than the recovery lane policy logic.

---

*Completed on 2026-03-18*
