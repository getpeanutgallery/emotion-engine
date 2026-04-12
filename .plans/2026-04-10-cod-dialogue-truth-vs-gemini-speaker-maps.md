# Emotion Engine

**Date:** 2026-04-10  
**Status:** In Progress  
**Agent:** Cookie 🍪

---

## Goal

Generate readable ordered speaker-map docs for the COD human-verified truth dialogue and the hardened Gemini dialogue run so Derrick can compare each line, speaker ID, and speaker traits directly without digging through separated JSON sections.

---

## Overview

The current JSON artifacts are accurate enough for machine processing, but they are awkward for human review because dialogue lines and speaker profiles are separated. This plan produces durable docs in `docs/` that flatten each artifact into dialogue order, with each line annotated by speaker ID and a concise summary of that speaker's traits/profile.

The immediate deliverables are two docs: one for the human-verified benchmark truth and one for the Gemini hardened rerun. If the format proves useful, it can later be extended into a third direct-comparison doc, but that is intentionally out of scope for this pass.

---

## Tasks

### Task 1: Generate benchmark-truth dialogue speaker map doc

**Bead ID:** `ee-syxo`  
**SubAgent:** `coder`  
**Prompt:** In `projects/peanut-gallery/emotion-engine`, claim bead `ee-syxo` with `bd update ee-syxo --status in_progress --json`, read `benchmarks/fixtures/cod-test/truth/dialogue-data.json`, and generate a durable doc under `docs/` that lists dialogue in order with line text, speaker_id, and concise speaker trait/profile info for each line. Update the plan task if clean to do so, then close the bead with `bd close ee-syxo --reason "Generated benchmark-truth dialogue speaker map doc" --json`. 

**Folders Created/Deleted/Modified:**
- `docs/`

**Files Created/Deleted/Modified:**
- `docs/cod-benchmark-truth-dialogue-speaker-map.md`

**Status:** ✅ Complete

**Results:** Created `docs/cod-benchmark-truth-dialogue-speaker-map.md` with (1) speaker profile key and (2) ordered dialogue table including index, timestamp range, dialogue text, speaker_id, and concise per-speaker trait/profile summary for visual side-by-side comparison with the planned Gemini doc.

---

### Task 2: Generate Gemini dialogue speaker map doc

**Bead ID:** `ee-6v3n`  
**SubAgent:** `coder`  
**Prompt:** In `projects/peanut-gallery/emotion-engine`, claim bead `ee-6v3n` with `bd update ee-6v3n --status in_progress --json`, read `output/cod-dialogue-compare-gemini-3.1-pro-preview/phase1-gather-context/dialogue-data.json`, and generate a durable doc under `docs/` that lists dialogue in order with line text, speaker_id, and concise speaker trait/profile info for each line. Update the plan task if clean to do so, then close the bead with `bd close ee-6v3n --reason "Generated Gemini dialogue speaker map doc" --json`. 

**Folders Created/Deleted/Modified:**
- `docs/`

**Files Created/Deleted/Modified:**
- `docs/2026-04-10-gemini-dialogue-speaker-map.md`

**Status:** ✅ Complete

**Results:** Created `docs/2026-04-10-gemini-dialogue-speaker-map.md` with an ordered line-by-line dialogue table including index, timestamp column (`N/A` when absent in source), dialogue text, `speaker_id`, and a concise per-speaker profile summary derived from `speaker_profiles`. Added a speaker legend section to make side-by-side comparison with the truth doc easier.

---

## Final Results

**Status:** ⏳ In Progress

**What We Built:** Pending.

**Commits:**
- Pending.

**Lessons Learned:** Pending.

---

*Started on 2026-04-10*
