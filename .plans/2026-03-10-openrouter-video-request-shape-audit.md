# emotion-engine: OpenRouter video request shape audit

**Date:** 2026-03-10  
**Status:** In Progress  
**Agent:** Cookie 🍪

---

## Goal

Verify the exact JSON payload we send to OpenRouter for Phase2 video chunk analysis, confirm it matches OpenRouter docs for `chat/completions` with `video_url`, and identify why OpenRouter reported an invalid model ID in the latest `cod-test` run.

---

## Context

Latest `cod-test` failed with OpenRouter HTTP 400: `qwen/qwen-3.5-397b-a17b is not a valid model ID`.
Derrick believes the model id should be `qwen/qwen3.5-397b-a17b` and has independently verified it on OpenRouter.

We need to confirm:
- what `model` string is being produced (config vs code normalization)
- whether request body shape/content types are correct (text + `video_url` part)
- whether we’re accidentally sending the wrong `model` or wrong endpoint/field name

Primary artifacts:
- `output/cod-test/phase2-process/raw/ai/chunk-0000/split-00/attempt-01/capture.json`

---

## Tasks

### Task 1: Inspect recorded OpenRouter request/response + trace model id source

**SubAgent:** `coder`
**Prompt:** In `projects/peanut-gallery/emotion-engine`:
1) Open `output/cod-test/phase2-process/raw/ai/chunk-0000/split-00/attempt-01/capture.json` and extract:
   - request URL
   - request headers (sanitized)
   - request JSON body (especially `model` and `messages[*].content`)
   - OpenRouter response JSON / error payload
2) Trace where `model` comes from:
   - `configs/cod-test.yaml` -> parsed config -> targets -> adapter -> provider request
   - Find any normalization/munging logic that could transform `qwen/qwen3.5-397b-a17b` into `qwen/qwen-3.5-397b-a17b`.
3) Compare our request to OpenRouter docs/example for video (`video_url` with `data:video/mp4;base64,...`).
4) Recommend the smallest fix (config change vs code change) and add a regression test if it’s code.

Return:
- exact `model` string sent
- any deltas vs docs
- proposed fix + files to change.

**Status:** ⏳ Pending

---

## Final Results

**Status:** ⏳ In Progress
