# emotion-engine: implement shared lean runtime cleanup starting with dialogue

**Date:** 2026-04-07  
**Status:** In Progress  
**Agent:** Cookie 🍪

---

## Goal

Implement a shared lean runtime cleanup pattern for AI-backed flows, starting with dialogue, so model-facing prompts focus on task behavior while local validation stays mostly invisible, first valid JSON is accepted immediately, and retries happen only when output is invalid.

---

## Overview

The prompt/runtime audit confirmed that dialogue is not an isolated case. Several AI-backed flows across phase 1, phase 2, and phase 3 share the same design smell: model-visible tool-loop mechanics, turn-budget chatter, replayed conversation state, and redundant validate-then-resend success behavior. The preferred direction is now clear: preserve real domain context, but remove runtime self-talk from model-facing prompts wherever possible.

This implementation lane starts with dialogue first because dialogue currently has the clearest quality pain and already has an approved lean prompt draft at `docs/dialogue-transcription-prompt-v2-1-draft-2026-04-07.md`. The goal is to wire that leaner behavior into the live runtime path, validate that first-valid JSON is auto-accepted, and confirm invalid outputs still get a strong correction-only retry path. After dialogue is stable, we can roll the same cleanup pattern through the other affected flows in priority order.

The design direction for the shared runtime is now explicit:

- **Model-facing prompt:** task guidance + required JSON shape + flow-specific domain context only.
- **Hidden local runtime:** schema validation, malformed-output handling, retry budgets, and bounded repair instructions.
- **Success path:** first valid JSON is accepted immediately; no model-visible validator handshake and no success-path resend requirement.
- **Failure path:** invalid JSON/schema gets a concise repair-only follow-up using bounded failure context, not a replay of tool contracts, budgets, or prior loop transcript.
- **Context rule:** keep domain continuity (chunk handoff, rolling summaries, whole-asset scaffolding, additive evidence) but remove runtime self-talk.

The current repo already contains two promising seams for this cleanup: `server/lib/local-validator-tool-loop.cjs`, which centralizes the loop-family runtime, and `server/lib/ai-recovery-runtime.cjs`, which already knows how to express bounded repair context. The intended implementation shape is to evolve those shared seams so dialogue can switch first, then reuse the same runtime pattern for the other loop-based flows instead of hand-patching prompts one script at a time.

---

## Shared lean runtime design

### Target runtime behavior

For loop-based AI flows (`get-dialogue`, chunked `get-music`, chunked `get-music-vocals`, `get-visual-identity`, `whole-video-mimo`, later `video-chunks`, later `recommendation`):

1. Send only the base task prompt plus any legitimate domain continuity context.
2. Ask for final JSON directly; do not expose validator tool envelopes, acceptance sequencing, budget state, or loop transcript.
3. Attempt local parse + validation on the first model response.
4. If valid, accept immediately and return the normalized artifact.
5. If invalid, issue a bounded repair prompt that includes only:
   - reminder to return JSON only
   - short schema / validation failure summary
   - optional bounded context summary when truly needed
6. Retry within internal turn / validator budgets, but keep those budgets hidden from the model.
7. Persist observability artifacts locally so debugging still has prompt / response / validation history, even though the model no longer sees the runtime scaffolding.

For direct JSON passes (whole-asset `get-music`, whole-asset `get-music-vocals`):

- keep the simple “return JSON only” shape
- add the same bounded repair retry behavior for invalid JSON/schema
- do **not** introduce a fake visible tool loop just for uniformity

### Shared vs flow-specific boundary

**Shared runtime responsibilities**
- hidden retry loop mechanics
- first-valid auto-accept behavior
- parse / schema / malformed-envelope failure normalization
- repair prompt/addendum construction
- internal budget accounting
- tool-loop / retry observability artifacts

**Flow-specific responsibilities**
- base task prompt text
- schema / validator contract for each artifact
- domain continuity context (handoff notes, rolling summary, lyric scaffold, additive evidence)
- any flow-specific repair hints that are genuinely domain-specific rather than generic runtime guidance

### Likely shared helpers / code seams to change

#### 1. `server/lib/local-validator-tool-loop.cjs`
Primary shared seam for loop-based cleanup.

Likely changes:
- replace `buildLocalValidatorToolPrompt()` with a leaner prompt builder strategy that separates:
  - initial model-facing task prompt
  - hidden repair follow-up prompt for invalid output
- stop appending model-visible sections for:
  - `LOCAL TOOL LOOP`
  - tool contract dump
  - current turn budget
  - conversation state replay
