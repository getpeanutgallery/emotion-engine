# emotion-engine: Xiaomi MiMo high-thinking all-phases rerun

**Date:** 2026-04-03  
**Status:** In Progress  
**Agent:** Cookie 🍪

---

## Goal

Create and run a Xiaomi MiMo-focused cod-test config that uses Xiaomi `mimo-v2-omni` with higher thinking across the relevant phases, then capture fresh artifacts and compare whether this produces more useful signal than the prior Gemini-low-thinking/OpenRouter dialogue lane.

---

## Overview

The current `cod-test-mimo-openrouter-compare.yaml` lane is not the right instrument for the question Derrick now wants answered. Despite the name, that config currently mixes providers by phase: dialogue/music run through OpenRouter Gemini Flash Lite at low thinking, while only the whole-video Phase 2 step uses Xiaomi MiMo. That means the current dialogue artifact is not a Xiaomi MiMo dialogue result, which makes it a poor fit for evaluating whether Xiaomi MiMo with higher reasoning produces stronger cross-phase results.

This new lane should therefore be explicit and honest: use Xiaomi MiMo for the relevant phases we want to test, raise thinking deliberately, and rerun with clear artifact provenance. The implementation should stay narrow. We should either create a new config or tightly clone the current compare lane into a new Xiaomi-high-thinking variant so we do not overwrite the now-useful Gemini/OpenRouter benchmark evidence. After the config is validated, we should run it cleanly without misleading outer watchdog behavior, then inspect whether dialogue, music, and video artifacts all came from Xiaomi MiMo and whether the output quality is meaningfully better.

The config inspection now makes the safe path much clearer. `cod-test-phase1-proof-compare-after-mimo-tranche2.yaml` is useful as a Xiaomi proof surface, but it is not an all-phases rerun lane: it has `process: []`, `report: []`, and only exercises three Phase 1 gather scripts (`get-dialogue`, `get-music`, `get-visual-identity`). By contrast, `cod-test-mimo-openrouter-compare.yaml` already validates and runs the exact narrow three-script cross-phase lane we want: `get-dialogue`, `get-music`, and `whole-video-mimo`.

The other decisive finding is adapter semantics. In this repo, normalized `thinking.level` is currently translated into provider `reasoning` only for the `openrouter` adapter (`server/lib/ai-targets.cjs`). The local `xiaomi` provider currently forwards `temperature`, `max_completion_tokens`, and video knobs like `fps` / `media_resolution`, but it does not map `thinking` / `reasoning` into the outgoing Xiaomi request body (`server/providers/xiaomi.cjs`). That means a no-code "Xiaomi high-thinking" rerun is safest if it stays on the existing compare lane’s OpenRouter surface while swapping every exercised AI target to the Xiaomi MiMo model and raising `thinking.level` there. Switching the whole lane to the direct Xiaomi adapter would likely make “high thinking” a config-only no-op today.

---

## Tasks

### Task 1: Define the Xiaomi MiMo high-thinking test config shape and identify the narrowest safe clone target

**Bead ID:** `ee-w362`  
**SubAgent:** `research`  
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, inspect the current cod-test MiMo compare/proof configs and identify the narrowest safe config surface for a Xiaomi mimo-v2-omni high-thinking all-phases rerun. Recommend whether to clone cod-test-mimo-openrouter-compare.yaml or another nearby config, specify exactly which phases/scripts should be included for this experiment, and define the intended Xiaomi/high-thinking adapter params per phase without modifying code. Update the active plan with the recommended config shape and claim bead ee-w362 on start with bd update ee-w362 --status in_progress --json and close it on completion with bd close ee-w362 --reason "Defined Xiaomi MiMo high-thinking rerun config shape" --json.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `configs/`
- optional `docs/research/`

**Files Created/Deleted/Modified:**
- `.plans/2026-04-03-xiaomi-mimo-high-thinking-all-phases-rerun.md`

**Status:** ✅ Complete

