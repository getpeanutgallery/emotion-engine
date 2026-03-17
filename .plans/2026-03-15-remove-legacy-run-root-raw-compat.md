---
plan_id: plan-2026-03-15-remove-legacy-run-root-raw-compat
bead_ids:
  - ee-0ok
  - ee-1i5
---
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

**Status:** ✅ Complete

**Results:** Verified `_meta/...` is now the only supported run-level runtime path.

Exact evidence:
- Runtime writers are canonical-only:
  - `server/lib/events-timeline.cjs:97` writes the run timeline only to `path.join(runOutputDir, '_meta', 'events.jsonl')`.
  - `server/lib/prompt-store.cjs:21-24,51,72-75` defines `CANONICAL_PROMPT_PREFIX = '_meta/ai/_prompts/'`, stores prompt payloads under `output/<run>/_meta/ai/_prompts/`, and returns canonical `promptRef.file` values.
- Runtime readers reject legacy run-root prompt refs:
  - `server/lib/prompt-store.cjs:90-93` throws unless `promptRef.file` starts with `_meta/ai/_prompts/`.
  - `test/lib/prompt-store.test.js:47-63` is an explicit regression test that a legacy `raw/ai/_prompts/legacy.json` ref is rejected.
- Docs/tests match the code:
  - Canonical `_meta/...` docs now appear in `README.md:236-237`, `docs/DEBUG-CONFIG.md:124-137`, `docs/CONFIG-GUIDE.md:346`, and `docs/PIPELINE-SCRIPTS.md:76-78`.
  - `git grep -nE 'raw/_meta/events\\.jsonl|raw/ai/_prompts' -- README.md docs server test ':(exclude).plans/**'` now reports only `test/lib/prompt-store.test.js:51` (the negative legacy-fixture test). No runtime code or shipped docs still advertise legacy run-root `raw/...` support.
  - `test/lib/script-contract.test.js:78-93` asserts canonical `_meta/ai/_prompts/abc.json` capture refs.
- Validation run:
  - `node --test test/lib/prompt-store.test.js test/lib/script-contract.test.js` → 13/13 passing.

Caveats:
- Historical markdown plan files in `.plans/` still mention old run-root `raw/...` paths as part of prior work history; that is documentation history, not active runtime behavior.
- Phase-scoped debug/error artifacts under `phase*/raw/_meta/...` remain valid and are intentionally unaffected; this verification is specifically about run-level metadata/prompt refs.

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

**Status:** ✅ Complete

**What We Built:** Verified the legacy run-root `raw/...` compatibility removal is complete: run-level metadata now lives only under `_meta/events.jsonl` and `_meta/ai/_prompts/<sha>.json`, runtime prompt loading rejects legacy `raw/ai/_prompts/...` refs, and shipped docs/tests consistently describe/assert the canonical `_meta/...` layout.

**Commits:**
- None in this verification task; updated the active plan with exact evidence.

**Lessons Learned:** The clean cutoff is now explicit in code and tests. The only remaining `raw/...` mentions tied to run-level history are archived plan notes, while live phase-scoped `phase*/raw/_meta/...` debugging remains a separate and still-valid contract.

---

*Drafted on 2026-03-15*