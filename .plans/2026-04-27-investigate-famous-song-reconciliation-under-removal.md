# Emotion Engine

**Date:** 2026-04-27  
**Status:** In Progress  
**Agent:** Cookie 🍪

---

## Goal

Investigate and narrowly revise famous-song reconciliation so known-song lyric contamination is removed more completely from reconciled dialogue, then rerun `cod-test` after Derrick approves the exact script changes.

---

## Overview

The current state suggests the primary dialogue generation lane is mostly acceptable aside from the separate weak-line omission issue (`You shall know fear.`). The more urgent problem for the benchmark is now in famous-song reconciliation: the rerun correctly recognized `Master of Puppets`, but the reconciler only removed two dialogue segments while several obvious lyric-contamination lines remained in reconciled dialogue. That means the score drop was not really about hearing more lyric material; it was about failing to remove that material after recognition.

The likely causes currently visible are twofold. First, the reconciliation gate appears to rely on a limited `matchedLyrics` anchor set rather than a fuller removal-evidence surface. Second, the spoken-signal preservation heuristic appears to protect lyric-contaminated same-speaker runs too aggressively once the dialogue lane groups them into a coherent speaker block. The next pass should audit those mechanics, produce a proposed narrow script revision for approval, and only then implement and rerun.

---

## REFERENCES

| ID | Description | Path |
| --- | --- | --- |
| `REF-01` | Current anti-omission prompt plan and rerun notes | `.plans/2026-04-27-audit-dialogue-prompt-for-missed-lines-and-rerun-cod-test.md` |
| `REF-02` | Current reconciliation script | `server/scripts/get-context/reconcile-famous-song-phase1.cjs` |
| `REF-03` | Reconciliation tests | `test/scripts/reconcile-famous-song-phase1.test.js` |
| `REF-04` | Fresh reconciliation ledger showing under-removal | `output/cod-test/phase1-gather-context/famous-song-reconciliation.json` |
| `REF-05` | Fresh reconciled dialogue artifact still containing lyric contamination | `output/cod-test/phase1-gather-context/dialogue-data.reconciled.json` |
| `REF-06` | Fresh reconciled music-vocals artifact / recognized song support | `output/cod-test/phase1-gather-context/music-vocals-data.reconciled.json` |
| `REF-07` | Benchmark report for the failed rerun | `benchmarks/fixtures/cod-test/_reports/artifact-results/dialogueData.json` |
| `REF-08` | Memory note confirming prior routing bug was fixed and remaining red should be honest content drift | `memory/2026-04-20.md` |

---

## Tasks

### Task 1: Audit why reconciliation under-removes known-song lyric contamination

**Bead ID:** `ee-20yv`  
**SubAgent:** `primary`  
**Role:** `research`  
**References:** `REF-02`, `REF-03`, `REF-04`, `REF-05`, `REF-06`, `REF-07`, `REF-08`  
**Prompt:** Audit `reconcile-famous-song-phase1.cjs` and the fresh cod-test artifacts to explain exactly why known `Master of Puppets` lines remained in reconciled dialogue. Claim the bead on start. Determine whether the limiting factor is narrow `matchedLyrics` coverage, the spoken-signal heuristic, the vocal-index proximity rule, direct-vocal-text support behavior, or some combination. Produce a concise repo note that proposes narrow script edits Derrick can approve directly before implementation. Update the plan with exact findings and leave later tasks pending.

**Folders Created/Deleted/Modified:**
- `docs/`
- `.plans/`

**Files Created/Deleted/Modified:**
- `docs/2026-04-27-famous-song-reconciliation-under-removal-audit.md`
- `.plans/2026-04-27-investigate-famous-song-reconciliation-under-removal.md`

**Status:** ✅ Complete

**Results:** Completed the audit and wrote `docs/2026-04-27-famous-song-reconciliation-under-removal-audit.md`. Exact finding: the recognized-song gate passed correctly, but `reconcileDialogue()` removed only indexes `11` and `25` because sparse `matchedLyrics` only seeded dialogue evidence for indexes `11`, `12`, `13`, `17`, `19`, and `25`, leaving indexes `14`, `15`, `16`, and `18` uncandidateable despite exact direct vocal transcript support. Then `hasStrongSpokenSignal()` incorrectly preserved indexes `12`, `13`, `17`, and `19` because adjacent same-speaker lyric lines were treated as spoken-context support. Proposed approval-ready edit set: in `server/scripts/get-context/reconcile-famous-song-phase1.cjs`, promote strong direct vocal-text matches into dialogue-removal candidates inside the already-passed recognized-song gate when the segment is low confidence and either near vocal evidence or adjacent to an already lyric-evidenced dialogue segment; then refine `hasStrongSpokenSignal()` so lyric-like neighbors do not count as spoken support. Proposed tests in `test/scripts/reconcile-famous-song-phase1.test.js`: add a cod-test-style full lyric-run regression proving the whole `11-19` contamination block is removed even with sparse `matchedLyrics`, add a focused regression proving lyric neighbors no longer trigger spoken-signal preservation, and add a safety regression proving a real spoken same-speaker line adjacent to lyrics is still kept. Tasks 2-4 remain intentionally pending until Derrick approves implementation and rerun scope.

