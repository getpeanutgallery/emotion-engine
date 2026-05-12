# emotion-engine: research timestamp tooling and audit dialogue capture prompt

**Date:** 2026-04-08  
**Status:** In Progress  
**Agent:** Cookie 🍪

---

## Goal

Lock the system to truthful index-only chronology for dialogue and music-vocals, remove timestamp/total-duration requirements that the current AI lanes cannot ground reliably, and draft a non-exclusionary dialogue prompt for Derrick to review before the next cod-test.

---

## Overview

Yesterday's handoff narrowed the main blocker to dialogue coverage, continuity, and timing grounding rather than the old validator-loop/runtime-noise problem. Derrick has now identified two concrete next issues to address before another cod-test: first, whether the AI analysis lane can get accurate per-line timing through a tool-call or otherwise grounded mechanism; second, whether the current dialogue prompt still contains exclusion/removal instructions that bias the model toward dropping lines that should instead survive into reconciliation.

This plan keeps those lanes separated. We will research the timestamp problem first using a high-thinking research SubAgent and treat it as a product/architecture decision, not a guess. The research deliverable should explicitly answer whether OpenRouter can support the kind of runtime/tool-call timing help we want inside this pipeline, what the practical implementation patterns are inside emotion-engine/OpenClaw, what tradeoffs they introduce, and whether the fallback should be to remove explicit time ranges from the requested JSON and preserve only ordering/index-based chronology.

The prompt lane comes second. Derrick wants to manually review and adjust the dialogue prompt, so the immediate task there is first to identify exclusionary wording and then produce a revised non-exclusionary draft for review rather than silently landing behavior changes. The preferred direction is to over-capture dialogue-like vocal content and let downstream reconciliation remove famous-song lyrics, rather than trusting the dialogue model to make that distinction perfectly in the first pass.

Derrick has now approved the architectural direction from the timestamp research: shift to index-only chronology for dialogue and music-vocals, remove required time ranges and total-duration expectations from the AI-facing contract, and only reintroduce timestamps later if a grounded alignment stage owns them. That means the next execution lane should update the relevant structured-output contracts, prompt/runtime expectations, and tests so the system no longer asks the model to invent timing metadata. In parallel, we should draft a preservation-first dialogue prompt with the exclusionary language removed and send that draft back to Derrick for verification before any next rerun.

---

## Tasks

### Task 1: Research timestamp/tool-call options for dialogue and music-vocals timing on OpenRouter

**Bead ID:** `ee-5uh3`  
**SubAgent:** `research`  
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, research whether our OpenRouter-backed dialogue and music-vocals AI lanes can obtain trustworthy per-line timing through tool calls or another grounded runtime mechanism instead of relying on the model's internal sense of time. Use high thinking. Focus on practical options we could actually implement in emotion-engine/OpenClaw, including OpenRouter tool/function calling support, whether a model can call a local timing/alignment tool during generation, whether we should precompute timing anchors outside the model and feed them in, and what architectures exist for audio/video transcript alignment when the model itself is weak at time estimation. Be explicit about constraints, likely failure modes, and recommended fallback if no trustworthy solution exists. If the best answer is to drop timestamps from the requested JSON and preserve only segment ordering/indexes, say so clearly and explain why. Produce a concise research note in the repo and update this plan with findings. Claim the bead at start with bd update ee-5uh3 --status in_progress --json and close it on completion with bd close ee-5uh3 --reason "Timestamp research completed" --json.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `docs/`

**Files Created/Deleted/Modified:**
- `.plans/2026-04-08-research-timestamp-tooling-and-audit-dialogue-capture-prompt.md`
- `docs/research/2026-04-08-openrouter-timestamp-grounding-options.md`
- `server/lib/local-validator-tool-loop.cjs` (review target)
- `server/lib/structured-output.cjs` (review target)
- `server/scripts/get-context/get-dialogue.cjs` (review target)
- `server/scripts/get-context/get-music-vocals.cjs` (review target)
- `node_modules/ai-providers/providers/openrouter.cjs` (review target)
- `docs/handoffs/2026-04-04-closeout-handoff.md` (review target)
- `docs/2026-04-07-human-delta-review-cod-test-vs-truth.md` (review target)
- `configs/cod-test-phase1-review.yaml` (review target)

**Status:** ✅ Complete

**Results:** Wrote `docs/research/2026-04-08-openrouter-timestamp-grounding-options.md`. Findings: (1) OpenRouter does support real tool/function calling on compatible models, but our current OpenRouter wrapper is not wired for `tools`, `tool_choice`, or returned `tool_calls`; (2) the current dialogue and music-vocals lanes use a simulated local validator loop, not a real runtime timing tool, so model-authored `start`/`end` remain guesses; (3) precomputed or separately computed timing anchors/alignment artifacts are the better design here because they are deterministic, reusable, and avoid OpenRouter model-capability coupling; (4) established practical architectures are ASR-with-word-timestamps plus regrouping, forced alignment against known transcript/lyrics, and hybrid pipelines where the aligner owns time while the LLM owns semantic cleanup; (5) dialogue timing is more tractable than lyric timing, while music-vocals remains vulnerable to masking, repeated choruses, remix/version mismatch, and shifted lyric windows even when song ID is right; (6) recommendation: stop requiring authoritative timestamps from the LLM, keep ordering/index-based chronology now, and add a separate local alignment stage later. If we need an immediate truthful contract change, remove required `start`/`end` from the LLM-requested JSON (or make them nullable/grounded-only) for both dialogue and music-vocals.

---

### Task 2: Audit the dialogue prompt for exclusion/removal wording that may cause dropped spoken lines

**Bead ID:** `ee-hmuv`  
**SubAgent:** `research`  
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, audit the current live dialogue prompt and the latest related prompt drafts to identify any wording that tells the dialogue model to exclude, suppress, discard, merge away, or avoid capturing spoken material because it might be music vocals or lyrics. Derrick plans to manually review/edit the prompt, so do not make silent behavior changes. Instead, produce a focused audit note that quotes the risky instructions, explains why each one may contribute to missing lines (including promo/challenge-pack style misses), and recommends which instructions should be removed, softened, or inverted so the first-pass dialogue capture preserves dialogue-like vocals for later reconciliation. Update this plan with exact files reviewed and the audit output path. Claim the bead at start with bd update ee-hmuv --status in_progress --json and close it on completion with bd close ee-hmuv --reason "Dialogue prompt exclusion audit completed" --json.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `docs/`
- `server/scripts/get-context/`
- `test/`

**Files Created/Deleted/Modified:**
- `.plans/2026-04-08-research-timestamp-tooling-and-audit-dialogue-capture-prompt.md`
- `server/scripts/get-context/get-dialogue.cjs` (review target)
- `test/scripts/get-dialogue.test.js` (review target)
- `docs/dialogue-transcription-prompt-v2-2-draft-2026-04-07.md` (review target)
- `docs/dialogue-transcription-prompt-v2-1-draft-2026-04-07.md` (review target)
- `docs/dialogue-transcription-prompt-v2-draft-2026-04-07.md` (review target)
- `docs/dialogue-prompt-review-2026-04-07.md` (review target)
- `.plans/2026-04-07-redraft-dialogue-prompt-to-restore-speaker-detail-and-allow-vocals-for-reconciliation.md` (review target)
- `docs/2026-04-07-dialogue-and-speakers-delta-review-current-run-vs-benchmark.md` (miss evidence reviewed)
- `docs/dialogue-capture-prompt-exclusion-audit-2026-04-08.md` (audit output)

**Status:** ✅ Complete

**Results:** Wrote `docs/dialogue-capture-prompt-exclusion-audit-2026-04-08.md` as an audit-only note. Reviewed the live whole-asset/chunked dialogue prompt, final-artifact guidance, the latest 2026-04-07 dialogue prompt drafts/review docs, and the focused prompt assertions in `test/scripts/get-dialogue.test.js`. Main finding: the worst earlier `spoken-only / split immediately / keep only the spoken portion` wording was removed from the live prompt, but the current runtime still retains exclusion-first language such as `Exclude clearly lyric-led, melody-led, or predominantly musical vocal passages...` plus partial-trim language such as `keep the intelligible dialogue-like portion...`, which can still bias first-pass capture toward dropping or fragmenting borderline spoken-vocal material. The note recommends removing or inverting those instructions so dialogue-like vocals are preserved for later reconciliation, while keeping only the clearly safe non-vocal exclusion (`Exclude purely instrumental or non-vocal sections.`). It also notes that `test/scripts/get-dialogue.test.js` currently encodes the exclusion wording and will need to change if Derrick adopts the preservation-first revision.

---

### Task 3: Strip dialogue and music-vocals timestamp/total-duration requirements for index-only chronology

**Bead ID:** `ee-ikfx`  
**SubAgent:** `coder`  
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, implement the approved shift to index-only chronology for dialogue and music-vocals. Remove or relax AI-facing requirements that force the model to invent authoritative timing, including per-item start/end requirements and whole-script total-duration expectations, wherever they are part of the current contract for these lanes. Update the relevant structured-output schemas, runtime expectations, and focused tests, but keep the change narrow and truthful. Do not rerun cod-test yet. Update this plan with exact files changed, the contract changes made, and tests run. Claim the bead at start with bd update ee-ikfx --status in_progress --json and close it on completion with bd close ee-ikfx --reason "Index-only chronology contract implemented" --json.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `server/lib/`
- `server/scripts/get-context/`
- `test/lib/`
- `test/scripts/`

**Files Created/Deleted/Modified:**
- `.plans/2026-04-08-research-timestamp-tooling-and-audit-dialogue-capture-prompt.md`
- `server/lib/structured-output.cjs`
- `server/lib/phase1-validator-tools.cjs`
- `server/lib/music-vocals-artifact.cjs`
- `server/scripts/get-context/get-dialogue.cjs`
- `server/scripts/get-context/get-music-vocals.cjs`
- `test/lib/phase1-validator-tools.test.js`
- `test/scripts/get-dialogue.test.js`

**Status:** ✅ Complete

**Results:** Implemented the index-first chronology contract narrowly for dialogue and music-vocals without broad artifact changes.

Contract changes landed:
- Dialogue structured-output contract now treats per-segment `start`/`end` as optional (still validated if provided) and no longer requires `totalDuration` in validator input.
- Dialogue normalization output only includes `totalDuration` when provided by the model; runtime still computes/uses source duration as needed downstream.
- Music-vocals structured-output contract now treats per-segment `start`/`end` as optional (validated only when present) and emits stable `index` chronology on normalized `vocal_segments`.
- Music-vocals artifact normalization now preserves segments by index/order even when timestamps are absent, and only keeps `start`/`end` when a valid timed range is available.
- AI-facing prompt/runtime guidance for dialogue and music-vocals now explicitly uses index/order chronology as primary and describes timestamps as optional/supportable-only.
- Removed AI-facing whole-script/chunk `totalDuration` instructions from dialogue prompt schemas/examples.

Benchmark/reporting implication noted (no scope expansion):
- Comparator/reporting code still includes temporal field names (`start`, `end`, `duration`, `totalDuration`) in broader tooling. This task did not alter benchmark logic, but index-only outputs may naturally reduce timing-field coverage in reports for these lanes.

Focused tests run:
- `node --test test/lib/phase1-validator-tools.test.js test/scripts/get-dialogue.test.js test/scripts/get-music-vocals.test.js`
- Result: pass (57/57).

---

### Task 4: Draft a non-exclusionary dialogue prompt for Derrick review

**Bead ID:** `ee-wtha`  
**SubAgent:** `research`  
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, draft the next dialogue prompt revision for Derrick review. Remove exclusionary wording that encourages the model to suppress or trim spoken material because it might be music vocals or lyrics. Preserve the overall lean runtime direction, but rewrite the prompt toward preservation-first capture so dialogue-like vocals survive into downstream reconciliation. Do not silently land the new prompt as final behavior unless the task clearly requires a draft file or doc update only. Produce a draft prompt document Derrick can review/edit, and update this plan with the draft path and a concise explanation of what changed. Claim the bead at start with bd update ee-wtha --status in_progress --json and close it on completion with bd close ee-wtha --reason "Dialogue prompt draft prepared for Derrick review" --json.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `docs/`
- `server/scripts/get-context/` (review target)

**Files Created/Deleted/Modified:**
- `.plans/2026-04-08-research-timestamp-tooling-and-audit-dialogue-capture-prompt.md`
- `docs/dialogue-transcription-prompt-v2-3-draft-2026-04-08.md`
- `server/scripts/get-context/get-dialogue.cjs` (review target)

**Status:** ✅ Complete

**Results:** Wrote `docs/dialogue-transcription-prompt-v2-3-draft-2026-04-08.md` as a review-only prompt revision that stays close to the live lean runtime shape while flipping the scope guidance from exclusion-first to preservation-first. The draft explicitly removes the live `Exclude clearly lyric-led, melody-led, or predominantly musical vocal passages...` instruction and inverts the live `keep the intelligible dialogue-like portion...` trim rule into `preserve the full intelligible utterance` when the material still plausibly functions as dialogue-like speech. It keeps the current JSON shape, segmentation discipline, damaged-speech conservatism, speaker-grounding rules, and non-vocal exclusion, but adds explicit guidance not to suppress intelligible speech-like vocals merely because score, melodic contour, chant cadence, or lyric ambiguity is present. The document also calls out the likely narrow next implementation step: update whole-asset + chunked prompt text and corresponding prompt assertions in `test/scripts/get-dialogue.test.js` only after Derrick review.

---

### Task 5: Draft music-vocals prompt revision for index-only chronology and Derrick review

**Bead ID:** `ee-0nkt`  
**SubAgent:** `research`  
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, draft the next music-vocals prompt revision to match the approved index-only chronology direction. The draft should remove any requirement that the model invent authoritative timing and should make ordering/index the truthful chronology signal. Keep the draft close to the current live prompt so it can be applied narrowly later. Do not silently land the prompt change into live behavior yet. Instead, write a review-only draft doc for Derrick, update this plan with the draft path and a concise summary of what changed, and stop there. Claim the bead at start with bd update ee-0nkt --status in_progress --json and close it on completion with bd close ee-0nkt --reason "Music-vocals prompt draft prepared for Derrick review" --json.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `docs/`
- `server/scripts/get-context/` (review target)

