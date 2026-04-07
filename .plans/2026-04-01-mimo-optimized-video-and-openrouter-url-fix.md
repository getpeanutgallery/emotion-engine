---
plan_id: plan-2026-04-01-mimo-optimized-video-and-openrouter-url-fix
bead_ids:
  - ee-3o0l
  - ee-dmcs
  - ee-ulmf
  - ee-p8h8
  - ee-j0qa
  - ee-gwoh
---
# emotion-engine: optimize cod video + fix OpenRouter public-video URL lane

**Date:** 2026-04-01  
**Status:** In Progress  
**Agent:** Cookie 🍪

---

## Goal

Reduce timeout and payload-risk pressure for the MiMo proof lanes by creating a smaller high-quality 720p canonical cod video artifact, then fix the OpenRouter public-video URL implementation against official docs and rerun both the OpenRouter and Xiaomi proof lanes against the optimized staged asset.

---

## Overview

The immediate blocker is no longer config shape. Task 2 proved the bounded Phase 1 proof config is real and dry-run-valid, but the live lane failed in `get-dialogue` before producing final artifacts. Xiaomi timed out under the current bounded runtime, and OpenRouter failed with an `Invalid URL` error. That makes this a transport/runtime stabilization problem more than a planning problem.

Derrick’s direction is to remove an entire class of failure pressure by shrinking the canonical input. That is a good bounded move: if we replace the current source asset with a high-quality 720p encode plus MP3 audio, we lower upload/serialization/processing cost for both provider paths without changing the content under evaluation. In parallel, the OpenRouter `Invalid URL` failure needs a source-owned fix validated against official documentation rather than guesswork.

This plan therefore splits into two execution tracks that converge in the rerun: first produce and stage an optimized cod asset, then research + repair the OpenRouter URL request path, then update both proof configs to the optimized public URL and rerun the Xiaomi and OpenRouter proof lanes on the new asset. Verification should capture exact artifacts, timings, and whether the reduced asset size materially changes timeout behavior.

---

## Tasks

### Task 1: Create the optimized 720p cod asset and record the exact encode contract

**Bead ID:** `ee-3o0l`  
**SubAgent:** `coder`
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, create a smaller high-quality 720p version of the canonical cod test video using ffmpeg, with H.264 video and MP3 audio at honest high quality. Measure original vs optimized file size and basic media properties, document the exact ffmpeg command, and update the active plan with what actually happened. Claim bead ee-3o0l on start with bd update ee-3o0l --status in_progress --json and close it on completion with bd close ee-3o0l --reason "Created optimized cod asset and documented encode contract" --json.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `examples/videos/emotion-tests/`
- optional `docs/`

**Files Created/Deleted/Modified:**
- `.plans/2026-04-01-mimo-optimized-video-and-openrouter-url-fix.md`
- `examples/videos/emotion-tests/cod-720p-h264-mp3-optimized.mp4`

**Status:** ✅ Complete

**Results:** Claimed bead `ee-3o0l`, used the existing canonical source asset at `examples/videos/emotion-tests/cod.mp4`, and produced the optimized handoff artifact at `examples/videos/emotion-tests/cod-720p-h264-mp3-optimized.mp4`.

Exact final ffmpeg command used:

```bash
ffmpeg -y -i examples/videos/emotion-tests/cod.mp4 -map 0:v:0 -map 0:a:0 -c:v libx264 -preset slow -crf 28 -pix_fmt yuv420p -c:a libmp3lame -q:a 4 -movflags +faststart examples/videos/emotion-tests/cod-720p-h264-mp3-optimized.mp4
```

Measured media properties:

- Original: `examples/videos/emotion-tests/cod.mp4` — 62,013,447 bytes (59.14 MiB), duration 140.016s, 1280x720, H.264 video (~3.40 Mb/s), AAC stereo audio (~128 kb/s @ 44.1 kHz)
- Optimized: `examples/videos/emotion-tests/cod-720p-h264-mp3-optimized.mp4` — 43,274,010 bytes (41.27 MiB), duration 140.016s, 1280x720, H.264 video (~2.31 Mb/s), MP3 stereo audio (~150 kb/s @ 44.1 kHz)
- Net change: -18,739,437 bytes (-17.87 MiB, 30.22% smaller)

