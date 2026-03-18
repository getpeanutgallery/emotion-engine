---
plan_id: plan-2026-03-13-sibling-repo-debug-failure-capture-sweep
bead_ids:
  - ee-sxq
---
# emotion-engine: extend normalized debug/failure capture across sibling repos

**Date:** 2026-03-13  
**Status:** Complete  
**Agent:** Cookie 🍪

---

## Goal

Audit the relevant sibling polyrepo codebases for AI raw-capture/error persistence that still relies on narrow `error.response.*` assumptions, then extend the normalized debug/failure capture pattern proven in emotion-engine where appropriate.

---

## Overview

`ee-1er` closed the observability gap inside emotion-engine itself by normalizing persisted AI failure metadata from either direct transport errors or adapter-provided `error.debug` fallback fields. This sweep checked the nearby peanut-gallery repos that actually sit on the same provider/adapter path and could still lose useful error metadata when errors are wrapped.

The audit showed the highest-value remaining gap was not in `ai-providers` itself — that repo already has the unified debug payload tests — but in the **digital twin recording/replay layer** that sits beneath provider transport tests and fixtures. `digital-twin-router` was still recording cassette error payloads mainly from `err.response` / `err.status`, which meant wrapped provider failures could lose normalized status, request id, classification, and structured provider error body when persisted. `digital-twin-core` also had a smaller CLI visibility gap for replay output. The other nearby repos either had no AI-error persistence code, or were cassette/data packs rather than logic repos.

---

## Audit Inventory

### Repos audited

- `../ai-providers`
  - Relevant because it owns the provider adapter debug shape.
  - Findings: already has explicit debug-preservation coverage in:
    - `test/provider-debug.test.cjs`
    - `test/openrouter-transformResponse.test.cjs`
  - Patch needed: **no** — this lane’s normalized debug payload already exists there.

- `../digital-twin-router`
  - Relevant because it records provider transport failures into reusable cassettes and rethrows them during replay.
  - Findings: **yes, patch needed**.
  - Concrete gap before patch:
    - `index.js` `buildRecordedErrorResponse(...)` relied on direct `err.response` / `err.status` for persisted status/response capture.
    - Wrapped provider failures with only `err.debug.response` / `err.debug.providerError` would lose first-class persisted fields.
    - `rethrowRecordedError(...)` did not restore normalized `requestId`, `response`, or `aiTargets.classification` onto replayed errors.

- `../digital-twin-core`
  - Relevant because the CLI is used to inspect replay outcomes.
  - Findings: small visibility gap only.
  - Concrete gap before patch:
    - `bin/cli.js` printed `responseStatus` from `result.response?.status` only.
    - Recorded error payloads could therefore show `null` even when the cassette error object had a persisted status.

- `../digital-twin-emotion-engine-providers`
  - Relevant as a twin/cassette pack.
  - Findings: no logic path to patch; package is data/manifest/tests only.

- `../digital-twin-openrouter-emotion-engine`
  - Relevant as a twin/cassette pack wrapper.
  - Findings: no normalized persisted-error logic of its own that needed patching in this lane.

- `../cast`, `../goals`, `../retry-strategy`, `../tools`
  - Audited for obvious sibling AI error/raw-capture persistence hooks.
  - Findings: no direct narrow `error.response`-based raw-capture persistence matching this lane.

---

## Tasks

### Task 1: Identify sibling repos and files that share the same AI/error-capture patterns

**Bead ID:** `ee-sxq`  
**SubAgent:** `main`

**Files Created/Deleted/Modified:**
- `.plans/2026-03-13-sibling-repo-debug-failure-capture-sweep.md`

**Status:** ✅ Complete

**Results:**
- Audited the sibling peanut-gallery repos most likely to share emotion-engine’s provider/adapter/debug stack.
- Confirmed `ai-providers` already owns the normalized adapter debug payload and did **not** need a fresh patch in this lane.
- Identified the highest-value remaining narrow-persistence assumptions in:
  - `../digital-twin-router/index.js`
  - `../digital-twin-core/bin/cli.js`
- Confirmed the other nearby repos in scope were not the right patch targets for this specific observability gap.

---

### Task 2: Extend normalized persisted-error capture in the highest-value sibling locations

**Bead ID:** `ee-sxq`  
**SubAgent:** `main`