**Files Created/Deleted/Modified:**
- `.plans/2026-04-08-research-timestamp-tooling-and-audit-dialogue-capture-prompt.md`
- `docs/music-vocals-prompt-index-only-draft-2026-04-08.md`
- `server/scripts/get-context/get-music-vocals.cjs` (review target)
- `test/scripts/get-music-vocals.test.js` (review target)

**Status:** ✅ Complete

**Results:** Wrote `docs/music-vocals-prompt-index-only-draft-2026-04-08.md` as a review-only prompt revision that stays close to the current live music-vocals prompt while making array order/index the truthful chronology signal. The draft removes `start` / `end` from the visible example `vocal_segments` contract in both whole-asset and chunked prompt examples, explicitly says not to invent authoritative timing, and tells the model to still emit clearly present lyric-bearing segments in the correct ordered position even when precise boundaries are uncertain. It keeps the existing lane split, lyric-honesty rules, overlap handling, and recognized-song scaffolding largely intact, but narrows timing language so any `start` / `end` or recognized-song `timeRanges` are framed as optional support fields only when directly grounded by the heard audio. The document also identifies the likely narrow implementation targets after Derrick review: `server/scripts/get-context/get-music-vocals.cjs` and `test/scripts/get-music-vocals.test.js`, with no runtime-reader changes applied in this task.

---

### Task 6: Update validator and benchmark for index-only dialogue/music-vocals JSON shape

**Bead ID:** `ee-0ca5`  
**SubAgent:** `coder`  
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, update the validator and benchmark/reporting expectations to match the new truthful index-only JSON shape for dialogue and music-vocals. The system no longer treats dialogue/music-vocals time ranges or total duration as required/authoritative, so any validation, normalization, benchmark truth comparison, or report logic that assumes those fields are required for these two artifacts needs to be adjusted. Keep the change narrow to dialogue and music-vocals. Update focused tests, fixtures, or comparator logic as needed, but do not rerun cod-test yet. Update this plan with exact files changed, benchmark/validator implications, and tests run. Claim the bead at start with bd update ee-0ca5 --status in_progress --json and close it on completion with bd close ee-0ca5 --reason "Validator and benchmark updated for index-only chronology" --json.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `benchmarks/`
- `server/lib/`
- `test/`

**Files Created/Deleted/Modified:**
- `.plans/2026-04-08-research-timestamp-tooling-and-audit-dialogue-capture-prompt.md`
- `server/lib/benchmark-runner.cjs`
- `test/lib/benchmark-runner.test.js`

**Status:** ✅ Complete

**Results:** Updated benchmark/comparator behavior narrowly for `dialogue-default` and `music-vocals-default` so index-only chronology is treated as truthful and timing/total-duration metadata is non-authoritative for these two artifacts.

Benchmark/reporting implications implemented:
- Added profile-scoped default ignore paths in `benchmark-runner`:
  - `dialogue-default`: `$.totalDuration`, `$.dialogue_segments[*].start`, `$.dialogue_segments[*].end`
  - `music-vocals-default`: `$.totalDuration`, `$.vocal_segments[*].start`, `$.vocal_segments[*].end`
- Time-aware segment alignment now falls back to index chronology scoring when segment timestamps are absent, preserving stable comparison for index-only outputs.
- Comparator object-walk now honors ignore paths when a field exists in truth but is omitted from output, preventing hard errors for intentionally non-authoritative omitted timing fields.

Backward-compatibility note:
- Truth fixtures with historical `start`/`end`/`totalDuration` are intentionally left in place for now. Comparator defaults make those fields non-authoritative for dialogue/music-vocals, so older truth fixtures remain usable while index-only outputs pass truthfully.

Focused tests run:
- `node --test test/lib/benchmark-runner.test.js test/lib/phase1-validator-tools.test.js`
- Result: pass (38/38).

---

### Task 7: Apply Derrick-approved dialogue prompt v2.3 draft live (whole-asset + chunked) and update locked tests

**Bead ID:** `ee-gnjg`  
**SubAgent:** `coder`  
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, work on bead ee-gnjg. First claim it with bd update ee-gnjg --status in_progress --json. Apply Derrick-approved dialogue prompt draft docs/dialogue-transcription-prompt-v2-3-draft-2026-04-08.md into the live dialogue prompt path. Keep the change narrow and faithful to the approved draft. Update prompt-locked tests accordingly. Scope: update live dialogue prompt/runtime text, mirror preservation-first wording in whole-asset + chunked variants, update focused tests asserting old exclusionary wording, update this plan with exact files/tests, do not rerun cod-test yet. Close bead with bd close ee-gnjg --reason "Approved dialogue prompt applied live" --json.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `server/scripts/get-context/`
- `test/scripts/`

**Files Created/Deleted/Modified:**
- `.plans/2026-04-08-research-timestamp-tooling-and-audit-dialogue-capture-prompt.md`
- `server/scripts/get-context/get-dialogue.cjs`
- `test/scripts/get-dialogue.test.js`

**Status:** ✅ Complete

**Results:** Applied the approved v2.3 preservation-first scope wording directly into the live dialogue prompt path with a narrow delta only. Updated both whole-asset and chunked prompt variants plus their tool-loop final artifact guidance to replace old exclusion/trim behavior with preservation-first wording: keep intelligible dialogue-like lines when classification is ambiguous, avoid dropping/trimming solely due to score/melodic contour/lyric resemblance, and defer final lyric-only stripping decisions to reconciliation. Kept lean runtime behavior and existing index-order chronology guidance intact. Updated focused prompt-locked assertions in `test/scripts/get-dialogue.test.js` to match the new wording and remove checks for the old exclusionary lines.

Focused tests run:
- `node --test test/scripts/get-dialogue.test.js`
- Result: pass (35/35).

### Task 8: Prepare the next cod-test rerun plan after contract, prompt, and benchmark changes

**Bead ID:** `ee-f1zr`  
**SubAgent:** `primary`  
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, after the index-only chronology contract changes are implemented, the validator/benchmark is updated, Derrick has approved the next dialogue prompt direction, and Derrick has reviewed/approved the music-vocals prompt draft and any resulting live prompt/readers updates, update the plan for the next cod-test rerun. Capture the chosen timing strategy (index/order only for now), the approved prompt changes, expected artifacts, and the exact rerun/verification steps. Do not run the rerun yet unless explicitly instructed. Claim the bead at start with bd update ee-f1zr --status in_progress --json and close it on completion with bd close ee-f1zr --reason "Next cod-test rerun plan prepared" --json.`

**Folders Created/Deleted/Modified:**
- `.plans/`

**Files Created/Deleted/Modified:**
- `.plans/2026-04-08-research-timestamp-tooling-and-audit-dialogue-capture-prompt.md`

**Status:** ⏳ Pending

**Results:** Pending. Blocked on final approval/application of the music-vocals prompt draft (Task 5 follow-through) and explicit go-ahead to run the next cod-test plan lane.

---

### Task 8: Apply Derrick-approved music-vocals index-only prompt draft to live runtime

**Bead ID:** `ee-z1w7`  
**SubAgent:** `coder`  
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, work on bead ee-z1w7. First claim it with bd update ee-z1w7 --status in_progress --json. Apply Derrick-approved music-vocals prompt draft docs/music-vocals-prompt-index-only-draft-2026-04-08.md into the live music-vocals prompt path. Keep the change narrow and faithful to the approved draft. Update prompt-locked tests accordingly. Scope: update live music-vocals prompt/runtime text; mirror approved index-only wording in whole-asset and chunked variants; update focused tests asserting old prompt shape/timing language; update this plan with exact files changed and tests run; do not rerun cod-test. Constraints: do not reintroduce timing requests; keep spoken dialogue out of vocal_segments; preserve already-landed contract/benchmark changes. Close with bd close ee-z1w7 --reason "Approved music-vocals prompt applied live" --json.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `server/lib/`
- `server/scripts/get-context/`
- `test/lib/`
- `test/scripts/`

**Files Created/Deleted/Modified:**
- `.plans/2026-04-08-research-timestamp-tooling-and-audit-dialogue-capture-prompt.md`
- `server/scripts/get-context/get-music-vocals.cjs`
- `server/lib/phase1-validator-tools.cjs`
- `test/scripts/get-music-vocals.test.js`
- `test/lib/phase1-validator-tools.test.js`

**Status:** ✅ Complete

**Results:** Applied the approved draft language into the live music-vocals runtime prompt text for both whole-asset and chunked variants, keeping the change narrow. Prompt examples now default to index-only `vocal_segments` (removed visible `start`/`end`) and no longer show recognized-song `timeRanges`; both variants now explicitly state that array order/index is the truthful chronology signal and that segments should still be emitted in-order when timing is uncertain. Lane boundaries were preserved (`spoken dialogue over score` remains out of `vocal_segments`) and no timing-request language was reintroduced. Updated prompt-locked tests to assert the new chronology wording and to assert the chunk prompt no longer includes `"start"`, `"end"`, or `"timeRanges"` in the JSON example. Also updated the music-vocals validator tool contract description/example to align with index-first chronology wording.

Focused tests run:
- `node --test test/scripts/get-music-vocals.test.js test/lib/phase1-validator-tools.test.js`
- Result: pass (22/22).

### Task 9: Rerun real cod-test after index-only chronology + benchmark/comparator + approved prompt updates, then compare before/after

**Bead ID:** `ee-2czf`
**SubAgent:** `research`
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, work on bead ee-2czf. First claim it with bd update ee-2czf --status in_progress --json. Rerun the real cod-test validation after the index-only chronology changes, benchmark/comparator updates, and approved dialogue/music-vocals prompt revisions. Then compare the refreshed dialogue and music-vocals outputs against the benchmark truth under the new truthful contract. Scope: - Run the real provider-backed configs/cod-test.yaml pipeline. - Before rerunning, preserve/archive any existing cod-test output and report artifacts needed for honest before/after comparison. - Confirm the updated dialogue and music-vocals prompt paths were used. - Inspect the resulting dialogue and music-vocals outputs plus benchmark reports. - Compare against prior known state where useful, especially around missing lines / lyric coverage / benchmark behavior. - Update the plan file .plans/2026-04-08-research-timestamp-tooling-and-audit-dialogue-capture-prompt.md with exact command(s), artifact paths, findings, and tests/verification performed. What to report: - whether the pipeline completed and how the artifact/benchmark status changed - whether dialogue coverage/continuity improved or regressed - whether music-vocals ordering/coverage looks healthier under the new prompt shape - whether the benchmark now scores cleanly under index-only chronology for these lanes - any obvious new regressions or next blockers Constraints: - Do not broaden scope into unrelated refactors. - Be truthful if the rerun still fails overall. - Prefer concrete artifact paths and evidence. - Close the bead with bd close ee-2czf --reason "cod-test rerun completed and compared" --json when finished.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `output/_archives/`
- `output/cod-test/`
- `benchmarks/fixtures/cod-test/_reports/`
- `.logs/`

**Files Created/Deleted/Modified:**
- `.plans/2026-04-08-research-timestamp-tooling-and-audit-dialogue-capture-prompt.md`
- `output/_archives/cod-test-pre-ee-2czf-20260408-123814/`
- `output/cod-test/phase1-gather-context/dialogue-data.json`
- `output/cod-test/phase1-gather-context/dialogue-data.reconciled.json`
- `output/cod-test/phase1-gather-context/music-vocals-data.json`
- `output/cod-test/phase1-gather-context/music-vocals-data.reconciled.json`
- `output/cod-test/_meta/ai/_prompts/73ebdfb2dc8cdafee4aff26a215009db44de4f057474f354b842e58d2b7f67b5.json`
- `output/cod-test/_meta/ai/_prompts/cbaf3b5db1fb6872073fe8f78a71085d7178391fe831e4a4540f13a090def536.json`
- `output/cod-test/phase1-gather-context/raw/ai/dialogue-transcription/attempt-01/capture.json`
- `output/cod-test/phase1-gather-context/raw/ai/music-vocals-whole-asset/attempt-01/capture.json`
- `benchmarks/fixtures/cod-test/_reports/benchmark-summary.json`
- `benchmarks/fixtures/cod-test/_reports/artifact-results/dialogueData.json`
- `benchmarks/fixtures/cod-test/_reports/artifact-results/musicVocalsData.json`
- `.logs/cod-test-20260408-123826-ee-2czf-index-only-rerun.log`
- `.logs/cod-test-20260408-123826-ee-2czf-index-only-rerun.time`

**Status:** ✅ Complete

**Results:**

Archive / preservation work completed first:
- Archived prior run output to `output/_archives/cod-test-pre-ee-2czf-20260408-123814/cod-test/`.
- Copied the prior benchmark packet to `output/_archives/cod-test-pre-ee-2czf-20260408-123814/benchmark_reports_before/`.
- This preserved an honest before/after comparison surface for both artifacts and benchmark outputs.

Exact commands executed:
- Claim bead:
  - `bd update ee-2czf --status in_progress --json`
- Preserve old run + reports:
  - `TS=$(date +%Y%m%d-%H%M%S); ARCHIVE_DIR="output/_archives/cod-test-pre-ee-2czf-$TS"; mkdir -p "$ARCHIVE_DIR"; mv output/cod-test "$ARCHIVE_DIR/"; cp -a benchmarks/fixtures/cod-test/_reports "$ARCHIVE_DIR/benchmark_reports_before"`
- Real provider-backed rerun:
  - `set -a && . ./.env && set +a && /usr/bin/time -p -o .logs/cod-test-20260408-123826-ee-2czf-index-only-rerun.time node server/run-pipeline.cjs --config configs/cod-test.yaml --clean-live-digital-twin --verbose 2>&1 | tee .logs/cod-test-20260408-123826-ee-2czf-index-only-rerun.log`

Runtime / completion status:
- The pipeline executed Phase 1, Phase 2, and Phase 3 successfully and wrote fresh artifacts under `output/cod-test/`.
- The overall command still exited non-zero during the benchmark stage.
- Wall-clock runtime from `.logs/cod-test-20260408-123826-ee-2czf-index-only-rerun.time`: `real 1067.56` seconds.

Prompt-path / live prompt verification:
- Dialogue capture used `output/cod-test/phase1-gather-context/raw/ai/dialogue-transcription/attempt-01/capture.json`, which points at prompt capture `output/cod-test/_meta/ai/_prompts/73ebdfb2dc8cdafee4aff26a215009db44de4f057474f354b842e58d2b7f67b5.json`.
- Verified the captured dialogue prompt contains the new live preservation-first wording:
  - `Do not drop or trim intelligible words merely because musical score is present underneath ...`
  - `Reconciliation happens later; do not act as the final filter ...`
  - `If classification is ambiguous, preserve the line ... rather than suppressing it.`
- Music-vocals capture used `output/cod-test/phase1-gather-context/raw/ai/music-vocals-whole-asset/attempt-01/capture.json`, which points at prompt capture `output/cod-test/_meta/ai/_prompts/cbaf3b5db1fb6872073fe8f78a71085d7178391fe831e4a4540f13a090def536.json`.
- Verified the captured music-vocals prompt contains the new index-only chronology wording:
  - `Array order/index is the truthful chronology signal for this lane.`
  - `If timing is uncertain ... still emit the segment in the correct order/index position.`
  - captured prompt example no longer included `timeRanges`.

Fresh artifact outputs inspected:
- Dialogue artifact: `output/cod-test/phase1-gather-context/dialogue-data.reconciled.json`
- Music-vocals artifact: `output/cod-test/phase1-gather-context/music-vocals-data.reconciled.json`
- Benchmark summary: `benchmarks/fixtures/cod-test/_reports/benchmark-summary.json`
- Benchmark lane reports:
  - `benchmarks/fixtures/cod-test/_reports/artifact-results/dialogueData.json`
  - `benchmarks/fixtures/cod-test/_reports/artifact-results/musicVocalsData.json`

Before/after benchmark status:
- Prior archived benchmark summary (`output/_archives/cod-test-pre-ee-2czf-20260408-123814/benchmark_reports_before/benchmark-summary.json`):
  - overall status `error`
  - `0/7` artifacts passed
  - `1672/2916` scoreable fields passed
- New rerun benchmark summary (`benchmarks/fixtures/cod-test/_reports/benchmark-summary.json`):
  - overall status `error`
  - `0/7` artifacts passed
  - `1495/2944` scoreable fields passed
- Net: the pipeline still does **not** score cleanly overall, and the aggregate benchmark result regressed.

Dialogue-specific comparison:
- Prior archived dialogue output kept the comms block and avoided lyric bleed:
  - had `Menendez is a terrorist.` as its own line
  - had `We're bringing peace and security to the world.` as its own line
  - had `Spectre One report.` and `Need a sitrep.`
  - did **not** yet include the final preorder/Reznov line
