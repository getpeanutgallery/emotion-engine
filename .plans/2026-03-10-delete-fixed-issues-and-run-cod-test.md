# emotion-engine: delete resolved issues + run fresh cod-test

**Date:** 2026-03-10  
**Status:** Complete
**Agent:** Cookie 🍪

---

## Goal

1) Delete issue tracker files that are already resolved across the emotion-engine polyrepo siblings.
2) Commit + push those deletions to the relevant repos.
3) Run a fresh `cod-test` using the updated YAML config (no old runs/cassettes).
4) If the run fails, capture the failure as new issue(s) in `emotion-engine/.issues` and report status to Derrick.

**User confirmation:** Derrick explicitly requested execution in the 2026-03-10 08:50 EDT message.

---

## Scope (expected deletions)

- `projects/peanut-gallery/digital-twin-router/.issues/replay-consume-duplicate-requests-with-retries.md` (fixed by replay cursor consumption commits)
- `projects/peanut-gallery/emotion-engine/.issues/upgrade-audio-model-dialogue-music-context.md` (Derrick completed already)
- `projects/peanut-gallery/ai-providers/.issues/openrouter-no-content-response-debug-capture.md` (fix implemented already)

(We will re-scan `.issues/` folders before deleting to ensure exact filenames match.)

---

## Tasks

### Task 1: Delete resolved issue files + commit + push

**SubAgent:** `coder`
**Prompt:** In each repo:
- `projects/peanut-gallery/digital-twin-router`
- `projects/peanut-gallery/emotion-engine`
- `projects/peanut-gallery/ai-providers`

1) Verify the target `.issues/*.md` files exist.
2) Delete them with `git rm`.
3) Commit with a clear message (repo-specific) and push to `origin/main`.

Return the commit hashes and confirm `git status` clean in each repo.

**Status:** ✅ Complete

**Results:**
- `digital-twin-router`: deleted `.issues/replay-consume-duplicate-requests-with-retries.md`
  - commit `46c3f41c699c2edeb2bc17419d30710fe57c7b3e` — `chore(issues): remove resolved replay retry issue`
- `emotion-engine`: deleted `.issues/upgrade-audio-model-dialogue-music-context.md`
  - commit `47dad24eb7da7ac43ea760399bb313e73176b705` — `chore(issues): remove resolved phase1 audio model issue`
- `ai-providers`: deleted `.issues/openrouter-no-content-response-debug-capture.md`
  - commit `b3220953596a2bfba795fce7b2265bd3b133402e` — `chore(issues): remove resolved openrouter no-content debug issue`

All pushed to `origin/main`; all repos clean.

---

### Task 2: Run fresh cod-test from YAML

**SubAgent:** `coder`
**Prompt:** In `projects/peanut-gallery/emotion-engine`:

1) Confirm the correct command to run cod-test using `configs/cod-test.yaml` (check README/package.json/bin script).
2) Ensure there are no stale run outputs/cassettes required (Derrick deleted old ones).
3) Run a fresh cod-test (live or record mode as appropriate) and capture:
   - start/end timestamps
   - exit code
   - output run folder path
   - any errors (stack + relevant raw artifacts pointers)

If it fails: create a new `.issues/*.md` file (or multiple) in `emotion-engine/.issues/` describing the failure with repro steps and pointers to artifacts.
Commit + push the new issue(s) to `origin/main`.

**Status:** ✅ Complete (failed run; issue filed)

**Results:**
- Command used:
  - `node server/run-pipeline.cjs --config configs/cod-test.yaml --verbose`
- Output folder:
  - `output/cod-test`
- Failure:
  - Phase2 `video-chunks`: OpenRouter HTTP 400 `qwen/qwen-3.5-397b-a17b is not a valid model ID`
  - Marked fatal → no failover attempted.
- Key artifacts:
  - `output/cod-test/phase2-process/raw/ai/chunk-0000/split-00/attempt-01/capture.json`
  - `output/cod-test/phase2-process/raw/_meta/errors.summary.json`
  - `output/cod-test/raw/_meta/events.jsonl`
- Issue created + pushed:
  - `.issues/cod-test-openrouter-invalid-model-id.md`
  - commit `93eeb62` — "Add issue: cod-test fails due to invalid OpenRouter model id"

---

## Final Results

**Status:** ⏳ In Progress
