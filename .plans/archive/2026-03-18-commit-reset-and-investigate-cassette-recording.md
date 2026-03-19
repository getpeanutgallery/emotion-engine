# emotion-engine: commit reset state and investigate cassette recording

**Date:** 2026-03-18  
**Status:** Complete  
**Agent:** Cookie 🍪

---

## Goal

Commit and push the clean reset/rerun state, then investigate why the cod-test rerun did not repopulate the expected cassette recording surface.

---

## Overview

We now have a fresh clean rerun baseline in `emotion-engine`: stale Beads were closed, old output/cassette artifacts were cleared, and `configs/cod-test.yaml` completed successfully from a clean slate. The next step is to preserve that truthful state in git before doing more diagnosis.

After the commit/push, the main follow-up question is cassette recording behavior. The prior reset confirmed that the old cassette file under the sibling `digital-twin-openrouter-emotion-engine` pack was removed and that the clean rerun did not recreate a new cassette there. This plan treats that as an investigation lane rather than assuming it is a bug in one specific repo: we need to inspect the current config, runtime path, and code ownership to determine whether cassette recording is disabled, redirected, or regressed.

Primary owning repo is `emotion-engine`, because the reset plan, rerun artifacts, and user-requested commit all live there. The investigation may touch sibling polyrepo surfaces if the recording path is owned elsewhere.

---

## Tasks

### Task 1: Commit and push the reset/rerun truth

**Bead ID:** `ee-jsk`  
**SubAgent:** `main`  
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, inspect git status, summarize exactly what changed from the reset/rerun lane, commit the truthful repo changes, and push to main via SSH. Claim the assigned bead on start and close it when the commit/push is complete.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `.beads/`
- no tracked source/output folders were modified in the working tree at commit time

**Files Created/Deleted/Modified:**
- `.plans/2026-03-18-reset-state-and-rerun-cod-test.md` (new plan documenting the completed reset/cleanup/rerun lane)
- `.plans/2026-03-18-commit-reset-and-investigate-cassette-recording.md` (new follow-up plan for commit + cassette investigation)

**Status:** ✅ Complete

**Results:** Claimed `ee-jsk`, verified the existing git remote already uses SSH (`git@github.com:getpeanutgallery/emotion-engine.git`), and inspected the working tree before committing. Truthful pre-commit status was:

- `?? .plans/2026-03-18-commit-reset-and-investigate-cassette-recording.md`
- `?? .plans/2026-03-18-reset-state-and-rerun-cod-test.md`

There were **no tracked file modifications** and no staged changes. The only repo-local changes from the reset/rerun lane were these two new plan documents, so the first commit intentionally contained plan/history documentation only rather than source or artifact changes. After that initial push, this plan was updated with the exact Task 1 outcome and commit metadata, and that documentation update was committed and pushed as a second small follow-up commit. Final pushed `main` HEAD for Task 1 is `7d0f009`.

---

### Task 2: Investigate why cod-test cassette recording did not repopulate

