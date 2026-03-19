# emotion-engine: remove node_modules hack and refresh deps properly

**Date:** 2026-03-18
**Status:** Partial
**Agent:** Cookie 🍪

---

## Goal

Remove the local `node_modules` runtime repoint hack, refresh `emotion-engine` dependencies through the proper polyrepo workflow, and verify that record-mode `cod-test` still lands its cassette in the canonical sibling `cassettes/` directory using a clean installed dependency path.

---

## Overview

I made the wrong move by repointing `emotion-engine` runtime resolution directly inside `node_modules`. That proved behavior on this machine, but it bypassed the intended polyrepo flow Derrick wants and does not create a durable install story. The canonical fix already lives in the sibling source repo `digital-twin-router`; `emotion-engine` should consume that fix by refreshing its installed dependencies, not by hand-editing or symlinking its install tree.

This correction plan is intentionally bounded and ordered. First, remove the local runtime hack so the workspace no longer relies on manual `node_modules` surgery. Second, refresh `emotion-engine` dependencies cleanly so the installed tree reflects the updated sibling source in the intended way. Third, verify resolution/runtime behavior from the clean install and rerun `cod-test` in true record mode to confirm the resulting cassette still lands in the canonical `digital-twin-openrouter-emotion-engine/cassettes/` directory.

The owning repo is `emotion-engine`, because the dependency refresh, runtime verification, and rerun all happen there. The sibling `digital-twin-router` source fix is already committed and pushed; this plan is about consuming it correctly.

---

## Tasks

### Task 1: Remove the local node_modules runtime repoint hack

**Bead ID:** `ee-3dl`
**SubAgent:** `main`
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, inspect the current local node_modules repoint/symlink hack used to force digital-twin-router resolution, remove that local hack cleanly, and verify the workspace is no longer relying on manual node_modules surgery. Update this plan with exact paths removed and the resulting resolution state. Claim the assigned bead on start and close it on completion.`

**Folders Created/Deleted/Modified:**
- `emotion-engine/node_modules/`
- `.plans/`

**Files Created/Deleted/Modified:**
- `emotion-engine/node_modules/digital-twin-router` (removed symlink)
- `emotion-engine/node_modules/ai-providers/node_modules/digital-twin-router` (removed symlink)
- `.plans/2026-03-18-remove-node-modules-hack-and-refresh-deps-properly.md`

**Status:** ✅ Complete

**Results:** Claimed bead `ee-3dl`, inspected the local runtime hack, and confirmed it consisted of exactly two manual symlinks inside the install tree: `emotion-engine/node_modules/digital-twin-router -> ../../digital-twin-router` and `emotion-engine/node_modules/ai-providers/node_modules/digital-twin-router -> /home/derrick/.openclaw/workspace/projects/peanut-gallery/digital-twin-router`. Before removal, both paths resolved to the sibling repo `../digital-twin-router`, and both direct engine-context resolution (`require.resolve('digital-twin-router/package.json')`) and provider-context resolution (`createRequire(require.resolve('ai-providers/package.json')).resolve('digital-twin-router/package.json')`) pointed at that sibling source path instead of an installed package copy.

Removed both symlinks cleanly with `unlink`, without touching manifests or doing the dependency refresh yet. After removal, a targeted scan under `node_modules` found no remaining `digital-twin-router` repoint/symlink entries, direct engine-context resolution now fails with `MODULE_NOT_FOUND`, provider-context resolution from `ai-providers` also fails with `MODULE_NOT_FOUND`, and `npm ls digital-twin-router --all` returns an empty tree. Resulting state: this workspace is no longer relying on manual `node_modules` surgery, but `digital-twin-router` is currently absent from the installed runtime until Task 2 performs the proper dependency refresh.

---

### Task 2: Refresh emotion-engine dependencies the proper way

**Bead ID:** `ee-83m`
**SubAgent:** `main`
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, refresh the installed dependencies through the intended polyrepo workflow so the updated sibling digital-twin-router source is consumed cleanly by emotion-engine without manual node_modules edits. Document the exact install/refresh method used, verify the installed resolution path, and update this plan with the truthful results. Claim the assigned bead on start and close it on completion.`

