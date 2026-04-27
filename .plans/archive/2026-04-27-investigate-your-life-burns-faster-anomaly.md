# Emotion Engine

**Date:** 2026-04-27  
**Status:** In Progress  
**Agent:** Cookie 🍪

---

## Goal

Investigate why `Your life burns faster` survives in reconciled dialogue after recognized-song activation is restored, then present the exact proposed change before any implementation or rerun.

---

## Overview

The recognized-song instability slice is now in a good place: aggregation collapse was fixed, canonical rerun recognition held, reconciliation activated, and reconciled dialogue score improved to the low 90s. The remaining anomaly is narrower: `Your life burns faster` still survives in reconciled dialogue even though the same run clearly recognizes `Master of Puppets` and removes several nearby lyric-contamination lines.

This slice should determine whether that survivor is caused by sparse `matchedLyrics`, literal/transcript variance (`life burns faster` vs canonical lyrics), normalization/matching thresholds, current removal policy boundaries, or truth-artifact expectations. The work should stop at an approval-ready diagnosis and exact proposed fix direction before any code changes or reruns.

---

## REFERENCES

| ID | Description | Path |
| --- | --- | --- |
| `REF-01` | Recognized-song instability plan/outcome | `.plans/2026-04-27-investigate-recognized-song-instability.md` |
| `REF-02` | Recognized-song instability outcome audit | `docs/2026-04-27-recognized-song-instability-outcome-audit.md` |
| `REF-03` | Live reconciliation script | `server/scripts/get-context/reconcile-famous-song-phase1.cjs` |
| `REF-04` | Live music-vocals script | `server/scripts/get-context/get-music-vocals.cjs` |
| `REF-05` | Reconciliation tests | `test/scripts/reconcile-famous-song-phase1.test.js` |
| `REF-06` | Latest reconciled dialogue artifact | `output/cod-test/phase1-gather-context/dialogue-data.reconciled.json` |
| `REF-07` | Latest music-vocals artifact | `output/cod-test/phase1-gather-context/music-vocals-data.json` |
| `REF-08` | Latest reconciliation ledger | `output/cod-test/phase1-gather-context/famous-song-reconciliation.json` |
| `REF-09` | Current dialogue benchmark artifact result | `benchmarks/fixtures/cod-test/_reports/artifact-results/dialogueData.json` |
| `REF-10` | cod-test truth surfaces relevant to lyric wording | `benchmarks/fixtures/cod-test/truth/` |

---

## Tasks

### Task 1: Audit why `Your life burns faster` survives reconciliation

**Bead ID:** `ee-hpbp`  
**SubAgent:** `primary`  
**Role:** `research`  
**References:** `REF-02`, `REF-03`, `REF-04`, `REF-05`, `REF-06`, `REF-07`, `REF-08`, `REF-09`, `REF-10`  
**Prompt:** Audit why `Your life burns faster` remains in reconciled dialogue after recognized-song activation is restored. Claim the bead on start. Determine whether the cause is sparse matched-lyric coverage, lyric wording/transcript variance, normalization or similarity thresholds, current removal-policy boundaries, or benchmark/truth expectations. Produce a concise repo note with exact proposed change options and a recommended narrow fix Derrick can approve or reject directly. Update this plan with findings and leave later tasks pending.

**Folders Created/Deleted/Modified:**
- `docs/`
- `.plans/`

**Files Created/Deleted/Modified:**
- `docs/2026-04-27-your-life-burns-faster-anomaly-audit.md`
- `.plans/2026-04-27-investigate-your-life-burns-faster-anomaly.md`

**Status:** ✅ Complete

**Results:** Manual artifact audit completed after repeated research handoff glitches. `dialogue-data.json` shows a low-confidence sung cluster at indexes `13-17`, with index `16` = `Your life burns faster`. `dialogue-data.reconciled.json` removes surrounding lyric lines but leaves index `16`. The current `music-vocals-data.json` `recognizedSong.matchedLyrics` list and `vocal_segments` do not contain `Your life burns faster`, so reconciliation has no direct evidence for that exact line under current policy. Recommended next-step option set: (1) narrow local bridge-rule in `server/scripts/get-context/reconcile-famous-song-phase1.cjs` allowing a low-confidence sung line between already-confirmed lyric contaminations from the same local run to be removed even without exact lyric text support; or (2) broaden upstream lyric support capture in `get-music-vocals.cjs` so the exact fragment appears in `vocal_segments` / matched support. Recommended fix: option (1), because it is narrower, generic, and localized to reconciliation. Supporting doc stub written to `docs/2026-04-27-your-life-burns-faster-anomaly-audit.md`. Tasks 2-4 intentionally remain pending.

