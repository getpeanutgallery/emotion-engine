# Peanut Gallery Emotion Engine

**Date:** 2026-05-06  
**Status:** In Progress  
**Agent:** Cookie 🍪

---

## Goal

Run the next honest `cod-test` Phase 2 retest to validate chunk-local dialogue grounding and clean empty-window behavior after the faster-whisper + chunk-grounding changes, then inspect whether downstream Phase 2 artifacts actually improved.

---

## Overview

Yesterday's lane finished the prerequisite work: Phase 1 dialogue timestamps now come from faster-whisper, and Phase 2 `video-chunks` no longer receives whole-run dialogue/music-vocals baggage. The audit verdict was "ready to rerun, with caveats" — specifically, dialogue grounding looks strong enough to carry forward, while music-vocals timestamping remains weak and should be treated as a known limitation rather than a solved problem.

This plan keeps the next step narrow and honest. We should run the next `cod-test` retest with the success criteria framed around **chunk-local dialogue grounding**, **clean silent windows**, and **improved Phase 2 grounding behavior**. We should not frame this rerun as proving that all timestamp grounding is now solved, because the music-vocals timing lane is still unresolved and the dialogue benchmark still carries split/merge and speaker-attribution caveats.

Derrick approved a **bounded execution through Phase 2 only, explicitly skipping Phase 3 for this run**. So this execution is not a full end-to-end product rerun; it is a Phase 1→Phase 2 evidence run meant to regenerate bounded artifacts, stop before recommendation/report generation, and then inspect the resulting grounded Phase 2 outputs directly.

Execution should follow the normal coder -> QA -> auditor loop. The research lane will first lock the exact bounded command/config contract for a Phase 2-only rerun. The coder lane will run the retest and preserve fresh artifacts/logs. The QA lane will inspect the resulting Phase 2 outputs and compare them to the grounded expectations from yesterday's bounded replay. The auditor lane will make the final call on whether the rerun meaningfully improved Phase 2 behavior, and whether the next lane should focus on lyric timing, dialogue boundary truth, or a broader product rerun.

---

## REFERENCES

| ID | Description | Path |
| --- | --- | --- |
| `REF-01` | Yesterday's completed faster-whisper + chunk-grounding plan and audit verdict | `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/.plans/2026-05-05-wire-faster-whisper-into-phase1-and-ground-phase2-video-chunks.md` |
| `REF-02` | Phase 2 chunk grounding QA evidence packet | `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/output/cod-test-phase2-chunk-grounding-qa-2026-05-05-1626/` |
| `REF-03` | Fresh Phase 1 timestamp QA packet from the faster-whisper rerun | `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/output/cod-test-phase1-timestamp-validation/qa-timestamp-metrics-faster-whisper-rerun-2026-05-05-1427/` |
| `REF-04` | Current Phase 2 processing lane | `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/server/scripts/process/video-chunks.cjs` |
| `REF-05` | Primary cod-test config to rerun for this lane | `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/configs/cod-test.yaml` |
| `REF-06` | Repo package scripts / canonical pipeline entrypoints | `/home/derrick/.openclaw/workspace/projects/peanut-gallery/emotion-engine/package.json` |

---

## Tasks

### Task 1: Prepare the Phase 2 retest contract and execution bead

