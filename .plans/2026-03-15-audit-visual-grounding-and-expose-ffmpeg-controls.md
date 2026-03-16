# emotion-engine: audit visual grounding and expose FFmpeg controls

**Date:** 2026-03-15  
**Status:** In Progress  
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
- `server/lib/config-loader.cjs`
- FFmpeg-related call sites under `server/lib/` and `server/scripts/`
- `configs/*.yaml`
- relevant tests/docs
- `.plans/2026-03-15-audit-visual-grounding-and-expose-ffmpeg-controls.md`

**Status:** ⏳ Pending

**Results:** Pending.

---

### Task 4: Run a targeted revalidation after grounding + FFmpeg work

**Bead ID:** `ee-04n`  
**SubAgent:** `primary`  
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, after the grounding fix lane and FFmpeg-YAML lane are implemented, run the smallest truthful validation that can show whether chunk-level persona grounding improved. Compare the new chunk outputs against the recent cod-test artifact set and call out whether the persona now references specific visual evidence instead of recycled generic labels. Claim the assigned bead on start and close it on completion.`

**Folders Created/Deleted/Modified:**
- `output/`
- `.plans/`

**Files Created/Deleted/Modified:**
- `.plans/2026-03-15-audit-visual-grounding-and-expose-ffmpeg-controls.md`
- fresh validation artifacts

**Status:** ⏳ Pending

**Results:** Pending.

---

## Intended execution order

1. Task 1 — audit the visual-grounding path
2. Task 2 — define the bounded fix lane from evidence
3. Task 3 — expose FFmpeg controls in YAML
4. Task 4 — run a focused revalidation and compare outputs

Task 2 depends on Task 1. Task 4 depends on Tasks 2 and 3.

---

## Constraints

- Treat visual grounding as the first-priority truth question.
- Do not assume FFmpeg quality is the only issue until the audit proves where grounding actually breaks.
- Keep YAML as the canonical source of truth for FFmpeg controls once implemented.
- Compare future results against the current successful-but-suspicious `cod-test` artifact set.

---

## Final Results

**Status:** Draft

**What We Built:** Pending.

**Commits:**
- Pending.

**Lessons Learned:** Pending.