- New rerun dialogue output improved one endcap recall item:
  - now includes `Get the Reznov challenge pack when you pre-order now.`
- But dialogue continuity/coverage **regressed overall**:
  - fused `Menendez is a terrorist. We're bringing peace and security to the world.` into one beat
  - lost the comms lines `Specter one, report.` and `Need a sitrep.`
  - inserted lyric material into the dialogue lane: `Obey your master`, `Master`, `Come crawling faster`
  - still fused `So eager to leave, David. Killing a man is a hell of a lot easier than killing an idea.`
  - still missed the truth line `You shall know fear.`
- Benchmark lane stats changed as follows:
  - prior dialogue report: accuracy `38/177` passed (`0.2147`), coverage `0.9672`
  - new dialogue report: accuracy `58/190` passed (`0.3053`), coverage `0.8190`
- Interpretation: raw field accuracy improved somewhat under the changed contract, but human-meaningful dialogue continuity got worse because lyric contamination displaced real spoken beats.

Music-vocals-specific comparison:
- Prior archived music-vocals output used timestamped segments and mis-ordered the main lyric story starting late around `86s`, including `Obey your master` / `Come crawling faster` before the main `Master of puppets ...` line.
- New rerun music-vocals output does follow the new index-only contract and emits stable ordered segments with `index: 0..10`.
- The new prompt shape looks **healthier structurally** because chronology is now expressed truthfully via order/index instead of invented authoritative timing.
- But lyric coverage/content is still **not benchmark-clean** and only partially healthier semantically:
  - output now begins with `Obey your master`, `Master, master`, `Come crawling faster`, then `Master of puppets, I'm pulling your strings`
  - truth expects early `Obey your master`, then `Your life burns faster`, then the main lyric sequence beginning with `Master of puppets ...`
  - late truth returns `Obey your master` and `Master, master` are still not represented in a benchmark-clean way; the output repeats `Just call my name ...` and ends with `Obey your master`
- Benchmark lane stats changed as follows:
  - prior music-vocals report: accuracy `37/86` passed (`0.4302`), coverage `0.9773`
  - new music-vocals report: accuracy `41/87` passed (`0.4713`), coverage `0.8614`
- Interpretation: ordering is more truthful at the contract level, but lyric selection/coverage is still semantically off and benchmark coverage regressed.

Why the benchmark still does not score cleanly for these two lanes:
- Dialogue benchmark still errors on numeric comparator expectations for `speaker_profiles[*].grounded.acoustic_descriptors[*].confidence` where output is `null` and truth is numeric.
- Dialogue benchmark also still expects `cleanedTranscript` in truth while output omits it.
- Music-vocals benchmark now throws structural errors because the new output includes `vocal_segments[*].index` while the historical truth fixture does not yet carry index fields.
- Music-vocals also still differs on note arrays (`recognitionNotes`, `qualityNotes`) even after the chronology change.
- Conclusion: index-only chronology is live in the runtime, but the benchmark/truth packet is **not yet fully normalized to the same truthful contract**, so these lanes do not pass cleanly yet.

Obvious new regressions / blockers:
- Biggest new regression: dialogue lane is now over-capturing music lyrics into spoken dialogue (`Obey your master`, `Master`, `Come crawling faster`) and in practice lost real spoken comms lines.
- Music-vocals still recognizes the right song, but lyric ordering/content still drifts from truth in the chant/chorus windows.
- Benchmark truth/comparator alignment is still incomplete for index-only music-vocals because output `index` fields are treated as unexpected structure.
- Dialogue comparator still has unresolved confidence-field / cleaned-transcript expectations unrelated to the newly approved prompt wording.

Tests / verification performed:
- Verified archive paths exist and preserved the prior output/report packet.
- Verified fresh rerun log and time files were written.
- Verified new prompt captures were actually used by inspecting the capture JSON and referenced prompt snapshot files under `output/cod-test/_meta/ai/_prompts/`.
- Inspected fresh dialogue/music-vocals artifact outputs directly.
- Compared new lane reports against archived prior lane reports from `benchmark_reports_before`.
- Confirmed the benchmark stage remains the failing stage of the real provider-backed rerun.

### Task 10: Remove remaining time-dependent checks from famous-song reconciliation for index-only lanes

**Bead ID:** `ee-xg0o`  
**SubAgent:** `coder`  
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, update famous-song reconciliation and any directly related helpers so dialogue, music, and music-vocals can reconcile correctly in the new index-only world. Remove hard dependencies on timeRanges or timed overlap checks when deciding whether lyric contamination cleanup should run for these lanes. Replace them with truthful index/text-evidence-based logic that works with the approved index-only contracts. Keep the change narrow, update focused tests, and record exact files changed plus the new gate logic in the plan. Do not rerun cod-test yet. Claim the bead at start with bd update ee-xg0o --status in_progress --json and close it with bd close ee-xg0o --reason "Index-only reconciliation gate implemented" --json.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `server/scripts/get-context/`
- `test/scripts/`

**Files Created/Deleted/Modified:**
- `.plans/2026-04-08-research-timestamp-tooling-and-audit-dialogue-capture-prompt.md`
- `server/scripts/get-context/reconcile-famous-song-phase1.cjs`
- `test/scripts/reconcile-famous-song-phase1.test.js`

**Status:** ✅ Complete

**Results:** Implemented a narrow index-only reconciliation gate and cleanup path in `server/scripts/get-context/reconcile-famous-song-phase1.cjs`.

New gate behavior:
- Removed hard gate requirements on `recognizedSong.candidates[*].timeRanges` and removed timed overlap gating.
- Gate now focuses on strong song evidence (`status=recognized`, confidence threshold, single primary candidate, no multi-song ambiguity, sufficient matched lyric fragments), with optional `musicData.recognizedSong` consensus check when present.
- Added index/text evidence collection (`buildLyricEvidence`) so reconciliation has truthful support metadata from vocal/dialogue segment order + lexical similarity without requiring time windows.

Cleanup behavior changes:
- Dialogue lyric contamination cleanup no longer requires time overlap. It now uses strong lyric similarity + confidence/short-refrain heuristics + same-speaker neighbor protection based on index proximity (not temporal gaps), and checks nearby vocal index/text support before removing a dialogue segment.
- Music-vocals lyric correction no longer skips segments for being outside recognized-song `timeRanges`; it now evaluates all vocal segments using text similarity + existing confidence and truncation guards.

Focused tests updated:
- Added a dedicated index-only regression test in `test/scripts/reconcile-famous-song-phase1.test.js` proving cleanup still applies when segments carry only `index` and recognized-song evidence has no `timeRanges`.
- Updated the weak-evidence skip assertion in the same test file to compare semantic text preservation rather than old timeful shape equality.

Tests run:
- `node --test test/scripts/reconcile-famous-song-phase1.test.js` ✅ (9/9 passing)

---

### Task 11: Strip start/end from final dialogue and music-vocals artifacts

**Bead ID:** `ee-nkao`  
**SubAgent:** `coder`  
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, make final dialogue and music-vocals artifacts truly index-only by removing start/end from normalized and reconciled outputs for these lanes. Keep the change narrow to dialogue and music-vocals. Update any direct readers/tests that still expect those fields, and document any backward-compatibility implications in the plan. Do not rerun cod-test yet. Claim the bead at start with bd update ee-nkao --status in_progress --json and close it with bd close ee-nkao --reason "Final dialogue/music-vocals artifacts stripped of timing fields" --json.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `server/scripts/get-context/`
- `test/scripts/`

**Files Created/Deleted/Modified:**
- `.plans/2026-04-08-research-timestamp-tooling-and-audit-dialogue-capture-prompt.md`
- `server/scripts/get-context/get-dialogue.cjs`
- `server/scripts/get-context/get-music-vocals.cjs`
- `server/scripts/get-context/reconcile-famous-song-phase1.cjs`
- `test/scripts/get-dialogue.test.js`
- `test/scripts/get-music-vocals.test.js`
- `test/scripts/reconcile-famous-song-phase1.test.js`

**Status:** ✅ Complete

**Results:** Final dialogue/music-vocals lane artifacts are now index-only at write time for both normalized and reconciled outputs. `get-dialogue` strips `start`/`end` from `dialogue_segments` before writing/returning `dialogue-data.json`; `get-music-vocals` strips `start`/`end` from `vocal_segments` before writing/returning `music-vocals-data.json`; and `reconcile-famous-song-phase1` strips `start`/`end` before writing/returning `*.reconciled.json` lane artifacts. Focused tests were updated to stop expecting per-segment timing in final dialogue/music-vocals artifacts and to assert timing fields are absent.

Backward-compatibility implications:
- Any direct consumer reading final `dialogue-data.json`, `music-vocals-data.json`, or reconciled dialogue/music-vocals artifacts must now use `index` + array order for chronology and must not require per-segment `start`/`end`.
- Reconciliation ledger decision entries still include timing when available (for audit/debug), so downstream tooling should treat ledger timing as optional diagnostics rather than lane chronology truth.
- This change is intentionally narrow to dialogue/music-vocals artifact payloads; no cod-test rerun was performed in this task.

---

### Task 12: Audit remaining dialogue/music/music-vocals time assumptions before next run

**Bead ID:** `ee-dgpi`  
**SubAgent:** `research`  
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, audit the remaining dialogue/music/music-vocals lane code, validators, reconciliation, benchmark/reporting, and prompt/helper paths for lingering time-dependent assumptions that conflict with the approved index-only direction. Produce a focused audit note listing every remaining consumer that still expects or meaningfully relies on timing for these lanes, categorize each as must-fix-before-next-run vs can-defer, and update the plan with the output path and summary. Do not make live code changes in this task. Claim the bead at start with bd update ee-dgpi --status in_progress --json and close it with bd close ee-dgpi --reason "Index-only time-assumption audit completed" --json.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `docs/`
- `server/` (review targets)
- `test/` (review targets)

**Files Created/Deleted/Modified:**
- `.plans/2026-04-08-research-timestamp-tooling-and-audit-dialogue-capture-prompt.md`
- `docs/2026-04-08-index-only-time-assumption-audit-dialogue-music-music-vocals.md`

**Status:** ✅ Complete

**Results:** Wrote `docs/2026-04-08-index-only-time-assumption-audit-dialogue-music-music-vocals.md` as an audit-only note covering remaining dialogue/music/music-vocals time consumers. Main must-fix findings before the next run: (1) `server/scripts/get-context/reconcile-famous-song-phase1.cjs` still hard-gates cleanup on recognized-song `timeRanges` plus timed overlap with dialogue/vocal segments, so lyric cleanup remains time-dependent; (2) `server/scripts/get-context/get-music-vocals.cjs` still builds chunk recall/checklist context from timed whole-asset vocal spans, so chunk refinement continues to depend on timing even after index-first segment chronology; (3) `server/lib/benchmark-runner.cjs` still treats recognized-song `timeRanges` as comparable truth-bearing structure, so benchmark/reporting remains partially pinned to the old timeful contract. Can-defer findings were also recorded for leftover `totalDuration` / `timingMode` / `coverage` metadata, validator examples, broader music-data prompt/runtime timing, and test/fixture lock-in.

---

### Task 13: Audit remaining music-data time assumptions before next run

**Bead ID:** `ee-kf3f`  
**SubAgent:** `research`  
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, audit the music-data lane specifically for lingering time-dependent assumptions that conflict with the approved index-only direction across dialogue/music/music-vocals. Review prompt text, normalized output shape, helper/context generation, reconciliation/supporting-song logic, benchmark/reporting, and any direct readers that still expect or privilege timing for music-data in ways that will interfere with the new world. Produce a focused audit note with must-fix-before-next-run vs can-defer findings, and update the plan with the output path and summary. Do not make live code changes in this task. Claim the bead at start with bd update ee-kf3f --status in_progress --json and close it with bd close ee-kf3f --reason "Music-data time-assumption audit completed" --json.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `docs/`
- `server/` (review targets)
- `test/` (review targets)

