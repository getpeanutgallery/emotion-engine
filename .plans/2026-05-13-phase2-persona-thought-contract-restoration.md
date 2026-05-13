# Peanut Gallery Emotion Engine

**Date:** 2026-05-13  
**Status:** In Progress  
**Agent:** Cookie 🍪

---

## Goal

Restore the missing human-like persona reaction layer in Phase 2 by adding `thought`, `continuationThought`, and optional `personaMeta` support back into the chunk-analysis contract without destabilizing the existing benchmarkable emotion fields.

---

## Overview

The current Phase 2 artifact still preserves the benchmark-centered emotional contract—`summary`, per-lens scores and reasoning, `dominant_emotion`, and `confidence`—but it no longer preserves a first-class persona-voice reaction field. That loss makes the output less useful for human review and less faithful to the intended “persona as a person” behavior. We confirmed that the persona prompt lineage still explicitly references `thought` and `scroll_risk`, but the current normalized emotion-analysis validator strips that richer layer away before it reaches final artifacts.

This plan focuses on restoring that missing layer in a narrow, controlled way. The target shape is:
- required `thought`
- optional `continuationThought`
- optional `personaMeta` object for persona-specific extras
- no required universal `scroll_risk`
- no first-class `reaction` field unless later evidence proves it adds unique value

The work should preserve compatibility with the current benchmark and reporting lanes while extending the contract carefully. That likely means touching the Phase 2 prompt builder, structured-output validation/normalization, the chunk-analysis script path, and benchmark/report surfaces that compare or display chunk outputs. We should also produce sample artifact outputs so Derrick can judge whether the restored fields actually feel useful in practice before deeper prompt-refinement work resumes.

---

## REFERENCES

| ID | Description | Path |
| --- | --- | --- |
| `REF-01` | Current persona prompt lineage still mentioning `thought` and `scroll_risk` | `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/server/lib/persona-loader.cjs` |
| `REF-02` | Current emotion-analysis structured-output validator/normalizer | `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/server/lib/structured-output.cjs` |
| `REF-03` | Current chunk-analysis benchmark scoring profile | `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/server/lib/benchmark-runner.cjs` |
| `REF-04` | Current Phase 2 chunk-processing runtime | `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/server/scripts/process/video-chunks.cjs` |
| `REF-05` | Latest timestamp-backed Phase 2 rerun artifact | `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/output/cod-test-phase2-only-retest-2026-05-06-with-timestamps/phase2-process/chunk-analysis.json` |
| `REF-06` | Older comparator artifact containing stronger persona-style lines | `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/tmp/task3-comparator-validation/before-head-reports/artifact-results/chunkAnalysis.json` |
| `REF-07` | Prior memory noting the value of useful Stage 2 persona reactions for Stage 3 | `memory/2026-04-16-calibration-audit.md` |
| `REF-08` | Today’s contract discussion and field decisions | `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/.plans/artifacts/2026-05-13-phase2-review/chunk-response-digest.md` |

---

## Tasks

### Task 1: Audit the exact contract break and propose the new Phase 2 JSON shape

