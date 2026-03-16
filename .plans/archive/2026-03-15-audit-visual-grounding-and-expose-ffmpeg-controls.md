# emotion-engine: audit visual grounding and expose FFmpeg controls

**Date:** 2026-03-15
**Status:** Complete  
**Agent:** Cookie 🍪

---

## Goal

Determine whether Phase 2 chunk analysis is actually seeing the video content it is supposed to evaluate, then expose FFmpeg audio/video extraction controls in YAML so Derrick can tune base asset quality to reduce grounding failures and hallucination risk.

---

## Overview

The latest successful `cod-test` run produced a valid pipeline result, but the chunk-level persona outputs strongly suggest a grounding defect: the model appears to be reacting mostly to dialogue, music, and carried-forward prior state, while repeatedly describing later sections with generic labels like "corporate intro" that do not match the expected Call of Duty trailer visuals. That makes visual grounding the top priority, ahead of recommendation polish or other secondary quality work.

This plan splits the work into two deliberate lanes. First, perform a forensic audit of the Phase 2 chunk-analysis path to confirm exactly what visual evidence the model receives per chunk, how that evidence is encoded and passed, whether frame extraction/selection is healthy, and where drift or payload loss might be happening. Second, implement the already-identified FFmpeg-YAML work so audio/video extraction quality becomes an explicit config knob rather than a hardcoded hidden default. That will let Derrick tune fidelity after the grounding path is verified.

The owning repo is `emotion-engine`, because the Phase 2 pipeline, chunk analysis, asset preparation, config loader, and FFmpeg call sites all live here.

---

## Tasks

### Task 1: Forensic audit of Phase 2 visual grounding

**Bead ID:** `ee-9pr`
**SubAgent:** `coder`
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, audit the full Phase 2 visual-grounding path for chunk analysis. Verify what video-derived assets are produced per chunk, which exact files/frames are passed into the model, whether those assets are present and high enough quality, and whether prompt/input assembly could cause the model to rely mostly on dialogue/music/prior-state instead of fresh visuals. Use the recent cod-test run as the main evidence source where useful. Update this plan with exact file-level findings, artifact paths, and the most likely failure point(s). Claim the assigned bead on start and close it on completion.`

**Folders Created/Deleted/Modified:**
- `server/`
- `output/`
- `.plans/`

**Files Created/Deleted/Modified:**
- `.plans/2026-03-15-audit-visual-grounding-and-expose-ffmpeg-controls.md`
- optional audit notes/scripts if needed

**Status:** ✅ Complete

**Results:**
- **Main failure layer: payload wiring / prompt assembly, not model temperament.** Phase 2 does create per-chunk MP4 assets in `output/cod-test/assets/processed/chunks/`, but the model is never given any video bytes, image frames, or file references it can inspect.
- **Exact code path:** `server/scripts/process/video-chunks.cjs:540-548` builds `videoContext.chunkPath`, start/end, and duration for each chunk, but `../tools/emotion-lenses-tool.cjs:89-137` turns that into prompt text containing only dialogue, music, previous summary, and `## Video - Duration: <n>s` (plus optional frame count if `videoContext.frames` existed). No frame descriptions are added, and no frame extraction happens in this path.
- **Provider call proof:** `../tools/emotion-lenses-tool.cjs:324-352` calls `activeProvider.complete({ prompt, model, ... })` with a text prompt only. There is no attached `chunkPath`, no base64 video, no image list, and no multimodal input structure. So the exact files/frames passed into the model per chunk are: **none**.
- **Prompt artifact proof:**
  - Chunk 0 prompt: `output/cod-test/_meta/ai/_prompts/c070fe45ce96abb607dbc7ca3a9806578514d3fb1ea0cb1df5da03e24730f13b.json` contains only persona text, dialogue lines (`They want you afraid`, `Fear makes you easier to control`), the one music segment, and `## Video - Duration: 5s`.
  - Chunk 14 prompt: `output/cod-test/_meta/ai/_prompts/fcdd830919599929c87f67578e29b9bb90ec01e0b6d50810d166af7707ef1254.json` contains previous summary + the same global music segment + `## Video - Duration: 5s`; it includes **no dialogue and no visual evidence** for 70-75s.
  - That exactly matches the suspicious outputs in `output/cod-test/phase2-process/chunk-analysis.json`, where later chunks degrade into repeated generic claims like `corporate intro vibes`, `generic corporate visuals`, and `slow visual buildup` despite the source trailer containing gameplay/cinematic action.
- **Recent cod-test artifact evidence:** `output/cod-test/phase2-process/chunk-analysis.json` shows the model leaning heavily on dialogue/music/previous state. Early chunks track transcript lines closely (`They want you afraid`, `Fear makes you easier to control`, `blood`, `global unrest`, `sitrep`), while dialogue-free later chunks collapse into generic visual hallucinations. Chunk 14 onward repeatedly describe `generic intro vibes` / `corporate visuals`, which is consistent with text-only inference from persona priors plus carry-forward state, not fresh visual grounding.
- **Secondary extraction defect found in the asset layer:** the chunk files themselves are not clean 5s slices after chunk 0. `server/lib/video-chunk-extractor.cjs:142-154` runs FFmpeg as `-ss <start> -i <video> -to <end> -c copy`, which makes `-to` act like an absolute output timestamp after the seek. Result: chunk durations become cumulative windows from the source start point, not true 5s subclips.
  - Verified by artifact inspection with `ffprobe` on produced files in `output/cod-test/assets/processed/chunks/`:
    - `chunk_000.mp4` ≈ `5.02s`
    - `chunk_001.mp4` ≈ `10.03s`
    - `chunk_002.mp4` ≈ `15.04s`
    - `chunk_013.mp4` ≈ `70.03s`
    - `chunk_014.mp4` ≈ `70.02s`
    - `chunk_017.mp4` ≈ `55.02s`
    - `chunk_027.mp4` ≈ `5.02s`
  - Raw FFmpeg evidence: `output/cod-test/phase2-process/raw/ffmpeg/extract-chunk-14.json` records command `-ss 70 -i ... -to 75 -c copy`, and FFmpeg reports `time=00:01:09.95`, producing a ~31.8MB file instead of a 5s clip.
- **Asset presence / quality conclusion:** the produced MP4s are present and visually high-quality enough on disk (copied H.264 1280x720 @ ~59.94fps from the source), but they are both (a) not actually consumed by the model and (b) often mis-sliced due to the FFmpeg `-to` usage.
- **Config mismatch that helped hide the extraction issue:** `configs/cod-test.yaml:73-84` declares `tool_variables.file_transfer: "base64"` and `maxFileSize: 10485760`, but `server/scripts/process/video-chunks.cjs:486-503` reads `config?.tool_variables?.file_transfer?.maxFileSize`, implying an object shape that the YAML does not use. In this run, that means oversize chunk splitting never triggers even when extracted files balloon to 10-31MB.
- **Likeliest failure ordering:**
  1. **Primary root cause:** Phase 2 never sends fresh visual evidence to the model at all.
  2. **Secondary contributing defect:** extracted chunk assets are frequently the wrong duration because FFmpeg slicing is cumulative.
  3. **Tertiary config mismatch:** size-guard / split logic is reading the wrong YAML shape, so oversized bad chunks are not corrected before analysis.

---

### Task 2: Define the fix lane for visual grounding