**Results:** Recommended the narrowest safe config shape without code changes:
- **Clone target:** `configs/cod-test-mimo-openrouter-compare.yaml`, not `cod-test-phase1-proof-compare-after-mimo-tranche2.yaml` and not `cod-test-mimo-xiaomi-direct-smoke.yaml`.
- **Why this clone target:** it already matches the desired narrow three-script cross-phase lane and has a proven staged-video URL shape. The proof config is Phase 1-only and broadens into `get-visual-identity`; the Xiaomi-direct smoke config is even narrower and does not preserve the compare lane’s context-gathering behavior.
- **Exact scripts/phases to include for this experiment:**
  - `gather_context:`
    - `server/scripts/get-context/get-dialogue.cjs`
    - `server/scripts/get-context/get-music.cjs`
  - `process:`
    - `server/scripts/process/whole-video-mimo.cjs`
  - `report: []`
- **Phase behavior to preserve from the compare lane:** keep `phase1.dialogue.mode: whole_asset`, `timing_refinement: disabled`, `fallback_to_chunked: false`, and the existing staged `source_video` URL delivery block; do **not** import proof-lane chunking, `dialogue_stitch`, `get-visual-identity`, or `video_identity` into the first rerun.
- **Adapter/model recommendation for the no-code high-thinking rerun:** stay on `adapter.name: openrouter` with `adapter.model: xiaomi/mimo-v2-omni` for every exercised AI target, because the repo currently only maps normalized `thinking.level` through OpenRouter. A direct `adapter.name: xiaomi` config would not reliably express the requested high-thinking change without code work.
- **Intended per-target params:**
  - `ai.dialogue.targets[0].adapter`: `name: openrouter`, `model: xiaomi/mimo-v2-omni`, `params: { max_tokens: 25000, timeoutMs: 180000, thinking: { level: high } }`
  - `ai.music.targets[0].adapter`: `name: openrouter`, `model: xiaomi/mimo-v2-omni`, `params: { max_tokens: 25000, timeoutMs: 180000, thinking: { level: high } }`
  - `ai.video.targets[0].adapter`: `name: openrouter`, `model: xiaomi/mimo-v2-omni`, `params: { max_tokens: 4000, timeoutMs: 180000, thinking: { level: high } }`
- **Explicit exclusions for the first rerun:** no `dialogue_stitch`, no `visual_identity`, no `video_identity`, no Xiaomi-direct-only `fps` / `media_resolution` knobs, and no report scripts. Those are reasonable follow-up expansions, but they broaden the surface beyond the narrow safe answer Derrick asked for.

---

### Task 2: Create the Xiaomi MiMo high-thinking config and validate it without broadening the lane

**Bead ID:** `ee-suta`  
**SubAgent:** `coder`  
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, create a new Xiaomi mimo-v2-omni high-thinking config for the cod-test comparison lane using the agreed shape from the active plan. Keep the change narrow: preserve existing useful benchmark configs, make provenance obvious in the new config name/description/output dir, and wire Xiaomi mimo-v2-omni with higher thinking across the exercised phases. Validate the config with repo validation/dry-run commands, update the plan with exactly what changed, and claim bead ee-suta on start with bd update ee-suta --status in_progress --json and close it on completion with bd close ee-suta --reason "Created and validated Xiaomi MiMo high-thinking rerun config" --json.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `configs/`
- optional `output/`
- optional `.logs/`

**Files Created/Deleted/Modified:**
- `.plans/2026-04-03-xiaomi-mimo-high-thinking-all-phases-rerun.md`
- `configs/cod-test-xiaomi-mimo-v2-omni-openrouter-high-thinking-rerun.yaml`

**Status:** ✅ Complete

**Results:** Created `configs/cod-test-xiaomi-mimo-v2-omni-openrouter-high-thinking-rerun.yaml` as a narrow clone of `configs/cod-test-mimo-openrouter-compare.yaml` rather than mutating the existing benchmark lane.
- **Provenance made explicit:**
  - file name: `cod-test-xiaomi-mimo-v2-omni-openrouter-high-thinking-rerun.yaml`
  - config `name`: `COD Test Xiaomi MiMo v2 Omni OpenRouter High Thinking Rerun`
  - config `description`: explicitly calls this a Xiaomi MiMo v2 Omni OpenRouter rerun with high thinking across dialogue, music, and whole-video analysis
  - `asset.outputDir`: `output/cod-test-xiaomi-mimo-v2-omni-openrouter-high-thinking-rerun`