- make the runtime treat first valid auto-validated JSON as terminal success, without implying a later resend contract
- preserve internal history for observability/debugging, but stop serializing it back into the model prompt
- likely rename/refactor the helper toward a repair-oriented runtime concept rather than a tool-loop prompt concept

#### 2. `server/lib/ai-recovery-runtime.cjs`
Best existing shared seam for bounded repair wording.

Likely changes:
- extend or reuse `buildRecoveryPromptAddendum()` ideas for same-attempt repair prompts, not just cross-attempt recovery re-entry
- add a small shared builder for concise invalid-output repair instructions / summaries
- keep the repair payload bounded and schema-focused

#### 3. Dialogue call-site seam in `server/scripts/get-context/get-dialogue.cjs`
First rollout target.

Likely changes:
- swap `buildTranscriptionPrompt()` toward the approved lean v2.1 prompt direction
- ensure dialogue chunk and stitch paths call the shared runtime in lean mode
- keep dialogue-specific continuity/handoff context, but stop relying on prompt-visible validator loop behavior
- likely touch both:
  - transcription path helpers
  - stitch path helpers
  - validator-tool contract wrappers only insofar as the shared runtime still needs local validation callbacks

#### 4. Reuse seam for the other shared-loop flows
After dialogue, the same runtime helper should be applied to:
- `server/scripts/get-context/get-music.cjs`
- `server/scripts/get-context/get-music-vocals.cjs`
- `server/scripts/get-context/get-visual-identity.cjs`
- `server/scripts/process/whole-video-mimo.cjs`

These should mostly keep their domain prompts/context and swap out the noisy runtime wrapper.

#### 5. Separate follow-on seams for older/custom loop families
Not for Task 1 implementation yet, but explicitly in rollout scope:
- `server/scripts/report/recommendation.cjs`
- `server/scripts/process/video-chunks.cjs`
- `/home/derrick/.openclaw/workspace/projects/peanut-gallery/tools/lib/local-validator-tool-loop.cjs`
- `/home/derrick/.openclaw/workspace/projects/peanut-gallery/tools/emotion-lenses-tool.cjs`

These paths still enforce or imply validate-then-resend behavior, so they likely need either:
- adoption of the emotion-engine lean runtime helper, or
- a sibling helper refactor that matches the same first-valid / repair-only semantics

### Rollout order

1. **Dialogue (`server/scripts/get-context/get-dialogue.cjs`)**
   - use the approved v2.1 prompt direction
   - prove the shared helper can hide runtime mechanics cleanly
   - validate first-valid acceptance and bounded repair retry behavior

2. **Recommendation + video-chunks**
   - highest next-value because both still materially retain success-path resend behavior
   - recommendation is in-repo custom logic
   - video-chunks spans emotion-engine + sibling `tools` helper

3. **Visual identity + whole-video-mimo**
   - cleaner base prompts mean shared runtime cleanup should be relatively straightforward

4. **Chunked music + chunked music-vocals**
   - same runtime cleanup, but preserve rolling summaries / lyric scaffold carefully

5. **Whole-asset music + whole-asset music-vocals**
   - lighter adjacent cleanup: bounded invalid-output repair, not loop-family prompt surgery

### Exact files likely involved

Design-confirmed likely implementation files:

- `.plans/2026-04-07-implement-shared-lean-runtime-cleanup-starting-with-dialogue.md`
- `docs/cross-phase-ai-flow-audit-2026-04-07.md`
- `docs/dialogue-transcription-prompt-v2-1-draft-2026-04-07.md`
- `server/lib/local-validator-tool-loop.cjs`
- `server/lib/ai-recovery-runtime.cjs`
- `server/scripts/get-context/get-dialogue.cjs`
- `server/scripts/get-context/get-music.cjs`
- `server/scripts/get-context/get-music-vocals.cjs`
- `server/scripts/get-context/get-visual-identity.cjs`
- `server/scripts/process/whole-video-mimo.cjs`
- `server/scripts/report/recommendation.cjs`
- `server/scripts/process/video-chunks.cjs`
- `/home/derrick/.openclaw/workspace/projects/peanut-gallery/tools/lib/local-validator-tool-loop.cjs`
- `/home/derrick/.openclaw/workspace/projects/peanut-gallery/tools/emotion-lenses-tool.cjs`

No code has been changed yet in those runtime files during this task; they are listed here as the implementation seams identified by the design pass.

---

## Tasks

### Task 1: Design and document the shared lean runtime cleanup pattern

