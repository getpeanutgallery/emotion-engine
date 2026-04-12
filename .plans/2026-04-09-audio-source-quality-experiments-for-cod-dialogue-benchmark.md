# emotion-engine: audio source quality experiments for cod dialogue benchmark

**Date:** 2026-04-09  
**Status:** In Progress  
**Agent:** Cookie 🍪

---

## Goal

Stabilize the remaining whole-video Phase 1 blockers for cod-test — especially reconciliation activation/behavior and music-vocals collapse — and then run controlled audio-quality experiments to determine whether dialogue benchmark misses are materially caused by degraded audio transport/extraction quality.

---

## Overview

Manual benchmark review surfaced two different classes of dialogue mismatch. Some differences still look like legitimate model/transcription misses and should remain scored misses, such as `"You shall know fear."` becoming `"You shall obey me."` and `"Pull it together, man!"` becoming `"Need to pull it together, man."`. Other differences look like benchmark truth drift or genuine ambiguity, such as `"So eager to leave daddy."` vs `"So eager to leave David"` and `"Killing the man..."` vs `"Killing a man..."`, where Derrick has already made the call to update the gold truth.

A plausible root cause for at least some remaining dialogue degradation is audio quality loss across the current transport chain. `configs/cod-test.yaml` now stages the optimized asset `https://gambit-games-tests.s3.us-east-1.amazonaws.com/peanut-gallery/cod-720p-h264-mp3-optimized.mp4`, while prior archived config state shows the original staged asset was `https://gambit-games-tests.s3.us-east-1.amazonaws.com/peanut-gallery/cod.mp4`. The current ffmpeg extraction settings also transcode audio with `libmp3lame` at `192k`, which may be compounding loss if the input is already a lossy MP3-track optimized video.

But audio quality is not the only blocker that matters before rerunning. The latest handoff showed reconciliation still ending `skipped` instead of actually correcting lyric bleed in dialogue, and music-vocals coverage regressed from the expected richer truth toward a collapsed minimal output. So the plan needs to handle three connected lanes in order: (1) restore truthful reconciliation behavior against current dialogue output, (2) investigate and repair the music-vocals collapse so the lane produces the expected support evidence again, and only then (3) run the controlled source/extraction audio-quality experiments with a cleaner Phase 1 system state.

The plan should preserve rigor: first update the benchmark truth only where Derrick explicitly decided it is warranted, then repair the pre-rerun Phase 1 blockers, then pause for Derrick review/approval of any AI prompt changes before rerunning `cod-test.yaml`, then run narrowly-scoped config experiments, compare the dialogue artifact deltas against the benchmark, and decide whether a permanent pipeline change is justified. We should not treat anecdotal better-sounding inputs as sufficient without benchmark movement and artifact inspection.

---

## Tasks

### Task 1: Record the benchmark truth decisions from manual review

**Bead ID:** `ee-8vxp`  
**SubAgent:** `research`  
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, record the current human-reviewed dialogue benchmark decisions for cod-test. Update the gold benchmark only where Derrick explicitly decided the truth should change, and document which mismatches remain legitimate model misses. Claim bead ee-8vxp on start with bd update ee-8vxp --status in_progress --json and close it on completion with bd close ee-8vxp --reason "documented cod dialogue benchmark truth decisions" --json. Update the plan with exact paths and exact truth changes.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `benchmarks/fixtures/cod-test/`

**Files Created/Deleted/Modified:**
- `.plans/2026-04-09-audio-source-quality-experiments-for-cod-dialogue-benchmark.md`
- `benchmarks/fixtures/cod-test/truth/dialogue-data.json`

**Status:** ✅ Complete

**Results:** Updated `benchmarks/fixtures/cod-test/truth/dialogue-data.json` only where Derrick explicitly changed the gold truth: index `15` now reads `So eager to leave David.` and index `16` now reads `Killing a man is a hell of a lot easier than killing the idea.` The segment objects already carried those reviewed texts, so the narrow fixture change was the stale `cleanedTranscript` tail to keep the aggregate truth consistent with the segment-level gold data. Documented the manual-review decision here as well: index `9` remains `You shall know fear.` and index `14` remains `Pull it together, man!`, with the current model outputs (`You shall obey me.` and `Need to pull it together, man.`) treated as legitimate model misses rather than benchmark truth changes.

---

### Task 2: Investigate why reconciliation still skips instead of correcting dialogue lyric bleed

**Bead ID:** `ee-z0ak`  
**SubAgent:** `research`  
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, investigate the latest cod-test whole-video Phase 1 run and determine why famous-song reconciliation still ends skipped instead of activating against the current dialogue output. Focus on the actual latest ledger/artifacts/prompts/runtime conditions rather than theory. Identify the exact gating/heuristic/evidence failure and update the plan with concrete findings and affected files. Claim bead ee-z0ak on start with bd update ee-z0ak --status in_progress --json and close it on completion with bd close ee-z0ak --reason "investigated reconciliation skip against current dialogue output" --json.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `docs/`
- `output/`

**Files Created/Deleted/Modified:**
- `.plans/2026-04-09-audio-source-quality-experiments-for-cod-dialogue-benchmark.md`
- `output/cod-test/phase1-gather-context/famous-song-reconciliation.json`
- `output/cod-test/phase1-gather-context/music-vocals-data.json`
- `output/cod-test/phase1-gather-context/music-data.json`
- `output/cod-test/phase1-gather-context/dialogue-data.reconciled.json`
- `.logs/cod-test-20260408-171347-ee-elc5-post-fix-whole-video-rerun.log`
- `server/scripts/get-context/reconcile-famous-song-phase1.cjs`

**Status:** ✅ Complete

**Results:** Investigated the latest whole-video Phase 1 cod-test artifacts and confirmed the reconciliation skip is caused by a specific gate interaction in `server/scripts/get-context/reconcile-famous-song-phase1.cjs`, not by missing song recognition in the vocals lane. The latest ledger at `output/cod-test/phase1-gather-context/famous-song-reconciliation.json` shows the only failing trigger reason is `hasSupportingMusicConsensus`, but the underlying reason that support is required is that `buildRecognitionGate()` computes `hasStrongDialogueVocalsEvidence = false`. In the current `output/cod-test/phase1-gather-context/music-vocals-data.json`, the recognized-song candidate is high-confidence (`recognized`, `0.93`) but its `matchedLyrics` array is ordered as `["Master, master", "Obey your master"]`, while the actual observed vocal segments are ordered `"Obey your master"` then `"Master, master"`. The current dialogue artifact at `output/cod-test/phase1-gather-context/dialogue-data.reconciled.json` shows the same effective order in the lyric-bleed segments (`index` 14 then 20/22, plus 28). Because `buildLyricEvidence()` records first occurrence order by `matchedLyrics` index, both the vocals evidence and the dialogue evidence become `[1, 0]`, which fails `hasIndexOrderEvidence` (`LNDS=1`, `minimumStrongSubsequenceLength=2`) even though the literal lyric text matches perfectly. That flips `requiresSupportingMusicConsensus` to true. The support lane comes from `output/cod-test/phase1-gather-context/music-data.json`, where `recognizedSong.status` is only `possible` at `0.7`; `buildRecognitionGate()` currently treats anything other than `status === "recognized"` as no supporting consensus, so the final gate fails with `hasSupportingMusicConsensus`. Net: reconciliation is skipped because the strict lyric-order heuristic rejects otherwise strong dialogue/vocals evidence, and the fallback support heuristic is stricter than the current music-lane output. The run log `.logs/cod-test-20260408-171347-ee-elc5-post-fix-whole-video-rerun.log` confirms reconciliation executed after music-vocals and then ended Phase 1 without applying corrections. Affected code path: `buildRecognitionGate()` → `buildLyricEvidence()` / `hasStrongDialogueVocalsEvidence` / `requiresSupportingMusicConsensus`; because the gate fails, reconciliation never meaningfully activates `reconcileDialogue()` for the lyric-bleed lines.

---

### Task 3: Repair reconciliation activation/correction behavior for the current cod-test lane

**Bead ID:** `ee-6g8q`  
**SubAgent:** `coder`  
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, implement the smallest truthful fix needed so famous-song reconciliation actually runs when the current cod-test dialogue output contains lyric bleed that should be corrected or removed. Base the change on the real latest failure mode, not a speculative rewrite. Add or update tests if the affected logic is testable, claim bead ee-6g8q on start with bd update ee-6g8q --status in_progress --json, and close it on completion with bd close ee-6g8q --reason "fixed reconciliation activation or correction behavior for cod-test" --json. Update the plan with exact code paths, tests, and behavioral changes.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `server/`
- `test/`

**Files Created/Deleted/Modified:**
- `.plans/2026-04-09-audio-source-quality-experiments-for-cod-dialogue-benchmark.md`
- `server/scripts/get-context/reconcile-famous-song-phase1.cjs`
- `test/scripts/reconcile-famous-song-phase1.test.js`

**Status:** ✅ Complete