One earlier encode attempt (`-crf 23 -q:a 2`) was rejected because it produced a larger file than the source (~67.45 MB), which violated the optimization goal. The final contract above is the truthful keep.

Caveats for AWS upload / provider use:

- This is still MP4, but the audio track is now MP3 instead of AAC; confirm the downstream provider path tolerates MP3-in-MP4 before treating it as the new canonical public asset.
- `-movflags +faststart` was added so the file is friendlier to HTTP range/streaming readers once uploaded.
- The source asset was already 720p H.264, so this is a bitrate/packaging optimization pass, not a resolution change or content transform.

---

### Task 2: Hand off the optimized cod asset to Derrick for AWS upload and record the canonical public URL

**Bead ID:** `ee-dmcs`  
**SubAgent:** `primary`
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, prepare the optimized cod asset handoff for Derrick by documenting the exact local artifact path, file size, media properties, and the intended canonical public URL contract that configs should use after upload. Once Derrick provides the final uploaded URL, update the plan/config references to that canonical optimized public URL. Claim bead ee-dmcs on start with bd update ee-dmcs --status in_progress --json and close it on completion with bd close ee-dmcs --reason "Prepared optimized asset handoff and recorded canonical public URL" --json.`

**Folders Created/Deleted/Modified:**
- `.plans/`

**Files Created/Deleted/Modified:**
- `.plans/2026-04-01-mimo-optimized-video-and-openrouter-url-fix.md`
- `configs/cod-test-mimo-xiaomi-direct-smoke.yaml`
- `configs/cod-test-phase1-proof-compare-after-mimo-tranche2.yaml`
- `configs/cod-test-mimo-openrouter-compare.yaml`

**Status:** ✅ Complete

**Results:** Derrick confirmed the canonical optimized public URL as `https://gambit-games-tests.s3.us-east-1.amazonaws.com/peanut-gallery/cod-720p-h264-mp3-optimized.mp4`, and the plan now records that as current truth for the optimized staged asset.

Exact local handoff artifact retained in repo:

- Path: `examples/videos/emotion-tests/cod-720p-h264-mp3-optimized.mp4`
- Size: `43,274,010` bytes (`41.27 MiB`)
- Duration: `140.016009s`
- Container / overall bitrate: MP4 at ~`2.47 Mb/s`
- Video stream: H.264, `1280x720`, ~`2.31 Mb/s`
- Audio stream: MP3 stereo, `44.1 kHz`, ~`150 kb/s`

Safe config rewrites completed now because these lanes already consume a staged public URL and the URL swap does not depend on the OpenRouter implementation fix:

- `configs/cod-test-mimo-xiaomi-direct-smoke.yaml`
- `configs/cod-test-phase1-proof-compare-after-mimo-tranche2.yaml`
- `configs/cod-test-mimo-openrouter-compare.yaml`

What I intentionally did **not** rewrite yet:

- I left `asset.inputPath` and local `source.path` references pointed at `examples/videos/emotion-tests/cod.mp4` for now. Those paths still anchor local repo fixtures / preprocessing expectations, and changing them before Task 4 would mix the public-URL handoff change with the implementation-fix lane.
- Broader docs / historical plan references to the old `cod.mp4` public URL are left alone in this task; they should be updated only where needed by the implementation / verification lane so we do not blur historical run records.

Caveats Derrick should know before reruns:

- The optimized public asset is still `.mp4`, but its audio track is MP3-in-MP4 rather than AAC. Xiaomi/OpenRouter should be validated against the actual staged object before treating that as universally safe.
- OpenRouter still needs the source-owned public-video URL fix from Task 4; swapping the staged URL alone does not resolve the current `Invalid URL` failure.
- Any rerun that still depends on local `inputPath` processing may continue to use the original repo-local `cod.mp4` unless Task 4 explicitly changes that contract.

