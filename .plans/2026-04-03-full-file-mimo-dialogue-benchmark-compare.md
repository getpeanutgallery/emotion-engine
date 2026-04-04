# emotion-engine: full-file MiMo dialogue benchmark compare

**Date:** 2026-04-03  
**Status:** In Progress  
**Agent:** Cookie 🍪

---

## Goal

Ensure the Xiaomi/OpenRouter MiMo dialogue comparison lane is configured to process the full cod test asset without early timeout/truncation, then generate fresh trustworthy run artifacts and compare them against the human-verified dialogue benchmark.

---

## Overview

The repo is now past the old OpenRouter transport bug, and we already have evidence that OpenRouter MiMo can produce a benchmarkable dialogue artifact that modestly improves over the older baseline. But that evidence is not yet sufficient to treat the lane as settled, because the next decision depends on whether the run we compare is a **full-file** run rather than a partially truncated or watchdog-clipped result.

Yesterday’s work shifted the real risk from URL wiring to dialogue-run integrity. Two concrete failure modes need to be ruled out before any comparison is treated as meaningful: (1) the YAML/runtime contract may still allow the run to stop early because of provider/script timeout or outer watchdog limits, and (2) the dialogue artifact may still miss the late trailer block, which would poison the benchmark comparison and make model-vs-model conclusions unreliable.

This plan therefore starts with a narrow configuration/truth audit. We should first verify the relevant test config explicitly supports full-file evaluation and identify any remaining early-cutoff hazards: chunk plan limits, whole-asset duration gating, provider timeout values, tool-loop turn caps, retry/recovery posture, and any outer shell timeout used during execution. Only after those guardrails are locked should we generate fresh comparison runs and score them against the human benchmark.

---

## Tasks

### Task 1: Audit the current MiMo dialogue comparison config for full-file safety and identify any early-cutoff hazards

**Bead ID:** `ee-0och`  
**SubAgent:** `research`  
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, audit the current Xiaomi/OpenRouter MiMo dialogue comparison configs and adjacent runner assumptions to determine whether they guarantee a truthful full-file dialogue evaluation of the cod asset. Focus on settings that could cause early cutoff or misleading benchmark results: max_chunks, chunk duration, whole-asset duration thresholds, provider timeoutMs, tool-loop turn limits, retry/recovery posture, staged URL vs local path behavior, and any outer watchdog assumptions used in our recent runs. Update the active plan with the exact risks found and the minimum config/runner changes needed before generating new benchmark-comparison artifacts. Claim bead ee-0och on start with bd update ee-0och --status in_progress --json and close it on completion with bd close ee-0och --reason "Audited MiMo dialogue compare lane for full-file safety" --json.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `configs/`
- optional `docs/research/`
- optional `.logs/`

**Files Created/Deleted/Modified:**
- `.plans/2026-04-03-full-file-mimo-dialogue-benchmark-compare.md`
- optional audit note to be determined

**Status:** ✅ Complete

**Results:** Audit complete. The current MiMo dialogue compare lane does **not** yet guarantee a truthful full-file dialogue evaluation for `examples/videos/emotion-tests/cod.mp4`; it only guarantees that the script will *attempt* a full-file/hybrid run.