**Results:** Implemented the smallest fix in `server/scripts/get-context/reconcile-famous-song-phase1.cjs` by narrowing the change to the fallback support path inside `buildRecognitionGate()`, rather than rewriting lyric-order evidence. Added helper `sameSongCandidate()` and changed `hasSupportingMusicConsensus` so the fallback now accepts either (a) `musicData.recognizedSong.status === "recognized"` at `>= 0.7` confidence, or (b) `status === "possible"` at `>= 0.7` **when a support candidate matches the primary recognized song title (and artist when both are present)**. This directly addresses the current cod-test failure chain: lyric-order evidence can still fail on the observed `[1,0]` first-occurrence shape, but reconciliation no longer skips when the separate music lane is a same-song `possible` match at the existing support floor.

Added a focused regression in `test/scripts/reconcile-famous-song-phase1.test.js` covering the real current shape: vocals lane `recognized` at `0.93`, dialogue/vocal lyric evidence insufficiently ordered, and music lane `possible` at `0.7` for `Master of Puppets`. The test now proves the gate still requires fallback support, the fallback support is considered satisfied for that same-song `possible` case, and reconciliation applies dialogue cleanup instead of skipping. Re-ran the targeted suite with `node --test test/scripts/reconcile-famous-song-phase1.test.js`; all 13 tests passed.

Behavioral change summary: famous-song reconciliation remains strict by default, still skips when fallback support is weak/low-confidence/other-song, but now truthfully activates for the current cod-test lane without loosening the primary vocals recognition gate or changing any AI prompts. **No prompt files were changed in this task.**

---

### Task 4: Investigate why music-vocals collapsed from richer truth to the current minimal output

**Bead ID:** `ee-6wsz`  
**SubAgent:** `research`  
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, investigate why the latest cod-test music-vocals output regressed from the previously richer expected truth to the current minimal/collapsed version. Compare current prompts, prompt context, extraction inputs, runtime artifacts, and prior stronger runs so we can isolate whether the collapse came from the prompt contract, the model behavior, extraction quality, or upstream context contamination. Claim bead ee-6wsz on start with bd update ee-6wsz --status in_progress --json and close it on completion with bd close ee-6wsz --reason "investigated music-vocals collapse against prior stronger runs" --json. Update the plan with concrete evidence and affected files.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `docs/`
- `output/`

**Files Created/Deleted/Modified:**
- `.plans/2026-04-09-audio-source-quality-experiments-for-cod-dialogue-benchmark.md`
- latest/prior music-vocals artifacts and any research note path if needed

**Status:** ✅ Complete

**Results:** Investigated the current collapse against archived stronger runs and found the primary regression is **not** the extracted audio input and **not** a clean prompt-contract change. Concrete evidence:
- Current reconciled output `output/cod-test/phase1-gather-context/music-vocals-data.reconciled.json` collapsed to **2** segments (`"Obey your master"`, `"Master, master"`), while stronger archived runs from the same lane produced **5-11** segments, e.g. `output/_archives/cod-test-pre-ee-elc5-20260408-171347/cod-test/phase1-gather-context/music-vocals-data.reconciled.json` (5 segments) and `output/_archives/cod-test-pre-ee-uofg-20260408-155355/cod-test/phase1-gather-context/music-vocals-data.reconciled.json` (10 segments).
- The extracted music audio is byte-identical between the collapsed current run and a stronger prior run: `output/cod-test/assets/processed/music/audio.mp3` and `output/_archives/cod-test-pre-ee-uofg-20260408-155355/cod-test/assets/processed/music/audio.mp3` are both 3,361,792 bytes with SHA-256 `5fd69b9e0ab94bb8cac3262a32850fd437845a9066148b362926940e9b1925e4`. That rules out extraction/source drift for this specific collapse.
- The whole-asset music-vocals prompt hash is also unchanged across the collapsed run and stronger archived runs: current and prior captures both point at prompt hash `cbaf3b5db1fb6872073fe8f78a71085d7178391fe831e4a4540f13a090def536` via `phase1-gather-context/raw/ai/music-vocals-whole-asset/attempt-01/capture.json`. So this is not a simple prompt-file regression.
- What *did* change materially is the upstream music-lane context injected into that same prompt. Stronger runs fed broader cue context such as `76-98s rock music entry with vocals` / `76-98s heavy metal music entry with vocal chants` from archived `music-data.json`, while the collapsed run fed a much narrower cue note in `output/cod-test/phase1-gather-context/music-data.json`: `75-80s song entry with audible lyrics` plus a summary already naming `Master of Puppets`.
- The collapsed capture itself shows the model anchoring on that narrowed entry window instead of doing full-asset recall. In `output/cod-test/phase1-gather-context/raw/ai/music-vocals-whole-asset/attempt-01/capture.json`, the returned `qualityNotes` say `timing is based on the song entry around 75.0s`, and the model stops after the first two hook fragments instead of continuing through the later verse/reprise coverage seen in stronger runs.
- The current script path `server/scripts/get-context/get-music-vocals.cjs` makes this brittleness worse: in `whole_asset` mode it performs a single whole-asset pass and accepts whatever coverage comes back; there is no chunk-refinement or coverage sanity check unless the lane falls out of whole-asset mode. That means one under-recalling model response can collapse the artifact even when the audio and prompt template are fine.

Most likely root cause: **upstream context contamination plus single-pass model variability**. The narrower music-lane context appears to bias the model toward the initial 75-80s lyric entry, and because `get-music-vocals.cjs` currently trusts a single whole-asset response with no refinement/coverage backstop, the lane can collapse to representative examples instead of full lyric chronology.

Most likely fix surface (investigation only; not implemented here):
1. `server/scripts/get-context/get-music-vocals.cjs` — add a coverage backstop for whole-asset mode, or force hybrid/chunk refinement when a recognized song and longer vocal cue are detected, so a 2-line representative answer cannot silently ship as the final lane.
2. Upstream music-lane generation/prompting that produced `output/cod-test/phase1-gather-context/music-data.json` — avoid over-narrow notable-transition context like `75-80s song entry with audible lyrics` when the actual vocal cue spans much longer.
3. Optionally harden the whole-asset prompt to require continued coverage past the initial hook when the same cue clearly persists, but the evidence above says prompt text alone is not the full regression source because the same prompt hash previously produced rich outputs.

---

### Task 5: Repair the music-vocals script/prompt lane so it no longer collapses coverage

**Bead ID:** `ee-0r28`  
**SubAgent:** `coder`  
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, implement the smallest truthful fix needed so the music-vocals lane stops collapsing from the expected richer truth to the minimal output seen in the latest cod-test run. Base the fix on the actual investigation findings and preserve the no-bogus-lyrics discipline. Add or update tests when practical, claim bead ee-0r28 on start with bd update ee-0r28 --status in_progress --json, and close it on completion with bd close ee-0r28 --reason "fixed music-vocals collapse in cod-test lane" --json. Update the plan with exact code/prompt/config changes and any tradeoffs.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `server/`
- `test/`

**Files Created/Deleted/Modified:**
- `.plans/2026-04-09-audio-source-quality-experiments-for-cod-dialogue-benchmark.md`
- `server/scripts/get-context/get-music-vocals.cjs`
- `test/scripts/get-music-vocals.test.js`

**Status:** ✅ Complete

**Results:** Implemented the smallest code-path fix in `server/scripts/get-context/get-music-vocals.cjs` to reduce whole-asset collapse risk without loosening lyric discipline or rewriting prompts. Exact changes:
- Added `shouldPreferHybridMusicVocalsAnalysis(musicData)` to detect lyric-bearing upstream music context using already-available evidence: a non-`unknown` `musicData.recognizedSong.status`, lyric-bearing wording in `musicData.summary`, or lyric-bearing wording in `musicData.globalArc.notableTransitions[*].label` (keywords such as `vocal`, `lyrics`, `chant`, `sung`, `song entry`, `refrain`, `hook`, `rap`).
- Changed `resolveMusicAnalysisStrategy(preflight, config, musicData)` so `settings.phase1.music.mode: auto` now selects `hybrid` instead of fragile single-pass `whole_asset` when the asset is whole-asset-eligible **and** upstream music context already indicates text-bearing song evidence. This preserves the existing whole-asset global pass but automatically adds chunk refinement as a coverage backstop for lyric lanes likely to collapse.
- Passed `input.artifacts.musicData` into strategy resolution and recorded the decision in artifact provenance via `autoSelectedHybridForLyricCueCoverage` so later artifact review can tell when the backstop was engaged.
- No AI prompt text changed in this task. The fix is behavioral/routing only, so there is no new prompt review item for Derrick from Task 5.

Tests updated in `test/scripts/get-music-vocals.test.js`:
- Added a focused regression test proving that auto mode upgrades lyric-bearing music context to `hybrid`, performs both the whole-asset and chunk-level passes, preserves the whole-asset continuity context in the chunk prompt, and returns an artifact with `analysisMode: "hybrid"`, two recovered vocal segments, and `provenance.autoSelectedHybridForLyricCueCoverage === true`.
- Re-ran the targeted script test suite with `node --test test/scripts/get-music-vocals.test.js` and all 7 tests passed.

