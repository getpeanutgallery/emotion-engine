---
plan_id: plan-2026-03-10-issue-expose-ffmpeg-compression-variables
---
# emotion-engine: issue — expose ffmpeg compression variables via YAML (clean-break)

**Date:** 2026-03-10  
**Status:** Complete
**Agent:** Cookie 🍪

---

## Goal

Create a new tracked issue in `projects/peanut-gallery/emotion-engine/.issues/` to:
- expose ffmpeg compression variables for **audio + video** via YAML
- treat YAML values as the **canonical source**
- **hard error** if missing
- remove internal defaults/legacy fallback behavior (clean break)

---

## Tasks

### Task 1: Create issue file + commit + push

**SubAgent:** `coder`
**Prompt:** In `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine`:
1) Create a new `.issues/*.md` describing Derrick’s request:
   - Expose ffmpeg compression variables used for audio + video to YAML
   - YAML is canonical; hard error if missing
   - No internal defaults, no legacy/fallback paths (clean break)
   Include:
   - context / motivation
   - proposed YAML keys/schema (suggest names)
   - implementation sketch (where ffmpeg args are assembled)
   - acceptance criteria
   - notes on migration (what configs must be updated)
2) Commit and push to `origin/main`.
Return: issue filename + commit hash.

**Status:** ✅ Complete

**Results:**
- Created: `.issues/expose-ffmpeg-compression-vars-via-yaml.md`
- Commit: `08cb52c` (pushed to `origin/main`)

---

## Final Results

**Status:** ⏳ In Progress