---

### Task 3: Research official OpenRouter video-by-URL request shape and identify the implementation bug

**Bead ID:** `ee-ulmf`  
**SubAgent:** `research`
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, use official OpenRouter documentation to determine the correct request shape for passing a public video URL, then audit our current implementation to identify why the MiMo lane is failing with Invalid URL. Produce a concise source-backed note with the exact required payload shape, the observed mismatch in our code, and the recommended source-owned fix. Claim bead ee-ulmf on start with bd update ee-ulmf --status in_progress --json and close it on completion with bd close ee-ulmf --reason "Researched OpenRouter public video URL contract and identified implementation bug" --json.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `docs/research/`

**Files Created/Deleted/Modified:**
- `.plans/2026-04-01-mimo-optimized-video-and-openrouter-url-fix.md`
- `docs/research/openrouter-public-video-url-audit-2026-04-01.md`

**Status:** ✅ Complete

**Results:** Wrote the durable research note at `docs/research/openrouter-public-video-url-audit-2026-04-01.md` after checking the official OpenRouter docs for video inputs, multimodal overview, and chat completions.

Key finding: the repo’s OpenRouter video-by-public-URL payload shape is already correct. Official docs require a `messages[*].content[*]` item shaped like:

```json
{
  "type": "video_url",
  "video_url": {
    "url": "https://..."
  }
}
```

That matches our current adapter/runtime chain:

- `server/scripts/process/whole-video-mimo.cjs` already converts URL delivery into `{ type: 'video', url, mimeType }`
- `node_modules/ai-providers/providers/openrouter.cjs` already serializes that into `type: 'video_url'` with nested `video_url.url`
- existing request-shape proof artifacts in `.logs/2026-03-31-mimo-tranche1-request-shape-verify.json` and `.logs/2026-03-31-cod-test-mimo-openrouter-compare-request-shape.json` already show the correct `video_url` JSON for the staged S3 asset

Observed bug in current live failure: the `Invalid URL` is transport-level, not payload-level. The failing capture at `output/_archives/cod-test-phase1-proof-compare-after-mimo-tranche2-openrouter-invalid-url-20260401-1218/phase1-gather-context/raw/ai/dialogue-transcription/attempt-01/capture.json` shows OpenRouter debug request URL `null/chat/completions`, so Axios throws before OpenRouter even evaluates the body.

Source-owned root cause identified:

- `server/lib/provider-runtime-config.cjs` resolves OpenRouter `baseUrl` to `null` when `OPENROUTER_BASE_URL` is unset because the OpenRouter env spec has no `defaultBaseUrl`
- multiple call sites pass `baseUrl: runtimeConfig.baseUrl` explicitly into `provider.complete(...)`
- `node_modules/ai-providers/providers/openrouter.cjs` only falls back to its internal default when `baseUrl` is `undefined`, not when it is `null`
- result: request URL becomes `null/chat/completions`

Recommended fix for Task 4: add the OpenRouter default runtime base URL (`https://openrouter.ai/api/v1`) in `server/lib/provider-runtime-config.cjs` so the owning runtime seam never emits `baseUrl: null` for OpenRouter. Optional hardening can also omit falsey `baseUrl` values at call sites, but the primary source-owned fix belongs in runtime config.

---

### Task 4: Implement the OpenRouter fix, update proof configs to the optimized public URL, and validate with focused tests

**Bead ID:** `ee-p8h8`  
**SubAgent:** `coder`
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, implement the source-owned OpenRouter public-video URL fix documented in the active plan, update the relevant MiMo proof configs to use the optimized canonical public video URL, and run the smallest truthful validation/test path that proves the request shape is now correct. Avoid unrelated refactors. Claim bead ee-p8h8 on start with bd update ee-p8h8 --status in_progress --json and close it on completion with bd close ee-p8h8 --reason "Implemented OpenRouter URL fix and updated configs to optimized asset" --json.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `server/lib/`
- `test/lib/`