Exact source-backed risks found:
- `settings.max_chunks` / `settings.chunk_duration` are **not the operative Phase 1 dialogue guardrails** here. `server/scripts/get-context/get-dialogue.cjs` uses `audio-preflight` + `settings.phase1.dialogue.*` and its own chunk planner; the familiar `max_chunks` cap is a Phase 2 `video-chunks` concept, so relying on `100 x 8s` as proof of full-file dialogue coverage is misleading.
- In `configs/cod-test-mimo-openrouter-compare.yaml`, Phase 1 dialogue is `mode: hybrid` with `timing_refinement: chunk_refine`, `max_whole_asset_duration_seconds: 180`, and `fallback_to_chunked: true`. Because `cod.mp4` is ~`140.016s` (under the 180s threshold) **and** the extracted audio is within the inline Base64 budget, the script attempts a whole-asset pass *and then still forces chunk refinement*. The current artifact confirms that with `analysisMode: "chunked"`, `sourceStrategy: "base64"`, `provenance.usedChunking: true`, `chunkCount: 9`, and `provenance.chunkPlan.reason: "dialogue_timing_force_chunking"`.
- The staged S3 URL in `asset.media.refs.source_video` does **not** make the dialogue lane remote-URL based. `get-dialogue.cjs` extracts local audio and sends inline audio; current output shows `sourceStrategy: "base64"` and `provenance.transportMode: "inline"`. So the config description can make the lane sound safer/faster than it is for dialogue; the staged URL mainly helps `video`-domain scripts like `whole-video-mimo.cjs`, not Phase 1 dialogue.
- The compare config does **not** pin an explicit dialogue provider timeout. `ai.video.targets[*].adapter.params.timeoutMs` is set for whole-video MiMo, but `ai.dialogue.targets[*]` in the compare config only sets `max_tokens` / `thinking`. That means dialogue timeout behavior is currently inherited from provider runtime defaults / env rather than being config-owned and auditable.
- `get-dialogue.cjs` only honors `ai.dialogue.retry`, whose default is `maxAttempts: 1`, `backoffMs: 0`. The repo-wide `settings.retry_strategy` block present in this config does not appear in the dialogue runner path (repo grep only finds that key in configs / copied outputs / plan notes), so the current config gives a false sense of retry protection for dialogue-provider failures.
- Dialogue/tool-loop limits are still defaulted unless explicitly overridden: `maxTurns: 4`, `maxValidatorCalls: 3`. That is not automatically wrong, but in this lane it compounds runtime pressure because the hybrid path can mean one whole-asset attempt + ~9 chunk attempts + a stitch pass, each with its own validator loop budget.
- The current artifact metadata can look more complete than the transcript really is. `buildDialogueAnalysisMetadata()` stamps `coverage.complete: true` and `coverage.end = totalDuration` from source duration, not from the last recovered spoken segment. In the current `output/cod-test-mimo-openrouter-compare/phase1-gather-context/dialogue-data.json`, `totalDuration ≈ 140.042s` but the last dialogue segment ends around `125.5s`, leaving an uncovered late tail while metadata still reads `complete: true`. That means benchmark compare can be misled unless we add an explicit tail-coverage guard.
- Recent live-run assumptions also remain unsafe: `.plans/2026-04-01-mimo-optimized-video-and-openrouter-url-fix.md` documents runs wrapped in `timeout 420s`, and the Xiaomi hybrid dialogue rerun hit that outer watchdog before the pipeline finished. So even with better media delivery, a bounded shell watchdog can still create partial artifacts that look newer than they are.

Minimum config/runner changes needed **before** generating fresh benchmark-comparison artifacts:
1. Create or switch to a **dedicated full-file dialogue compare config** that sets `settings.phase1.dialogue.timing_refinement: disabled` for the proof run. For this asset, whole-asset dialogue is eligible already; the current `chunk_refine` setting is what forces the expensive multi-chunk refinement pass and reintroduces watchdog/cutoff risk.
2. In that proof config, set `settings.phase1.dialogue.fallback_to_chunked: false` so the lane fails loudly instead of silently downgrading away from the intended full-file contract.
3. Pin explicit `ai.dialogue.targets[*].adapter.params.timeoutMs` values in the compare lane(s) so dialogue request ceilings are config-owned rather than implicit env/provider defaults.
4. Either remove the outer shell watchdog for the proof run or raise it to a value justified by the intended contract; do **not** reuse the recent `timeout 420s` wrapper for “full-file safety” evidence.
5. Add a narrow post-run guard before benchmarking: fail comparison if the final dialogue segment leaves a large uncovered tail relative to `totalDuration` (for example, tail gap > a small tolerance / expected trailing silence budget). Do **not** trust `coverage.complete` alone.
6. Treat `settings.retry_strategy` as non-authoritative for this lane unless it is wired into the actual dialogue path; if retry is desired, express it under `ai.dialogue.retry` / recovery settings that `get-dialogue.cjs` actually reads.

Bottom line: today’s compare lane is benchmark-interesting but not benchmark-trustworthy as a **full-file** proof lane. The most important immediate fixes are disabling hybrid chunk refinement for the proof run, preventing silent chunk fallback, pinning dialogue timeoutMs explicitly, and rejecting artifacts whose transcript coverage ends materially before the asset does.

---

### Task 2: Apply the minimum config/runner guardrail changes needed for a trustworthy full-file dialogue run

