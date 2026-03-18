---
plan_id: plan-2026-03-10-issue-openrouter-errors-debugging-alignment
---
# emotion-engine: issue — align OpenRouter error/debug handling with official guide (unified shape)

**Date:** 2026-03-10  
**Status:** Complete
**Agent:** Cookie 🍪

---

## Goal

Add a new tracking issue in `emotion-engine/.issues/` to evaluate our current OpenRouter error + debugging capture and improve it by comparing against OpenRouter’s official reference:
- https://openrouter.ai/docs/api/reference/errors-and-debugging.md

Constraints:
- We must normalize *all* adapter errors/debug (OpenRouter, Anthropic, OpenAI, Gemini, etc.) into our unified error/debug body shape.

---

## Tasks

### Task 1: Create issue file + commit + push

**SubAgent:** `coder`
**Prompt:** In `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine`:

1) Create a new issue file under `.issues/` (name it appropriately) with:

- **Context:** We rely heavily on OpenRouter; we need high-quality diagnostics, but our system also supports multiple adapters, so we must maintain a unified debug/error schema.
- **Reference:** Link and summarize key points from OpenRouter errors+debugging guide: https://openrouter.ai/docs/api/reference/errors-and-debugging.md
  - Identify what fields OpenRouter returns for errors
  - What headers/request IDs/debug hints exist (if any)
  - Best practices recommended by OpenRouter (retry semantics, logging, etc.)
- **Current state in our stack:** Call out likely locations:
  - `ai-providers` OpenRouter adapter error mapping / debug capture
  - emotion-engine raw capture (`raw/ai/**/capture.json`, `errors.summary.json`, `events.jsonl`)
  - our unified error/debug shape expectations (what we store and where)
- **Gap analysis:** List mismatches vs the official guide (missing fields, missing request ID, missing response body for 4xx/5xx, redaction, etc.).
- **Proposed improvements:** while preserving unified shape:
  - Add/ensure canonical fields in unified debug body (suggest exact keys)
  - Include OpenRouter-specific subobject (namespaced) only if needed, without breaking other adapters
  - Ensure sanitization/redaction rules
  - Ensure errors are categorized correctly (fatal vs retryable) consistent with OpenRouter guide
- **Acceptance criteria:**
  - For an induced OpenRouter error, we can inspect unified debug payload and see: status, provider error code/message, request id (if present), redacted request meta, redacted response body, and classification.
  - Comparable fields exist for other adapters too.

2) Commit with message like `chore(issues): track openrouter error/debug alignment` and push to `origin/main`.

Return: issue filename + commit hash.

**Status:** ⏳ Pending

---

## Final Results

**Status:** ⏳ In Progress