**Files Created/Deleted/Modified:**
- `.plans/2026-04-08-research-timestamp-tooling-and-audit-dialogue-capture-prompt.md`
- `docs/music-data-time-assumption-audit-2026-04-08.md`
- `server/scripts/get-context/get-music.cjs` (review target)
- `server/lib/phase1-validator-tools.cjs` (review target)
- `server/lib/structured-output.cjs` (review target)
- `server/lib/benchmark-runner.cjs` (review target)
- `server/scripts/get-context/get-music-vocals.cjs` (review target)
- `server/scripts/get-context/reconcile-famous-song-phase1.cjs` (review target)
- `server/scripts/process/video-chunks.cjs` (review target)
- `server/scripts/process/whole-video-mimo.cjs` (review target)
- `benchmarks/fixtures/cod-test/benchmark.json` (review target)
- `benchmarks/fixtures/cod-test/truth/music-data.json` (review target)
- `test/scripts/get-music.test.js` (review target)
- `test/lib/phase1-validator-tools.test.js` (review target)

**Status:** ✅ Complete

**Results:** Wrote `docs/music-data-time-assumption-audit-2026-04-08.md` as an audit-only note focused on the `musicData` lane. Main must-fix findings before the next rerun: (1) live `get-music` still uses a timeline-first contract and validator that require timed `segments` / timed `globalArc.notableTransitions`; (2) chunk-level music prompt/tooling still normalizes timed `recognizedSong.timeRanges`, which invites chunk-window guesses to look authoritative; (3) `server/scripts/process/video-chunks.cjs` still uses `musicData.segments.start/end` as the sole selector for chunk-local music context, so guessed music boundaries can directly change downstream prompts; and (4) benchmark truth/comparison still treats music-data timing as authoritative because `music-default` has not been relaxed the way `dialogue-default` and `music-vocals-default` were. Lower-priority can-defer findings: `get-music-vocals` helper context still prints timed music transitions, `whole-video-mimo` still renders timing-heavy music cues, and tests/fixtures still teach the old music-data timing contract.

---

### Task 14: Draft updated video prompts for global index-only lane context review

**Bead ID:** `ee-wkq5`  
**SubAgent:** `research`  
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, draft the updated whole-video and chunked-video prompt wording needed for the new global index-only lane context design. The draft must stop implying that dialogue/music/music-vocals entries are localizable to the current chunk by time overlap, and instead explain that full ordered lane datasets are being provided as global context only. Write a review-only draft document for Derrick, update this plan with the draft path and a concise summary, and do not apply live prompt changes yet. Claim the bead at start with bd update ee-wkq5 --status in_progress --json and close it with bd close ee-wkq5 --reason "Video prompt draft prepared for Derrick review" --json.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `docs/`
- `server/scripts/process/` (review target)
- `../tools/` (review target)

**Files Created/Deleted/Modified:**
- `.plans/2026-04-08-research-timestamp-tooling-and-audit-dialogue-capture-prompt.md`
- `docs/video-prompt-global-index-context-draft-2026-04-08.md`
- `server/scripts/process/whole-video-mimo.cjs` (review target)
- `server/scripts/process/video-chunks.cjs` (review target)
- `../tools/emotion-lenses-tool.cjs` (review target)

**Status:** ✅ Complete

**Results:** Wrote `docs/video-prompt-global-index-context-draft-2026-04-08.md` as a review-only wording pass for the new global index-only lane-context design. The draft stays close to the current whole-video and chunked-video prompt structure but changes the lane framing so dialogue/music/music-vocals are described as full ordered global support context rather than chunk-local evidence. It explicitly says to prefer reconciled lane artifacts when available, keeps the attached whole video / chunk as the only authoritative evidence for what is present in the current analysis window, and adds narrow replacement text that overrides any misleading implication from legacy `start` / `end` fields. The doc also calls out the likely narrow follow-up targets after review: `server/scripts/process/whole-video-mimo.cjs`, `../tools/emotion-lenses-tool.cjs`, and the `video-chunks.cjs` handoff naming/path once Derrick approves the direction.

---

### Task 15: Replace chunk-local lane selection with full global context injection for dialogue/music/music-vocals

**Bead ID:** `ee-npan`  
**SubAgent:** `coder`  
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, after Derrick reviews/approves the updated video prompt draft, replace chunk-local lane selection for dialogue, music, and music-vocals with truthful full global context injection. We no longer have authoritative timing for these lanes, so chunked or whole-video downstream prompts must stop pretending lane entries are localizable by chunk overlap. Instead, pass the full ordered lane datasets as available context, preferring reconciled artifacts when they exist, and label them clearly as global index-ordered context rather than chunk-local evidence. Update the relevant chunk-context builders/readers/prompts/tests, keep the change narrow and honest, and record exact files changed plus compatibility notes in the plan. Do not rerun cod-test yet. Claim the bead at start with bd update ee-npan --status in_progress --json and close it with bd close ee-npan --reason "Global lane context injection replaced chunk-local selection" --json.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `server/scripts/process/`
- `../tools/`
- `test/scripts/`

**Files Created/Deleted/Modified:**
- `.plans/2026-04-08-research-timestamp-tooling-and-audit-dialogue-capture-prompt.md`
- `server/scripts/process/video-chunks.cjs`
- `server/scripts/process/whole-video-mimo.cjs`
- `../tools/emotion-lenses-tool.cjs`
- `test/scripts/video-chunks.test.js`
- `test/scripts/whole-video-mimo.test.js`
- `test/scripts/emotion-lenses-tool.test.js`

**Status:** ✅ Complete

**Results:** Applied the approved global-index prompt/context update narrowly across whole-video + chunked-video analysis paths and prompt-locked tests.

Implemented injection/selection rules:
- Chunked phase2 no longer overlap-filters dialogue/music by chunk window. It now injects full ordered lane datasets as global support context for dialogue, music, and music-vocals.
- Whole-video + chunked prompt wording now matches the approved draft direction: lane context is support-only global context; attached whole video/chunk remains the only authoritative evidence for what is present in the current analysis window.
- Per lane canonical artifact selection is explicit at injection points: prefer `*Reconciled` artifact when available, otherwise fall back to raw/final lane artifact, and inject only one copy per lane (never both raw and reconciled).
- Prompt labels no longer imply overlap-filtered chunk-local authority (`Active chunk cues` removed; replaced with global support wording).
- Global index-only safety polish: segment labeling now uses `index` fallback when lane timing is absent, and chunk prompts no longer clip global context ranges down to the active chunk window.

Focused tests run:
- `node --test test/scripts/emotion-lenses-tool.test.js test/scripts/video-chunks.test.js test/scripts/whole-video-mimo.test.js`
- Result: pass (56/56).

---

### Task 16: Rerun real cod-test after the post-`ee-2czf` fixes, then compare against the immediately previous archived run

**Bead ID:** `ee-s2nv`
**SubAgent:** `research`
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, work on bead ee-s2nv. First claim it with bd update ee-s2nv --status in_progress --json. Rerun the real provider-backed configs/cod-test.yaml pipeline after the latest fixes: - index-only reconciliation gate - timing stripped from final dialogue/music-vocals artifacts - global-context whole-video/chunked-video prompt updates - canonical per-lane artifact selection (reconciled preferred, raw fallback) Scope: - Preserve/archive the current cod-test output and benchmark reports before rerunning. - Run the real pipeline. - Verify the new prompt/context paths are actually being used. - Inspect fresh dialogue/music-vocals/video-related outputs and benchmark reports. - Compare against the immediately previous archived run, especially for: - lyric bleed into dialogue - whether reconciliation now actually removes likely lyrics from dialogue - benchmark behavior under the new global-context rules - any whole-video/chunk-video regressions or improvements - Update the plan file .plans/2026-04-08-research-timestamp-tooling-and-audit-dialogue-capture-prompt.md with exact commands, artifact paths, findings, and verification steps. Constraints: - Be truthful if the rerun still fails. - Prefer concrete artifact/report paths. - Do not broaden into unrelated refactors. When done: - close the bead with bd close ee-s2nv --reason "Post-fix cod-test rerun completed and compared" --json.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `output/_archives/`
- `output/cod-test/`
- `.logs/`
- `benchmarks/fixtures/cod-test/_reports/` (verified unchanged after failure)

**Files Created/Deleted/Modified:**
- `.plans/2026-04-08-research-timestamp-tooling-and-audit-dialogue-capture-prompt.md`
- `output/_archives/cod-test-pre-ee-s2nv-20260408-151429/`
- `output/cod-test/phase1-gather-context/dialogue-data.json`
- `output/cod-test/phase1-gather-context/dialogue-data.reconciled.json`
- `output/cod-test/phase1-gather-context/music-vocals-data.json`
- `output/cod-test/phase1-gather-context/music-vocals-data.reconciled.json`
- `output/cod-test/phase1-gather-context/famous-song-reconciliation.json`
- `output/cod-test/_meta/ai/_prompts/5dee59381b3c108102467950e632c189d82c2c2dd92a4732bc968d873034293b.json`
- `output/cod-test/phase2-process/raw/ai/chunk-0000/split-00/attempt-01/capture.json`
- `output/cod-test/phase2-process/raw/ai/chunk-0023/split-00/attempt-01/capture.json`
- `output/cod-test/phase2-process/raw/ai/chunk-0024/split-00/attempt-01/capture.json`
- `output/cod-test/phase2-process/raw/ai/chunk-0024/split-00/attempt-02/capture.json`
- `output/cod-test/phase2-process/script-results/video-chunks.failure.json`
- `output/cod-test/phase2-process/recovery/video-chunks/next-action.json`
- `.logs/cod-test-20260408-151429-ee-s2nv-post-fix-rerun.log`
- `.logs/cod-test-20260408-151429-ee-s2nv-post-fix-rerun.time`

**Status:** ✅ Complete

**Results:**

Archive / preservation work completed first:
- Archived the immediately previous live run to `output/_archives/cod-test-pre-ee-s2nv-20260408-151429/cod-test/`.
- Copied the then-current benchmark packet to `output/_archives/cod-test-pre-ee-s2nv-20260408-151429/benchmark_reports_before/`.
- This created the exact before-state used for the comparison below.

Exact commands executed:
- Claim bead:
  - `bd update ee-s2nv --status in_progress --json`
- Preserve old run + reports, then start the rerun:
  - `TS=$(date +%Y%m%d-%H%M%S); ARCHIVE_DIR="output/_archives/cod-test-pre-ee-s2nv-$TS"; LOG=".logs/cod-test-$TS-ee-s2nv-post-fix-rerun.log"; TIMELOG=".logs/cod-test-$TS-ee-s2nv-post-fix-rerun.time"; mkdir -p "$ARCHIVE_DIR"; mv output/cod-test "$ARCHIVE_DIR/"; cp -a benchmarks/fixtures/cod-test/_reports "$ARCHIVE_DIR/benchmark_reports_before"; set -a; . ./.env; set +a; /usr/bin/time -p -o "$TIMELOG" node server/run-pipeline.cjs --config configs/cod-test.yaml --clean-live-digital-twin --verbose 2>&1 | tee "$LOG"`

Runtime / completion status:
- Wall-clock runtime from `.logs/cod-test-20260408-151429-ee-s2nv-post-fix-rerun.time`: `real 941.06` seconds.
- The rerun completed Phase 1, then failed in Phase 2 on chunk 25/29.
- Exact failure from `.logs/cod-test-20260408-151429-ee-s2nv-post-fix-rerun.log`:
  - `Chunk 25 failed after 2 attempts: OpenRouter: No content in response`
- Because Phase 2 failed, the rerun never reached fresh Phase 3 benchmark/report generation.

Prompt / context path verification:
- Dialogue capture still used `output/cod-test/phase1-gather-context/raw/ai/dialogue-transcription/attempt-01/capture.json`, pointing at prompt snapshot `output/cod-test/_meta/ai/_prompts/73ebdfb2dc8cdafee4aff26a215009db44de4f057474f354b842e58d2b7f67b5.json`.
- Music-vocals capture still used `output/cod-test/phase1-gather-context/raw/ai/music-vocals-whole-asset/attempt-01/capture.json`, pointing at prompt snapshot `output/cod-test/_meta/ai/_prompts/cbaf3b5db1fb6872073fe8f78a71085d7178391fe831e4a4540f13a090def536.json`.
- Chunked-video prompt path definitively changed versus the archived previous run:
  - previous archived chunk prompt: `output/_archives/cod-test-pre-ee-s2nv-20260408-151429/cod-test/_meta/ai/_prompts/37c88465c2354615c4e725eb2a51ad4a6989e80fa0d053989722199c283a4824.json`
  - new run chunk prompt: `output/cod-test/_meta/ai/_prompts/5dee59381b3c108102467950e632c189d82c2c2dd92a4732bc968d873034293b.json`
- Verified the new chunk prompt contains the post-fix global-support framing:
  - `## Global Dialogue Context (ordered support only)`
  - `## Global Music Context (support only)`
  - `## Global Music-Vocals Context (ordered support only)`
  - `The attached chunk is the only authoritative evidence for what is present in this chunk.`
- `configs/cod-test.yaml` exercised only the chunked-video path in this rerun (`server/scripts/process/video-chunks.cjs`); no whole-video analysis script ran here, so whole-video prompt behavior was not live-tested by this config.

Fresh dialogue / music-vocals artifact findings:
- Current dialogue artifact: `output/cod-test/phase1-gather-context/dialogue-data.reconciled.json`
- Current music-vocals artifact: `output/cod-test/phase1-gather-context/music-vocals-data.reconciled.json`
- Previous comparison baseline:
  - `output/_archives/cod-test-pre-ee-s2nv-20260408-151429/cod-test/phase1-gather-context/dialogue-data.reconciled.json`
  - `output/_archives/cod-test-pre-ee-s2nv-20260408-151429/cod-test/phase1-gather-context/music-vocals-data.reconciled.json`
- Timing strip verification succeeded:
  - current final `dialogue_segments[*]` have no `start` / `end`
  - current final `vocal_segments[*]` have no `start` / `end`
  - the archived previous dialogue artifact still carried timing, so this change is visible in the live artifact shape.

Lyric-bleed / reconciliation comparison:
- Previous archived dialogue already had lyric bleed (`Obey your master`, `Master`, `Come crawling faster`), but the new rerun did **not** remove it.
- New current dialogue still contains lyric-heavy dialogue entries:
  - `Speaker 9: Obey your master, master...`
  - `Speaker 9: Come crawling faster...`
  - `Speaker 9: Master, master...`
  - `Speaker 9: Obey your master...`
