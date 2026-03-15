# emotion-engine: remove legacy run-root raw compatibility

**Date:** 2026-03-15  
**Status:** In Progress  
**Agent:** Cookie 🍪

---

## Goal

Remove the temporary legacy compatibility for old run-root `raw/` metadata paths now that the canonical `_meta/` layout is implemented and verified.

---

## Overview

The `_meta/` cutover for run-level metadata is done and verified. Right now the code still tolerates legacy prompt-store paths like `raw/ai/_prompts/...` on read, and the docs acknowledge older `raw/`-based run-root metadata as historical. Derrick wants to remove that compatibility instead of carrying legacy cruft forward.

This is a bounded follow-up, not a new architecture pass. The job is to remove old compatibility branches, make `_meta/` the only supported runtime path, update docs/tests accordingly, and verify that no current code/tests still rely on the old layout. Historical artifacts on disk can remain as historical outputs, but active runtime code should stop treating the old paths as valid current inputs.

The owning repo is `emotion-engine`, because the compatibility logic, docs, tests, and runtime readers all live here.

---

## Tasks

### Task 1: Identify and remove legacy run-root raw compatibility code

**Bead ID:** `ee-0ok`  
**SubAgent:** `coder`  
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, claim the assigned bead immediately. Identify all remaining runtime/doc/test compatibility for legacy run-root raw metadata paths (`raw/_meta/...`, `raw/ai/_prompts/...`) and remove it so `_meta/...` is the only supported runtime layout. Keep the change bounded to this compatibility removal. Update docs/tests as needed, update this plan with exact files changed and validation evidence, commit to main, and close the bead.`

**Folders Created/Deleted/Modified:**
- `server/lib/`
- `docs/`
- `test/`
- `.plans/`

**Files Created/Deleted/Modified:**
- `server/lib/prompt-store.cjs`
- `server/lib/events-timeline.cjs`
- `test/lib/prompt-store.test.js`
- `README.md`
- `docs/DEBUG-CONFIG.md`
- `docs/CONFIG-GUIDE.md`
- `docs/PIPELINE-SCRIPTS.md`
- `.plans/2026-03-15-remove-legacy-run-root-raw-compat.md`

**Status:** ✅ Complete

**Results:** Removed the remaining runtime compatibility branch for legacy run-root prompt refs by making `loadPromptPayload()` accept only canonical `_meta/ai/_prompts/<sha>.json` refs and deleting the legacy alias conversion helpers. Also removed remaining source/doc references that described `raw/_meta/events.jsonl` and `raw/ai/_prompts/...` as supported historical runtime paths.

Validation evidence:
- `node --test test/lib/prompt-store.test.js` → 3/3 passing, including a regression that legacy `raw/ai/_prompts/...` refs are now rejected.
- `grep -RInE "raw/_meta/events\\.jsonl|raw/ai/_prompts" README.md docs server test || true` after the change only reports the negative test fixture in `test/lib/prompt-store.test.js`; no runtime or docs compatibility references remain.

---

### Task 2: Verify `_meta/` is now the only supported runtime path

**Bead ID:** `ee-1i5`  
**SubAgent:** `primary`  
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, claim the assigned bead immediately after Task 1. Verify that `_meta/...` is now the only supported runtime path for run-level metadata/prompt refs, that docs/tests match the code, and that no active behavior still depends on legacy `raw/...` compatibility. Update this plan with exact evidence, state any caveats, and close the bead.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- optionally docs if a tiny final truth note is needed

**Files Created/Deleted/Modified:**
- `.plans/2026-03-15-remove-legacy-run-root-raw-compat.md`

**Status:** ⏳ Pending

**Results:** Pending.

---

## Intended execution order

1. Task 1 — remove legacy runtime compatibility
2. Task 2 — verify `_meta/` is the only supported path

Task 2 depends on Task 1.

---

## Constraints

- Keep scope bounded to legacy-path compatibility removal.
- Do not reopen the larger `_meta/` layout decision itself.
- Historical outputs on disk may still exist; the target here is active runtime support, docs, and tests.
- Avoid breaking current canonical `_meta/` behavior.

---

## Final Results

**Status:** ⏳ Pending

**What We Built:** Pending.

**Commits:**
- Pending.

**Lessons Learned:** Pending.

---

*Drafted on 2026-03-15*