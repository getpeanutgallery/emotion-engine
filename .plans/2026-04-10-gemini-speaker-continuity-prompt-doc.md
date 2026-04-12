# Emotion Engine

**Date:** 2026-04-10  
**Status:** In Progress  
**Agent:** Cookie 🍪

---

## Goal

Create an editable doc that reviews the current Gemini dialogue speaker-continuity prompt, explains the likely causes of speaker splitting, and proposes replacement wording that Derrick can edit directly before we implement it and use it in the next Gemini test run.

---

## Overview

We now have enough evidence to move from blind iteration to prompt-guided iteration. The next step is not to immediately change the implementation again, but to draft a durable prompt-review/reference doc that captures the current speaker-assignment rules, annotates which parts are helping versus hurting, and proposes a stronger continuity-focused replacement.

This doc will become the source of truth for the next implementation pass. After Derrick edits/approves it, we can implement the prompt changes from that doc and rerun Gemini to see whether speaker-id continuity moves closer to the benchmark truth without giving up the transcript-quality gains from the JSON-contract hardening work.

---

## Tasks

### Task 1: Draft editable Gemini speaker-continuity prompt review doc

**Bead ID:** `ee-6jqa`  
**SubAgent:** `coder`  
**Prompt:** In `projects/peanut-gallery/emotion-engine`, claim bead `ee-6jqa` with `bd update ee-6jqa --status in_progress --json`, create an editable doc under `docs/` that reviews the current Gemini dialogue speaker-continuity prompt. Include: current problematic rules, why they may cause speaker splitting, proposed replacement wording, and a section clearly marked for Derrick edits/approval. The doc should be usable as the direct implementation reference for the next run. Update this plan task if clean to do so, then close the bead with `bd close ee-6jqa --reason "Drafted editable Gemini speaker-continuity prompt review doc" --json`. 

**Folders Created/Deleted/Modified:**
- `docs/`

**Files Created/Deleted/Modified:**
- `docs/2026-04-10-gemini-speaker-continuity-prompt-review-editable.md`

**Status:** ✅ Complete

**Results:** Drafted an editable review/reference doc that summarizes current live continuity rules from `server/scripts/get-context/get-dialogue.cjs`, highlights likely help/hurt guidance, proposes replacement speaker-continuity wording, documents fragile cues (gender presentation, age impression, intensity, channel texture, role/style labels), includes a Derrick edit/approval block, and marks itself as the implementation reference for the next Gemini run once approved.

---

### Task 2: Implement approved doc and rerun Gemini

**Bead ID:** `ee-2xb5`  
**SubAgent:** `coder`  
**Prompt:** In `projects/peanut-gallery/emotion-engine`, claim bead `ee-2xb5` with `bd update ee-2xb5 --status in_progress --json`, use `docs/2026-04-10-gemini-speaker-continuity-prompt-review-editable.md` as the direct implementation reference, apply the approved prompt changes, rerun the Gemini dialogue-only lane, capture whether speaker continuity improves against truth while transcript quality remains usable, update this plan task if clean to do so, then close the bead with `bd close ee-2xb5 --reason "Implemented approved Gemini speaker-continuity prompt doc and reran" --json`.

**Folders Created/Deleted/Modified:**
- `server/`
- `docs/`
- `output/`
- `.logs/`

**Files Created/Deleted/Modified:**
- `server/scripts/get-context/get-dialogue.cjs`
- `docs/research/2026-04-10-gemini-speaker-continuity-approved-doc-rerun.md`
- `output/cod-dialogue-compare-gemini-3.1-pro-preview/phase1-gather-context/dialogue-data.json`
- `output/cod-dialogue-compare-gemini-3.1-pro-preview/phase1-gather-context/script-results/get-dialogue.success.json`
- `.logs/20260410-170209-cod-dialogue-compare-gemini-3.1-pro-preview-ee-2xb5.log`

**Status:** ✅ Complete

**Results:** Implemented the approved speaker-continuity prompt wording from `docs/2026-04-10-gemini-speaker-continuity-prompt-review-editable.md` across whole-asset, chunk, and handoff prompt sections in `get-dialogue.cjs`. Reran `configs/cod-dialogue-compare-gemini-3.1-pro-preview.yaml` via repo-normal `npm run pipeline -- --config ... --verbose` flow (dotenv auto-load). Dialogue extraction remained valid and usable; however, continuity/fragmentation regressed versus the immediately prior continuity-hardened rerun (29→32 segments, 13→15 speaker IDs, 8→10 singletons), while reducing one tail over-merge pattern. Remaining model failure class is speaker-ID instability (renewed over-fragmentation under short/variable snippets). Top-level pipeline still ends on missing `musicData` benchmark-contract artifact.

---

### Task 3: Compare approved-doc Gemini rerun vs benchmark truth

**Bead ID:** `ee-ahpw`  
**SubAgent:** `primary`  
**Prompt:** In `projects/peanut-gallery/emotion-engine`, claim bead `ee-ahpw` with `bd update ee-ahpw --status in_progress --json`, compare the approved-doc Gemini rerun against the benchmark truth with focus on speaker-id continuity, fragmentation, and key line-level deviations, write a durable comparison summary, update this plan task if clean to do so, then close the bead with `bd close ee-ahpw --reason "Compared approved-doc Gemini rerun vs benchmark truth" --json`.

**Folders Created/Deleted/Modified:**
- `docs/`
- `.plans/`

**Files Created/Deleted/Modified:**
- `docs/research/2026-04-10-gemini-approved-doc-vs-truth-speaker-continuity-assessment.md`
- `.plans/2026-04-10-gemini-speaker-continuity-prompt-doc.md`

**Status:** ✅ Complete

**Results:** Compared approved-doc Gemini rerun against benchmark truth and wrote durable findings in `docs/research/2026-04-10-gemini-approved-doc-vs-truth-speaker-continuity-assessment.md`. Assessment: one specific tail over-merge was fixed (`"Killing a man..."` no longer merged with `"You were never cut out..."`), but overall speaker continuity regressed versus the prior continuity-hardened rerun (segments 29→32, distinct speakers 13→15, singletons 8→10, switches 17→19). Net prompt impact for continuity is regression despite strong transcript text coverage (19/20 truth lines covered at >=0.75 best similarity).

---

## Final Results

**Status:** ⏳ Draft

**What We Built:** Pending.

**Commits:**
- Pending.

**Lessons Learned:** Pending.

---

*Started on 2026-04-10*
