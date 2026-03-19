# emotion-engine: refresh router dependency and rerun record mode

**Date:** 2026-03-18  
**Status:** Complete  
**Agent:** Cookie 🍪

---

## Goal

Make the live `emotion-engine` runtime consume the fixed `digital-twin-router` behavior so first-write cassette recording lands in the canonical `cassettes/` directory, then rerun `configs/cod-test.yaml` in record mode to verify the corrected on-disk result.

---

## Overview

We already proved three important things: the misleading mode labeling in `emotion-engine` is fixed, the sibling `digital-twin-router` repo now prefers `pack/cassettes/` even when that directory is empty, and a true record-mode `cod-test` rerun successfully produced a cassette. The remaining problem is dependency drift: the actual `emotion-engine` runtime still used the older installed `node_modules/digital-twin-router` copy, so the cassette landed at the pack root instead of in `cassettes/`.

This plan stays tightly scoped to that runtime-consumption gap. First, refresh or repoint the runtime dependency so `emotion-engine` actually uses the fixed router code. Second, verify the loaded dependency path/behavior before running anything expensive. Third, rerun `cod-test` in record mode and confirm the new cassette lands in the canonical `digital-twin-openrouter-emotion-engine/cassettes/` directory rather than the pack root.

The owning repo is `emotion-engine`, because the rerun, installed dependency surface, runtime env, and validation target all live here. The implementation may touch the sibling `digital-twin-router` repo only insofar as the already-landed fix is the source of truth to consume.

---

## Tasks

### Task 1: Refresh emotion-engine to consume the fixed digital-twin-router code

**Bead ID:** `ee-oba`  
**SubAgent:** `main`  
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, determine how the runtime currently sources digital-twin-router, refresh or repoint the dependency so the installed runtime uses the fixed sibling behavior, and verify the loaded code path/behavior before any rerun. Keep the change bounded to making emotion-engine consume the already-fixed router code. Claim the assigned bead on start and close it on completion.`

**Folders Created/Deleted/Modified:**
- `emotion-engine/node_modules/`
- `emotion-engine/node_modules/ai-providers/node_modules/`
- `.plans/`

**Files Created/Deleted/Modified:**
- `emotion-engine/node_modules/digital-twin-router` (repointed symlink to sibling repo)
- `emotion-engine/node_modules/ai-providers/node_modules/digital-twin-router` (repointed symlink to sibling repo)
- `.plans/2026-03-18-refresh-router-dependency-and-rerun-record-mode.md`

**Status:** ✅ Complete

**Results:** Claimed bead `ee-oba` and traced the live runtime resolution path before making any rerun changes. Evidence before the fix: from `emotion-engine`, `require.resolve('digital-twin-router/package.json')` pointed at the real installed directory `emotion-engine/node_modules/digital-twin-router/package.json`, and the installed file `emotion-engine/node_modules/digital-twin-router/index.js:218-225` still had the older `hasCassettes` gate that only switched into `pack/cassettes/` when the directory already contained a cassette file. A provider-context check then showed the more important live path: `createRequire(require.resolve('ai-providers/package.json')).resolve('digital-twin-router/package.json')` pointed at `emotion-engine/node_modules/ai-providers/node_modules/digital-twin-router/package.json`, which was also the stale installed copy.

To keep the change tightly bounded to runtime sourcing, no manifest or lockfile edits were made. Instead, this was an install-tree/runtime-path refresh only: `npm install --no-save ../digital-twin-router` repointed the top-level `emotion-engine/node_modules/digital-twin-router` entry to the local sibling repo, and the nested provider copy was then repointed as well so the actual provider import path matched the fixed sibling source. Evidence after the fix: `ls -ld node_modules/digital-twin-router` and `ls -ld node_modules/ai-providers/node_modules/digital-twin-router` both show symlinks into `/home/derrick/.openclaw/workspace/projects/peanut-gallery/digital-twin-router`, and a provider-context resolution check now returns that sibling `package.json` path instead of a vendored installed copy.

Validation before any rerun: (1) direct code inspection of the loaded sibling router confirms the stale `hasCassettes` gate is gone and `storeDir = possibleSubDir` now triggers whenever `pack/cassettes/` exists; (2) a top-level `createTwinTransport()` smoke test against a temp pack with an empty `cassettes/` directory produced `rootExists=false` and `nestedExists=true`; and (3) the same smoke test run from the `ai-providers` resolution context also produced `rootExists=false` and `nestedExists=true`, proving the actual provider runtime will now write first-record cassettes into the canonical `cassettes/` directory. No rerun was started in this task.

---

### Task 2: Rerun cod-test in record mode and verify canonical cassette path

**Bead ID:** `ee-720`  
**SubAgent:** `main`  
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, after the runtime is confirmed to use the fixed router behavior, rerun node server/run-pipeline.cjs --config configs/cod-test.yaml --verbose in intentional DIGITAL_TWIN_MODE=record, then inspect the event trail and cassette output location to verify the new cassette lands in the canonical sibling cassettes/ directory. Update the plan with exact env/runtime shape, artifact paths, and outcome, then close the assigned bead.`

