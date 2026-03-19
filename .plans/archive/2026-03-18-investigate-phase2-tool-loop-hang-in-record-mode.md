# emotion-engine: investigate Phase 2 tool-loop hang in record mode

**Date:** 2026-03-18
**Status:** Complete
**Agent:** Cookie 🍪

---

## Goal

Investigate the Phase 2 record-mode hang at the local validator/final-artifact tool-loop boundary, determine exactly where execution stalls after the first-turn validator envelope arrives, and identify the smallest truthful next fix lane.

---

## Overview

We already resolved the original cassette-path issue and verified that the proper clean-installed runtime now writes new cassettes into the canonical sibling `cassettes/` directory. The new problem is narrower and more interesting: the record-mode `cod-test` rerun stalls in Phase 2 during chunk 6 after the provider returns the first-turn validator-call envelope, but before the local validator/final-artifact path completes. That means the system gets stuck before AI recovery can engage.

This investigation should therefore focus on the tool-loop completion boundary rather than on broad pipeline behavior. The key surfaces are the local validator tool-loop, the emotion analysis tool-loop orchestration, and the digital-twin record adapter behavior in the transition from first-turn tool call response to second-turn final artifact response. The goal is to reconstruct the blocking boundary precisely enough to know whether the next lane is instrumentation, a local validator bugfix, a digital-twin adapter fix, or a record-mode transport/protocol fix.

This plan is investigation-only unless a tiny non-invasive debug aid is absolutely necessary to establish truth.

---

## Tasks

### Task 1: Trace the exact tool-loop completion boundary for the stuck chunk

**Bead ID:** `ee-lk1`
**SubAgent:** `main`
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, investigate the exact Phase 2 tool-loop completion boundary for the stuck record-mode chunk. Use the existing blocked rerun artifacts plus the relevant code paths to trace what should happen after the first-turn validator envelope arrives and where execution actually stops. Focus on emotionLensesTool.executeEmotionAnalysisToolLoop(...), the local validator tool-loop, and any immediate caller/callee boundaries. Update this plan with exact evidence and mark the task complete when the blocking boundary is truthfully reconstructed. Claim the assigned bead on start and close it on completion.`

**Folders Created/Deleted/Modified:**
- `output/`
- `server/`
- sibling tool/provider surfaces if inspected
- `.plans/`

**Files Created/Deleted/Modified:**
- `.plans/2026-03-18-investigate-phase2-tool-loop-hang-in-record-mode.md`

**Status:** ✅ Complete

**Results:** Reconstructed the exact blocking boundary from both the checked-in code path and the blocked record-mode artifacts.

Code-path evidence:
- `server/scripts/process/video-chunks.cjs:783-795` awaits `emotionLensesTool.executeEmotionAnalysisToolLoop(...)`. Nothing in the caller emits `provider.call.end`, builds `candidateChunkResult`, or returns to `script-runner` until that await resolves/rejects.
- `../tools/emotion-lenses-tool.cjs:481-516` immediately delegates that work into `executeLocalValidatorToolLoop(...)`, with `callProvider: ({ prompt }) => provider.complete(...)`. So every turn of the Phase 2 emotion-analysis loop re-enters provider transport through `provider.complete(...)`.
- Inside `server/lib/local-validator-tool-loop.cjs:192-282`, each turn first awaits `callProvider(...)` at line `210`, then parses the returned JSON. If the model returns the canonical tool envelope, lines `244-282` run the local validator synchronously, record validator acceptance/rejection in history, and `continue` to the next loop turn without returning to the caller yet.
- The loop only emits `tool.loop.complete` and returns at `server/lib/local-validator-tool-loop.cjs:392-420`, after a later turn returns a final bare artifact whose normalized value matches the previously validator-accepted value. Any thrown failure would also have to originate from this function before `video-chunks` or `script-runner` can proceed.
- Because `server/lib/script-runner.cjs:33-44` only reaches its `catch` / `createFailureResult(...)` / `attemptAiRecovery(...)` path after `script.run(...)` throws, a stuck await inside `executeLocalValidatorToolLoop(...)` prevents AI recovery from ever being considered.

Artifact evidence:
- The last successful previous chunk (`chunkIndex: 5`) shows the full happy-path boundary in `output/cod-test/_meta/events.jsonl`: seq `772` = `tool.loop.complete`, seq `773` = `provider.call.end`, seq `774` = `attempt.end` at `2026-03-19T00:34:23.111Z`.
- The next chunk starts immediately after: seq `775` = `attempt.start` for `chunkIndex: 6`, seq `776` = `provider.call.start`, seq `777` = prompt artifact write. No later `tool.loop.complete`, `provider.call.end`, `attempt.end`, `script.end`, `phase.end`, or `run.end` was ever recorded for chunk 6.
- The cassette proves chunk 6 did receive a first-turn model response after seq `777`: `../digital-twin-openrouter-emotion-engine/cassettes/cod-test-record-20260318-202023.json` interaction index `15` / `interactionId bf96a95eab8d17f6918ccade4ab33cc1bd55cd797d16c2855acaaf3a187abe72` at `2026-03-19T00:35:21.485Z` contains the canonical first-turn envelope `{"tool":"validate_emotion_analysis_json","emotionAnalysis":{...}}` for window `30.0s-35.0s`.
- Replaying that captured payload against the live validator confirms it is locally acceptable: `../tools/emotion-lenses-tool.cjs` `executeEmotionAnalysisValidatorTool(...)` returns `valid: true` for the cassette payload (same as the prior successful chunk-5 first-turn envelope at cassette index `13`).
- The prior successful chunk-5 cassette pattern is the exact expected two-step sequence: index `13` is the validator envelope, index `14` is the final bare emotion-analysis JSON. Chunk 6 only has the first step captured; there is no second-turn/final-artifact cassette interaction for the same `interactionId`, and no chunk-6 raw capture/result artifact was written under `output/cod-test/phase2-process/`.

Reconstructed boundary:
- The stuck boundary is **after** `executeLocalValidatorToolLoop(...)` receives chunk 6 turn 1, parses the canonical `validate_emotion_analysis_json` envelope, runs the local validator successfully, stores `successfulValidatedValue`, and executes the `continue` at `server/lib/local-validator-tool-loop.cjs:282`.
- The run then needs the next loop iteration to reach `await callProvider(...)` again at `server/lib/local-validator-tool-loop.cjs:210` with the follow-up prompt that asks for the final bare artifact. That second provider round-trip is where control likely stops: it never returns a completion, never throws a retryable error, and therefore never reaches either `tool.loop.complete` / return or the outer failure / recovery boundary.
- So the truthful blocking seam is **between first-turn local validator acceptance and second-turn final-artifact provider completion inside the local validator tool loop**, not in `video-chunks` post-processing and not in `script-runner` / AI recovery.

---

### Task 2: Determine the smallest next fix lane and whether extra instrumentation is needed

**Bead ID:** `ee-3hy`
**SubAgent:** `main`
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, based on the reconstructed blocking boundary, determine the smallest truthful next fix lane. Explicitly say whether existing artifacts/code are already sufficient for a fix, or whether a tiny non-invasive instrumentation pass is needed first. Update this plan with the exact recommended next lane and why, then close the assigned bead.`