**Bead ID:** `ee-mwix`  
**SubAgent:** `primary` (for `research` workflow role)  
**Role:** `research`  
**References:** `REF-01`, `REF-02`, `REF-03`, `REF-05`, `REF-06`  
**Prompt:** `Claim bead ee-mwix on start with bd update ee-mwix --status in_progress --json. Confirm the exact rerun command/config for the next cod-test Phase 2 retest, using Derrick-approved bounded execution through Phase 2 only and explicitly skipping Phase 3 for this run. Restate the success criteria honestly (chunk-local dialogue grounding, clean empty windows, improved grounded Phase 2 behavior), record where fresh artifacts/logs should land, update the active plan with the final execution contract, then close bead ee-mwix with bd close ee-mwix --reason "bounded Phase 2 retest contract documented" --json when the coder lane can run without ambiguity.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- possible read-only inspection of `configs/`, `output/`, and `.logs/`

**Files Created/Deleted/Modified:**
- `.plans/2026-05-06-phase2-cod-test-retest-after-chunk-grounding.md`

**Status:** ✅ Complete

**Results:** Confirmed the next retest should **not** use CLI stage/stop flags, because `server/lib/cli-parser.cjs` only exposes `--config`, `--verbose`, `--dry-run`, and `--clean-live-digital-twin`; there is no native `--phase`, `--stop-after`, or `--skip-phase3` switch to bound execution. Also confirmed the current canonical full-run config `configs/cod-test.yaml` is **not** the right direct entrypoint for this lane because its `process` phase still runs `server/scripts/process/whole-video-mimo.cjs`, not the grounded `server/scripts/process/video-chunks.cjs` lane we are trying to retest. The existing dedicated chunk config `configs/cod-test-phase2-chunk-benchmark.yaml` is closer on Phase 2 script choice, but it is still not the right direct contract for this bead because it reuses persisted Phase 1 artifacts (`gather_context: []`), still runs Phase 3 report scripts, and keeps benchmarking enabled against the full cod-test manifest.

**Exact recommended execution path:** use a **dedicated bounded config** for this rerun, not a CLI trick and not the current full-run config. The clean contract is a new repo-local config such as `configs/cod-test-phase2-only-retest-2026-05-06.yaml` with these exact characteristics:
- clone the current COD asset / model / recovery / tool-variable posture from `configs/cod-test.yaml`
- keep full Phase 1 gathering so the rerun regenerates fresh upstream artifacts:
  - `server/scripts/get-context/get-dialogue.cjs`
  - `server/scripts/get-context/get-music.cjs`
  - `server/scripts/get-context/get-music-vocals.cjs`
  - `server/scripts/get-context/reconcile-famous-song-phase1.cjs`
- replace Phase 2 with the grounded chunk lane:
  - `process:` → `server/scripts/process/video-chunks.cjs`
- explicitly skip Phase 3:
  - `report: []`
- explicitly disable benchmark execution for this bounded rerun:
  - `benchmark.enabled: false`
- write to a fresh run-owned output path instead of clobbering the canonical full-run folder:
  - `asset.outputDir: output/cod-test-phase2-only-retest-2026-05-06`

**Exact rerun command for the coder lane once that config exists:**
- `node server/run-pipeline.cjs --config configs/cod-test-phase2-only-retest-2026-05-06.yaml --clean-live-digital-twin --verbose 2>&1 | tee .logs/ee-kf6w-cod-test-phase2-only-retest-20260506.log`

**Why this is the best path:** a dedicated bounded config is the only repo-canonical way to guarantee Phase 1 → grounded Phase 2 execution while explicitly skipping Phase 3. It preserves the real current gather-context behavior, exercises the actual `video-chunks.cjs` grounding changes, avoids accidental fallback to the whole-video MiMo lane, and avoids a benchmark-stage failure caused by missing Phase 3 artifacts.

**Fresh logs/artifacts should land here:**
- log: `.logs/ee-kf6w-cod-test-phase2-only-retest-20260506.log`
- run root: `output/cod-test-phase2-only-retest-2026-05-06/`
- Phase 1 evidence: `output/cod-test-phase2-only-retest-2026-05-06/phase1-gather-context/`
- Phase 2 evidence: `output/cod-test-phase2-only-retest-2026-05-06/phase2-process/`
- key chunk output: `output/cod-test-phase2-only-retest-2026-05-06/phase2-process/chunk-analysis.json`
- script result envelope: `output/cod-test-phase2-only-retest-2026-05-06/phase2-process/script-results/video-chunks.success.json` (or `.failure.json` if the run breaks)
- raw prompt/runtime captures: `output/cod-test-phase2-only-retest-2026-05-06/phase2-process/raw/`
- event ledger: `output/cod-test-phase2-only-retest-2026-05-06/_meta/events.jsonl`

**Honest success criteria restated for the coder/QA/auditor lanes:** this rerun is successful if it shows (1) chunk-local dialogue grounding, (2) clean empty/silent windows with no whole-run transcript leakage, and (3) improved grounded Phase 2 behavior in the chunk outputs versus pre-grounding behavior. It should **not** be sold as proving lyric timing is solved. Music-vocals timing remains a known caveat; current evidence says the system now degrades honestly to empty chunk-local lyric context instead of smearing unresolved lyrics across every chunk, which is acceptable for this bounded retest but still limits lyric-aware conclusions.

**Caveats the next lane should preserve explicitly:**
- no repo CLI phase-stop flag exists, so any attempt to do this with command-line switches alone is non-canonical
- `configs/cod-test.yaml` currently targets whole-video Phase 2, so using it directly would test the wrong lane
- `configs/cod-test-phase2-chunk-benchmark.yaml` is useful precedent, but it is still a benchmark/report slice rather than a true Phase2-only retest contract
- the known music-vocals limitation is not a blocker for this retest, but it must remain in the readout

---

### Task 2: Run the cod-test retest with grounded Phase 2 chunk context

**Bead ID:** `ee-kf6w`  
**SubAgent:** `primary` (for `coder` workflow role)  
**Role:** `coder`  
**References:** `REF-01`, `REF-04`, `REF-05`, `REF-06`  
**Prompt:** `Claim bead ee-kf6w on start with bd update ee-kf6w --status in_progress --json. Run the approved cod-test retest using the current faster-whisper dialogue timestamp path and chunk-local Phase 2 grounding behavior, bounded through Phase 2 only and explicitly skipping Phase 3. Preserve fresh logs and artifacts, do not widen scope into timestamp redesign during the rerun, and document the exact command, runtime behavior, failures/retries if any, and final artifact paths. Commit/push by default before QA if code changes become necessary; if this is a pure rerun with no repo changes, record that explicitly before closing bead ee-kf6w.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `.logs/`
- `output/`