**Files Created/Deleted/Modified:**
- `../digital-twin-router/index.js`
- `../digital-twin-router/test/index.test.js`
- `../digital-twin-core/bin/cli.js`
- `.plans/2026-03-13-sibling-repo-debug-failure-capture-sweep.md`

**Status:** ✅ Complete

**Results:**
- Patched `digital-twin-router/index.js` to normalize persisted recorded-error metadata from either:
  - `err.response.*`
  - `err.debug.response.*`
  - `err.debug.providerError.*`
  - `err.aiTargets.classification`
- Added router-side helpers mirroring emotion-engine’s proven fallback approach:
  - status extraction
  - request-id extraction
  - debug-body JSON parsing
  - structured provider-error synthesis
  - normalized response persistence
- `buildRecordedErrorResponse(...)` now persists first-class:
  - `error.status`
  - `error.requestId`
  - `error.classification`
  - `error.response`
  - `error.debug.response`
  even when the original thrown error lacks `error.response`.
- `rethrowRecordedError(...)` now restores normalized replay-time fields onto the thrown error:
  - `err.requestId`
  - `err.response`
  - `err.aiTargets.classification`
- Patched `digital-twin-core/bin/cli.js` so replay inspection reports `responseStatus` from recorded error payloads instead of only direct response objects.
- Added focused coverage in `digital-twin-router/test/index.test.js` for:
  - recording normalized metadata from debug fallback only
  - replay restoring request id / classification / structured response fields

---

### Task 3: Verify, document boundaries, and leave explicit follow-up if the sweep is incomplete

**Bead ID:** `ee-sxq`  
**SubAgent:** `main`

**Files Created/Deleted/Modified:**
- `.plans/2026-03-13-sibling-repo-debug-failure-capture-sweep.md`

**Status:** ✅ Complete

**Results:**
- Verification run in `../digital-twin-router`:
  - `node --test test/*.test.js`
  - Result: **28 passed / 0 failed**
- Verification run in `../digital-twin-core`:
  - `node --test test/*.test.js`
  - Result: **26 passed / 0 failed**
- Clear completed-vs-remaining boundary:
  - **Completed in this lane:** normalized persisted debug/failure capture at the sibling recording/replay layer (`digital-twin-router`) plus replay inspection visibility (`digital-twin-core` CLI).
  - **Already complete before this lane:** normalized adapter debug payload coverage in `ai-providers`.
  - **Not expanded in this lane:** cassette-pack repos and non-provider utility repos, because they do not own the narrow error persistence gap this bead targeted.

---

## Success Criteria

- ✅ We identified the real sibling repos/files that still needed the debug/failure capture upgrade.
- ✅ We patched the highest-value shared-pattern locations rather than guessing blindly.
- ✅ We verified changed sibling repo locations where practical.
- ✅ We left a clear boundary between what was completed and what remains.

---

## Constraints

- Did **not** pretend the entire polyrepo needed editing.
- Reused the same normalized persisted-error concepts proven in emotion-engine, adapted to sibling repo boundaries.
- Did **not** start a golden run.

---

## Final Results

**Status:** ✅ Complete

**What We Built:**
- A sibling-repo rollout of normalized persisted provider failure metadata for the digital twin recording/replay layer.
- Recorded cassette errors now preserve status, request id, classification, and structured provider error bodies even when upstream adapters wrap errors and omit `error.response`.
- Replayed recorded errors now rehydrate that normalized metadata back onto thrown errors for downstream consumers and tests.

**Files Changed:**
- `../digital-twin-router/index.js`
- `../digital-twin-router/test/index.test.js`
- `../digital-twin-core/bin/cli.js`
- `.plans/2026-03-13-sibling-repo-debug-failure-capture-sweep.md`

**Verification:**
- `cd ../digital-twin-router && node --test test/*.test.js`
- `cd ../digital-twin-core && node --test test/*.test.js`

**Commits:**
- None in this subagent lane.

**Remaining / Not Done Here:**
- No additional sibling repo currently showed the same narrow persisted-error gap at a higher value than the digital twin layer.
- If future sibling repos start persisting AI failure artifacts directly, they should adopt the same normalized fallback helpers instead of reading only `error.response.*`.

**Lessons Learned:**
- The next most important place after adapter normalization is the layer that records and replays those adapter failures. If that layer persists only transport-native fields, the observability win from adapter normalization gets lost in fixtures/cassettes.

---

*Completed on 2026-03-13*
