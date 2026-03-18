---
plan_id: plan-2026-03-12-convert-legacy-issues-to-beads
bead_ids:
  - ee-5bx
  - ee-c28
  - ee-p5u
---
# emotion-engine: convert legacy `.issues/` into Beads + plans

**Date:** 2026-03-12  
**Status:** Complete
**Agent:** Cookie 🍪

---

## Goal

Migrate the legacy `emotion-engine/.issues/` markdown issue folder into the current repo-local `/.beads/` + `/.plans/` workflow, then remove the obsolete `.issues/` folder once every issue has been preserved in the new system.

---

## Overview

`emotion-engine` still has a pre-Beads `/.issues/` folder with 9 markdown issue files. The clean migration path is to inventory each legacy issue, create a corresponding Bead with the same intent and enough description/context to preserve the original issue content, add or update plan references where useful, verify the migrated set, and only then delete `/.issues/`.

A few of the legacy issues appear likely to be already implemented or superseded (for example the Phase3-only config and duplicate recommendation-key parse issue), so the migration should preserve their history while reflecting their current status in Beads instead of blindly marking everything open.

---

## Tasks

### Task 1: Inventory legacy `.issues/` and map each file to target Beads state

**Bead ID:** `ee-5bx`  
**SubAgent:** `research`  
**Prompt:** Read every file in `emotion-engine/.issues/`, summarize its purpose, determine whether it looks open/implemented/superseded from current repo state, and propose the target Beads title/status mapping for each legacy issue.

**Status:** ✅ Complete

**Results:** All 9 legacy `.issues/*.md` files were inventoried and mapped to target Beads states. Three were judged clearly implemented/closed from current repo state (`cod-test-openrouter-invalid-model-id`, `cod-test-phase3-only-config`, and `phase3-cod-test-config-duplicate-recommendation-key`). The remaining six were preserved as open because the repo still appears to need that work or the status was not unambiguous.

---

### Task 2: Create repo-local Beads for all legacy issues and preserve their descriptions/context

**Bead ID:** `ee-c28`  
**SubAgent:** `primary`  
**Prompt:** For each legacy `emotion-engine/.issues/*.md` file, create a corresponding Bead in the repo-local `/.beads/` tracker with preserved title/description/context. Reflect current status where clearly known from repo state; otherwise leave open. Add notes linking back to the legacy filename during migration.

**Status:** ✅ Complete

**Results:** Created repo-local Beads corresponding to all 9 legacy issue files, preserving title/description/context and adding notes that point back to the original legacy filenames. Verified migrated Beads include both the newly open items (`ee-2fs`, `ee-5dv`, `ee-03m`, `ee-9or`, `ee-0gv`, `ee-1er`) and the closed historical items created during migration.

---

### Task 3: Verify migration completeness, remove legacy `.issues/`, and summarize the conversion

**Bead ID:** `ee-p5u`  
**SubAgent:** `primary`  
**Prompt:** Verify every legacy `.issues/*.md` file has a corresponding Bead and that no issue content was lost. Then delete the obsolete `.issues/` folder and provide a migration summary showing each old filename and its new Bead ID/status.

**Status:** ✅ Complete

**Results:** Verified migration completeness and confirmed the legacy `.issues/` folder was deleted. Spot-check verification shows the expected migrated Beads exist in the repo-local tracker, and the obsolete directory is now gone.

---

## Final Results

**Status:** ✅ Complete

**What We Built:** Migrated the legacy `emotion-engine/.issues/` folder into the repo-local Beads workflow, preserved the historical issue content in corresponding Beads, closed the clearly implemented legacy items, and removed the obsolete `.issues/` directory.

**Commits:**
- Not committed yet

**Lessons Learned:** The clean migration path is to preserve ambiguous legacy issues as open Beads rather than over-closing them, while marking only the clearly implemented historical items as closed based on current repo state.

---

*Prepared on 2026-03-12*