Tradeoff: this fix increases model work for `auto` music-vocals runs that already show lyric-bearing song evidence upstream, because those lanes now do whole-asset + chunk refinement instead of trusting a single whole-asset response. That is intentionally narrow and truthful: it only pays the extra cost when the lane is most vulnerable to under-coverage, and it keeps the no-bogus-lyrics discipline because chunk outputs still have to be grounded in the actual chunk audio rather than in song memory alone.

---

### Task 6: Present any AI prompt changes for Derrick review and explicit approval before rerunning `cod-test.yaml`

**Bead ID:** `ee-3n5o`  
**SubAgent:** `primary`  
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, after the reconciliation and music-vocals investigation/fix work is done, collect any proposed prompt changes that affect AI model behavior for cod-test, summarize them clearly for Derrick, and update the plan with exactly what changed and why. Do not run cod-test.yaml after prompt edits until Derrick explicitly reviews and approves those prompt changes. Claim bead ee-3n5o on start with bd update ee-3n5o --status in_progress --json and close it on completion with bd close ee-3n5o --reason "prepared AI prompt changes for Derrick review before rerun" --json.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `server/`
- `test/`
- `output/`

**Files Created/Deleted/Modified:**
- `.plans/2026-04-09-audio-source-quality-experiments-for-cod-dialogue-benchmark.md`
- `server/scripts/get-context/reconcile-famous-song-phase1.cjs`
- `server/scripts/get-context/get-music-vocals.cjs`
- `test/scripts/reconcile-famous-song-phase1.test.js`
- `test/scripts/get-music-vocals.test.js`
- inspected generated prompt-capture/output paths under `output/`

**Status:** ✅ Complete

**Results:** Verified the current working tree against the two landed fix paths and the prompt-bearing runtime artifacts. The only source changes from the reconciliation and music-vocals fixes are behavioral code/test changes in `server/scripts/get-context/reconcile-famous-song-phase1.cjs`, `server/scripts/get-context/get-music-vocals.cjs`, and their two targeted test files. No prompt template text, prompt-building contract text, or prompt-bearing config files were changed by those fixes. In the `get-music-vocals` diff, the change is strategy selection/routing (`auto` can now prefer `hybrid` when lyric-bearing context is present) plus provenance; the prompt assertions added in `test/scripts/get-music-vocals.test.js` only verify pre-existing prompt content and do not change the prompt text itself. In the reconciliation diff, the change is gate logic only. The working tree does include changed/deleted generated prompt-capture artifacts under `output/.../_meta/ai/_prompts/`, but those are runtime artifacts from prior/archived runs and cleanup state, not newly edited source prompts for Derrick to review. Truthful conclusion: there are currently **no AI prompt text changes to present for approval**, so the Derrick prompt-review gate is satisfied for now and the next non-prompt experiment steps may proceed without waiting on prompt approval. Per task instructions, `cod-test.yaml` was **not** run here.

---

### Task 7: Create a controlled cod-test config lane that swaps back to the original staged `cod.mp4`

**Bead ID:** `ee-braz`  
**SubAgent:** `coder`  
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, create a narrow experiment config for cod-test that keeps the repaired intended whole-video/dialogue/reconciliation behavior but swaps the staged source video from the optimized MP3-based asset back to the original staged asset URL if still valid: https://gambit-games-tests.s3.us-east-1.amazonaws.com/peanut-gallery/cod.mp4. Do not overwrite the main config unless the plan is updated to say so; create an experiment config or equivalent safe lane. Claim bead ee-braz on start with bd update ee-braz --status in_progress --json and close it on completion with bd close ee-braz --reason "created original-mp4 cod experiment config" --json. Update the plan with the exact config path and exact diff.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `configs/`

**Files Created/Deleted/Modified:**
- `.plans/2026-04-09-audio-source-quality-experiments-for-cod-dialogue-benchmark.md`
- `configs/cod-test-original-mp4-source.yaml`

**Status:** ✅ Complete

**Results:** Verified the original staged asset URL is still valid with an HTTP `HEAD` check against `https://gambit-games-tests.s3.us-east-1.amazonaws.com/peanut-gallery/cod.mp4`, which returned `200`, `Content-Type: video/mp4`, and `Content-Length: 62013447`. Created a safe-lane experiment config at `configs/cod-test-original-mp4-source.yaml` by copying the current repaired `configs/cod-test.yaml` and keeping the runtime behavior otherwise intact.

Exact diff versus `configs/cod-test.yaml`:
- `name`: `COD Test Pipeline` → `COD Test Original MP4 Source Experiment`
- `description`: `Canonical full-run benchmark target for cod.mp4 with benchmark seeding enabled` → `Narrow experiment lane for cod.mp4 that preserves the repaired cod-test runtime behavior while swapping staged source delivery back to the original staged MP4 asset`
- `asset.outputDir`: `output/cod-test` → `output/cod-test-original-mp4-source`
- `asset.media.refs.source_video.staged.url`: `https://gambit-games-tests.s3.us-east-1.amazonaws.com/peanut-gallery/cod-720p-h264-mp3-optimized.mp4` → `https://gambit-games-tests.s3.us-east-1.amazonaws.com/peanut-gallery/cod.mp4`

No other settings changed. The main config `configs/cod-test.yaml` was left untouched, so this remains a narrow experiment lane for the original staged MP4 source without overwriting the current benchmark config.

---

### Task 8: Create a controlled cod-test config lane with higher-fidelity ffmpeg audio extraction

**Bead ID:** `ee-ju5h`  
**SubAgent:** `coder`  
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, create a second narrow experiment config for cod-test that preserves the repaired runtime behavior but raises audio extraction fidelity above the current MP3-at-192k path. Prefer a truthful high-fidelity setting that the runtime actually supports cleanly and that minimizes unnecessary lossy re-encoding. Keep the change scoped to the experiment lane unless the evidence later justifies a permanent config/library change. Claim bead ee-ju5h on start with bd update ee-ju5h --status in_progress --json and close it on completion with bd close ee-ju5h --reason "created high-fidelity ffmpeg cod experiment config" --json. Update the plan with the exact settings chosen and any code/test changes needed to support them.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `configs/`
- `test/`

**Files Created/Deleted/Modified:**
- `.plans/2026-04-09-audio-source-quality-experiments-for-cod-dialogue-benchmark.md`
- `configs/cod-test-high-fidelity-flac.yaml`
- `test/lib/ffmpeg-config.test.js`

**Status:** ✅ Complete

**Results:** Created a narrow experiment lane at `configs/cod-test-high-fidelity-flac.yaml` by copying the current `configs/cod-test.yaml` behavior and only changing the experiment identity/output plus ffmpeg audio extraction settings. Chosen setting: `codec: flac`, `container: flac`, `sample_rate_hz: 44100`, `channels: 2`, with no bitrate field. This is the most truthful higher-fidelity option the current runtime already supports cleanly because the real local `examples/videos/emotion-tests/cod.mp4` audio stream is AAC stereo at `44100` Hz / ~`128k` (`ffprobe` verified), so the current `libmp3lame` `192k` path adds an unnecessary second lossy encode. Extracting to FLAC preserves the decoded AAC samples without introducing another lossy transcode while staying inside the existing supported extension/MIME path (`.flac` / `audio/flac`).

No production/library code changes were necessary: `server/lib/ffmpeg-config.cjs` already supports `container: flac`, optional non-MP3 bitrate omission, and the downstream get-context scripts already accept `.flac` attachments. I added one targeted proof test in `test/lib/ffmpeg-config.test.js` to lock that in: it validates FLAC extraction without a bitrate requirement and asserts the exact ffmpeg args plus MIME/extension mapping. Re-ran `node --test test/lib/ffmpeg-config.test.js`; all 6 tests passed.

---

### Task 9: Run the source-video experiment and compare dialogue benchmark deltas

**Bead ID:** `ee-98df`  
**SubAgent:** `research`  
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, run the cod dialogue benchmark experiment using the original staged cod.mp4 source lane after the reconciliation and music-vocals fixes are in place. Capture exact command, cassette/log paths, produced dialogue/reconciliation/music-vocals artifacts, and benchmark summary/result deltas versus the current cod-test baseline. Inspect the known reviewed lines and note whether the source swap improves them, leaves them unchanged, or worsens them. Claim bead ee-98df on start with bd update ee-98df --status in_progress --json and close it on completion with bd close ee-98df --reason "ran original-source experiment and compared results" --json. Update the plan with evidence, not guesswork.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `.logs/`
- `.tmp/ee-98df/`
- `output/`
- `benchmarks/fixtures/cod-test/_reports/`