**Bead ID:** `ee-d8o2`  
**SubAgent:** `coder`  
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, make only the minimum config and/or bounded runner changes required to ensure the Xiaomi/OpenRouter MiMo dialogue comparison lane evaluates the full cod asset without an avoidable early cutoff. Keep the change narrow and benchmark-honest: no cod-specific prompt cheating, no broad architecture rewrite, and no timeout inflation beyond what the intended contract justifies. Update the active plan with exactly what changed, how the lane now proves full-file intent, and what remaining caveats still exist. Claim bead ee-d8o2 on start with bd update ee-d8o2 --status in_progress --json and close it on completion with bd close ee-d8o2 --reason "Applied full-file guardrails for MiMo dialogue benchmark comparison lane" --json.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `configs/`

**Files Created/Deleted/Modified:**
- `.plans/2026-04-03-full-file-mimo-dialogue-benchmark-compare.md`
- `configs/cod-test-mimo-openrouter-compare.yaml`

**Status:** ✅ Complete

**Results:** Applied the narrowest config-only guardrails in `configs/cod-test-mimo-openrouter-compare.yaml`; no runner/source rewrite was needed. Exact changes:
- Switched `settings.phase1.dialogue.mode` from `hybrid` to `whole_asset` so the proof lane makes a single full-asset dialogue call instead of intentionally re-entering chunk planning/stitching.
- Switched `settings.phase1.dialogue.timing_refinement` from `chunk_refine` to `disabled`, removing the config-owned cause of the earlier forced chunk plan.
- Switched `settings.phase1.dialogue.fallback_to_chunked` from `true` to `false`, so the lane now fails loudly if whole-asset delivery is ineligible instead of silently downgrading away from the intended full-file contract.
- Pinned `ai.dialogue.targets[0].adapter.params.timeoutMs: 180000`, matching the nearby MiMo proof-lane request budget so the full-file request ceiling is explicit and config-owned rather than inherited from provider/env defaults.

How the lane now proves full-file intent:
- A successful run must now come back from `get-dialogue.cjs` as a `whole_asset` Phase 1 dialogue result; any transport/duration ineligibility that previously could have degraded to chunked will now hard-fail because fallback is disabled.
- The resulting `phase1-gather-context/dialogue-data.json` should therefore show `analysisMode: "whole_asset"`, `timingMode: "full_timeline"`, and `provenance.usedChunking: false`; if it does not, the run is not valid evidence for this bead.
- Validation passed with `node validate-configs.cjs` and `node server/run-pipeline.cjs --config configs/cod-test-mimo-openrouter-compare.yaml --dry-run --verbose`.

Remaining caveats:
- This only removes avoidable runner/config cutoff risk. It does **not** guarantee the model will faithfully transcribe the late trailer block; that remains a benchmark-quality question for the fresh live run/artifact review.
- I intentionally did **not** add a cod-tuned transcript-tail rejection heuristic in source yet, because the truth file itself has ~10s of silent tail after the last spoken segment; a generic tail-gap guard needs a better contract than this bead justified.
- The outer shell watchdog is still external to the YAML. Task 3 should run without the old `timeout 420s` wrapper (or with a clearly justified larger bound) so we do not reintroduce an avoidable non-config cutoff.

---

### Task 3: Generate fresh Xiaomi/OpenRouter dialogue comparison artifacts under the guarded full-file config

**Bead ID:** `ee-c466`  
**SubAgent:** `coder`  
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, run the guarded Xiaomi/OpenRouter MiMo dialogue comparison lane(s) needed for benchmark comparison and capture exact commands, logs, timings, and artifact paths. Verify from the resulting artifacts that the dialogue output covers the full intended cod asset rather than ending early. Update the active plan with the evidence, including whether the late-trailer block is present or still missing. Claim bead ee-c466 on start with bd update ee-c466 --status in_progress --json and close it on completion with bd close ee-c466 --reason "Generated fresh full-file MiMo dialogue comparison artifacts" --json.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `output/`
- `.logs/`
- optional `tmp/`

