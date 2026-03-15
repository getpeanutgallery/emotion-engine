# peanut-gallery: local dependency refresh hygiene after polyrepo drift remediation

**Date:** 2026-03-15  
**Status:** In Progress  
**Agent:** Cookie 🍪

---

## Goal

Refresh local dependency/install state after the polyrepo drift remediation so the workspace runtime tree matches the corrected sibling-owned source layout, with no stale shimmed ownership left in local installs.

---

## Overview

The architecture remediation is complete in source control, but one non-blocking note remained: a local install tree can still carry stale `node_modules` contents from the old drifted setup. That is no longer a source-of-truth problem, but it can still confuse local verification, runtime inspection, or future agents if the installed dependency tree does not reflect the corrected polyrepo ownership model.

This cleanup should stay narrow. The goal is not another architecture pass; it is simply to refresh dependency state, verify the installed runtime tree now resolves to the correct sibling-owned packages, and document the final hygiene outcome. Because the dependency consumer is `emotion-engine`, this repo owns the coordination plan for the refresh even though the actual package sources live in sibling repos.

---

## Tasks

### Task 1: Refresh `emotion-engine` dependency install state

**Bead ID:** `ee-rid`  
**SubAgent:** `coder`  
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, refresh local dependency/install state so node_modules reflects the corrected sibling polyrepo ownership model. Inspect package.json/package-lock.json, reinstall or refresh dependencies as needed using the repo's existing package manager workflow, and verify that stale local shimmed ownership patterns are gone from the install tree. Keep changes bounded to dependency refresh hygiene, not architecture redesign. Update the active plan with actual files touched/results, commit any durable repo changes to main, and report exact validation performed.`

**Folders Created/Deleted/Modified:**
- `node_modules/`
- `.plans/`

**Files Created/Deleted/Modified:**
- `.plans/2026-03-15-local-dependency-refresh-hygiene.md`
- `package.json` (inspected only; no durable change)
- `package-lock.json` (inspected only; no durable change)

**Status:** ✅ Complete

**Results:** Claimed bead `ee-rid`, inspected `package.json` / `package-lock.json`, confirmed the repo already depends on sibling polyrepo packages via `git+ssh` URLs rather than `file:` / `link:` / `workspace:` seams, then rebuilt the local install tree with `npm ci`. Validation after reinstall showed the corrected ownership model in the installed tree: top-level `ai-providers`, `retry-strategy`, `tools`, `goals`, and `cast` all resolved from GitHub `git+ssh`, `tools` deduped to the same installed `ai-providers`, and `ai-providers` pulled `digital-twin-router` / `digital-twin-core` from GitHub `git+ssh` as well. A direct scan of installed manifests found no stale local shimmed ownership patterns and no symlinked seam packages under `node_modules/`. `package-lock.json` remained unchanged; the only durable repo change from Task 1 is this plan update, committed on `main` with message `docs: record dependency refresh hygiene results`.

---

### Task 2: Verify installed runtime ownership visibility

**Bead ID:** `Pending`  
**SubAgent:** `primary`  
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, verify that the refreshed local install tree reflects the corrected ownership model. Check the installed tools/ai-providers/digital-twin surfaces actually resolve as expected, confirm no stale local shim or hidden local mirror remains in the install tree for the corrected seams, and document the final hygiene result in the active plan. Commit any final doc/plan updates to main and report the verification findings.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `docs/` if needed

**Files Created/Deleted/Modified:**
- `.plans/2026-03-15-local-dependency-refresh-hygiene.md`
- `docs/` if needed

**Status:** ⏳ Pending

**Results:** Pending.

---

## Proposed execution order

1. Refresh the local dependency/install tree
2. Verify installed runtime ownership visibility

---

## Final Results

**Status:** ⏳ Pending

**What We Built:** Pending.

**Commits:**
- Pending.

**Lessons Learned:** Pending.

---

*Confirmed by Derrick on 2026-03-15: proceed with planning and execution for local dependency refresh hygiene after the polyrepo remediation.*