**Bead ID:** `ee-6ceh`  
**SubAgent:** `research`  
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, design the shared lean runtime cleanup pattern for AI-backed flows based on the approved direction and the cross-phase audit. Define the target runtime behavior, identify the shared helper(s) or code seams likely to change, and propose rollout order starting with dialogue. Update this plan truthfully with the design and exact files likely involved. Do not implement code yet. Claim the assigned bead at start with bd update <ID> --status in_progress --json and close it on completion with bd close <ID> --reason "Lean runtime cleanup design documented" --json.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `server/lib/`
- `server/scripts/`
- `docs/`

**Files Created/Deleted/Modified:**
- `.plans/2026-04-07-implement-shared-lean-runtime-cleanup-starting-with-dialogue.md`
- `server/lib/local-validator-tool-loop.cjs` (identified seam only; no code change yet)
- `server/lib/ai-recovery-runtime.cjs` (identified seam only; no code change yet)
- `server/scripts/get-context/get-dialogue.cjs` (identified first rollout target only; no code change yet)
- `server/scripts/get-context/get-music.cjs` (identified follow-on seam only; no code change yet)
- `server/scripts/get-context/get-music-vocals.cjs` (identified follow-on seam only; no code change yet)
- `server/scripts/get-context/get-visual-identity.cjs` (identified follow-on seam only; no code change yet)
- `server/scripts/process/whole-video-mimo.cjs` (identified follow-on seam only; no code change yet)
- `server/scripts/report/recommendation.cjs` (identified later rollout seam only; no code change yet)
- `server/scripts/process/video-chunks.cjs` (identified later rollout seam only; no code change yet)
- `/home/derrick/.openclaw/workspace/projects/peanut-gallery/tools/lib/local-validator-tool-loop.cjs` (identified sibling seam only; no code change yet)
- `/home/derrick/.openclaw/workspace/projects/peanut-gallery/tools/emotion-lenses-tool.cjs` (identified sibling seam only; no code change yet)

**Status:** ✅ Complete

**Results:** Completed design pass only. Defined the target lean runtime behavior, separated shared runtime responsibilities from flow-specific prompt/context responsibilities, identified `server/lib/local-validator-tool-loop.cjs` and `server/lib/ai-recovery-runtime.cjs` as the main shared seams, and documented a rollout order of dialogue → recommendation/video-chunks → visual-identity/whole-video-mimo → chunked music/music-vocals → whole-asset music/music-vocals. No implementation code was changed in this task.

---

### Task 2: Implement the lean runtime cleanup for dialogue first

**Bead ID:** `ee-d63w`  
**SubAgent:** `coder`  
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, implement the approved lean runtime cleanup for the dialogue flow first. Use the preferred prompt direction from docs/dialogue-transcription-prompt-v2-1-draft-2026-04-07.md. The dialogue path should keep local validation on our side, accept the first valid JSON immediately, retry only when output is invalid, preserve strong task guidance, and remove model-visible tool-contract / budget / conversation-state clutter. Add or update focused tests, update this plan truthfully, and keep the implementation as shared/helper-oriented as practical. Claim the assigned bead at start with bd update <ID> --status in_progress --json and close it on completion with bd close <ID> --reason "Dialogue lean runtime cleanup implemented" --json.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `server/lib/`
- `server/scripts/get-context/`
- `test/`

**Files Created/Deleted/Modified:**
- `.plans/2026-04-07-implement-shared-lean-runtime-cleanup-starting-with-dialogue.md`
- `server/lib/local-validator-tool-loop.cjs`
- `server/lib/ai-recovery-runtime.cjs`
- `server/scripts/get-context/get-dialogue.cjs`
- `test/lib/local-validator-tool-loop.test.js`
- `test/scripts/get-dialogue.test.js`

**Status:** ✅ Complete

**Results:** Implemented the dialogue-first lean runtime path without changing the default shared loop contract for other flows. `server/lib/local-validator-tool-loop.cjs` now supports a shared `runtimeStyle: 'lean'` mode that keeps local validation internal, sends the base task prompt on the first turn, auto-validates direct JSON locally, accepts the first valid JSON immediately, and uses a bounded repair follow-up instead of replaying tool contracts, budgets, or conversation state. `server/lib/ai-recovery-runtime.cjs` now exposes a shared bounded repair addendum builder used by the lean loop. `server/scripts/get-context/get-dialogue.cjs` opts dialogue transcription into lean runtime mode and rewrites the whole-asset and chunk prompts toward the approved v2.1 direction: stronger spoken-dialogue-only guidance, conservative speaker continuity rules, damaged-speech literalism, timeline honesty, and runtime-free prompt wording while preserving chunk handoff / opening provenance context. Focused tests were updated to prove the lean prompt path, bounded repair retry behavior, and revised dialogue prompt expectations.