**Files Created/Deleted/Modified:**
- `.plans/2026-04-03-full-file-mimo-dialogue-benchmark-compare.md`
- `output/_archives/cod-test-mimo-openrouter-compare-pre-ee-c466-20260403-081949/`
- `.logs/cod-test-mimo-openrouter-compare-20260403-ee-c466.log`
- `.logs/cod-test-mimo-openrouter-compare-20260403-ee-c466.time`
- `output/cod-test-mimo-openrouter-compare/phase1-gather-context/dialogue-data.json`
- `output/cod-test-mimo-openrouter-compare/phase1-gather-context/raw/ai/dialogue-transcription/attempt-01/capture.json`
- `output/cod-test-mimo-openrouter-compare/phase1-gather-context/script-results/get-dialogue.success.json`
- `output/cod-test-mimo-openrouter-compare/phase2-process/whole-video-analysis.json`
- `output/cod-test-mimo-openrouter-compare/_meta/events.jsonl`

**Status:** ✅ Complete

**Results:** Fresh guarded run completed successfully against the full-file config, with the stale pre-guardrail output first archived to `output/_archives/cod-test-mimo-openrouter-compare-pre-ee-c466-20260403-081949` so the new artifact set is unambiguous.

Exact run command (no outer `timeout 420s` wrapper):
- `node server/run-pipeline.cjs --config configs/cod-test-mimo-openrouter-compare.yaml --verbose`

Exact evidence/log/timing files:
- Log: `.logs/cod-test-mimo-openrouter-compare-20260403-ee-c466.log`
- `/usr/bin/time -p` output: `.logs/cod-test-mimo-openrouter-compare-20260403-ee-c466.time`
- Run event stream: `output/cod-test-mimo-openrouter-compare/_meta/events.jsonl`

Measured timings from the fresh run:
- Total wall clock from wrapper log: `193.554s`
- `/usr/bin/time -p real`: `193.53s`
- Pipeline `run.end.durationMs`: `190958`
- `get-dialogue` script duration: `14901ms`
- `get-dialogue` provider await: `13363ms`
- `whole-video-mimo` script duration: `75639ms`
- `whole-video-mimo` provider awaits: `41610ms` + `34009ms`

Full-file guardrail evidence from the fresh dialogue artifact:
- `analysisMode: "whole_asset"`
- `timingMode: "full_timeline"`
- `provenance.usedChunking: false`
- `provenance.chunkCount: 0`
- `provenance.fallbackApplied: false`
- `sourceStrategy: "base64"`
- `provenance.transportMode: "inline"`

What the resulting artifact proves:
- The guarded lane did run as a new **whole-asset** dialogue pass rather than silently falling back to chunked mode.
- The final saved dialogue artifact still is **not benchmark-trustworthy for late-trailer coverage**. `dialogue-data.json` contains only `15` saved dialogue segments versus `30` in the human truth file.
- The final saved artifact’s last segment ends at `139.2s` (`"Pull it together, man."`) with only a small formal tail gap to `totalDuration 140.042449s`, so this is **not** the old “stopped around 125s” early-cutoff shape.
- However, the important late-trailer block is still effectively missing from the final benchmark artifact. Distinctive expected lines such as `"No more games! This ends now."`, `"Obey your master!"`, `"Get the Reznov challenge pack when you preorder now!"`, and `"Master, master"` are absent from the final `dialogue-data.json`.

Important raw-capture nuance:
- The provider raw capture shows the whole-asset model response did attempt some late lines, including `"So eager to leave, David."`, `"Killing the man is a hell of a lot easier than killing the idea."`, `"You were never cut out to be a Mason."`, and `"No more games. This ends now."`
- But the same raw response assigned those lines impossible timestamps **beyond the asset duration** (`140.6s`, `143.2s`, `148.4s`, `153.2s`) while also reporting `totalDuration: 139.0` in the response body. Those out-of-range segments were not preserved in the final artifact, so the saved benchmark input still lacks the late-trailer block where it needs to be.

Bottom line for Task 3: we now have fresh benchmark-honest full-file MiMo/OpenRouter comparison artifacts and evidence that the lane no longer dies in chunk-refine mode, but the late-trailer dialogue block is **still missing in the final artifact**, with raw evidence suggesting mis-timed overrun hallucination rather than an outright early process cutoff.

---

### Task 4: Compare the fresh full-file dialogue artifacts against the human benchmark and summarize OpenRouter vs Xiaomi differences