- **Lane shape preserved:** kept the proven narrow three-script lane unchanged:
  - `gather_context`: `get-dialogue`, `get-music`
  - `process`: `whole-video-mimo`
  - `report: []`
  - preserved the existing staged public S3 `source_video` delivery block and Phase 1 settings (`whole_asset`, no timing refinement, no chunk fallback for dialogue)
- **Exercised AI targets rewired to Xiaomi high-thinking via OpenRouter:**
  - `ai.dialogue.targets[0]`: `openrouter` + `xiaomi/mimo-v2-omni` + `thinking.level: high` + `max_tokens: 25000` + `timeoutMs: 180000`
  - `ai.music.targets[0]`: `openrouter` + `xiaomi/mimo-v2-omni` + `thinking.level: high` + `max_tokens: 25000` + `timeoutMs: 180000`
  - `ai.video.targets[0]`: `openrouter` + `xiaomi/mimo-v2-omni` + `thinking.level: high` + `max_tokens: 4000` + `timeoutMs: 180000`
- **Intentional non-change:** left `ai.dialogue_stitch` untouched because this rerun lane does not exercise stitch, and changing it would broaden the comparison surface beyond the agreed plan.
- **Validation completed:**
  - `npm run validate-configs`
  - `npm run pipeline -- --config configs/cod-test-xiaomi-mimo-v2-omni-openrouter-high-thinking-rerun.yaml --dry-run`
  - both passed; the dry-run reported `Valid (3 script(s) across all phases)`.

---

### Task 3: Run the Xiaomi MiMo high-thinking all-phases lane and verify artifact provenance and completeness

**Bead ID:** `ee-hjk3`  
**SubAgent:** `coder`  
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, run the new Xiaomi mimo-v2-omni high-thinking config cleanly and capture exact commands, logs, timings, and artifact paths. Verify from raw captures and final artifacts that the exercised phases in this lane actually used Xiaomi mimo-v2-omni with the intended higher-thinking settings. Update the active plan with what completed, what failed, and whether the run produced a truthful cross-phase artifact set. Claim bead ee-hjk3 on start with bd update ee-hjk3 --status in_progress --json and close it on completion with bd close ee-hjk3 --reason "Ran Xiaomi MiMo high-thinking all-phases lane and verified provenance" --json.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `output/`
- `.logs/`

**Files Created/Deleted/Modified:**
- `.plans/2026-04-03-xiaomi-mimo-high-thinking-all-phases-rerun.md`
- `.logs/2026-04-03-cod-test-xiaomi-mimo-v2-omni-openrouter-high-thinking-rerun-ee-hjk3.log`
- `.logs/2026-04-03-cod-test-xiaomi-mimo-v2-omni-openrouter-high-thinking-rerun-ee-hjk3.time`
- `output/cod-test-xiaomi-mimo-v2-omni-openrouter-high-thinking-rerun/**`

**Status:** ✅ Complete

**Results:** Executed the live rerun and verified provenance from raw captures, events, and script-result envelopes. The lane did **not** complete cross-phase execution; it failed in Phase 1 before music or video ran.
- **Exact live command:** `npm run pipeline -- --config configs/cod-test-xiaomi-mimo-v2-omni-openrouter-high-thinking-rerun.yaml`
- **Captured run logs:**
  - `.logs/2026-04-03-cod-test-xiaomi-mimo-v2-omni-openrouter-high-thinking-rerun-ee-hjk3.log`
  - `.logs/2026-04-03-cod-test-xiaomi-mimo-v2-omni-openrouter-high-thinking-rerun-ee-hjk3.time`
- **Observed timings:**
  - command start: `2026-04-03T13:27:46Z`
  - pipeline end: `2026-04-03T13:30:41.869Z`
  - pipeline duration: `172543 ms`
  - shell timing from tee log: `real 175.35`, `user 10.44`, `sys 1.13`
  - `get-dialogue` script envelope duration: `170093 ms` (`2026-04-03T13:27:49.367Z` → `2026-04-03T13:30:39.460Z`)