**Files Created/Deleted/Modified:**
- `.plans/2026-05-06-phase2-cod-test-retest-after-chunk-grounding.md`
- fresh rerun artifacts/logs under `output/` and `.logs/`

**Status:** ✅ Complete

**Results:** Created the dedicated bounded rerun config at `configs/cod-test-phase2-only-retest-2026-05-06.yaml` by cloning the current `configs/cod-test.yaml` posture and narrowing only the agreed execution contract: fresh Phase 1 gather scripts preserved, Phase 2 switched to `server/scripts/process/video-chunks.cjs`, `report: []`, `benchmark.enabled: false`, and fresh run root `output/cod-test-phase2-only-retest-2026-05-06/`. Ran the exact approved command with no adjustments: `node server/run-pipeline.cjs --config configs/cod-test-phase2-only-retest-2026-05-06.yaml --clean-live-digital-twin --verbose 2>&1 | tee .logs/ee-kf6w-cod-test-phase2-only-retest-20260506.log`.

Runtime outcome: **successful bounded rerun**. The pipeline validated the config, scrubbed `DIGITAL_TWIN_MODE`, `DIGITAL_TWIN_PACK`, and `DIGITAL_TWIN_CASSETTE` for a clean live run, executed all 4 Phase 1 gather scripts successfully, then executed the grounded Phase 2 chunk lane successfully. `output/cod-test-phase2-only-retest-2026-05-06/_meta/events.jsonl` recorded `run.end` with `durationMs: 823426` (~13m43s). Phase 2 planned 29 chunks for a 140.017s asset, analyzed 28 provider-facing chunks successfully, and honestly skipped the terminal 0.017s micro-chunk under 1 second. `chunk-analysis.json` reports `statusSummary.total=28`, `successful=28`, `failed=0`, `failedChunkIndexes=[]`, `totalTokens=225974`, average 8071 tokens per successful chunk. No provider retries or recovery retries were needed; all successful chunk attempts completed on first try. The log prints `✅ Phase 3 complete`, but this was the expected zero-script pass for `report: []`, not an actual report-generation run.