**Files Created/Deleted/Modified:**
- `.plans/2026-04-09-audio-source-quality-experiments-for-cod-dialogue-benchmark.md`
- `.logs/cod-test-original-mp4-source-20260409-122915-ee-98df.log`
- `.logs/cod-test-original-mp4-source-20260409-122915-ee-98df.time`
- `.tmp-ee-98df-cmd`
- `.tmp-ee-98df-log`
- `.tmp-ee-98df-timelog`
- `.tmp/ee-98df/experiment-benchmark-summary.json`
- `.tmp/ee-98df/experiment-dialogueData.json`
- `.tmp/ee-98df/experiment-musicVocalsData.json`
- `.tmp/ee-98df/baseline-benchmark-summary.json`
- `.tmp/ee-98df/baseline-dialogueData.json`
- `.tmp/ee-98df/baseline-musicVocalsData.json`
- `output/cod-test-original-mp4-source/phase1-gather-context/dialogue-data.json`
- `output/cod-test-original-mp4-source/phase1-gather-context/dialogue-data.reconciled.json`
- `output/cod-test-original-mp4-source/phase1-gather-context/famous-song-reconciliation.json`
- `output/cod-test-original-mp4-source/phase1-gather-context/music-data.json`
- `output/cod-test-original-mp4-source/phase1-gather-context/music-vocals-data.json`
- `output/cod-test-original-mp4-source/phase1-gather-context/music-vocals-data.reconciled.json`

**Status:** ✅ Complete

**Results:** Ran the original-source experiment with the exact command `node server/run-pipeline.cjs --config configs/cod-test-original-mp4-source.yaml --verbose` from repo root. The run log is `.logs/cod-test-original-mp4-source-20260409-122915-ee-98df.log`, timing file is `.logs/cod-test-original-mp4-source-20260409-122915-ee-98df.time`, and the experiment output root is `output/cod-test-original-mp4-source`.

**Reconciliation status:** improved from baseline **skipped** to experiment **applied**. Current baseline ledger `output/cod-test/phase1-gather-context/famous-song-reconciliation.json` still shows `status: "skipped"` with trigger failure reason `hasSupportingMusicConsensus`. The original-source experiment ledger `output/cod-test-original-mp4-source/phase1-gather-context/famous-song-reconciliation.json` shows `status: "applied"`, `trigger.passed: true`, no trigger-failure reasons, and concrete cleanup decisions. It removed four dialogue lyric-contamination segments: indexes `14` (`"Obey your master."`), `15` (`"Come crawling faster."`), `17` (`"Just call my name, 'cause I'll hear you scream."`), and `24` (`"Obey your master."`). No lyric rewrite substitutions were needed; the lane succeeded by removing contaminating dialogue segments instead of skipping. The experiment’s stronger vocals recognition (`recognized` at `0.98` with a longer matched-lyric list) appears to have supplied enough direct evidence that the fallback support gate no longer blocked reconciliation even though the supporting music lane was only `possible` at `0.64`.

**Music-vocals coverage:** the current baseline remains collapsed, while the original-source lane expands substantially. Baseline reconciled music-vocals artifact `output/cod-test/phase1-gather-context/music-vocals-data.reconciled.json` contains only **2** vocal segments (`"Obey your master"`, `"Master, master"`) with `recognizedSong.confidence = 0.93`. The original-source reconciled artifact `output/cod-test-original-mp4-source/phase1-gather-context/music-vocals-data.reconciled.json` contains **16** vocal segments with `recognizedSong.confidence = 0.98`, covering a much broader lyric span (`"Obey your master"`, `"Come crawling faster"`, `"Master of puppets I pull your strings"`, `"Twisting your mind and smashing your dreams"`, `"Blinded by me you can't see a thing"`, `"Just call my name 'cause I'll hear you scream"`, repeated `"Master, master"`, etc.). Some recovered lines are still imperfect (`"Faster dreams and I'll be faster"`, `"You see me cry"`), so coverage expands materially but is not cleanly truth-perfect.

**Benchmark delta vs current cod-test baseline:** to keep the comparison honest after the experiment run overwrote the fixture report surface, I saved the experiment report copies to `.tmp/ee-98df/experiment-*.json`, reran the benchmark against current baseline `output/cod-test`, saved those results to `.tmp/ee-98df/baseline-*.json`, then restored the experiment report files back to `benchmarks/fixtures/cod-test/_reports/`.
- Baseline summary: `.tmp/ee-98df/baseline-benchmark-summary.json`
- Experiment summary: `.tmp/ee-98df/experiment-benchmark-summary.json`
- Baseline dialogue artifact report: `.tmp/ee-98df/baseline-dialogueData.json`
- Experiment dialogue artifact report: `.tmp/ee-98df/experiment-dialogueData.json`
- Baseline music-vocals artifact report: `.tmp/ee-98df/baseline-musicVocalsData.json`
- Experiment music-vocals artifact report: `.tmp/ee-98df/experiment-musicVocalsData.json`

Measured benchmark deltas:
- Overall benchmark accuracy: **26.51% → 28.28%** (`+1.76 pts`)
- Overall truth coverage: **47.86% → 49.30%** (`+1.44 pts`)
- Dialogue artifact accuracy: **26.79% → 21.46%** (`-5.33 pts`)
- Dialogue artifact coverage: **95.87% → 94.91%** (`-0.96 pts`)
- Music-vocals artifact accuracy: **27.66% → 42.71%** (`+15.05 pts`)
- Music-vocals artifact coverage: **90.38% → 80.67%** (`-9.71 pts`)

Interpretation of those deltas: the original source is a **net benchmark win overall**, but not because dialogue got cleaner across the board. The overall gain is being carried mainly by much stronger music-vocals recognition/content, while the dialogue benchmark itself regresses numerically despite the better late-run cleanup.

**Known reviewed dialogue lines:**
- `"You shall know fear."` (reviewed true miss, should stay a miss): **worse**. Baseline reconciled dialogue still had the wrong line `"You shall obey me."`; the original-source reconciled dialogue does not recover `"You shall know fear."` at all and instead has unrelated surrounding dialogue in that region, so this line remains missed and is not improved by the source swap.
- `"Pull it together, man!"`: **improved materially**. Baseline reconciled dialogue never reached this line because the lyric spill block remained in the dialogue lane. Original-source reconciled dialogue now contains `"Pull it together, man."` after reconciliation removes the lyric contamination. Punctuation differs, but the spoken content is effectively restored.
- `"So eager to leave David."`: **improved materially**. Baseline reconciled dialogue lost this line inside the lyric-spill cascade. Original-source reconciled dialogue recovers it as `"So eager to leave, David."` — same spoken content with only comma/punctuation variation.
- `"Killing a man is a hell of a lot easier than killing an idea."`: **improved materially / effectively recovered**. Baseline reconciled dialogue lost this line; original-source reconciled dialogue restores `"Killing a man is a hell of a lot easier than killing an idea."` in the correct late block.

Bottom line for Task 9: swapping the source asset back to the original staged `cod.mp4` clearly helps the **song/reconciliation/music-vocals lane** and recovers the reviewed late spoken lines after reconciliation, but it does **not** improve the reviewed `"You shall know fear."` miss and it does **not** produce a dialogue benchmark win against the current cod-test baseline. The main measurable gain from this experiment is better lyric evidence/cleanup, not better whole-dialogue transcription accuracy.

---

### Task 10: Run the high-fidelity extraction experiment and compare dialogue benchmark deltas

**Bead ID:** `ee-eveb`  
**SubAgent:** `research`  
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, run the cod dialogue benchmark experiment using the higher-fidelity ffmpeg extraction lane after the reconciliation and music-vocals fixes are in place. Capture exact command, cassette/log paths, produced dialogue/reconciliation/music-vocals artifacts, and benchmark summary/result deltas versus the current cod-test baseline and the original-source experiment. Inspect the same reviewed lines so we can see whether higher-fidelity extraction changes the actual transcript outcomes. Claim bead ee-eveb on start with bd update ee-eveb --status in_progress --json and close it on completion with bd close ee-eveb --reason "ran high-fidelity extraction experiment and compared results" --json. Update the plan with evidence, not guesswork.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `.logs/`
- `output/`
- `benchmarks/fixtures/cod-test/_reports/`

**Files Created/Deleted/Modified:**
- `.plans/2026-04-09-audio-source-quality-experiments-for-cod-dialogue-benchmark.md`
- `.logs/cod-test-high-fidelity-flac-20260409-125031-ee-eveb.log`
- `.logs/cod-test-high-fidelity-flac-20260409-125031-ee-eveb.time`
- `.logs/cod-test-high-fidelity-flac-20260409-130847-ee-eveb-rerun.log`
- `.logs/cod-test-high-fidelity-flac-20260409-130847-ee-eveb-rerun.time`
- `.logs/cod-test-high-fidelity-flac-20260409-132351-ee-eveb-rerun2.log`
- `.logs/cod-test-high-fidelity-flac-20260409-132351-ee-eveb-rerun2.time`
- `.tmp/ee-eveb/high-fidelity-benchmark-summary.json`
- `.tmp/ee-eveb/high-fidelity-artifact-results/`
- `output/cod-test-high-fidelity-flac/phase1-gather-context/dialogue-data.json`
- `output/cod-test-high-fidelity-flac/phase1-gather-context/dialogue-data.reconciled.json`
- `output/cod-test-high-fidelity-flac/phase1-gather-context/famous-song-reconciliation.json`
- `output/cod-test-high-fidelity-flac/phase1-gather-context/music-vocals-data.json`
- `output/cod-test-high-fidelity-flac/phase1-gather-context/music-vocals-data.reconciled.json`
- `output/cod-test-high-fidelity-flac/assets/processed/dialogue/audio.flac`
- `output/cod-test-high-fidelity-flac/assets/processed/music/audio.flac`
- `output/cod-test-high-fidelity-flac/phase1-gather-context/raw/ffmpeg/dialogue/chunks/chunk_000.flac`
- `output/cod-test-high-fidelity-flac/phase1-gather-context/raw/ffmpeg/music/chunks/chunk_000.flac`
- `benchmarks/fixtures/cod-test/_reports/benchmark-summary.json`
- `benchmarks/fixtures/cod-test/_reports/artifact-results/`

