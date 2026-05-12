# emotion-engine: point cod-test at optimized S3 asset and prioritize MiMo targets

**Date:** 2026-04-06  
**Status:** In Progress  
**Agent:** Cookie 🍪

---

## Goal

Update the active `configs/cod-test.yaml` so today’s config points at the optimized staged COD test video on S3 and uses MiMo as the first AI target in every non-recovery AI use case.

---

## Overview

Derrick wants the config we are actively using today updated directly rather than creating another side config. The requested changes are limited to config shape: keep the recovery AI lane unchanged, point the asset at the optimized public S3 video, and make MiMo the first-choice target across the normal AI use-case lists.

This should stay surgical. We are not changing the recovery system, benchmark path, or broader pipeline architecture in this lane. We only want a truthful config edit that preserves the existing fallback targets while moving MiMo to the front and wiring the optimized staged source-video URL into the active config.

---

## Tasks

### Task 1: Edit active cod-test config for optimized asset + MiMo-first target ordering

**Bead ID:** `ee-p1lc`  
**SubAgent:** `coder`  
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, claim bead ee-p1lc immediately with \`bd update ee-p1lc --status in_progress --json\`, then update configs/cod-test.yaml so the active config points at the optimized staged COD test video on S3 and uses MiMo as the first choice in every non-recovery AI use-case target list. Keep the recovery.ai block unchanged. Preserve existing fallback targets after the new first-choice MiMo target. Use the established staged-media config pattern already present in the repo for the optimized S3 URL. Update this plan truthfully with exactly what changed, do not push, and close bead ee-p1lc with a clear reason when finished.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `configs/`

**Files Created/Deleted/Modified:**
- `.plans/2026-04-06-point-cod-test-at-optimized-url-and-prioritize-mimo.md`
- `configs/cod-test.yaml`

**Status:** ✅ Complete

**Results:** Updated `configs/cod-test.yaml` directly and kept the change surgical.

Exact config changes made:
- Added `asset.media.refs.source_video` using the repo’s existing staged-media pattern from the MiMo comparison/rerun configs, pointing at the optimized public S3 asset `https://gambit-games-tests.s3.us-east-1.amazonaws.com/peanut-gallery/cod-720p-h264-mp3-optimized.mp4` while preserving the local `asset.inputPath`.
- Added `ai.video.inputRefs: [source_video]` so the active video lane can explicitly use the staged optimized source-video ref.
- Prepended `openrouter -> xiaomi/mimo-v2-omni` as the first target in every non-recovery AI use-case target list in this config: `ai.dialogue`, `ai.music`, `ai.music_vocals`, `ai.dialogue_stitch`, `ai.video`, and `ai.recommendation`.
- Preserved the pre-existing fallback target order behind the new MiMo-first entry in each list.
- Left the `recovery.ai` block unchanged as requested.

MiMo parameter choices were kept aligned with nearby established configs where available:
- `dialogue`, `music`, and `music_vocals`: `max_tokens: 43219`, `timeoutMs: 180000`, `thinking.level: high`
- `video`: `max_tokens: 4000`, `timeoutMs: 180000`, `thinking.level: high`
- `dialogue_stitch` and `recommendation`: `max_tokens: 25000`, `thinking.level: high`

Validation run after the edit:
- `node validate-configs.cjs`
- `node server/run-pipeline.cjs --config configs/cod-test.yaml --dry-run`

Both passed. No push was performed.

---

## Final Results

**Status:** ✅ Complete

**What We Built:** The active `configs/cod-test.yaml` now carries the canonical optimized staged COD video ref and explicitly prioritizes MiMo first across every normal AI target list while keeping the existing fallback targets behind it. The recovery lane was left untouched.

**Commits:**
- Not committed in this task.

**Lessons Learned:** The repo already had a clean staged-media pattern for the optimized COD asset, so the safest change was to reuse that exact shape in the active config and only reorder target preference rather than inventing another bespoke cod-test lane.

---

*Started on 2026-04-06*