Fresh evidence paths preserved for QA/audit:
- config: `configs/cod-test-phase2-only-retest-2026-05-06.yaml`
- run log: `.logs/ee-kf6w-cod-test-phase2-only-retest-20260506.log`
- run root: `output/cod-test-phase2-only-retest-2026-05-06/`
- event ledger: `output/cod-test-phase2-only-retest-2026-05-06/_meta/events.jsonl`
- Phase 1 outputs:
  - `output/cod-test-phase2-only-retest-2026-05-06/phase1-gather-context/dialogue-data.json`
  - `output/cod-test-phase2-only-retest-2026-05-06/phase1-gather-context/music-data.json`
  - `output/cod-test-phase2-only-retest-2026-05-06/phase1-gather-context/music-vocals-data.json`
  - `output/cod-test-phase2-only-retest-2026-05-06/phase1-gather-context/famous-song-reconciliation.json`
- Phase 1 script envelopes:
  - `output/cod-test-phase2-only-retest-2026-05-06/phase1-gather-context/script-results/get-dialogue.success.json`
  - `output/cod-test-phase2-only-retest-2026-05-06/phase1-gather-context/script-results/get-music.success.json`
  - `output/cod-test-phase2-only-retest-2026-05-06/phase1-gather-context/script-results/get-music-vocals.success.json`
  - `output/cod-test-phase2-only-retest-2026-05-06/phase1-gather-context/script-results/reconcile-famous-song-phase1.success.json`
- Phase 2 outputs:
  - `output/cod-test-phase2-only-retest-2026-05-06/phase2-process/chunk-analysis.json`
  - `output/cod-test-phase2-only-retest-2026-05-06/phase2-process/script-results/video-chunks.success.json`
- final artifact envelope: `output/cod-test-phase2-only-retest-2026-05-06/artifacts-complete.json`

Durable repo changes needed for this task were config/documentation only: new config file plus this plan update. Fresh logs and run artifacts were preserved on disk but remain intentionally uncommitted because `.gitignore` excludes `/output/`, `/.logs/`, and `*.log`. No code-path changes were required beyond adding the dedicated config. Durable changes were committed and pushed on `main` with commit message `Add bounded cod Phase 2 retest config`.

---

### Task 3: QA the fresh Phase 2 rerun artifacts for grounding quality

**Bead ID:** `ee-3q73`  
**SubAgent:** `primary` (for `qa` workflow role)  
**Role:** `qa`  
**References:** `REF-01`, `REF-02`, `REF-03`, `REF-04`  
**Prompt:** `Claim bead ee-3q73 on start with bd update ee-3q73 --status in_progress --json. Inspect the fresh cod-test rerun artifacts and evaluate whether Phase 2 now shows chunk-local dialogue grounding in practice, whether silent/empty windows stay clean, and whether downstream chunk analysis improved versus the known pre-grounding behavior. Record exact evidence, artifact paths, and remaining caveats, especially around music-vocals timing and any lingering dialogue boundary/speaker drift, then close bead ee-3q73 only when the QA evidence packet is complete.`

**Folders Created/Deleted/Modified:**
- `.plans/`
- `output/` analysis paths as needed

**Files Created/Deleted/Modified:**
- `.plans/2026-05-06-phase2-cod-test-retest-after-chunk-grounding.md`
- fresh QA notes/artifacts under `output/`

**Status:** ⏳ Pending

**Results:** Pending.

---

### Task 4: Audit rerun readiness outcome and recommend the next lane

**Bead ID:** `ee-wyto`  
**SubAgent:** `primary` (for `auditor` workflow role)  
**Role:** `auditor`  
**References:** `REF-01` through `REF-06`  
**Prompt:** `Claim bead ee-wyto on start with bd update ee-wyto --status in_progress --json. Independently audit the fresh cod-test rerun evidence and decide whether the bounded Phase 2 retest meaningfully validated the intended improvements. Distinguish clearly between dialogue-grounding success, empty-window cleanliness, unresolved music-vocals timing weakness, and any remaining benchmark/product gaps. Close bead ee-wyto only when the verdict and recommended next lane are evidence-backed.`

**Folders Created/Deleted/Modified:**
- `.plans/`

**Files Created/Deleted/Modified:**
- `.plans/2026-05-06-phase2-cod-test-retest-after-chunk-grounding.md`

**Status:** ⏳ Pending

**Results:** Pending.

---

## Final Results

**Status:** ⏳ Pending

**What We Built:** Pending.

**Reference Check:** Pending.

**Commits:**
- Pending.

**Lessons Learned:** Pending.

---

*Completed on YYYY-MM-DD*