**Tests Run:**
- `node --test test/lib/local-validator-tool-loop.test.js test/scripts/get-dialogue.test.js`

---

### Task 3: Validate dialogue behavior on cod-test and judge whether the lean runtime improves the lane

**Bead ID:** `ee-obkg`  
**SubAgent:** `research`  
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, validate the dialogue lean runtime cleanup against cod-test. Confirm the new runtime behavior actually matches the intended design (first-valid JSON accepted, invalid JSON retried cleanly, less model-facing noise) and judge whether dialogue quality improves or at least avoids regression. Update this plan truthfully with commands, artifacts, and findings. Claim the assigned bead at start with bd update <ID> --status in_progress --json and close it on completion with bd close <ID> --reason "Dialogue lean runtime cleanup validated" --json.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `output/`
- `docs/`
- `benchmarks/fixtures/cod-test/_reports/`

**Files Created/Deleted/Modified:**
- `.plans/2026-04-07-implement-shared-lean-runtime-cleanup-starting-with-dialogue.md`
- `.logs/2026-04-07-lean-runtime-dialogue-validation-ee-obkg.log`
- `output/cod-test/phase1-gather-context/raw/ai/dialogue-chunks/chunk-0000/attempt-01/capture.json`
- `output/cod-test/phase1-gather-context/raw/ai/dialogue-chunks/chunk-0001/attempt-01/capture.json`
- `output/cod-test/phase1-gather-context/raw/ai/dialogue-chunks/chunk-0002/attempt-01/capture.json`
- `output/cod-test/phase1-gather-context/raw/ai/dialogue-chunks/chunk-0003/attempt-01/capture.json`
- `output/cod-test/phase1-gather-context/raw/ai/dialogue-chunk-0000.json`
- `output/cod-test/phase1-gather-context/raw/ai/dialogue-chunk-0001.json`
- `output/cod-test/phase1-gather-context/raw/ai/dialogue-chunk-0002.json`
- `output/cod-test/phase1-gather-context/raw/ai/dialogue-chunk-0003.json`
- `output/cod-test/phase1-gather-context/raw/ffmpeg/dialogue/chunk-plan.json`
- `output/cod-test/phase1-gather-context/raw/ffmpeg/dialogue/chunks/chunk_000.mp3`
- `output/cod-test/phase1-gather-context/raw/ffmpeg/dialogue/chunks/chunk_001.mp3`
- `output/cod-test/phase1-gather-context/raw/ffmpeg/dialogue/chunks/chunk_002.mp3`
- `output/cod-test/phase1-gather-context/raw/ffmpeg/dialogue/chunks/chunk_003.mp3`
- `output/cod-test/phase1-gather-context/raw/_meta/errors.jsonl`
- `output/cod-test/phase1-gather-context/raw/_meta/errors.summary.json`
- `output/cod-test/phase1-gather-context/script-results/get-dialogue.failure.json`
- `output/cod-test/phase1-gather-context/recovery/get-dialogue/lineage.json`
- `output/cod-test/phase1-gather-context/recovery/get-dialogue/next-action.json`
- `output/cod-test/_meta/events.jsonl`

**Status:** ✅ Complete

**Results:** Validation completed against the real `configs/cod-test.yaml` live lane, and the result was negative for runtime stability. Exact commands run:
- `bd update ee-obkg --status in_progress --json`
- `node --test test/lib/local-validator-tool-loop.test.js test/scripts/get-dialogue.test.js`
- `node server/run-pipeline.cjs --config configs/cod-test.yaml --clean-live-digital-twin --verbose 2>&1 | tee .logs/2026-04-07-lean-runtime-dialogue-validation-ee-obkg.log`
- inspection commands over `output/cod-test/...`, `benchmarks/fixtures/cod-test/...`, and `output/cod-test/_meta/events.jsonl`

Runtime-behavior finding:
- The live dialogue path **did switch into the new lean runtime modes**. In `output/cod-test/_meta/events.jsonl`, chunk 2 completed in `promptMode: "lean"` with `validatorCalls: 1`, which matches the intended first-valid acceptance behavior for that chunk.
- However, chunk 3 did **not** validate cleanly. The live run escalated through `promptMode: "lean"` then three `promptMode: "lean_repair"` turns and failed with `invalid_output: exceeded validate_dialogue_transcription_json tool-call limit`.
- The failure is recorded in:
  - `output/cod-test/phase1-gather-context/script-results/get-dialogue.failure.json`
  - `output/cod-test/phase1-gather-context/raw/_meta/errors.summary.json`
  - `output/cod-test/phase1-gather-context/raw/ai/dialogue-chunks/chunk-0003/attempt-01/capture.json`
  - `output/cod-test/_meta/events.jsonl`