- Compared with the archived previous run, lyric bleed looks slightly worse in the fresh dialogue output because the phrases are now more complete and occupy 4 entries instead of the previous 3 lyric-tainted entries.
- Reconciliation still did not clean the dialogue lane in this case:
  - current reconciliation ledger: `output/cod-test/phase1-gather-context/famous-song-reconciliation.json`
  - current status: `skipped`
  - current `removedDialogueSegments`: `[]`
  - current `lyricCorrections`: `[]`
- The new reconciliation gate path is clearly live, because the skip reason changed from the archived previous run:
  - previous archived reasons: `hasTimeRanges`, `overlapsVocalSegments`
  - current reasons: `hasSupportingMusicConsensus`
- Interpretation: the index-only reconciliation gate replaced the old timing blockers, but in this rerun it still did **not** actually remove likely lyrics from dialogue.

Music-vocals comparison:
- Previous archived reconciled music-vocals output had 11 segments; the fresh rerun has 10.
- Both runs still recognize the same song content and preserve the main lyric order broadly, but the fresh rerun dropped the final trailing `Obey your master` line that existed in the archived previous run.
- Net: no clear benchmark-quality improvement in music-vocals content from this rerun; structure remains index-only, but coverage is not obviously healthier.

Video-related findings:
- Fresh partial Phase 2 output exists under `output/cod-test/phase2-process/raw/` for chunks `0..24`, with successful analyzed captures through chunk 24 and failure captures for chunk 25 attempt 1/2.
- No fresh `output/cod-test/phase2-process/chunk-analysis.json` was produced because the process failed before the final phase2 artifact was written.
- The prompt change is real, but the captured new chunk prompt also shows a likely regression: each lane dataset is duplicated inside the prompt.
  - dialogue indices `0..19` appear twice
  - music global support entries appear twice
  - music-vocals indices `0..9` appear twice
- That means the new global-context path is active, but the claimed canonical one-copy-per-lane injection did **not** hold cleanly in the captured prompt for this rerun.

Benchmark behavior under the new global-context rules:
- No fresh benchmark packet was generated because the rerun failed in Phase 2 before benchmark execution.
- The live benchmark directory remained byte-identical to the archived pre-rerun copy. Verified matching SHA-256 for at least:
  - `output/_archives/cod-test-pre-ee-s2nv-20260408-151429/benchmark_reports_before/benchmark-summary.json`
  - `output/_archives/cod-test-pre-ee-s2nv-20260408-151429/benchmark_reports_before/artifact-results/dialogueData.json`
  - `output/_archives/cod-test-pre-ee-s2nv-20260408-151429/benchmark_reports_before/artifact-results/musicVocalsData.json`
  - `output/_archives/cod-test-pre-ee-s2nv-20260408-151429/benchmark_reports_before/artifact-results/chunkAnalysis.json`
  against the same files under `benchmarks/fixtures/cod-test/_reports/`.
- So there is no honest new benchmark result to attribute to the global-context prompt change from this rerun.

Verification steps performed:
- Verified the archive directory and copied benchmark packet exist.
- Inspected rerun log/time files and the Phase 2 failure payloads.
- Inspected capture JSON files and referenced prompt snapshot files to confirm which prompt paths were used.
- Compared archived-vs-current dialogue and music-vocals artifacts directly.
- Verified timing fields are absent from the fresh final dialogue/music-vocals artifacts.
- Compared pre-rerun and current benchmark report files by content hash to confirm the benchmark packet was unchanged after the failure.

---

### Task 17: Switch cod-test from chunked Phase 2 process to whole-video process lane

**Bead ID:** `ee-5v74`
**SubAgent:** `coder`
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, work on bead ee-5v74. First claim it with `bd update ee-5v74 --status in_progress --json`. Switch the cod-test configuration from the video-chunks strategy to the whole-video strategy. Scope: - Update `configs/cod-test.yaml` and any narrowly related config references needed so this test exercises the whole-video path instead of chunked video. - Keep the config change narrow to cod-test. - Update or add focused tests/config assertions if the repo has coverage for this config shape. - Update the plan file `.plans/2026-04-08-research-timestamp-tooling-and-audit-dialogue-capture-prompt.md` with exact files changed and verification steps. - Do not run cod-test yet in this task. Constraints: - Do not broaden into unrelated config changes. - Preserve the rest of the cod-test intent. - Prefer minimal diff. When done: - run any focused verification available for the config change - close the bead with `bd close ee-5v74 --reason "cod-test switched to whole-video strategy" --json`.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `configs/`
- `test/pipeline/`

**Files Created/Deleted/Modified:**
- `.plans/2026-04-08-research-timestamp-tooling-and-audit-dialogue-capture-prompt.md`
- `configs/cod-test.yaml`
- `test/pipeline/config-loader.test.js`

**Status:** ✅ Complete

**Results:** Switched `configs/cod-test.yaml` Phase 2 process script from `server/scripts/process/video-chunks.cjs` to `server/scripts/process/whole-video-mimo.cjs` so cod-test now exercises the whole-video process lane. Kept the change narrow to cod-test config and did not run cod-test itself. Added a focused config assertion in `test/pipeline/config-loader.test.js` (`should keep cod-test process lane on whole-video-mimo`) to guard against accidental regression back to chunked processing.

Focused verification steps run:
- `node --test test/pipeline/config-loader.test.js`
- Result: pass (55/55)

---

### Task 18: Relax supporting-music consensus gate for dialogue lyric cleanup

**Bead ID:** `ee-rxr1`
**SubAgent:** `coder`
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, work on bead ee-rxr1. First claim it with `bd update ee-rxr1 --status in_progress --json`. Remove or relax the remaining `hasSupportingMusicConsensus` gate that is still blocking dialogue lyric cleanup in famous-song reconciliation. Scope: - Keep the reconciliation logic understandable and narrow. - Preserve strong-song evidence gating, but do not require supporting music-lane consensus if the dialogue/music-vocals evidence is already strong enough. - Update focused tests to cover the new gate behavior and prevent regression. - Update the plan file `.plans/2026-04-08-research-timestamp-tooling-and-audit-dialogue-capture-prompt.md` with exact files changed, the revised gate logic, and tests run. - Do not rerun cod-test yet. Constraints: - Do not reintroduce time-based requirements. - Avoid making lyric cleanup too permissive without strong evidence. - Keep the behavior documentable. When done: - run focused reconciliation tests - close the bead with `bd close ee-rxr1 --reason "Supporting-music-consensus gate relaxed for dialogue cleanup" --json`.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `server/scripts/get-context/`
- `test/scripts/`

**Files Created/Deleted/Modified:**
- `.plans/2026-04-08-research-timestamp-tooling-and-audit-dialogue-capture-prompt.md`
- `server/scripts/get-context/reconcile-famous-song-phase1.cjs`
- `test/scripts/reconcile-famous-song-phase1.test.js`

**Status:** ✅ Complete

**Results:** Relaxed the `hasSupportingMusicConsensus` gate in `buildRecognitionGate` so supporting-music consensus is only required when dialogue/music-vocals lyric evidence is not already strong. Strong cross-lane evidence now means both lanes have lyric text evidence and ordered index evidence; when that condition is true, reconciliation can proceed even if `musicData.recognizedSong` is weak/possible. Strong-song safeguards are still required (`statusRecognized`, `confidenceStrong`, single candidate, no multiple songs, sufficient matched lyrics). Added gate evidence flags (`hasStrongDialogueVocalsEvidence`, `requiresSupportingMusicConsensus`, `hasSupportingMusicConsensus`) to keep the behavior explicit in the ledger and documentable in audits.

Focused verification steps run:
- `node --test test/scripts/reconcile-famous-song-phase1.test.js`
- Result: pass (11/11)

### Task 19: Remove duplicate lane-context injection in video prompts

**Bead ID:** `ee-q17j`
**SubAgent:** `coder`
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, work on bead ee-q17j. First claim it with bd update ee-q17j --status in_progress --json. Fix duplicate lane-context injection in video prompts. Scope: inspect chunked/whole-video prompt/context assembly and eliminate duplicate injection of the same lane dataset; preserve one canonical artifact per lane (reconciled preferred, raw/final fallback); update focused tests so duplication is caught explicitly; update this plan with exact files changed, dedupe rule, and tests run; do not rerun cod-test yet. Constraints: keep the fix narrow, do not reintroduce chunk-local timing logic, attached media remains authoritative and lane context support-only. Then run focused prompt/context tests and close bead with bd close ee-q17j --reason "Duplicate lane-context injection removed" --json.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `server/scripts/process/`
- `test/scripts/`

**Files Created/Deleted/Modified:**
- `.plans/2026-04-08-research-timestamp-tooling-and-audit-dialogue-capture-prompt.md`
- `server/scripts/process/video-chunks.cjs`
- `server/scripts/process/whole-video-mimo.cjs`
- `test/scripts/video-chunks.test.js`
- `test/scripts/whole-video-mimo.test.js`

**Status:** ✅ Complete

**Results:** Fixed lane-context selection in both chunked and whole-video process paths so each lane injects exactly one canonical artifact into prompts.

Dedupe/canonical rule now enforced at both injection points:
- Candidate priority per lane: `*Reconciled` → raw lane artifact → `*Final`.
- Inject only the first valid object from that ordered set.
- No concatenation/merging of multiple variants for the same lane in prompt context assembly.

Focused prompt/context tests added/updated:
- `test/scripts/video-chunks.test.js`
  - `uses one canonical lane artifact (reconciled preferred over raw/final) for chunk prompt context`
  - `falls back to lane final artifact when reconciled/raw are unavailable`
- `test/scripts/whole-video-mimo.test.js`
  - `injects one canonical lane dataset per section (reconciled preferred, raw/final fallback)`

Focused tests run:
- `node --test test/scripts/video-chunks.test.js test/scripts/whole-video-mimo.test.js`
- Result: pass (42/42)

---

### Task 20: Rerun real cod-test on the whole-video Phase 2 lane after the latest fixes, then compare against the immediately previous archived run

**Bead ID:** `ee-uofg`
**SubAgent:** `research`
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, work on bead ee-uofg. First claim it with bd update ee-uofg --status in_progress --json. Rerun the real provider-backed configs/cod-test.yaml pipeline after the latest fixes: - whole-video strategy instead of chunked-video - duplicate lane-context injection removed - supporting-music-consensus reconciliation blocker relaxed - index-only reconciliation/artifact/global-context work already landed Scope: - Preserve/archive the current cod-test output and benchmark reports before rerunning. - Run the real pipeline. - Verify the new whole-video prompt/context path is actually being used. - Inspect fresh dialogue/music-vocals/video-related outputs and benchmark reports. - Compare against the immediately previous archived run, especially for: - whether whole-video Phase 2 now completes cleanly - whether reconciliation now removes likely lyrics from dialogue - whether dialogue coverage improves vs the last run - whether benchmark gets farther / produces fresh reports - Update the plan file .plans/2026-04-08-research-timestamp-tooling-and-audit-dialogue-capture-prompt.md with exact commands, artifact paths, findings, and verification steps. Constraints: - Be truthful if the rerun still fails. - Prefer concrete artifact/report paths. - Do not broaden into unrelated refactors. When done: - close the bead with bd close ee-uofg --reason "Whole-video post-fix cod-test rerun completed and compared" --json.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `output/_archives/`
- `output/cod-test/`
- `.logs/`
- `benchmarks/fixtures/cod-test/_reports/`

**Files Created/Deleted/Modified:**
- `.plans/2026-04-08-research-timestamp-tooling-and-audit-dialogue-capture-prompt.md`
- `output/_archives/cod-test-pre-ee-uofg-20260408-155355/`
- `output/cod-test/phase1-gather-context/dialogue-data.json`
- `output/cod-test/phase1-gather-context/dialogue-data.reconciled.json`
- `output/cod-test/phase1-gather-context/music-vocals-data.json`
- `output/cod-test/phase1-gather-context/music-vocals-data.reconciled.json`
- `output/cod-test/phase1-gather-context/famous-song-reconciliation.json`
- `output/cod-test/_meta/ai/_prompts/73ebdfb2dc8cdafee4aff26a215009db44de4f057474f354b842e58d2b7f67b5.json`
- `output/cod-test/_meta/ai/_prompts/cbaf3b5db1fb6872073fe8f78a71085d7178391fe831e4a4540f13a090def536.json`
- `output/cod-test/_meta/ai/_prompts/b8b7a72a10c7201370f2226399c3440ff6a187abed14738d65ee6575279b827c.json`
- `output/cod-test/phase2-process/raw/ai/whole-video/attempt-01/capture.json`
- `output/cod-test/phase2-process/whole-video-analysis.json`
- `output/cod-test/phase2-process/script-results/whole-video-mimo.success.json`
- `output/cod-test/phase3-report/metrics/metrics.json`
- `output/cod-test/phase3-report/recommendation/recommendation.json`
- `output/cod-test/phase3-report/emotional-analysis/emotional-data.json`
- `output/cod-test/phase3-report/summary/summary.json`
- `output/cod-test/phase3-report/summary/FINAL-REPORT.md`
- `.logs/cod-test-20260408-155355-ee-uofg-whole-video-rerun.log`
- `.logs/cod-test-20260408-155355-ee-uofg-whole-video-rerun.time`
- `benchmarks/fixtures/cod-test/_reports/artifact-results/dialogueData.json`
- `benchmarks/fixtures/cod-test/_reports/artifact-results/musicVocalsData.json`

**Status:** ✅ Complete

**Results:**

Archive / preservation work completed first:
- Archived the immediately previous live run to `output/_archives/cod-test-pre-ee-uofg-20260408-155355/cod-test/`.
- Copied the then-current benchmark packet to `output/_archives/cod-test-pre-ee-uofg-20260408-155355/benchmark_reports_before/`.
- This preserved the exact before-state used for the comparison below.

Exact commands executed:
- Claim bead:
  - `bd update ee-uofg --status in_progress --json`