**Files Created/Deleted/Modified:**
- `.plans/2026-04-01-mimo-optimized-video-and-openrouter-url-fix.md`
- `server/lib/provider-runtime-config.cjs`
- `test/lib/provider-runtime-config.test.js`

**Status:** ✅ Complete

**Results:** Implemented the source-owned OpenRouter fix at the runtime seam by adding `defaultBaseUrl: 'https://openrouter.ai/api/v1'` to the OpenRouter provider env spec in `server/lib/provider-runtime-config.cjs`. That keeps `resolveProviderRuntimeConfig('openrouter')` from ever emitting `baseUrl: null` when `OPENROUTER_BASE_URL` is unset, which was the direct cause of the bad transport URL `null/chat/completions` captured in Task 3.

I did **not** add extra call-site hardening because the runtime-config fix is sufficient and more correct for this repo-owned seam. Keeping the change there avoids sprinkling falsey-baseUrl guards across multiple callers.

Config status in this task: no additional config edits were needed because Task 2 had already rewritten the active MiMo proof configs to the canonical optimized public asset URL `https://gambit-games-tests.s3.us-east-1.amazonaws.com/peanut-gallery/cod-720p-h264-mp3-optimized.mp4`. I rechecked `configs/cod-test-mimo-openrouter-compare.yaml` during validation and confirmed it still points at that optimized staged URL.

Focused validation run (partial, but truthful for the bug being fixed):

```bash
node --test test/lib/provider-runtime-config.test.js
node - <<"NODE"
const fs = require("fs");
const yaml = require("js-yaml");
const openrouter = require("ai-providers/providers/openrouter.cjs");
const { resolveProviderRuntimeConfig } = require("./server/lib/provider-runtime-config.cjs");
const config = yaml.load(fs.readFileSync("configs/cod-test-mimo-openrouter-compare.yaml", "utf8"));
const stagedUrl = config.asset.media.refs.source_video.staged.url;
const runtimeConfig = resolveProviderRuntimeConfig("openrouter", { OPENROUTER_API_KEY: "sk-or-valid-key-123456789012345678" });
const request = openrouter._private.buildRequest({
  prompt: "Describe the video.",
  attachments: [{ type: "video", url: stagedUrl, mimeType: "video/mp4" }],
  model: "xiaomi/mimo-v2-omni",
  apiKey: runtimeConfig.apiKey,
  baseUrl: runtimeConfig.baseUrl
});
console.log(JSON.stringify({
  runtimeBaseUrl: runtimeConfig.baseUrl,
  requestUrl: request.url,
  stagedUrl,
  content: request.body.messages[0].content
}, null, 2));
NODE
```

Validation outcome:

- `node --test test/lib/provider-runtime-config.test.js` passed with new coverage proving OpenRouter now defaults to `https://openrouter.ai/api/v1` and still honors an explicit `OPENROUTER_BASE_URL` override.
- The targeted Node probe printed `runtimeBaseUrl: "https://openrouter.ai/api/v1"` and `requestUrl: "https://openrouter.ai/api/v1/chat/completions"` while showing the optimized staged URL serialized inside a `video_url` content item.
- That is enough to say the specific invalid-URL transport bug is resolved in source: the OpenRouter request path no longer degrades to `null/chat/completions` when the env override is absent.

Caveat before Task 5 reruns: this validation is transport/request-construction coverage, not a full live provider rerun. Task 5 still needs to execute a bounded live OpenRouter lane to confirm the upstream provider accepts the optimized MP3-in-MP4 asset and that no new runtime limits or provider-side issues appear after the transport fix.

---

### Task 5: Rerun bounded Xiaomi and OpenRouter MiMo proof lanes against the optimized public asset and verify outputs

**Bead ID:** `ee-j0qa`  
**SubAgent:** `coder`
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, rerun the bounded Xiaomi and OpenRouter MiMo proof lanes against the optimized canonical public cod video URL after the OpenRouter fix lands. Capture exact commands, logs, timings, and artifact presence. Compare whether the optimized asset materially improves timeout behavior and whether both providers now reach the intended runtime path. Claim bead ee-j0qa on start with bd update ee-j0qa --status in_progress --json and close it on completion with bd close ee-j0qa --reason "Reran Xiaomi and OpenRouter proof lanes against optimized asset" --json.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `.logs/`
- `output/`