**Bead ID:** `ee-lfm`
**SubAgent:** `primary`
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, synthesize the visual-grounding audit into a bounded implementation plan. Decide whether the fix is in frame extraction, frame selection, prompt assembly, payload wiring, state-carryover weighting, or another specific layer. Update this plan with the exact recommended implementation lane, affected files, and validation strategy. Claim the assigned bead on start and close it on completion.`

**Folders Created/Deleted/Modified:**
- `.plans/`

**Files Created/Deleted/Modified:**
- `.plans/2026-03-15-audit-visual-grounding-and-expose-ffmpeg-controls.md`

**Status:** ✅ Complete

**Results:**
- **Recommended bounded fix lane:** repair the grounding path in four ordered layers, with **frame-based multimodal input as the primary remediation**. Do **not** try to send whole chunk MP4s into the model first; that keeps the payload large, keeps splitting brittle, and is unnecessary for proving grounding. Instead, make chunk slicing truthful, extract a small bounded set of representative still frames per chunk/split, attach those frames as multimodal image inputs, and then reduce prompt carry-over so fresh visuals dominate late chunks.
- **Exact order of operations:**
  1. **Fix chunk truthfulness at the asset layer before changing prompts.** In `server/lib/video-chunk-extractor.cjs`, replace the current `-ss <start> -i <video> -to <end> -c copy` behavior with a true duration-bounded slice (`-t <duration>` or equivalent) so each produced chunk/split is actually the requested window. In `server/scripts/process/video-chunks.cjs`, canonicalize config reads so the size guard honors both the current flat YAML shape (`tool_variables.maxFileSize`) and the canonical nested shape (`tool_variables.file_transfer.maxFileSize`) during migration, and read split settings from the same place the configs declare them (`tool_variables.chunk_strategy.split`, with temporary backward compatibility for any legacy path if needed).
  2. **Add bounded frame extraction/selection in `emotion-engine`.** Introduce a small helper such as `server/lib/video-frame-extractor.cjs` that samples a fixed count of JPEG frames per chunk/split (for example: first/middle/last or a capped evenly spaced set), sized for multimodal transport. Wire it from `server/scripts/process/video-chunks.cjs` so `analyzeInput.videoContext` carries concrete per-frame metadata (`timestamp`, `path`, `mimeType`, optional `base64`/transport payload), not just `chunkPath` and duration.
  3. **Wire the visual evidence into the canonical tool call.** In `../tools/emotion-lenses-tool.cjs`, extend `buildPrompt` / `buildBasePromptFromInput` so the prompt names the attached frames and tells the model to ground its judgment in those visuals first, then dialogue/music, then previous summary only as continuity. In the same file, pass `image` attachments through `provider.complete(...)` / `executeEmotionAnalysisToolLoop(...)` the same way dialogue transcription already passes audio attachments. This keeps the provider layer unchanged because `ai-providers` already supports image attachments.
  4. **Constrain prompt/state carry-over after visuals are live.** Still in `../tools/emotion-lenses-tool.cjs` and `server/scripts/process/video-chunks.cjs`, trim `previousState.summary` to a short continuity handoff, explicitly instruct the model not to invent unseen visuals, and require summaries/reasoning to prefer visible evidence when frame attachments exist. This is a follow-on safeguard, not the first fix.
- **Recommended canonical config shape to align in implementation:** use the already-more-complete nested structure shown in `configs/video-analysis.yaml` as the source of truth:
  - `tool_variables.file_transfer.strategy`
  - `tool_variables.file_transfer.maxFileSize`
  - `tool_variables.chunk_strategy.split.enabled`
  - `tool_variables.chunk_strategy.split.max_splits`
  - `tool_variables.chunk_strategy.split.split_factor`
  Keep temporary compatibility reads for the flat `cod-test.yaml` shape only long enough to migrate configs without breaking current runs.
- **Affected files for the implementation lane:**
  - `server/lib/video-chunk-extractor.cjs`
  - `server/scripts/process/video-chunks.cjs`
  - `server/lib/video-frame-extractor.cjs` *(new)*
  - `configs/cod-test.yaml`
  - `configs/single-chunk-test.yaml`
  - `configs/single-chunk-test-debug.yaml`
  - `configs/single-chunk-test-per-second.yaml`
  - `configs/video-analysis.yaml`
  - `test/scripts/video-chunks.test.js`
  - `../tools/emotion-lenses-tool.cjs`
  - `../tools/test/emotion-lenses-tool.test.js`
- **Minimal validation after each step:**
  1. **After chunk extraction/config canonicalization:** run the smallest chunking test and `ffprobe` representative outputs (`chunk_001`, `chunk_014`, one split chunk if applicable) to prove durations are bounded to the requested window and oversize chunks now trigger the configured split guard.
  2. **After frame extraction wiring:** run one or two chunk analyses and verify frame artifacts exist on disk, frame counts are capped, timestamps map to the chunk window, and the raw capture/input object shows `videoContext.frames` populated.
  3. **After multimodal tool wiring:** inspect the provider debug/raw capture to confirm `image` attachments are present in the request payload, then run a tiny validation set (one dialogue-heavy chunk and one dialogue-light late chunk) to verify the model output references concrete visible evidence instead of only transcript/music priors.
  4. **After prompt/state-carryover tightening:** rerun the minimal late-chunk regression set from `cod-test` (at least chunk 14 plus one nearby chunk) and confirm the repeated `corporate intro` / `generic corporate visuals` pattern drops out unless those visuals are actually present.
- **Why this lane is bounded:** it stops at trustworthy multimodal grounding for Phase 2 chunk analysis. It does not redesign the persona system, does not change FFmpeg quality knobs yet beyond the chunk-slicing bug/config read needed to make grounding truthful, and does not broaden into the separate YAML-exposure lane already reserved for Task 3.

---

### Task 3: Expose FFmpeg audio/video extraction settings in YAML

**Bead ID:** `ee-03m` / child bead if needed
**SubAgent:** `coder`
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, implement the FFmpeg-YAML canonicalization lane so audio and video extraction/compression settings are controlled from config instead of hidden hardcoded defaults. Update validation/tests/docs and keep the change bounded to the YAML-as-source-of-truth goal. Claim the assigned bead on start and close the relevant bead when completed.`

**Folders Created/Deleted/Modified:**
- `server/`
- `configs/`
- `docs/`
- `test/`
- `.plans/`

**Files Created/Deleted/Modified:**
- `server/lib/ffmpeg-config.cjs` *(new shared FFmpeg settings/arg builder + validation helper)*
- `server/lib/config-loader.cjs`
- `server/lib/audio-chunk-extractor.cjs`
- `server/lib/video-utils.cjs`
- `server/scripts/get-context/get-dialogue.cjs`
- `server/scripts/get-context/get-music.cjs`
- `configs/*.yaml`
- `test/pipeline/config-loader.test.js`
- `test/lib/ffmpeg-config.test.js` *(new)*
- `test/scripts/get-dialogue.test.js`
- `test/scripts/get-music.test.js`
- `test/pipeline/fixtures/*.yaml`
- `docs/CONFIG-GUIDE.md`
- `.plans/2026-03-15-audit-visual-grounding-and-expose-ffmpeg-controls.md`

**Status:** ✅ Complete

**Results:**
- Added a canonical `server/lib/ffmpeg-config.cjs` helper that validates required `settings.ffmpeg` keys, exposes audio/video config accessors, and builds FFmpeg arg arrays from YAML instead of from hardcoded values.
- `server/lib/config-loader.cjs` now hard-fails when `settings.ffmpeg` or its required audio/video subkeys are missing or invalid.
- Phase 1 audio extraction paths now read FFmpeg settings from YAML:
  - `get-dialogue.cjs` and `get-music.cjs` build extraction commands from `settings.ffmpeg.audio`
  - `audio-chunk-extractor.cjs` now requires FFmpeg audio config and uses the configured container for chunk filenames
- `server/lib/video-utils.cjs` now builds both normal and aggressive compression commands from `settings.ffmpeg.video.*` instead of embedded presets/bitrates/filters.
- Updated every pipeline YAML under `configs/` plus the pipeline test fixtures to include the required `settings.ffmpeg` block, and documented the new required section in `docs/CONFIG-GUIDE.md`.
- Added focused tests for the new helper/config validation lane and updated script tests so Phase 1 coverage runs against explicit FFmpeg YAML.
- Validation run summary:
  - ✅ `node --test test/pipeline/config-loader.test.js test/lib/ffmpeg-config.test.js test/scripts/get-dialogue.test.js test/scripts/get-music.test.js test/scripts/tool-wrapper-contract.test.js`
  - ✅ repo config sweep confirmed the new FFmpeg block loads everywhere
  - ⚠️ full `validateConfig()` sweep across `configs/*.yaml` still reports four pre-existing recommendation-target validation gaps (`single-chunk-test.yaml`, `single-chunk-test-per-second.yaml`, `video-analysis.yaml`, `video-analysis-parallel.yaml`) that are unrelated to the FFmpeg lane

---

### Task 4: Implement the bounded visual-grounding fix lane