- Preserve old run + reports, then start the rerun:
  - `set -euo pipefail; mkdir -p .logs output/_archives; TS=$(date +%Y%m%d-%H%M%S); ARCHIVE_DIR="output/_archives/cod-test-pre-ee-uofg-$TS"; LOG=".logs/cod-test-$TS-ee-uofg-whole-video-rerun.log"; TIMELOG=".logs/cod-test-$TS-ee-uofg-whole-video-rerun.time"; mkdir -p "$ARCHIVE_DIR"; if [ -d output/cod-test ]; then mv output/cod-test "$ARCHIVE_DIR/"; fi; if [ -d benchmarks/fixtures/cod-test/_reports ]; then cp -a benchmarks/fixtures/cod-test/_reports "$ARCHIVE_DIR/benchmark_reports_before"; fi; set -a; . ./.env; set +a; /usr/bin/time -p -o "$TIMELOG" node server/run-pipeline.cjs --config configs/cod-test.yaml --clean-live-digital-twin --verbose 2>&1 | tee "$LOG"`

Runtime / completion status:
- Wall-clock runtime from `.logs/cod-test-20260408-155355-ee-uofg-whole-video-rerun.time`: `real 421.91` seconds.
- The rerun completed Phase 1, Phase 2, and Phase 3 successfully.
- The overall pipeline command still exited non-zero during the benchmark stage.
- Exact failure from `.logs/cod-test-20260408-155355-ee-uofg-whole-video-rerun.log`:
  - `Produced artifact missing for chunkAnalysis: /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/output/cod-test/phase2-process/chunk-analysis.json`
- Interpretation: the whole-video Phase 2 path itself now completes cleanly, but benchmark wiring is still pinned to the old chunk-analysis artifact name/path.

Whole-video prompt / context path verification:
- `configs/cod-test.yaml` is now on `server/scripts/process/whole-video-mimo.cjs` and the live rerun actually exercised it.
- Phase 2 capture path: `output/cod-test/phase2-process/raw/ai/whole-video/attempt-01/capture.json`.
- That capture points at whole-video prompt snapshot `output/cod-test/_meta/ai/_prompts/b8b7a72a10c7201370f2226399c3440ff6a187abed14738d65ee6575279b827c.json`.
- Verified the prompt snapshot is the whole-video path (`WHOLE-VIDEO MIMO PHASE 2 TASK`) and contains the support-only framing:
  - `Use the Phase 1 lane artifacts below as optional supporting context only.`
  - `Dialogue, music, and music-vocals entries are provided as full ordered lane datasets for global context.`
  - `If the attached video conflicts with prior structured context, trust the video.`
- Dialogue capture still used prompt snapshot `output/cod-test/_meta/ai/_prompts/73ebdfb2dc8cdafee4aff26a215009db44de4f057474f354b842e58d2b7f67b5.json`, which still contains the preservation-first wording.
- Music-vocals capture still used prompt snapshot `output/cod-test/_meta/ai/_prompts/cbaf3b5db1fb6872073fe8f78a71085d7178391fe831e4a4540f13a090def536.json`, which still contains the index-only chronology wording.

Fresh artifact outputs inspected:
- Dialogue artifact: `output/cod-test/phase1-gather-context/dialogue-data.reconciled.json`
- Music-vocals artifact: `output/cod-test/phase1-gather-context/music-vocals-data.reconciled.json`
- Reconciliation ledger: `output/cod-test/phase1-gather-context/famous-song-reconciliation.json`
- Whole-video Phase 2 artifact: `output/cod-test/phase2-process/whole-video-analysis.json`
- Whole-video script result: `output/cod-test/phase2-process/script-results/whole-video-mimo.success.json`
- Phase 3 outputs:
  - `output/cod-test/phase3-report/metrics/metrics.json`
  - `output/cod-test/phase3-report/recommendation/recommendation.json`
  - `output/cod-test/phase3-report/emotional-analysis/emotional-data.json`
  - `output/cod-test/phase3-report/summary/summary.json`
  - `output/cod-test/phase3-report/summary/FINAL-REPORT.md`
- Benchmark packet touched during the failing benchmark stage:
  - `benchmarks/fixtures/cod-test/_reports/artifact-results/dialogueData.json`
  - `benchmarks/fixtures/cod-test/_reports/artifact-results/musicVocalsData.json`
  - `benchmarks/fixtures/cod-test/_reports/benchmark-summary.json`

Comparison against the immediately previous archived run:
- Previous archived baseline:
  - `output/_archives/cod-test-pre-ee-uofg-20260408-155355/cod-test/phase1-gather-context/dialogue-data.reconciled.json`
  - `output/_archives/cod-test-pre-ee-uofg-20260408-155355/cod-test/phase1-gather-context/music-vocals-data.reconciled.json`
  - `output/_archives/cod-test-pre-ee-uofg-20260408-155355/cod-test/phase2-process/script-results/video-chunks.failure.json`
  - `output/_archives/cod-test-pre-ee-uofg-20260408-155355/benchmark_reports_before/...`

Dialogue coverage / reconciliation findings:
- Dialogue coverage regressed catastrophically versus the archived previous run.
- Archived previous run had 20 reconciled dialogue segments.
- Fresh whole-video rerun produced `0` dialogue segments in both `dialogue-data.json` and `dialogue-data.reconciled.json`.
- Coverage moved from archived `{"start":0,"end":135,"duration":135,"complete":false}` to current `{"start":0,"end":0,"duration":0,"complete":false}`.
- Because the dialogue lane was empty, reconciliation did **not** remove likely lyrics from dialogue in any meaningful way.
- The fresh reconciliation ledger still ended `status: skipped` with skip reason `hasSupportingMusicConsensus`, `removedDialogueSegments: []`, and `lyricCorrections: []`.
- This means the relaxed blocker did not help on this run because the dialogue lane collapsed to zero segments before cleanup.

Music-vocals findings:
- Archived previous run had 10 reconciled vocal segments.
- Fresh whole-video rerun produced only 5 reconciled vocal segments:
  - `Obey your master`
  - `Come crawling faster`
  - `Master of puppets I pull your strings`
  - `Twisting your mind and smashing your dreams`
  - `Blinded by me you can't see a thing`
- Structure remains correctly index-only, but coverage regressed versus the archived previous run.

Video-related / whole-video findings:
- The whole-video Phase 2 lane now completes cleanly and writes `output/cod-test/phase2-process/whole-video-analysis.json` plus `script-results/whole-video-mimo.success.json`.
- The produced analysis is coherent at a whole-video level (for example `patience: 4`, `boredom: 6`, `excitement: 7`).
- Phase 3 also ran to completion and wrote fresh report files, but the resulting `summary.json` is still effectively empty/placeholder (`videoDuration: 0`, `chunksAnalyzed: 0`, empty `averages`) because downstream reporting still assumes chunk-style inputs.

Benchmark behavior / fresh report findings:
- The benchmark got farther than the immediately previous archived run.
- Previous archived run failed in Phase 2 before any fresh benchmark work.
- This rerun reached benchmark execution after Phase 3, then failed on the missing `chunk-analysis.json` artifact.
- `benchmarks/fixtures/cod-test/_reports/benchmark-summary.json` remained byte-identical to the archived copy, so no fresh top-level summary was finalized.
- But benchmark did partially regenerate lane reports before aborting:
  - fresh `artifact-results/dialogueData.json` now reflects the empty dialogue output (`accuracy.passed=0`, `failed=37`, structural error on missing `cleanedTranscript`)
  - fresh `artifact-results/musicVocalsData.json` now reflects the 5-segment music-vocals output (`accuracy.passed=23`, `failed=36`)
- So the benchmark/reporting stack got farther and produced some fresh per-artifact evidence, but it still does not complete cleanly.

Important verification / regression notes:
- The whole-video prompt path is definitely live, but the captured whole-video prompt snapshot still shows duplicated support content in at least two sections:
  - the `Notable music cues` list is duplicated
  - the `Text-bearing music-led vocal moments` list is duplicated
- So the duplicate lane-context fix does not appear fully clean in this real whole-video prompt capture.
- Dialogue preservation-first prompt wording is live, but the provider-backed whole-asset dialogue run nevertheless returned an empty segment list.

Verification steps performed:
- Verified the archive directory and copied benchmark packet exist.
- Verified the rerun log/time files exist and inspected the exact failure.
- Verified `configs/cod-test.yaml` is on `server/scripts/process/whole-video-mimo.cjs`.
- Inspected `output/cod-test/phase2-process/raw/ai/whole-video/attempt-01/capture.json` and the referenced prompt snapshot to confirm the whole-video prompt path was actually used.
- Inspected fresh `dialogue`, `music-vocals`, `reconciliation`, `whole-video-analysis`, and `phase3-report` artifacts directly.
- Compared current dialogue/music-vocals artifacts against the archived previous run.
- Compared current benchmark report hashes/content against the archived copied packet to determine what was and was not freshly regenerated.

---

### Task 21: Investigate why whole-video rerun collapsed dialogue-data to zero segments

**Bead ID:** `ee-qgbp`  
**SubAgent:** `research`  
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, investigate why the latest whole-video cod-test rerun collapsed dialogue output to zero segments. Treat this as a likely coding/integration bug rather than a model-quality issue unless evidence proves otherwise. Trace the whole-video path from prompt/context assembly through provider capture, parser/validator output, normalization, write path, and any post-processing that could erase or replace dialogue segments. Compare the last bad whole-video run against the previous non-empty dialogue run and identify the first point where dialogue disappears or becomes empty. Produce a focused investigation note with concrete root-cause candidates ranked by confidence, exact evidence paths, and the smallest plausible fix. Update this plan with the note path and summary. Do not make live code changes in this task. Claim the bead at start with bd update ee-qgbp --status in_progress --json and close it with bd close ee-qgbp --reason "Whole-video dialogue collapse investigation completed" --json.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `docs/`
- `server/` (review targets)
- `output/` (inspection targets)
- `.logs/` (inspection targets)
- `test/` (inspection targets)

**Files Created/Deleted/Modified:**
- `.plans/2026-04-08-research-timestamp-tooling-and-audit-dialogue-capture-prompt.md`
- `docs/research/2026-04-08-whole-video-dialogue-zero-segments-investigation.md`

**Status:** ✅ Complete

**Results:**
- Wrote the focused investigation note at `docs/research/2026-04-08-whole-video-dialogue-zero-segments-investigation.md`.
- Compared the bad live rerun in `output/cod-test/...` against the immediately previous non-empty archived run in `output/_archives/cod-test-pre-ee-uofg-20260408-155355/cod-test/...`.
- Traced the failure boundary from prompt contract → provider capture → validator output → normalization → artifact write → reconciliation → whole-video prompt assembly.
- The provider payload itself was **not empty** on the bad run: `output/cod-test/phase1-gather-context/raw/ai/dialogue-transcription/attempt-01/capture.json` contains a non-empty response, and `toolLoop.history[1].result.normalizedValue.dialogue_segments` shows **24 accepted dialogue segments** before normalization.
- The first loss point is local normalization in `server/scripts/get-context/get-dialogue.cjs:274-286` (invoked at `1186-1189`): missing `start/end` are coerced to `0..0`, then every segment is dropped by `if (end <= start) return null;`.
- This mismatches the explicit prompt/validator contract, which still allows optional timestamps (`server/scripts/get-context/get-dialogue.cjs:2243-2247`, `server/lib/structured-output.cjs:270-274`, `633-675`).
- Reconciliation did not cause the collapse; it only saw the already-empty lane (`output/cod-test/phase1-gather-context/famous-song-reconciliation.json`).
- Phase 2 whole-video prompt assembly also did not cause the collapse; it consumed the already-empty lane, so the whole-video prompt only retained the dialogue summary and no dialogue moments.
- Ranked conclusion from the note:
  1. **Definite** normalization/contract mismatch is the root cause of the zero-segment collapse.
  2. Provider/model variability around omitted timestamps is only a trigger because the contract explicitly allowed untimed segments.
  3. A secondary resilience gap is the lack of retry/fallback when whole-asset dialogue is non-empty but untimed.
- Smallest plausible fix from the note: preserve untimed dialogue segments during `normalizeDialogueDataToDuration()` instead of coercing missing timestamps to `0..0` and dropping them.

---

### Task 22: Investigate whole-video benchmark/report mismatch vs chunk-analysis expectation

**Bead ID:** `ee-uk93`  
**SubAgent:** `research`  
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, investigate why benchmark/reporting still expects chunk-analysis output after cod-test was switched to the whole-video Phase 2 strategy. Trace the benchmark/report pipeline from config loading through artifact expectation resolution and report generation, identify the exact place where `chunkAnalysis` is still assumed, and produce a focused investigation note with exact file paths, the smallest plausible fix, and any compatibility implications. Update this plan with the note path and summary. Do not make live code changes in this task. Claim the bead at start with bd update ee-uk93 --status in_progress --json and close it with bd close ee-uk93 --reason "Whole-video benchmark/report mismatch investigation completed" --json.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `docs/`
- `server/` (review targets)
- `configs/` (review targets)
- `benchmarks/` (review targets)

**Files Created/Deleted/Modified:**
- `.plans/2026-04-08-research-timestamp-tooling-and-audit-dialogue-capture-prompt.md`
- `docs/research/2026-04-08-whole-video-benchmark-report-chunk-analysis-mismatch.md`

**Status:** ✅ Complete

**Results:** Wrote `docs/research/2026-04-08-whole-video-benchmark-report-chunk-analysis-mismatch.md` as an investigation-only note. Traced the mismatch from config loading through Phase 2 artifact production, Phase 3 report consumption, and benchmark artifact resolution. Main findings: (1) `configs/cod-test.yaml` now correctly runs `server/scripts/process/whole-video-mimo.cjs`, which produces `wholeVideoAnalysis` at `phase2-process/whole-video-analysis.json`; (2) the earliest stale assumption is in Phase 3 reporting, where `metrics.cjs`, `emotional-analysis.cjs`, `summary.cjs`, `final-report.cjs`, and `recommendation.cjs` still consume only `artifacts.chunkAnalysis` / chunk-level summaries, so the whole-video rerun degraded into placeholder report outputs (`videoDuration: 0`, `chunksAnalyzed: 0`, `No usable phase2 chunkAnalysis emotion timeseries was found.`) even though the whole-video artifact was present; (3) the first hard failure is later in `benchmarks/fixtures/cod-test/benchmark.json` + `server/lib/benchmark-runner.cjs`, where cod-test still requires `artifactKey: chunkAnalysis`, `script: video-chunks`, and `phase2-process/chunk-analysis.json`, causing the exact runtime error `Produced artifact missing for chunkAnalysis`; and (4) `server/run-pipeline.cjs` Phase-3-only hydration/guardrails also still hardcode `chunkAnalysis`, which will remain a compatibility trap for skipped-Phase-2 whole-video flows. Smallest plausible fix from the note: stop pretending whole-video output is chunk-analysis; make cod-test benchmark/reporting whole-video-aware (or explicitly skip unsupported chunk-based expectations) rather than aliasing schemas.

