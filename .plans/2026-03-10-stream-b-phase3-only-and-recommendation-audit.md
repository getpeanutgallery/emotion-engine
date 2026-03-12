# emotion-engine: Stream B (Phase3-only config) + recommendation.cjs audit

**Date:** 2026-03-10  
**Status:** Superseded
**Agent:** Cookie 🍪

---

## Goal

1) Execute Stream B first: add a Phase3-only config + docs so we can iterate Phase3 without re-running Phase1/2.
2) In parallel, get a clear summary of what `server/scripts/report/recommendation.cjs` currently does and how it selects AI targets/models (and whether it’s stale vs our newer targets schema).

---

## Tasks

### Task 1: Implement Phase3-only cod-test config + docs

**SubAgent:** `coder`
**Prompt:** In `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine`:
- Implement the Phase3-only iteration workflow described in `.issues/cod-test-phase3-only-config.md`.
- Add `configs/cod-test-phase3.yaml` (or the filename you believe is best) that:
  - sets `gather_context: []`
  - sets `process: []`
  - sets `report:` to Phase3 scripts we actually want (list them explicitly)
  - sets `asset.outputDir: output/cod-test` (reuses an existing run folder)
  - includes required `ai.*.targets` blocks needed by Phase3 scripts (at minimum `ai.recommendation.targets` if recommendation runs; otherwise explain)
- Update docs (CONFIG-GUIDE.md and/or README) with a “Phase3-only iteration” section and digital-twin replay notes.
- Add any guardrails needed (e.g., if required inputs missing, fail early with a clear error).
- Commit + push to `origin/main`.

Return: commit hash, files changed, and the exact command to run Phase3-only.

**Status:** ⏳ Pending

---

### Task 2: Summarize current recommendation.cjs behavior + config expectations

**SubAgent:** `coder`
**Prompt:** In `emotion-engine`, summarize:
- How `server/scripts/report/recommendation.cjs` determines which provider/model to call.
- Whether it uses `executeWithTargets({ domain: 'recommendation' })` and what YAML keys it expects (`ai.recommendation.targets`, retry, params, etc.).
- Confirm whether `configs/cod-test.yaml` currently defines `ai.recommendation.targets`; if not, what happens at runtime (fallback? error? legacy path?).
- Identify any stale/legacy logic and recommend whether it needs a rewrite.

Return: concise findings + suggested next change.

**Status:** ⏳ Pending

---

## Final Results

**Status:** ⏳ In Progress