- So the runtime only **partially** matched the intended design: first-valid acceptance works on some chunks, and the model-facing prompt is leaner than the old visible tool-loop path, but invalid output did **not** retry cleanly enough to finish the real cod-test lane. The chunk-3 raw capture still shows repeated repair prompting around schema issues before hitting the validator-call ceiling.

Quality / benchmark finding:
- The live lean-runtime validation run **did not produce a new final dialogue artifact**. `output/cod-test/phase1-gather-context/dialogue-data.json` and `dialogue-data.reconciled.json` remained stale from the prior successful run (`2026-04-06` mtimes), because the pipeline failed during live Phase 1 before writing a new dialogue artifact.
- Because the run failed before benchmark completion, `benchmarks/fixtures/cod-test/_reports/artifact-results/dialogueData.json` and `benchmarks/fixtures/cod-test/_reports/benchmark-summary.json` were **not updated** by this validation run.
- The last available benchmark artifact remains:
  - truth: `benchmarks/fixtures/cod-test/truth/dialogue-data.json`
  - last report: `benchmarks/fixtures/cod-test/_reports/artifact-results/dialogueData.json`
  - last output path referenced by that report: `output/cod-test/phase1-gather-context/dialogue-data.reconciled.json`
- Current benchmark status therefore stays at the previously generated failing result: `status: "fail"`, `67/198` fields passed, accuracy `0.3383838383838384`, with the known 18-vs-20 segment mismatch and major fused-line / speaker-collapse issues.
- Net judgement: the lean runtime change **reduced prompt/runtime noise and showed partial first-valid success**, but for the real cod-test lane the operational outcome is currently **worse**, not better, because the live run now failed before producing a fresh benchmarkable dialogue artifact. Dialogue quality cannot be credited as improved on this validation because no new full artifact/report was produced.

Key artifact/report paths inspected:
- `.logs/2026-04-07-lean-runtime-dialogue-validation-ee-obkg.log`
- `output/cod-test/_meta/events.jsonl`
- `output/cod-test/phase1-gather-context/script-results/get-dialogue.failure.json`
- `output/cod-test/phase1-gather-context/raw/_meta/errors.summary.json`
- `output/cod-test/phase1-gather-context/raw/ai/dialogue-chunks/chunk-0003/attempt-01/capture.json`
- `output/cod-test/phase1-gather-context/dialogue-data.json` (stale prior artifact; not rewritten by this run)
- `output/cod-test/phase1-gather-context/dialogue-data.reconciled.json` (stale prior artifact; still the artifact referenced by the last benchmark report)
- `benchmarks/fixtures/cod-test/truth/dialogue-data.json`
- `benchmarks/fixtures/cod-test/_reports/artifact-results/dialogueData.json`
- `benchmarks/fixtures/cod-test/_reports/benchmark-summary.json`

Plain-language tradeoff:
- **Better:** less model-facing runtime clutter; some chunks now accept on first valid JSON without the old visible tool-contract loop.
- **Worse:** the real live lane still has a repair-path failure mode severe enough to abort the run, so the benchmark lane is not yet safely improved.

---

### Task 4: Extend the shared cleanup plan to the next AI flows in priority order

**Bead ID:** `ee-5knr`  
**SubAgent:** `research`  
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, after dialogue validation, update the rollout plan for the next AI-backed flows that should receive the same lean runtime cleanup pattern. Use the cross-phase audit findings to recommend a concrete priority order and call out any flows that need exceptions. Update this plan truthfully with that rollout order. Claim the assigned bead at start with bd update <ID> --status in_progress --json and close it on completion with bd close <ID> --reason "Post-dialogue rollout order updated" --json.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `docs/`

**Files Created/Deleted/Modified:**
- `.plans/2026-04-07-implement-shared-lean-runtime-cleanup-starting-with-dialogue.md`
- docs/ (rollout note if needed)

**Status:** ⏳ Pending

**Results:** Pending.

---

## Final Results

**Status:** ⏳ Pending

**What We Built:** Design completed for the shared lean runtime cleanup pattern. Implementation and validation remain pending.

**Commits:**
- Pending.

**Lessons Learned:** The existing shared engine loop is already closer to the target than the prompt contract suggests; the biggest win is to hide the runtime scaffolding and reuse bounded repair messaging instead of rewriting each task prompt in isolation.

---

*Updated on 2026-04-07 during Task 1 design pass*