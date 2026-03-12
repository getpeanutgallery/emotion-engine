# emotion-engine: remove recommendation fallback to video targets (hard fail when missing)

**Date:** 2026-03-10  
**Status:** Superseded (draft not executed)
**Agent:** Cookie 🍪

---

## Goal

Eliminate the hack in `server/scripts/report/recommendation.cjs` where `ai.video.targets` is used as an implicit fallback when `ai.recommendation.targets` is missing.

New behavior:
- **Hard fail** with clear debug/audit trail if `ai.recommendation.targets` is missing or empty.
- No implicit assumptions.
- Update configs that include the recommendation script (at least `configs/cod-test.yaml`) to add an explicit `ai.recommendation.targets` list.
- Prefer early validation (config-loader) when feasible.

---

## Tasks

### Task 1: Implement hard-fail + update configs/docs/tests

**SubAgent:** `coder`
**Prompt:** In `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine`:

1) Remove/disable the `getConfigForRecommendation()` fallback that copies `ai.video.targets` into `ai.recommendation.targets`.
2) Add explicit validation:
   - In `recommendation.cjs`: if `config.ai.recommendation.targets` is missing/empty, throw a clear fatal error.
   - Ensure the failure still writes useful raw/meta artifacts + emits events (audit trail).
3) Optionally (preferred): add schema validation in `server/lib/config-loader.cjs` so that when the recommendation script is included in `report`, `ai.recommendation.targets` is required.
4) Update `configs/cod-test.yaml` to include an explicit `ai.recommendation.targets` (model list can be basic placeholders; Derrick will tune models).
   - Also fix the currently-invalid video model slug if present (`qwen/qwen-3.5-...` → `qwen/qwen3.5-...`) to keep cod-test runnable.
5) Update docs to remove mention of inheritance and document requirement.
6) Run tests (or at least config validation) and ensure repo is clean.
7) Commit + push to `origin/main`.

Return: commit hash, files changed, and any follow-up notes.

**Status:** ⏳ Pending

---

## Final Results

**Status:** ⏳ Draft