**Files Created/Deleted/Modified:**
- `.plans/2026-04-01-mimo-optimized-video-and-openrouter-url-fix.md`
- `.logs/2026-04-01-cod-test-mimo-openrouter-compare-optimized-rerun-live.log`
- `.logs/2026-04-01-cod-test-phase1-proof-compare-after-mimo-tranche2-optimized-rerun-live.log`
- `output/_archives/cod-test-phase1-proof-compare-after-mimo-tranche2-pre-task5-20260401-100759/**`
- `output/cod-test-mimo-openrouter-compare/**`
- `output/cod-test-phase1-proof-compare-after-mimo-tranche2/**`

**Status:** ⚠️ Partial

**Results:** Claimed bead `ee-j0qa`, preserved the prior in-progress Phase 1 Xiaomi proof packet before rerunning, and executed one fresh bounded OpenRouter rerun plus one fresh bounded Xiaomi rerun against configs already pointed at the optimized canonical staged URL `https://gambit-games-tests.s3.us-east-1.amazonaws.com/peanut-gallery/cod-720p-h264-mp3-optimized.mp4`.

Archive / preservation step performed first so existing evidence was not stomped:

```bash
mv output/cod-test-phase1-proof-compare-after-mimo-tranche2 \
  output/_archives/cod-test-phase1-proof-compare-after-mimo-tranche2-pre-task5-20260401-100759
```

Exact rerun commands actually executed:

```bash
/usr/bin/time -p timeout 420s npm run pipeline -- --config configs/cod-test-mimo-openrouter-compare.yaml --verbose \
  2>&1 | tee .logs/2026-04-01-cod-test-mimo-openrouter-compare-optimized-rerun-live.log
/usr/bin/time -p timeout 420s npm run pipeline -- --config configs/cod-test-phase1-proof-compare-after-mimo-tranche2.yaml --verbose \
  2>&1 | tee .logs/2026-04-01-cod-test-phase1-proof-compare-after-mimo-tranche2-optimized-rerun-live.log
```

Fresh logs / artifacts produced:

- OpenRouter log: `.logs/2026-04-01-cod-test-mimo-openrouter-compare-optimized-rerun-live.log`
- Xiaomi log: `.logs/2026-04-01-cod-test-phase1-proof-compare-after-mimo-tranche2-optimized-rerun-live.log`
- Preserved prior packet: `output/_archives/cod-test-phase1-proof-compare-after-mimo-tranche2-pre-task5-20260401-100759/`
- OpenRouter fresh packet root: `output/cod-test-mimo-openrouter-compare/`
- Xiaomi fresh packet root: `output/cod-test-phase1-proof-compare-after-mimo-tranche2/`

OpenRouter rerun outcome (`configs/cod-test-mimo-openrouter-compare.yaml`):

- The previous transport bug is fixed in live execution: the fresh capture at `output/cod-test-mimo-openrouter-compare/phase1-gather-context/raw/ai/dialogue-chunks/chunk-0000/attempt-01/capture.json` shows `providerRequest.url: "https://openrouter.ai/api/v1/chat/completions"` instead of the old `null/chat/completions` path.
- That same capture proves the request now enters the intended OpenRouter runtime/provider seam and receives a real HTTP `200` response from OpenRouter for chunk 0. So Task 4’s base-URL fix is not just theoretical anymore.
- The rerun still did **not** complete the bounded lane: it failed during Phase 1 `get-dialogue` with `invalid_output: dialogue transcription chunk response was not valid JSON`, recorded in:
  - `output/cod-test-mimo-openrouter-compare/phase1-gather-context/script-results/get-dialogue.failure.json`
  - `output/cod-test-mimo-openrouter-compare/phase1-gather-context/raw/_meta/errors.summary.json`
