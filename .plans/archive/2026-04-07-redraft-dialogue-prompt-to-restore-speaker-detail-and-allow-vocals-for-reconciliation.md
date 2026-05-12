# emotion-engine: redraft dialogue prompt to restore speaker detail and allow vocals for reconciliation

**Date:** 2026-04-07  
**Status:** Draft  
**Agent:** Cookie 🍪

---

## Goal

Draft a revised dialogue prompt that restores useful speaker grounding (`acoustic_descriptors`, `inferred_traits`) and allows more ambiguous sung/spoken-vocal material into dialogue capture for testing, so reconciliation can strip music-led vocals later instead of losing spoken dialogue up front.

---

## Overview

The latest whole-asset dialogue run showed an overcorrection: while the prompt/runtime cleanup reduced prompt pollution, it also produced weak speaker detail and missed important dialogue. Derrick reviewed the output and called out that `acoustic_descriptors` and `inferred_traits` came back empty, some dialogue was missed entirely, and timestamping still looks weak without stronger grounding.

Derrick’s new test direction is to relax the prompt’s exclusion of sung/chant-like material and bias toward retaining borderline spoken-vocal content in dialogue capture, then rely on reconciliation to strip music-led vocals later. In parallel, the dialogue prompt should be redrafted to encourage grounded speaker detail again rather than defaulting to empty arrays everywhere.

This lane should stop short of implementation first. The immediate deliverable is a reviewable prompt draft plus rationale, so Derrick can inspect the wording before we wire it into the live dialogue flow.

---

## Tasks

### Task 1: Inspect the current dialogue prompt language that suppresses speaker detail and excludes sung/chant-like vocals

**Bead ID:** `ee-pt73`  
**SubAgent:** `research`  
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, inspect the current dialogue prompt wording and identify the instructions most likely responsible for empty acoustic_descriptors/inferred_traits output and aggressive exclusion of sung or chant-like vocal material. Update this plan truthfully with the exact prompt sections and likely effects. Claim the assigned bead at start with bd update <ID> --status in_progress --json and close it on completion with bd close <ID> --reason "Current dialogue prompt inspected for speaker-detail and vocal-exclusion issues" --json.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `docs/`
- `server/scripts/get-context/`

**Files Created/Deleted/Modified:**
- `.plans/2026-04-07-redraft-dialogue-prompt-to-restore-speaker-detail-and-allow-vocals-for-reconciliation.md`
- `server/scripts/get-context/get-dialogue.cjs` (inspected only; no code changes)

**Status:** ✅ Complete

**Results:** Inspected the currently active dialogue prompts in `server/scripts/get-context/get-dialogue.cjs` (full-pass prompt, chunk prompt, and the top-level `finalArtifactRules`) and identified the wording most likely driving the regression.

- **Prompt sections likely suppressing `acoustic_descriptors`:**
  - `grounded should contain only cautious same-speaker evidence: anonymous continuity, linked_segment_indexes, and acoustically supported descriptors.`
  - `If no acoustic descriptor is supportable, return an empty acoustic_descriptors array.`
  - Likely effect: the model is pushed toward omission whenever a descriptor is even mildly uncertain, so it has a strong incentive to leave `acoustic_descriptors` empty instead of emitting low-confidence but still useful speaker-grounding cues like cadence, texture, age impression, or recording character.

- **Prompt sections likely suppressing `inferred_traits`:**
  - `Keep grounded speaker identity separate from any inferred_traits guesswork.`
  - `If you are unsure or have no supportable speculative traits, return exactly "inferred_traits": { "traits": [] }.`
  - `Keep inferred_traits clearly speculative and separate from grounded same-speaker evidence.`
  - Likely effect: this framing over-penalizes speculative-but-useful traits, so the safest compliant output is an empty `traits` array. The exact-empty example especially teaches the model that blank `inferred_traits` is the preferred safe fallback.

- **Prompt sections likely overexcluding sung / chant-like / borderline vocal material:**
  - Top-level final artifact rule: `Include audible spoken words only. Exclude sung lyrics, chant-like vocals, rap synchronized to music, melodic refrains, and purely instrumental or otherwise non-vocal sections.`
  - Full/chunk scope rule: `Include audible spoken dialogue only.`
  - Full/chunk scope rule: `If delivery pivots from spoken dialogue into clearly sung, chant-like, rap-like, or otherwise music-led vocal delivery, split immediately at that pivot and keep only the spoken portion in dialogue_segments.`
  - Full/chunk scope rule: `Do not use adjacent spoken context to pull a music-led vocal phrase into dialogue.`
  - Top-level final artifact rule: `If spoken delivery and music-led vocals alternate, keep only the spoken spans in dialogue_segments and let adjacent music-vocal spans live in the music lane.`
  - Likely effect: borderline speech-song, shouted chant, rhythmic promo vocal, and other ambiguous hybrid material gets rejected early instead of being preserved for later reconciliation. The repeated “spoken only / split immediately / keep only the spoken portion” wording makes the dialogue pass aggressively conservative around exactly the material Derrick wants retained for testing.

---

### Task 2: Draft a revised dialogue prompt for approval

**Bead ID:** `ee-i67v`  
**SubAgent:** `research`  
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, draft a revised dialogue prompt for approval only. It should restore useful grounded speaker detail, allow more ambiguous sung/spoken-vocal material into dialogue capture for testing, and explicitly frame reconciliation as the cleanup stage for stripping music-led vocals later. Keep the draft reviewable and durable in docs/, and update this plan truthfully with the doc path and key changes. Do not implement code yet. Claim the assigned bead at start with bd update <ID> --status in_progress --json and close it on completion with bd close <ID> --reason "Revised dialogue prompt draft written for review" --json.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `docs/`

**Files Created/Deleted/Modified:**
- `.plans/2026-04-07-redraft-dialogue-prompt-to-restore-speaker-detail-and-allow-vocals-for-reconciliation.md`
- `docs/dialogue-transcription-prompt-v2-2-draft-2026-04-07.md`

**Status:** ✅ Complete

**Results:** Wrote the approval-only draft to `docs/dialogue-transcription-prompt-v2-2-draft-2026-04-07.md`.

Key prompt changes captured in the draft:
- Restored grounded speaker-detail guidance by explicitly asking for concise, supportable `acoustic_descriptors` when the audio gives real evidence, instead of training the model toward empty arrays as the safest default.
- Kept `inferred_traits` speculative, but made them useful again by allowing low-confidence review aids such as age range, gender presentation, role impression, or demeanor when clearly marked as uncertain.
- Relaxed the old spoken-only exclusion rules so ambiguous spoken/sung hybrids, chant-like callouts, rhythmic speech, hype delivery, and similar dialogue-like vocal material can be retained for testing when they still carry intelligible words and plausibly function as speech.
- Explicitly framed reconciliation as the later cleanup stage responsible for stripping or reclassifying music-led vocals, so the dialogue pass stops discarding borderline material too early.
- Kept the draft lean and reviewable in docs/ without reintroducing validator/runtime clutter, tool-contract prose, or other prompt pollution.

---

## Final Results

**Status:** ⏳ Pending

**What We Built:** Pending.

**Commits:**
- Pending.

**Lessons Learned:** Pending.

---

*Drafted on 2026-04-07*