---

### Task 2: Implement the approved narrow reconciliation fix

**Bead ID:** `ee-a7q5`  
**SubAgent:** `primary`  
**Role:** `coder`  
**References:** `REF-02`, `REF-03`, `REF-04`, `REF-05`, `REF-06`  
**Prompt:** After Derrick approves the proposed reconciliation edits, implement the narrow script/test changes in the live famous-song reconciliation path. Claim the bead on start. Keep the goal tight: improve removal of known-song lyric contamination from reconciled dialogue without damaging legitimate spoken lines or reopening unrelated prompt work. Update/add regression tests, run relevant validation, update the plan with exact changes, and commit/push by default before handoff.

**Folders Created/Deleted/Modified:**
- `server/`
- `test/`
- `.plans/`

**Files Created/Deleted/Modified:**
- `server/scripts/get-context/reconcile-famous-song-phase1.cjs`
- `test/scripts/reconcile-famous-song-phase1.test.js`
- `.plans/2026-04-27-investigate-famous-song-reconciliation-under-removal.md`

**Status:** ✅ Complete

**Results:** Implemented the approved narrow generic fix in `server/scripts/get-context/reconcile-famous-song-phase1.cjs` without changing `reconcileMusicVocals()` behavior or broadening any gate thresholds. In `reconcileDialogue()`, low-confidence dialogue segments can now become removal candidates from strong direct vocal-text support inside an already-passed recognized-song gate when they are either near vocal-evidence indexes or adjacent to an already lyric-evidenced dialogue segment. Also refined `hasStrongSpokenSignal()` so lyric-like neighbors no longer count as spoken support, while real spoken neighbors still remain protected. Added three regression tests in `test/scripts/reconcile-famous-song-phase1.test.js` covering the sparse-anchor lyric-run failure mode, lyric-neighbor spoken-signal leakage, and the real-spoken-neighbor safety case. Validation run: `node --test test/scripts/reconcile-famous-song-phase1.test.js` ✅. Commit/push completed in the coder lane.

---

### Task 3: Rerun cod-test and compare reconciled dialogue scores

**Bead ID:** `ee-5n2f`  
**SubAgent:** `primary`  
**Role:** `qa`  
**References:** `REF-04`, `REF-05`, `REF-06`, `REF-07`  
**Prompt:** After the reconciliation fix lands, claim the bead and rerun the canonical cod-test pipeline. Compare the new reconciled dialogue results against both the current failed rerun and the earlier high-score baseline. Focus on whether known-song lyric contamination is removed more completely from `dialogue-data.reconciled.json`, whether benchmark `dialogueData` scores recover, and whether any legitimate spoken lines are accidentally removed. Record exact commands, artifacts, and before/after numbers in the plan and a concise QA note if useful.

**Folders Created/Deleted/Modified:**
- `output/`
- `benchmarks/`
- `docs/`
- `.plans/`

**Files Created/Deleted/Modified:**
- `.logs/cod-test-20260427-ee-5n2f-postfix-rerun.log`
- `output/cod-test/phase1-gather-context/dialogue-data.json`
- `output/cod-test/phase1-gather-context/dialogue-data.reconciled.json`
- `output/cod-test/phase1-gather-context/famous-song-reconciliation.json`
- `benchmarks/fixtures/cod-test/_reports/artifact-results/dialogueData.json`
- `benchmarks/fixtures/cod-test/_reports/benchmark-summary.json`
- `docs/2026-04-27-famous-song-reconciliation-postfix-qa-note.md`
- `.plans/2026-04-27-investigate-famous-song-reconciliation-under-removal.md`

**Status:** ✅ Complete

**Results:** Claimed `ee-5n2f` and reran the canonical full cod-test pipeline with the exact command sequence:
- `set -a && . ./.env && set +a`
- `node validate-configs.cjs`
- `node server/run-pipeline.cjs --config configs/cod-test.yaml --verbose`

The run completed Phase 1-3, refreshed the canonical benchmark/report artifacts, and ended with the expected benchmark-stage failure surface recorded in `.logs/cod-test-20260427-ee-5n2f-postfix-rerun.log`: `0/7 artifacts passed. 359/701 scoreable fields passed. Truth coverage was 701/1204 fields.`

**Metric comparison**
- Earlier high-score baseline (documented in `.plans/2026-04-27-audit-dialogue-prompt-for-missed-lines-and-rerun-cod-test.md`): `dialogue_text_full_transcript_pct=90.7`, `dialogue_text_windowed_pct=90.7`, `extra_output_window_count=0`
- Failed rerun immediately before this fix (same plan/report surface): `dialogue_text_full_transcript_pct=66.5`, `dialogue_text_windowed_pct=67.2`, `extra_output_window_count=6`
- Post-fix rerun (`benchmarks/fixtures/cod-test/_reports/artifact-results/dialogueData.json`): `dialogue_text_full_transcript_pct=81.3`, `dialogue_text_windowed_pct=81.7`, `dialogue_boundary_pct=28.6`, `output_segment_count=22`, `extra_output_window_count=1`

