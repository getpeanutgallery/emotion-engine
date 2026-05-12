# Emotion Engine

**Date:** 2026-04-10  
**Status:** In Progress  
**Agent:** Cookie 🍪

---

## Goal

Run the three Phase 1 dialogue-only COD compare configs, review their benchmark outputs against the human-verified benchmark, and recommend the strongest dialogue-hearing model.

---

## Overview

This plan executes the dialogue-only apples-to-apples comparison lane prepared earlier today. The scope is intentionally narrow: dialogue benchmark quality only, with reconciliation/music/music-vocals held out so the comparison reflects line-for-line dialogue hearing rather than downstream cross-phase behavior.

Execution will use repo-local Beads for each model run plus a synthesis/recommendation step. Each subagent prompt will include the exact bead lifecycle commands so work state stays queryable in Beads and the resulting artifacts can be tied back to the execution record.

---

## Tasks

### Task 1: Run Mimo dialogue-only compare config

**Bead ID:** `ee-s796`  
**SubAgent:** `coder`  
**Prompt:** In `projects/peanut-gallery/emotion-engine`, claim bead `ee-s796` with `bd update ee-s796 --status in_progress --json`, run `configs/cod-dialogue-compare-mimo.yaml`, capture the key output artifact paths and benchmark summary, note any failures or retries needed, then close the bead with `bd close ee-s796 --reason "Completed Mimo dialogue-only compare run and recorded artifacts" --json`.

**Folders Created/Deleted/Modified:**
- `outputs/`
- `.tmp/`

**Files Created/Deleted/Modified:**
- run artifacts under the configured output directory

**Status:** ⏳ Pending

**Results:** Pending.

---

### Task 2: Run GPT Audio dialogue-only compare config

**Bead ID:** `ee-djd1`  
**SubAgent:** `coder`  
**Prompt:** In `projects/peanut-gallery/emotion-engine`, claim bead `ee-djd1` with `bd update ee-djd1 --status in_progress --json`, run `configs/cod-dialogue-compare-gpt-audio.yaml`, capture the key output artifact paths and benchmark summary, note any failures or retries needed, then close the bead with `bd close ee-djd1 --reason "Completed GPT Audio dialogue-only compare run and recorded artifacts" --json`.

**Folders Created/Deleted/Modified:**
- `outputs/`
- `.tmp/`

**Files Created/Deleted/Modified:**
- run artifacts under the configured output directory

**Status:** ⏳ Pending

**Results:** Pending.

---

### Task 3: Run Gemini 3.1 Pro Preview dialogue-only compare config

**Bead ID:** `ee-1gs4`  
**SubAgent:** `coder`  
**Prompt:** In `projects/peanut-gallery/emotion-engine`, claim bead `ee-1gs4` with `bd update ee-1gs4 --status in_progress --json`, run `configs/cod-dialogue-compare-gemini-3.1-pro-preview.yaml`, capture the key output artifact paths and benchmark summary, note any failures or retries needed, then close the bead with `bd close ee-1gs4 --reason "Completed Gemini 3.1 Pro Preview dialogue-only compare run and recorded artifacts" --json`.

**Folders Created/Deleted/Modified:**
- `outputs/`
- `.tmp/`

**Files Created/Deleted/Modified:**
- run artifacts under the configured output directory

**Status:** ⏳ Pending

**Results:** Pending.

---

### Task 4: Compare the three dialogue-only runs and recommend a winner

**Bead ID:** `ee-1ms2`  
**SubAgent:** `primary`  
**Prompt:** In `projects/peanut-gallery/emotion-engine`, claim bead `ee-1ms2` with `bd update ee-1ms2 --status in_progress --json`, inspect the three completed dialogue-only compare outputs, compare them against the human-verified benchmark, write a concise recommendation summary with evidence, then close the bead with `bd close ee-1ms2 --reason "Compared dialogue-only model runs and wrote recommendation summary" --json`.

**Folders Created/Deleted/Modified:**
- `docs/`
- `outputs/`

**Files Created/Deleted/Modified:**
- `docs/research/2026-04-10-dialogue-only-model-compare.md`

**Status:** ✅ Complete

**Results:** Compared Mimo, GPT Audio, and Gemini failure artifacts against `benchmarks/fixtures/cod-test/truth/dialogue-data.json` with dialogue-line-only focus. Wrote evidence-based recommendation to `docs/research/2026-04-10-dialogue-only-model-compare.md`. Conclusion: MiMo narrowly best among completed artifacts for dialogue coverage; GPT Audio close but missing the final promo line; Gemini not rankable due invalid-output/tool-loop failure and no valid `dialogue-data.json` artifact.

---

### Task 5: Publish dialogue-only comparison doc under /docs

**Bead ID:** `ee-x1hu`  
**SubAgent:** `primary`  
**Prompt:** In `projects/peanut-gallery/emotion-engine`, claim bead `ee-x1hu` with `bd update ee-x1hu --status in_progress --json`, create or move the dialogue-only comparison write-up into a durable top-level `docs/` path in the repo, make sure the resulting doc clearly summarizes the MiMo vs GPT Audio vs Gemini comparison against human-verified truth, then close the bead with `bd close ee-x1hu --reason "Published dialogue-only comparison doc under docs" --json`.

**Folders Created/Deleted/Modified:**
- `docs/`

**Files Created/Deleted/Modified:**
- `docs/2026-04-10-dialogue-only-model-compare.md`

**Status:** ✅ Complete

**Results:** Published a durable top-level docs summary at `docs/2026-04-10-dialogue-only-model-compare.md` that captures the dialogue-only ranking versus human-verified truth: MiMo narrowly best among completed artifacts, GPT Audio close second, Gemini not rankable (no valid `dialogue-data.json`), plus benchmark distortion caveats and representative right/wrong line examples per model.

---

### Task 6: Investigate Gemini dialogue-only compare failure lane

**Bead ID:** `ee-xdy8`  
**SubAgent:** `coder`  
**Prompt:** In `projects/peanut-gallery/emotion-engine`, claim bead `ee-xdy8` with `bd update ee-xdy8 --status in_progress --json`, investigate why `configs/cod-dialogue-compare-gemini-3.1-pro-preview.yaml` failed across retries, identify the dominant failure mode(s), and produce a concise write-up with recommended fixes or next experiments. Close the bead with `bd close ee-xdy8 --reason "Investigated Gemini dialogue-only compare failure lane and documented findings" --json` if completed.

**Folders Created/Deleted/Modified:**
- `docs/`
- `output/`
- `.logs/`

**Files Created/Deleted/Modified:**
- `docs/research/2026-04-10-gemini-dialogue-lane-failure-investigation.md`

**Status:** ✅ Complete

**Results:** Investigated Gemini lane failures across `.logs/2026-04-10-cod-dialogue-compare-gemini-3.1-pro-preview-ee-1gs4*.log`, `output/cod-dialogue-compare-gemini-3.1-pro-preview/phase1-gather-context/script-results/get-dialogue.failure.json`, `raw/_meta/errors.summary.json`, recovery metadata, and `raw/ai/dialogue-transcription/attempt-01/capture.json`. Published durable summary at `docs/research/2026-04-10-gemini-dialogue-lane-failure-investigation.md` concluding the lane failed via mixed causes: OpenRouter transport failures (`aborted`, `No content`) plus 4-turn schema/tool-loop non-convergence on `acoustic_descriptors` shape (`string` vs object missing required `label`).

---

## Final Results

**Status:** ⏳ In Progress

**What We Built:** Pending.

**Commits:**
- Pending.

**Lessons Learned:** Pending.

---

*Started on 2026-04-10*
