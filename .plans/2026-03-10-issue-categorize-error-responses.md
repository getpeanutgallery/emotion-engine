# emotion-engine: issue — categorize error responses by type + frequency

**Date:** 2026-03-10  
**Status:** Complete
**Agent:** Cookie 🍪

---

## Goal

Add a new tracking issue in `emotion-engine/.issues/` to investigate errors from the latest cod-test run(s) and:
- collect error responses from raw artifacts/logs
- categorize by error type
- quantify frequency
- propose diagnostic improvements / remediation

Examples Derrick observed:
- `OpenRouterNoContentError`
- invalid JSON response / parse errors

---

## Tasks

### Task 1: Create issue file + commit + push

**SubAgent:** `coder`
**Prompt:** In `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine`:

1) Create a new `.issues/<name>.md` for: “Investigate and categorize error responses (type + frequency)”.

The issue should include:
- **Context:** recent runs show multiple error classes (OpenRouterNoContentError, invalid JSON, etc.), likely more.
- **Data sources to scan:**
  - `output/*/raw/_meta/events.jsonl`
  - `output/*/*/raw/_meta/errors.summary.json`
  - `output/*/*/raw/ai/**/capture.json` (and/or chunk raw artifacts)
  - `.logs/*.log` for the run
- **Proposed categorization taxonomy:** (suggested)
  - Provider transport (timeouts, network, 5xx)
  - Provider 4xx fatal (invalid model, auth)
  - Empty content / no usable content
  - Invalid JSON / schema mismatch / parse errors
  - Tooling errors (ffmpeg/ffprobe failures)
  - Config errors (missing required YAML)
  - Digital-twin replay/record anomalies (if applicable)
- **Output deliverables:**
  - a script/command to aggregate errors (e.g., `server/scripts/dev/summarize-errors.cjs`) OR a documented manual procedure
  - a markdown/json report listing types + counts + top exemplars + links to artifact paths
- **Acceptance criteria:**
  - Running aggregator on an output folder produces stable counts
  - Each category has at least one exemplar pointer
  - Recommendation section for fixes and what to log next

2) Commit with a clear message and push to `origin/main`.

Return: issue filename + commit hash.

**Status:** ✅ Complete

**Results:**
- Created issue: `.issues/investigate-recent-run-error-responses-taxonomy.md`
- Commit: `749f932` (pushed to `origin/main`)

---

## Final Results

**Status:** ⏳ In Progress