**Folders Created/Deleted/Modified:**
- `emotion-engine/`
- `emotion-engine/node_modules/`
- lock/install artifacts if the proper refresh changes them
- `.plans/`

**Files Created/Deleted/Modified:**
- `package.json`
- `package-lock.json`
- `.plans/2026-03-18-remove-node-modules-hack-and-refresh-deps-properly.md`

**Status:** ✅ Complete

**Results:** Claimed bead `ee-83m` and refreshed the dependency through a manifest-driven Git SSH install path instead of restoring any local symlink hack. The blocker I found first was that `emotion-engine` itself only pins `ai-providers` to commit `1a6dc181d646fe350ac2acc248f7036ef9a71bae`, and that installed `ai-providers` commit still declares `digital-twin-router` as `git+ssh://git@github.com/getpeanutgallery/digital-twin-router.git#2760977`, which does not include the sibling router fix now published at `770313a5e3bcab42cb380b3da28501d975aca031`. To consume the pushed router fix cleanly from this repo without hand-editing `node_modules`, I added a root-level npm override in `emotion-engine/package.json` forcing `digital-twin-router` to `git+ssh://git@github.com/getpeanutgallery/digital-twin-router.git#770313a5e3bcab42cb380b3da28501d975aca031`, then ran a plain `npm install` from the repo root.

This refresh changed durable manifests/lock state, not just the install tree: `package.json` now carries the explicit `overrides.digital-twin-router` entry, `package-lock.json` now resolves `node_modules/digital-twin-router` to commit `770313a5e3bcab42cb380b3da28501d975aca031`, and `node_modules/` was rebuilt accordingly. Verification after refresh: `npm ls digital-twin-router --all` shows `ai-providers@1.0.0` consuming `digital-twin-router@1.0.0` from Git SSH commit `770313a5e3bcab42cb380b3da28501d975aca031`; both direct engine-context resolution and provider-context resolution now point to the same real installed path `emotion-engine/node_modules/digital-twin-router/package.json` (not a sibling checkout and not a symlink); and a targeted content check on `node_modules/digital-twin-router/index.js` confirms the old `hasCassettes` gate is gone while the new existing-`cassettes/` directory preference is present. Result: `emotion-engine` now consumes the pushed router fix through a clean manifest+lockfile-driven install flow, with no manual `node_modules` surgery remaining.

---

### Task 3: Verify clean resolution and rerun record mode