**Reconciled dialogue correctness findings**
- The fix produced a real reconciliation improvement versus the failed rerun: the fresh ledger at `output/cod-test/phase1-gather-context/famous-song-reconciliation.json` removed dialogue indexes `13`, `14`, `18`, `19`, and `20` with texts `Obey your master`, `Come crawling faster`, `Just call my name, 'cause I'll hear you scream`, `Master, master`, and `Just call my name, 'cause I'll hear you scream`.
- The contamination block is therefore much smaller than the pre-fix failed rerun’s long `13-20` lyric burst, but it is **not fully eliminated**. Fresh reconciled dialogue still contains lyric lines at indexes `15`, `16`, and `17`: `Master of puppets, I'm pulling your strings`, `Twisting your mind and smashing your dreams`, and `Blinded by me, you can't see a thing`.
- I did **not** find evidence in this contaminated cluster that legitimate spoken lines were wrongly removed. Spoken lines `This isn't real.`, `The hell it ain't!`, `Pull it together, man.`, `So eager to leave, David.`, and `Killing the man is a hell of a lot easier than killing the idea.` remain present in `output/cod-test/phase1-gather-context/dialogue-data.reconciled.json`.
- The weak-line issue remains unchanged: `You shall know fear.` is still missing from the fresh reconciled dialogue, and the benchmark alignment still merges truth indexes `[8,9]` into output `[8]` before aligning truth index `[10]` to output `[9]`.

Concise QA note written to `docs/2026-04-27-famous-song-reconciliation-postfix-qa-note.md`. The main QA read is: this generic reconciliation fix recovered most of the score loss caused by under-removal (`66.5/67.2/6` → `81.3/81.7/1`) and removed five obvious lyric contaminants without harming nearby spoken lines, but three lyric lines still survive in reconciled dialogue, so this lane improved correctness substantially without yet matching the earlier `90.7/90.7/0` baseline.

---

### Task 4: Independent audit of the post-fix reconciliation outcome

**Bead ID:** `ee-4xos`  
**SubAgent:** `primary`  
**Role:** `auditor`  
**References:** `REF-02`, `REF-04`, `REF-05`, `REF-06`, `REF-07`  
**Prompt:** Independently audit the post-fix cod-test rerun. Claim the bead on start. Verify that reconciled dialogue improved for the right reason: known-song lyric contamination was actually removed more completely, not merely shifted around. Confirm whether any legitimate spoken lines were wrongly dropped, and whether the score movement is supported by the concrete artifacts. Update the plan with the verdict and recommendation.

**Folders Created/Deleted/Modified:**
- `docs/`
- `.plans/`

**Files Created/Deleted/Modified:**
- `docs/2026-04-27-famous-song-reconciliation-postfix-audit.md`
- `.plans/2026-04-27-investigate-famous-song-reconciliation-under-removal.md`

**Status:** ✅ Complete

**Results:** Independently verified the post-fix improvement against the live artifacts and the current benchmark report. The gain is real, not report noise: `output/cod-test/phase1-gather-context/dialogue-data.reconciled.json` now removes five lyric-contamination lines (`13`, `14`, `18`, `19`, `20`) that survived the prior failed rerun, shrinking the famous-song contamination block to only three remaining lyric lines (`15`, `16`, `17`). That concrete artifact cleanup matches the current report movement in `benchmarks/fixtures/cod-test/_reports/artifact-results/dialogueData.json`: `dialogue_text_full_transcript_pct 66.5 -> 81.3`, `dialogue_text_windowed_pct 67.2 -> 81.7`, and `extra_output_window_count 6 -> 1` relative to the immediately pre-fix failed rerun documented in this plan/QA note. I did not find evidence that legitimate spoken lines were wrongly removed; nearby spoken lines such as `This isn't real.`, `The hell it ain't!`, `Pull it together, man.`, `So eager to leave, David.`, `Killing the man is a hell of a lot easier than killing the idea.`, and `You were never cut out to be a Mason.` all remain present in the reconciled artifact. The three surviving lyric lines are explainable by the current narrow generic logic: commit `eb4cc6a` promotes only first-hop direct-vocal-support neighbors off sparse recognized-song anchor hits (`Master, master`, `Obey your master`), so indexes `14`, `18`, and `20` get promoted but middle lines `15`, `16`, and `17` never become candidates because `hasAdjacentLyricEvidence()` only chains through `hasExistingLyricEvidence`, not prior direct-vocal-support promotions. Concise audit note written to `docs/2026-04-27-famous-song-reconciliation-postfix-audit.md`. Recommendation: stop here on generic reconciliation for now and return to the weak-line omission issue (`You shall know fear.`), since the lyric-removal fix already recovered most of the lost score while further broadening this lane now would trade for higher false-positive risk.

---

## Final Results

**Status:** ⏳ Pending

**What We Built:** Pending.

**Reference Check:** Pending.

**Commits:**
- Pending.

**Lessons Learned:** Pending.

---

*Planned on 2026-04-27*