**Status:** ✅ Complete

**Results:** Ran the FLAC-lane experiment with the exact command `node server/run-pipeline.cjs --config configs/cod-test-high-fidelity-flac.yaml --verbose`.

**Run / log evidence**
- Attempt 1 log: `.logs/cod-test-high-fidelity-flac-20260409-125031-ee-eveb.log` → failed in phase 1 with `OpenRouter: No content in response` while analyzing music vocals.
- Attempt 2 log: `.logs/cod-test-high-fidelity-flac-20260409-130847-ee-eveb-rerun.log` → failed in phase 1 with `OpenRouter: No content in response` while extracting dialogue.
- Attempt 3 log: `.logs/cod-test-high-fidelity-flac-20260409-132351-ee-eveb-rerun2.log` → completed artifact generation + benchmark, then exited non-zero because the benchmark still fails (`0/6 artifacts passed`).
- Successful benchmark summary copy: `.tmp/ee-eveb/high-fidelity-benchmark-summary.json`
- Successful detailed artifact reports copy: `.tmp/ee-eveb/high-fidelity-artifact-results/`
- Main output dir: `output/cod-test-high-fidelity-flac`

**Did FLAC transport work cleanly?**
- **Partially, but not cleanly end-to-end.** The ffmpeg FLAC extraction lane itself worked and produced isolated FLAC assets/chunks under `output/cod-test-high-fidelity-flac/assets/processed/*.flac` and `output/cod-test-high-fidelity-flac/phase1-gather-context/raw/ffmpeg/**/chunks/*.flac`.
- The dialogue and music artifacts show FLAC was actually consumed through the same chat/completions + inline/base64 path (`sourceStrategy: base64`, `transportMode: inline`).
- But the lane was **provider-unstable**: two attempts died with `OpenRouter: No content in response` before a third run completed far enough to benchmark.
- The FLAC lane also exceeded the whole-asset inline budget, so it fell back to chunking instead of staying whole-asset: dialogue provenance shows `fallbackApplied: true`, `fallbackReason: inline_audio_budget_exceeded`; music/music-vocals provenance shows `preflightReason: estimated_base64_exceeds_budget`.

**Exact artifact paths reviewed**
- Dialogue artifact: `output/cod-test-high-fidelity-flac/phase1-gather-context/dialogue-data.reconciled.json`
- Reconciliation artifact: `output/cod-test-high-fidelity-flac/phase1-gather-context/famous-song-reconciliation.json`
- Music-vocals artifact: `output/cod-test-high-fidelity-flac/phase1-gather-context/music-vocals-data.reconciled.json`
- Benchmark summary: `.tmp/ee-eveb/high-fidelity-benchmark-summary.json`

**Reconciliation status**
- `famous-song-reconciliation.json` is **still skipped**, not applied.
- Evidence: `status: skipped`; trigger shows `recognizedSong.status = possible`, `confidence = 0.7`, matched lyric evidence only `I obey my master`, and `supportingMusicRecognizedSong.status = unknown`.
- So the reconciliation fix is present in code, but this FLAC run did **not** cross the trigger threshold needed to apply it.

**Music-vocals coverage / expansion status**
- Current cod-test baseline: `vocal_segments = 2`, `analysisMode = whole_asset`, `usedChunking = false`.
- Original-source experiment: `vocal_segments = 16`, `analysisMode = hybrid`, `usedChunking = true`, `autoSelectedHybridForLyricCueCoverage = true`.
- High-fidelity FLAC experiment: `vocal_segments = 10`, `analysisMode = chunked`, `usedChunking = true`, `autoSelectedHybridForLyricCueCoverage = false`.
- Interpretation: FLAC **does not collapse all the way back to the tiny 2-segment baseline**, but it **does collapse relative to the original-source expanded lane** (10 segments vs 16) and loses the hybrid lyric-coverage selection.

**Benchmark deltas (high-fidelity FLAC vs current cod-test baseline)**
- Overall accuracy: `25.33%` vs `26.51%` → **-1.18 pts**
- Overall coverage: `48.51%` vs `47.86%` → **+0.65 pts**
- Passed scoreable fields: `95` vs `92` → **+3 fields**
- Dialogue accuracy: `20.37%` vs `26.79%` → **-6.42 pts**
- Dialogue coverage: `96.00%` vs `95.87%` → **+0.13 pts**
- Music accuracy: `30.00%` vs `31.37%` → **-1.37 pts**
- Music coverage: `78.43%` vs `86.44%` → **-8.01 pts**
- Music-vocals accuracy: `40.51%` vs `27.66%` → **+12.85 pts**
- Music-vocals coverage: `78.22%` vs `90.38%` → **-12.17 pts**

**Benchmark deltas (high-fidelity FLAC vs original-source experiment `output/cod-test-original-mp4-source`)**
- Overall accuracy: `25.33%` vs `28.28%` → **-2.94 pts**
- Overall coverage: `48.51%` vs `49.30%` → **-0.79 pts**
- Passed scoreable fields: `95` vs `110` → **-15 fields**
- Dialogue accuracy: `20.37%` vs `21.46%` → **-1.09 pts**
- Dialogue coverage: `96.00%` vs `94.91%` → **+1.09 pts**
- Music accuracy: `30.00%` vs `36.00%` → **-6.00 pts**
- Music coverage: `78.43%` vs `86.21%` → **-7.78 pts**
- Music-vocals accuracy: `40.51%` vs `42.71%` → **-2.20 pts**
- Music-vocals coverage: `78.22%` vs `80.67%` → **-2.45 pts**

**Known reviewed dialogue lines (evidence from the reconciled dialogue artifact)**
- `"You shall know fear."` → **unchanged miss / still not recovered**. The FLAC reconciled dialogue does not contain the line at all.
- `"Pull it together, man!"` → **improved vs current baseline, unchanged vs original-source**. Baseline currently has `"Need to pull it together, man."`; FLAC has `"Pull it together, man!"`; original-source already had `"Pull it together, man."`.
- `"So eager to leave David."` → **worsened vs current baseline and vs original-source**. Baseline and original-source keep it as its own beat (`"So eager to leave, David."`), while FLAC fuses it into `"So eager to leave, David. Killing the man is a hell of a lot easier than killing the idea."`.
- `"Killing a man is a hell of a lot easier than killing an idea."` → **worsened vs current baseline and vs original-source**. Baseline keeps the line as its own beat and original-source keeps the same beat with only minor article drift; FLAC fuses it with the previous line and degrades it to `"Killing the man is a hell of a lot easier than killing the idea."`.

**Additional dialogue observations from the FLAC lane**
- Opening line quality regressed: `"Your streets shall once again run red."` drops `"with your blood"`, which the current baseline and original-source both retain.
- The `"Menendez is a terrorist."` beat is not recovered cleanly; FLAC collapses the region to `"Terrorists. We're bringing peace and security to the world."`.
- Promo close is fine: `"Get the Reznov challenge pack when you pre-order now."` stays intact as a single beat.

**Bottom line for Task 10**
- The higher-fidelity ffmpeg FLAC lane is **not a benchmark win**.
- It does prove the FLAC extraction/transport path can run and produce isolated artifacts, but it does **not** run cleanly enough to trust yet because two attempts failed with provider-side empty responses.
- Reconciliation still **skips** for this lane.
- Music-vocals remains **partially expanded** versus the old 2-segment baseline, but it **collapses relative to the stronger original-source lane**.
- Net result: the FLAC lane gives a nice bump to music-vocals accuracy versus the current baseline, but it loses too much dialogue quality, loses music coverage, and underperforms the original-source experiment overall.

---

### Task 11: Decide the permanent path and land only justified changes

**Bead ID:** `ee-0oy9`  
**SubAgent:** `primary`  
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, synthesize the benchmark review, the reconciliation fix lane, the music-vocals fix lane, and both audio-quality experiment lanes, then land only the changes justified by the evidence. That may include benchmark truth corrections, a permanent cod-test asset-source change, improved ffmpeg defaults/config support, reconciliation fixes, music-vocals prompt/script fixes, some combination of those, or none beyond experiment configs. Verify the final repo state truthfully, update the plan with final reasoning and commit references, and claim/close bead ee-0oy9 with bd update ee-0oy9 --status in_progress --json and bd close ee-0oy9 --reason "phase1 blockers and audio-quality experiment conclusions landed and documented" --json.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `configs/`
- `server/`
- `test/`
- `benchmarks/fixtures/cod-test/`