**Bead ID:** `ee-7ge`
**SubAgent:** `coder`
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, implement the bounded Phase 2 visual-grounding fix lane defined in this plan. The intended order is: (1) fix chunk slicing truthfulness and related config reads, (2) add bounded frame extraction in emotion-engine, (3) wire those frames through ../tools/emotion-lenses-tool.cjs as real multimodal image attachments, and (4) only then tighten prompt/state carry-over if needed. Keep the change bounded to trustworthy visual grounding for chunk analysis. Claim bead ee-7ge on start, update this plan with what actually changed, run focused validation, and close the bead when done.`

**Folders Created/Deleted/Modified:**
- `server/`
- `configs/`
- `test/`
- `.plans/`
- sibling repo surfaces under `../tools/`

**Files Created/Deleted/Modified:**
- `server/lib/video-chunk-extractor.cjs`
- `server/scripts/process/video-chunks.cjs`
- `server/lib/video-frame-extractor.cjs` *(new)*
- `../tools/emotion-lenses-tool.cjs`
- related tests/configs as needed
- `.plans/2026-03-15-audit-visual-grounding-and-expose-ffmpeg-controls.md`

**Status:** ✅ Complete

**Results:**
- Implemented the bounded Phase 2 visual-grounding lane for real instead of leaving it half-wired.
- `server/lib/video-chunk-extractor.cjs` now extracts truthful bounded windows via `-t <duration>` instead of an absolute `-to <end>` timestamp. Focused coverage is in `test/lib/video-chunk-extractor.test.js`, which asserts the FFmpeg args use `-t` and do not include `-to`.
- `server/lib/video-frame-extractor.cjs` is the bounded representative-frame helper used by Phase 2. `server/scripts/process/video-chunks.cjs` now emits capped JPEG frames per chunk/split into `output/.../assets/processed/frames/` and records per-frame absolute timestamps.
- `server/scripts/process/video-chunks.cjs` now wires the lane end-to-end:
  - reads max chunk size from both flat `tool_variables.maxFileSize` and nested `tool_variables.file_transfer.maxFileSize`
  - reads split settings from canonical `tool_variables.chunk_strategy.split`, with legacy fallback
  - normalizes `split_factor: 2` style config to the actual splitter ratio (`0.5`)
  - throws if an oversized chunk is encountered while split handling is disabled
  - probes split durations, maps each split back onto the parent chunk window, and uses those bounded split timestamps for dialogue/music selection and frame timestamp metadata
  - extracts representative frames for each chunk/split and stores them on `analyzeInput.videoContext.frames`
  - passes `videoContext` into `emotionLensesTool.executeEmotionAnalysisToolLoop(...)`, which is the missing hop needed for the sibling tool to attach real multimodal images
  - trims previous-summary carry-over before forwarding it into the chunk analysis input
- `../tools/emotion-lenses-tool.cjs` already had the attachment-capable prompt/tool surface in place (`buildVideoAttachments(...)`, attached-frame prompt text, and `attachments:` on both `analyze(...)` and `executeEmotionAnalysisToolLoop(...)`). Task 4's missing engine-side hop is now implemented, so that sibling path is actually exercised.
- `test/scripts/video-chunks.test.js` now verifies the real lane wiring:
  - extracted frame metadata lands in `videoContext.frames`
  - `videoContext` is passed into the validator-tool loop call so multimodal image attachments can be emitted downstream
  - oversized chunks honor flat `tool_variables.maxFileSize` plus canonical `tool_variables.chunk_strategy.split.{max_splits,split_factor}` settings, including normalization of `split_factor: 2` → `0.5`
- Focused validation runs:
  - `node --test test/lib/video-chunk-extractor.test.js test/scripts/video-chunks.test.js test/scripts/tool-wrapper-contract.test.js` ✅
  - `node --test test/emotion-lenses-tool.test.js` *(run from sibling repo `../tools` to verify the attachment-capable tool surface still passes)* ✅
- Validation outcome: bounded slice extraction, bounded frame metadata propagation, canonical split config reads, and engine→tool multimodal wiring are all covered and passing.

---

### Task 5: Clean out-of-sync sample configs blocking full validation sweep

**Bead ID:** `ee-mx5`
**SubAgent:** `coder`
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, clean up the sample configs still out of sync after the FFmpeg YAML lane so a full validateConfig sweep can pass. Start with the known recommendation-target gaps in single-chunk-test.yaml, single-chunk-test-per-second.yaml, video-analysis.yaml, and video-analysis-parallel.yaml, then verify there are no other config-schema drifts left in configs/*.yaml. Claim bead ee-mx5 on start, update this plan with what actually changed, run the config-validation sweep, and close the bead when done.`

**Folders Created/Deleted/Modified:**
- `configs/`
- `.plans/`

**Files Created/Deleted/Modified:**
- `configs/single-chunk-test.yaml`
- `configs/single-chunk-test-per-second.yaml`
- `configs/video-analysis.yaml`
- `configs/video-analysis-parallel.yaml`
- `.plans/2026-03-15-audit-visual-grounding-and-expose-ffmpeg-controls.md`

**Status:** ✅ Complete

**Results:**
- Cleaned the four known config-schema drifts by adding explicit `ai.recommendation.targets` blocks to the sample configs that still invoked `server/scripts/report/recommendation.cjs` without a recommendation target chain.
- Exact file-level changes:
  - `configs/single-chunk-test.yaml` - added `ai.recommendation.targets[0]` with `openrouter / openai/gpt-5.4`
  - `configs/single-chunk-test-per-second.yaml` - added `ai.recommendation.targets[0]` with `openrouter / openai/gpt-5.4`
  - `configs/video-analysis.yaml` - added `ai.recommendation.targets[0]` with `openrouter / openai/gpt-5.4`
  - `configs/video-analysis-parallel.yaml` - added `ai.recommendation.targets[0]` with `openrouter / openai/gpt-5.4`
- No related test fixtures or docs needed updates for this lane; the drift was isolated to those four runnable sample configs.
- Full validation sweep results after the cleanup:
  - `npm run validate-configs` ✅ - all 19 YAML files parsed successfully
  - `for f in configs/*.yaml; do node server/run-pipeline.cjs --config "$f" --dry-run; done` ✅ - every config under `configs/*.yaml` now passes loader/schema validation in dry-run mode
- Outcome: there are no remaining config-schema validation drifts under `configs/*.yaml` after this cleanup sweep.

---

### Task 6: Run a targeted revalidation after grounding + config cleanup