---

### Task 23: Investigate why whole-video prompt/context duplication still appears in real runtime

**Bead ID:** `ee-q4cs`  
**SubAgent:** `research`  
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, investigate why duplicated support content still appears in the real provider-backed whole-video prompt capture even after the canonical one-copy-per-lane fix landed. Compare unit-test expectations against the actual captured whole-video prompt, trace the prompt assembly path, and identify the exact duplication source(s). Produce a focused investigation note with exact evidence paths, the first duplication point, ranked root-cause candidates, and the smallest plausible fix. Update this plan with the note path and summary. Do not make live code changes in this task. Claim the bead at start with bd update ee-q4cs --status in_progress --json and close it with bd close ee-q4cs --reason "Whole-video prompt duplication investigation completed" --json.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `docs/`
- `server/` (review targets)
- `output/` (inspection targets)
- `test/` (review targets)

**Files Created/Deleted/Modified:**
- `.plans/2026-04-08-research-timestamp-tooling-and-audit-dialogue-capture-prompt.md`
- `docs/research/2026-04-08-whole-video-prompt-duplication-investigation.md`

**Status:** ✅ Complete

**Results:**
- Wrote `docs/research/2026-04-08-whole-video-prompt-duplication-investigation.md`.
- Compared the real provider-backed whole-video prompt capture in `output/cod-test/phase2-process/raw/ai/whole-video/attempt-01/capture.json` and its referenced prompt snapshot `output/cod-test/_meta/ai/_prompts/b8b7a72a10c7201370f2226399c3440ff6a187abed14738d65ee6575279b827c.json` against the focused whole-video unit test in `test/scripts/whole-video-mimo.test.js`.
- Confirmed the live prompt still duplicates the same 5 `musicData.segments` rows and the same 5 `musicVocalsData.vocal_segments` rows, but the clean Phase 1 lane files on disk (`output/cod-test/phase1-gather-context/music-data.json` and `music-vocals-data.reconciled.json`) remain single-copy.
- Traced the first duplication point to the Phase 1 sequential merge helper in `server/lib/phases/gather-context-runner.cjs`, whose recursive `mergeArtifacts()` concatenates nested arrays when `reconcile-famous-song-phase1.cjs` re-returns `musicData` and `musicVocalsData` under existing keys.
- Verified the merged runtime artifact bag in `output/cod-test/artifacts-complete.json` already contains doubled arrays (`musicData.segments.length === 10`, `musicVocalsData.vocal_segments.length === 10`) before `server/scripts/process/whole-video-mimo.cjs` builds the prompt.
- Ranked conclusion from the note:
  1. **Definite** root cause: upstream Phase 1 same-key merge semantics duplicate nested arrays before whole-video prompt assembly.
  2. **High-confidence contributing mismatch:** live Phase 1 runtime keeps reconciled data under raw keys instead of distinct `*Reconciled` in-memory keys, so unit-test assumptions do not match the real merge path.
  3. **Secondary resilience gap:** whole-video prompt rendering has no defensive dedupe backstop and therefore faithfully prints the already-doubled arrays.
- Smallest plausible fix from the note: change Phase 1 artifact merge semantics so later artifact objects replace nested arrays instead of concatenating them; narrower alternative is to stop the reconciliation script from re-returning pass-through lane artifacts under existing raw keys.

---

### Task 24: Investigate why reconciliation still skips in real whole-video run

**Bead ID:** `ee-kyvo`  
**SubAgent:** `research`  
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, investigate why famous-song reconciliation still ends `skipped` in the real whole-video run even after the gate relaxation work landed. Trace the real-run ledger inputs, gate evidence flags, and lane artifacts to determine the exact remaining condition(s) causing skip in practice. Compare the passing unit-test scenarios against the real captured run data and produce a focused investigation note with exact evidence paths, the first failing condition, ranked root-cause candidates, and the smallest plausible fix. Update this plan with the note path and summary. Do not make live code changes in this task. Claim the bead at start with bd update ee-kyvo --status in_progress --json and close it with bd close ee-kyvo --reason "Real-run reconciliation skip investigation completed" --json.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `docs/`
- `server/` (review targets)
- `output/` (inspection targets)
- `test/` (review targets)

**Files Created/Deleted/Modified:**
- `.plans/2026-04-08-research-timestamp-tooling-and-audit-dialogue-capture-prompt.md`
- `docs/research/2026-04-08-real-run-famous-song-reconciliation-skip-investigation.md`

**Status:** ✅ Complete

**Results:**
- Wrote `docs/research/2026-04-08-real-run-famous-song-reconciliation-skip-investigation.md`.
- Traced the real whole-video skip using the archived stable artifacts in `output/_archives/cod-test-pre-ee-uofg-20260408-155355/cod-test/phase1-gather-context/` and replayed the current `buildRecognitionGate()` logic against those exact files.
- Confirmed the ledger-level skip reason remains `hasSupportingMusicConsensus`, but the first failing condition is earlier: `buildLyricEvidence()` marks the music-vocals hit stream out of order once the real chorus re-enters (`lyricIndex` sequence `0,1,2,3,1,1`), and the dialogue hit stream also fails monotonic order (`0,2,1,0`).
- Because both lanes lose `hasIndexOrderEvidence`, `hasStrongDialogueVocalsEvidence` stays false, the relaxed shortcut never activates, and the gate falls back to the supporting `musicData` lane, which is only `possible`/`0.7` in the captured run.
- Compared against the passing relaxed-gate unit tests and found they only cover clean monotonic unique-fragment scenarios (`makeArtifacts()` seed + weak-music test), not real repeated-chorus/re-entry shapes.
- Smallest plausible fix from the note: make the relaxed-gate order heuristic tolerant of repeated/re-entering lyric fragments (for example first-occurrence or strong-subsequence order) instead of requiring the entire hit stream to remain globally monotonic.

---

### Task 25: Fix real-runtime whole-video prompt/context duplication at the first Phase 1 merge point

**Bead ID:** `ee-yjh4`
**SubAgent:** `coder`
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, work on bead ee-yjh4. First claim it with bd update ee-yjh4 --status in_progress --json. Implement the real-runtime whole-video prompt/context dedupe fix based on the completed investigation. Scope: fix the first duplication point identified in docs/research/2026-04-08-whole-video-prompt-duplication-investigation.md; ensure the merged artifact bag no longer doubles lane arrays when later Phase 1 scripts return overlapping artifact keys; keep the fix narrow and avoid breaking intentional additive merges elsewhere; update focused tests to cover the real duplication mechanism, not just downstream prompt rendering; update this plan with exact files changed, dedupe semantics, and tests run; do not rerun cod-test. When done: run focused tests for gather-context merge and affected prompt paths; close the bead with bd close ee-yjh4 --reason "Whole-video real-runtime duplication fixed" --json.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `server/lib/phases/`
- `test/lib/`

**Files Created/Deleted/Modified:**
- `.plans/2026-04-08-research-timestamp-tooling-and-audit-dialogue-capture-prompt.md`
- `server/lib/phases/gather-context-runner.cjs`
- `test/lib/gather-context-runner.test.js`

**Status:** ✅ Complete

**Results:** Fixed the first real-runtime duplication point in Phase 1 merge logic (`server/lib/phases/gather-context-runner.cjs`).

Dedupe semantics now applied:
- When a later Phase 1 script returns an artifact object under an already-existing top-level key (for example `musicData` / `musicVocalsData` from reconciliation), nested arrays are now **replaced** rather than concatenated.
- Nested object fields still deep-merge, so additive object metadata remains intact.
- Explicit top-level array artifacts retain prior additive merge behavior (concat), preserving intentional additive merges outside overlapping artifact objects.

Focused regression coverage added:
- New test file `test/lib/gather-context-runner.test.js` covering the actual runtime duplication mechanism:
  - sequential same-key object merge no longer doubles nested lane arrays
  - nested object metadata still merges as expected
  - top-level additive array merge behavior remains intact

Focused tests run:
- `node --test test/lib/gather-context-runner.test.js test/scripts/whole-video-mimo.test.js test/scripts/video-chunks.test.js`
- Result: pass (44/44)

---

### Task 25: Preserve untimed whole-asset dialogue segments during normalization

**Bead ID:** `ee-gzaz`  
**SubAgent:** `coder`  
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, work on bead ee-gzaz. First claim it with bd update ee-gzaz --status in_progress --json. Implement the normalization fix for untimed dialogue segments based on the completed investigation. Scope: - Fix normalizeDialogueDataToDuration() / related whole-video dialogue normalization so untimed-but-valid dialogue segments survive normalization. - Preserve the current index-only contract; do not reintroduce mandatory timestamps. - Keep the change narrow and document any remaining assumptions. - Update focused tests to cover untimed accepted dialogue segments surviving to final artifacts. - Update the plan file .plans/2026-04-08-research-timestamp-tooling-and-audit-dialogue-capture-prompt.md with exact files changed and tests run. - Do not rerun cod-test in this task. Evidence to use: - docs/research/2026-04-08-whole-video-dialogue-zero-segments-investigation.md When done: - run focused dialogue normalization tests - close the bead with bd close ee-gzaz --reason "Untimed dialogue normalization fixed" --json.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `server/scripts/get-context/`
- `test/scripts/`

**Files Created/Deleted/Modified:**
- `.plans/2026-04-08-research-timestamp-tooling-and-audit-dialogue-capture-prompt.md`
- `server/scripts/get-context/get-dialogue.cjs`
- `test/scripts/get-dialogue.test.js`

**Status:** ✅ Complete

**Results:** Implemented a narrow fix in `normalizeDialogueDataToDuration()` so untimed-but-valid dialogue segments are preserved instead of being coerced to `0..0` and dropped. The normalizer now:
- keeps segments unchanged when both `start` and `end` are absent,
- still clamps and validates fully timed segments,
- intentionally keeps prior behavior for partially timed segments (only one bound present): those are still dropped.

Added focused regression coverage in `test/scripts/get-dialogue.test.js` (`preserves untimed whole-asset dialogue segments through final artifacts`) that simulates a whole-asset response with untimed segments and asserts they survive to final index-only artifacts with expected ordering and coverage semantics (`0..0` when no timed segments exist).

Focused tests run:
- `node --test test/scripts/get-dialogue.test.js`
- Result: pass (36/36).

---

### Task 26: Update benchmark/report pipeline for whole-video cod-test compatibility

**Bead ID:** `ee-s2ew`  
**SubAgent:** `coder`

**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, work on bead ee-s2ew. First claim it with bd update ee-s2ew --status in_progress --json. Implement the whole-video benchmark/report pipeline fix based on the completed investigation. Cod-test now uses the whole-video Phase 2 lane, so reporting and benchmarking must stop hard-requiring chunk-analysis for this config. Scope: update benchmark/report pipeline for whole-video cod-test mode truthfully; fix the first stale reporting assumption and first hard benchmark failure; avoid aliasing wholeVideoAnalysis to chunkAnalysis; keep diff narrow; update focused tests and this plan; do not rerun cod-test. Close with bd close ee-s2ew --reason "Whole-video benchmark/report pipeline updated" --json.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `server/scripts/report/`
- `benchmarks/fixtures/cod-test/`
- `test/scripts/`
- `test/pipeline/`

**Files Created/Deleted/Modified:**
- `.plans/2026-04-08-research-timestamp-tooling-and-audit-dialogue-capture-prompt.md`
- `server/scripts/report/metrics.cjs`
- `benchmarks/fixtures/cod-test/benchmark.json`
- `test/scripts/report-phase3-fallback.test.js`
- `test/pipeline/config-loader.test.js`

**Status:** ✅ Complete

**Results:** Implemented the narrow whole-video compatibility pair without schema aliasing.

Chosen compatibility approach:
- **Reporting (first stale assumption fixed):** made `metrics.cjs` explicitly whole-video-aware instead of implicitly treating missing `chunkAnalysis` as generic failure.
  - If `chunkAnalysis` exists: unchanged computed path (`derived-from-phase2.chunkAnalysis`).
  - If only `wholeVideoAnalysis` exists: emit truthful non-chunk status (`state: not_applicable`, `dataSource: phase2.wholeVideoAnalysis`) and preserve `summary.videoDuration` from `wholeVideoAnalysis.input.durationSeconds`.
  - No `wholeVideoAnalysis -> chunkAnalysis` aliasing was introduced.
- **Benchmarking (first hard failure fixed):** removed stale cod-test `chunkAnalysis` artifact requirement from `benchmarks/fixtures/cod-test/benchmark.json` so whole-video cod-test no longer hard-requires `phase2-process/chunk-analysis.json`.

Focused tests run:
- `node --test test/scripts/report-phase3-fallback.test.js test/pipeline/config-loader.test.js test/lib/benchmark-runner.test.js`
- Result: pass (83/83)

### Task 27: Fix real-run reconciliation activation for repeated/re-entry lyric patterns

**Bead ID:** `ee-153f`  
**SubAgent:** `coder`
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, work on bead ee-153f. First claim it with bd update ee-153f --status in_progress --json. Implement the real-run reconciliation fix based on the completed investigation. Scope: update the order heuristic in famous-song reconciliation so the relaxed gate can actually activate on real repeated-chorus / lyric re-entry patterns; use one of the narrow fixes identified in docs/research/2026-04-08-real-run-famous-song-reconciliation-skip-investigation.md (first-occurrence ordering or strong-subsequence ordering), whichever is the smallest truthful fix; keep strong-song safeguards intact; update focused tests to cover the real repeated/re-entry pattern that currently fails; update this plan with exact files changed, revised heuristic, and tests run; do not rerun cod-test. Then run focused reconciliation tests and close bead with bd close ee-153f --reason "Real-run reconciliation activation fixed" --json.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `server/scripts/get-context/`
- `test/scripts/`

**Files Created/Deleted/Modified:**
- `.plans/2026-04-08-research-timestamp-tooling-and-audit-dialogue-capture-prompt.md`
- `server/scripts/get-context/reconcile-famous-song-phase1.cjs`
- `test/scripts/reconcile-famous-song-phase1.test.js`