**Files Created/Deleted/Modified:**
- `.plans/2026-04-09-audio-source-quality-experiments-for-cod-dialogue-benchmark.md`
- `benchmarks/fixtures/cod-test/truth/dialogue-data.json`
- `configs/cod-test.yaml`
- `configs/cod-test-original-mp4-source.yaml`
- `configs/cod-test-high-fidelity-flac.yaml`
- `server/scripts/get-context/reconcile-famous-song-phase1.cjs`
- `server/scripts/get-context/get-music-vocals.cjs`
- `test/scripts/reconcile-famous-song-phase1.test.js`
- `test/scripts/get-music-vocals.test.js`
- `test/lib/ffmpeg-config.test.js`

**Status:** ✅ Complete

**Results:** Landed only the evidence-backed changes and left the weaker lane as experiment-only.

**Permanent recommendation recorded:** "Revert `cod-test` to the original `cod.mp4` source and keep the benchmark/reconciliation/music-vocals fixes; FLAC is viable but currently less reliable and lower-performing, so it should not be the default."

**What changed permanently:**
- Kept the benchmark-truth corrections in `benchmarks/fixtures/cod-test/truth/dialogue-data.json` for the two human-approved lines: `So eager to leave David.` and `Killing a man is a hell of a lot easier than killing the idea.`
- Kept the reconciliation gate fix in `server/scripts/get-context/reconcile-famous-song-phase1.cjs` plus regression coverage in `test/scripts/reconcile-famous-song-phase1.test.js` so same-song `possible` support can unblock cleanup when the vocals lane is strong but the lyric-order heuristic is brittle.
- Kept the music-vocals coverage backstop in `server/scripts/get-context/get-music-vocals.cjs` plus regression coverage in `test/scripts/get-music-vocals.test.js` so `auto` prefers `hybrid` when upstream music context already indicates lyric-bearing song evidence.
- Promoted the original staged source back into the default benchmark config by changing `configs/cod-test.yaml` from `https://gambit-games-tests.s3.us-east-1.amazonaws.com/peanut-gallery/cod-720p-h264-mp3-optimized.mp4` to `https://gambit-games-tests.s3.us-east-1.amazonaws.com/peanut-gallery/cod.mp4`.

**What was intentionally not promoted to default:**
- `configs/cod-test-high-fidelity-flac.yaml` remains as an experiment artifact only. The FLAC lane proved technical viability, but not a benchmark win; it required retries, reconciliation still skipped in that lane, and it underperformed the original-source lane overall.
- `configs/cod-test-original-mp4-source.yaml` was retained as the experiment record for the lane whose conclusion is now promoted into `configs/cod-test.yaml`.

**Why the default changed back to `cod.mp4`:**
- The original-source experiment produced the strongest overall evidence of improvement in the Phase 1 blocker area that motivated this plan: reconciliation changed from `skipped` to `applied`, music-vocals expanded from 2 to 16 segments, and the reviewed late spoken lines (`Pull it together, man!`, `So eager to leave David.`, `Killing a man...`) were materially recovered after reconciliation.
- Even though the dialogue benchmark score itself was not a net win, Derrick explicitly approved the primary recommendation to revert `cod-test` to the original staged source, and that recommendation is consistent with the observed reduction in lyric-contamination/pathology versus the optimized-MP3 staged asset.
- The FLAC lane did not justify becoming default because it was less reliable in practice and lower-performing than the original-source lane.

**Minimal validation run after landing the default config change:**
- `node --test test/scripts/reconcile-famous-song-phase1.test.js`
- `node --test test/scripts/get-music-vocals.test.js`
- `node --test test/lib/ffmpeg-config.test.js`
- `node validate-configs.cjs`

All four validation commands passed. No additional long live rerun was started in this task.

---

### Task 8b: Check official Xiaomi/Mimo documentation for FLAC audio support before using the experiment lane

**Bead ID:** `ee-ym8b`  
**SubAgent:** `research`  
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, verify whether Xiaomi/Mimo official documentation explicitly supports FLAC audio inputs for the chat/multimodal path we use. Prefer official Xiaomi/Mimo docs over forum guesses. If official docs are silent, say so clearly and summarize the strongest adjacent evidence you can find. Do not change code or configs. Claim bead ee-ym8b on start with bd update ee-ym8b --status in_progress --json and close it on completion with bd close ee-ym8b --reason "researched official Xiaomi/Mimo FLAC support documentation" --json. Update the plan with links/findings and a recommendation for whether to trust FLAC before the run.`

**Folders Created/Deleted/Modified:**
- `.plans/`

**Files Created/Deleted/Modified:**
- `.plans/2026-04-09-audio-source-quality-experiments-for-cod-dialogue-benchmark.md`

**Status:** ✅ Complete

**Results:** Official Xiaomi docs do explicitly mention FLAC support for the same chat/multimodal path we use.
- `https://platform.xiaomimimo.com/docs/usage-guide/multimodal-understanding/audio-understanding.md` uses `POST https://api.xiaomimimo.com/v1/chat/completions` with `messages[].content[].type = "input_audio"`, matching our chat/completions multimodal route.
- That same official page’s **Audio Restrictions** section explicitly lists `Audio Formats: MP3, WAV, FLAC, M4A, OGG.`
- The same page documents both transport modes for `input_audio.data`: public audio URL input (single file <= 100 MB) and Base64 input with MIME prefix `data:{MIME_TYPE};base64,...` (encoded string <= 10 MB).
- The OpenAI-compatible schema page at `https://platform.xiaomimimo.com/docs/api/chat/openai-api.md` separately confirms `input_audio` on `chat/completions`, with `input_audio.data` described as either an audio URL or base64-encoded audio data.

Important Xiaomi caveat: right after listing FLAC, the docs warn that `Audio Formats variants are numerous, and it cannot be guaranteed that all files can be recognized. Please verify through testing that the files can be recognized normally.` So FLAC is explicitly documented, but Xiaomi still leaves some codec/container variant risk.

Recommendation: **keep FLAC and run it**. This is not just adjacent inference; FLAC is officially listed on the Xiaomi audio-understanding page for the same `chat/completions` + `input_audio` path. Keep the first FLAC benchmark bounded and watch for provider-side decode failures; if one appears, fall back to WAV before interpreting model-quality differences.

---

### Task 12: Rerun optimized `cod-test.yaml` with the new script fixes and compare it directly against the original-source lane

**Bead ID:** `ee-47hn`  
**SubAgent:** `research`  
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, rerun the default optimized cod-test lane using the current repo state (including the benchmark truth fixes, reconciliation fix, and music-vocals backstop), then compare it directly against the original-source experiment lane. Claim bead ee-47hn on start with bd update ee-47hn --status in_progress --json and close it on completion with bd close ee-47hn --reason "reran optimized cod-test with current fixes and compared against original-source lane" --json. Use configs/cod-test.yaml as currently checked in. Capture exact command, logs, artifact paths, and benchmark deltas. Focus on whether dialogue, music, and music-vocals meaningfully regress when using the optimized asset, or whether the previously observed difference was largely due to stale script state in the old baseline. Update the plan with evidence, not guesses.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `.logs/`
- `output/`
- `benchmarks/fixtures/cod-test/_reports/`

**Files Created/Deleted/Modified:**
- `.plans/2026-04-09-audio-source-quality-experiments-for-cod-dialogue-benchmark.md`
- new logs/artifacts/reports under the default `cod-test` output lane

**Status:** ✅ Complete

**Results:** Reran the current checked-in default lane with the exact command `node server/run-pipeline.cjs --config configs/cod-test.yaml --verbose` from repo root. Main log: `.logs/cod-test-20260409-161249-ee-47hn-rerun.log`. Timing file: `.logs/cod-test-20260409-161249-ee-47hn-rerun.time` (`elapsed=9:44.97`, exit `1` because the benchmark still fails). Captured command record: `.tmp-ee-47hn-cmd`. Output root: `output/cod-test`.

**Important config reality check:** this rerun did **not** actually execute an optimized-source lane. By the time of this task, `configs/cod-test.yaml` had already been updated in Task 11 to use the same staged source URL as the original-source experiment config: `https://gambit-games-tests.s3.us-east-1.amazonaws.com/peanut-gallery/cod.mp4`. So this task truthfully compares the **current default cod-test lane with fixes** against the earlier `output/cod-test-original-mp4-source` run, not optimized-MP3 vs original-MP4. The meaningful question answered here is whether the old gap mostly disappeared once the current fixes were in place.

**Produced artifact paths (current rerun):**
- Dialogue: `output/cod-test/phase1-gather-context/dialogue-data.reconciled.json`
- Reconciliation ledger: `output/cod-test/phase1-gather-context/famous-song-reconciliation.json`
- Music-vocals: `output/cod-test/phase1-gather-context/music-vocals-data.reconciled.json`
- Music: `output/cod-test/phase1-gather-context/music-data.json`
- Benchmark summary: `benchmarks/fixtures/cod-test/_reports/benchmark-summary.json`