---

### Task 2: Implement the approved narrow fix

**Bead ID:** `ee-rjdx`  
**SubAgent:** `primary`  
**Role:** `coder`  
**References:** `REF-03`, `REF-04`, `REF-05`, `REF-06`, `REF-07`, `REF-08`, `REF-10`  
**Prompt:** Implement the approved narrow bridge-rule in `server/scripts/get-context/reconcile-famous-song-phase1.cjs`. Claim bead `ee-rjdx` on start with `bd update ee-rjdx --status in_progress --json`. Add/update focused tests in `test/scripts/reconcile-famous-song-phase1.test.js`, run relevant validation, update this plan with exact results/files/commits, commit and push by default, and close the bead with `bd close ee-rjdx --reason "Implemented approved narrow bridge-rule and validated it" --json`.

**Folders Created/Deleted/Modified:**
- `server/`
- `test/`
- `.plans/`

**Files Created/Deleted/Modified:**
- `server/scripts/get-context/reconcile-famous-song-phase1.cjs`
- `test/scripts/reconcile-famous-song-phase1.test.js`
- `.plans/2026-04-27-investigate-your-life-burns-faster-anomaly.md`

**Status:** ✅ Complete

**Results:** Implemented a narrow local bridge-rule in `server/scripts/get-context/reconcile-famous-song-phase1.cjs` for a low-confidence same-speaker dialogue line that is directly sandwiched between already lyric-like contamination candidates. The rule stays bounded: it only applies when the middle line has no existing lyric evidence, is low-confidence, lacks a strong spoken-signal neighbor pattern, and both immediate same-speaker neighbors are already lyric-like via direct evidence or the existing direct-vocal promotion path. Added focused regression coverage in `test/scripts/reconcile-famous-song-phase1.test.js` for the exact `Your life burns faster` survivor pattern plus a guardrail case that proves a high-confidence same-speaker spoken line does not get bridged away. Validation run: `node --test test/scripts/reconcile-famous-song-phase1.test.js` ✅. Committed and pushed to `main` as `f9f700b` (`Add bounded lyric bridge for reconciliation`), then updated this plan in follow-up commit `494fc15` (`Update anomaly plan with coder handoff`).

---

### Task 3: Rerun cod-test after the approved fix

**Bead ID:** `ee-7j6r`  
**SubAgent:** `primary`  
**Role:** `qa`  
**References:** `REF-03`, `REF-06`, `REF-07`, `REF-08`, `REF-09`, `REF-10`  
**Prompt:** After bead `ee-rjdx` is closed, claim bead `ee-7j6r` with `bd update ee-7j6r --status in_progress --json`, run the canonical cod-test pipeline, compare anomaly outcomes and benchmark deltas, update this plan with exact findings/artifacts, write a concise QA note if useful, and close the bead with `bd close ee-7j6r --reason "Ran cod-test and recorded anomaly outcome" --json`.

**Folders Created/Deleted/Modified:**
- `output/`
- `benchmarks/`
- `docs/`
- `.plans/`

**Files Created/Deleted/Modified:**
- `output/_archives/cod-test-pre-ee-7j6r-20260427-163732/`
- `output/cod-test/**`
- `benchmarks/fixtures/cod-test/_reports/**`
- `.logs/cod-test-20260427-163732-ee-7j6r-bridge-rule-qa.log`
- `.logs/cod-test-20260427-163732-ee-7j6r-bridge-rule-qa.time`
- `docs/2026-04-27-bridge-rule-qa-rerun-note.md`
- `.plans/2026-04-27-investigate-your-life-burns-faster-anomaly.md`

**Status:** ✅ Complete

