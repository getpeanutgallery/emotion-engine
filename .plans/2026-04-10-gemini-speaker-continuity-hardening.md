# Emotion Engine

**Date:** 2026-04-10  
**Status:** In Progress  
**Agent:** Cookie 🍪

---

## Goal

Improve Gemini speaker-id continuity in the dialogue-only COD lane by hardening prompt guidance to prefer reusing existing speaker IDs unless there is strong evidence for a new speaker, then compare the new Gemini run against both the benchmark truth and the older Gemini run.

---

## Overview

The latest Gemini pass improved dialogue-line recovery enough to become rankable, but it still appears to over-fragment speakers. In uncertain cases, it seems biased toward creating a new `speaker_id` instead of preserving continuity. That gives us decent transcript fidelity while weakening speaker-tracking quality.

This plan focuses narrowly on that continuity problem. We are not adding a regression-test lane here; success will be judged empirically by the rerun output and comparison against truth plus the earlier Gemini run. The aim is to reduce unnecessary speaker splitting without losing the dialogue-recovery gains unlocked by the JSON-contract hardening work.

---

## Tasks

### Task 1: Audit current Gemini speaker-continuity guidance in the dialogue prompt

**Bead ID:** `ee-nx7w`  
**SubAgent:** `coder`  
**Prompt:** In `projects/peanut-gallery/emotion-engine`, claim bead `ee-nx7w` with `bd update ee-nx7w --status in_progress --json`, inspect the current Gemini-facing dialogue prompt and identify where speaker continuity guidance is weak, missing, or overridden by wording that encourages unnecessary new speaker creation. Document exactly what should change, then close the bead with `bd close ee-nx7w --reason "Audited Gemini speaker-continuity guidance in dialogue prompt" --json`. 

**Folders Created/Deleted/Modified:**
- `docs/research/`

**Files Created/Deleted/Modified:**
- `docs/research/2026-04-10-gemini-speaker-continuity-guidance-audit.md`

**Status:** ✅ Complete

**Results:** Audited live Gemini-facing dialogue guidance in `server/scripts/get-context/get-dialogue.cjs` (whole-asset prompt, chunk prompt, chunk handoff guidance, and chunk final-artifact rules) plus adjacent prompt guidance doc `docs/dialogue-transcription-prompt-v2-3-draft-2026-04-08.md`. Found multiple split-biased instructions that make “create new speaker_id” the practical default in uncertainty. Wrote durable findings and concrete replacement wording in `docs/research/2026-04-10-gemini-speaker-continuity-guidance-audit.md`.

---

### Task 2: Harden Gemini prompt guidance for speaker-id continuity

**Bead ID:** `ee-8tmn`  
**SubAgent:** `coder`  
**Prompt:** In `projects/peanut-gallery/emotion-engine`, claim bead `ee-8tmn` with `bd update ee-8tmn --status in_progress --json`, update the dialogue prompt so Gemini prefers reusing an existing speaker_id unless there is strong evidence of a different speaker. Emphasize continuity across adjacent lines, warn against over-fragmenting the cast, and keep the transcript-quality gains from the previous JSON-contract hardening intact, then close the bead with `bd close ee-8tmn --reason "Hardened Gemini prompt for speaker-id continuity" --json`. 

**Folders Created/Deleted/Modified:**
- `server/`
- `docs/`

**Files Created/Deleted/Modified:**
- `server/scripts/get-context/get-dialogue.cjs`
- `docs/dialogue-transcription-prompt-v2-3-draft-2026-04-08.md`

**Status:** ✅ Complete

**Results:** Hardened Gemini speaker-continuity guidance across whole-asset, chunked, and handoff-adjacent prompt language. Updated tie-breakers so adjacent/near-adjacent lines default to reusing an existing `speaker_id` when acoustic cues plausibly align; requiring strong multi-cue acoustic evidence to mint a new `speaker_id`; explicitly warning that role/style shifts alone should not force a split; and calling over-fragmenting the cast a failure mode. Also strengthened chunk final-artifact continuity instruction from soft “when possible” wording to continuity-by-default while preserving prior JSON-contract hardening guardrails for chronology, damaged speech, confidence, and structured descriptors.