**Status:** ✅ Complete

**Results:** Implemented a narrow **strong-subsequence ordering** update inside `buildLyricEvidence()` so repeated/re-entry lyric streams do not fail order evidence on a single backward jump. The heuristic now evaluates order from first occurrences of matched lyric indexes and accepts evidence when the longest non-decreasing subsequence is nearly complete (`>= firstOccurrenceCount - 1`, minimum 2).

This preserves existing strong-song safeguards unchanged (`statusRecognized`, confidence threshold, single candidate, no multi-song ambiguity, minimum matched lyrics), while allowing the relaxed gate shortcut to activate on real chorus/re-entry patterns instead of always forcing weak supporting-music consensus fallback.

Focused regression coverage added:
- `allows relaxed gate for repeated/re-entry lyric order when first occurrences have a strong ordered subsequence`
  - models real-shape re-entry (`0,2,1,0` dialogue plus repeated chorus returns in vocals)
  - verifies reconciliation applies even when `musicData.recognizedSong` is weak/possible
  - verifies strong cross-lane evidence becomes true and supporting consensus is not required

Focused tests run:
- `node --test test/scripts/reconcile-famous-song-phase1.test.js`
- Result: pass (12/12)

### Task 28: Rerun real cod-test on the whole-video Phase 2 lane after the investigation-backed fixes, then compare against the immediately previous archived run

**Bead ID:** `ee-elc5`  
**SubAgent:** `research`
**Prompt:** `In /home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine, work on bead ee-elc5. First claim it with bd update ee-elc5 --status in_progress --json. Rerun the real provider-backed configs/cod-test.yaml pipeline after all four whole-video investigation-backed fixes have landed: whole-video benchmark/report compatibility fix; real-runtime whole-video prompt/context dedupe fix; untimed dialogue normalization fix; real-run reconciliation activation fix. Scope: preserve/archive the current cod-test output and benchmark reports before rerunning; run the real pipeline; verify the whole-video path is still the one being used; inspect fresh dialogue/music-vocals/reconciliation/whole-video/report/benchmark outputs; compare against the immediately previous archived whole-video run, especially for whether dialogue survives and is non-empty, whether duplicated support content is gone from the real whole-video prompt capture, whether reconciliation now actually removes likely lyric bleed from dialogue, and whether benchmark/reporting now completes cleanly in whole-video mode; update this plan with exact commands, artifact paths, findings, and verification steps; then close the bead with bd close ee-elc5 --reason "Post-fix whole-video cod-test rerun completed and compared" --json.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `.logs/`
- `output/_archives/`
- `output/cod-test/`
- `benchmarks/fixtures/cod-test/_reports/`

**Files Created/Deleted/Modified:**
- `.plans/2026-04-08-research-timestamp-tooling-and-audit-dialogue-capture-prompt.md`
- `.logs/cod-test-20260408-171347-ee-elc5-post-fix-whole-video-rerun.log`
- `.logs/cod-test-20260408-171347-ee-elc5-post-fix-whole-video-rerun.time`
- `output/_archives/cod-test-pre-ee-elc5-20260408-171347/cod-test/**`
- `output/_archives/cod-test-pre-ee-elc5-20260408-171347/benchmark_reports_before/**`
- `output/cod-test/phase1-gather-context/dialogue-data.json`
- `output/cod-test/phase1-gather-context/dialogue-data.reconciled.json`
- `output/cod-test/phase1-gather-context/music-vocals-data.json`
- `output/cod-test/phase1-gather-context/music-vocals-data.reconciled.json`
- `output/cod-test/phase1-gather-context/famous-song-reconciliation.json`
- `output/cod-test/phase2-process/raw/ai/whole-video/attempt-01/capture.json`
- `output/cod-test/phase2-process/whole-video-analysis.json`
- `output/cod-test/phase2-process/script-results/whole-video-mimo.success.json`
- `output/cod-test/phase3-report/metrics/metrics.json`
- `output/cod-test/phase3-report/emotional-analysis/emotional-data.json`
- `output/cod-test/phase3-report/recommendation/recommendation.json`
- `output/cod-test/phase3-report/summary/summary.json`
- `output/cod-test/phase3-report/summary/FINAL-REPORT.md`
- `benchmarks/fixtures/cod-test/_reports/benchmark-summary.json`
- `benchmarks/fixtures/cod-test/_reports/artifact-results/dialogueData.json`
- `benchmarks/fixtures/cod-test/_reports/artifact-results/musicVocalsData.json`

**Status:** ✅ Complete

**Results:** Archived the pre-rerun packet to `output/_archives/cod-test-pre-ee-elc5-20260408-171347/`, reran the real provider-backed whole-video cod-test, and compared the fresh outputs against that immediately previous archived whole-video run.

Exact rerun command:
- `set -euo pipefail; mkdir -p .logs output/_archives; TS=$(date +%Y%m%d-%H%M%S); ARCHIVE_DIR="output/_archives/cod-test-pre-ee-elc5-$TS"; LOG=".logs/cod-test-$TS-ee-elc5-post-fix-whole-video-rerun.log"; TIMELOG=".logs/cod-test-$TS-ee-elc5-post-fix-whole-video-rerun.time"; mkdir -p "$ARCHIVE_DIR"; if [ -d output/cod-test ]; then mv output/cod-test "$ARCHIVE_DIR/"; fi; if [ -d benchmarks/fixtures/cod-test/_reports ]; then cp -a benchmarks/fixtures/cod-test/_reports "$ARCHIVE_DIR/benchmark_reports_before"; fi; set -a; . ./.env; set +a; /usr/bin/time -p -o "$TIMELOG" node server/run-pipeline.cjs --config configs/cod-test.yaml --clean-live-digital-twin --verbose 2>&1 | tee "$LOG"`

Runtime / exit result:
- Wall-clock runtime from `.logs/cod-test-20260408-171347-ee-elc5-post-fix-whole-video-rerun.time`: `real 269.01` seconds.
- The pipeline still exited non-zero at benchmark time. Exact failure from `.logs/cod-test-20260408-171347-ee-elc5-post-fix-whole-video-rerun.log`:
  - `Benchmark error: 0/6 artifacts passed. 92/347 scoreable fields passed. Truth coverage was 347/725 fields.`

Whole-video path verification:
- Verified `configs/cod-test.yaml` still runs `server/scripts/process/whole-video-mimo.cjs`.
- Verified the live rerun wrote `output/cod-test/phase2-process/raw/ai/whole-video/attempt-01/capture.json` and `output/cod-test/phase2-process/whole-video-analysis.json`.
- The capture references prompt snapshot `output/cod-test/_meta/ai/_prompts/68ceba8396eba43cf1cf1348a0ebe6a8ad3af97d979022d0b0a90b26f552f0f1.json`, which contains `WHOLE-VIDEO MIMO PHASE 2 TASK`, so the rerun definitely exercised the whole-video prompt path.

Dialogue / music-vocals comparison vs the immediately previous archived whole-video run (`output/_archives/cod-test-pre-ee-elc5-20260408-171347/cod-test/`):
- **Dialogue recovered from empty to non-empty.**
  - Previous archived run: `0` reconciled dialogue segments in `phase1-gather-context/dialogue-data.reconciled.json`.
  - Fresh run: `30` reconciled dialogue segments in `output/cod-test/phase1-gather-context/dialogue-data.reconciled.json`.
  - This confirms the untimed-dialogue normalization fix landed in real runtime, not just tests.
- **But dialogue now contains heavy lyric bleed.**
  - Fresh dialogue includes lyric lines such as `Obey your master, master.`, `Come crawling faster.`, `Master of puppets, I'm pulling your strings.`, `Twisting your mind and smashing your dreams.`, `Blinded by me, you can't see a thing.`, and repeated `Master, master.`
  - Previous archived run had no dialogue, so this is an improvement in survival/coverage but not a clean final dialogue lane.
- **Music-vocals regressed in coverage.**
  - Previous archived run had `5` reconciled vocal segments (`Obey your master`, `Come crawling faster`, `Master of puppets I pull your strings`, `Twisting your mind and smashing your dreams`, `Blinded by me you can't see a thing`).
  - Fresh run has only `2` reconciled vocal segments (`Obey your master`, `Master, master`).

Reconciliation findings:
- `output/cod-test/phase1-gather-context/famous-song-reconciliation.json` still ends with `"status": "skipped"`.
- It still reports `trigger.reasons: ["hasSupportingMusicConsensus"]` and records no `removedDialogueSegments` and no `lyricCorrections`.
- So the real-run reconciliation activation fix did **not** actually remove the lyric bleed from the fresh dialogue output in this provider-backed rerun.

Whole-video prompt/context dedupe findings:
- The previous archived prompt snapshot duplicated whole support sections (`# MUSIC CONTEXT` had duplicated `Notable music cues`, and `# MUSIC VOCALS CONTEXT` duplicated the entire vocal moments list).
- The fresh prompt snapshot no longer shows duplicated section injection:
  - `# DIALOGUE CONTEXT`: 1 copy
  - `# MUSIC CONTEXT`: 1 copy
  - `# MUSIC VOCALS CONTEXT`: 1 copy
  - `Notable music cues:` count is `1` (was effectively duplicated in the archived prompt)
  - `Text-bearing music-led vocal moments:` count is `1` (was duplicated in the archived prompt)
- Important nuance: lyric phrases still appear multiple times in the full prompt, but that is now because the dialogue lane itself contains lyric bleed plus the separate music-vocals lane, not because the whole-video support blocks were injected twice.

Benchmark / report compatibility findings:
- This rerun got meaningfully farther than the archived pre-fix whole-video run:
  - Phase 3 completed and wrote fresh report artifacts instead of failing on missing `chunkAnalysis`.
  - Benchmarking completed far enough to write a fresh `benchmarks/fixtures/cod-test/_reports/benchmark-summary.json` and per-artifact reports.
  - Benchmark artifact count is now `6` instead of the archived run's `7`, reflecting removal of the stale `chunkAnalysis` expectation for cod-test whole-video mode.
- However the overall run still does **not** complete cleanly:
  - Benchmark summary status remains `error` (`0/6 artifacts passed`).
  - `dialogueData` benchmark improved from essentially empty-output comparison to real scoring (`56/209` scoreable fields passed; accuracy rate `0.2679`; coverage `0.9587`), but is still far from passing.
  - `musicVocalsData` benchmark remains `error` and regressed (`13/47` scoreable fields passed; accuracy rate `0.2766`; coverage `0.9038`).
- Reporting is only partially whole-video-correct:
  - `output/cod-test/phase3-report/metrics/metrics.json` now truthfully records `implementationStatus.state: "not_applicable"`, `dataSource: "phase2.wholeVideoAnalysis"`, and `summary.videoDuration: 140.017`.
  - But `output/cod-test/phase3-report/emotional-analysis/emotional-data.json`, `summary/summary.json`, and `summary/FINAL-REPORT.md` are still essentially placeholder/chunkless outputs (`No usable phase2 chunkAnalysis emotion timeseries was found.`, empty averages/trends, summary metadata still showing `videoDuration: 0` / `chunksAnalyzed: 0`).

Fresh artifact paths inspected directly:
- `output/cod-test/phase1-gather-context/dialogue-data.reconciled.json`
- `output/cod-test/phase1-gather-context/music-vocals-data.reconciled.json`
- `output/cod-test/phase1-gather-context/famous-song-reconciliation.json`
- `output/cod-test/phase2-process/raw/ai/whole-video/attempt-01/capture.json`
- `output/cod-test/_meta/ai/_prompts/68ceba8396eba43cf1cf1348a0ebe6a8ad3af97d979022d0b0a90b26f552f0f1.json`
- `output/cod-test/phase2-process/whole-video-analysis.json`
- `output/cod-test/phase2-process/script-results/whole-video-mimo.success.json`
- `output/cod-test/phase3-report/metrics/metrics.json`
- `output/cod-test/phase3-report/emotional-analysis/emotional-data.json`
- `output/cod-test/phase3-report/summary/summary.json`
- `output/cod-test/phase3-report/summary/FINAL-REPORT.md`
- `benchmarks/fixtures/cod-test/_reports/benchmark-summary.json`
- `benchmarks/fixtures/cod-test/_reports/artifact-results/dialogueData.json`
- `benchmarks/fixtures/cod-test/_reports/artifact-results/musicVocalsData.json`

Verification steps performed:
- Confirmed config path with `grep -n 'whole-video-mimo' configs/cod-test.yaml`.
- Tailed `.logs/cod-test-20260408-171347-ee-elc5-post-fix-whole-video-rerun.log` and read `.time` output.
- Compared current vs archived `dialogue-data.reconciled.json`, `music-vocals-data.reconciled.json`, and `famous-song-reconciliation.json` directly.
- Read current vs archived whole-video prompt snapshots to confirm section-level dedupe behavior.
- Read current report/benchmark outputs to confirm both artifact creation and remaining failure mode.

## Final Results

**Status:** ⚠️ Partial

**What We Built:** Landed the investigation-backed whole-video fixes, then archived the prior cod-test packet and ran a second real provider-backed whole-video cod-test rerun. This fresh rerun proves four concrete improvements in real runtime: whole-video Phase 2 is still the active path, dialogue no longer collapses to zero, duplicated support-section injection is gone from the captured whole-video prompt, and benchmark/reporting now get far enough to emit fresh whole-video-mode artifacts and a benchmark summary instead of failing on missing `chunkAnalysis` immediately.

**Commits:**
- Pending.

**Lessons Learned:** The rerun is materially healthier than the archived pre-fix whole-video run, but it is still not clean. Dialogue survival improved dramatically (`0 -> 30` segments), yet the recovered dialogue lane now carries obvious lyric bleed. The real-run reconciliation path still does not remove that bleed in practice because the ledger remains `skipped` with no corrections/removals. Prompt-context dedupe appears fixed at the support-section injection level, but prompt cleanliness is now limited by contaminated dialogue content rather than duplicate section assembly. Benchmark/report compatibility is also only partial: the whole-video run now writes fresh reports and a benchmark summary with `6` artifacts, but the benchmark still ends in `error`, and the Phase 3 emotional/summary outputs remain chunk-analysis-shaped placeholders instead of rich whole-video reporting.

---

*Started on 2026-04-08*