**Folders Created/Deleted/Modified:**
- `emotion-engine/output/`
- sibling cassette pack path
- `.plans/`

**Files Created/Deleted/Modified:**
- fresh `output/cod-test/**`
- new cassette artifact(s)
- `.plans/2026-03-18-refresh-router-dependency-and-rerun-record-mode.md`

**Status:** ✅ Complete

**Results:** Claimed bead `ee-720`, confirmed the live runtime was still set up for intentional record-mode capture against the sibling cod-test pack, and then reran the pipeline successfully. Runtime/env shape at execution time: `DIGITAL_TWIN_MODE=record`; `DIGITAL_TWIN_PACK=/home/derrick/.openclaw/workspace/projects/peanut-gallery/digital-twin-openrouter-emotion-engine`; the live router resolution for both top-level and provider-context imports pointed at the sibling repo `/home/derrick/.openclaw/workspace/projects/peanut-gallery/digital-twin-router/package.json`; and for this rerun the shell exported a fresh `DIGITAL_TWIN_CASSETTE=cod-test-record-20260318-174950` so the new recording could be distinguished cleanly from the earlier root-level cassette. The command executed was exactly `node server/run-pipeline.cjs --config configs/cod-test.yaml --verbose`, and `dotenv` only injected the API key from `.env`, preserving the shell-provided digital-twin record-mode variables.

The rerun completed with exit code `0` in true record mode. Fresh event-trail evidence lives at `output/cod-test/_meta/events.jsonl`, where the first record is `{"seq":1,"mode":"record","kind":"run.start"...}` and the final record is `{"seq":702,"mode":"record","kind":"run.end","outcome":"success"...}`. The main output/artifact paths from this rerun are: `output/cod-test/_meta/events.jsonl`, `output/cod-test/artifacts-complete.json`, `output/cod-test/phase2-process/chunk-analysis.json`, and `output/cod-test/phase3-report/summary/FINAL-REPORT.md`. The video stage processed 29 calculated chunks, skipped the terminal `<1s` provider-facing micro-chunk, wrote `phase2-process/chunk-analysis.json`, and the overall run finished successfully.

Cassette verification is now explicit and cleanly split old vs new. Older pre-fix/root-level cassette: `/home/derrick/.openclaw/workspace/projects/peanut-gallery/digital-twin-openrouter-emotion-engine/cod-test-record-20260318-162909.json` (mtime `2026-03-18 17:09:00`, size `774916` bytes). New cassette created by this rerun: `/home/derrick/.openclaw/workspace/projects/peanut-gallery/digital-twin-openrouter-emotion-engine/cassettes/cod-test-record-20260318-174950.json` (mtime `2026-03-18 18:32:58`, size `847302` bytes). That means the fresh record-mode run landed in the canonical sibling `cassettes/` directory, not at the pack root, which verifies the refreshed router dependency is the one the runtime actually used.

---

## Final Results

**Status:** ✅ Complete

**What We Built:** Refreshed the live `emotion-engine` runtime so both direct and provider-context imports resolve `digital-twin-router` from the fixed sibling repo, then reran `configs/cod-test.yaml` in intentional digital-twin record mode and proved that the fresh cassette now lands at `/home/derrick/.openclaw/workspace/projects/peanut-gallery/digital-twin-openrouter-emotion-engine/cassettes/cod-test-record-20260318-174950.json`. The rerun’s fresh evidence trail is under `output/cod-test/`, especially `output/cod-test/_meta/events.jsonl` (`mode=record` from `run.start` through `run.end`), `output/cod-test/artifacts-complete.json`, `output/cod-test/phase2-process/chunk-analysis.json`, and `output/cod-test/phase3-report/summary/FINAL-REPORT.md`.

**Commits:**
- Pending.

**Lessons Learned:** For this stack, proving the code fix existed in the sibling repo was not enough; the decisive check was the provider-context module resolution path plus a true record-mode rerun with a fresh cassette id. Using a distinct `DIGITAL_TWIN_CASSETTE` value during verification made the old root-level cassette versus the new canonical `cassettes/` output unambiguous.

---

*Completed on 2026-03-18*