**Bead ID:** `ee-l92`
**SubAgent:** `main`
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, after removing the local node_modules hack and refreshing dependencies properly, verify the installed digital-twin-router resolution path and behavior, then rerun node server/run-pipeline.cjs --config configs/cod-test.yaml --verbose in true record mode and confirm the resulting cassette lands in the canonical sibling cassettes/ directory. Update this plan with exact resolution evidence, runtime env, artifact paths, and outcome, then close the assigned bead.`

**Folders Created/Deleted/Modified:**
- `emotion-engine/output/`
- sibling cassette pack path
- `.plans/`

**Files Created/Deleted/Modified:**
- fresh `output/cod-test/**`
- new cassette artifact(s)
- `.plans/2026-03-18-remove-node-modules-hack-and-refresh-deps-properly.md`

**Status:** ❌ Blocked

**Results:** Claimed bead `ee-l92` and verified that the clean post-refresh runtime resolves `digital-twin-router` from the installed dependency tree, not from a sibling checkout and not from any symlink. Direct engine-context resolution and provider-context resolution both point at the same real installed file: `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/node_modules/digital-twin-router/package.json`; `fs.realpathSync(...)` returns that exact same path for both; and `package-lock.json` resolves that installed package to `git+ssh://git@github.com/getpeanutgallery/digital-twin-router.git#770313a5e3bcab42cb380b3da28501d975aca031`. A targeted code check on `node_modules/digital-twin-router/index.js` also confirms the old `hasCassettes` gate is absent and the canonical `cassettes/`-directory preference branch is present at the installed path (`index.js:399-408`).

Confirmed the runtime env was set for true digital-twin recording using the intended sibling pack before launch. Repo-local `.env` supplied: `DIGITAL_TWIN_MODE=record`, `DIGITAL_TWIN_PACK=/home/derrick/.openclaw/workspace/projects/peanut-gallery/digital-twin-openrouter-emotion-engine`, and for this verification rerun I updated `DIGITAL_TWIN_CASSETTE` from the old `cod-test-record-20260318-162909` to a fresh distinguishable cassette id `cod-test-record-20260318-202023` so the exact rerun artifact could be tracked cleanly without touching `node_modules`. Existing sibling-pack state immediately before launch: old root-level pre-fix cassette `/home/derrick/.openclaw/workspace/projects/peanut-gallery/digital-twin-openrouter-emotion-engine/cod-test-record-20260318-162909.json`, and prior canonical-path cassette `/home/derrick/.openclaw/workspace/projects/peanut-gallery/digital-twin-openrouter-emotion-engine/cassettes/cod-test-record-20260318-174950.json`.

Then reran exactly `node server/run-pipeline.cjs --config configs/cod-test.yaml --verbose`. The run entered true record mode (`output/cod-test/_meta/events.jsonl` shows `mode:"record"` on the new run) and immediately wrote the new cassette to the canonical sibling path `/home/derrick/.openclaw/workspace/projects/peanut-gallery/digital-twin-openrouter-emotion-engine/cassettes/cod-test-record-20260318-202023.json` — not to the pack root — proving the clean installed router path now honors the intended `cassettes/` directory. During this rerun, Phase 1 completed and Phase 2 advanced through chunks 1-6 successfully; artifacts were refreshed under `output/cod-test/phase1-gather-context/`, `output/cod-test/phase2-process/`, and `output/cod-test/_meta/`. However, the exact command did not complete: it stalled during Phase 2 after `Processing chunk 7/29 (30.0s - 35.0s)...`, with the last observed event trail entry at `provider.call.start` for `chunkIndex:6` and the fresh cassette left partially recorded at `/home/derrick/.openclaw/workspace/projects/peanut-gallery/digital-twin-openrouter-emotion-engine/cassettes/cod-test-record-20260318-202023.json` (16 interactions recorded, mtime `2026-03-18 20:35:21`). Outcome: the clean installed dependency path and canonical sibling cassette routing are verified as correct, but this exact rerun is blocked because the pipeline hung before reaching `run.end`.

---

## Final Results

**Status:** ⚠️ Partial

**What We Built:** Removed the manual `node_modules` symlink hack, refreshed `emotion-engine` onto a clean manifest/lockfile-driven install of `digital-twin-router` commit `770313a5e3bcab42cb380b3da28501d975aca031`, and verified that the installed runtime now resolves the router from `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/node_modules/digital-twin-router/package.json` for both direct and provider-context imports. The clean installed router behavior is correct: true `DIGITAL_TWIN_MODE=record` against the intended sibling pack `/home/derrick/.openclaw/workspace/projects/peanut-gallery/digital-twin-openrouter-emotion-engine` now records into the canonical sibling `cassettes/` directory instead of spilling into the pack root. For this Task 3 rerun, the exact new on-disk cassette target was `/home/derrick/.openclaw/workspace/projects/peanut-gallery/digital-twin-openrouter-emotion-engine/cassettes/cod-test-record-20260318-202023.json`; that is distinct from the old pre-fix root-level cassette `/home/derrick/.openclaw/workspace/projects/peanut-gallery/digital-twin-openrouter-emotion-engine/cod-test-record-20260318-162909.json` and the earlier successful canonical-path cassette `/home/derrick/.openclaw/workspace/projects/peanut-gallery/digital-twin-openrouter-emotion-engine/cassettes/cod-test-record-20260318-174950.json`.

**Commits:**
- Pending.

**Lessons Learned:** Never use manual `node_modules` surgery for polyrepo sibling consumption; source repos must be committed/pushed first, then consuming repos must refresh installs cleanly. Also, verifying clean dependency routing and verifying end-to-end pipeline completion are separate truths: the installed router fix correctly redirected new recordings into `cassettes/`, but the exact verification rerun itself still needs follow-up because it hung mid-Phase-2 before reaching `run.end`. 

---

*Completed on 2026-03-18*