- Timing: `real 154.21` seconds overall; script-result duration `153972ms`.
- Artifact presence after failure:
  - Present: `_meta/events.jsonl`, prompt captures, chunk-level raw AI captures (`phase1-gather-context/raw/ai/dialogue-chunk-000*.json`), extracted dialogue audio and ffmpeg traces, failure / recovery metadata.
  - Missing: no final `dialogue-data.json`, no `music-data.json`, and no Phase 2 `whole-video-analysis.json` because the run died before the MiMo whole-video process script.
- Truthful interpretation: **OpenRouter now gets past the prior invalid-URL failure and reaches the intended runtime path**, but this specific bounded rerun exposed a new upstream/script-contract problem in chunked dialogue output rather than completing the MiMo comparison lane.

Xiaomi rerun outcome (`configs/cod-test-phase1-proof-compare-after-mimo-tranche2.yaml`):

- The fresh run no longer reproduced the earlier immediate provider timeout failure. The previous preserved failure packet (`output/_archives/cod-test-phase1-proof-compare-after-mimo-tranche2-pre-task5-20260401-100759/phase1-gather-context/script-results/get-dialogue.failure.json`) shows the old behavior clearly: `Xiaomi: timeout of 180000ms exceeded` after `182426ms` in `get-dialogue`.
- In the new rerun, Xiaomi successfully completed the whole-asset hybrid dialogue call and then at least the first chunk before the outer shell watchdog expired:
  - Whole-asset dialogue call: `output/cod-test-phase1-proof-compare-after-mimo-tranche2/_meta/events.jsonl` seq `7-19`, `provider.call.end.ok: true`, duration `197527ms`, capture written to `phase1-gather-context/raw/ai/dialogue-transcription/attempt-01/capture.json`
  - Chunk 0 dialogue call: `output/cod-test-phase1-proof-compare-after-mimo-tranche2/_meta/events.jsonl` seq `22-34`, `provider.call.end.ok: true`, duration `91187ms`, capture written to `phase1-gather-context/raw/ai/dialogue-chunks/chunk-0000/attempt-01/capture.json`
  - Chunk 1 started and progressed through multiple tool-loop turns; last durable event is `_meta/events.jsonl` seq `45`, `tool.loop.provider.await.start` for turn 4 at `2026-04-01T14:17:51.296Z`
- The bounded command itself hit the external watchdog cap (`real 420.00`, exit `124`) before the pipeline emitted a normal failure/success envelope, so there is **no** new final `get-dialogue.failure.json` for this rerun.
- Artifact presence after timeout:
  - Present: `_meta/events.jsonl`, `phase1-gather-context/raw/ai/dialogue-transcription.json`, `phase1-gather-context/raw/ai/dialogue-transcription/attempt-01/capture.json`, `phase1-gather-context/raw/ai/dialogue-chunk-0000.json`, `phase1-gather-context/raw/ai/dialogue-chunks/chunk-0000/attempt-01/capture.json`, ffmpeg chunk planning/extract artifacts.
  - Missing: final `dialogue-data.json`, `music-data.json`, `visual-identity-data.json`, and any clean pipeline-complete packet.
- Truthful interpretation: the optimized-asset rerun shows a **material improvement versus the prior Xiaomi timeout behavior** because the lane now got past the earlier first-call `180000ms` timeout, completed the whole-asset pass, completed chunk 0, and advanced into chunk 1. But the bounded proof lane is still incomplete because the end-to-end dialogue path remains too slow/expensive under the current hybrid/tool-loop contract.

Net Task 5 status by lane:

- OpenRouter bounded rerun: **Partial** — previous invalid-URL bug is resolved and the request reaches `https://openrouter.ai/api/v1/chat/completions`, but the lane still fails in Phase 1 `get-dialogue` with `GET_DIALOGUE_INVALID_OUTPUT` before MiMo whole-video processing runs.
- Xiaomi bounded rerun: **Partial** — improved versus the previous `180000ms` timeout and now progresses meaningfully through dialogue work, but the bounded proof run still does not complete within the 420s outer cap.

Remaining blocker before final verification:

