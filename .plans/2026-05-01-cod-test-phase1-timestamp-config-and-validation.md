# Peanut Gallery Emotion Engine

**Date:** 2026-05-01  
**Status:** Draft  
**Agent:** Cookie 🍪

---

## Goal

Create a phase-1-only `cod-test` config variant that runs the new dialogue/music-vocals timestamp scripts after reconciliation, then execute it and compare the produced timestamp artifacts against COD golden truth before wiring anything into Phase 2 chunk video.

---

## Overview

We already landed and cleared the bounded Phase 1 timestamp-derivation lanes for dialogue and music-vocals. The next safe step is not to wire those artifacts into Phase 2 yet, but to create a controlled `cod-test` YAML variant that stops after Phase 1 while still exercising the new post-reconciliation timestamp scripts in their intended order.

This lane needs to answer two questions cleanly. First: does the new YAML route the pipeline correctly so reconciliation happens before timestamp derivation and the run exits before Phase 2 / report stages? Second: do the resulting `dialogue-timestamps` and `music-vocals-timestamps` artifacts look accurate against our COD golden truth surfaces? That means the work is a config-and-validation slice, not another architecture rewrite.

The likely shape is: duplicate `configs/cod-test.yaml`, append the two new Phase 1 scripts immediately after `reconcile-famous-song-phase1.cjs`, remove or disable later phases so the pipeline ends after gather-context, then run that config and inspect the emitted artifacts against benchmark/golden truth. If the config works and the artifacts are honest, we will be ready for a later plan that decides how/when to thread them into Phase 2 chunk-video processing.

---

## REFERENCES

| ID | Description | Path |
| --- | --- | --- |
| `REF-01` | Canonical full COD pipeline config to copy and trim | `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/configs/cod-test.yaml` |
| `REF-02` | Completed timestamp-derivation implementation plan and outcome | `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/.plans/archive/2026-04-30-phase1-timestamp-derivation-scripts.md` |
| `REF-03` | Dialogue timestamp script | `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/server/scripts/get-context/get-dialogue-timestamps.cjs` |
| `REF-04` | Music-vocals timestamp script | `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/server/scripts/get-context/get-music-vocals-timestamps.cjs` |
| `REF-05` | COD benchmark / golden truth fixture root | `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/benchmarks/fixtures/cod-test/` |
| `REF-06` | Famous-song reconciliation step that must run before timestamps | `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/server/scripts/get-context/reconcile-famous-song-phase1.cjs` |

---

## Tasks

### Task 1: Design the phase-1-only COD timestamp config variant