**Bead ID:** `ee-f853`  
**SubAgent:** `research`  
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, compare the fresh full-file Xiaomi/OpenRouter MiMo dialogue artifacts against the human-verified cod dialogue benchmark using the repo’s benchmark/comparator machinery where possible. Produce an evidence-backed summary of how the two providers differ from each other and from human truth, including timing coverage, missing late-block behavior, speaker identity/linkage quality, segment text accuracy, and any meaningful score delta. Update the active plan with exactly what the benchmark says and the most important next fix buckets. Claim bead ee-f853 on start with bd update ee-f853 --status in_progress --json and close it on completion with bd close ee-f853 --reason "Compared fresh full-file MiMo dialogue artifacts against human benchmark" --json.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `benchmarks/`
- optional `docs/research/`
- optional `tmp/`

**Files Created/Deleted/Modified:**
- `.plans/2026-04-03-full-file-mimo-dialogue-benchmark-compare.md`
- comparison outputs/notes to be determined

**Status:** ✅ Complete

**Results:** Compared the **current fresh full-file OpenRouter MiMo dialogue artifact** against the human-reviewed cod dialogue truth using the repo’s existing JSON structured comparator (`server/lib/benchmark-runner.cjs`, `dialogue-default` profile) by scaffolding a temporary manifest at `tmp/openrouter-mimo-dialogue-benchmark-current/benchmark.json` and writing fresh reports to `tmp/openrouter-mimo-dialogue-benchmark-current/reports/`.

Exact benchmark outputs used:
- `tmp/openrouter-mimo-dialogue-benchmark-current/reports/benchmark-summary.json`
- `tmp/openrouter-mimo-dialogue-benchmark-current/reports/artifact-results/dialogueData.json`
- current benchmark input artifact: `output/cod-test-mimo-openrouter-compare/phase1-gather-context/dialogue-data.json`

What the benchmark says about the fresh **OpenRouter** full-file artifact vs human truth:
- Status: benchmark `error` (structural drift + missing truth fields), not pass/fail clean.
- Accuracy: `59 / 155` scoreable fields passed = **38.06%**.
- Truth coverage: `155 / 199` fields scoreable = **77.89%**.
- Error/failure counts: `96` failed fields, `44` errored fields.
- Structural headline: `dialogue_segments` is `15` long vs human truth `30`; `speaker_profiles` is `5` vs human truth `14`.
- Timing coverage metadata is misleadingly complete: the output advertises `coverage.complete: true`, `coverage.start: 0`, `coverage.end: 140.042`, `timingMode: "full_timeline"`, but the actual saved spoken content is sparse: only about **29.3s** of dialogue spans are represented vs about **67s** in human truth.
- Largest actual gaps inside the saved transcript are huge: `55.7s -> 102.2s` (**46.5s gap**) and `104.2s -> 138.1s` (**33.9s gap**), which is why late-block truth still collapses even though the file formally reaches the asset end.
- Missing late-block behavior is still the dominant transcript failure. The comparator records output-missing structural errors for every truth segment from `dialogue_segments[15]` through `[29]`, including `"Control faster."`, the core `Master of Puppets` lyric block, `"So eager to leave daddy."`, `"Killing the man is a hell of a lot easier than killing the idea."`, `"You were never cut out to be a Mason."`, `"No more games! This ends now."`, `"Obey your master!"`, `"Get the Reznov challenge pack when you preorder now!"`, and the closing `"Master, master"`.
- Segment text accuracy is mixed rather than uniformly bad: the run gets some exact/fuzzy text matches once alignment lands (`dialogue_segments[10].text = "Specter one, report."`, `[12].text = "This isn't real."`, `[13].text = "The hell it ain't."`), but earlier lines are shifted/merged, so many text failures are really alignment failures caused by whole-asset condensation.
- Speaker identity/linkage quality remains weak. The biggest current mismatch buckets from the field results are:
  - `segment_speaker_identity`: `26`
  - `segment_timing`: `21`
  - `speaker_profile_linkage`: `20`
  - `missing_or_extra_segments`: `15`
  - `segment_text`: `12`
  - `speaker_profile_traits`: `12`
  - `speaker_profile_descriptors`: `9`
  - `missing_or_extra_speaker_profiles`: `9`
- Concretely, the model collapses too much onto `spk_001`: truth speaker IDs for segments `2`, `3`, `7`, `8`, `9`, `12`, `13`, and `14` are all wrong in the saved artifact, and the profile set never even materializes distinct human truth buckets for `spk_008` through `spk_016`.
- The saved speaker-profile registry is too coarse for the human benchmark: `speaker_profiles[0]` over-links ten segments where truth links four, `speaker_profiles[1]` and `[2]` miss or misplace linkage indexes, and the run omits the human-reviewed trait notes/uncertainty structure that the truth contract expects.