**Results:** Ran the canonical cod-test rerun shape with archive + clean live digital-twin isolation: `set -euo pipefail; mkdir -p .logs output/_archives; TS=$(date +%Y%m%d-%H%M%S); ARCHIVE_DIR="output/_archives/cod-test-pre-ee-7j6r-$TS"; LOG=".logs/cod-test-$TS-ee-7j6r-bridge-rule-qa.log"; TIMELOG=".logs/cod-test-$TS-ee-7j6r-bridge-rule-qa.time"; mkdir -p "$ARCHIVE_DIR"; if [ -d output/cod-test ]; then mv output/cod-test "$ARCHIVE_DIR/"; fi; if [ -d benchmarks/fixtures/cod-test/_reports ]; then cp -a benchmarks/fixtures/cod-test/_reports "$ARCHIVE_DIR/benchmark_reports_before"; fi; set -a; . ./.env; set +a; /usr/bin/time -p -o "$TIMELOG" node server/run-pipeline.cjs --config configs/cod-test.yaml --clean-live-digital-twin --verbose 2>&1 | tee "$LOG"`.

Actual QA run packet:
- archive: `output/_archives/cod-test-pre-ee-7j6r-20260427-163732/`
- log: `.logs/cod-test-20260427-163732-ee-7j6r-bridge-rule-qa.log`
- timing: `.logs/cod-test-20260427-163732-ee-7j6r-bridge-rule-qa.time` → `real 295.84`

Outcome:
- Pipeline completed Phases 1-3, then exited non-zero at benchmark time with `0/7 artifacts passed`, `362/699 scoreable fields passed`, `699/1203` truth fields covered.
- The specific anomaly is gone in the fresh run. Archived pre-run raw + reconciled dialogue both contained `index 16 = "Your life burns faster"`; fresh raw + reconciled dialogue contain no `Your life burns faster` line.
- Fresh reconciliation status remains `applied` in `output/cod-test/phase1-gather-context/famous-song-reconciliation.json`.

Important interpretation:
- This rerun did **not** prove the bounded bridge rule fired in live runtime.
- Instead, upstream Phase 1 capture shifted: fresh raw dialogue indexes `13-20` are now canonical lyric lines, and fresh `music-vocals-data.json` now carries direct support for those same lines in both `recognizedSong.primaryCandidate.matchedLyrics` and `vocal_segments`.
- The fresh reconciliation ledger removed dialogue indexes `13,14,15,16,17,18,19,20,21,27` using direct lyric evidence. No `removedDialogueSegments[*].evidence.boundedLyricBridge` entries appeared in this live rerun.
- So the visible anomaly is resolved, but for this provider-backed run it disappeared because direct lyric support got stronger, not because the new bridge path was exercised on the old survivor shape.

Useful before/after deltas:
- Archived pre-run packet `output/_archives/cod-test-pre-ee-7j6r-20260427-163732/cod-test/phase1-gather-context/`: raw dialogue `26`, reconciled dialogue `20`, removed dialogue indexes `13,14,15,17,23,24`, survivor `index 16 = "Your life burns faster"` still present after reconciliation.
- Fresh packet `output/cod-test/phase1-gather-context/`: raw dialogue `29`, reconciled dialogue `19`, removed dialogue indexes `13,14,15,16,17,18,19,20,21,27`, no `Your life burns faster` in raw or reconciled dialogue.
- Benchmark summary stayed red before and after (`0/7` passed, `3 fail`, `4 error`), but the artifact surfaces moved:
  - `dialogueData` accuracy `0.5121 -> 0.4095`, output segments `20 -> 19`
  - `dialogueDataRaw` accuracy `0.7761 -> 0.8284`, output segments `26 -> 29`
  - `musicVocalsData` accuracy `0.3881 -> 0.4468`, ignored differences `33 -> 53`
  - `musicData` accuracy `0.3333 -> 0.2941`
  - `recommendationData` accuracy `0.1176 -> 0.1333`
  - `metricsData` and `emotionalAnalysisData` unchanged at the top-line summary level

Durable QA note written to `docs/2026-04-27-bridge-rule-qa-rerun-note.md`.

---

### Task 4: Independent audit of the anomaly outcome

**Bead ID:** `ee-hbk5`  
**SubAgent:** `primary`  
**Role:** `auditor`  
**References:** `REF-03`, `REF-06`, `REF-07`, `REF-08`, `REF-09`, `REF-10`  
**Prompt:** After bead `ee-7j6r` is closed, claim bead `ee-hbk5` with `bd update ee-hbk5 --status in_progress --json`, independently audit the post-fix outcome, verify whether the anomaly was addressed for the right reason, update this plan with exact audit findings, and close the bead with `bd close ee-hbk5 --reason "Independent audit complete" --json`.