**Direct comparison target:** `output/cod-test-original-mp4-source`
- Dialogue: `output/cod-test-original-mp4-source/phase1-gather-context/dialogue-data.reconciled.json`
- Reconciliation ledger: `output/cod-test-original-mp4-source/phase1-gather-context/famous-song-reconciliation.json`
- Music-vocals: `output/cod-test-original-mp4-source/phase1-gather-context/music-vocals-data.reconciled.json`
- Music: `output/cod-test-original-mp4-source/phase1-gather-context/music-data.json`
- Benchmark summary snapshot used for comparison: `.tmp/ee-98df/experiment-benchmark-summary.json`

**Reconciliation status:** both lanes now show `status: "applied"`, but the current rerun applies a much narrower cleanup. Current rerun ledger removes only **1** lyric-contamination dialogue segment (`index 18`, `"Obey your master."`). The earlier original-source experiment removed **4** contaminated dialogue segments (`indexes 14, 15, 17, 24`). That means the reconciliation fix is definitely active in the current rerun — a major improvement over the old stale baseline that skipped entirely — but the stronger original-source experiment still produced broader lyric cleanup.

**Music-vocals coverage:** current rerun materially improved over the stale old baseline, but it still trails the original-source experiment.
- Old stale baseline before the fixes: **2** vocal segments, reconciliation `skipped`
- Current rerun: **7** vocal segments, `analysisMode: "hybrid"`, `recognizedSong.status: "recognized"`, confidence `0.93`
- Original-source experiment: **16** vocal segments, `analysisMode: "hybrid"`, `recognizedSong.status: "recognized"`, confidence `0.98`

So the gap is no longer collapse-vs-richness; it is now moderate richness-vs-richer coverage. That strongly suggests the earlier dramatic difference was largely stale-script-state driven rather than purely source-driven.

**Music lane comparison:** current rerun `music-data.json` contains **4** music segments with `recognizedSong.status: "possible"` at `0.64`; the earlier original-source experiment had **7** music segments with the same `possible 0.64` song recognition but a broader music arc summary. Music benchmark performance is effectively flat-to-slightly-better in the current rerun despite the lower segment count.

**Benchmark delta summary (current rerun `output/cod-test` vs earlier original-source experiment `output/cod-test-original-mp4-source`):**
- Overall benchmark accuracy: **27.35%** vs **28.28%** → **-0.93 pts**
- Overall truth coverage: **48.95%** vs **49.30%** → **-0.35 pts**
- Scoreable fields passed: **102** vs **110** → **-8 fields**
- Dialogue accuracy: **23.39%** vs **21.46%** → **+1.93 pts**
- Dialogue coverage: **93.97%** vs **94.91%** → **-0.94 pts**
- Music accuracy: **36.36%** vs **36.00%** → **+0.36 pts**
- Music coverage: **88.00%** vs **86.21%** → **+1.79 pts**
- Music-vocals accuracy: **41.18%** vs **42.71%** → **-1.53 pts**
- Music-vocals coverage: **81.93%** vs **80.67%** → **+1.26 pts**

Interpretation: with the current fixes in place, the default rerun is **very close overall** to the earlier original-source lane. Dialogue and music do **not** show a meaningful regression in the current rerun; if anything, their accuracy is slightly better. The main remaining deficit is that music-vocals is less rich in raw recovered lyric span (7 segments vs 16, slightly lower accuracy) even though benchmark coverage is not worse. So the old dramatic baseline-vs-original gap was **mostly** stale-script-state / pre-fix behavior, not a clean optimized-asset penalty.

**Known reviewed lines (current rerun vs original-source experiment):**
- `"You shall know fear."` — still **not recovered** in either lane; current rerun still only has `"Fear makes you easier to control."` in that opening block.
- `"Pull it together, man!"` — recovered in both lanes as `"Pull it together, man."`; no meaningful regression.
- `"So eager to leave David."` — current rerun recovers it, but fused with the next reviewed line as `"So eager to leave, David. Killing a man is a hell of a lot easier than killing an idea."`; the earlier original-source experiment kept them as separate beats. Spoken content is present, segmentation is worse.
- `"Killing a man is a hell of a lot easier than killing an idea."` — likewise present in the current rerun but fused into the same combined beat with the prior line, whereas the earlier original-source experiment kept it as its own line.

**Conclusion recorded from evidence:** the current fixed default lane no longer looks like a materially worse lane than the earlier original-source experiment. The remaining differences are comparatively small and mostly concentrated in music-vocals richness / reconciliation breadth, not in a broad dialogue or music collapse. Because `configs/cod-test.yaml` now uses the same `cod.mp4` staged asset as the original-source experiment, this task does **not** provide fresh evidence about optimized-asset regression itself; it instead shows that the previously large old-baseline gap was largely due to stale script state before the reconciliation and music-vocals fixes landed.

---

### Task 13: Switch `cod-test.yaml` back to the optimized S3 asset and rerun for a true apples-to-apples comparison

**Bead ID:** `ee-mivg`  
**SubAgent:** `research`  
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, switch configs/cod-test.yaml back to the previously used optimized S3 asset URL (`https://gambit-games-tests.s3.us-east-1.amazonaws.com/peanut-gallery/cod-720p-h264-mp3-optimized.mp4`), then rerun cod-test with the current fixed scripts so we get a true apples-to-apples comparison against the original-source lane. Claim bead ee-mivg on start with bd update ee-mivg --status in_progress --json and close it on completion with bd close ee-mivg --reason "switched cod-test to optimized asset and reran apples-to-apples comparison" --json. Capture exact command, logs, artifact paths, and benchmark deltas versus the original-source lane. Update the plan with evidence and exact config diffs. Do not change prompts or unrelated code.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `.logs/`
- `output/`
- `benchmarks/fixtures/cod-test/_reports/`

**Files Created/Deleted/Modified:**
- `.plans/2026-04-09-audio-source-quality-experiments-for-cod-dialogue-benchmark.md`
- `configs/cod-test.yaml`
- new logs/artifacts/reports under the default `cod-test` output lane

**Status:** ✅ Complete

**Results:** Switched `configs/cod-test.yaml` back to the optimized staged asset and reran the lane with the exact command `node server/run-pipeline.cjs --config configs/cod-test.yaml --verbose` from repo root.

**Exact config diff in this task:**
- `asset.media.refs.source_video.staged.url`: `https://gambit-games-tests.s3.us-east-1.amazonaws.com/peanut-gallery/cod.mp4` → `https://gambit-games-tests.s3.us-east-1.amazonaws.com/peanut-gallery/cod-720p-h264-mp3-optimized.mp4`

**Run / artifact evidence:**
- Log: `.logs/cod-test-20260409-163700-ee-mivg-optimized-rerun.log`
- Timing: `.logs/cod-test-20260409-163700-ee-mivg-optimized-rerun.time` (`elapsed=7:32.88`, exit `1` because benchmark still failed)
- Output root: `output/cod-test`
- Dialogue artifact: `output/cod-test/phase1-gather-context/dialogue-data.reconciled.json`
- Music artifact: `output/cod-test/phase1-gather-context/music-data.json`
- Music-vocals artifact: `output/cod-test/phase1-gather-context/music-vocals-data.reconciled.json`
- Reconciliation ledger: `output/cod-test/phase1-gather-context/famous-song-reconciliation.json`
- Benchmark summary: `benchmarks/fixtures/cod-test/_reports/benchmark-summary.json`

**Reconciliation status vs original-source lane:** both lanes now reconcile successfully, but the optimized lane is narrower.
- Optimized rerun: `status: "applied"`, removed **1** contaminated dialogue segment (`index 18` / `"Obey your master."`)
- Original-source lane `output/cod-test-original-mp4-source`: `status: "applied"`, removed **4** contaminated dialogue segments (`indexes 14, 15, 17, 24`)

**Music-vocals coverage comparison:**
- Optimized rerun: **14** vocal segments, `recognizedSong.status = recognized`, confidence `0.95`
- Original-source lane: **16** vocal segments, `recognizedSong.status = recognized`, confidence `0.98`
- Interpretation: after the script fixes, the optimized asset no longer collapses to the old 2-line failure mode. Coverage is now close, but the original-source lane is still richer and slightly more confident.

**Benchmark delta vs original-source lane (`current optimized` minus `output/cod-test-original-mp4-source`):**
- Overall accuracy: **26.00% vs 28.28%** → **-2.28 pts**
- Overall truth coverage: **49.75% vs 49.30%** → **+0.45 pts**
- Passed scoreable fields: **104 vs 110** → **-6 fields**
- Dialogue accuracy: **18.47% vs 21.46%** → **-2.99 pts**
- Dialogue coverage: **93.67% vs 94.91%** → **-1.24 pts**
- Music accuracy: **31.11% vs 36.00%** → **-4.89 pts**
- Music coverage: **84.91% vs 86.21%** → **-1.30 pts**
- Music-vocals accuracy: **44.21% vs 42.71%** → **+1.50 pts**
- Music-vocals coverage: **80.51% vs 80.67%** → **-0.16 pts**

