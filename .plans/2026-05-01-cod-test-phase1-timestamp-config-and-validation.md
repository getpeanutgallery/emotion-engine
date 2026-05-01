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
- run artifacts under a dedicated output folder to be finalized in execution

**Status:** ⏳ Pending

**Results:** Pending.

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