**Bead ID:** `ee-a4u`  
**SubAgent:** `main`  
**Prompt:** `Starting from /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, investigate the current cassette recording path for cod-test. Determine whether recording is disabled, redirected, conditionally skipped, or broken. Inspect configs, code paths, and sibling repos as needed, but keep the investigation bounded to establishing the current truth and the most likely next fix lane. Claim the assigned bead on start, update the plan with exact evidence, and close the bead when the investigation is complete.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- possibly sibling repos if notes or plan references need updates

**Files Created/Deleted/Modified:**
- `.plans/2026-03-18-commit-reset-and-investigate-cassette-recording.md`

**Status:** ✅ Complete

**Results:** Investigated the actual runtime boundary and established that the clean rerun did **not** repopulate the sibling cassette surface because cassette recording was **not enabled for that run**. Exact evidence chain:

- The rerun output trail shows `output/cod-test/_meta/events.jsonl` starting with `"mode":"record"` and then successful OpenRouter provider calls (`provider.call.start` / `provider.call.end`) for dialogue, music, video, and recommendation (`output/cod-test/_meta/events.jsonl:1-10`, plus later phase-2/phase-3 entries). That initially looked like record mode.
- But the event logger in `server/lib/events-timeline.cjs:21-24` labels anything that is **not** explicit replay as `record`. It does **not** prove that digital-twin transport/cassette persistence was active.
- The real cassette gate lives in the installed provider layer: `node_modules/ai-providers/providers/openrouter.cjs:45-46` only enables digital-twin transport when `NODE_ENV === 'test'` or `DIGITAL_TWIN_MODE` is set. In the normal pipeline lane, if `DIGITAL_TWIN_MODE` is unset, the provider does **not** enter the twin transport at all.
- When the twin transport is used, `node_modules/ai-providers/providers/openrouter.cjs:294-300` requires `DIGITAL_TWIN_PACK`; otherwise it throws immediately instead of silently skipping cassette writes.
- The repo-local runtime env loaded by the pipeline does not define any digital-twin vars. `server/run-pipeline.cjs:17-19` loads `.env`, and the current `.env` contains only `AI_API_KEY` (`.env:1-3`). There is no repo-local `DIGITAL_TWIN_MODE`, `DIGITAL_TWIN_PACK`, or `DIGITAL_TWIN_CASSETTE` configured for `cod-test`.
- The docs already describe that record mode is an **explicit opt-in** external environment setup, not something implied by `configs/cod-test.yaml`: `docs/CONFIG-GUIDE.md:27-33` says digital twin consumes env vars and that anything other than `replay`/`record` behaves like live; `docs/COD-TEST-GOLDEN-RUN-CHECKLIST.md:44-67` shows that a recording run must export `DIGITAL_TWIN_MODE=record`, `DIGITAL_TWIN_PACK=...`, and usually `DIGITAL_TWIN_CASSETTE=...` before running the pipeline.
- Consistent with that code path, the previously expected sibling pack surface remained empty after the rerun: `../digital-twin-openrouter-emotion-engine/cassettes/` contains no cassette files now, and a workspace-wide search found no newly materialized cod-test cassette elsewhere under `projects/peanut-gallery`.

Conclusion / current truth:

1. **Current truth:** cassette recording for the clean `cod-test` rerun was effectively **disabled by missing runtime env**, not redirected by YAML config and not broken inside `emotion-engine` script execution.
2. `configs/cod-test.yaml` does not activate cassette recording on its own; the pipeline ran live against OpenRouter using `AI_API_KEY` from `.env`, while the event timeline’s `mode: "record"` label made that look like a cassette-record run.
3. Ownership remains split across repos as previously documented: `emotion-engine` owns the pipeline/docs/runtime invocation expectations; `digital-twin-router` owns record/replay interception; `digital-twin-core` owns cassette storage/schema; `digital-twin-openrouter-emotion-engine` is only the pack/content repo.

Most likely next fix lane:

- **Primary next fix lane in `emotion-engine`:** truth-fix the operator-facing docs/runtime expectations so `events.jsonl`/run notes stop implying cassette recording happened when the run was merely non-replay live mode. The highest-value bounded fix is to distinguish `live` vs `record` in the run/event surface and explicitly document that `cod-test.yaml` alone will not recreate cassettes.
- **Secondary sibling fix lane in `digital-twin-router` (only after the primary truth-fix if desired):** when record mode *is* intentionally used with an empty pack, `node_modules/digital-twin-router/index.js:215-226` only switches into `<pack>/cassettes/` if that directory already contains a cassette file. That means an intentionally empty `cassettes/` directory would currently fall back to the pack root rather than the `cassettes/` subdir. That did not cause this specific rerun failure because twin transport was never entered, but it is the most likely next bug once intentional record-mode validation resumes.

---

## Final Results

**Status:** ✅ Complete

**What We Built:** Preserved the clean reset/rerun state in git and completed a bounded investigation of the missing cod-test cassette surface. The investigation established that the successful clean rerun did **not** recreate a cassette because the digital-twin recorder was never actually engaged: `configs/cod-test.yaml` plus the repo-local `.env` only supplied live API credentials, while cassette record/replay remains an external env-driven mode (`DIGITAL_TWIN_MODE`, `DIGITAL_TWIN_PACK`, `DIGITAL_TWIN_CASSETTE`). The misleading part is the event timeline: `output/cod-test/_meta/events.jsonl` reports `mode:"record"` for any non-replay run, so the run looked like a cassette-record pass even though the provider layer stayed on the normal live path. A secondary sibling-repo finding was also recorded: if/when true record mode is used again, `digital-twin-router` currently prefers `<pack>/cassettes/` only when that subdirectory already contains a cassette file, so an intentionally emptied pack may write to the pack root unless that routing logic is tightened.

**Commits:**
- `5216cf6` - docs: record reset rerun and cassette follow-up plans
- `7d0f009` - docs: update Task 1 commit results

**Lessons Learned:** For this lane, the truthful commit surface was narrower than expected: after the reset cleanup and successful rerun, the only uncommitted repo-local changes in `emotion-engine` were the two plan documents. The cassette-question should be investigated separately rather than inferred from this documentation-only commit.

---

*Completed on 2026-03-18*
