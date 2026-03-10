# Investigate recent run error responses: categorize by type + frequency

## Goal
Gather **all error responses from the most recent runs**, categorize them by **type**, and **count frequency** so we can quickly diagnose systemic failure modes (provider issues vs. parsing vs. internal bugs) and prioritize fixes.

This is intended to answer:
- What are the most common error classes/messages?
- Which phase/target/provider is producing them?
- Are errors retryable/failover-able, or misclassified as fatal?

## Observed examples (from recent runs)
- `OpenRouterNoContentError` (provider returned no content / empty body)
- Invalid JSON response / parse error (non-JSON or truncated JSON returned where JSON was expected)

## Data sources to scan
Scan these artifacts across the latest output directories (and optionally across multiple recent runs):

1) **Event timeline**
- `output/*/raw/_meta/events.jsonl`
  - likely contains structured events for requests, retries, failures, and phase transitions

2) **Phase error summaries**
- `output/*/phase*/raw/_meta/errors.summary.json`
  - aggregate error counts (if present) and pointers to raw captures

3) **Provider request/response captures**
- `output/*/phase*/raw/ai/**/capture.json`
  - ground-truth for HTTP status, provider body, adapter metadata, request IDs, etc.

4) **Console / run logs**
- `.logs/*.log`
  - stack traces, parse errors, stderr from subprocesses, and top-level run failures

## Proposed taxonomy (categories)
Classify each error into **one primary category** and (optionally) secondary tags.

### A) Provider transport / connectivity
Examples: timeouts, connection reset, DNS failure, TLS errors.
- Fields to capture: provider, adapter, target, attempt, elapsed time

### B) Provider HTTP errors
Split by status family:
- **401/403 auth** (bad key, forbidden)
- **404/400 invalid request/model** (invalid model ID, bad payload)
- **429 rate limit / quota**
- **5xx provider outage**
- Fields: status, provider error code/message, request id

### C) Provider returned “no content”
Includes empty body, missing choices/content, null output.
- Example: `OpenRouterNoContentError`

### D) Response format / parsing errors
- Invalid JSON (truncated, non-JSON HTML, partial streaming frame)
- JSON schema mismatch (missing required fields)
- Content-type mismatch

### E) Safety / refusal / policy
Refusals, content policy blocks, safety system messages.

### F) Internal engine / pipeline errors
- Unhandled exceptions
- File I/O (missing files, permissions)
- FFmpeg failures, media decode errors
- Assertion/validation errors

### G) Classification / retry / failover policy issues
Errors that *should* be retryable/failover-able but are treated as fatal (or vice-versa).
- Output: list of candidate reclassification rules (message substrings, status codes)

## Deliverables
One of:

### Option 1: Script (preferred)
Add a small analysis tool (Node or Python) that:
- enumerates the latest `output/*` runs (or N most recent)
- parses:
  - `raw/_meta/events.jsonl`
  - `errors.summary.json`
  - `raw/ai/**/capture.json`
  - `.logs/*.log`
- emits a report with frequency counts + representative examples.

Suggested outputs:
- `output/<run>/raw/_meta/errors.report.json` (machine-readable)
- `output/<run>/raw/_meta/errors.report.md` (human-readable)
- optional `errors.report.csv` for pivoting

### Option 2: Procedure (documented manual workflow)
A documented step-by-step using `jq`/`rg` to:
- extract all error objects and normalize fields
- group by `(category, provider, status, error_class, message_signature)`
- print top N groups + file pointers to example captures

## Report format (minimum)
For each group, include:
- `count`
- `category`
- `provider` / `adapter` / `target`
- `phase` (phase1/phase2/phase3)
- `status` (if any)
- `error_class` (e.g. `OpenRouterNoContentError`)
- `message_signature` (normalized message, e.g. remove IDs)
- `example_paths[]` (paths to `capture.json` / log lines)

## Acceptance criteria
- [ ] All errors from the most recent run(s) are collected from the listed data sources.
- [ ] Each error is assigned a primary taxonomy category (A–G) and counted.
- [ ] A frequency table exists (top errors overall + by provider/phase).
- [ ] At least 1 representative artifact path is recorded per top error group (capture/log pointer).
- [ ] The report explicitly calls out occurrences of:
  - [ ] `OpenRouterNoContentError`
  - [ ] invalid JSON response / parse errors
- [ ] A short “next actions” section identifies the top 1–3 fixes (e.g., retry policy tweak, parser hardening, provider fallback).