**Bead ID:** `ee-8q0d`  
**SubAgent:** `primary` (for `research` workflow role)  
**Role:** `research`  
**References:** `REF-01`, `REF-02`, `REF-03`, `REF-04`, `REF-05`, `REF-06`, `REF-07`  
**Prompt:** `Audit where the older persona-thought behavior disappeared from the current Phase 2 path. Trace the prompt contract, model response expectations, validator/normalizer contract, downstream chunk-analysis writing, and benchmark scoring assumptions. Produce a concise design note proposing the exact JSON shape for required thought, optional continuationThought, and optional personaMeta, including validation rules, backward-compatibility notes, and whether any benchmark fields should remain non-scored initially. Claim the bead on start and leave a durable artifact.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `server/lib/` (inspection only)
- `server/scripts/process/` (inspection only)

**Files Created/Deleted/Modified:**
- `.plans/2026-05-13-phase2-persona-thought-contract-restoration.md`
- `.plans/artifacts/2026-05-13-phase2-persona-contract-design/`

**Status:** ✅ Complete

**Results:** Research audit completed. The active Phase 2 path was traced through `server/scripts/process/video-chunks.cjs` into `tools/emotion-lenses-tool.cjs`, which no longer uses the legacy `server/lib/persona-loader.cjs` per-second `thought`/`scroll_risk` prompt lineage. The live prompt, validator-tool contract, structured-output validator, and chunk-result projection all narrow the final JSON to `summary`, per-lens `emotions`, `dominant_emotion`, and `confidence`, which is where persona-thought behavior disappeared. A durable design note was added at `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/.plans/artifacts/2026-05-13-phase2-persona-contract-design/design-note.md` proposing: required `thought`, optional `continuationThought`, optional bounded `personaMeta` with `scrollRisk` only in pass 1, backward-tolerant readers for old artifacts, and benchmark ignore/non-score treatment for the new fields until reviewed truth exists. Implementation guidance was left for the coder, including prompt updates, dual-validator updates, chunk-result projection changes, and benchmark safety steps.

---

### Task 2: Implement the restored Phase 2 contract in prompting + validation + normalization

**Bead ID:** `ee-gsj3`  
**SubAgent:** `primary` (for `coder` workflow role)  
**Role:** `coder`  
**References:** `REF-01`, `REF-02`, `REF-04`  
**Prompt:** `Implement the approved Phase 2 contract restoration. Update the prompt/spec path so persona outputs explicitly request thought, optional continuationThought, and optional personaMeta. Update the structured-output validator/normalizer so those fields survive into final artifacts, with thought required, continuationThought optional, and personaMeta optional/fuzzy but bounded to a safe JSON object contract. Do not require universal scroll_risk. Keep existing emotion fields stable. Run relevant repo-local validation, then commit/push by default before handoff.`

**Folders Created/Deleted/Modified:**
- `/home/derrick/.openclaw/workspace/projects/peanut-gallery/tools/`
- `server/lib/`
- `server/scripts/process/`
- `test/lib/`
- `test/scripts/`
- `.plans/`

**Files Created/Deleted/Modified:**
- `/home/derrick/.openclaw/workspace/projects/peanut-gallery/tools/emotion-lenses-tool.cjs`
- `/home/derrick/.openclaw/workspace/projects/peanut-gallery/tools/lib/structured-output.cjs`
- `/home/derrick/.openclaw/workspace/projects/peanut-gallery/tools/test/emotion-lenses-tool.test.js`
- `server/lib/structured-output.cjs`
- `server/scripts/process/video-chunks.cjs`
- `test/lib/structured-output-emotion.test.js`
- `test/scripts/emotion-lenses-tool.test.js`
- `test/scripts/video-chunks.test.js`
- `.plans/2026-05-13-phase2-persona-thought-contract-restoration.md`

**Status:** ✅ Complete

**Results:** Implemented the approved Phase 2 contract seam with the smallest durable surface change. The live prompt/validator-tool contract in `/home/derrick/.openclaw/workspace/projects/peanut-gallery/tools/emotion-lenses-tool.cjs` now explicitly requires `thought`, allows optional `continuationThought`, and allows optional `personaMeta.scrollRisk` only. Both structured-output validators now preserve those fields in normalized output, reject redundant `continuationThought`, and bound `personaMeta` to `scrollRisk` only. `server/scripts/process/video-chunks.cjs` now projects `thought`, optional `continuationThought`, and optional `personaMeta` into `candidateChunkResult` so the final artifact keeps the restored persona layer. Existing benchmarked emotion fields (`summary`, `emotions`, `dominant_emotion`, `confidence`) were left structurally unchanged. Focused repo-local validation passed: `tools`: `node --test test/emotion-lenses-tool.test.js`; `emotion-engine`: `node --test test/scripts/emotion-lenses-tool.test.js test/scripts/video-chunks.test.js test/lib/structured-output-emotion.test.js`. Benchmark ignore/scoring adjustments were intentionally left for Task 3 rather than broadening this implementation bead.

---

### Task 3: Update benchmark/report surfaces to tolerate or surface the new fields correctly

**Bead ID:** `ee-krrq`  
**SubAgent:** `primary` (for `coder` workflow role)  
**Role:** `coder`  
**References:** `REF-02`, `REF-03`, `REF-05`, `REF-06`  
**Prompt:** `Adjust benchmark/reporting behavior for the new Phase 2 fields. Decide what should be scored now versus surfaced as non-scored or informational. Ensure existing runs do not break if continuationThought or personaMeta are absent. Preserve comparability while making the new thought-layer visible in artifacts and summaries where useful.`

**Folders Created/Deleted/Modified:**
- `server/lib/`
- `server/scripts/report/`
- `test/lib/`
- `test/scripts/`
- `.plans/`

**Files Created/Deleted/Modified:**
- `server/lib/benchmark-runner.cjs`
- `server/scripts/report/final-report.cjs`
- `server/scripts/report/evaluation.cjs`
- `test/lib/benchmark-runner.test.js`
- `test/scripts/final-report.test.js`
- `test/scripts/evaluation.test.js`
- `.plans/2026-05-13-phase2-persona-thought-contract-restoration.md`

**Status:** ✅ Complete

**Results:** Updated the chunk-analysis benchmark profile with default ignore paths for `chunks[*].thought`, `chunks[*].continuationThought`, and `chunks[*].personaMeta{,.scrollRisk}` so new Phase 2 persona-thought fields remain non-scored and do not fail structural comparison against older truth/output artifacts. Kept the existing scored families unchanged (`summary`, emotion scores, dominant emotion, persona contract) to preserve run comparability per `REF-03` while allowing ignored-difference visibility in artifact reports. Updated both the canonical final report and the legacy evaluation report to render `Thought`, optional `Continuation Thought`, and optional `Scroll Risk` when present, while remaining silent and non-breaking when absent. Focused validation passed: `node --test test/lib/benchmark-runner.test.js test/scripts/final-report.test.js test/scripts/evaluation.test.js`. Rerun handoff for `ee-q2uu`: the next pass should regenerate a bounded Phase 2 output and inspect `phase2-process/chunk-analysis.json`, `phase3-report/summary/FINAL-REPORT.md`, and benchmark artifact reports to confirm the thought-layer now survives end-to-end as informational output without affecting benchmark percentages.

---

### Task 4: Run a bounded rerun and produce example chunk outputs for human review

**Bead ID:** `ee-q2uu`  
**SubAgent:** `primary` (for `coder` workflow role)  
**Role:** `coder`  
**References:** `REF-04`, `REF-05`, `REF-06`  
**Prompt:** `Run the smallest honest Phase 2 rerun needed to prove the restored fields are actually being generated and preserved. Capture representative chunk outputs—especially weak intro, action middle, and promo dip windows—so Derrick can judge whether thought and continuationThought feel useful. Include examples of personaMeta only if the persona naturally emits meaningful extras.`

**Folders Created/Deleted/Modified:**
- `output/`
- `.plans/`

**Files Created/Deleted/Modified:**
- `.plans/2026-05-13-phase2-persona-thought-contract-restoration.md`
- `.plans/artifacts/2026-05-13-phase2-persona-contract-rerun/`

**Status:** ✅ Complete

**Results:** Ran a bounded representative rerun and left the durable evidence under `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/.plans/artifacts/2026-05-13-phase2-persona-contract-rerun/summary.md`. I first attempted the smallest whole-video reuse path by hydrating the refreshed Phase 1 packet from `REF-05` and rerunning Phase 2 + Phase 3 only, but the later whole-asset lane repeatedly stalled in the digital-twin record path. To keep the proof honest while bounded, I switched to representative micro-runs on exact COD windows: intro `0s-10s` (2 chunks), middle action beat `75s-80s` (1 chunk), and promo dip `125s-130s` (1 chunk). The resulting Phase 2 artifacts confirmed `thought` is present in all representative chunks, `continuationThought` appears when warranted by real sequence continuity (intro chunk 2), and `personaMeta` stayed bounded to `scrollRisk` with values including `medium`, `low`, and `SCROLLING`. Phase 3 reports now render `Thought`, optional `Continuation Thought`, and `Scroll Risk` when present, with non-breaking silence when absent. Key output roots: `output/cod-thought-contract-intro-0s-10s/`, `output/cod-thought-contract-middle-75s-80s/`, and `output/cod-thought-contract-promo-125s-130s/`. QA handoff for `ee-oz5u`: review the persona usefulness of those representative chunks, especially whether intro chunk 2’s `continuationThought` adds value versus redundancy and whether the promo `SCROLLING` call is appropriately sharp.

---

### Task 5: QA and audit whether the restored fields are useful rather than schema noise

**Bead ID:** `ee-oz5u`  
**SubAgent:** `primary` (for `qa` workflow role)  
**Role:** `qa`  
**References:** `REF-05`, `REF-06`  
**Prompt:** `QA the restored Phase 2 thought-layer. Check whether thought is meaningfully persona-voiced and chunk-grounded, whether continuationThought adds real sequence value instead of duplicating thought, and whether personaMeta stays optional and useful rather than becoming junk overflow. Compare sample outputs to the stronger older artifact tone. Produce a recommendation on whether the contract is ready to keep as-is, should be tightened, or should drop any field.`

**Folders Created/Deleted/Modified:**
- `output/`
- `.plans/`

**Files Created/Deleted/Modified:**
- `.plans/2026-05-13-phase2-persona-thought-contract-restoration.md`
- `.plans/artifacts/2026-05-13-phase2-persona-contract-qa/`

**Status:** ⏳ Pending

**Results:** Pending.

---

### Task 6: Independent audit of final contract decision and next-step impact

**Bead ID:** `ee-bf9c`  
**SubAgent:** `primary` (for `auditor` workflow role)  
**Role:** `auditor`  
**References:** `REF-01`, `REF-02`, `REF-03`, `REF-04`, `REF-05`, `REF-06`  
**Prompt:** `Audit whether the restored Phase 2 contract honestly solves the missing human-like persona reaction layer without harming existing benchmark utility. Verify the implementation, rerun evidence, QA conclusions, and artifact readability. Decide whether this is ready to land, whether continuationThought should remain optional, and whether prompt-refinement work can resume on top of the new contract.`

**Folders Created/Deleted/Modified:**
- `.plans/`

**Files Created/Deleted/Modified:**
- `.plans/2026-05-13-phase2-persona-thought-contract-restoration.md`
- `.plans/artifacts/2026-05-13-phase2-persona-contract-audit/`

**Status:** ⏳ Pending

**Results:** Pending.

---

## Final Results

**Status:** ⏳ Pending

**What We Built:** Pending.

**Reference Check:** Pending.

**Commits:**
- Pending

**Lessons Learned:** Pending.

---

*Completed on Pending*