**Bead ID:** `ee-4x27`  
**SubAgent:** `primary` (for `research` workflow role)  
**Role:** `research`  
**References:** `REF-01`, `REF-02`, `REF-03`, `REF-04`, `REF-06`  
**Prompt:** `Claim the assigned bead on start. Audit configs/cod-test.yaml plus the cleared timestamp lane plan and define the exact config changes for a new COD test variant that runs dialogue/music-vocals timestamp derivation after famous-song reconciliation, then stops after Phase 1. Confirm exact gather_context ordering, output directory strategy, whether benchmark should remain enabled for this validation run, and the safest way to prevent Phase 2/report execution without drifting from the canonical config more than necessary. Update the active plan with the chosen config name and validation posture. Close the bead only when the config change plan is execution-ready.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `configs/`

**Files Created/Deleted/Modified:**
- `.plans/2026-05-01-cod-test-phase1-timestamp-config-and-validation.md`
- `configs/cod-test-phase1-timestamp-validation.yaml` (planned)

**Status:** ✅ Complete

**Results:** Design package is execution-ready. Exact config name decision: `configs/cod-test-phase1-timestamp-validation.yaml`. Recommended gather-context order is the canonical COD Phase 1 order plus the two new timestamp derivation scripts appended immediately after reconciliation: `get-dialogue` → `get-music` → `get-music-vocals` → `reconcile-famous-song-phase1` → `get-dialogue-timestamps` → `get-music-vocals-timestamps`. Recommended output isolation: `asset.outputDir: output/cod-test-phase1-timestamp-validation` so the lane never clobbers canonical `output/cod-test` artifacts or reports. Recommended validation posture: set `benchmark.enabled: false` for this config, because the current canonical manifest at `benchmarks/fixtures/cod-test/benchmark.json` still requires `chunkAnalysis`, `recommendationData`, `metricsData`, and `emotionalAnalysisData`, which this Phase-1-only lane intentionally will not produce; leaving benchmark on would create a misleading benchmark error lane rather than a focused timestamp-validation lane. Safest minimal-diff stop-after-Phase-1 mechanism: keep `gather_context` populated, set `process: []`, and set `report: []`, matching the repo’s established partial-run pattern and the pipeline runner’s existing semantics for empty phase arrays. Keep the rest of `cod-test.yaml` as intact as possible, including the canonical asset/media/tool/AI/recovery/settings blocks, so the only behavioral deltas are the new output root, the appended timestamp scripts, benchmark disablement, and Phase 2/3 suppression. Runtime caveats for QA: (1) both timestamp scripts trigger fresh alignment reruns (`get-dialogue` / `get-music-vocals`) in temp dirs, so the lane still performs additional provider-backed work beyond the persisted source artifacts; (2) reconciliation must succeed first or canonical timestamp outputs will legitimately fail loud on missing reconciled source surfaces; (3) generated timestamp artifacts should be compared directly under `phase1-gather-context/` (`dialogue-timestamps-data.reconciled.json` and `music-vocals-timestamps-data.reconciled.json`, plus raw variants if explicitly exercised), not inferred from the canonical benchmark summary because no timestamp-specific manifest exists yet; (4) because `output/cod-test-phase1-timestamp-validation` is intentionally isolated, QA should compare against golden truth/artifacts by path rather than expecting the existing `benchmarks/fixtures/cod-test/_reports/` surfaces to refresh for this lane.

---

### Task 2: Implement the new COD phase-1 timestamp config

**Bead ID:** `ee-lt7w`  
**SubAgent:** `primary` (for `coder` workflow role)  
**Role:** `coder`  
**References:** `REF-01`, `REF-03`, `REF-04`, `REF-06`  
**Prompt:** `Claim the assigned bead on start and implement the approved COD config variant. Copy the canonical cod-test YAML, add the new timestamp scripts in the approved post-reconciliation order, and stop the pipeline after Phase 1 as specified by the plan. Keep the config diff as narrow as possible, validate the YAML, commit/push before QA handoff, and close the bead only when the config is durable and repo-local validation is complete.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `configs/`

**Files Created/Deleted/Modified:**
- `.plans/2026-05-01-cod-test-phase1-timestamp-config-and-validation.md`
- `configs/cod-test-phase1-timestamp-validation.yaml`

**Status:** ✅ Complete

**Results:** Implemented the approved narrow config clone at `configs/cod-test-phase1-timestamp-validation.yaml` as a minimally edited copy of `configs/cod-test.yaml`. Exact durable changes in the new file: `asset.outputDir` -> `output/cod-test-phase1-timestamp-validation`; `benchmark.enabled` -> `false` while preserving the existing benchmark path; `gather_context` order is now `get-dialogue` -> `get-music` -> `get-music-vocals` -> `reconcile-famous-song-phase1` -> `get-dialogue-timestamps` -> `get-music-vocals-timestamps`; `process: []`; `report: []`. No unrelated config drift was introduced. Repo-local validation completed without starting the real pipeline run: `node -e "const fs=require('fs'); const yaml=require('js-yaml'); const file='configs/cod-test-phase1-timestamp-validation.yaml'; yaml.load(fs.readFileSync(file,'utf8')); console.log('parsed OK:', file);"` ✅ and `node server/run-pipeline.cjs --config configs/cod-test-phase1-timestamp-validation.yaml --dry-run` ✅ (`Valid (6 script(s) across all phases)`). QA caution: this task validated loader/schema acceptance only and intentionally did **not** execute the provider-backed lane or emit timestamp artifacts; bead `ee-obf1` still owns the first real run and artifact-vs-golden-truth inspection.

