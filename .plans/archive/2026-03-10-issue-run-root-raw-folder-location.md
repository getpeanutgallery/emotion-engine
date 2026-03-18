---
plan_id: plan-2026-03-10-issue-run-root-raw-folder-location
---
# emotion-engine: issue — run root `raw/` folder location

**Date:** 2026-03-10  
**Status:** Complete
**Agent:** Cookie 🍪

---

## Goal

Add a new issue in `emotion-engine/.issues/` to investigate why we generate a `raw/` folder at the root of a run (e.g. `output/cod-test/raw/`) and determine whether raw/debug data should instead live under a more structured parent (assets/phase1/phase2/phase3).

---

## Tasks

### Task 1: Create issue + commit + push

**SubAgent:** `coder`
**Prompt:** In `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine`:

1) Create `.issues/<name>.md` that captures:
- **Observation:** run root `output/<runId>/raw/` exists (example: `output/cod-test/raw/`).
- **Hypothesis/concern:** raw should live under structured parents (`assets`, `phase1-gather-context`, `phase2-process`, `phase3-report`). Root-level raw may be confusing.
- **Investigation tasks:**
  - identify which code path writes to run-root raw (likely the raw meta/event bus, global capture, or legacy path)
  - list what data currently lands there (e.g., `raw/_meta/events.jsonl`, tool version capture, global errors summary)
  - evaluate alternatives:
    - move to `output/<runId>/_meta/` (preferred)
    - or `output/<runId>/raw/_meta/` but keep phase raw elsewhere
    - or per-phase only with a top-level index file
  - ensure links/pointers remain stable (`events.jsonl`, reports, docs)
  - migration plan for existing runs and docs
- **Acceptance criteria:**
  - Clear decision on canonical location
  - Implementation plan that keeps backward compatibility only if desired; otherwise a clean break

2) Commit and push to `origin/main`.

Return issue filename + commit hash.

**Status:** ⏳ Pending

---

## Final Results

**Status:** ⏳ In Progress