- **What actually executed:** only `phase1-gather-context/get-dialogue` ran. `get-music` and `whole-video-mimo` never started because the pipeline stopped on the Phase 1 failure.
- **Failure outcome:** `invalid_output: exceeded validate_dialogue_transcription_json tool-call limit`
  - script result: `output/cod-test-xiaomi-mimo-v2-omni-openrouter-high-thinking-rerun/phase1-gather-context/script-results/get-dialogue.failure.json`
  - raw error summary: `output/cod-test-xiaomi-mimo-v2-omni-openrouter-high-thinking-rerun/phase1-gather-context/raw/_meta/errors.summary.json`
  - recovery lineage: `output/cod-test-xiaomi-mimo-v2-omni-openrouter-high-thinking-rerun/phase1-gather-context/recovery/get-dialogue/lineage.json`
  - next-action marker: `output/cod-test-xiaomi-mimo-v2-omni-openrouter-high-thinking-rerun/phase1-gather-context/recovery/get-dialogue/next-action.json`
- **Model/settings provenance verified from raw capture:**
  - `output/cod-test-xiaomi-mimo-v2-omni-openrouter-high-thinking-rerun/phase1-gather-context/raw/ai/dialogue-transcription/attempt-01/capture.json`
  - capture shows `adapter.name: openrouter`, `adapter.model: xiaomi/mimo-v2-omni`, and `adapter.params.thinking.level: high`
  - capture also records the failure string and identifies the provider as `openrouter`
- **Events-level provenance verified:** `output/cod-test-xiaomi-mimo-v2-omni-openrouter-high-thinking-rerun/_meta/events.jsonl` shows `provider.call.start`, four `tool.loop.provider.await` turns, and `provider.call.end` / `attempt.end` for `phase1-gather-context/get-dialogue`, all tagged with `provider: openrouter` and `model: xiaomi/mimo-v2-omni`.
- **Truthfulness of final artifact set:** **not a truthful cross-phase artifact set.** The output directory truthfully captures a Xiaomi/high-thinking dialogue attempt and the failure state, but it does **not** contain dialogue success artifacts, music artifacts, or whole-video artifacts from a completed all-phases lane.
- **Material artifacts produced:**
  - `output/cod-test-xiaomi-mimo-v2-omni-openrouter-high-thinking-rerun/assets/input/cod.mp4`
  - `output/cod-test-xiaomi-mimo-v2-omni-openrouter-high-thinking-rerun/assets/input/config.yaml`
  - `output/cod-test-xiaomi-mimo-v2-omni-openrouter-high-thinking-rerun/assets/processed/dialogue/audio.mp3`
  - `output/cod-test-xiaomi-mimo-v2-omni-openrouter-high-thinking-rerun/_meta/events.jsonl`
  - dialogue raw pointer + attempt capture
  - dialogue failure/recovery envelopes
- **What failed vs. plan:** the run was cleanly launched and provenance was captured, but the lane never exercised music or Phase 2 because Xiaomi MiMo high-thinking dialogue exhausted the local validator tool loop before a valid transcription envelope was produced.

---

### Task 4: Review the rerun signal and decide whether Xiaomi MiMo high-thinking is now giving useful cross-phase benchmark evidence

**Bead ID:** `ee-z6c4`  
**SubAgent:** `primary`  
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, review the Xiaomi mimo-v2-omni high-thinking rerun outputs and decide whether the run gives useful signal for Derrick’s comparison goal. Summarize what improved or remained broken across dialogue, music, and video, call out any runtime/cost caveats, and recommend the next lane. Update the active plan with the real result story and claim bead ee-z6c4 on start with bd update ee-z6c4 --status in_progress --json and close it on completion with bd close ee-z6c4 --reason "Reviewed Xiaomi MiMo high-thinking rerun signal and recommended next step" --json.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `output/`
- `.logs/`
- optional `tmp/`

**Files Created/Deleted/Modified:**
- `.plans/2026-04-03-xiaomi-mimo-high-thinking-all-phases-rerun.md`
- optional review notes to be determined

**Status:** ✅ Complete