---

### Task 3: Rerun Gemini dialogue-only lane after speaker-continuity prompt hardening

**Bead ID:** `ee-r261`  
**SubAgent:** `coder`  
**Prompt:** In `projects/peanut-gallery/emotion-engine`, claim bead `ee-r261` with `bd update ee-r261 --status in_progress --json`, rerun `configs/cod-dialogue-compare-gemini-3.1-pro-preview.yaml` after the speaker-continuity prompt hardening. Capture whether the run still produces a valid dialogue artifact and note any changes in speaker_id behavior, over-fragmentation, or transcript quality, then close the bead with `bd close ee-r261 --reason "Reran Gemini dialogue-only lane after speaker-continuity hardening" --json` if successful. 

**Folders Created/Deleted/Modified:**
- `output/`
- `.logs/`
- `docs/research/`

**Files Created/Deleted/Modified:**
- `.logs/20260410-151350-cod-dialogue-compare-gemini-3.1-pro-preview-ee-r261.log`
- `output/cod-dialogue-compare-gemini-3.1-pro-preview/phase1-gather-context/dialogue-data.json`
- `output/cod-dialogue-compare-gemini-3.1-pro-preview/phase1-gather-context/script-results/get-dialogue.success.json`
- `output/cod-dialogue-compare-gemini-3.1-pro-preview/phase1-gather-context/raw/_meta/errors.summary.json`
- `docs/research/2026-04-10-gemini-speaker-continuity-rerun.md`

**Status:** ✅ Complete

**Results:** Reran the Gemini dialogue-only config with the repo's standard dotenv-loading pipeline command (`npm run pipeline -- --config ... --verbose`). `get-dialogue` succeeded on first attempt with a valid dialogue artifact and success envelope (29 segments). Speaker fragmentation improved versus the earlier Gemini baseline (previous map showed 32 segments and 18 speaker IDs; rerun produced 29 segments and 13 speaker IDs), with better continuity in the lyric block and end-of-trailer villain lines. Transcript quality stayed usable and coherent. Remaining non-zero pipeline exit is due to benchmark/config expectation mismatch (`musicData` missing in a dialogue-only lane), not a transport/provider or dialogue-validator failure in this run.

---

### Task 4: Compare new Gemini vs old Gemini vs truth on speaker-id continuity

**Bead ID:** `ee-mud9`  
**SubAgent:** `primary`  
**Prompt:** In `projects/peanut-gallery/emotion-engine`, claim bead `ee-mud9` with `bd update ee-mud9 --status in_progress --json`, compare the new Gemini rerun against the older Gemini run and the benchmark truth, focusing specifically on speaker-id continuity, unnecessary speaker splits, and whether assignments moved closer to the truth. Write a durable comparison summary, then close the bead with `bd close ee-mud9 --reason "Compared new Gemini vs old Gemini vs truth on speaker continuity" --json`. 

**Folders Created/Deleted/Modified:**
- `docs/`
- `.plans/`

**Files Created/Deleted/Modified:**
- `docs/research/2026-04-10-gemini-speaker-continuity-comparison-vs-truth.md`
- this plan file

**Status:** ✅ Complete

**Results:** Compared post-hardening Gemini rerun (`output/cod-dialogue-compare-gemini-3.1-pro-preview/.../dialogue-data.json`) against prior Gemini baseline (`docs/2026-04-10-gemini-dialogue-speaker-map.md`) and truth (`benchmarks/fixtures/cod-test/truth/dialogue-data.json`). Confirmed continuity/fragmentation improved structurally (IDs reduced 18→13; singleton IDs 15→8), but assignment movement toward truth is mixed (line-level speaker-ID alignment did not materially improve; some late-line over-merging appeared). Transcript quality remained acceptable and contamination lines dropped (11→8). Wrote durable findings in `docs/research/2026-04-10-gemini-speaker-continuity-comparison-vs-truth.md`.

---

## Final Results

**Status:** ⏳ In Progress

**What We Built:** Pending.

**Commits:**
- Pending.

**Lessons Learned:** Pending.

---

*Started on 2026-04-10*
