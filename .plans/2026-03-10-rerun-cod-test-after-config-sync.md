# emotion-engine: rerun cod-test after config sync

**Date:** 2026-03-10  
**Status:** In Progress  
**Agent:** Cookie 🍪

---

## Goal

Per Derrick:
- Ensure `configs/cod-test.yaml` model slugs match (video + dialogue_stitch).
- Delete the existing `cod-test` run output and any related cassette(s).
- Re-run `cod-test` and report pass/fail.
- If it fails, file new issues in `emotion-engine/.issues` and keep Derrick informed.

---

## Tasks

### Task 1: Verify config + clean prior artifacts

**SubAgent:** `coder`
**Prompt:** In `projects/peanut-gallery/emotion-engine`:
1) Verify `configs/cod-test.yaml` has the same correct OpenRouter model slug for both:
   - `ai.video.targets[*].adapter.model`
   - `ai.dialogue_stitch.targets[*].adapter.model`
   Specifically ensure `qwen/qwen3.5-397b-a17b` (no extra hyphen).
2) If changes are needed, patch the YAML, then commit+push to `origin/main`.
3) Delete prior run output folder `output/cod-test` (and any associated `output/cod-test*` siblings if present).

Also check for related cassettes in:
- `projects/peanut-gallery/digital-twin-openrouter-emotion-engine/cassettes/`
Delete any cod-test cassettes there.

Return: what was deleted and whether config changes were committed.

**Status:** ✅ Complete

**Results:**
- Verified model slugs are correct and consistent:
  - `ai.video.targets[0].adapter.model`: `qwen/qwen3.5-397b-a17b`
  - `ai.dialogue_stitch.targets[*]` includes `qwen/qwen3.5-397b-a17b`
- No YAML changes needed.
- Deleted prior run output: `output/cod-test` (no other `output/cod-test*` siblings found)
- Checked OpenRouter twin cassettes: none matched `*cod-test*` in `digital-twin-openrouter-emotion-engine/cassettes/`

---

### Task 2: Re-run cod-test

**SubAgent:** `coder`
**Prompt:** Run:
- `node server/run-pipeline.cjs --config configs/cod-test.yaml --verbose`

Capture:
- exit code
- output folder path
- failure point if any

If it fails:
- create `emotion-engine/.issues/<short>.md` with repro + pointers to raw artifacts/logs
- commit+push the issue(s)

**Status:** ✅ Complete (failed run; issue filed)

**Results:**
- Command:
  - `node server/run-pipeline.cjs --config configs/cod-test.yaml --verbose`
- Exit code: `1`
- Failure point: Phase3 — `server/scripts/report/recommendation.cjs`
- Error: `Recommendation generation failed after 4 attempts: invalid_output: response was not valid JSON`
- Output folder: `output/cod-test/`
- Key artifacts:
  - `output/_logs/cod-test-20260310-092321.log`
  - `output/cod-test/raw/_meta/events.jsonl`
  - `output/cod-test/phase3-report/raw/_meta/errors.summary.json`
  - `output/cod-test/phase3-report/raw/ai/recommendation/attempt-01/capture.json` (OpenRouter “No content”)
  - `output/cod-test/phase3-report/raw/ai/recommendation/attempt-02/03/04/capture.json` (invalid JSON)
- Issue created + pushed:
  - `.issues/cod-test-recommendation-invalid-json-20260310.md`
  - commit `03ae628`

---

## Final Results

**Status:** ⏳ In Progress