**Bead ID:** `ee-04n`
**SubAgent:** `primary`
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, after the grounding fix lane, FFmpeg-YAML lane, and config-cleanup lane are implemented, run the smallest truthful validation that can show whether chunk-level persona grounding improved. Compare the new chunk outputs against the recent cod-test artifact set and call out whether the persona now references specific visual evidence instead of recycled generic labels. Claim the assigned bead on start and close it on completion.`

**Folders Created/Deleted/Modified:**
- `output/`
- `.plans/`

**Files Created/Deleted/Modified:**
- `.plans/2026-03-15-audit-visual-grounding-and-expose-ffmpeg-controls.md`
- fresh validation artifacts

**Status:** ✅ Complete - canonical Base64 video-chunk rerun executed and documented; evidence shows transport is video, not frames, and late-window grounding materially improved

**Results:**
- Ran the smallest truthful late-window revalidation I could without broadening back into implementation: clipped the suspicious late COD window, ran the real pipeline against that fresh clip with a fresh output dir, then compared the new raw chunk outputs against the old `output/cod-test` late-chunk baseline.
- **Exact commands run:**
  - `bd update ee-04n --status in_progress --json`
  - `mkdir -p output/validation-fixtures && ffmpeg -y -ss 70 -i examples/videos/emotion-tests/cod.mp4 -t 20 -c copy output/validation-fixtures/cod-late-70-90.mp4`
  - `node server/run-pipeline.cjs --config configs/cod-late-window-grounding-check.yaml --verbose`
  - `find output/cod-late-window-grounding-check -maxdepth 5 -type f | sort | sed -n '1,240p'`
  - `for f in output/cod-late-window-grounding-check/phase2-process/raw/ffmpeg/*.json; do echo '---' $f; sed -n '1,220p' "$f"; done`
  - `node - <<'NODE' ... read output/cod-test/phase2-process/chunk-analysis.json for chunks 14,15,16,17 ... NODE`
  - `find output/cod-late-window-grounding-check/phase2-process/raw/ai -type f | sort`
  - `for f in $(find output/cod-late-window-grounding-check/phase2-process/raw/ai -type f | sort | grep capture.json); do echo '---' $f; sed -n '1,260p' "$f"; done`
  - `for f in output/cod-late-window-grounding-check/_meta/ai/_prompts/*.json; do echo '---' $f; sed -n '1,220p' "$f"; done`
  - `find output/cod-late-window-grounding-check/assets/processed/frames -type f | sort | sed -n '1,200p'`
  - `grep -RIn "image_url\|data:image\|chunk_000_split_00_frame_00\|Attached frames" output/cod-late-window-grounding-check/phase2-process/raw/ai output/cod-late-window-grounding-check/_meta/ai | sed -n '1,200p'`
  - `sed -n '1,220p' output/cod-late-window-grounding-check/phase2-process/script-results/video-chunks.failure.json`
- **Fresh artifacts generated/inspected:**
  - temp config: `configs/cod-late-window-grounding-check.yaml`
  - validation clip: `output/validation-fixtures/cod-late-70-90.mp4`
  - rerun output root: `output/cod-late-window-grounding-check/`
  - extracted chunks: `output/cod-late-window-grounding-check/assets/processed/chunks/chunk_000.mp4` through `chunk_003.mp4`
  - extracted frames proving late-window frame flow: `output/cod-late-window-grounding-check/assets/processed/frames/chunk-0000/split-00/*.jpg`, `chunk-0001/split-00/*.jpg`, `chunk-0002/split-00/*.jpg`, partial `chunk-0003/split-00/*.jpg`
  - raw FFmpeg evidence: `output/cod-late-window-grounding-check/phase2-process/raw/ffmpeg/extract-chunk-*.json`, `extract-frames-*.json`, `split-duration-*.json`
  - raw model captures: `output/cod-late-window-grounding-check/phase2-process/raw/ai/chunk-000{0,1,2}/split-00/attempt-01/capture.json`
  - prompt artifacts: `output/cod-late-window-grounding-check/_meta/ai/_prompts/46a6b50d6289d1dfc1eed09195d2af1adccae8e061d4cd6f7edd4cf83f792c4c.json`, `a2a56cbf712bb6995abe2dee13ac3e2f549ca11a14349bb2f681e84b8176c8e7.json`, `b35800c4dfb1a701fe1b4090cedb0c7bd64abb225c48821e583b206c570fbf13.json`
  - baseline comparison source: `output/cod-test/phase2-process/chunk-analysis.json`
  - pipeline failure contract: `output/cod-late-window-grounding-check/phase2-process/script-results/video-chunks.failure.json`
- **What changed versus the suspicious baseline:**
  - The old late `cod-test` baseline (`chunkIndex` 14-17 at 70s-90s) repeatedly hallucinated generic labels like `generic intro vibes`, `corporate intro`, and `slow visual buildup`.
  - In the new rerun, the repeated `corporate/generic intro` language **did drop out** for the first three rerun chunks. However, that did **not** turn into good visual grounding. The raw outputs instead said things like `visual frames are unavailable for verification`, `visual ambiguity limits full engagement verification`, and `visuals don't confirm value`.
  - That means the failure mode changed from **confident wrong generic labeling** to **explicitly not grounding on visuals**, which is better honesty but not yet the desired outcome.
- **Evidence that frames are actually flowing through the lane:**
  - The rerun created real representative JPEGs on disk for the late-window chunks. I manually inspected sample frames from the artifact set and they show concrete, specific COD visuals (for example: armed soldiers with muzzle-flash/sparks in an urban firefight; a first-person rifle view over enemies near a creek; and an `ALASKA` title card over a snowy scene with aurora).
  - The prompt text for rerun chunks now explicitly includes `Attached frames: 3 image(s)` with per-frame timestamps, which was absent from the original suspicious text-only baseline.
  - So the engine-side frame extraction/prompt-labelling lane is now active.
- **Remaining blocker / caveat surfaced by this validation:**
  - Despite the concrete frame artifacts and prompt text mentioning attached frames, the model output for chunks 0-2 still behaved as if the visuals were unavailable or too ambiguous to use. That suggests a remaining multimodal handoff/provider-consumption problem somewhere between prompt assembly and what the model actually consumes.
  - The focused rerun also hit a bounded FFmpeg/frame edge-case on the fourth 5s chunk (`15s-20s` within the clipped sample): `output/cod-late-window-grounding-check/phase2-process/raw/ffmpeg/extract-frames-3-0.json` shows `offsetSeconds: 4.999` on a `5.020s` chunk producing `Output file is empty, nothing was encoded`, and the pipeline stopped with `VIDEO_FRAME_OUTPUT_NOT_CREATED`. This is a validation caveat, but not the main grounding finding because the first three late chunks already proved the more important issue above.
- **Verdict:** partial improvement only. Late-chunk outputs are no longer recycling the old `generic corporate intro` hallucination pattern, and frames are now being extracted and referenced in prompt context, but chunk-level persona grounding is **not yet materially fixed** because the model still is not turning those concrete visuals into concrete visual evidence in its outputs.
- **Bead state:** leaving `ee-04n` open because the task exposed a blocker instead of a clean validation win.
- **Next best step:** inspect the exact provider request payload at the OpenRouter/multimodal boundary for one rerun chunk and prove whether the image attachments are actually present in the transport, in the shape the provider expects, and associated with the same prompt turn as the chunk-analysis instruction. Once that is verified/fixed, rerun this same late-window validation fixture instead of a full cod-test rerun first.

**Canonical video-chunk rerun after Task 7 (2026-03-16):**
- After Task 7 removed the frame/image diagnostic path and restored the canonical Base64 video-chunk contract, I reran the same focused late-window fixture end-to-end against the real OpenRouter provider lane.
- **Exact commands run:**
  - `bd update ee-04n --status in_progress --json`
  - `ls -l output/validation-fixtures/cod-late-70-90.mp4`
  - `ffprobe -v error -show_entries format=duration,size -of json output/validation-fixtures/cod-late-70-90.mp4`
  - `node server/run-pipeline.cjs --config configs/cod-late-window-grounding-check.yaml --verbose | tee /tmp/ee-04n-late-window-rerun-20260316.log`
  - `find output/cod-late-window-grounding-check -maxdepth 6 -type f | sort | sed -n '1,260p'`
  - `grep -RIna "video_url\|data:video\|video/mp4\|Attached video chunk\|Attached frames" output/cod-late-window-grounding-check | sed -n '1,260p'`
  - `node - <<'NODE' ... rebuild OpenRouter request payloads from the captured prompt refs + actual chunk files and write output/cod-late-window-grounding-check/phase2-process/provider-payload-proof.json ... NODE`
  - `node - <<'NODE' ... compare output/cod-test/phase2-process/chunk-analysis.json chunks 14-17 against output/cod-late-window-grounding-check/phase2-process/chunk-analysis.json chunks 0-4 ... NODE`
- **Artifacts generated/inspected for the canonical rerun:**
  - live rerun log: `/tmp/ee-04n-late-window-rerun-20260316.log`
  - focused config: `configs/cod-late-window-grounding-check.yaml`
  - fixture clip: `output/validation-fixtures/cod-late-70-90.mp4`
  - rerun root: `output/cod-late-window-grounding-check/`
  - chunk outputs: `output/cod-late-window-grounding-check/phase2-process/chunk-analysis.json`
  - raw captures: `output/cod-late-window-grounding-check/phase2-process/raw/ai/chunk-0000/split-00/attempt-01/capture.json` through `chunk-0004/.../capture.json`
  - prompt refs used by the live rerun: `_meta/ai/_prompts/43d753b4d56f86a2e1b98b6262cd0d110f7195f9fdaa96e63a4093f583a93b6a.json`, `8e4347c5dce1e3311e6f552872b35355dee3abd19706219e021c6d50dd33ef09.json`, `02fcd1ffa773c6266bb96bcf95b62574005a80e0c63f61140fa2b972c7d50ab1.json`, `0a980c06e5e016aea94702b2ae817d7dfb953b26a1a93c097eec1dead130bd75.json`, `eb7b5a9ffd76d620b82cb11fea1ae2ade7632bc94da250d8beabb7aa17d1c714.json`
  - provider payload proof artifact: `output/cod-late-window-grounding-check/phase2-process/provider-payload-proof.json`
  - comparison baseline: `output/cod-test/phase2-process/chunk-analysis.json`
- **Payload evidence:**
  - The prompt refs actually used by the rerun say `Attached video chunk: video/mp4 (base64)` and do **not** say `Attached frames: 3 image(s)`.
  - `server/scripts/process/video-chunks.cjs` now passes `videoContext = { chunkPath, transferStrategy: 'base64', mimeType: 'video/mp4', ... }` into the emotion tool.
  - `../tools/emotion-lenses-tool.cjs` reads `videoContext.chunkPath`, Base64-encodes the chunk, and returns `[{ type: 'video', data: '<base64>', mimeType: 'video/mp4' }]`.
  - `node_modules/ai-providers/providers/openrouter.cjs` serializes that attachment as `{ type: 'video_url', video_url: { url: 'data:video/mp4;base64,...' } }`.
  - The generated proof artifact confirms that for every live rerun chunk the rebuilt provider request contained exactly **one** `video_url` part, **zero** `image_url` parts, and a real `data:video/mp4;base64,...` prefix. Example from the proof file:
    - chunk 1 (`5s-10s`): `attachmentType: "video"`, `attachmentBase64Chars: 3856956`, `requestVideoParts: 1`, `requestImageParts: 0`, `requestVideoUrlPrefix: "data:video/mp4;base64,AAAAIGZ0eX"`
- **Comparison against prior suspicious baseline and failed frame-path rerun:**
  - Old suspicious baseline (`output/cod-test/phase2-process/chunk-analysis.json`, chunks 14-17 / 70s-90s) repeatedly claimed `generic intro vibes`, `corporate intro`, `slow visual buildup`, with boredom 8-9 and excitement 2-3.
  - Failed frame-path diagnostic rerun removed those hallucinated labels but still produced hedged outputs like `visual frames are unavailable for verification` and `visual ambiguity limits full engagement verification`, which proved the frame path was not giving the model dependable semantic grounding.
  - The new canonical video rerun is qualitatively different: it names concrete late-window content such as `ANGOLA`, `FPS gameplay`, `neon Tokyo`, `rooftop parkour`, `ALASKA`, `drone`, `explosions`, and `muzzle flashes`, and it assigns high excitement / low boredom in line with that visible action.
- **Transport vs semantic-grounding verdict:**
  - **Transport:** confirmed. The canonical request path carries Base64 video data to the provider boundary; this is no longer an image/frame substitution lane.
  - **Semantic grounding:** materially improved. The outputs now reference chunk-specific late-window visual content instead of either (a) the old generic-hallucination pattern or (b) the frame-path `visuals unavailable/ambiguous` hedge language.
- **Is the old late-chunk generic hallucination pattern resolved?**
  - Yes for this focused rerun. The late-window outputs no longer collapse into the prior `generic/corporate intro` boredom pattern and instead track specific COD scene content from the attached video chunks.
- **Verdict:** sufficient focused revalidation completed. This does **not** prove perfect multimodal grounding for every future asset, but it does prove that after restoring the canonical Base64 video-chunk path, this late-window validation lane now shows both the correct transport shape and materially better video-grounded semantics.
- **Bead state:** safe to close `ee-04n` after recording this update.

---

### Task 7: Remove frame-based diagnostics from video chunks and restore the canonical Base64 video review path

**Bead ID:** `ee-mfb`
**SubAgent:** `coder`
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, remove the frame-extraction / image-attachment diagnostic path from the video-chunk review system and restore focus to the canonical persona-review contract: the AI model should receive the Base64 video chunk payload itself, not screenshot-derived alternate context. Audit the exact engine → tool → provider payload shape for video attachments, identify the regression versus the previously working path, implement the fix, update this plan with exact file-level results, and validate that the model is consuming video-chunk review data rather than image-derived substitutions. Claim the assigned bead on start and close it on completion.`

**Folders Created/Deleted/Modified:**
- `server/`
- `test/`
- `.plans/`
- sibling repo surfaces under `../tools/`
- potentially sibling provider surfaces if the regression is below the tool boundary

**Files Created/Deleted/Modified:**
- `server/scripts/process/video-chunks.cjs`
- `server/lib/video-frame-extractor.cjs` *(deleted; no longer used by video chunks)*
- `test/lib/video-frame-extractor.test.js` *(deleted with runtime removal)*
- `test/scripts/video-chunks.test.js`
- `test/scripts/emotion-lenses-tool.test.js`
- `../tools/emotion-lenses-tool.cjs`
- `../tools/test/emotion-lenses-tool.test.js`
- `.plans/2026-03-15-audit-visual-grounding-and-expose-ffmpeg-controls.md`

**Status:** ✅ Complete

**Results:**
- Removed the entire frame-extraction / image-attachment branch from `server/scripts/process/video-chunks.cjs`.
  - deleted the `video-frame-extractor` dependency and all `framesDir` / frame-cleanup logic
  - deleted the runtime frame metadata handoff (`videoContext.frames`)
  - replaced it with the canonical transport metadata on `videoContext`: `chunkPath`, `mimeType`, and `transferStrategy`
- Deleted the now-unused frame helper and its unit test:
  - `server/lib/video-frame-extractor.cjs`
  - `test/lib/video-frame-extractor.test.js`
- Restored the canonical persona-review contract in `../tools/emotion-lenses-tool.cjs`.
  - `buildVideoAttachments(videoContext)` now builds a single **video** attachment, not image attachments
  - when `videoContext.chunkPath` is present, the tool reads the chunk file and emits `{ type: 'video', data: '<base64>', mimeType }`
  - prompt text now explicitly says to ground judgment in the attached **video chunk**, not frames
- Exact engine → tool → provider payload shape audited for the fixed path:
  1. **Engine (`server/scripts/process/video-chunks.cjs`)** passes `videoContext = { chunkPath, chunkIndex, splitIndex, startTime, endTime, duration, transferStrategy: 'base64', mimeType: 'video/mp4' }`
  2. **Tool (`../tools/emotion-lenses-tool.cjs`)** converts that into `attachments = [{ type: 'video', data: '<base64>', mimeType: 'video/mp4' }]`
  3. **Provider boundary (`ai-providers`)** consumes that attachment as:
     - OpenRouter: `messages[0].content[*] = { type: 'video_url', video_url: { url: 'data:video/mp4;base64,...' } }`
     - Gemini: `contents[0].parts[*] = { inline_data: { mime_type: 'video/mp4', data: '<base64>' } }`
- Regression found and fixed:
  - the frame-diagnostics lane had replaced the canonical chunk payload with screenshot-derived image attachments
  - additionally, the OpenRouter provider serializer only forwards `attachment.data` / `attachment.url` for video attachments, not `attachment.path`; so a raw local `chunkPath` alone would not reliably survive the provider boundary
  - fixing the tool to emit explicit Base64 video data restored the canonical transport shape and avoided the `path` drop at the provider boundary
- Validation proving persona review now consumes video-chunk review data rather than frame substitutions:
  - `node --test test/scripts/video-chunks.test.js test/scripts/emotion-lenses-tool.test.js` → **43 passing, 0 failing**
    - asserts `videoContext.chunkPath`, `videoContext.mimeType`, and `videoContext.transferStrategy`
    - asserts `videoContext.frames` is no longer present
    - asserts the emotion tool receives and forwards a single `video` attachment with Base64 `data`
  - `cd ../tools && node --test test/emotion-lenses-tool.test.js` → **25 passing, 0 failing**
    - asserts prompt wording references the attached video chunk
    - asserts tool-loop/provider calls receive `attachments[0] = { type: 'video', mimeType: 'video/mp4', data: <base64> }`
- Bead outcome: safe to close once this plan update is recorded, because the frame path is removed and the canonical Base64 video-chunk path is fixed and validated.

---

### Task 8: Add explicit higher-quality MP3 audio extraction controls and update cod-test

**Bead ID:** `ee-ojw`
**SubAgent:** `coder`
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, extend the FFmpeg audio config so cod-test can request higher-quality MP3 extraction for dialogue and music context. Add the missing audio-quality control cleanly in the canonical FFmpeg config/helper path, update configs/cod-test.yaml to use the intended higher-quality MP3 settings, update tests/docs as needed, and validate the lane. Claim the assigned bead on start and close it on completion.`

**Folders Created/Deleted/Modified:**
- `server/`
- `configs/`
- `docs/`
- `test/`
- `.plans/`

**Files Created/Deleted/Modified:**
- `server/lib/ffmpeg-config.cjs`
- `server/scripts/get-context/get-dialogue.cjs`
- `server/scripts/get-context/get-music.cjs`
- `configs/cod-test.yaml`
- `docs/CONFIG-GUIDE.md`
- `test/lib/ffmpeg-config.test.js`
- `test/scripts/get-dialogue.test.js`
- `test/scripts/get-music.test.js`
- `.plans/2026-03-15-audit-visual-grounding-and-expose-ffmpeg-controls.md`

**Status:** ✅ Complete

**Results:**
- Added an explicit canonical FFmpeg audio quality knob in `server/lib/ffmpeg-config.cjs`: `settings.ffmpeg.audio.bitrate` now flows into audio extraction args as `-b:a <bitrate>` when set.
- Kept the change bounded to the audio-config lane by making bitrate optional for lossless extraction but **required for MP3** (`codec: libmp3lame`, `container: mp3`) so lossy quality is never left to FFmpeg defaults.
- Added `getAudioMimeType(...)` alongside the existing output-extension helper so Phase 1 attachment calls stay correct when the extracted audio format is no longer WAV.
- Updated the Phase 1 audio call sites:
  - `server/scripts/get-context/get-dialogue.cjs` now derives attachment MIME type from the configured FFmpeg audio container and therefore sends `audio/mpeg` when MP3 extraction is configured.
  - `server/scripts/get-context/get-music.cjs` now does the same for its chunk-analysis attachment path.
- Updated `configs/cod-test.yaml` to use an explicit higher-quality MP3 extraction profile for dialogue/music context:
  - `codec: libmp3lame`
  - `bitrate: 192k`
  - `sample_rate_hz: 44100`
  - `channels: 2`
  - `container: mp3`
- Added focused coverage proving the lane works:
  - `test/lib/ffmpeg-config.test.js` now covers explicit MP3 bitrate args, MIME detection, and validation failure when MP3 bitrate is omitted.
  - `test/scripts/get-dialogue.test.js` now verifies MP3 extraction produces `audio.mp3` and sends `audio/mpeg` attachments.
  - `test/scripts/get-music.test.js` now verifies MP3 extraction produces `audio.mp3` / `chunk_000.mp3` and sends `audio/mpeg` attachments.
- Updated `docs/CONFIG-GUIDE.md` so the canonical FFmpeg section documents `settings.ffmpeg.audio.bitrate` and the fact that MP3 extraction requires it.
- Validation commands/results:
  - `node --test test/lib/ffmpeg-config.test.js test/scripts/get-dialogue.test.js test/scripts/get-music.test.js` ✅ (45 passing / 0 failing)
  - `npm run validate-configs` ✅ (all 20 YAML configs parsed successfully)
  - `node server/run-pipeline.cjs --config configs/cod-test.yaml --dry-run` ✅ (config validates with the new cod-test MP3 settings)
- Follow-up note for Task 9 / the full rerun lane: the next full `cod-test` rerun should now emit MP3 Phase 1 processed audio artifacts (`audio.mp3`, `chunk_*.mp3`) and send `audio/mpeg` attachments to the dialogue/music providers, so if the full rerun shows regressions they are likely provider/model-behavior issues rather than hidden FFmpeg default-quality drift.

---

### Task 9: Run full cod-test rerun and evaluate output after canonical video restore

**Bead ID:** `ee-0rf`
**SubAgent:** `primary`
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, after the canonical Base64 video path restore and the cod-test audio-quality update are in place, run a full cod-test rerun and evaluate the output. Compare the resulting artifacts against the prior suspicious baseline and the focused late-window verification to determine whether the fix now holds end-to-end. Claim the assigned bead on start and close it on completion.`

**Folders Created/Deleted/Modified:**
- `output/`
- `.plans/`

**Files Created/Deleted/Modified:**
- `.plans/2026-03-15-audit-visual-grounding-and-expose-ffmpeg-controls.md`
- fresh cod-test rerun artifacts

**Status:** ✅ Complete - full `cod-test` rerun completed cleanly end-to-end; Phase 2 and Phase 3 regenerated fresh truthful outputs and the bead can close

**Results:**
- Claimed bead and reran the full pipeline from the owning repo with the current `configs/cod-test.yaml`:
  - `bd update ee-0rf --status in_progress --json`
  - `TS=$(date +%Y%m%d-%H%M%S)`
  - `cp -a output/cod-test output/cod-test-baseline-pre-rerun-$TS`
  - `node server/run-pipeline.cjs --config configs/cod-test.yaml --verbose | tee /tmp/ee-0rf-cod-test-full-rerun-$TS.log`
- Follow-up verification / comparison commands actually used:
  - `stat -c '%y %n' output/cod-test/phase2-process/chunk-analysis.json output/cod-test/phase3-report/summary/FINAL-REPORT.md output/cod-test/phase2-process/raw/ai/chunk-0021/split-00/attempt-01/capture.json /tmp/ee-0rf-cod-test-full-rerun-20260316-154711.log output/cod-test-baseline-pre-rerun-20260316-154711/phase2-process/chunk-analysis.json output/cod-test-baseline-pre-rerun-20260316-154711/phase3-report/summary/FINAL-REPORT.md`
  - `sha256sum output/cod-test/phase2-process/chunk-analysis.json output/cod-test/phase3-report/summary/FINAL-REPORT.md output/cod-test-baseline-pre-rerun-20260316-154711/phase2-process/chunk-analysis.json output/cod-test-baseline-pre-rerun-20260316-154711/phase3-report/summary/FINAL-REPORT.md`
  - `sed -n '1,220p' output/cod-test/phase2-process/raw/_meta/errors.summary.json`
  - `sed -n '1,220p' output/cod-test/phase2-process/provider-abort-audit.json`
  - `sed -n '1,260p' output/cod-test/phase2-process/raw/ai/chunk-0006/split-00/attempt-01/capture.json`
  - `sed -n '1,260p' output/cod-test/phase2-process/raw/ai/chunk-0006/split-00/attempt-02/capture.json`
  - `sed -n '1,260p' output/cod-test/phase2-process/raw/ai/chunk-0021/split-00/attempt-01/capture.json`
  - `grep -RIna "Attached video chunk\|Attached frames" output/cod-test/_meta/ai/_prompts | sed -n '1,40p'`
  - `node - <<'NODE' ... compare output/cod-test-baseline-pre-rerun-20260316-154711/phase2-process/chunk-analysis.json chunks 14-17 vs output/cod-test/phase2-process/chunk-analysis.json chunks 14-17 vs output/cod-late-window-grounding-check/phase2-process/chunk-analysis.json chunks 0-3 ... NODE`
  - `sed -n '1,220p' output/cod-test/phase3-report/summary/FINAL-REPORT.md`
- Key artifacts from this successful rerun:
  - preserved suspicious baseline: `output/cod-test-baseline-pre-rerun-20260316-154711/`
  - live rerun log: `/tmp/ee-0rf-cod-test-full-rerun-20260316-154711.log`
  - fresh aggregate artifact: `output/cod-test/phase2-process/chunk-analysis.json`
  - fresh Phase 2 health evidence: `output/cod-test/phase2-process/raw/_meta/errors.summary.json`
  - provider-shape / late-window audit evidence: `output/cod-test/phase2-process/provider-abort-audit.json`
  - chunk retry evidence: `output/cod-test/phase2-process/raw/ai/chunk-0006/split-00/attempt-01/capture.json`, `output/cod-test/phase2-process/raw/ai/chunk-0006/split-00/attempt-02/capture.json`
  - former blocker chunk capture: `output/cod-test/phase2-process/raw/ai/chunk-0021/split-00/attempt-01/capture.json`
  - fresh final report: `output/cod-test/phase3-report/summary/FINAL-REPORT.md`
  - focused late-window reference: `output/cod-late-window-grounding-check/phase2-process/chunk-analysis.json`
  - focused provider-shape proof reference: `output/cod-late-window-grounding-check/phase2-process/provider-payload-proof.json`
- **What happened in the rerun:**
  - Phase 1 completed normally.
  - Phase 2 completed successfully across 28 analyzed chunks; `output/cod-test/phase2-process/raw/_meta/errors.summary.json` now reports `outcome: "success"` and `totalErrors: 0`.
  - Phase 3 completed successfully and wrote a new `output/cod-test/phase3-report/summary/FINAL-REPORT.md` at `2026-03-16 16:34:42 -0400`.
- **Former chunk-21 abort no longer halts the run, and retry/failover behavior is now healthy enough for acceptance:**
  - The prior blocker chunk (index 21 / `105s-110s`) completed successfully on the canonical lane: `output/cod-test/phase2-process/raw/ai/chunk-0021/split-00/attempt-01/capture.json` has `error: null` and a prompt ref into the fresh rerun prompt set.
  - The rerun also exercised the bounded retry path earlier in Phase 2: chunk 6 (`30s-35s`) produced both `attempt-01` and `attempt-02` artifacts. Attempt 1 is classified `retryable` with `Exceeded validate_emotion_analysis_json tool-call limit before emotion analysis could be validated.`, and attempt 2 on the same target succeeded. That is concrete evidence that retryable provider/tool-loop failures now retry instead of halting the run.
  - Net acceptance result: the former chunk-21 stop no longer halts full `cod-test`, and retryable failures are no longer terminal for the run.
- **Canonical video transport evidence stayed correct in the full rerun:**
  - The fresh prompt artifacts still say `Attached video chunk: video/mp4 (base64)`.
  - `grep` across the fresh prompt set found no `Attached frames` entries for this live cod-test rerun.
  - `output/cod-test/phase2-process/provider-abort-audit.json` records `contentTypes: ["text", "video_url"]` for the audited late-window requests including chunk 21.
  - So the rerun stayed on the canonical Base64 video-chunk lane; no frame/image-derived context was reintroduced.
- **Late-window semantic grounding remained materially improved relative to the suspicious baseline and stayed aligned with the focused verification:**
  - Chunk 14 (`70s-75s`)
    - old baseline: `Generic intro vibes detected immediately; energetic music clashes with slow visual buildup.`
    - full rerun: `Intense urban firefight transitions into a surreal floating island landscape with location text.`
    - focused late-window rerun: `Intense urban combat sequence transitions rapidly into a scenic map reveal labeled ANGOLA, maintaining high energy throughout.`
  - Chunk 15 (`75s-80s`)
    - old baseline: `Generic intro vibes detected immediately; energetic music clashes with slow visual buildup, triggering instant scroll risk for an impatient viewer.`
    - full rerun: `Fast-paced jungle combat shifts to FPS gameplay then reveals a futuristic aircraft over Tokyo. The high-energy visuals match the intense music track.`
    - focused late-window rerun: `Fast-paced jungle combat shifts to FPS gameplay and a futuristic vehicle drop, culminating in a neon Tokyo reveal.`
  - Chunk 16 (`80s-85s`)
    - old baseline: `Generic intro vibes with energetic music clashing against slow visual buildup triggers immediate scroll risk for impatient viewer.`
    - full rerun: `Futuristic rooftop combat transitions into aerial naval strikes before cutting to a serene Alaska location reveal.`
    - focused late-window rerun: `Rapid montage of neon rooftop parkour, futuristic aircraft combat, and a snowy cabin reveal with a countdown number.`
  - Chunk 17 (`85s-90s`)
    - old baseline: `Energetic music tries to hype up generic, slow-moving visuals that feel like a corporate intro.`
    - full rerun: `The chunk opens with a bold 'ALASKA' title card over a snowy aurora landscape, immediately cutting to tactical soldiers engaging in heavy combat with explosions and helicopter support.`
    - focused late-window rerun: `Snowy Alaska setting with 'ALASKA' text overlay, transitioning quickly to a soldier looking up at a drone, then immediate combat with explosions and muzzle flashes.`
  - These are clearly consistent with the earlier focused canonical-video verification and clearly diverge from the old `generic/corporate intro` hallucination pattern.
- **Truthful regeneration check for the two must-have artifacts:**
  - `output/cod-test/phase2-process/chunk-analysis.json`
    - fresh timestamp: `2026-03-16 16:34:13 -0400`
    - fresh hash: `732b765d5d331ebc1dd13e32f8aeb8b3c54afbe4104d73d3a1481bb508be602e`
    - old baseline hash: `e40ad23b910f2f0d4a3d6c61e53077349c3a51ab65d4d70b416f7fdb7ca53ac2`
    - chunk count changed from 29 → 28 because the terminal sub-1s tail chunk is now correctly skipped
    - **verdict:** truthfully regenerated, not stale
  - `output/cod-test/phase3-report/summary/FINAL-REPORT.md`
    - fresh timestamp: `2026-03-16 16:34:42 -0400`
    - fresh hash: `29b02906fea62c102b98a62461b46f6c65016d19e4dbb0771e9838fc76d083e2`
    - old baseline hash: `53ff5e8315b1c303ecaa523a603df08f30028b3c20dfeeaba33d57ebf676866e`
    - new report content materially changed to reflect the improved run (for example: `Chunks Analyzed: 28`, `Total Tokens Used: 323,717`, and a recommendation centered on the weak opening rather than the old false claim that only the opening works and the rest collapses into generic filler)
    - **verdict:** truthfully regenerated, not stale
- **Final Task 9 verdict:**
  - The former terminal micro-chunk blocker is gone.
  - The former chunk-21 rerun blocker no longer halts the run.
  - The canonical Base64 video-chunk path remains intact.
  - Full `cod-test` now completes cleanly through Phase 2 and Phase 3.
  - `chunk-analysis.json` and `FINAL-REPORT.md` were both regenerated truthfully and differ from the suspicious baseline for good reason.
  - Task 9 is now complete and bead `ee-0rf` can close.

---

## Intended execution order

1. Task 1 - audit the visual-grounding path
2. Task 2 - define the bounded fix lane from evidence
3. Task 3 - expose FFmpeg controls in YAML
4. Task 4 - implement the bounded visual-grounding fix lane *(now considered a diagnostic dead-end for video chunks, not the canonical fix)*
5. Task 5 - clean out-of-sync sample configs and complete the validation sweep
6. Task 6 - run a focused revalidation and compare outputs *(proved the frame path is not the canonical solution, then verified the canonical video path)*
7. Task 7 - remove frame-based diagnostics from video chunks and restore canonical Base64 video-chunk review
8. Task 8 - add explicit higher-quality MP3 audio extraction controls and update cod-test
9. Task 9 - run full cod-test rerun and evaluate output end-to-end
10. Task 10 - fix terminal micro-chunk handling before provider submission

Task 2 depends on Task 1. Task 4 builds on Tasks 1-3 but is now treated as diagnostic-only history. Task 5 follows Task 3 and leaves config validation clean. Task 6 documented why the frame path is insufficient, then later verified the restored canonical video path. Task 7 restored the canonical Base64 video-chunk contract. Task 8 now updates cod-test's audio-extraction quality path cleanly. Task 9 depends on Tasks 7 and 8. Task 10 now unblocks truthful end-to-end completion by preventing near-zero tail chunks from being sent as standalone provider reviews.

---

### Task 10: Fix terminal micro-chunk handling before provider submission

**Bead ID:** `ee-ncj`
**SubAgent:** `coder`
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, fix terminal micro-chunk handling in the Phase 2 video-chunk lane so near-zero tail windows are not sent to providers as standalone video reviews. Decide and implement the safest bounded policy (skip, merge into prior chunk, or clamp below-threshold tails before provider submission), update tests/docs/plan, and validate with cod-test-oriented coverage. Claim the assigned bead on start and close it on completion.`

**Folders Created/Deleted/Modified:**
- `server/`
- `test/`
- `.plans/`

**Files Created/Deleted/Modified:**
- `server/scripts/process/video-chunks.cjs`
- `test/scripts/video-chunks.test.js`
- `.plans/2026-03-15-audit-visual-grounding-and-expose-ffmpeg-controls.md`

**Status:** ✅ Complete

**Results:**
- Implemented the bounded terminal micro-chunk policy directly in `server/scripts/process/video-chunks.cjs` at the provider-facing split lane, not in prompts or provider adapters.
- Added a small lane-local helper and constant:
  - `TERMINAL_MICRO_CHUNK_SKIP_SECONDS = 1`
  - `shouldSkipTerminalProviderChunk(...)`
- Policy now enforced:
  - only when the unit is the **final provider-facing chunk/split** of the Phase 2 run
  - only when its computed provider-facing duration is **strictly less than 1 second**
  - exact-1.0s final chunks are still analyzed normally
  - non-terminal chunks are unaffected
- The skip happens before dialogue/music selection and before the provider/tool-loop call, so the near-zero tail window is never submitted as a standalone review chunk.
- This keeps the fix truthful and bounded:
  - no frame/image path was reintroduced
  - normal chunks still go through the canonical Base64 video-chunk review contract unchanged
  - only the terminal `<1s` micro-tail is omitted from provider submission/results aggregation
- Updated `test/scripts/video-chunks.test.js` with focused cod-test-oriented coverage:
  - `skips a final provider-facing video chunk shorter than 1 second`
  - `keeps a final provider-facing video chunk that is exactly 1 second long`
- Focused validation run:
  - `node --test test/scripts/video-chunks.test.js` ✅
  - Result: **31 passing, 0 failing**
- This validation proves the new policy works at the real Phase 2 lane seam used by cod-test: a `15.5s + 0.5s` terminal boundary yields only one analyzed chunk, while a `15s + 1s` terminal boundary still yields two analyzed chunks.
- Note before rerunning full `cod-test`: the bounded test coverage is green, but I did **not** rerun the full end-to-end cod-test inside this bead. The next truthful step is to rerun full `cod-test` so `phase2-process/chunk-analysis.json` and Phase 3 report artifacts can be regenerated cleanly past the former tail-chunk failure.

---

### Task 11: Audit chunk 21 OpenRouter abort and define bounded fix

**Bead ID:** `ee-5zx`
**SubAgent:** `coder`
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, investigate the normal 5s cod-test chunk failure at 105s-110s (chunk index 21 / provider abort). Inspect the exact failure contract and request payload characteristics, compare the failing chunk with nearby successful chunks, determine whether the cause is payload-size, provider instability, request-shape, or retry/budget handling, and define the safest bounded mitigation before the next full cod-test rerun. Claim the assigned bead on start and close it on completion.`

**Folders Created/Deleted/Modified:**
- `output/`
- `.plans/`
- code/tests only if needed for the audit deliverable

**Files Created/Deleted/Modified:**
- `.plans/2026-03-15-audit-visual-grounding-and-expose-ffmpeg-controls.md`
- optional focused audit helpers/notes if needed

**Status:** ✅ Complete

**Results:**
- Audited the chunk 21 (`105.0s-110.0s`) failure contract directly from the fresh full rerun artifacts and compared it against adjacent successful chunks 19-20.
- **Exact commands run:**
  - `bd update ee-5zx --status in_progress --json`
  - `find output/cod-test -maxdepth 5 \( -type f -o -type d \) | sed -n '1,260p'`
  - `find output/cod-test/phase2-process/raw/ai -maxdepth 5 -type f | sort | tail -n 80`
  - `sed -n '720,860p' server/scripts/process/video-chunks.cjs`
  - `sed -n '860,1040p' server/scripts/process/video-chunks.cjs`
  - `sed -n '96,190p' server/lib/ai-targets.cjs`
  - `sed -n '300,345p' server/lib/ai-targets.cjs`
  - `sed -n '1,220p' node_modules/ai-providers/providers/openrouter.cjs`
  - `grep -n "function wrapTransportError" -n node_modules/ai-providers/utils/provider-debug.cjs && sed -n '220,340p' node_modules/ai-providers/utils/provider-debug.cjs`
  - `for idx in 18 19 20 21; do p="output/cod-test/assets/processed/chunks/chunk_$(printf '%03d' $idx).mp4"; echo "--- $p"; ls -l "$p"; ffprobe -v error -show_entries format=duration,size -of json "$p"; done`
  - `ls -lt output/cod-test/_meta/ai/_prompts | sed -n '1,20p'`
  - `node - <<'NODE' ... write output/cod-test/phase2-process/provider-abort-audit.json ... NODE`
  - inspected: `output/cod-test/phase2-process/raw/ai/chunk-0019/split-00/attempt-01/capture.json`
  - inspected: `output/cod-test/phase2-process/raw/ai/chunk-0020/split-00/attempt-01/capture.json`
  - inspected: `output/cod-test/phase2-process/raw/ai/chunk-0021/split-00/attempt-01/capture.json`
  - inspected: `output/cod-test/phase2-process/raw/ffmpeg/extract-chunk-20.json`
  - inspected: `output/cod-test/phase2-process/raw/ffmpeg/extract-chunk-21.json`
  - inspected: `output/cod-test/phase2-process/raw/ffmpeg/split-duration-20-0.json`
  - inspected: `output/cod-test/phase2-process/raw/ffmpeg/split-duration-21-0.json`
  - inspected: `output/cod-test/phase2-process/script-results/video-chunks.failure.json`
  - inspected: `output/cod-test/phase2-process/raw/_meta/errors.summary.json`
  - inspected: `output/cod-test/phase2-process/raw/_meta/errors.jsonl`
  - inspected prompt artifacts: `output/cod-test/_meta/ai/_prompts/675622492f671133747b11729899392abd89a7c708e86c884c160ac3b9d5d386.json`, `ce137fdd2661ff2f57661750d0e901236cbaf9a52b648e285926bf23bcb0fe3f.json`, `3e868e5d81f9b3e81c95013f6773e7635c68a8e73bfdcbeccdd72ff8259161cc.json`
- **Key artifact paths:**
  - failure contract: `output/cod-test/phase2-process/script-results/video-chunks.failure.json`
  - fatal raw capture: `output/cod-test/phase2-process/raw/ai/chunk-0021/split-00/attempt-01/capture.json`
  - nearby successful captures: `output/cod-test/phase2-process/raw/ai/chunk-0019/split-00/attempt-01/capture.json`, `output/cod-test/phase2-process/raw/ai/chunk-0020/split-00/attempt-01/capture.json`
  - extracted chunk assets: `output/cod-test/assets/processed/chunks/chunk_019.mp4`, `chunk_020.mp4`, `chunk_021.mp4`
  - FFmpeg extraction proof: `output/cod-test/phase2-process/raw/ffmpeg/extract-chunk-20.json`, `extract-chunk-21.json`
  - prompt artifacts for adjacent/failing windows: `output/cod-test/_meta/ai/_prompts/675622492f671133747b11729899392abd89a7c708e86c884c160ac3b9d5d386.json`, `ce137fdd2661ff2f57661750d0e901236cbaf9a52b648e285926bf23bcb0fe3f.json`, `3e868e5d81f9b3e81c95013f6773e7635c68a8e73bfdcbeccdd72ff8259161cc.json`
  - bounded helper artifact: `output/cod-test/phase2-process/provider-abort-audit.json`
- **Exact failure contract:** the failing raw capture shows `error: "OpenRouter: aborted"`, `errorName: "OpenRouterError"`, `errorDebug.error.code: "ECONNRESET"`, request `contentTypes: ["text", "video_url"]`, provider `openrouter`, model `qwen/qwen3.5-397b-a17b`, and no HTTP status / request id. The script-level failure contract is `VIDEO_CHUNKS_INTERNAL` with `retryable: false`, which halted Phase 2 after a single attempt on target 0 even though 3 additional configured video targets existed.
- **Nearby successful chunk comparison:**
  - Chunk 19 (`95s-100s`) succeeded on the same provider/model with the same request shape (`text` + `video_url`) and used `10980` total tokens.
  - Chunk 20 (`100s-105s`) succeeded on the same provider/model with the same request shape and used `9729` total tokens.
  - Chunk 21 (`105s-110s`) used the same prompt structure and the same canonical Base64 video-chunk transport, but the connection reset before a response arrived.
- **Payload/request-shape evidence from `provider-abort-audit.json`:**
  - chunk 19: `fileBytes=2689269`, `base64Chars=3585692`, `bodyChars=3596189`
  - chunk 20: `fileBytes=2250076`, `base64Chars=3000104`, `bodyChars=3010752`
  - chunk 21: `fileBytes=2071349`, `base64Chars=2761800`, `bodyChars=2772325`
  - All three requests serialize to the same OpenRouter content-part shape: `text` + `video_url`, with a `data:video/mp4;base64,...` prefix.
- **Diagnosis:**
  - **Most likely immediate cause:** provider / transport instability (`ECONNRESET`) on one OpenRouter request, not a unique chunk-21 request-shape defect.
  - **Why it does not look like payload-size / transport pressure from this chunk itself:** the failing chunk 21 request is materially *smaller* than the adjacent successful chunks 19 and 20 by both on-disk bytes and serialized request-body size.
  - **Why it does not look like a prompt/request-shape edge case:** chunk 21 uses the same prompt contract and the same `text + video_url` request shape as the successful adjacent chunks; only the continuity summary differs, and there is no provider-side 4xx capability or schema error.
  - **Most important product bug uncovered by the audit:** the provider wrapper drops top-level transport metadata when it wraps Axios errors. `node_modules/ai-providers/utils/provider-debug.cjs` creates a fresh `OpenRouterError` with debug metadata, but does **not** preserve `err.code` / `err.status` on the top-level error. `server/lib/ai-targets.cjs` classifies retryability using top-level `error.code` / status, so this `ECONNRESET` gets misclassified as fatal instead of retryable. That is why the run stopped after one attempt on target 0 instead of using the already-configured retry/failover lane.
- **Safest bounded mitigation before the next full cod-test rerun:**
  1. Preserve transport metadata on wrapped provider errors (at minimum copy `code`, and ideally `status` / `requestId` when present) in `node_modules/ai-providers/utils/provider-debug.cjs::wrapTransportError`, **or** teach `server/lib/ai-targets.cjs::isRetryableRuntimeError(...)` to fall back to `error.debug.error.code` / `error.debug.response.status` when top-level fields are absent.
  2. Keep the fix bounded to transport classification so the existing video target order already in `configs/cod-test.yaml` can do its job: retry or fail over from `qwen/qwen3.5-397b-a17b` to the next configured video target on transient aborts.
  3. Do **not** change the canonical Base64 video path for this mitigation; the audit evidence does not justify altering payload shape first.
- **Secondary audit note:** the failure capture for chunk 21 has `promptRef: null` even though the prompt artifact exists on disk (`3e868e...json`). That is a raw-capture bookkeeping gap, but not the main blocker for the rerun.
- **Conclusion:** this chunk-21 stop is best explained as a transient OpenRouter transport abort plus a retry-classification bug that prevented the already-configured bounded failover lane from engaging. The safest next fix is to make `ECONNRESET` survive provider wrapping so Phase 2 can retry/fail over instead of treating the abort as terminal.

---

### Task 12: Preserve wrapped transport retry metadata for transient provider failures

**Bead ID:** `ee-1w0`
**SubAgent:** `coder`
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, implement the preferred bounded fix for transient provider aborts: preserve top-level transport metadata (code, status, request id) when wrapping provider errors so retry/failover classification can recognize ECONNRESET and similar transport failures. Keep the change bounded, update tests/docs/plan, and validate it before the next full cod-test rerun. Claim the assigned bead on start and close it on completion.`

**Folders Created/Deleted/Modified:**
- `server/lib/`
- `test/lib/`
- `.plans/`

**Files Created/Deleted/Modified:**
- `server/lib/ai-targets.cjs`
- `test/lib/ai-targets.test.js`
- `.plans/2026-03-15-audit-visual-grounding-and-expose-ffmpeg-controls.md`

**Status:** ✅ Complete

**Results:** Implemented a bounded transport-metadata preservation seam inside `server/lib/ai-targets.cjs` so wrapped provider errors now lift `debug.error.code`, `debug.response.status`, and request-id headers onto top-level `error.code`, `error.status`, and `error.requestId` before retry classification runs. This keeps the canonical Base64 video payload path unchanged while letting existing retry/failover logic recognize transient aborts like `ECONNRESET`. Expanded `test/lib/ai-targets.test.js` with focused coverage for (1) metadata lifting, (2) retryable classification after preservation, and (3) an `executeWithTargets(...)` retry proving a wrapped `ECONNRESET` now consumes the bounded retry lane instead of hard-stopping as fatal. Focused validation: `node --test test/lib/ai-targets.test.js` ✅ (12 tests passed) and `node --test test/scripts/video-chunks.test.js --test-name-pattern="falls back to second target after retryable failures exhaust on first target"` ✅ (31 passes / 0 fails in the targeted video lane file, including the failover subtest).

---

## Constraints

- Treat visual grounding as the first-priority truth question.
- Do not assume FFmpeg quality is the only issue until the audit proves where grounding actually breaks.
- Keep YAML as the canonical source of truth for FFmpeg controls once implemented.
- Compare future results against the current successful-but-suspicious `cod-test` artifact set.

---

## Final Results

**Status:** ✅ Complete

**What We Built:**
- Restored canonical Base64 video-chunk review for Phase 2 persona analysis in `emotion-engine` + sibling `tools`, removing the frame/image diagnostic detour from the video-chunk lane.
- Fixed truthful chunk slicing and terminal `<1s` micro-chunk skipping so provider-facing chunk windows are bounded and sane.
- Exposed canonical FFmpeg audio/video controls in YAML, then added explicit MP3 audio-quality controls and upgraded `configs/cod-test.yaml` to higher-quality MP3 Phase 1 extraction.
- Cleaned config-schema drift across runnable sample configs so validation passes cleanly.
- Preserved wrapped transport retry metadata so transient provider aborts (for example `ECONNRESET`) classify correctly and engage the existing retry/failover lane.
- Revalidated the focused late-window lane and then completed a full `cod-test` rerun end-to-end, producing fresh `chunk-analysis.json` and `FINAL-REPORT.md` artifacts with materially improved video-grounded semantics.

**Commits:**
- Pending commit/push during session closeout.

**Lessons Learned:**
- Image/frame-derived grounding can be a useful diagnostic probe, but it should not be allowed to replace the canonical video-chunk review contract when that contract is the actual product requirement.
- Transport-shape proof and semantic-output proof are different; both were needed to verify the canonical video path was truly restored.
- Near-zero terminal chunks and lost wrapped transport metadata created misleading secondary failures that masked the main regression once the payload path started working again.