**Folders Created/Deleted/Modified:**
- `.plans/`

**Files Created/Deleted/Modified:**
- `.plans/2026-04-27-investigate-your-life-burns-faster-anomaly.md`

**Status:** ✅ Complete

**Results:** Independent audit passed. Evidence checked: committed bridge-rule diff `f9f700b`, focused regression coverage in `test/scripts/reconcile-famous-song-phase1.test.js`, fresh live artifacts under `output/cod-test/phase1-gather-context/`, archived pre-fix comparison packet under `output/_archives/cod-test-pre-ee-7j6r-20260427-163732/`, QA note `docs/2026-04-27-bridge-rule-qa-rerun-note.md`, and current benchmark report surfaces under `benchmarks/fixtures/cod-test/_reports/`.

Audit findings:
- The bounded bridge-rule in `REF-03` is correctly implemented as a narrow same-speaker sandwich rule. It only activates for low-confidence dialogue with no existing lyric evidence, requires immediate left/right same-speaker neighbors, requires those neighbors to already be lyric-like through direct evidence or the existing direct-vocal promotion path, and is still blocked by the pre-existing spoken-signal guard. That is the right shape for the originally observed survivor pattern rather than a broad removal heuristic.
- The focused tests are appropriate and passing. They cover the exact survivor pattern (`Your life burns faster` bridged away), a high-confidence spoken guardrail, and adjacent propagation/containment behavior. Fresh validation rerun: `node --test test/scripts/reconcile-famous-song-phase1.test.js` ✅ (13/13 passing).
- The anomaly is actually gone in the latest provider-backed output for the right observable reason in that run: fresh raw dialogue no longer contains `Your life burns faster`, fresh reconciled dialogue also does not contain it, and the fresh reconciliation ledger removes the surrounding lyric block using `evidenceType: direct` only.
- QA's interpretation is correct. The latest rerun did **not** demonstrate live bridge activation. Compared with the archived pre-fix packet where raw+reconciled dialogue both still contained `index 16 = "Your life burns faster"`, the fresh packet shows stronger upstream lyric capture instead: raw dialogue indexes `13-21` are already canonical lyric lines and `music-vocals-data.json` now supplies direct matched-lyric coverage for the same cluster. The ledger contains no `bounded_lyric_bridge` removals in this run.
- Remaining risk/follow-up: the new bridge path is regression-covered but not replay-proven against the original provider output shape because the live source shifted underneath QA. That is acceptable for closure of this anomaly bead because the code path is narrowly guarded and unit-covered, but if future work needs runtime proof of the bridge itself, the repo should preserve or synthesize a fixed artifact fixture for the original `Speaker 9` survivor packet and run reconciliation deterministically against it.

---

## Final Results

**Status:** ✅ Complete

**What We Built:** Completed the diagnosis, implemented the approved bounded bridge-rule, ran the canonical cod-test QA rerun, and independently audited the post-fix outcome. The visible `Your life burns faster` anomaly is gone in the latest provider-backed packet, and the newly added bridge path remains in place as a narrowly guarded regression safety net for the original survivor shape.

**Reference Check:** `REF-03` and `REF-05` were updated directly in the coder slice and then independently re-audited. The QA/audit pass rechecked `REF-06`, `REF-07`, `REF-08`, `REF-09`, and `REF-10` using both the fresh artifact packet and the archived pre-run packet at `output/_archives/cod-test-pre-ee-7j6r-20260427-163732/`. Final read: the anomaly is gone, the fresh reconciliation ledger removes the lyric block through direct lyric evidence rather than `boundedLyricBridge`, and that interpretation matches both the raw artifacts and the QA note.

**Commits:**
- `f9f700b` - Add bounded lyric bridge for reconciliation
- `494fc15` - Update anomaly plan with coder handoff
- `0915698` - Refresh anomaly plan commit references

**Lessons Learned:** For provider-backed reruns, outcome verification and mechanism verification are different questions. Here, the outcome is genuinely fixed in the fresh packet, but the mechanism observed live was upstream evidence improvement rather than bridge activation. The bridge-rule still earns its keep because the implementation is bounded and the exact anomaly shape is covered by focused tests; if future slices need runtime proof of that specific path, they should pin a deterministic fixture of the old packet instead of relying on another live provider replay.

---

*Completed on 2026-04-27*