**Reviewed-line behavior:**
- `"You shall know fear."` → still **not recovered** in either lane.
- `"Pull it together, man!"` → recovered in both lanes as `"Pull it together, man."`; no meaningful regression.
- `"So eager to leave David."` → recovered cleanly in both lanes as `"So eager to leave, David."`; no meaningful regression.
- `"Killing a man is a hell of a lot easier than killing an idea."` → recovered cleanly in both lanes as its own line; no meaningful regression.

**Reconciliation status / interpretation:** this apples-to-apples rerun shows that the earlier huge optimized-vs-original gap was largely stale-script-state driven, but a smaller real source difference still remains. With the fixes in place, the optimized asset is now competitive on music-vocals and preserves the reviewed late spoken lines, yet it still trails the original-source lane overall and regresses meaningfully on the dialogue and music benchmark slices.

---

### Task 14: Compare dialogue lines across gold truth vs optimized rerun vs original-source rerun

**Bead ID:** `ee-ft7p`  
**SubAgent:** `research`  
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, compare the dialogue line differences across: (1) benchmark gold truth at benchmarks/fixtures/cod-test/truth/dialogue-data.json, (2) the optimized rerun at output/cod-test/phase1-gather-context/dialogue-data.reconciled.json, and (3) the original-source rerun at output/cod-test-original-mp4-source/phase1-gather-context/dialogue-data.reconciled.json. Claim bead ee-ft7p on start with bd update ee-ft7p --status in_progress --json and close it on completion with bd close ee-ft7p --reason "compared dialogue lines across gold truth optimized and original-source lanes" --json. Produce a concise but useful line-by-line comparison focused on meaningful divergences: lines both runs get right, lines only one run gets right, lines both miss differently, line fusions/splits, and any especially interesting or surprising differences Derrick would care about. Update the plan with exact artifact paths and a truthful summary. Do not change code or prompts.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `.tmp/`

**Files Created/Deleted/Modified:**
- `.plans/2026-04-09-audio-source-quality-experiments-for-cod-dialogue-benchmark.md`
- any temporary comparison notes if needed

**Status:** ✅ Complete

**Results:** Compared these exact artifacts:
- Gold truth: `benchmarks/fixtures/cod-test/truth/dialogue-data.json`
- Optimized rerun: `output/cod-test/phase1-gather-context/dialogue-data.reconciled.json`
- Original-source rerun: `output/cod-test-original-mp4-source/phase1-gather-context/dialogue-data.reconciled.json`

Truthful line-by-line summary focused on meaningful divergences:
- **Lines both runs get right (or effectively right with punctuation/casing only):** the two reruns are essentially tied on most of the non-problem regions. Both preserve the opening propaganda/dialogue block after the first truth-line split (`"It's time to wake up."` through `"He refuses to let me go."`), both keep `"A lot of people counting on us for answers."`, both recover the late reviewed lines `"Pull it together, man."`, `"So eager to leave, David."`, and the final promo close, and both keep `"You were never cut out to be a Mason."` / `"No more games. This ends now."`. Both also render `"Killing ... idea"` with the same minor article drift (`an idea` instead of gold `the idea`).
- **Lines only the original-source rerun gets right:** the original-source lane clearly wins in the troubled middle block. It keeps `"Need a sitrep."` exactly, keeps `"The hell it ain't!"` exactly, and at least partially preserves the `"Specter one, report."` beat as `"Spectre Wolf report."` while the optimized lane drops that entire region. In other words, the original-source rerun recovers the pre-lyric handoff around truth indexes 10-13 while the optimized lane largely loses it.
- **Lines only the optimized rerun gets right:** none of the meaningful dialogue lines are better in the optimized lane than in the original-source lane. The optimized lane does not have a clean win on any reviewed or benchmark-important line; its only relative advantage is the absence of the two extra stray `"Master, master."` lines that still leak into the original-source artifact, but that is not a recovery of a missing truth line.
- **Lines both miss differently:** both runs still miss `"You shall know fear."` entirely. The original-source lane then collapses that region into `"Spectre Wolf report."`, while the optimized lane skips straight from `"A lot of people counting on us for answers."` to `"This isn't real."` and never surfaces the `Specter` / `sitrep` exchange at all. Both also share the same earlier wording error on `"Stop looking backwards, David. What matters is what we do next."`, rendering it as `"Stop looking backwards, David, but matters is what we do next."`.
- **Fusion / split behavior:** both reruns split the gold opening line `"They want you afraid. Fear makes you easier to control."` into two separate dialogue lines, which is benign and probably preferable. Neither rerun fuses the reviewed late pair anymore; both keep `"So eager to leave, David."` and `"Killing a man ... idea."` as separate lines in this apples-to-apples comparison. The meaningful remaining structure difference is lyric contamination: the optimized rerun still contains one giant fused lyric blob (`"Obey your master ... Master. Master."`) where the truth has no dialogue lines, while the original-source rerun contains two smaller stray `"Master, master."` lines instead. So original-source still leaks lyrics, but in a much less destructive shape.
- **Especially interesting / surprising differences Derrick would care about:** after the script fixes, the optimized lane is no longer catastrophically collapsed — on most ordinary dialogue lines it is basically neck-and-neck with the original-source lane. The real source-sensitive gap is concentrated in the midsection around truth indexes 9-13, where original-source preserves the dialogue handoff around `"Specter one, report."` / `"Need a sitrep."` / `"The hell it ain't!"` and optimized still falls into a broader lyric-bleed hole. That makes the original-source advantage feel less like a global ASR win and more like a local robustness win around the contamination boundary.

Bottom-line interpretation from the direct dialogue-line comparison: **the optimized rerun is mostly competitive once the script fixes are in place, but the original-source rerun is still better where it matters most — it preserves more real spoken dialogue through the lyric-contamination zone and degrades the remaining lyric leak into smaller, less destructive fragments.**

---

## Final Results

**Status:** ✅ Complete

**What We Built:** Landed the benchmark-truth fixes, the reconciliation gate fix, the music-vocals hybrid backstop, and both experiment configs; then completed a true apples-to-apples optimized-vs-original rerun by switching `configs/cod-test.yaml` back to the optimized staged asset and rerunning the fixed lane.

**Executive Summary:** The true apples-to-apples rerun confirms the big old optimized-vs-original gap was mostly stale-script-state noise, but the optimized MP3 asset still underperforms the original `cod.mp4` lane overall once both are run on the fixed scripts. The remaining regression is concentrated in dialogue and music, while music-vocals is roughly comparable and no longer collapsed.

**Exact Files Changed/Landed:**
- `.plans/2026-04-09-audio-source-quality-experiments-for-cod-dialogue-benchmark.md`
- `benchmarks/fixtures/cod-test/truth/dialogue-data.json`
- `configs/cod-test.yaml`
- `configs/cod-test-original-mp4-source.yaml`
- `configs/cod-test-high-fidelity-flac.yaml`
- `server/scripts/get-context/reconcile-famous-song-phase1.cjs`
- `server/scripts/get-context/get-music-vocals.cjs`
- `test/scripts/reconcile-famous-song-phase1.test.js`
- `test/scripts/get-music-vocals.test.js`
- `test/lib/ffmpeg-config.test.js`

**Exact Recommendation / Conclusion Recorded:**
- Benchmark truth fixes: keep them.
- Reconciliation fix: keep it.
- Music-vocals backstop: keep it.
- FLAC lane: keep as experiment-only.
- Source recommendation after the true rerun: **prefer the original `cod.mp4` lane for this benchmark**, even though the optimized lane is much closer now than the stale pre-fix baseline suggested.

**Repo-state note:** Task 13 intentionally left `configs/cod-test.yaml` pointing at the optimized staged URL so the final apples-to-apples rerun state is preserved in the working tree. The recommendation above still favors the original-source lane based on the measured deltas.

**Validation Commands:**
- `node --test test/scripts/reconcile-famous-song-phase1.test.js`
- `node --test test/scripts/get-music-vocals.test.js`
- `node --test test/lib/ffmpeg-config.test.js`
- `node validate-configs.cjs`
- `node server/run-pipeline.cjs --config configs/cod-test.yaml --verbose`

**Validation Result:** All targeted tests/config validation passed earlier in the plan, and the final optimized rerun completed artifact generation plus benchmark reporting before exiting non-zero on the expected benchmark failure gate.

**Commits:**
- Not created in this task.

**Lessons Learned:**
- The stale pre-fix cod baseline exaggerated the source-quality gap.
- Once reconciliation and music-vocals routing were fixed, the optimized asset stopped collapsing — but it still gave up enough dialogue/music quality that the original source remains the better benchmark lane.
- A technically supported transport format is not automatically a safe default; provider stability and benchmark movement matter more than theoretical fidelity.

**Open Items:**
- Follow-up decision needed if Derrick wants `configs/cod-test.yaml` switched back to the recommended original-source URL after preserving this apples-to-apples rerun state.
- FLAC may still be worth future bounded experimentation or a WAV follow-up, but it should stay non-default until it proves both reliability and benchmark benefit.

---

*Drafted on 2026-04-09*