How the fresh OpenRouter full-file artifact differs from prior benchmark points:
- Versus the repo’s older dialogue baseline report at `benchmarks/fixtures/cod-test/dialogue-only/_reports/artifact-results/dialogueData.json`, the current full-file run is a small raw **accuracy win** but a meaningful **coverage loss**: **38.06%** vs **35.65%** accuracy (`+2.41 pts`), but **77.89%** vs **85.50%** truth coverage (`-7.61 pts`). On the `175` benchmarked paths common to both reports, it improves `11` paths and regresses `16`, so this is not a clean across-the-board upgrade.
- Versus yesterday’s chunk-refined OpenRouter benchmark at `tmp/openrouter-mimo-dialogue-benchmark/reports/artifact-results/dialogueData.json`, the current full-file run is slightly worse overall: **38.06%** vs **37.25%** raw accuracy (`+0.82 pts`) but **77.89%** vs **84.59%** coverage (`-6.70 pts`), with `11` common-path improvements and `19` regressions. In practice the full-file run trades some mid-file text/timing wins for much worse early alignment and a harder collapse of the late block.

What can be said about **Xiaomi** vs truth / vs OpenRouter:
- There is **no truthful benchmark-equivalent Xiaomi dialogue artifact to score** right now, so Xiaomi cannot honestly be compared numerically against the human dialogue benchmark.
- The only available Xiaomi Phase 1 dialogue attempt is the archived run `output/_archives/cod-test-phase1-proof-compare-after-mimo-tranche2-xiaomi-toolloop-limit-20260401-1222/...`, and it never produced a final `phase1-gather-context/dialogue-data.json`; it stopped with `GET_DIALOGUE_INVALID_OUTPUT` / `"exceeded validate_dialogue_transcription_json tool-call limit"` in `phase1-gather-context/script-results/get-dialogue.failure.json`.
- The other available Xiaomi artifact, `output/cod-test-mimo-xiaomi-direct-smoke/phase2-process/whole-video-analysis.json`, explicitly says `comparisonHints.safeForChunkEquivalence: false` and `safeForPhase3Metrics: false`, so it is not a benchmark-equivalent dialogue artifact at all.
- Honest provider comparison therefore looks like this today: **OpenRouter at least returns a benchmarkable-but-wrong Phase 1 dialogue JSON; Xiaomi currently does not return a truthful comparable Phase 1 dialogue artifact in this repo state.**

Most important next fix buckets, exactly as the benchmark evidence now points them:
1. **Late-block recovery / timestamp repair**: the current whole-asset output still loses truth segments `15-29`. Fixing late-segment retention and clamping/recovering out-of-range late timestamps is the highest-value bucket.
2. **Alignment before text scoring**: many early text failures are index-shift artifacts. We need either better whole-asset segmentation or a bounded post-pass that prevents early merges from poisoning all downstream segment comparisons.
3. **Speaker decomposition and linkage**: the model is still over-collapsing distinct voices into `spk_001` and never materializing most late speaker buckets (`spk_008`+). This is the next major benchmark bucket after late-block retention.
4. **Trait/descriptor honesty**: inferred trait objects and acoustic descriptor labels are too generic/speculative compared with the human-reviewed contract. If identity is uncertain, the output should preserve that explicitly instead of flattening or omitting it.
5. **Comparator-facing metadata hygiene**: the output still adds top-level fields (`analysisMode`, `timingMode`, `sourceStrategy`, `coverage`, `provenance`) that the current truth artifact does not contain. Those are useful operationally, but they contribute structural benchmark errors and should either be normalized out for comparison or added to truth under an agreed contract.

Bottom line: the fresh guarded full-file OpenRouter run proves the lane no longer dies in chunk-refine mode, but the benchmark still says the saved artifact is far from human truth because it compresses the first half, over-collapses speakers, and completely drops the late montage/lyrics/promo block in comparator terms. Xiaomi cannot yet be scored honestly because the repo does not currently contain a truthful benchmark-equivalent Xiaomi Phase 1 dialogue artifact.

---

## Final Results

**Status:** ⏳ Pending

**What We Built:** Pending.

**Commits:**
- Pending

**Lessons Learned:** Pending.

---

*Completed on YYYY-MM-DD*