---

### Task 3: Run the new config and inspect timestamp artifacts against COD golden truth

**Bead ID:** `ee-obf1`  
**SubAgent:** `primary` (for `qa` workflow role)  
**Role:** `qa`  
**References:** `REF-02`, `REF-03`, `REF-04`, `REF-05`  
**Prompt:** `Claim the assigned bead on start. Execute the new phase-1-only COD timestamp config, inspect the generated dialogue/music-vocals timestamp artifacts, and compare them against the available COD benchmark/golden truth surfaces. Verify artifact presence, source-surface selection, timestamp plausibility/accuracy, and any obvious drift from golden truth. Record exact commands, artifact paths, and the quality verdict in the plan. Do not close the overall lane; leave precise findings for independent audit.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `output/`
- benchmark inspection paths as needed

**Files Created/Deleted/Modified:**
- `.plans/2026-05-01-cod-test-phase1-timestamp-config-and-validation.md`
- `output/cod-test-phase1-timestamp-validation/`

**Status:** ❌ Failed

**Results:** First real provider-backed execution was attempted and produced a durable partial-run evidence package, but the lane failed inside `get-dialogue-timestamps` before any timestamp artifacts were emitted. Exact commands run for QA were: `bd update ee-obf1 --status in_progress --json`; `node server/run-pipeline.cjs --config configs/cod-test-phase1-timestamp-validation.yaml`; `find output/cod-test-phase1-timestamp-validation -maxdepth 3 -type f | sort`; `find output/cod-test-phase1-timestamp-validation/phase1-gather-context -maxdepth 1 -type f -printf '%f\n' | sort`; targeted JSON inspection under `output/cod-test-phase1-timestamp-validation/phase1-gather-context/`; and direct comparisons against `benchmarks/fixtures/cod-test/truth/*`. Real-run outcome: Phase 1 executed `get-dialogue` ✅, `get-music` ✅, `get-music-vocals` ✅, `reconcile-famous-song-phase1` ✅, then failed in `get-dialogue-timestamps` with `OpenRouter: No content in response` (`output/cod-test-phase1-timestamp-validation/phase1-gather-context/script-results/get-dialogue-timestamps.failure.json`). Because the failure occurred before `get-music-vocals-timestamps`, neither `dialogue-timestamps-data.json` / `.reconciled.json` nor `music-vocals-timestamps-data.json` / `.reconciled.json` were created, so timestamp accuracy against golden truth could not be judged yet.

Durable findings from the failed run: (1) the config ordering behaved correctly through the reachable portion of Phase 1 — `famous-song-reconciliation.json` exists, `script-results/reconcile-famous-song-phase1.success.json` completed at `2026-05-01T20:27:36.314Z`, and `script-results/get-dialogue-timestamps.failure.json` began immediately after at `2026-05-01T20:27:36.314Z`, so reconciliation did run before timestamp derivation as intended; (2) the pipeline never reached Phase 2 or report because the run terminated during Phase 1 and `_meta/events.jsonl` ends with `phase.end` outcome `failed` for `phase1-gather-context` plus `run.end` outcome `failed`, with no process/report artifacts created; (3) chosen-source-surface behavior is visible before the timestamp failure: reconciliation wrote `dialogue-data.reconciled.json`, `music-vocals-data.reconciled.json`, and `famous-song-reconciliation.json`, confirming the canonical reconciled surfaces the timestamp scripts were expected to consume; (4) the reconciliation itself removed the two lyric-contaminated dialogue lines (`Obey your master, master, come crawling faster, master, master...` and `Obey your master, master...`) while preserving music-vocals text without lyric rewrite, matching the approved Phase 1 contract.

Golden-truth comparison on the reachable source artifacts shows the lane is not yet at parity even before timestamp derivation. Raw dialogue output (`21` segments) differs from `truth/dialogue-data.raw.json` (`18` segments) on several lines, including `Spectre One report.` vs truth `Specter one, report.`, `The hell it ain't!` vs truth `The hell it isn't!`, `So eager to leave, are we?` vs truth `So eager to leave, David?`, and the shipped lyric contamination lines that reconciliation later removes. Reconciled dialogue output (`19` segments) still differs from `truth/dialogue-data.json` (`20` segments), including segmentation/merge drift (`They want you afraid.` + `Fear makes you easier to control.` split into two segments instead of one combined truth segment) plus wording/punctuation drift (`Pull it together, man.` vs `Pull it together, man!`, `So eager to leave, are we?` vs `So eager to leave David.`). Music-vocals output (`15` segments) also drifts materially from `truth/music-vocals-data.json` (`12` segments): the run produced shorter fragmented lines such as `Twisting your mind`, `Smashing a dream`, `Blinding your eyes`, `Just call my name`, and `I'll hear you scream` where truth expects longer combined lyric surfaces like `Twisting your mind and smashing your dreams`, `Blinded by me, you can’t see a thing`, and `Just call my name, ‘cause I’ll hear you scream`. Those text mismatches matter because the timestamp scripts preserve source text verbatim, so any future timestamp quality judgment must be made against the reconciled/raw text the scripts actually timed, not idealized truth text.

Grounded QA verdict for this bead at this stop point: the new config is structurally correct through reachable Phase 1 ordering and Phase-1-only stopping semantics, but the first real run did **not** complete the timestamp-validation mission because `get-dialogue-timestamps` hit a provider empty-response failure and blocked all timestamp artifact generation. Exact retry gap for coder/auditor: rerun or harden `get-dialogue-timestamps` against `OpenRouter: No content in response` in this real provider-backed path, then repeat the full config run and inspect the newly emitted `dialogue-timestamps-*` and `music-vocals-timestamps-*` artifacts before making any final accuracy claim.

---

### Task 3B: Debug the real provider-backed `get-dialogue-timestamps` failure and rerun Phase 1 validation

**Bead ID:** `ee-pl3w`  
**SubAgent:** `primary` (for `coder` workflow role)  
**Role:** `coder`  
**References:** `REF-01`, `REF-02`, `REF-03`, `REF-05`  
**Prompt:** `Claim the assigned bead on start. Debug the real COD provider-backed failure in get-dialogue-timestamps exposed by configs/cod-test-phase1-timestamp-validation.yaml. Reproduce from the existing failure evidence, determine whether the fix belongs in failure classification/retry handling, target/runtime settings, or the timestamp lane’s dialogue rerun posture, and implement the smallest truthful repair that gets this Phase 1 validation lane past the empty-response failure without masking broader issues. Re-run the phase-1-only config after the fix far enough to confirm timestamp artifacts are emitted, update the active plan with exact findings, commit/push before handoff, and close the bead only when the retry path is durable enough for QA to reassess artifact accuracy.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `server/`
- `configs/` (only if a narrow config/runtime adjustment is truly required)
- `test/` (if regression coverage is added)

**Files Created/Deleted/Modified:**
- `.plans/2026-05-01-cod-test-phase1-timestamp-config-and-validation.md`
- `server/scripts/get-context/get-dialogue-timestamps.cjs`
- `test/scripts/get-dialogue-timestamps.test.js`

**Status:** ✅ Complete

**Results:** Root cause confirmed from the existing failure evidence rather than from a speculative transport rewrite: `get-dialogue-timestamps` delegates its alignment rerun to `get-dialogue.cjs`, and that rerun inherited `config.ai.dialogue.retry` exactly as configured. In `configs/cod-test-phase1-timestamp-validation.yaml`, dialogue had no explicit retry block, so the rerun posture was effectively `maxAttempts=1, backoffMs=0`. The captured failure at `output/cod-test-phase1-timestamp-validation/phase1-gather-context/script-results/get-dialogue-timestamps.failure.json` already showed the provider error was being classified by `aiTargets` as `retryable`; the pipeline still died because the timestamp rerun had no extra attempt budget, not because `no_content` was being misclassified. Narrow truthful repair chosen: harden only the timestamp lane’s dialogue alignment rerun by cloning config inside `server/scripts/get-context/get-dialogue-timestamps.cjs` and enforcing bounded minimum retry defaults of `maxAttempts=2` / `backoffMs=1000` for that rerun, while preserving any stronger caller-specified `config.ai.dialogue.retry` values and leaving the main dialogue lane/config untouched.

Added regression coverage proves (1) the timestamp rerun now injects the bounded retry defaults without mutating the caller config and (2) stronger existing retry settings are preserved. Exact repo-local validation command: `node --test test/scripts/get-dialogue-timestamps.test.js test/lib/ai-targets.test.js` ✅.

Real rerun command after the fix: `node server/run-pipeline.cjs --config configs/cod-test-phase1-timestamp-validation.yaml` ✅. Exact observed rerun outcome: the lane passed all six Phase 1 scripts, including `script-results/get-dialogue-timestamps.success.json` and `script-results/get-music-vocals-timestamps.success.json`; emitted artifacts now include `phase1-gather-context/dialogue-timestamps-data.reconciled.json` and `phase1-gather-context/music-vocals-timestamps-data.reconciled.json`. The pipeline log shows the timestamp alignment rerun is now intentionally running with `Dialogue retry config: attempts=2, backoffMs=1000`, while the main top-level `get-dialogue` lane still runs at `attempts=1, backoffMs=0`. This rerun did not need to consume the second attempt in practice, but it cleared the previously failing empty-response seam and reached the downstream music-vocals timestamp lane truthfully.

Useful QA follow-up facts from the successful rerun: `dialogue-timestamps-data.reconciled.json` contains 19 dialogue segments with emitted timing fields; at least one segment remains honestly unresolved (`"So eager to leave, are we?"` has `timing.status: "unresolved"`), so the repair did not hide alignment gaps behind fake timestamps. `music-vocals-timestamps-data.reconciled.json` also emitted successfully and preserves the reconciled lyric text, but its `vocal_segments` remain unresolved in this run (`timing.status: "unresolved"` throughout), so QA should now evaluate timestamp artifact presence plus accuracy/coverage quality separately rather than treating emission as proof of alignment quality.

---

### Task 4: Audit config correctness and golden-truth validation findings

**Bead ID:** `ee-od1v`  
**SubAgent:** `primary` (for `auditor` workflow role)  
**Role:** `auditor`  
**References:** `REF-01`, `REF-02`, `REF-05`, `REF-06`  
**Prompt:** `Claim the assigned bead on start. Independently audit the new phase-1-only COD timestamp config and the QA validation findings. Confirm the config really runs reconciliation before the new timestamp scripts, really stops after Phase 1, and that the reported artifact-vs-golden-truth conclusions are justified by evidence. Either pass/close the lane or report exact retry gaps.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- config / artifact review paths as needed

**Files Created/Deleted/Modified:**
- `.plans/2026-05-01-cod-test-phase1-timestamp-config-and-validation.md`

**Status:** ⏳ Pending

**Results:** Pending.

---

## Final Results

**Status:** ⚠️ Pending

**What We Built:** Pending.

**Reference Check:** Pending.

**Commits:**
- Pending

**Lessons Learned:** Pending.

---

*Draft created on 2026-05-01*