- OpenRouter: a new Phase 1 dialogue structured-output failure now blocks the lane before it can reach the whole-video MiMo compare step.
- Xiaomi: the Phase 1 hybrid dialogue contract remains too slow under current tool-loop / chunking behavior, even with the optimized staged asset, so a final verification pass needs either a tighter bounded contract or a longer truthful watchdog if the goal is full completion evidence.

---

### Task 6: Verify final state, update handoff, and recommend the next tranche move

**Bead ID:** `ee-gwoh`  
**SubAgent:** `primary`
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, verify the optimized-asset + OpenRouter-fix lane end to end. Confirm what is now proven, what remains blocked, which configs and canonical URLs should be treated as current truth, and recommend the next tranche move. Update the plan with the full real result story. Claim bead ee-gwoh on start with bd update ee-gwoh --status in_progress --json and close it on completion with bd close ee-gwoh --reason "Verified optimized-asset plus OpenRouter-fix lane and recommended next move" --json.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `.logs/`
- `output/`

**Files Created/Deleted/Modified:**
- `.plans/2026-04-01-mimo-optimized-video-and-openrouter-url-fix.md`
- optional verification note path

**Status:** ✅ Complete

**Results:** Verified the lane end to end against the current plan, code, configs, and fresh Task 5 artifacts/logs.

What is now **proven**:

- The optimized local artifact exists at `examples/videos/emotion-tests/cod-720p-h264-mp3-optimized.mp4` and remains the right reduced-size handoff asset from this tranche.
- The canonical staged/public URL to treat as current truth is:
  `https://gambit-games-tests.s3.us-east-1.amazonaws.com/peanut-gallery/cod-720p-h264-mp3-optimized.mp4`
- The active proof configs already point their staged source-video URL at that optimized public object:
  - `configs/cod-test-mimo-xiaomi-direct-smoke.yaml`
  - `configs/cod-test-phase1-proof-compare-after-mimo-tranche2.yaml`
  - `configs/cod-test-mimo-openrouter-compare.yaml`
- Those same configs intentionally still keep local fixture references at the original repo-local source path `examples/videos/emotion-tests/cod.mp4` via `inputPath` / local `path`, so current truth is now:
  - **canonical public/staged URL:** optimized MP3-in-MP4 object above
  - **canonical repo-local fixture path:** `examples/videos/emotion-tests/cod.mp4`
- The OpenRouter request-shape hypothesis is resolved: payload shape was already correct; the real source-owned bug was `baseUrl: null`.
- The source-owned OpenRouter runtime fix is present in `server/lib/provider-runtime-config.cjs` via `defaultBaseUrl: 'https://openrouter.ai/api/v1'`.
- That fix is now proven in a live rerun, not just unit coverage: the fresh OpenRouter capture at `output/cod-test-mimo-openrouter-compare/phase1-gather-context/raw/ai/dialogue-chunks/chunk-0000/attempt-01/capture.json` shows request URL `https://openrouter.ai/api/v1/chat/completions` with HTTP `200`, so the old `null/chat/completions` transport failure is genuinely gone.
- The optimized asset materially improved the Xiaomi lane. Compared with the prior first-call timeout, the new bounded rerun progressed through the whole-asset dialogue call, completed chunk 0, and advanced into chunk 1 before the outer 420s watchdog expired.

What is **not** yet proven / still blocked:

- This tranche did **not** prove a fully successful end-to-end MiMo compare completion for either provider.
- OpenRouter is now blocked by a different failure in Phase 1 dialogue generation, not by URL transport. The current blocker is captured in `output/cod-test-mimo-openrouter-compare/phase1-gather-context/script-results/get-dialogue.failure.json` as `GET_DIALOGUE_INVALID_OUTPUT` / `invalid_output: dialogue transcription chunk response was not valid JSON`.
- Xiaomi is no longer failing at the old initial provider-timeout point, but the bounded proof lane still does not finish within the current 420s outer runtime cap. It remains performance/runtime blocked inside the Phase 1 dialogue/tool-loop path.
- Because both providers still stall in Phase 1 dialogue work, this tranche does **not** yet prove the optimized asset is sufficient to unlock the downstream MiMo whole-video compare completion.