**Folders Created/Deleted/Modified:**
- `.plans/`

**Files Created/Deleted/Modified:**
- `.plans/2026-03-18-investigate-phase2-tool-loop-hang-in-record-mode.md`

**Status:** ✅ Complete

**Results:** Smallest truthful next lane: a **tiny non-invasive instrumentation pass at the record adapter / provider-completion seam**, not a direct validator-loop logic fix yet.

Decision on likely bug location:
- **Not the local validator loop logic itself.** Task 1 already proved chunk 6 turn 1 reached the canonical tool envelope path, and that the local validator would accept that payload. The loop’s synchronous validator branch is therefore doing the expected thing before the stall.
- **Not the provider boundary in the broad schema/JSON sense.** The first-turn provider completion already returned valid JSON, parsed cleanly, and matched the existing happy-path shape used by chunk 5.
- **Most likely at the record-only adapter / await seam between second-turn dispatch and completion persistence.** In record mode, `provider.complete(...)` re-enters `digital-twin-router` record transport, whose `record` branch awaits `realTransport(request)` and then separately awaits `engine.record(request, response)`. The current artifacts prove only that execution never made it back out of the second `await callProvider(...)`; they do **not** prove whether the hang is:
  1. inside the live second-turn provider request (`realTransport(request)` never resolves/rejects), or
  2. inside record-mode persistence after a successful provider response (`engine.record(...)` / store write never resolves).
- So the most honest bug bucket today is **record adapter vs timeout/await semantics at the provider-completion seam**, with the local validator loop only acting as the caller that gets stuck.

Why existing artifacts are **not yet sufficient** for a direct fix:
- We have no turn-level breadcrumb after first-turn validator acceptance and before the second-turn provider await returns.
- We also have no adapter-internal breadcrumb separating `realTransport` completion from `engine.record` completion in record mode.
- Because the second-turn cassette interaction is absent, both “provider never came back” and “provider came back but record write hung before persistence” remain viable. Choosing a direct code fix now would be guesswork.

Exact recommended next lane:
- Add a **minimal instrumentation-only pass** that logs bounded, non-sensitive turn/transport milestones for the local validator follow-up call in record mode:
  - in `server/lib/local-validator-tool-loop.cjs`, emit a turn-scoped event immediately before and immediately after each `callProvider(...)`, including `turn`, `promptMode`, and phase/script/chunk context;
  - in `node_modules/digital-twin-router/index.js` (or the owning sibling runtime if that is the true source of installed code), emit one breadcrumb after `realTransport(request)` resolves and another after `engine.record(request, response)` resolves in record mode;
  - optionally add a bounded request timeout / elapsed-ms capture around the awaited provider call, but only as instrumentation or clearly scoped guardrail, not as a speculative behavioral fix.

Why this is the smallest truthful lane:
- It is enough to distinguish **record adapter hang** from **upstream provider await hang** on the very next repro.
- It avoids prematurely mutating validator-loop behavior that already looks correct.
- It keeps the follow-up fix lane honest: once we know whether the stall is before or after response receipt, the next implementation bead can target either record transport persistence or explicit timeout handling with evidence instead of guesswork.

---

## Final Results

**Status:** ⚠️ Investigation complete — instrumentation lane next

**What We Built:** Reconstructed the blocking boundary tightly enough to rule out a direct local-validator bug and recommend the next truthful lane. The hang lives most plausibly at the **record adapter / provider-completion await seam** during the second-turn follow-up call, not in post-loop chunk handling and not in AI recovery. Existing artifacts are **not** sufficient for a direct fix because they do not distinguish “provider never returned” from “record persistence hung after provider returned.” The exact next lane is a tiny instrumentation-only pass across `local-validator-tool-loop` turn boundaries and record-mode `digital-twin-router` transport milestones.

**Commits:**
- None (investigation-only plan update).

**Lessons Learned:** A missing second-turn cassette interaction is not enough by itself to blame the local validator loop. In record mode, the decisive seam is narrower: we need breadcrumbs on both sides of the awaited provider call and inside record persistence before choosing between a record-adapter fix and a timeout/await fix.

---

*Completed on 2026-03-18*
