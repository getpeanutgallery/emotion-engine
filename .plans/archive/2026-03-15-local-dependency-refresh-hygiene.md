# peanut-gallery: local dependency refresh hygiene after polyrepo drift remediation

**Date:** 2026-03-15  
**Status:** Complete  
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

**Bead ID:** `ee-06k`  
**SubAgent:** `primary`  
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, verify that the refreshed local install tree reflects the corrected ownership model. Check the installed tools/ai-providers/digital-twin surfaces actually resolve as expected, confirm no stale local shim or hidden local mirror remains in the install tree for the corrected seams, and document the final hygiene result in the active plan. Commit any final doc/plan updates to main and report the verification findings.`

**Folders Created/Deleted/Modified:**
- `.plans/`

**Files Created/Deleted/Modified:**
- `.plans/2026-03-15-local-dependency-refresh-hygiene.md`

**Status:** ✅ Complete

**Results:** Claimed bead `ee-06k` and verified the refreshed runtime tree from the installed artifacts rather than source assumptions. `npm ls --all` showed the expected ownership chain: top-level `tools`, `ai-providers`, `retry-strategy`, `goals`, and `cast` resolve from GitHub `git+ssh`, `tools` consumes the same deduped top-level `ai-providers`, `ai-providers` consumes `digital-twin-router`, and `digital-twin-router` consumes `digital-twin-core`. Direct `require.resolve(.../package.json)` and `fs.realpathSync()` checks confirmed those surfaces resolve to real directories under `emotion-engine/node_modules/` rather than sibling repo paths or symlink shims, and direct `require()` checks loaded the expected exported APIs for `tools`, `ai-providers`, `digital-twin-router`, and `digital-twin-core`. `npm run test:providers:check` also passed, confirming the installed digital-twin-facing test surface still resolves against the expected cassette-pack convention. A targeted sweep of `package-lock.json`, installed package manifests, and directory structure found no `file:` / `link:` / `workspace:` seams, no workspace-relative paths, no hidden duplicate copies of the corrected seam packages, and no symlinked local mirror for `tools`, `ai-providers`, `digital-twin-router`, `digital-twin-core`, `retry-strategy`, `goals`, or `cast`. Non-blocking note: this verification confirms installed ownership visibility and resolution hygiene, but it does not attempt a live provider call or introduce any new remediation work.

---

## Proposed execution order

1. Refresh the local dependency/install tree
2. Verify installed runtime ownership visibility

---

## Final Results

**Status:** ✅ Complete

**What We Built:** Refreshed and verified the local `emotion-engine` install/runtime tree so the installed dependency ownership now visibly matches the corrected polyrepo model. The durable repo artifact is the completed hygiene plan documenting both the reinstall validation and the follow-up runtime ownership verification.

**Commits:**
- `dc60935` - docs: record dependency refresh hygiene results
- `278bc8b` - docs: polish dependency hygiene final results

**Lessons Learned:** For this polyrepo seam, the lockfile and source manifests were already correct; the meaningful post-remediation risk was stale local install state. The fastest trustworthy hygiene proof was a three-part check: dependency graph (`npm ls`), actual runtime resolution (`require.resolve` + `realpath` + `require()`), and a stale-shim sweep for `file:` / `link:` / `workspace:` or symlinked mirrors. Non-blocking note: no further remediation is needed from this pass, but runtime hygiene verification should stay distinct from any future live-provider behavior debugging.

---

*Confirmed by Derrick on 2026-03-15: proceed with planning and execution for local dependency refresh hygiene after the polyrepo remediation.*