Truthful status call for this lane:

- **Overall lane status: ⚠️ Partial**
- **Not complete** because the bounded proof lanes still do not finish end to end.
- **Not hard-blocked on the original OpenRouter bug anymore** because the invalid-URL defect is fixed and verified live.
- **Currently blocked on Phase 1 dialogue contract/runtime behavior**: OpenRouter on invalid JSON output, Xiaomi on excessive dialogue/tool-loop duration under the present bound.

Recommended next focused lane:

1. Treat **Phase 1 `get-dialogue` stabilization** as the next tranche, not asset transport.
2. Start with the **OpenRouter dialogue structured-output lane** because it now fails fast, deterministically, and gives the cleanest bug surface:
   - inspect the bad chunk output and validator-loop behavior
   - decide whether the next fix is prompt/schema tightening, more robust JSON extraction/repair, or a different bounded retry policy
3. In the same tranche, tighten the **Xiaomi dialogue runtime contract** using what Task 5 proved:
   - reduce tool-loop churn / chunk burden or otherwise lower per-run dialogue cost
   - only increase watchdogs if that matches the intended production/runtime contract; do not use longer timeouts to mask an inefficient dialogue path
4. After Phase 1 dialogue stabilizes, rerun the same optimized-asset configs to see whether both providers can finally reach and complete the downstream MiMo compare steps.

Bottom line: this verification pass proves the optimized public asset plus the OpenRouter base-URL fix were both worthwhile and correctly landed, but the active bottleneck has shifted upstream into **Phase 1 dialogue structured-output correctness and runtime efficiency**.
---

## Success Criteria

- A new optimized 720p cod asset exists locally with measured size/properties and a documented ffmpeg contract.
- The optimized asset is staged to a public URL suitable for provider consumption, or the exact staging blocker is documented.
- OpenRouter public-video URL handling is checked against official docs and fixed in source if our implementation is wrong.
- Relevant Xiaomi/OpenRouter proof configs point at the optimized canonical public asset URL.
- Bounded reruns are attempted for both Xiaomi and OpenRouter on the optimized asset.
- We finish with a truthful recommendation about whether the remaining blocker is asset size/runtime budget, provider behavior, or another implementation bug.

---

## Final Results

**Status:** ⚠️ Partial

**What We Built:** We completed the optimized-asset plus OpenRouter-transport-fix tranche and verified the real outcome. The repo now has a smaller canonical cod handoff asset at `examples/videos/emotion-tests/cod-720p-h264-mp3-optimized.mp4`, the active proof configs point at the canonical staged URL `https://gambit-games-tests.s3.us-east-1.amazonaws.com/peanut-gallery/cod-720p-h264-mp3-optimized.mp4`, and the source-owned OpenRouter runtime bug in `server/lib/provider-runtime-config.cjs` is fixed so live requests now hit `https://openrouter.ai/api/v1/chat/completions` instead of failing on `null/chat/completions`.

The truthful end-state is partial rather than complete. OpenRouter no longer fails on the invalid-URL bug, but now stops in Phase 1 dialogue with invalid JSON chunk output. Xiaomi materially improved on the optimized asset and progressed through the whole-asset pass plus chunk 0, but still did not complete within the bounded 420s watchdog. So this tranche retired the transport bug and reduced asset/runtime pressure, but it did not yet deliver a clean end-to-end MiMo compare success.

**Commits:**
- Pending

**Lessons Learned:**
- The OpenRouter request body shape was never the real issue; the runtime base URL seam was.
- The optimized staged asset was a worthwhile change: it did not solve everything, but it measurably improved Xiaomi progress and reduced uncertainty about asset-size pressure.
- The next bottleneck is clearly the Phase 1 dialogue contract, especially structured-output robustness for OpenRouter and runtime efficiency/tool-loop cost for Xiaomi.
- The next tranche should focus on `get-dialogue` stabilization rather than revisiting transport or public-URL wiring.