**Results:** Reviewed the rerun artifacts and compared them against the completed `output/cod-test-mimo-openrouter-compare` control lane. Verdict: **this run does not provide useful cross-phase benchmark signal for Derrick’s comparison goal**, but it does provide a meaningful failure signal about Xiaomi MiMo high-thinking dialogue behavior.
- **Dialogue — partial quality improvement, still structurally broken for benchmarking:**
  - The failed Xiaomi/high-thinking capture contains a much richer draft transcript than the Gemini-low-thinking control lane: **16 segments / 9 speakers** vs the control lane’s **15 segments / 5 speakers**.
  - It appears to recover materially better speaker separation and later-timeline content the control lane missed or collapsed, including distinct later trailer lines around **116–157s** (`"So eager to leave, David"`, `"Killing a man is a hell of a lot easier than killing an idea"`, `"You were never cut out to be a Mason"`, `"No more games. This ends now."`, and the **Reznov Challenge Pack** CTA). The control lane instead ended effectively around **138–139s** with a much thinner dialogue map and heavy speaker collapse into `Speaker 1`.
  - It also fixes at least one obvious wording issue from the control lane (`"Your streets shall once again run red with your blood"` vs the control’s garbled `"Your streets, so once again run red with your blood"`).
  - But the important failure did **not** improve: the Xiaomi lane still died on `invalid_output: exceeded validate_dialogue_transcription_json tool-call limit`, exactly the same failure family already seen in the earlier Xiaomi proof attempt archived at `output/_archives/cod-test-phase1-proof-compare-after-mimo-tranche2-xiaomi-toolloop-limit-20260401-1222`. So the raw draft looks more promising, but the system still cannot turn it into a valid benchmark artifact.
- **Music — no new signal:** `get-music` never ran in the Xiaomi/high-thinking rerun because the pipeline stopped on dialogue failure. The control lane still holds the only usable music artifact, and there is no evidence yet that Xiaomi/high-thinking improves or regresses music analysis in this lane.
- **Video — no new signal:** `whole-video-mimo` never ran in the Xiaomi/high-thinking rerun. The control lane’s Xiaomi whole-video artifact remains the only usable video result. So this rerun does not answer whether raising Xiaomi thinking improves the whole-video output either.
- **Runtime / cost caveat:** this was an expensive failure. The Xiaomi/high-thinking dialogue attempt took **170.1s** at the script level / **168.5s** provider-call time and consumed about **36.9k tokens** (`33,382` input / `3,535` output) before failing validation. By comparison, the control lane completed **all three scripts** in about **190.9s total** (`14.9s dialogue + 100.4s music + 75.6s video`). So the rerun spent almost the entire wall-clock budget of the successful control run on a single failed dialogue step, which makes repeated all-phase Xiaomi/high-thinking reruns a poor cost/perf trade until the dialogue contract path is fixed.
- **Comparison-goal verdict:** useful as a **diagnostic** signal, not useful as a **benchmark** signal. It suggests Xiaomi/high-thinking may produce a more semantically complete dialogue draft, but because it fails validation before music/video execute, it cannot yet be used for Derrick’s apples-to-apples all-phases comparison.
- **Recommended next lane:** do **not** spend another full all-phases rerun on Xiaomi/high-thinking yet. The next highest-value lane is a **narrow dialogue-only Xiaomi stabilization lane** focused on getting one valid dialogue artifact through the validator boundary — likely by testing `retry-with-lower-thinking` explicitly and/or adjusting the local validator-loop contract/repair path for Xiaomi’s verbose structured outputs. Once dialogue can complete successfully, then rerun the same narrow three-script all-phases Xiaomi lane for a truthful cross-phase comparison.

---

## Final Results

**Status:** ⚠️ Partial

**What We Built:** We created and validated a clean Xiaomi MiMo v2 Omni OpenRouter high-thinking rerun config, executed it, and captured truthful raw provenance. The run proved that Xiaomi/high-thinking dialogue currently produces a richer draft transcript than the Gemini-low-thinking control, but it still fails at the validator tool-loop boundary before yielding a valid dialogue artifact. Because of that early stop, the rerun produced **no new music or video artifacts**, so it does **not** provide the cross-phase comparison evidence Derrick wanted.

**Commits:**
- Pending

**Lessons Learned:**
- Xiaomi/high-thinking is currently more promising for raw dialogue completeness than the Gemini-low-thinking control, but that benefit is trapped behind the local validator tool-loop limit.
- Re-running the full three-script lane before fixing or bypassing the dialogue validator failure is wasteful; the blocking problem is in the dialogue contract boundary, not in music/video orchestration.
- The right next experiment is narrower: stabilize Xiaomi dialogue first, then return to the cross-phase rerun once dialogue can finish cleanly.

---

*Completed on 2026-04-03*
