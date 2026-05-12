# emotion-engine: investigate lean dialogue retry failure and define repair path

**Date:** 2026-04-07  
**Status:** Complete  
**Agent:** Cookie 🍪

---

## Goal

Investigate the lean dialogue runtime failure on cod-test, identify why the invalid-output repair path exhausted the validator/tool-call limit, and define the most direct repair path before further rollout.

---

## Overview

The new lean dialogue runtime is partly working: it reduced model-facing noise and accepted at least one chunk on first valid JSON. But the live cod-test lane still failed because a later chunk escalated through `lean` to `lean_repair` and then died with `invalid_output: exceeded validate_dialogue_transcription_json tool-call limit`.

That means the strategy still looks right, but the repair path is not complete or not robust enough. Before we keep validating or roll this pattern out to other AI flows, we need to understand exactly where the lean path is still falling back into the old validator/tool-call assumptions, what the model saw on the failing chunk, and whether the fix belongs in shared runtime code, dialogue-specific prompting, or both.

This lane should stay diagnostic-first. The immediate output should be a clear failure analysis and a concrete repair recommendation, not broad new implementation. Once we know the root cause, we can decide whether to patch the shared lean helper, the dialogue script integration, or the retry messaging.

---

## Tasks

### Task 1: Investigate the failing lean dialogue chunk and recommend a repair path

**Bead ID:** `ee-kt4x`  
**SubAgent:** `research`  
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, investigate the lean dialogue runtime failure from the latest cod-test validation. Trace why the run escalated from lean to lean_repair and then failed with invalid_output: exceeded validate_dialogue_transcription_json tool-call limit. Inspect the relevant runtime code, logs, events, and failing capture artifacts; determine what the model likely saw and how the retry logic actually behaved; and recommend the most direct repair path. Update this plan truthfully with exact files inspected, root-cause analysis, and repair recommendation. Do not implement code yet. Claim the assigned bead at start with bd update <ID> --status in_progress --json and close it on completion with bd close <ID> --reason "Lean dialogue retry failure investigated" --json.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `.logs/`
- `output/`
- `server/lib/`
- `server/scripts/get-context/`

**Files Created/Deleted/Modified:**
- `.plans/2026-04-07-investigate-lean-dialogue-retry-failure-and-repair-path.md`
- `.logs/2026-04-07-lean-runtime-dialogue-validation-ee-obkg.log` (inspection only)
- `output/cod-test/_meta/events.jsonl` (inspection only)
- `output/cod-test/phase1-gather-context/script-results/get-dialogue.failure.json` (inspection only)
- `output/cod-test/phase1-gather-context/raw/_meta/errors.summary.json` (inspection only)
- `output/cod-test/phase1-gather-context/raw/ai/dialogue-chunks/chunk-0003/attempt-01/capture.json` (inspection only)
- `server/lib/local-validator-tool-loop.cjs` (inspection only)
- `server/scripts/get-context/get-dialogue.cjs` (inspection only)

**Status:** ✅ Complete

**Results:** Investigated the failing cod-test dialogue run by inspecting `.logs/2026-04-07-lean-runtime-dialogue-validation-ee-obkg.log`, `output/cod-test/_meta/events.jsonl`, `output/cod-test/phase1-gather-context/script-results/get-dialogue.failure.json`, `output/cod-test/phase1-gather-context/raw/_meta/errors.summary.json`, `output/cod-test/phase1-gather-context/raw/ai/dialogue-chunks/chunk-0003/attempt-01/capture.json`, `output/cod-test/_meta/ai/_prompts/87902d80b50bfe1e8d7d60af0a1dc6bb163a6b1066bd78ba25a042c0693f5153.json`, `server/lib/local-validator-tool-loop.cjs`, `server/lib/ai-recovery-runtime.cjs`, `server/lib/structured-output.cjs`, `server/lib/phase1-validator-tools.cjs`, and `server/scripts/get-context/get-dialogue.cjs`.

Root cause: this is a multi-layer failure, but the decisive break is in shared lean runtime behavior. `get-dialogue` runs `executeLocalValidatorToolLoop(..., runtimeStyle: 'lean')` from `server/scripts/get-context/get-dialogue.cjs`, which means the model never sees the explicit tool contract/history loop and only receives the base prompt plus appended `LOCAL VALIDATION REPAIR` text. For chunk 0003, the model first returned invalid `inferred_traits` entries as string arrays, then objects missing `value`, then objects missing `trait`. On turn 4 it finally returned `inferred_traits: { traits: [] }`, which appears schema-valid in the capture. But in `server/lib/local-validator-tool-loop.cjs`, lean mode still auto-validates each final JSON candidate, consuming one validator call per turn. With the default budget (`maxTurns=4`, `maxValidatorCalls=3`), turns 1-3 spent the full validator budget on rejected candidates. When turn 4 returned a plausible final JSON object, the runtime hit the guard at lines 515-535 and threw `invalid_output: exceeded validate_dialogue_transcription_json tool-call limit` before revalidating that last candidate. So the run escalated `lean` -> `lean_repair` correctly, but the final repair attempt was never checked.

What the model likely saw: the normal chunk transcription prompt with handoff/segmentation/speaker rules plus a compact repair addendum that only summarized a few validator errors (for example the missing `trait` field) and told it to return final JSON directly. The capture also shows the model's internal reasoning overfit to the visible prompt example (`traits: []`) and guessed the missing schema repeatedly: strings first, then `{ trait, confidence }`, then `{ value }`, then finally empty arrays. Because the lean repair addendum only surfaces the current validation failures, not the full nested inferred-traits object contract (`{ trait, value, confidence?, note? }`), the model had to infer the schema from partial error messages. That caused three failed auto-validations before it converged.

Most direct repair path: patch the shared lean runtime first, then tighten dialogue-specific repair guidance. The primary fix should be in `server/lib/local-validator-tool-loop.cjs`: in lean mode, allow the last turn to auto-validate even when `validatorCalls === maxValidatorCalls`, or reserve one validator call for the final candidate / make the lean path budget `maxTurns` validations instead of `maxValidatorCalls`. Right now the loop permits 4 model turns but only 3 validations, which makes a final-turn repair impossible if every prior turn required validation. After that shared fix, add a dialogue-specific repair hint in `server/scripts/get-context/get-dialogue.cjs` (or the validator contract/prompt example) that explicitly shows inferred trait entries as objects with both `trait` and `value`, or instructs the model to prefer `traits: []` when unsure. That secondary change should reduce needless retries, but it is not sufficient by itself because the runtime currently drops a potentially valid turn-4 repair on the floor.

---

## Final Results

**Status:** ✅ Complete

**What We Built:** A documented failure analysis for the lean dialogue repair path, including the event timeline for chunk 0003, the exact validator/schema mismatch on `inferred_traits`, and a direct repair recommendation centered on the shared lean runtime budget/check ordering.

**Commits:**
- None. Investigation and plan update only.

**Lessons Learned:** The lean runtime currently mixes a reduced-prompt repair strategy with the old validator budget assumptions. If lean mode allows more model turns than validator passes, the last repair turn can become untestable even when the candidate is likely valid. Compact repair prompts also need one or two schema anchors for nested objects whose shape is not obvious from high-level examples.

---

*Completed on 2026-04-07*