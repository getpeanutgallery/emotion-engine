# Emotion Engine

**Date:** 2026-04-10  
**Status:** In Progress  
**Agent:** Cookie 🍪

---

## Goal

Fix two repo hygiene problems in `emotion-engine`: make config target validation depend on actually-used pipeline operations, and stop rerun/debug temp marker files from littering repo root.

---

## Overview

We confirmed that `server/lib/config-loader.cjs` currently validates `ai.music.targets` and `ai.video.targets` unconditionally, even when a config only runs a dialogue-only lane. That makes the validator stricter than runtime reality and forced the new COD dialogue-compare configs to keep unused stub target blocks just to pass validation. The fix should make validation conditional on actual script/config usage so dialogue-only configs only need the targets they truly execute.

We also confirmed that many root-level `.tmp-ee-*` files are not normal pipeline outputs; they are ad hoc rerun/debug bookkeeping markers written directly into repo root during prior investigation lanes. They store command, log, timing, archive, cassette, and timestamp breadcrumbs. They should be routed into a disciplined temp location such as `.tmp/<bead-id>/` or `tmp/<task>/` instead of polluting repo root.

This plan separates product behavior from cleanup discipline. First we fix validator correctness with tests so dialogue-only comparison configs can be truthful and minimal. Then we fix temp-artifact placement, update any scripts/workflows that create the loose markers, and clean up the existing root-level `.tmp-ee-*` files safely into the new location or otherwise remove them with a documented migration.

---

## Tasks

### Task 1: Fix validator to require only targets used by the config

**Bead ID:** `ee-1pbu`  
**SubAgent:** `coder`  
**Prompt:** Audit and update `server/lib/config-loader.cjs` so required AI target chains are conditional on actual pipeline usage. Dialogue-only configs should require only dialogue targets unless other operations are explicitly used. Preserve any still-legitimate conditional requirements (for example recommendation-only or music-vocals-specific target chains). Add or update tests proving that a dialogue-only config can validate without `ai.music.targets` and `ai.video.targets`, while configs that actually use music/video still fail when those targets are missing. Claim bead `ee-1pbu` at start with `bd update ee-1pbu --status in_progress --json` and close it on completion with `bd close ee-1pbu --reason "Validator fix implemented" --json`.

**Folders Created/Deleted/Modified:**
- `server/lib/`
- `test/pipeline/`
- `docs/` (only if documentation needs updating)

**Files Created/Deleted/Modified:**
- `server/lib/config-loader.cjs`
- `test/pipeline/config-loader.test.js`
- any related docs if needed

**Status:** ✅ Complete

**Results:** Updated `server/lib/config-loader.cjs` so `ai.dialogue.targets`, `ai.music.targets`, and `ai.video.targets` are required only when their lanes are actually used by configured scripts. Added focused regression coverage in `test/pipeline/config-loader.test.js` proving dialogue-only configs validate without music/video targets while real music/video lanes still fail when required targets are missing.

---

### Task 2: Route rerun/debug temp markers out of repo root

**Bead ID:** `ee-xp6c`  
**SubAgent:** `coder`  
**Prompt:** Find the workflow(s), helper scripts, or repeated command patterns that create root-level `.tmp-ee-*` files in `emotion-engine`. Refactor the durable repo-owned path so these artifacts land under a disciplined temp location (prefer `.tmp/<bead-id>/` or another repo-local scratch folder that stays untracked) instead of repo root. Document the intended structure if needed. Safely migrate or clean up the existing root-level `.tmp-ee-*` files in a way that preserves useful breadcrumbs or explicitly records what was removed. Claim bead `ee-xp6c` at start with `bd update ee-xp6c --status in_progress --json` and close it on completion with `bd close ee-xp6c --reason "Temp artifact hygiene fixed" --json`.

**Folders Created/Deleted/Modified:**
- `.tmp/`
- `scripts/` or relevant workflow locations if found
- `docs/` if workflow guidance changes

**Files Created/Deleted/Modified:**
- root-level `.tmp-ee-*` files
- any repo-owned scripts/docs that define rerun/debug artifact placement

**Status:** ✅ Complete

**Results:** Added a canonical helper at `scripts/bead-temp-paths.sh`, documented the new scratch layout in `docs/RERUN-TEMP-ARTIFACT-HYGIENE.md`, and ignored `/.tmp/` in `.gitignore`. Migrated existing root-level `.tmp-ee-*` marker files into `.tmp/<bead-id>/legacy-*` with a manifest at `.tmp/legacy-root-markers/MIGRATION-2026-04-10.tsv`, leaving zero root `.tmp-ee-*` files behind.

---

### Task 3: Update the dialogue-compare configs and verify the repo state

**Bead ID:** `ee-hks4`  
**SubAgent:** `coder`  
**Prompt:** After the validator and temp-artifact fixes land, remove any now-unneeded stub target blocks from the new dialogue-only COD compare configs if the validator change makes that possible. Re-run focused validation/tests, confirm the compare configs remain valid dialogue-only lanes, and summarize the resulting repo state including temp-artifact cleanup outcome. Claim bead `ee-hks4` at start with `bd update ee-hks4 --status in_progress --json` and close it on completion with `bd close ee-hks4 --reason "Configs and verification updated" --json`.

**Folders Created/Deleted/Modified:**
- `configs/`
- `test/`
- `.tmp/` or other scratch directories if validation touches them

**Files Created/Deleted/Modified:**
- `configs/cod-dialogue-compare-mimo.yaml`
- `configs/cod-dialogue-compare-gpt-audio.yaml`
- `configs/cod-dialogue-compare-gemini-3.1-pro-preview.yaml`
- any files touched by validation or migration

**Status:** ✅ Complete

**Results:** Removed the no-longer-needed `ai.music` and `ai.video` stub target blocks from all three dialogue-only compare configs. Verified each compare config validates cleanly, and reran the focused config-loader AI requirement tests (`16/16` passing) plus direct per-config validation with no errors.

---

## Final Results

**Status:** ✅ Complete

**What We Built:** Fixed validator target requirements so they now follow actually used pipeline operations, migrated rerun/debug temp markers out of repo root into `.tmp/<bead-id>/`, and simplified the three dialogue-only COD compare configs so they no longer need fake music/video target stubs.

**Commits:**
- Pending

**Lessons Learned:**
- Repo validation should follow actually executed operations, not demand unrelated target chains.
- Temp/debug breadcrumbs need one sanctioned untracked home instead of root-level scatter.

---

*Completed on 2026-04-10*
